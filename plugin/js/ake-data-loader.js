(() => {
    if (window.akeDataLoader) return;

    const queues = new Map();
    const shared = new Map();
    const stats = { queued: 0, active: 0, completed: 0, failed: 0, bytes: 0 };
    const concurrency = Math.min(8, window.matchMedia?.('(max-width: 700px)').matches ? 4 : 6);
    let tableLoader = null;
    let i18nLoader = null;

    // Keep missing files scoped to the mounted module, including cached views.
    const missingByModule = new Map();
    let activeModule = '';
    let activeEntry = '';
    let missingToast = null;
    let dismissed = false;

    function renderMissing() {
        const files = new Set([...(missingByModule.get(`${activeModule}::`)?.values() || []), ...(activeEntry ? missingByModule.get(`${activeModule}::${activeEntry}`)?.values() || [] : [])]);
        if (!activeModule || !files.size || dismissed) return;
        const container = document.getElementById('toast-container');
        if (!container) return;
        if (!missingToast?.isConnected) {
            missingToast = document.createElement('section');
            missingToast.className = 'toast toast-error';
            missingToast.setAttribute('role', 'alert');
            container.appendChild(missingToast);
        }
        missingToast.replaceChildren();
        const translate = (key, fallback) => window.akeI18n?.t?.(`missingData.${key}`, null, fallback) || fallback;
        for (const [key, fallback] of [
            ['title', '当前页面数据缺失，显示数值可能不准确'],
            ['reason', '这可能是由于网络问题或数据尚未更新完毕导致的'],
            ['help', '请稍后刷新页面重试或前往群：1091817282提交反馈'],
            ['files', '当前缺失以下数据：']
        ]) {
            const p = document.createElement('p');
            p.textContent = translate(key, fallback);
            missingToast.appendChild(p);
        }
        const list = document.createElement('ul');
        [...files].sort().forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            list.appendChild(li);
        });
        missingToast.appendChild(list);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'ake-ui-button ake-ui-button--secondary';
        close.textContent = translate('close', '关闭');
        close.addEventListener('click', () => { dismissed = true; missingToast?.remove(); });
        missingToast.appendChild(close);
    }

    window.akeMissingData = {
        scope() { return activeModule ? `${activeModule}::${activeEntry}` : ''; },
        hasMissing() { return Boolean(missingByModule.get(`${activeModule}::`)?.size || missingByModule.get(this.scope())?.size); },
        isRequestFailure(error) {
            if (error?.name === 'AbortError') return false;
            if (Number.isInteger(error?.status)) return error.status === 404 || error.status === 408 || error.status >= 500;
            return error?.name === 'TypeError' || error?.name === 'TimeoutError';
        },
        report(url, scope = this.scope()) {
            if (!scope) return;
            let name, path;
            try { path = new URL(url, location.href).pathname; name = decodeURIComponent(path.split('/').pop()); }
            catch { path = String(url); name = path.split('/').pop(); }
            if (!name) return;
            if (!missingByModule.has(scope)) missingByModule.set(scope, new Map());
            missingByModule.get(scope).set(path, name);
            if (scope === this.scope() || scope === `${activeModule}::`) renderMissing();
        },
        resolved(url, scope = this.scope()) {
            let path;
            try { path = new URL(url, location.href).pathname; }
            catch { return; }
            const files = missingByModule.get(scope);
            files?.delete(path);
            if (scope === this.scope() || scope === `${activeModule}::`) {
                missingToast?.remove();
                renderMissing();
            }
        }
    };
    function activateMissingScope(event) {
        if (activeModule !== (event.detail?.moduleId || '')) activeEntry = '';
        activeModule = event.detail?.moduleId || '';
        dismissed = false;
        missingToast?.remove();
        renderMissing();
    }
    window.addEventListener('ake:module-loading', activateMissingScope);
    window.addEventListener('ake:module-activate', activateMissingScope);
    window.addEventListener('ake:module-deactivate', event => {
        if (event.detail?.moduleId === activeModule) {
            activeModule = '';
            activeEntry = '';
            missingToast?.remove();
        }
    });
    document.addEventListener('click', event => {
        if (missingToast?.contains(event.target)) return;
        const item = event.target.closest?.('.ake-ui-directory__item, [data-catalog-id], [data-ake-entry-id], [data-combatv3-action="select-skill"], [data-buffv3-action="select-buff"], .group-item[data-group-id], .mobile-group-item[data-group-id]');
        if (item) {
            activeEntry = item.dataset.catalogId || item.dataset.akeEntryId || item.dataset.gameId || item.dataset.missionId || item.dataset.seasonId || item.dataset.skillId || item.dataset.buffId || item.dataset.groupId || item.dataset.id || item.textContent.trim();
            dismissed = false;
            missingToast?.remove();
            renderMissing();
        }
    }, true);

    function priorityValue(priority) {
        return { foreground: 0, dependency: 1, prefetch: 2, background: 3 }[priority] ?? 1;
    }

    function queueFor(priority) {
        const key = String(priority || 'dependency');
        if (!queues.has(key)) queues.set(key, []);
        return queues.get(key);
    }

    function pump() {
        while (stats.active < concurrency) {
            const candidates = Array.from(queues.entries())
                .filter(([, queue]) => queue.length)
                .sort(([a], [b]) => priorityValue(a) - priorityValue(b));
            if (!candidates.length) return;
            const [, queue] = candidates[0];
            const task = queue.shift();
            stats.queued = Math.max(0, stats.queued - 1);
            stats.active++;
            Promise.resolve().then(task.run).then(value => {
                stats.completed++;
                task.resolve(value);
            }, error => {
                stats.failed++;
                task.reject(error);
            }).finally(() => {
                stats.active--;
                pump();
            });
        }
    }

    function enqueue(run, priority) {
        return new Promise((resolve, reject) => {
            queueFor(priority).push({ run, resolve, reject });
            stats.queued++;
            pump();
        });
    }

    function waitForShared(promise, signal) {
        if (!signal) return promise;
        if (signal.aborted) return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        return new Promise((resolve, reject) => {
            const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
            signal.addEventListener('abort', abort, { once: true });
            promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        });
    }

    function sourceKey(url, options) {
        return `${url}|${options?.cacheKey || ''}|${options?.hydrate === false ? 'raw' : 'parsed'}`;
    }

    function loadJson(url, options = {}) {
        const key = sourceKey(url, options);
        const scope = window.akeMissingData.scope();
        if (!shared.has(key)) {
            const promise = enqueue(async () => {
                const response = await (window.akeFetch || fetch)(url, {
                    akeProgress: options.akeProgress !== false,
                    cache: options.cache,
                    akeMissingDataTracked: true
                });
                if (!response.ok) throw Object.assign(new Error(`无法加载 ${url} (HTTP ${response.status})`), { status: response.status, url });
                const text = await response.text();
                stats.bytes += text.length;
                if (text.length >= 128 * 1024 && window.akeDataWorker?.parse) return window.akeDataWorker.parse(text);
                return JSON.parse(text.replace(/("id"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"'));
            }, options.priority || 'dependency').catch(error => {
                shared.delete(key);
                throw error;
            });
            shared.set(key, promise);
        }
        const tracked = options.reportMissing !== false && /\/public\/(?:[^/]+\/)*?(?:TableCfg|Json)\//i.test(String(url));
        return waitForShared(shared.get(key), options.signal).then(value => {
            if (tracked) window.akeMissingData.resolved(url, scope);
            return value;
        }, error => {
            if (tracked && !(options.optional404 && error?.status === 404) && window.akeMissingData.isRequestFailure(error)) window.akeMissingData.report(url, scope);
            throw error;
        });
    }

    function loadTable(name, version, options = {}) {
        if (!tableLoader) return Promise.reject(new Error('Table 加载器尚未注册'));
        const language = window.akeI18n?.getLanguageInfo?.().table || 'CN';
        const key = `table:${version?.id || 'current'}:${language}:${name}:${options.hydrate === false ? 'raw' : 'hydrated'}:${options.optional === true ? 'optional' : 'required'}`;
        if (!shared.has(key)) {
            shared.set(key, Promise.resolve().then(() => tableLoader({ name, version, options }))
                .catch(error => { shared.delete(key); throw error; }));
        }
        const scope = window.akeMissingData.scope();
        return waitForShared(shared.get(key), options.signal).then(value => {
            if (value?.__akeIncompleteText) shared.delete(key);
            window.akeMissingData.resolved(`/public/TableCfg/${name}.json`, scope);
            return value;
        }).catch(error => {
            if (version || !scope || !window.akeMissingData.isRequestFailure(error)) throw error;
            window.akeMissingData.report(error?.url || `/public/TableCfg/${name}.json`, scope);
            return {};
        });
    }

    window.akeDataLoader = {
        loadJson,
        loadTable,
        loadTables(entries, options = {}) {
            return Promise.all((entries || []).map(entry => loadTable(entry.name, entry.version, { ...options, ...entry })));
        },
        preloadI18n(options = {}) {
            return i18nLoader ? waitForShared(i18nLoader(options), options.signal) : Promise.resolve(null);
        },
        registerTableLoader(loader) { tableLoader = loader; },
        registerI18nLoader(loader) { i18nLoader = loader; },
        getStats() { return { ...stats, concurrency }; },
        clear() { shared.clear(); }
    };
})();
