import type { TowerEnemySpawn, TowerWave } from '../model'

export interface WaveMapBounds {
  halfX: number
  halfZ: number
}

export interface WaveMapHighlight {
  waveIndex: number
  enemyId: string
  groupKey: string
  targetGroupKey: string
}

export interface WaveMapPoint {
  left: number
  top: number
  stackIndex: number
}

export interface WaveMapHighlightState {
  enemy: boolean
  group: boolean
  target: boolean
}

export function buildWaveMapBounds(waves: readonly TowerWave[]): WaveMapBounds | null {
  const enemies = waves.flatMap((wave) => wave.enemies)
  if (!enemies.length) return null
  return {
    halfX: Math.max(1, ...enemies.map((enemy) => Math.abs(enemy.positionX))) + 2,
    halfZ: Math.max(1, ...enemies.map((enemy) => Math.abs(enemy.positionZ))) + 2
  }
}

export function waveMapPoint(
  enemy: TowerEnemySpawn,
  index: number,
  wave: TowerWave,
  bounds: WaveMapBounds
): WaveMapPoint {
  const stackIndex = wave.enemies
    .slice(0, index)
    .filter(
      (candidate) => candidate.positionX === enemy.positionX && candidate.positionZ === enemy.positionZ
    ).length
  return {
    left: ((enemy.positionX + bounds.halfX) / (bounds.halfX * 2)) * 100,
    top: ((bounds.halfZ - enemy.positionZ) / (bounds.halfZ * 2)) * 100,
    stackIndex
  }
}

export function waveMapHighlightState(
  enemy: TowerEnemySpawn,
  waveIndex: number,
  highlight: WaveMapHighlight | null
): WaveMapHighlightState {
  if (!highlight || highlight.waveIndex !== waveIndex) {
    return { enemy: false, group: false, target: false }
  }
  return {
    enemy: enemy.id === highlight.enemyId,
    group: Boolean(highlight.groupKey && enemy.groupKey === highlight.groupKey),
    target: Boolean(highlight.targetGroupKey && enemy.groupKey === highlight.targetGroupKey)
  }
}
