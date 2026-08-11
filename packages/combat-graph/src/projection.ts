import type {
  ActionEdge,
  ActionGraph,
  ActionNode,
  GraphDiagnostic,
  GraphProjectionInfo,
  LinearTreeItem,
  LinearTreeOptions,
  SubtreeSelectionOptions,
  TreeKeyboardCommand,
  TreeKeyboardResult
} from './types'

function boundedInteger(value: unknown, fallback: number, minimum = 1, maximum = 10_000): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function idSet(value: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> | null {
  if (value === undefined) return null
  return new Set(value)
}

function childrenByParent(
  graph: ActionGraph,
  includeExternal = false
): ReadonlyMap<string, readonly string[]> {
  const order = new Map<string, number>(graph.nodes.map((node) => [node.id, node.sourceOrder] as const))
  const children = new Map<string, string[]>()
  const edges = includeExternal ? [...graph.structuralEdges, ...graph.referenceEdges] : graph.structuralEdges
  for (const edge of edges) {
    const values = children.get(edge.source) ?? []
    if (!values.includes(edge.target)) values.push(edge.target)
    children.set(edge.source, values)
  }
  children.forEach((values) =>
    values.sort(
      (left, right) =>
        (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER)
    )
  )
  return children
}

function subtreeCounter(children: ReadonlyMap<string, readonly string[]>): (rootId: string) => number {
  const memo = new Map<string, number>()
  const count = (id: string, ancestors = new Set<string>()): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (ancestors.has(id)) return 0
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(id)
    const total =
      1 + (children.get(id) ?? []).reduce((sum, childId) => sum + count(childId, nextAncestors), 0)
    memo.set(id, total)
    return total
  }
  return count
}

function projectionSummaryId(graph: ActionGraph, parentId: string): string {
  return `${graph.domain}:${encodeURIComponent(graph.documentId)}:summary:${encodeURIComponent(parentId)}`
}

function emptyProjection(graph: ActionGraph, rootId: string, budget: number, batchSize: number): ActionGraph {
  const diagnostic: GraphDiagnostic = {
    code: 'SUBTREE_ROOT_NOT_FOUND',
    severity: 'warning',
    message: `Subtree root was not found: ${rootId}.`,
    nodeId: rootId
  }
  return {
    ...graph,
    nodes: [],
    edges: [],
    structuralEdges: [],
    flowEdges: [],
    referenceEdges: [],
    roots: [],
    timeline: [],
    externalRefs: [],
    diagnostics: [...graph.diagnostics, diagnostic],
    warnings: [...graph.warnings, diagnostic.message],
    truncated: true,
    projection: {
      rootId,
      budget,
      batchSize,
      visibleNodeCount: 0,
      omittedCount: 0,
      nextBudget: budget,
      expandableNodeIds: [],
      omittedByParent: {}
    }
  }
}

