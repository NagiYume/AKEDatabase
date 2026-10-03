(function () {
    'use strict';
    if (window.AKECatalog) return;
    const controllers = new Map();
    const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const t = (key, params) => window.akeI18n.t(`modules.catalog.${key}`, params);
    const hidden = () => window.akeData?.getConfig?.().showHidden === true;
    const text = value => window.AKEV3.text(value);
    const name = (value, id) => text(value).replace(/<[^>]*>/g, '') || (hidden() && id !== undefined && id !== null && id !== '' ? String(id) : t('unnamed'));
    const rich = value => {
        const content = text(value);
        return content ? (window.parseText ? window.parseText(content, '/public/images/') : h(content)) : '';
    };
    const values = table => Object.values(table || {});
    const entries = table => Object.entries(table || {});
    const list = value => Array.isArray(value) ? value : values(value);
    const number = value => value === undefined || value === null ? '—' : window.renderRawValueTip?.(h(value), value) || h(value);
    const state = message => `<div class="ake-ui-state" data-state="empty" data-density="compact">${h(message || t('empty'))}</div>`;
    const section = (title, content, open = false) => `<details class="ake-ui-section"${open ? ' open' : ''}><summary class="ake-ui-section__title">${h(title)}</summary>${content || state()}</details>`;
    const table = (headings, rows) => rows.length ? `<div class="ake-ui-table-shell"><table class="ake-ui-table"><thead><tr>${headings.map(label => `<th scope="col">${h(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : state();
    const link = (plugin, id, label) => id === undefined || id === null || id === '' ? h(label || t('unavailable')) : window.AKEUI.entryLinkHtml({ plugin, id: String(id), label, contentHtml: h(label), className: 'ake-ui-badge' });
    const raw = row => hidden() ? section(t('source'), `<pre>${h(JSON.stringify(row, null, 2))}</pre>`) : '';

    function context(tables, diagnostics) {
        const issues = new Set();
        const issue = (kind, source, id, detail) => {
            const key = JSON.stringify([kind, source, id, detail]);
            if (!issues.has(key)) { issues.add(key); diagnostics.issues.push({ kind, source, id, detail }); }
        };
        const item = (id, count) => {
            if (!id) return '—';
            const row = tables.ItemTable?.[id];
            if (!row) issue('missing-reference', 'ItemTable', id);
            return link('v3_item', id, name(row?.name, id)) + (count === undefined || count === null ? '' : ` × ${number(count)}`);
        };
        const items = rows => list(rows).map(row => item(row.id ?? row.itemId ?? row.costItemId, row.count ?? row.itemCount ?? row.costItemCount)).join('<br>') || '—';
        const reward = id => {
            if (!id) return '—';
            const row = tables.RewardTable?.[id];
            if (!row) { issue('missing-reference', 'RewardTable', id); return h(t('unavailable')); }
            const parts = [];
            if (row.itemBundles?.length) parts.push(items(row.itemBundles));
            if (row.probItemBundles?.length) parts.push(`${h(t('possibleRewards'))}<br>${items(row.probItemBundles)}`);
            return parts.join('<br>') || '—';
        };
        const conditions = rows => list(rows).map(row => {
            const description = text(row.desc || row.conditionDesc || row.taskDesc);
            if (!description) issue('untranslated-condition', 'conditions', row.conditionId, row.conditionType);
            return `${description ? rich(description) : h(t('conditionType', { value: row.conditionType ?? '?' }))}${row.progressToCompare == null ? '' : ` · ${h(t('target'))}: ${number(row.progressToCompare)}`}${raw(row)}`;
        }).join('<br>') || h(t('none'));
        const domain = id => name(tables.DomainDataTable?.[id]?.domainName, id);
        const dungeon = id => {
            const row = tables.DungeonTable?.[id];
            if (!row) { issue('missing-reference', 'DungeonTable', id); return h(name(null, id)); }
            // The dungeon module routes by series, not individual dungeon ID.
            return link('v3_dungeon', row.dungeonSeriesId, name(row.dungeonName, id));
        };
        const fields = (row, keys) => table([t('property'), t('value')], keys.filter(key => row[key] !== undefined && row[key] !== null).map(key => {
            const value = row[key];
            return [h(t(`fields.${key}`)), typeof value === 'boolean' ? h(t(value ? 'yes' : 'no')) : number(value)];
        }));
        return { tables, issue, item, items, reward, conditions, domain, dungeon, fields, h, t, hidden, text, name, rich, values, entries, list, number, state, section, table, link, raw };
    }

    function mount(spec) {
        controllers.get(spec.id)?.destroy();
        const root = document.querySelector(`.ake-ui-directory[data-ake-module="${spec.id}"]`);
        if (!root) return;
        const abort = new AbortController();
        const listen = (node, type, handler) => node?.addEventListener(type, handler, { signal: abort.signal });
        const search = root.querySelector('[data-catalog-search]');
        const filter = root.querySelector('[data-catalog-filter]');
        const directory = root.querySelector('[data-catalog-list]');
        const mobile = root.querySelector('[data-catalog-mobile-list]');
        const overlay = root.querySelector('[data-catalog-overlay]');
        const detail = root.querySelector('[data-catalog-detail]');
        const count = root.querySelector('[data-catalog-count]');
        let rows = [], ctx = null, activeId = null, generation = 0, destroyed = false, loading = false;
        let pendingNotFound = null, lastHidden = hidden();
        let diagnostics = { state: 'loading', sources: {}, issues: [], coverage: {} };
        const deepId = window.__deepLinkId;
        window.__deepLinkId = null;
        const title = () => window.akeI18n.t(`modules.${spec.id}.title`);
        const close = () => { overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); };
        function renderDetail() {
            if (!ctx) return;
            const row = rows.find(entry => entry.id === activeId);
            if (!row) { detail.innerHTML = state(); return; }
            const header = window.AKEUI.detailHeader({ title: row.name, subtitle: row.group, id: hidden() ? row.id : undefined });
            detail.innerHTML = `<article class="ake-ui-detail">${header.outerHTML}${spec.render(row, ctx)}${raw(row.raw)}</article>`;
        }
        function select(id, update = true) {
            if (!rows.some(row => row.id === id)) return false;
            activeId = id;
            renderList(); renderDetail(); close();
            if (update) window.__akeRouter?.updateUrl(spec.id, id);
            return true;
        }
        function renderList() {
            const query = search.value.trim().toLocaleLowerCase();
            const filtered = rows.filter(row => (!filter.value || row.group === filter.value) && (!query || `${row.name} ${row.group} ${row.search || ''} ${hidden() ? row.id : ''}`.toLocaleLowerCase().includes(query)));
            count.textContent = t('count', { count: filtered.length, total: rows.length });
            for (const target of [directory, mobile]) {
                target.replaceChildren();
                if (!filtered.length) { target.innerHTML = state(t('noMatches')); continue; }
                const fragment = document.createDocumentFragment();
                for (const row of filtered) fragment.appendChild(window.AKEUI.directoryItem({
                    layout: 'entity', title: row.name, subtitle: row.subtitle ? `${row.group} · ${row.subtitle}` : row.group, id: hidden() ? row.id : undefined,
                    active: row.id === activeId, attributes: { 'data-catalog-id': row.id }
                }));
                target.appendChild(fragment);
            }
        }
        function rebuild(preferred) {
            rows = spec.build(ctx);
            const ids = new Set();
            rows = rows.filter(row => {
                if (ids.has(row.id)) { ctx.issue('duplicate-entry', spec.id, row.id); return false; }
                ids.add(row.id); return true;
            });
            const selectedGroup = filter.value;
            filter.replaceChildren(new Option(t('all'), ''));
            [...new Set(rows.map(row => row.group).filter(Boolean))].forEach(group => filter.add(new Option(group, group)));
            filter.value = [...filter.options].some(option => option.value === selectedGroup) ? selectedGroup : '';
            window.AKEUI.refreshSelect?.(filter);
            for (const source of spec.primary || []) {
                const included = new Set(rows.flatMap(row => (row.sources || []).filter(ref => ref.table === source).map(ref => String(ref.key))));
                const expected = Object.keys(ctx.tables[source] || {});
                diagnostics.coverage[source] = { sourceCount: expected.length, includedCount: included.size, missing: expected.filter(id => !included.has(id)) };
            }
            pendingNotFound = preferred && !rows.some(row => row.id === preferred) ? preferred : null;
            if (pendingNotFound && root.isConnected) {
                window.__akeRouter?.onDeepLinkNotFound?.(pendingNotFound, false);
                pendingNotFound = null;
            }
            activeId = rows.some(row => row.id === preferred) ? preferred : rows[0]?.id || null;
            renderList(); renderDetail();
        }
        async function load() {
            const token = ++generation;
            loading = true;
            diagnostics = { state: 'loading', sources: {}, issues: [], coverage: {} };
            detail.innerHTML = `<div class="ake-ui-state" data-state="loading">${h(t('loading'))}</div>`;
            try {
                if (window.configLoaded) await window.configLoaded;
                const names = [...new Set(['ItemTable', 'RewardTable', ...(spec.tables || [])])];
                const loaded = await Promise.all(names.map(name => window.AKEV3.table(name, undefined, { optional: (spec.optional || []).includes(name) })));
                if (destroyed || token !== generation) return;
                const tables = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
                diagnostics.sources = Object.fromEntries(names.map(name => [name, Object.keys(tables[name]).length]));
                ctx = context(tables, diagnostics);
                diagnostics.state = 'ready';
                rebuild(activeId || deepId);
            } catch (error) {
                if (destroyed || token !== generation) return;
                ctx = null;
                diagnostics.state = 'error'; diagnostics.error = error.message;
                detail.innerHTML = `<div class="ake-ui-state" data-state="error"><p>${h(t('loadFailed'))}</p>${hidden() ? `<p>${h(error.message)}</p>` : ''}<button class="ake-ui-button" type="button" data-catalog-retry>${h(t('retry'))}</button></div>`;
            } finally { if (token === generation) loading = false; }
        }
        listen(search, 'input', renderList);
        listen(filter, 'change', renderList);
        const onListClick = event => { const button = event.target.closest('[data-catalog-id]'); if (button) select(button.dataset.catalogId); };
        listen(directory, 'click', onListClick); listen(mobile, 'click', onListClick);
        listen(root.querySelector('[data-catalog-open]'), 'click', () => { overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false'); });
        listen(overlay, 'click', event => { if (event.target === overlay || event.target.closest('[data-catalog-close]')) close(); });
        listen(root, 'keydown', event => { if (event.key === 'Escape') close(); });
        listen(detail, 'click', event => {
            if (event.target.closest('[data-catalog-retry]')) { load(); return; }
            const anchor = event.target.closest('[data-ake-entry-plugin][data-ake-entry-id]');
            if (anchor?.dataset.akeEntryPlugin === spec.id && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
                event.preventDefault(); select(anchor.dataset.akeEntryId);
            }
            const media = event.target.closest('[data-catalog-media]');
            if (media) showMedia(media, generation);
        });
        // Only indexed image assets are used. Video events are not guessed into URLs.
        async function showMedia(button, token) {
            const mediaId = button.dataset.catalogMedia;
            button.disabled = true;
            try {
                const index = await window.akeAssetIndex.load();
                if (destroyed || token !== generation || !root.contains(button)) return;
                const needle = mediaId.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.[^.\/]+$/, '').toLowerCase();
                const matches = Object.keys(index.datasets.images?.files || {}).filter(path => {
                    const base = path.replace(/\.[^.\/]+$/, '').toLowerCase();
                    return base === needle || base.endsWith('/' + needle);
                });
                if (matches.length !== 1) {
                    ctx.issue('unresolved-media', 'WikiTutorialPageTable', mediaId, matches.length);
                    button.textContent = t('mediaUnavailable'); button.disabled = false; return;
                }
                const frame = document.createElement('div'); frame.className = 'ake-ui-table-shell';
                const image = document.createElement('img'); image.alt = button.dataset.mediaTitle || '';
                // Scroll the original image using the shared overflow container; do not crop teaching diagrams.
                frame.appendChild(image);
                image.addEventListener('error', () => { if (frame.parentNode) frame.replaceWith(button); button.textContent = t('mediaUnavailable'); button.disabled = false; }, { once: true });
                image.src = '/public/images/' + matches[0].split('/').map(encodeURIComponent).join('/');
                button.replaceWith(frame);
                window.akeDataSource?.rewriteDomAssets?.(frame);
            } catch (error) {
                if (destroyed || token !== generation) return;
                button.textContent = t('mediaRetry'); button.disabled = false;
                ctx.issue('media-load-failed', 'asset-index', mediaId, error.message);
            }
        }
        listen(window, 'globalConfigChanged', () => {
            if (lastHidden === hidden()) return;
            lastHidden = hidden();
            if (ctx && !destroyed) rebuild(activeId);
        });
        listen(window, 'ake:module-deactivate', event => { if (event.detail?.moduleId === spec.id) close(); });
        listen(window, 'ake:module-activate', event => {
            if (event.detail?.moduleId !== spec.id || destroyed) return;
            if (pendingNotFound) {
                window.__akeRouter?.onDeepLinkNotFound?.(pendingNotFound, false);
                pendingNotFound = null;
            } else if (!ctx && !loading) load();
        });
        const controller = { select, destroy() { destroyed = true; generation++; abort.abort(); }, diagnostics() { return structuredClone(diagnostics); } };
        controllers.set(spec.id, controller);
        root.querySelector('[data-catalog-title]').textContent = title();
        load();
        return controller;
    }
    window.AKECatalog = { mount, getDiagnostics: id => id ? controllers.get(id)?.diagnostics() : Object.fromEntries([...controllers].map(([id, controller]) => [id, controller.diagnostics()])) };
})();
