import {
  applyCatalogAttributeModifiers,
  asRecord,
  tableRecords,
  textValue,
  type CatalogAttributeModifier,
  type CatalogEntry,
  type CatalogModuleId,
  type LocaleMaps,
  type RawRecord,
  type TableSet
} from './index'

export type CatalogFacetId = 'rarity' | 'category' | 'element' | 'profession' | 'weapon' | 'type'

export interface CatalogFacetOption {
  value: string
  label: string
}

export interface CatalogFacetDefinition {
  id: CatalogFacetId
  options: readonly CatalogFacetOption[]
}

export interface CatalogMetaIcon {
  id: string
  path: string
  label: string
}

export interface CatalogOverviewFact {
  id: 'variants' | 'rarityFact' | 'equipmentCount' | 'achievementCount' | 'groupCount' | 'platedCount'
  value: number
}

export interface CatalogOverviewItem {
  entry: CatalogEntry
  icons: readonly CatalogMetaIcon[]
  facts: readonly CatalogOverviewFact[]
}

export interface CatalogOverviewGroup {
  id: string
  label: string
  order: number
  versionChanges: boolean
  items: readonly CatalogOverviewItem[]
}

export interface CatalogCostItem {
  id: string
  name: string
  icon: string
  count: number
}

export interface CatalogLabeledValue {
  id: string
  label: string
  value: string | number
}

export interface CharacterGrowthRow {
  level: number
  values: Readonly<Record<string, number>>
}

export interface CharacterGrowthModel {
  columns: readonly CatalogLabeledValue[]
  rows: readonly CharacterGrowthRow[]
}

export interface CharacterEffectModel {
  id: string
  name: string
  description: string
  costs: readonly CatalogCostItem[]
}

export interface CharacterAttributeNodeModel extends CharacterEffectModel {
  modifiers: readonly CatalogLabeledValue[]
}

export interface CharacterSkillLevelModel {
  level: number
  description: string
  cooldown: number | null
  cost: number | null
  parameters: readonly CatalogLabeledValue[]
  subDescriptions: readonly string[]
}

export interface CharacterSkillModel {
  id: string
  groupType: number
  name: string
  icon: string
  description: string
  conditions: readonly CharacterEffectModel[]
  levels: readonly CharacterSkillLevelModel[]
  costs: readonly { level: number; items: readonly CatalogCostItem[] }[]
}

export interface CharacterLogisticsLevelModel {
  name: string
  postfix: string
  description: string
  unlockHint: string
}

export interface CharacterLogisticsModel {
  id: string
  name: string
  room: string
  icon: string
  levels: readonly CharacterLogisticsLevelModel[]
}

export interface CharacterDetailModel {
  kind: 'character'
  id: string
  name: string
  rarity: number
  icon: string
  portrait: string
  tags: readonly string[]
  meta: readonly CatalogLabeledValue[]
  profile: string
  feature: string
  growth: CharacterGrowthModel | null
  talents: readonly CharacterEffectModel[]
  potentials: readonly CharacterEffectModel[]
  attributeNodes: readonly CharacterAttributeNodeModel[]
  skills: readonly CharacterSkillModel[]
  logistics: readonly CharacterLogisticsModel[]
  potentialImages: readonly string[]
  profileRecords: readonly { title: string; description: string }[]
  voiceRecords: readonly { title: string; description: string }[]
}

export interface WeaponSkillLevelModel {
  level: number
  description: string
  parameters: readonly CatalogLabeledValue[]
}

export interface WeaponSkillModel {
  id: string
  name: string
  levels: readonly WeaponSkillLevelModel[]
}

export interface WeaponBreakthroughModel {
  level: number
  gold: number
  materials: readonly CatalogCostItem[]
  skillBounds: readonly { skill: number; lower: number; upper: number }[]
}

export interface WeaponPotentialModel {
  level: number
  skillBounds: readonly { skill: number; upper: number }[]
}

export interface WeaponDetailModel {
  kind: 'weapon'
  id: string
  name: string
  rarity: number
  icon: string
  illustration: string
  description: string
  decorativeDescription: string
  attackRows: readonly { level: number; attack: number }[]
  skills: readonly WeaponSkillModel[]
  breakthroughs: readonly WeaponBreakthroughModel[]
  potentials: readonly WeaponPotentialModel[]
  story: string
}

export interface EnemyVariantRow {
  level: number
  hp: number
  attack: number
  defense: number
}

export interface EnemyVariantModel {
  id: string
  templateId: string
  isBase: boolean
  modifiers: readonly CatalogLabeledValue[]
  buffs: readonly string[]
  flags: readonly string[]
  differences: readonly CatalogLabeledValue[]
  rows: readonly EnemyVariantRow[]
}

export interface EnemyDetailModel {
  kind: 'enemy'
  id: string
  name: string
  rarity: number
  icon: string
  portrait: string
  tags: readonly string[]
  meta: readonly CatalogLabeledValue[]
  description: string
  abilities: readonly string[]
  poiseBreakBuffs: readonly string[]
  variants: readonly EnemyVariantModel[]
}

export interface EquipAttributeModel {
  id: string
  label: string
  modifierLabel: string
  value: number
  enhancedValues: readonly number[]
}

export interface EquipCostChainModel {
  id: string
  level: string
  isDefault: boolean
  items: readonly CatalogCostItem[]
}

export interface EquipGuaranteeModel {
  label: string
  values: readonly number[]
}

export interface EquipPieceModel {
  id: string
  name: string
  added: boolean
  rarity: number
  icon: string
  partType: number
  minimumLevel: number
  domainId: string
  domainLabel: string
  description: string
  mainStat: EquipAttributeModel | null
  subStats: readonly EquipAttributeModel[]
  crafting: readonly EquipCostChainModel[]
  guarantees: readonly EquipGuaranteeModel[]
}

export interface EquipSkillModel {
  id: string
  name: string
  description: string
  parameters: readonly CatalogLabeledValue[]
}

export interface EquipEnhancementCostModel {
  domainId: string
  domainLabel: string
  consumeId: string
  consumeCount: number
  returnId: string
  returnCount: number
}

export interface EquipDetailModel {
  kind: 'equip'
  id: string
  name: string
  rarity: number
  icon: string
  packs: readonly string[]
  skills: readonly EquipSkillModel[]
  pieces: readonly EquipPieceModel[]
  enhancement: {
    maximumCraftingCount: number | null
    recyclingReturnRate: number | null
    maximumEnhancementLevel: number | null
    costs: readonly EquipEnhancementCostModel[]
  } | null
}

export interface ItemEffectModel {
  id: 'afterUse' | 'afterEquip'
  descriptions: readonly string[]
  meta: readonly CatalogLabeledValue[]
}

export interface ItemRecipeModel {
  id: string
  kind: string
  name: string
  meta: string
  durationMs: number
  inputs: readonly CatalogCostItem[]
  outputs: readonly CatalogCostItem[]
}

export interface ItemDetailModel {
  kind: 'item'
  id: string
  name: string
  rarity: number
  icon: string
  typeLabel: string
  description: string
  decorativeDescription: string
  effects: readonly ItemEffectModel[]
  properties: readonly CatalogLabeledValue[]
  recipes: readonly ItemRecipeModel[]
  obtainWays: readonly { id: string; icon: string; description: string }[]
  applicableWeapons: readonly string[]
  choiceBox: { selectedCount: number; rewardIds: readonly string[] } | null
  iconComposite: readonly CatalogLabeledValue[]
  displayType: string
  encyclopedia: { id: string; groupId: string } | null
}

export interface AchievementConditionModel {
  id: string
  description: string
  progress: string | number
}

export interface AchievementLevelModel {
  level: number
  icon: string
  description: string
  conditions: readonly AchievementConditionModel[]
}

export interface AchievementModel {
  id: string
  name: string
  order: number
  added: boolean
  upgradable: boolean
  platable: boolean
  rareEffect: boolean
  hiddenUntilObtained: boolean
  levels: readonly AchievementLevelModel[]
}

export interface AchievementGroupModel {
  id: string
  name: string
  achievements: readonly AchievementModel[]
}

export interface AchievementDetailModel {
  kind: 'achievement'
  id: string
  name: string
  groups: readonly AchievementGroupModel[]
}

export type CatalogDetailPresentation =
  | CharacterDetailModel
  | WeaponDetailModel
  | EnemyDetailModel
  | EquipDetailModel
  | ItemDetailModel
  | AchievementDetailModel

