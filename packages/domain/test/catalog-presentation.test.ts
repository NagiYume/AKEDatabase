import { describe, expect, it } from 'vitest'
import {
  CATALOG_DEFINITIONS,
  buildCatalogEntries,
  buildCatalogFacetDefinitions,
  buildCatalogOverviewGroups,
  buildAchievementDetailModel,
  buildCharacterDetailModel,
  buildDetailBundle,
  buildEnemyDetailModel,
  buildEquipDetailModel,
  buildItemDetailModel,
  buildWeaponDetailModel,
  filterEntriesByCatalogFacets,
  type CatalogEntry,
  type TableSet
} from '../src/index'

const maps = {
  profession_id_map: { '1': 'Guard' },
  weapon_id_map: { '2': 'Sword' },
  char_type_map: { Fire: 'Heat' },
  ATTR_MAP: { '1': 'HP', '2': 'Attack', '3': 'Defense', '20': 'Poise', '39': 'Strength' },
  MODIFIER_TYPE_MAP: { '0': 'Flat' },
  room_type_map: { CONTROL: 'Control room' }
}

function entry(id: string, name: string): CatalogEntry {
  return {
    id,
    name,
    subtitle: '',
    rarity: 5,
    category: '',
    categoryLabel: '',
    icon: `/public/images/${id}.png`,
    priority: 0,
    hidden: false,
    searchText: `${id}\n${name}`.toLocaleLowerCase(),
    source: {}
  }
}

describe('legacy catalog facets and overview grouping', () => {
  const tables: TableSet = {
    CharacterTable: {
      char_a: { charId: 'char_a', name: { text: 'Alpha' }, rarity: 6 },
      char_b: { charId: 'char_b', name: { text: 'Bravo' }, rarity: 5 }
    },
    CharGrowthTable: {
      char_a: { profession: 1, weaponType: 2, charTypeId: 'Fire' },
      char_b: { profession: 1, weaponType: 2, charTypeId: 'Fire' }
    }
  }

  it('keeps the character facet order and filters without changing deep-link source entries', () => {
    const entries = buildCatalogEntries(CATALOG_DEFINITIONS.v3_character, tables, maps)
    const facets = buildCatalogFacetDefinitions('v3_character', entries)
    const visible = filterEntriesByCatalogFacets(entries, {
      rarity: new Set(['6']),
      element: new Set(['Fire'])
    })

    expect(facets.map((facet) => facet.id)).toEqual(['rarity', 'element', 'profession', 'weapon'])
    expect(visible.map((item) => item.id)).toEqual(['char_a'])
    expect(entries).toHaveLength(2)
  })

  it('puts version changes before the semantic image-card groups', () => {
    const entries = buildCatalogEntries(CATALOG_DEFINITIONS.v3_character, tables, maps)
    entries[1] = { ...entries[1], changeType: 'modified' }

    const groups = buildCatalogOverviewGroups('v3_character', entries)

    expect(groups[0]).toMatchObject({ id: '__version_changes__', versionChanges: true })
    expect(groups[0]?.items.map((item) => item.entry.id)).toEqual(['char_b'])
    expect(groups[1]?.label).toBe('Guard')
  })

  it('uses only the legacy filters for equipment, items and achievements', () => {
    const genericEntry = entry('item_a', 'Item')
    genericEntry.category = 'type:1'
    genericEntry.categoryLabel = 'Material'

    expect(buildCatalogFacetDefinitions('v3_equip', [genericEntry])).toEqual([])
    expect(buildCatalogFacetDefinitions('v3_item', [genericEntry]).map((facet) => facet.id)).toEqual([
      'rarity',
      'category'
    ])
    expect(buildCatalogFacetDefinitions('v3_achievement', [genericEntry])).toEqual([])
  })
})

