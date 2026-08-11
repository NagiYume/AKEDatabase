import { hydrateTextReferences, type RawTable, type TableSet } from '@ake/domain'
import { LANGUAGE_INFO, sharedRef, type R2VersionEntry } from '@ake/r2-contract'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import {
  buildMissionCatalog,
  buildMissionDetail,
  type MissionCatalog,
  type MissionDetail,
  type MissionIndexEntry
} from '../model'

const CORE_TABLES = ['MissionTypeInfoTable', 'TextTable'] as const
const DETAIL_TABLES = [
  'TextTable',
  'RewardTable',
  'ItemTable',
  'LevelDescTable',
  'CharacterTable',
  'MissionExtraInfoTable',
  'DialogTextTable',
  'DialogOptionTable',
  'DialogSummaryTable',
  'SNSDialogTable',
  'SNSDialogOptionTable',
  'SNSChatTable',
  'NpcTable'
] as const

const repositories = new WeakMap<R2DataClient, MissionRepository>()

export function getMissionRepository(client: R2DataClient): MissionRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new MissionRepository(client)
  repositories.set(client, repository)
  return repository
}

export class MissionRepository {
  private readonly tables = new Map<string, Promise<RawTable>>()
  private readonly translations = new Map<string, Promise<Record<string, string>>>()

  constructor(private readonly client: R2DataClient) {}

  async catalog(signal?: AbortSignal): Promise<MissionCatalog> {
    const [manifest, tables] = await Promise.all([
      this.client.getJson<unknown>(sharedRef('public/Json/MissionRuntimeAsset/manifest.json'), { signal }),
      this.loadTables(CORE_TABLES, this.client.state.selected, signal)
    ])
    return buildMissionCatalog(manifest, tables.MissionTypeInfoTable ?? {}, tables.TextTable ?? {})
  }

  async detail(entry: MissionIndexEntry, signal?: AbortSignal): Promise<MissionDetail> {
    const [mission, meta, tables] = await Promise.all([
      this.client.getJson<unknown>(sharedRef(entry.contentFile), { signal }),
      entry.metaContentFile
        ? this.client
            .getJson<unknown>(sharedRef(entry.metaContentFile), { signal })
            .catch((error: unknown) => {
              if (error instanceof DataClientError && error.code === 'NOT_FOUND') return null
              throw error
            })
        : Promise.resolve(null),
      this.loadTables(DETAIL_TABLES, this.client.state.selected, signal)
    ])
    return buildMissionDetail(entry, mission, meta, tables)
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
