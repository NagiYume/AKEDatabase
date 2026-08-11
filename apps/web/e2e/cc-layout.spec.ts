import { expect, test, type Page } from '@playwright/test'

const APP_ORIGIN = 'http://127.0.0.1:4173'
const DATA_ORIGIN = 'https://data.akedata.wiki'
const FROZEN_NOW = Date.parse('2026-08-11T12:00:00+08:00')

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@cc-layout',
  sharedRevision: 'cc-layout-contract',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@cc-layout',
      gameVersion: '1.4.4',
      hotfixVersion: 'cc-layout',
      tableCfgPath: 'public/1.4.4/cc-layout/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

function text(value: string) {
  return { id: value, text: value }
}

const TABLES: Record<string, unknown> = {
  ActivityContingencyContractTable: {
    activity_cc_active: {
      activityId: 'activity_cc_active',
      gameId: 'game_cc_active',
      type: 30,
      gameplayEndStageId: 'cc_stage_3',
      tagMaxColumn: 24,
      compareToMoneyCount: 999,
      shopGroupId: 'shop_cc',
      scoreBand: [5]
    },
    activity_cc_upcoming: { activityId: 'activity_cc_upcoming', gameId: 'game_cc_upcoming', type: 30 },
    activity_cc_ended: { activityId: 'activity_cc_ended', gameId: 'game_cc_ended', type: 30 },
    activity_cc_permanent: { activityId: 'activity_cc_permanent', gameId: 'game_cc_permanent', type: 30 }
  },
  ActivityTable: {
    activity_cc_active: {
      name: text('深境合约'),
      tabImg: 'activity_tab_cc',
      timeId: 'time_cc_active',
      sortId: 1
    },
    activity_cc_upcoming: {
      name: text('未来合约'),
      tabImg: 'activity_tab_cc',
      timeId: 'time_cc_upcoming',
      sortId: 2
    },
    activity_cc_ended: {
      name: text('往期合约'),
      tabImg: 'activity_tab_cc',
      timeId: 'time_cc_ended',
      sortId: 3
    },
    activity_cc_permanent: {
      name: text('常驻合约'),
      tabImg: 'activity_tab_cc',
      timeId: 'time_cc_permanent',
      sortId: 4
    }
  },
  TimeRangeTable: {
    time_cc_active: {
      timeRangeList: [{ openTime: '2026/8/1 00:00:00', closeTime: '2026/8/31 23:59:59' }]
    },
    time_cc_upcoming: {
      timeRangeList: [{ openTime: '2026/9/1 00:00:00', closeTime: '2026/9/30 23:59:59' }]
    },
    time_cc_ended: {
      timeRangeList: [{ openTime: '2026/6/1 00:00:00', closeTime: '2026/6/30 23:59:59' }]
    },
    time_cc_permanent: { timeRangeList: [{ openTime: '2020/1/1 00:00:00', closeTime: '' }] }
  },
  ContingencyContractTable: {
    game_cc_active: {
      activityId: 'activity_cc_active',
      contractGroupMap: {
        1: {
          contractMap: {
            1: {
              tagId: 100,
              groupId: 100,
              keyId: 'key-a',
              lockIds: [],
              conflictId: '',
              canPreview: false
            },
            2: {
              tagId: 101,
              groupId: 101,
              keyId: '',
              lockIds: ['key-a'],
              conflictId: '',
              canPreview: false
            }
          }
        },
        2: {
          contractMap: {
            1: {
              tagId: 102,
              groupId: 102,
              keyId: '',
              lockIds: [],
              conflictId: 'conflict-a',
              canPreview: true
            },
            2: {
              tagId: 103,
              groupId: 103,
              keyId: '',
              lockIds: [],
              conflictId: 'conflict-a',
              canPreview: true
            }
          }
        }
      }
    },
    game_cc_upcoming: { activityId: 'activity_cc_upcoming', contractGroupMap: {} },
    game_cc_ended: { activityId: 'activity_cc_ended', contractGroupMap: {} },
    game_cc_permanent: { activityId: 'activity_cc_permanent', contractGroupMap: {} }
  },
  CcTagTable: {
    100: {
      name: text('战术许可'),
      desc: text('取得后解锁高阶条款'),
      icon: 'key_term',
      romanNumSuffix: 'I',
      score: 2,
      tagTerms: [{ termType: 0, buffId: '', blackboard: [] }]
    },
    101: {
      name: text('敌方生命提升'),
      desc: text('敌方生命提升 {ratio:0%}'),
      icon: 'enemy_hp',
      romanNumSuffix: 'II',
      score: 4,
      tagTerms: [{ termType: 1, buffId: 'buff_cc_hp', blackboard: [{ key: 'ratio', valueDouble: 0.5 }] }]
    },
    102: {
      name: text('限时作战 I'),
      desc: text('缩短少量时间'),
      icon: 'timer_1',
      romanNumSuffix: 'I',
      score: 3,
      tagTerms: [{ termType: 3, buffId: '', blackboard: [{ key: 'time', valueInt: 30 }] }]
    },
    103: {
      name: text('限时作战 II'),
      desc: text('缩短大量时间'),
      icon: 'timer_2',
      romanNumSuffix: 'II',
      score: 5,
      tagTerms: [{ termType: 3, buffId: '', blackboard: [{ key: 'time', valueInt: 60 }] }]
    }
  },
  CcTagTipTable: {
    101: { formationTip: text('编队时留意生存能力'), battleHUDTip: text('敌方生命已提升') }
  },
  ContingencyContractKeyLockTable: { 'key-a': { keyId: 'key-a', name: text('战术许可') } },
  ContingencyContractLevelTable: {
    game_cc_active: { levelMap: { 1: { level: 2, firstReward: 'reward_level' } } }
  },
  RewardTable: {
    reward_level: { itemBundles: [{ id: 'item_token', count: 20 }] },
    reward_good: { itemBundles: [{ id: 'item_material', count: 2 }] },
    reward_task: { itemBundles: [{ id: 'item_token', count: 5 }] }
  },
  ItemTable: {
    item_token: { name: text('合约代币'), iconId: 'token', rarity: 4 },
    item_material: { name: text('强化材料'), iconId: 'material', rarity: 3 },
    money_cc: { name: text('合约代币'), iconId: 'token', rarity: 4 }
  },
  ShopGroupTable: {
    shop_cc: { shopGroupId: 'shop_cc', shopGroupName: text('合约兑换所'), shopIds: ['shop_cc_main'] }
  },
  ShopTable: {
    shop_cc_main: { shopId: 'shop_cc_main', shopName: text('本期兑换'), shopGoodsIds: ['goods_cc'] }
  },
  ShopGoodsTable: {
    goods_cc: {
      goodsId: 'goods_cc',
      rewardId: 'reward_good',
      moneyId: 'money_cc',
      price: 100,
      cnDiscount: 0.8,
      limitCount: 2
    }
  },
  ActivityContingencyContractTaskGroupTable: {
    task_group: {
      taskGroupId: 'task_group',
      name: text('合约里程碑'),
      icon: 'task_group_icon',
      canUpdate: true,
      totalTaskNum: 1,
      sortId: 1
    }
  },
  ActivityConditionalMultiStageTaskConfigTable: {
    activity_cc_active: {
      TaskConfigMap: {
        task_cc: {
          taskId: 'task_cc',
          taskGroupId: 'task_group',
          desc: text('合约分数达到 6'),
          rewardId: 'reward_task',
          sortId: 1
        }
      }
    }
  },
  DungeonSeriesTable: {
    series_cc: { id: 'series_cc', gameCategory: 'dungeon_contract', includeDungeonIds: ['game_cc_active'] }
  },
  DungeonTable: {
    game_cc_active: {
      dungeonName: text('深境试炼'),
      dungeonDesc: text('击败所有敌人'),
      mainGoalDesc: text('清除目标'),
      featureDesc: text('条款会实时改变敌人属性'),
      recommendLv: 10,
      sceneId: 'scene_cc',
      enemyIds: ['enemy_cc'],
      enemyLevels: [10]
    },
    game_cc_upcoming: { dungeonName: text('未来试炼') },
    game_cc_ended: { dungeonName: text('往期试炼') },
    game_cc_permanent: { dungeonName: text('常驻试炼') }
  },
  EnemyTable: {
    enemy_cc: {
      templateId: 'enemy_cc_template',
      attrTemplateId: 'enemy_cc_attrs',
      bornBuffs: [],
      attrModifiers: [],
      isDangerous: true
    }
  },
  EnemyTemplateDisplayInfoTable: {
    enemy_cc_template: {
      name: text('重装敌人'),
      nickname: text('铁壁'),
      description: text('拥有较高生命值')
    }
  },
  EnemyAttributeTemplateTable: {
    enemy_cc_attrs: {
      levelDependentAttributes: [
        {
          attrs: [
            { attrType: 0, attrValue: 10 },
            { attrType: 1, attrValue: 100 },
            { attrType: 2, attrValue: 20 }
          ]
        }
      ],
      levelIndependentAttributes: { attrs: [] }
    }
  }
}

