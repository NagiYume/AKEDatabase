<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getSeasonTowerRepository } from '../api/repository'
import {
  combineTowerModifiers,
  modifierIsMultiplier,
  type TowerAttributeModifier,
  type TowerBuffSource,
  type TowerEnemyCombatDetail,
  type TowerResolvedBuff
} from '../model/combat'
import type { TowerDifficulty, TowerSpawner } from '../model'
import { buildWaveMapBounds, waveMapHighlightState, waveMapPoint, type WaveMapHighlight } from './wave-map'

defineOptions({ name: 'SeasonTowerCombatDetail' })

const props = defineProps<{
  difficulty: TowerDifficulty
  spawner: TowerSpawner | null
  label: string
  defaultOpen?: boolean
}>()

const { t, te, locale } = useI18n()
const { client, dataState } = useAppContext()
const preferences = usePreferencesStore()
const repository = getSeasonTowerRepository(client)
const expanded = ref(props.defaultOpen ?? false)
const activeWaveIndex = ref(0)
const mapHighlight = ref<WaveMapHighlight | null>(null)

function tr(key: string, fallback: string): string {
  return te(key) ? String(t(key)) : fallback
}

const totalEnemies = computed(() =>
  props.spawner
    ? props.spawner.waves.reduce(
        (total, wave) => total + wave.enemies.reduce((sum, enemy) => sum + enemy.count, 0),
        0
      )
    : props.difficulty.fallbackEnemies.reduce((total, enemy) => total + enemy.count, 0)
)
const mapBounds = computed(() => buildWaveMapBounds(props.spawner?.waves ?? []))
const activeWave = computed(() => props.spawner?.waves[activeWaveIndex.value] ?? null)

watch(
  () => props.spawner?.id,
  () => {
    activeWaveIndex.value = 0
    mapHighlight.value = null
  }
)

const {
  data: detail,
  isPending,
  isError,
  error,
  refetch
} = useQuery({
  enabled: computed(() => expanded.value),
  queryKey: computed(() => [
    'season-tower',
    'combat',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    dataState.value.manifest.sharedRevision,
    props.difficulty.gameId,
    props.spawner?.id ?? 'fallback'
  ]),
  queryFn: ({ signal }) => repository.combatDetail(props.difficulty, props.spawner, signal),
  staleTime: Number.POSITIVE_INFINITY
})

function onToggle(event: Event): void {
  expanded.value = (event.currentTarget as HTMLDetailsElement).open
}

function selectWave(index: number): void {
  activeWaveIndex.value = index
  mapHighlight.value = null
}

function highlightEnemy(
  waveIndex: number,
  enemy: NonNullable<typeof activeWave.value>['enemies'][number]
): void {
  mapHighlight.value = {
    waveIndex,
    enemyId: enemy.id,
    groupKey: enemy.groupKey,
    targetGroupKey: enemy.targetGroupKey ?? ''
  }
}

function clearHighlight(): void {
  mapHighlight.value = null
}

function mapPointStyle(enemy: NonNullable<typeof activeWave.value>['enemies'][number], index: number) {
  if (!activeWave.value || !mapBounds.value) return {}
  const point = waveMapPoint(enemy, index, activeWave.value, mapBounds.value)
  return {
    left: `${point.left}%`,
    top: `${point.top}%`,
    '--tower-map-stack': String(point.stackIndex)
  }
}

function highlightClasses(enemy: NonNullable<typeof activeWave.value>['enemies'][number], waveIndex: number) {
  const state = waveMapHighlightState(enemy, waveIndex, mapHighlight.value)
  return {
    'enemy-highlight': state.enemy,
    'group-highlight': state.group,
    'target-highlight': state.target
  }
}

function tooltipClasses(enemy: NonNullable<typeof activeWave.value>['enemies'][number]) {
  if (!mapBounds.value) return {}
  const left = ((enemy.positionX + mapBounds.value.halfX) / (mapBounds.value.halfX * 2)) * 100
  const top = ((mapBounds.value.halfZ - enemy.positionZ) / (mapBounds.value.halfZ * 2)) * 100
  return { 'tip-left': left > 70, 'tip-right': left < 30, 'tip-below': top < 28 }
}

