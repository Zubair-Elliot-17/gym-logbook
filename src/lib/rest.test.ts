import { describe, expect, it } from 'vitest'
import { DEFAULT_REST_SECONDS, adjustEnd, formatClock, restLabel, restSecondsOf, secondsLeft } from './rest'

describe('rest timer rules', () => {
  it('defaults when the setting is missing, and 0 means off', () => {
    expect(restSecondsOf({})).toBe(DEFAULT_REST_SECONDS)
    expect(restSecondsOf({ restSeconds: 0 })).toBe(0)
    expect(restSecondsOf({ restSeconds: 180 })).toBe(180)
  })

  it('counts whole seconds up, never below zero', () => {
    expect(secondsLeft(10_000, 0)).toBe(10)
    expect(secondsLeft(10_000, 9_001)).toBe(1)
    expect(secondsLeft(10_000, 10_000)).toBe(0)
    expect(secondsLeft(10_000, 12_000)).toBe(0)
  })

  it('formats a clock and the Settings label', () => {
    expect(formatClock(83)).toBe('1:23')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(240)).toBe('4:00')
    expect(restLabel(0)).toBe('Off')
    expect(restLabel(90)).toBe('1:30')
  })

  it('adjusts the end but never into the past', () => {
    expect(adjustEnd(60_000, 0, 15)).toBe(75_000)
    expect(adjustEnd(60_000, 0, -15)).toBe(45_000)
    expect(adjustEnd(10_000, 5_000, -15)).toBe(5_000)
  })
})
