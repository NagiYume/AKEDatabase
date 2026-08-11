export type RawRecord = Record<string, unknown>
export type RawTable = Record<string, unknown>
export type TableSet = Record<string, RawTable>
export type LocaleMaps = Readonly<Record<string, Readonly<Record<string, string>>>>

export type CatalogModuleId =
  | 'v3_weapon'
  | 'v3_character'
  | 'v3_enemy'
  | 'v3_equip'
  | 'v3_item'
  | 'v3_shop'
  | 'v3_achievement'
  | 'v3_dungeon'
  | 'v3_activity'
  | 'v3_cc'

export interface CatalogDefinition {
  id: CatalogModuleId
  titleKey: string
  descriptionKey: string
  primaryTable: string
  idField: string
  listTables: readonly string[]
  detailTables: readonly string[]
  levelKind?: 'character' | 'weapon' | 'enemy'
}

export interface CatalogEntry {
  id: string
  name: string
  subtitle: string
  rarity: number
  category: string
  categoryLabel: string
  icon: string
  priority: number
  hidden: boolean
  searchText: string
  source: RawRecord
  facets?: Readonly<Record<string, CatalogFacetValue>>
  changeType?: 'added' | 'modified'
}

export interface CatalogFacetValue {
  value: string
  label: string
}

export interface FieldDiff {
  path: string
  before: unknown
  after: unknown
  type: 'added' | 'removed' | 'changed'
}

export type CatalogLevelKind = NonNullable<CatalogDefinition['levelKind']>

export interface CatalogAttributeModifier {
  attrType: number
  modifierType: number
  attrValue: number
}

export interface CatalogLevelAttribute {
  id: string
  attrType: number
  label: string
  value: number
  rawValue: number
  modified: boolean
}

export interface CatalogLevelSnapshot {
  kind: CatalogLevelKind
  requestedLevel: number
  resolvedLevel: number
  sourceId: string
  attributes: readonly CatalogLevelAttribute[]
}

export interface RichTextToken {
  type: 'text' | 'break' | 'image'
  value: string
  color?: string
  scale?: number
  strong?: boolean
}

const CHARACTER_DETAIL_TABLES = [
  'CharacterTable',
  'CharGrowthTable',
  'CharacterPotentialTable',
  'PotentialTalentEffectTable',
  'SkillPatchTable',
  'SpaceshipCharSkillTable',
  'SpaceshipSkillTable',
  'ItemTable',
  'CharProfessionTable'
] as const

const WEAPON_DETAIL_TABLES = [
  'WeaponBasicTable',
  'ItemTable',
  'SkillPatchTable',
  'WeaponBreakThroughTemplateTable',
  'WeaponUpgradeTemplateTable',
  'WeaponUpgradeTemplateSumTable',
  'WeaponTalentTemplateTable'
] as const

const ENEMY_DETAIL_TABLES = [
  'EnemyTemplateDisplayInfoTable',
  'EnemyTable',
  'EnemyAttributeTemplateTable',
  'EnemyAbilityDescTable',
  'DisplayEnemyTypeTable',
  'DistributionInfoTable'
] as const

const EQUIP_DETAIL_TABLES = [
  'EquipSuitTable',
  'EquipTable',
  'ItemTable',
  'SkillPatchTable',
  'EquipFormulaTable',
  'EquipFormulaReverseTable',
  'EquipFormulaChainTable',
  'EquipPackTable',
  'EquipPackFormulaTable',
  'EquipEnhanceCostTable',
  'EquipEnhanceGuaranteeTimesRuleTable',
  'EquipConst',
  'EquipTechConst'
] as const

const ITEM_DETAIL_TABLES = [
  'ItemTable',
  'ItemTypeTable',
  'SystemJumpTable',
  'ItemIconCompositeTable',
  'ItemShowingTypeTable',
  'WeaponPotentialUpItemTable',
  'UsableItemChestTable',
  'WikiEntryDataTable',
  'UseItemTable',
  'EquipItemTable',
  'FactoryMachineCraftTable',
  'FactoryMachineCraftGroupTable',
  'FactoryManualCraftTable',
  'FactoryHubCraftTable',
  'FactoryBuildingTable',
  'EquipFormulaTable',
  'SpaceshipGrowCabinFormulaTable',
  'SpaceshipGrowCabinSeedFormulaTable',
  'SpaceshipManufactureFormulaTable'
] as const

