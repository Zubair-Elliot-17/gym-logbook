import { describe, expect, it } from 'vitest'
import { CATALOG, MUSCLES, catalogByName, musclesFor } from './catalog'
import { cycleDays } from './seed'

describe('seed', () => {
  it('has six days starting on Upper, with two rest days', () => {
    const ordered = [...cycleDays].sort((a, b) => a.order - b.order)
    expect(ordered.map((d) => d.name)).toEqual(['Upper', 'Lower', 'Active rest', 'Recovery', 'Arms', 'Back & Chest'])
    expect(cycleDays.filter((d) => d.type === 'rest')).toHaveLength(2)
    expect(new Set(cycleDays.map((d) => d.id)).size).toBe(6)
  })
})

describe('exercise library', () => {
  it('uses unique ids that never collide with typed-in custom- ids', () => {
    const ids = CATALOG.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => id.startsWith('custom-'))).toBe(false)
    expect(new Set(CATALOG.map((c) => c.name.toLowerCase())).size).toBe(CATALOG.length)
  })

  it('keeps the v1 ids so logged history still lines up', () => {
    for (const id of ['bench-press', 'back-squat', 'deadlift', 'hammer-curl', 'pull-up', 'lateral-raise']) {
      expect(CATALOG.some((c) => c.id === id)).toBe(true)
    }
  })

  it('has exercises for every muscle group, opening on the day’s muscles first', () => {
    for (const m of MUSCLES) expect(CATALOG.some((c) => c.muscle === m)).toBe(true)
    expect(musclesFor('back-chest').slice(0, 2)).toEqual(['Back', 'Chest'])
    expect(musclesFor('arms').slice(0, 2)).toEqual(['Biceps', 'Triceps'])
    expect(musclesFor('upper')).toHaveLength(MUSCLES.length)
  })

  it('finds entries by name, ignoring case and spaces', () => {
    expect(catalogByName('  bench PRESS ')?.id).toBe('bench-press')
    expect(catalogByName('Zercher squat')).toBeUndefined()
  })
})
