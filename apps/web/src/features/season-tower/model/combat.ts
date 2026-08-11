import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'
import type { TowerDifficulty, TowerEnemySpawn, TowerSpawner } from './index'

export const TOWER_ATTRIBUTE_DISPLAY_ORDER = [0, 1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15] as const

const LEGACY_ELEMENT_RESISTANCE_ATTRIBUTE_TYPES = new Set([80, 81, 82, 83, 84, 85])
const MULTIPLIER_MODIFIER_TYPES = new Set([1, 4, 6, 8])
const FORMULA_TO_MODIFIER_TYPE = {
  Addition: 0,
  Multiplier: 1,
  FinalAddition: 3,
  FinalMultiplier: 4,
  BaseAddition: 5,
  BaseMultiplier: 6,
  BaseFinalAddition: 7,
  BaseFinalMultiplier: 8
} as const satisfies Readonly<Record<string, number>>

const MODIFIER_STAGES = [
  { type: 5, multiplier: false, onePlus: false },
  { type: 6, multiplier: true, onePlus: true },
  { type: 7, multiplier: false, onePlus: false },
  { type: 8, multiplier: true, onePlus: false },
  { type: 3, multiplier: false, onePlus: false },
  { type: 4, multiplier: true, onePlus: false },
  { type: 0, multiplier: false, onePlus: false },
  { type: 1, multiplier: true, onePlus: true }
] as const

export type TowerBuffSource = 'enemy-born' | 'spawner-born' | 'level-script-born' | 'level-script'

export interface TowerLevelScriptBuff {
  id: string
  blackboard: RawRecord[]
}

export interface TowerScriptBuffApplication extends TowerLevelScriptBuff {
  conditional: true
  scriptId: string
  actionId: string
  spawnerId: string
  configId: string
  confidence: 'exact' | 'script'
}

export interface TowerLevelScriptEnemy {
  enemyId: string
  level: number
  buffs: TowerLevelScriptBuff[]
  scriptId: string
  slotId: string
}

export interface TowerLevelScriptData {
  applications: TowerScriptBuffApplication[]
  enemies: TowerLevelScriptEnemy[]
}

export interface TowerAttributeMaps {
  names: Readonly<Record<number, string>>
  nameToType: Readonly<Record<string, number>>
}

export interface TowerResolvedBlackboardValue {
  key: string
  value: unknown
  overridden: boolean
}

export interface TowerAttributeModifier {
  attrType: number
  attrValue: number
  modifierType: number
  source: TowerBuffSource | 'enemy-inline'
  buffId?: string
  formulaItem?: string
  blackboardKey?: string
}

export interface TowerBuffReference {
  id: string
  source: TowerBuffSource
  blackboard: RawRecord[]
  conditional?: boolean
  scriptId?: string
  actionId?: string
  confidence?: 'exact' | 'script'
}

export interface TowerResolvedBuff extends TowerBuffReference {
  available: boolean
  values: TowerResolvedBlackboardValue[]
  defaultBlackboard: RawRecord[]
  modifiers: TowerAttributeModifier[]
}

export interface TowerEnemyAttribute {
  type: number
  name: string
  rawValue: number
  value: number
  scriptedValue: number
  changed: boolean
  changedByScript: boolean
  formula: string
  scriptedFormula: string
}

export interface TowerEnemyCombatDetail {
  key: string
  id: string
  templateId: string
  name: string
  nickname: string
  description: string
  level: number
  spawnCount: number
  dangerous: boolean
  bigEffect: boolean
  bigHeadbar: boolean
  inlineModifiers: TowerAttributeModifier[]
  bornBuffs: TowerResolvedBuff[]
  scriptBuffs: TowerResolvedBuff[]
  attributes: TowerEnemyAttribute[]
}

export interface TowerCombatDetail {
  enemies: TowerEnemyCombatDetail[]
  levelScriptBuffCount: number
  bornBuffCount: number
}

interface SpawnAggregate {
  spawn: TowerEnemySpawn
  count: number
  spawnBuffs: TowerLevelScriptBuff[]
}

interface AttributeAnalysis {
  value: number
  formula: string
  changed: boolean
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function recordOrNull(value: unknown): RawRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawRecord) : null
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)))
}

