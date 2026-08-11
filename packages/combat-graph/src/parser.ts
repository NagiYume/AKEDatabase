import { asRecord, textValue, type RawRecord } from '@ake/domain'

import type {
  ActionCategory,
  ActionEdge,
  ActionGraph,
  ActionNode,
  ActionTime,
  CombatDomain,
  ExternalReference,
  ExternalReferenceKind,
  FlowEdgeKind,
  GraphDiagnostic,
  GraphParseOptions,
  TimelineGroup
} from './types'

interface MutableNode extends Omit<ActionNode, 'childIds'> {
  childIds: string[]
}

interface MutableGroup extends Omit<TimelineGroup, 'nodeIds'> {
  nodeIds: string[]
}

interface BranchRelation {
  kind: FlowEdgeKind
  evidencePath: string
}

interface SequenceState {
  anchorActionId: string | null
  evidencePath: string
  lastNodeId: string | null
}

interface TraversalContext {
  parentNodeId: string | null
  parentActionId: string | null
  relation: BranchRelation | null
  time: ActionTime | null
  groups: readonly MutableGroup[]
  sequence: SequenceState | null
  source: string
}

interface GroupDescription {
  kind: 'timeline' | 'runtime'
  label: string
  time: ActionTime
  source: string
}

const DEFAULT_MAX_DEPTH = 64
const DEFAULT_MAX_STRUCTURED_NODES = 250_000
const DEFAULT_MAX_ACTION_NODES = 50_000
const DEFAULT_MAX_EXTERNAL_REFERENCES = 20_000
const OPEN_ENDED_FRAME = 999_999

const PERFORMANCE_ACTION = /(camera|sound|audio|vfx|effect|animation|shake|rumble|timeline|playanim)/i
const ACTION_CONTAINER_KEY =
  /^(?:_?sequenceactiondata|actiondata|actions?|actionlist|behaviours?|effects?|events?|branches?|callbacks?)$/i
const EXPLICIT_SEQUENCE_KEY = /^(?:_?sequenceactiondata|orderedactions?|sequentialactions?)$/i

export function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

export function appendJsonPointer(pointer: string, segment: string | number): string {
  return `${pointer}/${escapeJsonPointerSegment(String(segment))}`
}

export function createActionNodeId(domain: CombatDomain, documentId: string, pointer: string): string {
  return `${domain}:${encodeURIComponent(documentId)}:#${pointer}`
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function primitiveText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
    ? String(value)
    : ''
}

function pointerDepth(pointer: string): number {
  return pointer ? pointer.split('/').length - 1 : 0
}

function rawActionType(record: RawRecord): string {
  return (
    primitiveText(record.$type) ||
    primitiveText(record.actionType) ||
    primitiveText(record.className) ||
    primitiveText(record.type)
  )
}

function isActionRecord(record: RawRecord): boolean {
  if (primitiveText(record.actionType)) return true
  const rawType = primitiveText(record.$type)
  if (!rawType) return false
  const metadataCount = ['isEnable', 'priorityLevel', 'priorityOffset', 'serverActionIndex'].filter((key) =>
    Object.hasOwn(record, key)
  ).length
  return metadataCount === 4
}

function formatActionType(rawType: string): string {
  const className = rawType.split(',')[0]?.trim().split('.').at(-1) ?? rawType
  const nested = className.split('+')
  let candidate = nested.at(-1) ?? className
  if (/^(?:Data|ActionData)$/i.test(candidate) && nested.length > 1) candidate = nested.at(-2) ?? candidate
  return candidate.replace(/ActionData$/i, '').replace(/Action$/i, '') || rawType || 'UnknownAction'
}

function inferLabel(record: RawRecord, actionType: string): string {
  return textValue(
    record.name ?? record.title ?? record.label ?? record.desc ?? record.description,
    actionType
  )
}

