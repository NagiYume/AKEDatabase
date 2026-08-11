import { hydrateTextReferences, type RawTable, type TableSet } from '@ake/domain'
import { LANGUAGE_INFO, sharedRef, type R2VersionEntry } from '@ake/r2-contract'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import { buildSeasonTowerCatalog, SEASON_TOWER_SCENE_ID, type SeasonTowerCatalog } from '../model'
import {
  buildTowerCombatDetail,
  collectTowerCombatBuffIds,
  createTowerAttributeMaps,
  extractLevelScriptData,
  type TowerCombatDetail,
  type TowerLevelScriptData
} from '../model/combat'
import type { TowerDifficulty, TowerSpawner } from '../model'

const TABLES = [
  'SeasonTowerTable',
  'SeasonTowerGameGroupTable',
  'GameMechanicGroupTable',
  'DungeonTable',
  'GameMechanicTable',
  'SeasonTowerDungeonTable',
  'RewardTable',
  'ItemTable',
  'TimeRangeTable',
  'SeasonTowerConst',
  'SeasonTowerRankTable',
  'DungeonSeriesTable',
  'EnemyTable',
  'EnemyTemplateDisplayInfoTable',
  'EnemyAttributeTemplateTable',
  'IntroTable',
  'ActivityTable'
] as const

interface ManifestEntry {
  id?: unknown
  contentFile?: unknown
  hidden?: unknown
}

const repositories = new WeakMap<R2DataClient, SeasonTowerRepository>()

export function getSeasonTowerRepository(client: R2DataClient): SeasonTowerRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new SeasonTowerRepository(client)
  repositories.set(client, repository)
  return repository
}

