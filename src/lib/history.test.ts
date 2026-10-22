import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LogbookDB, createExercise, finishDay, jumpTo, logActivity, logSet, openDb } from './db'
import {
  byMonth,
  chartPoints,
  e1rm,
  exerciseIndex,
  exerciseSessions,
  exerciseStats,
  formatDate,
  formatKg,
  loadHistory,
  sessionSummary,
  sessions,
  topSet,
  weekLine,
  weekStart,
  weekSummary,
} from './history'

let d: LogbookDB
let n = 0
beforeEach(async () => {
  d = await openDb(new LogbookDB(`history-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

const lift = async (exerciseId: string, weightKg: number, reps: number) => logSet(d, { exerciseId, weightKg, reps })

describe('sessions', () => {
  it('has nothing before the first Finish, and never lists the unfinished day', async () => {
    await createExercise(d, 'Bench press', 'barbell')
    await lift('bench-press', 60, 8)
    expect(sessions(await loadHistory(d))).toEqual([])
  })

  it('lists finished days newest first with their sets grouped by exercise', async () => {
    await createExercise(d, 'Bench press', 'barbell')
    const squat = (await createExercise(d, 'Back squat', 'barbell')).id
    await lift('bench-press', 60, 8)
    await lift('bench-press', 62.5, 8)
    await finishDay(d) // Upper
    await lift(squat, 100, 5)
    await lift('bench-press', 50, 10) // off-plan, still grouped
    await lift(squat, 100, 5)
    await finishDay(d) // Lower

    const list = sessions(await loadHistory(d))
    expect(list.map((s) => s.dayName)).toEqual(['Lower', 'Upper'])
    const [lower, upper] = list
    expect(lower.exercises.map((e) => [e.exercise.name, e.sets.map((s) => s.weightKg)])).toEqual([
      ['Back squat', [100, 100]],
      ['Bench press', [50]],
    ])
    expect(lower).toMatchObject({ setCount: 3, volumeKg: 1500, type: 'lift', skipped: false })
    expect(upper.prIds.size).toBe(1)
    expect(sessionSummary(upper)).toBe('2 sets · 1 PR · 980\u00a0kg')
    // Bench 50 × 10 beats nothing earlier on reps-and-weight, so it's a PR too
    expect(sessionSummary(lower)).toBe('3 sets · 1 PR · 1,500\u00a0kg')
  })

  it('summarises skipped and rest days', async () => {
    await finishDay(d) // Upper, nothing logged
    await jumpTo(d, 'active-rest')
    await logActivity(d, { kind: 'Walk', minutes: 30 })
    await logActivity(d, { kind: 'Sauna', minutes: 20 })
    await finishDay(d)
    await finishDay(d) // Recovery, nothing logged

    const [recovery, rest, upper] = sessions(await loadHistory(d))
    expect(sessionSummary(upper)).toBe('Skipped')
    expect(sessionSummary(rest)).toBe('Walk 30 min · Sauna 20 min')
    expect(sessionSummary(recovery)).toBe('Rested')
  })

  it('uses the first entry as the date, not the Finish', async () => {
    await createExercise(d, 'Bench press', 'barbell')
    const first = await lift('bench-press', 60, 8)
    await finishDay(d)
    expect(sessions(await loadHistory(d))[0].date).toBe(first.loggedAt)
  })
})

describe('one exercise', () => {
  it('estimates a 1RM with Epley; a single is itself, bodyweight has none', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 5)).toBe(116.7)
    expect(e1rm(60, 10)).toBe(80)
    expect(e1rm(0, 12)).toBe(0)
  })

  it('picks the heaviest set, then the one with more reps', () => {
    const s = (weightKg: number, reps: number) => ({ weightKg, reps }) as Parameters<typeof topSet>[0][number]
    expect(topSet([s(60, 8), s(65, 5), s(65, 6), s(62.5, 10)])).toMatchObject({ weightKg: 65, reps: 6 })
    expect(topSet([])).toBeUndefined()
  })

  it('lists sessions newest first with the best e1RM, PRs, and today still open', async () => {
    await createExercise(d, 'Bench press', 'barbell')
    for (const [w, r] of [[60, 8], [60, 8]]) await lift('bench-press', w, r)
    await finishDay(d) // Upper, cycle 1
    await finishDay(d) // Lower, skipped
    await jumpTo(d, 'arms')
    await lift('bench-press', 65, 5)
    await lift('bench-press', 60, 10)

    const data = await loadHistory(d)
    const list = exerciseSessions('bench-press', data)
    expect(list.map((s) => [s.dayName, s.finished, s.value, s.hasPR, s.top.weightKg])).toEqual([
      ['Arms', false, 80, true, 65],
      ['Upper', true, 76, false, 60],
    ])
    expect(chartPoints(list).map((p) => p.value)).toEqual([76, 80])

    const st = exerciseStats('bench-press', data)
    expect(st).toMatchObject({ metric: 'e1rm', sessions: 2, sets: 4, prs: 2, volumeKg: 1885 })
    expect(st.best).toMatchObject({ value: 80, set: { weightKg: 60, reps: 10 } })
    expect(st.heaviest).toMatchObject({ weightKg: 65, reps: 5 })
  })

  it('tracks reps for bodyweight work and indexes exercises by last trained', async () => {
    const pullUp = (await createExercise(d, 'Pull-up', 'machine')).id
    await createExercise(d, 'Bench press', 'barbell')
    await lift('bench-press', 60, 8)
    await lift(pullUp, 0, 8)
    await lift(pullUp, 0, 11)
    const data = await loadHistory(d)
    expect(exerciseStats(pullUp, data)).toMatchObject({ metric: 'reps', best: { value: 11 }, volumeKg: 0 })
    expect(exerciseIndex(data).map((r) => [r.exercise.name, r.bestText])).toEqual([
      ['Pull-up', 'Best 11 reps'],
      ['Bench press', 'Best 76\u00a0kg e1RM'],
    ])
  })
})

describe('this week', () => {
  it('starts on Monday at local midnight', () => {
    expect(weekStart(new Date(2026, 9, 22, 18)).getTime()).toBe(new Date(2026, 9, 19).getTime()) // Thu → Mon
    expect(weekStart(new Date(2026, 9, 19, 0, 30)).getTime()).toBe(new Date(2026, 9, 19).getTime()) // Mon
    expect(weekStart(new Date(2026, 9, 25, 23)).getTime()).toBe(new Date(2026, 9, 19).getTime()) // Sun
  })

  it('totals this week and last week, counting today as you log', async () => {
    await createExercise(d, 'Bench press', 'barbell')
    const rows = [
      await lift('bench-press', 60, 8),
      await lift('bench-press', 60, 8),
    ]
    await finishDay(d)
    const later = [await lift('bench-press', 65, 5)] // Lower, still open
    // Pretend the first two were last Wednesday
    const lastWed = new Date(2026, 9, 14, 18).toISOString()
    for (const r of rows) await d.sets.update(r.id, { loggedAt: lastWed })
    await d.sets.update(later[0].id, { loggedAt: new Date(2026, 9, 21, 18).toISOString() })

    const { thisWeek, lastWeek } = weekSummary(await loadHistory(d), new Date(2026, 9, 22, 9))
    expect(lastWeek).toEqual({ days: 1, sets: 2, volumeKg: 960, prs: 0 })
    expect(thisWeek).toEqual({ days: 1, sets: 1, volumeKg: 325, prs: 1 })
    expect(weekLine(thisWeek)).toBe('1 day · 1 set · 325\u00a0kg · 1 PR')
    expect(weekLine({ days: 0, sets: 0, volumeKg: 0, prs: 0 })).toBe('Nothing logged')
  })
})

describe('formatting', () => {
  it('formats kilos and dates', () => {
    expect(formatKg(12345.6)).toBe('12,346')
    const now = new Date(2026, 9, 22)
    expect(formatDate(new Date(2026, 9, 14, 18).toISOString(), now)).toBe('Wed 14 Oct')
    expect(formatDate(new Date(2026, 4, 3, 7).toISOString(), now)).toBe('Sun 3 May')
    expect(formatDate(new Date(2025, 11, 31, 18).toISOString(), now)).toBe('Wed 31 Dec 2025')
  })

  it('groups by month in order', () => {
    const s = (date: string) => ({ date }) as Parameters<typeof byMonth>[0][number]
    const groups = byMonth([s('2026-10-20T10:00:00Z'), s('2026-10-02T10:00:00Z'), s('2026-09-28T10:00:00Z')])
    expect(groups.map((g) => [g.month, g.sessions.length])).toEqual([
      ['October 2026', 2],
      ['September 2026', 1],
    ])
  })
})
