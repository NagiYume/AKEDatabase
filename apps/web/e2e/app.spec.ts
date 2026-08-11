import { expect, test, type Page } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@test',
  sharedRevision: 'e2e-shared',
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

const combatAction = (type: string, fields: Record<string, unknown> = {}) => ({
  $type: `Beyond.Gameplay.Core.${type}Action+${type}ActionData, Gameplay.Beyond`,
  isEnable: true,
  priorityLevel: 'Default',
  priorityOffset: 0,
  serverActionIndex: 0,
  ...fields
})

const SKILL_MANIFEST = [
  {
    id: 'skill_e2e_branch',
    name: 'E2E Branch Skill',
    contentFile: '/public/Json/SkillData/skill_e2e_branch.json',
    priority: 1
  }
]

const SKILL_DATA = {
  skillId: 'skill_e2e_branch',
  timelineActions: [
    {
      _startFrame: 0,
      _endFrame: 30,
      _sequenceActionData: {
        actionData: [
          combatAction('Move'),
          combatAction('IfElse', {
            conditionAction: { actionData: [combatAction('CheckTarget')] },
            succeedActions: { actionData: [combatAction('Damage', { frame: 15 })] },
            failActions: { actionData: [combatAction('CreateBuff')] }
          })
        ]
      }
    }
  ]
}

async function mockR2(page: Page): Promise<void> {
  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (pathname === '/public/Json/SkillData/manifest.json') {
      await route.fulfill({ json: SKILL_MANIFEST })
      return
    }
    if (pathname === '/public/Json/SkillData/skill_e2e_branch.json') {
      await route.fulfill({ json: SKILL_DATA })
      return
    }
    if (pathname.endsWith('/manifest.json')) {
      await route.fulfill({ json: [] })
      return
    }
    await route.fulfill({ json: {} })
  })
}

async function installPreferences(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((preferences) => {
    localStorage.setItem('akedatabase.preferences.v3', JSON.stringify(preferences))
  }, overrides)
}

test.beforeEach(async ({ page }) => {
  await mockR2(page)
})

test('canonical and legacy deep links survive reload, back and forward', async ({ page }) => {
  const entityId = '900719925474099312345'
  await page.goto(`/?plugin=v3_skill&id=${entityId}&level=12`)

  await expect(page.locator('.app-shell')).toBeVisible()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_skill')
  expect(new URL(page.url()).searchParams.get('id')).toBe(entityId)
  expect(new URL(page.url()).searchParams.get('level')).toBe('12')

  await page.reload()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_skill')
  expect(new URL(page.url()).searchParams.get('id')).toBe(entityId)

  const mixedCaseId = 'Skill_CASE_900719925474099312345'
  await page.goto(`/module/v3_skill/${mixedCaseId}?level=9&view=tree`)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_skill')
  expect(new URL(page.url()).searchParams.get('id')).toBe(mixedCaseId)
  expect(new URL(page.url()).searchParams.get('level')).toBe('9')
  expect(new URL(page.url()).searchParams.get('view')).toBe('tree')

  await page.goto(`/m/v3_skill/${mixedCaseId}?level=12`)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_skill')
  expect(new URL(page.url()).searchParams.get('id')).toBe(mixedCaseId)

  await page.goto('/module/about')
  await page.goBack()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_skill')
  expect(new URL(page.url()).searchParams.get('id')).toBe(mixedCaseId)
  await page.goForward()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/about')
})

test('hidden and disabled module guards honor hydrated preferences', async ({ page }) => {
  await page.goto('/module/v3_mission/mission_e2e')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/not-found')
  expect(new URL(page.url()).searchParams.get('hidden')).toBe('1')

  await page.evaluate(() => {
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'CH', theme: 'light', showHidden: true })
    )
  })
  await page.goto('/module/v3_mission?id=mission_e2e')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/module/v3_mission')
  expect(new URL(page.url()).searchParams.get('id')).toBe('mission_e2e')

  await page.goto('/module/skill/legacy')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/not-found')
  expect(new URL(page.url()).searchParams.get('hidden')).toBeNull()
})

test('all retained module routes mount without a startup failure', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'The full registry smoke runs once; responsive coverage is separate.'
  )
  test.setTimeout(120_000)
  await installPreferences(page, { locale: 'CH', theme: 'light', showHidden: true })
  const moduleIds = [
    'season_tower',
    'v3_character',
    'v3_weapon',
    'v3_enemy',
    'v3_equip',
    'v3_skill',
    'v3_activity',
    'v3_buff',
    'v3_mission',
    'v3_shop',
    'v3_item',
    'v3_dungeon',
    'v3_achievement',
    'baker',
    'v3_cc',
    'research',
    'about',
    'hidden-example',
    'settings'
  ]

  for (const moduleId of moduleIds) {
    await page.goto(`/module/${moduleId}`)
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('#app[role="alert"]')).toHaveCount(0)
    await expect(page.locator('.app-main')).not.toBeEmpty()
    expect(new URL(page.url()).pathname).toBe(`/module/${moduleId}`)
  }
})

test('themes, locale hydration and beta watermark remain visible at both viewports', async ({ page }) => {
  await installPreferences(page, { locale: 'EN', theme: 'yellow', showHidden: false })
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'yellow')
  await expect(page.locator('.beta-watermark__cell')).toHaveCount(30)
  await expect(page.locator('.beta-watermark__cell').first()).toContainText('127.0.0.1')
  await expect(page.locator('.beta-watermark__cell').first()).toContainText('测试版本，仅供参考')

  if (await page.locator('.mobile-header').isVisible()) {
    const trigger = page.getByRole('button', { name: /open modules|打开模块列表/i })
    await trigger.click()
    await expect(page.locator('.ake-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ake-drawer')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  } else {
    await expect(page.locator('.app-sidebar')).toBeVisible()
  }
})

test('combat graph exposes timeline, tree, flow and keyboard-linear views', async ({ page }) => {
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })
  await page.goto('/module/v3_skill?id=skill_e2e_branch')

  await expect(page.getByRole('heading', { name: 'E2E Branch Skill' })).toBeVisible()
  await expect(page.locator('.timeline-row').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Logic chain', exact: true }).click()
  await expect(page.locator('.tree-node')).not.toHaveCount(0)
  const collapsedCount = await page.locator('.tree-node').count()
  await page.locator('.combat-load-more').click()
  await expect.poll(() => page.locator('.tree-node').count()).toBeGreaterThan(collapsedCount)

  await page.getByRole('tab', { name: 'Selected subtree', exact: true }).click()
  await expect(page.locator('.vue-flow__node').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Accessible action tree', exact: true }).click()
  const linearNodes = page.locator('.linear-action-button')
  await expect(linearNodes).not.toHaveCount(0)
  await linearNodes.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(linearNodes.nth(1)).toBeFocused()
})

test('combat mobile directory drawer selects an entry through query id', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The floating directory is mobile-only.')
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })
  await page.goto('/module/v3_skill?view=tree')

  await page.getByRole('button', { name: 'Skill list', exact: true }).click()
  const drawer = page.locator('.ake-drawer')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('searchbox').fill('e2e')
  await drawer.locator('.combat-directory__item').click()

  await expect(drawer).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('id')).toBe('skill_e2e_branch')
  expect(new URL(page.url()).searchParams.get('view')).toBe('tree')
  await expect(page.getByRole('heading', { name: 'E2E Branch Skill' })).toBeVisible()
})
