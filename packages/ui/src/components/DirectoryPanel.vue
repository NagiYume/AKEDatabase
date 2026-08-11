<script setup lang="ts">
defineProps<{
  ariaLabel?: string
}>()
</script>

<template>
  <nav class="ake-ui ake-directory-panel" :aria-label="ariaLabel">
    <div v-if="$slots.header" class="ake-directory-panel__header">
      <slot name="header" />
    </div>
    <div v-if="$slots.toolbar" class="ake-directory-panel__toolbar">
      <slot name="toolbar" />
    </div>
    <div class="ake-directory-panel__viewport">
      <slot />
    </div>
    <div v-if="$slots.footer" class="ake-directory-panel__footer">
      <slot name="footer" />
    </div>
  </nav>
</template>

<style scoped>
.ake-directory-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  min-width: 0;
  height: 100%;
  max-height: 100dvh;
  background: var(--ake-color-surface);
}

.ake-directory-panel__header,
.ake-directory-panel__toolbar,
.ake-directory-panel__footer {
  min-width: 0;
  padding: var(--ake-space-3);
}

.ake-directory-panel__header,
.ake-directory-panel__toolbar {
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-directory-panel__footer {
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-directory-panel__viewport {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

@media (max-width: 52rem) {
  .ake-directory-panel {
    max-height: min(26rem, 52dvh);
  }
}
</style>
