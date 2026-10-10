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
    const resultsElement = root.querySelector('#searchResults');
    const summary = root.querySelector('#searchSummary');
    const pagination = root.querySelector('#searchPagination');
    const pageSize = 30;
    const storageKey = 'akedata-search-session-v1';
    let generation = 0, request = null, timer = null, destroyed = false, inputTimer = null, composing = false;
    let state = { query: '', results: [], diagnostics: null, phase: 'idle', page: 0, context: '' };
    const hidden = () => window.akeData.getConfig().showHidden === true;
    const modules = () => window.akeData.getModules().filter(module => !module.special && !module.disabled);
    const available = module => (!module.hidden || hidden()) && window.akeData.isTokenUnlocked(module.token);
    const moduleName = id => {
        const module = modules().find(module => module.id === id);
        return module ? window.akeI18n.t(module.title, null, module.title) : t('unassigned');
    };
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
        const visible = new Set(modules().filter(available).map(module => module.id));
        const registered = new Set(modules().map(module => module.id));
        const groups = new Map();
        let restricted = 0;
        for (const result of state.results) {
            const owners = Object.entries(window.AKESearchIndex).filter(([id, definition]) => registered.has(id) && definition.tables.includes(result.Table)).map(([id]) => id);
            if (owners.length && !owners.some(id => visible.has(id))) { restricted++; continue; }
            const targets = result.targets.filter(target => visible.has(target.module));
            const candidates = result.candidates.filter(id => visible.has(id));
            const destinations = targets.length ? targets : [null];
            for (const target of destinations) {
                const key = target ? JSON.stringify([target.module, target.id]) : JSON.stringify([result.Table, result.Path, result.Id]);
                if (!groups.has(key)) groups.set(key, { target, name: target?.title || result.name, matches: [], candidates });
                groups.get(key).matches.push(result);
            }
        }
        return { groups: [...groups.values()], restricted };
    }

    function render() {
        if (destroyed) return;
        root.setAttribute('aria-busy', String(state.phase === 'loading'));
        pagination.hidden = true;
        if (state.phase === 'idle') { summary.textContent = ''; resultsElement.innerHTML = stateHtml('start'); return; }
        if (state.phase === 'loading') { resultsElement.innerHTML = stateHtml('loading', 'loading'); return; }
        if (['error', 'cancelled', 'timeout'].includes(state.phase)) {
            summary.textContent = t(state.phase);
            resultsElement.innerHTML = `${stateHtml(state.phase, state.phase === 'error' ? 'error' : 'empty')}<button class="ake-ui-button" type="button" data-search-retry>${h(t('retry'))}</button>`;
            return;
        }
        const { groups, restricted } = groupedResults();
        const pages = Math.max(1, Math.ceil(groups.length / pageSize));
        state.page = Math.min(state.page, pages - 1);
        const unresolved = state.results.filter(result => !result.targets.length).length;
        summary.textContent = t('summary', { hits: state.results.length, groups: groups.length, unresolved, restricted });
        if (state.diagnostics.invalid) summary.textContent += ' ' + t('invalid', { count: state.diagnostics.invalid });
        if (state.results.some(result => result.status === 'loadFailed')) {
            summary.append(' ');
            const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'ake-ui-button';
            retry.dataset.searchRetry = ''; retry.textContent = t('retry'); summary.append(retry);
        }
        const shown = groups.slice(state.page * pageSize, (state.page + 1) * pageSize);
        resultsElement.innerHTML = shown.map(group => {
            const name = group.name || t('unnamed');
            const heading = group.target ? window.AKEUI.entryLinkHtml({ plugin: group.target.module, id: group.target.id, label: name, contentHtml: h(name) }) : h(name);
            const affiliation = group.target ? h(moduleName(group.target.module))
                : h(group.candidates.length ? t('candidateModules', { modules: group.candidates.map(moduleName).join(' / ') }) : t('unassigned'));
            return `<article class="ake-ui-card"><div class="ake-ui-card__body"><h2>${heading}</h2><p>${affiliation}</p>${group.matches.map(result => {
                const field = t(`fields.${result.field}`);
                const label = field === `modules.search.fields.${result.field}` ? t('fields.other') : field;
                const technical = hidden() ? `<details><summary>${h(t('source'))}</summary><pre>${h(JSON.stringify({ Table: result.Table, Path: result.Path, Id: result.Id }, null, 2))}</pre></details>` : '';
                return `<div><span class="ake-ui-badge">${h(label)}</span>${result.status !== 'resolved' ? ` <span class="ake-ui-badge">${h(t(result.status))}</span>` : ''}<p>${result.text ? highlighted(result.text) : h(t('textUnavailable'))}</p>${technical}</div>`;
            }).join('')}</div></article>`;
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
        state = { query: '', results: [], diagnostics: null, phase: 'idle', page: 0, context: '' };
        try { sessionStorage.removeItem(storageKey); } catch { /* Optional session state. */ }
        render();
    }

    function scheduleSearch() {
        stop();
        if (!queryInput.value.trim()) { clearSearch(); return; }
        state = { query: queryInput.value.trim(), results: [], diagnostics: null, phase: 'loading', page: 0, context: accessKey() };
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
        state = { query, results: [], diagnostics: null, phase: 'loading', page: 0, context: accessKey() };
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
    listen(root.querySelector('#searchPrevious'), 'click', () => { state.page--; render(); resultsElement.scrollIntoView({ block: 'start' }); });
    listen(root.querySelector('#searchNext'), 'click', () => { state.page++; render(); resultsElement.scrollIntoView({ block: 'start' }); });
    listen(window, 'pagehide', save);
    listen(root, 'click', event => { if (event.target.closest('a[data-ake-entry-plugin]')) save(); });
    function configChanged() {
        if (state.query && state.context !== accessKey()) {
            stop(); state = { query: '', results: [], diagnostics: null, phase: 'idle', page: 0, context: '' };
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
        state = saved.state;
        queryInput.value = state.query;
        if (saved.repeat || Date.now() - saved.savedAt >= 120000) submit();
        else requestAnimationFrame(() => { if (root.isConnected) document.querySelector('.main-content')?.scrollTo(0, saved.scroll || 0); });
    }
    render();
})();
