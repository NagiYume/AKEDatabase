(function () {
    'use strict';
    window.AKECatalog.mount({
        id: 'tutorial',
        tables: ['WikiCategoryTable', 'WikiGroupTable', 'WikiEntryTable', 'WikiEntryDataTable', 'WikiTutorialPageByEntryTable', 'WikiTutorialPageTable', 'EnemyTemplateDisplayInfoTable', 'PrtsAllItem'],
        primary: ['WikiEntryDataTable', 'WikiTutorialPageTable'],
        build(c) {
            const T = c.tables, groups = new Map(), pagesByTutorial = new Map(), assigned = new Set();
            for (const [category, row] of c.entries(T.WikiGroupTable)) for (const group of row.list || []) {
                groups.set(group.groupId, [c.text(T.WikiCategoryTable[category]?.categoryName), c.text(group.groupName)].filter(Boolean).join(' / '));
            }
            for (const [key, row] of c.entries(T.WikiTutorialPageTable)) {
                const id = row.tutorialId || key;
                if (!pagesByTutorial.has(id)) pagesByTutorial.set(id, new Set());
                pagesByTutorial.get(id).add(key);
            }
            for (const [id, row] of c.entries(T.WikiTutorialPageByEntryTable)) {
                if (!pagesByTutorial.has(id)) pagesByTutorial.set(id, new Set());
                for (const pageId of row.pageIds || []) pagesByTutorial.get(id).add(pageId);
            }
            const build = (id, row, source) => {
                const pages = [...(pagesByTutorial.get(id) || [])].flatMap(key => {
                    const page = T.WikiTutorialPageTable[key];
                    if (!page) { c.issue('missing-reference', 'WikiTutorialPageTable', key, id); return []; }
                    assigned.add(key); return [{ ...page, key }];
                }).sort((a, b) => (a.order || 0) - (b.order || 0));
                const item = T.ItemTable[row.refItemId], enemy = T.EnemyTemplateDisplayInfoTable[row.refMonsterTemplateId], archive = T.PrtsAllItem[row.prtsId];
                const groupIds = row.groupId ? [row.groupId] : c.entries(T.WikiEntryTable).filter(([, group]) => (group.list || []).includes(id)).map(([key]) => key);
                const groupNames = groupIds.map(key => groups.get(key)).filter(Boolean);
                if (!groupNames.length && row.groupId) c.issue('unmapped-group', 'WikiGroupTable', row.groupId, id);
                const title = c.name([pages[0]?.title, item?.name, enemy?.name, archive?.name].map(c.text).find(Boolean), id);
                return { id, name: title, kind: 'entry', group: groupNames.join(' · ') || c.t(pages.length ? 'tutorials' : 'otherEntries'), raw: row, pages,
                    search: [c.text(row.desc), ...pages.map(page => c.text(page.title) + ' ' + c.text(page.content))].join(' '),
                    sources: [...(source ? [{ table: 'WikiEntryDataTable', key: id }] : []), ...pages.map(page => ({ table: 'WikiTutorialPageTable', key: page.key }))] };
            };
            const rows = c.entries(T.WikiEntryDataTable).map(([id, row]) => build(id, row, true));
            for (const [id, keys] of pagesByTutorial) {
                if (T.WikiEntryDataTable[id]) continue;
                if ([...keys].some(key => !assigned.has(key))) { c.issue('unindexed-tutorial', 'WikiTutorialPageTable', id); rows.push(build(id, {}, false)); }
            }
            return rows.sort((a, b) => a.group.localeCompare(b.group) || (a.raw.order || 0) - (b.raw.order || 0) || a.name.localeCompare(b.name));
        },
        render(entry, c) {
            const T = c.tables, r = entry.raw;
            const entryName = id => {
                const other = T.WikiEntryDataTable[id];
                const pageId = T.WikiTutorialPageByEntryTable[id]?.pageIds?.[0];
                return c.name(T.WikiTutorialPageTable[pageId]?.title || T.ItemTable[other?.refItemId]?.name || T.EnemyTemplateDisplayInfoTable[other?.refMonsterTemplateId]?.name || T.PrtsAllItem[other?.prtsId]?.name, id);
            };
            let html = c.rich(r.desc);
            const links = [];
            if (r.refItemId) links.push(c.item(r.refItemId));
            if (r.refMonsterTemplateId) links.push(c.link('v3_enemy', r.refMonsterTemplateId, c.name(T.EnemyTemplateDisplayInfoTable[r.refMonsterTemplateId]?.name, r.refMonsterTemplateId)));
            if (r.prtsId) links.push(c.link('v3_archive', r.prtsId, c.name(T.PrtsAllItem[r.prtsId]?.name, r.prtsId)));
            if (links.length) html += c.section(c.t('relatedEntries'), links.join(' '), true);
            for (const [index, page] of entry.pages.entries()) {
                const related = (page.refWikiEntryIds || []).map(id => c.link('tutorial', id, entryName(id))).join(' ');
                let media = '';
                if (page.image) media += `<p><button class="ake-ui-button" type="button" data-catalog-media="${c.h(page.image)}" data-media-title="${c.h(c.text(page.title))}">${c.h(c.t('showImage'))}</button></p>`;
                if (page.video) media += `<p>${c.h(c.t('videoUnavailable'))}</p>`;
                html += c.section(c.t('tutorialPage', { index: index + 1, title: c.name(page.title, page.key) }), c.rich(page.content) + media + related + c.raw(page), true);
            }
            return html || c.state(c.t('noTutorialPages'));
        }
    });
})();
