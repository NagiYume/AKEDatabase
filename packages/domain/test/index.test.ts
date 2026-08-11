import { describe, expect, it } from 'vitest'

import {
  CATALOG_DEFINITIONS,
  applyCatalogAttributeModifiers,
  buildCatalogEntries,
  buildDetailBundle,
  catalogToCsv,
  csvEscape,
  deepDiff,
  deriveCatalogLevelSnapshot,
  filterCatalogEntries,
  flattenRecord,
  parseCatalogLevelPreferences,
  stableStringify,
  type CatalogDefinition,
  type CatalogEntry,
  type TableSet
} from '../src/index'

describe('catalog search, filtering and deterministic ordering', () => {
  const tables: TableSet = {
    WeaponBasicTable: {
      w_b: { rarity: 5, weaponType: 2, sortId: 20 },
      w_low: { rarity: 4, weaponType: 1, sortId: 1 },
      w_hidden: { rarity: 6, weaponType: 3, sortId: 99, hidden: true },
      w_a: { rarity: 5, weaponType: 2, sortId: 20 }
    },
    ItemTable: {
      w_a: { name: { id: 'name_a', text: 'Alpha Blade' }, iconId: 'icon_a' },
      w_b: { name: { id: 'name_b', text: 'Bravo Prime' }, iconId: 'icon_b' },
      w_low: { name: { id: 'name_low', text: 'Utility Blade' }, iconId: 'icon_low' },
      w_hidden: { name: { id: 'name_hidden', text: 'Hidden Blade' }, iconId: 'icon_hidden' }
    }
  }

  it('sorts by rarity, priority and id without depending on source insertion order', () => {
    const entries = buildCatalogEntries(CATALOG_DEFINITIONS.v3_weapon, tables)

    expect(entries.map((entry) => entry.id)).toEqual(['w_hidden', 'w_a', 'w_b', 'w_low'])
    expect(entries.find((entry) => entry.id === 'w_a')).toMatchObject({
      name: 'Alpha Blade',
      category: '2',
      rarity: 5,
      icon: expect.stringContaining('/itemiconbig/icon_a.png')
    })
    expect(Object.keys(tables.WeaponBasicTable ?? {})).toEqual(['w_b', 'w_low', 'w_hidden', 'w_a'])
  })

  it('combines case-insensitive search, rarity, category and hidden filters while retaining order', () => {
    const entries = buildCatalogEntries(CATALOG_DEFINITIONS.v3_weapon, tables)

    expect(filterCatalogEntries(entries, {}).map((entry) => entry.id)).toEqual(['w_a', 'w_b', 'w_low'])
    expect(filterCatalogEntries(entries, { search: ' BRAVO ' }).map((entry) => entry.id)).toEqual(['w_b'])
    expect(
      filterCatalogEntries(entries, {
        rarities: new Set([5]),
        categories: new Set(['2'])
      }).map((entry) => entry.id)
    ).toEqual(['w_a', 'w_b'])
    expect(
      filterCatalogEntries(entries, { search: 'hidden', showHidden: true }).map((entry) => entry.id)
    ).toEqual(['w_hidden'])
  })

  it('separates hidden access from directory filters so valid deep links survive search', () => {
    const entries = buildCatalogEntries(CATALOG_DEFINITIONS.v3_weapon, tables)
    const accessible = filterCatalogEntries(entries, { showHidden: false })
    const visible = filterCatalogEntries(accessible, { search: 'Bravo', showHidden: true })

    expect(accessible.find((entry) => entry.id === 'w_hidden')).toBeUndefined()
    expect(visible.map((entry) => entry.id)).toEqual(['w_b'])
    expect(accessible.find((entry) => entry.id === 'w_a')).toMatchObject({ name: 'Alpha Blade' })
  })
})

