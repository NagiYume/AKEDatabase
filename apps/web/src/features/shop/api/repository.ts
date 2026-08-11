import { DataClientError, type R2DataClient } from '@ake/data-client'
import { hydrateTextReferences, type RawTable, type TableSet } from '@ake/domain'
import { LANGUAGE_INFO, type R2VersionEntry } from '@ake/r2-contract'
import { buildShopCatalog, SHOP_TABLES, type ShopCatalog } from '../model'

const repositories = new WeakMap<R2DataClient, ShopRepository>()

export function getShopRepository(client: R2DataClient): ShopRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new ShopRepository(client)
  repositories.set(client, repository)
  return repository
}

export class ShopRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(
    options: { showHidden?: boolean; now?: number } = {},
    signal?: AbortSignal
  ): Promise<ShopCatalog> {
    const pairs = await Promise.all(
      SHOP_TABLES.map(
        async (name) => [name, await this.loadTable(name, this.client.state.selected, signal)] as const
      )
    )
    return buildShopCatalog(Object.fromEntries(pairs) as TableSet, options)
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
