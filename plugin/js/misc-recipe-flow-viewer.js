(function () {
    'use strict';

    const MODULE_ID = 'recipe_flow_viewer';
    const DEFAULT_ITEM_ID = 'item_proc_battery_5';
    const MAX_DEPTH = 10;
    const TABLE_NAMES = [
        'ItemTable',
        'FactoryMachineCraftTable',
        'FactoryMachineCraftGroupTable',
        'FactoryManualCraftTable',
        'FactoryHubCraftTable',
        'FactoryBuildingTable',
        'FactoryEnvDisplayTable',
        'EquipFormulaTable',
        'EquipFormulaChainTable',
        'SpaceshipGrowCabinFormulaTable',
        'SpaceshipGrowCabinSeedFormulaTable',
        'SpaceshipManufactureFormulaTable',
        'FactoryFuelItemTable',
        'FactoryPowerStationTable',
        'FactoryMinerTable',
        'FactoryGasMinerTable',
        'FactoryFluidPumpInTable',
        'FactoryFluidConsumeItemTable',
        'FactoryFluidConsumeTable',
        'FactoryVaporizerTable',
        'WikiDefaultCraftTable'
    ];
    const FACTORY_ENVIRONMENT_TEXT_IDS = Object.freeze({
        1: '4749896721646405651',
        2: '2583412103900909986',
        3: '8325730894015926297',
        4: '3873336576577928485'
    });
    const FACTORY_ENVIRONMENT_COLORS = Object.freeze({
        1: '#32c0ff',
        2: '#ffffff',
        3: '#ffba00',
        4: '#1ec89a'
    });

    window.AKEMisc.register(MODULE_ID, async function (context) {
        const root = context.root;
        const t = (key, params, fallback) => window.akeI18n?.t(
            'modules.misc.recipeFlowViewer.' + key, params, fallback
        ) || fallback || key;
        const actionText = (chinese, english) => ['CH', 'TC'].includes(window.akeI18n?.getLanguage?.())
            ? chinese : english;
        const escape = context.escapeHtml;
        const text = (value, fallback) => String(context.text(value, fallback) || fallback || '');
        const showHidden = () => window.akeData?.getConfig?.().showHidden === true;
        const search = root.querySelector('#recipeFlowViewerSearch');
        const resultsRoot = root.querySelector('#recipeFlowViewerResults');
        const selectedRoot = root.querySelector('#recipeFlowViewerSelected');
        const upstreamRoot = root.querySelector('#recipeFlowViewerUpstream');
        const downstreamRoot = root.querySelector('#recipeFlowViewerDownstream');
        const statusRoot = root.querySelector('#recipeFlowViewerStatus');
        const upstreamCountRoot = root.querySelector('#recipeFlowViewerUpstreamCount');
        const downstreamCountRoot = root.querySelector('#recipeFlowViewerDownstreamCount');
        const fullscreenButton = root.querySelector('#recipeFlowViewerFullscreen');
        const exportButton = root.querySelector('#recipeFlowViewerExport');

        let itemTable = {};
        let allItems = [];
        let recipes = [];
        let byOutput = new Map();
        let byInput = new Map();
        let defaultCraftTable = {};
        let environmentTextTable = {};
        let selectedId = DEFAULT_ITEM_ID;
        let expandedCraftKeys = new Set();
        let expandedRepeatedKeys = new Set();
        let graphZoom = 1;
        const GRAPH_ZOOM = Object.freeze({ min: .1, max: 2.5, step: .1 });
        const GRAPH_VIEWPORT_HEIGHT = 520;
        const GRAPH_LAYOUT = Object.freeze({
            itemButtonWidth: 112,
            itemButtonHeight: 112,
            itemColumnWidth: 160,
            recipeWidth: 260,
            recipeHeight: 52,
            columnGap: 52,
            rowStep: 184,
            padding: 56,
            maxDepth: MAX_DEPTH
        });

        function entries(value) {
            if (Array.isArray(value)) return value.map((row, index) => [String(row?.id || index), row || {}]);
            return Object.entries(value || {});
        }

        function list(value) {
            if (Array.isArray(value)) return value;
            if (value && typeof value === 'object') return Object.values(value);
            return [];
        }

        function number(value, fallback) {
            const result = Number(value);
            return Number.isFinite(result) ? result : (fallback ?? 0);
        }

        function flattenBundles(value) {
            return list(value).flatMap(row => Array.isArray(row?.group) ? row.group : [row]).map(row => {
                const id = row?.id || row?.itemId || row?.itemID;
                if (!id) return null;
                const rawCount = row?.count ?? row?.num ?? row?.itemCount ?? row?.amount ?? 1;
                return { id: String(id), count: number(rawCount, 1) };
            }).filter(Boolean);
        }

        function itemInfo(id) {
            const row = itemTable[id] || {};
            return {
                id,
                name: text(row.name, showHidden() ? id : t('unknownItem', null, 'Unknown item')),
                iconId: row.iconId || '',
                row
            };
        }

        function tableText(value, fallback) {
            return text(value, fallback || '');
        }

        function formatNumber(value) {
            const numeric = number(value, 0);
            return Number.isInteger(numeric)
                ? numeric.toLocaleString()
                : numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
        }

        function formatDuration(milliseconds) {
            const ms = number(milliseconds, 0);
            if (ms <= 0) return t('instant', null, 'Instant');
            let seconds = Math.max(0, Math.round(ms / 1000));
            const days = Math.floor(seconds / 86400);
            seconds %= 86400;
            const hours = Math.floor(seconds / 3600);
            seconds %= 3600;
            const minutes = Math.floor(seconds / 60);
            seconds %= 60;
            const parts = [];
            if (days) parts.push(t('durationDays', { count: days }, days + 'd'));
            if (hours) parts.push(t('durationHours', { count: hours }, hours + 'h'));
            if (minutes) parts.push(t('durationMinutes', { count: minutes }, minutes + 'm'));
            if (seconds) parts.push(t('durationSeconds', { count: seconds }, seconds + 's'));
            return parts.join(' ') || t('lessThanSecond', null, '<1s');
        }

        function itemIcon(id, className) {
            const info = itemInfo(id);
            if (!info.iconId) return '';
            return '<img class="' + (className || 'ake-ui-tree__group-icon') +
                '" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/' +
                escape(info.iconId) + '.png" alt="" loading="lazy" decoding="async">';
        }

        function materialMarkup(entry) {
            const info = itemInfo(entry.id);
            const title = showHidden() ? info.name + ' [' + entry.id + ']' : info.name;
            const attributes = {
                type: 'button',
                'data-recipe-flow-item': entry.id,
                title
            };
            const material = window.AKEUI?.materialItem?.({
                element: 'button',
                className: 'recipe-flow-material',
                icon: info.iconId ? '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/' + info.iconId + '.png' : '',
                name: info.name,
                count: formatNumber(entry.count),
                attributes
            });
            if (material?.outerHTML) return material.outerHTML;
            return '<button class="ake-ui-material__item recipe-flow-material" type="button" data-recipe-flow-item="' +
                escape(entry.id) + '" title="' + escape(title) + '">' +
                (info.iconId ? itemIcon(entry.id, 'ake-ui-material__item-icon') : '') +
                '<span class="ake-ui-material__item-name">' + escape(info.name) + '</span>' +
                '<strong class="ake-ui-material__item-count">x' + escape(formatNumber(entry.count)) + '</strong></button>';
        }

        function materialList(entriesToRender, emptyKey) {
            if (!entriesToRender.length) {
                return '<span class="ake-ui-muted">' + escape(t(emptyKey, null, 'None')) + '</span>';
            }
            return '<span class="ake-ui-material__items">' +
                entriesToRender.map(materialMarkup).join('') + '</span>';
        }

        function isDirectSource(id) {
            const row = itemTable[id] || {};
            return Array.isArray(row.obtainWayIds) && row.obtainWayIds.length > 0;
        }

        function environmentInfo(value, environments) {
            const gasEnv = number(value, 0);
            if (!gasEnv) return null;
            const environmentId = number(environments[String(gasEnv)]?.GenEnv, gasEnv);
            const textId = FACTORY_ENVIRONMENT_TEXT_IDS[environmentId];
            return {
                id: environmentId,
                name: environmentTextTable.localized?.[textId] || environmentTextTable.chinese?.[textId] ||
                    actionText('环境 ' + environmentId, 'Environment ' + environmentId),
                color: FACTORY_ENVIRONMENT_COLORS[environmentId] || '#ffffff'
            };
        }

        function addRecipe(recipe) {
            const inputs = (recipe.inputs || []).filter(entry => entry?.id);
            const outputs = (recipe.outputs || []).filter(entry => entry?.id);
            if (!inputs.length && !outputs.length) return;
            recipes.push({
                recipeId: String(recipe.recipeId || ''),
                kind: recipe.kind || '',
                kindOrder: number(recipe.kindOrder, 99),
                inputOrder: number(recipe.inputOrder, recipe.kindOrder ?? 99),
                name: recipe.name || '',
                inputs,
                outputs,
                meta: recipe.meta || '',
                environment: recipe.environment && typeof recipe.environment === 'object'
                    ? recipe.environment : null,
                durationMs: number(recipe.durationMs, 0),
                destination: recipe.destination || '',
                facilityId: String(recipe.facilityId || ''),
                facilityName: recipe.facilityName || '',
                facilityIconId: recipe.facilityIconId || '',
                isEquipment: recipe.isEquipment === true,
                isSummary: recipe.isSummary === true,
                summaryText: recipe.summaryText || '',
                sortId1: number(recipe.sortId1, 999999),
                sortId2: number(recipe.sortId2, 999999)
            });
        }

        function normalizeRecipes(data) {
            const [
                items,
                machineCrafts,
                machineGroups,
                manualCrafts,
                hubCrafts,
                buildings,
                environments,
                equipFormulas,
                equipChains,
                growFormulas,
                seedFormulas,
                spaceshipFormulas,
                fuelItems,
                powerStations,
                miners,
                gasMiners,
                fluidPumps,
                fluidConsumeItems,
                fluidConsumes,
                vaporizers,
                defaultCrafts
            ] = data;
            itemTable = items || {};
            recipes = [];

            entries(machineCrafts).forEach(([recipeId, row]) => {
                const group = machineGroups?.[String(row.formulaGroupId)] || {};
                const building = buildings?.[String(row.machineId)] || {};
                const environment = environmentInfo(row.gasEnv, environments);
                const meta = [
                    tableText(building.name, row.machineId || ''),
                    environment?.name
                ].filter(Boolean).join(' / ');
                addRecipe({
                    recipeId,
                    kind: t('kinds.machine', null, 'Machine'),
                    kindOrder: 10,
                    inputOrder: 20,
                    name: tableText(row.formulaDesc, ''),
                    inputs: flattenBundles(row.ingredients),
                    outputs: flattenBundles(row.outcomes),
                    meta,
                    environment,
                    durationMs: number(row.progressRound, 0) * number(group.msPerRound, 0),
                    facilityId: row.machineId,
                    facilityName: tableText(building.name, row.machineId || ''),
                    facilityIconId: building.iconOnPanel || '',
                    sortId1: row.sortId
                });
            });

            entries(manualCrafts).forEach(([recipeId, row]) => {
                addRecipe({
                    recipeId,
                    kind: t('kinds.manual', null, 'Manual'),
                    kindOrder: 30,
                    inputOrder: 40,
                    name: tableText(row.name, ''),
                    inputs: flattenBundles(row.ingredients),
                    outputs: flattenBundles(row.outcomes),
                    sortId1: row.sortId
                });
            });

            entries(hubCrafts).forEach(([recipeId, row]) => {
                addRecipe({
                    recipeId,
                    kind: t('kinds.hub', null, 'Hub'),
                    kindOrder: 20,
                    inputOrder: 30,
                    name: tableText(row.name, ''),
                    inputs: flattenBundles(row.ingredients),
                    outputs: flattenBundles(row.outcomes),
                    meta: row.usableLevel ? t('usableLevel', { level: row.usableLevel }, 'Unlock level ' + row.usableLevel) : '',
                    sortId1: row.sortId
                });
            });

            entries(equipFormulas).forEach(([formulaId, row]) => {
                const chainList = equipChains?.[String(row.level)]?.chainList || [];
                chainList.forEach((chain, chainIndex) => {
                    const inputs = (chain.costItemId || []).map((id, index) => ({
                        id: String(id),
                        count: number(chain.costItemNum?.[index], 0)
                    })).filter(entry => entry.count > 0);
                    if (chain.costGoldId && number(chain.costGoldNum, 0) > 0) {
                        inputs.unshift({ id: String(chain.costGoldId), count: number(chain.costGoldNum, 0) });
                    }
                    const outputId = row.outcomeEquipId;
                    if (!outputId) return;
                    const outputName = itemInfo(String(outputId)).name;
                    const level = row.level ? t('equipmentLevel', { level: row.level }, 'Level ' + row.level) : '';
                    const chainName = t('equipmentChain', { chain: chain.chainId || chainIndex + 1 }, 'Chain ' + (chain.chainId || chainIndex + 1));
                    addRecipe({
                        recipeId: formulaId + ':' + String(chain.chainId || chainIndex),
                        kind: t('kinds.equipment', null, 'Equipment'),
                        kindOrder: 40,
                        inputOrder: 70,
                        name: outputName + ' ' + chainName,
                        inputs,
                        outputs: [{ id: String(outputId), count: 1 }],
                        meta: level,
                        isEquipment: true
                    });
                });
            });

            entries(growFormulas).forEach(([recipeId, row]) => {
                addRecipe({
                    recipeId,
                    kind: t('kinds.grow', null, 'Grow cabin'),
                    kindOrder: 70,
                    inputOrder: 80,
                    name: tableText(row.name, ''),
                    inputs: row.seedItemId ? [{ id: String(row.seedItemId), count: number(row.seedItemCount, 1) }] : [],
                    outputs: row.outcomeItemId ? [{ id: String(row.outcomeItemId), count: number(row.outcomeItemCount, 1) }] : [],
                    meta: row.level ? t('facilityLevel', { level: row.level }, 'Level ' + row.level) : '',
                    durationMs: number(row.totalProgress, 0)
                });
            });

            entries(seedFormulas).forEach(([recipeId, row]) => {
                addRecipe({
                    recipeId,
                    kind: t('kinds.seed', null, 'Seed collection'),
                    kindOrder: 71,
                    inputOrder: 81,
                    name: tableText(row.name, ''),
                    inputs: row.materialItemId ? [{ id: String(row.materialItemId), count: number(row.materialItemCount, 1) }] : [],
                    outputs: row.outcomeseedItemId ? [{ id: String(row.outcomeseedItemId), count: number(row.outcomeseedItemCount, 1) }] : [],
                    meta: row.level ? t('facilityLevel', { level: row.level }, 'Level ' + row.level) : ''
                });
            });

            entries(spaceshipFormulas).forEach(([recipeId, row]) => {
                addRecipe({
                    recipeId,
                    kind: t('kinds.spaceship', null, 'Spaceship'),
                    kindOrder: 72,
                    inputOrder: 82,
                    name: tableText(row.name, ''),
                    inputs: [],
                    outputs: row.outcomeItemId ? [{ id: String(row.outcomeItemId), count: 1 }] : [],
                    meta: row.level ? t('facilityLevel', { level: row.level }, 'Level ' + row.level) : '',
                    durationMs: number(row.totalProgress, 0)
                });
            });

            entries(miners).forEach(([buildingId, row]) => {
                const building = buildings?.[String(buildingId)] || {};
                list(row.mineable).forEach((mineable, index) => {
                    const outputId = mineable?.miningItemId;
                    if (!outputId) return;
                    const inputs = [];
                    const consumeId = mineable.consumeItem?.id;
                    const consumeCount = number(mineable.consumeItem?.count, 0);
                    if (consumeId && consumeCount > 0) inputs.push({ id: String(consumeId), count: consumeCount });
                    const separator = String(outputId).indexOf('_');
                    if (separator >= 0) inputs.push({
                        id: 'item_minepoint' + String(outputId).slice(separator),
                        count: 1
                    });
                    addRecipe({
                        recipeId: 'source:miner:' + buildingId + ':' + outputId + ':' + index,
                        kind: t('kinds.miner', null, 'Mining'),
                        kindOrder: 40,
                        inputOrder: 50,
                        name: t('sourceMining', null, 'Mining source'),
                        inputs,
                        outputs: [{ id: String(outputId), count: 1 }],
                        meta: tableText(building.name, buildingId),
                        durationMs: number(row.msPerRound, 0) / Math.max(0.001, number(mineable.produceRate, 1)),
                        facilityId: buildingId,
                        facilityName: tableText(building.name, buildingId),
                        facilityIconId: building.iconOnPanel || '',
                        sortId1: itemTable[outputId]?.sortId1,
                        sortId2: itemTable[outputId]?.sortId2
                    });
                });
            });

            entries(gasMiners).forEach(([buildingId, row]) => {
                const building = buildings?.[String(buildingId)] || {};
                list(row.mineable).forEach((mineable, index) => {
                    const outputId = mineable?.miningItemId;
                    if (!outputId) return;
                    const marker = String(outputId).indexOf('gas');
                    if (marker < 0) return;
                    addRecipe({
                        recipeId: 'source:gas:' + buildingId + ':' + outputId + ':' + index,
                        kind: t('kinds.gasMiner', null, 'Gas collection'),
                        kindOrder: 50,
                        inputOrder: 51,
                        name: t('sourceGas', null, 'Gas source'),
                        inputs: [{ id: 'item_gaspoint' + String(outputId).slice(marker + 3), count: 1 }],
                        outputs: [{ id: String(outputId), count: 1 }],
                        meta: tableText(building.name, buildingId),
                        durationMs: number(row.msPerRound, 0),
                        facilityId: buildingId,
                        facilityName: tableText(building.name, buildingId),
                        facilityIconId: building.iconOnPanel || '',
                        sortId1: itemTable[outputId]?.sortId1,
                        sortId2: itemTable[outputId]?.sortId2
                    });
                });
            });

            entries(fluidPumps).forEach(([buildingId, row]) => {
                const building = buildings?.[String(buildingId)] || {};
                list(row.enableLiquidIds).forEach((outputId, index) => {
                    const liquidId = String(outputId || '');
                    const marker = liquidId.indexOf('liquid');
                    if (marker < 0) return;
                    const pointId = 'item_liquidpoint' + liquidId.slice(marker + 6);
                    if (!itemTable[pointId]) return;
                    addRecipe({
                        recipeId: 'source:pump:' + buildingId + ':' + liquidId + ':' + index,
                        kind: t('kinds.pump', null, 'Liquid pump'),
                        kindOrder: 60,
                        inputOrder: 52,
                        name: t('sourceLiquid', null, 'Liquid source'),
                        inputs: [{ id: pointId, count: 1 }],
                        outputs: [{ id: liquidId, count: 1 }],
                        meta: tableText(building.name, buildingId),
                        durationMs: number(row.msPerRound, 0),
                        facilityId: buildingId,
                        facilityName: tableText(building.name, buildingId),
                        facilityIconId: building.iconOnPanel || '',
                        sortId1: itemTable[liquidId]?.sortId1,
                        sortId2: itemTable[liquidId]?.sortId2
                    });
                });
            });

            entries(fluidConsumeItems).forEach(([itemId, row]) => {
                list(row.buildingIds).forEach((buildingId, index) => {
                    const consume = fluidConsumes?.[String(buildingId)] || {};
                    const building = buildings?.[String(buildingId)] || {};
                    addRecipe({
                        recipeId: 'use:fluid:' + itemId + ':' + buildingId + ':' + index,
                        kind: t('kinds.fluid', null, 'Fluid use'),
                        kindOrder: 85,
                        inputOrder: 50,
                        name: t('fluidConsume', null, 'Fluid consumption'),
                        inputs: [{ id: String(itemId), count: 1 }],
                        outputs: [],
                        meta: tableText(building.name, buildingId),
                        durationMs: number(consume.msPerRound, 0),
                        destination: t('consumed', null, 'Consumed by facility'),
                        facilityId: buildingId,
                        facilityName: tableText(building.name, buildingId),
                        facilityIconId: building.iconOnPanel || ''
                    });
                });
            });

            entries(vaporizers).forEach(([buildingId, row]) => {
                const building = buildings?.[String(buildingId)] || {};
                list(row.groups).forEach((group, index) => {
                    if (!group?.consumeItem) return;
                    const environment = environmentInfo(group.genEnv, environments);
                    const meta = [
                        environment?.name,
                        t('consumeRate', { rate: group.consumeRate }, 'Rate ' + number(group.consumeRate, 0))
                    ].filter(Boolean).join(' / ');
                    addRecipe({
                        recipeId: 'use:vaporizer:' + buildingId + ':' + index,
                        kind: t('kinds.vaporizer', null, 'Environment use'),
                        kindOrder: 86,
                        inputOrder: 60,
                        name: t('vaporizerUse', null, 'Vaporizer'),
                        inputs: [{ id: String(group.consumeItem), count: number(group.consumeRate, 1) }],
                        outputs: [],
                        meta,
                        environment,
                        destination: tableText(building.name, buildingId),
                        facilityId: buildingId,
                        facilityName: tableText(building.name, buildingId),
                        facilityIconId: building.iconOnPanel || ''
                    });
                });
            });

            const powerStation = Object.values(powerStations || {})[0] || {};
            entries(fuelItems).forEach(([fuelId, row]) => {
                const progressRound = number(row.progressRound, 0);
                const powerProvide = number(row.powerProvide, 0);
                const durationMs = progressRound * number(powerStation.msPerRound, 0);
                addRecipe({
                    recipeId: 'fuel:' + fuelId,
                    kind: t('kinds.fuel', null, 'Fuel'),
                    kindOrder: 80,
                    inputOrder: 10,
                    name: t('fuelUse', null, 'Power station fuel'),
                    inputs: [{ id: String(fuelId), count: 1 }],
                    outputs: [],
                    meta: t('fuelMeta', {
                        energy: formatNumber(row.fuelEnergy),
                        power: formatNumber(powerProvide),
                        rounds: formatNumber(progressRound)
                    }, formatNumber(row.fuelEnergy) + ' energy / ' + formatNumber(powerProvide) + ' power / ' + formatNumber(progressRound) + ' rounds'),
                    durationMs,
                    destination: t('powerStation', null, 'Power station')
                });
            });

            recipes.sort((a, b) => a.kindOrder - b.kindOrder || a.sortId1 - b.sortId1 ||
                a.sortId2 - b.sortId2 || a.recipeId.localeCompare(b.recipeId, 'en'));
            defaultCraftTable = defaultCrafts || {};
            byOutput = new Map();
            byInput = new Map();
            recipes.forEach(recipe => {
                recipe.outputs.forEach(entry => {
                    if (!byOutput.has(entry.id)) byOutput.set(entry.id, []);
                    byOutput.get(entry.id).push(recipe);
                });
                recipe.inputs.forEach(entry => {
                    if (!byInput.has(entry.id)) byInput.set(entry.id, []);
                    if (!byInput.get(entry.id).includes(recipe)) byInput.get(entry.id).push(recipe);
                });
            });
        }

        function itemButton(id, label, subtitle) {
            const info = itemInfo(id);
            const title = showHidden() ? info.name + ' [' + id + ']' : info.name;
            return '<button class="ake-ui-tree__item" type="button" role="option" data-recipe-flow-item="' +
                escape(id) + '" title="' + escape(title) + '">' +
                '<span class="ake-ui-tree__item-title">' + escape(label || info.name) + '</span>' +
                '<span class="ake-ui-tree__item-subtitle">' + escape(subtitle || id) + '</span></button>';
        }

        function renderPickerResults() {
            const query = search.value.trim().toLocaleLowerCase();
            if (!query) {
                resultsRoot.hidden = true;
                resultsRoot.replaceChildren();
                return;
            }
            const matches = allItems.filter(item =>
                item.name.toLocaleLowerCase().includes(query) || item.id.toLocaleLowerCase().includes(query)
            ).slice(0, 80);
            resultsRoot.hidden = false;
            if (!matches.length) {
                resultsRoot.innerHTML = '<div class="ake-ui-state" data-density="compact"><p>' +
                    escape(t('noMatches', null, 'No matching items')) + '</p></div>';
                return;
            }
            resultsRoot.innerHTML = '<div class="ake-ui-tree__section-header"><span>' +
                escape(t('searchResults', null, 'Search results')) + '</span><span>' +
                escape(formatNumber(matches.length)) + '</span></div>' +
                matches.map(item => itemButton(item.id, item.name, showHidden() ? item.id : '')).join('');
        }

        function setStatus(message, state) {
            statusRoot.innerHTML = message
                ? '<span class="ake-ui-badge"' + (state ? ' data-state="' + escape(state) + '"' : '') + '>' +
                    escape(message) + '</span>'
                : '';
        }

        function emptyState(message) {
            return '<div class="ake-ui-state" data-density="compact"><p>' + escape(message) + '</p></div>';
        }

        function renderSelected() {
            const info = itemInfo(selectedId);
            const title = showHidden() ? info.name + ' [' + selectedId + ']' : info.name;
            selectedRoot.innerHTML =
                '<div class="ake-ui-card" data-card-kind="recipe-flow-item">' +
                    '<header class="ake-ui-card__header">' +
                        itemIcon(selectedId, 'ake-ui-section__icon') +
                        '<div class="ake-ui-card__heading"><h3 class="ake-ui-card__title">' +
                            escape(info.name) + '</h3><small class="ake-ui-card__id">' +
                            escape(title) + '</small></div>' +
                    '</header>' +
                    '<div class="ake-ui-card__body"><span class="ake-ui-badge">' +
                        escape(t('selected', null, 'Selected')) + '</span></div></div>';
        }

        function recipeFormula(recipe) {
            return '<div class="ake-ui-card__header" data-layout="split">' +
                '<div class="ake-ui-card__header-start"><div class="ake-ui-card__heading"><div class="ake-ui-card__subtitle">' +
                escape(t('inputs', null, 'Inputs')) + '</div>' + materialList(recipe.inputs, 'noMaterials') +
                '</div></div><div class="ake-ui-card__header-end"><span class="ake-ui-badge" aria-hidden="true">' +
                '&rarr;</span><div class="ake-ui-card__heading"><div class="ake-ui-card__subtitle">' +
                escape(t('outputs', null, 'Outputs')) + '</div>' + materialList(recipe.outputs, 'noOutputs') +
                '</div></div></div>';
        }

        function recipeExtra(recipe) {
            let html = '';
            if (recipe.meta) html += '<div class="ake-ui-card__meta"><span class="ake-ui-badge">' +
                escape(recipe.meta) + '</span></div>';
            if (recipe.destination) html += '<div><strong>' + escape(t('destination', null, 'Destination')) +
                '</strong> ' + escape(recipe.destination) + '</div>';
            return html;
        }

        function facilityIcon(recipe) {
            if (!recipe?.facilityIconId) return '';
            return '<img class="recipe-flow-machine__icon-image" src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/factory/buildingpanelicon/' +
                escape(recipe.facilityIconId) + '.png" alt="" loading="lazy" decoding="async">';
        }

        function recipeFacilityLabel(recipe) {
            return recipe?.facilityName || recipe?.destination || recipe?.kind ||
                t('unnamedRecipe', null, 'Unnamed recipe');
        }

        function recipeSort(a, b) {
            return a.kindOrder - b.kindOrder || a.sortId1 - b.sortId1 ||
                a.sortId2 - b.sortId2 || a.recipeId.localeCompare(b.recipeId, 'en');
        }

        function producerList(itemId) {
            const producers = (byOutput.get(itemId) || []).slice().sort(recipeSort);
            const preferredId = String(defaultCraftTable[itemId] || '');
            let preferredIndex = preferredId ? producers.findIndex(recipe => recipe.recipeId === preferredId) : -1;
            if (preferredIndex < 0) {
                preferredIndex = producers.findIndex(recipe => recipe.kindOrder !== 30);
            }
            if (preferredIndex > 0) {
                const preferred = producers.splice(preferredIndex, 1)[0];
                producers.unshift(preferred);
            }
            return producers;
        }

        function consumerSort(a, b) {
            return a.inputOrder - b.inputOrder || a.sortId1 - b.sortId1 ||
                a.sortId2 - b.sortId2 || a.recipeId.localeCompare(b.recipeId, 'en');
        }

        function consumerList(itemId) {
            return (byInput.get(itemId) || []).slice().sort(consumerSort);
        }

        function downstreamList(itemId) {
            const consumers = consumerList(itemId);
            const equipmentRecipes = consumers.filter(recipe => recipe.isEquipment);
            const visible = consumers.filter(recipe => !recipe.isEquipment);
            if (equipmentRecipes.length) {
                visible.push({
                    recipeId: 'summary:equipment:' + itemId,
                    kind: t('kinds.equipment', null, actionText('装备制造', 'Equipment manufacturing')),
                    name: t('kinds.equipment', null, actionText('装备制造', 'Equipment manufacturing')),
                    inputs: [],
                    outputs: [],
                    meta: '',
                    summaryText: actionText(
                        '已合并 ' + equipmentRecipes.length + ' 个装备配方',
                        equipmentRecipes.length + ' equipment recipes combined'
                    ),
                    isEquipment: true,
                    isSummary: true,
                    kindOrder: 40,
                    inputOrder: 70,
                    sortId1: 999999,
                    sortId2: 999999,
                    durationMs: 0,
                    destination: '',
                    facilityId: '',
                    facilityName: '',
                    facilityIconId: ''
                });
            }
            return visible.sort(consumerSort);
        }

        function graphItemMarkup(itemId, options) {
            const info = itemInfo(itemId);
            const title = showHidden() ? info.name + ' [' + itemId + ']' : info.name;
            const icon = itemIcon(itemId, 'recipe-flow-node__icon-image');
            const stateClasses = [
                options.isTarget ? 'is-target' : '',
                options.isSource ? 'is-source' : '',
                options.isRepeated ? 'is-repeated' : '',
                options.isDownstream ? 'is-downstream' : ''
            ].filter(Boolean).join(' ');
            const subtitle = options.reason || (isDirectSource(itemId)
                ? t('directSource', null, 'Directly obtainable') : '');
            let html = '<div class="recipe-flow-graph-node recipe-flow-graph-node--item ' +
                stateClasses + '"><button class="recipe-flow-node" type="button" data-recipe-flow-item="' +
                escape(itemId) + '" title="' + escape(title) + '" aria-label="' + escape(title) + '">' +
                '<span class="recipe-flow-node__icon">' +
                (icon || '<span class="recipe-flow-node__icon-placeholder" aria-hidden="true"></span>') +
                '</span><strong>' + escape(info.name) + '</strong>' +
                (subtitle ? '<small>' + escape(subtitle) + '</small>' : '') + '</button>';
            if (options.showCraftToggle) {
                const label = options.craftExpanded
                    ? t('collapse', null, 'Collapse')
                    : t('otherRecipes', null, 'Other recipes');
                html += '<button class="recipe-flow-toggle recipe-flow-toggle--craft" type="button" ' +
                    'data-recipe-flow-craft-toggle="' + escape(options.craftKey) + '" aria-expanded="' +
                    (options.craftExpanded ? 'true' : 'false') + '"><span class="recipe-flow-toggle__label">' +
                    escape(label) + '</span><span class="recipe-flow-toggle__count">' +
                    escape(formatNumber(options.producerCount - 1)) + '</span></button>';
            }
            if (options.showRepeatToggle) {
                const label = options.repeatExpanded
                    ? t('collapse', null, 'Collapse')
                    : t('expand', null, 'Expand');
                html += '<button class="recipe-flow-toggle recipe-flow-toggle--repeat" type="button" ' +
                    'data-recipe-flow-repeat-toggle="' + escape(options.craftKey) + '" aria-expanded="' +
                    (options.repeatExpanded ? 'true' : 'false') + '"><span class="recipe-flow-toggle__label">' +
                    escape(label) + '</span></button>';
            }
            return html + '</div>';
        }

        function recipeQuantityLabel(entriesToRender, direction) {
            if (!entriesToRender.length) return '';
            const title = entriesToRender.map(entry => itemInfo(entry.id).name + ' x' + formatNumber(entry.count)).join(', ');
            const label = entriesToRender.map(entry => 'x' + formatNumber(entry.count)).join(' / ');
            const position = direction === 'input'
                ? 'left:4px;'
                : 'right:4px;';
            return '<span class="ake-ui-badge" data-density="compact" title="' +
                escape(title) + '" style="position:absolute;top:50%;' + position +
                'max-width:48px;overflow:hidden;transform:translateY(-50%);white-space:nowrap;font-size:.56rem;padding:1px 3px">' +
                escape(label) + '</span>';
        }

        function recipeEnvironmentMarkup(environment) {
            if (!environment?.name) return '';
            const color = /^#[0-9a-f]{6}$/i.test(environment.color) ? environment.color : '#ffffff';
            return ' · <span class="recipe-flow-environment" data-recipe-flow-environment-color="' +
                escape(color) + '" style="color:' + escape(color) + '">' + escape(environment.name) + '</span>';
        }

        function graphRecipeMarkup(recipe, isAlternative, isDownstream) {
            const stateClass = [
                isAlternative ? 'is-alternative' : 'is-primary',
                isDownstream ? 'is-downstream' : ''
            ].filter(Boolean).join(' ');
            const detail = recipe.summaryText || formatDuration(recipe.durationMs);
            return '<div class="recipe-flow-graph-node recipe-flow-graph-node--recipe ' + stateClass + '" style="width:' +
                GRAPH_LAYOUT.recipeWidth + 'px;height:' + GRAPH_LAYOUT.recipeHeight + 'px">' +
                '<div class="recipe-flow-machine" style="position:relative;width:100%;padding-left:58px;padding-right:58px" title="' + escape(recipeFacilityLabel(recipe)) + '">' +
                recipeQuantityLabel(recipe.inputs, 'input') + recipeQuantityLabel(recipe.outputs, 'output') +
                '<span class="recipe-flow-machine__icon">' +
                (facilityIcon(recipe) || '<span class="recipe-flow-machine__icon-placeholder" aria-hidden="true"></span>') +
                '</span><span class="recipe-flow-machine__copy"><strong>' +
                escape(recipeFacilityLabel(recipe)) + '</strong><small>' + escape(detail) +
                recipeEnvironmentMarkup(recipe.environment) +
                '</small></span></div></div>';
        }

        function graphPath(from, to) {
            const direction = to.left < from.left ? 'left' : 'right';
            const startX = direction === 'left' ? from.anchorLeft : from.anchorRight;
            const endX = direction === 'left' ? to.anchorRight : to.anchorLeft;
            const middleX = (startX + endX) / 2;
            if (Math.abs(from.anchorY - to.anchorY) < 1) {
                return 'M ' + startX + ' ' + from.anchorY + ' H ' + endX;
            }
            return 'M ' + startX + ' ' + from.anchorY + ' H ' + middleX + ' V ' + to.anchorY + ' H ' + endX;
        }

        function renderProductionGraph() {
            const graph = { nodes: [], nodeMap: new Map(), lines: [], seenItemIds: new Set() };
            let nodeSeed = 0;

            function addNode(node) {
                node.key = node.key || 'node-' + (++nodeSeed);
                graph.nodes.push(node);
                graph.nodeMap.set(node.key, node);
                return node;
            }

            function addItemNode(itemId, left, centerRow, options) {
                const toggleCount = (options.showCraftToggle ? 1 : 0) + (options.showRepeatToggle ? 1 : 0);
                const height = GRAPH_LAYOUT.itemButtonHeight + (toggleCount ? 7 : 0) + toggleCount * 30;
                const centerY = centerRow * GRAPH_LAYOUT.rowStep;
                const buttonLeft = left + (GRAPH_LAYOUT.itemColumnWidth - GRAPH_LAYOUT.itemButtonWidth) / 2;
                return addNode({
                    key: 'item:' + options.craftKey,
                    type: 'item',
                    left,
                    top: centerY - GRAPH_LAYOUT.itemButtonHeight / 2,
                    width: GRAPH_LAYOUT.itemColumnWidth,
                    height,
                    anchorLeft: buttonLeft,
                    anchorRight: buttonLeft + GRAPH_LAYOUT.itemButtonWidth,
                    anchorY: centerY,
                    itemId,
                    html: graphItemMarkup(itemId, options)
                });
            }

            function addRecipeNode(recipe, left, centerRow, options) {
                const centerY = centerRow * GRAPH_LAYOUT.rowStep;
                return addNode({
                    key: options.key,
                    type: 'recipe',
                    left,
                    top: centerY - GRAPH_LAYOUT.recipeHeight / 2,
                    width: GRAPH_LAYOUT.recipeWidth,
                    height: GRAPH_LAYOUT.recipeHeight,
                    anchorLeft: left,
                    anchorRight: left + GRAPH_LAYOUT.recipeWidth,
                    anchorY: centerY,
                    html: graphRecipeMarkup(recipe, options.isAlternative, options.isDownstream)
                });
            }

            function addLine(from, to, lineType) {
                if (from && to) graph.lines.push({ from, to, lineType });
            }

            function layoutUpstreamItem(itemId, left, startRow, path, craftKey, depth) {
                const producers = producerList(itemId);
                const cycle = path.includes(itemId);
                const depthLimited = depth > GRAPH_LAYOUT.maxDepth;
                const repeated = graph.seenItemIds.has(itemId);
                graph.seenItemIds.add(itemId);
                const repeatExpanded = expandedRepeatedKeys.has(craftKey);
                const canExpand = producers.length > 0 && !cycle && !depthLimited && (!repeated || repeatExpanded);
                if (!canExpand) {
                    const reason = cycle ? t('cycle', null, 'Cycle detected') :
                        depthLimited ? t('depthLimit', null, 'Depth limit reached') :
                        repeated ? t('repeatNode', null, 'Repeated item') : '';
                    const node = addItemNode(itemId, left, startRow + .5, {
                        craftKey,
                        isTarget: itemId === selectedId,
                        isSource: isDirectSource(itemId),
                        isRepeated: repeated,
                        reason,
                        showCraftToggle: false,
                        showRepeatToggle: repeated && producers.length > 0 && !cycle && !depthLimited,
                        repeatExpanded
                    });
                    return { top: startRow, bottom: startRow + 1, row: startRow + .5, node };
                }

                const selectedProducers = expandedCraftKeys.has(craftKey) ? producers : producers.slice(0, 1);
                const recipeLeft = left - GRAPH_LAYOUT.recipeWidth - GRAPH_LAYOUT.columnGap;
                const childLeft = recipeLeft - GRAPH_LAYOUT.itemColumnWidth - GRAPH_LAYOUT.columnGap;
                const branches = [];
                let cursor = startRow;
                selectedProducers.forEach((recipe, producerIndex) => {
                    const branchStart = cursor;
                    const inputs = [];
                    recipe.inputs.forEach((input, inputIndex) => {
                        const childKey = craftKey + '/' + recipe.recipeId + '/' + inputIndex;
                        const child = layoutUpstreamItem(input.id, childLeft, cursor,
                            path.concat(itemId), childKey, depth + 1);
                        inputs.push(child);
                        cursor = child.bottom;
                    });
                    const branchBottom = Math.max(cursor, branchStart + 1);
                    branches.push({ recipe, producerIndex, branchStart, branchBottom, inputs });
                    cursor = branchBottom;
                });

                const itemRow = startRow + .5;
                const node = addItemNode(itemId, left, itemRow, {
                    craftKey,
                    producerCount: producers.length,
                    craftExpanded: expandedCraftKeys.has(craftKey),
                    isTarget: itemId === selectedId,
                    isSource: isDirectSource(itemId),
                    isRepeated: repeated,
                    repeatExpanded,
                    showCraftToggle: producers.length > 1,
                    showRepeatToggle: repeated && !cycle && !depthLimited,
                    reason: ''
                });
                branches.forEach(branch => {
                    const recipeRow = (branch.branchStart + branch.branchBottom) / 2;
                    const recipeKey = craftKey + ':recipe:' + branch.recipe.recipeId + ':' + branch.producerIndex;
                    const recipeNode = addRecipeNode(branch.recipe, recipeLeft, recipeRow, {
                        key: recipeKey,
                        isAlternative: branch.producerIndex > 0,
                        isDownstream: false
                    });
                    const lineType = branch.producerIndex === 0 ? 'solid' : 'translucent';
                    addLine(recipeNode, node, lineType);
                    branch.inputs.forEach(input => addLine(input.node, recipeNode, lineType));
                });
                return { top: startRow, bottom: cursor, row: itemRow, node };
            }

            function layoutDownstreamItem(itemId, rootResult) {
                const consumers = downstreamList(itemId);
                if (!consumers.length) return;
                const totalRows = consumers.reduce((sum, recipe) => sum + Math.max(1, recipe.outputs.length), 0);
                let cursor = rootResult.row - totalRows / 2;
                const recipeLeft = rootResult.node.left + GRAPH_LAYOUT.itemColumnWidth + GRAPH_LAYOUT.columnGap;
                const outputLeft = recipeLeft + GRAPH_LAYOUT.recipeWidth + GRAPH_LAYOUT.columnGap;
                consumers.forEach(recipe => {
                    const groupStart = cursor;
                    const groupBottom = groupStart + Math.max(1, recipe.outputs.length);
                    const recipeRow = (groupStart + groupBottom) / 2;
                    const recipeKey = 'downstream:' + recipe.recipeId + ':' + groupStart;
                    const recipeNode = addRecipeNode(recipe, recipeLeft, recipeRow, {
                        key: recipeKey,
                        isAlternative: false,
                        isDownstream: true
                    });
                    addLine(rootResult.node, recipeNode, 'dotted');
                    recipe.outputs.forEach((output, outputIndex) => {
                        const outputKey = recipeKey + ':output:' + outputIndex;
                        const outputNode = addItemNode(output.id, outputLeft, groupStart + outputIndex + .5, {
                            craftKey: outputKey,
                            isDownstream: true,
                            showCraftToggle: false,
                            showRepeatToggle: false,
                            reason: ''
                        });
                        addLine(recipeNode, outputNode, 'dotted');
                    });
                    cursor = groupBottom;
                });
            }

            if (!itemTable[selectedId] && !byOutput.has(selectedId)) {
                return emptyState(t('unknownItem', null, 'Unknown item'));
            }
            const rootResult = layoutUpstreamItem(selectedId, 0, 0, [], 'original', 0);
            layoutDownstreamItem(selectedId, rootResult);

            const minX = Math.min(...graph.nodes.map(node => node.left));
            const maxX = Math.max(...graph.nodes.map(node => node.left + node.width));
            const minY = Math.min(...graph.nodes.map(node => node.top));
            const maxY = Math.max(...graph.nodes.map(node => node.top + node.height));
            const offsetX = GRAPH_LAYOUT.padding - minX;
            const offsetY = GRAPH_LAYOUT.padding - minY;
            const width = Math.ceil(maxX - minX + GRAPH_LAYOUT.padding * 2);
            const height = Math.ceil(maxY - minY + GRAPH_LAYOUT.padding * 2);
            const scaledWidth = Math.ceil(width * graphZoom);
            const scaledHeight = Math.ceil(height * graphZoom);
            const lineMarkup = graph.lines.map(line => {
                const from = { ...line.from, left: line.from.left + offsetX, anchorLeft: line.from.anchorLeft + offsetX,
                    anchorRight: line.from.anchorRight + offsetX, anchorY: line.from.anchorY + offsetY };
                const to = { ...line.to, left: line.to.left + offsetX, anchorLeft: line.to.anchorLeft + offsetX,
                    anchorRight: line.to.anchorRight + offsetX, anchorY: line.to.anchorY + offsetY };
                return '<path class="recipe-flow-line recipe-flow-line--' + line.lineType + '" d="' +
                    graphPath(from, to) + '" marker-end="url(#recipe-flow-arrow)"/>';
            }).join('');
            const nodeMarkup = graph.nodes.map(node =>
                '<div class="recipe-flow-graph-node-position" style="left:' + (node.left + offsetX) + 'px;top:' +
                (node.top + offsetY) + 'px;width:' + node.width + 'px;height:' + node.height + 'px">' +
                node.html + '</div>'
            ).join('');
            return '<div class="recipe-flow-canvas" data-recipe-flow-canvas tabindex="0" style="height:' +
                GRAPH_VIEWPORT_HEIGHT + 'px;max-height:' + GRAPH_VIEWPORT_HEIGHT + 'px" aria-label="' +
                escape(t('upstream', null, 'Upstream production')) + '" data-recipe-flow-zoom="' + graphZoom +
                '" data-recipe-flow-base-width="' + width + '" data-recipe-flow-base-height="' + height +
                '"><div class="recipe-flow-track" style="min-width:0;width:' + scaledWidth + 'px;height:' +
                scaledHeight + 'px"><div class="recipe-flow-graph" style="width:' + width + 'px;height:' +
                height + 'px;transform:scale(' + graphZoom + ');transform-origin:0 0">' +
                '<svg class="recipe-flow-lines" width="' + width + '" height="' + height + '" viewBox="0 0 ' +
                width + ' ' + height + '" aria-hidden="true"><defs><marker id="recipe-flow-arrow" markerWidth="8" markerHeight="8" ' +
                'refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"></path></marker></defs>' +
                lineMarkup + '</svg><div class="recipe-flow-nodes">' + nodeMarkup + '</div></div></div></div>';
        }

        function renderUpstreamSection() {
            const producerCount = (byOutput.get(selectedId) || []).length;
            upstreamCountRoot.textContent = producerCount
                ? t('recipeCount', { count: producerCount }, producerCount + ' recipes')
                : '';
            return renderProductionGraph();
        }

        function renderConsumerRecipe(recipe) {
            const card = '<div class="ake-ui-card" data-card-kind="recipe-flow" data-density="regular">';
            const title = recipe.name || t('unnamedRecipe', null, 'Unnamed recipe');
            const id = showHidden() ? '<small class="ake-ui-card__id">' + escape(recipe.recipeId) + '</small>' : '';
            if (recipe.isSummary) {
                return card + '<header class="ake-ui-card__header"><span class="ake-ui-badge">' +
                    escape(recipe.kind) + '</span><span class="ake-ui-card__heading"><span class="ake-ui-card__title">' +
                    escape(title) + '</span>' + id + '</span></header><div class="ake-ui-card__body"><span class="ake-ui-muted">' +
                    escape(recipe.summaryText) + '</span></div></div>';
            }
            let html = card + '<header class="ake-ui-card__header"><span class="ake-ui-badge">' +
                escape(recipe.kind) + '</span><span class="ake-ui-card__heading"><span class="ake-ui-card__title">' +
                escape(title) + '</span>' + id + '</span><span class="ake-ui-card__header-end"><small>' +
                escape(formatDuration(recipe.durationMs)) + '</small></span></header><div class="ake-ui-card__body">' +
                recipeFormula(recipe) + recipeExtra(recipe);
            return html + '</div></div>';
        }

        function renderDownstreamSection() {
            const consumers = consumerList(selectedId);
            downstreamCountRoot.textContent = consumers.length
                ? t('recipeCount', { count: consumers.length }, consumers.length + ' recipes') : '';
            if (!consumers.length) return emptyState(t('noUses', null, 'No immediate uses'));
            return '<div class="ake-ui-card-grid" data-size="full">' +
                downstreamList(selectedId).map(renderConsumerRecipe).join('') + '</div>';
        }

        function safeFilename(value) {
            const cleaned = String(value || '')
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
                .replace(/[. ]+$/g, '')
                .trim()
                .slice(0, 96);
            return cleaned || 'AKEData-recipe-flow';
        }

        function currentGraphCanvas() {
            return upstreamRoot.querySelector('[data-recipe-flow-canvas]');
        }

        function updateFullscreenState() {
            const canvas = currentGraphCanvas();
            const active = canvas && document.fullscreenElement === canvas;
            if (canvas) {
                const height = active ? '100vh' : GRAPH_VIEWPORT_HEIGHT + 'px';
                canvas.style.height = height;
                canvas.style.maxHeight = height;
                canvas.style.width = active ? '100vw' : '';
                canvas.style.maxWidth = active ? '100vw' : '';
            }
            if (fullscreenButton) {
                const label = active
                    ? actionText('退出全屏', 'Exit full screen')
                    : actionText('全屏显示', 'Full screen');
                fullscreenButton.title = label;
                fullscreenButton.setAttribute('aria-label', label);
                fullscreenButton.innerHTML = '<span aria-hidden="true">' + (active ? '&#x2715;' : '&#x26F6;') + '</span>';
            }
            if (exportButton) {
                const label = actionText('导出 PNG', 'Export PNG');
                exportButton.title = label;
                exportButton.setAttribute('aria-label', label);
            }
        }

        function waitForGraphImages(graph) {
            const images = Array.from(graph.querySelectorAll('img'));
            return Promise.all(images.map(image => new Promise(resolve => {
                image.loading = 'eager';
                image.decoding = 'sync';
                if (image.complete) {
                    resolve();
                    return;
                }
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
                window.setTimeout(resolve, 8000);
            })));
        }

        const EXPORT_COLORS = Object.freeze({
            background: '#f3f5f7',
            surface: '#ffffff',
            muted: '#eef1f4',
            border: '#cfd6de',
            text: '#1f2a36',
            description: '#657384',
            machine: '#3f4a56',
            machineBorder: '#677482',
            accent: '#c08720',
            accentText: '#8a5a00',
            accentBackground: '#fff4d8',
            line: '#7b8794'
        });

        function setExportStyles(element, styles) {
            Object.entries(styles).forEach(([property, value]) => {
                element.style.setProperty(property, value);
            });
        }

        function isUnsafeExportStyle(property, value) {
            const propertyName = String(property || '').toLocaleLowerCase();
            if (propertyName === 'color' || propertyName.includes('color')) return true;
            if (['background', 'border', 'outline', 'box-shadow', 'text-shadow', 'fill', 'stroke'].includes(propertyName)) {
                return true;
            }
            return /(?:color\(|color-mix\(|lab\(|lch\(|oklab\(|oklch\()/i.test(String(value || ''));
        }

        function copyExportLayoutStyles(sourceGraph, graph) {
            const sourceElements = [sourceGraph].concat(Array.from(sourceGraph.querySelectorAll('*')));
            const targetElements = [graph].concat(Array.from(graph.querySelectorAll('*')));
            sourceElements.forEach((sourceElement, index) => {
                const targetElement = targetElements[index];
                if (!targetElement) return;
                const computed = window.getComputedStyle(sourceElement);
                for (let styleIndex = 0; styleIndex < computed.length; styleIndex++) {
                    const property = computed.item(styleIndex);
                    const value = computed.getPropertyValue(property);
                    if (!value || isUnsafeExportStyle(property, value)) continue;
                    targetElement.style.setProperty(property, value);
                }
            });
        }

        function applyExportColorSnapshot(graph) {
            setExportStyles(graph, {
                color: EXPORT_COLORS.text,
                backgroundColor: EXPORT_COLORS.background,
                borderColor: 'transparent',
                boxShadow: 'none'
            });
            graph.querySelectorAll('*').forEach(element => {
                setExportStyles(element, {
                    color: EXPORT_COLORS.text,
                    backgroundColor: 'transparent',
                    borderColor: EXPORT_COLORS.border,
                    boxShadow: 'none',
                    outlineColor: EXPORT_COLORS.border,
                    textShadow: 'none'
                });
            });

            graph.querySelectorAll('.recipe-flow-node').forEach(element => {
                const target = element.closest('.recipe-flow-graph-node--item.is-target');
                setExportStyles(element, {
                    color: EXPORT_COLORS.text,
                    backgroundColor: EXPORT_COLORS.surface,
                    borderColor: target ? EXPORT_COLORS.accent : EXPORT_COLORS.border,
                    boxShadow: target
                        ? 'inset 0 0 0 1px ' + EXPORT_COLORS.accent + ', 0 2px 8px rgba(0, 0, 0, .14)'
                        : 'none'
                });
            });
            graph.querySelectorAll('.recipe-flow-node__icon').forEach(element => {
                setExportStyles(element, {
                    backgroundColor: EXPORT_COLORS.muted,
                    borderColor: EXPORT_COLORS.border
                });
            });
            graph.querySelectorAll('.recipe-flow-node small').forEach(element => {
                element.style.setProperty('color', EXPORT_COLORS.description);
            });
            graph.querySelectorAll('.recipe-flow-node__icon-placeholder').forEach(element => {
                element.style.setProperty('border-color', EXPORT_COLORS.description);
            });
            graph.querySelectorAll('.recipe-flow-machine').forEach(element => {
                setExportStyles(element, {
                    color: EXPORT_COLORS.surface,
                    background: EXPORT_COLORS.machine,
                    backgroundColor: EXPORT_COLORS.machine,
                    border: '2px solid ' + EXPORT_COLORS.machineBorder,
                    borderColor: EXPORT_COLORS.machineBorder,
                    boxShadow: '0 2px 5px rgba(0, 0, 0, .12)'
                });
            });
            graph.querySelectorAll('.recipe-flow-machine__copy small').forEach(element => {
                element.style.setProperty('color', 'rgba(255, 255, 255, .7)');
            });
            graph.querySelectorAll('.recipe-flow-machine__icon-placeholder').forEach(element => {
                element.style.setProperty('border-color', EXPORT_COLORS.surface);
            });
            graph.querySelectorAll('.recipe-flow-environment').forEach(element => {
                const color = element.dataset.recipeFlowEnvironmentColor;
                if (/^#[0-9a-f]{6}$/i.test(color)) element.style.setProperty('color', color);
            });
            graph.querySelectorAll('.ake-ui-badge').forEach(element => {
                setExportStyles(element, {
                    color: EXPORT_COLORS.description,
                    backgroundColor: 'transparent',
                    borderColor: EXPORT_COLORS.border
                });
            });
            graph.querySelectorAll('.recipe-flow-toggle').forEach(element => {
                setExportStyles(element, {
                    color: EXPORT_COLORS.accentText,
                    backgroundColor: EXPORT_COLORS.accentBackground,
                    borderColor: EXPORT_COLORS.accent,
                    boxShadow: 'none'
                });
            });
            graph.querySelectorAll('.recipe-flow-line').forEach(element => {
                element.style.setProperty('stroke', EXPORT_COLORS.line);
            });
            graph.querySelectorAll('.recipe-flow-line--translucent').forEach(element => {
                element.style.setProperty('stroke', EXPORT_COLORS.description);
            });
            graph.querySelectorAll('.recipe-flow-line--dotted').forEach(element => {
                element.style.setProperty('stroke', EXPORT_COLORS.description);
            });
            graph.querySelectorAll('.recipe-flow-lines marker path').forEach(element => {
                element.style.setProperty('fill', EXPORT_COLORS.line);
            });
        }

        async function exportGraphPng() {
            if (!exportButton || exportButton.disabled || context.signal.aborted) return;
            const sourceCanvas = currentGraphCanvas();
            const sourceGraph = sourceCanvas?.querySelector('.recipe-flow-graph');
            if (!sourceCanvas || !sourceGraph) {
                setStatus(actionText('没有可导出的配方链', 'No recipe flow to export'), 'error');
                return;
            }
            if (typeof window.html2canvas !== 'function') {
                setStatus(actionText('PNG 导出组件未加载', 'PNG export library is unavailable'), 'error');
                return;
            }

            const width = number(sourceCanvas.dataset.recipeFlowBaseWidth, 0);
            const height = number(sourceCanvas.dataset.recipeFlowBaseHeight, 0);
            if (!width || !height) return;
            exportButton.disabled = true;
            exportButton.setAttribute('aria-busy', 'true');
            setStatus(actionText('正在导出 PNG...', 'Exporting PNG...'), '');
            const host = document.createElement('div');
            host.dataset.miscModule = MODULE_ID;
            host.style.position = 'absolute';
            host.style.left = '-100000px';
            host.style.top = '0';
            host.style.width = width + 'px';
            host.style.height = height + 'px';
            host.style.overflow = 'visible';
            host.style.background = EXPORT_COLORS.background;
            const graph = sourceGraph.cloneNode(true);
            graph.style.width = width + 'px';
            graph.style.height = height + 'px';
            graph.dataset.recipeFlowExport = 'true';
            copyExportLayoutStyles(sourceGraph, graph);
            graph.style.transform = 'none';
            graph.style.transformOrigin = '0 0';
            applyExportColorSnapshot(graph);
            host.appendChild(graph);
            document.body.appendChild(host);
            try {
                await waitForGraphImages(graph);
                const area = width * height;
                const rendered = await window.html2canvas(graph, {
                    scale: area > 12000000 ? 1 : 2,
                    width,
                    height,
                    useCORS: true,
                    allowTaint: false,
                    logging: false,
                    backgroundColor: EXPORT_COLORS.background,
                    scrollX: 0,
                    scrollY: 0,
                    onclone: clonedDocument => {
                        clonedDocument.querySelectorAll('link[rel="stylesheet"], style').forEach(styleNode => {
                            styleNode.remove();
                        });
                    }
                });
                const blob = await new Promise((resolve, reject) => {
                    rendered.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png');
                });
                if (context.signal.aborted) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = safeFilename(itemInfo(selectedId).name + '-recipe-flow') + '.png';
                link.href = url;
                link.rel = 'noopener';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                link.remove();
                context.setTimeout(() => URL.revokeObjectURL(url), 30000);
                setStatus(actionText('PNG 导出完成', 'PNG exported'), '');
            } catch (error) {
                if (!context.signal.aborted) {
                    setStatus(actionText('PNG 导出失败：' + error.message, 'PNG export failed: ' + error.message), 'error');
                }
            } finally {
                host.remove();
                exportButton.disabled = false;
                exportButton.removeAttribute('aria-busy');
            }
        }

        function setGraphZoom(canvas, nextZoom, clientX, clientY) {
            const currentZoom = number(canvas.dataset.recipeFlowZoom, graphZoom);
            const zoom = Math.min(GRAPH_ZOOM.max, Math.max(GRAPH_ZOOM.min, nextZoom));
            if (Math.abs(zoom - currentZoom) < .001) return;
            const track = canvas.querySelector('.recipe-flow-track');
            const graph = canvas.querySelector('.recipe-flow-graph');
            if (!track || !graph) return;

            const rect = canvas.getBoundingClientRect();
            const styles = window.getComputedStyle(canvas);
            const paddingLeft = parseFloat(styles.paddingLeft) || 0;
            const paddingTop = parseFloat(styles.paddingTop) || 0;
            const focusX = Math.max(0, clientX - rect.left - canvas.clientLeft - paddingLeft);
            const focusY = Math.max(0, clientY - rect.top - canvas.clientTop - paddingTop);
            const contentX = (canvas.scrollLeft + focusX) / currentZoom;
            const contentY = (canvas.scrollTop + focusY) / currentZoom;
            const baseWidth = number(canvas.dataset.recipeFlowBaseWidth, 0);
            const baseHeight = number(canvas.dataset.recipeFlowBaseHeight, 0);
            graphZoom = Number(zoom.toFixed(2));
            canvas.dataset.recipeFlowZoom = graphZoom;
            track.style.width = Math.ceil(baseWidth * graphZoom) + 'px';
            track.style.height = Math.ceil(baseHeight * graphZoom) + 'px';
            graph.style.transform = 'scale(' + graphZoom + ')';
            canvas.scrollLeft = Math.max(0, contentX * graphZoom - focusX);
            canvas.scrollTop = Math.max(0, contentY * graphZoom - focusY);
        }

        function bindFlowStripDrag() {
            let drag = null;

            context.on(root, 'wheel', event => {
                const canvas = event.target.closest('[data-recipe-flow-canvas]');
                if (!canvas || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
                event.preventDefault();
                const currentZoom = number(canvas.dataset.recipeFlowZoom, graphZoom);
                const direction = event.deltaY < 0 ? 1 : -1;
                setGraphZoom(canvas, currentZoom + direction * GRAPH_ZOOM.step, event.clientX, event.clientY);
            }, true);

            context.on(root, 'pointerdown', event => {
                const canvas = event.target.closest('[data-recipe-flow-canvas]');
                if (!canvas || event.button !== 0 || event.target.closest('button')) return;
                drag = {
                    canvas,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    startScrollLeft: canvas.scrollLeft,
                    startScrollTop: canvas.scrollTop,
                    moved: false
                };
                canvas.setPointerCapture?.(event.pointerId);
            }, true);

            context.on(root, 'pointermove', event => {
                if (!drag || event.pointerId !== drag.pointerId) return;
                const deltaX = event.clientX - drag.startX;
                const deltaY = event.clientY - drag.startY;
                if (!drag.moved && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 4) return;
                drag.moved = true;
                drag.canvas.classList.add('is-dragging');
                event.preventDefault();
                drag.canvas.scrollLeft = drag.startScrollLeft - deltaX;
                drag.canvas.scrollTop = drag.startScrollTop - deltaY;
            }, true);

            const stopDrag = event => {
                if (!drag || event.pointerId !== drag.pointerId) return;
                if (drag.moved) drag.canvas.dataset.recipeFlowDragged = 'true';
                drag.canvas.classList.remove('is-dragging');
                if (drag.canvas.hasPointerCapture?.(drag.pointerId)) {
                    drag.canvas.releasePointerCapture(drag.pointerId);
                }
                drag = null;
            };
            context.on(root, 'pointerup', stopDrag, true);
            context.on(root, 'pointercancel', stopDrag, true);
            context.on(root, 'click', event => {
                const canvas = event.target.closest('[data-recipe-flow-canvas]');
                if (!canvas || canvas.dataset.recipeFlowDragged !== 'true') return;
                event.preventDefault();
                event.stopPropagation();
                delete canvas.dataset.recipeFlowDragged;
            }, true);
        }

        function updateUpstreamMarkup(markup, previousCanvas) {
            const template = document.createElement('template');
            template.innerHTML = markup;
            const nextCanvas = template.content.querySelector('[data-recipe-flow-canvas]');
            if (!previousCanvas || !nextCanvas) {
                upstreamRoot.innerHTML = markup;
                return;
            }
            const scrollLeft = previousCanvas.scrollLeft;
            const scrollTop = previousCanvas.scrollTop;
            Array.from(previousCanvas.attributes).forEach(attribute => previousCanvas.removeAttribute(attribute.name));
            Array.from(nextCanvas.attributes).forEach(attribute => previousCanvas.setAttribute(attribute.name, attribute.value));
            previousCanvas.replaceChildren(...Array.from(nextCanvas.childNodes));
            previousCanvas.scrollLeft = scrollLeft;
            previousCanvas.scrollTop = scrollTop;
        }

        function renderDetail() {
            const previousCanvas = currentGraphCanvas();
            renderSelected();
            updateUpstreamMarkup(renderUpstreamSection(), previousCanvas);
            downstreamRoot.innerHTML = renderDownstreamSection();
            updateFullscreenState();
            setStatus(t('loaded', null, 'Loaded'), '');
        }

        function selectItem(id) {
            const normalized = String(id || '').trim();
            if (!normalized) return;
            selectedId = normalized;
            expandedCraftKeys.clear();
            expandedRepeatedKeys.clear();
            search.value = itemInfo(selectedId).name;
            resultsRoot.hidden = true;
            resultsRoot.replaceChildren();
            renderDetail();
        }

        function resolveSearch() {
            const value = search.value.trim();
            if (!value) return;
            const lowered = value.toLocaleLowerCase();
            const exact = allItems.find(item =>
                item.id.toLocaleLowerCase() === lowered || item.name.toLocaleLowerCase() === lowered
            );
            if (exact) {
                selectItem(exact.id);
                return;
            }
            setStatus(t('itemNotFound', null, 'Item not found'), 'error');
        }

        const [tableData, loadedEnvironmentTextTable] = await Promise.all([
            Promise.all(TABLE_NAMES.map(name => context.table(name))),
            window.AKEV3?.preloadTextTable?.() || Promise.resolve({})
        ]);
        environmentTextTable = loadedEnvironmentTextTable || {};
        normalizeRecipes(tableData);
        allItems = Object.entries(itemTable).filter(([id]) => byOutput.has(id) || byInput.has(id)).map(([id, row]) => ({
            id,
            name: tableText(row.name, showHidden() ? id : t('unknownItem', null, 'Unknown item'))
        })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
            a.id.localeCompare(b.id, 'en'));

        context.on(search, 'input', renderPickerResults);
        context.on(search, 'keydown', event => {
            if (event.key === 'Enter') resolveSearch();
        });
        context.on(fullscreenButton, 'click', async () => {
            const canvas = currentGraphCanvas();
            if (!canvas) return;
            try {
                if (document.fullscreenElement === canvas) {
                    await document.exitFullscreen();
                    return;
                }
                if (document.fullscreenElement) await document.exitFullscreen();
                if (typeof canvas.requestFullscreen !== 'function') throw new Error('Fullscreen is unavailable');
                await canvas.requestFullscreen();
            } catch (error) {
                setStatus(actionText('全屏显示失败：' + error.message, 'Full screen failed: ' + error.message), 'error');
            }
        });
        context.on(exportButton, 'click', () => void exportGraphPng());
        context.on(document, 'fullscreenchange', updateFullscreenState);
        context.on(root, 'click', event => {
            const craftToggle = event.target.closest('[data-recipe-flow-craft-toggle]');
            if (craftToggle) {
                event.preventDefault();
                const key = craftToggle.dataset.recipeFlowCraftToggle;
                if (!key) return;
                if (craftToggle.getAttribute('aria-expanded') === 'true') expandedCraftKeys.delete(key);
                else expandedCraftKeys.add(key);
                renderDetail();
                return;
            }
            const repeatToggle = event.target.closest('[data-recipe-flow-repeat-toggle]');
            if (repeatToggle) {
                event.preventDefault();
                const key = repeatToggle.dataset.recipeFlowRepeatToggle;
                if (!key) return;
                if (repeatToggle.getAttribute('aria-expanded') === 'true') expandedRepeatedKeys.delete(key);
                else expandedRepeatedKeys.add(key);
                renderDetail();
                return;
            }
            const item = event.target.closest('[data-recipe-flow-item]');
            if (item) {
                event.preventDefault();
                selectItem(item.dataset.recipeFlowItem);
            }
        });
        bindFlowStripDrag();

        selectedId = (context.routeId && (byOutput.has(context.routeId) || byInput.has(context.routeId)))
            ? context.routeId : DEFAULT_ITEM_ID;
        if (!itemTable[selectedId]) selectedId = allItems[0]?.id || DEFAULT_ITEM_ID;
        search.value = itemInfo(selectedId).name;
        renderDetail();

        return {};
    });
})();
