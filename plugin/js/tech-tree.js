(function () {
    'use strict';
    window.AKECatalog.mount({
        id: 'tech_tree',
        tables: ['FacSTTGroupTable', 'FacSTTCategoryTable', 'FacSTTLayerTable', 'FacSTTNodeTable', 'FacSTTConditionTable', 'FacSTTPackConditionTable', 'FacSTTBuildingDomainLimitTechTable', 'MachineId2MachineTechIdTable', 'FactoryBuildingTable', 'DomainDataTable', 'DungeonTable'],
        primary: ['FacSTTGroupTable', 'FacSTTLayerTable', 'FacSTTNodeTable'],
        build(c) {
            const result = [];
            for (const [source, kind] of [['FacSTTGroupTable', 'plan'], ['FacSTTLayerTable', 'layer'], ['FacSTTNodeTable', 'node']]) {
                for (const [key, row] of c.entries(c.tables[source])) {
                    const plan = kind === 'plan' ? row : c.tables.FacSTTGroupTable[row.groupId];
                    if (!plan) c.issue('missing-reference', 'FacSTTGroupTable', row.groupId, key);
                    const category = c.tables.FacSTTCategoryTable[row.category];
                    result.push({ id: `${kind}:${key}`, key, kind, raw: row,
                        name: c.name(row.groupName || row.name, key), group: c.name(plan?.groupName, row.groupId),
                        search: [c.text(row.desc), c.text(row.unlockDesc), c.text(category?.name)].join(' '), sources: [{ table: source, key }] });
                }
            }
            return result.sort((a, b) => a.group.localeCompare(b.group) || (a.raw.sortId ?? a.raw.order ?? -1) - (b.raw.sortId ?? b.raw.order ?? -1));
        },
        render(entry, c) {
            const r = entry.raw, T = c.tables;
            const techLink = id => {
                const node = T.FacSTTNodeTable[id];
                if (!node) c.issue('missing-reference', 'FacSTTNodeTable', id, entry.key);
                return c.link('tech_tree', `node:${id}`, c.name(node?.name, id));
            };
            const layerLink = id => c.link('tech_tree', `layer:${id}`, c.name(T.FacSTTLayerTable[id]?.name, id));
            const mergedConditions = [...c.list(r.conditions)];
            for (const condition of c.values(entry.kind === 'plan' ? T.FacSTTPackConditionTable : T.FacSTTConditionTable)) {
                if ((entry.kind === 'plan' ? condition.groupId : condition.techId) === entry.key && !mergedConditions.some(row => row.conditionId === condition.conditionId)) mergedConditions.push(condition);
            }
            let html = c.rich(r.desc) + c.rich(r.unlockDesc);
            if (entry.kind === 'plan') {
                html += c.section(c.t('overview'), c.table([c.t('property'), c.t('value')], [
                    [c.h(c.t('domain')), c.h(c.domain(r.domainId))], [c.h(c.t('researchCurrency')), c.item(r.costPointType)]
                ]), true);
                const layers = c.entries(T.FacSTTLayerTable).filter(([, row]) => row.groupId === entry.key).sort((a, b) => a[1].order - b[1].order);
                html += c.section(c.t('layers'), c.table([c.t('name'), c.t('prerequisites'), c.t('cost')], layers.map(([id, row]) => [layerLink(id), row.preLayer ? layerLink(row.preLayer) : '—', c.items(row.costItems)])), true);
            }
            if (entry.kind === 'layer') {
                html += c.section(c.t('prerequisites'), r.preLayer ? layerLink(r.preLayer) : c.h(c.t('none')), true);
                html += c.section(c.t('cost'), c.items(r.costItems), true);
            }
            if (entry.kind !== 'node') {
                // Enumerate the node table as well as explicit lists: new unlisted nodes remain visible.
                const ids = new Set([...(r.techIds || []), ...c.entries(T.FacSTTNodeTable).filter(([, row]) => entry.kind === 'plan' ? row.groupId === entry.key : row.layer === entry.key).map(([id]) => id)]);
                html += c.section(c.t('technologies'), c.table([c.t('name'), c.t('category'), c.t('prerequisites'), c.t('cost')], [...ids].map(id => {
                    const node = T.FacSTTNodeTable[id] || {};
                    return [techLink(id), c.h(c.name(T.FacSTTCategoryTable[node.category]?.name, node.category)), (node.preNode || []).map(techLink).join(' ') || '—', `${c.number(node.costPointCount)} ${c.h(c.t('researchPoints'))}<br>${c.items(node.costItems)}`];
                })), true);
            } else {
                const plan = T.FacSTTGroupTable[r.groupId];
                html += c.section(c.t('overview'), c.table([c.t('property'), c.t('value')], [
                    [c.h(c.t('plan')), c.link('tech_tree', `plan:${r.groupId}`, c.name(plan?.groupName, r.groupId))],
                    [c.h(c.t('layer')), r.layer ? layerLink(r.layer) : '—'],
                    [c.h(c.t('category')), c.h(c.name(T.FacSTTCategoryTable[r.category]?.name, r.category))],
                    [c.h(c.t('initiallyUnlocked')), c.h(c.t(r.alreadyUnlock ? 'yes' : 'no'))]
                ]), true);
                html += c.section(c.t('prerequisites'), (r.preNode || []).map(techLink).join(' ') || c.h(c.t('none')), true);
                const successors = c.entries(T.FacSTTNodeTable).filter(([, row]) => (row.preNode || []).includes(entry.key));
                html += c.section(c.t('nextTechnologies'), successors.map(([id]) => techLink(id)).join(' '));
                html += c.section(c.t('cost'), `${plan?.costPointType ? c.item(plan.costPointType, r.costPointCount) : c.number(r.costPointCount)}<br>${c.items(r.costItems)}`, true);
                html += c.section(c.t('unlocks'), c.items(r.unlockReward), true);
                const machines = c.entries(T.MachineId2MachineTechIdTable).filter(([, row]) => row.techId === entry.key);
                if (machines.length) html += c.section(c.t('buildings'), machines.map(([id]) => c.link('factory', `building:${id}`, c.name(T.FactoryBuildingTable[id]?.name, id))).join(' '));
                const limits = c.values(T.FacSTTBuildingDomainLimitTechTable).flatMap(row => (row.stepTechIds || []).flatMap((id, index) => id === entry.key ? [[c.h(c.domain(row.domainId)), c.link('factory', `building:${row.buildingId}`, c.name(T.FactoryBuildingTable[row.buildingId]?.name, row.buildingId)), c.number(row.baseLimit), c.number(row.stepLimits?.[index])]] : []));
                if (limits.length) html += c.section(c.t('buildingLimits'), c.table([c.t('domain'), c.t('name'), c.t('baseLimit'), c.t('limit')], limits));
                if (r.action && !c.text(r.unlockDesc) && !r.unlockReward?.length) {
                    c.issue('untranslated-action', 'FacSTTNodeTable', entry.key, r.action.actionType);
                    html += c.section(c.t('effect'), c.h(c.t('actionType', { value: r.action.actionType })));
                }
            }
            html += c.section(c.t('conditions'), c.conditions(mergedConditions));
            if (r.blackboxIds?.length) html += c.section(c.t('blackboxes'), r.blackboxIds.map(c.dungeon).join(' '));
            if (r.adventurebookRewardId) html += c.section(c.t('rewards'), c.reward(r.adventurebookRewardId));
            return html;
        }
    });
})();
