import { describe, expect, it } from 'vitest'
import type { DayLog, SetRow } from './db'
import {
  activeDays,
  checkJump,
  dayNumber,
  exerciseOrder,
  formatLastTime,
  ghostsFor,
  lastTime,
  nextDay,
  prSetIds,
  tileStates,
} from './logic'
import { cycleDays, type CycleDay, type DayExercise } from './seed'

let t = 0
const at = () => new Date(Date.UTC(2026, 9, 1) + ++t * 60_000).toISOString()
const set = (p: Partial<SetRow> & { exerciseId: string; cycleNumber: number; cycleDayId: string }): SetRow => ({
  id: `s${++t}`,
  loggedAt: at(),
  setIndex: 0,
  weightKg: 50,
  reps: 8,
  ...p,
})
const log = (cycleNumber: number, cycleDayId: string, skipped = false): DayLog => ({
  id: `l${++t}`,
  cycleNumber,
  cycleDayId,
  finishedAt: at(),
  skipped,
  prevCycleDayId: cycleDayId,
  prevCycleNumber: cycleNumber,
})
const plan = (p: Partial<DayExercise> = {}): DayExercise => ({
  cycleDayId: 'upper',
  exerciseId: 'bench-press',
  order: 1,
  plannedSets: 3,
  seedWeightKg: null,
  seedReps: 8,
  ...p,
})

describe('nextDay', () => {
  it('advances by order within a cycle', () => {
    expect(nextDay({ cycleNumber: 1, cycleDayId: 'upper' }, cycleDays)).toEqual({ cycleNumber: 1, cycleDayId: 'lower' })
  })

  it('wraps after the last day and increments the cycle', () => {
    expect(nextDay({ cycleNumber: 3, cycleDayId: 'back-chest' }, cycleDays)).toEqual({ cycleNumber: 4, cycleDayId: 'upper' })
  })

  it('skips archived days', () => {
    const days: CycleDay[] = cycleDays.map((d) => (d.id === 'lower' ? { ...d, archived: true } : d))
    expect(nextDay({ cycleNumber: 1, cycleDayId: 'upper' }, days).cycleDayId).toBe('active-rest')
    expect(activeDays(days)).toHaveLength(5)
    expect(dayNumber({ cycleNumber: 1, cycleDayId: 'arms' }, days)).toEqual({ n: 4, of: 5 })
  })
})

describe('checkJump', () => {
  const pos = { cycleNumber: 2, cycleDayId: 'lower' }
  it('allows jumping to an unfinished day when the current day is empty', () => {
    expect(checkJump(pos, 'arms', cycleDays, [], false)).toBe('ok')
  })
  it('refuses a day already finished this cycle (E2)', () => {
    expect(checkJump(pos, 'upper', cycleDays, [log(2, 'upper')], false)).toBe('already-done')
  })
  it('allows a day finished in an earlier cycle', () => {
    expect(checkJump(pos, 'upper', cycleDays, [log(1, 'upper')], false)).toBe('ok')
  })
  it('blocks when the current day has entries', () => {
    expect(checkJump(pos, 'arms', cycleDays, [], true)).toBe('current-has-entries')
  })
  it('rejects unknown and same days', () => {
    expect(checkJump(pos, 'nope', cycleDays, [], false)).toBe('unknown-day')
    expect(checkJump(pos, 'lower', cycleDays, [], false)).toBe('same-day')
  })
})

describe('tileStates', () => {
  it('marks done, skipped, current, passed and upcoming', () => {
    const pos = { cycleNumber: 1, cycleDayId: 'arms' }
    const states = tileStates(pos, cycleDays, [log(1, 'upper'), log(1, 'lower', true), log(0, 'active-rest')])
    expect(states.map((s) => s.status)).toEqual(['done', 'skipped', 'passed', 'passed', 'current', 'upcoming'])
  })
})