export const CATALOG_DEFINITIONS: Readonly<Record<CatalogModuleId, CatalogDefinition>> = Object.freeze({
  v3_character: {
    id: 'v3_character',
    titleKey: 'modules.character.title',
    descriptionKey: 'modules.character.description',
    primaryTable: 'CharacterTable',
    idField: 'charId',
    listTables: ['CharacterTable', 'CharGrowthTable'],
    detailTables: CHARACTER_DETAIL_TABLES,
    levelKind: 'character'
  },
  v3_weapon: {
    id: 'v3_weapon',
    titleKey: 'modules.weapon.title',
    descriptionKey: 'modules.weapon.description',
    primaryTable: 'WeaponBasicTable',
    idField: 'weaponId',
    listTables: ['WeaponBasicTable', 'ItemTable'],
    detailTables: WEAPON_DETAIL_TABLES,
    levelKind: 'weapon'
  },
  v3_enemy: {
    id: 'v3_enemy',
    titleKey: 'modules.enemy.title',
    descriptionKey: 'modules.enemy.description',
    primaryTable: 'EnemyTemplateDisplayInfoTable',
    idField: 'templateId',
    listTables: ['EnemyTemplateDisplayInfoTable', 'EnemyTable', 'DisplayEnemyTypeTable'],
    detailTables: ENEMY_DETAIL_TABLES,
    levelKind: 'enemy'
  },
  v3_equip: {
    id: 'v3_equip',
    titleKey: 'modules.equip.title',
    descriptionKey: 'modules.equip.description',
    primaryTable: 'EquipSuitTable',
    idField: 'suitID',
    listTables: ['EquipSuitTable', 'EquipTable', 'ItemTable'],
    detailTables: EQUIP_DETAIL_TABLES
  },
  v3_item: {
    id: 'v3_item',
    titleKey: 'modules.item.title',
    descriptionKey: 'modules.item.description',
    primaryTable: 'ItemTable',
    idField: 'id',
    listTables: [
      'ItemTable',
      'ItemTypeTable',
      'ItemShowingTypeTable',
      'ItemListByTypeTable',
      'ItemListByShowingTypeTable'
    ],
    detailTables: ITEM_DETAIL_TABLES
  },
  v3_shop: {
    id: 'v3_shop',
    titleKey: 'modules.shop.title',
    descriptionKey: 'modules.shop.description',
    primaryTable: 'ShopGroupTable',
    idField: 'shopGroupId',
    listTables: ['ShopGroupTable', 'ShopTable', 'ShopGoodsTable'],
    detailTables: [
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
    ]
  },
  v3_achievement: {
    id: 'v3_achievement',
    titleKey: 'modules.achievement.title',
    descriptionKey: 'modules.achievement.description',
    primaryTable: 'AchievementTypeTable',
    idField: 'categoryId',
    listTables: ['AchievementTypeTable', 'AchievementTable'],
    detailTables: ['AchievementTypeTable', 'AchievementTable']
  },
  v3_dungeon: {
    id: 'v3_dungeon',
    titleKey: 'modules.dungeon.title',
    descriptionKey: 'modules.dungeon.description',
    primaryTable: 'DungeonSeriesTable',
    idField: 'id',
    listTables: ['DungeonSeriesTable', 'DungeonTable'],
    detailTables: [
      'DungeonSeriesTable',
      'DungeonTable',
      'RewardTable',
      'ItemTable',
      'EnemyTable',
      'EnemyTemplateDisplayInfoTable',
      'EnemyAttributeTemplateTable'
    ]
  },
  v3_activity: {
    id: 'v3_activity',
    titleKey: 'modules.activity.title',
    descriptionKey: 'modules.activity.description',
    primaryTable: 'ActivityTable',
    idField: 'id',
    listTables: ['ActivityTable', 'ActivityTagTable', 'TimeRangeTable'],
    detailTables: [
      'ActivityTable',
      'ActivityTagTable',
      'RewardTable',
      'ItemTable',
      'ActivityConditionalMultiStageTable',
      'ActivityDungeonFightingStageTable',
      'DungeonTable',
      'TimeRangeTable'
    ]
  },
  v3_cc: {
    id: 'v3_cc',
    titleKey: 'modules.cc.title',
    descriptionKey: 'modules.cc.description',
    primaryTable: 'ActivityContingencyContractTable',
    idField: 'gameId',
    listTables: [
      'ActivityContingencyContractTable',
      'ActivityTable',
      'DungeonTable',
      'ContingencyContractTable',
      'TimeRangeTable'
    ],
    detailTables: [
      'ActivityContingencyContractTable',
      'ContingencyContractTable',
      'CcTagTable',
      'CcTagTipTable',
      'ContingencyContractKeyLockTable',
      'ContingencyContractLevelTable',
      'RewardTable',
      'ItemTable',
      'ActivityContingencyContractTaskGroupTable',
      'ActivityConditionalMultiStageTaskConfigTable',
      'ShopGroupTable',
      'ShopTable',
      'ShopGoodsTable'
    ]
  }
})

export function asRecord(value: unknown): RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawRecord) : {}
}

export function tableRecords(table: RawTable | undefined): [string, RawRecord][] {
  return Object.entries(table ?? {}).map(([key, value]) => [key, asRecord(value)])
}

export function textValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  const record = asRecord(value)
  if (typeof record.text === 'string' && record.text.trim()) return record.text
  if (typeof record.name === 'string' && record.name.trim()) return record.name
  return fallback
}

export function hydrateTextReferences<T>(value: T, texts: Readonly<Record<string, string>>): T {
  if (Array.isArray(value)) return value.map((item) => hydrateTextReferences(item, texts)) as T
  if (!value || typeof value !== 'object') return value
  const source = value as RawRecord
  const output: RawRecord = {}
  for (const [key, child] of Object.entries(source)) output[key] = hydrateTextReferences(child, texts)
  if ('id' in source && 'text' in source && !textValue(source.text)) {
    output.text = texts[String(source.id)] ?? ''
  }
  return output as T
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, function replacer(key, child: unknown) {
    if (typeof child === 'bigint') return child.toString()
    if (key === 'text' && typeof this === 'object' && this !== null && 'id' in this) return undefined
    if (child && typeof child === 'object') {
      if (seen.has(child)) return '[Circular]'
      seen.add(child)
      if (!Array.isArray(child)) {
        return Object.fromEntries(
          Object.entries(child as RawRecord).toSorted(([left], [right]) => left.localeCompare(right, 'en'))
        )
      }
    }
    return child
  })
}

export function deepDiff(before: unknown, after: unknown, path = '', output: FieldDiff[] = []): FieldDiff[] {
  if (stableStringify(before) === stableStringify(after)) return output
  if (
    Array.isArray(before) ||
    Array.isArray(after) ||
    !before ||
    !after ||
    typeof before !== 'object' ||
    typeof after !== 'object'
  ) {
    output.push({
      path: path || '$',
      before,
      after,
      type: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed'
    })
    return output
  }
  const left = before as RawRecord
  const right = after as RawRecord
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    deepDiff(left[key], right[key], path ? `${path}.${key}` : key, output)
  }
  return output
}

