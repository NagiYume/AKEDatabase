import { afterEach, describe, expect, it, vi } from 'vitest'

import { sharedRef, tableRef, validateR2Manifest } from '@ake/r2-contract'
import { DataClientError, R2DataClient, findComparisonVersion } from '../src/index'

function rawManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    latest: '1.2.0@2',
    sharedRevision: 'shared-7',
    updatedAt: '2026-08-10T00:00:00.000Z',
    versions: [
      {
        id: '1.0.0@1',
        gameVersion: '1.0.0',
        hotfixVersion: '1',
        tableCfgPath: 'public/TableCfg/1.0.0-1',
        publishedAt: '2026-06-01T00:00:00.000Z'
      },
      {
        id: '1.1.0@1',
        gameVersion: '1.1.0',
        hotfixVersion: '1',
        tableCfgPath: 'public/TableCfg/1.1.0-1',
        publishedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: '1.1.0@2',
        gameVersion: '1.1.0',
        hotfixVersion: '2',
        tableCfgPath: 'public/TableCfg/1.1.0-2',
        publishedAt: '2026-07-08T00:00:00.000Z'
      },
      {
        id: '1.2.0@2',
        gameVersion: '1.2.0',
        hotfixVersion: '2',
        tableCfgPath: 'public/TableCfg/1.2.0-2',
        publishedAt: '2026-08-01T00:00:00.000Z'
      }
    ]
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function fetchImplementation(mock: ReturnType<typeof vi.fn>): typeof globalThis.fetch {
  return mock as unknown as typeof globalThis.fetch
}

