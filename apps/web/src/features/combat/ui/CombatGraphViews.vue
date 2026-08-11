<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, ChevronsDown } from '@lucide/vue'
import { VueFlow, type Elements, type NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import {
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  RawDataInspector,
  Tabs,
  type TabItem
} from '@ake/ui'
import type { ActionGraph, ActionNode, CombatDomain, LinearTreeItem } from '@ake/combat-graph'
import { stableStringify } from '@ake/domain'
import { userErrorMessageKey } from '../../../shared/i18n'

defineProps<{
  domain: CombatDomain
  graph: ActionGraph
  visibleGraph: ActionGraph | undefined
  treeItems: readonly LinearTreeItem[]
  flowElements: Elements
  selectedNodeId: string
  selectedNode: ActionNode | null
  nodeBudget: number
  includePerformance: boolean
  layoutPending: boolean
  layoutError: unknown
  actionLabel: (node: ActionNode) => string
}>()

const emit = defineEmits<{
  'update:nodeBudget': [value: number]
  'update:includePerformance': [value: boolean]
  increaseBudget: []
  toggleTree: [item: LinearTreeItem]
  selectNode: [id: string]
  linearKey: [event: KeyboardEvent, item: LinearTreeItem]
  nodeClick: [event: NodeMouseEvent]
  retryLayout: []
}>()

const { t } = useI18n()
const { t: localT } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      graphPanel: {
        label: 'Logic chain views',
        selected: 'Selected action: {label}',
        copy: 'Copy action data',
        copied: 'Action data copied',
        loadMore: 'Load {count} more actions'
      }
    },
    CH: {
      graphPanel: {
        label: '逻辑链视图',
        selected: '已选动作：{label}',
        copy: '复制动作数据',
        copied: '已复制动作数据',
        loadMore: '再加载 {count} 个动作'
      }
    }
  }
})

const activeView = defineModel<string>('activeView', { default: 'tree' })
const selectedOpen = ref(true)
const viewItems = computed<TabItem[]>(() =>
  (['tree', 'flow', 'linear'] as const).map((value) => ({ value, label: t(`graph.${value}`) }))
)

function updateBudget(event: Event): void {
  emit('update:nodeBudget', Number((event.target as HTMLInputElement).value))
}

