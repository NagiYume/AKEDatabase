<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ImageWithFallback } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import type { DungeonAttributeModifier, DungeonBuffSource, DungeonEnemy } from '../model'

const props = defineProps<{ enemy: DungeonEnemy }>()

const { client } = useAppContext()
const { t } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      enemy: {
        dangerous: 'Dangerous',
        globalEffect: 'Global effect',
        pinnedHealth: 'Pinned health bar',
        bornModifiers: 'Born modifiers',
        sources: { born: 'Born buffs', spawner: 'Spawner buffs', script: 'Script buffs' },
        unavailable: 'Buff data unavailable',
        blackboard: 'Blackboard',
        script: 'LevelScript {id}',
        action: 'Action {id}',
        confidence: 'Resolution {value}'
      }
    },
    CH: {
      enemy: {
        dangerous: '危险敌人',
        globalEffect: '全局效果',
        pinnedHealth: '常驻血条',
        bornModifiers: '出生属性修正',
        sources: { born: '出生 Buff', spawner: '刷怪器 Buff', script: '脚本 Buff' },
        unavailable: 'Buff 数据缺失',
        blackboard: '黑板参数',
        script: 'LevelScript {id}',
        action: '动作 {id}',
        confidence: '解析置信度 {value}'
      }
    }
  }
})

const sources: readonly DungeonBuffSource[] = ['born', 'spawner', 'script']

function buffsFor(source: DungeonBuffSource) {
  return props.enemy.buffs.filter((buff) => buff.source === source)
}

