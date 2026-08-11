import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'
import type { CcCombatContext } from './combat'

export type CcStatus = 'active' | 'upcoming' | 'ended' | 'permanent'

export interface CcCatalogEntry {
  id: string
  activityId: string
  name: string
  imageId: string
  openTime: string
  closeTime: string
  status: CcStatus
  statusOrder: number
  dungeonName: string
  dungeonSeriesId: string
  groupCount: number
  termCount: number
  hidden: boolean
  searchText: string
}

export interface CcCatalog {
  entries: CcCatalogEntry[]
}

export interface CcActivityField {
  key: 'activityId' | 'gameplayType' | 'stageId' | 'maxTagColumns' | 'currencyAmount' | 'shopGroup'
  value: string
}

export interface CcTermParameter {
  key: string
  value: string | number
  rawValue: unknown
}

export interface CcTermEffect {
  type: number | string
  buffId: string
  parameters: CcTermParameter[]
}

export interface CcContractTerm {
  id: string
  groupId: string
  name: string
  roman: string
  score: number
  description: string
  iconId: string
  effects: CcTermEffect[]
  keyId: string
  lockIds: string[]
  conflictId: string
  canPreview: boolean
  formationTip: string
  battleTip: string
  searchText: string
}

export interface CcContractGroup {
  id: string
  terms: CcContractTerm[]
}

export interface CcRewardItem {
  id: string
  name: string
  iconId: string
  rarity: number
  count: number
}

export interface CcLevelReward {
  id: string
  level: number
  score: number | null
  rewardId: string
  rewards: CcRewardItem[]
}

export interface CcShopGood {
  id: string
  fallbackName: string
  rewards: CcRewardItem[]
  currencyId: string
  currencyName: string
  price: number
  actualPrice: number
  discountPercent: number
  limitCount: number | null
}

export interface CcShop {
  id: string
  name: string
  goods: CcShopGood[]
}

export interface CcShopGroup {
  id: string
  name: string
  shops: CcShop[]
}

export interface CcTask {
  id: string
  description: string
  rewards: CcRewardItem[]
  sort: number
}

export interface CcTaskGroup {
  id: string
  name: string
  iconId: string
  canUpdate: boolean
  configuredCount: number
  tasks: CcTask[]
  sort: number
}

export interface CcDetailBase {
  entry: CcCatalogEntry
  configuration: CcActivityField[]
  groups: CcContractGroup[]
  terms: Readonly<Record<string, CcContractTerm>>
  levelRewards: CcLevelReward[]
  shop: CcShopGroup | null
  taskGroups: CcTaskGroup[]
}

export interface CcDetail extends CcDetailBase {
  combat: CcCombatContext
}

export interface CcTermAvailability {
  selectable: boolean
  reason: 'missing' | 'conflict' | 'keys' | null
  conflictWith: string
  missingKeys: string[]
}

