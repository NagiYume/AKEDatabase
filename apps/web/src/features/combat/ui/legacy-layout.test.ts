import { describe, expect, it } from 'vitest'
import type { CombatManifestEntry } from '../api/repository'
import {
  buildBuffEffects,
  buildCombatDirectory,
  buildSkillMetrics,
  filterCombatDirectory,
  findDirectoryOwner
} from './legacy-layout'

function entry(id: string, priority: number): CombatManifestEntry {
  return {
    id,
    name: id,
    contentFile: `/public/Json/SkillData/${id}.json`,
    hidden: false,
    priority,
    category: 'other',
    searchText: id.toLocaleLowerCase()
  }
}

const tables = {
  characters: {
    chr_001_amiya: { name: 'Amiya', rarity: 6 }
  },
  growth: {
    chr_001_amiya: {
      engName: 'Amiya',
      skillGroupMap: {
        normal: {
          skillGroupId: 'normal',
          name: 'Normal attack',
          skillGroupType: 0,
          skillIdList: ['chr_1_amiya_attack']
        },
        active: {
          skillGroupId: 'active',
          name: 'Active skill',
          skillGroupType: 1,
          skillIdList: ['chr_1_amiya_skill']
        }
      }
    }
  },
  enemies: {
    enemy_wolf: { templateId: 'enemy_wolf_normal' }
  },
  enemyDisplay: {
    enemy_wolf_normal: { name: 'Wolf', nickname: 'Pack hunter' }
  }
} as const

describe('legacy combat directory model', () => {
  it('groups skills by character skill group, enemy owner, and fallback category', () => {
    const sections = buildCombatDirectory(
      [
        entry('chr_1_amiya_attack_a', 2),
        entry('chr_1_amiya_skill_b', 1),
        entry('enemy_wolf_bite', 3),
        entry('system_action', 4)
      ],
      'skill',
      tables
    )

    expect(sections.map((section) => section.id)).toEqual(['characters', 'monsters', 'other'])
    expect(sections[0]?.owners[0]).toMatchObject({
      id: 'chr_001_amiya',
      name: 'Amiya',
      kind: 'character'
    })
    expect(sections[0]?.owners[0]?.groups.map((group) => group.id)).toEqual(['normal', 'active'])
    expect(sections[1]?.owners[0]).toMatchObject({
      id: 'enemy_wolf_normal',
      name: 'Wolf',
      kind: 'enemy'
    })
    expect(findDirectoryOwner(sections, 'chr_1_amiya_skill_b')?.group.id).toBe('active')
  })

  it('keeps owner matches expanded by search and preserves their nested items', () => {
    const sections = buildCombatDirectory(
      [entry('chr_1_amiya_attack_a', 1), entry('chr_1_amiya_skill_b', 2)],
      'skill',
      tables
    )
    const result = filterCombatDirectory(sections, 'Amiya')

    expect(result).toHaveLength(1)
    expect(result[0]?.itemCount).toBe(2)
    expect(result[0]?.owners[0]?.groups.flatMap((group) => group.items)).toHaveLength(2)
  })

  it('does not invent detail values when raw configuration is empty', () => {
    expect(buildSkillMetrics({}, undefined, undefined)).toEqual([])
    expect(buildBuffEffects({})).toEqual([])
  })
})
