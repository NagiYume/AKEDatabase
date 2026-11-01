(function() {
        const t = window.akeI18n.scope('modules.item');
        const commonT = window.akeI18n.scope('common');
        let allItems = [];
        let rawAllItems = [];
        let activeItemId = null;
        let isInitialized = false;
        let searchTerm = '';
        let selectedRarities = new Set();
        let selectedCategories = new Set();
        let itemTypeMap = {};

        const IMAGE_BASE_PATH = '/public/images/';

        function getItemCategory(item) {
            return item.categoryId || `type:${item.type}`;
        }

        function getItemCategoryName(item) {
            return item.categoryName || itemTypeMap[String(item.type)] || t('typeFallback', { type: item.type });
        }

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function valueTip(displayValue, rawValue, variableName) {
            return window.renderRawValueTip ? window.renderRawValueTip(displayValue, rawValue, variableName) : displayValue;
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        function getTypeName(typeId, itemtypetable) {
            if (itemtypetable?.name?.text) return itemtypetable.name.text;
            return itemTypeMap[String(typeId)] || t('typeFallback', { type: typeId });
        }

        function filterItems(items) {
            return items.filter(item => {
                if (searchTerm) {
                    const t = searchTerm.toLowerCase();
                    if (!(item.name && window.AKEModuleSearch.matches(item.name, t)) &&
                        !(item.itemId && window.AKEModuleSearch.matches(item.itemId, t))) return false;
                }
                if (selectedRarities.size > 0 && !selectedRarities.has(item.rarity)) return false;
                if (selectedCategories.size > 0) {
                    if (!selectedCategories.has(getItemCategory(item))) return false;
                }
                return true;
            });
        }

        async function loadMaps() {
            try {
                const data = await window.akeLoadMaps();
                itemTypeMap = data.item_type_map || {};
            } catch { itemTypeMap = {}; }
        }

        function generateFilterButtons() {
            const rc = document.getElementById('v2itemRarityFilter');
            const cc = document.getElementById('v2itemCategoryFilter');
            if (!rc || !cc) return;

            const existR = new Set(allItems.map(i => i.rarity));
            rc.innerHTML = '';
            for (let r = 1; r <= 6; r++) {
                if (!existR.has(r)) continue;
                const btn = window.AKEUI.filterButton({
                    label: commonT('rarityStars', { rarity: r }),
                    pressed: selectedRarities.has(r),
                    onChange: pressed => {
                        pressed ? selectedRarities.add(r) : selectedRarities.delete(r);
                        updateFilterSummary();
                        renderItemList();
                    }
                });
                rc.appendChild(btn);
            }

            const categories = new Map();
            allItems.forEach((item, index) => {
                const id = getItemCategory(item);
                const current = categories.get(id);
                const order = item.categoryOrder ?? (1000 + Number(item.type || 0));
                if (!current || order < current.order) {
                    categories.set(id, { id, name: getItemCategoryName(item), order, sourceOrder: index });
                }
            });
            const ordered = Array.from(categories.values()).sort((a, b) =>
                a.order - b.order || a.sourceOrder - b.sourceOrder || a.id.localeCompare(b.id, 'zh-CN'));

            cc.innerHTML = '';
            ordered.forEach(cat => {
                const btn = window.AKEUI.filterButton({
                    label: cat.name,
                    pressed: selectedCategories.has(cat.id),
                    onChange: pressed => {
                        pressed ? selectedCategories.add(cat.id) : selectedCategories.delete(cat.id);
                        updateFilterSummary();
                        renderItemList();
                    }
                });
                cc.appendChild(btn);
            });
            updateFilterSummary();
        }

        function updateFilterSummary() {
            const filterPanel = document.getElementById('v2itemFilterBar');
            const count = selectedRarities.size + selectedCategories.size;
            window.AKEUI?.updateFilterPanel(filterPanel, {
                summary: count ? commonT('filterCount', { count }) : commonT('filter')
            });
        }

        const mobileBtn = document.getElementById('v2itemMobileListBtn');
        const mobileOverlay = document.getElementById('v2itemMobileListOverlay');
        const mobileContent = document.getElementById('v2itemMobileListContent');

        function createItemDirectoryItem(item, options = {}) {
            const node = window.AKEUI.directoryItem({
                layout: 'entity',
                title: item.name,
                id: item.itemId,
                icon: { src: item.icon || '', alt: '' },
                meta: [{ label: getItemCategoryName(item), kind: 'item-category' }],
                accent: { type: 'rarity', value: item.rarity || 1 },
                active: options.active,
                attributes: { 'data-item-id': item.itemId },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(node, item);
            return node;
        }

        function buildMobileList() {
            const filtered = filterItems(allItems);
            mobileContent.innerHTML = '';
            filtered.forEach(item => {
                const node = createItemDirectoryItem(item, {
                    active: item.itemId === activeItemId,
                    onSelect: () => {
                        activeItemId = item.itemId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_item', item.itemId);
                        loadItemDetail(item, document.getElementById('v2itemDetail'));
                        closeMobileList();
                        const desktopList = document.getElementById('v2itemList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-item-id="${CSS.escape(item.itemId)}"]`);
                        if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                    }
                });
                mobileContent.appendChild(node);
            });
        }

        function openMobileList() {
            buildMobileList();
            mobileOverlay.classList.add('is-open'); mobileOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeMobileList() {
            mobileOverlay.classList.remove('is-open'); mobileOverlay.setAttribute('aria-hidden', 'true');
        }

        async function loadItemManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/v2_item/manifest.json');
                if (!res.ok) throw new Error('无法加载物品清单');
                const all = await res.json();
                rawAllItems = all;
                let items = showHidden ? all : all.filter(i => !i.hidden);
                items.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return items;
            } catch (err) {
                console.error('加载物品清单失败:', err);
                return [];
            }
        }

        function renderItemOverview(items, container) {
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                group: item => ({ id: item.categoryId, name: item.categoryName || t('otherItems'), order: item.categoryOrder }),
                onReset: () => { activeItemId = null; },
                onSelect: item => { activeItemId = item.itemId; renderItemList(); },
                sidebarSelector: item => `.ake-ui-directory__item[data-item-id="${CSS.escape(item.itemId)}"]`,
                items: items.map(item => ({ ...item, id: item.itemId, image: item.icon, fallback: t('overview.fallback') }))
            });
        }

        function renderItemList() {
            const container = document.getElementById('v2itemList');
            const detailContainer = document.getElementById('v2itemDetail');
            if (!container) return;

            const filtered = filterItems(allItems);
            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeItemId = null;
                return;
            }

            filtered.forEach((item, index) => {
                const node = createItemDirectoryItem(item, {
                    active: item.itemId === activeItemId
                        || (!activeItemId && index === 0 && !window.AKEModuleOverview?.isActive('item')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, node);
                        activeItemId = item.itemId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_item', item.itemId);
                        loadItemDetail(item, detailContainer);
                    }
                });

                container.appendChild(node);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.itemId === window.__deepLinkId);
                if (deepItem) {
                    activeItemId = deepItem.itemId;
                } else {
                    const existsInRaw = rawAllItems.some(c => c.itemId === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }
            const activeExists = filtered.some(i => i.itemId === activeItemId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('item')) {
                    activeItemId = null;
                    renderItemOverview(filtered, detailContainer);
                    return;
                }
                activeItemId = filtered[0].itemId;
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_item', activeItemId);
                const f = container.querySelector('.ake-ui-directory__item');
                if (f) window.AKEUI.setDirectoryItemActive(container, f);
                loadItemDetail(filtered[0], detailContainer);
            } else if (activeExists) {
                const ai = filtered.find(i => i.itemId === activeItemId);
                if (ai) {
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_item', activeItemId);
                    const ad = container.querySelector(`.ake-ui-directory__item[data-item-id="${activeItemId}"]`);
                    if (ad) window.AKEUI.setDirectoryItemActive(container, ad);
                    loadItemDetail(ai, detailContainer);
                }
            }
        }

        async function loadItemDetail(item, container) {
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const data = await (window.akeFetch || fetch)(item.contentFile).then(r => r.json());
                container.innerHTML = renderDetail(data, item);
                window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, item) : '');
            } catch (err) {
                container.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: err.message })}</div>`;
            }
        }

        function navigateToItem(itemId) {
            const item = allItems.find(row => row.itemId === itemId) || rawAllItems.find(row => row.itemId === itemId);
            const detailContainer = document.getElementById('v2itemDetail');
            if (!item || !detailContainer) return false;

            activeItemId = item.itemId;
            const list = document.getElementById('v2itemList');
            const sidebarItem = list?.querySelector(`.ake-ui-directory__item[data-item-id="${CSS.escape(item.itemId)}"]`);
            if (sidebarItem) {
                window.AKEUI.setDirectoryItemActive(list, sidebarItem);
                sidebarItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            if (window.__akeRouter) window.__akeRouter.updateUrl('v2_item', item.itemId);
            loadItemDetail(item, detailContainer);
            detailContainer.scrollTo({ top: 0, behavior: 'smooth' });
            return true;
        }

        function renderObtainWays(data) {
            const it = data.itemtable || {};
            const sj = data.systemjumptable || {};
            const ids = it.obtainWayIds || [];
            if (ids.length === 0) return '';

            const ways = ids.map(id => sj[id]).filter(Boolean);
            if (ways.length === 0) return '';

            return `
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.obtainWays')}</h3></div>
                    <div class="ake-ui-card-grid" data-size="regular">
                        ${ways.map(w => `
                            <div class="ake-ui-card has-media" data-ake-component="card" data-card-kind="item-obtain" data-density="compact">
                                <div class="ake-ui-card__content"><header class="ake-ui-card__header"><div class="ake-ui-card__media"><img src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemtips/${w.iconId}.png" alt=""></div><div class="ake-ui-card__heading"><div class="ake-ui-card__body">${parseText(w.desc?.text || w.id)}</div></div></header></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderProperties(it, itt) {
            const props = [];
            if (it.maxStackCount !== undefined && it.maxStackCount !== -1)
                props.push({ l: t('properties.maxStack'), v: it.maxStackCount });
            if (it.maxBackpackStackCount !== undefined && it.maxBackpackStackCount !== -1)
                props.push({ l: t('properties.backpackStackLimit'), v: it.maxBackpackStackCount });
            if (itt.storageSpace !== undefined)
                props.push({ l: t('properties.storageSpace'), v: itt.storageSpace });
            if (!props.length) return '';

            return `
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.properties')}</h3></div>
                    <div class="v2i-props-grid">
                        ${props.map(p => `
                            <div class="v2i-prop-item">
                                <span class="v2i-prop-label">${p.l}</span>
                                <span class="v2i-prop-value">${valueTip(p.v, p.v, p.l)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function replaceEffectPlaceholders(desc, useItem, equipItem) {
            const values = {};
            const scopedValues = {};
            (useItem?.useActions || []).forEach(action => {
                [action.buffBBData, action.skillBBData].forEach(data => {
                    (data?.blackboard || []).forEach(row => {
                        const key = String(row.key).toLowerCase();
                        const value = row.valueStr || row.value;
                        values[key] = value;
                        const scopeId = data.buffId || data.skillId;
                        if (scopeId) scopedValues[`${String(scopeId).toLowerCase()}\\${key}`] = value;
                    });
                });
            });
            (equipItem?.condParams || []).forEach((value, index) => {
                const numeric = Number(value);
                if (Number.isFinite(numeric)) values[`param${index + 1}`] = numeric;
            });
            if (equipItem?.chargeCount !== undefined) values.count = equipItem.chargeCount;
            return String(desc || '').replace(/\{([^}]+)\}/g, (match, expression) => {
                const parts = expression.split(':');
                let source = parts[0].replace(/\s+/g, '');
                const format = parts[1] || '';
                let missingScopedValue = false;
                source = source.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\\([a-zA-Z_][a-zA-Z0-9_]*)/g, (scopedMatch, scopeId, key) => {
                    const scopedKey = `${scopeId.toLowerCase()}\\${key.toLowerCase()}`;
                    if (!(scopedKey in scopedValues)) {
                        missingScopedValue = true;
                        return scopedMatch;
                    }
                    return `(${Number(scopedValues[scopedKey])})`;
                });
                if (missingScopedValue) return match;
                const names = source.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                if (names.some(name => !(name.toLowerCase() in values))) return match;
                let resolved = source;
                names.forEach(name => { resolved = resolved.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${Number(values[name.toLowerCase()])})`); });
                let result;
                try {
                    result = Function(`"use strict"; return (${resolved});`)();
                } catch {
                    return match;
                }
                if (!Number.isFinite(result)) return match;
                let formatted;
                if (format.includes('%')) {
                    const precision = format.includes('.') ? format.split('.')[1].replace('%', '').length : 0;
                    formatted = `${(result * 100).toFixed(precision)}%`;
                } else {
                    const precision = format.includes('.') ? format.split('.')[1].length : 0;
                    formatted = precision ? result.toFixed(precision) : String(result);
                }
                const originalExpr = parts[0].replace(/\s+/g, '');
                const changed = resolved !== originalExpr && /[+\-*/()]/.test(originalExpr);
                return valueTip(formatted, {
                    rawValue: changed ? originalExpr : result,
                    value: result,
                    changed,
                    expression: originalExpr,
                    formula: changed ? `${resolved} = ${result}` : undefined
                });
            });
        }

        function renderUseEffects(data) {
            const useItem = data.useitemtable;
            const equipItem = data.equipitemtable;
            if (!useItem && !equipItem) return '';
            let html = `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.useEffects')}</h3></div><div class="ake-ui-card-grid" data-size="regular">`;
            if (useItem?.itemUseDesc?.text) {
                const desc = replaceEffectPlaceholders(useItem.itemUseDesc.text, useItem, equipItem);
                html += `<div class="ake-ui-card" data-card-kind="item-effect" data-density="regular"><div class="ake-ui-card__title">${t('effects.afterUse')}</div><div class="ake-ui-card__body">${parseText(desc)}</div>`;
                if (useItem.duration > 0) html += `<div class="ake-ui-card__meta">${t('effects.duration', { duration: valueTip(commonT('time.seconds', { count: useItem.duration }), useItem.duration, 'duration') })}</div>`;
                html += '</div>';
            }
            if (equipItem) {
                const descriptions = [equipItem.equipDesc?.text, equipItem.equipExtraDesc?.text].filter(Boolean);
                html += `<div class="ake-ui-card" data-card-kind="item-effect" data-density="regular"><div class="ake-ui-card__title">${t('effects.afterEquip')}</div><div class="ake-ui-card__body">`;
                descriptions.forEach(desc => {
                    html += `<div>${parseText(replaceEffectPlaceholders(desc, useItem, equipItem))}</div>`;
                });
                const meta = [];
                if (equipItem.chargeCount !== undefined) meta.push(t('effects.useCount', { count: equipItem.chargeCount }));
                if (equipItem.cooldown > 0) meta.push(t('effects.cooldown', { duration: commonT('time.seconds', { count: equipItem.cooldown }) }));
                if (equipItem.castTime > 0) meta.push(t('effects.castTime', { duration: commonT('time.seconds', { count: equipItem.castTime }) }));
                if (equipItem.recoverUpperCount > 0) meta.push(t('effects.recoverCount', { count: equipItem.recoverUpperCount }));
                if (equipItem.recoverTime > 0) meta.push(t('effects.recoveryInterval', { duration: commonT('time.seconds', { count: equipItem.recoverTime }) }));
                html += '</div>';
                if (meta.length) html += `<div class="ake-ui-card__meta">${meta.join(' · ')}</div>`;
                html += '</div>';
            }
            return html + '</div></div>';
        }

        function renderCraftItem(entry, itemTable, currentId) {
            const item = itemTable[entry.id] || {};
            const name = item.name?.text || commonT('unknown');
            const iconId = item.iconId || entry.id;
            return window.AKEUI.materialItem({
                element: 'a',
                className: `v2i-craft-item${entry.id === currentId ? ' is-current' : ''}`,
                icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`,
                name,
                count: entry.count ?? 1,
                attributes: {
                    href: `/?plugin=v3_item&id=${encodeURIComponent(entry.id)}`,
                    'data-item-id': entry.id,
                    title: getCurrentShowHidden() ? entry.id : null
                }
            })?.outerHTML || '';
        }

        function renderCraftRecipes(data) {
            const recipes = data.craftrecipes || [];
            if (!recipes.length) return '';
            const itemTable = data.craftitemtable || {};
            const incoming = recipes.filter(recipe => recipe.outputs.some(entry => entry.id === data.itemId));
            const outgoing = recipes.filter(recipe => recipe.inputs.some(entry => entry.id === data.itemId));
            const formatDuration = durationMs => {
                if (!durationMs) return '';
                let seconds = Math.round(durationMs / 1000);
                const days = Math.floor(seconds / 86400);
                seconds %= 86400;
                const hours = Math.floor(seconds / 3600);
                seconds %= 3600;
                const minutes = Math.floor(seconds / 60);
                seconds %= 60;
                return [[days, 'days'], [hours, 'hours'], [minutes, 'minutes'], [seconds, 'seconds']]
                    .filter(([value]) => value).map(([value, unit]) => commonT(`time.${unit}`, { count: value })).join('') || commonT('time.lessThanSecond');
            };
            const renderRecipe = recipe => `
                <div class="ake-ui-card" data-card-kind="item-craft" data-density="regular">
                    <div class="ake-ui-card__header"><span class="ake-ui-badge">${recipe.kind}</span>${recipe.name ? `<span class="ake-ui-card__title">${recipe.name}</span>` : ''}${recipe.meta ? `<small>${recipe.meta}</small>` : ''}${recipe.environment?.name ? `<span class="ake-ui-badge">${recipe.environment.name}</span>` : ''}<small>${t('craft.duration', { duration: recipe.durationMs ? formatDuration(recipe.durationMs) : t('craft.notConfigured') })}</small></div>
                    <div class="ake-ui-card__body"><div class="v2i-craft-flow"><div class="v2i-craft-side">${recipe.inputs.length ? recipe.inputs.map(entry => renderCraftItem(entry, itemTable, data.itemId)).join('') : `<span class="v2i-craft-empty">${t('craft.noMaterials')}</span>`}</div><span class="v2i-craft-arrow">→</span><div class="v2i-craft-side">${recipe.outputs.map(entry => renderCraftItem(entry, itemTable, data.itemId)).join('')}</div></div></div>
                </div>`;
            const renderGroup = (title, rows) => rows.length ? `<div class="v2i-craft-group"><h4>${title}</h4>${rows.map(renderRecipe).join('')}</div>` : '';
            return `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.craftingPaths')}</h3></div><div class="v2i-craft-groups">${renderGroup(t('craft.sources'), incoming)}${renderGroup(t('craft.uses'), outgoing)}</div></div>`;
        }

        function renderExtraTables(data) {
            let h = '';
            const showHidden = getCurrentShowHidden();

            if (showHidden && data.weaponpotentialuptable) {
                const wpns = data.weaponpotentialuptable.weaponIds || [];
                if (wpns.length) {
                    h += `<div class="ake-ui-section">
                        <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.applicableWeapons')}</h3></div>
                        <div class="ake-ui-detail-badges">${wpns.map(id => `<span class="ake-ui-badge">${id}</span>`).join('')}</div>
                    </div>`;
                }
            }

            if (showHidden && data.usableitemchesttable) {
                const ch = data.usableitemchesttable;
                const rwd = ch.rewardIdList || [];
                h += `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.choiceBoxContents')}</h3></div>`;
                if (ch.selectedCount) h += `<div class="v2i-chest-meta">${t('choiceBox.selectableCount', { count: valueTip(ch.selectedCount, ch.selectedCount, 'selectedCount') })}</div>`;
                if (rwd.length) h += `<div class="ake-ui-detail-badges">${rwd.map(id => `<span class="ake-ui-badge">${id}</span>`).join('')}</div>`;
                h += `</div>`;
            }

            if (data.itemiconcompositetable) {
                const c = data.itemiconcompositetable;
                h += `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.iconComposite')}</h3></div><div class="v2i-props-grid">`;
                h += `<div class="v2i-prop-item"><span class="v2i-prop-label">${t('iconComposite.type')}</span><span class="v2i-prop-value">${valueTip(c.iconTransType, c.iconTransType, 'iconTransType')}</span></div>`;
                if (c.showRarity !== undefined) h += `<div class="v2i-prop-item"><span class="v2i-prop-label">${t('iconComposite.showRarity')}</span><span class="v2i-prop-value">${valueTip(c.showRarity ? commonT('yes') : commonT('no'), c.showRarity, 'showRarity')}</span></div>`;
                if (c.markIcon) h += `<div class="v2i-prop-item"><span class="v2i-prop-label">${t('iconComposite.markIcon')}</span><span class="v2i-prop-value">${c.markIcon}</span></div>`;
                h += `</div></div>`;
            }

            if (data.itemshowingtypetable) {
                const s = data.itemshowingtypetable;
                h += `<div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.displayType')}</h3></div>
                    <span class="ake-ui-badge">${s.name?.text || s.type}</span>
                </div>`;
            }

            if (showHidden && data.wikientrydatatable) {
                const w = data.wikientrydatatable;
                h += `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.encyclopediaEntry')}</h3></div><div class="v2i-props-grid">`;
                h += `<div class="v2i-prop-item"><span class="v2i-prop-label">${t('encyclopedia.entryId')}</span><span class="v2i-prop-value">${w.id}</span></div>`;
                if (w.groupId) h += `<div class="v2i-prop-item"><span class="v2i-prop-label">${t('encyclopedia.group')}</span><span class="v2i-prop-value">${w.groupId}</span></div>`;
                h += `</div></div>`;
            }

            return h;
        }

        function renderDetail(data, item) {
            const it = data.itemtable || {};
            const itt = data.itemtypetable || {};
            const name = it.name?.text || data.name || item.name;
            const rarity = it.rarity ?? item.rarity;
            const iconId = it.iconId || '';
            const iconBig = iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png` : (item.icon || '');
            const typeName = getTypeName(it.type, itt);
            const desc = it.desc?.text || '';
            const decoDesc = it.decoDesc?.text || '';
            const showDeco = decoDesc && decoDesc !== desc;
            const detailHeader = window.AKEUI.detailHeader({
                icon: { src: iconBig },
                title: name,
                id: data.itemId || item.itemId,
                badges: [
                    commonT('rarityLabel', { rarity }),
                    typeName
                ]
            });

            let html = `
                <div class="ake-ui-detail" data-detail-kind="item" data-accent="rarity" data-accent-value="${rarity}">
                    ${detailHeader?.outerHTML || ''}
            `;

            if (desc) html += `<div class="v2i-desc">${parseText(desc)}</div>`;
            if (showDeco) html += `<div class="v2i-deco-desc">${parseText(decoDesc)}</div>`;
            html += renderUseEffects(data);
            html += renderProperties(it, itt);
            html += renderCraftRecipes(data);
            html += renderObtainWays(data);
            html += renderExtraTables(data);
            html += '</div>';
            return html;
        }

        async function refreshModule() {
            const list = document.getElementById('v2itemList');
            const detail = document.getElementById('v2itemDetail');
            if (!list || !detail) return;

            const showHidden = getCurrentShowHidden();
            allItems = await loadItemManifest(showHidden);
            generateFilterButtons();
            renderItemList();
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
            document.getElementById('v2itemDetail')?.addEventListener('click', event => {
                const link = event.target.closest('.v2i-craft-item[data-item-id]');
                if (!link) return;
                if (navigateToItem(link.dataset.itemId)) event.preventDefault();
            });

            window.addEventListener('globalConfigChanged', () => {
                searchTerm = '';
                const si = document.getElementById('v2itemSearchInput');
                if (si) si.value = '';
                selectedRarities.clear();
                selectedCategories.clear();
                refreshModule();
            });

            document.getElementById('v2itemSearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderItemList();
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