function imagePath(kind: 'character' | 'weapon' | 'enemy' | 'item', id: string, iconId = ''): string {
  const root = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites'
  if (kind === 'character') return `${root}/charremoteicon/icon_${id}.png`
  if (kind === 'enemy') return `${root}/monstericonbig/${id}.png`
  return `${root}/itemiconbig/${iconId || id}.png`
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function createEntry(
  entry: Omit<CatalogEntry, 'searchText' | 'source'> & { source: RawRecord }
): CatalogEntry {
  return {
    ...entry,
    searchText: [entry.id, entry.name, entry.subtitle, entry.categoryLabel].join('\n').toLocaleLowerCase(),
    source: entry.source
  }
}

function sourceId(key: string, row: RawRecord, field: string): string {
  const value = row[field]
  return value === undefined || value === null || value === '' ? key : String(value)
}

function mappedValue(maps: LocaleMaps, mapNames: readonly string[], value: unknown): string {
  const key = String(value ?? '')
  for (const mapName of mapNames) {
    const mapped = maps[mapName]?.[key]
    if (mapped) return mapped
  }
  return key
}

export function buildCatalogEntries(
  definition: CatalogDefinition,
  tables: TableSet,
  maps: LocaleMaps = {}
): CatalogEntry[] {
  const primary = tableRecords(tables[definition.primaryTable])
  const items = tables.ItemTable ?? {}
  const growth = tables.CharGrowthTable ?? {}
  const enemies = tables.EnemyTable ?? {}
  const types = tables.DisplayEnemyTypeTable ?? {}
  const activities = tables.ActivityTable ?? {}
  const dungeons = tables.DungeonTable ?? {}
  const times = tables.TimeRangeTable ?? {}
  const achievements = tables.AchievementTable ?? {}

  if (definition.id === 'v3_equip') {
    const assigned = new Set(
      primary.flatMap(([, row]) => (Array.isArray(row.equipList) ? row.equipList.map(String) : []))
    )
    const independent = Object.keys(tables.EquipTable ?? {}).filter((equipId) => !assigned.has(equipId))
    if (independent.length) {
      primary.unshift([
        'suit_none',
        { suitID: 'suit_none', equipList: independent, list: [], isIndependentGroup: true }
      ])
    }
  }

  const itemTypes = tables.ItemTypeTable ?? {}
  const itemShowingTypes = tables.ItemShowingTypeTable ?? {}
  const itemTypeByItem = new Map<string, string>()
  const itemShowingTypeByItem = new Map<string, string>()
  for (const [type, value] of tableRecords(tables.ItemListByTypeTable)) {
    const list = Array.isArray(value.list) ? value.list : []
    list.forEach((itemId) => itemTypeByItem.set(String(itemId), type))
  }
  for (const [type, value] of tableRecords(tables.ItemListByShowingTypeTable)) {
    const list = Array.isArray(value.list) ? value.list : []
    list.forEach((itemId) => itemShowingTypeByItem.set(String(itemId), type))
  }

  const rows = primary.map(([key, row], index): CatalogEntry => {
    const id = sourceId(key, row, definition.idField)
    let name = textValue(row.name, id)
    let subtitle = ''
    let rarity = numberValue(row.rarity, 1)
    let category = String(row.type ?? row.gameCategory ?? row.displayType ?? '')
    let categoryLabel = category
    let icon = ''
    let facets: Record<string, CatalogFacetValue> = {}
    let source: RawRecord = row

    if (definition.id === 'v3_character') {
      const grow = asRecord(growth[id])
      category = String(grow.profession ?? row.profession ?? '')
      categoryLabel = mappedValue(maps, ['profession_map', 'profession_id_map'], category)
      subtitle = textValue(row.engName, mappedValue(maps, ['weapon_map', 'weapon_id_map'], grow.weaponType))
      icon = imagePath('character', id)
      const element = String(grow.charTypeId ?? row.charTypeId ?? '')
      const profession = String(grow.profession ?? row.profession ?? '')
      const weapon = String(grow.weaponType ?? row.weaponType ?? '')
      facets = {
        element: { value: element, label: mappedValue(maps, ['char_type_map'], element) },
        profession: {
          value: profession,
          label: mappedValue(maps, ['profession_id_map', 'profession_map'], profession)
        },
        weapon: { value: weapon, label: mappedValue(maps, ['weapon_id_map', 'weapon_map'], weapon) }
      }
      source = { character: row, growth: grow }
    } else if (definition.id === 'v3_weapon') {
      const item = asRecord(items[id])
      name = textValue(item.name, id)
      subtitle = String(row.weaponType ?? '')
      category = subtitle
      categoryLabel = mappedValue(maps, ['weapon_map', 'weapon_id_map'], subtitle)
      icon = imagePath('weapon', id, String(item.iconId ?? ''))
      facets = { type: { value: category, label: categoryLabel } }
      source = { weapon: row, item }
    } else if (definition.id === 'v3_enemy') {
      const displayType = numberValue(row.displayType)
      const rarityMap: Record<number, number> = { 0: 2, 3: 3, 1: 4, 4: 5, 2: 6 }
      rarity = rarityMap[displayType] ?? 1
      const type = asRecord(types[String(row.displayType)])
      category = String(row.displayType ?? '')
      categoryLabel = textValue(type.name, category)
      subtitle = `${Object.values(enemies).filter((value) => asRecord(value).templateId === id).length}`
      icon = imagePath('enemy', id)
      source = {
        display: row,
        variants: Object.fromEntries(
          Object.entries(enemies).filter(([, value]) => String(asRecord(value).templateId ?? '') === id)
        ),
        type
      }
    } else if (definition.id === 'v3_equip') {
      const equipIds = Array.isArray(row.equipList) ? row.equipList.map(String) : []
      const representative = equipIds
        .map((equipId) => ({ id: equipId, item: asRecord(items[equipId]) }))
        .toSorted((a, b) => numberValue(b.item.rarity) - numberValue(a.item.rarity))[0]
      const firstSuit = Array.isArray(row.list) ? asRecord(row.list[0]) : {}
      name = textValue(firstSuit.suitName, id)
      rarity = numberValue(representative?.item.rarity, 1)
      subtitle = String(equipIds.length)
      category = id === 'suit_none' ? 'independent' : 'suit'
      categoryLabel = category
      facets = { equipmentCount: { value: String(equipIds.length), label: String(equipIds.length) } }
      icon = representative
        ? imagePath('item', representative.id, String(representative.item.iconId ?? ''))
        : ''
      source = {
        suit: row,
        equips: pickTableRows(tables.EquipTable, equipIds),
        items: pickTableRows(items, equipIds)
      }
    } else if (definition.id === 'v3_item') {
      name = textValue(row.name, id)
      subtitle = textValue(row.desc)
      const showingType = itemShowingTypeByItem.get(id) ?? String(row.showingType ?? 0)
      const type = itemTypeByItem.get(id) ?? String(row.type ?? '')
      const showing = asRecord(itemShowingTypes[showingType])
      const itemType = asRecord(itemTypes[type])
      const useShowingType = Object.keys(showing).length > 0 && showingType !== '0'
      category = useShowingType ? `showing:${showingType}` : `type:${type}`
      categoryLabel = textValue(
        showing.name,
        textValue(itemType.name, mappedValue(maps, ['item_type_map'], type))
      )
      facets = {
        overviewOrder: {
          value: String(useShowingType ? numberValue(showing.sortId) : 1_000 + numberValue(type)),
          label: categoryLabel
        }
      }
      icon = imagePath('item', id, String(row.iconId ?? ''))
      source = { item: row, itemType, showing }
    } else if (definition.id === 'v3_shop') {
      name = textValue(row.name, textValue(row.shopGroupName, id))
      subtitle = String(Array.isArray(row.shopIds) ? row.shopIds.length : '')
      category = String(row.type ?? 'shop')
      categoryLabel = category
    } else if (definition.id === 'v3_achievement') {
      name = textValue(row.categoryName, id)
      const groupIds = new Set(
        (Array.isArray(row.achievementGroupData) ? row.achievementGroupData : []).map((group) =>
          String(asRecord(group).groupId)
        )
      )
      const related = Object.entries(achievements).filter(([, value]) =>
        groupIds.has(String(asRecord(value).groupId))
      )
      subtitle = String(related.length)
      rarity = 1
      category = 'achievement'
      categoryLabel = category
      facets = {
        groupCount: { value: String(groupIds.size), label: String(groupIds.size) },
        platedCount: {
          value: String(related.filter(([, value]) => asRecord(value).canBePlated === true).length),
          label: ''
        }
      }
      const first = related[0]
      if (first) {
        const level = Object.values(
          asRecord(first[1]).levelInfos ? asRecord(asRecord(first[1]).levelInfos) : {}
        )[0]
        const achieveLevel = numberValue(asRecord(level).achieveLevel, 1)
        icon = `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/medaliconbig/${first[0]}_lv${String(achieveLevel).padStart(2, '0')}.png`
      }
      source = { category: row, relatedAchievements: Object.fromEntries(related) }
    } else if (definition.id === 'v3_dungeon') {
      name = textValue(row.name, id)
      subtitle = textValue(row.desc)
      category = String(row.gameCategory ?? row.dungeonCategory ?? '')
      categoryLabel = category
      rarity =
        row.gameCategory === 'dungeon_highdifficulty' ? 6 : row.gameCategory === 'dungeon_bossrush' ? 5 : 2
    } else if (definition.id === 'v3_activity') {
      name = textValue(row.name, id)
      subtitle = textValue(row.desc)
      category = String(row.type ?? '')
      categoryLabel = category
      icon = row.tabImg
        ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${String(row.tabImg)}.png`
        : ''
      const timeRecord = asRecord(times[String(row.timeId)])
      const timeRanges = Array.isArray(timeRecord.timeRangeList) ? timeRecord.timeRangeList : []
      const range = asRecord(timeRanges[0])
      const now = Date.now()
      const open = Date.parse(String(range.openTime ?? ''))
      const close = Date.parse(String(range.closeTime ?? ''))
      rarity = Number.isFinite(close) && close < now ? 1 : Number.isFinite(open) && open > now ? 2 : 3
    } else if (definition.id === 'v3_cc') {
      const activity = asRecord(activities[String(row.activityId)])
      const dungeon = asRecord(dungeons[id])
      name = textValue(activity.name, id)
      subtitle = textValue(dungeon.dungeonName)
      category = 'contract'
      categoryLabel = category
      icon = activity.tabImg
        ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${String(activity.tabImg)}.png`
        : ''
    }

    return createEntry({
      id,
      name,
      subtitle,
      rarity,
      category,
      categoryLabel,
      icon,
      priority: numberValue(row.sortOrder ?? row.sortId ?? row.categoryPriority, index + 1),
      hidden: row.hidden === true,
      source,
      facets
    })
  })

  if (definition.id === 'v3_achievement') {
    return rows.toSorted(
      (left, right) => left.priority - right.priority || left.id.localeCompare(right.id, 'en')
    )
  }
  if (
    definition.id === 'v3_character' ||
    definition.id === 'v3_weapon' ||
    definition.id === 'v3_enemy' ||
    definition.id === 'v3_equip' ||
    definition.id === 'v3_item'
  ) {
    return rows.toSorted((left, right) => right.rarity - left.rarity || left.id.localeCompare(right.id, 'en'))
  }
  return rows.toSorted(
    (left, right) =>
      right.rarity - left.rarity || left.priority - right.priority || left.id.localeCompare(right.id, 'en')
  )
}

export function filterCatalogEntries(
  entries: readonly CatalogEntry[],
  options: {
    search?: string
    rarities?: ReadonlySet<number>
    categories?: ReadonlySet<string>
    showHidden?: boolean
  }
): CatalogEntry[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  return entries.filter((entry) => {
    if (!options.showHidden && entry.hidden) return false
    if (search && !entry.searchText.includes(search)) return false
    if (options.rarities?.size && !options.rarities.has(entry.rarity)) return false
    if (options.categories?.size && !options.categories.has(entry.category)) return false
    return true
  })
}

export function containsReference(value: unknown, id: string, depth = 0): boolean {
  if (depth > 7) return false
  if (
    String(value) === id &&
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint')
  )
    return true
  if (Array.isArray(value)) return value.some((child) => containsReference(child, id, depth + 1))
  if (!value || typeof value !== 'object') return false
  return Object.values(value).some((child) => containsReference(child, id, depth + 1))
}

function pickTableRows(table: RawTable | undefined, ids: Iterable<unknown>): RawTable {
  const selected: RawTable = {}
  for (const value of ids) {
    const id = String(value ?? '')
    if (id && table && Object.hasOwn(table, id)) selected[id] = table[id]
  }
  return selected
}

function addDetailTable(target: TableSet, name: string, rows: RawTable): void {
  if (Object.keys(rows).length) target[name] = rows
}

function buildCharacterDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const character = asRecord(tables.CharacterTable?.[id])
  const growth = asRecord(tables.CharGrowthTable?.[id])
  const potential = asRecord(tables.CharacterPotentialTable?.[id])
  addDetailTable(result, 'CharacterTable', pickTableRows(tables.CharacterTable, [id]))
  addDetailTable(result, 'CharGrowthTable', pickTableRows(tables.CharGrowthTable, [id]))
  addDetailTable(result, 'CharacterPotentialTable', pickTableRows(tables.CharacterPotentialTable, [id]))

  const talentIds = Object.values(asRecord(growth.talentNodeMap))
    .map((node) => String(asRecord(asRecord(node).passiveSkillNodeInfo).talentEffectId ?? ''))
    .filter(Boolean)
  const potentialRows = Array.isArray(potential.potentialUnlockBundle)
    ? potential.potentialUnlockBundle.map(asRecord)
    : []
  const potentialIds = potentialRows.map((row) => String(row.potentialEffectId ?? '')).filter(Boolean)
  addDetailTable(
    result,
    'PotentialTalentEffectTable',
    pickTableRows(tables.PotentialTalentEffectTable, [...talentIds, ...potentialIds])
  )

  const skillIds = new Set<string>(potentialIds)
  for (const group of Object.values(asRecord(growth.skillGroupMap)).map(asRecord)) {
    if (Array.isArray(group.skillIdList))
      group.skillIdList.forEach((skillId) => skillIds.add(String(skillId)))
    if (group.skillGroupId) skillIds.add(String(group.skillGroupId))
  }
  addDetailTable(result, 'SkillPatchTable', pickTableRows(tables.SkillPatchTable, skillIds))

  const spaceshipCharacter = asRecord(tables.SpaceshipCharSkillTable?.[id])
  addDetailTable(result, 'SpaceshipCharSkillTable', pickTableRows(tables.SpaceshipCharSkillTable, [id]))
  const spaceshipIds = Array.isArray(spaceshipCharacter.skillList)
    ? spaceshipCharacter.skillList.map((row) => asRecord(row).skillId)
    : []
  addDetailTable(result, 'SpaceshipSkillTable', pickTableRows(tables.SpaceshipSkillTable, spaceshipIds))

  const itemIds = new Set<string>([id, 'item_gold'])
  for (const node of Object.values(asRecord(growth.talentNodeMap)).map(asRecord)) {
    if (Array.isArray(node.requiredItem)) {
      node.requiredItem.forEach((item) => itemIds.add(String(asRecord(item).id ?? '')))
    }
  }
  potentialRows.forEach((row) => {
    if (Array.isArray(row.itemIds)) row.itemIds.forEach((itemId) => itemIds.add(String(itemId)))
  })
  if (Array.isArray(growth.skillLevelUp)) {
    growth.skillLevelUp.map(asRecord).forEach((level) => {
      if (Array.isArray(level.itemBundle)) {
        level.itemBundle.forEach((item) => itemIds.add(String(asRecord(item).id ?? '')))
      }
    })
  }
  addDetailTable(result, 'ItemTable', pickTableRows(tables.ItemTable, itemIds))
  addDetailTable(
    result,
    'CharProfessionTable',
    pickTableRows(tables.CharProfessionTable, [character.profession, growth.profession])
  )
  return result
}

function buildWeaponDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const weapon = asRecord(tables.WeaponBasicTable?.[id])
  const breakthroughId = String(weapon.breakthroughTemplateId ?? '')
  const breakthrough = asRecord(tables.WeaponBreakThroughTemplateTable?.[breakthroughId])
  const materialIds = Array.isArray(breakthrough.list)
    ? breakthrough.list.flatMap((row) => {
        const items = asRecord(row).breakItemList
        return Array.isArray(items) ? items.map((item) => asRecord(item).id) : []
      })
    : []
  addDetailTable(result, 'WeaponBasicTable', pickTableRows(tables.WeaponBasicTable, [id]))
  addDetailTable(result, 'ItemTable', pickTableRows(tables.ItemTable, [id, ...materialIds]))
  addDetailTable(
    result,
    'SkillPatchTable',
    pickTableRows(tables.SkillPatchTable, Array.isArray(weapon.weaponSkillList) ? weapon.weaponSkillList : [])
  )
  addDetailTable(
    result,
    'WeaponBreakThroughTemplateTable',
    pickTableRows(tables.WeaponBreakThroughTemplateTable, [breakthroughId])
  )
  addDetailTable(
    result,
    'WeaponUpgradeTemplateTable',
    pickTableRows(tables.WeaponUpgradeTemplateTable, [weapon.levelTemplateId])
  )
  addDetailTable(
    result,
    'WeaponUpgradeTemplateSumTable',
    pickTableRows(tables.WeaponUpgradeTemplateSumTable, [weapon.levelTemplateId])
  )
  addDetailTable(
    result,
    'WeaponTalentTemplateTable',
    pickTableRows(tables.WeaponTalentTemplateTable, [weapon.talentTemplateId])
  )
  return result
}

function buildEnemyDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const display = asRecord(tables.EnemyTemplateDisplayInfoTable?.[id])
  const variants = Object.fromEntries(
    tableRecords(tables.EnemyTable).filter(([, row]) => String(row.templateId ?? '') === id)
  )
  const attrIds = new Set<string>([id])
  Object.values(variants)
    .map(asRecord)
    .forEach((row) => {
      if (row.attrTemplateId) attrIds.add(String(row.attrTemplateId))
    })
  addDetailTable(
    result,
    'EnemyTemplateDisplayInfoTable',
    pickTableRows(tables.EnemyTemplateDisplayInfoTable, [id])
  )
  addDetailTable(result, 'EnemyTable', variants)
  addDetailTable(
    result,
    'EnemyAttributeTemplateTable',
    pickTableRows(tables.EnemyAttributeTemplateTable, attrIds)
  )
  addDetailTable(
    result,
    'EnemyAbilityDescTable',
    pickTableRows(
      tables.EnemyAbilityDescTable,
      Array.isArray(display.abilityDescIds) ? display.abilityDescIds : []
    )
  )
  addDetailTable(
    result,
    'DisplayEnemyTypeTable',
    pickTableRows(tables.DisplayEnemyTypeTable, [display.displayType])
  )
  addDetailTable(
    result,
    'DistributionInfoTable',
    pickTableRows(
      tables.DistributionInfoTable,
      Array.isArray(display.distributionIds) ? display.distributionIds : []
    )
  )
  return result
}

function collectExistingTableReferences(
  value: unknown,
  table: RawTable | undefined,
  output: Set<string>,
  depth = 0
): void {
  if (!table || depth > 8) return
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    const id = String(value)
    if (Object.hasOwn(table, id)) output.add(id)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child) => collectExistingTableReferences(child, table, output, depth + 1))
    return
  }
  if (!value || typeof value !== 'object') return
  Object.values(value).forEach((child) => collectExistingTableReferences(child, table, output, depth + 1))
}

function buildEquipDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const suits = tables.EquipSuitTable ?? {}
  let suit = asRecord(suits[id])
  if (!Object.keys(suit).length && id === 'suit_none') {
    const assigned = new Set(
      tableRecords(suits).flatMap(([, row]) =>
        Array.isArray(row.equipList) ? row.equipList.map(String) : []
      )
    )
    suit = {
      suitID: id,
      equipList: Object.keys(tables.EquipTable ?? {}).filter((equipId) => !assigned.has(equipId)),
      list: []
    }
  }
  const equipIds = Array.isArray(suit.equipList) ? suit.equipList.map(String) : []
  const equipRows = pickTableRows(tables.EquipTable, equipIds)
  const reverse = tables.EquipFormulaReverseTable ?? {}
  const formulaIds = equipIds.map((equipId) => String(reverse[equipId] ?? '')).filter(Boolean)
  const formulaRows = pickTableRows(tables.EquipFormulaTable, formulaIds)
  const formulaLevels = Object.values(formulaRows)
    .map((formula) => String(asRecord(formula).level ?? ''))
    .filter(Boolean)
  const formulaChainRows = pickTableRows(tables.EquipFormulaChainTable, formulaLevels)
  const packIds = Object.values(formulaRows)
    .map((formula) => String(asRecord(formula).packId ?? ''))
    .filter(Boolean)
  const skillIds = Array.isArray(suit.list)
    ? suit.list.map((value) => String(asRecord(value).skillID ?? '')).filter(Boolean)
    : []
  const itemIds = new Set<string>(equipIds)
  collectExistingTableReferences(formulaChainRows, tables.ItemTable, itemIds)

  result.EquipSuitTable = { [id]: suit }
  addDetailTable(result, 'EquipTable', equipRows)
  addDetailTable(result, 'ItemTable', pickTableRows(tables.ItemTable, itemIds))
  addDetailTable(result, 'SkillPatchTable', pickTableRows(tables.SkillPatchTable, skillIds))
  addDetailTable(result, 'EquipFormulaTable', formulaRows)
  addDetailTable(result, 'EquipFormulaReverseTable', pickTableRows(reverse, equipIds))
  addDetailTable(result, 'EquipFormulaChainTable', formulaChainRows)
  addDetailTable(result, 'EquipPackTable', pickTableRows(tables.EquipPackTable, packIds))
  addDetailTable(result, 'EquipPackFormulaTable', pickTableRows(tables.EquipPackFormulaTable, packIds))
  for (const tableName of [
    'EquipEnhanceCostTable',
    'EquipEnhanceGuaranteeTimesRuleTable',
    'EquipConst',
    'EquipTechConst'
  ] as const) {
    addDetailTable(result, tableName, tables[tableName] ?? {})
  }
  return result
}

function relatedTableRows(table: RawTable | undefined, id: string): RawTable {
  return Object.fromEntries(tableRecords(table).filter(([, value]) => containsReference(value, id)))
}

function buildItemDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const item = asRecord(tables.ItemTable?.[id])
  const recipeTableNames = [
    'FactoryMachineCraftTable',
    'FactoryManualCraftTable',
    'FactoryHubCraftTable',
    'EquipFormulaTable',
    'SpaceshipGrowCabinFormulaTable',
    'SpaceshipGrowCabinSeedFormulaTable',
    'SpaceshipManufactureFormulaTable'
  ] as const
  const recipeRowsByTable = new Map<string, RawTable>()
  const itemIds = new Set<string>([id])
  for (const tableName of recipeTableNames) {
    const rows = relatedTableRows(tables[tableName], id)
    recipeRowsByTable.set(tableName, rows)
    collectExistingTableReferences(rows, tables.ItemTable, itemIds)
  }
  const machineRows = recipeRowsByTable.get('FactoryMachineCraftTable') ?? {}
  const machineGroupIds = Object.values(machineRows)
    .map((value) => String(asRecord(value).formulaGroupId ?? ''))
    .filter(Boolean)
  const machineIds = Object.values(machineRows)
    .map((value) => String(asRecord(value).machineId ?? ''))
    .filter(Boolean)

  addDetailTable(result, 'ItemTable', pickTableRows(tables.ItemTable, itemIds))
  addDetailTable(result, 'ItemTypeTable', pickTableRows(tables.ItemTypeTable, [item.type]))
  addDetailTable(
    result,
    'SystemJumpTable',
    pickTableRows(tables.SystemJumpTable, Array.isArray(item.obtainWayIds) ? item.obtainWayIds : [])
  )
  addDetailTable(
    result,
    'ItemIconCompositeTable',
    pickTableRows(tables.ItemIconCompositeTable, [item.iconCompositeId])
  )
  addDetailTable(
    result,
    'ItemShowingTypeTable',
    pickTableRows(tables.ItemShowingTypeTable, [item.showingType])
  )
  addDetailTable(result, 'UseItemTable', pickTableRows(tables.UseItemTable, [id]))
  addDetailTable(result, 'EquipItemTable', pickTableRows(tables.EquipItemTable, [id]))
  addDetailTable(result, 'WeaponPotentialUpItemTable', pickTableRows(tables.WeaponPotentialUpItemTable, [id]))
  addDetailTable(result, 'UsableItemChestTable', pickTableRows(tables.UsableItemChestTable, [id]))
  addDetailTable(
    result,
    'WikiEntryDataTable',
    Object.fromEntries(
      tableRecords(tables.WikiEntryDataTable).filter(
        ([, wikiEntry]) => String(wikiEntry.refItemId ?? '') === id
      )
    )
  )
  for (const [tableName, rows] of recipeRowsByTable) addDetailTable(result, tableName, rows)
  addDetailTable(
    result,
    'FactoryMachineCraftGroupTable',
    pickTableRows(tables.FactoryMachineCraftGroupTable, machineGroupIds)
  )
  addDetailTable(result, 'FactoryBuildingTable', pickTableRows(tables.FactoryBuildingTable, machineIds))
  return result
}

function buildAchievementDetailBundle(id: string, tables: TableSet): TableSet {
  const result: TableSet = {}
  const category = asRecord(tables.AchievementTypeTable?.[id])
  const groupIds = new Set(
    (Array.isArray(category.achievementGroupData) ? category.achievementGroupData : []).map((group) =>
      String(asRecord(group).groupId ?? '')
    )
  )
  addDetailTable(result, 'AchievementTypeTable', pickTableRows(tables.AchievementTypeTable, [id]))
  addDetailTable(
    result,
    'AchievementTable',
    Object.fromEntries(
      tableRecords(tables.AchievementTable).filter(([, achievement]) =>
        groupIds.has(String(achievement.groupId ?? ''))
      )
    )
  )
  return result
}