const SPAWNER = {
  configId: 'sc_scene_cc_main',
  enemyLibrary: [{ key: 'enemy', enemyId: 'enemy_cc', enemyLevel: 10, preWarnTime: 1, bornBuffList: [] }],
  waveMap: {
    1: {
      waveMode: 'Sequence',
      groupMap: {
        main: {
          groupKey: 'main',
          groupMode: 'Sequence',
          actionMap: {
            spawn: {
              $type: 'SpawnEnemy',
              libraryKey: 'enemy',
              spawnCount: 2,
              timestamp: 1,
              spawnInterval: 0.5,
              position: { x: 1, z: 2 }
            }
          }
        }
      }
    }
  }
}

const BUFF = {
  blackboard: [{ key: 'ratio', valueDouble: 0.1 }],
  attributeModifier: {
    attributeModifiers: [
      {
        attributeType: 'MaxHp',
        formulaItem: 'Multiplier',
        param: { useBlackboardKey: true, blackboardKey: 'ratio', value: 0.1 }
      }
    ]
  }
}

interface MockState {
  unexpectedRequests: string[]
  imageRequests: string[]
}

async function installCcFixture(page: Page): Promise<MockState> {
  const state: MockState = { unexpectedRequests: [], imageRequests: [] }
  await page.addInitScript((now) => {
    Date.now = () => now
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'CH', theme: 'light', showHidden: true })
    )
  }, FROZEN_NOW)

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === APP_ORIGIN) {
      await route.continue()
      return
    }
    if (url.origin !== DATA_ORIGIN) {
      state.unexpectedRequests.push(url.href)
      await route.abort('blockedbyclient')
      return
    }
    if (url.pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (url.pathname.startsWith('/public/images/')) {
      state.imageRequests.push(url.href)
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#176f78"/></svg>'
      })
      return
    }
    if (url.pathname.endsWith('/public/CH/maps.json')) {
      await route.fulfill({
        json: {
          ATTR_MAP: { 0: '等级', 1: '生命', 2: '攻击' },
          ATTR_MAP_EN: { 0: 'Level', 1: 'MaxHp', 2: 'Atk' },
          MODIFIER_TYPE_MAP: { 1: '乘算' }
        }
      })
      return
    }
    if (url.pathname.endsWith('/public/Json/LevelData/scene_cc/scene_cc_lv_data.json')) {
      await route.fulfill({ json: { id: 'scene_cc', sceneId: 'scene_cc' } })
      return
    }
    if (url.pathname.endsWith('/public/Json/SpawnerConfig/scene_cc/manifest.json')) {
      await route.fulfill({ json: [{ id: 'main' }] })
      return
    }
    if (url.pathname.endsWith('/public/Json/SpawnerConfig/scene_cc/main.json')) {
      await route.fulfill({ json: SPAWNER })
      return
    }
    if (url.pathname.endsWith('/public/Json/LevelScriptData/scene_cc/manifest.json')) {
      await route.fulfill({ json: [{ id: 'script' }] })
      return
    }
    if (url.pathname.endsWith('/public/Json/LevelScriptData/scene_cc/script.json')) {
      await route.fulfill({ json: { scriptId: 'script', actionMap: { dataMap: { actionList: [] } } } })
      return
    }
    if (url.pathname.endsWith('/public/Json/BuffData/buff_cc_hp.json')) {
      await route.fulfill({ json: BUFF })
      return
    }
    const tableName = url.pathname.match(/\/([^/]+)\.json$/)?.[1] ?? ''
    if (tableName === 'I18nTextTable_CN') {
      await route.fulfill({ json: {} })
      return
    }
    if (tableName in TABLES) {
      await route.fulfill({ json: TABLES[tableName] })
      return
    }
    state.unexpectedRequests.push(url.href)
    await route.fulfill({ status: 404, json: {} })
  })
  return state
}

