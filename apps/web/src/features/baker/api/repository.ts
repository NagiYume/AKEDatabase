import { hydrateTextReferences, type RawTable, type TableSet } from '@ake/domain'
import { LANGUAGE_INFO, type R2VersionEntry } from '@ake/r2-contract'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import { buildBakerCatalog, type BakerCatalog } from '../model'

const TABLES = [
  'SNSChatTable',
  'SNSDialogTable',
  'SNSDialogOptionTable',
  'SNSDialogTopicTable',
  'ItemTable'
] as const
const repositories = new WeakMap<R2DataClient, BakerRepository>()

export function getBakerRepository(client: R2DataClient): BakerRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new BakerRepository(client)
  repositories.set(client, repository)
  return repository
}

export class BakerRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(signal?: AbortSignal): Promise<BakerCatalog> {
    const pairs = await Promise.all(
      TABLES.map(
        async (name) => [name, await this.loadTable(name, this.client.state.selected, signal)] as const
      )
    )
    return buildBakerCatalog(Object.fromEntries(pairs) as TableSet)
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
