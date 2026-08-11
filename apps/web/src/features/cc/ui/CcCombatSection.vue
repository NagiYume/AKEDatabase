<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AppLocale } from '@ake/r2-contract'
import type { CcCombatStage } from '../model/combat'
import { ccCopy, type CcCopyKey } from './copy'

defineProps<{ stages: readonly CcCombatStage[] }>()

const { locale, t, te } = useI18n()

function tr(key: CcCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  const path = `modules.cc.${key}`
  return te(path) ? String(t(path, params)) : ccCopy(locale.value as AppLocale, key, params)
}

function compact(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function available(value: boolean): string {
  return value ? tr('dungeon.available') : tr('dungeon.unavailable')
}
</script>

<template>
  <div v-if="stages.length" class="cc-combat-stages">
    <article v-for="stage in stages" :key="stage.id" class="cc-stage" :data-stage-id="stage.id">
      <header class="cc-stage-header">
        <div>
          <h3>{{ stage.name }}</h3>
          <code>{{ stage.id }}</code>
        </div>
        <div class="cc-stage-summary">
          <span>{{ tr('dungeon.recommended', { level: stage.recommendedLevel }) }}</span>
          <span>{{ tr('dungeon.waves', { count: stage.waves.length }) }}</span>
        </div>
      </header>
      <p v-if="stage.description">{{ stage.description }}</p>
      <p v-if="stage.mainGoal">
        <strong>{{ stage.mainGoal }}</strong>
      </p>
      <p v-if="stage.extraGoal">{{ stage.extraGoal }}</p>
      <p v-if="stage.feature" class="cc-stage-feature">{{ stage.feature }}</p>

      <dl class="cc-runtime">
        <div>
          <dt>{{ tr('dungeon.levelData') }}</dt>
          <dd>{{ available(stage.runtime.levelDataAvailable) }}</dd>
        </div>
        <div>
          <dt>{{ tr('dungeon.spawner') }}</dt>
          <dd>{{ available(stage.runtime.spawnerManifestAvailable) }}</dd>
        </div>
        <div>
          <dt>{{ tr('dungeon.levelScript') }}</dt>
          <dd>{{ available(stage.runtime.levelScriptManifestAvailable) }}</dd>
        </div>
      </dl>

      <div v-if="stage.waves.length" class="cc-waves">
        <details v-for="wave in stage.waves" :key="wave.id" class="cc-wave">
          <summary>
            <b>{{ tr('dungeon.wave', { id: wave.id }) }}</b>
            <span>{{ tr('dungeon.enemyCount', { count: wave.enemies.length }) }}</span>
          </summary>
          <div class="cc-spawn-list">
            <article v-for="(spawn, index) in wave.enemies" :key="`${spawn.id}:${index}`">
              <strong>{{ spawn.name }}</strong>
              <code>{{ spawn.id }}</code>
              <span>{{ tr('dungeon.level', { level: spawn.level }) }}</span>
              <span>{{ tr('dungeon.count', { count: spawn.count }) }}</span>
              <small>{{ spawn.groupKey }} · {{ spawn.groupMode }}</small>
              <small>{{ compact(spawn.delay) }} / {{ compact(spawn.interval) }}</small>
              <small>{{ compact(spawn.positionX) }}, {{ compact(spawn.positionZ) }}</small>
            </article>
          </div>
        </details>
      </div>

      <div class="cc-enemy-grid">
        <article
          v-for="enemy in stage.enemies"
          :key="`${enemy.id}:${enemy.level}`"
          class="cc-enemy"
          :data-enemy-id="enemy.id"
        >
          <header>
            <div>
              <h4>{{ enemy.name }}</h4>
              <code>{{ enemy.id }}</code>
            </div>
            <div class="cc-enemy-level">
              <span>{{ tr('dungeon.level', { level: enemy.level }) }}</span>
              <span>{{ tr('dungeon.count', { count: enemy.count }) }}</span>
            </div>
          </header>
          <p v-if="enemy.nickname">{{ enemy.nickname }}</p>
          <p v-if="enemy.description">{{ enemy.description }}</p>
          <div v-if="enemy.dangerous || enemy.globalEffect || enemy.pinnedHealthBar" class="cc-enemy-flags">
            <span v-if="enemy.dangerous">{{ tr('enemyFlags.dangerous') }}</span>
            <span v-if="enemy.globalEffect">{{ tr('enemyFlags.globalEffect') }}</span>
            <span v-if="enemy.pinnedHealthBar">{{ tr('enemyFlags.pinnedHealthBar') }}</span>
          </div>
          <p v-if="enemy.buffs.length" class="cc-enemy-buffs">
            {{ tr('dungeon.buffs', { ids: enemy.buffs.map((buff) => buff.id).join(', ') }) }}
          </p>
          <div class="cc-stat-table" role="table">
            <div class="cc-stat-row is-head" role="row">
              <span role="columnheader">{{ tr('dungeon.attribute') }}</span>
              <span role="columnheader">{{ tr('dungeon.baseValue') }}</span>
              <span role="columnheader">{{ tr('dungeon.currentValue') }}</span>
            </div>
            <div
              v-for="stat in enemy.stats"
              :key="stat.attrType"
              class="cc-stat-row"
              :class="{ 'is-changed': stat.changed }"
              role="row"
              :data-attribute-type="stat.attrType"
            >
              <span role="cell">{{ stat.name || stat.attrType }}</span>
              <span role="cell">{{ compact(stat.baseValue) }}</span>
              <strong role="cell" :title="stat.formula">{{ compact(stat.value) }}</strong>
            </div>
          </div>
        </article>
      </div>
    </article>
  </div>
</template>

<style scoped>
.cc-combat-stages,
.cc-waves,
.cc-enemy-grid {
  display: grid;
  gap: var(--ake-space-3);
}

.cc-stage,
.cc-enemy,
.cc-wave {
  min-width: 0;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.cc-stage {
  padding: var(--ake-space-4);
}

.cc-stage-header,
.cc-enemy > header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ake-space-3);
}

