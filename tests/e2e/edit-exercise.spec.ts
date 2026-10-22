import { expect, test } from '@playwright/test'
import { onboard } from './onboard'

test('rename a typo, pick an EZ bar for the plate maths, delete an unlogged exercise', async ({ page }) => {
  await onboard(page, { day: 'Arms', exercises: { Arms: ['Barbell curl'] } })

  // Add a typo'd exercise, then fix it from Your exercises
  await page.getByRole('button', { name: 'Edit exercises' }).click()
  await page.getByRole('button', { name: '+ Add exercises' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Search or type your own exercise').fill('Spider crul')
  await picker.getByRole('button', { name: /Add “Spider crul” as your own exercise/ }).click()
  await picker.getByRole('button', { name: /^Dumbbell/ }).click()
  await picker.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: /^Spider crul,/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Rename, bar or delete ›' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit exercise' })
  await expect(sheet.getByRole('radiogroup')).toHaveCount(0) // dumbbells have no bar
  await sheet.getByLabel('Name').fill('Spider curl')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: /^Spider curl,/ })).toBeVisible()

  // Barbell curl on an EZ bar
  await page.getByRole('button', { name: /^Barbell curl,/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Rename, bar or delete ›' }).click()
  await page.getByRole('dialog', { name: 'Edit exercise' }).getByRole('radio', { name: 'EZ / technique 10' }).click()
  await page.getByRole('dialog', { name: 'Edit exercise' }).getByRole('button', { name: 'Save' }).click()

  // Delete the one you never logged
  await page.getByRole('button', { name: /^Spider curl,/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Rename, bar or delete ›' }).click()
  await page.getByRole('dialog', { name: 'Edit exercise' }).getByRole('button', { name: 'Delete exercise' }).click()
  await page.getByRole('dialog', { name: 'Edit exercise' }).getByRole('button', { name: 'Delete exercise' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Spider curl deleted' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Spider curl,/ })).toHaveCount(0)
  await page.getByRole('button', { name: '‹ Today' }).click()

  // 30 kg on a 10 kg bar: 10 a side
  await page.getByRole('button', { name: /^Barbell curl, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('30')
  await expect(page.getByRole('dialog').getByText('10 a side')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()

  // Logged exercises can be renamed from their progress, but not deleted
  await page.getByRole('button', { name: 'Barbell curl progress' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit exercise' })
  await expect(edit.getByText(/Logged 1 time, so it stays in your history/)).toBeVisible()
  await expect(edit.getByRole('button', { name: 'Delete exercise' })).toHaveCount(0)
  await edit.getByLabel('Name').fill('EZ curl')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'EZ curl', level: 1 })).toBeVisible()
})
