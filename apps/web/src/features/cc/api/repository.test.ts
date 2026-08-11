import { describe, expect, it } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { R2ObjectRef } from '@ake/r2-contract'
import type { CcCatalogEntry } from '../model'
import { CcRepository } from './repository'

function state() {
  return {
    baseUrl: 'https://data.example.test',
    locale: 'CH' as const,
    selected: {
      id: '1.0.0',
      gameVersion: '1.0.0',
      hotfixVersion: '0',
      tableCfgPath: 'public/TableCfg',
      publishedAt: '2026-01-01T00:00:00Z'
    },
    manifest: { sharedRevision: 'cc-tests' }
  }
}

function entry(): CcCatalogEntry {
  return {
    id: 'game_cc',
    activityId: 'activity_cc',
    name: 'Contract',
    imageId: '',
    openTime: '',
    closeTime: '',
    status: 'permanent',
    statusOrder: 3,
    dungeonName: 'Dungeon',
    dungeonSeriesId: 'series_cc',
    groupCount: 0,
    termCount: 0,
    hidden: false,
    searchText: 'contract game_cc activity_cc'
  }
}

describe('CcRepository error and optional-resource contracts', () => {
  it('tolerates only explicit 404s for optional combat resources', async () => {
    const client = {
      state: state(),
      getTable(name: string) {
        if (name.startsWith('I18nTextTable_')) return Promise.resolve({})
        if (
          [
            'DungeonTable',
            'DungeonSeriesTable',
            'EnemyTable',
            'EnemyTemplateDisplayInfoTable',
            'EnemyAttributeTemplateTable'
          ].includes(name)
        ) {
          return Promise.reject(new DataClientError('optional missing', 'NOT_FOUND', name, 404))
        }
        return Promise.resolve({})
      },
      getJson(ref: R2ObjectRef) {
        return Promise.reject(new DataClientError('optional missing', 'NOT_FOUND', ref.path, 404))
      }
    } as unknown as R2DataClient

    const repository = new CcRepository(client)

    await expect(repository.catalog()).resolves.toEqual({ entries: [] })
    await expect(repository.detail(entry())).resolves.toMatchObject({
      entry: { id: 'game_cc' },
      groups: [],
      combat: { stages: [] }
    })
  })

  it('does not hide required-table 404s', async () => {
    const client = {
      state: state(),
      getTable(name: string) {
        if (name === 'ActivityContingencyContractTable') {
          return Promise.reject(new DataClientError('required missing', 'NOT_FOUND', name, 404))
        }
        return Promise.resolve({})
      },
      getJson() {
        return Promise.resolve({})
      }
    } as unknown as R2DataClient

    await expect(new CcRepository(client).catalog()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('evicts transient table and JSON failures so retries can recover', async () => {
    let activityAttempts = 0
    let mapAttempts = 0
    const client = {
      state: state(),
      getTable(name: string) {
        if (name.startsWith('I18nTextTable_')) return Promise.resolve({})
        if (name === 'ActivityTable') {
          activityAttempts += 1
          if (activityAttempts === 1) {
            return Promise.reject(new DataClientError('temporary table failure', 'HTTP', name, 503))
          }
        }
        if (name === 'DungeonTable') return Promise.resolve({ game_cc: { sceneId: 'scene_cc' } })
        return Promise.resolve({})
      },
      getJson(ref: R2ObjectRef) {
        if (ref.path.endsWith('/maps.json')) {
          mapAttempts += 1
          if (mapAttempts === 1) {
            return Promise.reject(new DataClientError('temporary map failure', 'NETWORK', ref.path))
          }
          return Promise.resolve({ ATTR_MAP: {}, ATTR_MAP_EN: {} })
        }
        return Promise.reject(new DataClientError('optional missing', 'NOT_FOUND', ref.path, 404))
      }
    } as unknown as R2DataClient
    const repository = new CcRepository(client)

    await expect(repository.catalog()).rejects.toMatchObject({ code: 'HTTP' })
    await expect(repository.catalog()).resolves.toEqual({ entries: [] })
    expect(activityAttempts).toBe(2)

    await expect(repository.detail(entry())).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.detail(entry())).resolves.toMatchObject({ entry: { id: 'game_cc' } })
    expect(mapAttempts).toBe(2)
  })
})
