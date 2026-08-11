export const ACTIVITY_COPY = {
  id: { en: 'Activity ID', zh: '活动 ID' },
  visible: { en: 'Visible activities', zh: '当前显示' },
  total: { en: 'All activities', zh: '全部活动' },
  overview: { en: 'Activity overview', zh: '活动总览' },
  overviewDescription: {
    en: 'Current, upcoming, completed and permanent activities ordered by status and table order.',
    zh: '按状态与表顺序查看进行中、未开始、已结束与常驻活动。'
  },
  directory: { en: 'Activity directory', zh: '活动目录' },
  searchPlaceholder: { en: 'Name or activity ID', zh: '活动名称或 ID' },
  status: { en: 'Status', zh: '状态' },
  statuses: { en: 'Activity status', zh: '活动状态' },
  active: { en: 'Active', zh: '进行中' },
  upcoming: { en: 'Upcoming', zh: '未开始' },
  ended: { en: 'Ended', zh: '已结束' },
  permanent: { en: 'Permanent', zh: '常驻' },
  tags: { en: 'Tags', zh: '标签' },
  type: { en: 'Activity type', zh: '活动类型' },
  order: { en: 'Table order', zh: '表顺序' },
  time: { en: 'Schedule', zh: '开放时间' },
  start: { en: 'Starts', zh: '开始' },
  end: { en: 'Ends', zh: '结束' },
  countdown: { en: 'Countdown', zh: '倒计时' },
  startsIn: { en: 'Starts in', zh: '距开始' },
  endsIn: { en: 'Ends in', zh: '距结束' },
  noEnd: { en: 'No scheduled end', zh: '无预定结束时间' },
  elapsed: { en: 'Schedule completed', zh: '已结束' },
  days: { en: 'd', zh: '天' },
  conditions: { en: 'Unlock conditions', zh: '开放条件' },
  conditionType: { en: 'Condition type', zh: '条件类型' },
  progress: { en: 'Required progress', zh: '所需进度' },
  rewards: { en: 'Rewards', zh: '奖励' },
  probable: { en: 'Possible reward', zh: '概率奖励' },
  stages: { en: 'Activity stages', zh: '活动阶段' },
  stageCount: { en: 'Stages', zh: '阶段数' },
  rewardCount: { en: 'Reward items', zh: '奖励物品' },
  dungeon: { en: 'Dungeon', zh: '关卡' },
  mission: { en: 'Mission', zh: '任务' },
  timeline: { en: 'Activity timeline', zh: '活动时间轴' },
  timelineDescription: {
    en: 'Activities overlapping the past 14 days and the next 90 days.',
    zh: '展示过去 14 天至未来 90 天内有交集的活动。'
  },
  past14Days: { en: 'Past 14 days', zh: '过去 14 天' },
  next90Days: { en: 'Next 90 days', zh: '未来 90 天' },
  now: { en: 'Now', zh: '现在' },
  timelineEmpty: { en: 'No activities fall within this timeline window.', zh: '此时间窗口内没有活动。' },
  changes: { en: 'Version changes', zh: '版本变化' },
  changeType: { en: 'Change', zh: '变化类型' },
  added: { en: 'Added', zh: '新增' },
  modified: { en: 'Modified', zh: '修改' },
  removed: { en: 'Removed', zh: '删除' },
  before: { en: 'Before', zh: '变更前' },
  after: { en: 'After', zh: '变更后' },
  path: { en: 'Field', zh: '字段' },
  comparisonVersion: { en: 'Compared with', zh: '对比版本' },
  openActivity: { en: 'Open activity', zh: '打开活动' },
  clearFilters: { en: 'Clear activity filters', zh: '清除活动筛选' },
  rawSnapshot: { en: 'Activity source snapshot', zh: '活动源数据快照' },
  copyRaw: { en: 'Copy raw data', zh: '复制原始数据' },
  copiedRaw: { en: 'Raw data copied', zh: '已复制原始数据' }
} as const

export type ActivityCopyKey = keyof typeof ACTIVITY_COPY

export function activityFallback(key: ActivityCopyKey, locale: string): string {
  const value = ACTIVITY_COPY[key]
  return locale === 'CH' ? value.zh : value.en
}
