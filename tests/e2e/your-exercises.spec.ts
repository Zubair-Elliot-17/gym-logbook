import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('welcome shows once; days start empty; pick from the list or type your own; set sets/weight/reps', async ({ page }) => {
  await onboard(page, { day: 'Back & Chest', exercises: { 'Back & Chest': ['Deadlift', 'Incline dumbbell press'] } })

  // Reload: straight to today, no welcome again
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Back & Chest', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Welcome' })).toHaveCount(0)
  await expect(page.getByText('Welcome back')).toBeVisible()

  // Edit exercises: type your own, set its numbers, remove a library one
  await page.getByRole('button', { name: 'Edit exercises' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Search or type your own exercise').fill('Meadows row')
  await sheet.getByRole('button', { name: /Add “Meadows row” as your own exercise/ }).click()
  await sheet.getByRole('button', { name: /^Dumbbell/ }).click()
  await sheet.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: /^Meadows row, 3 × 10 · weight on first set/ }).click()
  const edit = page.getByRole('dialog')
  await edit.getByLabel('Sets', { exact: true }).fill('4')
  await edit.getByLabel('Weight (kg)', { exact: true }).fill('30')
  await edit.getByLabel('Reps', { exact: true }).fill('12')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: /^Meadows row, 4 × 12 · 30 kg/ })).toBeVisible()

  await page.getByRole('button', { name: 'Remove Incline dumbbell press from Back & Chest' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Incline dumbbell press removed from Back & Chest' })).toBeVisible()
  await page.getByRole('button', { name: '‹ Today' }).click()

  // Today shows your list, with your starting weight ready to log in one tap
  await expect(page.getByRole('heading', { name: 'Deadlift' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Incline dumbbell press' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Meadows row, set 1, 30 kilos by 12, next/ }).click()
  await expect(page.getByRole('button', { name: /^Meadows row, set 1, 30 kilos by 12, logged/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Meadows row, set 4,/ })).toBeVisible()
})

test('an empty lifting day offers set-up instead of a blank screen', async ({ page }) => {
  await onboard(page, { day: 'Arms', exercises: {} })
  await expect(page.getByText('No exercises on Arms yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Set up Arms' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  // the list opens on the day's own muscles
  await expect(page.getByRole('dialog').getByRole('tab', { name: 'Biceps' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('dialog').getByRole('button', { name: 'Add Hammer curl', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await expect(page.getByRole('heading', { name: 'Hammer curl' })).toBeVisible()
})