const CHARACTER_ATTRIBUTE_TYPES = [39, 40, 41, 42, 1, 2, 3, 49, 25] as const
const CHARACTER_ATTRIBUTE_IDS: Readonly<Record<number, string>> = {
  39: 'strength',
  40: 'agility',
  41: 'intellect',
  42: 'will',
  1: 'hp',
  2: 'attack',
  3: 'defense',
  49: 'artsInflictionDamageMultiplier',
  25: 'physicalInflictionDamageMultiplier'
}
const CHARACTER_META_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/elementicon/'
const CHARACTER_PROFESSION_ICON_BASE =
  '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charprofessionicon/'
const CHARACTER_TYPE_ICONS: Readonly<Record<string, string>> = {
  Physical: 'physical',
  Fire: 'fire',
  Pulse: 'pulse',
  Cryst: 'cold',
  Natural: 'nature'
}
const PROFESSION_ICONS: Readonly<Record<string, string>> = {
  '0': '0',
  '2': '2',
  '4': '4',
  '5': '5',
  '7': '7',
  '8': '8',
  GUARD: '0',
  DEFENDER: '2',
  SUPPORTER: '4',
  CASTER: '5',
  VANGUARD: '7',
  ASSAULT: '8'
}
const SKILL_GROUP_ORDER: Readonly<Record<number, number>> = { 0: 0, 1: 1, 3: 2, 2: 3 }
const ENEMY_RARITY_BY_DISPLAY_TYPE: Readonly<Record<number, number>> = { 0: 2, 3: 3, 1: 4, 4: 5, 2: 6 }
const ENEMY_SCALAR_META_FIELDS = [
  'initialSuperArmor',
  'zeroPoiseSuperArmor',
  'superArmorWhenResilienceZero',
  'breakingAttackedAtbObtain',
  'attackValueAgainstTower',
  'maxResilience',
  'pushedBackCoefficient',
  'resilienceDecreaseWhenHurt',
  'resilienceFullRecoverTime',
  'resilienceRecover',
  'resilienceRecoverInterval'
] as const

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function recordValues(value: unknown): RawRecord[] {
  return Object.values(asRecord(value)).map(asRecord)
}

function row(tables: TableSet, table: string, id: unknown): RawRecord {
  return asRecord(tables[table]?.[String(id ?? '')])
}

function mappedLabel(maps: LocaleMaps, mapNames: readonly string[], value: unknown): string {
  const id = stringValue(value)
  for (const name of mapNames) {
    const label = maps[name]?.[id]
    if (label) return label
  }
  return id
}

function attributeLabel(maps: LocaleMaps, attrType: unknown): string {
  return mappedLabel(maps, ['ATTR_MAP', 'ATTR_MAP_EN'], attrType) || stringValue(attrType)
}

function itemCost(item: unknown, itemTable: RawRecord, countOverride?: unknown): CatalogCostItem {
  const source = asRecord(item)
  const id = stringValue(source.id)
  const itemRow = asRecord(itemTable[id])
  return {
    id,
    name: textValue(itemRow.name, id),
    icon: id
      ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${stringValue(itemRow.iconId) || id}.png`
      : '',
    count: numberValue(countOverride ?? source.count)
  }
}

function formatNumeric(value: number, format: string): string {
  if (format.includes('%')) {
    const decimals = format.includes('.') ? (format.split('.')[1]?.replace('%', '').length ?? 0) : 0
    return `${(value * 100).toFixed(decimals)}%`
  }
  const decimals = format.includes('.') ? (format.split('.')[1]?.length ?? 0) : 0
  return decimals ? value.toFixed(decimals) : String(Math.round(value * 1_000_000) / 1_000_000)
}

function evaluateNumericExpression(source: string): number | null {
  const tokens = source.match(/(?:\d+(?:\.\d+)?|[()+\-*/])/g)
  if (!tokens || tokens.join('') !== source.replaceAll(/\s/g, '')) return null
  let index = 0
  const factor = (): number | null => {
    const token = tokens[index]
    if (token === '+' || token === '-') {
      index += 1
      const value = factor()
      return value === null ? null : token === '-' ? -value : value
    }
    if (token === '(') {
      index += 1
      const value = expression()
      if (tokens[index] !== ')') return null
      index += 1
      return value
    }
    if (token === undefined || !/^\d/.test(token)) return null
    index += 1
    return Number(token)
  }
  const term = (): number | null => {
    let value = factor()
    if (value === null) return null
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index]
      index += 1
      const right = factor()
      if (right === null || (operator === '/' && right === 0)) return null
      value = operator === '*' ? value * right : value / right
    }
    return value
  }
  const expression = (): number | null => {
    let value = term()
    if (value === null) return null
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index]
      index += 1
      const right = term()
      if (right === null) return null
      value = operator === '+' ? value + right : value - right
    }
    return value
  }
  const result = expression()
  return result !== null && index === tokens.length && Number.isFinite(result) ? result : null
}

export function interpolateCatalogDescription(
  input: unknown,
  values: Readonly<Record<string, unknown>>
): string {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLocaleLowerCase(), value])
  )
  return stringValue(input).replace(/\{([^}]+)\}/g, (match, expressionWithFormat: string) => {
    const separator = expressionWithFormat.lastIndexOf(':')
    const expression = (
      separator >= 0 ? expressionWithFormat.slice(0, separator) : expressionWithFormat
    ).replaceAll(/\s/g, '')
    const format = separator >= 0 ? expressionWithFormat.slice(separator + 1) : ''
    const names = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
    if (names.some((name) => normalized[name.toLocaleLowerCase()] === undefined)) return match
    let resolved = expression
    for (const name of names) {
      const value = Number(normalized[name.toLocaleLowerCase()])
      if (!Number.isFinite(value)) return match
      resolved = resolved.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${value})`)
    }
    const result = evaluateNumericExpression(resolved)
    return result === null ? match : formatNumeric(result, format)
  })
}

function blackboardValues(value: unknown): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  if (!Array.isArray(value)) return output
  for (const item of value.map(asRecord)) {
    const key = stringValue(item.key)
    if (key) output[key] = item.value ?? item.valueDouble ?? item.valueFloat ?? item.valueStr
  }
  return output
}

function effectValues(effect: RawRecord): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const dataList = Array.isArray(effect.dataList) ? effect.dataList.map(asRecord) : []
  for (const item of dataList) {
    const attachSkill = asRecord(item.attachSkill)
    const attachBuff = asRecord(item.attachBuff)
    Object.assign(values, blackboardValues(attachSkill.blackboard), blackboardValues(attachBuff.blackboard))
    const bbModifier = asRecord(item.skillBbModifier)
    if (bbModifier.bbKey) values[stringValue(bbModifier.bbKey)] = bbModifier.floatValue
    const parameter = asRecord(item.skillParamModifier)
    if (parameter.paramType) values[`param${stringValue(parameter.paramType)}`] = parameter.paramValue
    const attribute = asRecord(item.attrModifier)
    if (attribute.attrType !== undefined)
      values[`attr${stringValue(attribute.attrType)}`] = attribute.attrValue
  }
  return values
}

function uniqueFacetOptions(entries: readonly CatalogEntry[], id: CatalogFacetId): CatalogFacetOption[] {
  const values = new Map<string, string>()
  for (const entry of entries) {
    if (id === 'rarity') values.set(String(entry.rarity), `${entry.rarity}★`)
    else if (id === 'category') values.set(entry.category, entry.categoryLabel || entry.category)
    else {
      const facet = entry.facets?.[id]
      if (facet?.value) values.set(facet.value, facet.label || facet.value)
    }
  }
  return [...values.entries()]
    .map(([value, label]) => ({ value, label }))
    .toSorted((left, right) =>
      id === 'rarity'
        ? Number(right.value) - Number(left.value)
        : left.label.localeCompare(right.label, 'zh-CN')
    )
}

export function buildCatalogFacetDefinitions(
  moduleId: CatalogModuleId,
  entries: readonly CatalogEntry[]
): CatalogFacetDefinition[] {
  const ids: readonly CatalogFacetId[] =
    moduleId === 'v3_character'
      ? ['rarity', 'element', 'profession', 'weapon']
      : moduleId === 'v3_weapon'
        ? ['rarity', 'type']
        : moduleId === 'v3_enemy' || moduleId === 'v3_equip' || moduleId === 'v3_achievement'
          ? []
          : ['rarity', 'category']
  return ids
    .map((id) => ({ id, options: uniqueFacetOptions(entries, id) }))
    .filter((facet) => facet.options.length > 0)
}

export function filterEntriesByCatalogFacets(
  entries: readonly CatalogEntry[],
  selections: Readonly<Record<string, ReadonlySet<string>>>
): CatalogEntry[] {
  return entries.filter((entry) =>
    Object.entries(selections).every(([id, selected]) => {
      if (!selected.size) return true
      const value =
        id === 'rarity'
          ? String(entry.rarity)
          : id === 'category'
            ? entry.category
            : entry.facets?.[id]?.value
      return value !== undefined && selected.has(value)
    })
  )
}

