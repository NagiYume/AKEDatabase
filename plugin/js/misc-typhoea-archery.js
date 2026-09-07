(function () {
    'use strict';

    const MODULE_ID = 'typhoea_archery';

    if (!window.AKEMisc?.register) {
        console.error('AKEMisc is unavailable; cannot register', MODULE_ID);
        return;
    }

    window.AKEMisc.register(MODULE_ID, async function (initialContext) {
        let disposed = false;

        return {
            async mount(root, mountContext) {
                const context = mountContext || initialContext || {};
                const section = root?.matches?.(`[data-misc-module="${MODULE_ID}"]`)
                    ? root
                    : root?.querySelector?.(`[data-misc-module="${MODULE_ID}"]`);
                const content = section?.querySelector?.('[data-role="content"]');
                const meta = section?.querySelector?.('[data-role="meta"]');
                const escape = context.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]));
                const rich = value => context.parseText ? context.parseText(String(value || '')) : escape(value);
                const text = (ref, fallback = '') => window.AKEV3?.text?.(ref, fallback) || fallback || '';
                const t = (key, params, fallback) => window.akeI18n?.t?.(`modules.typhoeaArchery.${key}`, params, fallback) || fallback || key;
                const table = window.AKEV3?.table;
                const loadTable = name => table?.(name, undefined, { optional: true }) || Promise.resolve({});
                const inactive = () => disposed || context.signal?.aborted;
                const formatNumber = value => Number.isInteger(Number(value)) ? String(Number(value)) : Number(value || 0).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
                const itemIcon = (id, items) => {
                    const iconId = items?.[id]?.iconId || id;
                    return iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${encodeURIComponent(iconId)}.png` : '';
                };
                const itemName = (id, items) => text(items?.[id]?.name, id);

                if (!section || !content || !meta) return;
                if (!table) {
                    content.innerHTML = `<div class="ake-ui-state" data-state="error" role="alert">${escape(t('apiMissing', null, '未找到 AKEV3 TableCfg 读取接口。'))}</div>`;
                    return;
                }

                function rewardItems(rewardId, rewards) {
                    const reward = rewards?.[rewardId] || {};
                    return [...(reward.itemBundles || []), ...(reward.probItemBundles || [])];
                }

                function rewardView(rewardId, rewards, items) {
                    if (!rewardId) return '-';
                    const reward = rewards?.[rewardId];
                    if (!reward) return `<code>${escape(rewardId)}</code>`;
                    const bundles = rewardItems(rewardId, rewards);
                    if (!bundles.length) return '-';
                    return `<ul class="misc-reward-list" aria-label="${escape(t('rewards', null, '奖励'))}">${bundles.map(bundle => {
                        const count = bundle.count == null ? '?' : formatNumber(bundle.count);
                        const icon = itemIcon(bundle.id, items);
                        return `<li>${icon ? `<img class="misc-reward-icon" src="${escape(icon)}" alt="" loading="lazy">` : ''}<span>${escape(itemName(bundle.id, items))}</span><strong>×${escape(count)}</strong></li>`;
                    }).join('')}</ul>`;
                }

                function chipView(ids, chips, items) {
                    if (!ids?.length) return '-';
                    return ids.map(id => {
                        const chip = chips?.[id] || {};
                        const itemId = chip.portableDeviceId || '';
                        return `<span class="misc-reward">${itemId ? `<img class="misc-reward-icon" src="${escape(itemIcon(itemId, items))}" alt="" loading="lazy">` : ''}<span>${escape(text(chip.chipName, id))}</span></span>`;
                    }).join(' ');
                }

                try {
                    const [constants, levels, daily, rankMap, groups, simulations, chips, affixes, combinations, domains, rewards, items] = await Promise.all([
                        loadTable('TyphoeaArcheryConst'),
                        loadTable('TyphoeaArcheryLevelTable'),
                        loadTable('TyphoeaArcheryDailyTrainTable'),
                        loadTable('TyphoeaArcheryDailyLevelId2RankId'),
                        loadTable('TyphoeaArcherySimulateTrainGroupTable'),
                        loadTable('TyphoeaArcherySimulateTrainTable'),
                        loadTable('TyphoeaArcheryChipTable'),
                        loadTable('TyphoeaShootingRangeAffixTable'),
                        loadTable('TyphoeaShootingRangeAffixCombinationTable'),
                        loadTable('DomainDataTable'),
                        loadTable('RewardTable'),
                        loadTable('ItemTable')
                    ]);
                    if (inactive()) return;

                    const domainId = constants?.shootingRangeDomainId || '';
                    const domain = domains?.[domainId] || {};
                    const domainName = text(domain.domainName, domainId || '-');
                    const levelRows = Object.values(levels || {}).sort((a, b) => Number(a.level || 0) - Number(b.level || 0));
                    const dailyIds = [...new Set([...Object.keys(daily || {}), ...Object.keys(rankMap || {})])];
                    const dailyRows = dailyIds.map(id => {
                        const row = daily?.[id] || {};
                        return { id, name: text(row.levelName, id), unlockLevel: row.unlockLevel, rankId: rankMap?.[id] || '' };
                    }).sort((a, b) => Number(a.unlockLevel || 0) - Number(b.unlockLevel || 0) || a.id.localeCompare(b.id));
                    const simulationRows = Object.values(simulations || {}).sort((a, b) => String(a.simLevelGroupId).localeCompare(String(b.simLevelGroupId)) || Number(a.sortId || 0) - Number(b.sortId || 0));
                    const simulationGroups = groups || {};
                    const affixRows = Object.values(affixes || {}).sort((a, b) => String(a.affixId).localeCompare(String(b.affixId)));
                    const combinationRows = Object.values(combinations || {}).sort((a, b) => String(a.affixCombinationId).localeCompare(String(b.affixCombinationId)));

                    meta.innerHTML = `<dl class="misc-meta-list"><div><dt>${escape(t('region'))}</dt><dd>${escape(domainName)}</dd></div><div><dt>${escape(t('mapLevel'))}</dt><dd><code>${escape(constants?.shootingRangeLevelId || '-')}</code></dd></div><div><dt>${escape(t('levelCount'))}</dt><dd>${escape(t('levelsCount', { count: levelRows.length }))}</dd></div></dl>`;

                    const warnings = [];
                    if (!domainId) warnings.push(t('missingConst'));
                    if (!levelRows.length) warnings.push(t('missingLevels'));
                    if (!Object.keys(rewards || {}).length) warnings.push(t('missingRewards'));
                    if (!Object.keys(items || {}).length) warnings.push(t('missingItems'));

                    const levelHtml = levelRows.map(row => `<tr><th scope="row">Lv.${escape(formatNumber(row.level))}</th><td>${rich(text(row.levelTitle, '-'))}</td><td>${rich(text(row.upgradeLevelDesc, '-'))}<br>${rich(text(row.upgradeQuestDesc, row.upgradeQuestId || '-'))}</td></tr>`).join('');
                    const dailyHtml = dailyRows.map(row => `<tr><th scope="row">${escape(row.id)}</th><td>${escape(row.name)}</td><td>${row.unlockLevel == null ? '-' : `Lv.${escape(row.unlockLevel)}`}</td><td>${escape(row.rankId || '-')}</td></tr>`).join('');
                    const simulationHtml = simulationRows.map(row => {
                        const groupName = text(simulationGroups[row.simLevelGroupId]?.simLevelGroupName, row.simLevelGroupId || '-');
                        return `<article class="ake-ui-card" data-card-kind="misc-event"><header class="ake-ui-card__header"><div><h4 class="ake-ui-card__title">${escape(text(row.levelName, row.simLevelId || row.gameId || '-'))}</h4><div class="ake-ui-card__id">${escape(groupName)} · Lv.${escape(row.unlockLevel ?? '-')}</div></div></header><p>${rich(text(row.levelDesc, '-'))}</p><p>${rich(text(row.levelTargetDesc, '-'))}</p><div class="ake-ui-card__badges">${chipView(row.Lockedchips, chips, items)}</div><footer class="ake-ui-card__footer">${rewardView(row.levelReward, rewards, items)}</footer></article>`;
                    }).join('');
                    const chipHtml = Object.values(chips || {}).sort((a, b) => String(a.chipId).localeCompare(String(b.chipId))).map(row => `<tr><th scope="row">${escape(row.chipId)}</th><td>${escape(text(row.chipName, row.chipId))}</td><td>${rich(text(row.chipDesc, '-'))}</td></tr>`).join('');
                    const affixHtml = affixRows.map(row => `<tr><th scope="row">${escape(row.affixId)}</th><td>${rich(text(row.affixDesc, '-'))}</td></tr>`).join('');
                    const combinationHtml = combinationRows.map(row => `<tr><th scope="row">${escape(row.affixCombinationId)}</th><td>${(row.affixIds || []).map(id => `<div>${escape(id)}：${rich(text(affixes?.[id]?.affixDesc, id))}</div>`).join('')}</td></tr>`).join('');

                    content.innerHTML = `${warnings.length ? `<aside class="misc-data-warning" role="note"><h3>${escape(t('warningTitle'))}</h3><ul>${warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></aside>` : ''}
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcheryLevels"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcheryLevels">${escape(t('levelEffects'))}</h3></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${escape(t('level'))}</th><th>${escape(t('effect'))}</th><th>${escape(t('unlockCondition'))}</th></tr></thead><tbody>${levelHtml || `<tr><td colspan="3">${escape(t('empty'))}</td></tr>`}</tbody></table></div></section>
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcheryDaily"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcheryDaily">${escape(t('daily'))}</h3></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${escape(t('id'))}</th><th>${escape(t('training'))}</th><th>${escape(t('unlockLevel'))}</th><th>${escape(t('rank'))}</th></tr></thead><tbody>${dailyHtml || `<tr><td colspan="4">${escape(t('empty'))}</td></tr>`}</tbody></table></div></section>
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcherySimulation"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcherySimulation">${escape(t('simulation'))}</h3></header><div class="ake-ui-card-grid" data-size="regular">${simulationHtml || `<div class="ake-ui-state" data-state="empty">${escape(t('emptySimulation'))}</div>`}</div></section>
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcheryChips"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcheryChips">${escape(t('chips'))}</h3></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${escape(t('id'))}</th><th>${escape(t('name'))}</th><th>${escape(t('description'))}</th></tr></thead><tbody>${chipHtml || `<tr><td colspan="3">${escape(t('empty'))}</td></tr>`}</tbody></table></div></section>
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcheryAffixes"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcheryAffixes">${escape(t('affix'))}</h3></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${escape(t('id'))}</th><th>${escape(t('description'))}</th></tr></thead><tbody>${affixHtml || `<tr><td colspan="2">${escape(t('empty'))}</td></tr>`}</tbody></table></div></section>
                        <section class="ake-ui-section" aria-labelledby="typhoeaArcheryCombinations"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="typhoeaArcheryCombinations">${escape(t('combinations'))}</h3></header><div class="ake-ui-table-wrap"><table class="ake-ui-table"><thead><tr><th>${escape(t('id'))}</th><th>${escape(t('affixes'))}</th></tr></thead><tbody>${combinationHtml || `<tr><td colspan="2">${escape(t('empty'))}</td></tr>`}</tbody></table></div></section>`;
                } catch (error) {
                    if (inactive()) return;
                    console.error('提弗洛斯的靶场数据加载失败', error);
                    meta.textContent = t('title');
                    content.innerHTML = `<div class="ake-ui-state" data-state="error" role="alert">${escape(t('loadFailed', { message: error?.message || error }))}</div>`;
                }
            },
            destroy() {
                disposed = true;
            }
        };
    });
})();
