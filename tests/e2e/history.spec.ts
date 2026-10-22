import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('finished days land in History; a past set can be fixed', async ({ page }) => {
  await onboard(page)

  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByText('Nothing here yet.')).toBeVisible()
  await page.getByRole('button', { name: '‹ Today' }).click()

  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8, next/ }).click()
  await page.getByRole('button', { name: 'Finish Upper →' }).click()
  await expect(page.getByRole('heading', { name: 'Lower', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('button', { name: /Upper.*2 sets · 960\skg/ }).click()
  await expect(page.getByRole('heading', { name: 'Upper', level: 1 })).toBeVisible()

  // Fix a typo in set 2
  await page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 8/ }).click()
  await page.getByRole('dialog').getByLabel('Reps', { exact: true }).fill('10')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: /^Bench press, set 2, 60 kilos by 10, PR/ })).toBeVisible()
  await expect(page.getByText('2 sets · 1 PR · 1,080 kg')).toBeVisible()

  // Back to the list, then Today
  await page.getByRole('button', { name: '‹ History' }).click()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await expect(page.getByRole('heading', { name: 'Lower', level: 1 })).toBeVisible()
})