function enemyIcon(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`
  )
}

function formatNumber(value: number): string {
  if (Math.abs(value) < 1 && value !== 0) return `${(value * 100).toFixed(1)}%`
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatModifier(modifier: DungeonAttributeModifier): string {
  const multiplier = [1, 4, 6, 8].includes(modifier.modifierType)
  const direct = [4, 8].includes(modifier.modifierType)
  const value = direct ? modifier.value - 1 : modifier.value
  const display = multiplier ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : formatNumber(value)
  return `${modifier.attrName} ${display}`
}
</script>

<template>
  <article class="dungeon-enemy-card" :data-enemy-id="enemy.id">
    <header class="dungeon-enemy-header">
      <ImageWithFallback :src="enemyIcon(enemy.templateId)" :alt="enemy.name" aspect-ratio="1" />
      <div>
        <strong>{{ enemy.name }}</strong>
        <small v-if="enemy.nickname && enemy.nickname !== enemy.name">{{ enemy.nickname }}</small>
        <code>{{ enemy.id }}</code>
      </div>
      <b>Lv.{{ enemy.level }}</b>
    </header>

    <p v-if="enemy.description" class="dungeon-enemy-description">{{ enemy.description }}</p>

    <div v-if="enemy.inlineModifiers.length" class="dungeon-enemy-modifiers">
      <strong>{{ t('enemy.bornModifiers') }}</strong>
      <span v-for="modifier in enemy.inlineModifiers" :key="`${modifier.attrType}:${modifier.modifierType}`">
        {{ formatModifier(modifier) }}
      </span>
    </div>

    <div v-if="enemy.dangerous || enemy.globalEffect || enemy.pinnedHealthBar" class="dungeon-enemy-flags">
      <span v-if="enemy.dangerous" class="is-danger">{{ t('enemy.dangerous') }}</span>
      <span v-if="enemy.globalEffect">{{ t('enemy.globalEffect') }}</span>
      <span v-if="enemy.pinnedHealthBar">{{ t('enemy.pinnedHealth') }}</span>
    </div>

    <div v-if="enemy.stats.length" class="dungeon-enemy-stats">
      <div v-for="stat in enemy.stats" :key="stat.attrType" :class="{ 'is-changed': stat.changed }">
        <span>{{ stat.name }}</span>
        <strong>{{ formatNumber(stat.value) }}</strong>
        <small v-if="stat.changed">{{ formatNumber(stat.baseValue) }}</small>
      </div>
    </div>

    <div class="dungeon-enemy-buff-groups">
      <details
        v-for="source in sources"
        v-show="buffsFor(source).length"
        :key="source"
        class="dungeon-enemy-buffs"
        :data-buff-source="source"
      >
        <summary>
          {{ t(`enemy.sources.${source}`) }}
          <span>{{ buffsFor(source).length }}</span>
        </summary>
        <div class="dungeon-buff-list">
          <article
            v-for="buff in buffsFor(source)"
            :key="`${source}:${buff.id}:${buff.scriptId}:${buff.actionId}`"
          >
            <header>
              <code>{{ buff.id }}</code>
              <span v-if="!buff.available">{{ t('enemy.unavailable') }}</span>
            </header>
            <p v-if="buff.modifiers.length">
              <span
                v-for="modifier in buff.modifiers"
                :key="`${modifier.attrType}:${modifier.modifierType}`"
                :title="modifier.modifierName"
              >
                {{ formatModifier(modifier) }}
              </span>
            </p>
            <p v-if="Object.keys(buff.blackboard).length" class="dungeon-buff-blackboard">
              <strong>{{ t('enemy.blackboard') }}</strong>
              <code v-for="(value, key) in buff.blackboard" :key="key">{{ key }}={{ value }}</code>
            </p>
            <small v-if="buff.scriptId">
              {{ t('enemy.script', { id: buff.scriptId }) }}
              <template v-if="buff.actionId"> · {{ t('enemy.action', { id: buff.actionId }) }}</template>
              <template v-if="buff.confidence">
                · {{ t('enemy.confidence', { value: buff.confidence }) }}
              </template>
            </small>
          </article>
        </div>
      </details>
    </div>
  </article>
</template>

<style scoped>
.dungeon-enemy-card {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.dungeon-enemy-header {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ake-space-3);
}

.dungeon-enemy-header :deep(.ake-image) {
  width: 3rem;
  height: 3rem;
}

.dungeon-enemy-header > div,
.dungeon-enemy-header strong,
.dungeon-enemy-header small,
.dungeon-enemy-header code {
  display: block;
  min-width: 0;
}

.dungeon-enemy-header small,
.dungeon-enemy-header code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.dungeon-enemy-header > b {
  padding: 0.1875rem 0.5rem;
  border-radius: var(--ake-radius-pill);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-sm);
}

.dungeon-enemy-description {
  margin: var(--ake-space-3) 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  line-height: 1.55;
  white-space: pre-wrap;
}

.dungeon-enemy-modifiers,
.dungeon-enemy-flags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  margin-block: var(--ake-space-3);
  font-size: var(--ake-font-size-xs);
}

.dungeon-enemy-modifiers span,
.dungeon-enemy-flags span {
  padding: 0.1875rem 0.5rem;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.dungeon-enemy-flags .is-danger {
  background: var(--ake-color-danger-soft);
  color: var(--ake-color-danger);
}

.dungeon-enemy-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: var(--ake-space-1) var(--ake-space-3);
  margin-block: var(--ake-space-3);
}

.dungeon-enemy-stats > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--ake-space-2);
  padding: var(--ake-space-1) 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  font-size: var(--ake-font-size-xs);
}

.dungeon-enemy-stats span,
.dungeon-enemy-stats small {
  color: var(--ake-color-text-muted);
}

.dungeon-enemy-stats small {
  grid-column: 2;
  text-decoration: line-through;
}

.dungeon-enemy-stats .is-changed strong {
  color: var(--ake-color-accent);
}

.dungeon-enemy-buff-groups {
  display: grid;
  gap: var(--ake-space-2);
}

.dungeon-enemy-buffs {
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.dungeon-enemy-buffs summary {
  padding-block: var(--ake-space-2);
  font-size: var(--ake-font-size-sm);
  font-weight: 700;
  cursor: pointer;
}

.dungeon-enemy-buffs summary span {
  margin-inline-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
}

.dungeon-buff-list {
  display: grid;
  gap: var(--ake-space-2);
  padding-block-end: var(--ake-space-2);
}

.dungeon-buff-list > article {
  padding: var(--ake-space-2);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.dungeon-buff-list header,
.dungeon-buff-list p,
.dungeon-buff-list small {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin: 0;
}

.dungeon-buff-list header {
  justify-content: space-between;
}

.dungeon-buff-list header span {
  color: var(--ake-color-danger);
  font-size: var(--ake-font-size-xs);
}

.dungeon-buff-list p,
.dungeon-buff-list small {
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.dungeon-buff-list p > span,
.dungeon-buff-blackboard code {
  padding: 0.125rem 0.375rem;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface);
}
</style>
