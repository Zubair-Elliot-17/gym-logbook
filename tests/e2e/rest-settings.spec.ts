import { expect, test } from '@playwright/test'

test('rest day: chip logs in one tap, finish fills the tile, Go back a day undoes it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: /Active rest/ }).click()
  await page.getByRole('button', { name: 'Start with Active rest →' }).click()

  await page.getByRole('button', { name: 'Log Walk, 30 minutes' }).click()
  await expect(page.getByRole('button', { name: 'Walk, 30 minutes, logged, tap to edit' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish Active rest →' }).click()
  await expect(page.getByText('Walk 30 min')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recovery', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Active rest, done' })).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: /Go back a day/ }).click()
  await page.getByRole('button', { name: 'Go back to Active rest' }).click()
  await expect(page.getByRole('heading', { name: 'Active rest', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Walk, 30 minutes, logged, tap to edit' })).toBeVisible()
})

test('import rejects a foreign file and changes nothing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Upper →' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  })
  await expect(page.getByRole('alert')).toHaveText('This file isn’t a Gym Logbook backup. Nothing changed.')
  await expect(page.getByRole('button', { name: /Restore pre-import snapshot/ })).toBeDisabled()
})
