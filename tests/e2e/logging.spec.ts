import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('first run → log a set → reload → still logged', async ({ page }) => {
  await onboard(page)

  // Unknown weight: tapping the set opens the editor
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Weight (kg)', { exact: true }).fill('60')
  await sheet.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Set logged · 60 × 8' })).toBeVisible()

  // Set 2 now copies 60 kg: one tap logs it
  await page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8, next/ }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8, logged/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: /^Bench press, set 1, 60 kilos by 8, logged/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8, logged/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Bench press, set 3, 60 kilos by 8, next/ })).toBeVisible()
})

test('finish shows the summary card and advances; finished days refuse a jump', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('50')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await page.getByRole('button', { name: 'Finish Upper →' }).click()
  await expect(page.getByText('Upper done · 1 set')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lower', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Upper, done' }).click()
  await expect(page.getByText('Upper is already done this cycle.')).toBeVisible()
})
