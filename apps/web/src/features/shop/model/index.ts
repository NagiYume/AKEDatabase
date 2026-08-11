import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'

export const SHOP_TABLES = [
  'ShopGroupTable',
  'ShopTable',
  'ShopGoodsTable',
  'RewardTable',
  'ItemTable',
  'ShopGoodsTagTable',
  'ShopGoodsTagCommonTable',
  'ShopGroupDomainTable',
  'ShopChannelDevelopmentTable',
  'DomainDataTable',
  'ActivityShopAdditionalTable',
  'ActivityTable',
  'TimeRangeTable',
  'CashShopGroupTable',
  'CashShopTable',
  'CashShopGoodsTable',
  'GiftpackCashShopGoodsDataTable',
  'CashShopHideInGameTable',
  'CashShopRechargeTable',
  'CashShopHintTextTable',
  'CashShopRecommendTable',
  'ShopMonthlyPassRewardTable',
  'GachaWeaponPoolTable',
  'GachaWeaponPoolContentTable',
  'WeaponBasicTable'
] as const

export const ROTATION_START = Date.parse('2026-01-22T00:00:00+08:00')
export const DAY_MS = 24 * 60 * 60 * 1_000
const DAILY_REFRESH_OFFSET = 4 * 60 * 60 * 1_000
const WEEKLY_REFRESH_OFFSET = 12 * 60 * 60 * 1_000

export const WEEKLY_SIX_STAR = [
  'wpn_sword_0021',
  'wpn_funnel_0009',
  'wpn_lance_0010',
  'wpn_pistol_0009',
  'wpn_funnel_0008',
  'wpn_claym_0006',
  'wpn_sword_0013',
  'wpn_funnel_0009',
  'wpn_sword_0011',
  'wpn_pistol_0009',
  'wpn_lance_0010',
  'wpn_claym_0004',
  'wpn_claym_0008',
  'wpn_funnel_0009',
  'wpn_lance_0011',
  'wpn_pistol_0009',
  'wpn_funnel_0010',
  'wpn_lance_0010',
  'wpn_sword_0014',
  'wpn_funnel_0008',
  'wpn_pistol_0008',
  'wpn_lance_0011',
  'wpn_sword_0013',
  'wpn_claym_0006',
  'wpn_funnel_0009',
  'wpn_funnel_0008',
  'wpn_lance_0011',
  'wpn_claym_0008',
  'wpn_sword_0012',
  'wpn_lance_0010',
  'wpn_pistol_0009',
  'wpn_sword_0011'
] as const

export const WEEKLY_FIVE_STAR = [
  'wpn_funnel_0004',
  'wpn_sword_0019',
  'wpn_pistol_0012',
  'wpn_funnel_0014',
  'wpn_sword_0018',
  'wpn_sword_0020',
  'wpn_lance_0013',
  'wpn_pistol_0006',
  'wpn_funnel_0012',
  'wpn_funnel_0005',
  'wpn_sword_0005',
  'wpn_lance_0004',
  'wpn_funnel_0004',
  'wpn_claym_0011',
  'wpn_funnel_0014',
  'wpn_sword_0018',
  'wpn_pistol_0004',
  'wpn_sword_0007',
  'wpn_lance_0006',
  'wpn_claym_0012',
  'wpn_sword_0019',
  'wpn_claym_0015',
  'wpn_lance_0013',
  'wpn_funnel_0012',
  'wpn_lance_0004',
  'wpn_sword_0005',
  'wpn_pistol_0006',
  'wpn_funnel_0004',
  'wpn_claym_0014',
  'wpn_funnel_0007',
  'wpn_lance_0006',
  'wpn_lance_0013'
] as const

