import { expect, test, type Page } from '@playwright/test'

const APP_ORIGIN = 'http://127.0.0.1:4173'
const DATA_ORIGIN = 'https://data.akedata.wiki'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@delivery',
  sharedRevision: 'delivery-contracts',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@delivery',
      gameVersion: '1.4.4',
      hotfixVersion: 'delivery',
      tableCfgPath: 'public/1.4.4/delivery/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

const CHARACTER_TABLE = {
  char_delivery_visible: {
    charId: 'char_delivery_visible',
    name: { id: 'char_delivery_visible_name', text: '' },
    engName: { id: 'char_delivery_visible_codename', text: '' },
    rarity: 6,
    sortOrder: 1,
    hidden: false,
    attributes: [
      {
        breakStage: 0,
        Attribute: {
          attrs: [
            { attrType: 0, attrValue: 1 },
            { attrType: 39, attrValue: 1_250 },
            { attrType: 40, attrValue: 180 },
            { attrType: 41, attrValue: 95 }
          ]
        }
      }
    ]
  },
  char_delivery_hidden: {
    charId: 'char_delivery_hidden',
    name: { id: 'char_delivery_hidden_name', text: '' },
    engName: { id: 'char_delivery_hidden_codename', text: '' },
    rarity: 5,
    sortOrder: 2,
    hidden: true,
    attributes: []
  }
}

const CHARACTER_GROWTH_TABLE = {
  char_delivery_visible: { profession: 'profession_guard', weaponType: 'weapon_sword' },
  char_delivery_hidden: { profession: 'profession_support', weaponType: 'weapon_staff' }
}

const I18N_CN = {
  char_delivery_visible_name: '交付极光',
  char_delivery_visible_codename: '交付先锋',
  char_delivery_hidden_name: '交付密语',
  char_delivery_hidden_codename: '隐藏档案'
}

const I18N_EN = {
  char_delivery_visible_name: 'Delivery Aurora',
  char_delivery_visible_codename: 'Delivery Vanguard',
  char_delivery_hidden_name: 'Delivery Cipher',
  char_delivery_hidden_codename: 'Hidden dossier'
}

const combatAction = (type: string, fields: Record<string, unknown> = {}) => ({
  $type: `Beyond.Gameplay.Core.${type}Action+${type}ActionData, Gameplay.Beyond`,
  isEnable: true,
  priorityLevel: 'Default',
  priorityOffset: 0,
  serverActionIndex: 0,
  ...fields
})

const BUFF_MANIFEST = [
  {
    id: 'buff_delivery_semantics',
    name: 'Delivery Semantic Buff',
    contentFile: '/public/Json/BuffData/buff_delivery_semantics.json',
    priority: 1
  }
]

const BUFF_DATA = {
  buffId: 'buff_delivery_semantics',
  timelineActions: [
    {
      _startFrame: 0,
      _endFrame: 60,
      _sequenceActionData: {
        actionData: [
          combatAction('IfElse', {
            buffId: 'buff_external_target',
            skillIdBlackboardKey: 'next_skill_key',
            conditionAction: { actionData: [combatAction('CheckTarget')] },
            succeedActions: {
              actionData: [combatAction('Damage', { frame: 12, projectileId: 'projectile_delivery' })]
            },
            failActions: {
              actionData: [combatAction('CreateBuff', { buffId: 'buff_failure_target' })]
            },
            tickActions: { actionData: [combatAction('Wait')] }
          })
        ]
      }
    }
  ]
}

const LOCALES = [
  ['CH', 'zh-CN'],
  ['TC', 'zh-Hant'],
  ['EN', 'en'],
  ['JP', 'ja'],
  ['KR', 'ko'],
  ['RU', 'ru'],
  ['MX', 'es-MX'],
  ['BR', 'pt-BR'],
  ['DE', 'de'],
  ['FR', 'fr'],
  ['VN', 'vi'],
  ['TH', 'th'],
  ['ID', 'id'],
  ['IT', 'it']
] as const

interface MockOptions {
  buffManifestFailures?: number
  failFallbackIcon?: boolean
}

interface MockState {
  buffManifestRequests: number
  manifestRequests: number
  unexpectedRequests: string[]
}