function groupCondition(enemy: NonNullable<typeof activeWave.value>['enemies'][number]): string {
  if (!enemy.targetGroupKey) return ''
  if (enemy.groupMode === 'PartKilled') {
    return `${tr('modules.seasonTower.spawner.partKilled', 'After target defeats')} ${enemy.groupModeKillCount ?? 0} · ${enemy.targetGroupKey}`
  }
  return `${tr('modules.seasonTower.spawner.allKilled', 'After group defeat')} · ${enemy.targetGroupKey}`
}

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}

function enemyIcon(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`
  )
}

function enemyName(name: string, id: string, templateId: string): string {
  return name && name !== id && name !== templateId
    ? name
    : tr('modules.seasonTower.combat.enemyUnnamed', 'Enemy')
}

function modeLabel(mode: string): string {
  const modes: Readonly<Record<string, string>> = {
    Parallel: tr('modules.seasonTower.spawner.parallel', 'Simultaneous'),
    Sequence: tr('modules.seasonTower.spawner.sequence', 'Sequential'),
    PartKilled: tr('modules.seasonTower.spawner.partKilled', 'After target defeats'),
    AllKilled: tr('modules.seasonTower.spawner.allKilled', 'After group defeat'),
    Deadline: tr('modules.seasonTower.spawner.deadline', 'Timed')
  }
  return modes[mode] ?? mode
}

function sourceLabel(source: TowerBuffSource | 'enemy-inline'): string {
  const labels: Readonly<Record<TowerBuffSource | 'enemy-inline', string>> = {
    'enemy-inline': tr('modules.seasonTower.combat.source.inline', 'Enemy base modifier'),
    'enemy-born': tr('modules.seasonTower.combat.source.enemyBorn', 'Enemy birth buff'),
    'spawner-born': tr('modules.seasonTower.combat.source.spawnerBorn', 'Spawner birth buff'),
    'level-script-born': tr('modules.seasonTower.combat.source.scriptBorn', 'Level-script birth buff'),
    'level-script': tr('modules.seasonTower.combat.source.script', 'Conditional level-script buff')
  }
  return labels[source]
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value !== 0 && Math.abs(value) < 1)
    return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 2 }).format(value)
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
}

function modifierName(enemy: TowerEnemyCombatDetail, modifier: TowerAttributeModifier): string {
  return (
    enemy.attributes.find((attribute) => attribute.type === modifier.attrType)?.name ||
    tr('modules.seasonTower.combat.attributeUnknown', 'Unknown attribute')
  )
}

function modifierValue(modifier: TowerAttributeModifier): string {
  if (!modifierIsMultiplier(modifier))
    return `${modifier.attrValue > 0 ? '+' : ''}${formatNumber(modifier.attrValue)}`
  const delta =
    modifier.modifierType === 4 || modifier.modifierType === 8 ? modifier.attrValue - 1 : modifier.attrValue
  return new Intl.NumberFormat(locale.value, {
    style: 'percent',
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero'
  }).format(delta)
}

function combinedModifiers(modifiers: readonly TowerAttributeModifier[]): TowerAttributeModifier[] {
  return combineTowerModifiers(modifiers)
}

function rawBlackboard(buff: TowerResolvedBuff): string {
  return JSON.stringify({ defaults: buff.defaultBlackboard, overrides: buff.blackboard }, null, 2)
}

function formatSeconds(value: number): string {
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)} ${tr('modules.seasonTower.units.secondsShort', 's')}`
}
</script>

