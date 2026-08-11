<script setup lang="ts">
import { useId, useSlots } from 'vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    eyebrow?: string
    compact?: boolean
  }>(),
  { compact: false }
)

const slots = useSlots()
const titleId = useId()
</script>

<template>
  <header
    class="ake-ui ake-module-header"
    :class="{ 'ake-module-header--compact': compact, 'ake-module-header--media': slots.media }"
    :aria-labelledby="titleId"
  >
    <div v-if="slots.media" class="ake-module-header__media">
      <slot name="media" />
    </div>
    <div class="ake-module-header__body">
      <div class="ake-module-header__copy">
        <div v-if="eyebrow || slots.eyebrow" class="ake-module-header__eyebrow">
          <slot name="eyebrow">{{ eyebrow }}</slot>
        </div>
        <h1 :id="titleId" class="ake-module-header__title">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="description || slots.description" class="ake-module-header__description">
          <slot name="description">{{ description }}</slot>
        </p>
        <div v-if="slots.meta" class="ake-module-header__meta">
          <slot name="meta" />
        </div>
      </div>
      <div v-if="slots.actions" class="ake-module-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.ake-module-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.ake-module-header--media {
  grid-template-columns: clamp(5rem, 13vw, 9rem) minmax(0, 1fr);
}

.ake-module-header__media {
  display: grid;
  min-width: 0;
  min-height: 7rem;
  place-items: center;
  overflow: hidden;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.ake-module-header__media :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ake-module-header__body {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ake-space-5);
  padding: var(--ake-space-6);
}

.ake-module-header--compact .ake-module-header__body {
  padding: var(--ake-space-4) var(--ake-space-5);
}

.ake-module-header__copy {
  min-width: 0;
}

.ake-module-header__eyebrow {
  margin-block-end: var(--ake-space-1);
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.ake-module-header__title {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--ake-font-size-2xl);
  line-height: var(--ake-line-height-tight);
  letter-spacing: 0;
}

.ake-module-header--compact .ake-module-header__title {
  font-size: var(--ake-font-size-xl);
}

.ake-module-header__description {
  max-width: 70ch;
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}

.ake-module-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2) var(--ake-space-3);
  margin-block-start: var(--ake-space-3);
}

.ake-module-header__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ake-space-2);
}

@media (max-width: 42rem) {
  .ake-module-header--media {
    grid-template-columns: 5.5rem minmax(0, 1fr);
  }

  .ake-module-header__body {
    flex-direction: column;
    gap: var(--ake-space-3);
    padding: var(--ake-space-4);
  }

  .ake-module-header__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .ake-module-header__title {
    font-size: var(--ake-font-size-xl);
  }
}
</style>
