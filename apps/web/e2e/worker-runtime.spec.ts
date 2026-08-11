import { expect, test } from '@playwright/test'

const DATA_MANIFEST = {
  schemaVersion: 1,
  latest: '1.4.4@worker-test',
  sharedRevision: 'worker-test',
  updatedAt: '2026-08-11T00:00:00.000Z',
  versions: [
    {
      id: '1.4.4@worker-test',
      gameVersion: '1.4.4',
      hotfixVersion: 'worker-test',
      tableCfgPath: 'public/1.4.4/worker-test/TableCfg',
      publishedAt: '2026-08-11T00:00:00.000Z'
    }
  ]
}

test.beforeEach(async ({ page }) => {
  await page.route('https://data.akedata.wiki/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    await route.fulfill({ json: pathname === '/manifest.json' ? DATA_MANIFEST : {} })
  })
})

test('data worker handles parsing, indexing, combat analysis and ELK layout', async ({ page }) => {
  const workerUrls: string[] = []
  page.on('worker', (worker) => workerUrls.push(worker.url()))
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/shared/workers/data-worker-client.ts'
    const { DataWorkerClient } = (await import(
      moduleUrl
    )) as typeof import('../src/shared/workers/data-worker-client')
    const client = new DataWorkerClient()
    const skillData = {
      skillId: 'worker_e2e',
      timelineActions: [
        {
          _startFrame: 0,
          _endFrame: 30,
          _sequenceActionData: {
            actionData: [
              {
                $type: 'Beyond.Gameplay.Core.MoveAction+MoveActionData, Gameplay.Beyond',
                isEnable: true,
                priorityLevel: 'Default',
                priorityOffset: 0,
                serverActionIndex: 0
              },
              {
                $type: 'Beyond.Gameplay.Core.IfElseAction+IfElseActionData, Gameplay.Beyond',
                isEnable: true,
                priorityLevel: 'Default',
                priorityOffset: 0,
                serverActionIndex: 1,
                conditionAction: {
                  actionData: [
                    {
                      $type: 'Beyond.Gameplay.Core.CheckTargetAction+CheckTargetActionData, Gameplay.Beyond',
                      isEnable: true
                    }
                  ]
                },
                succeedActions: {
                  actionData: [
                    {
                      $type: 'Beyond.Gameplay.Core.DamageAction+DamageActionData, Gameplay.Beyond',
                      isEnable: true,
                      frame: 15
                    }
                  ]
                },
                failActions: {
                  actionData: [
                    {
                      $type: 'Beyond.Gameplay.Core.CreateBuffAction+CreateBuffActionData, Gameplay.Beyond',
                      isEnable: true
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }

    try {
      const [parsed, index, graph] = await Promise.all([
        client.parseJson<{ safe: number; unsafe: string }>('{"safe":7,"unsafe":900719925474099312345}'),
        client.buildSearchIndex(
          [
            { id: 'alpha', name: 'First Entry', category: 'Skill' },
            { id: 'beta', name: 'Second Entry', category: 'Buff' }
          ],
          ['name', 'category']
        ),
        client.analyzeCombat('skill', JSON.stringify(skillData), {
          nodeBudget: 100,
          includePerformance: true
        })
      ])
      const layout = await client.layout(graph, 'RIGHT')
      return {
        parsed,
        index,
        nodeCount: graph.nodes.length,
        layoutNodeCount: layout.nodes.length,
        layoutWidth: layout.width,
        layoutHeight: layout.height
      }
    } finally {
      client.terminate()
    }
  })

  expect(result.parsed).toEqual({ safe: 7, unsafe: '900719925474099312345' })
  expect(result.index).toEqual({
    alpha: 'first entry\nskill',
    beta: 'second entry\nbuff'
  })
  expect(result.nodeCount).toBeGreaterThan(2)
  expect(result.layoutNodeCount).toBe(result.nodeCount)
  expect(result.layoutWidth).toBeGreaterThan(0)
  expect(result.layoutHeight).toBeGreaterThan(0)
  expect(workerUrls.some((url) => url.includes('data.worker'))).toBe(true)
  expect(workerUrls.some((url) => url.includes('elk-worker'))).toBe(false)
})