export function buildDetailBundle(definition: CatalogDefinition, id: string, tables: TableSet): TableSet {
  if (definition.id === 'v3_character' && definition.primaryTable === 'CharacterTable')
    return buildCharacterDetailBundle(id, tables)
  if (definition.id === 'v3_weapon' && definition.primaryTable === 'WeaponBasicTable')
    return buildWeaponDetailBundle(id, tables)
  if (definition.id === 'v3_enemy' && definition.primaryTable === 'EnemyTemplateDisplayInfoTable')
    return buildEnemyDetailBundle(id, tables)
  if (definition.id === 'v3_equip' && definition.primaryTable === 'EquipSuitTable')
    return buildEquipDetailBundle(id, tables)
  if (definition.id === 'v3_item' && definition.primaryTable === 'ItemTable')
    return buildItemDetailBundle(id, tables)
  if (definition.id === 'v3_achievement' && definition.primaryTable === 'AchievementTypeTable')
    return buildAchievementDetailBundle(id, tables)
  const result: TableSet = {}
  for (const tableName of definition.detailTables) {
    const table = tables[tableName] ?? {}
    if (Object.hasOwn(table, id)) {
      result[tableName] = { [id]: table[id] }
      continue
    }
    const related = Object.fromEntries(
      Object.entries(table)
        .filter(([, row]) => containsReference(row, id))
        .slice(0, 500)
    )
    if (Object.keys(related).length) result[tableName] = related
  }
  return result
}

export function interpolateLevel(start: unknown, growth: unknown, level: number): number | null {
  const base = Number(start)
  const increment = Number(growth)
  if (!Number.isFinite(base) || !Number.isFinite(increment) || !Number.isFinite(level)) return null
  return base + increment * Math.max(0, level - 1)
}

const CATALOG_LEVEL_LIMITS: Readonly<Record<CatalogLevelKind, number>> = Object.freeze({
  character: 90,
  weapon: 90,
  enemy: 100
})

const CHARACTER_ATTRIBUTE_TYPES = [39, 40, 41, 42, 1, 2, 3, 49, 25] as const
const ENEMY_ATTRIBUTE_ORDER = [1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15] as const
const ENEMY_ATTRIBUTE_ORDER_SET = new Set<number>(ENEMY_ATTRIBUTE_ORDER)
const ATTRIBUTE_MODIFIER_STAGES = [5, 6, 7, 8, 3, 4, 0, 1] as const
const ONE_PLUS_MODIFIER_TYPES = new Set([1, 6])

interface NumericAttribute {
  attrType: number
  attrValue: number
}

interface LevelAttributeRow {
  level: number
  breakStage: number
  attributes: readonly NumericAttribute[]
}

export function parseCatalogLevelPreferences(source: unknown, kind: CatalogLevelKind): number[] {
  const maximum = CATALOG_LEVEL_LIMITS[kind]
  const seen = new Set<number>()
  const levels: number[] = []
  for (const part of String(source ?? '').split(',')) {
    const normalized = part.trim()
    if (!/^\d+$/.test(normalized)) continue
    const level = Number(normalized)
    if (!Number.isInteger(level) || level < 1 || level > maximum || seen.has(level)) continue
    seen.add(level)
    levels.push(level)
  }
  return levels
}

function numericAttributes(value: unknown): NumericAttribute[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const attribute = asRecord(entry)
    const attrType = Number(attribute.attrType)
    const attrValue = Number(attribute.attrValue)
    return Number.isFinite(attrType) && Number.isFinite(attrValue) ? [{ attrType, attrValue }] : []
  })
}

function levelFromAttributes(attributes: readonly NumericAttribute[]): number | null {
  const level = attributes.find((attribute) => attribute.attrType === 0)?.attrValue
  return level !== undefined && Number.isFinite(level) ? level : null
}

function closestLevelRow(
  rows: readonly LevelAttributeRow[],
  requestedLevel: number
): LevelAttributeRow | null {
  return (
    rows.toSorted(
      (left, right) =>
        Math.abs(left.level - requestedLevel) - Math.abs(right.level - requestedLevel) ||
        left.level - right.level ||
        right.breakStage - left.breakStage
    )[0] ?? null
  )
}

function attributeLabel(maps: LocaleMaps, attrType: number): string {
  const key = String(attrType)
  return maps.ATTR_MAP?.[key] || maps.ATTR_MAP_EN?.[key] || `#${key}`
}

function levelAttribute(
  maps: LocaleMaps,
  attrType: number,
  rawValue: number,
  value = rawValue
): CatalogLevelAttribute {
  return {
    id: `attr-${attrType}`,
    attrType,
    label: attributeLabel(maps, attrType),
    value,
    rawValue,
    modified: value !== rawValue
  }
}

export function applyCatalogAttributeModifiers(
  baseValue: number,
  modifiers: readonly CatalogAttributeModifier[],
  attrType: number
): number {
  let value = baseValue
  for (const modifierType of ATTRIBUTE_MODIFIER_STAGES) {
    for (const modifier of modifiers) {
      if (modifier.attrType !== attrType || modifier.modifierType !== modifierType) continue
      if (ONE_PLUS_MODIFIER_TYPES.has(modifierType)) value *= 1 + modifier.attrValue
      else if (modifierType === 4 || modifierType === 8) value *= modifier.attrValue
      else value += modifier.attrValue
    }
  }
  return value
}

function characterLevelSnapshot(
  id: string,
  tables: TableSet,
  requestedLevel: number,
  maps: LocaleMaps
): CatalogLevelSnapshot | null {
  const character = asRecord(tables.CharacterTable?.[id])
  const rows = (Array.isArray(character.attributes) ? character.attributes : []).flatMap((value) => {
    const row = asRecord(value)
    const attributes = numericAttributes(asRecord(row.Attribute).attrs)
    const level = levelFromAttributes(attributes)
    return level === null
      ? []
      : [{ level, breakStage: numberValue(row.breakStage), attributes } satisfies LevelAttributeRow]
  })
  const selected = closestLevelRow(rows, requestedLevel)
  if (!selected) return null
  const values = new Map(selected.attributes.map((attribute) => [attribute.attrType, attribute.attrValue]))
  const attributes = CHARACTER_ATTRIBUTE_TYPES.flatMap((attrType) => {
    const rawValue = values.get(attrType)
    if (rawValue === undefined) return []
    const value =
      attrType === 1 ? Math.round((500 + (5_500 / 98) * (selected.level - 1)) * 100) / 100 : rawValue
    return [levelAttribute(maps, attrType, rawValue, value)]
  })
  return {
    kind: 'character',
    requestedLevel,
    resolvedLevel: selected.level,
    sourceId: id,
    attributes
  }
}

