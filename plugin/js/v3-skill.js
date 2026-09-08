(function () {
    'use strict';

    const t = window.akeI18n?.scope?.('modules.combat')
        || ((key, params, fallback) => fallback ?? key);
    const commonT = window.akeI18n?.scope?.('common')
        || ((key, params, fallback) => fallback ?? key);
    const MODULE_ID = 'v3_skill';
    const MODULE_TITLE = () => t('title', null, '战斗');
    const OTHER_ID = '__other_combat_entities__';
    const HIDDEN_ENTITY_PATTERN = /^(?:chr_9000_endmin|eny_0057_dog)(?:_|$)/i;
    const root = document.getElementById('combatv3Module');
    if (!root || !window.AKEV3) return;

    window.__akeV3SkillController?.destroy?.();

    const elements = {
        search: document.getElementById('combatv3SearchInput'),
        mobileSearch: document.getElementById('combatv3MobileSearchInput'),
        meta: document.getElementById('combatv3ListMeta'),
        list: document.getElementById('combatv3GroupList'),
        detail: document.getElementById('combatv3Detail'),
        mobileButton: document.getElementById('combatv3MobileListButton'),
        mobileOverlay: document.getElementById('combatv3MobileOverlay'),
        mobilePanel: document.getElementById('combatv3MobilePanel'),
        mobileClose: document.getElementById('combatv3MobileClose'),
        mobileList: document.getElementById('combatv3MobileList'),
        tooltip: document.getElementById('combatv3TimelineTooltip')
    };
    if (!elements.list || !elements.detail) return;

    const initialParams = new URLSearchParams(window.location.search);
    const initialLevel = Number(initialParams.get('level')) || null;
    const pendingDeepLink = parseDeepLink(window.__deepLinkId || '');
    window.__deepLinkId = null;
    root.dataset.moduleId = MODULE_ID;
    root.dataset.moduleTitle = MODULE_TITLE();

    const state = {
        rawManifest: [],
        manifest: [],
        tables: null,
        directory: [],
        skillIndex: new Map(),
        expandedCharacters: new Set(),
        expandedGroups: new Set(),
        query: '',
        activeSkillId: '',
        activeOwner: null,
        level: pendingDeepLink.level || initialLevel,
        currentItem: null,
        currentData: null,
        currentPatch: null,
        analysis: emptyAnalysis(),
        analysisSource: null,
        activeTab: 'timeline',
        showPerformance: false,
        timelineEvents: [],
        skillCache: new Map(),
        loadToken: 0,
        detailToken: 0,
        pendingDeepId: pendingDeepLink.id
    };

    const GROUP_TYPE_LABELS = {
        0: ['enums.groupTypes.normalAttack', '普通攻击'],
        1: ['enums.groupTypes.combatSkill', '战技'],
        2: ['enums.groupTypes.ultimate', '终结技'],
        3: ['enums.groupTypes.comboSkill', '连携技']
    };
    const ATTACK_ATTRIBUTE_LABELS = {
        physical: ['enums.attackAttributes.physical', '物理伤害'],
        real: ['enums.attackAttributes.real', '真实伤害'],
        fire: ['enums.attackAttributes.fire', '灼热伤害'],
        pulse: ['enums.attackAttributes.pulse', '电磁伤害'],
        cryst: ['enums.attackAttributes.cryst', '寒冷伤害'],
        crystal: ['enums.attackAttributes.crystal', '寒冷伤害'],
        lifedrain: ['enums.attackAttributes.lifedrain', '吸血伤害'],
        natural: ['enums.attackAttributes.natural', '自然伤害'],
        ether: ['enums.attackAttributes.ether', '超域伤害']
    };
    const ENEMY_RARITY_BY_DISPLAY_TYPE = { 0: 2, 3: 3, 1: 4, 4: 5, 2: 6 };
    const BASIC_LABELS = {
        durationFrame: ['metrics.durationFrame', '动作总时长'], durationFrames: ['metrics.durationFrame', '动作总时长'], totalFrames: ['metrics.durationFrame', '动作总时长'],
        exclusiveFrame: ['metrics.exclusiveFrame', '排他期'], exclusiveFrames: ['metrics.exclusiveFrame', '排他期'], offsetRecordFrame: ['metrics.offsetRecordFrame', '续段记录帧'],
        offsetFrame: ['metrics.offsetRecordFrame', '续段记录帧'], offsetTime: ['metrics.offsetTime', '续段保留时间'], startupFrame: ['metrics.startupFrame', '起手'], startupFrames: ['metrics.startupFrame', '起手'],
        firstHitFrame: ['metrics.firstHitFrame', '首段命中'], lastHitFrame: ['metrics.lastHitFrame', '末段命中'], recoveryFrame: ['metrics.recoveryFrame', '收招'], recoveryFrames: ['metrics.recoveryFrame', '收招'],
        cancelFrame: ['metrics.cancelFrame', '可取消时点'], cancelFrames: ['metrics.cancelFrame', '可取消时点'], cooldown: ['metrics.cooldown', '冷却'], cooldownTime: ['metrics.cooldown', '冷却'],
        hitCount: ['metrics.hitCount', '命中段数'], totalDamage: ['metrics.totalDamage', '总伤害倍率'], damage: ['metrics.damage', '伤害倍率'], poiseDamage: ['metrics.poiseDamage', '破韧'],
        toughnessDamage: ['metrics.poiseDamage', '破韧'], atb: ['metrics.atb', '失衡值'], atbValue: ['metrics.atb', '失衡值'], superArmor: ['metrics.superArmor', '抗打断'],
        antiInterrupt: ['metrics.superArmor', '抗打断'], moveDistance: ['metrics.moveDistance', '位移距离'], displacement: ['metrics.moveDistance', '位移距离'],
        invulnerableFrame: ['metrics.invulnerableFrame', '无敌时间'], invulnerableFrames: ['metrics.invulnerableFrame', '无敌时间']
    };
    const WINDOW_LABELS = {
        damage: ['windows.damage', '命中'], superArmor: ['windows.superArmor', '抗打断'], buffSuperArmor: ['windows.buffSuperArmor', '霸体 Buff'], damageImmune: ['windows.damageImmune', '无敌'],
        allowNextSkill: ['windows.allowNextSkill', '允许接续'], comboCache: ['windows.comboCache', '输入缓存'], canInterrupt: ['windows.canInterrupt', '可取消'], canDash: ['windows.canDash', '可闪避取消'],
        blockMoveInterrupt: ['windows.blockMoveInterrupt', '禁止移动打断'], hitStop: ['windows.hitStop', '顿帧'], timeDilation: ['windows.timeDilation', '时间膨胀'], movement: ['windows.movement', '位移'],
        exclusive: ['windows.exclusive', '排他期'], offsetRecord: ['windows.offsetRecord', '续段记录帧'], costCommit: ['windows.costCommit', '资源提交帧']
    };
    const ACTION_LABELS = Object.freeze({
        AchieveSpecialGameEventAction: ['timeline.actions.AchieveSpecialGameEventAction', '达成特殊游戏事件'],
        AddAIMarkerAction: ['timeline.actions.AddAIMarkerAction', '添加 AI 标记'],
        AddCameraControlStateAction: ['timeline.actions.AddCameraControlStateAction', '添加镜头控制状态'],
        AddDynamicCcsAction: ['timeline.actions.AddDynamicCcsAction', '添加动态镜头控制状态'],
        AddDynamicNavmeshObstacle: ['timeline.actions.AddDynamicNavmeshObstacle', '添加动态导航障碍'],
        AddGlobalCDTimer: ['timeline.actions.AddGlobalCDTimer', '添加全局冷却计时'],
        AddTagAction: ['timeline.actions.AddTagAction', '添加标签'],
        AddTagToEntities: ['timeline.actions.AddTagToEntities', '为实体添加标签'],
        AirborneAction: ['timeline.actions.AirborneAction', '浮空'],
        AllowNextSkillAction: ['timeline.actions.AllowNextSkillAction', '开放接续'],
        AnimatedCameraAction: ['timeline.actions.AnimatedCameraAction', '播放演出镜头'],
        AnimatorAimOffsetAction: ['timeline.actions.AnimatorAimOffsetAction', '设置瞄准偏移'],
        AnimEventReceiver: ['timeline.actions.AnimEventReceiver', '监听动画事件'],
        ApplyArmor: ['timeline.actions.ApplyArmor', '应用护甲'],
        AuraAction: ['timeline.actions.AuraAction', '创建领域'],
        BlightMiasmaToleranceZero: ['timeline.actions.BlightMiasmaToleranceZero', '瘴气耐受归零'],
        BlockMoveInterruptSkill: ['timeline.actions.BlockMoveInterruptSkill', '禁止移动打断'],
        BlowOffAction: ['timeline.actions.BlowOffAction', '击退'],
        BlowOffCharacterAction: ['timeline.actions.BlowOffCharacterAction', '击退角色'],
        BlowOffEnemyAction: ['timeline.actions.BlowOffEnemyAction', '击退敌人'],
        BoneAttachAction: ['timeline.actions.BoneAttachAction', '骨骼挂接'],
        BreakInteractiveAction: ['timeline.actions.BreakInteractiveAction', '破坏交互物'],
        BroadcastAlertToCharactersAction: ['timeline.actions.BroadcastAlertToCharactersAction', '广播角色警戒'],
        CameraImpulseAction: ['timeline.actions.CameraImpulseAction', '镜头震动'],
        CameraRotateAction: ['timeline.actions.CameraRotateAction', '镜头旋转'],
        CastSkill: ['timeline.actions.CastSkill', '施放子技能'],
        ChangeSkillAction: ['timeline.actions.ChangeSkillAction', '替换技能'],
        ChangeSpecificLayerAction: ['timeline.actions.ChangeSpecificLayerAction', '切换指定层'],
        ChannelingAction: ['timeline.actions.ChannelingAction', '持续引导'],
        ChannelingActionV2: ['timeline.actions.ChannelingActionV2', '持续引导'],
        ChannelingCastingAction: ['timeline.actions.ChannelingCastingAction', '引导施法'],
        ChannelingDamageAction: ['timeline.actions.ChannelingDamageAction', '持续伤害结算'],
        CharAlertJumpAction: ['timeline.actions.CharAlertJumpAction', '角色警戒跳跃'],
        CharFollowAction: ['timeline.actions.CharFollowAction', '角色跟随'],
        CharHurtAnimAction: ['timeline.actions.CharHurtAnimAction', '角色受击动画'],
        CharWeaponAnimationAction: ['timeline.actions.CharWeaponAnimationAction', '武器动画'],
        CharWeaponVisibleAction: ['timeline.actions.CharWeaponVisibleAction', '武器显隐'],
        CheckAbilityEntityCurDuration: ['timeline.actions.CheckAbilityEntityCurDuration', '检查能力实体剩余时间'],
        CheckAllowNormalSkillHighlight: ['timeline.actions.CheckAllowNormalSkillHighlight', '检查普通技能高亮条件'],
        CheckAttackRangeType: ['timeline.actions.CheckAttackRangeType', '检查攻击距离类型'],
        CheckBuffIdInContext: ['timeline.actions.CheckBuffIdInContext', '检查上下文 Buff'],
        CheckBuffIdInContextAdvanced: ['timeline.actions.CheckBuffIdInContextAdvanced', '高级检查上下文 Buff'],
        CheckBuffStackNum: ['timeline.actions.CheckBuffStackNum', '检查 Buff 层数'],
        CheckBuffStackNumAdvanced: ['timeline.actions.CheckBuffStackNumAdvanced', '高级检查 Buff 层数'],
        CheckBuffStackNumByTag: ['timeline.actions.CheckBuffStackNumByTag', '按标签检查 Buff 层数'],
        CheckComboSkillCameraAlphaSetting: ['timeline.actions.CheckComboSkillCameraAlphaSetting', '检查连携技镜头透明度'],
        CheckConsumeBuffLayer: ['timeline.actions.CheckConsumeBuffLayer', '检查消耗 Buff 层数'],
        CheckDamageDecorateMask: ['timeline.actions.CheckDamageDecorateMask', '检查伤害修饰掩码'],
        CheckDamageType: ['timeline.actions.CheckDamageType', '检查伤害类型'],
        CheckDamageTypeMask: ['timeline.actions.CheckDamageTypeMask', '检查伤害类型掩码'],
        CheckDistanceCondition: ['timeline.actions.CheckDistanceCondition', '检查距离'],
        CheckEnemyRank: ['timeline.actions.CheckEnemyRank', '检查敌人阶级'],
        CheckEntityNum: ['timeline.actions.CheckEntityNum', '检查实体数量'],
        CheckGlobalCDTimerAction: ['timeline.actions.CheckGlobalCDTimerAction', '检查全局冷却'],
        CheckHasMoveInput: ['timeline.actions.CheckHasMoveInput', '检查移动输入'],
        CheckHealTag: ['timeline.actions.CheckHealTag', '检查治疗标签'],
        CheckHitColliderOptions: ['timeline.actions.CheckHitColliderOptions', '检查命中碰撞选项'],
        CheckHp: ['timeline.actions.CheckHp', '检查生命值'],
        CheckIsCriticalDamage: ['timeline.actions.CheckIsCriticalDamage', '检查是否暴击'],
        CheckMainCharacterCondition: ['timeline.actions.CheckMainCharacterCondition', '检查主控角色'],
        CheckObjectTypeMatch: ['timeline.actions.CheckObjectTypeMatch', '检查对象类型'],
        CheckObtainAtbType: ['timeline.actions.CheckObtainAtbType', '检查 ATB 获取方式'],
        CheckOriginSkillType: ['timeline.actions.CheckOriginSkillType', '检查来源技能类型'],
        CheckOverHeal: ['timeline.actions.CheckOverHeal', '检查溢出治疗'],
        CheckPartTagMatch: ['timeline.actions.CheckPartTagMatch', '检查部件标签'],
        CheckPerfectDodgeDirection: ['timeline.actions.CheckPerfectDodgeDirection', '检查完美闪避方向'],
        CheckPhysicalInflictionType: ['timeline.actions.CheckPhysicalInflictionType', '检查物理附着类型'],
        CheckPoiseValue: ['timeline.actions.CheckPoiseValue', '检查韧性值'],
        CheckSkillCameraMotionFree: ['timeline.actions.CheckSkillCameraMotionFree', '检查技能镜头自由移动'],
        CheckSkillHasHit: ['timeline.actions.CheckSkillHasHit', '检查技能是否命中'],
        CheckSkillType: ['timeline.actions.CheckSkillType', '检查技能类型'],
        CheckSpellInflictionType: ['timeline.actions.CheckSpellInflictionType', '检查元素附着类型'],
        CheckSquadInFight: ['timeline.actions.CheckSquadInFight', '检查小队战斗状态'],
        CheckSuperArmor: ['timeline.actions.CheckSuperArmor', '检查抗打断'],
        CheckTagMatch: ['timeline.actions.CheckTagMatch', '检查标签匹配'],
        CheckTargetAngle: ['timeline.actions.CheckTargetAngle', '检查目标夹角'],
        CheckTargetContains: ['timeline.actions.CheckTargetContains', '检查目标包含关系'],
        CheckTargetInScreen: ['timeline.actions.CheckTargetInScreen', '检查目标是否在屏幕内'],
        CheckTargetsEqual: ['timeline.actions.CheckTargetsEqual', '检查目标相同'],
        CheckTimedMarkerCondition: ['timeline.actions.CheckTimedMarkerCondition', '检查计时标记'],
        CheckTwoDirectionAngle: ['timeline.actions.CheckTwoDirectionAngle', '检查双方向夹角'],
        CheckWeaponTypeCondition: ['timeline.actions.CheckWeaponTypeCondition', '检查武器类型'],
        ClearProjectileAction: ['timeline.actions.ClearProjectileAction', '清除投射物'],
        ComboAction: ['timeline.actions.ComboAction', '执行连段'],
        ComboCacheAction: ['timeline.actions.ComboCacheAction', '输入缓存'],
        CommandToCharactersAction: ['timeline.actions.CommandToCharactersAction', '向角色下达指令'],
        CompareDeckAttr: ['timeline.actions.CompareDeckAttr', '比较卡组属性'],
        CompareFloat: ['timeline.actions.CompareFloat', '比较数值'],
        CompareString: ['timeline.actions.CompareString', '比较字符串'],
        ContinuousFindTargetAction: ['timeline.actions.ContinuousFindTargetAction', '持续查找目标'],
        ContinuousSetAnimTimeScale: ['timeline.actions.ContinuousSetAnimTimeScale', '持续设置动画速度'],
        ConvertToTargetContext: ['timeline.actions.ConvertToTargetContext', '转换目标上下文'],
        CreateAdditionalBattleShape: ['timeline.actions.CreateAdditionalBattleShape', '创建附加战斗形状'],
        CreateBuffAction: ['timeline.actions.CreateBuffAction', '创建 Buff'],
        CreateBuffAttachingSkill: ['timeline.actions.CreateBuffAttachingSkill', '创建附属技能 Buff'],
        CreateGlobalBuffAction: ['timeline.actions.CreateGlobalBuffAction', '创建全局 Buff'],
        CreateTimedMarker: ['timeline.actions.CreateTimedMarker', '创建计时标记'],
        CrushAction: ['timeline.actions.CrushAction', '压倒'],
        CurveEvaluateFloat: ['timeline.actions.CurveEvaluateFloat', '曲线取值'],
        CustomRootMotionAction: ['timeline.actions.CustomRootMotionAction', '自定义根运动'],
        DamageAction: ['timeline.actions.DamageAction', '伤害结算'],
        DebugPrintAction: ['timeline.actions.DebugPrintAction', '调试输出'],
        DiceFloat: ['timeline.actions.DiceFloat', '随机浮点数'],
        DisableMoveColliderAction: ['timeline.actions.DisableMoveColliderAction', '禁用移动碰撞体'],
        DisableRootMotionAction: ['timeline.actions.DisableRootMotionAction', '禁用根运动'],
        DispelAction: ['timeline.actions.DispelAction', '驱散'],
        DoOnceAction: ['timeline.actions.DoOnceAction', '仅执行一次'],
        EffectAction: ['timeline.actions.EffectAction', '播放特效'],
        EffectControlAction: ['timeline.actions.EffectControlAction', '控制特效'],
        EffectFindTargetAction: ['timeline.actions.EffectFindTargetAction', '按特效查找目标'],
        EliteBackSwingBeHit: ['timeline.actions.EliteBackSwingBeHit', '精英后摇受击'],
        EnablePartsAction: ['timeline.actions.EnablePartsAction', '切换部件'],
        EnemyHurtAnimAction: ['timeline.actions.EnemyHurtAnimAction', '敌人受击动画'],
        EnemyWarningAction: ['timeline.actions.EnemyWarningAction', '敌人攻击预警'],
        EventListenerAction: ['timeline.actions.EventListenerAction', '监听事件'],
        ExtendBuffAction: ['timeline.actions.ExtendBuffAction', '延长 Buff'],
        FacBuildingPlayAnimationAction: ['timeline.actions.FacBuildingPlayAnimationAction', '建筑播放动画'],
        FindTargetAction: ['timeline.actions.FindTargetAction', '查找目标'],
        FinishAngryOnEnd: ['timeline.actions.FinishAngryOnEnd', '结束时解除愤怒'],
        FinishBuffAction: ['timeline.actions.FinishBuffAction', '移除 Buff'],
        FinishBuffAdvanced: ['timeline.actions.FinishBuffAdvanced', '高级移除 Buff'],
        FinishBuffByTag: ['timeline.actions.FinishBuffByTag', '按标签移除 Buff'],
        FinishOwnerAction: ['timeline.actions.FinishOwnerAction', '销毁持有者'],
        ForceHideHeadBarAction: ['timeline.actions.ForceHideHeadBarAction', '强制隐藏血条'],
        ForceSpellStatusAction: ['timeline.actions.ForceSpellStatusAction', '强制元素状态'],
        ForEachAction: ['timeline.actions.ForEachAction', '遍历目标'],
        FractureAction: ['timeline.actions.FractureAction', '碎甲'],
        GainBreakingAttackAtb: ['timeline.actions.GainBreakingAttackAtb', '增加破防失衡值'],
        GetAITransDataAction: ['timeline.actions.GetAITransDataAction', '读取 AI 位姿'],
        GetPatrolTeleportPos: ['timeline.actions.GetPatrolTeleportPos', '获取巡逻传送位置'],
        GetTargetBuffBBAdvanced: ['timeline.actions.GetTargetBuffBBAdvanced', '读取目标 Buff 黑板'],
        HealAction: ['timeline.actions.HealAction', '治疗结算'],
        HideUIAction: ['timeline.actions.HideUIAction', '隐藏界面'],
        HitStopAction: ['timeline.actions.HitStopAction', '顿帧'],
        HurtAnimAction: ['timeline.actions.HurtAnimAction', '受击动画'],
        IfElseAction: ['timeline.actions.IfElseAction', '条件分支'],
        IgniteAction: ['timeline.actions.IgniteAction', '点燃'],
        IgnoreModelIntervalCheck: ['timeline.actions.IgnoreModelIntervalCheck', '忽略模型间隔检测'],
        InheritBuffAction: ['timeline.actions.InheritBuffAction', '继承 Buff'],
        InheritCCSAction: ['timeline.actions.InheritCCSAction', '继承镜头控制状态'],
        InterruptAction: ['timeline.actions.InterruptAction', '施加打断'],
        InterruptCurSkillAction: ['timeline.actions.InterruptCurSkillAction', '中断当前技能'],
        IntResourceHpCheckAction: ['timeline.actions.IntResourceHpCheckAction', '交互资源生命检查'],
        IntResourceOnHpZeroAction: ['timeline.actions.IntResourceOnHpZeroAction', '交互资源生命归零'],
        InverseSpellInfliction: ['timeline.actions.InverseSpellInfliction', '反向元素附着'],
        JumpToAction: ['timeline.actions.JumpToAction', '跳转到指定帧'],
        JumpToTargetAction: ['timeline.actions.JumpToTargetAction', '跳向目标'],
        KnockDownAction: ['timeline.actions.KnockDownAction', '击倒'],
        LaunchProjectile: ['timeline.actions.LaunchProjectile', '发射投射物'],
        LaunchUpwardAction: ['timeline.actions.LaunchUpwardAction', '击飞'],
        LockCameraAimAction: ['timeline.actions.LockCameraAimAction', '锁定瞄准镜头'],
        LogAction: ['timeline.actions.LogAction', '日志输出'],
        LookAtAction: ['timeline.actions.LookAtAction', '朝向目标'],
        MarkCanDash: ['timeline.actions.MarkCanDash', '开放闪避取消'],
        MarkCanInterrupt: ['timeline.actions.MarkCanInterrupt', '开放取消'],
        MergeTargetAction: ['timeline.actions.MergeTargetAction', '合并目标'],
        ModifyCameraLockPointAction: ['timeline.actions.ModifyCameraLockPointAction', '修改镜头锁定点'],
        ModifyCollectedBuffBbValue: ['timeline.actions.ModifyCollectedBuffBbValue', '修改已收集 Buff 黑板值'],
        ModifyDynamicBlackboard: ['timeline.actions.ModifyDynamicBlackboard', '修改动态黑板'],
        ModifyWeaponMountPoint: ['timeline.actions.ModifyWeaponMountPoint', '修改武器挂点'],
        MoveToAction: ['timeline.actions.MoveToAction', '移动'],
        MoveToDirectionAction: ['timeline.actions.MoveToDirectionAction', '向指定方向移动'],
        MoveToLocationAction: ['timeline.actions.MoveToLocationAction', '移动到位置'],
        MoveToSlotAction: ['timeline.actions.MoveToSlotAction', '移动到站位'],
        MoveToTargetAction: ['timeline.actions.MoveToTargetAction', '移动到目标'],
        NotNextCheckAction: ['timeline.actions.NotNextCheckAction', '反转下一项检查'],
        ObtainCostAction: ['timeline.actions.ObtainCostAction', '获取资源'],
        ObtainUspInNormalSkill: ['timeline.actions.ObtainUspInNormalSkill', '普通战技获取 USP'],
        OrConditionAction: ['timeline.actions.OrConditionAction', '或条件'],
        OverrideBornPosition: ['timeline.actions.OverrideBornPosition', '覆盖出生位置'],
        OverrideCameraFollowAction: ['timeline.actions.OverrideCameraFollowAction', '覆盖镜头跟随'],
        PatrolRefreshCheckPoint: ['timeline.actions.PatrolRefreshCheckPoint', '刷新巡逻检查点'],
        PauseComboSkillTime: ['timeline.actions.PauseComboSkillTime', '暂停连携技计时'],
        PhysicsCastAction: ['timeline.actions.PhysicsCastAction', '物理投射检测'],
        PickTargetAction: ['timeline.actions.PickTargetAction', '选取目标'],
        PlayAnimationAction: ['timeline.actions.PlayAnimationAction', '播放动画'],
        PlayAnimationWithStep: ['timeline.actions.PlayAnimationWithStep', '分段播放动画'],
        PlayNormalDashAnimAction: ['timeline.actions.PlayNormalDashAnimAction', '播放普通冲刺动画'],
        PlayPerfectDodgeAnim: ['timeline.actions.PlayPerfectDodgeAnim', '播放完美闪避动画'],
        PlaySoundAction: ['timeline.actions.PlaySoundAction', '播放音效'],
        Probablity: ['timeline.actions.Probablity', '概率判断'],
        PullAction: ['timeline.actions.PullAction', '牵引'],
        PushAction: ['timeline.actions.PushAction', '推动'],
        PushBackAction: ['timeline.actions.PushBackAction', '推开'],
        RandomAction: ['timeline.actions.RandomAction', '生成随机值'],
        RayCastEffectAction: ['timeline.actions.RayCastEffectAction', '射线检测特效'],
        ReadSkillSettingData: ['timeline.actions.ReadSkillSettingData', '读取技能设置'],
        ReceiveMoveInputAction: ['timeline.actions.ReceiveMoveInputAction', '接收移动输入'],
        RecoverPoiseAction: ['timeline.actions.RecoverPoiseAction', '恢复韧性'],
        RemoveAIMarkerAction: ['timeline.actions.RemoveAIMarkerAction', '移除 AI 标记'],
        RepeatAction: ['timeline.actions.RepeatAction', '重复执行'],
        SaveAtbObtainValue: ['timeline.actions.SaveAtbObtainValue', '保存 ATB 获取值'],
        SaveBuffStackNumAdvanced: ['timeline.actions.SaveBuffStackNumAdvanced', '高级保存 Buff 层数'],
        SaveBuffStackNumByTag: ['timeline.actions.SaveBuffStackNumByTag', '按标签保存 Buff 层数'],
        SaveCameraAngle: ['timeline.actions.SaveCameraAngle', '保存镜头角度'],
        SaveCharTypeId: ['timeline.actions.SaveCharTypeId', '保存角色类型 ID'],
        SaveTargetDistanceAction: ['timeline.actions.SaveTargetDistanceAction', '保存目标距离'],
        SaveTwoDirectionAngle: ['timeline.actions.SaveTwoDirectionAngle', '保存双方向夹角'],
        SaveValueFromAIBlackboard: ['timeline.actions.SaveValueFromAIBlackboard', '保存 AI 黑板值'],
        SelfRotateAction: ['timeline.actions.SelfRotateAction', '自身转向'],
        SendBattleSignalToLevel: ['timeline.actions.SendBattleSignalToLevel', '向关卡发送战斗信号'],
        SetAbilityEntityDuration: ['timeline.actions.SetAbilityEntityDuration', '设置能力实体持续时间'],
        SetAbilityEntityTarget: ['timeline.actions.SetAbilityEntityTarget', '设置能力实体目标'],
        SetAbilityEntityToMainChar: ['timeline.actions.SetAbilityEntityToMainChar', '将能力实体关联至主控角色'],
        SetAnimatorParamAction: ['timeline.actions.SetAnimatorParamAction', '设置动画参数'],
        SetIgnoreGlobalTimeScaleAction: ['timeline.actions.SetIgnoreGlobalTimeScaleAction', '设置忽略全局时间缩放'],
        SetMultiTimesWeakness: ['timeline.actions.SetMultiTimesWeakness', '设置多段弱点'],
        SetSkillCdAtOnce: ['timeline.actions.SetSkillCdAtOnce', '立即设置技能冷却'],
        SetSuperArmorAction: ['timeline.actions.SetSuperArmorAction', '设置抗打断'],
        SetWeaknessAction: ['timeline.actions.SetWeaknessAction', '设置弱点'],
        ShowComboSkillUI: ['timeline.actions.ShowComboSkillUI', '显示连携技界面'],
        ShowHideActorAction: ['timeline.actions.ShowHideActorAction', '角色显隐'],
        SimpleCalcBBAction: ['timeline.actions.SimpleCalcBBAction', '黑板数值计算'],
        SkillAIMoveAction: ['timeline.actions.SkillAIMoveAction', '技能 AI 移动'],
        SlowAction: ['timeline.actions.SlowAction', '减速'],
        SnapToTargetWithRangeAction: ['timeline.actions.SnapToTargetWithRangeAction', '贴近目标'],
        SpawnAbilityEntity: ['timeline.actions.SpawnAbilityEntity', '生成能力实体'],
        SpawnEnemyAction: ['timeline.actions.SpawnEnemyAction', '生成敌人'],
        SpawnInteractiveGoldCoin: ['timeline.actions.SpawnInteractiveGoldCoin', '生成交互金币'],
        SpellInfliction: ['timeline.actions.SpellInfliction', '元素附着'],
        SpellInflictionOnChar: ['timeline.actions.SpellInflictionOnChar', '对角色施加元素附着'],
        StoreAttributeValue: ['timeline.actions.StoreAttributeValue', '保存属性值'],
        StoreCurSkillExecuteFrame: ['timeline.actions.StoreCurSkillExecuteFrame', '保存当前技能执行帧'],
        SwitchAction: ['timeline.actions.SwitchAction', '多分支选择'],
        SwitchModeAction: ['timeline.actions.SwitchModeAction', '切换模式'],
        TakeDownAction: ['timeline.actions.TakeDownAction', '压制击倒'],
        TargetPostProcessorAction: ['timeline.actions.TargetPostProcessorAction', '目标后处理'],
        TeleportAction: ['timeline.actions.TeleportAction', '瞬移'],
        TeleportPosSelectAction: ['timeline.actions.TeleportPosSelectAction', '选择瞬移位置'],
        TemporaryUnlockAction: ['timeline.actions.TemporaryUnlockAction', '临时解除锁定'],
        ThrowPickupItemAction: ['timeline.actions.ThrowPickupItemAction', '投掷拾取物'],
        ThrowPickupItemStartAction: ['timeline.actions.ThrowPickupItemStartAction', '开始投掷拾取物'],
        TickIntervalAction: ['timeline.actions.TickIntervalAction', '间隔触发'],
        TickIntervalActionV2: ['timeline.actions.TickIntervalActionV2', '间隔触发'],
        TimeDilationAction: ['timeline.actions.TimeDilationAction', '时间膨胀'],
        TogglableAction: ['timeline.actions.TogglableAction', '条件开关动作'],
        ToggleMeshAction: ['timeline.actions.ToggleMeshAction', '切换模型网格'],
        TriggerComboSkillAction: ['timeline.actions.TriggerComboSkillAction', '触发连携技'],
        TriggerCustomAbilityEvent: ['timeline.actions.TriggerCustomAbilityEvent', '触发自定义能力事件'],
        TryToTeleportSquadAction: ['timeline.actions.TryToTeleportSquadAction', '尝试传送小队'],
        UltimateShowAction: ['timeline.actions.UltimateShowAction', '终结技演出'],
        UltimateTimeAction: ['timeline.actions.UltimateTimeAction', '终结技时间控制'],
        VoiceInterruptAction: ['timeline.actions.VoiceInterruptAction', '中断语音'],
        VoiceTriggerAction: ['timeline.actions.VoiceTriggerAction', '触发语音'],
        WaterDroneHitAction: ['timeline.actions.WaterDroneHitAction', '水无人机命中'],
        UnknownAction: ['timeline.actions.UnknownAction', '未知动作']
    });
    const TIMELINE_DETAIL_LABELS = Object.freeze({
        unitCount: ['timeline.fields.unitCount', '结算单元数'],
        targetSettings: ['timeline.fields.targetSettings', '目标'],
        targetGroupKey: ['timeline.fields.targetGroupKey', '目标组'],
        sourceSettings: ['timeline.fields.sourceSettings', '来源'],
        source: ['timeline.fields.source', '来源'],
        actionSource: ['timeline.fields.actionSource', '动作来源'],
        target: ['timeline.fields.target', '目标'],
        attacker: ['timeline.fields.attacker', '攻击者'],
        attackerTargetSettings: ['timeline.fields.attackerTargetSettings', '攻击者'],
        defender: ['timeline.fields.defender', '承受者'],
        owner: ['timeline.fields.owner', '持有者'],
        skillOwner: ['timeline.fields.skillOwner', '技能持有者'],
        buffOwner: ['timeline.fields.buffOwner', 'Buff 持有者'],
        healer: ['timeline.fields.healer', '治疗者'],
        caster: ['timeline.fields.caster', '施放者'],
        auraRoot: ['timeline.fields.auraRoot', '领域中心'],
        calculationTarget: ['timeline.fields.calculationTarget', '计算目标'],
        contextKey: ['timeline.fields.contextKey', '上下文键'],
        targetContextKey: ['timeline.fields.targetContextKey', '目标上下文键'],
        targetSource: ['timeline.fields.targetSource', '目标来源'],
        selectorData: ['timeline.fields.selectorData', '目标选择器'],
        selectorOwner: ['timeline.fields.selectorOwner', '选择器持有者'],
        selectorDirection: ['timeline.fields.selectorDirection', '选择方向'],
        center: ['timeline.fields.center', '中心'],
        centerContextKey: ['timeline.fields.centerContextKey', '中心上下文'],
        saveToContext: ['timeline.fields.saveToContext', '保存到上下文'],
        excludeTarget: ['timeline.fields.excludeTarget', '排除目标'],
        targets: ['timeline.fields.targets', '目标列表'],
        skillId: ['timeline.fields.skillId', '技能'],
        targetSkillId: ['timeline.fields.targetSkillId', '目标技能'],
        allowedSkillIdList: ['timeline.fields.allowedSkillIdList', '可接续技能'],
        allowedSkillIds: ['timeline.fields.allowedSkillIds', '可接续技能'],
        projectileId: ['timeline.fields.projectileId', '投射物'],
        projectileSkillId: ['timeline.fields.projectileSkillId', '命中技能'],
        skillIdOnBlock: ['timeline.fields.skillIdOnBlock', '格挡技能'],
        skillIdOnReach: ['timeline.fields.skillIdOnReach', '到达技能'],
        skillIdOnFinish: ['timeline.fields.skillIdOnFinish', '结束技能'],
        linkedSkills: ['timeline.fields.linkedSkills', '关联技能'],
        abilityEntityId: ['timeline.fields.abilityEntityId', '能力实体'],
        abilityEntitySkillId: ['timeline.fields.abilityEntitySkillId', '能力实体技能'],
        enemyId: ['timeline.fields.enemyId', '敌人'],
        buffId: ['timeline.fields.buffId', 'Buff'],
        buffIds: ['timeline.fields.buffIds', 'Buff 列表'],
        buffIdList: ['timeline.fields.buffIdList', 'Buff 列表'],
        buffs: ['timeline.fields.buffs', 'Buff'],
        values: ['timeline.fields.values', '赋值'],
        tag: ['timeline.fields.tag', '标签'],
        tags: ['timeline.fields.tags', '标签'],
        tagQuery: ['timeline.fields.tagQuery', '标签条件'],
        marker: ['timeline.fields.marker', '标记'],
        markerId: ['timeline.fields.markerId', '标记'],
        signalId: ['timeline.fields.signalId', '战斗信号'],
        modeId: ['timeline.fields.modeId', '模式'],
        effectId: ['timeline.fields.effectId', '特效'],
        effectName: ['timeline.fields.effectName', '特效'],
        animName: ['timeline.fields.animName', '动画'],
        montageName: ['timeline.fields.montageName', '动画'],
        soundEvent: ['timeline.fields.soundEvent', '音效事件'],
        _soundEvent: ['timeline.fields.soundEvent', '音效事件'],
        triggerKey: ['timeline.fields.triggerKey', '语音触发键'],
        _triggerKey: ['timeline.fields.triggerKey', '语音触发键'],
        configKey: ['timeline.fields.configKey', '配置键'],
        key: ['timeline.fields.key', '黑板键'],
        blackboardKey: ['timeline.fields.blackboardKey', '黑板键'],
        bbKey: ['timeline.fields.bbKey', '黑板键'],
        storeKey: ['timeline.fields.storeKey', '保存键'],
        saveTo: ['timeline.fields.saveTo', '保存到'],
        duration: ['timeline.fields.duration', '持续时间'],
        totalTime: ['timeline.fields.totalTime', '总时长'],
        time: ['timeline.fields.time', '时间'],
        startFrame: ['timeline.fields.startFrame', '起始帧'],
        destFrame: ['timeline.fields.destFrame', '目标帧'],
        startOffsetFrame: ['timeline.fields.startOffsetFrame', '起始偏移帧'],
        playbackSpeed: ['timeline.fields.playbackSpeed', '播放速度'],
        blendDuration: ['timeline.fields.blendDuration', '混合时间'],
        triggerInterval: ['timeline.fields.triggerInterval', '触发间隔'],
        targetTriggerInterval: ['timeline.fields.targetTriggerInterval', '单目标触发间隔'],
        tickInterval: ['timeline.fields.tickInterval', '触发间隔'],
        fixedTickCount: ['timeline.fields.fixedTickCount', '固定次数'],
        totalTickCount: ['timeline.fields.totalTickCount', '总次数'],
        maxCountPerTarget: ['timeline.fields.maxCountPerTarget', '单目标上限'],
        count: ['timeline.fields.count', '数量'],
        layer: ['timeline.fields.layer', '层级'],
        value: ['timeline.fields.value', '数值'],
        directValue: ['timeline.fields.directValue', '直接值'],
        valueA: ['timeline.fields.valueA', '左值'],
        valueB: ['timeline.fields.valueB', '右值'],
        lhsValue: ['timeline.fields.lhsValue', '左值'],
        rhsValue: ['timeline.fields.rhsValue', '右值'],
        compare: ['timeline.fields.compare', '比较方式'],
        compareType: ['timeline.fields.compareType', '比较方式'],
        operation: ['timeline.fields.operation', '运算'],
        operationType: ['timeline.fields.operationType', '运算'],
        calculateType: ['timeline.fields.calculateType', '计算类型'],
        inputValue: ['timeline.fields.inputValue', '输入值'],
        minValue: ['timeline.fields.minValue', '最小值'],
        maxValue: ['timeline.fields.maxValue', '最大值'],
        coefficient: ['timeline.fields.coefficient', '系数'],
        multiplier: ['timeline.fields.multiplier', '倍率'],
        addition: ['timeline.fields.addition', '附加值'],
        rate: ['timeline.fields.rate', '比例'],
        curveKey: ['timeline.fields.curveKey', '曲线'],
        useDirectCurve: ['timeline.fields.useDirectCurve', '使用直接曲线'],
        useCurveKey: ['timeline.fields.useCurveKey', '使用曲线键'],
        damageUnits: ['timeline.fields.damageUnits', '伤害单元'],
        damageType: ['timeline.fields.damageType', '伤害类型'],
        damageMultiplier: ['timeline.fields.damageMultiplier', '伤害倍率'],
        healType: ['timeline.fields.healType', '治疗类型'],
        healCalculation: ['timeline.fields.healCalculation', '治疗公式'],
        poiseType: ['timeline.fields.poiseType', '韧性类型'],
        recoverValue: ['timeline.fields.recoverValue', '恢复值'],
        superArmorValue: ['timeline.fields.superArmorValue', '抗打断'],
        impactResistance: ['timeline.fields.impactResistance', '冲击抗性'],
        overrideSuperArmorLimit: ['timeline.fields.overrideSuperArmorLimit', '控制穿透'],
        immobilizedTime: ['timeline.fields.immobilizedTime', '定身时间'],
        unmovableTime: ['timeline.fields.unmovableTime', '不可移动时间'],
        blowOffDistance: ['timeline.fields.blowOffDistance', '击退距离'],
        distanceRandomRange: ['timeline.fields.distanceRandomRange', '距离随机范围'],
        blowOffHeight: ['timeline.fields.blowOffHeight', '击飞高度'],
        verticalSpeed: ['timeline.fields.verticalSpeed', '垂直速度'],
        horizontalSpeed: ['timeline.fields.horizontalSpeed', '水平速度'],
        distance: ['timeline.fields.distance', '距离'],
        moveDistance: ['timeline.fields.moveDistance', '位移距离'],
        speed: ['timeline.fields.speed', '速度'],
        moveSpeed: ['timeline.fields.moveSpeed', '移动速度'],
        moveType: ['timeline.fields.moveType', '移动类型'],
        rotateType: ['timeline.fields.rotateType', '转向类型'],
        height: ['timeline.fields.height', '高度'],
        floatingHeight: ['timeline.fields.floatingHeight', '浮空高度'],
        floatingDuration: ['timeline.fields.floatingDuration', '浮空时间'],
        directionType: ['timeline.fields.directionType', '方向类型'],
        costType: ['timeline.fields.costType', '资源类型'],
        costValue: ['timeline.fields.costValue', '资源值'],
        atbSourceType: ['timeline.fields.atbSourceType', 'ATB 来源'],
        atbGainMethod: ['timeline.fields.atbGainMethod', 'ATB 获取方式'],
        buffStackNumType: ['timeline.fields.buffStackNumType', 'Buff 层数类型'],
        finishLayerCnt: ['timeline.fields.finishLayerCnt', '移除层数'],
        mappings: ['timeline.fields.mappings', '输入映射'],
        command: ['timeline.fields.command', '输入指令'],
        cacheTime: ['timeline.fields.cacheTime', '缓存时间'],
        cacheEndByAction: ['timeline.fields.cacheEndByAction', '随动作结束缓存'],
        overrideCacheTime: ['timeline.fields.overrideCacheTime', '覆盖缓存时间'],
        skipApplyCost: ['timeline.fields.skipApplyCost', '跳过消耗'],
        inheritSourceSkillCastId: ['timeline.fields.inheritSourceSkillCastId', '继承来源施放 ID'],
        overrideDuration: ['timeline.fields.overrideDuration', '覆盖持续时间'],
        finishByAction: ['timeline.fields.finishByAction', '随动作结束'],
        alwaysNext: ['timeline.fields.alwaysNext', '始终继续'],
        enabled: ['timeline.fields.enabled', '启用'],
        visible: ['timeline.fields.visible', '显示'],
        finishAll: ['timeline.fields.finishAll', '全部移除'],
        isExtra: ['timeline.fields.isExtra', '额外结算'],
        isPercentValue: ['timeline.fields.isPercentValue', '百分比'],
        playObtainAtbEffect: ['timeline.fields.playObtainAtbEffect', '播放 ATB 特效'],
        playObtainAtbAudio: ['timeline.fields.playObtainAtbAudio', '播放 ATB 音效'],
        affectType: ['timeline.fields.affectType', '影响目标'],
        controlType: ['timeline.fields.controlType', '控制类型'],
        condition: ['timeline.fields.condition', '条件'],
        actionCount: ['timeline.fields.actionCount', '子动作数'],
        successActionCount: ['timeline.fields.successActionCount', '成功分支数'],
        failActionCount: ['timeline.fields.failActionCount', '失败分支数'],
        tickActionCount: ['timeline.fields.tickActionCount', '单次触发动作数'],
        enterActionCount: ['timeline.fields.enterActionCount', '进入动作数'],
        exitActionCount: ['timeline.fields.exitActionCount', '离开动作数'],
        shapeType: ['timeline.fields.shapeType', '形状'],
        radius: ['timeline.fields.radius', '半径'],
        range: ['timeline.fields.range', '范围'],
        faction: ['timeline.fields.faction', '阵营']
    });
    const TIMELINE_ENUM_LABELS = Object.freeze({
        eq: ['timeline.enums.eq', '='], ne: ['timeline.enums.ne', '≠'], gt: ['timeline.enums.gt', '>'],
        ge: ['timeline.enums.ge', '≥'], gte: ['timeline.enums.ge', '≥'], lt: ['timeline.enums.lt', '<'],
        le: ['timeline.enums.le', '≤'], lte: ['timeline.enums.le', '≤'], equal: ['timeline.enums.eq', '='],
        notequal: ['timeline.enums.ne', '≠'], greater: ['timeline.enums.gt', '>'], less: ['timeline.enums.lt', '<'],
        owner: ['timeline.enums.owner', '持有者'], actionowner: ['timeline.enums.actionOwner', '动作持有者'],
        source: ['timeline.enums.source', '来源'], actionsource: ['timeline.enums.actionSource', '动作来源'],
        target: ['timeline.enums.target', '目标'], context: ['timeline.enums.context', '上下文'],
        atb: ['timeline.enums.atb', 'ATB'], ultimatesp: ['timeline.enums.ultimateSp', '终结技能量'],
        usp: ['timeline.enums.usp', 'USP'], gain: ['timeline.enums.gain', '获取'],
        consume: ['timeline.enums.consume', '消耗'], set: ['timeline.enums.set', '设置'],
        assign: ['timeline.enums.assign', '赋值'], add: ['timeline.enums.add', '相加'],
        subtract: ['timeline.enums.subtract', '相减'], multiply: ['timeline.enums.multiply', '相乘'],
        divide: ['timeline.enums.divide', '相除'], sourceforward: ['timeline.enums.sourceForward', '来源朝向'],
        sourcetotarget: ['timeline.enums.sourceToTarget', '来源指向目标'],
        targettosource: ['timeline.enums.targetToSource', '目标指向来源'],
        self: ['timeline.enums.self', '自身'], friend: ['timeline.enums.friend', '友方'],
        anti: ['timeline.enums.anti', '敌方'], all: ['timeline.enums.all', '全部'],
        hp: ['timeline.enums.hp', '生命'], poise: ['timeline.enums.poise', '韧性'],
        interrupt: ['timeline.enums.interrupt', '打断'], crush: ['timeline.enums.crush', '压倒'],
        fracture: ['timeline.enums.fracture', '碎甲'], spellinfliction: ['timeline.enums.spellInfliction', '元素附着'],
        normalattack: ['timeline.enums.normalAttack', '普通攻击'], normalskill: ['timeline.enums.normalSkill', '战技'],
        ultimateskill: ['timeline.enums.ultimateSkill', '终结技'], comboskill: ['timeline.enums.comboSkill', '连携技'],
        melee: ['timeline.enums.melee', '近战'], ranged: ['timeline.enums.ranged', '远程']
    });
    const TIMELINE_DETAIL_PRIORITY = Object.freeze([
        'skillId', 'targetSkillId', 'projectileId', 'projectileSkillId', 'skillIdOnBlock', 'skillIdOnReach',
        'skillIdOnFinish', 'abilityEntityId', 'abilityEntitySkillId', 'enemyId', 'buffId', 'buffIds', 'buffIdList',
        'tag', 'tags', 'markerId', 'signalId', 'key', 'storeKey', 'targetGroupKey', 'target', 'actionSource',
        'source', 'count', 'unitCount', 'value', 'costType', 'costValue', 'superArmorValue', 'impactResistance',
        'damageMultiplier', 'recoverValue', 'distance', 'moveDistance', 'speed', 'height', 'duration', 'totalTime',
        'triggerInterval', 'destFrame', 'compare', 'operation', 'condition', 'actionCount', 'successActionCount',
        'failActionCount', 'tickActionCount', 'shapeType', 'radius', 'range', 'enabled', 'visible'
    ]);
    const TIMELINE_DETAIL_META_KEYS = new Set([
        'usesBlackboard', 'resolved', 'fallbackValue', 'raw', 'rawType', 'path'
    ]);

    function emptyAnalysis() {
        return {
            basic: {}, windows: [], hits: [], events: [], links: [], blackboard: {}, warnings: [],
            spatial: {
                castLimits: [], selectionHints: [], targetSearches: [], impactVolumes: [],
                persistentFields: [], collisionVolumes: [], relations: [], warnings: []
            }
        };
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isPresent(value) {
        return value !== undefined && value !== null && value !== '';
    }

    function gameText(ref, fallback) {
        return window.AKEV3.text(ref, fallback || '');
    }

    function localizedEntry(entry) {
        if (!entry) return '';
        if (Array.isArray(entry)) return t(entry[0], null, entry[1]);
        if (isObject(entry)) return t(entry.key, null, entry.fallback);
        return String(entry);
    }

    function currentLocale() {
        return window.akeI18n?.getLanguageInfo?.().htmlLang || 'zh-CN';
    }

    function splitIdentifier(value, removeActionSuffix) {
        let text = String(value || '')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-z\d])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (removeActionSuffix) text = text.replace(/(?:\s+Action)?(?:\s+Data)?$/i, '').trim();
        return text || String(value || '');
    }

    function actionLabel(type) {
        const normalized = String(type || 'UnknownAction');
        return localizedEntry(ACTION_LABELS[normalized])
            || t(`timeline.actions.${normalized}`, null, splitIdentifier(normalized, true));
    }

    function timelineFieldLabel(key) {
        const normalized = String(key || 'value');
        const direct = localizedEntry(TIMELINE_DETAIL_LABELS[normalized]);
        if (direct) return direct;
        const patterns = [
            [/^(.+?)RemainingCount$/, 'remainingCount', '剩余数量'],
            [/^(.+?)Count$/, 'count', '数量'],
            [/^(.+?)Type$/, 'type', '类型']
        ];
        for (const [pattern, suffixKey, suffixFallback] of patterns) {
            const match = normalized.match(pattern);
            if (!match) continue;
            const field = localizedEntry(TIMELINE_DETAIL_LABELS[match[1]])
                || t(`timeline.fields.${match[1]}`, null, splitIdentifier(match[1], false));
            return t(`timeline.fields.templates.${suffixKey}`, { field }, `${field}${suffixFallback}`);
        }
        return t(`timeline.fields.${normalized}`, null, splitIdentifier(normalized, false));
    }

    function timelineEnumLabel(value) {
        const text = String(value ?? '');
        const entry = TIMELINE_ENUM_LABELS[text.toLowerCase()];
        return entry ? localizedEntry(entry) : text;
    }

    function timelineMoreLabel(count) {
        return t('timeline.summary.more', { count }, `另 ${count} 项`);
    }

    function safeJson(value) {
        const seen = new WeakSet();
        try {
            return JSON.stringify(value, (key, child) => {
                if (child && typeof child === 'object') {
                    if (seen.has(child)) return '[Circular]';
                    seen.add(child);
                }
                return child;
            }, 2);
        } catch (error) {
            return String(value ?? error.message);
        }
    }

    function collection(value) {
        if (Array.isArray(value)) return value.filter(item => item !== undefined && item !== null);
        if (!isObject(value)) return isPresent(value) ? [value] : [];
        return Object.entries(value).map(([key, item]) => isObject(item) ? { __key: key, ...item } : { key, value: item });
    }

    function formatValue(value) {
        if (!isPresent(value)) return '--';
        if (typeof value === 'boolean') return value
            ? commonT('yes', null, '是')
            : commonT('no', null, '否');
        if (typeof value === 'number') {
            return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 4 }).format(value);
        }
        if (typeof value === 'string') return value;
        if (isObject(value) && isPresent(value.text)) return String(value.text);
        if (Array.isArray(value) && value.every(item => ['string', 'number', 'boolean'].includes(typeof item))) {
            return value.map(item => formatValue(item)).join(' / ');
        }
        return safeJson(value);
    }

    function resolvedScalar(value) {
        if (!isObject(value)) return value;
        if (Object.prototype.hasOwnProperty.call(value, 'value')) return value.value;
        return value;
    }

    function hasNonZeroValue(value) {
        const scalar = resolvedScalar(value);
        if (!isPresent(scalar)) return false;
        const numeric = Number(scalar);
        return Number.isFinite(numeric) ? numeric !== 0 : true;
    }

    function costTypeLabel(value) {
        const scalar = resolvedScalar(value);
        if (!isPresent(scalar)) return undefined;
        const normalized = String(scalar).toLowerCase();
        if (normalized === '0' || normalized === 'ultimatesp' || normalized === 'usp') {
            return t('enums.costTypes.ultimateSp', null, '终结技能量');
        }
        if (normalized === '1' || normalized === 'atb') return t('enums.costTypes.atb', null, '技力');
        return formatValue(scalar);
    }

    function attackAttributeLabel(value) {
        const scalar = resolvedScalar(value);
        if (!isPresent(scalar)) return undefined;
        const normalized = String(scalar).trim().split('.').pop().toLowerCase();
        return localizedEntry(ATTACK_ATTRIBUTE_LABELS[normalized]) || formatValue(scalar);
    }

    function enumValueLabel(group, value) {
        if (!isPresent(value)) return '';
        const raw = String(value);
        const segment = raw.split('.').pop() || raw;
        const key = segment ? `${segment[0].toLowerCase()}${segment.slice(1)}` : segment;
        return t(`enums.${group}.${key}`, null, formatValue(value));
    }

    function metricLabel(key, fallback) {
        return localizedEntry(BASIC_LABELS[key]) || t(`metrics.${key}`, null, fallback || splitIdentifier(key, false));
    }

    function readPath(source, path) {
        return String(path).split('.').reduce((value, key) => value?.[key], source);
    }

    function firstValue(source, paths) {
        for (const path of paths) {
            const value = readPath(source, path);
            if (isPresent(value)) return value;
        }
        return undefined;
    }

    function parseDeepLink(value) {
        const text = String(value || '');
        const match = text.match(/^(.*?)(?:@|~L)(\d+)$/i);
        return match ? { id: match[1], level: Number(match[2]) } : { id: text, level: null };
    }

    function showHidden() {
        return window.akeData?.getConfig?.().showHidden === true;
    }

    function isSuppressedEntity(id) {
        return HIDDEN_ENTITY_PATTERN.test(String(id || ''));
    }

    function groupKey(characterId, groupId) {
        return `${characterId}::${groupId}`;
    }

    function characterOwnerKey(id) {
        const match = String(id || '').match(/^chr_(\d+)_([^_]+)/i);
        return match ? `${Number(match[1])}:${match[2].toLowerCase()}` : '';
    }

    function normalizedCharacterSkillId(id) {
        return String(id || '').replace(/^chr_(\d+)_([^_]+)/i,
            (all, number, name) => `chr_${Number(number)}_${name.toLowerCase()}`).toLowerCase();
    }

    function skillSuffix(skillId, entityId) {
        const value = String(skillId || '');
        if (entityId && value.startsWith(`${entityId}_`)) return value.slice(String(entityId).length + 1);
        if (characterOwnerKey(value) && characterOwnerKey(value) === characterOwnerKey(entityId)) {
            const owner = value.match(/^chr_\d+_[^_]+/i)?.[0] || '';
            return value.slice(owner.length + Number(value[owner.length] === '_'));
        }
        return value;
    }

    function skillDisplayName(item, characterId) {
        const suffix = skillSuffix(item.id, item.ownerPrefix || characterId);
        return suffix || item.id;
    }

    function skillIconPath(iconId) {
        const value = String(iconId || '');
        if (!value) return '';
        if (value.startsWith('/')) return value;
        return `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/${value}.png`;
    }

    function groupDisplayName(group) {
        return gameText(group.name, localizedEntry(GROUP_TYPE_LABELS[group.skillGroupType]) || group.fallbackName || group.skillGroupId);
    }

    function itemSearchText(item, character, group) {
        return [item.id, item.name, skillDisplayName(item, character.id), character.name, character.engName,
            group.displayName, group.skillGroupId].filter(Boolean).join(' ').toLowerCase();
    }

    function otherGroup(id) {
        if (/^(eny_|race_)/i.test(id)) return ['other_enemy', t('directory.otherGroups.unmappedEnemy', null, '未映射怪物与召唤物'), 0];
        if (/^(int_|abilityentity_)/i.test(id)) return ['other_interaction', t('directory.otherGroups.interaction', null, '交互与场景实体'), 1];
        if (/^(wpn_|passive_)/i.test(id)) return ['other_equipment', t('directory.otherGroups.equipment', null, '装备与被动'), 2];
        if (/^(common_|sk_|skill_|rpg_|cc_|potential_)/i.test(id)) return ['other_system', t('directory.otherGroups.system', null, '系统与通用逻辑'), 3];
        return ['other_misc', t('directory.otherGroups.misc', null, '其他'), 4];
    }

    function inferCharacterGroup(character, skillId) {
        const normalizedId = normalizedCharacterSkillId(skillId);
        if (/_plunging_attack_start(?:_|$)/i.test(normalizedId)) {
            const normalAttackGroup = character.groups.find(group => Number(group.skillGroupType) === 0);
            if (normalAttackGroup) return normalAttackGroup;
        }
        let winner = null;
        let winnerLength = -1;
        character.groups.forEach(group => {
            (group.skillIdList || []).forEach(rootId => {
                const normalizedRoot = normalizedCharacterSkillId(rootId);
                if ((normalizedId === normalizedRoot || normalizedId.startsWith(`${normalizedRoot}_`))
                    && normalizedRoot.length > winnerLength) {
                    winner = group;
                    winnerLength = normalizedRoot.length;
                }
            });
        });
        return winner;
    }

    function buildDirectory(manifest, characters, growth, enemyDisplay, enemies) {
        const manifestMap = new Map(manifest.map(item => [item.id, item]));
        const assigned = new Set();
        const records = new Map();
        const characterAliases = new Map();

        Object.keys(characters || {}).forEach((charId, sourceOrder) => {
            if (isSuppressedEntity(charId)) return;
            const char = characters[charId] || {};
            const grow = growth?.[charId] || {};
            records.set(charId, {
                id: charId,
                entityKind: 'character',
                sectionId: 'characters',
                sectionName: t('directory.sections.characters', null, '角色'),
                sectionOrder: 0,
                name: gameText(char.name, gameText(grow.name, grow.engName || charId)),
                engName: grow.engName || '',
                rarity: Number(char.rarity ?? grow.rarity ?? 0),
                sourceOrder: Number(char.sortOrder ?? sourceOrder),
                icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/icon_${charId}.png`,
                config: char,
                growth: grow,
                groups: []
            });
            const alias = characterOwnerKey(charId);
            if (alias) characterAliases.set(alias, charId);
        });

        records.forEach(character => {
            Object.values(character.growth.skillGroupMap || {}).forEach((rawGroup, groupOrder) => {
                const skills = (rawGroup.skillIdList || []).map(id => manifestMap.get(id)).filter(Boolean);
                skills.forEach(item => assigned.add(item.id));
                if (!skills.length) return;
                character.groups.push({
                    ...rawGroup,
                    id: rawGroup.skillGroupId || `group_${groupOrder}`,
                    skillGroupId: rawGroup.skillGroupId || `group_${groupOrder}`,
                    order: Number(rawGroup.skillGroupType ?? 99),
                    displayName: groupDisplayName(rawGroup),
                    skills
                });
            });
        });

        const prefixes = [...records.keys()].sort((a, b) => b.length - a.length);
        manifest.forEach(item => {
            if (assigned.has(item.id)) return;
            const charId = prefixes.find(prefix => item.id.startsWith(`${prefix}_`))
                || characterAliases.get(characterOwnerKey(item.id));
            if (!charId) return;
            const character = records.get(charId);
            let group = inferCharacterGroup(character, item.id);
            if (!group) group = character.groups.find(entry => entry.id === `${charId}__other_actions`);
            if (!group) {
                group = { id: `${charId}__other_actions`, skillGroupId: `${charId}__other_actions`, order: 90,
                    displayName: t('directory.groups.otherCombatActions', null, '其他战斗动作'),
                    fallbackName: t('directory.groups.otherCombatActions', null, '其他战斗动作'), skills: [] };
                character.groups.push(group);
            }
            group.skills.push(item);
            assigned.add(item.id);
        });

        const enemyRecords = new Map();
        const enemyOwners = Object.entries(enemies || {}).sort(([left], [right]) => right.length - left.length);
        const enemyDisplayOrder = new Map(Object.keys(enemyDisplay || {}).map((id, index) => [id, index]));
        manifest.forEach(item => {
            if (assigned.has(item.id) || !/^eny_/i.test(item.id)) return;
            const ownerEntry = enemyOwners.find(([enemyId]) => item.id === enemyId || item.id.startsWith(`${enemyId}_`));
            const enemyId = ownerEntry?.[0];
            const templateId = ownerEntry?.[1]?.templateId;
            const display = enemyDisplay?.[templateId];
            if (!enemyId || !templateId || !display) return;
            const displayType = Number(display.displayType);
            let enemy = enemyRecords.get(templateId);
            if (!enemy) {
                enemy = {
                    id: templateId,
                    entityKind: 'enemy',
                    sectionId: 'enemies',
                    sectionName: t('directory.sections.monsters', null, '怪物'),
                    sectionOrder: 10,
                    name: gameText(display.name, templateId),
                    engName: gameText(display.nickname, ''),
                    rarity: ENEMY_RARITY_BY_DISPLAY_TYPE[displayType] || 1,
                    sourceOrder: enemyDisplayOrder.get(templateId) ?? Number.MAX_SAFE_INTEGER,
                    icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${templateId}.png`,
                    config: display,
                    growth: {},
                    groups: [{
                        id: `${templateId}__combat_actions`,
                        skillGroupId: `${templateId}__combat_actions`,
                        order: 0,
                        displayName: t('directory.groups.monsterSkills', null, '怪物技能'),
                        fallbackName: t('directory.groups.monsterSkills', null, '怪物技能'),
                        skills: []
                    }]
                };
                enemyRecords.set(templateId, enemy);
            }
            enemy.groups[0].skills.push({ ...item, ownerPrefix: enemyId });
            assigned.add(item.id);
        });

        const buckets = new Map();
        manifest.forEach(item => {
            if (assigned.has(item.id)) return;
            const [id, name, order] = otherGroup(item.id);
            if (!buckets.has(id)) buckets.set(id, { id, skillGroupId: id, order, displayName: name, skills: [] });
            buckets.get(id).skills.push(item);
        });
        const other = {
            id: OTHER_ID, name: t('directory.entityKinds.otherCombatEntities', null, '其他战斗实体'), engName: '', rarity: -1,
            entityKind: 'other', sectionId: 'other', sectionName: t('directory.sections.other', null, '其他'), sectionOrder: 1000,
            sourceOrder: Number.MAX_SAFE_INTEGER, config: {}, growth: {}, groups: [...buckets.values()], isOther: true
        };

        const directory = [...records.values(), ...enemyRecords.values()]
            .filter(character => character.groups.some(group => group.skills.length));
        if (other.groups.length) directory.push(other);
        directory.sort((a, b) => a.sectionOrder - b.sectionOrder
            || (a.entityKind === 'character' && b.entityKind === 'character' ? b.rarity - a.rarity : 0)
            || a.sourceOrder - b.sourceOrder || a.id.localeCompare(b.id));
        directory.forEach(character => {
            character.groups.sort((a, b) => a.order - b.order || a.skillGroupId.localeCompare(b.skillGroupId));
            character.groups.forEach(group => {
                group.skills.sort((a, b) => Number(a.priority ?? 999999) - Number(b.priority ?? 999999) || a.id.localeCompare(b.id));
                group.skills = group.skills.map(item => ({ ...item, displayName: skillDisplayName(item, character.id) }));
                group.searchText = `${group.displayName} ${group.skillGroupId}`.toLowerCase();
                group.skills.forEach(item => { item.searchText = itemSearchText(item, character, group); });
            });
            character.searchText = `${character.id} ${character.name} ${character.engName}`.toLowerCase();
        });
        return directory;
    }

    function rebuildSkillIndex() {
        state.skillIndex = new Map();
        state.directory.forEach(character => character.groups.forEach(group => group.skills.forEach(item => {
            const owner = { item, character, group };
            if (!state.skillIndex.has(item.id)) state.skillIndex.set(item.id, []);
            state.skillIndex.get(item.id).push(owner);
        })));
    }

    function filteredDirectory() {
        const term = state.query;
        if (!term) return state.directory;
        return state.directory.map(character => {
            const characterMatch = !character.isOther && character.searchText.includes(term);
            const groups = character.groups.map(group => {
                const directSkills = group.skills.filter(item => item.searchText.includes(term));
                const skills = character.isOther ? directSkills
                    : (characterMatch || group.searchText.includes(term) ? group.skills : directSkills);
                return { ...group, skills };
            }).filter(group => group.skills.length);
            return { ...character, groups };
        }).filter(character => character.groups.length);
    }

    function renderDirectoryNode(target, directory) {
        if (!target) return;
        if (!directory.length) {
            target.innerHTML = `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noMatchingCombatData', null, '没有匹配的战斗数据'))}</div>`;
            return;
        }
        const sectionCounts = directory.reduce((counts, entity) => {
            counts.set(entity.sectionId, (counts.get(entity.sectionId) || 0) + 1);
            return counts;
        }, new Map());
        let previousSectionId = '';
        target.innerHTML = directory.map(character => {
            const sectionHeading = character.sectionId !== previousSectionId
                ? `<div class="ake-ui-tree__section-header"><span>${escapeHtml(character.sectionName)}</span><span>${escapeHtml(t('counts.sectionEntities', { count: sectionCounts.get(character.sectionId) }, `${sectionCounts.get(character.sectionId)} 个`))}</span></div>`
                : '';
            previousSectionId = character.sectionId;
            const characterOpen = Boolean(state.query) || state.expandedCharacters.has(character.id);
            const total = character.groups.reduce((sum, group) => sum + group.skills.length, 0);
            const renderSkillItems = group => group.skills.map(item => `
                <button type="button" class="ake-ui-tree__item${item.id === state.activeSkillId ? ' is-active' : ''}"
                    data-combatv3-action="select-skill" data-skill-id="${escapeHtml(item.id)}"
                    data-character-id="${escapeHtml(character.id)}" data-group-id="${escapeHtml(group.id)}"
                    aria-current="${item.id === state.activeSkillId ? 'true' : 'false'}" title="${escapeHtml(item.id)}">
                    <span class="ake-ui-tree__item-title">${escapeHtml(item.displayName)}</span>
                    <span class="ake-ui-tree__item-subtitle">SkillData</span>
                </button>`).join('');
            const groups = characterOpen ? (character.entityKind === 'enemy'
                ? character.groups.map(renderSkillItems).join('')
                : character.groups.map(group => {
                const key = groupKey(character.id, group.id);
                const groupOpen = Boolean(state.query) || state.expandedGroups.has(key);
                const skills = groupOpen ? renderSkillItems(group) : '';
                return `<section class="ake-ui-tree__group${groupOpen ? ' is-open' : ''}">
                    <button type="button" class="ake-ui-tree__group-toggle" data-combatv3-action="toggle-group"
                        data-character-id="${escapeHtml(character.id)}" data-group-id="${escapeHtml(group.id)}"
                        aria-expanded="${groupOpen ? 'true' : 'false'}">
                        <span class="ake-ui-tree__group-label">${group.icon ? `<img class="ake-ui-tree__group-icon" data-size="small" src="${escapeHtml(skillIconPath(group.icon))}" alt="">` : ''}<span>${escapeHtml(group.displayName)}</span></span>
                        <span class="ake-ui-tree__group-count">${escapeHtml(group.skills.length)}</span>
                    </button>
                    <div class="ake-ui-tree__children">${skills}</div>
                </section>`;
            }).join('')) : '';
            return `${sectionHeading}<section class="ake-ui-tree__group${characterOpen ? ' is-open' : ''}">
                <button type="button" class="ake-ui-tree__group-toggle" data-combatv3-action="toggle-character"
                    data-character-id="${escapeHtml(character.id)}" aria-expanded="${characterOpen ? 'true' : 'false'}">
                    <span class="ake-ui-tree__group-label">${character.icon ? `<img class="ake-ui-tree__group-icon" src="${escapeHtml(character.icon)}" alt="">` : ''}<span>${escapeHtml(character.name)}</span></span>
                    <span class="ake-ui-tree__group-count">${escapeHtml(total)}</span>
                </button>
                <div class="ake-ui-tree__children">${groups}</div>
            </section>`;
        }).join('');
    }

    function renderDirectories() {
        const directory = filteredDirectory();
        renderDirectoryNode(elements.list, directory);
        renderDirectoryNode(elements.mobileList, directory);
        const count = new Set(directory.flatMap(character => character.groups.flatMap(group => group.skills.map(item => item.id)))).size;
        const characterCount = directory.filter(entity => entity.entityKind === 'character').length;
        const enemyCount = directory.filter(entity => entity.entityKind === 'enemy').length;
        if (elements.meta) elements.meta.textContent = t('counts.directorySummary', {
            characters: characterCount,
            monsters: enemyCount,
            skills: count
        }, `${characterCount} 个角色 · ${enemyCount} 个怪物 · ${count} 条 SkillData`);
    }

    function openMobileList() {
        if (!elements.mobileOverlay) return;
        elements.mobileOverlay.classList.add('is-open');
        elements.mobileOverlay.setAttribute('aria-hidden', 'false');
        elements.mobileButton?.setAttribute('aria-expanded', 'true');
        window.setTimeout(() => elements.mobileSearch?.focus(), 0);
    }

    function closeMobileList() {
        if (!elements.mobileOverlay) return;
        elements.mobileOverlay.classList.remove('is-open');
        elements.mobileOverlay.setAttribute('aria-hidden', 'true');
        elements.mobileButton?.setAttribute('aria-expanded', 'false');
    }

    function ownerFor(skillId, characterId, groupId) {
        const owners = state.skillIndex.get(skillId) || [];
        return owners.find(owner => owner.character.id === characterId && owner.group.id === groupId) || owners[0] || null;
    }

    function patchesFor(skillId) {
        const bundle = state.tables?.patches?.[skillId]?.SkillPatchDataBundle;
        return Array.isArray(bundle) ? bundle.filter(patch => Number.isFinite(Number(patch?.level))) : [];
    }

    function selectLevel(patches, requested, rawLevel) {
        const levels = [...new Set(patches.map(patch => Number(patch.level)))].sort((a, b) => a - b);
        const wanted = Number(requested);
        if (levels.includes(wanted)) return wanted;
        if (levels.length) return levels[levels.length - 1];
        return Number(rawLevel) || wanted || 1;
    }

    function selectedPatch(skillId, level) {
        return patchesFor(skillId).find(patch => Number(patch.level) === Number(level)) || null;
    }

    function loadingHtml(title, message, page = false) {
        return `<div class="ake-ui-state" data-state="loading"${page ? ' data-layout="page"' : ''}><div>
            <h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></div>`;
    }

    function errorHtml(title, message) {
        return `<div class="ake-ui-state" data-state="error"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></div>`;
    }

    async function fetchSkill(item) {
        if (state.skillCache.has(item.id)) return state.skillCache.get(item.id);
        const promise = (async () => {
            const path = item.contentFile || `/public/Json/SkillData/${encodeURIComponent(item.id)}.json`;
            const response = await (window.akeFetch || fetch)(path);
            if (!response.ok) throw new Error(t('errors.readSkillData', { id: item.id }, `无法读取 ${item.id}`));
            return response.json();
        })().catch(error => {
            state.skillCache.delete(item.id);
            throw error;
        });
        state.skillCache.set(item.id, promise);
        return promise;
    }

    function fetchSkillDataById(skillId) {
        const id = String(skillId || '').trim();
        if (!id) return Promise.resolve(null);
        const item = state.rawManifest.find(entry => entry?.id === id)
            || state.manifest.find(entry => entry?.id === id)
            || { id };
        return fetchSkill(item);
    }

    function normalizeAnalysis(result) {
        const source = isObject(result) ? result : {};
        const rawSpatial = isObject(source.spatial) ? source.spatial : {};
        const seenWarnings = new Set();
        const warnings = [...collection(source.warnings), ...collection(rawSpatial.warnings)].filter(warning => {
            const key = isObject(warning)
                ? JSON.stringify([warning.code, warning.path, warning.key, warning.skillId, warning.detail, warning.message])
                : String(warning);
            if (seenWarnings.has(key)) return false;
            seenWarnings.add(key);
            return true;
        });
        return {
            basic: isObject(source.basic) ? source.basic : {},
            windows: collection(source.windows),
            hits: collection(source.hits),
            events: collection(source.events),
            links: collection(source.links),
            blackboard: source.blackboard ?? {},
            warnings,
            spatial: {
                castLimits: collection(rawSpatial.castLimits),
                selectionHints: collection(rawSpatial.selectionHints),
                targetSearches: collection(rawSpatial.targetSearches),
                impactVolumes: collection(rawSpatial.impactVolumes),
                persistentFields: collection(rawSpatial.persistentFields),
                collisionVolumes: collection(rawSpatial.collisionVolumes),
                relations: collection(rawSpatial.relations),
                warnings: collection(rawSpatial.warnings)
            }
        };
    }

    function warningText(warning) {
        if (!isObject(warning)) {
            const message = formatValue(warning);
            return t('warnings.UNKNOWN', { message }, `分析警告：${message}`);
        }
        let code = String(warning.code || 'UNKNOWN');
        if (code === 'PATCH_LEVEL_FALLBACK' && isPresent(warning.requestedLevel)) {
            code = 'PATCH_LEVEL_FALLBACK_REQUESTED';
        }
        const message = isPresent(warning.message) ? formatValue(warning.message) : code;
        return t(`warnings.${code}`, { ...warning, message },
            code === 'UNKNOWN' ? `分析警告：${message}` : message);
    }

    async function analyzeCurrent(token) {
        const owner = state.activeOwner;
        const analyzer = window.AKEV3SkillData?.analyzeSkill;
        const entity = owner?.character || {};
        const isCharacter = entity.entityKind === 'character';
        const isEnemy = entity.entityKind === 'enemy';
        const context = {
            level: state.level,
            manifestItem: state.currentItem,
            entity,
            character: isCharacter ? entity : {},
            enemy: isEnemy ? entity : {},
            characterGrowth: isCharacter ? entity.growth || {} : {},
            characterInfo: isCharacter ? entity : {},
            group: owner?.group || {},
            characterConfig: isCharacter ? entity.config || {} : {},
            enemyConfig: isEnemy ? entity.config || {} : {},
            tables: state.tables,
            loadSkillData: skillId => fetchSkillDataById(skillId)
        };
        let result;
        if (typeof analyzer !== 'function') {
            result = { warnings: [{ code: 'ANALYZER_UNAVAILABLE' }] };
        } else {
            try {
                result = await analyzer(state.currentData, state.currentPatch, context);
            } catch (error) {
                result = { warnings: [{ code: 'ANALYSIS_FAILED', message: error.message || error }] };
            }
        }
        if (token !== state.detailToken) return;
        state.analysisSource = result;
        state.analysis = normalizeAnalysis(result);
        renderDetail();
    }

    async function selectSkill(skillId, options) {
        const settings = options || {};
        const owner = ownerFor(skillId, settings.characterId, settings.groupId);
        if (!owner) return false;
        state.activeSkillId = skillId;
        state.activeOwner = owner;
        state.currentItem = owner.item;
        state.currentData = null;
        state.currentPatch = null;
        state.analysis = emptyAnalysis();
        state.analysisSource = null;
        state.activeTab = 'timeline';
        state.showPerformance = false;
        state.expandedCharacters.add(owner.character.id);
        state.expandedGroups.add(groupKey(owner.character.id, owner.group.id));
        state.level = selectLevel(patchesFor(skillId), isPresent(settings.level) ? settings.level : undefined);
        state.currentPatch = selectedPatch(skillId, state.level);
        renderDirectories();
        closeMobileList();
        elements.detail.innerHTML = loadingHtml(owner.item.displayName,
            t('loading.analyzing', null, '正在分析战斗数据'));
        const token = ++state.detailToken;
        if (settings.updateUrl !== false) updateDeepLink();
        try {
            const raw = await fetchSkill(owner.item);
            if (token !== state.detailToken) return true;
            state.currentData = raw;
            state.level = selectLevel(patchesFor(skillId), state.level, raw?.level);
            state.currentPatch = selectedPatch(skillId, state.level);
            if (settings.updateUrl !== false) updateDeepLink();
            await analyzeCurrent(token);
        } catch (error) {
            if (token === state.detailToken) elements.detail.innerHTML = errorHtml(
                t('errors.skillReadTitle', null, '技能读取失败'), error.message || error);
        }
        return true;
    }

    function updateDeepLink() {
        window.__akeRouter?.updateUrl?.(MODULE_ID, state.activeSkillId);
        const url = new URL(window.location.href);
        if (url.searchParams.get('plugin') !== MODULE_ID) return;
        url.searchParams.set('level', String(state.level));
        const historyState = isObject(history.state) ? history.state : {};
        history.replaceState(historyState, '', `${url.pathname}?${url.searchParams.toString()}`);
    }

    function metricValue(key, value) {
        if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'displayValue')) {
            return {
                value: formatValue(value.displayValue),
                unit: isPresent(value.displayUnit) ? formatValue(value.displayUnit) : ''
            };
        }
        value = resolvedScalar(value);
        const lower = String(key).toLowerCase();
        if (lower === 'attackrangetype') {
            const rangeLabel = {
                melee: t('enums.attackRanges.melee', null, '近战'),
                ranged: t('enums.attackRanges.ranged', null, '远程')
            }[String(value).toLowerCase()];
            if (rangeLabel) return { value: rangeLabel, unit: '' };
        }
        if (typeof value === 'number' && lower.includes('frame')) {
            return {
                value: t('units.frameSeconds', { frames: formatValue(value), seconds: formatValue(value / 30) },
                    `${formatValue(value)} 帧，约 ${formatValue(value / 30)} 秒`),
                unit: ''
            };
        }
        if (typeof value === 'number' && (lower.includes('time') || lower.includes('cooldown'))) {
            return { value: t('units.seconds', { value: formatValue(value) }, `${formatValue(value)} 秒`), unit: '' };
        }
        return { value: formatValue(value), unit: '' };
    }

    function groupedHits() {
        const groups = new Map();
        state.analysis.hits.forEach((hit, index) => {
            const key = isPresent(hit.eventIndex) ? `event:${hit.eventIndex}` : `${hit.path || 'hit'}:${hit.startFrame ?? index}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    startFrame: hit.startFrame,
                    endFrame: hit.endFrame,
                    damageTypes: new Set(),
                    hp: [],
                    poise: [],
                    other: [],
                    resources: [],
                    effects: [],
                    targetGroupKey: hit.targetGroupKey || '',
                    groupIndex: hit.groupIndex,
                    branchPath: Array.isArray(hit.branchPath) ? hit.branchPath : []
                });
            }
            const group = groups.get(key);
            if (hit.damageType) group.damageTypes.add(hit.damageType);
            if (hit.kind === 'hp') group.hp.push(hit);
            else if (hit.kind === 'poise') group.poise.push(hit);
            else group.other.push(hit);
            (hit.costDataList || []).forEach(cost => group.resources.push(cost));
        });
        groups.forEach(group => {
            group.effects = state.analysis.events.filter(event => ['control', 'buff'].includes(event.category)
                && ((isPresent(group.groupIndex) && event.groupIndex === group.groupIndex)
                    || (event.startFrame === group.startFrame && event.endFrame === group.endFrame)))
                .map((event, index) => eventLabel(event, index));
        });
        return [...groups.values()];
    }

    function numericPoiseSummary(groups) {
        const values = groups.flatMap(group => group.poise.map(hit => Number(resolvedScalar(hit.poiseValue))))
            .filter(Number.isFinite);
        const conditional = groups.some(group => group.branchPath.length > 0);
        return values.length && !conditional ? values.reduce((sum, value) => sum + value, 0) : undefined;
    }

    function superArmorSummary() {
        const windows = state.analysis.windows.filter(item => ['superArmor', 'buffSuperArmor'].includes(item.kind));
        if (!windows.length) return undefined;
        const summaries = windows.map(item => {
            const buffArmor = isObject(item.values)
                ? Object.entries(item.values).find(([key]) => /super.?armor/i.test(key))?.[1]
                : undefined;
            const value = resolvedScalar(item.superArmorValue ?? buffArmor);
            const impact = resolvedScalar(item.impactResistance);
            const range = isPresent(item.startFrame)
                ? (item.endFrame !== item.startFrame
                    ? t('units.frameRange', { start: formatValue(item.startFrame), end: formatValue(item.endFrame) },
                        `${formatValue(item.startFrame)}–${formatValue(item.endFrame)} 帧`)
                    : t('units.frames', { value: formatValue(item.startFrame) }, `${formatValue(item.startFrame)} 帧`))
                : '';
            return {
                value: [isPresent(value) ? value : item.buffId || 'Buff', isPresent(impact) ? `${timelineFieldLabel('impactResistance')} ${impact}` : '']
                    .filter(Boolean).join(' · '),
                range
            };
        });
        return {
            displayValue: summaries.map(item => item.value).join(' / '),
            displayUnit: summaries.map(item => item.range).filter(Boolean).join(' / ')
        };
    }

    const SPATIAL_SHAPE_KEYS = Object.freeze({
        point: ['spatial.shapes.point', '点'],
        circle: ['spatial.shapes.circle', '圆形'],
        sector: ['spatial.shapes.sector', '扇形'],
        arrow: ['spatial.shapes.arrow', '箭头'],
        sphere: ['spatial.shapes.sphere', '球形'],
        capsule: ['spatial.shapes.capsule', '胶囊体'],
        box: ['spatial.shapes.box', '盒体'],
        global: ['spatial.shapes.global', '全局']
    });
    const SPATIAL_CENTER_KEYS = Object.freeze({
        owner: ['spatial.centers.owner', '自身'],
        self: ['spatial.centers.owner', '自身'],
        source: ['spatial.centers.source', '来源实体'],
        target: ['spatial.centers.target', '目标'],
        contexttarget: ['spatial.centers.contextTarget', '上下文目标'],
        contextposition: ['spatial.centers.contextPosition', '上下文位置'],
        actionowner: ['spatial.centers.actionOwner', '动作执行者'],
        inputcenter: ['spatial.centers.inputCenter', '输入中心'],
        position: ['spatial.centers.position', '指定位置'],
        point: ['spatial.centers.position', '指定位置'],
        ground: ['spatial.centers.ground', '地面落点'],
        targetposition: ['spatial.centers.targetPosition', '目标位置']
    });

    function spatialShapeLabel(value) {
        const scalar = resolvedScalar(value);
        if (!isPresent(scalar)) return '';
        const normalized = String(scalar).split('.').pop().replace(/shape(?:data)?$/i, '').toLowerCase();
        const entry = SPATIAL_SHAPE_KEYS[normalized];
        return entry ? t(entry[0], null, entry[1]) : formatValue(scalar);
    }

    function spatialStatus(value) {
        if (!isObject(value)) return '';
        const raw = value.status ?? value.state ?? value.source ?? value.kind;
        return isPresent(raw) ? String(raw).toLowerCase() : '';
    }

    function isUnresolvedSpatialValue(value, fact) {
        const candidates = [value, isObject(value) ? value.resolution : undefined];
        if (!isPresent(value)) candidates.push(fact?.resolution);
        return candidates.some(candidate => {
            if (!isObject(candidate)) return /unresolved|runtime|missing|unknown/.test(String(candidate || '').toLowerCase());
            const status = spatialStatus(candidate);
            return candidate.resolved === false
                || /unresolved|runtime|missing|unknown/.test(status)
                || (candidate.usesBlackboard === true && candidate.resolved !== true
                    && !isPresent(candidate.resolvedValue));
        });
    }

    function spatialScalar(value, fact) {
        if (isObject(value) && value.scenarioOnly === true) {
            return { unresolved: false, scenarioOnly: true, text: '' };
        }
        if (isUnresolvedSpatialValue(value, fact)) return {
            unresolved: true,
            text: t('spatial.values.unresolved', null, '运行时传入/未解析')
        };
        let scalar = value;
        if (isObject(scalar)) {
            if (Object.prototype.hasOwnProperty.call(scalar, 'resolvedValue')) scalar = scalar.resolvedValue;
            else if (Object.prototype.hasOwnProperty.call(scalar, 'value')) scalar = scalar.value;
            else if (Object.prototype.hasOwnProperty.call(scalar, 'literal')) scalar = scalar.literal;
        }
        if (!isPresent(scalar)) return { unresolved: false, text: '' };
        return { unresolved: false, scalar, text: formatValue(scalar) };
    }

    function spatialDimension(fact, paths) {
        const geometry = isObject(fact?.geometry) ? fact.geometry : {};
        const dimensions = isObject(geometry.dimensions) ? geometry.dimensions
            : (isObject(fact?.dimensions) ? fact.dimensions : {});
        return firstValue(dimensions, paths)
            ?? firstValue(geometry, paths)
            ?? firstValue(fact || {}, paths);
    }

    function spatialDimensionText(key, value, fact) {
        if (!isPresent(value)) return '';
        const result = spatialScalar(value, fact);
        if (!result.text) return '';
        const labels = {
            radius: t('spatial.dimensions.radius', null, 'R'),
            angle: t('spatial.dimensions.angle', null, '角度'),
            height: t('spatial.dimensions.height', null, '高'),
            maxHeight: t('spatial.dimensions.maxHeight', null, '高度上限'),
            length: t('spatial.dimensions.length', null, '长'),
            width: t('spatial.dimensions.width', null, '宽'),
            depth: t('spatial.dimensions.depth', null, '深')
        };
        if (result.unresolved) return `${labels[key] || ''} ${result.text}`.trim();
        if (Number.isFinite(Number(result.scalar)) && Number(result.scalar) === 0) return '';
        const unit = key === 'angle'
            ? t('units.degrees', { value: result.text }, `${result.text}°`)
            : t('units.meters', { value: result.text }, `${result.text} 米`);
        return `${labels[key] || ''} ${unit}`.trim();
    }

    function spatialSizeParts(fact) {
        const size = spatialDimension(fact, ['size', 'extent', 'dimensions.size']);
        const values = Array.isArray(size)
            ? { x: size[0], y: size[1], z: size[2] }
            : (isObject(size) ? size : {});
        const length = spatialDimension(fact, ['length', 'sizeZ', 'extentZ'])
            ?? values.length ?? values.z ?? values.depth;
        const width = spatialDimension(fact, ['width', 'sizeX', 'extentX'])
            ?? values.width ?? values.x;
        const height = spatialDimension(fact, ['height', 'sizeY', 'extentY'])
            ?? values.height ?? values.y;
        return [
            spatialDimensionText('length', length, fact),
            spatialDimensionText('width', width, fact),
            spatialDimensionText('height', height, fact)
        ].filter(Boolean);
    }

    function spatialGeometryText(fact, category) {
        if (!isObject(fact)) {
            const scalar = spatialScalar(fact);
            return scalar.text ? t('units.meters', { value: scalar.text }, `${scalar.text} 米`) : '';
        }
        const geometry = isObject(fact.geometry) ? fact.geometry : {};
        if (category === 'cast') {
            const rawDistance = spatialDimension(fact, ['distance', 'castDistance', 'limit', 'value', 'radius']);
            const distance = spatialScalar(rawDistance, fact);
            return distance.text
                ? (distance.unresolved ? distance.text : t('units.meters', { value: distance.text }, `${distance.text} 米`))
                : (isUnresolvedSpatialValue(undefined, fact)
                    ? t('spatial.values.unresolved', null, '运行时传入/未解析') : '');
        }
        const shape = spatialShapeLabel(geometry.shape ?? geometry.shapeType ?? fact.shape ?? fact.shapeType ?? fact.type);
        const dimensions = [
            spatialDimensionText('radius', spatialDimension(fact, ['radius', 'range']), fact),
            spatialDimensionText('angle', spatialDimension(fact, ['angle', 'sectorAngle']), fact),
            spatialDimensionText('length', spatialDimension(fact, ['length', 'sizeZ', 'extentZ']), fact),
            spatialDimensionText('width', spatialDimension(fact, ['width', 'sizeX', 'extentX']), fact),
            spatialDimensionText('height', spatialDimension(fact, ['height', 'sizeY', 'extentY']), fact),
            spatialDimensionText('maxHeight', spatialDimension(fact, ['maxHeight']), fact),
            spatialDimensionText('depth', spatialDimension(fact, ['depth']), fact)
        ].filter(Boolean);
        if (!dimensions.length) dimensions.push(...spatialSizeParts(fact));
        const unresolved = isUnresolvedSpatialValue(undefined, fact)
            ? t('spatial.values.unresolved', null, '运行时传入/未解析') : '';
        return [shape, ...dimensions, (!dimensions.length ? unresolved : '')].filter(Boolean).join(' · ');
    }

    function spatialOperatorLabel(value) {
        const normalized = String(value || '').toLowerCase();
        const labels = {
            '==': ['spatial.operators.equal', '等于'], equal: ['spatial.operators.equal', '等于'],
            '!=': ['spatial.operators.notEqual', '不等于'], notequal: ['spatial.operators.notEqual', '不等于'],
            '>': ['spatial.operators.greater', '大于'], greater: ['spatial.operators.greater', '大于'],
            gt: ['spatial.operators.greater', '大于'],
            '>=': ['spatial.operators.greaterOrEqual', '大于等于'], greaterorequal: ['spatial.operators.greaterOrEqual', '大于等于'],
            ge: ['spatial.operators.greaterOrEqual', '大于等于'], gte: ['spatial.operators.greaterOrEqual', '大于等于'],
            '<': ['spatial.operators.less', '小于'], less: ['spatial.operators.less', '小于'],
            lt: ['spatial.operators.less', '小于'],
            '<=': ['spatial.operators.lessOrEqual', '小于等于'], lessorequal: ['spatial.operators.lessOrEqual', '小于等于'],
            le: ['spatial.operators.lessOrEqual', '小于等于'], lte: ['spatial.operators.lessOrEqual', '小于等于'],
            eq: ['spatial.operators.equal', '等于'], ne: ['spatial.operators.notEqual', '不等于']
        };
        const entry = labels[normalized];
        return entry ? t(entry[0], null, entry[1]) : formatValue(value);
    }

    function spatialConditionText(condition, depth) {
        if (!isPresent(condition)) return '';
        if (['string', 'number', 'boolean'].includes(typeof condition)) return formatValue(condition);
        if (Array.isArray(condition)) {
            return condition.map(item => spatialConditionText(item, (depth || 0) + 1)).filter(Boolean)
                .join(t('spatial.conditions.andSeparator', null, '，'));
        }
        if (!isObject(condition) || (depth || 0) > 3) {
            return t('spatial.conditions.runtime', null, '运行时条件');
        }
        const direct = firstValue(condition, ['displayText', 'text', 'label', 'expression', 'description']);
        if (isPresent(direct)) {
            const expression = isObject(direct)
                ? spatialConditionText(direct, (depth || 0) + 1)
                : formatValue(direct);
            if (String(condition.type || '').toLowerCase() === 'branch'
                && String(condition.outcome || '').toLowerCase() === 'failure') {
                return t('spatial.conditions.notMet', { condition: expression }, `不满足：${expression}`);
            }
            return expression;
        }
        if (String(condition.type || '').toLowerCase() === 'external' && isPresent(condition.sourceId)) {
            const potential = String(condition.sourceId).match(/potential[_-]?(\d+)(?:\D|$)/i);
            if (potential) {
                return t('spatial.conditions.potentialLevel', { level: potential[1] }, `潜能 ${potential[1]}`);
            }
            return t('spatial.conditions.externalSource', { source: formatValue(condition.sourceId) },
                `外部条件 ${formatValue(condition.sourceId)}`);
        }
        const children = collection(condition.conditions ?? condition.children ?? condition.items);
        if (children.length) {
            const mode = String(condition.mode ?? condition.logic ?? condition.operator ?? 'and').toLowerCase();
            const separator = /or|any/.test(mode)
                ? t('spatial.conditions.orSeparator', null, ' 或 ')
                : t('spatial.conditions.andSeparator', null, '，');
            return children.map(item => spatialConditionText(item, (depth || 0) + 1)).filter(Boolean).join(separator);
        }
        const left = firstValue(condition, ['left', 'key', 'blackboardKey', 'field', 'source']);
        const right = firstValue(condition, ['right', 'value', 'target', 'threshold']);
        const operator = firstValue(condition, ['compare', 'comparison', 'operator', 'op']);
        if (isPresent(left) && isPresent(operator) && isPresent(right)) {
            const leftText = isObject(left) ? firstValue(left, ['key', 'blackboardKey', 'name', 'value']) : left;
            const rightText = isObject(right) ? spatialScalar(right).text : formatValue(right);
            return [formatValue(leftText), spatialOperatorLabel(operator), rightText].filter(Boolean).join(' ');
        }
        return t('spatial.conditions.runtime', null, '运行时条件');
    }

    function spatialTimingText(fact) {
        const timing = isObject(fact?.timing) ? fact.timing : {};
        const start = firstValue(timing, ['startFrame', 'frame', 'start', 'from'])
            ?? firstValue(fact || {}, ['startFrame', 'frame']);
        const end = firstValue(timing, ['endFrame', 'end', 'to'])
            ?? firstValue(fact || {}, ['endFrame']);
        if (!isPresent(start)) return '';
        let text;
        if (isPresent(end) && Number(end) !== Number(start)) {
            text = t('units.frameRange', { start: formatValue(start), end: formatValue(end) },
                `${formatValue(start)}–${formatValue(end)} 帧`);
        } else {
            text = t('units.frames', { value: formatValue(start) }, `${formatValue(start)} 帧`);
        }
        return timing.scope === 'skill-local' && fact?.skillId && fact.skillId !== state.activeSkillId
            ? t('spatial.timing.skillLocal', { timing: text }, `子技能局部：${text}`)
            : text;
    }

    function spatialSourceText(fact) {
        const source = isObject(fact?.source) ? fact.source : {};
        const named = firstValue(fact || {}, ['stageLabel', 'stageName'])
            ?? firstValue(source, ['stageLabel', 'stageName', 'label']);
        if (isPresent(named)) return named;
        const skillId = source.skillId ?? fact?.skillId;
        if (isPresent(skillId) && skillId !== state.activeSkillId) {
            const displayId = String(skillId).startsWith(`${state.activeSkillId}_`)
                ? String(skillId).slice(state.activeSkillId.length + 1)
                : formatValue(skillId);
            return t('spatial.sources.childSkill', { skillId: displayId }, `子技能：${displayId}`);
        }
        if (typeof fact?.source !== 'string') return '';
        const rawSource = fact.source;
        return /^(?:timeline|passive|config|highlight|switch-condition)$/i.test(rawSource)
            ? '' : rawSource;
    }

    function spatialVariantTexts(fact) {
        if (!isObject(fact)) return [];
        const geometry = isObject(fact.geometry) ? fact.geometry : {};
        const dimensions = isObject(geometry.dimensions) ? geometry.dimensions
            : (isObject(fact.dimensions) ? fact.dimensions : {});
        const dimensionKeys = [
            ['distance', 'distance'], ['radius', 'radius'], ['angle', 'angle'],
            ['length', 'length'], ['width', 'width'], ['height', 'height'], ['maxHeight', 'maxHeight'], ['depth', 'depth'],
            ['sizeZ', 'length'], ['extentZ', 'length'], ['sizeX', 'width'], ['extentX', 'width'],
            ['sizeY', 'height'], ['extentY', 'height']
        ];
        const lines = [];
        const seen = new Set();
        const conditionAtoms = condition => {
            if (!condition) return [];
            if (Array.isArray(condition)) return condition.flatMap(conditionAtoms);
            if (condition.type === 'all' && Array.isArray(condition.items)) {
                return condition.items.flatMap(conditionAtoms);
            }
            return [JSON.stringify(condition)];
        };
        dimensionKeys.forEach(([sourceKey, displayKey]) => {
            const wrapper = dimensions[sourceKey];
            if (!isObject(wrapper) || !Array.isArray(wrapper.variants)) return;
            const variants = wrapper.variants.filter((variant, index, all) => {
                const atoms = conditionAtoms(variant.condition);
                if (!atoms.length) return true;
                const valueKey = JSON.stringify([variant.value, variant.resolved, variant.error]);
                return !all.some((other, otherIndex) => {
                    if (otherIndex === index
                        || JSON.stringify([other.value, other.resolved, other.error]) !== valueKey) return false;
                    const otherAtoms = conditionAtoms(other.condition);
                    return otherAtoms.length < atoms.length
                        && otherAtoms.every(atom => atoms.includes(atom));
                });
            });
            variants.forEach(variant => {
                const value = spatialDimensionText(displayKey, variant, fact);
                if (!value) return;
                const condition = spatialConditionText(variant.condition);
                const text = condition
                    ? t('spatial.conditions.variant', { condition, value }, `${condition} → ${value}`)
                    : value;
                if (seen.has(text)) return;
                seen.add(text);
                lines.push(text);
            });
        });
        return lines;
    }

    function spatialFactUnit(fact) {
        if (!isObject(fact)) return '';
        const condition = spatialConditionText(fact.condition ?? fact.conditions);
        const conditionText = condition
            ? t('spatial.conditions.prefixed', { condition }, `条件：${condition}`) : '';
        const timing = Array.isArray(fact._spatialTimings)
            ? [...new Set(fact._spatialTimings.filter(Boolean))].join(t('spatial.timing.separator', null, ' / '))
            : spatialTimingText(fact);
        const source = spatialSourceText(fact);
        return [conditionText, ...spatialVariantTexts(fact), timing, source].filter(Boolean).join(' · ');
    }

    function spatialAnchorValue(fact) {
        const geometry = isObject(fact?.geometry) ? fact.geometry : {};
        return fact?.anchor ?? fact?.center ?? geometry.anchor ?? geometry.center
            ?? geometry.positionRef ?? fact?.positionRef;
    }

    function spatialCenterText(value) {
        if (!isPresent(value)) return '';
        if (isObject(value)) {
            const direct = firstValue(value, ['displayText', 'text', 'label', 'name']);
            if (isPresent(direct)) return formatValue(direct);
            const type = firstValue(value, ['type', 'kind', 'source', 'value', 'center', 'positionRef', 'selectorOwner']);
            const base = spatialCenterText(type)
                || (value.centerBaseIsEndPoint === true
                    ? t('spatial.centers.endPoint', null, '选取终点') : '');
            const rawOffset = value.centerOffset ?? value.offset;
            const vector = Array.isArray(rawOffset)
                ? { x: rawOffset[0], y: rawOffset[1], z: rawOffset[2] }
                : (isObject(rawOffset) ? rawOffset : {});
            const offset = ['x', 'y', 'z'].map(axis => {
                const scalar = spatialScalar(vector[axis] ?? vector[axis.toUpperCase()]);
                if (!scalar.text) return '';
                if (!scalar.unresolved && Number.isFinite(Number(scalar.scalar)) && Number(scalar.scalar) === 0) return '';
                const measured = scalar.unresolved ? scalar.text
                    : t('units.meters', { value: scalar.text }, `${scalar.text} 米`);
                return `${axis.toUpperCase()} ${measured}`;
            }).filter(Boolean).join(' / ');
            const offsetText = offset
                ? t('spatial.centers.offset', { value: offset }, `偏移 ${offset}`) : '';
            const grounded = value.centerToGround === true
                ? t('spatial.centers.grounded', null, '贴合地面') : '';
            return [base, grounded, offsetText].filter(Boolean).join(' · ');
        }
        const raw = String(value);
        const normalized = raw.replace(/[_.\s-]/g, '').toLowerCase();
        const entry = SPATIAL_CENTER_KEYS[normalized];
        return entry ? t(entry[0], null, entry[1]) : raw;
    }

    function spatialSignature(fact) {
        if (!isObject(fact)) return String(fact);
        const geometry = isObject(fact.geometry) ? fact.geometry : {};
        const shape = String(geometry.shape ?? geometry.shapeType ?? fact.shape ?? fact.shapeType ?? '').toLowerCase();
        const dimensions = ['radius', 'angle', 'length', 'width', 'height', 'maxHeight', 'depth']
            .map(key => spatialScalar(spatialDimension(fact, [key]), fact).text).join('|');
        const size = spatialSizeParts(fact).join('|');
        const variants = spatialVariantTexts(fact).slice().sort().join('|');
        return `${shape}:${dimensions}:${size}:${variants}`;
    }

    function spatialFactRelationLabel(fact) {
        if (!isObject(fact)) return '';
        const semantic = String(fact.semantic || '').toLowerCase().replace(/[_\s-]+/g, '');
        const labels = {
            castlimit: ['metrics.spatial.castLimit', '施放距离'],
            selectionhint: ['metrics.spatial.selectionHint', '操作提示'],
            targetsearch: ['spatial.purposes.targetSearch', '索敌'],
            continuoustargetsearch: ['spatial.purposes.targetSearch', '索敌'],
            impactvolume: ['metrics.spatial.actualImpact', '实际判定'],
            persistentfield: ['metrics.spatial.persistentField', '持续领域'],
            collisionvolume: ['spatial.purposes.collision', '碰撞']
        };
        const entry = labels[semantic];
        const category = entry ? t(entry[0], null, entry[1]) : '';
        const shape = spatialShapeLabel(fact.geometry?.shape ?? fact.shape ?? fact.shapeType);
        return [category, shape].filter(Boolean).join(' · ');
    }

    function spatialRelationEndpoint(value, factsById, relation, endpoint) {
        if (!isPresent(value)) return '';
        const id = isObject(value) ? firstValue(value, ['id', 'factId', 'label', 'text']) : value;
        const fact = factsById?.get(String(id));
        if (fact) return spatialFactRelationLabel(fact);
        const text = String(id || '');
        if (endpoint === 'to' && text.startsWith('event:') && isPresent(relation?.details?.category)) {
            const category = String(relation.details.category).toLowerCase();
            const categories = {
                damage: ['spatial.consumers.damage', '伤害结算'],
                control: ['spatial.consumers.control', '控制效果'],
                buff: ['spatial.consumers.buff', 'Buff 效果'],
                timing: ['spatial.consumers.timing', '时序效果']
            };
            const entry = categories[category];
            return entry ? t(entry[0], null, entry[1]) : t('spatial.consumers.effect', null, '战斗效果');
        }
        if (text.startsWith('event:')) return t('spatial.sources.skillEvent', null, '技能事件');
        if (text.startsWith('skill:')) {
            const skillId = text.slice('skill:'.length);
            const displayId = skillId.startsWith(`${state.activeSkillId}_`)
                ? skillId.slice(state.activeSkillId.length + 1)
                : skillId;
            return skillId === state.activeSkillId
                ? t('spatial.sources.currentSkill', null, '当前技能')
                : t('spatial.sources.childSkill', { skillId: displayId }, `子技能：${displayId}`);
        }
        return formatValue(id);
    }

    function spatialRelationText(relation, factsById) {
        if (!isPresent(relation)) return '';
        if (!isObject(relation)) return formatValue(relation);
        const direct = firstValue(relation, ['displayText', 'text', 'label', 'description']);
        if (isPresent(direct) && !isObject(direct)) return formatValue(direct);
        const type = String(relation.type ?? relation.kind ?? relation.semantic ?? '').toLowerCase().replace(/[_\s-]+/g, '');
        const labels = {
            hintmismatch: ['spatial.relations.hintMismatch', '操作提示与实际判定不同'],
            sharesvalue: ['spatial.relations.sharesValue', '共享同一范围参数'],
            limits: ['spatial.relations.limits', '限制'],
            targets: ['spatial.relations.targets', '作用于'],
            spawns: ['spatial.relations.spawns', '生成'],
            inheritsblackboard: ['spatial.relations.inheritsBlackboard', '继承范围参数'],
            consumedby: ['spatial.relations.consumedBy', '被用于']
        };
        const entry = labels[type];
        const relationLabel = entry ? t(entry[0], null, entry[1]) : '';
        const from = firstValue(relation, ['fromLabel', 'sourceLabel', 'from', 'sourceId']);
        const to = firstValue(relation, ['toLabel', 'targetLabel', 'to', 'targetId']);
        if (isPresent(from) && isPresent(to)) {
            const fromText = spatialRelationEndpoint(from, factsById, relation, 'from');
            const toText = spatialRelationEndpoint(to, factsById, relation, 'to');
            return t('spatial.relations.link', {
                from: fromText, relation: relationLabel || formatValue(relation.type), to: toText
            }, `${fromText} → ${relationLabel || formatValue(relation.type)} → ${toText}`);
        }
        return relationLabel || t('spatial.relations.runtime', null, '运行时范围关系');
    }

    function uniqueSpatialFacts(values) {
        const groups = new Map();
        values.forEach(value => {
            if (!isObject(value)) {
                const key = String(value);
                if (!groups.has(key)) groups.set(key, value);
                return;
            }
            const identity = [
                value.skillId || '', value.semantic || '', value.resolution || '',
                spatialSignature(value), spatialCenterText(spatialAnchorValue(value)),
                spatialConditionText(value.condition ?? value.conditions), spatialVariantTexts(value).join('|')
            ].join('::');
            const timing = spatialTimingText(value);
            if (!groups.has(identity)) {
                groups.set(identity, Object.assign({}, value, { _spatialTimings: timing ? [timing] : [] }));
                return;
            }
            const existing = groups.get(identity);
            if (timing && !existing._spatialTimings.includes(timing)) existing._spatialTimings.push(timing);
        });
        return [...groups.values()];
    }

    function spatialMetrics() {
        const spatial = state.analysis.spatial || emptyAnalysis().spatial;
        const targeting = state.analysis.basic?.targeting || {};
        const castLimits = collection(spatial.castLimits);
        const fallbackCastDistance = targeting.castDistance ?? state.currentData?.castData?.castDistance;
        const fallbackCastScalar = spatialScalar(fallbackCastDistance);
        if (!castLimits.length && fallbackCastScalar.text
            && (fallbackCastScalar.unresolved
                || !Number.isFinite(Number(fallbackCastScalar.scalar))
                || Number(fallbackCastScalar.scalar) !== 0)) {
            castLimits.push({ value: fallbackCastDistance });
        }
        const cards = [];
        const addFacts = (facts, key, label, category, important, qualifier) => {
            uniqueSpatialFacts(collection(facts)).forEach(fact => {
                const geometry = spatialGeometryText(fact, category);
                if (!geometry) return;
                cards.push({
                    key, label,
                    value: qualifier ? `${qualifier} · ${geometry}` : geometry,
                    unit: spatialFactUnit(fact), important: Boolean(important), wide: false
                });
            });
        };
        addFacts(castLimits, 'spatialCastLimit', t('metrics.spatial.castLimit', null, '施放距离'), 'cast', false);
        addFacts(spatial.selectionHints, 'spatialSelectionHint',
            t('metrics.spatial.selectionHint', null, '操作提示'), 'shape', false);
        const impacts = collection(spatial.impactVolumes);
        const impactSourceIds = new Set(impacts.map(fact => fact?.sourceFactId).filter(Boolean));
        const standaloneSearches = collection(spatial.targetSearches)
            .filter(fact => !impactSourceIds.has(fact?.id));
        addFacts(impacts, 'spatialImpactVolume',
            t('metrics.spatial.actualImpact', null, '实际判定'), 'shape', true,
            t('spatial.purposes.impact', null, '命中'));
        addFacts(standaloneSearches, 'spatialTargetSearch',
            t('metrics.spatial.actualImpact', null, '实际判定'), 'shape', true,
            t('spatial.purposes.targetSearch', null, '索敌'));
        addFacts(spatial.collisionVolumes, 'spatialCollisionVolume',
            t('metrics.spatial.actualImpact', null, '实际判定'), 'shape', true,
            t('spatial.purposes.collision', null, '碰撞'));
        addFacts(spatial.persistentFields, 'spatialPersistentField',
            t('metrics.spatial.persistentField', null, '持续领域'), 'shape', true);

        const allFacts = [
            ...collection(spatial.castLimits), ...collection(spatial.selectionHints),
            ...collection(spatial.targetSearches), ...collection(spatial.impactVolumes),
            ...collection(spatial.persistentFields), ...collection(spatial.collisionVolumes)
        ];
        const centers = [...new Set(allFacts.map(spatialAnchorValue).map(spatialCenterText).filter(Boolean))];
        centers.forEach(center => cards.push({
            key: 'spatialEffectCenter', label: t('metrics.spatial.effectCenter', null, '生效中心'),
            value: center, unit: '', important: false, wide: false
        }));

        const factsById = new Map(allFacts.filter(fact => isObject(fact) && isPresent(fact.id))
            .map(fact => [String(fact.id), fact]));
        const relationPriority = {
            sharesvalue: 0, inheritsblackboard: 1, spawns: 2,
            targets: 3
        };
        const normalizeRelation = relation => String(relation?.type || '').toLowerCase().replace(/[_\s-]+/g, '');
        const rawRelations = collection(spatial.relations).filter(relation =>
            !(normalizeRelation(relation) === 'inheritsblackboard' && relation?.status === 'disabled')
            && normalizeRelation(relation) !== 'producestargetgroup'
            && !String(relation?.from || '').startsWith('target-group:')
            && !String(relation?.to || '').startsWith('target-group:')).sort((left, right) =>
            (relationPriority[normalizeRelation(left)] ?? 99) - (relationPriority[normalizeRelation(right)] ?? 99));
        const relations = rawRelations.map(relation => spatialRelationText(relation, factsById)).filter(Boolean);
        const hints = collection(spatial.selectionHints);
        const actual = [...collection(spatial.impactVolumes), ...collection(spatial.targetSearches)];
        if (hints.length && actual.length) {
            const hintSignatures = new Set(hints.map(spatialSignature));
            const actualSignatures = new Set(actual.map(spatialSignature));
            const same = hintSignatures.size === actualSignatures.size
                && [...hintSignatures].every(signature => actualSignatures.has(signature));
            if (!same) relations.unshift(t('spatial.relations.hintMismatch', null, '操作提示与实际判定不同'));
        }
        const uniqueRelations = [...new Set(relations)];
        if (uniqueRelations.length) cards.push({
            key: 'spatialRelations', label: t('metrics.spatial.relations', null, '范围关系'),
            value: [
                ...uniqueRelations.slice(0, 8),
                ...(uniqueRelations.length > 8
                    ? [t('spatial.relations.more', { count: uniqueRelations.length - 8 },
                        `另 ${uniqueRelations.length - 8} 项关系`)] : [])
            ].join(t('spatial.relations.separator', null, '；')),
            unit: [...new Set(rawRelations.map(relation => spatialConditionText(relation?.condition)).filter(Boolean))]
                .map(condition => t('spatial.conditions.prefixed', { condition }, `条件：${condition}`)).join(' · '),
            important: false, wide: true
        });
        return cards;
    }

    function coreMetrics() {
        const basic = state.analysis.basic;
        const raw = state.currentData || {};
        const hitGroups = groupedHits();
        const hitFrames = hitGroups.map(hit => Number(hit.startFrame)).filter(Number.isFinite);
        const runtimeCast = basic.runtimeCast || {};
        const targeting = basic.targeting || {};
        const mobility = basic.mobility || {};
        const patch = state.currentPatch || {};
        const runtimeCooldown = runtimeCast.cooldownTime ?? raw.castData?.cooldownTime;
        const definitions = [
            ['durationFrame', metricLabel('durationFrame', '动作总时长'), firstValue(basic, ['durationFrame', 'durationFrames', 'totalFrames']) ?? raw.durationFrame, true],
            ['exclusiveFrame', metricLabel('exclusiveFrame', '排他期'), firstValue(basic, ['exclusiveFrame', 'exclusiveFrames']) ?? raw.exclusiveFrame, true],
            ['offsetRecordFrame', metricLabel('offsetRecordFrame', '续段记录帧'), Number(firstValue(basic, ['offsetRecordFrame', 'offsetFrame']) ?? raw.offsetRecordFrame) > 0
                ? firstValue(basic, ['offsetRecordFrame', 'offsetFrame']) ?? raw.offsetRecordFrame : undefined, true],
            ['firstHitFrame', metricLabel('firstHitFrame', '首段命中'), firstValue(basic, ['firstHitFrame', 'startupFrame', 'startupFrames']) ?? (hitFrames.length ? Math.min(...hitFrames) : undefined), true],
            ['lastHitFrame', metricLabel('lastHitFrame', '末段命中'), firstValue(basic, ['lastHitFrame']) ?? (hitFrames.length ? Math.max(...hitFrames) : undefined), false],
            ['hitCount', metricLabel('hitCount', '命中段数'), firstValue(basic, ['hitCount']) ?? hitGroups.length, true],
            ['runtimeCooldown', t('metrics.runtimeCooldown', null, '运行时冷却'), hasNonZeroValue(runtimeCooldown) ? runtimeCooldown : undefined, false],
            ['costCommitFrame', t('metrics.costCommitFrame', null, '资源提交帧'), runtimeCast.startCdFrame ?? raw.castData?.startCdFrame, false],
            ['attackRangeType', t('metrics.attackRangeType', null, '攻击距离类型'), targeting.attackRangeType, false],
            ['confirmedPoiseDamage', t('metrics.confirmedPoiseDamage', null, '确定路径总削韧'), numericPoiseSummary(hitGroups), false],
            ['patchCost', t('metrics.patchCost', null, '等级配置消耗'), hasNonZeroValue(patch.costValue) ? `${costTypeLabel(patch.costType)} ${formatValue(patch.costValue)}` : undefined, false],
            ['runtimeCost', t('metrics.runtimeCost', null, '运行时消耗'), hasNonZeroValue(runtimeCast.costValue) ? `${costTypeLabel(runtimeCast.costType)} ${formatValue(resolvedScalar(runtimeCast.costValue))}` : undefined, false],
            ['skillSuperArmor', t('metrics.skillSuperArmor', null, '技能抗打断'), superArmorSummary(), true],
            ['canMove', t('metrics.canMove', null, '可移动施放'), mobility.canMove === true ? true : undefined, false],
            ['canCastInAir', t('metrics.canCastInAir', null, '可空中施放'), mobility.canCastInAir === true ? true : undefined, false],
            ['dontInterruptCombo', t('metrics.dontInterruptCombo', null, '保持连段标记'), raw.dontInterruptCombo === true ? true : undefined, false]
        ];
        return definitions.filter(row => isPresent(row[2]));
    }

    function patchMetrics() {
        const patch = state.currentPatch || {};
        const hasCost = hasNonZeroValue(patch.costValue);
        return [
            ['level', t('metrics.level', null, '等级'), patch.level],
            ['cooldown', metricLabel('cooldown', '冷却'), hasNonZeroValue(patch.coolDown) ? patch.coolDown : undefined],
            ['costType', t('metrics.costType', null, '消耗类型'), hasCost ? costTypeLabel(patch.costType) : undefined],
            ['costValue', t('metrics.costValue', null, '消耗值'), hasCost ? patch.costValue : undefined]
        ].filter(row => isPresent(row[2]));
    }

    function renderIdentity() {
        const owner = state.activeOwner;
        const raw = state.currentData || {};
        const basic = state.analysis.basic;
        const patch = state.currentPatch || {};
        const icon = skillIconPath(patch.iconId || owner.group.icon) || owner.character.icon || '';
        const entityLabel = owner.character.entityKind === 'enemy'
            ? t('directory.entityKinds.monster', null, '怪物')
            : (owner.character.entityKind === 'character'
                ? t('directory.entityKinds.character', null, '角色')
                : t('directory.entityKinds.category', null, '归类'));
        const isEnemy = owner.character.entityKind === 'enemy';
        const title = gameText(patch.skillName,
            firstValue(basic, ['name', 'skillName', 'title']) || raw.skillName || owner.item.displayName);
        const levels = [...new Set(patchesFor(owner.item.id).map(item => Number(item.level)))].sort((a, b) => a - b);
        const options = (levels.length ? levels : [state.level]).map(level =>
            `<option value="${escapeHtml(level)}"${Number(level) === Number(state.level) ? ' selected' : ''}>${escapeHtml(t('units.level', { value: level }, `等级 ${level}`))}</option>`).join('');
        const tags = [
            enumValueLabel('castTypes', raw.castType),
            enumValueLabel('skillSpecifications', raw.skillSpecification),
            enumValueLabel('passiveSkillTypes', raw.passiveSkillType)
        ].filter(Boolean);
        const code = window.AKEUI.element('code', 'ake-ui-detail-id', owner.item.id);
        code.title = owner.item.id;
        const ownerPlugin = owner.character.entityKind === 'character' ? 'v3_character'
            : (owner.character.entityKind === 'enemy' ? 'v3_enemy' : '');
        const ownerLink = ownerPlugin
            ? window.AKEUI.entryLink({ plugin: ownerPlugin, id: owner.character.id, label: owner.character.name, content: owner.character.name })
            : null;
        const detailHeader = window.AKEUI.detailHeader({
            icon: icon ? { src: icon } : null,
            beforeTitle: ownerLink,
            eyebrow: isEnemy ? entityLabel : owner.group.displayName,
            title,
            subtitle: raw.skillId || owner.item.id,
            after: code
        });
        return `${detailHeader?.outerHTML || ''}
        <div class="combatv3-context-row">
            <label class="combatv3-context-item"><span>${escapeHtml(t('metrics.level', null, '等级'))}</span><select id="combatv3LevelSelect"${levels.length <= 1 ? ' disabled' : ''}>${options}</select></label>
            <span class="combatv3-context-item"><span>${escapeHtml(entityLabel)}</span><strong>${escapeHtml(owner.character.name)}</strong></span>
            ${isEnemy ? '' : `<span class="combatv3-context-item"><span>${escapeHtml(t('directory.groupLabel', null, '技能组'))}</span><strong>${escapeHtml(owner.group.displayName)}</strong></span>`}
        </div>
        ${tags.length ? `<div class="ake-ui-detail-badges">${tags.map((tag, index) => `<span class="ake-ui-badge"${index === 0 ? ' data-tone="accent"' : ''}>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}`;
    }

    function renderCore() {
        const metrics = coreMetrics();
        const standardHtml = metrics.map(([key, label, rawValue, important]) => {
            const value = metricValue(key, rawValue);
            return `<div class="combatv3-metric${important ? ' is-important' : ''}"><span class="combatv3-metric-label">${escapeHtml(label)}</span>
                <strong class="combatv3-metric-value">${escapeHtml(value.value)}</strong>${value.unit ? `<span class="combatv3-metric-unit">${escapeHtml(value.unit)}</span>` : ''}</div>`;
        }).join('');
        const spatialHtml = spatialMetrics().map(metric =>
            `<div class="combatv3-metric combatv3-metric--spatial${metric.wide ? ' combatv3-metric--wide' : ''}${metric.important ? ' is-important' : ''}">
                <span class="combatv3-metric-label">${escapeHtml(metric.label)}</span>
                <strong class="combatv3-metric-value">${escapeHtml(metric.value)}</strong>
                ${metric.unit ? `<span class="combatv3-metric-unit">${escapeHtml(metric.unit)}</span>` : ''}</div>`).join('');
        const metricHtml = standardHtml || spatialHtml
            ? `${standardHtml}${spatialHtml}`
            : `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noCoreMetrics', null, '分析器未返回核心指标'))}</div>`;
        const patches = patchMetrics();
        const patchHtml = patches.length ? `<section class="ake-ui-section">
            <header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${escapeHtml(t('sections.skillLevelConfiguration', null, '技能等级配置'))}</h3></header>
            <div class="combatv3-metric-grid">${patches.map(([key, label, rawValue]) => {
                const value = metricValue(key, rawValue);
                return `<div class="combatv3-metric"><span class="combatv3-metric-label">${escapeHtml(label)}</span>
                    <strong class="combatv3-metric-value">${escapeHtml(value.value)}</strong>${value.unit ? `<span class="combatv3-metric-unit">${escapeHtml(value.unit)}</span>` : ''}</div>`;
            }).join('')}</div></section>` : '';
        return `${patchHtml}<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('sections.coreMetrics', null, '核心指标'))}</h2>
            <span class="ake-ui-section__meta">${escapeHtml(t('sectionNotes.keyCombatFields', null, '关键战斗字段'))}</span></header><div class="combatv3-metric-grid">${metricHtml}</div></section>`;
    }

    function frameOf(item, names) {
        const value = Number(firstValue(item, names));
        return Number.isFinite(value) ? value : null;
    }

    function timelineMax() {
        const values = [Number(state.currentData?.durationFrame), Number(firstValue(state.analysis.basic, ['durationFrame', 'durationFrames', 'totalFrames']))];
        [...state.analysis.windows, ...state.analysis.hits, ...state.analysis.events].forEach(item => {
            values.push(frameOf(item, ['frame', 'startFrame', 'start', 'from']), frameOf(item, ['endFrame', 'end', 'to']));
        });
        return Math.max(1, ...values.filter(Number.isFinite));
    }

    function windowKind(item) {
        const text = `${item.kind || ''} ${item.type || ''} ${item.category || ''} ${item.label || ''}`.toLowerCase();
        if (/hit|damage|命中|伤害/.test(text)) return 'hit';
        if (/invul|dodge|无敌|闪避/.test(text)) return 'invulnerable';
        if (/cancel|interrupt|allownext|combocache|candash|取消|接续|缓存/.test(text)) return 'cancel';
        if (/offset|exclusive|续段|排他/.test(text)) return 'offset';
        if (/resource|cost|sp|资源|消耗/.test(text)) return 'resource';
        return 'default';
    }

    function windowLabel(item, index) {
        const kind = firstValue(item, ['kind']);
        const typeLabel = isPresent(item.type) ? actionLabel(item.type) : '';
        return localizedEntry(WINDOW_LABELS[kind]) || typeLabel || firstValue(item, ['label', 'name', 'title'])
            || firstValue(item, ['type', '__key'])
            || t('windows.named', { index: index + 1 }, `窗口 ${index + 1}`);
    }

    function resolvedLabel(value) {
        return formatValue(resolvedScalar(value));
    }

    function timelineScalarText(value) {
        const scalar = resolvedScalar(value);
        if (!isPresent(scalar)) return '';
        if (typeof scalar === 'boolean' || typeof scalar === 'number') return formatValue(scalar);
        if (typeof scalar === 'string') return timelineEnumLabel(scalar);
        return '';
    }

    function timelineDetailRank(key) {
        const index = TIMELINE_DETAIL_PRIORITY.indexOf(key);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    }

    function timelineDescriptorLabel(descriptor) {
        const fallback = isPresent(descriptor.label)
            ? String(descriptor.label)
            : timelineFieldLabel(descriptor.key);
        if (!descriptor.labelKey) return fallback;
        const key = String(descriptor.labelKey);
        return key.startsWith('modules.')
            ? (window.akeI18n?.t(key, null, fallback) ?? fallback)
            : t(key, null, fallback);
    }

    function compactTimelineDetail(value, depth) {
        const currentDepth = Number(depth) || 0;
        if (!isPresent(value) || currentDepth > 4) return '';
        if (Array.isArray(value)) {
            const limit = 4;
            const parts = value.slice(0, limit)
                .map(item => compactTimelineDetail(item, currentDepth + 1))
                .filter(Boolean);
            if (value.length > limit) parts.push(timelineMoreLabel(value.length - limit));
            return parts.join(' / ');
        }
        if (!isObject(value)) return timelineScalarText(value);
        if (Object.prototype.hasOwnProperty.call(value, 'key')
            && Object.prototype.hasOwnProperty.call(value, 'value')) {
            const detail = compactTimelineDetail(value.value, currentDepth + 1);
            return detail ? `${timelineDescriptorLabel(value)} ${detail}` : '';
        }
        if (Object.prototype.hasOwnProperty.call(value, 'displayValue')) {
            const detail = compactTimelineDetail(value.displayValue, currentDepth + 1);
            const unit = timelineScalarText(value.displayUnit);
            return [detail, unit].filter(Boolean).join(' ');
        }
        if (Object.prototype.hasOwnProperty.call(value, 'value')) {
            return compactTimelineDetail(value.value, currentDepth + 1);
        }
        if (isPresent(value.text) && typeof value.text === 'string') return timelineEnumLabel(value.text);

        const parts = [];
        const entries = Object.entries(value)
            .filter(([key, child]) => !TIMELINE_DETAIL_META_KEYS.has(key) && isPresent(child))
            .sort(([left], [right]) => timelineDetailRank(left) - timelineDetailRank(right));
        let cursor = 0;
        for (; cursor < entries.length && parts.length < 8; cursor += 1) {
            const [key, child] = entries[cursor];
            const detail = compactTimelineDetail(child, currentDepth + 1);
            if (detail) parts.push(`${timelineFieldLabel(key)} ${detail}`);
        }
        if (cursor < entries.length) parts.push(timelineMoreLabel(entries.length - cursor));
        return parts.join(' · ');
    }

    function windowDetail(item) {
        const details = isObject(item.details) ? item.details : item;
        let detail = '';
        if (item.kind === 'superArmor' || /setsuperarmor/i.test(item.type || '')) {
            const armor = details.superArmorValue ?? item.superArmorValue;
            const impact = details.impactResistance ?? item.impactResistance;
            detail = [isPresent(armor) ? `${timelineFieldLabel('superArmorValue')} ${compactTimelineDetail(armor)}` : '',
                isPresent(impact) ? `${timelineFieldLabel('impactResistance')} ${compactTimelineDetail(impact)}` : '']
                .filter(Boolean).join(' · ');
        }
        if (!detail && (item.kind === 'buffSuperArmor' || item.kind === 'damageImmune')) {
            detail = timelineScalarText(item.buffId);
        }
        if (!detail && item.kind === 'allowNextSkill') detail = compactTimelineDetail(item.allowedSkillIds || []);
        if (!detail && item.kind === 'comboCache') {
            detail = (item.mappings || []).slice(0, 4).map(mapping => {
                const command = timelineScalarText(mapping.command)
                    || t('timeline.summary.input', null, '输入');
                const skillId = compactTimelineDetail(mapping.skillId);
                return skillId ? `${command} → ${skillId}` : command;
            }).join(' / ');
            if ((item.mappings || []).length > 4) {
                detail += `${detail ? ' / ' : ''}${timelineMoreLabel(item.mappings.length - 4)}`;
            }
        }
        if (!detail && (item.kind === 'hitStop' || item.kind === 'timeDilation')) {
            const duration = compactTimelineDetail(item.duration);
            if (duration) detail = t('timeline.summary.duration', { value: duration }, `持续 ${duration}`);
        }
        if (!detail && item.kind === 'movement') detail = compactTimelineDetail(item.values);
        if (!detail && item.kind === 'damage') {
            const count = isPresent(item.unitCount) ? item.unitCount : 0;
            detail = t('timeline.summary.damageUnits', { count }, `${count} 个结算单元`);
            if (item.targetGroupKey) detail += ` · ${timelineFieldLabel('targetGroupKey')} ${timelineScalarText(item.targetGroupKey)}`;
        }
        if (!detail) {
            detail = compactTimelineDetail(firstValue(item, ['detail', 'details', 'description', 'note', 'condition']));
        }
        if (!detail) detail = compactTimelineDetail(item.summaryFields);
        return detail;
    }

    function renderWindowStage(rows, emptyText) {
        if (!rows.length) return `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(emptyText)}</div>`;
        const max = timelineMax();
        const ruler = [0, 20, 40, 60, 80, 100].map(percent => `<span>${escapeHtml(Math.round(max * percent / 100))}</span>`).join('');
        const lanes = rows.map((item, index) => {
            const start = frameOf(item, ['startFrame', 'frame', 'start', 'from']) ?? 0;
            const end = frameOf(item, ['endFrame', 'end', 'to']) ?? start;
            const left = Math.max(0, Math.min(100, start / max * 100));
            const width = Math.max(0.35, Math.min(100 - left, Math.max(0, end - start) / max * 100));
            const label = windowLabel(item, index);
            const detail = windowDetail(item);
            const frameText = start === end
                ? t('units.frames', { value: formatValue(start) }, `${formatValue(start)} 帧`)
                : t('units.frameRange', { start: formatValue(start), end: formatValue(end) }, `${formatValue(start)}–${formatValue(end)} 帧`);
            const tooltip = `${label} · ${frameText}${isPresent(detail) ? ` · ${formatValue(detail)}` : ''}`;
            const kind = windowKind(item);
            const blockClass = start === end ? 'combatv3-window-point' : `combatv3-window combatv3-window--${kind}`;
            return `<div class="combatv3-window-lane"><span class="combatv3-lane-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
                <div class="combatv3-lane-track"><span class="${blockClass}" style="left:${escapeHtml(left)}%;width:${escapeHtml(width)}%;"
                    data-combatv3-tooltip="${escapeHtml(tooltip)}">${start === end ? '' : `<span>${escapeHtml(label)}</span>`}</span></div></div>`;
        }).join('');
        return `<div class="combatv3-window-scroll"><div class="combatv3-window-stage"><div class="combatv3-window-ruler">
            <span class="combatv3-lane-label">${escapeHtml(t('units.frames', { value: '' }, '帧').trim())}</span><div class="combatv3-ruler-track">${ruler}</div></div>${lanes}</div></div>`;
    }

    function renderWindows() {
        return `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('sections.keyWindows', null, '关键窗口'))}</h2>
            <span class="ake-ui-section__meta">${escapeHtml(t('counts.items', { count: state.analysis.windows.length }, `${state.analysis.windows.length} 项`))}</span></header>
            ${renderWindowStage(state.analysis.windows, t('empty.noKeyWindows', null, '未识别到命中、取消、抗打断、无敌或续段窗口'))}</section>`;
    }

    function hitCell(hit, paths) {
        return formatValue(firstValue(hit, paths));
    }

    function hitScale(hit) {
        const value = resolvedScalar(hit.atkScale);
        if (typeof value === 'number') {
            const amount = formatValue(value * 100);
            return t('units.atkPercent', { value: amount }, `${amount}% ATK`);
        }
        return resolvedLabel(hit.atkScale);
    }

    function hitPoise(hit) {
        return resolvedLabel(hit.poiseValue);
    }

    function hitResources(group) {
        return group.resources.filter(cost => hasNonZeroValue(cost.costValue))
            .map(cost => `${costTypeLabel(cost.costType) || t('enums.costTypes.resource', null, '资源')} ${resolvedLabel(cost.costValue)}`)
            .concat(group.effects).join(' / ');
    }

    function renderHits() {
        const hits = groupedHits();
        const hitTiming = hit => {
            if (!isPresent(hit.startFrame)) return '--';
            return hit.endFrame !== hit.startFrame
                ? t('units.frameRange', { start: formatValue(hit.startFrame), end: formatValue(hit.endFrame) },
                    `${formatValue(hit.startFrame)}–${formatValue(hit.endFrame)} 帧`)
                : t('units.frames', { value: formatValue(hit.startFrame) }, `${formatValue(hit.startFrame)} 帧`);
        };
        const body = hits.map((hit, index) => `<tr><td>${escapeHtml(index + 1)}</td>
            <td>${escapeHtml(hitTiming(hit))}</td>
            <td>${escapeHtml([...hit.damageTypes].map(attackAttributeLabel).join(' / ') || '--')}</td>
            <td>${escapeHtml(hit.hp.map(hitScale).join(' / ') || '--')}</td>
            <td>${escapeHtml(hit.poise.map(hitPoise).join(' / ') || '--')}</td>
            <td data-column="logic">${escapeHtml(hitResources(hit) || '--')}</td>
            <td data-column="note">${escapeHtml([hit.branchPath.join(' → '), hit.targetGroupKey].filter(Boolean).join(' · ') || '--')}</td></tr>`).join('');
        return `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('sections.hitLedger', null, '命中账本'))}</h2>
            <span class="ake-ui-section__meta">${escapeHtml(t('counts.hits', { count: hits.length }, `${hits.length} 段`))}</span></header>
            ${hits.length ? `<div class="ake-ui-table-shell"><table class="combatv3-ledger"><thead><tr><th>${escapeHtml(t('columns.hits.index', null, '#'))}</th><th>${escapeHtml(t('columns.hits.time', null, '时点'))}</th><th>${escapeHtml(t('columns.hits.type', null, '类型'))}</th><th>${escapeHtml(t('columns.hits.damage', null, '倍率/伤害'))}</th><th>${escapeHtml(t('columns.hits.poise', null, '破韧/失衡'))}</th><th>${escapeHtml(t('columns.hits.resource', null, '资源/异常'))}</th><th>${escapeHtml(t('columns.hits.note', null, '条件/目标'))}</th></tr></thead><tbody>${body}</tbody></table></div>`
                : `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noHits', null, '未识别到命中结算'))}</div>`}</section>`;
    }

    function isPerformanceEvent(event) {
        if (event.isCombat === true || event.combat === true) return false;
        if (event.isCombat === false || event.combat === false || event.presentation === true) return true;
        const text = `${event.class || ''} ${event.category || ''} ${event.kind || ''} ${event.type || ''}`.toLowerCase();
        return /presentation|performance|visual|vfx|effect|audio|sound|camera|ui|animation/.test(text);
    }

    function eventLabel(event, index) {
        const typeLabel = isPresent(event.type) ? actionLabel(event.type) : '';
        return typeLabel || firstValue(event, ['label', 'name', 'title'])
            || firstValue(event, ['action', 'type', 'kind', '__key'])
            || t('events.named', { index: index + 1 }, `事件 ${index + 1}`);
    }

    function renderTimeline() {
        const events = state.showPerformance ? state.analysis.events : state.analysis.events.filter(event => !isPerformanceEvent(event));
        state.timelineEvents = events;
        const rows = events.map((event, index) => ({ ...event, label: eventLabel(event, index) }));
        return `<div class="combatv3-context-row"><button type="button" class="ake-ui-segmented__button" data-combatv3-action="toggle-performance"
            aria-pressed="${state.showPerformance ? 'true' : 'false'}">${escapeHtml(state.showPerformance
                ? t('buttons.showPerformance', null, '含表现事件')
                : t('buttons.combatOnly', null, '仅战斗事件'))}</button>
            <span class="ake-ui-section__meta">${escapeHtml(t('counts.filteredEvents', {
                visible: events.length,
                total: state.analysis.events.length
            }, `${events.length} / ${state.analysis.events.length} 项`))}</span></div>
            ${renderWindowStage(rows, t('empty.noTimelineEvents', null, '分析器未返回战斗时间轴事件'))}`;
    }

    function linkClass(link) {
        const text = `${link.kind || ''} ${link.type || ''} ${link.result || ''}`.toLowerCase();
        if (/condition|check|条件/.test(text)) return 'is-condition';
        if (/fail|failure|失败/.test(text)) return 'is-failure';
        if (/result|success|结果/.test(text)) return 'is-result';
        return 'is-event';
    }

    function renderLogic() {
        const links = state.analysis.links;
        const branchEvents = state.analysis.events.filter(event => Array.isArray(event.branchPath) && event.branchPath.length);
        if (!links.length && !branchEvents.length) {
            return `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noLogic', null, '未识别到条件、跳转或后继动作'))}</div>`;
        }
        const nodes = links.map((link, index) => {
            const title = firstValue(link, ['label', 'name', 'title', 'to', 'targetId', 'id', '__key'])
                || t('logic.named', { index: index + 1 }, `逻辑 ${index + 1}`);
            const rawKicker = firstValue(link, ['kind', 'type', 'category']);
            const kicker = rawKicker
                ? (ACTION_LABELS[rawKicker] ? actionLabel(rawKicker) : timelineEnumLabel(rawKicker))
                : t('logic.link', null, '链接');
            const detail = firstValue(link, ['condition', 'detail', 'description', 'from', 'sourceId', 'path']);
            return `<article class="combatv3-logic-node ${linkClass(link)}"><div class="combatv3-logic-kicker">${escapeHtml(kicker)}</div>
                <div class="combatv3-logic-title">${escapeHtml(title)}</div>${isPresent(detail) ? `<div class="combatv3-logic-detail">${escapeHtml(compactTimelineDetail(detail))}</div>` : ''}</article>`;
        });
        branchEvents.forEach((event, index) => {
            const frame = t('units.frames', { value: formatValue(event.startFrame ?? '--') }, `${formatValue(event.startFrame ?? '--')} 帧`);
            nodes.push(`<article class="combatv3-logic-node is-condition"><div class="combatv3-logic-kicker">${escapeHtml(t('logic.conditionBranch', null, '条件分支'))}</div>
                <div class="combatv3-logic-title">${escapeHtml(event.branchPath.join(' → '))}</div>
                <div class="combatv3-logic-detail">${escapeHtml(eventLabel(event, index))} · ${escapeHtml(frame)}</div></article>`);
        });
        return `<div class="combatv3-logic-node"><div class="combatv3-logic-kicker">${escapeHtml(t('logic.rootSkill', null, '根技能'))}</div>
            <div class="combatv3-logic-title">${escapeHtml(state.activeSkillId)}</div></div>
            <div class="combatv3-logic-branches">${nodes.join('')}</div>`;
    }

    function blackboardRows() {
        const value = state.analysis.blackboard;
        if (Array.isArray(value?.entries)) return value.entries.map((row, index) => [row?.key ?? index,
            `${formatValue(row?.value)} · ${row?.source === 'patch'
                ? t('blackboard.patchSource', { level: row?.level ?? '?' }, `SkillPatch Lv.${row?.level ?? '?'}`)
                : t('blackboard.defaultSource', null, 'SkillData 默认值')}`]);
        if (Array.isArray(value)) return value.map((row, index) => [row?.key ?? row?.name ?? index, row?.resolvedValue ?? row?.value ?? row]);
        if (isObject(value)) return Object.entries(value);
        return isPresent(value) ? [['value', value]] : [];
    }

    function renderDebug() {
        const warnings = state.analysis.warnings;
        const boards = blackboardRows();
        const warningHtml = warnings.length ? warnings.map(warning => `<div class="combatv3-note is-warning">${escapeHtml(warningText(warning))}</div>`).join('') : '';
        const boardHtml = boards.length ? `<dl class="combatv3-definition-list">${boards.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(formatValue(value))}</dd>`).join('')}</dl>`
            : `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noBlackboard', null, '没有解析后的黑板值'))}</div>`;
        const events = state.analysis.events;
        const eventTable = events.length ? `<div class="ake-ui-table-shell"><table class="ake-ui-table"><thead><tr><th>${escapeHtml(t('columns.events.index', null, '#'))}</th><th>${escapeHtml(t('columns.events.category', null, '分类'))}</th><th>${escapeHtml(t('columns.events.time', null, '时点'))}</th><th>${escapeHtml(t('columns.events.event', null, '事件'))}</th><th>${escapeHtml(t('columns.events.details', null, '详情'))}</th></tr></thead><tbody>
            ${events.map((event, index) => `<tr><td>${escapeHtml(index + 1)}</td><td>${escapeHtml(isPerformanceEvent(event)
                ? t('enums.eventKinds.presentation', null, '表现')
                : t('enums.eventKinds.combat', null, '战斗'))}</td>
                <td>${escapeHtml(formatValue(firstValue(event, ['frame', 'startFrame', 'time'])))}</td><td>${escapeHtml(eventLabel(event, index))}</td>
                <td data-column="note">${escapeHtml(compactTimelineDetail(firstValue(event, ['detail', 'details', 'description', 'note', 'condition'])))}</td></tr>`).join('')}</tbody></table></div>` : '';
        return `${warningHtml}<section class="ake-ui-section"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${escapeHtml(t('sections.blackboardResolution', null, '黑板解析'))}</h3></header>${boardHtml}</section>
            <section class="ake-ui-section"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${escapeHtml(t('sections.allEvents', null, '全部事件'))}</h3><span class="ake-ui-section__meta">${escapeHtml(t('counts.events', { count: events.length }, `${events.length} 个事件`))}</span></header>${eventTable || `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noEvents', null, '没有事件'))}</div>`}</section>
            <section class="ake-ui-section"><details class="combatv3-raw"><summary>${escapeHtml(t('raw.analyzerOutput', null, '分析器输出'))}</summary><pre>${escapeHtml(safeJson(state.analysisSource))}</pre></details>
            <details class="combatv3-raw"><summary>${escapeHtml(t('raw.currentPatch', null, '当前等级 SkillPatch'))}</summary><pre>${escapeHtml(safeJson(state.currentPatch))}</pre></details>
            <details class="combatv3-raw"><summary>${escapeHtml(t('raw.skillData', null, '原始 SkillData'))}</summary><pre>${escapeHtml(safeJson(state.currentData))}</pre></details></section>`;
    }

    function renderTabs() {
        const tabs = [
            ['timeline', t('tabs.timeline', null, '战斗时间轴')],
            ['logic', t('tabs.logic', null, '逻辑链')],
            ['debug', t('tabs.debug', null, '调试数据')]
        ];
        const content = state.activeTab === 'logic' ? renderLogic() : (state.activeTab === 'debug' ? renderDebug() : renderTimeline());
        return `<section class="ake-ui-section"><div class="ake-ui-tabs" data-variant="segment" data-layout="equal" role="tablist">${tabs.map(([id, label]) =>
            `<button type="button" class="ake-ui-tabs__button${state.activeTab === id ? ' is-active' : ''}" role="tab" data-combatv3-tab="${escapeHtml(id)}"
                aria-selected="${state.activeTab === id ? 'true' : 'false'}">${escapeHtml(label)}</button>`).join('')}</div>
            <div class="ake-ui-section" role="tabpanel">${content}</div></section>`;
    }

    function renderSourceWarning() {
        const dataState = window.akeDataSource?.getState?.();
        if (!dataState || dataState.selection === 'latest') return '';
        return `<div class="combatv3-note is-warning">${escapeHtml(t('sourceWarning', null,
            '当前 SkillData 使用共享最新数据，角色与等级表使用所选历史版本；跨版本字段仅供对照。'))}</div>`;
    }

    function renderDetail() {
        if (!state.currentData || !state.activeOwner) return;
        elements.detail.innerHTML = `${renderIdentity()}${renderSourceWarning()}${renderCore()}${renderWindows()}${renderHits()}${renderTabs()}`;
    }

    function setQuery(value) {
        state.query = String(value || '').trim().toLowerCase();
        if (elements.search && elements.search.value !== value) elements.search.value = value;
        if (elements.mobileSearch && elements.mobileSearch.value !== value) elements.mobileSearch.value = value;
        renderDirectories();
    }

    function onDirectoryClick(event) {
        const button = event.target.closest('[data-combatv3-action]');
        if (!button) return;
        const action = button.dataset.combatv3Action;
        const characterId = button.dataset.characterId;
        const groupId = button.dataset.groupId;
        if (action === 'toggle-character') {
            if (state.expandedCharacters.has(characterId)) state.expandedCharacters.delete(characterId);
            else state.expandedCharacters.add(characterId);
            renderDirectories();
        } else if (action === 'toggle-group') {
            const key = groupKey(characterId, groupId);
            if (state.expandedGroups.has(key)) state.expandedGroups.delete(key);
            else state.expandedGroups.add(key);
            renderDirectories();
        } else if (action === 'select-skill') {
            selectSkill(button.dataset.skillId, { characterId, groupId, updateUrl: true });
        }
    }

    function onDetailClick(event) {
        const tab = event.target.closest('[data-combatv3-tab]');
        if (tab) {
            state.activeTab = tab.dataset.combatv3Tab;
            renderDetail();
            return;
        }
        const action = event.target.closest('[data-combatv3-action]')?.dataset.combatv3Action;
        if (action === 'toggle-performance') {
            state.showPerformance = !state.showPerformance;
            renderDetail();
        }
    }

    function onDetailChange(event) {
        if (event.target.id !== 'combatv3LevelSelect') return;
        state.level = Number(event.target.value);
        state.currentPatch = selectedPatch(state.activeSkillId, state.level);
        updateDeepLink();
        const token = ++state.detailToken;
        elements.detail.innerHTML = loadingHtml(state.currentItem?.displayName || state.activeSkillId,
            t('loading.switchingLevel', null, '正在切换技能等级'));
        analyzeCurrent(token);
    }

    function showTooltip(target, event) {
        if (!elements.tooltip || !target?.dataset.combatv3Tooltip) return;
        elements.tooltip.textContent = target.dataset.combatv3Tooltip;
        elements.tooltip.classList.add('is-visible');
        elements.tooltip.setAttribute('aria-hidden', 'false');
        moveTooltip(event);
    }

    function moveTooltip(event) {
        if (!elements.tooltip?.classList.contains('is-visible')) return;
        elements.tooltip.style.left = `${Math.min(window.innerWidth - 300, event.clientX + 14)}px`;
        elements.tooltip.style.top = `${Math.min(window.innerHeight - 100, event.clientY + 14)}px`;
    }

    function hideTooltip() {
        if (!elements.tooltip) return;
        elements.tooltip.classList.remove('is-visible');
        elements.tooltip.setAttribute('aria-hidden', 'true');
    }

    function onPointerOver(event) {
        const target = event.target.closest('[data-combatv3-tooltip]');
        if (target) showTooltip(target, event);
    }

    function onOverlayClick(event) {
        if (event.target === elements.mobileOverlay) closeMobileList();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') closeMobileList();
    }

    async function fetchManifest() {
        const data = await window.akeAssetIndex.listJsonFiles('SkillData', { hidden: showHidden() });
        return Array.isArray(data) ? data : Object.values(data || {});
    }

    async function optionalTable(name) {
        try {
            return await window.AKEV3.table(name);
        } catch (error) {
            console.warn(`[${MODULE_ID}] Optional table unavailable: ${name}`, error);
            return {};
        }
    }

    async function load(options) {
        const preserve = options?.preserve === true;
        const token = ++state.loadToken;
        if (!preserve) elements.detail.innerHTML = loadingHtml(MODULE_TITLE(),
            t('loading.buildingDirectory', null, '正在建立角色与技能目录'), true);
        try {
            if (window.configLoaded) await window.configLoaded;
            const [manifest, characters, growth, patches, enemyDisplay, enemies, potentialTalents] = await Promise.all([
                fetchManifest(),
                window.AKEV3.table('CharacterTable'),
                window.AKEV3.table('CharGrowthTable'),
                window.AKEV3.table('SkillPatchTable'),
                window.AKEV3.table('EnemyTemplateDisplayInfoTable'),
                window.AKEV3.table('EnemyTable'),
                optionalTable('PotentialTalentEffectTable')
            ]);
            if (token !== state.loadToken) return;
            const previousId = preserve ? state.activeSkillId : '';
            const previousLevel = preserve ? state.level : null;
            state.rawManifest = manifest;
            state.manifest = manifest.filter(item => !isSuppressedEntity(item.id) && (showHidden() || !item.hidden))
                .sort((a, b) => Number(a.priority ?? 999999) - Number(b.priority ?? 999999) || String(a.id).localeCompare(String(b.id)));
            state.tables = { characters, growth, patches, enemyDisplay, enemies, potentialTalents };
            state.skillCache.clear();
            state.directory = buildDirectory(state.manifest, characters, growth, enemyDisplay, enemies);
            rebuildSkillIndex();
            renderDirectories();

            const deepId = state.pendingDeepId;
            state.pendingDeepId = '';
            const wantedId = deepId || previousId;
            if (wantedId && state.skillIndex.has(wantedId)) {
                await selectSkill(wantedId, { level: deepId ? state.level : previousLevel, updateUrl: !deepId });
                return;
            }
            if (deepId) {
                const existsButHidden = state.rawManifest.some(item => item.id === deepId);
                window.__akeRouter?.onDeepLinkNotFound?.(deepId, existsButHidden);
            }
            const firstCharacter = state.directory.find(character => !character.isOther) || state.directory[0];
            const firstOwner = firstCharacter && firstCharacter.groups[0]?.skills[0];
            if (firstOwner) await selectSkill(firstOwner.id, { level: state.level, updateUrl: true });
            else elements.detail.innerHTML = errorHtml(
                t('errors.emptyTitle', null, '没有可展示的数据'),
                t('errors.manifestEmpty', null, 'SkillData 清单为空'));
        } catch (error) {
            if (token !== state.loadToken) return;
            if (elements.meta) elements.meta.textContent = t('errors.readFailed', null, '读取失败');
            elements.list.innerHTML = '';
            if (elements.mobileList) elements.mobileList.innerHTML = '';
            elements.detail.innerHTML = errorHtml(t('errors.combatDataTitle', null, '战斗数据读取失败'), error.message || error);
        }
    }

    function onGlobalConfigChanged() {
        if (!document.body.contains(root)) return;
        load({ preserve: true });
    }

    function bind() {
        elements.list.addEventListener('click', onDirectoryClick);
        elements.mobileList?.addEventListener('click', onDirectoryClick);
        elements.search?.addEventListener('input', onSearchInput);
        elements.mobileSearch?.addEventListener('input', onSearchInput);
        elements.mobileButton?.addEventListener('click', openMobileList);
        elements.mobileClose?.addEventListener('click', closeMobileList);
        elements.mobileOverlay?.addEventListener('click', onOverlayClick);
        elements.detail.addEventListener('click', onDetailClick);
        elements.detail.addEventListener('change', onDetailChange);
        elements.detail.addEventListener('pointerover', onPointerOver);
        elements.detail.addEventListener('pointermove', moveTooltip);
        elements.detail.addEventListener('pointerout', hideTooltip);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('globalConfigChanged', onGlobalConfigChanged);
    }

    function onSearchInput(event) {
        setQuery(event.target.value);
    }

    function destroy() {
        state.loadToken += 1;
        state.detailToken += 1;
        elements.list.removeEventListener('click', onDirectoryClick);
        elements.mobileList?.removeEventListener('click', onDirectoryClick);
        elements.search?.removeEventListener('input', onSearchInput);
        elements.mobileSearch?.removeEventListener('input', onSearchInput);
        elements.mobileButton?.removeEventListener('click', openMobileList);
        elements.mobileClose?.removeEventListener('click', closeMobileList);
        elements.mobileOverlay?.removeEventListener('click', onOverlayClick);
        elements.detail.removeEventListener('click', onDetailClick);
        elements.detail.removeEventListener('change', onDetailChange);
        elements.detail.removeEventListener('pointerover', onPointerOver);
        elements.detail.removeEventListener('pointermove', moveTooltip);
        elements.detail.removeEventListener('pointerout', hideTooltip);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('globalConfigChanged', onGlobalConfigChanged);
        hideTooltip();
    }

    bind();
    window.__akeV3SkillController = {
        id: MODULE_ID,
        get title() { return MODULE_TITLE(); },
        refresh: () => load({ preserve: true }),
        selectSkill: (skillId, level) => selectSkill(skillId, { level, updateUrl: true }),
        destroy
    };
    window.AKEV3Skill = window.__akeV3SkillController;
    load();
})();
