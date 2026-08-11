<script setup lang="ts">
import { Search, ShieldAlert } from '@lucide/vue'
import { EmptyState, ErrorState, LoadingState } from '@ake/ui'
import type { CcCatalogEntry } from '../model'

defineProps<{
  entries: readonly CcCatalogEntry[]
  selectedId: string
  search: string
  searchLabel: string
  directoryLabel: string
  emptyLabel: string
  loadingLabel: string
  errorTitle: string
  errorDescription: string
  retryLabel: string
  loading: boolean
  error: boolean
}>()

const emit = defineEmits<{
  select: [entry: CcCatalogEntry]
  retry: []
  'update:search': [value: string]
}>()
</script>

<template>
  <div class="cc-directory">
    <label class="cc-search" data-cc-directory-block="search">
      <Search :size="17" aria-hidden="true" />
      <input
        :value="search"
        type="search"
        :placeholder="searchLabel"
        :aria-label="searchLabel"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <nav class="cc-list" :aria-label="directoryLabel" data-cc-directory-block="list">
      <LoadingState v-if="loading" compact :label="loadingLabel" />
      <ErrorState
        v-else-if="error"
        compact
        :title="errorTitle"
        :description="errorDescription"
        :retry-label="retryLabel"
        @retry="emit('retry')"
      />
      <EmptyState v-else-if="entries.length === 0" compact :title="emptyLabel" />
      <button
        v-for="entry in entries"
        v-else
        :key="entry.id"
        type="button"
        class="cc-list-item"
        :class="{ 'is-active': entry.id === selectedId }"
        :data-game-id="entry.id"
        @click="emit('select', entry)"
      >
        <span class="cc-list-icon" aria-hidden="true"><ShieldAlert :size="21" /></span>
        <span class="cc-list-copy">
          <b>{{ entry.name }}</b>
          <small>{{ entry.activityId }}</small>
        </span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.cc-directory {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  height: 100%;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.cc-search {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-search input {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  outline: 0;
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  font: inherit;
  font-size: var(--ake-font-size-sm);
}

.cc-search input:focus-visible {
  border-color: var(--ake-color-accent);
  box-shadow: 0 0 0 2px var(--ake-color-accent-soft);
}

.cc-search svg {
  flex: 0 0 auto;
  color: var(--ake-color-text-muted);
}

.cc-list {
  min-height: 0;
  flex: 1;
  padding: var(--ake-space-4);
  overflow-y: auto;
}

.cc-list-item {
  display: grid;
  width: 100%;
  min-height: 58px;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-2);
  margin-bottom: var(--ake-space-2);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: left;
  cursor: pointer;
}

.cc-list-item:hover,
.cc-list-item.is-active {
  background: var(--ake-color-surface-hover);
}

.cc-list-item.is-active {
  border-color: var(--ake-color-accent);
  box-shadow: 0 0 0 1px var(--ake-color-accent);
}

.cc-list-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface-muted);
}

.cc-list-copy,
.cc-list-copy b,
.cc-list-copy small {
  display: block;
  min-width: 0;
}

.cc-list-copy b,
.cc-list-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-list-copy b {
  font-size: 0.9rem;
}

.cc-list-copy small {
  margin-top: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}
</style>
