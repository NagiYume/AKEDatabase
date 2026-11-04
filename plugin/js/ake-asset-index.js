(function () {
    if (window.akeAssetIndex) return;

    const bootstrap = window.__akeBootstrapVersion || {};
    const productionBase = String(bootstrap.dataBaseUrl || 'https://data.akedata.wiki').replace(/\/+$/, '');
    const sharedPromises = new Map();

    function normalizeBaseUrl(value) {
        const url = new URL(String(value || ''), window.location.href);
        if (!/^https?:$/.test(url.protocol)) throw new Error('资产索引数据源仅支持 HTTP 或 HTTPS');
        return url.href.replace(/\/+$/, '');
    }

    function safeSegmentPath(value) {
        const parts = String(value || '').replace(/\\/g, '/').split('/');
        if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || /[\r\n]/.test(part))) {
            throw new Error(`资产索引路径无效：${value}`);
        }
        return parts;
    }

    function validateIndex(index) {
        if (!index || index.schemaVersion !== 2 || !String(index.revision || '') || !index.datasets || typeof index.datasets !== 'object') {
            throw new Error('远端资产索引格式无效');
        }
        for (const [kind, dataset] of Object.entries(index.datasets)) {
            if (!['images', 'json'].includes(kind) || !dataset || typeof dataset.files !== 'object') throw new Error(`资产索引数据集无效：${kind}`);
            for (const [path, record] of Object.entries(dataset.files)) {
                safeSegmentPath(path);
                if (!record || !Number.isInteger(record.size) || record.size < 0 || !/^[0-9a-f]{32}$/.test(String(record.md5 || ''))) throw new Error(`资产索引记录无效：${path}`);
            }
        }
        if (index.ccData !== undefined) {
            const ccData = index.ccData;
            if (!ccData || ccData.root !== 'public' || !ccData.files || typeof ccData.files !== 'object' || Array.isArray(ccData.files)) {
                throw new Error('合约数值索引无效');
            }
            for (const [path, record] of Object.entries(ccData.files)) {
                const parts = safeSegmentPath(path);
                if (parts.length !== 1 || !path.endsWith('.json') || !record ||
                    !Number.isInteger(record.size) || record.size < 0 ||
                    !/^[0-9a-f]{32}$/.test(String(record.md5 || '')) ||
                    !/^[^@\s]+@[^@\s]+$/.test(String(record.version || ''))) {
                    throw new Error(`合约数值索引记录无效：${path}`);
                }
            }
        }
        return index;
    }

    function encodePath(parts) {
        return parts.map(encodeURIComponent).join('/');
    }

    function contentFile(path) {
        return `/public/Json/${encodePath(safeSegmentPath(path))}`;
    }

    function toEntry(path, record, index) {
        const parts = safeSegmentPath(path);
        const filename = parts[parts.length - 1];
        const id = filename.endsWith('.json') ? filename.slice(0, -5) : filename;
        const name = id.startsWith('buff_') ? id.slice(5) : id;
        const entry = { id, name, path, contentFile: contentFile(path), hidden: false, priority: 10 + index, size: record.size, md5: record.md5, version: record.version || '' };
        if (record.meta && typeof record.meta === 'object') {
            entry.meta = structuredClone(record.meta);
            Object.assign(entry, structuredClone(record.meta));
        }
        return entry;
    }

    function filesForPrefix(index, prefix, options = {}) {
        const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
        const dataset = index.datasets.json;
        if (!dataset) return [];
        const prefixParts = normalizedPrefix ? safeSegmentPath(normalizedPrefix) : [];
        const rows = Object.entries(dataset.files)
            .filter(([path]) => {
                const parts = safeSegmentPath(path);
                return parts.length > prefixParts.length && prefixParts.every((part, i) => parts[i] === part) && parts.length === prefixParts.length + 1;
            })
            .sort(([a], [b]) => a.localeCompare(b, 'en'));
        const showHidden = options.hidden === true;
        return rows.map(([path, record], index) => toEntry(path, record, index)).filter(item => showHidden || !item.hidden);
    }

    async function load(options = {}) {
        const requestedBase = options?.baseUrl ? normalizeBaseUrl(options.baseUrl) : '';
        const forceRefresh = window.__akeForceRefreshTimestamp || '';
        const cacheKey = `${requestedBase || '__default__'}|${forceRefresh}`;
        if (!sharedPromises.has(cacheKey)) {
            sharedPromises.set(cacheKey, (async () => {
                const state = await window.akeDataSource.ready;
                const base = requestedBase || (state.debugMode ? productionBase : state.baseUrl);
                const url = new URL(`${base}/asset-sync-index.json`);
                if (forceRefresh) url.searchParams.set('t', forceRefresh);
                const response = await fetch(url.href, { cache: forceRefresh ? 'no-store' : 'no-cache' });
                if (!response.ok) throw new Error(`无法加载远端资产索引 (HTTP ${response.status})`);
                const index = validateIndex(await response.json());
                if (base === state.baseUrl) window.akeDataSource.setAssetRevision(index.revision);
                return Object.freeze(index);
            })().catch(error => {
                sharedPromises.delete(cacheKey);
                throw error;
            }));
        }
        return sharedPromises.get(cacheKey);
    }

    // Keep archive membership and global-search routes on the same source relations.
    function readingReferences(index, popups = {}) {
        const byContentId = new Map();
        const byUniqId = new Map();
        const diagnostics = [];
        for (const [path, record] of Object.entries(index.datasets.json?.files || {})) {
            if (!/^(LevelData|LevelScriptData)\/.+\.json$/i.test(path)) continue;
            const meta = record.meta || {};
            if (meta.narrativeMetadataVersion !== 1) diagnostics.push({ reason: 'outdated-narrative-metadata', path });
            const refs = meta.narrativeReadingReferences || (meta.narrativeReadingContentIds || []).map(typeId => ({ typeId }));
            for (const ref of refs) {
                const contentId = popups[ref.typeId]?.contentId || ref.typeId;
                if (!contentId) { diagnostics.push({ reason: 'missing-content-id', path, reference: ref }); continue; }
                if (!byContentId.has(contentId)) byContentId.set(contentId, []);
                byContentId.get(contentId).push({ path, ...ref, contentId });
            }
            for (const id of meta.narrativeReadingUniqIds || []) {
                if (!byUniqId.has(id)) byUniqId.set(id, []);
                byUniqId.get(id).push(path);
            }
        }
        return { byContentId, byUniqId, diagnostics };
    }

    window.akeAssetIndex = {
        readingReferences,
        get ready() { return load(); },
        load,
        async listJsonFiles(prefix, options) {
            const index = await load();
            return filesForPrefix(index, prefix, options);
        },
        async listJsonDirectories(prefix = '') {
            const index = await load();
            const base = String(prefix || '').replace(/^\/+|\/+$/g, '');
            const parts = base ? safeSegmentPath(base) : [];
            const found = new Set();
            for (const path of Object.keys(index.datasets.json?.files || {})) {
                const candidate = safeSegmentPath(path);
                if (candidate.length > parts.length && parts.every((part, i) => candidate[i] === part)) found.add(candidate.slice(0, parts.length + 1).join('/'));
            }
            return Array.from(found).sort((a, b) => a.localeCompare(b, 'en'));
        },
        async getJsonFile(path) {
            const index = await load();
            const normalized = safeSegmentPath(path).join('/');
            const record = index.datasets.json?.files?.[normalized];
            return record ? toEntry(normalized, record, 0) : null;
        }
    };
})();
