import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('switch to pounds: type, step, plates and History all read in lb; kilos come back unchanged', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Weights in\s*kg/ }).click()
  await page.getByRole('radio', { name: 'lb' }).click()
  await expect(page.getByRole('button', { name: /Weights in\s*lb/ })).toBeVisible()
  await page.getByRole('button', { name: '‹ Today' }).click()

  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Weight (lb)', { exact: true }).fill('135')
  await expect(sheet.getByText('45 a side')).toBeVisible()
  await sheet.getByRole('button', { name: 'Log set' }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 1, 135 pounds by 8, logged/ })).toBeVisible()

  await page.getByRole('button', { name: 'Raise next set by 5 pounds' }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 2, 140 pounds by 8, next/ })).toBeVisible()
  await expect(page.getByText('45 + 2.5 a side')).toBeVisible()
  await page.getByRole('button', { name: /^Bench press, set 2, 140 pounds by 8, next/ }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Finish Upper →' }).click()

  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByRole('button', { name: /Upper.*2 sets · 1 PR · 2,200\slb/ })).toBeVisible()

  // Back to kilos: same sets, shown in kg
  await page.getByRole('button', { name: '‹ Today' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Weights in/ }).click()
  await page.getByRole('radio', { name: 'kg' }).click()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('button', { name: /^Upper/ }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 1, 61\.23 kilos by 8/ })).toBeVisible()
})