describe('detail selection and flattening', () => {
  const definition: CatalogDefinition = {
    id: 'v3_item',
    titleKey: 'test.title',
    descriptionKey: 'test.description',
    primaryTable: 'PrimaryTable',
    idField: 'id',
    listTables: ['PrimaryTable'],
    detailTables: ['PrimaryTable', 'RelatedTable', 'DirectTable', 'UnrelatedTable']
  }

  it('keeps direct id rows and recursively referenced rows while excluding unrelated data', () => {
    const tables: TableSet = {
      PrimaryTable: {
        target: { id: 'target', name: 'Target' },
        other: { id: 'other' }
      },
      RelatedTable: {
        relation_a: { nested: { itemIds: ['other', 'target'] } },
        relation_b: { nested: { itemIds: ['other'] } }
      },
      DirectTable: {
        target: { value: 42 },
        direct_other: { value: 7 }
      },
      UnrelatedTable: {
        row: { value: 'nothing' }
      }
    }

    expect(buildDetailBundle(definition, 'target', tables)).toEqual({
      PrimaryTable: { target: { id: 'target', name: 'Target' } },
      RelatedTable: { relation_a: { nested: { itemIds: ['other', 'target'] } } },
      DirectTable: { target: { value: 42 } }
    })
  })

  it('flattens nested objects and arrays into stable dotted/indexed paths', () => {
    expect(
      flattenRecord({
        stats: { hp: 100, resistance: [0.1, 0.2] },
        enabled: true,
        missing: null
      })
    ).toEqual([
      { path: 'stats.hp', value: 100 },
      { path: 'stats.resistance[0]', value: 0.1 },
      { path: 'stats.resistance[1]', value: 0.2 },
      { path: 'enabled', value: true },
      { path: 'missing', value: null }
    ])
  })
})

describe('stable diff signatures', () => {
  it('ignores hydrated text changes for the same text id and reports concrete field paths', () => {
    const before = {
      name: { id: 'name_1', text: 'Old translation' },
      stats: { hp: 100, atk: 20 },
      removed: true
    }
    const after = {
      name: { id: 'name_1', text: 'New translation' },
      stats: { hp: 100, atk: 25 },
      added: 'new'
    }

    expect(stableStringify(before)).not.toContain('Old translation')
    expect(deepDiff(before, after)).toEqual([
      { path: 'stats.atk', before: 20, after: 25, type: 'changed' },
      { path: 'removed', before: true, after: undefined, type: 'removed' },
      { path: 'added', before: undefined, after: 'new', type: 'added' }
    ])
  })

  it('creates order-independent signatures for object keys and serializes bigint safely', () => {
    expect(stableStringify({ z: 1, nested: { b: 2, a: 1 }, id: 9007199254740993n })).toBe(
      stableStringify({ id: 9007199254740993n, nested: { a: 1, b: 2 }, z: 1 })
    )
  })
})

describe('catalog CSV export', () => {
  const entry: CatalogEntry = {
    id: 'weapon_1',
    name: 'Blade, "Prime"\nMk II',
    rarity: 6,
    category: 'sword',
    categoryLabel: 'Sword',
    subtitle: 'Line 1\r\nLine 2',
    icon: '',
    priority: 1,
    hidden: false,
    searchText: '',
    source: {}
  }

  it('quotes commas, quotes and embedded newlines and uses CRLF between records', () => {
    expect(csvEscape('a,"b"')).toBe('"a,""b"""')
    expect(catalogToCsv([entry])).toBe(
      'id,name,rarity,category,subtitle\r\n' +
        '"weapon_1","Blade, ""Prime""\nMk II","6","sword","Line 1\r\nLine 2"'
    )
  })
})

