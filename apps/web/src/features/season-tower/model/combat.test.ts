import { describe, expect, it } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { R2ObjectRef } from '@ake/r2-contract'
import { SeasonTowerRepository } from '../api/repository'
import type { TowerDifficulty, TowerEnemySpawn } from './index'
import {
  computeTowerEnemyAttributes,
  createTowerAttributeMaps,
  extractLevelScriptData,
  resolveTowerBuff,
  staticEnemyBuffs,
  type TowerAttributeModifier
} from './combat'

const maps = createTowerAttributeMaps({
  ATTR_MAP: { 0: 'Level', 1: 'Health' },
  ATTR_MAP_EN: { 0: 'Level', 1: 'MaxHp' }
})

function spawn(overrides: Partial<TowerEnemySpawn> = {}): TowerEnemySpawn {
  return {
    id: 'enemy_alpha',
    templateId: 'enemy_alpha_template',
    name: 'Alpha',
    level: 10,
    count: 1,
    groupKey: 'group-a',
    positionX: 0,
    positionZ: 0,
    delay: 0,
    interval: 0,
    preWarnTime: 0,
    buffIds: [],
    buffs: [],
    ...overrides
  }
}

function difficulty(enemy: TowerEnemySpawn): TowerDifficulty {
  return {
    gameId: 'tower_game_1',
    star: 1,
    label: '',
    recommendedLevel: enemy.level,
    goal: '',
    feature: '',
    special: '',
    rewards: [],
    spawners: [],
    fallbackEnemies: [enemy]
  }
}

describe('Season Tower LevelScript extraction', () => {
  it('resolves a conditional Buff to the referenced Spawner and preserves raw blackboard rows', () => {
    const data = extractLevelScriptData('indie_tower001', [
      {
        scriptId: 'script-1',
        actionMap: {
          dataMap: {
            getterList: [
              {
                _ID: 10,
                $type: 'SpawnerGetSpawnedEntityList',
                _spawnerPtr: { paramSource: 0, constValue: { id: 'spawn-7' } }
              }
            ],
            actionList: [
              {
                _ID: 20,
                $type: 'AddBuffToTarget',
                _target: { idRef: 10 },
                _buffId: { paramSource: 0, constValue: 'buff_script_hp' },
                _blackboardKVPairList: {
                  paramSource: 0,
                  constValue: [{ key: 'ratio', valueDouble: 0.25 }]
                }
              }
            ]
          }
        }
      }
    ])

    expect(data.applications).toEqual([
      expect.objectContaining({
        id: 'buff_script_hp',
        spawnerId: 'spawn-7',
        configId: 'sc_indie_tower001_spawn-7',
        actionId: '20',
        confidence: 'exact',
        blackboard: [{ key: 'ratio', valueDouble: 0.25 }]
      })
    ])
  })

  it('uses exact enemy level matches and only falls back when one script definition exists', () => {
    const data = extractLevelScriptData('scene', [
      {
        scriptId: 'script-levels',
        enemies: {
          a: { entityDataIdKey: 'enemy_alpha', level: 10, buffs: [{ buffId: 'buff_l10', blackboard: [] }] },
          b: { entityDataIdKey: 'enemy_alpha', level: 20, buffs: [{ buffId: 'buff_l20', blackboard: [] }] },
          c: { entityDataIdKey: 'enemy_beta', level: 5, buffs: [{ buffId: 'buff_only', blackboard: [] }] }
        }
      }
    ])

    expect(staticEnemyBuffs(data, 'enemy_alpha', 20).map((buff) => buff.id)).toEqual(['buff_l20'])
    expect(staticEnemyBuffs(data, 'enemy_alpha', 15)).toEqual([])
    expect(staticEnemyBuffs(data, 'enemy_beta', 99).map((buff) => buff.id)).toEqual(['buff_only'])
  })
})

