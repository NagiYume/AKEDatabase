import { describe, expect, it, vi } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { RawTable } from '@ake/domain'
import type { R2ObjectRef, R2VersionEntry } from '@ake/r2-contract'
import type { MissionIndexEntry } from '../model'
import { MissionRepository } from './repository'

const VERSION: R2VersionEntry = {
  id: '1.2.0-h1',
  gameVersion: '1.2.0',
  hotfixVersion: '1',
  tableCfgPath: 'TableCfg/1.2.0-h1',
  publishedAt: '2026-08-01T00:00:00Z'
}

describe('MissionRepository locale fallback', () => {
  it('uses the Chinese base text when the selected locale entry is empty', async () => {
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { mission_name: '中文任务名' }
      if (name === 'I18nTextTable_EN') return { mission_name: '' }
      if (name === 'TextTable') return { mission_name: { text: { id: 'mission_name', text: '' } } }
      return {}
    })
    const getJson = vi.fn(async () => [
      {
        id: 'mission-1',
        contentFile: '/mission-1.json',
        missionName: { key: 'mission_name' },
        missionType: 'Main',
        missionChapterBitmask: 'None',
        missionImportance: 'High'
      }
    ])
    const client = {
      state: {
        baseUrl: 'https://data.example.test',
        selected: VERSION,
        locale: 'EN'
      },
      getTable,
      getJson
    } as unknown as R2DataClient

    const catalog = await new MissionRepository(client).catalog()

    expect(catalog.entries[0]?.name).toBe('中文任务名')
    expect(getTable).toHaveBeenCalledWith('I18nTextTable_CN', expect.anything(), VERSION)
    expect(getTable).toHaveBeenCalledWith('I18nTextTable_EN', expect.anything(), VERSION)
  })

  it('evicts transient translation and dependent table failures before retrying', async () => {
    let englishAttempts = 0
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { mission_name: '中文任务名' }
      if (name === 'I18nTextTable_EN') {
        englishAttempts += 1
        if (englishAttempts === 1) throw new DataClientError('translation timeout', 'NETWORK', name)
        return { mission_name: 'English mission' }
      }
      if (name === 'TextTable') return { mission_name: { text: { id: 'mission_name', text: '' } } }
      return {}
    })
    const getJson = vi.fn(async () => [
      {
        id: 'mission-1',
        contentFile: '/mission-1.json',
        missionName: { key: 'mission_name' },
        missionType: 'Main',
        missionChapterBitmask: 'None',
        missionImportance: 'High'
      }
    ])
    const client = {
      state: { baseUrl: 'https://data.example.test', selected: VERSION, locale: 'EN' },
      getTable,
      getJson
    } as unknown as R2DataClient
    const repository = new MissionRepository(client)

    await expect(repository.catalog()).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.catalog()).resolves.toMatchObject({
      entries: [expect.objectContaining({ name: 'English mission' })]
    })

    expect(englishAttempts).toBe(2)
    expect(getTable.mock.calls.filter(([name]) => name === 'TextTable')).toHaveLength(2)
  })

  it('degrades only typed missing tables and translations to the Chinese fallback', async () => {
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { mission_name: '中文任务名' }
      if (name === 'I18nTextTable_EN' || name === 'MissionTypeInfoTable') {
        throw new DataClientError('missing table', 'NOT_FOUND', name, 404)
      }
      if (name === 'TextTable') return { mission_name: { text: { id: 'mission_name', text: '' } } }
      return {}
    })
    const getJson = vi.fn(async () => [
      {
        id: 'mission-1',
        contentFile: '/mission-1.json',
        missionName: { key: 'mission_name' },
        missionType: 'Main',
        missionChapterBitmask: 'None',
        missionImportance: 'High'
      }
    ])
    const client = {
      state: { baseUrl: 'https://data.example.test', selected: VERSION, locale: 'EN' },
      getTable,
      getJson
    } as unknown as R2DataClient

    await expect(new MissionRepository(client).catalog()).resolves.toMatchObject({
      entries: [expect.objectContaining({ name: '中文任务名' })]
    })
  })

  it('rethrows transient mission metadata failures, retries, then tolerates typed missing metadata', async () => {
    const entry: MissionIndexEntry = {
      id: 'mission-1',
      name: 'Mission',
      contentFile: 'public/missions/mission-1.json',
      metaContentFile: 'public/missions/mission-1-meta.json',
      type: 'Main',
      typeValue: 0,
      chapter: 'None',
      chapterValue: 0,
      importance: 'High',
      importanceValue: 1,
      questCount: 0,
      objectiveCount: 0,
      priority: 0,
      hidden: false,
      searchText: 'mission'
    }
    let metaAttempts = 0
    const getJson = vi.fn(async (ref: R2ObjectRef) => {
      if (ref.path.endsWith('mission-1-meta.json')) {
        metaAttempts += 1
        if (metaAttempts === 1) {
          throw new DataClientError('metadata service unavailable', 'HTTP', ref.path, 503)
        }
        throw new DataClientError('metadata missing', 'NOT_FOUND', ref.path, 404)
      }
      return {}
    })
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name.startsWith('I18nTextTable_')) return {}
      return {}
    })
    const client = {
      state: { baseUrl: 'https://data.example.test', selected: VERSION, locale: 'CH' },
      getTable,
      getJson
    } as unknown as R2DataClient
    const repository = new MissionRepository(client)

    await expect(repository.detail(entry)).rejects.toMatchObject({ code: 'HTTP', status: 503 })
    await expect(repository.detail(entry)).resolves.toMatchObject({ entry, acceptMode: '' })
    expect(metaAttempts).toBe(2)
  })
})