export function characterEntryMetaIcons(entry: CatalogEntry): CatalogMetaIcon[] {
  const icons: CatalogMetaIcon[] = []
  const element = entry.facets?.element
  const elementIcon = element ? CHARACTER_TYPE_ICONS[element.value] : undefined
  if (element && elementIcon) {
    icons.push({
      id: 'element',
      path: `${CHARACTER_META_ICON_BASE}icon_charattrtype_${elementIcon}.png`,
      label: element.label
    })
  }
  const profession = entry.facets?.profession
  const professionIcon = profession ? PROFESSION_ICONS[profession.value] : undefined
  if (profession && professionIcon) {
    icons.push({
      id: 'profession',
      path: `${CHARACTER_PROFESSION_ICON_BASE}icon_profession_${professionIcon}.png`,
      label: profession.label
    })
  }
  return icons
}

function semanticOverviewGroup(
  moduleId: CatalogModuleId,
  entry: CatalogEntry
): { id: string; label: string; order: number } {
  if (moduleId === 'v3_character') {
    const facet = entry.facets?.profession
    return {
      id: facet?.value || 'unknown',
      label: facet?.label || entry.categoryLabel,
      order: Number(facet?.value ?? 999)
    }
  }
  if (moduleId === 'v3_weapon') {
    const facet = entry.facets?.type
    return {
      id: facet?.value || 'unknown',
      label: facet?.label || entry.categoryLabel,
      order: Number(facet?.value ?? 999)
    }
  }
  if (moduleId === 'v3_enemy') {
    return {
      id: entry.category || 'unknown',
      label: entry.categoryLabel || entry.category,
      order: -entry.rarity
    }
  }
  if (moduleId === 'v3_equip') {
    return {
      id: entry.category || 'suit',
      label: entry.categoryLabel || entry.category,
      order: entry.category === 'independent' ? 1 : 0
    }
  }
  if (moduleId === 'v3_item') {
    return {
      id: entry.category || 'other',
      label: entry.categoryLabel || entry.category,
      order: Number(entry.facets?.overviewOrder?.value ?? 999)
    }
  }
  if (moduleId === 'v3_achievement') {
    return { id: 'categories', label: 'categories', order: 0 }
  }
  return { id: entry.category || 'all', label: entry.categoryLabel || entry.category, order: 999 }
}

function overviewItem(moduleId: CatalogModuleId, entry: CatalogEntry): CatalogOverviewItem {
  const facts: CatalogOverviewFact[] = []
  if (moduleId === 'v3_enemy' && Number(entry.subtitle) > 0) {
    facts.push({ id: 'variants', value: Number(entry.subtitle) })
  }
  if (moduleId === 'v3_equip') {
    facts.push({ id: 'rarityFact', value: entry.rarity })
    facts.push({
      id: 'equipmentCount',
      value: Number(entry.facets?.equipmentCount?.value ?? entry.subtitle)
    })
  }
  if (moduleId === 'v3_item') facts.push({ id: 'rarityFact', value: entry.rarity })
  if (moduleId === 'v3_achievement') {
    facts.push({ id: 'achievementCount', value: Number(entry.subtitle) })
    facts.push({ id: 'groupCount', value: Number(entry.facets?.groupCount?.value ?? 0) })
    const plated = Number(entry.facets?.platedCount?.value ?? 0)
    if (plated > 0) facts.push({ id: 'platedCount', value: plated })
  }
  return {
    entry,
    icons: moduleId === 'v3_character' ? characterEntryMetaIcons(entry) : [],
    facts
  }
}

export function buildCatalogOverviewGroups(
  moduleId: CatalogModuleId,
  entries: readonly CatalogEntry[]
): CatalogOverviewGroup[] {
  const groups = new Map<string, CatalogOverviewGroup & { items: CatalogOverviewItem[] }>()
  for (const entry of entries) {
    const semantic = entry.changeType
      ? { id: '__version_changes__', label: '', order: -10_000, versionChanges: true }
      : { ...semanticOverviewGroup(moduleId, entry), versionChanges: false }
    let group = groups.get(semantic.id)
    if (!group) {
      group = { ...semantic, items: [] }
      groups.set(semantic.id, group)
    }
    group.items.push(overviewItem(moduleId, entry))
  }
  return [...groups.values()].toSorted(
    (left, right) => left.order - right.order || left.label.localeCompare(right.label, 'zh-CN')
  )
}

function buildGrowth(character: RawRecord, maps: LocaleMaps): CharacterGrowthModel | null {
  const levels = new Map<number, { breakStage: number; values: Record<string, number> }>()
  const attributes = Array.isArray(character.attributes) ? character.attributes.map(asRecord) : []
  for (const levelData of attributes) {
    const attribute = asRecord(levelData.Attribute)
    const rows = Array.isArray(attribute.attrs) ? attribute.attrs.map(asRecord) : []
    const level = numberValue(rows.find((item) => numberValue(item.attrType, -1) === 0)?.attrValue, -1)
    if (level < 0) continue
    const breakStage = numberValue(levelData.breakStage)
    const existing = levels.get(level)
    if (existing && existing.breakStage > breakStage) continue
    const values: Record<string, number> = {}
    for (const attributeType of CHARACTER_ATTRIBUTE_TYPES) {
      const source = rows.find((item) => numberValue(item.attrType, -1) === attributeType)
      if (source)
        values[CHARACTER_ATTRIBUTE_IDS[attributeType] ?? String(attributeType)] = numberValue(
          source.attrValue
        )
    }
    values.hp = Math.round((500 + (5500 / 98) * (level - 1)) * 100) / 100
    levels.set(level, { breakStage, values })
  }
  const rows = [...levels.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([level, value]) => ({ level, values: value.values }))
  if (!rows.length) return null
  return {
    columns: CHARACTER_ATTRIBUTE_TYPES.map((attrType) => ({
      id: CHARACTER_ATTRIBUTE_IDS[attrType] ?? String(attrType),
      label: attributeLabel(maps, attrType),
      value: attrType
    })),
    rows
  }
}

function buildCharacterEffects(
  growth: RawRecord,
  potential: RawRecord,
  effects: RawRecord,
  skills: RawRecord,
  itemTable: RawRecord,
  maps: LocaleMaps
): Pick<CharacterDetailModel, 'talents' | 'potentials' | 'attributeNodes' | 'potentialImages'> {
  const nodes = recordValues(growth.talentNodeMap)
  const talents = nodes
    .filter((node) => numberValue(node.nodeType) === 4 && asRecord(node.passiveSkillNodeInfo).talentEffectId)
    .toSorted((left, right) => {
      const leftInfo = asRecord(left.passiveSkillNodeInfo)
      const rightInfo = asRecord(right.passiveSkillNodeInfo)
      return (
        numberValue(leftInfo.index) - numberValue(rightInfo.index) ||
        numberValue(leftInfo.level) - numberValue(rightInfo.level)
      )
    })
    .map((node, index): CharacterEffectModel | null => {
      const info = asRecord(node.passiveSkillNodeInfo)
      const effect = asRecord(effects[stringValue(info.talentEffectId)])
      if (!Object.keys(effect).length) return null
      return {
        id: stringValue(info.talentEffectId) || `talent-${index}`,
        name: textValue(info.name, textValue(effect.name)),
        description: interpolateCatalogDescription(textValue(effect.desc), effectValues(effect)),
        costs: Array.isArray(node.requiredItem)
          ? node.requiredItem.map((item) => itemCost(item, itemTable))
          : []
      }
    })
    .filter((item): item is CharacterEffectModel => item !== null)

  const potentialRows = Array.isArray(potential.potentialUnlockBundle)
    ? potential.potentialUnlockBundle.map(asRecord)
    : []
  const potentials = potentialRows.map((potentialRow, index): CharacterEffectModel => {
    const effectId = stringValue(potentialRow.potentialEffectId)
    const effect = asRecord(effects[effectId])
    const patch = asRecord(asRecord(skills[effectId]).SkillPatchDataBundle)
    const firstPatch = Array.isArray(asRecord(skills[effectId]).SkillPatchDataBundle)
      ? asRecord((asRecord(skills[effectId]).SkillPatchDataBundle as unknown[])[0])
      : patch
    const values = Object.keys(effect).length ? effectValues(effect) : blackboardValues(firstPatch.blackboard)
    const itemIds = Array.isArray(potentialRow.itemIds) ? potentialRow.itemIds : []
    const itemCounts = Array.isArray(potentialRow.itemCnts) ? potentialRow.itemCnts : []
    return {
      id: effectId || `potential-${index}`,
      name: textValue(potentialRow.name, stringValue(potentialRow.level)),
      description: interpolateCatalogDescription(
        textValue(effect.desc, textValue(firstPatch.description)),
        values
      ),
      costs: itemIds.map((itemId, itemIndex) => itemCost({ id: itemId }, itemTable, itemCounts[itemIndex]))
    }
  })

  const attributeNodes = nodes
    .filter((node) => numberValue(node.nodeType) === 3)
    .toSorted(
      (left, right) =>
        numberValue(asRecord(left.attributeNodeInfo).breakStage) -
        numberValue(asRecord(right.attributeNodeInfo).breakStage)
    )
    .map((node, index): CharacterAttributeNodeModel | null => {
      const info = asRecord(node.attributeNodeInfo)
      const modifiers = Array.isArray(info.attributeModifiers)
        ? info.attributeModifiers
            .map(asRecord)
            .filter(
              (modifier) => !(numberValue(modifier.attrType) === 0 && numberValue(modifier.attrValue) === 0)
            )
            .map((modifier) => ({
              id: stringValue(modifier.attrType),
              label: attributeLabel(maps, modifier.attrType),
              value: numberValue(modifier.attrValue)
            }))
        : []
      if (!modifiers.length) return null
      return {
        id: stringValue(node.nodeId) || `attribute-${index}`,
        name: textValue(info.title),
        description: textValue(info.desc),
        costs: Array.isArray(node.requiredItem)
          ? node.requiredItem.map((item) => itemCost(item, itemTable))
          : [],
        modifiers
      }
    })
    .filter((item): item is CharacterAttributeNodeModel => item !== null)

  const potentialImages = potentialRows.flatMap((potentialRow) =>
    Array.isArray(potentialRow.unlockCharPictureItemList)
      ? potentialRow.unlockCharPictureItemList
          .map(stringValue)
          .filter(Boolean)
          .map(
            (itemId) =>
              `/public/images/assets/beyond/dynamicassets/gameplay/ui/textures/spaceship/imageposter/largesize/${itemId.replace(/^item_/, '')}.png`
          )
      : []
  )
  return { talents, potentials, attributeNodes, potentialImages }
}

