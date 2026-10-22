// Export, import, the pre-import snapshot and the backup reminder.
// Imported JSON is untrusted: it is migrated to the current formatVersion, then every row is validated
// and rebuilt from known fields only, before anything is written.

import {
  SCHEMA_VERSION,
  SEED,
  getState,
  nowIso,
  syncSeed,
  type AppState,
  type BackupTables,
  type LogbookDB,
  type Seed,
} from './db'
import { activeDays } from './logic'

export interface BackupFile extends BackupTables {
  formatVersion: number
  seedVersion: number
  exportedAt: string
}

export class ImportError extends Error {
  name = 'ImportError'
}

// ---- Export ----

async function readTables(d: LogbookDB): Promise<BackupTables> {
  return {
    cycleDay: await d.cycleDays.toArray(),
    exercise: await d.exercises.toArray(),
    dayExercise: await d.dayExercises.toArray(),
    set: await d.sets.toArray(),
    activity: await d.activities.toArray(),
    dayLog: await d.dayLogs.toArray(),
    state: await getState(d),
  }
}

export async function buildExport(d: LogbookDB): Promise<BackupFile> {
  const tables = await d.transaction('r', [d.cycleDays, d.exercises, d.dayExercises, d.sets, d.activities, d.dayLogs, d.state], () =>
    readTables(d),
  )
  return {
    formatVersion: SCHEMA_VERSION,
    seedVersion: tables.state.seedVersion,
    exportedAt: nowIso(),
    ...tables,
  }
}

