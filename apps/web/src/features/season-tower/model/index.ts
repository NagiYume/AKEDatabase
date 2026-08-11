import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'

export const SEASON_TOWER_SERIES_ID = 'indie_group_twdg'
export const SEASON_TOWER_SCENE_ID = 'indie_tower001'

export type SeasonStatus = 'active' | 'upcoming' | 'closed'

export interface TowerRewardItem {
  id: string
  name: string
  count: number
  iconId: string
  probable: boolean
}

export interface TowerSpawnBuff {
  id: string
  blackboard: RawRecord[]
}

export interface TowerEnemySpawn {
  id: string
  templateId: string
  name: string
  level: number
  count: number
  groupKey: string
  groupMode?: string
  targetGroupKey?: string
  groupModeKillCount?: number
  positionX: number
  positionZ: number
  randomizeRadius?: number
  faceMainCharacter?: boolean
  delay: number
  interval: number
  preWarnTime: number
  buffIds: string[]
  buffs: TowerSpawnBuff[]
}

export interface TowerWave {
  id: string
  mode: string
  repeatable: boolean
  maxAlive: number
  externallyControlled: boolean
  enemies: TowerEnemySpawn[]
}

export interface TowerSpawner {
  id: string
  waves: TowerWave[]
  libraryEnemies: TowerEnemySpawn[]
}

export interface TowerDifficulty {
  gameId: string
  star: number
  label: string
  recommendedLevel: number
  goal: string
  feature: string
  special: string
  rewards: TowerRewardItem[]
  spawners: TowerSpawner[]
  fallbackEnemies: TowerEnemySpawn[]
}

export interface TowerStage {
  id: string
  name: string
  icon: string
  difficulties: TowerDifficulty[]
}

export interface TowerWeek {
  id: string
  name: string
  openTime: string
  closeTime: string
  status: SeasonStatus
  stages: TowerStage[]
}

export interface TowerSeason {
  id: string
  name: string
  openTime: string
  closeTime: string
  status: SeasonStatus
  weeks: TowerWeek[]
  searchText: string
}

export interface TowerIntroPage {
  id: string
  title: string
  description: string
  order: number
}

export interface TowerRank {
  id: string
  name: string
  stars: number | null
  glowing: boolean
}

