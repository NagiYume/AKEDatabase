import { describe, expect, it } from 'vitest'
import { buildDungeonMapBounds, dungeonMapHighlight, dungeonMapPoints } from './wave-map'

const enemies = [
  { id: 'alpha', groupKey: 'group-a', targetGroupKey: '', positionX: -4, positionZ: 2 },
  { id: 'beta', groupKey: 'group-b', targetGroupKey: 'group-a', positionX: 4, positionZ: -2 },
  { id: 'beta-copy', groupKey: 'group-b', targetGroupKey: 'group-a', positionX: 4, positionZ: -2 }
]

describe('dungeon spawn map', () => {
  it('uses symmetric bounds and stacks enemies sharing a coordinate', () => {
    const bounds = buildDungeonMapBounds(enemies)
    expect(bounds).toMatchObject({ minX: -6, maxX: 6, minZ: -4, maxZ: 4 })
    expect(bounds && dungeonMapPoints(enemies, bounds).map((point) => point.stack)).toEqual([0, 0, 1])
  })

  it('links the hovered enemy, its group, and dependency target', () => {
    expect(dungeonMapHighlight(enemies[2]!, enemies[1]!)).toEqual({
      enemy: false,
      group: true,
      target: false
    })
    expect(dungeonMapHighlight(enemies[0]!, enemies[1]!)).toMatchObject({ target: true })
  })
})
