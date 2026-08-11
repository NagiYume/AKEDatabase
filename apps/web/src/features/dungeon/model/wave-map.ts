export interface DungeonMapEnemy {
  id: string
  groupKey: string
  targetGroupKey: string
  positionX: number
  positionZ: number
}

export interface DungeonMapBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  rangeX: number
  rangeZ: number
}

export interface DungeonMapPoint {
  left: number
  top: number
  stack: number
}

export function buildDungeonMapBounds(enemies: readonly DungeonMapEnemy[]): DungeonMapBounds | null {
  if (enemies.length === 0) return null
  const halfX = Math.max(...enemies.map((enemy) => Math.abs(enemy.positionX)), 0) + 2
  const halfZ = Math.max(...enemies.map((enemy) => Math.abs(enemy.positionZ)), 0) + 2
  return {
    minX: -halfX,
    maxX: halfX,
    minZ: -halfZ,
    maxZ: halfZ,
    rangeX: Math.max(halfX * 2, 1),
    rangeZ: Math.max(halfZ * 2, 1)
  }
}

export function dungeonMapPoints(
  enemies: readonly DungeonMapEnemy[],
  bounds: DungeonMapBounds
): DungeonMapPoint[] {
  const positions = new Map<string, number>()
  return enemies.map((enemy) => {
    const key = `${enemy.positionX.toFixed(1)},${enemy.positionZ.toFixed(1)}`
    const stack = positions.get(key) ?? 0
    positions.set(key, stack + 1)
    return {
      left: ((enemy.positionX - bounds.minX) / bounds.rangeX) * 100,
      top: ((bounds.maxZ - enemy.positionZ) / bounds.rangeZ) * 100,
      stack
    }
  })
}

export function dungeonMapHighlight(
  candidate: DungeonMapEnemy,
  source: DungeonMapEnemy | null
): { enemy: boolean; group: boolean; target: boolean } {
  if (!source) return { enemy: false, group: false, target: false }
  return {
    enemy: candidate === source || candidate.id === source.id,
    group: candidate.groupKey !== '' && candidate.groupKey === source.groupKey,
    target: source.targetGroupKey !== '' && candidate.groupKey === source.targetGroupKey
  }
}
