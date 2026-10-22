// Dexie schema, seed sync and every write the UI makes.
// The UI renders only committed rows (liveQuery); these functions throw on a rejected write and
// change nothing, so the caller shows the retry toast.

import Dexie, { type Table } from 'dexie'
import { catalogByName, catalogEntry, type CatalogEntry } from './catalog'
import {
  SEED_VERSION,
  cycleDays as seedDays,
  stepFor,
  type CycleDay,
  type DayExercise,
  type Equipment,
  type Exercise,
} from './seed'
import { activeDays, checkJump, nextDay, type JumpResult, type Position } from './logic'

export interface SetRow {
  id: string
  loggedAt: string
  cycleNumber: number
  cycleDayId: string
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
}

export interface Activity {
  id: string
  loggedAt: string
  cycleNumber: number
  cycleDayId: string
  kind: string
  minutes: number
}

export interface DayLog {
  id: string
  cycleNumber: number
  cycleDayId: string
  finishedAt: string
  /** A lifting day finished with zero sets. Rest days are never skipped: resting counts. */
  skipped: boolean
  /** State before this Finish, so Go back a day restores it exactly (including a wrap). */
  prevCycleDayId: string
  prevCycleNumber: number
}

export interface AppState {
  id: 'app'
  currentCycleDayId: string
  cycleNumber: number
  /** Seed version the plan rows match. syncSeed re-applies seed.ts when SEED_VERSION is newer. */
  seedVersion: number
  /** The first-run "Which day are you on?" prompt has been answered. */
  startPicked: boolean
  /** The welcome + exercise setup has been shown (missing on installs from before it existed). */
  welcomed?: boolean
  /** Rest timer length after a logged set; 0 = off. Missing = the default (rest.ts). */
  restSeconds?: number
  /** The user has edited the split in the app: seed.ts no longer touches the days. */
  customSplit?: boolean
  lastExportAt: string | null
  /** cycleNumber when the last export was recorded; the reminder fires 2 cycles later. */
  lastExportCycle: number | null
}

/** Unlogged tweaks for one day, so they survive iOS killing the app mid-workout (eng review E4). */
export interface Draft {
  cycleNumber: number
  cycleDayId: string
  /** exerciseId → setIndex → adjusted weight of an unlogged ghost */
  weightOverrides: Record<string, Record<number, number>>
  /** exerciseId → number of "+ set" ghosts */
  extraSets: Record<string, number>
  /** Exercises added via "Add exercise" that may have no sets yet */
  added: string[]
}

/** Full copy of the data tables, saved before an import so it can be undone. Not exported. */
export interface Snapshot {
  id: 'pre-import'
  takenAt: string
  data: BackupTables
}

/** Every exported table. Drafts and snapshots are device-only. */
export interface BackupTables {
  cycleDay: CycleDay[]
  exercise: Exercise[]
  dayExercise: DayExercise[]
  set: SetRow[]
  activity: Activity[]
  dayLog: DayLog[]
  state: AppState
}

/** Dexie schema version. Export `formatVersion` is kept equal to it (eng review #3). */
export const SCHEMA_VERSION = 1

export class LogbookDB extends Dexie {
  declare cycleDays: Table<CycleDay, string>
  declare exercises: Table<Exercise, string>
  declare dayExercises: Table<DayExercise, [string, string]>
  declare sets: Table<SetRow, string>
  declare activities: Table<Activity, string>
  declare dayLogs: Table<DayLog, string>
  declare state: Table<AppState, string>
  declare drafts: Table<Draft, [number, string]>
  declare snapshots: Table<Snapshot, string>

  constructor(name = 'gym-logbook') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      cycleDays: 'id, order',
      exercises: 'id, name',
      dayExercises: '[cycleDayId+exerciseId], cycleDayId',
      sets: 'id, [exerciseId+loggedAt], [cycleNumber+cycleDayId], cycleDayId, loggedAt',
      activities: 'id, [cycleNumber+cycleDayId], cycleDayId',
      dayLogs: 'id, &[cycleNumber+cycleDayId], cycleDayId, finishedAt',
      state: 'id',
      drafts: '[cycleNumber+cycleDayId]',
      snapshots: 'id',
    })
  }
}

export const db = new LogbookDB()

// ---- Helpers ----

let lastMs = 0
/** Strictly increasing ISO timestamps, so loggedAt/finishedAt order is the tap order even within 1 ms. */
export function nowIso(): string {
  lastMs = Math.max(Date.now(), lastMs + 1)
  return new Date(lastMs).toISOString()
}

