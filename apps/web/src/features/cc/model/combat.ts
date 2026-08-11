import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'
import type { CcContractTerm } from './index'

const FORMULA_TO_MODIFIER: Readonly<Record<string, number>> = Object.freeze({
  Addition: 0,
  Multiplier: 1,
  FinalAddition: 3,
  FinalMultiplier: 4,
  BaseAddition: 5,
  BaseMultiplier: 6,
  BaseFinalAddition: 7,
  BaseFinalMultiplier: 8
})
const DISPLAY_ATTRIBUTE_ORDER = Object.freeze([0, 1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15])
const LEGACY_RESISTANCE_ATTRIBUTES = new Set([80, 81, 82, 83, 84, 85])
const MULTIPLIER_MODIFIERS = new Set([1, 4, 6, 8])

export interface CcManifestEntry {
  id?: string
  contentFile?: string
  hidden?: boolean
}

export interface CcLevelData {
  id?: string
  sceneId?: string
  [key: string]: unknown
}

export interface CcSpawnerConfig {
  configId?: string
  enemyLibrary?: unknown[]
  waveMap?: Record<string, unknown>
  [key: string]: unknown
}

export interface CcLevelScript {
  scriptId?: string
  actionMap?: unknown
  modules?: Record<string, unknown>
  enemies?: Record<string, unknown>
  [key: string]: unknown
}

export interface CcSceneRuntime {
  sceneId: string
  levelData: CcLevelData | null
  spawnerManifestAvailable: boolean
  levelScriptManifestAvailable: boolean
  missingSpawnerDetails: number
  missingLevelScriptDetails: number
  spawners: CcSpawnerConfig[]
  levelScripts: CcLevelScript[]
}

export interface CcAttributeMaps {
  names: Readonly<Record<number, string>>
  namesToId: Readonly<Record<string, number>>
  modifierNames: Readonly<Record<number, string>>
}

export interface CcBuffReference {
  id: string
  source: 'enemy' | 'spawner' | 'levelScript' | 'contract'
  blackboard: RawRecord[]
  scriptId?: string
  actionId?: string
}

export interface CcAttributeModifier {
  attrType: number
  attrName: string
  value: number
  modifierType: number
  modifierName: string
  formula: string
  source: CcBuffReference['source'] | 'inline'
  buffId?: string
}

export interface CcResolvedBuff extends CcBuffReference {
  available: boolean
  modifiers: CcAttributeModifier[]
  values: Readonly<Record<string, number>>
}

export interface CcEnemyStat {
  attrType: number
  name: string
  baseValue: number
  value: number
  changed: boolean
  formula: string
}

export interface CcEnemyBase {
  id: string
  templateId: string
  name: string
  nickname: string
  description: string
  level: number
  count: number
  dangerous: boolean
  globalEffect: boolean
  pinnedHealthBar: boolean
  baseValues: Readonly<Record<number, number>>
  baseModifiers: CcAttributeModifier[]
  baseBuffs: CcResolvedBuff[]
}

export interface CcEnemy extends Omit<CcEnemyBase, 'baseValues' | 'baseModifiers' | 'baseBuffs'> {
  stats: CcEnemyStat[]
  buffs: CcResolvedBuff[]
}

export interface CcSpawn {
  id: string
  name: string
  level: number
  count: number
  configId: string
  groupKey: string
  groupMode: string
  targetGroupKey: string
  groupModeKillCount: number
  delay: number
  interval: number
  preWarnTime: number
  positionX: number
  positionZ: number
  randomizeRadius: number
  faceMainCharacter: boolean
  buffs: CcBuffReference[]
}

export interface CcWave {
  id: string
  mode: string
  repeatable: boolean
  maxAlive: number
  externallyControlled: boolean
  enemies: CcSpawn[]
}

export interface CcCombatStageBase {
  id: string
  name: string
  description: string
  feature: string
  mainGoal: string
  extraGoal: string
  recommendedLevel: number
  sceneId: string
  waves: CcWave[]
  enemies: CcEnemyBase[]
  runtime: {
    levelDataAvailable: boolean
    spawnerManifestAvailable: boolean
    levelScriptManifestAvailable: boolean
    missingSpawnerDetails: number
    missingLevelScriptDetails: number
  }
}

