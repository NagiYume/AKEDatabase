import type { ActionEdge, ActionGraph, ElkGraphInput, ElkGraphOptions } from './types'

export function createElkGraph(
  graph: ActionGraph,
  direction: 'RIGHT' | 'DOWN',
  options: ElkGraphOptions = {}
): ElkGraphInput {
  const includeStructuralEdges = options.includeStructuralEdges ?? true
  const includeFlowEdges = options.includeFlowEdges ?? true
  const includeReferenceEdges = options.includeReferenceEdges ?? true
  const nodeWidth = Math.max(80, options.nodeWidth ?? 230)
  const nodeHeight = Math.max(40, options.nodeHeight ?? 88)
  const summaryHeight = Math.max(32, options.summaryHeight ?? 64)
  const groupHeight = Math.max(40, options.groupHeight ?? 72)
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const edges: ActionEdge[] = []
  if (includeStructuralEdges) edges.push(...graph.structuralEdges)
  if (includeFlowEdges) edges.push(...graph.flowEdges)
  if (includeReferenceEdges) edges.push(...graph.referenceEdges)

  return {
    id: `${graph.domain}:${encodeURIComponent(graph.documentId)}:elk-root`,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': direction === 'DOWN' ? '20' : '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': direction === 'DOWN' ? '42' : '54',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.layered.mergeEdges': 'false',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
    },
    children: graph.nodes.map((node) => ({
      id: node.id,
      width: nodeWidth,
      height: node.kind === 'summary' ? summaryHeight : node.kind === 'group' ? groupHeight : nodeHeight
    })),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
        akeChannel: edge.channel,
        akeKind: edge.kind,
        evidencePath: edge.evidencePath
      }))
  }
}
