import { describe, expect, it } from 'vitest'
import type { TableSet } from '@ake/domain'
import {
  buildDungeonCatalog,
  buildDungeonDetail,
  collectDungeonBuffIds,
  createDungeonAttributeMaps,
  type DungeonSceneRuntime
} from '.'

const TABLES: TableSet = {
  DungeonSeriesTable: {
    series_resource: {
      name: 'Resource operation',
      gameCategory: 'dungeon_resource',
      includeDungeonIds: ['stage_b', 'stage_a'],
      staminaText: '20',
      desc: 'Series description',
      dungeonPicPath: 'series_picture',
      dungeonRoleImg: 'enemy_alpha_template'
    },
    series_boss: {
      name: 'Boss operation',
      gameCategory: 'dungeon_highdifficulty',
      includeDungeonIds: []
    }
  },
  DungeonTable: {
    stage_b: {
      dungeonName: 'Second stage',
      dungeonLevelDesc: 'Hard',
      dungeonDesc: 'Stage description',
      featureDesc: 'Stage feature',
      mainGoalDesc: 'Defeat all enemies',
      extraGoalDesc: 'No incapacitations',
      costStamina: 20,
      recommendLv: 30,
      dungeonCategory: 'dungeon_resource',
      dungeonPicPath: 'stage_picture',
      dungeonImg: 'stage_icon',
      sceneId: 'scene_test',
      enemyIds: ['enemy_alpha'],
      enemyLevels: [30],
      rewardId: 'reward_fixed',
      firstPassRewardId: 'reward_first',
      hunterModeRewardId: 'reward_hunter',
      hunterModeCostStamina: 40
    },
    stage_a: {
      dungeonName: 'First stage',
      recommendLv: 30,
      sceneId: 'scene_test',
      enemyIds: []
    }
  },
  RewardTable: {
    reward_fixed: { itemBundles: [{ id: 'item_a', count: 2 }] },
    reward_first: { itemBundles: [{ id: 'item_b', count: 1 }] },
    reward_hunter: {
      itemBundles: [{ id: 'item_c', count: 3 }],
      probItemBundles: [{ id: 'item_d', count: 1 }]
    }
  },
  ItemTable: {
    item_a: { name: 'Fixed item', iconId: 'icon_a', rarity: 2 },
    item_b: { name: 'First item', iconId: 'icon_b', rarity: 3 },
    item_c: { name: 'Hunter item', iconId: 'icon_c', rarity: 4 },
    item_d: { name: 'Random item', iconId: 'icon_d', rarity: 5 }
  },
  EnemyTable: {
    enemy_alpha: {
      templateId: 'enemy_alpha_template',
      attrTemplateId: 'enemy_alpha_attr',
      bornBuffs: ['buff_born'],
      attrModifiers: [{ attrType: 1, attrValue: 5, modifierType: 0 }],
      isDangerous: true,
      showBigEffect: true,
      showBigHeadbar: true
    }
  },
  EnemyTemplateDisplayInfoTable: {
    enemy_alpha_template: {
      name: 'Alpha enemy',
      nickname: 'Alpha',
      description: 'Enemy description'
    }
  },
  EnemyAttributeTemplateTable: {
    enemy_alpha_attr: {
      levelDependentAttributes: [
        {
          attrs: [
            { attrType: 0, attrValue: 30 },
            { attrType: 1, attrValue: 100 }
          ]
        }
      ],
      levelIndependentAttributes: { attrs: [{ attrType: 3, attrValue: 50 }] }
    }
  }
}

