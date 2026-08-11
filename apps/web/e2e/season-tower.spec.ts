import { expect, test, type Page } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@tower',
  sharedRevision: 'tower-contract',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@tower',
      gameVersion: '1.4.4',
      hotfixVersion: 'tower',
      tableCfgPath: 'public/1.4.4/tower/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

const TABLES: Readonly<Record<string, unknown>> = {
  SeasonTowerTable: {
    '1': {
      name: 'Echo Season One',
      weeks: {
        '1': { weekShowName: 'Active rotation', includeGameIdList: ['tower_stage_a'] }
      }
    },
    '2': {
      name: 'Echo Season Two',
      weeks: {
        '1': { weekShowName: 'Second rotation', includeGameIdList: ['tower_stage_a'] }
      }
    }
  },
  SeasonTowerGameGroupTable: {
    tower_stage_a: {
      stars: {
        '1': { gameId: 'tower_game_easy', rewardId: 'tower_reward' },
        '3': { gameId: 'tower_game_hard', rewardId: 'tower_reward' }
      }
    }
  },
  GameMechanicGroupTable: {
    tower_stage_a: { gameGroupName: 'Ravine defense' }
  },
  DungeonTable: {
    tower_game_easy: {
      dungeonSeriesId: 'indie_group_twdg',
      recommendLv: 30,
      enemyIds: ['enemy_wolf', 'enemy_guard'],
      enemyLevels: [30, 30],
      featureDesc: 'Hold the field.'
    },
    tower_game_hard: {
      dungeonSeriesId: 'indie_group_twdg',
      recommendLv: 30,
      enemyIds: ['enemy_wolf', 'enemy_guard'],
      enemyLevels: [30, 30],
      featureDesc: 'Hold the field.'
    }
  },
  GameMechanicTable: {
    tower_game_easy: { desc: 'Defeat all enemies.' },
    tower_game_hard: { desc: 'Defeat all enemies.' }
  },
  SeasonTowerDungeonTable: {
    tower_game_easy: { specialBuffDesc: 'Enemy pressure rises.' },
    tower_game_hard: { specialBuffDesc: 'Enemy pressure rises.' }
  },
  RewardTable: {
    tower_reward: { itemBundles: [{ id: 'item_reward', count: 3 }] }
  },
  ItemTable: {
    item_reward: { name: 'Tower medal', iconId: 'item_reward' }
  },
  TimeRangeTable: {
    time_activity_seasontower_season_1_week_1: {
      timeRangeList: [{ openTime: '2026/08/01 00:00:00', closeTime: '2026/08/31 23:59:59' }]
    },
    time_activity_seasontower_season_2_week_1: {
      timeRangeList: [{ openTime: '2026/09/01 00:00:00', closeTime: '2026/09/30 23:59:59' }]
    }
  },
  SeasonTowerConst: { rankStarNum: [3, 6, 9, 12, 15] },
  SeasonTowerRankTable: {
    '1': { rankName: 'Bronze Echo' },
    '6': { rankName: 'Radiant Echo' }
  },
  DungeonSeriesTable: { indie_group_twdg: {} },
  EnemyTable: {
    enemy_wolf: { templateId: 'enemy_wolf_template' },
    enemy_guard: { templateId: 'enemy_guard_template' }
  },
  EnemyTemplateDisplayInfoTable: {
    enemy_wolf_template: { name: 'Ravine wolf' },
    enemy_guard_template: { name: 'Ravine guard' }
  },
  EnemyAttributeTemplateTable: {},
  IntroTable: {
    season_tower: {
      dataArray: [{ id: 'guide', pageIndex: 1, title: 'Rules', desc: 'Clear rotating stages.' }]
    }
  },
  ActivityTable: {
    activity_seasontower_0: {
      name: 'War Echoes',
      desc: 'Seasonal combat trials.',
      tabImg: 'activity_tab_bg_seasontower'
    }
  }
}

