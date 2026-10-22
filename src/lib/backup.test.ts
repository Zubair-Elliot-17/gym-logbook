import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ImportError,
  backupOverdue,
  buildExport,
  exportFile,
  hasSnapshot,
  importBackup,
  parseBackup,
  recordExport,
  restoreSnapshot,
  shareExport,
} from './backup'
import {
  LogbookDB,
  SEED,
  addToPlan,
  createExercise,
  finishDay,
  getState,
  jumpTo,
  logActivity,
  logSet,
  openDb,
  setRestSeconds,
  updatePlanRow,
} from './db'

let d: LogbookDB
let n = 0
beforeEach(async () => {
  d = await openDb(new LogbookDB(`backup-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

/** A small history: Upper with two bench sets and a custom exercise, Lower skipped, a walk on Active rest. */
async function someHistory() {
  await addToPlan(d, 'upper', (await createExercise(d, 'Bench press', 'barbell')).id)
  await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
  await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 7 })
  const shrug = await createExercise(d, 'Shrugs', 'dumbbell')
  await addToPlan(d, 'upper', shrug.id)
  await logSet(d, { exerciseId: shrug.id, weightKg: 30, reps: 12 })
  await finishDay(d)
  await finishDay(d)
  await logActivity(d, { kind: 'Walk', minutes: 30 })
  return shrug
}

const roundTrip = async () => parseBackup(JSON.stringify(await buildExport(d)))

describe('export', () => {
  it('writes every table plus formatVersion and seedVersion, without drafts', async () => {
    await someHistory()
    const data = await buildExport(d)
    expect(data).toMatchObject({ formatVersion: 1, seedVersion: SEED.version })
    expect(data.set).toHaveLength(3)
    expect(data.activity).toHaveLength(1)
    expect(data.dayLog).toHaveLength(2)
    expect(data.state.currentCycleDayId).toBe('active-rest')
    expect(Object.keys(data)).not.toContain('draft')
  })

  it('names the file by date', async () => {
    const f = await exportFile(d)
    expect(f.name).toMatch(/^gym-logbook-\d{4}-\d{2}-\d{2}\.json$/)
    expect(JSON.parse(await f.text()).formatVersion).toBe(1)
  })
})

describe('shareExport (E3)', () => {
  it('records the export when share resolves', async () => {
    const nav = { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) }
    expect(await shareExport(d, nav)).toEqual({ status: 'shared' })
    expect(nav.share).toHaveBeenCalledOnce()
    expect((await getState(d)).lastExportAt).not.toBeNull()
  })

  it('records nothing on cancel (AbortError)', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const nav = { canShare: () => true, share: vi.fn().mockRejectedValue(abort) }
    expect(await shareExport(d, nav)).toEqual({ status: 'cancelled' })
    expect((await getState(d)).lastExportAt).toBeNull()
  })

  it('rethrows other share errors without recording', async () => {
    const nav = { canShare: () => true, share: vi.fn().mockRejectedValue(new Error('boom')) }
    await expect(shareExport(d, nav)).rejects.toThrow('boom')
    expect((await getState(d)).lastExportAt).toBeNull()
  })

  it('falls back to a download file; the link tap records it', async () => {
    const result = await shareExport(d, { canShare: () => false, share: vi.fn() })
    expect(result.status).toBe('download')
    expect((await getState(d)).lastExportAt).toBeNull()
    await recordExport(d) // what the UI calls on the link tap
    expect((await getState(d)).lastExportAt).not.toBeNull()
  })
})

describe('backupOverdue', () => {
  it('fires after 2 finished cycles since the last export (or since cycle 1)', () => {
    expect(backupOverdue({ cycleNumber: 1, lastExportCycle: null })).toBe(false)
    expect(backupOverdue({ cycleNumber: 2, lastExportCycle: null })).toBe(false)
    expect(backupOverdue({ cycleNumber: 3, lastExportCycle: null })).toBe(true)
    expect(backupOverdue({ cycleNumber: 4, lastExportCycle: 3 })).toBe(false)
    expect(backupOverdue({ cycleNumber: 5, lastExportCycle: 3 })).toBe(true)
  })

  it('resets when an export is recorded', async () => {
    await jumpTo(d, 'back-chest')
    await finishDay(d)
    await jumpTo(d, 'back-chest')
    await finishDay(d) // now cycle 3
    expect(backupOverdue(await getState(d))).toBe(true)
    await recordExport(d)
    expect(backupOverdue(await getState(d))).toBe(false)
  })
})

describe('import', () => {
  it('round-trips: export → wipe → import restores everything', async () => {
    const shrug = await someHistory()
    const file = await roundTrip()
    const before = await buildExport(d)

    const other = await openDb(new LogbookDB(`backup-other-${n}`))
    expect(await importBackup(other, file)).toEqual({ sets: 3 })
    const after = await buildExport(other)
    for (const t of ['cycleDay', 'exercise', 'dayExercise', 'set', 'activity', 'dayLog'] as const) {
      const rows: object[] = before[t]
      expect(after[t]).toHaveLength(rows.length)
      expect(after[t]).toEqual(expect.arrayContaining(rows))
    }
    expect(after.state).toMatchObject({ currentCycleDayId: 'active-rest', cycleNumber: 1, startPicked: true })
    expect(await other.exercises.get(shrug.id)).toBeDefined()
    await other.delete()
  })

  it('carries the rest timer setting; older files without it still import', async () => {
    await setRestSeconds(d, 120)
    expect((await roundTrip()).state.restSeconds).toBe(120)
    await expect(setRestSeconds(d, -5)).rejects.toThrow(RangeError)

    const old = await buildExport(d)
    delete (old.state as { restSeconds?: number }).restSeconds
    const file = parseBackup(JSON.stringify(old))
    await importBackup(d, file)
    expect((await getState(d)).restSeconds).toBeUndefined()

    const bad = { ...old, state: { ...old.state, restSeconds: 'long' } }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/restSeconds/)
  })

  it('restores your exercises and day plans from the file; only the split comes from seed.ts', async () => {
    const shrug = await someHistory()
    await updatePlanRow(d, 'upper', 'bench-press', { plannedSets: 5, seedWeightKg: 62.5, seedReps: 5 })
    const file = await roundTrip()

    const other = await openDb(new LogbookDB(`backup-plan-${n}`))
    await importBackup(other, {
      ...file,
      cycleDay: file.cycleDay.map((c) => (c.id === 'upper' ? { ...c, name: 'Old name' } : c)),
      seedVersion: SEED.version - 1,
      state: { ...file.state, seedVersion: SEED.version - 1 },
    })
    expect((await other.cycleDays.get('upper'))?.name).toBe('Upper')
    expect(await other.dayExercises.get(['upper', 'bench-press'])).toMatchObject({ plannedSets: 5, seedWeightKg: 62.5, seedReps: 5 })
    expect(await other.dayExercises.get(['upper', shrug.id])).toBeDefined()
    expect(await other.sets.count()).toBe(3)
    expect(await other.activities.count()).toBe(1)
    expect((await getState(other)).seedVersion).toBe(SEED.version)
    await other.delete()
  })

  it('clears drafts and saves a snapshot that can be restored', async () => {
    await logSet(d, { exerciseId: 'bench-press', weightKg: 70, reps: 5 })
    const empty = parseBackup(JSON.stringify(await buildExport(await openDb(new LogbookDB(`backup-empty-${n}`)))))
    expect(await hasSnapshot(d)).toBe(false)

    await importBackup(d, empty)
    expect(await d.sets.count()).toBe(0)
    expect(await hasSnapshot(d)).toBe(true)

    expect(await restoreSnapshot(d)).toEqual({ sets: 1 })
    expect((await d.sets.toArray())[0]).toMatchObject({ weightKg: 70, reps: 5 })
    expect(await hasSnapshot(d)).toBe(true) // offered until the next import
  })

  it('keeps the device export record if it is newer than the file', async () => {
    const file = await roundTrip() // lastExportAt null in file
    await recordExport(d)
    const recorded = (await getState(d)).lastExportAt
    await importBackup(d, file)
    expect((await getState(d)).lastExportAt).toBe(recorded)
  })
})

describe('parseBackup', () => {
  const valid = async () => JSON.parse(JSON.stringify(await buildExport(d)))
  const rejects = (text: string, msg: RegExp) => {
    expect(() => parseBackup(text)).toThrow(ImportError)
    expect(() => parseBackup(text)).toThrow(msg)
  }

  it('rejects non-JSON and foreign files', () => {
    rejects('not json', /not valid JSON/)
    rejects('[]', /isn’t a Gym Logbook backup/)
    rejects('{"hello":1}', /isn’t a Gym Logbook backup/)
  })

  it('rejects newer format and seed versions', async () => {
    rejects(JSON.stringify({ ...(await valid()), formatVersion: 99 }), /newer version of the app/)
    rejects(JSON.stringify({ ...(await valid()), seedVersion: 99 }), /newer training plan/)
  })

  it('rejects missing tables, bad fields, duplicates and broken references', async () => {
    await someHistory()
    const v = await valid()
    rejects(JSON.stringify({ ...v, set: undefined }), /Missing table "set"/)
    rejects(JSON.stringify({ ...v, set: [{ ...v.set[0], reps: 0 }] }), /set #1: "reps"/)
    rejects(JSON.stringify({ ...v, set: [{ ...v.set[0], weightKg: '60' }] }), /"weightKg"/)
    rejects(JSON.stringify({ ...v, set: [v.set[0], v.set[0]] }), /duplicate/)
    rejects(JSON.stringify({ ...v, set: [{ ...v.set[0], exerciseId: 'ghost' }] }), /unknown exerciseId "ghost"/)
    rejects(JSON.stringify({ ...v, state: { ...v.state, currentCycleDayId: 'nope' } }), /current day/)
    rejects(JSON.stringify({ ...v, dayLog: [v.dayLog[0], { ...v.dayLog[0], id: 'other' }] }), /duplicate entry cycle 1/)
  })

  it('drops unknown fields', async () => {
    const v = await valid()
    v.cycleDay[0].evil = '<script>'
    expect(parseBackup(JSON.stringify(v)).cycleDay[0]).not.toHaveProperty('evil')
  })

  it('runs JSON migrations from an older formatVersion before validating', async () => {
    // a hypothetical format 1 file that stored activities under "rest" instead of "activity"
    const { activity, ...rest } = await valid()
    const oldFile = JSON.stringify({ ...rest, rest: activity, formatVersion: 1 })
    const migrations = { 1: ({ rest: acts, ...raw }: Record<string, unknown>) => ({ ...raw, activity: acts }) }
    const parsed = parseBackup(oldFile, { formatVersion: 2, migrations })
    expect(parsed.formatVersion).toBe(2)
    expect(parsed.activity).toEqual(activity)
    expect(() => parseBackup(oldFile, { formatVersion: 2, migrations: {} })).toThrow(/Can’t upgrade/)
  })

  it('leaves data untouched when a file is rejected', async () => {
    await someHistory()
    expect(() => parseBackup('{"formatVersion":1}')).toThrow()
    expect(await d.sets.count()).toBe(3)
  })
})
