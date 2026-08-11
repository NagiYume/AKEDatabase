import { describe, expect, it } from 'vitest'
import type { CombatManifestEntry } from '../api/repository'
import { resolveCombatEntrySelection, type CombatRouteId } from './selection'

function entry(id: string, hidden = false): CombatManifestEntry {
  return {
    id,
    name: id,
    contentFile: `/public/Json/SkillData/${id}.json`,
    hidden,
    priority: 1,
    category: 'other',
    searchText: id
  }
}

function verifySelectionPolicy(firstId: string, secondId: string): void {
  const manifest = [entry('hidden_first', true), entry(firstId), entry(secondId)]
  const baseQuery = Object.freeze<Record<string, CombatRouteId>>({})
  const base = resolveCombatEntrySelection(baseQuery.id, manifest, false)

  expect(base).toMatchObject({ explicit: false, selectedId: firstId })
  expect(base.selectedEntry?.id).toBe(firstId)
  expect(baseQuery).not.toHaveProperty('id')

  const invalid = resolveCombatEntrySelection('missing_entry', manifest, false)
  expect(invalid).toMatchObject({ explicit: true, selectedId: 'missing_entry' })
  expect(invalid.selectedEntry).toBeUndefined()

  const hidden = resolveCombatEntrySelection('hidden_first', manifest, false)
  expect(hidden).toMatchObject({ explicit: true, selectedId: 'hidden_first' })
  expect(hidden.selectedEntry).toBeUndefined()
  expect(hidden.accessibleEntries.map((item) => item.id)).toEqual([firstId, secondId])
}

describe('Skill entry selection', () => {
  it('shows the first accessible detail on the base URL without adding id and never falls back from explicit ids', () => {
    verifySelectionPolicy('chr_skill_first', 'chr_skill_second')
  })
})

describe('Buff entry selection', () => {
  it('shows the first accessible detail on the base URL without adding id and never falls back from explicit ids', () => {
    verifySelectionPolicy('buff_first', 'buff_second')
  })
})
