import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildExport, parseBackup } from './backup'
import {
  ExerciseError,
  LogbookDB,
  addToPlan,
  createExercise,
  deleteExercise,
  logSet,
  openDb,
  renameExercise,
  setBar,
} from './db'

let d: LogbookDB
let n = 0
beforeEach(async () => {
  d = await openDb(new LogbookDB(`exercise-edit-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

describe('editing an exercise', () => {
  it('renames, tidying spaces, and refuses a clash or an empty name', async () => {
    const ex = await createExercise(d, 'Meadows rwo', 'dumbbell')
    await createExercise(d, 'Bench press', 'barbell')
    await renameExercise(d, ex.id, '  Meadows   row ')
    expect((await d.exercises.get(ex.id))?.name).toBe('Meadows row')
    await renameExercise(d, ex.id, 'MEADOWS ROW') // its own name in another case is fine
    await expect(renameExercise(d, ex.id, 'bench press')).rejects.toThrow(ExerciseError)
    await expect(renameExercise(d, ex.id, ' ')).rejects.toThrow(/needs a name/)
  })

  it('sets and clears a bar, and backups carry it', async () => {
    await createExercise(d, 'Barbell curl', 'barbell')
    await setBar(d, 'barbell-curl', 10)
    expect((await d.exercises.get('barbell-curl'))?.barKg).toBe(10)
    expect(parseBackup(JSON.stringify(await buildExport(d))).exercise.find((e) => e.id === 'barbell-curl')?.barKg).toBe(10)
    await setBar(d, 'barbell-curl', null)
    expect(await d.exercises.get('barbell-curl')).not.toHaveProperty('barKg')
    await expect(setBar(d, 'barbell-curl', 0)).rejects.toThrow(RangeError)
  })

  it('deletes an unlogged exercise from every day, but never one with history', async () => {
    const ex = await createExercise(d, 'Cable crunch', 'machine')
    await addToPlan(d, 'upper', ex.id)
    await addToPlan(d, 'lower', ex.id)
    await deleteExercise(d, ex.id)
    expect(await d.exercises.get(ex.id)).toBeUndefined()
    expect(await d.dayExercises.count()).toBe(0)

    await createExercise(d, 'Bench press', 'barbell')
    await logSet(d, { exerciseId: 'bench-press', weightKg: 60, reps: 8 })
    await expect(deleteExercise(d, 'bench-press')).rejects.toThrow(/history/)
    expect(await d.exercises.get('bench-press')).toBeDefined()
  })
})
