import { expect, test, type Page } from '@playwright/test'

const APP_ORIGIN = 'http://127.0.0.1:4173'
const DATA_ORIGIN = 'https://data.akedata.wiki'
const ROTATION_START = Date.parse('2026-01-22T00:00:00+08:00')
const FROZEN_NOW = ROTATION_START + 12 * 60 * 60 * 1_000

const WEEKLY_IDS = ['wpn_sword_0021', 'wpn_funnel_0004', 'wpn_funnel_0009', 'wpn_sword_0019']
const DAILY_IDS = ['wpn_claym_0011', 'wpn_pistol_0004', 'wpn_sword_0007', 'wpn_pistol_0006']
const ROTATION_IDS = [...WEEKLY_IDS, ...DAILY_IDS]

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@shop-layout',
  sharedRevision: 'shop-layout-contract',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@shop-layout',
      gameVersion: '1.4.4',
      hotfixVersion: 'shop-layout',
      tableCfgPath: 'public/1.4.4/shop-layout/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

function text(value: string) {
  return { id: value, text: value }
}

const ROTATION_GOODS = Object.fromEntries(
  ROTATION_IDS.map((id) => [
    `goods_${id}`,
    {
      goodsId: `goods_${id}`,
      rewardId: `reward_${id}`,
      moneyId: 'item_quota',
      price: 20,
      cnDiscount: 1,
      limitCount: 1,
      limitCountRefreshType: 2
    }
  ])
)

