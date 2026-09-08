(function() {
        const t = window.akeI18n.scope('modules.dungeon');
        const commonT = window.akeI18n.scope('common');
        let allSeries = [];
        let rawAllSeries = [];
        let activeSeriesId = null;
        let isInitialized = false;
        let searchTerm = '';
        let attrMap = {};
        let attrNameToId = {};
        let buffCache = {};
        let modifierTypeMap = {};

        const FORMULA_TO_MODTYPE = window.AKEStats.FORMULA_TO_MODTYPE;
        const LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES = window.AKEEnemyRenderer.LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES;

        const IMAGE_BASE_PATH = '/public/images/';

        const CATEGORY_MAP = {
            'dungeon_highdifficulty': 'highDifficulty',
            'dungeon_bossrush': 'bossRush',
            'dungeon_ss': 'protocolSpace',
            'dungeon_actmonster': 'eventCombat',
            'dungeon_challenge': 'challenge',
            'dungeon_resource': 'resource',
            'dungeon_weeklyraid': 'weeklyRaid',
            'dungeon_char': 'characterMission',
            'dungeon_chartutorial': 'characterTutorial',
            'dungeon_contract': 'contingencyContract',
            'dungeon_train': 'training',
            'dungeon_worldlevel': 'worldLevel',
            'dungeon_wuling_A': 'wulingA',
            'dungeon_wuling_B': 'wulingB',
            'dungeon_puzzle': 'mystery',
            'dungeon_roguelike': 'protocolDivergence'
        };

        function getCategoryLabel(category) {
            const key = CATEGORY_MAP[category];
            return key ? t(`categories.${key}`) : category;
        }

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        async function loadMaps() {
            try {
                const data = await window.akeLoadMaps();
                attrMap = data.ATTR_MAP || {};
                const attrEn = data.ATTR_MAP_EN || {};
                Object.entries(attrEn).forEach(([id, name]) => { attrNameToId[name] = parseInt(id, 10); });
                modifierTypeMap = data.MODIFIER_TYPE_MAP || {};
            } catch (err) {
                console.error('加载映射数据失败:', err);
                attrMap = {};
                attrNameToId = {};
            }
        }

        async function loadBuff(buffId) {
            if (buffCache[buffId] !== undefined) return buffCache[buffId];
            try {
                const res = await (window.akeFetch || fetch)(`/public/Json/BuffData/${buffId}.json`);
                if (!res.ok) { buffCache[buffId] = null; return null; }
                buffCache[buffId] = await res.json();
                return buffCache[buffId];
            } catch { buffCache[buffId] = null; return null; }
        }

        async function loadAllBuffs(buffIds) {
            await Promise.all(buffIds.filter(id => buffCache[id] === undefined).map(id => loadBuff(id)));
        }

        function collectBuffIds(data) {
            const ids = new Set();
            Object.values(data.dungeontable || {}).forEach(dg => {
                Object.values(dg.enemyTable || {}).forEach(e => (e.bornBuffs || []).forEach(id => ids.add(id)));
                Object.values(dg.SpawnerConfig || {}).forEach(sc => {
                    (sc.enemyLibrary || []).forEach(lib => (lib.bornBuffList || []).forEach(b => ids.add(b.buffId)));
                });
                (window.AKECombatData?.collectScriptBuffIds(dg) || []).forEach(id => ids.add(id));
            });
            return Array.from(ids);
        }

        function getBuffModifiers(buffId, blackboardOverrides) {
            const buff = buffCache[buffId];
            if (!buff?.attributeModifier?.attributeModifiers?.length) return [];
            const bb = {};
            (buff.blackboard || []).forEach(b => { bb[b.key] = b.valueDouble; });
            (blackboardOverrides || []).forEach(b => { bb[b.key] = b.valueFloat ?? b.valueDouble ?? 0; });
            return buff.attributeModifier.attributeModifiers.map(mod => {
                const attrType = attrNameToId[mod.attributeType];
                if (attrType === undefined) return null;
                const mt = FORMULA_TO_MODTYPE[mod.formulaItem];
                if (mt === undefined) return null;
                let val;
                if (mod.param.useBlackboardKey && mod.param.blackboardKey) {
                    val = bb[mod.param.blackboardKey] ?? mod.param.value;
                } else { val = mod.param.value; }
                return { attrType, attrValue: val, modifierType: mt };
            }).filter(Boolean);
        }

        function findTemplateId(instanceId, table) {
            if (table[instanceId]) return instanceId;
            let best = '';
            Object.keys(table).forEach(k => {
                if (instanceId.startsWith(k) && k.length > best.length) best = k;
            });
            return best || instanceId;
        }

        function escH(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

        function renderSpawnMap(spawner) {
            const waves = spawner.waves;
            if (!waves || !waves.length) return '';

            let allX = [], allZ = [];
            waves.forEach(w => {
                (w.groups || []).forEach(g => {
                    g.spawns.forEach(s => { allX.push(s.position.x); allZ.push(s.position.z); });
                });
            });
            if (!allX.length) return '';
            const pad = 2;
            const halfX = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX))) + pad;
            const halfZ = Math.max(Math.abs(Math.min(...allZ)), Math.abs(Math.max(...allZ))) + pad;
            const minX = -halfX, maxX = halfX, minZ = -halfZ, maxZ = halfZ;
            const rangeX = maxX - minX || 1, rangeZ = maxZ - minZ || 1;
            function toPct(x, z) { return { left: ((x - minX) / rangeX * 100).toFixed(1), top: ((maxZ - z) / rangeZ * 100).toFixed(1) }; }

            let mapSpotsHtml = '';
            waves.forEach((w, wi) => {
                const vis = wi === 0 ? '' : 'display:none;';
                const allSpawns = [];
                (w.groups || []).forEach(g => {
                    const modeKey = { 'Parallel': 'parallel', 'Sequence': 'sequence', 'PartKilled': 'partKilled', 'AllKilled': 'allKilled', 'Deadline': 'deadline' }[g.groupMode];
                    const modeLabel = modeKey ? t(`spawnModes.${modeKey}`) : g.groupMode;
                    let conditionText = '', targetGroupKey = '';
                    if (g.groupMode === 'PartKilled' && g.groupModeTargetKey) { conditionText = t('spawnConditions.partKilled', { group: g.groupModeTargetKey, count: g.groupModeKillCount }); targetGroupKey = g.groupModeTargetKey; }
                    else if (g.groupMode === 'AllKilled' && g.groupModeTargetKey) { conditionText = t('spawnConditions.allKilled', { group: g.groupModeTargetKey }); targetGroupKey = g.groupModeTargetKey; }
                    g.spawns.forEach(spawn => { allSpawns.push({ spawn, group: g, modeLabel, conditionText, targetGroupKey }); });
                });
                const posCount = {};
                allSpawns.forEach(item => {
                    const key = `${item.spawn.position.x.toFixed(1)},${item.spawn.position.z.toFixed(1)}`;
                    if (!posCount[key]) posCount[key] = 0;
                    item.stackIdx = posCount[key];
                    posCount[key]++;
                });
                allSpawns.forEach(item => {
                    const { spawn, group: g, modeLabel, conditionText, targetGroupKey, stackIdx } = item;
                    const pct = toPct(spawn.position.x, spawn.position.z);
                    const posStr = `(${spawn.position.x.toFixed(1)}, ${spawn.position.z.toFixed(1)})`;
                    const randomStr = spawn.randomizeRadius > 0 ? t('spawn.randomRadius', { radius: spawn.randomizeRadius.toFixed(1) }) : '';
                    const delayStr = spawn.timestamp > 0 ? t('spawn.delay', { seconds: spawn.timestamp.toFixed(1) }) : '';
                    const intervalStr = spawn.spawnInterval > 0 ? t('spawn.interval', { seconds: spawn.spawnInterval.toFixed(1) }) : '';
                    const warnStr = spawn.preWarnTime > 0 ? t('spawn.preWarning', { seconds: spawn.preWarnTime.toFixed(1) }) : '';
                    const faceStr = spawn.faceMainCharacter ? t('spawn.faceMainCharacter') : '';
                    const tipLines = [
                        `<b>${escH(spawn.name)} ×${spawn.count} Lv.${spawn.level}</b>`,
                        t('spawn.coordinates', { position: posStr, radius: randomStr }),
                        t('spawn.groupMode', { group: g.groupKey, mode: modeLabel, condition: conditionText ? ` · ${conditionText}` : '' }),
                        [delayStr, intervalStr, warnStr, faceStr].filter(Boolean).join(' · ')
                    ].filter(Boolean);
                    const offsetPct = (0.3 * 100 / (2 * halfX)).toFixed(2);
                    const stackStyle = stackIdx > 0 ? `margin-left:${stackIdx * offsetPct}%;margin-top:-${stackIdx * offsetPct}%;z-index:${10 - stackIdx};` : 'z-index:10;';
                    mapSpotsHtml += `<div class="v2d-map-spot" data-ake-popover-anchor data-wave="${wi}" data-group="${g.groupKey}" data-target-group="${targetGroupKey}" style="left:${pct.left}%;top:${pct.top}%;${vis}${stackStyle}">
                        <img class="v2d-map-spot-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${spawn.templateId}.png">
                        <div class="v2d-map-tip ake-ui-popover" data-placement="top">${tipLines.map(l => `<div>${l}</div>`).join('')}</div>
                    </div>`;
                });
            });

            const coordInfo = `<div class="v2d-map-coords">X: ${minX.toFixed(0)} ~ ${maxX.toFixed(0)}  Z: ${minZ.toFixed(0)} ~ ${maxZ.toFixed(0)}</div>`;
            const unitPct = (100 / (2 * halfX)).toFixed(2);
            return `<div class="v2d-spawn-map-container"><div class="v2d-spawn-map" style="--unit:${unitPct}%"><div class="v2d-map-center"></div>${mapSpotsHtml}</div>${coordInfo}</div>`;
        }

        function parseDungeonWaves(dungeon) {
            const sc = dungeon.SpawnerConfig;
            if (!sc || Object.keys(sc).length === 0) return null;
            const enemyTable = dungeon.enemyTable || {};
            const displayTable = dungeon.enemyTemplateDisplayInfoTable || {};
            const attrTable = dungeon.enemyAttributeTemplateTable || {};
            const dungeonLv = dungeon.recommendLv || 0;
            const allSpawners = [];
            Object.entries(sc).forEach(([configId, spawner]) => {
                const libMap = {};
                const libLevels = new Set();
                (spawner.enemyLibrary || []).forEach(lib => {
                    libMap[lib.key] = lib;
                    libLevels.add(lib.enemyLevel);
                });
                if (libLevels.size === 1 && libLevels.has(0)) return;
                if (dungeonLv > 0 && !libLevels.has(dungeonLv)) return;
                if (!Object.keys(libMap).length) return;
                const waves = [];
                Object.entries(spawner.waveMap || {}).forEach(([waveIdx, wave]) => {
                    const enemies = [];
                    const groups = [];
                    let maxAlive = 0;
                    let hasPause = false;
                    Object.entries(wave.groupMap || {}).forEach(([mapIdx, group]) => {
                        const groupInfo = {
                            groupKey: group.groupKey || mapIdx,
                            groupId: group.groupId,
                            groupMode: group.groupMode || 'Sequence',
                            groupModeTargetKey: group.groupModeTargetKey || '',
                            groupModeKillCount: group.groupModeKillCount || 0,
                            maxCount: (group.limitGroupMaxCount && group.groupMaxCount > 0) ? group.groupMaxCount : 0,
                            timestamp: group.timestamp || 0,
                            spawns: []
                        };
                        if (groupInfo.maxCount > 0) maxAlive += groupInfo.maxCount;
                        Object.values(group.actionMap || {}).forEach(action => {
                            if (action.$type && action.$type.includes('Pause')) { hasPause = true; return; }
                            if (!action.libraryKey) return;
                            const lib = libMap[action.libraryKey];
                            if (!lib) return;
                            const eid = lib.enemyId;
                            const cfg = enemyTable[eid] || {};
                            const templateId = cfg.templateId || findTemplateId(eid, displayTable);
                            const attrTemplateId = cfg.attrTemplateId || findTemplateId(eid, attrTable);
                            const disp = displayTable[templateId] || {};
                            const name = disp.name?.text || templateId;
                            const count = action.spawnCount || 1;
                            groupInfo.spawns.push({
                                instanceId: eid, templateId, attrTemplateId, name, count,
                                level: lib.enemyLevel, bornBuffList: lib.bornBuffList || [],
                                timestamp: action.timestamp || 0,
                                spawnInterval: action.spawnInterval || 0,
                                position: action.position || { x: 0, y: 0, z: 0 },
                                faceMainCharacter: action.faceMainCharacter ?? true,
                                randomizeRadius: action.randomizeRadius || 0,
                                routeId: action.routeId ?? null,
                                preWarnTime: lib.preWarnTime || 0
                            });
                            enemies.push(groupInfo.spawns[groupInfo.spawns.length - 1]);
                        });
                        if (groupInfo.spawns.length > 0) groups.push(groupInfo);
                    });
                    if (enemies.length > 0) {
                        waves.push({
                            waveIdx,
                            waveMode: wave.waveMode || 'Parallel',
                            repeatable: wave.repeatable || false,
                            maxAlive,
                            hasPause,
                            enemies,
                            groups
                        });
                    }
                });
                if (waves.length > 0) allSpawners.push({ configId, waves });
            });
            return allSpawners.length > 0 ? allSpawners : null;
        }

        function getAttrName(attrType) {
            return attrMap[attrType] || t('attributeFallback', { type: attrType });
        }

        function computeAttrWithModifiers(baseValue, modifiers, attrType) {
            return window.AKEStats.computeAttrWithModifiers(baseValue, modifiers, attrType);
        }

        function formatAttrModifiers(modifiers) {
            if (!Array.isArray(modifiers) || modifiers.length === 0) return '';
            const showHidden = getCurrentShowHidden();
            return window.AKEStats.combineModifiers(modifiers).filter(m => !LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(m.attrType)).map(m => {
                const name = getAttrName(m.attrType);
                const val = m.attrValue;
                const isMult = (m.modifierType === 1 || m.modifierType === 4 ||
                    m.modifierType === 6 || m.modifierType === 8);
                const displayVal = (m.modifierType === 4 || m.modifierType === 8) ? val - 1 : val;
                const displayText = `${displayVal > 0 ? '+' : ''}${(displayVal * 100).toFixed(1)}%`;
                const converted = m.modifierType === 4 || m.modifierType === 8;
                const displayHtml = window.renderRawValueTip ? window.renderRawValueTip(displayText, converted ? {
                    name,
                    rawValue: val,
                    value: displayVal,
                    changed: true,
                    formula: `${val} - 1 = ${displayVal}`
                } : val) : displayText;
                let text = isMult
                    ? `${name} ${displayHtml}`
                    : `${name} ${val > 0 ? '+' : ''}${val}`;
                if (showHidden) {
                    const modName = modifierTypeMap[String(m.modifierType)] || '';
                    if (modName) text += ` <span class="v2d-modifier-type-tag">${modName}</span>`;
                }
                return text;
            }).join(', ');
        }

        function formatPlainValue(val) {
            if (typeof val !== 'number') return val;
            if (Math.abs(val) < 1 && val !== 0) {
                return (val * 100).toFixed(1) + '%';
            }
            return Number.isInteger(val) ? val.toString() : val.toFixed(2);
        }

        function formatValue(val) {
            const display = formatPlainValue(val);
            return window.renderRawValueTip ? window.renderRawValueTip(display, val) : display;
        }

        function filterSeriesBySearch(series) {
            if (!searchTerm) return series;
            const term = searchTerm.toLowerCase();
            return series.filter(s =>
                (s.name && s.name.toLowerCase().includes(term)) ||
                (s.templateId && s.templateId.toLowerCase().includes(term))
            );
        }

        const mobileBtn = document.getElementById('v2dungeonMobileListBtn');
        const mobileOverlay = document.getElementById('v2dungeonMobileListOverlay');
        const mobileContent = document.getElementById('v2dungeonMobileListContent');

        function createDungeonDirectoryItem(series, options = {}) {
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: series.name,
                id: series.templateId,
                icon: { src: series.image || '', alt: '' },
                meta: [{ label: series.gameCategoryName || '', kind: 'dungeon-category' }],
                accent: { type: 'rarity', value: series.rarity || 1 },
                active: options.active,
                attributes: { 'data-series-id': series.templateId },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, series);
            return item;
        }

        function buildMobileList() {
            const filtered = filterSeriesBySearch(allSeries);
            mobileContent.innerHTML = '';
            filtered.forEach(series => {
                const item = createDungeonDirectoryItem(series, {
                    active: series.templateId === activeSeriesId,
                    onSelect: () => {
                        activeSeriesId = series.templateId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_dungeon', series.templateId);
                        loadSeriesDetail(series, document.getElementById('v2dungeonDetail'));
                        closeMobileList();
                        const desktopList = document.getElementById('v2dungeonList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-series-id="${CSS.escape(series.templateId)}"]`);
                        if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                    }
                });
                mobileContent.appendChild(item);
            });
        }

        function openMobileList() {
            buildMobileList();
            mobileOverlay.classList.add('is-open'); mobileOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeMobileList() {
            mobileOverlay.classList.remove('is-open'); mobileOverlay.setAttribute('aria-hidden', 'true');
        }

        async function loadSeriesManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/v2_dungeon/manifest.json');
                if (!res.ok) throw new Error('无法加载副本系列清单');
                const all = await res.json();
                rawAllSeries = all;
                let series = showHidden ? all : all.filter(s => !s.hidden);
                series.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return series;
            } catch (err) {
                console.error('加载副本系列清单失败:', err);
                return [];
            }
        }

        function renderDungeonOverview(items, container) {
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                variant: 'landscape',
                group: item => ({ id: item.gameCategory || 'other', name: item.gameCategoryName || t('categories.other'), order: item.categoryOrder }),
                onReset: () => { activeSeriesId = null; },
                onSelect: item => { activeSeriesId = item.templateId; renderSeriesList(); },
                sidebarSelector: item => `.ake-ui-directory__item[data-series-id="${CSS.escape(item.templateId)}"]`,
                items: items.map(item => ({ ...item, id: item.templateId, image: item.image, fallback: t('overview.fallback'),
                    tags: [t('overview.stageCount', { count: item.dungeonCount || 0 }), commonT('rarityLabel', { rarity: item.rarity || 1 })] }))
            });
        }

        function renderSeriesList() {
            const container = document.getElementById('v2dungeonList');
            const detailContainer = document.getElementById('v2dungeonDetail');
            if (!container) return;

            const filtered = filterSeriesBySearch(allSeries);
            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeSeriesId = null;
                return;
            }

            filtered.forEach((item, index) => {
                const node = createDungeonDirectoryItem(item, {
                    active: item.templateId === activeSeriesId
                        || (index === 0 && !activeSeriesId && !window.AKEModuleOverview?.isActive('dungeon')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, node);
                        activeSeriesId = item.templateId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_dungeon', item.templateId);
                        loadSeriesDetail(item, detailContainer);
                    }
                });

                container.appendChild(node);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.templateId === window.__deepLinkId);
                if (deepItem) {
                    activeSeriesId = deepItem.templateId;
                } else {
                    const existsInRaw = rawAllSeries.some(c => c.templateId === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(s => s.templateId === activeSeriesId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('dungeon')) {
                    activeSeriesId = null;
                    renderDungeonOverview(filtered, detailContainer);
                    return;
                }
                activeSeriesId = filtered[0].templateId;
                const firstItem = container.querySelector('.ake-ui-directory__item');
                if (firstItem) window.AKEUI.setDirectoryItemActive(container, firstItem);
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_dungeon', activeSeriesId);
                loadSeriesDetail(filtered[0], detailContainer);
            } else if (activeExists) {
                const activeItem = filtered.find(s => s.templateId === activeSeriesId);
                if (activeItem) {
                    const activeDiv = container.querySelector(`.ake-ui-directory__item[data-series-id="${activeSeriesId}"]`);
                    if (activeDiv) window.AKEUI.setDirectoryItemActive(container, activeDiv);
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_dungeon', activeSeriesId);
                    loadSeriesDetail(activeItem, detailContainer);
                }
            }
        }

        async function loadSeriesDetail(seriesItem, container) {
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const data = await (window.akeFetch || fetch)(seriesItem.contentFile).then(r => r.json());
                await window.AKECombatData?.enrichDungeonScripts(data);
                const buffIds = collectBuffIds(data);
                if (buffIds.length > 0) await loadAllBuffs(buffIds);
                container.innerHTML = renderDetail(data, seriesItem);
                window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, seriesItem) : '');
            } catch (err) {
                container.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: err.message })}</div>`;
            }
        }

        function renderRewards(rewardId, rewardTable, itemTable, bundleKey = 'itemBundles') {
            if (!rewardId || !rewardTable) return '';
            const reward = rewardTable[rewardId];
            const bundles = reward?.[bundleKey] || [];
            if (bundles.length === 0) return '';

            const list = window.AKEUI.element('span', 'ake-ui-material__items v2d-reward-items');
            bundles.forEach(bundle => {
                const item = itemTable?.[bundle.id];
                const name = item?.name?.text || bundle.id;
                const rarity = item?.rarity || 0;
                const iconId = item?.iconId || bundle.id;
                const rewardItem = window.AKEUI.materialItem({
                    className: 'v2d-reward-item',
                    icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`,
                    name,
                    count: bundle.count > 0 ? bundle.count : null,
                    element: 'a',
                    attributes: { ...(rarity > 0 ? { 'data-rarity': rarity } : {}), ...window.__akeRouter?.entryAttributes?.('v3_item', bundle.id, name) }
                });
                if (!rewardItem) return;
                if (rarity > 0) {
                    const rarityDot = window.AKEUI.element('span', `v2d-reward-rarity r-${rarity}`);
                    const nameNode = rewardItem.querySelector('.ake-ui-material__item-name');
                    rewardItem.insertBefore(rarityDot, nameNode || null);
                }
                list.appendChild(rewardItem);
            });
            return list.childElementCount ? list.outerHTML : '';
        }

        function getEnemyStatsAtLevel(attrTemplateData, enemyLevel, modifiers) {
            return window.AKEStats.getEnemyStatsAtLevel(attrTemplateData, enemyLevel, modifiers, {
                getAttrName,
                includeModifierOnlyAttrs: true,
                excludeAttrTypes: LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES
            });
        }

        function getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers) {
            return window.AKEStats.getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers, {
                getAttrName,
                includeModifierOnlyAttrs: true,
                excludeAttrTypes: LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES
            });
        }

        function formatStatValue(value, detail) {
            const display = formatPlainValue(value);
            if (!detail || !window.renderRawValueTip) return display;
            return window.renderRawValueTip(display, detail);
        }

        function renderEnemyCard(enemyId, enemyLevel, dungeonData, libraryBuffs, scriptedBuffs) {
            const enemyConfig = dungeonData.enemyTable?.[enemyId] || {};
            const displayTable = dungeonData.enemyTemplateDisplayInfoTable || {};
            const attrTable = dungeonData.enemyAttributeTemplateTable || {};
            const templateId = enemyConfig.templateId || findTemplateId(enemyId, displayTable);
            const attrTemplateId = enemyConfig.attrTemplateId || findTemplateId(enemyId, attrTable);
            const displayInfo = displayTable[templateId] || {};
            const attrData = attrTable[attrTemplateId] || {};

            const name = displayInfo.name?.text || templateId;
            const nickname = displayInfo.nickname?.text || '';
            const desc = displayInfo.description?.text || '';
            const inlineModifiers = enemyConfig.attrModifiers || [];
            const iconSrc = `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${templateId}.png`;

            const ownBuffs = enemyConfig.bornBuffs || [];
            const libBuffs = [...(libraryBuffs || []), ...(window.AKECombatData?.staticEnemyBuffs(dungeonData, enemyId, enemyLevel) || [])];
            const ownBuffModifiers = ownBuffs.flatMap(id => getBuffModifiers(id, []));
            const libraryBuffModifiers = libBuffs.flatMap(b => getBuffModifiers(b.buffId, b.blackboard));
            const buffModifiers = [...ownBuffModifiers, ...libraryBuffModifiers];
            const allModifiers = [...inlineModifiers, ...buffModifiers];
            const scriptModifiers = (scriptedBuffs || []).flatMap(b => getBuffModifiers(b.buffId, b.blackboard));

            const flags = [];
            if (enemyConfig.isDangerous) flags.push(`<span class="v2d-enemy-flag danger">${t('flags.dangerous')}</span>`);
            if (enemyConfig.showBigEffect) flags.push(`<span class="v2d-enemy-flag big-effect">${t('flags.globalEffect')}</span>`);
            if (enemyConfig.showBigHeadbar) flags.push(`<span class="v2d-enemy-flag big-headbar">${t('flags.pinnedHealthBar')}</span>`);

            const showHidden = getCurrentShowHidden();
            const modifierGroups = [
                ['出生加成', [...inlineModifiers, ...ownBuffModifiers]],
                ['buff加成', libraryBuffModifiers],
                ['副本加成', scriptModifiers]
            ];
            const modifierSummaryHtml = modifierGroups.map(([label, modifiers]) => {
                const summary = formatAttrModifiers(modifiers);
                return summary ? `<div class="v2d-enemy-modifier"><b>${label}</b> ${summary}</div>` : '';
            }).join('');
            const modifierStr = formatAttrModifiers(inlineModifiers);
            const modifierHtml = showHidden && modifierStr ? `<div class="v2d-enemy-modifier">${modifierStr}</div>` : '';

            const allBuffIds = [...new Set([...ownBuffs, ...libBuffs.map(b => b.buffId)])];
            const buffBbMap = {};
            libBuffs.forEach(b => {
                if (!buffBbMap[b.buffId]) buffBbMap[b.buffId] = [];
                (b.blackboard || []).forEach(bb => {
                    if (!buffBbMap[b.buffId].find(x => x.key === bb.key)) buffBbMap[b.buffId].push(bb);
                });
            });
            const buffTagsHtml = showHidden && allBuffIds.length > 0 ?
                `<div class="v2d-enemy-buffs">${allBuffIds.map(id => {
                    const bb = buffBbMap[id] || [];
                    const buff = buffCache[id];
                    const attrMods = buff?.attributeModifier?.attributeModifiers || [];
                    const rows = [];
                    attrMods.forEach(mod => {
                        const attrType = attrNameToId[mod.attributeType];
                        if (LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(attrType)) return;
                        const label = attrType === undefined ? mod.attributeType : getAttrName(attrType);
                        const formula = mod.formulaItem;
                        let val;
                        if (mod.param.useBlackboardKey && mod.param.blackboardKey) {
                            const bbEntry = bb.find(b => b.key === mod.param.blackboardKey);
                            val = bbEntry ? (bbEntry.valueFloat ?? bbEntry.valueDouble ?? 0) : mod.param.value;
                        } else { val = mod.param.value; }
                        const pctTypes = ['Multiplier', 'FinalMultiplier', 'BaseMultiplier', 'BaseFinalMultiplier'];
                        const directMultiplierTypes = ['FinalMultiplier', 'BaseFinalMultiplier'];
                        const displayVal = directMultiplierTypes.includes(formula) ? val - 1 : val;
                        const display = pctTypes.includes(formula) ? `${(displayVal * 100).toFixed(0)}%` : val;
                        const converted = directMultiplierTypes.includes(formula);
                        const valueHtml = window.renderRawValueTip ? window.renderRawValueTip(display, converted ? {
                            name: mod.param.blackboardKey || label,
                            rawValue: val,
                            value: displayVal,
                            changed: true,
                            formula: `${val} - 1 = ${displayVal}`
                        } : val, converted ? undefined : (mod.param.blackboardKey || label)) : display;
                        rows.push(`${escH(label)} ${escH(formula)} ${valueHtml}`);
                    });
                    bb.forEach(b => {
                        if (!attrMods.find(m => m.param.useBlackboardKey && m.param.blackboardKey === b.key)) {
                            const rawVal = b.valueFloat ?? b.valueDouble ?? 0;
                            const valueHtml = window.renderRawValueTip ? window.renderRawValueTip(rawVal, rawVal, b.key) : rawVal;
                            rows.push(`${escH(b.key)}: ${valueHtml}`);
                        }
                    });
                    if (rows.length === 0) return window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id, label: id, className: 'v2d-buff-tag', contentHtml: escH(id) });
                    const tipHtml = rows.map(r => `<div>${r}</div>`).join('');
                    return window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id, label: id, className: 'v2d-buff-tag v2d-has-tip ake-ui-popover-anchor', contentHtml: `${escH(id)}<span class="v2d-buff-tip ake-ui-popover" data-placement="top">${tipHtml}</span>` });
                }).join('')}</div>` : '';

            const scriptBuffTagsHtml = showHidden && (scriptedBuffs || []).length ? `<div class="v2d-enemy-buffs">${scriptedBuffs.map(row => window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id: row.buffId, label: row.buffId, className: 'v2d-buff-tag v2d-script-buff v2d-has-tip ake-ui-popover-anchor', contentHtml: `${escH(row.buffId)}<small>脚本</small><span class="v2d-buff-tip ake-ui-popover" data-placement="top"><div>条件性脚本 Buff · LevelScript ${escH(row.scriptId)}</div></span>` })).join('')}</div>` : '';
            const statState = window.AKEEnemyRenderer.calculateStats({
                attrData,
                level: enemyLevel,
                baseModifiers: allModifiers,
                scriptModifiers,
                getDetails: getEnemyStatDetailsAtLevel
            });
            return window.AKEEnemyRenderer.renderCard({
                dataAttributes: { akeEntryPlugin: 'v3_enemy', akeEntryId: templateId, akeEntryLabel: name },
                iconSrc,
                name,
                nickname,
                level: enemyLevel,
                descriptionHtml: desc ? parseText(desc) : '',
                extraHtml: `${showHidden ? '' : modifierSummaryHtml}${modifierHtml}${buffTagsHtml}${scriptBuffTagsHtml}`,
                flags,
                statState,
                formatStatValue,
                formatBaseValue: formatValue
            });
        }

        function renderDungeonCard(dungeonId, dungeon) {
            const name = dungeon.dungeonName?.text || dungeonId;
            const level = dungeon.dungeonLevelDesc?.text || '';
            const desc = dungeon.dungeonDesc?.text ? parseText(dungeon.dungeonDesc.text) : '';
            const featureDesc = dungeon.featureDesc?.text ? parseText(dungeon.featureDesc.text) : '';
            const costStamina = dungeon.costStamina !== undefined ? dungeon.costStamina : 0;
            const recommendLv = dungeon.recommendLv || '?';
            const dungeonCategory = dungeon.dungeonCategory || '';
            const categoryLabel = getCategoryLabel(dungeonCategory);
            const picPath = dungeon.dungeonPicPath || '';
            const dungeonImg = dungeon.dungeonImg || '';

            const mainGoal = dungeon.mainGoalDesc?.text || '';
            const extraGoal = dungeon.extraGoalDesc?.text || '';
            let goalsHtml = '';
            if (mainGoal) goalsHtml += `<div><strong>${t('goals.main')}</strong>${parseText(mainGoal)}</div>`;
            if (extraGoal) goalsHtml += `<div><strong>${t('goals.extra')}</strong>${parseText(extraGoal)}</div>`;
            if (goalsHtml) goalsHtml = `<div class="v2d-card-goal">${goalsHtml}</div>`;

            const rewardTable = dungeon.rewardTable || {};
            const itemTable = dungeon.itemTable || {};
            const fixedRewards = renderRewards(dungeon.rewardId, rewardTable, itemTable);
            const firstRewards = renderRewards(dungeon.firstPassRewardId, rewardTable, itemTable);
            const hunterFixedRewards = renderRewards(dungeon.hunterModeRewardId, rewardTable, itemTable);
            const hunterRandomRewards = renderRewards(dungeon.hunterModeRewardId, rewardTable, itemTable, 'probItemBundles');
            const hunterModeCostStamina = dungeon.hunterModeCostStamina || 0;

            let rewardsHtml = '';
            if (fixedRewards || firstRewards) {
                rewardsHtml = `<div class="v2d-rewards">
                    ${fixedRewards ? `<div class="v2d-rewards-block"><span class="v2d-rewards-title">${t('rewards.fixed')}</span><div class="v2d-rewards-content">${fixedRewards}</div></div>` : ''}
                    ${firstRewards ? `<div class="v2d-rewards-block"><span class="v2d-rewards-title">${t('rewards.firstClear')}</span><div class="v2d-rewards-content">${firstRewards}</div></div>` : ''}
                </div>`;
            }
            if (hunterFixedRewards || hunterRandomRewards) {
                rewardsHtml += `<div class="v2d-rewards v2d-hunter-rewards">
                    <div class="v2d-rewards-heading">
                        <span class="v2d-rewards-mode">${t('rewards.hunterMode')}</span>
                        ${hunterModeCostStamina > 0 ? `<span class="v2d-rewards-cost">${t('meta.staminaCost')} ${hunterModeCostStamina}</span>` : ''}
                    </div>
                    ${hunterFixedRewards ? `<div class="v2d-rewards-block"><span class="v2d-rewards-title">${t('rewards.fixed')}</span><div class="v2d-rewards-content">${hunterFixedRewards}</div></div>` : ''}
                    ${hunterRandomRewards ? `<div class="v2d-rewards-block"><span class="v2d-rewards-title">${t('rewards.random')}</span><div class="v2d-rewards-content">${hunterRandomRewards}</div></div>` : ''}
                </div>`;
            }

            const waveSpawners = parseDungeonWaves(dungeon);

            let waveSummaryHtml = '';
            let enemiesHtml = '';

            if (waveSpawners) {
                const allWaves = [];
                waveSpawners.forEach(sp => {
                    sp.waves.forEach(w => {
                        const existing = allWaves.find(aw => aw.waveIdx === w.waveIdx);
                        if (existing) {
                            existing.groups.push(...w.groups);
                            existing.enemies.push(...w.enemies);
                            existing.maxAlive += w.maxAlive;
                            if (w.hasPause) existing.hasPause = true;
                            if (w.repeatable) existing.repeatable = true;
                        } else {
                            allWaves.push({ ...w, groups: [...w.groups], enemies: [...w.enemies] });
                        }
                    });
                });
                allWaves.sort((a, b) => (a.waveIdx || 0) - (b.waveIdx || 0));

                let totalWaves = allWaves.length, totalEnemies = 0;
                allWaves.forEach(w => w.enemies.forEach(e => totalEnemies += e.count));

                let waveDetailHtml = '';
                allWaves.forEach((wave, wIdx) => {
                    const repeatTag = wave.repeatable ? ` <span class="v2d-wave-repeat">${t('waves.repeatable')}</span>` : '';
                    const aliveTag = wave.maxAlive > 0 ? ` <span class="v2d-wave-alive">${t('waves.aliveLimit', { count: wave.maxAlive })}</span>` : '';
                    const pauseTag = wave.hasPause ? ` <span class="v2d-wave-pause">${t('waves.externallyControlled')}</span>` : '';
                    const enemyParts = wave.enemies.map(e => {
                        const iconSrc = `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${e.templateId}.png`;
                        return `<span class="v2d-wave-enemy" data-wave-idx="${wIdx}" data-enemy-id="${e.instanceId}"><img class="v2d-wave-icon" src="${iconSrc}"><span class="v2d-wave-ename">${e.name}</span> ×${e.count} <span class="v2d-wave-lv">Lv.${e.level}</span></span>`;
                    }).join(' ');
                    const activeCls = wIdx === 0 ? ' active' : '';
                    waveDetailHtml += `<div class="v2d-wave-line${activeCls}" data-wave-idx="${wIdx}"><span class="v2d-wave-num" data-wave-idx="${wIdx}">${t('waves.number', { number: wave.waveIdx })}</span>${repeatTag}${aliveTag}${pauseTag}: ${enemyParts}</div>`;
                });

                const mergedSpawner = { configId: 'merged', waves: allWaves };
                const spawnMapHtml = renderSpawnMap(mergedSpawner);

                waveSummaryHtml = `<div class="v2d-wave-map-row"><div class="v2d-wave-section"><div class="v2d-wave-summary"><span class="v2d-wave-label">${t('waves.summaryLabel')}</span> ${t('waves.summary', { waves: totalWaves, enemies: totalEnemies })}</div><div class="v2d-wave-detail">${waveDetailHtml}</div></div>${spawnMapHtml}</div>`;

                const enemyLibBuffs = {};
                const enemyScriptBuffs = {};
                waveSpawners.forEach(sp => {
                    const scriptedBuffs = dungeon.ScriptBuffsBySpawner?.[sp.configId] || [];
                    sp.waves.forEach(wave => {
                        wave.enemies.forEach(e => {
                            if (!enemyLibBuffs[e.instanceId]) enemyLibBuffs[e.instanceId] = [];
                            e.bornBuffList.forEach(b => {
                                if (!enemyLibBuffs[e.instanceId].find(x => x.buffId === b.buffId))
                                    enemyLibBuffs[e.instanceId].push(b);
                            });
                            if (!enemyScriptBuffs[e.instanceId]) enemyScriptBuffs[e.instanceId] = [];
                            scriptedBuffs.forEach(b => {
                                if (!enemyScriptBuffs[e.instanceId].find(x => x.buffId === b.buffId && x.scriptId === b.scriptId)) enemyScriptBuffs[e.instanceId].push(b);
                            });
                        });
                    });
                });

                const seenEnemies = new Set();
                const uniqueEnemies = [];
                waveSpawners.forEach(sp => {
                    sp.waves.forEach(wave => {
                        wave.enemies.forEach(e => {
                            if (!seenEnemies.has(e.instanceId)) {
                                seenEnemies.add(e.instanceId);
                                uniqueEnemies.push(e);
                            }
                        });
                    });
                });

                if (uniqueEnemies.length > 0) {
                    enemiesHtml = `<h4 class="v2d-enemies-title">${t('enemyDetails')}</h4><div class="v2d-enemy-list">`;
                    uniqueEnemies.forEach(e => {
                        enemiesHtml += renderEnemyCard(e.instanceId, e.level, dungeon, enemyLibBuffs[e.instanceId] || [], enemyScriptBuffs[e.instanceId] || []);
                    });
                    enemiesHtml += '</div>';
                }
            } else {
                const enemyIds = dungeon.enemyIds || [];
                const enemyLevels = dungeon.enemyLevels || [];
                if (enemyIds.length > 0) {
                    enemiesHtml = `<h4 class="v2d-enemies-title">${t('enemyDetails')}</h4><div class="v2d-enemy-list">`;
                    enemyIds.forEach((eid, idx) => {
                        const eLevel = enemyLevels[idx] || recommendLv;
                        enemiesHtml += renderEnemyCard(eid, eLevel, dungeon, [], []);
                    });
                    enemiesHtml += '</div>';
                }
            }

            const cardBgSrc = picPath ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/dungeon/${picPath}.png` : '';
            const cardBgHtml = cardBgSrc ? `<img class="v2d-card-bg" src="${cardBgSrc}">` : '';

            const dungeonIconSrc = dungeonImg ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${dungeonImg}.png` : '';
            const dungeonIconHtml = dungeonIconSrc ? `<img class="v2d-card-icon" src="${dungeonIconSrc}">` : '';

            return `
                <div class="ake-ui-card" data-card-kind="dungeon" data-density="regular">
                    ${cardBgHtml}
                    <div class="ake-ui-card__header">
                        ${dungeonIconHtml}
                        <h4 class="ake-ui-card__title">${name}</h4>
                        ${level ? `<span class="v2d-card-level">${level}</span>` : ''}
                        <span class="ake-ui-card__id">${dungeonId}</span>
                    </div>
                    ${desc ? `<div class="ake-ui-card__body">${desc}</div>` : ''}
                    ${featureDesc ? `<div class="v2d-card-feature">${featureDesc}</div>` : ''}
                    ${goalsHtml}
                    <div class="ake-ui-card__meta">
                        ${costStamina > 0 ? `<div><span class="ake-ui-meta-label">${t('meta.staminaCost')}</span> ${costStamina}</div>` : ''}
                        ${recommendLv ? `<div><span class="ake-ui-meta-label">${t('meta.recommendedLevel')}</span> ${recommendLv}</div>` : ''}
                        ${categoryLabel ? `<div><span class="ake-ui-meta-label">${t('meta.category')}</span> ${categoryLabel}</div>` : ''}
                    </div>
                    ${waveSummaryHtml}
                    ${rewardsHtml}
                    ${enemiesHtml}
                </div>
            `;
        }

        function renderDetail(data, seriesItem) {
            const seriesName = data.dungeonseriestable?.name?.text || seriesItem.name;
            const seriesDesc = data.dungeonseriestable?.desc?.text || '';
            const staminaText = data.dungeonseriestable?.staminaText?.text || '';
            const gameCategory = data.dungeonseriestable?.gameCategory || '';
            const categoryLabel = getCategoryLabel(gameCategory);
            const picPath = data.dungeonseriestable?.dungeonPicPath || '';
            const roleImg = data.dungeonseriestable?.dungeonRoleImg || '';

            const dungeons = data.dungeontable || {};
            const dungeonIds = Object.keys(dungeons);
            if (dungeonIds.length === 0) {
                return `<div class="ake-ui-state" data-state="error">${t('noData')}</div>`;
            }

            const includeIds = data.dungeonseriestable?.includeDungeonIds || dungeonIds;
            const orderedIds = includeIds.filter(id => dungeons[id]);

            let metaHtml = '';
            if (categoryLabel) metaHtml += `<span class="ake-ui-badge">${categoryLabel}</span>`;
            if (staminaText) metaHtml += `<span class="ake-ui-badge">${t('stamina', { value: staminaText })}</span>`;
            if (metaHtml) metaHtml = `<div class="ake-ui-detail-badges">${metaHtml}</div>`;

            const bgSrc = picPath ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/dungeon/${picPath}_bg.png` : '';
            const bgImg = bgSrc ? `<img class="v2d-series-bg" src="${bgSrc}">` : '';

            const roleSrc = roleImg ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${roleImg}.png` : '';
            const roleImgHtml = roleSrc ? `<img class="v2d-series-role" src="${roleSrc}">` : '';

            let dungeonsHtml = '';
            orderedIds.forEach(id => {
                dungeonsHtml += renderDungeonCard(id, dungeons[id]);
            });

            return `<article class="ake-ui-detail" data-detail-kind="dungeon">
                <div class="v2d-series-banner">
                    ${bgImg}
                    <div class="v2d-series-header">
                        <h2 class="ake-ui-detail-title">${seriesName}</h2>
                        <span class="ake-ui-detail-id">${data.dungeonSeriesId || seriesItem.templateId}</span>
                    </div>
                    ${roleImgHtml}
                </div>
                ${metaHtml}
                ${seriesDesc ? `<div class="v2d-series-desc">${parseText(seriesDesc)}</div>` : ''}
                <div class="v2d-dungeons">
                    ${dungeonsHtml}
                </div>
                </article>
            `;
        }

        async function refreshModule() {
            const list = document.getElementById('v2dungeonList');
            const detail = document.getElementById('v2dungeonDetail');
            if (!list || !detail) return;

            const showHidden = getCurrentShowHidden();
            const series = await loadSeriesManifest(showHidden);
            allSeries = series;
            renderSeriesList();
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;
            await loadMaps();

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
                if (e.target === mobileOverlay) closeMobileList();
            });

            window.addEventListener('globalConfigChanged', () => {
                searchTerm = '';
                const si = document.getElementById('v2dungeonSearchInput');
                if (si) si.value = '';
                refreshModule();
            });

            document.getElementById('v2dungeonSearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderSeriesList();
            });

            function adjustTipPosition(spot, map) {
                const tip = spot.querySelector('.v2d-map-tip');
                if (!tip) return;
                const mapRect = map.getBoundingClientRect();
                const spotRect = spot.getBoundingClientRect();
                const spotTop = spotRect.top - mapRect.top;
                tip.dataset.placement = spotTop < 60 ? 'bottom' : 'top';
            }

            function switchWave(wi, body) {
                const map = body.querySelector('.v2d-spawn-map');
                if (!map) return;
                body.querySelectorAll('.v2d-wave-line').forEach(l => l.classList.toggle('active', l.dataset.waveIdx === wi));
                map.querySelectorAll('.v2d-map-spot').forEach(s => { s.style.display = s.dataset.wave === wi ? '' : 'none'; });
            }

            function clearHL(body) {
                if (!body) return;
                body.querySelectorAll('.v2d-map-spot').forEach(s => { s.classList.remove('group-highlight', 'target-highlight'); });
                body.querySelectorAll('.v2d-wave-enemy').forEach(e => { e.classList.remove('enemy-highlight', 'enemy-target-highlight'); });
            }

            document.addEventListener('click', (e) => {
                const wl = e.target.closest('.v2d-wave-line');
                if (wl) { const b = wl.closest('[data-card-kind="dungeon"]'); if (b && wl.dataset.waveIdx !== undefined) switchWave(wl.dataset.waveIdx, b); return; }
                const we = e.target.closest('.v2d-wave-enemy');
                if (we) { const b = we.closest('[data-card-kind="dungeon"]'); if (b && we.dataset.waveIdx !== undefined) switchWave(we.dataset.waveIdx, b); return; }
            });

            document.addEventListener('mouseover', (e) => {
                const spot = e.target.closest('.v2d-map-spot');
                if (spot) {
                    const map = spot.closest('.v2d-spawn-map');
                    const card = spot.closest('[data-card-kind="dungeon"]');
                    if (!map) return;
                    adjustTipPosition(spot, map);
                    const gk = spot.dataset.group, tg = spot.dataset.targetGroup, wi = spot.dataset.wave;
                    map.querySelectorAll('.v2d-map-spot').forEach(s => {
                        s.classList.remove('group-highlight', 'target-highlight');
                        if (s.dataset.group === gk && s !== spot) s.classList.add('group-highlight');
                        if (tg && s.dataset.group === tg) s.classList.add('target-highlight');
                    });
                    if (card) {
                        const iconSrc = spot.querySelector('.v2d-map-spot-icon')?.src || '';
                        card.querySelectorAll(`.v2d-wave-enemy[data-wave-idx="${wi}"]`).forEach(we => {
                            const weSrc = we.querySelector('.v2d-wave-icon')?.src || '';
                            if (iconSrc && weSrc && iconSrc === weSrc) we.classList.add('enemy-highlight');
                        });
                    }
                    return;
                }
                const we = e.target.closest('.v2d-wave-enemy');
                if (we) {
                    const card = we.closest('[data-card-kind="dungeon"]');
                    if (!card) return;
                    const map = card.querySelector('.v2d-spawn-map');
                    if (!map) return;
                    const wi = we.dataset.waveIdx, iconSrc = we.querySelector('.v2d-wave-icon')?.src || '';
                    map.querySelectorAll(`.v2d-map-spot[data-wave="${wi}"]`).forEach(s => {
                        const sSrc = s.querySelector('.v2d-map-spot-icon')?.src || '';
                        if (iconSrc && sSrc && iconSrc === sSrc) {
                            s.classList.add('group-highlight');
                            const gk = s.dataset.group, tg = s.dataset.targetGroup;
                            map.querySelectorAll('.v2d-map-spot').forEach(ss => {
                                if (ss.dataset.group === gk && ss !== s) ss.classList.add('group-highlight');
                                if (tg && ss.dataset.group === tg) ss.classList.add('target-highlight');
                            });
                        }
                    });
                    we.classList.add('enemy-highlight');
                }
            });

            document.addEventListener('mouseout', (e) => {
                const spot = e.target.closest('.v2d-map-spot');
                const we = e.target.closest('.v2d-wave-enemy');
                if (!spot && !we) return;
                const card = (spot || we)?.closest('[data-card-kind="dungeon"]');
                if (card) clearHL(card);
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
