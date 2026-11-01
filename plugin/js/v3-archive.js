(function () {
    'use strict';

    const MODULE_ID = 'v3_archive';
    const root = document.getElementById('akeArchiveModule');
    if (!root || !window.AKEV3) return;

    window.__akeArchiveController?.destroy?.();

    const archiveT = window.akeI18n?.scope?.('modules.archive')
        || ((key, params, fallback) => fallback ?? key);
    const t = (key, params, fallback) => archiveT(key, params, fallback);
    const elements = {
        sidebar: document.getElementById('akeArchiveSidebar'),
        meta: document.getElementById('akeArchiveMeta'),
        home: document.getElementById('akeArchiveHome'),
        search: document.getElementById('akeArchiveSearch'),
        regionFilter: document.getElementById('akeArchiveRegionFilter'),
        typeFilter: document.getElementById('akeArchiveTypeFilter'),
        directory: document.getElementById('akeArchiveDirectory'),
        content: document.getElementById('akeArchiveContent'),
        mobileButton: document.getElementById('akeArchiveMobileButton'),
        mobileOverlay: document.getElementById('akeArchiveMobileOverlay'),
        mobilePanel: document.getElementById('akeArchiveMobilePanel'),
        mobileClose: document.getElementById('akeArchiveMobileClose'),
        mobileSearch: document.getElementById('akeArchiveMobileSearch'),
        mobileRegionFilter: document.getElementById('akeArchiveMobileRegionFilter'),
        mobileTypeFilter: document.getElementById('akeArchiveMobileTypeFilter'),
        mobileDirectory: document.getElementById('akeArchiveMobileDirectory')
    };
    if (!elements.directory || !elements.content) return;

    const injectedHomeButton = elements.sidebar?.querySelector('.ake-module-home');
    if (injectedHomeButton) {
        const archiveHomeButton = injectedHomeButton.cloneNode(true);
        injectedHomeButton.replaceWith(archiveHomeButton);
        elements.home = archiveHomeButton;
    }

    const pendingDeepId = String(window.__deepLinkId || '');
    window.__deepLinkId = null;
    root.dataset.moduleId = MODULE_ID;
    root.dataset.moduleTitle = t('title', null, '档案库');

    const SPRITE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/';
    const MAP_TEXT_CATEGORY_ID = 'map_text';
    const READING_LIST_CATEGORY_ID = 'reading_list';
    const UNKNOWN_REGION_ID = '__unknown__';
    const READING_LIST_ICON = 'prts_centralAchive_new.png';
    const PAGE_ORDER = Object.freeze(['document', 'multi_media', 'text', 'reading_list', 'map_text']);
    const CATEGORY_PAGE = Object.freeze({
        document: 'document',
        report: 'document',
        media: 'multi_media',
        paper: 'text',
        digital: 'text',
        collection: 'text',
        reading_list: 'reading_list',
        map_text: 'map_text'
    });
    const TABLE_NAMES = Object.freeze([
        'PrtsPage',
        'PrtsCategory',
        'PrtsFirstLv',
        'PrtsAllItem',
        'PrtsInvestigate',
        'PrtsNote',
        'DomainDataTable',
        'RichContentTable',
        'RadioTable',
        'ReadingPopUpTable',
        'ReadingPopUpIconTable',
        'DialogTextTable',
        'PrtsReading',
        'LevelDescTable'
    ]);

    const state = {
        tables: null,
        comparisonVersion: '',
        addedGroupIds: new Set(),
        addedItemIds: new Set(),
        modifiedGroupIds: new Set(),
        modifiedItemIds: new Set(),
        investigationChanges: new Map(),
        investigationNoteChanges: new Map(),
        investigationItemChanges: new Map(),
        readingChanges: new Map(),
        dialogChanges: new Map(),
        pages: [],
        categories: [],
        regions: [],
        groups: [],
        groupMap: new Map(),
        itemMap: new Map(),
        oemPoints: new Map(),
        itemsByGroup: new Map(),
        investigations: [],
        investigationMap: new Map(),
        investigationsByItem: new Map(),
        activeInvestigationId: '',
        investigationListOpen: false,
        popupByContent: new Map(),
        groupSearch: new Map(),
        itemSearch: new Map(),
        query: '',
        activeRegionId: '',
        activePageType: '',
        activeGroupId: '',
        activeItemId: '',
        overviewState: null,
        gender: 'f',
        mobileReturnFocus: null,
        loadToken: 0,
        disposed: false
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        })[character]);
    }

    function gameText(ref, fallback) {
        return window.AKEV3.text(ref, fallback || '');
    }

    function showTechnicalIds() {
        return window.akeData?.getConfig?.().showHidden === true;
    }

    function displayEntityText(ref, technicalValues, fallback) {
        const value = gameText(ref);
        const technical = (technicalValues || []).map(item => String(item || '')).filter(Boolean);
        if (value && (showTechnicalIds() || !technical.includes(value))) return value;
        if (showTechnicalIds()) return value || technical[0] || fallback || '';
        return fallback || '';
    }

    function groupDisplayName(group) {
        if (group?.categoryId === READING_LIST_CATEGORY_ID) {
            return displayEntityText(
                group?.name,
                [group?.contentId, group?.readingUniqId, group?.firstLvId],
                t('empty.untitledGroup', null, '未命名档案')
            );
        }
        return displayEntityText(
            group?.name,
            group?.categoryId === MAP_TEXT_CATEGORY_ID
                ? [group?.dialogId, group?.firstLvId]
                : [group?.firstLvId, group?.contentId],
            t('empty.untitledGroup', null, '未命名档案')
        );
    }

    function itemDisplayName(item, fallback) {
        return displayEntityText(
            item?.name,
            item?.type === 'map_text'
                ? [item?.contentId, item?.id]
                : [item?.id, item?.contentId],
            fallback || t('empty.untitledEntry', null, '未命名条目')
        );
    }

    function investigationDisplayName(row) {
        return displayEntityText(row?.name, [row?.id], t('investigate.unnamed', null, '未命名调查'));
    }

    function investigationSectionName(row) {
        return displayEntityText(row?.name, [], t('investigate.unnamedSection', null, '未命名报告'));
    }

    function pageDisplayName(page) {
        return displayEntityText(page?.name, [page?.pageType], t('title', null, '档案库'));
    }

    function categoryDisplayName(category) {
        return displayEntityText(category?.name, [category?.categoryId], t('details.category', null, '分类'));
    }

    function groupSecondary(group, page, item) {
        if (group?.categoryId === READING_LIST_CATEGORY_ID) {
            const subtitle = gameText(group?.subName)
                || t('readingList.category', null, '任务文本');
            if (showTechnicalIds() && group?.readingSourceId) return `${subtitle} · ${group.readingSourceId}`;
            return subtitle;
        }
        if (group?.categoryId === MAP_TEXT_CATEGORY_ID && !showTechnicalIds()) {
            return categoryDisplayName(categoryForGroup(group));
        }
        return displayEntityText(
            group?.subName,
            [group?.firstLvId, group?.levelDataPath, group?.levelDataType],
            ''
        ) || displayEntityText(item?.desc, [item?.id, item?.contentId], '') || pageDisplayName(page);
    }

    function gameHtml(value) {
        const source = String(value || '');
        return window.parseText
            ? window.parseText(source)
            : escapeHtml(source).replace(/\r?\n/g, '<br>');
    }

    function gamePlainText(value) {
        return String(value || '')
            .replace(/<image(?:\s[^>]*)?>[\s\S]*?<\/image>/gi, '')
            .replace(/<image[^>]*>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function interpolate(template, params) {
        return String(template || '').replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match);
    }

    function tr(key, params, fallback) {
        const translated = t(key, params, fallback);
        return interpolate(translated, params);
    }

    function assetUrl(folder, name) {
        if (!name) return '';
        const file = /\.[a-z0-9]+$/i.test(String(name)) ? String(name) : `${name}.png`;
        const path = encodeURI(`${SPRITE_ROOT}${folder}/${file}`);
        return window.akeDataSource?.resolveImageUrl?.(path) || path;
    }

    function pageIcon(page) {
        if (page?.pageType === READING_LIST_CATEGORY_ID) return assetUrl('prts/icon', READING_LIST_ICON);
        return assetUrl('prts', page?.icon);
    }

    function groupIcon(group) {
        const icon = String(group?.icon || '');
        return icon ? assetUrl('prts/icon', icon) : '/icon_default_missing.png';
    }

    function imageTag(source, className, alt, extraAttributes, fallbackMode) {
        if (!source) return '';
        const fallbackAttribute = fallbackMode === 'global' ? '' : ' data-ake-image-fallback="defer"';
        return `<img class="${escapeHtml(className || '')}" src="${escapeHtml(source)}" alt="${escapeHtml(alt || '')}"${fallbackAttribute}${extraAttributes || ''}>`;
    }

    function groupIconTag(group, alt, className) {
        return imageTag(groupIcon(group), className === undefined ? 'ake-ui-directory__item-icon' : className, alt || '', alt ? '' : ' aria-hidden="true"', 'global');
    }

    function safeOrder(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
    }

    function compareRows(a, b, idField) {
        return safeOrder(a?.order) - safeOrder(b?.order)
            || gameText(a?.name, '').localeCompare(gameText(b?.name, ''), undefined, { numeric: true })
            || String(a?.[idField] || '').localeCompare(String(b?.[idField] || ''), 'en');
    }

    function tableEntityIds(table, idField) {
        return new Set(Object.entries(table || {}).map(([key, row]) => String(row?.[idField] || key)).filter(Boolean));
    }

    function stableSignature(value) {
        return JSON.stringify(value, (key, child) => {
            if (!child || typeof child !== 'object' || Array.isArray(child)) return child;
            return Object.keys(child).sort().reduce((result, childKey) => {
                result[childKey] = child[childKey];
                return result;
            }, {});
        });
    }

    function readingEntrySignatures(table) {
        const result = new Map();
        Object.entries(table || {}).forEach(([sourceId, reading]) => {
            Object.entries(reading?.list || {}).forEach(([listId, entry]) => {
                result.set(`${sourceId}:${listId}`, stableSignature({
                    contentId: entry?.contentId || '',
                    order: entry?.order,
                    overrideRadioId: entry?.overrideRadioId || '',
                    prtsId: entry?.prtsId || '',
                    uniqId: entry?.uniqId || ''
                }));
            });
        });
        return result;
    }

    function dialogSignatures(table) {
        const result = new Map();
        dialogLineIndex(table).forEach((lines, dialogId) => {
            result.set(dialogId, stableSignature(lines));
        });
        return result;
    }

    function compareEntitySignatures(current, baseline, changes) {
        current.forEach((signature, key) => {
            if (!baseline.has(key)) changes.set(key, 'added');
            else if (baseline.get(key) !== signature) changes.set(key, 'modified');
        });
    }

    function prepareVersionChanges(raw, baselineRaw, comparison) {
        state.comparisonVersion = '';
        state.addedGroupIds.clear();
        state.addedItemIds.clear();
        state.modifiedGroupIds.clear();
        state.modifiedItemIds.clear();
        state.investigationChanges.clear();
        state.investigationNoteChanges.clear();
        state.investigationItemChanges.clear();
        state.readingChanges.clear();
        state.dialogChanges.clear();
        if (!comparison?.baseline || !baselineRaw) return;
        const baselineVersion = String(comparison.baseline.id || comparison.baseline.gameVersion || '');
        if (!baselineVersion) {
            console.warn('Archive version comparison was skipped because the baseline version is missing');
            return;
        }
        const baselineGroups = baselineRaw.PrtsFirstLv || {};
        const baselineItems = baselineRaw.PrtsAllItem || {};
        const hasBaselineData = [baselineGroups, baselineItems, baselineRaw.PrtsReading, baselineRaw.DialogTextTable]
            .some(table => Object.keys(table || {}).length);
        if (!hasBaselineData) {
            console.warn('Archive version comparison was skipped because the baseline tables are empty');
            return;
        }
        const includeAdded = comparison.showAdded !== false;
        if (includeAdded && Object.keys(baselineGroups).length) {
            const baselineGroupIds = tableEntityIds(baselineGroups, 'firstLvId');
            tableEntityIds(raw.PrtsFirstLv, 'firstLvId').forEach(id => {
                if (!baselineGroupIds.has(id)) state.addedGroupIds.add(id);
            });
        }
        if (includeAdded && Object.keys(baselineItems).length) {
            const baselineItemIds = tableEntityIds(baselineItems, 'id');
            tableEntityIds(raw.PrtsAllItem, 'id').forEach(id => {
                if (!baselineItemIds.has(id)) state.addedItemIds.add(id);
            });
        }
        if (Object.keys(baselineRaw.PrtsReading || {}).length) {
            compareEntitySignatures(
                readingEntrySignatures(raw.PrtsReading),
                readingEntrySignatures(baselineRaw.PrtsReading),
                state.readingChanges
            );
        }
        if (Object.keys(baselineRaw.DialogTextTable || {}).length) {
            compareEntitySignatures(
                dialogSignatures(raw.DialogTextTable),
                dialogSignatures(baselineRaw.DialogTextTable),
                state.dialogChanges
            );
        }
        if (Object.keys(baselineRaw.PrtsInvestigate || {}).length) {
            compareEntitySignatures(
                new Map(Object.entries(raw.PrtsInvestigate || {}).map(([id, row]) => [id, stableSignature(row)])),
                new Map(Object.entries(baselineRaw.PrtsInvestigate).map(([id, row]) => [id, stableSignature(row)])),
                state.investigationChanges
            );
        }
        if (Object.keys(baselineRaw.PrtsNote || {}).length) {
            compareEntitySignatures(
                new Map(Object.entries(raw.PrtsNote || {}).map(([id, row]) => [id, stableSignature(row)])),
                new Map(Object.entries(baselineRaw.PrtsNote).map(([id, row]) => [id, stableSignature(row)])),
                state.investigationNoteChanges
            );
        }
        const investigationItemIds = new Set(Object.values(raw.PrtsInvestigate || {}).flatMap(row =>
            [...(row.collectionIdList || []), row.unlockPrts].filter(Boolean).map(String)));
        if (Object.keys(baselineItems).length) {
            investigationItemIds.forEach(id => {
                const item = raw.PrtsAllItem?.[id];
                const previous = baselineItems[id];
                if (!item) return;
                if (!previous) {
                    if (includeAdded) state.investigationItemChanges.set(id, 'added');
                } else if (stableSignature(item) !== stableSignature(previous)) {
                    state.investigationItemChanges.set(id, 'modified');
                }
            });
        }
        if (Object.keys(baselineRaw.RichContentTable || {}).length) {
            investigationItemIds.forEach(id => {
                const item = raw.PrtsAllItem?.[id];
                const contentId = String(item?.contentId || '');
                if (!contentId || state.investigationItemChanges.get(id) === 'added') return;
                const content = raw.RichContentTable?.[contentId];
                const previous = baselineRaw.RichContentTable[contentId];
                if (!content) return;
                if (!previous) {
                    if (includeAdded) state.investigationItemChanges.set(id, 'added');
                } else if (stableSignature(content) !== stableSignature(previous)) {
                    state.investigationItemChanges.set(id, 'modified');
                }
            });
        }
        if (!includeAdded) {
            for (const changes of [state.readingChanges, state.dialogChanges, state.investigationChanges, state.investigationNoteChanges]) {
                for (const [key, change] of changes) {
                    if (change === 'added') changes.delete(key);
                }
            }
        }
        state.comparisonVersion = baselineVersion;
    }

    function normalizeSearch(value) {
        return String(value || '')
            .normalize('NFKC')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase();
    }

    function regionIdFromValue(value) {
        const match = String(value || '')
            .replace(/\\/g, '/')
            .match(/(?:^|[^a-z0-9])((?:map|base|dung)\d+_lv\d+)(?=$|[^a-z0-9])/i);
        return match ? match[1] : '';
    }

    function resolveRegion(values) {
        const levelDesc = state.tables?.levelDesc || {};
        const byId = new Map(Object.entries(levelDesc).map(([id, row]) => [String(id).toLocaleLowerCase(), { id, row }]));
        for (const value of values || []) {
            const candidate = regionIdFromValue(value);
            const match = byId.get(candidate.toLocaleLowerCase());
            if (!match) continue;
            return {
                id: String(match.id),
                name: gameText(match.row?.showName, '')
            };
        }
        return { id: '', name: '' };
    }

    function annotateRegions() {
        const regionMap = new Map();
        const items = Object.values(state.tables?.items || {});
        state.groups.forEach(group => {
            const groupItems = items.filter(item => String(item?.firstLvId || '') === String(group.firstLvId || ''));
            const values = [
                group.firstLvId,
                group.contentId,
                group.levelDataPath,
                group.levelDataType,
                ...(group.levelScriptPaths || []),
                ...groupItems.flatMap(item => [
                    item?.id,
                    item?.contentId,
                    item?.levelDataPath,
                    item?.levelDataType,
                    ...(item?.levelScriptPaths || [])
                ])
            ];
            const region = resolveRegion(values);
            group.regionId = region.id;
            group.regionName = region.name;
            if (region.id) regionMap.set(region.id, region.name);
            groupItems.forEach(item => {
                item.regionId = region.id;
                item.regionName = region.name;
            });
        });
        state.regions = [...regionMap.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }) || a.id.localeCompare(b.id, 'en'));
    }

    function archiveFilterChanged() {
        state.overviewState = null;
        state.activeItemId = '';
        state.activeGroupId = '';
        renderDirectories();
        renderOverview();
        window.__akeRouter?.updateUrl?.(MODULE_ID, '');
    }

    function renderArchiveFilters() {
        const unknownCount = state.groups.filter(group => !group.regionId).length;
        const regionOptions = [
            { value: '', label: '全部地区' },
            ...state.regions.map(region => ({ value: region.id, label: region.name || '未命名地区' })),
            ...(unknownCount ? [{ value: UNKNOWN_REGION_ID, label: '未标注地区' }] : [])
        ];
        const typeOptions = [
            { value: '', label: '全部类型' },
            ...state.pages.map(page => ({ value: String(page.pageType || ''), label: pageDisplayName(page) }))
        ];
        const renderButtons = (container, options, activeValue, onChange) => {
            if (!container) return;
            container.replaceChildren(...options.map(option => window.AKEUI.filterButton({
                label: option.label,
                pressed: activeValue === option.value,
                mode: 'single',
                attributes: { 'data-filter-value': option.value },
                onChange: () => {
                    onChange(option.value);
                    renderArchiveFilters();
                    archiveFilterChanged();
                }
            })));
        };
        renderButtons(elements.regionFilter, regionOptions, state.activeRegionId, value => {
            state.activeRegionId = value;
        });
        renderButtons(elements.mobileRegionFilter, regionOptions, state.activeRegionId, value => {
            state.activeRegionId = value;
        });
        renderButtons(elements.typeFilter, typeOptions, state.activePageType, value => {
            state.activePageType = value;
        });
        renderButtons(elements.mobileTypeFilter, typeOptions, state.activePageType, value => {
            state.activePageType = value;
        });
        const activeCount = Number(Boolean(state.activeRegionId)) + Number(Boolean(state.activePageType));
        [
            document.getElementById('akeArchiveFilterBar'),
            document.getElementById('akeArchiveMobileFilterBar')
        ].forEach(panel => window.AKEUI?.updateFilterPanel?.(panel, {
            summary: activeCount ? `筛选（${activeCount}）` : '筛选'
        }));
    }

    function pageTypeForCategory(categoryId) {
        if (CATEGORY_PAGE[categoryId]) return CATEGORY_PAGE[categoryId];
        const group = state.groups.find(row => row.categoryId === categoryId);
        return state.itemsByGroup.get(group?.firstLvId)?.[0]?.type || 'text';
    }

    function pageForCategory(categoryId) {
        const type = pageTypeForCategory(categoryId);
        return state.pages.find(page => page.pageType === type) || null;
    }

    function categoryForGroup(group) {
        return state.categories.find(category => category.categoryId === group?.categoryId) || null;
    }

    function itemRowsForGroup(groupId) {
        return state.itemsByGroup.get(String(groupId || '')) || [];
    }

    function groupVersionInfo(groupId) {
        const normalizedId = String(groupId || '');
        const addedItemCount = itemRowsForGroup(normalizedId)
            .filter(item => state.addedItemIds.has(String(item.id || ''))).length;
        const isNewGroup = state.addedGroupIds.has(normalizedId);
        const modifiedItemCount = itemRowsForGroup(normalizedId)
            .filter(item => state.modifiedItemIds.has(String(item.id || ''))).length;
        const isModifiedGroup = state.modifiedGroupIds.has(normalizedId);
        const hasAddition = isNewGroup || addedItemCount > 0;
        const hasModification = isModifiedGroup || modifiedItemCount > 0;
        return {
            isNewGroup,
            addedItemCount,
            isModifiedGroup,
            modifiedItemCount,
            hasAddition,
            hasModification,
            hasChange: hasAddition || hasModification
        };
    }

    function groupChangeRank(groupId) {
        const info = groupVersionInfo(groupId);
        return info.hasAddition ? 0 : info.hasModification ? 1 : 2;
    }

    function addedTag(label, compact, tone = 'added') {
        return `<span class="ake-ui-badge" data-tone="${escapeHtml(tone)}"${compact ? ' data-density="compact"' : ''}>${escapeHtml(label)}</span>`;
    }

    function groupChangeTag(info, compact) {
        if (!info?.hasChange) return '';
        if (info.hasAddition) {
            const label = compact || info.isNewGroup
                ? t('changes.added', null, '新增')
                : tr('changes.addedEntries', { count: info.addedItemCount }, `新增 ${info.addedItemCount} 条记录`);
            return addedTag(label, compact);
        }
        return addedTag(t('changes.modified', null, '修改'), compact, 'modified');
    }

    function itemChangeTag(item) {
        const itemId = String(item?.id || '');
        if (state.addedItemIds.has(itemId)) return addedTag(t('changes.added', null, '新增'), true);
        if (state.modifiedItemIds.has(itemId)) return addedTag(t('changes.modified', null, '修改'), true, 'modified');
        return '';
    }

    function detailChangeTag(group, item) {
        const groupId = String(group?.firstLvId || '');
        const itemId = String(item?.id || '');
        if (state.addedGroupIds.has(groupId) || state.addedItemIds.has(itemId)) {
            return addedTag(t('changes.added', null, '新增'));
        }
        if (state.modifiedGroupIds.has(groupId) || state.modifiedItemIds.has(itemId)) {
            return addedTag(t('changes.modified', null, '修改'), false, 'modified');
        }
        return '';
    }

    function comparisonLabel(value = state.comparisonVersion) {
        return String(value || '').split('@')[0];
    }

    function popupForItem(item) {
        return state.popupByContent.get(String(item?.contentId || '')) || null;
    }

    function itemVoiceId(item, popup) {
        return String(item?.overrideRadioId || popup?.overrideRadioId || '').trim();
    }

    function radioForItem(item) {
        const contentId = String(item?.contentId || '');
        const rich = state.tables?.richContent?.[contentId] || null;
        const inferredRadioId = !rich && contentId.startsWith('text_')
            ? `radio_${contentId.slice(5)}`
            : '';
        const radioId = String(item?.radioId || (contentId.startsWith('radio_') ? contentId : inferredRadioId)).trim();
        return radioId ? state.tables?.radio?.[radioId] || null : null;
    }

    function contentDisplayTitle(ref, item, fallback) {
        return displayEntityText(
            ref,
            [item?.contentId, item?.id],
            fallback || itemDisplayName(item)
        );
    }

    function popupLogo(popup) {
        if (!popup || !popup.iconType) return '';
        const iconGroup = state.tables.popupIcons?.[String(popup.iconType)]?.iconMap || {};
        const mediumByBgType = { 0: '0', 1: '1', 2: '1' };
        const medium = mediumByBgType[Number(popup.bgType)];
        if (medium === undefined) return '';
        const icon = iconGroup[medium]?.icon || '';
        return assetUrl('readingpoplogo', icon);
    }

    function dialogLineIndex(dialogTable) {
        const result = new Map();
        Object.entries(dialogTable || {}).forEach(([rowId, row]) => {
            const match = String(rowId).match(/^(dlg_.+)_(\d+)$/);
            if (!match) return;
            if (!result.has(match[1])) result.set(match[1], []);
            result.get(match[1]).push({ ...row, rowId, rowNumber: Number(match[2]) });
        });
        result.forEach(lines => lines.sort((a, b) => a.rowNumber - b.rowNumber
            || String(a.rowId).localeCompare(String(b.rowId), 'en')));
        return result;
    }

    function mapTextRecords(dialogTable, assetIndex) {
        const dialogLinesById = dialogLineIndex(dialogTable);
        const files = assetIndex?.datasets?.json?.files;
        if (!files || typeof files !== 'object') {
            throw new Error(t('mapText.indexUnavailable', null, '资产索引中缺少 Json 数据集'));
        }
        const levelDataFiles = Object.entries(files)
            .filter(([path]) => path.startsWith('LevelData/') && path.toLocaleLowerCase().endsWith('.json'))
            .sort(([a], [b]) => a.localeCompare(b, 'en'));
        const incomplete = levelDataFiles.filter(([, record]) => !Array.isArray(record?.meta?.narrativeDialogIds));
        if (incomplete.length) {
            throw new Error(tr(
                'mapText.incompleteIndex',
                { count: incomplete.length },
                `${incomplete.length} 个 LevelData 尚未完成地图文本索引`
            ));
        }

        const groups = {};
        const items = {};
        let groupOrder = 0;
        levelDataFiles.forEach(([path, record]) => {
            const dialogIds = record.meta.narrativeDialogIds;
            if (!dialogIds.length) return;
            const filename = path.split('/').pop().replace(/\.json$/i, '');
            const gameVersion = comparisonLabel(record.version);
            dialogIds.forEach(dialogId => {
                const groupId = `map_text:${path}:${dialogId}`;
                const itemId = `${groupId}:entry`;
                const firstLine = dialogLinesById.get(dialogId)?.[0];
                const preview = gamePlainText(gameText(firstLine?.dialogText));
                groups[groupId] = {
                    firstLvId: groupId,
                    categoryId: MAP_TEXT_CATEGORY_ID,
                    name: preview,
                    subName: filename,
                    icon: 'prts_centralAchive_basic',
                    order: groupOrder++,
                    levelDataPath: path,
                    levelDataType: filename,
                    dialogId,
                    jsonGameVersion: gameVersion
                };
                items[itemId] = {
                    id: itemId,
                    firstLvId: groupId,
                    contentId: dialogId,
                    type: 'map_text',
                    name: preview,
                    desc: dialogId,
                    levelDataPath: path,
                    levelDataType: filename,
                    jsonGameVersion: gameVersion,
                    order: 0
                };
            });
        });
        return {
            page: {
                pageType: 'map_text',
                name: t('mapText.category', null, '地图文本'),
                icon: 'icon/prts_centralAchive_basic'
            },
            category: {
                categoryId: MAP_TEXT_CATEGORY_ID,
                name: t('mapText.category', null, '地图文本'),
                order: Number.MAX_SAFE_INTEGER
            },
            groups,
            items,
            dialogLinesById
        };
    }

    function indexedReadingReferences(assetIndex, popups) {
        const refs = window.akeAssetIndex.readingReferences(assetIndex, popups);
        state.narrativeDiagnostics = refs.diagnostics.slice();
        state.readingReferences = refs.byContentId;
        return {
            byContentId: new Map([...refs.byContentId].map(([id, rows]) => [id, rows.map(row => row.path)])),
            byUniqId: refs.byUniqId
        };
    }

    function supplementalReadingRecords(raw, assetIndex) {
        const linkedContentIds = new Set(Object.values(raw.PrtsAllItem || {})
            .map(item => String(item?.contentId || ''))
            .filter(Boolean));
        const linkedItemIds = new Set(Object.values(raw.PrtsAllItem || {})
            .map(item => String(item?.id || ''))
            .filter(Boolean));
        const popupByContent = new Map();
        Object.values(raw.ReadingPopUpTable || {}).forEach(popup => {
            const contentId = String(popup?.contentId || '');
            if (contentId && !popupByContent.has(contentId)) popupByContent.set(contentId, popup);
        });
        const groups = {};
        const items = {};
        const readingEntries = [];
        const readingByContentId = new Map();
        Object.entries(raw.PrtsReading || {}).forEach(([sourceId, reading]) => {
            Object.entries(reading?.list || {})
                .sort(([, a], [, b]) => safeOrder(a?.order) - safeOrder(b?.order))
                .forEach(([listId, entry]) => {
                const contentId = String(entry?.contentId || '');
                if (!contentId) return;
                const record = { ...entry, sourceId, listId };
                readingEntries.push(record);
                if (!readingByContentId.has(contentId)) readingByContentId.set(contentId, record);
            });
        });
        const references = indexedReadingReferences(assetIndex, raw.ReadingPopUpTable);
        const contentIds = new Set(readingEntries.map(entry => String(entry.contentId || '')));
        references.byContentId.forEach((_, contentId) => contentIds.add(contentId));
        const resolveContent = (contentId, reading) => {
            const popup = popupByContent.get(contentId) || null;
            const rich = raw.RichContentTable?.[contentId] || null;
            const override = String(reading?.overrideRadioId || popup?.overrideRadioId || '').trim();
            const inferredRadioId = !rich && contentId.startsWith('text_')
                ? `radio_${contentId.slice(5)}`
                : '';
            const radioId = override.startsWith('radio_')
                ? override
                : contentId.startsWith('radio_') ? contentId : inferredRadioId;
            const radio = radioId ? raw.RadioTable?.[radioId] || null : null;
            return {
                popup,
                rich,
                radio,
                radioId,
                voiceId: override.startsWith('au_') ? override : ''
            };
        };
        const generatedContentIds = new Set();
        const referencePathsFor = (contentId, reading) => [
            ...(references.byContentId.get(contentId) || []),
            ...(references.byUniqId.get(String(reading?.uniqId || '')) || [])
        ].filter((path, index, paths) => paths.indexOf(path) === index);
        const appendRecord = (contentId, reading, order, orphan) => {
            if (linkedContentIds.has(contentId) || linkedItemIds.has(String(reading?.prtsId || ''))) return;
            const content = resolveContent(contentId, reading);
            const title = gameText(reading?.name)
                || gameText(content.rich?.title)
                || gameText(content.popup?.title)
                || '';
            const sourceKey = reading
                ? `${reading.sourceId}:${reading.uniqId || reading.listId || contentId}`
                : `orphan:${contentId}`;
            const readingEntryKey = reading ? `${reading.sourceId}:${reading.listId}` : '';
            const groupId = `${READING_LIST_CATEGORY_ID}:${sourceKey}`;
            const itemId = `${groupId}:entry`;
            const levelScriptPaths = referencePathsFor(contentId, reading);
            groups[groupId] = {
                firstLvId: groupId,
                categoryId: READING_LIST_CATEGORY_ID,
                name: title || t('readingList.unnamed', null, '任务文本'),
                subName: gameText(reading?.subtitle),
                icon: READING_LIST_ICON,
                order,
                contentId,
                readingSourceId: reading?.sourceId || '',
                readingListId: reading?.listId || '',
                readingUniqId: reading?.uniqId || '',
                readingEntryKey,
                levelScriptPaths,
                readingReferences: state.readingReferences.get(contentId) || [],
                orphan: Boolean(orphan)
            };
            items[itemId] = {
                id: itemId,
                firstLvId: groupId,
                contentId,
                name: title || t('readingList.unnamed', null, '任务文本'),
                desc: '',
                overrideRadioId: content.voiceId,
                radioId: content.radioId,
                type: content.radio ? 'multi_media' : 'text',
                order: 0,
                readingSourceId: reading?.sourceId || '',
                readingListId: reading?.listId || '',
                readingUniqId: reading?.uniqId || '',
                readingEntryKey,
                levelScriptPaths,
                readingReferences: state.readingReferences.get(contentId) || [],
                orphan: Boolean(orphan)
            };
            generatedContentIds.add(contentId);
        };
        readingEntries.forEach((reading, order) => {
            appendRecord(String(reading.contentId || ''), reading, order, false);
        });
        [...contentIds].sort((a, b) => a.localeCompare(b, 'en')).forEach((contentId, order) => {
            if (generatedContentIds.has(contentId)) return;
            appendRecord(contentId, readingByContentId.get(contentId) || null, readingEntries.length + order, true);
        });
        return { groups, items };
    }

    function buildIndexes() {
        const includeTechnicalIds = showTechnicalIds();
        state.groupMap.clear();
        state.itemMap.clear();
        state.itemsByGroup.clear();
        state.popupByContent.clear();
        state.groupSearch.clear();
        state.itemSearch.clear();

        state.groups.forEach(group => {
            state.groupMap.set(String(group.firstLvId), group);
            state.itemsByGroup.set(String(group.firstLvId), []);
        });
        Object.values(state.tables.items || {}).forEach(item => {
            const itemId = String(item.id || '');
            if (!itemId) return;
            state.itemMap.set(itemId, item);
            const groupId = String(item.firstLvId || '');
            if (!state.itemsByGroup.has(groupId)) state.itemsByGroup.set(groupId, []);
            state.itemsByGroup.get(groupId).push(item);
        });
        state.itemsByGroup.forEach(items => items.sort((a, b) => {
            const rank = item => state.addedItemIds.has(String(item.id || ''))
                ? 0
                : state.modifiedItemIds.has(String(item.id || '')) ? 1 : 2;
            return rank(a) - rank(b) || compareRows(a, b, 'id');
        }));
        Object.values(state.tables.popups || {}).forEach(popup => {
            const contentId = String(popup.contentId || '');
            if (contentId && !state.popupByContent.has(contentId)) state.popupByContent.set(contentId, popup);
        });

        state.groups.forEach(group => {
            const category = categoryForGroup(group);
            const page = pageForCategory(group.categoryId);
            const ownParts = [
                groupDisplayName(group),
                groupSecondary(group, page),
                categoryDisplayName(category),
                pageDisplayName(page)
            ];
            if (includeTechnicalIds) ownParts.push(
                group.firstLvId,
                group.icon,
                category?.categoryId,
                page?.pageType,
                group.levelDataPath,
                group.levelDataType,
                group.dialogId,
                group.jsonGameVersion,
                group.readingSourceId,
                group.readingListId,
                group.readingUniqId,
                group.readingEntryKey,
                group.regionName,
                ...(group.levelScriptPaths || [])
            );
            state.groupSearch.set(String(group.firstLvId), normalizeSearch(ownParts.join(' ')));
            itemRowsForGroup(group.firstLvId).forEach(item => {
                const rich = state.tables.richContent?.[item.contentId] || null;
                const radio = radioForItem(item);
                const popup = popupForItem(item);
                const parts = [
                    itemDisplayName(item),
                    displayEntityText(item.desc, [item.id, item.contentId], ''),
                    gameText(rich?.title),
                    gameText(popup?.title)
                ];
                if (includeTechnicalIds) parts.push(
                    item.id,
                    item.contentId,
                    item.type,
                    item.readingSourceId,
                    item.readingListId,
                    item.readingUniqId,
                    item.readingEntryKey,
                    item.regionName,
                    ...(item.levelScriptPaths || [])
                );
                (rich?.contentList || []).forEach(entry => parts.push(gameText(entry?.content)));
                (radio?.radioSingleDataList || []).forEach(line => {
                    parts.push(gameText(line.actorName), gameText(line.infoActorName), gameText(line.radioText));
                    if (includeTechnicalIds) parts.push(line.actorNameId);
                });
                if (item.type === 'map_text') {
                    (state.tables.dialogLinesById.get(String(item.contentId || '')) || []).forEach(line => {
                        parts.push(
                            gameText(line.actorName),
                            gameText(line.dialogText),
                            gameText(line.hint)
                        );
                        if (includeTechnicalIds) parts.push(line.rowId, line.actorNameId);
                    });
                    if (includeTechnicalIds) parts.push(item.levelDataPath, item.levelDataType, item.jsonGameVersion);
                }
                state.itemSearch.set(String(item.id), normalizeSearch(parts.join(' ')));
            });
        });
    }

    function investigationVersionInfo(row) {
        const ownChange = state.investigationChanges.get(String(row?.id || ''));
        const itemIds = [...new Set([...(row?.collectionIdList || []), row?.unlockPrts].filter(Boolean).map(String))];
        const noteIds = [...new Set((row?.categoryDataList || []).flatMap(category => category.noteIdList || []).map(String))];
        const itemChanges = itemIds.map(id => state.investigationItemChanges.get(id) ||
            (state.addedItemIds.has(id) ? 'added' : state.modifiedItemIds.has(id) ? 'modified' : ''));
        const noteChanges = noteIds.map(id => state.investigationNoteChanges.get(id) || '');
        const isNewGroup = ownChange === 'added';
        const addedItemCount = itemChanges.filter(change => change === 'added').length
            + noteChanges.filter(change => change === 'added').length;
        const hasAddition = isNewGroup || addedItemCount > 0;
        const hasModification = ownChange === 'modified' || itemChanges.includes('modified') || noteChanges.includes('modified');
        return { isNewGroup, addedItemCount, hasAddition, hasModification, hasChange: hasAddition || hasModification };
    }

    function investigationItemChangeTag(id) {
        const change = state.investigationItemChanges.get(String(id)) ||
            (state.addedItemIds.has(String(id)) ? 'added' : state.modifiedItemIds.has(String(id)) ? 'modified' : '');
        return change ? addedTag(t(`changes.${change}`, null, change === 'added' ? '新增' : '修改'), true, change) : '';
    }

    function investigationNoteChangeTag(id) {
        const change = state.investigationNoteChanges.get(String(id));
        return change ? addedTag(t(`changes.${change}`, null, change === 'added' ? '新增' : '修改'), true, change) : '';
    }

    function prepareInvestigations() {
        state.investigations = Object.values(state.tables.investigations || {}).sort((a, b) =>
            String(a.domainId || '').localeCompare(String(b.domainId || ''), 'en')
            || safeOrder(a.index) - safeOrder(b.index)
            || String(a.id || '').localeCompare(String(b.id || ''), 'en')
        );
        state.investigationMap.clear();
        state.investigationsByItem.clear();
        const unresolved = [];
        state.investigations.forEach(row => {
            state.investigationMap.set(String(row.id), row);
            (row.collectionIdList || []).forEach(id => {
                const key = String(id);
                if (!state.itemMap.has(key)) unresolved.push({ investigation: row.id, kind: 'archive', id: key });
                if (!state.investigationsByItem.has(key)) state.investigationsByItem.set(key, []);
                state.investigationsByItem.get(key).push(row);
            });
            (row.categoryDataList || []).forEach(category => (category.noteIdList || []).forEach(id => {
                if (!state.tables.notes?.[id]) unresolved.push({ investigation: row.id, kind: 'note', id });
            }));
            const reportId = String(row.unlockPrts || '');
            if (reportId) {
                if (!state.itemMap.has(reportId)) unresolved.push({ investigation: row.id, kind: 'report', id: reportId });
                if (!state.investigationsByItem.has(reportId)) state.investigationsByItem.set(reportId, []);
                if (!state.investigationsByItem.get(reportId).includes(row)) state.investigationsByItem.get(reportId).push(row);
            }
        });
        if (unresolved.length) console.warn('Archive investigations contain unresolved references', unresolved);
    }

    function prepareTables(raw, assetIndex) {
        const mapText = mapTextRecords(raw.DialogTextTable || {}, assetIndex);
        const supplementalReading = supplementalReadingRecords(raw, assetIndex);
        for (const [id, references] of state.readingReferences) {
            if (!raw.RichContentTable?.[id] && !raw.RadioTable?.[id]) state.narrativeDiagnostics.push({ reason: 'missing-reading-content', id, references });
        }
        state.tables = {
            pages: {
                ...(raw.PrtsPage || {}),
                [READING_LIST_CATEGORY_ID]: {
                    pageType: READING_LIST_CATEGORY_ID,
                    name: t('readingList.category', null, '任务文本'),
                    icon: `icon/${READING_LIST_ICON.replace(/\.png$/i, '')}`
                },
                [MAP_TEXT_CATEGORY_ID]: mapText.page
            },
            categories: {
                ...(raw.PrtsCategory || {}),
                [MAP_TEXT_CATEGORY_ID]: mapText.category,
                [READING_LIST_CATEGORY_ID]: {
                    categoryId: READING_LIST_CATEGORY_ID,
                    name: t('readingList.category', null, '任务文本'),
                    order: Number.MAX_SAFE_INTEGER
                }
            },
            groups: { ...(raw.PrtsFirstLv || {}), ...mapText.groups, ...supplementalReading.groups },
            items: { ...(raw.PrtsAllItem || {}), ...mapText.items, ...supplementalReading.items },
            investigations: raw.PrtsInvestigate || {},
            notes: raw.PrtsNote || {},
            domains: raw.DomainDataTable || {},
            richContent: raw.RichContentTable || {},
            radio: raw.RadioTable || {},
            popups: raw.ReadingPopUpTable || {},
            popupIcons: raw.ReadingPopUpIconTable || {},
            levelDesc: raw.LevelDescTable || {},
            dialogLinesById: mapText.dialogLinesById
        };
        const pageValues = Object.values(state.tables.pages);
        state.pages = PAGE_ORDER.map(type => pageValues.find(page => page.pageType === type)).filter(Boolean);
        pageValues.forEach(page => {
            if (!state.pages.includes(page)) state.pages.push(page);
        });
        state.categories = Object.values(state.tables.categories).sort((a, b) => {
            return PAGE_ORDER.indexOf(pageTypeForCategory(a.categoryId)) - PAGE_ORDER.indexOf(pageTypeForCategory(b.categoryId))
                || compareRows(a, b, 'categoryId');
        });
        state.groups = Object.values(state.tables.groups).sort((a, b) => {
            const aPage = PAGE_ORDER.indexOf(CATEGORY_PAGE[a.categoryId] || 'text');
            const bPage = PAGE_ORDER.indexOf(CATEGORY_PAGE[b.categoryId] || 'text');
            const aCategory = state.tables.categories[a.categoryId];
            const bCategory = state.tables.categories[b.categoryId];
            return aPage - bPage
                || safeOrder(aCategory?.order) - safeOrder(bCategory?.order)
                || String(a.categoryId || '').localeCompare(String(b.categoryId || ''), 'en')
                || compareRows(a, b, 'firstLvId');
        });
        annotateRegions();
        renderArchiveFilters();
        state.groups.forEach(group => {
            const itemRows = Object.values(state.tables.items || {})
                .filter(item => String(item?.firstLvId || '') === String(group.firstLvId || ''));
            if (group.categoryId === MAP_TEXT_CATEGORY_ID) {
                const change = state.dialogChanges.get(String(group.dialogId || ''));
                if (change === 'added') state.addedGroupIds.add(String(group.firstLvId));
                if (change === 'modified') state.modifiedGroupIds.add(String(group.firstLvId));
                itemRows.forEach(item => {
                    if (change === 'added') state.addedItemIds.add(String(item.id || ''));
                    if (change === 'modified') state.modifiedItemIds.add(String(item.id || ''));
                });
            }
            if (group.categoryId === READING_LIST_CATEGORY_ID) {
                const key = group.readingEntryKey || '';
                const change = state.readingChanges.get(key);
                if (change === 'added') state.addedGroupIds.add(String(group.firstLvId));
                if (change === 'modified') state.modifiedGroupIds.add(String(group.firstLvId));
                itemRows.forEach(item => {
                    if (change === 'added') state.addedItemIds.add(String(item.id || ''));
                    if (change === 'modified') state.modifiedItemIds.add(String(item.id || ''));
                });
            }
        });
        buildIndexes();
        prepareInvestigations();
    }

    function filteredGroups(options) {
        const pageType = options?.pageType || '';
        const result = [];
        state.groups.forEach(group => {
            if (pageType && pageTypeForCategory(group.categoryId) !== pageType) return;
            if (state.activeRegionId === UNKNOWN_REGION_ID && group.regionId) return;
            if (state.activeRegionId && state.activeRegionId !== UNKNOWN_REGION_ID && group.regionId !== state.activeRegionId) return;
            const allItems = itemRowsForGroup(group.firstLvId);
            if (!state.query) {
                result.push({ group, items: allItems, ownMatch: true });
                return;
            }
            const ownMatch = state.groupSearch.get(String(group.firstLvId))?.includes(state.query);
            const items = ownMatch
                ? allItems
                : allItems.filter(item => state.itemSearch.get(String(item.id))?.includes(state.query));
            if (ownMatch || items.length) result.push({ group, items, ownMatch: Boolean(ownMatch) });
        });
        return result;
    }

    function groupEntryCount(records) {
        return records.reduce((sum, record) => sum + record.items.length, 0);
    }

    function directoryRichText(html) {
        const node = document.createElement('span');
        node.innerHTML = html;
        return node;
    }

    function createArchiveHomeItem() {
        return window.AKEUI.directoryItem({
            layout: 'entity',
            title: t('directory.all', null, '全部档案'),
            subtitle: t('overview.subtitle', null, '浏览全部档案与收录内容'),
            icon: { src: pageIcon(state.pages[0]), alt: '' },
            count: state.itemMap.size,
            active: !state.activeGroupId && !state.investigationListOpen && !state.activeInvestigationId,
            attributes: { 'data-akearchive-action': 'show-overview' }
        });
    }

    function directorySubtitle(group, page) {
        const region = archiveRegionLabel(group);
        const content = pageDisplayName(page) || t('title', null, '档案库');
        return `${region} · ${content}`;
    }

    function archiveRegionLabel(group) {
        return group?.regionName || '未标注地区';
    }

    function createArchiveGroupItem(record, page) {
        const group = record.group;
        const secondary = directorySubtitle(group, page);
        const changeInfo = groupVersionInfo(group.firstLvId);
        return window.AKEUI.directoryItem({
            layout: 'entity',
            title: directoryRichText(gameHtml(groupDisplayName(group))),
            subtitle: directoryRichText(gameHtml(secondary)),
            icon: { src: groupIcon(group), alt: '' },
            count: record.items.length,
            change: changeInfo.hasChange
                ? {
                    type: changeInfo.hasAddition ? 'added' : 'modified',
                    label: changeInfo.hasAddition
                        ? t('changes.added', null, '新增')
                        : t('changes.modified', null, '修改')
                }
                : null,
            active: group.firstLvId === state.activeGroupId,
            attributes: {
                'data-akearchive-action': 'open-group',
                'data-group-id': group.firstLvId
            }
        });
    }

    function renderDirectoryNode(node, records, includeHome) {
        if (!node) return;
        const fragment = document.createDocumentFragment();
        if (includeHome) {
            const home = document.createElement('div');
            home.className = 'akearchive-directory-section';
            const homeList = document.createElement('div');
            homeList.className = 'akearchive-directory-list';
            home.appendChild(homeList);
            homeList.appendChild(createArchiveHomeItem());
            fragment.appendChild(home);
        }
        const list = document.createElement('div');
        list.className = 'akearchive-directory-list';
        const rows = [...records].sort((a, b) =>
            groupChangeRank(a.group.firstLvId) - groupChangeRank(b.group.firstLvId)
            || compareRows(a.group, b.group, 'firstLvId')
        );
        list.append(...rows.map(record => createArchiveGroupItem(record, pageForCategory(record.group.categoryId))));
        fragment.appendChild(list);
        if (!records.length) {
            const empty = window.AKEUI.element('div', 'ake-ui-state');
            empty.dataset.state = 'empty';
            empty.appendChild(window.AKEUI.element('p', '', t('empty.search', null, '没有匹配的档案')));
            fragment.appendChild(empty);
        }
        node.replaceChildren(fragment);
    }

    function renderDirectories() {
        const records = filteredGroups();
        renderDirectoryNode(elements.directory, records, false);
        renderDirectoryNode(elements.mobileDirectory, records, true);
        if (!elements.meta) return;
        if (state.query || state.activeRegionId || state.activePageType) {
            elements.meta.textContent = tr('counts.results', { count: records.length }, `找到 ${records.length} 项`);
        } else {
            elements.meta.textContent = `${tr('counts.groups', { count: state.groups.length }, `${state.groups.length} 组档案`)} · ${tr('counts.entries', { count: state.itemMap.size }, `${state.itemMap.size} 条记录`)}`;
        }
    }

    function renderPageTabs(records) {
        return window.AKEUI.tabs({
            variant: 'media',
            role: 'group',
            label: t('overview.title', null, '档案一览'),
            items: state.pages.map(page => {
                const type = String(page.pageType || '');
                const count = groupEntryCount(records.filter(record => pageTypeForCategory(record.group.categoryId) === type));
                return {
                    active: state.activePageType === type,
                    icon: { src: pageIcon(page), alt: '' },
                    label: window.AKEUI.fragment(`<strong>${gameHtml(pageDisplayName(page))}</strong><small>${escapeHtml(tr('counts.entries', { count }, `${count} 条记录`))}</small>`),
                    attributes: { 'data-akearchive-action': 'filter-page', 'data-page-type': type }
                };
            })
        }).outerHTML;
    }

    function renderOverviewCard(record) {
        const group = record.group;
        const category = categoryForGroup(group);
        const subtitle = `${archiveRegionLabel(group)} · ${groupSecondary(group, pageForCategory(group.categoryId), record.items[0])}`;
        const changeInfo = groupVersionInfo(group.firstLvId);
        return window.AKEUI.card({
            interactive: true,
            density: 'compact',
            media: window.AKEUI.fragment(groupIconTag(group, '', '')),
            header: {
                title: window.AKEUI.fragment(gameHtml(groupDisplayName(group))),
                subtitle: window.AKEUI.fragment(gameHtml(subtitle))
            },
            footer: window.AKEUI.fragment(`${groupChangeTag(changeInfo)}<span class="ake-ui-badge">${gameHtml(categoryDisplayName(category))}</span><span class="ake-ui-badge">${escapeHtml(tr('counts.entries', { count: record.items.length }, `${record.items.length} 条记录`))}</span>`),
            attributes: { 'data-akearchive-action': 'open-group', 'data-group-id': group.firstLvId }
        }).outerHTML;
    }

    function renderChangeSection(records, version) {
        if (!records.length || !version) return '';
        return `<section class="ake-ui-section" data-tone="added">
            <header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(tr('changes.group', { version }, `版本差异 · 相比 ${version}`))}</h2><span class="ake-ui-section__meta">${escapeHtml(tr('counts.groups', { count: records.length }, `${records.length} 组档案`))}</span></header>
            <div class="ake-ui-card-grid" data-size="regular">${records.map(renderOverviewCard).join('')}</div>
        </section>`;
    }

    function renderOverview() {
        const allRecords = filteredGroups();
        const records = state.activePageType
            ? allRecords.filter(record => pageTypeForCategory(record.group.categoryId) === state.activePageType)
            : allRecords;
        const changedRecords = records.filter(record => groupVersionInfo(record.group.firstLvId).hasChange)
            .sort((a, b) => groupChangeRank(a.group.firstLvId) - groupChangeRank(b.group.firstLvId));
        const regularRecords = records.filter(record => !groupVersionInfo(record.group.firstLvId).hasChange);
        const changeSections = [
            renderChangeSection(changedRecords, comparisonLabel())
        ].join('');
        const sections = state.categories.map(category => {
            const rows = regularRecords.filter(record => record.group.categoryId === category.categoryId);
            if (!rows.length) return '';
            const entryCount = groupEntryCount(rows);
            return `<section class="ake-ui-section">
                <header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${gameHtml(categoryDisplayName(category))}</h2><span class="ake-ui-section__meta">${escapeHtml(tr('counts.entries', { count: entryCount }, `${entryCount} 条记录`))}</span></header>
                <div class="ake-ui-card-grid" data-size="regular">${rows.map(renderOverviewCard).join('')}</div>
            </section>`;
        }).join('');
        const visibleCount = groupEntryCount(records);
        const noResults = `<div class="ake-ui-state" data-state="empty"><div><h2>${escapeHtml(t('empty.archives', null, '暂无档案'))}</h2><p>${escapeHtml(state.query ? t('empty.search', null, '没有匹配的档案') : t('empty.archives', null, '暂无档案'))}</p></div></div>`;
        elements.content.innerHTML = `<section class="ake-ui-page">
            <header class="ake-ui-page__header">
                <div><h1 class="ake-ui-page__title">${escapeHtml(t('overview.title', null, '档案一览'))}</h1><p class="ake-ui-page__summary">${escapeHtml(t('overview.subtitle', null, '浏览全部档案与收录内容'))}</p></div>
                <div class="ake-ui-page__status akearchive-overview-status">
                    <div class="akearchive-overview-counts"><strong>${escapeHtml(tr('counts.groups', { count: records.length }, `${records.length} 组档案`))}</strong>
                    <span>${escapeHtml(tr('counts.entries', { count: visibleCount }, `${visibleCount} 条记录`))}</span></div>
                    <button type="button" class="ake-ui-button ake-ui-button--secondary" data-akearchive-action="show-investigations">${escapeHtml(t('investigate.title', null, '情报采集'))}</button>
                </div>
            </header>
            ${renderPageTabs(allRecords)}
            ${changeSections}${sections || (changeSections ? '' : noResults)}
        </section>`;
    }

    function investigationDomainName(row) {
        return displayEntityText(state.tables.domains?.[row?.domainId]?.domainName, [row?.domainId],
            t('investigate.unknownRegion', null, '未标注地区'));
    }

    function investigationCard(row) {
        const count = (row.collectionIdList || []).length;
        const changeInfo = investigationVersionInfo(row);
        return window.AKEUI.card({
            interactive: true,
            density: 'compact',
            header: {
                title: window.AKEUI.fragment(gameHtml(investigationDisplayName(row))),
                subtitle: window.AKEUI.fragment(gameHtml(investigationDomainName(row)))
            },
            footer: window.AKEUI.fragment(`${groupChangeTag(changeInfo, true)}<span class="ake-ui-badge">${escapeHtml(tr('investigate.requiredCount', { count }, `关联档案 ${count} 条`))}</span>`),
            attributes: {
                'data-akearchive-action': 'open-investigation',
                'data-investigation-id': row.id,
                'data-ake-entry-plugin': 'v3_archive',
                'data-ake-entry-id': `investigation:${row.id}`
            }
        }).outerHTML;
    }

    function renderInvestigationList() {
        const rows = state.investigations.filter(row => !state.query || normalizeSearch([
            investigationDisplayName(row), investigationDomainName(row), gameText(row.desc),
            ...(row.categoryDataList || []).map(investigationSectionName),
            ...(row.collectionIdList || []).map(id => itemDisplayName(state.itemMap.get(String(id)))),
            ...(row.categoryDataList || []).flatMap(category => (category.noteIdList || [])
                .map(id => gameText(state.tables.notes?.[id]?.desc)))
        ].join(' ')).includes(state.query));
        const changedRows = rows.filter(row => investigationVersionInfo(row).hasChange)
            .sort((a, b) => Number(investigationVersionInfo(b).hasAddition) - Number(investigationVersionInfo(a).hasAddition));
        const regularRows = rows.filter(row => !investigationVersionInfo(row).hasChange);
        const domains = [...new Set(regularRows.map(row => String(row.domainId || '')))];
        elements.content.innerHTML = `<section class="ake-ui-page">
            <header class="ake-ui-page__header"><div><h1 class="ake-ui-page__title">${escapeHtml(t('investigate.title', null, '情报采集'))}</h1>
                <p class="ake-ui-page__summary">${escapeHtml(t('investigate.subtitle', null, '按调查项目查看关联档案、分析批注与报告'))}</p></div>
                <div class="ake-ui-page__status"><strong>${escapeHtml(tr('investigate.count', { count: rows.length }, `${rows.length} 项调查`))}</strong></div>
            </header>
            ${changedRows.length && comparisonLabel() ? `<section class="ake-ui-section" data-tone="added"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(tr('changes.group', { version: comparisonLabel() }, `版本差异 · 相比 ${comparisonLabel()}`))}</h2></header>
                <div class="ake-ui-card-grid" data-size="regular">${changedRows.map(investigationCard).join('')}</div></section>` : ''}
            ${domains.map(domainId => {
                const domainRows = regularRows.filter(row => String(row.domainId || '') === domainId);
                return `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${gameHtml(investigationDomainName(domainRows[0]))}</h2></header>
                    <div class="ake-ui-card-grid" data-size="regular">${domainRows.map(investigationCard).join('')}</div></section>`;
            }).join('') || (!changedRows.length ? `<div class="ake-ui-state" data-state="empty"><div><p>${escapeHtml(t('empty.search', null, '没有匹配的档案'))}</p></div></div>` : '')}
        </section>`;
    }

    function investigationItemContent(id) {
        const item = state.itemMap.get(String(id));
        if (!item) return `<span class="ake-ui-badge">${escapeHtml(t('investigate.missingEntry', null, '关联档案不可用'))}${showTechnicalIds() ? ` · ${escapeHtml(id)}` : ''}</span>`;
        const popup = popupForItem(item);
        return `<div class="akearchive-investigation-entry">
            ${item.type === 'multi_media' ? renderTranscript(item, popup, true) : renderDocument(item, popup, true)}
        </div>`;
    }

    function investigationNoteContent(id, index) {
        const note = state.tables.notes?.[id];
        const body = note
            ? renderRichValue(gameText(note.desc)) || `<p>${escapeHtml(t('investigate.missingNote', null, '批注内容不可用'))}</p>`
            : `<p>${escapeHtml(t('investigate.missingNote', null, '批注内容不可用'))}${showTechnicalIds() ? ` · ${escapeHtml(id)}` : ''}</p>`;
        const card = window.AKEUI.card({
            header: { title: tr('investigate.note', { number: index + 1 }, `批注 ${index + 1}`) },
            attributes: { 'data-card-kind': 'archive-note' }
        });
        card.querySelector('.ake-ui-card__header').insertAdjacentHTML('beforeend', investigationNoteChangeTag(id));
        card.querySelector('.ake-ui-card__content').appendChild(window.AKEUI.element('div', 'ake-ui-card__body', window.AKEUI.fragment(body)));
        return card.outerHTML;
    }

    function renderInvestigation(row) {
        const categories = [...(row.categoryDataList || [])].sort((a, b) => safeOrder(a.index) - safeOrder(b.index));
        const groupedIds = new Set(categories.flatMap(category => category.collectionIdList || []).map(String));
        const ungroupedIds = (row.collectionIdList || []).filter(id => !groupedIds.has(String(id)));
        const changeInfo = investigationVersionInfo(row);
        const header = window.AKEUI.detailHeader({
            beforeTitle: window.AKEUI.fragment(`<div class="ake-ui-detail-meta"><span>${escapeHtml(t('investigate.title', null, '情报采集'))}</span><span>${gameHtml(investigationDomainName(row))}</span><span>${escapeHtml(tr('investigate.requiredCount', { count: (row.collectionIdList || []).length }, `关联档案 ${(row.collectionIdList || []).length} 条`))}</span>${groupChangeTag(changeInfo, true)}${showTechnicalIds() ? `<span>${escapeHtml(row.id)}</span>` : ''}</div>`),
            title: window.AKEUI.fragment(gameHtml(investigationDisplayName(row))),
            subtitle: window.AKEUI.fragment(gameHtml(gameText(row.desc)))
        });
        elements.content.innerHTML = `<article class="ake-ui-detail" data-detail-kind="archive">
            ${header?.outerHTML || ''}
            <div class="akearchive-detail-actions"><button type="button" class="ake-ui-button ake-ui-button--secondary" data-akearchive-action="show-investigations">${escapeHtml(t('investigate.back', null, '返回情报采集'))}</button></div>
            ${categories.map(category => `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${gameHtml(investigationSectionName(category))}</h2>
                <span class="ake-ui-section__meta">${escapeHtml(tr('investigate.noteCount', { count: (category.noteIdList || []).length }, `批注 ${((category.noteIdList || []).length)} 条`))}</span></header>
                <div class="akearchive-investigation-columns"><div class="akearchive-investigation-text">${(category.collectionIdList || []).map(investigationItemContent).join('')}</div>
                    <aside class="akearchive-investigation-notes" aria-label="${escapeHtml(t('investigate.annotations', null, '批注'))}">${(category.noteIdList || []).map(investigationNoteContent).join('')}</aside></div>
            </section>`).join('')}
            ${ungroupedIds.length ? `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('investigate.otherEntries', null, '其他关联档案'))}</h2></header>
                <div class="akearchive-investigation-text">${ungroupedIds.map(investigationItemContent).join('')}</div></section>` : ''}
            ${row.unlockPrts ? `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('investigate.report', null, '分析报告'))}</h2></header>
                <div class="akearchive-investigation-text">${investigationItemContent(row.unlockPrts)}</div></section>` : ''}
        </article>`;
    }

    function investigationLinks(item) {
        const rows = state.investigationsByItem.get(String(item.id)) || [];
        if (!rows.length) return '';
        return `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${escapeHtml(t('investigate.related', null, '关联调查'))}</h2></header>
            <div class="ake-ui-card-grid" data-size="regular">${rows.map(investigationCard).join('')}</div></section>`;
    }

    function readingImageUrl(rawSource) {
        let source = String(rawSource || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
        let gendered = false;
        if (/^fm\/\//i.test(source)) {
            gendered = true;
            source = source.replace(/^fm\/\//i, '');
        }
        source = source.replace(/^reading\//i, '');
        if (gendered) {
            const extensionMatch = source.match(/(\.[a-z0-9]+)$/i);
            source = extensionMatch
                ? `${source.slice(0, -extensionMatch[1].length)}_${state.gender}${extensionMatch[1]}`
                : `${source}_${state.gender}.png`;
        } else if (!/\.[a-z0-9]+$/i.test(source)) {
            source += '.png';
        }
        const path = encodeURI(`${SPRITE_ROOT}reading/${source}`);
        return window.akeDataSource?.resolveImageUrl?.(path) || path;
    }

    function renderRichValue(value) {
        const source = String(value || '');
        if (!source) return '';
        const imagePattern = /<image(?:\s[^>]*)?>([\s\S]*?)<\/image>/gi;
        const parts = [];
        let cursor = 0;
        let match;
        while ((match = imagePattern.exec(source))) {
            const textBefore = source.slice(cursor, match.index);
            if (textBefore.trim()) parts.push(`<p class="akearchive-paragraph">${gameHtml(textBefore)}</p>`);
            const imageSource = readingImageUrl(match[1]);
            parts.push(`<div class="akearchive-image-row">${imageTag(
                imageSource,
                'akearchive-content-image',
                t('contentImage.alt', null, '档案正文图片'),
                ' data-archive-content-image="true"'
            )}</div>`);
            cursor = imagePattern.lastIndex;
        }
        const textAfter = source.slice(cursor);
        if (textAfter.trim()) parts.push(`<p class="akearchive-paragraph">${gameHtml(textAfter)}</p>`);
        if (!parts.length && source.trim()) parts.push(`<p class="akearchive-paragraph">${gameHtml(source)}</p>`);
        return parts.join('');
    }

    function richContentHasGenderImage(rich) {
        return (rich?.contentList || []).some(entry => /<image(?:\s[^>]*)?>\s*fm\/\//i.test(gameText(entry?.content)));
    }

    function renderGenderControl() {
        return `<div class="akearchive-gender-control">
            <span>${escapeHtml(t('protagonistGender.label', null, '主角性别'))}</span>
            <span class="ake-ui-segmented" role="group" aria-label="${escapeHtml(t('protagonistGender.label', null, '主角性别'))}">
                <button type="button" class="ake-ui-segmented__button${state.gender === 'f' ? ' is-active' : ''}" data-akearchive-action="set-gender" data-gender="f" aria-pressed="${state.gender === 'f'}">${escapeHtml(t('protagonistGender.female', null, '女'))}</button>
                <button type="button" class="ake-ui-segmented__button${state.gender === 'm' ? ' is-active' : ''}" data-akearchive-action="set-gender" data-gender="m" aria-pressed="${state.gender === 'm'}">${escapeHtml(t('protagonistGender.male', null, '男'))}</button>
            </span>
        </div>`;
    }

    function voiceButtonHtml(voId) {
        return window.AKEVoicePlayer?.buttonHtml(voId, {
            play: t('audio.play', null, '播放语音'),
            pause: t('audio.pause', null, '暂停语音'),
            error: t('audio.error', null, '语音播放失败')
        }) || '';
    }

    function investigationLinkedTitle(item, title) {
        const href = window.__akeRouter?.entryUrl?.(MODULE_ID, item.id)
            || `?plugin=${encodeURIComponent(MODULE_ID)}&id=${encodeURIComponent(item.id)}`;
        return `<a href="${escapeHtml(href)}" data-akearchive-action="select-entry" data-entry-id="${escapeHtml(item.id)}"
            data-ake-entry-plugin="v3_archive" data-ake-entry-id="${escapeHtml(item.id)}">${gameHtml(title)}</a>${investigationItemChangeTag(item.id)}`;
    }

    function renderDocument(item, popup, linkTitle = false) {
        const rich = state.tables.richContent?.[item.contentId] || null;
        const itemName = itemDisplayName(item);
        const title = contentDisplayTitle(
            rich?.title || popup?.title,
            item,
            itemName
        );
        const logo = popupLogo(popup);
        const body = (rich?.contentList || []).map(entry => renderRichValue(gameText(entry?.content))).join('');
        const card = window.AKEUI.card({
            density: 'spacious',
            media: logo ? window.AKEUI.fragment(imageTag(logo, '', '', ' aria-hidden="true"')) : null,
            header: {
                title: window.AKEUI.fragment(`${voiceButtonHtml(itemVoiceId(item, popup))}${linkTitle ? investigationLinkedTitle(item, title) : gameHtml(title)}`),
                subtitle: window.AKEUI.fragment(gameHtml(itemName))
            },
            attributes: { 'data-card-kind': 'archive-document' }
        });
        card.querySelector('.ake-ui-card__content').appendChild(window.AKEUI.element('div', 'ake-ui-card__body',
            window.AKEUI.fragment(body || `<p class="akearchive-paragraph">${escapeHtml(t('empty.content', null, '该档案暂无正文内容'))}</p>`)));
        return `${richContentHasGenderImage(rich) ? renderGenderControl() : ''}
            ${card.outerHTML}`;
    }

    function renderTranscript(item, popup, linkTitle = false) {
        const radio = radioForItem(item);
        const lines = [...(radio?.radioSingleDataList || [])].sort((a, b) => safeOrder(a.index) - safeOrder(b.index));
        const logo = popupLogo(popup);
        const lineHtml = lines.map(line => {
            const speaker = gameText(line.actorName) || gameText(line.infoActorName)
                || (showTechnicalIds() ? line.actorNameId : '') || '';
            const voiceButton = voiceButtonHtml(line.audioOverride);
            return `<div class="akearchive-line${speaker ? '' : ' akearchive-line--anonymous'}">
                ${speaker ? `<div class="akearchive-line-speaker">${voiceButton}${gameHtml(speaker)}</div>` : ''}
                <div class="akearchive-line-text">${speaker ? '' : voiceButton}${gameHtml(gameText(line.radioText))}</div>
            </div>`;
        }).join('');
        return `<section class="akearchive-transcript ake-ui-section">
            <header class="ake-ui-section__header">
                <div>${logo ? imageTag(logo, 'akearchive-popup-logo', '', ' aria-hidden="true"') : ''}${voiceButtonHtml(itemVoiceId(item, popup))}<h2 class="ake-ui-section__title">${linkTitle ? investigationLinkedTitle(item, contentDisplayTitle(popup?.title, item)) : gameHtml(contentDisplayTitle(popup?.title, item))}</h2></div>
                <span class="ake-ui-section__meta">${escapeHtml(tr('counts.entries', { count: lines.length }, `${lines.length} 条记录`))}</span>
            </header>
            <div class="akearchive-transcript-list">${lineHtml || `<div class="ake-ui-state" data-state="empty"><div><p>${escapeHtml(t('empty.transcript', null, '该档案暂无字幕'))}</p></div></div>`}</div>
        </section>`;
    }

    function renderMapText(item) {
        const lines = state.tables.dialogLinesById.get(String(item.contentId || '')) || [];
        const lineHtml = lines.map(line => {
            const speaker = gameText(line.actorName) || (showTechnicalIds() ? line.actorNameId : '') || '';
            const voiceButton = voiceButtonHtml(line.audioOverride);
            return `<div class="akearchive-line${speaker ? '' : ' akearchive-line--anonymous'}">
                ${speaker ? `<div class="akearchive-line-speaker">${voiceButton}${gameHtml(speaker)}</div>` : ''}
                <div class="akearchive-line-text">${speaker ? '' : voiceButton}${gameHtml(gameText(line.dialogText))}</div>
            </div>`;
        }).join('');
        const title = showTechnicalIds() ? item.contentId : itemDisplayName(item);
        const sourceMeta = showTechnicalIds()
            ? `<p class="ake-ui-section__meta">${escapeHtml(item.levelDataPath || '')}</p>`
            : '';
        return `<section class="akearchive-transcript ake-ui-section">
            <header class="ake-ui-section__header">
                <div><h2 class="ake-ui-section__title">${gameHtml(title)}</h2>${sourceMeta}</div>
                <span class="ake-ui-section__meta">${escapeHtml(tr('counts.entries', { count: lines.length }, `${lines.length} 条记录`))}</span>
            </header>
            <div class="akearchive-transcript-list">${lineHtml || `<div class="ake-ui-state" data-state="empty"><div><p>${escapeHtml(t('mapText.missingDialog', null, 'DialogTextTable 中未找到对应文本'))}</p></div></div>`}</div>
        </section>`;
    }

    function renderEntryTabs(group, activeItem) {
        const items = itemRowsForGroup(group.firstLvId);
        if (items.length < 2) return '';
        return window.AKEUI.tabs({
            variant: 'underline',
            role: 'group',
            label: t('details.entry', null, '条目'),
            items: items.map((item, index) => ({
                active: item.id === activeItem.id,
                label: window.AKEUI.fragment(`${gameHtml(itemDisplayName(item, `${t('details.entry', null, '条目')} ${index + 1}`))}${itemChangeTag(item)}`),
                attributes: { 'data-akearchive-action': 'select-entry', 'data-entry-id': item.id }
            }))
        }).outerHTML;
    }

    function renderDetail(item) {
        window.AKEVoicePlayer?.stop();
        const group = state.groupMap.get(String(item.firstLvId));
        if (!group) return;
        const category = categoryForGroup(group);
        const page = pageForCategory(group.categoryId);
        const popup = popupForItem(item);
        const groupName = groupDisplayName(group);
        const description = groupSecondary(group, page, item);
        const icon = groupIconTag(group, gamePlainText(groupName), '');
        const detailChange = detailChangeTag(group, item);
        const readingTechnical = showTechnicalIds() && group.categoryId === READING_LIST_CATEGORY_ID
            ? `<span>${escapeHtml(t('details.contentId', null, '内容 ID'))}: ${escapeHtml(item.contentId || '')}</span>${item.readingUniqId ? `<span>${escapeHtml(t('details.readingId', null, '目录项 ID'))}: ${escapeHtml(item.readingUniqId)}</span>` : ''}${(item.levelScriptPaths || []).map(path => `<span>${escapeHtml(t('details.levelScriptPath', null, '关卡脚本'))}: ${escapeHtml(path)}</span>`).join('')}`
            : '';
        const oemUrl = window.AKEV3.pointShareUrl?.(state.oemPoints.get(String(item.id))?.[0]) || '';
        const oemLabel = t('details.oemLink', null, '在OEM中查看');
        const headerActions = `${window.AKEVoicePlayer?.languageControlHtml?.() || ''}${oemUrl
            ? `<a class="ake-ui-button ake-ui-button--secondary" href="${escapeHtml(oemUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(oemLabel)}</a>`
            : ''}`;
        const detailHeader = window.AKEUI.detailHeader({
            icon: window.AKEUI.fragment(icon),
            beforeTitle: window.AKEUI.fragment(`<div class="ake-ui-detail-meta">
                <span>${gameHtml(pageDisplayName(page))}</span>
                <span>${escapeHtml(t('details.category', null, '分类'))}: ${gameHtml(categoryDisplayName(category))}</span>
                ${showTechnicalIds() ? `<span>${escapeHtml(t('details.archiveId', null, '档案组 ID'))}: ${escapeHtml(group.firstLvId)}</span><span>${escapeHtml(t('details.entryId', null, '条目 ID'))}: ${escapeHtml(item.id)}</span>${readingTechnical}` : ''}
                ${detailChange}
            </div>`),
            title: window.AKEUI.fragment(gameHtml(groupName)),
            subtitle: window.AKEUI.fragment(gameHtml(description)),
            after: headerActions ? window.AKEUI.fragment(headerActions) : null
        });
        elements.content.innerHTML = `<article class="ake-ui-detail" data-detail-kind="archive">
            ${detailHeader?.outerHTML || ''}
            ${renderEntryTabs(group, item)}
            ${item.type === 'map_text' ? renderMapText(item) : item.type === 'multi_media' ? renderTranscript(item, popup) : renderDocument(item, popup)}
            ${investigationLinks(item)}
        </article>`;
        if (!elements.content.querySelector('[data-ake-voice-id]')) {
            elements.content.querySelector('[data-ake-voice-language-control]')?.remove();
        }
    }

    function renderEmptyGroup(group) {
        window.AKEVoicePlayer?.stop();
        const category = categoryForGroup(group);
        const groupName = groupDisplayName(group);
        const detailChange = detailChangeTag(group, null);
        const detailHeader = window.AKEUI.detailHeader({
            icon: window.AKEUI.fragment(groupIconTag(group, gamePlainText(groupName), '')),
            beforeTitle: window.AKEUI.fragment(`<div class="ake-ui-detail-meta"><span>${gameHtml(categoryDisplayName(category))}</span>${showTechnicalIds() ? `<span>${escapeHtml(group.firstLvId)}</span>` : ''}${detailChange}</div>`),
            title: window.AKEUI.fragment(gameHtml(groupName)),
            subtitle: window.AKEUI.fragment(gameHtml(groupSecondary(group, pageForCategory(group.categoryId))))
        });
        elements.content.innerHTML = `<article class="ake-ui-detail" data-detail-kind="archive">
            ${detailHeader?.outerHTML || ''}
            <div class="ake-ui-state" data-state="empty"><div><p>${escapeHtml(t('empty.content', null, '该档案暂无正文内容'))}</p></div></div>
        </article>`;
    }

    function closeMobileDirectory(options) {
        const wasOpen = elements.mobileOverlay?.classList.contains('is-open');
        elements.mobileOverlay?.classList.remove('is-open');
        elements.mobileOverlay?.setAttribute('aria-hidden', 'true');
        elements.mobileButton?.setAttribute('aria-expanded', 'false');
        if (wasOpen && options?.restoreFocus !== false) {
            window.setTimeout(() => state.mobileReturnFocus?.focus?.(), 0);
        }
    }

    function openMobileDirectory() {
        state.mobileReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.mobileButton;
        elements.mobileOverlay?.classList.add('is-open');
        elements.mobileOverlay?.setAttribute('aria-hidden', 'false');
        elements.mobileButton?.setAttribute('aria-expanded', 'true');
        window.setTimeout(() => {
            elements.mobileSearch?.focus?.();
            scrollDirectoryGroupIntoView(elements.mobileDirectory, state.activeGroupId, 'auto');
        }, 0);
    }

    function focusContent() {
        elements.content.scrollTop = 0;
        elements.content.focus?.({ preventScroll: true });
    }

    function rememberOverviewState() {
        if (state.activeGroupId || state.activeItemId || state.activeInvestigationId || state.investigationListOpen) return;
        state.overviewState = {
            query: state.query,
            activePageType: state.activePageType,
            activeRegionId: state.activeRegionId,
            contentScrollTop: elements.content.scrollTop,
            directoryScrollTop: elements.directory.scrollTop,
            mobileDirectoryScrollTop: elements.mobileDirectory?.scrollTop || 0
        };
    }

    function scrollDirectoryGroupIntoView(node, groupId, behavior) {
        if (!node || !groupId) return;
        const targetId = String(groupId);
        const target = Array.from(node.querySelectorAll('[data-akearchive-action="open-group"]'))
            .find(item => item.dataset.groupId === targetId);
        target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: behavior || 'smooth' });
    }

    function scheduleDirectoryGroupScroll(node, groupId, behavior) {
        window.requestAnimationFrame(() => {
            if (!state.disposed) scrollDirectoryGroupIntoView(node, groupId, behavior);
        });
    }

    function showOverview(options) {
        window.AKEVoicePlayer?.stop();
        const remembered = options?.restoreOverviewState ? state.overviewState : null;
        if (remembered) {
            state.query = remembered.query;
            state.activePageType = remembered.activePageType;
            state.activeRegionId = remembered.activeRegionId;
        }
        state.activeGroupId = '';
        state.activeItemId = '';
        state.activeInvestigationId = '';
        state.investigationListOpen = false;
        if (!remembered && options?.resetPage !== false) state.activePageType = '';
        if (!remembered && options?.resetRegion) {
            state.activeRegionId = '';
        }
        if (options?.resetPage !== false || options?.resetRegion || remembered) renderArchiveFilters();
        renderDirectories();
        renderOverview();
        closeMobileDirectory({ restoreFocus: options?.restoreFocus });
        if (options?.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, '');
        if (options?.focusContent) focusContent();
        if (remembered) {
            window.requestAnimationFrame(() => {
                elements.content.scrollTop = remembered.contentScrollTop;
                elements.directory.scrollTop = remembered.directoryScrollTop;
                if (elements.mobileDirectory) elements.mobileDirectory.scrollTop = remembered.mobileDirectoryScrollTop;
            });
            state.overviewState = null;
        }
    }

    function showInvestigationList(options) {
        window.AKEVoicePlayer?.stop();
        state.activeGroupId = '';
        state.activeItemId = '';
        state.activeInvestigationId = '';
        state.investigationListOpen = true;
        renderDirectories();
        renderInvestigationList();
        closeMobileDirectory({ restoreFocus: false });
        if (options?.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, 'investigations');
        if (options?.focusContent !== false) focusContent();
    }

    function openInvestigation(id, options) {
        const row = state.investigationMap.get(String(id || ''));
        if (!row) return false;
        window.AKEVoicePlayer?.stop();
        state.activeGroupId = '';
        state.activeItemId = '';
        state.activeInvestigationId = String(row.id);
        state.investigationListOpen = false;
        renderDirectories();
        renderInvestigation(row);
        closeMobileDirectory({ restoreFocus: false });
        if (options?.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, `investigation:${row.id}`);
        if (options?.focusContent !== false) focusContent();
        return true;
    }

    function selectItem(itemId, options) {
        const item = state.itemMap.get(String(itemId || ''));
        if (!item) return false;
        rememberOverviewState();
        state.activeItemId = String(item.id);
        state.activeGroupId = String(item.firstLvId || '');
        state.activeInvestigationId = '';
        state.investigationListOpen = false;
        renderDirectories();
        scheduleDirectoryGroupScroll(elements.directory, state.activeGroupId, 'smooth');
        renderDetail(item);
        closeMobileDirectory({ restoreFocus: false });
        if (options?.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, options?.routeItem ? state.activeItemId : state.activeGroupId);
        if (options?.focusContent !== false) focusContent();
        return true;
    }

    function openGroup(groupId, options) {
        const group = state.groupMap.get(String(groupId || ''));
        if (!group) return false;
        const items = itemRowsForGroup(group.firstLvId);
        const queryItem = state.query ? items.find(item => state.itemSearch.get(String(item.id))?.includes(state.query)) : null;
        if (queryItem || items[0]) return selectItem((queryItem || items[0]).id, options);
        state.activeGroupId = String(group.firstLvId);
        state.activeItemId = '';
        state.activeInvestigationId = '';
        state.investigationListOpen = false;
        renderDirectories();
        scheduleDirectoryGroupScroll(elements.directory, state.activeGroupId, 'smooth');
        renderEmptyGroup(group);
        closeMobileDirectory({ restoreFocus: false });
        if (options?.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, state.activeGroupId);
        if (options?.focusContent !== false) focusContent();
        return true;
    }

    function onDirectoryClick(event) {
        const target = event.target.closest('[data-akearchive-action]');
        if (!target) return;
        const action = target.dataset.akearchiveAction;
        if (action === 'open-group') openGroup(target.dataset.groupId, { updateUrl: true });
        if (action === 'show-investigations') showInvestigationList({ updateUrl: true });
        if (action === 'show-overview') showOverview({ updateUrl: true, focusContent: true, restoreFocus: false, resetPage: false, restoreOverviewState: true });
    }

    function onContentClick(event) {
        const target = event.target.closest('[data-akearchive-action]');
        if (!target) return;
        const action = target.dataset.akearchiveAction;
        if (action === 'open-group') openGroup(target.dataset.groupId, { updateUrl: true });
        if (action === 'open-investigation') openInvestigation(target.dataset.investigationId, { updateUrl: true });
        if (action === 'show-investigations') showInvestigationList({ updateUrl: true });
        if (action === 'select-entry') {
            if (target.tagName === 'A') {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
            }
            selectItem(target.dataset.entryId, { updateUrl: true, routeItem: true });
        }
        if (action === 'filter-page') {
            const pageType = String(target.dataset.pageType || '');
            state.activePageType = state.activePageType === pageType ? '' : pageType;
            renderArchiveFilters();
            renderOverview();
            elements.content.scrollTop = 0;
        }
        if (action === 'set-gender' && /^(?:f|m)$/.test(target.dataset.gender || '')) {
            state.gender = target.dataset.gender;
            const item = state.itemMap.get(state.activeItemId);
            if (item) renderDetail(item);
            else if (state.activeInvestigationId) renderInvestigation(state.investigationMap.get(state.activeInvestigationId));
        }
        if (action === 'show-overview') showOverview({ updateUrl: true, focusContent: true, resetPage: false, restoreOverviewState: true });
    }

    function onSearchInput(event) {
        const value = event.currentTarget.value || '';
        state.query = normalizeSearch(value);
        state.activePageType = '';
        state.overviewState = null;
        renderArchiveFilters();
        if (elements.search && elements.search !== event.currentTarget) elements.search.value = value;
        if (elements.mobileSearch && elements.mobileSearch !== event.currentTarget) elements.mobileSearch.value = value;
        const leftDetail = Boolean(state.activeItemId || state.activeGroupId);
        const inInvestigations = state.investigationListOpen || Boolean(state.activeInvestigationId);
        state.activeItemId = '';
        state.activeGroupId = '';
        state.activeInvestigationId = '';
        if (inInvestigations) state.investigationListOpen = true;
        renderDirectories();
        if (inInvestigations) {
            renderInvestigationList();
            window.__akeRouter?.updateUrl?.(MODULE_ID, 'investigations');
        } else {
            renderOverview();
            if (leftDetail) window.__akeRouter?.updateUrl?.(MODULE_ID, '');
        }
    }

    function onOverlayClick(event) {
        if (event.target === elements.mobileOverlay) closeMobileDirectory();
    }

    function onModuleDeactivate(event) {
        if (!event.detail?.moduleId || event.detail.moduleId === MODULE_ID) window.AKEVoicePlayer?.stop();
        if (event.detail?.moduleId === MODULE_ID) closeMobileDirectory({ restoreFocus: false });
    }

    function onGlobalConfigChanged(event) {
        const nextShowHidden = event.detail?.showHidden ?? event.detail?.config?.showHidden;
        if (typeof nextShowHidden !== 'boolean' || !state.tables) return;
        buildIndexes();
        renderDirectories();
        if (state.activeInvestigationId) {
            renderInvestigation(state.investigationMap.get(state.activeInvestigationId));
            return;
        }
        if (state.investigationListOpen) {
            renderInvestigationList();
            return;
        }
        const item = state.itemMap.get(state.activeItemId);
        if (item) {
            renderDetail(item);
            return;
        }
        const group = state.groupMap.get(state.activeGroupId);
        if (group) {
            renderEmptyGroup(group);
            return;
        }
        renderOverview();
    }

    function onViewportChange(event) {
        if (!event.matches) closeMobileDirectory({ restoreFocus: false });
    }

    function onHomeClick() {
        showOverview({ updateUrl: true, focusContent: true, resetPage: false, restoreOverviewState: true });
    }

    function onKeyDown(event) {
        if (!elements.mobileOverlay?.classList.contains('is-open')) return;
        if (event.key === 'Escape') {
            closeMobileDirectory();
            return;
        }
        if (event.key !== 'Tab' || !elements.mobilePanel) return;
        const focusable = Array.from(elements.mobilePanel.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )).filter(element => !element.hidden && element.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function onImageError(event) {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;
        if (image.dataset.archiveContentImage === 'true') {
            const placeholder = document.createElement('div');
            placeholder.className = 'akearchive-image-placeholder';
            placeholder.textContent = t('contentImage.unavailable', null, '正文图片不可用');
            (image.closest('.akearchive-image-row') || image).replaceWith(placeholder);
            return;
        }
        image.hidden = true;
    }

    function loadingHtml() {
        return `<div class="ake-ui-state" data-state="loading" data-layout="page" role="status">
            <div><h2>${escapeHtml(t('title', null, '档案库'))}</h2><p>${escapeHtml(t('loading.archive', null, '正在读取档案库数据'))}</p></div>
        </div>`;
    }

    function errorHtml(error) {
        const message = error?.message || String(error || 'Unknown error');
        return `<div class="ake-ui-state" data-state="error" role="alert"><div><h2>${escapeHtml(t('title', null, '档案库'))}</h2><p>${escapeHtml(tr('errors.loadFailed', { message }, `档案库加载失败：${message}`))}</p></div></div>`;
    }

    async function load() {
        const token = ++state.loadToken;
        elements.content.innerHTML = loadingHtml();
        try {
            if (window.configLoaded) await window.configLoaded;
            const comparison = window.akeDataSource?.getState?.()?.comparison;
            const baselinePromise = comparison?.baseline
                ? Promise.all([
                    Promise.all(['PrtsFirstLv', 'PrtsAllItem', 'PrtsReading', 'DialogTextTable']
                        .map(name => window.AKEV3.table(name, comparison.baseline)))
                        .catch(error => {
                            console.warn('Failed to load baseline archive data for version comparison', error);
                            return null;
                        }),
                    Promise.all(['PrtsInvestigate', 'PrtsNote', 'RichContentTable'].map(async name => {
                        try {
                            return await window.AKEV3.table(name, comparison.baseline, { optional: true });
                        } catch (error) {
                            console.warn(`Failed to load baseline ${name} for investigation comparison`, error);
                            return {};
                        }
                    }))
                ]).then(([core, extra]) => core ? {
                    PrtsFirstLv: core[0],
                    PrtsAllItem: core[1],
                    PrtsReading: core[2],
                    DialogTextTable: core[3],
                    PrtsInvestigate: extra[0],
                    PrtsNote: extra[1],
                    RichContentTable: extra[2]
                } : null)
                : Promise.resolve(null);
            if (!window.akeAssetIndex?.ready) {
                throw new Error(t('mapText.indexUnavailable', null, '统一资产索引服务不可用'));
            }
            const [loaded, baselineRaw, assetIndex] = await Promise.all([
                Promise.all(TABLE_NAMES.map(name => window.AKEV3.table(name))),
                baselinePromise,
                window.akeAssetIndex.ready
            ]);
            if (state.disposed || token !== state.loadToken) return;
            const raw = Object.fromEntries(TABLE_NAMES.map((name, index) => [name, loaded[index]]));
            prepareVersionChanges(raw, baselineRaw, comparison);
            prepareTables(raw, assetIndex);
            const levelDataRecords = Object.entries(assetIndex?.datasets?.json?.files || {})
                .filter(([path]) => path.startsWith('LevelData/') && path.toLowerCase().endsWith('.json'));
            state.oemPoints = new Map();
            const indexedPoints = new Map();
            levelDataRecords.forEach(([, record]) => {
                const points = record?.meta?.archivePoints;
                if (!Array.isArray(points)) return;
                points.forEach(point => {
                    const prtsId = String(point?.prtsId || '');
                    const logicId = point?.logicId;
                    if (!state.itemMap.has(prtsId) || !window.AKEV3.pointShareUrl?.(logicId)) return;
                    if (!indexedPoints.has(prtsId)) indexedPoints.set(prtsId, []);
                    if (!indexedPoints.get(prtsId).includes(logicId)) indexedPoints.get(prtsId).push(logicId);
                });
            });
            state.itemMap.forEach(item => {
                const ids = (item.readingReferences || []).map(ref => ref.logicId).filter(id => window.AKEV3.pointShareUrl?.(id));
                if (ids.length) indexedPoints.set(item.id, [...new Set([...(indexedPoints.get(item.id) || []), ...ids])]);
            });
            indexedPoints.forEach((ids, prtsId) => state.oemPoints.set(prtsId, ids.sort((a, b) => a - b)));
            renderDirectories();
            if (pendingDeepId) {
                if (pendingDeepId === 'investigations') {
                    showInvestigationList({ updateUrl: false, focusContent: false });
                    return;
                }
                if (pendingDeepId.startsWith('investigation:') && openInvestigation(pendingDeepId.slice('investigation:'.length), { updateUrl: false, focusContent: false })) return;
                if (selectItem(pendingDeepId, { updateUrl: false, focusContent: false })) return;
                const selected = openGroup(pendingDeepId, { updateUrl: false, focusContent: false });
                if (selected) return;
                window.__akeRouter?.onDeepLinkNotFound?.(pendingDeepId, false);
            }
            showOverview({ updateUrl: false, focusContent: false });
        } catch (error) {
            if (state.disposed || token !== state.loadToken) return;
            console.error('Failed to load archive data', error);
            if (elements.meta) elements.meta.textContent = t('errors.loadFailed', null, '加载失败');
            elements.directory.innerHTML = '';
            if (elements.mobileDirectory) elements.mobileDirectory.innerHTML = '';
            elements.content.innerHTML = errorHtml(error);
        }
    }

    elements.home?.addEventListener('click', onHomeClick);
    elements.directory.addEventListener('click', onDirectoryClick);
    elements.mobileDirectory?.addEventListener('click', onDirectoryClick);
    elements.content.addEventListener('click', onContentClick);
    root.addEventListener('error', onImageError, true);
    elements.search?.addEventListener('input', onSearchInput);
    elements.mobileSearch?.addEventListener('input', onSearchInput);
    elements.mobileButton?.addEventListener('click', openMobileDirectory);
    elements.mobileClose?.addEventListener('click', closeMobileDirectory);
    elements.mobileOverlay?.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('ake:module-deactivate', onModuleDeactivate);
    window.addEventListener('globalConfigChanged', onGlobalConfigChanged);
    const mobileViewport = window.matchMedia('(max-width: 999px)');
    mobileViewport.addEventListener?.('change', onViewportChange);

    window.__akeArchiveController = {
        getDiagnostics: () => structuredClone(state.narrativeDiagnostics || []),
        destroy() {
            window.AKEVoicePlayer?.stop();
            state.disposed = true;
            state.loadToken += 1;
            elements.home?.removeEventListener('click', onHomeClick);
            elements.directory.removeEventListener('click', onDirectoryClick);
            elements.mobileDirectory?.removeEventListener('click', onDirectoryClick);
            elements.content.removeEventListener('click', onContentClick);
            root.removeEventListener('error', onImageError, true);
            elements.search?.removeEventListener('input', onSearchInput);
            elements.mobileSearch?.removeEventListener('input', onSearchInput);
            elements.mobileButton?.removeEventListener('click', openMobileDirectory);
            elements.mobileClose?.removeEventListener('click', closeMobileDirectory);
            elements.mobileOverlay?.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('ake:module-deactivate', onModuleDeactivate);
            window.removeEventListener('globalConfigChanged', onGlobalConfigChanged);
            mobileViewport.removeEventListener?.('change', onViewportChange);
        },
        showOverview: () => showOverview({ updateUrl: true, focusContent: true }),
        selectItem: itemId => selectItem(itemId, { updateUrl: true }),
        openGroup: groupId => openGroup(groupId, { updateUrl: true })
    };

    load();
})();