export const DAILY_ROTATION = [
  ['wpn_claym_0011', 'wpn_pistol_0004'],
  ['wpn_sword_0007', 'wpn_pistol_0006'],
  ['wpn_claym_0014', 'wpn_sword_0018'],
  ['wpn_funnel_0014', 'wpn_lance_0006'],
  ['wpn_funnel_0004', 'wpn_sword_0020'],
  ['wpn_lance_0004', 'wpn_sword_0018'],
  ['wpn_funnel_0005', 'wpn_pistol_0012'],
  ['wpn_sword_0005', 'wpn_claym_0015'],
  ['wpn_pistol_0012', 'wpn_sword_0020'],
  ['wpn_funnel_0005', 'wpn_claym_0012'],
  ['wpn_sword_0007', 'wpn_lance_0013'],
  ['wpn_claym_0011', 'wpn_lance_0006'],
  ['wpn_sword_0005', 'wpn_funnel_0012'],
  ['wpn_funnel_0007', 'wpn_claym_0014'],
  ['wpn_funnel_0007', 'wpn_sword_0015'],
  ['wpn_lance_0004', 'wpn_sword_0015'],
  ['wpn_pistol_0004', 'wpn_claym_0012'],
  ['wpn_funnel_0004', 'wpn_sword_0019'],
  ['wpn_funnel_0014', 'wpn_claym_0015'],
  ['wpn_pistol_0006', 'wpn_lance_0013'],
  ['wpn_funnel_0012', 'wpn_sword_0019']
] as const

export interface ShopReward {
  id: string
  name: string
  count: number
  iconId: string
}

export interface ShopPoolItem {
  id: string
  name: string
  iconId: string
  rarity: number
  weight: number
}

export interface ShopPoolGroup {
  rarity: number
  items: ShopPoolItem[]
}

export interface ShopPool {
  id: string
  name: string
  groups: ShopPoolGroup[]
}

export interface ShopPrice {
  kind: 'normal' | 'cash' | 'free'
  current: number
  original: number
  discountPercent: number
  currencyId: string
  currencyName: string
  currencyIconId: string
  cny: number
  usd: number
}

export interface ShopProduct {
  id: string
  kind: 'normal' | 'cash'
  name: string
  iconId: string
  rarity: number
  tags: string[]
  price: ShopPrice
  rewards: ShopReward[]
  bonusRewards: ShopReward[]
  monthlyRewards: ShopReward[]
  pool: ShopPool | null
  hint: string
  lockText: string
  hidden: boolean
  limitCount: number
  refreshType: number
  searchText: string
}

export interface ShopRotationState {
  dayIndex: number
  weekIndex: number
  dailyIndex: number
  dailyIds: string[]
  weeklyIds: string[]
}

export interface ShopView {
  id: string
  name: string
  kind: 'normal' | 'cash' | 'recommendation' | 'rotation'
  products: ShopProduct[]
  ownSearchText: string
  rotation?: {
    state: ShopRotationState
    weekly: ShopProduct[]
    nextWeekly: ShopProduct[]
    daily: ShopProduct[]
    nextDaily: ShopProduct[]
  }
}

export type ShopContext =
  | { kind: 'activity' | 'domain' | 'channels'; value: string }
  | { kind: 'openTime'; openTime: string; closeTime: string }

export interface ShopGroup {
  id: string
  name: string
  type: number
  kind: 'normal' | 'cash' | 'recommendation'
  sourceOrder: number
  context: ShopContext[]
  shops: ShopView[]
  productCount: number
  ownSearchText: string
  searchText: string
}

export interface ShopWeapon {
  id: string
  name: string
  iconId: string
  rarity: number
}

export interface ShopCatalog {
  groups: ShopGroup[]
  weapons: Record<string, ShopWeapon>
}

export interface ShopRotationScheduleRow {
  index: number
  start: number
  end: number
  weeklySix: ShopWeapon
  weeklyFive: ShopWeapon
  days: ShopWeapon[][]
  active: boolean
  activeDay: number
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).map(String) : []
}

function plainGameText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:b|i|u)>/gi, '')
    .replace(/<color=[^>]+>|<\/color>/gi, '')
    .trim()
}

function tableRows(table: Record<string, unknown> | undefined): Array<[string, RawRecord]> {
  return Object.entries(table ?? {}).map(([id, value]) => [id, asRecord(value)])
}

