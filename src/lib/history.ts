// History: every finished day, newest first, and the detail of one. Read in one liveQuery; the view
// model below is pure so it's tested without a UI.

import type { CycleDay, Exercise } from './seed'
import type { Activity, DayLog, LogbookDB, SetRow } from './db'
import { formatWeight, prSetIds } from './logic'
import { toUnit, type Unit } from './units'

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
export function sessionSummary(s: Session, unit: Unit = 'kg'): string {
  if (s.skipped) return 'Skipped'
  if (s.type === 'rest' || s.setCount === 0) {
    return s.activities.length ? s.activities.map((a) => `${a.kind} ${a.minutes} min`).join(' · ') : 'Rested'
  }
  const parts = [`${s.setCount} ${s.setCount === 1 ? 'set' : 'sets'}`]
  if (s.prIds.size) parts.push(`${s.prIds.size} ${s.prIds.size === 1 ? 'PR' : 'PRs'}`)
  if (s.volumeKg > 0) parts.push(formatVolume(s.volumeKg, unit))
  return parts.join(' · ')
}

/** Whole kilos with thousands separators: 3240 → "3,240". */
export function formatKg(kg: number): string {
  return Math.round(kg).toLocaleString('en-GB')
}

/** Volume with its unit: "3,240 kg", "7,143 lb". */
export function formatVolume(kg: number, unit: Unit = 'kg'): string {
  return `${formatKg(toUnit(kg, unit))}\u00a0${unit}`
}

