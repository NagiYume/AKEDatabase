import { describe, expect, it } from 'vitest'

import {
  createElkGraph,
  createLinearTreeProjection,
  parseBuffActionGraph,
  parseSkillActionGraph,
  resolveTreeKeyboardTarget,
  selectSubtree
} from '../src/index'

function action(type: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $type: `Beyond.Gameplay.Core.${type}Action+${type}ActionData, Gameplay.Beyond`,
    isEnable: true,
    priorityLevel: 'Default',
    priorityOffset: 0,
    serverActionIndex: 0,
    ...fields
  }
}

describe('combat action parsing', () => {
  it('keeps structural containment separate and carries branch meaning through transparent wrappers', () => {
    const source = {
      skillId: 'skill_branching',
      actions: [
        action('IfElse', {
          conditionAction: { actionData: [action('CheckTarget')] },
          succeedActions: { actionData: [action('Damage')] },
          failActions: { actionData: [action('CreateBuff')] },
          tickActions: { actionData: [action('Wait')] },
          loopActions: { actionData: [action('Move')] },
          endActions: { actionData: [action('Destroy')] }
        })
      ]
    }

    const graph = parseSkillActionGraph(source)
    const outer = graph.nodes.find((node) => node.actionType === 'IfElse')
    expect(outer).toBeDefined()
    expect(graph.structuralEdges.every((edge) => edge.kind === 'structure')).toBe(true)
    expect(graph.flowEdges.map((edge) => edge.kind)).toEqual(
      expect.arrayContaining(['condition', 'success', 'failure', 'tick', 'loop', 'end'])
    )
    expect(graph.flowEdges.every((edge) => edge.source === outer?.id)).toBe(true)
    expect(graph.flowEdges.some((edge) => edge.kind === 'sequence')).toBe(false)
    expect(graph.nodes.some((node) => node.id.includes('#/actions/0/conditionAction/actionData/0'))).toBe(
      true
    )
  })

  it('creates sequence only from explicit sequence evidence', () => {
    const source = {
      skillId: 'skill_sequence',
      ordinaryActions: [action('Damage'), action('CreateBuff')],
      _sequenceActionData: { actionData: [action('Move'), action('Wait'), action('Destroy')] }
    }

    const graph = parseSkillActionGraph(source)
    const sequenceEdges = graph.flowEdges.filter((edge) => edge.kind === 'sequence')
    expect(sequenceEdges).toHaveLength(2)
    expect(sequenceEdges.every((edge) => edge.evidencePath === '/_sequenceActionData')).toBe(true)
    expect(sequenceEdges.some((edge) => edge.source.includes('/ordinaryActions/'))).toBe(false)
  })

  it('distinguishes group ranges, runtime triggers and exact action frames', () => {
    const graph = parseBuffActionGraph({
      buffId: 'buff_timing',
      timelineActions: [
        {
          _startFrame: 10,
          _endFrame: 20,
          _sequenceActionData: { actionData: [action('Move'), action('Damage', { frame: 15 })] }
        }
      ],
      abilityEventAction: [{ abilityEvent: 'OnHit', actions: [{ actionData: [action('CreateBuff')] }] }]
    })

    expect(graph.nodes.find((node) => node.actionType === 'Move')?.time.confidence).toBe('group-range')
    expect(graph.nodes.find((node) => node.actionType === 'Damage')?.time.confidence).toBe('exact-frame')
    expect(graph.nodes.find((node) => node.actionType === 'CreateBuff')?.time).toMatchObject({
      confidence: 'runtime-trigger',
      trigger: 'OnHit'
    })
  })

  it('retains unknown actions, direct and dynamic external references, and diagnostics', () => {
    const graph = parseSkillActionGraph({
      skillId: 'skill_refs',
      actions: [action('UnmappedThing', { buffId: 'buff_literal', skillIdBlackboardKey: 'next_skill_key' })]
    })

    const unknown = graph.nodes.find((node) => node.kind === 'action')
    expect(unknown?.category).toBe('unknown')
    expect(unknown?.data.buffId).toBe('buff_literal')
    expect(graph.externalRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'buff', rawId: 'buff_literal', status: 'unresolved' }),
        expect.objectContaining({ kind: 'skill', rawId: 'next_skill_key', status: 'dynamic' })
      ])
    )
    expect(graph.diagnostics.some((diagnostic) => diagnostic.code === 'UNKNOWN_ACTION_TYPE')).toBe(true)
  })
})

describe('combat graph projections', () => {
  const source = {
    skillId: 'skill_projection',
    timelineActions: [
      {
        _startFrame: 0,
        _endFrame: 30,
        _sequenceActionData: {
          actionData: [action('Move'), action('Damage'), action('CreateBuff'), action('Wait')]
        }
      }
    ]
  }

  it('keeps the full parse and applies a progressive visible-node budget in selectSubtree', () => {
    const graph = parseSkillActionGraph(source, { nodeBudget: 3 })
    const rootId = graph.roots[0]
    expect(rootId).toBeDefined()
    expect(graph.nodes.length).toBeGreaterThan(3)

    const compact = selectSubtree(graph, rootId!, 3)
    expect(compact.nodes.length).toBeLessThanOrEqual(3)
    expect(compact.nodes.some((node) => node.kind === 'summary')).toBe(true)
    expect(compact.projection?.omittedCount).toBeGreaterThan(0)

    const expanded = selectSubtree(graph, rootId!, compact.projection?.nextBudget ?? 8)
    expect(expanded.nodes.length).toBeGreaterThan(compact.nodes.length)
  })

  it('provides an ARIA-friendly linear tree and deterministic keyboard targets', () => {
    const graph = parseSkillActionGraph(source)
    const rootId = graph.roots[0]!
    const tree = createLinearTreeProjection(graph, { expandedIds: new Set([rootId]) })
    expect(tree[0]).toMatchObject({ id: rootId, depth: 0, positionInSet: 1, expanded: true })
    const child = tree.find((item) => item.parentId === rootId)
    expect(resolveTreeKeyboardTarget(tree, rootId, 'ArrowRight').focusId).toBe(child?.id)
    expect(resolveTreeKeyboardTarget(tree, child?.id ?? null, 'ArrowLeft').focusId).toBe(rootId)
  })

  it('creates ELK input from the already budgeted projection', () => {
    const graph = parseSkillActionGraph(source)
    const rootId = graph.roots[0]!
    const projection = selectSubtree(graph, rootId, 4)
    const elk = createElkGraph(projection, 'DOWN')
    expect(elk.children).toHaveLength(projection.nodes.length)
    expect(
      elk.edges.every(
        (edge) =>
          edge.akeChannel === 'structural' || edge.akeChannel === 'flow' || edge.akeChannel === 'reference'
      )
    ).toBe(true)
    expect(elk.layoutOptions['elk.direction']).toBe('DOWN')
  })
})
