<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { type Edge, type Elements, type Node, type NodeMouseEvent } from '@vue-flow/core'
import { Download, ListTree, Network } from '@lucide/vue'
import {
  EmptyState,
  ErrorState,
  ImageWithFallback,
  LoadingState,
  RawDataInspector,
  ResponsiveDrawer,
  Select,
  Tabs,
  Tooltip,
  type SelectOption,
  type TabItem
} from '@ake/ui'
import {
  createLinearTreeProjection,
  resolveTreeKeyboardTarget,
  selectSubtree,
  type ActionNode,
  type CombatDomain,
  type LinearTreeItem,
  type TimelineGroup,
  type TreeKeyboardCommand
} from '@ake/combat-graph'
import { asRecord, stableStringify, textValue } from '@ake/domain'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { dataWorker } from '../../../shared/workers/data-worker-client'
import { getCombatRepository } from '../api/repository'
import CombatDirectory from './CombatDirectory.vue'
import CombatGraphViews from './CombatGraphViews.vue'
import {
  buildBlackboard,
  buildBuffEffects,
  buildBuffMetrics,
  buildCombatDirectory,
  buildSkillHits,
  buildSkillMetrics,
  buildSkillWindows,
  compactValue,
  filterCombatDirectory,
  findDirectoryOwner,
  type CombatDirectoryGroup,
  type CombatDirectoryOwner,
  type LegacyWindow
} from './legacy-layout'
import { resolveCombatEntrySelection } from './selection'
import { timelineGroupMessage } from './timeline-message'

const props = defineProps<{ domain: CombatDomain }>()
const { t, te } = useI18n()
const { t: pageT } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      combatPage: {
        drawer: { skill: 'Skill list', buff: 'Buff directory' },
        selectEntry: 'Select an entry from the directory',
        skillLevel: 'Skill level',
        entity: 'Entity',
        skillGroup: 'Skill group',
        ownerHint: 'Owner hint',
        ownerNotice: 'Directory ownership is inferred from the ID prefix, not the runtime source.',
        dataType: { skill: 'SkillData', buff: 'BuffData' },
        sections: {
          levelConfig: 'Skill level configuration',
          core: 'Core metrics',
          windows: 'Key windows',
          hits: 'Hit ledger',
          effects: 'Combat effects',
          actionData: 'Action data',
          blackboard: 'Blackboard',
          references: 'References',
          diagnostics: 'Diagnostics'
        },
        tabs: {
          skill: { timeline: 'Combat timeline', logic: 'Logic chain', debug: 'Debug data' },
          buff: {
            events: 'Events',
            timeline: 'Timeline',
            links: 'References',
            technical: 'Technical details'
          }
        },
        patch: {
          cooldown: 'Cooldown',
          costType: 'Cost type',
          costValue: 'Cost value',
          maxChargeTime: 'Max charge time'
        },
        metric: {
          durationFrame: 'Duration frames',
          exclusiveFrame: 'Exclusive frames',
          offsetRecordFrame: 'Offset record frame',
          cooldown: 'Cooldown',
          maxChargeTime: 'Max charge time',
          costType: 'Cost type',
          costValue: 'Cost value',
          attackRangeType: 'Attack range',
          castType: 'Cast type',
          skillSpecification: 'Skill specification',
          hitCount: 'Hit actions',
          actionCount: 'Actions',
          lifeType: 'Life type',
          duration: 'Duration',
          triggerInterval: 'Trigger interval',
          waitFirstTriggerInterval: 'Wait before first trigger',
          maxTriggerCnt: 'Max trigger count',
          stackingType: 'Stacking type',
          identifierType: 'Identifier type',
          maxStackCnt: 'Max stacks',
          priority: 'Priority',
          canBeDispelled: 'Can be dispelled',
          addingCooldown: 'Adding cooldown',
          ignoreTagImmune: 'Ignores tag immunity',
          useTimeDilationDt: 'Uses time dilation'
        },
        effect: {
          attributes: 'Attribute modifiers',
          damage: 'Damage modifiers',
          heal: 'Healing modifiers',
          poise: 'Poise modifiers',
          global: 'Global modifiers',
          shield: 'Shields',
          tags: 'Applied tags'
        },
        hit: {
          action: 'Hit action',
          time: 'Frame / trigger',
          damage: 'Damage',
          poise: 'Poise',
          resource: 'Resource / Buff',
          note: 'Target / condition'
        },
        windowRange: '{start}-{end} frames',
        graphViews: 'Graph views',
        copyRaw: 'Copy raw data',
        copiedRaw: 'Raw data copied',
        collapsedActions: '{count} actions collapsed',
        empty: {
          metrics: 'No configured metrics',
          windows: 'No frame windows could be derived',
          hits: 'No damage actions were found',
          effects: 'No configured combat effects',
          blackboard: 'No Blackboard values',
          references: 'No external references',
          diagnostics: 'No diagnostics'
        },
        relation: {
          structure: 'Contains',
          sequence: 'Sequence',
          condition: 'Condition',
          success: 'Success',
          failure: 'Failure',
          tick: 'Tick',
          loop: 'Loop',
          'loop-back': 'Loop back',
          end: 'On end',
          'aura-enter': 'Aura enter',
          'aura-exit': 'Aura exit',
          'switch-case': 'Switch branch',
          event: 'Event',
          external: 'External reference'
        },
        timelineLabel: {
          frame: 'Frame {frame}',
          frameRange: 'Frames {start}-{end}',
          startingFrame: 'From frame {start}',
          throughFrame: 'Through frame {end}',
          timeRange: 'Timeline range',
          runtimeTrigger: 'Runtime trigger: {trigger}',
          runtimeEvent: 'Runtime event',
          unknown: 'Unknown time'
        }
      }
    },
    CH: {
      combatPage: {
        drawer: { skill: '技能列表', buff: 'Buff目录' },
        selectEntry: '请从目录中选择一项',
        skillLevel: '技能等级',
        entity: '实体',
        skillGroup: '技能组',
        ownerHint: '归属提示',
        ownerNotice: '目录归属由 ID 前缀推断，不代表运行时来源。',
        dataType: { skill: 'SkillData', buff: 'BuffData' },
        sections: {
          levelConfig: '技能等级配置',
          core: '核心指标',
          windows: '关键窗口',
          hits: '命中账本',
          effects: '战斗效果',
          actionData: 'ActionData',
          blackboard: 'Blackboard',
          references: '引用',
          diagnostics: '诊断'
        },
        tabs: {
          skill: { timeline: '战斗时间轴', logic: '逻辑链', debug: '调试数据' },
          buff: { events: '事件', timeline: '时间轴', links: '关联', technical: '技术详情' }
        },
        patch: {
          cooldown: '冷却时间',
          costType: '消耗类型',
          costValue: '消耗数值',
          maxChargeTime: '最大蓄力时间'
        },
        metric: {
          durationFrame: '持续帧',
          exclusiveFrame: '独占帧',
          offsetRecordFrame: '偏移记录帧',
          cooldown: '冷却时间',
          maxChargeTime: '最大蓄力时间',
          costType: '消耗类型',
          costValue: '消耗数值',
          attackRangeType: '攻击范围',
          castType: '施放类型',
          skillSpecification: '技能规格',
          hitCount: '命中动作',
          actionCount: '动作数',
          lifeType: '生命周期类型',
          duration: '持续时间',
          triggerInterval: '触发间隔',
          waitFirstTriggerInterval: '首次触发等待',
          maxTriggerCnt: '最大触发次数',
          stackingType: '叠加类型',
          identifierType: '标识类型',
          maxStackCnt: '最大层数',
          priority: '优先级',
          canBeDispelled: '可驱散',
          addingCooldown: '叠加冷却',
          ignoreTagImmune: '忽略标签免疫',
          useTimeDilationDt: '使用时间膨胀'
        },
        effect: {
          attributes: '属性修正',
          damage: '伤害修正',
          heal: '治疗修正',
          poise: '韧性修正',
          global: '全局修正',
          shield: '护盾',
          tags: '附加标签'
        },
        hit: {
          action: '命中动作',
          time: '帧 / 触发',
          damage: '伤害',
          poise: '韧性',
          resource: '资源 / Buff',
          note: '目标 / 条件'
        },
        windowRange: '第 {start}-{end} 帧',
        graphViews: '图谱视图',
        copyRaw: '复制原始数据',
        copiedRaw: '已复制原始数据',
        collapsedActions: '已折叠 {count} 个动作',
        empty: {
          metrics: '没有可展示的配置指标',
          windows: '没有可推导的帧窗口',
          hits: '没有发现伤害动作',
          effects: '没有配置战斗效果',
          blackboard: '没有 Blackboard 数值',
          references: '没有外部引用',
          diagnostics: '没有诊断信息'
        },
        relation: {
          structure: '包含',
          sequence: '顺序',
          condition: '条件',
          success: '成功分支',
          failure: '失败分支',
          tick: '周期触发',
          loop: '循环',
          'loop-back': '返回循环',
          end: '结束时',
          'aura-enter': '进入光环',
          'aura-exit': '离开光环',
          'switch-case': '切换分支',
          event: '事件',
          external: '外部引用'
        },
        timelineLabel: {
          frame: '第 {frame} 帧',
          frameRange: '第 {start}-{end} 帧',
          startingFrame: '从第 {start} 帧起',
          throughFrame: '截至第 {end} 帧',
          timeRange: '时间轴区间',
          runtimeTrigger: '运行时触发：{trigger}',
          runtimeEvent: '运行时事件',
          unknown: '未知时间'
        }
      }
    }
  }
})

