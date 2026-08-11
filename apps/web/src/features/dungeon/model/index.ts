import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'

export const DUNGEON_CATEGORY_KEYS: Readonly<Record<string, string>> = Object.freeze({
  dungeon_highdifficulty: 'highDifficulty',
  dungeon_bossrush: 'bossRush',
  dungeon_ss: 'protocolSpace',
  dungeon_actmonster: 'eventCombat',
  dungeon_challenge: 'challenge',
  dungeon_resource: 'resource',
  dungeon_weeklyraid: 'weeklyRaid',
  dungeon_char: 'characterMission',
  dungeon_chartutorial: 'characterTutorial',
  dungeon_contract: 'contingencyContract',
  dungeon_train: 'training',
  dungeon_worldlevel: 'worldLevel',
  dungeon_wuling_A: 'wulingA',
  dungeon_wuling_B: 'wulingB',
  dungeon_puzzle: 'mystery',
  dungeon_roguelike: 'protocolDivergence'
})

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

export interface DungeonCatalogItem {
  id: string
  name: string
  rarity: number
  category: string
  categoryKey: string
  dungeonCount: number
  imageId: string
  hidden: boolean
  searchText: string
}

export interface DungeonCatalog {
  series: DungeonCatalogItem[]
}

export interface DungeonSceneRuntime {
  sceneId: string
  spawnerManifestAvailable: boolean
  levelScriptManifestAvailable: boolean
  missingSpawnerDetails: number
  missingLevelScriptDetails: number
  spawners: unknown[]
  levelScripts: unknown[]
}

export interface DungeonAttributeMaps {
  names: Readonly<Record<number, string>>
  namesToId: Readonly<Record<string, number>>
  modifierNames: Readonly<Record<number, string>>
}

export interface DungeonRewardItem {
  id: string
  name: string
  iconId: string
  rarity: number
  count: number
}

export interface DungeonRewardGroup {
  fixed: DungeonRewardItem[]
  first: DungeonRewardItem[]
  hunterFixed: DungeonRewardItem[]
  hunterRandom: DungeonRewardItem[]
  hunterStamina: number
}

export interface DungeonSpawnBuff {
  id: string
  blackboard: RawRecord[]
}

export interface DungeonSpawn {
  id: string
  templateId: string
  name: string
  level: number
  count: number
  configId: string
  groupKey: string
  groupMode: string
  targetGroupKey: string
  groupModeKillCount: number
  positionX: number
  positionZ: number
  randomizeRadius: number
  faceMainCharacter: boolean
  delay: number
  interval: number
  preWarnTime: number
  buffs: DungeonSpawnBuff[]
}

export interface DungeonWave {
  id: string
  mode: string
  repeatable: boolean
  maxAlive: number
  externallyControlled: boolean
  enemies: DungeonSpawn[]
}

export type DungeonBuffSource = 'born' | 'spawner' | 'script'

export interface DungeonAttributeModifier {
  attrType: number
  attrName: string
  value: number
  modifierType: number
  modifierName: string
  formula: string
}

export interface DungeonEnemyBuff {
  id: string
  source: DungeonBuffSource
  available: boolean
  modifiers: DungeonAttributeModifier[]
  blackboard: Readonly<Record<string, number>>
  scriptId: string
  actionId: string
  confidence: string
}

export interface DungeonEnemyStat {
  attrType: number
  name: string
  baseValue: number
  value: number
  changed: boolean
}

export interface DungeonEnemy {
  id: string
  templateId: string
  name: string
  nickname: string
  description: string
  level: number
  dangerous: boolean
  globalEffect: boolean
  pinnedHealthBar: boolean
  stats: DungeonEnemyStat[]
  inlineModifiers: DungeonAttributeModifier[]
  buffs: DungeonEnemyBuff[]
}

export interface DungeonRuntimeStatus {
  spawnerManifestAvailable: boolean
  levelScriptManifestAvailable: boolean
  missingSpawnerDetails: number
  missingLevelScriptDetails: number
}

export interface DungeonStage {
  id: string
  name: string
  levelDescription: string
  description: string
  feature: string
  mainGoal: string
  extraGoal: string
  stamina: number
  recommendedLevel: number
  category: string
  categoryKey: string
  pictureId: string
  iconId: string
  sceneId: string
  waves: DungeonWave[]
  rewards: DungeonRewardGroup
  enemies: DungeonEnemy[]
  runtime: DungeonRuntimeStatus
}

