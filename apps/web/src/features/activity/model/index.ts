import {
  asRecord,
  deepDiff,
  stableStringify,
  textValue,
  type FieldDiff,
  type RawRecord,
  type TableSet
} from '@ake/domain'

export const ACTIVITY_TABLE_NAMES = [
  'ActivityTable',
  'ActivityTagTable',
  'TimeRangeTable',
  'RewardTable',
  'ItemTable',
  'ActivityConditionalMultiStageTable',
  'ActivityDungeonFightingStageTable',
  'DungeonTable'
] as const

export type ActivityTableName = (typeof ACTIVITY_TABLE_NAMES)[number]
export type ActivityStatus = 'active' | 'upcoming' | 'ended' | 'permanent'
export type ActivityChangeType = 'added' | 'modified'

export interface ActivityTag {
  readonly id: string
  readonly name: string
}

export interface ActivityTimeRange {
  readonly openAt: string
  readonly closeAt: string
  readonly openTimestamp: number | null
  readonly closeTimestamp: number | null
}

export interface ActivityCondition {
  readonly id: string
  readonly type: number
  readonly description: string
  readonly tips: string
  readonly compareOperator: number
  readonly progressToCompare: number
  readonly jumpId: string
  readonly parameters: readonly unknown[]
}

export interface ActivityRewardItem {
  readonly id: string
  readonly name: string
  readonly count: number
  readonly icon: string
  readonly probable: boolean
}

export interface ActivityReward {
  readonly id: string
  readonly items: readonly ActivityRewardItem[]
}

export interface ActivityStage {
  readonly id: string
  readonly kind: 'conditional' | 'dungeon'
  readonly name: string
  readonly description: string
  readonly sortId: number
  readonly sourceOrder: number
  readonly openAt: string
  readonly closeAt: string
  readonly ranges: readonly ActivityTimeRange[]
  readonly status: ActivityStatus
  readonly reward: ActivityReward
  readonly dungeonId: string
  readonly dungeonName: string
  readonly source: Readonly<RawRecord>
}

export interface ActivityEntry {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type: number
  readonly sortId: number
  readonly sourceOrder: number
  readonly tags: readonly ActivityTag[]
  readonly tagIds: readonly string[]
  readonly openAt: string
  readonly closeAt: string
  readonly ranges: readonly ActivityTimeRange[]
  readonly status: ActivityStatus
  readonly image: string
  readonly conditions: readonly ActivityCondition[]
  readonly reward: ActivityReward
  readonly stages: readonly ActivityStage[]
  readonly hidden: boolean
  readonly searchText: string
  readonly source: Readonly<RawRecord>
  readonly comparisonSource: Readonly<RawRecord>
  readonly changeType?: ActivityChangeType
  readonly diffCount?: number
  readonly differences?: readonly FieldDiff[]
}

export type ActivityDetail = ActivityEntry

export interface ActivityCatalog {
  readonly entries: readonly ActivityEntry[]
  readonly details: Readonly<Record<string, ActivityDetail>>
  readonly tags: readonly ActivityTag[]
  readonly statusCounts: Readonly<Record<ActivityStatus, number>>
  readonly comparisonVersion?: string
}

export interface ActivityFilterOptions {
  readonly search?: string
  readonly tags?: ReadonlySet<string> | readonly string[]
  readonly statuses?: ReadonlySet<ActivityStatus> | readonly ActivityStatus[]
  readonly showHidden?: boolean
  readonly now?: number | Date
}

export interface ActivityTimelineItem {
  readonly activityId: string
  readonly name: string
  readonly type: number
  readonly image: string
  readonly openAt: string
  readonly closeAt: string
  readonly start: number
  readonly end: number
  readonly clippedStart: number
  readonly clippedEnd: number
  readonly offsetDays: number
  readonly durationDays: number
  readonly status: ActivityStatus
}

export interface ActivityTimeline {
  readonly now: number
  readonly windowStart: number
  readonly windowEnd: number
  readonly pastDays: number
  readonly futureDays: number
  readonly dayCount: number
  readonly items: readonly ActivityTimelineItem[]
}

