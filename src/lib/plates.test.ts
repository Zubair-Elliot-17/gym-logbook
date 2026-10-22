import { describe, expect, it } from 'vitest'
import { formatPlates, plateLoad } from './plates'

describe('plate maths', () => {
  it('loads each side heaviest first', () => {
    expect(plateLoad(60)).toEqual({ perSide: [20], shortKg: 0 })
    expect(plateLoad(82.5)).toEqual({ perSide: [25, 5, 1.25], shortKg: 0 })
    expect(plateLoad(140)).toEqual({ perSide: [25, 25, 10], shortKg: 0 })
  })

  it('has nothing to load at or under the bar', () => {
    expect(plateLoad(20)).toBeNull()
    expect(plateLoad(15)).toBeNull()
    expect(plateLoad(Number.NaN)).toBeNull()
  })

  it('says how far off it is when plates can’t make the weight', () => {
    expect(plateLoad(61)).toEqual({ perSide: [20], shortKg: 1 })
    expect(formatPlates(plateLoad(61)!)).toBe('20 a side (1 kg short)')
  })

  it('groups repeats', () => {
    expect(formatPlates(plateLoad(140)!)).toBe('2 × 25 + 10 a side')
    expect(formatPlates(plateLoad(82.5)!)).toBe('25 + 5 + 1.25 a side')
  })

  it('takes another bar and plate set', () => {
    expect(plateLoad(30, 10, [10, 5])).toEqual({ perSide: [10], shortKg: 0 })
  })
})