export async function exportFile(d: LogbookDB): Promise<File> {
  const data = await buildExport(d)
  const name = `gym-logbook-${data.exportedAt.slice(0, 10)}.json`
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

/** Mark the backup as done now. Resets the every-2-cycles reminder. */
export async function recordExport(d: LogbookDB): Promise<void> {
  await d.transaction('rw', d.state, async () => {
    const st = await getState(d)
    await d.state.put({ ...st, lastExportAt: nowIso(), lastExportCycle: st.cycleNumber })
  })
}

type ShareNav = Pick<Navigator, 'share' | 'canShare'>

export type ExportResult =
  | { status: 'shared' }
  | { status: 'cancelled' }
  /** No file sharing (e.g. desktop): the UI shows a download link and calls recordExport when it's tapped. */
  | { status: 'download'; file: File }

/**
 * Export via the share sheet (eng review E3). Recorded only when share resolves; a cancel (AbortError)
 * records nothing. Without file sharing, hands back the file for a download link; a download has no
 * completion event, so the link tap is what counts.
 */
export async function shareExport(d: LogbookDB, nav: ShareNav = navigator): Promise<ExportResult> {
  const file = await exportFile(d)
  if (typeof nav.canShare !== 'function' || !nav.canShare({ files: [file] })) {
    return { status: 'download', file }
  }
  try {
    await nav.share({ files: [file], title: file.name })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { status: 'cancelled' }
    throw e
  }
  await recordExport(d)
  return { status: 'shared' }
}

/** Reminder banner: 2 or more full cycles finished since the last export (or since cycle 1). */
export function backupOverdue(state: Pick<AppState, 'cycleNumber' | 'lastExportCycle'>): boolean {
  return state.cycleNumber - (state.lastExportCycle ?? 1) >= 2
}

// ---- Format migrations ----

type Raw = Record<string, unknown>

/** migrations[k] turns a formatVersion k file into k+1. Add one whenever SCHEMA_VERSION goes up. */
export const MIGRATIONS: Record<number, (data: Raw) => Raw> = {}

// ---- Validation ----

type Check = (v: unknown) => boolean
const isStr: Check = (v) => typeof v === 'string'
const isId: Check = (v) => typeof v === 'string' && v.length > 0
const isInt = (min: number): Check => (v) => Number.isInteger(v) && (v as number) >= min
const isNum = (min: number): Check => (v) => typeof v === 'number' && Number.isFinite(v) && v >= min
const isBool: Check = (v) => typeof v === 'boolean'
const isIso: Check = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const orNull = (c: Check): Check => (v) => v === null || c(v)

const SHAPES = {
  cycleDay: { id: isId, order: isInt(0), name: isStr, type: (v: unknown) => v === 'lift' || v === 'rest', archived: isBool },
  exercise: { id: isId, name: isId, stepKg: (v: unknown) => isNum(0)(v) && (v as number) > 0 },
  dayExercise: {
    cycleDayId: isId,
    exerciseId: isId,
    order: isInt(0),
    plannedSets: isInt(0),
    seedWeightKg: orNull(isNum(0)),
    seedReps: isInt(1),
  },
  set: {
    id: isId,
    loggedAt: isIso,
    cycleNumber: isInt(1),
    cycleDayId: isId,
    exerciseId: isId,
    setIndex: isInt(0),
    weightKg: isNum(0),
    reps: isInt(1),
  },
  activity: { id: isId, loggedAt: isIso, cycleNumber: isInt(1), cycleDayId: isId, kind: isId, minutes: isInt(1) },
  dayLog: {
    id: isId,
    cycleNumber: isInt(1),
    cycleDayId: isId,
    finishedAt: isIso,
    skipped: isBool,
    prevCycleDayId: isId,
    prevCycleNumber: isInt(1),
  },
  state: {
    currentCycleDayId: isId,
    cycleNumber: isInt(1),
    seedVersion: isInt(0),
    startPicked: isBool,
    welcomed: (v: unknown) => v === undefined || isBool(v),
    restSeconds: (v: unknown) => v === undefined || (isInt(0)(v) && (v as number) <= 600),
    customSplit: (v: unknown) => v === undefined || isBool(v),
    lastExportAt: orNull(isIso),
    lastExportCycle: orNull(isInt(1)),
  },
} satisfies Record<string, Record<string, Check>>

/** Check a row against its shape and rebuild it from the known fields only. */
function clean(table: string, shape: Record<string, Check>, row: unknown, at: string): Raw {
  if (typeof row !== 'object' || row === null) throw new ImportError(`${table} ${at}: not an object`)
  const out: Raw = {}
  for (const [field, ok] of Object.entries(shape)) {
    const v = (row as Raw)[field]
    if (!ok(v)) throw new ImportError(`${table} ${at}: "${field}" is missing or invalid`)
    out[field] = v
  }
  return out
}

function cleanTable(data: Raw, table: Exclude<keyof typeof SHAPES, 'state'>): Raw[] {
  const rows = data[table]
  if (!Array.isArray(rows)) throw new ImportError(`Missing table "${table}"`)
  return rows.map((r, i) => clean(table, SHAPES[table], r, `#${i + 1}`))
}

function unique(table: string, keys: string[]) {
  const seen = new Set<string>()
  for (const k of keys) {
    if (seen.has(k)) throw new ImportError(`${table}: duplicate entry ${k}`)
    seen.add(k)
  }
}

/**
 * Parse, migrate and validate a backup file's text. Throws ImportError with a readable message for
 * anything that isn't a backup from this app (or a newer version of it).
 */
export function parseBackup(
  text: string,
  opts: { formatVersion?: number; seedVersion?: number; migrations?: Record<number, (data: Raw) => Raw> } = {},
): BackupFile {
  const { formatVersion = SCHEMA_VERSION, seedVersion = SEED.version, migrations = MIGRATIONS } = opts

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('This file isn’t a Gym Logbook backup (not valid JSON)')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data) || !('formatVersion' in data)) {
    throw new ImportError('This file isn’t a Gym Logbook backup')
  }
  let raw = data as Raw
  const fileVersion = raw.formatVersion
  if (!Number.isInteger(fileVersion) || (fileVersion as number) < 1) throw new ImportError('Unknown backup format version')
  if ((fileVersion as number) > formatVersion) {
    throw new ImportError('This backup was made by a newer version of the app. Update the app first.')
  }
  for (let k = fileVersion as number; k < formatVersion; k++) {
    const step = migrations[k]
    if (!step) throw new ImportError(`Can’t upgrade a format ${k} backup`)
    raw = { ...step(raw), formatVersion: k + 1 }
  }

  if (!isInt(0)(raw.seedVersion)) throw new ImportError('Backup is missing "seedVersion"')
  if ((raw.seedVersion as number) > seedVersion) {
    throw new ImportError('This backup was made with a newer training plan. Update the app first.')
  }

  const cycleDay = cleanTable(raw, 'cycleDay')
  const exercise = cleanTable(raw, 'exercise')
  const dayExercise = cleanTable(raw, 'dayExercise')
  const set = cleanTable(raw, 'set')
  const activity = cleanTable(raw, 'activity')
  const dayLog = cleanTable(raw, 'dayLog')
  const state = { id: 'app', ...clean('state', SHAPES.state, raw.state, '') }

  unique('cycleDay', cycleDay.map((r) => r.id as string))
  unique('exercise', exercise.map((r) => r.id as string))
  unique('dayExercise', dayExercise.map((r) => `${r.cycleDayId}+${r.exerciseId}`))
  unique('set', set.map((r) => r.id as string))
  unique('activity', activity.map((r) => r.id as string))
  unique('dayLog', dayLog.map((r) => r.id as string))
  unique('dayLog', dayLog.map((r) => `cycle ${r.cycleNumber} ${r.cycleDayId}`))

  const dayIds = new Set(cycleDay.map((r) => r.id))
  const exIds = new Set(exercise.map((r) => r.id))
  const refs: [string, Raw[], string, Set<unknown>][] = [
    ['dayExercise', dayExercise, 'cycleDayId', dayIds],
    ['dayExercise', dayExercise, 'exerciseId', exIds],
    ['set', set, 'cycleDayId', dayIds],
    ['set', set, 'exerciseId', exIds],
    ['activity', activity, 'cycleDayId', dayIds],
    ['dayLog', dayLog, 'cycleDayId', dayIds],
  ]
  for (const [table, rows, field, ids] of refs) {
    const bad = rows.find((r) => !ids.has(r[field]))
    if (bad) throw new ImportError(`${table}: unknown ${field} "${String(bad[field])}"`)
  }
  const tables = { cycleDay, exercise, dayExercise, set, activity, dayLog, state } as unknown as BackupTables
  if (!activeDays(tables.cycleDay).some((day) => day.id === tables.state.currentCycleDayId)) {
    throw new ImportError('state: current day is not in the cycle')
  }

  return {
    ...tables,
    formatVersion: raw.formatVersion as number,
    seedVersion: raw.seedVersion as number,
    exportedAt: isStr(raw.exportedAt) ? (raw.exportedAt as string) : '',
  }
}