describe('lastTime', () => {
  it('uses the latest finished day where the exercise was logged, in logged order', () => {
    const a1 = set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper', reps: 8 })
    const a2 = set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper', reps: 7 })
    const b1 = set({ exerciseId: 'bench-press', cycleNumber: 2, cycleDayId: 'upper', weightKg: 52.5, reps: 8 })
    const b2 = set({ exerciseId: 'bench-press', cycleNumber: 2, cycleDayId: 'upper', weightKg: 52.5, reps: 6 })
    const logs = [log(1, 'upper'), log(2, 'upper')]
    expect(lastTime('bench-press', [b2, a1, b1, a2], logs, { cycleNumber: 3, cycleDayId: 'upper' })).toEqual([b1, b2])
  })

  it('excludes the current unfinished day', () => {
    const old = set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper' })
    const today = set({ exerciseId: 'bench-press', cycleNumber: 2, cycleDayId: 'upper' })
    expect(lastTime('bench-press', [old, today], [log(1, 'upper')], { cycleNumber: 2, cycleDayId: 'upper' })).toEqual([old])
  })

  it('counts any day, including archived ones, and returns [] with no history', () => {
    const s = set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'old-push-day' })
    const pos = { cycleNumber: 2, cycleDayId: 'upper' }
    expect(lastTime('bench-press', [s], [log(1, 'old-push-day')], pos)).toEqual([s])
    expect(lastTime('deadlift', [s], [log(1, 'old-push-day')], pos)).toEqual([])
  })
})

describe('exerciseOrder (carry-over)', () => {
  const upperPlan = [plan({ exerciseId: 'overhead-press', order: 2 }), plan({ exerciseId: 'bench-press', order: 1 })]

  it('lists the plan in order', () => {
    expect(exerciseOrder({ pos: { cycleNumber: 1, cycleDayId: 'upper' }, plan: upperPlan, sets: [], dayLogs: [] })).toEqual([
      'bench-press',
      'overhead-press',
    ])
  })

  it('carries over off-plan exercises from the previous occurrence, then today, then draft', () => {
    const prev = [
      set({ exerciseId: 'custom-shrug', cycleNumber: 1, cycleDayId: 'upper' }),
      set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper' }),
    ]
    const today = [set({ exerciseId: 'custom-dip', cycleNumber: 2, cycleDayId: 'upper' })]
    const order = exerciseOrder({
      pos: { cycleNumber: 2, cycleDayId: 'upper' },
      plan: upperPlan,
      sets: [...today, ...prev],
      dayLogs: [log(1, 'upper')],
      draftAdded: ['custom-face-pull', 'bench-press'],
    })
    expect(order).toEqual(['bench-press', 'overhead-press', 'custom-shrug', 'custom-dip', 'custom-face-pull'])
  })

  it('ignores other days and skipped occurrences', () => {
    const otherDay = set({ exerciseId: 'custom-shrug', cycleNumber: 1, cycleDayId: 'arms' })
    const order = exerciseOrder({
      pos: { cycleNumber: 2, cycleDayId: 'upper' },
      plan: upperPlan,
      sets: [otherDay],
      dayLogs: [log(1, 'arms'), log(1, 'upper', true)],
    })
    expect(order).toEqual(['bench-press', 'overhead-press'])
  })
})

