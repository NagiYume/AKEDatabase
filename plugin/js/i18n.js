(function () {
    if (window.akeI18n) return;

    const LANGUAGES = Object.freeze({
        CH: { directory: 'CH', table: 'CN', htmlLang: 'zh-CN' },
        TC: { directory: 'TC', table: 'TC', htmlLang: 'zh-Hant' },
        EN: { directory: 'EN', table: 'EN', htmlLang: 'en' },
        JP: { directory: 'JP', table: 'JP', htmlLang: 'ja' },
        KR: { directory: 'KR', table: 'KR', htmlLang: 'ko' },
        RU: { directory: 'RU', table: 'RU', htmlLang: 'ru' },
        MX: { directory: 'MX', table: 'MX', htmlLang: 'es-MX' },
        BR: { directory: 'BR', table: 'BR', htmlLang: 'pt-BR' },
        DE: { directory: 'DE', table: 'DE', htmlLang: 'de' },
        FR: { directory: 'FR', table: 'FR', htmlLang: 'fr' },
        VN: { directory: 'VN', table: 'VN', htmlLang: 'vi' },
        TH: { directory: 'TH', table: 'TH', htmlLang: 'th' },
        ID: { directory: 'ID', table: 'ID', htmlLang: 'id' },
        IT: { directory: 'IT', table: 'IT', htmlLang: 'it' }
    });
    const LANGUAGE_LABELS = Object.freeze({
        CH: '简体中文',
        TC: '繁體中文',
        EN: 'English',
        JP: '日本語',
        KR: '한국어',
        RU: 'Русский',
        MX: 'Español (Latinoamérica)',
        BR: 'Português (Brasil)',
        DE: 'Deutsch',
        FR: 'Français',
        VN: 'Tiếng Việt',
        TH: 'ไทย',
        ID: 'Bahasa Indonesia',
        IT: 'Italiano'
    });
    const storage = window.akeStorage || {
        get(key, fallback) {
            try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
        }
    };
    const requested = String(storage.get('akedata-language', 'CH')).toUpperCase();
    let language = LANGUAGES[requested] ? requested : 'CH';
    let messages = {};
    let fallbackMessages = {};
    let observer = null;

    function getPath(source, path) {
        return String(path || '').split('.').reduce((value, key) => value?.[key], source);
    }

    function format(value, params) {
        return String(value).replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match);
    }

    function t(key, params, fallback) {
        const value = getPath(messages, key) ?? getPath(fallbackMessages, key);
        return format(value === undefined ? (fallback === undefined ? key : fallback) : value, params);
    }

    function getValue(key, fallback = null) {
        const value = getPath(messages, key) ?? getPath(fallbackMessages, key);
        return value === undefined ? fallback : value;
    }

    function translateElement(element) {
        if (!(element instanceof Element)) return;
        const textKey = element.dataset.i18n;
        if (textKey) element.textContent = t(textKey, null, element.textContent);
        ['title', 'placeholder', 'aria-label'].forEach(attribute => {
            const dataName = `i18n${attribute.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')}`;
            const key = element.dataset[dataName];
            if (key) element.setAttribute(attribute, t(key, null, element.getAttribute(attribute) || ''));
        });
    }

    function translateDOM(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) return;
        if (root instanceof Element) translateElement(root);
        root.querySelectorAll?.('*').forEach(translateElement);
    }

    function buildI18nUrl(directory) {
        const url = new URL(`/public/${directory}/i18n.json`, window.location.href);
        const appVersion = window.__akeBootstrapVersion?.appversion;
        if (appVersion) url.searchParams.set('v', appVersion);
        if (window.__akeForceRefreshTimestamp) url.searchParams.set('t', window.__akeForceRefreshTimestamp);
        return url.href;
    }

    async function load() {
        const info = LANGUAGES[language];
        document.documentElement.lang = info.htmlLang;
        try {
            const forceRefresh = Boolean(window.__akeForceRefreshTimestamp);
            const loadMessages = async directory => {
                const response = await fetch(buildI18nUrl(directory), {
                    cache: forceRefresh ? 'no-store' : 'force-cache',
                    headers: forceRefresh ? { 'X-AKE-Page-Cache': '1' } : undefined
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data.messages || {};
            };
            [messages, fallbackMessages] = await Promise.all([
                loadMessages(info.directory),
                info.directory === 'CH' ? Promise.resolve({}) : loadMessages('CH').catch(error => {
                    console.warn('Unable to load Chinese interface fallbacks.', error);
                    return {};
                })
            ]);
        } catch (error) {
            console.warn(`Unable to load ${language} interface translations.`, error);
            if (language !== 'CH') {
                language = 'CH';
                storage.set('akedata-language', language);
                return load();
            }
        }
        translateDOM(document);
        observer = new MutationObserver(records => {
            observer.disconnect();
            records.forEach(record => record.addedNodes.forEach(translateDOM));
            observer.observe(document.documentElement, { childList: true, subtree: true });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        return language;
    }

    const ready = load();
    window.akeI18n = {
        ready,
        t,
        getValue,
        scope(prefix) {
            return (key, params, fallback) => t(`${prefix}.${key}`, params, fallback);
        },
        translateDOM,
        getLanguage: () => language,
        getLanguageInfo: () => ({ ...LANGUAGES[language] }),
        getLanguageLabel: code => LANGUAGE_LABELS[String(code || '').toUpperCase()] || String(code || '').toUpperCase(),
        getSupportedLanguages: () => Object.keys(LANGUAGES),
        setLanguage(nextLanguage) {
            const normalized = String(nextLanguage || '').toUpperCase();
            if (!LANGUAGES[normalized] || normalized === language) return false;
            storage.set('akedata-language', normalized);
            location.reload();
            return true;
        }
    };
})();
