(function() {
        const t = window.akeI18n.scope('modules.enemy');
        const commonT = window.akeI18n.scope('common');
        let allEnemies = [];
        let rawAllEnemies = [];
        let activeEnemyId = null;
        let isInitialized = false;
        let enemyLevelsToShow = null;
        let variantExpandStates = {};
        let searchTerm = '';
        let currentEnemy = null;
        let currentEnemyData = null;
        let attrMap = {};
        let attrEnMap = {};
        let attrNameToId = {};
        let modifierTypeMap = {};
        const buffCache = {};

        const IMAGE_BASE_PATH = '/public/images/';
        const LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES = Object.freeze([80, 81, 82, 83, 84, 85]);
        const ELEMENT_RESISTANCE_ATTR_TYPES = Object.freeze({
            physicalResistance: 94,
            naturalResistance: 95,
            crystResistance: 96,
            pulseResistance: 97,
            fireResistance: 98,
            etherResistance: 99
        });

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        function parseLevelInput(input, maxLevel = 100) {
            if (!input || input.trim() === '') return [];
            const parts = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLevel);
            return parts.length ? parts : [maxLevel];
        }

        async function loadMaps() {
            try {
                const data = await window.akeLoadMaps();
                attrMap = data.ATTR_MAP || {};
                attrEnMap = data.ATTR_MAP_EN || {};
                attrNameToId = Object.fromEntries(Object.entries(attrEnMap).map(([id, name]) => [name, Number(id)]));
                modifierTypeMap = data.MODIFIER_TYPE_MAP || {};
            } catch (err) {
                console.error('加载映射数据失败:', err);
                attrMap = {};
                attrEnMap = {};
                attrNameToId = {};
            }
        }

        function getAttrName(attrType) {
            return attrMap[attrType] || t('attributeFallback', { type: attrType });
        }

        function formatAttrModifiers(modifiers) {
            if (!Array.isArray(modifiers) || modifiers.length === 0) return '';
            const showHidden = getCurrentShowHidden();
            return modifiers.filter(m => !LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(m.attrType)).map(m => {
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
                    if (modName) text += ` <span class="v2e-modifier-type-tag">${modName}</span>`;
                }
                return text;
            }).join(', ');
        }

        function renderModifierSummary(content, label = '') {
            if (!content) return '';
            const labelHtml = label
                ? `<span class="ake-ui-badge" data-tone="muted">${label}</span>`
                : '';
            return `<div class="v2e-variant-modifier">${labelHtml}<span class="v2e-variant-modifier__value">${content}</span></div>`;
        }

        async function loadEnemyBuffData(rawData) {
            const ids = new Set();
            Object.values(rawData.enemytable || {}).forEach(enemy => (enemy.bornBuffs || []).forEach(id => ids.add(id)));
            Object.values(rawData.enemyattributetemplatetable || {}).forEach(attr => (attr.poiseKnotBuffList || []).forEach(id => ids.add(id)));
            await Promise.all(Array.from(ids).map(async id => {
                if (Object.prototype.hasOwnProperty.call(buffCache, id)) return;
                try {
                    const response = await (window.akeFetch || fetch)(`/public/Json/BuffData/${id}.json`);
                    buffCache[id] = response.ok ? await response.json() : null;
                } catch {
                    buffCache[id] = null;
                }
            }));
        }

        function getBuffModifiers(buffId) {
            const buff = buffCache[buffId];
            if (!buff?.attributeModifier?.attributeModifiers?.length) return [];
            const blackboard = {};
            (buff.blackboard || []).forEach(row => {
                blackboard[row.key] = row.valueFloat ?? row.valueDouble ?? row.value ?? 0;
            });
            return buff.attributeModifier.attributeModifiers.map(modifier => {
                const attrType = attrNameToId[modifier.attributeType];
                const modifierType = window.AKEStats.FORMULA_TO_MODTYPE[modifier.formulaItem];
                if (attrType === undefined || modifierType === undefined) return null;
                const param = modifier.param || {};
                const value = param.useBlackboardKey && param.blackboardKey
                    ? blackboard[param.blackboardKey] ?? param.value
                    : param.value;
                return { attrType, modifierType, attrValue: value };
            }).filter(Boolean);
        }

        function buffModifierSummary(buffIds) {
            return formatAttrModifiers((buffIds || []).flatMap(getBuffModifiers));
        }

        function filterEnemiesBySearch(enemies) {
            if (!searchTerm) return enemies;
            const term = searchTerm.toLowerCase();
            return enemies.filter(e =>
                (e.name && e.name.toLowerCase().includes(term)) ||
                (e.templateId && e.templateId.toLowerCase().includes(term))
            );
        }

        async function loadEnemyManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/v2_enemy/manifest.json');
                if (!res.ok) throw new Error('无法加载敌人清单');
                const all = await res.json();
                rawAllEnemies = all;
                let enemies = showHidden ? all : all.filter(e => !e.hidden);
                enemies.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return enemies;
            } catch (err) {
                console.error('加载敌人清单失败:', err);
                return [];
            }
        }

        function buildBaseAttrSnapshot(rawData, attrTemplateId) {
            const attrData = rawData.enemyattributetemplatetable?.[attrTemplateId] || {};
            const li = attrData.levelIndependentAttributes?.attrs || [];
            const m = {};
            li.forEach(a => { m[a.attrType] = a.attrValue; });

            return {
                executionDamageScalar: m[27],
                physicalDamageTakenScalar: m[4],
                fireDamageTakenScalar: m[5],
                electroDamageTakenScalar: m[6],
                coldDamageTakenScalar: m[7],
                naturalDamageTakenScalar: m[48],
                etherDamageTakenScalar: m[60],
                physicalResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.physicalResistance],
                naturalResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.naturalResistance],
                crystResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.crystResistance],
                pulseResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.pulseResistance],
                fireResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.fireResistance],
                etherResistance: m[ELEMENT_RESISTANCE_ATTR_TYPES.etherResistance],
                normalAttackRange: m[12],
                maxPoise: m[20],
                poiseRecTime: m[21],
                zeroPoiseSuperArmor: attrData.zeroPoiseSuperArmor,
                breakingAttackedAtbObtain: attrData.breakingAttackedAtbObtain,
                weight: m[8],
                attackValueAgainstTower: attrData.attackValueAgainstTower,
                initialSuperArmor: attrData.initialSuperArmor,
                maxResilience: attrData.maxResilience,
                pushedBackCoefficient: attrData.pushedBackCoefficient,
                resilienceDecreaseWhenHurt: attrData.resilienceDecreaseWhenHurt,
                resilienceFullRecoverTime: attrData.resilienceFullRecoverTime,
                resilienceRecover: attrData.resilienceRecover,
                resilienceRecoverInterval: attrData.resilienceRecoverInterval,
                superArmorWhenResilienceZero: attrData.superArmorWhenResilienceZero,
                criticalRate: m[9],
                criticalDamage: m[10],
                hatred: m[11],
                attackSpeed: m[15]
            };
        }

        function normalizeV2ToLegacy(baseInfo, rawData) {
            const displayInfo = rawData.enemytemplatedisplayinfotable || {};
            const attrTemplateId = baseInfo.templateId;
            const attrData = rawData.enemyattributetemplatetable?.[attrTemplateId] || {};
            const abilityDescs = rawData.enemyabilitydesctable || {};
            const displayType = rawData.displayenemytypetable?.name?.text || '';
            const distributionInfo = rawData.distributioninfotable || {};

            const skillDescs = [];
            (displayInfo.abilityDescIds || []).forEach(id => {
                const ability = abilityDescs[id];
                if (ability?.description?.text) skillDescs.push(ability.description.text);
            });

            const baseSnapshot = buildBaseAttrSnapshot(rawData, attrTemplateId);

            const legacy = {
                templateId: baseInfo.templateId,
                name: displayInfo.name?.text || baseInfo.name || rawData.name || '',
                icon: baseInfo.icon || '',
                iconbig: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${baseInfo.templateId}.png`,
                enemyTag: displayType,
                rarity: baseInfo.rarity || 1,
                description: displayInfo.description?.text || '',
                skillDescriptions: skillDescs,
                ...baseSnapshot,
                poiseKnotPct: attrData.poiseKnotPctList?.join(', '),
                poiseKnotBuffList: attrData.poiseKnotBuffList || [],
                poiseKnotBuffModifiersStr: buffModifierSummary(attrData.poiseKnotBuffList || []),
                distributionInfo: distributionInfo,
                baseSnapshot: baseSnapshot,
                variants: []
            };

            const enemyTable = rawData.enemytable || {};
            const attrTypeReverse = {};
            Object.entries(ELEMENT_RESISTANCE_ATTR_TYPES).forEach(([key, attrType]) => {
                attrTypeReverse[key] = attrType;
            });

            Object.keys(enemyTable).forEach(enemyId => {
                const entry = enemyTable[enemyId];
                const variantAttrTemplateId = entry.attrTemplateId || attrTemplateId;
                const variantAttrData = rawData.enemyattributetemplatetable?.[variantAttrTemplateId] || {};
                const levelDepAttrs = variantAttrData.levelDependentAttributes || [];

                const levels = [], hpArr = [], atkArr = [], defArr = [];
                const hpDetails = [], atkDetails = [], defDetails = [];
                const inlineModifiers = entry.attrModifiers || [];
                const bornBuffModifiers = (entry.bornBuffs || []).flatMap(getBuffModifiers);
                const mods = [...inlineModifiers, ...bornBuffModifiers];
                levelDepAttrs.forEach(ld => {
                    const attrs = ld.attrs || [];
                    let lv = 0, hp = 0, atk = 0, def = 0;
                    attrs.forEach(a => {
                        if (a.attrType === 0) lv = a.attrValue;
                        if (a.attrType === 1) hp = a.attrValue;
                        if (a.attrType === 2) atk = a.attrValue;
                        if (a.attrType === 3) def = a.attrValue;
                    });
                    if (lv > 0) {
                        levels.push(lv);
                        const hpDetail = window.AKEStats.analyzeAttrWithModifiers(hp, mods, 1);
                        const atkDetail = window.AKEStats.analyzeAttrWithModifiers(atk, mods, 2);
                        const defDetail = window.AKEStats.analyzeAttrWithModifiers(def, mods, 3);
                        hpArr.push(hpDetail.value); atkArr.push(atkDetail.value); defArr.push(defDetail.value);
                        hpDetails.push({ ...hpDetail, name: getAttrName(1) });
                        atkDetails.push({ ...atkDetail, name: getAttrName(2) });
                        defDetails.push({ ...defDetail, name: getAttrName(3) });
                    }
                });

                const isBase = enemyId === attrTemplateId;

                const variantFullAttrs = buildBaseAttrSnapshot(rawData, variantAttrTemplateId);
                const variantFullAttrDetails = {};
                if (!isBase && mods.length > 0) {
                    Object.keys(variantFullAttrs).forEach(key => {
                        const at = attrTypeReverse[key];
                        if (at !== undefined && mods.some(m => m.attrType === at)) {
                            const detail = window.AKEStats.analyzeAttrWithModifiers(variantFullAttrs[key], mods, at);
                            variantFullAttrs[key] = detail.value;
                            variantFullAttrDetails[key] = { ...detail, name: getMetaLabel(key) };
                        }
                    });
                }

                legacy.variants.push({
                    enemyId,
                    attrTemplateId: variantAttrTemplateId,
                    templateId: entry.templateId || baseInfo.templateId,
                    attrModifiers: inlineModifiers,
                    attrModifiersStr: formatAttrModifiers(inlineModifiers),
                    buffModifiers: bornBuffModifiers,
                    buffModifiersStr: formatAttrModifiers(bornBuffModifiers),
                    aiTemplateId: entry.aiTemplateId || '',
                    bornBuffs: entry.bornBuffs || [],
                    isDangerous: entry.isDangerous || false,
                    showBigEffect: entry.showBigEffect || false,
                    showBigHeadbar: entry.showBigHeadbar || false,
                    isBase,
                    levels, hp: hpArr, atk: atkArr, def: defArr,
                    hpDetails, atkDetails, defDetails,
                    fullAttrs: variantFullAttrs,
                    fullAttrDetails: variantFullAttrDetails
                });
            });

            legacy.variants.sort((a, b) => (a.isBase ? 0 : 1) - (b.isBase ? 0 : 1));
            return legacy;
        }

        const META_GROUPS = [
            {
                key: 'poiseAndArmor',
                fallback: 'Poise and Super Armor',
                fields: ['initialSuperArmor', 'zeroPoiseSuperArmor', 'superArmorWhenResilienceZero', 'maxPoise', 'poiseRecTime', 'poiseKnotPct']
            },
            {
                key: 'damageAndResistance',
                fallback: 'Execution and Resistance',
                fields: [
                    'executionDamageScalar', 'breakingAttackedAtbObtain', 'physicalDamageTakenScalar', 'naturalDamageTakenScalar',
                    'coldDamageTakenScalar', 'electroDamageTakenScalar', 'fireDamageTakenScalar',
                    'etherDamageTakenScalar', 'physicalResistance', 'naturalResistance',
                    'crystResistance', 'pulseResistance', 'fireResistance', 'etherResistance'
                ]
            },
            {
                key: 'resilienceAndMovement',
                fallback: 'Resilience and Displacement',
                fields: [
                    'weight', 'maxResilience', 'pushedBackCoefficient', 'resilienceDecreaseWhenHurt',
                    'resilienceFullRecoverTime', 'resilienceRecover', 'resilienceRecoverInterval'
                ]
            },
            {
                key: 'combatBehavior',
                fallback: 'Combat Parameters',
                fields: [
                    'normalAttackRange', 'attackValueAgainstTower', 'criticalRate', 'criticalDamage',
                    'hatred', 'attackSpeed'
                ]
            }
        ];
        const META_FIELDS = META_GROUPS.flatMap(group => group.fields);

        function getMetaLabel(key) {
            const attrType = ELEMENT_RESISTANCE_ATTR_TYPES[key];
            return attrType === undefined ? t(`meta.${key}`) : getAttrName(attrType);
        }

        function renderMeta(data) {
            return META_GROUPS.map(group => {
                const items = group.fields.flatMap(key => {
                    const value = data[key];
                    return value === undefined || value === null || value === ''
                        ? []
                        : [{ label: getMetaLabel(key), value }];
                });
                const grid = window.AKEUI.metaGrid(items);
                if (!grid) return '';
                grid.classList.add('v2e-meta-grid');
                return `<section class="v2e-meta-group">
                    <h4 class="v2e-meta-group__title">${t(`metaGroups.${group.key}`, null, group.fallback)}</h4>
                    ${grid.outerHTML}
                </section>`;
            }).filter(Boolean).join('');
        }

        function renderSkillDesc(arr) {
            if (!Array.isArray(arr) || arr.length === 0) return '';
            return `<div class="v2e-trait-list">${arr.map((text, index) => `
                <div class="v2e-trait-item">
                    <span class="v2e-trait-index">${String(index + 1).padStart(2, '0')}</span>
                    <div class="v2e-trait-copy">${parseText(text)}</div>
                </div>
            `).join('')}</div>`;
        }

        function renderDistributionTags(data) {
            const entries = Object.values(data.distributionInfo || {});
            if (!entries.length) return '';
            return entries.map(d => d.areaName?.text ? `<span class="ake-ui-badge">${d.areaName.text}</span>` : '').join('');
        }

        function renderVariantDiff(variant, baseSnapshot) {
            const fa = variant.fullAttrs;
            if (!fa) return '';

            const items = [];
            META_FIELDS.forEach(key => {
                const bv = baseSnapshot[key];
                const nv = fa[key];
                if (bv === undefined && nv === undefined) return;
                if (bv === nv) return;
                if (typeof bv === 'number' && typeof nv === 'number' && Math.abs(bv - nv) < 0.0001) return;
                const d = (nv || 0) - (bv || 0);
                const sign = d > 0 ? '+' : '';
                const fmt = Number.isInteger(d) ? d : d.toFixed(2);
                const bvHtml = window.renderRawValueTip ? window.renderRawValueTip(bv ?? '-', bv) : (bv ?? '-');
                const nvHtml = window.renderRawValueTip ? window.renderRawValueTip(nv ?? '-', variant.fullAttrDetails?.[key] || nv) : (nv ?? '-');
                const diffHtml = window.renderRawValueTip ? window.renderRawValueTip(sign + fmt, {
                    name: getMetaLabel(key),
                    rawValue: bv ?? 0,
                    value: d,
                    changed: true,
                    formula: `${nv ?? 0} - ${bv ?? 0} = ${d}`
                }) : sign + fmt;
                items.push(`<div class="v2e-diff-item"><span class="v2e-diff-label">${getMetaLabel(key)}:</span><span class="v2e-diff-val ${d < 0 ? 'neg' : ''}">${bvHtml} → ${nvHtml} (${diffHtml})</span></div>`);
            });

            if (!items.length) return '';
            return `<div class="v2e-diff"><strong>${t('variantDifference')}</strong>${items.join('')}</div>`;
        }

        function renderVariantTooltip(variant) {
            const fa = variant.fullAttrs;
            if (!fa) return '';
            const fields = META_FIELDS.filter(key => fa[key] !== undefined && fa[key] !== null);
            if (!fields.length) return '';

            const grid = window.AKEUI.element('span', 'v2e-tooltip-grid');
            fields.forEach(key => {
                const val = fa[key];
                const valueHtml = window.renderRawValueTip ? window.renderRawValueTip(val, variant.fullAttrDetails?.[key] || val) : val;
                const item = window.AKEUI.element('span', 'v2e-tooltip-item');
                item.appendChild(window.AKEUI.element('span', 'v2e-tooltip-label', getMetaLabel(key)));
                const value = window.AKEUI.element('span', 'v2e-tooltip-value');
                value.appendChild(window.AKEUI.fragment(String(valueHtml)));
                item.appendChild(value);
                grid.appendChild(item);
            });

            return window.AKEUI.popover({
                label: variant.attrTemplateId,
                placement: 'top',
                className: 'v2e-variant-template',
                triggerClassName: 'ake-ui-badge ake-ui-badge--technical v2e-tag-id',
                panelClassName: 'v2e-tooltip',
                content: grid
            })?.outerHTML || '';
        }

        function getEnemyTypeName(enemy) {
            const typeNames = { 0: t('enemyTypes.normal'), 1: t('enemyTypes.elite'), 2: t('enemyTypes.boss'), 3: t('enemyTypes.special'), 4: t('enemyTypes.dangerous') };
            return enemy.displayTypeName || typeNames[enemy.displayType] || t('enemyTypes.other');
        }

        function createEnemyDirectoryItem(enemy, options = {}) {
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: enemy.name,
                id: enemy.templateId,
                icon: { src: enemy.icon || '', alt: '' },
                meta: [{ label: getEnemyTypeName(enemy), kind: 'enemy-type' }],
                accent: { type: 'rarity', value: enemy.rarity || 1 },
                active: options.active,
                attributes: { 'data-enemy-id': enemy.templateId },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, enemy);
            return item;
        }

        function renderEnemyOverview(items, container) {
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                tagsLayout: 'overlay',
                group: item => ({ id: String(item.displayType ?? 'unknown'), name: getEnemyTypeName(item), order: -(item.rarity || 1) }),
                onReset: () => { activeEnemyId = null; },
                onSelect: item => { activeEnemyId = item.templateId; renderEnemyList(); },
                sidebarSelector: item => `.ake-ui-directory__item[data-enemy-id="${CSS.escape(item.templateId)}"]`,
                items: items.slice().sort((a, b) => (b.rarity || 1) - (a.rarity || 1) || (a.priority || 999) - (b.priority || 999)).map(item => ({ ...item, id: item.templateId, image: item.icon, fallback: t('overview.fallback'),
                    tags: item.variantCount ? [t('overview.variantCount', { count: item.variantCount })] : [] }))
            });
        }

        function renderEnemyList() {
            const container = document.getElementById('v2enemyList');
            const detailContainer = document.getElementById('v2enemyDetail');
            if (!container) return;

            const filtered = filterEnemiesBySearch(allEnemies);
            container.innerHTML = '';

            if (!filtered.length) {
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeEnemyId = null;
                return;
            }

            filtered.forEach((enemy, index) => {
                const item = createEnemyDirectoryItem(enemy, {
                    active: enemy.templateId === activeEnemyId
                        || (index === 0 && !activeEnemyId && !window.AKEModuleOverview?.isActive('enemy')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, item);
                        activeEnemyId = enemy.templateId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_enemy', enemy.templateId);
                        loadEnemyDetail(enemy, detailContainer);
                    }
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.templateId === window.__deepLinkId);
                if (deepItem) {
                    activeEnemyId = deepItem.templateId;
                } else {
                    const existsInRaw = rawAllEnemies.some(c => c.templateId === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(e => e.templateId === activeEnemyId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('enemy')) {
                    activeEnemyId = null;
                    renderEnemyOverview(filtered, detailContainer);
                    return;
                }
                activeEnemyId = filtered[0].templateId;
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_enemy', activeEnemyId);
                const firstItem = container.querySelector('.ake-ui-directory__item');
                if (firstItem) window.AKEUI.setDirectoryItemActive(container, firstItem);
                loadEnemyDetail(filtered[0], detailContainer);
            } else if (activeExists) {
                const activeEnemy = filtered.find(e => e.templateId === activeEnemyId);
                if (activeEnemy) {
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_enemy', activeEnemyId);
                    const activeItem = container.querySelector(`.ake-ui-directory__item[data-enemy-id="${activeEnemyId}"]`);
                    if (activeItem) window.AKEUI.setDirectoryItemActive(container, activeItem);
                    loadEnemyDetail(activeEnemy, detailContainer);
                }
            }
        }

        async function loadEnemyDetail(enemy, container) {
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const rawData = await (window.akeFetch || fetch)(enemy.contentFile).then(r => r.json());
                await loadEnemyBuffData(rawData);
                const data = normalizeV2ToLegacy(enemy, rawData);
                currentEnemyData = data;
                currentEnemy = enemy;

                variantExpandStates = {};
                data.variants.forEach((_, idx) => { variantExpandStates[idx] = false; });

                container.innerHTML = renderDetail(data);
                if (rawData.__versionDiff?.baseline) await loadEnemyBuffData(rawData.__versionDiff.baseline);
                const baselineData = rawData.__versionDiff?.baseline
                    ? normalizeV2ToLegacy(enemy, rawData.__versionDiff.baseline)
                    : null;
                window.AKEModuleOverview?.renderVersionDiff(container, rawData, baselineData ? renderDetail(baselineData) : '');

                container.querySelectorAll('.v2e-toggle-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const vi = parseInt(btn.dataset.variant, 10);
                        if (isNaN(vi)) return;
                        variantExpandStates[vi] = !variantExpandStates[vi];
                        updateVariantTable(data.variants[vi], vi);
                        window.AKEUI.setDisclosureButtonExpanded(btn, variantExpandStates[vi]);
                    });
                });

            } catch (err) {
                container.textContent = '';
                const error = document.createElement('div');
                error.className = 'ake-ui-state';
                error.dataset.state = 'error';
                error.textContent = t('loadFailed', { message: err.message });
                container.appendChild(error);
            }
        }

        function buildVariantRows(variant) {
            const count = variant.levels.length;
            let allRows = '';
            for (let i = 0; i < count; i++) {
                const hpRaw = variant.hp[i];
                const atkRaw = variant.atk[i];
                const defRaw = variant.def[i];
                const hp = typeof hpRaw === 'number' ? (Number.isInteger(hpRaw) ? hpRaw : hpRaw.toFixed(2)) : hpRaw;
                const atk = typeof atkRaw === 'number' ? (Number.isInteger(atkRaw) ? atkRaw : atkRaw.toFixed(2)) : atkRaw;
                const def = typeof defRaw === 'number' ? (Number.isInteger(defRaw) ? defRaw : defRaw.toFixed(2)) : defRaw;
                const lvHtml = window.renderRawValueTip ? window.renderRawValueTip(variant.levels[i], variant.levels[i]) : variant.levels[i];
                const hpHtml = window.renderRawValueTip ? window.renderRawValueTip(hp, variant.hpDetails?.[i] || hpRaw) : hp;
                const atkHtml = window.renderRawValueTip ? window.renderRawValueTip(atk, variant.atkDetails?.[i] || atkRaw) : atk;
                const defHtml = window.renderRawValueTip ? window.renderRawValueTip(def, variant.defDetails?.[i] || defRaw) : def;
                allRows += `<tr data-level="${variant.levels[i]}"><td>${lvHtml}</td><td>${hpHtml}</td><td>${atkHtml}</td><td>${defHtml}</td></tr>`;
            }
            return allRows;
        }

        function filterRows(allRows) {
            const showAll = false;
            let rowsToRender = allRows;
            if (enemyLevelsToShow) {
                const levelSet = new Set(enemyLevelsToShow);
                const rowArray = allRows.split('</tr>').filter(r => r.trim());
                const filteredRows = rowArray.filter(row => {
                    const match = row.match(/data-level="(\d+)"/);
                    return match && levelSet.has(parseInt(match[1], 10));
                });
                rowsToRender = filteredRows.join('</tr>') + (filteredRows.length ? '</tr>' : '');
            }
            if (!rowsToRender && enemyLevelsToShow && enemyLevelsToShow.length > 0) {
                const maxLevel = Math.max(...enemyLevelsToShow);
                const found = allRows.split('</tr>').find(r => r.includes(`data-level="${maxLevel}"`));
                rowsToRender = found ? found + '</tr>' : '';
            }
            return rowsToRender;
        }

        function updateVariantTable(variant, idx) {
            const container = document.querySelector(`[data-card-kind="enemy-variant"][data-variant-index="${idx}"] .ake-ui-table-shell`);
            if (!container) return;

            const allRows = buildVariantRows(variant);
            const showAll = variantExpandStates[idx] || false;
            const rowsToRender = showAll ? allRows : filterRows(allRows);

            container.innerHTML = `
                <table class="ake-ui-table">
                    <thead><tr><th>${commonT('level')}</th><th>${t('columns.maxHp')}</th><th>${commonT('attack')}</th><th>${t('columns.defense')}</th></tr></thead>
                    <tbody>${rowsToRender}</tbody>
                </table>
            `;
        }

        function renderVariants(variants, baseSnapshot) {
            if (!variants.length) return `<p>${t('noVariants')}</p>`;
            return variants.map((variant, idx) => {
                if (!variant.levels.length) return '';

                const titleExtra = !variant.isBase ? renderVariantTooltip(variant) : '';
                const modifierHtml = renderModifierSummary(variant.attrModifiersStr);
                const showHidden = getCurrentShowHidden();
                const buffHtml = showHidden
                    ? (variant.bornBuffs.length > 0 ? `<div class="v2e-buffs">${variant.bornBuffs.map(b => window.AKEUI.entryLinkHtml({ plugin: 'v3_buff', id: b, label: b, className: 'ake-ui-badge ake-ui-badge--technical' })).join('')}</div>` : '')
                    : renderModifierSummary(variant.buffModifiersStr, t('modifierLabels.buffBonus', null, 'Buff Bonus'));

                const flags = [];
                if (variant.isDangerous) flags.push(`<span class="ake-ui-badge" data-tone="danger">${t('flags.dangerous')}</span>`);
                if (variant.showBigEffect) flags.push(`<span class="ake-ui-badge" data-tone="accent">${t('flags.globalEffect')}</span>`);
                if (variant.showBigHeadbar) flags.push(`<span class="ake-ui-badge" data-tone="muted">${t('flags.pinnedHealthBar')}</span>`);
                const flagsHtml = flags.length ? `<div class="v2e-flags">${flags.join('')}</div>` : '';

                const diffHtml = !variant.isBase ? renderVariantDiff(variant, baseSnapshot) : '';

                const allRows = buildVariantRows(variant);
                const showAll = variantExpandStates[idx] || false;
                const rowsToRender = showAll ? allRows : filterRows(allRows);

                const variantId = showHidden && variant.enemyId
                    ? variant.enemyId
                    : t('variantFallback', { number: idx + 1 });
                const toggle = enemyLevelsToShow ? window.AKEUI.disclosureButton({
                    className: 'v2e-toggle-btn',
                    expanded: showAll,
                    expandLabel: commonT('expandAllLevels'),
                    collapseLabel: commonT('collapseExtraLevels'),
                    attributes: { 'data-variant': idx }
                }) : null;
                const toggleButton = toggle
                    ? `<div class="ake-ui-card__header-actions">${toggle.outerHTML}</div>`
                    : '';

                return `
                    <div class="ake-ui-card" data-card-kind="enemy-variant" data-density="regular" data-variant-index="${idx}">
                        <div class="ake-ui-card__header v2e-variant-header">
                            <div class="ake-ui-card__title">${variantId}${titleExtra}</div>
                            ${toggleButton}
                        </div>
                        <div class="ake-ui-card__body">${modifierHtml}${buffHtml}${flagsHtml}${diffHtml}<div class="ake-ui-table-shell">
                            <table class="ake-ui-table">
                                <thead><tr><th>${commonT('level')}</th><th>${t('columns.maxHp')}</th><th>${commonT('attack')}</th><th>${t('columns.defense')}</th></tr></thead>
                                <tbody>${rowsToRender}</tbody>
                            </table>
                        </div></div>
                    </div>
                `;
            }).filter(Boolean).join('');
        }

        function renderDetail(data) {
            const skillDescriptionsHtml = renderSkillDesc(data.skillDescriptions);
            const headerContent = window.AKEUI.fragment(`
                <div class="ake-ui-detail-badges">
                    ${data.enemyTag ? `<span class="ake-ui-badge">${data.enemyTag}</span>` : ''}
                    ${renderDistributionTags(data)}
                </div>
                ${data.description ? `<div class="ake-ui-detail-summary v2e-desc"><div>${parseText(data.description)}</div></div>` : ''}
                ${skillDescriptionsHtml ? `<section class="v2e-hero-traits">
                    <h3 class="v2e-hero-traits__title">${t('sections.enemyTraits', null, 'Enemy Traits')}</h3>
                    ${skillDescriptionsHtml}
                </section>` : ''}
            `);
            const detailHeader = window.AKEUI.detailHeader({
                layout: 'showcase',
                className: 'enemy-detail-hero',
                title: data.name,
                content: headerContent,
                visual: {
                    src: data.iconbig || data.icon || '',
                    className: 'enemy-detail-visual'
                }
            });
            const metaHtml = renderMeta(data);

            const showHidden = getCurrentShowHidden();
            const poiseBuffHtml = showHidden && data.poiseKnotBuffList.length > 0 ? `
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.poiseBreakBuffs')}</h3></div>
                    <div class="v2e-buffs">${data.poiseKnotBuffList.map(b => `<span class="ake-ui-badge ake-ui-badge--technical">${b}</span>`).join('')}</div>
                </div>
            ` : (!showHidden && data.poiseKnotBuffModifiersStr ? `
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.poiseBreakBuffs')}</h3></div>
                    ${renderModifierSummary(data.poiseKnotBuffModifiersStr, t('modifierLabels.buffBonus', null, 'Buff Bonus'))}
                </div>
            ` : '');

            const variantsHtml = renderVariants(data.variants, data.baseSnapshot);

            return `<article class="ake-ui-detail" data-detail-kind="enemy">
                ${detailHeader?.outerHTML || ''}
                ${metaHtml ? `<section class="ake-ui-section v2e-meta">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.combatStats', null, 'Combat Parameters')}</h3></div>
                    <div class="v2e-meta-groups">${metaHtml}</div>
                </section>` : ''}
                ${poiseBuffHtml}
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.variantAttributes')}</h3></div>
                    ${variantsHtml}
                </div>
                </article>
            `;
        }

        const mobileBtn = document.getElementById('v2enemyMobileListBtn');
        const mobileOverlay = document.getElementById('v2enemyMobileListOverlay');
        const mobileContent = document.getElementById('v2enemyMobileListContent');

        function buildMobileList() {
            const filtered = filterEnemiesBySearch(allEnemies);
            mobileContent.innerHTML = '';
            filtered.forEach(enemy => {
                const item = createEnemyDirectoryItem(enemy, {
                    active: enemy.templateId === activeEnemyId,
                    onSelect: () => {
                        activeEnemyId = enemy.templateId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_enemy', enemy.templateId);
                        loadEnemyDetail(enemy, document.getElementById('v2enemyDetail'));
                        closeMobileList();
                        const desktopList = document.getElementById('v2enemyList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-enemy-id="${CSS.escape(enemy.templateId)}"]`);
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

        async function refreshModule() {
            const list = document.getElementById('v2enemyList');
            const detail = document.getElementById('v2enemyDetail');
            if (!list || !detail) return;
            const showHidden = getCurrentShowHidden();
            const enemies = await loadEnemyManifest(showHidden);
            allEnemies = enemies;
            renderEnemyList();
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;
            await loadMaps();

            const settings = window.akeData?.getLevelSettings?.() || {};
            if (settings.enabled) {
                enemyLevelsToShow = parseLevelInput(settings.enemyLevels, 100);
            }

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
                if (e.target === mobileOverlay) closeMobileList();
            });

            document.addEventListener('click', () => {
                document.querySelectorAll('.v2e-tooltip.pinned').forEach(t => t.classList.remove('pinned'));
            });

            window.addEventListener('globalConfigChanged', () => {
                searchTerm = '';
                const si = document.getElementById('v2enemySearchInput');
                if (si) si.value = '';
                const s = window.akeData?.getLevelSettings?.() || {};
                enemyLevelsToShow = s.enabled ? parseLevelInput(s.enemyLevels, 100) : null;
                variantExpandStates = {};
                refreshModule();
            });

            document.getElementById('v2enemySearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderEnemyList();
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
