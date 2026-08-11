<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { List } from '@lucide/vue'
import {
  DataTable,
  DetailSection,
  ErrorState,
  LoadingState,
  ModuleShell,
  ResponsiveDrawer,
  Select,
  type ColumnDef,
  type SelectOption
} from '@ake/ui'
import {
  CATALOG_DEFINITIONS,
  buildCatalogDetailPresentation,
  buildCatalogFacetDefinitions,
  buildCatalogOverviewGroups,
  catalogToCsv,
  filterCatalogEntries,
  filterEntriesByCatalogFacets,
  flattenRecord,
  parseCatalogLevelPreferences,
  stableStringify,
  type CatalogEntry,
  type CatalogModuleId
} from '@ake/domain'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getCatalogRepository } from '../api/repository'
import CatalogDirectory from './CatalogDirectory.vue'
import CatalogOverview from './CatalogOverview.vue'
import CatalogTools from './CatalogTools.vue'
import AchievementCatalogDetail from './AchievementCatalogDetail.vue'
import CharacterCatalogDetail from './CharacterCatalogDetail.vue'
import EnemyCatalogDetail from './EnemyCatalogDetail.vue'
import EquipCatalogDetail from './EquipCatalogDetail.vue'
import ItemCatalogDetail from './ItemCatalogDetail.vue'
import WeaponCatalogDetail from './WeaponCatalogDetail.vue'
import { catalogUiText } from './copy'

interface FlatValueRow {
  path: string
  value: string
}

const props = defineProps<{ moduleId: CatalogModuleId }>()
const { locale, t } = useI18n()
const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const { client, dataState } = useAppContext()
const repository = getCatalogRepository(client)

const definition = computed(() => CATALOG_DEFINITIONS[props.moduleId])
const search = ref('')
const facetSelections = ref<Readonly<Record<string, readonly string[]>>>({})
const level = ref('')
const directoryOpen = ref(false)

const selectedId = computed(() => {
  const value = route.query.id
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
})

const levelValues = computed(() => {
  const kind = definition.value.levelKind
  if (!kind || !preferences.levels.enabled) return []
  return parseCatalogLevelPreferences(preferences.levels[kind], kind)
})

watch(
  [() => props.moduleId, () => levelValues.value.join(',')],
  () => {
    level.value = levelValues.value[0] === undefined ? '' : String(levelValues.value[0])
  },
  { immediate: true }
)

watch(
  () => props.moduleId,
  () => {
    search.value = ''
    facetSelections.value = {}
    directoryOpen.value = false
  }
)

const selectedLevel = computed(() => {
  const value = Number(level.value)
  return Number.isInteger(value) && value > 0 ? value : null
})

const listQuery = useQuery({
  queryKey: computed(() => [
    'catalog-list',
    props.moduleId,
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    preferences.showVersionChanges
  ]),
  queryFn: ({ signal }) =>
    preferences.showVersionChanges
      ? repository.listWithVersionChanges(definition.value, signal)
      : repository.list(definition.value, signal)
})

const accessibleEntries = computed(() =>
  filterCatalogEntries(listQuery.data.value ?? [], { showHidden: preferences.showHidden })
)

const searchedEntries = computed(() =>
  filterCatalogEntries(accessibleEntries.value, { search: search.value, showHidden: true })
)

const facetSelectionSets = computed(() =>
  Object.fromEntries(Object.entries(facetSelections.value).map(([facet, values]) => [facet, new Set(values)]))
)

const visibleEntries = computed(() =>
  filterEntriesByCatalogFacets(searchedEntries.value, facetSelectionSets.value)
)

const facets = computed(() => buildCatalogFacetDefinitions(props.moduleId, accessibleEntries.value))
const overviewGroups = computed(() => buildCatalogOverviewGroups(props.moduleId, visibleEntries.value))
const selectedEntry = computed(() => accessibleEntries.value.find((entry) => entry.id === selectedId.value))

const detailQuery = useQuery({
  queryKey: computed(() => [
    'catalog-detail',
    props.moduleId,
    selectedId.value,
    selectedLevel.value,
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    preferences.showVersionChanges
  ]),
  enabled: computed(() => Boolean(selectedEntry.value)),
  queryFn: ({ signal }) =>
    repository.detail(
      definition.value,
      selectedId.value,
      selectedLevel.value,
      preferences.showVersionChanges,
      signal
    )
})

