import type { ActionGraph, ActionNode, CombatDomain } from '@ake/combat-graph'
import { asRecord, textValue, type RawRecord } from '@ake/domain'
import type { CombatDirectoryTables, CombatManifestEntry, SkillPatchSummary } from '../api/repository'

export interface CombatDirectoryItem extends CombatManifestEntry {
  displayName: string
  searchText: string
}

export interface CombatDirectoryGroup {
  id: string
  name: string
  iconId: string
  skillGroupType: number | null
  rootIds: readonly string[]
  items: readonly CombatDirectoryItem[]
}

export interface CombatDirectoryOwner {
  id: string
  sourcePrefix: string
  kind: 'character' | 'enemy' | 'category'
  sectionId: string
  name: string
  secondaryName: string
  iconPath: string
  rarity: number
  sourceOrder: number
  groups: readonly CombatDirectoryGroup[]
  searchText: string
}

export interface CombatDirectorySection {
  id: string
  owners: readonly CombatDirectoryOwner[]
  itemCount: number
}

export interface LegacyMetric {
  id: string
  value: string
  important?: boolean
}

export interface LegacyWindow {
  id: string
  label: string
  kind: 'damage' | 'cancel' | 'defense' | 'movement' | 'timing' | 'other'
  start: number
  end: number
}

export interface LegacyHit {
  id: string
  label: string
  time: string
  damage: string
  poise: string
  resource: string
  note: string
}

export interface LegacyBlackboardEntry {
  key: string
  value: string
  source: 'raw' | 'patch'
}

export interface LegacyEffectItem {
  id: string
  title: string
  fields: readonly { key: string; value: string }[]
}

export interface LegacyEffectGroup {
  id: string
  items: readonly LegacyEffectItem[]
}

const EMPTY_TABLES: CombatDirectoryTables = {
  characters: {},
  growth: {},
  enemyDisplay: {},
  enemies: {}
}

const SECTION_ORDER: Readonly<Record<string, number>> = {
  characters: 0,
  monsters: 10,
  weapons: 20,
  equipment: 30,
  abilityEntities: 40,
  modes: 50,
  common: 60,
  other: 1000
}

function stringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function numberValue(value: unknown): number | null {
  const unwrapped = configuredValue(value)
  const numeric = typeof unwrapped === 'number' ? unwrapped : Number(unwrapped)
  return Number.isFinite(numeric) ? numeric : null
}

