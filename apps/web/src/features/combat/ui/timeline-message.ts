import type { TimelineGroup } from '@ake/combat-graph'

export interface TimelineMessage {
  key: string
  values?: Readonly<Record<string, string | number>>
}

export function timelineGroupMessage(group: Pick<TimelineGroup, 'kind' | 'time'>): TimelineMessage {
  const time = group.time

  if (group.kind === 'runtime' || time.confidence === 'runtime-trigger') {
    return time.confidence === 'runtime-trigger'
      ? { key: 'combatPage.timelineLabel.runtimeTrigger', values: { trigger: time.trigger } }
      : { key: 'combatPage.timelineLabel.runtimeEvent' }
  }

  if (time.confidence === 'exact-frame') {
    return time.startFrame === time.endFrame
      ? { key: 'combatPage.timelineLabel.frame', values: { frame: time.frame } }
      : {
          key: 'combatPage.timelineLabel.frameRange',
          values: { start: time.startFrame, end: time.endFrame }
        }
  }

  if (time.confidence === 'group-range') {
    if (time.openEnded && time.startFrame !== undefined) {
      return { key: 'combatPage.timelineLabel.startingFrame', values: { start: time.startFrame } }
    }
    if (time.startFrame !== undefined && time.endFrame !== undefined) {
      return {
        key: 'combatPage.timelineLabel.frameRange',
        values: { start: time.startFrame, end: time.endFrame }
      }
    }
    if (time.startFrame !== undefined) {
      return { key: 'combatPage.timelineLabel.startingFrame', values: { start: time.startFrame } }
    }
    if (time.endFrame !== undefined && !time.openEnded) {
      return { key: 'combatPage.timelineLabel.throughFrame', values: { end: time.endFrame } }
    }
    return { key: 'combatPage.timelineLabel.timeRange' }
  }

  return { key: 'combatPage.timelineLabel.unknown' }
}
