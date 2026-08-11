<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    directoryLabel?: string
    directoryWidth?: string
    stickyDirectory?: boolean
  }>(),
  {
    directoryWidth: 'var(--ake-directory-width)',
    stickyDirectory: true
  }
)

const slots = useSlots()
const shellStyle = computed(() => ({ '--ake-module-directory-width': props.directoryWidth }))
</script>

<template>
  <div
    class="ake-ui ake-module-shell"
    :class="{ 'ake-module-shell--single': !slots.directory }"
    :style="shellStyle"
  >
    <aside
      v-if="slots.directory"
      class="ake-module-shell__directory"
      :class="{ 'ake-module-shell__directory--sticky': stickyDirectory }"
      :aria-label="directoryLabel"
    >
      <slot name="directory" />
    </aside>
    <section class="ake-module-shell__main">
      <slot name="header" />
      <div class="ake-module-shell__content">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.ake-module-shell {
  display: grid;
  grid-template-columns: minmax(0, var(--ake-module-directory-width)) minmax(0, 1fr);
  width: 100%;
  max-width: var(--ake-content-max);
  min-height: 0;
  margin-inline: auto;
  background: var(--ake-color-surface);
}

.ake-module-shell--single {
  grid-template-columns: minmax(0, 1fr);
}

.ake-module-shell__directory {
  min-width: 0;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.ake-module-shell__directory--sticky {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: 100dvh;
}

.ake-module-shell__main,
.ake-module-shell__content {
  min-width: 0;
}

.ake-module-shell__content {
  padding: var(--ake-space-5);
}

@media (max-width: 52rem) {
  .ake-module-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .ake-module-shell__directory {
    position: static;
    max-height: none;
    border-inline-end: 0;
    border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  }

  .ake-module-shell__content {
    padding: var(--ake-space-4);
  }
}

@media (max-width: 34rem) {
  .ake-module-shell__content {
    padding: var(--ake-space-3);
  }
}
</style>