function buildCharacterSkills(
  growth: RawRecord,
  skillTable: RawRecord,
  itemTable: RawRecord
): CharacterSkillModel[] {
  const costsByGroup = new Map<string, { level: number; items: CatalogCostItem[] }[]>()
  if (Array.isArray(growth.skillLevelUp)) {
    for (const level of growth.skillLevelUp.map(asRecord)) {
      const groupId = stringValue(level.skillGroupId)
      if (!groupId) continue
      const items = Array.isArray(level.itemBundle)
        ? level.itemBundle.map((item) => itemCost(item, itemTable))
        : []
      if (numberValue(level.goldCost) > 0)
        items.unshift(itemCost({ id: 'item_gold' }, itemTable, level.goldCost))
      const groupCosts = costsByGroup.get(groupId) ?? []
      groupCosts.push({ level: numberValue(level.level), items })
      costsByGroup.set(groupId, groupCosts)
    }
  }
  return recordValues(growth.skillGroupMap)
    .toSorted(
      (left, right) =>
        (SKILL_GROUP_ORDER[numberValue(left.skillGroupType)] ?? numberValue(left.skillGroupType)) -
        (SKILL_GROUP_ORDER[numberValue(right.skillGroupType)] ?? numberValue(right.skillGroupType))
    )
    .map((group, groupIndex): CharacterSkillModel => {
      const skillIds = Array.isArray(group.skillIdList) ? group.skillIdList.map(stringValue) : []
      const patchLists = skillIds
        .map((skillId) => asRecord(skillTable[skillId]).SkillPatchDataBundle)
        .filter(Array.isArray) as unknown[][]
      if (!patchLists.length && group.skillGroupId) {
        const fallback = asRecord(skillTable[stringValue(group.skillGroupId)]).SkillPatchDataBundle
        if (Array.isArray(fallback)) patchLists.push(fallback)
      }
      const levelCount = Math.max(0, ...patchLists.map((list) => list.length))
      const levels = Array.from({ length: levelCount }, (_, levelIndex): CharacterSkillLevelModel => {
        const patches = patchLists
          .map((list) => asRecord(list[levelIndex] ?? list.at(-1)))
          .filter((item) => Object.keys(item).length)
        const parameters = patches.flatMap((patch, patchIndex) =>
          Object.entries(blackboardValues(patch.blackboard)).map(([id, value]) => ({
            id: `${patchIndex}-${id}`,
            label: id,
            value: typeof value === 'number' ? value : stringValue(value)
          }))
        )
        const values = Object.fromEntries(parameters.map((parameter) => [parameter.label, parameter.value]))
        const descriptions = patches.map((patch) => textValue(patch.description)).filter(Boolean)
        const subDescriptions = patches.flatMap((patch) =>
          Array.isArray(patch.subDescDataList)
            ? patch.subDescDataList.map((item) => textValue(asRecord(item).desc)).filter(Boolean)
            : []
        )
        return {
          level: numberValue(patches[0]?.level, levelIndex + 1),
          description: interpolateCatalogDescription(descriptions.join('\n'), values),
          cooldown: patches.some((patch) => patch.coolDown !== undefined)
            ? numberValue(patches[0]?.coolDown)
            : null,
          cost: patches.some((patch) => patch.costValue !== undefined)
            ? numberValue(patches[0]?.costValue)
            : null,
          parameters,
          subDescriptions
        }
      })
      const lastValues = levels.at(-1)?.parameters ?? []
      const descriptionValues = Object.fromEntries(
        lastValues.map((parameter) => [parameter.label, parameter.value])
      )
      const conditions = [1, 2]
        .map((conditionIndex): CharacterEffectModel | null => {
          const conditionId = stringValue(group[`conditionId${conditionIndex}`])
          if (!conditionId) return null
          return {
            id: conditionId,
            name: textValue(group[`conditionName${conditionIndex}`], conditionId),
            description: interpolateCatalogDescription(
              textValue(
                group[`conditionPostDesc${conditionIndex}`],
                textValue(group[`conditionDesc${conditionIndex}`])
              ),
              descriptionValues
            ),
            costs: []
          }
        })
        .filter((item): item is CharacterEffectModel => item !== null)
      const id = stringValue(group.skillGroupId) || skillIds[0] || `skill-${groupIndex}`
      return {
        id,
        groupType: numberValue(group.skillGroupType),
        name: textValue(group.name, id),
        icon: group.icon
          ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/${stringValue(group.icon)}.png`
          : '',
        description: interpolateCatalogDescription(textValue(group.desc), descriptionValues),
        conditions,
        levels,
        costs: (costsByGroup.get(id) ?? []).toSorted((left, right) => left.level - right.level)
      }
    })
}

function buildCharacterLogistics(
  spaceshipCharacter: RawRecord,
  spaceshipSkills: RawRecord,
  maps: LocaleMaps
): CharacterLogisticsModel[] {
  const groups = new Map<string, CharacterLogisticsModel & { levels: CharacterLogisticsLevelModel[] }>()
  const skills = Array.isArray(spaceshipCharacter.skillList) ? spaceshipCharacter.skillList.map(asRecord) : []
  for (const slot of skills) {
    const skillId = stringValue(slot.skillId)
    const skill = asRecord(spaceshipSkills[skillId])
    if (!Object.keys(skill).length) continue
    const name = textValue(skill.talentName, skillId)
    let group = groups.get(name)
    if (!group) {
      group = {
        id: skillId,
        name,
        room: mappedLabel(maps, ['room_type_map', 'room_type_en_map'], skill.roomType),
        icon: skill.icon
          ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon/${stringValue(skill.icon)}.png`
          : '',
        levels: []
      }
      groups.set(name, group)
    }
    group.levels.push({
      name: textValue(skill.name),
      postfix: stringValue(skill.skillNamePostfix),
      description: textValue(skill.desc),
      unlockHint: textValue(slot.unlockHint)
    })
  }
  return [...groups.values()]
}

