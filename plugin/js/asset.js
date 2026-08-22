(function () {
    'use strict';

    const MODULE_ID = 'asset';
    const ASSET_DATA_ORIGIN = 'https://data.akedata.wiki';
    const SEARCH_DELAY = 160;
    const SEARCH_RESULT_LIMIT = 160;
    const RENDER_BATCH_SIZE = 72;
    const root = document.getElementById('akeAssetModule');
    if (!root || !window.akeAssetIndex) return;

    window.__akeAssetController?.destroy?.();

    const t = window.akeI18n?.scope?.('modules.asset') || ((key, params, fallback) => fallback ?? key);
    const events = new AbortController();
    const elements = {
        sidebarMeta: document.getElementById('akeAssetSidebarMeta'),
        home: document.getElementById('akeAssetHome'),
        up: document.getElementById('akeAssetUp'),
        search: document.getElementById('akeAssetSearch'),
        directory: document.getElementById('akeAssetDirectory'),
        content: document.getElementById('akeAssetContent'),
        mobileButton: document.getElementById('akeAssetMobileButton'),
        mobileOverlay: document.getElementById('akeAssetMobileOverlay'),
        mobileClose: document.getElementById('akeAssetMobileClose'),
        mobileHome: document.getElementById('akeAssetMobileHome'),
        mobileUp: document.getElementById('akeAssetMobileUp'),
        mobileSearch: document.getElementById('akeAssetMobileSearch'),
        mobileDirectory: document.getElementById('akeAssetMobileDirectory')
    };
    const state = {
        index: null,
        tree: null,
        searchEntries: [],
        searchResults: [],
        searchLimited: false,
        expanded: new Set(['images', 'json']),
        location: [],
        query: '',
        selectedFileKey: '',
        searchTimer: 0,
        renderToken: 0,
        renderObserver: null,
        disposed: false
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[character]);
    }

    function formatBytes(value) {
        const size = Number(value) || 0;
        if (size < 1024) return `${size} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let amount = size;
        let unit = -1;
        while (amount >= 1024 && unit < units.length - 1) {
            amount /= 1024;
            unit += 1;
        }
        return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`;
    }

    function naturalCompare(a, b) {
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    }

    function normalizeSearch(value) {
        return String(value || '').normalize('NFKC').toLocaleLowerCase();
    }

    function safeParts(path) {
        const parts = String(path || '').replace(/\\/g, '/').split('/');
        if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || /[\r\n]/.test(part))) {
            throw new Error('索引路径不安全');
        }
        return parts;
    }

    function encodePath(parts) {
        return parts.map(encodeURIComponent).join('/');
    }

    function datasetPath(dataset) {
        return dataset === 'images' ? 'public/images' : 'public/Json';
    }

    function fileUrl(dataset, relative) {
        return `${ASSET_DATA_ORIGIN}/${datasetPath(dataset)}/${encodePath(safeParts(relative))}`;
    }

    function isImage(relative) {
        return /\.(?:png|jpe?g|webp|gif|avif|bmp|ico)$/i.test(relative);
    }

    function locationKey(location) {
        return location.join('/');
    }

    function fileKey(file) {
        return `${file.dataset}/${file.relative}`;
    }

    function entryPath(entry) {
        if (entry.type === 'directory') return entry.path;
        return `${datasetPath(entry.dataset)}/${entry.relative}`;
    }

    function yieldToMain() {
        return new Promise(resolve => window.setTimeout(resolve, 0));
    }

    function makeDirectory(dataset, name, parts) {
        const location = [dataset, ...parts];
        const path = [datasetPath(dataset), ...parts].join('/');
        return {
            type: 'directory', dataset, name, parts, location,
            key: locationKey(location), path,
            searchKey: normalizeSearch(`${name} ${path}`),
            children: new Map(), files: [],
            totalFiles: 0, totalImages: 0, totalBytes: 0,
            directImages: 0, directBytes: 0,
            sortedChildren: null, sortedItems: null
        };
    }

    function makeFile(dataset, relative, record, parent) {
        const parts = safeParts(relative);
        const name = parts.at(-1);
        const path = `${datasetPath(dataset)}/${relative}`;
        return {
            type: 'file', dataset, relative, parent, name,
            searchKey: normalizeSearch(`${name} ${path}`), record,
            image: dataset === 'images' && isImage(relative)
        };
    }

    async function makeTree(index) {
        const roots = new Map();
        const searchEntries = [];
        let processed = 0;
        for (const dataset of ['images', 'json']) {
            const datasetName = dataset === 'images' ? 'public / images' : 'public / Json';
            const datasetRoot = makeDirectory(dataset, datasetName, []);
            roots.set(dataset, datasetRoot);
            searchEntries.push(datasetRoot);

            const records = index.datasets?.[dataset]?.files || {};
            for (const relative in records) {
                if (!Object.prototype.hasOwnProperty.call(records, relative)) continue;
                const record = records[relative];
                const parts = safeParts(relative);
                if (dataset === 'json' && parts.at(-1).toLowerCase() === 'manifest.json') continue;

                let current = datasetRoot;
                const ancestors = [datasetRoot];
                parts.slice(0, -1).forEach((part, partIndex) => {
                    if (!current.children.has(part)) {
                        const directory = makeDirectory(dataset, part, parts.slice(0, partIndex + 1));
                        current.children.set(part, directory);
                        searchEntries.push(directory);
                    }
                    current = current.children.get(part);
                    ancestors.push(current);
                });

                const file = makeFile(dataset, relative, record, current);
                current.files.push(file);
                current.directBytes += Number(record?.size || 0);
                if (file.image) current.directImages += 1;
                searchEntries.push(file);
                const size = Number(record?.size || 0);
                ancestors.forEach(directory => {
                    directory.totalFiles += 1;
                    directory.totalBytes += size;
                    if (file.image) directory.totalImages += 1;
                });
                processed += 1;
                if (processed % 2500 === 0) {
                    await yieldToMain();
                    if (state.disposed) return { roots, searchEntries };
                }
            }
        }
        return { roots, searchEntries };
    }

    function currentNode() {
        if (!state.location.length) {
            const roots = Array.from(state.tree.values());
            return {
                type: 'directory', name: t('root', null, '根目录'), parts: [], location: [],
                children: state.tree, files: [],
                totalFiles: roots.reduce((sum, node) => sum + node.totalFiles, 0),
                totalImages: roots.reduce((sum, node) => sum + node.totalImages, 0),
                totalBytes: roots.reduce((sum, node) => sum + node.totalBytes, 0)
            };
        }
        let node = state.tree.get(state.location[0]);
        for (const part of state.location.slice(1)) node = node?.children.get(part);
        return node || null;
    }

    function directItems(node) {
        if (!node) return [];
        if (!node.sortedItems) {
            const folders = Array.from(node.children.values()).sort((a, b) => naturalCompare(a.name, b.name));
            const files = node.files.slice().sort((a, b) => {
                if (a.image !== b.image) return a.image ? -1 : 1;
                return naturalCompare(a.name, b.name);
            });
            node.sortedItems = [...folders, ...files];
        }
        const items = node.sortedItems.slice();
        if (state.selectedFileKey) {
            const selectedIndex = items.findIndex(item => item.type === 'file' && fileKey(item) === state.selectedFileKey);
            if (selectedIndex > 0) items.unshift(...items.splice(selectedIndex, 1));
        }
        return items;
    }

    function directoryLabel(node) {
        const folders = node ? node.children.size : 0;
        const isVirtualRoot = node && !node.dataset;
        const files = isVirtualRoot ? node.totalFiles : (node?.files.length || 0);
        const images = isVirtualRoot ? node.totalImages : (node?.directImages || 0);
        const bytes = isVirtualRoot ? node.totalBytes : (node?.directBytes || 0);
        return `${t('counts.folders', { count: folders }, `${folders} 个文件夹`)} · ${t('counts.files', { count: files }, `${files} 个文件`)} · ${t('counts.images', { count: images }, `${images} 张图片`)} · ${formatBytes(bytes)}`;
    }

    function nodePath(node) {
        if (!node?.dataset) return t('root', null, '根目录');
        return [datasetPath(node.dataset), ...node.parts].join('/');
    }

    function sortedDirectories(node) {
        if (!node.sortedChildren) node.sortedChildren = Array.from(node.children.values()).sort((a, b) => naturalCompare(a.name, b.name));
        return node.sortedChildren;
    }

    function updateSidebarMeta() {
        if (state.query) {
            elements.sidebarMeta.textContent = state.searchLimited
                ? t('directory.resultLimit', { count: SEARCH_RESULT_LIMIT }, `仅显示前 ${SEARCH_RESULT_LIMIT} 项`)
                : t('counts.results', { count: state.searchResults.length }, `找到 ${state.searchResults.length} 项`);
            elements.sidebarMeta.removeAttribute('title');
            return;
        }
        if (state.index) {
            const value = `${t('schema', null, 'schema')} ${state.index.schemaVersion} · ${t('revision', null, 'revision')} ${state.index.revision}`;
            elements.sidebarMeta.textContent = value;
            elements.sidebarMeta.title = value;
        }
    }

    function updateNavigationControls() {
        const atRoot = state.location.length === 0;
        [elements.up, elements.mobileUp].forEach(button => { if (button) button.disabled = atRoot; });
        [elements.home, elements.mobileHome].forEach(button => {
            if (button) button.toggleAttribute('aria-current', atRoot);
        });
    }

    function appendTreeDirectory(target, node, depth) {
        const branch = document.createElement('div');
        branch.className = 'asset-tree-branch';
        const row = document.createElement('div');
        row.className = 'asset-tree-row';
        row.style.setProperty('--asset-tree-depth', depth);

        const hasChildren = node.children.size > 0;
        const expanded = hasChildren && state.expanded.has(node.key);
        if (hasChildren) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'asset-tree-toggle';
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.setAttribute('aria-label', node.name);
            toggle.addEventListener('click', () => {
                if (state.expanded.has(node.key)) state.expanded.delete(node.key);
                else state.expanded.add(node.key);
                renderDirectoryLists();
            });
            row.appendChild(toggle);
        } else {
            const spacer = document.createElement('span');
            spacer.className = 'asset-tree-toggle-spacer';
            spacer.setAttribute('aria-hidden', 'true');
            row.appendChild(spacer);
        }

        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'ake-ui-tree__item asset-tree-link';
        if (locationKey(state.location) === node.key) {
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');
        }
        const title = document.createElement('span');
        title.className = 'ake-ui-tree__item-title';
        title.textContent = node.name;
        const count = document.createElement('span');
        count.className = 'ake-ui-tree__item-subtitle';
        count.textContent = String(node.totalFiles);
        link.append(title, count);
        link.addEventListener('click', () => navigate(node.location));
        row.appendChild(link);
        branch.appendChild(row);

        if (expanded) {
            const children = document.createElement('div');
            children.className = 'asset-tree-children';
            sortedDirectories(node).forEach(child => appendTreeDirectory(children, child, depth + 1));
            branch.appendChild(children);
        }
        target.appendChild(branch);
    }

    function renderSearchResults(target) {
        const header = document.createElement('div');
        header.className = 'ake-ui-tree__section-header';
        const heading = document.createElement('span');
        heading.textContent = t('directory.searchResults', null, '搜索结果');
        const count = document.createElement('span');
        count.textContent = state.searchLimited ? `${SEARCH_RESULT_LIMIT}+` : String(state.searchResults.length);
        header.append(heading, count);
        target.appendChild(header);

        if (!state.searchResults.length) {
            const empty = document.createElement('div');
            empty.className = 'ake-ui-state';
            empty.dataset.density = 'compact';
            empty.textContent = t('empty.search', null, '搜索无结果');
            target.appendChild(empty);
            return;
        }

        state.searchResults.forEach(entry => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ake-ui-tree__item asset-search-result';
            const kind = document.createElement('span');
            kind.className = 'asset-search-result__kind';
            kind.textContent = entry.type === 'directory' ? 'DIR' : (entry.name.split('.').pop() || 'FILE').slice(0, 5).toUpperCase();
            const copy = document.createElement('span');
            copy.className = 'asset-search-result__copy';
            const title = document.createElement('span');
            title.className = 'ake-ui-tree__item-title';
            title.textContent = entry.name;
            const path = document.createElement('span');
            path.className = 'ake-ui-tree__item-subtitle';
            path.textContent = entryPath(entry);
            copy.append(title, path);
            button.append(kind, copy);
            button.addEventListener('click', () => {
                if (entry.type === 'directory') navigate(entry.location);
                else navigate(entry.parent.location, { selectedFileKey: fileKey(entry) });
            });
            target.appendChild(button);
        });
    }

    function renderDirectoryList(target) {
        target.replaceChildren();
        if (state.query) {
            renderSearchResults(target);
            return;
        }
        const header = document.createElement('div');
        header.className = 'ake-ui-tree__section-header';
        const label = document.createElement('span');
        label.textContent = t('directory.title', null, '资产目录');
        const count = document.createElement('span');
        count.textContent = String(state.tree.size);
        header.append(label, count);
        target.appendChild(header);
        state.tree.forEach(node => appendTreeDirectory(target, node, 0));
    }

    function renderDirectoryLists() {
        renderDirectoryList(elements.directory);
        if (root.classList.contains('is-mobile-open')) {
            renderDirectoryList(elements.mobileDirectory);
        } else {
            elements.mobileDirectory.replaceChildren();
        }
        updateSidebarMeta();
        updateNavigationControls();
    }

    function breadcrumb(node) {
        const wrapper = document.createElement('nav');
        wrapper.setAttribute('aria-label', t('path', null, '当前路径'));
        wrapper.className = 'asset-browser__breadcrumb';
        const paths = [{ label: t('root', null, '根目录'), value: [] }];
        if (node?.dataset) {
            paths.push({ label: node.dataset === 'images' ? 'public / images' : 'public / Json', value: [node.dataset] });
            node.parts.forEach((part, index) => paths.push({ label: part, value: [node.dataset, ...node.parts.slice(0, index + 1)] }));
        }
        paths.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'asset-browser__crumb';
            button.textContent = item.label;
            if (index === paths.length - 1) button.setAttribute('aria-current', 'page');
            button.addEventListener('click', () => navigate(item.value));
            wrapper.appendChild(button);
            if (index < paths.length - 1) wrapper.appendChild(document.createTextNode(' / '));
        });
        return wrapper;
    }

    function makeDownload(file) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ake-ui-button asset-file-action asset-file-action--download';
        button.textContent = t('download', null, '下载');
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = t('downloading', null, '下载中');
            try {
                const response = await fetch(fileUrl(file.dataset, file.relative));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const href = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = href;
                anchor.download = file.name;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(href);
            } catch (error) {
                window.showToast?.(`${t('downloadFailed', null, '下载失败')}：${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.textContent = t('download', null, '下载');
            }
        });
        return button;
    }

    function makeFileCard(file) {
        const card = document.createElement('article');
        card.className = 'ake-ui-card asset-file-card';
        card.dataset.cardKind = 'asset';
        card.dataset.assetKey = fileKey(file);
        if (fileKey(file) === state.selectedFileKey) {
            card.classList.add('is-selected');
            card.dataset.selectedLabel = t('selected', null, '已从搜索结果定位');
        }
        const extension = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'FILE';
        let preview = null;
        if (file.image) {
            card.classList.add('has-preview');
            preview = document.createElement('div');
            preview.className = 'asset-file-card__preview';
            const image = document.createElement('img');
            image.src = fileUrl(file.dataset, file.relative);
            image.alt = file.name;
            image.loading = 'lazy';
            image.decoding = 'async';
            image.setAttribute('data-ake-image-fallback', 'defer');
            image.addEventListener('error', () => {
                image.alt = `${file.name} (${t('imageFailed', null, '图片加载失败')})`;
            });
            preview.appendChild(image);
        }
        const body = document.createElement('div');
        body.className = 'asset-file-card__body';
        const headingRow = document.createElement('div');
        headingRow.className = 'asset-file-card__heading';
        const heading = document.createElement('h3');
        heading.className = 'ake-ui-card__title';
        heading.textContent = file.name;
        heading.title = file.name;
        const kind = document.createElement('span');
        kind.className = 'asset-file-card__kind';
        kind.textContent = extension;
        headingRow.append(heading, kind);
        const meta = document.createElement('p');
        meta.className = 'ake-ui-card__meta';
        meta.textContent = `${formatBytes(file.record?.size)} · MD5 ${file.record?.md5 || '—'}`;
        const path = document.createElement('p');
        path.className = 'asset-file-card__path';
        path.textContent = entryPath(file);
        path.title = entryPath(file);
        const actions = document.createElement('div');
        actions.className = 'ake-ui-card__actions';
        actions.appendChild(makeDownload(file));
        const open = document.createElement('a');
        open.className = 'ake-ui-button asset-file-action asset-file-action--open';
        open.href = fileUrl(file.dataset, file.relative);
        open.target = '_blank';
        open.rel = 'noopener';
        open.textContent = t('openOriginal', null, '打开原文件');
        actions.appendChild(open);
        body.append(headingRow, meta, path, actions);
        if (preview) card.append(preview, body);
        else card.appendChild(body);
        return card;
    }

    function makeFolderCard(folder) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ake-ui-card is-interactive asset-folder-card';
        button.dataset.cardKind = 'asset-folder';
        button.innerHTML = `<span class="asset-folder-card__icon" aria-hidden="true"></span><span class="asset-folder-card__copy"><strong>${escapeHtml(folder.name)}</strong><small>${escapeHtml(t('folder', { count: folder.totalFiles }, `文件夹 · ${folder.totalFiles} 项`))}</small></span>`;
        button.addEventListener('click', () => navigate(folder.location));
        return button;
    }

    function stopProgressiveRender() {
        state.renderObserver?.disconnect();
        state.renderObserver = null;
    }

    function renderContent() {
        stopProgressiveRender();
        const token = ++state.renderToken;
        const node = currentNode();
        elements.content.replaceChildren();
        elements.content.scrollTop = 0;
        if (!node) {
            const section = document.createElement('section');
            section.className = 'ake-ui-state';
            section.innerHTML = `<div><h2>${escapeHtml(t('title', null, '资产'))}</h2><p>${escapeHtml(t('overview', null, '选择 public / images 或 public / Json 开始浏览'))}</p></div>`;
            elements.content.appendChild(section);
            return;
        }

        const header = document.createElement('header');
        header.className = 'asset-browser__header';
        header.appendChild(breadcrumb(node));
        const heading = document.createElement('div');
        heading.className = 'asset-browser__heading';
        const title = document.createElement('h2');
        title.textContent = node.name;
        title.title = nodePath(node);
        const meta = document.createElement('p');
        meta.textContent = directoryLabel(node);
        heading.append(title, meta);
        header.appendChild(heading);
        elements.content.appendChild(header);

        const items = directItems(node);
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'ake-ui-state';
            empty.textContent = t('empty.directory', null, '空目录');
            elements.content.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'ake-ui-card-grid asset-browser__grid';
        grid.dataset.cardKind = 'asset-browser';
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'ake-ui-button asset-load-more';
        more.textContent = t('loadMore', null, '加载更多');
        let cursor = 0;

        const appendBatch = () => {
            if (token !== state.renderToken || state.disposed) return;
            const fragment = document.createDocumentFragment();
            const end = Math.min(cursor + RENDER_BATCH_SIZE, items.length);
            while (cursor < end) {
                const item = items[cursor++];
                fragment.appendChild(item.type === 'directory' ? makeFolderCard(item) : makeFileCard(item));
            }
            grid.appendChild(fragment);
            more.hidden = cursor >= items.length;
            if (more.hidden) stopProgressiveRender();
        };

        more.addEventListener('click', appendBatch);
        elements.content.append(grid, more);
        appendBatch();
        if (!more.hidden && 'IntersectionObserver' in window) {
            state.renderObserver = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) appendBatch();
            }, { root: elements.content, rootMargin: '500px 0px' });
            state.renderObserver.observe(more);
        }
    }

    function clearSearchState() {
        window.clearTimeout(state.searchTimer);
        state.searchTimer = 0;
        state.query = '';
        state.searchResults = [];
        state.searchLimited = false;
        elements.search.value = '';
        elements.mobileSearch.value = '';
    }

    function expandAncestors(location) {
        for (let index = 1; index < location.length; index += 1) {
            state.expanded.add(locationKey(location.slice(0, index)));
        }
    }

    function navigate(path, options = {}) {
        clearSearchState();
        state.location = path.slice();
        state.selectedFileKey = options.selectedFileKey || '';
        expandAncestors(state.location);
        renderDirectoryLists();
        renderContent();
        closeMobile();
    }

    function performSearch() {
        state.searchTimer = 0;
        const tokens = normalizeSearch(state.query).split(/\s+/).filter(Boolean);
        const matches = [];
        let limited = false;
        if (tokens.length) {
            for (const entry of state.searchEntries) {
                if (!tokens.every(token => entry.searchKey.includes(token))) continue;
                if (matches.length >= SEARCH_RESULT_LIMIT) {
                    limited = true;
                    break;
                }
                matches.push(entry);
            }
        }
        state.searchResults = matches;
        state.searchLimited = limited;
        renderDirectoryLists();
    }

    function onSearch(event) {
        state.query = event.target.value.trim();
        if (event.target !== elements.search) elements.search.value = event.target.value;
        if (event.target !== elements.mobileSearch) elements.mobileSearch.value = event.target.value;
        window.clearTimeout(state.searchTimer);
        state.searchTimer = window.setTimeout(performSearch, SEARCH_DELAY);
    }

    function navigateUp() {
        if (!state.location.length) return;
        navigate(state.location.slice(0, -1));
    }

    function openMobile() {
        root.classList.add('is-mobile-open');
        elements.mobileOverlay.classList.add('is-open');
        elements.mobileOverlay.setAttribute('aria-hidden', 'false');
        elements.mobileButton.setAttribute('aria-expanded', 'true');
        renderDirectoryList(elements.mobileDirectory);
        window.setTimeout(() => elements.mobileSearch.focus(), 0);
    }

    function closeMobile() {
        root.classList.remove('is-mobile-open');
        elements.mobileOverlay.classList.remove('is-open');
        elements.mobileOverlay.setAttribute('aria-hidden', 'true');
        elements.mobileButton.setAttribute('aria-expanded', 'false');
        elements.mobileDirectory.replaceChildren();
    }

    async function initialize() {
        try {
            const index = await window.akeAssetIndex.load({ baseUrl: ASSET_DATA_ORIGIN });
            if (state.disposed) return;
            const built = await makeTree(index);
            if (state.disposed) return;
            state.index = index;
            state.tree = built.roots;
            state.searchEntries = built.searchEntries;
            renderDirectoryLists();
            renderContent();
        } catch (error) {
            elements.content.innerHTML = `<div class="ake-ui-state" data-state="error"><div><h2>${escapeHtml(t('errors.load', null, '索引加载失败'))}</h2><p>${escapeHtml(error.message || t('errors.unavailable', null, '统一索引服务不可用'))}</p></div></div>`;
        }
    }

    const listenerOptions = { signal: events.signal };
    elements.home.addEventListener('click', () => navigate([]), listenerOptions);
    elements.mobileHome.addEventListener('click', () => navigate([]), listenerOptions);
    elements.up.addEventListener('click', navigateUp, listenerOptions);
    elements.mobileUp.addEventListener('click', navigateUp, listenerOptions);
    elements.search.addEventListener('input', onSearch, listenerOptions);
    elements.mobileSearch.addEventListener('input', onSearch, listenerOptions);
    elements.mobileButton.addEventListener('click', openMobile, listenerOptions);
    elements.mobileClose.addEventListener('click', closeMobile, listenerOptions);
    elements.mobileOverlay.addEventListener('click', event => {
        if (event.target === elements.mobileOverlay) closeMobile();
    }, listenerOptions);
    root.dataset.moduleId = MODULE_ID;

    const controller = {
        destroy() {
            state.disposed = true;
            state.renderToken += 1;
            window.clearTimeout(state.searchTimer);
            stopProgressiveRender();
            events.abort();
        }
    };
    window.__akeAssetController = controller;
    initialize();
})();