describe('module-specific legacy detail models', () => {
  it('follows character relations and exposes every populated legacy detail group', () => {
    const tables: TableSet = {
      CharacterTable: {
        char_a: {
          name: { text: 'Alpha' },
          rarity: 6,
          profession: 1,
          cvName: { JapCVName: { text: 'Actor' } },
          attributes: [
            {
              breakStage: 0,
              Attribute: {
                attrs: [
                  { attrType: 0, attrValue: 1 },
                  { attrType: 39, attrValue: 12 },
                  { attrType: 2, attrValue: 30 }
                ]
              }
            }
          ],
          profileRecord: [{ recordTitle: { text: 'Record' }, recordDesc: { text: 'History' } }],
          profileVoice: [{ voId: 'voice_1', voiceTitle: { text: 'Greeting' }, voiceDesc: { text: 'Hello' } }]
        }
      },
      CharGrowthTable: {
        char_a: {
          profession: 1,
          weaponType: 2,
          charTypeId: 'Fire',
          talentNodeMap: {
            talent: {
              nodeType: 4,
              requiredItem: [{ id: 'mat_a', count: 2 }],
              passiveSkillNodeInfo: { talentEffectId: 'talent_a', index: 1, name: { text: 'Talent' } }
            },
            attribute: {
              nodeId: 'node_a',
              nodeType: 3,
              attributeNodeInfo: {
                breakStage: 1,
                title: { text: 'Node' },
                desc: { text: 'Node effect' },
                attributeModifiers: [{ attrType: 2, attrValue: 8 }]
              }
            }
          },
          skillGroupMap: {
            group_a: {
              skillGroupId: 'group_a',
              skillGroupType: 0,
              skillIdList: ['skill_a'],
              name: { text: 'Basic attack' },
              desc: { text: 'Strike' }
            }
          },
          skillLevelUp: [{ skillGroupId: 'group_a', level: 2, itemBundle: [{ id: 'mat_a', count: 1 }] }]
        }
      },
      CharacterPotentialTable: {
        char_a: {
          potentialUnlockBundle: [
            {
              level: 1,
              name: { text: 'Potential' },
              potentialEffectId: 'potential_a',
              itemIds: ['mat_a'],
              itemCnts: [3],
              unlockCharPictureItemList: ['item_char_a_potential']
            }
          ]
        }
      },
      PotentialTalentEffectTable: {
        talent_a: { desc: { text: 'Talent effect' } },
        potential_a: { desc: { text: 'Potential effect' } }
      },
      SkillPatchTable: {
        skill_a: { SkillPatchDataBundle: [{ level: 1, description: { text: 'Level one' } }] }
      },
      SpaceshipCharSkillTable: {
        char_a: { skillList: [{ skillId: 'log_a', unlockHint: { text: 'Default' } }] }
      },
      SpaceshipSkillTable: {
        log_a: {
          talentName: { text: 'Logistics' },
          name: { text: 'Efficiency' },
          desc: { text: 'Faster' },
          roomType: 'CONTROL'
        }
      },
      ItemTable: {
        char_a: { desc: { text: 'Character profile' } },
        mat_a: { name: { text: 'Material' }, iconId: 'mat_a' }
      },
      CharProfessionTable: { '1': { desc: { text: 'Profession feature' } } }
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_character, 'char_a', tables)
    const model = buildCharacterDetailModel('char_a', entry('char_a', 'Alpha'), bundle, maps)

    expect(Object.keys(bundle.SkillPatchTable ?? {})).toEqual(['skill_a'])
    expect(model).toMatchObject({ kind: 'character', name: 'Alpha', profile: 'Character profile' })
    expect(model?.growth?.rows).toHaveLength(1)
    expect(model?.talents).toHaveLength(1)
    expect(model?.potentials).toHaveLength(1)
    expect(model?.attributeNodes).toHaveLength(1)
    expect(model?.skills[0]?.levels).toHaveLength(1)
    expect(model?.logistics).toHaveLength(1)
    expect(model?.potentialImages).toHaveLength(1)
    expect(model?.profileRecords).toHaveLength(1)
    expect(model?.voiceRecords).toHaveLength(1)
  })

  it('builds weapon attack, skill, breakthrough, potential and story groups in one model', () => {
    const tables: TableSet = {
      WeaponBasicTable: {
        weapon_a: {
          rarity: 6,
          weaponSkillList: ['skill_a'],
          levelTemplateId: 'curve_a',
          breakthroughTemplateId: 'break_a',
          talentTemplateId: 'talent_a',
          weaponDesc: { text: 'Weapon story' }
        }
      },
      ItemTable: {
        weapon_a: {
          name: { text: 'Blade' },
          desc: { text: 'Description' },
          decoDesc: { text: 'Decoration' }
        },
        mat_a: { name: { text: 'Alloy' }, iconId: 'mat_a' }
      },
      SkillPatchTable: {
        skill_a: {
          SkillPatchDataBundle: [{ level: 1, skillName: { text: 'Edge' }, description: { text: 'Cut' } }]
        }
      },
      WeaponUpgradeTemplateTable: { curve_a: { list: [{ weaponLv: 1, baseAtk: 40 }] } },
      WeaponBreakThroughTemplateTable: {
        break_a: { list: [{ breakthroughShowLv: 1, breakItemList: [{ id: 'mat_a', count: 2 }] }] }
      },
      WeaponTalentTemplateTable: {
        talent_a: { list: [{ talentLv: 1, skillLevelExtraBounds: [{ upperBound: 2 }] }] }
      }
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_weapon, 'weapon_a', tables)
    const model = buildWeaponDetailModel('weapon_a', entry('weapon_a', 'Blade'), bundle)

    expect(model).toMatchObject({ kind: 'weapon', story: 'Weapon story' })
    expect(model?.attackRows).toEqual([{ level: 1, attack: 40 }])
    expect(model?.skills).toHaveLength(1)
    expect(model?.breakthroughs[0]?.materials[0]?.name).toBe('Alloy')
    expect(model?.potentials).toHaveLength(1)
  })

  it('keeps only selected enemy variants and applies their modifiers to multilevel rows', () => {
    const tables: TableSet = {
      EnemyTemplateDisplayInfoTable: {
        enemy_a: {
          name: { text: 'Enemy' },
          displayType: 2,
          description: { text: 'Description' },
          abilityDescIds: ['ability_a'],
          distributionIds: ['area_a']
        }
      },
      EnemyTable: {
        enemy_a: { templateId: 'enemy_a', attrTemplateId: 'attr_a' },
        enemy_a_hard: {
          templateId: 'enemy_a',
          attrTemplateId: 'attr_a',
          attrModifiers: [{ attrType: 1, modifierType: 0, attrValue: 50 }],
          bornBuffs: ['buff_a'],
          isDangerous: true
        },
        unrelated: { templateId: 'enemy_b', attrTemplateId: 'attr_b' }
      },
      EnemyAttributeTemplateTable: {
        attr_a: {
          poiseKnotBuffList: ['poise_buff'],
          levelIndependentAttributes: { attrs: [{ attrType: 20, attrValue: 80 }] },
          levelDependentAttributes: [
            {
              attrs: [
                { attrType: 0, attrValue: 10 },
                { attrType: 1, attrValue: 100 },
                { attrType: 2, attrValue: 20 },
                { attrType: 3, attrValue: 10 }
              ]
            }
          ]
        }
      },
      EnemyAbilityDescTable: { ability_a: { description: { text: 'Ability' } } },
      DisplayEnemyTypeTable: { '2': { name: { text: 'Boss' } } },
      DistributionInfoTable: { area_a: { areaName: { text: 'Area' } } }
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_enemy, 'enemy_a', tables)
    const model = buildEnemyDetailModel('enemy_a', entry('enemy_a', 'Enemy'), bundle, maps)

    expect(Object.keys(bundle.EnemyTable ?? {})).toEqual(['enemy_a', 'enemy_a_hard'])
    expect(model?.abilities).toEqual(['Ability'])
    expect(model?.variants).toHaveLength(2)
    expect(model?.variants.find((variant) => variant.id === 'enemy_a_hard')?.rows[0]?.hp).toBe(150)
    expect(model?.variants.find((variant) => variant.id === 'enemy_a_hard')?.flags).toEqual(['dangerous'])
  })

  it('builds equipment skills, pieces, crafting costs, guarantees and enhancement information', () => {
    const tables: TableSet = {
      EquipSuitTable: {
        suit_a: {
          equipList: ['equip_a'],
          list: [{ suitName: { text: 'Set Alpha' }, skillID: 'set_skill' }]
        }
      },
      EquipTable: {
        equip_a: {
          partType: 0,
          minWearLv: 20,
          domainId: 'domain_1',
          displayBaseAttrModifier: { attrIndex: 0, attrType: 3, attrValue: 12, modifierType: 5 },
          displayAttrModifiers: [
            {
              attrIndex: 1,
              attrType: 39,
              attrValue: 10,
              modifierType: 5,
              enhancedAttrValues: [12, 14, 16],
              enhanceGuaranteeTimesRuleId: 'rule_a'
            }
          ]
        }
      },
      ItemTable: {
        equip_a: {
          name: { text: 'Armor' },
          rarity: 5,
          iconId: 'equip_a',
          decoDesc: { text: 'Armor detail' }
        },
        mat_a: { name: { text: 'Alloy' }, iconId: 'mat_a' }
      },
      SkillPatchTable: {
        set_skill: {
          SkillPatchDataBundle: [
            { level: 1, skillName: { text: 'Set skill' }, description: { text: 'Power' } }
          ]
        }
      },
      EquipFormulaReverseTable: { equip_a: 'formula_a' },
      EquipFormulaTable: { formula_a: { level: 'T2', packId: 'pack_a' } },
      EquipFormulaChainTable: {
        T2: { chainList: [{ chainId: 'chain_a', isDefault: true, costItemId: ['mat_a'], costItemNum: [3] }] }
      },
      EquipPackTable: { pack_a: { name: { text: 'Pack Alpha' } } },
      EquipPackFormulaTable: { pack_a: {} },
      EquipEnhanceGuaranteeTimesRuleTable: {
        rule_a: { GuaranteeTimes1: 2, GuaranteeTimes2: 4, GuaranteeTimes3: 6 }
      },
      EquipEnhanceCostTable: {
        domain_1: {
          domainId: 'domain_1',
          consumeItemId: 'mat_a',
          consumeItemCnt: 1,
          returnbackItemId: 'mat_return',
          returnbackItemCnt: 2
        }
      },
      EquipConst: { maxAttrEnhanceLevel: 3 },
      EquipTechConst: { equipProduceMaxCount: 100, equipRecycleRatio: 0.9 }
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_equip, 'suit_a', tables)
    const model = buildEquipDetailModel('suit_a', entry('suit_a', 'Set Alpha'), bundle, maps, {
      EquipTable: { equip_previous: {} }
    })

    expect(model).toMatchObject({ kind: 'equip', name: 'Set Alpha', packs: ['Pack Alpha'] })
    expect(model?.skills).toHaveLength(1)
    expect(model?.pieces[0]).toMatchObject({ id: 'equip_a', added: true, description: 'Armor detail' })
    expect(model?.pieces[0]?.crafting[0]?.items[0]?.name).toBe('Alloy')
    expect(model?.pieces[0]?.guarantees[0]?.values).toEqual([2, 4, 6])
    expect(model?.enhancement).toMatchObject({ maximumCraftingCount: 100, recyclingReturnRate: 0.9 })
    expect(model?.enhancement?.costs[0]).toMatchObject({
      consumeId: 'mat_a',
      consumeCount: 1,
      returnId: 'mat_return',
      returnCount: 2
    })
  })

  it('normalizes an item recipe graph and preserves the legacy detail groups', () => {
    const tables: TableSet = {
      ItemTable: {
        item_a: {
          name: { text: 'Material A' },
          rarity: 4,
          type: 1,
          showingType: 2,
          iconId: 'item_a',
          desc: { text: 'Description' },
          decoDesc: { text: 'Decoration' },
          obtainWayIds: ['way_a'],
          iconCompositeId: 'composite_a',
          maxStackCount: 99,
          maxBackpackStackCount: 20
        },
        item_b: { name: { text: 'Material B' }, iconId: 'item_b' },
        item_c: { name: { text: 'Product C' }, iconId: 'item_c' }
      },
      ItemTypeTable: { '1': { name: { text: 'Material' }, storageSpace: 2 } },
      ItemShowingTypeTable: { '2': { name: { text: 'Resources' }, type: 2 } },
      SystemJumpTable: { way_a: { iconId: 'way', desc: { text: 'Explore' } } },
      ItemIconCompositeTable: { composite_a: { iconTransType: 2, showRarity: true, markIcon: 'mark' } },
      WeaponPotentialUpItemTable: {
        item_a: { itemId: 'item_a', weaponIds: ['weapon_a', 'weapon_b'] }
      },
      UsableItemChestTable: {
        item_a: { id: 'item_a', selectedCount: 1, rewardIdList: ['reward_a', 'reward_b'] }
      },
      WikiEntryDataTable: {
        wiki_item_a: { id: 'wiki_item_a', groupId: 'wiki_group_item', refItemId: 'item_a' },
        wiki_other: { id: 'wiki_other', groupId: 'wiki_group_item', refItemId: 'item_other' }
      },
      UseItemTable: { item_a: { itemUseDesc: { text: 'Recover' }, duration: 5 } },
      EquipItemTable: { item_a: { equipDesc: { text: 'Equip effect' }, chargeCount: 2 } },
      FactoryMachineCraftTable: {
        recipe_a: {
          formulaDesc: { text: 'Process' },
          formulaGroupId: 'group_a',
          machineId: 'machine_a',
          progressRound: 2,
          ingredients: [
            {
              group: [
                { id: 'item_a', count: 1 },
                { id: 'item_b', count: 2 }
              ]
            }
          ],
          outcomes: [{ group: [{ id: 'item_c', count: 1 }] }]
        }
      },
      FactoryMachineCraftGroupTable: { group_a: { msPerRound: 3_000 } },
      FactoryBuildingTable: { machine_a: { name: { text: 'Refinery' } } },
      FactoryManualCraftTable: {},
      FactoryHubCraftTable: {},
      EquipFormulaTable: {},
      SpaceshipGrowCabinFormulaTable: {},
      SpaceshipGrowCabinSeedFormulaTable: {},
      SpaceshipManufactureFormulaTable: {}
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_item, 'item_a', tables)
    const model = buildItemDetailModel('item_a', entry('item_a', 'Material A'), bundle, maps)

    expect(Object.keys(bundle.ItemTable ?? {})).toEqual(['item_a', 'item_b', 'item_c'])
    expect(model).toMatchObject({ kind: 'item', typeLabel: 'Material', displayType: 'Resources' })
    expect(model?.effects.map((effect) => effect.id)).toEqual(['afterUse', 'afterEquip'])
    expect(model?.properties).toHaveLength(3)
    expect(model?.recipes[0]).toMatchObject({ kind: 'integratedIndustry', durationMs: 6_000 })
    expect(model?.obtainWays).toHaveLength(1)
    expect(model?.applicableWeapons).toEqual(['weapon_a', 'weapon_b'])
    expect(model?.choiceBox).toEqual({ selectedCount: 1, rewardIds: ['reward_a', 'reward_b'] })
    expect(model?.iconComposite).toHaveLength(3)
    expect(model?.encyclopedia).toEqual({ id: 'wiki_item_a', groupId: 'wiki_group_item' })
  })

  it('groups achievements and orders their medal levels and conditions', () => {
    const tables: TableSet = {
      AchievementTypeTable: {
        category_a: {
          categoryName: { text: 'Exploration' },
          noObtainCanView: false,
          achievementGroupData: [{ groupId: 'group_a', groupName: { text: 'Region' } }]
        }
      },
      AchievementTable: {
        achievement_a: {
          groupId: 'group_a',
          name: { text: 'Explorer' },
          order: 1,
          canBeUpgraded: true,
          levelInfos: {
            '2': { achieveLevel: 2, completeDesc: { text: 'Second' }, conditions: [] },
            '1': {
              achieveLevel: 1,
              completeDesc: { text: 'First' },
              conditions: [{ conditionId: 'condition_a', desc: { text: 'Visit' }, progressToCompare: 10 }]
            }
          }
        }
      }
    }
    const bundle = buildDetailBundle(CATALOG_DEFINITIONS.v3_achievement, 'category_a', tables)
    const model = buildAchievementDetailModel('category_a', bundle, {
      AchievementTable: { achievement_previous: { groupId: 'group_a' } }
    })

    expect(model).toMatchObject({ kind: 'achievement', name: 'Exploration' })
    expect(model?.groups[0]?.name).toBe('Region')
    expect(model?.groups[0]?.achievements[0]).toMatchObject({
      added: true,
      upgradable: true,
      hiddenUntilObtained: true
    })
    expect(model?.groups[0]?.achievements[0]?.levels.map((level) => level.level)).toEqual([1, 2])
  })
})