function itemInfo(tables: TableSet, itemId: string): ShopWeapon {
  const item = asRecord(tables.ItemTable?.[itemId])
  const weapon = asRecord(tables.WeaponBasicTable?.[itemId])
  return {
    id: itemId,
    name: plainGameText(item.name, itemId),
    iconId: stringValue(item.iconId, itemId),
    rarity: numberValue(weapon.rarity, numberValue(item.rarity))
  }
}

function resolveReward(tables: TableSet, rewardId: string): ShopReward[] {
  const reward = asRecord(tables.RewardTable?.[rewardId])
  if (!Array.isArray(reward.itemBundles)) return []
  return reward.itemBundles.map((value) => {
    const bundle = asRecord(value)
    const id = stringValue(bundle.id)
    const item = itemInfo(tables, id)
    return { id, name: item.name, count: numberValue(bundle.count), iconId: item.iconId }
  })
}

function directRewards(tables: TableSet, row: RawRecord): ShopReward[] {
  return [1, 2, 3].flatMap((index) => {
    const id = stringValue(row[`rewardId${index}`])
    if (!id) return []
    const item = itemInfo(tables, id)
    return [{ id, name: item.name, count: numberValue(row[`rewardCount${index}`]), iconId: item.iconId }]
  })
}

function buildPool(tables: TableSet, poolId: string): ShopPool | null {
  if (!poolId) return null
  const pool = asRecord(tables.GachaWeaponPoolTable?.[poolId])
  const content = asRecord(tables.GachaWeaponPoolContentTable?.[poolId])
  if (!Array.isArray(content.list) || content.list.length === 0) return null
  const grouped = new Map<number, ShopPoolItem[]>()
  for (const value of content.list) {
    const entry = asRecord(value)
    const id = stringValue(entry.itemId)
    if (!id) continue
    const item = itemInfo(tables, id)
    const rarity = numberValue(entry.starLevel, item.rarity)
    const list = grouped.get(rarity) ?? []
    list.push({ ...item, rarity, weight: numberValue(entry.randomWeight) })
    grouped.set(rarity, list)
  }
  return {
    id: poolId,
    name: plainGameText(pool.name, poolId),
    groups: [...grouped.entries()]
      .toSorted(([left], [right]) => right - left)
      .map(([rarity, items]) => ({ rarity, items }))
  }
}

function poolIcon(pool: ShopPool | null): string {
  const sixStar = pool?.groups.find((group) => group.rarity === 6)?.items
  return sixStar?.toSorted((left, right) => right.weight - left.weight)[0]?.iconId ?? ''
}

function rewardSearchText(rewards: readonly ShopReward[]): string {
  return rewards.map((reward) => `${reward.id} ${reward.name}`).join(' ')
}

function normalProduct(tables: TableSet, goodsId: string, recommendation = ''): ShopProduct | null {
  const goods = asRecord(tables.ShopGoodsTable?.[goodsId])
  if (!Object.keys(goods).length) return null
  const rewards = resolveReward(tables, stringValue(goods.rewardId))
  const pool = buildPool(tables, stringValue(goods.weaponGachaPoolId))
  const currencyId = stringValue(goods.moneyId)
  const currency = itemInfo(tables, currencyId)
  const tagId = stringValue(goods.goodsTagId)
  const tag = asRecord(tables.ShopGoodsTagTable?.[tagId] ?? tables.ShopGoodsTagCommonTable?.[tagId])
  const discount = numberValue(goods.cnDiscount, 1)
  let current = numberValue(goods.price)
  let original = numberValue(goods.randomGoodsStandardPrice)
  if (original <= 0 && discount > 0 && discount < 1) {
    original = current
    current = Math.ceil(current * discount)
  }
  const name = rewards.length
    ? rewards.map((reward) => reward.name).join(' + ')
    : plainGameText(
        asRecord(tables.GachaWeaponPoolTable?.[stringValue(goods.weaponGachaPoolId)]).name,
        goodsId
      )
  const tags = [plainGameText(tag.tagName), recommendation].filter(Boolean)
  return {
    id: stringValue(goods.goodsId, goodsId),
    kind: 'normal',
    name,
    iconId: poolIcon(pool) || rewards[0]?.iconId || '',
    rarity: 0,
    tags,
    price: {
      kind: 'normal',
      current,
      original: original > 0 ? original : 0,
      discountPercent: discount < 1 ? Math.round((1 - discount) * 100) : 0,
      currencyId,
      currencyName: currency.name,
      currencyIconId: currency.iconId,
      cny: 0,
      usd: 0
    },
    rewards,
    bonusRewards: [],
    monthlyRewards: [],
    pool,
    hint: '',
    lockText: plainGameText(goods.lockDesc),
    hidden: false,
    limitCount: numberValue(goods.limitCount),
    refreshType: numberValue(goods.limitCountRefreshType),
    searchText: [goodsId, name, currencyId, currency.name, rewardSearchText(rewards), recommendation]
      .join(' ')
      .toLocaleLowerCase()
  }
}