function classifyAction(actionType: string): ActionCategory {
  const value = actionType.toLowerCase()
  if (PERFORMANCE_ACTION.test(value)) return 'presentation'
  if (/(damage|hit|attack|critical|weakness)/.test(value)) return 'damage'
  if (/(heal|recover|restorehp|regenerate)/.test(value)) return 'recovery'
  if (/(armor|shield|defen[cs]e|invincible|resistance|guard|block)/.test(value)) return 'defense'
  if (/(cancel|interrupt|allow.*skill|combo)/.test(value)) return 'cancel'
  if (/(delay|wait|timer|duration|hitstop|timedilation|pause.*time|frame)/.test(value)) return 'timing'
  if (/(buff|debuff|aura|status)/.test(value)) return 'buff'
  if (/(spawn|createentity|projectile|summon|abilityentity)/.test(value)) return 'spawn'
  if (/(resource|energy|stamina|skillpoint|sp\b|cost)/.test(value)) return 'resource'
  if (/(stun|freeze|knock|taunt|fear|control|root)/.test(value)) return 'control'
  if (/(move|dash|rotate|teleport|displace|velocity|position)/.test(value)) return 'movement'
  if (/(target|selector|find|query|search)/.test(value)) return 'targeting'
  if (/(modifier|modifyattribute|attributechange)/.test(value)) return 'modifier'
  if (/(attach|detach|remove|destroy|finish|lifecycle)/.test(value)) return 'lifecycle'
  if (/(ifelse|condition|check|compare|switch|sequence|loop|branch|random|probability)/.test(value))
    return 'logic'
  return 'unknown'
}

function semanticRelation(field: string, evidencePath: string): BranchRelation | null {
  const normalized = field.replaceAll(/[^a-z0-9]/gi, '').toLowerCase()
  if (/(condition|predicate)/.test(normalized)) return { kind: 'condition', evidencePath }
  if (/(succeed|success|then|true)/.test(normalized) && /(action|callback|branch)/.test(normalized))
    return { kind: 'success', evidencePath }
  if (/(fail|failure|else|false)/.test(normalized) && /(action|callback|branch)/.test(normalized)) {
    return { kind: 'failure', evidencePath }
  }
  if (/(tick|periodic)/.test(normalized) && /(action|callback|branch)/.test(normalized))
    return { kind: 'tick', evidencePath }
  if (/(loop|loopbody)/.test(normalized) && /(action|callback|branch|body)/.test(normalized))
    return { kind: 'loop', evidencePath }
  if (/(end|finish)/.test(normalized) && /(action|callback|branch)/.test(normalized))
    return { kind: 'end', evidencePath }
  if (normalized === 'actioninaura' || normalized === 'actionsinaura')
    return { kind: 'aura-enter', evidencePath }
  if (normalized === 'actionwhenexitaura' || normalized === 'actionswhenexitaura')
    return { kind: 'aura-exit', evidencePath }
  if (normalized === 'options' || normalized === 'cases' || normalized === 'switchcases')
    return { kind: 'switch-case', evidencePath }
  if (normalized === 'actiononevent' || normalized === 'abilityactionmap')
    return { kind: 'event', evidencePath }
  return null
}

function directActionTime(record: RawRecord, pointer: string): ActionTime | null {
  const directFrameEntries: Array<[string, unknown]> = [
    ['frame', record.frame],
    ['frameIndex', record.frameIndex],
    ['triggerFrame', record.triggerFrame]
  ]
  for (const [field, value] of directFrameEntries) {
    const frame = finiteNumber(value)
    if (frame !== undefined) {
      return {
        confidence: 'exact-frame',
        frame,
        startFrame: frame,
        endFrame: frame,
        evidencePath: appendJsonPointer(pointer, field)
      }
    }
  }

  const startFrame = finiteNumber(record.startFrame)
  if (startFrame !== undefined) {
    const endFrame = finiteNumber(record.endFrame) ?? startFrame
    return {
      confidence: 'exact-frame',
      frame: startFrame,
      startFrame,
      endFrame,
      evidencePath: appendJsonPointer(pointer, 'startFrame')
    }
  }

  for (const field of ['triggerType', 'eventName', 'abilityEvent', 'buffEvent', 'igniteType'] as const) {
    const trigger = primitiveText(record[field])
    if (trigger)
      return { confidence: 'runtime-trigger', trigger, evidencePath: appendJsonPointer(pointer, field) }
  }
  return null
}