<template>
  <details class="tower-combat" :open="defaultOpen" @toggle="onToggle">
    <summary>
      <strong>{{ label }}</strong>
      <code v-if="preferences.showHidden && spawner">{{ spawner.id }}</code>
      <span>
        {{ spawner?.waves.length ?? 0 }} {{ tr('modules.seasonTower.spawner.waves', 'waves') }} ·
        {{ totalEnemies }} {{ tr('modules.seasonTower.spawner.enemies', 'enemies') }}
      </span>
    </summary>

    <div v-if="spawner?.waves.length" class="tower-config" data-tower-wave-map>
      <div class="tower-config-title">
        <code>{{ spawner.id }}</code>
        <span>
          {{ spawner.waves.length }} {{ tr('modules.seasonTower.spawner.waves', 'waves') }} ·
          {{ totalEnemies }} {{ tr('modules.seasonTower.spawner.enemies', 'enemies') }}
        </span>
      </div>
      <div class="tower-wave-map-row">
        <div class="tower-wave-list">
          <article
            v-for="(wave, waveIndex) in spawner.waves"
            :key="wave.id"
            class="tower-wave-line"
            :class="{ active: activeWaveIndex === waveIndex }"
            :data-wave-index="waveIndex"
          >
            <button type="button" class="tower-wave-select" @click="selectWave(waveIndex)">
              <strong>{{ tr('modules.seasonTower.spawner.wave', 'Wave') }} {{ wave.id }}</strong>
              <span>{{ modeLabel(wave.mode) }}</span>
              <i v-if="wave.repeatable">{{ tr('modules.seasonTower.spawner.repeatable', 'Repeatable') }}</i>
              <i v-if="wave.maxAlive">
                {{ tr('modules.seasonTower.spawner.maxAlive', 'Max alive') }} {{ wave.maxAlive }}
              </i>
              <i v-if="wave.externallyControlled">
                {{ tr('modules.seasonTower.spawner.external', 'Externally controlled') }}
              </i>
            </button>
            <div class="tower-wave-enemies-inline">
              <button
                v-for="(enemy, enemyIndex) in wave.enemies"
                :key="`${enemy.id}:${enemy.groupKey}:${enemyIndex}`"
                type="button"
                class="tower-wave-enemy"
                :class="highlightClasses(enemy, waveIndex)"
                :data-enemy-id="enemy.id"
                :data-group="enemy.groupKey"
                @click="selectWave(waveIndex)"
                @mouseenter="highlightEnemy(waveIndex, enemy)"
                @mouseleave="clearHighlight"
                @focus="highlightEnemy(waveIndex, enemy)"
                @blur="clearHighlight"
              >
                <ImageWithFallback
                  :src="enemyIcon(enemy.templateId)"
                  :alt="enemyName(enemy.name, enemy.id, enemy.templateId)"
                  width="28"
                  height="28"
                />
                <span>{{ enemyName(enemy.name, enemy.id, enemy.templateId) }}</span>
                <b>×{{ enemy.count }}</b>
                <small>{{ tr('modules.seasonTower.level.short', 'Lv.') }}{{ enemy.level }}</small>
              </button>
            </div>
          </article>
        </div>

        <div v-if="activeWave && mapBounds" class="tower-spawn-map-container">
          <div class="tower-spawn-map">
            <span class="tower-map-axis tower-map-axis--x" aria-hidden="true" />
            <span class="tower-map-axis tower-map-axis--z" aria-hidden="true" />
            <button
              v-for="(enemy, enemyIndex) in activeWave.enemies"
              :key="`${enemy.id}:${enemy.groupKey}:${enemyIndex}`"
              type="button"
              class="tower-map-spot"
              :class="[highlightClasses(enemy, activeWaveIndex), tooltipClasses(enemy)]"
              :style="mapPointStyle(enemy, enemyIndex)"
              :data-enemy-id="enemy.id"
              :data-group="enemy.groupKey"
              @mouseenter="highlightEnemy(activeWaveIndex, enemy)"
              @mouseleave="clearHighlight"
              @focus="highlightEnemy(activeWaveIndex, enemy)"
              @blur="clearHighlight"
            >
              <ImageWithFallback
                :src="enemyIcon(enemy.templateId)"
                :alt="enemyName(enemy.name, enemy.id, enemy.templateId)"
                width="34"
                height="34"
              />
              <span class="tower-map-tip" role="tooltip">
                <strong>
                  {{ enemyName(enemy.name, enemy.id, enemy.templateId) }} ×{{ enemy.count }}
                  {{ tr('modules.seasonTower.level.short', 'Lv.') }}{{ enemy.level }}
                </strong>
                <span>
                  ({{ enemy.positionX.toFixed(1) }}, {{ enemy.positionZ.toFixed(1) }})
                  <template v-if="enemy.randomizeRadius">
                    · R {{ enemy.randomizeRadius.toFixed(1) }}
                  </template>
                </span>
                <span>
                  {{ tr('modules.seasonTower.spawner.group', 'Group') }} {{ enemy.groupKey || '-' }} ·
                  {{ modeLabel(enemy.groupMode || activeWave.mode) }}
                </span>
                <span v-if="groupCondition(enemy)">{{ groupCondition(enemy) }}</span>
                <span v-if="enemy.delay || enemy.interval || enemy.preWarnTime">
                  <template v-if="enemy.delay">
                    {{ tr('modules.seasonTower.spawner.delay', 'Delay') }}
                    {{ formatSeconds(enemy.delay) }}
                  </template>
                  <template v-if="enemy.interval">
                    · {{ tr('modules.seasonTower.spawner.interval', 'Interval') }}
                    {{ formatSeconds(enemy.interval) }}
                  </template>
                  <template v-if="enemy.preWarnTime">
                    · {{ tr('modules.seasonTower.spawner.warning', 'Warning') }}
                    {{ formatSeconds(enemy.preWarnTime) }}
                  </template>
                </span>
              </span>
            </button>
          </div>
          <small class="tower-map-coordinates">
            X: {{ -mapBounds.halfX }} - {{ mapBounds.halfX }} · Z: {{ -mapBounds.halfZ }} -
            {{ mapBounds.halfZ }}
          </small>
        </div>
      </div>
    </div>

    <div v-else-if="spawner?.libraryEnemies.length" class="tower-wave-enemies">
      <article v-for="enemy in spawner.libraryEnemies" :key="`${enemy.id}:${enemy.level}`">
        <ImageWithFallback
          :src="enemyIcon(enemy.templateId)"
          :alt="enemyName(enemy.name, enemy.id, enemy.templateId)"
          aspect-ratio="1"
        />
        <div>
          <strong>{{ enemyName(enemy.name, enemy.id, enemy.templateId) }}</strong>
          <code v-if="preferences.showHidden">{{ enemy.id }}</code>
        </div>
        <span>{{ tr('modules.seasonTower.level.short', 'Lv.') }}{{ enemy.level }}</span>
      </article>
    </div>

    <div class="tower-combat__body">
      <LoadingState
        v-if="isPending"
        compact
        :label="tr('modules.seasonTower.combat.loading', 'Loading combat details')"
      />
      <ErrorState
        v-else-if="isError"
        compact
        :title="tr('modules.seasonTower.combat.error', 'Combat details could not be loaded')"
        :description="errorMessage(error)"
        :retry-label="tr('common.retry', 'Retry')"
        @retry="refetch()"
      />
      <EmptyState
        v-else-if="!detail || detail.enemies.length === 0"
        compact
        :title="tr('modules.seasonTower.combat.empty', 'No enemy combat data')"
      />
      <div v-else class="tower-enemy-details">
        <article v-for="enemy in detail.enemies" :key="enemy.key" class="tower-enemy-card">
          <header>
            <ImageWithFallback
              :src="enemyIcon(enemy.templateId)"
              :alt="enemyName(enemy.name, enemy.id, enemy.templateId)"
              aspect-ratio="1"
            />
            <div>
              <strong>{{ enemyName(enemy.name, enemy.id, enemy.templateId) }}</strong>
              <span v-if="enemy.nickname && enemy.nickname !== enemy.name">{{ enemy.nickname }}</span>
              <code v-if="preferences.showHidden">{{ enemy.id }}</code>
            </div>
            <b>{{ tr('modules.seasonTower.level.short', 'Lv.') }}{{ enemy.level }}</b>
            <span>×{{ enemy.spawnCount }}</span>
          </header>
          <p v-if="enemy.description" class="tower-enemy-card__description">{{ enemy.description }}</p>
          <div v-if="enemy.dangerous || enemy.bigEffect || enemy.bigHeadbar" class="tower-enemy-flags">
            <span v-if="enemy.dangerous">{{
              tr('modules.seasonTower.combat.flag.dangerous', 'Dangerous')
            }}</span>
            <span v-if="enemy.bigEffect">{{
              tr('modules.seasonTower.combat.flag.bigEffect', 'Global effect')
            }}</span>
            <span v-if="enemy.bigHeadbar">{{
              tr('modules.seasonTower.combat.flag.bigHeadbar', 'Fixed health bar')
            }}</span>
          </div>

          <div v-if="enemy.attributes.length" class="tower-attributes">
            <div
              v-for="attribute in enemy.attributes"
              :key="attribute.type"
              :class="{ 'is-scripted': attribute.changedByScript }"
            >
              <span>{{
                attribute.name || tr('modules.seasonTower.combat.attributeUnknown', 'Unknown attribute')
              }}</span>
              <code v-if="preferences.showHidden">#{{ attribute.type }}</code>
              <strong>{{ formatNumber(attribute.value) }}</strong>
              <small v-if="attribute.changedByScript">
                {{ tr('modules.seasonTower.combat.scriptApplied', 'Script active') }}:
                {{ formatNumber(attribute.scriptedValue) }}
              </small>
              <small v-if="preferences.showHidden">{{ attribute.formula }}</small>
              <small v-if="preferences.showHidden && attribute.changedByScript">{{
                attribute.scriptedFormula
              }}</small>
            </div>
          </div>
          <EmptyState
            v-else
            compact
            :title="tr('modules.seasonTower.combat.attributesEmpty', 'No calculable attributes')"
          />

          <div class="tower-modifier-groups">
            <section v-if="enemy.inlineModifiers.length" class="tower-modifier-group">
              <strong>{{ sourceLabel('enemy-inline') }}</strong>
              <span
                v-for="modifier in combinedModifiers(enemy.inlineModifiers)"
                :key="`${modifier.attrType}:${modifier.modifierType}`"
              >
                {{ modifierName(enemy, modifier) }} {{ modifierValue(modifier) }}
                <code v-if="preferences.showHidden">
                  attr={{ modifier.attrType }} · type={{ modifier.modifierType }}
                </code>
              </span>
            </section>
            <section
              v-for="(buff, buffIndex) in [...enemy.bornBuffs, ...enemy.scriptBuffs]"
              :key="`${buff.source}:${buff.id}:${buffIndex}`"
              class="tower-modifier-group"
              :class="{ 'is-scripted': buff.conditional }"
            >
              <header>
                <strong>{{ sourceLabel(buff.source) }}</strong>
                <code v-if="preferences.showHidden">{{ buff.id }}</code>
              </header>
              <span
                v-for="modifier in combinedModifiers(buff.modifiers)"
                :key="`${modifier.attrType}:${modifier.modifierType}`"
              >
                {{ modifierName(enemy, modifier) }} {{ modifierValue(modifier) }}
                <code v-if="preferences.showHidden">
                  attr={{ modifier.attrType }} · type={{ modifier.modifierType }} · {{ modifier.formulaItem }}
                  <template v-if="modifier.blackboardKey">
                    · blackboard={{ modifier.blackboardKey }}
                  </template>
                </code>
              </span>
              <small v-if="buff.modifiers.length === 0">
                {{
                  buff.available
                    ? tr('modules.seasonTower.combat.noAttributeModifier', 'No attribute modifier')
                    : tr('modules.seasonTower.combat.buffMissing', 'Buff data is unavailable')
                }}
              </small>
              <details
                v-if="preferences.showHidden && (buff.defaultBlackboard.length || buff.blackboard.length)"
                class="tower-blackboard"
              >
                <summary>{{ tr('modules.seasonTower.combat.blackboard', 'Blackboard') }}</summary>
                <pre>{{ rawBlackboard(buff) }}</pre>
              </details>
              <small v-if="preferences.showHidden && buff.scriptId">
                script={{ buff.scriptId }}
                <template v-if="buff.actionId"> · action={{ buff.actionId }}</template>
                <template v-if="buff.confidence"> · confidence={{ buff.confidence }}</template>
              </small>
            </section>
            <EmptyState
              v-if="
                enemy.inlineModifiers.length === 0 &&
                enemy.bornBuffs.length === 0 &&
                enemy.scriptBuffs.length === 0
              "
              compact
              :title="tr('modules.seasonTower.combat.buffsEmpty', 'No birth or level-script buffs')"
            />
          </div>
        </article>
      </div>
    </div>
  </details>
