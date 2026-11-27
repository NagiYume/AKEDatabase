(function () {
    'use strict';

    const images = '/public/images/assets/beyond/';
    const sprites = 'dynamicassets/gameplay/ui/sprites/';
    const cardParts = 'dynamicassets/gameplay/ui/prefabs/friend/friendbusinesscard/';
    const cardBackgrounds = 'arts/ui/sprites/friend/businesscardbg/';
    // ThemeBgImg.imgRefPath uses a character art filename for these five panels.
    const backgroundOverrides = {
        FriendBusinessBp12Panel: 'business_card_topic_chr_0031_bp',
        FriendBusinessBp13Panel: 'business_card_topic_chr_0032_bp',
        FriendBusinessBp14Panel: 'business_card_topic_chr_0033_bp',
        FriendBusinessBp15Panel: 'business_card_topic_chr_0034_bp',
        FriendBusinessBp16Panel: 'business_card_topic_chr_0035_bp'
    };
    // These panels use the 2320 × 950 bottom-anchored image. The other current
    // themes use the centered 1920 × 1080 image and a separate blurred underlay.
    const widePanels = new Set([
        'FriendBusinessCard', 'FriendBusinessCardNormal2Panel', 'FriendBusinessCardNormal3Panel',
        'FriendBusinessCardNormal4Panel', 'FriendBusinessCardNormal5Panel'
    ]);
    const operatorIds = ['chr_0040_sweetpie', 'chr_0036_jsspsi', 'chr_0035_liino', 'chr_0013_aglina'];
    const awards = [
        'achv_adv_wuling_ether_1_lv03', 'achv_adv_wuling_box_1_lv03', 'achv_growth_char_skill_level_1_lv03',
        'achv_growth_equip_enhance_lv03', 'achv_growth_char_potential_1_lv03',
        'achv_adv_tundra_ether_lv03', 'achv_adv_tundra_box_lv03', 'achv_growth_wpn_count_1_lv03',
        'achv_growth_adventure_level_lv03', 'achv_growth_world_level_lv03'
    ];
    const sample = {
        nickname: '塔卫巡行者#5476',
        uid: '1042719368',
        birthday: '4/4',
        authorityLevel: 60,
        explorationLevel: 7,
        chapter: '离渊',
        chapterProgress: '第二章 — 进程Ⅷ',
        collection: [
            { label: '干员', value: 35, art: 'deco_friend_card_agent' },
            { label: '武器', value: 84, art: 'deco_friend_card_arms' },
            { label: '档案', value: 473, art: 'deco_friend_card_files' }
        ],
        regions: [
            { label: '四号谷地', level: 12, art: 'blackbox_icon_domain_1' },
            { label: '武陵', level: 33, art: 'blackbox_icon_domain_2' }
        ],
        season: '游离赛季',
        rank: '开拓老兵',
        signature: '在塔卫二继续探索。'
    };

    function image(c, path, className = '', alt = '') {
        const source = images + path + '.png';
        const url = window.akeDataSource?.resolveUrl(source) || source;
        return `<img class="${className}" src="${c.h(url)}" alt="${c.h(alt)}" decoding="async" draggable="false">`;
    }

    function personalInfo(c) {
        return `<div class="businesscard-preview__identity">
            <div class="businesscard-preview__avatar">
                ${image(c, sprites + 'charremoteicon/icon_chr_0035_liino')}
                ${image(c, sprites + 'headframeicon/icon_user_avatar_frame_activity_1', 'businesscard-preview__avatar-frame')}
            </div>
            <strong class="businesscard-preview__name">${c.h(sample.nickname)}</strong>
            <div class="businesscard-preview__birthday"><span>生日</span><b>${sample.birthday}</b></div>
            <span class="businesscard-preview__uid">UID ${sample.uid}</span>
        </div>
        <div class="businesscard-preview__progress">
            <div class="businesscard-preview__level">${image(c, cardParts + 'icon_friend_power')}<span>权限等阶</span><b>${sample.authorityLevel}</b></div>
            <div class="businesscard-preview__level">${image(c, cardParts + 'icon_friend_world')}<span>探索等级</span><b>${sample.explorationLevel}</b></div>
            <div class="businesscard-preview__chapter">
                ${image(c, sprites + 'mission/chaptericonnew/chapter_main_icon_02')}
                <strong>${sample.chapter}</strong><span>${sample.chapterProgress}</span>
            </div>
        </div>
        <div class="businesscard-preview__collection">${sample.collection.map(({ label, value, art }) => `
            <div>${image(c, cardParts + art)}<b>${value}</b><span>${label}</span></div>`).join('')}</div>
        <div class="businesscard-preview__regions">
            <strong>地区建设概况</strong>
            <div class="businesscard-preview__region-list">${sample.regions.map(({ label, level, art }) => `
                <div>${image(c, cardParts + art)}<span>等级 <b>${level}</b></span><span>${label}</span></div>`).join('')}</div>
        </div>`;
    }

    function operatorCards(c) {
        return operatorIds.map((id, index) => {
            const operator = c.tables.CharacterTable[id];
            const name = c.name(operator?.name);
            const potential = index + 1;
            const label = `${name}，90 级，潜能 ${potential}`;
            return `<div class="businesscard-preview__operator" title="${c.h(label)}">
                ${image(c, sprites + 'charicon/icon_' + id, 'businesscard-preview__portrait', label)}
                ${Number.isInteger(operator?.profession) ? image(c, sprites + 'charprofessionicon/icon_profession_' + operator.profession, 'businesscard-preview__profession') : ''}
                <div class="businesscard-preview__operator-footer"><span>潜 ${potential}</span><span><small>LV.</small> 90</span></div>
            </div>`;
        }).join('');
    }

    function expandedDetails(c) {
        return `<div class="businesscard-preview__medals">
            ${image(c, cardParts + 'bg_friend_card_medal', 'businesscard-preview__medal-bg')}
            <strong>光荣之路</strong>
            <div class="businesscard-preview__medal-list">${awards.map(award => image(c, sprites + 'medalicon/' + award)).join('')}</div>
            <span class="businesscard-preview__corner" aria-hidden="true">↗</span>
        </div>
        <div class="businesscard-preview__operators">
            <div class="businesscard-preview__operators-brand">ENDFIELD</div>
            <div class="businesscard-preview__operators-label"><strong>干员展示</strong>${image(c, cardParts + 'icon_friend_card_role')}</div>
            <div class="businesscard-preview__operator-list">${operatorCards(c)}</div>
            <span class="businesscard-preview__corner" aria-hidden="true">↗</span>
        </div>
        <div class="businesscard-preview__season">
            <strong>战争回响</strong><span>${sample.season}</span>
            <span class="businesscard-preview__rank">${sample.rank}${image(c, cardParts + 'tag_seasontower_a_small')}</span>
        </div>`;
    }

    function preview(row, c, expanded) {
        const mode = expanded ? '展开' : '收起';
        return `<figure class="businesscard-preview__figure">
            <figcaption class="ake-ui-section__title">${mode}</figcaption>
            <div class="businesscard-preview__frame">
                <div class="businesscard-preview__card" data-art="${row.wide ? 'wide' : 'full'}" style="--businesscard-accent:${row.accent}">
                    ${row.wide ? '' : image(c, cardParts + row.art + '_blur', 'businesscard-preview__blur')}
                    ${image(c, cardBackgrounds + row.art, 'businesscard-preview__art')}
                    <div class="businesscard-preview__shade" aria-hidden="true"></div>
                    ${personalInfo(c)}
                    ${expanded ? expandedDetails(c) : '<div class="businesscard-preview__closed" aria-hidden="true"><span>‹</span></div>'}
                    <div class="businesscard-preview__signature">${c.h(sample.signature)}</div>
                </div>
            </div>
        </figure>`;
    }

    window.AKECatalog.mount({
        id: 'businesscard',
        tables: ['BusinessCardTopicTable', 'CharacterTable'],
        optional: ['CharacterTable'],
        primary: ['BusinessCardTopicTable'],
        showRaw: false,
        build(c) {
            return Object.entries(c.tables.BusinessCardTopicTable)
                .sort(([, a], [, b]) => (a.sort ?? Infinity) - (b.sort ?? Infinity))
                .map(([id, topic]) => {
                    const item = c.tables.ItemTable[topic.itemId];
                    if (!item) c.issue('missing-reference', 'BusinessCardTopicTable', id, topic.itemId);
                    const art = encodeURIComponent(Object.hasOwn(backgroundOverrides, topic.panelPrefab) ? backgroundOverrides[topic.panelPrefab] : id);
                    return {
                        id,
                        name: c.name(item?.name, id),
                        icon: images + sprites + 'themeicon/themechangebg/' + encodeURIComponent(id) + '.png',
                        art,
                        wide: widePanels.has(topic.panelPrefab),
                        accent: /^[0-9a-f]{6}$/i.test(topic.color) ? '#' + topic.color : '#fff4b6',
                        sources: [{ table: 'BusinessCardTopicTable', key: id }]
                    };
                });
        },
        render(row, c) {
            return `<div class="businesscard-preview">${preview(row, c, true)}${preview(row, c, false)}</div>`;
        }
    });
})();
