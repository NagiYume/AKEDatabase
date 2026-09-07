(function () {
    const t = window.akeI18n.scope('modules.region');
    const commonT = window.akeI18n.scope('common');
    const equipT = window.akeI18n.scope('modules.equip');
    const IMAGE_BASE_PATH = '/public/images/';
    let domains = [];
    let activeDomainId = null;
    let searchTerm = '';

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const formatNumber = value => Number.isInteger(Number(value)) ? String(Number(value)) : Number(value || 0).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const itemIcon = (id, itemTable) => {
        const iconId = itemTable?.[id]?.iconId || id;
        return id ? `${IMAGE_BASE_PATH}assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png` : '';
    };
    const itemName = (id, itemTable) => itemTable?.[id]?.name?.text || id;
    const levelIdFromPath = path => String(path || '').match(/(?:^|\/)LevelData\/([^/]+)/i)?.[1] || '';

    function parseDensity(mine) {
        const values = Array.isArray(mine?.densityLevel) ? mine.densityLevel : [];
        const purityByLevel = new Map();
        for (let index = 0; index + 1 < values.length; index += 2) {
            const requiredLevel = Number(values[index]);
            const purity = Number(values[index + 1]);
            if (Number.isFinite(requiredLevel) && Number.isFinite(purity)) purityByLevel.set(requiredLevel, purity);
        }
        return Array.from(purityByLevel, ([requiredLevel, purity]) => ({ requiredLevel, purity }))
            .sort((a, b) => a.requiredLevel - b.requiredLevel);
    }

    function baseMineOutputPerMinute(itemId, tables) {
        const producers = [tables.factoryMinerTable, tables.factoryGasMinerTable].flatMap(table => Object.values(table || {}));
        const miner = producers.find(row => (row.mineable || []).some(entry => entry.miningItemId === itemId));
        const mineable = (miner?.mineable || []).find(entry => entry.miningItemId === itemId);
        const roundMs = Number(miner?.msPerRound);
        const produceRate = Number(mineable?.produceRate);
        if (!(roundMs > 0) || !Number.isFinite(produceRate)) return 0;
        return 60000 / roundMs * produceRate;
    }

    function outputPerMinute(purity, itemId, tables) {
        return baseMineOutputPerMinute(itemId, tables) * Math.max(0, Number(purity) || 0) / 100;
    }

    function stageAtDomainLevel(mine, domainLevel) {
        const stages = parseDensity(mine);
        return stages.filter(stage => stage.requiredLevel <= domainLevel).at(-1) || null;
    }

    function stageRangeText(stages, stageIndex) {
        const start = stages[stageIndex]?.requiredLevel;
        const end = stages[stageIndex + 1]?.requiredLevel;
        if (stageIndex === 0 && start <= 1 && end != null) return t('ranges.before', { end }, `地区等级 < ${end}`);
        if (start != null && end != null) return t('ranges.between', { start, end }, `${start} <= 地区等级 < ${end}`);
        if (start != null) return t('ranges.after', { start }, `地区等级 >= ${start}`);
        return '-';
    }

    function rewardItems(rewardId, tables) {
        const reward = tables.rewardTable?.[rewardId] || {};
        return [...(reward.itemBundles || []), ...(reward.probItemBundles || [])];
    }

    function renderItems(items, itemTable, empty = '-') {
        if (!items?.length) return empty;
        return items.map(item => `<span class="ake-ui-badge"><img class="ake-ui-inline-icon" src="${itemIcon(item.id, itemTable)}" alt="">${escapeHtml(itemName(item.id, itemTable))}${item.count == null ? '' : ` × ${formatNumber(item.count)}`}</span>`).join(' ');
    }

    function renderItemLines(items, itemTable, empty = '-') {
        if (!items?.length) return empty;
        return `<div class="region-cell-list">${items.map(item => `<div><span class="ake-ui-badge"><img class="ake-ui-inline-icon" src="${itemIcon(item.id, itemTable)}" alt="">${escapeHtml(itemName(item.id, itemTable))}${item.count == null ? '' : ` × ${formatNumber(item.count)}`}</span></div>`).join('')}</div>`;
    }

    function describeDomainLevel(domain, row, previous, levelNames) {
        const descriptions = [];
        if (!previous || Number(row.moneyLimit) !== Number(previous.moneyLimit)) {
            descriptions.push(t('effects.moneyLimit', { value: formatNumber(row.moneyLimit) }, `调度券持有上限：${formatNumber(row.moneyLimit)}`));
        }
        Object.entries(row.domainDevelopmentLevelEffect || {}).forEach(([levelId, effect]) => {
            const before = previous?.domainDevelopmentLevelEffect?.[levelId] || {};
            const name = levelNames[levelId] || levelId;
            if (effect.isMineOutputUp) descriptions.push(`${name}：${t('effects.mineOutput', null, '矿物产量与纯度提升')}`);
            if (!previous || Number(effect.bandwidth) !== Number(before.bandwidth)) descriptions.push(`${name}：${t('effects.bandwidth', { value: effect.bandwidth }, `协议容量上限 ${effect.bandwidth}`)}`);
            if (!previous || Number(effect.battleBuildingLimit) !== Number(before.battleBuildingLimit)) descriptions.push(`${name}：${t('effects.battleBuilding', { value: effect.battleBuildingLimit }, `战斗设施上限 ${effect.battleBuildingLimit}`)}`);
            if (!previous || Number(effect.travelPoleLimit) !== Number(before.travelPoleLimit)) descriptions.push(`${name}：${t('effects.travelPole', { value: effect.travelPoleLimit }, `滑索架上限 ${effect.travelPoleLimit}`)}`);
        });
        return descriptions;
    }

    function buildDomain(domain, mineEntries, currentVersion, tables) {
        const mines = new Map();
        mineEntries.forEach(entry => (entry.meta?.factoryMines || []).forEach(rawMine => {
            const key = String(rawMine.logicMineDataId);
            if (mines.has(key)) return;
            const levelId = levelIdFromPath(entry.path);
            mines.set(key, {
                ...rawMine,
                levelId,
                levelName: tables.levelDescTable?.[levelId]?.showName?.text || levelId,
                sourcePath: entry.path || '',
                isNew: rawMine.addedVersion === currentVersion
            });
        }));
        const developmentRows = [...(domain.domainDevelopmentLevel || [])].sort((a, b) => Number(a.domainDevelopmentLevel) - Number(b.domainDevelopmentLevel));
        const levelNames = Object.fromEntries((domain.levelGroup || []).map(levelId => [levelId, tables.levelDescTable?.[levelId]?.showName?.text || levelId]));
        const levels = developmentRows.map((row, index) => {
            const level = Number(row.domainDevelopmentLevel);
            const outputs = new Map();
            Array.from(mines.values()).forEach(mine => {
                const stage = stageAtDomainLevel(mine, level);
                if (!stage) return;
                outputs.set(mine.itemId, (outputs.get(mine.itemId) || 0) + outputPerMinute(stage.purity, mine.itemId, tables));
            });
            return {
                row,
                level,
                growth: row.levelUpExp,
                outputs: Array.from(outputs, ([id, output]) => ({ id, output })),
                descriptions: describeDomainLevel(domain, row, developmentRows[index - 1], levelNames),
                rewards: rewardItems(row.rewardId, tables)
            };
        });
        return { ...domain, name: window.AKEV3.text(domain.domainName, domain.domainId), itemTable: tables.itemTable, mines: Array.from(mines.values()), levels, levelNames };
    }

    function domainListItem(domain, active) {
        return window.AKEUI.directoryItem({
            layout: 'entity', title: domain.name, id: domain.domainId,
            icon: { src: '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/mainhud/btn_Domain.png', alt: '' },
            active, attributes: { 'data-region-id': domain.domainId }, onSelect: () => selectDomain(domain.domainId)
        });
    }

    function renderLists() {
        const filtered = domains.filter(domain => !searchTerm || `${domain.name} ${domain.domainId}`.toLowerCase().includes(searchTerm.toLowerCase()));
        const list = document.getElementById('regionList');
        const mobile = document.getElementById('regionMobileListContent');
        if (!list || !mobile) return;
        list.innerHTML = '';
        mobile.innerHTML = '';
        filtered.forEach(domain => {
            list.appendChild(domainListItem(domain, domain.domainId === activeDomainId));
            mobile.appendChild(domainListItem(domain, domain.domainId === activeDomainId));
        });
        if (activeDomainId && !filtered.some(domain => domain.domainId === activeDomainId)) selectDomain(filtered[0]?.domainId || null);
    }

    function renderCollapsibleSection(title, content) {
        return `<details class="ake-ui-section region-mine-details"><summary class="region-section-summary"><span class="ake-ui-section__title">${title}</span><span class="region-section-summary__chevron" aria-hidden="true"></span></summary><div class="region-mine-details__body">${content}</div></details>`;
    }

    function renderLevelOutput(domain) {
        const rows = domain.levels.map(level => {
            const production = level.outputs.length ? `<div class="region-cell-list">${level.outputs.map(item => `<div><span class="ake-ui-badge"><img class="ake-ui-inline-icon" src="${itemIcon(item.id, domain.itemTable)}" alt="">${escapeHtml(itemName(item.id, domain.itemTable))} ${formatNumber(item.output)}/min</span></div>`).join('')}</div>` : '-';
            const descriptions = level.descriptions.length ? `<div class="region-cell-list">${level.descriptions.map(description => `<div>${escapeHtml(description)}</div>`).join('')}</div>` : '-';
            const rewards = renderItemLines(level.rewards, domain.itemTable);
            const growth = Number(level.growth) < 0 ? t('maxLevel', null, '满级') : formatNumber(level.growth);
            return `<tr><th scope="row">${level.level}</th><td>${growth}</td><td>${production}</td><td>${descriptions}</td><td>${rewards}</td></tr>`;
        }).join('');
        return renderCollapsibleSection(t('levelOutput'), `<div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${commonT('level')}</th><th>${t('growth')}</th><th>${t('output')}</th><th>${t('levelDescription', null, '等级说明')}</th><th>${t('levelRewards', null, '等级奖励')}</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    }

    function renderMineDetails(domain) {
        const rows = domain.mines.sort((a, b) => String(a.levelId).localeCompare(String(b.levelId)) || String(a.logicMineDataId).localeCompare(String(b.logicMineDataId))).map(mine => {
            const stages = parseDensity(mine);
            const ranges = stages.map((stage, index) => `${stageRangeText(stages, index)}：${formatNumber(outputPerMinute(stage.purity, mine.itemId, domain.tables))}/min，${formatNumber(stage.purity)}%`).join('<br>');
            const oemUrl = window.AKEV3?.pointShareUrl?.(mine.logicMineDataId) || '';
            const oemLink = oemUrl ? `<div><a class="v2eq-oem-link" href="${escapeHtml(oemUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(equipT('acquisition.oemMapLink', null, '在 OEM 查看'))}</a></div>` : '';
            return `<tr><td>${escapeHtml(mine.logicMineDataId)}${mine.isNew ? ` <span class="ake-ui-badge">${t('new', null, '新增')}</span>` : ''}${oemLink}</td><td>${escapeHtml(mine.levelName)}</td><td><img class="ake-ui-inline-icon" src="${itemIcon(mine.itemId, domain.itemTable)}" alt="">${escapeHtml(itemName(mine.itemId, domain.itemTable))}</td><td>${ranges || '-'}</td></tr>`;
        }).join('');
        return renderCollapsibleSection(t('mineDetails'), `<div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${t('mineId')}</th><th>${t('mineRegion', null, '所在地区')}</th><th>${t('mineral')}</th><th>${t('stageIntervals', null, '地区等级区间、产量与纯度')}</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    }

    function renderSettlementSection(domain) {
        const settlements = Object.values(domain.tables.settlementTable || {}).filter(row => row.domainId === domain.domainId);
        if (!settlements.length) return '';
        const cards = settlements.map(settlement => {
            const traits = (settlement.wantTagIdGroup || []).map(id => domain.tables.settlementTagTable?.[id]).filter(Boolean)
                .map(tag => `<span class="ake-ui-badge">${escapeHtml(tag.settlementTagName?.text || tag.settlementTagId)}${tag.desc?.text ? `：${escapeHtml(tag.desc.text)}` : ''}</span>`).join(' ');
            const levels = Object.entries(settlement.settlementLevelMap || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([levelKey, level]) => {
                const trades = Object.values(level.settlementTradeItemMap || {});
                const tradeLines = trades.length ? `<div class="region-cell-list">${trades.map(item => `<div><span class="ake-ui-badge"><img class="ake-ui-inline-icon" src="${itemIcon(item.itemId, domain.itemTable)}" alt="">${escapeHtml(itemName(item.itemId, domain.itemTable))} → ${formatNumber(item.rewardMoneyCount)} ${t('dispatchCoupon', null, '调度券')} / ${formatNumber(item.stmExp)} ${t('developmentValue', null, '发展值')}</span></div>`).join('')}</div>` : '-';
                return `<tr><th scope="row">Lv.${escapeHtml(levelKey)}</th><td>${level.isFinalMaxLevel || Number(level.levelUpExp) <= 0 ? t('maxLevel', null, '满级') : formatNumber(level.levelUpExp)}</td><td>${tradeLines}</td><td>${escapeHtml(level.desc?.text || '-')}</td></tr>`;
            }).join('');
            return `<article class="ake-ui-card" data-ake-component="card"><div class="ake-ui-card__content"><header class="ake-ui-card__header"><div class="ake-ui-card__heading"><h4 class="ake-ui-card__title">${escapeHtml(settlement.settlementName?.text || settlement.settlementId)}</h4><div class="ake-ui-card__badges">${traits}</div></div></header><div class="ake-ui-table-wrap"><table class="ake-ui-table region-settlement-table"><thead><tr><th>${commonT('level')}</th><th>${t('requiredDevelopment', null, '升级所需发展值')}</th><th>${t('materialExchange', null, '物资兑换调度券')}</th><th>${t('traitDescription', null, '等级说明')}</th></tr></thead><tbody>${levels}</tbody></table></div></div></article>`;
        }).join('');
        return renderCollapsibleSection(t('settlements', null, '据点'), `<div class="ake-ui-card-grid" data-size="wide">${cards}</div>`);
    }

    function shopGoodsItems(goodsId, tables) {
        const rewardId = tables.shopGoodsTable?.[goodsId]?.rewardId;
        return rewardItems(rewardId, tables);
    }

    function facilityCard(title, subtitle, rows) {
        return `<article class="ake-ui-card" data-ake-component="card"><div class="ake-ui-card__content"><header class="ake-ui-card__header"><div class="ake-ui-card__heading"><h4 class="ake-ui-card__title">${escapeHtml(title)}</h4>${subtitle ? `<div class="ake-ui-card__id">${escapeHtml(subtitle)}</div>` : ''}</div></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${commonT('level')}</th><th>${t('upgradeCost', null, '升级消耗调度券')}</th><th>${t('facilityEffect', null, '说明、奖励或解锁内容')}</th></tr></thead><tbody>${rows}</tbody></table></div></div></article>`;
    }

    function renderFacilitySection(domain) {
        const tables = domain.tables;
        const cards = [];
        Object.values(tables.shopChannelTable || {}).filter(row => row.shopGroupId === domain.domainShopGroupId).forEach(channel => {
            const rows = Object.entries(channel.channelLevelMap || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([level, data]) => {
                const costs = (data.costItemIdList || []).map((id, index) => ({ id, count: data.costItemNumList?.[index] || 0 }));
                const goods = (data.newGoodsList || []).flatMap(shopGoodsId => shopGoodsItems(shopGoodsId, tables));
                return `<tr><th scope="row">Lv.${level}</th><td>${renderItems(costs, domain.itemTable)}</td><td>${escapeHtml(data.channelDesc?.text || data.upgradeDesc?.text || '')}${goods.length ? `<br>${renderItemLines(goods, domain.itemTable)}` : ''}</td></tr>`;
            }).join('');
            cards.push(facilityCard(channel.channelName?.text || channel.levelId || channel.shopGroupId, t('facilityTypes.shop', null, '物资调度'), rows));
        });
        Object.values(tables.domainDepotTable || {}).filter(row => row.domainId === domain.domainId).forEach(depot => {
            const levels = tables.domainDepotLevelTable?.[depot.domainDepotId]?.levelList || {};
            const rows = Object.values(levels).sort((a, b) => Number(a.level) - Number(b.level)).map(data => `<tr><th scope="row">Lv.${data.level}</th><td>${data.isFinalMaxLevel ? t('maxLevel', null, '满级') : formatNumber(data.costDomainMoney)}</td><td>${escapeHtml(data.levelDesc?.text || '-')}</td></tr>`).join('');
            cards.push(facilityCard(depot.depotName?.text || depot.domainDepotId, t('facilityTypes.depot', null, '仓储节点'), rows));
        });
        Object.values(tables.kiteStationTable || {}).filter(row => row.domainId === domain.domainId).forEach(station => {
            const rows = Object.values(station.list || {}).sort((a, b) => Number(a.level) - Number(b.level)).map(data => `<tr><th scope="row">Lv.${data.level}</th><td>${data.isFinalMaxLevel ? t('maxLevel', null, '满级') : formatNumber(data.costItemCount?.[0] || 0)}</td><td>${escapeHtml(data.levelDesc?.text || '-')}</td></tr>`).join('');
            cards.push(facilityCard(station.name?.text || station.kiteStation, t('facilityTypes.kite', null, '环境监测'), rows));
        });
        Object.values(tables.recycleBinTable || {}).filter(row => row.domainId === domain.domainId).forEach(bin => {
            const rows = Object.values(bin.levelData || {}).sort((a, b) => Number(a.lv) - Number(b.lv)).map(data => `<tr><th scope="row">Lv.${data.lv}</th><td>${Number(data.lvUpCost) < 0 ? t('maxLevel', null, '满级') : formatNumber(data.lvUpCost)}</td><td>${escapeHtml(data.desc?.text || '')}${data.rewardId ? `<br>${renderItems(rewardItems(data.rewardId, tables), domain.itemTable)}` : ''}</td></tr>`).join('');
            cards.push(facilityCard(`${t('facilityTypes.recycle', null, '资源回收站')} #${bin.serialId}`, bin.levelId, rows));
        });
        Object.values(tables.sewageTable || {}).filter(row => row.domainId === domain.domainId).forEach(plant => {
            const rows = (plant.levelList || []).map(data => `<tr><th scope="row">Lv.${data.level}</th><td>${Number(data.cost) <= 0 ? '-' : formatNumber(data.cost)}</td><td>${escapeHtml(data.levelTitle?.text || '')}${data.levelDesc?.text ? `<br>${escapeHtml(data.levelDesc.text)}` : ''}</td></tr>`).join('');
            cards.push(facilityCard(plant.name?.text || plant.id, t('facilityTypes.sewage', null, '净水节点'), rows));
        });
        if ((domain.domainPoiTypeGroup || []).includes(130)) {
            const rows = Object.values(tables.simulationTable || {}).sort((a, b) => Number(a.gamblingBattleLevel) - Number(b.gamblingBattleLevel)).map(data => `<tr><th scope="row">Lv.${data.gamblingBattleLevel}</th><td>${data.isFinalMaxLevel ? t('maxLevel', null, '满级') : formatNumber(data.costDomainMoney)}</td><td>${escapeHtml(data.desc?.text || '-')}</td></tr>`).join('');
            if (rows) cards.push(facilityCard(t('facilityTypes.simulation', null, '选剑演武'), t('facilityTypes.simulationTraining', null, '演武平台'), rows));
        }
        if (!cards.length) return '';
        return renderCollapsibleSection(t('facilities', null, '地区设施等级'), `<div class="ake-ui-card-grid" data-size="wide">${cards.join('')}</div>`);
    }

    function renderDetail(domain) {
        const detail = document.getElementById('regionDetail');
        if (!detail) return;
        const header = window.AKEUI.detailHeader({ className: 'region-detail-hero', icon: { src: '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/mainhud/btn_Domain.png' }, title: domain.name, badges: [t('mineCount', { count: domain.mines.length })] });
        detail.innerHTML = `<article class="ake-ui-detail" data-detail-kind="region">${header?.outerHTML || ''}${renderLevelOutput(domain)}${renderMineDetails(domain)}${renderSettlementSection(domain)}${renderFacilitySection(domain)}</article>`;
    }

    function selectDomain(id) {
        activeDomainId = id;
        renderLists();
        const domain = domains.find(item => item.domainId === id);
        if (domain) renderDetail(domain);
    }

    async function load() {
        const tableNames = {
            domainTable: 'DomainDataTable', itemTable: 'ItemTable', rewardTable: 'RewardTable', levelDescTable: 'LevelDescTable',
            settlementTable: 'SettlementBasicDataTable', settlementTagTable: 'SettlementTagTable', shopChannelTable: 'ShopChannelDevelopmentTable',
            shopGoodsTable: 'ShopGoodsTable', domainDepotTable: 'DomainDepotTable', domainDepotLevelTable: 'DomainDepotLevelTable',
            kiteStationTable: 'KiteStationLevelTable', recycleBinTable: 'RecycleBinTable', sewageTable: 'FactorySewageTreatPlantStoreTable',
            simulationTable: 'SimulationTrainingLevelTable', factoryMinerTable: 'FactoryMinerTable', factoryGasMinerTable: 'FactoryGasMinerTable'
        };
        const values = await Promise.all(Object.values(tableNames).map(name => window.AKEV3.table(name)));
        const tables = Object.fromEntries(Object.keys(tableNames).map((key, index) => [key, values[index]]));
        const currentVersion = window.akeDataSource?.getState?.()?.selected?.id || '';
        const entries = [];
        for (const domain of Object.values(tables.domainTable || {})) {
            const levelEntries = [];
            for (const levelId of domain.levelGroup || []) {
                const files = await window.akeAssetIndex.listJsonFiles(`LevelData/${levelId}`);
                files.filter(file => Array.isArray(file.meta?.factoryMines)).forEach(file => levelEntries.push(file));
            }
            entries.push({ ...buildDomain(domain, levelEntries, currentVersion, tables), tables });
        }
        domains = entries.sort((a, b) => (a.sortId || 0) - (b.sortId || 0));
        activeDomainId = domains[0]?.domainId || null;
        renderLists();
        if (activeDomainId) renderDetail(domains[0]);
    }

    function init() {
        document.getElementById('regionSearchInput')?.addEventListener('input', event => { searchTerm = event.target.value; renderLists(); });
        const mobileButton = document.getElementById('regionMobileListBtn');
        const overlay = document.getElementById('regionMobileListOverlay');
        mobileButton?.addEventListener('click', () => { renderLists(); overlay?.classList.add('is-open'); overlay?.setAttribute('aria-hidden', 'false'); });
        overlay?.addEventListener('click', event => { if (event.target === overlay) { overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); } });
        load().catch(error => {
            const detail = document.getElementById('regionDetail');
            if (detail) detail.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: error.message })}</div>`;
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