</template>

<style scoped>
.tower-combat {
  border: var(--ake-border-width) solid var(--ake-color-border);
}
.tower-combat > summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2) var(--ake-space-3);
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-muted);
  cursor: pointer;
}
.tower-combat > summary span {
  margin-inline-start: auto;
  color: var(--ake-color-text-muted);
}
.tower-combat code {
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}
.tower-config {
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}
.tower-config-title {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: var(--ake-space-3);
  margin-block-end: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
.tower-config-title code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tower-wave-map-row {
  display: grid;
  grid-template-columns: minmax(18rem, 1.15fr) minmax(18rem, 0.85fr);
  min-width: 0;
  align-items: start;
  gap: var(--ake-space-3);
}
.tower-wave-list {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-2);
}
.tower-wave-line {
  min-width: 0;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}
.tower-wave-line.active {
  border-color: var(--ake-color-accent);
  box-shadow: inset 3px 0 var(--ake-color-accent);
}
.tower-wave-select {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 2.5rem;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: 0;
  color: var(--ake-color-text);
  background: var(--ake-color-surface-muted);
  text-align: start;
  cursor: pointer;
}
.tower-wave-select:hover {
  background: var(--ake-color-surface-hover);
}
.tower-wave-select span,
.tower-wave-select i {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  font-style: normal;
}
.tower-wave-enemies-inline {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  padding: var(--ake-space-2);
}
.tower-wave-enemy {
  display: inline-grid;
  grid-template-columns: 1.75rem minmax(0, auto) auto auto;
  min-width: 0;
  min-height: 2.25rem;
  align-items: center;
  gap: var(--ake-space-1);
  padding: 0.2rem 0.4rem;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}