function weaponLevelSnapshot(
  id: string,
  tables: TableSet,
  requestedLevel: number,
  maps: LocaleMaps
): CatalogLevelSnapshot | null {
  const weapon = asRecord(tables.WeaponBasicTable?.[id])
  const templateId = String(weapon.levelTemplateId ?? '')
  const template = asRecord(tables.WeaponUpgradeTemplateTable?.[templateId])
  const rows = (Array.isArray(template.list) ? template.list : []).flatMap((value) => {
    const row = asRecord(value)
    const level = Number(row.weaponLv)
    const attack = Number(row.baseAtk)
    return Number.isFinite(level) && Number.isFinite(attack) ? [{ level, attack }] : []
  })
  const selected = rows.toSorted(
    (left, right) =>
      Math.abs(left.level - requestedLevel) - Math.abs(right.level - requestedLevel) ||
      left.level - right.level
  )[0]
  if (!selected) return null
  return {
    kind: 'weapon',
    requestedLevel,
    resolvedLevel: selected.level,
    sourceId: templateId,
    attributes: [levelAttribute(maps, 2, selected.attack)]
  }
}

function enemyLevelSnapshot(
  id: string,
  tables: TableSet,
  requestedLevel: number,
  maps: LocaleMaps
): CatalogLevelSnapshot | null {
  const variants = tableRecords(tables.EnemyTable)
    .filter(([, row]) => String(row.templateId ?? '') === id)
    .toSorted(([leftId], [rightId]) => Number(rightId === id) - Number(leftId === id))
  const [variantId = id, variant = {}] = variants[0] ?? [id, asRecord(tables.EnemyTable?.[id])]
  const templateId = String(variant.attrTemplateId ?? id)
  const template = asRecord(
    tables.EnemyAttributeTemplateTable?.[templateId] ?? tables.EnemyAttributeTemplateTable?.[id]
  )
  const rows = (
    Array.isArray(template.levelDependentAttributes) ? template.levelDependentAttributes : []
  ).flatMap((value) => {
    const attributes = numericAttributes(asRecord(value).attrs)
    const level = levelFromAttributes(attributes)
    return level === null ? [] : [{ level, breakStage: 0, attributes } satisfies LevelAttributeRow]
  })
  const selected = closestLevelRow(rows, requestedLevel)
  if (!selected) return null

  const values = new Map(selected.attributes.map((attribute) => [attribute.attrType, attribute.attrValue]))
  for (const attribute of numericAttributes(asRecord(template.levelIndependentAttributes).attrs)) {
    if (!values.has(attribute.attrType)) values.set(attribute.attrType, attribute.attrValue)
  }
  values.delete(0)

  const modifiers = (Array.isArray(variant.attrModifiers) ? variant.attrModifiers : []).flatMap((value) => {
    const modifier = asRecord(value)
    const attrType = Number(modifier.attrType)
    const modifierType = Number(modifier.modifierType)
    const attrValue = Number(modifier.attrValue)
    return Number.isFinite(attrType) && Number.isFinite(modifierType) && Number.isFinite(attrValue)
      ? [{ attrType, modifierType, attrValue }]
      : []
  })
  const order = [
    ...ENEMY_ATTRIBUTE_ORDER,
    ...[...values.keys()]
      .filter((attrType) => !ENEMY_ATTRIBUTE_ORDER_SET.has(attrType) && attrType >= 4)
      .toSorted((left, right) => left - right)
  ]
  const attributes = order.flatMap((attrType) => {
    const rawValue = values.get(attrType)
    return rawValue === undefined
      ? []
      : [
          levelAttribute(
            maps,
            attrType,
            rawValue,
            applyCatalogAttributeModifiers(rawValue, modifiers, attrType)
          )
        ]
  })
  return {
    kind: 'enemy',
    requestedLevel,
    resolvedLevel: selected.level,
    sourceId: variantId,
    attributes
  }
}

export function deriveCatalogLevelSnapshot(
  definition: CatalogDefinition,
  id: string,
  tables: TableSet,
  requestedLevel: number,
  maps: LocaleMaps = {}
): CatalogLevelSnapshot | null {
  if (!Number.isInteger(requestedLevel) || requestedLevel < 1 || !definition.levelKind) return null
  if (definition.levelKind === 'character') return characterLevelSnapshot(id, tables, requestedLevel, maps)
  if (definition.levelKind === 'weapon') return weaponLevelSnapshot(id, tables, requestedLevel, maps)
  return enemyLevelSnapshot(id, tables, requestedLevel, maps)
}

export function flattenRecord(
  value: unknown,
  prefix = '',
  output: Array<{ path: string; value: unknown }> = []
): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    value.forEach((child, index) => flattenRecord(child, `${prefix}[${index}]`, output))
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as RawRecord))
      flattenRecord(child, prefix ? `${prefix}.${key}` : key, output)
  } else {
    output.push({ path: prefix || '$', value })
  }
  return output
}

export function parseControlledRichText(input: unknown): RichTextToken[] {
  const text = String(input ?? '')
  const tokens: RichTextToken[] = []
  const pattern =
    /(<\/?b>|<color=([^>]+)>|<\/color>|<image="([^"]+)"(?:\s+scale=([0-9.]+))?>|<[@#][^>]+>|<\/>|\r?\n)/gi
  let cursor = 0
  let color: string | undefined
  let strong = false
  let semanticDepth = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > cursor)
      tokens.push({
        type: 'text',
        value: text.slice(cursor, index),
        ...(color ? { color } : {}),
        ...(strong || semanticDepth > 0 ? { strong: true } : {})
      })
    const raw = match[0].toLowerCase()
    if (raw === '<b>') strong = true
    else if (raw === '</b>') strong = false
    else if (raw.startsWith('<color=')) color = match[2]
    else if (raw === '</color>') color = undefined
    else if (raw.startsWith('<@') || raw.startsWith('<#')) semanticDepth += 1
    else if (raw === '</>') semanticDepth = Math.max(0, semanticDepth - 1)
    else if (raw.startsWith('<image=')) {
      tokens.push({ type: 'image', value: match[3] ?? '', ...(match[4] ? { scale: Number(match[4]) } : {}) })
    } else tokens.push({ type: 'break', value: '\n' })
    cursor = index + match[0].length
  }
  if (cursor < text.length)
    tokens.push({
      type: 'text',
      value: text.slice(cursor),
      ...(color ? { color } : {}),
      ...(strong || semanticDepth > 0 ? { strong: true } : {})
    })
  return tokens
}

export function csvEscape(value: unknown): string {
  const text = typeof value === 'string' ? value : stableStringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function catalogToCsv(entries: readonly CatalogEntry[]): string {
  const header = ['id', 'name', 'rarity', 'category', 'subtitle']
  return [
    header.join(','),
    ...entries.map((entry) => header.map((key) => csvEscape(entry[key as keyof CatalogEntry])).join(','))
  ].join('\r\n')
}

export * from './catalog-presentation'
