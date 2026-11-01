(function () {
    'use strict';
    window.AKEMisc.register('gamble', function (context) {
        const life = window.AKELifeCatalog;
        const sprites = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/';
        let entries = [], groups = [];
        const image = (src, c) => `<img class="ake-ui-material__item-icon gamble-image" src="${c.h(src)}" alt="" loading="lazy" decoding="async">`;
        function handVisual(row, c) {
            const icons = row.showIcon || [], numbers = row.showNumber || [];
            if (icons.length !== numbers.length) c.issue('parallel-array-mismatch', 'GambleBattleHandTypeTable', row.handTypeID, 'showIcon/showNumber');
            // showIcon is the source sprite name; numbers survive missing assets.
            return `<div class="ake-ui-material__items" aria-label="${c.h(window.akeI18n.t('modules.life.fields.showNumber'))}">${Array.from({ length: Math.max(icons.length, numbers.length) }, (_, i) =>
                `<span class="ake-ui-material__item">${icons[i] ? image(`${sprites}activity/activitygamblebattle/${encodeURIComponent(icons[i])}.png`, c) : ''}<strong>${numbers[i] == null ? '—' : c.number(numbers[i])}</strong></span>`
            ).join('')}</div>`;
        }
        function content(entry, c) {
            let visual = '';
            if (entry.kind === 'hand') visual = handVisual(entry.raw, c);
            if (entry.kind === 'card') {
                visual = `<div class="ake-ui-material__items">${(entry.raw.enemyIdList || []).map(id => {
                    const enemy = c.tables.EnemyTable[id];
                    const display = enemy && c.tables.EnemyTemplateDisplayInfoTable[enemy.templateId];
                    return display ? `<div class="ake-ui-material__item">${image(`${sprites}monstericonbig/${encodeURIComponent(enemy.templateId)}.png`, c)}${c.link('v3_enemy', enemy.templateId, c.name(display.name, id))}</div>` : '';
                }).join('')}</div>`;
            }
            const card = window.AKEUI.card({ header: { title: entry.name, id: c.hidden() ? entry.id : undefined },
                attributes: { 'data-gamble-entry': entry.id, tabindex: '-1' } });
            card.classList.add('gamble-entry');
            const body = document.createElement('div');
            body.className = 'gamble-entry__body';
            body.innerHTML = visual + life.renderGamble(entry, c) + c.raw(entry.raw);
            card.querySelector('.ake-ui-card__content').appendChild(body);
            return card.outerHTML;
        }
        const controller = life.mount('gamble', {
            root: context.root, deepId: context.routeId, navigate: context.navigate,
            showRaw: false,
            build(c) {
                entries = life.build('gamble', c);
                groups = life.definitions.gamble.map(([kind]) => ({
                    id: `category:${kind}`, kind, name: window.akeI18n.t(`modules.life.${kind}`), sources: [], raw: {}
                }));
                // Source routes and coverage stay intact; only the directory is grouped.
                return [...groups, ...entries];
            },
            createView({ root, select }) {
                return {
                    status() {},
                    update({ activeId, ctx }) {
                        if (!ctx) return;
                        if (!activeId) { select(groups[0].id, false); return; }
                        const active = [...groups, ...entries].find(e => e.id === activeId);
                        for (const target of root.querySelectorAll('[data-catalog-list], [data-catalog-mobile-list]')) {
                            target.replaceChildren(...groups.map(group => window.AKEUI.directoryItem({
                                title: group.name, active: group.kind === active?.kind,
                                attributes: { 'data-catalog-id': group.id }
                            })));
                        }
                    }
                };
            },
            render(entry, c) {
                const members = entries.filter(e => e.kind === entry.kind);
                return `<div class="ake-ui-list">${members.map(e => content(e, c)).join('') || c.state()}</div>`;
            },
            mountDetail(entry, c, detail) {
                // Search and legacy links open the category and focus the original record.
                const group = groups.find(g => g.kind === entry.kind);
                detail.querySelector('.ake-ui-detail').firstElementChild.replaceWith(window.AKEUI.detailHeader({ title: group.name }));
                const onError = event => {
                    if (event.target.matches?.('.gamble-image')) event.target.hidden = true;
                };
                detail.addEventListener('error', onError, true);
                for (const img of detail.querySelectorAll('.gamble-image')) if (img.complete && !img.naturalWidth) img.hidden = true;
                const target = Array.from(detail.querySelectorAll('[data-gamble-entry]')).find(node => node.dataset.gambleEntry === entry.id);
                if (target) {
                    target.classList.add('is-target');
                    target.focus({ preventScroll: true });
                    target.scrollIntoView({ block: 'start' });
                } else detail.scrollTop = 0;
                return () => detail.removeEventListener('error', onError, true);
            }
        });
        return {
            async mount() { await controller.ready; },
            onRoute(id) { return controller.select(id, false); },
            destroy() { controller.destroy(); }
        };
    });
})();