const uuid = () => crypto.randomUUID()
const posKey = (p: Position): [number, string] => [p.cycleNumber, p.cycleDayId]

export async function getState(d: LogbookDB): Promise<AppState> {
  const st = await d.state.get('app')
  if (!st) throw new Error('Database not seeded: call openDb first')
  return st
}

export const positionOf = (st: AppState): Position => ({
  cycleNumber: st.cycleNumber,
  cycleDayId: st.currentCycleDayId,
})

function checkSet(weightKg: number, reps: number) {
  if (!Number.isFinite(weightKg) || weightKg < 0) throw new RangeError('Weight must be 0 kg or more')
  if (!Number.isInteger(reps) || reps < 1) throw new RangeError('Reps must be a whole number of 1 or more')
}

function checkActivity(kind: string, minutes: number) {
  if (kind.trim() === '') throw new RangeError('Activity needs a name')
  if (!Number.isInteger(minutes) || minutes < 1) throw new RangeError('Minutes must be 1 or more')
}

async function hasEntries(d: LogbookDB, pos: Position): Promise<boolean> {
  const k = posKey(pos)
  return (
    (await d.sets.where('[cycleNumber+cycleDayId]').equals(k).count()) > 0 ||
    (await d.activities.where('[cycleNumber+cycleDayId]').equals(k).count()) > 0
  )
}

// ---- Open + seed ----

/** Open the database and seed or upgrade the plan. Throws if IndexedDB can't open (DB error screen). */
export async function openDb(d: LogbookDB = db): Promise<LogbookDB> {
  await d.open()
  await syncSeed(d)
  return d
}

/**
 * Make the cycle days match seed.ts. Runs on first run (empty DB) and whenever SEED_VERSION is newer
 * than state.seedVersion, never on every load. Exercises and day plans are the user's own data and are
 * never written here, except the one-time v1→v2 cleanup below.
 * - Upserts seed cycleDays by id. A day dropped from the seed is archived if it has history, otherwise
 *   deleted. If the current day is no longer active, state moves to the first active day.
 * - v1→v2: v1 shipped a pre-picked exercise list. Plan rows and exercises that were never logged are
 *   removed, so every lifting day starts empty; anything with logged sets stays.
 */
export interface Seed {
  version: number
  cycleDays: CycleDay[]
}

export const SEED: Seed = { version: SEED_VERSION, cycleDays: seedDays }

/** A day with any logged set, activity or Finish: removing it archives instead of deleting. */
async function dayUsed(d: LogbookDB, cycleDayId: string): Promise<boolean> {
  return (
    (await d.sets.where('cycleDayId').equals(cycleDayId).count()) +
      (await d.activities.where('cycleDayId').equals(cycleDayId).count()) +
      (await d.dayLogs.where('cycleDayId').equals(cycleDayId).count()) >
    0
  )
}

async function setCount(d: LogbookDB, exerciseId: string): Promise<number> {
  return d.sets.where('[exerciseId+loggedAt]').between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey]).count()
}

export async function syncSeed(d: LogbookDB, seed: Seed = SEED): Promise<void> {
  await d.transaction(
    'rw',
    [d.cycleDays, d.exercises, d.dayExercises, d.sets, d.activities, d.dayLogs, d.state],
    async () => {
      const st = await d.state.get('app')
      if (st && st.seedVersion >= seed.version) return

      // A split edited in the app is the user's own: a newer seed never rewrites it.
      if (!st?.customSplit) {
        const seedDayIds = new Set(seed.cycleDays.map((x) => x.id))
        for (const day of await d.cycleDays.toArray()) {
          if (seedDayIds.has(day.id)) continue
          if (await dayUsed(d, day.id)) await d.cycleDays.put({ ...day, archived: true })
          else await d.cycleDays.delete(day.id)
        }
        await d.cycleDays.bulkPut(seed.cycleDays)
      }

      // Plan rows for days that no longer exist go away (their history stays).
      const activeIds = new Set(activeDays(await d.cycleDays.toArray()).map((x) => x.id))
      await d.dayExercises.filter((p) => !activeIds.has(p.cycleDayId)).delete()

      if (st && st.seedVersion < 2) {
        for (const p of await d.dayExercises.toArray()) {
          if ((await setCount(d, p.exerciseId)) === 0) await d.dayExercises.delete([p.cycleDayId, p.exerciseId])
        }
        const planned = new Set((await d.dayExercises.toArray()).map((p) => p.exerciseId))
        for (const ex of await d.exercises.toArray()) {
          if (ex.id.startsWith('custom-') || planned.has(ex.id)) continue
          if ((await setCount(d, ex.id)) === 0) await d.exercises.delete(ex.id)
        }
      }

      const active = activeDays(await d.cycleDays.toArray())
      if (st) {
        const stillActive = active.some((x) => x.id === st.currentCycleDayId)
        await d.state.put({
          ...st,
          seedVersion: seed.version,
          currentCycleDayId: stillActive ? st.currentCycleDayId : active[0].id,
        })
      } else {
        await d.state.put({
          id: 'app',
          currentCycleDayId: active[0].id,
          cycleNumber: 1,
          seedVersion: seed.version,
          startPicked: false,
          welcomed: false,
          lastExportAt: null,
          lastExportCycle: null,
        })
      }
    },
  )
}

