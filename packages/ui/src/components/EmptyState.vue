<script setup lang="ts">
import { PackageOpen } from '@lucide/vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    compact?: boolean
  }>(),
  { compact: false }
)
</script>

<template>
  <div class="ake-ui ake-empty-state" :class="{ 'ake-empty-state--compact': compact }" role="status">
    <div class="ake-empty-state__icon" aria-hidden="true">
      <slot name="icon"><PackageOpen :size="26" /></slot>
    </div>
    <div v-if="title || $slots.title" class="ake-empty-state__title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="description || $slots.description" class="ake-empty-state__description">
      <slot name="description">{{ description }}</slot>
    </div>
    <div v-if="$slots.actions" class="ake-empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.ake-empty-state {
  display: flex;
  min-width: 0;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--ake-space-2);
  padding: var(--ake-space-6);
  color: var(--ake-color-text-muted);
  text-align: center;
}

.ake-empty-state--compact {
  min-height: 5rem;
  padding: var(--ake-space-3);
}

.ake-empty-state__icon {
  display: grid;
  width: var(--ake-control-height-lg);
  height: var(--ake-control-height-lg);
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.ake-empty-state__title {
  color: var(--ake-color-text);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.ake-empty-state__description {
  max-width: 50ch;
  font-size: var(--ake-font-size-sm);
  overflow-wrap: anywhere;
}

.ake-empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
}
</style>
