(function() {
        const t = window.akeI18n.scope('modules.equip');
        const commonT = window.akeI18n.scope('common');
        let allSuits = [];
        let rawAllSuits = [];
        let activeSuitId = null;
        let isInitialized = false;
        let searchTerm = '';
        let attrMap = {};
        let compositeNameMap = {};
        let modifierTypeMap = {};
        let domainMap = {};
        let tableAttributeNames = {};
        const selectedEquipmentAttrs = [new Set(), new Set(), new Set()];
        let detailRequestGeneration = 0;
        let manifestRequestGeneration = 0;

        const IMAGE_BASE_PATH = '/public/images/';

        const PART_TYPE_KEYS = { 0: 'parts.armor', 1: 'parts.gloves', 2: 'parts.accessory' };
        const PART_ICON_MAP = { 0: 'body', 1: 'hand', 2: 'edc' };

        const mobileBtn = document.getElementById('v2equipMobileListBtn');
        const mobileOverlay = document.getElementById('v2equipMobileListOverlay');
        const mobileContent = document.getElementById('v2equipMobileListContent');

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function getAttrName(attrType, compositeAttr) {
            if (compositeAttr && compositeNameMap[compositeAttr]) {
                return compositeNameMap[compositeAttr];
            }
            return attrMap[String(attrType)] || t('attributeFallback', { type: attrType });
        }

        function equipmentAttrKey(modifier) {
            return `${modifier?.modifierType ?? ''}:${modifier?.attrType ?? ''}:${modifier?.compositeAttr || ''}`;
        }

        function equipmentMatchesTerms(item) {
            if (Number(item?.rarity) !== 5) return false;
            return selectedEquipmentAttrs.every((selected, index) => {
                if (!selected.size) return true;
                const modifier = (item.displayAttrModifiers || []).find(entry => Number(entry.attrIndex) === index + 1);
                return modifier ? selected.has(equipmentAttrKey(modifier)) : false;
            });
        }

        function hasEquipmentTermFilter() {
            return selectedEquipmentAttrs.some(selected => selected.size);
        }

        function getDomainName(domainId) {
            return domainMap[domainId] || (getCurrentShowHidden() ? domainId : '');
        }

        function formatAttrValue(attrType, val, compositeAttr) {
            if (typeof val !== 'number') return val;
            const name = getAttrName(attrType, compositeAttr);
            const pctKeywords = ['暴击', '伤害加成', '充能', '抗性', '承伤', '减免', '吸血', '增幅', '脆弱', '强度'];
            const isPct = pctKeywords.some(k => name.includes(k)) || Math.abs(val) < 1;
            let display;
            if (isPct && Math.abs(val) < 10) {
                const displayVal = compositeAttr === 'AllDamageTakenScalar' ? 1 - val : val;
                display = (displayVal * 100).toFixed(2) + '%';
                return window.renderRawValueTip ? window.renderRawValueTip(display, compositeAttr === 'AllDamageTakenScalar' ? {
                    name,
                    rawValue: val,
                    value: displayVal,
                    changed: true,
                    formula: `1 - ${val} = ${displayVal}`
                } : val) : display;
            }
            display = Number.isInteger(val) ? val.toString() : val.toFixed(2);
            return window.renderRawValueTip ? window.renderRawValueTip(display, val) : display;
        }

        function getEquipIconSrc(itemId, iconId) {
            if (iconId) return `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`;
            return `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${itemId}.png`;
        }

        function filterSuits(suits) {
            if (!searchTerm && !hasEquipmentTermFilter()) return suits;
            const t = searchTerm.toLowerCase();
            return suits.filter(s =>
                (!searchTerm || (s.name && s.name.toLowerCase().includes(t)) || (s.suitID && s.suitID.toLowerCase().includes(t))) &&
                (!hasEquipmentTermFilter() || (s.equipmentIndex || []).some(equipmentMatchesTerms))
            );
        }

        function allEquipmentIndex() { return allSuits.flatMap(s => s.equipmentIndex || []); }

        function generateAttributeFilters() {
            const filterPanel = document.getElementById('v2equipFilterBar');
            const containers = [0, 1, 2].map(index => document.getElementById(`v2equipAttributeFilter${index}`));
            const updateFilterSummary = () => {
                const count = selectedEquipmentAttrs.reduce((total, selected) => total + selected.size, 0);
                window.AKEUI?.updateFilterPanel(filterPanel, {
                    summary: count ? commonT('filterCount', { count }) : commonT('filter')
                });
            };
            containers.forEach((container, index) => {
                if (!container) return;
                const attrs = new Map();
                allEquipmentIndex().filter(item => Number(item.rarity) === 5).forEach(item => {
                    const mod = (item.displayAttrModifiers || []).find(entry => Number(entry.attrIndex) === index + 1);
                    if (!mod) return;
                    const key = equipmentAttrKey(mod);
                    const label = item.attributeNames?.[key] || getAttrName(mod.attrType, mod.compositeAttr);
                    if (!attrs.has(key)) attrs.set(key, label);
                });
                container.innerHTML = '';
                [...attrs.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([key, label]) => container.appendChild(window.AKEUI.filterButton({
                    label, pressed: selectedEquipmentAttrs[index].has(key), onChange: pressed => {
                        pressed ? selectedEquipmentAttrs[index].add(key) : selectedEquipmentAttrs[index].delete(key);
                        updateFilterSummary();
                        renderSuitList();
                    }
                })));
            });
            updateFilterSummary();
        }

        function createEquipDirectoryItem(suit, options = {}) {
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: suit.name,
                id: suit.suitID,
                icon: { src: suit.icon || '', alt: '' },
                accent: { type: 'rarity', value: suit.rarity || 1 },
                active: options.active,
                attributes: { 'data-suit-id': suit.suitID },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, suit);
            return item;
        }

        function buildMobileList() {
            const filtered = filterSuits(allSuits);
            mobileContent.innerHTML = '';
            filtered.forEach(suit => {
                const item = createEquipDirectoryItem(suit, {
                    active: suit.suitID === activeSuitId,
                    onSelect: () => {
                        activeSuitId = suit.suitID;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_equip', suit.suitID);
                        loadSuitDetail(suit, document.getElementById('v2equipDetail'));
                        closeMobileList();
                        const desktopList = document.getElementById('v2equipList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-suit-id="${suit.suitID}"]`);
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

        async function loadMaps() {
            try {
                const data = await window.akeLoadMaps();
                attrMap = data.ATTR_MAP || {};
                compositeNameMap = data.COMPOSITE_NAME_MAP || {};
                modifierTypeMap = data.MODIFIER_TYPE_MAP || {};
                domainMap = data.DOMAIN_MAP || {};
            } catch { /* ignore */ }
        }

        async function loadSuitManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/v2_equip/manifest.json');
                if (!res.ok) throw new Error('无法加载装备清单');
                const all = await res.json();
                rawAllSuits = all;
                let suits = showHidden ? all : all.filter(s => !s.hidden);
                suits.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return suits;
            } catch (err) {
                console.error('加载装备清单失败:', err);
                return [];
            }
        }

        function renderEquipOverview(items, container) {
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                tagsLayout: 'overlay',
                group: item => ({ id: item.isIndependentGroup ? 'independent' : 'suit', name: item.isIndependentGroup ? t('independentEquipment') : t('equipmentSets'), order: item.isIndependentGroup ? 1 : 0 }),
                onReset: () => { activeSuitId = null; },
                onSelect: item => { activeSuitId = item.suitID; renderSuitList(); },
                sidebarSelector: item => `.ake-ui-directory__item[data-suit-id="${CSS.escape(item.suitID)}"]`,
                items: items.map(item => ({ ...item, id: item.suitID, image: item.icon, fallback: t('overview.fallback'),
                    tags: [t('overview.equipmentCount', { count: item.equipCount || 0 })] }))
            });
        }

        function renderSuitList() {
            const container = document.getElementById('v2equipList');
            const detailContainer = document.getElementById('v2equipDetail');
            if (!container) return;

            const filtered = filterSuits(allSuits);
            if (hasEquipmentTermFilter()) {
                container.innerHTML = filtered.map(suit => createEquipDirectoryItem(suit, { active: false, onSelect: () => {} }).outerHTML).join('');
                detailContainer.innerHTML = renderFilteredEquipment(filtered);
                return;
            }
            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeSuitId = null;
                return;
            }

            filtered.forEach((suit, index) => {
                const item = createEquipDirectoryItem(suit, {
                    active: suit.suitID === activeSuitId
                        || (!activeSuitId && index === 0 && !window.AKEModuleOverview?.isActive('equip')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, item);
                        activeSuitId = suit.suitID;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_equip', suit.suitID);
                        loadSuitDetail(suit, detailContainer);
                    }
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.suitID === window.__deepLinkId);
                if (deepItem) {
                    activeSuitId = deepItem.suitID;
                } else {
                    const existsInRaw = rawAllSuits.some(c => c.suitID === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(s => s.suitID === activeSuitId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('equip')) {
                    activeSuitId = null;
                    renderEquipOverview(filtered, detailContainer);
                    return;
                }
                activeSuitId = filtered[0].suitID;
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_equip', activeSuitId);
                const f = container.querySelector('.ake-ui-directory__item');
                if (f) window.AKEUI.setDirectoryItemActive(container, f);
                loadSuitDetail(filtered[0], detailContainer);
            } else if (activeExists) {
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_equip', activeSuitId);
                const ai = filtered.find(s => s.suitID === activeSuitId);
                if (ai) {
                    const ad = container.querySelector(`.ake-ui-directory__item[data-suit-id="${activeSuitId}"]`);
                    if (ad) window.AKEUI.setDirectoryItemActive(container, ad);
                    loadSuitDetail(ai, detailContainer);
                }
            }
        }

        function renderFilteredEquipment(suits) {
            const itemRows = suits.flatMap(suit => (suit.equipmentIndex || []).map(item => ({ ...item, suitName: suit.name })));
            const cards = itemRows.filter(equipmentMatchesTerms);
            const html = cards.map(item => renderEquipCard(item.itemId, { ...item, displayAttrModifiers: item.displayAttrModifiers || [] }, { name: { text: item.name }, rarity: item.rarity, iconId: item.itemId }, null, null, {}, null, Object.fromEntries(itemRows.map(row => [row.itemId, { name: { text: row.name }, rarity: row.rarity, iconId: row.itemId }])) , null, false, itemRows)).join('');
            return `<article class="ake-ui-detail" data-detail-kind="equipment-filter"><section class="ake-ui-section"><div class="ake-ui-section__header"><h2 class="ake-ui-section__title">${t('attributeFilter')}</h2></div><div class="ake-ui-card-grid" data-size="wide">${html || `<p>${t('none')}</p>`}</div></section></article>`;
        }

        function renderSubStatList(displayAttrModifiers) {
            const showHidden = getCurrentShowHidden();
            const subStats = displayAttrModifiers.filter(m => m.attrIndex > 0);
            if (subStats.length === 0) return '';

            const hasEnhance = subStats.some(m => m.enhancedAttrValues && m.enhancedAttrValues.length > 0);

            const rows = subStats.map(m => {
                const name = getAttrName(m.attrType, m.compositeAttr);
                const baseVal = formatAttrValue(m.attrType, m.attrValue, m.compositeAttr);
                const modType = modifierTypeMap[String(m.modifierType)] || '';
                const modifierTag = showHidden && modType
                    ? `<span class="ake-ui-badge" data-density="compact" title="${escapeHtml(modType)}">${escapeHtml(modType)}</span>`
                    : '';
                const values = hasEnhance
                    ? [baseVal, ...Array.from({ length: 3 }, (_, index) => {
                        const value = m.enhancedAttrValues?.[index];
                        return value === undefined ? '-' : formatAttrValue(m.attrType, value, m.compositeAttr);
                    })]
                    : [baseVal];
                const labels = hasEnhance
                    ? [t('columns.base'), '+1', '+2', '+3']
                    : [t('columns.value')];
                const valueItems = values.map((value, index) => `
                    <div class="v2eq-substat-stage">
                        <dt>${labels[index]}</dt>
                        <dd>${value}</dd>
                    </div>
                `).join('');

                return `
                    <div class="v2eq-substat">
                        <div class="v2eq-substat-heading"><span>${escapeHtml(name)}</span>${modifierTag}</div>
                        <dl class="v2eq-substat-values">${valueItems}</dl>
                    </div>
                `;
            }).join('');

            return `<div class="v2eq-substats">${rows}</div>`;
        }

        function equipMaterialItem(itemId, count, itemTable) {
            if (!itemId) return null;
            const item = itemTable[itemId] || {};
            return {
                icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${item.iconId || itemId}.png`,
                name: item.name?.text || itemId,
                count: Number(count || 0).toLocaleString(),
                description: item.desc?.text || ''
            };
        }

        function renderFormulaBtn(formulaData, formulaChainData, itemTable) {
            const chains = formulaChainData?.chainList || [];
            if (!formulaData || chains.length === 0) return '';

            const getChainItems = chain => {
                const items = [];
                const gold = equipMaterialItem(chain.costGoldId, chain.costGoldNum, itemTable);
                if (gold) items.push(gold);
                (chain.costItemId || []).forEach((costItemId, index) => {
                    const item = equipMaterialItem(costItemId, (chain.costItemNum || [])[index], itemTable);
                    if (item) items.push(item);
                });
                return items;
            };
            const rows = chains.map(chain => {
                const chainId = getCurrentShowHidden() ? ` · #${escapeHtml(String(chain.chainId ?? ''))}` : '';
                return {
                    label: `${formulaData.level || t('craftingCost')}${chainId}`,
                    className: chain.isDefault ? 'v2eq-material-row--default' : '',
                    items: getChainItems(chain)
                };
            });

            const defaultChain = chains.find(chain => chain.isDefault === true) || chains[0];
            const icons = [...new Set(getChainItems(defaultChain).map(item => item.icon))].map(icon => ({ icon }));
            return window.AKEUI.materialPopover({
                label: t('craftingCost'),
                placement: 'bottom',
                className: 'v2eq-material-popover',
                rows,
                icons
            })?.outerHTML || '';
        }

        function renderGuaranteeBtn(displayAttrModifiers, guaranteeRules, enhanceConst) {
            if (!guaranteeRules || Object.keys(guaranteeRules).length === 0) return '';

            const subStats = (displayAttrModifiers || []).filter(m => m.attrIndex > 0 && m.enhanceGuaranteeTimesRuleId && m.enhancedAttrValues && m.enhancedAttrValues.length > 0);
            if (subStats.length === 0) return '';

            let tipHtml = '';
            if (enhanceConst && enhanceConst.maxAttrEnhanceLevel !== undefined) {
                tipHtml += `<div class="v2eq-enhance-tip">${t('maxEnhancement', { level: enhanceConst.maxAttrEnhanceLevel })}</div>`;
            }

            let rows = '';
            subStats.forEach(m => {
                const name = getAttrName(m.attrType, m.compositeAttr);
                const rule = guaranteeRules[m.enhanceGuaranteeTimesRuleId];
                if (!rule) return;
                rows += `<tr><td>${escapeHtml(name)}</td><td>${rule.GuaranteeTimes1}</td><td>${rule.GuaranteeTimes2}</td><td>${rule.GuaranteeTimes3}</td></tr>`;
            });

            if (!rows) return '';

            tipHtml += `<table class="ake-ui-table">
                <thead><tr><th>${t('columns.stat')}</th><th>+1</th><th>+2</th><th>+3</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;

            return window.AKEUI.popover({
                label: t('enhancementGuarantee'),
                placement: 'bottom',
                className: 'v2eq-guarantee-popover',
                panelClassName: 'v2eq-guarantee-tip',
                panelElement: 'div',
                content: window.AKEUI.fragment(tipHtml)
            })?.outerHTML || '';
        }

        function renderAcquisition(acquisition) {
            if (!acquisition) return '';
            const source = acquisition.templateSource || {};
            let templateText = t('acquisition.defaultTemplate', null, 'Crafting template unlocked by default');
            if (source.kind === 'permission') templateText = t('acquisition.permissionTemplate', { level: source.level || acquisition.unlockValue || '?' }, `Permission Level ${source.level || acquisition.unlockValue || '?'} unlocks the crafting template`);
            else if (source.kind === 'map') templateText = t('acquisition.mapTemplate', null, 'Unlock the crafting template through exploration or equipment template crates');
            else if (source.kind === 'channel') templateText = source.level
                ? t('acquisition.channelTemplateAtLevel', { name: source.channelName || source.channelId, level: source.level }, `Crafting template becomes purchasable from ${source.channelName || source.channelId} at Level ${source.level}`)
                : t('acquisition.channelTemplateUnknownLevel', { name: source.channelName || source.channelId || t('acquisition.dispatch', null, 'Regional Dispatch') }, `Crafting template is purchasable from ${source.channelName || source.channelId || 'Regional Dispatch'}; the exact level is not exposed`);
            else if (source.kind === 'shop') templateText = t('acquisition.shopTemplate', { name: source.shopName || source.shopId || t('acquisition.shop', null, 'Shop') }, `Purchase the crafting template from ${source.shopName || source.shopId || 'Shop'}`);
            else if (source.kind === 'unknown') templateText = t('acquisition.unknownType', { type: acquisition.unlockType }, `Unknown unlock type ${acquisition.unlockType}`);
            const sourceId = source.goodsId || (source.goodsIds || []).join(', ') || acquisition.unlockKey || (source.rewardIds || []).join(', ');
            const sourceIdHtml = getCurrentShowHidden() && sourceId ? ` <small>${escapeHtml(sourceId)}</small>` : '';
            const mapPointsHtml = source.kind === 'map' && source.rewardIds?.length
                ? `<div><button type="button" class="v2eq-oem-link" data-oem-reward-ids="${escapeHtml(source.rewardIds.join(','))}">${escapeHtml(t('acquisition.oemMapLink', null, 'View on OEM'))}</button></div>`
                : '';
            const direct = (acquisition.directSources || []).map(entry => {
                const names = (entry.names || []).filter(Boolean).join(t('acquisition.sourceSeparator', null, ', '));
                const label = entry.preset
                    ? t('acquisition.direct.preset', null, 'Trial preset item (not a permanent source)')
                    : t(`acquisition.direct.${entry.kind}`, null, t('acquisition.direct.reward', null, 'Item granted directly by a reward'));
                const detail = names ? t('acquisition.direct.withSource', { label, names }, `${label} · ${names}`) : label;
                return `<div>${escapeHtml(detail)}${entry.count > 1 ? ` x${entry.count}` : ''}${getCurrentShowHidden() ? ` <small>${escapeHtml(entry.rewardId)}</small>` : ''}</div>`;
            }).join('');
            return `<div class="v2eq-deco-desc"><b>${escapeHtml(t('acquisition.title', null, 'Acquisition and Unlock'))}</b><div>${escapeHtml(templateText)}${sourceIdHtml}</div>${mapPointsHtml}${direct}</div>`;
        }

        function renderEquipCard(itemId, equipData, itemData, formulaData, formulaChainData, guaranteeRules, enhanceConst, itemTable, acquisition, isVersionAdded, recommendationPool) {
            const name = itemData?.name?.text || itemId;
            const rarity = itemData?.rarity ?? 0;
            const iconId = itemData?.iconId || '';
            const iconSrc = getEquipIconSrc(itemId, iconId);
            const partType = equipData.partType;
            const partName = PART_TYPE_KEYS[partType] ? t(PART_TYPE_KEYS[partType]) : t('partFallback', { type: partType });
            const minWearLv = equipData.minWearLv;
            const domainId = equipData.domainId || '';
            const domainName = getDomainName(domainId);
            const decoDesc = itemData?.decoDesc?.text || '';

            const mainMod = equipData.displayBaseAttrModifier;
            const mainName = getAttrName(mainMod.attrType, mainMod.compositeAttr);
            const mainVal = formatAttrValue(mainMod.attrType, mainMod.attrValue, mainMod.compositeAttr);
            const showHidden = getCurrentShowHidden();
            const mainModType = modifierTypeMap[String(mainMod.modifierType)] || '';

            const subStatsHtml = renderSubStatList(equipData.displayAttrModifiers);

            let decoHtml = '';
            if (decoDesc) {
                decoHtml = `<div class="v2eq-deco-desc">${parseText(decoDesc)}</div>`;
            }

            const formulaBtnHtml = renderFormulaBtn(formulaData, formulaChainData, itemTable);
            const guaranteeBtnHtml = renderGuaranteeBtn(equipData.displayAttrModifiers, guaranteeRules, enhanceConst);
            const pool = recommendationPool || [];
            const recommendationRows = (equipData.displayAttrModifiers || []).filter(mod => mod.attrIndex > 0).map(mod => {
                const key = equipmentAttrKey(mod);
                const value = Number(mod.attrValue);
                const candidates = pool.filter(candidate => candidate.itemId !== itemId && candidate.partType === partType && (candidate.displayAttrModifiers || []).some(other => equipmentAttrKey(other) === key && Number(other.attrValue) > value))
                    .sort((a, b) => Number((b.displayAttrModifiers || []).find(other => equipmentAttrKey(other) === key)?.attrValue || 0) - Number((a.displayAttrModifiers || []).find(other => equipmentAttrKey(other) === key)?.attrValue || 0) || a.itemId.localeCompare(b.itemId)).slice(0, 2);
                const rows = (candidates.length ? candidates : [{ ...equipData, itemId, name, icon: iconSrc }]).map(candidate => `<div class="v2eq-recommend-item"><img src="${candidate.icon || getEquipIconSrc(candidate.itemId, candidate.iconId)}" alt=""><span>${escapeHtml(candidate.name || itemTable[candidate.itemId]?.name?.text || candidate.itemId)}</span></div>`).join('');
                return `<div class="v2eq-recommend-row${candidates.length ? ' is-better-match' : ''}"><b>${escapeHtml(getAttrName(mod.attrType, mod.compositeAttr))}</b>${rows}</div>`;
            }).join('');
            const recommendationBtn = recommendationRows ? window.AKEUI.popover({ label: t('refiningRecommendation'), placement: 'bottom', className: 'v2eq-recommend-popover', panelElement: 'div', content: window.AKEUI.fragment(recommendationRows) })?.outerHTML || '' : '';
            const hasActions = formulaBtnHtml || guaranteeBtnHtml || recommendationBtn;
            const addedLabel = window.akeData?.t('versionDiff.added', null, '新增') || '新增';

            return `
                <article class="ake-ui-card has-media" data-ake-component="card" data-card-kind="equipment" data-density="regular" data-accent="rarity" data-accent-value="${rarity}"${isVersionAdded ? ` data-ake-change="added" data-ake-change-label="${escapeHtml(addedLabel)}"` : ''}>
                    <div class="ake-ui-card__content">
                        <header class="ake-ui-card__header">
                            <div class="ake-ui-card__media"><img src="${iconSrc}" alt=""></div>
                            <div class="ake-ui-card__heading">
                                <h3 class="ake-ui-card__title">${escapeHtml(name)}</h3>
                                ${showHidden ? `<span class="ake-ui-card__id">${escapeHtml(itemId)}</span>` : ''}
                            </div>
                            ${hasActions ? `<div class="ake-ui-card__header-actions">${formulaBtnHtml}${guaranteeBtnHtml}${recommendationBtn}</div>` : ''}
                        </header>
                        <div class="ake-ui-card__badges">
                            <span class="ake-ui-badge">${partName}</span>
                            <span class="ake-ui-badge">${t('levelAbbreviation', { level: minWearLv })}</span>
                            ${domainName ? `<span class="ake-ui-badge"${showHidden ? ` title="${escapeHtml(domainId)}"` : ''}>${escapeHtml(domainName)}</span>` : ''}
                        </div>
                        <div class="v2eq-mainstat">
                            <span class="v2eq-mainstat-desc">${escapeHtml(mainName)}</span>
                            <span>
                                <span class="v2eq-mainstat-value">${mainVal}</span>
                                ${showHidden && mainModType ? `<span class="v2eq-mainstat-modifier">(${mainModType})</span>` : ''}
                            </span>
                        </div>
                        ${subStatsHtml}
                        ${decoHtml}
                        ${renderAcquisition(acquisition)}
                    </div>
                </article>
            `;
        }

        function renderSkillSection(data) {
            const skillTable = data.skillpatchtable;
            if (!skillTable || Object.keys(skillTable).length === 0) return '';

            const showHidden = getCurrentShowHidden();
            let html = `<section class="ake-ui-section v2eq-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.setSkills')}</h3></div><div class="v2eq-skill-list">`;
            for (const [skillId, skillData] of Object.entries(skillTable)) {
                const bundle = skillData.SkillPatchDataBundle;
                if (!bundle) continue;
                bundle.forEach(skill => {
                    const desc = skill.description?.text || '';
                    if (!desc) return;
                    const blackboard = skill.blackboard || [];
                    const valueMap = {};
                    blackboard.forEach(b => { valueMap[b.key] = b.value; });

                    let processedDesc = desc;
                    processedDesc = replacePlaceholders(processedDesc, valueMap);
                    processedDesc = parseText(processedDesc);
                    processedDesc = processedDesc.replace(/\n/g, '<br>');

                    html += `<div class="v2eq-skill-desc">${processedDesc}</div>`;

                    if (showHidden && blackboard.length > 0) {
                        html += `<div class="v2eq-blackboard-params">`;
                        html += `<span class="v2eq-blackboard-label">${t('parameters')}</span>`;
                        blackboard.forEach(b => {
                            const displayVal = (typeof b.value === 'number')
                                ? (Math.abs(b.value) < 10 ? (b.value * 100).toFixed(1) + '%' : b.value)
                                : b.value;
                            const valueHtml = window.renderRawValueTip ? window.renderRawValueTip(displayVal, b.value, b.key) : displayVal;
                            html += `<span class="v2eq-blackboard-item"><strong>${escapeHtml(b.key)}</strong> = ${valueHtml}</span>`;
                        });
                        html += `</div>`;
                    }
                });
            }
            html += '</div></section>';
            return html;
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
                    const regex = new RegExp(`\\b${name}\\b`, 'g');
                    evalExpr = evalExpr.replace(regex, `(${value})`);
                }
                let result;
                try {
                    result = new Function('return ' + evalExpr)();
                } catch (e) {
                    return match;
                }
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

        function renderItemsSection(data) {
            const equipTable = data.equiptable;
            const itemTable = data.itemtable || {};
            const formulaTable = data.equipformulatable || {};
            const reverseFormulaTable = data.equipformulareversetable || {};
            const formulaChainTable = data.equipformulachaintable || {};
            const guaranteeRules = data.equipenhanceguaranteetimesruletable || {};
            const enhanceConst = data.equipconst || null;
            const acquisitionTable = data.equipacquisitiontable || {};
            const addedEquipIds = new Set(data.__versionAddedEquipIds || []);
            const recommendationPool = allEquipmentIndex();

            if (!equipTable) return '';

            const partOrder = { 0: 0, 1: 1, 2: 2 };
            const sortedItems = Object.entries(equipTable).sort((a, b) => {
                const addedOrder = Number(addedEquipIds.has(b[0])) - Number(addedEquipIds.has(a[0]));
                if (addedOrder) return addedOrder;
                const ra = itemTable[a[0]]?.rarity ?? 0;
                const rb = itemTable[b[0]]?.rarity ?? 0;
                if (ra !== rb) return rb - ra;
                const pa = partOrder[a[1].partType] ?? 99;
                const pb = partOrder[b[1].partType] ?? 99;
                if (pa !== pb) return pa - pb;
                return a[0].localeCompare(b[0]);
            });

            let cardsHtml = '';
            sortedItems.forEach(([itemId, equipData]) => {
                const iData = itemTable[itemId] || null;
                const formulaId = reverseFormulaTable[itemId] || '';
                const fData = formulaId ? formulaTable[formulaId] : null;
                const chainData = fData?.level ? formulaChainTable[fData.level] : null;
                cardsHtml += renderEquipCard(itemId, equipData, iData, fData, chainData, guaranteeRules, enhanceConst, itemTable, acquisitionTable[itemId], addedEquipIds.has(itemId), recommendationPool);
            });

            return `
                <section class="ake-ui-section v2eq-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.setPieces')}</h3></div>
                    <div class="ake-ui-card-grid" data-size="wide">${cardsHtml}</div>
                </section>
            `;
        }

        function renderEnhanceConstSection(data) {
            const techConst = data.equiptechconst;
            if (!techConst) return '';

            let html = `<section class="ake-ui-section v2eq-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.enhancementInfo')}</h3></div>`;
            html += `<div class="v2eq-enhance-info">`;
            if (techConst.equipProduceMaxCount !== undefined) {
                html += `<div class="v2eq-enhance-item">
                    <span class="v2eq-enhance-label">${t('maxCraftingCount')}</span>
                    <span class="v2eq-enhance-value">${window.renderRawValueTip ? window.renderRawValueTip(techConst.equipProduceMaxCount, techConst.equipProduceMaxCount, 'equipProduceMaxCount') : techConst.equipProduceMaxCount}</span>
                </div>`;
            }
            if (techConst.equipRecycleRatio !== undefined) {
                html += `<div class="v2eq-enhance-item">
                    <span class="v2eq-enhance-label">${t('recyclingReturnRate')}</span>
                    <span class="v2eq-enhance-value">${window.renderRawValueTip ? window.renderRawValueTip((techConst.equipRecycleRatio * 100).toFixed(0) + '%', techConst.equipRecycleRatio) : (techConst.equipRecycleRatio * 100).toFixed(0) + '%'}</span>
                </div>`;
            }
            html += `</div>`;

            const enhanceCost = data.equipenhancecosttable;
            const showHidden = getCurrentShowHidden();
            if (enhanceCost && showHidden) {
                const itemTable = data.itemtable || {};
                const rows = Object.entries(enhanceCost).map(([domainId, cost]) => {
                    const dName = getDomainName(cost.domainId || domainId);
                    const content = window.AKEUI.element('div', 'v2eq-enhance-materials');
                    const appendMaterialLine = (label, itemId, count) => {
                        const material = equipMaterialItem(itemId, count, itemTable);
                        if (!material) return;
                        const line = window.AKEUI.element('div', 'v2eq-enhance-material-line');
                        line.appendChild(window.AKEUI.element('span', 'v2eq-enhance-label', label));
                        const items = window.AKEUI.materialItems([material]);
                        if (items) line.appendChild(items);
                        content.appendChild(line);
                    };
                    appendMaterialLine(t('materialsConsumed'), cost.consumeItemId, cost.consumeItemCnt);
                    appendMaterialLine(t('materialsReturned'), cost.returnbackItemId, cost.returnbackItemCnt);
                    if (!content.childElementCount) return null;
                    return window.AKEUI.progressionRow({
                        kind: 'equipment-enhancement',
                        stage: dName || domainId,
                        content
                    });
                }).filter(Boolean);
                if (rows.length) {
                    html += window.AKEUI.progressionList({
                        className: 'v2eq-enhance-progression',
                        rows
                    }).outerHTML;
                }
            }

            html += '</section>';
            return html;
        }

        async function loadSuitDetail(suit, container) {
            const generation = ++detailRequestGeneration;
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loadingSet')}</div>`;
            try {
                const data = await (window.akeFetch || fetch)(suit.contentFile).then(r => r.json());
                if (generation !== detailRequestGeneration || activeSuitId !== suit.suitID) return;
                container.innerHTML = renderDetail(data, suit);
                window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, suit) : '');
            } catch (err) {
                if (generation !== detailRequestGeneration || activeSuitId !== suit.suitID) return;
                container.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: err.message })}</div>`;
            }
        }

        function renderDetail(data, suit) {
            const suitTable = data.equipsuittable;
            const suitName = suitTable?.list?.[0]?.suitName?.text || suit.name;
            const equipmentCount = Object.keys(data.equiptable || {}).length;
            const detailHeader = window.AKEUI.detailHeader({
                className: 'equipment-detail-hero',
                icon: { src: suit.icon || '' },
                title: suitName,
                badges: equipmentCount ? [t('overview.equipmentCount', { count: equipmentCount })] : []
            });

            let html = `
                <article class="ake-ui-detail" data-detail-kind="equipment">
                    ${detailHeader?.outerHTML || ''}
            `;

            html += renderSkillSection(data);
            html += renderItemsSection(data);
            html += renderEnhanceConstSection(data);
            html += '</article>';
            return html;
        }

        async function refreshModule() {
            const list = document.getElementById('v2equipList');
            const detail = document.getElementById('v2equipDetail');
            if (!list || !detail) return;

            const generation = ++manifestRequestGeneration;
            const showHidden = getCurrentShowHidden();
            const suits = await loadSuitManifest(showHidden);
            if (generation !== manifestRequestGeneration) return;
            allSuits = suits;
            tableAttributeNames = suits.flatMap(suit => suit.equipmentIndex || []).map(item => item.attributeNames || {}).reduce((merged, names) => Object.assign(merged, names), {});
            generateAttributeFilters();
            renderSuitList();
        }

        async function handleDetailClick(event) {
            const button = event.target.closest('.v2eq-oem-link[data-oem-reward-ids]');
            if (!button) return;
            const placeholder = window.open('about:blank', '_blank');
            if (placeholder) placeholder.opener = null;
            button.disabled = true;
            try {
                const rewardIds = button.dataset.oemRewardIds.split(',').filter(Boolean);
                const url = await window.AKEV3?.equipTemplateShareUrl?.(rewardIds);
                if (!url) throw new Error(t('acquisition.oemMapNotFound', null, 'Template crate location was not found'));
                if (placeholder && !placeholder.closed) placeholder.location.replace(url);
                else window.location.assign(url);
            } catch (error) {
                if (placeholder && !placeholder.closed) placeholder.close();
                showToast(error.message || t('acquisition.oemMapLoadFailed', null, 'Unable to load the template crate location'), 'warning');
            } finally {
                button.disabled = false;
            }
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
            document.getElementById('v2equipDetail')?.addEventListener('click', handleDetailClick);

            window.addEventListener('globalConfigChanged', () => {
                searchTerm = '';
                selectedEquipmentAttrs.forEach(selected => selected.clear());
                const si = document.getElementById('v2equipSearchInput');
                if (si) si.value = '';
                refreshModule();
            });

            document.getElementById('v2equipSearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderSuitList();
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
