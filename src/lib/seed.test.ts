import { describe, expect, it } from 'vitest'
import { cycleDays, dayExercises, exercises } from './seed'

describe('seed', () => {
  it('has six days starting on Upper, with two rest days', () => {
    const ordered = [...cycleDays].sort((a, b) => a.order - b.order)
    expect(ordered.map((d) => d.name)).toEqual(['Upper', 'Lower', 'Active rest', 'Recovery', 'Arms', 'Back & Chest'])
    expect(cycleDays.filter((d) => d.type === 'rest')).toHaveLength(2)
  })

  it('uses unique ids that never collide with ad-hoc custom- ids', () => {
    const ids = [...cycleDays.map((d) => d.id), ...exercises.map((e) => e.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => id.startsWith('custom-'))).toBe(false)
  })

  it('plans exercises only on lift days, each referencing a real exercise', () => {
    const lift = new Set(cycleDays.filter((d) => d.type === 'lift').map((d) => d.id))
    const exIds = new Set(exercises.map((e) => e.id))
    for (const de of dayExercises) {
      expect(lift.has(de.cycleDayId)).toBe(true)
      expect(exIds.has(de.exerciseId)).toBe(true)
    }
    const keys = dayExercises.map((de) => `${de.cycleDayId}+${de.exerciseId}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('starts with unknown weights and dumbbell steps of 2 kg', () => {
    expect(dayExercises.every((de) => de.seedWeightKg === null)).toBe(true)
    expect(exercises.find((e) => e.id === 'hammer-curl')?.stepKg).toBe(2)
    expect(exercises.find((e) => e.id === 'bench-press')?.stepKg).toBe(2.5)
  })
})
