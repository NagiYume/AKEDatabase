(function () {
    'use strict';
    if (window.AKELifeCatalog) return;
    const t = (key, args) => window.akeI18n.t(`modules.life.${key}`, args);
    // Stable routes are kind:source-key. Definitions are shared with global search.
    const definitions = {
        inn: [
            ['dish', 'InnDishTable'], ['drink', 'InnDrinkTable'], ['topic', 'InnTopicTable'],
            ['chef', 'InnCharSkillTable'], ['skill', 'InnSkillTable'], ['level', 'InnLevelTable'],
            ['expansion', 'InnExpansionTable'], ['milestone', 'InnMilestoneTable'],
            ['milestoneLevel', 'InnMilestoneLevelTable'], ['requirement', 'InnRequirementTable'],
            ['affix', 'InnAffixTable'], ['category', 'InnDishCategoryTable'],
            ['refresh', 'InnRandomRuleTable']
        ],
        farming: [
            ['animal', 'InnRanchAnimalTable'], ['feed', 'InnRanchFeedTable'],
            ['stable', 'InnRanchStableGroupTable'], ['crop', 'CropObtainWayTable'],
            ['soil', 'SoilMgrTable'], ['feature', 'SoilMgrFeatureTable'], ['state', 'InnRanchStateTable']
        ],
        gamble: [
            ['hand', 'GambleBattleHandTypeTable'], ['card', 'GambleBattleCardTable'],
            ['pool', 'GambleBattleCardPoolTable'], ['effect', 'GambleBattleEnemyBuffTable'],
            ['milestone', 'ActivityCommonUIMilestoneTable'], ['period', 'GambleBattleHandTypePoolTable']
        ]
    };
    const dependencies = {
        inn: ['InnDescribeTable', 'InnGoodsRandomTable', 'InnManagementConst',
            'CharacterTable', 'CropObtainWayTable', 'InnRanchAnimalTable', 'ShopGoodsTable'],
        farming: ['InnRanchStableId2GroupId', 'RanchConst', 'FactorySoilConst', 'InnDishTable', 'InnLevelTable'],
        gamble: ['GambleBattleConst', 'ActivityCommonCoinRewardTable', 'EnemyTable',
            'EnemyTemplateDisplayInfoTable', 'ActivityTable', 'DungeonTable', 'TimeRangeTable']
    };
    const textFields = ['name', 'desc', 'descText', 'handTypeName', 'clientShowName', 'itemDesc',
        'requirementText', 'menuDesc', 'desc1', 'desc2', 'extraDesc', 'objectiveDesc', 'objectiveTip1',
        'objectiveTip2', 'requirementDesc', 'unlockDesc', 'unlockQuestDesc', 'unlockText', 'descList', 'textId'];
    const farmingKinds = new Set(definitions.farming.map(([kind]) => kind));
    definitions.inn = [...definitions.inn, ...definitions.farming];
    dependencies.inn = [...new Set([...dependencies.inn, ...dependencies.farming])];
    const sprites = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/';
    // Source fields name these sprites; directories are verified local asset families.
    function entryIcon(kind, row, item) {
        const source = kind === 'animal' ? ['inn/animalicon/', row.icon]
            : kind === 'category' ? ['inn/recipetypetabicon/', row.iconId]
            : kind === 'topic' ? ['inn/topicchangebg/', row.iconId]
            : kind === 'feed' ? ['factory/crop/', row.detailIconId] : null;
        if (source?.[1]) return sprites + source[0] + encodeURIComponent(source[1]) + '.png';
        return item?.iconId ? sprites + 'itemiconbig/' + encodeURIComponent(item.iconId) + '.png' : undefined;
    }
    const fieldSets = {
        dish: ['price', 'timeCost', 'unlockLevel', 'unlockTopicStarNum'], drink: ['price', 'unlockLevel'],
        topic: ['unlockLevel', 'starRequiredScore', 'topicKPIScoreLimit', 'topicProfitScoreLimit',
            'topicKPIScoreRankPoint', 'topicProfitScoreRankPoint', 'topicObjectiveScoreFactor'],
        skill: ['unlockLevel'],
        level: ['innManagementLevel', 'exp', 'unlockStar', 'customerVolume', 'customerVolumeCost',
            'deskNum', 'kitchenStuffNum', 'menuDishNumRange', 'menuDrinkNumRange', 'menuDishTypeNumMin',
            'rareRate', 'tipRate', 'noTopicStarRequiredScore', 'noTopicKPIScoreLimit', 'noTopicProfitScoreLimit'],
        expansion: ['cost', 'unlockLevel', 'addFoodTraySize', 'addKitchenCharNum', 'addKitchenNum',
            'addKitchenQueueSize', 'addServingCounterSize'],
        milestone: ['level', 'progressReward'], milestoneLevel: ['level', 'progress'],
        stars: ['starsNum', 'customerVolumeRecoverAmount', 'customerVolumeRecoverInterval'],
        animal: ['yieldRate', 'lowYieldRate', 'highYieldRate', 'lowLevelFoodConsume', 'highLevelFoodConsume',
            'lowLevelProdMaxCount', 'highLevelProdMaxCount', 'productMaxCount'],
        feed: ['fullnessAddSeconds', 'happinessAddSeconds'], state: ['canFeedSeconds'],
        crop: ['itemNum', 'soilItemNum', 'xiraniteState'],
        hand: ['handTypeBenefit', 'bonusBenefit', 'priority', 'isEffectAllMonster', 'showNumber'],
        card: ['cardPoint']
    };
    const fields = (c, row, keys) => c.table([t('property'), t('value')], keys.filter(k => row[k] != null).map(k => [
        c.h(t(`fields.${k}`)), typeof row[k] === 'boolean' ? c.h(c.t(row[k] ? 'yes' : 'no'))
            : Array.isArray(row[k]) ? row[k].map(c.number).join(' / ') : c.number(row[k])
    ]));
    const get = (c, table, key) => {
        const row = c.tables[table]?.[key];
        if (!row) c.issue('missing-reference', table, key);
        return row;
    };
    function label(c, kind, key, row) {
        const itemId = ['dish', 'drink', 'feed', 'crop'].includes(kind) ? row.itemId || key : null;
        const named = [row.name, row.handTypeName, row.clientShowName, row.requirementText, row.menuDesc, row.descText,
            kind === 'effect' ? row.desc : null].find(v => c.text(v));
        if (itemId) return c.name(c.tables.ItemTable?.[itemId]?.name || named, key);
        if (kind === 'chef') return c.name(c.tables.CharacterTable?.[key]?.name, key);
        if (kind === 'feature') return c.name(row.desc1, key);
        if (['level', 'milestoneLevel', 'refresh', 'stars'].includes(kind)) return t('numbered', { name: t(kind), value: row.innManagementLevel ?? row.level ?? row.starsNum ?? key });
        if (kind === 'card') return t('cardPoints', { value: row.cardPoint });
        if (kind === 'milestone' && row.activityId) return c.name(c.tables.ActivityTable?.[row.activityId]?.name, key);
        return c.text(named) ? c.name(named, key) : t(kind);
    }
    function ref(c, module, kind, source, key) {
        if (key == null || key === '') return '—';
        const row = get(c, source, key);
        const route = `${kind}:${key}`;
        return row ? c.link(module === 'gamble' ? 'misc' : module === 'farming' ? 'inn' : module,
            module === 'gamble' ? `gamble/${encodeURIComponent(route)}` : route, label(c, kind, key, row)) : c.h(c.t('unavailable'));
    }
    function descriptions(c, row) {
        return textFields.filter(k => !['name', 'handTypeName', 'clientShowName'].includes(k)).map(k => {
            const values = Array.isArray(row[k]) ? row[k] : [row[k]];
            return values.filter(v => c.text(v)).map(v => `<p>${c.rich(v)}</p>`).join('');
        }).join('');
    }
    function skillTarget(c, row) {
        const key = row.parameters?.[1]?.valueStringList?.[0];
        if (row.skillType === 0) return ref(c, 'inn', 'category', 'InnDishCategoryTable', key);
        if (row.skillType === 1) return ref(c, 'inn', 'affix', 'InnAffixTable', key);
        if (row.skillType === 2) return c.h(t('rare'));
        c.issue('unknown-skill-type', 'InnSkillTable', row.id, row.skillType);
        return c.h(t('unknownType', { value: row.skillType }));
    }
    function skill(c, key) {
        const row = get(c, 'InnSkillTable', key);
        if (!row) return c.state(c.t('unavailable'));
        const count = row.skillType === 1 ? 2 : 1;
        const values = row.parameters?.slice(2, 2 + count).map(p => p.valueFloatList?.[0]);
        const known = [0, 1, 2].includes(row.skillType) && values?.length === count && values.every(Number.isFinite);
        if (!known) c.issue('unparsed-skill-parameters', 'InnSkillTable', key);
        return c.rich(row.name) + descriptions(c, row) + c.table([t('target'), t('effectValues'), t('fields.unlockLevel')], [[
            skillTarget(c, row), known ? values.map(v => c.number(v * 100) + '%').join(' / ') : c.h(t('unresolved')), c.number(row.unlockLevel)
        ]]);
    }
    function requirement(c, key) {
        const row = get(c, 'InnRequirementTable', key);
        if (!row) return c.state(c.t('unavailable'));
        // false also appears in positive OR requirements. Never interpret boolFlag as negation.
        return c.table([t('category'), t('affix'), t('ingredient')], (row.describe || []).map(id => {
            const d = get(c, 'InnDescribeTable', id);
            if (!d) return [c.h(c.t('unavailable')), '—', '—'];
            const selectorCount = [d.category, d.affix, d.ingredient].filter(Boolean).length;
            if (selectorCount !== 1) c.issue('unresolved-requirement-clause', 'InnDescribeTable', id);
            return [ref(c, 'inn', 'category', 'InnDishCategoryTable', d.category),
                ref(c, 'inn', 'affix', 'InnAffixTable', d.affix), d.ingredient ? c.item(d.ingredient) : '—'];
        }));
    }
    function dishLinks(c, predicate) {
        return c.entries(c.tables.InnDishTable).filter(([, r]) => predicate(r)).map(([key, row]) =>
            c.link('inn', `dish:${key}`, label(c, 'dish', key, row))).join(' ') || c.state();
    }
    function sources(c, item) {
        return [
            ...c.entries(c.tables.CropObtainWayTable).filter(([, r]) => r.itemId === item).map(([key, row]) => c.link('inn', `crop:${key}`, label(c, 'crop', key, row))),
            ...c.entries(c.tables.InnRanchAnimalTable).filter(([, r]) => r.lowLevelProd === item || r.highLevelProd === item).map(([key, row]) => c.link('inn', `animal:${key}`, label(c, 'animal', key, row)))
        ].join(' ') || '—';
    }
    function renderInn(e, c) {
        const r = e.raw, T = c.tables;
        let html = e.kind === 'milestone' ? '' : descriptions(c, r);
        if (fieldSets[e.kind]) html += fields(c, r, fieldSets[e.kind]);
        const refs = (ids, kind, table) => (ids || []).map(id => ref(c, 'inn', kind, table, id)).join(' ') || '—';
        if (['dish', 'drink'].includes(e.kind)) {
            html = c.item(e.key) + html;
            html += c.section(t('traits'), refs(r.affix, 'affix', 'InnAffixTable') + (r.category ? ' ' + ref(c, 'inn', 'category', 'InnDishCategoryTable', r.category) : ''), true);
            if (e.kind === 'dish') {
                if (r.ingredient?.length !== r.ingredientNum?.length) c.issue('parallel-array-mismatch', e.source, e.key, 'ingredient');
                html += c.section(t('materials'), c.table([t('ingredient'), t('quantity'), t('source')], (r.ingredient || []).map((id, i) => [c.item(id), c.number(r.ingredientNum?.[i]), sources(c, id)])), true);
                if (r.recipeId) html += c.section(t('recipe'), c.item(r.recipeId));
                if (r.unlockTopicId) html += c.section(t('unlockTopic'), ref(c, 'inn', 'topic', 'InnTopicTable', r.unlockTopicId), true);
                const matching = c.entries(T.InnSkillTable).filter(([, s]) => {
                    const target = s.parameters?.[1]?.valueStringList?.[0];
                    return s.skillType === 0 ? target === r.category : s.skillType === 1 ? (r.affix || []).includes(target) : s.skillType === 2;
                });
                html += c.section(t('compatibleSkills'), matching.map(([key]) => ref(c, 'inn', 'skill', 'InnSkillTable', key)).join(' '), true);
            }
        } else if (e.kind === 'topic') {
            html += c.section(t('traits'), refs(r.hotCategory, 'category', 'InnDishCategoryTable') + ' ' + refs(r.hotAffix, 'affix', 'InnAffixTable'));
            html += c.section(t('requirements'), (r.requirementList || []).map((id, i) => c.section(t('requiredCount', { value: r.requirementNum?.[i] ?? '—' }), requirement(c, id), true)).join(''), true);
            const objectiveIds = (r.objectiveParameters || []).flatMap(p => p.valueStringList || []).filter(id => {
                if (T.InnRequirementTable[id]) return true;
                c.issue('unresolved-objective-parameter', 'InnTopicTable', e.key, { type: r.objectiveConditionType, value: id });
                return false;
            });
            html += objectiveIds.map(id => c.section(t('objective'), requirement(c, id), true)).join('');
            html += c.section(t('rewards'), c.table([t('stars'), t('score'), t('rewards')], (r.starRequiredScore || []).map((score, i) => [c.number(i + 1), c.number(score), c.reward(r.starsRewardId?.[i])])), true);
            html += c.section(t('unlockedDishes'), dishLinks(c, dish => dish.unlockTopicId === e.key));
        } else if (e.kind === 'chef') {
            html += T.CharacterTable[e.key] ? c.link('v3_character', e.key, e.name) : c.h(c.t('unavailable'));
            if (!T.CharacterTable[e.key]) c.issue('missing-reference', 'CharacterTable', e.key);
            html += (r.list || []).map(id => c.section(t('skill'), skill(c, id), true)).join('');
            html += c.state(t('skillNotice'));
        } else if (e.kind === 'skill') {
            html = skill(c, e.key) + c.section(t('chef'), c.entries(T.InnCharSkillTable).filter(([, row]) => (row.list || []).includes(e.key)).map(([id]) => ref(c, 'inn', 'chef', 'InnCharSkillTable', id)).join(' '), true) + c.state(t('skillNotice'));
        } else if (e.kind === 'expansion') {
            html += c.item(T.InnManagementConst.gamePlayToken, r.cost);
            if (r.prerequisiteId) html += c.section(t('prerequisite'), ref(c, 'inn', 'expansion', 'InnExpansionTable', r.prerequisiteId), true);
        } else if (e.kind === 'level') {
            html += c.section(t('category'), refs(r.usableDishType, 'category', 'InnDishCategoryTable'));
            html += c.section(t('dish'), dishLinks(c, d => d.unlockLevel === r.innManagementLevel));
        } else if (e.kind === 'milestone') {
            html += c.section(t('condition'), c.conditions(r.conditions), true);
        } else if (e.kind === 'milestoneLevel' || e.kind === 'stars') {
            html += c.section(t('rewards'), c.reward(r.rewardId), true);
        } else if (e.kind === 'requirement') {
            html = requirement(c, e.key);
        } else if (e.kind === 'affix' || e.kind === 'category') {
            html += c.section(t('dish'), dishLinks(c, d => e.kind === 'affix' ? (d.affix || []).includes(e.key) : d.category === e.key), true);
        } else if (e.kind === 'refresh') {
            html += fields(c, r, ['totalNum']);
            html += c.table([t('group'), t('quantity')], (r.mustTag || []).map((tag, i) => {
                const caption = t(`tags.${tag}`);
                if (caption === `modules.life.tags.${tag}`) c.issue('unknown-refresh-tag', e.source, e.key, tag);
                return [c.h(caption === `modules.life.tags.${tag}` ? t('unresolved') : caption), c.number(r.mustNum?.[i])];
            }));
            html += c.section(t('goods'), c.table([t('rewards'), t('cost'), t('weight')], c.values(T.InnGoodsRandomTable).filter(g => r.level >= g.innLevelRange?.[0] && r.level <= g.innLevelRange?.[1]).map(g => {
                const goods = get(c, 'ShopGoodsTable', g.goodsId);
                return [goods ? c.reward(goods.rewardId) : c.h(c.t('unavailable')), goods ? c.item(goods.moneyId, goods.price) : '—', c.number(g.weight)];
            })));
            html += c.state(t('refreshNotice'));
        }
        return html;
    }
    function renderFarming(e, c) {
        const r = e.raw, T = c.tables;
        let html = descriptions(c, r);
        if (fieldSets[e.kind]) html += fields(c, r, fieldSets[e.kind]);
        if (e.kind === 'animal') {
            html += c.section(t('products'), c.item(r.lowLevelProd) + ' ' + c.item(r.highLevelProd), true);
            html += c.section(t('stable'), (r.stableGroupIds || []).map(id => ref(c, 'farming', 'stable', 'InnRanchStableGroupTable', id)).join(' '), true);
            html += c.section(t('usedByDishes'), dishLinks(c, d => (d.ingredient || []).some(id => id === r.lowLevelProd || id === r.highLevelProd)), true);
        } else if (e.kind === 'stable') {
            html += c.table([t('slot'), t('fields.unlockLevel'), t('cost')], c.entries(r.stables).map(([key, s]) => {
                if (String(T.InnRanchStableId2GroupId[key]) !== String(r.stableGroupId)) c.issue('stable-group-mismatch', e.source, key);
                return [c.h(t('numbered', { name: t('slot'), value: s.sortId })), c.number(s.unlockLevel), c.item(s.moneyId, s.unlockCost)];
            }));
            html += c.section(t('automation'), c.item(T.RanchConst.unlockAutoMoneyId, T.RanchConst.unlockAutoMoneyCost));
        } else if (e.kind === 'crop') {
            html += c.section(t('products'), c.item(r.itemId, r.itemNum), true);
            html += c.section(t('soilItem'), c.item(r.soilItemId, r.soilItemNum), true);
            html += c.section(t('usedByDishes'), dishLinks(c, d => (d.ingredient || []).includes(r.itemId)), true);
        } else if (e.kind === 'soil') {
            html += c.section(t('upgrades'), c.table([t('level'), t('cost'), t('innLevel'), t('capacity'), t('features')], (r.levelList || []).map(l => [
                c.number(l.level), c.item(r.levelUpMoney, l.levelUpCost),
                l.unlockInnLevel ? ref(c, 'inn', 'level', 'InnLevelTable', l.unlockInnLevel) : '—',
                c.number(l.depotCapacity), c.entries(T.SoilMgrFeatureTable).filter(([key]) => l[key] === true).map(([key]) => ref(c, 'farming', 'feature', 'SoilMgrFeatureTable', key)).join(' ') || '—'
            ])), true);
            html += c.section(t('configuration'), fields(c, T.FactorySoilConst, ['SoilAutoHarvestTime', 'SoilAutoReclaimTime', 'SoilIncreaseProducePerSoil', 'SoilMgrDepotItemLimit', 'SoilMutationProgressSum', 'SoilNeighborIncreaseProgressSum']));
        } else if (e.kind === 'feed') html += c.item(r.itemId);
        return html;
    }
    function renderGamble(e, c) {
        const r = e.raw, T = c.tables;
        let html = descriptions(c, r);
        if (fieldSets[e.kind]) html += fields(c, r, fieldSets[e.kind]);
        if (e.kind === 'hand') {
            for (const [field, caption] of [['handTypeBuffId', 'normalEffects'], ['handTypeBuffPlusId', 'enhancedEffects']]) {
                html += c.section(t(caption), (r[field] || []).map(id => {
                    const effect = get(c, 'GambleBattleEnemyBuffTable', id);
                    return effect ? c.rich(effect.desc) : c.state(c.t('unavailable'));
                }).join('<br>'), true);
            }
            html += c.state(t('scoreNotice'));
        } else if (e.kind === 'card') {
            if (r.enemyIdList?.length !== r.enemyCountList?.length || r.enemyIdList?.length !== r.enemyLevel?.length) c.issue('parallel-array-mismatch', e.source, e.key);
            html += c.table([t('enemy'), t('quantity'), t('level')], (r.enemyIdList || []).map((id, i) => {
                const enemy = get(c, 'EnemyTable', id), display = enemy && get(c, 'EnemyTemplateDisplayInfoTable', enemy.templateId);
                return [display ? c.link('v3_enemy', enemy.templateId, c.name(display.name, id)) : c.h(c.t('unavailable')), c.number(r.enemyCountList?.[i]), c.number(r.enemyLevel?.[i])];
            }));
            html += c.section(t('pool'), c.entries(T.GambleBattleCardPoolTable).filter(([, p]) => (p.list || []).some(v => v.enemyGroupId === e.key)).map(([key]) => ref(c, 'gamble', 'pool', 'GambleBattleCardPoolTable', key)).join(' '));
        } else if (e.kind === 'pool') {
            html += c.state(t('poolNotice'));
            html += c.table([t('card'), t('quantity'), t('weight')], (r.list || []).map(v => [ref(c, 'gamble', 'card', 'GambleBattleCardTable', v.enemyGroupId), c.number(v.cardNum), c.number(v.cardWeight)]));
        } else if (e.kind === 'milestone') {
            html += c.table([t('milestone'), t('score'), t('rewards')], c.values(r.milestoneMap).sort((a, b) => a.nodeId - b.nodeId).map(m => [c.number(m.nodeId), c.number(m.completeScore), c.reward(m.rewardId)]));
            const coin = T.ActivityCommonCoinRewardTable[r.activityId];
            if (coin) html += c.section(t('rewards'), c.item(coin.headItemId) + ' ' + c.dungeon(coin.gameId));
            if (T.GambleBattleConst.gambleBattleActivityId === r.activityId) html += c.section(t('configuration'), fields(c, T.GambleBattleConst, ['drawLimit', 'convertLimitNum', 'dungeonContinuousChallengeTimes', 'pointAwardList']));
        } else if (e.kind === 'period') {
            html += ref(c, 'gamble', 'hand', 'GambleBattleHandTypeTable', r.handTypeID);
            const time = get(c, 'TimeRangeTable', r.timeId);
            html += c.table([t('openTime'), t('closeTime')], (time?.timeRangeList || []).map(v => [c.h(v.openTime), c.h(v.closeTime)]));
        }
        return html;
    }
    function build(module, c) {
        return definitions[module].flatMap(([kind, source]) => c.entries(c.tables[source]).map(([key, raw], index) => {
            const name = ['pool', 'period', 'state'].includes(kind) ? t('numbered', { name: t(kind), value: index + 1 }) : label(c, kind, key, raw);
            let search = textFields.flatMap(f => Array.isArray(raw[f]) ? raw[f] : [raw[f]]).map(c.text).join(' ');
            if (kind === 'chef') search += ' ' + (raw.list || []).map(id => c.text(c.tables.InnSkillTable?.[id]?.desc)).join(' ');
            const item = ['dish', 'drink', 'crop', 'feed'].includes(kind) && c.tables.ItemTable?.[raw.itemId || key];
            const traits = (Array.isArray(raw.affix) ? raw.affix : []).map(id => c.text(c.tables.InnAffixTable?.[id]?.name)).join(' ');
            const subtitle = kind === 'card' ? (raw.enemyIdList || []).map(id => c.text(c.tables.EnemyTemplateDisplayInfoTable?.[c.tables.EnemyTable?.[id]?.templateId]?.name)).join(' / ') : traits;
            return { id: `${kind}:${key}`, key, kind, source, raw, name, group: t(kind),
                subtitle, search: `${search} ${subtitle}`, sources: [{ table: source, key }],
                icon: entryIcon(kind, raw, item) };
        }));
    }
    function mount(module, presentation = {}) {
        return window.AKECatalog.mount({ id: module, tables: tables(module), primary: definitions[module].map(([, s]) => s), itemIcons: true,
            build: c => build(module, c), render: (e, c) => module === 'inn' ? renderVillage(e, c) : ({ farming: renderFarming, gamble: renderGamble })[module](e, c), ...presentation });
    }
    const renderVillage = (e, c) => (farmingKinds.has(e.kind) ? renderFarming : renderInn)(e, c);
    const tables = module => [...new Set(['ItemTable', 'RewardTable', ...definitions[module].map(([, s]) => s), ...dependencies[module]])];
    window.AKELifeCatalog = { mount, definitions, tables, textFields, build, renderGamble, renderVillage };
})();
