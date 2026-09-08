(function () {
    'use strict';

    const MODULE_ID = 'takestwo_completion_tasks';
    const ACTIVITY_ID = 'activity_takestwo_1';
    const KNOWN_NORMAL_DUNGEONS = Array.from({ length: 8 }, (_, index) => `dung01_takestwo${String(index + 1).padStart(3, '0')}`);

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
                    const [activities, stages, stageConditions, taskConfigs, taskConditions, dungeons, rewards, items, times] = await Promise.all([
                        table('ActivityTable'),
                        table('ActivityConditionalMultiStageTable'),
                        table('ActivityConditionalMultiStageCompleteConditionTable'),
                        table('ActivityConditionalMultiStageTaskConfigTable'),
                        table('ActivityConditionalMultiStageTaskCompleteConditionTable'),
                        table('DungeonTable'),
                        table('RewardTable'),
                        table('ItemTable'),
                        table('TimeRangeTable')
                    ]);
                    if (inactive()) return;

                    const activity = activities?.[ACTIVITY_ID];
                    const taskMap = taskConfigs?.[ACTIVITY_ID]?.TaskConfigMap;
                    if (!taskMap || !Object.keys(taskMap).length) {
                        const missing = !Object.keys(taskConfigs || {}).length;
                        content.innerHTML = `<section class="ake-ui-state" role="${missing ? 'alert' : 'status'}"><h3>${missing ? '任务配置表不可用' : '本期没有完成度任务'}</h3><p>${missing ? '任务配置数据未能加载。' : '当前活动没有可展示的任务。'}</p></section>`;
                        meta.textContent = activity ? text(activity.name, '炽燃！竞技大会！') : '炽燃！竞技大会！';
                        return;
                    }

                    const activityRange = times?.[activity?.timeId]?.timeRangeList?.[0] || {};
                    const activityOpen = parseGameTime(activityRange.openTime);
                    const activityClose = parseGameTime(activityRange.closeTime);
                    const interval = (open, close) => open && close
                        ? `<time datetime="${escape(open.toISOString())}">${escape(formatTime(open))}</time> 至 <time datetime="${escape(close.toISOString())}">${escape(formatTime(close))}</time>`
                        : '未配置';
                    meta.innerHTML = `<dl class="misc-meta-list"><div><dt>活动</dt><dd>${escape(text(activity?.name, '炽燃！竞技大会！'))}</dd></div><div><dt>状态</dt><dd>${escape(rangeState(activityOpen, activityClose))}</dd></div><div><dt>活动时间</dt><dd>${interval(activityOpen, activityClose)}</dd></div><div><dt>任务数量</dt><dd>${escape(Object.keys(taskMap).length)} 项</dd></div></dl>`;

                    const warnings = [];
                    if (!activity) warnings.push('ActivityTable 中缺少活动主记录。');
                    if (!stages?.[ACTIVITY_ID]?.stageList) warnings.push('本活动的阶段记录不可用，无法显示关卡开放阶段。');
                    if (!Object.keys(stageConditions || {}).length) warnings.push('阶段完成条件表不可用，将从任务条件使用已知的 8 个普通关卡。');
                    if (!Object.keys(taskConditions || {}).length) warnings.push('任务条件表不可用，无法验证 4/8 完成度阈值。');
                    if (!Object.keys(dungeons || {}).length) warnings.push('副本表不可用，赛事仅显示关卡 ID。');
                    if (!Object.keys(rewards || {}).length) warnings.push('奖励表不可用，奖励详情无法解析。');
                    if (!Object.keys(items || {}).length) warnings.push('物品表不可用，奖励物品无法解析名称。');
                    if (!Object.keys(times || {}).length) warnings.push('时间表不可用，无法判断活动与阶段状态。');

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

                    const taskRows = Object.values(taskMap).sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0));
                    const completionTasks = taskRows.map(task => {
                        const rows = (task.completeConditionId || []).map(id => taskConditions?.[id]).filter(Boolean);
                        const condition = rows[0];
                        const ids = (condition?.parameters || []).flatMap(parameter => parameter?.valueStringList || []).filter(id => !id.endsWith('_hard'));
                        return {
                            ...task,
                            condition,
                            target: Number(condition?.progressToCompare || 0),
                            dungeonIds: ids
                        };
                    });
                    const configuredDungeonIds = completionTasks.flatMap(task => task.dungeonIds);
                    const normalDungeonIds = Array.from(new Set(configuredDungeonIds.length ? configuredDungeonIds : KNOWN_NORMAL_DUNGEONS));

                    const stageList = stages?.[ACTIVITY_ID]?.stageList || {};
                    const stageDetails = Object.entries(stageList).map(([stageId, stage]) => {
                        const completionRows = stageConditions?.[stageId]?.conditionList || [];
                        const allIds = completionRows.flatMap(condition => (condition.parameters || []).flatMap(parameter => parameter?.valueStringList || []));
                        const range = times?.[stage.timeId]?.timeRangeList?.[0] || {};
                        return {
                            stageId,
                            sortId: stage.sortId ?? 0,
                            normalIds: allIds.filter(id => !id.endsWith('_hard')),
                            hardIds: allIds.filter(id => id.endsWith('_hard')),
                            open: parseGameTime(range.openTime),
                            close: parseGameTime(range.closeTime)
                        };
                    }).sort((a, b) => a.sortId - b.sortId);
                    const stageByDungeon = new Map();
                    stageDetails.forEach(stage => stage.normalIds.forEach(id => stageByDungeon.set(id, stage)));

                    function dungeonName(id, index) {
                        const dungeon = dungeons?.[id] || {};
                        return text(dungeon.dungeonName || dungeon.name, showHidden ? id : `赛事项目 ${index + 1}`);
                    }

                    const eventGrid = normalDungeonIds.map((id, index) => {
                        const stage = stageByDungeon.get(id);
                        const hardId = `${id}_hard`;
                        const hasHard = stage?.hardIds.includes(hardId) || Boolean(dungeons?.[hardId]);
                        return `<li><article class="ake-ui-card" data-card-kind="misc-event"><header class="ake-ui-card__header"><span class="misc-task-order">${escape(index + 1)}</span><div><h4 class="ake-ui-card__title">${escape(dungeonName(id, index))}</h4>${showHidden ? `<code>${escape(id)}</code>` : ''}</div></header><dl><div><dt>开放阶段</dt><dd>${stage ? `阶段 ${escape(stage.sortId)}` : '未知'}</dd></div><div><dt>阶段状态</dt><dd>${stage ? escape(rangeState(stage.open, stage.close)) : '时间未知'}</dd></div><div><dt>全功率模式</dt><dd>${hasHard ? '有' : '未找到配置'}</dd></div></dl>${stage?.open ? `<p><time datetime="${escape(stage.open.toISOString())}">${escape(formatTime(stage.open))}</time> 开放</p>` : ''}</article></li>`;
                    }).join('');

                    const thresholdHtml = completionTasks.length ? `<section class="ake-ui-section" data-section-kind="misc-completion" aria-labelledby="takestwo-thresholds"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="takestwo-thresholds">完成度奖励节点</h3></header><ol class="misc-completion-track">${completionTasks.map(task => `<li><article class="ake-ui-card" data-card-kind="misc-task"><header class="ake-ui-card__header">${showHidden ? `<span class="misc-task-order">${escape(task.sortId ?? '')}</span>` : ''}<div><h4 class="ake-ui-card__title">${rich(text(task.desc, showHidden ? task.taskId : '任务描述不可用'))}</h4>${showHidden ? `<p>${task.target ? `完成 ${escape(task.target)} / ${escape(normalDungeonIds.length)} 个普通关卡` : '完成目标未能解析'}</p>` : ''}</div></header>${showHidden ? (task.condition ? `<ul class="misc-condition-list"><li><span>不同普通关卡完成数</span><strong>目标 ${escape(task.target)}</strong><small>条件类型 ${escape(task.condition.conditionType)}</small></li></ul>` : `<p class="misc-condition-missing">条件配置不可用：${(task.completeConditionId || []).map(id => `<code>${escape(id)}</code>`).join('、')}</p>`) : ''}<footer class="ake-ui-card__footer">${showHidden ? `<code>${escape(task.taskId)}</code>` : ''}${rewardView(task.rewardId)}</footer></article></li>`).join('')}</ol></section>` : '<section class="ake-ui-state" role="status"><h3>没有完成度奖励节点</h3><p>活动任务配置为空。</p></section>';

                    const stagesHtml = showHidden && stageDetails.length ? `<details class="misc-stage-details"><summary>查看 ${escape(stageDetails.length)} 个开放阶段</summary><ol>${stageDetails.map(stage => `<li><strong>阶段 ${escape(stage.sortId)}</strong> <code>${escape(stage.stageId)}</code><span>${escape(stage.normalIds.length)} 个普通关卡${stage.hardIds.length ? `，${escape(stage.hardIds.length)} 个全功率关卡` : ''}</span><small>${interval(stage.open, stage.close)}</small></li>`).join('')}</ol></details>` : '';
                    content.innerHTML = `${warnings.length ? `<aside class="misc-data-warning" role="note"><h3>部分数据不可用</h3><ul>${warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></aside>` : ''}<section class="misc-event-section" aria-labelledby="takestwo-events"><h3 id="takestwo-events">赛事项目 <small>${escape(normalDungeonIds.length)} 项</small></h3><ol class="misc-event-grid">${eventGrid}</ol>${stagesHtml}</section>${thresholdHtml}`;
                } catch (error) {
                    if (inactive()) return;
                    console.error('竞技大会完成度任务加载失败', error);
                    meta.textContent = '炽燃！竞技大会！';
                    content.innerHTML = `<section class="ake-ui-state" role="alert"><h3>竞技大会完成度加载失败</h3><p>${escape(error?.message || error)}</p></section>`;
                }
            },
            destroy() {
                disposed = true;
            }
        };
    });
})();
