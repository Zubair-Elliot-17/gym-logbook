import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('logging a set starts the rest timer; adjust, skip, run out, or turn it off', async ({ page }) => {
  await page.clock.install()
  await onboard(page)

  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  const timer = page.getByRole('timer')
  await expect(timer).toHaveAccessibleName('Rest, 90 seconds left')
  await expect(timer).toContainText('1:30')

  await page.getByRole('button', { name: '15 seconds more' }).click()
  await expect(timer).toContainText('1:45')
  await page.clock.runFor(30_000)
  await expect(timer).toContainText('1:15')

  // Runs out: stamped "Rest over", then goes away
  await page.clock.runFor(75_000)
  await expect(page.getByText('Rest over · next set')).toBeVisible()
  await page.clock.runFor(5_000)
  await expect(page.getByText('Rest over · next set')).toHaveCount(0)

  // Next set restarts it; Skip clears it
  await page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8, next/ }).click()
  await expect(timer).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(timer).toHaveCount(0)

  // Settings: 3:00, then off
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Rest timer\s*1:30/ }).click()
  await page.getByRole('radio', { name: '3:00' }).click()
  await expect(page.getByRole('button', { name: /Rest timer\s*3:00/ })).toBeVisible()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await page.getByRole('button', { name: /^Bench press, set 3, 60 kilos by 8, next/ }).click()
  await expect(timer).toHaveAccessibleName('Rest, 180 seconds left')
  await page.getByRole('button', { name: 'Skip' }).click()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Rest timer/ }).click()
  await page.getByRole('radio', { name: 'Off' }).click()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await page.getByRole('button', { name: /^Bench press\s*✓ 3/ }).click() // the row collapsed once all 3 were in
  await page.getByRole('button', { name: '+ set' }).click()
  await page.getByRole('button', { name: /^Bench press, set 4, 60 kilos by 8, next/ }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 4, 60 kilos by 8, logged/ })).toBeVisible()
  await expect(timer).toHaveCount(0)
})

test('the timer survives a reload mid-rest', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveAccessibleName(/^Rest, (8\d|90) seconds left$/)
})