function cashProduct(tables: TableSet, goodsId: string, recommendation = ''): ShopProduct | null {
  const goods = asRecord(tables.CashShopGoodsTable?.[goodsId])
  if (!Object.keys(goods).length) return null
  const meta = asRecord(tables.GiftpackCashShopGoodsDataTable?.[goodsId])
  const hiddenRow = asRecord(tables.CashShopHideInGameTable?.[goodsId])
  const recharge = asRecord(tables.CashShopRechargeTable?.[goodsId])
  const monthly = asRecord(tables.ShopMonthlyPassRewardTable?.[goodsId])
  const rewards = resolveReward(tables, stringValue(goods.rewardId))
  const bonusRewards = resolveReward(tables, stringValue(recharge.bonusRewardId))
  const monthlyRewards = directRewards(tables, monthly)
  const cny = numberValue(goods.priceCNY)
  const usd = numberValue(goods.priceUSD)
  const free = meta.isFree === true || (cny <= 0 && usd <= 0)
  const name = plainGameText(goods.goodsName, goodsId)
  return {
    id: stringValue(goods.cashGoodsId, goodsId),
    kind: 'cash',
    name,
    iconId: rewards[0]?.iconId || stringValue(goods.iconId),
    rarity: 0,
    tags: recommendation ? [recommendation] : [],
    price: {
      kind: free ? 'free' : 'cash',
      current: 0,
      original: 0,
      discountPercent: 0,
      currencyId: '',
      currencyName: '',
      currencyIconId: '',
      cny,
      usd
    },
    rewards,
    bonusRewards,
    monthlyRewards,
    pool: null,
    hint: plainGameText(asRecord(tables.CashShopHintTextTable?.[goodsId]).hintText),
    lockText: plainGameText(goods.lockDesc),
    hidden: meta.hideInGame === true || hiddenRow.hideInGame === true,
    limitCount: numberValue(meta.availCount),
    refreshType: numberValue(meta.availRefresh),
    searchText: [goodsId, name, rewardSearchText(rewards), recommendation].join(' ').toLocaleLowerCase()
  }
}

export function shopRotationState(now = Date.now()): ShopRotationState {
  const dayIndex = Math.floor((now - DAILY_REFRESH_OFFSET - ROTATION_START) / DAY_MS)
  const weekIndex = Math.floor((now - WEEKLY_REFRESH_OFFSET - ROTATION_START) / (7 * DAY_MS))
  const dailyIndex = dayIndex >= 0 ? dayIndex % DAILY_ROTATION.length : -1
  const weeklyIds =
    weekIndex >= 0 && weekIndex < WEEKLY_SIX_STAR.length
      ? [WEEKLY_SIX_STAR[weekIndex] ?? '', WEEKLY_FIVE_STAR[weekIndex] ?? ''].filter(Boolean)
      : []
  const dailyIds = dailyIndex >= 0 ? [...(DAILY_ROTATION[dailyIndex] ?? [])] : []
  return { dayIndex, weekIndex, dailyIndex, weeklyIds, dailyIds }
}

export function nextDailyRefresh(now = Date.now()): number {
  const date = new Date(now)
  const refresh = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1, 20)
  return now >= refresh ? refresh + DAY_MS : refresh
}

