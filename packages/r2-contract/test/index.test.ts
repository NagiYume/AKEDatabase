import { describe, expect, it } from 'vitest'

import {
  LANGUAGE_INFO,
  R2ContractError,
  getSelectedVersion,
  normalizeBaseUrl,
  normalizeObjectPath,
  resolveObjectPath,
  sharedRef,
  tableRef,
  validateAppVersion,
  validateR2Manifest,
  type R2VersionEntry
} from '../src/index'

function validManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    latest: '1.1.0@2',
    sharedRevision: 'shared-42',
    updatedAt: '2026-08-11T03:00:00.000Z',
    versions: [
      {
        id: '1.0.0@1',
        gameVersion: '1.0.0',
        hotfixVersion: '1',
        tableCfgPath: 'public/TableCfg/1.0.0-1',
        publishedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: '1.1.0@2',
        gameVersion: '1.1.0',
        hotfixVersion: '2',
        tableCfgPath: '/public/TableCfg/1.1.0-2/',
        publishedAt: '2026-08-01T00:00:00.000Z'
      }
    ]
  }
}

describe('version.json contract', () => {
  it('normalizes the configured R2 origin and manifest path without dropping extension fields', () => {
    const value = validateAppVersion({
      appversion: ' 1.2.9-pre20 ',
      dataBaseUrl: 'https://cdn.example.test/root/?stale=1#fragment',
      dataManifestPath: '/manifests/data.json/',
      debugmode: true,
      futureField: 'preserved'
    })

    expect(value).toMatchObject({
      appversion: '1.2.9-pre20',
      dataBaseUrl: 'https://cdn.example.test/root',
      dataManifestPath: '/manifests/data.json',
      debugmode: true,
      futureField: 'preserved'
    })
  })

  it.each([
    ['non-object input', null],
    ['missing appversion', { dataBaseUrl: 'https://cdn.example.test', dataManifestPath: '/manifest.json' }],
    ['missing dataBaseUrl', { appversion: '1', dataManifestPath: '/manifest.json' }],
    ['missing dataManifestPath', { appversion: '1', dataBaseUrl: 'https://cdn.example.test' }],
    [
      'non-HTTP dataBaseUrl',
      { appversion: '1', dataBaseUrl: 'file:///tmp/data', dataManifestPath: '/manifest.json' }
    ],
    [
      'unsafe manifest path',
      { appversion: '1', dataBaseUrl: 'https://cdn.example.test', dataManifestPath: '../manifest.json' }
    ]
  ])('rejects %s', (_label, value) => {
    expect(() => validateAppVersion(value)).toThrow(R2ContractError)
  })
})

describe('R2 manifest contract', () => {
  it('validates, normalizes and freezes a complete schemaVersion 1 manifest', () => {
    const manifest = validateR2Manifest(validManifest())

    expect(manifest.latest).toBe('1.1.0@2')
    expect(manifest.versions[1]?.tableCfgPath).toBe('public/TableCfg/1.1.0-2')
    expect(getSelectedVersion(manifest, 'latest').id).toBe('1.1.0@2')
    expect(getSelectedVersion(manifest, '1.0.0@1').hotfixVersion).toBe('1')
    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(manifest.versions)).toBe(true)
    expect(Object.isFrozen(manifest.versions[0])).toBe(true)
  })

  it.each([
    ['the supported schema version', () => ({ ...validManifest(), schemaVersion: 2 })],
    ['a non-empty versions array', () => ({ ...validManifest(), versions: [] })],
    ['a latest id present in versions', () => ({ ...validManifest(), latest: 'missing' })],
    [
      'unique version ids',
      () => {
        const value = validManifest()
        const versions = value.versions as Array<Record<string, unknown>>
        return { ...value, versions: [versions[0], { ...versions[1], id: versions[0]?.id }] }
      }
    ],
    [
      'a safe tableCfgPath',
      () => {
        const value = validManifest()
        const versions = value.versions as Array<Record<string, unknown>>
        return { ...value, versions: [{ ...versions[0], tableCfgPath: '../TableCfg' }, versions[1]] }
      }
    ]
  ])('requires %s', (_label, createValue) => {
    expect(() => validateR2Manifest(createValue())).toThrow(R2ContractError)
  })

  it.each([
    [
      'versions[].id',
      () => {
        const value = validManifest()
        const [first, ...rest] = value.versions as Array<Record<string, unknown>>
        const { id: _id, ...withoutId } = first!
        return { ...value, versions: [withoutId, ...rest] }
      }
    ],
    [
      'versions[].publishedAt',
      () => {
        const value = validManifest()
        const [first, ...rest] = value.versions as Array<Record<string, unknown>>
        const { publishedAt: _publishedAt, ...withoutPublishedAt } = first!
        return { ...value, versions: [withoutPublishedAt, ...rest] }
      }
    ],
    [
      'sharedRevision',
      () => {
        const { sharedRevision: _sharedRevision, ...value } = validManifest()
        return value
      }
    ],
    [
      'updatedAt',
      () => {
        const { updatedAt: _updatedAt, ...value } = validManifest()
        return value
      }
    ]
  ])('does not synthesize required field %s', (_label, createValue) => {
    expect(() => validateR2Manifest(createValue())).toThrow(R2ContractError)
  })

  it('rejects unknown explicit version selections', () => {
    const manifest = validateR2Manifest(validManifest())
    expect(() => getSelectedVersion(manifest, '9.9.9@9')).toThrow(R2ContractError)
  })
})