// ---- Sets ----

/** Log a set on the current day. setIndex is its position among this exercise's sets today. */
export async function logSet(
  d: LogbookDB,
  input: { exerciseId: string; weightKg: number; reps: number },
): Promise<SetRow> {
  checkSet(input.weightKg, input.reps)
  return d.transaction('rw', [d.sets, d.state], async () => {
    const pos = positionOf(await getState(d))
    const setIndex = await d.sets
      .where('[cycleNumber+cycleDayId]')
      .equals(posKey(pos))
      .filter((s) => s.exerciseId === input.exerciseId)
      .count()
    const row: SetRow = { id: uuid(), loggedAt: nowIso(), ...pos, setIndex, ...input }
    await d.sets.add(row)
    return row
  })
}

export async function updateSet(d: LogbookDB, id: string, patch: { weightKg: number; reps: number }): Promise<void> {
  checkSet(patch.weightKg, patch.reps)
  const n = await d.sets.update(id, patch)
  if (n === 0) throw new Error('Set not found')
}

export async function deleteSet(d: LogbookDB, id: string): Promise<void> {
  await d.sets.delete(id)
}

/** Undo a delete: put the exact row back. */
export async function restoreSet(d: LogbookDB, row: SetRow): Promise<void> {
  await d.sets.put(row)
}

// ---- Activities (rest days) ----

export async function logActivity(d: LogbookDB, input: { kind: string; minutes: number }): Promise<Activity> {
  checkActivity(input.kind, input.minutes)
  return d.transaction('rw', [d.activities, d.state], async () => {
    const pos = positionOf(await getState(d))
    const row: Activity = { id: uuid(), loggedAt: nowIso(), ...pos, kind: input.kind.trim(), minutes: input.minutes }
    await d.activities.add(row)
    return row
  })
}

export async function updateActivity(d: LogbookDB, id: string, patch: { kind: string; minutes: number }): Promise<void> {
  checkActivity(patch.kind, patch.minutes)
  const n = await d.activities.update(id, { kind: patch.kind.trim(), minutes: patch.minutes })
  if (n === 0) throw new Error('Activity not found')
}

export async function deleteActivity(d: LogbookDB, id: string): Promise<void> {
  await d.activities.delete(id)
}

/** Undo a delete: put the exact row back. */
export async function restoreActivity(d: LogbookDB, row: Activity): Promise<void> {
  await d.activities.put(row)
}

// ---- Exercises ----

/** "Add exercise" → Create. A name matching an existing exercise (any case) picks that one instead. */
export async function createExercise(d: LogbookDB, name: string, equipment: Equipment): Promise<Exercise> {
  const trimmed = name.trim()
  if (trimmed === '') throw new RangeError('Exercise needs a name')
  return d.transaction('rw', d.exercises, async () => {
    const existing = await d.exercises.filter((e) => e.name.toLowerCase() === trimmed.toLowerCase()).first()
    if (existing) return existing
    const known = catalogByName(trimmed)
    if (known) return ensureCatalogExercise(d, known)
    const ex: Exercise = { id: `custom-${uuid()}`, name: trimmed, stepKg: stepFor(equipment), equipment }
    await d.exercises.add(ex)
    return ex
  })
}

/** The exercise row for a library entry, created on first use. */
export async function ensureCatalogExercise(d: LogbookDB, entry: CatalogEntry): Promise<Exercise> {
  return d.transaction('rw', d.exercises, async () => {
    const existing = await d.exercises.get(entry.id)
    if (existing) return existing
    const ex: Exercise = { id: entry.id, name: entry.name, stepKg: stepFor(entry.equipment), equipment: entry.equipment }
    await d.exercises.add(ex)
    return ex
  })
}

