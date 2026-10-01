// Pure rules: cycle advance, jumps, "last time", ghosts, carry-over, PRs, display text.
// No Dexie here; db.ts and the UI pass rows in.

import type { CycleDay, DayExercise } from './seed'
import type { DayLog, SetRow } from './db'

export interface Position {
  cycleNumber: number
  cycleDayId: string
}

const keyOf = (cycleNumber: number, cycleDayId: string) => `${cycleNumber}|${cycleDayId}`
const byLoggedAt = (a: { loggedAt: string }, b: { loggedAt: string }) =>
  a.loggedAt < b.loggedAt ? -1 : a.loggedAt > b.loggedAt ? 1 : 0

// ---- Cycle ----

export function activeDays(days: CycleDay[]): CycleDay[] {
  return days.filter((d) => !d.archived).sort((a, b) => a.order - b.order)
}

/** Where Finish goes: the next active day by order; past the last day, wrap and start cycle K+1. */
export function nextDay(pos: Position, days: CycleDay[]): Position {
  const active = activeDays(days)
  if (active.length === 0) throw new Error('No active cycle days')
  const i = active.findIndex((d) => d.id === pos.cycleDayId)
  if (i === -1) return { cycleDayId: active[0].id, cycleNumber: pos.cycleNumber }
  if (i === active.length - 1) return { cycleDayId: active[0].id, cycleNumber: pos.cycleNumber + 1 }
  return { cycleDayId: active[i + 1].id, cycleNumber: pos.cycleNumber }
}

/** "Day N of M": N is 1-based among active days. */
export function dayNumber(pos: Position, days: CycleDay[]): { n: number; of: number } {
  const active = activeDays(days)
  return { n: active.findIndex((d) => d.id === pos.cycleDayId) + 1, of: active.length }
}

export type JumpResult = 'ok' | 'same-day' | 'unknown-day' | 'already-done' | 'current-has-entries'

/** "Make <day> today?" Finished days can't be reopened (eng review E2); finish the current day first if it has entries. */
export function checkJump(
  pos: Position,
  targetId: string,
  days: CycleDay[],
  dayLogs: DayLog[],
  currentHasEntries: boolean,
): JumpResult {
  if (targetId === pos.cycleDayId) return 'same-day'
  if (!activeDays(days).some((d) => d.id === targetId)) return 'unknown-day'
  if (dayLogs.some((l) => l.cycleNumber === pos.cycleNumber && l.cycleDayId === targetId)) return 'already-done'
  if (currentHasEntries) return 'current-has-entries'
  return 'ok'
}

export type TileStatus = 'done' | 'skipped' | 'current' | 'passed' | 'upcoming'

/** Week strip: only days with a dayLog this cycle fill in; unfinished days behind the current one are "passed". */
export function tileStates(pos: Position, days: CycleDay[], dayLogs: DayLog[]): { day: CycleDay; status: TileStatus }[] {
  const active = activeDays(days)
  const currentOrder = active.find((d) => d.id === pos.cycleDayId)?.order ?? -Infinity
  return active.map((day) => {
    const log = dayLogs.find((l) => l.cycleNumber === pos.cycleNumber && l.cycleDayId === day.id)
    if (log) return { day, status: log.skipped ? 'skipped' : 'done' }
    if (day.id === pos.cycleDayId) return { day, status: 'current' }
    return { day, status: day.order < currentOrder ? 'passed' : 'upcoming' }
  })
}

// ---- Last time ----

/**
 * Sets of this exercise from the most recent finished day (any day, archived included) where it was
 * logged, in logged order. The current day never counts. Empty if there's no history.
 */
export function lastTime(exerciseId: string, sets: SetRow[], dayLogs: DayLog[], pos: Position): SetRow[] {
  const finished = new Set(dayLogs.map((l) => keyOf(l.cycleNumber, l.cycleDayId)))
  const current = keyOf(pos.cycleNumber, pos.cycleDayId)
  let bestKey: string | null = null
  let bestAt = ''
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue
    const k = keyOf(s.cycleNumber, s.cycleDayId)
    if (k === current || !finished.has(k)) continue
    if (s.loggedAt > bestAt) {
      bestAt = s.loggedAt
      bestKey = k
    }
  }
  if (bestKey === null) return []
  return sets
    .filter((s) => s.exerciseId === exerciseId && keyOf(s.cycleNumber, s.cycleDayId) === bestKey)
    .sort(byLoggedAt)
}

// ---- Exercise list for a day (plan + carry-over) ----

/**
 * Rows shown on a lifting day, in order: the planned exercises, then off-plan exercises logged on the
 * previous non-skipped occurrence of this day (carry-over), then anything logged today, then exercises
 * added to today's draft.
 */