const TABLES: Record<string, unknown> = {
  ShopGroupTable: {
    cash_group: {
      shopGroupId: 'cash_group',
      shopGroupName: text('补给商店'),
      shopGroupType: 5
    },
    shop_pay_weapon: {
      shopGroupId: 'shop_pay_weapon',
      shopGroupName: text('武器商店'),
      shopGroupType: 2,
      shopIds: ['shop_pay_weapon_gacha', 'shop_pay_weapon_weekly', 'shop_pay_weapon_daily']
    }
  },
  ShopTable: {
    shop_pay_weapon_gacha: {
      shopId: 'shop_pay_weapon_gacha',
      shopName: text('武器申领'),
      shopGoodsIds: ['goods_pool']
    },
    shop_pay_weapon_weekly: {
      shopId: 'shop_pay_weapon_weekly',
      shopName: text('周轮换'),
      shopGoodsIds: ROTATION_IDS.map((id) => `goods_${id}`)
    },
    shop_pay_weapon_daily: {
      shopId: 'shop_pay_weapon_daily',
      shopName: text('日轮换'),
      shopGoodsIds: ROTATION_IDS.map((id) => `goods_${id}`)
    }
  },
  ShopGoodsTable: {
    ...ROTATION_GOODS,
    goods_pool: {
      goodsId: 'goods_pool',
      rewardId: 'reward_wpn_sword_0021',
      moneyId: 'item_quota',
      price: 100,
      cnDiscount: 0.75,
      goodsTagId: 'featured',
      weaponGachaPoolId: 'pool_featured',
      lockDesc: text('完成武库试炼后解锁'),
      limitCount: 2,
      limitCountRefreshType: 4
    }
  },
  CashShopGroupTable: {
    cash_group: {
      shopGroupId: 'cash_group',
      shopGroupName: text('补给商店'),
      shopGroupType: 5,
      cashShopIds: ['monthly_shop', 'permanent_shop']
    }
  },
  CashShopTable: {
    monthly_shop: {
      cashShopId: 'monthly_shop',
      shopName: text('月度补给'),
      cashGoodsIds: ['cash_pack']
    },
    permanent_shop: {
      cashShopId: 'permanent_shop',
      shopName: text('常驻补给'),
      cashGoodsIds: ['cash_secondary']
    }
  },
  CashShopGoodsTable: {
    cash_pack: {
      cashGoodsId: 'cash_pack',
      goodsName: text('月度精选包'),
      iconId: 'cash_pack',
      rewardId: 'reward_cash',
      priceCNY: 30,
      priceUSD: 4.99,
      lockDesc: text('账号等级达到 5 级')
    },
    cash_secondary: {
      cashGoodsId: 'cash_secondary',
      goodsName: text('常驻免费包'),
      iconId: 'cash_secondary',
      rewardId: 'reward_secondary',
      priceCNY: 0,
      priceUSD: 0
    }
  },
  GiftpackCashShopGoodsDataTable: {
    cash_pack: { availCount: 1, availRefresh: 3, hideInGame: false, isFree: false },
    cash_secondary: { availCount: 0, availRefresh: 0, hideInGame: false, isFree: true }
  },
  CashShopRechargeTable: { cash_pack: { bonusRewardId: 'reward_bonus' } },
  CashShopHintTextTable: { cash_pack: { hintText: text('购买后立即发放') } },
  ShopMonthlyPassRewardTable: {
    cash_pack: { rewardId1: 'item_monthly', rewardCount1: 30 }
  },
  RewardTable: {
    ...Object.fromEntries(ROTATION_IDS.map((id) => [`reward_${id}`, { itemBundles: [{ id, count: 1 }] }])),
    reward_cash: { itemBundles: [{ id: 'item_diamond', count: 300 }] },
    reward_bonus: { itemBundles: [{ id: 'item_bonus', count: 50 }] },
    reward_secondary: { itemBundles: [{ id: 'item_quota', count: 5 }] }
  },
  ItemTable: {
    ...Object.fromEntries(
      ROTATION_IDS.map((id) => [id, { name: text(`轮换武器 ${id}`), iconId: `icon_${id}` }])
    ),
    item_quota: { name: text('武库配额'), iconId: 'quota' },
    item_diamond: { name: text('嵌晶玉'), iconId: 'diamond' },
    item_bonus: { name: text('首充加赠'), iconId: 'bonus' },
    item_monthly: { name: text('每日补给'), iconId: 'monthly' }
  },
  WeaponBasicTable: Object.fromEntries(
    ROTATION_IDS.map((id) => [id, { rarity: id === 'wpn_sword_0021' ? 6 : 5 }])
  ),
  ShopGoodsTagTable: { featured: { tagName: text('精选') } },
  GachaWeaponPoolTable: { pool_featured: { name: text('精选武器池') } },
  GachaWeaponPoolContentTable: {
    pool_featured: {
      list: [
        { itemId: 'wpn_sword_0021', randomWeight: 20, starLevel: 6 },
        { itemId: 'wpn_funnel_0004', randomWeight: 10, starLevel: 5 }
      ]
    }
  },
  ActivityShopAdditionalTable: {
    cash_activity: { shopGroupId: 'cash_group', activityId: 'activity_shop_fixture' }
  },
  ActivityTable: {
    activity_shop_fixture: {
      name: text('补给庆典'),
      timeId: 'time_shop_fixture'
    }
  },
  TimeRangeTable: {
    time_shop_fixture: {
      timeRangeList: [{ openTime: '2026/8/1 12:00:00', closeTime: '2026/8/31 12:00:00' }]
    }
  },
  ShopGroupDomainTable: { cash_group: { domainId: 'domain_fixture' } },
  DomainDataTable: {
    domain_fixture: { domainShopGroupId: 'cash_group', domainName: text('四号谷地') }
  },
  ShopChannelDevelopmentTable: {
    channel_fixture: {
      shopGroupId: 'cash_group',
      channelName: text('补给调度员'),
      levelId: 'channel_fixture'
    }
  },
  ShopGoodsTagCommonTable: {},
  CashShopHideInGameTable: {},
  CashShopRecommendTable: {}
}

interface MockState {
  unexpectedRequests: string[]
  imageRequests: string[]
}

async function installShopFixture(page: Page): Promise<MockState> {
  const state: MockState = { unexpectedRequests: [], imageRequests: [] }
  await page.addInitScript((now) => {
    Date.now = () => now
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'CH', theme: 'light', showHidden: true })
    )
  }, FROZEN_NOW)

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === APP_ORIGIN) {
      await route.continue()
      return
    }
    if (url.origin !== DATA_ORIGIN) {
      state.unexpectedRequests.push(url.href)
      await route.abort('blockedbyclient')
      return
    }
    if (url.pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (url.pathname.startsWith('/public/images/')) {
      state.imageRequests.push(url.href)
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#18838c"/></svg>'
      })
      return
    }
    const tableName = url.pathname.match(/\/([^/]+)\.json$/)?.[1] ?? ''
    if (tableName === 'I18nTextTable_CN') {
      await route.fulfill({ json: {} })
      return
    }
    if (tableName in TABLES) {
      await route.fulfill({ json: TABLES[tableName] })
      return
    }
    await route.fulfill({ json: {} })
  })
  return state
}