async function mockDeliveryData(page: Page, options: MockOptions = {}): Promise<MockState> {
  const state: MockState = {
    buffManifestRequests: 0,
    manifestRequests: 0,
    unexpectedRequests: []
  }

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const { pathname } = url

    if (url.origin === APP_ORIGIN) {
      if (options.failFallbackIcon && pathname === '/icon_default_missing.png') {
        await route.fulfill({ status: 404, body: '' })
        return
      }
      await route.continue()
      return
    }

    if (url.origin !== DATA_ORIGIN) {
      state.unexpectedRequests.push(url.href)
      await route.abort('blockedbyclient')
      return
    }

    if (pathname === '/manifest.json') {
      state.manifestRequests += 1
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }

    if (pathname === '/public/Json/BuffData/manifest.json') {
      state.buffManifestRequests += 1
      if (state.buffManifestRequests <= (options.buffManifestFailures ?? 0)) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
        return
      }
      await route.fulfill({ json: BUFF_MANIFEST })
      return
    }

    if (pathname === '/public/Json/BuffData/buff_delivery_semantics.json') {
      await route.fulfill({ json: BUFF_DATA })
      return
    }

    if (pathname.endsWith('/CharacterTable.json')) {
      await route.fulfill({ json: CHARACTER_TABLE })
      return
    }

    if (pathname.endsWith('/CharGrowthTable.json')) {
      await route.fulfill({ json: CHARACTER_GROWTH_TABLE })
      return
    }

    if (pathname.endsWith('/I18nTextTable_CN.json')) {
      await route.fulfill({ json: I18N_CN })
      return
    }

    if (pathname.endsWith('/I18nTextTable_EN.json')) {
      await route.fulfill({ json: I18N_EN })
      return
    }

    if (pathname.startsWith('/public/images/')) {
      await route.fulfill({ status: 404, body: '' })
      return
    }

    if (pathname.endsWith('/manifest.json')) {
      await route.fulfill({ json: [] })
      return
    }

    await route.fulfill({ json: {} })
  })

  return state
}

async function installPreferences(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((preferences) => {
    const storageKey = 'akedatabase.preferences.v3'
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(preferences))
    }
  }, overrides)
}

async function setPersistedPreference(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    ([preferenceKey, preferenceValue]) => {
      const storageKey = 'akedatabase.preferences.v3'
      const preferences = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown>
      preferences[preferenceKey] = preferenceValue
      localStorage.setItem(storageKey, JSON.stringify(preferences))
    },
    [key, value] as const
  )
}

