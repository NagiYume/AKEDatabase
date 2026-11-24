(function () {
    const root = document.querySelector('.ake-ui-directory[data-ake-module="akegf"]');
    const t = window.akeI18n.scope('modules.akegf');
    const article = root.querySelector('[data-document]');
    const form = root.querySelector('form');
    const input = form.querySelector('textarea');
    const fileInput = form.querySelector('[type=file]');
    const result = form.querySelector('output');
    const downloads = root.querySelector('[data-downloads]');
    const overlay = root.querySelector('.ake-ui-directory__mobile-overlay');
    const menu = root.querySelector('.ake-ui-directory__mobile-button');
    const closeButton = overlay.querySelector('[data-close]');
    const language = window.akeI18n.getLanguageInfo().directory;
    const version = window.__akeBootstrapVersion?.pluginversion?.akegf || '';
    const suffix = '?v=' + encodeURIComponent(version);
    const dataPath = '/plugin/data/akegf/';
    const pages = ['home', 'standard', 'validator', 'partners'];
    let pageRequest = 0;
    let inputRevision = 0;
    let schemaCheck;

    async function resource(path) {
        const response = await fetch(path + suffix);
        if (!response.ok) throw new Error(path + ' (HTTP ' + response.status + ')');
        return response;
    }

    function loadCheck() {
        if (!schemaCheck) {
            schemaCheck = resource(dataPath + 'akegf-v0.3.schema.json')
                .then(response => response.json())
                .then(schema => new window.ajv2020({
                    allErrors: true, strictRequired: false, ownProperties: true, verbose: true
                }).compile(schema))
                .catch(error => {
                    schemaCheck = null;
                    throw error;
                });
        }
        return schemaCheck;
    }

    function checkIdentities(groups) {
        const identities = new Set();
        for (const [index, group] of groups.entries()) {
            const path = '/endfield/' + index;
            const key = JSON.stringify([group.region ?? 'cn', group.server_id ?? '1', group.uid]);
            if (identities.has(key)) return path + ' · ' + t('duplicateRole');
            identities.add(key);
            const records = new Set();
            for (const [row, entry] of group.list.entries()) {
                if (!entry.record_type || !entry.seq_id) continue;
                const recordKey = JSON.stringify([entry.record_type, entry.seq_id]);
                if (records.has(recordKey)) return path + '/list/' + row + '/seq_id · ' + t('duplicateRecord');
                records.add(recordKey);
            }
        }
        return '';
    }

    function describeIssue(error) {
        const params = error.params;
        const message = t('issue.' + error.keyword, {
            field: params.missingProperty ?? params.additionalProperty ?? error.schema?.required?.join(', '),
            value: params.type ?? params.limit ?? params.allowedValues?.join(', ') ?? params.allowedValue,
            property: params.property
        }, error.message);
        return (error.instancePath || '/') + ' · ' + message;
    }

    async function validate() {
        const revision = ++inputRevision;
        let archive;
        try {
            archive = JSON.parse(input.value.replace(/^\uFEFF/, ''));
        } catch (error) {
            result.textContent = t('syntax') + '\n' + error.message;
            return;
        }
        result.textContent = t('checking');
        try {
            const check = await loadCheck();
            if (revision !== inputRevision) return;
            if (!check(archive)) {
                const issues = check.errors.filter(error => error.keyword !== 'if').slice(0, 60).map(describeIssue);
                result.textContent = [t('invalid'), ...issues].join('\n');
                return;
            }
            const duplicate = checkIdentities(archive.endfield);
            result.textContent = duplicate ? t('invalid') + '\n' + duplicate : t('valid', {
                groups: archive.endfield.length,
                records: archive.endfield.reduce((sum, group) => sum + group.list.length, 0)
            });
        } catch (error) {
            if (revision === inputRevision) result.textContent = t('failed') + '\n' + error.message;
        }
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        validate();
    });
    input.addEventListener('input', () => {
        inputRevision++;
        result.textContent = '';
    });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        fileInput.value = '';
        const revision = ++inputRevision;
        result.textContent = t('loading');
        try {
            const source = await file.text();
            if (revision !== inputRevision) return;
            input.value = source;
            validate();
        } catch (error) {
            if (revision === inputRevision) result.textContent = t('readError') + '\n' + error.message;
        }
    });

    function setMenu(open) {
        overlay.classList.toggle('is-open', open);
        overlay.setAttribute('aria-hidden', String(!open));
        menu.setAttribute('aria-expanded', String(open));
        (open ? closeButton : menu).focus();
    }

    async function select(page) {
        const request = ++pageRequest;
        root.dataset.akeCurrentPage = page;
        window.__akeRouter.updateUrl('akegf', page);
        if (overlay.classList.contains('is-open')) setMenu(false);
        root.querySelectorAll('[data-pages]').forEach(nav => {
            window.AKEUI.setDirectoryItemActive(nav, nav.querySelector('[data-page="' + page + '"]'));
        });
        root.querySelector('main').scrollTop = 0;
        form.hidden = true;
        downloads.hidden = true;
        article.textContent = t('loading');
        try {
            const path = '/public/' + language + '/akegf/' + page + '.md';
            const response = await resource(path);
            const markdown = await response.text();
            if (request !== pageRequest) return;
            const fragment = await window.akeRenderMarkdown(markdown, path);
            if (request !== pageRequest) return;
            article.replaceChildren(fragment);
            form.hidden = page !== 'validator';
            downloads.hidden = page !== 'standard';
        } catch (error) {
            if (request !== pageRequest) return;
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'ake-ui-button';
            retry.textContent = t('retry');
            retry.onclick = () => select(page);
            article.replaceChildren(t('failed') + ' · ' + error.message + ' ', retry);
        }
    }

    root.querySelectorAll('[data-pages]').forEach(nav => {
        for (const page of pages) {
            const item = window.AKEUI.directoryItem({
                element: 'a',
                title: t(page),
                attributes: { href: window.__akeRouter.entryUrl('akegf', page) }
            });
            item.dataset.page = page;
            item.onclick = event => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                select(page);
            };
            nav.append(item);
        }
    });
    root.querySelectorAll('[data-download]').forEach(link => {
        link.href = dataPath + link.dataset.download + suffix;
    });
    menu.onclick = () => setMenu(true);
    closeButton.onclick = () => setMenu(false);
    overlay.onclick = event => { if (event.target === overlay) setMenu(false); };
    overlay.onkeydown = event => { if (event.key === 'Escape') setMenu(false); };
    const initialPage = window.__deepLinkId || 'home';
    window.__deepLinkId = null;
    if (pages.includes(initialPage)) {
        select(initialPage);
    } else {
        window.AKEUI.setState(article, { state: 'error', message: window.akeI18n.t('errors.notFoundTitle') });
    }
})();
