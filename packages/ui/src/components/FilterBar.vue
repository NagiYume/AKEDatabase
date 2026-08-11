<script setup lang="ts">
defineProps<{
  ariaLabel?: string
}>()
</script>

<template>
  <div class="ake-ui ake-filter-bar" role="group" :aria-label="ariaLabel">
    <slot />
  </div>
</template>

<style scoped>
.ake-filter-bar {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  padding-block: var(--ake-space-2);
}

.ake-filter-bar :deep(> *) {
  min-width: 0;
  max-width: 100%;
}
</style>
