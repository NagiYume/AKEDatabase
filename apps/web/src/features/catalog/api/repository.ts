import { DataClientError, findComparisonVersion, type R2DataClient } from '@ake/data-client'
import {
  buildCatalogEntries,
  buildDetailBundle,
  deepDiff,
  deriveCatalogLevelSnapshot,
  hydrateTextReferences,
  stableStringify,
  type CatalogDefinition,
  type CatalogEntry,
  type CatalogLevelSnapshot,
  type FieldDiff,
  type LocaleMaps,
  type RawTable,
  type TableSet
} from '@ake/domain'
import { LANGUAGE_INFO, tableRef, type R2VersionEntry } from '@ake/r2-contract'
import { dataWorker } from '../../../shared/workers/data-worker-client'

export interface CatalogDetail {
  current: TableSet
  baseline: TableSet | null
  differences: readonly FieldDiff[]
  levelSnapshot: CatalogLevelSnapshot | null
  maps: LocaleMaps
}

const repositories = new WeakMap<R2DataClient, CatalogRepository>()

function isMissingData(error: unknown): boolean {
  return error instanceof DataClientError && error.code === 'NOT_FOUND'
}

export function getCatalogRepository(client: R2DataClient): CatalogRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new CatalogRepository(client)
  repositories.set(client, repository)
  return repository
}

export class CatalogRepository {
  private readonly parsedTables = new Map<string, Promise<RawTable>>()
  private readonly textTables = new Map<string, Promise<Record<string, string>>>()
  private readonly localeMaps = new Map<string, Promise<LocaleMaps>>()

  constructor(private readonly client: R2DataClient) {}

  async list(definition: CatalogDefinition, signal?: AbortSignal): Promise<CatalogEntry[]> {
    const [tables, maps] = await Promise.all([
      this.loadTables(definition.listTables, this.client.state.selected, signal),
      this.loadMaps(signal)
    ])
    return buildCatalogEntries(definition, tables, maps)
  }

  async listWithVersionChanges(definition: CatalogDefinition, signal?: AbortSignal): Promise<CatalogEntry[]> {
    const current = await this.list(definition, signal)
    const baselineVersion = findComparisonVersion(this.client.state.manifest, this.client.state.selected)
    if (!baselineVersion || this.client.state.selection !== 'latest') return current
    const baselineTables = await this.loadTables(definition.listTables, baselineVersion, signal)
    const maps = await this.loadMaps(signal)
    const baseline = new Map(
      buildCatalogEntries(definition, baselineTables, maps).map((entry) => [entry.id, entry])
    )
    return current.map((entry) => {
      const previous = baseline.get(entry.id)
      if (!previous) return { ...entry, changeType: 'added' }
      return stableStringify(entry.source) === stableStringify(previous.source)
        ? entry
        : { ...entry, changeType: 'modified' }
    })
  }

  async detail(
    definition: CatalogDefinition,
    id: string,
    level: number | null,
    compare: boolean,
    signal?: AbortSignal
  ): Promise<CatalogDetail> {
    const [tables, maps] = await Promise.all([
      this.loadTables(definition.detailTables, this.client.state.selected, signal),
      this.loadMaps(signal)
    ])
    const current = buildDetailBundle(definition, id, tables)
    const levelSnapshot =
      level === null ? null : deriveCatalogLevelSnapshot(definition, id, tables, level, maps)
    if (!compare || this.client.state.selection !== 'latest') {
      return { current, baseline: null, differences: [], levelSnapshot, maps }
    }
    const baselineVersion = findComparisonVersion(this.client.state.manifest, this.client.state.selected)
    if (!baselineVersion) return { current, baseline: null, differences: [], levelSnapshot, maps }
    const baselineTables = await this.loadTables(definition.detailTables, baselineVersion, signal)
    const baseline = buildDetailBundle(definition, id, baselineTables)
    return {
      current,
      baseline,
      differences: deepDiff(baseline, current).slice(0, 2_000),
      levelSnapshot,
      maps
    }
  }

  private async loadTables(
    names: readonly string[],
    version: R2VersionEntry,
    signal?: AbortSignal
  ): Promise<TableSet> {
    const pairs = await Promise.all(
      names.map(async (name) => [name, await this.loadTable(name, version, signal)] as const)
    )
    return Object.fromEntries(pairs)
  }

  private loadTable(name: string, version: R2VersionEntry, signal?: AbortSignal): Promise<RawTable> {
    const ref = tableRef(name)
    const key = this.client.createCacheKey(ref, version)
    let request = this.parsedTables.get(key)
    if (!request) {
      request = Promise.all([this.client.getText(ref, { signal }, version), this.loadTexts(version, signal)])
        .then(async ([text, translations]) =>
          hydrateTextReferences(await dataWorker.parseJson<RawTable>(text, signal), translations)
        )
        .catch((error: unknown) => {
          if (this.parsedTables.get(key) === request) this.parsedTables.delete(key)
          if (isMissingData(error)) return {}
          throw error
        })
      this.parsedTables.set(key, request)
    }
    return request
  }

  private loadTexts(version: R2VersionEntry, signal?: AbortSignal): Promise<Record<string, string>> {
    const suffix = LANGUAGE_INFO[this.client.state.locale].table
    const key = `${this.client.state.baseUrl}|${version.id}|texts:${suffix}`
    let request = this.textTables.get(key)
    if (!request) {
      const load = async (localeSuffix: string) => {
        try {
          const ref = tableRef(`I18nTextTable_${localeSuffix}`)
          return await dataWorker.parseJson<Record<string, string>>(
            await this.client.getText(ref, { signal }, version),
            signal
          )
        } catch (error) {
          if (isMissingData(error)) return {}
          throw error
        }
      }
      request =
        suffix === 'CN'
          ? load('CN')
          : Promise.all([load('CN'), load(suffix)]).then(([chinese, current]) => ({
              ...chinese,
              ...Object.fromEntries(Object.entries(current).filter(([, value]) => value !== ''))
            }))
      request = request.catch((error: unknown) => {
        if (this.textTables.get(key) === request) this.textTables.delete(key)
        throw error
      })
      this.textTables.set(key, request)
    }
    return request
  }

  private loadMaps(signal?: AbortSignal): Promise<LocaleMaps> {
    const locale = this.client.state.locale
    const key = `${this.client.state.baseUrl}|maps:${locale}`
    let request = this.localeMaps.get(key)
    if (!request) {
      request = this.client
        .getJson<LocaleMaps>(
          { kind: 'locale', path: `public/${LANGUAGE_INFO[locale].directory}/maps.json` },
          { signal }
        )
        .catch((error: unknown) => {
          if (isMissingData(error)) return {}
          if (this.localeMaps.get(key) === request) this.localeMaps.delete(key)
          throw error
        })
      this.localeMaps.set(key, request)
    }
    return request
  }
}
