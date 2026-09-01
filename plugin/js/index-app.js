(function() {
            const storage = window.akeStorage || {
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
            const moduleHtmlCache = new Map();
            const scriptSourceCache = new Map();
            const moduleViewCache = new Map();
            const pluginVersionStorageKey = 'akedata-plugin-versions';
            const jsVersionStorageKey = 'akedata-js-versions';
            const bootstrapVersion = window.__akeBootstrapVersion || {};
            const configuredPluginVersions = bootstrapVersion.pluginversion || {};
            const configuredJsVersions = bootstrapVersion.jsversion || {};
            const HIDDEN_MODULE_MARKER_ICON = '<svg viewBox="0 0 24 24" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
            const readStoredVersions = key => {
                try {
                    const value = JSON.parse(storage.get(key, '{}'));
                    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
                } catch {
                    return {};
                }
            };
            const storedPluginVersions = readStoredVersions(pluginVersionStorageKey);
            const storedJsVersions = readStoredVersions(jsVersionStorageKey);
            const changedPluginVersions = new Set(Object.keys(configuredPluginVersions)
                .filter(id => storedPluginVersions[id] !== configuredPluginVersions[id]));
            const changedJsVersions = new Set(Object.keys(configuredJsVersions)
                .filter(path => storedJsVersions[path] !== configuredJsVersions[path]));
            let mountedModuleId = null;
            let moduleLoadGeneration = 0;
            let tipCheckStarted = false;
            let countdownTimer = null;

            const HOME_CONTENT = `
                <div class="welcome-home">
                    <button class="home-tip-button" id="homeTipButton" type="button" data-i18n="home.announcement">Announcement</button>
                    <img src="/public/images/index/main.png"
                         alt="home.heroImageAlt"
                         data-i18n-alt="home.heroImageAlt"
                         class="home-image">
                    <p class="welcome-home__title" data-i18n="home.title">home.title</p>
                    <div class="welcome-home__countdown" id="homeUpdateCountdown" data-i18n="version.loading">version.loading</div>
                    <div class="welcome-home__notes">
                        <span data-i18n="home.precisionNote">home.precisionNote</span><br>
                        <span data-i18n="home.disclaimer">home.disclaimer</span><br>
                        <span data-i18n="home.settingsHint">home.settingsHint</span>
                    </div>
                    <div class="welcome-home__registration">
                        <a href="https://beian.miit.gov.cn/#/Integrated/index" target="_blank" rel="noopener noreferrer">浙ICP备2026014728号-1</a>
                    </div>
                </div>
            `;

            function showHomePage(checkTip = true, preserveUrl = false) {
                stashMountedModule();
                moduleLoadGeneration++;
                activateModuleScope(null);
                setContent(HOME_CONTENT);
                renderVersionInfo();
                document.getElementById('homeTipButton')?.addEventListener('click', showTip);
                document.querySelectorAll('.module-item').forEach(item => item.classList.remove('active'));
                activeModuleId = null;
                if (window.__akeRouter && !preserveUrl) window.__akeRouter.clearUrl();
                if (checkTip !== false) showUpdatedTip();
            }

            function show404Page(isHidden) {
                stashMountedModule();
                moduleLoadGeneration++;
                activateModuleScope(null);
                const hiddenHint = isHidden ? `
                    <div class="not-found-hint">
                        <p data-i18n="errors.hiddenContentHint">errors.hiddenContentHint</p>
                        <p data-i18n="errors.hiddenContentHelp">errors.hiddenContentHelp</p>
                    </div>
                ` : '';
                window.AKESidebarResize?.unmountModule();
                contentArea.innerHTML = `
                    <div class="not-found-page">
                        <div class="not-found-code">404</div>
                        <div class="not-found-title" data-i18n="errors.notFoundTitle">errors.notFoundTitle</div>
                        <div class="not-found-desc" data-i18n="errors.notFoundDesc">errors.notFoundDesc</div>
                        ${hiddenHint}
                        <button class="not-found-home-btn" id="notFoundHomeBtn" data-i18n="errors.returnHome">errors.returnHome</button>
                    </div>
                `;
                window.akeI18n?.translateDOM(contentArea);
                document.querySelectorAll('.module-item').forEach(item => item.classList.remove('active'));
                activeModuleId = null;
                const btn = document.getElementById('notFoundHomeBtn');
                if (btn) btn.addEventListener('click', showHomePage);
            }

            let config = {
                language: window.akeI18n?.getLanguage?.() || 'CH',
                theme: 'light',
                showHidden: false,
                showExportButton: true,
                showVersionChanges: storage.get('akedata-showVersionChanges', 'false') === 'true',
                levelSettings: {
                    enabled: true,
                    characterLevels: '1,20,40,60,80,90',
                    weaponLevels: '1,20,40,60,80,90',
                    enemyLevels: '1,20,40,60,80,90',
                    skillLevels: [true, false, false, false, false, false, false, false, true, true, true, true]
                },
                keepUrlSync: true,
                unlockedTokens: []
            };

            let allModules = [];
            let modulesReady = false;
            let activeModuleId = null;

            const moduleListEl = document.getElementById('moduleListContainer');
            const contentArea = document.getElementById('contentArea');
            const moduleViewState = window.AKEModuleViewState?.create({ contentArea });
            window.AKESidebarResize?.initMain();
            const brandHome = document.getElementById('brandHome');
            const themeLink = document.getElementById('theme-style');
            const settingsButton = document.getElementById('settingsButton');
            const settingsModal = document.getElementById('settingsModal');
            const closeSettings = document.getElementById('closeSettings');
            const modalThemeSelect = document.getElementById('modalThemeSelect');
            const modalLanguageSelect = document.getElementById('modalLanguageSelect');
            const modalShowHiddenCheck = document.getElementById('modalShowHiddenCheck');
            const modalShowVersionChanges = document.getElementById('modalShowVersionChanges');
            const modalDataVersionSelect = document.getElementById('modalDataVersionSelect');
            const modalDataBaseUrl = document.getElementById('modalDataBaseUrl');
            const dataSourceStatus = document.getElementById('dataSourceStatus');
            const modalLevelsEnabled = document.getElementById('modalLevelsEnabled');
            const modalCharacterLevels = document.getElementById('modalCharacterLevels');
            const modalWeaponLevels = document.getElementById('modalWeaponLevels');
            const modalEnemyLevels = document.getElementById('modalEnemyLevels');
            const tooltip1 = document.getElementById('hyperlink-tooltip-1');
            const tooltip2 = document.getElementById('hyperlink-tooltip-2');
            const tipModal = document.getElementById('tipModal');
            const tipModalBody = document.getElementById('tipModalBody');
            const closeTipModal = document.getElementById('closeTipModal');

            // 移动端模块菜单
            const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
            const mobileMenuList = document.getElementById('mobileMenuList');

            function buildMobileMenu() {
                if (!mobileMenuList) return false;
                const visibleModules = filterModules(allModules);
                const sorted = sortModulesByPriority(visibleModules);
                mobileMenuList.innerHTML = '';
                sorted.forEach(mod => {
                    const item = document.createElement('div');
                    item.className = 'mobile-menu-item';
                    item.innerHTML = `
                        <div class="title">${mod.icon || '📦'} ${translateModuleField(mod, 'title')}</div>
                        <div class="desc">${translateModuleField(mod, 'description')}</div>
                    `;
                    item.addEventListener('click', async () => {
                        closeMobileMenu();
                        const module = allModules.find(m => m.id === mod.id);
                        if (module) {
                            const loaded = await loadModuleContent(module);
                            if (!loaded) return;
                            activeModuleId = mod.id;
                            document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
                            const sidebarItem = document.querySelector(`.module-item[data-id="${mod.id}"]`);
                            if (sidebarItem) sidebarItem.classList.add('active');
                            syncModuleNavigation(mod.id, loaded);
                        }
                    });
                    mobileMenuList.appendChild(item);
                });
                return true;
            }

            function openMobileMenu() {
                if (!mobileMenuOverlay || !buildMobileMenu()) return;
                mobileMenuOverlay.style.display = 'flex';
            }

            function closeMobileMenu() {
                if (mobileMenuOverlay) mobileMenuOverlay.style.display = 'none';
            }

            mobileMenuOverlay?.addEventListener('click', (e) => {
                if (e.target === mobileMenuOverlay) closeMobileMenu();
            });

            // 移动端底部栏按钮
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
            const mobileExportBtn = document.getElementById('mobileExportBtn');

            if (mobileMenuBtn) {
                mobileMenuBtn.addEventListener('click', openMobileMenu);
            }
            if (mobileSettingsBtn) {
                mobileSettingsBtn.addEventListener('click', openSettings);
            }
            if (mobileExportBtn) {
                mobileExportBtn.addEventListener('click', () => {
                    document.getElementById('exportButton')?.click();
                });
            }

            // ---------- 工具函数 ----------
            function setContent(html) {
                closeRawValueTip();
                window.AKESidebarResize?.unmountModule();
                const template = document.createElement('template');
                template.innerHTML = html;
                window.akeDataSource?.rewriteDomAssets?.(template.content);
                contentArea.replaceChildren(template.content.cloneNode(true));
                window.akeI18n?.translateDOM(contentArea);
            }

            function tr(key, params, fallback) {
                return window.akeI18n?.t(key, params, fallback) ?? fallback ?? key;
            }

            function appendTipInlineMarkdown(parent, source) {
                const text = String(source || '');
                const tokenPattern = /(`[^`\n]+`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_)/g;
                let offset = 0;
                for (const match of text.matchAll(tokenPattern)) {
                    if (match.index > offset) parent.append(document.createTextNode(text.slice(offset, match.index)));
                    let element;
                    if (match[0].startsWith('`')) {
                        element = document.createElement('code');
                        element.textContent = match[0].slice(1, -1);
                    } else if (match[2] !== undefined) {
                        let url;
                        try { url = new URL(match[3], window.location.href); } catch { url = null; }
                        if (url && ['http:', 'https:', 'mailto:'].includes(url.protocol)) {
                            element = document.createElement('a');
                            element.href = url.href;
                            element.target = '_blank';
                            element.rel = 'noopener noreferrer';
                            appendTipInlineMarkdown(element, match[2]);
                        } else {
                            element = document.createTextNode(match[0]);
                        }
                    } else {
                        const strong = match[4] ?? match[5];
                        const strike = match[6];
                        const emphasis = match[7] ?? match[8];
                        element = document.createElement(strong !== undefined ? 'strong' : strike !== undefined ? 'del' : 'em');
                        appendTipInlineMarkdown(element, strong ?? strike ?? emphasis);
                    }
                    parent.append(element);
                    offset = match.index + match[0].length;
                }
                if (offset < text.length) parent.append(document.createTextNode(text.slice(offset)));
            }

            function renderTipMarkdown(markdown) {
                const fragment = document.createDocumentFragment();
                const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
                let list = null;
                let code = null;
                const closeList = () => { list = null; };
                lines.forEach(line => {
                    const fence = line.match(/^```\s*([\w-]+)?\s*$/);
                    if (fence) {
                        closeList();
                        if (code) {
                            fragment.append(code.pre);
                            code = null;
                        } else {
                            const pre = document.createElement('pre');
                            const element = document.createElement('code');
                            if (fence[1]) element.className = `language-${fence[1]}`;
                            pre.append(element);
                            code = { pre, element, lines: [] };
                        }
                        return;
                    }
                    if (code) {
                        code.lines.push(line);
                        code.element.textContent = code.lines.join('\n');
                        return;
                    }
                    const heading = line.match(/^(#{1,6})\s+(.+)$/);
                    const item = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
                    const quote = line.match(/^>\s?(.*)$/);
                    let element = null;
                    if (heading) {
                        closeList();
                        element = document.createElement(`h${heading[1].length}`);
                        appendTipInlineMarkdown(element, heading[2]);
                    } else if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
                        closeList();
                        element = document.createElement('hr');
                    } else if (item) {
                        const type = /\d/.test(item[1]) ? 'ol' : 'ul';
                        if (!list || list.tagName.toLowerCase() !== type) {
                            list = document.createElement(type);
                            fragment.append(list);
                        }
                        element = document.createElement('li');
                        appendTipInlineMarkdown(element, item[2]);
                        list.append(element);
                        element = null;
                    } else if (quote) {
                        closeList();
                        element = document.createElement('blockquote');
                        appendTipInlineMarkdown(element, quote[1]);
                    } else if (line.trim()) {
                        closeList();
                        element = document.createElement('p');
                        appendTipInlineMarkdown(element, line.trim());
                    } else {
                        closeList();
                    }
                    if (element) fragment.append(element);
                });
                if (code) fragment.append(code.pre);
                return fragment;
            }

            function hideTip() {
                if (tipModal) tipModal.hidden = true;
            }

            async function showTip() {
                if (!tipModal || !tipModalBody) return;
                const version = await window.akeVersionReady;
                const tipVersion = String(version?.tipversion || '').trim();
                const directory = window.akeI18n?.getLanguageInfo?.().directory || 'CH';
                const url = new URL(`/public/${directory}/tip.md`, window.location.href);
                if (tipVersion) url.searchParams.set('v', tipVersion);
                try {
                    const response = await fetch(url.href, {
                        cache: 'force-cache',
                        headers: { 'X-AKE-Page-Cache': '1' }
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const markdown = await response.text();
                    tipModalBody.replaceChildren(renderTipMarkdown(markdown));
                    tipModal.hidden = false;
                    closeTipModal?.focus();
                    if (tipVersion) storage.set('akedata-tipversion', tipVersion);
                } catch (error) {
                    console.warn(`无法加载网站公告：${url.pathname}`, error);
                }
            }

            async function showUpdatedTip() {
                if (tipCheckStarted) return;
                const version = await window.akeVersionReady;
                const tipVersion = String(version?.tipversion || '').trim();
                if (!tipVersion || storage.get('akedata-tipversion') === tipVersion) return;
                tipCheckStarted = true;
                try {
                    await showTip();
                } finally {
                    if (storage.get('akedata-tipversion') !== tipVersion) tipCheckStarted = false;
                }
            }

            closeTipModal?.addEventListener('click', hideTip);
            tipModal?.addEventListener('click', (event) => {
                if (event.target === tipModal) hideTip();
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && !tipModal?.hidden) hideTip();
            });

            function firstLoadTextTableHint() {
                return tr('common.firstLoadTextTableHint', null, '首次加载需要加载文本映射表，可能速度较慢');
            }

            function translateModuleField(module, field) {
                const key = module?.[field];
                return key ? tr(key, null, key) : '';
            }

            function renderLanguageOptions() {
                if (!modalLanguageSelect || !window.akeI18n) return;
                const current = config.language || window.akeI18n.getLanguage();
                modalLanguageSelect.replaceChildren();
                window.akeI18n.getSupportedLanguages().forEach(code => {
                    const option = document.createElement('option');
                    option.value = code;
                    option.textContent = window.akeI18n.getLanguageLabel(code);
                    if (code === current) option.selected = true;
                    modalLanguageSelect.appendChild(option);
                });
                window.AKEUI?.refreshSelect(modalLanguageSelect);
            }

            function renderDataSourceSettings() {
                const dataState = window.akeDataSource?.getState?.();
                if (!dataState || !modalDataVersionSelect || !modalDataBaseUrl) return;
                modalDataBaseUrl.value = dataState.baseUrl;
                modalDataBaseUrl.disabled = Boolean(dataState.debugMode);
                modalDataVersionSelect.disabled = Boolean(dataState.debugMode);
                modalDataVersionSelect.replaceChildren();
                const latestVersion = dataState.manifest.versions.find(item => item.id === dataState.manifest.latest);
                const latestOption = document.createElement('option');
                latestOption.value = 'latest';
                latestOption.textContent = `Latest — ${latestVersion.gameVersion} / ${latestVersion.hotfixVersion}`;
                modalDataVersionSelect.appendChild(latestOption);
                const group = document.createElement('optgroup');
                group.label = tr('settings.dataSource.fixedVersions', null, '固定版本');
                dataState.manifest.versions.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = `${item.gameVersion} / ${item.hotfixVersion}`;
                    group.appendChild(option);
                });
                modalDataVersionSelect.appendChild(group);
                modalDataVersionSelect.value = dataState.selection;
                window.AKEUI?.refreshSelect(modalDataVersionSelect);
                if (dataSourceStatus) {
                    const sourceText = dataState.debugLocal
                        ? tr('settings.dataSource.debugLocal', null, '调试模式已启用，强制使用当前本地服务器数据')
                        : dataState.manifestSource === 'network'
                        ? tr('settings.dataSource.online', null, '版本清单已从数据服务加载')
                        : tr('settings.dataSource.fallback', null, '当前正在使用兼容版本配置');
                    dataSourceStatus.textContent = `${sourceText} · ${dataState.baseUrl}`;
                }
            }

            function currentModuleRouteId(moduleId) {
                const rememberedRoute = moduleViewState?.getLastRoute(moduleId);
                if (rememberedRoute !== null && rememberedRoute !== undefined) return rememberedRoute;
                if (!config.keepUrlSync) return null;
                const params = new URLSearchParams(window.location.search);
                return params.get('plugin') === moduleId ? params.get('id') : null;
            }

            function dispatchModuleLifecycle(type, moduleId) {
                window.dispatchEvent(new CustomEvent(`ake:module-${type}`, {
                    detail: { moduleId }
                }));
            }

            function stashMountedModule() {
                if (!mountedModuleId) return;
                const moduleId = mountedModuleId;
                const routeId = currentModuleRouteId(moduleId);
                const fragment = document.createDocumentFragment();
                closeRawValueTip();
                moduleViewState?.deactivate(moduleId);
                dispatchModuleLifecycle('deactivate', moduleId);
                window.AKESidebarResize?.unmountModule();
                while (contentArea.firstChild) fragment.appendChild(contentArea.firstChild);
                moduleViewCache.set(moduleId, { fragment, routeId });
                mountedModuleId = null;
            }

            function restoreStashedModule(moduleId) {
                const state = moduleViewCache.get(moduleId);
                if (!state) return null;
                moduleViewCache.delete(moduleId);
                contentArea.replaceChildren(state.fragment);
                window.AKESidebarResize?.mountModule(contentArea, moduleId);
                mountedModuleId = moduleId;
                moduleViewState?.activate(moduleId, state.routeId);
                dispatchModuleLifecycle('activate', moduleId);
                return state;
            }

            function syncModuleNavigation(moduleId, loadResult) {
                window.__akeRouter?.updateUrl(moduleId, loadResult.restored ? loadResult.routeId : null);
                if (!loadResult.restored) {
                    if (moduleId === 'v3_archive' && loadResult.reused && window.__akeArchiveController?.showOverview) {
                        window.__akeArchiveController.showOverview();
                    } else if (moduleId !== 'v3_archive') {
                        window.AKEModuleOverview?.showRoot(moduleId);
                    }
                }
            }

            function activateModuleScope(moduleId) {
                if (moduleId) {
                    contentArea.dataset.akeModule = moduleId;
                    document.body.dataset.akeModule = moduleId;
                } else {
                    delete contentArea.dataset.akeModule;
                    delete document.body.dataset.akeModule;
                }
            }

            function formatUpdatedAt(value) {
                const date = new Date(value);
                const locale = config.language === 'EN' ? 'en' : 'zh-CN';
                return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale, { hour12: false });
            }

            function parseUpdateTime(value) {
                const raw = String(value || '').trim();
                if (!raw) return null;
                const normalized = raw.replace(' ', 'T');
                const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
                const date = new Date(hasTimezone ? normalized : `${normalized}+08:00`);
                return Number.isNaN(date.getTime()) ? null : date;
            }

            function formatCountdown(milliseconds) {
                let seconds = Math.max(0, Math.floor(milliseconds / 1000));
                const days = Math.floor(seconds / 86400);
                seconds %= 86400;
                const hours = Math.floor(seconds / 3600);
                seconds %= 3600;
                const minutes = Math.floor(seconds / 60);
                seconds %= 60;
                return [
                    tr('common.time.days', { count: days }, `${days}d`),
                    tr('common.time.hours', { count: hours }, `${hours}h`),
                    tr('common.time.minutes', { count: minutes }, `${minutes}m`),
                    tr('common.time.seconds', { count: seconds }, `${seconds}s`)
                ].join(' ');
            }

            function renderHomeCountdown() {
                const home = document.getElementById('homeUpdateCountdown');
                if (!home) return;
                const version = window.akeVersion;
                const target = parseUpdateTime(version?.totime);
                if (!target) {
                    home.textContent = tr('version.unavailable');
                    return;
                }
                home.replaceChildren();
                const countdown = document.createElement('div');
                const remaining = formatCountdown(target.getTime() - Date.now());
                countdown.textContent = tr('version.countdown', {
                    time: remaining
                }, `Time until the next data update: ${remaining}`);
                home.appendChild(countdown);
                const description = String(version?.desc || '').trim();
                if (description) {
                    const reason = document.createElement('div');
                    reason.textContent = tr('version.updateReason', { desc: description }, `Update reason: ${description}`);
                    home.appendChild(reason);
                }
            }

            function startHomeCountdown() {
                renderHomeCountdown();
                if (!countdownTimer) countdownTimer = setInterval(renderHomeCountdown, 1000);
            }

            function renderVersionInfo() {
                const version = window.akeVersion;
                const selectedDataVersion = window.akeDataSource?.getState?.()?.selected;
                const box = document.getElementById('appVersionInfo');
                if (!version) {
                    if (box) box.textContent = tr('version.unavailable');
                    renderHomeCountdown();
                    return;
                }
                if (box) {
                    box.replaceChildren();
                    [
                        tr('version.appLine', { version: version.appversion }),
                        tr('version.gameLine', { version: selectedDataVersion?.gameVersion || '-' }),
                        tr('version.hotfixLine', { version: selectedDataVersion?.hotfixVersion || '-' }),
                        tr('version.updatedLine', { updatedAt: formatUpdatedAt(version.updatedAt), updatedBy: version.updatedBy ? ` (${version.updatedBy})` : '' })
                    ].forEach(line => {
                        const p = document.createElement('p');
                        p.textContent = line;
                        box.appendChild(p);
                    });
                }
                startHomeCountdown();
            }

            function canonicalResourceUrl(resource) {
                const url = new URL(resource, window.location.href);
                url.searchParams.delete('t');
                url.searchParams.delete('v');
                return url.href;
            }

            function resourcePathKey(resource) {
                return new URL(resource, window.location.href).pathname.replace(/^\/+/, '');
            }

            function rememberResourceVersion(storageKey, versions, key, value) {
                if (!value || versions[key] === value) return;
                versions[key] = value;
                storage.set(storageKey, JSON.stringify(versions));
            }

            async function fetchVersionedResource(resource, currentVersion, versions, changedVersions, storageKey, key) {
                const url = new URL(resource, window.location.href);
                if (currentVersion) url.searchParams.set('v', currentVersion);
                if (window.__akeForceRefreshTimestamp) url.searchParams.set('t', window.__akeForceRefreshTimestamp);
                const cache = window.__akeForceRefreshTimestamp
                    ? 'no-store'
                    : currentVersion && changedVersions.has(key)
                        ? 'reload'
                        : 'force-cache';
                const response = await (window.akeFetch || fetch)(url.href, { cache });
                if (response.ok) {
                    rememberResourceVersion(storageKey, versions, key, currentVersion);
                    changedVersions.delete(key);
                }
                return response;
            }

            function getScriptSource(src) {
                const pathKey = resourcePathKey(src);
                const currentVersion = configuredJsVersions[pathKey] || bootstrapVersion.appversion || '';
                const cacheKey = `${canonicalResourceUrl(src)}|${currentVersion}`;
                if (!scriptSourceCache.has(cacheKey)) {
                    const promise = fetchVersionedResource(
                        src,
                        currentVersion,
                        storedJsVersions,
                        changedJsVersions,
                        jsVersionStorageKey,
                        pathKey
                    ).then(response => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.text();
                    }).catch(error => {
                        scriptSourceCache.delete(cacheKey);
                        throw error;
                    });
                    scriptSourceCache.set(cacheKey, promise);
                }
                return scriptSourceCache.get(cacheKey);
            }

            async function executeModuleScript(sourceScript, prefetchedSource) {
                const script = document.createElement('script');
                Array.from(sourceScript.attributes).forEach(attr => {
                    if (attr.name !== 'src') script.setAttribute(attr.name, attr.value);
                });
                if (sourceScript.src) {
                    const source = await (prefetchedSource || getScriptSource(sourceScript.src));
                    script.textContent = `${source}\n//# sourceURL=${canonicalResourceUrl(sourceScript.src)}`;
                } else {
                    script.textContent = sourceScript.textContent;
                }
                sourceScript.parentNode.replaceChild(script, sourceScript);
            }

            async function loadModuleContent(module) {
                const generation = ++moduleLoadGeneration;
                if (module?.disabled === true) {
                    show404Page(false);
                    return false;
                }
                if (!module || !module.contentFile) {
                    window.AKEUI.setState(contentArea, {
                        state: 'error',
                        layout: 'page',
                        message: tr('errors.moduleContentMissing')
                    });
                    return false;
                }
                if (module.token && !isModuleUnlocked(module)) {
                    show404Page(false);
                    return false;
                }
                if (mountedModuleId === module.id) return { restored: false, reused: true };
                if (mountedModuleId !== module.id) stashMountedModule();
                if (moduleViewCache.has(module.id)) {
                    activateModuleScope(module.id);
                    const state = restoreStashedModule(module.id);
                    return { restored: true, routeId: state?.routeId || null };
                }
                window.AKEUI.setState(contentArea, {
                    state: 'loading',
                    layout: 'page',
                    title: tr('common.loadingModule'),
                    message: firstLoadTextTableHint()
                });
                try {
                    const currentVersion = configuredPluginVersions[module.id] || bootstrapVersion.appversion || '';
                    const cacheKey = `${module.id}|${canonicalResourceUrl(module.contentFile)}|${currentVersion}`;
                    if (!moduleHtmlCache.has(cacheKey)) {
                        moduleHtmlCache.set(cacheKey, fetchVersionedResource(
                            module.contentFile,
                            currentVersion,
                            storedPluginVersions,
                            changedPluginVersions,
                            pluginVersionStorageKey,
                            module.id
                        ).then(response => {
                            if (!response.ok) throw new Error(`HTTP ${response.status}`);
                            return response.text();
                        }).catch(error => {
                            moduleHtmlCache.delete(cacheKey);
                            throw error;
                        }));
                    }
                    const html = await moduleHtmlCache.get(cacheKey);
                    if (generation !== moduleLoadGeneration) return false;
                    const template = document.createElement('template');
                    template.innerHTML = html;
                    window.akeDataSource?.rewriteDomAssets?.(template.content);
                    if (template.content.querySelector('link[rel="stylesheet"], style')) {
                        throw new Error(`模块 ${module.id} 必须使用 AKEUI 共享主题模板，不能加载独立样式。`);
                    }
                    activateModuleScope(module.id);
                    contentArea.replaceChildren(template.content.cloneNode(true));
                    const scripts = Array.from(contentArea.querySelectorAll('script'));
                    const prefetchedScripts = new Map();
                    scripts.forEach(oldScript => {
                        if (oldScript.src) prefetchedScripts.set(oldScript, getScriptSource(oldScript.src));
                    });
                    await Promise.all(prefetchedScripts.values());
                    for (const oldScript of scripts) {
                        if (generation !== moduleLoadGeneration) return false;
                        await executeModuleScript(oldScript, prefetchedScripts.get(oldScript));
                    }
                    if (generation !== moduleLoadGeneration) return false;
                    window.AKESidebarResize?.mountModule(contentArea, module.id);
                    mountedModuleId = module.id;
                    moduleViewState?.activate(module.id);
                    dispatchModuleLifecycle('activate', module.id);
                    return { restored: false, reused: false };
                } catch (err) {
                    if (generation !== moduleLoadGeneration) return false;
                    window.AKEUI.setState(contentArea, {
                        state: 'error',
                        layout: 'page',
                        message: tr('errors.moduleLoad', { message: err.message })
                    });
                    return false;
                }
            }

            function sortModulesByPriority(modulesArray) {
                return modulesArray.sort((a, b) => {
                    const pa = a.priority !== undefined ? Number(a.priority) : 999;
                    const pb = b.priority !== undefined ? Number(b.priority) : 999;
                    return pa - pb;
                });
            }

            function filterModules(modules) {
                let filtered = modules.filter(m => m.id !== 'settings');
                if (!config.showHidden) {
                    filtered = filtered.filter(m => !m.hidden);
                }
                filtered = filtered.filter(m => !m.token || isModuleUnlocked(m));
                return filtered;
            }

            function applyFilterAndRender() {
                if (!modulesReady) return;
                const visibleModules = filterModules(allModules);
                renderModuleList(visibleModules);
                if (activeModuleId) {
                    const stillVisible = visibleModules.some(m => m.id === activeModuleId);
                    if (!stillVisible) {
                        showHomePage();
                    } else {
                        const activeItem = document.querySelector(`.module-item[data-id="${activeModuleId}"]`);
                        if (activeItem) activeItem.classList.add('active');
                    }
                }
            }

            function renderModuleList(modulesArray) {
                if (!modulesArray || modulesArray.length === 0) {
                    moduleListEl.innerHTML = `<div class="ake-ui-state" data-state="empty" data-density="compact">${tr('nav.noVisibleModules')}</div>`;
                    return;
                }
                const sorted = sortModulesByPriority(modulesArray);
                let html = '';
                sorted.forEach(mod => {
                    const icon = String(mod.icon || '').trim();
                    const navIcon = String(mod.navIcon || '').trim();
                    const textIcon = navIcon ? '' : icon;
                    const configuredScale = Number(mod.navIconScale);
                    const navIconScale = Number.isFinite(configuredScale)
                        ? Math.min(1.25, Math.max(0.75, configuredScale))
                        : 1;
                    const navIconStyle = navIconScale === 1 ? '' : ` style="--ake-icon-scale:${navIconScale}"`;
                    const hasIcon = Boolean(navIcon || textIcon);
                    const title = translateModuleField(mod, 'title');
                    const iconHtml = navIcon
                        ? `<img class="module-nav-icon" src="${navIcon}" alt="" aria-hidden="true" data-no-image-fallback${navIconStyle}>`
                        : textIcon ? `<span class="module-icon" aria-hidden="true">${textIcon}</span>` : '';
                    const hiddenMarker = mod.hidden
                        ? `<span class="module-hidden-marker" aria-hidden="true">${HIDDEN_MODULE_MARKER_ICON}</span>`
                        : '';
                    html += `
                        <div class="module-item" data-id="${mod.id}" data-has-icon="${hasIcon}">
                            <div class="module-title">
                                ${iconHtml}<span class="module-name">${title}</span>${hiddenMarker}
                            </div>
                        </div>
                    `;
                });
                moduleListEl.innerHTML = html;
                moduleListEl.querySelectorAll('.module-nav-icon').forEach(image => {
                    image.addEventListener('error', () => {
                        const item = image.closest('.module-item');
                        image.remove();
                        if (item) item.dataset.hasIcon = 'false';
                    }, { once: true });
                });
                document.querySelectorAll('.module-item').forEach(item => {
                    if (item.dataset.hasIcon === 'true') {
                        item.title = item.querySelector('.module-title')?.textContent.trim() || '';
                    }
                    item.addEventListener('click', async (e) => {
                        const id = item.dataset.id;
                        const module = allModules.find(m => m.id === id);
                        if (!module) return;
                        const loaded = await loadModuleContent(module);
                        if (!loaded) return;
                        document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        activeModuleId = id;
                        syncModuleNavigation(id, loaded);
                    });
                });
                if (activeModuleId) {
                    const activeItem = document.querySelector(`.module-item[data-id="${activeModuleId}"]`);
                    if (activeItem) activeItem.classList.add('active');
                }
            }

            function setTheme(themeName) {
                const requestedTheme = String(themeName || '').toLowerCase();
                const lowerTheme = ['light', 'yellow', 'dark'].includes(requestedTheme) ? requestedTheme : 'light';
                config.theme = lowerTheme;
                if (lowerTheme === 'light') {
                    themeLink.removeAttribute('href');
                    themeLink.disabled = true;
                } else {
                    const themeUrl = new URL(`theme/${lowerTheme}.css`, window.location.href);
                    if (window.akeVersion) {
                        const themeKey = themeUrl.pathname.replace(/^\/+/, '');
                        themeUrl.searchParams.set('v', window.akeVersion.cssversion?.[themeKey] || window.akeVersion.appversion);
                    }
                    if (window.__akeForceRefreshTimestamp) themeUrl.searchParams.set('t', window.__akeForceRefreshTimestamp);
                    themeLink.disabled = false;
                    themeLink.href = themeUrl.href;
                }
                storage.set('akedata-theme', lowerTheme);
                if (modalThemeSelect) modalThemeSelect.value = lowerTheme;
                window.AKEUI?.refreshSelect(modalThemeSelect);
                refreshRenderedRichTextStyles();
            }

            function initTheme() {
                const savedTheme = storage.get('akedata-theme', 'light');
                setTheme(savedTheme);
            }

            // 等级输入校验
            function validateLevelInput(input, defaultValue, maxLevel = 90) {
                if (!input || input.trim() === '') return defaultValue;
                const parts = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLevel);
                if (parts.length === 0) return defaultValue;
                const uniqueSorted = [...new Set(parts)].sort((a,b) => a-b);
                return uniqueSorted.join(',');
            }

            function updateTokenStatus() {
                const statusEl = document.getElementById('tokenStatus');
                if (!statusEl) return;
                const tokenCount = config.unlockedTokens.length;
                if (tokenCount === 0) {
                    statusEl.textContent = tr('settings.tokens.empty');
                } else {
                    statusEl.textContent = tr('settings.tokens.count', { count: tokenCount });
                }
            }

            function openSettings() {
                renderLanguageOptions();
                renderDataSourceSettings();
                if (modalLanguageSelect) modalLanguageSelect.value = config.language;
                modalThemeSelect.value = config.theme;
                window.AKEUI?.refreshSelect(modalLanguageSelect);
                window.AKEUI?.refreshSelect(modalThemeSelect);
                modalShowHiddenCheck.checked = config.showHidden;
                const modalShowExportCheck = document.getElementById('modalShowExportCheck');
                if (modalShowExportCheck) modalShowExportCheck.checked = config.showExportButton;
                if (modalShowVersionChanges) modalShowVersionChanges.checked = config.showVersionChanges;
                const modalKeepUrlSync = document.getElementById('modalKeepUrlSync');
                if (modalKeepUrlSync) modalKeepUrlSync.checked = config.keepUrlSync;
                modalLevelsEnabled.checked = config.levelSettings.enabled;
                modalCharacterLevels.value = config.levelSettings.characterLevels;
                modalWeaponLevels.value = config.levelSettings.weaponLevels;
                modalEnemyLevels.value = config.levelSettings.enemyLevels;

                const modalSkillLevels = document.getElementById('modalSkillLevels');
                if (modalSkillLevels) {
                    const arr = config.levelSettings.skillLevels;
                    const levels = [];
                    if (Array.isArray(arr)) {
                        arr.forEach((checked, idx) => { if (checked) levels.push(idx + 1); });
                    }
                    modalSkillLevels.value = levels.join(',');
                }

                const modalTokenInput = document.getElementById('modalTokenInput');
                if (modalTokenInput) {
                    modalTokenInput.value = '';
                }
                updateTokenStatus();

                settingsModal.hidden = false;
            }

            function closeSettingsModal() {
                const enabled = modalLevelsEnabled.checked;
                let charLevels = modalCharacterLevels.value;
                let weaponLevels = modalWeaponLevels.value;
                let enemyLevels = modalEnemyLevels.value;

                // 校验
                charLevels = validateLevelInput(charLevels, '1,20,40,60,80,90', 90);
                weaponLevels = validateLevelInput(weaponLevels, '1,20,40,60,80,90', 90);
                enemyLevels = validateLevelInput(enemyLevels, '1,20,40,60,80,90', 100); // 敌人最大等级假设100

                config.levelSettings.enabled = enabled;
                config.levelSettings.characterLevels = charLevels;
                config.levelSettings.weaponLevels = weaponLevels;
                config.levelSettings.enemyLevels = enemyLevels;

                const modalSkillLevels = document.getElementById('modalSkillLevels');
                let skillLevelsStr = modalSkillLevels ? modalSkillLevels.value : '1,9,10,11,12';
                skillLevelsStr = validateLevelInput(skillLevelsStr, '1,9,10,11,12', 12);
                const skillLevelNums = skillLevelsStr.split(',').map(s => parseInt(s.trim(), 10));
                config.levelSettings.skillLevels = Array.from({ length: 12 }, (_, i) => skillLevelNums.includes(i + 1));

                storage.set('akedata-levelSettings', JSON.stringify(config.levelSettings));

                const modalShowExportCheck = document.getElementById('modalShowExportCheck');
                if (modalShowExportCheck) {
                    config.showExportButton = modalShowExportCheck.checked;
                    storage.set('akedata-showExportButtonStable', config.showExportButton);
                }

                let requiresReload = false;
                if (modalShowVersionChanges) {
                    const wasShowingVersionChanges = config.showVersionChanges;
                    config.showVersionChanges = modalShowVersionChanges.checked;
                    storage.set('akedata-showVersionChanges', config.showVersionChanges);
                    requiresReload = wasShowingVersionChanges !== config.showVersionChanges;
                }

                const modalKeepUrlSync = document.getElementById('modalKeepUrlSync');
                if (modalKeepUrlSync) {
                    const wasSync = config.keepUrlSync;
                    config.keepUrlSync = modalKeepUrlSync.checked;
                    storage.set('akedata-keepUrlSync', config.keepUrlSync);
                    requiresReload = requiresReload || wasSync !== config.keepUrlSync;
                }

                if (modalDataVersionSelect && modalDataBaseUrl && window.akeDataSource) {
                    try {
                        const current = window.akeDataSource.getState();
                        const normalizedBase = new URL(modalDataBaseUrl.value.trim() || current.defaultBaseUrl, window.location.href).href.replace(/\/$/, '');
                        const selection = modalDataVersionSelect.value || 'latest';
                        if (normalizedBase !== current.baseUrl || selection !== current.selection) {
                            window.akeDataSource.configure({ baseUrl: normalizedBase, selection }).then(() => location.reload());
                            settingsModal.hidden = true;
                            return;
                        }
                    } catch (error) {
                        showToast(error.message, 'warning');
                        return;
                    }
                }
                
                // 主题
                const theme = modalThemeSelect.value;
                if (theme !== config.theme) {
                    setTheme(theme);
                }

                // 隐藏模块
                const showHidden = modalShowHiddenCheck.checked;
                if (showHidden !== config.showHidden) {
                    config.showHidden = showHidden;
                    document.documentElement.classList.toggle('ake-show-hidden', showHidden);
                    applyFilterAndRender();
                    storage.set('akedata-showHidden', showHidden);
                }

                window.dispatchEvent(new CustomEvent('globalConfigChanged', { detail: { config } }));
                settingsModal.hidden = true;
                if (requiresReload) location.reload();
            }

            async function loadModulesFromManifest() {
                try {
                    const response = await (window.akeFetch || fetch)('plugin/manifest.json');
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const manifest = await response.json();
                    if (!Array.isArray(manifest)) throw new Error('Invalid module manifest');
                    return manifest
                        .filter(m => m.id && m.title && m.contentFile)
                        .map(m => ({
                            ...m,
                            priority: m.priority !== undefined ? m.priority : 999,
                            hidden: m.hidden === true,
                            disabled: m.disabled === true,
                            token: m.token || null
                        }))
                        .filter(m => !m.disabled);
                } catch (err) {
                    window.AKEUI.setState(moduleListEl, {
                        state: 'error',
                        density: 'compact',
                        message: tr('errors.moduleManifestRead').replace(/<br\s*\/?>/gi, '\n')
                    });
                    return null;
                }
            }

            function isModuleUnlocked(module) {
                if (!module.token) return true;
                return config.unlockedTokens.includes(module.token);
            }

            window.hyperlinkConfig = {};
            window.textstyleConfig = {};

            const RAW_IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/';
            const IMAGE_PATH_PREFIXES = [
                ['weapon/full/', 'sprites/gachaweapon/'],
                ['weapon/iconbig/', 'sprites/itemiconbig/'],
                ['weapon/icon/', 'sprites/itemiconbig/'],
                ['item/itemiconbig/', 'sprites/itemiconbig/'],
                ['item/itemicon/', 'sprites/itemiconbig/'],
                ['item/itemtips/', 'sprites/itemtips/'],
                ['equip/iconbig/', 'sprites/itemiconbig/'],
                ['equip/icon/', 'sprites/itemiconbig/'],
                ['character/charremoteicon/', 'sprites/charremoteicon/'],
                ['character/charpic/', 'sprites/charpic/'],
                ['character/skillicon/', 'sprites/skillicon/'],
                ['character/spaceshipskillicon/', 'sprites/spaceshipskillicon/'],
                ['character/businesscardbg/', 'sprites/businesscardbg/'],
                ['character/charprofessionicon/', 'sprites/charprofessionicon/'],
                ['character/elementicon/', 'sprites/elementicon/'],
                ['character/imagepoaster/', 'textures/spaceship/imageposter/'],
                ['enemy/monstericonbig/', 'sprites/monstericonbig/'],
                ['enemy/monstericon/', 'sprites/monstericonbig/'],
                ['achievement/medaliconbig/', 'sprites/medaliconbig/'],
                ['activity/', 'sprites/activity/'],
                ['BuffIcon/', 'sprites/bufficon/'],
                ['bufficon/', 'sprites/bufficon/'],
                ['dungeon/', 'sprites/dungeon/'],
                ['TermIcon/', 'sprites/termicon/'],
                ['contingencycontract/', 'sprites/contingencycontract/']
            ];

            window.resolveImagePath = function(path) {
                const source = String(path || '').replace(/\\/g, '/');
                if (!source || /^(?:data:|blob:|https?:\/\/)/i.test(source)) return source;
                const absolute = source.startsWith('/') ? source : `/${source}`;
                if (absolute.startsWith(RAW_IMAGE_ROOT)) return absolute;
                if (!absolute.startsWith('/public/images/')) return absolute;
                const relative = absolute.slice('/public/images/'.length);
                for (const [legacy, current] of IMAGE_PATH_PREFIXES) {
                    if (relative.startsWith(legacy)) {
                        return `${RAW_IMAGE_ROOT}${current}${relative.slice(legacy.length)}`;
                    }
                }
                return absolute;
            };

            function resolveRichTextImageUrl(path) {
                const migrated = window.resolveImagePath(path);
                return window.akeDataSource?.resolveImageUrl(migrated) || migrated;
            }

            function normalizeTableImagePath(path) {
                if (!path) return '';
                const value = String(path).replace(/^\/?public\/images\//, '');
                return window.resolveImagePath(`/public/images/${value}${value.includes('.') ? '' : '.png'}`);
            }

            function normalizeHyperlinkTable(table) {
                return Object.fromEntries(Object.entries(table || {}).map(([id, row]) => [id, {
                    name: row.name?.text || '',
                    desc: row.desc?.text || '',
                    iconPath: normalizeTableImagePath(row.iconPath),
                    styleid: row.richTextId || ''
                }]));
            }

            function normalizeRichTextStyleTable(table) {
                const result = {};
                Object.entries(table || {}).forEach(([id, row]) => {
                    const style = { color: [], image: [], scale: [], mark: [] };
                    (row.preDef || []).slice(0, 2).forEach((definition, index) => {
                        const color = String(definition).match(/<color=([^>]+)>/);
                        const image = String(definition).match(/<image="([^"]+)"\s+scale=([0-9.]+)>/);
                        const mark = String(definition).match(/<mark=([^>]+)>/);
                        if (color) style.color[index] = color[1];
                        if (mark) style.mark[index] = mark[1];
                        if (image) {
                            style.image[index] = normalizeTableImagePath(image[1]);
                            style.scale[index] = Number(image[2]);
                        }
                    });
                    if (style.color.length || style.image.length || style.scale.length || style.mark.length) result[id] = style;
                });
                return result;
            }

            // RichTextStyleTable slots map to the browser themes used by the data site.
            function richTextStyleSlot() {
                return config.theme === 'dark' ? 1 : 0;
            }

            function richTextStyleValue(styleDef, field) {
                const values = styleDef?.[field];
                return Array.isArray(values) ? values[richTextStyleSlot()] ?? null : null;
            }

            function escapeRichTextAttribute(value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            function refreshRenderedRichTextStyles() {
                const textstyleCfg = window.textstyleConfig || {};
                document.querySelectorAll('[data-ake-rich-style-id]').forEach(element => {
                    const styleDef = textstyleCfg[element.dataset.akeRichStyleId];
                    if (!styleDef) return;
                    const color = richTextStyleValue(styleDef, 'color');
                    const mark = richTextStyleValue(styleDef, 'mark');
                    if (color) element.style.color = color;
                    else element.style.removeProperty('color');
                    if (mark) element.style.backgroundColor = mark;
                    else element.style.removeProperty('background-color');
                });
            }

            window.__akeRouter = {
                updateUrl(plugin, id) {
                    moduleViewState?.route(plugin, id);
                    if (!config.keepUrlSync) return;
                    const params = new URLSearchParams();
                    if (plugin) params.set('plugin', plugin);
                    if (id) params.set('id', id);
                    const qs = params.toString();
                    const newUrl = window.location.pathname + (qs ? '?' + qs : '');
                    const currentState = history.state && typeof history.state === 'object' ? history.state : {};
                    history.replaceState({ ...currentState, akeModuleSession: true }, '', newUrl);
                },
                clearUrl() {
                    if (!config.keepUrlSync) return;
                    history.replaceState(null, '', window.location.pathname);
                },
                stripUrl() {
                    history.replaceState(null, '', window.location.pathname);
                }
            };

            const MODULE_ROUTE_ALIASES = Object.freeze({
                weapon: 'v3_weapon',
                v2_weapon: 'v3_weapon',
                character: 'v3_character',
                v2_character: 'v3_character',
                enemy: 'v3_enemy',
                v2_enemy: 'v3_enemy',
                equip: 'v3_equip',
                v2_equip: 'v3_equip',
                item: 'v3_item',
                v2_item: 'v3_item',
                achievement: 'v3_achievement',
                dungeon: 'v3_dungeon',
                v2_dungeon: 'v3_dungeon',
                activity: 'v3_activity',
                cc: 'v3_cc',
                v2_cc: 'v3_cc',
                skill: 'v3_skill',
                skill_v2: 'v3_skill',
                buff: 'v3_buff'
            });

            function normalizeModuleRouteId(moduleId) {
                const normalized = String(moduleId || '');
                return MODULE_ROUTE_ALIASES[normalized] || normalized;
            }

            function replaceRouteQuery(urlParams) {
                const query = urlParams.toString();
                const currentState = history.state && typeof history.state === 'object' ? history.state : null;
                history.replaceState(currentState, '', window.location.pathname + (query ? `?${query}` : ''));
            }

            window.configLoaded = Promise.all([
                window.AKEV3.table('HyperlinkTextTable').then(normalizeHyperlinkTable).then(cfg => window.hyperlinkConfig = cfg).catch(() => {}),
                window.AKEV3.table('RichTextStyleTable').then(normalizeRichTextStyleTable).then(cfg => {
                    window.textstyleConfig = cfg;
                    refreshRenderedRichTextStyles();
                    return cfg;
                }).catch(() => {})
            ]);

            window.renderRawValueTip = function(displayValue, rawValue, variableName) {
                const details = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
                    ? rawValue
                    : { rawValue, value: rawValue, name: variableName, changed: false };
                if (details.rawValue === undefined || details.rawValue === null || details.rawValue === '') return String(displayValue);
                const escape = (s) => String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/\r\n?|\n/g, '&#10;');
                const displayNumber = value => {
                    if (!Number.isFinite(value)) return String(value);
                    if (Object.is(value, -0)) return '0';
                    return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(15)));
                };
                const displayRawValue = value => {
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'number') return displayNumber(value);
                    if (typeof value !== 'object') return String(value);
                    for (const key of ['value', 'valueFloat', 'valueDouble', 'valueInt', 'floatValue', 'paramValue', 'attrValue', 'text']) {
                        if (value[key] !== undefined && value[key] !== value) return displayRawValue(value[key]);
                    }
                    try { return JSON.stringify(value); } catch { return ''; }
                };
                const displayFormula = value => String(value).replace(
                    /(^|[^\w.])(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?=$|[^\w.])/gi,
                    (match, prefix, number) => `${prefix}${displayNumber(Number(number))}`
                );
                const rawText = displayRawValue(details.changed && details.expression ? details.expression : details.rawValue);
                let title;
                if (details.changed) {
                    const formulaFallbacks = config.language === 'CH'
                        ? { formula: '公式：{value}', expression: '表达式：{value}', bindings: '代入：{value}', result: '结果：{value}' }
                        : config.language === 'TC'
                            ? { formula: '公式：{value}', expression: '表達式：{value}', bindings: '代入：{value}', result: '結果：{value}' }
                            : { formula: 'Formula: {value}', expression: 'Expression: {value}', bindings: 'Values: {value}', result: 'Result: {value}' };
                    const lines = [];
                    if (details.name) lines.push(String(details.name));
                    lines.push(tr('common.rawValue', { value: rawText }));
                    if (details.formula) {
                        const formula = displayFormula(details.formula);
                        lines.push(tr('common.formula', { value: formula }, formulaFallbacks.formula.replace('{value}', formula)));
                    }
                    else if (details.expression) lines.push(tr('common.expression', { value: details.expression }, formulaFallbacks.expression.replace('{value}', details.expression)));
                    if (details.bindings && Object.keys(details.bindings).length) {
                        const bindings = Object.entries(details.bindings).map(([key, value]) => `${key}=${displayRawValue(value)}`).join(', ');
                        lines.push(tr('common.bindings', { value: bindings }, formulaFallbacks.bindings.replace('{value}', bindings)));
                    }
                    const resultText = displayRawValue(details.value ?? details.rawValue);
                    lines.push(tr('common.resultValue', { value: resultText }, formulaFallbacks.result.replace('{value}', resultText)));
                    title = lines.join('\n');
                } else {
                    title = details.name
                        ? tr('common.rawValueWithName', { name: details.name, value: rawText })
                        : tr('common.rawValue', { value: rawText });
                }
                return `<span class="raw-value-tip" role="button" tabindex="0" aria-expanded="false" data-raw-value-tip="${escape(title)}">${displayValue}</span>`;
            };

            const rawValueTooltip = document.createElement('div');
            rawValueTooltip.className = 'raw-value-popover ake-ui-popover';
            rawValueTooltip.dataset.position = 'manual';
            rawValueTooltip.dataset.placement = 'bottom';
            rawValueTooltip.setAttribute('role', 'tooltip');
            rawValueTooltip.setAttribute('aria-hidden', 'true');
            document.body.appendChild(rawValueTooltip);
            let rawValueAnchor = null;

            function closeRawValueTip() {
                if (rawValueAnchor) rawValueAnchor.setAttribute('aria-expanded', 'false');
                rawValueAnchor = null;
                rawValueTooltip.classList.remove('visible');
                rawValueTooltip.setAttribute('aria-hidden', 'true');
                rawValueTooltip.textContent = '';
            }

            function positionRawValueTip() {
                if (!rawValueAnchor?.isConnected) {
                    closeRawValueTip();
                    return;
                }
                const anchorRect = rawValueAnchor.getBoundingClientRect();
                const tooltipRect = rawValueTooltip.getBoundingClientRect();
                const gap = 10;
                const margin = 10;
                let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
                left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
                let top = anchorRect.bottom + gap;
                let placement = 'bottom';
                if (top + tooltipRect.height > window.innerHeight - margin && anchorRect.top >= tooltipRect.height + gap + margin) {
                    top = anchorRect.top - tooltipRect.height - gap;
                    placement = 'top';
                }
                rawValueTooltip.style.left = `${Math.round(left)}px`;
                rawValueTooltip.style.top = `${Math.max(margin, Math.round(top))}px`;
                rawValueTooltip.dataset.placement = placement;
                window.AKEUI?.positionPopoverArrow(rawValueTooltip, rawValueAnchor);
            }

            function openRawValueTip(anchor) {
                if (rawValueAnchor && rawValueAnchor !== anchor) rawValueAnchor.setAttribute('aria-expanded', 'false');
                rawValueAnchor = anchor;
                rawValueAnchor.setAttribute('aria-expanded', 'true');
                rawValueTooltip.textContent = anchor.dataset.rawValueTip || '';
                rawValueTooltip.classList.add('visible');
                rawValueTooltip.setAttribute('aria-hidden', 'false');
                positionRawValueTip();
            }

            document.addEventListener('click', event => {
                const anchor = event.target.closest('.raw-value-tip');
                if (anchor) {
                    event.stopPropagation();
                    openRawValueTip(anchor);
                    return;
                }
                if (!event.target.closest('.raw-value-popover')) closeRawValueTip();
            }, true);

            document.addEventListener('keydown', event => {
                const anchor = event.target.closest?.('.raw-value-tip');
                if (anchor && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openRawValueTip(anchor);
                } else if (event.key === 'Escape') {
                    closeRawValueTip();
                }
            });

            window.addEventListener('resize', positionRawValueTip);
            window.addEventListener('scroll', positionRawValueTip, true);

            window.parseText = function(text, baseImagePath = '/public/images/', depth = 0) {
                if (!text) return '';
                text = String(text).replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n?/g, '\n');
                let result = '';
                let i = 0;
                const len = text.length;
                const hyperlinkCfg = window.hyperlinkConfig || {};
                const textstyleCfg = window.textstyleConfig || {};

                while (i < len) {
                    if (text[i] === '\n') {
                        result += '<br>';
                        i++;
                    } else if (text[i] === '<') {
                        if (text.substr(i, 6) === '<image') {
                            const endIdx = text.indexOf('>', i);
                            if (endIdx === -1) { result += text[i]; i++; continue; }
                            const tagContent = text.substring(i + 1, endIdx);
                            const imgMatch = tagContent.match(/image="([^"]+)"\s*scale=([0-9.]+)/);
                            if (imgMatch) {
                                let path = imgMatch[1];
                                const scale = imgMatch[2];
                                if (!path.includes('.')) path += '.png';
                                const source = resolveRichTextImageUrl(`${baseImagePath}${path}`);
                                result += `<img src="${source}" style="transform: scale(${scale}); width: auto; height: 1em; display: inline-block; vertical-align: middle;" class="inline-icon">`;
                            }
                            i = endIdx + 1;
                            continue;
                        }
                        else if (text[i+1] === '@' || text[i+1] === '#') {
                            const prefix = text[i+1];
                            const tagNameEnd = text.indexOf('>', i);
                            if (tagNameEnd === -1) { result += text[i]; i++; continue; }
                            const tagName = text.substring(i+2, tagNameEnd);
                            let depthCounter = 1;
                            let pos = tagNameEnd + 1;
                            while (pos < len) {
                                if (text[pos] === '<') {
                                    if (text.substr(pos, 3) === '</>') {
                                        depthCounter--;
                                        if (depthCounter === 0) {
                                            const innerContent = text.substring(tagNameEnd + 1, pos);
                                            const renderedInner = window.parseText(innerContent, baseImagePath, depth + 1);
                                            let tagResult = '';
                                            if (prefix === '@') {
                                                const styleDef = textstyleCfg?.[tagName];
                                                if (!styleDef) {
                                                    tagResult = tagName.includes('info') ? `<span style="color: #999999;">${renderedInner}</span>` : renderedInner;
                                                } else {
                                                    const color = richTextStyleValue(styleDef, 'color');
                                                    const image = richTextStyleValue(styleDef, 'image');
                                                    const scale = richTextStyleValue(styleDef, 'scale') ?? 1;
                                                    const mark = richTextStyleValue(styleDef, 'mark');
                                                    const textStyle = `${color ? `color: ${color};` : ''}${mark ? `background-color: ${mark};` : ''}`;
                                                    const styleIdAttribute = ` data-ake-rich-style-id="${escapeRichTextAttribute(tagName)}"`;
                                                    if (image) {
                                                        tagResult = `<span class="textstyle-icon-text"><img src="${resolveRichTextImageUrl(image)}" style="transform: scale(${scale});" alt=""><span${styleIdAttribute} style="${textStyle}">${renderedInner}</span></span>`;
                                                    } else {
                                                        tagResult = textStyle ? `<span${styleIdAttribute} style="${textStyle}">${renderedInner}</span>` : renderedInner;
                                                    }
                                                }
                                            } else {
                                                if (depth >= 2) {
                                                    tagResult = renderedInner;
                                                } else {
                                                    const hyperDef = hyperlinkCfg?.[tagName];
                                                    if (hyperDef) {
                                                        const styleid = hyperDef.styleid;
                                                        const styleDef = styleid ? textstyleCfg?.[styleid] : null;
                                                        const color = richTextStyleValue(styleDef, 'color');
                                                        const styleImage = richTextStyleValue(styleDef, 'image');
                                                        const styleScale = richTextStyleValue(styleDef, 'scale') ?? 1;
                                                        const mark = richTextStyleValue(styleDef, 'mark');
                                                        const textStyle = `${color ? `color: ${color};` : ''}${mark ? `background-color: ${mark};` : ''}`;
                                                        const image = hyperDef.iconPath || styleImage;
                                                        const scale = hyperDef.iconPath ? 1.25 : styleScale;
                                                        const iconHtml = image
                                                            ? `<img src="${resolveRichTextImageUrl(image)}" style="transform: scale(${scale}); width: auto; height: 1em; display: inline-block; vertical-align: middle; margin-right: 0.15em;" alt="">`
                                                            : '';
                                                        const styleIdAttribute = styleid ? ` data-ake-rich-style-id="${escapeRichTextAttribute(styleid)}"` : '';
                                                        const linkHtml = `<span class="tag-hyperlink" data-tag-id="${tagName}"${styleIdAttribute}${textStyle ? ` style="${textStyle}"` : ''}>${renderedInner}</span>`;
                                                        tagResult = iconHtml
                                                            ? `<span class="textstyle-icon-text">${iconHtml}${linkHtml}</span>`
                                                            : linkHtml;
                                                    } else {
                                                        tagResult = renderedInner;
                                                    }
                                                }
                                            }
                                            result += tagResult;
                                            i = pos + 3;
                                            break;
                                        }
                                        pos += 3;
                                    } else if (text[pos+1] === '@' || text[pos+1] === '#' || text.substr(pos, 6) === '<image') {
                                        depthCounter++;
                                        pos++;
                                    } else {
                                        pos++;
                                    }
                                } else {
                                    pos++;
                                }
                            }
                            if (pos >= len) {
                                result += text.substring(i, tagNameEnd + 1);
                                i = tagNameEnd + 1;
                            }
                            continue;
                        } else {
                            result += text[i];
                            i++;
                        }
                    } else {
                        result += text[i];
                        i++;
                    }
                }
                return result;
            };

            // 富文本词条浮窗链
            let activeTooltipLevel = 0;
            let hyperlinkTooltipPinned = false;
            let hyperlinkTooltipCloseTimer = 0;
            let hyperlinkTooltipPositionFrame = 0;
            const hyperlinkTooltipStack = [tooltip1, tooltip2].map(element => ({
                element,
                anchor: null
            }));

            function cancelHyperlinkTooltipClose() {
                if (!hyperlinkTooltipCloseTimer) return;
                clearTimeout(hyperlinkTooltipCloseTimer);
                hyperlinkTooltipCloseTimer = 0;
            }

            function scheduleHyperlinkTooltipClose() {
                cancelHyperlinkTooltipClose();
                hyperlinkTooltipCloseTimer = window.setTimeout(() => {
                    hyperlinkTooltipCloseTimer = 0;
                    if (hyperlinkTooltipPinned) return;
                    if (hyperlinkTooltipStack.some(({ element }) => element.matches(':hover'))
                        || document.querySelector('.tag-hyperlink:hover')) return;
                    closeAllTooltips();
                }, 220);
            }

            function isInHyperlinkTooltip(node) {
                return node instanceof Node
                    && hyperlinkTooltipStack.some(({ element }) => element.contains(node));
            }

            function getHyperlinkTooltipLevel(node) {
                if (!node) return 0;
                const index = hyperlinkTooltipStack.findIndex(({ element }) => element.contains(node));
                return index + 1;
            }

            function bindHyperlinkTooltip(element) {
                if (element.dataset.hyperlinkTooltipBound === 'true') return;
                element.dataset.hyperlinkTooltipBound = 'true';
                element.addEventListener('pointerenter', cancelHyperlinkTooltipClose);
                element.addEventListener('pointerleave', event => {
                    const relatedTarget = event.relatedTarget;
                    if (isInHyperlinkTooltip(relatedTarget)
                        || relatedTarget?.closest?.('.tag-hyperlink')) return;
                    scheduleHyperlinkTooltipClose();
                });
            }

            function ensureHyperlinkTooltip(level) {
                while (hyperlinkTooltipStack.length < level) {
                    const nextLevel = hyperlinkTooltipStack.length + 1;
                    const element = document.createElement('div');
                    element.id = `hyperlink-tooltip-${nextLevel}`;
                    element.className = 'hyperlink-tooltip ake-ui-popover';
                    element.dataset.position = 'manual';
                    element.dataset.placement = 'bottom';
                    document.body.appendChild(element);
                    hyperlinkTooltipStack.push({ element, anchor: null });
                    bindHyperlinkTooltip(element);
                }
                return hyperlinkTooltipStack[level - 1];
            }

            function closeTooltipsFrom(level) {
                const startIndex = Math.max(0, level - 1);
                for (let index = startIndex; index < hyperlinkTooltipStack.length; index++) {
                    const entry = hyperlinkTooltipStack[index];
                    entry.element.style.display = 'none';
                    entry.anchor = null;
                }

                const retainedLength = Math.max(2, startIndex);
                if (hyperlinkTooltipStack.length > retainedLength) {
                    hyperlinkTooltipStack.splice(retainedLength).forEach(({ element }) => element.remove());
                }
                activeTooltipLevel = Math.min(activeTooltipLevel, startIndex);
            }

            function closeAllTooltips() {
                cancelHyperlinkTooltipClose();
                closeTooltipsFrom(1);
            }

            function positionHyperlinkTooltip(level, avoidDetailNav = false) {
                const entry = hyperlinkTooltipStack[level - 1];
                if (!entry) return;
                const { element: tooltip, anchor: anchorElement } = entry;
                if (!anchorElement?.isConnected || tooltip.style.display === 'none') {
                    if (anchorElement && !anchorElement.isConnected) closeTooltipsFrom(level);
                    return;
                }
                const rect = anchorElement.getBoundingClientRect();
                const scrollX = window.scrollX || window.pageXOffset;
                const scrollY = window.scrollY || window.pageYOffset;
                const tooltipRect = tooltip.getBoundingClientRect();
                const viewportMargin = 10;
                const gap = 10;
                let left = rect.left + scrollX + rect.width / 2 - tooltipRect.width / 2;
                left = Math.max(scrollX + viewportMargin, Math.min(left, scrollX + window.innerWidth - tooltipRect.width - viewportMargin));
                let top = rect.bottom + gap;
                let placement = 'bottom';
                const detailNavRect = document.querySelector('.character-detail-nav')?.getBoundingClientRect();
                const overlapsDetailNav = avoidDetailNav
                    && detailNavRect
                    && detailNavRect.bottom > 0
                    && detailNavRect.top < window.innerHeight
                    && top < detailNavRect.bottom
                    && top + tooltipRect.height > detailNavRect.top;
                const hasRoomAbove = rect.top - tooltipRect.height - gap >= viewportMargin;
                if ((overlapsDetailNav || top + tooltipRect.height > window.innerHeight - viewportMargin) && hasRoomAbove) {
                    top = rect.top - tooltipRect.height - gap;
                    placement = 'top';
                } else if (overlapsDetailNav) {
                    top = detailNavRect.bottom + gap;
                }
                tooltip.style.left = `${Math.round(left)}px`;
                tooltip.style.top = `${Math.round(top + scrollY)}px`;
                tooltip.dataset.placement = placement;
                window.AKEUI?.positionPopoverArrow(tooltip, anchorElement);
            }

            function scheduleHyperlinkTooltipPosition() {
                if (hyperlinkTooltipPositionFrame) return;
                hyperlinkTooltipPositionFrame = requestAnimationFrame(() => {
                    hyperlinkTooltipPositionFrame = 0;
                    for (let level = 1; level <= activeTooltipLevel; level++) {
                        positionHyperlinkTooltip(level);
                    }
                });
            }

            function showTooltip(level, anchorElement, hyperDef) {
                if (!hyperDef) return;
                const name = hyperDef.name || '';
                let desc = hyperDef.desc || '';
                desc = window.parseText(desc, '/public/images/');
                let iconHtml = '';
                if (hyperDef.iconPath) {
                    const iconFullPath = hyperDef.iconPath.includes('.') ? hyperDef.iconPath : hyperDef.iconPath + '.png';
                    iconHtml = `<img src="${resolveRichTextImageUrl(iconFullPath)}" style="width: 1.2em; height: 1.2em; vertical-align: middle; margin-right: 4px;">`;
                }
                const content = `
                    <div class="tooltip-name">${iconHtml}${name}</div>
                    <div class="tooltip-desc">${desc}</div>
                `;
                closeTooltipsFrom(level);
                const entry = ensureHyperlinkTooltip(level);
                const tooltip = entry.element;
                tooltip.innerHTML = content;
                tooltip.style.display = 'block';
                entry.anchor = anchorElement;
                activeTooltipLevel = level;
                positionHyperlinkTooltip(level, true);
            }

            function openHyperlinkTooltip(hyperlink, pinned = false) {
                const tagId = hyperlink.dataset.tagId;
                if (!tagId) return false;
                const hyperDef = window.hyperlinkConfig?.[tagId];
                if (!hyperDef) return false;
                const parentLevel = getHyperlinkTooltipLevel(hyperlink);

                cancelHyperlinkTooltipClose();
                if (parentLevel > 0) {
                    showTooltip(parentLevel + 1, hyperlink, hyperDef);
                } else {
                    if (!pinned && hyperlinkTooltipPinned) return false;
                    showTooltip(1, hyperlink, hyperDef);
                }
                if (pinned) hyperlinkTooltipPinned = true;
                return true;
            }

            document.addEventListener('pointerover', event => {
                const hyperlink = event.target.closest?.('.tag-hyperlink');
                if (!hyperlink || hyperlink.contains(event.relatedTarget)) return;
                openHyperlinkTooltip(hyperlink);
            });

            document.addEventListener('pointerout', event => {
                const hyperlink = event.target.closest?.('.tag-hyperlink');
                if (!hyperlink || hyperlink.contains(event.relatedTarget)) return;
                if (isInHyperlinkTooltip(event.relatedTarget)) return;
                scheduleHyperlinkTooltipClose();
            });

            hyperlinkTooltipStack.forEach(({ element }) => bindHyperlinkTooltip(element));
            window.addEventListener('scroll', scheduleHyperlinkTooltipPosition, true);
            window.addEventListener('resize', scheduleHyperlinkTooltipPosition);

            document.addEventListener('click', (e) => {
                const target = e.target;
                const hyperlink = target.closest('.tag-hyperlink');
                if (hyperlink) {
                    e.preventDefault();
                    openHyperlinkTooltip(hyperlink, true);
                    return;
                }
                if (isInHyperlinkTooltip(target)) return;
                hyperlinkTooltipPinned = false;
                closeAllTooltips();
            });

            function updateExportButtonVisibility() {
                const exportBtn = document.getElementById('exportButton');
                const mobileExportBtn = document.getElementById('mobileExportBtn');
                if (exportBtn) exportBtn.style.display = config.showExportButton ? 'flex' : 'none';
                if (mobileExportBtn) mobileExportBtn.style.display = config.showExportButton ? 'flex' : 'none';
            }

            async function initApp() {
                const urlParams = new URLSearchParams(window.location.search);
                const requestedPlugin = urlParams.get('plugin');
                const deepPlugin = normalizeModuleRouteId(requestedPlugin);
                const deepId = urlParams.get('id');
                if (requestedPlugin && deepPlugin !== requestedPlugin) {
                    urlParams.set('plugin', deepPlugin);
                }
                if (urlParams.has('t') || (requestedPlugin && deepPlugin !== requestedPlugin)) {
                    urlParams.delete('t');
                    replaceRouteQuery(urlParams);
                }

                await window.akeI18n?.ready;
                await window.akeDataSource?.ready;
                void window.akeServiceWorkerReady?.catch(error => {
                    console.warn('Service Worker 后台启动失败，页面继续使用普通数据请求。', error);
                });
                config.language = window.akeI18n?.getLanguage?.() || 'CH';
                renderLanguageOptions();
                renderDataSourceSettings();
                showHomePage(false, Boolean(deepPlugin));
                const preloadTextTable = () => window.AKEV3?.preloadTextTable?.().catch(error => {
                    console.warn('无法预加载当前语言文本映射表，进入模块时将重试。', error);
                });
                if (document.readyState === 'complete') setTimeout(preloadTextTable, 0);
                else window.addEventListener('load', preloadTextTable, { once: true });
                await window.akeVersionReady;
                renderVersionInfo();
                if (!deepPlugin) showUpdatedTip();
                initTheme();

                const savedLevelSettings = storage.get('akedata-levelSettings');
                if (savedLevelSettings) {
                    try {
                        const parsed = JSON.parse(savedLevelSettings);
                        config.levelSettings = parsed;
                        if (!config.levelSettings.skillLevels || config.levelSettings.skillLevels.length !== 12) {
                            config.levelSettings.skillLevels = Array(12).fill(true);
                        }
                    } catch (e) {}
                }

                const savedTokens = storage.get('akedata-unlockedTokens');
                if (savedTokens) {
                    try {
                        const parsed = JSON.parse(savedTokens);
                        if (Array.isArray(parsed)) {
                            config.unlockedTokens = parsed;
                        }
                    } catch (e) {}
                }

                const loadedModules = await loadModulesFromManifest();
                allModules = loadedModules || [];
                modulesReady = Boolean(loadedModules);
                applyFilterAndRender();
                void window.__akeRevealNavigationShell?.();

                const savedKeepUrlSync = storage.get('akedata-keepUrlSync');
                if (savedKeepUrlSync !== null) {
                    config.keepUrlSync = savedKeepUrlSync === 'true';
                }

                if (!config.keepUrlSync && (deepPlugin || deepId)) {
                    window.__akeRouter.stripUrl();
                }

                if (deepPlugin && !modulesReady) {
                    window.AKEUI.setState(contentArea, {
                        state: 'error',
                        layout: 'page',
                        message: tr('errors.moduleManifestRead')
                    });
                } else if (deepPlugin) {
                    const module = allModules.find(m => m.id === deepPlugin);
                    if (module) {
                        if ((module.hidden && !config.showHidden) || (module.token && !isModuleUnlocked(module))) {
                            show404Page(false);
                        } else {
                            window.__deepLinkId = deepId || null;
                            if (deepId) {
                                window.__akeRouter.onDeepLinkNotFound = function(notFoundId, isHidden) {
                                    show404Page(isHidden);
                                };
                            }
                            const loaded = await loadModuleContent(module);
                            if (!loaded) return;
                            activeModuleId = deepPlugin;
                            document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
                            const sidebarItem = document.querySelector(`.module-item[data-id="${deepPlugin}"]`);
                            if (sidebarItem) sidebarItem.classList.add('active');
                            if (config.keepUrlSync) {
                                window.__akeRouter.updateUrl(deepPlugin, deepId);
                            }
                        }
                    } else {
                        show404Page(false);
                    }
                }

                settingsButton.addEventListener('click', openSettings);
                closeSettings.addEventListener('click', closeSettingsModal);
                window.addEventListener('click', (e) => {
                    if (e.target === settingsModal) closeSettingsModal();
                });

                // 重置按钮
                const resetBtn = document.getElementById('resetSettingsBtn');
                if (resetBtn) {
                    resetBtn.addEventListener('click', () => {
                        window.AKESidebarResize?.resetAll();
                        document.getElementById('modalLevelsEnabled').checked = true;
                        document.getElementById('modalCharacterLevels').value = '1,20,40,60,80,90';
                        document.getElementById('modalWeaponLevels').value = '1,20,40,60,80,90';
                        document.getElementById('modalEnemyLevels').value = '1,20,40,60,80,90';
                        document.getElementById('modalSkillLevels').value = '1,9,10,11,12';
                        document.getElementById('modalThemeSelect').value = 'light';
                        document.getElementById('modalShowHiddenCheck').checked = false;
                        document.getElementById('modalShowExportCheck').checked = true;
                        document.getElementById('modalShowVersionChanges').checked = false;
                        document.getElementById('modalKeepUrlSync').checked = true;
                        const currentDataSource = window.akeDataSource?.getState?.();
                        if (modalDataBaseUrl && currentDataSource) modalDataBaseUrl.value = currentDataSource.defaultBaseUrl;
                        if (modalDataVersionSelect) modalDataVersionSelect.value = 'latest';
                        const resetTokenInput = document.getElementById('modalTokenInput');
                        if (resetTokenInput) resetTokenInput.value = '';
                        config.unlockedTokens = [];
                        storage.remove('akedata-unlockedTokens');
                        updateTokenStatus();
                        closeSettingsModal(); // 立即应用
                    });
                }

                const forceRefreshCacheBtn = document.getElementById('forceRefreshCacheBtn');
                if (forceRefreshCacheBtn) {
                    forceRefreshCacheBtn.addEventListener('click', async () => {
                        forceRefreshCacheBtn.disabled = true;
                        forceRefreshCacheBtn.textContent = tr('settings.cache.refreshing', null, '正在清理缓存...');
                        await window.akeDataCache?.forceRefresh?.();
                    });
                }

                const resetDataSourceBtn = document.getElementById('resetDataSourceBtn');
                if (resetDataSourceBtn) {
                    resetDataSourceBtn.addEventListener('click', () => {
                        const current = window.akeDataSource?.getState?.();
                        if (modalDataBaseUrl && current) modalDataBaseUrl.value = current.defaultBaseUrl;
                        if (modalDataVersionSelect) {
                            modalDataVersionSelect.value = 'latest';
                            window.AKEUI?.refreshSelect(modalDataVersionSelect);
                        }
                    });
                }

                // 令牌提交按钮
                const tokenSubmitBtn = document.getElementById('tokenSubmitBtn');
                if (tokenSubmitBtn) {
                    tokenSubmitBtn.addEventListener('click', () => {
                        const input = document.getElementById('modalTokenInput');
                        if (!input) return;
                        const raw = input.value.trim();
                        if (!raw) {
                            showToast(tr('settings.tokens.enterPrompt'), 'warning');
                            return;
                        }
                        const newTokens = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                        const uniqueNew = [...new Set(newTokens)];
                        const existingSet = new Set(config.unlockedTokens);
                        let addedCount = 0;
                        uniqueNew.forEach(t => {
                            if (!existingSet.has(t)) {
                                config.unlockedTokens.push(t);
                                existingSet.add(t);
                                addedCount++;
                            }
                        });
                        if (addedCount > 0) {
                            storage.set('akedata-unlockedTokens', JSON.stringify(config.unlockedTokens));
                            applyFilterAndRender();
                            window.dispatchEvent(new CustomEvent('globalConfigChanged', { detail: { config } }));
                            showToast(tr('settings.tokens.added', { count: addedCount }), 'info');
                        } else {
                            showToast(tr('settings.tokens.duplicate'), 'warning');
                        }
                        input.value = '';
                        updateTokenStatus();
                    });
                }

                // 令牌清除按钮
                const tokenClearAllBtn = document.getElementById('tokenClearAllBtn');
                if (tokenClearAllBtn) {
                    tokenClearAllBtn.addEventListener('click', () => {
                        if (config.unlockedTokens.length === 0) {
                            showToast(tr('settings.tokens.noneSaved'), 'warning');
                            return;
                        }
                        const count = config.unlockedTokens.length;
                        config.unlockedTokens = [];
                        storage.remove('akedata-unlockedTokens');
                        applyFilterAndRender();
                        window.dispatchEvent(new CustomEvent('globalConfigChanged', { detail: { config } }));
                        showToast(tr('settings.tokens.cleared', { count }), 'info');
                        updateTokenStatus();
                    });
                }

                modalThemeSelect.addEventListener('change', (e) => setTheme(e.target.value));
                modalLanguageSelect?.addEventListener('change', (e) => {
                    window.akeI18n?.setLanguage(e.target.value);
                });
                modalShowHiddenCheck.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        const confirmed = confirm(tr('settings.showHiddenConfirm'));
                        if (!confirmed) {
                            e.target.checked = false;
                            return;
                        }
                    }
                    config.showHidden = e.target.checked;
                    document.documentElement.classList.toggle('ake-show-hidden', config.showHidden);
                    applyFilterAndRender();
                    storage.set('akedata-showHidden', config.showHidden);
                    window.dispatchEvent(new CustomEvent('globalConfigChanged', { detail: { showHidden: config.showHidden } }));
                });

                document.getElementById('exportButton').addEventListener('click', async (event) => {
                    const contentArea = document.getElementById('contentArea');
                    if (!contentArea) return;
                    const exportControl = event.currentTarget;
                    exportControl.dataset.exportStatus = 'rendering';
                    exportControl.setAttribute('aria-busy', 'true');

                    // 获取文件名（优先使用详情标题）
                    let title = tr('home.exportFallback');
                    const possibleSelectors = [
                        '.ake-ui-detail-title', '.ake-ui-page__header h2', '.ake-ui-card__title',
                        '.ake-ui-section__title', '.article-content h1', '.article-content h2'
                    ];
                    for (const sel of possibleSelectors) {
                        const el = contentArea.querySelector(sel);
                        if (el && el.textContent.trim()) {
                            title = el.textContent.trim();
                            break;
                        }
                    }
                    if (title === tr('home.exportFallback') && activeModuleId) {
                        const mod = allModules.find(m => m.id === activeModuleId);
                         if (mod?.title) title = translateModuleField(mod, 'title');
                    }
                    title = title.replace(/[/?<>\\:*|"]/g, '_');
                    exportControl.dataset.exportFilename = title + '.png';

                    try {
                        const exportArea = Math.max(contentArea.scrollWidth, contentArea.clientWidth) * Math.max(contentArea.scrollHeight, contentArea.clientHeight);
                        const canvas = await html2canvas(contentArea, {
                            scale: exportArea > 8_000_000 ? 1 : 2,
                            useCORS: true,
                            logging: false,
                            allowTaint: false,
                            imageTimeout: 8000,
                            scrollY: 0,
                            onclone: (clonedDoc, element) => {
                                clonedDoc.querySelectorAll('.ake-sidebar-resize-handle').forEach(handle => handle.remove());
                                // 移除左侧栏和内部列
                                const globalSidebar = clonedDoc.querySelector('.sidebar');
                                if (globalSidebar) globalSidebar.remove();
                                const leftColumns = clonedDoc.querySelectorAll('.ake-ui-directory__sidebar, .left-column, .weapon-list');
                                leftColumns.forEach(col => col.remove());
                                const mobileBtns = clonedDoc.querySelectorAll('.ake-ui-directory__mobile-button, .ake-ui-directory__mobile-overlay, .ake-ui-toc__toggle, .mobile-list-btn, [class*="-mobile-btn"], [class*="-mobile-list-button"]');
                                mobileBtns.forEach(btn => btn.remove());
                            
                                // 调整布局
                                const app = clonedDoc.querySelector('.app');
                                if (app) {
                                    app.style.display = 'block';
                                    app.style.height = 'auto';
                                    app.style.overflow = 'visible';
                                }
                                const mainContent = clonedDoc.querySelector('.main-content');
                                if (mainContent) {
                                    mainContent.style.height = 'auto';
                                    mainContent.style.overflow = 'visible';
                                    mainContent.style.padding = '0';
                                }
                                const moduleViews = clonedDoc.querySelectorAll('.ake-ui-directory, .character-module, .weapon-module, .dungeon-module');
                                moduleViews.forEach(m => {
                                    m.style.display = 'block';
                                    m.style.height = 'auto';
                                    m.style.minHeight = '0';
                                    m.style.overflow = 'visible';
                                });

                                const detailAreas = clonedDoc.querySelectorAll('.ake-ui-directory__content, .weapon-detail, .character-detail');
                                detailAreas.forEach(detail => {
                                    detail.style.width = '100%';
                                    detail.style.maxWidth = 'none';
                                    detail.style.height = 'auto';
                                    detail.style.maxHeight = 'none';
                                    detail.style.overflow = 'visible';
                                });
                            
                                element.style.margin = '0';
                                element.style.padding = '0';
                                element.style.overflow = 'visible';
                                element.style.height = 'auto';
                            
                                clonedDoc.body.style.margin = '0';
                                clonedDoc.body.style.padding = '0';
                            }
                        });
                    
                        // ========== 添加覆盖水印（30% 透明度） ==========
                        const ctx = canvas.getContext('2d');
                        ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
                        ctx.fillStyle = 'rgba(150, 150, 150, 0.1)'; // 30% 不透明度
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                    
                        const stepX = 800;  // 水平间距
                        const stepY = 600;  // 垂直间距
                        const angle = -0.5; // 旋转角度（弧度）
                    
                        for (let y = 50; y < canvas.height; y += stepY) {
                            for (let x = 50; x < canvas.width; x += stepX) {
                                ctx.save();
                                ctx.translate(x, y);
                                ctx.rotate(angle);
                                ctx.fillText('AKEData.wiki', 0, 0);
                                ctx.restore();
                            }
                        }
                    
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                        if (!blob) throw new Error('无法生成 PNG 文件');
                        const objectUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = title + '.png';
                        link.href = objectUrl;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                        exportControl.dataset.exportStatus = 'complete';
                    } catch (err) {
                        exportControl.dataset.exportStatus = 'error';
                        alert(tr('errors.exportFailed', { message: err.message }));
                    } finally {
                        exportControl.removeAttribute('aria-busy');
                    }
                });

                const savedShowExport = storage.get('akedata-showExportButtonStable');
                if (savedShowExport !== null) {
                    config.showExportButton = savedShowExport === 'true';
                }
                updateExportButtonVisibility();

                window.addEventListener('globalConfigChanged', (e) => {
                    updateExportButtonVisibility();
                });

                const savedShowHidden = storage.get('akedata-showHidden');
                if (savedShowHidden !== null) {
                    config.showHidden = savedShowHidden === 'true';
                    document.documentElement.classList.toggle('ake-show-hidden', config.showHidden);
                    applyFilterAndRender();
                }
            }

            window.akeData = {
                setTheme,
                getLanguage: () => config.language,
                setLanguage: language => window.akeI18n?.setLanguage(language) || false,
                t: (key, params, fallback) => window.akeI18n?.t(key, params, fallback) ?? fallback ?? key,
                translateDOM: root => window.akeI18n?.translateDOM(root),
                toggleShowHidden: (val) => {
                    config.showHidden = val;
                    document.documentElement.classList.toggle('ake-show-hidden', val);
                    applyFilterAndRender();
                    storage.set('akedata-showHidden', val);
                    if (modalShowHiddenCheck) modalShowHiddenCheck.checked = val;
                },
                getConfig: () => ({ ...config }),
                getLevelSettings: () => ({ ...config.levelSettings }),
                showHomePage,
                isTokenUnlocked: (token) => {
                    if (!token) return true;
                    return config.unlockedTokens.includes(token);
                },
                getUnlockedTokens: () => [...config.unlockedTokens]
            };
            brandHome.addEventListener('click', showHomePage);
            initApp().catch(error => {
                void window.__akeRevealNavigationShell?.({ waitForImages: false });
                window.AKEUI?.setState(contentArea, {
                    state: 'error',
                    layout: 'page',
                    message: tr('errors.startup', { message: error.message }, `Startup failed: ${error.message}`)
                });
                console.error('应用初始化失败。', error);
            });
        })();

        var _hmt = _hmt || [];
        (function () {
            var hm = document.createElement("script");
            hm.src = "https://hm.baidu.com/hm.js?d4e7ab5e1c4546176ca165a6dd69fada";
            var s = document.getElementsByTagName("script")[0];
            s.parentNode.insertBefore(hm, s);
        })();
