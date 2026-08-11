import type { AppLocale } from '@ake/r2-contract'

type CopyValue = { en: string; zh: string }

const COPY = {
  search: { en: 'Search shops or products', zh: '搜索商店或商品' },
  groupList: { en: 'Shop group list', zh: '商店组列表' },
  loading: { en: 'Loading shop data', zh: '正在读取商店数据' },
  groups: { en: 'Shop groups', zh: '商店组' },
  selectGroup: { en: 'Select a shop group', zh: '选择商店组' },
  recommendations: { en: 'Featured selections', zh: '帝江号精选' },
  goodsCount: { en: '{count} products', zh: '{count} 件商品' },
  noMatches: { en: 'No matching shop groups', zh: '没有匹配的商店组' },
  noGoods: { en: 'No matching products in this shop group', zh: '该商店组下没有匹配商品' },
  loadFailed: { en: 'Shop data could not be loaded', zh: '商店数据加载失败' },
  unknown: { en: 'Unknown', zh: '未知' },
  permanent: { en: 'Permanent', zh: '永久' },
  free: { en: 'Free', zh: '免费' },
  unlimited: { en: 'Unlimited', zh: '不限购' },
  limitWithRefresh: { en: 'Limit {count} · {refresh}', zh: '限购 {count} · {refresh}' },
  hidden: { en: 'Hidden in game', zh: '游戏内隐藏' },
  weaponClaim: { en: 'Weapon claim', zh: '武器申领' },
  bonusReward: { en: 'Recharge bonus', zh: '充值加赠' },
  monthlyReward: { en: 'Recurring rewards', zh: '周期奖励' },
  'groupTypes.type0': { en: 'Regional and event shop', zh: '地区与活动商店' },
  'groupTypes.type2': { en: 'Quota exchange', zh: '配额兑换' },
  'groupTypes.type3': { en: 'Regional supplies', zh: '地区物资调度' },
  'groupTypes.type4': { en: 'Credit exchange', zh: '信用交易' },
  'groupTypes.type5': { en: 'Paid shop', zh: '付费商店' },
  'groupTypes.cash': { en: 'Paid shop', zh: '付费商店' },
  'groupTypes.recommend': { en: 'Featured selections', zh: '精选推荐' },
  'groupTypes.other': { en: 'Other shop', zh: '其他商店' },
  'context.activity': { en: 'Activity', zh: '关联活动' },
  'context.openTime': { en: 'Open period', zh: '开放时间' },
  'context.domain': { en: 'Region', zh: '所属地区' },
  'context.channels': { en: 'Dispatchers', zh: '调度员' },
  'refresh.none': { en: 'Permanent limit', zh: '永久限购' },
  'refresh.daily': { en: 'Refreshes daily', zh: '每日刷新' },
  'refresh.weekly': { en: 'Refreshes weekly', zh: '每周刷新' },
  'refresh.monthly': { en: 'Refreshes monthly', zh: '每月刷新' },
  'refresh.pool': { en: 'Refreshes with weapon pool', zh: '随武器卡池刷新' },
  'refresh.subVersion': { en: 'Refreshes with sub-version', zh: '随子版本刷新' },
  'refresh.byTime': { en: 'Refreshes on configured schedule', zh: '按配置时段刷新' },
  'refresh.unknown': { en: 'Refresh type {type}', zh: '刷新类型 {type}' },
  'rotation.title': { en: 'Arsenal rotation', zh: '武库轮换' },
  'rotation.weekly': { en: 'Weekly rotation', zh: '周轮换' },
  'rotation.daily': { en: 'Daily rotation', zh: '日轮换' },
  'rotation.fullTable': { en: 'Full rotation schedule', zh: '完整轮换表' },
  'rotation.weekly6': { en: '6-star weekly', zh: '六星周轮换' },
  'rotation.weekly5': { en: '5-star weekly', zh: '五星周轮换' },
  'rotation.dailyTitle': { en: '5-star daily rotation', zh: '五星日轮换' },
  'rotation.startDate': { en: 'Start', zh: '起' },
  'rotation.endDate': { en: 'End', zh: '止' },
  'rotation.thu': { en: 'Thu', zh: '周四' },
  'rotation.fri': { en: 'Fri', zh: '周五' },
  'rotation.sat': { en: 'Sat', zh: '周六' },
  'rotation.sun': { en: 'Sun', zh: '周日' },
  'rotation.mon': { en: 'Mon', zh: '周一' },
  'rotation.tue': { en: 'Tue', zh: '周二' },
  'rotation.wed': { en: 'Wed', zh: '周三' },
  'rotation.refreshIn': { en: 'Refresh in', zh: '距下次刷新' },
  'rotation.nextBatch': { en: 'Next rotation', zh: '下批轮换' },
  'shopNames.shop_pay_weapon_gacha': { en: 'Weapon claim', zh: '武器申领' },
  'shopNames.shop_pay_weapon_weekly': { en: 'Weekly rotation', zh: '周轮换' },
  'shopNames.shop_pay_weapon_daily': { en: 'Daily rotation', zh: '日轮换' },
  'shopNames.shop_pay_weapon_constant': { en: 'Permanent weapon shop', zh: '武器购买（常驻）' }
} satisfies Record<string, CopyValue>

export type ShopCopyKey = keyof typeof COPY

export function shopCopy(
  locale: AppLocale,
  key: ShopCopyKey,
  params: Readonly<Record<string, string | number>> = {}
): string {
  const language = locale === 'CH' || locale === 'TC' ? 'zh' : 'en'
  return Object.entries(params).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    COPY[key][language]
  )
}