test('desktop shop restores the directory, detail products, and complete weapon rotation', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop layout contract runs once.')
  const state = await installShopFixture(page)

  await page.goto('/module/v3_shop')
  await expect(page.getByRole('heading', { name: '武器商店' })).toBeVisible()
  expect(new URL(page.url()).searchParams.has('id')).toBe(false)
  expect(await page.locator('main').count()).toBe(1)
  await expect
    .poll(async () => Math.round((await page.locator('.shop-sidebar').boundingBox())?.width ?? 0))
    .toBe(282)

  await expect(page.locator('[data-shop-rotation-block="weekly-current"]')).toBeVisible()
  await expect(page.locator('[data-shop-rotation-block="weekly-next"]')).toBeVisible()
  await expect(page.locator('[data-shop-rotation-block="daily-current"]')).toBeVisible()
  await expect(page.locator('[data-shop-rotation-block="daily-next"]')).toBeVisible()
  await expect(page.locator('[data-shop-countdown="weekly"]')).toHaveText(/^\d{2}:\d{2}:\d{2}:\d{2}$/)
  await expect(page.locator('[data-shop-countdown="daily"]')).toHaveText(/^\d{2}:\d{2}:\d{2}:\d{2}$/)
  await expect(page.locator('.shop-rotation-table tbody tr')).toHaveCount(32)
  await expect(page.locator('.shop-rotation-table thead')).toContainText('周日')

  await page.getByRole('tab', { name: /武器申领/ }).click()
  const poolProduct = page.locator('[data-product-id="goods_pool"]')
  await expect(poolProduct).toContainText('75')
  await expect(poolProduct).toContainText('精选武器池')
  await expect(poolProduct).toContainText('完成武库试炼后解锁')
  await expect(poolProduct).toContainText('限购 2')

  await page.locator('.shop-sidebar [data-group-id="cash_group"]').click()
  await expect(page).toHaveURL(/\/module\/v3_shop\?id=cash_group$/)
  await expect(page.getByRole('heading', { name: '补给商店' })).toBeVisible()
  expect(
    await page
      .locator('[data-shop-detail-block]')
      .evaluateAll((elements) =>
        elements
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .map((element) => element.getAttribute('data-shop-detail-block'))
      )
  ).toEqual(['group-header', 'context', 'tabs', 'active-shop'])
  await expect(page.locator('.shop-context')).toContainText('补给庆典')
  await expect(page.locator('.shop-context')).toContainText('四号谷地')
  await expect(page.locator('.shop-context')).toContainText('补给调度员')

  const cashProduct = page.locator('[data-product-id="cash_pack"]')
  await expect(cashProduct).toContainText('¥30')
  await expect(cashProduct).toContainText('$4.99')
  await expect(cashProduct).toContainText('嵌晶玉')
  await expect(cashProduct).toContainText('充值加赠')
  await expect(cashProduct).toContainText('周期奖励')
  await expect(cashProduct).toContainText('购买后立即发放')
  await expect(cashProduct).toContainText('账号等级达到 5 级')
  await expect(cashProduct).toContainText('每月刷新')
  expect(state.imageRequests.length).toBeGreaterThan(0)
  expect(state.unexpectedRequests).toEqual([])

  await page.goto('/module/v3_shop?id=cash_group')
  await expect(page.getByRole('heading', { name: '补给商店' })).toBeVisible()
})

test('mobile shop uses ResponsiveDrawer and writes query.id only after selection', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile drawer contract runs once.')
  const state = await installShopFixture(page)

  await page.goto('/module/v3_shop')
  await expect(page.locator('.shop-sidebar')).toBeHidden()
  expect(new URL(page.url()).searchParams.has('id')).toBe(false)
  const trigger = page.locator('.shop-mobile-button')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.ake-drawer [data-group-id="cash_group"]').click()

  await expect(page).toHaveURL(/\/module\/v3_shop\?id=cash_group$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '补给商店' })).toBeVisible()
  expect(await page.locator('main').count()).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(state.unexpectedRequests).toEqual([])
})
