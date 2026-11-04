(function() {
    const t = window.akeI18n.scope('modules.cc');
    const commonT = window.akeI18n.scope('common');
    let allGames = [];
    let activeGameId = null;
    let isInitialized = false;
    let searchTerm = '';
    let selectedTagIds = new Set();
    let currentData = null;
    let currentGame = null;
    let currentDungeonData = null;
    let currentDungeonError = null;
    let detailRequestId = 0;
    let ccAttrMap = {};
    let ccAttrNameToId = {};
    let ccBuffCache = {};

    const FORMULA_TO_MODTYPE = window.AKEStats.FORMULA_TO_MODTYPE;
    const LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES = window.AKEEnemyRenderer.LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES;

    const ATTR_DISPLAY_ORDER = [0, 1, 2, 3, 20, 21, 27, 12, 8, 9, 10, 11, 15];

    const IMAGE_BASE_PATH = '/public/images/';
    const STATUS_NAMES = ['statuses.active', 'statuses.upcoming', 'statuses.ended', 'statuses.permanent'];
    const STATUS_ACCENTS = ['active', 'upcoming', 'closed', 'permanent'];

    const TERM_TYPE_MAP = {
        1: { labelKey: 'termTypes.enemyBuff', cls: 'enemy-buff' },
        2: { labelKey: 'termTypes.selfDebuff', cls: 'self-buff' },
        3: { labelKey: 'termTypes.timeReduction', cls: 'time-reduce' },
        0: { labelKey: 'termTypes.none', cls: '' },
        'None': { labelKey: 'termTypes.none', cls: '' }
    };

    function parseText(text) {
        if (!text) return '';
        text = text.replace(/<color=([^>]+)>/g, '<span style="color:$1">').replace(/<\/color>/g, '</span>');
        text = text.replace(/\n/g, '<br>');
        return window.parseText(text, IMAGE_BASE_PATH);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getCurrentShowHidden() {
        return window.akeData?.getConfig().showHidden ?? false;
    }

    function formatBlackboardValue(val) {
        if (typeof val === 'number') {
            const display = Number.isInteger(val) ? val.toString() : (val * 100).toFixed(0) + '%';
            return window.renderRawValueTip ? window.renderRawValueTip(display, val) : display;
        }
        return String(val);
    }

    function buildBlackboardValueMap(tagTerms) {
        const map = {};
        for (const term of (tagTerms || [])) {
            for (const bb of (term.blackboard || [])) {
                if (bb.key && !Object.prototype.hasOwnProperty.call(map, bb.key)) {
                    map[bb.key] = (bb.valueStr && bb.valueStr !== '') ? bb.valueStr : bb.value;
                }
            }
        }
        return map;
    }

    function buildAllTagValueMaps(tagTable) {
        const maps = {};
        for (const [tid, td] of Object.entries(tagTable || {})) {
            maps[String(tid)] = buildBlackboardValueMap(td.tagTerms || []);
        }
        return maps;
    }

    function evalExprWithMap(expr, format, valueMap) {
        const lowerValueMap = {};
        for (const [key, val] of Object.entries(valueMap || {})) {
            lowerValueMap[String(key).toLowerCase()] = val;
        }
        const varNames = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        const missingVar = varNames.find(name => !(name.toLowerCase() in lowerValueMap));
        if (missingVar) return null;
        let evalExpr = expr;
        for (const name of varNames) {
            const value = lowerValueMap[name.toLowerCase()];
            const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            evalExpr = evalExpr.replace(regex, `(${value})`);
        }
        let result;
        // Blackboard expressions contain numeric arithmetic only.
        if (!/^[\d\s.()+*/%\-]+$/.test(evalExpr)) return null;
        try {
            result = new Function('return ' + evalExpr)();
        } catch (e) {
            return null;
        }
        if (typeof result !== 'number' || !Number.isFinite(result)) return null;
        let formatted;
        if (format.includes('%')) formatted = (result * 100).toFixed(1) + '%';
        else if (format.includes('.')) {
            const precision = format.split('.')[1]?.length || 1;
            formatted = result.toFixed(precision);
        }
        else if (format.includes('0')) formatted = Math.round(result).toString();
        else formatted = result.toString();
        const bindings = Object.fromEntries(varNames.map(name => [name, lowerValueMap[name.toLowerCase()]]));
        const changed = !(varNames.length === 1 && expr.toLowerCase() === varNames[0].toLowerCase());
        const rawValue = varNames.length === 1 ? bindings[varNames[0]] : Object.entries(bindings).map(([key, value]) => `${key}=${value}`).join(', ');
        return window.renderRawValueTip ? window.renderRawValueTip(formatted, {
            rawValue, value: result, changed, expression: expr,
            formula: changed ? `${evalExpr} = ${result}` : undefined,
            bindings
        }) : formatted;
    }

    function replacePlaceholders(desc, valueMap, allValueMaps) {
        if (!desc) return desc;
        const hasPlaceholders = desc.includes('{');
        const hasColor = desc.includes('<color');
        if (!hasPlaceholders && !hasColor) return desc;
        return String(desc)
            .replace(/<color=([^>]+)>/g, '<span style="color:$1">')
            .replace(/<\/color>/g, '</span>')
            .replace(/\{(@([^@]*)@)?([^}]+)\}/g, (match, _atPart, refTagId, inner) => {
                const parts = inner.split(':');
                const expr = parts[0].replace(/\s+/g, '');
                const format = parts[1] ? parts[1].trim() : '';
                const lookupMap = (refTagId && allValueMaps)
                    ? allValueMaps[String(refTagId)] || {}
                    : valueMap;
                const result = evalExprWithMap(expr, format, lookupMap);
                return result !== null ? result : t('data.unavailableValue');
            });
    }

    function filterGames(games) {
        if (!searchTerm) return games;
        const t = searchTerm.toLowerCase();
        return games.filter(g =>
            (g.gameId && window.AKEModuleSearch.matches(g.gameId, t)) ||
            (g.name && window.AKEModuleSearch.matches(g.name, t)) ||
            (g.activityId && window.AKEModuleSearch.matches(g.activityId, t))
        );
    }

    function getAllContractTags(cct) {
        if (!cct || !cct.contractGroupMap) return {};
        const all = {};
        for (const gid of Object.keys(cct.contractGroupMap)) {
            const group = cct.contractGroupMap[gid];
            if (!group.contractMap) continue;
            for (const key of Object.keys(group.contractMap)) {
                const tag = group.contractMap[key];
                all[String(tag.tagId)] = tag;
            }
        }
        return all;
    }

    function getAvailableKeys(selectedIds, allTags) {
        const keys = new Set();
        for (const tid of selectedIds) {
            const tag = allTags[tid];
            if (tag && tag.keyId) keys.add(tag.keyId);
        }
        return keys;
    }

    function checkTagRequirements(tagId, selectedIds, allTags) {
        const tag = allTags[tagId];
        if (!tag) return { ok: false, reason: t('conflicts.tagMissing') };

        if (tag.conflictId) {
            for (const sid of selectedIds) {
                if (sid === String(tagId)) continue;
                const st = allTags[sid];
                if (st && st.conflictId === tag.conflictId) {
                    return { ok: false, kind: 'conflict', reason: getCurrentShowHidden()
                        ? t('conflicts.withTag', { tag: sid, conflict: tag.conflictId })
                        : t('conflicts.withSelected') };
                }
            }
        }

        if (tag.lockIds && tag.lockIds.length > 0) {
            const availableKeys = getAvailableKeys(selectedIds, allTags);
            const missing = tag.lockIds.filter(k => !availableKeys.has(k));
            if (missing.length > 0) {
                return { ok: false, reason: getCurrentShowHidden()
                    ? t('conflicts.missingKeys', { keys: missing.join(', ') })
                    : t('conflicts.requiresOther') };
            }
        }

        return { ok: true, reason: '' };
    }

    function isTagSelectable(tagId, selectedIds, allTags) {
        if (selectedIds.has(tagId)) return { ok: true, reason: '' };
        return checkTagRequirements(tagId, selectedIds, allTags);
    }

    function cascadeDeselect(selectedIds, allTags) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const tid of Array.from(selectedIds)) {
                const check = checkTagRequirements(tid, selectedIds, allTags);
                if (!check.ok) {
                    selectedIds.delete(tid);
                    changed = true;
                }
            }
        }
        return selectedIds;
    }

    function computeTotalScore(selectedIds, tagTable) {
        let total = 0;
        for (const tid of selectedIds) {
            const td = tagTable[tid];
            if (td) total += (td.score || 0);
        }
        return total;
    }

    function formatAvailability(game) {
        const open = String(game.openTime || '').slice(0, 10);
        const close = String(game.closeTime || '').slice(0, 10);
        return open && close
            ? t('overview.dateRange', { start: open, end: close }, `${open}–${close}`)
            : open ? t('overview.opensOn', { date: open }, open) : close ? t('overview.endsOn', { date: close }, close) : '';
    }

    function displayGameName(game) {
        return game.name && game.name !== game.gameId ? game.name : t('detail.unnamed');
    }

    async function loadGameManifest(showHidden) {
        try {
            const res = await (window.akeFetch || fetch)('/public/CH/v2_cc/manifest.json');
            if (!res.ok) throw new Error('无法加载合约清单');
            const all = await res.json();
            let games = showHidden ? all : all.filter(g => !g.hidden);
            games.sort((a, b) => (a.priority || 999) - (b.priority || 999));
            return games;
        } catch (err) {
            console.error('加载合约清单失败:', err);
            return [];
        }
    }

    function renderGameOverview(items, container) {
        window.AKEModuleOverview.render(container, {
            title: t('overview.title'), description: t('overview.description'),
            variant: 'landscape',
            group: item => ({ id: String(item.statusOrder ?? 3), name: t(STATUS_NAMES[item.statusOrder] || 'statuses.permanent'), order: item.statusOrder ?? 3 }),
            onReset: () => { activeGameId = null; },
            onSelect: item => { activeGameId = item.gameId; renderGameList(); },
            sidebarSelector: item => `.ake-ui-directory__item[data-game-id="${CSS.escape(item.gameId)}"]`,
            items: items.map(item => {
                const status = STATUS_ACCENTS[item.statusOrder] || 'permanent';
                const groups = item.contractGroupCount || 0;
                const terms = item.contractCount || 0;
                const scale = `${t('counts.indicatorGroups', { count: groups })} · ${t('counts.terms', { count: terms })}`;
                return { ...item, id: item.gameId, name: displayGameName(item), image: item.image, fallback: 'CC',
                    outline: status === 'permanent' ? '' : `status-${status}`,
                    tags: [scale, formatAvailability(item)] };
            })
        });
    }

    const mobileBtn = document.getElementById('v2ccMobileListBtn');
    const mobileOverlay = document.getElementById('v2ccMobileListOverlay');
    const mobileContent = document.getElementById('v2ccMobileListContent');

    function createGameDirectoryItem(game, options = {}) {
        const status = STATUS_ACCENTS[game.statusOrder] || 'permanent';
        const icon = game.image
            ? { src: game.image, alt: '' }
            : window.AKEUI.element('span', 'ake-ui-directory__item-icon is-symbol', 'CC');
        const item = window.AKEUI.directoryItem({
            layout: 'entity',
            title: displayGameName(game),
            id: game.activityId || game.gameId,
            icon,
            meta: [{ label: t(STATUS_NAMES[game.statusOrder] || 'statuses.permanent'), kind: `status-${status}` }],
            accent: { type: 'status', value: status },
            active: options.active,
            attributes: { 'data-game-id': game.gameId },
            onSelect: options.onSelect
        });
        window.AKEModuleOverview?.markVersionChange(item, game);
        return item;
    }

    function buildMobileList() {
        const filtered = filterGames(allGames);
        mobileContent.innerHTML = '';
        filtered.forEach(game => {
            const item = createGameDirectoryItem(game, {
                active: game.gameId === activeGameId,
                onSelect: () => {
                    activeGameId = game.gameId;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_cc', game.gameId);
                    loadGameDetail(game, document.getElementById('v2ccDetail'));
                    closeMobileList();
                    const desktopList = document.getElementById('v2ccList');
                    const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-game-id="${CSS.escape(game.gameId)}"]`);
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

    function renderGameList() {
        const container = document.getElementById('v2ccList');
        const detailContainer = document.getElementById('v2ccDetail');
        if (!container) return;

        const filtered = filterGames(allGames);
        container.innerHTML = '';

        if (filtered.length === 0) {
            container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
            if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
            activeGameId = null;
            return;
        }

        filtered.forEach((game, index) => {
            const item = createGameDirectoryItem(game, {
                active: game.gameId === activeGameId
                    || (!activeGameId && index === 0 && !window.AKEModuleOverview?.isActive('cc')),
                onSelect: () => {
                    window.AKEUI.setDirectoryItemActive(container, item);
                    activeGameId = game.gameId;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_cc', game.gameId);
                    loadGameDetail(game, detailContainer);
                }
            });

            container.appendChild(item);
        });

        if (window.__deepLinkId) {
            const deepGame = filtered.find(g => g.gameId === window.__deepLinkId);
            if (deepGame) {
                activeGameId = deepGame.gameId;
            } else {
                const existsInRaw = allGames.some(g => g.gameId === window.__deepLinkId);
                if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                    window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                }
            }
            window.__deepLinkId = null;
        }
        const activeExists = filtered.some(g => g.gameId === activeGameId);
        if (!activeExists && filtered.length > 0) {
            if (window.AKEModuleOverview?.isActive('cc')) {
                activeGameId = null;
                renderGameOverview(filtered, detailContainer);
                return;
            }
            activeGameId = filtered[0].gameId;
            if (window.__akeRouter) window.__akeRouter.updateUrl('v2_cc', activeGameId);
            const f = container.querySelector('.ake-ui-directory__item');
            if (f) window.AKEUI.setDirectoryItemActive(container, f);
            loadGameDetail(filtered[0], detailContainer);
        } else if (activeExists) {
            const ag = filtered.find(g => g.gameId === activeGameId);
            if (ag) {
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_cc', activeGameId);
                const ad = container.querySelector(`.ake-ui-directory__item[data-game-id="${activeGameId}"]`);
                if (ad) window.AKEUI.setDirectoryItemActive(container, ad);
                loadGameDetail(ag, detailContainer);
            }
        }
    }

    async function loadGameDetail(game, container) {
        const requestId = ++detailRequestId;
        container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
        try {
            const data = await (window.akeFetch || fetch)(game.contentFile).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            });
            if (requestId !== detailRequestId) return;
            await attachContractValues(data, game.gameId);
            if (requestId !== detailRequestId) return;
            const diagnostics = getCcDiagnostics(data);
            if (diagnostics.missingTags.length || diagnostics.missingTaskGroups.length) console.warn('CC data relations', game.gameId, diagnostics);
            else if (diagnostics.missingTerms.length) console.debug('CC effect parameters unavailable', game.gameId, diagnostics.missingTerms);
            currentData = data;
            currentGame = game;
            currentDungeonData = null;
            currentDungeonError = null;
            selectedTagIds.clear();

            if (data.buffdata) {
                Object.entries(data.buffdata).forEach(([id, buff]) => {
                    ccBuffCache[id] = buff;
                });
            }

            if (game.dungeonFile) {
                try {
                    await loadCcMaps();
                    const response = await (window.akeFetch || fetch)(game.dungeonFile);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const dgData = await response.json();
                    await window.AKECombatData?.enrichDungeonScripts(dgData);
                    const embeddedBuffData = {};
                    Object.values(dgData.dungeontable || {}).forEach(dg => {
                        if (dg.BuffData) Object.assign(embeddedBuffData, dg.BuffData);
                    });
                    const buffIds = new Set();
                    Object.values(dgData.dungeontable || {}).forEach(dg => {
                        Object.values(dg.enemyTable || {}).forEach(e => (e.bornBuffs || []).forEach(id => buffIds.add(id)));
                        Object.values(dg.SpawnerConfig || {}).forEach(sc => {
                            (sc.enemyLibrary || []).forEach(lib => (lib.bornBuffList || []).forEach(b => buffIds.add(b.buffId)));
                        });
                        (window.AKECombatData?.collectScriptBuffIds(dg) || []).forEach(id => buffIds.add(id));
                    });
                    Object.values(data.cctagtable || {}).forEach(tag => (tag.tagTerms || []).forEach(term => {
                        if (term.termType === 1 && term.buffId) buffIds.add(term.buffId);
                    }));
                    await Promise.all(Array.from(buffIds).map(id => loadCcBuff(id, embeddedBuffData)));
                    if (requestId !== detailRequestId) return;
                    currentDungeonData = dgData;
                } catch (dgErr) {
                    if (requestId !== detailRequestId) return;
                    currentDungeonError = dgErr;
                    console.error('加载副本数据失败:', dgErr);
                }
            }

            container.innerHTML = renderDetail(data, game);
            window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, game) : '');
            bindTagEvents();
            updateSelectedSummary(data.cctagtable || {});
        } catch (err) {
            if (requestId !== detailRequestId) return;
            container.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: escapeHtml(err.message) })}</div>`;
        }
    }

    async function attachContractValues(data, gameId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(gameId || '')) return;
        try {
            const url = new URL(`https://data.akedata.wiki/public/${encodeURIComponent(gameId)}.json`);
            try {
                const index = await window.akeAssetIndex?.load({ baseUrl: 'https://data.akedata.wiki' });
                const record = index?.ccData?.files?.[`${gameId}.json`];
                if (index?.ccData?.root === 'public' && /^[0-9a-f]{32}$/.test(record?.md5 || '')) {
                    url.searchParams.set('v', record.md5);
                }
            } catch (err) {
                console.debug('CC value index unavailable', gameId, err);
            }
            const response = await (window.akeFetch || fetch)(url.href, { cache: 'no-cache', akeMissingDataKind: 'json' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const values = await response.json();
            if (values?.schemaVersion !== 1 || values.gameId !== gameId || !values.tags ||
                typeof values.tags !== 'object' || Array.isArray(values.tags)) {
                throw new Error('Invalid contract value data');
            }
            const referenced = getAllContractTags(data.contingencycontracttable);
            const tagTable = { ...(data.cctagtable || {}) };
            const invalid = [];
            for (const [id, record] of Object.entries(values.tags)) {
                if (!referenced[id] || !tagTable[id]) continue;
                if (!Array.isArray(record?.tagTerms) || record.tagTerms.some(term =>
                    !term || typeof term !== 'object' || !Array.isArray(term.blackboard))) {
                    invalid.push(id);
                    continue;
                }
                tagTable[id] = { ...tagTable[id], tagTerms: record.tagTerms };
            }
            data.cctagtable = tagTable;
            if (invalid.length) console.warn('CC invalid value records', gameId, invalid);
        } catch (err) {
            console.debug('CC value data unavailable', gameId, err);
        }
    }

    function renderActivityInfo(acc) {
        if (!acc || !getCurrentShowHidden()) return '';
        const items = [
            { l: t('activityInfo.activityId'), v: acc.activityId },
            { l: t('activityInfo.gameplayType'), v: acc.type },
            { l: t('activityInfo.stageId'), v: acc.gameplayEndStageId },
            { l: t('activityInfo.maxTagColumns'), v: acc.tagMaxColumn },
            { l: t('activityInfo.currencyAmount'), v: acc.compareToMoneyCount },
            { l: t('activityInfo.shopGroup'), v: acc.shopGroupId }
        ].filter(i => i.v !== undefined && i.v !== '');

        if (!items.length) return '';

        const meta = window.AKEUI.metaGrid(items.map(item => ({ label: item.l, value: String(item.v) })));
        return `<details class="ake-ui-section v2cc-activity-config">
            <summary>${t('sections.activityConfiguration')}</summary>
            ${meta?.outerHTML || ''}
        </details>`;
    }

    function renderTagTermEffect(term) {
        const typeInfo = TERM_TYPE_MAP[term.termType] || TERM_TYPE_MAP['None'];
        const params = (term.blackboard || []).map(bb => {
            const value = bb.valueStr !== undefined && bb.valueStr !== ''
                ? escapeHtml(String(bb.valueStr))
                : formatBlackboardValue(bb.value);
            return `<span class="v2cc-term-param">${getCurrentShowHidden() ? `<span class="v2cc-term-param-key">${escapeHtml(bb.key)}</span>` : ''}<span class="v2cc-term-param-value">${value}</span></span>`;
        }).join('');

        return `
            <div class="v2cc-tag-term">
                <span class="v2cc-term-type ${typeInfo.cls}">${escapeHtml(t(typeInfo.labelKey))}</span>
                ${params ? `<span class="v2cc-term-params">${params}</span>` : ''}
            </div>
        `;
    }

    function renderScorePanel(tagTable) {
        const total = computeTotalScore(selectedTagIds, tagTable);
        const count = selectedTagIds.size;
        return `
            <div class="ake-ui-toolbar v2cc-score-panel" id="v2ccScorePanel">
                <div class="v2cc-score-panel-left">
                    <span class="v2cc-score-panel-label">${t('score.currentTotal')}</span>
                    <span class="v2cc-score-panel-value">${total}</span>
                    <span class="ake-ui-badge v2cc-score-panel-count">${t('score.selectedTerms', { count })}</span>
                </div>
                <button type="button" id="v2ccResetBtn">${t('score.reset')}</button>
            </div>
        `;
    }

    function renderContractGroups(cct, tagTable) {
        if (!cct || !cct.contractGroupMap) return '';
        const groupMap = cct.contractGroupMap;
        const column = id => Math.min(...Object.values(groupMap[id].contractMap || {}).map(tag => tag.column ?? Infinity));
        const groupIds = Object.keys(groupMap).sort((a, b) => column(a) - column(b) || Number(a) - Number(b));
        if (!groupIds.length) return '';

        const allTags = getAllContractTags(cct);
        const allValueMaps = buildAllTagValueMaps(tagTable);

        return `
            <div class="ake-ui-section">
                <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.contractTerms')}</h3></div>
                ${renderScorePanel(tagTable)}
                <div class="ake-ui-card-grid v2cc-groups" data-size="wide">
                    ${groupIds.map((gid, groupIndex) => {
                        const group = groupMap[gid];
                        const contractMap = group.contractMap || {};
                        const entryKeys = Object.keys(contractMap).sort((a, b) => (contractMap[a].row ?? 0) - (contractMap[b].row ?? 0) || Number(a) - Number(b));

                        return `
                            <section class="ake-ui-section v2cc-group">
                                <div class="ake-ui-section__header"><h4 class="ake-ui-section__title">${t('contract.group', { id: getCurrentShowHidden() ? escapeHtml(gid) : groupIndex + 1 })}</h4></div>
                                ${entryKeys.map(ek => {
                                    const tag = contractMap[ek];
                                    const tid = String(tag.tagId);
                                    const tagData = tagTable[tid] || {};
                                    const name = tagData.name?.text || (getCurrentShowHidden() ? `Tag ${tid}` : t('contract.unnamedTerm'));
                                    const terms = tagData.tagTerms || [];
                                    const bbValueMap = buildBlackboardValueMap(terms);
                                    const desc = replacePlaceholders(tagData.desc?.text || '', bbValueMap, allValueMaps);
                                    const icon = tagData.icon || '';
                                    const roman = tagData.romanNumSuffix || '';
                                    const score = tagData.score ?? 0;
                                    const isSelected = selectedTagIds.has(tid);
                                    const selCheck = isTagSelectable(tid, selectedTagIds, allTags);
                                    const isSelectable = selCheck.ok || isSelected;
                                    const stateClass = isSelected ? 'selected' : (selCheck.ok ? 'selectable' : `locked${selCheck.kind === 'conflict' ? ' conflict-locked' : ''}`);

                                    let badges = '';
                                    const showHidden = getCurrentShowHidden();
                                    const heldKeys = getAvailableKeys(selectedTagIds, allTags);
                                    if (tag.keyId) {
                                        const keyHeld = heldKeys.has(tag.keyId);
                                        badges += `<span class="ake-ui-badge v2cc-tag-badge key${keyHeld ? ' held' : ''}" data-key-id="${escapeHtml(tag.keyId)}"><span class="badge-dot"></span>${showHidden ? t('contract.key', { key: escapeHtml(tag.keyId) }) : t('contract.unlocksOther')}</span>`;
                                    }
                                    if (tag.lockIds && tag.lockIds.length > 0) {
                                        const locks = showHidden ? tag.lockIds.map(lid => [lid]) : [tag.lockIds];
                                        locks.forEach(ids => {
                                            const keyHeld = ids.every(lid => heldKeys.has(lid));
                                            badges += `<span class="ake-ui-badge v2cc-tag-badge lock${keyHeld ? ' held' : ''}" data-lock-ids="${escapeHtml(ids.join('|'))}"><span class="badge-dot"></span>${showHidden ? t('contract.requires', { key: escapeHtml(ids[0]) }) : t('contract.requiresSelection')}</span>`;
                                        });
                                    }
                                    return `
                                        <div class="ake-ui-card is-interactive ${stateClass}" data-card-kind="cc-tag" data-tag-id="${escapeHtml(tid)}" role="checkbox" tabindex="0" aria-checked="${isSelected}" aria-disabled="${!isSelectable}" aria-label="${escapeHtml(name)}"${!isSelectable ? ` aria-description="${escapeHtml(selCheck.reason)}"` : ''}>
                                            <div class="ake-ui-card__header" data-layout="split">
                                                <div class="ake-ui-card__header-start">
                                                    <div class="v2cc-tag-check">${isSelected ? '✓' : ''}</div>
                                                    ${icon ? `<img class="v2cc-tag-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/contingencycontract/buff/${icon}.png" alt="">` : ''}
                                                    <span class="ake-ui-card__title">${escapeHtml(name)}</span>
                                                </div>
                                                <div class="ake-ui-card__header-end">
                                                    ${roman ? `<span class="ake-ui-badge" data-tone="muted">${escapeHtml(roman)}</span>` : ''}
                                                    <span class="v2cc-tag-score">+${score}</span>
                                                </div>
                                            </div>
                                            ${desc ? `<div class="ake-ui-card__body">${desc}</div>` : ''}
                                            ${terms.length ? `<div class="v2cc-tag-terms">${terms.map(renderTagTermEffect).join('')}</div>` : ''}
                                            ${badges ? `<div class="ake-ui-card__badges v2cc-tag-meta">${badges}</div>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </section>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function resolveRewardItems(rewardId, rewardTable, itemTable) {
        const reward = rewardTable?.[rewardId];
        if (!reward || !reward.itemBundles) return [];
        return reward.itemBundles.map(bundle => {
            const item = itemTable?.[bundle.id];
            return {
                id: bundle.id,
                count: bundle.count,
                name: item?.name?.text || (getCurrentShowHidden() ? bundle.id : commonT('unknown')),
                iconId: item?.iconId || '',
                rarity: item?.rarity ?? 0
            };
        });
    }

    function rewardMaterialItem(item) {
        return {
            icon: item.iconId
                ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${item.iconId}.png`
                : '',
            name: item.name,
            count: item.count,
            element: 'a',
            attributes: window.__akeRouter?.entryAttributes?.('v3_item', item.id, item.name)
        };
    }

    function rewardMaterialList(items, className) {
        return window.AKEUI.materialItems(
            items.map(item => rewardMaterialItem(item)),
            `ake-ui-material__items ${className}`
        );
    }

    function renderLevelRewards(data) {
        const lt = data.contingencycontractleveltable;
        if (!lt || !lt.levelMap || !Object.keys(lt.levelMap).length) return '';
        const rewardTable = data.rewardtable || {};
        const itemTable = data.itemtable || {};
        const levels = Object.entries(lt.levelMap).sort((a, b) => (a[1].level || 0) - (b[1].level || 0));

        const acc = data.activitycontingencycontracttable;
        const scoreBand = acc?.scoreBand || [];
        const rewardRows = levels.map(([, lv], index) => {
            const items = resolveRewardItems(lv.firstReward, rewardTable, itemTable);
            const content = rewardMaterialList(items, 'v2cc-level-reward-list')
                || window.AKEUI.element('span', 'v2cc-reward-empty', getCurrentShowHidden() ? (lv.firstReward || '-') : commonT('unknown'));
            const score = scoreBand[index];
            return window.AKEUI.progressionRow({
                kind: 'cc-level-reward',
                stage: `Lv.${lv.level}`,
                content,
                action: window.AKEUI.badge({ label: score !== undefined
                    ? t('rewards.scoreThreshold', { score }) : t('rewards.allCompleted') })
            });
        });
        const rewardList = window.AKEUI.progressionList({
            className: 'v2cc-levels',
            rows: rewardRows
        });

        return `
            <div class="ake-ui-section">
                <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.levelRewards')}</h3></div>
                ${rewardList.outerHTML}
            </div>
        `;
    }

    function renderShopSection(data) {
        const sgt = data.shopgrouptable;
        const shopTable = data.shoptable || {};
        const goodsTable = data.shopgoodstable || {};
        const itemTable = data.itemtable || {};
        if (!sgt || !Object.keys(shopTable).length) return '';

        const groupName = sgt.shopGroupName?.text || (getCurrentShowHidden() ? sgt.shopGroupId : commonT('unknown'));
        const shopIds = sgt.shopIds || [];
        const currencyCache = {};

        function getCurrencyName(moneyId) {
            if (currencyCache[moneyId]) return currencyCache[moneyId];
            const item = itemTable[moneyId];
            const name = item?.name?.text || (getCurrentShowHidden() ? moneyId : commonT('unknown'));
            currencyCache[moneyId] = name;
            return name;
        }

        return `
            <div class="ake-ui-section">
                <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${window.AKEUI.entryLinkHtml({ plugin: 'v3_shop', id: sgt.shopGroupId, label: groupName, contentHtml: t('shop.title', { name: parseText(groupName) }) })}</h3></div>
                ${shopIds.map(sid => {
                    const shop = shopTable[sid];
                    if (!shop) return '';
                    const shopName = shop.shopName?.text || (getCurrentShowHidden() ? sid : commonT('unknown'));
                    const goodsIds = shop.shopGoodsIds || [];
                    const goods = goodsIds.map(gid => goodsTable[gid]).filter(Boolean);

                    return `
                        <div class="ake-ui-card" data-card-kind="cc-shop" data-density="regular">
                            <div class="ake-ui-card__header">
                                <span class="ake-ui-card__title">${parseText(shopName)}</span>
                                <span class="ake-ui-badge">${t('shop.goodsCount', { count: goods.length })}</span>
                            </div>
                            <div class="ake-ui-table-shell"><table class="ake-ui-table">
                                <thead><tr>
                                    <th class="col-icon" scope="col"></th>
                                    <th class="col-name" scope="col">${t('shop.item')}</th>
                                    <th class="col-price" scope="col">${t('shop.price')}</th>
                                    <th class="col-limit" scope="col">${t('shop.limit')}</th>
                                </tr></thead>
                                <tbody>
                                ${goods.map(g => {
                                    const rewardItems = resolveRewardItems(g.rewardId, data.rewardtable || {}, itemTable);
                                    const itemIcon = rewardItems.length ? rewardItems[0].iconId : '';
                                    const itemName = rewardItems.length
                                        ? rewardItems.map(r => window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: r.id, label: r.name, contentHtml: escapeHtml(r.name) + (r.count > 1 ? `<span class="v2cc-item-qty">×${r.count}</span>` : '') })).join(' + ')
                                        : `<span class="v2cc-goods-fallback">${escapeHtml(getCurrentShowHidden() ? (g.goodsTagId || g.goodsId) : commonT('unknown'))}</span>`;
                                    const currencyText = getCurrencyName(g.moneyId);
                                    const currencyName = window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: g.moneyId, label: currencyText, contentHtml: escapeHtml(currencyText) });
                                    const limitText = g.limitCount > 0 ? g.limitCount : '∞';
                                    const hasDiscount = g.cnDiscount > 0 && g.cnDiscount < 1;
                                    const actualPrice = hasDiscount ? Math.ceil(g.price * g.cnDiscount) : g.price;

                                    return `
                                        <tr>
                                            <td class="col-icon">${itemIcon ? `<img class="v2cc-goods-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${itemIcon}.png" alt="">` : ''}</td>
                                            <td class="col-name">${itemName}</td>
                                            <td class="col-price">${hasDiscount ? `<span class="v2cc-price-original">${g.price}</span> ` : ''}${actualPrice} ${currencyName}${hasDiscount ? ` <span class="v2cc-goods-discount">-${Math.round((1 - g.cnDiscount) * 100)}%</span>` : ''}</td>
                                            <td class="col-limit">${limitText}</td>
                                        </tr>
                                    `;
                                }).join('')}
                                </tbody>
                            </table></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderTaskGroups(data) {
        const tgt = data.activitycontingencycontracttaskgrouptable || {};
        const activityId = data.activitycontingencycontracttable?.activityId || data.contingencycontracttable?.activityId;
        const taskConfigMap = data.activityconditionalmultistagetaskconfigtable?.[activityId]?.TaskConfigMap || {};
        const groupIds = [...new Set(Object.values(taskConfigMap).map(task => task.taskGroupId || ''))];
        if (!groupIds.length) return '';
        const groups = groupIds.map(id => [id, { ...tgt[id], taskGroupId: id }])
            .sort((a, b) => (a[1].sortId ?? Infinity) - (b[1].sortId ?? Infinity));

        const rewardTable = data.rewardtable || {};
        const itemTable = data.itemtable || {};

        return `
            <div class="ake-ui-section">
                <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.tasks')}</h3></div>
                <div class="ake-ui-list">
                    ${groups.map(([, tg]) => {
                        const tgId = tg.taskGroupId;
                        const tasks = Object.values(taskConfigMap)
                            .filter(t => (t.taskGroupId || '') === tgId)
                            .sort((a, b) => (a.sortId || 0) - (b.sortId || 0));

                        return `
                            <section class="ake-ui-section">
                                <div class="ake-ui-section__header">
                                    ${tg.icon ? `<img class="ake-ui-section__icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/contingencycontract/${tg.icon}.png" alt="">` : ''}
                                    <span class="ake-ui-section__title">${tg.name?.text ? parseText(tg.name.text) : escapeHtml(getCurrentShowHidden() ? tgId : commonT('unknown'))}</span>
                                    <span class="ake-ui-badge">${t('tasks.count', { count: tasks.length })}</span>
                                    ${tg.canUpdate ? `<span class="ake-ui-badge" data-tone="added">${t('tasks.updatable')}</span>` : ''}
                                </div>
                                ${tasks.length ? `
                                    <div class="ake-ui-card-grid" data-size="regular">
                                        ${tasks.map(task => {
                                            const desc = task.desc?.text ? parseText(task.desc.text) : '';
                                            const rewards = resolveRewardItems(task.rewardId, rewardTable, itemTable);
                                            const rewardList = rewardMaterialList(rewards, 'v2cc-task-rewards');
                                            return `
                                                <div class="ake-ui-card" data-card-kind="cc-task" data-density="compact">
                                                    ${getCurrentShowHidden() ? `<div class="ake-ui-card__header"><span class="ake-ui-card__id">${escapeHtml(task.taskId)}</span></div>` : ''}
                                                    <div class="ake-ui-card__body">${desc || t('tasks.unnamed')}</div>
                                                    ${rewards.length ? `
                                                        <div class="v2cc-task-item-rewards">
                                                            <span class="v2cc-task-reward-label">${t('tasks.rewards')}</span>
                                                            ${rewardList?.outerHTML || ''}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                ` : `<div class="v2cc-task-empty">${t('tasks.empty')}</div>`}
                            </section>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    async function loadCcMaps() {
        try {
            const data = await window.akeLoadMaps();
            ccAttrMap = data.ATTR_MAP || {};
            const attrEn = data.ATTR_MAP_EN || {};
            Object.entries(attrEn).forEach(([id, name]) => { ccAttrNameToId[name] = parseInt(id, 10); });
        } catch {}
    }

    async function loadCcBuff(buffId, embeddedBuffData) {
        if (ccBuffCache[buffId] !== undefined) return ccBuffCache[buffId];
        if (embeddedBuffData && embeddedBuffData[buffId]) {
            ccBuffCache[buffId] = embeddedBuffData[buffId];
            return ccBuffCache[buffId];
        }
        try {
            const res = await (window.akeFetch || fetch)(`/public/Json/BuffData/${buffId}.json`);
            if (!res.ok) { ccBuffCache[buffId] = null; return null; }
            ccBuffCache[buffId] = await res.json();
            return ccBuffCache[buffId];
        } catch { ccBuffCache[buffId] = null; return null; }
    }

    function getBuffModifiers(buffId, blackboardOverrides) {
        const buff = ccBuffCache[buffId];
        if (!buff?.attributeModifier?.attributeModifiers?.length) return [];
        const bb = {};
        (buff.blackboard || []).forEach(b => { bb[b.key] = b.valueDouble ?? b.value ?? 0; });
        (blackboardOverrides || []).forEach(b => { bb[b.key] = b.valueFloat ?? b.valueDouble ?? b.value ?? 0; });
        return buff.attributeModifier.attributeModifiers.map(mod => {
            const attrType = ccAttrNameToId[mod.attributeType];
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

    function computeAttrWithModifiers(baseValue, modifiers, attrType) {
        return window.AKEStats.computeAttrWithModifiers(baseValue, modifiers, attrType);
    }

    function findTemplateId(instanceId, table) {
        if (table[instanceId]) return instanceId;
        let best = '';
        Object.keys(table).forEach(k => {
            if (instanceId.startsWith(k) && k.length > best.length) best = k;
        });
        return best || instanceId;
    }

    function getEnemyStatsAtLevel(attrTemplateData, enemyLevel, modifiers) {
        return window.AKEStats.getEnemyStatsAtLevel(attrTemplateData, enemyLevel, modifiers, {
            displayOrder: ATTR_DISPLAY_ORDER,
            getAttrName: attrType => ccAttrMap[attrType] || t('attributeFallback', { type: attrType }),
            includeModifierOnlyAttrs: false,
            excludeAttrTypes: LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES
        });
    }

    function getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers) {
        return window.AKEStats.getEnemyStatDetailsAtLevel(attrTemplateData, enemyLevel, modifiers, {
            displayOrder: ATTR_DISPLAY_ORDER,
            getAttrName: attrType => ccAttrMap[attrType] || t('attributeFallback', { type: attrType }),
            includeModifierOnlyAttrs: false,
            excludeAttrTypes: LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES
        });
    }

    function formatStatValue(value, detail) {
        const display = formatPlainAttrVal(value);
        return detail && window.renderRawValueTip ? window.renderRawValueTip(display, detail) : display;
    }

    function formatPlainAttrVal(val) {
        if (typeof val !== 'number') return val;
        let display;
        if (Math.abs(val) < 1 && val !== 0) display = (val * 100).toFixed(1) + '%';
        else display = Number.isInteger(val) ? val.toString() : val.toFixed(2);
        return display;
    }

    function formatAttrVal(val) {
        const display = formatPlainAttrVal(val);
        return window.renderRawValueTip ? window.renderRawValueTip(display, val) : display;
    }

    function formatModifierSummary(modifiers) {
        return window.AKEEnemyRenderer.summarizeModifiers(modifiers,
            type => ccAttrMap[type] || t('attributeFallback', { type }));
    }

    function renderModifierSources(groups) {
        return window.AKEEnemyRenderer.renderModifierSources(groups, formatModifierSummary,
            key => t(`modifierSources.${key}`));
    }

    function buildEnemyBuffTagsHtml(ownBuffs, libBuffs, extraTagBuffs) {
        const extraIds = (extraTagBuffs || []).map(t => t.buffId);
        const allBuffIds = [...new Set([...ownBuffs, ...libBuffs.map(b => b.buffId), ...extraIds])];
        if (!allBuffIds.length) return '';
        const buffBbMap = {};
        libBuffs.forEach(b => {
            if (!buffBbMap[b.buffId]) buffBbMap[b.buffId] = [];
            (b.blackboard || []).forEach(bb => {
                if (!buffBbMap[b.buffId].find(x => x.key === bb.key)) buffBbMap[b.buffId].push(bb);
            });
        });
        (extraTagBuffs || []).forEach(t => {
            if (!buffBbMap[t.buffId]) buffBbMap[t.buffId] = [];
            (t.blackboard || []).forEach(bb => {
                if (!buffBbMap[t.buffId].find(x => x.key === bb.key)) buffBbMap[t.buffId].push(bb);
            });
        });
        function bbVal(bbEntry) {
            return bbEntry.valueFloat ?? bbEntry.valueDouble ?? bbEntry.value ?? 0;
        }
        return `<div class="v2d-enemy-buffs v2cc-current-buffs">${allBuffIds.map(id => {
            const bb = buffBbMap[id] || [];
            const buff = ccBuffCache[id];
            const attrMods = buff?.attributeModifier?.attributeModifiers || [];
            const rows = [];
            attrMods.forEach(mod => {
                const label = mod.attributeType;
                const formula = mod.formulaItem;
                let val;
                if (mod.param.useBlackboardKey && mod.param.blackboardKey) {
                    const bbEntry = bb.find(b => b.key === mod.param.blackboardKey);
                    val = bbEntry ? bbVal(bbEntry) : mod.param.value;
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
                rows.push(`${escapeHtml(label)} ${escapeHtml(formula)} ${valueHtml}`);
            });
            bb.forEach(b => {
                if (!attrMods.find(m => m.param.useBlackboardKey && m.param.blackboardKey === b.key)) {
                    const rawVal = bbVal(b);
                    const valueHtml = window.renderRawValueTip ? window.renderRawValueTip(rawVal, rawVal, b.key) : rawVal;
                    rows.push(`${escapeHtml(b.key)}: ${valueHtml}`);
                }
            });
            const isCcTag = extraIds.includes(id);
            const cls = isCcTag ? 'v2d-buff-tag v2d-has-tip cc-tag-buff' : 'v2d-buff-tag v2d-has-tip';
            if (rows.length === 0) return window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id, label: id, className: isCcTag ? 'v2d-buff-tag cc-tag-buff' : 'v2d-buff-tag', contentHtml: escapeHtml(id) });
            const tipHtml = rows.map(r => `<div>${r}</div>`).join('');
            return window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id, label: id, className: `${cls} ake-ui-popover-anchor`, contentHtml: `${escapeHtml(id)}<span class="v2d-buff-tip ake-ui-popover" data-placement="top">${tipHtml}</span>` });
        }).join('')}</div>`;
    }

    function renderCcEnemyCard(enemyId, enemyLevel, dungeonId, dungeonData, libraryBuffs, scriptedBuffs) {
        const enemyConfig = dungeonData.enemyTable?.[enemyId] || {};
        const displayTable = dungeonData.enemyTemplateDisplayInfoTable || {};
        const attrTable = dungeonData.enemyAttributeTemplateTable || {};
        const templateId = enemyConfig.templateId || findTemplateId(enemyId, displayTable);
        const attrTemplateId = enemyConfig.attrTemplateId || findTemplateId(enemyId, attrTable);
        const displayInfo = displayTable[templateId] || {};
        const attrData = attrTable[attrTemplateId] || {};
        const name = displayInfo.name?.text || (getCurrentShowHidden() ? templateId : commonT('unknown'));
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
        if (enemyConfig.isDangerous) flags.push(`<span class="ake-ui-badge" data-tone="danger">${t('enemyFlags.dangerous')}</span>`);
        if (enemyConfig.showBigEffect) flags.push(`<span class="ake-ui-badge" data-tone="accent">${t('enemyFlags.globalEffect')}</span>`);
        if (enemyConfig.showBigHeadbar) flags.push(`<span class="ake-ui-badge" data-tone="muted">${t('enemyFlags.pinnedHealthBar')}</span>`);

        const showHidden = getCurrentShowHidden();
        const buffTagsHtml = showHidden
            ? buildEnemyBuffTagsHtml(ownBuffs, libBuffs, [])
            : renderModifierSources([
                ['born', [...inlineModifiers, ...ownBuffModifiers]],
                ['buff', libraryBuffModifiers],
                ['dungeon', scriptModifiers]
            ]);
        const scriptBuffTagsHtml = showHidden && (scriptedBuffs || []).length ? `<div class="v2d-enemy-buffs">${scriptedBuffs.map(row => window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id: row.buffId, label: row.buffId, className: 'v2d-buff-tag v2d-script-buff v2d-has-tip ake-ui-popover-anchor', contentHtml: `${escapeHtml(row.buffId)}<small>脚本</small><span class="v2d-buff-tip ake-ui-popover" data-placement="top"><div>条件性脚本 Buff · LevelScript ${escapeHtml(row.scriptId)}</div></span>` })).join('')}</div>` : '';

        const statState = window.AKEEnemyRenderer.calculateStats({
            attrData,
            level: enemyLevel,
            baseModifiers: allModifiers,
            scriptModifiers,
            getDetails: getEnemyStatDetailsAtLevel
        });
        return window.AKEEnemyRenderer.renderCard({
            dataAttributes: {
                dungeonId,
                enemyId,
                enemyLevel,
                libBuffs,
                scriptBuffs: scriptedBuffs || [],
                akeEntryPlugin: 'v3_enemy',
                akeEntryId: templateId,
                akeEntryLabel: name
            },
            iconSrc,
            name,
            nickname,
            level: enemyLevel,
            descriptionHtml: desc ? parseText(desc) : '',
            extraHtml: `${buffTagsHtml}${scriptBuffTagsHtml}`,
            flags,
            statState,
            formatStatValue,
            formatBaseValue: formatAttrVal
        });
    }

    function parseDungeonWaves(dungeon) {
        const sc = dungeon.SpawnerConfig;
        if (!sc || Object.keys(sc).length === 0) return null;
        const enemyTable = dungeon.enemyTable || {};
        const displayTable = dungeon.enemyTemplateDisplayInfoTable || {};
        const attrTable = dungeon.enemyAttributeTemplateTable || {};
        const allSpawners = [];
        Object.entries(sc).forEach(([configId, spawner]) => {
            const libMap = {};
            (spawner.enemyLibrary || []).forEach(lib => {
                libMap[lib.key] = lib;
            });
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
                        const name = disp.name?.text || (getCurrentShowHidden() ? templateId : commonT('unknown'));
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

    function renderSpawnMap(spawner) {
        const waves = spawner.waves;
        if (!waves || !waves.length) return '';

        let allX = [], allZ = [];
        waves.forEach(w => {
            (w.groups || []).forEach(g => {
                g.spawns.forEach(s => {
                    allX.push(s.position.x);
                    allZ.push(s.position.z);
                });
            });
        });
        const pad = 2;
        const halfX = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX))) + pad;
        const halfZ = Math.max(Math.abs(Math.min(...allZ)), Math.abs(Math.max(...allZ))) + pad;
        const minX = -halfX, maxX = halfX, minZ = -halfZ, maxZ = halfZ;
        const rangeX = maxX - minX || 1, rangeZ = maxZ - minZ || 1;

        function toPct(x, z) {
            return { left: ((x - minX) / rangeX * 100).toFixed(1), top: ((maxZ - z) / rangeZ * 100).toFixed(1) };
        }

        let mapSpotsHtml = '';
        waves.forEach((w, wi) => {
            const vis = wi === 0 ? '' : 'display:none;';

            const allSpawns = [];
            (w.groups || []).forEach((g, gi) => {
                const modeKey = { 'Parallel': 'parallel', 'Sequence': 'sequence', 'PartKilled': 'partKilled', 'AllKilled': 'allKilled', 'Deadline': 'deadline' }[g.groupMode];
                const modeLabel = modeKey ? t(`spawnModes.${modeKey}`) : (getCurrentShowHidden() ? g.groupMode : commonT('unknown'));
                let conditionText = '';
                let targetGroupKey = '';
                if (g.groupMode === 'PartKilled' && g.groupModeTargetKey) {
                    conditionText = t('spawnConditions.partKilled', { group: g.groupModeTargetKey, count: g.groupModeKillCount });
                    targetGroupKey = g.groupModeTargetKey;
                } else if (g.groupMode === 'AllKilled' && g.groupModeTargetKey) {
                    conditionText = t('spawnConditions.allKilled', { group: g.groupModeTargetKey });
                    targetGroupKey = g.groupModeTargetKey;
                }
                g.spawns.forEach(spawn => {
                    allSpawns.push({ spawn, group: g, modeLabel, conditionText, targetGroupKey });
                });
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
                    `<b>${escapeHtml(spawn.name)} ×${spawn.count} Lv.${spawn.level}</b>`,
                    getCurrentShowHidden() ? t('spawn.coordinates', { position: posStr, radius: randomStr }) : '',
                    getCurrentShowHidden() ? t('spawn.groupMode', { group: g.groupKey, mode: modeLabel, condition: conditionText ? ' · ' + conditionText : '' }) : modeLabel,
                    [delayStr, intervalStr, warnStr, faceStr].filter(Boolean).join(' · ')
                ].filter(Boolean);

                const offsetPct = (0.3 * 100 / (2 * halfX)).toFixed(2);
                const stackStyle = stackIdx > 0
                    ? `margin-left:${stackIdx * offsetPct}%;margin-top:-${stackIdx * offsetPct}%;z-index:${10 - stackIdx};`
                    : 'z-index:10;';

                mapSpotsHtml += `<div class="v2cc-map-spot" data-ake-popover-anchor tabindex="0" role="img" aria-label="${escapeHtml(`${spawn.name} ×${spawn.count} Lv.${spawn.level}`)}" data-wave="${wi}" data-group="${escapeHtml(g.groupKey)}" data-target-group="${escapeHtml(targetGroupKey)}" style="left:${pct.left}%;top:${pct.top}%;${vis}${stackStyle}">
                    <img class="v2cc-map-spot-icon" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${spawn.templateId}.png" alt="">
                    <div class="v2cc-map-tip ake-ui-popover" data-placement="top">${tipLines.map(l => `<div>${l}</div>`).join('')}</div>
                </div>`;
            });
        });

        const coordInfo = getCurrentShowHidden() ? `<div class="v2cc-map-coords">X: ${minX.toFixed(0)} ~ ${maxX.toFixed(0)}  Z: ${minZ.toFixed(0)} ~ ${maxZ.toFixed(0)}</div>` : '';
        const unitPct = (100 / (2 * halfX)).toFixed(2);

        return `<div class="v2cc-spawn-map-container">
            <div class="v2cc-spawn-map" style="--unit:${unitPct}%">
                <div class="v2cc-map-center"></div>
                ${mapSpotsHtml}
            </div>
            ${coordInfo}
        </div>`;
    }

    function renderSpawnerChevron() {
        return '<svg class="v2cc-spawner-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function renderDungeonSection(dungeonData) {
        if (!dungeonData || !dungeonData.dungeontable) return '';
        const dungeons = dungeonData.dungeontable;
        const dungeonIds = Object.keys(dungeons);
        if (!dungeonIds.length) return '';

        let html = '';
        dungeonIds.forEach(dgId => {
            const dg = dungeons[dgId];
            const name = dg.dungeonName?.text || (getCurrentShowHidden() ? dgId : commonT('unknown'));
            const desc = dg.dungeonDesc?.text ? parseText(dg.dungeonDesc.text) : '';
            const featureDesc = dg.featureDesc?.text ? parseText(dg.featureDesc.text) : '';
            const recommendLv = dg.recommendLv || '?';
            const seriesId = dg.dungeonSeriesId || '';

            const waveSpawners = parseDungeonWaves(dg);

            html += `<section class="ake-ui-section" data-card-kind="cc-dungeon">
                <div class="ake-ui-section__header">
                    <h4 class="ake-ui-section__title">${seriesId ? window.AKEUI.entryLinkHtml({ plugin: 'v3_dungeon', id: seriesId, label: name, contentHtml: escapeHtml(name) }) : escapeHtml(name)}</h4>
                    <span class="ake-ui-badge">${t('dungeon.recommendedLevel', { label: commonT('level'), level: recommendLv })}</span>
                </div>
                ${desc ? `<div class="ake-ui-section__body">${desc}</div>` : ''}
                ${featureDesc ? `<div class="v2cc-dungeon-feature">${featureDesc}</div>` : ''}`;

            if (waveSpawners) {
                waveSpawners.sort((a, b) => a.configId.localeCompare(b.configId));
                waveSpawners.forEach((sp, spIdx) => {
                    const mergedWaves = [];
                    sp.waves.forEach(w => {
                        const existing = mergedWaves.find(mw => mw.waveIdx === w.waveIdx);
                        if (existing) {
                            existing.groups.push(...w.groups);
                            existing.enemies.push(...w.enemies);
                            existing.maxAlive += w.maxAlive;
                            if (w.hasPause) existing.hasPause = true;
                            if (w.repeatable) existing.repeatable = true;
                        } else {
                            mergedWaves.push({ ...w, groups: [...w.groups], enemies: [...w.enemies] });
                        }
                    });

                    let totalWaves = mergedWaves.length, totalEnemies = 0;
                    mergedWaves.forEach(w => w.enemies.forEach(e => totalEnemies += e.count));

                    let waveDetailHtml = '';
                    mergedWaves.forEach((wave, wIdx) => {
                        waveDetailHtml += window.AKEUI.waveCard({
                            index: wIdx,
                            label: t('waves.number', { number: wave.waveIdx }),
                            active: wIdx === 0,
                            flags: [
                                wave.repeatable && t('waves.repeatable'),
                                wave.maxAlive > 0 && t('waves.aliveLimit', { count: wave.maxAlive }),
                                wave.hasPause && t('waves.externallyControlled')
                            ],
                            enemies: wave.enemies.map(e => ({
                                id: e.instanceId,
                                name: e.name,
                                count: e.count,
                                level: e.level,
                                iconSrc: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${e.templateId}.png`
                            }))
                        }).outerHTML;
                    });

                    const mergedSpawner = { ...sp, waves: mergedWaves };
                    const spawnMapHtml = renderSpawnMap(mergedSpawner);

                    const enemyLibBuffs = {};
                    const scriptedBuffs = dg.ScriptBuffsBySpawner?.[sp.configId] || [];
                    sp.waves.forEach(wave => {
                        wave.enemies.forEach(e => {
                            if (!enemyLibBuffs[e.instanceId]) enemyLibBuffs[e.instanceId] = [];
                            e.bornBuffList.forEach(b => {
                                if (!enemyLibBuffs[e.instanceId].find(x => x.buffId === b.buffId))
                                    enemyLibBuffs[e.instanceId].push(b);
                            });
                        });
                    });

                    const seenEnemies = new Set();
                    const uniqueEnemies = [];
                    sp.waves.forEach(wave => {
                        wave.enemies.forEach(e => {
                            if (!seenEnemies.has(e.instanceId)) {
                                seenEnemies.add(e.instanceId);
                                uniqueEnemies.push(e);
                            }
                        });
                    });

                    let enemiesHtml = '';
                    if (uniqueEnemies.length > 0) {
                        enemiesHtml = '<div class="v2d-enemy-list">';
                        uniqueEnemies.forEach(e => {
                            enemiesHtml += renderCcEnemyCard(e.instanceId, e.level, dgId, dg, enemyLibBuffs[e.instanceId] || [], scriptedBuffs);
                        });
                        enemiesHtml += '</div>';
                    }

                    const collapsed = spIdx > 0 ? ' collapsed' : '';
                    html += `<div class="v2cc-spawner-block${collapsed}">
                        <button class="v2cc-spawner-title" type="button" data-v2cc-spawner-toggle aria-expanded="${spIdx === 0}">
                            ${renderSpawnerChevron()}
                            ${t('waves.configuration', { number: spIdx + 1 })}
                            ${getCurrentShowHidden() ? `<span class="v2cc-spawner-id">${escapeHtml(sp.configId)}</span>` : ''}
                            <span class="v2cc-spawner-brief">${t('waves.brief', { waves: totalWaves, enemies: totalEnemies })}</span>
                        </button>
                        <div class="v2cc-spawner-body">
                            <div class="v2cc-wave-map-row">
                                <div class="v2d-wave-section">
                                    <div class="v2d-wave-detail v2d-wave-detail--cards">${waveDetailHtml}</div>
                                </div>
                                ${spawnMapHtml}
                            </div>
                            ${enemiesHtml}
                        </div>
                    </div>`;
                });
            } else {
                const enemyIds = dg.enemyIds || [];
                const enemyLevels = dg.enemyLevels || [];
                if (enemyIds.length > 0) {
                    html += `<div class="v2d-enemy-list">`;
                    enemyIds.forEach((eid, idx) => {
                        html += renderCcEnemyCard(eid, enemyLevels[idx] || recommendLv, dgId, dg, [], []);
                    });
                    html += '</div>';
                }
            }

            html += '<div class="v2cc-cc-tags"></div></section>';
        });
        return html;
    }

    function getCcDiagnostics(data) {
        const ids = Object.keys(getAllContractTags(data.contingencycontracttable));
        const tags = data.cctagtable || {};
        const activityId = data.activitycontingencycontracttable?.activityId || data.contingencycontracttable?.activityId;
        const tasks = Object.values(data.activityconditionalmultistagetaskconfigtable?.[activityId]?.TaskConfigMap || {});
        return {
            missingTags: ids.filter(id => !tags[id]),
            missingTerms: ids.filter(id => tags[id] && !Array.isArray(tags[id].tagTerms)),
            missingTaskGroups: [...new Set(tasks.map(task => task.taskGroupId || '').filter(id => !data.activitycontingencycontracttaskgrouptable?.[id]))]
        };
    }

    function renderDetail(data, game) {
        const acc = data.activitycontingencycontracttable;
        const cct = data.contingencycontracttable;
        const tagTable = data.cctagtable || {};
        const tagCount = Object.keys(getAllContractTags(cct)).length;
        const groupCount = cct && cct.contractGroupMap ? Object.keys(cct.contractGroupMap).length : 0;
        const showHidden = getCurrentShowHidden();
        const status = STATUS_ACCENTS[game.statusOrder] || 'permanent';
        const counts = window.AKEUI.fragment(`<div class="ake-ui-detail-badges">
            <span class="ake-ui-badge">${t('counts.indicatorGroups', { count: groupCount })}</span>
            <span class="ake-ui-badge">${t('counts.terms', { count: tagCount })}</span>
        </div>`);

        const detailHeader = window.AKEUI.detailHeader({
            layout: game.image ? 'showcase' : undefined,
            title: displayGameName(game),
            id: showHidden ? game.gameId : '',
            badges: [{ label: t(STATUS_NAMES[game.statusOrder] || 'statuses.permanent'),
                ...(status === 'permanent' ? { tone: 'muted' } : { attributes: { 'data-accent': 'status', 'data-accent-value': status } }) }],
            beforeTitle: game.activityId
                ? window.AKEUI.entryLink({ plugin: 'v3_activity', id: game.activityId, label: t('detail.activityLink'), content: t('detail.activityLink') })
                : null,
            subtitle: formatAvailability(game),
            content: counts,
            visual: game.image ? { src: game.image, alt: '', frame: true } : null
        });

        let html = `
            <div class="ake-ui-detail" data-detail-kind="cc">
                ${detailHeader?.outerHTML || ''}
                ${renderActivityInfo(acc)}
                ${renderContractGroups(cct, tagTable)}
                <div class="ake-ui-section" id="v2ccSelectedSummary"></div>
                ${currentDungeonData ? `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.dungeonEnemies')}</h3></div>${renderDungeonSection(currentDungeonData)}</div>` : ''}
                ${currentDungeonError ? `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.dungeonEnemies')}</h3></div><div class="ake-ui-state" data-state="error">${t('dungeon.loadFailed', { message: escapeHtml(currentDungeonError.message) })}</div></div>` : ''}
                ${renderLevelRewards(data)}
                ${renderShopSection(data)}
                ${renderTaskGroups(data)}
            </div>
        `;
        return html;
    }

    function updateSelectedSummary(tagTable) {
        const container = document.getElementById('v2ccSelectedSummary');
        if (!container) return;
        if (selectedTagIds.size === 0) {
            container.innerHTML = '';
            return;
        }
        const allValueMaps = buildAllTagValueMaps(tagTable);
        const items = Array.from(selectedTagIds).map(tid => {
            const td = tagTable[tid];
            if (!td) return '';
            const name = td.name?.text || (getCurrentShowHidden() ? `Tag ${tid}` : t('contract.unnamedTerm'));
            const bbMap = buildBlackboardValueMap(td.tagTerms || []);
            const desc = replacePlaceholders(td.desc?.text || '', bbMap, allValueMaps);
            const score = td.score ?? 0;
            return `
                <div class="v2cc-selected-row">
                    <span class="v2cc-selected-name">${escapeHtml(name)}</span>
                    <span class="v2cc-selected-score">+${score}</span>
                    ${desc ? `<span class="v2cc-selected-desc">${desc}</span>` : ''}
                </div>
            `;
        }).join('');
        container.innerHTML = `
            <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.selectedTermDetails')}</h3></div>
            <div class="v2cc-selected-list">${items}</div>
        `;
    }

    function getSelectedTagEnemyModifiers() {
        if (!currentData) return { modifiers: [], tagBuffs: [] };
        const tagTable = currentData.cctagtable || {};
        const modifiers = [];
        const tagBuffs = [];
        selectedTagIds.forEach(tid => {
            const td = tagTable[tid];
            if (!td || !td.tagTerms) return;
            const tagName = td.name?.text || `Tag ${tid}`;
            td.tagTerms.forEach(term => {
                if (term.termType !== 1) return;
                const bb = {};
                (term.blackboard || []).forEach(b => { bb[b.key] = b.value; });
                const buff = ccBuffCache[term.buffId];
                if (!buff?.attributeModifier?.attributeModifiers?.length) return;
                buff.attributeModifier.attributeModifiers.forEach(mod => {
                    const attrType = ccAttrNameToId[mod.attributeType];
                    if (attrType === undefined) return;
                    const mt = FORMULA_TO_MODTYPE[mod.formulaItem];
                    if (mt === undefined) return;
                    let val;
                    if (mod.param.useBlackboardKey && mod.param.blackboardKey) {
                        val = bb[mod.param.blackboardKey];
                        if (val === undefined || val === null) return;
                    } else { val = mod.param.value; }
                    modifiers.push({ attrType, attrValue: val, modifierType: mt });
                    const attrName = ccAttrMap[attrType] || t('attributeFallback', { type: attrType });
                    const formulaName = mod.formulaItem;
                    tagBuffs.push({ tagName, attrName, formulaName, value: val });
                });
            });
        });
        return { modifiers, tagBuffs };
    }

    function refreshDungeonEnemyStats() {
        if (!currentDungeonData) return;
        const enemyLists = document.querySelectorAll('[data-card-kind="cc-dungeon"] .v2d-enemy-list');
        if (!enemyLists.length) return;

        const dungeons = currentDungeonData.dungeontable || {};
        const { modifiers: tagModifiers } = getSelectedTagEnemyModifiers();

        const ccTagBuffs = [];
        selectedTagIds.forEach(tid => {
            const td = (currentData.cctagtable || {})[tid];
            if (!td || !td.tagTerms) return;
            td.tagTerms.forEach(term => {
                if (term.termType !== 1) return;
                ccTagBuffs.push({ buffId: term.buffId, blackboard: term.blackboard || [] });
            });
        });

        enemyLists.forEach(list => {
            list.querySelectorAll('[data-card-kind="enemy"]').forEach(card => {
                const dg = dungeons[card.dataset.dungeonId] || dungeons[Object.keys(dungeons)[0]];
                if (!dg) return;
                const enemyId = card.dataset.enemyId;
                const enemyLevel = parseInt(card.dataset.enemyLevel, 10) || 60;
                if (!enemyId) return;

                const enemyConfig = dg.enemyTable?.[enemyId] || {};
                const attrTable = dg.enemyAttributeTemplateTable || {};
                const attrTemplateId = enemyConfig.attrTemplateId || findTemplateId(enemyId, attrTable);
                const attrData = attrTable[attrTemplateId] || {};
                const inlineModifiers = enemyConfig.attrModifiers || [];

                const libBuffs = JSON.parse(card.dataset.libBuffs || '[]');
                const ownBuffs = enemyConfig.bornBuffs || [];
                const ownBuffModifiers = ownBuffs.flatMap(id => getBuffModifiers(id, []));
                const libraryBuffModifiers = libBuffs.flatMap(b => getBuffModifiers(b.buffId, b.blackboard));
                const buffModifiers = [...ownBuffModifiers, ...libraryBuffModifiers];
                const allModifiers = [...inlineModifiers, ...buffModifiers, ...tagModifiers];
                const scriptBuffs = JSON.parse(card.dataset.scriptBuffs || '[]');
                const scriptModifiers = scriptBuffs.flatMap(b => getBuffModifiers(b.buffId, b.blackboard));

                const statResult = getEnemyStatDetailsAtLevel(attrData, enemyLevel, allModifiers);
                const stats = statResult?.values || {};
                const attrGrid = card.querySelector('.v2d-attr-grid');
                if (attrGrid && stats) {
                    let statsHtml = '';
                    Object.entries(stats).forEach(([key, val]) => {
                        statsHtml += `<div class="v2d-attr-item"><span class="v2d-attr-key">${key}</span><span class="v2d-attr-val">${formatStatValue(val, statResult.details[key])}</span></div>`;
                    });
                    attrGrid.innerHTML = statsHtml;
                }
                const scriptResult = scriptModifiers.length ? getEnemyStatDetailsAtLevel(attrData, enemyLevel, [...allModifiers, ...scriptModifiers]) : null;
                const scriptStats = scriptResult?.values || null;
                const changedScriptStats = scriptStats ? Object.fromEntries(Object.entries(scriptStats).filter(([key, val]) => val !== stats?.[key])) : {};
                const scriptStatsEl = card.querySelector('.v2d-script-stats');
                const scriptStatsHtml = Object.keys(changedScriptStats).length ? `<div class="v2d-script-stats"><b>脚本 Buff 生效时</b>${Object.entries(changedScriptStats).map(([key, val]) => `<span>${escapeHtml(key)} ${formatAttrVal(stats[key])} → ${formatStatValue(val, scriptResult.details[key])}</span>`).join('')}</div>` : '';
                if (scriptStatsEl) scriptStatsEl.outerHTML = scriptStatsHtml;
                else if (scriptStatsHtml) card.insertAdjacentHTML('beforeend', scriptStatsHtml);

                const newBuffTagsHtml = getCurrentShowHidden()
                    ? buildEnemyBuffTagsHtml(ownBuffs, libBuffs, ccTagBuffs)
                    : renderModifierSources([
                        ['born', [...inlineModifiers, ...ownBuffModifiers]],
                        ['buff', libraryBuffModifiers],
                        ['dungeon', scriptModifiers],
                        ['term', tagModifiers]
                    ]);
                const oldBuffTags = card.querySelector('.v2cc-current-buffs');
                if (newBuffTagsHtml) {
                    if (oldBuffTags) {
                        oldBuffTags.outerHTML = newBuffTagsHtml;
                    } else {
                        const refEl = card.querySelector('.ake-ui-card__badges, .v2d-attr-grid');
                        if (refEl) refEl.insertAdjacentHTML('beforebegin', newBuffTagsHtml);
                    }
                } else if (oldBuffTags) {
                    oldBuffTags.remove();
                }
            });
        });

        const tagTable = currentData.cctagtable || {};
        const allValueMaps = buildAllTagValueMaps(tagTable);
        const ccTagDescs = [];
        selectedTagIds.forEach(tid => {
            const td = tagTable[tid];
            if (!td || !td.tagTerms) return;
            const hasEnemyTerm = td.tagTerms.some(t => t.termType === 1);
            if (!hasEnemyTerm) return;
            const tagName = td.name?.text || `Tag ${tid}`;
            const bbMap = buildBlackboardValueMap(td.tagTerms || []);
            const desc = replacePlaceholders(td.desc?.text || '', bbMap, allValueMaps);
            ccTagDescs.push({ tagName, desc });
        });

        document.querySelectorAll('.v2cc-cc-tags').forEach(container => {
            if (ccTagDescs.length) {
                container.innerHTML = ccTagDescs.map(d =>
                    `<div class="v2cc-cc-tag-line"><span class="v2cc-cc-tag-name">${parseText(d.tagName)}</span>${d.desc ? `<span class="v2cc-cc-tag-desc">${d.desc}</span>` : ''}</div>`
                ).join('');
                container.hidden = false;
            } else {
                container.innerHTML = '';
                container.hidden = true;
            }
        });
    }

    function refreshInteractiveSection() {
        if (!currentData || !currentGame) return;
        const cct = currentData.contingencycontracttable;
        const tagTable = currentData.cctagtable || {};
        if (!cct) return;
        const allTags = getAllContractTags(cct);

        const totalEl = document.querySelector('.v2cc-score-panel-value');
        const countEl = document.querySelector('.v2cc-score-panel-count');
        if (totalEl) totalEl.textContent = computeTotalScore(selectedTagIds, tagTable);
        if (countEl) countEl.textContent = t('score.selectedTerms', { count: selectedTagIds.size });

        document.querySelectorAll('[data-card-kind="cc-tag"][data-tag-id]').forEach(card => {
            const tid = card.dataset.tagId;
            const tag = allTags[tid];
            if (!tag) return;
            const isSelected = selectedTagIds.has(tid);
            const selCheck = isTagSelectable(tid, selectedTagIds, allTags);
            const stateClass = isSelected ? 'selected' : (selCheck.ok ? 'selectable' : 'locked');

            card.classList.remove('selected', 'selectable', 'locked', 'conflict-locked');
            card.classList.add(stateClass);
            card.classList.toggle('conflict-locked', !isSelected && selCheck.kind === 'conflict');
            card.setAttribute('aria-checked', String(isSelected));
            card.setAttribute('aria-disabled', String(!selCheck.ok && !isSelected));
            if (!isSelected && !selCheck.ok) card.setAttribute('aria-description', selCheck.reason);
            else card.removeAttribute('aria-description');

            const checkEl = card.querySelector('.v2cc-tag-check');
            if (checkEl) checkEl.textContent = isSelected ? '\u2713' : '';

            const badges = card.querySelectorAll('.v2cc-tag-badge');
            const heldKeys = getAvailableKeys(selectedTagIds, allTags);
            badges.forEach(badge => {
                if (badge.classList.contains('key') && tag.keyId) {
                    badge.classList.toggle('held', heldKeys.has(badge.dataset.keyId));
                }
                if (badge.classList.contains('lock') && badge.dataset.lockIds) {
                    badge.classList.toggle('held', badge.dataset.lockIds.split('|').every(lid => heldKeys.has(lid)));
                }
            });
        });

        updateSelectedSummary(tagTable);
        refreshDungeonEnemyStats();
    }

    function bindTagEvents() {
        document.querySelectorAll('[data-v2cc-spawner-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                const block = button.closest('.v2cc-spawner-block');
                if (!block) return;
                const collapsed = block.classList.toggle('collapsed');
                button.setAttribute('aria-expanded', String(!collapsed));
            });
        });
        const cct = currentData ? currentData.contingencycontracttable : null;
        if (!cct) return;
        const allTags = getAllContractTags(cct);

        document.querySelectorAll('[data-card-kind="cc-tag"][data-tag-id]').forEach(card => {
            const toggleCard = () => {
                const tid = card.dataset.tagId;
                if (selectedTagIds.has(tid)) {
                    selectedTagIds.delete(tid);
                    cascadeDeselect(selectedTagIds, allTags);
                } else {
                    const check = isTagSelectable(tid, selectedTagIds, allTags);
                    if (!check.ok) return;
                    selectedTagIds.add(tid);
                }
                refreshInteractiveSection();
            };
            card.addEventListener('click', toggleCard);
            card.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleCard();
            });

            const highlightRelated = () => {
                const tid = card.dataset.tagId;
                if (card.classList.contains('locked')) {
                    const tag = allTags[tid];
                    if (!tag) return;
                    if (tag.conflictId) {
                        document.querySelectorAll('[data-card-kind="cc-tag"][data-tag-id]').forEach(other => {
                            if (other === card) return;
                            const oTag = allTags[other.dataset.tagId];
                            if (oTag && oTag.conflictId === tag.conflictId) {
                                other.classList.add('highlight-conflict');
                            }
                        });
                    }
                    if (tag.lockIds && tag.lockIds.length > 0) {
                        document.querySelectorAll('[data-card-kind="cc-tag"][data-tag-id]').forEach(other => {
                            if (other === card) return;
                            const oTag = allTags[other.dataset.tagId];
                            if (oTag && oTag.keyId && tag.lockIds.includes(oTag.keyId)) {
                                other.classList.add('highlight-key');
                            }
                        });
                    }
                }
            };

            const clearHighlight = () => {
                document.querySelectorAll('.highlight-conflict, .highlight-key').forEach(el => {
                    el.classList.remove('highlight-conflict', 'highlight-key');
                });
            };
            card.addEventListener('mouseenter', highlightRelated);
            card.addEventListener('focus', highlightRelated);
            card.addEventListener('mouseleave', clearHighlight);
            card.addEventListener('blur', clearHighlight);
        });

        const resetBtn = document.getElementById('v2ccResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                selectedTagIds.clear();
                refreshInteractiveSection();
            });
        }
    }

    async function refreshModule() {
        const list = document.getElementById('v2ccList');
        const detail = document.getElementById('v2ccDetail');
        if (!list || !detail) return;

        const showHidden = getCurrentShowHidden();
        allGames = await loadGameManifest(showHidden);
        renderGameList();
    }

    async function initModule() {
        if (isInitialized) return;
        isInitialized = true;
        if (window.configLoaded) await window.configLoaded;

        if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
        if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
            if (e.target === mobileOverlay) closeMobileList();
        });

        window.addEventListener('globalConfigChanged', () => {
            searchTerm = '';
            const si = document.getElementById('v2ccSearchInput');
            if (si) si.value = '';
            refreshModule();
        });

        document.getElementById('v2ccSearchInput')?.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderGameList();
        });

        function adjustTipPosition(spot, map) {
            const tip = spot.querySelector('.v2cc-map-tip');
            if (!tip) return;
            const mapRect = map.getBoundingClientRect();
            const spotRect = spot.getBoundingClientRect();
            const spotTop = spotRect.top - mapRect.top;
            tip.dataset.placement = spotTop < 60 ? 'bottom' : 'top';
        }

        function switchWave(wi, spawnerBody) {
            const map = spawnerBody.querySelector('.v2cc-spawn-map');
            spawnerBody.querySelectorAll('.v2d-wave-line').forEach(l => {
                const active = l.dataset.waveIdx === wi;
                window.AKEUI.setWaveCardActive(l, active);
            });
            if (!map) return;
            map.querySelectorAll('.v2cc-map-spot').forEach(spot => {
                spot.style.display = spot.dataset.wave === wi ? '' : 'none';
            });
        }

        function clearHighlights(spawnerBody) {
            if (!spawnerBody) return;
            spawnerBody.querySelectorAll('.v2cc-map-spot').forEach(s => {
                s.classList.remove('group-highlight', 'target-highlight');
            });
            spawnerBody.querySelectorAll('.v2d-wave-enemy').forEach(e => {
                e.classList.remove('enemy-highlight', 'enemy-target-highlight');
            });
        }

        document.addEventListener('click', (e) => {
            const waveLine = e.target.closest('.v2d-wave-line');
            if (waveLine) {
                const spawnerBody = waveLine.closest('.v2cc-spawner-body');
                if (!spawnerBody) return;
                const wi = waveLine.dataset.waveIdx;
                if (wi !== undefined) switchWave(wi, spawnerBody);
                return;
            }

            const waveEnemy = e.target.closest('.v2d-wave-enemy');
            if (waveEnemy) {
                const spawnerBody = waveEnemy.closest('.v2cc-spawner-body');
                if (!spawnerBody) return;
                const wi = waveEnemy.dataset.waveIdx;
                const eid = waveEnemy.dataset.enemyId;
                if (wi !== undefined) {
                    switchWave(wi, spawnerBody);
                    const map = spawnerBody.querySelector('.v2cc-spawn-map');
                    if (map) {
                        clearHighlights(spawnerBody);
                        map.querySelectorAll(`.v2cc-map-spot[data-wave="${wi}"]`).forEach(spot => {
                            if (spot.dataset.group) {
                                const spots = map.querySelectorAll(`.v2cc-map-spot[data-wave="${wi}"][data-group="${spot.dataset.group}"]`);
                                if (spots.length) {
                                    const icon = spots[0].querySelector('.v2cc-map-spot-icon');
                                    if (icon && icon.src && icon.src.includes(eid)) {
                                        spots.forEach(s => s.classList.add('group-highlight'));
                                    }
                                }
                            }
                        });
                    }
                }
                return;
            }
        });

        document.addEventListener('mouseover', (e) => {
            const spot = e.target.closest('.v2cc-map-spot');
            if (spot) {
                const map = spot.closest('.v2cc-spawn-map');
                const spawnerBody = spot.closest('.v2cc-spawner-body');
                if (!map) return;
                adjustTipPosition(spot, map);

                const groupKey = spot.dataset.group;
                const targetGroup = spot.dataset.targetGroup;
                const wi = spot.dataset.wave;
                map.querySelectorAll('.v2cc-map-spot').forEach(s => {
                    s.classList.remove('group-highlight', 'target-highlight');
                    if (s.dataset.group === groupKey && s !== spot) s.classList.add('group-highlight');
                    if (targetGroup && s.dataset.group === targetGroup) s.classList.add('target-highlight');
                });
                if (spawnerBody) {
                    spawnerBody.querySelectorAll(`.v2d-wave-enemy[data-wave-idx="${wi}"]`).forEach(we => {
                        const iconSrc = we.querySelector('.v2d-wave-icon')?.src || '';
                        const spotIconSrc = spot.querySelector('.v2cc-map-spot-icon')?.src || '';
                        if (iconSrc && spotIconSrc && iconSrc === spotIconSrc) {
                            we.classList.add('enemy-highlight');
                        }
                    });
                }
                return;
            }

            const waveEnemy = e.target.closest('.v2d-wave-enemy');
            if (waveEnemy) {
                const spawnerBody = waveEnemy.closest('.v2cc-spawner-body');
                if (!spawnerBody) return;
                const map = spawnerBody.querySelector('.v2cc-spawn-map');
                if (!map) return;
                const wi = waveEnemy.dataset.waveIdx;
                const iconSrc = waveEnemy.querySelector('.v2d-wave-icon')?.src || '';
                map.querySelectorAll(`.v2cc-map-spot[data-wave="${wi}"]`).forEach(spot => {
                    const spotIconSrc = spot.querySelector('.v2cc-map-spot-icon')?.src || '';
                    if (iconSrc && spotIconSrc && iconSrc === spotIconSrc) {
                        spot.classList.add('group-highlight');
                        const groupKey = spot.dataset.group;
                        const targetGroup = spot.dataset.targetGroup;
                        map.querySelectorAll('.v2cc-map-spot').forEach(s => {
                            if (s.dataset.group === groupKey && s !== spot) s.classList.add('group-highlight');
                            if (targetGroup && s.dataset.group === targetGroup) s.classList.add('target-highlight');
                        });
                    }
                });
                waveEnemy.classList.add('enemy-highlight');
                return;
            }
        });

        document.addEventListener('mouseout', (e) => {
            const spot = e.target.closest('.v2cc-map-spot');
            const waveEnemy = e.target.closest('.v2d-wave-enemy');
            if (!spot && !waveEnemy) return;
            const spawnerBody = (spot || waveEnemy)?.closest('.v2cc-spawner-body');
            if (spawnerBody) clearHighlights(spawnerBody);
        });

        await refreshModule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModule);
    } else {
        initModule();
    }
})();