describe('ghostsFor', () => {
  const s = (weightKg: number, reps: number) =>
    set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper', weightKg, reps })

  it('shows max(planned, last count) ghosts with last-time values by position', () => {
    const g = ghostsFor({ plan: plan({ plannedSets: 3 }), last: [s(60, 8), s(60, 7), s(57.5, 8), s(55, 10)], logged: [] })
    expect(g.map((x) => [x.weightKg, x.reps])).toEqual([[60, 8], [60, 7], [57.5, 8], [55, 10]])
  })

  it('copies the last available set when last time had fewer sets than planned', () => {
    const g = ghostsFor({ plan: plan({ plannedSets: 3 }), last: [s(60, 8)], logged: [] })
    expect(g.map((x) => x.weightKg)).toEqual([60, 60, 60])
  })

  it('falls back to the seed with no history (null weight = unknown)', () => {
    const g = ghostsFor({ plan: plan({ plannedSets: 3, seedWeightKg: null, seedReps: 10 }), last: [], logged: [] })
    expect(g).toHaveLength(3)
    expect(g.every((x) => x.weightKg === null && x.reps === 10)).toBe(true)
  })

  it('fills an unknown weight from the previous set once one is logged', () => {
    const today = s(60, 8)
    const g = ghostsFor({ plan: plan({ plannedSets: 3, seedWeightKg: null }), last: [], logged: [today] })
    expect(g.map((x) => x.weightKg)).toEqual([60, 60, 60])
  })

  it('returns no ghosts for an off-plan exercise with no history (UI opens the editor)', () => {
    expect(ghostsFor({ last: [], logged: [] })).toEqual([])
  })

  it('marks logged positions and the next unlogged ghost', () => {
    const today = s(62.5, 8)
    const g = ghostsFor({ plan: plan(), last: [s(60, 8), s(60, 8), s(60, 8)], logged: [today] })
    expect(g[0].logged).toBe(today)
    expect(g[0].weightKg).toBe(62.5)
    expect(g.map((x) => x.next)).toEqual([false, true, false])
  })

  it('applies draft weight overrides only to unlogged ghosts', () => {
    const today = s(60, 8)
    const g = ghostsFor({ plan: plan(), last: [s(60, 8)], logged: [today], weightOverrides: { 0: 99, 1: 62.5 } })
    expect(g.map((x) => x.weightKg)).toEqual([60, 62.5, 60])
  })

  it('"+ set" ghosts copy the row\'s previous entry', () => {
    const g = ghostsFor({ plan: plan({ plannedSets: 2 }), last: [s(60, 8), s(55, 10)], logged: [], extraSets: 1 })
    expect(g.map((x) => [x.weightKg, x.reps])).toEqual([[60, 8], [55, 10], [55, 10]])
  })

  it('never shows fewer ghosts than sets logged today', () => {
    const logged = [s(60, 8), s(60, 8), s(60, 8), s(60, 8)]
    expect(ghostsFor({ plan: plan({ plannedSets: 3 }), last: [], logged })).toHaveLength(4)
  })
})

describe('prSetIds', () => {
  const s = (weightKg: number, reps: number) =>
    set({ exerciseId: 'bench-press', cycleNumber: 1, cycleDayId: 'upper', weightKg, reps })

  it('never marks the first-ever set', () => {
    expect(prSetIds([s(100, 10)]).size).toBe(0)
  })

  it('marks a set no earlier set dominates on both weight and reps', () => {
    const a = s(60, 8)
    const heavier = s(62.5, 6)
    const sameAgain = s(60, 8)
    const moreReps = s(60, 9)
    const weaker = s(57.5, 8)
    const prs = prSetIds([a, heavier, sameAgain, moreReps, weaker])
    expect([...prs].sort()).toEqual([heavier.id, moreReps.id].sort())
  })

  it('compares reps only for bodyweight sets', () => {
    const a = s(0, 8)
    const more = s(0, 10)
    const fewer = s(0, 9)
    expect([...prSetIds([a, more, fewer])]).toEqual([more.id])
  })
})

describe('formatLastTime (14A)', () => {
  const s = (weightKg: number, reps: number) =>
    set({ exerciseId: 'x', cycleNumber: 1, cycleDayId: 'upper', weightKg, reps })

  it('groups reps when the weight is the same', () => {
    expect(formatLastTime([s(30, 10), s(30, 10), s(30, 8)])).toBe('30 kg × 10, 10, 8')
  })
  it('lists weight×reps when weights differ', () => {
    expect(formatLastTime([s(30, 10), s(30, 10), s(27.5, 8)])).toBe('30×10, 30×10, 27.5×8')
  })
  it('shows bodyweight as BW and truncates after 5 sets', () => {
    expect(formatLastTime([s(0, 8), s(0, 8)])).toBe('BW × 8, 8')
    expect(formatLastTime([1, 2, 3, 4, 5, 6].map((r) => s(20, r)))).toBe('20 kg × 1, 2, 3, 4, 5, …')
    expect(formatLastTime([])).toBe('')
  })
})
