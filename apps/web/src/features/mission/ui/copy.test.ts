import { describe, expect, it } from 'vitest'
import { MISSION_CHAPTERS, MISSION_IMPORTANCE, MISSION_QUEST_TYPES, MISSION_TYPES } from '../model'
import {
  missionChapterCopyKey,
  missionFallback,
  missionImportanceCopyKey,
  missionQuestTypeCopyKey,
  missionTypeCopyKey
} from './copy'

describe('mission copy', () => {
  it('provides Chinese and English labels for every declared enum value', () => {
    const families = [
      [Object.keys(MISSION_TYPES), missionTypeCopyKey],
      [Object.keys(MISSION_CHAPTERS), missionChapterCopyKey],
      [Object.keys(MISSION_IMPORTANCE), missionImportanceCopyKey],
      [Object.keys(MISSION_QUEST_TYPES), missionQuestTypeCopyKey]
    ] as const

    for (const [values, keyFor] of families) {
      for (const value of values) {
        const key = keyFor(value)
        expect(key.endsWith('.unknown')).toBe(false)
        expect(missionFallback(key, 'CH')).toBeTruthy()
        expect(missionFallback(key, 'EN')).toBeTruthy()
      }
    }
  })

  it('falls back to English for locales without module copy and interpolates parameters', () => {
    expect(missionFallback(missionTypeCopyKey('Main'), 'JP')).toBe('Main story')
    expect(missionFallback(missionTypeCopyKey('missing'), 'CH')).toBe('其他任务类型')
    expect(missionFallback('modules.mission.counts.steps', 'EN', { count: 4 })).toBe('4 steps')
  })
})
