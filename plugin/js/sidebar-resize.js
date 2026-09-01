(function () {
    'use strict';

    if (window.AKESidebarResize) return;

    const STYLE_ID = 'ake-sidebar-resize-style';
    const STORAGE_KEY = 'akedata-sidebar-widths';
    const DEFAULT_MEDIA_QUERY = '(min-width: 1000px)';
    const instances = new WeakMap();
    const modulePresets = new Map();
    const moduleSessionWidths = new Map();
    let mainInstance = null;
    let moduleInstance = null;
    let moduleInstanceId = null;

    const storage = window.akeStorage || {
        get(key, fallback = null) {
            try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
        },
        remove(key) {
            try { localStorage.removeItem(key); return true; } catch { return false; }
        }
    };

    function registerModules(ids, selector, fallbackWidth, overrides = {}) {
        ids.forEach(id => modulePresets.set(id, {
            selector,
            fallbackWidth,
            minWidth: 220,
            maxWidth: 520,
            minContentWidth: 360,
            mediaQuery: DEFAULT_MEDIA_QUERY,
            ...overrides
        }));
    }

    function iconCompact(itemSelector, iconSelector, labelSelector, listSelector, hideSelector, overrides = {}) {
        return {
            minWidth: 88,
            compactThreshold: 160,
            compactItemSelector: itemSelector,
            compactIconSelector: iconSelector,
            compactLabelSelector: labelSelector,
            compactListSelector: listSelector,
            compactHideSelector: hideSelector,
            ...overrides
        };
    }

    registerModules(['weapon', 'v2_weapon'], '.weapon-module > .weapon-list', 260,
        iconCompact('.weapon-item', '.weapon-icon', '.weapon-title', '.list-items', '.list-search-fixed, .filter-bar'));
    registerModules(['character'], '.character-module > .left-column', 260,
        iconCompact('.character-item', '.character-icon', '.character-name', '.character-list', '.list-search, .filter-bar'));
    registerModules(['v2_character'], '.character-module > .left-column', 260, {
        ...iconCompact('.character-item', '.character-icon', '.character-name', '.character-list', '.list-search, .filter-bar'),
        mediaQuery: '(min-width: 769px)'
    });
    registerModules(['enemy'], '.enemy-module > .left-column', 260, { minWidth: 144 });
    registerModules(['v2_enemy'], '.v2e-module > .v2e-left', 260,
        iconCompact('.v2e-item', '.v2e-item-icon', '.v2e-item-name', '.v2e-list', '.v2e-search'));
    registerModules(['equip'], '.equip-module > .left-column', 260, { minWidth: 144 });
    registerModules(['v2_equip'], '.v2eq-module > .v2eq-left', 260,
        iconCompact('.v2eq-item', '.v2eq-item-icon', '.v2eq-item-name', '.v2eq-list', '.v2eq-search'));
    registerModules(['item'], '.item-module > .left-column', 260, { minWidth: 144 });
    registerModules(['v2_item'], '.v2i-module > .v2i-left', 260,
        iconCompact('.v2i-item', '.v2i-item-icon', '.v2i-item-name', '.v2i-list', '.v2i-search, .v2i-filter-bar'));
    registerModules(['dungeon'], '.dungeon-module > .left-column', 240, {
        minWidth: 128,
        compactThreshold: 180
    });
    registerModules(['v2_dungeon'], '.v2d-module > .v2d-left', 260, {
        minWidth: 128,
        compactThreshold: 180,
        compactListSelector: '.v2d-list'
    });
    registerModules(['achievement'], '.achievement-module > .left-column', 220, {
        minWidth: 120,
        compactThreshold: 160,
        compactListSelector: '.category-list'
    });
    registerModules(['activity'], '.activity-module > .left-column', 260, {
        minWidth: 144,
        compactThreshold: 180,
        compactListSelector: '.activity-list'
    });
    registerModules(['v2_cc'], '.v2cc-module > .v2cc-left', 260, {
        ...iconCompact('.v2cc-item', '.v2cc-item-icon', '.v2cc-item-name', '.v2cc-list', '.v2cc-search', {
            minWidth: 80,
            compactThreshold: 150
        }),
        mediaQuery: '(min-width: 769px)'
    });
    registerModules([
        'v3_weapon', 'v3_character', 'v3_enemy', 'v3_equip', 'v3_item',
        'v3_shop', 'v3_achievement', 'v3_dungeon', 'research', 'v3_archive',
        'v3_activity', 'v3_mission', 'misc', 'baker', 'v3_cc', 'season_tower',
        'v3_skill', 'v3_buff'
    ], '.ake-ui-directory > .ake-ui-directory__sidebar', 280, {
        ...iconCompact(
            '.ake-ui-directory__item',
            '.ake-ui-directory__item-icon',
            '.ake-ui-directory__item-copy',
            '.ake-ui-directory__list',
            '.ake-ui-directory__sidebar-header, .ake-ui-directory__search, .ake-ui-directory__meta, .ake-ui-filter',
            { minWidth: 72, compactThreshold: 180 }
        ),
        layout: 'grid'
    });
    registerModules(['buff'], '.buff-module > .left-column', 350, {
        minWidth: 144
    });
    registerModules(['skill'], '.skill-module > .left-column', 350, {
        minWidth: 144
    });
    registerModules(['skill_v2'], '.skillv2-module > .skillv2-list-panel', 340, {
        minWidth: 144
    });
    registerModules(['spawn'], '.spawner-module > .left-column', 350, {
        minWidth: 144
    });

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .app > .main-content { min-width: 0; }
            .ake-resizable-sidebar { position: relative !important; }
            .ake-resizable-sidebar.ake-resizable-sidebar--active { overflow: visible !important; }
            .ake-resizable-sidebar.ake-sidebar-compact .ake-sidebar-compact-hidden { display: none !important; }
            .ake-resizable-sidebar.ake-sidebar-compact .ake-sidebar-icon-list { padding: 6px !important; }
            .app > .sidebar.ake-sidebar-compact .brand {
                min-height: 58px;
                justify-content: center;
                padding: 4px;
            }
            .app > .sidebar.ake-sidebar-compact .sidebar-footer {
                gap: 4px;
                padding: 6px 4px;
            }
            .app > .sidebar.ake-sidebar-compact :is(.settings-button, .export-button) {
                padding: 0;
            }
            .ake-resizable-sidebar.ake-sidebar-compact .ake-ui-directory__item:has(> .ake-ui-directory__item-icon),
            .ake-resizable-sidebar.ake-sidebar-compact .ake-sidebar-icon-item {
                width: 100%;
                height: 58px;
                min-height: 58px;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 0 !important;
                padding: 4px !important;
                overflow: hidden;
            }
            .ake-resizable-sidebar.ake-sidebar-compact .ake-ui-directory__item:has(> .ake-ui-directory__item-icon) > :not(.ake-ui-directory__item-icon),
            .ake-resizable-sidebar.ake-sidebar-compact .ake-sidebar-icon-item > :not(.ake-sidebar-item-icon):not(.module-title) {
                display: none !important;
            }
            .app > .sidebar.ake-sidebar-compact .ake-sidebar-icon-item .module-title > :not(.module-nav-icon) {
                display: none !important;
            }
            .ake-resizable-sidebar.ake-sidebar-compact .ake-ui-directory__item > .ake-ui-directory__item-icon,
            .ake-resizable-sidebar.ake-sidebar-compact .ake-sidebar-item-icon {
                width: 48px !important;
                height: 48px !important;
                min-width: 0 !important;
                flex: 0 0 48px !important;
                margin: 0 !important;
                object-fit: contain;
            }
            .ake-resizable-sidebar.ake-sidebar-compact .v2d-item-id,
            .ake-resizable-sidebar.ake-sidebar-compact .activity-id {
                display: none !important;
            }
            .ake-sidebar-resize-handle {
                position: absolute;
                z-index: 5;
                top: 0;
                right: -6px;
                bottom: 0;
                width: 12px;
                display: block;
                padding: 0;
                border: 0;
                background: transparent;
                cursor: col-resize;
                touch-action: none;
            }
            .ake-sidebar-resize-handle[hidden] { display: none !important; }
            .ake-sidebar-resize-handle::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: 0;
                left: 5px;
                width: 2px;
                background: var(--accent-color, #1e6f9f);
                opacity: .22;
                transition: opacity .15s, box-shadow .15s;
            }
            .ake-sidebar-resize-handle:hover::before,
            .ake-sidebar-resize-handle:focus-visible::before,
            .ake-sidebar-resize-handle.is-dragging::before {
                opacity: .9;
                box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color, #1e6f9f) 18%, transparent);
            }
            .ake-sidebar-resize-handle:focus { outline: 0; }
            .ake-sidebar-grid-layout {
                grid-template-columns: var(--ake-sidebar-width) minmax(0, 1fr) !important;
            }
            html.ake-sidebar-resizing,
            html.ake-sidebar-resizing * {
                cursor: col-resize !important;
                user-select: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function readWidths() {
        try {
            const value = JSON.parse(storage.get(STORAGE_KEY, '{}'));
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch {
            return {};
        }
    }

    function readWidth(key) {
        const width = Number(readWidths()[key]);
        return Number.isFinite(width) && width > 0 ? width : null;
    }

    function writeWidth(key, width) {
        const widths = readWidths();
        widths[key] = Math.round(width);
        storage.set(STORAGE_KEY, JSON.stringify(widths));
    }

    function removeWidth(key) {
        const widths = readWidths();
        if (!(key in widths)) return;
        delete widths[key];
        if (Object.keys(widths).length) storage.set(STORAGE_KEY, JSON.stringify(widths));
        else storage.remove(STORAGE_KEY);
    }

    function numberOr(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function restoreStyleValue(style, property, value) {
        style[property] = value;
    }

    function create(element, options = {}) {
        if (!(element instanceof HTMLElement)) return null;
        if (instances.has(element)) return instances.get(element);

        injectStyles();

        const storageKey = String(options.storageKey || 'sidebar');
        const config = {
            minWidth: Math.max(1, numberOr(options.minWidth, 200)),
            maxWidth: Math.max(1, numberOr(options.maxWidth, 520)),
            minContentWidth: Math.max(0, numberOr(options.minContentWidth, 360)),
            fallbackWidth: Math.max(1, numberOr(options.fallbackWidth, 260)),
            defaultWidth: Number.isFinite(Number(options.defaultWidth)) ? Number(options.defaultWidth) : null,
            mediaQuery: options.mediaQuery || DEFAULT_MEDIA_QUERY,
            layout: options.layout === 'grid' ? 'grid' : 'flex',
            compactThreshold: Number.isFinite(Number(options.compactThreshold))
                ? Math.max(1, Number(options.compactThreshold))
                : null,
            compactItemSelector: String(options.compactItemSelector || ''),
            compactIconSelector: String(options.compactIconSelector || ''),
            compactLabelSelector: String(options.compactLabelSelector || ''),
            compactListSelector: String(options.compactListSelector || ''),
            compactHideSelector: String(options.compactHideSelector || '')
        };
        config.maxWidth = Math.max(config.minWidth, config.maxWidth);

        const layoutElement = config.layout === 'grid' ? element.parentElement : null;
        const originalElementStyles = {
            width: element.style.width,
            minWidth: element.style.minWidth,
            flexBasis: element.style.flexBasis,
            flexShrink: element.style.flexShrink
        };
        const originalGridWidth = layoutElement?.style.getPropertyValue('--ake-sidebar-width') || '';
        const media = window.matchMedia(config.mediaQuery);
        const handle = document.createElement('div');
        handle.className = 'ake-sidebar-resize-handle';
        handle.hidden = true;
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', 'Resize sidebar');
        handle.title = 'Drag to resize; double-click to restore the default width';
        element.classList.add('ake-resizable-sidebar');
        element.appendChild(handle);

        let active = false;
        let destroyed = false;
        let currentWidth = null;
        let defaultWidth = config.defaultWidth;
        let preferredWidth = readWidth(storageKey);
        let dragState = null;
        let resizeFrame = 0;
        let compact = false;
        let compactObserver = null;

        function ensureDefaultWidth() {
            if (Number.isFinite(defaultWidth) && defaultWidth > 0) return defaultWidth;
            const measured = element.getBoundingClientRect().width || parseFloat(getComputedStyle(element).width);
            defaultWidth = Number.isFinite(measured) && measured > 0
                ? Math.round(measured)
                : config.fallbackWidth;
            return defaultWidth;
        }

        function hasUsableIcon(icon) {
            if (!(icon instanceof HTMLElement)) return false;
            if (icon instanceof HTMLImageElement) {
                return Boolean(String(icon.getAttribute('src') || '').trim())
                    && !icon.hidden
                    && icon.style.display !== 'none';
            }
            return Boolean(String(icon.textContent || '').trim() || icon.querySelector('img, svg'));
        }

        function markCompactItems() {
            if (!config.compactItemSelector || !config.compactIconSelector) return;
            element.querySelectorAll(config.compactItemSelector).forEach(item => {
                const icon = item.querySelector(config.compactIconSelector);
                const label = config.compactLabelSelector
                    ? item.querySelector(config.compactLabelSelector)
                    : null;
                const hasIcon = hasUsableIcon(icon);
                const usesAkeUiTemplate = item.classList.contains('ake-ui-directory__item');
                item.classList.toggle('ake-sidebar-icon-item', hasIcon && !usesAkeUiTemplate);
                icon?.classList.toggle('ake-sidebar-item-icon', hasIcon && !usesAkeUiTemplate);
                if (hasIcon && label?.textContent.trim() && !item.hasAttribute('title')) {
                    item.title = label.textContent.trim();
                }
            });
        }

        function prepareCompactStructure() {
            if (!config.compactThreshold) return;
            if (config.compactListSelector) {
                element.querySelectorAll(config.compactListSelector)
                    .forEach(list => list.classList.add('ake-sidebar-icon-list'));
            }
            if (config.compactHideSelector) {
                element.querySelectorAll(config.compactHideSelector)
                    .forEach(control => control.classList.add('ake-sidebar-compact-hidden'));
            }
            markCompactItems();
            if (config.compactItemSelector) {
                compactObserver = new MutationObserver(markCompactItems);
                compactObserver.observe(element, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src']
                });
            }
        }

        function updateCompactState(width) {
            const nextCompact = Boolean(active && config.compactThreshold && width <= config.compactThreshold);
            if (nextCompact === compact) return;
            compact = nextCompact;
            element.classList.toggle('ake-sidebar-compact', compact);
            if (compact) markCompactItems();
        }

        function getBounds() {
            let maxWidth = config.maxWidth;
            const parent = layoutElement || element.parentElement;
            if (parent?.clientWidth) {
                const parentStyle = getComputedStyle(parent);
                const gap = numberOr(parseFloat(parentStyle.columnGap || parentStyle.gap), 0);
                const available = Math.floor(parent.clientWidth - config.minContentWidth - gap);
                maxWidth = Math.min(maxWidth, Math.max(config.minWidth, available));
            }
            return { min: config.minWidth, max: Math.max(config.minWidth, maxWidth) };
        }

        function emitResize(width, source) {
            element.dispatchEvent(new CustomEvent('ake:sidebar-resize', {
                bubbles: true,
                detail: { key: storageKey, width, source }
            }));
        }

        function applyWidth(value, source) {
            if (!active || destroyed) return currentWidth;
            const bounds = getBounds();
            const width = Math.round(Math.min(bounds.max, Math.max(bounds.min, numberOr(value, ensureDefaultWidth()))));

            handle.setAttribute('aria-valuemin', String(bounds.min));
            handle.setAttribute('aria-valuemax', String(bounds.max));
            handle.setAttribute('aria-valuenow', String(width));

            if (config.layout === 'grid' && layoutElement) {
                layoutElement.classList.add('ake-sidebar-grid-layout');
                layoutElement.style.setProperty('--ake-sidebar-width', `${width}px`);
            } else {
                element.style.width = `${width}px`;
                element.style.minWidth = `${config.minWidth}px`;
                element.style.flexBasis = `${width}px`;
                element.style.flexShrink = '0';
            }

            updateCompactState(width);

            if (currentWidth !== width) {
                currentWidth = width;
                emitResize(width, source);
            }
            return width;
        }

        function clearAppliedWidth() {
            restoreStyleValue(element.style, 'width', originalElementStyles.width);
            restoreStyleValue(element.style, 'minWidth', originalElementStyles.minWidth);
            restoreStyleValue(element.style, 'flexBasis', originalElementStyles.flexBasis);
            restoreStyleValue(element.style, 'flexShrink', originalElementStyles.flexShrink);
            if (layoutElement) {
                layoutElement.classList.remove('ake-sidebar-grid-layout');
                if (originalGridWidth) layoutElement.style.setProperty('--ake-sidebar-width', originalGridWidth);
                else layoutElement.style.removeProperty('--ake-sidebar-width');
            }
            compact = false;
            element.classList.remove('ake-sidebar-compact');
            currentWidth = null;
        }

        function updateMode() {
            if (destroyed) return;
            const shouldActivate = media.matches;
            if (shouldActivate === active) return;
            active = shouldActivate;
            handle.hidden = !active;
            element.classList.toggle('ake-resizable-sidebar--active', active);
            if (active) {
                const initialWidth = preferredWidth ?? ensureDefaultWidth();
                applyWidth(initialWidth, 'media');
            } else {
                clearAppliedWidth();
            }
        }

        function setWidth(value, persist = true, source = 'api') {
            const width = applyWidth(value, source);
            if (!Number.isFinite(width)) return null;
            preferredWidth = width;
            if (persist) writeWidth(storageKey, width);
            return width;
        }

        function reset() {
            removeWidth(storageKey);
            preferredWidth = active ? ensureDefaultWidth() : null;
            if (active) applyWidth(preferredWidth, 'reset');
        }

        function finishDrag(commit) {
            if (!dragState) return;
            if (commit && Number.isFinite(dragState.width)) {
                preferredWidth = dragState.width;
                writeWidth(storageKey, preferredWidth);
            } else if (!commit) {
                preferredWidth = dragState.preferredWidth;
                applyWidth(dragState.startWidth, 'cancel');
            }
            if (handle.hasPointerCapture?.(dragState.pointerId)) {
                handle.releasePointerCapture(dragState.pointerId);
            }
            dragState = null;
            handle.classList.remove('is-dragging');
            document.documentElement.classList.remove('ake-sidebar-resizing');
        }

        function onPointerDown(event) {
            if (!active || (event.pointerType === 'mouse' && event.button !== 0)) return;
            event.preventDefault();
            dragState = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth: currentWidth ?? element.getBoundingClientRect().width,
                preferredWidth,
                width: currentWidth
            };
            handle.setPointerCapture?.(event.pointerId);
            handle.classList.add('is-dragging');
            document.documentElement.classList.add('ake-sidebar-resizing');
        }

        function onPointerMove(event) {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            dragState.width = applyWidth(dragState.startWidth + event.clientX - dragState.startX, 'pointer');
        }

        function onPointerUp(event) {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            finishDrag(true);
        }

        function onKeyDown(event) {
            if (!active) return;
            if (event.key === 'Home') {
                event.preventDefault();
                reset();
                return;
            }
            if (event.key === 'Escape' && dragState) {
                event.preventDefault();
                finishDrag(false);
                return;
            }
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const step = event.shiftKey ? 32 : 12;
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            setWidth((currentWidth ?? ensureDefaultWidth()) + direction * step, true, 'keyboard');
        }

        function onWindowResize() {
            if (!active || destroyed || resizeFrame) return;
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                applyWidth(preferredWidth ?? ensureDefaultWidth(), 'viewport');
            });
        }

        function destroy() {
            if (destroyed) return;
            destroyed = true;
            finishDrag(false);
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            compactObserver?.disconnect();
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerUp);
            handle.removeEventListener('keydown', onKeyDown);
            handle.removeEventListener('dblclick', reset);
            window.removeEventListener('resize', onWindowResize);
            if (media.removeEventListener) media.removeEventListener('change', updateMode);
            else media.removeListener(updateMode);
            clearAppliedWidth();
            element.classList.remove('ake-resizable-sidebar', 'ake-resizable-sidebar--active', 'ake-sidebar-compact');
            handle.remove();
            instances.delete(element);
        }

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
        handle.addEventListener('keydown', onKeyDown);
        handle.addEventListener('dblclick', reset);
        window.addEventListener('resize', onWindowResize);
        if (media.addEventListener) media.addEventListener('change', updateMode);
        else media.addListener(updateMode);

        prepareCompactStructure();
        const instance = {
            element,
            handle,
            setWidth,
            reset,
            destroy,
            get width() { return currentWidth; }
        };
        instances.set(element, instance);
        updateMode();
        return instance;
    }

    function initMain(element = document.querySelector('.app > .sidebar')) {
        if (!(element instanceof HTMLElement)) return null;
        if (mainInstance?.element === element) return mainInstance;
        mainInstance?.destroy();
        mainInstance = create(element, {
            ...iconCompact(
                '.module-item',
                '.module-nav-icon',
                '.module-name',
                '.module-list',
                '.brand-copy, .sidebar-tool-label',
                { minWidth: 72, compactThreshold: 160 }
            ),
            storageKey: 'main',
            defaultWidth: 255,
            fallbackWidth: 255,
            maxWidth: 420,
            minContentWidth: 520,
            mediaQuery: DEFAULT_MEDIA_QUERY
        });
        return mainInstance;
    }

    function unmountModule() {
        const width = moduleInstance?.width;
        if (moduleInstanceId && Number.isFinite(width)) {
            moduleSessionWidths.set(moduleInstanceId, width);
        }
        moduleInstance?.destroy();
        moduleInstance = null;
        moduleInstanceId = null;
    }

    function mountModule(root, moduleId) {
        unmountModule();
        let preset = modulePresets.get(moduleId);
        if (!preset && root instanceof HTMLElement && root.querySelector('.ake-ui-directory > .ake-ui-directory__sidebar')) {
            preset = {
                selector: '.ake-ui-directory > .ake-ui-directory__sidebar',
                fallbackWidth: 280,
                minWidth: 72,
                maxWidth: 520,
                minContentWidth: 360,
                mediaQuery: DEFAULT_MEDIA_QUERY,
                ...iconCompact(
                    '.ake-ui-directory__item',
                    '.ake-ui-directory__item-icon',
                    '.ake-ui-directory__item-copy',
                    '.ake-ui-directory__list, .ake-ui-tree',
                    '.ake-ui-directory__sidebar-header, .ake-ui-directory__search, .ake-ui-directory__meta, .ake-ui-filter',
                    { minWidth: 72, compactThreshold: 180 }
                ),
                layout: 'grid'
            };
        }
        if (!(root instanceof HTMLElement) || !preset) return null;
        const element = root.querySelector(preset.selector);
        if (!(element instanceof HTMLElement)) return null;
        moduleInstance = create(element, {
            ...preset,
            storageKey: `module:${moduleId}`
        });
        moduleInstanceId = moduleId;
        const sessionWidth = moduleSessionWidths.get(moduleId);
        if (Number.isFinite(sessionWidth)) {
            moduleInstance?.setWidth(sessionWidth, false, 'session');
        }
        return moduleInstance;
    }

    function resetAll() {
        storage.remove(STORAGE_KEY);
        moduleSessionWidths.clear();
        mainInstance?.reset();
        moduleInstance?.reset();
    }

    window.AKESidebarResize = Object.freeze({
        create,
        initMain,
        mountModule,
        unmountModule,
        resetAll
    });
})();