export interface CcCombatContext {
  stages: CcCombatStageBase[]
  buffs: Readonly<Record<string, unknown>>
  maps: CcAttributeMaps
}

export interface CcCombatStage extends Omit<CcCombatStageBase, 'enemies'> {
  enemies: CcEnemy[]
}

interface ScriptBuffApplication {
  id: string
  blackboard: RawRecord[]
  scriptId: string
  actionId: string
  configId: string
}

interface ScriptEnemy {
  id: string
  level: number
  buffs: CcBuffReference[]
}

interface ScriptData {
  bySpawner: Readonly<Record<string, ScriptBuffApplication[]>>
  enemies: ScriptEnemy[]
}

interface EnemySeed {
  id: string
  level: number
  count: number
  buffs: CcBuffReference[]
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

function blackboardNumber(row: RawRecord): number {
  return numberValue(
    row.valueStr !== undefined && row.valueStr !== ''
      ? row.valueStr
      : (row.valueFloat ?? row.valueDouble ?? row.valueInt ?? row.valueLong ?? row.value)
  )
}

export function createCcAttributeMaps(value: unknown): CcAttributeMaps {
  const root = asRecord(value)
  const names = Object.fromEntries(
    Object.entries(asRecord(root.ATTR_MAP)).map(([id, name]) => [numberValue(id), stringValue(name)])
  )
  const namesToId = Object.fromEntries(
    Object.entries(asRecord(root.ATTR_MAP_EN)).map(([id, name]) => [stringValue(name), numberValue(id)])
  )
  const modifierNames = Object.fromEntries(
    Object.entries(asRecord(root.MODIFIER_TYPE_MAP)).map(([id, name]) => [numberValue(id), stringValue(name)])
  )
  return { names, namesToId, modifierNames }
}

function spawnBuffs(value: unknown, source: CcBuffReference['source']): CcBuffReference[] {
  return records(value)
    .map((buff) => ({
      id: stringValue(buff.buffId, stringValue(buff.id)),
      source,
      blackboard: records(buff.blackboard)
    }))
    .filter((buff) => buff.id !== '')
}

function enemyIdentity(id: string, tables: TableSet): { templateId: string; name: string } {
  const enemy = asRecord(tables.EnemyTable?.[id])
  const displayTable = asRecord(tables.EnemyTemplateDisplayInfoTable)
  const exact = stringValue(enemy.templateId)
  const templateId =
    exact ||
    Object.keys(displayTable).reduce(
      (best, candidate) => (id.startsWith(candidate) && candidate.length > best.length ? candidate : best),
      ''
    ) ||
    id
  return { templateId, name: textValue(asRecord(displayTable[templateId]).name, templateId) }
}

function parseSpawner(value: CcSpawnerConfig, tables: TableSet, recommendedLevel: number): CcWave[] {
  const config = asRecord(value)
  const configId = stringValue(config.configId)
  const libraryRows = records(config.enemyLibrary)
  const library = new Map(libraryRows.map((row) => [stringValue(row.key), row]))
  if (library.size === 0) return []
  return Object.entries(asRecord(config.waveMap))
    .map(([waveId, waveValue]): CcWave | null => {
      const wave = asRecord(waveValue)
      const enemies: CcSpawn[] = []
      let maxAlive = 0
      let externallyControlled = false
      for (const [fallbackGroupId, groupValue] of Object.entries(asRecord(wave.groupMap))) {
        const group = asRecord(groupValue)
        const groupKey = stringValue(group.groupKey, fallbackGroupId)
        const groupMode = stringValue(group.groupMode, 'Sequence')
        if (group.limitGroupMaxCount === true) maxAlive += numberValue(group.groupMaxCount)
        for (const actionValue of Object.values(asRecord(group.actionMap))) {
          const action = asRecord(actionValue)
          if (stringValue(action.$type).includes('Pause')) {
            externallyControlled = true
            continue
          }
          const entry = library.get(stringValue(action.libraryKey))
          if (!entry) continue
          const id = stringValue(entry.enemyId)
          const identity = enemyIdentity(id, tables)
          const position = asRecord(action.position)
          enemies.push({
            id,
            name: identity.name,
            level: numberValue(entry.enemyLevel, recommendedLevel),
            count: numberValue(action.spawnCount, 1),
            configId,
            groupKey,
            groupMode,
            targetGroupKey: stringValue(group.groupModeTargetKey),
            groupModeKillCount: numberValue(group.groupModeKillCount),
            delay: numberValue(action.timestamp),
            interval: numberValue(action.spawnInterval),
            preWarnTime: numberValue(entry.preWarnTime),
            positionX: numberValue(position.x),
            positionZ: numberValue(position.z),
            randomizeRadius: numberValue(action.randomizeRadius),
            faceMainCharacter: action.faceMainCharacter !== false,
            buffs: spawnBuffs(entry.bornBuffList, 'spawner')
          })
        }
      }
      return enemies.length
        ? {
            id: waveId,
            mode: stringValue(wave.waveMode, 'Parallel'),
            repeatable: wave.repeatable === true,
            maxAlive,
            externallyControlled,
            enemies
          }
        : null
    })
    .filter((wave): wave is CcWave => wave !== null)
    .toSorted(
      (left, right) => numberValue(left.id) - numberValue(right.id) || left.id.localeCompare(right.id, 'en')
    )
}

function mergeWaves(runtime: CcSceneRuntime, tables: TableSet, level: number): CcWave[] {
  const merged = new Map<string, CcWave>()
  for (const config of runtime.spawners) {
    for (const wave of parseSpawner(config, tables, level)) {
      const existing = merged.get(wave.id)
      if (!existing) {
        merged.set(wave.id, { ...wave, enemies: [...wave.enemies] })
        continue
      }
      existing.enemies.push(...wave.enemies)
      existing.maxAlive += wave.maxAlive
      existing.externallyControlled ||= wave.externallyControlled
      existing.repeatable ||= wave.repeatable
    }
  }
  return [...merged.values()].toSorted(
    (left, right) => numberValue(left.id) - numberValue(right.id) || left.id.localeCompare(right.id, 'en')
  )
}

function constValue(value: unknown): unknown {
  const parameter = asRecord(value)
  if (!Object.prototype.hasOwnProperty.call(parameter, 'constValue')) return undefined
  if (parameter.paramSource !== undefined && numberValue(parameter.paramSource, -1) !== 0) return undefined
  return parameter.constValue
}

function actionNodes(script: RawRecord): RawRecord[] {
  const data = asRecord(asRecord(script.actionMap).dataMap)
  return [...records(data.headerList), ...records(data.actionList), ...records(data.getterList)]
}

function targetNode(parameterValue: unknown, byId: ReadonlyMap<number, RawRecord>): RawRecord | null {
  const parameter = asRecord(parameterValue)
  if (parameter.idRef !== undefined && numberValue(parameter.idRef, -1) !== -1) {
    return byId.get(numberValue(parameter.idRef)) ?? null
  }
  const match = stringValue(parameter.path).match(/^\$(\d+)@/)
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
    const pointer = asRecord(constValue(node._spawnerPtr))
    return pointer.id ? [stringValue(pointer.id)] : []
  }
  if (type.includes('OnSpawnerEntitySpawn')) {
    const filter = asRecord(constValue(node._spawnerFilter))
    return filter.id ? [stringValue(filter.id)] : []
  }
  const ids = new Set<string>()
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    for (const id of nodeSpawnerIds(targetNode(value, byId), byId, visited)) ids.add(id)
  }
  return [...ids]
}