const route = useRoute()
const router = useRouter()
const { client, dataState } = useAppContext()
const preferences = usePreferencesStore()
const repository = getCombatRepository(client)

const search = ref('')
const directoryOpen = ref(false)
const expandedOwners = ref<Set<string>>(new Set())
const expandedGroups = ref<Set<string>>(new Set())
const activeTopTab = ref('timeline')
const activeGraphView = ref('tree')
const selectedNodeId = ref('')
const expandedIds = ref<Set<string>>(new Set())
const expandedDocumentId = ref('')
const nodeBudget = ref(matchMedia('(max-width: 800px)').matches ? 80 : 160)
const includePerformance = ref(false)
const direction = ref<'RIGHT' | 'DOWN'>(matchMedia('(max-width: 800px)').matches ? 'DOWN' : 'RIGHT')
const rawOpen = ref(true)

const moduleTitle = computed(() =>
  t(props.domain === 'skill' ? 'modules.combat.title' : 'modules.buff.title')
)
const moduleId = computed(() => (props.domain === 'skill' ? 'v3_skill' : 'v3_buff'))

const manifestQuery = useQuery({
  queryKey: computed(() => [
    'combat-manifest',
    props.domain,
    dataState.value.baseUrl,
    dataState.value.manifest.sharedRevision
  ]),
  queryFn: ({ signal }) => repository.manifest(props.domain, signal)
})
const directoryTablesQuery = useQuery({
  queryKey: computed(() => [
    'combat-directory-tables',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    preferences.locale
  ]),
  queryFn: ({ signal }) => repository.directoryTables(signal)
})
const entrySelection = computed(() =>
  resolveCombatEntrySelection(route.query.id, manifestQuery.data.value ?? [], preferences.showHidden)
)
const accessibleEntries = computed(() => entrySelection.value.accessibleEntries)
const hasExplicitId = computed(() => entrySelection.value.explicit)
const selectedId = computed(() => entrySelection.value.selectedId)
const directorySections = computed(() =>
  buildCombatDirectory(accessibleEntries.value, props.domain, directoryTablesQuery.data.value)
)
const visibleDirectory = computed(() => filterCombatDirectory(directorySections.value, search.value))
const selectedDirectory = computed(() => findDirectoryOwner(directorySections.value, selectedId.value))
const selectedEntry = computed(() => entrySelection.value.selectedEntry)

const rawQuery = useQuery({
  queryKey: computed(() => [
    'combat-raw',
    props.domain,
    selectedEntry.value?.contentFile,
    dataState.value.manifest.sharedRevision
  ]),
  enabled: computed(() => Boolean(selectedEntry.value)),
  queryFn: ({ signal }) => repository.raw(selectedEntry.value!, signal)
})
const patchesQuery = useQuery({
  queryKey: computed(() => ['skill-patches', selectedEntry.value?.id, dataState.value.selected.id]),
  enabled: computed(() => props.domain === 'skill' && Boolean(selectedEntry.value)),
  queryFn: ({ signal }) => repository.skillPatchSummaries(selectedEntry.value!.id, signal)
})
const requestedLevel = computed(() =>
  Number(route.query.level ?? patchesQuery.data.value?.at(-1)?.level ?? 0)
)
const selectedPatch = computed(
  () =>
    patchesQuery.data.value?.find((patch) => patch.level === requestedLevel.value) ??
    patchesQuery.data.value?.at(-1)
)
const levelOptions = computed<SelectOption[]>(() =>
  (patchesQuery.data.value ?? []).map((patch) => ({
    value: String(patch.level),
    label: t('common.level', { value: patch.level })
  }))
)
const selectedLevel = computed<string | undefined>({
  get: () => (selectedPatch.value ? String(selectedPatch.value.level) : undefined),
  set: (value) => {
    void router.push({ query: { ...route.query, level: value || undefined } })
  }
})

