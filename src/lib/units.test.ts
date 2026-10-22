import { describe, expect, it } from 'vitest'
import { barAndPlates, barChoice, barToStore, fromUnit, stepIn, stepWeight, toUnit } from './units'
import { formatLastTime, formatWeight } from './logic'
import { formatVolume, weekLine } from './history'
import { formatPlates, plateLoad } from './plates'
import type { SetRow } from './db'

describe('units', () => {
  it('leaves kilos alone', () => {
    expect(toUnit(62.5, 'kg')).toBe(62.5)
    expect(fromUnit(62.5, 'kg')).toBe(62.5)
  })

  it('round-trips typed pounds exactly as displayed', () => {
    for (const lb of [0, 2.5, 45, 95, 135, 137.5, 225, 315, 405, 500]) {
      expect(toUnit(fromUnit(lb, 'lb'), 'lb')).toBe(lb)
    }
    expect(fromUnit(135, 'lb')).toBe(fromUnit(135, 'lb'))
    expect(toUnit(100, 'lb')).toBe(220.5)
  })

  it('steps in the unit you see', () => {
    expect(stepIn(2.5, 'lb')).toBe(5)
    expect(stepIn(2, 'lb')).toBe(5)
    expect(stepIn(1.25, 'lb')).toBe(2.5)
    expect(toUnit(stepWeight(fromUnit(135, 'lb'), 2.5, 1, 'lb'), 'lb')).toBe(140)
    expect(toUnit(stepWeight(fromUnit(2.5, 'lb'), 2.5, -1, 'lb'), 'lb')).toBe(0)
    expect(stepWeight(60, 2.5, 1, 'kg')).toBe(62.5)
    expect(stepWeight(1, 2.5, -1, 'kg')).toBe(0)
  })

  it('uses a 45 lb bar and lb plates in pounds', () => {
    expect(barAndPlates('lb').bar).toBe(45)
    expect(barAndPlates('kg').plates.at(-1)).toBe(1.25)
  })
})

describe('text in pounds', () => {
  const set = (lb: number, reps: number) => ({ weightKg: fromUnit(lb, 'lb'), reps }) as SetRow

  it('formats weights, last time, volume and the week line', () => {
    expect(formatWeight(fromUnit(135, 'lb'), 'lb')).toBe('135')
    expect(formatWeight(0, 'lb')).toBe('BW')
    expect(formatLastTime([set(135, 8), set(135, 6)], 'lb')).toBe('135 lb × 8, 6')
    expect(formatLastTime([set(135, 8), set(140, 6)], 'lb')).toBe('135×8, 140×6')
    expect(formatVolume(fromUnit(135, 'lb') * 10, 'lb')).toBe('1,350\u00a0lb')
    expect(weekLine({ days: 1, sets: 10, volumeKg: fromUnit(1350, 'lb'), prs: 0 }, 'lb')).toBe('1 day · 10 sets · 1,350\u00a0lb')
  })

  it('loads a 45 lb bar with lb plates', () => {
    const { bar, plates } = barAndPlates('lb')
    expect(formatPlates(plateLoad(225, bar, plates)!, 'lb')).toBe('2 × 45 a side')
    expect(formatPlates(plateLoad(140, bar, plates)!, 'lb')).toBe('45 + 2.5 a side')
    expect(formatPlates(plateLoad(137.5, bar, plates)!, 'lb')).toBe('45 a side (2.5 lb short)')
  })
})

describe('bar choice', () => {
  it('stores the standard bar as none, lighter bars in kilos, and reads them back per unit', () => {
    expect(barToStore(20, 'kg')).toBeNull()
    expect(barToStore(45, 'lb')).toBeNull()
    expect(barToStore(10, 'kg')).toBe(10)
    expect(barChoice(undefined, 'lb')).toBe(45)
    expect(barChoice(barToStore(35, 'lb')!, 'lb')).toBe(35)
    expect(barChoice(15, 'kg')).toBe(15)
    expect(barAndPlates('kg', 10).bar).toBe(10)
    expect(barAndPlates('lb', barToStore(25, 'lb')!).bar).toBe(25)
  })
})