// ---- Import + snapshot ----

async function replaceAll(d: LogbookDB, t: BackupTables, seed: Seed): Promise<void> {
  await d.transaction(
    'rw',
    [d.cycleDays, d.exercises, d.dayExercises, d.sets, d.activities, d.dayLogs, d.state, d.drafts],
    async () => {
      await Promise.all([
        d.cycleDays.clear(),
        d.exercises.clear(),
        d.dayExercises.clear(),
        d.sets.clear(),
        d.activities.clear(),
        d.dayLogs.clear(),
        d.state.clear(),
        d.drafts.clear(),
      ])
      await d.cycleDays.bulkPut(t.cycleDay)
      await d.exercises.bulkPut(t.exercise)
      await d.dayExercises.bulkPut(t.dayExercise)
      await d.sets.bulkPut(t.set)
      await d.activities.bulkPut(t.activity)
      await d.dayLogs.bulkPut(t.dayLog)
      await d.state.put(t.state)
        // The split always matches seed.ts: re-apply a newer seed. Exercises and plans come from the file.
      await syncSeed(d, seed)
    },
  )
}

/**
 * Replace all data with a parsed backup (the UI confirms "Replace all data?" first). Saves a snapshot
 * of the current data before touching anything; if the replace fails, nothing changes.
 * The device's own export record is kept if it's newer than the file's.
 */
export async function importBackup(d: LogbookDB, file: BackupFile, seed: Seed = SEED): Promise<{ sets: number }> {
  const current = await d.transaction(
    'r',
    [d.cycleDays, d.exercises, d.dayExercises, d.sets, d.activities, d.dayLogs, d.state],
    () => readTables(d),
  )
  await d.snapshots.put({ id: 'pre-import', takenAt: nowIso(), data: current })

  const keepDeviceExport =
    current.state.lastExportAt !== null && (file.state.lastExportAt ?? '') < current.state.lastExportAt
  const state: AppState = {
    ...file.state,
    seedVersion: file.seedVersion,
    startPicked: true,
    welcomed: true,
    ...(keepDeviceExport ? { lastExportAt: current.state.lastExportAt, lastExportCycle: file.state.cycleNumber } : {}),
  }
  await replaceAll(d, { ...file, state }, seed)
  return { sets: file.set.length }
}

export async function hasSnapshot(d: LogbookDB): Promise<boolean> {
  return (await d.snapshots.get('pre-import')) !== undefined
}

/** Settings → "Restore pre-import snapshot". The snapshot stays until the next import replaces it. */
export async function restoreSnapshot(d: LogbookDB, seed: Seed = SEED): Promise<{ sets: number }> {
  const snap = await d.snapshots.get('pre-import')
  if (!snap) throw new Error('No pre-import snapshot to restore')
  await replaceAll(d, snap.data, seed)
  return { sets: snap.data.set.length }
}