export function selectSubtree(
  graph: ActionGraph,
  rootId: string,
  budgetOrOptions: number | SubtreeSelectionOptions = graph.defaultNodeBudget
): ActionGraph {
  const options: SubtreeSelectionOptions =
    typeof budgetOrOptions === 'number' ? { budget: budgetOrOptions } : budgetOrOptions
  const budget = boundedInteger(options.budget, graph.defaultNodeBudget)
  const batchSize = boundedInteger(options.batchSize, 50)
  const expanded = idSet(options.expandedIds)
  const includeExternalReferences = options.includeExternalReferences ?? true
  const nodeById = new Map<string, ActionNode>(graph.nodes.map((node) => [node.id, node] as const))
  if (!nodeById.has(rootId)) return emptyProjection(graph, rootId, budget, batchSize)

  const structuralChildren = childrenByParent(graph)
  const countSubtree = subtreeCounter(structuralChildren)
  const totalStructuralNodes = countSubtree(rootId)
  const needsSummarySlot = totalStructuralNodes > budget
  const contentBudget = needsSummarySlot && budget > 1 ? budget - 1 : budget
  const visibleStructural = new Set<string>()
  const hiddenRootsByParent = new Map<string, string[]>()

  const hide = (parentId: string, childId: string): void => {
    const hidden = hiddenRootsByParent.get(parentId) ?? []
    if (!hidden.includes(childId)) hidden.push(childId)
    hiddenRootsByParent.set(parentId, hidden)
  }

  const visit = (id: string, hiddenParent: string | null): void => {
    if (visibleStructural.has(id)) return
    if (visibleStructural.size >= contentBudget) {
      if (hiddenParent) hide(hiddenParent, id)
      return
    }
    visibleStructural.add(id)
    const childIds = structuralChildren.get(id) ?? []
    if (expanded !== null && !expanded.has(id)) {
      childIds.forEach((childId) => hide(id, childId))
      return
    }
    childIds.forEach((childId) => visit(childId, id))
  }
  visit(rootId, null)

  const omittedByParent = new Map<string, number>()
  for (const [parentId, hiddenRoots] of hiddenRootsByParent) {
    omittedByParent.set(
      parentId,
      hiddenRoots.reduce((sum, hiddenRoot) => sum + countSubtree(hiddenRoot), 0)
    )
  }

  const selectedIds = new Set(visibleStructural)
  const summaryNodes: ActionNode[] = []
  const summaryEdges: ActionEdge[] = []
  const summaryIdByParent = new Map<string, string>()
  const hiddenEntries = [...hiddenRootsByParent.entries()].toSorted(([left], [right]) => {
    return (
      (nodeById.get(left)?.sourceOrder ?? Number.MAX_SAFE_INTEGER) -
      (nodeById.get(right)?.sourceOrder ?? Number.MAX_SAFE_INTEGER)
    )
  })
  for (const [parentId, hiddenRoots] of hiddenEntries) {
    if (selectedIds.size + summaryNodes.length >= budget) break
    const parent = nodeById.get(parentId)
    if (!parent) continue
    const omittedCount = omittedByParent.get(parentId) ?? 0
    const summaryId = projectionSummaryId(graph, parentId)
    summaryIdByParent.set(parentId, summaryId)
    summaryNodes.push({
      id: summaryId,
      domain: graph.domain,
      kind: 'summary',
      actionType: 'CollapsedActions',
      rawType: '',
      category: 'logic',
      label: `${omittedCount} nodes collapsed`,
      path: parent.path,
      parentId,
      childIds: [],
      time: { confidence: 'unknown' },
      depth: parent.depth + 1,
      sourceOrder: parent.sourceOrder + 0.5,
      data: { omittedRootIds: hiddenRoots, omittedCount },
      collapsed: true,
      omittedCount
    })
    summaryEdges.push({
      id: `projection:structure:${parentId}->${summaryId}`,
      source: parentId,
      target: summaryId,
      channel: 'structural',
      kind: 'structure',
      label: 'contains collapsed nodes',
      certainty: 'derived',
      evidencePath: parent.path
    })
  }

  const externalCandidates = includeExternalReferences
    ? graph.referenceEdges.filter((edge) => visibleStructural.has(edge.source)).map((edge) => edge.target)
    : []
  const selectedExternal = new Set<string>()
  for (const externalId of externalCandidates) {
    if (selectedIds.size + summaryNodes.length + selectedExternal.size >= budget) break
    if (nodeById.get(externalId)?.kind === 'external') selectedExternal.add(externalId)
  }
  selectedExternal.forEach((id) => selectedIds.add(id))

  const omittedExternalCount = new Set(externalCandidates.filter((id) => !selectedExternal.has(id))).size
  const structuralOmittedCount = [...omittedByParent.values()].reduce((sum, count) => sum + count, 0)
  const omittedCount = structuralOmittedCount + omittedExternalCount
  const projectedNodes = graph.nodes
    .filter((node) => selectedIds.has(node.id))
    .map((node): ActionNode => {
      if (node.kind === 'external') return node
      const visibleChildren = (structuralChildren.get(node.id) ?? []).filter((childId) =>
        visibleStructural.has(childId)
      )
      const summaryId = summaryIdByParent.get(node.id)
      return {
        ...node,
        parentId: node.id === rootId ? null : node.parentId,
        childIds: summaryId ? [...visibleChildren, summaryId] : visibleChildren
      }
    })
  projectedNodes.push(...summaryNodes)

  const projectedStructuralEdges = [
    ...graph.structuralEdges.filter(
      (edge) => visibleStructural.has(edge.source) && visibleStructural.has(edge.target)
    ),
    ...summaryEdges
  ]
  const projectedFlowEdges = graph.flowEdges.filter(
    (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
  )
  const projectedReferenceEdges = graph.referenceEdges.filter(
    (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
  )
  const projectedTimeline = graph.timeline
    .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((nodeId) => visibleStructural.has(nodeId)) }))
    .filter((group) => group.nodeIds.length > 0)
  const projectedExternalRefs = graph.externalRefs.filter((reference) =>
    visibleStructural.has(reference.sourceNodeId)
  )
  const expandableNodeIds = [...visibleStructural].filter(
    (id) => (structuralChildren.get(id)?.length ?? 0) > 0
  )
  const omittedRecord = Object.fromEntries(omittedByParent)
  const totalPotentialNodes = totalStructuralNodes + new Set(externalCandidates).size
  const projection: GraphProjectionInfo = {
    rootId,
    budget,
    batchSize,
    visibleNodeCount: projectedNodes.length,
    omittedCount,
    nextBudget:
      omittedCount > 0 ? Math.max(budget, Math.min(totalPotentialNodes, budget + batchSize)) : budget,
    expandableNodeIds,
    omittedByParent: omittedRecord
  }
  const projectionWarning =
    omittedCount > 0
      ? `Visible graph is limited to ${budget} nodes; ${omittedCount} nodes remain collapsed.`
      : ''

  return {
    ...graph,
    nodes: projectedNodes,
    edges: [...projectedStructuralEdges, ...projectedFlowEdges, ...projectedReferenceEdges],
    structuralEdges: projectedStructuralEdges,
    flowEdges: projectedFlowEdges,
    referenceEdges: projectedReferenceEdges,
    roots: [rootId],
    timeline: projectedTimeline,
    externalRefs: projectedExternalRefs,
    warnings: projectionWarning ? [...graph.warnings, projectionWarning] : graph.warnings,
    truncated: graph.truncated || omittedCount > 0,
    projection
  }
}

