<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DirectoryPanel,
  EmptyState,
  ErrorState,
  FilterBar,
  ImageWithFallback,
  LoadingState,
  SearchToolbar
} from '@ake/ui'
import {
  characterEntryMetaIcons,
  type CatalogEntry,
  type CatalogFacetDefinition,
  type CatalogModuleId
} from '@ake/domain'
import { catalogUiText } from './copy'

const props = withDefaults(
  defineProps<{
    moduleId: CatalogModuleId
    title: string
    locale: string
    entries: readonly CatalogEntry[]
    facets: readonly CatalogFacetDefinition[]
    selectedId: string
    pending: boolean
    errorDescription: string
    retryLabel: string
    resolveImageUrl: (path: string) => string
    listOnly?: boolean
  }>(),
  { listOnly: false }
)

const search = defineModel<string>('search', { required: true })
const selections = defineModel<Readonly<Record<string, readonly string[]>>>('selections', {
  required: true
})

const emit = defineEmits<{
  select: [entry: CatalogEntry]
  retry: []
}>()

const { t } = useI18n()
const selectionCount = computed(() =>
  Object.values(selections.value).reduce((count, values) => count + values.length, 0)
)

function facetLabel(id: string): string {
  return catalogUiText(props.locale, `filter${id.charAt(0).toUpperCase()}${id.slice(1)}`)
}

function entryName(entry: CatalogEntry): string {
  return props.moduleId === 'v3_equip' && entry.id === 'suit_none'
    ? catalogUiText(props.locale, 'independentEquipment')
    : entry.name
}

function selected(facetId: string, value: string): boolean {
  return selections.value[facetId]?.includes(value) ?? false
}

function toggle(facetId: string, value: string): void {
  const current = new Set(selections.value[facetId] ?? [])
  if (current.has(value)) current.delete(value)
  else current.add(value)
  selections.value = { ...selections.value, [facetId]: [...current] }
}
</script>

<template>
  <DirectoryPanel :aria-label="title">
    <template v-if="!listOnly" #header>
      <strong>{{ title }}</strong>
      <span class="catalog-directory__count">{{ t('common.count', { count: entries.length }) }}</span>
    </template>
    <template v-if="!listOnly" #toolbar>
      <SearchToolbar
        v-model="search"
        :ariaLabel="t('common.search')"
        :clear-label="t('common.clear')"
        :placeholder="t('common.search')"
      />
      <details v-if="moduleId === 'v3_item' && facets.length" class="catalog-directory__filters">
        <summary>
          {{
            catalogUiText(locale, selectionCount ? 'filterSummaryCount' : 'filterSummary', {
              count: selectionCount
            })
          }}
        </summary>
        <div v-for="facet in facets" :key="facet.id" class="catalog-directory__facet">
          <span>{{ facetLabel(facet.id) }}</span>
          <FilterBar :aria-label="facetLabel(facet.id)">
            <button
              v-for="option in facet.options"
              :key="option.value"
              type="button"
              class="catalog-directory__filter"
              :aria-pressed="selected(facet.id, option.value)"
              @click="toggle(facet.id, option.value)"
            >
              {{ option.label }}
            </button>
          </FilterBar>
        </div>
      </details>
      <template v-else>
        <div v-for="facet in facets" :key="facet.id" class="catalog-directory__facet">
          <span>{{ facetLabel(facet.id) }}</span>
          <FilterBar :aria-label="facetLabel(facet.id)">
            <button
              v-for="option in facet.options"
              :key="option.value"
              type="button"
              class="catalog-directory__filter"
              :aria-pressed="selected(facet.id, option.value)"
              @click="toggle(facet.id, option.value)"
            >
              {{ option.label }}
            </button>
          </FilterBar>
        </div>
      </template>
    </template>

    <LoadingState v-if="pending" :label="t('common.loading')" compact />
    <ErrorState
      v-else-if="errorDescription"
      :title="t('common.error')"
      :description="errorDescription"
      :retry-label="retryLabel"
      compact
      @retry="emit('retry')"
    />
    <EmptyState v-else-if="!entries.length" :title="t('common.empty')" compact />
    <button
      v-for="entry in entries"
      v-else
      :key="entry.id"
      type="button"
      class="catalog-directory__entry"
      :class="{ 'is-active': entry.id === selectedId, 'is-achievement': moduleId === 'v3_achievement' }"
      @click="emit('select', entry)"
    >
      <span v-if="moduleId !== 'v3_achievement'" class="catalog-directory__media">
        <span class="catalog-directory__rarity" :data-rarity="entry.rarity" aria-hidden="true"></span>
        <ImageWithFallback
          :src="entry.icon ? resolveImageUrl(entry.icon) : ''"
          :alt="entryName(entry)"
          width="42"
          height="42"
          aspect-ratio="1"
        />
      </span>
      <span class="catalog-directory__copy">
        <span class="catalog-directory__name-row">
          <strong>{{ entryName(entry) }}</strong>
          <span v-if="moduleId === 'v3_character'" class="catalog-directory__meta-icons">
            <img
              v-for="icon in characterEntryMetaIcons(entry)"
              :key="icon.id"
              :src="resolveImageUrl(icon.path)"
              :alt="icon.label"
              :title="icon.label"
              width="17"
              height="17"
            />
          </span>
        </span>
        <small v-if="moduleId !== 'v3_achievement'">{{ entry.id }}</small>
      </span>
      <em v-if="entry.changeType">
        {{ catalogUiText(locale, entry.changeType === 'added' ? 'added' : 'modified') }}
      </em>
    </button>
  </DirectoryPanel>
</template>

<style scoped>
.catalog-directory__count {
  display: block;
  margin-top: 2px;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.catalog-directory__facet {
  padding-top: var(--ake-space-2);
}

.catalog-directory__filters {
  margin-top: var(--ake-space-2);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
}

.catalog-directory__filters summary {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
  cursor: pointer;
}

.catalog-directory__facet > span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.catalog-directory__filter {
  min-height: 30px;
  padding: 3px 8px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  font: inherit;
  font-size: var(--ake-font-size-xs);
  cursor: pointer;
}

.catalog-directory__filter[aria-pressed='true'] {
  border-color: var(--ake-color-accent);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
}

.catalog-directory__entry {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  width: 100%;
  min-width: 0;
  min-height: 58px;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.catalog-directory__entry:hover,
.catalog-directory__entry.is-active {
  background: var(--ake-color-surface-hover);
}

.catalog-directory__entry.is-achievement {
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 48px;
}

.catalog-directory__entry.is-active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}

.catalog-directory__media {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
}

.catalog-directory__rarity {
  position: absolute;
  z-index: 1;
  inset-block: 2px;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 2px;
  background: var(--ake-color-border-strong);
}

.catalog-directory__rarity[data-rarity='6'] {
  background: var(--ake-color-warning);
}

.catalog-directory__rarity[data-rarity='5'] {
  background: var(--ake-color-accent);
}

.catalog-directory__copy,
.catalog-directory__name-row,
.catalog-directory__name-row strong {
  min-width: 0;
}

.catalog-directory__name-row {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
}

.catalog-directory__name-row strong {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-directory__meta-icons {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
}

.catalog-directory__copy small {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--ake-color-text-muted);
  font-family: var(--ake-font-family-mono);
  font-size: var(--ake-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-directory__entry > em {
  padding: 2px 5px;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
  font-style: normal;
}
</style>
