<script setup lang="ts">
import { Search } from '@lucide/vue'
import { EmptyState, ErrorState, LoadingState } from '@ake/ui'
import type { DungeonCatalogItem } from '../model'

defineProps<{
  items: readonly DungeonCatalogItem[]
  selectedId: string
  search: string
  searchPlaceholder: string
  listLabel: string
  loading: boolean
  error: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  select: [item: DungeonCatalogItem]
  retry: []
}>()
</script>

<template>
  <div class="dungeon-directory">
    <label class="dungeon-directory__search">
      <Search :size="16" aria-hidden="true" />
      <input
        type="search"
        :value="search"
        :placeholder="searchPlaceholder"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <LoadingState v-if="loading" compact />
    <ErrorState v-else-if="error" compact @retry="emit('retry')" />
    <EmptyState v-else-if="items.length === 0" compact />
    <nav v-else class="dungeon-directory__list" :aria-label="listLabel">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="dungeon-directory__item"
        :class="{ 'is-active': item.id === selectedId }"
        :aria-current="item.id === selectedId ? 'page' : undefined"
        @click="emit('select', item)"
      >
        <i :data-rarity="item.rarity" aria-hidden="true" />
        <span>
          <strong>{{ item.name }}</strong>
          <small>{{ item.id }}</small>
        </span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.dungeon-directory {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: var(--ake-color-surface-muted);
}

.dungeon-directory__search {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-block-end: 0;
  color: var(--ake-color-text-muted);
}

.dungeon-directory__search input {
  width: 100%;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
  color: var(--ake-color-text);
  font: inherit;
}

.dungeon-directory__search input:focus-visible {
  outline: 2px solid var(--ake-color-accent);
  outline-offset: 1px;
}

.dungeon-directory__list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--ake-space-2);
  padding: var(--ake-space-4);
  overflow-y: auto;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
}

.dungeon-directory__item {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: 0.3125rem minmax(0, 1fr);
  align-items: stretch;
  gap: var(--ake-space-2);
  padding: 0.6875rem 0.375rem;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.dungeon-directory__item:hover {
  border-color: var(--ake-color-border-strong);
}

.dungeon-directory__item:focus-visible {
  outline: 2px solid var(--ake-color-accent);
  outline-offset: 2px;
}

.dungeon-directory__item.is-active {
  border-inline-start: 0.3125rem solid var(--ake-color-accent);
  background: var(--ake-color-accent-soft);
}

.dungeon-directory__item > i {
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-border-strong);
}

.dungeon-directory__item > i[data-rarity='6'],
.dungeon-directory__item > i[data-rarity='5'] {
  background: #d7a51c;
}

.dungeon-directory__item > i[data-rarity='4'] {
  background: #b15ac7;
}

.dungeon-directory__item > i[data-rarity='3'] {
  background: #2786bd;
}

.dungeon-directory__item > i[data-rarity='2'] {
  background: #4d9b61;
}

.dungeon-directory__item > span,
.dungeon-directory__item strong,
.dungeon-directory__item small {
  display: block;
  min-width: 0;
}

.dungeon-directory__item strong,
.dungeon-directory__item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dungeon-directory__item strong {
  font-size: var(--ake-font-size-sm);
}

.dungeon-directory__item small {
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-family: var(--ake-font-family-mono);
  font-size: var(--ake-font-size-xs);
}
</style>