export function nextWeeklyRefresh(now = Date.now()): number {
  const date = new Date(now)
  let refresh = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 4)
  while (new Date(refresh).getUTCDay() !== 4) refresh += DAY_MS
  if (now >= refresh) refresh += 7 * DAY_MS
  return refresh
}

export function formatShopCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60
  return [days, hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':')
}

function rotationProduct(
  tables: TableSet,
  normalProducts: ReadonlyMap<string, ShopProduct>,
  shopId: string,
  weaponId: string
): ShopProduct | null {
  const shop = asRecord(tables.ShopTable?.[shopId])
  for (const goodsId of stringList(shop.shopGoodsIds)) {
    const product = normalProducts.get(goodsId)
    if (!product?.rewards.some((reward) => reward.id === weaponId)) continue
    return { ...product, rarity: numberValue(asRecord(tables.WeaponBasicTable?.[weaponId]).rarity) }
  }
  return null
}

function rotationProducts(
  tables: TableSet,
  products: ReadonlyMap<string, ShopProduct>,
  shopId: string,
  ids: readonly string[]
): ShopProduct[] {
  return ids.flatMap((id) => {
    const product = rotationProduct(tables, products, shopId, id)
    return product ? [product] : []
  })
}

function buildRotationShop(
  tables: TableSet,
  products: ReadonlyMap<string, ShopProduct>,
  now: number
): ShopView {
  const state = shopRotationState(now)
  const nextWeek = state.weekIndex + 1
  const nextWeeklyIds =
    nextWeek >= 0 && nextWeek < WEEKLY_SIX_STAR.length
      ? [WEEKLY_SIX_STAR[nextWeek] ?? '', WEEKLY_FIVE_STAR[nextWeek] ?? ''].filter(Boolean)
      : []
  const nextDailyIndex =
    state.dailyIndex < 0 ? 0 : (state.dailyIndex + 1 + DAILY_ROTATION.length) % DAILY_ROTATION.length
  const weekly = rotationProducts(tables, products, 'shop_pay_weapon_weekly', state.weeklyIds)
  const daily = rotationProducts(tables, products, 'shop_pay_weapon_daily', state.dailyIds)
  return {
    id: 'shop_pay_weapon_rotation',
    name: 'shop_pay_weapon_rotation',
    kind: 'rotation',
    products: [...weekly, ...daily],
    ownSearchText: 'shop_pay_weapon_rotation weapon rotation',
    rotation: {
      state,
      weekly,
      nextWeekly: rotationProducts(tables, products, 'shop_pay_weapon_weekly', nextWeeklyIds),
      daily,
      nextDaily: rotationProducts(
        tables,
        products,
        'shop_pay_weapon_daily',
        DAILY_ROTATION[nextDailyIndex] ?? []
      )
    }
  }
}

function buildContext(tables: TableSet, groupId: string): ShopContext[] {
  const context: ShopContext[] = []
  const additional = tableRows(tables.ActivityShopAdditionalTable).find(
    ([, row]) => stringValue(row.shopGroupId) === groupId
  )?.[1]
  if (additional) {
    const activityId = stringValue(additional.activityId)
    const activity = asRecord(tables.ActivityTable?.[activityId])
    context.push({ kind: 'activity', value: plainGameText(activity.name, activityId) })
    const time = asRecord(tables.TimeRangeTable?.[stringValue(activity.timeId)])
    const range = Array.isArray(time.timeRangeList) ? asRecord(time.timeRangeList[0]) : {}
    if (range.openTime || range.closeTime) {
      context.push({
        kind: 'openTime',
        openTime: stringValue(range.openTime),
        closeTime: stringValue(range.closeTime)
      })
    }
  }
  const domain = asRecord(tables.ShopGroupDomainTable?.[groupId])
  if (Object.keys(domain).length) {
    const domainRow = tableRows(tables.DomainDataTable).find(
      ([, row]) => stringValue(row.domainShopGroupId) === groupId
    )?.[1]
    context.push({
      kind: 'domain',
      value: plainGameText(domainRow?.domainName, stringValue(domain.domainId))
    })
  }
  const channels = tableRows(tables.ShopChannelDevelopmentTable)
    .filter(([, row]) => stringValue(row.shopGroupId) === groupId)
    .map(([, row]) => plainGameText(row.channelName, stringValue(row.levelId)))
    .filter(Boolean)
  if (channels.length) context.push({ kind: 'channels', value: channels.join('、') })
  return context
}