function plainText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

export function blackboardValue(row: RawRecord): unknown {
  return row.valueFloat ?? row.valueDouble ?? row.valueInt ?? row.valueLong ?? row.value ?? row.valueStr ?? 0
}

function buffReferences(value: unknown): TowerLevelScriptBuff[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): TowerLevelScriptBuff[] => {
    if (typeof entry === 'string') return entry ? [{ id: entry, blackboard: [] }] : []
    const row = asRecord(entry)
    const id = stringValue(row.buffId, stringValue(row.id))
    return id ? [{ id, blackboard: records(row.blackboard) }] : []
  })
}

function constantValue(parameter: unknown): unknown {
  const row = recordOrNull(parameter)
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'constValue')) return undefined
  if (row.paramSource !== undefined && numberValue(row.paramSource, -1) !== 0) return undefined
  return row.constValue
}

function actionNodes(script: RawRecord): RawRecord[] {
  const data = asRecord(asRecord(asRecord(script.actionMap).dataMap))
  return [...records(data.headerList), ...records(data.actionList), ...records(data.getterList)]
}

function targetNode(parameter: unknown, byId: ReadonlyMap<number, RawRecord>): RawRecord | null {
  const row = recordOrNull(parameter)
  if (!row) return null
  if (row.idRef !== undefined && numberValue(row.idRef, -1) !== -1)
    return byId.get(numberValue(row.idRef)) ?? null
  const match = stringValue(row.path).match(/^\$(\d+)@/)
  return match?.[1] ? (byId.get(Number(match[1])) ?? null) : null
}

function nodeSpawnerIds(
  node: RawRecord | null,
  byId: ReadonlyMap<number, RawRecord>,
  visited: Set<RawRecord>
): string[] {
  if (!node || visited.has(node)) return []
  visited.add(node)
  const type = stringValue(node.$type)
  if (type.includes('SpawnerGetSpawnedEntityList')) {
    const pointer = asRecord(constantValue(node._spawnerPtr))
    const id = stringValue(pointer.id)
    return id ? [id] : []
  }
  if (type.includes('OnSpawnerEntitySpawn')) {
    const filter = asRecord(constantValue(node._spawnerFilter))
    const id = stringValue(filter.id)
    return id ? [id] : []
  }
  const ids = new Set<string>()
  for (const value of Object.values(node)) {
    if (!recordOrNull(value)) continue
    for (const id of nodeSpawnerIds(targetNode(value, byId), byId, visited)) ids.add(id)
  }
  return [...ids]
}

function targetSpawnerIds(action: RawRecord, byId: ReadonlyMap<number, RawRecord>): string[] {
  const parameter = action._target ?? action._targets ?? action._targetEntity
  return nodeSpawnerIds(targetNode(parameter, byId), byId, new Set())
}

function isPlayerTarget(action: RawRecord, byId: ReadonlyMap<number, RawRecord>): boolean {
  const parameter = action._target ?? action._targets ?? action._targetEntity
  const node = targetNode(parameter, byId)
  return /GetSquadMembers|GetMainCharacter|GetAllCharacter/.test(stringValue(node?.$type))
}