export interface CcSelectionResult {
  selected: Set<string>
  changed: boolean
  rejected: CcTermAvailability | null
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function plainText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<color=[^>]+>/gi, '')
    .replace(/<\/color>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function parseGameTime(value: string): number | null {
  if (!value) return null
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  const normalized = match
    ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}T${String(match[4]).padStart(2, '0')}:${String(match[5]).padStart(2, '0')}:${String(match[6]).padStart(2, '0')}+08:00`
    : value
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function ccStatus(openTime: string, closeTime: string, now = Date.now()): CcStatus {
  if (!closeTime) return 'permanent'
  const open = parseGameTime(openTime)
  const close = parseGameTime(closeTime)
  if (open !== null && now < open) return 'upcoming'
  if (close !== null && now >= close) return 'ended'
  return 'active'
}

function statusOrder(status: CcStatus): number {
  return { active: 0, upcoming: 1, ended: 2, permanent: 3 }[status]
}

function firstTimeRange(activity: RawRecord, tables: TableSet): { openTime: string; closeTime: string } {
  const timeRange = asRecord(tables.TimeRangeTable?.[stringValue(activity.timeId)])
  const range = records(timeRange.timeRangeList)[0] ?? {}
  return {
    openTime: stringValue(range.openTime),
    closeTime: stringValue(range.closeTime)
  }
}

function dungeonSeriesId(gameId: string, tables: TableSet): string {
  for (const [id, value] of Object.entries(tables.DungeonSeriesTable ?? {})) {
    if (strings(asRecord(value).includeDungeonIds).includes(gameId)) return id
  }
  return ''
}

export function buildCcCatalog(
  tables: TableSet,
  options: { showHidden?: boolean; now?: number } = {}
): CcCatalog {
  const entries = Object.values(tables.ActivityContingencyContractTable ?? {})
    .map((value): CcCatalogEntry | null => {
      const row = asRecord(value)
      const id = stringValue(row.gameId)
      const activityId = stringValue(row.activityId)
      if (!id || !activityId) return null
      const activity = asRecord(tables.ActivityTable?.[activityId])
      const dungeon = asRecord(tables.DungeonTable?.[id])
      const contract = asRecord(tables.ContingencyContractTable?.[id])
      const groups = Object.values(asRecord(contract.contractGroupMap))
      const groupCount = groups.length
      const termCount = groups.reduce<number>(
        (total, group) => total + Object.keys(asRecord(asRecord(group).contractMap)).length,
        0
      )
      const { openTime, closeTime } = firstTimeRange(activity, tables)
      const status = ccStatus(openTime, closeTime, options.now)
      const name = textValue(activity.name, activityId)
      const dungeonName = textValue(dungeon.dungeonName, id)
      const hidden = row.hidden === true || activity.hidden === true || dungeon.hidden === true
      return {
        id,
        activityId,
        name,
        imageId: stringValue(activity.tabImg),
        openTime,
        closeTime,
        status,
        statusOrder: statusOrder(status),
        dungeonName,
        dungeonSeriesId: dungeonSeriesId(id, tables),
        groupCount,
        termCount,
        hidden,
        searchText: `${name} ${id} ${activityId}`.toLocaleLowerCase()
      }
    })
    .filter((entry): entry is CcCatalogEntry => entry !== null)
    .filter((entry) => options.showHidden || !entry.hidden)
    .toSorted(
      (left, right) =>
        left.statusOrder - right.statusOrder ||
        numberValue(asRecord(tables.ActivityTable?.[left.activityId]).sortId, 999999) -
          numberValue(asRecord(tables.ActivityTable?.[right.activityId]).sortId, 999999) ||
        left.id.localeCompare(right.id, 'en')
    )
  return { entries }
}

export function filterCcEntries(entries: readonly CcCatalogEntry[], search: string): CcCatalogEntry[] {
  const query = search.trim().toLocaleLowerCase()
  return query ? entries.filter((entry) => entry.searchText.includes(query)) : [...entries]
}

function parameterValue(row: RawRecord): unknown {
  return row.valueStr !== undefined && row.valueStr !== ''
    ? row.valueStr
    : (row.valueFloat ?? row.valueDouble ?? row.valueInt ?? row.valueLong ?? row.value ?? '')
}

function expressionTokens(expression: string): string[] | null {
  const compact = expression.replace(/\s+/g, '')
  const tokens = compact.match(/(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/])/g)
  return tokens && tokens.join('') === compact ? tokens : null
}

function evaluateExpression(expression: string, values: Readonly<Record<string, unknown>>): number | null {
  const tokens = expressionTokens(expression)
  if (!tokens) return null
  let cursor = 0
  const lookup = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), Number(value)])
  )

  const primary = (): number | null => {
    const token = tokens[cursor]
    if (token === undefined) return null
    if (token === '+' || token === '-') {
      cursor += 1
      const value = primary()
      return value === null ? null : token === '-' ? -value : value
    }
    if (token === '(') {
      cursor += 1
      const value = addition()
      if (tokens[cursor] !== ')') return null
      cursor += 1
      return value
    }
    cursor += 1
    const number = Number(token)
    if (Number.isFinite(number)) return number
    const value = lookup[token.toLowerCase()]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const multiplication = (): number | null => {
    let value = primary()
    while (value !== null && (tokens[cursor] === '*' || tokens[cursor] === '/')) {
      const operator = tokens[cursor]
      cursor += 1
      const right = primary()
      if (right === null || (operator === '/' && right === 0)) return null
      value = operator === '*' ? value * right : value / right
    }
    return value
  }
  const addition = (): number | null => {
    let value = multiplication()
    while (value !== null && (tokens[cursor] === '+' || tokens[cursor] === '-')) {
      const operator = tokens[cursor]
      cursor += 1
      const right = multiplication()
      if (right === null) return null
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const result = addition()
  return result !== null && cursor === tokens.length && Number.isFinite(result) ? result : null
}

function formattedExpression(value: number, format: string): string {
  if (format.includes('%')) return `${Number((value * 100).toFixed(1))}%`
  const decimal = format.indexOf('.')
  if (decimal !== -1) return value.toFixed(Math.max(0, format.length - decimal - 1))
  if (format.includes('0')) return String(Math.round(value))
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)))
}

export function replaceCcTermPlaceholders(
  description: string,
  ownValues: Readonly<Record<string, unknown>>,
  allValues: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {}
): string {
  return description
    .replace(/<color=[^>]+>/gi, '')
    .replace(/<\/color>/gi, '')
    .replace(/\{(?:@([^@]*)@)?([^}:]+)(?::([^}]+))?\}/g, (match, refId, expression, format) => {
      const values = refId ? (allValues[String(refId)] ?? {}) : ownValues
      const result = evaluateExpression(String(expression), values)
      return result === null ? match : formattedExpression(result, String(format ?? ''))
    })
}

function termEffects(value: unknown): CcTermEffect[] {
  return records(value).map((effect) => ({
    type: typeof effect.termType === 'number' ? effect.termType : stringValue(effect.termType, 'None'),
    buffId: stringValue(effect.buffId),
    parameters: records(effect.blackboard).map((parameter) => {
      const value = parameterValue(parameter)
      return {
        key: stringValue(parameter.key),
        value: typeof value === 'number' || typeof value === 'string' ? value : stringValue(value),
        rawValue: value
      }
    })
  }))
}

function tagValueMap(tag: RawRecord): Record<string, unknown> {
  return Object.fromEntries(
    records(tag.tagTerms).flatMap((effect) =>
      records(effect.blackboard)
        .filter((parameter) => stringValue(parameter.key) !== '')
        .map((parameter) => [stringValue(parameter.key), parameterValue(parameter)] as const)
    )
  )
}

function buildTerms(tables: TableSet, gameId: string): CcContractGroup[] {
  const contract = asRecord(tables.ContingencyContractTable?.[gameId])
  const tagTable = asRecord(tables.CcTagTable)
  const tipTable = asRecord(tables.CcTagTipTable)
  const allValues = Object.fromEntries(
    Object.entries(tagTable).map(([id, value]) => [id, tagValueMap(asRecord(value))] as const)
  )
  return Object.entries(asRecord(contract.contractGroupMap))
    .toSorted(([left], [right]) => numberValue(left) - numberValue(right) || left.localeCompare(right, 'en'))
    .map(([id, groupValue]) => {
      const assignmentRows = Object.entries(asRecord(asRecord(groupValue).contractMap)).toSorted(
        ([left], [right]) => numberValue(left) - numberValue(right) || left.localeCompare(right, 'en')
      )
      const terms = assignmentRows.map(([, assignmentValue]): CcContractTerm => {
        const assignment = asRecord(assignmentValue)
        const termId = stringValue(assignment.tagId)
        const tag = asRecord(tagTable[termId])
        const tip = asRecord(tipTable[termId])
        const effects = termEffects(tag.tagTerms)
        const values = tagValueMap(tag)
        const name = textValue(tag.name, termId)
        const description = replaceCcTermPlaceholders(plainText(tag.desc), values, allValues)
        const keyId = stringValue(assignment.keyId)
        const lockIds = strings(assignment.lockIds)
        const conflictId = stringValue(assignment.conflictId)
        return {
          id: termId,
          groupId: stringValue(assignment.groupId, id),
          name,
          roman: stringValue(tag.romanNumSuffix),
          score: numberValue(tag.score),
          description,
          iconId: stringValue(tag.icon),
          effects,
          keyId,
          lockIds,
          conflictId,
          canPreview: assignment.canPreview === true,
          formationTip: plainText(tip.formationTip),
          battleTip: plainText(tip.battleHUDTip),
          searchText:
            `${name} ${termId} ${description} ${keyId} ${lockIds.join(' ')} ${conflictId}`.toLocaleLowerCase()
        }
      })
      return { id, terms }
    })
}

function rewardItems(rewardId: string, tables: TableSet): CcRewardItem[] {
  if (!rewardId) return []
  const reward = asRecord(tables.RewardTable?.[rewardId])
  return records(reward.itemBundles).map((bundle) => {
    const id = stringValue(bundle.id)
    const item = asRecord(tables.ItemTable?.[id])
    return {
      id,
      name: textValue(item.name, id),
      iconId: stringValue(item.iconId, id),
      rarity: numberValue(item.rarity),
      count: numberValue(bundle.count, 1)
    }
  })
}

function buildLevelRewards(
  tables: TableSet,
  gameId: string,
  scoreBands: readonly unknown[]
): CcLevelReward[] {
  const levelRow = asRecord(tables.ContingencyContractLevelTable?.[gameId])
  return Object.entries(asRecord(levelRow.levelMap))
    .map(([id, value]) => ({ id, row: asRecord(value) }))
    .toSorted((left, right) => numberValue(left.row.level) - numberValue(right.row.level))
    .map(({ id, row }, index) => {
      const rewardId = stringValue(row.firstReward)
      const scoreValue = scoreBands[index]
      return {
        id,
        level: numberValue(row.level),
        score: scoreValue === undefined ? null : numberValue(scoreValue),
        rewardId,
        rewards: rewardItems(rewardId, tables)
      }
    })
}

function buildShop(tables: TableSet, shopGroupId: string): CcShopGroup | null {
  const groupValue = tables.ShopGroupTable?.[shopGroupId]
  if (!groupValue) return null
  const group = asRecord(groupValue)
  const shops = strings(group.shopIds).flatMap((shopId): CcShop[] => {
    const shopValue = tables.ShopTable?.[shopId]
    if (!shopValue) return []
    const shop = asRecord(shopValue)
    const goods = strings(shop.shopGoodsIds).flatMap((goodsId): CcShopGood[] => {
      const goodsValue = tables.ShopGoodsTable?.[goodsId]
      if (!goodsValue) return []
      const row = asRecord(goodsValue)
      const currencyId = stringValue(row.moneyId)
      const currency = asRecord(tables.ItemTable?.[currencyId])
      const price = numberValue(row.price)
      const discount = numberValue(row.cnDiscount, 1)
      const hasDiscount = discount > 0 && discount < 1
      const limit = numberValue(row.limitCount)
      return [
        {
          id: goodsId,
          fallbackName: stringValue(row.goodsTagId, goodsId),
          rewards: rewardItems(stringValue(row.rewardId), tables),
          currencyId,
          currencyName: textValue(currency.name, currencyId),
          price,
          actualPrice: hasDiscount ? Math.ceil(price * discount) : price,
          discountPercent: hasDiscount ? Math.round((1 - discount) * 100) : 0,
          limitCount: limit > 0 ? limit : null
        }
      ]
    })
    return [{ id: shopId, name: textValue(shop.shopName, shopId), goods }]
  })
  if (shops.length === 0) return null
  return {
    id: shopGroupId,
    name: textValue(group.shopGroupName, shopGroupId),
    shops
  }
}

function buildTaskGroups(tables: TableSet): CcTaskGroup[] {
  const taskMap = Object.assign(
    {},
    ...Object.values(tables.ActivityConditionalMultiStageTaskConfigTable ?? {}).map((value) =>
      asRecord(asRecord(value).TaskConfigMap)
    )
  ) as RawRecord
  return Object.values(tables.ActivityContingencyContractTaskGroupTable ?? {})
    .map((value) => asRecord(value))
    .map((group): CcTaskGroup => {
      const id = stringValue(group.taskGroupId)
      const tasks = Object.values(taskMap)
        .map(asRecord)
        .filter((task) => stringValue(task.taskGroupId) === id)
        .map((task): CcTask => {
          const taskId = stringValue(task.taskId)
          return {
            id: taskId,
            description: plainText(task.desc, taskId),
            rewards: rewardItems(stringValue(task.rewardId), tables),
            sort: numberValue(task.sortId)
          }
        })
        .toSorted((left, right) => left.sort - right.sort || left.id.localeCompare(right.id, 'en'))
      return {
        id,
        name: textValue(group.name, id),
        iconId: stringValue(group.icon),
        canUpdate: group.canUpdate === true,
        configuredCount: numberValue(group.totalTaskNum, tasks.length),
        tasks,
        sort: numberValue(group.sortId)
      }
    })
    .toSorted((left, right) => left.sort - right.sort || left.id.localeCompare(right.id, 'en'))
}

export function buildCcDetailBase(tables: TableSet, entry: CcCatalogEntry): CcDetailBase {
  const activity = asRecord(tables.ActivityContingencyContractTable?.[entry.activityId])
  const configurationValues: Array<[CcActivityField['key'], unknown]> = [
    ['activityId', activity.activityId],
    ['gameplayType', activity.type],
    ['stageId', activity.gameplayEndStageId],
    ['maxTagColumns', activity.tagMaxColumn],
    ['currencyAmount', activity.compareToMoneyCount],
    ['shopGroup', activity.shopGroupId]
  ]
  const configuration = configurationValues
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({ key, value: stringValue(value) }))
  const groups = buildTerms(tables, entry.id)
  const terms = Object.fromEntries(groups.flatMap((group) => group.terms.map((term) => [term.id, term])))
  return {
    entry,
    configuration,
    groups,
    terms,
    levelRewards: buildLevelRewards(
      tables,
      entry.id,
      Array.isArray(activity.scoreBand) ? activity.scoreBand : []
    ),
    shop: buildShop(tables, stringValue(activity.shopGroupId)),
    taskGroups: buildTaskGroups(tables)
  }
}

export function availableCcKeys(
  selected: ReadonlySet<string>,
  terms: Readonly<Record<string, CcContractTerm>>
): Set<string> {
  return new Set([...selected].map((id) => terms[id]?.keyId ?? '').filter((key) => key !== ''))
}

export function ccTermAvailability(
  termId: string,
  selected: ReadonlySet<string>,
  terms: Readonly<Record<string, CcContractTerm>>
): CcTermAvailability {
  const term = terms[termId]
  if (!term) {
    return { selectable: false, reason: 'missing', conflictWith: '', missingKeys: [] }
  }
  if (selected.has(termId)) {
    return { selectable: true, reason: null, conflictWith: '', missingKeys: [] }
  }
  if (term.conflictId) {
    const conflictWith = [...selected].find(
      (id) => id !== termId && terms[id]?.conflictId === term.conflictId
    )
    if (conflictWith) {
      return { selectable: false, reason: 'conflict', conflictWith, missingKeys: [] }
    }
  }
  const keys = availableCcKeys(selected, terms)
  const missingKeys = term.lockIds.filter((key) => !keys.has(key))
  if (missingKeys.length) {
    return { selectable: false, reason: 'keys', conflictWith: '', missingKeys }
  }
  return { selectable: true, reason: null, conflictWith: '', missingKeys: [] }
}

export function toggleCcTerm(
  selectedValue: ReadonlySet<string>,
  termId: string,
  terms: Readonly<Record<string, CcContractTerm>>
): CcSelectionResult {
  const selected = new Set(selectedValue)
  if (selected.has(termId)) {
    selected.delete(termId)
    let changed = true
    while (changed) {
      changed = false
      for (const id of [...selected]) {
        const availability = ccTermAvailability(
          id,
          new Set([...selected].filter((candidate) => candidate !== id)),
          terms
        )
        if (!availability.selectable) {
          selected.delete(id)
          changed = true
        }
      }
    }
    return { selected, changed: true, rejected: null }
  }
  const availability = ccTermAvailability(termId, selected, terms)
  if (!availability.selectable) return { selected, changed: false, rejected: availability }
  selected.add(termId)
  return { selected, changed: true, rejected: null }
}

export function ccSelectionScore(
  selected: ReadonlySet<string>,
  terms: Readonly<Record<string, CcContractTerm>>
): number {
  return [...selected].reduce((total, id) => total + (terms[id]?.score ?? 0), 0)
}