function targetSpawnerIds(action: RawRecord, byId: ReadonlyMap<number, RawRecord>): string[] {
  return nodeSpawnerIds(
    targetNode(action._target ?? action._targets ?? action._targetEntity, byId),
    byId,
    new Set()
  )
}

function isPlayerTarget(action: RawRecord, byId: ReadonlyMap<number, RawRecord>): boolean {
  const node = targetNode(action._target ?? action._targets ?? action._targetEntity, byId)
  return /GetSquadMembers|GetMainCharacter|GetAllCharacter/.test(stringValue(node?.$type))
}

function extractScriptData(runtime: CcSceneRuntime): ScriptData {
  const bySpawner: Record<string, ScriptBuffApplication[]> = {}
  const enemies: ScriptEnemy[] = []
  for (const value of runtime.levelScripts) {
    const script = asRecord(value)
    const nodes = actionNodes(script)
    const byId = new Map(
      nodes.filter((node) => node._ID !== undefined).map((node) => [numberValue(node._ID), node] as const)
    )
    const moduleSpawners = [
      ...new Set(
        Object.values(asRecord(script.modules))
          .map((module) => stringValue(asRecord(module).spawnerId))
          .filter(Boolean)
      )
    ]
    for (const action of records(asRecord(asRecord(script.actionMap).dataMap).actionList)) {
      const type = stringValue(action.$type)
      if (!/AddBuffs?ToTargets?/.test(type) || type.includes('AddGlobalBuff') || isPlayerTarget(action, byId))
        continue
      const id = stringValue(constValue(action._buffId))
      if (!id) continue
      let spawnerIds = targetSpawnerIds(action, byId)
      if (spawnerIds.length === 0 && moduleSpawners.length === 1) spawnerIds = moduleSpawners
      for (const spawnerId of spawnerIds) {
        const application = {
          id,
          blackboard: records(constValue(action._blackboardKVPairList)),
          scriptId: stringValue(script.scriptId),
          actionId: stringValue(action._ID),
          configId: `sc_${runtime.sceneId}_${spawnerId}`
        }
        ;(bySpawner[application.configId] ??= []).push(application)
      }
    }
    for (const enemyValue of Object.values(asRecord(script.enemies))) {
      const enemy = asRecord(enemyValue)
      const id = stringValue(enemy.entityDataIdKey)
      if (id)
        enemies.push({ id, level: numberValue(enemy.level), buffs: spawnBuffs(enemy.buffs, 'levelScript') })
    }
  }
  return { bySpawner, enemies }
}

