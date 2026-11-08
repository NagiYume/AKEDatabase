(function () {
    if (window.AKEEnemyRenderer) return;

    const LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES = Object.freeze([80, 81, 82, 83, 84, 85]);
    const MODIFIER_ZONE_KEYS = Object.freeze({
        0: 'addition',
        1: 'multiplier',
        3: 'finalAddition',
        4: 'finalMultiplier',
        5: 'baseAddition',
        6: 'baseMultiplier',
        7: 'baseFinalAddition',
        8: 'baseFinalMultiplier',
        9: 'override'
    });

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function dataAttributes(attributes) {
        return Object.entries(attributes || {}).map(([key, value]) => {
            const name = key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
            const encoded = typeof value === 'string' ? value : JSON.stringify(value);
            return ` data-${name}="${escapeHtml(encoded)}"`;
        }).join('');
    }

    function calculateStats(options) {
        const baseModifiers = options.baseModifiers || [];
        const scriptModifiers = options.scriptModifiers || [];
        const baseResult = options.getDetails(options.attrData, options.level, baseModifiers);
        const stats = baseResult?.values || {};
        const scriptResult = scriptModifiers.length
            ? options.getDetails(options.attrData, options.level, [...baseModifiers, ...scriptModifiers])
            : null;
        const scriptStats = scriptResult?.values || null;
        const changedStats = scriptStats
            ? Object.fromEntries(Object.entries(scriptStats).filter(([name, value]) => value !== stats[name]))
            : {};
        return { baseResult, stats, scriptResult, changedStats };
    }

    function renderStats(state, formatStatValue) {
        const entries = Object.entries(state.stats || {});
        if (!entries.length) return '';
        return `<div class="v2d-attr-grid">${entries.map(([name, value]) => (
            `<div class="v2d-attr-item"><span class="v2d-attr-key">${escapeHtml(name)}</span><span class="v2d-attr-val">${formatStatValue(value, state.baseResult?.details?.[name])}</span></div>`
        )).join('')}</div>`;
    }

    function renderChangedStats(state, options) {
        const entries = Object.entries(state.changedStats || {});
        if (!entries.length) return '';
        return `<div class="v2d-script-stats"><b>${escapeHtml(options.changedLabel || '脚本 Buff 生效时')}</b>${entries.map(([name, value]) => (
            `<span>${escapeHtml(name)} ${options.formatBaseValue(state.stats[name])} → ${options.formatStatValue(value, state.scriptResult?.details?.[name])}</span>`
        )).join('')}</div>`;
    }

    function renderModifierSources(groups, formatSummary, getLabel) {
        const rows = groups.map(([key, modifiers]) => {
            const summary = formatSummary(modifiers);
            return summary ? `<div class="ake-ui-card__meta"><span class="ake-ui-badge" data-tone="muted">${escapeHtml(getLabel(key))}</span><span class="ake-ui-card__body">${summary}</span></div>` : '';
        }).join('');
        return rows ? `<div class="ake-ui-card__content v2cc-current-buffs">${rows}</div>` : '';
    }

    function modifierZoneKey(modifierType) {
        return MODIFIER_ZONE_KEYS[modifierType] || '';
    }

    function modifierValueInfo(modifier) {
        const directMultiplier = modifier.modifierType === 4 || modifier.modifierType === 8;
        const multiplier = directMultiplier || modifier.modifierType === 1 || modifier.modifierType === 6;
        const value = directMultiplier ? modifier.attrValue - 1 : modifier.attrValue;
        const display = multiplier
            ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
            : `${value > 0 ? '+' : ''}${Number.isInteger(value) ? value : Number(value.toFixed(4))}`;
        return { directMultiplier, multiplier, value, display };
    }

    function summarizeModifiers(modifiers, getAttrName, getZoneLabel) {
        return window.AKEStats.combineModifiers(modifiers)
            .filter(modifier => !LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(modifier.attrType))
            .map(modifier => {
                const name = getAttrName(modifier.attrType);
                const zone = getZoneLabel ? getZoneLabel(modifier.modifierType) : '';
                return `${escapeHtml(name)} ${modifierValueInfo(modifier).display}${zone ? ` <span class="v2d-modifier-zone">${escapeHtml(zone)}</span>` : ''}`;
            }).join(', ');
    }

    function renderVariantBonus(modifiers, options) {
        const opts = options || {};
        const relevant = (modifiers || []).filter(modifier =>
            modifier && Number.isFinite(Number(modifier.attrValue))
            && !LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES.includes(modifier.attrType))
            .map(modifier => ({ ...modifier, attrValue: Number(modifier.attrValue) }));
        if (!relevant.length) return '';
        const getAttrName = opts.getAttrName || (attrType => String(attrType));
        const getZoneLabel = opts.getZoneLabel || (modifierType => modifierZoneKey(modifierType) || String(modifierType));
        const items = relevant.map(modifier => {
            const name = getAttrName(modifier.attrType);
            const info = modifierValueInfo(modifier);
            const valueHtml = window.renderRawValueTip
                ? window.renderRawValueTip(info.display, info.directMultiplier ? {
                    name,
                    rawValue: modifier.attrValue,
                    value: info.value,
                    changed: true,
                    formula: `${modifier.attrValue} - 1 = ${info.value}`
                } : modifier.attrValue)
                : escapeHtml(info.display);
            const zoneLabel = getZoneLabel(modifier.modifierType);
            return `<span class="v2d-variant-bonus__item"><strong class="v2d-variant-bonus__attr">${escapeHtml(name)}</strong><span class="v2d-variant-bonus__value">${valueHtml}</span>${zoneLabel ? `<span class="v2d-variant-bonus__zone">${escapeHtml(zoneLabel)}</span>` : ''}</span>`;
        }).join('');
        const labelHtml = opts.label ? `<span class="ake-ui-badge" data-tone="muted">${escapeHtml(opts.label)}</span>` : '';
        return `<div class="v2d-variant-bonus">${labelHtml}${items}</div>`;
    }

    function renderCard(options) {
        const flags = (options.flags || []).filter(Boolean);
        const nickname = options.nickname && options.nickname !== options.name ? options.nickname : '';
        const description = options.descriptionHtml
            ? `<div class="v2d-enemy-desc">${options.descriptionHtml}</div>`
            : '';
        const {
            akeEntryPlugin: entryPlugin,
            akeEntryId: entryId,
            akeEntryLabel: entryLabel,
            ...cardDataAttributes
        } = options.dataAttributes || {};
        const iconHtml = `<img src="${escapeHtml(options.iconSrc || '')}" alt="">`;
        const mediaHtml = entryPlugin && entryId
            ? window.AKEUI?.entryLinkHtml({
                plugin: entryPlugin,
                id: entryId,
                label: entryLabel || options.name,
                className: 'ake-ui-card__media',
                title: entryLabel || options.name,
                contentHtml: iconHtml
            }) || `<div class="ake-ui-card__media">${iconHtml}</div>`
            : `<div class="ake-ui-card__media">${iconHtml}</div>`;
        return `
            <div class="ake-ui-card has-media" data-ake-component="card" data-card-kind="enemy" data-density="regular"${dataAttributes(cardDataAttributes)}>
                <div class="ake-ui-card__content">
                    <header class="ake-ui-card__header">
                        ${mediaHtml}
                        <div class="ake-ui-card__heading"><strong class="ake-ui-card__title">${escapeHtml(options.name)}</strong>${nickname ? `<span class="ake-ui-card__subtitle">${escapeHtml(nickname)}</span>` : ''}</div>
                        <span class="ake-ui-badge">Lv.${escapeHtml(options.level)}</span>
                    </header>
                    ${description}
                    ${options.extraHtml || ''}
                    ${flags.length ? `<div class="ake-ui-card__badges">${flags.join('')}</div>` : ''}
                    ${renderStats(options.statState, options.formatStatValue)}
                    ${renderChangedStats(options.statState, options)}
                </div>
            </div>
        `;
    }

    window.AKEEnemyRenderer = Object.freeze({
        LEGACY_ELEMENT_RESISTANCE_ATTR_TYPES,
        MODIFIER_ZONE_KEYS,
        calculateStats,
        modifierValueInfo,
        modifierZoneKey,
        renderModifierSources,
        renderVariantBonus,
        summarizeModifiers,
        renderCard
    });
})();
