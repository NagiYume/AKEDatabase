(function () {
    'use strict';
    const life = window.AKELifeCatalog;
    const t = (key, args) => window.akeI18n.t(`modules.inn.${key}`, args);
    const sprites = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/';
    const kindOf = row => row.kind === 'chef' ? 'skill' : row.kind;
    const line = (title, html, c) => `<div class="inn-card-row"><span class="inn-card-label">${c.h(title)}</span><div>${html || '—'}</div></div>`;
    function category(id, c) {
        const row = c.tables.InnDishCategoryTable[id];
        if (!row) { c.issue('missing-reference', 'InnDishCategoryTable', id); return c.h(c.t('unavailable')); }
        return window.AKEUI.materialItem({ name: c.name(row.name), icon: row.richTextIconId ? sprites + 'inn/type/' + encodeURIComponent(row.richTextIconId) + '.png' : undefined }).outerHTML;
    }
    function tags(ids, c) {
        return (ids || []).map(id => {
            const row = c.tables.InnAffixTable[id];
            if (!row) c.issue('missing-reference', 'InnAffixTable', id);
            return `<span class="ake-ui-badge">${c.h(c.name(row?.name))}</span>`;
        }).join(' ');
    }
    function recipe(row, c) {
        const r = row.raw;
        const money = window.AKEUI.materialItem({ icon: sprites + 'walleticon/item_inn_currency_icon.png', name: String(r.price ?? '—') }).outerHTML;
        let html = `<div class="inn-card-row inn-recipe-price">${r.timeCost == null ? '' : `<span>${c.h(t('seconds', { value: r.timeCost }))}</span>`}${money}</div>`;
        const type = r.category || (row.kind === 'drink' ? c.tables.InnManagementConst.drinkCategory : null);
        if (type) html += line(t('category'), category(type, c), c);
        if (r.affix?.length) html += line(t('tags'), tags(r.affix, c), c);
        if (r.ingredient?.length) {
            if (r.ingredient.length !== r.ingredientNum?.length) c.issue('parallel-array-mismatch', row.source, row.key, 'ingredient');
            html += line(t('ingredients'), r.ingredient.map((id, i) => c.item(id, r.ingredientNum?.[i] ?? '—')).join(' '), c);
        }
        const unlock = [];
        if (r.unlockLevel > 0) unlock.push(c.h(t('level', { value: r.unlockLevel })));
        if (r.unlockTopicId) {
            const topic = c.tables.InnTopicTable[r.unlockTopicId];
            if (!topic) c.issue('missing-reference', 'InnTopicTable', r.unlockTopicId);
            unlock.push(c.link('inn', `topic:${r.unlockTopicId}`, c.name(topic?.name)) + (r.unlockTopicStarNum > 0 ? ' ' + c.h(t('stars', { value: r.unlockTopicStarNum })) : ''));
        }
        if (unlock.length) html += line(t('unlock'), unlock.join(' · '), c);
        return html;
    }
    function topic(row, c) {
        const r = row.raw, constants = c.tables.InnManagementConst;
        const hot = (r.hotCategory || []).map(id => category(id, c)).join(' ') + ' ' + tags(r.hotAffix, c);
        let html = line(t('popular'), hot.trim(), c);
        html += line(t('description'), c.rich(r.desc) + (c.text(r.extraDesc) ? `<p>${c.rich(r.extraDesc)}</p>` : ''), c);
        html += line(t('objective'), c.rich(r.objectiveDesc), c);
        html += line(t('menu'), c.rich(r.requirementDesc), c);
        const rates = [];
        if (r.hotCategory?.length && constants.topicHotCategoryTipRate != null) rates.push(c.h(t('categoryTip', { value: Number((constants.topicHotCategoryTipRate * 100).toFixed(2)) })));
        if (r.hotAffix?.length && constants.topicHotAffixTipRate != null) rates.push(c.h(t('tagTip', { value: Number((constants.topicHotAffixTipRate * 100).toFixed(2)) })));
        html += line(t('hotInfo'), rates.join('<br>') + (hot.trim() ? `<div>${hot}</div>` : ''), c);
        html += line(t('rewards'), c.table([t('rating'), t('score'), t('rewards')], (r.starRequiredScore || []).map((score, i) => [c.h(t('stars', { value: i + 1 })), c.number(score), c.reward(r.starsRewardId?.[i])])), c);
        const keys = ['unlockLevel', 'topicKPIScoreLimit', 'topicKPIScoreRankPoint', 'topicProfitScoreLimit', 'topicProfitScoreRankPoint', 'topicObjectiveScoreFactor'];
        html += line(t('properties'), c.table([c.t('property'), c.t('value')], keys.filter(key => r[key] != null).map(key => [c.h(window.akeI18n.t(`modules.life.fields.${key}`)), Array.isArray(r[key]) ? r[key].map(c.number).join(' / ') : c.number(r[key])])), c);
        return html;
    }
    function bonus(row, c) {
        const r = row.raw, target = r.parameters?.[1]?.valueStringList?.[0];
        const name = c.text(r.name);
        const label = name.match(/[\[【]([^\]】]+)[\]】]/)?.[1] || name;
        // Same character attribute enum and assets as v2-character.js.
        const elementIcons = { Physical: 'physical', Fire: 'fire', Pulse: 'pulse', Cryst: 'cold', Natural: 'nature' };
        const element = elementIcons[r.parameters?.[0]?.valueStringList?.[0]];
        const source = r.skillType === 1 && element
            ? window.AKEUI.materialItem({ name: label, icon: sprites + 'elementicon/icon_charattrtype_' + element + '.png' }).outerHTML
            : `<span class="ake-ui-badge">${c.h(label)}</span>`;
        let effect;
        if (r.skillType === 0) effect = category(target, c);
        else if (r.skillType === 1) effect = tags([target], c);
        else if (r.skillType === 2) effect = window.AKEUI.materialItem({ name: t('premium'), icon: sprites + 'inn/type/icon_inn_premium_rich.png' }).outerHTML;
        else { c.issue('unknown-skill-type', row.source, row.key, r.skillType); effect = c.h(c.t('unavailable')); }
        return line(t(r.skillType === 1 ? 'attributeBonus' : 'hobbyBonus'), source, c)
            + line(t(r.skillType === 1 ? 'tags' : 'category'), effect, c)
            + `<p>${c.rich(r.desc)}</p>`;
    }
    function otherEntry(row, c) {
        // Retain the source relationships, presenting scalar properties and sections
        // with the same card rows as recipes rather than nested disclosure panels.
        const presentation = {
            ...c,
            item: (id, count) => `<span class="inn-inline-item">${c.item(id, count)}</span>`,
            section: (title, html) => line(title, html, c),
            table: (headings, rows) => {
                const propertyLabels = [c.t('property'), window.akeI18n.t('modules.life.property')];
                if (headings.length !== 2 || !propertyLabels.includes(headings[0])) return c.table(headings, rows);
                return window.AKEUI.metaGrid(rows.map(([label, value]) => ({
                    label: window.AKEUI.fragment(label), value: window.AKEUI.fragment(String(value ?? '—'))
                })))?.outerHTML || c.state();
            }
        };
        return life.renderVillage(row, presentation);
    }
    let entries = [], groups = [];
    life.mount('inn', {
        showRaw: false,
        build(c) {
            entries = life.build('inn', c);
            groups = life.definitions.inn.filter(([kind]) => kind !== 'chef').map(([kind]) => ({
                id: `group:${kind}`, kind, name: kind === 'skill' ? t('bonus') : window.akeI18n.t(`modules.life.${kind}`), sources: [], raw: {}
            }));
            return [...groups, ...entries];
        },
        createView({ root, select }) {
            return {
                update({ activeId, ctx }) {
                    if (!ctx) return;
                    if (!activeId) { select(groups[0].id, false); return; }
                    const active = [...groups, ...entries].find(row => row.id === activeId);
                    const query = root.querySelector('[data-catalog-search]').value.trim();
                    const matches = row => window.AKEModuleSearch.matches(`${row.name} ${row.search || ''} ${ctx.hidden() ? row.id : ''}`, query);
                    const visible = groups.filter(group => !query || matches(group) || entries.some(row => row.kind === group.kind && matches(row)));
                    for (const target of root.querySelectorAll('[data-catalog-list], [data-catalog-mobile-list]')) {
                        target.replaceChildren(...visible.map(group => window.AKEUI.directoryItem({
                            title: group.name, active: group.kind === (active && kindOf(active)),
                            attributes: { 'data-catalog-id': group.id }
                        })));
                        if (!visible.length) target.innerHTML = ctx.state(ctx.t('noMatches'));
                    }
                }
            };
        },
        render(entry, c) {
            // Keep the synchronous catalog pass small; mountDetail owns cancellable batches.
            return `<div class="ake-ui-list" data-inn-cards></div><div data-inn-progress>${c.state(c.t('loading'))}</div>`;
        },
        mountDetail(entry, c, detail) {
            const kind = kindOf(entry);
            const group = groups.find(row => row.kind === kind);
            detail.querySelector('.ake-ui-detail').firstElementChild.replaceWith(window.AKEUI.detailHeader({ title: group.name }));
            const list = detail.querySelector('[data-inn-cards]');
            const progress = detail.querySelector('[data-inn-progress]');
            const members = entries.filter(row => row.kind === kind);
            if (kind === 'skill') members.sort((a, b) => (a.raw.skillType === 1) - (b.raw.skillType === 1) || (a.raw.sortId ?? 0) - (b.raw.sortId ?? 0));
            list.classList.toggle('inn-recipe-grid', !['topic', 'skill'].includes(kind));
            let cursor = 0, timer = 0, cancelled = false, focusTarget = null;
            detail.scrollTop = 0;
            const appendBatch = () => {
                if (cancelled) return;
                const batch = document.createDocumentFragment();
                const start = performance.now();
                let count = 0;
                try {
                    do {
                        const row = members[cursor++];
                        if (!row) break;
                        const compact = ['dish', 'drink', 'topic', 'skill'].includes(kind);
                        if (kind === 'skill' && (cursor === 1 || (members[cursor - 2].raw.skillType === 1) !== (row.raw.skillType === 1))) {
                            const heading = document.createElement('h3');
                            heading.className = 'ake-ui-section__title';
                            heading.textContent = t(row.raw.skillType === 1 ? 'attributeBonus' : 'hobbyBonus');
                            batch.appendChild(heading);
                        }
                        const card = window.AKEUI.card({
                            media: !['topic', 'skill'].includes(kind) ? { src: row.icon } : undefined,
                            header: { title: kind === 'skill' ? undefined : row.name, subtitle: compact ? undefined : row.subtitle },
                            sections: kind === 'skill' ? [{ content: window.AKEUI.fragment(bonus(row, c)) }] : undefined,
                            attributes: { 'data-inn-entry': row.id, 'data-inn-kind': kind, tabindex: '-1' }
                        });
                        const content = card.querySelector('.ake-ui-card__content');
                        if (kind === 'topic' && row.raw.iconId) {
                            const image = document.createElement('img');
                            image.className = 'inn-topic-background'; image.alt = ''; image.loading = 'lazy';
                            image.src = sprites + 'inn/topicchangebg/' + encodeURIComponent(row.raw.iconId) + '.png';
                            card.prepend(image);
                        }
                        if (kind !== 'skill') {
                            content.appendChild(window.AKEUI.fragment(kind === 'dish' || kind === 'drink' ? recipe(row, c) : kind === 'topic' ? topic(row, c) : otherEntry(row, c)));
                        }
                        batch.appendChild(card);
                        count++;
                        if (row.id === entry.id) focusTarget = card;
                    } while (cursor < members.length && count < 4 && performance.now() - start < 8);
                    list.appendChild(batch);
                    if (cursor < members.length) timer = window.setTimeout(appendBatch, 16);
                    else {
                        progress.remove();
                        if (!members.length) list.innerHTML = c.state();
                        if (focusTarget) {
                            focusTarget.focus({ preventScroll: true });
                            focusTarget.scrollIntoView({ block: 'start' });
                        }
                    }
                } catch (error) {
                    c.issue('render-failed', 'inn', entry.id, error.message);
                    window.AKEUI.setState(progress, { state: 'error', message: c.t('loadFailed') });
                }
            };
            const onError = event => {
                if (!(event.target instanceof HTMLImageElement)) return;
                const row = entries.find(item => item.id === event.target.closest('[data-inn-entry]')?.dataset.innEntry);
                c.issue('missing-image', row?.source || 'inn', row?.key || '', event.target.getAttribute('src'));
                event.target.hidden = true;
            };
            detail.addEventListener('error', onError, true);
            // The catalog may immediately replace its initial selection. Start after that pass.
            timer = window.setTimeout(appendBatch, 0);
            return () => {
                cancelled = true;
                window.clearTimeout(timer);
                detail.removeEventListener('error', onError, true);
            };
        }
    });
})();