function blackboardValues(base: unknown, overrides: readonly RawRecord[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const row of records(base)) {
    const key = stringValue(row.key)
    if (key) values[key] = blackboardNumber(row)
  }
  for (const row of overrides) {
    const key = stringValue(row.key)
    if (key) values[key] = blackboardNumber(row)
  }
  return values
}

function buffModifiers(
  reference: CcBuffReference,
  value: unknown,
  maps: CcAttributeMaps
): CcAttributeModifier[] {
  const buff = asRecord(value)
  const values = blackboardValues(buff.blackboard, reference.blackboard)
  return records(asRecord(buff.attributeModifier).attributeModifiers)
    .map((modifier): CcAttributeModifier | null => {
      const attrName = stringValue(modifier.attributeType)
      const parsedAttr = Number(attrName)
      const attrType = Number.isFinite(parsedAttr) ? parsedAttr : maps.namesToId[attrName]
      const formula = stringValue(modifier.formulaItem)
      const modifierType = FORMULA_TO_MODIFIER[formula]
      const parameter = asRecord(modifier.param)
      const key = stringValue(parameter.blackboardKey)
      const resolved =
        parameter.useBlackboardKey === true && key
          ? numberValue(values[key], Number.NaN)
          : numberValue(parameter.value)
      if (attrType === undefined || modifierType === undefined || !Number.isFinite(resolved)) return null
      return {
        attrType,
        attrName: maps.names[attrType] ?? attrName,
        value: resolved,
        modifierType,
        modifierName: maps.modifierNames[modifierType] ?? String(modifierType),
        formula,
        source: reference.source,
        buffId: reference.id
      }
    })
    .filter((modifier): modifier is CcAttributeModifier => modifier !== null)
}

function resolveBuff(
  reference: CcBuffReference,
  buffs: Readonly<Record<string, unknown>>,
  maps: CcAttributeMaps
): CcResolvedBuff {
  const value = buffs[reference.id]
  return {
    ...reference,
    available: value !== undefined,
    modifiers: value === undefined ? [] : buffModifiers(reference, value, maps),
    values: blackboardValues(
      value === undefined ? undefined : asRecord(value).blackboard,
      reference.blackboard
    )
  }
}

