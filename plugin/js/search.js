(function () {
    'use strict';
    const root = document.getElementById('searchModule');
    if (!root) return;
    window.__akeSearchController?.destroy();
    const listeners = new AbortController();
    const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: listeners.signal });
    const t = (key, params) => window.akeI18n.t(`modules.search.${key}`, params);
    const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const queryInput = root.querySelector('#globalSearchQuery');
    const advanced = root.querySelector('#searchAdvanced');
    const moduleFilter = root.querySelector('#searchModuleFilter');
    const resultsElement = root.querySelector('#searchResults');
    const summary = root.querySelector('#searchSummary');
    const pagination = root.querySelector('#searchPagination');
    const pageSize = 30;
    const storageKey = 'akedata-search-session-v1';
    let generation = 0, request = null, timer = null, destroyed = false, inputTimer = null, composing = false;
    const idleState = { query: '', results: [], diagnostics: null, phase: 'idle', page: 0, context: '', moduleFilter: '' };
    let state = { ...idleState };
    let grouped = null;
    const hidden = () => window.akeData.getConfig().showHidden === true;
    const modules = () => window.akeData.getModules().filter(module => !module.special && !module.disabled);
    const available = module => (!module.hidden || hidden()) && window.akeData.isTokenUnlocked(module.token);
    const moduleName = module => window.akeI18n.t(module.title, null, module.title);
    const priority = module => module.priority === undefined ? 999 : Number(module.priority);
    const accessKey = () => JSON.stringify([window.AKESearchData.contextKey(), modules().filter(available).map(module => module.id)]);
    const stateHtml = (key, kind = 'empty') => `<div class="ake-ui-state" data-state="${kind}">${h(t(key))}</div>`;
    function save() {
        if (!state.query || state.phase !== 'ready') return;
        try {
            const saved = { state,
                scroll: root.isConnected ? document.querySelector('.main-content')?.scrollTop || 0 : 0, savedAt: Date.now() };
            let json = JSON.stringify(saved);
            if (json.length > 1000000) {
                saved.state = { ...state, results: [], diagnostics: null, phase: 'idle' };
                saved.repeat = true; json = JSON.stringify(saved);
            }
            sessionStorage.setItem(storageKey, json);
        } catch { /* Storage limits must not prevent searching or opening an entry. */ }
    }

    function highlighted(text) {
        const value = String(text || '');
        const needle = state.query.toLocaleLowerCase();
        const lower = value.toLocaleLowerCase();
        const first = needle ? lower.indexOf(needle) : -1;
        const start = first > 100 ? first - 100 : 0;
        const end = Math.min(value.length, Math.max(start + 340, first + needle.length + 100));
        const slice = value.slice(start, end);
        const parts = [];
        let offset = 0;
        while (needle) {
            const index = slice.toLocaleLowerCase().indexOf(needle, offset);
            if (index < 0) break;
            parts.push(h(slice.slice(offset, index)), `<mark>${h(slice.slice(index, index + needle.length))}</mark>`);
            offset = index + needle.length;
        }
        parts.push(h(slice.slice(offset)));
        return (start ? '…' : '') + parts.join('') + (end < value.length ? '…' : '');
    }

    function groupedResults() {
        const registered = modules();
        const ordered = registered.filter(available).sort((a, b) => priority(a) - priority(b));
        const entriesByModule = new Map(ordered.map(module => [module.id, new Map()]));
        const visibleTables = new Set();
        const restrictedTables = new Set();
        for (const module of registered) {
            const tables = entriesByModule.has(module.id) ? visibleTables : restrictedTables;
            for (const table of window.AKESearchIndex[module.id]?.tables || []) tables.add(table);
        }
        const unassigned = [];
        let restricted = 0;
        for (const result of state.results) {
            if (restrictedTables.has(result.Table) && !visibleTables.has(result.Table)) { restricted++; continue; }
            const targets = result.targets.filter(target => entriesByModule.has(target.module));
            if (!targets.length) {
                const candidates = ordered.filter(module => result.candidates.includes(module.id));
                unassigned.push({ name: result.name, matches: [result], candidates });
            }
            for (const target of targets) {
                const entries = entriesByModule.get(target.module);
                if (!entries.has(target.id)) entries.set(target.id, { target, name: target.title || result.name, matches: [] });
                entries.get(target.id).matches.push(result);
            }
        }
        const groups = ordered.filter(module => entriesByModule.get(module.id).size).map(module => ({
            id: module.id, title: moduleName(module), entries: [...entriesByModule.get(module.id).values()]
        }));
        if (unassigned.length) groups.push({ id: null, title: t('uncategorized'), entries: unassigned });
        return { groups, restricted };
    }

    function renderEntry(entry) {
        const name = entry.name || t('unnamed');
        const heading = entry.target ? window.AKEUI.entryLinkHtml({ plugin: entry.target.module, id: entry.target.id, label: name, contentHtml: h(name) }) : h(name);
        const affiliation = entry.candidates?.length ? `<p>${h(t('candidateModules', { modules: entry.candidates.map(moduleName).join(' / ') }))}</p>` : '';
        return `<article class="ake-ui-card"><div class="ake-ui-card__body"><h3>${heading}</h3>${affiliation}${entry.matches.map(result => {
            const field = t(`fields.${result.field}`);
            const label = field === `modules.search.fields.${result.field}` ? t('fields.other') : field;
            const technical = hidden() ? `<details><summary>${h(t('source'))}</summary><pre>${h(JSON.stringify({ Table: result.Table, Path: result.Path, Id: result.Id }, null, 2))}</pre></details>` : '';
            return `<div><span class="ake-ui-badge">${h(label)}</span>${result.status !== 'resolved' ? ` <span class="ake-ui-badge">${h(t(result.status))}</span>` : ''}<p>${result.text ? highlighted(result.text) : h(t('textUnavailable'))}</p>${technical}</div>`;
        }).join('')}</div></article>`;
    }

    function render() {
        if (destroyed) return;
        root.setAttribute('aria-busy', String(state.phase === 'loading'));
        pagination.hidden = true;
        advanced.hidden = true;
        grouped = null;
        if (state.phase === 'idle') { summary.textContent = ''; resultsElement.innerHTML = stateHtml('start'); return; }
        if (state.phase === 'loading') { resultsElement.innerHTML = stateHtml('loading', 'loading'); return; }
        if (['error', 'cancelled', 'timeout'].includes(state.phase)) {
            summary.textContent = t(state.phase);
            resultsElement.innerHTML = `${stateHtml(state.phase, state.phase === 'error' ? 'error' : 'empty')}<button class="ake-ui-button" type="button" data-search-retry>${h(t('retry'))}</button>`;
            return;
        }
        grouped = groupedResults();
        const matchedModules = grouped.groups.filter(group => group.id !== null);
        if (!matchedModules.some(group => group.id === state.moduleFilter)) state.moduleFilter = '';
        if (matchedModules.length) {
            advanced.hidden = false;
            moduleFilter.replaceChildren(new Option(t('allModules'), ''), ...matchedModules.map(group => new Option(group.title, group.id)));
            moduleFilter.value = state.moduleFilter;
            window.AKEUI.refreshSelect(moduleFilter);
        }
        renderResults();
    }

    function renderResults() {
        if (!grouped) return;
        const { groups, restricted } = grouped;
        const selected = groups.find(group => group.id === state.moduleFilter);
        const shownGroups = selected ? [selected] : groups;
        const entryCount = shownGroups.reduce((count, group) => count + group.entries.length, 0);
        const pages = Math.max(1, Math.ceil(entryCount / pageSize));
        state.page = Math.min(state.page, pages - 1);
        if (selected) {
            summary.textContent = t('filteredSummary', { module: selected.title, count: entryCount });
        } else {
            const unresolved = state.results.filter(result => !result.targets.length).length;
            summary.textContent = t('summary', { hits: state.results.length, groups: entryCount, unresolved, restricted });
        }
        if (state.diagnostics.invalid) summary.textContent += ' ' + t('invalid', { count: state.diagnostics.invalid });
        if (state.results.some(result => result.status === 'loadFailed')) {
            summary.append(' ');
            const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'ake-ui-button';
            retry.dataset.searchRetry = ''; retry.textContent = t('retry'); summary.append(retry);
        }
        const start = state.page * pageSize;
        const end = start + pageSize;
        let offset = 0;
        resultsElement.innerHTML = shownGroups.map(group => {
            const entries = group.entries.slice(Math.max(0, start - offset), Math.max(0, end - offset));
            offset += group.entries.length;
            if (!entries.length) return '';
            return `<section class="ake-ui-section">
                <header class="ake-ui-section__header"><h2 class="ake-ui-section__title">${h(group.title)}</h2></header>
                <div class="ake-ui-section__body ake-ui-card-grid" data-size="full">${entries.map(renderEntry).join('')}</div>
            </section>`;
        }).join('') || stateHtml(state.results.length ? 'noFilteredResults' : 'noResults');
        pagination.hidden = pages <= 1;
        root.querySelector('#searchPrevious').disabled = state.page === 0;
        root.querySelector('#searchNext').disabled = state.page >= pages - 1;
        root.querySelector('#searchPage').textContent = t('page', { current: state.page + 1, total: pages });
    }

    function stop() {
        generation++;
        request?.abort(); request = null;
        clearTimeout(timer); timer = null;
        clearTimeout(inputTimer); inputTimer = null;
    }

    function clearSearch() {
        stop();
        state = { ...idleState };
        try { sessionStorage.removeItem(storageKey); } catch { /* Optional session state. */ }
        render();
    }

    function scheduleSearch() {
        stop();
        const query = queryInput.value.trim();
        if (!query) { clearSearch(); return; }
        state = { ...idleState, query, phase: 'loading', context: accessKey(), moduleFilter: state.query === query ? state.moduleFilter : '' };
        summary.textContent = t('loading'); render();
        if (!composing) inputTimer = setTimeout(() => { inputTimer = null; submit(); }, 300);
    }

    async function submit(refresh = false) {
        const query = queryInput.value.trim();
        if (!query) { clearSearch(); return; }
        stop();
        const token = generation;
        request = new AbortController();
        const signal = request.signal;
        let timedOut = false;
        timer = setTimeout(() => { timedOut = true; request?.abort(); }, 90000);
        state = { ...idleState, query, phase: 'loading', context: accessKey(), moduleFilter: state.query === query ? state.moduleFilter : '' };
        summary.textContent = t('loading'); render();
        try {
            const response = await window.AKESearchData.search(query, {
                signal, refresh,
                onProgress(completed, total) { if (token === generation && !destroyed) summary.textContent = t('progress', { completed, total }); }
            });
            if (token !== generation || destroyed) return;
            state.results = response.results; state.diagnostics = response.diagnostics; state.phase = 'ready';
        } catch (error) {
            if (token !== generation || destroyed) return;
            state.phase = timedOut ? 'timeout' : signal.aborted ? 'cancelled' : 'error';
            state.diagnostics = { error: error.message };
        } finally {
            if (token === generation && !destroyed) { clearTimeout(timer); timer = null; request = null; render(); }
        }
    }
    listen(root.querySelector('#searchForm'), 'submit', event => { event.preventDefault(); if (!composing) submit(); });
    listen(queryInput, 'compositionstart', () => { composing = true; stop(); });
    listen(queryInput, 'compositionend', () => { composing = false; scheduleSearch(); });
    listen(queryInput, 'input', scheduleSearch);
    listen(root, 'click', event => { if (event.target.closest('[data-search-retry]')) submit(true); });
    listen(moduleFilter, 'change', () => {
        if (!grouped) return;
        state.moduleFilter = moduleFilter.value;
        state.page = 0;
        renderResults();
        document.querySelector('.main-content')?.scrollTo(0, 0);
    });
    listen(root.querySelector('#searchPrevious'), 'click', () => { state.page--; renderResults(); resultsElement.scrollIntoView({ block: 'start' }); });
    listen(root.querySelector('#searchNext'), 'click', () => { state.page++; renderResults(); resultsElement.scrollIntoView({ block: 'start' }); });
    listen(window, 'pagehide', save);
    listen(root, 'click', event => { if (event.target.closest('a[data-ake-entry-plugin]')) save(); });
    function configChanged() {
        if (state.query && state.context !== accessKey()) {
            stop(); state = { ...idleState };
        }
        render();
    }
    listen(window, 'globalConfigChanged', configChanged);
    listen(window, 'ake:module-deactivate', event => {
        if (event.detail?.moduleId === 'search' && state.phase === 'loading') { stop(); state.phase = 'cancelled'; render(); }
    });
    listen(window, 'ake:module-activate', event => { if (event.detail?.moduleId === 'search') configChanged(); });
    window.__akeSearchController = {
        destroy() { destroyed = true; stop(); listeners.abort(); },
        search(query) {
            if (destroyed || !root.isConnected) return;
            composing = false;
            queryInput.value = String(query ?? '');
            submit();
            queryInput.focus({ preventScroll: true });
            document.querySelector('.main-content')?.scrollTo(0, 0);
        },
        getDiagnostics() { return structuredClone(state.diagnostics); }
    };
    window.__deepLinkId = null;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { /* Optional session state. */ }
    if (typeof window.__akePendingSearchQuery !== 'string' && saved?.state?.context === accessKey() && Array.isArray(saved.state.results)) {
        state = { ...idleState, ...saved.state };
        queryInput.value = state.query;
        advanced.open = Boolean(state.moduleFilter);
        if (saved.repeat || Date.now() - saved.savedAt >= 120000) submit();
        else requestAnimationFrame(() => { if (root.isConnected) document.querySelector('.main-content')?.scrollTo(0, saved.scroll || 0); });
    }
    render();
})();