export function extractLevelScriptData(sceneId: string, scripts: readonly unknown[]): TowerLevelScriptData {
  const applications: TowerScriptBuffApplication[] = []
  const enemies: TowerLevelScriptEnemy[] = []

  for (const scriptValue of scripts) {
    const seen = new Set<string>()
    const script = asRecord(scriptValue)
    const scriptId = stringValue(script.scriptId)
    const nodes = actionNodes(script)
    const byId = new Map(
      nodes.filter((node) => node._ID !== undefined).map((node) => [numberValue(node._ID), node] as const)
    )
    const moduleSpawnerIds = [
      ...new Set(
        Object.values(asRecord(script.modules))
          .map((module) => stringValue(asRecord(module).spawnerId))
          .filter(Boolean)
      )
    ]
    const actionList = records(asRecord(asRecord(script.actionMap).dataMap).actionList)
    for (const action of actionList) {
      const type = stringValue(action.$type)
      if (!/AddBuffs?ToTargets?/.test(type) || type.includes('AddGlobalBuff')) continue
      const buffId = stringValue(constantValue(action._buffId))
      if (!buffId || isPlayerTarget(action, byId)) continue
      let spawnerIds = targetSpawnerIds(action, byId)
      let confidence: TowerScriptBuffApplication['confidence'] = 'exact'
      if (spawnerIds.length === 0 && moduleSpawnerIds.length === 1) {
        spawnerIds = moduleSpawnerIds
        confidence = 'script'
      }
      const blackboard = records(constantValue(action._blackboardKVPairList))
      for (const spawnerId of spawnerIds) {
        const key = `${spawnerId}:${buffId}:${JSON.stringify(blackboard)}`
        if (seen.has(key)) continue
        seen.add(key)
        applications.push({
          id: buffId,
          blackboard,
          conditional: true,
          scriptId,
          actionId: stringValue(action._ID),
          spawnerId,
          configId: `sc_${sceneId}_${spawnerId}`,
          confidence
        })
      }
    }

    for (const [slotId, enemyValue] of Object.entries(asRecord(script.enemies))) {
      const enemy = asRecord(enemyValue)
      const enemyId = stringValue(enemy.entityDataIdKey)
      if (!enemyId) continue
      enemies.push({
        enemyId,
        level: numberValue(enemy.level),
        buffs: buffReferences(enemy.buffs),
        scriptId,
        slotId
      })
    }
  }

  return { applications, enemies }
}

export function staticEnemyBuffs(
  data: TowerLevelScriptData,
  enemyId: string,
  level: number
): TowerLevelScriptBuff[] {
  const matches = data.enemies.filter((enemy) => enemy.enemyId === enemyId)
  const exact = matches.filter((enemy) => enemy.level === level)
  const selected = exact.length > 0 ? exact : matches.length === 1 ? matches : []
  return selected.flatMap((enemy) => enemy.buffs)
}

function staticEnemyRows(
  data: TowerLevelScriptData,
  enemyId: string,
  level: number
): TowerLevelScriptEnemy[] {
  const matches = data.enemies.filter((enemy) => enemy.enemyId === enemyId)
  const exact = matches.filter((enemy) => enemy.level === level)
  return exact.length > 0 ? exact : matches.length === 1 ? matches : []
}

export function createTowerAttributeMaps(value: unknown): TowerAttributeMaps {
  const maps = asRecord(value)
  const names = Object.fromEntries(
    Object.entries(asRecord(maps.ATTR_MAP)).flatMap(([id, name]) => {
      const type = Number(id)
      const label = textValue(name)
      return Number.isFinite(type) && label ? [[type, label] as const] : []
    })
  )
  const nameToType = Object.fromEntries(
    Object.entries(asRecord(maps.ATTR_MAP_EN)).flatMap(([id, name]) => {
      const type = Number(id)
      const internalName = stringValue(name)
      return Number.isFinite(type) && internalName ? [[internalName, type] as const] : []
    })
  )
  return { names, nameToType }
}

export function resolveTowerBuff(
  reference: TowerBuffReference,
  value: unknown,
  maps: TowerAttributeMaps
): TowerResolvedBuff {
  const buff = asRecord(value)
  const available = Object.keys(buff).length > 0
  const defaultBlackboard = records(buff.blackboard)
  const values = new Map<string, TowerResolvedBlackboardValue>()
  for (const row of defaultBlackboard) {
    const key = stringValue(row.key)
    if (key) values.set(key, { key, value: blackboardValue(row), overridden: false })
  }
  for (const row of reference.blackboard) {
    const key = stringValue(row.key)
    if (key) values.set(key, { key, value: blackboardValue(row), overridden: true })
  }

  const modifiers = records(asRecord(buff.attributeModifier).attributeModifiers).flatMap(
    (modifier): TowerAttributeModifier[] => {
      const attrName = stringValue(modifier.attributeType)
      const parsedType = Number(attrName)
      const attrType = Number.isFinite(parsedType) ? parsedType : maps.nameToType[attrName]
      const formulaItem = stringValue(modifier.formulaItem)
      const modifierType = FORMULA_TO_MODIFIER_TYPE[formulaItem as keyof typeof FORMULA_TO_MODIFIER_TYPE]
      const parameter = asRecord(modifier.param)
      if (attrType === undefined || modifierType === undefined) return []
      const blackboardKey = stringValue(parameter.blackboardKey)
      const configuredValue =
        parameter.useBlackboardKey && blackboardKey
          ? (values.get(blackboardKey)?.value ?? parameter.value)
          : parameter.value
      const attrValue = Number(configuredValue)
      if (!Number.isFinite(attrValue)) return []
      return [
        {
          attrType,
          attrValue,
          modifierType,
          source: reference.source,
          buffId: reference.id,
          formulaItem,
          blackboardKey: blackboardKey || undefined
        }
      ]
    }
  )

  return {
    ...reference,
    available,
    values: [...values.values()],
    defaultBlackboard,
    modifiers
  }
}