function rawModifier(value: unknown, maps: CcAttributeMaps): CcAttributeModifier | null {
  const row = asRecord(value)
  const attrType = numberValue(row.attrType, Number.NaN)
  const modifierType = numberValue(row.modifierType, Number.NaN)
  const modifierValue = numberValue(row.attrValue, Number.NaN)
  if (![attrType, modifierType, modifierValue].every(Number.isFinite)) return null
  return {
    attrType,
    attrName: maps.names[attrType] ?? String(attrType),
    value: modifierValue,
    modifierType,
    modifierName: maps.modifierNames[modifierType] ?? String(modifierType),
    formula: '',
    source: 'inline'
  }
}

function levelBaseValues(value: unknown, level: number): Record<number, number> {
  const template = asRecord(value)
  const levelRows = records(template.levelDependentAttributes)
  const levelOf = (row: RawRecord) =>
    numberValue(records(row.attrs).find((entry) => numberValue(entry.attrType, -1) === 0)?.attrValue)
  const exact = levelRows.find((row) => levelOf(row) === level)
  const closest = levelRows.toSorted(
    (left, right) => Math.abs(levelOf(left) - level) - Math.abs(levelOf(right) - level)
  )[0]
  const values: Record<number, number> = {}
  for (const row of records((exact ?? closest)?.attrs)) {
    const type = numberValue(row.attrType, -1)
    if (type >= 0) values[type] = numberValue(row.attrValue)
  }
  for (const row of records(asRecord(template.levelIndependentAttributes).attrs)) {
    const type = numberValue(row.attrType, -1)
    if (type >= 0 && values[type] === undefined) values[type] = numberValue(row.attrValue)
  }
  return values
}

function scriptEnemyBuffs(scripts: ScriptData, id: string, level: number): CcBuffReference[] {
  const matches = scripts.enemies.filter((enemy) => enemy.id === id)
  const exact = matches.filter((enemy) => enemy.level === level)
  return (exact.length ? exact : matches.length === 1 ? matches : []).flatMap((enemy) => enemy.buffs)
}

function enemySeeds(
  dungeon: RawRecord,
  waves: readonly CcWave[],
  scripts: ScriptData,
  level: number
): EnemySeed[] {
  const seeds = new Map<string, EnemySeed>()
  for (const wave of waves) {
    for (const spawn of wave.enemies) {
      const seed = seeds.get(spawn.id) ?? { id: spawn.id, level: spawn.level, count: 0, buffs: [] }
      seed.count += spawn.count
      for (const buff of spawn.buffs) {
        if (!seed.buffs.some((item) => item.id === buff.id && item.source === buff.source))
          seed.buffs.push(buff)
      }
      for (const application of scripts.bySpawner[spawn.configId] ?? []) {
        if (
          !seed.buffs.some((item) => item.id === application.id && item.scriptId === application.scriptId)
        ) {
          seed.buffs.push({ ...application, source: 'levelScript' })
        }
      }
      seeds.set(spawn.id, seed)
    }
  }
  const fallbackLevels = Array.isArray(dungeon.enemyLevels)
    ? dungeon.enemyLevels.map((value) => numberValue(value))
    : []
  strings(dungeon.enemyIds).forEach((id, index) => {
    if (!seeds.has(id)) seeds.set(id, { id, level: fallbackLevels[index] ?? level, count: 1, buffs: [] })
  })
  for (const enemy of scripts.enemies) {
    if (!seeds.has(enemy.id))
      seeds.set(enemy.id, { id: enemy.id, level: enemy.level || level, count: 1, buffs: [] })
  }
  return [...seeds.values()]
}