// ---- Day plans (the user's own exercises per lifting day) ----

export interface PlanValues {
  plannedSets: number
  /** null = no starting weight; the first set asks for it. */
  seedWeightKg: number | null
  seedReps: number
}

function checkPlan(v: PlanValues) {
  if (!Number.isInteger(v.plannedSets) || v.plannedSets < 1 || v.plannedSets > 20) throw new RangeError('Sets must be 1 to 20')
  if (v.seedWeightKg !== null && (!Number.isFinite(v.seedWeightKg) || v.seedWeightKg < 0))
    throw new RangeError('Weight must be 0 kg or more')
  if (!Number.isInteger(v.seedReps) || v.seedReps < 1) throw new RangeError('Reps must be a whole number of 1 or more')
}

/** The plan for one day, in order. */
export async function dayPlan(d: LogbookDB, cycleDayId: string): Promise<DayExercise[]> {
  return (await d.dayExercises.where('cycleDayId').equals(cycleDayId).toArray()).sort((a, b) => a.order - b.order)
}

/** Add an exercise to the end of a day's plan. Adding one that's already there does nothing. */
export async function addToPlan(
  d: LogbookDB,
  cycleDayId: string,
  exerciseId: string,
  values?: Partial<PlanValues>,
): Promise<DayExercise> {
  return d.transaction('rw', [d.dayExercises, d.exercises], async () => {
    const existing = await d.dayExercises.get([cycleDayId, exerciseId])
    if (existing) return existing
    if (!(await d.exercises.get(exerciseId))) throw new Error(`Unknown exercise ${exerciseId}`)
    const plan = await dayPlan(d, cycleDayId)
    const row: DayExercise = {
      cycleDayId,
      exerciseId,
      order: (plan.at(-1)?.order ?? 0) + 1,
      plannedSets: values?.plannedSets ?? 3,
      seedWeightKg: values?.seedWeightKg ?? null,
      seedReps: values?.seedReps ?? catalogEntry(exerciseId)?.reps ?? 10,
    }
    checkPlan(row)
    await d.dayExercises.add(row)
    return row
  })
}

export async function updatePlanRow(d: LogbookDB, cycleDayId: string, exerciseId: string, values: PlanValues): Promise<void> {
  checkPlan(values)
  const n = await d.dayExercises.update([cycleDayId, exerciseId], values)
  if (n === 0) throw new Error('Not in this day’s plan')
}

/** Remove from the plan. Logged history is untouched. Returns the row so it can be restored. */
export async function removeFromPlan(d: LogbookDB, cycleDayId: string, exerciseId: string): Promise<DayExercise | undefined> {
  return d.transaction('rw', d.dayExercises, async () => {
    const row = await d.dayExercises.get([cycleDayId, exerciseId])
    await d.dayExercises.delete([cycleDayId, exerciseId])
    return row
  })
}

export async function restorePlanRow(d: LogbookDB, row: DayExercise): Promise<void> {
  await d.dayExercises.put(row)
}

/** Move an exercise one place up (-1) or down (+1) in its day. */
export async function movePlanRow(d: LogbookDB, cycleDayId: string, exerciseId: string, dir: 1 | -1): Promise<void> {
  await d.transaction('rw', d.dayExercises, async () => {
    const plan = await dayPlan(d, cycleDayId)
    const i = plan.findIndex((p) => p.exerciseId === exerciseId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= plan.length) return
    const reordered = [...plan]
    ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
    await d.dayExercises.bulkPut(reordered.map((p, k) => ({ ...p, order: k + 1 })))
  })
}

/** Rest timer length in seconds; 0 turns it off. */
export async function setRestSeconds(d: LogbookDB, seconds: number): Promise<void> {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 600) throw new RangeError('Rest must be 0 to 600 seconds')
  await d.state.update('app', { restSeconds: seconds })
}

/** The welcome + setup flow is done. */
export async function finishWelcome(d: LogbookDB): Promise<void> {
  await d.state.update('app', { welcomed: true })
}

// ---- Your split (the cycle days) ----

export const MAX_DAYS = 10
export const MAX_DAY_NAME = 24

export class SplitError extends Error {}

function checkDayName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (trimmed === '') throw new SplitError('The day needs a name')
  if (trimmed.length > MAX_DAY_NAME) throw new SplitError(`Keep it to ${MAX_DAY_NAME} letters`)
  return trimmed
}

