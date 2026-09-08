(function () {
    'use strict';

    const MODULE_ID = 'weekly_tasks';
    const ACTIVITY_ID = 'activity_weekly_task_1';
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    window.AKEMisc.register(MODULE_ID, async function (context) {
        const root = context.root;
        const t = (key, params, fallback) => window.akeI18n?.t(`modules.misc.weeklyTasks.${key}`, params, fallback) || fallback || key;
        const status = root.querySelector('#miscWeeklyStatus');
        const select = root.querySelector('#miscWeeklySelect');
        const previous = root.querySelector('#miscWeeklyPrevious');
        const next = root.querySelector('#miscWeeklyNext');
        const current = root.querySelector('#miscWeeklyCurrent');
        const milestonesRoot = root.querySelector('#miscWeeklyMilestones');
        const tasksRoot = root.querySelector('#miscWeeklyTasks');
        const countRoot = root.querySelector('#miscWeeklyCount');
        let selectedWeek = 1;
        let currentWeek = 1;
        let maximumWeek = 1;
        let openedAt = null;
        let weeklyRows = [];
        let milestoneRow = {};
        let rewards = {};
        let items = {};

        const escape = context.escapeHtml;
        const text = (value, fallback) => context.text(value, fallback) || fallback || '';

        function showHidden() {
            return window.akeData?.getConfig?.().showHidden === true;
        }

        function parseGameTime(value) {
            const match = String(value || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
            if (!match) return null;
            const [, year, month, day, hour, minute, second] = match.map(Number);
            return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
        }

        function formatDate(date) {
            if (!date || Number.isNaN(date.getTime())) return t('unknownTime', null, '时间未知');
            return new Intl.DateTimeFormat(window.akeI18n?.getLanguageInfo?.().htmlLang || 'zh-CN', {
                timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }).format(date);
        }

        function formatDuration(milliseconds) {
            const minutes = Math.max(0, Math.floor(milliseconds / 60000));
            const days = Math.floor(minutes / 1440);
            const hours = Math.floor((minutes % 1440) / 60);
            const mins = minutes % 60;
            return [days ? t('durationDays', { count: days }, `${days}天`) : '', hours ? t('durationHours', { count: hours }, `${hours}小时`) : '', (!days && mins) ? t('durationMinutes', { count: mins }, `${mins}分`) : ''].filter(Boolean).join(' ');
        }

        function rewardBundles(rewardId) {
            const reward = rewards[rewardId] || {};
            return [...(reward.itemBundles || []), ...(reward.probItemBundles || [])];
        }

        function renderReward(rewardId) {
            const bundles = rewardBundles(rewardId);
            if (!bundles.length) return `<span class="misc-task-chip">${escape(showHidden() && rewardId ? rewardId : t(rewardId ? 'rewardUnavailable' : 'noReward', null, rewardId ? '奖励配置不可用' : '无奖励'))}</span>`;
            return bundles.map(bundle => {
                const item = items[bundle.id] || {};
                const name = text(item.name, showHidden() ? bundle.id : t('unnamedItem', null, '未命名物品'));
                const icon = item.iconId || (showHidden() ? bundle.id : '');
                return window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: bundle.id, label: name, className: 'misc-reward', title: showHidden() ? bundle.id : '', contentHtml: `${icon ? `<img src="/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${escape(icon)}.png" alt="">` : ''}<span>${escape(name)}</span><b>x${Number(bundle.count || 0).toLocaleString()}</b>` });
            }).join('');
        }

        function displayTarget(task) {
            const value = Number(task.progressToCompare || 0) * Number(task.displayFactor == null ? 1 : task.displayFactor);
            return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
        }

        function taskDescription(task) {
            const target = displayTarget(task);
            const raw = text(task.desc, showHidden() ? task.taskId : t('unnamedTask', null, '任务描述不可用'));
            let used = false;
            const formatted = raw.replace(/%[-+0-9.]*[dfs]/g, () => {
                if (used) return target;
                used = true;
                return target;
            });
            return context.parseText(formatted || (showHidden() ? task.taskId : t('unnamedTask', null, '任务描述不可用')));
        }

        function updateStatus() {
            if (!openedAt) {
                status.innerHTML = `<span class="misc-task-chip">${escape(t('scheduleUnavailable', null, '未找到周期时间'))}</span>`;
                return;
            }
            const now = Date.now();
            const nextReset = new Date(openedAt.getTime() + Math.max(1, currentWeek) * WEEK_MS);
            const beforeOpen = now < openedAt.getTime();
            status.innerHTML = `
                <span class="misc-task-chip ${beforeOpen ? 'is-upcoming' : 'is-active'}">${escape(beforeOpen ? t('notStarted', null, '尚未开放') : t('activeWeek', { week: currentWeek }, `当前第 ${currentWeek} 周`))}</span>
                <span class="misc-task-status__time">${escape(beforeOpen ? t('opensAt', { time: formatDate(openedAt) }, `${formatDate(openedAt)} 开放`) : t('nextReset', { time: formatDate(nextReset), remaining: formatDuration(nextReset.getTime() - now) }, `${formatDate(nextReset)} 切换`))}</span>`;
        }

        function renderMilestones() {
            const entries = Object.entries(milestoneRow.mileStones || {}).sort((a, b) => Number(a[1].score || 0) - Number(b[1].score || 0));
            milestonesRoot.innerHTML = entries.length ? entries.map(([id, milestone]) => `
                <article class="misc-milestone"${showHidden() ? ` title="${escape(id)}"` : ''}>
                    <span class="misc-milestone__score">${escape(t('points', { count: milestone.score }, `${milestone.score} 分`))}</span>
                    <div class="misc-task-rewards">${renderReward(milestone.rewardId)}</div>
                </article>`).join('') : `<div class="misc-task-empty">${escape(t('noMilestones', null, '没有里程碑配置'))}</div>`;
        }

        function renderTasks() {
            const rows = weeklyRows.filter(task => Number((String(task.taskId).match(/^week(\d+)_/) || [])[1]) === selectedWeek)
                .sort((a, b) => Number(a.sortId || 0) - Number(b.sortId || 0));
            const totalScore = rows.reduce((sum, task) => sum + Number(task.score || 0), 0);
            countRoot.textContent = t('taskCount', { count: rows.length, score: totalScore }, `${rows.length} 项 · 可得 ${totalScore} 分`);
            if (!rows.length) {
                tasksRoot.innerHTML = `<div class="ake-ui-state" data-state="empty" data-density="compact">${escape(t('noTasks', null, '该周没有任务配置'))}</div>`;
                return;
            }
            tasksRoot.innerHTML = rows.map(task => `
                <article class="ake-ui-card ${Number(task.score || 0) >= 5 ? 'is-featured' : ''}" data-card-kind="misc-task"${showHidden() ? ` data-task-id="${escape(task.taskId)}"` : ''}>
                    <div class="ake-ui-card__badges">
                        <span class="ake-ui-badge">${escape(t('points', { count: task.score }, `${task.score} 分`))}</span>
                        ${showHidden() ? `<span>${escape(task.taskId)}</span>` : ''}
                    </div>
                    <div class="ake-ui-card__body">${taskDescription(task)}</div>
                    <footer class="ake-ui-card__footer">
                        <span>${escape(t('target', { value: displayTarget(task) }, `目标 ${displayTarget(task)}`))}</span>
                        ${showHidden() && task.jumpId ? `<code>${escape(task.jumpId)}</code>` : ''}
                    </footer>
                </article>`).join('');
        }

        function setSelectedWeek(week, navigate) {
            selectedWeek = Math.min(maximumWeek, Math.max(1, Number(week) || 1));
            select.value = String(selectedWeek);
            previous.disabled = selectedWeek <= 1;
            next.disabled = selectedWeek >= maximumWeek;
            renderTasks();
            if (navigate) context.navigate(`week${selectedWeek}`);
        }

        try {
            const [tasks, milestones, activities, timeRanges, rewardTable, itemTable] = await Promise.all([
                context.table('ActivityWeeklyTaskTable'),
                context.table('ActivityWeeklyTaskMileStoneTable'),
                context.table('ActivityTable'),
                context.table('TimeRangeTable'),
                context.table('RewardTable'),
                context.table('ItemTable')
            ]);
            if (context.signal.aborted) return;
            weeklyRows = Object.values(tasks || {}).filter(row => row.activityId === ACTIVITY_ID);
            milestoneRow = milestones?.[ACTIVITY_ID] || {};
            rewards = rewardTable || {};
            items = itemTable || {};
            maximumWeek = Math.max(1, ...weeklyRows.map(row => Number((String(row.taskId).match(/^week(\d+)_/) || [])[1]) || 0));
            const activity = activities?.[ACTIVITY_ID] || {};
            const range = timeRanges?.[activity.timeId]?.timeRangeList?.[0];
            openedAt = parseGameTime(range?.openTime);
            currentWeek = openedAt ? Math.max(1, Math.floor((Date.now() - openedAt.getTime()) / WEEK_MS) + 1) : 1;
            currentWeek = Math.min(maximumWeek, currentWeek);
            select.innerHTML = Array.from({ length: maximumWeek }, (_, index) => `<option value="${index + 1}">${escape(t('weekOption', { week: index + 1 }, `第 ${index + 1} 周`))}</option>`).join('');
            const deepLinkWeek = Number((String(context.routeId || '').match(/^week(\d+)$/) || [])[1]);
            setSelectedWeek(deepLinkWeek || currentWeek, false);
            renderMilestones();
            updateStatus();
            context.setInterval(updateStatus, 60000);
            context.on(select, 'change', () => setSelectedWeek(select.value, true));
            context.on(previous, 'click', () => setSelectedWeek(selectedWeek - 1, true));
            context.on(next, 'click', () => setSelectedWeek(selectedWeek + 1, true));
            context.on(current, 'click', () => setSelectedWeek(currentWeek, true));
        } catch (error) {
            if (!context.signal.aborted) tasksRoot.innerHTML = `<div class="misc-task-error">${escape(t('loadFailed', { message: error.message }, `读取失败：${error.message}`))}</div>`;
        }

        return {};
    });
})();