export function createLinearTreeProjection(
  graph: ActionGraph,
  options: LinearTreeOptions = {}
): LinearTreeItem[] {
  const expanded = idSet(options.expandedIds)
  const includeExternal = options.includeExternal ?? false
  const children = childrenByParent(graph, includeExternal)
  const nodeById = new Map<string, ActionNode>(graph.nodes.map((node) => [node.id, node] as const))
  const roots = options.rootIds ?? graph.roots
  const items: LinearTreeItem[] = []
  const visited = new Set<string>()

  const append = (
    id: string,
    parentId: string | null,
    depth: number,
    positionInSet: number,
    setSize: number
  ): void => {
    if (visited.has(id)) return
    const node = nodeById.get(id)
    if (!node || (!includeExternal && node.kind === 'external')) return
    visited.add(id)
    const childIds = (children.get(id) ?? []).filter((childId) => {
      const child = nodeById.get(childId)
      return Boolean(child && (includeExternal || child.kind !== 'external'))
    })
    const expandable = childIds.length > 0
    const isExpanded = expandable && (expanded === null || expanded.has(id))
    items.push({
      id,
      node,
      parentId,
      depth,
      index: items.length,
      positionInSet,
      setSize,
      expandable,
      expanded: isExpanded
    })
    if (!isExpanded) return
    childIds.forEach((childId, index) => append(childId, id, depth + 1, index + 1, childIds.length))
  }

  roots.forEach((rootId, index) => append(rootId, null, 0, index + 1, roots.length))
  return items
}

export function linearizeGraph(graph: ActionGraph): ActionNode[] {
  return createLinearTreeProjection(graph).map((item) => item.node)
}

export function resolveTreeKeyboardTarget(
  items: readonly LinearTreeItem[],
  currentId: string | null,
  command: TreeKeyboardCommand
): TreeKeyboardResult {
  if (!items.length) return { focusId: null }
  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentId)
  )
  const current = items[currentIndex] ?? items[0]
  if (!current) return { focusId: null }

  if (command === 'Home') return { focusId: items[0]?.id ?? null }
  if (command === 'End') return { focusId: items.at(-1)?.id ?? null }
  if (command === 'ArrowUp') return { focusId: items[Math.max(0, currentIndex - 1)]?.id ?? current.id }
  if (command === 'ArrowDown')
    return { focusId: items[Math.min(items.length - 1, currentIndex + 1)]?.id ?? current.id }
  if (command === 'Enter') return { focusId: current.id, selectId: current.id }
  if (command === ' ') {
    if (!current.expandable) return { focusId: current.id }
    return current.expanded
      ? { focusId: current.id, collapseId: current.id }
      : { focusId: current.id, expandId: current.id }
  }
  if (command === 'ArrowRight') {
    if (!current.expandable) return { focusId: current.id }
    if (!current.expanded) return { focusId: current.id, expandId: current.id }
    const firstChild = items.slice(currentIndex + 1).find((item) => item.parentId === current.id)
    return { focusId: firstChild?.id ?? current.id }
  }
  if (command === 'ArrowLeft') {
    if (current.expandable && current.expanded) return { focusId: current.id, collapseId: current.id }
    return { focusId: current.parentId ?? current.id }
  }
  return { focusId: current.id }
}
