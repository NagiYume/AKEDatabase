(function () {
    const roots = new Map();
    const homeIconHtml = '<span class="ake-module-home__icon" aria-hidden="true">&#8962;</span>';
    const searchSelectors = {
        v3_cc: '[data-ake-module="cc"] .ake-ui-directory__search',
        research: '[data-ake-module="research"] .ake-ui-directory__search',
        v3_character: '[data-ake-module="character"] .ake-ui-directory__search',
        v3_weapon: '[data-ake-module="weapon"] .ake-ui-directory__search',
        v3_enemy: '[data-ake-module="enemy"] .ake-ui-directory__search',
        v3_equip: '[data-ake-module="equip"] .ake-ui-directory__search',
        v3_activity: '[data-ake-module="activity"] .ake-ui-directory__search',
        v3_item: '[data-ake-module="item"] .ake-ui-directory__search',
        v3_shop: '[data-ake-module="shop"] .ake-ui-directory__search',
        v3_dungeon: '[data-ake-module="dungeon"] .ake-ui-directory__search',
        v3_achievement: '[data-ake-module="achievement"] .ake-ui-directory__search',
        v3_archive: '[data-ake-module="archive"] > .ake-ui-directory__sidebar .ake-ui-directory__search:not(.ake-ui-directory__search--mobile)',
        v3_mission: '[data-ake-module="mission"] .ake-ui-directory__search',
        v3_skill: '[data-ake-module="skill"] > .ake-ui-directory__sidebar .ake-ui-directory__search',
        v3_buff: '[data-ake-module="buff"] > .ake-ui-directory__sidebar .ake-ui-directory__search',
        baker: '[data-ake-module="baker"] .ake-ui-directory__search',
        spawn: '.spawner-module .list-search'
    };
    function text(value, fallback) {
        return value === undefined || value === null || value === '' ? (fallback || '') : String(value);
    }

    function createCardMedia(item) {
        const visual = document.createElement('div');
        visual.className = 'ake-ui-card__media';
        const sources = [item.image, item.imageFallback].filter((source, index, values) => source && values.indexOf(source) === index);
        const showPlaceholder = () => {
            visual.replaceChildren();
            visual.classList.add('is-placeholder');
            visual.classList.remove('uses-fallback');
            visual.textContent = text(item.fallback, 'DATA');
        };
        if (!sources.length) {
            showPlaceholder();
            return visual;
        }

        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        let sourceIndex = 0;
        image.addEventListener('error', () => {
            if (sourceIndex >= sources.length) {
                showPlaceholder();
                return;
            }
            visual.classList.toggle('uses-fallback', sourceIndex > 0);
            image.src = sources[sourceIndex];
            sourceIndex += 1;
        });
        visual.appendChild(image);
        image.src = sources[sourceIndex];
        sourceIndex += 1;
        return visual;
    }

    function createOverviewHeading(options = {}) {
        const level = options.level === 'page' ? 'page' : 'group';
        const header = document.createElement('header');
        header.className = 'ake-overview-heading';
        header.dataset.level = level;
        if (options.tone) header.dataset.tone = options.tone;

        const main = document.createElement('div');
        main.className = 'ake-overview-heading__main';
        const title = document.createElement(level === 'page' ? 'h1' : 'h2');
        title.className = 'ake-overview-heading__title';
        title.textContent = text(options.title);
        main.appendChild(title);
        if (options.meta !== undefined && options.meta !== null && options.meta !== '') {
            const meta = document.createElement('span');
            meta.className = 'ake-overview-heading__meta';
            meta.textContent = text(options.meta);
            main.appendChild(meta);
        }
        header.appendChild(main);

        if (options.description !== undefined && options.description !== null && options.description !== '') {
            const description = document.createElement('p');
            description.className = 'ake-overview-heading__description';
            description.textContent = text(options.description);
            header.appendChild(description);
        }
        return header;
    }

    function markVersionChange(element, item) {
        if (!element || !item?.changeType) return;
        const label = item.changeType === 'added'
            ? (window.akeData?.t('versionDiff.added', null, '新增') || '新增')
            : (window.akeData?.t('versionDiff.modified', null, '修改') || '修改');
        element.dataset.akeChange = item.changeType;
        element.dataset.akeChangeLabel = label;
    }

    function visibleTextTokens(root, maxTokens = 1200) {
        const tokens = [];
        let truncated = false;
        const visit = node => {
            if (tokens.length >= maxTokens) { truncated = true; return; }
            if (node.nodeType === Node.TEXT_NODE) {
                const value = String(node.textContent || '').replace(/\s+/g, ' ').trim();
                if (value) tokens.push(value);
                return;
            }
            if (!(node instanceof Element) || node.matches('.ake-version-diff, script, style, template')) return;
            const style = getComputedStyle(node);
            if (node.hidden || style.display === 'none' || style.visibility === 'hidden') return;
            Array.from(node.childNodes).forEach(visit);
        };
        visit(root);
        return { tokens, truncated };
    }

    function diffVisibleTokens(current, baseline, limit = 500) {
        const currentValues = current.tokens;
        const baselineValues = baseline.tokens;
        const columns = currentValues.length + 1;
        const matrix = new Uint16Array((baselineValues.length + 1) * columns);
        for (let oldIndex = baselineValues.length - 1; oldIndex >= 0; oldIndex -= 1) {
            for (let newIndex = currentValues.length - 1; newIndex >= 0; newIndex -= 1) {
                const offset = oldIndex * columns + newIndex;
                matrix[offset] = baselineValues[oldIndex] === currentValues[newIndex]
                    ? matrix[(oldIndex + 1) * columns + newIndex + 1] + 1
                    : Math.max(matrix[(oldIndex + 1) * columns + newIndex], matrix[offset + 1]);
            }
        }
        const changes = [];
        let oldIndex = 0;
        let newIndex = 0;
        while (oldIndex < baselineValues.length || newIndex < currentValues.length) {
            if (changes.length >= limit) break;
            if (oldIndex < baselineValues.length && newIndex < currentValues.length && baselineValues[oldIndex] === currentValues[newIndex]) {
                oldIndex += 1;
                newIndex += 1;
            } else if (oldIndex < baselineValues.length &&
                (newIndex >= currentValues.length || matrix[(oldIndex + 1) * columns + newIndex] >= matrix[oldIndex * columns + newIndex + 1])) {
                changes.push({ kind: 'removed', value: baselineValues[oldIndex] });
                oldIndex += 1;
            } else {
                changes.push({ kind: 'added', value: currentValues[newIndex] });
                newIndex += 1;
            }
        }
        return {
            changes,
            truncated: current.truncated || baseline.truncated || oldIndex < baselineValues.length || newIndex < currentValues.length
        };
    }

    function renderVersionDiff(container, data, baselineHtml) {
        container?.querySelector?.('.ake-version-diff')?.remove();
        const diff = data?.__versionDiff;
        if (!container || !diff?.baseline || !baselineHtml) return;
        const baselineRoot = document.createElement('div');
        baselineRoot.className = container.className;
        baselineRoot.style.cssText = 'position:fixed;left:-100000px;top:0;width:1000px;visibility:visible;pointer-events:none;';
        baselineRoot.innerHTML = baselineHtml;
        document.body.appendChild(baselineRoot);
        const currentTokens = visibleTextTokens(container);
        const baselineTokens = visibleTextTokens(baselineRoot);
        baselineRoot.remove();
        const result = diffVisibleTokens(currentTokens, baselineTokens);
        if (!result.changes.length) return;
        const baseVersion = String(diff.baseVersion || '').split('@')[0];
        const details = document.createElement('details');
        details.className = 'ake-version-diff';
        details.open = true;

        const summary = document.createElement('summary');
        const title = document.createElement('strong');
        title.textContent = window.akeData?.t('versionDiff.detailTitle', { version: baseVersion }, `字段差异 · 相比 ${baseVersion}`) || `字段差异 · 相比 ${baseVersion}`;
        const count = document.createElement('span');
        count.textContent = window.akeData?.t('versionDiff.changeCount', { count: result.changes.length }, `${result.changes.length} 处变更`) || `${result.changes.length} 处变更`;
        summary.append(title, count);
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'ake-version-diff__body';
        result.changes.forEach(change => {
            const line = document.createElement('div');
            line.className = `ake-version-diff__line ake-version-diff__line--${change.kind}`;
            const marker = document.createElement('b');
            marker.textContent = change.kind === 'removed' ? '−' : '+';
            const value = document.createElement('span');
            value.textContent = change.value;
            line.append(marker, value);
            body.appendChild(line);
        });
        if (result.truncated) {
            const note = document.createElement('p');
            note.className = 'ake-version-diff__truncated';
            note.textContent = window.akeData?.t('versionDiff.truncated', null, '差异过多，仅显示前 500 项。') || '差异过多，仅显示前 500 项。';
            body.appendChild(note);
        }
        details.appendChild(body);
        container.prepend(details);
    }

    function render(container, options) {
        if (!container) return;
        roots.set(container.id, { container, options });
        const items = options.items || [];
        const overviewVariant = text(options.variant, 'icon');
        const groups = new Map();
        items.forEach((item) => {
            const baseVersion = String(item.changeBaseVersion || '').split('@')[0];
            const group = item.changeType
                ? { id: '__version_diff__', name: window.akeData?.t('versionDiff.group', { version: baseVersion }, `版本差异 · 相比 ${baseVersion}`) || `版本差异 · 相比 ${baseVersion}`, order: -10000 }
                : (options.group(item) || { id: 'all', name: window.akeData?.t('common.all', null, '全部') || '全部' });
            if (!groups.has(group.id)) groups.set(group.id, { ...group, items: [] });
            groups.get(group.id).items.push(item);
        });

        container.innerHTML = '';
        const root = document.createElement('div');
        root.className = 'ake-ui-page';
        root.dataset.overviewVariant = overviewVariant;

        root.appendChild(createOverviewHeading({
            level: 'page',
            title: options.title,
            meta: window.akeData?.t('overview.count', { count: items.length }, `${items.length} 条数据`) || `${items.length} 条数据`,
            description: options.description || window.akeData?.t('overview.hint', null, '选择卡片查看完整数据') || '选择卡片查看完整数据'
        }));

        const groupList = Array.from(groups.values()).sort((a, b) =>
            (a.order ?? 999) - (b.order ?? 999) || text(a.name).localeCompare(text(b.name), window.akeData?.getLanguage?.() === 'EN' ? 'en' : 'zh-CN'));
        groupList.forEach((group) => {
            const section = document.createElement('section');
            section.className = 'ake-ui-section';
            section.appendChild(createOverviewHeading({
                level: 'group',
                title: group.name,
                meta: group.items.length,
                tone: group.id === '__version_diff__' ? 'version' : ''
            }));

            const grid = document.createElement('div');
            grid.className = 'ake-ui-card-grid';
            grid.dataset.overviewVariant = overviewVariant;
            group.items.forEach((item) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = `ake-ui-card${overviewVariant === 'text' ? '' : ' has-media'}`;
                card.dataset.akeComponent = 'card';
                card.dataset.cardKind = 'overview';
                card.dataset.overviewVariant = overviewVariant;
                const tagsLayout = text(options.tagsLayout);
                if (tagsLayout) card.dataset.tagsLayout = tagsLayout;
                card.setAttribute('aria-label', item.id ? `${text(item.name)} · ${text(item.id)}` : text(item.name));
                window.AKEUI?.enhanceCard(card, {
                    variant: 'entity',
                    density: 'compact',
                    layout: 'aligned',
                    interactive: true,
                    accent: Number(item.rarity) >= 1 && Number(item.rarity) <= 6
                        ? { type: 'rarity', value: item.rarity }
                        : item.outline ? { type: 'status', value: item.outline.replace(/^status-/, '') } : null
                });
                card.addEventListener('click', event => {
                    if (event.target.closest('.tag-hyperlink')) return;
                    options.onSelect(item);
                    const selector = options.sidebarSelector?.(item);
                    if (!selector) return;
                    requestAnimationFrame(() => {
                        document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    });
                });

                const visual = overviewVariant === 'text' ? null : createCardMedia(item);

                const body = document.createElement('div');
                body.className = 'ake-ui-card__content';
                const titleRow = document.createElement('div');
                titleRow.className = 'ake-ui-card__header';
                if (visual) titleRow.appendChild(visual);
                if (visual && item.mediaIcons?.length) {
                    const mediaIcons = document.createElement('span');
                    mediaIcons.className = 'ake-ui-card__media-icons character-card-corner-icons';
                    item.mediaIcons.slice(0, 2).forEach(icon => {
                        if (!icon?.src) return;
                        const anchor = document.createElement('span');
                        anchor.className = 'character-card-corner-icon';
                        if (icon.tagId) {
                            anchor.classList.add('tag-hyperlink');
                            anchor.dataset.tagId = icon.tagId;
                        } else if (icon.label) {
                            anchor.title = icon.label;
                        }
                        if (icon.kind) anchor.dataset.kind = icon.kind;
                        const image = document.createElement('img');
                        image.src = icon.src;
                        image.alt = icon.label || '';
                        anchor.appendChild(image);
                        mediaIcons.appendChild(anchor);
                    });
                    titleRow.appendChild(mediaIcons);
                }
                const heading = document.createElement('div');
                heading.className = 'ake-ui-card__heading';
                const cardTitle = document.createElement('h3');
                cardTitle.className = 'ake-ui-card__title';
                cardTitle.textContent = item.name;
                cardTitle.title = item.name;
                heading.appendChild(cardTitle);
                titleRow.appendChild(heading);
                if (item.icons?.length) {
                    const iconList = document.createElement('span');
                    iconList.className = 'ake-ui-card__meta';
                    item.icons.forEach(icon => {
                        if (!icon?.src) return;
                        const image = document.createElement('img');
                        image.className = 'ake-ui-meta-icon';
                        image.src = icon.src;
                        image.alt = icon.label || '';
                        if (icon.tooltip !== false) image.title = icon.label || '';
                        if (icon.kind) image.dataset.kind = icon.kind;
                        iconList.appendChild(image);
                    });
                    titleRow.appendChild(iconList);
                }
                const id = document.createElement('div');
                id.className = 'ake-ui-card__id';
                id.textContent = item.id;
                const tags = document.createElement('div');
                tags.className = 'ake-ui-card__badges';
                if (item.changeType) {
                    const changeTag = document.createElement('span');
                    changeTag.className = 'ake-ui-badge ake-ui-badge--change';
                    changeTag.dataset.tone = item.changeType;
                    changeTag.textContent = item.changeType === 'added'
                        ? (window.akeData?.t('versionDiff.added', null, '新增') || '新增')
                        : (window.akeData?.t('versionDiff.modified', null, '修改') || '修改');
                    tags.appendChild(changeTag);
                }
                (item.tags || []).filter(Boolean).forEach((tag) => {
                    const chip = document.createElement('span');
                    chip.className = 'ake-ui-badge';
                    chip.textContent = tag;
                    tags.appendChild(chip);
                });
                body.append(titleRow, id, tags);
                card.appendChild(body);
                grid.appendChild(card);
            });
            section.appendChild(grid);
            root.appendChild(section);
        });
        container.appendChild(root);
        options.afterRender?.(root);
    }

    function isActive(module) {
        return document.querySelector('#contentArea script[data-ake-v3-module]')?.dataset.akeV3Module === module;
    }

    function showRoot(module) {
        const detailIds = {
            v3_cc: 'v2ccDetail', research: 'researchDetail', v3_character: 'v2characterDetail',
            v3_weapon: 'v2wpnDetail', v3_enemy: 'v2enemyDetail', v3_equip: 'v2equipDetail',
            v3_activity: 'activityDetail', v3_item: 'v2itemDetail', v3_dungeon: 'v2dungeonDetail',
            v3_achievement: 'achievementDetail'
        };
        const entry = roots.get(detailIds[module]);
        if (entry?.container.isConnected) {
            entry.options.onReset?.();
            render(entry.container, entry.options);
            return true;
        }
        return false;
    }

    function normalizeSearchContainer(container) {
        if (!(container instanceof HTMLLabelElement)) return container;
        const replacement = document.createElement('div');
        Array.from(container.attributes).forEach(attribute => {
            if (attribute.name !== 'for') replacement.setAttribute(attribute.name, attribute.value);
        });
        while (container.firstChild) replacement.appendChild(container.firstChild);
        container.replaceWith(replacement);

        const input = replacement.querySelector('input');
        if (input && !input.hasAttribute('aria-label') && input.placeholder) {
            input.setAttribute('aria-label', input.placeholder);
        }
        replacement.addEventListener('click', event => {
            if (event.target === replacement) input?.focus();
        });
        return replacement;
    }

    function installHomeButton() {
        const match = Object.entries(searchSelectors).find(([, selector]) => document.querySelector(selector));
        const module = match?.[0];
        let container = match ? document.querySelector(match[1]) : null;
        if (container) container = normalizeSearchContainer(container);
        if (!container || container.querySelector('.ake-module-home')) return;
        container.classList.add('ake-module-search-row');
        container.querySelector(':scope > .ake-ui-directory__search-icon')?.remove();

        const existingButton = container.closest('.ake-ui-directory__sidebar')
            ?.querySelector('#akeArchiveHome, #missionHomeButton');
        if (existingButton) {
            existingButton.classList.add('ake-module-home');
            container.prepend(existingButton);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ake-ui-icon-button ake-module-home';
        button.title = window.akeData?.t('nav.home', null, '返回起始页') || '返回起始页';
        button.setAttribute('aria-label', button.title);
        button.innerHTML = homeIconHtml;
        button.addEventListener('click', () => {
            window.__akeRouter?.updateUrl(module);
            if (showRoot(module)) return;
            const url = new URL(window.location.href);
            url.search = '';
            url.searchParams.set('plugin', module);
            window.location.assign(url.href);
        });
        container.prepend(button);
    }

    window.AKEModuleOverview = { render, isActive, showRoot, markVersionChange, renderVersionDiff };
    installHomeButton();
})();
