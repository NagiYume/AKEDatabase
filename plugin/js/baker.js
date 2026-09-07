(function () {
    'use strict';

    const root = document.getElementById('bakerModule');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const t = window.akeI18n.scope('modules.baker');
    const IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites';
    // Legacy ordinal mapping: see skills/akedatabase-development/references/data-contracts.md.
    const LEGACY_STICKER_PACK_SIZES = [16, 18, 20, 16, 16, 16, 16, 16];
    const indexedStickers = new Map();
    const unresolvedStickers = new Set();
    const CHAT_TYPES = {
        1: { label: t('contacts'), order: 2 },
        2: { label: t('groups'), order: 3 },
        3: { label: t('operators'), order: 1 }
    };
    const CONTENT_LABELS = {
        4: t('video'),
        5: t('voice'),
        6: t('item'),
        8: t('contactCard'),
        10: t('archive'),
        11: t('special'),
        12: t('mission')
    };

    const state = {
        chats: {},
        dialogs: {},
        options: {},
        topics: {},
        items: {},
        rows: [],
        rowById: new Map(),
        dialogsByChat: new Map(),
        topicByDialog: new Map(),
        choices: new Map(),
        selectedId: null,
        search: '',
        type: 'all'
    };

    const elements = {
        summary: document.getElementById('bakerContactSummary'),
        search: document.getElementById('bakerSearchInput'),
        filterPanel: document.getElementById('bakerFilterBar'),
        filters: document.getElementById('bakerTypeFilter'),
        list: document.getElementById('bakerContactList'),
        conversation: document.getElementById('bakerConversation'),
        mobile: document.getElementById('bakerMobileButton'),
        backdrop: document.getElementById('bakerMobileBackdrop')
    };
    window.AKEUI?.updateFilterPanel(elements.filterPanel, { summary: t('filter') });
    elements.filters.setAttribute('aria-label', t('types'));
    elements.mobile.setAttribute('aria-label', t('openContacts'));
    elements.backdrop.setAttribute('aria-label', t('closeContacts'));

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function richText(value) {
        const source = String(value || '');
        return window.parseText ? window.parseText(source, '/public/images/') : escapeHtml(source).replace(/\n/g, '<br>');
    }

    function naturalCompare(left, right) {
        return String(left || '').localeCompare(String(right || ''), 'zh-CN', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    function asset(path) {
        const value = String(path || '');
        return window.resolveImagePath ? window.resolveImagePath(value) : value;
    }

    function chatName(chat, fallback = '') {
        return chat?.name?.text || fallback || chat?.chatId || t('unknownContact');
    }

    function chatType(chat) {
        return CHAT_TYPES[Number(chat?.chatType)] || { label: t('chat'), order: 9 };
    }

    function avatarUrl(chat) {
        if (!chat?.icon) return '';
        return asset(`${IMAGE_ROOT}/charroundicon/${String(chat.icon).toLowerCase()}.png`);
    }

    function avatarHtml(chat, name, extraClass = '') {
        const url = avatarUrl(chat);
        const initial = Array.from(String(name || '?').trim())[0] || '?';
        if (!url) return `<span class="baker-avatar baker-avatar--placeholder ${extraClass}" aria-hidden="true">${escapeHtml(initial)}</span>`;
        return `<img class="baker-avatar ${extraClass}" src="${escapeHtml(url)}" alt="" loading="lazy">`;
    }

    function stickerUrl(resourceId) {
        const resource = String(resourceId || '').toLowerCase();
        if (indexedStickers.get(resource)) return asset(indexedStickers.get(resource));
        if (/^sns_sticker_\d{3}$/.test(resource)) {
            return asset(`${IMAGE_ROOT}/sns/sticker/${resource}.png`);
        }
        const emojiMatch = resource.match(/^sns_emoji_(\d{3})$/);
        if (!emojiMatch) {
            if (resource) unresolvedStickers.add(resource);
            return '';
        }
        let index = Number(emojiMatch[1]);
        for (let packIndex = 0; packIndex < LEGACY_STICKER_PACK_SIZES.length; packIndex += 1) {
            const packSize = LEGACY_STICKER_PACK_SIZES[packIndex];
            if (index <= packSize) {
                const pack = String(packIndex + 1).padStart(2, '0');
                const item = String(index).padStart(2, '0');
                return asset(`${IMAGE_ROOT}/sns/sticker/sns_sticker_${pack}/sns_sticker_${pack}_${item}.png`);
            }
            index -= packSize;
        }
        unresolvedStickers.add(resource);
        return '';
    }

    async function loadStickerIndex() {
        try {
            const index = await window.akeAssetIndex.load();
            for (const path of Object.keys(index.datasets.images?.files || {})) {
                const match = path.match(/(?:^|\/)sns\/sticker\/(?:[^/]+\/)*(sns_(?:emoji|sticker)_[^/]+)\.png$/i);
                if (!match) continue;
                const key = match[1].toLowerCase();
                const url = `/public/images/${path}`;
                if (!indexedStickers.has(key)) indexedStickers.set(key, url);
                else if (indexedStickers.get(key) !== url) indexedStickers.set(key, null);
            }
        } catch (error) {
            console.warn('Baker sticker index unavailable; retaining explicit legacy mappings', error);
        }
    }

    function contentText(node) {
        return node?.content?.text || '';
    }

    function dialogPreview(dialog) {
        const nodes = Object.values(dialog?.dialogContentData || {})
            .filter(node => Number(node.contentId) >= 0)
            .sort((a, b) => Number(a.contentId) - Number(b.contentId));
        for (let index = nodes.length - 1; index >= 0; index -= 1) {
            const text = contentText(nodes[index]);
            if (text) return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }
        return dialog?.relatedMissionId ? t('missionId', { id: dialog.relatedMissionId }) : '';
    }

    function buildRows() {
        state.dialogsByChat.clear();
        state.topicByDialog.clear();
        Object.values(state.dialogs).forEach(dialog => {
            if (!dialog?.chatId) return;
            if (!state.dialogsByChat.has(dialog.chatId)) state.dialogsByChat.set(dialog.chatId, []);
            state.dialogsByChat.get(dialog.chatId).push(dialog);
        });
        Object.values(state.topics).forEach(topic => {
            (topic?.includeDialogIds || []).forEach(dialogId => state.topicByDialog.set(dialogId, topic));
        });

        const allChatIds = new Set([...Object.keys(state.chats), ...state.dialogsByChat.keys()]);
        const rows = [];
        Array.from(allChatIds).forEach(chatId => {
            const chat = state.chats[chatId] || {
                chatId,
                chatType: chatId.startsWith('sns_chr_') ? 3 : chatId.startsWith('sns_chat_') ? 2 : 1,
                name: { text: '' },
                icon: ''
            };
            const name = chatName(chat, chatId);
            const dialogs = (state.dialogsByChat.get(chatId) || []).sort((a, b) => naturalCompare(a.dialogId, b.dialogId));
            const entries = dialogs.length ? dialogs : [null];
            entries.forEach(dialog => {
                const rowDialogs = dialog ? [dialog] : [];
                const topic = dialog ? state.topics[dialog.topicId] || state.topicByDialog.get(dialog.dialogId) : null;
                const dialogLabel = topic?.topicName?.text || topic?.topicStartOptionDesc?.text || dialog?.dialogId || chatId;
                const preview = dialog ? dialogPreview(dialog) || dialogLabel : t('emptyPreview');
                const messageText = dialog ? Object.values(dialog.dialogContentData || {}).map(contentText) : [];
                const optionText = dialog ? Object.values(dialog.dialogContentData || {}).flatMap(node =>
                    (node.dialogOptionIds || []).map(optionId => {
                        const option = state.options[optionId];
                        return option?.optionDesc?.text || option?.optionResPath || '';
                    })) : [];
                rows.push({
                    id: dialog?.dialogId || chatId,
                    chatId,
                    chat,
                    name,
                    dialogs: rowDialogs,
                    dialogLabel,
                    preview,
                    searchText: [chatId, dialog?.dialogId, name, dialogLabel, preview, ...messageText, ...optionText]
                        .filter(Boolean).join('\n').toLowerCase()
                });
            });
        });
        state.rows = rows.sort((left, right) =>
            chatType(left.chat).order - chatType(right.chat).order ||
            Number(right.dialogs.length > 0) - Number(left.dialogs.length > 0) ||
            naturalCompare(left.name, right.name) ||
            naturalCompare(left.id, right.id)
        );
        state.rowById = new Map(state.rows.map(row => [row.id, row]));
    }

    function filteredRows() {
        const query = state.search.trim().toLowerCase();
        return state.rows.filter(row =>
            (state.type === 'all' || String(row.chat.chatType) === state.type) &&
            (!query || row.searchText.includes(query))
        );
    }

    function createContactDirectoryItem(row) {
        const url = avatarUrl(row.chat);
        const initial = Array.from(String(row.name || '?').trim())[0] || '?';
        const icon = url
            ? { src: url, alt: '', className: 'baker-avatar' }
            : window.AKEUI.element('span', 'ake-ui-directory__item-icon baker-avatar baker-avatar--placeholder', initial);
        return window.AKEUI.directoryItem({
            layout: 'entity',
            title: row.name,
            subtitle: row.preview,
            icon,
            titleMeta: [{ label: chatType(row.chat).label, kind: 'baker-type' }],
            meta: [{ label: row.dialogLabel, kind: 'baker-dialog' }],
            active: row.id === state.selectedId,
            attributes: { 'data-baker-chat': row.id }
        });
    }

    function renderContacts() {
        const rows = filteredRows();
        const withMessages = state.rows.filter(row => row.dialogs.length).length;
        elements.summary.textContent = t('summary', { count: rows.length, total: state.rows.length, recorded: withMessages });
        if (!rows.length) {
            elements.list.innerHTML = `<div class="ake-ui-state" data-state="empty" data-density="compact">${escapeHtml(t('noMatches'))}</div>`;
            return;
        }
        elements.list.replaceChildren(...rows.map(createContactDirectoryItem));
    }

    function speakerInfo(speakerId, selectedRow) {
        const isSelf = !speakerId || speakerId === 'endmin' || speakerId === 'player';
        if (isSelf) return { id: 'endmin', name: t('self'), chat: null, isSelf: true };
        const chat = state.chats[speakerId] || (selectedRow.chatId === speakerId ? selectedRow.chat : null);
        return { id: speakerId, name: chatName(chat, speakerId), chat, isSelf: false };
    }

    function bubbleMessage(node, row, body) {
        const speaker = speakerInfo(node.speaker, row);
        return `<div class="baker-message${speaker.isSelf ? ' is-self' : ''}">
            ${speaker.isSelf ? '<span class="baker-avatar baker-avatar--self" aria-hidden="true">E</span>' : avatarHtml(speaker.chat, speaker.name)}
            <div class="baker-message__main">
                <div class="baker-message__speaker">${escapeHtml(speaker.name)}</div>
                <div class="baker-bubble">${body}</div>
            </div>
        </div>`;
    }

    function pictureHtml(node) {
        const names = (node.contentParam || []).filter(Boolean);
        if (!names.length) return '';
        return `<div class="baker-picture-grid">${names.map(name => {
            const source = asset(`${IMAGE_ROOT}/sns/picture/${String(name).toLowerCase()}.png`);
            return `<img src="${escapeHtml(source)}" alt="${escapeHtml(contentText(node) || name)}" loading="lazy">`;
        }).join('')}</div>`;
    }

    function attachmentHtml(label, title, detail, marker) {
        return `<div class="baker-attachment"><span class="baker-attachment__icon" aria-hidden="true">${escapeHtml(marker)}</span><div><strong>${escapeHtml(title || label)}</strong><small>${escapeHtml(detail || label)}</small></div></div>`;
    }

    function parseContentParams(value) {
        if (!value) return null;
        try { return JSON.parse(value); } catch { return null; }
    }

    function reactionHtml(node) {
        const reactions = parseContentParams(node.contentParams);
        if (!Array.isArray(reactions)) return `<div class="baker-system-message">${escapeHtml(t('reactions'))}</div>`;
        return `<div class="baker-reactions">${reactions.map(reaction => {
            const people = (reaction.npcIds || []).map(id => chatName(state.chats[id], id)).join('、');
            const resourceId = reaction.emojiResPath || '';
            const source = stickerUrl(resourceId);
            const emoji = source ? `<img class="baker-reaction__emoji" src="${escapeHtml(source)}" alt="${escapeHtml(resourceId)}" loading="lazy">` : escapeHtml(resourceId || t('emoji'));
            return `<span class="baker-reaction">${emoji}<span>${escapeHtml(people || t('people', { count: reaction.npcCount || 0 }))}</span></span>`;
        }).join('')}</div>`;
    }

    function renderNode(node, row) {
        const type = Number(node.contentType || 1);
        const text = contentText(node);
        if (type === 7) return text ? `<div class="baker-system-message">${richText(text)}</div>` : '';
        if (type === 9) return reactionHtml(node);
        if (type === 1) {
            if (!text) return '';
            return bubbleMessage(node, row, `<div class="baker-bubble__text">${richText(text)}</div>`);
        }
        if (type === 2) {
            const pictures = pictureHtml(node);
            const caption = text ? `<div class="baker-bubble__text">${richText(text)}</div>` : '';
            return bubbleMessage(node, row, pictures + caption);
        }

        let attachment = '';
        const params = node.contentParam || [];
        if (type === 4) attachment = attachmentHtml(CONTENT_LABELS[type], params[1] || params[0], t('videoUnavailable'), '▶');
        else if (type === 5) attachment = attachmentHtml(CONTENT_LABELS[type], text || params[0], params.filter(Boolean).join(' · '), '♪');
        else if (type === 6) {
            const itemId = params[0] || '';
            const item = state.items[itemId] || {};
            attachment = attachmentHtml(CONTENT_LABELS[type], item.name?.text || itemId, itemId, '+');
        } else if (type === 8) {
            const linkedChat = state.chats[params[0]];
            attachment = attachmentHtml(CONTENT_LABELS[type], chatName(linkedChat, params[0]), params[1] || params[0], '@');
        } else if (type === 10) {
            const archive = parseContentParams(node.contentParams) || {};
            attachment = attachmentHtml(CONTENT_LABELS[type], archive.id || t('narrative'), archive.phaseId || t('archiveRecord'), '#');
        } else if (type === 12) {
            const missionId = node.linkMissionId || params[0] || '';
            attachment = attachmentHtml(CONTENT_LABELS[type], missionId, t('missionAttachment'), '!');
        } else attachment = attachmentHtml(CONTENT_LABELS[type] || t('messageType', { type }), text, params.join(' · '), '?');
        const caption = text && type !== 5 ? `<div class="baker-bubble__text">${richText(text)}</div>` : '';
        return bubbleMessage(node, row, attachment + caption);
    }

    function optionButtons(dialog, node) {
        const ids = (node.dialogOptionIds || []).filter(id => state.options[id]);
        if (!ids.length) return '';
        const key = `${dialog.dialogId}:${node.contentId}`;
        const selectedId = state.choices.get(key) || ids[0];
        return `<div class="baker-options">${ids.map(id => {
            const option = state.options[id];
            const resourceId = option.optionResPath || '';
            const source = stickerUrl(resourceId);
            const label = option.optionDesc?.text || resourceId || id;
            const content = source ? `<img class="baker-option__emoji" src="${escapeHtml(source)}" alt="" loading="lazy">` : escapeHtml(label);
            return `<button class="baker-option${source ? ' baker-option--emoji' : ''}${id === selectedId ? ' is-selected' : ''}" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" data-baker-dialog="${escapeHtml(dialog.dialogId)}" data-baker-node="${escapeHtml(node.contentId)}" data-baker-option="${escapeHtml(id)}" aria-pressed="${id === selectedId}">${content}</button>`;
        }).join('')}</div>`;
    }

    function dialogPath(dialog) {
        const nodes = dialog.dialogContentData || {};
        const candidates = Object.values(nodes).filter(node => Number(node.contentId) >= 0 && Number(node.preContentId) === 0);
        let currentId = candidates.sort((a, b) => Number(a.contentId) - Number(b.contentId))[0]?.contentId;
        if (currentId === undefined) currentId = Object.values(nodes).filter(node => Number(node.contentId) >= 0)
            .sort((a, b) => Number(a.contentId) - Number(b.contentId))[0]?.contentId;
        const result = [];
        const visited = new Set();
        while (currentId !== undefined && Number(currentId) >= 0 && result.length < 500) {
            const node = nodes[String(currentId)];
            if (!node || visited.has(String(currentId))) break;
            visited.add(String(currentId));
            result.push(node);
            const optionIds = (node.dialogOptionIds || []).filter(id => state.options[id]);
            if (optionIds.length) {
                const key = `${dialog.dialogId}:${node.contentId}`;
                const selectedId = state.choices.get(key) || optionIds[0];
                currentId = state.options[selectedId]?.optionNextContentId;
                continue;
            }
            if (Number(node.nextContentId) !== 0) {
                currentId = node.nextContentId;
                continue;
            }
            const next = Object.values(nodes).find(candidate => Number(candidate.preContentId) === Number(node.contentId) && !visited.has(String(candidate.contentId)));
            currentId = next?.contentId;
        }
        return result;
    }

    function renderDialog(dialog, row) {
        const path = dialogPath(dialog);
        const content = path.map(node => `${renderNode(node, row)}${optionButtons(dialog, node)}`).join('');
        const metadata = [dialog.dialogId, dialog.relatedMissionId ? t('missionId', { id: dialog.relatedMissionId }) : '', dialog.noticeType ? t('notice') : '']
            .filter(Boolean).join(' · ');
        return `<section class="baker-dialog"><div class="baker-dialog__meta">${escapeHtml(metadata)}</div>${content || `<div class="baker-system-message">${escapeHtml(t('emptyDialog'))}</div>`}</section>`;
    }

    function conversationGroups(row) {
        const groups = new Map();
        row.dialogs.forEach(dialog => {
            const topic = state.topics[dialog.topicId] || state.topicByDialog.get(dialog.dialogId);
            const key = topic?.topicId || `dialog:${dialog.dialogId}`;
            if (!groups.has(key)) groups.set(key, { key, topic, dialogs: [] });
            groups.get(key).dialogs.push(dialog);
        });
        return Array.from(groups.values()).sort((left, right) =>
            Number(left.topic?.sortId ?? 999) - Number(right.topic?.sortId ?? 999) || naturalCompare(left.key, right.key)
        );
    }

    function renderConversation() {
        const row = state.rowById.get(state.selectedId);
        if (!row) {
            elements.conversation.innerHTML = `<div class="baker-welcome"><b>${escapeHtml(t('select'))}</b></div>`;
            return;
        }
        const groups = conversationGroups(row);
        const type = chatType(row.chat);
        const topicCount = groups.filter(group => group.topic).length;
        const threads = groups.length ? groups.map(group => {
            const title = group.topic?.topicName?.text || group.topic?.topicStartOptionDesc?.text || (row.dialogs.length === 1 ? t('dialog') : group.dialogs[0].dialogId);
            return `<section class="baker-thread"><h3 class="baker-thread__heading"><strong>${escapeHtml(title)}</strong>${group.topic ? `<span>${escapeHtml(t('segments', { count: group.dialogs.length }))}</span>` : ''}</h3>${group.dialogs.sort((a, b) => naturalCompare(a.dialogId, b.dialogId)).map(dialog => renderDialog(dialog, row)).join('')}</section>`;
        }).join('') : `<div class="baker-welcome"><b>${escapeHtml(t('emptyContact'))}</b></div>`;
        elements.conversation.innerHTML = `
            <header class="baker-chat-header">
                ${avatarHtml(row.chat, row.name)}
                <div><h2>${escapeHtml(row.name)}</h2><p>${escapeHtml(row.id)} · ${escapeHtml(type.label)}</p></div>
                <div class="baker-chat-header__stats"><span class="baker-badge">${escapeHtml(t('dialogs', { count: row.dialogs.length }))}</span><span class="baker-badge">${escapeHtml(t('topics', { count: topicCount }))}</span></div>
            </header>
            <div class="baker-thread-list">${threads}</div>
        `;
    }

    function selectChat(id, updateUrl = true) {
        const row = state.rowById.get(id) || state.rows.find(item => item.chatId === id);
        if (!row) return false;
        state.selectedId = row.id;
        renderContacts();
        renderConversation();
        root.classList.remove('is-mobile-open');
        if (updateUrl) window.__akeRouter?.updateUrl('baker', row.id);
        return true;
    }

    async function loadData() {
        if (!window.AKEV3?.table) throw new Error('TableCfg 数据读取器尚未就绪');
        const [chats, dialogs, options, topics, items] = await Promise.all([
            window.AKEV3.table('SNSChatTable'),
            window.AKEV3.table('SNSDialogTable'),
            window.AKEV3.table('SNSDialogOptionTable'),
            window.AKEV3.table('SNSDialogTopicTable'),
            window.AKEV3.table('ItemTable')
        ]);
        state.chats = chats || {};
        state.dialogs = dialogs || {};
        state.options = options || {};
        state.topics = topics || {};
        state.items = items || {};
        await loadStickerIndex();
        buildRows();
    }

    window.__akeBakerDiagnostics = () => ({ unresolvedStickers: [...unresolvedStickers] });

    elements.search.addEventListener('input', event => {
        state.search = event.target.value;
        renderContacts();
    });

    elements.filters.addEventListener('click', event => {
        const button = event.target.closest('[data-baker-type]');
        if (!button) return;
        state.type = button.dataset.bakerType;
        elements.filters.querySelectorAll('[data-baker-type]').forEach(item => {
            const active = item === button;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-pressed', String(active));
        });
        window.AKEUI?.updateFilterPanel(elements.filterPanel, {
            summary: state.type === 'all' ? t('filter') : t('filter') + ' (1)'
        });
        renderContacts();
    });

    elements.list.addEventListener('click', event => {
        const button = event.target.closest('[data-baker-chat]');
        if (button) selectChat(button.dataset.bakerChat);
    });

    elements.conversation.addEventListener('click', event => {
        const button = event.target.closest('[data-baker-option]');
        if (!button) return;
        const scrollTop = elements.conversation.scrollTop;
        state.choices.set(`${button.dataset.bakerDialog}:${button.dataset.bakerNode}`, button.dataset.bakerOption);
        renderConversation();
        elements.conversation.scrollTop = scrollTop;
    });

    elements.mobile.addEventListener('click', () => root.classList.add('is-mobile-open'));
    elements.backdrop.addEventListener('click', () => root.classList.remove('is-mobile-open'));

    loadData().then(() => {
        renderContacts();
        const deepLinkId = window.__deepLinkId;
        window.__deepLinkId = null;
        if (deepLinkId && !selectChat(deepLinkId, false)) {
            window.__akeRouter?.onDeepLinkNotFound?.(deepLinkId, false);
            return;
        }
        const initial = deepLinkId || state.rows.find(row => row.dialogs.length)?.id || state.rows[0]?.id;
        if (initial) selectChat(initial, false);
        else renderConversation();
    }).catch(error => {
        console.error('Baker 模块初始化失败', error);
        elements.summary.textContent = t('readFailed');
        elements.list.innerHTML = '';
        elements.conversation.innerHTML = `<div class="ake-ui-state" data-state="error"><div><strong>${escapeHtml(t('loadFailed'))}</strong><span>${escapeHtml(error.message)}</span></div></div>`;
    });
})();
