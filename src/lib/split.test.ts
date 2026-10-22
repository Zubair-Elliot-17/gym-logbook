import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildExport, importBackup, parseBackup } from './backup'
import {
  LogbookDB,
  SEED,
  SplitError,
  addDay,
  createExercise,
  addToPlan,
  finishDay,
  getState,
  jumpTo,
  logSet,
  moveDay,
  openDb,
  removeDay,
  renameDay,
  setDayType,
  syncSeed,
} from './db'
import { activeDays, nextDay } from './logic'

let d: LogbookDB
let n = 0
beforeEach(async () => {
  d = await openDb(new LogbookDB(`split-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

const names = async () => activeDays(await d.cycleDays.toArray()).map((x) => `${x.name}:${x.type}`)

describe('editing the split', () => {
  it('renames, retypes, adds and reorders days, and marks the split as your own', async () => {
    expect((await getState(d)).customSplit).toBeUndefined()
    await renameDay(d, 'arms', '  Arms   & abs ')
    await setDayType(d, 'recovery', 'lift')
    const legs = await addDay(d, 'Legs 2', 'lift')
    expect(legs.id).toMatch(/^legs-2-[0-9a-f]{6}$/)
    await moveDay(d, legs.id, -1)
    await moveDay(d, 'upper', -1) // already first: nothing happens
    expect(await names()).toEqual([
      'Upper:lift',
      'Lower:lift',
      'Active rest:rest',
      'Recovery:lift',
      'Arms & abs:lift',
      'Legs 2:lift',
      'Back & Chest:lift',
    ])
    expect((await getState(d)).customSplit).toBe(true)
    // the cycle follows the new order
    expect(nextDay({ cycleNumber: 1, cycleDayId: 'arms' }, await d.cycleDays.toArray()).cycleDayId).toBe(legs.id)
  })

  it('rejects empty and long names and an 11th day', async () => {
    await expect(renameDay(d, 'upper', '   ')).rejects.toThrow(SplitError)
    await expect(addDay(d, 'x'.repeat(25), 'lift')).rejects.toThrow(/24 letters/)
    for (let i = 0; i < 4; i++) await addDay(d, `Extra ${i}`, 'rest')
    await expect(addDay(d, 'One too many', 'lift')).rejects.toThrow(/up to 10 days/)
  })

  it('deletes an unused day with its plan, archives one with history, never removes today', async () => {
    await addToPlan(d, 'arms', (await createExercise(d, 'Hammer curl', 'dumbbell')).id)
    expect(await removeDay(d, 'arms')).toBe('deleted')
    expect(await d.cycleDays.get('arms')).toBeUndefined()
    expect(await d.dayExercises.where('cycleDayId').equals('arms').count()).toBe(0)

    await createExercise(d, 'Bench press', 'barbell')
    await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    await finishDay(d) // Upper has history; now on Lower
    expect(await removeDay(d, 'upper')).toBe('archived')
    expect(await d.cycleDays.get('upper')).toMatchObject({ archived: true })
    expect(await d.sets.count()).toBe(1)

    await expect(removeDay(d, 'lower')).rejects.toThrow(/today/)
  })

  it('refuses to change today’s type once something is logged on it', async () => {
    await setDayType(d, 'upper', 'rest') // nothing logged yet: fine
    await setDayType(d, 'upper', 'lift')
    await createExercise(d, 'Bench press', 'barbell')
    await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    await expect(setDayType(d, 'upper', 'rest')).rejects.toThrow(/Finish it/)
    await jumpTo(d, 'upper') // same day: no-op
    expect((await d.cycleDays.get('upper'))?.type).toBe('lift')
  })

  it('keeps at least one day', async () => {
    for (const id of ['lower', 'active-rest', 'recovery', 'arms', 'back-chest']) await removeDay(d, id)
    await expect(removeDay(d, 'upper')).rejects.toThrow(/today/)
    expect(await names()).toEqual(['Upper:lift'])
  })
})

describe('seed sync and backups', () => {
  it('a newer seed.ts never rewrites a split you edited', async () => {
    await renameDay(d, 'upper', 'Push')
    const newer = { version: SEED.version + 1, cycleDays: SEED.cycleDays.map((x) => ({ ...x, name: x.name + '!' })) }
    await syncSeed(d, newer)
    expect((await d.cycleDays.get('upper'))?.name).toBe('Push')
    expect((await d.cycleDays.get('lower'))?.name).toBe('Lower')
    expect((await getState(d)).seedVersion).toBe(SEED.version + 1)
  })

  it('an untouched split still follows seed.ts', async () => {
    const newer = { version: SEED.version + 1, cycleDays: SEED.cycleDays.map((x) => ({ ...x, name: x.name + '!' })) }
    await syncSeed(d, newer)
    expect((await d.cycleDays.get('upper'))?.name).toBe('Upper!')
  })

  it('backs up and restores a custom split', async () => {
    const day = await addDay(d, 'Conditioning', 'rest')
    const file = parseBackup(JSON.stringify(await buildExport(d)))
    expect(file.state.customSplit).toBe(true)
    const other = await openDb(new LogbookDB(`split-other-${n}`))
    await importBackup(other, file)
    expect((await other.cycleDays.get(day.id))?.name).toBe('Conditioning')
    expect((await getState(other)).customSplit).toBe(true)
    await other.delete()
  })
})
