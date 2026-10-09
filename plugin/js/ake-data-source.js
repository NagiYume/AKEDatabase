(function () {
    if (window.akeDataSource) return;

    const BASE_URL_KEY = 'akedata-data-base-url';
    const VERSION_KEY = 'akedata-data-version';
    const NEW_TAG_SCOPE_KEY = 'akedata-newTagScope';
    const MANIFEST_CACHE_PREFIX = 'akedata-data-manifest:';
    const bootstrapVersion = window.__akeBootstrapVersion || {};
    const debugLocalMode = bootstrapVersion.debugmode === true;
    const defaultBaseUrl = normalizeBaseUrl(bootstrapVersion.dataBaseUrl || 'https://data.akedata.wiki');
    const localBaseUrl = normalizeBaseUrl(window.location.origin);
    const manifestPath = String(bootstrapVersion.dataManifestPath || '/manifest.json');
    let state = null;
    let assetRevision = '';
    let assetObserver = null;
    let assetHooksInstalled = false;

    const storage = {
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

    function normalizeBaseUrl(value) {
        const raw = String(value || '').trim();
        const url = new URL(raw || window.location.origin, window.location.href);
        if (!/^https?:$/.test(url.protocol)) throw new Error('数据请求域名仅支持 HTTP 或 HTTPS');
        url.pathname = url.pathname.replace(/\/+$/, '') || '/';
        url.search = '';
        url.hash = '';
        return url.href.replace(/\/$/, '');
    }

    function normalizeObjectPath(value) {
        const path = String(value || '').replace(/^\/+/, '').replace(/\/+$/, '');
        if (!path || path.split('/').includes('..')) throw new Error(`无效的数据目录：${value}`);
        return path;
    }

    function validateManifest(value) {
        if (!value || value.schemaVersion !== 1 || !Array.isArray(value.versions) || value.versions.length === 0) {
            throw new Error('版本清单格式无效');
        }
        const ids = new Set();
        const versions = value.versions.map(item => {
            const gameVersion = String(item?.gameVersion || '').trim();
            const hotfixVersion = String(item?.hotfixVersion || '').trim();
            const id = String(item?.id || `${gameVersion}@${hotfixVersion}`).trim();
            if (!gameVersion || !hotfixVersion || !id || ids.has(id)) throw new Error(`版本条目无效或重复：${id}`);
            ids.add(id);
            return Object.freeze({
                id,
                gameVersion,
                hotfixVersion,
                tableCfgPath: normalizeObjectPath(item.tableCfgPath),
                publishedAt: String(item.publishedAt || '')
            });
        });
        const latest = String(value.latest || '');
        if (!ids.has(latest)) throw new Error(`latest 指向不存在的版本：${latest}`);
        return Object.freeze({
            schemaVersion: 1,
            latest,
            sharedRevision: String(value.sharedRevision || value.updatedAt || '1'),
            updatedAt: String(value.updatedAt || ''),
            versions: Object.freeze(versions)
        });
    }

    function fallbackManifest(baseUrl) {
        const id = 'local@local';
        return validateManifest({
            schemaVersion: 1,
            latest: id,
            sharedRevision: 'local',
            updatedAt: bootstrapVersion.updatedAt || '',
            versions: [{
                id,
                gameVersion: 'local',
                hotfixVersion: 'local',
                tableCfgPath: 'public/TableCfg',
                publishedAt: bootstrapVersion.updatedAt || ''
            }]
        });
    }

    function isLocalDataSource(baseUrl) {
        const url = new URL(baseUrl);
        return url.origin === window.location.origin || ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    }

    function compareGameVersions(a, b) {
        const aParts = String(a || '').split('.').map(part => Number(part));
        const bParts = String(b || '').split('.').map(part => Number(part));
        const length = Math.max(aParts.length, bParts.length);
        for (let index = 0; index < length; index += 1) {
            const difference = (aParts[index] || 0) - (bParts[index] || 0);
            if (difference) return difference;
        }
        return String(a || '').localeCompare(String(b || ''), 'en');
    }

    function compareHotfixVersions(a, b) {
        const left = String(a || '').split('-').map(Number);
        const right = String(b || '').split('-').map(Number);
        if (left.some(part => !Number.isFinite(part)) || right.some(part => !Number.isFinite(part))) {
            return String(a || '').localeCompare(String(b || ''), 'en', { numeric: true });
        }
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
            const difference = (left[index] || 0) - (right[index] || 0);
            if (difference) return difference;
        }
        return 0;
    }

    function compareVersions(a, b) {
        return compareGameVersions(a.gameVersion, b.gameVersion)
            || compareHotfixVersions(a.hotfixVersion, b.hotfixVersion);
    }

    function getNewTagScope() {
        const value = storage.get(NEW_TAG_SCOPE_KEY, 'major');
        return ['major', 'hotfix', 'none'].includes(value) ? value : 'major';
    }

    function findLatestComparison(manifest) {
        const current = manifest.versions.find(item => item.id === manifest.latest);
        if (!current || current.gameVersion === 'local') return null;
        const scope = getNewTagScope();
        const previous = manifest.versions.filter(item => scope === 'hotfix'
            ? compareVersions(item, current) < 0
            : compareGameVersions(item.gameVersion, current.gameVersion) < 0);
        const baseline = previous.sort((a, b) => compareVersions(b, a))[0];
        return baseline ? Object.freeze({ current, baseline, showAdded: scope !== 'none' }) : null;
    }

    async function loadManifest(baseUrl, localFallbackBaseUrl = null) {
        const cacheKey = `${MANIFEST_CACHE_PREFIX}${baseUrl}`;
        const url = new URL(manifestPath, `${baseUrl}/`);
        url.searchParams.set('t', Date.now());
        try {
            const response = await fetch(url.href, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const manifest = validateManifest(await response.json());
            storage.set(cacheKey, JSON.stringify(manifest));
            return { manifest, source: 'network' };
        } catch (error) {
            const cached = storage.get(cacheKey);
            if (cached) {
                try {
                    return { manifest: validateManifest(JSON.parse(cached)), source: 'cache', error };
                } catch {}
            }
            if (localFallbackBaseUrl && isLocalDataSource(localFallbackBaseUrl)) {
                console.warn(`无法读取 ${url.origin} 的版本清单，使用本地未版本化数据。`, error);
                return { manifest: fallbackManifest(localFallbackBaseUrl), source: 'fallback', error };
            }
            throw new Error(`无法读取 ${url.origin} 的版本清单，且没有可用的缓存清单`);
        }
    }

    function classify(resource) {
        const url = new URL(typeof resource === 'string' ? resource : resource?.url, window.location.href);
        if (url.origin !== window.location.origin) return { type: 'external', url };
        if (url.pathname === '/asset-sync-index.json') return { type: 'shared', url };
        if (url.pathname === '/endfield-bundles/manifest.json' || url.pathname.startsWith('/endfield-bundles/')) return { type: 'model-bundle', url };
        if (url.pathname.startsWith('/public/TableCfg/')) return { type: 'table', url };
        if (url.pathname.startsWith('/public/Json/')) return { type: 'shared', url };
        if (url.pathname.startsWith('/public/images/')) return { type: 'shared', url };
        if (url.pathname.startsWith('/public/')) return { type: 'site-public', url };
        return { type: 'other', url };
    }

    function resolveUrl(resource) {
        const result = classify(resource);
        if (!state || (result.type !== 'table' && result.type !== 'shared' && result.type !== 'model-bundle')) return result.url.href;
        const target = new URL(`${state.baseUrl}/`);
        if (result.type === 'table') {
            const suffix = result.url.pathname.slice('/public/TableCfg/'.length);
            target.pathname = `/${state.selected.tableCfgPath}/${suffix}`.replace(/\/+/g, '/');
        } else if (result.type === 'model-bundle') {
            target.pathname = result.url.pathname;
        } else {
            target.pathname = result.url.pathname;
            if (!result.url.pathname.startsWith('/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/mainhud/')) {
                target.searchParams.set('v', assetRevision || state.manifest.sharedRevision);
            }
        }
        result.url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
        return target.href;
    }

    function resolveImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return raw;
        const migrated = typeof window.resolveImagePath === 'function'
            ? window.resolveImagePath(raw)
            : raw;
        const result = classify(migrated);
        return result.type === 'shared' && result.url.pathname.startsWith('/public/images/')
            ? resolveUrl(migrated)
            : migrated;
    }

    function rewriteSrcset(value) {
        return String(value || '').split(',').map(candidate => {
            const match = candidate.trim().match(/^(\S+)(\s+.+)?$/);
            if (!match) return candidate.trim();
            return `${resolveImageUrl(match[1])}${match[2] || ''}`;
        }).join(', ');
    }

    function rewriteStyle(value) {
        return String(value || '').replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
            const resolved = resolveImageUrl(url);
            return resolved === url ? match : `url("${resolved}")`;
        });
    }

    function rewriteHtml(value) {
        return String(value ?? '')
            .replace(/(\s(?:src|poster)\s*=\s*)(['"])(.*?)\2/gi, (match, prefix, quote, url) => (
                `${prefix}${quote}${resolveImageUrl(url)}${quote}`
            ))
            .replace(/(\ssrcset\s*=\s*)(['"])(.*?)\2/gi, (match, prefix, quote, srcset) => (
                `${prefix}${quote}${rewriteSrcset(srcset)}${quote}`
            ))
            .replace(/(\sstyle\s*=\s*)(['"])(.*?)\2/gi, (match, prefix, quote, style) => (
                `${prefix}${quote}${rewriteStyle(style)}${quote}`
            ));
    }

    function installDomAssetHooks() {
        if (assetHooksInstalled || typeof Element === 'undefined') return;
        assetHooksInstalled = true;

        const nativeSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name, value) {
            const attribute = String(name || '').toLowerCase();
            let routedValue = value;
            if (attribute === 'src' || attribute === 'poster') routedValue = resolveImageUrl(value);
            else if (attribute === 'srcset') routedValue = rewriteSrcset(value);
            else if (attribute === 'style') routedValue = rewriteStyle(value);
            return nativeSetAttribute.call(this, name, routedValue);
        };

        const innerHtmlDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (innerHtmlDescriptor?.get && innerHtmlDescriptor?.set) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                ...innerHtmlDescriptor,
                set(value) { innerHtmlDescriptor.set.call(this, rewriteHtml(value)); }
            });
        }

        const nativeInsertAdjacentHtml = Element.prototype.insertAdjacentHTML;
        if (nativeInsertAdjacentHtml) {
            Element.prototype.insertAdjacentHTML = function (position, value) {
                return nativeInsertAdjacentHtml.call(this, position, rewriteHtml(value));
            };
        }

        const routeProperty = (prototype, property, transform) => {
            if (!prototype) return;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
            if (!descriptor?.get || !descriptor?.set) return;
            Object.defineProperty(prototype, property, {
                ...descriptor,
                set(value) { descriptor.set.call(this, transform(value)); }
            });
        };
        routeProperty(globalThis.HTMLImageElement?.prototype, 'src', resolveImageUrl);
        routeProperty(globalThis.HTMLImageElement?.prototype, 'srcset', rewriteSrcset);
        routeProperty(globalThis.HTMLSourceElement?.prototype, 'src', resolveImageUrl);
        routeProperty(globalThis.HTMLSourceElement?.prototype, 'srcset', rewriteSrcset);
        routeProperty(globalThis.HTMLVideoElement?.prototype, 'poster', resolveImageUrl);

        const nativeSetProperty = globalThis.CSSStyleDeclaration?.prototype?.setProperty;
        if (nativeSetProperty) {
            globalThis.CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
                return nativeSetProperty.call(this, property, rewriteStyle(value), priority);
            };
        }
    }

    function rewriteElementAssets(element) {
        if (!(element instanceof Element)) return;
        if (element.hasAttribute('data-database-src')) {
            const source = element.getAttribute('data-database-src');
            if (element instanceof HTMLImageElement) {
                element.setAttribute('data-ake-image-pending', '');
            }
            element.removeAttribute('data-database-src');
            element.setAttribute('src', resolveImageUrl(source));
        }
        for (const attribute of ['src', 'poster']) {
            if (!element.hasAttribute(attribute)) continue;
            const current = element.getAttribute(attribute);
            const resolved = resolveImageUrl(current);
            if (resolved !== current) element.setAttribute(attribute, resolved);
        }
        if (element.hasAttribute('srcset')) {
            const current = element.getAttribute('srcset');
            const resolved = rewriteSrcset(current);
            if (resolved !== current) element.setAttribute('srcset', resolved);
        }
        if (element.hasAttribute('style')) {
            const current = element.getAttribute('style');
            const resolved = rewriteStyle(current);
            if (resolved !== current) element.setAttribute('style', resolved);
        }
    }

    function rewriteDomAssets(root) {
        if (!root) return root;
        rewriteElementAssets(root);
        root.querySelectorAll?.('[data-database-src], [src], [srcset], [poster], [style]').forEach(rewriteElementAssets);
        return root;
    }

    function observeDomAssets() {
        if (assetObserver || !document.documentElement || typeof MutationObserver === 'undefined') return;
        document.addEventListener('load', event => {
            if (!(event.target instanceof HTMLImageElement) || !event.target.hasAttribute('data-ake-image-pending')) return;
            event.target.removeAttribute('data-ake-image-pending');
        }, true);
        assetObserver = new MutationObserver(records => {
            records.forEach(record => {
                if (record.type === 'attributes') rewriteElementAssets(record.target);
                record.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) rewriteDomAssets(node);
                });
            });
        });
        assetObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'srcset', 'poster', 'style']
        });
        rewriteDomAssets(document);
    }

    function cacheNamespace(resource, appVersion) {
        const result = classify(resource);
        if (!state) return `site|${appVersion || '1'}`;
        if (result.type === 'table') return `table|${state.baseUrl}|${state.selected.hotfixVersion}`;
        if (result.type === 'shared') return `shared|${state.baseUrl}|${assetRevision || state.manifest.sharedRevision}`;
        return `site|${window.location.origin}|${appVersion || '1'}`;
    }

    async function initialize() {
        let selection = debugLocalMode ? 'latest' : storage.get(VERSION_KEY, 'latest');
        let baseUrl;
        let loaded;
        if (debugLocalMode) {
            baseUrl = localBaseUrl;
            loaded = {
                manifest: fallbackManifest(localBaseUrl),
                source: 'local'
            };
        } else {
            try {
                baseUrl = normalizeBaseUrl(storage.get(BASE_URL_KEY, defaultBaseUrl));
            } catch {
                storage.remove(BASE_URL_KEY);
                baseUrl = defaultBaseUrl;
            }
            loaded = await loadManifest(
                baseUrl,
                isLocalDataSource(baseUrl) ? baseUrl : null
            );
        }
        let selectedId = selection === 'latest' ? loaded.manifest.latest : selection;
        let selected = loaded.manifest.versions.find(item => item.id === selectedId);
        if (!selected) {
            selection = 'latest';
            selected = loaded.manifest.versions.find(item => item.id === loaded.manifest.latest);
            storage.set(VERSION_KEY, selection);
        }
        const debugLocal = debugLocalMode;
        state = Object.freeze({
            baseUrl,
            defaultBaseUrl,
            localBaseUrl,
            manifest: loaded.manifest,
            manifestSource: loaded.source,
            selection,
            selected,
            comparison: !debugLocalMode && selection === 'latest'
                ? findLatestComparison(loaded.manifest)
                : null,
            debugMode: debugLocalMode,
            debugLocal
        });
        installDomAssetHooks();
        observeDomAssets();
        window.dispatchEvent(new CustomEvent('akeDataSourceReady', { detail: state }));
        return state;
    }

    const ready = initialize();

    window.akeDataSource = {
        ready,
        classify,
        resolveUrl,
        resolveImageUrl,
        rewriteDomAssets,
        cacheNamespace,
        setAssetRevision(revision) {
            const value = String(revision || '').trim();
            if (value) assetRevision = value;
        },
        getState: () => state,
        getNewTagScope,
        async configure({ baseUrl, selection }) {
            if (debugLocalMode) return false;
            const normalizedBase = normalizeBaseUrl(baseUrl || defaultBaseUrl);
            const nextSelection = String(selection || 'latest');
            if (normalizedBase === defaultBaseUrl) storage.remove(BASE_URL_KEY);
            else storage.set(BASE_URL_KEY, normalizedBase);
            storage.set(VERSION_KEY, nextSelection);
            return nextSelection !== state?.selection || normalizedBase !== state?.baseUrl;
        },
        reset() {
            storage.remove(BASE_URL_KEY);
            storage.set(VERSION_KEY, 'latest');
        }
    };
})();
