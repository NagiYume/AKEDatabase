<script setup lang="ts">
import { RotateCcw, TriangleAlert } from '@lucide/vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    retryLabel?: string
    compact?: boolean
  }>(),
  { compact: false }
)

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="ake-ui ake-error-state" :class="{ 'ake-error-state--compact': compact }" role="alert">
    <div class="ake-error-state__icon" aria-hidden="true">
      <slot name="icon"><TriangleAlert :size="25" /></slot>
    </div>
    <div v-if="title || $slots.title" class="ake-error-state__title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="description || $slots.description" class="ake-error-state__description">
      <slot name="description">{{ description }}</slot>
    </div>
    <div v-if="retryLabel || $slots.actions" class="ake-error-state__actions">
      <slot name="actions">
        <button v-if="retryLabel" class="ake-error-state__retry" type="button" @click="$emit('retry')">
          <RotateCcw :size="16" aria-hidden="true" />
          <span>{{ retryLabel }}</span>
        </button>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.ake-error-state {
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

.ake-error-state--compact {
  min-height: 5rem;
  padding: var(--ake-space-3);
}

.ake-error-state__icon {
  display: grid;
  width: var(--ake-control-height-lg);
  height: var(--ake-control-height-lg);
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-danger);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-danger);
  background: var(--ake-color-danger-soft);
}

.ake-error-state__title {
  color: var(--ake-color-text);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.ake-error-state__description {
  max-width: 60ch;
  font-size: var(--ake-font-size-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ake-error-state__actions {
  margin-block-start: var(--ake-space-2);
}

.ake-error-state__retry {
  display: inline-flex;
  min-height: var(--ake-control-height);
  align-items: center;
  justify-content: center;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.ake-error-state__retry:hover {
  background: var(--ake-color-surface-hover);
}
</style>