function describeGroup(record: RawRecord, pointer: string, field: string): GroupDescription | null {
  const startFrame = finiteNumber(record._startFrame)
  const endFrame = finiteNumber(record._endFrame)
  if (
    startFrame !== undefined ||
    endFrame !== undefined ||
    (/timeline/i.test(field) && (record._startFrame !== undefined || record._endFrame !== undefined))
  ) {
    const group = `#${pointer}`
    const openEnded = endFrame !== undefined && endFrame >= OPEN_ENDED_FRAME
    const time: ActionTime = {
      confidence: 'group-range',
      group,
      evidencePath: pointer,
      ...(startFrame !== undefined ? { startFrame } : {}),
      ...(endFrame !== undefined ? { endFrame } : {}),
      ...(openEnded ? { openEnded: true } : {})
    }
    const range =
      startFrame === undefined && endFrame === undefined
        ? 'runtime range'
        : `${startFrame ?? '?'}-${openEnded ? 'open' : (endFrame ?? '?')}`
    return { kind: 'timeline', label: `Timeline ${range}`, time, source: 'timeline' }
  }

  const eventFields = ['buffEvent', 'abilityEvent', 'igniteType', 'eventName'] as const
  for (const eventField of eventFields) {
    const trigger = primitiveText(record[eventField])
    const hasActions = Object.keys(record).some((key) => ACTION_CONTAINER_KEY.test(key))
    if (!trigger || (!hasActions && !/event/i.test(field))) continue
    return {
      kind: 'runtime',
      label: `${eventField}: ${trigger}`,
      time: { confidence: 'runtime-trigger', trigger, evidencePath: appendJsonPointer(pointer, eventField) },
      source: eventField
    }
  }
  return null
}

function referenceKind(field: string): ExternalReferenceKind | null {
  const normalized = field.replaceAll(/[^a-z0-9]/gi, '').toLowerCase()
  if (normalized.includes('abilityentity')) return 'ability-entity'
  if (normalized.includes('projectile') && /(id|ids|idlist|key|ref|path|name|prefab)$/.test(normalized))
    return 'projectile'
  if (normalized.includes('buff') && /(id|ids|idlist|key|ref)$/.test(normalized)) return 'buff'
  if (normalized.includes('skill') && /(id|ids|idlist|key|ref)$/.test(normalized)) return 'skill'
  if (normalized.includes('enemy') && /(id|ids|idlist|key|ref)$/.test(normalized)) return 'enemy'
  if (normalized.includes('spawner') && /(id|ids|idlist|key|ref)$/.test(normalized)) return 'spawner'
  if (/^(?:tags?|taglist|predefinedtags?|requiredtags?)$/.test(normalized)) return 'tag'
  return null
}

function referenceScalars(value: unknown): string[] {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    const scalar = String(value).trim()
    return scalar ? [scalar] : []
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((child) => referenceScalars(child))
}

function edgeId(
  channel: ActionEdge['channel'],
  kind: ActionEdge['kind'],
  source: string,
  target: string,
  evidencePath: string
): string {
  return `${channel}:${kind}:${source}->${target}@${encodeURIComponent(evidencePath)}`
}

function graphDocumentId(domain: CombatDomain, source: unknown, requested: string | undefined): string {
  if (requested?.trim()) return requested.trim()
  const record = asRecord(source)
  const inferred = primitiveText(record.skillId) || primitiveText(record.buffId) || primitiveText(record.id)
  return inferred || `${domain}-document`
}

