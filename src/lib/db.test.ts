import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  LogbookDB,
  SEED,
  addExerciseToDay,
  addExtraSet,
  createExercise,
  deleteSet,
  finishDay,
  getDraft,
  getState,
  goBackDay,
  jumpTo,
  logActivity,
  logSet,
  openDb,
  pickStartDay,
  positionOf,
  setGhostWeight,
  syncSeed,
  updateSet,
  type Seed,
} from './db'

let d: LogbookDB
let n = 0

beforeEach(async () => {
  d = await openDb(new LogbookDB(`test-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

const pos = async () => positionOf(await getState(d))

describe('first run', () => {
  it('seeds an empty database and starts on Upper, cycle 1', async () => {
    expect(await d.cycleDays.count()).toBe(6)
    expect(await d.exercises.count()).toBe(20)
    expect(await d.dayExercises.count()).toBe(20)
    const st = await getState(d)
    expect(st).toMatchObject({ currentCycleDayId: 'upper', cycleNumber: 1, seedVersion: SEED.version, startPicked: false })
  })

  it('does not re-run the seed on a normal reopen', async () => {
    await d.exercises.update('bench-press', { name: 'Bench (renamed)' })
    d.close()
    await openDb(d)
    expect((await d.exercises.get('bench-press'))?.name).toBe('Bench (renamed)')
  })

  it('pickStartDay jumps and marks the prompt answered', async () => {
    expect(await pickStartDay(d, 'arms')).toBe('ok')
    expect(await getState(d)).toMatchObject({ currentCycleDayId: 'arms', startPicked: true })
  })
})

describe('seed upgrade', () => {
  const v2 = (): Seed => ({
    version: SEED.version + 1,
    // drop Lower and Arms, rename Upper
    cycleDays: SEED.cycleDays
      .filter((x) => x.id !== 'lower' && x.id !== 'arms')
      .map((x) => (x.id === 'upper' ? { ...x, name: 'Push' } : x)),
    // drop leg-press (no history) and back-squat (has history)
    exercises: SEED.exercises.filter((e) => e.id !== 'leg-press' && e.id !== 'back-squat'),
    dayExercises: SEED.dayExercises.filter((p) => p.cycleDayId !== 'lower' && p.cycleDayId !== 'arms'),
  })

  it('upserts, archives days with history, deletes unused rows, keeps custom exercises', async () => {
    await jumpTo(d, 'lower')
    await logSet(d, { exerciseId: 'back-squat', weightKg: 80, reps: 5 })
    await finishDay(d) // Lower has history; now on Active rest
    const custom = await createExercise(d, 'Shrugs', 'dumbbell')

    await syncSeed(d, v2())

    expect((await d.cycleDays.get('upper'))?.name).toBe('Push')
    expect((await d.cycleDays.get('lower'))?.archived).toBe(true)
    expect(await d.cycleDays.get('arms')).toBeUndefined()
    expect(await d.exercises.get('back-squat')).toBeDefined()
    expect(await d.exercises.get('leg-press')).toBeUndefined()
    expect(await d.exercises.get(custom.id)).toEqual(custom)
    expect(await d.dayExercises.where('cycleDayId').equals('lower').count()).toBe(0)
    expect((await getState(d)).seedVersion).toBe(SEED.version + 1)
  })

  it('moves state to the first active day if the current day was removed', async () => {
    await jumpTo(d, 'arms')
    await syncSeed(d, v2())
    expect(await pos()).toEqual({ cycleNumber: 1, cycleDayId: 'upper' })
  })

  it('does nothing when the seed version is not newer', async () => {
    await syncSeed(d, { ...v2(), version: SEED.version })
    expect(await d.cycleDays.get('arms')).toBeDefined()
  })
})

describe('sets', () => {
  it('logs sets on the current day with increasing setIndex', async () => {
    const a = await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    const b = await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 7 })
    expect(a).toMatchObject({ cycleNumber: 1, cycleDayId: 'upper', setIndex: 0 })
    expect(b.setIndex).toBe(1)
    expect(b.loggedAt > a.loggedAt).toBe(true)
  })

  it('rejects invalid values and writes nothing', async () => {
    await expect(logSet(d, { exerciseId: 'bench-press', weightKg: -1, reps: 8 })).rejects.toThrow()
    await expect(logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 0 })).rejects.toThrow()
    expect(await d.sets.count()).toBe(0)
  })

  it('edits and deletes a logged set', async () => {
    const a = await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    await updateSet(d, a.id, { weightKg: 62.5, reps: 6 })
    expect(await d.sets.get(a.id)).toMatchObject({ weightKg: 62.5, reps: 6 })
    await deleteSet(d, a.id)
    expect(await d.sets.count()).toBe(0)
  })
})

describe('exercises', () => {
  it('creates custom- exercises with the step for their equipment', async () => {
    const db1 = await createExercise(d, ' Shrugs ', 'dumbbell')
    expect(db1.id).toMatch(/^custom-/)
    expect(db1).toMatchObject({ name: 'Shrugs', stepKg: 2 })
    expect((await createExercise(d, 'Hip thrust', 'barbell')).stepKg).toBe(2.5)
  })

  it('picks the existing exercise for a duplicate name', async () => {
    expect((await createExercise(d, 'bench PRESS', 'machine')).id).toBe('bench-press')
  })
})

describe('draft (E4)', () => {
  it('persists across a reopen', async () => {
    await setGhostWeight(d, 'bench-press', 1, 62.5)
    await addExtraSet(d, 'bench-press')
    await addExerciseToDay(d, 'custom-x')
    await addExerciseToDay(d, 'custom-x')
    d.close()
    await openDb(d)
    expect(await getDraft(d, await pos())).toMatchObject({
      weightOverrides: { 'bench-press': { 1: 62.5 } },
      extraSets: { 'bench-press': 1 },
      added: ['custom-x'],
    })
  })

  it('is cleared on Finish and never shows on another day', async () => {
    await addExtraSet(d, 'bench-press')
    await finishDay(d)
    expect(await d.drafts.count()).toBe(0)
    expect((await getDraft(d, await pos())).extraSets).toEqual({})
  })
})

describe('finish, jump, go back', () => {
  it('finishes a lifting day with sets as done and advances', async () => {
    await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    const { dayLog, next } = await finishDay(d)
    expect(dayLog).toMatchObject({ cycleNumber: 1, cycleDayId: 'upper', skipped: false, prevCycleDayId: 'upper', prevCycleNumber: 1 })
    expect(next).toEqual({ cycleNumber: 1, cycleDayId: 'lower' })
    expect(await pos()).toEqual(next)
  })

  it('marks a lifting day with zero sets as skipped, but not an empty rest day', async () => {
    expect((await finishDay(d)).dayLog.skipped).toBe(true) // Upper
    await finishDay(d) // Lower
    expect((await finishDay(d)).dayLog.skipped).toBe(false) // Active rest, nothing logged
  })

  it('wraps after the last day into the next cycle', async () => {
    await jumpTo(d, 'back-chest')
    expect((await finishDay(d)).next).toEqual({ cycleNumber: 2, cycleDayId: 'upper' })
  })

  it('blocks a jump when the current day has entries, and refuses finished days (E2)', async () => {
    await finishDay(d) // Upper done, now Lower
    expect(await jumpTo(d, 'upper')).toBe('already-done')
    await logSet(d, { exerciseId: 'back-squat', weightKg: 80, reps: 5 })
    expect(await jumpTo(d, 'arms')).toBe('current-has-entries')
    expect(await pos()).toEqual({ cycleNumber: 1, cycleDayId: 'lower' })
  })

  it('blocks a jump on a rest day with an activity', async () => {
    await jumpTo(d, 'active-rest')
    await logActivity(d, { kind: 'Walk', minutes: 30 })
    expect(await jumpTo(d, 'arms')).toBe('current-has-entries')
  })

  it('goes back through finishes one at a time, undoing a wrap', async () => {
    await jumpTo(d, 'arms')
    await finishDay(d) // Arms → Back & Chest
    await logSet(d, { exerciseId: 'deadlift', weightKg: 100, reps: 5 })
    await finishDay(d) // wrap → cycle 2 Upper
    await addExtraSet(d, 'bench-press') // draft on the day being left

    expect((await goBackDay(d))?.cycleDayId).toBe('back-chest')
    expect(await pos()).toEqual({ cycleNumber: 1, cycleDayId: 'back-chest' })
    expect(await d.drafts.count()).toBe(0)
    expect(await d.sets.count()).toBe(1) // sets stay where they were logged

    expect((await goBackDay(d))?.cycleDayId).toBe('arms')
    expect(await pos()).toEqual({ cycleNumber: 1, cycleDayId: 'arms' })
    expect(await goBackDay(d)).toBeNull()
  })
})
