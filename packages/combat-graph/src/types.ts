import type { RawRecord } from '@ake/domain'

export type CombatDomain = 'skill' | 'buff'

export type ActionCategory =
  | 'presentation'
  | 'damage'
  | 'recovery'
  | 'defense'
  | 'cancel'
  | 'timing'
  | 'buff'
  | 'spawn'
  | 'resource'
  | 'control'
  | 'movement'
  | 'logic'
  | 'targeting'
  | 'modifier'
  | 'lifecycle'
  | 'unknown'
  | 'external'

export type StructuralEdgeKind = 'structure'
export type FlowEdgeKind =
  | 'sequence'
  | 'condition'
  | 'success'
  | 'failure'
  | 'tick'
  | 'loop'
  | 'loop-back'
  | 'end'
  | 'aura-enter'
  | 'aura-exit'
  | 'switch-case'
  | 'event'
export type ReferenceEdgeKind = 'external'
export type ActionEdgeKind = StructuralEdgeKind | FlowEdgeKind | ReferenceEdgeKind
export type ActionEdgeChannel = 'structural' | 'flow' | 'reference'
export type TimeConfidence = 'exact-frame' | 'group-range' | 'runtime-trigger' | 'unknown'

export interface ExactFrameTime {
  confidence: 'exact-frame'
  frame: number
  startFrame: number
  endFrame: number
  evidencePath: string
}

export interface GroupRangeTime {
  confidence: 'group-range'
  group: string
  evidencePath: string
  startFrame?: number
  endFrame?: number
  openEnded?: boolean
}

export interface RuntimeTriggerTime {
  confidence: 'runtime-trigger'
  trigger: string
  evidencePath: string
}

export interface UnknownTime {
  confidence: 'unknown'
}

export type ActionTime = ExactFrameTime | GroupRangeTime | RuntimeTriggerTime | UnknownTime

export interface ActionNode {
  id: string
  domain: CombatDomain
  kind: 'action' | 'group' | 'external' | 'summary'
  actionType: string
  rawType: string
  category: ActionCategory
  label: string
  /** RFC 6901 JSON Pointer into the parsed source document. */
  path: string
  parentId: string | null
  childIds: readonly string[]
  time: ActionTime
  depth: number
  sourceOrder: number
  data: RawRecord
  enabled?: boolean
  serverActionIndex?: string | number
  groupId?: string
  source?: string
  collapsed?: boolean
  omittedCount?: number
}

export interface ActionEdge {
  id: string
  source: string
  target: string
  channel: ActionEdgeChannel
  kind: ActionEdgeKind
  label: string
  certainty: 'explicit' | 'derived'
  evidencePath: string
}

export interface TimelineGroup {
  id: string
  kind: 'timeline' | 'runtime' | 'derived'
  label: string
  confidence: TimeConfidence
  time: ActionTime
  nodeIds: readonly string[]
  path: string
  frame?: number
  startFrame?: number
  endFrame?: number
  trigger?: string
}

export type ExternalReferenceKind =
  'skill' | 'buff' | 'projectile' | 'ability-entity' | 'tag' | 'enemy' | 'spawner'
export type ExternalReferenceStatus = 'unresolved' | 'dynamic'

export interface ExternalReference {
  id: string
  sourceNodeId: string
  targetNodeId: string
  kind: ExternalReferenceKind
  rawId: string
  field: string
  path: string
  status: ExternalReferenceStatus
  dynamicKey?: string
}

export interface GraphDiagnostic {
  code: string
  severity: 'info' | 'warning' | 'error'
  message: string
  path?: string
  nodeId?: string
  details?: RawRecord
}

export interface GraphStats {
  structuredNodeCount: number
  actionNodeCount: number
  groupNodeCount: number
  externalNodeCount: number
  unknownActionTypeCount: number
}

export interface GraphProjectionInfo {
  rootId: string
  budget: number
  batchSize: number
  visibleNodeCount: number
  omittedCount: number
  nextBudget: number
  expandableNodeIds: readonly string[]
  omittedByParent: Readonly<Record<string, number>>
}

export interface ActionGraph {
  domain: CombatDomain
  documentId: string
  nodes: readonly ActionNode[]
  /** Compatibility view containing structural, executable-flow and reference edges. */
  edges: readonly ActionEdge[]
  structuralEdges: readonly ActionEdge[]
  flowEdges: readonly ActionEdge[]
  referenceEdges: readonly ActionEdge[]
  roots: readonly string[]
  timeline: readonly TimelineGroup[]
  externalRefs: readonly ExternalReference[]
  diagnostics: readonly GraphDiagnostic[]
  warnings: readonly string[]
  stats: GraphStats
  defaultNodeBudget: number
  truncated: boolean
  projection?: GraphProjectionInfo
}

export interface GraphParseOptions {
  /** Default visible-node budget used by selectSubtree; parsing retains the full graph. */
  nodeBudget?: number
  includePerformance?: boolean
  documentId?: string
  maxDepth?: number
  maxStructuredNodes?: number
  maxActionNodes?: number
  maxExternalReferences?: number
}

export interface SubtreeSelectionOptions {
  budget?: number
  batchSize?: number
  expandedIds?: ReadonlySet<string> | readonly string[]
  includeExternalReferences?: boolean
}

export interface LinearTreeOptions {
  rootIds?: readonly string[]
  expandedIds?: ReadonlySet<string> | readonly string[]
  includeExternal?: boolean
}

export interface LinearTreeItem {
  id: string
  node: ActionNode
  parentId: string | null
  depth: number
  index: number
  positionInSet: number
  setSize: number
  expandable: boolean
  expanded: boolean
}

export type TreeKeyboardCommand =
  'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'Enter' | ' '

export interface TreeKeyboardResult {
  focusId: string | null
  expandId?: string
  collapseId?: string
  selectId?: string
}

export interface PositionedNode {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface GraphLayout {
  direction: 'RIGHT' | 'DOWN'
  width: number
  height: number
  nodes: readonly PositionedNode[]
}

export interface ElkGraphOptions {
  includeStructuralEdges?: boolean
  includeFlowEdges?: boolean
  includeReferenceEdges?: boolean
  nodeWidth?: number
  nodeHeight?: number
  summaryHeight?: number
  groupHeight?: number
}

export interface ElkNodeInput {
  id: string
  width: number
  height: number
}

export interface ElkEdgeInput {
  id: string
  sources: readonly string[]
  targets: readonly string[]
  akeChannel: ActionEdgeChannel
  akeKind: ActionEdgeKind
  evidencePath: string
}

export interface ElkGraphInput {
  id: string
  layoutOptions: Readonly<Record<string, string>>
  children: readonly ElkNodeInput[]
  edges: readonly ElkEdgeInput[]
}