const DAY_MS = 24 * 60 * 60 * 1_000
const IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites'
const STATUS_ORDER: Readonly<Record<ActivityStatus, number>> = Object.freeze({
  active: 0,
  upcoming: 1,
  ended: 2,
  permanent: 3
})

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function values(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function records(value: unknown): readonly RawRecord[] {
  return values(value).map(asRecord)
}

function stringList(value: unknown): readonly string[] {
  return values(value)
    .filter((item) => item !== undefined && item !== null)
    .map(String)
}

function plainText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function toTimestamp(value: string): number | null {
  if (!value.trim()) return null
  const gameTime = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (gameTime) {
    const [, year, month, day, hour, minute, second = '0'] = gameTime
    if (!year || !month || !day || !hour || !minute) return null
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}+08:00`
    const parsed = Date.parse(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function timestamp(value: number | Date | undefined): number {
  if (value instanceof Date) return value.getTime()
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now()
}

function cloneReadonly<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== 'object') return value
  const cached = seen.get(value as object)
  if (cached) return cached as T
  if (Array.isArray(value)) {
    const output: unknown[] = []
    seen.set(value, output)
    output.push(...value.map((child) => cloneReadonly(child, seen)))
    return Object.freeze(output) as T
  }
  const output: RawRecord = {}
  seen.set(value as object, output)
  for (const [key, child] of Object.entries(value as RawRecord)) output[key] = cloneReadonly(child, seen)
  return Object.freeze(output) as T
}

function freezeList<T>(items: T[]): readonly T[] {
  return Object.freeze(items)
}

function activityImage(iconId: string): string {
  return iconId ? `${IMAGE_ROOT}/activity/${iconId}.png` : ''
}

function itemImage(iconId: string, itemId: string): string {
  return `${IMAGE_ROOT}/itemiconbig/${iconId || itemId}.png`
}

function buildRanges(timeId: string, tables: TableSet): readonly ActivityTimeRange[] {
  const row = asRecord(tables.TimeRangeTable?.[timeId])
  return freezeList(
    records(row.timeRangeList).map((range) =>
      Object.freeze({
        openAt: stringValue(range.openTime),
        closeAt: stringValue(range.closeTime),
        openTimestamp: toTimestamp(stringValue(range.openTime)),
        closeTimestamp: toTimestamp(stringValue(range.closeTime))
      })
    )
  )
}

function temporalStatus(openAt: string, closeAt: string, now: number): ActivityStatus {
  const open = toTimestamp(openAt)
  const close = toTimestamp(closeAt)
  if (close === null) return 'permanent'
  if (now >= close) return 'ended'
  if (open !== null && now < open) return 'upcoming'
  return 'active'
}

export function resolveActivityStatus(
  entry: Pick<ActivityEntry, 'openAt' | 'closeAt'>,
  now: number | Date = Date.now()
): ActivityStatus {
  return temporalStatus(entry.openAt, entry.closeAt, timestamp(now))
}

function buildReward(rewardId: string, tables: TableSet): ActivityReward {
  const reward = asRecord(tables.RewardTable?.[rewardId])
  const bundles = [
    ...records(reward.itemBundles).map((bundle) => ({ bundle, probable: false })),
    ...records(reward.probItemBundles).map((bundle) => ({ bundle, probable: true }))
  ]
  const items = bundles.map(({ bundle, probable }): ActivityRewardItem => {
    const id = stringValue(bundle.id)
    const item = asRecord(tables.ItemTable?.[id])
    return Object.freeze({
      id,
      name: textValue(item.name, id),
      count: numberValue(bundle.count, 1),
      icon: itemImage(stringValue(item.iconId), id),
      probable
    })
  })
  return Object.freeze({ id: rewardId, items: freezeList(items) })
}

function buildConditions(value: unknown): readonly ActivityCondition[] {
  return freezeList(
    records(value).map((condition, index) =>
      Object.freeze({
        id: stringValue(condition.conditionId, `condition_${index + 1}`),
        type: numberValue(condition.conditionType),
        description: plainText(condition.desc),
        tips: plainText(condition.tips),
        compareOperator: numberValue(condition.compareOperator),
        progressToCompare: numberValue(condition.progressToCompare),
        jumpId: stringValue(condition.jumpId),
        parameters: cloneReadonly(values(condition.parameters))
      })
    )
  )
}

function buildConditionalStages(activityId: string, tables: TableSet, now: number): ActivityStage[] {
  const owner = asRecord(tables.ActivityConditionalMultiStageTable?.[activityId])
  return Object.entries(asRecord(owner.stageList)).map(([key, value], sourceOrder) => {
    const row = asRecord(value)
    const id = stringValue(row.stageId, key)
    const ranges = buildRanges(stringValue(row.timeId), tables)
    const primary = ranges[0]
    const openAt = primary?.openAt ?? ''
    const closeAt = primary?.closeAt ?? ''
    return Object.freeze({
      id,
      kind: 'conditional' as const,
      name: textValue(row.name, id),
      description: plainText(row.desc),
      sortId: numberValue(row.sortId, sourceOrder),
      sourceOrder,
      openAt,
      closeAt,
      ranges,
      status: temporalStatus(openAt, closeAt, now),
      reward: buildReward(stringValue(row.rewardId), tables),
      dungeonId: '',
      dungeonName: '',
      source: cloneReadonly(row)
    })
  })
}

function buildDungeonStages(
  activityId: string,
  activityRanges: readonly ActivityTimeRange[],
  tables: TableSet,
  now: number
): ActivityStage[] {
  if (activityId !== 'dungeon_fighting') return []
  const primary = activityRanges[0]
  const openAt = primary?.openAt ?? ''
  const closeAt = primary?.closeAt ?? ''
  return Object.entries(tables.ActivityDungeonFightingStageTable ?? {}).map(([key, value], sourceOrder) => {
    const row = asRecord(value)
    const dungeonId = stringValue(row.levelId)
    const dungeon = asRecord(tables.DungeonTable?.[dungeonId])
    return Object.freeze({
      id: key,
      kind: 'dungeon' as const,
      name: textValue(dungeon.dungeonName, key),
      description: plainText(dungeon.dungeonDesc),
      sortId: numberValue(dungeon.sortId, sourceOrder),
      sourceOrder,
      openAt,
      closeAt,
      ranges: activityRanges,
      status: temporalStatus(openAt, closeAt, now),
      reward: buildReward(stringValue(dungeon.rewardId), tables),
      dungeonId,
      dungeonName: textValue(dungeon.dungeonName, dungeonId),
      source: cloneReadonly(row)
    })
  })
}

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })
}

function sortStages(stages: readonly ActivityStage[]): readonly ActivityStage[] {
  return freezeList(
    [...stages].sort(
      (left, right) =>
        left.sortId - right.sortId ||
        left.sourceOrder - right.sourceOrder ||
        naturalCompare(left.id, right.id)
    )
  )
}

function statusCounts(
  entries: readonly ActivityEntry[],
  now: number
): Readonly<Record<ActivityStatus, number>> {
  const output: Record<ActivityStatus, number> = { active: 0, upcoming: 0, ended: 0, permanent: 0 }
  for (const entry of entries) output[resolveActivityStatus(entry, now)] += 1
  return Object.freeze(output)
}

export function sortActivities(
  entries: readonly ActivityEntry[],
  now: number | Date = Date.now()
): ActivityEntry[] {
  const at = timestamp(now)
  return [...entries].sort(
    (left, right) =>
      STATUS_ORDER[resolveActivityStatus(left, at)] - STATUS_ORDER[resolveActivityStatus(right, at)] ||
      left.sortId - right.sortId ||
      left.sourceOrder - right.sourceOrder ||
      naturalCompare(left.id, right.id)
  )
}

export function buildActivityCatalog(tables: TableSet, now: number | Date = Date.now()): ActivityCatalog {
  const at = timestamp(now)
  const allTags = new Map<string, ActivityTag>()
  for (const [key, value] of Object.entries(tables.ActivityTagTable ?? {})) {
    const row = asRecord(value)
    const id = stringValue(row.tagId, key)
    allTags.set(id, Object.freeze({ id, name: textValue(row.name, id) }))
  }

  const entries = Object.entries(tables.ActivityTable ?? {}).map(
    ([key, value], sourceOrder): ActivityEntry => {
      const row = asRecord(value)
      const id = stringValue(row.id, key)
      const tagIds = freezeList([...stringList(row.tagIds)])
      const tags = freezeList(
        tagIds.map((tagId) => allTags.get(tagId) ?? Object.freeze({ id: tagId, name: tagId }))
      )
      const ranges = buildRanges(stringValue(row.timeId), tables)
      const primary = ranges[0]
      const openAt = primary?.openAt ?? ''
      const closeAt = primary?.closeAt ?? ''
      const name = textValue(row.name, id)
      const conditionalStages = buildConditionalStages(id, tables, at)
      const dungeonStages = buildDungeonStages(id, ranges, tables, at)
      const stages = sortStages([...conditionalStages, ...dungeonStages])
      const reward = buildReward(stringValue(row.rewardId), tables)
      const source = cloneReadonly(row)
      const conditionalStageRows = Object.values(
        asRecord(asRecord(tables.ActivityConditionalMultiStageTable?.[id]).stageList)
      ).map(asRecord)
      const relatedTimeIds = new Set(
        [stringValue(row.timeId), ...conditionalStageRows.map((stage) => stringValue(stage.timeId))].filter(
          Boolean
        )
      )
      const relatedRewardIds = new Set([reward.id, ...stages.map((stage) => stage.reward.id)].filter(Boolean))
      const relatedItemIds = new Set<string>()
      for (const rewardId of relatedRewardIds) {
        const rewardRow = asRecord(tables.RewardTable?.[rewardId])
        for (const bundle of [...records(rewardRow.itemBundles), ...records(rewardRow.probItemBundles)]) {
          const itemId = stringValue(bundle.id)
          if (itemId) relatedItemIds.add(itemId)
        }
      }
      const comparisonSource = cloneReadonly({
        activity: row,
        tags: Object.fromEntries(tagIds.map((tagId) => [tagId, asRecord(tables.ActivityTagTable?.[tagId])])),
        times: Object.fromEntries(
          [...relatedTimeIds].map((timeId) => [timeId, asRecord(tables.TimeRangeTable?.[timeId])])
        ),
        rewards: Object.fromEntries(
          [...relatedRewardIds].map((rewardId) => [rewardId, asRecord(tables.RewardTable?.[rewardId])])
        ),
        rewardItems: Object.fromEntries(
          [...relatedItemIds].map((itemId) => [itemId, asRecord(tables.ItemTable?.[itemId])])
        ),
        conditionalStages: asRecord(tables.ActivityConditionalMultiStageTable?.[id]),
        dungeonStages: id === 'dungeon_fighting' ? (tables.ActivityDungeonFightingStageTable ?? {}) : {},
        dungeons:
          id === 'dungeon_fighting'
            ? Object.fromEntries(
                Object.values(tables.ActivityDungeonFightingStageTable ?? {}).map((stage) => {
                  const dungeonId = stringValue(asRecord(stage).levelId)
                  return [dungeonId, asRecord(tables.DungeonTable?.[dungeonId])]
                })
              )
            : {}
      })
      return Object.freeze({
        id,
        name,
        description: plainText(row.desc),
        type: numberValue(row.type),
        sortId: numberValue(row.sortId, sourceOrder),
        sourceOrder,
        tags,
        tagIds,
        openAt,
        closeAt,
        ranges,
        status: temporalStatus(openAt, closeAt, at),
        image: activityImage(stringValue(row.tabImg)),
        conditions: buildConditions(row.conditions),
        reward,
        stages,
        hidden: row.hidden === true,
        searchText: `${id}\n${name}`.toLocaleLowerCase(),
        source,
        comparisonSource
      })
    }
  )

  const sorted = freezeList(sortActivities(entries, at))
  const details = Object.freeze(Object.fromEntries(sorted.map((entry) => [entry.id, entry])))
  const usedTags = new Set(sorted.flatMap((entry) => entry.tagIds))
  const tags = freezeList(
    [...allTags.values()]
      .filter((tag) => usedTags.has(tag.id))
      .sort((left, right) => naturalCompare(left.name, right.name) || naturalCompare(left.id, right.id))
  )
  return Object.freeze({ entries: sorted, details, tags, statusCounts: statusCounts(sorted, at) })
}

function optionSet<T extends string>(value: ReadonlySet<T> | readonly T[] | undefined): ReadonlySet<T> {
  return value instanceof Set ? value : new Set(value ?? [])
}

export function filterActivities(
  entries: readonly ActivityEntry[],
  options: ActivityFilterOptions
): ActivityEntry[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  const tags = optionSet(options.tags)
  const statuses = optionSet(options.statuses)
  const at = timestamp(options.now)
  return entries.filter((entry) => {
    if (!options.showHidden && entry.hidden) return false
    if (search && !entry.searchText.includes(search)) return false
    if (tags.size && !entry.tagIds.some((tagId) => tags.has(tagId))) return false
    return !statuses.size || statuses.has(resolveActivityStatus(entry, at))
  })
}

function startOfDay(value: number): number {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function buildActivityTimeline(
  entries: readonly ActivityEntry[],
  now: number | Date = Date.now(),
  pastDays = 14,
  futureDays = 90
): ActivityTimeline {
  const at = timestamp(now)
  const safePastDays = Math.max(0, Math.floor(pastDays))
  const safeFutureDays = Math.max(0, Math.floor(futureDays))
  const today = startOfDay(at)
  const windowStart = today - safePastDays * DAY_MS
  const windowEnd = today + (safeFutureDays + 1) * DAY_MS
  const sourceRank = new Map(entries.map((entry) => [entry.id, entry.sourceOrder]))
  const items = entries
    .flatMap((entry): ActivityTimelineItem[] => {
      const open = toTimestamp(entry.openAt)
      const close = toTimestamp(entry.closeAt)
      const start = open ?? windowStart
      const end = close ?? windowEnd
      if (end <= start || end <= windowStart || start >= windowEnd) return []
      const clippedStart = Math.max(start, windowStart)
      const clippedEnd = Math.min(end, windowEnd)
      return [
        Object.freeze({
          activityId: entry.id,
          name: entry.name,
          type: entry.type,
          image: entry.image,
          openAt: entry.openAt,
          closeAt: entry.closeAt,
          start,
          end,
          clippedStart,
          clippedEnd,
          offsetDays: (clippedStart - windowStart) / DAY_MS,
          durationDays: (clippedEnd - clippedStart) / DAY_MS,
          status: resolveActivityStatus(entry, at)
        })
      ]
    })
    .sort(
      (left, right) =>
        left.start - right.start ||
        (sourceRank.get(left.activityId) ?? Number.MAX_SAFE_INTEGER) -
          (sourceRank.get(right.activityId) ?? Number.MAX_SAFE_INTEGER) ||
        left.end - right.end ||
        naturalCompare(left.activityId, right.activityId)
    )
  return Object.freeze({
    now: at,
    windowStart,
    windowEnd,
    pastDays: safePastDays,
    futureDays: safeFutureDays,
    dayCount: safePastDays + safeFutureDays + 1,
    items: freezeList(items)
  })
}

export function compareActivityCatalog(
  current: ActivityCatalog,
  baseline: ActivityCatalog,
  comparisonVersion: string
): ActivityCatalog {
  const previousById = new Map(baseline.entries.map((entry) => [entry.id, entry]))
  const entries = freezeList(
    current.entries.map((entry): ActivityEntry => {
      const previous = previousById.get(entry.id)
      if (!previous)
        return Object.freeze({ ...entry, changeType: 'added', diffCount: 1, differences: freezeList([]) })
      if (stableStringify(previous.comparisonSource) === stableStringify(entry.comparisonSource)) return entry
      const differences = freezeList(deepDiff(previous.comparisonSource, entry.comparisonSource))
      return Object.freeze({ ...entry, changeType: 'modified', diffCount: differences.length, differences })
    })
  )
  return Object.freeze({
    ...current,
    entries,
    details: Object.freeze(Object.fromEntries(entries.map((entry) => [entry.id, entry]))),
    comparisonVersion
  })
}
