(function () {
    'use strict';

    const MODULE_ID = 'contingency_contract_tasks';
    const ACTIVITY_ID = 'activity_contingency_contract_0';
    const FALLBACK_GAME_ID = 'indie_contract001';

    if (!window.AKEMisc?.register) {
        console.error('AKEMisc is unavailable; cannot register', MODULE_ID);
        return;
    }

    window.AKEMisc.register(MODULE_ID, async function (initialContext) {
        let disposed = false;

        function fallbackEscape(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[char]);
        }

        function rootFor(root, context) {
            const candidate = root || context?.root;
            if (!candidate) return null;
            if (candidate.matches?.(`[data-misc-module="${MODULE_ID}"]`)) return candidate;
            return candidate.querySelector?.(`[data-misc-module="${MODULE_ID}"]`) || candidate;
        }

        function parseGameTime(value) {
            const match = String(value || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
            if (!match) return null;
            const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4] - 8, +match[5], +match[6]));
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function formatTime(date) {
            return new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }).format(date);
        }

        function rangeState(open, close) {
            const now = Date.now();
            if (!open || !close) return '时间未知';
            if (now < open.getTime()) return '尚未开放';
            if (now >= close.getTime()) return '已结束';
            return '进行中';
        }

        return {
            async mount(root, mountContext) {
                const context = mountContext || initialContext || {};
                const section = rootFor(root, context);
                const content = section?.querySelector?.('[data-role="content"]');
                const meta = section?.querySelector?.('[data-role="activity-meta"]');
                const escape = context.escapeHtml || fallbackEscape;
                const rich = value => context.parseText ? context.parseText(String(value || '')) : escape(value);
                const table = context.table || window.AKEV3?.table;
                const text = context.text || window.AKEV3?.text || ((ref, fallback) => ref?.text || fallback || '');
                const inactive = () => disposed || context.signal?.aborted;
                const showHidden = window.akeData?.getConfig?.().showHidden === true;

                if (!section || !content || !meta) return;
                if (!table) {
                    content.innerHTML = '<section class="ake-ui-state" role="alert"><h3>数据接口不可用</h3><p>未找到 AKEV3 TableCfg 读取接口。</p></section>';
                    return;
                }

                try {
                    const [activities, activityContracts, groupTable, taskConfigs, conditions, rewards, items, times, contracts] = await Promise.all([
                        table('ActivityTable'),
                        table('ActivityContingencyContractTable'),
                        table('ActivityContingencyContractTaskGroupTable'),
                        table('ActivityConditionalMultiStageTaskConfigTable'),
                        table('ActivityConditionalMultiStageTaskCompleteConditionTable'),
                        table('RewardTable'),
                        table('ItemTable'),
                        table('TimeRangeTable'),
                        table('ContingencyContractTable')
                    ]);
                    if (inactive()) return;

                    const activity = activities?.[ACTIVITY_ID];
                    const activityContract = Object.values(activityContracts || {}).find(row => row?.activityId === ACTIVITY_ID) || {};
                    const gameId = activityContract.gameId || FALLBACK_GAME_ID;
                    const taskMap = taskConfigs?.[ACTIVITY_ID]?.TaskConfigMap;
                    if (!taskMap || !Object.keys(taskMap).length) {
                        const missing = !Object.keys(taskConfigs || {}).length;
                        content.innerHTML = `<section class="ake-ui-state" role="${missing ? 'alert' : 'status'}"><h3>${missing ? '任务配置表不可用' : '本期没有合约任务'}</h3><p>${missing ? '任务配置数据未能加载。' : '当前活动没有可展示的任务。'}</p></section>`;
                        meta.textContent = activity ? text(activity.name, '危机合约') : '危机合约';
                        return;
                    }

                    const tasks = Object.values(taskMap).sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0) || String(a.taskId).localeCompare(String(b.taskId)));
                    const activityRange = times?.[activity?.timeId]?.timeRangeList?.[0] || {};
                    const activityOpen = parseGameTime(activityRange.openTime);
                    const activityClose = parseGameTime(activityRange.closeTime);
                    const releaseRanges = tasks.map(task => times?.[task.unlockTimeId]?.timeRangeList?.[0]).filter(Boolean);
                    const taskCloseDates = releaseRanges.map(range => parseGameTime(range.closeTime)).filter(Boolean);
                    const taskClose = taskCloseDates.length ? new Date(Math.max(...taskCloseDates.map(date => date.getTime()))) : activityClose;
                    const taskState = rangeState(activityOpen, taskClose);
                    const activityState = rangeState(activityOpen, activityClose);
                    const activityName = text(activity?.name, '危机合约');
                    const interval = (start, end) => start && end
                        ? `<time datetime="${escape(start.toISOString())}">${escape(formatTime(start))}</time> 至 <time datetime="${escape(end.toISOString())}">${escape(formatTime(end))}</time>`
                        : '未配置';
                    meta.innerHTML = `<dl class="misc-meta-list"><div><dt>活动</dt><dd>${escape(activityName)}</dd></div><div><dt>任务状态</dt><dd>${escape(taskState)}</dd></div><div><dt>任务期</dt><dd>${interval(activityOpen, taskClose)}</dd></div><div><dt>活动入口</dt><dd>${escape(activityState)}</dd></div><div><dt>入口开放期</dt><dd>${interval(activityOpen, activityClose)}</dd></div><div><dt>任务数量</dt><dd>${escape(tasks.length)} 项</dd></div>${showHidden ? `<div><dt>玩法 ID</dt><dd><code>${escape(gameId)}</code></dd></div>` : ''}</dl>`;

                    const warnings = [];
                    if (!activity) warnings.push('ActivityTable 中缺少活动主记录。');
                    if (!activityContract.gameId) warnings.push('活动与合约玩法的映射记录不可用，当前使用已知玩法 ID。');
                    if (!Object.keys(groupTable || {}).length) warnings.push('任务组表不可用，将按任务组 ID 使用默认分组名。');
                    if (!Object.keys(conditions || {}).length) warnings.push('任务条件表不可用，无法显示指标总计和累计目标。');
                    if (!Object.keys(rewards || {}).length) warnings.push('奖励表不可用，奖励详情无法解析。');
                    if (!Object.keys(items || {}).length) warnings.push('物品表不可用，奖励物品无法解析名称。');
                    if (!Object.keys(times || {}).length) warnings.push('时间表不可用，无法显示周期任务释出时间。');
                    if (!contracts?.[gameId]) warnings.push('合约指标表不可用，任务描述仍可正常展示。');

                    function rewardView(rewardId) {
                        if (!rewardId) return '<p class="misc-reward-empty">无直接奖励</p>';
                        const reward = rewards?.[rewardId];
                        if (!reward) return `<p class="misc-reward-empty">奖励配置不可用${showHidden ? `：<code>${escape(rewardId)}</code>` : ''}</p>`;
                        const bundles = [
                            ...(reward.itemBundles || []).map(bundle => ({ ...bundle, probabilistic: false })),
                            ...(reward.probItemBundles || []).map(bundle => ({ ...bundle, probabilistic: true }))
                        ];
                        return bundles.length ? `<ul class="misc-reward-list" aria-label="任务奖励">${bundles.map(bundle => {
                            const item = items?.[bundle.id] || {};
                            const name = text(item.name, showHidden ? bundle.id : '未命名物品');
                            const icon = item.iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${encodeURIComponent(item.iconId)}.png` : '';
                            return `<li>${window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: bundle.id, label: name, contentHtml: `${icon ? `<img class="misc-reward-icon" src="${escape(icon)}" alt="" loading="lazy">` : ''}<span>${escape(name)}</span><strong>×${escape(bundle.count ?? '?')}</strong>${bundle.probabilistic ? '<small>概率奖励</small>' : ''}` })}</li>`;
                        }).join('')}</ul>` : '<p class="misc-reward-empty">奖励包为空</p>';
                    }

                    function conditionView(task) {
                        if (!showHidden) return '';
                        const rows = (task.completeConditionId || []).map(id => conditions?.[id]).filter(Boolean);
                        if (!rows.length) return `<p class="misc-condition-missing">条件配置不可用：${(task.completeConditionId || []).map(id => `<code>${escape(id)}</code>`).join('、') || '未引用条件'}</p>`;
                        const labels = { 5919: '累计完成合约任务', 5920: '指定指标组合', 5930: '最高指标总计', 6511: '累计获得活动货币' };
                        return `<ul class="misc-condition-list">${rows.map(condition => {
                            const values = (condition.parameters || []).flatMap(parameter => parameter?.valueStringList || []).filter(Boolean);
                            return `<li><span>${escape(labels[condition.conditionType] || `条件类型 ${condition.conditionType}`)}</span><strong>目标 ${escape(Number(condition.progressToCompare || 0).toLocaleString('zh-CN'))}</strong>${values.length ? `<small>${values.map(value => `<code>${escape(value)}</code>`).join(' ')}</small>` : ''}</li>`;
                        }).join('')}</ul>`;
                    }

                    function releaseView(task) {
                        const range = times?.[task.unlockTimeId]?.timeRangeList?.[0];
                        if (!task.unlockTimeId) return '<span class="misc-release-state">活动开放时释出</span>';
                        if (!range) return `<span class="misc-release-state">释出时间不可用${showHidden ? ` <code>${escape(task.unlockTimeId)}</code>` : ''}</span>`;
                        const open = parseGameTime(range.openTime);
                        const close = parseGameTime(range.closeTime) || taskClose;
                        return `<span class="misc-release-state">${escape(rangeState(open, close))}${open ? ` · <time datetime="${escape(open.toISOString())}">${escape(formatTime(open))}</time> 释出` : ''}</span>`;
                    }

                    const groupIds = Array.from(new Set(tasks.map(task => task.taskGroupId || 'ungrouped')));
                    const fallbackGroupNames = ['周期任务', '指标总计', '累计纪念'];
                    const groups = groupIds.map((groupId, index) => {
                        const group = groupTable?.[groupId] || {};
                        const suffix = Number(String(groupId).match(/_(\d+)$/)?.[1]);
                        return {
                            groupId,
                            sortId: group.sortId ?? suffix ?? index,
                            name: text(group.name, fallbackGroupNames[(suffix || index + 1) - 1] || `任务组 ${index + 1}`),
                            canUpdate: group.canUpdate === true,
                            tasks: tasks.filter(task => (task.taskGroupId || 'ungrouped') === groupId)
                        };
                    }).sort((a, b) => a.sortId - b.sortId);

                    content.innerHTML = `${warnings.length ? `<aside class="misc-data-warning" role="note"><h3>部分数据不可用</h3><ul>${warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></aside>` : ''}${groups.map((group, groupIndex) => `<section class="ake-ui-section" data-section-kind="misc-task-group" aria-labelledby="contract-group-${groupIndex}"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="contract-group-${groupIndex}">${escape(group.name)} <small>${escape(group.tasks.length)} 项${group.canUpdate ? ' · 分批释出' : ''}</small></h3></header><div class="ake-ui-card-grid" data-size="regular">${group.tasks.map(task => `<article class="ake-ui-card" data-card-kind="misc-task"><header class="ake-ui-card__header">${showHidden ? `<span class="misc-task-order">${escape(task.sortId ?? '')}</span>` : ''}<div><h4 class="ake-ui-card__title">${rich(text(task.desc, showHidden ? task.taskId : '任务描述不可用'))}</h4>${releaseView(task)}</div></header>${conditionView(task)}<footer class="ake-ui-card__footer">${showHidden ? `<code>${escape(task.taskId)}</code>` : ''}${rewardView(task.rewardId)}</footer></article>`).join('')}</div></section>`).join('')}`;
                } catch (error) {
                    if (inactive()) return;
                    console.error('合约任务加载失败', error);
                    meta.textContent = '危机合约';
                    content.innerHTML = `<section class="ake-ui-state" role="alert"><h3>合约任务加载失败</h3><p>${escape(error?.message || error)}</p></section>`;
                }
            },
            destroy() {
                disposed = true;
            }
        };
    });
})();
