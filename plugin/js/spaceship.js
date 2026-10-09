(function () {
    'use strict';
    const levelTables = ['SpaceshipControlCenterLvTable', 'SpaceshipManufacturingStationLvTable', 'SpaceshipGrowCabinLvTable', 'SpaceshipGuestRoomLvTable', 'SpaceshipGuestRoomClueLvTable', 'SpaceshipCommandCenterLvTable'];
    window.AKECatalog.mount({
        id: 'spaceship',
        tables: ['SpaceshipRoomTypeTable', 'SpaceshipRoomLvTable', 'SpaceshipRoomLvHelperTable', ...levelTables,
            'SpaceshipRoomAttrTypeTable', 'SpaceshipClueDataTable', 'SpaceshipCreditTable', 'SpaceshipDomainMoneyExchangeRateDataTable',
            'SpaceshipGrowCabinFormulaTable', 'SpaceshipGrowCabinSeedFormulaTable', 'SpaceshipManufactureFormulaTable',
            'SpaceshipSkillTable', 'SpaceshipCharSkillTable', 'CharacterTable'],
        optional: ['SpaceshipCommandCenterLvTable'],
        primary: ['SpaceshipRoomTypeTable', 'SpaceshipRoomLvTable', 'SpaceshipClueDataTable', 'SpaceshipRoomAttrTypeTable', ...levelTables],
        build(c) {
            const T = c.tables;
            const levels = new Map();
            for (const [key, row] of c.entries(T.SpaceshipRoomLvTable)) levels.set(key, { ...row, key });
            for (const source of levelTables) for (const [key, row] of c.entries(T[source])) {
                const id = row.id || key;
                const helper = T.SpaceshipRoomLvHelperTable[id] || {};
                const previous = levels.get(id) || {};
                levels.set(id, { ...previous, ...helper, ...row, key: id, refs: [...(previous.refs || []), { table: source, key }] });
            }
            for (const [id, row] of levels) {
                const helper = T.SpaceshipRoomLvHelperTable[id];
                if (row.roomType === undefined && helper) Object.assign(row, helper);
            }
            const roomTypes = new Set([...Object.keys(T.SpaceshipRoomTypeTable), ...[...levels.values()].map(row => String(row.roomType ?? 'unassigned'))]);
            const rows = [...roomTypes].map(id => {
                const room = T.SpaceshipRoomTypeTable[id] || {};
                const roomLevels = [...levels.values()].filter(row => String(row.roomType ?? 'unassigned') === id).sort((a, b) => (a.level || 0) - (b.level || 0));
                if (!T.SpaceshipRoomTypeTable[id]) c.issue('unmapped-room', 'SpaceshipRoomTypeTable', id);
                const roomName = id === 'unassigned' ? c.t('unassignedRooms') : c.name(room.name, id);
                return { id: `room:${id}`, key: id, kind: 'room', name: roomName, group: c.t('rooms'), raw: room, levels: roomLevels,
                    subtitle: c.t('levelCount', { count: roomLevels.length }),
                    search: [c.text(room.desc), c.text(room.helpDesc)].join(' '), sources: [
                        ...(T.SpaceshipRoomTypeTable[id] ? [{ table: 'SpaceshipRoomTypeTable', key: id }] : []),
                        ...roomLevels.filter(row => T.SpaceshipRoomLvTable[row.key]).map(row => ({ table: 'SpaceshipRoomLvTable', key: row.key })),
                        ...roomLevels.flatMap(row => row.refs || [])
                    ] };
            });
            for (const [source, kind, group] of [['SpaceshipClueDataTable', 'clue', 'clues'], ['SpaceshipRoomAttrTypeTable', 'attribute', 'roomAttributes']]) {
                for (const [key, row] of c.entries(T[source])) rows.push({ id: `${kind}:${key}`, key, kind, name: c.name(row.name, key), group: c.t(group), raw: row, sources: [{ table: source, key }] });
            }
            rows.push({ id: 'credit', kind: 'credit', name: c.t('creditExchange'), group: c.t('clues'), raw: {} });
            return rows;
        },
        render(entry, c) {
            const T = c.tables, r = entry.raw;
            if (entry.kind === 'credit') return c.section(c.t('creditExchange'), c.table([c.t('totalPrice'), c.t('creditRewards')], c.values(T.SpaceshipCreditTable).map(row => [c.number(row.totalPrice), c.number(row.creditRewardCnt)])), true)
                + c.section(c.t('exchangeRate'), c.table([c.t('item'), c.t('exchangeRate')], c.entries(T.SpaceshipDomainMoneyExchangeRateDataTable).map(([id, row]) => [c.item(row.id || id), c.number(row.exchangeRate)])), true);
            if (entry.kind === 'clue') return c.section(c.t('roomAttributes'), c.link('spaceship', `attribute:${r.roomAttrType}`, c.name(T.SpaceshipRoomAttrTypeTable[r.roomAttrType]?.name, r.roomAttrType)), true);
            if (entry.kind === 'attribute') return c.rich(r.desc) + c.fields(r, ['isPercent', 'showRate']);
            let html = c.rich(r.desc) + c.rich(r.helpDesc) + c.rich(r.extraDesc1);
            const formula = id => {
                const grow = T.SpaceshipGrowCabinFormulaTable[id], manufacture = T.SpaceshipManufactureFormulaTable[id], seed = T.SpaceshipGrowCabinSeedFormulaTable[id];
                const row = grow || manufacture || seed;
                if (!row) { c.issue('missing-recipe', 'spaceship', id); return c.h(c.t('unavailable')); }
                const output = grow ? c.item(grow.outcomeItemId, grow.outcomeItemCount) : manufacture ? c.item(manufacture.outcomeItemId) : c.item(seed.outcomeseedItemId, seed.outcomeseedItemCount);
                const input = grow ? c.item(grow.seedItemId, grow.seedItemCount) : seed ? c.item(seed.materialItemId, seed.materialItemCount) : '';
                const relatedSeed = grow?.seedFormulaId ? T.SpaceshipGrowCabinSeedFormulaTable[grow.seedFormulaId] : null;
                return `${input ? input + ' → ' : ''}${output}${relatedSeed ? `<br>${c.h(c.t('seedExtraction'))}: ${c.item(relatedSeed.materialItemId, relatedSeed.materialItemCount)} → ${c.item(relatedSeed.outcomeseedItemId, relatedSeed.outcomeseedItemCount)}` : ''}`;
            };
            for (const level of entry.levels) {
                const upgrade = T.SpaceshipRoomLvTable[level.key];
                const content = (upgrade ? c.rich(upgrade.conditionDesc) + c.section(c.t('cost'), c.items(upgrade.costItems), true) : '')
                    + c.fields(level, ['stationMaxCount', 'machineCapacity', 'manufacturingStationMaxCount', 'growCabinMaxCount', 'commandCenterMaxCount', 'baseCreditReward', 'baseInfoReward', 'extraCreditPerRole', 'extraInfoPerRole', 'maxCalcRoleCount', 'maxExtraCredit', 'maxExtraInfo', 'creditFriendJoinExchangeGain'])
                    + c.rich(level.unlockAreaText)
                    + (level.unlockRoomType !== undefined ? `<p>${c.h(c.t('unlocks'))}: ${c.link('spaceship', `room:${level.unlockRoomType}`, c.name(T.SpaceshipRoomTypeTable[level.unlockRoomType]?.name, level.unlockRoomType))}</p>` : '')
                    + (level.unlockPlantingField?.length ? `<p>${c.h(c.t('plantingFields', { count: level.unlockPlantingField.length }))}</p>` : '')
                    + (level.unlockRecipe?.length ? c.section(c.t('recipes'), level.unlockRecipe.map(formula).join('<br>'), true) : '')
                    + (level.rewardId ? c.section(c.t('rewards'), c.reward(level.rewardId)) : '') + c.raw({ ...level, upgrade });
                html += c.section(c.t('levelValue', { value: level.level ?? '—' }), content, true);
            }
            if (!entry.levels.length) html += c.state(c.t('noLevels'));
            const skills = c.entries(T.SpaceshipSkillTable).filter(([, skill]) => String(skill.roomType) === entry.key);
            html += c.section(c.t('logisticsSkills'), c.table([c.t('name'), c.t('effect'), c.t('characters')], skills.map(([id, skill]) => {
                const chars = c.entries(T.SpaceshipCharSkillTable).flatMap(([charId, row]) => (row.skillList || []).filter(slot => slot.skillId === id).map(slot => ({ charId, slot })));
                return [c.h(c.name(skill.name, id)), c.rich(skill.desc), chars.map(({ charId, slot }) => c.link('v3_character', charId, c.name(T.CharacterTable[charId]?.name, charId)) + c.rich(slot.unlockHint)).join('<br>') || '—'];
            })));
            if (r.previewProductItemIds?.length) html += c.section(c.t('products'), r.previewProductItemIds.map(id => c.item(id)).join(' '));
            return html;
        }
    });
})();
