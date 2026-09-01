(function () {
    if (window.AKEV3) return;

    const TABLE_ROOT = '/public/TableCfg/';
    const tableCache = new Map();
    const i18nPromises = new Map();
    const itemT = window.akeI18n.scope('modules.item');
    const dungeonT = window.akeI18n.scope('modules.dungeon');
    let originalAkeFetch = window.akeFetch || window.fetch.bind(window);

    const MODULE_ALIASES = {
        character: 'v2_character', weapon: 'v2_weapon', enemy: 'v2_enemy',
        equip: 'v2_equip', item: 'v2_item', dungeon: 'v2_dungeon',
        cc: 'v2_cc', activity: 'activity', achievement: 'achievement'
    };

    // TextTable keys: stable, humidty, acid, and xiranite factory environments.
    const FACTORY_ENVIRONMENT_TEXT_IDS = {
        1: '4749896721646405651',
        2: '2583412103900909986',
        3: '8325730894015926297',
        4: '3873336576577928485'
    };

    const POINT_TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const POINT_TOKEN_MOD = 1n << 36n;
    const POINT_TOKEN_MULTIPLIER = 25214903917n;
    const POINT_TOKEN_OFFSET = 11n;
    const POINT_TOKEN_LENGTH = 7;
    const levelDataJsonPromises = new Map();

    function encodePointIdToken(pointId) {
        const value = String(pointId ?? '');
        if (!/^\d+$/.test(value)) return null;
        const id = BigInt(value);
        if (id < 0n || id >= POINT_TOKEN_MOD) return null;
        let remaining = (id * POINT_TOKEN_MULTIPLIER + POINT_TOKEN_OFFSET) % POINT_TOKEN_MOD;
        let encoded = '';
        do {
            encoded = POINT_TOKEN_ALPHABET[Number(remaining % 62n)] + encoded;
            remaining /= 62n;
        } while (remaining > 0n);
        return encoded.padStart(POINT_TOKEN_LENGTH, '0');
    }

    function pointShareUrl(pointId) {
        const token = encodePointIdToken(pointId);
        return token ? `https://oem.re/${token}` : '';
    }

    function equipTemplateRewardParts(rewardId) {
        const match = String(rewardId || '').match(/^reward_eco_([a-z0-9_-]+)_int_(\d+)$/i);
        return match ? { sceneId: match[1], localId: match[2] } : null;
    }

    function cachedLevelDataJson(url) {
        if (!levelDataJsonPromises.has(url)) {
            const promise = (window.akeDataLoader?.loadJson
                ? window.akeDataLoader.loadJson(url, { priority: 'dependency' })
                : originalAkeFetch(url).then(response => {
                    if (!response.ok) throw new Error(`无法加载 ${url} (HTTP ${response.status})`);
                    return response.json();
                })).catch(error => {
                levelDataJsonPromises.delete(url);
                throw error;
            });
            levelDataJsonPromises.set(url, promise);
        }
        return levelDataJsonPromises.get(url);
    }

    async function equipTemplatePointId(rewardId) {
        const parts = equipTemplateRewardParts(rewardId);
        if (!parts) return null;
        const localId = BigInt(parts.localId);
        if (localId >= 100000000n) return null;
        const url = `/public/Json/LevelData/${parts.sceneId}/${parts.sceneId}_lv_data.json`;
        const payload = await cachedLevelDataJson(url);
        if (payload?.sceneId !== parts.sceneId) {
            levelDataJsonPromises.delete(url);
            return null;
        }
        const levelIdNum = String(payload?.levelIdNum ?? '');
        if (!/^\d+$/.test(levelIdNum)) {
            levelDataJsonPromises.delete(url);
            return null;
        }
        const pointId = BigInt(levelIdNum) * 100000000n + localId;
        return pointId < POINT_TOKEN_MOD ? pointId.toString() : null;
    }

    function losslessParse(text) {
        // Text references use signed Int64 IDs. Preserve them before JSON.parse
        // converts them to imprecise Numbers.
        return JSON.parse(text.replace(/("id"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"'));
    }

    async function fetchText(url) {
        const response = await originalAkeFetch(url);
        if (!response.ok) throw new Error(`无法加载 ${url} (HTTP ${response.status})`);
        return response.text();
    }

    function versionTableUrl(name, version) {
        if (!version) return `${TABLE_ROOT}${name}.json`;
        const state = window.akeDataSource?.getState?.();
        const baseUrl = state?.debugLocal ? state.defaultBaseUrl : state?.baseUrl;
        if (!baseUrl) throw new Error('数据源尚未准备完成');
        return new URL(`/${version.tableCfgPath}/${name}.json`, `${baseUrl}/`).href;
    }

    function languageInfo() {
        return window.akeI18n?.getLanguageInfo?.() || { directory: 'CH', table: 'CN', htmlLang: 'zh-CN' };
    }

    async function loadI18n() {
        const suffix = languageInfo().table;
        if (!i18nPromises.has(suffix)) {
            window.akeDataCache?.setProgressNotice?.(window.akeI18n?.t(
                'common.firstLoadTextTableHint',
                null,
                '首次加载需要加载文本映射表，可能速度较慢'
            ));
            const load = url => window.akeDataLoader?.loadJson
                ? window.akeDataLoader.loadJson(url, { priority: 'prefetch', hydrate: false })
                : fetchText(url).then(losslessParse);
            const localized = load(`${TABLE_ROOT}I18nTextTable_${suffix}.json`);
            const promise = (suffix === 'CN' ? localized.then(value => ({ localized: value, chinese: value })) : Promise.all([
                localized,
                load(`${TABLE_ROOT}I18nTextTable_CN.json`)
            ]).then(([current, chinese]) => ({ localized: current, chinese })))
                .catch(error => {
                    i18nPromises.delete(suffix);
                    throw error;
                })
                .finally(() => window.akeDataCache?.setProgressNotice?.(''));
            i18nPromises.set(suffix, promise);
        }
        return i18nPromises.get(suffix);
    }

    async function loadTableInternal(name, version, options = {}) {
        const cacheKey = `${version?.id || 'current'}:${languageInfo().table}:${name}:${options?.hydrate === false ? 'raw' : 'hydrated'}`;
        if (!tableCache.has(cacheKey)) {
            const raw = (window.akeDataLoader?.loadJson
                ? window.akeDataLoader.loadJson(versionTableUrl(name, version), { priority: 'foreground' })
                : fetchText(versionTableUrl(name, version)).then(losslessParse))
                .catch(error => {
                    console.warn(`Table ${name} not found${version ? ` in version ${version.id}` : ''}, treating as empty`, error.message || error);
                    return {};
                });
            tableCache.set(cacheKey, options?.hydrate === false
                ? raw
                : Promise.all([raw, loadI18n()]).then(([data, i18n]) => hydrate(data, i18n)));
        }
        return tableCache.get(cacheKey);
    }

    function hydrate(value, i18n, seen) {
        if (!value || typeof value !== 'object') return value;
        seen = seen || new WeakSet();
        if (seen.has(value)) return value;
        seen.add(value);
        if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'id') &&
            Object.prototype.hasOwnProperty.call(value, 'text') && !value.text) {
            value.text = i18n.localized?.[String(value.id)] || i18n.chinese?.[String(value.id)] || '';
        }
        Object.values(value).forEach(child => hydrate(child, i18n, seen));
        return value;
    }

    function pick(source, keys) {
        const result = {};
        (keys || []).forEach(key => { if (source && source[key] !== undefined) result[key] = source[key]; });
        return result;
    }

    function valuesBy(source, field, expected) {
        return Object.fromEntries(Object.entries(source || {}).filter(([, row]) => row && row[field] === expected));
    }

    function virtualResponse(data) {
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    function text(ref, fallback) {
        if (typeof ref === 'string') return ref;
        return ref?.text || fallback || '';
    }

    function compareId(a, b) {
        const aId = a.charId || a.weaponId || a.templateId || a.suitID || a.itemId || a.activityId || a.categoryId || a.gameId || a.id || '';
        const bId = b.charId || b.weaponId || b.templateId || b.suitID || b.itemId || b.activityId || b.categoryId || b.gameId || b.id || '';
        return String(aId).localeCompare(String(bId), 'en');
    }

    function byRarityThenId(a, b) {
        return (b.rarity || 0) - (a.rarity || 0) || compareId(a, b);
    }

    function assignPriority(rows) {
        return rows.map((row, index) => ({ ...row, priority: index + 1 }));
    }

    function diffSignature(value) {
        return JSON.stringify(value, function (key, child) {
            // Entity detection follows TableCfg references; localized display text
            // is compared later from the rendered detail output.
            if (key === 'text' && this && Object.prototype.hasOwnProperty.call(this, 'id')) return undefined;
            return child;
        });
    }

    function characterGiftRewardIds(charId) {
        const operatorId = String(charId || '').replace(/^chr_\d+_/, '');
        if (!operatorId) return [];
        return [1, 2, 3].map(stage => `reward_gift_${operatorId}_${stage}`);
    }

    function characterSupplementSignature(charId, rewards, weaponRecommendations) {
        return {
            gifts: pick(rewards, characterGiftRewardIds(charId)),
            weaponRecommendations: weaponRecommendations?.[charId] || {}
        };
    }

    function manifestId(module, row) {
        const fields = {
            character: 'charId', weapon: 'weaponId', enemy: 'templateId', equip: 'suitID', item: 'itemId',
            dungeon: 'templateId', achievement: 'categoryId', activity: 'activityId', cc: 'gameId'
        };
        return String(row?.[fields[module]] || '');
    }

    const versionDiffEntries = new Map();

    function showModifiedVersionChanges() {
        return window.akeData?.getConfig?.()?.showVersionChanges === true;
    }

    function publicManifestRow(row) {
        const { __diffSignature, __diffGroupSignature, __diffEntitySignatures, ...publicRow } = row;
        return publicRow;
    }

    async function manifestWithVersionDiff(module) {
        const buildManifest = adapters[module][0];
        const currentRows = await buildManifest();
        const comparison = window.akeDataSource?.getState?.()?.comparison;
        if (!comparison?.baseline) {
            versionDiffEntries.delete(module);
            return currentRows.map(publicManifestRow);
        }
        try {
            const baselineRows = await buildManifest(comparison.baseline);
            const baselineById = new Map(baselineRows.map(row => [manifestId(module, row), row]));
            const usesGroupedEntityDiff = module === 'equip' || module === 'achievement';
            const baselineGroupedEntities = usesGroupedEntityDiff
                ? new Map(baselineRows.flatMap(row => Object.entries(row.__diffEntitySignatures || {})))
                : null;
            const moduleEntries = new Map();
            const includeModified = showModifiedVersionChanges();
            const ranked = currentRows.map(row => {
                const baseline = baselineById.get(manifestId(module, row));
                const groupedEntitySignatures = row.__diffEntitySignatures || {};
                const addedEntityIds = usesGroupedEntityDiff
                    ? Object.keys(groupedEntitySignatures).filter(entityId => !baselineGroupedEntities.has(entityId))
                    : [];
                let isModified = Boolean(baseline && row.__diffSignature !== baseline.__diffSignature);
                if (usesGroupedEntityDiff && baseline) {
                    const baselineGroupEntities = baseline.__diffEntitySignatures || {};
                    const comparableCurrentIds = Object.keys(groupedEntitySignatures).filter(entityId => baselineGroupedEntities.has(entityId));
                    const baselineGroupIds = Object.keys(baselineGroupEntities);
                    const membershipChanged = comparableCurrentIds.length !== baselineGroupIds.length ||
                        comparableCurrentIds.some(entityId => !Object.prototype.hasOwnProperty.call(baselineGroupEntities, entityId));
                    const existingEntityChanged = comparableCurrentIds.some(entityId =>
                        baselineGroupedEntities.get(entityId) !== groupedEntitySignatures[entityId]);
                    isModified = row.__diffGroupSignature !== baseline.__diffGroupSignature || membershipChanged || existingEntityChanged;
                }
                const hasGroupedAddition = usesGroupedEntityDiff && addedEntityIds.length > 0;
                const canMarkWholeRowAdded = module !== 'activity' && !usesGroupedEntityDiff;
                const changeType = hasGroupedAddition
                    ? 'added'
                    : !baseline
                    ? (canMarkWholeRowAdded ? 'added' : '')
                    : (includeModified && isModified ? 'modified' : '');
                const publicRow = publicManifestRow(row);
                if (module === 'equip' && addedEntityIds.length) {
                    publicRow.addedEquipIds = addedEntityIds;
                    publicRow.changeBaseVersion = comparison.baseline.id;
                    moduleEntries.set(manifestId(module, row), publicRow);
                }
                if (module === 'achievement' && addedEntityIds.length) {
                    publicRow.addedAchievementIds = addedEntityIds;
                    publicRow.changeBaseVersion = comparison.baseline.id;
                    moduleEntries.set(manifestId(module, row), publicRow);
                }
                if (!changeType) return publicRow;
                const changedRow = { ...publicRow, changeType, changeBaseVersion: comparison.baseline.id };
                moduleEntries.set(manifestId(module, row), changedRow);
                return changedRow;
            }).sort((a, b) => {
                const rank = { added: 0, modified: 1 };
                const aRank = a.addedEquipIds?.length || a.addedAchievementIds?.length ? 0 : (rank[a.changeType] ?? 2);
                const bRank = b.addedEquipIds?.length || b.addedAchievementIds?.length ? 0 : (rank[b.changeType] ?? 2);
                return aRank - bRank || (a.priority || 999) - (b.priority || 999);
            });
            versionDiffEntries.set(module, moduleEntries);
            return assignPriority(ranked);
        } catch (error) {
            console.warn(`无法计算 ${module} 的版本差异`, error);
            versionDiffEntries.delete(module);
            return currentRows.map(publicManifestRow);
        }
    }

    async function detailWithVersionDiff(module, id) {
        const buildDetail = adapters[module][1];
        const comparison = window.akeDataSource?.getState?.()?.comparison;
        if (!comparison?.baseline) return buildDetail(id);
        if (!versionDiffEntries.has(module)) await manifestWithVersionDiff(module);
        const entry = versionDiffEntries.get(module)?.get(String(id));
        const attachAddedEntityIds = current => {
            if (module === 'equip' && entry?.addedEquipIds?.length) {
                current.__versionAddedEquipIds = [...entry.addedEquipIds];
            }
            if (module === 'achievement' && entry?.addedAchievementIds?.length) {
                current.__versionAddedAchievementIds = [...entry.addedAchievementIds];
            }
            return current;
        };
        if (!showModifiedVersionChanges() || entry?.changeType !== 'modified') {
            return attachAddedEntityIds(await buildDetail(id));
        }
        try {
            const [current, baseline] = await Promise.all([buildDetail(id), buildDetail(id, comparison.baseline)]);
            current.__versionDiff = { baseVersion: comparison.baseline.id, baseline };
            return attachAddedEntityIds(current);
        } catch (error) {
            console.warn(`无法计算 ${module}/${id} 的字段差异`, error);
            return attachAddedEntityIds(await buildDetail(id));
        }
    }

    async function optionalJson(url) {
        try {
            const response = await originalAkeFetch(url);
            return response.ok ? response.json() : null;
        } catch {
            return null;
        }
    }

    const ENEMY_RARITY_BY_DISPLAY_TYPE = { 0: 2, 3: 3, 1: 4, 4: 5, 2: 6 };

    function dungeonRarity(row) {
        if (row.gameCategory === 'dungeon_highdifficulty') return 6;
        if (row.gameCategory === 'dungeon_bossrush') return row.dungeonCategory === 3 ? 5 : 3;
        if (row.gameCategory === 'dungeon_ss') return 4;
        if (['dungeon_actmonster', 'dungeon_challenge', 'dungeon_resource', 'dungeon_weeklyraid'].includes(row.gameCategory)) return 3;
        if (['dungeon_char', 'dungeon_chartutorial', 'dungeon_contract', 'dungeon_train', 'dungeon_worldlevel',
            'dungeon_wuling_A', 'dungeon_wuling_B'].includes(row.gameCategory)) return 2;
        return 1;
    }

    function icon(kind, id, iconId) {
        const paths = {
            character: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/icon_${id}.png`,
            weapon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId || id}.png`,
            enemy: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`,
            item: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId || id}.png`,
            equip: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId || id}.png`
        };
        return paths[kind] || '';
    }

    async function characterManifest(version) {
        const [chars, growth, maps, rewards, weaponRecommendations, shipChars, shipSkills] = await Promise.all([
            table('CharacterTable', version), table('CharGrowthTable', version), loadMaps(), table('RewardTable', version),
            table('CharWpnRecommendTable', version), table('SpaceshipCharSkillTable', version), table('SpaceshipSkillTable', version)
        ]);
        const rows = Object.entries(chars).map(([charId, row], index) => {
            const grow = growth[charId] || {};
            const logisticsSkills = Object.values((shipChars[charId]?.skillList || []).reduce((groups, entry) => {
                const skill = shipSkills[entry.skillId];
                if (!skill) return groups;
                const key = String(entry.skillIndex ?? skill.sortId ?? entry.skillId);
                const current = groups[key];
                if (!current || Number(skill.level || 0) > Number(current.level || 0)) {
                    groups[key] = {
                        level: skill.level || 0,
                        name: text(skill.talentName, text(skill.name, entry.skillId)),
                        desc: text(skill.desc),
                        roomType: skill.roomType,
                        icon: skill.icon ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon/${skill.icon}.png` : ''
                    };
                }
                return groups;
            }, {})).slice(0, 2);
            return {
                charId, name: text(row.name, charId), rarity: row.rarity,
                charType: maps.char_type_map?.[grow.charTypeId] || grow.charTypeId,
                charTypeId: grow.charTypeId,
                profession: maps.profession_id_map?.[String(grow.profession)] || grow.profession,
                professionId: grow.profession,
                weapontype: maps.weapon_id_map?.[String(grow.weaponType)] || grow.weaponType,
                weaponTypeId: grow.weaponType,
                mainAttrType: row.mainAttrType, subAttrType: row.subAttrType ?? grow.subAttrType,
                charBattleTag: grow.charBattleTag || [], logisticsSkills,
                icon: icon('character', charId), contentFile: `/__v3/character/${charId}.json`,
                sourceOrder: index, hidden: false,
                __diffSignature: diffSignature([row, grow, shipChars[charId], logisticsSkills, characterSupplementSignature(
                    charId, rewards, weaponRecommendations
                )])
            };
        });
        return assignPriority(rows.sort(byRarityThenId));
    }

    async function characterDetail(id, version) {
        const [chars, growth, potentials, talentEffects, skills, shipChars, shipSkills, items, professions, rewards,
            weaponRecommendations, responsiveDialogs, audioDialogs, dialogTexts, aiBarkTexts] = await Promise.all([
            table('CharacterTable', version), table('CharGrowthTable', version), table('CharacterPotentialTable', version),
            table('PotentialTalentEffectTable', version), table('SkillPatchTable', version), table('SpaceshipCharSkillTable', version),
            table('SpaceshipSkillTable', version), table('ItemTable', version), table('CharProfessionTable', version),
            table('RewardTable', version), table('CharWpnRecommendTable', version), table('ResponsiveDialog', version),
            table('AudioDialog', version), table('DialogTextTable', version), table('AIBarkText', version)
        ]);
        const char = chars[id] || {};
        const grow = growth[id] || {};
        const talentIds = Object.values(grow.talentNodeMap || {}).map(n => n.passiveSkillNodeInfo?.talentEffectId).filter(Boolean);
        const potential = potentials[id] || {};
        const potentialIds = (potential.potentialUnlockBundle || []).map(p => p.potentialEffectId).filter(Boolean);
        const skillIds = new Set();
        Object.values(grow.skillGroupMap || {}).forEach(group => {
            (group.skillIdList || []).forEach(skillId => skillIds.add(skillId));
            if (group.skillGroupId) skillIds.add(group.skillGroupId);
        });
        potentialIds.forEach(skillId => skillIds.add(skillId));
        const shipRow = shipChars[id] || {};
        const shipIds = (shipRow.skillList || []).map(s => s.skillId);
        const itemIds = new Set([id, 'item_gold']);
        Object.values(grow.talentNodeMap || {}).forEach(n => (n.requiredItem || []).forEach(item => itemIds.add(item.id)));
        (potential.potentialUnlockBundle || []).forEach(p => (p.itemIds || []).forEach(itemId => itemIds.add(itemId)));
        (grow.skillLevelUp || []).forEach(level => (level.itemBundle || []).forEach(item => itemIds.add(item.id)));
        const giftRewardIds = characterGiftRewardIds(id);
        const giftRewards = pick(rewards, giftRewardIds);
        Object.values(giftRewards).forEach(reward => {
            [...(reward.itemBundles || []), ...(reward.probItemBundles || [])].forEach(bundle => {
                if (bundle?.id) itemIds.add(bundle.id);
            });
        });
        Object.values(weaponRecommendations[id] || {}).forEach(ids => {
            (Array.isArray(ids) ? ids : []).forEach(itemId => itemIds.add(itemId));
        });
        const normalizeVoiceId = value => String(value || '').split('/').pop().replace(/\.wem$/i, '').toLowerCase();
        const profileVoiceIds = new Set((char.profileVoice || []).map(row => normalizeVoiceId(row.voId)).filter(Boolean));
        const textByAudioOverride = Object.values(dialogTexts || {}).reduce((map, row) => {
            const value = row?.dialogText?.text || '';
            if (row?.audioOverride && value) map[row.audioOverride] = value;
            return map;
        }, {});
        const specialVoices = [];
        const seenSpecial = new Set();
        Object.values(responsiveDialogs || {}).forEach(dialog => Object.entries(dialog?.speakers || {}).forEach(([speakerKey, speaker]) => {
            const speakerId = String(speaker?.speakerChannel || speakerKey || '');
            if (speakerId && speakerId !== id && !speakerId.includes(id)) return;
            Object.entries(speaker?.triggers || {}).forEach(([trigger, triggerData]) => {
                (triggerData?.response || []).forEach(responseId => {
                    const key = String(responseId);
                    if (!key) return;
                    const audio = audioDialogs?.[key] || audioDialogs?.[responseId];
                    if (!audio?.path) return;
                    const fileName = audio.path.split('/').pop()?.replace(/\.wem$/i, '') || key;
                    const voId = fileName || audio.overrideWwiseEvent || key;
                    const normalizedVoId = normalizeVoiceId(voId);
                    if (!normalizedVoId || profileVoiceIds.has(normalizedVoId) || seenSpecial.has(normalizedVoId)) return;
                    seenSpecial.add(normalizedVoId);
                    specialVoices.push({ voId, responseId: key, trigger, category: trigger.split('_')[0] || 'other', path: audio.path,
                        text: textByAudioOverride[fileName] || textByAudioOverride[audio.overrideWwiseEvent]
                            || aiBarkTexts?.[key]?.barkText?.text || '' });
                });
            });
        }));
        specialVoices.sort((a, b) => a.category.localeCompare(b.category) || a.trigger.localeCompare(b.trigger) || a.voId.localeCompare(b.voId));
        return {
            charId: id, charactertable: char, chargrowthtable: grow, characterpotentialtable: potential,
            potentialtalenteffecttable: pick(talentEffects, talentIds.concat(potentialIds)),
            skillpatchtable: pick(skills, Array.from(skillIds)), spaceshipcharskilltable: shipRow,
            spaceshipskilltable: pick(shipSkills, shipIds), itemtable: items[id] || {}, costitemtable: pick(items, Array.from(itemIds)),
            charprofessiontable: professions[char.profession] || {}, giftrewardtable: giftRewards,
            charwpnrecommendtable: weaponRecommendations[id] || {}, specialvoicetable: specialVoices
        };
    }

    async function weaponManifest(version) {
        const [weapons, items, tags, gems] = await Promise.all([
            table('WeaponBasicTable', version), table('ItemTable', version), table('GemTagKeyToWeaponTable', version), table('GemTable', version)
        ]);
        const weaponTagMeta = Object.values(gems || {}).reduce((map, gem) => {
            if (gem?.tagId) map[gem.tagId] = { label: text(gem.tagName, gem.tagId), dimension: Number(gem.termType), sort: Number(gem.sortOrder || 0) };
            return map;
        }, {});
        const rows = Object.entries(weapons).map(([weaponId, row], index) => {
            const item = items[weaponId] || {};
            const weaponTags = Object.entries(tags || {}).filter(([, tag]) => (tag.list || []).includes(weaponId)).map(([tagId]) => tagId);
            return { weaponId, name: text(item.name, weaponId), rarity: row.rarity, weaponType: row.weaponType,
                weaponTags, weaponTagMeta,
                icon: icon('weapon', weaponId, item.iconId), contentFile: `/__v3/weapon/${weaponId}.json`, sourceOrder: index, hidden: false,
                __diffSignature: diffSignature([row, item]) };
        });
        return assignPriority(rows.sort(byRarityThenId));
    }

    async function weaponDetail(id, version) {
        const [weapons, items, skills, breakthrough, upgrade, upgradeSum, talents] = await Promise.all([
            table('WeaponBasicTable', version), table('ItemTable', version), table('SkillPatchTable', version), table('WeaponBreakThroughTemplateTable', version),
            table('WeaponUpgradeTemplateTable', version), table('WeaponUpgradeTemplateSumTable', version), table('WeaponTalentTemplateTable', version)
        ]);
        const weapon = weapons[id] || {};
        const bt = breakthrough[weapon.breakthroughTemplateId];
        const materialIds = (bt?.list || []).flatMap(row => (row.breakItemList || []).map(item => item.id));
        return { weaponId: id, weaponbasictable: weapon, itemtable: pick(items, [id].concat(materialIds)),
            skillpatchtable: pick(skills, weapon.weaponSkillList || []), weaponbreakthroughtemplatetable: pick(breakthrough, [weapon.breakthroughTemplateId]),
            weaponupgradetemplatetable: pick(upgrade, [weapon.levelTemplateId]), weaponupgradetemplatesumtable: pick(upgradeSum, [weapon.levelTemplateId]),
            weapontalenttemplatetable: pick(talents, [weapon.talentTemplateId]) };
    }

    async function enemyManifest(version) {
        const [display, enemies, types] = await Promise.all([
            table('EnemyTemplateDisplayInfoTable', version), table('EnemyTable', version), table('DisplayEnemyTypeTable', version)
        ]);
        const variantCounts = {};
        Object.values(enemies).forEach(row => { variantCounts[row.templateId] = (variantCounts[row.templateId] || 0) + 1; });
        const rows = Object.entries(display).map(([templateId, row], index) => ({ templateId, name: text(row.name, templateId),
            rarity: ENEMY_RARITY_BY_DISPLAY_TYPE[row.displayType] || 1, icon: icon('enemy', templateId),
            displayType: row.displayType, displayTypeName: text(types[row.displayType]?.name), variantCount: variantCounts[templateId] || 0,
            contentFile: `/__v3/enemy/${templateId}.json`, sourceOrder: index, hidden: false,
            __diffSignature: diffSignature([row, valuesBy(enemies, 'templateId', templateId), types[row.displayType]]) }));
        return assignPriority(rows.sort(byRarityThenId));
    }

    async function enemyDetail(id, version) {
        const [display, enemies, attrs, abilities, types, distributions] = await Promise.all([
            table('EnemyTemplateDisplayInfoTable', version), table('EnemyTable', version), table('EnemyAttributeTemplateTable', version),
            table('EnemyAbilityDescTable', version), table('DisplayEnemyTypeTable', version), table('DistributionInfoTable', version)
        ]);
        const info = display[id] || {};
        const variants = valuesBy(enemies, 'templateId', id);
        const attrIds = new Set([id]);
        Object.values(variants).forEach(row => attrIds.add(row.attrTemplateId));
        return { templateId: id, enemytemplatedisplayinfotable: info, enemytable: variants,
            enemyattributetemplatetable: pick(attrs, Array.from(attrIds)), enemyabilitydesctable: pick(abilities, info.abilityDescIds || []),
            displayenemytypetable: types[info.displayType] || {}, distributioninfotable: pick(distributions, info.distributionIds || []) };
    }

    async function equipManifest(version) {
        const [suits, equips, items, attributeFilters, attributeShows] = await Promise.all([
            table('EquipSuitTable', version), table('EquipTable', version), table('ItemTable', version), table('AttributeFilterTable', version),
            table('AttributeShowConfigTable', version)
        ]);
        const attributeNames = {};
        Object.entries(attributeShows || {}).forEach(([attrType, group]) => (group.list || []).forEach(entry => {
            if (entry.name?.text) attributeNames[`${entry.attributeModifier}:${attrType}:`] = entry.name.text;
        }));
        Object.values(attributeFilters || {}).forEach(group => (group.list || []).forEach(entry => {
            if (!entry.name?.text) return;
            const key = `${entry.attributeModifier}:${entry.attributeType}:${entry.compositeAttr || ''}`;
            attributeNames[key] = entry.name.text;
            if (entry.compositeAttr) attributeNames[entry.compositeAttr] = entry.name.text;
        }));
        const rows = Object.entries(suits);
        const unsuited = Object.keys(equips).filter(id => !rows.some(([, suit]) => (suit.equipList || []).includes(id)));
        if (unsuited.length) rows.unshift(['suit_none', { equipList: unsuited, list: [] }]);
        const manifestRows = rows.map(([suitID, row], index) => {
            const equipIds = row.equipList || [];
            const highestId = (row.equipList || []).reduce((bestId, itemId) => {
                if (!bestId) return itemId;
                return (items[itemId]?.rarity || 0) > (items[bestId]?.rarity || 0) ? itemId : bestId;
            }, '');
            const highest = items[highestId] || {};
            return { suitID, name: text(row.list?.[0]?.suitName, suitID === 'suit_none' ? window.akeI18n?.t('modules.equip.independentEquipment') : suitID), rarity: highest.rarity || 1,
                icon: icon('equip', highestId, highest.iconId), equipCount: (row.equipList || []).length, isIndependentGroup: suitID === 'suit_none',
                equipmentIndex: equipIds.map(itemId => { const equip = equips[itemId] || {}; const item = items[itemId] || {}; return { itemId, name: text(item.name, itemId), rarity: item.rarity || 0, icon: icon('equip', itemId, item.iconId), partType: equip.partType,
                    minWearLv: equip.minWearLv, domainId: equip.domainId || '', displayBaseAttrModifier: equip.displayBaseAttrModifier || {}, displayAttrModifiers: equip.displayAttrModifiers || [], attributeNames }; }),
                contentFile: `/__v3/equip/${suitID}.json`, sourceOrder: index, hidden: false,
                __diffGroupSignature: diffSignature((row.list || []).map(entry => pick(entry, ['suitName', 'skillID']))),
                __diffEntitySignatures: Object.fromEntries(equipIds.map(itemId => [itemId, diffSignature([
                    pick(equips[itemId], ['partType', 'minWearLv', 'domainId', 'displayBaseAttrModifier', 'displayAttrModifiers']),
                    pick(items[itemId], ['name', 'rarity', 'iconId', 'decoDesc'])
                ])])),
                __diffSignature: diffSignature([row, pick(equips, row.equipList || []), pick(items, row.equipList || [])]) };
        });
        return assignPriority(manifestRows.sort(byRarityThenId));
    }

    async function equipDetail(id, version) {
        const [suits, equips, items, skills, formulas, reverse, formulaChains, packs, packFormulas, costs, guarantees, constants, tech,
            rewards, shopGoods, shops, channels, adventureLevels] = await Promise.all([
            table('EquipSuitTable', version), table('EquipTable', version), table('ItemTable', version), table('SkillPatchTable', version), table('EquipFormulaTable', version),
            table('EquipFormulaReverseTable', version), table('EquipFormulaChainTable', version), table('EquipPackTable', version), table('EquipPackFormulaTable', version), table('EquipEnhanceCostTable', version),
            table('EquipEnhanceGuaranteeTimesRuleTable', version), table('EquipConst', version), table('EquipTechConst', version),
            table('RewardTable', version), table('ShopGoodsTable', version), table('ShopTable', version), table('ShopChannelDevelopmentTable', version), table('AdventureLevelTable', version)
        ]);
        let suit = suits[id];
        if (!suit && id === 'suit_none') {
            const assigned = new Set(Object.values(suits).flatMap(row => row.equipList || []));
            suit = { equipList: Object.keys(equips).filter(itemId => !assigned.has(itemId)), list: [] };
        }
        suit = suit || { equipList: [], list: [] };
        const equipRows = pick(equips, suit.equipList || []);
        const formulaIds = (suit.equipList || []).map(itemId => reverse[itemId]).filter(Boolean);
        const formulaLevels = formulaIds.map(formulaId => formulas[formulaId]?.level).filter(Boolean);
        const formulaChainRows = pick(formulaChains, formulaLevels);
        const materialIds = Object.values(formulaChainRows).flatMap(row => (row.chainList || []).flatMap(chain =>
            [chain.costGoldId].concat(chain.costItemId || []).filter(Boolean)));
        const skillIds = (suit.list || []).map(row => row.skillID).filter(Boolean);
        const packIds = formulaIds.map(formulaId => formulas[formulaId]?.packId).filter(Boolean);
        const rewardBundles = reward => [...(reward?.itemBundles || []), ...(reward?.probItemBundles || [])];
        const rewardIdsByItem = itemId => Object.entries(rewards).filter(([, reward]) =>
            rewardBundles(reward).some(bundle => bundle.id === itemId && Number(bundle.count || 0) > 0)).map(([rewardId]) => rewardId);
        const goodsByReward = rewardId => Object.values(shopGoods).filter(goods => goods.rewardId === rewardId);
        const shopName = shopId => text(shops[shopId]?.shopName, shopId);
        const rewardSource = rewardId => {
            const goods = goodsByReward(rewardId);
            if (goods.length) return { kind: 'shop', ids: goods.map(row => row.goodsId), names: goods.map(row => shopName(row.shopId)) };
            const levels = Object.values(adventureLevels).filter(row => row.rewardId === rewardId);
            if (levels.length) return { kind: 'permission', ids: levels.map(row => String(row.level)), names: levels.map(row => `权限等阶 ${row.level}`) };
            if (rewardId.startsWith('reward_mission_')) return { kind: 'mission', ids: [], names: [] };
            if (rewardId.startsWith('reward_activity_')) return { kind: 'activity', ids: [], names: [] };
            if (rewardId.startsWith('reward_eco_')) return { kind: 'map', ids: [], names: [] };
            return { kind: 'reward', ids: [], names: [] };
        };
        const acquisitionRows = {};
        (suit.equipList || []).forEach(equipId => {
            const formulaId = reverse[equipId] || '';
            const formula = formulas[formulaId] || {};
            const unlockType = Number(formula.unlockType || 0);
            const unlockKey = formula.unlockKey || '';
            const templateRewardIds = formulaId ? rewardIdsByItem(formulaId) : [];
            let templateSource = { kind: 'default', level: null, channelId: '', channelName: '', goodsId: '', shopId: '', shopName: '', rewardIds: templateRewardIds };
            if (unlockType === 1) {
                templateSource = { ...templateSource, kind: 'permission', level: Number(formula.unlockValue || 0) };
            } else if (unlockType === 2) {
                const rewardIds = unlockKey ? [unlockKey] : templateRewardIds;
                templateSource = { ...templateSource, kind: 'map', rewardIds };
            } else if (unlockType === 3) {
                const channel = channels[unlockKey] || {};
                const rewardGoods = templateRewardIds.flatMap(rewardId => goodsByReward(rewardId));
                const rewardGoodsIds = rewardGoods.map(goods => goods.goodsId);
                const matchedLevels = Object.entries(channel.channelLevelMap || {}).filter(([, levelRow]) =>
                    (levelRow.newGoodsList || []).some(goodsId => rewardGoodsIds.includes(goodsId))).map(([level]) => Number(level));
                const matchedGoods = rewardGoods.filter(goods => Object.values(channel.channelLevelMap || {}).some(levelRow =>
                    (levelRow.newGoodsList || []).includes(goods.goodsId)));
                templateSource = { ...templateSource, kind: 'channel', channelId: unlockKey,
                    channelName: text(channel.channelName, channel.levelId || unlockKey),
                    level: matchedLevels.length ? Math.min(...matchedLevels) : null,
                    goodsIds: matchedGoods.map(goods => goods.goodsId),
                    shopIds: [...new Set(matchedGoods.map(goods => goods.shopId).filter(Boolean))] };
            } else if (unlockType === 4) {
                const goods = shopGoods[unlockKey] || {};
                templateSource = { ...templateSource, kind: 'shop', goodsId: unlockKey, shopId: goods.shopId || '',
                    shopName: shopName(goods.shopId), rewardIds: goods.rewardId ? [goods.rewardId] : templateRewardIds };
            } else if (unlockType !== 0) {
                templateSource = { ...templateSource, kind: 'unknown' };
            }
            const directSources = rewardIdsByItem(equipId).map(rewardId => {
                const reward = rewards[rewardId];
                const bundle = rewardBundles(reward).find(row => row.id === equipId && Number(row.count || 0) > 0);
                return { rewardId, count: Number(bundle?.count || 0), preset: equipId.includes('_preset_') || rewardId.includes('chartrial'), ...rewardSource(rewardId) };
            });
            acquisitionRows[equipId] = { formulaId, unlockType, unlockKey, unlockValue: formula.unlockValue, templateSource, directSources };
        });
        return { suitId: id, equipsuittable: suit, equiptable: equipRows, itemtable: pick(items, (suit.equipList || []).concat(materialIds)),
            skillpatchtable: pick(skills, skillIds), equipformulatable: pick(formulas, formulaIds), equipformulareversetable: pick(reverse, suit.equipList || []),
            equipformulachaintable: formulaChainRows, equippacktable: pick(packs, packIds), equippackformulatable: pick(packFormulas, packIds), equipenhancecosttable: costs,
            equipenhanceguaranteetimesruletable: guarantees, equipconst: constants, equiptechconst: tech, equipacquisitiontable: acquisitionRows };
    }

    async function itemManifest(version) {
        const [items, itemTypes, showingTypes, itemsByType, itemsByShowingType] = await Promise.all([
            table('ItemTable', version), table('ItemTypeTable', version), table('ItemShowingTypeTable', version),
            table('ItemListByTypeTable', version), table('ItemListByShowingTypeTable', version)
        ]);
        const showingTypeByItem = {};
        Object.entries(itemsByShowingType).forEach(([showingType, row]) => {
            (row.list || []).forEach(itemId => { showingTypeByItem[itemId] = showingType; });
        });
        const typeByItem = {};
        Object.entries(itemsByType).forEach(([type, row]) => {
            (row.list || []).forEach(itemId => { typeByItem[itemId] = type; });
        });
        const rows = Object.entries(items).map(([itemId, row], index) => {
            const showingType = String(showingTypeByItem[itemId] ?? row.showingType ?? 0);
            const showing = showingTypes[showingType];
            const type = String(typeByItem[itemId] ?? row.type);
            const itemType = itemTypes[type];
            const categoryId = showing && showingType !== '0' ? `showing:${showingType}` : `type:${type}`;
            return { itemId, name: text(row.name, itemId), rarity: row.rarity, type: row.type, categoryId,
                categoryName: text(showing?.name, text(itemType?.name, itemT('typeFallback', { type }))),
                categoryOrder: showing ? showing.sortId : 1000 + Number(type),
                icon: icon('item', itemId, row.iconId), contentFile: `/__v3/item/${itemId}.json`, sourceOrder: index, hidden: false,
                __diffSignature: diffSignature([row, itemType, showing, type, showingType]) };
        });
        return assignPriority(rows.sort(byRarityThenId));
    }

    async function itemDetail(id, version) {
        const [items, types, jumps, composites, showing, useItems, equipItems, machineCrafts, machineCraftGroups,
            manualCrafts, hubCrafts, buildings, equipFormulas, growFormulas, seedFormulas, spaceshipFormulas,
            factoryEnvironments, i18n] = await Promise.all([
            table('ItemTable', version), table('ItemTypeTable', version), table('SystemJumpTable', version), table('ItemIconCompositeTable', version), table('ItemShowingTypeTable', version),
            table('UseItemTable', version), table('EquipItemTable', version), table('FactoryMachineCraftTable', version), table('FactoryMachineCraftGroupTable', version),
            table('FactoryManualCraftTable', version), table('FactoryHubCraftTable', version), table('FactoryBuildingTable', version), table('EquipFormulaTable', version),
            table('SpaceshipGrowCabinFormulaTable', version), table('SpaceshipGrowCabinSeedFormulaTable', version), table('SpaceshipManufactureFormulaTable', version),
            table('FactoryEnvDisplayTable', version), loadI18n()
        ]);
        const item = items[id] || {};
        const flattenGroups = rows => (rows || []).flatMap(row => row.group || []);
        const factoryEnvironment = value => {
            const gasEnv = Number(value || 0);
            if (!gasEnv) return null;
            const environmentId = Number(factoryEnvironments[String(gasEnv)]?.GenEnv || gasEnv);
            const textId = FACTORY_ENVIRONMENT_TEXT_IDS[environmentId];
            return { id: environmentId, name: (textId && (i18n.localized?.[textId] || i18n.chinese?.[textId])) || `gasEnv ${environmentId}` };
        };
        const recipeRows = [];
        const addRecipe = (recipeId, kind, name, inputs, outputs, meta, durationMs, environment) => {
            const normalizedInputs = (inputs || []).filter(row => row?.id);
            const normalizedOutputs = (outputs || []).filter(row => row?.id);
            if (!normalizedInputs.some(row => row.id === id) && !normalizedOutputs.some(row => row.id === id)) return;
            recipeRows.push({ recipeId, kind, name, inputs: normalizedInputs, outputs: normalizedOutputs,
                meta: meta || '', durationMs: durationMs || 0, environment: environment || null });
        };
        Object.entries(machineCrafts).forEach(([recipeId, row]) => {
            const building = buildings[row.machineId] || {};
            const msPerRound = machineCraftGroups[row.formulaGroupId]?.msPerRound || 0;
            addRecipe(recipeId, itemT('recipeKinds.integratedIndustry'), text(row.formulaDesc, recipeId), flattenGroups(row.ingredients), flattenGroups(row.outcomes),
                text(building.name, row.machineId), row.progressRound * msPerRound, factoryEnvironment(row.gasEnv));
        });
        Object.entries(manualCrafts).forEach(([recipeId, row]) => {
            addRecipe(recipeId, itemT('recipeKinds.manualCrafting'), text(row.name, recipeId), row.ingredients, row.outcomes, '');
        });
        Object.entries(hubCrafts).forEach(([recipeId, row]) => {
            addRecipe(recipeId, itemT('recipeKinds.hubManufacturing'), recipeId, row.ingredients, row.outcomes, row.usableLevel ? itemT('craft.usableLevel', { level: row.usableLevel }) : '');
        });
        Object.entries(equipFormulas).forEach(([recipeId, row]) => {
            const inputs = (row.costItemId || []).map((itemId, index) => ({ id: itemId, count: row.costItemNum?.[index] || 0 }));
            if (row.costGoldId && row.costGoldNum) inputs.unshift({ id: row.costGoldId, count: row.costGoldNum });
            addRecipe(recipeId, itemT('recipeKinds.equipmentManufacturing'), recipeId, inputs, [{ id: row.outcomeEquipId, count: 1 }], '');
        });
        Object.entries(growFormulas).forEach(([recipeId, row]) => {
            addRecipe(recipeId, itemT('recipeKinds.growCabinPlanting'), recipeId, [{ id: row.seedItemId, count: row.seedItemCount }],
                [{ id: row.outcomeItemId, count: row.outcomeItemCount }], row.level ? itemT('craft.facilityLevel', { level: row.level }) : '', row.totalProgress);
        });
        Object.entries(seedFormulas).forEach(([recipeId, row]) => {
            addRecipe(recipeId, itemT('recipeKinds.growCabinSeedCollection'), recipeId, [{ id: row.materialItemId, count: row.materialItemCount }],
                [{ id: row.outcomeseedItemId, count: row.outcomeseedItemCount }], row.level ? itemT('craft.facilityLevel', { level: row.level }) : '');
        });
        Object.entries(spaceshipFormulas).forEach(([recipeId, row]) => {
            addRecipe(recipeId, itemT('recipeKinds.spaceshipManufacturing'), recipeId, [], [{ id: row.outcomeItemId, count: 1 }],
                row.level ? itemT('craft.facilityLevel', { level: row.level }) : '', row.totalProgress);
        });
        recipeRows.sort((a, b) => a.kind.localeCompare(b.kind, languageInfo().htmlLang) || a.recipeId.localeCompare(b.recipeId, 'en'));
        const recipeItemIds = new Set(recipeRows.flatMap(row => row.inputs.concat(row.outputs).map(entry => entry.id)));
        return { itemId: id, itemtable: item, itemtypetable: types[item.type] || {}, systemjumptable: pick(jumps, item.obtainWayIds || []),
            itemiconcompositetable: composites[item.iconCompositeId], itemshowingtypetable: showing[item.showingType],
            useitemtable: useItems[id], equipitemtable: equipItems[id], craftrecipes: recipeRows,
            craftitemtable: pick(items, Array.from(recipeItemIds)) };
    }

    async function dungeonManifest(version) {
        const [series, dungeons] = await Promise.all([table('DungeonSeriesTable', version), table('DungeonTable', version)]);
        const categoryNames = {
            dungeon_highdifficulty: 'highDifficulty', dungeon_bossrush: 'bossRush', dungeon_ss: 'protocolSpace',
            dungeon_actmonster: 'eventCombat', dungeon_challenge: 'challenge', dungeon_resource: 'resource',
            dungeon_weeklyraid: 'weeklyRaid', dungeon_char: 'characterMission', dungeon_chartutorial: 'characterTutorial',
            dungeon_contract: 'contingencyContract', dungeon_train: 'training', dungeon_worldlevel: 'worldLevel',
            dungeon_wuling_A: 'wulingA', dungeon_wuling_B: 'wulingB'
        };
        const rows = Object.entries(series).filter(([, row]) => row.gameCategory).map(([templateId, row], index) => ({
            templateId, name: text(row.name, templateId), rarity: dungeonRarity(row),
            gameCategory: row.gameCategory, gameCategoryName: categoryNames[row.gameCategory] ? dungeonT(`categories.${categoryNames[row.gameCategory]}`) : row.gameCategory,
            categoryOrder: dungeonRarity(row) * -1, dungeonCount: (row.includeDungeonIds || []).length,
            image: row.dungeonPicPath ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/dungeon/${row.dungeonPicPath}_bg.png` : '',
            contentFile: `/__v3/dungeon/${templateId}.json`, sourceOrder: index, hidden: false,
            __diffSignature: diffSignature([row, pick(dungeons, row.includeDungeonIds || [])])
        }));
        return assignPriority(rows.sort(byRarityThenId));
    }

    async function dungeonDetail(id, version) {
        const [series, dungeons, rewards, items, enemies, display, attrs] = await Promise.all([
            table('DungeonSeriesTable', version), table('DungeonTable', version), table('RewardTable', version), table('ItemTable', version),
            table('EnemyTable', version), table('EnemyTemplateDisplayInfoTable', version), table('EnemyAttributeTemplateTable', version)
        ]);
        const seriesRow = series[id] || {};
        const dungeonRows = pick(dungeons, seriesRow.includeDungeonIds || []);
        const rewardIds = new Set();
        const enemyIds = new Set();
        const spawnerByDungeon = {};
        const scriptBuffsByDungeon = {};
        const scriptEnemiesByDungeon = {};
        const levelDataByDungeon = {};
        const sceneRuntimeCache = new Map();
        Object.values(dungeonRows).forEach(row => {
            ['rewardId', 'firstPassRewardId', 'extraRewardId', 'customRewardId', 'hunterModeRewardId'].forEach(key => { if (row[key]) rewardIds.add(row[key]); });
            (row.enemyIds || []).forEach(enemyId => enemyIds.add(enemyId));
        });
        await Promise.all(Object.entries(dungeonRows).map(async ([dungeonId, row]) => {
            if (!row.sceneId) return;
            const mainLevelData = await optionalJson(`/public/Json/LevelData/${row.sceneId}/${row.sceneId}_lv_data.json`);
            levelDataByDungeon[dungeonId] = mainLevelData ? { [`${row.sceneId}_lv_data`]: mainLevelData } : {};
            if (!sceneRuntimeCache.has(row.sceneId)) {
                sceneRuntimeCache.set(row.sceneId, (async () => {
                    const spawnerManifest = await window.akeAssetIndex.listJsonFiles(`SpawnerConfig/${row.sceneId}`);
                    const spawnerBase = `/public/Json/SpawnerConfig/${row.sceneId}`;
                    const loadEntries = (manifest, base) => Array.isArray(manifest)
                        ? Promise.all(manifest.filter(entry => !entry.hidden).sort((a, b) =>
                            (a.priority || 999) - (b.priority || 999) || String(a.id || '').localeCompare(String(b.id || ''), 'en'))
                            .map(entry => optionalJson(entry.contentFile || `${base}/${entry.id}.json`)))
                        : Promise.resolve([]);
                    const [configs, scriptBuffs, scriptEnemies] = await Promise.all([
                        loadEntries(spawnerManifest, spawnerBase),
                        window.AKECombatData?.loadSceneScriptBuffs(row.sceneId) || {},
                        window.AKECombatData?.loadSceneScriptEnemies(row.sceneId) || []
                    ]);
                    const spawners = {};
                    configs.filter(Boolean).forEach(config => { spawners[config.configId] = config; });
                    return { spawners, scriptBuffs, scriptEnemies };
                })());
            }
            const runtime = await sceneRuntimeCache.get(row.sceneId);
            Object.values(runtime.spawners).forEach(config =>
                (config.enemyLibrary || []).forEach(enemy => enemyIds.add(enemy.enemyId)));
            spawnerByDungeon[dungeonId] = runtime.spawners;
            scriptBuffsByDungeon[dungeonId] = runtime.scriptBuffs;
            scriptEnemiesByDungeon[dungeonId] = runtime.scriptEnemies;
            runtime.scriptEnemies.forEach(enemy => enemyIds.add(enemy.enemyId));
        }));
        const rewardRows = pick(rewards, Array.from(rewardIds));
        const itemIds = Object.values(rewardRows).flatMap(row => [
            ...(row.itemBundles || []),
            ...(row.probItemBundles || [])
        ].map(bundle => bundle.id));
        const enemyRows = pick(enemies, Array.from(enemyIds));
        const templateIds = Object.values(enemyRows).map(row => row.templateId);
        const attrIds = Object.values(enemyRows).map(row => row.attrTemplateId);
        Object.values(dungeonRows).forEach(row => {
            row.enemyTable = enemyRows; row.enemyTemplateDisplayInfoTable = pick(display, templateIds);
            row.enemyAttributeTemplateTable = pick(attrs, attrIds); row.rewardTable = rewardRows; row.itemTable = pick(items, itemIds);
        });
        Object.entries(dungeonRows).forEach(([dungeonId, row]) => {
            row.LevelData = levelDataByDungeon[dungeonId] || {};
            row.SpawnerConfig = spawnerByDungeon[dungeonId] || {};
            row.ScriptBuffsBySpawner = scriptBuffsByDungeon[dungeonId] || {};
            row.LevelScriptEnemies = scriptEnemiesByDungeon[dungeonId] || [];
        });
        return { dungeonSeriesId: id, dungeonseriestable: seriesRow, dungeontable: dungeonRows };
    }

    async function achievementManifest(version) {
        const [types, achievements] = await Promise.all([table('AchievementTypeTable', version), table('AchievementTable', version)]);
        const rows = Object.entries(types).map(([categoryId, row]) => {
            const groupIds = new Set((row.achievementGroupData || []).map(group => group.groupId));
            const entries = Object.entries(achievements).filter(([, achievement]) => groupIds.has(achievement.groupId));
            const first = entries[0];
            const firstLevel = first ? Object.values(first[1].levelInfos || {})[0] : null;
            const entitySignatures = Object.fromEntries(entries.map(([achievementId, achievement]) => [achievementId, diffSignature({
                name: achievement.name,
                order: achievement.order,
                canBeUpgraded: achievement.canBeUpgraded,
                canBePlated: achievement.canBePlated,
                applyRareEffect: achievement.applyRareEffect,
                levels: Object.values(achievement.levelInfos || {}).map(level => ({
                    achieveLevel: level.achieveLevel,
                    completeDesc: level.completeDesc,
                    conditions: (level.conditions || []).map(condition => pick(condition, ['desc', 'progressToCompare']))
                }))
            })]));
            return { categoryId, name: text(row.categoryName, categoryId), achievementCount: entries.length,
                groupCount: groupIds.size, platedCount: entries.filter(([, achievement]) => achievement.canBePlated).length,
                icon: first && firstLevel ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/medaliconbig/${first[0]}_lv${String(firstLevel.achieveLevel).padStart(2, '0')}.png` : '',
                contentFile: `/__v3/achievement/${categoryId}.json`, categoryPriority: row.categoryPriority, hidden: false,
                __diffGroupSignature: diffSignature({
                    categoryName: row.categoryName,
                    noObtainCanView: row.noObtainCanView,
                    groups: (row.achievementGroupData || []).map(group => pick(group, ['groupId', 'groupName']))
                }),
                __diffEntitySignatures: entitySignatures,
                __diffSignature: diffSignature([row, entries]) };
        });
        rows.sort((a, b) => (a.categoryPriority || 999) - (b.categoryPriority || 999) || compareId(a, b));
        return assignPriority(rows);
    }

    async function achievementDetail(id, version) {
        const [types, achievements] = await Promise.all([table('AchievementTypeTable', version), table('AchievementTable', version)]);
        const category = types[id] || {};
        const groupNames = Object.fromEntries((category.achievementGroupData || []).map(group => [group.groupId, text(group.groupName, 'default')]));
        const group = {};
        Object.entries(achievements).forEach(([achieveId, row]) => {
            if (!(row.groupId in groupNames)) return;
            const groupName = groupNames[row.groupId] || 'default';
            if (!group[groupName]) group[groupName] = {};
            group[groupName][achieveId] = { name: text(row.name, achieveId), order: row.order, canBeUpgraded: row.canBeUpgraded,
                canBePlated: row.canBePlated, applyRareEffect: row.applyRareEffect, noObtainCanView: category.noObtainCanView,
                level: Object.values(row.levelInfos || {}).map(level => ({ level: level.achieveLevel,
                    icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/medaliconbig/${achieveId}_lv${String(level.achieveLevel).padStart(2, '0')}.png`,
                    desc: text(level.completeDesc), conditions: (level.conditions || []).map(cond => text(cond.desc)),
                    progressToCompare: (level.conditions || []).map(cond => cond.progressToCompare) })) };
        });
        return { categoryId: id, categoryName: text(category.categoryName, id), group };
    }

    function rewardsToView(rewardId, rewards, items) {
        return (rewards[rewardId]?.itemBundles || []).map(bundle => {
            const item = items[bundle.id] || {};
            return { id: bundle.id, count: bundle.count, name: text(item.name, bundle.id), picpath: icon('item', bundle.id, item.iconId) };
        });
    }

    function itemsToView(itemIds, items) {
        return [...new Set((itemIds || []).filter(Boolean))].map(itemId => {
            const item = items[itemId] || {};
            return { id: itemId, count: null, name: text(item.name, itemId), picpath: icon('item', itemId, item.iconId) };
        });
    }

    const ACTIVITY_CONDITIONAL_STAGE_PANELS = new Set([
        'ActivityArknightsBirth', 'ActivityCleaning', 'ActivityCoin', 'ActivityContingencyContract',
        'ActivityDevelopReturn', 'ActivityDoubleAssault', 'ActivityDungeonActMonster', 'ActivityHighDifficulty',
        'ActivityLimitedFormulaAssistRegion', 'ActivityMaterialSupply', 'ActivityPhotoTaking',
        'ActivityPhotoTakingUniverse', 'ActivitySimulationTrainingTask', 'ActivityStaminaDiscount', 'ActivityVersionGuide'
    ]);
    const ACTIVITY_CHECKIN_PANELS = new Set([
        'ActivityCharSignCommon', 'ActivityRewardRegistration', 'ActivityFreeMonthlyPass', 'ActivityReflowFormal'
    ]);
    const ACTIVITY_LEVEL_REWARD_PANELS = new Set(['ActivityGachaBeginner', 'ActivityLevelRewards', 'ActivityMissionReward']);
    const ACTIVITY_TASK_REWARD_PANELS = new Set([
        'ActivityContingencyContract', 'ActivityCoin', 'ActivityReflowFormal',
        'ActivitySimulationTrainingTask', 'ActivityDoubleAssault'
    ]);

    async function activityManifest(version) {
        const [activities, tags, times] = await Promise.all([
            table('ActivityTable', version), table('ActivityTagTable', version),
            table('TimeRangeTable', version)
        ]);
        const now = Date.now();
        const rows = Object.entries(activities).map(([activityId, row], index) => {
            const range = times[row.timeId]?.timeRangeList?.[0] || {};
            const open = range.openTime ? new Date(range.openTime).getTime() : 0;
            const close = range.closeTime ? new Date(range.closeTime).getTime() : 0;
            const statusOrder = !close ? 3 : (open > now ? 1 : (close < now ? 2 : 0));
            return { activityId, name: text(row.name, activityId), rawType: row.type,
                tags: (row.tagIds || []).map(tagId => ({ tagId, name: text(tags[tagId]?.name, tagId) })),
                openTime: range.openTime || '', closeTime: range.closeTime || '',
                tabImg: row.tabImg ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${row.tabImg}.png` : '', contentFile: `/__v3/activity/${activityId}.json`,
                statusOrder, sourceOrder: row.sortId ?? index, hidden: false,
                __diffSignature: diffSignature([
                    row, times[row.timeId], pick(tags, row.tagIds || [])
                ]) };
        });
        rows.sort((a, b) => a.statusOrder - b.statusOrder || a.sourceOrder - b.sourceOrder || compareId(a, b));
        return assignPriority(rows);
    }

    async function activityDetail(id, version) {
        const [activities, tags, times] = await Promise.all([
            table('ActivityTable', version), table('ActivityTagTable', version), table('TimeRangeTable', version)
        ]);
        const row = activities[id] || {};
        const panelId = row.panelId || '';
        const detailTables = {};
        const detailLoads = [];
        const loadDetailTable = (key, tableName) => {
            detailLoads.push(table(tableName, version).then(value => { detailTables[key] = value; }));
        };

        if (row.instructionId) loadDetailTable('instructions', 'InstructionBook');
        if (ACTIVITY_CONDITIONAL_STAGE_PANELS.has(panelId)) loadDetailTable('conditionalStages', 'ActivityConditionalMultiStageTable');
        if (id === 'dungeon_fighting') {
            loadDetailTable('fightingStages', 'ActivityDungeonFightingStageTable');
            loadDetailTable('dungeons', 'DungeonTable');
        }
        if (ACTIVITY_CHECKIN_PANELS.has(panelId)) loadDetailTable('checkins', 'CheckInRewardTable');
        if (ACTIVITY_LEVEL_REWARD_PANELS.has(panelId)) loadDetailTable('levelRewards', 'ActivityLevelRewardsTable');
        if (ACTIVITY_TASK_REWARD_PANELS.has(panelId)) loadDetailTable('taskRewards', 'ActivityConditionalMultiStageTaskConfigTable');
        if (panelId === 'ActivityCoin') loadDetailTable('racingMilestones', 'ActivityRacingDungeonMilestoneTable');
        if (panelId === 'ActivityWeeklyTask') loadDetailTable('weeklyMilestones', 'ActivityWeeklyTaskMileStoneTable');
        if (panelId === 'ActivityReflowFormal') loadDetailTable('reflowRewards', 'ActivityReflowTable');
        if (panelId === 'ActivityCharacterTrial') loadDetailTable('charTrials', 'ActivityCharTrial');
        if (panelId === 'ActivityArknightsBirth') loadDetailTable('birthStages', 'ActivityArknightsBirthMultiStageTable');
        if (panelId === 'ActivityBenefits') loadDetailTable('benefits', 'ActivityBenefitsTable');
        await Promise.all(detailLoads);

        const rewardIds = new Set();
        const addRewardId = rewardId => { if (rewardId) rewardIds.add(rewardId); };
        addRewardId(row.rewardId);

        const stageRows = [];
        Object.entries(detailTables.conditionalStages?.[id]?.stageList || {}).forEach(([stageId, stage]) => {
            addRewardId(stage.rewardId);
            stageRows.push({ stageId, stage, source: 'conditional' });
        });
        if (id === 'dungeon_fighting') {
            Object.entries(detailTables.fightingStages || {}).forEach(([stageId, stage]) => {
                const dungeon = detailTables.dungeons?.[stage.levelId] || {};
                addRewardId(dungeon.rewardId);
                stageRows.push({ stageId, stage, dungeon, source: 'dungeon' });
            });
        }

        const rewardGroupRows = [];
        const addRewardGroup = group => {
            addRewardId(group.rewardId);
            rewardGroupRows.push(group);
        };

        (detailTables.checkins?.[id]?.stageList || []).forEach((stage, index) => addRewardGroup({
            id: `checkin-${stage.day ?? index + 1}`, kind: 'checkin', day: stage.day ?? index + 1,
            title: text(stage.rewardName), keyReward: stage.isKeyReward === true, sortId: 1000 + (stage.day ?? index + 1),
            rewardId: stage.rewardId
        }));
        (detailTables.levelRewards?.[id]?.stageList || []).forEach((stage, index) => addRewardGroup({
            id: stage.stageStrId || `level-${index + 1}`, kind: 'level', index: stage.stageId ?? index + 1,
            desc: text(stage.conditions?.[0]?.desc), sortId: 1000 + (stage.stageId ?? index + 1), rewardId: stage.rewardId
        }));
        Object.values(detailTables.taskRewards?.[id]?.TaskConfigMap || {}).forEach((task, index) => addRewardGroup({
            id: task.taskId || `task-${index + 1}`, kind: 'task', index: task.sortId ?? index + 1, title: text(task.desc),
            sortId: 2000 + (task.sortId ?? index + 1), rewardId: task.rewardId
        }));
        Object.values(detailTables.racingMilestones?.[id]?.milestoneMap || {}).forEach((milestone, index) => addRewardGroup({
            id: `racing-${milestone.nodeId ?? index + 1}`, kind: 'milestone', score: milestone.completeScore,
            sortId: 3000 + (milestone.nodeId ?? index + 1), rewardId: milestone.rewardId
        }));
        Object.values(detailTables.weeklyMilestones?.[id]?.mileStones || {}).forEach((milestone, index) => addRewardGroup({
            id: `weekly-${milestone.score ?? index + 1}`, kind: 'milestone', score: milestone.score,
            sortId: 1000 + (milestone.score ?? index + 1), rewardId: milestone.rewardId
        }));

        const reflow = detailTables.reflowRewards?.[id];
        if (reflow?.reflowCfg?.oneTimeRewardId) addRewardGroup({
            id: 'reflow-one-time', kind: 'reflowOneTime', sortId: 0, rewardId: reflow.reflowCfg.oneTimeRewardId
        });
        Object.values(reflow?.questionnaires || {}).forEach((questionnaire, index) => addRewardGroup({
            id: questionnaire.questionnaireTriggerId || `questionnaire-${index + 1}`, kind: 'questionnaire',
            index: questionnaire.sortId ?? index + 1, title: text(questionnaire.title),
            sortId: 3000 + (questionnaire.sortId ?? index + 1), rewardId: questionnaire.rewardId
        }));
        Object.values(reflow?.stages || {}).forEach((stage, index) => addRewardGroup({
            id: stage.milestoneStageId || `reflow-stage-${index + 1}`, kind: 'milestone', score: stage.pointRequired,
            sortId: 4000 + index, rewardId: stage.rewardId
        }));

        Object.entries(detailTables.charTrials || {}).filter(([, trial]) => trial.activityId === id).forEach(([trialId, trial], index) => addRewardGroup({
            id: trialId, kind: 'trial', index: index + 1, desc: text(trial.desc), sortId: 1000 + (trial.sortId ?? index + 1),
            rewardId: trial.rewardId
        }));
        Object.entries(detailTables.birthStages || {}).forEach(([stageId, stage], index) => {
            if (!stage.rewardItemId || stage.isVisible === false) return;
            addRewardGroup({ id: stageId, kind: 'phase', index: index + 1, sortId: 1000 + index, rewardId: stage.rewardItemId });
        });
        (detailTables.benefits?.[id]?.stageList || []).forEach((benefit, index) => rewardGroupRows.push({
            id: benefit.benefitId || `benefit-${index + 1}`, kind: 'benefit', index: index + 1,
            title: text(benefit.title), desc: [text(benefit.desc), text(benefit.bigRewardStatement)].filter(Boolean).join('\n'),
            sortId: 1000 + (benefit.sortId ?? index + 1),
            directItemIds: [benefit.bigRewardId, ...(benefit.rewardIdList || [])]
        }));

        const needsItems = rewardIds.size > 0 || rewardGroupRows.some(group => group.directItemIds?.length);
        const [rewards, items] = await Promise.all([
            rewardIds.size > 0 ? table('RewardTable', version) : Promise.resolve({}),
            needsItems ? table('ItemTable', version) : Promise.resolve({})
        ]);

        const instruction = detailTables.instructions?.[row.instructionId] || null;
        const stageList = {};
        stageRows.forEach(({ stageId, stage, dungeon, source }) => {
            if (source === 'dungeon') {
                stageList[stageId] = { name: text(dungeon.dungeonName, stageId), desc: text(dungeon.dungeonDesc), sortId: dungeon.sortId,
                    opentime: times[row.timeId]?.timeRangeList?.[0]?.openTime || '', rewarddetail: rewardsToView(dungeon.rewardId, rewards, items) };
                return;
            }
            const range = times[stage.timeId]?.timeRangeList?.[0] || {};
            stageList[stageId] = { name: text(stage.name, stageId), desc: text(stage.desc), sortId: stage.sortId,
                opentime: range.openTime || '', rewarddetail: rewardsToView(stage.rewardId, rewards, items) };
        });
        const rewardGroups = rewardGroupRows.map(group => {
            const { rewardId, directItemIds, ...view } = group;
            return { ...view, rewarddetail: directItemIds ? itemsToView(directItemIds, items) : rewardsToView(rewardId, rewards, items) };
        }).filter(group => group.rewarddetail.length > 0).sort((a, b) => (a.sortId || 0) - (b.sortId || 0));

        return { id, name: text(row.name, id), desc: text(row.desc), conditions: (row.conditions || []).map(condition => text(condition.desc)),
            rewarddetail: rewardsToView(row.rewardId, rewards, items), sortId: row.sortId, tabImg: row.tabImg, tabImgColor: row.tabImgColor,
            tags: (row.tagIds || []).map(tagId => ({ tagId, name: text(tags[tagId]?.name, tagId) })), rawType: row.type,
            instruction: instruction ? {
                id: row.instructionId,
                title: text(instruction.title),
                content: text(instruction.content)
            } : null,
            stageList, rewardGroups };
    }

    async function ccManifest(version) {
        const [activityCc, activities, dungeons, contracts, times] = await Promise.all([
            table('ActivityContingencyContractTable', version), table('ActivityTable', version), table('DungeonTable', version),
            table('ContingencyContractTable', version), table('TimeRangeTable', version)
        ]);
        const now = Date.now();
        const rows = Object.values(activityCc).map((row, index) => {
            const activity = activities[row.activityId] || {};
            const dungeon = dungeons[row.gameId] || {};
            const range = times[activity.timeId]?.timeRangeList?.[0] || {};
            const open = range.openTime ? new Date(range.openTime).getTime() : 0;
            const close = range.closeTime ? new Date(range.closeTime).getTime() : 0;
            const statusOrder = !close ? 3 : (open > now ? 1 : (close < now ? 2 : 0));
            const groups = Object.values(contracts[row.gameId]?.contractGroupMap || {});
            const contractCount = groups.reduce((sum, group) => sum + Object.keys(group.contractMap || {}).length, 0);
            return { gameId: row.gameId, activityId: row.activityId, name: text(activity.name, row.gameId),
                image: activity.tabImg ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${activity.tabImg}.png` : '',
                openTime: range.openTime || '', closeTime: range.closeTime || '', statusOrder,
                dungeonName: text(dungeon.dungeonName), contractGroupCount: groups.length, contractCount,
                contentFile: `/__v3/cc/${row.gameId}.json`,
                dungeonFile: dungeon.dungeonSeriesId ? `/__v3/dungeon/${dungeon.dungeonSeriesId}.json` : '',
                sourceOrder: index, hidden: false,
                __diffSignature: diffSignature([row, activity, dungeon, contracts[row.gameId], times[activity.timeId]]) };
        });
        rows.sort((a, b) => a.sourceOrder - b.sourceOrder || compareId(a, b));
        return assignPriority(rows);
    }

    async function ccDetail(id, version) {
        const [activityCc, contracts, tags, tips, locks, levels, rewards, items, taskGroups, tasks, shopGroups, shops, goods] = await Promise.all([
            table('ActivityContingencyContractTable', version), table('ContingencyContractTable', version), table('CcTagTable', version), table('CcTagTipTable', version),
            table('ContingencyContractKeyLockTable', version), table('ContingencyContractLevelTable', version), table('RewardTable', version), table('ItemTable', version),
            table('ActivityContingencyContractTaskGroupTable', version), table('ActivityConditionalMultiStageTaskConfigTable', version),
            table('ShopGroupTable', version), table('ShopTable', version), table('ShopGoodsTable', version)
        ]);
        const activity = Object.values(activityCc).find(row => row.gameId === id) || {};
        return { gameId: id, activitycontingencycontracttable: activity, contingencycontracttable: contracts[id] || {}, cctagtable: tags,
            cctagtiptable: tips, contingencycontractkeylocktable: locks, contingencycontractleveltable: levels[id] || {},
            rewardtable: rewards, itemtable: items, activitycontingencycontracttaskgrouptable: taskGroups,
            activityconditionalmultistagetaskconfigtable: tasks, shopgrouptable: shopGroups[activity.shopGroupId] || {}, shoptable: shops, shopgoodstable: goods };
    }

    const adapters = {
        character: [characterManifest, characterDetail], weapon: [weaponManifest, weaponDetail], enemy: [enemyManifest, enemyDetail],
        equip: [equipManifest, equipDetail], item: [itemManifest, itemDetail], dungeon: [dungeonManifest, dungeonDetail],
        achievement: [achievementManifest, achievementDetail], activity: [activityManifest, activityDetail], cc: [ccManifest, ccDetail]
    };

    function loadMaps() {
        return window.akeLoadMaps();
    }

    async function v3Fetch(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const mountedModule = document.querySelector('#contentArea script[data-ake-v3-module]')?.dataset.akeV3Module || '';
        const manifestMatch = url.match(/^\/public\/(?:CH|EN)\/(?:v2_)?(character|weapon|enemy|equip|item|dungeon|cc|activity|achievement)\/manifest\.json(?:\?|$)/);
        if (manifestMatch && manifestMatch[1] === mountedModule) return virtualResponse(await manifestWithVersionDiff(mountedModule));
        const detailMatch = url.match(/^\/__v3\/(character|weapon|enemy|equip|item|dungeon|cc|activity|achievement)\/([^/?]+)\.json/);
        if (detailMatch && (detailMatch[1] === mountedModule || (mountedModule === 'cc' && detailMatch[1] === 'dungeon'))) {
            const id = decodeURIComponent(detailMatch[2]);
            const data = detailMatch[1] === mountedModule
                ? await detailWithVersionDiff(detailMatch[1], id)
                : await adapters[detailMatch[1]][1](id);
            return virtualResponse(data);
        }
        const charDetailMatch = mountedModule === 'character' && url.match(/^\/public\/(?:CH|EN)\/v2_character\/([^/?]+)\.json/);
        if (charDetailMatch) return virtualResponse(await detailWithVersionDiff('character', decodeURIComponent(charDetailMatch[1])));
        return originalAkeFetch(input, init);
    }

    function patchRouter() {
        if (!window.__akeRouter || window.__akeRouter.__v3Patched) return;
        const originalUpdate = window.__akeRouter.updateUrl.bind(window.__akeRouter);
        window.__akeRouter.updateUrl = function (plugin, id) {
            const marker = document.querySelector('#contentArea script[data-ake-v3-module]');
            const module = marker?.dataset.akeV3Module || '';
            const alias = MODULE_ALIASES[module];
            return originalUpdate(plugin === alias ? `v3_${module}` : plugin, id);
        };
        window.__akeRouter.__v3Patched = true;
    }

    function table(name, version, options = {}) {
        return window.akeDataLoader?.loadTable
            ? window.akeDataLoader.loadTable(name, version, options)
            : loadTableInternal(name, version, options);
    }

    window.akeDataLoader?.registerTableLoader(({ name, version, options }) =>
        loadTableInternal(name, version, options));
    window.akeDataLoader?.registerI18nLoader(() => loadI18n());

    window.AKEV3 = {
        activate(module) {
            if (!adapters[module]) throw new Error(`未知 v3 模块: ${module}`);
            if (document.currentScript) document.currentScript.dataset.akeV3Module = module;
            window.akeFetch = v3Fetch;
            patchRouter();
        },
        preloadTextTable: loadI18n,
        table,
        tables(entries, options = {}) {
            return window.akeDataLoader?.loadTables
                ? window.akeDataLoader.loadTables(entries, options)
                : Promise.all((entries || []).map(entry => table(entry.name, entry.version, { ...options, ...entry })));
        },
        text,
        pointShareUrl,
        async equipTemplateShareUrl(rewardIds) {
            for (const rewardId of rewardIds || []) {
                const url = pointShareUrl(await equipTemplatePointId(rewardId));
                if (url) return url;
            }
            return '';
        }
    };
})();
