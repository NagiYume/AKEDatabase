(() => {
    if (window.akeDataLoader) return;

    const queues = new Map();
    const shared = new Map();
    const stats = { queued: 0, active: 0, completed: 0, failed: 0, bytes: 0 };
    const concurrency = Math.min(8, window.matchMedia?.('(max-width: 700px)').matches ? 4 : 6);
    let tableLoader = null;
    let i18nLoader = null;

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
        if (!shared.has(key)) {
            const promise = enqueue(async () => {
                const response = await (window.akeFetch || fetch)(url, {
                    akeProgress: options.akeProgress !== false,
                    cache: options.cache
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
        return waitForShared(shared.get(key), options.signal);
    }

    function loadTable(name, version, options = {}) {
        if (!tableLoader) return Promise.reject(new Error('Table 加载器尚未注册'));
        const language = window.akeI18n?.getLanguageInfo?.().table || 'CN';
        const key = `table:${version?.id || 'current'}:${language}:${name}:${options.hydrate === false ? 'raw' : 'hydrated'}:${options.optional === true ? 'optional' : 'required'}`;
        if (!shared.has(key)) {
            shared.set(key, Promise.resolve().then(() => tableLoader({ name, version, options }))
                .catch(error => { shared.delete(key); throw error; }));
        }
        return waitForShared(shared.get(key), options.signal);
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