const graphQuery = useQuery({
  queryKey: computed(() => [
    'combat-graph',
    props.domain,
    selectedEntry.value?.contentFile,
    nodeBudget.value,
    includePerformance.value,
    dataState.value.manifest.sharedRevision
  ]),
  enabled: computed(() => Boolean(selectedEntry.value && rawQuery.data.value?.text)),
  queryFn: ({ signal }) =>
    dataWorker.analyzeCombat(
      props.domain,
      rawQuery.data.value!.text,
      { nodeBudget: nodeBudget.value, includePerformance: includePerformance.value },
      signal
    )
})
const graphRoot = computed(() => selectedNodeId.value || graphQuery.data.value?.roots[0] || '')
const visibleGraph = computed(() => {
  const graph = graphQuery.data.value
  if (!graph || !graphRoot.value) return graph
  return selectSubtree(graph, graphRoot.value, {
    budget: nodeBudget.value,
    batchSize: 50,
    expandedIds: expandedIds.value
  })
})
const layoutRevision = computed(() => ({
  nodes: visibleGraph.value?.nodes.map((node) => node.id) ?? [],
  edges: visibleGraph.value?.edges.map((edge) => edge.id) ?? []
}))
const layoutQuery = useQuery({
  queryKey: computed(() => [
    'combat-layout',
    props.domain,
    selectedId.value,
    graphRoot.value,
    nodeBudget.value,
    direction.value,
    layoutRevision.value
  ]),
  enabled: computed(() => Boolean(visibleGraph.value?.nodes.length)),
  queryFn: ({ signal }) => dataWorker.layout(visibleGraph.value!, direction.value, signal)
})

const selectedNode = computed(
  () => graphQuery.data.value?.nodes.find((node) => node.id === selectedNodeId.value) ?? null
)
const activeTimelineGroup = computed(() =>
  graphQuery.data.value?.timeline.find((group) => group.nodeIds.includes(selectedNodeId.value))
)
const treeItems = computed(() =>
  graphQuery.data.value
    ? createLinearTreeProjection(graphQuery.data.value, { expandedIds: expandedIds.value })
    : []
)
const flowNodes = computed<Node[]>(() => {
  const graph = visibleGraph.value
  const layout = layoutQuery.data.value
  if (!graph || !layout) return []
  const positions = new Map(layout.nodes.map((node) => [node.id, node]))
  return graph.nodes.map((node) => {
    const position = positions.get(node.id)
    return {
      id: node.id,
      position: { x: position?.x ?? 0, y: position?.y ?? 0 },
      data: { label: actionLabel(node), actionType: node.actionType, time: node.time },
      class: { 'is-selected': node.id === selectedNodeId.value, [`node-${node.kind}`]: true }
    }
  })
})
const flowEdges = computed<Edge[]>(() =>
  (visibleGraph.value?.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: pageT(`combatPage.relation.${edge.kind}`),
    type: 'smoothstep',
    class: `edge-${edge.kind}`
  }))
)
const flowElements = computed<Elements>(() => [...flowNodes.value, ...flowEdges.value])

const rawRecord = computed(() => asRecord(rawQuery.data.value?.value))
const skillMetrics = computed(() =>
  buildSkillMetrics(rawRecord.value, selectedPatch.value, graphQuery.data.value)
)
const skillWindows = computed(() => buildSkillWindows(rawRecord.value, graphQuery.data.value))
const skillHits = computed(() => buildSkillHits(graphQuery.data.value))
const blackboard = computed(() => buildBlackboard(rawRecord.value, selectedPatch.value))
const buffMetrics = computed(() => buildBuffMetrics(rawRecord.value))
const buffEffects = computed(() => buildBuffEffects(rawRecord.value))
const maxWindowEnd = computed(() =>
  Math.max(1, ...skillWindows.value.map((window) => Math.max(window.start, window.end)))
)

const skillTabs = computed<TabItem[]>(() =>
  (['timeline', 'logic', 'debug'] as const).map((value) => ({
    value,
    label: pageT(`combatPage.tabs.skill.${value}`)
  }))
)
const buffTabs = computed<TabItem[]>(() =>
  (['events', 'timeline', 'links', 'technical'] as const).map((value) => ({
    value,
    label: pageT(`combatPage.tabs.buff.${value}`)
  }))
)

const owner = computed<CombatDirectoryOwner | null>(() => selectedDirectory.value?.owner ?? null)
const skillGroup = computed<CombatDirectoryGroup | null>(() => selectedDirectory.value?.group ?? null)
const detailTitle = computed(() => {
  if (props.domain === 'skill') {
    return textValue(rawRecord.value.skillName, selectedDirectory.value?.item.displayName ?? selectedId.value)
  }
  return selectedDirectory.value?.item.displayName ?? selectedEntry.value?.name ?? selectedId.value
})
const skillIcon = computed(() => {
  const iconId = compactValue(
    selectedPatch.value?.iconId || skillGroup.value?.iconId || rawRecord.value.iconId
  )
  if (!iconId) return ownerIcon.value
  const path = iconId.startsWith('/')
    ? iconId.slice(1)
    : `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/${iconId}.png`
  return client.resolveImageUrl(path)
})
const ownerIcon = computed(() => (owner.value?.iconPath ? client.resolveImageUrl(owner.value.iconPath) : ''))
const buffIcon = computed(() => {
  if (rawRecord.value.hasIcon === false) return ''
  const icon = asRecord(rawRecord.value.iconConfig)
  const configured = compactValue(
    rawRecord.value.iconPath ?? icon._spritePath ?? icon.spritePath ?? icon.spriteName
  )
  if (!configured) return ''
  const path = configured.startsWith('/')
    ? configured.slice(1)
    : `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/bufficon/${configured.endsWith('.png') ? configured : `${configured}.png`}`
  return client.resolveImageUrl(path)
})

watch(
  () => graphQuery.data.value,
  (graph) => {
    if (!graph || expandedDocumentId.value === graph.documentId) return
    expandedDocumentId.value = graph.documentId
    expandedIds.value = new Set(graph.roots)
  },
  { immediate: true }
)

