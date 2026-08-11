import { describe, expect, it } from 'vitest'
import type { TableSet } from '@ake/domain'
import {
  buildCcCatalog,
  buildCcDetailBase,
  ccSelectionScore,
  filterCcEntries,
  replaceCcTermPlaceholders,
  toggleCcTerm,
  type CcCatalogEntry,
  type CcContractTerm
} from './index'
import {
  buildCcCombatContext,
  createCcAttributeMaps,
  recalculateCcCombat,
  type CcSceneRuntime
} from './combat'

function entry(overrides: Partial<CcCatalogEntry> = {}): CcCatalogEntry {
  return {
    id: 'game_active',
    activityId: 'activity_active',
    name: 'Active Contract',
    imageId: 'activity_cc',
    openTime: '2026/1/1 00:00:00',
    closeTime: '2026/12/31 23:59:59',
    status: 'active',
    statusOrder: 0,
    dungeonName: 'Contract Dungeon',
    dungeonSeriesId: 'series_cc',
    groupCount: 1,
    termCount: 3,
    hidden: false,
    searchText: 'active contract game_active activity_active',
    ...overrides
  }
}

function term(overrides: Partial<CcContractTerm> = {}): CcContractTerm {
  return {
    id: 'term_plain',
    groupId: '1',
    name: 'Plain term',
    roman: '',
    score: 1,
    description: '',
    iconId: '',
    effects: [],
    keyId: '',
    lockIds: [],
    conflictId: '',
    canPreview: true,
    formationTip: '',
    battleTip: '',
    searchText: '',
    ...overrides
  }
}

