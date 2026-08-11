import { describe, expect, it } from 'vitest'
import type { TowerEnemySpawn, TowerWave } from '../model'
import { buildWaveMapBounds, waveMapHighlightState, waveMapPoint } from './wave-map'

function enemy(overrides: Partial<TowerEnemySpawn> = {}): TowerEnemySpawn {
  return {
    id: 'enemy-a',
    templateId: 'enemy-a-template',
    name: 'Enemy A',
    level: 20,
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

function wave(enemies: TowerEnemySpawn[]): TowerWave {
  return {
    id: '1',
    mode: 'Sequence',
    repeatable: false,
    maxAlive: 0,
    externallyControlled: false,
    enemies
  }
}

describe('season tower wave map', () => {
  it('derives symmetric bounds and stable stacked positions from real spawn coordinates', () => {
    const enemies = [
      enemy({ positionX: -8, positionZ: 4 }),
      enemy({ id: 'enemy-b', positionX: 8, positionZ: -4 }),
      enemy({ id: 'enemy-c', positionX: -8, positionZ: 4 })
    ]
    const currentWave = wave(enemies)
    const bounds = buildWaveMapBounds([currentWave])

    expect(bounds).toEqual({ halfX: 10, halfZ: 6 })
    expect(waveMapPoint(enemies[0]!, 0, currentWave, bounds!)).toMatchObject({
      left: 10,
      top: 16.666666666666664,
      stackIndex: 0
    })
    expect(waveMapPoint(enemies[2]!, 2, currentWave, bounds!).stackIndex).toBe(1)
  })

  it('links enemy, source group, and target group highlights only within the active wave', () => {
    const source = enemy({ id: 'enemy-source', groupKey: 'group-a', targetGroupKey: 'group-b' })
    const sameGroup = enemy({ id: 'enemy-other', groupKey: 'group-a' })
    const targetGroup = enemy({ id: 'enemy-target', groupKey: 'group-b' })
    const highlight = {
      waveIndex: 2,
      enemyId: source.id,
      groupKey: source.groupKey,
      targetGroupKey: source.targetGroupKey ?? ''
    }

    expect(waveMapHighlightState(source, 2, highlight)).toEqual({
      enemy: true,
      group: true,
      target: false
    })
    expect(waveMapHighlightState(sameGroup, 2, highlight).group).toBe(true)
    expect(waveMapHighlightState(targetGroup, 2, highlight).target).toBe(true)
    expect(waveMapHighlightState(targetGroup, 1, highlight)).toEqual({
      enemy: false,
      group: false,
      target: false
    })
  })
})
