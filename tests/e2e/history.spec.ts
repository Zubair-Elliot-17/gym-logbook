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

test('an exercise shows its best, its trend and every session', async ({ page }) => {
  await onboard(page)
  // Cycle 1: first ever set, typed in
  await page.getByRole('button', { name: /^Bench press, set 1,/ }).click()
  await page.getByRole('dialog').getByLabel('Weight (kg)', { exact: true }).fill('60')
  await page.getByRole('dialog').getByRole('button', { name: 'Log set' }).click()
  await page.getByRole('button', { name: 'Finish Upper →' }).click()
  await page.getByRole('button', { name: /Tap to continue/ }).click()
  // Back round to Upper: skip the other five days
  for (const day of ['Lower', 'Active rest', 'Recovery', 'Arms', 'Back & Chest']) {
    await page.getByRole('button', { name: `Finish ${day} →` }).click()
    const skip = page.getByRole('button', { name: 'Mark skipped' })
    if (day !== 'Active rest' && day !== 'Recovery') await skip.click()
    await page.getByRole('button', { name: /Tap to continue/ }).click()
  }
  // Cycle 2: last time's 60 kg, raised twice to 65, one tap
  await expect(page.getByRole('heading', { name: 'Upper', level: 1 })).toBeVisible()
  // Mid-workout: the exercise name opens its progress; back returns to Today
  await page.getByRole('button', { name: 'Bench press progress' }).click()
  await expect(page.getByRole('heading', { name: 'Bench press', level: 1 })).toBeVisible()
  await expect(page.getByText('Log it again to see a trend.')).toBeVisible()
  await page.getByRole('button', { name: '‹ Today' }).click()
  await page.getByRole('button', { name: 'Raise next set by 2.5 kilos' }).click()
  await page.getByRole('button', { name: 'Raise next set by 2.5 kilos' }).click()
  await page.getByRole('button', { name: /^Bench press, set 1, 65 kilos by 8, next/ }).click()
  await page.getByRole('button', { name: 'Finish Upper →' }).click()
  await expect(page.getByRole('heading', { name: 'Lower', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('tab', { name: 'Exercises' }).click()
  await page.getByRole('button', { name: /Bench press.*Best 82\.3\skg e1RM · 2 sessions/ }).click()
  await expect(page.getByRole('heading', { name: 'Bench press', level: 1 })).toBeVisible()
  await expect(page.getByText('2 sessions · 2 sets · 1 PR')).toBeVisible()
  await expect(page.getByRole('img', { name: /Estimated 1-rep max: 2 sessions, from 76 to 82\.3 kg/ })).toBeVisible()

  // A session opens its day; back returns to the exercise
  await page.getByRole('button', { name: /Upper.*65 kg × 8/ }).click()
  await expect(page.getByRole('heading', { name: 'Upper', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: '‹ Bench press' }).click()
  await expect(page.getByRole('heading', { name: 'Bench press', level: 1 })).toBeVisible()
})