/** Any change to the split: run it, then mark the split as the user's own. */
function editSplit<T>(d: LogbookDB, change: (st: AppState, days: CycleDay[]) => Promise<T>): Promise<T> {
  return d.transaction('rw', [d.cycleDays, d.dayExercises, d.sets, d.activities, d.dayLogs, d.state], async () => {
    const st = await getState(d)
    const result = await change(st, activeDays(await d.cycleDays.toArray()))
    await d.state.update('app', { customSplit: true })
    return result
  })
}

/** Today with something logged can't change type or leave the split: finish it first. */
async function refuseIfTodayInUse(d: LogbookDB, st: AppState, cycleDayId: string, what: string) {
  if (st.currentCycleDayId === cycleDayId && (await hasEntries(d, positionOf(st)))) {
    throw new SplitError(`It’s today and you’ve logged something. Finish it before you ${what}.`)
  }
}

export async function renameDay(d: LogbookDB, cycleDayId: string, name: string): Promise<void> {
  const trimmed = checkDayName(name)
  return editSplit(d, async () => {
    if ((await d.cycleDays.update(cycleDayId, { name: trimmed })) === 0) throw new Error(`Unknown day ${cycleDayId}`)
  })
}

export async function setDayType(d: LogbookDB, cycleDayId: string, type: 'lift' | 'rest'): Promise<void> {
  return editSplit(d, async (st) => {
    const day = await d.cycleDays.get(cycleDayId)
    if (!day) throw new Error(`Unknown day ${cycleDayId}`)
    if (day.type === type) return
    await refuseIfTodayInUse(d, st, cycleDayId, type === 'rest' ? 'make it a rest day' : 'make it a lifting day')
    await d.cycleDays.update(cycleDayId, { type })
  })
}

/** Add a day at the end of the split. Ids are a slug of the name plus a short suffix, never reused. */
export async function addDay(d: LogbookDB, name: string, type: 'lift' | 'rest'): Promise<CycleDay> {
  const trimmed = checkDayName(name)
  return editSplit(d, async (_st, active) => {
    if (active.length >= MAX_DAYS) throw new SplitError(`A split can have up to ${MAX_DAYS} days`)
    const all = await d.cycleDays.toArray()
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'day'
    const day: CycleDay = {
      id: `${slug}-${uuid().slice(0, 6)}`,
      order: Math.max(0, ...all.map((x) => x.order)) + 1,
      name: trimmed,
      type,
      archived: false,
    }
    await d.cycleDays.add(day)
    return day
  })
}

/** Move a day one place earlier (-1) or later (+1) in the split. */
export async function moveDay(d: LogbookDB, cycleDayId: string, dir: 1 | -1): Promise<void> {
  return editSplit(d, async (_st, active) => {
    const i = active.findIndex((x) => x.id === cycleDayId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= active.length) return
    const a = active[i]
    const b = active[j]
    await d.cycleDays.bulkPut([
      { ...a, order: b.order },
      { ...b, order: a.order },
    ])
  })
}

/**
 * Take a day out of the split. With history it's archived (its sets stay in History); without, it's
 * deleted along with its plan. Today can't be removed: switch to another day first.
 */
export async function removeDay(d: LogbookDB, cycleDayId: string): Promise<'archived' | 'deleted'> {
  return editSplit(d, async (st, active) => {
    if (st.currentCycleDayId === cycleDayId) throw new SplitError('That’s today. Switch to another day first.')
    if (!active.some((x) => x.id === cycleDayId)) throw new Error(`Unknown day ${cycleDayId}`)
    if (active.length <= 1) throw new SplitError('A split needs at least one day')
    await d.dayExercises.where('cycleDayId').equals(cycleDayId).delete()
    if (await dayUsed(d, cycleDayId)) {
      await d.cycleDays.update(cycleDayId, { archived: true })
      return 'archived'
    }
    await d.cycleDays.delete(cycleDayId)
    return 'deleted'
  })
}

// ---- Draft ----

export function emptyDraft(pos: Position): Draft {
  return { ...pos, weightOverrides: {}, extraSets: {}, added: [] }
}

/** The current day's draft. Keyed by cycle + day, so another day's draft is never returned. */
export async function getDraft(d: LogbookDB, pos: Position): Promise<Draft> {
  return (await d.drafts.get(posKey(pos))) ?? emptyDraft(pos)
}

