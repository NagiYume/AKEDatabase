import { describe, expect, it, vi } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import { CATALOG_DEFINITIONS } from '@ake/domain'
import { CatalogRepository } from './repository'

vi.mock('../../../shared/workers/data-worker-client', () => ({
  dataWorker: {
    parseJson: vi.fn(async (text: string) => JSON.parse(text) as unknown)
  }
}))

const VERSION = {
  id: '1.2.9-h1',
  gameVersion: '1.2.9',
  hotfixVersion: 'h1',
  tableCfgPath: 'versions/1.2.9-h1/TableCfg',
  publishedAt: '2026-08-11T00:00:00Z'
}

const TABLE_PAYLOADS: Readonly<Record<string, string>> = {
  'public/TableCfg/WeaponBasicTable.json': JSON.stringify({
    weapon_a: { weaponId: 'weapon_a', rarity: 5, weaponType: 2, levelTemplateId: 'curve_a' }
  }),
  'public/TableCfg/ItemTable.json': JSON.stringify({
    weapon_a: { name: { id: 'weapon-name', text: '' }, iconId: 'weapon_a' }
  })
}

function fakeClient(
  getText: (path: string) => Promise<string>,
  getJson: (path: string) => Promise<unknown>
): R2DataClient {
  return {
    state: {
      baseUrl: 'https://data.example.test',
      locale: 'EN',
      selected: VERSION,
      selection: 'latest',
      manifest: { sharedRevision: 'shared-1' }
    },
    createCacheKey: (ref: { path: string }) => ref.path,
    getText: (ref: { path: string }) => getText(ref.path),
    getJson: (ref: { path: string }) => getJson(ref.path)
  } as unknown as R2DataClient
}

function tableOrEmpty(path: string): string {
  return TABLE_PAYLOADS[path] ?? '{}'
}

describe('CatalogRepository recoverable locale caches', () => {
  it('evicts a transient maps failure and caches the successful retry', async () => {
    let mapAttempts = 0
    const client = fakeClient(
      async (path) => tableOrEmpty(path),
      async () => {
        mapAttempts += 1
        if (mapAttempts === 1) throw new DataClientError('offline', 'NETWORK')
        return { weapon_map: { '2': 'Sword' } }
      }
    )
    const repository = new CatalogRepository(client)

    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).resolves.toEqual([
      expect.objectContaining({ id: 'weapon_a', categoryLabel: 'Sword' })
    ])
    await repository.list(CATALOG_DEFINITIONS.v3_weapon)

    expect(mapAttempts).toBe(2)
  })

  it('retries a transient localized text failure while retaining the CN fallback merge', async () => {
    let englishAttempts = 0
    const client = fakeClient(
      async (path) => {
        if (path.endsWith('I18nTextTable_CN.json')) return JSON.stringify({ 'weapon-name': '中文名' })
        if (path.endsWith('I18nTextTable_EN.json')) {
          englishAttempts += 1
          if (englishAttempts === 1) throw new DataClientError('temporary outage', 'NETWORK')
          return JSON.stringify({ 'weapon-name': 'English Name' })
        }
        return tableOrEmpty(path)
      },
      async () => ({})
    )
    const repository = new CatalogRepository(client)

    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).resolves.toEqual([
      expect.objectContaining({ id: 'weapon_a', name: 'English Name' })
    ])
    await repository.list(CATALOG_DEFINITIONS.v3_weapon)

    expect(englishAttempts).toBe(2)
  })

  it('treats a missing localized table as empty and uses the cached CN fallback', async () => {
    let englishAttempts = 0
    const client = fakeClient(
      async (path) => {
        if (path.endsWith('I18nTextTable_CN.json')) return JSON.stringify({ 'weapon-name': '中文名' })
        if (path.endsWith('I18nTextTable_EN.json')) {
          englishAttempts += 1
          throw new DataClientError('HTTP 404', 'NOT_FOUND', path, 404)
        }
        return tableOrEmpty(path)
      },
      async () => ({})
    )
    const repository = new CatalogRepository(client)

    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).resolves.toEqual([
      expect.objectContaining({ id: 'weapon_a', name: '中文名' })
    ])
    await repository.list(CATALOG_DEFINITIONS.v3_weapon)

    expect(englishAttempts).toBe(1)
  })

  it('does not infer missing data from an ordinary 404-looking error and retries the table', async () => {
    let tableAttempts = 0
    const client = fakeClient(
      async (path) => {
        if (path.endsWith('WeaponBasicTable.json')) {
          tableAttempts += 1
          if (tableAttempts === 1) throw new Error('HTTP 404 from an upstream proxy')
        }
        return tableOrEmpty(path)
      },
      async () => ({})
    )
    const repository = new CatalogRepository(client)

    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).rejects.toThrow(
      'HTTP 404 from an upstream proxy'
    )
    await expect(repository.list(CATALOG_DEFINITIONS.v3_weapon)).resolves.toEqual([
      expect.objectContaining({ id: 'weapon_a' })
    ])
    expect(tableAttempts).toBe(2)
  })
})
