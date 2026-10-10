// Module table dependencies, not proof that every field is displayed.
// Shared I18nTextTable_<language> hydration is infrastructure, not module ownership.
// Maintain alongside module adapters; see the repository development skill.
window.AKESearchIndex = {
  "search": {
    "tables": [],
    "sources": [
      "plugin/search.html"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "tech_tree": {
    "tables": [
      "DomainDataTable",
      "DungeonTable",
      "FacSTTBuildingDomainLimitTechTable",
      "FacSTTCategoryTable",
      "FacSTTConditionTable",
      "FacSTTGroupTable",
      "FacSTTLayerTable",
      "FacSTTNodeTable",
      "FacSTTPackConditionTable",
      "FactoryBuildingTable",
      "ItemTable",
      "MachineId2MachineTechIdTable",
      "RewardTable"
    ],
    "sources": [
      "plugin/js/ake-catalog.js",
      "plugin/js/tech-tree.js",
      "plugin/tech_tree.html"
    ]
  },
  "factory": {
    "tables": [
      "DomainDataTable",
      "FacSTTBuildingDomainLimitTechTable",
      "FacSTTNodeTable",
      "FactoryBatteryItemTable",
      "FactoryBattleTable",
      "FactoryBoxValveTable",
      "FactoryBuildingItemTable",
      "FactoryBuildingTable",
      "FactoryFluidConsumeTable",
      "FactoryFluidContainerTable",
      "FactoryFluidPumpInTable",
      "FactoryFluidPumpOutTable",
      "FactoryFluidSprayTable",
      "FactoryFluidValveTable",
      "FactoryFuelItemTable",
      "FactoryGasContainerTable",
      "FactoryGasMinerTable",
      "FactoryGridBeltTable",
      "FactoryGridConnecterTable",
      "FactoryGridRouterTable",
      "FactoryHubTable",
      "FactoryLiquidConnectorTable",
      "FactoryLiquidPipeTable",
      "FactoryLiquidRouterTable",
      "FactoryMachineCrafterTable",
      "FactoryMachineCraftGroupTable",
      "FactoryMachineCraftModeTable",
      "FactoryMachineCraftTable",
      "FactoryMinerTable",
      "FactoryPowerPoleTable",
      "FactoryPowerStationTable",
      "FactoryQuickBarTypeTable",
      "FactoryStoragerTable",
      "FactoryTransmuterTable",
      "FactoryUndergroundPipeTable",
      "ItemTable",
      "MachineId2MachineTechIdTable",
      "RewardTable"
    ],
    "sources": [
      "plugin/factory.html",
      "plugin/js/ake-catalog.js",
      "plugin/js/factory.js"
    ]
  },
  "spaceship": {
    "tables": [
      "CharacterTable",
      "ItemTable",
      "RewardTable",
      "SpaceshipCharSkillTable",
      "SpaceshipClueDataTable",
      "SpaceshipCommandCenterLvTable",
      "SpaceshipControlCenterLvTable",
      "SpaceshipCreditTable",
      "SpaceshipDomainMoneyExchangeRateDataTable",
      "SpaceshipGrowCabinFormulaTable",
      "SpaceshipGrowCabinLvTable",
      "SpaceshipGrowCabinSeedFormulaTable",
      "SpaceshipGuestRoomClueLvTable",
      "SpaceshipGuestRoomLvTable",
      "SpaceshipManufactureFormulaTable",
      "SpaceshipManufacturingStationLvTable",
      "SpaceshipRoomAttrTypeTable",
      "SpaceshipRoomLvHelperTable",
      "SpaceshipRoomLvTable",
      "SpaceshipRoomTypeTable",
      "SpaceshipSkillTable"
    ],
    "sources": [
      "plugin/js/ake-catalog.js",
      "plugin/js/spaceship.js",
      "plugin/spaceship.html"
    ]
  },
  "adventure": {
    "tables": [
      "AdventureBookStageRewardTable",
      "AdventureLevelTable",
      "AdventureTaskGroupTable",
      "AdventureTaskTable",
      "AdventureWorldLevelTable",
      "AdventureWorldLevelUnlockTaskGroupTable",
      "DailyActivationRewardTable",
      "DomainDataTable",
      "ItemTable",
      "RewardTable",
      "SystemJumpTable",
      "TextTable"
    ],
    "sources": [
      "plugin/adventure.html",
      "plugin/js/adventure.js",
      "plugin/js/ake-catalog.js"
    ]
  },
  "tutorial": {
    "tables": [
      "EnemyTemplateDisplayInfoTable",
      "ItemTable",
      "PrtsAllItem",
      "RewardTable",
      "WikiCategoryTable",
      "WikiEntryDataTable",
      "WikiEntryTable",
      "WikiGroupTable",
      "WikiTutorialPageByEntryTable",
      "WikiTutorialPageTable"
    ],
    "sources": [
      "plugin/js/ake-asset-index.js",
      "plugin/js/ake-catalog.js",
      "plugin/js/tutorial.js",
      "plugin/tutorial.html"
    ]
  },
  "settings": {
    "tables": [],
    "sources": [
      "plugin/js/settings.js",
      "plugin/settings.html"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "hidden-example": {
    "tables": [],
    "sources": [
      "plugin/hidden.html"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "model-viewer": {
    "tables": [],
    "sources": [
      "plugin/js/ake-model-viewer.js",
      "plugin/js/ake-renderer.js",
      "plugin/model-viewer.html"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "v3_buff": {
    "tables": [
      "CharacterTable",
      "CharGrowthTable",
      "EnemyTable",
      "EnemyTemplateDisplayInfoTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v3-buff-data.js",
      "plugin/js/v3-buff.js",
      "plugin/v3_buff.html"
    ],
    "coverage": "BuffData assets determine buff membership; listed tables supply ownership."
  },
  "v3_skill": {
    "tables": [
      "CharacterTable",
      "CharGrowthTable",
      "EnemyTable",
      "EnemyTemplateDisplayInfoTable",
      "PotentialTalentEffectTable",
      "SkillPatchTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v3-skill-data.js",
      "plugin/js/v3-skill.js",
      "plugin/v3_skill.html"
    ],
    "coverage": "SkillData assets determine skill membership; listed tables supply descriptions and ownership."
  },
  "about": {
    "tables": [],
    "sources": [
      "plugin/about.html",
      "plugin/js/about.js"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "asset": {
    "tables": [],
    "sources": [
      "plugin/asset.html",
      "plugin/js/asset.js"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "research": {
    "tables": [],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/research.html"
    ],
    "coverage": "No primary TableCfg text entries; site content, assets, or remote search."
  },
  "misc": {
    "tables": [
      "ActivityConditionalMultiStageCompleteConditionTable",
      "ActivityConditionalMultiStageTable",
      "ActivityConditionalMultiStageTaskCompleteConditionTable",
      "ActivityConditionalMultiStageTaskConfigTable",
      "ActivityContingencyContractTable",
      "ActivityContingencyContractTaskGroupTable",
      "ActivityRacingDungeonMilestoneTable",
      "ActivityRacingDungeonTable",
      "ActivityTable",
      "ActivityWeeklyTaskMileStoneTable",
      "ActivityWeeklyTaskTable",
      "AttributeFilterTable",
      "AttributeShowConfigTable",
      "BattlePassConditionTable",
      "BattlePassLevelTable",
      "BattlePassOverrideLevelTable",
      "BattlePassSeasonTable",
      "BattlePassTaskGroupTable",
      "BattlePassTaskLabelMapTable",
      "BattlePassTaskLabelTable",
      "BattlePassTaskSubLabelMapTable",
      "BattlePassTaskTable",
      "BattlePassTrackTable",
      "CharacterTable",
      "CharGrowthTable",
      "ContingencyContractTable",
      "DomainDataTable",
      "DungeonTable",
      "EquipFormulaChainTable",
      "EquipFormulaTable",
      "EquipTable",
      "FactoryBuildingTable",
      "FactoryEnvDisplayTable",
      "FactoryFluidConsumeItemTable",
      "FactoryFluidConsumeTable",
      "FactoryFluidPumpInTable",
      "FactoryFuelItemTable",
      "FactoryGasMinerTable",
      "FactoryHubCraftTable",
      "FactoryMachineCraftGroupTable",
      "FactoryMachineCraftTable",
      "FactoryManualCraftTable",
      "FactoryMinerTable",
      "FactoryPowerStationTable",
      "FactoryVaporizerTable",
      "HyperlinkTextTable",
      "ItemTable",
      "PotentialTalentEffectTable",
      "RewardTable",
      "RichTextStyleTable",
      "SimulationTrainingConst",
      "SkillPatchTable",
      "SpaceshipGrowCabinFormulaTable",
      "SpaceshipGrowCabinSeedFormulaTable",
      "SpaceshipManufactureFormulaTable",
      "TimeRangeTable",
      "TyphoeaArcheryChipTable",
      "TyphoeaArcheryConst",
      "TyphoeaArcheryDailyLevelId2RankId",
      "TyphoeaArcheryDailyTrainTable",
      "TyphoeaArcheryLevelTable",
      "TyphoeaArcherySimulateTrainGroupTable",
      "TyphoeaArcherySimulateTrainTable",
      "TyphoeaShootingRangeAffixCombinationTable",
      "TyphoeaShootingRangeAffixTable",
      "WeaponBasicTable",
      "WikiDefaultCraftTable"
    ],
    "sources": [
      "plugin/js/ake-watermark.js",
      "plugin/js/misc-character-icon-generator.js",
      "plugin/js/misc-character-skill-popup-generator.js",
      "plugin/js/misc-contingency-contract-tasks.js",
      "plugin/js/misc-guide-image-generator.js",
      "plugin/js/misc-guide-reference-draw.js",
      "plugin/js/misc-guide-reference-template.js",
      "plugin/js/misc-protocol-pass-tasks.js",
      "plugin/js/misc-racing-dungeon-tasks.js",
      "plugin/js/misc-recipe-flow-viewer.js",
      "plugin/js/misc-simulation-training-tasks.js",
      "plugin/js/misc-takestwo-completion-tasks.js",
      "plugin/js/misc-typhoea-archery.js",
      "plugin/js/misc-watermark-decoder.js",
      "plugin/js/misc-weekly-tasks.js",
      "plugin/js/misc.js",
      "plugin/misc.html",
      "plugin/misc/character_icon_generator.html",
      "plugin/misc/character_skill_popup_generator.html",
      "plugin/misc/contingency_contract_tasks.html",
      "plugin/misc/guide_image_generator.html",
      "plugin/misc/protocol_pass_tasks.html",
      "plugin/misc/racing_dungeon_tasks.html",
      "plugin/misc/recipe_flow_viewer.html",
      "plugin/misc/simulation_training_tasks.html",
      "plugin/misc/takestwo_completion_tasks.html",
      "plugin/misc/typhoea_archery.html",
      "plugin/misc/watermark_decoder.html",
      "plugin/misc/weekly_tasks.html"
    ]
  },
  "baker": {
    "tables": [
      "ItemTable",
      "SNSChatTable",
      "SNSDialogOptionTable",
      "SNSDialogTable",
      "SNSDialogTopicTable"
    ],
    "sources": [
      "plugin/baker.html",
      "plugin/js/baker.js",
      "plugin/js/module-overview.js"
    ]
  },
  "v3_archive": {
    "tables": [
      "DialogTextTable",
      "DomainDataTable",
      "LevelDescTable",
      "PrtsAllItem",
      "PrtsCategory",
      "PrtsFirstLv",
      "PrtsInvestigate",
      "PrtsNote",
      "PrtsPage",
      "PrtsReading",
      "RadioTable",
      "ReadingPopUpIconTable",
      "ReadingPopUpTable",
      "RichContentTable"
    ],
    "sources": [
      "plugin/js/ake-voice-player.js",
      "plugin/js/module-overview.js",
      "plugin/js/v3-archive.js",
      "plugin/v3_archive.html"
    ],
    "coverage": "Prts tables plus indexed LevelData/LevelScriptData references; unindexed Json content is not covered."
  },
  "v3_cc": {
    "tables": [
      "ActivityConditionalMultiStageTaskConfigTable",
      "ActivityContingencyContractTable",
      "ActivityContingencyContractTaskGroupTable",
      "ActivityTable",
      "CcTagTable",
      "CcTagTipTable",
      "ContingencyContractKeyLockTable",
      "ContingencyContractLevelTable",
      "ContingencyContractTable",
      "DungeonTable",
      "ItemTable",
      "RewardTable",
      "ShopGoodsTable",
      "ShopGroupTable",
      "ShopTable",
      "TimeRangeTable"
    ],
    "sources": [
      "plugin/js/ake-combat-data.js",
      "plugin/js/ake-enemy-renderer.js",
      "plugin/js/ake-stats.js",
      "plugin/js/module-overview.js",
      "plugin/js/v2-cc.js",
      "plugin/js/v3-table-data.js#cc",
      "plugin/v3_cc.html"
    ]
  },
  "season_tower": {
    "tables": [
      "ActivityTable",
      "DungeonSeriesTable",
      "DungeonTable",
      "EnemyAttributeTemplateTable",
      "EnemyTable",
      "EnemyTemplateDisplayInfoTable",
      "GameMechanicGroupTable",
      "GameMechanicTable",
      "IntroTable",
      "ItemTable",
      "RewardTable",
      "SeasonTowerConst",
      "SeasonTowerDungeonTable",
      "SeasonTowerGameGroupTable",
      "SeasonTowerRankTable",
      "SeasonTowerTable",
      "TimeRangeTable"
    ],
    "sources": [
      "plugin/js/ake-combat-data.js",
      "plugin/js/ake-enemy-renderer.js",
      "plugin/js/ake-stats.js",
      "plugin/js/season-tower.js",
      "plugin/season_tower.html"
    ]
  },
  "v3_achievement": {
    "tables": [
      "AchievementTable",
      "AchievementTypeTable"
    ],
    "sources": [
      "plugin/js/achievement.js",
      "plugin/js/module-overview.js",
      "plugin/js/v3-table-data.js#achievement",
      "plugin/v3_achievement.html"
    ]
  },
  "v3_dungeon": {
    "tables": [
      "DungeonSeriesTable",
      "DungeonTable",
      "EnemyAttributeTemplateTable",
      "EnemyTable",
      "EnemyTemplateDisplayInfoTable",
      "ItemTable",
      "RewardTable"
    ],
    "sources": [
      "plugin/js/ake-combat-data.js",
      "plugin/js/ake-enemy-renderer.js",
      "plugin/js/ake-stats.js",
      "plugin/js/module-overview.js",
      "plugin/js/v2-dungeon.js",
      "plugin/js/v3-table-data.js#dungeon",
      "plugin/v3_dungeon.html"
    ]
  },
  "v3_item": {
    "tables": [
      "EquipFormulaChainTable",
      "EquipFormulaTable",
      "EquipItemTable",
      "FactoryBuildingTable",
      "FactoryEnvDisplayTable",
      "FactoryHubCraftTable",
      "FactoryMachineCraftGroupTable",
      "FactoryMachineCraftTable",
      "FactoryManualCraftTable",
      "ItemIconCompositeTable",
      "ItemListByShowingTypeTable",
      "ItemListByTypeTable",
      "ItemShowingTypeTable",
      "ItemTable",
      "ItemTypeTable",
      "SpaceshipGrowCabinFormulaTable",
      "SpaceshipGrowCabinSeedFormulaTable",
      "SpaceshipManufactureFormulaTable",
      "SystemJumpTable",
      "UseItemTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v2-item.js",
      "plugin/js/v3-table-data.js#item",
      "plugin/v3_item.html"
    ]
  },
  "v3_shop": {
    "tables": [
      "ActivityShopAdditionalTable",
      "ActivityTable",
      "CashShopGoodsTable",
      "CashShopGroupTable",
      "CashShopHideInGameTable",
      "CashShopHintTextTable",
      "CashShopRechargeTable",
      "CashShopRecommendTable",
      "CashShopTable",
      "DomainDataTable",
      "GachaWeaponPoolContentTable",
      "GachaWeaponPoolTable",
      "GiftpackCashShopGoodsDataTable",
      "ItemTable",
      "RewardTable",
      "ShopChannelDevelopmentTable",
      "ShopGoodsTable",
      "ShopGoodsTagCommonTable",
      "ShopGoodsTagTable",
      "ShopGroupDomainTable",
      "ShopGroupTable",
      "ShopMonthlyPassRewardTable",
      "ShopTable",
      "TimeRangeTable",
      "WeaponBasicTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v3-shop.js",
      "plugin/v3_shop.html"
    ]
  },
  "region": {
    "tables": [
      "DomainDataTable",
      "DomainDepotLevelTable",
      "DomainDepotTable",
      "FactoryGasMinerTable",
      "FactoryMinerTable",
      "FactorySewageTreatPlantStoreTable",
      "ItemTable",
      "KiteStationLevelTable",
      "LevelDescTable",
      "RecycleBinTable",
      "RewardTable",
      "SettlementBasicDataTable",
      "SettlementTagTable",
      "ShopChannelDevelopmentTable",
      "ShopGoodsTable",
      "SimulationTrainingLevelTable",
      "TyphoeaArcheryConst",
      "TyphoeaArcheryLevelTable"
    ],
    "sources": [
      "plugin/js/ake-asset-index.js",
      "plugin/js/region.js",
      "plugin/region.html"
    ]
  },
  "v3_mission": {
    "tables": [
      "CharacterTable",
      "DialogOptionTable",
      "DialogSummaryTable",
      "DialogTextTable",
      "EnemyTemplateDisplayInfoTable",
      "ItemTable",
      "LevelDescTable",
      "MissionExtraInfoTable",
      "MissionTypeInfoTable",
      "NpcTable",
      "RadioTable",
      "RewardTable",
      "SNSChatTable",
      "SNSDialogOptionTable",
      "SNSDialogTable",
      "TextTable"
    ],
    "sources": [
      "plugin/js/mission.js",
      "plugin/js/module-overview.js",
      "plugin/v3_mission.html"
    ],
    "coverage": "MissionRuntimeAsset and its asset index determine mission membership; listed tables provide auxiliary text."
  },
  "v3_activity": {
    "tables": [
      "ActivityArknightsBirthMultiStageTable",
      "ActivityBenefitsTable",
      "ActivityCharTrial",
      "ActivityConditionalMultiStageTable",
      "ActivityConditionalMultiStageTaskConfigTable",
      "ActivityDungeonFightingStageTable",
      "ActivityLevelRewardsTable",
      "ActivityRacingDungeonMilestoneTable",
      "ActivityReflowTable",
      "ActivityTable",
      "ActivityTagTable",
      "ActivityWeeklyTaskMileStoneTable",
      "CheckInRewardTable",
      "DungeonTable",
      "GachaCharPoolTable",
      "GachaWeaponPoolTable",
      "InstructionBook",
      "ItemTable",
      "RewardTable",
      "TimeRangeTable"
    ],
    "sources": [
      "plugin/js/activity.js",
      "plugin/js/module-overview.js",
      "plugin/js/v3-table-data.js#activity",
      "plugin/v3_activity.html"
    ]
  },
  "v3_equip": {
    "tables": [
      "AdventureLevelTable",
      "AttributeFilterTable",
      "AttributeShowConfigTable",
      "EquipConst",
      "EquipEnhanceCostTable",
      "EquipEnhanceGuaranteeTimesRuleTable",
      "EquipFormulaChainTable",
      "EquipFormulaReverseTable",
      "EquipFormulaTable",
      "EquipPackFormulaTable",
      "EquipPackTable",
      "EquipSuitTable",
      "EquipTable",
      "EquipTechConst",
      "ItemTable",
      "RewardTable",
      "ShopChannelDevelopmentTable",
      "ShopGoodsTable",
      "ShopTable",
      "SkillPatchTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v2-equip.js",
      "plugin/js/v3-table-data.js#equip",
      "plugin/v3_equip.html"
    ]
  },
  "v3_enemy": {
    "tables": [
      "DisplayEnemyTypeTable",
      "DistributionInfoTable",
      "EnemyAbilityDescTable",
      "EnemyAttributeTemplateTable",
      "EnemyTable",
      "EnemyTemplateDisplayInfoTable"
    ],
    "sources": [
      "plugin/js/ake-stats.js",
      "plugin/js/module-overview.js",
      "plugin/js/v2-enemy.js",
      "plugin/js/v3-table-data.js#enemy",
      "plugin/v3_enemy.html"
    ]
  },
  "v3_weapon": {
    "tables": [
      "GemTable",
      "GemTagKeyToWeaponTable",
      "ItemTable",
      "SkillPatchTable",
      "WeaponBasicTable",
      "WeaponBreakThroughTemplateTable",
      "WeaponTalentTemplateTable",
      "WeaponUpgradeTemplateSumTable",
      "WeaponUpgradeTemplateTable"
    ],
    "sources": [
      "plugin/js/module-overview.js",
      "plugin/js/v2-weapon.js",
      "plugin/js/v3-table-data.js#weapon",
      "plugin/v3_weapon.html"
    ]
  },
  "v3_character": {
    "tables": [
      "AIBarkText",
      "AudioDialog",
      "CharacterPotentialTable",
      "CharacterTable",
      "CharGrowthTable",
      "CharProfessionTable",
      "CharWpnRecommendTable",
      "DialogTextTable",
      "ItemTable",
      "PotentialTalentEffectTable",
      "ResponsiveDialog",
      "RewardTable",
      "SkillPatchTable",
      "SpaceshipCharSkillTable",
      "SpaceshipSkillTable"
    ],
    "sources": [
      "plugin/js/ake-voice-player.js",
      "plugin/js/module-overview.js",
      "plugin/js/v2-character.js",
      "plugin/js/v3-table-data.js#character",
      "plugin/v3_character.html"
    ]
  }
};