const SPAWNER = {
  configId: 'tower_spawner_a',
  enemyLibrary: [
    { key: 'wolf', enemyId: 'enemy_wolf', enemyLevel: 30, bornBuffList: [] },
    { key: 'guard', enemyId: 'enemy_guard', enemyLevel: 30, bornBuffList: [] }
  ],
  waveMap: {
    '1': {
      repeatable: false,
      groupMap: {
        alpha: {
          groupKey: 'group-alpha',
          groupMode: 'Sequence',
          actionMap: {
            wolf: {
              $type: 'SpawnAction',
              libraryKey: 'wolf',
              spawnCount: 2,
              position: { x: -4, z: 2 }
            }
          }
        }
      }
    },
    '2': {
      repeatable: false,
      groupMap: {
        alpha: {
          groupKey: 'group-alpha',
          groupMode: 'Sequence',
          actionMap: {
            wolf: {
              $type: 'SpawnAction',
              libraryKey: 'wolf',
              spawnCount: 1,
              position: { x: -3, z: -2 }
            }
          }
        },
        beta: {
          groupKey: 'group-beta',
          groupMode: 'PartKilled',
          groupModeTargetKey: 'group-alpha',
          groupModeKillCount: 1,
          actionMap: {
            guard: {
              $type: 'SpawnAction',
              libraryKey: 'guard',
              spawnCount: 1,
              position: { x: 4, z: 3 },
              timestamp: 2,
              preWarnTime: 1
            }
          }
        }
      }
    }
  }
}

async function mockTowerData(page: Page): Promise<void> {
  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/manifest.json') {
      await route.fulfill({ json: DATA_MANIFEST })
      return
    }
    if (pathname.endsWith('/public/Json/SpawnerConfig/indie_tower001/manifest.json')) {
      await route.fulfill({
        json: [
          {
            id: 'tower_spawner_a',
            contentFile: 'public/Json/SpawnerConfig/indie_tower001/tower_spawner_a.json'
          }
        ]
      })
      return
    }
    if (pathname.endsWith('/public/Json/SpawnerConfig/indie_tower001/tower_spawner_a.json')) {
      await route.fulfill({ json: SPAWNER })
      return
    }
    if (pathname.endsWith('/public/Json/LevelScriptData/indie_tower001/manifest.json')) {
      await route.fulfill({ json: [] })
      return
    }
    const table = Object.entries(TABLES).find(([name]) => pathname.endsWith(`/${name}.json`))
    if (table) {
      await route.fulfill({ json: table[1] })
      return
    }
    if (pathname.includes('/I18nTextTable_') || pathname.endsWith('/maps.json')) {
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

async function installPreferences(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'EN', theme: 'light', showHidden: false })
    )
  })
}

test.beforeEach(async ({ page }) => {
  await mockTowerData(page)
  await installPreferences(page)
})

test('season tower keeps the legacy single-detail flow and linked wave map', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The detailed map contract runs once on desktop.')
  await page.goto('/module/season_tower?view=legacy')

  expect(new URL(page.url()).searchParams.get('id')).toBeNull()
  await expect(page.getByRole('heading', { name: 'War Echoes · Echo Season One' })).toBeVisible()
  await expect(page.locator('[data-season-region]')).toHaveCount(4)
  await expect(page.locator('.st-week[open]')).toBeVisible()
  await expect(page.locator('.st-difficulty')).toHaveCount(2)
  const combat = page.locator('.tower-combat[open]')
  await expect(combat).toHaveCount(1)
  await expect(combat.locator('[data-tower-wave-map]')).toBeVisible()

  const waveLines = combat.locator('.tower-wave-line')
  await expect(waveLines.first()).toHaveClass(/active/)
  await waveLines.nth(1).locator('.tower-wave-select').click()
  await expect(waveLines.nth(1)).toHaveClass(/active/)
  await expect(combat.locator('.tower-map-spot')).toHaveCount(2)

  const guard = waveLines.nth(1).locator('.tower-wave-enemy[data-enemy-id="enemy_guard"]')
  await guard.hover()
  await expect(combat.locator('.tower-map-spot[data-enemy-id="enemy_guard"]')).toHaveClass(/group-highlight/)
  await expect(combat.locator('.tower-map-spot[data-enemy-id="enemy_wolf"]')).toHaveClass(/target-highlight/)
})

test('season selection writes query id only after an explicit mobile drawer choice', async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The season drawer is mobile-only.')
  await page.goto('/module/season_tower?view=legacy')

  expect(new URL(page.url()).searchParams.get('id')).toBeNull()
  await page.getByRole('button', { name: 'Season', exact: true }).click()
  const drawer = page.locator('.ake-drawer')
  await expect(drawer).toBeVisible()
  await drawer.locator('.st-season-item').nth(1).click()

  await expect(drawer).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('id')).toBe('2')
  expect(new URL(page.url()).searchParams.get('view')).toBe('legacy')
  await expect(page.getByRole('heading', { name: 'War Echoes · Echo Season Two' })).toBeVisible()
})