function createClient(
  mock: ReturnType<typeof vi.fn>,
  options: { selection?: string; locale?: 'CH' | 'EN'; timeoutMs?: number } = {}
): R2DataClient {
  return new R2DataClient({
    baseUrl: 'https://cdn.example.test/r2/',
    manifestPath: '/manifest.json',
    fetch: fetchImplementation(mock),
    ...options
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('R2DataClient path, version and cache contracts', () => {
  it('builds cache keys from base, version id/path, shared revision, locale and resolved object path', async () => {
    const fetchMock = vi.fn(async () => response(rawManifest()))
    const client = createClient(fetchMock)
    await client.initialize()

    expect(client.createCacheKey(tableRef('ItemTable'))).toBe(
      'https://cdn.example.test/r2|1.2.0@2:public/TableCfg/1.2.0-2|shared-7|CH|public/TableCfg/1.2.0-2/ItemTable.json'
    )
    expect(client.resolveUrl(tableRef('ItemTable'))).toBe(
      'https://cdn.example.test/r2/public/TableCfg/1.2.0-2/ItemTable.json'
    )
    expect(client.resolveImageUrl('/public/images/Icon.PNG')).toBe(
      'https://cdn.example.test/r2/public/images/Icon.PNG?v=shared-7'
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /^https:\/\/cdn\.example\.test\/r2\/manifest\.json\?t=/
    )

    const currentKey = client.createCacheKey(tableRef('ItemTable'))
    await client.configure({ selection: '1.1.0@2', locale: 'EN' })
    const configuredKey = client.createCacheKey(tableRef('ItemTable'))
    expect(configuredKey).not.toBe(currentKey)
    expect(configuredKey).toContain('|1.1.0@2:public/TableCfg/1.1.0-2|shared-7|EN|')
  })

  it('keeps extracted application content on the app origin while game assets stay on R2', async () => {
    const fetchMock = vi.fn(async () => response(rawManifest()))
    const client = new R2DataClient({
      baseUrl: 'https://cdn.example.test',
      appAssetBaseUrl: 'https://app.example.test',
      fetch: fetchImplementation(fetchMock)
    })
    await client.initialize()

    expect(client.resolveUrl(sharedRef('/public/EN/i18n.json'))).toBe(
      'https://app.example.test/public/EN/i18n.json'
    )
    expect(client.resolveUrl(sharedRef('/public/CH/research/manifest.json'))).toBe(
      'https://app.example.test/public/CH/research/manifest.json'
    )
    expect(client.resolveUrl(sharedRef('/public/Json/SkillData/manifest.json'))).toBe(
      'https://cdn.example.test/public/Json/SkillData/manifest.json?v=shared-7'
    )
    expect(client.resolveUrl(sharedRef('/public/images/about/wechat.png'))).toBe(
      'https://cdn.example.test/public/images/about/wechat.png?v=shared-7'
    )
  })

  it('clears cached responses before the next request', async () => {
    let revision = 1
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (new URL(url).pathname.endsWith('/manifest.json')) return response(rawManifest())
      return response({ revision })
    })
    const client = createClient(fetchMock)
    await client.initialize()

    await expect(client.getTable('ItemTable')).resolves.toEqual({ revision: 1 })
    revision = 2
    await expect(client.getTable('ItemTable')).resolves.toEqual({ revision: 1 })

    await client.clearCache()

    await expect(client.getTable('ItemTable')).resolves.toEqual({ revision: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('falls back invalid initial and configured selections to latest', async () => {
    const fetchMock = vi.fn(async () => response(rawManifest()))
    const client = createClient(fetchMock, { selection: 'missing' })

    await expect(client.initialize()).resolves.toMatchObject({
      selection: 'latest',
      selected: { id: '1.2.0@2' }
    })
    await expect(client.configure({ selection: 'still-missing' })).resolves.toMatchObject({
      selection: 'latest',
      selected: { id: '1.2.0@2' }
    })
  })

  it('selects the newest hotfix from the immediately previous game version for comparison', () => {
    const manifest = validateR2Manifest(rawManifest())
    const current = manifest.versions.find((entry) => entry.id === manifest.latest)!
    expect(findComparisonVersion(manifest, current)?.id).toBe('1.1.0@2')
    expect(findComparisonVersion(manifest, manifest.versions[0]!)).toBeNull()
  })
})

describe('lossless JSON and request lifecycle', () => {
  it('keeps unsafe integer tokens as exact strings while parsing safe numbers normally', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (new URL(url).pathname.endsWith('/manifest.json')) return response(rawManifest())
      return response('{"id":123456789012345678901234567890,"small":42,"negative":-9007199254740993}')
    })
    const client = createClient(fetchMock)
    await client.initialize()

    const value = await client.getSharedJson<{ id: string; small: number; negative: string }>(
      '/public/Json/sample.json'
    )
    expect(value).toEqual({
      id: '123456789012345678901234567890',
      small: 42,
      negative: '-9007199254740993'
    })
  })

  it('deduplicates concurrent requests for the same cache key', async () => {
    let resolveTable: ((value: Response) => void) | undefined
    const tableResponse = new Promise<Response>((resolve) => {
      resolveTable = resolve
    })
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (new URL(url).pathname.endsWith('/manifest.json')) return response(rawManifest())
      return tableResponse
    })
    const client = createClient(fetchMock)
    await client.initialize()

    const first = client.getTable('ItemTable')
    const second = client.getTable('ItemTable')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    resolveTable?.(response({ item_a: { rarity: 6 } }))

    await expect(Promise.all([first, second])).resolves.toEqual([
      { item_a: { rarity: 6 } },
      { item_a: { rarity: 6 } }
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a transient failure and succeeds within the configured retry budget', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: true }, 503))
      .mockResolvedValueOnce(response(rawManifest()))
    const client = createClient(fetchMock)

    const initialization = client.initialize({ retries: 1 })
    await vi.advanceTimersByTimeAsync(200)

    await expect(initialization).resolves.toMatchObject({ selected: { id: '1.2.0@2' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('turns an exhausted request timeout into a NETWORK error', async () => {
    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) return
          if (signal.aborted) reject(signal.reason)
          else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
    )
    const client = createClient(fetchMock, { timeoutMs: 10 })

    await expect(client.initialize({ retries: 0 })).rejects.toMatchObject<DataClientError>({
      code: 'NETWORK'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps an explicit caller cancellation to ABORTED without retrying', async () => {
    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) return
          if (signal.aborted) reject(signal.reason)
          else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
    )
    const client = createClient(fetchMock)
    const controller = new AbortController()
    const initialization = client.initialize({ signal: controller.signal, retries: 2 })

    controller.abort(new Error('cancelled by test'))

    await expect(initialization).rejects.toMatchObject<DataClientError>({ code: 'ABORTED' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
