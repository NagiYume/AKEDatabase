(function () {
    'use strict';

    const buffT = window.akeI18n?.scope?.('modules.buff')
        || ((key, params, fallback) => fallback ?? key);
    const combatT = window.akeI18n?.scope?.('modules.combat')
        || ((key, params, fallback) => fallback ?? key);
    const t = (key, params, fallback) => buffT(`v3.${key}`, params, fallback);
    const MODULE_ID = 'v3_buff';
    const HIDDEN_OWNER_PATTERN = /^buff_(?:chr_9000_endmin|eny_0057_dog)(?:_|$)/i;
    const root = document.getElementById('buffv3Module');
    if (!root || !window.AKEV3) return;

    window.__akeV3BuffController?.destroy?.();

    const elements = {
        search: document.getElementById('buffv3SearchInput'),
        mobileSearch: document.getElementById('buffv3MobileSearchInput'),
        meta: document.getElementById('buffv3ListMeta'),
        directory: document.getElementById('buffv3Directory'),
        mobileDirectory: document.getElementById('buffv3MobileDirectory'),
        detail: document.getElementById('buffv3Detail'),
        mobileButton: document.getElementById('buffv3MobileListButton'),
        mobileOverlay: document.getElementById('buffv3MobileOverlay'),
        mobilePanel: document.getElementById('buffv3MobilePanel'),
        mobileClose: document.getElementById('buffv3MobileClose')
    };
    if (!elements.directory || !elements.detail) return;

    const pendingDeepId = String(window.__deepLinkId || '');
    window.__deepLinkId = null;
    root.dataset.moduleId = MODULE_ID;
    root.dataset.moduleTitle = buffT('title', null, 'Buff');

    const state = {
        rawManifest: [],
        manifest: [],
        tables: null,
        directory: [],
        buffIndex: new Map(),
        expandedOwners: new Set(),
        query: '',
        activeBuffId: '',
        activeOwner: null,
        currentItem: null,
        currentRaw: null,
        analysis: emptyAnalysis(),
        activeTab: 'events',
        showPerformance: false,
        buffCache: new Map(),
        detailToken: 0,
        disposed: false,
        mobileReturnFocus: null,
        pendingDeepId
    };

    const CATEGORY_DEFINITIONS = Object.freeze({
        weapons: { order: 20, key: 'groups.weapons', fallback: '武器', icon: '·' },
        equipment: { order: 30, key: 'groups.equipment', fallback: '装备', icon: '·' },
        common: { order: 40, key: 'groups.common', fallback: '通用与系统', icon: '·' },
        modes: { order: 50, key: 'groups.modes', fallback: '玩法与关卡', icon: '·' },
        abilityEntities: { order: 60, key: 'groups.abilityEntities', fallback: '能力实体', icon: '·' },
        other: { order: 100, key: 'groups.other', fallback: '其他', icon: '·' }
    });

    const EFFECT_GROUPS = Object.freeze([
        ['attributes', 'sections.attributes', '属性修改', 'attribute'],
        ['damage', 'sections.damage', '伤害修改', 'damage'],
        ['heal', 'sections.heal', '治疗修改', 'heal'],
        ['poise', 'sections.poise', '韧性修改', 'poise'],
        ['global', 'sections.global', '全局战斗修改', 'global'],
        ['shields', 'sections.shields', '护盾', 'shield']
    ]);

    const FIELD_PRIORITY = Object.freeze([
        'attributeType', 'attrType', 'formula', 'formulaType', 'modifierType', 'type', 'processorType',
        'value', 'parameterValue', 'multiplier', 'addition', 'rate', 'coefficient', 'scale', 'target',
        'targetType', 'damageType', 'healType', 'poiseType', 'condition', 'priority', 'maxStackCnt',
        'stackingKey', 'dispelledLevel', 'duration', 'triggerInterval', 'count', 'tag', 'buffId'
    ]);
    const FIELD_META_KEYS = new Set([
        'raw', 'rawType', '$type', 'path', 'index', 'eventIndex', 'parentEventIndex', 'relation', 'source',
        'eventKind', 'eventName', 'presentation', 'enabled', 'category', 'summaryFields', 'details',
        'actionIndices', 'actions', 'children', 'processors', 'conditions', 'rules', 'entries', 'stackEffects',
        'usesBlackboard', 'blackboardKey', 'fallbackValue', 'resolved', 'status'
    ]);

    function emptyAnalysis() {
        return {
            identity: {}, core: {}, stacking: {}, dispel: {},
            modifiers: { attributes: [], damage: [], heal: [], poise: [], global: [], shields: [] },
            tags: { apply: [], extendAfterTrigger: [] }, eventGroups: [], timelineGroups: [], events: [],
            links: [], blackboard: { entries: [], dependencies: [] }, warnings: []
        };
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function collection(value) {
        if (Array.isArray(value)) return value.filter(item => item !== undefined && item !== null);
        if (!isObject(value)) return [];
        return Object.values(value).filter(item => item !== undefined && item !== null);
    }

    function isPresent(value) {
        return value !== undefined && value !== null && value !== '';
    }

    function gameText(value, fallback) {
        return window.AKEV3.text(value, fallback || '');
    }

    function splitIdentifier(value, trimAction) {
        let text = String(value || '')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-z\d])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (trimAction) text = text.replace(/(?:\s+Action)?(?:\s+Data)?$/i, '').trim();
        return text || String(value || '');
    }

    function enumKey(value) {
        const token = String(value ?? '').split(/[.+]/).pop().replace(/[^a-zA-Z0-9_-]/g, '');
        return token ? token[0].toLowerCase() + token.slice(1) : 'unknown';
    }

    function localizedEnum(group, value) {
        const token = String(value ?? '').split(/[.+]/).pop().replace(/[^a-zA-Z0-9_-]/g, '');
        const fallback = t(`${group}.${enumKey(token)}`, null, splitIdentifier(token, false));
        return token ? t(`${group}.${token}`, null, fallback) : fallback;
    }

    function unwrapped(value) {
        if (!isObject(value)) return value;
        if (Object.prototype.hasOwnProperty.call(value, 'value') && (
            Object.prototype.hasOwnProperty.call(value, 'usesBlackboard')
            || Object.prototype.hasOwnProperty.call(value, 'resolved')
            || Object.prototype.hasOwnProperty.call(value, 'fallbackValue')
            || Object.keys(value).length <= 3
        )) {
            return isPresent(value.value) ? value.value : value.fallbackValue;
        }
        return value;
    }

    function numberValue(value) {
        const scalar = unwrapped(value);
        const number = Number(scalar);
        return Number.isFinite(number) ? number : null;
    }

    function currentLocale() {
        return window.akeI18n?.getLanguageInfo?.().htmlLang || 'zh-CN';
    }

    function formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return String(value ?? '');
        return new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 4 }).format(number);
    }

    function formatValue(value, enumGroup) {
        const scalar = unwrapped(value);
        if (scalar === true) return t('values.yes', null, '是');
        if (scalar === false) return t('values.no', null, '否');
        if (scalar === null || scalar === undefined || scalar === '') return t('values.unknown', null, '未知');
        if (typeof scalar === 'number') return formatNumber(scalar);
        if (typeof scalar === 'string') {
            if (enumGroup) return localizedEnum(enumGroup, scalar);
            return scalar;
        }
        if (Array.isArray(scalar)) {
            const values = scalar.map(item => formatCompactValue(item)).filter(Boolean);
            return values.join(' · ');
        }
        if (isObject(scalar)) {
            if (isPresent(scalar.tagId)) return String(scalar.tagId);
            if (isPresent(scalar.id)) return String(scalar.id);
            if (isPresent(scalar.name)) return String(scalar.name);
            if (isPresent(scalar.type)) return splitIdentifier(scalar.type, false);
            if (isPresent(scalar.$type)) return splitIdentifier(String(scalar.$type).split(',')[0].split('+')[0], true);
        }
        return '';
    }

    function formatCompactValue(value) {
        const scalar = unwrapped(value);
        if (scalar === null || scalar === undefined || scalar === '') return '';
        if (typeof scalar === 'boolean') return formatValue(scalar);
        if (typeof scalar === 'number') return formatNumber(scalar);
        if (typeof scalar === 'string') return scalar;
        if (isObject(scalar)) {
            const type = scalar.type || scalar.processorType || scalar.$type;
            if (type) return splitIdentifier(String(type).split(',')[0].split('+')[0], true);
            if (isPresent(scalar.tagId)) return String(scalar.tagId);
            if (isPresent(scalar.id)) return String(scalar.id);
            if (isPresent(scalar.key) && isPresent(scalar.value)) return `${scalar.key}: ${formatValue(scalar.value)}`;
        }
        return '';
    }

    function formatFieldValue(key, value, enumGroup) {
        const scalar = unwrapped(value);
        if (typeof scalar !== 'string') return formatValue(value, enumGroup);
        const field = String(key || '').toLowerCase();
        const token = scalar.toLowerCase();
        const attackAttributes = new Set(['physical', 'real', 'fire', 'pulse', 'cryst', 'crystal', 'lifedrain', 'natural', 'ether']);
        if (attackAttributes.has(token) && (field.includes('damage') || field.includes('attack'))
            && (field.includes('attribute') || field === 'damagetype')) {
            return combatT(`enums.attackAttributes.${token}`, null, splitIdentifier(scalar, false));
        }
        if (['melee', 'ranged'].includes(token) && (field.includes('attackrange') || field === 'rangetype')) {
            return combatT(`enums.attackRanges.${token}`, null, splitIdentifier(scalar, false));
        }
        if (['atb', 'usp', 'ultimatesp'].includes(token) && (field.includes('costtype') || field.includes('resourcetype'))) {
            const resourceKey = token === 'atb' ? 'atb' : 'ultimateSp';
            return combatT(`enums.costTypes.${resourceKey}`, null, splitIdentifier(scalar, false));
        }
        return formatValue(value, enumGroup);
    }

    function resolvedUnit(value) {
        if (!isObject(value) || !value.usesBlackboard) return '';
        const key = String(value.blackboardKey || '');
        if (!key) return t('blackboardSources.empty-key-fallback', null, '空键回退值');
        return t('units.blackboardKey', { key }, `黑板键 ${key}`);
    }

    function iconPath(path) {
        const value = String(path || '');
        if (!value) return '';
        if (value.startsWith('/')) return value;
        const name = value.endsWith('.png') ? value : `${value}.png`;
        return `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/bufficon/${name}`;
    }

    function showHidden() {
        return window.akeData?.getConfig?.()?.showHidden === true;
    }

    function ownerAlias(value, kind) {
        const match = String(value || '').match(new RegExp(`^${kind}_(\\d+)_([^_]+)`, 'i'));
        return match ? `${Number(match[1])}:${match[2].toLowerCase()}` : '';
    }

    function inferredOwnerPrefix(id, kind) {
        const match = String(id || '').replace(/^buff_/, '').match(new RegExp(`^(${kind}_\\d+_[^_]+)`, 'i'));
        return match?.[1] || '';
    }

    function categoryFor(id) {
        const value = String(id || '').replace(/^buff_/, '');
        if (/^(?:wpn_|weapon_|weaponmodule_)/i.test(value)) return 'weapons';
        if (/^(?:equip_|equipment_|armor_)/i.test(value)) return 'equipment';
        if (/^(?:abilityentity_|int_|interactive_)/i.test(value)) return 'abilityEntities';
        if (/^(?:dungeon_|mode_|rpg_|rogue|raid_|activity_|level_|stage_)/i.test(value)) return 'modes';
        if (/^(?:common_|global_|shared_|system_|cc_|battle_)/i.test(value)) return 'common';
        return 'other';
    }

    function shortBuffName(item, owner) {
        const id = String(item.id || '');
        const prefixes = [owner?.sourcePrefix, owner?.id].filter(Boolean);
        for (const prefix of prefixes) {
            const marker = `buff_${prefix}_`;
            if (id.toLowerCase().startsWith(marker.toLowerCase())) return id.slice(marker.length);
        }
        return String(item.name || id.replace(/^buff_/, '') || id);
    }

    function buildDirectory(manifest, characters, growth, enemyDisplay, enemies) {
        const entities = new Map();
        const charAliases = new Map();
        const charNumbers = new Map();
        const characterOrder = new Map(Object.keys(characters || {}).map((id, index) => [id, index]));

        Object.entries(characters || {}).forEach(([charId, config]) => {
            const alias = ownerAlias(charId, 'chr');
            if (alias) charAliases.set(alias, charId);
            const number = alias.split(':')[0];
            if (number) {
                if (!charNumbers.has(number)) charNumbers.set(number, []);
                charNumbers.get(number).push(charId);
            }
            const grow = growth?.[charId] || {};
            entities.set(`character:${charId}`, {
                id: charId,
                sourcePrefix: charId,
                entityKind: 'character',
                sectionId: 'characters',
                sectionName: t('groups.characters', null, '角色'),
                sectionOrder: 0,
                name: gameText(config?.name, gameText(grow?.name, grow?.engName || charId)),
                secondaryName: grow?.engName || '',
                icon: `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/icon_${charId}.png`,
                rarity: Number(config?.rarity ?? grow?.rarity ?? 0),
                sourceOrder: Number(config?.sortOrder ?? characterOrder.get(charId) ?? 999999),
                items: []
            });
        });

        const enemyEntries = Object.entries(enemies || {}).sort(([left], [right]) => right.length - left.length);
        const enemyDisplayOrder = new Map(Object.keys(enemyDisplay || {}).map((id, index) => [id, index]));
        const otherEntities = new Map();

        manifest.forEach(sourceItem => {
            const item = { ...sourceItem };
            const bodyId = String(item.id || '').replace(/^buff_/, '');
            let owner = null;

            if (/^chr_/i.test(bodyId)) {
                const alias = ownerAlias(bodyId, 'chr');
                let charId = charAliases.get(alias);
                if (!charId && alias) {
                    const matches = charNumbers.get(alias.split(':')[0]) || [];
                    if (matches.length === 1) charId = matches[0];
                }
                if (charId) owner = entities.get(`character:${charId}`);
                if (!owner) {
                    const prefix = inferredOwnerPrefix(item.id, 'chr');
                    const key = `character:${prefix || alias || 'unknown'}`;
                    if (!otherEntities.has(key)) otherEntities.set(key, {
                        id: prefix || alias || 'chr_unknown', sourcePrefix: prefix,
                        entityKind: 'character', sectionId: 'characters', sectionName: t('groups.characters', null, '角色'),
                        sectionOrder: 0, name: prefix || item.id, secondaryName: '', icon: '', rarity: 0,
                        sourceOrder: 999999, items: []
                    });
                    owner = otherEntities.get(key);
                }
            } else if (/^eny_/i.test(bodyId)) {
                const match = enemyEntries.find(([enemyId]) => bodyId === enemyId || bodyId.startsWith(`${enemyId}_`));
                const sourcePrefix = match?.[0] || inferredOwnerPrefix(item.id, 'eny');
                const templateId = match?.[1]?.templateId || sourcePrefix;
                const display = enemyDisplay?.[templateId] || enemyDisplay?.[sourcePrefix] || {};
                const key = `enemy:${templateId || sourcePrefix}`;
                if (!otherEntities.has(key)) otherEntities.set(key, {
                    id: templateId || sourcePrefix || 'eny_unknown', sourcePrefix,
                    entityKind: 'enemy', sectionId: 'monsters', sectionName: t('groups.monsters', null, '怪物'),
                    sectionOrder: 10, name: gameText(display.name, templateId || sourcePrefix || item.id),
                    secondaryName: gameText(display.nickname, ''),
                    icon: templateId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${templateId}.png` : '',
                    rarity: 0, sourceOrder: enemyDisplayOrder.get(templateId) ?? 999999, items: []
                });
                owner = otherEntities.get(key);
            } else {
                const category = categoryFor(item.id);
                const definition = CATEGORY_DEFINITIONS[category];
                const key = `category:${category}`;
                if (!otherEntities.has(key)) otherEntities.set(key, {
                    id: key, sourcePrefix: '', entityKind: 'category', sectionId: category,
                    sectionName: t(definition.key, null, definition.fallback), sectionOrder: definition.order,
                    name: t(definition.key, null, definition.fallback), secondaryName: '', icon: '', rarity: 0,
                    sourceOrder: definition.order, items: []
                });
                owner = otherEntities.get(key);
            }

            item.displayName = shortBuffName(item, owner);
            item.searchText = [item.id, item.name, item.displayName, owner.id, owner.name, owner.secondaryName]
                .filter(Boolean).join(' ').toLowerCase();
            owner.items.push(item);
        });

        const directory = [...entities.values(), ...otherEntities.values()].filter(owner => owner.items.length);
        directory.forEach(owner => {
            owner.items.sort((a, b) => Number(a.priority ?? 999999) - Number(b.priority ?? 999999)
                || String(a.id).localeCompare(String(b.id), 'en'));
            owner.searchText = [owner.id, owner.name, owner.secondaryName, owner.sectionName].filter(Boolean).join(' ').toLowerCase();
        });
        directory.sort((a, b) => a.sectionOrder - b.sectionOrder
            || (a.entityKind === 'character' && b.entityKind === 'character' ? b.rarity - a.rarity : 0)
            || a.sourceOrder - b.sourceOrder || String(a.id).localeCompare(String(b.id), 'en'));
        return directory;
    }

    function rebuildIndex() {
        state.buffIndex = new Map();
        state.directory.forEach(owner => owner.items.forEach(item => {
            if (!state.buffIndex.has(item.id)) state.buffIndex.set(item.id, { item, owner });
        }));
    }

    function filteredDirectory() {
        if (!state.query) return state.directory;
        return state.directory.map(owner => {
            const items = owner.searchText.includes(state.query)
                ? owner.items
                : owner.items.filter(item => item.searchText.includes(state.query));
            return { ...owner, items };
        }).filter(owner => owner.items.length);
    }

    function renderDirectoryNode(target, directory) {
        if (!target) return;
        if (!directory.length) {
            target.innerHTML = `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noMatches', null, '没有匹配的 Buff'))}</div>`;
            return;
        }
        const sectionCounts = directory.reduce((map, owner) => {
            map.set(owner.sectionId, (map.get(owner.sectionId) || 0) + owner.items.length);
            return map;
        }, new Map());
        let previousSection = '';
        target.innerHTML = directory.map(owner => {
            const sectionHeader = owner.sectionId !== previousSection
                ? `<div class="ake-ui-tree__section-header"><span>${escapeHtml(owner.sectionName)}</span><span>${escapeHtml(t('list.sectionCount', { count: sectionCounts.get(owner.sectionId) }, `${sectionCounts.get(owner.sectionId)} 条`))}</span></div>`
                : '';
            previousSection = owner.sectionId;
            const ownerOpen = Boolean(state.query) || state.expandedOwners.has(owner.id);
            const items = ownerOpen ? owner.items.map(item => `
                <button type="button" class="ake-ui-tree__item${item.id === state.activeBuffId ? ' is-active' : ''}"
                    data-buffv3-action="select-buff" data-buff-id="${escapeHtml(item.id)}"
                    aria-current="${item.id === state.activeBuffId ? 'true' : 'false'}" title="${escapeHtml(item.id)}">
                    <span class="ake-ui-tree__item-title">${escapeHtml(item.displayName)}</span>
                    <span class="ake-ui-tree__item-subtitle">BuffData</span>
                </button>`).join('') : '';
            const icon = owner.icon
                ? `<img class="ake-ui-tree__group-icon" src="${escapeHtml(owner.icon)}" alt="">`
                : `<span class="ake-ui-tree__group-marker" aria-hidden="true"></span>`;
            return `${sectionHeader}<section class="ake-ui-tree__group${ownerOpen ? ' is-open' : ''}">
                <button type="button" class="ake-ui-tree__group-toggle" data-buffv3-action="toggle-owner"
                    data-owner-id="${escapeHtml(owner.id)}" aria-expanded="${ownerOpen ? 'true' : 'false'}">
                    <span class="ake-ui-tree__group-label">${icon}<span>${escapeHtml(owner.name)}</span></span>
                    <span class="ake-ui-tree__group-count">${escapeHtml(owner.items.length)}</span>
                </button>
                <div class="ake-ui-tree__children">${items}</div>
            </section>`;
        }).join('');
    }

    function renderDirectories() {
        const directory = filteredDirectory();
        renderDirectoryNode(elements.directory, directory);
        renderDirectoryNode(elements.mobileDirectory, directory);
        const buffCount = directory.reduce((sum, owner) => sum + owner.items.length, 0);
        if (elements.meta) elements.meta.textContent = t('list.summary', { count: buffCount }, `${buffCount} 条 BuffData`);
    }

    function openMobileList() {
        state.mobileReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : elements.mobileButton;
        elements.mobileOverlay?.classList.add('is-open');
        elements.mobileOverlay?.setAttribute('aria-hidden', 'false');
        elements.mobileButton?.setAttribute('aria-expanded', 'true');
        window.setTimeout(() => elements.mobileSearch?.focus(), 0);
    }

    function closeMobileList(options) {
        const wasOpen = elements.mobileOverlay?.classList.contains('is-open');
        elements.mobileOverlay?.classList.remove('is-open');
        elements.mobileOverlay?.setAttribute('aria-hidden', 'true');
        elements.mobileButton?.setAttribute('aria-expanded', 'false');
        if (wasOpen && options?.restoreFocus !== false) window.setTimeout(() => state.mobileReturnFocus?.focus?.(), 0);
    }

    function loadingHtml(title, message) {
        return `<div class="ake-ui-state" data-state="loading" role="status"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div></div>`;
    }

    function errorHtml(title, message, retry) {
        return `<div class="ake-ui-state" data-state="error" role="alert"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${retry ? `<button type="button" class="buffv3-command-button" data-buffv3-action="retry">${escapeHtml(t('common.retry', null, '重试'))}</button>` : ''}</div></div>`;
    }

    async function fetchBuff(item) {
        if (state.buffCache.has(item.id)) return state.buffCache.get(item.id);
        const promise = (async () => {
            const path = item.contentFile || `/public/Json/BuffData/${encodeURIComponent(item.id)}.json`;
            const response = await (window.akeFetch || fetch)(path);
            if (!response.ok) throw new Error(t('common.readFailed', { id: item.id }, `无法读取 ${item.id}`));
            return response.json();
        })().catch(error => {
            state.buffCache.delete(item.id);
            throw error;
        });
        state.buffCache.set(item.id, promise);
        return promise;
    }

    function normalizeAnalysis(result, raw) {
        const source = isObject(result) ? result : {};
        const fallbackModifiers = {
            isConvertedAttribute: raw?.attributeModifier?.isConvertedAttribute === true,
            attributes: collection(raw?.attributeModifier?.attributeModifiers), damage: collection(raw?.damageModifier),
            heal: collection(raw?.healModifier), poise: collection(raw?.poiseModifier),
            global: collection(raw?.globalModifier), shields: collection(raw?.shieldConfigs)
        };
        const events = collection(source.events);
        const timelineGroups = collection(source.timelineGroups);
        const eventGroups = completeEventGroups(collection(source.eventGroups), timelineGroups, events);
        return {
            identity: isObject(source.identity) ? source.identity : { id: raw?.id, hasIcon: raw?.hasIcon, iconConfig: raw?.iconConfig },
            core: isObject(source.core) ? source.core : raw || {},
            stacking: isObject(source.stacking) ? source.stacking : (raw?.stackingSettings || {}),
            dispel: isObject(source.dispel) ? source.dispel : (raw?.dispelConfig || {}),
            modifiers: isObject(source.modifiers) ? source.modifiers : fallbackModifiers,
            tags: isObject(source.tags) ? source.tags : { apply: collection(raw?.applyTags), extendAfterTrigger: collection(raw?.tagsAfterTriggerExtendBuffAction) },
            eventGroups,
            timelineGroups,
            events,
            links: collection(source.links),
            blackboard: isObject(source.blackboard) ? source.blackboard : { entries: collection(raw?.blackboard), dependencies: [] },
            warnings: collection(source.warnings)
        };
    }

    function completeEventGroups(groups, timelineGroups, events) {
        const claimed = new Set();
        [...groups, ...timelineGroups].forEach(group => collection(group?.actionIndices).forEach(index => claimed.add(String(index))));
        const supplements = new Map();
        events.forEach((event, fallbackIndex) => {
            const index = String(event.index ?? fallbackIndex);
            if (claimed.has(index)) return;
            const source = String(event.source || event.eventKind || 'config');
            if (source === 'modifier-condition') return;
            const kind = String(event.eventKind || 'combat');
            const name = String(event.eventName || source);
            const groupIndex = event.groupIndex ?? '';
            const key = `${source}|${kind}|${name}|${groupIndex}`;
            if (!supplements.has(key)) supplements.set(key, {
                kind, source, eventName: name, groupIndex,
                actionIndices: [], actionCount: 0, presentationActionCount: 0
            });
            const group = supplements.get(key);
            group.actionIndices.push(event.index ?? fallbackIndex);
            group.actionCount += 1;
            if (event.presentation) group.presentationActionCount += 1;
        });
        return [...groups, ...supplements.values()];
    }

    async function analyzeCurrent(token) {
        const analyzer = window.AKEV3BuffData?.analyzeBuff;
        let result;
        if (typeof analyzer !== 'function') {
            result = { warnings: [{ code: 'ANALYZER_UNAVAILABLE' }] };
        } else {
            try {
                result = await analyzer(state.currentRaw, { manifestItem: state.currentItem, owner: state.activeOwner });
            } catch (error) {
                result = { warnings: [{ code: 'ANALYSIS_FAILED', message: error.message || error }] };
            }
        }
        if (state.disposed || token !== state.detailToken) return;
        state.analysis = normalizeAnalysis(result, state.currentRaw);
        renderDetail();
    }

    async function selectBuff(buffId, options) {
        if (state.disposed) return false;
        const settings = options || {};
        const record = state.buffIndex.get(buffId);
        if (!record) return false;
        state.activeBuffId = buffId;
        state.activeOwner = record.owner;
        state.currentItem = record.item;
        state.currentRaw = null;
        state.analysis = emptyAnalysis();
        state.activeTab = 'events';
        state.showPerformance = false;
        state.expandedOwners.add(record.owner.id);
        renderDirectories();
        closeMobileList({ restoreFocus: false });
        elements.detail.innerHTML = loadingHtml(record.item.displayName, t('common.loadingDetail', null, '正在解析 BuffData'));
        if (settings.focusDetail !== false) elements.detail.focus({ preventScroll: true });
        const token = ++state.detailToken;
        if (settings.updateUrl !== false) window.__akeRouter?.updateUrl?.(MODULE_ID, buffId);
        try {
            const raw = await fetchBuff(record.item);
            if (token !== state.detailToken) return true;
            state.currentRaw = raw;
            await analyzeCurrent(token);
        } catch (error) {
            if (token !== state.detailToken) return true;
            elements.detail.innerHTML = errorHtml(record.item.displayName,
                t('common.loadFailed', { message: error.message || error }, `加载失败：${error.message || error}`), true);
        }
        return true;
    }

    function metric(label, value, unit, important) {
        if (!isPresent(value) && value !== 0) return '';
        return `<div class="buffv3-metric${important ? ' is-important' : ''}">
            <div class="buffv3-metric-label">${escapeHtml(label)}</div>
            <div class="buffv3-metric-value">${escapeHtml(value)}</div>
            ${unit ? `<div class="buffv3-metric-unit">${escapeHtml(unit)}</div>` : ''}
        </div>`;
    }

    function coreMetrics() {
        const core = state.analysis.core || {};
        const stacking = state.analysis.stacking || {};
        const dispel = state.analysis.dispel || {};
        const lifeType = unwrapped(core.lifeType);
        const limited = String(lifeType || '').toLowerCase() !== 'infinity';
        const metrics = [];
        if (isPresent(lifeType)) metrics.push(metric(t('metrics.lifeType', null, '生命周期'),
            localizedEnum('lifeTypes', lifeType), '', true));

        const duration = numberValue(core.duration);
        if (limited && duration !== null && duration >= 0) metrics.push(metric(t('metrics.duration', null, '持续时间'),
            formatNumber(duration), resolvedUnit(core.duration) || t('units.secondsLabel', null, '秒'), true));

        const interval = numberValue(core.triggerInterval);
        if (interval !== null && interval >= 0) metrics.push(metric(t('metrics.triggerInterval', null, '触发间隔'),
            formatNumber(interval), resolvedUnit(core.triggerInterval) || t('units.secondsLabel', null, '秒')));
        if (core.waitFirstTriggerInterval === true) metrics.push(metric(t('metrics.firstTriggerDelay', null, '首次触发等待间隔'),
            t('values.yes', null, '是')));

        const maximumTriggers = numberValue(core.maxTriggerCnt);
        if (maximumTriggers !== null) metrics.push(metric(t('metrics.maxTriggerCount', null, '最大触发次数'),
            maximumTriggers < 0 ? t('values.infinite', null, '无限') : formatNumber(maximumTriggers),
            maximumTriggers < 0 ? '' : resolvedUnit(core.maxTriggerCnt) || t('units.timesLabel', null, '次')));

        const stackingType = unwrapped(stacking.stackingType);
        if (isPresent(stackingType)) metrics.push(metric(t('metrics.stackingType', null, '叠加规则'),
            localizedEnum('stackingTypes', stackingType), '', true));
        const identifierType = unwrapped(stacking.identifierType);
        if (isPresent(identifierType)) {
            const identifier = localizedEnum('identifierTypes', identifierType);
            metrics.push(metric(t('metrics.stackingIdentifier', null, '叠加标识'),
                stacking.stackingKey ? `${identifier} · ${stacking.stackingKey}` : identifier));
        }
        const maximumStacks = numberValue(stacking.maxStackCnt);
        if (maximumStacks !== null && maximumStacks !== 0) metrics.push(metric(t('metrics.maxStacks', null, '最大层数'),
            maximumStacks < 0 ? t('values.infinite', null, '无限') : formatNumber(maximumStacks),
            maximumStacks < 0 ? '' : resolvedUnit(stacking.maxStackCnt) || t('units.stacksLabel', null, '层')));
        const priority = numberValue(stacking.priority);
        if (priority !== null && priority !== 0) metrics.push(metric(t('metrics.priority', null, '优先级'),
            formatNumber(priority), resolvedUnit(stacking.priority)));

        if (Object.prototype.hasOwnProperty.call(dispel, 'canBeDispelled')) metrics.push(metric(t('metrics.dispel', null, '可驱散'),
            formatValue(dispel.canBeDispelled)));
        const addingCooldown = numberValue(core.addingCooldown);
        if (core.hasAddingCooldown === true && addingCooldown !== null && addingCooldown > 0) metrics.push(metric(
            t('metrics.addingCooldown', null, '添加冷却'), formatNumber(addingCooldown),
            resolvedUnit(core.addingCooldown) || t('units.secondsLabel', null, '秒')));
        if (core.ignoreTagImmune === true) metrics.push(metric(t('metrics.ignoreTagImmune', null, '忽略标签免疫'), t('values.yes', null, '是')));
        if (core.useTimeDilationDt === true) metrics.push(metric(t('metrics.timeDilation', null, '受时间膨胀影响'), t('values.yes', null, '是')));
        if (core.onlyUseSelfTimeDilation === true) metrics.push(metric(t('metrics.selfTimeDilationOnly', null, '仅使用自身时间膨胀'), t('values.yes', null, '是')));
        if (core.finishOnRepatriate === true) metrics.push(metric(t('metrics.finishOnRepatriate', null, '归还时结束'), t('values.yes', null, '是')));
        if (core.ignoreCooldownWhenAdding === true) metrics.push(metric(t('metrics.ignoreCooldownWhenAdding', null, '重复添加时忽略冷却'), t('values.yes', null, '是')));
        return metrics.filter(Boolean);
    }

    function fieldLabel(key) {
        const fallback = combatT(`timeline.fields.${key}`, null, splitIdentifier(key, false));
        return t(`fields.${key}`, null, fallback);
    }

    function displayPair(key, value) {
        const enumGroups = {
            formula: 'formulaTypes', formulaType: 'formulaTypes', formulaItem: 'formulaTypes',
            stackingType: 'stackingTypes', identifierType: 'identifierTypes', lifeType: 'lifeTypes',
            processorType: 'processorTypes', globalModifierType: 'globalModifierTypes'
        };
        const formatted = formatFieldValue(key, value, enumGroups[key] || null);
        if (!formatted) return '';
        const unit = resolvedUnit(value);
        return `<div class="buffv3-data-pair"><span>${escapeHtml(fieldLabel(key))}</span><strong>${escapeHtml(formatted)}</strong>${unit ? `<small>${escapeHtml(unit)}</small>` : ''}</div>`;
    }

    function scalarPairs(source, limit) {
        if (!isObject(source)) return [];
        const keys = [...new Set([...FIELD_PRIORITY, ...Object.keys(source)])];
        const pairs = [];
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(source, key) || FIELD_META_KEYS.has(key)) continue;
            if (key === 'param' && Object.prototype.hasOwnProperty.call(source, 'value')) continue;
            if (key === 'formulaItem' && Object.prototype.hasOwnProperty.call(source, 'formula')) continue;
            const value = source[key];
            const scalar = unwrapped(value);
            const usable = ['string', 'number', 'boolean'].includes(typeof scalar)
                || (Array.isArray(scalar) && scalar.length && scalar.every(item => ['string', 'number', 'boolean'].includes(typeof unwrapped(item))))
                || (isObject(value) && isPresent(formatCompactValue(value)));
            if (!usable || scalar === '') continue;
            const html = displayPair(key, value);
            if (html) pairs.push(html);
            if (pairs.length >= (limit || 10)) break;
        }
        return pairs;
    }

    function nestedSummary(item, key) {
        const entries = collection(item?.[key]);
        if (!entries.length) return '';
        return `<div class="buffv3-nested-summary"><span>${escapeHtml(fieldLabel(key))}</span><div>${entries.map(entry => {
            const label = formatCompactValue(entry) || t('values.configured', null, '已配置');
            return `<span class="buffv3-token">${escapeHtml(label)}</span>`;
        }).join('')}</div></div>`;
    }

    function renderDescriptors(item, key) {
        const entries = collection(item?.[key]);
        if (!entries.length) return '';
        return `<div class="buffv3-descriptor-list"><span>${escapeHtml(fieldLabel(key))}</span><div>${entries.map((entry, index) => {
            const rawType = entry?.type || entry?.processorType || `${fieldLabel(key)} ${index + 1}`;
            const title = localizedEnum('processorTypes', rawType);
            const pairs = [...scalarPairs(entry, 8), ...summaryFieldPairs(entry?.summaryFields, entry, 12)];
            return `<div class="buffv3-descriptor"><strong>${escapeHtml(title)}</strong>${pairs.length ? `<div class="buffv3-data-grid">${pairs.join('')}</div>` : ''}</div>`;
        }).join('')}</div></div>`;
    }

    function summaryFieldPairs(fields, source, limit) {
        if (!Array.isArray(fields)) return [];
        const seen = new Set();
        Object.entries(source || {}).forEach(([key, value]) => {
            const display = formatFieldValue(key, value);
            if (display) seen.add(`${key}|${display}`);
        });
        const pairs = [];
        fields.forEach((entry, index) => {
            if (pairs.length >= (limit || 10)) return;
            const key = entry?.key || entry?.field || `value${index + 1}`;
            const value = entry?.value ?? entry?.resolvedValue;
            const display = formatFieldValue(key, value);
            const signature = `${key}|${display}`;
            if (!display || seen.has(signature) || /(?:^|_)type$/i.test(key)) return;
            seen.add(signature);
            const html = displayPair(key, value);
            if (html) pairs.push(html);
        });
        return pairs;
    }

    function renderDescriptorObject(item, key) {
        const descriptor = item?.[key];
        if (!isObject(descriptor)) return '';
        const pairs = [...scalarPairs(descriptor, 8), ...summaryFieldPairs(descriptor.summaryFields, descriptor, 12)];
        if (!pairs.length) return '';
        const title = localizedEnum('processorTypes', descriptor.type || key);
        return `<div class="buffv3-descriptor-list"><span>${escapeHtml(fieldLabel(key))}</span><div><div class="buffv3-descriptor"><strong>${escapeHtml(title)}</strong><div class="buffv3-data-grid">${pairs.join('')}</div></div></div></div>`;
    }

    function renderModifierCondition(item) {
        const condition = item?.condition;
        if (!isObject(condition)) return '';
        const actionIndices = collection(condition.actionIndices);
        const activeFlags = Object.fromEntries(Object.entries(condition).filter(([key, value]) =>
            !['actionIndices', 'actionCount'].includes(key) && value !== false && isPresent(value)));
        const flags = scalarPairs(activeFlags, 4);
        if (!actionIndices.length && !flags.length) return '';
        const count = actionIndices.length;
        return `<details class="buffv3-effect-actions"><summary><span>${escapeHtml(t('sections.conditions', null, '条件'))}</span><small>${escapeHtml(t('units.actions', { count }, `${count} 个 Action`))}</small></summary>${flags.length ? `<div class="buffv3-data-grid">${flags.join('')}</div>` : ''}${actionIndices.length ? `<div class="buffv3-action-tree">${renderGroupActions({ actionIndices })}</div>` : ''}</details>`;
    }

    function effectTitle(item, index, fallback) {
        if (!isObject(item)) return formatCompactValue(item) || `${fallback} ${index + 1}`;
        const value = item.attributeType ?? item.attrType ?? item.processorType ?? item.modifierType ?? item.type
            ?? item.formulaType ?? item.damageType ?? item.healType ?? item.poiseType;
        if (!isPresent(value) || ['attribute', 'damage', 'heal', 'poise', 'global', 'shield'].includes(String(value).toLowerCase())) {
            return `${fallback} ${index + 1}`;
        }
        return localizedEnum('globalModifierTypes', value);
    }

    function renderEffectCollection(title, values, tone, options) {
        const items = collection(values);
        if (!items.length) return '';
        return `<section class="buffv3-effect-group buffv3-effect-group--${escapeHtml(tone)}">
            <header><h3>${escapeHtml(title)}</h3><span>${options?.converted ? `<strong class="buffv3-conversion-badge">${escapeHtml(t('modifierTypes.attributeConversion', null, '属性转换'))}</strong>` : ''}${escapeHtml(t('list.sectionCount', { count: items.length }, `${items.length} 条`))}</span></header>
            <div class="buffv3-effect-list">${items.map((item, index) => {
                const pairs = scalarPairs(isObject(item) ? item : { value: item }, 12);
                const nested = renderDescriptors(item, 'processors') + renderDescriptors(item, 'damageAbsorptions')
                    + renderDescriptorObject(item, 'calculation') + nestedSummary(item, 'rules') + renderModifierCondition(item);
                return `<article class="buffv3-effect-item"><div class="buffv3-effect-title">${escapeHtml(effectTitle(item, index, title))}</div>${pairs.length ? `<div class="buffv3-data-grid">${pairs.join('')}</div>` : ''}${nested}</article>`;
            }).join('')}</div>
        </section>`;
    }

    function renderTags() {
        const tags = state.analysis.tags || {};
        const groups = [
            [collection(tags.apply), t('fields.applyTags', null, '应用标签')],
            [collection(tags.extendAfterTrigger), t('fields.extendTags', null, '触发延长标签')]
        ].filter(([items]) => items.length);
        if (!groups.length) return '';
        return `<section class="buffv3-effect-group buffv3-effect-group--tags"><header><h3>${escapeHtml(t('sections.tags', null, '战斗标签'))}</h3></header><div class="buffv3-tag-groups">${groups.map(([items, label]) => `
            <div><span>${escapeHtml(label)}</span><div>${items.map(item => `<code>${escapeHtml(formatCompactValue(item?.tagId ?? item) || formatValue(item?.tagId ?? item))}</code>`).join('')}</div></div>`).join('')}</div></section>`;
    }

    function renderEffectsPanel() {
        const modifiers = state.analysis.modifiers || {};
        const conversionNotice = modifiers.isConvertedAttribute === true && !collection(modifiers.attributes).length
            ? `<div class="buffv3-conversion-notice">${escapeHtml(t('modifierTypes.attributeConversion', null, '属性转换'))}</div>` : '';
        const content = EFFECT_GROUPS.map(([key, translation, fallback, tone]) =>
            renderEffectCollection(t(translation, null, fallback), modifiers[key], tone, {
                converted: key === 'attributes' && modifiers.isConvertedAttribute === true
            })).join('') + renderTags();
        const body = conversionNotice + content;
        return `<section class="ake-ui-section"><header class="ake-ui-section__header"><div><span class="ake-ui-detail-eyebrow">BuffData</span><h2 class="ake-ui-section__title">${escapeHtml(t('sections.effects', null, '战斗效果'))}</h2></div></header>${body || `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noEffects', null, '没有可展示的战斗效果'))}</div>`}</section>`;
    }

    function eventChildrenMap() {
        const map = new Map();
        state.analysis.events.forEach(event => {
            if (!isPresent(event.parentEventIndex)) return;
            const key = String(event.parentEventIndex);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(event);
        });
        return map;
    }

    function eventByIndex() {
        return new Map(state.analysis.events.map((event, index) => [String(event.index ?? index), event]));
    }

    function groupEvents(group) {
        const byIndex = eventByIndex();
        const indices = collection(group?.actionIndices).map(value => String(unwrapped(value)));
        if (indices.length) return indices.map(index => byIndex.get(index)).filter(Boolean);
        return state.analysis.events.filter(event => {
            if (group?.kind && event.eventKind && group.kind !== event.eventKind) return false;
            if (isPresent(group?.eventName) && isPresent(event.eventName) && String(group.eventName) !== String(event.eventName)) return false;
            if (isPresent(group?.groupIndex) && isPresent(event.groupIndex) && Number(group.groupIndex) !== Number(event.groupIndex)) return false;
            return Boolean(group?.kind || group?.eventName || isPresent(group?.groupIndex));
        });
    }

    function visibleEventCount(events, children) {
        const visited = new Set();
        let count = 0;
        function walk(event) {
            const index = String(event.index ?? '');
            if (index && visited.has(index)) return;
            if (index) visited.add(index);
            if (state.showPerformance || !event.presentation) count += 1;
            (children.get(index) || []).forEach(walk);
        }
        events.forEach(walk);
        return count;
    }

    function actionLabel(event) {
        const type = String(event.type || 'UnknownAction');
        return combatT(`timeline.actions.${type}`, null,
            t(`actions.${type}`, null, splitIdentifier(type, true)));
    }

    function eventFieldEntries(event) {
        const source = event.summaryFields;
        let entries = [];
        if (Array.isArray(source)) {
            entries = source.map((entry, index) => {
                if (isObject(entry)) return [entry.key || entry.field || entry.name || `value${index + 1}`, entry.value ?? entry.resolvedValue ?? entry.summary];
                return [`value${index + 1}`, entry];
            });
        } else if (isObject(source)) {
            entries = Object.entries(source);
        }
        const seen = new Set();
        return [...flattenDetailEntries(event.details), ...entries].filter(([key, value]) => {
            const display = formatFieldValue(key, value);
            const signature = `${key}|${display}`;
            if (!display || seen.has(signature)) return false;
            seen.add(signature);
            return true;
        });
    }

    function flattenDetailEntries(value) {
        if (!isObject(value) && !Array.isArray(value)) return [];
        const entries = [];
        const seen = new WeakSet();
        function visit(item, key, depth) {
            if (entries.length >= 24 || item === null || item === undefined || item === '') return;
            const scalar = unwrapped(item);
            if (scalar !== item || ['string', 'number', 'boolean'].includes(typeof scalar)) {
                entries.push([key || 'value', item]);
                return;
            }
            if (!item || typeof item !== 'object' || depth > 4 || seen.has(item)) return;
            seen.add(item);
            if (Array.isArray(item)) {
                if (item.every(child => ['string', 'number', 'boolean'].includes(typeof unwrapped(child)))) {
                    entries.push([key || 'values', item]);
                } else {
                    item.slice(0, 8).forEach((child, index) => visit(child, `${key || 'item'}${index + 1}`, depth + 1));
                }
                return;
            }
            Object.entries(item).forEach(([childKey, child]) => {
                if (!FIELD_META_KEYS.has(childKey)) visit(child, childKey, depth + 1);
            });
        }
        visit(value, '', 0);
        return entries;
    }

    function renderActionFields(event) {
        const entries = eventFieldEntries(event).filter(([key, value]) => isPresent(formatFieldValue(key, value))).slice(0, 14);
        if (!entries.length) return '';
        return `<div class="buffv3-action-fields">${entries.map(([key, value]) => {
            const display = formatFieldValue(key, value);
            const unit = resolvedUnit(value);
            return `<span><small>${escapeHtml(fieldLabel(key))}</small><strong>${escapeHtml(display)}</strong>${unit ? `<em>${escapeHtml(unit)}</em>` : ''}</span>`;
        }).join('')}</div>`;
    }

    function renderActionNode(event, children, visited, depth) {
        const index = String(event.index ?? '');
        if (index && visited.has(index)) return '';
        if (index) visited.add(index);
        const childEvents = children.get(index) || [];
        const childHtml = childEvents.map(child => renderActionNode(child, children, visited, depth + 1)).join('');
        if (event.presentation && !state.showPerformance) return childHtml;
        const type = String(event.type || 'UnknownAction');
        const rawType = String(event.rawType || type).split(',')[0];
        const category = String(event.category || 'misc');
        const relation = event.relation ? t(`relations.${enumKey(event.relation)}`, null, splitIdentifier(event.relation, false)) : '';
        return `<article class="buffv3-action buffv3-action--${escapeHtml(category)}" style="--buffv3-depth:${Math.min(depth, 8)}">
            <header class="buffv3-action-header"><div><strong>${escapeHtml(actionLabel(event))}</strong><code>${escapeHtml(rawType)}</code></div><div class="buffv3-action-badges">
                ${relation ? `<span>${escapeHtml(relation)}</span>` : ''}
                ${event.enabled === false ? `<span class="is-disabled">${escapeHtml(t('values.disabled', null, '已禁用'))}</span>` : ''}
                ${event.presentation ? `<span class="is-presentation">${escapeHtml(t('values.presentation', null, '表现'))}</span>` : ''}
            </div></header>
            ${renderActionFields(event)}
            ${childHtml ? `<div class="buffv3-action-children">${childHtml}</div>` : ''}
        </article>`;
    }

    function renderGroupActions(group) {
        const children = eventChildrenMap();
        const seeds = groupEvents(group);
        const seedIds = new Set(seeds.map((event, index) => String(event.index ?? index)));
        const roots = seeds.filter(event => !seedIds.has(String(event.parentEventIndex)));
        const candidates = roots.length ? roots : seeds;
        const html = candidates.map(event => renderActionNode(event, children, new Set(), 0)).join('');
        return html || `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noVisibleActions', null, '没有可展示的战斗动作'))}</div>`;
    }

    function performanceToggle() {
        const hasPresentation = state.analysis.events.some(event => event.presentation);
        if (!hasPresentation) return '';
        return `<label class="buffv3-switch"><input type="checkbox" data-buffv3-action="toggle-performance"${state.showPerformance ? ' checked' : ''}><span aria-hidden="true"></span><strong>${escapeHtml(t('buttons.showPerformance', null, '显示表现动作'))}</strong></label>`;
    }

    function eventGroupTitle(group) {
        if (group.source === 'modifier-condition') return t('eventNames.modifierCondition', null, '修饰器生效条件');
        if (group.source === 'stacking') return t('eventNames.stacking', null, '层数表现');
        if (group.source === 'config') return t('eventNames.otherConfigActions', null, '其他配置动作');
        const name = group.eventName ?? group.name ?? group.igniteType;
        if (isPresent(name)) return localizedEnum('eventNames', name);
        return t(`eventKinds.${enumKey(group.kind || 'buff')}`, null, splitIdentifier(group.kind || 'buff', false));
    }

    function renderEventsTab() {
        const groups = state.analysis.eventGroups;
        if (!groups.length) return `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noEvents', null, '没有事件动作'))}</div>`;
        const children = eventChildrenMap();
        return `<div class="buffv3-tab-toolbar">${performanceToggle()}</div><div class="buffv3-event-groups">${groups.map((group, index) => {
            const events = groupEvents(group);
            const count = visibleEventCount(events, children);
            const kind = t(`eventKinds.${enumKey(group.kind || 'buff')}`, null, splitIdentifier(group.kind || 'buff', false));
            return `<details class="buffv3-event-group"${index === 0 ? ' open' : ''}><summary><span><small>${escapeHtml(kind)}</small><strong>${escapeHtml(eventGroupTitle(group))}</strong>${group.finishAfterIgnited ? `<em>${escapeHtml(t('values.finishAfterIgnited', null, '点燃后结束'))}</em>` : ''}</span><span>${escapeHtml(t('units.actions', { count }, `${count} 个动作`))}</span></summary><div class="buffv3-action-tree">${renderGroupActions(group)}</div></details>`;
        }).join('')}</div>`;
    }

    function timelineRange(group) {
        const start = numberValue(group.startFrame) ?? 0;
        const end = numberValue(group.endFrame);
        const openEnded = group.openEnded === true || (end !== null && end >= 999999);
        return { start, end: openEnded || end === null ? start : end, openEnded };
    }

    function renderTimelineTab() {
        const groups = [...state.analysis.timelineGroups].sort((a, b) => timelineRange(a).start - timelineRange(b).start);
        if (!groups.length) return `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noTimeline', null, '没有时间轴动作'))}</div>`;
        const ranges = groups.map(timelineRange);
        const finiteEnd = Math.max(1, ...ranges.filter(range => !range.openEnded).map(range => range.end), ...ranges.map(range => range.start + 1));
        return `<div class="buffv3-tab-toolbar">${performanceToggle()}</div><div class="buffv3-timeline-axis"><span>0</span><span>${escapeHtml(t('units.frames', { value: finiteEnd }, `${finiteEnd} 帧`))}</span></div><div class="buffv3-timeline-groups">${groups.map((group, index) => {
            const range = ranges[index];
            const left = Math.max(0, Math.min(98, range.start / finiteEnd * 100));
            const width = range.openEnded ? Math.max(3, 100 - left) : Math.max(2, (range.end - range.start) / finiteEnd * 100);
            const duration = range.openEnded ? null : (numberValue(group.durationFrames) ?? Math.max(0, range.end - range.start));
            const endLabel = range.openEnded ? t('values.openEnded', null, '开放结束') : formatNumber(range.end);
            const seconds = duration === null ? '' : (duration / 30).toFixed(duration % 30 === 0 ? 1 : 2);
            const rawGroupNumber = Number(group.groupIndex ?? index);
            const groupNumber = Number.isFinite(rawGroupNumber) ? rawGroupNumber + 1 : index + 1;
            return `<details class="buffv3-timeline-group"${index === 0 ? ' open' : ''}>
                <summary><span class="buffv3-timeline-label"><strong>${escapeHtml(t('units.group', { number: groupNumber }, `组 ${groupNumber}`))}</strong><small>${escapeHtml(`${formatNumber(range.start)}–${endLabel}`)}</small></span><span class="buffv3-timeline-track"><i style="left:${left}%;width:${width}%"></i></span><span class="buffv3-timeline-duration"><strong>${escapeHtml(duration === null ? endLabel : formatNumber(duration))}</strong>${duration === null ? '' : `<small>${escapeHtml(t('units.frameApprox', { seconds }, `帧，约 ${seconds} 秒`))}</small>`}</span></summary>
                <div class="buffv3-action-tree">${renderGroupActions(group)}</div>
            </details>`;
        }).join('')}</div>`;
    }

    function normalizedLinks() {
        const seen = new Set();
        return state.analysis.links.filter(link => {
            if (link?.kind && link.kind !== 'buff') return false;
            const id = linkId(link);
            const key = `${id}|${link?.resolvedId?.blackboardKey || ''}|${link?.relation || ''}`;
            if (!id || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function linkId(link) {
        const resolved = unwrapped(link?.resolvedId);
        if (isPresent(resolved)) return String(resolved);
        if (isPresent(link?.id)) return String(link.id);
        const blackboardKey = link?.resolvedId?.blackboardKey;
        return blackboardKey ? `@${blackboardKey}` : '';
    }

    function renderLinksTab() {
        const links = normalizedLinks();
        if (!links.length) return `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noLinks', null, '当前 Buff 未直接引用其他 Buff'))}</div>`;
        return `<div class="buffv3-link-note">${escapeHtml(t('header.linksScope', null, '仅展示当前 BuffData 内可确认的直接关联'))}</div><div class="buffv3-link-list">${links.map(link => {
            const id = linkId(link);
            const dynamic = link.dynamic === true;
            const target = !dynamic && /^buff_/i.test(id) ? state.buffIndex.get(id) : null;
            const relation = link.relation ? t(`relations.${enumKey(link.relation)}`, null, splitIdentifier(link.relation, false)) : t('values.directReference', null, '直接引用');
            const blackboardKey = String(link.resolvedId?.blackboardKey || '');
            const technicalId = dynamic && blackboardKey
                ? `@${blackboardKey}${id && !id.startsWith('@') ? ` -> ${id}` : ''}`
                : id;
            const linkState = dynamic ? `${relation} · ${t('values.dynamic', null, '动态值')}` : relation;
            const inner = `<span><strong>${escapeHtml(target?.item.displayName || id)}</strong><code>${escapeHtml(technicalId)}</code></span><small>${escapeHtml(linkState)}</small>`;
            return target
                ? `<button type="button" class="buffv3-link-item" data-buffv3-action="select-link" data-buff-id="${escapeHtml(id)}">${inner}</button>`
                : `<div class="buffv3-link-item is-unavailable">${inner}</div>`;
        }).join('')}</div>`;
    }

    function technicalBlock(title, value) {
        const pairs = scalarPairs(value, 18);
        if (!pairs.length) return '';
        return `<section class="buffv3-technical-block"><h3>${escapeHtml(title)}</h3><div class="buffv3-data-grid">${pairs.join('')}</div></section>`;
    }

    function warningText(warning) {
        if (!isObject(warning)) return formatValue(warning) || String(warning || '');
        const code = String(warning.code || 'UNKNOWN');
        const message = formatValue(warning.message);
        return t(`warnings.${code}`, {
            ...warning,
            message: message || code,
            start: warning.start ?? warning.startFrame ?? '',
            end: warning.end ?? warning.endFrame ?? ''
        }, message || splitIdentifier(code, false));
    }

    function renderBlackboard() {
        const blackboard = state.analysis.blackboard || {};
        const entries = collection(blackboard.entries);
        if (!entries.length) return '';
        return `<section class="buffv3-technical-block"><h3>${escapeHtml(t('sections.blackboard', null, '黑板参数'))}</h3><div class="buffv3-blackboard-list">${entries.map((entry, index) => {
            const key = entry?.key ?? entry?.blackboardKey ?? entry?.name ?? `#${index + 1}`;
            const value = entry?.value ?? entry?.defaultValue ?? entry?.fallbackValue;
            const source = entry?.status ?? entry?.source;
            return `<article><div><code>${escapeHtml(key)}</code>${source ? `<span>${escapeHtml(t(`blackboardSources.${enumKey(source)}`, null, splitIdentifier(source, false)))}</span>` : ''}</div><strong>${escapeHtml(formatValue(value))}</strong></article>`;
        }).join('')}</div></section>`;
    }

    function renderDependencies() {
        const dependencies = collection(state.analysis.blackboard?.dependencies);
        if (!dependencies.length) return '';
        const hasExternal = dependencies.some(entry => entry?.status === 'external-key');
        return `<section class="buffv3-technical-block"><h3>${escapeHtml(t('technical.references', null, 'Blackboard 引用'))}</h3>${hasExternal ? `<p class="buffv3-technical-note">${escapeHtml(t('technical.externalNotice', null, '外部 Blackboard 键需要运行时上下文，不视为解析错误。'))}</p>` : ''}<div class="buffv3-blackboard-list">${dependencies.map((entry, index) => {
            const key = entry?.key || `#${index + 1}`;
            const status = entry?.status || 'external-key';
            const value = isPresent(entry?.value) ? entry.value : entry?.fallbackValue;
            return `<article><div><code>${escapeHtml(key)}</code><span>${escapeHtml(entry?.path || '')}</span></div><strong>${escapeHtml(formatValue(value))}</strong><span class="buffv3-dependency-status">${escapeHtml(t(`blackboardSources.${status}`, null, splitIdentifier(status, false)))}</span></article>`;
        }).join('')}</div></section>`;
    }

    function renderTechnicalTab() {
        const content = [
            technicalBlock(t('sections.stacking', null, '叠加设置'), state.analysis.stacking),
            technicalBlock(t('sections.dispel', null, '驱散设置'), state.analysis.dispel),
            renderBlackboard(),
            renderDependencies()
        ].join('');
        const warnings = state.analysis.warnings.length ? `<section class="buffv3-technical-block buffv3-technical-block--warning"><h3>${escapeHtml(t('sections.warnings', null, '解析提示'))}</h3><div class="buffv3-warning-list">${state.analysis.warnings.map(warning => `<div><code>${escapeHtml(warning?.code || 'INFO')}</code><span>${escapeHtml(warningText(warning))}</span></div>`).join('')}</div></section>` : '';
        return content || warnings ? `${content}${warnings}` : `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noTechnical', null, '没有额外技术参数'))}</div>`;
    }

    function tabDefinitions() {
        const eventCount = state.analysis.eventGroups.length;
        const timelineCount = state.analysis.timelineGroups.length;
        const linkCount = normalizedLinks().length;
        const technicalCount = collection(state.analysis.blackboard?.entries).length
            + collection(state.analysis.blackboard?.dependencies).length + state.analysis.warnings.length;
        return [
            ['events', 'tabs.events', '事件', eventCount],
            ['timeline', 'tabs.timeline', '时间轴', timelineCount],
            ['links', 'tabs.links', '关联', linkCount],
            ['technical', 'tabs.technical', '技术详情', technicalCount]
        ];
    }

    function renderTabs() {
        const tabs = tabDefinitions();
        const renderers = { events: renderEventsTab, timeline: renderTimelineTab, links: renderLinksTab, technical: renderTechnicalTab };
        const logicTitle = t('sections.eventLogic', null, '触发与执行逻辑');
        return `<section class="ake-ui-section buffv3-logic-section"><header class="ake-ui-section__header"><div><span class="ake-ui-detail-eyebrow">ActionData</span><h2 class="ake-ui-section__title">${escapeHtml(logicTitle)}</h2></div></header><div class="ake-ui-tabs" data-variant="segment" data-layout="equal" role="tablist" aria-label="${escapeHtml(logicTitle)}">${tabs.map(([id, key, fallback, count]) => `
            <button id="buffv3Tab-${id}" type="button" role="tab" aria-selected="${state.activeTab === id ? 'true' : 'false'}" aria-controls="buffv3TabPanel" tabindex="${state.activeTab === id ? '0' : '-1'}" class="ake-ui-tabs__button${state.activeTab === id ? ' is-active' : ''}" data-buffv3-action="switch-tab" data-tab="${id}"><span>${escapeHtml(t(key, null, fallback))}</span><small>${escapeHtml(count)}</small></button>`).join('')}</div><div class="ake-ui-tabs__panel" id="buffv3TabPanel" role="tabpanel" aria-labelledby="buffv3Tab-${state.activeTab}">${renderers[state.activeTab]?.() || renderEventsTab()}</div></section>`;
    }

    function renderDetail() {
        if (!state.currentItem || !state.activeOwner) {
            elements.detail.innerHTML = `<div class="ake-ui-state" data-state="empty" role="status"><div><h2>${escapeHtml(buffT('title', null, 'Buff'))}</h2><p>${escapeHtml(t('empty.select', null, '请选择 Buff'))}</p></div></div>`;
            return;
        }
        const item = state.currentItem;
        const owner = state.activeOwner;
        const identity = state.analysis.identity || {};
        const configuredIcon = identity.iconPath || identity.iconConfig?._spritePath || identity.iconConfig?.spritePath;
        const buffIcon = identity.hasIcon === false ? '' : iconPath(configuredIcon);
        const ownerIcon = owner.icon ? `<img src="${escapeHtml(owner.icon)}" alt="">` : '';
        const ownerPlugin = owner.icon && owner.entityKind === 'character' ? 'v3_character' : (owner.icon && owner.entityKind === 'enemy' ? 'v3_enemy' : '');
        const ownerChip = ownerPlugin
            ? window.AKEUI.entryLinkHtml({ plugin: ownerPlugin, id: owner.id, label: owner.name, className: 'buffv3-owner-chip', contentHtml: `${ownerIcon}<span>${escapeHtml(owner.name)}</span>` })
            : `<span class="buffv3-owner-chip">${ownerIcon}<span>${escapeHtml(owner.name)}</span></span>`;
        const metrics = coreMetrics();
        const detailHeader = window.AKEUI.detailHeader({
            layout: 'showcase',
            icon: buffIcon ? { src: buffIcon } : null,
            beforeTitle: window.AKEUI.fragment(`<div class="ake-ui-detail-meta">${ownerChip}<span>BuffData</span></div>`),
            title: item.displayName,
            id: item.id,
            after: window.AKEUI.fragment(`<aside class="ake-ui-detail-aside"><strong class="ake-ui-detail-aside__title">${escapeHtml(t('header.ownerHint', null, '归属提示'))}</strong><span class="ake-ui-detail-aside__body">${escapeHtml(t('header.prefixNotice', null, '目录归属由 ID 前缀推断，不代表运行时来源。'))}</span></aside>`)
        });
        elements.detail.innerHTML = `<div class="ake-ui-detail" data-detail-kind="buff">
            ${detailHeader?.outerHTML || ''}
            <section class="ake-ui-section"><header class="ake-ui-section__header"><div><span class="ake-ui-detail-eyebrow">Config</span><h2 class="ake-ui-section__title">${escapeHtml(t('sections.core', null, '核心指标'))}</h2></div></header><div class="buffv3-metric-grid">${metrics.join('') || `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('empty.noCoreMetrics', null, '没有可展示的核心指标'))}</div>`}</div></section>
            ${renderEffectsPanel()}
            ${renderTabs()}
        </div>`;
    }

    function onDirectoryClick(event) {
        const control = event.target.closest('[data-buffv3-action]');
        if (!control) return;
        const action = control.dataset.buffv3Action;
        if (action === 'toggle-owner') {
            const id = control.dataset.ownerId;
            const target = control.closest('#buffv3MobileDirectory') ? elements.mobileDirectory : elements.directory;
            if (state.expandedOwners.has(id)) state.expandedOwners.delete(id);
            else state.expandedOwners.add(id);
            renderDirectories();
            [...target.querySelectorAll('[data-buffv3-action="toggle-owner"]')]
                .find(button => button.dataset.ownerId === id)?.focus();
        } else if (action === 'select-buff') {
            selectBuff(control.dataset.buffId);
        }
    }

    function onDetailClick(event) {
        const control = event.target.closest('[data-buffv3-action]');
        if (!control) return;
        const action = control.dataset.buffv3Action;
        if (action === 'switch-tab') {
            state.activeTab = control.dataset.tab;
            renderDetail();
            document.getElementById(`buffv3Tab-${state.activeTab}`)?.focus();
        } else if (action === 'select-link') {
            selectBuff(control.dataset.buffId);
        } else if (action === 'retry' && state.currentItem) {
            state.buffCache.delete(state.currentItem.id);
            selectBuff(state.currentItem.id);
        }
    }

    function onDetailChange(event) {
        const control = event.target.closest('[data-buffv3-action="toggle-performance"]');
        if (!control) return;
        state.showPerformance = control.checked;
        renderDetail();
        elements.detail.querySelector('[data-buffv3-action="toggle-performance"]')?.focus();
    }

    function onDetailKeyDown(event) {
        const tab = event.target.closest('[role="tab"][data-tab]');
        if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const ids = tabDefinitions().map(([id]) => id);
        const current = Math.max(0, ids.indexOf(tab.dataset.tab));
        let next = current;
        if (event.key === 'ArrowLeft') next = (current - 1 + ids.length) % ids.length;
        if (event.key === 'ArrowRight') next = (current + 1) % ids.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = ids.length - 1;
        state.activeTab = ids[next];
        renderDetail();
        document.getElementById(`buffv3Tab-${state.activeTab}`)?.focus();
    }

    function onSearchInput(event) {
        const value = String(event.target.value || '');
        state.query = value.trim().toLowerCase();
        if (elements.search && elements.search.value !== value) elements.search.value = value;
        if (elements.mobileSearch && elements.mobileSearch.value !== value) elements.mobileSearch.value = value;
        renderDirectories();
    }

    function onOverlayClick(event) {
        if (event.target === elements.mobileOverlay) closeMobileList();
    }

    function onKeyDown(event) {
        if (!elements.mobileOverlay?.classList.contains('is-open')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeMobileList();
            return;
        }
        if (event.key !== 'Tab' || !elements.mobilePanel) return;
        const focusable = [...elements.mobilePanel.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
            .filter(element => element.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!elements.mobilePanel.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    async function loadManifest() {
        return window.akeAssetIndex.listJsonFiles('BuffData', { hidden: showHidden() });
    }

    async function initialize() {
        try {
            const [manifest, characters, growth, enemyDisplay, enemies] = await Promise.all([
                loadManifest(),
                window.AKEV3.table('CharacterTable'),
                window.AKEV3.table('CharGrowthTable'),
                window.AKEV3.table('EnemyTemplateDisplayInfoTable'),
                window.AKEV3.table('EnemyTable')
            ]);
            if (state.disposed) return;
            state.rawManifest = collection(manifest);
            state.manifest = state.rawManifest.filter(item => !HIDDEN_OWNER_PATTERN.test(String(item.id || ''))
                && (showHidden() || !item.hidden));
            state.tables = { characters, growth, enemyDisplay, enemies };
            state.directory = buildDirectory(state.manifest, characters, growth, enemyDisplay, enemies);
            rebuildIndex();
            renderDirectories();
            if (!state.manifest.length) {
                elements.detail.innerHTML = errorHtml(buffT('title', null, 'Buff'), t('empty.manifest', null, 'BuffData 清单为空'));
                return;
            }
            if (state.pendingDeepId) {
                const selected = await selectBuff(state.pendingDeepId, { updateUrl: false, focusDetail: false });
                if (selected) return;
                if (root.isConnected) {
                    window.__akeRouter?.onDeepLinkNotFound?.(state.pendingDeepId,
                        state.rawManifest.some(item => item.id === state.pendingDeepId));
                }
            }
            const first = state.directory[0]?.items?.[0];
            if (first) selectBuff(first.id, { focusDetail: false, updateUrl: root.isConnected });
        } catch (error) {
            if (state.disposed) return;
            elements.meta.textContent = t('common.loadFailedShort', null, '加载失败');
            elements.directory.innerHTML = '';
            if (elements.mobileDirectory) elements.mobileDirectory.innerHTML = '';
            elements.detail.innerHTML = errorHtml(buffT('title', null, 'Buff'),
                t('common.loadFailed', { message: error.message || error }, `加载失败：${error.message || error}`));
        }
    }

    elements.directory.addEventListener('click', onDirectoryClick);
    elements.mobileDirectory?.addEventListener('click', onDirectoryClick);
    elements.detail.addEventListener('click', onDetailClick);
    elements.detail.addEventListener('change', onDetailChange);
    elements.detail.addEventListener('keydown', onDetailKeyDown);
    elements.search?.addEventListener('input', onSearchInput);
    elements.mobileSearch?.addEventListener('input', onSearchInput);
    elements.mobileButton?.addEventListener('click', openMobileList);
    elements.mobileClose?.addEventListener('click', closeMobileList);
    elements.mobileOverlay?.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);

    window.__akeV3BuffController = {
        destroy() {
            state.disposed = true;
            state.detailToken += 1;
            elements.directory.removeEventListener('click', onDirectoryClick);
            elements.mobileDirectory?.removeEventListener('click', onDirectoryClick);
            elements.detail.removeEventListener('click', onDetailClick);
            elements.detail.removeEventListener('change', onDetailChange);
            elements.detail.removeEventListener('keydown', onDetailKeyDown);
            elements.search?.removeEventListener('input', onSearchInput);
            elements.mobileSearch?.removeEventListener('input', onSearchInput);
            elements.mobileButton?.removeEventListener('click', openMobileList);
            elements.mobileClose?.removeEventListener('click', closeMobileList);
            elements.mobileOverlay?.removeEventListener('click', onOverlayClick);
            document.removeEventListener('keydown', onKeyDown);
        }
    };

    initialize();
})();
