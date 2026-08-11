<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageWithFallback } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import type { DungeonSpawn, DungeonWave } from '../model'
import {
  buildDungeonMapBounds,
  dungeonMapHighlight,
  dungeonMapPoints,
  type DungeonMapPoint
} from '../model/wave-map'

const props = defineProps<{ waves: readonly DungeonWave[] }>()

const { client } = useAppContext()
const { t } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      wave: {
        summary: '{waves} waves · {enemies} enemies',
        number: 'Wave {number}',
        repeatable: 'Repeatable',
        alive: 'Alive limit {count}',
        external: 'Externally controlled',
        coordinates: 'X {x} · Z {z}',
        radius: 'Radius {radius}',
        group: 'Group {group}',
        condition: 'Target {target} · defeats {count}',
        delay: 'Delay {seconds}s',
        interval: 'Interval {seconds}s',
        warning: 'Warning {seconds}s',
        facing: 'Faces controlled character',
        map: 'Spawn position map',
        modes: {
          Parallel: 'Parallel',
          Sequence: 'Sequence',
          PartKilled: 'Part killed',
          AllKilled: 'All killed',
          Deadline: 'Deadline'
        }
      }
    },
    CH: {
      wave: {
        summary: '{waves} 波 · {enemies} 名敌人',
        number: '第 {number} 波',
        repeatable: '可重复',
        alive: '在场上限 {count}',
        external: '外部控制',
        coordinates: 'X {x} · Z {z}',
        radius: '半径 {radius}',
        group: '组 {group}',
        condition: '依赖 {target} · 击败 {count}',
        delay: '延迟 {seconds} 秒',
        interval: '间隔 {seconds} 秒',
        warning: '预警 {seconds} 秒',
        facing: '朝向主控角色',
        map: '出生位置地图',
        modes: {
          Parallel: '并行',
          Sequence: '顺序',
          PartKilled: '部分击败后',
          AllKilled: '全部击败后',
          Deadline: '限时'
        }
      }
    }
  }
})

const activeWaveIndex = ref(0)
const highlighted = ref<DungeonSpawn | null>(null)
const activeWave = computed(() => props.waves[activeWaveIndex.value] ?? props.waves[0] ?? null)
const bounds = computed(() => buildDungeonMapBounds(activeWave.value?.enemies ?? []))
const points = computed(() =>
  activeWave.value && bounds.value ? dungeonMapPoints(activeWave.value.enemies, bounds.value) : []
)
const totalEnemies = computed(() =>
  props.waves.reduce((total, wave) => total + wave.enemies.reduce((sum, enemy) => sum + enemy.count, 0), 0)
)

watch(
  () => props.waves,
  () => {
    activeWaveIndex.value = 0
    highlighted.value = null
  }
)

function selectWave(index: number): void {
  activeWaveIndex.value = index
  highlighted.value = null
}

function highlight(index: number, enemy: DungeonSpawn): void {
  if (activeWaveIndex.value !== index) activeWaveIndex.value = index
  highlighted.value = enemy
}

function clearHighlight(): void {
  highlighted.value = null
}