/** Apply a change to the current day's draft and save it. */
export async function updateDraft(d: LogbookDB, change: (draft: Draft) => void): Promise<Draft> {
  return d.transaction('rw', [d.drafts, d.state], async () => {
    const pos = positionOf(await getState(d))
    const draft = structuredClone(await getDraft(d, pos))
    change(draft)
    await d.drafts.put(draft)
    return draft
  })
}

export const setGhostWeight = (d: LogbookDB, exerciseId: string, setIndex: number, weightKg: number) => {
  checkSet(weightKg, 1)
  return updateDraft(d, (dr) => {
    dr.weightOverrides[exerciseId] = { ...dr.weightOverrides[exerciseId], [setIndex]: weightKg }
  })
}

export const addExtraSet = (d: LogbookDB, exerciseId: string) =>
  updateDraft(d, (dr) => {
    dr.extraSets[exerciseId] = (dr.extraSets[exerciseId] ?? 0) + 1
  })

export const addExerciseToDay = (d: LogbookDB, exerciseId: string) =>
  updateDraft(d, (dr) => {
    if (!dr.added.includes(exerciseId)) dr.added.push(exerciseId)
  })

// ---- Cycle ----

/**
 * Finish the current day: write its dayLog, clear its draft, advance to the next active day
 * (wrapping into cycle K+1). A lifting day with zero sets is recorded as skipped; the UI confirms first.
 */
export async function finishDay(d: LogbookDB): Promise<{ dayLog: DayLog; next: Position }> {
  return d.transaction('rw', [d.cycleDays, d.sets, d.dayLogs, d.state, d.drafts], async () => {
    const st = await getState(d)
    const pos = positionOf(st)
    const day = await d.cycleDays.get(pos.cycleDayId)
    if (!day) throw new Error(`Unknown day ${pos.cycleDayId}`)
    const setCount = await d.sets.where('[cycleNumber+cycleDayId]').equals(posKey(pos)).count()
    const dayLog: DayLog = {
      id: uuid(),
      ...pos,
      finishedAt: nowIso(),
      skipped: day.type === 'lift' && setCount === 0,
      prevCycleDayId: pos.cycleDayId,
      prevCycleNumber: pos.cycleNumber,
    }
    await d.dayLogs.add(dayLog)
    await d.drafts.delete(posKey(pos))
    const next = nextDay(pos, await d.cycleDays.toArray())
    await d.state.put({ ...st, currentCycleDayId: next.cycleDayId, cycleNumber: next.cycleNumber })
    return { dayLog, next }
  })
}

/**
 * Undo the most recent Finish: delete that dayLog and restore the state it recorded. Logged sets stay
 * on the day they were logged. Clears the draft of the day being left. Returns null if nothing to undo.
 */
export async function goBackDay(d: LogbookDB): Promise<DayLog | null> {
  return d.transaction('rw', [d.dayLogs, d.state, d.drafts], async () => {
    const latest = await d.dayLogs.orderBy('finishedAt').last()
    if (!latest) return null
    const st = await getState(d)
    await d.drafts.delete(posKey(positionOf(st)))
    await d.dayLogs.delete(latest.id)
    await d.state.put({ ...st, currentCycleDayId: latest.prevCycleDayId, cycleNumber: latest.prevCycleNumber })
    return latest
  })
}

/** "Make <day> today?" Never changes the cycle number. State is unchanged unless the result is 'ok'. */
export async function jumpTo(d: LogbookDB, targetId: string): Promise<JumpResult> {
  return d.transaction('rw', [d.cycleDays, d.sets, d.activities, d.dayLogs, d.state], async () => {
    const st = await getState(d)
    const pos = positionOf(st)
    const result = checkJump(
      pos,
      targetId,
      await d.cycleDays.toArray(),
      await d.dayLogs
        .where('[cycleNumber+cycleDayId]')
        .between([pos.cycleNumber, Dexie.minKey], [pos.cycleNumber, Dexie.maxKey])
        .toArray(),
      await hasEntries(d, pos),
    )
    if (result === 'ok') await d.state.put({ ...st, currentCycleDayId: targetId })
    return result
  })
}

/** First-run "Which day are you on?". */
export async function pickStartDay(d: LogbookDB, targetId: string): Promise<JumpResult> {
  const result = await jumpTo(d, targetId)
  if (result === 'ok' || result === 'same-day') {
    await d.state.update('app', { startPicked: true })
  }
  return result
}