/** "Tue 14 Oct", plus the year when it isn't this year. */
export function formatDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const text = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
  return d.getFullYear() === now.getFullYear() ? text : `${text} ${d.getFullYear()}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ---- One exercise ----

/**
 * Estimated one-rep max (Epley: w × (1 + reps/30)). A single is its own weight. Bodyweight (0 kg) has
 * no 1RM. Past ~12 reps the estimate drifts high, but it's consistent, which is what a trend needs.
 */
export function e1rm(weightKg: number, reps: number): number {
  if (weightKg === 0) return 0
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

/** Heavier wins; at the same weight, more reps. */
export function topSet(sets: SetRow[]): SetRow | undefined {
  return sets.reduce<SetRow | undefined>(
    (best, s) => (!best || s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps) ? s : best),
    undefined,
  )
}

export interface ExerciseSession {
  key: string
  cycleNumber: number
  cycleDayId: string
  dayName: string
  date: string
  /** False for today's day while it's still open. */
  finished: boolean
  sets: SetRow[]
  top: SetRow
  /** The session's best e1RM, or its best reps for bodyweight work. */
  value: number
  hasPR: boolean
}

/** What the chart and "best" track: e1RM, or reps when every set is bodyweight. */
export type Metric = 'e1rm' | 'reps'

export function metricFor(sets: SetRow[]): Metric {
  return sets.length > 0 && sets.every((s) => s.weightKg === 0) ? 'reps' : 'e1rm'
}

const valueOf = (metric: Metric) => (s: SetRow) => (metric === 'reps' ? s.reps : e1rm(s.weightKg, s.reps))

/** Every day this exercise was logged on, newest first, including today's open day. */
export function exerciseSessions(exerciseId: string, data: HistoryData): ExerciseSession[] {
  const sets = data.sets.filter((s) => s.exerciseId === exerciseId).sort(byLoggedAt)
  const metric = metricFor(sets)
  const value = valueOf(metric)
  const prs = prSetIds(sets)
  const finished = new Set(data.dayLogs.map((l) => sessionKey(l.cycleNumber, l.cycleDayId)))
  const dayName = new Map(data.days.map((x) => [x.id, x.name]))

  const groups = new Map<string, SetRow[]>()
  for (const s of sets) {
    const k = sessionKey(s.cycleNumber, s.cycleDayId)
    groups.set(k, [...(groups.get(k) ?? []), s])
  }
  return [...groups]
    .map(([key, rows]) => ({
      key,
      cycleNumber: rows[0].cycleNumber,
      cycleDayId: rows[0].cycleDayId,
      dayName: dayName.get(rows[0].cycleDayId) ?? rows[0].cycleDayId,
      date: rows[0].loggedAt,
      finished: finished.has(key),
      sets: rows,
      top: topSet(rows)!,
      value: Math.max(...rows.map(value)),
      hasPR: rows.some((s) => prs.has(s.id)),
    }))
    .reverse()
}

export interface ExerciseStats {
  metric: Metric
  /** Best e1RM (or reps) ever, and the set that made it. */
  best: { value: number; set: SetRow } | null
  heaviest: SetRow | null
  sessions: number
  sets: number
  prs: number
  /** Kilos lifted, all time. */
  volumeKg: number
}

export function exerciseStats(exerciseId: string, data: HistoryData): ExerciseStats {
  const sets = data.sets.filter((s) => s.exerciseId === exerciseId)
  const metric = metricFor(sets)
  const value = valueOf(metric)
  let best: ExerciseStats['best'] = null
  for (const s of [...sets].sort(byLoggedAt)) {
    const v = value(s)
    if (!best || v > best.value) best = { value: v, set: s }
  }
  return {
    metric,
    best,
    heaviest: topSet(sets) ?? null,
    sessions: new Set(sets.map((s) => sessionKey(s.cycleNumber, s.cycleDayId))).size,
    sets: sets.length,
    prs: prSetIds(sets).size,
    volumeKg: sets.reduce((v, s) => v + s.weightKg * s.reps, 0),
  }
}

export interface ExerciseIndexRow {
  exercise: Exercise
  lastDate: string
  sessions: number
  /** "Best 82.5 kg e1RM" or "Best 15 reps". */
  bestText: string
}

/** Every exercise with at least one logged set, most recently trained first. */
export function exerciseIndex(data: HistoryData, unit: Unit = 'kg'): ExerciseIndexRow[] {
  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const ids = new Map<string, string>()
  for (const s of data.sets) if ((ids.get(s.exerciseId) ?? '') < s.loggedAt) ids.set(s.exerciseId, s.loggedAt)
  return [...ids]
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .map(([id, lastDate]) => {
      const st = exerciseStats(id, data)
      return {
        exercise: exById.get(id) ?? { id, name: id, stepKg: 2.5 },
        lastDate,
        sessions: st.sessions,
        bestText: bestText(st, unit),
      }
    })
}

export function bestText(st: ExerciseStats, unit: Unit = 'kg'): string {
  if (!st.best) return ''
  return st.metric === 'reps' ? `Best ${st.best.value} reps` : `Best ${formatWeight(st.best.value, unit)}\u00a0${unit} e1RM`
}

export interface ChartPoint {
  date: string
  value: number
  pr: boolean
}

/** Chart data: one point per session, oldest first. */
export function chartPoints(list: ExerciseSession[]): ChartPoint[] {
  return [...list].reverse().map((s) => ({ date: s.date, value: s.value, pr: s.hasPR }))
}

/** Group sessions under month headings ("October 2026"), keeping their order. */
export function byMonth<T extends { date: string }>(list: T[]): { month: string; sessions: T[] }[] {
  const groups: { month: string; sessions: T[] }[] = []
  for (const s of list) {
    const d = new Date(s.date)
    const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    const g = groups.at(-1)
    if (g?.month === month) g.sessions.push(s)
    else groups.push({ month, sessions: [s] })
  }
  return groups
}

// ---- This week ----

export interface WeekStats {
  /** Days with at least one logged set. */
  days: number
  sets: number
  volumeKg: number
  prs: number
}

/** Local midnight on the Monday of the week containing `now`. */
export function weekStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** Totals for sets logged in [from, to). Today's open day counts as you log it. */
export function statsBetween(sets: SetRow[], prIds: Set<string>, from: Date, to: Date): WeekStats {
  const lo = from.toISOString()
  const hi = to.toISOString()
  const inWeek = sets.filter((s) => s.loggedAt >= lo && s.loggedAt < hi)
  return {
    days: new Set(inWeek.map((s) => sessionKey(s.cycleNumber, s.cycleDayId))).size,
    sets: inWeek.length,
    volumeKg: inWeek.reduce((v, s) => v + s.weightKg * s.reps, 0),
    prs: inWeek.filter((s) => prIds.has(s.id)).length,
  }
}

/** This week (Monday on) and last week, for the card on top of History. */
export function weekSummary(data: HistoryData, now = new Date()): { thisWeek: WeekStats; lastWeek: WeekStats } {
  const start = weekStart(now)
  const prev = new Date(start)
  prev.setDate(prev.getDate() - 7)
  const next = new Date(start)
  next.setDate(next.getDate() + 7)
  const prs = allPrIds(data.sets)
  return { thisWeek: statsBetween(data.sets, prs, start, next), lastWeek: statsBetween(data.sets, prs, prev, start) }
}

/** "4 days · 52 sets · 14,200 kg" (and PRs when there are any). */
export function weekLine(w: WeekStats, unit: Unit = 'kg'): string {
  if (w.sets === 0) return 'Nothing logged'
  const parts = [`${w.days} ${w.days === 1 ? 'day' : 'days'}`, `${w.sets} ${w.sets === 1 ? 'set' : 'sets'}`]
  if (w.volumeKg > 0) parts.push(formatVolume(w.volumeKg, unit))
  if (w.prs) parts.push(`${w.prs} ${w.prs === 1 ? 'PR' : 'PRs'}`)
  return parts.join(' · ')
}