const RUNTIME: DungeonSceneRuntime = {
  sceneId: 'scene_test',
  spawnerManifestAvailable: true,
  levelScriptManifestAvailable: true,
  missingSpawnerDetails: 1,
  missingLevelScriptDetails: 0,
  spawners: [
    {
      configId: 'sc_scene_test_10',
      enemyLibrary: [
        {
          key: 'alpha',
          enemyId: 'enemy_alpha',
          enemyLevel: 30,
          bornBuffList: [{ buffId: 'buff_spawner', blackboard: [] }],
          preWarnTime: 2
        }
      ],
      waveMap: {
        '1': {
          waveMode: 'Parallel',
          groupMap: {
            alpha: {
              groupKey: 'group-alpha',
              groupMode: 'PartKilled',
              groupModeTargetKey: 'group-prior',
              groupModeKillCount: 1,
              limitGroupMaxCount: true,
              groupMaxCount: 2,
              actionMap: {
                spawn: {
                  $type: 'SpawnMonsterFromTemplateV2',
                  libraryKey: 'alpha',
                  spawnCount: 2,
                  timestamp: 3,
                  spawnInterval: 1,
                  randomizeRadius: 2,
                  faceMainCharacter: true,
                  position: { x: 4, z: -2 }
                }
              }
            }
          }
        }
      }
    }
  ],
  levelScripts: [
    {
      scriptId: 'script_test',
      modules: { module: { spawnerId: '10' } },
      enemies: {
        alpha: {
          entityDataIdKey: 'enemy_alpha',
          level: 30,
          buffs: [{ buffId: 'buff_static', blackboard: [] }]
        }
      },
      actionMap: {
        dataMap: {
          actionList: [
            {
              $type: 'AddBuffToTarget',
              _ID: 7,
              _buffId: { paramSource: 0, constValue: 'buff_script' },
              _blackboardKVPairList: { paramSource: 0, constValue: [] }
            }
          ]
        }
      }
    }
  ]
}

const BUFFS: Readonly<Record<string, unknown>> = Object.fromEntries(
  [
    ['buff_born', 10],
    ['buff_spawner', 20],
    ['buff_script', 30],
    ['buff_static', 40]
  ].map(([id, value]) => [
    id,
    {
      attributeModifier: {
        attributeModifiers: [
          {
            attributeType: 'MaxHP',
            formulaItem: 'Addition',
            param: { value }
          }
        ]
      }
    }
  ])
)

const MAPS = createDungeonAttributeMaps({
  ATTR_MAP: { 0: 'Level', 1: 'HP', 3: 'Defense' },
  ATTR_MAP_EN: { 0: 'Level', 1: 'MaxHP', 3: 'Defense' },
  MODIFIER_TYPE_MAP: { 0: 'Addition' }
})

describe('dungeon typed resolver', () => {
  it('builds and groups the manifest in legacy rarity order', () => {
    const catalog = buildDungeonCatalog(TABLES)

    expect(catalog.series.map((item) => item.id)).toEqual(['series_boss', 'series_resource'])
    expect(catalog.series[1]).toMatchObject({
      categoryKey: 'resource',
      dungeonCount: 2,
      imageId: 'series_picture'
    })
  })

  it('preserves ordered cards and resolves waves, rewards, enemy stats, and all buff sources', () => {
    const detail = buildDungeonDetail(TABLES, 'series_resource', { scene_test: RUNTIME }, BUFFS, MAPS)

    expect(detail?.dungeons.map((dungeon) => dungeon.id)).toEqual(['stage_b', 'stage_a'])
    const stage = detail?.dungeons[0]
    expect(stage?.waves).toHaveLength(1)
    expect(stage?.waves[0]).toMatchObject({ id: '1', maxAlive: 2 })
    expect(stage?.waves[0]?.enemies[0]).toMatchObject({
      id: 'enemy_alpha',
      count: 2,
      groupKey: 'group-alpha',
      targetGroupKey: 'group-prior',
      positionX: 4,
      positionZ: -2
    })
    expect(stage?.rewards).toMatchObject({
      fixed: [expect.objectContaining({ id: 'item_a' })],
      first: [expect.objectContaining({ id: 'item_b' })],
      hunterFixed: [expect.objectContaining({ id: 'item_c' })],
      hunterRandom: [expect.objectContaining({ id: 'item_d' })]
    })
    const enemy = stage?.enemies[0]
    expect(enemy?.stats.find((stat) => stat.attrType === 1)).toMatchObject({
      baseValue: 100,
      value: 205,
      changed: true
    })
    expect(enemy?.buffs.map((buff) => `${buff.source}:${buff.id}`)).toEqual([
      'born:buff_born',
      'spawner:buff_spawner',
      'script:buff_static',
      'script:buff_script'
    ])
    expect(stage?.runtime).toMatchObject({
      spawnerManifestAvailable: true,
      levelScriptManifestAvailable: true,
      missingSpawnerDetails: 1
    })
  })

  it('collects optional BuffData dependencies from tables, spawners, and LevelScript', () => {
    expect(collectDungeonBuffIds(TABLES, 'series_resource', { scene_test: RUNTIME }).toSorted()).toEqual([
      'buff_born',
      'buff_script',
      'buff_spawner',
      'buff_static'
    ])
  })

  it('returns null for an unknown series without inventing content', () => {
    expect(buildDungeonDetail(TABLES, 'missing', {}, {}, MAPS)).toBeNull()
  })
})
