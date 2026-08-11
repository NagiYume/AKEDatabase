import { DataClientError, findComparisonVersion, type R2DataClient } from '@ake/data-client'
import { hydrateTextReferences, type RawTable, type TableSet } from '@ake/domain'
import { LANGUAGE_INFO, tableRef, type R2VersionEntry } from '@ake/r2-contract'
import {
  ACTIVITY_TABLE_NAMES,
  buildActivityCatalog,
  compareActivityCatalog,
  type ActivityCatalog
} from '../model'

const repositories = new WeakMap<R2DataClient, ActivityRepository>()

export function getActivityRepository(client: R2DataClient): ActivityRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new ActivityRepository(client)
  repositories.set(client, repository)
  return repository
}

export class ActivityRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(includeComparison: boolean, signal?: AbortSignal): Promise<ActivityCatalog> {
    const currentVersion = this.client.state.selected
    const current = buildActivityCatalog(await this.loadTables(currentVersion, signal))
    if (!includeComparison || this.client.state.selection !== 'latest') return current

    const baselineVersion = findComparisonVersion(this.client.state.manifest, currentVersion)
    if (!baselineVersion) return current
    const baseline = buildActivityCatalog(await this.loadTables(baselineVersion, signal))
    return compareActivityCatalog(current, baseline, baselineVersion.id)
  }

  private async loadTables(version: R2VersionEntry, signal?: AbortSignal): Promise<TableSet> {
    const pairs = await Promise.all(
      ACTIVITY_TABLE_NAMES.map(async (name) => [name, await this.loadTable(name, version, signal)] as const)
    )
    return Object.fromEntries(pairs)
  }

  private loadTable(name: string, version: R2VersionEntry, signal?: AbortSignal): Promise<RawTable> {
    const ref = tableRef(name)
    const key = this.client.createCacheKey(ref, version)
    let request = this.tables.get(key)
    if (!request) {
      request = Promise.all([
        this.client.getTable<RawTable>(name, { signal }, version),
        this.loadTranslations(version, signal)
      ])
        .then(([table, translations]) => hydrateTextReferences(table, translations))
        .catch((error: unknown) => {
          this.tables.delete(key)
          if (error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
          throw error
        })
      this.tables.set(key, request)
    }
    return request
  }

  private loadTranslations(version: R2VersionEntry, signal?: AbortSignal): Promise<Record<string, string>> {
    const suffix = LANGUAGE_INFO[this.client.state.locale].table
    const key = this.client.createCacheKey(tableRef(`I18nTextTable_${suffix}`), version)
    let request = this.translations.get(key)
    if (!request) {
      const load = (localeSuffix: string) =>
        this.client
          .getTable<Record<string, string>>(`I18nTextTable_${localeSuffix}`, { signal }, version)
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