describe('Season Tower Buff and attribute calculation', () => {
  it('lets a spawn blackboard override the Buff default value', () => {
    const buff = resolveTowerBuff(
      {
        id: 'buff_spawn_hp',
        source: 'spawner-born',
        blackboard: [{ key: 'ratio', valueFloat: 0.5 }]
      },
      {
        blackboard: [{ key: 'ratio', valueDouble: 0.1 }],
        attributeModifier: {
          attributeModifiers: [
            {
              attributeType: 'MaxHp',
              formulaItem: 'Multiplier',
              param: { useBlackboardKey: true, blackboardKey: 'ratio', value: -0.2 }
            }
          ]
        }
      },
      maps
    )

    expect(buff.values).toEqual([{ key: 'ratio', value: 0.5, overridden: true }])
    expect(buff.modifiers).toEqual([
      expect.objectContaining({
        attrType: 1,
        attrValue: 0.5,
        modifierType: 1,
        blackboardKey: 'ratio'
      })
    ])
  })

  it('applies base and script modifiers in the legacy stage order', () => {
    const base: TowerAttributeModifier = {
      attrType: 1,
      attrValue: 0.5,
      modifierType: 1,
      source: 'spawner-born'
    }
    const script: TowerAttributeModifier = {
      attrType: 1,
      attrValue: 2,
      modifierType: 4,
      source: 'level-script'
    }
    const attributes = computeTowerEnemyAttributes(
      {
        levelDependentAttributes: [
          {
            attrs: [
              { attrType: 0, attrValue: 10 },
              { attrType: 1, attrValue: 100 }
            ]
          }
        ],
        levelIndependentAttributes: { attrs: [] }
      },
      10,
      [base],
      [script],
      maps
    )
    const health = attributes.find((attribute) => attribute.type === 1)

    expect(health).toMatchObject({ rawValue: 100, value: 150, scriptedValue: 300, changedByScript: true })
    expect(health?.formula).toBe('100 x (1 + 0.5) = 150')
    expect(health?.scriptedFormula).toBe('100 x 2 x (1 + 0.5) = 300')
  })
})