.cc-stage h3,
.cc-enemy h4 {
  margin: 0 0 var(--ake-space-1);
  letter-spacing: 0;
}

.cc-stage h3 {
  font-size: 1rem;
}

.cc-enemy h4 {
  font-size: 0.9rem;
}

.cc-stage code,
.cc-enemy code {
  overflow-wrap: anywhere;
  color: var(--ake-color-text-muted);
  font-size: 0.7rem;
}

.cc-stage-summary,
.cc-enemy-level {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}

.cc-stage > p,
.cc-enemy > p {
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-line;
}

.cc-stage-feature {
  padding: var(--ake-space-2);
  border-left: 3px solid var(--ake-color-accent);
  background: var(--ake-color-surface);
}

.cc-runtime {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: var(--ake-space-3) 0;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.cc-runtime div {
  min-width: 0;
  padding: var(--ake-space-2);
}

.cc-runtime div + div {
  border-left: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-runtime dt,
.cc-runtime dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 0.7rem;
}

.cc-runtime dt {
  color: var(--ake-color-text-muted);
}

.cc-runtime dd {
  margin-top: var(--ake-space-1);
  font-weight: 700;
}

.cc-wave summary {
  display: flex;
  justify-content: space-between;
  gap: var(--ake-space-3);
  padding: var(--ake-space-2) var(--ake-space-3);
  cursor: pointer;
  font-size: 0.76rem;
}

.cc-wave summary span {
  color: var(--ake-color-text-muted);
}

.cc-spawn-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
  border-top: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-spawn-list article {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ake-space-1);
  padding: var(--ake-space-2);
  background: var(--ake-color-surface);
  font-size: 0.7rem;
}

.cc-spawn-list strong,
.cc-spawn-list code {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
}

.cc-spawn-list small {
  color: var(--ake-color-text-muted);
}

.cc-enemy-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  margin-top: var(--ake-space-3);
}

.cc-enemy {
  padding: var(--ake-space-3);
  background: var(--ake-color-surface);
}

.cc-enemy-flags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-top: var(--ake-space-2);
}

.cc-enemy-flags span {
  padding: 2px 6px;
  border: var(--ake-border-width) solid var(--ake-color-warning, #ad6100);
  border-radius: 999px;
  color: var(--ake-color-warning, #ad6100);
  font-size: 0.66rem;
}

.cc-enemy-buffs {
  overflow-wrap: anywhere;
}

.cc-stat-table {
  margin-top: var(--ake-space-3);
  border-top: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-stat-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(54px, auto) minmax(54px, auto);
  gap: var(--ake-space-2);
  padding: 5px 0;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  font-size: 0.7rem;
}

.cc-stat-row span:nth-child(n + 2),
.cc-stat-row strong {
  text-align: right;
}

.cc-stat-row.is-head {
  color: var(--ake-color-text-muted);
  font-weight: 600;
}

.cc-stat-row.is-changed strong {
  color: var(--ake-color-accent);
}

@media (max-width: 34rem) {
  .cc-runtime {
    grid-template-columns: minmax(0, 1fr);
  }

  .cc-runtime div + div {
    border-top: var(--ake-border-width) solid var(--ake-color-border);
    border-left: 0;
  }
}
</style>
