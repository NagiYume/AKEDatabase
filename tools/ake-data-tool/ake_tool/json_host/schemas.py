"""Dataset routing ported from JsonDataset.kt and GameplayConfigSchemas.kt."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Schema:
    dataset: str
    namespace: str = ''
    name: str = ''
    encoding: str = 'memorypack'
    assembly: str = 'Gameplay.Beyond.dll'
    post: str = ''
    preserve: bool = False
    source: str = ''


SIMPLE = {
    'AIConfig': ('Beyond.Gameplay.AI', 'AIPreloadConfigData', 'managed'),
    'AnimationConfig': ('Beyond.Gameplay.View.Animation', 'AnimationConfigJson'),
    'AtmosphericNpcData': ('Beyond.Gameplay', 'NpcAtmosphericDataTable'),
    'BuffData': ('Beyond.Gameplay.Core', 'BuffData'),
    'CharInteractPerformCfgs': ('Beyond.Gameplay.Core.CharInteractPerform', 'CharInteractPerformRuntimeCfg'),
    'LevelConfig': ('Beyond.Gameplay', 'LevelConfig'),
    'LevelData': ('Beyond.Gameplay', 'LevelData'),
    'LevelMountPoint': ('Beyond.Gameplay', 'LevelMountPointRoot', 'managed'),
    'LevelScriptData': ('Beyond.Gameplay', 'LevelScriptData'),
    'LevelScriptTemplateData': ('Beyond.Gameplay', 'LevelScriptTemplateData'),
    'LipSync': ('Beyond.Gameplay.View.LipSync', 'LipSyncRawDataCriware'),
    'MapConfig': ('Beyond.Gameplay', 'MapConfig', 'managed'),
    'SkillData': ('Beyond.Gameplay.Core', 'SkillData'),
    'SpawnerConfig': ('Beyond.Gameplay', 'SpawnerConfigData'),
}
DATASETS = tuple(sorted((*SIMPLE, 'GameplayConfig', 'GPUISystemConfig', 'Interactive',
                         'LevelGenForRuntime', 'MissionRuntimeAsset', 'NavMesh',
                         'NonGeneratedConfigs', 'NPC', 'SpaceshipCabinData', 'UILevelMapLoadConfig')))


def make(dataset, spec):
    return Schema(dataset, spec[0], spec[1], spec[2] if len(spec) > 2 else 'memorypack')


def route(path):
    parts = path.replace('\\', '/').split('/')
    if len(parts) < 3 or [p.casefold() for p in parts[:2]] != ['data', 'json']:
        return None
    if any(p in ('', '.', '..') for p in parts):
        raise ValueError(f'Invalid VFS path: {path}')
    dataset = next((d for d in DATASETS if d.casefold() == parts[2].casefold()), None)
    relative = parts[3:]
    name = relative[-1].casefold() if relative else ''
    if dataset in SIMPLE and relative:
        return make(dataset, SIMPLE[dataset])
    if dataset == 'GameplayConfig' and len(relative) == 1:
        return GAMEPLAY.get(name)
    if len(parts) == 3:
        if parts[2].casefold() == 'spaceshipcabindata.json':
            return make('SpaceshipCabinData', ('Beyond.Gameplay', 'SpaceshipCabinData', 'managed'))
        return LEGACY.get(parts[2].casefold())
    if parts[2].casefold() == 'interactivedata' and name == 'collections.json' and len(relative) == 1:
        return Schema('Interactive', encoding='raw')
    if dataset == 'Interactive':
        if len(relative) == 1 and name == 'interactivetable.json':
            return make(dataset, ('Beyond.Gameplay', 'InteractiveTable'))
        if len(relative) == 2 and relative[0].casefold() == 'interactivedata':
            return make(dataset, ('Beyond.Gameplay', 'InteractiveTemplateData'))
        if len(relative) == 2 and relative[0].casefold() == 'modelviewstatecontrollerdata':
            return make(dataset, ('Beyond.Gameplay.Core.ModelViewStateController', 'MVSCModelViewStateControllerData'))
    if dataset == 'GPUISystemConfig' and len(relative) == 1 and name.endswith('.json'):
        cls = 'PrefabGroupSerializeData' if name == 'damage_text.json' else 'ExtendedPrefabGroupSerializeData'
        return Schema(dataset, 'Beyond.UI.GPUI', cls, assembly='UI.Beyond.dll')
    if dataset == 'LevelGenForRuntime' and len(relative) == 1:
        cls = {'doodadgrouptable.json': 'DoodadGroupData', 'totalfactoryregions.json': 'LevelTotalFactoryRegionData'}.get(name)
        if cls:
            return make(dataset, ('Beyond.Gameplay', cls, 'managed'))
    if dataset == 'MissionRuntimeAsset' and len(relative) == 1 and name.endswith('.json'):
        cls = 'MissionRuntimeMetaAsset' if name.endswith('_meta.json') else 'MissionRuntimeAsset'
        return make(dataset, ('Beyond.Gameplay', cls, 'managed'))
    if dataset == 'NavMesh' and relative:
        cls = {'lunaarea.json': 'LunaNavMeshAreaContainer', 'navmeshstatecontainer.json': 'NavMeshStateContainer'}.get(name)
        if cls:
            return make(dataset, ('Beyond.Gameplay', cls))
    if dataset == 'NonGeneratedConfigs' and len(relative) == 1:
        cls = {'bamboorafttasktable.json': 'BambooRaftTaskTable', 'goldcoinconfigtable.json': 'GoldCoinConfigTable',
               'matrixshockwavebeatconfigtable.json': 'MatrixShockWaveBeatConfigTable'}.get(name)
        if cls:
            return make(dataset, ('Beyond.Gameplay', cls, 'managed' if cls == 'GoldCoinConfigTable' else 'memorypack'))
    if dataset == 'NPC' and len(relative) >= 2 and relative[0].casefold() == 'montagejson':
        return (Schema(dataset, encoding='raw') if name == 'hashmappath.json'
                else make(dataset, ('Beyond.Montage', 'NPCMontageJson')))
    if dataset == 'NPC' and len(relative) == 2 and relative[0].casefold() == 'prefabinfo':
        return make(dataset, ('Beyond.NPC.Config', 'NPCPrefabManifest' if name == 'manifest.json' else 'NPCPrefabInfo', 'managed'))
    if dataset == 'UILevelMapLoadConfig' and relative:
        cls = 'UILevelMapLoadListConfig' if len(relative) == 1 and name == 'loadlistconfig.json' else 'UILevelMapLoadConfig'
        return make(dataset, ('Beyond.Gameplay', cls, 'managed'))
    return None


# Generated once from the current Kotlin routing catalog; no source/JVM needed at runtime.
GAMEPLAY = {
    # Seed 1.6.4: decrypted VFS payloads are JSON. Types/fields were verified
    # against Gameplay.Beyond.dll, including the dictionary-derived tables.
    'innscenelayouttable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'InnSceneLayoutTableData', 'managed'),
    'paintingscrollconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'PaintingScrollConfigDataTable', 'managed'),
    'poilevelchangeperformbindingtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'PoiLevelChangePerformBindingTable', 'managed'),
    'poilevelchangeperformdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'PoiLevelChangePerformDataTable', 'managed'),
    'ranchconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'RanchConfigTable', 'managed'),
    'subgamemiscconfig.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'SubGameMiscConfig', 'managed'),
    'tempabilityactivateconditiontable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TempAbilityActivateConditionTable', 'managed'),
    'typhoeaarcheryaffixtablev2.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TyphoeaArcheryAffixTableV2', 'managed'),
    'aetherenergylockconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'AetherEnergyLockConfigDataTable', 'memorypack', post='', preserve=False),
    'airwallruntimeconfig.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'AirWallRuntimeConfig', 'managed', post='', preserve=False),
    'atmosphericnpcactiveswitcherdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'NpcAtmosphericActiveSwitcherDataTable', 'managed', post='PostProcess', preserve=False),
    'atmosphericnpcclusterdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'NpcAtmosphericClusterDataTable', 'managed', post='PostProcess', preserve=False),
    'atmosphericnpcswitcherdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay.Core', 'AtmosphericNpcSwitcherDataTable', 'managed', post='', preserve=False),
    'autonameglobalvartable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'AutoNameGlobalVar', 'managed', post='', preserve=False),
    'autonamemapvartable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'AutoNameMapVar', 'managed', post='', preserve=False),
    'builtinblueprinttable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'RemoteFactoryBuiltinBlueprintTable', 'managed', post='', preserve=False),
    'cinematicteleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'memorypack', post='', preserve=False),
    'commonsysteleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'memorypack', post='', preserve=False),
    'dialogidtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'DialogIdTable', 'memorypack', post='', preserve=False),
    'focusmodeinstancetable.json': Schema('GameplayConfig', 'Beyond.Gameplay.Core', 'FocusModeInstanceDataTable', 'managed', post='', preserve=False),
    'forbidbygameplaytagtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'ForbidByGameplayTagTable', 'managed', post='', preserve=False),
    'gamemodetable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'GameModeTable', 'managed', post='', preserve=False),
    'gasminepointteamtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'GasMinePointTeamData', 'managed', post='', preserve=False),
    'gameplaytagpredefinetable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'GameplayTagPredefine', 'managed', post='', preserve=False),
    'guideteleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'memorypack', post='', preserve=False),
    'interactivecurvemoveconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'InteractiveCurveMoveConfigTable', 'managed', post='', preserve=False),
    'kickablegameplayconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'KickableGameplayConfigTable', 'managed', post='', preserve=False),
    'levelbasicinfotable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'LevelBasicInfoTable', 'managed', post='', preserve=False),
    'levelmapmark.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MapMarkDataTable', 'managed', post='', preserve=False),
    'levelscriptteleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'managed', post='', preserve=False),
    'levelshortidtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'ShortEntityIdTable', 'managed', post='', preserve=False),
    'mapbriefinfotable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MapBriefInfoTable', 'managed', post='', preserve=False),
    'mapidtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MapIdTable', 'managed', post='', preserve=False),
    'mapregiontable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MapRegionData', 'managed', post='', preserve=False),
    'mapteleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'memorypack', post='', preserve=False),
    'minepointteamtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MinePointTeamData', 'managed', post='', preserve=False),
    'missionareatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MissionAreaTable', 'managed', post='', preserve=False),
    'matrixshockwavebeatconfigtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MatrixShockWaveBeatConfigTable', 'memorypack', post='', preserve=False),
    'modelradiustable.json': Schema('GameplayConfig', 'Beyond.Gameplay.View', 'ModelRadiusTable', 'managed', post='', preserve=False),
    'modeltable.json': Schema('GameplayConfig', 'Beyond.Gameplay.View', 'ModelTable', 'managed', post='', preserve=False),
    'multitriggertable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MultiTriggerData', 'managed', post='', preserve=False),
    'npcatmosphericdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'NpcAtmosphericDataTable', 'managed', post='', preserve=False),
    'npcproxyexdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay.Core', 'NpcRuntimeProxyExDataTable', 'managed', post='', preserve=True),
    'npcproxytable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'NpcRuntimeProxyDataTable', 'managed', post='', preserve=True),
    'prtslevelbindingtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'PrtsLevelBindingTable', 'managed', post='', preserve=False),
    'relativecameratable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'RelativeCameraConfigTable', 'managed', post='', preserve=False),
    'scripttaskextrainfotable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'LevelScriptTaskExtraInfoTable', 'managed', post='', preserve=False),
    'subgameentityoverridelibrary.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'SubGameEntityOverrideLibrary', 'managed', post='', preserve=False),
    'subgameinstancedatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay.Core', 'SubGameInstanceDataTable', 'managed', post='', preserve=False),
    'storymodeconfig.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'StoryModeConfig', 'managed', post='', preserve=False),
    'teleportperformtable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportPerformTable', 'managed', post='', preserve=False),
    'teleportreasonmaskconfig.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportReasonMaskConfig', 'managed', post='', preserve=False),
    'teleportvalidationdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'TeleportValidationDataTable', 'memorypack', post='', preserve=False),
    'upgradeperformdatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'UpgradePerformDataTable', 'managed', post='', preserve=False),
    'worldentityregistry.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'WorldEntityRegistry', 'managed', post='PostProcess', preserve=False),
}
LEGACY = {
    'gameplayconfigmissionareatable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'MissionAreaTable', 'managed', source='Data/Json/GameplayConfig/MissionAreaTable.json'),
    'gameplayconfignpcproxytable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'NpcRuntimeProxyDataTable', 'managed'),
    'gameplayconfigscripttaskextrainfotable.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'LevelScriptTaskExtraInfoTable', 'managed'),
    'gameplayconfigsubgameinstancedatatable.json': Schema('GameplayConfig', 'Beyond.Gameplay.Core', 'SubGameInstanceDataTable'),
    'gameplayconfigworldentityregistry.json': Schema('GameplayConfig', 'Beyond.Gameplay', 'WorldEntityRegistry', 'managed', source='Data/Json/GameplayConfig/WorldEntityRegistry.json'),
}