.tower-wave-enemy > :deep(.ake-image) {
  width: 1.75rem;
  height: 1.75rem;
}
.tower-wave-enemy span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tower-wave-enemy small {
  color: var(--ake-color-text-muted);
}
.tower-wave-enemy.enemy-highlight,
.tower-map-spot.enemy-highlight {
  border-color: var(--ake-color-accent);
  outline: 2px solid var(--ake-color-accent-soft);
}
.tower-wave-enemy.group-highlight,
.tower-map-spot.group-highlight {
  border-color: var(--ake-color-success);
  outline: 2px solid var(--ake-color-success);
}
.tower-wave-enemy.target-highlight,
.tower-map-spot.target-highlight {
  border-color: var(--ake-color-warning);
  outline: 2px dashed var(--ake-color-warning);
}
.tower-spawn-map-container {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-1);
}
.tower-spawn-map {
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: 4 / 3;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  background-color: var(--ake-color-surface-muted);
  background-image:
    linear-gradient(var(--ake-color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--ake-color-border) 1px, transparent 1px);
  background-size: 12.5% 12.5%;
}
.tower-map-axis {
  position: absolute;
  z-index: 1;
  background: var(--ake-color-border-strong);
  pointer-events: none;
}
.tower-map-axis--x {
  top: 50%;
  right: 0;
  left: 0;
  height: 1px;
}
.tower-map-axis--z {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
}
.tower-map-spot {
  position: absolute;
  z-index: calc(10 - var(--tower-map-stack));
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  place-items: center;
  border: 2px solid var(--ake-color-surface);
  border-radius: 50%;
  background: var(--ake-color-surface);
  box-shadow: var(--ake-shadow);
  cursor: pointer;
  transform: translate(
    calc(-50% + var(--tower-map-stack) * 0.4rem),
    calc(-50% - var(--tower-map-stack) * 0.4rem)
  );
}
.tower-map-spot > :deep(.ake-image) {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.tower-map-tip {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + var(--ake-space-2));
  left: 50%;
  display: none;
  width: min(17rem, 72vw);
  gap: var(--ake-space-1);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-popover);
  font-size: var(--ake-font-size-xs);
  text-align: start;
  transform: translateX(-50%);
  pointer-events: none;
}
.tower-map-spot:hover .tower-map-tip,
.tower-map-spot:focus-visible .tower-map-tip {
  display: grid;
}
.tower-map-spot.tip-left .tower-map-tip {
  right: 0;
  left: auto;
  transform: none;
}
.tower-map-spot.tip-right .tower-map-tip {
  right: auto;
  left: 0;
  transform: none;
}
.tower-map-spot.tip-below .tower-map-tip {
  top: calc(100% + var(--ake-space-2));
  bottom: auto;
}
.tower-map-tip > span {
  color: var(--ake-color-text-muted);
}
.tower-map-coordinates {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  text-align: center;
}
.tower-waves {
  display: grid;
}
.tower-wave {
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}
.tower-wave > header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  margin-block-end: var(--ake-space-3);
}
.tower-wave > header span,
.tower-wave > header i,
.tower-enemy-flags span {
  padding: var(--ake-space-1) var(--ake-space-2);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-style: normal;
}
.tower-wave-enemies {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
}
.tower-wave-enemies article {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  gap: var(--ake-space-2);
  align-items: center;
  min-width: 0;
}
.tower-wave-enemies article > :first-child {
  width: 3rem;
}
.tower-wave-enemies article div {
  display: grid;
  min-width: 0;
}
.tower-wave-enemies article code,
.tower-wave-enemies article small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}
.tower-wave-enemies article > small {
  grid-column: 2 / -1;
}
.tower-combat__body {
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}
.tower-enemy-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr));
  gap: var(--ake-space-4);
}
.tower-enemy-card {
  min-width: 0;
  padding: var(--ake-space-3);
  border-inline-start: 3px solid var(--ake-color-border-strong);
  background: var(--ake-color-surface);
}
.tower-enemy-card > header {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto auto;
  gap: var(--ake-space-2);
  align-items: center;
}
.tower-enemy-card > header > :first-child {
  width: 3.5rem;
}
.tower-enemy-card > header > div {
  display: grid;
  min-width: 0;
}
.tower-enemy-card > header span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
.tower-enemy-card__description {
  margin: var(--ake-space-3) 0;
  color: var(--ake-color-text-muted);
  white-space: pre-wrap;
}
.tower-enemy-flags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-block: var(--ake-space-2);
}
.tower-attributes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--ake-space-1);
  margin-block: var(--ake-space-3);
}
.tower-attributes > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ake-space-1);
  padding: var(--ake-space-2);
  background: var(--ake-color-surface-muted);
}
.tower-attributes > div.is-scripted {
  box-shadow: inset 3px 0 var(--ake-color-warning);
}
.tower-attributes span,
.tower-attributes small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
.tower-attributes strong {
  grid-row: 2;
}
.tower-attributes small {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
}
.tower-modifier-groups {
  display: grid;
  gap: var(--ake-space-2);
}
.tower-modifier-group {
  display: grid;
  gap: var(--ake-space-1);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
}
.tower-modifier-group.is-scripted {
  border-inline-start: 3px solid var(--ake-color-warning);
}
.tower-modifier-group > header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ake-space-2);
}
.tower-modifier-group > span {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--ake-space-2);
}
.tower-modifier-group small {
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}
.tower-blackboard {
  min-width: 0;
}
.tower-blackboard summary {
  cursor: pointer;
  font-family: var(--ake-font-family-mono);
}
.tower-blackboard pre {
  max-height: 16rem;
  margin: var(--ake-space-2) 0 0;
  padding: var(--ake-space-2);
  overflow: auto;
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 36rem) {
  .tower-combat > summary span {
    width: 100%;
    margin-inline-start: 0;
  }
  .tower-enemy-card > header {
    grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  }
  .tower-enemy-card > header > span {
    grid-column: 2 / -1;
  }
}
@media (max-width: 58rem) {
  .tower-wave-map-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .tower-spawn-map {
    max-width: 34rem;
    margin-inline: auto;
  }
}
</style>
