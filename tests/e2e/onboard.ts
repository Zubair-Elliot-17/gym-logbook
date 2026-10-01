import { expect, type Page } from '@playwright/test'

/** First open: Welcome → add exercises to lifting days → pick today. */
export async function onboard(page: Page, opts: { day?: string; exercises?: Record<string, string[]> } = {}) {
  const { day = 'Upper', exercises = { Upper: ['Bench press'] } } = opts
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await page.getByRole('button', { name: 'Get started →' }).click()
  for (const [dayName, names] of Object.entries(exercises)) {
    await page.getByRole('button', { name: new RegExp(`^${dayName}`) }).click()
    await page.getByRole('button', { name: '+ Add exercises' }).click()
    const sheet = page.getByRole('dialog')
    for (const n of names) {
      await sheet.getByLabel('Search or type your own exercise').fill(n)
      await sheet.getByRole('button', { name: `Add ${n}`, exact: true }).click()
      await expect(sheet.getByRole('button', { name: `${n}, already on ${dayName}` })).toBeVisible()
    }
    await sheet.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: '‹ All days' }).click()
  }
  await page.getByRole('button', { name: /^(Continue|Skip for now) →$/ }).click()
  await page.getByRole('radio', { name: new RegExp(day) }).click()
  await page.getByRole('button', { name: `Start with ${day} →` }).click()
  await expect(page.getByRole('heading', { name: day, level: 1 })).toBeVisible()
}