export interface DungeonSeriesDetail {
  id: string
  name: string
  description: string
  staminaText: string
  category: string
  categoryKey: string
  pictureId: string
  roleImageId: string
  dungeons: DungeonStage[]
}

interface ScriptBuffApplication {
  buffId: string
  blackboard: RawRecord[]
  scriptId: string
  actionId: string
  configId: string
  confidence: string
}

interface ScriptEnemy {
  enemyId: string
  level: number
  buffs: DungeonSpawnBuff[]
  scriptId: string
}

interface SceneScriptData {
  bySpawner: Readonly<Record<string, ScriptBuffApplication[]>>
  enemies: ScriptEnemy[]
}

interface ParsedSpawner {
  configId: string
  waves: DungeonWave[]
}

interface EnemySeed {
  id: string
  level: number
  spawnerBuffs: DungeonSpawnBuff[]
  scriptBuffs: ScriptBuffApplication[]
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function plainText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function dungeonRarity(row: RawRecord): number {
  const category = stringValue(row.gameCategory)
  if (category === 'dungeon_highdifficulty') return 6
  if (category === 'dungeon_bossrush') return numberValue(row.dungeonCategory) === 3 ? 5 : 3
  if (category === 'dungeon_ss') return 4
  if (
    ['dungeon_actmonster', 'dungeon_challenge', 'dungeon_resource', 'dungeon_weeklyraid'].includes(category)
  ) {
    return 3
  }
  if (
    [
      'dungeon_char',
      'dungeon_chartutorial',
      'dungeon_contract',
      'dungeon_train',
      'dungeon_worldlevel',
      'dungeon_wuling_A',
      'dungeon_wuling_B'
    ].includes(category)
  ) {
    return 2
  }
  return 1
}

export function buildDungeonCatalog(tables: TableSet): DungeonCatalog {
  const series = Object.entries(tables.DungeonSeriesTable ?? {})
    .map(([id, value]): DungeonCatalogItem | null => {
      const row = asRecord(value)
      const category = stringValue(row.gameCategory)
      if (!category) return null
      const name = textValue(row.name, id)
      const rarity = dungeonRarity(row)
      return {
        id,
        name,
        rarity,
        category,
        categoryKey: DUNGEON_CATEGORY_KEYS[category] ?? 'other',
        dungeonCount: strings(row.includeDungeonIds).length,
        imageId: stringValue(row.dungeonPicPath),
        hidden: row.hidden === true,
        searchText: `${name} ${id} ${category}`.toLocaleLowerCase()
      }
    })
    .filter((item): item is DungeonCatalogItem => item !== null)
    .toSorted((left, right) => right.rarity - left.rarity || left.id.localeCompare(right.id, 'en'))
  return { series }
}

export function createDungeonAttributeMaps(value: unknown): DungeonAttributeMaps {
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

function rewardItems(rewardId: string, tables: TableSet, probable: boolean): DungeonRewardItem[] {
  if (!rewardId) return []
  const reward = asRecord(tables.RewardTable?.[rewardId])
  const bundles = records(probable ? reward.probItemBundles : reward.itemBundles)
  return bundles.map((bundle) => {
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

function findTemplateId(id: string, table: RawRecord): string {
  if (table[id]) return id
  return (
    Object.keys(table).reduce(
      (best, candidate) => (id.startsWith(candidate) && candidate.length > best.length ? candidate : best),
      ''
    ) || id
  )
}

function enemyIdentity(id: string, tables: TableSet): { templateId: string; name: string } {
  const enemyTable = asRecord(tables.EnemyTable)
  const displayTable = asRecord(tables.EnemyTemplateDisplayInfoTable)
  const enemy = asRecord(enemyTable[id])
  const templateId = stringValue(enemy.templateId, findTemplateId(id, displayTable))
  const display = asRecord(displayTable[templateId])
  return { templateId, name: textValue(display.name, templateId || id) }
}

function spawnBuffs(value: unknown): DungeonSpawnBuff[] {
  return records(value)
    .map((buff) => ({ id: stringValue(buff.buffId), blackboard: records(buff.blackboard) }))
    .filter((buff) => buff.id !== '')
}

function parseSpawner(value: unknown, tables: TableSet, recommendedLevel: number): ParsedSpawner | null {
  const config = asRecord(value)
  const configId = stringValue(config.configId)
  const libraryRows = records(config.enemyLibrary)
  const levels = new Set(libraryRows.map((row) => numberValue(row.enemyLevel)))
  if (levels.size === 1 && levels.has(0)) return null
  if (recommendedLevel > 0 && !levels.has(recommendedLevel)) return null
  const library = new Map(libraryRows.map((row) => [stringValue(row.key), row]))
  if (library.size === 0) return null

  const waves = Object.entries(asRecord(config.waveMap))
    .map(([waveId, waveValue]): DungeonWave | null => {
      const wave = asRecord(waveValue)
      const enemies: DungeonSpawn[] = []
      let maxAlive = 0
      let externallyControlled = false
      for (const [mapGroupId, groupValue] of Object.entries(asRecord(wave.groupMap))) {
        const group = asRecord(groupValue)
        const groupKey = stringValue(group.groupKey, mapGroupId)
        const groupMode = stringValue(group.groupMode, 'Sequence')
        const targetGroupKey = stringValue(group.groupModeTargetKey)
        const groupModeKillCount = numberValue(group.groupModeKillCount)
        if (group.limitGroupMaxCount === true && numberValue(group.groupMaxCount) > 0) {
          maxAlive += numberValue(group.groupMaxCount)
        }
        for (const actionValue of Object.values(asRecord(group.actionMap))) {
          const action = asRecord(actionValue)
          const actionType = stringValue(action.$type)
          if (actionType.includes('Pause')) {
            externallyControlled = true
            continue
          }
          const libraryEntry = library.get(stringValue(action.libraryKey))
          if (!libraryEntry) continue
          const id = stringValue(libraryEntry.enemyId)
          const identity = enemyIdentity(id, tables)
          const position = asRecord(action.position)
          enemies.push({
            id,
            templateId: identity.templateId,
            name: identity.name,
            level: numberValue(libraryEntry.enemyLevel),
            count: numberValue(action.spawnCount, 1),
            configId,
            groupKey,
            groupMode,
            targetGroupKey,
            groupModeKillCount,
            positionX: numberValue(position.x),
            positionZ: numberValue(position.z),
            randomizeRadius: numberValue(action.randomizeRadius),
            faceMainCharacter: action.faceMainCharacter !== false,
            delay: numberValue(action.timestamp),
            interval: numberValue(action.spawnInterval),
            preWarnTime: numberValue(libraryEntry.preWarnTime),
            buffs: spawnBuffs(libraryEntry.bornBuffList)
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
    .filter((wave): wave is DungeonWave => wave !== null)
    .toSorted(
      (left, right) => numberValue(left.id) - numberValue(right.id) || left.id.localeCompare(right.id, 'en')
    )
  return waves.length ? { configId, waves } : null
}

function mergeWaves(spawners: readonly ParsedSpawner[]): DungeonWave[] {
  const merged = new Map<string, DungeonWave>()
  for (const spawner of spawners) {
    for (const wave of spawner.waves) {
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
  if (parameter.paramSource !== undefined && numberValue(parameter.paramSource) !== 0) return undefined
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
  const nodeType = stringValue(node.$type)
  if (nodeType.includes('SpawnerGetSpawnedEntityList')) {
    const pointer = asRecord(constValue(node._spawnerPtr))
    return pointer.id ? [stringValue(pointer.id)] : []
  }
  if (nodeType.includes('OnSpawnerEntitySpawn')) {
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
  const parameter = action._target ?? action._targets ?? action._targetEntity
  return nodeSpawnerIds(targetNode(parameter, byId), byId, new Set())
}

function isPlayerTarget(action: RawRecord, byId: ReadonlyMap<number, RawRecord>): boolean {
  const parameter = action._target ?? action._targets ?? action._targetEntity
  const node = targetNode(parameter, byId)
  return Boolean(stringValue(node?.$type).match(/GetSquadMembers|GetMainCharacter|GetAllCharacter/))
}

function extractScriptBuffs(sceneId: string, script: RawRecord): ScriptBuffApplication[] {
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
  const applications: ScriptBuffApplication[] = []
  const seen = new Set<string>()
  for (const action of records(asRecord(asRecord(script.actionMap).dataMap).actionList)) {
    const actionType = stringValue(action.$type)
    if (!/AddBuffs?ToTargets?/.test(actionType) || actionType.includes('AddGlobalBuff')) continue
    const buffId = stringValue(constValue(action._buffId))
    if (!buffId || isPlayerTarget(action, byId)) continue
    let spawnerIds = targetSpawnerIds(action, byId)
    let confidence = 'exact'
    if (spawnerIds.length === 0 && moduleSpawnerIds.length === 1) {
      spawnerIds = moduleSpawnerIds
      confidence = 'script'
    }
    const blackboard = records(constValue(action._blackboardKVPairList))
    for (const spawnerId of spawnerIds) {
      const key = `${spawnerId}:${buffId}:${JSON.stringify(blackboard)}`
      if (seen.has(key)) continue
      seen.add(key)
      applications.push({
        buffId,
        blackboard,
        scriptId: stringValue(script.scriptId),
        actionId: stringValue(action._ID),
        configId: `sc_${sceneId}_${spawnerId}`,
        confidence
      })
    }
  }
  return applications
}

function extractScriptEnemies(script: RawRecord): ScriptEnemy[] {
  return Object.values(asRecord(script.enemies))
    .map((value): ScriptEnemy | null => {
      const enemy = asRecord(value)
      const enemyId = stringValue(enemy.entityDataIdKey)
      if (!enemyId) return null
      return {
        enemyId,
        level: numberValue(enemy.level),
        buffs: spawnBuffs(enemy.buffs),
        scriptId: stringValue(script.scriptId)
      }
    })
    .filter((enemy): enemy is ScriptEnemy => enemy !== null)
}

function sceneScriptData(sceneId: string, scripts: readonly unknown[]): SceneScriptData {
  const bySpawner: Record<string, ScriptBuffApplication[]> = {}
  const enemies: ScriptEnemy[] = []
  for (const value of scripts) {
    const script = asRecord(value)
    for (const application of extractScriptBuffs(sceneId, script)) {
      ;(bySpawner[application.configId] ??= []).push(application)
    }
    enemies.push(...extractScriptEnemies(script))
  }
  return { bySpawner, enemies }
}

function blackboardValues(base: unknown, overrides: readonly RawRecord[]): Record<string, number> {
  const values: Record<string, number> = {}
  for (const row of records(base))
    values[stringValue(row.key)] = numberValue(row.valueDouble ?? row.valueFloat)
  for (const row of overrides) {
    values[stringValue(row.key)] = numberValue(row.valueFloat ?? row.valueDouble ?? row.valueInt ?? row.value)
  }
  return values
}

function rawModifier(value: unknown, maps: DungeonAttributeMaps): DungeonAttributeModifier | null {
  const modifier = asRecord(value)
  const attrType = numberValue(modifier.attrType, Number.NaN)
  const modifierType = numberValue(modifier.modifierType, Number.NaN)
  const attrValue = numberValue(modifier.attrValue, Number.NaN)
  if (![attrType, modifierType, attrValue].every(Number.isFinite)) return null
  return {
    attrType,
    attrName: maps.names[attrType] ?? String(attrType),
    value: attrValue,
    modifierType,
    modifierName: maps.modifierNames[modifierType] ?? String(modifierType),
    formula: ''
  }
}

function buffModifiers(
  buffValue: unknown,
  overrides: readonly RawRecord[],
  maps: DungeonAttributeMaps
): DungeonAttributeModifier[] {
  const buff = asRecord(buffValue)
  const values = blackboardValues(buff.blackboard, overrides)
  return records(asRecord(buff.attributeModifier).attributeModifiers)
    .map((value): DungeonAttributeModifier | null => {
      const modifier = asRecord(value)
      const attrType = maps.namesToId[stringValue(modifier.attributeType)]
      const formula = stringValue(modifier.formulaItem)
      const modifierType = FORMULA_TO_MODIFIER[formula]
      const parameter = asRecord(modifier.param)
      if (attrType === undefined || modifierType === undefined) return null
      const resolved =
        parameter.useBlackboardKey === true && stringValue(parameter.blackboardKey)
          ? values[stringValue(parameter.blackboardKey)]
          : numberValue(parameter.value)
      return {
        attrType,
        attrName: maps.names[attrType] ?? stringValue(modifier.attributeType, String(attrType)),
        value: numberValue(resolved),
        modifierType,
        modifierName: maps.modifierNames[modifierType] ?? String(modifierType),
        formula
      }
    })
    .filter((modifier): modifier is DungeonAttributeModifier => modifier !== null)
}

function buffView(
  id: string,
  source: DungeonBuffSource,
  overrides: readonly RawRecord[],
  buffs: Readonly<Record<string, unknown>>,
  maps: DungeonAttributeMaps,
  script?: Partial<ScriptBuffApplication>
): DungeonEnemyBuff {
  const value = buffs[id]
  return {
    id,
    source,
    available: value !== undefined,
    modifiers: value === undefined ? [] : buffModifiers(value, overrides, maps),
    blackboard: blackboardValues(value === undefined ? undefined : asRecord(value).blackboard, overrides),
    scriptId: stringValue(script?.scriptId),
    actionId: stringValue(script?.actionId),
    confidence: stringValue(script?.confidence)
  }
}

function applyModifiers(
  baseValue: number,
  modifiers: readonly DungeonAttributeModifier[],
  attrType: number
): number {
  const relevant = modifiers.filter((modifier) => modifier.attrType === attrType)
  let value = baseValue
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
    for (const modifier of relevant.filter((entry) => entry.modifierType === stage.type)) {
      value = stage.multiply
        ? value * (stage.onePlus ? 1 + modifier.value : modifier.value)
        : value + modifier.value
    }
  }
  return value
}

function enemyStats(
  attrValue: unknown,
  level: number,
  modifiers: readonly DungeonAttributeModifier[],
  maps: DungeonAttributeMaps
): DungeonEnemyStat[] {
  const attr = asRecord(attrValue)
  const levelRows = records(attr.levelDependentAttributes)
  const exact = levelRows.find((row) =>
    records(row.attrs).some(
      (entry) => numberValue(entry.attrType) === 0 && numberValue(entry.attrValue) === level
    )
  )
  const closest = levelRows.toSorted((left, right) => {
    const leftLevel = numberValue(
      records(left.attrs).find((entry) => numberValue(entry.attrType) === 0)?.attrValue
    )
    const rightLevel = numberValue(
      records(right.attrs).find((entry) => numberValue(entry.attrType) === 0)?.attrValue
    )
    return Math.abs(leftLevel - level) - Math.abs(rightLevel - level)
  })[0]
  const values = new Map<number, number>()
  for (const entry of records((exact ?? closest)?.attrs)) {
    values.set(numberValue(entry.attrType), numberValue(entry.attrValue))
  }
  for (const entry of records(asRecord(attr.levelIndependentAttributes).attrs)) {
    const type = numberValue(entry.attrType)
    if (!values.has(type)) values.set(type, numberValue(entry.attrValue))
  }
  for (const modifier of modifiers) {
    if (!values.has(modifier.attrType)) {
      values.set(modifier.attrType, MULTIPLIER_MODIFIERS.has(modifier.modifierType) ? 1 : 0)
    }
  }
  const types = [...values.keys()].filter((type) => !LEGACY_RESISTANCE_ATTRIBUTES.has(type))
  types.sort((left, right) => {
    const leftIndex = DISPLAY_ATTRIBUTE_ORDER.indexOf(left)
    const rightIndex = DISPLAY_ATTRIBUTE_ORDER.indexOf(right)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
    }
    return left - right
  })
  return types.map((attrType) => {
    const baseValue = values.get(attrType) ?? 0
    const value = applyModifiers(baseValue, modifiers, attrType)
    return {
      attrType,
      name: maps.names[attrType] ?? String(attrType),
      baseValue,
      value,
      changed: value !== baseValue
    }
  })
}

function scriptEnemyBuffs(data: SceneScriptData, enemyId: string, level: number): DungeonSpawnBuff[] {
  const matches = data.enemies.filter((enemy) => enemy.enemyId === enemyId)
  const exact = matches.filter((enemy) => enemy.level === level)
  const selected = exact.length ? exact : matches.length === 1 ? matches : []
  return selected.flatMap((enemy) => enemy.buffs)
}

function enemyDetail(
  seed: EnemySeed,
  tables: TableSet,
  scripts: SceneScriptData,
  buffs: Readonly<Record<string, unknown>>,
  maps: DungeonAttributeMaps
): DungeonEnemy {
  const enemyTable = asRecord(tables.EnemyTable)
  const displayTable = asRecord(tables.EnemyTemplateDisplayInfoTable)
  const attrTable = asRecord(tables.EnemyAttributeTemplateTable)
  const config = asRecord(enemyTable[seed.id])
  const templateId = stringValue(config.templateId, findTemplateId(seed.id, displayTable))
  const attrTemplateId = stringValue(config.attrTemplateId, findTemplateId(seed.id, attrTable))
  const display = asRecord(displayTable[templateId])
  const inlineModifiers = records(config.attrModifiers)
    .map((modifier) => rawModifier(modifier, maps))
    .filter((modifier): modifier is DungeonAttributeModifier => modifier !== null)
  const enemyBuffs = strings(config.bornBuffs).map((id) => buffView(id, 'born', [], buffs, maps))
  const spawnerBuffViews = seed.spawnerBuffs.map((buff) =>
    buffView(buff.id, 'spawner', buff.blackboard, buffs, maps)
  )
  const staticScript = scriptEnemyBuffs(scripts, seed.id, seed.level).map((buff) =>
    buffView(buff.id, 'script', buff.blackboard, buffs, maps)
  )
  const conditionalScript = seed.scriptBuffs.map((buff) =>
    buffView(buff.buffId, 'script', buff.blackboard, buffs, maps, buff)
  )
  const resolvedBuffs = [...enemyBuffs, ...spawnerBuffViews, ...staticScript, ...conditionalScript]
  const modifiers = [...inlineModifiers, ...resolvedBuffs.flatMap((buff) => buff.modifiers)]
  return {
    id: seed.id,
    templateId,
    name: textValue(display.name, templateId || seed.id),
    nickname: textValue(display.nickname),
    description: plainText(display.description),
    level: seed.level,
    dangerous: config.isDangerous === true,
    globalEffect: config.showBigEffect === true,
    pinnedHealthBar: config.showBigHeadbar === true,
    stats: enemyStats(attrTable[attrTemplateId], seed.level, modifiers, maps),
    inlineModifiers,
    buffs: resolvedBuffs.filter(
      (buff, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.id === buff.id &&
            candidate.source === buff.source &&
            candidate.scriptId === buff.scriptId &&
            candidate.actionId === buff.actionId
        ) === index
    )
  }
}

function enemySeeds(
  waves: readonly DungeonWave[],
  fallbackIds: readonly string[],
  fallbackLevels: readonly number[],
  recommendedLevel: number,
  scripts: SceneScriptData
): EnemySeed[] {
  const seeds = new Map<string, EnemySeed>()
  for (const wave of waves) {
    for (const enemy of wave.enemies) {
      const seed = seeds.get(enemy.id) ?? {
        id: enemy.id,
        level: enemy.level,
        spawnerBuffs: [],
        scriptBuffs: []
      }
      for (const buff of enemy.buffs) {
        if (!seed.spawnerBuffs.some((candidate) => candidate.id === buff.id)) seed.spawnerBuffs.push(buff)
      }
      for (const buff of scripts.bySpawner[enemy.configId] ?? []) {
        if (
          !seed.scriptBuffs.some(
            (candidate) => candidate.buffId === buff.buffId && candidate.scriptId === buff.scriptId
          )
        ) {
          seed.scriptBuffs.push(buff)
        }
      }
      seeds.set(enemy.id, seed)
    }
  }
  fallbackIds.forEach((id, index) => {
    if (seeds.has(id)) return
    seeds.set(id, {
      id,
      level: fallbackLevels[index] ?? recommendedLevel,
      spawnerBuffs: [],
      scriptBuffs: []
    })
  })
  return [...seeds.values()]
}

function stageDetail(
  id: string,
  value: unknown,
  tables: TableSet,
  runtime: DungeonSceneRuntime | undefined,
  buffs: Readonly<Record<string, unknown>>,
  maps: DungeonAttributeMaps
): DungeonStage {
  const row = asRecord(value)
  const recommendedLevel = numberValue(row.recommendLv)
  const scripts = sceneScriptData(runtime?.sceneId ?? stringValue(row.sceneId), runtime?.levelScripts ?? [])
  const spawners = (runtime?.spawners ?? [])
    .map((spawner) => parseSpawner(spawner, tables, recommendedLevel))
    .filter((spawner): spawner is ParsedSpawner => spawner !== null)
  const waves = mergeWaves(spawners)
  const fallbackIds = strings(row.enemyIds)
  const fallbackLevels = Array.isArray(row.enemyLevels)
    ? row.enemyLevels.map((level) => numberValue(level))
    : []
  const enemies = enemySeeds(waves, fallbackIds, fallbackLevels, recommendedLevel, scripts).map((seed) =>
    enemyDetail(seed, tables, scripts, buffs, maps)
  )
  const hunterRewardId = stringValue(row.hunterModeRewardId)
  const category = stringValue(row.dungeonCategory)
  return {
    id,
    name: textValue(row.dungeonName, id),
    levelDescription: textValue(row.dungeonLevelDesc),
    description: plainText(row.dungeonDesc),
    feature: plainText(row.featureDesc),
    mainGoal: plainText(row.mainGoalDesc),
    extraGoal: plainText(row.extraGoalDesc),
    stamina: numberValue(row.costStamina),
    recommendedLevel,
    category,
    categoryKey: DUNGEON_CATEGORY_KEYS[category] ?? 'other',
    pictureId: stringValue(row.dungeonPicPath),
    iconId: stringValue(row.dungeonImg),
    sceneId: stringValue(row.sceneId),
    waves,
    rewards: {
      fixed: rewardItems(stringValue(row.rewardId), tables, false),
      first: rewardItems(stringValue(row.firstPassRewardId), tables, false),
      hunterFixed: rewardItems(hunterRewardId, tables, false),
      hunterRandom: rewardItems(hunterRewardId, tables, true),
      hunterStamina: numberValue(row.hunterModeCostStamina)
    },
    enemies,
    runtime: {
      spawnerManifestAvailable: runtime?.spawnerManifestAvailable ?? false,
      levelScriptManifestAvailable: runtime?.levelScriptManifestAvailable ?? false,
      missingSpawnerDetails: runtime?.missingSpawnerDetails ?? 0,
      missingLevelScriptDetails: runtime?.missingLevelScriptDetails ?? 0
    }
  }
}

export function collectDungeonBuffIds(
  tables: TableSet,
  seriesId: string,
  runtimes: Readonly<Record<string, DungeonSceneRuntime>>
): string[] {
  const series = asRecord(tables.DungeonSeriesTable?.[seriesId])
  const dungeonTable = asRecord(tables.DungeonTable)
  const enemyIds = new Set<string>()
  const buffIds = new Set<string>()
  for (const dungeonId of strings(series.includeDungeonIds)) {
    const row = asRecord(dungeonTable[dungeonId])
    strings(row.enemyIds).forEach((id) => enemyIds.add(id))
    const runtime = runtimes[stringValue(row.sceneId)]
    for (const spawnerValue of runtime?.spawners ?? []) {
      const spawner = asRecord(spawnerValue)
      for (const enemy of records(spawner.enemyLibrary)) {
        enemyIds.add(stringValue(enemy.enemyId))
        spawnBuffs(enemy.bornBuffList).forEach((buff) => buffIds.add(buff.id))
      }
    }
    const scripts = sceneScriptData(stringValue(row.sceneId), runtime?.levelScripts ?? [])
    Object.values(scripts.bySpawner)
      .flat()
      .forEach((buff) => buffIds.add(buff.buffId))
    scripts.enemies.forEach((enemy) => {
      enemyIds.add(enemy.enemyId)
      enemy.buffs.forEach((buff) => buffIds.add(buff.id))
    })
  }
  const enemyTable = asRecord(tables.EnemyTable)
  for (const id of enemyIds)
    strings(asRecord(enemyTable[id]).bornBuffs).forEach((buffId) => buffIds.add(buffId))
  return [...buffIds].filter(Boolean)
}

export function buildDungeonDetail(
  tables: TableSet,
  seriesId: string,
  runtimes: Readonly<Record<string, DungeonSceneRuntime>>,
  buffs: Readonly<Record<string, unknown>>,
  maps: DungeonAttributeMaps
): DungeonSeriesDetail | null {
  const seriesValue = tables.DungeonSeriesTable?.[seriesId]
  if (!seriesValue) return null
  const series = asRecord(seriesValue)
  const dungeonTable = asRecord(tables.DungeonTable)
  const orderedIds = strings(series.includeDungeonIds).filter((id) => dungeonTable[id] !== undefined)
  const category = stringValue(series.gameCategory)
  return {
    id: seriesId,
    name: textValue(series.name, seriesId),
    description: plainText(series.desc),
    staminaText: textValue(series.staminaText),
    category,
    categoryKey: DUNGEON_CATEGORY_KEYS[category] ?? 'other',
    pictureId: stringValue(series.dungeonPicPath),
    roleImageId: stringValue(series.dungeonRoleImg),
    dungeons: orderedIds.map((id) => {
      const row = asRecord(dungeonTable[id])
      return stageDetail(id, row, tables, runtimes[stringValue(row.sceneId)], buffs, maps)
    })
  }
}