describe('CC catalog and legacy detail model', () => {
  it('groups active, upcoming, ended, permanent and keeps hidden permission explicit', () => {
    const activities = {
      activity_active: { name: 'Active', timeId: 'time_active', sortId: 1 },
      activity_upcoming: { name: 'Upcoming', timeId: 'time_upcoming', sortId: 2 },
      activity_ended: { name: 'Ended', timeId: 'time_ended', sortId: 3 },
      activity_permanent: { name: 'Permanent', timeId: 'time_permanent', sortId: 4 },
      activity_hidden: { name: 'Hidden', timeId: 'time_permanent', sortId: 5, hidden: true }
    }
    const contracts = Object.fromEntries(
      Object.keys(activities).map((activityId) => [
        activityId,
        { activityId, gameId: activityId.replace('activity', 'game') }
      ])
    )
    const tables: TableSet = {
      ActivityContingencyContractTable: contracts,
      ActivityTable: activities,
      ContingencyContractTable: {},
      DungeonTable: {},
      DungeonSeriesTable: {},
      TimeRangeTable: {
        time_active: { timeRangeList: [{ openTime: '2026/1/1 00:00:00', closeTime: '2026/12/31 23:59:59' }] },
        time_upcoming: { timeRangeList: [{ openTime: '2027/1/1 00:00:00', closeTime: '2027/2/1 00:00:00' }] },
        time_ended: { timeRangeList: [{ openTime: '2025/1/1 00:00:00', closeTime: '2025/2/1 00:00:00' }] },
        time_permanent: { timeRangeList: [{ openTime: '2020/1/1 00:00:00', closeTime: '' }] }
      }
    }

    const catalog = buildCcCatalog(tables, { now: Date.parse('2026-06-01T00:00:00+08:00') })

    expect(catalog.entries.map((item) => item.status)).toEqual(['active', 'upcoming', 'ended', 'permanent'])
    expect(buildCcCatalog(tables, { showHidden: true }).entries.some((item) => item.hidden)).toBe(true)
    expect(filterCcEntries(catalog.entries, 'GAME_UPCOMING').map((item) => item.id)).toEqual([
      'game_upcoming'
    ])
  })

  it('builds configuration, term metadata, reward, shop, and task sections from CC tables', () => {
    const tables: TableSet = {
      ActivityContingencyContractTable: {
        activity_active: {
          activityId: 'activity_active',
          gameId: 'game_active',
          type: 30,
          gameplayEndStageId: 'stage_3',
          tagMaxColumn: 24,
          compareToMoneyCount: 99,
          shopGroupId: 'shop_group',
          scoreBand: [5]
        }
      },
      ContingencyContractTable: {
        game_active: {
          contractGroupMap: {
            1: {
              contractMap: {
                1: {
                  tagId: '101',
                  groupId: '101',
                  keyId: 'key-a',
                  lockIds: [],
                  conflictId: 'c-a',
                  canPreview: false
                }
              }
            }
          }
        }
      },
      CcTagTable: {
        101: {
          name: 'Enemy pressure',
          desc: 'Health {ratio:0%}',
          score: 3,
          icon: 'buff_hp',
          romanNumSuffix: 'II',
          tagTerms: [{ termType: 1, buffId: 'buff_cc_hp', blackboard: [{ key: 'ratio', value: 0.5 }] }]
        }
      },
      CcTagTipTable: { 101: { formationTip: 'Formation', battleHUDTip: 'Battle' } },
      ContingencyContractLevelTable: {
        game_active: { levelMap: { 1: { level: 2, firstReward: 'reward_level' } } }
      },
      RewardTable: {
        reward_level: { itemBundles: [{ id: 'item_a', count: 2 }] },
        reward_good: { itemBundles: [{ id: 'item_a', count: 1 }] },
        reward_task: { itemBundles: [{ id: 'item_a', count: 3 }] }
      },
      ItemTable: { item_a: { name: 'Item A', iconId: 'item_a_icon', rarity: 4 }, money: { name: 'Coin' } },
      ShopGroupTable: { shop_group: { shopGroupName: 'Contract Shop', shopIds: ['shop_a'] } },
      ShopTable: { shop_a: { shopName: 'Main Shop', shopGoodsIds: ['good_a'] } },
      ShopGoodsTable: {
        good_a: { rewardId: 'reward_good', moneyId: 'money', price: 100, cnDiscount: 0.8, limitCount: 2 }
      },
      ActivityContingencyContractTaskGroupTable: {
        group_a: {
          taskGroupId: 'group_a',
          name: 'Milestones',
          icon: 'task_icon',
          canUpdate: true,
          totalTaskNum: 1,
          sortId: 1
        }
      },
      ActivityConditionalMultiStageTaskConfigTable: {
        config: {
          TaskConfigMap: {
            task_a: {
              taskId: 'task_a',
              taskGroupId: 'group_a',
              desc: 'Reach score 3',
              rewardId: 'reward_task',
              sortId: 1
            }
          }
        }
      }
    }

    const detail = buildCcDetailBase(tables, entry())

    expect(detail.configuration.map((field) => field.key)).toEqual([
      'activityId',
      'gameplayType',
      'stageId',
      'maxTagColumns',
      'currencyAmount',
      'shopGroup'
    ])
    expect(detail.terms['101']).toMatchObject({
      name: 'Enemy pressure',
      description: 'Health 50%',
      keyId: 'key-a',
      conflictId: 'c-a',
      canPreview: false,
      formationTip: 'Formation',
      battleTip: 'Battle'
    })
    expect(detail.levelRewards[0]).toMatchObject({
      level: 2,
      score: 5,
      rewards: [{ name: 'Item A', count: 2 }]
    })
    expect(detail.shop?.shops[0]?.goods[0]).toMatchObject({
      actualPrice: 80,
      discountPercent: 20,
      limitCount: 2
    })
    expect(detail.taskGroups[0]?.tasks[0]).toMatchObject({ id: 'task_a', description: 'Reach score 3' })
  })

  it('evaluates only controlled arithmetic in descriptions', () => {
    expect(replaceCcTermPlaceholders('Value {(base+extra)*2:0}', { base: 2, extra: 3 })).toBe('Value 10')
    expect(replaceCcTermPlaceholders('Blocked {globalThis.process.exit()}', {})).toBe(
      'Blocked {globalThis.process.exit()}'
    )
  })
})

