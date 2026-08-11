import { describe, expect, it } from 'vitest'
import type { TableSet } from '@ake/domain'
import {
  DAILY_ROTATION,
  DAY_MS,
  ROTATION_START,
  WEEKLY_SIX_STAR,
  buildShopCatalog,
  buildShopRotationSchedule,
  filterShopGroup,
  filterShopGroups,
  formatShopCountdown,
  nextDailyRefresh,
  nextWeeklyRefresh,
  shopRotationState
} from './index'

function text(value: string) {
  return { id: value, text: value }
}

function fixture(): TableSet {
  const rotationIds = new Set([
    ...WEEKLY_SIX_STAR.slice(0, 2),
    'wpn_funnel_0004',
    'wpn_sword_0019',
    ...DAILY_ROTATION[0],
    ...DAILY_ROTATION[1]
  ])
  const rotationGoods = Object.fromEntries(
    [...rotationIds].map((id) => [
      `goods_${id}`,
      {
        goodsId: `goods_${id}`,
        rewardId: `reward_${id}`,
        moneyId: 'item_coin',
        price: 10,
        cnDiscount: 1,
        limitCount: 1,
        limitCountRefreshType: 2
      }
    ])
  )
  const rotationRewards = Object.fromEntries(
    [...rotationIds].map((id) => [`reward_${id}`, { itemBundles: [{ id, count: 1 }] }])
  )
  const rotationItems = Object.fromEntries(
    [...rotationIds].map((id) => [id, { name: text(`Weapon ${id}`), iconId: `icon_${id}` }])
  )
  const rotationWeapons = Object.fromEntries(
    [...rotationIds].map((id) => [id, { rarity: id === WEEKLY_SIX_STAR[0] ? 6 : 5 }])
  )
  return {
    ShopGroupTable: {
      cash_group: {
        shopGroupId: 'cash_group',
        shopGroupName: text('Cash group'),
        shopGroupType: 5
      },
      shop_pay_weapon: {
        shopGroupId: 'shop_pay_weapon',
        shopGroupName: text('Weapon group'),
        shopGroupType: 2,
        shopIds: ['shop_pay_weapon_gacha', 'shop_pay_weapon_weekly', 'shop_pay_weapon_daily']
      }
    },
    CashShopGroupTable: {
      cash_group: {
        shopGroupId: 'cash_group',
        shopGroupName: text('Cash group'),
        shopGroupType: 5,
        cashShopIds: ['cash_shop']
      }
    },
    ShopTable: {
      shop_pay_weapon_gacha: {
        shopId: 'shop_pay_weapon_gacha',
        shopName: text('Weapon claim'),
        shopGoodsIds: ['goods_pool']
      },
      shop_pay_weapon_weekly: {
        shopId: 'shop_pay_weapon_weekly',
        shopName: text('Weekly'),
        shopGoodsIds: [...rotationIds].map((id) => `goods_${id}`)
      },
      shop_pay_weapon_daily: {
        shopId: 'shop_pay_weapon_daily',
        shopName: text('Daily'),
        shopGoodsIds: [...rotationIds].map((id) => `goods_${id}`)
      }
    },
    ShopGoodsTable: {
      ...rotationGoods,
      goods_pool: {
        goodsId: 'goods_pool',
        rewardId: 'reward_pool',
        moneyId: 'item_coin',
        price: 100,
        cnDiscount: 0.75,
        goodsTagId: 'featured',
        weaponGachaPoolId: 'pool_featured',
        lockDesc: text('Complete the trial'),
        limitCount: 2,
        limitCountRefreshType: 4
      }
    },
    CashShopTable: {
      cash_shop: { cashShopId: 'cash_shop', shopName: text('Gift packs'), cashGoodsIds: ['cash_hidden'] }
    },
    CashShopGoodsTable: {
      cash_hidden: {
        cashGoodsId: 'cash_hidden',
        goodsName: text('Monthly pack'),
        iconId: 'cash_pack',
        rewardId: 'reward_cash',
        priceCNY: 30,
        priceUSD: 4.99,
        lockDesc: text('Account level 5')
      }
    },
    GiftpackCashShopGoodsDataTable: {
      cash_hidden: { hideInGame: true, availCount: 1, availRefresh: 3 }
    },
    CashShopHideInGameTable: { cash_hidden: { hideInGame: true } },
    CashShopRechargeTable: { cash_hidden: { bonusRewardId: 'reward_bonus' } },
    CashShopHintTextTable: { cash_hidden: { hintText: text('Delivered immediately') } },
    ShopMonthlyPassRewardTable: {
      cash_hidden: { rewardId1: 'item_monthly', rewardCount1: 30 }
    },
    RewardTable: {
      ...rotationRewards,
      reward_pool: { itemBundles: [{ id: 'wpn_sword_0021', count: 1 }] },
      reward_cash: { itemBundles: [{ id: 'item_diamond', count: 300 }] },
      reward_bonus: { itemBundles: [{ id: 'item_bonus', count: 50 }] }
    },
    ItemTable: {
      ...rotationItems,
      item_coin: { name: text('Quota'), iconId: 'coin' },
      item_diamond: { name: text('Diamond'), iconId: 'diamond' },
      item_bonus: { name: text('Bonus'), iconId: 'bonus' },
      item_monthly: { name: text('Daily ration'), iconId: 'ration' }
    },
    WeaponBasicTable: rotationWeapons,
    ShopGoodsTagTable: { featured: { tagName: text('Featured') } },
    GachaWeaponPoolTable: { pool_featured: { name: text('Featured pool') } },
    GachaWeaponPoolContentTable: {
      pool_featured: {
        list: [
          { itemId: 'wpn_sword_0021', randomWeight: 20, starLevel: 6 },
          { itemId: 'wpn_funnel_0004', randomWeight: 10, starLevel: 5 }
        ]
      }
    },
    ActivityShopAdditionalTable: { cash_activity: { shopGroupId: 'cash_group', activityId: 'activity_1' } },
    ActivityTable: { activity_1: { name: text('Launch event'), timeId: 'time_1' } },
    TimeRangeTable: {
      time_1: { timeRangeList: [{ openTime: '2026/8/1 12:00:00', closeTime: '2026/8/31 12:00:00' }] }
    },
    ShopGroupDomainTable: { cash_group: { domainId: 'domain_1' } },
    DomainDataTable: {
      domain_1: { domainShopGroupId: 'cash_group', domainName: text('Valley IV') }
    },
    ShopChannelDevelopmentTable: {
      channel_1: { shopGroupId: 'cash_group', channelName: text('Quartermaster'), levelId: 'channel_1' }
    }
  }
}

