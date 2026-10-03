(function () {
    'use strict';

    if (window.AKEModuleViewState) return;

    const ROOT_ROUTE = '@root';
    const ROUTE_ALIASES = Object.freeze({
        character: 'v3_character',
        v2_character: 'v3_character',
        weapon: 'v3_weapon',
        v2_weapon: 'v3_weapon',
        enemy: 'v3_enemy',
        v2_enemy: 'v3_enemy',
        equip: 'v3_equip',
        v2_equip: 'v3_equip',
        item: 'v3_item',
        v2_item: 'v3_item',
        dungeon: 'v3_dungeon',
        v2_dungeon: 'v3_dungeon',
        cc: 'v3_cc',
        v2_cc: 'v3_cc',
        activity: 'v3_activity',
        achievement: 'v3_achievement'
    });
    const ENTRY_ROOT_IDS = Object.freeze({
        tech_tree: 'tech_treeDetail',
        spaceship: 'spaceshipDetail',
        tutorial: 'tutorialDetail',
        adventure: 'adventureDetail',
        factory: 'factoryDetail',
        v3_weapon: 'v2wpnDetail',
        v3_character: 'v2characterDetail',
        v3_enemy: 'v2enemyDetail',
        v3_equip: 'v2equipDetail',
        v3_item: 'v2itemDetail',
        v3_dungeon: 'v2dungeonDetail',
        v3_cc: 'v2ccDetail',
        v3_achievement: 'achievementDetail',
        v3_activity: 'activityDetail',
        research: 'researchDetail',
        v3_shop: 'akeShopContent',
        baker: 'bakerConversation',
        season_tower: 'seasonTowerDetail',
        v3_mission: 'missionDetail',
        v3_archive: 'akeArchiveContent',
        misc: 'miscContent'
    });
    const MODULE_SCROLL_ROOT_IDS = Object.freeze({
        tech_tree: 'tech_treeList',
        spaceship: 'spaceshipList',
        tutorial: 'tutorialList',
        adventure: 'adventureList',
        factory: 'factoryList',
        v3_weapon: 'v2wpnListItems',
        v3_character: 'v2characterList',
        v3_enemy: 'v2enemyList',
        v3_equip: 'v2equipList',
        v3_item: 'v2itemList',
        v3_dungeon: 'v2dungeonList',
        v3_cc: 'v2ccList',
        v3_achievement: 'categoryList',
        v3_activity: 'activityList',
        research: 'researchList',
        v3_shop: 'akeShopGroupList',
        baker: 'bakerContactList',
        season_tower: 'seasonTowerList',
        v3_mission: 'missionList',
        v3_archive: 'akeArchiveDirectory',
        misc: 'miscModuleList'
    });

    function normalizeRouteId(routeId) {
        if (routeId === undefined || routeId === null || String(routeId) === '') return null;
        return String(routeId);
    }

    function routeKey(routeId) {
        const normalized = normalizeRouteId(routeId);
        return normalized === null ? ROOT_ROUTE : `item:${normalized}`;
    }

    function create(options = {}) {
        const contentArea = options.contentArea;
        if (!(contentArea instanceof HTMLElement)) return null;

        const mainContent = contentArea.parentElement;
        const states = new Map();
        const currentRoutes = new Map();
        const locatorCache = new WeakMap();
        let activeModuleId = null;
        let pendingRestore = null;
        let restoreSequence = 0;

        function normalizeModuleId(moduleId) {
            const raw = String(moduleId || '');
            if (!raw) return '';
            if (activeModuleId && (raw === activeModuleId || ROUTE_ALIASES[raw] === activeModuleId)) {
                return activeModuleId;
            }
            return raw;
        }

        function getState(moduleId, createIfMissing = true) {
            if (!states.has(moduleId) && createIfMissing) {
                states.set(moduleId, { module: new Map(), routes: new Map() });
            }
            return states.get(moduleId) || null;
        }

        function getRouteBucket(moduleId, routeId, createIfMissing = true) {
            const state = getState(moduleId, createIfMissing);
            if (!state) return null;
            const key = routeKey(routeId);
            if (!state.routes.has(key) && createIfMissing) state.routes.set(key, new Map());
            return state.routes.get(key) || null;
        }

        function isTrackedElement(element) {
            if (!(element instanceof HTMLElement)) return false;
            return element === document.scrollingElement
                || element === mainContent
                || element === contentArea
                || contentArea.contains(element);
        }

        function isModuleScopedElement(moduleId, element) {
            if (!contentArea.contains(element)) return false;
            const listRootId = MODULE_SCROLL_ROOT_IDS[moduleId];
            const listRoot = listRootId ? document.getElementById(listRootId) : null;
            if (listRoot && (element === listRoot || listRoot.contains(element))) return true;
            return Boolean(element.closest('.ake-resizable-sidebar'));
        }

        function createLocator(element) {
            if (locatorCache.has(element)) return locatorCache.get(element);
            let locator;
            if (element === document.scrollingElement) {
                locator = { key: '@document', type: 'document' };
            } else if (element === mainContent) {
                locator = { key: '@main', type: 'main' };
            } else if (element === contentArea) {
                locator = { key: '@content', type: 'content' };
            } else if (element.id) {
                locator = { key: `id:${element.id}`, type: 'id', value: element.id };
            } else {
                const path = [];
                let current = element;
                while (current && current !== contentArea) {
                    const parent = current.parentElement;
                    if (!parent) return null;
                    path.unshift(Array.prototype.indexOf.call(parent.children, current));
                    current = parent;
                }
                if (current !== contentArea) return null;
                locator = { key: `path:${path.join('.')}`, type: 'path', value: path };
            }
            locatorCache.set(element, locator);
            return locator;
        }

        function resolveLocator(record) {
            if (isTrackedElement(record.element)) return record.element;
            const locator = record.locator;
            if (!locator) return null;
            if (locator.type === 'document') return document.scrollingElement;
            if (locator.type === 'main') return mainContent;
            if (locator.type === 'content') return contentArea;
            if (locator.type === 'id') {
                const element = document.getElementById(locator.value);
                return element && contentArea.contains(element) ? element : null;
            }
            if (locator.type !== 'path') return null;
            let element = contentArea;
            for (const index of locator.value) {
                element = element?.children?.[index] || null;
                if (!element) break;
            }
            return isTrackedElement(element) ? element : null;
        }

        function rememberElement(moduleId, routeId, element) {
            if (!isTrackedElement(element)) return;
            const locator = createLocator(element);
            if (!locator) return;
            const state = getState(moduleId);
            const bucket = isModuleScopedElement(moduleId, element)
                ? state.module
                : getRouteBucket(moduleId, routeId);
            bucket.set(locator.key, {
                element,
                locator,
                top: element.scrollTop || 0,
                left: element.scrollLeft || 0
            });
        }

        function isScrollCandidate(element, pinned) {
            return pinned.has(element)
                || element.scrollTop !== 0
                || element.scrollLeft !== 0
                || element.scrollHeight > element.clientHeight + 1
                || element.scrollWidth > element.clientWidth + 1;
        }

        function captureCurrent() {
            if (!activeModuleId) return;
            const routeId = currentRoutes.get(activeModuleId) ?? null;
            const pinned = new Set([document.scrollingElement, mainContent, contentArea]);
            const candidates = [...pinned, ...contentArea.querySelectorAll('*')];
            const seen = new Set();
            candidates.forEach(element => {
                if (!isTrackedElement(element) || seen.has(element)) return;
                seen.add(element);
                if (isScrollCandidate(element, pinned)) rememberElement(activeModuleId, routeId, element);
            });
        }

        function defaultEntryRecord(moduleId) {
            const id = ENTRY_ROOT_IDS[moduleId];
            if (!id) return null;
            return {
                element: null,
                locator: { key: `id:${id}`, type: 'id', value: id },
                top: 0,
                left: 0
            };
        }

        function collectRestoreRecords(moduleId, routeId, includeModuleState) {
            const state = getState(moduleId);
            const routeBucket = getRouteBucket(moduleId, routeId);
            if (routeBucket.size === 0) {
                const initial = defaultEntryRecord(moduleId);
                if (initial) routeBucket.set(initial.locator.key, initial);
            }
            const records = new Map();
            routeBucket.forEach((record, key) => records.set(key, record));
            if (includeModuleState) state.module.forEach((record, key) => records.set(key, record));
            return Array.from(records.values(), record => ({
                ...record,
                locator: record.locator?.type === 'path'
                    ? { ...record.locator, value: [...record.locator.value] }
                    : record.locator ? { ...record.locator } : null
            }));
        }

        function cleanupPendingRestore(task) {
            if (!task) return;
            if (task.frame) cancelAnimationFrame(task.frame);
            task.observer?.disconnect();
            task.resizeObserver?.disconnect();
            task.timers.forEach(clearTimeout);
            contentArea.removeEventListener('load', task.onLoad, true);
            if (pendingRestore === task) pendingRestore = null;
        }

        function cancelRestore() {
            restoreSequence++;
            cleanupPendingRestore(pendingRestore);
        }

        function scheduleRestore(moduleId, routeId, includeModuleState) {
            cancelRestore();
            const records = collectRestoreRecords(moduleId, routeId, includeModuleState);
            if (!records.length) return;

            const token = ++restoreSequence;
            const expectedRoute = routeKey(routeId);
            const task = {
                token,
                moduleId,
                expectedRoute,
                records,
                frame: 0,
                timers: [],
                observer: null,
                resizeObserver: null,
                observed: new WeakSet(),
                onLoad: null,
                finalAttempt: false
            };
            pendingRestore = task;

            const apply = finalAttempt => {
                task.frame = 0;
                if (pendingRestore !== task
                    || token !== restoreSequence
                    || activeModuleId !== moduleId
                    || routeKey(currentRoutes.get(moduleId) ?? null) !== expectedRoute) {
                    cleanupPendingRestore(task);
                    return;
                }
                task.records.forEach(record => {
                    const element = resolveLocator(record);
                    if (!element) return;
                    if (task.resizeObserver && !task.observed.has(element)) {
                        task.observed.add(element);
                        task.resizeObserver.observe(element);
                    }
                    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
                    const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
                    if (finalAttempt || record.top <= maxTop + 1) {
                        element.scrollTop = Math.min(record.top, maxTop);
                    }
                    if (finalAttempt || record.left <= maxLeft + 1) {
                        element.scrollLeft = Math.min(record.left, maxLeft);
                    }
                });
                if (finalAttempt) cleanupPendingRestore(task);
            };

            const requestApply = (finalAttempt = false) => {
                if (pendingRestore !== task) return;
                if (finalAttempt) task.finalAttempt = true;
                if (task.frame) cancelAnimationFrame(task.frame);
                task.frame = requestAnimationFrame(() => apply(task.finalAttempt));
            };

            task.observer = new MutationObserver(() => requestApply(false));
            task.observer.observe(contentArea, { childList: true, subtree: true });
            if (window.ResizeObserver) {
                task.resizeObserver = new ResizeObserver(() => requestApply(false));
            }
            task.onLoad = () => requestApply(false);
            contentArea.addEventListener('load', task.onLoad, true);

            const delays = [0, 50, 150, 350, 750, 1500, 3000, 6000, 10000];
            delays.forEach((delay, index) => {
                task.timers.push(setTimeout(
                    () => requestApply(index === delays.length - 1),
                    delay
                ));
            });
        }

        function activate(moduleId, routeId) {
            const normalizedModuleId = String(moduleId || '');
            if (!normalizedModuleId) return null;
            cancelRestore();
            activeModuleId = normalizedModuleId;
            const nextRoute = routeId === undefined
                ? currentRoutes.get(normalizedModuleId) ?? null
                : normalizeRouteId(routeId);
            currentRoutes.set(normalizedModuleId, nextRoute);
            scheduleRestore(normalizedModuleId, nextRoute, true);
            return nextRoute;
        }

        function deactivate(moduleId) {
            const normalizedModuleId = String(moduleId || activeModuleId || '');
            if (!activeModuleId || normalizedModuleId !== activeModuleId) return;
            captureCurrent();
            cancelRestore();
            activeModuleId = null;
        }

        function route(moduleId, routeId) {
            const normalizedModuleId = normalizeModuleId(moduleId);
            if (!normalizedModuleId) return null;
            const nextRoute = normalizeRouteId(routeId);
            const previousRoute = currentRoutes.get(normalizedModuleId) ?? null;
            currentRoutes.set(normalizedModuleId, nextRoute);
            if (activeModuleId === normalizedModuleId && routeKey(previousRoute) !== routeKey(nextRoute)) {
                scheduleRestore(normalizedModuleId, nextRoute, false);
            }
            return nextRoute;
        }

        function getLastRoute(moduleId) {
            const normalizedModuleId = String(moduleId || '');
            return currentRoutes.get(normalizedModuleId) ?? null;
        }

        function onScroll(event) {
            if (!activeModuleId) return;
            const element = event.target === document ? document.scrollingElement : event.target;
            if (!isTrackedElement(element)) return;
            rememberElement(activeModuleId, currentRoutes.get(activeModuleId) ?? null, element);
        }

        function onUserIntent() {
            if (!activeModuleId) return;
            captureCurrent();
            cancelRestore();
        }

        function onKeyDown(event) {
            if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
            onUserIntent();
        }

        document.addEventListener('scroll', onScroll, true);
        mainContent?.addEventListener('pointerdown', onUserIntent, true);
        mainContent?.addEventListener('touchstart', onUserIntent, { capture: true, passive: true });
        mainContent?.addEventListener('wheel', onUserIntent, { capture: true, passive: true });
        mainContent?.addEventListener('click', onUserIntent, true);
        mainContent?.addEventListener('keydown', onKeyDown, true);

        function destroy() {
            cancelRestore();
            document.removeEventListener('scroll', onScroll, true);
            mainContent?.removeEventListener('pointerdown', onUserIntent, true);
            mainContent?.removeEventListener('touchstart', onUserIntent, true);
            mainContent?.removeEventListener('wheel', onUserIntent, true);
            mainContent?.removeEventListener('click', onUserIntent, true);
            mainContent?.removeEventListener('keydown', onKeyDown, true);
            states.clear();
            currentRoutes.clear();
            activeModuleId = null;
        }

        return Object.freeze({
            activate,
            deactivate,
            route,
            captureCurrent,
            getLastRoute,
            destroy
        });
    }

    window.AKEModuleViewState = Object.freeze({ create });
})();
