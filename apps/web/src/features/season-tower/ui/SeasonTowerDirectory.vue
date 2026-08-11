<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { EmptyState, ErrorState, LoadingState } from '@ake/ui'
import type { SeasonStatus, TowerSeason } from '../model'

defineProps<{
  title: string
  subtitle: string
  seasons: readonly TowerSeason[]
  selectedId: string
  loading: boolean
  error: boolean
  formatDate: (value: string) => string
  statusLabel: (status: SeasonStatus) => string
}>()

const emit = defineEmits<{
  select: [season: TowerSeason]
  retry: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="st-directory">
    <header class="st-directory__header">
      <strong>{{ title }}</strong>
      <small>{{ subtitle }}</small>
    </header>
    <LoadingState v-if="loading" compact :label="t('common.loading')" />
    <ErrorState
      v-else-if="error"
      compact
      :title="t('common.error')"
      :retry-label="t('common.retry')"
      @retry="emit('retry')"
    />
    <EmptyState v-else-if="seasons.length === 0" compact :title="t('common.empty')" />
    <nav v-else class="st-season-list" :aria-label="title">
      <button
        v-for="season in seasons"
        :key="season.id"
        class="st-season-item"
        :class="{ 'is-active': season.id === selectedId }"
        type="button"
        :aria-current="season.id === selectedId ? 'page' : undefined"
        @click="emit('select', season)"
      >
        <span>S{{ season.id.padStart(2, '0') }}</span>
        <div>
          <strong>{{ season.name }}</strong>
          <small>{{ formatDate(season.openTime) }} - {{ formatDate(season.closeTime) }}</small>
        </div>
        <i :data-status="season.status" :title="statusLabel(season.status)" />
      </button>
    </nav>
  </div>
</template>

<style scoped>
.st-directory {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--ake-color-surface-muted);
}

.st-directory__header {
  padding: 0.9375rem 1rem;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-block-end: 0;
}

.st-directory__header strong,
.st-directory__header small {
  display: block;
}

.st-directory__header strong {
  font-size: var(--ake-font-size-md);
}

.st-directory__header small {
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-season-list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: var(--ake-space-2);
  padding: var(--ake-space-4);
  overflow-y: auto;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
}

.st-season-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: 100%;
  min-width: 0;
  min-height: 4rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-3) var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.st-season-item:hover,
.st-season-item.is-active {
  background: var(--ake-color-surface-hover);
}

.st-season-item.is-active {
  box-shadow: 0 0 0 2px var(--ake-color-accent);
}

.st-season-item > span {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.st-season-item > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.st-season-item strong,
.st-season-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-season-item strong {
  font-size: var(--ake-font-size-sm);
}

.st-season-item small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-season-item i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--ake-color-text-muted);
}

.st-season-item i[data-status='active'] {
  background: var(--ake-color-success);
}

.st-season-item i[data-status='upcoming'] {
  background: var(--ake-color-warning);
}
</style>
