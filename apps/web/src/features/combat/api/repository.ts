import { DataClientError, type R2DataClient } from '@ake/data-client'
import { hydrateTextReferences, type RawTable } from '@ake/domain'
import { LANGUAGE_INFO, sharedRef, tableRef, type R2VersionEntry } from '@ake/r2-contract'
import type { CombatDomain } from '@ake/combat-graph'
import { dataWorker } from '../../../shared/workers/data-worker-client'

export interface CombatManifestEntry {
  id: string
  name: string
  contentFile: string
  hidden: boolean
  priority: number
  category: string
  searchText: string
}

export interface SkillPatchSummary {
  level: number
  coolDown: unknown
  costType: unknown
  costValue: unknown
  maxChargeTime: unknown
  iconId: string
  blackboard: unknown
}

export interface CombatDirectoryTables {
  characters: Readonly<Record<string, unknown>>
  growth: Readonly<Record<string, unknown>>
  enemyDisplay: Readonly<Record<string, unknown>>
  enemies: Readonly<Record<string, unknown>>
}

interface RawManifestEntry {
  id?: unknown
  name?: unknown
  contentFile?: unknown
  hidden?: unknown
  priority?: unknown
}

const repositories = new WeakMap<R2DataClient, CombatRepository>()

export function getCombatRepository(client: R2DataClient): CombatRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new CombatRepository(client)
  repositories.set(client, repository)
  return repository
}

function inferCategory(domain: CombatDomain, id: string): string {
  if (/^(?:chr|char)_/i.test(id)) return 'characters'
  if (/^(?:eny|enemy|monster)_/i.test(id)) return 'monsters'
  if (/^(?:wpn|weapon)_/i.test(id)) return 'weapons'
  if (/^(?:equip|suit)_/i.test(id)) return 'equipment'
  if (/^(?:dungeon|mode|rpg|rogue|raid|activity|level|stage)_/i.test(id)) return 'modes'
  if (/^(?:abilityentity|ability_entity)_/i.test(id)) return 'abilityEntities'
  return domain === 'buff' && id.includes('common') ? 'common' : 'other'
}

export class CombatRepository {
  private readonly manifests = new Map<string, Promise<CombatManifestEntry[]>>()
  private readonly skillPatches = new Map<string, Promise<Record<string, unknown>>>()
  private readonly parsedTables = new Map<string, Promise<RawTable>>()
  private readonly textTables = new Map<string, Promise<Record<string, string>>>()

  constructor(private readonly client: R2DataClient) {}

  manifest(domain: CombatDomain, signal?: AbortSignal): Promise<CombatManifestEntry[]> {
    const path = `/public/Json/${domain === 'skill' ? 'SkillData' : 'BuffData'}/manifest.json`
    const key = this.client.createCacheKey(sharedRef(path))
    let request = this.manifests.get(key)
    if (!request) {
      request = this.client
        .getText(sharedRef(path), { signal })
        .then(async (text) => {
          const raw = await dataWorker.parseJson<RawManifestEntry[]>(text, signal)
          return raw
            .map((entry, index) => {
              const id = String(entry.id ?? '')
              const name = String(entry.name ?? id)
              return {
                id,
                name,
                contentFile: String(
                  entry.contentFile ??
                    `/public/Json/${domain === 'skill' ? 'SkillData' : 'BuffData'}/${id}.json`
                ),
                hidden: entry.hidden === true,
                priority: Number(entry.priority ?? index + 1),
                category: inferCategory(domain, id),
                searchText: `${id}\n${name}\n${inferCategory(domain, id)}`.toLocaleLowerCase()
              }
            })
            .filter((entry) => entry.id)
            .toSorted(
              (left, right) => left.priority - right.priority || left.id.localeCompare(right.id, 'en')
            )
        })
        .catch((error: unknown) => {
          this.manifests.delete(key)
          throw error
        })
      this.manifests.set(key, request)
    }
    return request
  }

  async raw(entry: CombatManifestEntry, signal?: AbortSignal): Promise<{ text: string; value: unknown }> {
    const ref = sharedRef(entry.contentFile)
    const text = await this.client.getText(ref, { signal })
    return { text, value: await dataWorker.parseJson(text, signal) }
  }

  async directoryTables(signal?: AbortSignal): Promise<CombatDirectoryTables> {
    const version = this.client.state.selected
    const [characters, growth, enemyDisplay, enemies] = await Promise.all([
      this.loadDirectoryTable('CharacterTable', version, signal),
      this.loadDirectoryTable('CharGrowthTable', version, signal),
      this.loadDirectoryTable('EnemyTemplateDisplayInfoTable', version, signal),
      this.loadDirectoryTable('EnemyTable', version, signal)
    ])
    return { characters, growth, enemyDisplay, enemies }
  }

  async skillPatchSummaries(skillId: string, signal?: AbortSignal): Promise<SkillPatchSummary[]> {
    const ref = tableRef('SkillPatchTable')
    const key = this.client.createCacheKey(ref)
    let request = this.skillPatches.get(key)
    if (!request) {
      request = this.client
        .getText(ref, { signal })
        .then((text) => dataWorker.parseJson<Record<string, unknown>>(text, signal))
        .catch((error: unknown) => {
          this.skillPatches.delete(key)
          throw error
        })
      this.skillPatches.set(key, request)
    }
    const table = await request
    const row = table[skillId] as { SkillPatchDataBundle?: unknown[] } | undefined
    return (row?.SkillPatchDataBundle ?? [])
      .map((patch) => patch as Record<string, unknown>)
      .map((patch) => ({
        level: Number(patch.level ?? 0),
        coolDown: patch.coolDown,
        costType: patch.costType,
        costValue: patch.costValue,
        maxChargeTime: patch.maxChargeTime,
        iconId: String(patch.iconId ?? ''),
        blackboard: patch.blackboard
      }))
      .filter((patch) => Number.isFinite(patch.level))
      .toSorted((left, right) => left.level - right.level)
  }

  private loadDirectoryTable(name: string, version: R2VersionEntry, signal?: AbortSignal): Promise<RawTable> {
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
          if (error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
          throw error
        })
      this.parsedTables.set(key, request)
    }
    return request
  }

  private loadTexts(version: R2VersionEntry, signal?: AbortSignal): Promise<Record<string, string>> {
    const suffix = LANGUAGE_INFO[this.client.state.locale].table
    const key = `${this.client.state.baseUrl}|${version.id}|combat-texts:${suffix}`
    let request = this.textTables.get(key)
    if (!request) {
      const load = async (localeSuffix: string): Promise<Record<string, string>> => {
        try {
          const ref = tableRef(`I18nTextTable_${localeSuffix}`)
          const text = await this.client.getText(ref, { signal }, version)
          return await dataWorker.parseJson<Record<string, string>>(text, signal)
        } catch (error) {
          if (error instanceof DataClientError && error.code === 'NOT_FOUND') return {}
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
}