function updatePerformance(event: Event): void {
  emit('update:includePerformance', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="combat-graph-workspace">
    <FilterBar class="combat-controls" :ariaLabel="localT('graphPanel.label')">
      <label class="combat-range-control">
        <span>{{ t('graph.nodeBudget') }}</span>
        <input
          :value="nodeBudget"
          type="range"
          min="40"
          :max="Math.max(250, graph.nodes.length)"
          step="10"
          :aria-label="t('graph.nodeBudget')"
          @input="updateBudget"
        />
        <b>{{ nodeBudget }}</b>
      </label>
      <label class="combat-toggle">
        <input :checked="includePerformance" type="checkbox" @change="updatePerformance" />
        <span>{{ t('graph.performance') }}</span>
      </label>
      <button
        v-if="visibleGraph?.projection?.omittedCount"
        type="button"
        class="combat-load-more"
        @click="emit('increaseBudget')"
      >
        <ChevronsDown :size="16" aria-hidden="true" />
        <span>{{
          localT('graphPanel.loadMore', {
            count: Math.min(visibleGraph.projection.batchSize, visibleGraph.projection.omittedCount)
          })
        }}</span>
      </button>
    </FilterBar>

    <Tabs v-model="activeView" :items="viewItems" :ariaLabel="localT('graphPanel.label')">
      <template #panel-tree>
        <EmptyState v-if="treeItems.length === 0" compact :title="t('common.empty')" />
        <section v-else class="action-tree" role="tree" :aria-label="t('graph.tree')">
          <button
            v-for="item in treeItems"
            :key="item.id"
            type="button"
            role="treeitem"
            class="tree-node"
            :class="{ 'is-active': selectedNodeId === item.id }"
            :style="{ '--node-depth': item.depth }"
            :aria-label="t('graph.selectNode', { label: actionLabel(item.node) })"
            :aria-expanded="item.expandable ? item.expanded : undefined"
            :aria-level="item.depth + 1"
            :aria-posinset="item.positionInSet"
            :aria-setsize="item.setSize"
            :aria-selected="selectedNodeId === item.id"
            @click="emit('toggleTree', item)"
          >
            <span class="tree-node__disclosure" aria-hidden="true">
              <ChevronDown v-if="item.expandable && item.expanded" :size="15" />
              <ChevronRight v-else-if="item.expandable" :size="15" />
            </span>
            <span>{{ item.node.actionType }}</span>
            <strong>{{ actionLabel(item.node) }}</strong>
            <small>{{ item.node.path }}</small>
          </button>
        </section>
      </template>

      <template #panel-flow>
        <LoadingState v-if="layoutPending" compact :label="t('common.loading')" />
        <ErrorState
          v-else-if="layoutError"
          compact
          :title="t('common.error')"
          :description="t(userErrorMessageKey(layoutError))"
          :retry-label="t('common.retry')"
          @retry="emit('retryLayout')"
        />
        <section v-else class="flow-panel" :aria-label="t('graph.flow')">
          <VueFlow
            :model-value="flowElements"
            fit-view-on-init
            :min-zoom="0.1"
            :max-zoom="2"
            @node-click="emit('nodeClick', $event)"
          >
            <template #node-default="{ data }">
              <div class="flow-node-content">
                <small>{{ data.actionType }}</small>
                <strong>{{ data.label }}</strong>
              </div>
            </template>
          </VueFlow>
        </section>
      </template>

      <template #panel-linear>
        <EmptyState v-if="treeItems.length === 0" compact :title="t('common.empty')" />
        <section v-else class="linear-tree" role="tree" :aria-label="t('graph.linear')">
          <button
            v-for="item in treeItems"
            :key="item.id"
            type="button"
            role="treeitem"
            class="linear-action-button"
            :class="{ 'is-active': selectedNodeId === item.id }"
            :data-node-id="item.id"
            :style="{ '--node-depth': item.depth }"
            :aria-label="t('graph.selectNode', { label: actionLabel(item.node) })"
            :aria-expanded="item.expandable ? item.expanded : undefined"
            :aria-level="item.depth + 1"
            :aria-posinset="item.positionInSet"
            :aria-setsize="item.setSize"
            :aria-selected="selectedNodeId === item.id"
            @click="emit('selectNode', item.id)"
            @keydown="emit('linearKey', $event, item)"
          >
            <span class="tree-node__disclosure" aria-hidden="true">
              <ChevronDown v-if="item.expandable && item.expanded" :size="15" />
              <ChevronRight v-else-if="item.expandable" :size="15" />
            </span>
            <strong>{{ actionLabel(item.node) }}</strong>
            <span>{{ item.node.actionType }}</span>
          </button>
        </section>
      </template>
    </Tabs>

    <aside v-if="selectedNode" class="selected-node-inspector">
      <RawDataInspector
        v-model:open="selectedOpen"
        :value="stableStringify(selectedNode.data)"
        :label="localT('graphPanel.selected', { label: actionLabel(selectedNode) })"
        :copy-label="localT('graphPanel.copy')"
        :copied-label="localT('graphPanel.copied')"
      />
      <code>{{ selectedNode.path }}</code>
    </aside>
  </div>
</template>

<style scoped>
.combat-graph-workspace,
.action-tree,
.linear-tree {
  display: grid;
  min-width: 0;
}

.combat-graph-workspace {
  gap: var(--ake-space-4);
}

.combat-controls {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ake-space-3);
}

.combat-range-control,
.combat-toggle {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}

.combat-range-control {
  flex: 1 1 18rem;
  justify-content: flex-end;
}

.combat-range-control input {
  width: min(14rem, 100%);
  accent-color: var(--ake-color-accent);
}

.combat-range-control b {
  min-width: 3ch;
  color: var(--ake-color-text);
  text-align: end;
}

.combat-toggle input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--ake-color-accent);
}

.combat-load-more {
  display: inline-flex;
  min-height: var(--ake-control-height);
  align-items: center;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.tree-node,
.linear-action-button {
  display: grid;
  grid-template-columns: 1.125rem minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  min-height: 3rem;
  gap: 2px var(--ake-space-2);
  padding-block: var(--ake-space-2);
  padding-inline: calc(var(--ake-space-3) + min(var(--node-depth), 10) * 1rem) var(--ake-space-3);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.tree-node:hover,
.linear-action-button:hover,
.tree-node.is-active,
.linear-action-button.is-active {
  background: var(--ake-color-surface-hover);
}

.tree-node.is-active,
.linear-action-button.is-active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}

.tree-node__disclosure {
  display: inline-grid;
  grid-row: 1 / 4;
  align-self: start;
  place-items: center;
  min-height: 1.25rem;
  color: var(--ake-color-text-muted) !important;
}

.tree-node span,
.linear-action-button span {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
}

.tree-node strong,
.linear-action-button strong,
.tree-node small {
  grid-column: 2;
  min-width: 0;
  overflow-wrap: anywhere;
}

.tree-node small {
  color: var(--ake-color-text-muted);
}

.flow-panel {
  height: clamp(26.25rem, 66vh, 48.75rem);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.flow-node-content {
  display: grid;
  width: 14.375rem;
  min-height: 4.5rem;
  align-content: center;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  box-shadow: var(--ake-shadow);
}

.flow-node-content small {
  color: var(--ake-color-accent);
}

:deep(.vue-flow__node.is-selected .flow-node-content) {
  border-color: var(--ake-color-accent);
  outline: 2px solid var(--ake-color-accent-soft);
}

.selected-node-inspector {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-2);
  padding-block-start: var(--ake-space-4);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.selected-node-inspector > code {
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}

@media (max-width: 52rem) {
  .combat-controls,
  .combat-range-control {
    align-items: stretch;
    flex-direction: column;
  }

  .combat-range-control,
  .combat-range-control input {
    width: 100%;
  }
}
</style>
