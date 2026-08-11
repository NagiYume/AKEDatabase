export const R2_SCHEMA_VERSION = 1 as const

export const LANGUAGE_INFO = {
  CH: { directory: 'CH', table: 'CN', htmlLang: 'zh-CN', label: '简体中文' },
  TC: { directory: 'TC', table: 'TC', htmlLang: 'zh-Hant', label: '繁體中文' },
  EN: { directory: 'EN', table: 'EN', htmlLang: 'en', label: 'English' },
  JP: { directory: 'JP', table: 'JP', htmlLang: 'ja', label: '日本語' },
  KR: { directory: 'KR', table: 'KR', htmlLang: 'ko', label: '한국어' },
  RU: { directory: 'RU', table: 'RU', htmlLang: 'ru', label: 'Русский' },
  MX: { directory: 'MX', table: 'MX', htmlLang: 'es-MX', label: 'Español (Latinoamérica)' },
  BR: { directory: 'BR', table: 'BR', htmlLang: 'pt-BR', label: 'Português (Brasil)' },
  DE: { directory: 'DE', table: 'DE', htmlLang: 'de', label: 'Deutsch' },
  FR: { directory: 'FR', table: 'FR', htmlLang: 'fr', label: 'Français' },
  VN: { directory: 'VN', table: 'VN', htmlLang: 'vi', label: 'Tiếng Việt' },
  TH: { directory: 'TH', table: 'TH', htmlLang: 'th', label: 'ไทย' },
  ID: { directory: 'ID', table: 'ID', htmlLang: 'id', label: 'Bahasa Indonesia' },
  IT: { directory: 'IT', table: 'IT', htmlLang: 'it', label: 'Italiano' }
} as const

export type AppLocale = keyof typeof LANGUAGE_INFO

export interface AppVersionConfig {
  appversion: string
  dataBaseUrl: string
  dataManifestPath: string
  debugmode?: boolean
  updatedAt?: string
  tipversion?: string
  [key: string]: unknown
}

export interface R2VersionEntry {
  id: string
  gameVersion: string
  hotfixVersion: string
  tableCfgPath: string
  publishedAt: string
}

export interface R2Manifest {
  schemaVersion: typeof R2_SCHEMA_VERSION
  latest: string
  sharedRevision: string
  updatedAt: string
  versions: readonly R2VersionEntry[]
}

export type R2ObjectKind = 'table' | 'json' | 'image' | 'locale' | 'shared'

export interface R2ObjectRef {
  kind: R2ObjectKind
  path: string
}

export class R2ContractError extends Error {
  readonly code = 'R2_CONTRACT_ERROR'

  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'R2ContractError'
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw new R2ContractError(`Missing or invalid ${field}`)
  return normalized
}

export function normalizeObjectPath(value: unknown): string {
  const path = requiredString(value, 'object path').replace(/^\/+/, '').replace(/\/+$/, '')
  if (path.split('/').some((part) => part === '..' || part === '.')) {
    throw new R2ContractError(`Unsafe object path: ${path}`)
  }
  return path
}

export function normalizeBaseUrl(value: string, fallbackOrigin = 'https://data.akedata.wiki'): string {
  let url: URL
  try {
    url = new URL(value.trim() || fallbackOrigin, fallbackOrigin)
  } catch (error) {
    throw new R2ContractError('Invalid R2 base URL', error)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new R2ContractError('R2 base URL must use HTTP or HTTPS')
  }
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url.href.replace(/\/$/, '')
}

export function validateAppVersion(value: unknown): AppVersionConfig {
  if (!isRecord(value)) throw new R2ContractError('version.json must be an object')
  return {
    ...value,
    appversion: requiredString(value.appversion, 'appversion'),
    dataBaseUrl: normalizeBaseUrl(requiredString(value.dataBaseUrl, 'dataBaseUrl')),
    dataManifestPath: `/${normalizeObjectPath(value.dataManifestPath)}`
  }
}

export function validateR2Manifest(value: unknown): R2Manifest {
  if (!isRecord(value) || value.schemaVersion !== R2_SCHEMA_VERSION || !Array.isArray(value.versions)) {
    throw new R2ContractError('R2 manifest must use schemaVersion 1 and contain versions')
  }
  const ids = new Set<string>()
  const versions = value.versions.map((raw, index): R2VersionEntry => {
    if (!isRecord(raw)) throw new R2ContractError(`Invalid versions[${index}]`)
    const gameVersion = requiredString(raw.gameVersion, `versions[${index}].gameVersion`)
    const hotfixVersion = requiredString(raw.hotfixVersion, `versions[${index}].hotfixVersion`)
    const id = requiredString(raw.id, `versions[${index}].id`)
    if (ids.has(id)) throw new R2ContractError(`Duplicate version id: ${id}`)
    ids.add(id)
    return Object.freeze({
      id,
      gameVersion,
      hotfixVersion,
      tableCfgPath: normalizeObjectPath(raw.tableCfgPath),
      publishedAt: requiredString(raw.publishedAt, `versions[${index}].publishedAt`)
    })
  })
  if (versions.length === 0) throw new R2ContractError('R2 manifest has no versions')
  const latest = requiredString(value.latest, 'latest')
  if (!ids.has(latest)) throw new R2ContractError(`latest points to unknown version: ${latest}`)
  const updatedAt = requiredString(value.updatedAt, 'updatedAt')
  const sharedRevision = requiredString(value.sharedRevision, 'sharedRevision')
  return Object.freeze({
    schemaVersion: R2_SCHEMA_VERSION,
    latest,
    sharedRevision,
    updatedAt,
    versions: Object.freeze(versions)
  })
}

export function resolveObjectPath(ref: R2ObjectRef, version: R2VersionEntry): string {
  const path = normalizeObjectPath(ref.path)
  if (ref.kind === 'table') {
    const suffix = path.startsWith('public/TableCfg/') ? path.slice('public/TableCfg/'.length) : path
    return `${version.tableCfgPath}/${suffix}`
  }
  return path
}

export function getSelectedVersion(manifest: R2Manifest, selection: string): R2VersionEntry {
  const id = selection === 'latest' ? manifest.latest : selection
  const selected = manifest.versions.find((version) => version.id === id)
  if (!selected) throw new R2ContractError(`Unknown data version: ${selection}`)
  return selected
}

export function tableRef(name: string): R2ObjectRef {
  const fileName = name.endsWith('.json') ? name : `${name}.json`
  return { kind: 'table', path: `public/TableCfg/${fileName}` }
}

export function sharedRef(path: string): R2ObjectRef {
  const normalized = normalizeObjectPath(path)
  const kind: R2ObjectKind = normalized.startsWith('public/Json/')
    ? 'json'
    : normalized.startsWith('public/images/')
      ? 'image'
      : normalized.startsWith('public/')
        ? 'locale'
        : 'shared'
  return { kind, path: normalized }
}