function analyzeAttribute(
  baseValue: number,
  modifiers: readonly TowerAttributeModifier[],
  attrType: number
): AttributeAnalysis {
  const relevant = modifiers.filter(
    (modifier) => modifier.attrType === attrType && Number.isFinite(modifier.attrValue)
  )
  let value = baseValue
  let expression = compactNumber(baseValue)
  for (const stage of MODIFIER_STAGES) {
    for (const modifier of relevant.filter((entry) => entry.modifierType === stage.type)) {
      const operand = modifier.attrValue
      const term = stage.onePlus ? `(1 + ${compactNumber(operand)})` : compactNumber(operand)
      if (stage.multiplier) {
        value *= stage.onePlus ? 1 + operand : operand
        expression = `${expression} x ${term}`
      } else {
        value += operand
        expression = `(${expression} + ${term})`
      }
    }
  }
  return {
    value,
    formula: `${expression} = ${compactNumber(value)}`,
    changed: relevant.length > 0 && value !== baseValue
  }
}

function levelAttributes(template: RawRecord, enemyLevel: number): RawRecord[] {
  const rows = records(template.levelDependentAttributes)
  if (rows.length === 0) return []
  const levelOf = (row: RawRecord): number =>
    numberValue(records(row.attrs).find((attr) => numberValue(attr.attrType, -1) === 0)?.attrValue)
  const exact = rows.find((row) => levelOf(row) === enemyLevel)
  if (exact) return records(exact.attrs)
  const closest = rows.reduce((best, row) =>
    Math.abs(levelOf(row) - enemyLevel) < Math.abs(levelOf(best) - enemyLevel) ? row : best
  )
  return records(closest.attrs)
}

export function computeTowerEnemyAttributes(
  templateValue: unknown,
  enemyLevel: number,
  baseModifiers: readonly TowerAttributeModifier[],
  scriptModifiers: readonly TowerAttributeModifier[],
  maps: TowerAttributeMaps
): TowerEnemyAttribute[] {
  const template = asRecord(templateValue)
  const baseValues = new Map<number, number>()
  for (const attr of levelAttributes(template, enemyLevel)) {
    const type = numberValue(attr.attrType, -1)
    const value = Number(attr.attrValue)
    if (type >= 0 && Number.isFinite(value)) baseValues.set(type, value)
  }
  for (const attr of records(asRecord(template.levelIndependentAttributes).attrs)) {
    const type = numberValue(attr.attrType, -1)
    const value = Number(attr.attrValue)
    if (type >= 0 && Number.isFinite(value) && !baseValues.has(type)) baseValues.set(type, value)
  }

  const ordered = [
    ...TOWER_ATTRIBUTE_DISPLAY_ORDER.filter((type) => baseValues.has(type)),
    ...[...baseValues.keys()]
      .filter(
        (type) =>
          type >= 4 &&
          !TOWER_ATTRIBUTE_DISPLAY_ORDER.includes(type as (typeof TOWER_ATTRIBUTE_DISPLAY_ORDER)[number])
      )
      .toSorted((left, right) => left - right)
  ].filter((type) => !LEGACY_ELEMENT_RESISTANCE_ATTRIBUTE_TYPES.has(type))

  return ordered.map((type): TowerEnemyAttribute => {
    const rawValue = baseValues.get(type) ?? 0
    const base = analyzeAttribute(rawValue, baseModifiers, type)
    const scripted = analyzeAttribute(rawValue, [...baseModifiers, ...scriptModifiers], type)
    return {
      type,
      name: maps.names[type] ?? '',
      rawValue,
      value: base.value,
      scriptedValue: scripted.value,
      changed: base.changed,
      changedByScript: scripted.value !== base.value,
      formula: base.formula,
      scriptedFormula: scripted.formula
    }
  })
}

