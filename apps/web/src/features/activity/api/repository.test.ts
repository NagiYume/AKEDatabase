import { describe, expect, it, vi } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { RawTable } from '@ake/domain'
import type { AppLocale, R2Manifest, R2ObjectRef, R2VersionEntry } from '@ake/r2-contract'
import { ACTIVITY_TABLE_NAMES } from '../model'
import { ActivityRepository } from './repository'

const BASELINE: R2VersionEntry = {
  id: '1.1.0-h2',
  gameVersion: '1.1.0',
  hotfixVersion: '2',
  tableCfgPath: 'TableCfg/1.1.0-h2',
  publishedAt: '2026-07-01T00:00:00Z'
}

const CURRENT: R2VersionEntry = {
  id: '1.2.0-h1',
  gameVersion: '1.2.0',
  hotfixVersion: '1',
  tableCfgPath: 'TableCfg/1.2.0-h1',
  publishedAt: '2026-08-01T00:00:00Z'
}

const MANIFEST: R2Manifest = {
  schemaVersion: 1,
  latest: CURRENT.id,
  sharedRevision: 'shared-1',
  updatedAt: '2026-08-01T00:00:00Z',
  versions: [BASELINE, CURRENT]
}

function fakeClient(options: {
  locale?: AppLocale
  selection?: string
  tables?: Readonly<Record<string, Readonly<Record<string, RawTable>>>>
  tableOverride?: (name: string, version: R2VersionEntry) => RawTable | undefined
}) {
  const locale = options.locale ?? 'CH'
  const getTable = vi.fn(
    async (name: string, _request: unknown, version: R2VersionEntry = CURRENT): Promise<RawTable> => {
      const override = options.tableOverride?.(name, version)
      if (override !== undefined) return override
      if (name.startsWith('I18nTextTable_')) {
        if (name.endsWith('_CN')) return { event_name: '当前活动' }
        if (name.endsWith('_EN')) return { event_name: 'Current activity' }
      }
      return options.tables?.[version.id]?.[name] ?? {}
    }
  )
  const client = {
    state: {
      baseUrl: 'https://data.example.test',
      manifestPath: 'manifest.json',
      manifest: MANIFEST,
      selection: options.selection ?? 'latest',
      selected: CURRENT,
      locale,
      source: 'network'
    },
    createCacheKey: (ref: R2ObjectRef, version: R2VersionEntry = CURRENT) =>
      `${locale}:${version.id}:${ref.kind}:${ref.path}`,
    getTable
  } as unknown as R2DataClient
  return { client, getTable }
}

describe('ActivityRepository', () => {
  it('loads only the eight declared R2 tables and the current locale text table', async () => {
    const { client, getTable } = fakeClient({ selection: CURRENT.id })
    const catalog = await new ActivityRepository(client).catalog(true)
    const names = getTable.mock.calls.map(([name]) => name)

    expect(catalog.entries).toEqual([])
    expect(names.filter((name) => !name.startsWith('I18nTextTable_'))).toEqual(ACTIVITY_TABLE_NAMES)
    expect(names.filter((name) => name.startsWith('I18nTextTable_'))).toEqual(['I18nTextTable_CN'])
    expect(names.some((name) => name.includes('__v3') || name.includes('/activity'))).toBe(false)
  })

  it('loads the previous game version only for latest and applies localized baseline diff', async () => {
    const table = (sortId: number): RawTable => ({
      event: {
        id: 'event',
        name: { id: 'event_name', text: '' },
        sortId,
        timeId: 'event_time'
      }
    })
    const tables = {
      [CURRENT.id]: { ActivityTable: table(2) },
      [BASELINE.id]: { ActivityTable: table(1) }
    }
    const { client, getTable } = fakeClient({ locale: 'EN', tables })
    const catalog = await new ActivityRepository(client).catalog(true)
    const calls = getTable.mock.calls.map(([name, , version]) => ({ name, version: version?.id }))

    expect(catalog.comparisonVersion).toBe(BASELINE.id)
    expect(catalog.details.event).toMatchObject({ name: 'Current activity', changeType: 'modified' })
    expect(
      catalog.details.event?.differences?.some((difference) => difference.path === 'activity.sortId')
    ).toBe(true)
    expect(
      calls.filter(({ name }) => ACTIVITY_TABLE_NAMES.includes(name as (typeof ACTIVITY_TABLE_NAMES)[number]))
    ).toHaveLength(16)
    expect(calls.filter(({ name }) => name === 'I18nTextTable_CN')).toHaveLength(2)
    expect(calls.filter(({ name }) => name === 'I18nTextTable_EN')).toHaveLength(2)
    expect(new Set(calls.map(({ version }) => version))).toEqual(new Set([CURRENT.id, BASELINE.id]))
  })

  it('evicts a transiently rejected translation request so the next catalog load can retry', async () => {
    let englishAttempts = 0
    const { client } = fakeClient({
      locale: 'EN',
      selection: CURRENT.id,
      tableOverride(name) {
        if (name !== 'I18nTextTable_EN') return undefined
        englishAttempts += 1
        if (englishAttempts === 1) throw new DataClientError('temporary outage', 'NETWORK')
        return { event_name: 'Current activity' }
      }
    })
    const repository = new ActivityRepository(client)

    await expect(repository.catalog(false)).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.catalog(false)).resolves.toMatchObject({ entries: [] })
    expect(englishAttempts).toBe(2)
  })

  it('keeps the Chinese fallback when the locale translation table is explicitly missing', async () => {
    const table: RawTable = {
      event: {
        id: 'event',
        name: { id: 'event_name', text: '' },
        timeId: 'event_time'
      }
    }
    const { client } = fakeClient({
      locale: 'EN',
      selection: CURRENT.id,
      tables: { [CURRENT.id]: { ActivityTable: table } },
      tableOverride(name) {
        if (name === 'I18nTextTable_EN') {
          throw new DataClientError('missing translation', 'NOT_FOUND', name, 404)
        }
        return undefined
      }
    })

    const catalog = await new ActivityRepository(client).catalog(false)

    expect(catalog.details.event?.name).toBe('当前活动')
  })
})