export function buildCharacterDetailModel(
  id: string,
  entry: CatalogEntry,
  tables: TableSet,
  maps: LocaleMaps = {}
): CharacterDetailModel | null {
  const character = row(tables, 'CharacterTable', id)
  if (!Object.keys(character).length) return null
  const growth = row(tables, 'CharGrowthTable', id)
  const potential = row(tables, 'CharacterPotentialTable', id)
  const effects = asRecord(tables.PotentialTalentEffectTable)
  const skills = asRecord(tables.SkillPatchTable)
  const itemTable = asRecord(tables.ItemTable)
  const profileItem = asRecord(itemTable[id])
  const profession = row(tables, 'CharProfessionTable', character.profession ?? growth.profession)
  const cv = asRecord(character.cvName)
  const voices = ['ChiCVName', 'JapCVName', 'EngCVName', 'KorCVName']
    .map((key) => textValue(cv[key]))
    .filter(Boolean)
  const charType = stringValue(growth.charTypeId ?? character.charTypeId)
  const professionId = stringValue(growth.profession ?? character.profession)
  const weaponType = stringValue(growth.weaponType ?? character.weaponType)
  const effectsModel = buildCharacterEffects(growth, potential, effects, skills, itemTable, maps)
  return {
    kind: 'character',
    id,
    name: textValue(character.name, entry.name),
    rarity: numberValue(character.rarity, entry.rarity),
    icon: entry.icon,
    portrait: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/characterportrait/${id}.png`,
    tags: Array.isArray(character.charBattleTagIds)
      ? character.charBattleTagIds.map(stringValue)
      : Array.isArray(growth.charBattleTag)
        ? growth.charBattleTag.map(stringValue)
        : [],
    meta: [
      {
        id: 'profession',
        label: '',
        value: mappedLabel(maps, ['profession_id_map', 'profession_map'], professionId)
      },
      { id: 'weapon', label: '', value: mappedLabel(maps, ['weapon_id_map', 'weapon_map'], weaponType) },
      { id: 'element', label: '', value: mappedLabel(maps, ['char_type_map'], charType) },
      {
        id: 'mainAttribute',
        label: '',
        value: attributeLabel(maps, character.mainAttrType ?? growth.mainAttrType)
      },
      {
        id: 'subAttribute',
        label: '',
        value: attributeLabel(maps, growth.subAttrType ?? character.subAttrType)
      },
      { id: 'voiceActor', label: '', value: voices.join(' / ') }
    ].filter((item) => item.value !== ''),
    profile: textValue(profileItem.desc),
    feature: textValue(profession.desc),
    growth: buildGrowth(character, maps),
    ...effectsModel,
    skills: buildCharacterSkills(growth, skills, itemTable),
    logistics: buildCharacterLogistics(
      row(tables, 'SpaceshipCharSkillTable', id),
      asRecord(tables.SpaceshipSkillTable),
      maps
    ),
    profileRecords: Array.isArray(character.profileRecord)
      ? character.profileRecord.map(asRecord).map((record) => ({
          title: textValue(record.recordTitle),
          description: textValue(record.recordDesc)
        }))
      : [],
    voiceRecords: Array.isArray(character.profileVoice)
      ? character.profileVoice.map(asRecord).map((record) => ({
          title: textValue(record.voiceTitle, stringValue(record.voId)),
          description: textValue(record.voiceDesc)
        }))
      : []
  }
}

function skillPatchLevels(skill: RawRecord): WeaponSkillLevelModel[] {
  const bundle = Array.isArray(skill.SkillPatchDataBundle) ? skill.SkillPatchDataBundle.map(asRecord) : []
  return bundle.map((level, index) => {
    const values = blackboardValues(level.blackboard)
    return {
      level: numberValue(level.level, index + 1),
      description: interpolateCatalogDescription(textValue(level.description), values),
      parameters: Object.entries(values).map(([id, value]) => ({
        id,
        label: id,
        value: typeof value === 'number' ? value : stringValue(value)
      }))
    }
  })
}

export function buildWeaponDetailModel(
  id: string,
  entry: CatalogEntry,
  tables: TableSet
): WeaponDetailModel | null {
  const weapon = row(tables, 'WeaponBasicTable', id)
  if (!Object.keys(weapon).length) return null
  const items = asRecord(tables.ItemTable)
  const item = asRecord(items[id])
  const iconId = stringValue(item.iconId) || id
  const skillTable = asRecord(tables.SkillPatchTable)
  const skillIds = Array.isArray(weapon.weaponSkillList) ? weapon.weaponSkillList.map(stringValue) : []
  const skills = skillIds
    .map((skillId): WeaponSkillModel | null => {
      const skill = asRecord(skillTable[skillId])
      const levels = skillPatchLevels(skill)
      if (!levels.length) return null
      const first = Array.isArray(skill.SkillPatchDataBundle) ? asRecord(skill.SkillPatchDataBundle[0]) : {}
      return { id: skillId, name: textValue(first.skillName, skillId), levels }
    })
    .filter((skill): skill is WeaponSkillModel => skill !== null)
  const upgrade = row(tables, 'WeaponUpgradeTemplateTable', weapon.levelTemplateId)
  const attackRows = Array.isArray(upgrade.list)
    ? upgrade.list.map(asRecord).map((level) => ({
        level: numberValue(level.weaponLv),
        attack: numberValue(level.baseAtk)
      }))
    : []
  const breakthrough = row(tables, 'WeaponBreakThroughTemplateTable', weapon.breakthroughTemplateId)
  const breakthroughs = Array.isArray(breakthrough.list)
    ? breakthrough.list.map(asRecord).map((level) => ({
        level: numberValue(level.breakthroughShowLv),
        gold: numberValue(level.breakthroughGold),
        materials: Array.isArray(level.breakItemList)
          ? level.breakItemList.map((material) => itemCost(material, items))
          : [],
        skillBounds: Array.isArray(level.skillLevelBounds)
          ? level.skillLevelBounds.map(asRecord).map((bound, index) => ({
              skill: index + 1,
              lower: numberValue(bound.lowerBound),
              upper: numberValue(bound.upperBound)
            }))
          : []
      }))
    : []
  const talent = row(tables, 'WeaponTalentTemplateTable', weapon.talentTemplateId)
  const potentials = Array.isArray(talent.list)
    ? talent.list.map(asRecord).map((potential) => ({
        level: numberValue(potential.talentLv),
        skillBounds: Array.isArray(potential.skillLevelExtraBounds)
          ? potential.skillLevelExtraBounds
              .map(asRecord)
              .map((bound, index) => ({ skill: index + 1, upper: numberValue(bound.upperBound) }))
              .filter((bound) => bound.upper > 0)
          : []
      }))
    : []
  return {
    kind: 'weapon',
    id,
    name: textValue(item.name, entry.name),
    rarity: numberValue(weapon.rarity, entry.rarity),
    icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`,
    illustration: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/gachaweapon/${iconId}.png`,
    description: textValue(item.desc),
    decorativeDescription: textValue(item.decoDesc),
    attackRows,
    skills,
    breakthroughs,
    potentials,
    story: textValue(weapon.weaponDesc)
  }
}

function enemyIndependentAttributes(attribute: RawRecord, maps: LocaleMaps): CatalogLabeledValue[] {
  const independent = asRecord(attribute.levelIndependentAttributes)
  const rows = Array.isArray(independent.attrs) ? independent.attrs.map(asRecord) : []
  const values: CatalogLabeledValue[] = rows
    .filter((item) => numberValue(item.attrType, -1) !== 0)
    .map((item) => ({
      id: `attr-${stringValue(item.attrType)}`,
      label: attributeLabel(maps, item.attrType),
      value: numberValue(item.attrValue)
    }))
  for (const field of ENEMY_SCALAR_META_FIELDS) {
    if (attribute[field] !== undefined && attribute[field] !== null) {
      values.push({ id: field, label: '', value: numberValue(attribute[field]) })
    }
  }
  if (Array.isArray(attribute.poiseKnotPctList) && attribute.poiseKnotPctList.length) {
    values.push({
      id: 'poiseKnotPct',
      label: '',
      value: attribute.poiseKnotPctList.map(stringValue).join(', ')
    })
  }
  return values
}

function enemyVariantRows(
  attribute: RawRecord,
  modifiers: readonly CatalogAttributeModifier[]
): EnemyVariantRow[] {
  const levels = Array.isArray(attribute.levelDependentAttributes)
    ? attribute.levelDependentAttributes.map(asRecord)
    : []
  return levels
    .map((level): EnemyVariantRow | null => {
      const attrs = Array.isArray(level.attrs) ? level.attrs.map(asRecord) : []
      const levelValue = numberValue(attrs.find((item) => numberValue(item.attrType, -1) === 0)?.attrValue)
      if (levelValue <= 0) return null
      const value = (attrType: number) =>
        numberValue(attrs.find((item) => numberValue(item.attrType, -1) === attrType)?.attrValue)
      return {
        level: levelValue,
        hp: applyCatalogAttributeModifiers(value(1), modifiers, 1),
        attack: applyCatalogAttributeModifiers(value(2), modifiers, 2),
        defense: applyCatalogAttributeModifiers(value(3), modifiers, 3)
      }
    })
    .filter((item): item is EnemyVariantRow => item !== null)
}

export function buildEnemyDetailModel(
  id: string,
  entry: CatalogEntry,
  tables: TableSet,
  maps: LocaleMaps = {}
): EnemyDetailModel | null {
  const display = row(tables, 'EnemyTemplateDisplayInfoTable', id)
  if (!Object.keys(display).length) return null
  const attributes = asRecord(tables.EnemyAttributeTemplateTable)
  const enemyRows = tableRecords(tables.EnemyTable)
  const baseVariant = enemyRows.find(([variantId]) => variantId === id)?.[1] ?? enemyRows[0]?.[1] ?? {}
  const baseAttributeId = stringValue(baseVariant.attrTemplateId) || id
  const baseAttribute = asRecord(attributes[baseAttributeId])
  const baseMeta = enemyIndependentAttributes(baseAttribute, maps)
  const baseMetaMap = new Map(baseMeta.map((item) => [item.id, item.value]))
  const variants = enemyRows
    .map(([variantId, variant]): EnemyVariantModel => {
      const attributeId = stringValue(variant.attrTemplateId) || id
      const attribute = asRecord(attributes[attributeId])
      const rawModifiers = Array.isArray(variant.attrModifiers) ? variant.attrModifiers.map(asRecord) : []
      const attributeModifiers = rawModifiers.map((modifier) => ({
        attrType: numberValue(modifier.attrType),
        modifierType: numberValue(modifier.modifierType),
        attrValue: numberValue(modifier.attrValue)
      }))
      const modifiers = rawModifiers.map((modifier, index) => ({
        id: `${variantId}-${index}`,
        label: attributeLabel(maps, modifier.attrType),
        value:
          `${mappedLabel(maps, ['MODIFIER_TYPE_MAP'], modifier.modifierType)} ${numberValue(modifier.attrValue)}`.trim()
      }))
      const currentMeta = enemyIndependentAttributes(attribute, maps)
      const differences = currentMeta
        .filter((item) => baseMetaMap.has(item.id) && baseMetaMap.get(item.id) !== item.value)
        .map((item) => ({
          ...item,
          value: `${stringValue(baseMetaMap.get(item.id))} → ${stringValue(item.value)}`
        }))
      const flags = [
        variant.isDangerous ? 'dangerous' : '',
        variant.showBigEffect ? 'globalEffect' : '',
        variant.showBigHeadbar ? 'pinnedHealthBar' : ''
      ].filter(Boolean)
      return {
        id: variantId,
        templateId: attributeId,
        isBase: variantId === id,
        modifiers,
        buffs: Array.isArray(variant.bornBuffs) ? variant.bornBuffs.map(stringValue) : [],
        flags,
        differences,
        rows: enemyVariantRows(attribute, attributeModifiers)
      }
    })
    .toSorted(
      (left, right) => Number(right.isBase) - Number(left.isBase) || left.id.localeCompare(right.id, 'en')
    )
  const type = row(tables, 'DisplayEnemyTypeTable', display.displayType)
  const distributions = tableRecords(tables.DistributionInfoTable)
    .map(([, distribution]) => textValue(distribution.areaName))
    .filter(Boolean)
  const abilityTable = asRecord(tables.EnemyAbilityDescTable)
  const abilities = Array.isArray(display.abilityDescIds)
    ? display.abilityDescIds
        .map((abilityId) => textValue(asRecord(abilityTable[stringValue(abilityId)]).description))
        .filter(Boolean)
    : []
  return {
    kind: 'enemy',
    id,
    name: textValue(display.name, entry.name),
    rarity: ENEMY_RARITY_BY_DISPLAY_TYPE[numberValue(display.displayType)] ?? entry.rarity,
    icon: entry.icon,
    portrait: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`,
    tags: [textValue(type.name), ...distributions].filter(Boolean),
    meta: baseMeta,
    description: textValue(display.description),
    abilities,
    poiseBreakBuffs: Array.isArray(baseAttribute.poiseKnotBuffList)
      ? baseAttribute.poiseKnotBuffList.map(stringValue)
      : [],
    variants
  }
}