test('v3_character supports a populated directory, search, deep links and hidden-record access', async ({
  page
}, testInfo) => {
  const state = await mockDeliveryData(page)
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })

  await page.goto('/module/v3_character')
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Select data' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('.catalog-directory__entry')).toHaveCount(1)
    await expect(drawer.getByText('Delivery Aurora', { exact: true })).toBeVisible()
    await expect(drawer.getByText('Delivery Cipher', { exact: true })).toHaveCount(0)
    await expect(drawer.getByRole('searchbox')).toHaveCount(0)
  } else {
    await expect(page.locator('.catalog-directory__entry')).toHaveCount(1)
    await expect(page.getByText('Delivery Aurora', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Delivery Cipher', { exact: true })).toHaveCount(0)

    const search = page.getByRole('searchbox')
    await search.fill('vanguard')
    await expect(page.locator('.catalog-directory__entry')).toHaveCount(1)
    await search.fill('cipher')
    await expect(page.locator('.catalog-directory__entry')).toHaveCount(0)
    await search.fill('')
  }

  await page.goto('/module/v3_character?id=char_delivery_visible')
  await expect(page.getByRole('heading', { name: 'Delivery Aurora' })).toBeVisible()
  await expect(page.locator('[data-layout-section="character-header"]')).toBeVisible()

  await page.goto('/module/v3_character?id=char_delivery_hidden')
  await expect(page.locator('.ake-error-state')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Delivery Cipher' })).toHaveCount(0)

  await setPersistedPreference(page, 'showHidden', true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Delivery Cipher' })).toBeVisible()
  expect(state.unexpectedRequests).toEqual([])
})

test('v3_buff renders semantic timeline, collapsible tree, Vue Flow and keyboard tree', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The graph contract is viewport independent.')
  const state = await mockDeliveryData(page)
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })

  await page.goto('/module/v3_buff?id=buff_delivery_semantics')
  await expect(page.getByRole('heading', { name: 'Delivery Semantic Buff' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Events', exact: true })).toHaveAttribute('data-state', 'active')
  const treeNodes = page.locator('.tree-node')
  const initialTreeCount = await treeNodes.count()
  const initialExpandedCount = await page.locator('.tree-node[aria-expanded="true"]').count()
  const firstCollapsed = page.locator('.tree-node[aria-expanded="false"]').first()
  await expect(firstCollapsed).toBeVisible()
  await firstCollapsed.click()
  await expect
    .poll(() => page.locator('.tree-node[aria-expanded="true"]').count())
    .toBeGreaterThan(initialExpandedCount)
  await expect.poll(() => treeNodes.count()).toBeGreaterThan(initialTreeCount)

  for (let index = 0; index < 32; index += 1) {
    const collapsed = page.locator('.tree-node[aria-expanded="false"]').first()
    if ((await collapsed.count()) === 0) break
    await collapsed.click()
  }
  await expect(page.locator('.tree-node[aria-expanded="false"]')).toHaveCount(0)
  for (const actionType of ['CheckTarget', 'Damage', 'CreateBuff', 'Wait']) {
    await expect(treeNodes.filter({ hasText: actionType }).first()).toBeVisible()
  }

  await page.getByRole('tab', { name: 'Timeline', exact: true }).click()
  await page.locator('.timeline-row').first().click()
  await page.getByRole('tab', { name: 'Events', exact: true }).click()
  await page.getByRole('tab', { name: 'Selected subtree', exact: true }).click()
  await expect(page.locator('.vue-flow__node').first()).toBeVisible()
  for (const relation of ['condition', 'success', 'failure', 'tick', 'external']) {
    await expect(page.locator(`.edge-${relation}`).first()).toBeAttached()
  }

  await page.getByRole('tab', { name: 'Accessible action tree', exact: true }).click()
  const linearNodes = page.locator('.linear-action-button')
  await expect(linearNodes).not.toHaveCount(0)
  await linearNodes.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(linearNodes.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(linearNodes.last()).toBeFocused()
  expect(state.unexpectedRequests).toEqual([])
})

test('a rejected combat manifest cache recovers through ErrorState retry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The query-cache contract is viewport independent.')
  const state = await mockDeliveryData(page, { buffManifestFailures: 2 })
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })

  await page.goto('/module/v3_buff')
  await expect.poll(() => state.buffManifestRequests).toBe(2)
  await expect(page.locator('.ake-error-state').first()).toBeVisible()
  expect(state.buffManifestRequests).toBe(2)

  await page.locator('.ake-error-state__retry').first().click()
  await expect(page.getByText('Delivery Semantic Buff', { exact: true })).toBeVisible()
  await expect.poll(() => state.buffManifestRequests).toBe(3)
  await expect(page.locator('.ake-error-state')).toHaveCount(0)
  expect(state.unexpectedRequests).toEqual([])
})

test('all fourteen locales survive a real desktop reload and update html lang', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The locale matrix runs once on the desktop project.')
  const state = await mockDeliveryData(page)
  await installPreferences(page, { locale: 'CH', theme: 'light', showHidden: false })
  await page.goto('/')
  await expect.poll(() => state.manifestRequests).toBe(1)

  for (const [index, [locale, htmlLang]] of LOCALES.entries()) {
    await setPersistedPreference(page, 'locale', locale)
    await page.reload()
    await expect.poll(() => state.manifestRequests).toBe(index + 2)
    await expect(page.locator('html')).toHaveAttribute('lang', htmlLang)
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.locator('#app[role="alert"]')).toHaveCount(0)
    await expect(page.locator('.app-main')).not.toBeEmpty()
  }

  expect(state.unexpectedRequests).toEqual([])
})

test('a failed remote image exposes the visible accessible fallback', async ({ page }) => {
  const state = await mockDeliveryData(page, { failFallbackIcon: true })
  await installPreferences(page, { locale: 'EN', theme: 'light', showHidden: false })

  await page.goto('/module/v3_character?id=char_delivery_visible')
  await expect(page.getByRole('heading', { name: 'Delivery Aurora' })).toBeVisible()
  const headerImage = page.locator('.legacy-header__icon.ake-image').first()
  await headerImage.scrollIntoViewIfNeeded()
  await expect(headerImage).toHaveClass(/ake-image--failed/)
  await expect(
    headerImage.locator('.ake-image__fallback[role="img"][aria-label="Delivery Aurora"]')
  ).toBeVisible()
  expect(state.unexpectedRequests).toEqual([])
})
