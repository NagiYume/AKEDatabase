<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type Row,
  type SortingState
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/vue'
import { computed, ref } from 'vue'

type SortDirection = 'asc' | 'desc' | false

const props = withDefaults(
  defineProps<{
    data: readonly any[]
    columns: readonly ColumnDef<any, any>[]
    ariaLabel: string
    emptyText: string
    caption?: string
    maxHeight?: string
    rowHeight?: number
    overscan?: number
    virtualize?: boolean
    virtualThreshold?: number
    stickyHeader?: boolean
    interactiveRows?: boolean
    getRowId?: (row: any, index: number) => string
    getRowAriaLabel?: (row: any, index: number) => string
    getSortAriaLabel?: (columnId: string, nextDirection: SortDirection) => string
    rowClass?: (row: any, index: number) => string | undefined
  }>(),
  {
    maxHeight: 'min(70dvh, 48rem)',
    rowHeight: 42,
    overscan: 8,
    virtualize: true,
    virtualThreshold: 80,
    stickyHeader: true,
    interactiveRows: false
  }
)

const emit = defineEmits<{
  rowClick: [row: any, index: number, event: MouseEvent | KeyboardEvent]
}>()

const sorting = defineModel<SortingState>('sorting', { default: () => [] })

const table = useVueTable<any>({
  get data() {
    return [...props.data]
  },
  get columns() {
    return [...props.columns]
  },
  state: {
    get sorting() {
      return sorting.value
    }
  },
  onSortingChange(updater) {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  getRowId(row, index) {
    return props.getRowId?.(row, index) ?? String(index)
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel()
})

const rows = computed(() => table.getRowModel().rows)
const shouldVirtualize = computed(() => props.virtualize && rows.value.length >= props.virtualThreshold)
const scrollElement = ref<HTMLDivElement | null>(null)

const rowVirtualizerOptions = computed(() => ({
  count: rows.value.length,
  enabled: shouldVirtualize.value,
  getScrollElement: () => scrollElement.value,
  estimateSize: () => props.rowHeight,
  getItemKey: (index: number) => rows.value[index]?.id ?? index,
  overscan: props.overscan
}))

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)
const virtualItems = computed(() => rowVirtualizer.value.getVirtualItems())
const virtualHeight = computed(() => rowVirtualizer.value.getTotalSize())
const renderedVirtualRows = computed(() =>
  virtualItems.value
    .map((virtualItem) => {
      const row = rows.value[virtualItem.index]
      return row ? { row, virtualItem } : null
    })
    .filter((entry) => entry !== null)
)

const viewportStyle = computed(() => ({ maxHeight: props.maxHeight }))
const tableStyle = computed(() => ({ minWidth: `${table.getTotalSize()}px` }))
const bodyStyle = computed(() =>
  shouldVirtualize.value ? { height: `${virtualHeight.value}px` } : undefined
)

function columnStyle(size: number): Record<string, string> {
  return {
    width: `${size}px`,
    minWidth: `${size}px`,
    maxWidth: `${size}px`
  }
}

function ariaSort(direction: SortDirection): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending'
  if (direction === 'desc') return 'descending'
  return 'none'
}

function activateRow(row: Row<any>, event: MouseEvent | KeyboardEvent): void {
  if (!props.interactiveRows) return
  if (event instanceof MouseEvent) {
    const target = event.target as Element | null
    if (target?.closest('a, button, input, select, textarea, [role="button"]')) return
  }
  emit('rowClick', row.original, row.index, event)
}

function activateRowFromKeyboard(row: Row<any>, event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  activateRow(row, event)
}

function rowAriaLabel(row: Row<any>): string | undefined {
  return props.getRowAriaLabel?.(row.original, row.index)
}

function rowClassName(row: Row<any>): string | undefined {
  return props.rowClass?.(row.original, row.index)
}
</script>

