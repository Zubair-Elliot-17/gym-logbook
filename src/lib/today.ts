// Everything the Today screen needs, read in one liveQuery, and the pure view model built from it.

import type { CycleDay, DayExercise, Exercise } from './seed'
import { getDraft, getState, positionOf, type Activity, type AppState, type DayLog, type Draft, type LogbookDB, type SetRow } from './db'
import {
  dayNumber,
  exerciseOrder,
  formatLastTime,
  formatWeight,
  ghostsFor,
  lastTime,
  prSetIds,
  type Ghost,
  type Position,
} from './logic'

export interface TodayData {
  state: AppState
  pos: Position
  day: CycleDay
  days: CycleDay[]
  plan: DayExercise[]
  exercises: Exercise[]
  sets: SetRow[]
  activities: Activity[]
  dayLogs: DayLog[]
  draft: Draft
}

/** Read inside liveQuery: re-runs whenever any of these tables change. */
export async function loadToday(d: LogbookDB): Promise<TodayData> {
  const state = await getState(d)
  const pos = positionOf(state)
  const days = await d.cycleDays.toArray()
  const day = days.find((x) => x.id === pos.cycleDayId)
  if (!day) throw new Error(`Unknown current day ${pos.cycleDayId}`)
  return {
    state,
    pos,
    day,
    days,
    plan: await d.dayExercises.where('cycleDayId').equals(pos.cycleDayId).toArray(),
    exercises: await d.exercises.toArray(),
    sets: await d.sets.toArray(),
    activities: await d.activities.where('[cycleNumber+cycleDayId]').equals([pos.cycleNumber, pos.cycleDayId]).toArray(),
    dayLogs: await d.dayLogs.toArray(),
    draft: await getDraft(d, pos),
  }
}

export interface LiftRow {
  exercise: Exercise
  plan?: DayExercise
  ghosts: Ghost[]
  lastText: string
  /** Ids of today's sets that are PRs. */
  prIds: Set<string>
  /** Every ghost logged: the row collapses. */
  done: boolean
  /** Off-plan with no history: no ghosts, the editor opens instead. */
  needsEditor: boolean
}

const isToday = (pos: Position) => (s: SetRow) => s.cycleNumber === pos.cycleNumber && s.cycleDayId === pos.cycleDayId

export function buildLiftRows(data: TodayData): LiftRow[] {
  const { pos, plan, sets, dayLogs, draft } = data
  const byId = new Map(data.exercises.map((e) => [e.id, e]))
  const today = isToday(pos)
  return exerciseOrder({ pos, plan, sets, draftAdded: draft.added }).flatMap((id) => {
    const exercise = byId.get(id)
    if (!exercise) return []
    const planRow = plan.find((p) => p.exerciseId === id && p.cycleDayId === pos.cycleDayId)
    const exSets = sets.filter((s) => s.exerciseId === id)
    const last = lastTime(id, exSets, dayLogs, pos)
    const logged = exSets.filter(today)
    const ghosts = ghostsFor({
      plan: planRow,
      last,
      logged,
      extraSets: draft.extraSets[id] ?? 0,
      weightOverrides: draft.weightOverrides[id] ?? {},
    })
    const prs = prSetIds(exSets)
    return [
      {
        exercise,
        plan: planRow,
        ghosts,
        lastText: formatLastTime(last),
        prIds: new Set(logged.filter((s) => prs.has(s.id)).map((s) => s.id)),
        done: ghosts.length > 0 && ghosts.every((g) => g.logged),
        needsEditor: ghosts.length === 0,
      },
    ]
  })
}

export function loggedCount(rows: LiftRow[]): number {
  return rows.reduce((n, r) => n + r.ghosts.filter((g) => g.logged).length, 0)
}

export interface FinishSummary {
  dayName: string
  title: string
  lines: string[]
}

/** 6A: "<Day> done · N sets · K PRs" with up to 3 PRs listed; rest days list their activities. */
export function finishSummary(data: TodayData, rows: LiftRow[]): FinishSummary {
  const name = data.day.name
  if (data.day.type === 'rest') {
    const lines = [...data.activities]
      .sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1))
      .map((a) => `${a.kind} ${a.minutes} min`)
    return { dayName: name, title: `${name} done`, lines }
  }
  const sets = loggedCount(rows)
  if (sets === 0) return { dayName: name, title: `${name} skipped`, lines: [] }
  const prs = rows.flatMap((r) =>
    r.ghosts
      .filter((g) => g.logged && r.prIds.has(g.logged.id))
      .map((g) => `${r.exercise.name} ${formatWeight(g.logged!.weightKg)} × ${g.logged!.reps}`),
  )
  const parts = [`${name} done`, `${sets} ${sets === 1 ? 'set' : 'sets'}`]
  if (prs.length) parts.push(`${prs.length} ${prs.length === 1 ? 'PR' : 'PRs'}`)
  return { dayName: name, title: parts.join(' · '), lines: prs.slice(0, 3) }
}

export function dayHeading(data: TodayData): string {
  const { n, of } = dayNumber(data.pos, data.days)
  return `Day ${n} of ${of} · cycle #${data.pos.cycleNumber}`
}

/** Week-strip label: "Back & Chest" → "B+C", otherwise the first word, cut to 5 letters if long. */
export function shortName(name: string): string {
  if (name.includes('&')) {
    return name
      .split('&')
      .map((p) => p.trim()[0]?.toUpperCase() ?? '')
      .join('+')
  }
  const first = name.split(/\s+/)[0]
  return first.length > 6 ? first.slice(0, 5) : first
}

export type Banner = 'install' | 'offline' | 'backup' | null

/** 5A: Today shows at most one banner, in this order. */
export function pickBanner(n: { standalone: boolean; offlineReady: boolean; backupOverdue: boolean }): Banner {
  if (!n.standalone) return 'install'
  if (!n.offlineReady) return 'offline'
  if (n.backupOverdue) return 'backup'
  return null
}

/** "today", "yesterday", "N days ago" (calendar days in local time). */
export function daysAgo(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const n = Math.round((day(now) - day(new Date(iso))) / 86_400_000)
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`
}

/** The Finish that "Go back a day" would undo, if any. */
export function lastFinish(data: TodayData): { dayLog: DayLog; dayName: string } | null {
  const latest = [...data.dayLogs].sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))[0]
  if (!latest) return null
  return { dayLog: latest, dayName: data.days.find((x) => x.id === latest.cycleDayId)?.name ?? latest.cycleDayId }
}