describe('R2 object paths', () => {
  const version: R2VersionEntry = {
    id: '1.1.0@2',
    gameVersion: '1.1.0',
    hotfixVersion: '2',
    tableCfgPath: 'public/TableCfg/1.1.0-2',
    publishedAt: '2026-08-01T00:00:00.000Z'
  }

  it('maps only TableCfg objects through the selected version path', () => {
    expect(resolveObjectPath(tableRef('ItemTable'), version)).toBe('public/TableCfg/1.1.0-2/ItemTable.json')
    expect(resolveObjectPath({ kind: 'table', path: 'public/TableCfg/WeaponBasicTable.json' }, version)).toBe(
      'public/TableCfg/1.1.0-2/WeaponBasicTable.json'
    )
    expect(resolveObjectPath(sharedRef('/public/Json/BuffData/a.json'), version)).toBe(
      'public/Json/BuffData/a.json'
    )
    expect(resolveObjectPath(sharedRef('/public/images/icon.png'), version)).toBe('public/images/icon.png')
  })

  it('classifies fixed shared paths and preserves filename case', () => {
    expect(sharedRef('/public/Json/LevelData/A.json')).toEqual({
      kind: 'json',
      path: 'public/Json/LevelData/A.json'
    })
    expect(sharedRef('/public/images/Icon.PNG')).toEqual({
      kind: 'image',
      path: 'public/images/Icon.PNG'
    })
    expect(sharedRef('/public/EN/maps.json')).toEqual({
      kind: 'locale',
      path: 'public/EN/maps.json'
    })
  })

  it.each(['../manifest.json', './manifest.json', 'public/Json/../secret.json'])(
    'rejects unsafe object path %s',
    (path) => {
      expect(() => normalizeObjectPath(path)).toThrow(R2ContractError)
    }
  )

  it('normalizes an HTTP base URL without query, fragment or trailing slash', () => {
    expect(normalizeBaseUrl('https://cdn.example.test/r2///?x=1#y')).toBe('https://cdn.example.test/r2')
  })
})

describe('locale suffix contract', () => {
  it('defines all 14 locales and maps CH directory data to the CN TableCfg suffix', () => {
    expect(Object.keys(LANGUAGE_INFO)).toEqual([
      'CH',
      'TC',
      'EN',
      'JP',
      'KR',
      'RU',
      'MX',
      'BR',
      'DE',
      'FR',
      'VN',
      'TH',
      'ID',
      'IT'
    ])
    expect(LANGUAGE_INFO.CH).toMatchObject({ directory: 'CH', table: 'CN', htmlLang: 'zh-CN' })
  })

  it('uses the locale code as the TableCfg suffix for every locale other than CH', () => {
    for (const [locale, info] of Object.entries(LANGUAGE_INFO)) {
      if (locale === 'CH') continue
      expect(info.table).toBe(locale)
      expect(info.directory).toBe(locale)
    }
  })
})
