(function () {
        const t = window.akeI18n.scope('modules.buff');
        const commonT = window.akeI18n.scope('common');
        let allBuffs = [];
        let rawAllBuffs = [];
        let activeBuffId = null;
        let isInitialized = false;
        let searchTerm = '';
        let currentBuffData = null;   // 保存当前buff数据，供查看动作详情使用

        const IMAGE_BASE_PATH = '/public/images/';

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function (m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        function filterBuffs(buffs) {
            if (!searchTerm) return buffs;
            const term = searchTerm.toLowerCase();
            return buffs.filter(b =>
                (b.id && window.AKEModuleSearch.matches(b.id, term)) ||
                (b.name && window.AKEModuleSearch.matches(b.name, term))
            );
        }

        async function loadBuffManifest(showHidden) {
            try {
                const all = await window.akeAssetIndex.listJsonFiles('BuffData', { hidden: showHidden });
                rawAllBuffs = all || [];
                let buffs = showHidden ? rawAllBuffs : rawAllBuffs.filter(b => !b.hidden);
                buffs.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return buffs;
            } catch (err) {
                console.error('加载效果清单失败:', err);
                return [];
            }
        }

        function renderBuffList() {
            const container = document.getElementById('buffList');
            const detailContainer = document.getElementById('buffDetail');
            if (!container) return;

            const filtered = filterBuffs(allBuffs);
            container.innerHTML = '';
            if (filtered.length === 0) {
                container.innerHTML = `<div class="loader">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="loader">${t('select')}</div>`;
                activeBuffId = null;
                return;
            }

            filtered.forEach((buff, index) => {
                const item = document.createElement('div');
                item.className = `buff-item ${buff.id === activeBuffId ? 'active' : (index === 0 && !activeBuffId ? 'active' : '')}`;
                item.dataset.buffId = buff.id;
                item.dataset.contentFile = buff.contentFile;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'buff-info';
                const nameSpan = document.createElement('div');
                nameSpan.className = 'buff-name';
                nameSpan.textContent = buff.name || buff.id;
                const idSpan = document.createElement('div');
                idSpan.className = 'buff-id';
                idSpan.textContent = buff.id;
                infoDiv.appendChild(nameSpan);
                infoDiv.appendChild(idSpan);

                item.appendChild(infoDiv);

                item.addEventListener('click', () => {
                    document.querySelectorAll('.buff-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    activeBuffId = buff.id;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('buff', buff.id);
                    loadBuffDetail(buff, detailContainer);
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.id === window.__deepLinkId);
                if (deepItem) {
                    activeBuffId = deepItem.id;
                } else {
                    const existsInRaw = rawAllBuffs.some(c => c.id === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(b => b.id === activeBuffId);
            if (!activeExists && filtered.length > 0) {
                activeBuffId = filtered[0].id;
                const firstItem = container.querySelector('.buff-item');
                if (firstItem) firstItem.classList.add('active');
                loadBuffDetail(filtered[0], detailContainer);
                if (window.__akeRouter) window.__akeRouter.updateUrl('buff', activeBuffId);
            } else if (activeExists) {
                const activeBuff = filtered.find(b => b.id === activeBuffId);
                if (activeBuff) {
                    const activeItem = container.querySelector(`.buff-item[data-buff-id="${activeBuffId}"]`);
                    if (activeItem) activeItem.classList.add('active');
                    loadBuffDetail(activeBuff, detailContainer);
                    if (window.__akeRouter) window.__akeRouter.updateUrl('buff', activeBuffId);
                }
            }
        }

        // 显示动作详情模态框
        function showActionDetail(actionData) {
            const modal = document.getElementById('actionDetailModal');
            const pre = document.getElementById('actionDetailJson');
            if (!modal || !pre) return;
            const jsonStr = JSON.stringify(actionData, null, 2);
            pre.textContent = `// Auto generated via akedata.top\n${jsonStr}`;
            modal.style.display = 'flex';
        }

        function closeActionDetail() {
            const modal = document.getElementById('actionDetailModal');
            if (modal) modal.style.display = 'none';
        }

        async function loadBuffDetail(buff, container) {
            container.innerHTML = `<div class="loader">${t('loading')}</div>`;
            try {
                const data = await (window.akeFetch || fetch)(buff.contentFile).then(r => r.json());
                currentBuffData = data;
                container.innerHTML = renderDetail(data);
                // 绑定查看完整数据的按钮
                container.querySelectorAll('.action-view-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const actionType = btn.dataset.actionType;
                        const actionIndex = btn.dataset.actionIndex || '';
                        let action = null;

                        const getNestedEventAction = (eventList, indexText) => {
                            if (!Array.isArray(eventList)) return null;
                            const parts = indexText.split('_').map(v => parseInt(v, 10));
                            if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
                            const [eventIdx, wrapperIdx, actionIdx] = parts;
                            const eventItem = eventList[eventIdx];
                            const wrapper = eventItem?.actions?.[wrapperIdx];
                            return wrapper?.actionData?.[actionIdx] || null;
                        };

                        if (actionType === 'buffEventActionData') {
                            action = getNestedEventAction(currentBuffData?.buffEventAction, actionIndex);
                        } else if (actionType === 'abilityEventActionData') {
                            action = getNestedEventAction(currentBuffData?.abilityEventAction, actionIndex);
                        } else if (actionType === 'igniteEventActionData') {
                            action = getNestedEventAction(currentBuffData?.igniteEventAction, actionIndex);
                        } else if (actionType === 'timelineActionData') {
                            const parts = actionIndex.split('_').map(v => parseInt(v, 10));
                            if (parts.length === 2 && !parts.some(Number.isNaN)) {
                                const [groupIdx, actionIdx] = parts;
                                action = currentBuffData?.timelineActions?.[groupIdx]?._sequenceActionData?.actionData?.[actionIdx] || null;
                            }
                        }

                        if (action) {
                            showActionDetail(action);
                        } else {
                            alert(t('alerts.actionUnavailable'));
                        }
                    });
                });
            } catch (err) {
                container.innerHTML = `<div class="error-message">${t('loadFailed', { message: err.message })}</div>`;
            }
        }

        // 辅助：格式化数值
        function formatNumber(val) {
            if (typeof val !== 'number') return val;
            return val % 1 === 0 ? val.toString() : val.toFixed(2);
        }

        // 渲染属性修改器
        function renderAttributeModifiers(modifiers) {
            if (!modifiers || modifiers.length === 0) return `<p>${commonT('none')}</p>`;
            let html = `<table class="info-table"><thead><tr><th>${t('columns.attributeType')}</th><th>${t('columns.formula')}</th><th>${t('columns.parameterValue')}</th></tr></thead><tbody>`;
            modifiers.forEach(mod => {
                const attrType = mod.attributeType || commonT('unknown');
                const formula = mod.formulaItem || commonT('unknown');
                let paramValue = '';
                if (mod.param) {
                    if (mod.param.useBlackboardKey) {
                        paramValue = t('parameter.keyWithDefault', { key: mod.param.blackboardKey, value: mod.param.value });
                    } else {
                        paramValue = formatNumber(mod.param.value);
                    }
                }
                html += `<tr><td>${escapeHtml(attrType)}</td><td>${escapeHtml(formula)}</td><td>${escapeHtml(paramValue)}</td></tr>`;
            });
            html += '</tbody></table>';
            return html;
        }

        // 渲染黑板参数
        function renderBlackboard(blackboard) {
            if (!blackboard || blackboard.length === 0) return `<p>${commonT('none')}</p>`;
            let html = `<table class="info-table"><thead><tr><th>${t('columns.key')}</th><th>${t('columns.value')}</th><th>${t('columns.dynamic')}</th></tr></thead><tbody>`;
            blackboard.forEach(bb => {
                let value = bb.valueDouble !== undefined ? formatNumber(bb.valueDouble) : (bb.valueStr || '');
                html += `<tr><td>${escapeHtml(bb.key)}</td><td>${escapeHtml(value)}</td><td>${bb.isDynamic ? commonT('yes') : commonT('no')}</td></tr>`;
            });
            html += '</tbody></table>';
            return html;
        }

        function buildBlackboardValueMap(blackboard) {
            const valueMap = {};
            if (!Array.isArray(blackboard) || blackboard.length === 0) return valueMap;
            blackboard.forEach(bb => {
                if (!bb || !bb.key) return;
                if (bb.valueDouble !== undefined) {
                    valueMap[bb.key] = bb.valueDouble;
                } else {
                    valueMap[bb.key] = bb.valueStr;
                }
            });
            return valueMap;
        }

        function formatStackingType(stackingType) {
            const keyMap = {
                Unique: 'unique',
                Unlimited: 'unlimited',
                Stack: 'stack',
                Refresh: 'refresh',
                Enhance: 'enhance',
                EnhanceAndRefresh: 'enhanceAndRefresh',
                EnhanceAndOverwriteDuration: 'enhanceAndOverwriteDuration',
                HighPriority: 'highPriority',
                Extend: 'extend'
            };
            return keyMap[stackingType] ? t(`stacking.types.${keyMap[stackingType]}`) : (stackingType || commonT('unknown'));
        }

        function renderStackEffectsSummary(stackEffects) {
            if (!Array.isArray(stackEffects) || stackEffects.length === 0) return `<p>${commonT('none')}</p>`;
            let html = `<table class="info-table"><thead><tr><th>${t('columns.stackIndex')}</th><th>${t('columns.actionCount')}</th></tr></thead><tbody>`;
            stackEffects.forEach((effect, index) => {
                const actionCount = Array.isArray(effect?.effectActions) ? effect.effectActions.length : 0;
                html += `<tr><td>${index + 1}</td><td>${actionCount}</td></tr>`;
            });
            html += '</tbody></table>';
            return html;
        }

        // 渲染堆叠设置
        function renderStacking(settings, blackboard) {
            if (!settings) return `<p>${commonT('none')}</p>`;

            const bbMap = buildBlackboardValueMap(blackboard);
            const stackingTypeText = formatStackingType(settings.stackingType);
            const stackingKey = settings.stackingKey || t('stacking.defaultKey');

            let priorityRule = formatNumber(settings.priority ?? 0);
            if (settings.usePriorityKey) {
                const key = settings.priorityKey || '';
                const hasValue = Object.prototype.hasOwnProperty.call(bbMap, key);
                const actual = hasValue ? formatNumber(bbMap[key]) : t('stacking.valueNotFound');
                priorityRule = t(settings.negatePriority ? 'stacking.priorityKeyNegated' : 'stacking.priorityKey', {
                    key: key || t('stacking.emptyKey'),
                    actual
                });
            }

            const maxStackRaw = settings.maxStackCnt;
            let maxStackRule = maxStackRaw ?? t('stacking.noLimit');
            if (settings.useMaxStackCntKey) {
                const key = settings.maxStackCntKey || '';
                const hasValue = Object.prototype.hasOwnProperty.call(bbMap, key);
                const actual = hasValue ? formatNumber(bbMap[key]) : t('stacking.valueNotFound');
                maxStackRule = t('stacking.maximumKey', {
                    key: key || t('stacking.emptyKey'),
                    fallback: maxStackRaw ?? commonT('none'),
                    actual
                });
            } else if ((settings.stackingType === 'Unlimited' || settings.stackingType === 'Refresh') && (maxStackRaw === 0 || maxStackRaw === undefined)) {
                maxStackRule = t('stacking.noLimit');
            }

            const needStackEffect = settings.isNeedStackEffect ? commonT('yes') : commonT('no');
            const stackEffectCount = Array.isArray(settings.stackEffects) ? settings.stackEffects.length : 0;
            const stackEffectsSummaryHtml = renderStackEffectsSummary(settings.stackEffects);

            return `
                <div class="info-section">
                    <div>${t('stacking.identifierType', { value: escapeHtml(settings.identifierType || commonT('unknown')) })}</div>
                    <div>${t('stacking.stackingType', { value: escapeHtml(stackingTypeText) })}</div>
                    <div>${t('stacking.stackingKey', { value: escapeHtml(stackingKey) })}</div>
                    <div>${t('stacking.priorityRule', { value: escapeHtml(String(priorityRule)) })}</div>
                    <div>${t('stacking.maximumRule', { value: escapeHtml(String(maxStackRule)) })}</div>
                    <div>${t('stacking.effectEnabled', { value: needStackEffect })}</div>
                    <div>${t('stacking.effectCount', { count: stackEffectCount })}</div>
                    <div style="margin-top:8px;">${t('stacking.effectDetails')}</div>
                    ${stackEffectsSummaryHtml}
                </div>
            `;
        }

        // ---------- 动作展示相关函数（复用技能模块）----------
        function getSimpleProperties(obj, maxDepth = 1, currentDepth = 0) {
            if (currentDepth > maxDepth) return [];
            const props = [];
            for (const [key, value] of Object.entries(obj)) {
                if (value === null || value === undefined) continue;
                const type = typeof value;
                if (type === 'string' || type === 'number' || type === 'boolean') {
                    props.push({ key, value: String(value) });
                } else if (type === 'object' && !Array.isArray(value)) {
                    props.push(...getSimpleProperties(value, maxDepth, currentDepth + 1).map(p => ({ key: `${key}.${p.key}`, value: p.value })));
                } else if (Array.isArray(value) && value.length > 0 && typeof value[0] !== 'object') {
                    const arrStr = value.slice(0, 3).map(v => String(v)).join(', ') + (value.length > 3 ? '...' : '');
                    props.push({ key, value: `[${arrStr}]` });
                }
            }
            return props;
        }

        function getActionSummary(action) {
            const fullType = action.$type || t('actions.unknownType');
            let summary = '';
            if (fullType.includes('PlayAnimationAction')) {
                summary = t('actions.summary.animation', { name: action.animName || '?' });
            } else if (fullType.includes('DamageAction')) {
                const units = action.damageUnits;
                if (units && units.length) {
                    const types = units.map(u => u.damageType).join(',');
                    summary = t('actions.summary.damageTypes', { types });
                } else {
                    summary = t('actions.summary.damage');
                }
            } else if (fullType.includes('CreateBuffAction')) {
                const buffs = action.buffs;
                if (buffs && buffs.length) {
                    const ids = buffs.map(b => b.buffId).join(',');
                    summary = t('actions.summary.addBuffs', { ids });
                } else {
                    summary = t('actions.summary.addBuff');
                }
            } else if (fullType.includes('FindTargetAction')) {
                summary = t('actions.summary.findTarget', { group: action.targetGroupKey || '?' });
            } else if (fullType.includes('EffectAction')) {
                const effect = action.effectActionCfg?.effectName;
                summary = effect ? t('actions.summary.effectNamed', { effect }) : t('actions.summary.effect');
            } else if (fullType.includes('SelfRotateAction')) {
                summary = t('actions.summary.selfRotate', { type: action.rotateType || '?' });
            } else if (fullType.includes('CustomRootMotionAction')) {
                summary = t('actions.summary.rootMotion', { animation: action.animKey || '?' });
            } else if (fullType.includes('PlaySoundAction')) {
                summary = t('actions.summary.sound', { event: action._soundEvent || '?' });
            } else if (fullType.includes('HitStopAction')) {
                summary = t('actions.summary.hitStop', { duration: action.duration || '?' });
            } else if (fullType.includes('EnemyHurtAnimAction')) {
                summary = t('actions.summary.enemyHurt', { animation: action.hurtAnim || '?' });
            } else if (fullType.includes('ObtainCostAction')) {
                summary = t('actions.summary.obtainCost', { type: action.costType || '?' });
            } else if (fullType.includes('SetSuperArmorAction')) {
                summary = t('actions.summary.superArmor', { value: action.superArmorValue?.value || '?' });
            } else if (fullType.includes('TimeDilationAction')) {
                summary = t('actions.summary.timeDilation', { duration: action.duration?.value || '?' });
            } else if (fullType.includes('VoiceTriggerAction')) {
                summary = t('actions.summary.voice', { key: action._triggerKey || '?' });
            } else if (fullType.includes('PlayAnimationWithStep')) {
                summary = t('actions.summary.stepAnimation', { animation: action.animName || '?' });
            } else {
                const keys = Object.keys(action).slice(0, 3);
                summary = t('actions.summary.parameters', { keys: keys.join(', ') });
            }
            const simpleProps = getSimpleProperties(action, 1);
            const importantProps = simpleProps.filter(p =>
                !p.key.includes('$type') &&
                !p.key.includes('actionData') &&
                !p.key.includes('sequenceActionData')
            ).slice(0, 15);
            return { fullType, summary, details: importantProps };
        }

        function normalizeEventActionItems(eventItems, eventFieldName) {
            if (!Array.isArray(eventItems) || eventItems.length === 0) return [];
            const normalized = [];
            eventItems.forEach((eventItem, eventIdx) => {
                const eventName = eventItem?.[eventFieldName] || t('events.unknown');
                const wrappers = Array.isArray(eventItem?.actions) ? eventItem.actions : [];
                wrappers.forEach((wrapper, wrapperIdx) => {
                    const actions = Array.isArray(wrapper?.actionData) ? wrapper.actionData : [];
                    actions.forEach((action, actionIdx) => {
                        normalized.push({
                            eventName,
                            action,
                            actionIndex: `${eventIdx}_${wrapperIdx}_${actionIdx}`
                        });
                    });
                });
            });
            return normalized;
        }

        function formatEventName(eventType, eventName) {
            const maps = {
                buffEvent: {
                    DuringBuffEnable: 'duringBuffEnable',
                    OnBuffEnable: 'onBuffEnable',
                    OnBuffStart: 'onBuffStart',
                    OnBuffTrigger: 'onBuffTrigger',
                    OnBuffFinish: 'onBuffFinish'
                },
                abilityEvent: {
                    OnBeforeTakeDamage: 'onBeforeTakeDamage',
                    OnBeforeCastSkill: 'onBeforeCastSkill',
                    OnBeforeOutputDamage: 'onBeforeOutputDamage',
                    OnOutputDamage: 'onOutputDamage',
                    OnOutputBuff: 'onOutputBuff',
                    OnAddedBuff: 'onAddedBuff',
                    OnSkillEnd: 'onSkillEnd',
                    OnOwnerSwitchToGuard: 'onOwnerSwitchToGuard',
                    OnAfterOutputWeaknessTriggered: 'onAfterOutputWeaknessTriggered'
                },
                igniteEvent: {
                    OnIgniteStart: 'onIgniteStart',
                    OnIgniteTrigger: 'onIgniteTrigger',
                    OnIgniteEnd: 'onIgniteEnd'
                }
            };
            const key = maps[eventType]?.[eventName];
            return key ? t('events.named', { name: eventName, description: t(`events.names.${key}`) }) : eventName;
        }

        function renderEventActions(eventItems, title, eventType, eventFieldName, actionTypeKey) {
            const normalized = normalizeEventActionItems(eventItems, eventFieldName);
            if (normalized.length === 0) return '';

            let html = `<div class="detail-section"><h3>${title}</h3><div class="action-group-list">`;
            normalized.forEach((item, idx) => {
                const { fullType, summary, details } = getActionSummary(item.action);
                const eventText = formatEventName(eventType, item.eventName || t('events.unknown'));
                let detailsHtml = '';
                if (details.length > 0) {
                    detailsHtml = '<div class="action-props">' + details.map(d =>
                        `<span class="action-prop"><span class="prop-key">${escapeHtml(d.key)}</span>=<span class="prop-value">${escapeHtml(d.value)}</span></span>`
                    ).join('') + '</div>';
                }

                html += `
                    <div class="action-item">
                        <div class="action-index">${idx + 1}</div>
                        <div class="action-details">
                            <div class="action-type">${escapeHtml(fullType)}</div>
                            <div class="action-summary">${t('events.actionSummary', { event: escapeHtml(eventText), summary: escapeHtml(summary) })}</div>
                            ${detailsHtml}
                        </div>
                        <div class="action-actions">
                            <button class="action-view-btn" data-action-type="${actionTypeKey}" data-action-index="${item.actionIndex}" title="${t('actions.viewDetails')}">🔍</button>
                        </div>
                    </div>
                `;
            });
            html += '</div></div>';
            return html;
        }

        // 渲染timelineActions（可能存在于buff中，结构类似技能的动作组）
        function renderTimelineActions(timelineActions) {
            if (!timelineActions || timelineActions.length === 0) return '';
            let html = `<div class="detail-section"><h3>${t('timeline.title')}</h3><div class="action-group-list">`;
            timelineActions.forEach((actionGroup, groupIdx) => {
                const start = actionGroup._startFrame;
                const end = actionGroup._endFrame;
                const actions = actionGroup._sequenceActionData?.actionData || [];
                html += `
                    <div class="action-group">
                        <div class="action-group-header">
                            <span class="action-group-title">${t('timeline.group', { number: groupIdx + 1 })}</span>
                            <span class="action-group-range">${t('timeline.frameRange', { start, end })}</span>
                            <span class="action-group-count">${t('timeline.actionCount', { count: actions.length })}</span>
                        </div>
                        <div class="action-group-content">
                `;
                if (actions.length === 0) {
                    html += `<div class="action-item">${t('timeline.empty')}</div>`;
                } else {
                    actions.forEach((act, actIdx) => {
                        const { fullType, summary, details } = getActionSummary(act);
                        let detailsHtml = '';
                        if (details.length > 0) {
                            detailsHtml = '<div class="action-props">' + details.map(d =>
                                `<span class="action-prop"><span class="prop-key">${escapeHtml(d.key)}</span>=<span class="prop-value">${escapeHtml(d.value)}</span></span>`
                            ).join('') + '</div>';
                        }
                        html += `
                            <div class="action-item">
                                <div class="action-index">${actIdx + 1}</div>
                                <div class="action-details">
                                    <div class="action-type">${escapeHtml(fullType)}</div>
                                    <div class="action-summary">${escapeHtml(summary)}</div>
                                    ${detailsHtml}
                                </div>
                                <div class="action-actions">
                                    <button class="action-view-btn" data-action-type="timelineActionData" data-action-index="${groupIdx}_${actIdx}" title="${t('actions.viewDetails')}">🔍</button>
                                </div>
                            </div>
                        `;
                    });
                }
                html += `</div></div>`;
            });
            html += '</div></div>';
            return html;
        }

        function renderDetail(data) {
            const id = data.id || commonT('unknown');
            const lifeType = data.lifeType || commonT('unknown');
            const duration = data.duration?.value ?? commonT('none');
            const triggerInterval = data.triggerInterval?.value ?? commonT('none');
            const maxTriggerCnt = data.maxTriggerCnt?.value ?? t('unlimited');
            const canBeDispelled = data.dispelConfig?.canBeDispelled ? commonT('yes') : commonT('no');

            const attrModifiersHtml = renderAttributeModifiers(data.attributeModifier?.attributeModifiers);
            const blackboardHtml = renderBlackboard(data.blackboard);
            const stackingHtml = renderStacking(data.stackingSettings, data.blackboard);

            // 渲染各类动作列表
            const buffEventHtml = renderEventActions(data.buffEventAction, t('sections.buffEvents'), 'buffEvent', 'buffEvent', 'buffEventActionData');
            const abilityEventHtml = renderEventActions(data.abilityEventAction, t('sections.abilityEvents'), 'abilityEvent', 'abilityEvent', 'abilityEventActionData');
            const igniteEventHtml = renderEventActions(data.igniteEventAction, t('sections.igniteEvents'), 'igniteEvent', 'igniteEvent', 'igniteEventActionData');
            const timelineHtml = renderTimelineActions(data.timelineActions);

            return `
                <div class="buff-detail-container">
                    <div class="detail-header">
                        <div class="detail-info">
                            <div class="detail-title-row">
                                <span class="detail-name">${escapeHtml(id)}</span>
                            </div>
                            <div class="detail-meta">
                                <div>${t('meta.lifeType', { value: escapeHtml(lifeType) })}</div>
                                <div>${t('meta.duration', { value: duration })}</div>
                                <div>${t('meta.triggerInterval', { value: triggerInterval })}</div>
                                <div>${t('meta.maximumTriggers', { value: maxTriggerCnt })}</div>
                                <div>${t('meta.dispellable', { value: canBeDispelled })}</div>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3>${t('sections.attributeModifiers')}</h3>
                        ${attrModifiersHtml}
                    </div>

                    <div class="detail-section">
                        <h3>${t('sections.parameters')}</h3>
                        ${blackboardHtml}
                    </div>

                    <div class="detail-section">
                        <h3>${t('sections.stacking')}</h3>
                        ${stackingHtml}
                    </div>

                    ${buffEventHtml}
                    ${abilityEventHtml}
                    ${igniteEventHtml}
                    ${timelineHtml}
                </div>
            `;
        }

        async function refreshModule() {
            const list = document.getElementById('buffList');
            const detail = document.getElementById('buffDetail');
            if (!list || !detail) return;
            const showHidden = getCurrentShowHidden();
            const buffs = await loadBuffManifest(showHidden);
            allBuffs = buffs;
            renderBuffList();
            if (mobileOverlay?.style.display === 'flex') buildMobileList();
        }

        // 移动端列表
        const mobileBtn = document.getElementById('buffMobileListBtn');
        const mobileOverlay = document.getElementById('buffMobileListOverlay');
        const mobileContent = document.getElementById('buffMobileListContent');

        function buildMobileList() {
            if (!mobileContent) return;
            const filtered = filterBuffs(allBuffs);
            mobileContent.innerHTML = '';
            filtered.forEach(buff => {
                const item = document.createElement('div');
                item.className = 'mobile-list-item';
                if (buff.id === activeBuffId) item.classList.add('active');
                item.innerHTML = `
                    <div class="item-name">${escapeHtml(buff.name || buff.id)}</div>
                    <div class="item-id">${escapeHtml(buff.id)}</div>
                `;
                item.addEventListener('click', () => {
                    activeBuffId = buff.id;
                    if (window.__akeRouter) window.__akeRouter.updateUrl('buff', buff.id);
                    loadBuffDetail(buff, document.getElementById('buffDetail'));
                    closeMobileList();
                    document.querySelectorAll('.buff-item').forEach(el => el.classList.remove('active'));
                    const activeItem = document.querySelector(`.buff-item[data-buff-id="${buff.id}"]`);
                    if (activeItem) activeItem.classList.add('active');
                });
                mobileContent.appendChild(item);
            });
        }

        function openMobileList() {
            buildMobileList();
            if (mobileOverlay) mobileOverlay.style.display = 'flex';
        }

        function closeMobileList() {
            if (mobileOverlay) mobileOverlay.style.display = 'none';
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;

            window.addEventListener('globalConfigChanged', (e) => {
                searchTerm = '';
                const searchInput = document.getElementById('buffSearchInput');
                if (searchInput) searchInput.value = '';
                refreshModule();
            });

            document.getElementById('buffSearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderBuffList();
                if (mobileOverlay?.style.display === 'flex') buildMobileList();
            });

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
                if (e.target === mobileOverlay) closeMobileList();
            });

            // 模态框关闭事件
            const modal = document.getElementById('actionDetailModal');
            const closeBtn = document.querySelector('.action-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeActionDetail);
            }
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeActionDetail();
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
