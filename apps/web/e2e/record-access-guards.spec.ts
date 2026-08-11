import { expect, test, type Page } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@test',
  sharedRevision: 'access-guard-shared',
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

const SKILL_MANIFEST = [
  {
    id: 'skill_hidden',
    name: 'Hidden Skill',
    contentFile: '/public/Json/SkillData/skill_hidden.json',
    hidden: true,
    priority: 1
  }
]

const ACTIVITY_TABLE = {
  activity_hidden: {
    id: 'activity_hidden',
    name: { id: 'activity_hidden_name', text: 'Hidden Activity' },
    hidden: true,
    sortId: 1
  }
}

const EMPTY_ACTIVITY_TABLES = [
  'ActivityTagTable',
  'TimeRangeTable',
  'RewardTable',
  'ItemTable',
  'ActivityConditionalMultiStageTable',
  'ActivityDungeonFightingStageTable',
  'DungeonTable'
]

async function mockR2(page: Page, requestedPaths: string[]): Promise<void> {
  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    requestedPaths.push(pathname)
    if (pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (pathname === '/public/Json/SkillData/manifest.json') {
      await route.fulfill({ json: SKILL_MANIFEST })
      return
    }
    if (pathname === '/public/Json/SkillData/skill_hidden.json') {
      await route.fulfill({ json: { skillId: 'skill_hidden', timelineActions: [] } })
      return
    }
    if (pathname.endsWith('/ActivityTable.json')) {
      await route.fulfill({ json: ACTIVITY_TABLE })
      return
    }
    if (
      EMPTY_ACTIVITY_TABLES.some((table) => pathname.endsWith(`/${table}.json`)) ||
      pathname.includes('/I18nTextTable_') ||
      pathname.endsWith('/SkillPatchTable.json')
    ) {
      await route.fulfill({ json: {} })
      return
    }
    if (pathname.endsWith('/manifest.json')) {
      await route.fulfill({ json: [] })
      return
    }
    await route.fulfill({ json: {} })
  })
}

async function setShowHidden(page: Page, showHidden: boolean): Promise<void> {
  await page.evaluate((value) => {
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'EN', theme: 'light', showHidden: value })
    )
  }, showHidden)
}

test('record deep links resolve only through the hidden-access guard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The access contract is viewport independent.')
  const requestedPaths: string[] = []
  await mockR2(page, requestedPaths)

  await page.goto('/module/v3_skill?id=skill_hidden')
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page.locator('.ake-error-state')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hidden Skill' })).toHaveCount(0)
  expect(requestedPaths).not.toContain('/public/Json/SkillData/skill_hidden.json')
  expect(requestedPaths.some((path) => path.endsWith('/SkillPatchTable.json'))).toBe(false)

  await setShowHidden(page, true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hidden Skill' })).toBeVisible()

  await setShowHidden(page, false)
  await page.goto('/module/v3_activity?id=activity_hidden')
  await expect(page.locator('.ake-error-state')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hidden Activity' })).toHaveCount(0)

  await setShowHidden(page, true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hidden Activity' })).toBeVisible()
})
