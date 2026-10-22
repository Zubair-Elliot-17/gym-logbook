import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LogbookDB, createExercise, finishDay, jumpTo, logActivity, logSet, openDb } from './db'
import { byMonth, formatDate, formatKg, loadHistory, sessionSummary, sessions } from './history'

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