describe('CC term selection and live enemy calculation', () => {
  it('enforces keys and conflicts, cascades deselection, and computes selected score', () => {
    const terms = {
      key: term({ id: 'key', keyId: 'key-a', score: 2 }),
      locked: term({ id: 'locked', lockIds: ['key-a'], score: 4 }),
      conflictA: term({ id: 'conflictA', conflictId: 'same', score: 1 }),
      conflictB: term({ id: 'conflictB', conflictId: 'same', score: 8 })
    }
    let selected = new Set<string>()

    expect(toggleCcTerm(selected, 'locked', terms)).toMatchObject({
      changed: false,
      rejected: { reason: 'keys' }
    })
    selected = toggleCcTerm(selected, 'key', terms).selected
    selected = toggleCcTerm(selected, 'locked', terms).selected
    selected = toggleCcTerm(selected, 'conflictA', terms).selected
    expect(ccSelectionScore(selected, terms)).toBe(7)
    expect(toggleCcTerm(selected, 'conflictB', terms)).toMatchObject({
      changed: false,
      rejected: { reason: 'conflict' }
    })

    selected = toggleCcTerm(selected, 'key', terms).selected
    expect([...selected]).toEqual(['conflictA'])
  })

  it('recalculates enemy attributes from the selected enemy-buff blackboard', () => {
    const terms = {
      hp: term({
        id: 'hp',
        effects: [
          { type: 1, buffId: 'buff_cc_hp', parameters: [{ key: 'ratio', value: 0.5, rawValue: 0.5 }] }
        ]
      })
    }
    const tables: TableSet = {
      DungeonTable: {
        game_active: {
          dungeonName: 'Contract Dungeon',
          sceneId: 'scene_cc',
          recommendLv: 10,
          enemyIds: ['enemy_a'],
          enemyLevels: [10]
        }
      },
      EnemyTable: {
        enemy_a: { templateId: 'enemy_template', attrTemplateId: 'attrs_a', bornBuffs: [], attrModifiers: [] }
      },
      EnemyTemplateDisplayInfoTable: { enemy_template: { name: 'Enemy A' } },
      EnemyAttributeTemplateTable: {
        attrs_a: {
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
    const runtime: CcSceneRuntime = {
      sceneId: 'scene_cc',
      levelData: null,
      spawnerManifestAvailable: false,
      levelScriptManifestAvailable: false,
      missingSpawnerDetails: 0,
      missingLevelScriptDetails: 0,
      spawners: [],
      levelScripts: []
    }
    const maps = createCcAttributeMaps({ ATTR_MAP: { 1: 'Health' }, ATTR_MAP_EN: { 1: 'MaxHp' } })
    const context = buildCcCombatContext({
      tables,
      gameId: 'game_active',
      runtime,
      maps,
      buffs: {
        buff_cc_hp: {
          blackboard: [{ key: 'ratio', valueDouble: 0.1 }],
          attributeModifier: {
            attributeModifiers: [
              {
                attributeType: 'MaxHp',
                formulaItem: 'Multiplier',
                param: { useBlackboardKey: true, blackboardKey: 'ratio' }
              }
            ]
          }
        }
      }
    })

    const base = recalculateCcCombat(context, new Set(), terms)[0]?.enemies[0]?.stats.find(
      (stat) => stat.attrType === 1
    )
    const selected = recalculateCcCombat(context, new Set(['hp']), terms)[0]?.enemies[0]?.stats.find(
      (stat) => stat.attrType === 1
    )

    expect(base?.value).toBe(100)
    expect(selected).toMatchObject({ baseValue: 100, value: 150, changed: true })
  })
})
