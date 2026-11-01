(function () {
    'use strict';
    if (window.AKEModuleSearch) return;

    // pinyin-pro 3.29.0 (MIT), vendored locally; no search text leaves the browser.
    // Keep ordinary substring matching first, including IDs and non-Chinese text.
    const cache = new Map();
    let cachedQuery = '';
    let cachedCharacters = 0;

    function matches(value, query) {
        const text = String(value ?? '').toLocaleLowerCase();
        const needle = String(query ?? '').toLocaleLowerCase();
        if (text.includes(needle)) return true;
        if (!/[\u3400-\u9fff\uf900-\ufaff]/u.test(text)
            || !/^[a-zü\s']+$/u.test(needle) || !/[a-zü]/u.test(needle)
            || typeof window.pinyinPro?.match !== 'function') return false;

        const pinyinQuery = needle.replace(/[\s']/gu, '');
        if (cachedQuery !== pinyinQuery) {
            cache.clear();
            cachedCharacters = 0;
            cachedQuery = pinyinQuery;
        }
        if (cache.has(text)) return cache.get(text);
        const result = window.pinyinPro.match(text, pinyinQuery, {
            continuous: true, precision: 'first', lastPrecision: 'start', v: true
        }) !== null;
        // Bound memory when searching large archives or changing data sources.
        if (cache.size >= 4096 || cachedCharacters + text.length > 1000000) {
            cache.clear();
            cachedCharacters = 0;
        }
        if (text.length <= 1000000) {
            cache.set(text, result);
            cachedCharacters += text.length;
        }
        return result;
    }

    window.AKEModuleSearch = Object.freeze({ matches });
})();
