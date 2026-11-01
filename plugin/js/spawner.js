(function () {
        const t = window.akeI18n.scope('modules.spawn');
        const commonT = window.akeI18n.scope('common');
        let groups = [];            // [{ id, name, manifestPath, spawners: null }]
        let rawGroups = [];
        let currentGroup = null;
        let searchTerm = '';
        let isInitialized = false;
        let abortController = null;

        const IMAGE_BASE_PATH = '/public/images/spawner/';

        // 辅助函数
        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function (m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        function boolText(value) {
            return commonT(value ? 'yes' : 'no');
        }

        function noneText() {
            return commonT('none');
        }

        function unknownText() {
            return commonT('unknown');
        }

        function jsonButton(titleKey, data) {
            return `<button class="json-view-btn" title="${escapeHtml(t(titleKey))}" data-json='${escapeHtml(JSON.stringify(data))}'>🔍</button>`;
        }

        // JSON 模态框（使用新样式）
        function showJsonModal(data, title) {
            const modal = document.getElementById('spawnerJsonModal');
            const pre = document.getElementById('jsonModalPre');
            if (!modal || !pre) return;
            let jsonStr = '';
            try {
                jsonStr = JSON.stringify(data, null, 2);
            } catch (e) {
                jsonStr = t('json.serializeFailed');
            }
            if (title) {
                pre.textContent = t('json.commentTitle', { title }) + `\n${jsonStr}`;
            } else {
                pre.textContent = jsonStr;
            }
            modal.style.display = 'flex';
        }

        function closeJsonModal() {
            const modal = document.getElementById('spawnerJsonModal');
            if (modal) modal.style.display = 'none';
        }

        // ---------- 加载根清单 ----------
        async function loadRootManifest() {
            try {
                const directories = await window.akeAssetIndex.listJsonDirectories('SpawnerConfig');
                const showHidden = window.akeData?.getConfig().showHidden ?? false;
                groups = directories.map(path => ({
                    id: path.split('/').pop(),
                    name: path.split('/').pop(),
                    directory: path,
                    spawners: null
                }));
                rawGroups = groups;
                return groups;
            } catch (err) {
                console.error('加载根清单失败:', err);
                return [];
            }
        }

        // 按需加载分组的子清单
        async function loadGroupSpawners(group) {
            if (group.spawners !== null) return group.spawners;
            try {
                const items = await window.akeAssetIndex.listJsonFiles(group.directory);
                const showHidden = window.akeData?.getConfig().showHidden ?? false;
                let filtered = showHidden ? items : items.filter(item => !item.hidden);
                filtered.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                group.spawners = filtered.map(item => ({
                    id: item.id,
                    name: item.name || item.id,
                    dataPath: item.contentFile
                }));
                return group.spawners;
            } catch (err) {
                console.error(`加载分组 ${group.id} 子清单失败:`, err);
                group.spawners = [];
                return [];
            }
        }

        // 渲染左侧分组列表
        function renderGroupList() {
            const container = document.getElementById('groupList');
            if (!container) return;
            let filteredGroups = groups;
            if (searchTerm.trim()) {
                const lower = searchTerm.toLowerCase();
                filteredGroups = groups.filter(g =>
                    window.AKEModuleSearch.matches(g.name, lower) || window.AKEModuleSearch.matches(g.id, lower)
                );
            }
            if (filteredGroups.length === 0) {
                container.innerHTML = `<div class="list-empty">${escapeHtml(t('empty.noMatchingGroups'))}</div>`;
                return;
            }
            let html = '';
            filteredGroups.forEach(group => {
                const activeClass = (currentGroup && currentGroup.id === group.id) ? 'active' : '';
                html += `<div class="group-item ${activeClass}" data-group-id="${escapeHtml(group.id)}">
                        <div class="group-name">${escapeHtml(group.name)}</div>
                        <div class="group-id">${escapeHtml(group.id)}</div>
                    </div>`;
            });
            container.innerHTML = html;
            container.querySelectorAll('.group-item').forEach(el => {
                el.addEventListener('click', async () => {
                    const groupId = el.getAttribute('data-group-id');
                    const group = groups.find(g => g.id === groupId);
                    if (group) {
                        await onGroupSelected(group);
                    }
                });
            });
        }

        // 选中分组：加载所有关卡详情并直接展示波次
        async function onGroupSelected(group) {
            if (abortController) abortController.abort();
            abortController = new AbortController();

            currentGroup = group;
            if (window.__akeRouter) window.__akeRouter.updateUrl('spawn', group.id);
            renderGroupList();
            const rightContainer = document.getElementById('spawnerRight');
            rightContainer.innerHTML = `<div class="loader">${escapeHtml(t('loadingStageData'))}</div>`;

            const spawners = await loadGroupSpawners(group);
            if (!spawners.length) {
                rightContainer.innerHTML = `<div class="loader">${escapeHtml(t('empty.noStageData'))}</div>`;
                return;
            }

            const fetchPromises = spawners.map(async (spawner) => {
                try {
                    const url = spawner.dataPath;
                    const resp = await (window.akeFetch || fetch)(url, { signal: abortController.signal });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const data = await resp.json();
                    return { spawner, data };
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    console.error(`加载 ${spawner.name} 失败:`, err);
                    return { spawner, data: null, error: err.message };
                }
            });

            let results;
            try {
                results = await Promise.all(fetchPromises);
            } catch (err) {
                if (err.name === 'AbortError') return;
                rightContainer.innerHTML = `<div class="error-message">${escapeHtml(t('loadFailed', { message: err.message }))}</div>`;
                return;
            }

            renderAllSpawners(results, group);
        }

        // 生成路线详细信息的 HTML（增强版）
        function renderRouteDetails(routeMap) {
            if (!routeMap || Object.keys(routeMap).length === 0) return '';
            let routesHtml = `<div class="routes-section"><div class="routes-header">📌 ${escapeHtml(t('sections.routes'))}</div><div class="routes-list">`;
            for (const [routeId, route] of Object.entries(routeMap)) {
                const patrol = route.patrolData || {};
                const actionsCount = (patrol.actions || []).length;
                routesHtml += `
                <div class="route-item-card">
                    <div class="route-header">
                        <strong>${escapeHtml(t('route.title', { id: routeId }))}</strong>
                        ${jsonButton('buttons.viewRouteJson', route)}
                    </div>
                    <div class="route-details">
                        <div><span class="label">${escapeHtml(t('route.fields.loopMode'))}</span> ${escapeHtml(patrol.loop || noneText())}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.snapMode'))}</span> ${escapeHtml(patrol.snap || t('values.notApplicable'))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.motionType'))}</span> ${escapeHtml(patrol.motionType || noneText())}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.bornOverrideSpeed'))}</span> ${escapeHtml(String(patrol.bornOverrideSpeed ?? t('values.default')))} (${escapeHtml(t(patrol.enableBornSpeedOverride ? 'route.values.overrideEnabled' : 'route.values.overrideDisabled'))})</div>
                        <div><span class="label">${escapeHtml(t('route.fields.bornWaitDuration'))}</span> ${escapeHtml(t('units.seconds', { value: patrol.bornPositionWaitDuration ?? 0 }))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.useWorldOffset'))}</span> ${escapeHtml(boolText(patrol.useWorldOffset))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.localSpace'))}</span> ${escapeHtml(boolText(patrol.inLocalSpace))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.pathPointCount'))}</span> ${escapeHtml(String(actionsCount))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.stopWalkInplace'))}</span> ${escapeHtml(boolText(patrol.stopWalkInplace))}</div>
                        <div><span class="label">${escapeHtml(t('route.fields.forbidNpcInteract'))}</span> ${escapeHtml(boolText(patrol.forbidNpcInteract))}</div>
                    </div>
                </div>
            `;
            }
            routesHtml += '</div></div>';
            return routesHtml;
        }

        // 生成单个 spawner 的详情 HTML（增加放大镜按钮）
        function renderSpawnerDetailHtml(data, name, id) {
            const configId = data.configId || id;
            const settings = data.settings || {};
            const waveMap = data.waveMap || {};
            const enemyLibrary = data.enemyLibrary || [];

            const enemyMap = new Map();
            enemyLibrary.forEach(e => {
                enemyMap.set(e.key, {
                    enemyId: e.enemyId,
                    level: e.enemyLevel,
                    buffs: e.bornBuffList || [],
                    overrideAIConfig: e.overrideAIConfig,
                    preWarnTime: e.preWarnTime,
                    patrolGait: e.patrolGait,
                    raw: e  // 保存原始数据用于 JSON 查看
                });
            });

            // 生成波次 HTML（带放大镜）
            let wavesHtml = '';
            const waveKeys = Object.keys(waveMap).sort((a, b) => parseInt(a) - parseInt(b));
            for (const waveKey of waveKeys) {
                const wave = waveMap[waveKey];
                wavesHtml += `
                <div class="wave-card">
                    <div class="wave-header">
                        <span class="wave-key">${escapeHtml(t('wave.title', { index: waveKey }))}</span>
                        <span class="wave-mode">${escapeHtml(t('wave.mode', { mode: wave.waveMode || unknownText() }))}</span>
                        ${wave.waveModeKillCount ? `<span class="wave-kill">${escapeHtml(t('wave.killCount', { count: wave.waveModeKillCount }))}</span>` : ''}
                        ${wave.isHidden ? `<span class="wave-hidden">${escapeHtml(t('wave.hidden'))}</span>` : ''}
                        ${jsonButton('buttons.viewWaveJson', wave)}
                    </div>
                    <div class="groups-container">
            `;
                const groupMap = wave.groupMap || {};
                for (const groupId in groupMap) {
                    const group = groupMap[groupId];
                    wavesHtml += `
                    <div class="group-card">
                        <div class="group-header">
                            <span class="group-id">${escapeHtml(t('group.title', { id: groupId }))}</span>
                            <span class="group-mode">${escapeHtml(t('group.mode', { mode: group.groupMode || unknownText() }))}</span>
                            ${group.groupModeKillCount ? `<span class="group-kill">${escapeHtml(t('group.killCount', { count: group.groupModeKillCount }))}</span>` : ''}
                            ${jsonButton('buttons.viewGroupJson', group)}
                        </div>
                        <div class="actions-container">
                `;
                    const actionMap = group.actionMap || {};
                    for (const actionId in actionMap) {
                        const action = actionMap[actionId];
                        const libraryKey = action.libraryKey;
                        const enemyInfo = enemyMap.get(libraryKey) || {};
                        const buffsHtml = (enemyInfo.buffs || []).map(buff => {
                            let params = '';
                            if (buff.blackboard && buff.blackboard.length) {
                                params = '<div class="buff-params">' + buff.blackboard.map(p => t('enemy.buffParam', { key: p.key, value: p.valueFloat ?? p.valueString ?? '?' })).join(', ') + '</div>';
                            }
                            return `<div class="buff-item"><span class="buff-id">${escapeHtml(buff.buffId)}</span>${params}</div>`;
                        }).join('');

                        wavesHtml += `
                        <div class="action-card">
                            <div class="action-header">
                                <span class="action-time">⏱️ ${escapeHtml(t('enemy.spawnTime', { seconds: action.timestamp }))}</span>
                                <span class="action-count">${escapeHtml(t('enemy.spawnCount', { count: action.spawnCount }))}</span>
                                ${jsonButton('buttons.viewActionJson', action)}
                            </div>
                            <div class="action-detail">
                                <div><span class="label">${escapeHtml(t('enemy.fields.enemyId'))}</span>${escapeHtml(enemyInfo.enemyId || libraryKey)}</div>
                                <div><span class="label">${escapeHtml(t('enemy.fields.level'))}</span>${escapeHtml(String(enemyInfo.level ?? '?'))}</div>
                                <div><span class="label">${escapeHtml(t('enemy.fields.position'))}</span>${escapeHtml(t('enemy.position', { x: action.position?.x ?? 0, y: action.position?.y ?? 0, z: action.position?.z ?? 0 }))}</div>
                                <div><span class="label">${escapeHtml(t('enemy.fields.rotation'))}</span>${escapeHtml(t('enemy.rotation', { degrees: action.rotation?.y ?? 0 }))}</div>
                                ${enemyInfo.overrideAIConfig ? `<div><span class="label">${escapeHtml(t('enemy.fields.aiConfig'))}</span>${escapeHtml(enemyInfo.overrideAIConfig)}</div>` : ''}
                                ${enemyInfo.preWarnTime ? `<div><span class="label">${escapeHtml(t('enemy.fields.preWarnTime'))}</span>${escapeHtml(t('units.seconds', { value: enemyInfo.preWarnTime }))}</div>` : ''}
                                ${enemyInfo.patrolGait ? `<div><span class="label">${escapeHtml(t('enemy.fields.patrolGait'))}</span>${escapeHtml(enemyInfo.patrolGait)}</div>` : ''}
                                ${buffsHtml ? `<div class="buffs-section"><span class="label">${escapeHtml(t('enemy.fields.buffs'))}</span><div class="buffs-list">${buffsHtml}</div></div>` : ''}
                                ${enemyInfo.raw ? `<button class="json-view-btn-small" data-json='${escapeHtml(JSON.stringify(enemyInfo.raw))}'>${escapeHtml(t('buttons.viewEnemyRawJson'))}</button>` : ''}
                            </div>
                        </div>
                    `;
                    }
                    wavesHtml += `</div></div>`;
                }
                wavesHtml += `</div></div>`;
            }

            // 全局设置卡片
            const settingsHtml = `
            <div class="settings-card">
                <div class="section-header">⚙️ ${escapeHtml(t('sections.globalSettings'))} ${jsonButton('buttons.viewSettingsJson', settings)}</div>
                <div class="settings-grid">
                    <div>${escapeHtml(t('settings.autoComplete', { value: boolText(settings.autoComplete) }))}</div>
                    <div>${escapeHtml(t('settings.forbidDrop', { value: boolText(settings.forbidDrop) }))}</div>
                    <div>${escapeHtml(t('settings.stopExploreMusic', { value: boolText(settings.stopExploreMusic) }))}</div>
                    <div>${escapeHtml(t('settings.enemyLevelUseLevelGrade', { value: boolText(settings.enemyLevelUseLevelGrade) }))}</div>
                </div>
            </div>
        `;

            // 增强的路线数据展示
            const routeMap = data.routeMap || {};
            const routesHtml = renderRouteDetails(routeMap);

            return `
            <div class="spawner-card">
                <div class="collapse-header">
                    <span class="toggle-icon">▼</span>
                    <span class="card-name">${escapeHtml(name)}</span>
                    <span class="card-id">${escapeHtml(id)}</span>
                    <button class="json-view-btn" title="${escapeHtml(t('buttons.viewFullJson'))}" data-json='${escapeHtml(JSON.stringify(data))}'>🔍 ${escapeHtml(t('buttons.viewFullJson'))}</button>
                </div>
                <div class="collapse-content">
                    <div class="detail-id">${escapeHtml(t('configId', { id: configId }))}</div>
                    ${settingsHtml}
                    <div class="waves-section">
                        <div class="section-header">🌊 ${escapeHtml(t('sections.waves'))}</div>
                        ${wavesHtml || `<div class="no-data">${escapeHtml(t('empty.noWaveData'))}</div>`}
                    </div>
                    ${routesHtml}
                </div>
            </div>
        `;
        }

        // 渲染所有关卡
        function renderAllSpawners(results, group) {
            const container = document.getElementById('spawnerRight');
            if (!container) return;
            if (results.length === 0) {
                container.innerHTML = `<div class="loader">${escapeHtml(t('empty.noValidData'))}</div>`;
                return;
            }

            let html = `<div class="group-header-info">
                        <h2>${escapeHtml(group.name)}</h2>
                        <div class="group-id">${escapeHtml(group.id)}</div>
                    </div>`;

            for (let i = 0; i < results.length; i++) {
                const { spawner, data, error } = results[i];
                if (error || !data) {
                    html += `<div class="spawner-card error-card">
                            <div class="card-header">
                                <span class="card-name">${escapeHtml(spawner.name)}</span>
                                <span class="card-id">${escapeHtml(spawner.id)}</span>
                            </div>
                            <div class="card-error">${escapeHtml(t('loadFailed', { message: error }))}</div>
                        </div>`;
                    continue;
                }
                html += renderSpawnerDetailHtml(data, spawner.name, spawner.id);
            }

            container.innerHTML = html;

            // 绑定折叠
            container.querySelectorAll('.spawner-card .collapse-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    if (e.target.classList.contains('json-view-btn')) return;
                    const card = header.closest('.spawner-card');
                    const content = card.querySelector('.collapse-content');
                    const icon = header.querySelector('.toggle-icon');
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        icon.textContent = '▼';
                    } else {
                        content.style.display = 'none';
                        icon.textContent = '▶';
                    }
                });
            });

            // 绑定所有 JSON 查看按钮
            container.querySelectorAll('.json-view-btn, .json-view-btn-small').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const jsonStr = btn.getAttribute('data-json');
                    if (jsonStr) {
                        try {
                            const data = JSON.parse(jsonStr);
                            showJsonModal(data, t('json.autoGeneratedTitle'));
                        } catch (e) {
                            showJsonModal({ raw: jsonStr }, t('json.rawTextTitle'));
                        }
                    }
                });
            });
        }

        // 移动端分组列表
        function buildMobileGroupList() {
            const container = document.getElementById('mobileGroupList');
            if (!container) return;
            let filteredGroups = groups;
            if (searchTerm.trim()) {
                const lower = searchTerm.toLowerCase();
                filteredGroups = groups.filter(g => window.AKEModuleSearch.matches(g.name, lower) || window.AKEModuleSearch.matches(g.id, lower));
            }
            if (filteredGroups.length === 0) {
                container.innerHTML = `<div class="mobile-list-empty">${escapeHtml(t('mobile.emptyGroups'))}</div>`;
                return;
            }
            let html = '';
            filteredGroups.forEach(group => {
                html += `<div class="mobile-group-item" data-group-id="${escapeHtml(group.id)}">
                        <div class="group-name">${escapeHtml(group.name)}</div>
                        <div class="group-id">${escapeHtml(group.id)}</div>
                    </div>`;
            });
            container.innerHTML = html;
            container.querySelectorAll('.mobile-group-item').forEach(el => {
                el.addEventListener('click', async () => {
                    const groupId = el.getAttribute('data-group-id');
                    const group = groups.find(g => g.id === groupId);
                    if (group) {
                        await onGroupSelected(group);
                        closeMobileList();
                    }
                });
            });
        }

        function openMobileList() {
            buildMobileGroupList();
            const overlay = document.getElementById('spawnerMobileListOverlay');
            if (overlay) overlay.style.display = 'flex';
        }

        function closeMobileList() {
            const overlay = document.getElementById('spawnerMobileListOverlay');
            if (overlay) overlay.style.display = 'none';
        }

        async function refreshModule() {
            if (abortController) abortController.abort();
            abortController = new AbortController();
            await loadRootManifest();
            searchTerm = '';
            const searchInput = document.getElementById('spawnerGroupSearch');
            if (searchInput) searchInput.value = '';
            currentGroup = null;
            renderGroupList();
            const rightContainer = document.getElementById('spawnerRight');
            if (rightContainer) rightContainer.innerHTML = `<div class="loader">${escapeHtml(t('select'))}</div>`;
            if (window.__deepLinkId) {
                const deepGroup = groups.find(g => g.id === window.__deepLinkId);
                if (deepGroup) {
                    onGroupSelected(deepGroup);
                } else {
                    const existsInRaw = rawGroups.some(g => g.id === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;

            window.addEventListener('globalConfigChanged', async () => {
                searchTerm = '';
                if (document.getElementById('spawnerGroupSearch'))
                    document.getElementById('spawnerGroupSearch').value = '';
                await refreshModule();
            });

            const searchInput = document.getElementById('spawnerGroupSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchTerm = e.target.value;
                    renderGroupList();
                });
            }

            const mobileBtn = document.getElementById('spawnerMobileListBtn');
            const overlay = document.getElementById('spawnerMobileListOverlay');
            if (mobileBtn && overlay) {
                mobileBtn.addEventListener('click', openMobileList);
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) closeMobileList();
                });
            }

            // 模态框事件绑定（新样式）
            const modal = document.getElementById('spawnerJsonModal');
            const closeBtn = modal?.querySelector('.action-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeJsonModal);
            }
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeJsonModal();
                });
            }

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
