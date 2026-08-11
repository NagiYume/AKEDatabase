import { describe, expect, it } from 'vitest'
import { filterMissions, resolveMissionEntry, type MissionIndexEntry } from './index'

function entry(overrides: Partial<MissionIndexEntry> = {}): MissionIndexEntry {
  return {
    id: 'mission-target',
    name: 'Target mission',
    contentFile: '/mission-target.json',
    type: 'Main',
    typeValue: 0,
    chapter: 'None',
    chapterValue: 0,
    importance: 'High',
    importanceValue: 1,
    questCount: 1,
    objectiveCount: 1,
    priority: 1,
    hidden: false,
    searchText: 'mission-target\ntarget mission\nmain\nnone\nhigh',
    ...overrides
  }
}

describe('mission entity resolution', () => {
  it('restores an accessible entity even when display filters exclude it', () => {
    const target = entry()
    const other = entry({
      id: 'mission-other',
      name: 'Other mission',
      type: 'Side',
      typeValue: 10,
      chapter: 'ChapterTwo',
      chapterValue: 2,
      searchText: 'mission-other\nother mission\nside\nchaptertwo'
    })
    const entries = [target, other]

    expect(
      filterMissions(entries, {
        search: 'other',
        type: 'Side',
        chapter: 'ChapterTwo'
      }).map((value) => value.id)
    ).toEqual(['mission-other'])
    expect(resolveMissionEntry(entries, target.id)).toBe(target)
  })

  it('keeps hidden missions inaccessible until hidden content is enabled', () => {
    const hidden = entry({ id: 'mission-hidden', hidden: true })

    expect(resolveMissionEntry([hidden], hidden.id)).toBeNull()
    expect(resolveMissionEntry([hidden], hidden.id, true)).toBe(hidden)
  })
})