const detailPresentation = computed(() => {
  const entry = selectedEntry.value
  const detail = detailQuery.data.value
  if (!entry || !detail) return null
  return buildCatalogDetailPresentation(
    props.moduleId,
    selectedId.value,
    entry,
    detail.current,
    detail.maps,
    detail.baseline ?? undefined
  )
})

const specializedModule = computed(
  () =>
    props.moduleId === 'v3_character' ||
    props.moduleId === 'v3_weapon' ||
    props.moduleId === 'v3_enemy' ||
    props.moduleId === 'v3_equip' ||
    props.moduleId === 'v3_item' ||
    props.moduleId === 'v3_achievement'
)

const directoryWidth = computed(() => (props.moduleId === 'v3_achievement' ? '220px' : '260px'))

const levelOptions = computed<SelectOption[]>(() =>
  levelValues.value.map((value) => ({ value: String(value), label: t('common.level', { value }) }))
)

const flatDetailRows = computed<FlatValueRow[]>(() =>
  flattenRecord(detailQuery.data.value?.current ?? {}).map((row) => ({
    path: row.path,
    value: typeof row.value === 'string' ? row.value : stableStringify(row.value)
  }))
)

const flatColumns = computed<ColumnDef<FlatValueRow>[]>(() => [
  { accessorKey: 'path', header: t('common.details'), size: 340 },
  { accessorKey: 'value', header: t('common.rawData'), size: 620 }
])

const listErrorDescription = computed(() =>
  listQuery.isError.value ? t(userErrorMessageKey(listQuery.error.value)) : ''
)

function openEntry(entry: CatalogEntry): void {
  directoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: props.moduleId },
    query: { ...route.query, id: entry.id }
  })
}

