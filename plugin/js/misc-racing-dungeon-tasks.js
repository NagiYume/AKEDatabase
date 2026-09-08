(function () {
    'use strict';

    const MODULE_ID = 'racing_dungeon_tasks';
    const ACTIVITY_ID = 'activity_racingdungeon_1';
    const FALLBACK_GAME_ID = 'indie_race001';

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
                    const [activities, racingActivities, stages, taskConfigs, conditions, milestones, rewards, items, times] = await Promise.all([
                        table('ActivityTable'),
                        table('ActivityRacingDungeonTable'),
                        table('ActivityConditionalMultiStageTable'),
                        table('ActivityConditionalMultiStageTaskConfigTable'),
                        table('ActivityConditionalMultiStageTaskCompleteConditionTable'),
                        table('ActivityRacingDungeonMilestoneTable'),
                        table('RewardTable'),
                        table('ItemTable'),
                        table('TimeRangeTable')
                    ]);
                    if (inactive()) return;

                    const activity = activities?.[ACTIVITY_ID];
                    const racing = racingActivities?.[ACTIVITY_ID]
                        || Object.values(racingActivities || {}).find(row => row?.activityId === ACTIVITY_ID)
                        || {};
                    const gameId = racing.gameId || FALLBACK_GAME_ID;
                    const taskMap = taskConfigs?.[ACTIVITY_ID]?.TaskConfigMap;
                    if (!taskMap || !Object.keys(taskMap).length) {
                        const missing = !Object.keys(taskConfigs || {}).length;
                        content.innerHTML = `<section class="ake-ui-state" role="${missing ? 'alert' : 'status'}"><h3>${missing ? '任务配置表不可用' : '本期没有奇境任务'}</h3><p>${missing ? '任务配置数据未能加载。' : '当前活动没有可展示的任务。'}</p></section>`;
                        meta.textContent = activity ? text(activity.name, '根脉奇境') : '根脉奇境';
                        return;
                    }

                    const activityRange = times?.[activity?.timeId]?.timeRangeList?.[0] || {};
                    const activityOpen = parseGameTime(activityRange.openTime);
                    const activityClose = parseGameTime(activityRange.closeTime);
                    const interval = (open, close) => open && close
                        ? `<time datetime="${escape(open.toISOString())}">${escape(formatTime(open))}</time> 至 <time datetime="${escape(close.toISOString())}">${escape(formatTime(close))}</time>`
                        : '未配置';
                    meta.innerHTML = `<dl class="misc-meta-list"><div><dt>活动</dt><dd>${escape(text(activity?.name, '根脉奇境'))}</dd></div><div><dt>状态</dt><dd>${escape(rangeState(activityOpen, activityClose))}</dd></div><div><dt>活动时间</dt><dd>${interval(activityOpen, activityClose)}</dd></div><div><dt>任务数量</dt><dd>${escape(Object.keys(taskMap).length)} 项</dd></div>${showHidden ? `<div><dt>玩法 ID</dt><dd><code>${escape(gameId)}</code></dd></div>` : ''}</dl>`;

                    const warnings = [];
                    if (!activity) warnings.push('ActivityTable 中缺少活动主记录。');
                    if (!racing.gameId) warnings.push('ActivityRacingDungeonTable 不可用，当前使用已知玩法 ID。');
                    if (!stages?.[ACTIVITY_ID]?.stageList) warnings.push('本活动的阶段记录不可用，将按任务释出时间分组。');
                    if (!Object.keys(conditions || {}).length) warnings.push('任务条件表不可用，无法解释房间、通路与残块目标。');
                    if (!milestones?.[ACTIVITY_ID]?.milestoneMap) warnings.push('本活动的根脉历程里程碑记录不可用。');
                    if (!Object.keys(rewards || {}).length) warnings.push('奖励表不可用，奖励详情无法解析。');
                    if (!Object.keys(items || {}).length) warnings.push('物品表不可用，奖励物品无法解析名称。');
                    if (!Object.keys(times || {}).length) warnings.push('时间表不可用，无法判断阶段状态。');

                    function rewardItems(rewardId) {
                        const reward = rewards?.[rewardId];
                        if (!reward) return [];
                        return [
                            ...(reward.itemBundles || []).map(bundle => ({ ...bundle, probabilistic: false })),
                            ...(reward.probItemBundles || []).map(bundle => ({ ...bundle, probabilistic: true }))
                        ];
                    }

                    function rewardView(rewardId) {
                        if (!rewardId) return '<p class="misc-reward-empty">无直接奖励</p>';
                        const bundles = rewardItems(rewardId);
                        if (!rewards?.[rewardId]) return `<p class="misc-reward-empty">奖励配置不可用${showHidden ? `：<code>${escape(rewardId)}</code>` : ''}</p>`;
                        return bundles.length ? `<ul class="misc-reward-list" aria-label="奖励">${bundles.map(bundle => {
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
                        const labels = {
                            4513: '累计交互', 5942: '单次探索残块', 5943: '单个房间残块', 5944: '指定房间或通路', 14002: '单个通路残块'
                        };
                        return `<ul class="misc-condition-list">${rows.map(condition => {
                            const values = (condition.parameters || []).flatMap(parameter => parameter?.valueStringList || []).filter(Boolean);
                            return `<li><span>${escape(labels[condition.conditionType] || `条件类型 ${condition.conditionType}`)}</span><strong>目标 ${escape(Number(condition.progressToCompare || 0).toLocaleString('zh-CN'))}</strong>${values.length ? `<small>${values.map(value => `<code>${escape(value)}</code>`).join(' ')}</small>` : ''}</li>`;
                        }).join('')}</ul>`;
                    }

                    const tasks = Object.values(taskMap).sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0) || String(a.taskId).localeCompare(String(b.taskId)));
                    const stageList = stages?.[ACTIVITY_ID]?.stageList || {};
                    const stageByTime = new Map(Object.values(stageList).map(stage => [stage.timeId, stage]));
                    const phaseIds = Array.from(new Set(tasks.map(task => task.unlockTimeId || 'unknown')));
                    const phases = phaseIds.map((timeId, index) => {
                        const stage = stageByTime.get(timeId) || {};
                        const range = times?.[timeId]?.timeRangeList?.[0] || {};
                        const open = parseGameTime(range.openTime);
                        const close = parseGameTime(range.closeTime);
                        return {
                            timeId,
                            stageId: stage.stageId || Object.keys(stageList).find(id => stageList[id]?.timeId === timeId) || '',
                            sortId: stage.sortId ?? index + 1,
                            open,
                            close,
                            tasks: tasks.filter(task => (task.unlockTimeId || 'unknown') === timeId)
                        };
                    }).sort((a, b) => a.sortId - b.sortId);

                    const milestoneMap = milestones?.[ACTIVITY_ID]?.milestoneMap || {};
                    const milestoneRows = Object.values(milestoneMap).sort((a, b) => (a.completeScore ?? 0) - (b.completeScore ?? 0));
                    const milestoneHtml = milestoneRows.length ? `<section class="ake-ui-section" data-section-kind="misc-milestone" aria-labelledby="racing-milestones"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="racing-milestones">根脉历程 <small>${escape(milestoneRows.length)} 档</small></h3></header><ol class="misc-milestone-track">${milestoneRows.map(node => `<li class="${node.isBig ? 'is-major' : ''}"><header><strong>${escape(Number(node.completeScore || 0).toLocaleString('zh-CN'))} 积分</strong></header>${showHidden ? `<p>${escape(node.unlockStageId || '未绑定阶段')}</p>` : ''}${rewardView(node.rewardId)}</li>`).join('')}</ol></section>` : `<section class="ake-ui-state" role="note"><h3>根脉历程不可用</h3><p>${Object.keys(milestones || {}).length ? '本活动没有里程碑记录。' : '里程碑配置未能加载。'}</p></section>`;

                    content.innerHTML = `${warnings.length ? `<aside class="misc-data-warning" role="note"><h3>部分数据不可用</h3><ul>${warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></aside>` : ''}${phases.map((phase, index) => `<section class="ake-ui-section" data-section-kind="misc-task-group" aria-labelledby="racing-phase-${index}"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="racing-phase-${index}">阶段 ${escape(phase.sortId)} <small>${escape(phase.tasks.length)} 项 · ${escape(rangeState(phase.open, phase.close))}</small></h3></header><p class="misc-stage-time">${interval(phase.open, phase.close)}${showHidden && phase.stageId ? ` · <code>${escape(phase.stageId)}</code>` : ''}</p><div class="ake-ui-card-grid" data-size="regular">${phase.tasks.map(task => `<article class="ake-ui-card" data-card-kind="misc-task"><header class="ake-ui-card__header">${showHidden ? `<span class="misc-task-order">${escape(task.sortId ?? '')}</span>` : ''}<h4 class="ake-ui-card__title">${rich(text(task.desc, showHidden ? task.taskId : '任务描述不可用'))}</h4></header>${conditionView(task)}<footer class="ake-ui-card__footer">${showHidden ? `<code>${escape(task.taskId)}</code>` : ''}${rewardView(task.rewardId)}</footer></article>`).join('')}</div></section>`).join('')}${milestoneHtml}`;
                } catch (error) {
                    if (inactive()) return;
                    console.error('奇境任务加载失败', error);
                    meta.textContent = '根脉奇境';
                    content.innerHTML = `<section class="ake-ui-state" role="alert"><h3>奇境任务加载失败</h3><p>${escape(error?.message || error)}</p></section>`;
                }
            },
            destroy() {
                disposed = true;
            }
        };
    });
})();
