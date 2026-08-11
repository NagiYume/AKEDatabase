import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { R2DataClient } from '@ake/data-client'
import type { R2Manifest, R2ObjectRef, R2VersionEntry } from '@ake/r2-contract'
import { CombatRepository } from './repository'

vi.mock('../../../shared/workers/data-worker-client', () => ({
  dataWorker: {
    parseJson: vi.fn(async (text: string) => JSON.parse(text) as unknown)
  }
}))

const VERSION_A: R2VersionEntry = {
  id: '1.2.0-h1',
  gameVersion: '1.2.0',
  hotfixVersion: '1',
  tableCfgPath: 'TableCfg/1.2.0-h1',
  publishedAt: '2026-08-01T00:00:00Z'
}

const VERSION_B: R2VersionEntry = {
  id: '1.3.0-h2',
  gameVersion: '1.3.0',
  hotfixVersion: '2',
  tableCfgPath: 'TableCfg/1.3.0-h2',
  publishedAt: '2026-08-10T00:00:00Z'
}

interface FakeClient {
  readonly client: R2DataClient
  readonly getText: ReturnType<typeof vi.fn>
  setDataVersion(version: R2VersionEntry, sharedRevision?: string): void
}

function fakeClient(getText: ReturnType<typeof vi.fn>): FakeClient {
  let selected = VERSION_A
  let sharedRevision = 'shared-a'
  const manifest = (): R2Manifest => ({
    schemaVersion: 1,
    latest: selected.id,
    sharedRevision,
    updatedAt: '2026-08-11T00:00:00Z',
    versions: [VERSION_A, VERSION_B]
  })
  const client = {
    get state() {
      return {
        baseUrl: 'https://data.example.test',
        manifestPath: '/manifest.json',
        manifest: manifest(),
        selection: selected.id,
        selected,
        locale: 'EN',
        source: 'network'
      }
    },
    createCacheKey(ref: R2ObjectRef) {
      return [
        'https://data.example.test',
        `${selected.id}:${selected.tableCfgPath}`,
        sharedRevision,
        'EN',
        ref.kind,
        ref.path
      ].join('|')
    },
    getText
  } as unknown as R2DataClient
  return {
    client,
    getText,
    setDataVersion(version, revision = sharedRevision) {
      selected = version
      sharedRevision = revision
    }
  }
}

describe('CombatRepository caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isolates manifest promises by the complete client data cache key', async () => {
    const fixture = fakeClient(
      vi.fn(async () => JSON.stringify([{ id: `skill_${fixture.client.state.selected.id}`, priority: 1 }]))
    )
    const repository = new CombatRepository(fixture.client)

    await expect(repository.manifest('skill')).resolves.toEqual([
      expect.objectContaining({ id: 'skill_1.2.0-h1' })
    ])
    fixture.setDataVersion(VERSION_B, 'shared-b')
    await expect(repository.manifest('skill')).resolves.toEqual([
      expect.objectContaining({ id: 'skill_1.3.0-h2' })
    ])
    await repository.manifest('skill')

    expect(fixture.getText).toHaveBeenCalledTimes(2)
  })

  it('removes a rejected manifest promise so the same data key can retry', async () => {
    const error = new Error('manifest unavailable')
    const fixture = fakeClient(
      vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(JSON.stringify([{ id: 'skill_retry' }]))
    )
    const repository = new CombatRepository(fixture.client)

    await expect(repository.manifest('skill')).rejects.toBe(error)
    await expect(repository.manifest('skill')).resolves.toEqual([
      expect.objectContaining({ id: 'skill_retry' })
    ])

    expect(fixture.getText).toHaveBeenCalledTimes(2)
  })

  it('isolates skill patch promises by data key and reuses only the matching version', async () => {
    const fixture = fakeClient(
      vi.fn(async () =>
        JSON.stringify({
          skill_test: {
            SkillPatchDataBundle: [{ level: fixture.client.state.selected === VERSION_A ? 1 : 2 }]
          }
        })
      )
    )
    const repository = new CombatRepository(fixture.client)

    await expect(repository.skillPatchSummaries('skill_test')).resolves.toEqual([
      expect.objectContaining({ level: 1 })
    ])
    fixture.setDataVersion(VERSION_B, 'shared-b')
    await expect(repository.skillPatchSummaries('skill_test')).resolves.toEqual([
      expect.objectContaining({ level: 2 })
    ])
    await repository.skillPatchSummaries('skill_test')

    expect(fixture.getText).toHaveBeenCalledTimes(2)
  })

  it('removes a rejected skill patch promise so the same data key can retry', async () => {
    const error = new Error('patch table unavailable')
    const fixture = fakeClient(
      vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(JSON.stringify({ skill_retry: { SkillPatchDataBundle: [{ level: 10 }] } }))
    )
    const repository = new CombatRepository(fixture.client)

    await expect(repository.skillPatchSummaries('skill_retry')).rejects.toBe(error)
    await expect(repository.skillPatchSummaries('skill_retry')).resolves.toEqual([
      expect.objectContaining({ level: 10 })
    ])

    expect(fixture.getText).toHaveBeenCalledTimes(2)
  })
})