function productAllowed(product: ShopProduct | null, showHidden: boolean): product is ShopProduct {
  return Boolean(product && (showHidden || !product.hidden))
}

export function buildShopCatalog(
  tables: TableSet,
  options: { showHidden?: boolean; now?: number } = {}
): ShopCatalog {
  const showHidden = options.showHidden === true
  const normalProducts = new Map(
    tableRows(tables.ShopGoodsTable).flatMap(([id]) => {
      const product = normalProduct(tables, id)
      return product ? [[id, product] as const] : []
    })
  )
  const cashProducts = new Map(
    tableRows(tables.CashShopGoodsTable).flatMap(([id]) => {
      const product = cashProduct(tables, id)
      return product ? [[id, product] as const] : []
    })
  )
  const sourceGroups = new Map<string, RawRecord>()
  for (const [id, row] of tableRows(tables.ShopGroupTable)) sourceGroups.set(id, row)
  for (const [id, row] of tableRows(tables.CashShopGroupTable)) {
    if (!sourceGroups.has(id)) sourceGroups.set(id, row)
  }
  if (tableRows(tables.CashShopRecommendTable).length && !sourceGroups.has('shop_pay_recommend')) {
    sourceGroups.set('shop_pay_recommend', {
      shopGroupId: 'shop_pay_recommend',
      shopGroupName: 'shop_pay_recommend',
      shopGroupType: 5
    })
  }

  const groups = [...sourceGroups.entries()].map(([sourceId, row], sourceOrder): ShopGroup => {
    const id = stringValue(row.shopGroupId, sourceId)
    const cashGroup = asRecord(tables.CashShopGroupTable?.[id])
    const kind: ShopGroup['kind'] =
      id === 'shop_pay_recommend' ? 'recommendation' : Object.keys(cashGroup).length ? 'cash' : 'normal'
    let shops: ShopView[]
    if (kind === 'recommendation') {
      const products = tableRows(tables.CashShopRecommendTable)
        .toSorted(([, left], [, right]) => numberValue(left.priority) - numberValue(right.priority))
        .flatMap(([recommendationId, recommendation]) => {
          const label = plainGameText(recommendation.name, recommendationId)
          const ids = stringList(recommendation.cashGoodsIdList)
          const productIds =
            ids.length || stringValue(recommendation.type) !== 'BattlePass'
              ? ids
              : stringList(asRecord(tables.CashShopTable?.BP).cashGoodsIds)
          return productIds.flatMap((goodsId) => {
            const product = tables.CashShopGoodsTable?.[goodsId]
              ? cashProduct(tables, goodsId, label)
              : normalProduct(tables, goodsId, label)
            return productAllowed(product, showHidden) ? [product] : []
          })
        })
      shops = [
        {
          id: 'recommendations',
          name: 'recommendations',
          kind: 'recommendation',
          products,
          ownSearchText: 'recommendations shop_pay_recommend'
        }
      ]
    } else if (kind === 'cash') {
      shops = stringList(cashGroup.cashShopIds).flatMap((shopId) => {
        const shop = asRecord(tables.CashShopTable?.[shopId])
        if (!Object.keys(shop).length) return []
        const products = stringList(shop.cashGoodsIds)
          .map((goodsId) => cashProducts.get(goodsId) ?? null)
          .filter((product) => productAllowed(product, showHidden))
        const name = plainGameText(shop.shopName, shopId)
        return [
          {
            id: shopId,
            name,
            kind: 'cash' as const,
            products,
            ownSearchText: `${shopId} ${name}`.toLocaleLowerCase()
          }
        ]
      })
    } else {
      shops = stringList(row.shopIds).flatMap((shopId) => {
        const shop = asRecord(tables.ShopTable?.[shopId])
        if (!Object.keys(shop).length) return []
        const products = stringList(shop.shopGoodsIds)
          .map((goodsId) => normalProducts.get(goodsId) ?? null)
          .filter((product) => productAllowed(product, showHidden))
        const name = plainGameText(shop.shopName, shopId)
        return [
          {
            id: shopId,
            name,
            kind: 'normal' as const,
            products,
            ownSearchText: `${shopId} ${name}`.toLocaleLowerCase()
          }
        ]
      })
      if (id === 'shop_pay_weapon') {
        shops.unshift(buildRotationShop(tables, normalProducts, options.now ?? Date.now()))
      }
    }
    const name = plainGameText(row.shopGroupName, id)
    const ownSearchText = `${id} ${name} ${numberValue(row.shopGroupType)}`.toLocaleLowerCase()
    const searchText = [
      ownSearchText,
      ...shops.flatMap((shop) => [shop.ownSearchText, ...shop.products.map((product) => product.searchText)])
    ].join(' ')
    return {
      id,
      name,
      type: numberValue(row.shopGroupType),
      kind,
      sourceOrder,
      context: buildContext(tables, id),
      shops,
      productCount: shops
        .filter((shop) => shop.kind !== 'rotation')
        .reduce((total, shop) => total + shop.products.length, 0),
      ownSearchText,
      searchText
    }
  })
  groups.sort(
    (left, right) =>
      Number(right.id === 'shop_pay_weapon') - Number(left.id === 'shop_pay_weapon') ||
      left.sourceOrder - right.sourceOrder
  )
  const weapons = Object.fromEntries(
    [...new Set([...WEEKLY_SIX_STAR, ...WEEKLY_FIVE_STAR, ...DAILY_ROTATION.flat()])].map((id) => [
      id,
      itemInfo(tables, id)
    ])
  )
  return { groups, weapons }
}