function aggregateSpawns(difficulty: TowerDifficulty, spawner: TowerSpawner | null): SpawnAggregate[] {
  const source = spawner
    ? spawner.waves.length > 0
      ? spawner.waves.flatMap((wave) => wave.enemies)
      : spawner.libraryEnemies
    : difficulty.fallbackEnemies
  const aggregates = new Map<string, SpawnAggregate>()
  for (const spawn of source) {
    const key = `${spawn.id}:${spawn.level}`
    const existing = aggregates.get(key)
    if (existing) {
      existing.count += spawn.count
      for (const buff of spawn.buffs) {
        if (
          !existing.spawnBuffs.some(
            (entry) =>
              entry.id === buff.id && JSON.stringify(entry.blackboard) === JSON.stringify(buff.blackboard)
          )
        ) {
          existing.spawnBuffs.push(buff)
        }
      }
    } else {
      aggregates.set(key, { spawn, count: spawn.count, spawnBuffs: [...spawn.buffs] })
    }
  }
  return [...aggregates.values()]
}

function applicationsForSpawner(
  data: TowerLevelScriptData,
  spawner: TowerSpawner | null
): TowerScriptBuffApplication[] {
  if (!spawner) return []
  return data.applications.filter(
    (application) =>
      application.configId === spawner.id ||
      application.spawnerId === spawner.id ||
      spawner.id.endsWith(`_${application.spawnerId}`)
  )
}

function enemyBornBuffIds(enemy: RawRecord): string[] {
  return Array.isArray(enemy.bornBuffs)
    ? enemy.bornBuffs.map((value) => stringValue(value)).filter(Boolean)
    : []
}

export function collectTowerCombatBuffIds(
  tables: TableSet,
  difficulty: TowerDifficulty,
  spawner: TowerSpawner | null,
  scripts: TowerLevelScriptData
): string[] {
  const ids = new Set<string>()
  for (const aggregate of aggregateSpawns(difficulty, spawner)) {
    const enemy = asRecord(tables.EnemyTable?.[aggregate.spawn.id])
    for (const id of enemyBornBuffIds(enemy)) ids.add(id)
    for (const buff of aggregate.spawnBuffs) ids.add(buff.id)
    for (const row of staticEnemyRows(scripts, aggregate.spawn.id, aggregate.spawn.level)) {
      for (const buff of row.buffs) ids.add(buff.id)
    }
  }
  for (const application of applicationsForSpawner(scripts, spawner)) ids.add(application.id)
  return [...ids]
}

function inlineModifiers(enemy: RawRecord): TowerAttributeModifier[] {
  return records(enemy.attrModifiers).flatMap((modifier): TowerAttributeModifier[] => {
    const attrType = Number(modifier.attrType)
    const attrValue = Number(modifier.attrValue)
    const modifierType = Number(modifier.modifierType)
    return Number.isFinite(attrType) && Number.isFinite(attrValue) && Number.isFinite(modifierType)
      ? [{ attrType, attrValue, modifierType, source: 'enemy-inline' }]
      : []
  })
}

function resolveReferences(
  references: readonly TowerBuffReference[],
  buffs: Readonly<Record<string, unknown>>,
  maps: TowerAttributeMaps
): TowerResolvedBuff[] {
  const seen = new Set<string>()
  return references.flatMap((reference): TowerResolvedBuff[] => {
    const key = `${reference.source}:${reference.id}:${reference.scriptId ?? ''}:${JSON.stringify(reference.blackboard)}`
    if (seen.has(key)) return []
    seen.add(key)
    return [resolveTowerBuff(reference, buffs[reference.id], maps)]
  })
}