function enemyBase(
  seed: EnemySeed,
  tables: TableSet,
  scripts: ScriptData,
  buffs: Readonly<Record<string, unknown>>,
  maps: CcAttributeMaps
): CcEnemyBase {
  const enemy = asRecord(tables.EnemyTable?.[seed.id])
  const identity = enemyIdentity(seed.id, tables)
  const display = asRecord(tables.EnemyTemplateDisplayInfoTable?.[identity.templateId])
  const attrTable = asRecord(tables.EnemyAttributeTemplateTable)
  const attrTemplateId =
    stringValue(enemy.attrTemplateId) ||
    Object.keys(attrTable).reduce(
      (best, candidate) =>
        seed.id.startsWith(candidate) && candidate.length > best.length ? candidate : best,
      ''
    ) ||
    seed.id
  const references: CcBuffReference[] = [
    ...strings(enemy.bornBuffs).map((id) => ({ id, source: 'enemy' as const, blackboard: [] })),
    ...seed.buffs,
    ...scriptEnemyBuffs(scripts, seed.id, seed.level)
  ]
  const baseBuffs = references
    .filter(
      (reference, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.id === reference.id &&
            candidate.source === reference.source &&
            candidate.scriptId === reference.scriptId &&
            candidate.actionId === reference.actionId
        ) === index
    )
    .map((reference) => resolveBuff(reference, buffs, maps))
  const inline = records(enemy.attrModifiers)
    .map((modifier) => rawModifier(modifier, maps))
    .filter((modifier): modifier is CcAttributeModifier => modifier !== null)
  return {
    id: seed.id,
    templateId: identity.templateId,
    name: identity.name,
    nickname: textValue(display.nickname),
    description: plainText(display.description),
    level: seed.level,
    count: seed.count,
    dangerous: enemy.isDangerous === true,
    globalEffect: enemy.showBigEffect === true,
    pinnedHealthBar: enemy.showBigHeadbar === true,
    baseValues: levelBaseValues(attrTable[attrTemplateId], seed.level),
    baseModifiers: [...inline, ...baseBuffs.flatMap((buff) => buff.modifiers)],
    baseBuffs
  }
}

export function collectCcCombatBuffIds(
  tables: TableSet,
  gameId: string,
  runtime: CcSceneRuntime,
  terms: Readonly<Record<string, CcContractTerm>>
): string[] {
  const dungeon = asRecord(tables.DungeonTable?.[gameId])
  const enemyIds = new Set(strings(dungeon.enemyIds))
  const ids = new Set<string>()
  for (const configValue of runtime.spawners) {
    for (const enemy of records(asRecord(configValue).enemyLibrary)) {
      enemyIds.add(stringValue(enemy.enemyId))
      for (const buff of spawnBuffs(enemy.bornBuffList, 'spawner')) ids.add(buff.id)
    }
  }
  const scripts = extractScriptData(runtime)
  for (const entries of Object.values(scripts.bySpawner)) entries.forEach((entry) => ids.add(entry.id))
  for (const enemy of scripts.enemies) {
    enemyIds.add(enemy.id)
    enemy.buffs.forEach((buff) => ids.add(buff.id))
  }
  for (const id of enemyIds)
    strings(asRecord(tables.EnemyTable?.[id]).bornBuffs).forEach((buffId) => ids.add(buffId))
  for (const term of Object.values(terms)) {
    for (const effect of term.effects) if (Number(effect.type) === 1 && effect.buffId) ids.add(effect.buffId)
  }
  return [...ids].filter(Boolean)
}

export function buildCcCombatContext(options: {
  tables: TableSet
  gameId: string
  runtime: CcSceneRuntime
  buffs: Readonly<Record<string, unknown>>
  maps: CcAttributeMaps
}): CcCombatContext {
  const dungeonValue = options.tables.DungeonTable?.[options.gameId]
  if (!dungeonValue) return { stages: [], buffs: options.buffs, maps: options.maps }
  const dungeon = asRecord(dungeonValue)
  const level = numberValue(dungeon.recommendLv)
  const scripts = extractScriptData(options.runtime)
  const waves = mergeWaves(options.runtime, options.tables, level)
  const enemies = enemySeeds(dungeon, waves, scripts, level).map((seed) =>
    enemyBase(seed, options.tables, scripts, options.buffs, options.maps)
  )
  return {
    buffs: options.buffs,
    maps: options.maps,
    stages: [
      {
        id: options.gameId,
        name: textValue(dungeon.dungeonName, options.gameId),
        description: plainText(dungeon.dungeonDesc),
        feature: plainText(dungeon.featureDesc),
        mainGoal: plainText(dungeon.mainGoalDesc),
        extraGoal: plainText(dungeon.extraGoalDesc),
        recommendedLevel: level,
        sceneId: stringValue(dungeon.sceneId),
        waves,
        enemies,
        runtime: {
          levelDataAvailable: options.runtime.levelData !== null,
          spawnerManifestAvailable: options.runtime.spawnerManifestAvailable,
          levelScriptManifestAvailable: options.runtime.levelScriptManifestAvailable,
          missingSpawnerDetails: options.runtime.missingSpawnerDetails,
          missingLevelScriptDetails: options.runtime.missingLevelScriptDetails
        }
      }
    ]
  }
}

