(function () {
    'use strict';
    if (window.AKESearchData) return;
    const endpoint = 'https://endfield-assets.fffdan.com/i18n/search/all/';
    const responses = new Map();
    const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
    const entries = object => Object.entries(object || {});
    const plain = value => window.AKEV3.text(value).replace(/<[^>]*>/g, '').trim();
    const title = row => [row?.name, row?.title, row?.groupName, row?.domainName, row?.categoryName,
        row?.dungeonName, row?.taskDesc, row?.list?.[0]?.suitName].map(plain).find(Boolean) || '';
    const abortCheck = signal => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };
    function wait(promise, signal) {
        if (!signal) return promise;
        return new Promise((resolve, reject) => {
            const aborted = () => reject(new DOMException('Aborted', 'AbortError'));
            signal.addEventListener('abort', aborted, { once: true });
            if (signal.aborted) aborted();
            Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
        });
    }

    function contextKey() {
        const state = window.akeDataSource?.getState?.();
        return JSON.stringify([endpoint, state?.baseUrl, state?.selected?.id, state?.selected?.hotfixVersion,
            window.akeI18n.getLanguageInfo().table]);
    }

    function parseResponse(raw) {
        // Match complete JSON strings first, so numbers inside Path/string values are untouched.
        // The service uses uppercase Id, unlike the lowercase TableCfg text reference field.
        const protectedText = raw.replace(/("(?:\\.|[^"\\])*")|(-?\d{16,})(?=\s*[,}\]])/g,
            (token, string, integer) => string || `"${integer}"`);
        const data = JSON.parse(protectedText);
        if (!Array.isArray(data)) throw new Error('Invalid search response: expected an array');
        return data;
    }

    function pathParts(path) {
        if (typeof path !== 'string' || path[0] !== '$') return null;
        const parts = [];
        let offset = 1;
        while (offset < path.length) {
            const rest = path.slice(offset);
            const dot = /^\.([^.[\]]+)/.exec(rest);
            const index = /^\[(\d+)\]/.exec(rest);
            const quoted = /^\[("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\]/.exec(rest);
            let key, length;
            if (dot) { key = dot[1]; length = dot[0].length; }
            else if (index) { key = index[1]; length = index[0].length; }
            else if (quoted) {
                try {
                    key = quoted[1][0] === '"' ? JSON.parse(quoted[1])
                        : quoted[1].slice(1, -1).replace(/\\(['\\])/g, '$1');
                } catch { return null; }
                length = quoted[0].length;
            } else return null;
            if (['__proto__', 'prototype', 'constructor'].includes(key) || key === '*') return null;
            parts.push(key); offset += length;
        }
        return parts.length >= 2 ? parts : null;
    }

    function atPath(value, parts) {
        for (const key of parts) {
            if (!own(value, key)) return undefined;
            value = value[key];
        }
        return value;
    }

    async function request(query, signal, refresh) {
        const key = `${contextKey()}|${query}`;
        const cached = responses.get(key);
        if (!refresh && cached && Date.now() - cached.time < 120000) return cached.data;
        const response = await (window.akeFetch || fetch)(endpoint + encodeURIComponent(query), {
            signal, akeProgress: false, cache: refresh ? 'reload' : 'default'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = parseResponse(await response.text());
        abortCheck(signal);
        responses.delete(key);
        responses.set(key, { time: Date.now(), data });
        while (responses.size > 8) responses.delete(responses.keys().next().value);
        return data;
    }

    // These are entry routes, not table dependency declarations. Each relationship mirrors
    // the corresponding module's adapter. Unhandled dependencies remain unresolved.
    const direct = {
        CharacterTable: [['v3_character', '']],
        ItemTable: [['v3_item', '']],
        EnemyTemplateDisplayInfoTable: [['v3_enemy', '']],
        EquipSuitTable: [['v3_equip', '']],
        AchievementTypeTable: [['v3_achievement', '']],
        ActivityTable: [['v3_activity', '']],
        DomainDataTable: [['region', '']],
        SeasonTowerTable: [['season_tower', '']],
        FacSTTGroupTable: [['tech_tree', 'plan:']],
        FacSTTLayerTable: [['tech_tree', 'layer:']],
        FacSTTNodeTable: [['tech_tree', 'node:']],
        FactoryBuildingTable: [['factory', 'building:']],
        FactoryBatteryItemTable: [['factory', 'battery:']],
        FactoryFuelItemTable: [['factory', 'fuel:']],
        SpaceshipRoomTypeTable: [['spaceship', 'room:']],
        SpaceshipClueDataTable: [['spaceship', 'clue:']],
        SpaceshipRoomAttrTypeTable: [['spaceship', 'attribute:']],
        AdventureTaskTable: [['adventure', 'task:']],
        AdventureBookStageRewardTable: [['adventure', 'stage:']],
        AdventureWorldLevelTable: [['adventure', 'world:']],
        AdventureLevelTable: [['adventure', 'level:']],
        DailyActivationRewardTable: [['adventure', 'daily:']]
    };

    async function targetsFor(hit, row, parts, table, visible, signal) {
        const results = new Map();
        const key = parts[0], source = hit.Table, field = parts[1];
        const add = (module, id, label) => {
            if (!visible.has(module) || id === undefined || id === null || id === '') return;
            const target = { module, id: String(id), title: plain(label) };
            results.set(`${module}:${id}`, target);
        };
        const has = id => visible.has(id);
        const from = async (sourceTable, id, module, prefix = '') => {
            if (!has(module) || id === undefined || id === null) return;
            const target = (await table(sourceTable))[id];
            if (target) add(module, prefix + id, title(target));
        };
        for (const [module, prefix] of direct[source] || []) add(module, prefix + key, title(row));

        if (source === 'ItemTable') {
            // The character profile displays its own item description, not material descriptions.
            if (['name', 'desc'].includes(field)) await from('CharacterTable', key, 'v3_character');
            if (['name', 'desc', 'decoDesc'].includes(field)) {
                if (has('v3_weapon') && (await table('WeaponBasicTable'))[key]) add('v3_weapon', key, title(row));
                if (has('v3_equip') && (await table('EquipTable'))[key]) {
                    const suits = entries(await table('EquipSuitTable')).filter(([, suit]) => (suit.equipList || []).includes(key));
                    if (!suits.length) add('v3_equip', 'suit_none', title(row));
                    for (const [id] of suits) add('v3_equip', id, title(row));
                }
            }
        }
        if (source === 'WeaponBasicTable' && has('v3_weapon')) add('v3_weapon', key, title((await table('ItemTable'))[key]));
        if (source === 'EnemyTable') await from('EnemyTemplateDisplayInfoTable', row.templateId, 'v3_enemy');
        if (source === 'EquipTable' && has('v3_equip')) {
            const suits = entries(await table('EquipSuitTable')).filter(([, suit]) => (suit.equipList || []).includes(key));
            const label = title((await table('ItemTable'))[key]);
            if (!suits.length) add('v3_equip', 'suit_none', label);
            for (const [id] of suits) add('v3_equip', id, label);
        }
        if (source === 'AchievementTable' && has('v3_achievement')) {
            for (const [id, type] of entries(await table('AchievementTypeTable'))) {
                if ((type.achievementGroupData || []).some(group => group.groupId === row.groupId)) add('v3_achievement', id, title(type));
            }
        }
        if (['DungeonTable', 'DungeonSeriesTable'].includes(source) && has('v3_dungeon')) {
            const id = source === 'DungeonTable' ? row.dungeonSeriesId : key;
            const series = (await table('DungeonSeriesTable'))[id];
            if (series?.gameCategory) add('v3_dungeon', id, title(series));
        }
        if (['CharGrowthTable', 'CharacterPotentialTable', 'SpaceshipCharSkillTable'].includes(source)) await from('CharacterTable', key, 'v3_character');
        if (source === 'SpaceshipSkillTable' && has('v3_character')) {
            for (const [id, skills] of entries(await table('SpaceshipCharSkillTable'))) {
                if ((skills.skillList || []).some(skill => skill.skillId === key)) await from('CharacterTable', id, 'v3_character');
            }
        }
        if (source === 'SkillPatchTable') {
            if (has('v3_character')) for (const [id, growth] of entries(await table('CharGrowthTable'))) {
                if (Object.values(growth.skillGroupMap || {}).some(group => group.skillGroupId === key || (group.skillIdList || []).includes(key))) {
                    await from('CharacterTable', id, 'v3_character');
                }
            }
            if (has('v3_weapon')) for (const [id, weapon] of entries(await table('WeaponBasicTable'))) {
                if ((weapon.weaponSkillList || []).includes(key)) add('v3_weapon', id, title((await table('ItemTable'))[id]));
            }
            if (has('v3_equip')) for (const [id, suit] of entries(await table('EquipSuitTable'))) {
                if ((suit.list || []).some(part => part.skillID === key)) add('v3_equip', id, plain(suit.list?.[0]?.suitName));
            }
        }
        if (source === 'PotentialTalentEffectTable' && has('v3_character')) {
            for (const [id, growth] of entries(await table('CharGrowthTable'))) {
                if (Object.values(growth.talentNodeMap || {}).some(node => node.passiveSkillNodeInfo?.talentEffectId === key)) await from('CharacterTable', id, 'v3_character');
            }
            for (const [id, potential] of entries(await table('CharacterPotentialTable'))) {
                if ((potential.potentialUnlockBundle || []).some(bundle => bundle.potentialEffectId === key)) await from('CharacterTable', id, 'v3_character');
            }
        }
        if (source === 'ActivityContingencyContractTable' && has('v3_cc')) {
            add('v3_cc', row.gameId, title((await table('ActivityTable'))[row.activityId]));
        }
        if (source === 'LevelDescTable' && has('region')) {
            for (const [id, domain] of entries(await table('DomainDataTable'))) {
                if ((domain.levelGroup || []).includes(key)) add('region', id, title(domain));
            }
        }
        if (['ShopGroupTable', 'CashShopGroupTable', 'ShopTable', 'CashShopTable', 'ShopGoodsTable', 'CashShopGoodsTable', 'CashShopHintTextTable'].includes(source) && has('v3_shop')) {
            const groups = await table('ShopGroupTable');
            const cash = source.startsWith('Cash');
            if (source.endsWith('GroupTable')) {
                if (groups[key]) add('v3_shop', groups[key].shopGroupId || key, plain(groups[key].shopGroupName));
            } else {
                const shops = await table(cash ? 'CashShopTable' : 'ShopTable');
                const shopIds = new Set(source === 'ShopTable' || source === 'CashShopTable' ? [key]
                    : entries(shops).filter(([, shop]) => (cash ? shop.cashGoodsIds : shop.shopGoodsIds)?.includes(key)).map(([id]) => id));
                const cashGroups = cash ? await table('CashShopGroupTable') : {};
                for (const [id, group] of entries(groups)) {
                    if ((cash ? cashGroups[id]?.cashShopIds : group.shopIds)?.some(shopId => shopIds.has(shopId))) {
                        add('v3_shop', group.shopGroupId || id, plain(group.shopGroupName));
                    }
                }
            }
        }
        if (['PrtsAllItem', 'PrtsFirstLv', 'PrtsReading', 'RichContentTable'].includes(source) && has('v3_archive')) {
            const items = await table('PrtsAllItem');
            if (source === 'PrtsAllItem') add('v3_archive', row.id || key, title(row));
            else if (source === 'PrtsFirstLv') add('v3_archive', row.firstLvId || key, title(row));
            else {
                const reading = source === 'PrtsReading' && parts[1] === 'list' ? row.list?.[parts[2]] : null;
                const contentId = source === 'RichContentTable' ? key : reading?.contentId;
                if (contentId) {
                    const linked = entries(items).filter(([, item]) => item.contentId === contentId || (reading?.prtsId && item.id === reading.prtsId));
                    for (const [id, item] of linked) add('v3_archive', item.id || id, title(item));
                    // Supplemental routes mirror supplementalReadingRecords in v3-archive.js.
                    // Unindexed RichContent records alone do not establish archive membership.
                    if (!linked.length) {
                        const readings = source === 'PrtsReading' ? [[key, row]] : entries(await table('PrtsReading'));
                        for (const [sourceId, collection] of readings) for (const [listId, entry] of entries(collection.list)) {
                            if (entry.contentId === contentId) add('v3_archive', `reading_list:${sourceId}:${entry.uniqId || listId || contentId}:entry`, title(entry) || title(row));
                        }
                    }
                }
            }
        }
        if (source === 'SNSDialogTable' && has('baker')) add('baker', row.dialogId || key, title((await table('SNSChatTable'))[row.chatId]));
        if (source === 'SNSChatTable' && has('baker')) {
            const dialogs = entries(await table('SNSDialogTable')).filter(([, dialog]) => dialog.chatId === key);
            if (!dialogs.length) add('baker', key, title(row));
            for (const [id, dialog] of dialogs) add('baker', dialog.dialogId || id, title(row));
        }
        if (source === 'SNSDialogOptionTable' && has('baker')) {
            for (const [id, dialog] of entries(await table('SNSDialogTable'))) {
                if (Object.values(dialog.dialogContentData || {}).some(node => (node.dialogOptionIds || []).map(String).includes(key))) {
                    add('baker', dialog.dialogId || id, title((await table('SNSChatTable'))[dialog.chatId]));
                }
            }
        }
        if (source === 'SNSDialogTopicTable' && has('baker')) {
            for (const [id, dialog] of entries(await table('SNSDialogTable'))) {
                if (dialog.topicId === key || (row.includeDialogIds || []).includes(dialog.dialogId || id)) add('baker', dialog.dialogId || id, title(row));
            }
        }
        if (source === 'WikiEntryDataTable' && has('tutorial')) {
            const page = Object.values(await table('WikiTutorialPageTable')).find(page => page.tutorialId === key);
            add('tutorial', key, title(page) || title(row));
        }
        if (source === 'WikiTutorialPageTable' && has('tutorial')) {
            const owners = new Set([row.tutorialId || key]);
            for (const [id, index] of entries(await table('WikiTutorialPageByEntryTable'))) if ((index.pageIds || []).includes(key)) owners.add(id);
            for (const id of owners) add('tutorial', id, title(row));
        }
        if (source === 'SpaceshipRoomLvTable' && has('spaceship')) {
            const helper = (await table('SpaceshipRoomLvHelperTable'))[row.id || key];
            const type = row.roomType ?? helper?.roomType ?? 'unassigned';
            add('spaceship', `room:${type}`, title((await table('SpaceshipRoomTypeTable'))[type]));
        }
        if (source === 'FacSTTConditionTable') await from('FacSTTNodeTable', row.techId, 'tech_tree', 'node:');
        if (source === 'FacSTTPackConditionTable') await from('FacSTTGroupTable', row.groupId, 'tech_tree', 'plan:');
        abortCheck(signal);
        return [...results.values()];
    }

    async function search(query, { signal, refresh = false, onProgress } = {}) {
        const raw = await wait(request(query, signal, refresh), signal);
        const visible = new Set((window.akeData.getModules?.() || []).filter(module => !module.disabled && !module.special
            && (!module.hidden || window.akeData.getConfig().showHidden === true)
            && window.akeData.isTokenUnlocked(module.token)).map(module => module.id));
        const diagnostics = { received: raw.length, duplicates: 0, invalid: 0, issues: [], context: contextKey() };
        const loads = new Map();
        const table = name => {
            abortCheck(signal);
            if (!loads.has(name)) loads.set(name, window.AKEV3.table(name));
            return wait(loads.get(name), signal);
        };
        let textMaps;
        const fallbackText = async id => {
            textMaps ||= window.AKEV3.preloadTextTable();
            const maps = await wait(textMaps, signal);
            return plain(maps.localized?.[id] || maps.chinese?.[id] || '');
        };
        const seen = new Set(), hits = [];
        for (const rawHit of raw) {
            if (!rawHit || typeof rawHit.Table !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawHit.Table)
                || typeof rawHit.Path !== 'string' || !/^-?\d+$/.test(String(rawHit.Id))
                || (typeof rawHit.Id === 'number' && !Number.isSafeInteger(rawHit.Id))) {
                diagnostics.invalid++; continue;
            }
            const hit = { Table: rawHit.Table, Path: rawHit.Path, Id: String(rawHit.Id) };
            const identity = JSON.stringify([hit.Table, hit.Path, hit.Id]);
            if (seen.has(identity)) { diagnostics.duplicates++; continue; }
            seen.add(identity); hits.push(hit);
        }
        const results = new Array(hits.length);
        let cursor = 0, completed = 0;
        async function worker() {
            while (cursor < hits.length) {
                abortCheck(signal);
                const index = cursor++, hit = hits[index];
                const candidates = entries(window.AKESearchIndex).filter(([module, definition]) => visible.has(module) && definition.tables.includes(hit.Table)).map(([module]) => module);
                const result = { ...hit, candidates, targets: [], text: '', name: '', status: 'unresolved', field: '' };
                const parts = pathParts(hit.Path);
                try {
                    if (!parts) result.status = 'unsupportedPath';
                    else {
                        const source = await table(hit.Table);
                        const row = own(source, parts[0]) ? source[parts[0]] : undefined;
                        let value = atPath(source, parts);
                        // Some indexers point at the nested text member rather than its reference object.
                        if (parts[parts.length - 1] === 'text') value = atPath(source, parts.slice(0, -1));
                        result.field = parts[1]; result.name = title(row);
                        const referenceId = value && typeof value === 'object' ? value.id : undefined;
                        if (value === undefined || (referenceId !== undefined && String(referenceId) !== hit.Id)) result.status = 'versionMismatch';
                        else {
                            result.text = plain(value);
                            result.targets = await targetsFor(hit, row, parts, table, visible, signal);
                            if (result.targets.length) result.status = 'resolved';
                        }
                    }
                } catch (error) {
                    abortCheck(signal);
                    result.status = 'loadFailed';
                    diagnostics.issues.push({ ...hit, message: error.message });
                }
                if (!result.text) {
                    try { result.text = await fallbackText(hit.Id); }
                    catch (error) { diagnostics.issues.push({ ...hit, message: error.message }); result.status = 'loadFailed'; }
                }
                abortCheck(signal);
                results[index] = result;
                onProgress?.(++completed, hits.length);
            }
        }
        await Promise.all(Array.from({ length: Math.min(4, hits.length) }, worker));
        abortCheck(signal);
        diagnostics.byStatus = results.reduce((counts, result) => {
            counts[result.status] = (counts[result.status] || 0) + 1; return counts;
        }, {});
        diagnostics.unresolved = results.filter(result => !result.targets.length).map(result => ({
            Table: result.Table, Path: result.Path, Id: result.Id, status: result.status, candidates: result.candidates
        }));
        diagnostics.missingModuleDefinitions = [...visible].filter(id => !window.AKESearchIndex[id]);
        return { results, diagnostics };
    }
    window.AKESearchData = { search, contextKey };
})();