export interface SeasonTowerCatalog {
  activityName: string
  activityDescription: string
  activityIcon: string
  seasons: TowerSeason[]
  introPages: TowerIntroPage[]
  ranks: TowerRank[]
  weekCount: number
  stageCount: number
  spawnerCount: number
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).map(String) : []
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function plainText(value: unknown, fallback = ''): string {
  return textValue(value, fallback)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function parseGameTime(value: string): number | null {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!match) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const parts = match.slice(1).map(Number)
  const [year, month, day, hour, minute, second] = parts
  if ([year, month, day, hour, minute, second].some((part) => part === undefined)) return null
  return Date.parse(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+08:00`
  )
}

export function seasonStatus(openTime: string, closeTime: string, now = Date.now()): SeasonStatus {
  const open = parseGameTime(openTime)
  const close = parseGameTime(closeTime)
  if (open !== null && now < open) return 'upcoming'
  if (close !== null && now >= close) return 'closed'
  return 'active'
}

function fillParameters(value: string, params: unknown): string {
  const values = Object.fromEntries(
    records(params).map((param) => [
      stringValue(param.key),
      stringValue(param.valueStr, stringValue(param.value))
    ])
  )
  return value.replace(
    /\{([+-]?)([^}:]+)(?::([^}]+))?\}/g,
    (match, operator: string, key: string, format: string | undefined) => {
      if (!(key in values)) return match
      const source = values[key] ?? ''
      const normalized = operator === '-' ? -numberValue(source) : source
      return format?.includes('%') ? `${Math.round(numberValue(normalized) * 100)}%` : String(normalized)
    }
  )
}

function rewardItems(rewardId: string, tables: TableSet): TowerRewardItem[] {
  const reward = asRecord(tables.RewardTable?.[rewardId])
  const definite = records(reward.itemBundles).map((bundle) => ({ bundle, probable: false }))
  const probable = records(reward.probItemBundles).map((bundle) => ({ bundle, probable: true }))
  return [...definite, ...probable].map(({ bundle, probable: isProbable }) => {
    const id = stringValue(bundle.id)
    const item = asRecord(tables.ItemTable?.[id])
    return {
      id,
      name: textValue(item.name, id),
      count: numberValue(bundle.count, 1),
      iconId: stringValue(item.iconId, id),
      probable: isProbable
    }
  })
}

function enemyInfo(id: string, tables: TableSet): { templateId: string; name: string } {
  const enemy = asRecord(tables.EnemyTable?.[id])
  const templateId = stringValue(enemy.templateId, id)
  const display = asRecord(tables.EnemyTemplateDisplayInfoTable?.[templateId])
  return { templateId, name: textValue(display.name, templateId || id) }
}

function librarySpawn(
  value: RawRecord,
  group: {
    key: string
    mode?: string
    targetKey?: string
    killCount?: number
  },
  action: RawRecord,
  tables: TableSet
): TowerEnemySpawn {
  const id = stringValue(value.enemyId)
  const info = enemyInfo(id, tables)
  const position = asRecord(action.position)
  const buffs = records(value.bornBuffList)
    .map((buff): TowerSpawnBuff => ({
      id: stringValue(buff.buffId),
      blackboard: records(buff.blackboard)
    }))
    .filter((buff) => buff.id !== '')
  return {
    id,
    templateId: info.templateId,
    name: info.name,
    level: numberValue(value.enemyLevel),
    count: numberValue(action.spawnCount, 1),
    groupKey: group.key,
    groupMode: group.mode,
    targetGroupKey: group.targetKey,
    groupModeKillCount: group.killCount,
    positionX: numberValue(position.x),
    positionZ: numberValue(position.z),
    randomizeRadius: numberValue(action.randomizeRadius),
    faceMainCharacter: action.faceMainCharacter !== false,
    delay: numberValue(action.timestamp),
    interval: numberValue(action.spawnInterval),
    preWarnTime: numberValue(value.preWarnTime),
    buffIds: buffs.map((buff) => buff.id),
    buffs
  }
}

function buildSpawner(value: unknown, tables: TableSet): TowerSpawner {
  const config = asRecord(value)
  const libraryRows = records(config.enemyLibrary)
  const library = Object.fromEntries(libraryRows.map((enemy) => [stringValue(enemy.key), enemy]))
  const emptyAction: RawRecord = {}
  const libraryEnemies = libraryRows.map((enemy) => librarySpawn(enemy, { key: '' }, emptyAction, tables))
  const waves = Object.entries(asRecord(config.waveMap))
    .map(([waveId, waveValue]): TowerWave => {
      const wave = asRecord(waveValue)
      const enemies: TowerEnemySpawn[] = []
      let maxAlive = 0
      let externallyControlled = false
      let mode = 'Sequence'
      for (const [groupId, groupValue] of Object.entries(asRecord(wave.groupMap))) {
        const group = asRecord(groupValue)
        const groupKey = stringValue(group.groupKey, groupId)
        const groupMode = stringValue(group.groupMode, mode)
        const targetGroupKey = stringValue(group.groupModeTargetKey)
        const groupModeKillCount = numberValue(group.groupModeKillCount)
        mode = groupMode
        if (group.limitGroupMaxCount && numberValue(group.groupMaxCount) > 0)
          maxAlive += numberValue(group.groupMaxCount)
        for (const actionValue of Object.values(asRecord(group.actionMap))) {
          const action = asRecord(actionValue)
          if (stringValue(action.$type).includes('Pause')) {
            externallyControlled = true
            continue
          }
          const enemy = library[stringValue(action.libraryKey)]
          if (enemy) {
            enemies.push(
              librarySpawn(
                enemy,
                {
                  key: groupKey,
                  mode: groupMode,
                  targetKey: targetGroupKey,
                  killCount: groupModeKillCount
                },
                action,
                tables
              )
            )
          }
        }
      }
      return {
        id: waveId,
        mode,
        repeatable: Boolean(wave.repeatable),
        maxAlive,
        externallyControlled,
        enemies
      }
    })
    .filter((wave) => wave.enemies.length > 0)
  return { id: stringValue(config.configId), waves, libraryEnemies }
}

function spawnersForDungeon(dungeon: RawRecord, all: readonly unknown[], tables: TableSet): TowerSpawner[] {
  const expected = new Set(stringList(dungeon.enemyIds))
  const level = numberValue(dungeon.recommendLv)
  return all
    .map(asRecord)
    .filter((config) => {
      const library = records(config.enemyLibrary)
      return (
        library.length > 0 &&
        library.every(
          (enemy) => numberValue(enemy.enemyLevel) === level && expected.has(stringValue(enemy.enemyId))
        )
      )
    })
    .map((config) => buildSpawner(config, tables))
}

function fallbackEnemies(dungeon: RawRecord, tables: TableSet): TowerEnemySpawn[] {
  const levels = Array.isArray(dungeon.enemyLevels) ? dungeon.enemyLevels : []
  return stringList(dungeon.enemyIds).map((id, index) => {
    const info = enemyInfo(id, tables)
    return {
      id,
      templateId: info.templateId,
      name: info.name,
      level: numberValue(levels[index], numberValue(dungeon.recommendLv)),
      count: 1,
      groupKey: '',
      positionX: 0,
      positionZ: 0,
      delay: 0,
      interval: 0,
      preWarnTime: 0,
      buffIds: [],
      buffs: []
    }
  })
}

function buildStage(id: string, tables: TableSet, spawnerConfigs: readonly unknown[]): TowerStage {
  const towerGroup = asRecord(tables.SeasonTowerGameGroupTable?.[id])
  const mechanicGroup = asRecord(tables.GameMechanicGroupTable?.[id])
  const difficulties = Object.entries(asRecord(towerGroup.stars))
    .map(([starValue, gameValue]): TowerDifficulty => {
      const game = asRecord(gameValue)
      const gameId = stringValue(game.gameId)
      const dungeon = asRecord(tables.DungeonTable?.[gameId])
      const mechanic = asRecord(tables.GameMechanicTable?.[gameId])
      const special = asRecord(tables.SeasonTowerDungeonTable?.[gameId])
      const star = numberValue(starValue)
      return {
        gameId,
        star,
        label: '',
        recommendedLevel: numberValue(dungeon.recommendLv),
        goal: plainText(mechanic.desc),
        feature: fillParameters(plainText(dungeon.featureDesc), dungeon.paramList),
        special: fillParameters(plainText(special.specialBuffDesc), dungeon.paramList),
        rewards: rewardItems(stringValue(game.rewardId), tables),
        spawners:
          stringValue(dungeon.dungeonSeriesId) === SEASON_TOWER_SERIES_ID
            ? spawnersForDungeon(dungeon, spawnerConfigs, tables)
            : [],
        fallbackEnemies: fallbackEnemies(dungeon, tables)
      }
    })
    .toSorted((left, right) => left.star - right.star)
  return {
    id,
    name: textValue(mechanicGroup.gameGroupName, id),
    icon: stringValue(towerGroup.icon),
    difficulties
  }
}

export function buildSeasonTowerCatalog(
  tables: TableSet,
  spawnerConfigs: readonly unknown[],
  now = Date.now()
): SeasonTowerCatalog {
  const activity = asRecord(tables.ActivityTable?.activity_seasontower_0)
  const timeTable = tables.TimeRangeTable ?? {}
  const stageCache = new Map<string, TowerStage>()
  const resolveStage = (id: string): TowerStage => {
    const existing = stageCache.get(id)
    if (existing) return existing
    const stage = buildStage(id, tables, spawnerConfigs)
    stageCache.set(id, stage)
    return stage
  }
  const seasons = Object.entries(tables.SeasonTowerTable ?? {})
    .map(([id, value]): TowerSeason => {
      const season = asRecord(value)
      const weeks = Object.entries(asRecord(season.weeks))
        .map(([weekId, weekValue]): TowerWeek => {
          const week = asRecord(weekValue)
          const range = asRecord(
            (Array.isArray(
              asRecord(timeTable[`time_activity_seasontower_season_${id}_week_${weekId}`]).timeRangeList
            )
              ? (asRecord(timeTable[`time_activity_seasontower_season_${id}_week_${weekId}`])
                  .timeRangeList as unknown[])
              : [])[0]
          )
          const openTime = stringValue(range.openTime)
          const closeTime = stringValue(range.closeTime)
          return {
            id: weekId,
            name: textValue(week.weekShowName, weekId),
            openTime,
            closeTime,
            status: seasonStatus(openTime, closeTime, now),
            stages: stringList(week.includeGameIdList).map(resolveStage)
          }
        })
        .toSorted((left, right) => numberValue(left.id) - numberValue(right.id))
      const openTime = weeks[0]?.openTime ?? ''
      const closeTime = weeks.at(-1)?.closeTime ?? ''
      const name = textValue(season.name, id)
      return {
        id,
        name,
        openTime,
        closeTime,
        status: seasonStatus(openTime, closeTime, now),
        weeks,
        searchText: [
          id,
          name,
          ...weeks.flatMap((week) => [week.name, ...week.stages.flatMap((stage) => [stage.id, stage.name])])
        ]
          .join('\n')
          .toLocaleLowerCase()
      }
    })
    .toSorted((left, right) => numberValue(left.id) - numberValue(right.id))

  const intro = asRecord(tables.IntroTable?.season_tower)
  const introPages = records(intro.dataArray)
    .map((page, index): TowerIntroPage => ({
      id: stringValue(page.id, `intro-${index}`),
      title: textValue(page.title, stringValue(page.id, `intro-${index}`)),
      description: plainText(page.desc),
      order: numberValue(page.pageIndex, index)
    }))
    .toSorted((left, right) => left.order - right.order)
  const thresholds = Array.isArray(asRecord(tables.SeasonTowerConst).rankStarNum)
    ? (asRecord(tables.SeasonTowerConst).rankStarNum as unknown[])
    : []
  const ranks = Object.entries(tables.SeasonTowerRankTable ?? {})
    .filter(([id]) => numberValue(id) > 0)
    .map(([id, value]): TowerRank => {
      const numeric = numberValue(id)
      return {
        id,
        name: textValue(asRecord(value).rankName, id),
        stars: numeric === 6 ? null : numberValue(thresholds[numeric - 1], 0),
        glowing: numeric === 6
      }
    })
    .toSorted((left, right) => numberValue(left.id) - numberValue(right.id))

  return {
    activityName: textValue(activity.name, 'activity_seasontower_0'),
    activityDescription: plainText(activity.desc),
    activityIcon: stringValue(activity.tabImg, 'activity_tab_bg_seasontower'),
    seasons,
    introPages,
    ranks,
    weekCount: seasons.reduce((total, season) => total + season.weeks.length, 0),
    stageCount: seasons.reduce(
      (total, season) => total + season.weeks.reduce((sum, week) => sum + week.stages.length, 0),
      0
    ),
    spawnerCount: new Set(
      seasons.flatMap((season) =>
        season.weeks.flatMap((week) =>
          week.stages.flatMap((stage) =>
            stage.difficulties.flatMap((difficulty) => difficulty.spawners.map((spawner) => spawner.id))
          )
        )
      )
    ).size
  }
}

export function filterTowerSeasons(
  seasons: readonly TowerSeason[],
  options: { search?: string; status?: string }
): TowerSeason[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  return seasons.filter((season) => {
    if (options.status && options.status !== 'all' && season.status !== options.status) return false
    return !search || season.searchText.includes(search)
  })
}
