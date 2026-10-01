import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  LogbookDB,
  addToPlan,
  dayPlan,
  ensureCatalogExercise,
  finishWelcome,
  movePlanRow,
  removeFromPlan,
  restorePlanRow,
  updatePlanRow,
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
  it('seeds only the split: empty exercise lists, starts on Upper, cycle 1, welcome not shown yet', async () => {
    expect(await d.cycleDays.count()).toBe(6)
    expect(await d.exercises.count()).toBe(0)
    expect(await d.dayExercises.count()).toBe(0)
    const st = await getState(d)
    expect(st).toMatchObject({
      currentCycleDayId: 'upper',
      cycleNumber: 1,
      seedVersion: SEED.version,
      startPicked: false,
      welcomed: false,
    })
  })

  it('never touches your exercises on a reopen', async () => {
    const ex = await createExercise(d, 'Zercher squat', 'barbell')
    await addToPlan(d, 'lower', ex.id)
    d.close()
    await openDb(d)
    expect(await dayPlan(d, 'lower')).toHaveLength(1)
  })

  it('pickStartDay jumps and marks the prompt answered; finishWelcome marks the welcome done', async () => {
    expect(await pickStartDay(d, 'arms')).toBe('ok')
    await finishWelcome(d)
    expect(await getState(d)).toMatchObject({ currentCycleDayId: 'arms', startPicked: true, welcomed: true })
  })
})

describe('seed upgrade', () => {
  const next = (): Seed => ({
    version: SEED.version + 1,
    // drop Lower and Arms, rename Upper
    cycleDays: SEED.cycleDays
      .filter((x) => x.id !== 'lower' && x.id !== 'arms')
      .map((x) => (x.id === 'upper' ? { ...x, name: 'Push' } : x)),
  })

  it('upserts days, archives days with history, deletes unused ones, keeps your exercises', async () => {
    await addToPlan(d, 'upper', (await createExercise(d, 'Bench press', 'barbell')).id)
    await jumpTo(d, 'lower')
    await logSet(d, { exerciseId: 'back-squat', weightKg: 80, reps: 5 })
    await finishDay(d) // Lower has history; now on Active rest
    const custom = await createExercise(d, 'Zercher squat', 'barbell')

    await syncSeed(d, next())

    expect((await d.cycleDays.get('upper'))?.name).toBe('Push')
    expect((await d.cycleDays.get('lower'))?.archived).toBe(true)
    expect(await d.cycleDays.get('arms')).toBeUndefined()
    expect(await d.exercises.get(custom.id)).toEqual(custom)
    expect(await dayPlan(d, 'upper')).toHaveLength(1)
    expect((await getState(d)).seedVersion).toBe(SEED.version + 1)
  })

  it('moves state to the first active day if the current day was removed', async () => {
    await jumpTo(d, 'arms')
    await syncSeed(d, next())
    expect(await pos()).toEqual({ cycleNumber: 1, cycleDayId: 'upper' })
  })

  it('does nothing when the seed version is not newer', async () => {
    await syncSeed(d, { ...next(), version: SEED.version })
    expect(await d.cycleDays.get('arms')).toBeDefined()
  })

  it('v1 → v2: removes the never-logged default exercises, keeps anything with history', async () => {
    // an install from v1: the old pre-picked plan, one of which was logged
    for (const [id, name, day] of [
      ['bench-press', 'Bench press', 'upper'],
      ['bent-over-row', 'Bent-over row', 'upper'],
      ['hammer-curl', 'Hammer curl', 'arms'],
    ]) {
      await d.exercises.put({ id, name, stepKg: 2.5 })
      await d.dayExercises.put({ cycleDayId: day, exerciseId: id, order: 1, plannedSets: 3, seedWeightKg: null, seedReps: 8 })
    }
    await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    await d.state.update('app', { seedVersion: 1 })

    await syncSeed(d)

    expect((await d.dayExercises.toArray()).map((p) => p.exerciseId)).toEqual(['bench-press'])
    expect((await d.exercises.toArray()).map((e) => e.id)).toEqual(['bench-press'])
    expect((await getState(d)).seedVersion).toBe(SEED.version)
  })
})

describe('your exercises (day plans)', () => {
  it('adds library and typed-in exercises to the end of a day, with library default reps', async () => {
    const bench = await createExercise(d, 'bench press', 'machine') // matches the library entry
    expect(bench).toMatchObject({ id: 'bench-press', name: 'Bench press', stepKg: 2.5 })
    const own = await createExercise(d, 'Zercher squat', 'barbell')
    expect(own.id).toMatch(/^custom-/)

    await addToPlan(d, 'upper', bench.id)
    await addToPlan(d, 'upper', own.id, { plannedSets: 4, seedWeightKg: 60, seedReps: 6 })
    await addToPlan(d, 'upper', bench.id) // already there: no duplicate

    const plan = await dayPlan(d, 'upper')
    expect(plan.map((p) => [p.exerciseId, p.order, p.plannedSets, p.seedWeightKg, p.seedReps])).toEqual([
      ['bench-press', 1, 3, null, 8],
      [own.id, 2, 4, 60, 6],
    ])
  })

  it('library exercises reuse one row across days', async () => {
    const entry = (await import('./catalog')).catalogEntry('deadlift')!
    const a = await ensureCatalogExercise(d, entry)
    const b = await ensureCatalogExercise(d, entry)
    expect(a).toEqual(b)
    expect(await d.exercises.count()).toBe(1)
  })

  it('edits sets, weight and reps, and rejects bad values', async () => {
    await createExercise(d, 'Deadlift', 'barbell')
    await addToPlan(d, 'back-chest', 'deadlift')
    await updatePlanRow(d, 'back-chest', 'deadlift', { plannedSets: 5, seedWeightKg: 140, seedReps: 3 })
    expect(await d.dayExercises.get(['back-chest', 'deadlift'])).toMatchObject({ plannedSets: 5, seedWeightKg: 140, seedReps: 3 })
    await expect(updatePlanRow(d, 'back-chest', 'deadlift', { plannedSets: 0, seedWeightKg: null, seedReps: 3 })).rejects.toThrow()
    await expect(updatePlanRow(d, 'back-chest', 'deadlift', { plannedSets: 3, seedWeightKg: -5, seedReps: 3 })).rejects.toThrow()
  })

  it('removes (history stays), restores and reorders', async () => {
    for (const n of ['Bench press', 'Deadlift', 'Pull-up']) await addToPlan(d, 'back-chest', (await createExercise(d, n, 'barbell')).id)
    await logSet(d, { exerciseId: 'deadlift', weightKg: 100, reps: 5 })

    const removed = await removeFromPlan(d, 'back-chest', 'deadlift')
    expect((await dayPlan(d, 'back-chest')).map((p) => p.exerciseId)).toEqual(['bench-press', 'pull-up'])
    expect(await d.sets.count()).toBe(1)
    await restorePlanRow(d, removed!)
    expect((await dayPlan(d, 'back-chest')).map((p) => p.exerciseId)).toEqual(['bench-press', 'deadlift', 'pull-up'])

    await movePlanRow(d, 'back-chest', 'pull-up', -1)
    await movePlanRow(d, 'back-chest', 'bench-press', -1) // already first: no-op
    expect((await dayPlan(d, 'back-chest')).map((p) => p.exerciseId)).toEqual(['bench-press', 'pull-up', 'deadlift'])
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
