import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { isSafeNumber, parse } from 'lossless-json'
import {
  getSelectedVersion,
  normalizeBaseUrl,
  normalizeObjectPath,
  resolveObjectPath,
  tableRef,
  validateR2Manifest,
  type AppLocale,
  type R2Manifest,
  type R2ObjectRef,
  type R2VersionEntry
} from '@ake/r2-contract'

export interface DataClientState {
  baseUrl: string
  manifestPath: string
  manifest: R2Manifest
  selection: string
  selected: R2VersionEntry
  locale: AppLocale
  source: 'network' | 'indexeddb'
}

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  cache?: 'prefer-cache' | 'reload'
}

export interface R2DataClientOptions {
  baseUrl: string
  appAssetBaseUrl?: string
  manifestPath?: string
  selection?: string
  locale?: AppLocale
  timeoutMs?: number
  memoryEntries?: number
  fetch?: typeof globalThis.fetch
}

export class DataClientError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_READY' | 'NETWORK' | 'HTTP' | 'PARSE' | 'ABORTED' | 'NOT_FOUND',
    readonly url?: string,
    readonly status?: number,
    override readonly cause?: unknown
  ) {
    super(message)
    this.name = 'DataClientError'
  }
}

interface CachedResponse {
  key: string
  body: string
  contentType: string
  storedAt: number
}

interface SharedRequest {
  promise: Promise<CachedResponse>
  controller: AbortController
  waiters: number
}

interface AkeCacheSchema extends DBSchema {
  responses: {
    key: string
    value: CachedResponse
  }
  manifests: {
    key: string
    value: CachedResponse
  }
}

class MemoryLru<T> {
  private readonly values = new Map<string, T>()

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | undefined {
    const value = this.values.get(key)
    if (value === undefined) return undefined
    this.values.delete(key)
    this.values.set(key, value)
    return value
  }

  set(key: string, value: T): void {
    this.values.delete(key)
    this.values.set(key, value)
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.values.delete(oldest)
    }
  }

  clear(): void {
    this.values.clear()
  }
}

class PersistentResponseCache {
  private database: Promise<IDBPDatabase<AkeCacheSchema> | null> | null = null

  private getDatabase(): Promise<IDBPDatabase<AkeCacheSchema> | null> {
    if (this.database) return this.database
    if (typeof indexedDB === 'undefined') return Promise.resolve(null)
    this.database = openDB<AkeCacheSchema>('akedatabase-r2-cache', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('responses')) database.createObjectStore('responses')
        if (!database.objectStoreNames.contains('manifests')) database.createObjectStore('manifests')
      }
    }).catch(() => null)
    return this.database
  }

  async get(store: 'responses' | 'manifests', key: string): Promise<CachedResponse | undefined> {
    try {
      return (await this.getDatabase())?.get(store, key)
    } catch {
      return undefined
    }
  }

  async set(store: 'responses' | 'manifests', value: CachedResponse): Promise<void> {
    try {
      await (await this.getDatabase())?.put(store, value, value.key)
    } catch {
      // IndexedDB is opportunistic; private browsing and storage quotas may reject writes.
    }
  }

  async clear(): Promise<void> {
    try {
      const database = await this.getDatabase()
      await Promise.all([database?.clear('responses'), database?.clear('manifests')])
    } catch {
      // Cache clearing is best effort in restricted browsing contexts.
    }
  }
}

function parseLosslessly<T>(text: string, url: string): T {
  try {
    return parse(text, undefined, {
      parseNumber: (value) => (isSafeNumber(value, { approx: true }) ? Number(value) : value)
    }) as T
  } catch (error) {
    throw new DataClientError(`Invalid JSON received from ${url}`, 'PARSE', url, undefined, error)
  }
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, milliseconds)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })
}

function combineSignals(signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal))
  if (active.length === 0) return new AbortController().signal
  if (active.length === 1) return active[0]!
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(active)
  const controller = new AbortController()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

