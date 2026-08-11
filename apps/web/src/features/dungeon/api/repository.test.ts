import { describe, expect, it, vi } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { R2Manifest, R2ObjectRef, R2VersionEntry } from '@ake/r2-contract'
import { DungeonRepository } from './repository'

const VERSION: R2VersionEntry = {
  id: '1.4.4-test',
  gameVersion: '1.4.4',
  hotfixVersion: 'test',
  tableCfgPath: 'public/test/TableCfg',
  publishedAt: '2026-08-11T00:00:00Z'
}

const MANIFEST: R2Manifest = {
  schemaVersion: 1,
  latest: VERSION.id,
  sharedRevision: 'dungeon-test',
  updatedAt: '2026-08-11T00:00:00Z',
  versions: [VERSION]
}

const TABLES: Readonly<Record<string, unknown>> = {
  DungeonSeriesTable: {
    series_test: {
      name: 'Test series',
      gameCategory: 'dungeon_resource',
      includeDungeonIds: ['stage_test']
    }
  },
  DungeonTable: {
    stage_test: { dungeonName: 'Test stage', sceneId: 'scene_test', enemyIds: [] }
  }
}

function fakeClient(getJson: ReturnType<typeof vi.fn>): R2DataClient {
  return {
    get state() {
      return {
        baseUrl: 'https://data.example.test',
        manifestPath: '/manifest.json',
        manifest: MANIFEST,
        selection: VERSION.id,
        selected: VERSION,
        locale: 'EN',
        source: 'network'
      }
    },
    getTable: vi.fn(async (name: string) => TABLES[name] ?? {}),
    getJson
  } as unknown as R2DataClient
}

describe('DungeonRepository optional runtime data', () => {
  it('keeps 404 manifests as typed missing state but retries a transient scene failure', async () => {
    let spawnerAttempts = 0
    const getJson = vi.fn(async (ref: R2ObjectRef) => {
      if (ref.path.endsWith('public/EN/maps.json')) return {}
      if (ref.path.endsWith('public/Json/LevelScriptData/scene_test/manifest.json')) {
        throw new DataClientError('missing', 'NOT_FOUND', ref.path, 404)
      }
      if (ref.path.endsWith('public/Json/SpawnerConfig/scene_test/manifest.json')) {
        spawnerAttempts += 1
        if (spawnerAttempts === 1) throw new DataClientError('temporary', 'NETWORK', ref.path)
        return []
      }
      return {}
    })
    const repository = new DungeonRepository(fakeClient(getJson))

    await expect(repository.detail('series_test')).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.detail('series_test')).resolves.toMatchObject({
      dungeons: [
        expect.objectContaining({
          runtime: expect.objectContaining({
            spawnerManifestAvailable: true,
            levelScriptManifestAvailable: false
          })
        })
      ]
    })
    expect(spawnerAttempts).toBe(2)
  })
})