describe('shop catalog model', () => {
  it('restores legacy group/shop/product joins and hides protected cash goods by default', () => {
    const now = ROTATION_START + 12 * 60 * 60 * 1_000
    const catalog = buildShopCatalog(fixture(), { now })

    expect(catalog.groups[0]?.id).toBe('shop_pay_weapon')
    const weapon = catalog.groups[0]
    expect(weapon?.shops.map((shop) => shop.kind)).toEqual(['rotation', 'normal', 'normal', 'normal'])
    const product = weapon?.shops.find((shop) => shop.id === 'shop_pay_weapon_gacha')?.products[0]
    expect(product).toMatchObject({
      id: 'goods_pool',
      price: { current: 75, original: 100, discountPercent: 25, currencyName: 'Quota' },
      limitCount: 2,
      refreshType: 4,
      lockText: 'Complete the trial',
      tags: ['Featured'],
      pool: { name: 'Featured pool' }
    })
    expect(product?.rewards[0]).toMatchObject({ id: 'wpn_sword_0021', count: 1 })
    expect(catalog.groups.find((group) => group.id === 'cash_group')?.productCount).toBe(0)
  })

  it('restores hidden cash pricing, bonus, recurring rewards, hints, locks, and context when authorized', () => {
    const catalog = buildShopCatalog(fixture(), { showHidden: true })
    const group = catalog.groups.find((value) => value.id === 'cash_group')
    const product = group?.shops[0]?.products[0]

    expect(product).toMatchObject({
      id: 'cash_hidden',
      hidden: true,
      price: { kind: 'cash', cny: 30, usd: 4.99 },
      hint: 'Delivered immediately',
      lockText: 'Account level 5',
      limitCount: 1,
      refreshType: 3
    })
    expect(product?.rewards[0]).toMatchObject({ id: 'item_diamond', count: 300 })
    expect(product?.bonusRewards[0]).toMatchObject({ id: 'item_bonus', count: 50 })
    expect(product?.monthlyRewards[0]).toMatchObject({ id: 'item_monthly', count: 30 })
    expect(group?.context.map((row) => row.kind)).toEqual(['activity', 'openTime', 'domain', 'channels'])
  })

  it('searches group, shop, and product text while retaining the legacy detail filtering rules', () => {
    const catalog = buildShopCatalog(fixture(), { showHidden: true })
    expect(filterShopGroups(catalog.groups, 'monthly pack').map((group) => group.id)).toEqual(['cash_group'])
    const group = catalog.groups.find((value) => value.id === 'cash_group')!
    expect(filterShopGroup(group, 'diamond').shops[0]?.products.map((product) => product.id)).toEqual([
      'cash_hidden'
    ])
    expect(filterShopGroup(group, 'does-not-exist').shops).toEqual([])
  })
})