watch(
  selectedDirectory,
  (match) => {
    if (!match) return
    expandedOwners.value = new Set(expandedOwners.value).add(match.owner.id)
    expandedGroups.value = new Set(expandedGroups.value).add(`${match.owner.id}:${match.group.id}`)
  },
  { immediate: true }
)

watch(
  () => props.domain,
  (domain) => {
    activeTopTab.value = domain === 'skill' ? 'timeline' : 'events'
    activeGraphView.value = 'tree'
  },
  { immediate: true }
)

watch(selectedId, () => {
  selectedNodeId.value = ''
})

function toggleOwner(id: string): void {
  const next = new Set(expandedOwners.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedOwners.value = next
}

function toggleGroup(id: string): void {
  const next = new Set(expandedGroups.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedGroups.value = next
}

function openEntry(id: string): void {
  directoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: moduleId.value },
    query: { ...route.query, id }
  })
}

function selectNode(id: string): void {
  selectedNodeId.value = id
  expandedIds.value = new Set(expandedIds.value).add(id)
  void nextTick(() =>
    document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' })
  )
}

function selectTimelineGroup(nodeIds: readonly string[]): void {
  const first = nodeIds[0]
  if (first) selectNode(first)
}

function setExpanded(id: string, expanded: boolean): void {
  const next = new Set(expandedIds.value)
  if (expanded) next.add(id)
  else next.delete(id)
  expandedIds.value = next
}

function toggleTreeItem(item: LinearTreeItem): void {
  selectNode(item.id)
  if (item.expandable) setExpanded(item.id, !item.expanded)
}

function increaseNodeBudget(): void {
  const projection = visibleGraph.value?.projection
  if (!projection) return
  const nextExpanded = new Set(expandedIds.value)
  Object.keys(projection.omittedByParent).forEach((id) => nextExpanded.add(id))
  expandedIds.value = nextExpanded
  if (projection.nextBudget > nodeBudget.value) nodeBudget.value = projection.nextBudget
}

function handleNodeClick(event: NodeMouseEvent): void {
  const node = visibleGraph.value?.nodes.find((candidate) => candidate.id === event.node.id)
  if (node?.kind === 'summary') {
    if (node.parentId) setExpanded(node.parentId, true)
    increaseNodeBudget()
    return
  }
  selectNode(event.node.id)
}

const treeKeys: readonly TreeKeyboardCommand[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  ' '
]

async function handleLinearKey(event: KeyboardEvent, item: LinearTreeItem): Promise<void> {
  if (!treeKeys.includes(event.key as TreeKeyboardCommand)) return
  event.preventDefault()
  const result = resolveTreeKeyboardTarget(treeItems.value, item.id, event.key as TreeKeyboardCommand)
  if (result.expandId) setExpanded(result.expandId, true)
  if (result.collapseId) setExpanded(result.collapseId, false)
  if (result.selectId) selectNode(result.selectId)
  await nextTick()
  if (result.focusId) {
    document
      .querySelector<HTMLButtonElement>(`.linear-action-button[data-node-id="${CSS.escape(result.focusId)}"]`)
      ?.focus()
  }
}

function actionLabel(node: ActionNode): string {
  if (node.kind === 'summary') {
    return pageT('combatPage.collapsedActions', { count: node.omittedCount ?? 0 })
  }
  const key =
    props.domain === 'skill'
      ? `modules.combat.timeline.actions.${node.actionType}`
      : `modules.buff.v3.actions.${node.actionType}`
  return te(key) ? t(key) : node.actionType
}

function timelineLabel(group: TimelineGroup): string {
  const message = timelineGroupMessage(group)
  return pageT(message.key, message.values ?? {})
}

function displayValue(value: unknown): string {
  return compactValue(value) || t('common.notAvailable')
}

function metricLabel(id: string): string {
  return pageT(`combatPage.metric.${id}`)
}

function effectLabel(id: string): string {
  return pageT(`combatPage.effect.${id}`)
}

function windowStyle(window: LegacyWindow): Record<string, string> {
  const left = Math.max(0, Math.min(100, (window.start / maxWindowEnd.value) * 100))
  const width = Math.max(
    1.5,
    ((Math.max(window.end, window.start) - window.start + 1) / maxWindowEnd.value) * 100
  )
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }
}

