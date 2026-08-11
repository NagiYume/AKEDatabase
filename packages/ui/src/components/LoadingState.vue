<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

withDefaults(
  defineProps<{
    label?: string
    compact?: boolean
  }>(),
  { compact: false }
)
</script>

<template>
  <div
    class="ake-ui ake-state ake-state--loading"
    :class="{ 'ake-state--compact': compact }"
    role="status"
    aria-live="polite"
  >
    <LoaderCircle class="ake-state__spinner" :size="22" aria-hidden="true" />
    <div v-if="label || $slots.default" class="ake-state__message">
      <slot>{{ label }}</slot>
    </div>
  </div>
</template>

<style scoped>
.ake-state {
  display: flex;
  min-width: 0;
  min-height: 10rem;
  align-items: center;
  justify-content: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-6);
  color: var(--ake-color-text-muted);
  text-align: center;
}

.ake-state--compact {
  min-height: 4rem;
  padding: var(--ake-space-3);
}

.ake-state__spinner {
  flex: 0 0 auto;
  animation: ake-spin 0.85s linear infinite;
}

.ake-state__message {
  min-width: 0;
  overflow-wrap: anywhere;
}

@keyframes ake-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
