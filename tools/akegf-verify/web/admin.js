'use strict';

const login = document.getElementById('login');
const loginControls = document.getElementById('login-controls');
const tokenInput = document.getElementById('token');
const management = document.getElementById('management');
const managementControls = document.getElementById('management-controls');
const upload = document.getElementById('upload');
const providerInput = document.getElementById('provider');
const kindInput = document.getElementById('kind');
const pemInput = document.getElementById('pem');
const publicKeys = document.getElementById('public-keys');
const privateKeys = document.getElementById('private-keys');
const notice = document.getElementById('notice');
const api = '/admin/v1';
const errors = new Map([
    ['invalid_rsa_pem', 'PEM 格式或 RSA 密钥无效。请核对所选类型与文件。'],
    ['public_key_conflict', '此公钥指纹已撤销或存在冲突。'],
    ['key_not_found', '密钥不存在。'],
    ['key_operation_failed', '服务器未能完成操作。请刷新列表确认当前状态。'],
]);
let token = '';
let busy = false;

function show(message) {
    notice.textContent = message;
    notice.hidden = !message;
}

function clearSession() {
    token = '';
    tokenInput.value = '';
    upload.reset();
    publicKeys.replaceChildren();
    privateKeys.replaceChildren();
    management.hidden = true;
    login.hidden = false;
}

async function request(path, { method = 'GET', pem } = {}) {
    const headers = { Authorization: 'Bearer ' + token };
    if (pem) headers['Content-Type'] = 'application/x-pem-file';
    let response;
    try {
        response = await fetch(api + path, {
            method, headers, body: pem, cache: 'no-store',
            credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(60000),
        });
    } catch {
        throw new Error('连接管理服务失败。');
    }
    if (response.status === 401) {
        clearSession();
        throw new Error('管理口令无效，请重新登录。');
    }
    if (response.status === 429) throw new Error('请求过于频繁，请稍后重试。');
    if (response.status === 413) throw new Error('PEM 文件不得超过 16 KiB。');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(errors.get(result.error) || '请求失败（HTTP ' + response.status + '）。');
    }
    return result;
}

async function run(action) {
    if (busy) return;
    busy = true;
    loginControls.disabled = true;
    managementControls.disabled = true;
    show('');
    try {
        await action();
    } catch (error) {
        show(error.message);
    } finally {
        busy = false;
        loginControls.disabled = false;
        managementControls.disabled = false;
    }
}

function keyPath(provider, kind) {
    return '/providers/' + encodeURIComponent(provider) + '/' + kind;
}

async function refresh() {
    const data = await request('/keys');
    renderKeys(publicKeys, data.public_keys, 'public-keys');
    renderKeys(privateKeys, data.private_keys, 'private-keys');
}

async function refreshAfter(message) {
    try {
        await refresh();
        show(message);
    } catch (error) {
        show(message + ' 列表刷新失败。' + error.message);
    }
}

function renderKeys(container, keys, kind) {
    container.replaceChildren();
    if (keys.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = '暂无密钥。';
        container.append(empty);
        return;
    }
    for (const key of keys) {
        const entry = document.createElement('article');
        const details = document.createElement('div');
        const provider = document.createElement('strong');
        const fingerprint = document.createElement('p');
        const isPublic = kind === 'public-keys';
        const revoked = key.status === 'revoked';
        entry.className = 'key key-entry';
        provider.textContent = isPublic ? key.provider + (revoked ? ' · 已撤销' : ' · 有效') : key.provider;
        fingerprint.className = 'fingerprint';
        fingerprint.textContent = key.kid;
        details.append(provider, fingerprint);
        entry.append(details);
        if (!revoked) {
            const button = document.createElement('button');
            const action = isPublic ? '撤销公钥' : '删除私钥';
            button.type = 'button';
            button.textContent = action;
            button.addEventListener('click', () => {
                const effect = isPublic ? '使用此公钥的档案将无法通过验签。' : '此操作将删除服务器上的私钥文件。';
                if (!window.confirm(action + '？\n' + key.provider + '\n' + key.kid + '\n' + effect)) return;
                run(async () => {
                    const path = keyPath(key.provider, kind) + '/' + encodeURIComponent(key.kid);
                    await request(path, { method: 'DELETE' });
                    await refreshAfter(isPublic ? '公钥已撤销。' : '私钥已删除。');
                });
            });
            entry.append(button);
        }
        container.append(entry);
    }
}

login.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
        token = tokenInput.value.trim();
        tokenInput.value = '';
        try {
            await refresh();
        } catch (error) {
            clearSession();
            throw error;
        }
        login.hidden = true;
        management.hidden = false;
    });
});

upload.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
        const pem = pemInput.files[0];
        if (!pem || pem.size === 0) throw new Error('请选择非空的 PEM 文件。');
        if (pem.size > 16 * 1024) throw new Error('PEM 文件不得超过 16 KiB。');
        const result = await request(keyPath(providerInput.value, kindInput.value), { method: 'POST', pem });
        pemInput.value = '';
        await refreshAfter('密钥已添加。' + result.kid);
    });
});

document.getElementById('refresh').addEventListener('click', () => run(async () => {
    await refresh();
    show('密钥列表已刷新。');
}));

document.getElementById('logout').addEventListener('click', () => {
    clearSession();
    show('已退出。');
    tokenInput.focus();
});
