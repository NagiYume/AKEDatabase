(function () {
    if (window.AKEUI) return;

    const isNode = value => typeof Node !== 'undefined' && value instanceof Node;
    const isPresent = value => value !== undefined
        && value !== null
        && (typeof value !== 'string' || value.trim() !== '');
    const hasItems = value => Array.isArray(value) && value.length > 0;
    const selectInstances = new WeakMap();
    const filterPanelInstances = new WeakMap();
    let openSelectInstance = null;
    let selectSequence = 0;
    let filterPanelSequence = 0;
    let popoverSequence = 0;

    function appendContent(parent, value) {
        if (!isPresent(value)) return;
        if (isNode(value)) {
            parent.appendChild(value);
            return;
        }
        parent.appendChild(document.createTextNode(String(value)));
    }

    function element(tag, className, content) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        appendContent(node, content);
        return node;
    }

    function fragment(markup) {
        const template = document.createElement('template');
        template.innerHTML = markup || '';
        return template.content;
    }

    function applyCommonState(node, options) {
        const density = options.density || 'regular';
        const layout = options.layout || 'compact';
        node.dataset.density = density;
        node.dataset.layout = layout;

        const accent = options.accent;
        if (accent?.type && isPresent(accent.value)) {
            node.dataset.accent = accent.type;
            node.dataset.accentValue = String(accent.value);
        }
        if (options.change?.type) {
            node.dataset.akeChange = options.change.type;
            if (options.change.label) node.dataset.akeChangeLabel = options.change.label;
        }
        if (options.disabled) {
            node.classList.add('is-disabled');
            if ('disabled' in node) node.disabled = true;
            node.setAttribute('aria-disabled', 'true');
        }
    }

    function applyAttributes(node, attributes = {}) {
        Object.entries(attributes).forEach(([name, value]) => {
            if (value === undefined || value === null || value === false) return;
            node.setAttribute(name, value === true ? '' : String(value));
        });
    }

    function setFilterButtonPressed(button, pressed) {
        if (!(button instanceof HTMLButtonElement)) return button;
        const isPressed = Boolean(pressed);
        button.classList.toggle('is-active', isPressed);
        button.setAttribute('aria-pressed', String(isPressed));
        return button;
    }

    function filterButton(options = {}) {
        const classes = ['ake-ui-filter__button'];
        if (options.className) classes.push(options.className);
        const node = element('button', classes.join(' '), options.label);
        node.type = 'button';
        applyCommonState(node, options);
        applyAttributes(node, options.attributes);
        setFilterButtonPressed(node, options.pressed);
        if (typeof options.onChange === 'function' && !options.disabled) {
            node.addEventListener('click', event => {
                const pressed = options.mode === 'single'
                    ? true
                    : node.getAttribute('aria-pressed') !== 'true';
                if (options.mode === 'single') {
                    node.parentElement?.querySelectorAll('.ake-ui-filter__button').forEach(button => {
                        setFilterButtonPressed(button, button === node);
                    });
                } else {
                    setFilterButtonPressed(node, pressed);
                }
                options.onChange(pressed, event, node);
            });
        }
        return node;
    }

    function enhanceFilterPanel(panel, options = {}) {
        if (!(panel instanceof Element)) return null;
        const existing = filterPanelInstances.get(panel);
        if (existing) {
            if (isPresent(options.summary)) existing.setSummary(options.summary);
            return existing;
        }

        let toggle = panel.querySelector(':scope > .ake-ui-filter__toggle');
        let content = panel.querySelector(':scope > .ake-ui-filter__content');

        if (!content) {
            content = element('div', 'ake-ui-filter__content');
            Array.from(panel.children).forEach(child => {
                if (child !== toggle) content.appendChild(child);
            });
            panel.appendChild(content);
        }

        if (!toggle) {
            toggle = element('button', 'ake-ui-filter__toggle');
            toggle.type = 'button';
            const summary = element('span', 'ake-ui-filter__summary', options.summary);
            const chevron = element('span', 'ake-ui-filter__chevron');
            chevron.setAttribute('aria-hidden', 'true');
            toggle.append(summary, chevron);
            panel.insertBefore(toggle, content);
        }

        const summary = toggle.querySelector('.ake-ui-filter__summary') || toggle.firstElementChild;
        summary?.classList.add('ake-ui-filter__summary');
        if (!content.id) content.id = `akeUiFilterContent-${++filterPanelSequence}`;
        toggle.setAttribute('aria-controls', content.id);

        const setExpanded = expanded => {
            const isExpanded = Boolean(expanded);
            toggle.setAttribute('aria-expanded', String(isExpanded));
            content.hidden = !isExpanded;
            panel.classList.toggle('is-expanded', isExpanded);
        };
        const setSummary = value => {
            if (summary && isPresent(value)) summary.textContent = String(value);
        };
        const initialExpanded = options.expanded ?? toggle.getAttribute('aria-expanded') === 'true';
        const instance = { panel, toggle, content, setExpanded, setSummary };
        filterPanelInstances.set(panel, instance);
        toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
        setSummary(options.summary);
        setExpanded(initialExpanded);
        return instance;
    }

    function updateFilterPanel(panel, options = {}) {
        const instance = filterPanelInstances.get(panel) || enhanceFilterPanel(panel, options);
        if (isPresent(options.summary)) instance?.setSummary(options.summary);
        return instance;
    }

    function optionEntries(select) {
        const entries = [];
        Array.from(select.children).forEach(child => {
            if (child instanceof HTMLOptGroupElement) {
                entries.push({ type: 'group', label: child.label });
                Array.from(child.children).forEach(option => entries.push({ type: 'option', option }));
                return;
            }
            if (child instanceof HTMLOptionElement) entries.push({ type: 'option', option: child });
        });
        return entries;
    }

    function renderSelectOptionContent(target, option) {
        if (!target) return;
        target.replaceChildren();
        if (!option) return;

        const data = option.dataset || {};
        const image = data.akeUiRichImage || '';
        if (image) {
            const icon = element('img', 'ake-ui-select__option-icon');
            icon.src = image;
            icon.alt = '';
            const scale = Number(data.akeUiRichScale) || 1;
            const size = Math.max(16, Math.min(32, Math.round(22 * scale)));
            icon.width = size;
            icon.height = size;
            icon.style.width = `${size}px`;
            icon.style.height = `${size}px`;
            icon.setAttribute('aria-hidden', 'true');
            target.appendChild(icon);
        }

        const text = element('span', 'ake-ui-select__option-text', option.textContent?.trim() || '');
        if (data.akeUiRichColor) text.style.color = data.akeUiRichColor;
        if (data.akeUiRichBold === 'true') text.style.fontWeight = '700';
        if (data.akeUiRichUnderline === 'true') text.style.textDecoration = 'underline';
        target.appendChild(text);
    }

    function enhanceSelect(select) {
        if (!(select instanceof HTMLSelectElement)) return null;
        if (selectInstances.has(select)) return selectInstances.get(select);
        if (!select.parentNode) return null;

        const shell = element('div', 'ake-ui-select');
        const trigger = element('button', 'ake-ui-select__trigger');
        trigger.type = 'button';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = '<span class="ake-ui-select__value"></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';

        const menu = element('div', 'ake-ui-select__menu');
        menu.hidden = true;
        menu.id = `akeUiSelectMenu-${++selectSequence}`;
        trigger.setAttribute('aria-controls', menu.id);

        const list = element('div', 'ake-ui-select__list');
        list.setAttribute('role', 'listbox');
        menu.appendChild(list);

        const connector = element('div', 'ake-ui-select__connector');
        connector.hidden = true;

        const accessibleLabel = select.getAttribute('aria-label') || select.labels?.[0]?.textContent?.trim();
        if (accessibleLabel) trigger.setAttribute('aria-label', accessibleLabel);

        const instance = { select, shell, trigger, menu, list, connector, items: [], activeIndex: -1 };
        selectInstances.set(select, instance);
        select.parentNode.insertBefore(shell, select);
        shell.append(select, trigger);
        document.body.append(menu, connector);
        select.classList.add('ake-ui-select__native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');

        function selectedIndexInItems() {
            return instance.items.findIndex(item => item.dataset.value === select.value && item.getAttribute('aria-disabled') !== 'true');
        }

        function updateActive(index, scroll = true) {
            if (!instance.items.length) return;
            let next = Math.max(0, Math.min(index, instance.items.length - 1));
            if (instance.items[next]?.disabled) {
                const enabledIndex = instance.items.findIndex(item => !item.disabled);
                if (enabledIndex < 0) return;
                next = enabledIndex;
            }
            instance.activeIndex = next;
            instance.items.forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === next));
            trigger.setAttribute('aria-activedescendant', instance.items[next].id);
            if (scroll) instance.items[next].scrollIntoView({ block: 'nearest' });
        }

        function positionMenu() {
            if (menu.hidden) return;
            const rect = trigger.getBoundingClientRect();
            const viewportGap = 10;
            const spaceBelow = window.innerHeight - rect.bottom - viewportGap;
            const spaceAbove = rect.top - viewportGap;
            const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
            const connectorHeight = 8;
            const connectorWidth = 16;
            const menuGap = connectorHeight;
            const maxHeight = Math.max(120, Math.min(280, (openAbove ? spaceAbove : spaceBelow) - menuGap));
            const menuLeft = Math.max(viewportGap, Math.min(rect.left, window.innerWidth - rect.width - viewportGap));
            const connectorLeft = menuLeft + ((rect.width - connectorWidth) / 2);
            menu.style.left = `${menuLeft}px`;
            menu.style.width = `${rect.width}px`;
            menu.style.maxHeight = `${maxHeight}px`;
            list.style.maxHeight = `${Math.max(106, maxHeight - 14)}px`;
            menu.style.top = openAbove ? 'auto' : `${rect.bottom + menuGap}px`;
            menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + menuGap}px` : 'auto';
            menu.classList.toggle('opens-above', openAbove);
            menu.classList.toggle('opens-below', !openAbove);
            connector.classList.toggle('opens-above', openAbove);
            connector.classList.toggle('opens-below', !openAbove);
            connector.style.left = `${connectorLeft}px`;
            connector.style.top = openAbove ? `${rect.top - connectorHeight}px` : `${rect.bottom}px`;
        }

        function sync() {
            const selected = select.selectedOptions[0];
            renderSelectOptionContent(trigger.querySelector('.ake-ui-select__value'), selected);
            trigger.disabled = select.disabled;
            shell.classList.toggle('is-disabled', select.disabled);
            instance.items.forEach(item => {
                const selectedItem = item.dataset.value === select.value;
                item.classList.toggle('is-selected', selectedItem);
                item.setAttribute('aria-selected', String(selectedItem));
            });
        }

        function rebuild() {
            list.replaceChildren();
            instance.items = [];
            optionEntries(select).forEach(entry => {
                if (entry.type === 'group') {
                    const group = element('div', 'ake-ui-select__group', entry.label);
                    list.appendChild(group);
                    return;
                }

                const item = element('button', 'ake-ui-select__option');
                item.type = 'button';
                item.id = `${menu.id}-option-${instance.items.length}`;
                item.dataset.value = entry.option.value;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-disabled', String(entry.option.disabled));
                item.disabled = entry.option.disabled;
                renderSelectOptionContent(item, entry.option);
                item.addEventListener('click', () => {
                    if (entry.option.disabled) return;
                    select.value = entry.option.value;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    sync();
                    close();
                    trigger.focus();
                });
                instance.items.push(item);
                list.appendChild(item);
            });
            sync();
        }

        function open() {
            if (select.disabled) return;
            if (openSelectInstance && openSelectInstance !== instance) openSelectInstance.close();
            rebuild();
            menu.hidden = false;
            connector.hidden = false;
            shell.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            openSelectInstance = instance;
            positionMenu();
            updateActive(Math.max(0, selectedIndexInItems()), false);
        }

        function close() {
            menu.hidden = true;
            connector.hidden = true;
            shell.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-activedescendant');
            if (openSelectInstance === instance) openSelectInstance = null;
        }

        instance.close = close;
        instance.rebuild = rebuild;
        instance.positionMenu = positionMenu;

        trigger.addEventListener('click', () => menu.hidden ? open() : close());
        trigger.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                close();
                return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            if (menu.hidden) {
                open();
                return;
            }
            if (event.key === 'ArrowDown') updateActive(instance.activeIndex + 1);
            if (event.key === 'ArrowUp') updateActive(instance.activeIndex - 1);
            if (event.key === 'Home') updateActive(0);
            if (event.key === 'End') updateActive(instance.items.length - 1);
            if (event.key === 'Enter' || event.key === ' ') instance.items[instance.activeIndex]?.click();
        });

        select.addEventListener('focus', () => trigger.focus());
        select.addEventListener('change', sync);
        new MutationObserver(rebuild).observe(select, { childList: true, subtree: true, attributes: true });
        rebuild();
        return instance;
    }

    function enhanceSelects(root = document) {
        if (root.matches?.('select.ake-ui-control--select')) enhanceSelect(root);
        root.querySelectorAll?.('select.ake-ui-control--select').forEach(enhanceSelect);
    }

    function refreshSelect(select) {
        const instance = selectInstances.get(select) || enhanceSelect(select);
        instance?.rebuild();
    }

    function enhanceCard(node, options = {}) {
        if (!(node instanceof Element)) return node;
        node.classList.add('ake-ui-card');
        node.dataset.variant = options.variant || node.dataset.variant || 'entity';
        applyCommonState(node, options);
        if (options.interactive === true || typeof options.onSelect === 'function') {
            node.classList.add('is-interactive');
            if (typeof options.onSelect === 'function' && !options.disabled) {
                node.addEventListener('click', event => options.onSelect(event, options));
            }
        }
        return node;
    }

    function badge(data) {
        if (!isPresent(data)) return null;
        const definition = typeof data === 'object' ? data : { label: data };
        if (!isPresent(definition.label)) return null;
        const classes = ['ake-ui-badge'];
        if (definition.className) classes.push(...String(definition.className).split(/\s+/).filter(Boolean));
        const node = element('span', classes.join(' '), definition.label);
        if (definition.tone) node.dataset.tone = definition.tone;
        if (definition.title) node.title = definition.title;
        applyAttributes(node, definition.attributes);
        return node;
    }

    function metaGrid(items, options = {}) {
        const visibleItems = (items || []).filter(item => item && isPresent(item.value));
        if (!visibleItems.length && !options.preserveEmpty) return null;
        const grid = element('dl', 'ake-ui-meta-grid');
        if (options.columns) grid.style.setProperty('--ake-ui-meta-columns', String(options.columns));
        visibleItems.forEach(item => {
            const row = element('div', 'ake-ui-meta-grid__item');
            const label = element('dt');
            if (item.icon) {
                const icon = element('img', 'ake-ui-meta-grid__icon');
                icon.src = item.icon;
                icon.alt = '';
                label.appendChild(icon);
            }
            if (isPresent(item.label)) appendContent(label, item.label);
            if (label.childNodes.length) row.appendChild(label);
            row.appendChild(element('dd', null, item.value));
            grid.appendChild(row);
        });
        return grid;
    }

    function dataTable(definition = {}) {
        const columns = definition.columns || [];
        const rows = definition.rows || [];
        if (!columns.length && !rows.length && !definition.preserveEmpty) return null;
        const shell = element('div', 'ake-ui-table-shell');
        const table = element('table', 'ake-ui-table');
        if (columns.length) {
            const head = table.createTHead();
            const row = head.insertRow();
            columns.forEach(column => {
                const cell = document.createElement('th');
                cell.scope = 'col';
                appendContent(cell, typeof column === 'object' ? column.label : column);
                row.appendChild(cell);
            });
        }
        const body = table.createTBody();
        rows.forEach(rowData => {
            const row = body.insertRow();
            const values = Array.isArray(rowData) ? rowData : columns.map(column => rowData?.[column.key]);
            values.forEach(value => appendContent(row.insertCell(), value));
        });
        shell.appendChild(table);
        return shell;
    }

    function section(definition = {}) {
        if (!definition.preserveEmpty && !isPresent(definition.content) && !hasItems(definition.items) && !hasItems(definition.rows)) {
            return null;
        }
        const node = element(definition.element || 'section', 'ake-ui-section');
        if (definition.variant) node.dataset.variant = definition.variant;
        if (isPresent(definition.title)) node.appendChild(element('h3', 'ake-ui-section__title', definition.title));

        let content = definition.content;
        if (definition.type === 'meta') content = metaGrid(definition.items, definition);
        if (definition.type === 'table') content = dataTable(definition);
        if (definition.type === 'list') {
            const list = element('ul', 'ake-ui-list');
            (definition.items || []).filter(isPresent).forEach(item => list.appendChild(element('li', null, item)));
            content = list.childElementCount ? list : null;
        }
        if (isPresent(content)) {
            const body = element('div', 'ake-ui-section__body');
            appendContent(body, content);
            node.appendChild(body);
        }
        return node.childElementCount || definition.preserveEmpty ? node : null;
    }

    function card(options = {}) {
        const interactive = options.interactive === true || typeof options.onSelect === 'function';
        const tag = options.element || (interactive ? 'button' : 'article');
        const node = element(tag, 'ake-ui-card');
        node.dataset.akeComponent = 'card';
        if (tag === 'button') node.type = 'button';
        enhanceCard(node, options);

        let media = null;
        if (options.media?.src || isNode(options.media)) {
            media = element('div', 'ake-ui-card__media');
            if (isNode(options.media)) {
                media.appendChild(options.media);
            } else {
                const image = element('img');
                image.src = options.media.src;
                image.alt = options.media.alt || '';
                if (options.media.loading !== false) image.loading = 'lazy';
                media.appendChild(image);
            }
            node.classList.add('has-media');
        } else if (options.media?.placeholder) {
            media = element('div', 'ake-ui-card__media is-placeholder', options.media.placeholder);
            node.classList.add('has-media');
        }

        const content = element('div', 'ake-ui-card__content');
        const headerData = options.header || {};
        const hasHeader = Boolean(media) || isPresent(headerData.title) || isPresent(headerData.subtitle) || isPresent(headerData.id) || hasItems(headerData.badges);
        if (hasHeader) {
            const header = element('header', 'ake-ui-card__header');
            if (media) header.appendChild(media);
            const copy = element('div', 'ake-ui-card__heading');
            if (isPresent(headerData.title)) copy.appendChild(element('h3', 'ake-ui-card__title', headerData.title));
            if (isPresent(headerData.subtitle)) copy.appendChild(element('p', 'ake-ui-card__subtitle', headerData.subtitle));
            if (isPresent(headerData.id)) copy.appendChild(element('small', 'ake-ui-card__id', headerData.id));
            if (copy.childElementCount) header.appendChild(copy);
            if (hasItems(headerData.badges)) {
                const badges = element('div', 'ake-ui-card__badges');
                headerData.badges.forEach(item => {
                    const node = badge(item);
                    if (node) badges.appendChild(node);
                });
                if (badges.childElementCount) header.appendChild(badges);
            }
            content.appendChild(header);
        }

        const meta = metaGrid(options.meta, options.metaOptions);
        if (meta) content.appendChild(meta);
        (options.sections || []).forEach(definition => {
            const node = section(definition);
            if (node) content.appendChild(node);
        });

        if (hasItems(options.actions)) {
            const actions = element('div', 'ake-ui-card__actions');
            options.actions.filter(isPresent).forEach(action => appendContent(actions, action));
            if (actions.childNodes.length) content.appendChild(actions);
        }
        if (isPresent(options.footer)) {
            const footer = element('footer', 'ake-ui-card__footer');
            appendContent(footer, options.footer);
            content.appendChild(footer);
        }
        if (content.childElementCount) node.appendChild(content);

        return node;
    }

    function stateView(options = {}) {
        const node = element('div', 'ake-ui-state');
        node.dataset.state = options.state || 'empty';
        if (options.density) node.dataset.density = options.density;
        if (options.layout) node.dataset.layout = options.layout;
        if (options.indicator === false || options.spinner === false) node.dataset.indicator = 'none';
        if (options.icon) appendContent(node, options.icon);
        if (isPresent(options.title)) node.appendChild(element('strong', 'ake-ui-state__title', options.title));
        if (isPresent(options.message)) node.appendChild(element('p', 'ake-ui-state__message', options.message));
        if (isPresent(options.action)) appendContent(node, options.action);
        enhanceState(node);
        return node;
    }

    function enhanceState(node) {
        if (!(node instanceof Element) || !node.classList.contains('ake-ui-state')) return node;
        const state = node.dataset.state || (node.getAttribute('role') === 'alert' ? 'error' : 'empty');
        node.dataset.state = state;
        node.setAttribute('role', state === 'error' ? 'alert' : 'status');
        if (state === 'loading') {
            node.setAttribute('aria-live', 'polite');
            node.setAttribute('aria-busy', 'true');
        } else {
            node.removeAttribute('aria-live');
            node.removeAttribute('aria-busy');
        }
        return node;
    }

    function enhanceStates(root = document) {
        if (root.matches?.('.ake-ui-state')) enhanceState(root);
        root.querySelectorAll?.('.ake-ui-state').forEach(enhanceState);
    }

    function setState(target, options = {}) {
        if (!(target instanceof Element)) return null;
        const node = stateView(options);
        target.replaceChildren(node);
        return node;
    }

    function directoryItemMeta(entry) {
        if (!isPresent(entry)) return null;
        if (isNode(entry)) return entry;
        if (typeof entry === 'object' && entry.src) {
            const image = element('img', 'ake-ui-directory__item-meta-icon');
            image.src = entry.src;
            image.alt = entry.label || entry.alt || '';
            if (entry.tooltip !== false) image.title = entry.label || entry.title || '';
            image.loading = 'lazy';
            image.decoding = 'async';
            if (entry.kind) image.dataset.kind = entry.kind;
            return image;
        }
        const label = typeof entry === 'object' ? entry.label : entry;
        if (!isPresent(label)) return null;
        const tag = element('span', 'ake-ui-directory__item-tag', label);
        if (typeof entry === 'object' && entry.kind) tag.dataset.kind = entry.kind;
        return tag;
    }

    function setDirectoryItemActive(container, activeItem) {
        if (!(container instanceof Element)) return activeItem;
        container.querySelectorAll('.ake-ui-directory__item').forEach(item => {
            const active = item === activeItem;
            item.classList.toggle('is-active', active);
            if (active) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        });
        return activeItem;
    }

    function directoryItem(options = {}) {
        const classes = ['ake-ui-directory__item'];
        if (options.className) classes.push(options.className);
        const node = element(options.element || 'button', classes.join(' '));
        if (node.tagName === 'BUTTON') node.type = 'button';
        applyCommonState(node, options);
        applyAttributes(node, options.attributes);
        if (options.active) {
            node.classList.add('is-active');
            node.setAttribute('aria-current', 'true');
        }

        if (options.background?.src) {
            const background = element('img', options.background.className || 'ake-ui-directory__item-background');
            background.src = options.background.src;
            background.alt = options.background.alt || '';
            background.loading = 'lazy';
            background.decoding = 'async';
            if (!background.alt) background.setAttribute('aria-hidden', 'true');
            node.appendChild(background);
        }

        let icon = null;
        if (isNode(options.icon)) {
            icon = options.icon;
        } else if (options.icon?.src) {
            const iconClasses = ['ake-ui-directory__item-icon'];
            if (options.icon.className) iconClasses.push(options.icon.className);
            const image = element('img', iconClasses.join(' '));
            image.src = options.icon.src;
            image.alt = options.icon.alt || '';
            image.loading = 'lazy';
            image.decoding = 'async';
            icon = image;
        }
        if (icon) {
            if (options.layout === 'entity') {
                const media = element('span', 'ake-ui-directory__item-media');
                media.appendChild(icon);
                node.appendChild(media);
            } else {
                node.appendChild(icon);
            }
        }

        const copy = element('span', 'ake-ui-directory__item-copy');
        if (options.layout === 'entity') {
            const heading = element('span', 'ake-ui-directory__item-heading');
            if (isPresent(options.title)) heading.appendChild(element('strong', 'ake-ui-directory__item-title', options.title));
            (options.titleMeta || []).map(directoryItemMeta).filter(Boolean).forEach(item => heading.appendChild(item));
            if (isPresent(options.count)) heading.appendChild(element('span', 'ake-ui-directory__item-count', options.count));
            if (heading.childElementCount) copy.appendChild(heading);

            const supporting = element('span', 'ake-ui-directory__item-supporting');
            if (isPresent(options.id)) supporting.appendChild(element('small', 'ake-ui-directory__item-id', options.id));
            else if (isPresent(options.subtitle)) supporting.appendChild(element('small', 'ake-ui-directory__item-subtitle', options.subtitle));
            const meta = element('span', 'ake-ui-directory__item-meta');
            (options.meta || []).map(directoryItemMeta).filter(Boolean).forEach(item => meta.appendChild(item));
            if (meta.childElementCount) supporting.appendChild(meta);
            if (supporting.childElementCount) copy.appendChild(supporting);
        } else {
            if (isPresent(options.title)) copy.appendChild(element('strong', 'ake-ui-directory__item-title', options.title));
            if (isPresent(options.subtitle)) copy.appendChild(element('small', 'ake-ui-directory__item-subtitle', options.subtitle));
        }
        if (copy.childElementCount) node.appendChild(copy);
        if (isPresent(options.trailing)) {
            const tail = element('span', 'ake-ui-directory__item-tail');
            appendContent(tail, options.trailing);
            node.appendChild(tail);
        }
        if (options.layout !== 'entity' && isPresent(options.count)) node.appendChild(element('span', 'ake-ui-directory__item-count', options.count));
        if (typeof options.onSelect === 'function' && !options.disabled) {
            node.addEventListener('click', event => options.onSelect(event, node));
        }
        return node;
    }

    function setDisclosureButtonExpanded(button, expanded) {
        if (!(button instanceof HTMLButtonElement)) return button;
        const isExpanded = Boolean(expanded);
        button.setAttribute('aria-expanded', String(isExpanded));
        const label = isExpanded ? button.dataset.collapseLabel : button.dataset.expandLabel;
        if (isPresent(label)) button.textContent = label;
        return button;
    }

    function disclosureButton(options = {}) {
        const classes = ['ake-ui-disclosure-button'];
        if (options.className) classes.push(...String(options.className).split(/\s+/).filter(Boolean));
        const button = element('button', classes.join(' '));
        button.type = 'button';
        if (isPresent(options.expandLabel || options.label)) button.dataset.expandLabel = options.expandLabel || options.label;
        if (isPresent(options.collapseLabel || options.label)) button.dataset.collapseLabel = options.collapseLabel || options.label;
        setDisclosureButtonExpanded(button, options.expanded);
        applyAttributes(button, options.attributes);
        if (options.disabled) {
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        }
        if (typeof options.onToggle === 'function' && !options.disabled) {
            button.addEventListener('click', event => {
                const nextExpanded = button.getAttribute('aria-expanded') !== 'true';
                options.onToggle(nextExpanded, event, button);
            });
        }
        return button;
    }

    function detailHeader(options = {}) {
        const headerClasses = ['ake-ui-detail-header'];
        if (options.className) headerClasses.push(...String(options.className).split(/\s+/).filter(Boolean));
        const header = element(options.element || 'header', headerClasses.join(' '));
        if (options.layout) header.dataset.layout = options.layout;
        applyAttributes(header, options.attributes);

        let media = null;
        if (options.icon?.src || isNode(options.icon)) {
            const mediaClass = options.iconClassName
                || (options.layout === 'showcase' ? 'ake-ui-detail-icon' : 'ake-ui-detail-media');
            media = element('div', mediaClass);
            if (isNode(options.icon)) {
                media.appendChild(options.icon);
            } else {
                const image = element('img');
                image.src = options.icon.src;
                image.alt = options.icon.alt || '';
                applyAttributes(image, options.icon.attributes);
                media.appendChild(image);
            }
        }

        const hasCopy = isPresent(options.title)
            || isPresent(options.id)
            || isPresent(options.eyebrow)
            || isPresent(options.beforeTitle)
            || isPresent(options.subtitle)
            || isPresent(options.content)
            || hasItems(options.badges)
            || hasItems(options.meta);
        let copy = null;
        if (hasCopy) {
            copy = element('div', 'ake-ui-detail-copy');
            if (isPresent(options.beforeTitle)) appendContent(copy, options.beforeTitle);
            if (isPresent(options.eyebrow)) copy.appendChild(element('div', 'ake-ui-detail-eyebrow', options.eyebrow));
            if (isPresent(options.title) || isPresent(options.id) || hasItems(options.badges)) {
                const titleRow = element('div', 'ake-ui-detail-title-row');
                if (isPresent(options.title)) {
                    const title = element(options.titleElement || 'h2', 'ake-ui-detail-title', options.title);
                    applyAttributes(title, options.titleAttributes);
                    titleRow.appendChild(title);
                }
                (options.badges || []).forEach(item => {
                    const badgeNode = badge(item);
                    if (badgeNode) titleRow.appendChild(badgeNode);
                });
                if (isPresent(options.id)) titleRow.appendChild(element('small', 'ake-ui-detail-id', options.id));
                if (titleRow.childElementCount) copy.appendChild(titleRow);
            }
            if (isPresent(options.subtitle)) copy.appendChild(element('p', 'ake-ui-detail-subtitle', options.subtitle));
            const meta = metaGrid(options.meta, options.metaOptions);
            if (meta) copy.appendChild(meta);
            if (isPresent(options.content)) appendContent(copy, options.content);
        }

        const useIdentity = options.layout === 'showcase' || isPresent(options.visual) || isPresent(options.mainAfter);
        const identity = useIdentity ? element('div', 'ake-ui-detail-identity') : null;
        const primary = identity || header;
        if (media) primary.appendChild(media);
        if (copy?.childElementCount) primary.appendChild(copy);

        if (identity?.childElementCount) {
            if (isPresent(options.mainAfter)) {
                const main = element('div', 'ake-ui-detail-main');
                main.appendChild(identity);
                appendContent(main, options.mainAfter);
                header.appendChild(main);
            } else {
                header.appendChild(identity);
            }
        }

        if (isPresent(options.visual)) {
            const definition = isNode(options.visual) ? { content: options.visual } : options.visual;
            const visualClasses = ['ake-ui-detail-visual'];
            if (definition.className) visualClasses.push(...String(definition.className).split(/\s+/).filter(Boolean));
            const visual = element(definition.element || 'div', visualClasses.join(' '));
            applyAttributes(visual, definition.attributes);
            let visualContent = definition.content;
            if (!isPresent(visualContent) && definition.src) {
                const image = element('img');
                image.src = definition.src;
                image.alt = definition.alt || '';
                applyAttributes(image, definition.imageAttributes);
                visualContent = image;
            }
            if (isPresent(visualContent)) {
                if (definition.frame) {
                    const frame = element('div', 'ake-ui-detail-visual-frame');
                    appendContent(frame, visualContent);
                    visual.appendChild(frame);
                } else {
                    appendContent(visual, visualContent);
                }
            }
            if (visual.childNodes.length) header.appendChild(visual);
        }
        if (isPresent(options.after)) appendContent(header, options.after);

        return header.childElementCount ? header : null;
    }

    function directory(options = {}) {
        const root = element(options.element || 'div', 'ake-ui-directory');
        if (options.moduleId) root.dataset.akeModule = options.moduleId;
        const sidebar = element('aside', 'ake-ui-directory__sidebar');
        if (isPresent(options.sidebarHeader)) sidebar.appendChild(element('header', 'ake-ui-directory__sidebar-header', options.sidebarHeader));
        if (isNode(options.search)) sidebar.appendChild(options.search);
        const list = element(options.listElement || 'nav', 'ake-ui-directory__list');
        (options.items || []).filter(isPresent).forEach(item => appendContent(list, item));
        sidebar.appendChild(list);
        root.appendChild(sidebar);
        const content = element(options.contentElement || 'main', 'ake-ui-directory__content');
        if (isPresent(options.content)) appendContent(content, options.content);
        root.appendChild(content);
        return { root, sidebar, list, content };
    }

    function popover(options = {}) {
        if (!isPresent(options.content)) return null;

        const rootClasses = ['ake-ui-popover-anchor'];
        if (options.className) rootClasses.push(...String(options.className).split(/\s+/).filter(Boolean));
        const root = element(options.element || 'span', rootClasses.join(' '));

        const triggerClasses = ['ake-ui-popover__trigger'];
        if (options.triggerClassName) triggerClasses.push(...String(options.triggerClassName).split(/\s+/).filter(Boolean));
        const triggerContent = isPresent(options.trigger) ? options.trigger : options.label;
        const trigger = element(options.triggerElement || 'button', triggerClasses.join(' '), triggerContent);
        if (trigger instanceof HTMLButtonElement) trigger.type = 'button';
        trigger.setAttribute('data-ake-popover-trigger', '');
        trigger.setAttribute('data-ake-popover-pin', '');
        trigger.setAttribute('aria-expanded', 'false');
        if (options.ariaLabel) trigger.setAttribute('aria-label', options.ariaLabel);
        applyAttributes(trigger, options.triggerAttributes);

        const panelClasses = ['ake-ui-popover', 'ake-ui-popover__panel'];
        if (options.panelClassName) panelClasses.push(...String(options.panelClassName).split(/\s+/).filter(Boolean));
        const panel = element(options.panelElement || 'span', panelClasses.join(' '), options.content);
        panel.id = `akeUiPopover-${++popoverSequence}`;
        panel.dataset.placement = options.placement || 'top';
        panel.setAttribute('data-ake-popover-pinnable', '');
        panel.setAttribute('role', options.role || 'tooltip');
        applyAttributes(panel, options.panelAttributes);
        trigger.setAttribute('aria-describedby', panel.id);

        root.appendChild(trigger);
        if (isPresent(options.afterTrigger)) appendContent(root, options.afterTrigger);
        root.appendChild(panel);
        return root;
    }

    function materialItem(data = {}) {
        if (!data || (!isPresent(data.name) && !isPresent(data.icon))) return null;
        const classes = ['ake-ui-material__item'];
        if (data.className) classes.push(...String(data.className).split(/\s+/).filter(Boolean));
        const item = element(data.element || 'span', classes.join(' '));
        applyAttributes(item, data.attributes);
        if (isPresent(data.description)) item.title = String(data.description);
        if (isPresent(data.icon)) {
            const image = element('img', 'ake-ui-material__item-icon');
            image.src = data.icon;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            item.appendChild(image);
        }
        if (isPresent(data.name)) item.appendChild(element('span', 'ake-ui-material__item-name', data.name));
        if (isPresent(data.count)) item.appendChild(element('strong', 'ake-ui-material__item-count', `×${data.count}`));
        return item;
    }

    function materialItems(items, className = 'ake-ui-material__items') {
        const list = element('span', className);
        (items || []).forEach(data => {
            const item = materialItem(data);
            if (item) list.appendChild(item);
        });
        return list.childElementCount ? list : null;
    }

    function materialPopover(options = {}) {
        const rows = (options.rows || []).filter(row => row && hasItems(row.items));
        const directItems = (options.items || []).filter(Boolean);
        if (!rows.length && !directItems.length) return null;

        const icons = materialItems(options.icons || [], 'ake-ui-material__icons');
        const content = document.createDocumentFragment();

        rows.forEach(rowData => {
            const row = element('span', 'ake-ui-material__row');
            if (rowData.className) row.classList.add(...String(rowData.className).split(/\s+/).filter(Boolean));
            if (isPresent(rowData.label)) row.appendChild(element('span', 'ake-ui-material__row-label', rowData.label));
            const items = materialItems(rowData.items);
            if (items) row.appendChild(items);
            if (row.childElementCount) content.appendChild(row);
        });
        if (directItems.length) {
            const items = materialItems(directItems, 'ake-ui-material__items ake-ui-material__items--stacked');
            if (items) content.appendChild(items);
        }
        return popover({
            label: options.label,
            placement: options.placement,
            className: ['ake-ui-material', options.className || ''].filter(Boolean).join(' '),
            triggerClassName: 'ake-ui-material__trigger',
            panelClassName: 'ake-ui-material__popover',
            content,
            afterTrigger: icons
        });
    }

    function progressionStat(options = {}) {
        if (!isPresent(options.content) && !isPresent(options.label) && !isPresent(options.value)) return null;
        const stat = element('span', 'ake-ui-progression__stat');
        if (isPresent(options.content)) {
            appendContent(stat, options.content);
        } else {
            if (isPresent(options.label)) stat.appendChild(element('span', null, options.label));
            if (isPresent(options.value)) stat.appendChild(element('strong', null, options.value));
        }
        if (isPresent(options.meta)) appendContent(stat, options.meta);
        return stat;
    }

    function progressionRow(options = {}) {
        const row = element(options.element || 'div', 'ake-ui-progression__row');
        if (options.className) row.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
        if (options.kind) row.dataset.progressionKind = options.kind;
        applyAttributes(row, options.attributes);

        if (isPresent(options.stage)) row.appendChild(element('div', 'ake-ui-progression__stage', options.stage));

        let content = null;
        if (hasItems(options.stats)) {
            content = element('div', 'ake-ui-progression__stats');
            options.stats.forEach(definition => {
                const stat = isNode(definition) ? definition : progressionStat(definition);
                if (stat) content.appendChild(stat);
            });
        } else if (isPresent(options.content)) {
            content = element('div', 'ake-ui-progression__content');
            appendContent(content, options.content);
        } else if (isPresent(options.title) || isPresent(options.description)) {
            content = element('div', 'ake-ui-progression__copy');
            if (isPresent(options.title)) content.appendChild(element('div', 'ake-ui-progression__title', options.title));
            if (isPresent(options.description)) content.appendChild(element('div', 'ake-ui-progression__description', options.description));
        }
        if (content) row.appendChild(content);

        if (isPresent(options.action)) {
            const action = element('div', 'ake-ui-progression__action');
            appendContent(action, options.action);
            row.appendChild(action);
        }
        return row;
    }

    function progressionList(options = {}) {
        const list = element(options.element || 'div', 'ake-ui-progression');
        if (options.className) list.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
        (options.rows || []).forEach(definition => {
            const row = isNode(definition) ? definition : progressionRow(definition);
            if (row) list.appendChild(row);
        });
        if (!list.childElementCount && isPresent(options.empty)) appendContent(list, options.empty);
        return list;
    }

    const popoverFrames = new WeakMap();

    function getPopoverTrigger(anchor) {
        return anchor.querySelector?.(':scope > [data-ake-popover-trigger]') || anchor;
    }

    function positionPopoverArrow(popover, anchor) {
        if (!(popover instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
        const popoverRect = popover.getBoundingClientRect();
        if (!popoverRect.width || !popoverRect.height) return;
        const anchorRect = getPopoverTrigger(anchor).getBoundingClientRect();
        const edgeInset = 14;
        const arrowLeft = Math.max(
            edgeInset,
            Math.min(anchorRect.left + anchorRect.width / 2 - popoverRect.left, popoverRect.width - edgeInset)
        );
        popover.style.setProperty('--ake-ui-popover-arrow-left', `${Math.round(arrowLeft)}px`);
    }

    function positionAnchoredPopover(anchor, popover = null) {
        if (!(anchor instanceof HTMLElement)) return;
        const target = popover || Array.from(anchor.children).find(child => child.classList?.contains('ake-ui-popover'));
        if (!(target instanceof HTMLElement) || target.dataset.position === 'manual') return;

        target.style.setProperty('--ake-ui-popover-shift-x', '0px');
        const popoverRect = target.getBoundingClientRect();
        if (!popoverRect.width || !popoverRect.height) return;

        const viewportInset = 10;
        const anchorRect = anchor.getBoundingClientRect();
        const triggerRect = getPopoverTrigger(anchor).getBoundingClientRect();
        const contentBoundary = anchor.closest('.ake-ui-directory__content');
        const contentRect = contentBoundary?.getBoundingClientRect();
        const minLeft = Math.max(viewportInset, contentRect ? contentRect.left + viewportInset : viewportInset);
        const maxRight = Math.min(
            window.innerWidth - viewportInset,
            contentRect ? contentRect.right - viewportInset : window.innerWidth - viewportInset
        );
        const preferredShift = triggerRect.left + triggerRect.width / 2 - (anchorRect.left + anchorRect.width / 2);
        const minShift = minLeft - popoverRect.left;
        const maxShift = maxRight - popoverRect.right;
        const shiftX = minShift <= maxShift
            ? Math.min(Math.max(preferredShift, minShift), maxShift)
            : minShift;
        target.style.setProperty('--ake-ui-popover-shift-x', `${Math.round(shiftX)}px`);

        const shiftedLeft = popoverRect.left + shiftX;
        const edgeInset = 14;
        const arrowLeft = Math.max(
            edgeInset,
            Math.min(triggerRect.left + triggerRect.width / 2 - shiftedLeft, popoverRect.width - edgeInset)
        );
        target.style.setProperty('--ake-ui-popover-arrow-left', `${Math.round(arrowLeft)}px`);
    }

    function scheduleAnchoredPopover(anchor) {
        if (!(anchor instanceof HTMLElement)) return;
        const currentFrame = popoverFrames.get(anchor);
        if (currentFrame) cancelAnimationFrame(currentFrame);
        const frame = requestAnimationFrame(() => {
            popoverFrames.delete(anchor);
            positionAnchoredPopover(anchor);
        });
        popoverFrames.set(anchor, frame);
    }

    function repositionVisiblePopovers() {
        document.querySelectorAll('.ake-ui-popover-anchor, [data-ake-popover-anchor]').forEach(anchor => {
            const popover = Array.from(anchor.children).find(child => child.classList?.contains('ake-ui-popover'));
            if (popover?.getClientRects().length) positionAnchoredPopover(anchor, popover);
        });
    }

    function closePinnedPopovers(except = null) {
        document.querySelectorAll('[data-ake-popover-pinnable].pinned').forEach(popover => {
            if (popover === except) return;
            popover.classList.remove('pinned');
            const anchor = popover.closest('.ake-ui-popover-anchor, [data-ake-popover-anchor]');
            getPopoverTrigger(anchor)?.setAttribute('aria-expanded', 'false');
        });
    }

    document.addEventListener('click', event => {
        if (!openSelectInstance) return;
        if (openSelectInstance.shell.contains(event.target) || openSelectInstance.menu.contains(event.target)) return;
        openSelectInstance.close();
    });
    document.addEventListener('click', event => {
        const trigger = event.target.closest?.('[data-ake-popover-pin]');
        if (trigger) {
            const anchor = trigger.closest('.ake-ui-popover-anchor, [data-ake-popover-anchor]');
            const popover = anchor && Array.from(anchor.children).find(child => child.matches?.('[data-ake-popover-pinnable]'));
            if (!popover) return;
            const willPin = !popover.classList.contains('pinned');
            closePinnedPopovers(popover);
            popover.classList.toggle('pinned', willPin);
            trigger.setAttribute('aria-expanded', String(willPin));
            if (willPin) scheduleAnchoredPopover(anchor);
            return;
        }
        if (event.target.closest?.('[data-ake-popover-pinnable].pinned')) return;
        closePinnedPopovers();
    });
    document.addEventListener('pointerover', event => {
        const anchor = event.target.closest?.('.ake-ui-popover-anchor, [data-ake-popover-anchor]');
        if (anchor && !anchor.contains(event.relatedTarget)) scheduleAnchoredPopover(anchor);
    });
    document.addEventListener('focusin', event => {
        const anchor = event.target.closest?.('.ake-ui-popover-anchor, [data-ake-popover-anchor]');
        if (anchor) scheduleAnchoredPopover(anchor);
    });
    document.addEventListener('click', event => {
        const anchor = event.target.closest?.('.ake-ui-popover-anchor, [data-ake-popover-anchor]');
        if (anchor) scheduleAnchoredPopover(anchor);
    }, true);
    new MutationObserver(records => {
        records.forEach(record => Array.from(record.addedNodes).forEach(node => {
            if (node instanceof Element) {
                enhanceSelects(node);
                enhanceStates(node);
            }
        }));
        if (openSelectInstance && openSelectInstance.trigger.offsetParent === null) openSelectInstance.close();
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', () => {
        openSelectInstance?.positionMenu();
        repositionVisiblePopovers();
    });
    window.addEventListener('scroll', () => openSelectInstance?.positionMenu(), true);

    window.AKEUI = Object.freeze({
        isPresent,
        element,
        fragment,
        filterButton,
        updateFilterPanel,
        refreshSelect,
        enhanceCard,
        badge,
        metaGrid,
        dataTable,
        section,
        card,
        stateView,
        setState,
        directoryItem,
        setDirectoryItemActive,
        detailHeader,
        disclosureButton,
        setDisclosureButtonExpanded,
        directory,
        popover,
        materialItem,
        materialItems,
        materialPopover,
        progressionStat,
        progressionRow,
        progressionList,
        positionAnchoredPopover,
        positionPopoverArrow
    });

    enhanceSelects();
    enhanceStates();
})();