export function exerciseOrder(args: {
  pos: Position
  plan: DayExercise[]
  sets: SetRow[]
  dayLogs: DayLog[]
  draftAdded?: string[]
}): string[] {
  const { pos, plan, sets, dayLogs, draftAdded = [] } = args
  const ids = plan
    .filter((p) => p.cycleDayId === pos.cycleDayId)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.exerciseId)
  const seen = new Set(ids)
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  const current = keyOf(pos.cycleNumber, pos.cycleDayId)
  const prev = dayLogs
    .filter((l) => l.cycleDayId === pos.cycleDayId && !l.skipped && keyOf(l.cycleNumber, l.cycleDayId) !== current)
    .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))[0]
  const sorted = [...sets].sort(byLoggedAt)
  if (prev) {
    const prevKey = keyOf(prev.cycleNumber, prev.cycleDayId)
    sorted.filter((s) => keyOf(s.cycleNumber, s.cycleDayId) === prevKey).forEach((s) => add(s.exerciseId))
  }
  sorted.filter((s) => keyOf(s.cycleNumber, s.cycleDayId) === current).forEach((s) => add(s.exerciseId))
  draftAdded.forEach(add)
  return ids
}

// ---- Ghosts ----

export interface Ghost {
  setIndex: number
  /** null = unknown weight; tapping opens the editor instead of logging. */
  weightKg: number | null
  reps: number
  logged: SetRow | null
  /** The first unlogged ghost: the one −/+ adjusts. */
  next: boolean
}

const DEFAULT_REPS = 8

/**
 * One row's ghost buttons. Count = max(plannedSets, last time's count) + extra "+ set"s, never fewer
 * than what's logged today. Values come from last time by position, else last time's final set, else
 * the seed. Extra sets copy the row's previous entry, and so does a ghost whose weight is unknown.
 * An empty result (off-plan, no history) means
 * the UI opens the editor.
 */
export function ghostsFor(args: {
  plan?: DayExercise
  last: SetRow[]
  logged: SetRow[]
  extraSets?: number
  weightOverrides?: Record<number, number>
}): Ghost[] {
  const { plan, last, extraSets = 0, weightOverrides = {} } = args
  const logged = [...args.logged].sort(byLoggedAt)
  const base = Math.max(plan?.plannedSets ?? 0, last.length)
  const count = Math.max(base + extraSets, logged.length)
  const seed = plan ? { weightKg: plan.seedWeightKg, reps: plan.seedReps } : null
  const lastSet = last.at(-1)
  const ghosts: Ghost[] = []
  let foundNext = false
  for (let i = 0; i < count; i++) {
    let value: { weightKg: number | null; reps: number }
    if (i < base) {
      value = last[i] ?? lastSet ?? seed ?? { weightKg: null, reps: DEFAULT_REPS }
    } else {
      const prev = ghosts[i - 1]
      value = prev
        ? { weightKg: prev.logged?.weightKg ?? prev.weightKg, reps: prev.logged?.reps ?? prev.reps }
        : (seed ?? { weightKg: null, reps: DEFAULT_REPS })
    }
    // Unknown weight (first session, null seed): copy the previous set in the row once it has one.
    const prevGhost = ghosts[i - 1]
    if (value.weightKg === null && prevGhost) {
      value = { ...value, weightKg: prevGhost.logged?.weightKg ?? prevGhost.weightKg }
    }
    const loggedSet = logged[i] ?? null
    const isNext = !loggedSet && !foundNext
    if (isNext) foundNext = true
    ghosts.push({
      setIndex: i,
      weightKg: loggedSet ? loggedSet.weightKg : (weightOverrides[i] ?? value.weightKg),
      reps: loggedSet ? loggedSet.reps : value.reps,
      logged: loggedSet,
      next: isNext,
    })
  }
  return ghosts
}

// ---- PRs (derived, never stored) ----

/**
 * Ids of PR sets among one exercise's sets. A set is a PR when an earlier set exists and no earlier set
 * has weight ≥ and reps ≥ it. The first-ever set is never a PR. Bodyweight (0 kg) compares reps only.
 */
export function prSetIds(exerciseSets: SetRow[]): Set<string> {
  const sorted = [...exerciseSets].sort(byLoggedAt)
  const prs = new Set<string>()
  sorted.forEach((s, i) => {
    if (i === 0) return
    const earlier = sorted.slice(0, i)
    const beaten =
      s.weightKg === 0
        ? earlier.some((e) => e.reps >= s.reps)
        : earlier.some((e) => e.weightKg >= s.weightKg && e.reps >= s.reps)
    if (!beaten) prs.add(s.id)
  })
  return prs
}

// ---- Display ----

export function formatWeight(kg: number): string {
  return kg === 0 ? 'BW' : String(Number(kg.toFixed(2)))
}

/**
 * "Last time" text (design review 14A), without the "Last time:" prefix.
 * Same weight throughout: "30 kg × 10, 10, 8". Mixed: "30×10, 30×10, 27.5×8". 0 kg is "BW".
 * More than 5 sets are truncated with "…".
 */
export function formatLastTime(sets: SetRow[]): string {
  if (sets.length === 0) return ''
  const shown = sets.slice(0, 5)
  const more = sets.length > 5 ? ', …' : ''
  const w0 = sets[0].weightKg
  if (sets.every((s) => s.weightKg === w0)) {
    const label = w0 === 0 ? 'BW' : `${formatWeight(w0)} kg`
    return `${label} × ${shown.map((s) => s.reps).join(', ')}${more}`
  }
  return shown.map((s) => `${formatWeight(s.weightKg)}×${s.reps}`).join(', ') + more
}