describe('weapon rotation model', () => {
  it('selects current and next daily/weekly batches from the legacy epoch', () => {
    const now = ROTATION_START + 12 * 60 * 60 * 1_000
    expect(shopRotationState(now)).toMatchObject({
      dayIndex: 0,
      weekIndex: 0,
      dailyIndex: 0,
      weeklyIds: [WEEKLY_SIX_STAR[0], 'wpn_funnel_0004'],
      dailyIds: DAILY_ROTATION[0]
    })
    const rotation = buildShopCatalog(fixture(), { now }).groups[0]?.shops[0]?.rotation
    expect(rotation?.nextWeekly.map((product) => product.rewards[0]?.id)).toEqual([
      WEEKLY_SIX_STAR[1],
      'wpn_sword_0019'
    ])
    expect(rotation?.nextDaily.map((product) => product.rewards[0]?.id)).toEqual(DAILY_ROTATION[1])
  })

  it('builds all 32 weeks with seven day columns including Sunday', () => {
    const catalog = buildShopCatalog(fixture())
    const rows = buildShopRotationSchedule(catalog.weapons, ROTATION_START + 12 * 60 * 60 * 1_000)

    expect(rows).toHaveLength(32)
    expect(rows[0]?.days).toHaveLength(7)
    expect(rows[0]?.days[3]?.map((weapon) => weapon.id)).toEqual(DAILY_ROTATION[3])
    expect(rows[0]).toMatchObject({ active: true, activeDay: 0 })
    expect(rows[1]?.start).toBe(ROTATION_START + 7 * DAY_MS)
  })

  it('uses 04:00 China daily and Thursday noon China weekly refresh boundaries', () => {
    const dailyNow = Date.parse('2026-08-10T19:59:59.000Z')
    const weeklyNow = Date.parse('2026-08-13T03:59:59.000Z')

    expect(nextDailyRefresh(dailyNow) - dailyNow).toBe(1_000)
    expect(nextWeeklyRefresh(weeklyNow) - weeklyNow).toBe(1_000)
    expect(formatShopCountdown(DAY_MS + 2 * 3_600_000 + 3 * 60_000 + 4_000)).toBe('01:02:03:04')
  })
})
