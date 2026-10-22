// History: every finished day, newest first, and the detail of one. Read in one liveQuery; the view
// model below is pure so it's tested without a UI.

import type { CycleDay, Exercise } from './seed'
import type { Activity, DayLog, LogbookDB, SetRow } from './db'
import { prSetIds } from './logic'

export interface HistoryData {
  days: CycleDay[]
  exercises: Exercise[]
  sets: SetRow[]
  activities: Activity[]
  dayLogs: DayLog[]
}

/** Read inside liveQuery: re-runs whenever a set, activity or Finish changes. */
export async function loadHistory(d: LogbookDB): Promise<HistoryData> {
  return {
    days: await d.cycleDays.toArray(),
    exercises: await d.exercises.toArray(),
    sets: await d.sets.toArray(),
    activities: await d.activities.toArray(),
    dayLogs: await d.dayLogs.toArray(),
  }
}

export interface SessionExercise {
  exercise: Exercise
  /** In logged order. */
  sets: SetRow[]
}

export interface Session {
  /** `${cycleNumber}|${cycleDayId}`: one finished day. */
  key: string
  cycleNumber: number
  cycleDayId: string
  dayName: string
  type: 'lift' | 'rest'
  /** When the day was trained: its first entry, or the Finish if it has none. */
  date: string
  skipped: boolean
  exercises: SessionExercise[]
  activities: Activity[]
  setCount: number
  /** Kilos lifted: Σ weight × reps. Bodyweight sets add nothing. */
  volumeKg: number
  prIds: Set<string>
}

export const sessionKey = (cycleNumber: number, cycleDayId: string) => `${cycleNumber}|${cycleDayId}`

const byLoggedAt = (a: { loggedAt: string }, b: { loggedAt: string }) =>
  a.loggedAt < b.loggedAt ? -1 : a.loggedAt > b.loggedAt ? 1 : 0

/** Ids of every PR set, across all exercises. */
export function allPrIds(sets: SetRow[]): Set<string> {
  const byExercise = new Map<string, SetRow[]>()
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  const ids = new Set<string>()
  for (const group of byExercise.values()) prSetIds(group).forEach((id) => ids.add(id))
  return ids
}

/**
 * One entry per finished day (a dayLog), newest first. Today's unfinished day is not history yet:
 * it lives on Today. Exercises appear in the order they were first logged that day.
 */
export function sessions(data: HistoryData): Session[] {
  const dayById = new Map(data.days.map((x) => [x.id, x]))
  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const prs = allPrIds(data.sets)

  const setsByKey = new Map<string, SetRow[]>()
  for (const s of [...data.sets].sort(byLoggedAt)) {
    const k = sessionKey(s.cycleNumber, s.cycleDayId)
    setsByKey.set(k, [...(setsByKey.get(k) ?? []), s])
  }
  const actsByKey = new Map<string, Activity[]>()
  for (const a of [...data.activities].sort(byLoggedAt)) {
    const k = sessionKey(a.cycleNumber, a.cycleDayId)
    actsByKey.set(k, [...(actsByKey.get(k) ?? []), a])
  }

  return data.dayLogs
    .map((log): Session => {
      const key = sessionKey(log.cycleNumber, log.cycleDayId)
      const day = dayById.get(log.cycleDayId)
      const sets = setsByKey.get(key) ?? []
      const activities = actsByKey.get(key) ?? []
      const grouped = new Map<string, SetRow[]>()
      for (const s of sets) grouped.set(s.exerciseId, [...(grouped.get(s.exerciseId) ?? []), s])
      const exercises = [...grouped].map(([id, rows]) => ({
        exercise: exById.get(id) ?? { id, name: id, stepKg: 2.5 },
        sets: rows,
      }))
      const first = [sets[0]?.loggedAt, activities[0]?.loggedAt].filter((x): x is string => !!x).sort()[0]
      return {
        key,
        cycleNumber: log.cycleNumber,
        cycleDayId: log.cycleDayId,
        dayName: day?.name ?? log.cycleDayId,
        type: day?.type ?? (sets.length ? 'lift' : 'rest'),
        date: first ?? log.finishedAt,
        skipped: log.skipped,
        exercises,
        activities,
        setCount: sets.length,
        volumeKg: sets.reduce((v, s) => v + s.weightKg * s.reps, 0),
        prIds: new Set(sets.filter((s) => prs.has(s.id)).map((s) => s.id)),
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.cycleNumber - a.cycleNumber))
}

/** One-line summary for a history row: "5 sets · 2 PRs · 3,240 kg", "Walk 30 min", "Skipped". */
export function sessionSummary(s: Session): string {
  if (s.skipped) return 'Skipped'
  if (s.type === 'rest' || s.setCount === 0) {
    return s.activities.length ? s.activities.map((a) => `${a.kind} ${a.minutes} min`).join(' · ') : 'Rested'
  }
  const parts = [`${s.setCount} ${s.setCount === 1 ? 'set' : 'sets'}`]
  if (s.prIds.size) parts.push(`${s.prIds.size} ${s.prIds.size === 1 ? 'PR' : 'PRs'}`)
  if (s.volumeKg > 0) parts.push(`${formatKg(s.volumeKg)} kg`)
  return parts.join(' · ')
}

/** Whole kilos with thousands separators: 3240 → "3,240". */
export function formatKg(kg: number): string {
  return Math.round(kg).toLocaleString('en-GB')
}

/** "Tue 14 Oct", plus the year when it isn't this year. */
export function formatDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const text = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
  return d.getFullYear() === now.getFullYear() ? text : `${text} ${d.getFullYear()}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Group sessions under month headings ("October 2026"), keeping their order. */
export function byMonth(list: Session[]): { month: string; sessions: Session[] }[] {
  const groups: { month: string; sessions: Session[] }[] = []
  for (const s of list) {
    const d = new Date(s.date)
    const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    const g = groups.at(-1)
    if (g?.month === month) g.sessions.push(s)
    else groups.push({ month, sessions: [s] })
  }
  return groups
}