function enemyIcon(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`
  )
}

function pointStyle(point: DungeonMapPoint): Readonly<Record<string, string>> {
  const offset = point.stack * 0.45
  return {
    left: `${point.left + offset}%`,
    top: `${point.top - offset}%`,
    zIndex: String(20 - point.stack)
  }
}

function modeLabel(mode: string): string {
  const key = `wave.modes.${mode}`
  const translated = String(t(key))
  return translated === key ? mode : translated
}

function spotState(enemy: DungeonSpawn): { enemy: boolean; group: boolean; target: boolean } {
  return dungeonMapHighlight(enemy, highlighted.value)
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
</script>

<template>
  <section class="dungeon-wave-map-row" data-dungeon-wave-map>
    <div class="dungeon-wave-section">
      <p class="dungeon-wave-summary">
        {{ t('wave.summary', { waves: waves.length, enemies: totalEnemies }) }}
      </p>
      <div class="dungeon-wave-list">
        <div
          v-for="(wave, waveIndex) in waves"
          :key="wave.id"
          class="dungeon-wave-line"
          :class="{ active: waveIndex === activeWaveIndex }"
          :data-wave-index="waveIndex"
        >
          <button type="button" class="dungeon-wave-select" @click="selectWave(waveIndex)">
            <strong>{{ t('wave.number', { number: wave.id }) }}</strong>
            <span>{{ modeLabel(wave.mode) }}</span>
            <small v-if="wave.repeatable">{{ t('wave.repeatable') }}</small>
            <small v-if="wave.maxAlive > 0">{{ t('wave.alive', { count: wave.maxAlive }) }}</small>
            <small v-if="wave.externallyControlled">{{ t('wave.external') }}</small>
          </button>
          <div class="dungeon-wave-enemies">
            <button
              v-for="enemy in wave.enemies"
              :key="`${enemy.configId}:${enemy.groupKey}:${enemy.id}:${enemy.positionX}:${enemy.positionZ}`"
              type="button"
              class="dungeon-wave-enemy"
              :class="{ 'enemy-highlight': highlighted?.id === enemy.id }"
              :data-enemy-id="enemy.id"
              @click="selectWave(waveIndex)"
              @mouseenter="highlight(waveIndex, enemy)"
              @mouseleave="clearHighlight"
              @focus="highlight(waveIndex, enemy)"
              @blur="clearHighlight"
            >
              <ImageWithFallback :src="enemyIcon(enemy.templateId)" :alt="enemy.name" aspect-ratio="1" />
              <span>{{ enemy.name }}</span>
              <b>×{{ enemy.count }}</b>
              <small>Lv.{{ enemy.level }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeWave && bounds" class="dungeon-spawn-map-container">
      <div class="dungeon-spawn-map" role="group" :aria-label="t('wave.map')">
        <i class="dungeon-map-center" aria-hidden="true" />
        <button
          v-for="(enemy, enemyIndex) in activeWave.enemies"
          :key="`${enemy.configId}:${enemy.groupKey}:${enemy.id}:${enemyIndex}`"
          type="button"
          class="dungeon-map-spot"
          :class="{
            'enemy-highlight': spotState(enemy).enemy,
            'group-highlight': spotState(enemy).group,
            'target-highlight': spotState(enemy).target
          }"
          :style="pointStyle(points[enemyIndex]!)"
          :data-enemy-id="enemy.id"
          :data-group="enemy.groupKey"
          :data-target-group="enemy.targetGroupKey"
          @mouseenter="highlight(activeWaveIndex, enemy)"
          @mouseleave="clearHighlight"
          @focus="highlight(activeWaveIndex, enemy)"
          @blur="clearHighlight"
        >
          <ImageWithFallback :src="enemyIcon(enemy.templateId)" alt="" aspect-ratio="1" />
          <span class="dungeon-map-tip">
            <strong>{{ enemy.name }} ×{{ enemy.count }} · Lv.{{ enemy.level }}</strong>
            <span>
              {{
                t('wave.coordinates', {
                  x: formatNumber(enemy.positionX),
                  z: formatNumber(enemy.positionZ)
                })
              }}
              <template v-if="enemy.randomizeRadius > 0">
                · {{ t('wave.radius', { radius: formatNumber(enemy.randomizeRadius) }) }}
              </template>
            </span>
            <span> {{ t('wave.group', { group: enemy.groupKey }) }} · {{ modeLabel(enemy.groupMode) }} </span>
            <span v-if="enemy.targetGroupKey">
              {{
                t('wave.condition', {
                  target: enemy.targetGroupKey,
                  count: enemy.groupModeKillCount
                })
              }}
            </span>
            <span v-if="enemy.delay || enemy.interval || enemy.preWarnTime || enemy.faceMainCharacter">
              <template v-if="enemy.delay">{{ t('wave.delay', { seconds: enemy.delay }) }}</template>
              <template v-if="enemy.interval">
                · {{ t('wave.interval', { seconds: enemy.interval }) }}
              </template>
              <template v-if="enemy.preWarnTime">
                · {{ t('wave.warning', { seconds: enemy.preWarnTime }) }}
              </template>
              <template v-if="enemy.faceMainCharacter"> · {{ t('wave.facing') }}</template>
            </span>
          </span>
        </button>
      </div>
      <small class="dungeon-map-coordinates">
        X: {{ bounds.minX.toFixed(0) }} ~ {{ bounds.maxX.toFixed(0) }} · Z: {{ bounds.minZ.toFixed(0) }} ~
        {{ bounds.maxZ.toFixed(0) }}
      </small>
    </div>
  </section>
</template>

<style scoped>
.dungeon-wave-map-row {
  display: flex;
  align-items: flex-start;
  gap: var(--ake-space-4);
  margin-block: var(--ake-space-4);
}

.dungeon-wave-section {
  min-width: 0;
  flex: 1;
}

.dungeon-wave-summary {
  margin: 0 0 var(--ake-space-2);
  font-weight: 700;
}

.dungeon-wave-list {
  display: grid;
  gap: var(--ake-space-2);
}

.dungeon-wave-line {
  padding: var(--ake-space-1);
  border-inline-start: 0.1875rem solid transparent;
  border-radius: var(--ake-radius-sm);
}

.dungeon-wave-line:hover,
.dungeon-wave-line.active {
  border-inline-start-color: var(--ake-color-accent);
  background: var(--ake-color-accent-soft);
}

.dungeon-wave-select {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-1) var(--ake-space-2);
  border: 0;
  background: transparent;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.dungeon-wave-select span,
.dungeon-wave-select small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.dungeon-wave-select small {
  padding: 0.0625rem 0.375rem;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface);
}

.dungeon-wave-enemies {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  padding: var(--ake-space-1) var(--ake-space-2) var(--ake-space-2);
}

.dungeon-wave-enemy {
  display: inline-grid;
  grid-template-columns: 1.375rem minmax(0, auto) auto auto;
  align-items: center;
  gap: var(--ake-space-1);
  padding: 0.1875rem 0.375rem;
  border: var(--ake-border-width) solid transparent;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface);
  color: inherit;
  cursor: pointer;
}

.dungeon-wave-enemy :deep(.ake-image) {
  width: 1.375rem;
  height: 1.375rem;
}

.dungeon-wave-enemy small {
  color: var(--ake-color-text-muted);
}

.dungeon-wave-enemy:hover,
.dungeon-wave-enemy:focus-visible,
.dungeon-wave-enemy.enemy-highlight {
  border-color: var(--ake-color-accent);
  outline: none;
}

.dungeon-spawn-map-container {
  width: 20rem;
  flex: 0 0 20rem;
}

.dungeon-spawn-map {
  position: relative;
  width: 100%;
  max-width: 20rem;
  aspect-ratio: 1;
  overflow: visible;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-lg);
  background-color: var(--ake-color-surface-muted);
  background-image:
    linear-gradient(var(--ake-color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--ake-color-border) 1px, transparent 1px);
  background-size: 10% 10%;
}

.dungeon-map-center {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--ake-color-danger);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.dungeon-map-spot {
  position: absolute;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 2px solid var(--ake-color-surface);
  border-radius: 50%;
  background: var(--ake-color-surface);
  box-shadow: var(--ake-shadow-sm);
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.dungeon-map-spot :deep(.ake-image) {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.dungeon-map-spot.enemy-highlight,
.dungeon-map-spot.group-highlight {
  border-color: var(--ake-color-accent);
  transform: translate(-50%, -50%) scale(1.16);
}

.dungeon-map-spot.target-highlight {
  border-color: var(--ake-color-danger);
}

.dungeon-map-tip {
  position: absolute;
  z-index: 40;
  inset: auto auto calc(100% + 0.5rem) 50%;
  display: none;
  width: max-content;
  max-width: min(18rem, 70vw);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-md);
  color: var(--ake-color-text);
  font-size: var(--ake-font-size-xs);
  line-height: 1.45;
  text-align: start;
  transform: translateX(-50%);
}

.dungeon-map-tip > * {
  display: block;
}

.dungeon-map-spot:hover .dungeon-map-tip,
.dungeon-map-spot:focus-visible .dungeon-map-tip {
  display: block;
}

.dungeon-map-coordinates {
  display: block;
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-family: var(--ake-font-family-mono);
  text-align: center;
}

@media (max-width: 900px) {
  .dungeon-wave-map-row {
    flex-direction: column;
  }

  .dungeon-spawn-map-container {
    width: 100%;
    flex-basis: auto;
  }

  .dungeon-spawn-map {
    margin-inline: auto;
  }
}
</style>