describe('SeasonTowerRepository optional combat data', () => {
  it('degrades explicitly missing optional JSON and translations without hiding other errors', async () => {
    const enemy = spawn()
    const tableValues: Readonly<Record<string, unknown>> = {
      EnemyTable: {
        enemy_alpha: {
          attrTemplateId: 'attrs-alpha',
          bornBuffs: ['buff_missing'],
          attrModifiers: []
        }
      },
      EnemyTemplateDisplayInfoTable: {
        enemy_alpha_template: { name: 'Alpha' }
      },
      EnemyAttributeTemplateTable: {
        'attrs-alpha': {
          levelDependentAttributes: [
            {
              attrs: [
                { attrType: 0, attrValue: 10 },
                { attrType: 1, attrValue: 100 }
              ]
            }
          ],
          levelIndependentAttributes: { attrs: [] }
        }
      }
    }
    const client = {
      state: {
        baseUrl: 'https://data.example.test',
        locale: 'CH',
        selected: {
          id: '1.0.0',
          gameVersion: '1.0.0',
          hotfixVersion: '0',
          tableCfgPath: 'public/TableCfg',
          publishedAt: '2026-01-01T00:00:00Z'
        },
        manifest: { sharedRevision: 'test-revision' }
      },
      getTable(name: string) {
        if (name.startsWith('I18nTextTable_')) {
          return Promise.reject(new DataClientError('missing translation', 'NOT_FOUND', name, 404))
        }
        return Promise.resolve(tableValues[name] ?? {})
      },
      getJson(ref: R2ObjectRef) {
        if (ref.path.includes('/SpawnerConfig/') && ref.path.endsWith('/manifest.json')) {
          return Promise.resolve([{ id: 'missing-spawner' }])
        }
        return Promise.reject(new DataClientError('missing optional JSON', 'NOT_FOUND', ref.path, 404))
      }
    } as unknown as R2DataClient
    const repository = new SeasonTowerRepository(client)

    await expect(repository.catalog()).resolves.toMatchObject({ seasons: [] })
    const detail = await repository.combatDetail(difficulty(enemy), null)

    expect(detail.enemies).toHaveLength(1)
    expect(detail.enemies[0]?.attributes.find((attribute) => attribute.type === 1)?.value).toBe(100)
    expect(detail.enemies[0]?.bornBuffs).toEqual([
      expect.objectContaining({ id: 'buff_missing', available: false, modifiers: [] })
    ])
    expect(detail.levelScriptBuffCount).toBe(0)
  })

  it('evicts transient failures across translations and optional combat data so each load can retry', async () => {
    const enemy = spawn()
    const tableValues: Readonly<Record<string, unknown>> = {
      EnemyTable: {
        enemy_alpha: {
          attrTemplateId: 'attrs-alpha',
          bornBuffs: ['buff_retry'],
          attrModifiers: []
        }
      },
      EnemyTemplateDisplayInfoTable: {
        enemy_alpha_template: { name: 'Alpha' }
      },
      EnemyAttributeTemplateTable: {
        'attrs-alpha': {
          levelDependentAttributes: [
            {
              attrs: [
                { attrType: 0, attrValue: 10 },
                { attrType: 1, attrValue: 100 }
              ]
            }
          ],
          levelIndependentAttributes: { attrs: [] }
        }
      }
    }
    const attempts = {
      translation: 0,
      spawner: 0,
      levelScript: 0,
      maps: 0,
      buff: 0
    }
    const client = {
      state: {
        baseUrl: 'https://data.example.test',
        locale: 'CH',
        selected: {
          id: '1.0.0',
          gameVersion: '1.0.0',
          hotfixVersion: '0',
          tableCfgPath: 'public/TableCfg',
          publishedAt: '2026-01-01T00:00:00Z'
        },
        manifest: { sharedRevision: 'retry-revision' }
      },
      getTable(name: string) {
        if (name.startsWith('I18nTextTable_')) {
          attempts.translation += 1
          if (attempts.translation === 1) {
            return Promise.reject(new DataClientError('translation timeout', 'NETWORK', name))
          }
          return Promise.resolve({})
        }
        return Promise.resolve(tableValues[name] ?? {})
      },
      getJson(ref: R2ObjectRef) {
        const path = ref.path
        if (path.includes('/SpawnerConfig/') && path.endsWith('/manifest.json')) {
          return Promise.resolve([{ id: 'retry-spawner' }])
        }
        if (path.includes('/SpawnerConfig/')) {
          attempts.spawner += 1
          if (attempts.spawner === 1) {
            return Promise.reject(new DataClientError('spawner unavailable', 'HTTP', path, 503))
          }
          return Promise.resolve({ id: 'retry-spawner' })
        }
        if (path.includes('/LevelScriptData/') && path.endsWith('/manifest.json')) {
          attempts.levelScript += 1
          if (attempts.levelScript === 1) {
            return Promise.reject(new DataClientError('level script timeout', 'NETWORK', path))
          }
          return Promise.reject(new DataClientError('no level script', 'NOT_FOUND', path, 404))
        }
        if (path.endsWith('/maps.json')) {
          attempts.maps += 1
          if (attempts.maps === 1) {
            return Promise.reject(new DataClientError('maps unavailable', 'HTTP', path, 503))
          }
          return Promise.resolve({
            ATTR_MAP: { 0: 'Level', 1: 'Health' },
            ATTR_MAP_EN: { 0: 'Level', 1: 'MaxHp' }
          })
        }
        if (path.endsWith('/BuffData/buff_retry.json')) {
          attempts.buff += 1
          if (attempts.buff === 1) {
            return Promise.reject(new DataClientError('buff timeout', 'NETWORK', path))
          }
          return Promise.resolve({ id: 'buff_retry' })
        }
        return Promise.reject(new DataClientError('missing optional JSON', 'NOT_FOUND', path, 404))
      }
    } as unknown as R2DataClient
    const repository = new SeasonTowerRepository(client)

    await expect(repository.catalog()).rejects.toBeInstanceOf(DataClientError)
    await expect(repository.catalog()).resolves.toMatchObject({ seasons: [] })
    expect(attempts.translation).toBe(2)
    expect(attempts.spawner).toBe(2)

    await expect(repository.combatDetail(difficulty(enemy), null)).rejects.toBeInstanceOf(DataClientError)
    await expect(repository.combatDetail(difficulty(enemy), null)).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.combatDetail(difficulty(enemy), null)).resolves.toMatchObject({
      enemies: [expect.objectContaining({ id: 'enemy_alpha' })]
    })
    expect(attempts.levelScript).toBe(2)
    expect(attempts.maps).toBe(2)
    expect(attempts.buff).toBe(2)
  })
})
