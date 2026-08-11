<script setup lang="ts">
import { ImageWithFallback } from '@ake/ui'
import type { CatalogEntry, CatalogOverviewGroup } from '@ake/domain'
import { catalogUiText } from './copy'

const props = defineProps<{
  title: string
  description: string
  locale: string
  groups: readonly CatalogOverviewGroup[]
  count: number
  resolveImageUrl: (path: string) => string
}>()

const emit = defineEmits<{
  select: [entry: CatalogEntry]
}>()

function groupLabel(group: CatalogOverviewGroup): string {
  if (group.id === 'suit') return catalogUiText(props.locale, 'equipmentSets')
  if (group.id === 'independent') return catalogUiText(props.locale, 'independentEquipment')
  if (group.id === 'categories') return catalogUiText(props.locale, 'achievementCategories')
  return group.label
}

function entryName(entry: CatalogEntry): string {
  return entry.id === 'suit_none' ? catalogUiText(props.locale, 'independentEquipment') : entry.name
}
</script>

<template>
  <div class="catalog-overview" data-layout-section="overview">
    <header class="catalog-overview__header">
      <div class="catalog-overview__eyebrow">{{ catalogUiText(locale, 'overviewCount', { count }) }}</div>
      <h1>{{ title }}</h1>
      <p>{{ description || catalogUiText(locale, 'overviewHint') }}</p>
    </header>

    <section v-for="group in groups" :key="group.id" class="catalog-overview__group">
      <h2>
        <span>{{ group.versionChanges ? catalogUiText(locale, 'versionChanges') : groupLabel(group) }}</span>
        <b>{{ group.items.length }}</b>
      </h2>
      <div class="catalog-overview__grid">
        <button
          v-for="item in group.items"
          :key="item.entry.id"
          type="button"
          class="catalog-overview__card"
          :class="item.entry.changeType ? `is-${item.entry.changeType}` : ''"
          @click="emit('select', item.entry)"
        >
          <ImageWithFallback
            class="catalog-overview__image"
            :src="item.entry.icon ? resolveImageUrl(item.entry.icon) : ''"
            :alt="entryName(item.entry)"
            width="76"
            height="76"
            aspect-ratio="1"
          />
          <span class="catalog-overview__body">
            <span class="catalog-overview__title-row">
              <strong>{{ entryName(item.entry) }}</strong>
              <span v-if="item.icons.length" class="catalog-overview__icons">
                <img
                  v-for="icon in item.icons"
                  :key="icon.id"
                  :src="resolveImageUrl(icon.path)"
                  :alt="icon.label"
                  :title="icon.label"
                  width="18"
                  height="18"
                />
              </span>
            </span>
            <small>{{ item.entry.id }}</small>
            <span v-if="item.entry.changeType || item.facts.length" class="catalog-overview__facts">
              <em v-if="item.entry.changeType">
                {{ catalogUiText(locale, item.entry.changeType === 'added' ? 'added' : 'modified') }}
              </em>
              <em v-for="fact in item.facts" :key="fact.id">
                {{ catalogUiText(locale, fact.id, { count: fact.value }) }}
              </em>
            </span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.catalog-overview {
  min-width: 0;
}

.catalog-overview__header {
  padding-block: var(--ake-space-2) var(--ake-space-6);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.catalog-overview__eyebrow {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.catalog-overview__header h1 {
  margin: var(--ake-space-2) 0 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
}

.catalog-overview__header p {
  max-width: 52rem;
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
}

.catalog-overview__group {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.catalog-overview__group h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.catalog-overview__group h2 b {
  min-width: 2rem;
  padding: 2px 7px;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
  text-align: center;
}

.catalog-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 205px), 1fr));
  gap: var(--ake-space-3);
}

.catalog-overview__card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  min-width: 0;
  min-height: 80px;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  color: inherit;
  background: var(--ake-color-surface-raised);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.catalog-overview__card:hover,
.catalog-overview__card:focus-visible {
  border-color: var(--ake-color-accent);
  outline: none;
}

.catalog-overview__card.is-added {
  border-color: var(--ake-color-success);
}

.catalog-overview__card.is-modified {
  border-color: var(--ake-color-warning);
}

.catalog-overview__image {
  width: 76px;
  height: 100%;
  min-height: 76px;
  object-fit: contain;
  background: var(--ake-color-surface-subtle);
}

.catalog-overview__body {
  display: block;
  min-width: 0;
  padding: var(--ake-space-3);
}

.catalog-overview__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.catalog-overview__title-row strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-overview__icons {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
}

.catalog-overview__icons img {
  object-fit: contain;
}

.catalog-overview__body small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--ake-color-text-muted);
  font-family: var(--ake-font-family-mono);
  font-size: var(--ake-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-overview__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: var(--ake-space-2);
}

.catalog-overview__facts em {
  padding: 2px 5px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  font-style: normal;
}

@media (max-width: 34rem) {
  .catalog-overview__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