function waitForResponse(
  promise: Promise<CachedResponse>,
  signal: AbortSignal | undefined,
  url: string
): Promise<CachedResponse> {
  if (!signal) return promise
  if (signal.aborted) {
    return Promise.reject(
      new DataClientError(`Request cancelled: ${url}`, 'ABORTED', url, undefined, signal.reason)
    )
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DataClientError(`Request cancelled: ${url}`, 'ABORTED', url, undefined, signal.reason))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void promise.then(
      (response) => {
        signal.removeEventListener('abort', onAbort)
        resolve(response)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function selectedVersionOrThrow(state: DataClientState | null): R2VersionEntry {
  if (!state) throw new DataClientError('R2 data client is not initialized', 'NOT_READY')
  return state.selected
}

export function findComparisonVersion(manifest: R2Manifest, current: R2VersionEntry): R2VersionEntry | null {
  const compare = (a: string, b: string) => {
    const left = a.split('.').map(Number)
    const right = b.split('.').map(Number)
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0)
      if (difference !== 0) return difference
    }
    return a.localeCompare(b, 'en')
  }
  const previousGameVersion = [...new Set(manifest.versions.map((entry) => entry.gameVersion))]
    .filter((version) => compare(version, current.gameVersion) < 0)
    .sort((a, b) => compare(b, a))[0]
  if (!previousGameVersion) return null
  return (
    manifest.versions
      .filter((entry) => entry.gameVersion === previousGameVersion)
      .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt, 'en'))[0] ?? null
  )
}

export class R2DataClient {
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly timeoutMs: number
  private readonly memory: MemoryLru<CachedResponse>
  private readonly persistent = new PersistentResponseCache()
  private readonly inFlight = new Map<string, SharedRequest>()
  private stateValue: DataClientState | null = null
  private baseUrl: string
  private readonly appAssetBaseUrl: string
  private manifestPath: string
  private selection: string
  private locale: AppLocale

  constructor(options: R2DataClientOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.memory = new MemoryLru(options.memoryEntries ?? 80)
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.appAssetBaseUrl = normalizeBaseUrl(options.appAssetBaseUrl ?? options.baseUrl)
    this.manifestPath = `/${normalizeObjectPath(options.manifestPath ?? '/manifest.json')}`
    this.selection = options.selection ?? 'latest'
    this.locale = options.locale ?? 'CH'
  }

  get state(): DataClientState {
    if (!this.stateValue) throw new DataClientError('R2 data client is not initialized', 'NOT_READY')
    return this.stateValue
  }

  async initialize(options: RequestOptions = {}): Promise<DataClientState> {
    const manifestKey = `${this.baseUrl}|${this.manifestPath}`
    const manifestUrl = new URL(normalizeObjectPath(this.manifestPath), `${this.baseUrl}/`)
    manifestUrl.searchParams.set('t', String(Date.now()))
    const url = manifestUrl.href
    let body: string
    let source: DataClientState['source'] = 'network'
    try {
      const response = await this.fetchRaw(url, options)
      body = response.body
      void this.persistent.set('manifests', { ...response, key: manifestKey })
    } catch (error) {
      const cached = await this.persistent.get('manifests', manifestKey)
      if (!cached) throw error
      body = cached.body
      source = 'indexeddb'
    }
    const manifest = validateR2Manifest(parseLosslessly<unknown>(body, url))
    let selected: R2VersionEntry
    try {
      selected = getSelectedVersion(manifest, this.selection)
    } catch {
      this.selection = 'latest'
      selected = getSelectedVersion(manifest, 'latest')
    }
    this.stateValue = Object.freeze({
      baseUrl: this.baseUrl,
      manifestPath: this.manifestPath,
      manifest,
      selection: this.selection,
      selected,
      locale: this.locale,
      source
    })
    return this.stateValue
  }

  async configure(options: {
    baseUrl?: string
    selection?: string
    locale?: AppLocale
  }): Promise<DataClientState> {
    const nextBaseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : this.baseUrl
    const baseChanged = nextBaseUrl !== this.baseUrl
    this.baseUrl = nextBaseUrl
    this.selection = options.selection ?? this.selection
    this.locale = options.locale ?? this.locale
    if (baseChanged || !this.stateValue) return this.initialize()
    let selected: R2VersionEntry
    try {
      selected = getSelectedVersion(this.stateValue.manifest, this.selection)
    } catch {
      this.selection = 'latest'
      selected = getSelectedVersion(this.stateValue.manifest, this.selection)
    }
    this.stateValue = Object.freeze({
      ...this.stateValue,
      baseUrl: this.baseUrl,
      selection: this.selection,
      selected,
      locale: this.locale
    })
    return this.stateValue
  }

  createCacheKey(ref: R2ObjectRef, version = selectedVersionOrThrow(this.stateValue)): string {
    const state = this.state
    const objectPath = resolveObjectPath(ref, version)
    return [
      ref.kind === 'locale' ? this.appAssetBaseUrl : state.baseUrl,
      `${version.id}:${version.tableCfgPath}`,
      state.manifest.sharedRevision,
      state.locale,
      objectPath
    ].join('|')
  }