function equipAttributeModel(
  value: unknown,
  maps: LocaleMaps,
  fallbackId: string
): EquipAttributeModel | null {
  const source = asRecord(value)
  if (!Object.keys(source).length) return null
  const composite = stringValue(source.compositeAttr)
  const label = composite
    ? mappedLabel(maps, ['COMPOSITE_NAME_MAP'], composite)
    : attributeLabel(maps, source.attrType)
  return {
    id: stringValue(source.attrIndex) || fallbackId,
    label,
    modifierLabel: mappedLabel(maps, ['MODIFIER_TYPE_MAP'], source.modifierType),
    value: numberValue(source.attrValue),
    enhancedValues: Array.isArray(source.enhancedAttrValues)
      ? source.enhancedAttrValues.map((item) => numberValue(item))
      : []
  }
}

function equipCraftingChains(pieceId: string, tables: TableSet, itemTable: RawRecord): EquipCostChainModel[] {
  const formulaId = stringValue(tables.EquipFormulaReverseTable?.[pieceId])
  const formula = row(tables, 'EquipFormulaTable', formulaId)
  const chain = row(tables, 'EquipFormulaChainTable', formula.level)
  const chains = Array.isArray(chain.chainList) ? chain.chainList.map(asRecord) : []
  return chains.map((source, index) => {
    const items: CatalogCostItem[] = []
    const goldId = stringValue(source.costGoldId)
    if (goldId) items.push(itemCost({ id: goldId }, itemTable, source.costGoldNum))
    const ids = Array.isArray(source.costItemId) ? source.costItemId : []
    const counts = Array.isArray(source.costItemNum) ? source.costItemNum : []
    ids.forEach((id, itemIndex) => items.push(itemCost({ id }, itemTable, counts[itemIndex])))
    return {
      id: stringValue(source.chainId) || `${formulaId}-${index}`,
      level: stringValue(formula.level),
      isDefault: source.isDefault === true,
      items
    }
  })
}

function equipGuarantees(
  modifiers: readonly RawRecord[],
  tables: TableSet,
  maps: LocaleMaps
): EquipGuaranteeModel[] {
  return modifiers.flatMap((modifier) => {
    const ruleId = stringValue(modifier.enhanceGuaranteeTimesRuleId)
    const rule = row(tables, 'EquipEnhanceGuaranteeTimesRuleTable', ruleId)
    if (!ruleId || !Object.keys(rule).length) return []
    const attribute = equipAttributeModel(modifier, maps, ruleId)
    return attribute
      ? [
          {
            label: attribute.label,
            values: [1, 2, 3].map((level) => numberValue(rule[`GuaranteeTimes${level}`]))
          }
        ]
      : []
  })
}

