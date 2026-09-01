(function() {
    const t = window.akeI18n.scope('modules.weapon');
    const commonT = window.akeI18n.scope('common');
    let allWeapons = [];
    let rawAllWeapons = [];
    let activeWeaponId = null;
    let isInitialized = false;
    let weaponLevelsToShow = null;
    let showAllWeaponLevels = false;
    let searchTerm = '';
    let currentWeaponData = null;
    let currentWeapon = null;
    let selectedRarities = new Set();
    let selectedTypes = new Set();
    const selectedTagDimensions = [new Set(), new Set(), new Set()];

    const IMAGE_BASE_PATH = '/public/images/';
    const WEAPON_TYPE_KEY_MAP = { 1: 'oneHandedSword', 2: 'artsUnit', 3: 'twoHandedSword', 5: 'polearm', 6: 'handcannon' };

    function getCurrentShowHidden() {
        return window.akeData?.getConfig().showHidden ?? false;
    }
    function parseText(text) {
        const normalized = typeof text === 'string' ? text.replace(/\\r\\n|\\n|\\r/g, '\n') : text;
        return window.parseText(normalized, IMAGE_BASE_PATH);
    }
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    }
    function parseLevelInput(input, maxLevel = 90) {
        if (!input || !input.trim()) return [];
        return input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLevel);
    }

    function getWeaponTypeName(weaponType, unknownKey = 'unknown') {
        const key = WEAPON_TYPE_KEY_MAP[weaponType];
        return key ? t(`weaponTypes.${key}`) : t(unknownKey);
    }

    function weaponTagValues(weapon) {
        const dimensions = [new Set(), new Set(), new Set()];
        (weapon.weaponTags || []).forEach(tag => String(tag).split('+').forEach(value => {
            const dimension = Number(weapon.weaponTagMeta?.[value]?.dimension);
            if (Number.isInteger(dimension) && dimensions[dimension]) dimensions[dimension].add(value);
        }));
        return dimensions;
    }

    function filterWeapons(weapons) {
        return weapons.filter(w => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!(w.name && w.name.toLowerCase().includes(term)) &&
                    !(w.weaponId && w.weaponId.toLowerCase().includes(term))) return false;
            }
            if (selectedRarities.size > 0 && !selectedRarities.has(w.rarity)) return false;
            if (selectedTypes.size > 0 && !selectedTypes.has(w.weaponType)) return false;
            if (w.rarity >= 4) {
                const dimensions = weaponTagValues(w);
                for (let index = 0; index < selectedTagDimensions.length; index++) {
                    const selected = selectedTagDimensions[index];
                    if (selected.size && ![...dimensions[index]].some(value => selected.has(value))) return false;
                }
            } else if (selectedTagDimensions.some(set => set.size)) return false;
            return true;
        });
    }

    function weaponTagLabel(value) {
        const source = allWeapons.find(weapon => weapon.weaponTagMeta?.[value]);
        return source?.weaponTagMeta?.[value]?.label || value;
    }

    function generateFilterButtons() {
        const rc = document.getElementById('v2wpnRarityFilter');
        const tc = document.getElementById('v2wpnTypeFilter');
        const tagContainers = [0, 1, 2].map(index => document.getElementById(`v2wpnTagFilter${index}`));
        if (!rc || !tc) return;
        const filterPanel = rc.closest('.ake-ui-filter');
        const updateFilterSummary = () => {
            const count = selectedRarities.size + selectedTypes.size + selectedTagDimensions.reduce((sum, set) => sum + set.size, 0);
            window.AKEUI?.updateFilterPanel(filterPanel, {
                summary: count ? commonT('filterCount', { count }) : commonT('filter')
            });
        };

        const existR = new Set(allWeapons.map(w => w.rarity));
        rc.innerHTML = '';
        for (let r = 1; r <= 6; r++) {
            if (!existR.has(r)) continue;
            const btn = window.AKEUI.filterButton({
                label: commonT('rarityStars', { rarity: r }),
                pressed: selectedRarities.has(r),
                onChange: pressed => {
                    pressed ? selectedRarities.add(r) : selectedRarities.delete(r);
                    updateFilterSummary();
                    renderWeaponList();
                }
            });
            rc.appendChild(btn);
        }

        const existT = new Set(allWeapons.map(w => w.weaponType));
        tc.innerHTML = '';
        for (const [tid] of Object.entries(WEAPON_TYPE_KEY_MAP)) {
            const id = parseInt(tid, 10);
            if (!existT.has(id)) continue;
            const btn = window.AKEUI.filterButton({
                label: getWeaponTypeName(id),
                pressed: selectedTypes.has(id),
                onChange: pressed => {
                    pressed ? selectedTypes.add(id) : selectedTypes.delete(id);
                    updateFilterSummary();
                    renderWeaponList();
                }
            });
            tc.appendChild(btn);
        }
        tagContainers.forEach((container, index) => {
            if (!container) return;
            const values = new Map();
            allWeapons.filter(w => w.rarity >= 4).forEach(w => weaponTagValues(w)[index].forEach(value => {
                const meta = w.weaponTagMeta?.[value] || {};
                if (!values.has(value)) values.set(value, meta);
            }));
            container.innerHTML = '';
            [...values.entries()].sort((a, b) => Number(a[1].sort || 0) - Number(b[1].sort || 0) || a[0].localeCompare(b[0])).forEach(([value]) => container.appendChild(window.AKEUI.filterButton({
                label: weaponTagLabel(value), pressed: selectedTagDimensions[index].has(value), onChange: pressed => {
                    pressed ? selectedTagDimensions[index].add(value) : selectedTagDimensions[index].delete(value);
                    updateFilterSummary(); renderWeaponList();
                }
            })));
        });
        updateFilterSummary();
    }

    const mobileBtn = document.getElementById('v2wpnMobileListBtn');
    const mobileOverlay = document.getElementById('v2wpnMobileListOverlay');
    const mobileContent = document.getElementById('v2wpnMobileListContent');

    function createWeaponDirectoryItem(weapon, options = {}) {
        const item = window.AKEUI.directoryItem({
            layout: 'entity',
            title: weapon.name,
            id: weapon.weaponId,
            icon: { src: weapon.icon || '', alt: '' },
            meta: [{ label: getWeaponTypeName(weapon.weaponType), kind: 'weapon-type' }],
            accent: { type: 'rarity', value: weapon.rarity || 1 },
            active: options.active,
            attributes: { 'data-weapon-id': weapon.weaponId },
            onSelect: options.onSelect
        });
        window.AKEModuleOverview?.markVersionChange(item, weapon);
        return item;
    }

    function buildMobileList() {
        const filtered = filterWeapons(allWeapons);
        mobileContent.innerHTML = '';
        filtered.forEach(w => {
            const item = createWeaponDirectoryItem(w, {
                active: w.weaponId === activeWeaponId,
                onSelect: () => {
                    activeWeaponId = w.weaponId;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_weapon', w.weaponId);
                    loadWeaponDetail(w, document.getElementById('v2wpnDetail'));
                    closeMobileList();
                    const desktopList = document.getElementById('v2wpnList');
                    const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-weapon-id="${CSS.escape(w.weaponId)}"]`);
                    if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                }
            });
            mobileContent.appendChild(item);
        });
    }
    function openMobileList() { buildMobileList(); mobileOverlay.classList.add('is-open'); mobileOverlay.setAttribute('aria-hidden', 'false'); }
    function closeMobileList() { mobileOverlay.classList.remove('is-open'); mobileOverlay.setAttribute('aria-hidden', 'true'); }
    if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
    if (mobileOverlay) mobileOverlay.addEventListener('click', e => { if (e.target === mobileOverlay) closeMobileList(); });

    async function loadWeaponManifest(showHidden) {
        try {
            const res = await (window.akeFetch || fetch)('/public/CH/v2_weapon/manifest.json');
            if (!res.ok) throw new Error('无法加载武器清单');
            const all = await res.json();
        rawAllWeapons = all;
            let weapons = showHidden ? all : all.filter(w => !w.hidden);
            weapons.sort((a, b) => (a.priority || 999) - (b.priority || 999));
            return weapons;
        } catch (err) {
            console.error('加载武器清单失败:', err);
            return [];
        }
    }

    function renderWeaponOverview(items, container) {
        window.AKEModuleOverview.render(container, {
            title: t('overview.title'), description: t('overview.description'),
            group: item => ({ id: String(item.weaponType), name: getWeaponTypeName(item.weaponType, 'unknownType'), order: Number(item.weaponType) }),
            onReset: () => { activeWeaponId = null; },
            onSelect: item => { activeWeaponId = item.weaponId; renderWeaponList(); },
            sidebarSelector: item => `.ake-ui-directory__item[data-weapon-id="${CSS.escape(item.weaponId)}"]`,
            items: items.map(item => ({ ...item, id: item.weaponId, image: item.icon, fallback: t('overview.fallback') }))
        });
    }

    function renderWeaponList() {
        const container = document.getElementById('v2wpnListItems');
        const detailContainer = document.getElementById('v2wpnDetail');
        if (!container) return;

        const filtered = filterWeapons(allWeapons);
        container.innerHTML = '';
        if (filtered.length === 0) {
            container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
            if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
            activeWeaponId = null;
            return;
        }

        filtered.forEach((w, index) => {
            const item = createWeaponDirectoryItem(w, {
                active: w.weaponId === activeWeaponId
                    || (!activeWeaponId && index === 0 && !window.AKEModuleOverview?.isActive('weapon')),
                onSelect: () => {
                    window.AKEUI.setDirectoryItemActive(container, item);
                    activeWeaponId = w.weaponId;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_weapon', w.weaponId);
                    loadWeaponDetail(w, detailContainer);
                }
            });
            container.appendChild(item);
        });

        if (window.__deepLinkId) {
            const deepItem = filtered.find(c => c.weaponId === window.__deepLinkId);
            if (deepItem) {
                activeWeaponId = deepItem.weaponId;
            } else {
                const existsInRaw = rawAllWeapons.some(c => c.weaponId === window.__deepLinkId);
                if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                    window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                }
            }
            window.__deepLinkId = null;
        }

        const activeExists = filtered.some(w => w.weaponId === activeWeaponId);
        if (!activeExists && filtered.length > 0) {
            if (window.AKEModuleOverview?.isActive('weapon')) {
                activeWeaponId = null;
                renderWeaponOverview(filtered, detailContainer);
                return;
            }
            activeWeaponId = filtered[0].weaponId;
            const f = container.querySelector('.ake-ui-directory__item');
            if (f) window.AKEUI.setDirectoryItemActive(container, f);
            if (window.__akeRouter) window.__akeRouter.updateUrl('v2_weapon', activeWeaponId);
            loadWeaponDetail(filtered[0], detailContainer);
        } else if (activeExists) {
            const aw = filtered.find(w => w.weaponId === activeWeaponId);
            if (aw) {
                const ad = container.querySelector(`.ake-ui-directory__item[data-weapon-id="${activeWeaponId}"]`);
                if (ad) window.AKEUI.setDirectoryItemActive(container, ad);
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_weapon', activeWeaponId);
                loadWeaponDetail(aw, detailContainer);
            }
        }
    }

    function replacePlaceholders(desc, valueMap) {
        const lowerValueMap = {};
        for (const [key, val] of Object.entries(valueMap)) {
            lowerValueMap[key.toLowerCase()] = val;
        }
        return desc.replace(/\{([^}]+)\}/g, (match, p1) => {
            const parts = p1.split(':');
            const expr = parts[0].replace(/\s+/g, '');
            const format = parts[1] ? parts[1].trim() : '';
            const varNames = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
            const missingVar = varNames.find(name => !(name.toLowerCase() in lowerValueMap));
            if (missingVar) return match;
            let evalExpr = expr;
            for (const name of varNames) {
                const value = lowerValueMap[name.toLowerCase()];
                evalExpr = evalExpr.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${value})`);
            }
            let result;
            try { result = new Function('return ' + evalExpr)(); } catch (e) { return match; }
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
        });
    }

    function renderSkills(data) {
        const basicTable = data.weaponbasictable || {};
        const skillIds = basicTable.weaponSkillList || [];
        const skillPatch = data.skillpatchtable || {};
        if (skillIds.length === 0) return '';

        const skills = skillIds.map(skillId => {
            const bundle = skillPatch[skillId]?.SkillPatchDataBundle || [];
            if (!bundle.length) return null;
            return {
                name: bundle[0]?.skillName?.text || skillId,
                bundle
            };
        }).filter(Boolean);
        if (!skills.length) return '';

        const dataRanks = Array.from(new Set(skills.flatMap(skill => skill.bundle
            .map(rank => Number(rank.level))
            .filter(Number.isFinite)))).sort((a, b) => a - b);
        const rankCount = Math.max(...skills.map(skill => skill.bundle.length));
        const ranks = dataRanks.length
            ? dataRanks
            : Array.from({ length: rankCount }, (_, index) => index + 1);
        const rankRows = ranks.map((rankLevel, rankIndex) => `
            <tr>
                <th scope="row">${rankLevel}</th>
                ${skills.map(skill => {
                    const rank = dataRanks.length
                        ? skill.bundle.find(entry => Number(entry.level) === rankLevel)
                        : skill.bundle[rankIndex];
                    if (!rank) return '<td>-</td>';
                    const valueMap = {};
                    (rank.blackboard || []).forEach(entry => { valueMap[entry.key] = entry.value; });
                    const description = rank.description?.text || '';
                    const processed = parseText(replacePlaceholders(description, valueMap));
                    return `<td><div class="weapon-skill-rank-copy">${processed || '-'}</div></td>`;
                }).join('')}
            </tr>
        `).join('');

        return `
            <section class="ake-ui-section weapon-skill-section">
                <div class="ake-ui-section__header">
                    <h3 class="ake-ui-section__title">${t('sections.skillData')}</h3>
                </div>
                <div class="ake-ui-table-shell weapon-skill-table-shell">
                    <table class="ake-ui-table weapon-skill-table">
                        <thead>
                            <tr>
                                <th scope="col">Rank</th>
                                ${skills.map(skill => `<th scope="col">${escapeHtml(skill.name)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>${rankRows}</tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function weaponMaterialItem(item, itemTable, overrides = {}) {
        const itemData = itemTable[item.id] || {};
        return {
            icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${itemData.iconId || item.id}.png`,
            name: overrides.name || itemData.name?.text || item.id,
            count: overrides.count ?? item.count,
            description: itemData.desc?.text || ''
        };
    }

    function weaponMaterialPopover(costs, itemTable) {
        const items = costs.map(cost => weaponMaterialItem(cost, itemTable, cost.overrides));
        const icons = [...new Set(items.map(item => item.icon))].map(icon => ({ icon }));
        return window.AKEUI.materialPopover({
            label: t('sections.breakthroughMaterials'),
            placement: 'top',
            items,
            icons
        });
    }

    function weaponSkillLabel(index) {
        const marker = '__AKE_SKILL_BOUND__';
        return t('skillLevelBounds', {
            skill: index,
            lower: marker,
            upper: marker
        }).split(marker)[0].replace(/[：:\s]+$/, '');
    }

    function weaponBreakthroughLabel() {
        const marker = '__AKE_BREAKTHROUGH_LEVEL__';
        return t('breakthroughLevel', { level: marker }).replace(marker, '').trim();
    }

    function renderBreakthrough(data, itemTable) {
        const btTable = data.weaponbreakthroughtemplatetable;
        if (!btTable) return '';

        const templateId = data.weaponbasictable?.breakthroughTemplateId;
        const btData = btTable[templateId];
        if (!btData?.list?.length) return '';

        const upgradeTemplateId = data.weaponbasictable?.levelTemplateId;
        const upgradeLevels = data.weaponupgradetemplatetable?.[upgradeTemplateId]?.list || [];
        const maxLevelEntry = upgradeLevels[upgradeLevels.length - 1];
        const maxLevel = data.weaponbasictable?.maxLv || maxLevelEntry?.weaponLv || upgradeLevels.length;

        const stages = btData.list.map((bt, index) => {
            const lv = bt.breakthroughShowLv;
            const gold = bt.breakthroughGold || 0;
            const items = bt.breakItemList || [];
            const bounds = bt.skillLevelBounds || [];
            const startLevel = index === 0 ? 1 : Math.min(index * 20, maxLevel);
            const endLevel = index === btData.list.length - 1
                ? maxLevel
                : Math.min((index + 1) * 20, maxLevel);

            const costs = [];
            if (gold > 0) {
                costs.push({
                    id: 'item_gold',
                    count: gold.toLocaleString(),
                    overrides: { name: t('gold') }
                });
            }
            items.forEach(it => {
                if (it.count > 0) costs.push(it);
            });
            return {
                title: lv === 0 ? t('initial') : t('breakthroughLevel', { level: lv }),
                levelRange: `${startLevel}-${endLevel}`,
                bounds,
                material: weaponMaterialPopover(costs, itemTable)
            };
        });
        const skillCount = Math.max(0, ...stages.map(stage => stage.bounds.length));
        const skillRows = Array.from({ length: skillCount }, (_, index) => `
            <tr>
                <th scope="row">${escapeHtml(weaponSkillLabel(index + 1))}</th>
                ${stages.map(stage => {
                    const bound = stage.bounds[index];
                    return `<td>${bound ? `${bound.lowerBound}-${bound.upperBound}` : '-'}</td>`;
                }).join('')}
            </tr>
        `).join('');

        return `
            <section class="ake-ui-section weapon-breakthrough-section">
                <div class="ake-ui-section__header">
                    <h3 class="ake-ui-section__title">${t('sections.breakthroughMaterials')}</h3>
                </div>
                <div class="ake-ui-table-shell weapon-breakthrough-table-shell">
                    <table class="ake-ui-table weapon-breakthrough-table" style="--weapon-stage-count: ${stages.length}">
                        <thead>
                            <tr>
                                <th scope="col">${escapeHtml(weaponBreakthroughLabel())}</th>
                                ${stages.map(stage => `<th scope="col">${escapeHtml(stage.title)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th scope="row">${commonT('level')}</th>
                                ${stages.map(stage => `<td>${stage.levelRange}</td>`).join('')}
                            </tr>
                            ${skillRows}
                            <tr class="weapon-breakthrough-material-row">
                                <th scope="row">${t('sections.breakthroughMaterials')}</th>
                                ${stages.map(stage => `<td>${stage.material?.outerHTML || '-'}</td>`).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function renderAtkTable(data) {
        const upgradeTable = data.weaponupgradetemplatetable;
        if (!upgradeTable) return '';
        const templateId = data.weaponbasictable?.levelTemplateId;
        const upgradeData = upgradeTable[templateId];
        if (!upgradeData || !upgradeData.list) return '';

        const allRows = upgradeData.list.map(entry => {
            const level = window.renderRawValueTip ? window.renderRawValueTip(entry.weaponLv, entry.weaponLv) : entry.weaponLv;
            const atk = window.renderRawValueTip ? window.renderRawValueTip(entry.baseAtk, entry.baseAtk) : entry.baseAtk;
            return `<tr data-level="${entry.weaponLv}"><td>${level}</td><td>${atk}</td></tr>`;
        });

        let rowsToRender = allRows;
        if (weaponLevelsToShow && !showAllWeaponLevels) {
            const levelSet = new Set(weaponLevelsToShow);
            rowsToRender = allRows.filter(row => {
                const match = row.match(/data-level="(\d+)"/);
                return match && levelSet.has(parseInt(match[1], 10));
            });
            if (rowsToRender.length === 0 && weaponLevelsToShow.length > 0) {
                const maxLevel = Math.max(...weaponLevelsToShow);
                const found = allRows.find(r => r.includes(`data-level="${maxLevel}"`));
                if (found) rowsToRender = [found];
            }
        }

        const toggle = weaponLevelsToShow ? window.AKEUI.disclosureButton({
            className: 'toggle-weapon-levels-btn',
            expanded: showAllWeaponLevels,
            expandLabel: commonT('expandAllLevels'),
            collapseLabel: commonT('collapseExtraLevels')
        }) : null;

        return `
            <div class="ake-ui-section detail-atk">
                <div class="ake-ui-section__header">
                    <h3 class="ake-ui-section__title">${t('baseAttackRange', { max: upgradeData.list.length })}</h3>
                    ${toggle?.outerHTML || ''}
                </div>
                <div class="ake-ui-table-shell">
                    <table class="ake-ui-table">
                        <thead><tr><th>${commonT('level')}</th><th>${commonT('attack')}</th></tr></thead>
                        <tbody>${rowsToRender.join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderDetail(data, weapon) {
        const basicTable = data.weaponbasictable || {};
        const itemTable = data.itemtable || {};
        const weaponItem = itemTable[weapon.weaponId] || {};

        const name = weaponItem.name?.text || weapon.name;
        const desc = weaponItem.desc?.text || '';
        const decoDesc = weaponItem.decoDesc?.text || '';
        const weaponDesc = basicTable.weaponDesc?.text || '';
        const iconId = weaponItem.iconId || weapon.weaponId;
        const atkHtml = renderAtkTable(data);
        const skillHtml = renderSkills(data);
        const breakHtml = renderBreakthrough(data, itemTable);
        const storyHtml = weaponDesc ? `
            <section class="ake-ui-section weapon-story-section">
                <div class="ake-ui-section__header">
                    <h3 class="ake-ui-section__title">${t('sections.story')}</h3>
                </div>
                <div class="weapon-desc">${parseText(weaponDesc)}</div>
            </section>
        ` : '';
        const headerContent = (desc || decoDesc) ? window.AKEUI.fragment(`
            <div class="ake-ui-detail-summary">
                ${desc ? `<div>${escapeHtml(desc)}</div>` : ''}
                ${decoDesc ? `<div>${escapeHtml(decoDesc)}</div>` : ''}
            </div>
        `) : null;
        const detailHeader = window.AKEUI.detailHeader({
            layout: 'showcase',
            className: 'weapon-detail-hero',
            icon: {
                src: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`
            },
            title: name,
            content: headerContent,
            mainAfter: window.AKEUI.fragment(atkHtml),
            visual: {
                src: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/gachaweapon/${iconId}.png`,
                frame: true
            }
        });

        return `
            <article class="ake-ui-detail" data-detail-kind="weapon">
            ${detailHeader?.outerHTML || ''}
            ${skillHtml}
            ${breakHtml}
            ${storyHtml}
            </article>
        `;
    }

    function bindWeaponLevelToggle(container) {
        const toggle = container.querySelector('.toggle-weapon-levels-btn');
        if (!toggle) return;
        toggle.addEventListener('click', event => {
            event.preventDefault();
            if (!currentWeaponData || !currentWeapon) return;
            showAllWeaponLevels = !showAllWeaponLevels;
            container.innerHTML = renderDetail(currentWeaponData, currentWeapon);
            window.AKEModuleOverview?.renderVersionDiff(
                container,
                currentWeaponData,
                currentWeaponData.__versionDiff?.baseline
                    ? renderDetail(currentWeaponData.__versionDiff.baseline, currentWeapon)
                    : ''
            );
            bindWeaponLevelToggle(container);
        });
    }

    async function loadWeaponDetail(weapon, container) {
        container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
        try {
            const data = await (window.akeFetch || fetch)(weapon.contentFile).then(r => r.json());
            currentWeaponData = data;
            currentWeapon = weapon;
            container.innerHTML = renderDetail(data, weapon);
            window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, weapon) : '');
            bindWeaponLevelToggle(container);
        } catch (err) {
            const error = document.createElement('div');
            error.className = 'ake-ui-state';
            error.dataset.state = 'error';
            error.textContent = t('loadFailed', { message: err.message });
            container.replaceChildren(error);
        }
    }

    async function refreshModule() {
        const list = document.getElementById('v2wpnList');
        const detail = document.getElementById('v2wpnDetail');
        if (!list || !detail) return;
        const showHidden = getCurrentShowHidden();
        allWeapons = await loadWeaponManifest(showHidden);
        generateFilterButtons();
        renderWeaponList();
    }

    async function initModule() {
        if (isInitialized) return;
        isInitialized = true;
        if (window.configLoaded) await window.configLoaded;
        const settings = window.akeData?.getLevelSettings?.() || {};
        if (settings.enabled) {
            weaponLevelsToShow = parseLevelInput(settings.weaponLevels, 90);
        }

        window.addEventListener('globalConfigChanged', () => {
            searchTerm = '';
            const si = document.getElementById('v2wpnSearchInput');
            if (si) si.value = '';
            const settings = window.akeData?.getLevelSettings?.() || {};
            if (settings.enabled) {
                weaponLevelsToShow = parseLevelInput(settings.weaponLevels, 90);
            } else {
                weaponLevelsToShow = null;
            }
            showAllWeaponLevels = false;
            selectedRarities.clear();
            selectedTypes.clear();
            selectedTagDimensions.forEach(set => set.clear());
            refreshModule();
        });

        document.getElementById('v2wpnSearchInput')?.addEventListener('input', e => {
            searchTerm = e.target.value;
            renderWeaponList();
        });

        await refreshModule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModule);
    } else {
        initModule();
    }
})();
