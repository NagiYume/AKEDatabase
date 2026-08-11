import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type {
  AchievementDetailModel,
  CharacterDetailModel,
  EnemyDetailModel,
  EquipDetailModel,
  ItemDetailModel,
  WeaponDetailModel
} from '@ake/domain'
import AchievementCatalogDetail from './AchievementCatalogDetail.vue'
import CharacterCatalogDetail from './CharacterCatalogDetail.vue'
import EnemyCatalogDetail from './EnemyCatalogDetail.vue'
import EquipCatalogDetail from './EquipCatalogDetail.vue'
import ItemCatalogDetail from './ItemCatalogDetail.vue'
import WeaponCatalogDetail from './WeaponCatalogDetail.vue'

const resolveImageUrl = (path: string) => path

function sectionOrder(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll('[data-layout-section]')
    .flatMap((section) => section.attributes('data-layout-section') ?? [])
}

const character: CharacterDetailModel = {
  kind: 'character',
  id: 'char_a',
  name: 'Alpha',
  rarity: 6,
  icon: '/icon.png',
  portrait: '/portrait.png',
  tags: ['Guard'],
  meta: [{ id: 'profession', label: '', value: 'Guard' }],
  profile: 'Profile',
  feature: 'Feature',
  growth: {
    columns: [{ id: 'attack', label: 'Attack', value: 2 }],
    rows: [{ level: 1, values: { attack: 20 } }]
  },
  talents: [{ id: 'talent', name: 'Talent', description: 'Effect', costs: [] }],
  potentials: [{ id: 'potential', name: 'Potential', description: 'Effect', costs: [] }],
  attributeNodes: [
    {
      id: 'node',
      name: 'Node',
      description: 'Effect',
      costs: [],
      modifiers: [{ id: 'attack', label: 'Attack', value: 5 }]
    }
  ],
  skills: [
    {
      id: 'skill',
      groupType: 0,
      name: 'Skill',
      icon: '/skill.png',
      description: 'Effect',
      conditions: [],
      levels: [{ level: 1, description: 'Level', cooldown: 1, cost: 2, parameters: [], subDescriptions: [] }],
      costs: []
    }
  ],
  logistics: [
    {
      id: 'logistics',
      name: 'Logistics',
      room: 'Control',
      icon: '/logistics.png',
      levels: [{ name: 'Efficiency', postfix: 'I', description: 'Effect', unlockHint: 'Default' }]
    }
  ],
  potentialImages: ['/potential.png'],
  profileRecords: [{ title: 'Record', description: 'History' }],
  voiceRecords: [{ title: 'Greeting', description: 'Hello' }]
}

const weapon: WeaponDetailModel = {
  kind: 'weapon',
  id: 'weapon_a',
  name: 'Blade',
  rarity: 6,
  icon: '/icon.png',
  illustration: '/illustration.png',
  description: 'Description',
  decorativeDescription: 'Decoration',
  attackRows: [{ level: 1, attack: 40 }],
  skills: [{ id: 'skill', name: 'Skill', levels: [{ level: 1, description: 'Effect', parameters: [] }] }],
  breakthroughs: [{ level: 1, gold: 100, materials: [], skillBounds: [] }],
  potentials: [{ level: 1, skillBounds: [{ skill: 1, upper: 2 }] }],
  story: 'Story'
}

const enemy: EnemyDetailModel = {
  kind: 'enemy',
  id: 'enemy_a',
  name: 'Enemy',
  rarity: 6,
  icon: '/icon.png',
  portrait: '/portrait.png',
  tags: ['Boss'],
  meta: [{ id: 'maxResilience', label: '', value: 80 }],
  description: 'Description',
  abilities: ['Ability'],
  poiseBreakBuffs: ['poise_buff'],
  variants: [
    {
      id: 'enemy_a',
      templateId: 'attr_a',
      isBase: true,
      modifiers: [],
      buffs: [],
      flags: [],
      differences: [],
      rows: [{ level: 1, hp: 100, attack: 20, defense: 10 }]
    }
  ]
}

const equip: EquipDetailModel = {
  kind: 'equip',
  id: 'suit_a',
  name: 'Set',
  rarity: 5,
  icon: '/set.png',
  packs: ['Pack'],
  skills: [{ id: 'skill', name: 'Skill', description: 'Effect', parameters: [] }],
  pieces: [
    {
      id: 'equip_a',
      name: 'Armor',
      added: true,
      rarity: 5,
      icon: '/armor.png',
      partType: 0,
      minimumLevel: 1,
      domainId: 'domain_1',
      domainLabel: 'Domain',
      description: 'Detail',
      mainStat: { id: 'main', label: 'Defense', modifierLabel: '', value: 10, enhancedValues: [] },
      subStats: [],
      crafting: [
        {
          id: 'craft_a',
          level: 'T1',
          isDefault: true,
          items: [{ id: 'mat_a', name: 'Alloy', icon: '/alloy.png', count: 2 }]
        }
      ],
      guarantees: [{ label: 'Defense', values: [2, 4, 6] }]
    }
  ],
  enhancement: {
    maximumCraftingCount: 100,
    recyclingReturnRate: 0.9,
    maximumEnhancementLevel: 3,
    costs: [
      {
        domainId: 'domain_1',
        domainLabel: 'Domain',
        consumeId: 'mat_a',
        consumeCount: 1,
        returnId: 'mat_return',
        returnCount: 2
      }
    ]
  }
}

