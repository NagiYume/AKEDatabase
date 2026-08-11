<script setup lang="ts">
import type { MetricItem } from '../types'

withDefaults(
  defineProps<{
    items: readonly MetricItem[]
    minItemWidth?: string
  }>(),
  { minItemWidth: '9rem' }
)
</script>

<template>
  <dl class="ake-ui ake-metric-grid" :style="{ '--ake-metric-min': minItemWidth }">
    <div
      v-for="item in items"
      :key="item.id"
      class="ake-metric-grid__item"
      :data-tone="item.tone ?? 'neutral'"
    >
      <slot name="item" :item="item">
        <dt class="ake-metric-grid__label">{{ item.label }}</dt>
        <dd class="ake-metric-grid__value">{{ item.value }}</dd>
        <dd v-if="item.description" class="ake-metric-grid__description">{{ item.description }}</dd>
      </slot>
    </div>
  </dl>
</template>

<style scoped>
.ake-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--ake-metric-min)), 1fr));
  min-width: 0;
  gap: var(--ake-space-2);
  margin: 0;
}

.ake-metric-grid__item {
  min-width: 0;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-block-start: 3px solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.ake-metric-grid__item[data-tone='accent'] {
  border-block-start-color: var(--ake-color-accent);
}

.ake-metric-grid__item[data-tone='success'] {
  border-block-start-color: var(--ake-color-success);
}

.ake-metric-grid__item[data-tone='warning'] {
  border-block-start-color: var(--ake-color-warning);
}

.ake-metric-grid__item[data-tone='danger'] {
  border-block-start-color: var(--ake-color-danger);
}

.ake-metric-grid__label,
.ake-metric-grid__description {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.ake-metric-grid__value {
  margin: var(--ake-space-1) 0 0;
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
  line-height: var(--ake-line-height-tight);
  overflow-wrap: anywhere;
}

.ake-metric-grid__description {
  margin: var(--ake-space-2) 0 0;
}
</style>