export function parseActionGraph(
  domain: CombatDomain,
  source: unknown,
  options: GraphParseOptions = {}
): ActionGraph {
  const documentId = graphDocumentId(domain, source, options.documentId)
  const documentPrefix = `${domain}:${encodeURIComponent(documentId)}`
  const includePerformance = options.includePerformance ?? true
  const maxDepth = clampInteger(options.maxDepth, DEFAULT_MAX_DEPTH, 1, 256)
  const maxStructuredNodes = clampInteger(
    options.maxStructuredNodes,
    DEFAULT_MAX_STRUCTURED_NODES,
    1_000,
    2_000_000
  )
  const maxActionNodes = clampInteger(options.maxActionNodes, DEFAULT_MAX_ACTION_NODES, 100, 250_000)
  const maxExternalReferences = clampInteger(
    options.maxExternalReferences,
    DEFAULT_MAX_EXTERNAL_REFERENCES,
    100,
    250_000
  )
  const defaultNodeBudget = clampInteger(options.nodeBudget, 160, 1, 10_000)

  const nodes: MutableNode[] = []
  const nodeById = new Map<string, MutableNode>()
  const structuralEdges: ActionEdge[] = []
  const flowEdges: ActionEdge[] = []
  const referenceEdges: ActionEdge[] = []
  const roots: string[] = []
  const groups: MutableGroup[] = []
  const externalRefs: ExternalReference[] = []
  const externalRefIds = new Set<string>()
  const externalNodeByKey = new Map<string, string>()
  const flowEdgeIds = new Set<string>()
  const diagnostics: GraphDiagnostic[] = []
  const diagnosticKeys = new Set<string>()
  const unknownTypes = new Set<string>()
  const visitedObjects = new WeakMap<object, string>()
  let structuredNodeCount = 0
  let actionNodeCount = 0
  let sourceOrder = 0
  let truncated = false
  let stopped = false

  const addDiagnostic = (
    diagnostic: GraphDiagnostic,
    uniqueKey = `${diagnostic.code}:${diagnostic.path ?? ''}`
  ): void => {
    if (diagnosticKeys.has(uniqueKey)) return
    diagnosticKeys.add(uniqueKey)
    diagnostics.push(diagnostic)
  }

  const addNode = (node: MutableNode): void => {
    nodes.push(node)
    nodeById.set(node.id, node)
  }

  const addStructuralEdge = (parentId: string | null, childId: string, evidencePath: string): void => {
    if (!parentId) {
      roots.push(childId)
      return
    }
    const edge: ActionEdge = {
      id: edgeId('structural', 'structure', parentId, childId, evidencePath),
      source: parentId,
      target: childId,
      channel: 'structural',
      kind: 'structure',
      label: 'contains',
      certainty: 'explicit',
      evidencePath
    }
    structuralEdges.push(edge)
    const parent = nodeById.get(parentId)
    if (parent && !parent.childIds.includes(childId)) parent.childIds.push(childId)
  }

  const addFlowEdge = (
    sourceId: string,
    targetId: string,
    kind: FlowEdgeKind,
    evidencePath: string
  ): void => {
    const id = edgeId('flow', kind, sourceId, targetId, evidencePath)
    if (flowEdgeIds.has(id)) return
    flowEdgeIds.add(id)
    flowEdges.push({
      id,
      source: sourceId,
      target: targetId,
      channel: 'flow',
      kind,
      label: kind,
      certainty: 'explicit',
      evidencePath
    })
  }

  const ensureExternalNode = (kind: ExternalReferenceKind, rawId: string, path: string): string => {
    const key = `${kind}:${rawId}`
    const existing = externalNodeByKey.get(key)
    if (existing) return existing
    const id = `${documentPrefix}:external:${kind}:${encodeURIComponent(rawId)}`
    externalNodeByKey.set(key, id)
    addNode({
      id,
      domain,
      kind: 'external',
      actionType: `${kind}-reference`,
      rawType: '',
      category: 'external',
      label: rawId,
      path,
      parentId: null,
      childIds: [],
      time: { confidence: 'unknown' },
      depth: 0,
      sourceOrder: sourceOrder++,
      data: { kind, reference: rawId }
    })
    return id
  }

  const collectExternalReferences = (
    record: RawRecord,
    sourceNodeId: string,
    actionPointer: string
  ): void => {
    const seen = new WeakSet<object>()
    const walk = (value: unknown, pointer: string, depth: number): void => {
      if (externalRefs.length >= maxExternalReferences) {
        truncated = true
        addDiagnostic(
          {
            code: 'EXTERNAL_REFERENCE_LIMIT',
            severity: 'warning',
            message: `External-reference extraction stopped at ${maxExternalReferences} references.`,
            path: pointer,
            details: { limit: maxExternalReferences }
          },
          'EXTERNAL_REFERENCE_LIMIT'
        )
        return
      }
      if (depth > 16 || value === null || value === undefined) return
      if (typeof value === 'object') {
        if (seen.has(value)) return
        seen.add(value)
      }
      if (Array.isArray(value)) {
        value.forEach((child, index) => walk(child, appendJsonPointer(pointer, index), depth + 1))
        return
      }
      if (typeof value !== 'object') return
      const childRecord = value as RawRecord
      if (depth > 0 && isActionRecord(childRecord)) return

      for (const [field, child] of Object.entries(childRecord)) {
        const childPointer = appendJsonPointer(pointer, field)
        const kind = referenceKind(field)
        if (kind) {
          const dynamic = /blackboardkey$/i.test(field.replaceAll(/[^a-z0-9]/gi, ''))
          for (const rawId of referenceScalars(child)) {
            const targetNodeId = ensureExternalNode(kind, rawId, childPointer)
            const refId = `${sourceNodeId}:ref:${encodeURIComponent(childPointer)}:${encodeURIComponent(rawId)}`
            if (externalRefIds.has(refId)) continue
            externalRefIds.add(refId)
            const reference: ExternalReference = {
              id: refId,
              sourceNodeId,
              targetNodeId,
              kind,
              rawId,
              field,
              path: childPointer,
              status: dynamic ? 'dynamic' : 'unresolved',
              ...(dynamic ? { dynamicKey: rawId } : {})
            }
            externalRefs.push(reference)
            referenceEdges.push({
              id: edgeId('reference', 'external', sourceNodeId, targetNodeId, childPointer),
              source: sourceNodeId,
              target: targetNodeId,
              channel: 'reference',
              kind: 'external',
              label: kind,
              certainty: 'explicit',
              evidencePath: childPointer
            })
          }
        }
        if (child && typeof child === 'object') walk(child, childPointer, depth + 1)
      }
    }
    walk(record, actionPointer, 0)
  }

  const visit = (
    value: unknown,
    pointer: string,
    field: string,
    depth: number,
    context: TraversalContext
  ): void => {
    if (stopped || value === null || typeof value !== 'object') return
    if (depth > maxDepth) {
      truncated = true
      addDiagnostic(
        {
          code: 'ACTION_DEPTH_LIMIT',
          severity: 'warning',
          message: `Action traversal stopped at depth ${maxDepth}.`,
          path: pointer,
          details: { limit: maxDepth }
        },
        'ACTION_DEPTH_LIMIT'
      )
      return
    }

    const previousPointer = visitedObjects.get(value)
    if (previousPointer !== undefined) {
      addDiagnostic({
        code: 'REPEATED_OBJECT_REFERENCE',
        severity: 'info',
        message: 'A repeated object reference was skipped to keep JSON Pointer ownership unambiguous.',
        path: pointer,
        details: { firstPath: previousPointer }
      })
      return
    }
    visitedObjects.set(value, pointer)
    structuredNodeCount += 1
    if (structuredNodeCount > maxStructuredNodes) {
      stopped = true
      truncated = true
      addDiagnostic(
        {
          code: 'STRUCTURED_NODE_LIMIT',
          severity: 'warning',
          message: `Action traversal stopped after ${maxStructuredNodes} structured nodes.`,
          path: pointer,
          details: { limit: maxStructuredNodes }
        },
        'STRUCTURED_NODE_LIMIT'
      )
      return
    }

    if (Array.isArray(value)) {
      value.forEach((child, index) =>
        visit(child, appendJsonPointer(pointer, index), String(index), depth + 1, context)
      )
      return
    }

    const record = value as RawRecord
    const recordIsAction = isActionRecord(record)
    const groupDescription = recordIsAction ? null : describeGroup(record, pointer, field)
    let currentContext = context
    let currentNode: MutableNode | null = null
    let currentActionType = ''

    if (groupDescription) {
      const groupId = `${documentPrefix}:group:#${pointer}`
      const group: MutableGroup = {
        id: groupId,
        kind: groupDescription.kind,
        label: groupDescription.label,
        confidence: groupDescription.time.confidence,
        time: groupDescription.time,
        nodeIds: [],
        path: pointer,
        ...(groupDescription.time.confidence === 'exact-frame' ? { frame: groupDescription.time.frame } : {}),
        ...(groupDescription.time.confidence === 'group-range' &&
        groupDescription.time.startFrame !== undefined
          ? { startFrame: groupDescription.time.startFrame }
          : {}),
        ...(groupDescription.time.confidence === 'group-range' && groupDescription.time.endFrame !== undefined
          ? { endFrame: groupDescription.time.endFrame }
          : {}),
        ...(groupDescription.time.confidence === 'runtime-trigger'
          ? { trigger: groupDescription.time.trigger }
          : {})
      }
      groups.push(group)
      currentNode = {
        id: groupId,
        domain,
        kind: 'group',
        actionType: groupDescription.kind === 'timeline' ? 'TimelineGroup' : 'RuntimeEventGroup',
        rawType: '',
        category: 'logic',
        label: groupDescription.label,
        path: pointer,
        parentId: context.parentNodeId,
        childIds: [],
        time: groupDescription.time,
        depth: pointerDepth(pointer),
        sourceOrder: sourceOrder++,
        data: record,
        source: groupDescription.source
      }
      addNode(currentNode)
      addStructuralEdge(context.parentNodeId, groupId, pointer)
      currentContext = {
        ...context,
        parentNodeId: groupId,
        time: groupDescription.time,
        groups: [...context.groups, group],
        source: groupDescription.source
      }
      if (groupDescription.time.confidence === 'group-range') {
        const { startFrame, endFrame } = groupDescription.time
        if (
          startFrame !== undefined &&
          endFrame !== undefined &&
          !groupDescription.time.openEnded &&
          endFrame < startFrame
        ) {
          addDiagnostic({
            code: 'REVERSED_TIME_RANGE',
            severity: 'warning',
            message: 'Timeline group end frame is earlier than its start frame.',
            path: pointer,
            nodeId: groupId,
            details: { startFrame, endFrame }
          })
        }
      }
    }

    if (recordIsAction) {
      if (actionNodeCount >= maxActionNodes) {
        stopped = true
        truncated = true
        addDiagnostic(
          {
            code: 'ACTION_NODE_LIMIT',
            severity: 'warning',
            message: `Action traversal stopped after ${maxActionNodes} Action nodes.`,
            path: pointer,
            details: { limit: maxActionNodes }
          },
          'ACTION_NODE_LIMIT'
        )
        return
      }

      const rawType = rawActionType(record)
      currentActionType = formatActionType(rawType)
      const category = classifyAction(currentActionType)
      const excluded = !includePerformance && category === 'presentation'
      if (excluded) {
        if (context.sequence) context.sequence.lastNodeId = null
        addDiagnostic(
          {
            code: 'PRESENTATION_ACTIONS_FILTERED',
            severity: 'info',
            message:
              'Presentation actions were omitted by parse options; their descendants remain discoverable.',
            path: pointer
          },
          'PRESENTATION_ACTIONS_FILTERED'
        )
        currentContext = { ...context, relation: null }
      } else {
        actionNodeCount += 1
        const id = createActionNodeId(domain, documentId, pointer)
        const ownTime = directActionTime(record, pointer)
        const time: ActionTime = ownTime ?? context.time ?? { confidence: 'unknown' }
        const nearestGroup = context.groups.at(-1)
        currentNode = {
          id,
          domain,
          kind: 'action',
          actionType: currentActionType,
          rawType,
          category,
          label: inferLabel(record, currentActionType),
          path: pointer,
          parentId: context.parentNodeId,
          childIds: [],
          time,
          depth: pointerDepth(pointer),
          sourceOrder: sourceOrder++,
          data: record,
          ...(typeof record.isEnable === 'boolean' ? { enabled: record.isEnable } : {}),
          ...(typeof record.serverActionIndex === 'string' || typeof record.serverActionIndex === 'number'
            ? { serverActionIndex: record.serverActionIndex }
            : {}),
          ...(nearestGroup ? { groupId: nearestGroup.id } : {}),
          ...(context.source ? { source: context.source } : {})
        }
        addNode(currentNode)
        addStructuralEdge(context.parentNodeId, id, pointer)
        context.groups.forEach((group) => group.nodeIds.push(id))

        if (context.parentActionId && context.relation) {
          addFlowEdge(context.parentActionId, id, context.relation.kind, context.relation.evidencePath)
        }
        if (context.sequence && context.sequence.anchorActionId === context.parentActionId) {
          if (context.sequence.lastNodeId)
            addFlowEdge(context.sequence.lastNodeId, id, 'sequence', context.sequence.evidencePath)
          context.sequence.lastNodeId = id
        }
        if (time.confidence === 'exact-frame' && time.endFrame < time.startFrame) {
          addDiagnostic({
            code: 'REVERSED_EXACT_TIME',
            severity: 'warning',
            message: 'Action end frame is earlier than its start frame.',
            path: pointer,
            nodeId: id,
            details: { startFrame: time.startFrame, endFrame: time.endFrame }
          })
        }
        if (category === 'unknown') {
          unknownTypes.add(rawType || currentActionType)
          addDiagnostic(
            {
              code: 'UNKNOWN_ACTION_TYPE',
              severity: 'info',
              message: `Unknown Action type was retained as raw data: ${rawType || currentActionType}.`,
              path: pointer,
              nodeId: id,
              details: { rawType: rawType || currentActionType }
            },
            `UNKNOWN_ACTION_TYPE:${rawType || currentActionType}`
          )
        }
        collectExternalReferences(record, id, pointer)
        currentContext = {
          ...context,
          parentNodeId: id,
          parentActionId: id,
          relation: null
        }
      }
    }

    for (const [childField, child] of Object.entries(record)) {
      if (!child || typeof child !== 'object') continue
      const childPointer = appendJsonPointer(pointer, childField)
      const branch = semanticRelation(childField, childPointer)
      const actionDeclaresSequence = Boolean(
        currentNode?.kind === 'action' &&
        /sequence/i.test(currentActionType) &&
        ACTION_CONTAINER_KEY.test(childField)
      )
      const sequence =
        EXPLICIT_SEQUENCE_KEY.test(childField) || actionDeclaresSequence
          ? { anchorActionId: currentContext.parentActionId, evidencePath: childPointer, lastNodeId: null }
          : currentContext.sequence
      visit(child, childPointer, childField, depth + 1, {
        ...currentContext,
        relation: branch ?? currentContext.relation,
        sequence
      })
    }
  }

  visit(source, '', 'root', 0, {
    parentNodeId: null,
    parentActionId: null,
    relation: null,
    time: null,
    groups: [],
    sequence: null,
    source: 'config'
  })

  if (!actionNodeCount) {
    addDiagnostic(
      {
        code: 'NO_ACTION_NODES',
        severity: 'info',
        message: 'No Action records were found in the supplied document.'
      },
      'NO_ACTION_NODES'
    )
  }
  addDiagnostic(
    {
      code: 'ORDER_REQUIRES_EVIDENCE',
      severity: 'info',
      message:
        'Traversal and ordinary array order are structural only; sequence edges require an explicit sequence container.'
    },
    'ORDER_REQUIRES_EVIDENCE'
  )

  const assignedToExplicitGroup = new Set(groups.flatMap((group) => group.nodeIds))
  const derivedGroups = new Map<string, MutableGroup>()
  for (const node of nodes) {
    if (node.kind !== 'action' || assignedToExplicitGroup.has(node.id)) continue
    let key = 'unknown'
    let label = 'Unknown time'
    if (node.time.confidence === 'exact-frame') {
      key = `frame:${node.time.startFrame}:${node.time.endFrame}`
      label =
        node.time.startFrame === node.time.endFrame
          ? `Frame ${node.time.frame}`
          : `Frames ${node.time.startFrame}-${node.time.endFrame}`
    } else if (node.time.confidence === 'runtime-trigger') {
      key = `trigger:${node.time.trigger}`
      label = node.time.trigger
    }
    const existing = derivedGroups.get(key)
    if (existing) {
      existing.nodeIds.push(node.id)
      continue
    }
    const id = `${documentPrefix}:time:${encodeURIComponent(key)}`
    const group: MutableGroup = {
      id,
      kind: 'derived',
      label,
      confidence: node.time.confidence,
      time: node.time,
      nodeIds: [node.id],
      path: node.time.confidence === 'unknown' ? '' : node.time.evidencePath,
      ...(node.time.confidence === 'exact-frame'
        ? { frame: node.time.frame, startFrame: node.time.startFrame, endFrame: node.time.endFrame }
        : {}),
      ...(node.time.confidence === 'runtime-trigger' ? { trigger: node.time.trigger } : {})
    }
    derivedGroups.set(key, group)
  }

  const timeline = [...groups, ...derivedGroups.values()].toSorted((left, right) => {
    const leftFrame = left.startFrame ?? left.frame ?? Number.MAX_SAFE_INTEGER
    const rightFrame = right.startFrame ?? right.frame ?? Number.MAX_SAFE_INTEGER
    return leftFrame - rightFrame || left.id.localeCompare(right.id, 'en')
  })
  const warnings = diagnostics
    .filter((diagnostic) => diagnostic.severity !== 'info')
    .map((diagnostic) => diagnostic.message)
  const allEdges = [...structuralEdges, ...flowEdges, ...referenceEdges]

  return {
    domain,
    documentId,
    nodes,
    edges: allEdges,
    structuralEdges,
    flowEdges,
    referenceEdges,
    roots: [...new Set(roots)],
    timeline,
    externalRefs,
    diagnostics,
    warnings,
    stats: {
      structuredNodeCount,
      actionNodeCount,
      groupNodeCount: groups.length,
      externalNodeCount: externalNodeByKey.size,
      unknownActionTypeCount: unknownTypes.size
    },
    defaultNodeBudget,
    truncated
  }
}

export function parseSkillActionGraph(source: unknown, options?: GraphParseOptions): ActionGraph {
  return parseActionGraph('skill', source, options)
}

export function parseBuffActionGraph(source: unknown, options?: GraphParseOptions): ActionGraph {
  return parseActionGraph('buff', source, options)
}