export class SeasonTowerRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()
  private readonly levelScripts = new Map<string, Promise<TowerLevelScriptData>>()
  private readonly spawnerDetails = new Map<string, Promise<unknown | null>>()
  private readonly buffs = new Map<string, Promise<unknown | null>>()
  private readonly maps = new Map<string, Promise<unknown>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(signal?: AbortSignal): Promise<SeasonTowerCatalog> {
    const [pairs, spawners] = await Promise.all([
      Promise.all(
        TABLES.map(
          async (name) => [name, await this.loadTable(name, this.client.state.selected, signal)] as const
        )
      ),
      this.loadSpawners(signal)
    ])
    return buildSeasonTowerCatalog(Object.fromEntries(pairs) as TableSet, spawners)
  }

  async combatDetail(
    difficulty: TowerDifficulty,
    spawner: TowerSpawner | null,
    signal?: AbortSignal
  ): Promise<TowerCombatDetail> {
    const version = this.client.state.selected
    const [pairs, scripts, mapValue] = await Promise.all([
      Promise.all(
        ['EnemyTable', 'EnemyTemplateDisplayInfoTable', 'EnemyAttributeTemplateTable'].map(
          async (name) => [name, await this.loadTable(name, version, signal)] as const
        )
      ),
      this.loadLevelScripts(signal),
      this.loadMaps(signal)
    ])
    const tables = Object.fromEntries(pairs) as TableSet
    const ids = collectTowerCombatBuffIds(tables, difficulty, spawner, scripts)
    const values = await Promise.all(ids.map(async (id) => [id, await this.loadBuff(id, signal)] as const))
    return buildTowerCombatDetail({
      tables,
      difficulty,
      spawner,
      scripts,
      buffs: Object.fromEntries(
        values.filter((entry): entry is readonly [string, unknown] => entry[1] !== null)
      ),
      maps: createTowerAttributeMaps(mapValue)
    })
  }

  private async loadSpawners(signal?: AbortSignal): Promise<unknown[]> {
    const root = `public/Json/SpawnerConfig/${SEASON_TOWER_SCENE_ID}`
    const manifest = await this.client.getJson<unknown>(sharedRef(`${root}/manifest.json`), { signal })
    const entries = Array.isArray(manifest) ? (manifest as ManifestEntry[]) : []
    const values = await Promise.all(
      entries
        .filter((entry) => entry.hidden !== true)
        .map(async (entry) => {
          const path =
            typeof entry.contentFile === 'string' && entry.contentFile
              ? entry.contentFile
              : `${root}/${String(entry.id ?? '')}.json`
          return this.loadSpawnerDetail(path, signal)
        })
    )
    return values.filter((value): value is NonNullable<typeof value> => value !== null)
  }

  private loadSpawnerDetail(path: string, signal?: AbortSignal): Promise<unknown | null> {
    const state = this.client.state
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|spawner:${path}`
    let request = this.spawnerDetails.get(key)
    if (!request) {
      request = this.loadOptionalJson(path, signal).catch((error: unknown) => {
        if (this.spawnerDetails.get(key) === request) this.spawnerDetails.delete(key)
        throw error
      })
      this.spawnerDetails.set(key, request)
    }
    return request
  }

  private loadLevelScripts(signal?: AbortSignal): Promise<TowerLevelScriptData> {
    const state = this.client.state
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|${SEASON_TOWER_SCENE_ID}`
    let request = this.levelScripts.get(key)
    if (!request) {
      const root = `public/Json/LevelScriptData/${SEASON_TOWER_SCENE_ID}`
      request = (async () => {
        const manifest = await this.loadOptionalJson(`${root}/manifest.json`, signal)
        const entries = Array.isArray(manifest) ? (manifest as ManifestEntry[]) : []
        const scripts = await Promise.all(
          entries
            .filter((entry) => entry.hidden !== true)
            .map(async (entry) => {
              const path =
                typeof entry.contentFile === 'string' && entry.contentFile
                  ? entry.contentFile
                  : `${root}/${String(entry.id ?? '')}.json`
              return this.loadOptionalJson(path, signal)
            })
        )
        return extractLevelScriptData(
          SEASON_TOWER_SCENE_ID,
          scripts.filter((value) => value !== null)
        )
      })().catch((error: unknown) => {
        if (this.levelScripts.get(key) === request) this.levelScripts.delete(key)
        throw error
      })
      this.levelScripts.set(key, request)
    }
    return request
  }

  private loadBuff(id: string, signal?: AbortSignal): Promise<unknown | null> {
    const state = this.client.state
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|buff:${id}`
    let request = this.buffs.get(key)
    if (!request) {
      request = this.loadOptionalJson(`public/Json/BuffData/${id}.json`, signal).catch((error: unknown) => {
        if (this.buffs.get(key) === request) this.buffs.delete(key)
        throw error
      })
      this.buffs.set(key, request)
    }
    return request
  }

  private loadMaps(signal?: AbortSignal): Promise<unknown> {
    const state = this.client.state
    const directory = LANGUAGE_INFO[state.locale].directory
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|maps:${directory}`
    let request = this.maps.get(key)
    if (!request) {
      const load = (name: string) => this.loadOptionalJson(`public/${name}/maps.json`, signal)
      request = load(directory)
        .then(async (value) => value ?? (directory === 'CH' ? {} : ((await load('CH')) ?? {})))
        .catch((error: unknown) => {
          if (this.maps.get(key) === request) this.maps.delete(key)
          throw error
        })
      this.maps.set(key, request)
    }
    return request
  }

  private async loadOptionalJson(path: string, signal?: AbortSignal): Promise<unknown | null> {
    try {
      return await this.client.getJson<unknown>(sharedRef(path), { signal })
    } catch (error) {
      if (error instanceof DataClientError && error.code === 'NOT_FOUND') return null
      throw error
    }
  }

  private loadTable(name: string, version: R2VersionEntry, signal?: AbortSignal): Promise<RawTable> {
    const key = `${this.client.state.baseUrl}|${version.id}|${this.client.state.locale}|${name}`
    let request = this.tables.get(key)
    if (!request) {
      request = Promise.all([
        this.client.getTable<RawTable>(name, { signal }, version),
        this.loadTranslations(version, signal)
      ])
        .then(([table, translations]) => hydrateTextReferences(table, translations))
        .catch((error: unknown) => {
          if (this.tables.get(key) === request) this.tables.delete(key)
          if (error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
          throw error
        })
      this.tables.set(key, request)
    }
    return request
  }

  private loadTranslations(version: R2VersionEntry, signal?: AbortSignal): Promise<Record<string, string>> {
    const suffix = LANGUAGE_INFO[this.client.state.locale].table
    const key = `${this.client.state.baseUrl}|${version.id}|translations:${suffix}`
    let request = this.translations.get(key)
    if (!request) {
      const load = (locale: string) =>
        this.client
          .getTable<Record<string, string>>(`I18nTextTable_${locale}`, { signal }, version)
          .catch((error: unknown) => {
            if (error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
            throw error
          })
      request =
        suffix === 'CN'
          ? load('CN')
          : Promise.all([load('CN'), load(suffix)]).then(([chinese, localized]) => ({
              ...chinese,
              ...Object.fromEntries(Object.entries(localized).filter(([, value]) => value !== ''))
            }))
      request = request.catch((error: unknown) => {
        if (this.translations.get(key) === request) this.translations.delete(key)
        throw error
      })
      this.translations.set(key, request)
    }
    return request
  }
}