function downloadRaw(): void {
  if (!rawQuery.data.value) return
  const blob = new Blob([stableStringify(rawQuery.data.value.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${selectedId.value}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div
    class="combat-legacy-module"
    :class="`combat-legacy-module--${domain}`"
    :style="{ '--combat-sidebar-width': domain === 'skill' ? '292px' : '300px' }"
  >
    <aside class="combat-sidebar">
      <CombatDirectory
        :domain="domain"
        :sections="visibleDirectory"
        :selected-id="selectedId"
        :search="search"
        :expanded-owners="expandedOwners"
        :expanded-groups="expandedGroups"
        :loading="manifestQuery.isPending.value"
        :error="manifestQuery.isError.value"
        @update:search="search = $event"
        @toggle-owner="toggleOwner"
        @toggle-group="toggleGroup"
        @select="openEntry"
        @retry="manifestQuery.refetch()"
      />
    </aside>

    <section class="combat-detail">
      <EmptyState v-if="!selectedId && !hasExplicitId" :title="pageT('combatPage.selectEntry')">
        <template #icon><Network :size="28" /></template>
      </EmptyState>
      <ErrorState
        v-else-if="!selectedEntry && !manifestQuery.isPending.value"
        :title="t('errors.notFoundTitle')"
        :description="t('errors.deepLinkMissing')"
      />
      <LoadingState v-else-if="rawQuery.isPending.value" :label="t('common.loading')" />
      <ErrorState
        v-else-if="rawQuery.isError.value"
        :title="t('common.error')"
        :description="t(userErrorMessageKey(rawQuery.error.value))"
        :retry-label="t('common.retry')"
        @retry="rawQuery.refetch()"
      />

      <div v-else-if="rawQuery.data.value" class="combat-detail__inner">
        <template v-if="domain === 'skill'">
          <header class="combat-detail-header" data-layout-region="skill-identity">
            <div class="combat-detail-heading">
              <ImageWithFallback
                v-if="skillIcon"
                class="combat-detail-icon"
                :src="skillIcon"
                :alt="detailTitle"
                width="72"
                height="72"
                loading="eager"
              />
              <div class="combat-detail-copy">
                <span class="combat-eyebrow">
                  {{ owner?.name || moduleTitle }}
                  <template v-if="skillGroup?.name"> · {{ skillGroup.name }}</template>
                </span>
                <h1>{{ detailTitle }}</h1>
                <p>{{ rawRecord.skillId || selectedId }}</p>
              </div>
            </div>
            <div class="combat-header-actions">
              <code>{{ selectedId }}</code>
              <Tooltip v-if="preferences.showExport" :text="t('common.exportJson')">
                <button
                  type="button"
                  class="combat-icon-button"
                  :aria-label="t('common.exportJson')"
                  @click="downloadRaw"
                >
                  <Download :size="18" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </header>

          <div class="combat-context-row" data-layout-region="skill-context">
            <label class="combat-context-item">
              <span>{{ pageT('combatPage.skillLevel') }}</span>
              <Select
                v-model="selectedLevel"
                :ariaLabel="pageT('combatPage.skillLevel')"
                :options="levelOptions"
                :disabled="levelOptions.length <= 1"
              />
            </label>
            <span class="combat-context-item">
              <span>{{ pageT('combatPage.entity') }}</span>
              <strong>{{ owner?.name || t('common.notAvailable') }}</strong>
            </span>
            <span class="combat-context-item">
              <span>{{ pageT('combatPage.skillGroup') }}</span>
              <strong>{{ skillGroup?.name || t('common.notAvailable') }}</strong>
            </span>
          </div>

          <section class="combat-section" data-layout-region="skill-level-config">
            <div class="combat-section-heading">
              <span>SkillPatchTable</span>
              <h2>{{ pageT('combatPage.sections.levelConfig') }}</h2>
            </div>
            <dl v-if="selectedPatch" class="combat-facts">
              <div>
                <dt>{{ pageT('combatPage.patch.cooldown') }}</dt>
                <dd>{{ displayValue(selectedPatch.coolDown) }}</dd>
              </div>
              <div>
                <dt>{{ pageT('combatPage.patch.costType') }}</dt>
                <dd>{{ displayValue(selectedPatch.costType) }}</dd>
              </div>
              <div>
                <dt>{{ pageT('combatPage.patch.costValue') }}</dt>
                <dd>{{ displayValue(selectedPatch.costValue) }}</dd>
              </div>
              <div>
                <dt>{{ pageT('combatPage.patch.maxChargeTime') }}</dt>
                <dd>{{ displayValue(selectedPatch.maxChargeTime) }}</dd>
              </div>
            </dl>
            <EmptyState v-else compact :title="pageT('combatPage.empty.metrics')" />
          </section>

          <section class="combat-section" data-layout-region="skill-core">
            <div class="combat-section-heading">
              <span>SkillData</span>
              <h2>{{ pageT('combatPage.sections.core') }}</h2>
            </div>
            <div v-if="skillMetrics.length" class="combat-metric-grid">
              <div
                v-for="metric in skillMetrics"
                :key="metric.id"
                class="combat-metric"
                :class="{ 'is-important': metric.important }"
              >
                <span>{{ metricLabel(metric.id) }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
            </div>
            <EmptyState v-else compact :title="pageT('combatPage.empty.metrics')" />
          </section>

          <section class="combat-section" data-layout-region="skill-windows">
            <div class="combat-section-heading">
              <span>Frames</span>
              <h2>{{ pageT('combatPage.sections.windows') }}</h2>
            </div>
            <div v-if="skillWindows.length" class="combat-window-list">
              <article v-for="window in skillWindows" :key="window.id" class="combat-window">
                <header>
                  <strong>{{ window.label }}</strong>
                  <span>{{ pageT('combatPage.windowRange', { start: window.start, end: window.end }) }}</span>
                </header>
                <div class="combat-window__track">
                  <span :class="`is-${window.kind}`" :style="windowStyle(window)" />
                </div>
              </article>
            </div>
            <EmptyState v-else compact :title="pageT('combatPage.empty.windows')" />
          </section>

          <section class="combat-section" data-layout-region="skill-hits">
            <div class="combat-section-heading">
              <span>Damage Actions</span>
              <h2>{{ pageT('combatPage.sections.hits') }}</h2>
            </div>
            <div v-if="skillHits.length" class="combat-ledger-wrap">
              <table class="combat-ledger">
                <thead>
                  <tr>
                    <th>{{ pageT('combatPage.hit.action') }}</th>
                    <th>{{ pageT('combatPage.hit.time') }}</th>
                    <th>{{ pageT('combatPage.hit.damage') }}</th>
                    <th>{{ pageT('combatPage.hit.poise') }}</th>
                    <th>{{ pageT('combatPage.hit.resource') }}</th>
                    <th>{{ pageT('combatPage.hit.note') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="hit in skillHits" :key="hit.id">
                    <th>{{ hit.label }}</th>
                    <td>{{ hit.time || t('common.notAvailable') }}</td>
                    <td>{{ hit.damage || t('common.notAvailable') }}</td>
                    <td>{{ hit.poise || t('common.notAvailable') }}</td>
                    <td>{{ hit.resource || t('common.notAvailable') }}</td>
                    <td>{{ hit.note || t('common.notAvailable') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EmptyState v-else compact :title="pageT('combatPage.empty.hits')" />
          </section>

          <section class="combat-section combat-action-data" data-layout-region="skill-tabs">
            <Tabs
              v-model="activeTopTab"
              :items="skillTabs"
              :ariaLabel="pageT('combatPage.sections.actionData')"
            >
              <template #panel-timeline>
                <LoadingState v-if="graphQuery.isPending.value" compact :label="t('common.loading')" />
                <ErrorState
                  v-else-if="graphQuery.isError.value"
                  compact
                  :title="t('common.error')"
                  :description="t(userErrorMessageKey(graphQuery.error.value))"
                  :retry-label="t('common.retry')"
                  @retry="graphQuery.refetch()"
                />
                <EmptyState
                  v-else-if="!graphQuery.data.value?.timeline.length"
                  compact
                  :title="t('common.empty')"
                />
                <div v-else class="timeline-panel">
                  <button
                    v-for="group in graphQuery.data.value.timeline"
                    :key="group.id"
                    type="button"
                    class="timeline-row"
                    :class="{ 'is-active': activeTimelineGroup?.id === group.id }"
                    @click="selectTimelineGroup(group.nodeIds)"
                  >
                    <span>{{ timelineLabel(group) }}</span>
                    <strong>{{ group.nodeIds.length }}</strong>
                  </button>
                </div>
              </template>

              <template #panel-logic>
                <LoadingState v-if="graphQuery.isPending.value" compact :label="t('common.loading')" />
                <ErrorState
                  v-else-if="graphQuery.isError.value"
                  compact
                  :title="t('common.error')"
                  :description="t(userErrorMessageKey(graphQuery.error.value))"
                  :retry-label="t('common.retry')"
                  @retry="graphQuery.refetch()"
                />
                <CombatGraphViews
                  v-else-if="graphQuery.data.value"
                  v-model:active-view="activeGraphView"
                  :domain="domain"
                  :graph="graphQuery.data.value"
                  :visible-graph="visibleGraph"
                  :tree-items="treeItems"
                  :flow-elements="flowElements"
                  :selected-node-id="selectedNodeId"
                  :selected-node="selectedNode"
                  :node-budget="nodeBudget"
                  :include-performance="includePerformance"
                  :layout-pending="layoutQuery.isPending.value"
                  :layout-error="layoutQuery.error.value"
                  :action-label="actionLabel"
                  @update:node-budget="nodeBudget = $event"
                  @update:include-performance="includePerformance = $event"
                  @increase-budget="increaseNodeBudget"
                  @toggle-tree="toggleTreeItem"
                  @select-node="selectNode"
                  @linear-key="handleLinearKey"
                  @node-click="handleNodeClick"
                  @retry-layout="layoutQuery.refetch()"
                />
              </template>

              <template #panel-debug>
                <div class="combat-technical-grid">
                  <section>
                    <h3>{{ pageT('combatPage.sections.blackboard') }}</h3>
                    <dl v-if="blackboard.length" class="combat-blackboard">
                      <div v-for="entry in blackboard" :key="entry.key">
                        <dt>{{ entry.key }}</dt>
                        <dd>{{ entry.value }}</dd>
                        <small>{{ entry.source }}</small>
                      </div>
                    </dl>
                    <EmptyState v-else compact :title="pageT('combatPage.empty.blackboard')" />
                  </section>
                  <section>
                    <h3>{{ pageT('combatPage.sections.diagnostics') }}</h3>
                    <ul v-if="graphQuery.data.value?.diagnostics.length" class="combat-diagnostics">
                      <li
                        v-for="diagnostic in graphQuery.data.value.diagnostics"
                        :key="`${diagnostic.code}:${diagnostic.path}`"
                      >
                        <strong>{{ diagnostic.code }}</strong>
                        <span>{{ diagnostic.message }}</span>
                        <code v-if="diagnostic.path">{{ diagnostic.path }}</code>
                      </li>
                    </ul>
                    <EmptyState v-else compact :title="pageT('combatPage.empty.diagnostics')" />
                  </section>
                </div>
                <RawDataInspector
                  v-model:open="rawOpen"
                  :value="stableStringify(rawQuery.data.value.value)"
                  :label="t('common.rawData')"
                  :copy-label="pageT('combatPage.copyRaw')"
                  :copied-label="pageT('combatPage.copiedRaw')"
                />
              </template>
            </Tabs>
          </section>
        </template>

        <template v-else>
          <header class="combat-detail-header combat-buff-header" data-layout-region="buff-identity">
            <div class="combat-detail-heading">
              <ImageWithFallback
                v-if="buffIcon"
                class="combat-detail-icon"
                :src="buffIcon"
                :alt="detailTitle"
                width="72"
                height="72"
                loading="eager"
              />
              <div class="combat-detail-copy">
                <div class="combat-buff-meta">
                  <span class="combat-owner-chip">
                    <ImageWithFallback
                      v-if="ownerIcon"
                      :src="ownerIcon"
                      :alt="owner?.name || ''"
                      width="20"
                      height="20"
                    />
                    <span>{{ owner?.name || t('common.notAvailable') }}</span>
                  </span>
                  <span>BuffData</span>
                </div>
                <h1>{{ detailTitle }}</h1>
                <p>{{ selectedId }}</p>
              </div>
            </div>
            <div class="combat-header-actions">
              <code>{{ selectedId }}</code>
              <Tooltip v-if="preferences.showExport" :text="t('common.exportJson')">
                <button
                  type="button"
                  class="combat-icon-button"
                  :aria-label="t('common.exportJson')"
                  @click="downloadRaw"
                >
                  <Download :size="18" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
            <div class="combat-owner-hint">
              <strong>{{ pageT('combatPage.ownerHint') }}</strong>
              <span>{{ pageT('combatPage.ownerNotice') }}</span>
            </div>
          </header>

          <section class="combat-section" data-layout-region="buff-core">
            <div class="combat-section-heading">
              <span>Config</span>
              <h2>{{ pageT('combatPage.sections.core') }}</h2>
            </div>
            <div v-if="buffMetrics.length" class="combat-metric-grid">
              <div
                v-for="metric in buffMetrics"
                :key="metric.id"
                class="combat-metric"
                :class="{ 'is-important': metric.important }"
              >
                <span>{{ metricLabel(metric.id) }}</span>
                <strong>{{ metric.value }}</strong>
              </div>
            </div>
            <EmptyState v-else compact :title="pageT('combatPage.empty.metrics')" />
          </section>

          <section class="combat-section" data-layout-region="buff-effects">
            <div class="combat-section-heading">
              <span>Modifiers</span>
              <h2>{{ pageT('combatPage.sections.effects') }}</h2>
            </div>
            <div v-if="buffEffects.length" class="combat-effect-groups">
              <section v-for="group in buffEffects" :key="group.id" class="combat-effect-group">
                <header>
                  <h3>{{ effectLabel(group.id) }}</h3>
                  <span>{{ group.items.length }}</span>
                </header>
                <article v-for="item in group.items" :key="item.id">
                  <strong>{{ item.title }}</strong>
                  <dl>
                    <div v-for="field in item.fields" :key="field.key">
                      <dt>{{ field.key }}</dt>
                      <dd>{{ field.value }}</dd>
                    </div>
                  </dl>
                </article>
              </section>
            </div>
            <EmptyState v-else compact :title="pageT('combatPage.empty.effects')" />
          </section>

          <section class="combat-section combat-action-data" data-layout-region="buff-action-data">
            <div class="combat-section-heading">
              <span>ActionData</span>
              <h2>{{ pageT('combatPage.sections.actionData') }}</h2>
            </div>
            <Tabs
              v-model="activeTopTab"
              :items="buffTabs"
              :ariaLabel="pageT('combatPage.sections.actionData')"
            >
              <template #panel-events>
                <LoadingState v-if="graphQuery.isPending.value" compact :label="t('common.loading')" />
                <ErrorState
                  v-else-if="graphQuery.isError.value"
                  compact
                  :title="t('common.error')"
                  :description="t(userErrorMessageKey(graphQuery.error.value))"
                  :retry-label="t('common.retry')"
                  @retry="graphQuery.refetch()"
                />
                <CombatGraphViews
                  v-else-if="graphQuery.data.value"
                  v-model:active-view="activeGraphView"
                  :domain="domain"
                  :graph="graphQuery.data.value"
                  :visible-graph="visibleGraph"
                  :tree-items="treeItems"
                  :flow-elements="flowElements"
                  :selected-node-id="selectedNodeId"
                  :selected-node="selectedNode"
                  :node-budget="nodeBudget"
                  :include-performance="includePerformance"
                  :layout-pending="layoutQuery.isPending.value"
                  :layout-error="layoutQuery.error.value"
                  :action-label="actionLabel"
                  @update:node-budget="nodeBudget = $event"
                  @update:include-performance="includePerformance = $event"
                  @increase-budget="increaseNodeBudget"
                  @toggle-tree="toggleTreeItem"
                  @select-node="selectNode"
                  @linear-key="handleLinearKey"
                  @node-click="handleNodeClick"
                  @retry-layout="layoutQuery.refetch()"
                />
              </template>

              <template #panel-timeline>
                <LoadingState v-if="graphQuery.isPending.value" compact :label="t('common.loading')" />
                <ErrorState
                  v-else-if="graphQuery.isError.value"
                  compact
                  :title="t('common.error')"
                  :description="t(userErrorMessageKey(graphQuery.error.value))"
                  :retry-label="t('common.retry')"
                  @retry="graphQuery.refetch()"
                />
                <EmptyState
                  v-else-if="!graphQuery.data.value?.timeline.length"
                  compact
                  :title="t('common.empty')"
                />
                <div v-else class="timeline-panel">
                  <button
                    v-for="group in graphQuery.data.value.timeline"
                    :key="group.id"
                    type="button"
                    class="timeline-row"
                    :class="{ 'is-active': activeTimelineGroup?.id === group.id }"
                    @click="selectTimelineGroup(group.nodeIds)"
                  >
                    <span>{{ timelineLabel(group) }}</span>
                    <strong>{{ group.nodeIds.length }}</strong>
                  </button>
                </div>
              </template>

              <template #panel-links>
                <ul v-if="graphQuery.data.value?.externalRefs.length" class="combat-references">
                  <li v-for="reference in graphQuery.data.value.externalRefs" :key="reference.id">
                    <span>{{ reference.kind }}</span>
                    <strong>{{ reference.rawId || reference.dynamicKey }}</strong>
                    <code>{{ reference.field }} · {{ reference.path }}</code>
                  </li>
                </ul>
                <EmptyState v-else compact :title="pageT('combatPage.empty.references')" />
              </template>

              <template #panel-technical>
                <div class="combat-technical-grid">
                  <section>
                    <h3>{{ pageT('combatPage.sections.blackboard') }}</h3>
                    <dl v-if="blackboard.length" class="combat-blackboard">
                      <div v-for="entry in blackboard" :key="entry.key">
                        <dt>{{ entry.key }}</dt>
                        <dd>{{ entry.value }}</dd>
                        <small>{{ entry.source }}</small>
                      </div>
                    </dl>
                    <EmptyState v-else compact :title="pageT('combatPage.empty.blackboard')" />
                  </section>
                  <section>
                    <h3>{{ pageT('combatPage.sections.diagnostics') }}</h3>
                    <ul v-if="graphQuery.data.value?.diagnostics.length" class="combat-diagnostics">
                      <li
                        v-for="diagnostic in graphQuery.data.value.diagnostics"
                        :key="`${diagnostic.code}:${diagnostic.path}`"
                      >
                        <strong>{{ diagnostic.code }}</strong>
                        <span>{{ diagnostic.message }}</span>
                        <code v-if="diagnostic.path">{{ diagnostic.path }}</code>
                      </li>
                    </ul>
                    <EmptyState v-else compact :title="pageT('combatPage.empty.diagnostics')" />
                  </section>
                </div>
                <RawDataInspector
                  v-model:open="rawOpen"
                  :value="stableStringify(rawQuery.data.value.value)"
                  :label="t('common.rawData')"
                  :copy-label="pageT('combatPage.copyRaw')"
                  :copied-label="pageT('combatPage.copiedRaw')"
                />
              </template>
            </Tabs>
          </section>
        </template>
      </div>
    </section>

    <ResponsiveDrawer
      v-model:open="directoryOpen"
      side="left"
      :title="pageT(`combatPage.drawer.${domain}`)"
      :close-label="t('common.close')"
    >
      <template #trigger>
        <button type="button" class="combat-mobile-directory-button">
          <ListTree :size="18" aria-hidden="true" />
          <span>{{ pageT(`combatPage.drawer.${domain}`) }}</span>
        </button>
      </template>
      <CombatDirectory
        :domain="domain"
        :sections="visibleDirectory"
        :selected-id="selectedId"
        :search="search"
        :expanded-owners="expandedOwners"
        :expanded-groups="expandedGroups"
        :loading="manifestQuery.isPending.value"
        :error="manifestQuery.isError.value"
        @update:search="search = $event"
        @toggle-owner="toggleOwner"
        @toggle-group="toggleGroup"
        @select="openEntry"
        @retry="manifestQuery.refetch()"
      />
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.combat-legacy-module {
  display: grid;
  grid-template-columns: var(--combat-sidebar-width) minmax(0, 1fr);
  min-width: 0;
  min-height: calc(100dvh - var(--ake-app-header-height, 4rem));
  background: var(--ake-color-surface);
}

.combat-sidebar {
  min-width: 0;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border-strong);
  background: var(--ake-color-surface-muted);
}

.combat-sidebar > :deep(.combat-directory) {
  position: sticky;
  top: 0;
  max-height: calc(100dvh - var(--ake-app-header-height, 4rem));
  overflow-y: auto;
}

.combat-detail {
  min-width: 0;
  padding: clamp(var(--ake-space-4), 3vw, var(--ake-space-8));
}

.combat-detail__inner {
  display: grid;
  max-width: 92rem;
  min-width: 0;
  gap: var(--ake-space-6);
  margin-inline: auto;
}

.combat-detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ake-space-4);
  padding-block-end: var(--ake-space-5);
  border-block-end: 2px solid var(--ake-color-border-strong);
}

.combat-detail-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-4);
}

.combat-detail-icon {
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 4.5rem;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.combat-detail-copy {
  min-width: 0;
}

.combat-detail-copy h1 {
  margin: var(--ake-space-1) 0;
  font-size: clamp(1.45rem, 2vw, 2rem);
  line-height: var(--ake-line-height-tight);
  overflow-wrap: anywhere;
}

.combat-detail-copy p,
.combat-eyebrow {
  margin: 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  overflow-wrap: anywhere;
}

.combat-eyebrow {
  color: var(--ake-color-accent);
  font-weight: 700;
}

.combat-header-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ake-space-2);
}

.combat-header-actions code {
  max-width: min(30rem, 38vw);
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}

.combat-icon-button {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 2.5rem;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.combat-context-row,
.combat-facts {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-3);
}

.combat-context-row {
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.combat-context-item {
  display: flex;
  min-width: 9rem;
  flex: 1 1 12rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
}

.combat-context-item > span,
.combat-section-heading > span,
.combat-metric > span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-section {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-4);
}

.combat-section-heading {
  display: grid;
  gap: 2px;
  padding-block-end: var(--ake-space-2);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-section-heading h2,
.combat-technical-grid h3,
.combat-effect-group h3 {
  margin: 0;
  font-size: var(--ake-font-size-lg);
}

.combat-facts {
  margin: 0;
}

.combat-facts > div {
  display: grid;
  min-width: 10rem;
  flex: 1 1 10rem;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border-inline-start: 3px solid var(--ake-color-border-strong);
  background: var(--ake-color-surface-muted);
}

.combat-facts dt,
.combat-blackboard dt,
.combat-effect-group dt {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-facts dd,
.combat-blackboard dd,
.combat-effect-group dd {
  min-width: 0;
  margin: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.combat-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--ake-space-2);
}

.combat-metric {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.combat-metric.is-important {
  border-inline-start: 3px solid var(--ake-color-accent);
}

.combat-metric strong {
  font-size: var(--ake-font-size-lg);
  overflow-wrap: anywhere;
}

.combat-window-list {
  display: grid;
  gap: var(--ake-space-3);
}

.combat-window {
  display: grid;
  gap: var(--ake-space-2);
}

.combat-window header {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: var(--ake-space-3);
  font-size: var(--ake-font-size-sm);
}

.combat-window header span {
  color: var(--ake-color-text-muted);
}

.combat-window__track {
  position: relative;
  height: 0.625rem;
  overflow: hidden;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.combat-window__track > span {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 2px;
  background: var(--ake-color-accent);
}

.combat-window__track > .is-defense {
  background: var(--ake-color-success);
}
.combat-window__track > .is-cancel {
  background: var(--ake-color-warning);
}
.combat-window__track > .is-damage {
  background: var(--ake-color-danger);
}
.combat-window__track > .is-movement {
  background: var(--ake-color-info);
}

.combat-ledger-wrap {
  min-width: 0;
  overflow-x: auto;
}

.combat-ledger {
  width: 100%;
  min-width: 52rem;
  border-collapse: collapse;
  font-size: var(--ake-font-size-sm);
}

.combat-ledger th,
.combat-ledger td {
  padding: var(--ake-space-2) var(--ake-space-3);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  text-align: start;
  overflow-wrap: anywhere;
}

.combat-ledger thead th {
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-action-data {
  padding-block-start: var(--ake-space-2);
  border-block-start: 2px solid var(--ake-color-border-strong);
}

.timeline-panel {
  display: grid;
}

.timeline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 3.125rem;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.timeline-row:hover,
.timeline-row.is-active {
  background: var(--ake-color-surface-hover);
}

.timeline-row.is-active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}

.timeline-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.timeline-row strong {
  min-width: 2rem;
  color: var(--ake-color-text-muted);
  text-align: end;
}

.combat-buff-header {
  grid-template-areas: 'heading actions' 'hint hint';
}

.combat-buff-header .combat-detail-heading {
  grid-area: heading;
}
.combat-buff-header .combat-header-actions {
  grid-area: actions;
}

.combat-buff-meta,
.combat-owner-chip {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.combat-buff-meta {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-owner-chip {
  max-width: 20rem;
  padding: 0.2rem 0.45rem;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface-muted);
  font-weight: 700;
}

.combat-owner-chip :deep(.ake-image) {
  width: 1.25rem;
  height: 1.25rem;
}

.combat-owner-hint {
  grid-area: hint;
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--ake-space-3);
  padding: var(--ake-space-3);
  border-inline-start: 3px solid var(--ake-color-warning);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-sm);
}

.combat-owner-hint span {
  color: var(--ake-color-text-muted);
}

.combat-effect-groups,
.combat-effect-group,
.combat-effect-group article,
.combat-effect-group dl {
  display: grid;
  min-width: 0;
}

.combat-effect-groups {
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--ake-space-3);
}

.combat-effect-group {
  align-content: start;
  border: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-effect-group > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-muted);
}

.combat-effect-group > header span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-effect-group article {
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-effect-group dl {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ake-space-2);
  margin: 0;
}

.combat-effect-group dl > div {
  min-width: 0;
}

.combat-technical-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ake-space-4);
  margin-block-end: var(--ake-space-4);
}

.combat-technical-grid > section {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: var(--ake-space-3);
}

.combat-blackboard,
.combat-diagnostics,
.combat-references {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.combat-blackboard > div,
.combat-diagnostics li,
.combat-references li {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.combat-blackboard small,
.combat-diagnostics code,
.combat-references code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.combat-references li > span {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  text-transform: uppercase;
}

.combat-mobile-directory-button {
  position: fixed;
  z-index: calc(var(--ake-z-sticky) + 1);
  right: var(--ake-space-4);
  bottom: var(--ake-space-4);
  display: none;
  min-height: 3rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
  cursor: pointer;
}

@media (max-width: 64rem) {
  .combat-legacy-module {
    --combat-sidebar-width: 320px !important;
  }

  .combat-detail {
    padding: var(--ake-space-4);
  }
}

@media (max-width: 48rem) {
  .combat-legacy-module {
    display: block;
  }

  .combat-sidebar {
    display: none;
  }

  .combat-detail {
    padding: var(--ake-space-4) var(--ake-space-3) 5.5rem;
  }

  .combat-mobile-directory-button {
    display: inline-flex;
  }

  .combat-detail-header,
  .combat-buff-header {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'heading' 'actions' 'hint';
  }

  .combat-header-actions {
    justify-content: flex-start;
  }

  .combat-header-actions code {
    max-width: calc(100vw - 7rem);
  }

  .combat-detail-icon {
    width: 3.5rem;
    height: 3.5rem;
    flex-basis: 3.5rem;
  }

  .combat-technical-grid,
  .combat-effect-groups {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 34rem) {
  .combat-context-row,
  .combat-context-item,
  .combat-owner-hint {
    align-items: stretch;
    flex-direction: column;
  }

  .combat-effect-group dl {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
