(function () {
    'use strict';
    // Specializations join by buildingId/id (or table key for keyed maps), never by display name.
    const specifications = [
        ['FactoryPowerPoleTable', 'power'], ['FactoryPowerStationTable', 'power'], ['FactoryHubTable', 'power'],
        ['FactoryStoragerTable', 'storage'], ['FactoryFluidContainerTable', 'storage'], ['FactoryGasContainerTable', 'storage'],
        ['FactoryUndergroundPipeTable', 'logistics'], ['FactoryFluidPumpOutTable', 'fluid'], ['FactoryFluidPumpInTable', 'fluid'],
        ['FactoryFluidSprayTable', 'fluid'], ['FactoryTransmuterTable', 'production'],
        ['FactoryMinerTable', 'mining'], ['FactoryGasMinerTable', 'mining'], ['FactoryBattleTable', 'combat'],
        ['FactoryGridBeltTable', 'logistics'], ['FactoryLiquidPipeTable', 'logistics'], ['FactoryMachineCrafterTable', 'production'],
        ['FactoryFluidValveTable', 'fluid'], ['FactoryLiquidConnectorTable', 'fluid'], ['FactoryLiquidRouterTable', 'fluid'],
        ['FactoryGridRouterTable', 'logistics'], ['FactoryGridConnecterTable', 'logistics'], ['FactoryBoxValveTable', 'logistics'],
        ['FactoryFluidConsumeTable', 'fluid']
    ];
    const unitData = row => row.beltData || row.pipeData || row.liquidUnitData || row.gridUnitData || row;
    const numericFields = ['capacity', 'msTransferCD', 'msPerRound', 'powerProvide', 'powerGenerate', 'powerStorageCapacity',
        'autoConnect', 'autoConnectLength', 'defaultCanBeWireStart', 'defaultEnableDiffuser', 'maximumSuply', 'consumeBindings',
        'consumeRate', 'consumeRateUpperLimit', 'attackCost', 'attackRange', 'attackRange1', 'minAttackRange', 'chargeInterval',
        'energyChargeCount', 'energyChargeMillSec', 'energyMax', 'volume', 'hasDroneMode'];
    window.AKECatalog.mount({
        id: 'factory',
        tables: ['FactoryBuildingTable', 'FactoryBuildingItemTable', 'FactoryQuickBarTypeTable', ...specifications.map(([name]) => name),
            'FactoryMachineCraftModeTable', 'FactoryMachineCraftGroupTable', 'FactoryMachineCraftTable',
            'FactoryBatteryItemTable', 'FactoryFuelItemTable', 'MachineId2MachineTechIdTable', 'FacSTTNodeTable',
            'FacSTTBuildingDomainLimitTechTable', 'DomainDataTable'],
        primary: ['FactoryBuildingTable', 'FactoryBatteryItemTable', 'FactoryFuelItemTable', ...specifications.map(([name]) => name)],
        build(c) {
            const T = c.tables, buildings = new Map();
            for (const [key, row] of c.entries(T.FactoryBuildingTable)) buildings.set(key, {
                id: `building:${key}`, key, kind: 'building', raw: row, specs: [], name: c.name(row.name, key),
                group: c.text(T.FactoryQuickBarTypeTable[row.quickBarType]?.name) || c.t('buildingType', { value: row.type ?? '?' }),
                search: c.text(row.desc), sources: [{ table: 'FactoryBuildingTable', key }]
            });
            for (const [source, group] of specifications) for (const [key, row] of c.entries(T[source])) {
                const id = row.buildingId || row.id || key;
                if (!buildings.has(id)) {
                    const data = unitData(row);
                    buildings.set(id, { id: `building:${id}`, key: id, kind: 'building', raw: {}, specs: [],
                        name: c.name(data.name || T.ItemTable[data.itemId]?.name, id), group: c.t(group), sources: [] });
                    c.issue('specialization-without-building', source, key, id);
                }
                const entry = buildings.get(id);
                entry.specs.push({ source, group, raw: row });
                entry.sources.push({ table: source, key });
            }
            const rows = [...buildings.values()];
            for (const [source, kind] of [['FactoryBatteryItemTable', 'battery'], ['FactoryFuelItemTable', 'fuel']]) {
                for (const [key, row] of c.entries(T[source])) rows.push({ id: `${kind}:${key}`, key, kind, raw: row,
                    name: c.name(T.ItemTable[row.id || key]?.name, key), group: c.t(kind), sources: [{ table: source, key }] });
            }
            return rows.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
        },
        render(entry, c) {
            const T = c.tables, r = entry.raw;
            if (entry.kind !== 'building') return c.item(r.id || entry.key) + c.fields(r, ['BatteryEnergy', 'fuelEnergy', 'powerProvide', 'progressRound']);
            let html = c.rich(r.desc);
            const itemIds = new Set(c.values(T.FactoryBuildingItemTable).filter(row => row.buildingId === entry.key).map(row => row.itemId));
            for (const spec of entry.specs) {
                const data = unitData(spec.raw);
                if (data?.itemId) itemIds.add(data.itemId);
            }
            if (itemIds.size) html += c.section(c.t('buildingItems'), [...itemIds].map(id => c.item(id)).join(' '), true);
            html += c.section(c.t('specifications'), c.fields(r, ['bandwidth', 'needPower', 'powerConsume', 'liquidEnabled', 'allowPlayerMove', 'canDelete'])
                + (r.range ? c.table([c.t('width'), c.t('depth'), c.t('height')], [[c.number(r.range.width), c.number(r.range.depth), c.number(r.range.height)]]) : ''), true);
            const ports = [...(r.inputPorts || []).map(port => ({ ...port, direction: 'input' })), ...(r.outputPorts || []).map(port => ({ ...port, direction: 'output' }))];
            if (ports.length) html += c.section(c.t('ports'), c.table([c.t('direction'), c.t('port'), c.t('connection'), c.t('position')], ports.map(port => [
                c.h(c.t(port.direction)), c.number(port.index), c.h(c.t(port.isPipe ? 'pipe' : 'belt')),
                port.trans?.position ? [port.trans.position.x, port.trans.position.y, port.trans.position.z].map(c.number).join(' / ') : '—'
            ])));
            for (const spec of entry.specs) {
                const data = unitData(spec.raw);
                let content = c.fields(data, numericFields) + c.rich(data.normalDesc) + c.rich(data.overloadDesc);
                const specialPorts = [...(spec.raw.inputPorts || []).map((port, index) => ({ ...port, index, direction: 'input' })), ...(spec.raw.outputPorts || []).map((port, index) => ({ ...port, index, direction: 'output' }))];
                if (specialPorts.length) content += c.table([c.t('direction'), c.t('port'), c.t('position')], specialPorts.map(port => [
                    c.h(c.t(port.direction)), c.number(port.index), port.position ? [port.position.x, port.position.y, port.position.z].map(c.number).join(' / ') : '—'
                ]));
                if (spec.raw.range) content += c.table([c.t('rangeX'), c.t('rangeY'), c.t('rangeZ')], [[spec.raw.range.x, spec.raw.range.y, spec.raw.range.z].map(c.number)]);
                if (data.rangeExtend) content += c.table([c.t('rangeX'), c.t('rangeY'), c.t('rangeZ')], [[data.rangeExtend.x, data.rangeExtend.y, data.rangeExtend.z].map(c.number)]);
                if (data.consumeItem && typeof data.consumeItem === 'string') content += `<p>${c.h(c.t('consumes'))}: ${c.item(data.consumeItem)}</p>`;
                if (data.validItemIds?.length) content += `<p>${c.h(c.t('supportedItems'))}: ${data.validItemIds.map(id => c.item(id)).join(' ')}</p>`;
                if (data.liquidable?.length) content += `<p>${c.h(c.t('supportedItems'))}: ${data.liquidable.map(id => c.item(id)).join(' ')}</p>`;
                if (data.enableLiquidIds?.length) content += `<p>${c.h(c.t('supportedItems'))}: ${data.enableLiquidIds.map(id => c.item(id)).join(' ')}</p>`;
                if (data.mineable?.length) content += c.table([c.t('item'), c.t('productionPerCycle'), c.t('consumes')], data.mineable.map(row => [c.item(row.miningItemId), c.number(row.produceRate), row.consumeItem?.id ? c.items([row.consumeItem]) : '—']));
                if (data.modeMap?.length) content += c.table([c.t('mode'), c.t('description'), c.t('initiallyUnlocked'), c.t('cycleMs')], data.modeMap.map(mode => {
                    const modeInfo = T.FactoryMachineCraftModeTable[mode.modeName];
                    if (!modeInfo) c.issue('unmapped-mode', 'FactoryMachineCraftModeTable', mode.modeName, entry.key);
                    return [c.h(c.name(modeInfo?.machineModeTypeName, mode.modeName)), c.rich(modeInfo?.machineModeTypeDes),
                        c.h(data.modeUnlockDefaultMap?.[mode.modeName] === undefined ? c.t('unavailable') : c.t(data.modeUnlockDefaultMap[mode.modeName] ? 'yes' : 'no')),
                        c.number(T.FactoryMachineCraftGroupTable[mode.groupName]?.msPerRound)];
                }));
                html += c.section(c.t(spec.group), content + c.raw(spec.raw), true);
            }
            const techId = T.MachineId2MachineTechIdTable[entry.key]?.techId;
            if (techId) html += c.section(c.t('unlockTechnology'), c.link('tech_tree', `node:${techId}`, c.name(T.FacSTTNodeTable[techId]?.name, techId)), true);
            if (r.placeDomains?.length || r.recommendDomains?.length) html += c.section(c.t('domains'), c.table([c.t('allowedDomains'), c.t('recommendedDomains')], [[
                (r.placeDomains || []).map(id => c.h(c.domain(id))).join(' · ') || '—', (r.recommendDomains || []).map(id => c.h(c.domain(id))).join(' · ') || '—'
            ]]));
            const limits = c.values(T.FacSTTBuildingDomainLimitTechTable).filter(row => row.buildingId === entry.key);
            if (limits.length) html += c.section(c.t('buildingLimits'), c.table([c.t('domain'), c.t('baseLimit'), c.t('unlockTechnology'), c.t('limit')], limits.flatMap(row => (row.stepTechIds || []).map((id, index) => [
                c.h(c.domain(row.domainId)), c.number(row.baseLimit), c.link('tech_tree', `node:${id}`, c.name(T.FacSTTNodeTable[id]?.name, id)), c.number(row.stepLimits?.[index])
            ]))));
            const recipes = c.values(T.FactoryMachineCraftTable).filter(row => row.machineId === entry.key);
            if (recipes.length) html += c.section(c.t('recipes'), `<p>${c.h(c.t('recipeDetailsHint'))}</p>` + c.table([c.t('description'), c.t('products')], recipes.map(row => [
                c.rich(row.formulaDesc) || '—', (row.outcomes || []).flatMap(group => group.group || []).map(output => c.item(output.id)).join(' ')
            ])));
            return html;
        }
    });
})();
