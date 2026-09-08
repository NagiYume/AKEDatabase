(function () {
    'use strict';

    const MODULE_ID = 'simulation_training_tasks';
    const ACTIVITY_ID = 'activity_simulation_training_1';

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

        function timeView(range, escape) {
            const open = parseGameTime(range?.openTime);
            const close = parseGameTime(range?.closeTime);
            const now = new Date();
            const format = date => new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }).format(date);
            const status = !open || !close ? '时间未知' : now < open ? '尚未开放' : now >= close ? '已结束' : '进行中';
            const interval = open && close
                ? `<time datetime="${escape(open.toISOString())}">${escape(format(open))}</time> 至 <time datetime="${escape(close.toISOString())}">${escape(format(close))}</time>`
                : '未配置活动时间';
            return { status, interval };
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
                    const [activities, taskConfigs, conditions, rewards, items, times, constants] = await Promise.all([
                        table('ActivityTable'),
                        table('ActivityConditionalMultiStageTaskConfigTable'),
                        table('ActivityConditionalMultiStageTaskCompleteConditionTable'),
                        table('RewardTable'),
                        table('ItemTable'),
                        table('TimeRangeTable'),
                        table('SimulationTrainingConst')
                    ]);
                    if (inactive()) return;

                    const activity = activities?.[ACTIVITY_ID];
                    const taskMap = taskConfigs?.[ACTIVITY_ID]?.TaskConfigMap;
                    if (!taskMap || !Object.keys(taskMap).length) {
                        const missing = !Object.keys(taskConfigs || {}).length;
                        content.innerHTML = `<section class="ake-ui-state" role="${missing ? 'alert' : 'status'}"><h3>${missing ? '任务配置表不可用' : '本期没有演武集算任务'}</h3><p>${missing ? '任务配置数据未能加载。' : '当前活动没有可展示的任务。'}</p></section>`;
                        meta.textContent = activity ? text(activity.name, '演武集算') : '演武集算';
                        return;
                    }

                    const range = times?.[activity?.timeId]?.timeRangeList?.[0] || {};
                    const activityTime = timeView(range, escape);
                    const activityName = text(activity?.name, '演武集算');
                    const playLimit = Number(constants?.playTimesLimit);
                    const rotation = Number(constants?.rotationInterval);
                    meta.innerHTML = `<dl class="misc-meta-list"><div><dt>活动</dt><dd>${escape(activityName)}</dd></div><div><dt>状态</dt><dd>${escape(activityTime.status)}</dd></div><div><dt>活动时间</dt><dd>${activityTime.interval}</dd></div><div><dt>任务数量</dt><dd>${escape(Object.keys(taskMap).length)} 项</dd></div>${Number.isFinite(playLimit) ? `<div><dt>奖励演算次数</dt><dd>每日 ${escape(playLimit)} 次</dd></div>` : ''}${Number.isFinite(rotation) ? `<div><dt>铭牌轮换间隔</dt><dd>${escape(rotation)}</dd></div>` : ''}</dl>`;

                    const warnings = [];
                    if (!activity) warnings.push('ActivityTable 中缺少活动主记录，仍按固定活动 ID 展示任务。');
                    if (!Object.keys(conditions || {}).length) warnings.push('任务条件表不可用，无法解释进度统计来源。');
                    if (!Object.keys(rewards || {}).length) warnings.push('RewardTable 不可用，奖励详情无法解析。');
                    if (!Object.keys(items || {}).length) warnings.push('ItemTable 不可用，奖励物品无法解析名称。');
                    if (!Object.keys(times || {}).length) warnings.push('TimeRangeTable 不可用，无法判断活动时间状态。');

                    function rewardView(rewardId) {
                        if (!rewardId) return '<p class="misc-reward-empty">无直接奖励</p>';
                        const reward = rewards?.[rewardId];
                        if (!reward) return `<p class="misc-reward-empty">奖励配置不可用${showHidden ? `：<code>${escape(rewardId)}</code>` : ''}</p>`;
                        const bundles = [
                            ...(reward.itemBundles || []).map(bundle => ({ ...bundle, probabilistic: false })),
                            ...(reward.probItemBundles || []).map(bundle => ({ ...bundle, probabilistic: true }))
                        ];
                        if (!bundles.length) return '<p class="misc-reward-empty">奖励包为空</p>';
                        return `<ul class="misc-reward-list" aria-label="任务奖励">${bundles.map(bundle => {
                            const item = items?.[bundle.id] || {};
                            const name = text(item.name, showHidden ? bundle.id : '未命名物品');
                            const icon = item.iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${encodeURIComponent(item.iconId)}.png` : '';
                            return `<li>${window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: bundle.id, label: name, contentHtml: `${icon ? `<img class="misc-reward-icon" src="${escape(icon)}" alt="" loading="lazy">` : ''}<span>${escape(name)}</span><strong>×${escape(bundle.count ?? '?')}</strong>${bundle.probabilistic ? '<small>概率奖励</small>' : ''}` })}</li>`;
                        }).join('')}</ul>`;
                    }

                    function conditionView(task) {
                        if (!showHidden) return '';
                        const rows = (task.completeConditionId || []).map(id => conditions?.[id]).filter(Boolean);
                        if (!rows.length) return `<p class="misc-condition-missing">条件配置不可用：${(task.completeConditionId || []).map(id => `<code>${escape(id)}</code>`).join('、') || '未引用条件'}</p>`;
                        return `<ul class="misc-condition-list">${rows.map(condition => {
                            const values = (condition.parameters || []).flatMap(parameter => parameter?.valueStringList || []).filter(Boolean);
                            const labels = {
                                4513: '玩法统计', 6071: '演武伤害统计', 6509: '数据溢出统计', 6511: '物品累计获取'
                            };
                            return `<li><span>${escape(labels[condition.conditionType] || `条件类型 ${condition.conditionType}`)}</span><strong>目标 ${escape(Number(condition.progressToCompare || 0).toLocaleString('zh-CN'))}</strong>${values.length ? `<small>${values.map(value => `<code>${escape(value)}</code>`).join(' ')}</small>` : ''}</li>`;
                        }).join('')}</ul>`;
                    }

                    function category(task) {
                        const desc = text(task.desc, task.taskId);
                        if (desc.includes('单局')) return '单局收益';
                        if (desc.includes('伤害')) return '累计伤害';
                        if (desc.includes('数据溢出')) return '数据溢出';
                        if (desc.includes('自由演算')) return '自由演算';
                        if (desc.includes('奖励演算')) return '奖励演算';
                        return '累计收益';
                    }

                    const tasks = Object.values(taskMap).sort((a, b) => (a.sortId ?? 0) - (b.sortId ?? 0) || String(a.taskId).localeCompare(String(b.taskId)));
                    const grouped = new Map();
                    tasks.forEach(task => {
                        const name = category(task);
                        if (!grouped.has(name)) grouped.set(name, []);
                        grouped.get(name).push(task);
                    });
                    const order = ['单局收益', '累计收益', '奖励演算', '自由演算', '数据溢出', '累计伤害'];
                    content.innerHTML = `${warnings.length ? `<aside class="misc-data-warning" role="note"><h3>部分数据不可用</h3><ul>${warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></aside>` : ''}${order.filter(name => grouped.has(name)).map(name => `<section class="ake-ui-section" data-section-kind="misc-task-group" aria-labelledby="simulation-${escape(name)}"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title" id="simulation-${escape(name)}">${escape(name)} <small>${escape(grouped.get(name).length)} 项</small></h3></header><div class="ake-ui-card-grid" data-size="regular">${grouped.get(name).map(task => `<article class="ake-ui-card" data-card-kind="misc-task"><header class="ake-ui-card__header">${showHidden ? `<span class="misc-task-order">${escape(task.sortId ?? '')}</span>` : ''}<h4 class="ake-ui-card__title">${rich(text(task.desc, showHidden ? task.taskId : '任务描述不可用'))}</h4></header>${conditionView(task)}<footer class="ake-ui-card__footer">${showHidden ? `<code>${escape(task.taskId)}</code>` : ''}${rewardView(task.rewardId)}</footer></article>`).join('')}</div></section>`).join('')}`;
                } catch (error) {
                    if (inactive()) return;
                    console.error('演武集算任务加载失败', error);
                    meta.textContent = '演武集算';
                    content.innerHTML = `<section class="ake-ui-state" role="alert"><h3>演武集算任务加载失败</h3><p>${escape(error?.message || error)}</p></section>`;
                }
            },
            destroy() {
                disposed = true;
            }
        };
    });
})();
