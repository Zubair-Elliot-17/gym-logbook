import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('after one online load the app works offline: reload, fonts, logging', async ({ page, context }) => {
  await onboard(page)

  // Wait for the service worker to finish precaching and take control.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Upper', level: 1 })).toBeVisible()

  // Self-hosted fonts come from the precache, not the network.
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))
  expect(loaded).toEqual(expect.arrayContaining(['Bricolage Grotesque', 'Atkinson Hyperlegible Next', 'Martian Mono']))

  // Logging works with no network at all.
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('40')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 1, 40 kilos by 8, logged/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: /^Bench press, set 1, 40 kilos by 8, logged/ })).toBeVisible()

  // Settings reports it.
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText('✓ Ready offline')).toBeVisible()
})