function applyModifiers(
  baseValue: number,
  modifiers: readonly CcAttributeModifier[],
  attrType: number
): { value: number; formula: string } {
  let value = baseValue
  let formula = String(baseValue)
  const stages = [
    { type: 5, multiply: false, onePlus: false },
    { type: 6, multiply: true, onePlus: true },
    { type: 7, multiply: false, onePlus: false },
    { type: 8, multiply: true, onePlus: false },
    { type: 3, multiply: false, onePlus: false },
    { type: 4, multiply: true, onePlus: false },
    { type: 0, multiply: false, onePlus: false },
    { type: 1, multiply: true, onePlus: true }
  ]
  for (const stage of stages) {
    for (const modifier of modifiers.filter(
      (entry) => entry.attrType === attrType && entry.modifierType === stage.type
    )) {
      const operand = stage.onePlus ? 1 + modifier.value : modifier.value
      if (stage.multiply) {
        value *= operand
        formula = `${formula} x ${operand}`
      } else {
        value += operand
        formula = `(${formula} + ${operand})`
      }
    }
  }
  return { value, formula: `${formula} = ${value}` }
}

function termReferences(
  selected: ReadonlySet<string>,
  terms: Readonly<Record<string, CcContractTerm>>
): CcBuffReference[] {
  return [...selected].flatMap((id) =>
    (terms[id]?.effects ?? []).flatMap((effect): CcBuffReference[] =>
      Number(effect.type) === 1 && effect.buffId
        ? [
            {
              id: effect.buffId,
              source: 'contract',
              blackboard: effect.parameters.map((parameter) => ({
                key: parameter.key,
                value: parameter.rawValue
              }))
            }
          ]
        : []
    )
  )
}

export function recalculateCcCombat(
  context: CcCombatContext,
  selected: ReadonlySet<string>,
  terms: Readonly<Record<string, CcContractTerm>>
): CcCombatStage[] {
  const contractBuffs = termReferences(selected, terms).map((reference) =>
    resolveBuff(reference, context.buffs, context.maps)
  )
  return context.stages.map((stage) => ({
    ...stage,
    enemies: stage.enemies.map((enemy): CcEnemy => {
      const modifiers = [...enemy.baseModifiers, ...contractBuffs.flatMap((buff) => buff.modifiers)]
      const baseValues: Record<number, number> = { ...enemy.baseValues }
      for (const modifier of modifiers) {
        if (baseValues[modifier.attrType] === undefined) {
          baseValues[modifier.attrType] = MULTIPLIER_MODIFIERS.has(modifier.modifierType) ? 1 : 0
        }
      }
      const types = Object.keys(baseValues)
        .map(Number)
        .filter((type) => !LEGACY_RESISTANCE_ATTRIBUTES.has(type))
        .toSorted((left, right) => {
          const leftIndex = DISPLAY_ATTRIBUTE_ORDER.indexOf(left)
          const rightIndex = DISPLAY_ATTRIBUTE_ORDER.indexOf(right)
          return leftIndex !== -1 || rightIndex !== -1
            ? (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
            : left - right
        })
      return {
        id: enemy.id,
        templateId: enemy.templateId,
        name: enemy.name,
        nickname: enemy.nickname,
        description: enemy.description,
        level: enemy.level,
        count: enemy.count,
        dangerous: enemy.dangerous,
        globalEffect: enemy.globalEffect,
        pinnedHealthBar: enemy.pinnedHealthBar,
        buffs: [...enemy.baseBuffs, ...contractBuffs],
        stats: types.map((attrType) => {
          const baseValue = baseValues[attrType] ?? 0
          const result = applyModifiers(baseValue, modifiers, attrType)
          return {
            attrType,
            name: context.maps.names[attrType] ?? String(attrType),
            baseValue,
            value: result.value,
            changed: result.value !== baseValue,
            formula: result.formula
          }
        })
      }
    })
  }))
}
