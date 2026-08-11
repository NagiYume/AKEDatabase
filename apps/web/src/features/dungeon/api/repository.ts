import { hydrateTextReferences, asRecord, type RawTable, type TableSet } from '@ake/domain'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import { LANGUAGE_INFO, sharedRef, type R2VersionEntry } from '@ake/r2-contract'
import {
  buildDungeonCatalog,
  buildDungeonDetail,
  collectDungeonBuffIds,
  createDungeonAttributeMaps,
  type DungeonCatalog,
  type DungeonSceneRuntime,
  type DungeonSeriesDetail
} from '../model'

const CATALOG_TABLES = ['DungeonSeriesTable', 'DungeonTable'] as const
const DETAIL_TABLES = [
  'DungeonSeriesTable',
  'DungeonTable',
  'RewardTable',
  'ItemTable',
  'EnemyTable',
  'EnemyTemplateDisplayInfoTable',
  'EnemyAttributeTemplateTable'
] as const

interface ManifestEntry {
  id?: unknown
  contentFile?: unknown
  hidden?: unknown
  priority?: unknown
}

const repositories = new WeakMap<R2DataClient, DungeonRepository>()

export function getDungeonRepository(client: R2DataClient): DungeonRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new DungeonRepository(client)
  repositories.set(client, repository)
  return repository
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSharedPath(value: string): string {
  return value.replace(/^\/+/, '')
}

function manifestEntries(value: unknown): ManifestEntry[] {
  return Array.isArray(value)
    ? (value as ManifestEntry[])
        .filter((entry) => entry.hidden !== true)
        .toSorted(
          (left, right) =>
            numberValue(left.priority, 999) - numberValue(right.priority, 999) ||
            stringValue(left.id).localeCompare(stringValue(right.id), 'en')
        )
    : []
}

export class DungeonRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()
  private readonly optionalJson = new Map<string, Promise<unknown | null>>()
  private readonly sceneRuntimes = new Map<string, Promise<DungeonSceneRuntime>>()
  private readonly maps = new Map<string, Promise<unknown>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(signal?: AbortSignal): Promise<DungeonCatalog> {
    const tables = await this.loadTables(CATALOG_TABLES, signal)
    return buildDungeonCatalog(tables)
  }

  async detail(id: string, signal?: AbortSignal): Promise<DungeonSeriesDetail | null> {
    const [tables, mapValue] = await Promise.all([
      this.loadTables(DETAIL_TABLES, signal),
      this.loadMaps(signal)
    ])
    const series = asRecord(tables.DungeonSeriesTable?.[id])
    const dungeons = asRecord(tables.DungeonTable)
    const sceneIds = [
      ...new Set(
        (Array.isArray(series.includeDungeonIds) ? series.includeDungeonIds : [])
          .map(String)
          .map((dungeonId) => stringValue(asRecord(dungeons[dungeonId]).sceneId))
          .filter(Boolean)
      )
    ]
    const runtimeValues = await Promise.all(
      sceneIds.map(async (sceneId) => [sceneId, await this.loadSceneRuntime(sceneId, signal)] as const)
    )
    const runtimes = Object.fromEntries(runtimeValues)
    const buffIds = collectDungeonBuffIds(tables, id, runtimes)
    const buffValues = await Promise.all(
      buffIds.map(async (buffId) => [buffId, await this.loadBuff(buffId, signal)] as const)
    )
    return buildDungeonDetail(
      tables,
      id,
      runtimes,
      Object.fromEntries(
        buffValues.filter((entry): entry is readonly [string, unknown] => entry[1] !== null)
      ),
      createDungeonAttributeMaps(mapValue)
    )
  }

  private async loadTables(names: readonly string[], signal?: AbortSignal): Promise<TableSet> {
    const values = await Promise.all(
      names.map(
        async (name) => [name, await this.loadTable(name, this.client.state.selected, signal)] as const
      )
    )
    return Object.fromEntries(values) as TableSet
  }

  private loadSceneRuntime(sceneId: string, signal?: AbortSignal): Promise<DungeonSceneRuntime> {
    const state = this.client.state
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|scene:${sceneId}`
    let request = this.sceneRuntimes.get(key)
    if (!request) {
      request = (async () => {
        const spawnerRoot = `public/Json/SpawnerConfig/${sceneId}`
        const scriptRoot = `public/Json/LevelScriptData/${sceneId}`
        const [spawnerManifest, scriptManifest] = await Promise.all([
          this.loadOptionalJson(`${spawnerRoot}/manifest.json`, signal),
          this.loadOptionalJson(`${scriptRoot}/manifest.json`, signal)
        ])
        const spawnerEntries = manifestEntries(spawnerManifest)
        const scriptEntries = manifestEntries(scriptManifest)
        const [spawnerValues, scriptValues] = await Promise.all([
          Promise.all(
            spawnerEntries.map((entry) =>
              this.loadOptionalJson(
                normalizeSharedPath(
                  stringValue(entry.contentFile, `${spawnerRoot}/${stringValue(entry.id)}.json`)
                ),
                signal
              )
            )
          ),
          Promise.all(
            scriptEntries.map((entry) =>
              this.loadOptionalJson(
                normalizeSharedPath(
                  stringValue(entry.contentFile, `${scriptRoot}/${stringValue(entry.id)}.json`)
                ),
                signal
              )
            )
          )
        ])
        return {
          sceneId,
          spawnerManifestAvailable: Array.isArray(spawnerManifest),
          levelScriptManifestAvailable: Array.isArray(scriptManifest),
          missingSpawnerDetails: spawnerValues.filter((value) => value === null).length,
          missingLevelScriptDetails: scriptValues.filter((value) => value === null).length,
          spawners: spawnerValues.filter((value): value is unknown => value !== null),
          levelScripts: scriptValues.filter((value): value is unknown => value !== null)
        }
      })().catch((error: unknown) => {
        if (this.sceneRuntimes.get(key) === request) this.sceneRuntimes.delete(key)
        throw error
      })
      this.sceneRuntimes.set(key, request)
    }
    return request
  }

  private loadBuff(id: string, signal?: AbortSignal): Promise<unknown | null> {
    return this.loadOptionalJson(`public/Json/BuffData/${id}.json`, signal)
  }

  private loadOptionalJson(path: string, signal?: AbortSignal): Promise<unknown | null> {
    const state = this.client.state
    const normalized = normalizeSharedPath(path)
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|json:${normalized}`
    let request = this.optionalJson.get(key)
    if (!request) {
      request = this.client.getJson<unknown>(sharedRef(normalized), { signal }).catch((error: unknown) => {
        if (error instanceof DataClientError && error.code === 'NOT_FOUND') return null
        if (this.optionalJson.get(key) === request) this.optionalJson.delete(key)
        throw error
      })
      this.optionalJson.set(key, request)
    }
    return request
  }

  private loadMaps(signal?: AbortSignal): Promise<unknown> {
    const state = this.client.state
    const directory = LANGUAGE_INFO[state.locale].directory
    const key = `${state.baseUrl}|${state.manifest.sharedRevision}|maps:${directory}`
    let request = this.maps.get(key)
    if (!request) {
      const load = (locale: string) => this.loadOptionalJson(`public/${locale}/maps.json`, signal)
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
