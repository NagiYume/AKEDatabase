<script setup lang="ts">
import { FileJson, Link2, Sheet } from '@lucide/vue'
import { DataTable, RawDataInspector, Tooltip, type ColumnDef } from '@ake/ui'
import type { FieldDiff, TableSet } from '@ake/domain'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { catalogUiText } from './copy'

interface DifferenceRow {
  path: string
  type: string
  before: string
  after: string
}

const props = defineProps<{
  locale: string
  value: TableSet
  differences: readonly FieldDiff[]
  allowExport: boolean
}>()

const emit = defineEmits<{
  copyLink: []
  exportJson: []
  exportCsv: []
}>()

const { t } = useI18n()
const rawOpen = ref(false)

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const differenceRows = computed<DifferenceRow[]>(() =>
  props.differences.map((difference) => ({
    path: difference.path,
    type: catalogUiText(props.locale, difference.type),
    before: displayValue(difference.before),
    after: displayValue(difference.after)
  }))
)

const differenceColumns = computed<ColumnDef<DifferenceRow>[]>(() => [
  { accessorKey: 'path', header: t('common.details'), size: 300 },
  { accessorKey: 'type', header: t('common.category'), size: 120 },
  { accessorKey: 'before', header: catalogUiText(props.locale, 'before'), size: 300 },
  { accessorKey: 'after', header: catalogUiText(props.locale, 'after'), size: 300 }
])
</script>

<template>
  <details class="catalog-tools" data-layout-section="data-tools">
    <summary>{{ catalogUiText(locale, 'tools') }}</summary>
    <div class="catalog-tools__actions">
      <Tooltip :text="t('common.copyLink')">
        <button type="button" :aria-label="t('common.copyLink')" @click="emit('copyLink')">
          <Link2 :size="18" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip v-if="allowExport" :text="t('common.exportJson')">
        <button type="button" :aria-label="t('common.exportJson')" @click="emit('exportJson')">
          <FileJson :size="18" aria-hidden="true" />
        </button>
      </Tooltip>
      <Tooltip v-if="allowExport" :text="t('common.exportCsv')">
        <button type="button" :aria-label="t('common.exportCsv')" @click="emit('exportCsv')">
          <Sheet :size="18" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
    <section v-if="differenceRows.length" class="catalog-tools__section">
      <h2>{{ t('settings.showVersionChanges') }}</h2>
      <DataTable
        :data="differenceRows"
        :columns="differenceColumns"
        :ariaLabel="t('settings.showVersionChanges')"
        :empty-text="t('common.empty')"
      />
    </section>
    <RawDataInspector
      v-model:open="rawOpen"
      :value="value"
      :label="t('common.rawData')"
      :copy-label="catalogUiText(locale, 'copyData')"
      :copied-label="t('common.copied')"
    />
  </details>
</template>

<style scoped>
.catalog-tools {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.catalog-tools > summary {
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
  cursor: pointer;
}

.catalog-tools__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-block: var(--ake-space-4);
}

.catalog-tools__actions button {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  cursor: pointer;
}

.catalog-tools__section {
  min-width: 0;
  margin-bottom: var(--ake-space-4);
}

.catalog-tools__section h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}
</style>
