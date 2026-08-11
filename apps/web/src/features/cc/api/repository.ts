import { hydrateTextReferences, asRecord, type RawTable, type TableSet } from '@ake/domain'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import { LANGUAGE_INFO, sharedRef, type R2VersionEntry } from '@ake/r2-contract'
import {
  buildCcCatalog,
  buildCcDetailBase,
  type CcCatalog,
  type CcCatalogEntry,
  type CcDetail
} from '../model'
import {
  buildCcCombatContext,
  collectCcCombatBuffIds,
  createCcAttributeMaps,
  type CcLevelData,
  type CcLevelScript,
  type CcManifestEntry,
  type CcSceneRuntime,
  type CcSpawnerConfig
} from '../model/combat'

const CATALOG_REQUIRED_TABLES = [
  'ActivityContingencyContractTable',
  'ActivityTable',
  'ContingencyContractTable',
  'TimeRangeTable'
] as const

const DETAIL_REQUIRED_TABLES = [
  ...CATALOG_REQUIRED_TABLES,
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
] as const

const OPTIONAL_COMBAT_TABLES = [
  'DungeonTable',
  'DungeonSeriesTable',
  'EnemyTable',
  'EnemyTemplateDisplayInfoTable',
  'EnemyAttributeTemplateTable'
] as const

const repositories = new WeakMap<R2DataClient, CcRepository>()

export function getCcRepository(client: R2DataClient): CcRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new CcRepository(client)
  repositories.set(client, repository)
  return repository
}

export class CcRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()
  private readonly optionalJson = new Map<string, Promise<unknown | null>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(
    options: { showHidden?: boolean; now?: number } = {},
    signal?: AbortSignal
  ): Promise<CcCatalog> {
    const tables = await this.loadTables(
      CATALOG_REQUIRED_TABLES,
      OPTIONAL_COMBAT_TABLES.filter((name) => name === 'DungeonTable' || name === 'DungeonSeriesTable'),
      signal
    )
    return buildCcCatalog(tables, options)
  }

  async detail(entry: CcCatalogEntry, signal?: AbortSignal): Promise<CcDetail> {
    const tables = await this.loadTables(DETAIL_REQUIRED_TABLES, OPTIONAL_COMBAT_TABLES, signal)
    const base = buildCcDetailBase(tables, entry)
    const dungeon = asRecord(tables.DungeonTable?.[entry.id])
    const sceneId = typeof dungeon.sceneId === 'string' ? dungeon.sceneId : ''
    const runtime = await this.loadSceneRuntime(sceneId, signal)
    const ids = collectCcCombatBuffIds(tables, entry.id, runtime, base.terms)
    const [buffPairs, mapsValue] = await Promise.all([
      Promise.all(ids.map(async (id) => [id, await this.loadBuff(id, signal)] as const)),
      this.loadMaps(signal)
    ])
    const buffs = Object.fromEntries(
      buffPairs.filter((pair): pair is readonly [string, unknown] => pair[1] !== null)
    )
    return {
      ...base,
      combat: buildCcCombatContext({
        tables,
        gameId: entry.id,
        runtime,
        buffs,
        maps: createCcAttributeMaps(mapsValue)
      })
    }
  }

  private async loadTables(
    required: readonly string[],
    optional: readonly string[],
    signal?: AbortSignal
  ): Promise<TableSet> {
    const version = this.client.state.selected
    const pairs = await Promise.all([
      ...required.map(async (name) => [name, await this.loadTable(name, version, false, signal)] as const),
      ...optional
        .filter((name) => !required.includes(name))
        .map(async (name) => [name, await this.loadTable(name, version, true, signal)] as const)
    ])
    return Object.fromEntries(pairs) as TableSet
  }

  private loadTable(
    name: string,
    version: R2VersionEntry,
    optional: boolean,
    signal?: AbortSignal
  ): Promise<RawTable> {
    const state = this.client.state
    const key = `${state.baseUrl}|${version.id}|${state.locale}|${optional ? 'optional' : 'required'}|${name}`
    let request = this.tables.get(key)
    if (!request) {
      request = Promise.all([
        this.client.getTable<RawTable>(name, { signal }, version),
        this.loadTranslations(version, signal)
      ])
        .then(([table, translations]) => hydrateTextReferences(table, translations))
        .catch((error: unknown) => {
          if (this.tables.get(key) === request) this.tables.delete(key)
          if (optional && error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
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

  private loadOptionalJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    const state = this.client.state
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|${path}`
    let request = this.optionalJson.get(key)
    if (!request) {
      request = this.client.getJson<unknown>(sharedRef(path), { signal }).catch((error: unknown) => {
        if (error instanceof DataClientError && error.code === 'NOT_FOUND') return null
        if (this.optionalJson.get(key) === request) this.optionalJson.delete(key)
        throw error
      })
      this.optionalJson.set(key, request)
    }
    return request as Promise<T | null>
  }

  private async loadManifestDetails<T extends object>(
    root: string,
    signal?: AbortSignal
  ): Promise<{ available: boolean; missing: number; values: T[] }> {
    const manifest = await this.loadOptionalJson<CcManifestEntry[]>(`${root}/manifest.json`, signal)
    if (manifest === null) return { available: false, missing: 0, values: [] }
    const entries = Array.isArray(manifest) ? manifest : []
    const values = await Promise.all(
      entries
        .filter((entry) => entry.hidden !== true)
        .map(async (entry) => {
          const path = entry.contentFile || `${root}/${entry.id ?? ''}.json`
          return this.loadOptionalJson<T>(path, signal)
        })
    )
    return {
      available: true,
      missing: values.filter((value) => value === null).length,
      values: values.flatMap((value): T[] => (value === null ? [] : [value]))
    }
  }

  private async loadSceneRuntime(sceneId: string, signal?: AbortSignal): Promise<CcSceneRuntime> {
    if (!sceneId) {
      return {
        sceneId: '',
        levelData: null,
        spawnerManifestAvailable: false,
        levelScriptManifestAvailable: false,
        missingSpawnerDetails: 0,
        missingLevelScriptDetails: 0,
        spawners: [],
        levelScripts: []
      }
    }
    const [levelData, spawners, scripts] = await Promise.all([
      this.loadOptionalJson<CcLevelData>(`public/Json/LevelData/${sceneId}/${sceneId}_lv_data.json`, signal),
      this.loadManifestDetails<CcSpawnerConfig>(`public/Json/SpawnerConfig/${sceneId}`, signal),
      this.loadManifestDetails<CcLevelScript>(`public/Json/LevelScriptData/${sceneId}`, signal)
    ])
    return {
      sceneId,
      levelData,
      spawnerManifestAvailable: spawners.available,
      levelScriptManifestAvailable: scripts.available,
      missingSpawnerDetails: spawners.missing,
      missingLevelScriptDetails: scripts.missing,
      spawners: spawners.values,
      levelScripts: scripts.values
    }
  }

  private loadBuff(id: string, signal?: AbortSignal): Promise<unknown | null> {
    return this.loadOptionalJson(`public/Json/BuffData/${id}.json`, signal)
  }

  private async loadMaps(signal?: AbortSignal): Promise<unknown> {
    const directory = LANGUAGE_INFO[this.client.state.locale].directory
    const localized = await this.loadOptionalJson<unknown>(`public/${directory}/maps.json`, signal)
    if (localized !== null || directory === 'CH') return localized ?? {}
    return (await this.loadOptionalJson<unknown>('public/CH/maps.json', signal)) ?? {}
  }
}