const item: ItemDetailModel = {
  kind: 'item',
  id: 'item_a',
  name: 'Item',
  rarity: 4,
  icon: '/item.png',
  typeLabel: 'Material',
  description: 'Description',
  decorativeDescription: 'Decoration',
  effects: [{ id: 'afterUse', descriptions: ['Effect'], meta: [] }],
  properties: [{ id: 'maxStack', label: '', value: 99 }],
  recipes: [
    {
      id: 'recipe',
      kind: 'manualCrafting',
      name: 'Recipe',
      meta: '',
      durationMs: 0,
      inputs: [{ id: 'item_a', name: 'Item', icon: '/item.png', count: 1 }],
      outputs: [{ id: 'item_b', name: 'Output', icon: '/output.png', count: 1 }]
    }
  ],
  obtainWays: [{ id: 'way', icon: '/way.png', description: 'Explore' }],
  applicableWeapons: ['weapon_a'],
  choiceBox: { selectedCount: 1, rewardIds: ['reward_a'] },
  iconComposite: [{ id: 'showRarity', label: '', value: 'yes' }],
  displayType: 'Resources',
  encyclopedia: { id: 'wiki_item_a', groupId: 'wiki_group_item' }
}

const achievement: AchievementDetailModel = {
  kind: 'achievement',
  id: 'category_a',
  name: 'Exploration',
  groups: [
    {
      id: 'group_a',
      name: 'Region',
      achievements: [
        {
          id: 'achievement_a',
          name: 'Explorer',
          order: 1,
          added: true,
          upgradable: true,
          platable: false,
          rareEffect: false,
          hiddenUntilObtained: false,
          levels: [{ level: 1, icon: '/medal.png', description: 'Complete', conditions: [] }]
        }
      ]
    }
  ]
}

describe('legacy catalog detail layout order', () => {
  it('keeps all character groups in the legacy sequence', () => {
    const wrapper = mount(CharacterCatalogDetail, {
      props: {
        model: character,
        locale: 'EN',
        preferredLevels: [1],
        preferredSkillLevels: [1],
        resolveImageUrl
      }
    })

    expect(sectionOrder(wrapper)).toEqual([
      'character-header',
      'attribute-growth',
      'talents',
      'potentials',
      'attribute-nodes',
      'skills',
      'logistics',
      'potential-images',
      'profile',
      'voice'
    ])
  })

  it('keeps weapon groups in the legacy sequence', () => {
    const wrapper = mount(WeaponCatalogDetail, {
      props: { model: weapon, locale: 'EN', preferredLevels: [1], resolveImageUrl }
    })

    expect(sectionOrder(wrapper)).toEqual([
      'weapon-header',
      'base-attack',
      'skill-data',
      'breakthrough-materials',
      'potentials',
      'story'
    ])
  })

  it('keeps enemy header, poise effects and variants in the legacy sequence', () => {
    const wrapper = mount(EnemyCatalogDetail, {
      props: { model: enemy, locale: 'EN', preferredLevels: [1], resolveImageUrl }
    })

    expect(sectionOrder(wrapper)).toEqual(['enemy-header', 'poise-break-buffs', 'variant-attributes'])
  })

  it('keeps equipment groups in the legacy sequence', () => {
    const wrapper = mount(EquipCatalogDetail, {
      props: { model: equip, locale: 'EN', showHidden: true, resolveImageUrl }
    })

    expect(sectionOrder(wrapper)).toEqual(['equip-header', 'set-skills', 'set-pieces', 'enhancement-info'])
    expect(wrapper.find('[data-detail-region="piece-description"]').exists()).toBe(true)
    expect(wrapper.find('[data-detail-region="version-added-badge"]').text()).toBe('Added')
    expect(wrapper.find('[data-detail-region="crafting-cost"]').exists()).toBe(true)
    expect(wrapper.find('[data-detail-region="enhancement-guarantee"]').exists()).toBe(true)
    expect(wrapper.find('[data-detail-region="hidden-piece-id"]').text()).toBe('equip_a')
    expect(wrapper.find('[data-detail-region="enhancement-costs"]').exists()).toBe(true)
    expect(wrapper.find('[data-detail-region="returned-materials"]').text()).toContain('mat_return')
  })

  it('keeps item groups in the legacy sequence', () => {
    const wrapper = mount(ItemCatalogDetail, {
      props: { model: item, locale: 'EN', showHidden: true, resolveImageUrl }
    })

    expect(sectionOrder(wrapper)).toEqual([
      'item-header',
      'use-effects',
      'properties',
      'crafting-paths',
      'obtain-ways',
      'applicable-weapons',
      'choice-box-contents',
      'icon-composite',
      'display-type',
      'encyclopedia-entry'
    ])

    const publicWrapper = mount(ItemCatalogDetail, {
      props: { model: item, locale: 'EN', showHidden: false, resolveImageUrl }
    })
    expect(sectionOrder(publicWrapper)).not.toContain('applicable-weapons')
    expect(sectionOrder(publicWrapper)).not.toContain('choice-box-contents')
    expect(sectionOrder(publicWrapper)).not.toContain('encyclopedia-entry')
  })

  it('keeps achievement category and groups in the legacy sequence', () => {
    const wrapper = mount(AchievementCatalogDetail, {
      props: { model: achievement, locale: 'EN', resolveImageUrl }
    })

    expect(sectionOrder(wrapper)).toEqual(['achievement-header', 'achievement-groups'])
    expect(wrapper.find('[data-detail-region="version-added-badge"]').text()).toBe('Added')
  })
})
