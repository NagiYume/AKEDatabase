(function () {
    'use strict';
    const tr = window.akeI18n.scope('modules.cardgame');
    const tables = [
        "GameplayGuideTable",
        "TextTable",
        "CardGameConst",
        "CardMaterialTable",
        "CardGameBlackjackConst",
        "CardGameBlackjackRoundSettleTable",
        "CardGameBlackjackEffectTable",
        "CardGameCardChangTable",
        "CardGameCardEnhanceTable",
        "CardGameRelicInfoTable",
        "CardGameShopGoodsTable",
        "CardGameDoudizhuCardTypeTable",
        "LandLoardConst",
        "MultiplayerGameConst",
        "MultiplayerEmojiInfoTable",
        "MultiplayerEmojiTabTable",
        "MultiplayerNpcPoolInfoTable",
        "MultiplayerGameCenterTable",
        "CharacterTable",
        "UserAvatarTable",
        "AchievementTable"
    ];
    const suits = { Diamonds: '♦', Clubs: '♣', Hearts: '♥', Spades: '♠' };
    function example(cards, c) {
        return (cards || []).map(group => group.split(';').map(token => {
            const match = /^pokerSuit(\w+)_(\d+)$/.exec(token);
            if (!match || !suits[match[1]] || +match[2] < 1 || +match[2] > 15) {
                c.issue('unknown-card', 'CardGameDoudizhuCardTypeTable', token);
                return c.hidden() ? c.h(token) : '？';
            }
            const rank = +match[2];
            if (rank > 13) return c.h(tr(rank === 14 ? 'smallJoker' : 'bigJoker'));
            return suits[match[1]] + ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || rank);
        }).join(' ')).join('<br>');
    }
    window.AKECatalog.mount({
        id: 'cardgame', tables,
        build(c) {
            const T = c.tables, pages = [];
            const add = (id, group, name, raw, body, search = '') => {
                pages.push({ id, group: tr(group), name, raw, body, search });
            };
            const grid = (keys, rows) => c.table(keys.map(key => tr(key)), rows);
            const media = (icon, label) => icon ? `<button type="button" class="ake-ui-button" data-catalog-media="${c.h(icon)}" data-media-title="${c.h(label)}">${c.h(c.t('showImage'))}</button>` : '—';
            const searchable = refs => refs.map(c.text).filter(Boolean).join(' ');
            const label = ref => c.h(c.name(ref));
            const byOrder = ([a], [b]) => a.localeCompare(b, 'en', { numeric: true });
            const guideTexts = Object.entries(T.TextTable).filter(([key]) => key.startsWith('guide_text_')).sort(byOrder);
            for (const [id, guide] of Object.entries(T.GameplayGuideTable).sort(byOrder)) {
                if (!id.startsWith('cardgame-')) continue;
                const mode = id.split('-')[1];
                let search = '';
                const sections = guide.guideGroups.map(({ guideGroupId }, index) => {
                    const stem = /^guide_group_(\w+?_newbie_\d+)(?:_|$)/.exec(guideGroupId)?.[1];
                    const lines = stem ? guideTexts.filter(([key]) => key.startsWith(`guide_text_${stem}_`)) : [];
                    if (!lines.length) c.issue('missing-guide-text', 'GameplayGuideTable', id, guideGroupId);
                    search += ' ' + searchable(lines.map(([, ref]) => ref));
                    return c.section(tr('lesson', { number: index + 1 }), lines.length
                        ? lines.map(([, ref]) => `<p>${c.rich(ref)}</p>`).join('') : c.state(c.t('unavailable')), index === 0);
                });
                const group = ['blackjack', 'doudizhu'].includes(mode) ? mode : 'shared';
                add('guide:' + id, group, tr('guide') + ' · ' + tr(group), guide, sections.join(''), search);
            }

            const rounds = T.CardGameBlackjackRoundSettleTable;
            const initial = T.CardGameBlackjackConst;
            const settle = Object.entries(rounds).sort(byOrder).flatMap(([round, config]) =>
                Object.values(config.rankMap).sort((a, b) => a.rank - b.rank).map(rank =>
                    [c.h(round), c.number(rank.rank), c.number(rank.goldGain), c.number(rank.hpLoss)]));
            add('rounds', 'blackjack', tr('rounds'), { initial, rounds },
                c.section(tr('initialHp'), c.number(initial.initialHp), true) + grid(['round', 'rank', 'gold', 'hpLoss'], settle));

            const effects = Object.entries(T.CardGameBlackjackEffectTable).sort(byOrder);
            add('effects', 'blackjack', tr('effects'), T.CardGameBlackjackEffectTable,
                grid(['effect', 'image'], effects.map(([, r]) => [c.h(c.text(r.desc).replace(/%s/g, '…')), media(r.icon, c.text(r.desc))])),
                searchable(effects.map(([, r]) => r.desc)));

            const changes = Object.entries(T.CardGameCardChangTable).sort(byOrder);
            const changeRows = changes.map(([id, r]) => {
                const goods = T.CardGameShopGoodsTable[r.shopGoodsId], enhance = T.CardGameCardEnhanceTable[r.enhanceType];
                if (!goods) c.issue('missing-reference', 'CardGameCardChangTable', id, r.shopGoodsId);
                return [label(r.name), c.rich(r.desc), label(goods?.name), enhance ? c.link('cardgame', 'enhance:' + r.enhanceType, c.name(enhance.name)) : '—'];
            });
            add('changes', 'blackjack', tr('changes'), T.CardGameCardChangTable, grid(['name', 'description', 'goods', 'enhancement'], changeRows),
                searchable(changes.flatMap(([, r]) => [r.name, r.desc])));
            const goods = Object.values(T.CardGameShopGoodsTable).sort((a, b) => a.slotType - b.slotType);
            const shopRows = [], unnamedSlots = new Map();
            for (const r of goods) {
                if (!c.hidden() && !c.text(r.name) && !c.text(r.desc) && !r.icon) {
                    unnamedSlots.set(r.slotType, (unnamedSlots.get(r.slotType) || 0) + 1);
                    continue;
                }
                shopRows.push([c.h(c.name(r.name, r.goodsId)), c.number(r.slotType), c.rich(r.desc) || '—', media(r.icon, c.text(r.name))]);
            }
            for (const [slot, count] of unnamedSlots) shopRows.push([c.h(tr('unnamedOffers', { count })), c.number(slot), '—', '—']);
            add('shop', 'blackjack', tr('shop'), T.CardGameShopGoodsTable, grid(['goods', 'slotType', 'description', 'image'], shopRows),
                searchable(goods.flatMap(r => [r.name, r.desc])));

            const hands = Object.entries(T.CardGameDoudizhuCardTypeTable).sort(byOrder);
            add('hands', 'doudizhu', tr('hands'), T.CardGameDoudizhuCardTypeTable,
                grid(['hand', 'description', 'example'], hands.map(([, r]) => [label(r.cardTypeName), c.rich(r.cardTypeDesc),
                    [example(r.cardCombine1, c), example(r.cardCombine2, c)].filter(Boolean).join(' + ')])),
                searchable(hands.flatMap(([, r]) => [r.cardTypeName, r.cardTypeDesc])));
            const timings = Object.entries(T.LandLoardConst);
            add('timings', 'doudizhu', tr('timings'), T.LandLoardConst, grid(['action', 'milliseconds'], timings.map(([key, value]) =>
                [c.h(tr('timing.' + key, {}, key)), c.number(value)])));

            const materials = Object.values(T.CardMaterialTable);
            add('cards', 'shared', tr('cards'), { colors: T.CardGameConst, materials },
                grid(['suit', 'color'], [[c.h('♠ ♣'), c.h(T.CardGameConst.blackSuitColor)], [c.h('♥ ♦'), c.h(T.CardGameConst.redSuitColor)]])
                + c.section(tr('styles'), materials.map(r => c.h(tr('style.' + r.cardType, {}, c.t('unnamed')))).join(' · '), true));

            const room = T.MultiplayerGameConst;
            const achievementText = [];
            const achievements = (room.achievementIds || []).map(id => {
                const row = T.AchievementTable[id];
                if (!row) c.issue('missing-reference', 'AchievementTable', id);
                const descriptions = Object.values(row?.levelInfos || {}).map(level => level.completeDesc);
                achievementText.push(row?.name, ...descriptions);
                return [label(row?.name), descriptions.map(c.rich).join('<br>')];
            });
            add('room', 'multiplayer', tr('room'), { room, center: T.MultiplayerGameCenterTable },
                grid(['achievement', 'requirement'], achievements) + c.section(tr('sessionDuration'), c.number(room.ps5JoinSessionValidDuration), true)
                + c.section(tr('center'), grid(['name', 'description'], Object.entries(T.MultiplayerGameCenterTable).map(([id, row]) => {
                    if (!c.text(row.name) && !c.text(row.desc)) c.issue('unknown-center-entry', 'MultiplayerGameCenterTable', id);
                    return [label(row.name), c.rich(row.desc) || '—'];
                }))), searchable(achievementText));
            const npcs = Object.entries(T.MultiplayerNpcPoolInfoTable).sort(byOrder);
            const npcRows = npcs.map(([id, npc]) => {
                const char = T.CharacterTable[npc.templateId], avatar = T.UserAvatarTable[npc.avatarId];
                if (!avatar && npc.avatarId) c.issue('missing-reference', 'UserAvatarTable', id, npc.avatarId);
                return [char ? c.link('v3_character', npc.templateId, c.name(char.name)) : label(null), label(npc.nickname),
                    c.rich(npc.signature) || '—', media(avatar?.icon, c.text(char?.name))];
            });
            add('npcs', 'multiplayer', tr('npcs'), T.MultiplayerNpcPoolInfoTable, grid(['character', 'nickname', 'signature', 'avatar'], npcRows),
                searchable(npcs.flatMap(([, r]) => [T.CharacterTable[r.templateId]?.name, r.nickname, r.signature])));
            const listed = new Set();
            const emojiGrid = ids => grid(['emoji', 'voices', 'image'], ids.map(id => {
                const r = T.MultiplayerEmojiInfoTable[id];
                if (!r) c.issue('missing-reference', 'MultiplayerEmojiInfoTable', id);
                listed.add(id);
                return [label(r?.emojiDesc), c.number(r?.interjectionIds?.length), media(r?.emojiIcon, c.text(r?.emojiDesc))];
            }));
            const tabs = Object.values(T.MultiplayerEmojiTabTable).sort((a, b) => a.sortId - b.sortId);
            const emojiSections = tabs.map(tab => c.section(c.name(tab.emojiTabName), emojiGrid(tab.emojiIds || []), true));
            const unassigned = Object.keys(T.MultiplayerEmojiInfoTable).filter(id => !listed.has(id));
            if (unassigned.length) emojiSections.push(c.section(tr('unassigned'), emojiGrid(unassigned), true));
            add('emoji', 'multiplayer', tr('emoji'), { tabs, emoji: T.MultiplayerEmojiInfoTable }, emojiSections.join(''),
                searchable([...tabs.map(r => r.emojiTabName), ...Object.values(T.MultiplayerEmojiInfoTable).map(r => r.emojiDesc)]));
            for (const [id, r] of Object.entries(T.CardGameRelicInfoTable).sort(byOrder)) {
                add('relic:' + id, 'relics', c.name(r.relicName, id), r, c.rich(r.relicDesc)
                    + grid(['rarity', 'slots', 'image'], [[c.number(r.rarity), c.number(r.occupySlotCount), media(r.relicIcon, c.text(r.relicName))]]), c.text(r.relicDesc));
            }
            for (const [id, r] of Object.entries(T.CardGameCardEnhanceTable).sort(byOrder)) {
                add('enhance:' + id, 'enhancements', c.name(r.name, id), r, c.rich(r.desc) + media(r.icon, c.text(r.name)), c.text(r.desc));
            }
            return pages;
        },
        render(page) { return page.body; }
    });
})();