async function expectDetailOrder(page: Page) {
  expect(
    await page
      .locator('[data-cc-detail-block]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-cc-detail-block')))
  ).toEqual([
    'activity-configuration',
    'contract-terms',
    'selected-term-details',
    'dungeon-enemies',
    'level-rewards',
    'shop',
    'tasks'
  ])
}

test('desktop CC restores overview, strict detail order, term rules, and live enemy attributes', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop layout contract runs once.')
  const state = await installCcFixture(page)

  await page.goto('/module/v3_cc')
  await expect(page.locator('.cc-overview h1')).toBeVisible()
  expect(new URL(page.url()).searchParams.has('id')).toBe(false)
  expect(await page.locator('main').count()).toBe(1)
  await expect
    .poll(async () => Math.round((await page.locator('.cc-sidebar').boundingBox())?.width ?? 0))
    .toBe(260)
  await expect(page.locator('[data-status-group="active"]')).toBeVisible()
  await expect(page.locator('[data-status-group="upcoming"]')).toBeVisible()
  await expect(page.locator('[data-status-group="ended"]')).toBeVisible()
  await expect(page.locator('[data-status-group="permanent"]')).toBeVisible()

  await page.locator('.cc-overview-card[data-game-id="game_cc_active"]').click()
  await expect(page).toHaveURL(/\/module\/v3_cc\?id=game_cc_active$/)
  await expect(page.getByRole('heading', { name: '深境合约', exact: true })).toBeVisible()
  await expectDetailOrder(page)
  await expect(page.getByText('合约兑换所')).toBeVisible()
  await expect(page.getByText('合约里程碑')).toBeVisible()

  const score = page.locator('[data-cc-score]')
  const keyTerm = page.locator('[data-term-id="100"]')
  const hpTerm = page.locator('[data-term-id="101"]')
  const conflictA = page.locator('[data-term-id="102"]')
  const conflictB = page.locator('[data-term-id="103"]')
  const health = page.locator('[data-enemy-id="enemy_cc"] [data-attribute-type="1"] strong')

  await expect(score).toHaveText('0')
  await expect(hpTerm).toBeDisabled()
  await expect(health).toHaveText('100')
  await keyTerm.click()
  await expect(score).toHaveText('2')
  await expect(hpTerm).toBeEnabled()
  await hpTerm.click()
  await expect(score).toHaveText('6')
  await expect(health).toHaveText('150')
  await expect(page.getByText('敌方生命提升', { exact: true })).toHaveCount(2)

  await conflictA.click()
  await expect(score).toHaveText('9')
  await expect(conflictB).toBeDisabled()

  await page.locator('.cc-sidebar input[type="search"]').fill('does-not-match')
  await expect(page.getByRole('heading', { name: '深境合约', exact: true })).toBeVisible()
  await expect(page.locator('.cc-sidebar [data-game-id="game_cc_active"]')).toHaveCount(0)

  await page.getByRole('button', { name: '重置' }).click()
  await expect(score).toHaveText('0')
  await expect(health).toHaveText('100')
  expect(state.imageRequests.length).toBeGreaterThan(0)
  expect(state.unexpectedRequests).toEqual([])
})

test('mobile CC uses ResponsiveDrawer and keeps interactive detail within the viewport', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile drawer contract runs once.')
  const state = await installCcFixture(page)

  await page.goto('/module/v3_cc')
  await expect(page.locator('.cc-sidebar')).toBeHidden()
  expect(new URL(page.url()).searchParams.has('id')).toBe(false)
  await page.locator('.cc-mobile-button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.ake-drawer [data-game-id="game_cc_active"]').click()

  await expect(page).toHaveURL(/\/module\/v3_cc\?id=game_cc_active$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '深境合约', exact: true })).toBeVisible()
  await expectDetailOrder(page)

  await page.locator('[data-term-id="100"]').click()
  await page.locator('[data-term-id="101"]').click()
  await expect(page.locator('[data-cc-score]')).toHaveText('6')
  await expect(page.locator('[data-enemy-id="enemy_cc"] [data-attribute-type="1"] strong')).toHaveText('150')
  expect(await page.locator('main').count()).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(state.unexpectedRequests).toEqual([])
})
