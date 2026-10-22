import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('barbell lifts show what to load a side; it follows −/+ and the typed weight', async ({ page }) => {
  await onboard(page, { day: 'Upper', exercises: { Upper: ['Bench press', 'Dumbbell bench press'] } })

  // No weight yet: nothing to load
  await expect(page.getByText(/a side/)).toHaveCount(0)

  // The sheet shows the load as you type
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Weight (kg)', { exact: true }).fill('82.5')
  await expect(sheet.getByText('25 + 5 + 1.25 a side')).toBeVisible()
  await sheet.getByLabel('Weight (kg)', { exact: true }).fill('60')
  await expect(sheet.getByText('20 a side')).toBeVisible()
  await sheet.getByRole('button', { name: 'Log set' }).click()

  // Today: the next set's load, updated by +
  const bench = page.getByRole('region', { name: 'Bench press', exact: true })
  await expect(bench.getByText('20 a side')).toBeVisible()
  await bench.getByRole('button', { name: 'Raise next set by 2.5 kilos' }).click()
  await expect(bench.getByText('20 + 1.25 a side')).toBeVisible()

  // Dumbbells never show plates
  await page.getByRole('button', { name: /^Dumbbell bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('30')
  await expect(page.getByRole('dialog').getByText(/a side/)).toHaveCount(0)
})
