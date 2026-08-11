import { expect, test, type Page } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@dungeon',
  sharedRevision: 'dungeon-contract',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@dungeon',
      gameVersion: '1.4.4',
      hotfixVersion: 'dungeon',
      tableCfgPath: 'public/1.4.4/dungeon/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

const TABLES: Readonly<Record<string, unknown>> = {
  DungeonSeriesTable: {
    series_resource: {
      name: 'Resource operation',
      desc: 'A resource operation series.',
      staminaText: '20',
      gameCategory: 'dungeon_resource',
      includeDungeonIds: ['stage_resource'],
      dungeonPicPath: 'series_resource_bg',
      dungeonRoleImg: 'enemy_alpha_template'
    },
    series_boss: {
      name: 'Boss operation',
      gameCategory: 'dungeon_highdifficulty',
      includeDungeonIds: []
    }
  },
  DungeonTable: {
    stage_resource: {
      dungeonName: 'Supply breach',
      dungeonLevelDesc: 'Hard',
      dungeonDesc: 'Break through the supply line.',
      featureDesc: 'Enemy pressure rises over time.',
      mainGoalDesc: 'Defeat every enemy.',
      extraGoalDesc: 'No operator is incapacitated.',
      costStamina: 20,
      recommendLv: 30,
      dungeonCategory: 'dungeon_resource',
      dungeonPicPath: 'stage_resource_bg',
      dungeonImg: 'stage_resource_icon',
      sceneId: 'scene_dungeon',
      enemyIds: ['enemy_alpha', 'enemy_beta'],
      enemyLevels: [30, 30],
      rewardId: 'reward_fixed',
      firstPassRewardId: 'reward_first',
      hunterModeRewardId: 'reward_hunter',
      hunterModeCostStamina: 40
    }
  },
  RewardTable: {
    reward_fixed: { itemBundles: [{ id: 'item_fixed', count: 2 }] },
    reward_first: { itemBundles: [{ id: 'item_first', count: 1 }] },
    reward_hunter: {
      itemBundles: [{ id: 'item_hunter', count: 3 }],
      probItemBundles: [{ id: 'item_random', count: 1 }]
    }
  },
  ItemTable: {
    item_fixed: { name: 'Fixed material', iconId: 'item_fixed', rarity: 2 },
    item_first: { name: 'First-clear token', iconId: 'item_first', rarity: 3 },
    item_hunter: { name: 'Hunter material', iconId: 'item_hunter', rarity: 4 },
    item_random: { name: 'Random material', iconId: 'item_random', rarity: 5 }
  },
  EnemyTable: {
    enemy_alpha: {
      templateId: 'enemy_alpha_template',
      attrTemplateId: 'enemy_alpha_attr',
      bornBuffs: ['buff_born'],
      attrModifiers: [{ attrType: 1, attrValue: 5, modifierType: 0 }],
      isDangerous: true
    },
    enemy_beta: {
      templateId: 'enemy_beta_template',
      attrTemplateId: 'enemy_beta_attr',
      bornBuffs: [],
      showBigEffect: true
    }
  },
  EnemyTemplateDisplayInfoTable: {
    enemy_alpha_template: { name: 'Alpha enemy', nickname: 'Alpha', description: 'Front-line enemy.' },
    enemy_beta_template: { name: 'Beta enemy', nickname: 'Beta', description: 'Rear-line enemy.' }
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
    },
    enemy_beta_attr: {
      levelDependentAttributes: [
        {
          attrs: [
            { attrType: 0, attrValue: 30 },
            { attrType: 1, attrValue: 120 }
          ]
        }
      ],
      levelIndependentAttributes: { attrs: [{ attrType: 3, attrValue: 60 }] }
    }
  }
}

const SPAWNER = {
  configId: 'sc_scene_dungeon_10',
  enemyLibrary: [
    {
      key: 'alpha',
      enemyId: 'enemy_alpha',
      enemyLevel: 30,
      bornBuffList: [{ buffId: 'buff_spawner', blackboard: [] }],
      preWarnTime: 1
    },
    { key: 'beta', enemyId: 'enemy_beta', enemyLevel: 30, bornBuffList: [], preWarnTime: 2 }
  ],
  waveMap: {
    '1': {
      waveMode: 'Parallel',
      groupMap: {
        alpha: {
          groupKey: 'group-alpha',
          groupMode: 'Sequence',
          actionMap: {
            alpha: {
              $type: 'SpawnMonsterFromTemplateV2',
              libraryKey: 'alpha',
              spawnCount: 2,
              position: { x: -4, z: 2 }
            }
          }
        },
        beta: {
          groupKey: 'group-beta',
          groupMode: 'PartKilled',
          groupModeTargetKey: 'group-alpha',
          groupModeKillCount: 1,
          actionMap: {
            beta: {
              $type: 'SpawnMonsterFromTemplateV2',
              libraryKey: 'beta',
              spawnCount: 1,
              timestamp: 3,
              randomizeRadius: 2,
              position: { x: 4, z: -2 }
            }
          }
        }
      }
    }
  }
}

