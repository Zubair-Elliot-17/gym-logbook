import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LogbookDB, addExerciseToDay, addToPlan, createExercise, finishDay, jumpTo, logActivity, logSet, openDb } from './db'
import { buildLiftRows, dayHeading, daysAgo, finishSummary, lastFinish, loadToday, pickBanner, shortName } from './today'

let d: LogbookDB
let n = 0
beforeEach(async () => {
  d = await openDb(new LogbookDB(`today-${++n}`))
})
afterEach(async () => {
  await d.delete()
})

/** Upper's plan as a user might set it up. */
async function planUpper() {
  for (const n of ['Bench press', 'Bent-over row', 'Overhead press', 'Lat pulldown', 'Lateral raise']) {
    await addToPlan(d, 'upper', (await createExercise(d, n, 'barbell')).id)
  }
}

describe('today view model', () => {
  it('an empty day has no rows', async () => {
    expect(buildLiftRows(await loadToday(d))).toEqual([])
  })

  it('builds rows for your plan with unknown-weight ghosts and the heading', async () => {
    await planUpper()
    const data = await loadToday(d)
    const rows = buildLiftRows(data)
    expect(rows.map((r) => r.exercise.id)).toEqual(['bench-press', 'bent-over-row', 'overhead-press', 'lat-pulldown', 'lateral-raise'])
    expect(rows[0].ghosts).toHaveLength(3)
    expect(rows[0].ghosts[0]).toMatchObject({ weightKg: null, reps: 8, next: true })
    expect(dayHeading(data)).toBe('Day 1 of 6 · cycle #1')
  })

  it('shows an added exercise with no history as needing the editor, then marks PRs and done rows', async () => {
    await planUpper()
    const ex = await createExercise(d, 'Cable crunch', 'machine')
    await addExerciseToDay(d, ex.id)
    let rows = buildLiftRows(await loadToday(d))
    expect(rows.at(-1)).toMatchObject({ needsEditor: true, ghosts: [] })

    for (const w of [60, 60, 62.5]) await logSet(d, { exerciseId: 'bench-press', weightKg: w, reps: 8 })
    rows = buildLiftRows(await loadToday(d))
    expect(rows[0].done).toBe(true)
    expect(rows[0].prIds.size).toBe(1)
  })

  it('summarises a finished lifting day, a skipped one and a rest day', async () => {
    await planUpper()
    for (const w of [60, 62.5]) await logSet(d, { exerciseId: 'bench-press', weightKg: w, reps: 8 })
    let data = await loadToday(d)
    expect(finishSummary(data, buildLiftRows(data))).toEqual({
      dayName: 'Upper',
      title: 'Upper done · 2 sets · 1 PR',
      lines: ['Bench press 62.5 × 8'],
    })
    await finishDay(d)
    data = await loadToday(d)
    expect(finishSummary(data, buildLiftRows(data)).title).toBe('Lower skipped')
    await jumpTo(d, 'active-rest')
    await logActivity(d, { kind: 'Walk', minutes: 30 })
    data = await loadToday(d)
    expect(finishSummary(data, [])).toEqual({ dayName: 'Active rest', title: 'Active rest done', lines: ['Walk 30 min'] })
  })

  it('shortens tile names', () => {
    expect(['Upper', 'Active rest', 'Recovery', 'Back & Chest'].map(shortName)).toEqual(['Upper', 'Active', 'Recov', 'B+C'])
  })
})

describe('notices', () => {
  it('shows one banner: install > offline > backup', () => {
    expect(pickBanner({ standalone: false, offlineReady: false, backupOverdue: true })).toBe('install')
    expect(pickBanner({ standalone: true, offlineReady: false, backupOverdue: true })).toBe('offline')
    expect(pickBanner({ standalone: true, offlineReady: true, backupOverdue: true })).toBe('backup')
    expect(pickBanner({ standalone: true, offlineReady: true, backupOverdue: false })).toBeNull()
  })

  it('formats days ago by calendar day', () => {
    const now = new Date(2026, 9, 17, 9, 0)
    expect(daysAgo(new Date(2026, 9, 17, 1, 0).toISOString(), now)).toBe('today')
    expect(daysAgo(new Date(2026, 9, 16, 23, 0).toISOString(), now)).toBe('yesterday')
    expect(daysAgo(new Date(2026, 9, 1, 12, 0).toISOString(), now)).toBe('16 days ago')
  })

  it('names the Finish that Go back a day would undo', async () => {
    expect(lastFinish(await loadToday(d))).toBeNull()
    await finishDay(d)
    await finishDay(d)
    expect(lastFinish(await loadToday(d))?.dayName).toBe('Lower')
  })
})
