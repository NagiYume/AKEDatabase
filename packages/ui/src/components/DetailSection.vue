<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  title?: string
  description?: string
}>()

const titleId = useId()
</script>

<template>
  <section class="ake-ui ake-detail-section" :aria-labelledby="title || $slots.title ? titleId : undefined">
    <div
      v-if="title || description || $slots.title || $slots.description || $slots.actions"
      class="ake-detail-section__header"
    >
      <div class="ake-detail-section__copy">
        <h2 v-if="title || $slots.title" :id="titleId" class="ake-detail-section__title">
          <slot name="title">{{ title }}</slot>
        </h2>
        <p v-if="description || $slots.description" class="ake-detail-section__description">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="ake-detail-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="ake-detail-section__content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ake-detail-section {
  min-width: 0;
  padding-block: var(--ake-space-5);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-detail-section:first-child {
  padding-block-start: 0;
  border-block-start: 0;
}

.ake-detail-section__header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ake-space-4);
  margin-block-end: var(--ake-space-4);
}

.ake-detail-section__copy,
.ake-detail-section__content {
  min-width: 0;
}

.ake-detail-section__title {
  margin: 0;
  font-size: var(--ake-font-size-lg);
  line-height: var(--ake-line-height-tight);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.ake-detail-section__description {
  max-width: 70ch;
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  overflow-wrap: anywhere;
}

.ake-detail-section__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

@media (max-width: 34rem) {
  .ake-detail-section__header {
    flex-direction: column;
  }

  .ake-detail-section__actions {
    width: 100%;
  }
}
</style>
