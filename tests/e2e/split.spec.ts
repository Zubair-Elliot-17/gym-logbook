import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('edit your split: rename, add, reorder, retype, remove; Today and the week strip follow', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Your split\s*6 days/ }).click()
  await expect(page.getByRole('heading', { name: 'Your split', level: 1 })).toBeVisible()

  // Rename today
  await page.getByRole('button', { name: /^Upper, lifting day, today/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Name').fill('Push')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: /^Push, lifting day, today/ })).toBeVisible()

  // Add a day and move it up one
  await page.getByRole('button', { name: '+ Add a day' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Conditioning')
  await page.getByRole('dialog').getByRole('radio', { name: 'Rest' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add day' }).click()
  await page.getByRole('button', { name: 'Move Conditioning earlier' }).click()

  // Recovery becomes a lifting day; Active rest leaves the split
  await page.getByRole('button', { name: /^Recovery, rest day/ }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Lifting' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Remove Active rest' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Active rest removed.' })).toBeVisible()

  // Today can't be removed
  await expect(page.getByRole('button', { name: 'Remove Push' })).toBeDisabled()

  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await expect(page.getByRole('heading', { name: 'Push', level: 1 })).toBeVisible()
  await expect(page.getByText('Day 1 of 6')).toBeVisible()
  const tiles = page.getByRole('navigation', { name: 'Week' }).getByRole('button')
  await expect(tiles).toHaveText(['Push', 'Lower', 'Recov', 'Arms', 'Condi', 'B+C'])

  // It survives a reload
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Push', level: 1 })).toBeVisible()
})

test('a lifting day with something logged can’t become a rest day until it’s finished', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Your split/ }).click()
  await page.getByRole('button', { name: /^Upper, lifting day, today/ }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Rest' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toHaveText(/Finish it before you make it a rest day/)
})