  resolveUrl(ref: R2ObjectRef, version = selectedVersionOrThrow(this.stateValue)): string {
    const state = this.state
    const baseUrl = ref.kind === 'locale' ? this.appAssetBaseUrl : state.baseUrl
    const url = new URL(resolveObjectPath(ref, version), `${baseUrl}/`)
    if (ref.kind !== 'table' && ref.kind !== 'locale')
      url.searchParams.set('v', state.manifest.sharedRevision)
    return url.href
  }

  resolveImageUrl(path: string): string {
    return this.resolveUrl({ kind: 'image', path: normalizeObjectPath(path) })
  }

  async getText(
    ref: R2ObjectRef,
    options: RequestOptions = {},
    version = selectedVersionOrThrow(this.stateValue)
  ): Promise<string> {
    const key = this.createCacheKey(ref, version)
    if (options.cache !== 'reload') {
      const memoryValue = this.memory.get(key)
      if (memoryValue) return memoryValue.body
      const persisted = await this.persistent.get('responses', key)
      if (persisted) {
        this.memory.set(key, persisted)
        return persisted.body
      }
    }
    const url = this.resolveUrl(ref, version)
    let request = this.inFlight.get(key)
    if (!request) {
      const controller = new AbortController()
      const promise = this.fetchRaw(url, { ...options, signal: controller.signal }).then((response) => ({
        ...response,
        key
      }))
      request = { promise, controller, waiters: 0 }
      this.inFlight.set(key, request)
      const cleanup = () => {
        if (this.inFlight.get(key) === request) this.inFlight.delete(key)
      }
      void promise.then(cleanup, cleanup)
    }
    request.waiters += 1
    let cached: CachedResponse
    try {
      cached = await waitForResponse(request.promise, options.signal, url)
    } finally {
      request.waiters -= 1
      if (request.waiters === 0 && this.inFlight.get(key) === request && options.signal?.aborted) {
        request.controller.abort(options.signal.reason)
      }
    }
    this.memory.set(key, cached)
    void this.persistent.set('responses', cached)
    return cached.body
  }

  async getJson<T>(
    ref: R2ObjectRef,
    options: RequestOptions = {},
    version = selectedVersionOrThrow(this.stateValue)
  ): Promise<T> {
    const url = this.resolveUrl(ref, version)
    return parseLosslessly<T>(await this.getText(ref, options, version), url)
  }

  getTable<T = Record<string, unknown>>(
    name: string,
    options: RequestOptions = {},
    version = selectedVersionOrThrow(this.stateValue)
  ): Promise<T> {
    return this.getJson<T>(tableRef(name), options, version)
  }

  getSharedJson<T>(
    path: string,
    options: RequestOptions = {},
    version = selectedVersionOrThrow(this.stateValue)
  ): Promise<T> {
    return this.getJson<T>({ kind: 'json', path: normalizeObjectPath(path) }, options, version)
  }

  clearMemoryCache(): void {
    this.memory.clear()
  }

  async clearCache(): Promise<void> {
    this.memory.clear()
    await this.persistent.clear()
  }

  private async fetchRaw(url: string, options: RequestOptions): Promise<CachedResponse> {
    const retries = Math.max(0, options.retries ?? 1)
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const timeout = AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs)
      const signal = combineSignals([options.signal, timeout])
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          cache: 'no-store',
          signal,
          headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.1' }
        })
        if (!response.ok) {
          const code = response.status === 404 ? 'NOT_FOUND' : 'HTTP'
          throw new DataClientError(
            `HTTP ${response.status} while reading ${url}`,
            code,
            url,
            response.status
          )
        }
        return {
          key: '',
          body: await response.text(),
          contentType: response.headers.get('content-type') ?? 'application/octet-stream',
          storedAt: Date.now()
        }
      } catch (error) {
        if (signal.aborted && options.signal?.aborted) {
          throw new DataClientError(`Request cancelled: ${url}`, 'ABORTED', url, undefined, error)
        }
        if (error instanceof DataClientError && error.code === 'NOT_FOUND') throw error
        lastError = error
        if (attempt < retries) await delay(180 * 2 ** attempt, options.signal)
      }
    }
    throw new DataClientError(`Unable to read ${url}`, 'NETWORK', url, undefined, lastError)
  }
}