function values(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function characterAlias(value: string): string {
  const match = value.match(/^chr_(\d+)_([^_]+)/i)
  return match ? `${Number(match[1])}:${match[2]!.toLocaleLowerCase()}` : ''
}

function normalizedCharacterId(value: string): string {
  return value
    .replace(/^chr_(\d+)_([^_]+)/i, (_all, number: string, name: string) => {
      return `chr_${Number(number)}_${name.toLocaleLowerCase()}`
    })
    .toLocaleLowerCase()
}

function categoryFor(domain: CombatDomain, id: string): string {
  const value = id.replace(/^buff_/, '')
  if (/^(?:chr|char)_/i.test(value)) return 'characters'
  if (/^(?:eny|enemy|monster|race)_/i.test(value)) return 'monsters'
  if (/^(?:wpn|weapon|weaponmodule|passive)_/i.test(value)) return 'weapons'
  if (/^(?:equip|equipment|armor|suit)_/i.test(value)) return 'equipment'
  if (/^(?:abilityentity|ability_entity|int|interactive)_/i.test(value)) return 'abilityEntities'
  if (/^(?:dungeon|mode|rpg|rogue|raid|activity|level|stage)_/i.test(value)) return 'modes'
  if (domain === 'buff' && /^(?:common|global|shared|system|cc|battle)_/i.test(value)) return 'common'
  return 'other'
}

function groupName(group: RawRecord, fallback: string): string {
  return textValue(group.name, stringValue(group.skillGroupId, fallback))
}

function itemDisplayName(item: CombatManifestEntry, ownerPrefix: string): string {
  const id = item.id
  const candidates = [`buff_${ownerPrefix}_`, `${ownerPrefix}_`].filter((prefix) => prefix !== 'buff__')
  const prefix = candidates.find((candidate) =>
    id.toLocaleLowerCase().startsWith(candidate.toLocaleLowerCase())
  )
  if (prefix) return id.slice(prefix.length) || id
  return item.name && item.name !== item.id ? item.name : id.replace(/^buff_/, '')
}

interface MutableGroup extends Omit<CombatDirectoryGroup, 'items'> {
  items: CombatDirectoryItem[]
  sourceOrder: number
}

interface MutableOwner extends Omit<CombatDirectoryOwner, 'groups' | 'searchText'> {
  groups: MutableGroup[]
  searchText: string
}

function createCharacterOwners(tables: CombatDirectoryTables, domain: CombatDomain): MutableOwner[] {
  return Object.entries(tables.characters).map(([id, source], sourceOrder) => {
    const character = asRecord(source)
    const growth = asRecord(tables.growth[id])
    const groups: MutableGroup[] = []
    if (domain === 'skill') {
      Object.entries(asRecord(growth.skillGroupMap)).forEach(([groupId, value], groupOrder) => {
        const group = asRecord(value)
        groups.push({
          id: stringValue(group.skillGroupId, groupId),
          name: groupName(group, groupId),
          iconId: stringValue(group.icon),
          skillGroupType: numberValue(group.skillGroupType),
          rootIds: values(group.skillIdList)
            .map((entry) => stringValue(entry))
            .filter(Boolean),
          items: [],
          sourceOrder: numberValue(group.skillGroupType) ?? groupOrder
        })
      })
    }
    if (!groups.length) {
      groups.push({
        id: `${id}__items`,
        name: '',
        iconId: '',
        skillGroupType: null,
        rootIds: [],
        items: [],
        sourceOrder: 0
      })
    }
    return {
      id,
      sourcePrefix: id,
      kind: 'character',
      sectionId: 'characters',
      name: textValue(character.name, textValue(growth.name, textValue(growth.engName, id))),
      secondaryName: textValue(growth.engName),
      iconPath: `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/icon_${id}.png`,
      rarity: numberValue(character.rarity ?? growth.rarity) ?? 0,
      sourceOrder: numberValue(character.sortOrder) ?? sourceOrder,
      groups,
      searchText: ''
    }
  })
}

function ensureGroup(owner: MutableOwner, id: string, name = ''): MutableGroup {
  let group = owner.groups.find((entry) => entry.id === id)
  if (!group) {
    group = {
      id,
      name,
      iconId: '',
      skillGroupType: null,
      rootIds: [],
      items: [],
      sourceOrder: owner.groups.length
    }
    owner.groups.push(group)
  }
  return group
}

function matchingCharacterOwner(owners: readonly MutableOwner[], id: string): MutableOwner | undefined {
  const body = id.replace(/^buff_/, '')
  const alias = characterAlias(body)
  return owners
    .filter((owner) => owner.kind === 'character')
    .find(
      (owner) =>
        body === owner.id || body.startsWith(`${owner.id}_`) || (alias && characterAlias(owner.id) === alias)
    )
}

function matchingSkillGroup(owner: MutableOwner, id: string): MutableGroup {
  const normalized = normalizedCharacterId(id)
  let winner: MutableGroup | undefined
  let length = -1
  for (const group of owner.groups) {
    for (const root of group.rootIds) {
      const normalizedRoot = normalizedCharacterId(root)
      if (
        (normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}_`)) &&
        normalizedRoot.length > length
      ) {
        winner = group
        length = normalizedRoot.length
      }
    }
  }
  return winner ?? ensureGroup(owner, `${owner.id}__other`, '')
}

function matchingEnemy(
  tables: CombatDirectoryTables,
  id: string
): { sourcePrefix: string; templateId: string; display: RawRecord; sourceOrder: number } | null {
  const body = id.replace(/^buff_/, '')
  const entries = Object.entries(tables.enemies).toSorted(([left], [right]) => right.length - left.length)
  const match = entries.find(([enemyId]) => body === enemyId || body.startsWith(`${enemyId}_`))
  if (!match) return null
  const templateId = stringValue(asRecord(match[1]).templateId, match[0])
  const display = asRecord(tables.enemyDisplay[templateId] ?? tables.enemyDisplay[match[0]])
  return {
    sourcePrefix: match[0],
    templateId,
    display,
    sourceOrder: Object.keys(tables.enemyDisplay).indexOf(templateId)
  }
}

function directoryItem(entry: CombatManifestEntry, owner: MutableOwner): CombatDirectoryItem {
  const displayName = itemDisplayName(entry, owner.sourcePrefix)
  return {
    ...entry,
    displayName,
    searchText: [entry.id, entry.name, displayName, owner.id, owner.name, owner.secondaryName]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
  }
}

export function buildCombatDirectory(
  manifest: readonly CombatManifestEntry[],
  domain: CombatDomain,
  inputTables: CombatDirectoryTables = EMPTY_TABLES
): CombatDirectorySection[] {
  const tables = inputTables ?? EMPTY_TABLES
  const owners = createCharacterOwners(tables, domain)
  const enemyOwners = new Map<string, MutableOwner>()
  const categoryOwners = new Map<string, MutableOwner>()

  for (const entry of manifest) {
    const character = matchingCharacterOwner(owners, entry.id)
    if (character) {
      const group = domain === 'skill' ? matchingSkillGroup(character, entry.id) : character.groups[0]!
      group.items.push(directoryItem(entry, character))
      continue
    }

    const enemyMatch = matchingEnemy(tables, entry.id)
    if (enemyMatch) {
      let owner = enemyOwners.get(enemyMatch.templateId)
      if (!owner) {
        owner = {
          id: enemyMatch.templateId,
          sourcePrefix: enemyMatch.sourcePrefix,
          kind: 'enemy',
          sectionId: 'monsters',
          name: textValue(enemyMatch.display.name, enemyMatch.templateId),
          secondaryName: textValue(enemyMatch.display.nickname),
          iconPath: `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${enemyMatch.templateId}.png`,
          rarity: 0,
          sourceOrder: enemyMatch.sourceOrder < 0 ? Number.MAX_SAFE_INTEGER : enemyMatch.sourceOrder,
          groups: [
            {
              id: `${enemyMatch.templateId}__items`,
              name: '',
              iconId: '',
              skillGroupType: null,
              rootIds: [],
              items: [],
              sourceOrder: 0
            }
          ],
          searchText: ''
        }
        enemyOwners.set(enemyMatch.templateId, owner)
      }
      owner.groups[0]!.items.push(directoryItem(entry, owner))
      continue
    }

    const sectionId = categoryFor(domain, entry.id)
    let owner = categoryOwners.get(sectionId)
    if (!owner) {
      owner = {
        id: `category:${sectionId}`,
        sourcePrefix: '',
        kind: 'category',
        sectionId,
        name: '',
        secondaryName: '',
        iconPath: '',
        rarity: 0,
        sourceOrder: SECTION_ORDER[sectionId] ?? 1000,
        groups: [
          {
            id: `${sectionId}__items`,
            name: '',
            iconId: '',
            skillGroupType: null,
            rootIds: [],
            items: [],
            sourceOrder: 0
          }
        ],
        searchText: ''
      }
      categoryOwners.set(sectionId, owner)
    }
    owner.groups[0]!.items.push(directoryItem(entry, owner))
  }

  const populated = [...owners, ...enemyOwners.values(), ...categoryOwners.values()]
    .map((owner) => ({
      ...owner,
      groups: owner.groups
        .toSorted(
          (left, right) => left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id, 'en')
        )
        .filter((group) => group.items.length)
        .map((group) => ({
          ...group,
          items: group.items.toSorted(
            (left, right) => left.priority - right.priority || left.id.localeCompare(right.id, 'en')
          )
        }))
    }))
    .filter((owner) => owner.groups.length)
    .map((owner) => ({
      ...owner,
      searchText: [owner.id, owner.name, owner.secondaryName].filter(Boolean).join(' ').toLocaleLowerCase()
    }))
    .toSorted(
      (left, right) =>
        (SECTION_ORDER[left.sectionId] ?? 1000) - (SECTION_ORDER[right.sectionId] ?? 1000) ||
        (left.kind === 'character' && right.kind === 'character' ? right.rarity - left.rarity : 0) ||
        left.sourceOrder - right.sourceOrder ||
        left.id.localeCompare(right.id, 'en')
    )

  const sections = new Map<string, CombatDirectoryOwner[]>()
  for (const owner of populated) {
    const list = sections.get(owner.sectionId) ?? []
    list.push(owner)
    sections.set(owner.sectionId, list)
  }
  return [...sections.entries()].map(([id, sectionOwners]) => ({
    id,
    owners: sectionOwners,
    itemCount: sectionOwners.reduce(
      (total, owner) => total + owner.groups.reduce((sum, group) => sum + group.items.length, 0),
      0
    )
  }))
}

export function filterCombatDirectory(
  sections: readonly CombatDirectorySection[],
  search: string
): CombatDirectorySection[] {
  const term = search.trim().toLocaleLowerCase()
  if (!term) return [...sections]
  return sections
    .map((section) => {
      const owners = section.owners
        .map((owner) => {
          const ownerMatches = owner.searchText.includes(term)
          const groups = owner.groups
            .map((group) => ({
              ...group,
              items:
                ownerMatches || group.name.toLocaleLowerCase().includes(term)
                  ? group.items
                  : group.items.filter((item) => item.searchText.includes(term))
            }))
            .filter((group) => group.items.length)
          return { ...owner, groups }
        })
        .filter((owner) => owner.groups.length)
      return {
        ...section,
        owners,
        itemCount: owners.reduce(
          (total, owner) => total + owner.groups.reduce((sum, group) => sum + group.items.length, 0),
          0
        )
      }
    })
    .filter((section) => section.owners.length)
}

export function findDirectoryOwner(
  sections: readonly CombatDirectorySection[],
  itemId: string
): { owner: CombatDirectoryOwner; group: CombatDirectoryGroup; item: CombatDirectoryItem } | null {
  for (const section of sections) {
    for (const owner of section.owners) {
      for (const group of owner.groups) {
        const item = group.items.find((entry) => entry.id === itemId)
        if (item) return { owner, group, item }
      }
    }
  }
  return null
}

export function configuredValue(value: unknown): unknown {
  const record = asRecord(value)
  if (!Object.keys(record).length) return value
  if (record.useBlackboardKey === true && stringValue(record.blackboardKey)) {
    return `@${stringValue(record.blackboardKey)}`
  }
  if ('value' in record) return record.value
  if (stringValue(record.valueStr)) return record.valueStr
  if ('valueDouble' in record) return record.valueDouble
  return value
}

export function compactValue(value: unknown): string {
  const resolved = configuredValue(value)
  if (resolved === undefined || resolved === null || resolved === '') return ''
  if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
    return String(resolved)
  }
  if (Array.isArray(resolved)) {
    const entries = resolved.map(compactValue).filter(Boolean)
    return entries.length ? entries.slice(0, 6).join(', ') : ''
  }
  const record = asRecord(resolved)
  const entries = Object.entries(record)
    .map(([key, entry]) => [key, compactValue(entry)] as const)
    .filter(([, entry]) => entry)
    .slice(0, 5)
  return entries.map(([key, entry]) => `${key}: ${entry}`).join(' · ')
}

function metric(id: string, value: unknown, important = false): LegacyMetric | null {
  const display = compactValue(value)
  return display ? { id, value: display, ...(important ? { important: true } : {}) } : null
}

export function buildSkillMetrics(
  rawValue: unknown,
  patch: SkillPatchSummary | undefined,
  graph: ActionGraph | undefined
): LegacyMetric[] {
  const raw = asRecord(rawValue)
  const cast = asRecord(raw.castData)
  const cost = asRecord(cast.costData)
  const damageNodes = (graph?.nodes ?? []).filter(
    (node) => node.kind === 'action' && node.category === 'damage'
  )
  const metrics = [
    metric('durationFrame', raw.durationFrame, true),
    metric('exclusiveFrame', raw.exclusiveFrame, true),
    metric('offsetRecordFrame', raw.offsetRecordFrame),
    metric('cooldown', patch?.coolDown ?? cast.cooldownTime, true),
    metric('maxChargeTime', patch?.maxChargeTime ?? cast.maxChargeTime),
    metric('costType', patch?.costType ?? cost.costType),
    metric('costValue', patch?.costValue ?? cost.costValue),
    metric('attackRangeType', raw.attackRangeType),
    metric('castType', raw.castType),
    metric('skillSpecification', raw.skillSpecification),
    damageNodes.length ? metric('hitCount', damageNodes.length, true) : null,
    graph ? metric('actionCount', graph.stats.actionNodeCount) : null
  ]
  return metrics.filter((entry): entry is LegacyMetric => entry !== null)
}

function windowKind(node: ActionNode): LegacyWindow['kind'] {
  if (node.category === 'damage') return 'damage'
  if (node.category === 'cancel') return 'cancel'
  if (node.category === 'defense') return 'defense'
  if (node.category === 'movement') return 'movement'
  if (node.category === 'timing') return 'timing'
  return 'other'
}

function nodeRange(node: ActionNode): { start: number; end: number } | null {
  const time = node.time
  if (time.confidence === 'exact-frame') return { start: time.startFrame, end: time.endFrame }
  if (time.confidence === 'group-range' && time.startFrame !== undefined) {
    return {
      start: time.startFrame,
      end: time.openEnded ? time.startFrame : (time.endFrame ?? time.startFrame)
    }
  }
  return null
}

export function buildSkillWindows(rawValue: unknown, graph: ActionGraph | undefined): LegacyWindow[] {
  const raw = asRecord(rawValue)
  const windows: LegacyWindow[] = []
  const exclusive = numberValue(raw.exclusiveFrame)
  if (exclusive !== null && exclusive > 0) {
    windows.push({ id: 'exclusive', label: 'exclusiveFrame', kind: 'defense', start: 0, end: exclusive })
  }
  const offset = numberValue(raw.offsetRecordFrame)
  if (offset !== null && offset > 0) {
    windows.push({ id: 'offset', label: 'offsetRecordFrame', kind: 'timing', start: 0, end: offset })
  }
  for (const node of graph?.nodes ?? []) {
    if (node.kind !== 'action' || node.category === 'presentation') continue
    const range = nodeRange(node)
    if (!range) continue
    windows.push({ id: node.id, label: node.actionType, kind: windowKind(node), ...range })
    if (windows.length >= 120) break
  }
  return windows.toSorted((left, right) => left.start - right.start || left.end - right.end)
}

function firstCompact(record: RawRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const display = compactValue(record[key])
    if (display) return display
  }
  return ''
}

function timeLabel(node: ActionNode): string {
  const range = nodeRange(node)
  if (range) return range.start === range.end ? String(range.start) : `${range.start}-${range.end}`
  if (node.time.confidence === 'runtime-trigger') return node.time.trigger
  return ''
}

export function buildSkillHits(graph: ActionGraph | undefined): LegacyHit[] {
  return (graph?.nodes ?? [])
    .filter((node) => node.kind === 'action' && node.category === 'damage')
    .map((node) => ({
      id: node.id,
      label: node.actionType,
      time: timeLabel(node),
      damage: firstCompact(node.data, ['atkScale', 'damage', 'damageValue', 'formula']),
      poise: firstCompact(node.data, ['poiseValue', 'poiseDamage', 'toughnessDamage', 'atbValue']),
      resource: firstCompact(node.data, ['costValue', 'costType', 'resource', 'buffId']),
      note: firstCompact(node.data, ['targetGroupKey', 'condition', 'target', 'selectorData'])
    }))
}

function blackboardEntries(value: unknown, source: LegacyBlackboardEntry['source']): LegacyBlackboardEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        const record = asRecord(entry)
        const key = stringValue(record.key, stringValue(record.blackboardKey, `#${index + 1}`))
        const display = compactValue(record.value ?? record.defaultValue ?? record)
        return display ? { key, value: display, source } : null
      })
      .filter((entry): entry is LegacyBlackboardEntry => entry !== null)
  }
  return Object.entries(asRecord(value))
    .map(([key, entry]) => {
      const display = compactValue(entry)
      return display ? { key, value: display, source } : null
    })
    .filter((entry): entry is LegacyBlackboardEntry => entry !== null)
}

export function buildBlackboard(rawValue: unknown, patch?: SkillPatchSummary): LegacyBlackboardEntry[] {
  const raw = asRecord(rawValue)
  const merged = new Map<string, LegacyBlackboardEntry>()
  for (const entry of blackboardEntries(raw.blackboard, 'raw')) merged.set(entry.key, entry)
  for (const entry of blackboardEntries(patch?.blackboard, 'patch')) merged.set(entry.key, entry)
  return [...merged.values()]
}

export function buildBuffMetrics(rawValue: unknown): LegacyMetric[] {
  const raw = asRecord(rawValue)
  const stacking = asRecord(raw.stackingSettings)
  const dispel = asRecord(raw.dispelConfig)
  const metrics = [
    metric('lifeType', raw.lifeType, true),
    metric('duration', raw.duration, true),
    metric('triggerInterval', raw.triggerInterval),
    raw.waitFirstTriggerInterval === true ? metric('waitFirstTriggerInterval', true) : null,
    metric('maxTriggerCnt', raw.maxTriggerCnt),
    metric('stackingType', stacking.stackingType, true),
    metric('identifierType', stacking.identifierType),
    metric('maxStackCnt', stacking.maxStackCnt),
    metric('priority', stacking.priority),
    'canBeDispelled' in dispel ? metric('canBeDispelled', dispel.canBeDispelled) : null,
    raw.hasAddingCooldown === true ? metric('addingCooldown', raw.addingCooldown) : null,
    raw.ignoreTagImmune === true ? metric('ignoreTagImmune', true) : null,
    raw.useTimeDilationDt === true ? metric('useTimeDilationDt', true) : null
  ]
  return metrics.filter((entry): entry is LegacyMetric => entry !== null)
}

function scalarFields(value: unknown): { key: string; value: string }[] {
  return Object.entries(asRecord(value))
    .map(([key, entry]) => ({ key, value: compactValue(entry) }))
    .filter((entry) => entry.value)
    .slice(0, 12)
}

export function buildBuffEffects(rawValue: unknown): LegacyEffectGroup[] {
  const raw = asRecord(rawValue)
  const definitions: readonly [string, unknown][] = [
    ['attributes', asRecord(raw.attributeModifier).attributeModifiers],
    ['damage', raw.damageModifier],
    ['heal', raw.healModifier],
    ['poise', raw.poiseModifier],
    ['global', raw.globalModifier],
    ['shield', raw.shieldConfigs],
    ['tags', raw.applyTags]
  ]
  return definitions
    .map(([id, source]) => {
      const items = values(source)
        .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
        .map((entry, index): LegacyEffectItem | null => {
          const record = asRecord(entry)
          const fields = scalarFields(record)
          if (!fields.length) return null
          return {
            id: `${id}:${index}`,
            title:
              firstCompact(record, [
                'attrType',
                'formulaType',
                'formula',
                'modifierType',
                'processorType',
                'tag'
              ]) || `#${index + 1}`,
            fields
          }
        })
        .filter((entry): entry is LegacyEffectItem => entry !== null)
      return { id, items }
    })
    .filter((group) => group.items.length)
}
