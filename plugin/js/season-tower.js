(function () {
    const t = window.akeI18n.scope('modules.seasonTower');
    const MODULE_ID = 'season_tower';
    const DIFFICULTIES = { 1: t('normal'), 2: t('hard'), 3: t('brutal') };
    const ATTR_ORDER = [0, 1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15];
    const LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES = window.AKEEnemyRenderer.LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES;

    const root = document.getElementById('seasonTowerModule');
    const list = document.getElementById('seasonTowerList');
    const mobileList = document.getElementById('seasonTowerMobileList');
    const detail = document.getElementById('seasonTowerDetail');
    const overlay = document.getElementById('seasonTowerMobileOverlay');
    list.setAttribute('aria-label', t('list'));
    overlay.querySelector('.ake-ui-directory__mobile-header button').setAttribute('aria-label', t('close'));
    window.__akeSeasonTowerController?.destroy?.();
    const buffCache = {};
    let destroyed = false;
    let seasons = [];
    let activeSeasonId = '';
    let activeData = null;
    let attrMap = {};
    let attrNameToId = {};

    function text(ref, fallback) {
        return window.AKEV3.text(ref, fallback || '');
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
    }

    function parseGameText(value) {
        return window.parseText ? window.parseText(value || '') : escapeHtml(value || '').replace(/\n/g, '<br>');
    }

    function fillParams(value, params) {
        const map = Object.fromEntries((params || []).map(param => [param.key, param.valueStr || param.value]));
        return String(value || '').replace(/\{([+-]?)([^}:]+)(?::([^}]+))?\}/g, (match, operator, key, format) => {
            if (!(key in map)) return match;
            const raw = operator === '-' ? -Number(map[key]) : map[key];
            return format?.includes('%') ? `${Math.round(Number(raw) * 100)}%` : String(raw);
        });
    }

    function comparableText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function parseDate(value) {
        if (!value) return null;
        const parts = String(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        if (!parts) return null;
        const normalized = `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}T${parts[4].padStart(2, '0')}:${parts[5].padStart(2, '0')}:${parts[6].padStart(2, '0')}+08:00`;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return t('timeMissing');
        return new Intl.DateTimeFormat(window.akeI18n?.getLanguageInfo?.().htmlLang || 'zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date);
    }

    function seasonStatus(season) {
        const now = Date.now();
        const open = parseDate(season.openTime)?.getTime();
        const close = parseDate(season.closeTime)?.getTime();
        if (!Number.isFinite(open) || !Number.isFinite(close)) return { key: 'unknown', label: t('timeMissing') };
        if (open && now < open) return { key: 'upcoming', label: t('upcoming') };
        if (close && now >= close) return { key: 'closed', label: t('closed') };
        return { key: 'active', label: t('active') };
    }

    async function fetchJson(url) {
        const response = await (window.akeFetch || fetch)(url);
        if (!response.ok) throw new Error(`无法加载 ${url} (HTTP ${response.status})`);
        return response.json();
    }

    async function loadSpawners(sceneId) {
        const manifest = await window.akeAssetIndex.listJsonFiles(`SpawnerConfig/${sceneId}`);
        const configs = await Promise.all(manifest.filter(entry => !entry.hidden).map(entry => fetchJson(entry.contentFile)));
        return Object.fromEntries(configs.map(config => [config.configId, config]));
    }

    function spawnersForDungeon(dungeon, allSpawners) {
        const expectedIds = new Set(dungeon.enemyIds || []);
        const level = Number(dungeon.recommendLv || 0);
        return Object.fromEntries(Object.entries(allSpawners).filter(([, config]) => {
            const library = config.enemyLibrary || [];
            return library.length > 0 && library.every(enemy => Number(enemy.enemyLevel) === level && expectedIds.has(enemy.enemyId));
        }));
    }

    async function loadBuffs(data) {
        const ids = new Set();
        Object.values(data.enemies).forEach(enemy => (enemy.bornBuffs || []).forEach(id => ids.add(id)));
        Object.values(data.spawners).forEach(config => (config.enemyLibrary || []).forEach(enemy =>
            (enemy.bornBuffList || []).forEach(buff => ids.add(buff.buffId))));
        Object.values(data.scriptBuffs).forEach(scene => Object.values(scene).forEach(buffs => buffs.forEach(buff => ids.add(buff.buffId))));
        await Promise.all(Array.from(ids).map(async id => {
            try { buffCache[id] = await fetchJson(`/public/Json/BuffData/${id}.json`); }
            catch { buffCache[id] = null; }
        }));
    }

    function buffModifiers(buffId, overrides) {
        const buff = buffCache[buffId];
        if (!buff?.attributeModifier?.attributeModifiers) return [];
        const blackboard = {};
        (buff.blackboard || []).forEach(row => { blackboard[row.key] = row.valueDouble ?? row.value ?? 0; });
        (overrides || []).forEach(row => { blackboard[row.key] = row.valueFloat ?? row.valueDouble ?? row.value ?? 0; });
        return buff.attributeModifier.attributeModifiers.map(modifier => {
            const attrType = attrNameToId[modifier.attributeType];
            const modifierType = window.AKEStats.FORMULA_TO_MODTYPE[modifier.formulaItem];
            if (attrType === undefined || modifierType === undefined) return null;
            const value = modifier.param.useBlackboardKey && modifier.param.blackboardKey
                ? blackboard[modifier.param.blackboardKey] ?? modifier.param.value
                : modifier.param.value;
            return { attrType, attrValue: value, modifierType };
        }).filter(Boolean);
    }

    function formatPlainAttr(value) {
        if (typeof value !== 'number') return escapeHtml(value);
        return Math.abs(value) < 1 && value !== 0 ? `${(value * 100).toFixed(1)}%` : (Number.isInteger(value) ? String(value) : value.toFixed(2));
    }

    function formatAttr(value) {
        const display = formatPlainAttr(value);
        return window.renderRawValueTip ? window.renderRawValueTip(display, value) : display;
    }

    function formatStat(value, detail) {
        const display = formatPlainAttr(value);
        return detail && window.renderRawValueTip ? window.renderRawValueTip(display, detail) : display;
    }

    function getEnemyStatDetails(attrTemplate, level, modifiers) {
        return window.AKEStats.getEnemyStatDetailsAtLevel(attrTemplate, level, modifiers, {
            displayOrder: ATTR_ORDER,
            getAttrName: type => attrMap[type] || t('attribute', { id: type }),
            includeModifierOnlyAttrs: false,
            excludeAttrTypes: LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES
        });
    }

    function formatModifierSummary(modifiers) {
        return window.AKEStats.combineModifiers(modifiers)
            .filter(modifier => !LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(modifier.attrType))
            .map(modifier => {
                const name = attrMap[modifier.attrType] || t('attribute', { id: modifier.attrType });
                const directMultiplier = modifier.modifierType === 4 || modifier.modifierType === 8;
                const multiplier = directMultiplier || modifier.modifierType === 1 || modifier.modifierType === 6;
                const value = directMultiplier ? modifier.attrValue - 1 : modifier.attrValue;
                const display = multiplier
                    ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
                    : `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : Number(value.toFixed(4))}`;
                return `${escapeHtml(name)} ${display}`;
            }).join(', ');
    }

    function renderBuffs(inlineModifiers, ownBuffs, libraryBuffs, scriptedBuffs) {
        if (window.akeData?.getConfig?.().showHidden !== true) {
            const ownModifiers = (ownBuffs || []).flatMap(buffId => buffModifiers(buffId, []));
            const libraryModifiers = (libraryBuffs || []).flatMap(buff => buffModifiers(buff.buffId, buff.blackboard));
            const scriptModifiers = (scriptedBuffs || []).flatMap(buff => buffModifiers(buff.buffId, buff.blackboard));
            const groups = [
                [t('bornBonus'), [...(inlineModifiers || []), ...ownModifiers]],
                [t('buffBonus'), libraryModifiers],
                [t('dungeonBonus'), scriptModifiers]
            ];
            return groups.map(([label, modifiers]) => {
                const summary = formatModifierSummary(modifiers);
                return summary ? `<div class="v2d-enemy-modifier"><b>${label}</b> ${summary}</div>` : '';
            }).join('');
        }
        const rows = [...(ownBuffs || []).map(buffId => ({ buffId })), ...(libraryBuffs || []), ...(scriptedBuffs || [])];
        const unique = [...new Map(rows.map(row => [`${row.buffId}:${row.conditional ? 'script' : 'base'}`, row])).values()];
        if (!unique.length) return '';
        return `<div class="v2d-enemy-buffs">${unique.map(row => {
            const values = (row.blackboard || []).map(value => `${escapeHtml(value.key)}: ${escapeHtml(value.valueFloat ?? value.valueDouble ?? value.value ?? 0)}`);
            const source = row.conditional ? escapeHtml(t('scriptBuff', { id: row.scriptId })) : '';
            const tips = [source, ...values];
            const label = `${escapeHtml(row.buffId)}${row.conditional ? `<small>${escapeHtml(t('script'))}</small>` : ''}`;
            return tips.length
                ? `<span class="v2d-buff-tag${row.conditional ? ' v2d-script-buff' : ''} v2d-has-tip ake-ui-popover-anchor">${label}<span class="v2d-buff-tip ake-ui-popover" data-placement="top">${tips.map(value => `<div>${value}</div>`).join('')}</span></span>`
                : `<span class="v2d-buff-tag">${label}</span>`;
        }).join('')}</div>`;
    }

    function renderEnemy(enemyId, level, libraryBuffs, scriptedBuffs, data) {
        const enemy = data.enemies[enemyId] || {};
        const display = data.enemyDisplay[enemy.templateId] || {};
        const attrTemplate = data.enemyAttrs[enemy.attrTemplateId] || {};
        const ownBuffs = enemy.bornBuffs || [];
        const modifiers = [...(enemy.attrModifiers || [])];
        ownBuffs.forEach(id => modifiers.push(...buffModifiers(id, [])));
        (libraryBuffs || []).forEach(buff => modifiers.push(...buffModifiers(buff.buffId, buff.blackboard)));
        const scriptedModifiers = (scriptedBuffs || []).flatMap(buff => buffModifiers(buff.buffId, buff.blackboard));
        const flags = [];
        if (enemy.isDangerous) flags.push(`<span class="v2d-enemy-flag danger">${escapeHtml(t('danger'))}</span>`);
        if (enemy.showBigEffect) flags.push(`<span class="v2d-enemy-flag big-effect">${escapeHtml(t('effect'))}</span>`);
        if (enemy.showBigHeadbar) flags.push(`<span class="v2d-enemy-flag big-headbar">${escapeHtml(t('headbar'))}</span>`);
        const statState = window.AKEEnemyRenderer.calculateStats({
            attrData: attrTemplate,
            level,
            baseModifiers: modifiers,
            scriptModifiers: scriptedModifiers,
            getDetails: getEnemyStatDetails
        });
        return window.AKEEnemyRenderer.renderCard({
            iconSrc: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${enemy.templateId || enemyId}.png`,
            name: text(display.name, enemy.templateId || enemyId),
            nickname: text(display.nickname),
            level,
            descriptionHtml: text(display.description) ? parseGameText(text(display.description)) : '',
            extraHtml: renderBuffs(enemy.attrModifiers || [], ownBuffs, libraryBuffs, scriptedBuffs),
            flags,
            statState,
            formatStatValue: formatStat,
            formatBaseValue: formatAttr
        });
    }

    function parseWaves(config, data) {
        const library = Object.fromEntries((config.enemyLibrary || []).map(enemy => [enemy.key, enemy]));
        return Object.entries(config.waveMap || {}).map(([waveId, wave]) => {
            const enemies = [];
            const groups = [];
            let maxAlive = 0;
            let externallyControlled = false;
            Object.entries(wave.groupMap || {}).forEach(([groupKey, group]) => {
                const groupInfo = {
                    key: group.groupKey || groupKey,
                    mode: group.groupMode || 'Sequence',
                    targetKey: group.groupModeTargetKey || '',
                    killCount: group.groupModeKillCount || 0,
                    spawns: []
                };
                if (group.limitGroupMaxCount && group.groupMaxCount > 0) {
                    maxAlive += group.groupMaxCount;
                }
                Object.values(group.actionMap || {}).forEach(action => {
                    if (action.$type?.includes('Pause')) { externallyControlled = true; return; }
                    const entry = library[action.libraryKey];
                    if (!entry) return;
                    const enemy = data.enemies[entry.enemyId] || {};
                    const spawn = {
                        id: entry.enemyId,
                        templateId: enemy.templateId || entry.enemyId,
                        level: entry.enemyLevel,
                        count: action.spawnCount || 1,
                        buffs: entry.bornBuffList || [],
                        position: action.position || { x: 0, y: 0, z: 0 },
                        timestamp: action.timestamp || 0,
                        spawnInterval: action.spawnInterval || 0,
                        randomizeRadius: action.randomizeRadius || 0,
                        faceMainCharacter: action.faceMainCharacter ?? true,
                        preWarnTime: entry.preWarnTime || 0
                    };
                    groupInfo.spawns.push(spawn);
                    enemies.push(spawn);
                });
                if (groupInfo.spawns.length) groups.push(groupInfo);
            });
            return { waveId, enemies, groups, maxAlive, repeatable: wave.repeatable, externallyControlled };
        }).filter(wave => wave.enemies.length);
    }

    function renderSpawnMap(waves, data) {
        const positions = waves.flatMap(wave => wave.groups.flatMap(group => group.spawns.map(spawn => spawn.position)));
        if (!positions.length) return '';
        const pad = 2;
        const halfX = Math.max(...positions.map(position => Math.abs(Number(position.x) || 0)), 1) + pad;
        const halfZ = Math.max(...positions.map(position => Math.abs(Number(position.z) || 0)), 1) + pad;
        const toPct = (x, z) => ({ left: ((Number(x) + halfX) / (halfX * 2) * 100).toFixed(1), top: ((halfZ - Number(z)) / (halfZ * 2) * 100).toFixed(1) });
        const modeLabels = { Parallel: t('parallel'), Sequence: t('sequence'), PartKilled: t('partKilled'), AllKilled: t('allKilled'), Deadline: t('deadline') };
        let spots = '';
        waves.forEach((wave, waveIndex) => {
            const positionCount = {};
            wave.groups.forEach(group => group.spawns.forEach(spawn => {
                const positionKey = `${Number(spawn.position.x).toFixed(1)},${Number(spawn.position.z).toFixed(1)}`;
                const stackIndex = positionCount[positionKey] || 0;
                positionCount[positionKey] = stackIndex + 1;
                const point = toPct(spawn.position.x, spawn.position.z);
                const enemyName = text(data.enemyDisplay[data.enemies[spawn.id]?.templateId]?.name, spawn.id);
                const condition = group.targetKey ? (group.mode === 'PartKilled' ? t('killGroup', { id: group.targetKey, count: group.killCount }) : t('clearGroup', { id: group.targetKey })) : '';
                const details = [
                    [t('position', { x: Number(spawn.position.x).toFixed(1), z: Number(spawn.position.z).toFixed(1) }), spawn.randomizeRadius > 0 ? t('radius', { value: Number(spawn.randomizeRadius).toFixed(1) }) : ''].filter(Boolean).join(' · '),
                    `${t('group', { id: group.key })} · ${modeLabels[group.mode] || group.mode}${condition ? ` · ${condition}` : ''}`,
                    [spawn.timestamp > 0 ? t('delay', { value: Number(spawn.timestamp).toFixed(1) }) : '', spawn.spawnInterval > 0 ? t('interval', { value: Number(spawn.spawnInterval).toFixed(1) }) : '', spawn.preWarnTime > 0 ? t('warning', { value: Number(spawn.preWarnTime).toFixed(1) }) : '', spawn.faceMainCharacter ? t('facing') : ''].filter(Boolean).join(' · ')
                ].filter(Boolean);
                const offset = (0.3 * 100 / (halfX * 2)).toFixed(2);
                const stackStyle = stackIndex ? `margin-left:${stackIndex * offset}%;margin-top:-${stackIndex * offset}%;z-index:${10 - stackIndex};` : 'z-index:10;';
                spots += `<div class="v2d-map-spot" data-ake-popover-anchor data-wave="${waveIndex}" data-group="${escapeHtml(group.key)}" data-target-group="${escapeHtml(group.targetKey)}" data-enemy-id="${escapeHtml(spawn.id)}" style="left:${point.left}%;top:${point.top}%;${waveIndex ? 'display:none;' : ''}${stackStyle}">
                    <img class="v2d-map-spot-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${escapeHtml(spawn.templateId)}.png" alt="">
                    <div class="v2d-map-tip ake-ui-popover" data-placement="top"><div><b>${escapeHtml(enemyName)} ×${spawn.count} Lv.${spawn.level}</b></div>${details.map(detail => `<div>${escapeHtml(detail)}</div>`).join('')}</div>
                </div>`;
            }));
        });
        const unit = (100 / (halfX * 2)).toFixed(2);
        return `<div class="v2d-spawn-map-container"><div class="v2d-spawn-map" style="--unit:${unit}%"><div class="v2d-map-center"></div>${spots}</div><div class="v2d-map-coords">X: ${(-halfX).toFixed(0)} ~ ${halfX.toFixed(0)}&nbsp;&nbsp;Z: ${(-halfZ).toFixed(0)} ~ ${halfZ.toFixed(0)}</div></div>`;
    }

    function renderCombat(gameId, dungeon, openByDefault, isHighestDifficulty) {
        const configs = Object.values(dungeon.spawnerConfigs || {});
        const fallbackEnemies = (dungeon.enemyIds || []).map((id, index) => ({ id, level: dungeon.enemyLevels?.[index] || dungeon.recommendLv, buffs: [] }));
        if (!configs.length && !fallbackEnemies.length) return '';
        return `<details class="st-combat" data-game-id="${escapeHtml(gameId)}"${isHighestDifficulty ? ' data-default-open="true"' : ''}${openByDefault ? ' open' : ''}><summary>${escapeHtml(t('combat'))}${configs.length ? escapeHtml(t('groups', { count: configs.length })) : ''}</summary><div class="st-combat-body"><span class="st-muted">${escapeHtml(t('combatLoading'))}</span></div></details>`;
    }

    function renderCombatBody(dungeon, data) {
        const configs = Object.values(dungeon.spawnerConfigs || {});
        const fallbackEnemies = (dungeon.enemyIds || []).map((id, index) => ({ id, level: dungeon.enemyLevels?.[index] || dungeon.recommendLv, buffs: [] }));
        const configHtml = configs.map(config => {
            const waves = parseWaves(config, data);
            const total = waves.reduce((sum, wave) => sum + wave.enemies.reduce((count, enemy) => count + enemy.count, 0), 0);
            const libraryBuffs = {};
            (config.enemyLibrary || []).forEach(enemy => { libraryBuffs[enemy.enemyId] = enemy.bornBuffList || []; });
            const scriptedBuffs = data.scriptBuffs[dungeon.sceneId]?.[config.configId] || [];
            const unique = [...new Map(waves.flatMap(wave => wave.enemies).map(enemy => [enemy.id, enemy])).values()];
            const mapHtml = renderSpawnMap(waves, data);
            return `<div class="st-config">
                <div class="st-config-title"><code class="st-config-id">${escapeHtml(config.configId)}</code><span>${escapeHtml(t('waveSummary', { waves: waves.length, count: total }))}</span></div>
                <div class="v2d-wave-map-row"><div class="v2d-wave-section"><div class="v2d-wave-detail">${waves.map((wave, waveIndex) => `<div class="v2d-wave-line${waveIndex === 0 ? ' active' : ''}" data-wave-idx="${waveIndex}"><span class="v2d-wave-num">${escapeHtml(t('wave', { id: wave.waveId }))}</span>${wave.repeatable ? `<span class="v2d-wave-repeat">${escapeHtml(t('repeatable'))}</span>` : ''}${wave.maxAlive ? `<span class="v2d-wave-alive">${escapeHtml(t('alive', { count: wave.maxAlive }))}</span>` : ''}${wave.externallyControlled ? `<span class="v2d-wave-pause">${escapeHtml(t('external'))}</span>` : ''}: ${wave.enemies.map(enemy => `<span class="v2d-wave-enemy" data-wave-idx="${waveIndex}" data-enemy-id="${escapeHtml(enemy.id)}"><img class="v2d-wave-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${escapeHtml(enemy.templateId)}.png" alt=""><span class="v2d-wave-ename">${escapeHtml(text(data.enemyDisplay[data.enemies[enemy.id]?.templateId]?.name, enemy.id))}</span> ×${enemy.count} <span class="v2d-wave-lv">Lv.${enemy.level}</span></span>`).join(' ')}</div>`).join('')}</div></div>${mapHtml}</div>
                <div class="ake-ui-card-grid" data-size="wide">${unique.map(enemy => renderEnemy(enemy.id, enemy.level, libraryBuffs[enemy.id] || [], scriptedBuffs, data)).join('')}</div>
            </div>`;
        }).join('');
        const fallbackHtml = configs.length ? '' : `<div class="ake-ui-card-grid" data-size="wide">${fallbackEnemies.map(enemy => renderEnemy(enemy.id, enemy.level, [], [], data)).join('')}</div>`;
        return configHtml || fallbackHtml;
    }

    function itemReward(bundle, items) {
        const item = items[bundle.id] || {};
        return `<span class="st-reward"><img src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${escapeHtml(item.iconId || bundle.id)}.png" alt=""><span>${escapeHtml(text(item.name, bundle.id))}</span><b>×${Number(bundle.count || 0).toLocaleString()}</b></span>`;
    }

    function renderRanks(data) {
        const thresholds = data.constants.rankStarNum || [];
        const standard = Object.entries(data.ranks).filter(([id]) => Number(id) > 0 && Number(id) < 6).map(([id, rank], index) => `<div class="ake-ui-card" data-card-kind="tower-rank"><span class="st-rank-score">${thresholds[index] ?? '?'}<small>★</small></span><div class="ake-ui-card__content"><b class="ake-ui-card__title">${escapeHtml(text(rank.rankName, t('rank', { id })))}</b><small class="ake-ui-card__subtitle">${escapeHtml(t('rankTitle'))}</small></div></div>`).join('');
        const glowing = data.ranks['6'];
        return standard + (glowing ? `<div class="ake-ui-card" data-card-kind="tower-rank" data-variant="glowing"><span class="st-rank-score">✦</span><div class="ake-ui-card__content"><b class="ake-ui-card__title">${escapeHtml(text(glowing.rankName, t('glowing')))}</b><small class="ake-ui-card__subtitle">${escapeHtml(t('glowing'))}</small></div></div>` : '');
    }

    function renderDifficulty(entry, data, options) {
        const { baseId, gameId, star, dungeon, mechanic, rewardId, feature, special } = entry;
        return `<div class="st-difficulty st-difficulty--${star}">
            <div class="st-difficulty-head"><span>${star} ★</span><b>${DIFFICULTIES[star] || t('difficulty', { id: star })}</b><small>${escapeHtml(t('recommended', { level: dungeon.recommendLv || '-' }))}</small></div>
            <div class="st-goal">${parseGameText(text(mechanic.desc, t('defeatAll')))}</div>
            ${options.showFeature && feature ? `<div class="st-feature">${parseGameText(feature)}</div>` : ''}
            ${options.showSpecial && special ? `<div class="st-special"><b>${escapeHtml(t('special'))}</b>${parseGameText(special)}</div>` : ''}
            <div class="st-rewards">${(data.rewards[rewardId]?.itemBundles || []).map(bundle => itemReward(bundle, data.items)).join('') || `<span class="st-muted">${escapeHtml(t('noRewards'))}</span>`}</div>
            ${renderCombat(gameId, dungeon, options.openCombat, options.isHighestDifficulty)}
        </div>`;
    }

    function renderStage(baseId, data, expandHighestDifficulty) {
        const group = data.mechanicGroups[baseId] || {};
        const towerGroup = data.gameGroups[baseId] || {};
        const entries = Object.entries(towerGroup.stars || {}).map(([starValue, row]) => {
            const star = Number(starValue);
            const dungeon = data.dungeons[row.gameId] || {};
            return {
                baseId,
                gameId: row.gameId,
                star,
                dungeon,
                mechanic: data.mechanics[row.gameId] || {},
                rewardId: row.rewardId,
                feature: fillParams(text(dungeon.featureDesc), dungeon.paramList),
                special: fillParams(text(data.towerDungeons[row.gameId]?.specialBuffDesc), dungeon.paramList)
            };
        }).sort((a, b) => a.star - b.star);
        const highestStar = Math.max(0, ...entries.map(entry => entry.star));
        const sameFeature = new Set(entries.map(entry => comparableText(entry.feature))).size <= 1;
        const sameSpecial = new Set(entries.map(entry => comparableText(entry.special))).size <= 1;
        const sharedFeature = sameFeature ? entries.find(entry => entry.feature)?.feature || '' : '';
        const sharedSpecial = sameSpecial ? entries.find(entry => entry.special)?.special || '' : '';
        return `<article class="ake-ui-card" data-card-kind="tower-stage" data-density="regular">
            <header class="ake-ui-card__header"><div class="ake-ui-card__heading"><h3 class="ake-ui-card__title">${escapeHtml(text(group.gameGroupName, baseId))}</h3><code class="ake-ui-card__id">${escapeHtml(baseId)}</code></div><span class="ake-ui-badge">${escapeHtml(t('maxStars', { count: highestStar }))}</span></header>
            <div class="ake-ui-card__body">${sharedFeature ? `<div class="st-feature st-feature--shared">${parseGameText(sharedFeature)}</div>` : ''}
            ${sharedSpecial ? `<div class="st-special st-special--shared"><b>${escapeHtml(t('special'))}</b>${parseGameText(sharedSpecial)}</div>` : ''}
            <div>${entries.map(entry => renderDifficulty(entry, data, {
                showFeature: !sameFeature,
                showSpecial: !sameSpecial,
                openCombat: expandHighestDifficulty && entry.star === highestStar,
                isHighestDifficulty: entry.star === highestStar
            })).join('')}</div></div>
        </article>`;
    }

    function renderWeek(week, index, data) {
        const status = seasonStatus(week);
        const open = status.key === 'active';
        const maxStars = week.groupIds.reduce((sum, id) => sum + Math.max(0, ...Object.keys(data.gameGroups[id]?.stars || {}).map(Number)), 0);
        return `<details class="st-week st-week--${status.key}" data-week-id="${escapeHtml(week.id)}"${open ? ' open' : ''}>
            <summary class="st-week-head"><div><h2>${escapeHtml(week.name)}</h2><small>${escapeHtml(t('weekSummary', { index: index + 1, count: week.groupIds.length, stars: maxStars }))}</small></div><div class="st-week-time"><b class="st-week-status">${status.label}</b><span>${formatDate(week.openTime)}</span><i></i><span>${formatDate(week.closeTime)}</span></div></summary>
            <div class="st-week-body"><div class="ake-ui-card-grid" data-size="full">${week.groupIds.map(id => renderStage(id, data, open)).join('')}</div></div>
        </details>`;
    }

    function renderIntro(data) {
        if (!data.introPages.length) return '';
        return `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('instructions'))}</h2></header><div class="ake-ui-card-grid" data-size="regular">${data.introPages.map(page => `<article class="ake-ui-card" data-card-kind="tower-intro" data-density="regular"><b class="ake-ui-card__title">${escapeHtml(text(page.title, t('instruction', { id: page.pageIndex })))}</b><div class="ake-ui-card__body">${parseGameText(text(page.desc))}</div></article>`).join('')}</div></section>`;
    }

    function renderSeason(season) {
        const status = seasonStatus(season);
        const data = season.data;
        activeData = data;
        const detailHeader = window.AKEUI.detailHeader({
            icon: {
                src: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${data.activity.tabImg || 'activity_tab_bg_seasontower'}.png`
            },
            title: `${text(data.activity.name, t('title'))} · ${season.name}`,
            subtitle: text(data.activity.desc),
            content: window.AKEUI.fragment(`<div class="ake-ui-detail-meta"><span class="ake-ui-badge" data-accent="status" data-accent-value="${status.key}">${status.label}</span><span>${formatDate(season.openTime)}</span><span>${formatDate(season.closeTime)}</span></div>`)
        });
        detail.innerHTML = `<div class="ake-ui-detail" data-detail-kind="tower">${detailHeader?.outerHTML || ''}
        ${renderIntro(data)}
        <section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('ranks'))}</h2></header><div class="ake-ui-card-grid" data-size="narrow">${renderRanks(data)}</div></section>
        <section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('rotations'))}</h2></header>${season.weeks.map((week, index) => renderWeek(week, index, data)).join('')}</section></div>`;
        loadOpenCombats(detail);
        detail.scrollTop = 0;
    }

    function seasonButton(season) {
        const status = seasonStatus(season);
        const seasonCode = `S${String(season.id).padStart(2, '0')}`;
        return window.AKEUI.directoryItem({
            layout: 'entity',
            title: season.name,
            subtitle: `${formatDate(season.openTime).split(' ')[0]} - ${formatDate(season.closeTime).split(' ')[0]}`,
            icon: window.AKEUI.element('span', 'ake-ui-directory__item-icon is-symbol', seasonCode),
            meta: [{ label: status.label, kind: `status-${status.key}` }],
            accent: { type: 'status', value: status.key },
            active: season.id === activeSeasonId,
            attributes: { 'data-season-id': season.id }
        });
    }

    function renderLists() {
        list.replaceChildren(...seasons.map(seasonButton));
        mobileList.replaceChildren(...seasons.map(seasonButton));
    }

    function selectSeason(id, updateUrl) {
        const season = seasons.find(entry => entry.id === String(id));
        if (!season) return false;
        activeSeasonId = season.id;
        renderLists();
        renderSeason(season);
        closeOverlay();
        if (updateUrl) window.__akeRouter?.updateUrl(MODULE_ID, season.id);
        return true;
    }

    function closeOverlay() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function switchWave(config, waveIndex) {
        config.querySelectorAll('.v2d-wave-line').forEach(line => line.classList.toggle('active', line.dataset.waveIdx === waveIndex));
        config.querySelectorAll('.v2d-map-spot').forEach(spot => { spot.style.display = spot.dataset.wave === waveIndex ? '' : 'none'; });
    }

    function clearMapHighlights(config) {
        if (!config) return;
        config.querySelectorAll('.v2d-map-spot').forEach(spot => spot.classList.remove('group-highlight', 'target-highlight'));
        config.querySelectorAll('.v2d-wave-enemy').forEach(enemy => enemy.classList.remove('enemy-highlight', 'enemy-target-highlight'));
    }

    function loadCombat(combat) {
        if (!combat?.open || combat.dataset.loaded === 'true' || !activeData) return;
        const dungeon = activeData.dungeons[combat.dataset.gameId];
        if (!dungeon) return;
        combat.querySelector('.st-combat-body').innerHTML = renderCombatBody(dungeon, activeData);
        combat.dataset.loaded = 'true';
    }

    function loadOpenCombats(scope) {
        scope.querySelectorAll('.st-combat[open]').forEach(loadCombat);
    }

    function adjustMapTip(spot) {
        const map = spot.closest('.v2d-spawn-map');
        const tip = spot.querySelector('.v2d-map-tip');
        if (!map || !tip) return;
        const mapRect = map.getBoundingClientRect();
        const spotRect = spot.getBoundingClientRect();
        const top = spotRect.top - mapRect.top;
        tip.dataset.placement = top < 60 ? 'bottom' : 'top';
    }

    async function load() {
        try {
            const names = ['SeasonTowerTable', 'SeasonTowerGameGroupTable', 'GameMechanicGroupTable', 'DungeonTable', 'GameMechanicTable', 'SeasonTowerDungeonTable', 'RewardTable', 'ItemTable', 'TimeRangeTable', 'SeasonTowerConst', 'SeasonTowerRankTable', 'DungeonSeriesTable', 'EnemyTable', 'EnemyTemplateDisplayInfoTable', 'EnemyAttributeTemplateTable', 'IntroTable', 'ActivityTable'];
            const [seasonTable, gameGroups, mechanicGroups, allDungeons, mechanics, towerDungeons, rewards, items, times, constants, ranks, series, enemies, enemyDisplay, enemyAttrs, intros, activities, maps] = await Promise.all([
                ...names.map(name => window.AKEV3.table(name)), window.akeLoadMaps()
            ]);
            const groupIds = new Set(Object.values(seasonTable).flatMap(season => Object.values(season.weeks || {}).flatMap(week => week.includeGameIdList || [])));
            const dungeonIds = new Set([...groupIds].flatMap(id => Object.values(gameGroups[id]?.stars || {}).map(row => row.gameId)));
            const dungeons = Object.fromEntries([...dungeonIds].filter(id => allDungeons[id]).map(id => [id, { ...allDungeons[id] }]));
            const sceneIds = [...new Set(Object.values(dungeons).map(row => row.sceneId).filter(Boolean))];
            const sceneData = await Promise.all(sceneIds.map(async id => ({ id, spawners: await loadSpawners(id), buffs: await window.AKECombatData.loadSceneScriptBuffs(id) })));
            const spawners = Object.fromEntries(sceneData.flatMap(scene => Object.entries(scene.spawners).map(([id, row]) => [`${scene.id}:${id}`, row])));
            const scriptBuffs = Object.fromEntries(sceneData.map(scene => [scene.id, scene.buffs]));
            const spawnersByScene = Object.fromEntries(sceneData.map(scene => [scene.id, scene.spawners]));
            attrMap = maps.ATTR_MAP || {};
            attrNameToId = Object.fromEntries(Object.entries(maps.ATTR_MAP_EN || {}).map(([id, name]) => [name, Number(id)]));
            Object.values(dungeons).forEach(dungeon => {
                dungeon.spawnerConfigs = spawnersForDungeon(dungeon, spawnersByScene[dungeon.sceneId] || {});
            });
            const towerActivities = Object.values(activities).filter(row => row.panelId === 'ActivitySeasonTower');
            const activity = towerActivities.length === 1 ? towerActivities[0] : {};
            if (towerActivities.length > 1) console.warn('SeasonTower: multiple activities without a season-to-activity relation', towerActivities.map(row => row.id));
            const missingReferences = [...groupIds].filter(id => !gameGroups[id]).concat([...dungeonIds].filter(id => !allDungeons[id]));
            if (missingReferences.length) console.warn('SeasonTower: unresolved group/dungeon references', missingReferences);
            const shared = { gameGroups, mechanicGroups, dungeons, mechanics, towerDungeons, rewards, items, constants, ranks, enemies, enemyDisplay, enemyAttrs, spawners, scriptBuffs, activity,
                introPages: [...(intros.season_tower?.dataArray || [])].sort((a, b) => Number(a.pageIndex) - Number(b.pageIndex)) };
            await loadBuffs(shared);
            if (destroyed) return;
            seasons = Object.entries(seasonTable).map(([id, row]) => {
                const weeks = Object.entries(row.weeks || {}).map(([weekId, week]) => {
                    const range = times[`time_activity_seasontower_season_${id}_week_${weekId}`]?.timeRangeList?.[0] || {};
                    return { id: weekId, name: text(week.weekShowName, t('rotation', { id: weekId })), groupIds: week.includeGameIdList || [], openTime: range.openTime || '', closeTime: range.closeTime || '' };
                });
                return { id, name: text(row.name, t('season', { id })), weeks, openTime: weeks[0]?.openTime || '', closeTime: weeks[weeks.length - 1]?.closeTime || '', data: shared };
            }).sort((a, b) => Number(a.id) - Number(b.id));
            const deepId = window.__deepLinkId;
            window.__deepLinkId = null;
            if (deepId && !selectSeason(deepId, false)) window.__akeRouter?.onDeepLinkNotFound?.(deepId, false);
            if (!activeSeasonId) selectSeason((seasons.find(season => seasonStatus(season).key === 'active') || seasons[seasons.length - 1])?.id, false);
        } catch (error) {
            if (destroyed) return;
            detail.innerHTML = `<div class="ake-ui-state" data-state="error"><div><b>${escapeHtml(t('loadFailed'))}</b><span>${escapeHtml(error.message)}</span></div></div>`;
        }
    }

    root.addEventListener('click', event => {
        const seasonItem = event.target.closest('[data-season-id]');
        if (seasonItem) { selectSeason(seasonItem.dataset.seasonId, true); return; }
        const combatSummary = event.target.closest('.st-combat > summary');
        if (combatSummary) combatSummary.parentElement.dataset.userToggled = 'true';
        const wave = event.target.closest('.v2d-wave-line, .v2d-wave-enemy');
        const config = wave?.closest('.st-config');
        if (config && wave.dataset.waveIdx !== undefined) switchWave(config, wave.dataset.waveIdx);
    });
    root.addEventListener('mouseover', event => {
        const spot = event.target.closest('.v2d-map-spot');
        const enemy = event.target.closest('.v2d-wave-enemy');
        const config = (spot || enemy)?.closest('.st-config');
        if (!config) return;
        clearMapHighlights(config);
        if (spot) {
            adjustMapTip(spot);
            const group = spot.dataset.group;
            const target = spot.dataset.targetGroup;
            config.querySelectorAll(`.v2d-map-spot[data-wave="${spot.dataset.wave}"]`).forEach(other => {
                if (other !== spot && other.dataset.group === group) other.classList.add('group-highlight');
                if (target && other.dataset.group === target) other.classList.add('target-highlight');
            });
            config.querySelectorAll(`.v2d-wave-enemy[data-wave-idx="${spot.dataset.wave}"]`).forEach(row => {
                if (row.dataset.enemyId === spot.dataset.enemyId) row.classList.add('enemy-highlight');
            });
        } else if (enemy) {
            enemy.classList.add('enemy-highlight');
            config.querySelectorAll(`.v2d-map-spot[data-wave="${enemy.dataset.waveIdx}"]`).forEach(point => {
                if (point.dataset.enemyId !== enemy.dataset.enemyId) return;
                point.classList.add('group-highlight');
                const group = point.dataset.group;
                const target = point.dataset.targetGroup;
                config.querySelectorAll('.v2d-map-spot').forEach(other => {
                    if (other !== point && other.dataset.group === group) other.classList.add('group-highlight');
                    if (target && other.dataset.group === target) other.classList.add('target-highlight');
                });
            });
        }
    });
    root.addEventListener('mouseout', event => {
        const target = event.target.closest('.v2d-map-spot, .v2d-wave-enemy');
        if (target) clearMapHighlights(target.closest('.st-config'));
    });
    root.addEventListener('toggle', event => {
        if (event.target.matches?.('.st-week')) {
            if (!event.target.open) return;
            event.target.querySelectorAll('.st-combat[data-default-open="true"]').forEach(combat => {
                if (combat.dataset.userToggled !== 'true') combat.open = true;
            });
            loadOpenCombats(event.target);
            return;
        }
        loadCombat(event.target.closest?.('.st-combat'));
    }, true);
    document.getElementById('seasonTowerMobileButton').addEventListener('click', () => {
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
    });
    overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('.ake-ui-directory__mobile-header button')) closeOverlay();
    });
    function onConfigChanged() {
        if (!root.isConnected) return;
        const season = seasons.find(entry => entry.id === activeSeasonId);
        if (season) renderSeason(season);
    }
    window.addEventListener('globalConfigChanged', onConfigChanged);
    window.__akeSeasonTowerController = {
        destroy() { destroyed = true; window.removeEventListener('globalConfigChanged', onConfigChanged); }
    };
    load();
})();