export function buildEquipDetailModel(
  id: string,
  entry: CatalogEntry,
  tables: TableSet,
  maps: LocaleMaps = {},
  baselineTables?: TableSet
): EquipDetailModel | null {
  const suit = row(tables, 'EquipSuitTable', id)
  if (!Object.keys(suit).length) return null
  const itemTable = asRecord(tables.ItemTable)
  const equipTable = asRecord(tables.EquipTable)
  const baselineEquipIds = baselineTables
    ? new Set(tableRecords(baselineTables.EquipTable).map(([pieceId]) => pieceId))
    : null
  const pieces = tableRecords(equipTable)
    .map(([pieceId, piece]): EquipPieceModel => {
      const item = asRecord(itemTable[pieceId])
      const modifiers = Array.isArray(piece.displayAttrModifiers)
        ? piece.displayAttrModifiers.map(asRecord).filter((modifier) => numberValue(modifier.attrIndex) > 0)
        : []
      return {
        id: pieceId,
        name: textValue(item.name, pieceId),
        added: baselineEquipIds !== null && !baselineEquipIds.has(pieceId),
        rarity: numberValue(item.rarity),
        icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${stringValue(item.iconId) || pieceId}.png`,
        partType: numberValue(piece.partType),
        minimumLevel: numberValue(piece.minWearLv),
        domainId: stringValue(piece.domainId),
        domainLabel: mappedLabel(maps, ['DOMAIN_MAP'], piece.domainId),
        description: textValue(item.decoDesc),
        mainStat: equipAttributeModel(piece.displayBaseAttrModifier, maps, `${pieceId}-main`),
        subStats: modifiers.flatMap((modifier, index) => {
          const attribute = equipAttributeModel(modifier, maps, `${pieceId}-${index}`)
          return attribute ? [attribute] : []
        }),
        crafting: equipCraftingChains(pieceId, tables, itemTable),
        guarantees: equipGuarantees(modifiers, tables, maps)
      }
    })
    .toSorted(
      (left, right) =>
        Number(right.added) - Number(left.added) ||
        right.rarity - left.rarity ||
        left.partType - right.partType ||
        left.id.localeCompare(right.id, 'en')
    )
  const representative = pieces[0]
  const suitInfo = Array.isArray(suit.list) ? asRecord(suit.list[0]) : {}
  const skills = tableRecords(tables.SkillPatchTable).flatMap(([skillId, skill]) => {
    const bundle = Array.isArray(skill.SkillPatchDataBundle) ? skill.SkillPatchDataBundle.map(asRecord) : []
    return bundle.flatMap((level, index): EquipSkillModel[] => {
      const description = textValue(level.description)
      if (!description) return []
      const values = blackboardValues(level.blackboard)
      return [
        {
          id: `${skillId}-${numberValue(level.level, index + 1)}`,
          name: textValue(level.skillName, skillId),
          description: interpolateCatalogDescription(description, values),
          parameters: Object.entries(values).map(([key, value]) => ({
            id: key,
            label: key,
            value: typeof value === 'number' ? value : stringValue(value)
          }))
        }
      ]
    })
  })
  const packs = tableRecords(tables.EquipPackTable)
    .map(([packId, pack]) => textValue(pack.name, packId))
    .filter(Boolean)
  const tech = asRecord(tables.EquipTechConst)
  const constants = asRecord(tables.EquipConst)
  const maximumCraftingCount =
    tech.equipProduceMaxCount === undefined ? null : numberValue(tech.equipProduceMaxCount)
  const recyclingReturnRate =
    tech.equipRecycleRatio === undefined ? null : numberValue(tech.equipRecycleRatio)
  const maximumEnhancementLevel =
    constants.maxAttrEnhanceLevel === undefined ? null : numberValue(constants.maxAttrEnhanceLevel)
  const costs = tableRecords(tables.EquipEnhanceCostTable).map(
    ([domainId, cost]): EquipEnhancementCostModel => ({
      domainId: stringValue(cost.domainId) || domainId,
      domainLabel: mappedLabel(maps, ['DOMAIN_MAP'], cost.domainId ?? domainId),
      consumeId: stringValue(cost.consumeItemId),
      consumeCount: numberValue(cost.consumeItemCnt),
      returnId: stringValue(cost.returnbackItemId),
      returnCount: numberValue(cost.returnbackItemCnt)
    })
  )
  const enhancement =
    maximumCraftingCount !== null ||
    recyclingReturnRate !== null ||
    maximumEnhancementLevel !== null ||
    costs.length
      ? { maximumCraftingCount, recyclingReturnRate, maximumEnhancementLevel, costs }
      : null
  return {
    kind: 'equip',
    id,
    name: textValue(suitInfo.suitName, entry.name),
    rarity: representative?.rarity ?? entry.rarity,
    icon: representative?.icon ?? entry.icon,
    packs,
    skills,
    pieces,
    enhancement
  }
}

function itemEffectDescription(source: string, useItem: RawRecord, equipItem: RawRecord): string {
  const values: Record<string, unknown> = {}
  const scopedValues = new Map<string, unknown>()
  const actions = Array.isArray(useItem.useActions) ? useItem.useActions.map(asRecord) : []
  for (const action of actions) {
    for (const data of [asRecord(action.buffBBData), asRecord(action.skillBBData)]) {
      const scope = stringValue(data.buffId ?? data.skillId)
      for (const [key, value] of Object.entries(blackboardValues(data.blackboard))) {
        values[key.toLocaleLowerCase()] = value
        if (scope) scopedValues.set(`${scope.toLocaleLowerCase()}\\${key.toLocaleLowerCase()}`, value)
      }
    }
  }
  if (Array.isArray(equipItem.condParams)) {
    equipItem.condParams.forEach((value, index) => {
      values[`param${index + 1}`] = value
    })
  }
  if (equipItem.chargeCount !== undefined) values.count = equipItem.chargeCount
  let normalized = source
  for (const [key, value] of scopedValues) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    normalized = normalized.replace(new RegExp(escaped, 'gi'), String(value))
  }
  return interpolateCatalogDescription(normalized, values)
}

function itemRecipeCost(value: unknown, itemTable: RawRecord): CatalogCostItem {
  const source = asRecord(value)
  return itemCost({ id: source.id, count: source.count ?? 1 }, itemTable)
}

function flattenedRecipeGroups(value: unknown): RawRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((group) => {
    const source = asRecord(group)
    return Array.isArray(source.group) ? source.group.map(asRecord) : [source]
  })
}

function itemRecipes(tables: TableSet, itemTable: RawRecord): ItemRecipeModel[] {
  const recipes: ItemRecipeModel[] = []
  const add = (
    id: string,
    kind: string,
    name: string,
    inputs: readonly RawRecord[],
    outputs: readonly RawRecord[],
    meta = '',
    durationMs = 0
  ) => {
    recipes.push({
      id,
      kind,
      name,
      meta,
      durationMs,
      inputs: inputs.filter((item) => item.id).map((item) => itemRecipeCost(item, itemTable)),
      outputs: outputs.filter((item) => item.id).map((item) => itemRecipeCost(item, itemTable))
    })
  }
  for (const [recipeId, recipe] of tableRecords(tables.FactoryMachineCraftTable)) {
    const group = row(tables, 'FactoryMachineCraftGroupTable', recipe.formulaGroupId)
    const building = row(tables, 'FactoryBuildingTable', recipe.machineId)
    add(
      recipeId,
      'integratedIndustry',
      textValue(recipe.formulaDesc, recipeId),
      flattenedRecipeGroups(recipe.ingredients),
      flattenedRecipeGroups(recipe.outcomes),
      textValue(building.name, stringValue(recipe.machineId)),
      numberValue(recipe.progressRound) * numberValue(group.msPerRound)
    )
  }
  for (const [recipeId, recipe] of tableRecords(tables.FactoryManualCraftTable)) {
    add(
      recipeId,
      'manualCrafting',
      textValue(recipe.name, recipeId),
      Array.isArray(recipe.ingredients) ? recipe.ingredients.map(asRecord) : [],
      Array.isArray(recipe.outcomes) ? recipe.outcomes.map(asRecord) : []
    )
  }
  for (const [recipeId, recipe] of tableRecords(tables.FactoryHubCraftTable)) {
    add(
      recipeId,
      'hubManufacturing',
      recipeId,
      Array.isArray(recipe.ingredients) ? recipe.ingredients.map(asRecord) : [],
      Array.isArray(recipe.outcomes) ? recipe.outcomes.map(asRecord) : [],
      recipe.usableLevel === undefined ? '' : stringValue(recipe.usableLevel)
    )
  }
  for (const [recipeId, recipe] of tableRecords(tables.EquipFormulaTable)) {
    const ids = Array.isArray(recipe.costItemId) ? recipe.costItemId : []
    const counts = Array.isArray(recipe.costItemNum) ? recipe.costItemNum : []
    const inputs = ids.map((id, index) => ({ id, count: counts[index] }))
    if (recipe.costGoldId && numberValue(recipe.costGoldNum) > 0) {
      inputs.unshift({ id: recipe.costGoldId, count: recipe.costGoldNum })
    }
    add(recipeId, 'equipmentManufacturing', recipeId, inputs.map(asRecord), [
      { id: recipe.outcomeEquipId, count: 1 }
    ])
  }
  for (const [recipeId, recipe] of tableRecords(tables.SpaceshipGrowCabinFormulaTable)) {
    add(
      recipeId,
      'growCabinPlanting',
      recipeId,
      [{ id: recipe.seedItemId, count: recipe.seedItemCount }],
      [{ id: recipe.outcomeItemId, count: recipe.outcomeItemCount }],
      stringValue(recipe.level),
      numberValue(recipe.totalProgress)
    )
  }
  for (const [recipeId, recipe] of tableRecords(tables.SpaceshipGrowCabinSeedFormulaTable)) {
    add(
      recipeId,
      'growCabinSeedCollection',
      recipeId,
      [{ id: recipe.materialItemId, count: recipe.materialItemCount }],
      [{ id: recipe.outcomeseedItemId, count: recipe.outcomeseedItemCount }],
      stringValue(recipe.level)
    )
  }
  for (const [recipeId, recipe] of tableRecords(tables.SpaceshipManufactureFormulaTable)) {
    add(
      recipeId,
      'spaceshipManufacturing',
      recipeId,
      [],
      [{ id: recipe.outcomeItemId, count: 1 }],
      stringValue(recipe.level),
      numberValue(recipe.totalProgress)
    )
  }
  return recipes.toSorted(
    (left, right) => left.kind.localeCompare(right.kind, 'en') || left.id.localeCompare(right.id, 'en')
  )
}

export function buildItemDetailModel(
  id: string,
  entry: CatalogEntry,
  tables: TableSet,
  maps: LocaleMaps = {}
): ItemDetailModel | null {
  const item = row(tables, 'ItemTable', id)
  if (!Object.keys(item).length) return null
  const itemTable = asRecord(tables.ItemTable)
  const type = row(tables, 'ItemTypeTable', item.type)
  const useItem = row(tables, 'UseItemTable', id)
  const equipItem = row(tables, 'EquipItemTable', id)
  const effects: ItemEffectModel[] = []
  const useDescription = textValue(useItem.itemUseDesc)
  if (useDescription) {
    effects.push({
      id: 'afterUse',
      descriptions: [itemEffectDescription(useDescription, useItem, equipItem)],
      meta:
        numberValue(useItem.duration) > 0
          ? [{ id: 'duration', label: '', value: numberValue(useItem.duration) }]
          : []
    })
  }
  if (Object.keys(equipItem).length) {
    const descriptions = [textValue(equipItem.equipDesc), textValue(equipItem.equipExtraDesc)]
      .filter(Boolean)
      .map((description) => itemEffectDescription(description, useItem, equipItem))
    const meta = [
      { id: 'useCount', value: equipItem.chargeCount },
      { id: 'cooldown', value: equipItem.cooldown },
      { id: 'castTime', value: equipItem.castTime },
      { id: 'recoverCount', value: equipItem.recoverUpperCount },
      { id: 'recoveryInterval', value: equipItem.recoverTime }
    ]
      .filter((item) => item.value !== undefined && numberValue(item.value) > 0)
      .map((item) => ({ id: item.id, label: '', value: numberValue(item.value) }))
    if (descriptions.length || meta.length) effects.push({ id: 'afterEquip', descriptions, meta })
  }
  const properties: CatalogLabeledValue[] = []
  if (item.maxStackCount !== undefined && numberValue(item.maxStackCount, -1) !== -1) {
    properties.push({ id: 'maxStack', label: '', value: numberValue(item.maxStackCount) })
  }
  if (item.maxBackpackStackCount !== undefined && numberValue(item.maxBackpackStackCount, -1) !== -1) {
    properties.push({
      id: 'backpackStackLimit',
      label: '',
      value: numberValue(item.maxBackpackStackCount)
    })
  }
  if (type.storageSpace !== undefined) {
    properties.push({ id: 'storageSpace', label: '', value: numberValue(type.storageSpace) })
  }
  const obtainWays = (Array.isArray(item.obtainWayIds) ? item.obtainWayIds : []).flatMap((wayId) => {
    const way = row(tables, 'SystemJumpTable', wayId)
    if (!Object.keys(way).length) return []
    return [
      {
        id: stringValue(wayId),
        icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemtips/${stringValue(way.iconId)}.png`,
        description: textValue(way.desc, stringValue(way.id) || stringValue(wayId))
      }
    ]
  })
  const composite = row(tables, 'ItemIconCompositeTable', item.iconCompositeId)
  const iconComposite: CatalogLabeledValue[] = Object.keys(composite).length
    ? [
        { id: 'iconTransformType', label: '', value: numberValue(composite.iconTransType) },
        { id: 'showRarity', label: '', value: composite.showRarity === true ? 'yes' : 'no' },
        ...(composite.markIcon ? [{ id: 'markIcon', label: '', value: stringValue(composite.markIcon) }] : [])
      ]
    : []
  const showing = row(tables, 'ItemShowingTypeTable', item.showingType)
  const weaponPotential = row(tables, 'WeaponPotentialUpItemTable', id)
  const applicableWeapons = Array.isArray(weaponPotential.weaponIds)
    ? weaponPotential.weaponIds.map(stringValue).filter(Boolean)
    : []
  const usableItemChest = row(tables, 'UsableItemChestTable', id)
  const choiceBox = Object.keys(usableItemChest).length
    ? {
        selectedCount: numberValue(usableItemChest.selectedCount),
        rewardIds: Array.isArray(usableItemChest.rewardIdList)
          ? usableItemChest.rewardIdList.map(stringValue).filter(Boolean)
          : []
      }
    : null
  const wikiEntryRecord = tableRecords(tables.WikiEntryDataTable).find(
    ([, wikiEntry]) => stringValue(wikiEntry.refItemId) === id
  )
  const encyclopedia = wikiEntryRecord
    ? {
        id: stringValue(wikiEntryRecord[1].id) || wikiEntryRecord[0],
        groupId: stringValue(wikiEntryRecord[1].groupId)
      }
    : null
  return {
    kind: 'item',
    id,
    name: textValue(item.name, entry.name),
    rarity: numberValue(item.rarity, entry.rarity),
    icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${stringValue(item.iconId) || id}.png`,
    typeLabel: textValue(type.name, mappedLabel(maps, ['item_type_map'], item.type)),
    description: textValue(item.desc),
    decorativeDescription: textValue(item.decoDesc),
    effects,
    properties,
    recipes: itemRecipes(tables, itemTable),
    obtainWays,
    applicableWeapons,
    choiceBox,
    iconComposite,
    displayType: textValue(showing.name, stringValue(showing.type)),
    encyclopedia
  }
}

export function buildAchievementDetailModel(
  id: string,
  tables: TableSet,
  baselineTables?: TableSet
): AchievementDetailModel | null {
  const category = row(tables, 'AchievementTypeTable', id)
  if (!Object.keys(category).length) return null
  const achievements = tableRecords(tables.AchievementTable)
  const baselineAchievementIds = baselineTables
    ? new Set(tableRecords(baselineTables.AchievementTable).map(([achievementId]) => achievementId))
    : null
  const noObtainCanView = category.noObtainCanView !== false
  const groups = (
    Array.isArray(category.achievementGroupData) ? category.achievementGroupData.map(asRecord) : []
  ).map((group, groupIndex): AchievementGroupModel => {
    const groupId = stringValue(group.groupId) || `group-${groupIndex}`
    return {
      id: groupId,
      name: textValue(group.groupName, 'default'),
      achievements: achievements
        .filter(([, achievement]) => stringValue(achievement.groupId) === groupId)
        .map(([achievementId, achievement]): AchievementModel => ({
          id: achievementId,
          name: textValue(achievement.name, achievementId),
          order: numberValue(achievement.order, 999),
          added: baselineAchievementIds !== null && !baselineAchievementIds.has(achievementId),
          upgradable: achievement.canBeUpgraded === true,
          platable: achievement.canBePlated === true,
          rareEffect: achievement.applyRareEffect === true,
          hiddenUntilObtained: !noObtainCanView,
          levels: recordValues(achievement.levelInfos)
            .map((level): AchievementLevelModel => {
              const achieveLevel = numberValue(level.achieveLevel, 1)
              return {
                level: achieveLevel,
                icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/medaliconbig/${achievementId}_lv${String(achieveLevel).padStart(2, '0')}.png`,
                description: textValue(level.completeDesc),
                conditions: Array.isArray(level.conditions)
                  ? level.conditions.map(asRecord).map((condition, conditionIndex) => ({
                      id:
                        stringValue(condition.conditionId) ||
                        `${achievementId}-${achieveLevel}-${conditionIndex}`,
                      description: textValue(condition.desc),
                      progress:
                        typeof condition.progressToCompare === 'number'
                          ? condition.progressToCompare
                          : stringValue(condition.progressToCompare)
                    }))
                  : []
              }
            })
            .toSorted((left, right) => left.level - right.level)
        }))
        .toSorted(
          (left, right) =>
            Number(right.added) - Number(left.added) ||
            left.order - right.order ||
            left.id.localeCompare(right.id, 'en')
        )
    }
  })
  return { kind: 'achievement', id, name: textValue(category.categoryName, id), groups }
}

export function buildCatalogDetailPresentation(
  moduleId: CatalogModuleId,
  id: string,
  entry: CatalogEntry,
  tables: TableSet,
  maps: LocaleMaps = {},
  baselineTables?: TableSet
): CatalogDetailPresentation | null {
  if (moduleId === 'v3_character') return buildCharacterDetailModel(id, entry, tables, maps)
  if (moduleId === 'v3_weapon') return buildWeaponDetailModel(id, entry, tables)
  if (moduleId === 'v3_enemy') return buildEnemyDetailModel(id, entry, tables, maps)
  if (moduleId === 'v3_equip') return buildEquipDetailModel(id, entry, tables, maps, baselineTables)
  if (moduleId === 'v3_item') return buildItemDetailModel(id, entry, tables, maps)
  if (moduleId === 'v3_achievement') return buildAchievementDetailModel(id, tables, baselineTables)
  return null
}
