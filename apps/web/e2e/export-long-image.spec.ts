import { expect, test } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@test',
  sharedRevision: 'export-e2e',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@test',
      gameVersion: '1.4.4',
      hotfixVersion: 'test',
      tableCfgPath: 'public/1.4.4/test/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

test('desktop export produces a PNG download', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The mobile drawer is covered by AppShell tests.')

  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    await route.fulfill({ json: pathname === '/manifest.json' ? DATA_MANIFEST : {} })
  })
  await page.goto('/module/settings')
  await expect(page.getByRole('heading', { name: /全局设置|Global settings/i })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20_000 }),
    page.getByRole('button', { name: '导出' }).click()
  ])

  expect(download.suggestedFilename()).toMatch(/\.png$/i)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