function openRelatedItem(id: string): void {
  const entry = accessibleEntries.value.find((candidate) => candidate.id === id)
  if (entry) openEntry(entry)
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportCsv(): void {
  download(`${props.moduleId}.csv`, catalogToCsv(visibleEntries.value), 'text/csv;charset=utf-8')
}

function exportJson(): void {
  download(
    `${selectedId.value || props.moduleId}.json`,
    stableStringify(detailQuery.data.value?.current ?? visibleEntries.value),
    'application/json'
  )
}

async function copyLink(): Promise<void> {
  await navigator.clipboard.writeText(location.href)
}
</script>

<template>
  <ModuleShell :directory-label="t(definition.titleKey)" :directory-width="directoryWidth">
    <template #directory>
      <CatalogDirectory
        v-model:search="search"
        v-model:selections="facetSelections"
        :module-id="moduleId"
        :title="t(definition.titleKey)"
        :locale="locale"
        :entries="visibleEntries"
        :facets="facets"
        :selected-id="selectedId"
        :pending="listQuery.isPending.value"
        :error-description="listErrorDescription"
        :retry-label="t('common.retry')"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
        @select="openEntry"
        @retry="listQuery.refetch()"
      />
    </template>

    <button
      class="catalog-mobile-directory"
      type="button"
      :aria-label="catalogUiText(locale, 'selectEntry')"
      @click="directoryOpen = true"
    >
      <List :size="18" aria-hidden="true" />
      <span>{{ catalogUiText(locale, 'list') }}</span>
    </button>

    <ResponsiveDrawer
      v-model:open="directoryOpen"
      class="catalog-mobile-drawer"
      side="left"
      :title="t(definition.titleKey)"
      :close-label="catalogUiText(locale, 'close')"
    >
      <CatalogDirectory
        v-model:search="search"
        v-model:selections="facetSelections"
        :module-id="moduleId"
        :title="t(definition.titleKey)"
        :locale="locale"
        :entries="visibleEntries"
        :facets="facets"
        :selected-id="selectedId"
        :pending="listQuery.isPending.value"
        :error-description="listErrorDescription"
        :retry-label="t('common.retry')"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
        list-only
        @select="openEntry"
        @retry="listQuery.refetch()"
      />
    </ResponsiveDrawer>

    <LoadingState v-if="listQuery.isPending.value" :label="t('common.loading')" />
    <ErrorState
      v-else-if="listQuery.isError.value"
      :title="t('common.error')"
      :description="listErrorDescription"
      :retry-label="t('common.retry')"
      @retry="listQuery.refetch()"
    />
    <CatalogOverview
      v-else-if="!selectedId"
      :title="t(definition.titleKey)"
      :description="t(definition.descriptionKey)"
      :locale="locale"
      :groups="overviewGroups"
      :count="visibleEntries.length"
      :resolve-image-url="client.resolveImageUrl.bind(client)"
      @select="openEntry"
    />
    <ErrorState
      v-else-if="!selectedEntry"
      :title="t('errors.notFoundTitle')"
      :description="t('errors.deepLinkMissing')"
    />
    <LoadingState v-else-if="detailQuery.isPending.value" :label="t('common.loading')" />
    <ErrorState
      v-else-if="detailQuery.isError.value"
      :title="t('common.error')"
      :description="t(userErrorMessageKey(detailQuery.error.value))"
      :retry-label="t('common.retry')"
      @retry="detailQuery.refetch()"
    />
    <template v-else-if="detailQuery.data.value">
      <CharacterCatalogDetail
        v-if="detailPresentation?.kind === 'character'"
        :model="detailPresentation"
        :locale="locale"
        :preferred-levels="levelValues"
        :preferred-skill-levels="preferences.levels.enabled ? preferences.levels.skill : []"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
      />
      <WeaponCatalogDetail
        v-else-if="detailPresentation?.kind === 'weapon'"
        :model="detailPresentation"
        :locale="locale"
        :preferred-levels="levelValues"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
      />
      <EnemyCatalogDetail
        v-else-if="detailPresentation?.kind === 'enemy'"
        :model="detailPresentation"
        :locale="locale"
        :preferred-levels="levelValues"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
      />
      <EquipCatalogDetail
        v-else-if="detailPresentation?.kind === 'equip'"
        :model="detailPresentation"
        :locale="locale"
        :show-hidden="preferences.showHidden"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
      />
      <ItemCatalogDetail
        v-else-if="detailPresentation?.kind === 'item'"
        :model="detailPresentation"
        :locale="locale"
        :show-hidden="preferences.showHidden"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
        @select-item="openRelatedItem"
      />
      <AchievementCatalogDetail
        v-else-if="detailPresentation?.kind === 'achievement'"
        :model="detailPresentation"
        :locale="locale"
        :resolve-image-url="client.resolveImageUrl.bind(client)"
      />
      <ErrorState
        v-else-if="specializedModule"
        :title="t('errors.notFoundTitle')"
        :description="t('errors.deepLinkMissing')"
      />
      <DetailSection v-else :title="t('common.details')">
        <template #actions>
          <Select
            v-if="levelOptions.length"
            v-model="level"
            :options="levelOptions"
            :ariaLabel="t('common.level', { value: level })"
            :placeholder="t('common.level', { value: '' })"
          />
        </template>
        <DataTable
          :data="flatDetailRows"
          :columns="flatColumns"
          :ariaLabel="t('common.rawData')"
          :empty-text="t('common.empty')"
          max-height="60dvh"
        />
      </DetailSection>
      <CatalogTools
        v-if="!specializedModule"
        :locale="locale"
        :value="detailQuery.data.value.current"
        :differences="detailQuery.data.value.differences"
        :allow-export="preferences.showExport"
        @copy-link="copyLink"
        @export-json="exportJson"
        @export-csv="exportCsv"
      />
    </template>
  </ModuleShell>
</template>

<style scoped>
.catalog-mobile-directory {
  display: none;
  min-height: 36px;
  align-items: center;
  gap: var(--ake-space-2);
  margin-bottom: var(--ake-space-3);
  padding: 5px 10px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  font: inherit;
  cursor: pointer;
}

@media (max-width: 52rem) {
  :deep(.ake-module-shell__directory) {
    display: none;
  }

  .catalog-mobile-directory {
    display: inline-flex;
  }
}
</style>
