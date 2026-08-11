import { describe, expect, it } from 'vitest'
import type { TimelineGroup } from '@ake/combat-graph'
import { timelineGroupMessage } from './timeline-message'

describe('combat timeline presentation', () => {
  it('derives exact and ranged labels from structured frame data', () => {
    expect(
      timelineGroupMessage({
        kind: 'derived',
        time: { confidence: 'exact-frame', frame: 12, startFrame: 12, endFrame: 12, evidencePath: '/frame' }
      })
    ).toEqual({ key: 'combatPage.timelineLabel.frame', values: { frame: 12 } })

    expect(
      timelineGroupMessage({
        kind: 'timeline',
        time: {
          confidence: 'group-range',
          group: '#/timeline',
          startFrame: 4,
          endFrame: 18,
          evidencePath: '/timeline'
        }
      })
    ).toEqual({ key: 'combatPage.timelineLabel.frameRange', values: { start: 4, end: 18 } })
  })

  it('uses runtime trigger data without exposing the parser model label', () => {
    const group = {
      id: 'runtime',
      kind: 'runtime',
      label: 'eventName: OnHit',
      confidence: 'runtime-trigger',
      time: { confidence: 'runtime-trigger', trigger: 'OnHit', evidencePath: '/eventName' },
      nodeIds: [],
      path: '/eventName'
    } satisfies TimelineGroup

    expect(timelineGroupMessage(group)).toEqual({
      key: 'combatPage.timelineLabel.runtimeTrigger',
      values: { trigger: 'OnHit' }
    })
    expect(JSON.stringify(timelineGroupMessage(group))).not.toContain(group.label)
  })

  it('uses a localized unknown-time key for derived groups without timing evidence', () => {
    expect(timelineGroupMessage({ kind: 'derived', time: { confidence: 'unknown' } })).toEqual({
      key: 'combatPage.timelineLabel.unknown'
    })
  })
})
