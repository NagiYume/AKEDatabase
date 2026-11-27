(function () {
    const root = document.querySelector('.ake-ui-directory[data-ake-module="akegf"]');
    const t = window.akeI18n.scope('modules.akegf');
    const article = root.querySelector('[data-document]');
    const keyDirectory = root.querySelector('[data-key-directory]');
    const keyDirectoryContent = keyDirectory.querySelector('[data-key-directory-content]');
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
    const registry = 'https://verify.akedata.wiki/v1/providers';
    const exampleProvider = 'akegf-example';
    const pages = ['home', 'standard', 'validator', 'partners'];
    let pageRequest = 0;
    let inputRevision = 0;
    let keyDirectoryRequest;
    const schemaChecks = new Map();

    async function resource(path) {
        const response = await fetch(path + suffix);
        if (!response.ok) throw new Error(path + ' (HTTP ' + response.status + ')');
        return response;
    }

    function loadCheck(version) {
        const schemaVersion = version === 'v0.3' ? 'v0.3' : 'v0.4';
        if (!schemaChecks.has(schemaVersion)) {
            const check = resource(dataPath + 'akegf-' + schemaVersion + '.schema.json')
                .then(response => response.json())
                .then(schema => new window.ajv2020({
                    allErrors: true, strictRequired: false, ownProperties: true, verbose: true
                }).compile(schema))
                .catch(error => {
                    schemaChecks.delete(schemaVersion);
                    throw error;
                });
            schemaChecks.set(schemaVersion, check);
        }
        return schemaChecks.get(schemaVersion);
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
        if (error.keyword === 'pattern' && error.instancePath === '/info/export_provider') {
            return error.instancePath + ' · ' + t('providerFormat');
        }
        if (error.keyword === 'pattern' && error.instancePath === '/info/rsa_signature') {
            return error.instancePath + ' · ' + t('signatureFormat');
        }
        const params = error.params;
        const message = t('issue.' + error.keyword, {
            field: params.missingProperty ?? params.additionalProperty ?? error.schema?.required?.join(', '),
            value: params.type ?? params.limit ?? params.allowedValues?.join(', ') ?? params.allowedValue,
            property: params.property
        }, error.message);
        return (error.instancePath || '/') + ' · ' + message;
    }

    // JSON.parse discards earlier duplicates. Inspect the original member names
    // after it has checked the syntax.
    function hasDuplicateMembers(source) {
        const objects = [];
        for (let index = 0; index < source.length; index++) {
            const character = source[index];
            if (character === '{') {
                objects.push(new Set());
            } else if (character === '}') {
                objects.pop();
            } else if (character === '"') {
                const start = index++;
                for (; source[index] !== '"'; index++) {
                    if (source[index] === '\\') index++;
                }
                const end = index + 1;
                while (/\s/.test(source[index + 1] ?? '')) index++;
                if (source[index + 1] !== ':') continue;
                const key = JSON.parse(source.slice(start, end));
                const keys = objects[objects.length - 1];
                if (keys.has(key)) return true;
                keys.add(key);
            }
        }
        return false;
    }

    // The AKEGF schema bounds numbers to safe integers. JSON.stringify
    // handles the primitive serialization required by RFC 8785.
    function canonicalize(value) {
        if (typeof value === 'string' && /[\uD800-\uDFFF]/u.test(value)) {
            throw new Error('Invalid Unicode in JSON string');
        }
        if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
        if (value !== null && typeof value === 'object') {
            const members = Object.keys(value).sort().map(key =>
                canonicalize(key) + ':' + canonicalize(value[key]));
            return '{' + members.join(',') + '}';
        }
        return JSON.stringify(value);
    }

    function decodeBase64url(value) {
        return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    }

    async function verifySignature(archive) {
        const { rsa_signature: signature, ...info } = archive.info;
        if (signature === undefined) return 'unsigned';
        const [kid, encodedSignature] = signature.split('.');
        let message;
        try {
            message = new TextEncoder().encode('AKEGF-RSA-PSS-v1\n' + canonicalize({ ...archive, info }));
        } catch {
            return 'signatureInvalid';
        }
        try {
            const url = keyUrl(info.export_provider, kid);
            const response = await fetch(url, {
                cache: 'no-store', credentials: 'omit', redirect: 'error',
                referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000)
            });
            if (response.status === 404) return 'unknownKey';
            if (!response.ok) return 'registryUnavailable';
            const entry = await response.json();
            if (entry.provider !== info.export_provider || entry.kid !== kid || entry.alg !== 'PS256') {
                return 'registryUnavailable';
            }
            if (entry.status === 'revoked') return 'revokedKey';
            if (entry.status !== 'active') return 'registryUnavailable';
            const spki = decodeBase64url(entry.public_key);
            const subtle = window.crypto.subtle;
            const digest = new Uint8Array(await subtle.digest('SHA-256', spki));
            const expectedDigest = decodeBase64url(kid);
            if (!digest.every((byte, index) => byte === expectedDigest[index])) return 'registryUnavailable';
            const key = await subtle.importKey('spki', spki, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
            if (![2048, 3072, 4096].includes(key.algorithm.modulusLength)) return 'registryUnavailable';
            const bytes = decodeBase64url(encodedSignature);
            if (bytes.byteLength * 8 !== key.algorithm.modulusLength) return 'signatureInvalid';
            return await subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, key, bytes, message)
                ? 'signatureValid'
                : 'signatureInvalid';
        } catch {
            return 'registryUnavailable';
        }
    }

    async function validate() {
        const revision = ++inputRevision;
        const source = input.value.replace(/^\uFEFF/, '');
        let archive;
        try {
            archive = JSON.parse(source);
        } catch (error) {
            result.textContent = t('syntax') + '\n' + error.message;
            return;
        }
        if (hasDuplicateMembers(source)) {
            result.textContent = t('invalid') + '\n' + t('duplicateMember');
            return;
        }
        result.textContent = t('checking');
        try {
            const check = await loadCheck(archive?.info?.version);
            if (revision !== inputRevision) return;
            if (!check(archive)) {
                const issues = check.errors.filter(error => error.keyword !== 'if').slice(0, 60).map(describeIssue);
                result.textContent = [t('invalid'), ...issues].join('\n');
                return;
            }
            const duplicate = checkIdentities(archive.endfield);
            if (duplicate) {
                result.textContent = t('invalid') + '\n' + duplicate;
                return;
            }
            const summary = t('valid', {
                version: archive.info.version,
                groups: archive.endfield.length,
                records: archive.endfield.reduce((sum, group) => sum + group.list.length, 0)
            });
            const status = await verifySignature(archive);
            if (revision === inputRevision) {
                const provider = archive.info.export_provider;
                const verified = status === 'signatureValid';
                const message = verified && provider === exampleProvider ? 'exampleSignatureValid' : status;
                const messages = [summary, t(message, { provider })];
                if (!verified) messages.push(t('unverifiedUsage'));
                result.textContent = messages.join('\n');
            }
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
            const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
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

    function keyUrl(provider, kid) {
        return registry + '/' + encodeURIComponent(provider) + '/keys/' + encodeURIComponent(kid) + '.json';
    }

    function renderKeyDirectory(providers) {
        const content = document.createDocumentFragment();
        for (const { provider, keys } of providers) {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.textContent = provider;
            section.append(heading);
            for (const key of keys) {
                if (key.status !== 'active' && key.status !== 'revoked') throw new Error('Unknown key status');
                const active = key.status === 'active';
                const meta = document.createElement('p');
                const link = document.createElement('a');
                link.href = keyUrl(provider, key.kid);
                link.textContent = t('keyDirectory.json');
                meta.append(t(active ? 'keyDirectory.active' : 'keyDirectory.revoked') + ' · ' + key.alg + ' · ', link);
                const fingerprint = document.createElement('p');
                const kid = document.createElement('code');
                kid.className = 'inline-code';
                kid.textContent = key.kid;
                fingerprint.append(t('keyDirectory.fingerprint') + ' ', kid);
                section.append(meta, fingerprint);
                if (active) {
                    const base64 = key.public_key.replace(/-/g, '+').replace(/_/g, '/');
                    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
                    const pem = document.createElement('pre');
                    const code = document.createElement('code');
                    pem.className = 'code-block';
                    pem.tabIndex = 0;
                    code.textContent = ['-----BEGIN PUBLIC KEY-----', ...padded.match(/.{1,64}/g), '-----END PUBLIC KEY-----'].join('\n');
                    pem.append(code);
                    section.append(pem);
                }
            }
            content.append(section);
        }
        return content;
    }

    async function loadKeyDirectory() {
        keyDirectoryRequest?.abort();
        const controller = new AbortController();
        keyDirectoryRequest = controller;
        const state = (type, message, action) => window.AKEUI.setState(keyDirectoryContent, {
            state: type, density: 'compact', message, action
        });
        state('loading', t('loading'));
        try {
            const response = await fetch(registry + '.json', {
                cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const { providers } = await response.json();
            if (controller.signal.aborted || !root.isConnected) return;
            if (!Array.isArray(providers)) throw new Error('Invalid provider directory');
            if (providers.length) {
                keyDirectoryContent.replaceChildren(renderKeyDirectory(providers));
            } else {
                state('empty', t('keyDirectory.empty'));
            }
        } catch {
            if (controller.signal.aborted || !root.isConnected) return;
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'ake-ui-button';
            retry.textContent = t('retry');
            retry.onclick = loadKeyDirectory;
            state('error', t('keyDirectory.failed'), retry);
        }
    }

    async function select(page) {
        const request = ++pageRequest;
        keyDirectoryRequest?.abort();
        keyDirectory.hidden = true;
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
            if (page === 'partners') {
                keyDirectory.hidden = false;
                loadKeyDirectory();
            }
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