describe('catalog level snapshots', () => {
  const maps = {
    ATTR_MAP: {
      '1': 'Max HP',
      '2': 'Attack',
      '3': 'Defense',
      '20': 'Poise',
      '39': 'Strength'
    }
  }

  it('keeps the first valid configured level for each domain limit', () => {
    expect(parseCatalogLevelPreferences(' nope, 20, 20, 0, 90, 91 ', 'character')).toEqual([20, 90])
    expect(parseCatalogLevelPreferences('101, 100, 1x, 1', 'enemy')).toEqual([100, 1])
    expect(parseCatalogLevelPreferences('', 'weapon')).toEqual([])
  })

  it('uses the highest breakthrough row and the legacy HP curve without mutating character DTOs', () => {
    const tables: TableSet = {
      CharacterTable: {
        char_a: {
          attributes: [
            {
              breakStage: 0,
              Attribute: {
                attrs: [
                  { attrType: 0, attrValue: 20 },
                  { attrType: 1, attrValue: 1_500 },
                  { attrType: 39, attrValue: 40 }
                ]
              }
            },
            {
              breakStage: 1,
              Attribute: {
                attrs: [
                  { attrType: 0, attrValue: 20 },
                  { attrType: 1, attrValue: 1_600 },
                  { attrType: 39, attrValue: 50 }
                ]
              }
            }
          ]
        }
      }
    }
    const signature = stableStringify(tables)

    const snapshot = deriveCatalogLevelSnapshot(CATALOG_DEFINITIONS.v3_character, 'char_a', tables, 20, maps)

    expect(snapshot).toMatchObject({ kind: 'character', requestedLevel: 20, resolvedLevel: 20 })
    expect(snapshot?.attributes.find((attribute) => attribute.attrType === 39)).toMatchObject({
      label: 'Strength',
      value: 50
    })
    expect(snapshot?.attributes.find((attribute) => attribute.attrType === 1)).toMatchObject({
      rawValue: 1_600,
      value: 1_566.33,
      modified: true
    })
    expect(stableStringify(tables)).toBe(signature)
  })

  it('follows the weapon upgrade template and resolves the closest lower level on a tie', () => {
    const tables: TableSet = {
      WeaponBasicTable: { weapon_a: { levelTemplateId: 'curve_a' } },
      WeaponUpgradeTemplateTable: {
        curve_a: {
          list: [
            { weaponLv: 1, baseAtk: 30 },
            { weaponLv: 3, baseAtk: 42 }
          ]
        }
      }
    }

    expect(
      deriveCatalogLevelSnapshot(CATALOG_DEFINITIONS.v3_weapon, 'weapon_a', tables, 2, maps)
    ).toMatchObject({
      kind: 'weapon',
      requestedLevel: 2,
      resolvedLevel: 1,
      sourceId: 'curve_a',
      attributes: [{ attrType: 2, label: 'Attack', value: 30 }]
    })
  })

  it('selects the base enemy variant and applies modifiers in the legacy stage order', () => {
    const tables: TableSet = {
      EnemyTable: {
        enemy_variant: {
          enemyId: 'enemy_variant',
          templateId: 'enemy_a',
          attrTemplateId: 'template_variant',
          attrModifiers: [{ attrType: 1, modifierType: 0, attrValue: 999 }]
        },
        enemy_a: {
          enemyId: 'enemy_a',
          templateId: 'enemy_a',
          attrTemplateId: 'template_a',
          attrModifiers: [
            { attrType: 1, modifierType: 5, attrValue: 10 },
            { attrType: 1, modifierType: 6, attrValue: 0.5 },
            { attrType: 1, modifierType: 0, attrValue: 5 }
          ]
        }
      },
      EnemyAttributeTemplateTable: {
        template_a: {
          levelDependentAttributes: [
            {
              attrs: [
                { attrType: 0, attrValue: 10 },
                { attrType: 1, attrValue: 100 },
                { attrType: 2, attrValue: 20 }
              ]
            }
          ],
          levelIndependentAttributes: { attrs: [{ attrType: 20, attrValue: 80 }] }
        }
      }
    }

    const snapshot = deriveCatalogLevelSnapshot(CATALOG_DEFINITIONS.v3_enemy, 'enemy_a', tables, 10, maps)

    expect(snapshot).toMatchObject({ kind: 'enemy', sourceId: 'enemy_a', resolvedLevel: 10 })
    expect(snapshot?.attributes.find((attribute) => attribute.attrType === 1)).toMatchObject({
      rawValue: 100,
      value: 170,
      modified: true
    })
    expect(snapshot?.attributes.find((attribute) => attribute.attrType === 20)).toMatchObject({
      label: 'Poise',
      value: 80
    })
    expect(
      applyCatalogAttributeModifiers(
        100,
        [
          { attrType: 1, modifierType: 1, attrValue: 0.1 },
          { attrType: 1, modifierType: 4, attrValue: 2 }
        ],
        1
      )
    ).toBeCloseTo(220)
  })
})