<template>
  <div class="ake-ui ake-data-table">
    <div
      v-if="rows.length"
      ref="scrollElement"
      class="ake-data-table__viewport"
      :class="{
        'ake-data-table__viewport--virtual': shouldVirtualize,
        'ake-data-table__viewport--sticky': stickyHeader
      }"
      :style="viewportStyle"
      tabindex="0"
    >
      <table :aria-label="caption ? undefined : ariaLabel" :style="tableStyle">
        <caption v-if="caption">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
              :aria-sort="header.column.getCanSort() ? ariaSort(header.column.getIsSorted()) : undefined"
              :style="columnStyle(header.getSize())"
              scope="col"
            >
              <button
                v-if="!header.isPlaceholder && header.column.getCanSort()"
                class="ake-data-table__sort"
                type="button"
                :aria-label="getSortAriaLabel?.(header.column.id, header.column.getNextSortingOrder())"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <span class="ake-data-table__header-label">
                  <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                </span>
                <ArrowUp v-if="header.column.getIsSorted() === 'asc'" :size="15" aria-hidden="true" />
                <ArrowDown v-else-if="header.column.getIsSorted() === 'desc'" :size="15" aria-hidden="true" />
                <ArrowUpDown v-else :size="15" aria-hidden="true" />
              </button>
              <FlexRender
                v-else-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </th>
          </tr>
        </thead>
        <tbody :style="bodyStyle">
          <template v-if="shouldVirtualize">
            <tr
              v-for="entry in renderedVirtualRows"
              :key="entry.row.id"
              :class="rowClassName(entry.row)"
              :style="{
                height: `${entry.virtualItem.size}px`,
                transform: `translateY(${entry.virtualItem.start}px)`
              }"
              :tabindex="interactiveRows ? 0 : undefined"
              :aria-label="rowAriaLabel(entry.row)"
              @click="activateRow(entry.row, $event)"
              @keydown="activateRowFromKeyboard(entry.row, $event)"
            >
              <td
                v-for="cell in entry.row.getVisibleCells()"
                :key="cell.id"
                :style="columnStyle(cell.column.getSize())"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="row in rows"
              :key="row.id"
              :class="rowClassName(row)"
              :style="{ height: `${rowHeight}px` }"
              :tabindex="interactiveRows ? 0 : undefined"
              :aria-label="rowAriaLabel(row)"
              @click="activateRow(row, $event)"
              @keydown="activateRowFromKeyboard(row, $event)"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                :style="columnStyle(cell.column.getSize())"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-else class="ake-data-table__empty" role="status">{{ emptyText }}</div>
    <div v-if="$slots.footer" class="ake-data-table__footer">
      <slot name="footer" :table="table" />
    </div>
  </div>
</template>

<style scoped>
.ake-data-table {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.ake-data-table__viewport {
  min-width: 0;
  max-width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.ake-data-table__viewport:focus-visible {
  outline: 2px solid var(--ake-color-focus);
  outline-offset: -2px;
}

.ake-data-table table {
  display: grid;
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.ake-data-table caption {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ake-data-table thead,
.ake-data-table tbody {
  display: grid;
  min-width: 100%;
}

.ake-data-table__viewport--sticky thead {
  position: sticky;
  z-index: 2;
  top: 0;
}

.ake-data-table tbody {
  position: relative;
}

.ake-data-table tr {
  display: flex;
  width: 100%;
  min-width: 100%;
}

.ake-data-table__viewport--virtual tbody tr {
  position: absolute;
  top: 0;
  left: 0;
}

.ake-data-table th,
.ake-data-table td {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: var(--ake-space-2) var(--ake-space-3);
  overflow: hidden;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  text-align: start;
}

.ake-data-table th:last-child,
.ake-data-table td:last-child {
  border-inline-end: 0;
}

.ake-data-table th {
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.ake-data-table td {
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  font-size: var(--ake-font-size-sm);
}

.ake-data-table tbody tr:hover td,
.ake-data-table tbody tr:focus-visible td {
  background: var(--ake-color-surface-hover);
}

.ake-data-table tbody tr[tabindex='0'] {
  cursor: pointer;
}

.ake-data-table tbody tr:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--ake-color-focus);
  outline-offset: -2px;
}

.ake-data-table th :deep(> *),
.ake-data-table td :deep(> *) {
  min-width: 0;
  max-width: 100%;
}

.ake-data-table td :deep(span),
.ake-data-table td :deep(p) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-data-table__sort {
  display: flex;
  width: calc(100% + var(--ake-space-6));
  min-width: 0;
  min-height: var(--ake-control-height-sm);
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  margin: calc(var(--ake-space-2) * -1) calc(var(--ake-space-3) * -1);
  padding-inline: var(--ake-space-3);
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  text-align: start;
}

.ake-data-table__sort:hover {
  color: var(--ake-color-text);
  background: var(--ake-color-surface-hover);
}

.ake-data-table__header-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-data-table__empty {
  display: grid;
  min-height: 8rem;
  place-items: center;
  padding: var(--ake-space-5);
  color: var(--ake-color-text-muted);
  text-align: center;
  overflow-wrap: anywhere;
}

.ake-data-table__footer {
  min-width: 0;
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}
</style>