const LEVEL_SCRIPT = {
  scriptId: 'script_dungeon',
  modules: { combat: { spawnerId: '10' } },
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

const BUFF = {
  attributeModifier: {
    attributeModifiers: [{ attributeType: 'MaxHP', formulaItem: 'Addition', param: { value: 10 } }]
  }
}

async function installPreferences(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'EN', theme: 'light', showHidden: false })
    )
  })
}

async function mockDungeonData(page: Page): Promise<void> {
  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (pathname.endsWith('/public/Json/SpawnerConfig/scene_dungeon/manifest.json')) {
      await route.fulfill({
        json: [
          {
            id: SPAWNER.configId,
            contentFile: `/public/Json/SpawnerConfig/scene_dungeon/${SPAWNER.configId}.json`
          }
        ]
      })
      return
    }
    if (pathname.endsWith(`/public/Json/SpawnerConfig/scene_dungeon/${SPAWNER.configId}.json`)) {
      await route.fulfill({ json: SPAWNER })
      return
    }
    if (pathname.endsWith('/public/Json/LevelScriptData/scene_dungeon/manifest.json')) {
      await route.fulfill({
        json: [
          {
            id: LEVEL_SCRIPT.scriptId,
            contentFile: `/public/Json/LevelScriptData/scene_dungeon/${LEVEL_SCRIPT.scriptId}.json`
          }
        ]
      })
      return
    }
    if (pathname.endsWith(`/public/Json/LevelScriptData/scene_dungeon/${LEVEL_SCRIPT.scriptId}.json`)) {
      await route.fulfill({ json: LEVEL_SCRIPT })
      return
    }
    if (pathname.includes('/public/Json/BuffData/')) {
      await route.fulfill({ json: BUFF })
      return
    }
    const table = Object.entries(TABLES).find(([name]) => pathname.endsWith(`/${name}.json`))
    if (table) {
      await route.fulfill({ json: table[1] })
      return
    }
    if (pathname.endsWith('/maps.json')) {
      await route.fulfill({
        json: {
          ATTR_MAP: { 0: 'Level', 1: 'HP', 3: 'Defense' },
          ATTR_MAP_EN: { 0: 'Level', 1: 'MaxHP', 3: 'Defense' },
          MODIFIER_TYPE_MAP: { 0: 'Addition' }
        }
      })
      return
    }
    if (pathname.includes('/I18nTextTable_')) {
      await route.fulfill({ json: {} })
      return
    }
    if (pathname.startsWith('/public/images/')) {
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill({ json: {} })
  })
}

test.beforeEach(async ({ page }) => {
  await installPreferences(page)
  await mockDungeonData(page)
})

test('dungeon restores grouped overview, ordered detail cards, rewards, buffs, and linked map', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The detailed dungeon contract runs on desktop.')
  await page.goto('/module/v3_dungeon?view=legacy')

  expect(new URL(page.url()).searchParams.get('id')).toBeNull()
  await expect(page.locator('[data-dungeon-view="overview"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'High difficulty' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Resource' })).toBeVisible()

  await page.locator('.dungeon-sidebar .dungeon-directory__item', { hasText: 'Resource operation' }).click()
  expect(new URL(page.url()).searchParams.get('id')).toBe('series_resource')
  expect(new URL(page.url()).searchParams.get('view')).toBe('legacy')
  await expect(page.getByRole('heading', { name: 'Resource operation', exact: true })).toBeVisible()
  await expect(page.locator('[data-dungeon-region]')).toHaveCount(4)
  await expect(page.locator('[data-dungeon-card-region]')).toHaveCount(7)
  await expect(page.locator('[data-dungeon-wave-map]')).toBeVisible()
  await expect(page.getByText('Fixed material ×2')).toBeVisible()
  await expect(page.getByText('First-clear token ×1')).toBeVisible()
  await expect(page.getByText('Random material ×1')).toBeVisible()
  await expect(
    page.locator('.dungeon-enemy-card[data-enemy-id="enemy_alpha"] [data-buff-source]')
  ).toHaveCount(3)
  await expect(page.locator('.dungeon-enemy-stats')).toHaveCount(2)

  const beta = page.locator('.dungeon-wave-enemy[data-enemy-id="enemy_beta"]')
  await beta.hover()
  await expect(page.locator('.dungeon-map-spot[data-enemy-id="enemy_beta"]')).toHaveClass(/group-highlight/)
  await expect(page.locator('.dungeon-map-spot[data-enemy-id="enemy_alpha"]')).toHaveClass(/target-highlight/)
})

test('dungeon mobile drawer writes query id only after an explicit selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The drawer contract runs on mobile.')
  await page.goto('/module/v3_dungeon?view=legacy')

  expect(new URL(page.url()).searchParams.get('id')).toBeNull()
  await page.getByRole('button', { name: 'Dungeon list', exact: true }).click()
  const drawer = page.locator('.ake-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('.dungeon-directory__item', { hasText: 'Resource operation' }).click()

  await expect(drawer).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('id')).toBe('series_resource')
  expect(new URL(page.url()).searchParams.get('view')).toBe('legacy')
  await expect(page.getByRole('heading', { name: 'Resource operation', exact: true })).toBeVisible()
})