export function filterShopGroups(groups: readonly ShopGroup[], search: string): ShopGroup[] {
  const query = search.trim().toLocaleLowerCase()
  return query ? groups.filter((group) => group.searchText.includes(query)) : [...groups]
}

export function filterShopGroup(group: ShopGroup, search: string): ShopGroup {
  const query = search.trim().toLocaleLowerCase()
  if (!query || group.ownSearchText.includes(query)) return group
  const shops = group.shops.flatMap((shop) => {
    if (shop.ownSearchText.includes(query)) return [shop]
    const products = shop.products.filter((product) => product.searchText.includes(query))
    return products.length ? [{ ...shop, products }] : []
  })
  return {
    ...group,
    shops,
    productCount: shops.reduce((total, shop) => total + shop.products.length, 0)
  }
}

function fallbackWeapon(id: string): ShopWeapon {
  return { id, name: id, iconId: id, rarity: 0 }
}

export function buildShopRotationSchedule(
  weapons: Readonly<Record<string, ShopWeapon>>,
  now = Date.now()
): ShopRotationScheduleRow[] {
  const state = shopRotationState(now)
  const currentDay = state.dayIndex >= 0 ? state.dayIndex % 7 : -1
  return WEEKLY_SIX_STAR.map((sixId, index) => ({
    index: index + 1,
    start: ROTATION_START + index * 7 * DAY_MS,
    end: ROTATION_START + (index + 1) * 7 * DAY_MS - 1,
    weeklySix: weapons[sixId] ?? fallbackWeapon(sixId),
    weeklyFive: weapons[WEEKLY_FIVE_STAR[index] ?? ''] ?? fallbackWeapon(WEEKLY_FIVE_STAR[index] ?? ''),
    days: Array.from({ length: 7 }, (_, day) => {
      const rotation = DAILY_ROTATION[(index * 7 + day) % DAILY_ROTATION.length] ?? []
      return rotation.map((id) => weapons[id] ?? fallbackWeapon(id))
    }),
    active: index === state.weekIndex,
    activeDay: index === state.weekIndex ? currentDay : -1
  }))
}