export function buildTowerCombatDetail(options: {
  tables: TableSet
  difficulty: TowerDifficulty
  spawner: TowerSpawner | null
  scripts: TowerLevelScriptData
  buffs: Readonly<Record<string, unknown>>
  maps: TowerAttributeMaps
}): TowerCombatDetail {
  const scriptApplications = applicationsForSpawner(options.scripts, options.spawner)
  const enemies = aggregateSpawns(options.difficulty, options.spawner).map(
    (aggregate): TowerEnemyCombatDetail => {
      const spawn = aggregate.spawn
      const enemy = asRecord(options.tables.EnemyTable?.[spawn.id])
      const display = asRecord(options.tables.EnemyTemplateDisplayInfoTable?.[spawn.templateId])
      const inline = inlineModifiers(enemy)
      const bornReferences: TowerBuffReference[] = [
        ...enemyBornBuffIds(enemy).map((id): TowerBuffReference => ({
          id,
          source: 'enemy-born',
          blackboard: []
        })),
        ...aggregate.spawnBuffs.map((buff): TowerBuffReference => ({ ...buff, source: 'spawner-born' })),
        ...staticEnemyRows(options.scripts, spawn.id, spawn.level).flatMap((row) =>
          row.buffs.map((buff): TowerBuffReference => ({
            ...buff,
            source: 'level-script-born',
            scriptId: row.scriptId
          }))
        )
      ]
      const scriptReferences = scriptApplications.map((application): TowerBuffReference => ({
        ...application,
        source: 'level-script'
      }))
      const bornBuffs = resolveReferences(bornReferences, options.buffs, options.maps)
      const scriptBuffs = resolveReferences(scriptReferences, options.buffs, options.maps)
      const baseModifiers = [...inline, ...bornBuffs.flatMap((buff) => buff.modifiers)]
      const scriptedModifiers = scriptBuffs.flatMap((buff) => buff.modifiers)
      const attrTemplateId = stringValue(enemy.attrTemplateId, spawn.id)
      return {
        key: `${spawn.id}:${spawn.level}`,
        id: spawn.id,
        templateId: spawn.templateId,
        name: textValue(display.name, spawn.name),
        nickname: textValue(display.nickname),
        description: plainText(display.description),
        level: spawn.level,
        spawnCount: aggregate.count,
        dangerous: Boolean(enemy.isDangerous),
        bigEffect: Boolean(enemy.showBigEffect),
        bigHeadbar: Boolean(enemy.showBigHeadbar),
        inlineModifiers: inline,
        bornBuffs,
        scriptBuffs,
        attributes: computeTowerEnemyAttributes(
          options.tables.EnemyAttributeTemplateTable?.[attrTemplateId],
          spawn.level,
          baseModifiers,
          scriptedModifiers,
          options.maps
        )
      }
    }
  )
  return {
    enemies,
    levelScriptBuffCount: enemies.reduce((total, enemy) => total + enemy.scriptBuffs.length, 0),
    bornBuffCount: enemies.reduce((total, enemy) => total + enemy.bornBuffs.length, 0)
  }
}

export function combineTowerModifiers(
  modifiers: readonly TowerAttributeModifier[]
): TowerAttributeModifier[] {
  const groups = new Map<string, TowerAttributeModifier>()
  for (const modifier of modifiers) {
    const key = `${modifier.attrType}:${modifier.modifierType}`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, { ...modifier })
    } else if (modifier.modifierType === 1 || modifier.modifierType === 6) {
      current.attrValue = (1 + current.attrValue) * (1 + modifier.attrValue) - 1
    } else if (modifier.modifierType === 4 || modifier.modifierType === 8) {
      current.attrValue *= modifier.attrValue
    } else {
      current.attrValue += modifier.attrValue
    }
  }
  return [...groups.values()].filter(
    (modifier) => !LEGACY_ELEMENT_RESISTANCE_ATTRIBUTE_TYPES.has(modifier.attrType)
  )
}

export function modifierIsMultiplier(modifier: TowerAttributeModifier): boolean {
  return MULTIPLIER_MODIFIER_TYPES.has(modifier.modifierType)
}
