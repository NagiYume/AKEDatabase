(function () {
        const t = window.akeI18n.scope('modules.activity');
        const commonT = window.akeI18n.scope('common');
        let allActivities = [];
        let rawAllActivities = [];
        let activeActivityId = null;
        let isInitialized = false;
        let searchTerm = '';
        let selectedTagIds = new Set();
        let selectedStatus = null;
        let gachaMode = false;

        const IMAGE_BASE_PATH = '/public/images/';

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function parseText(text) {
            return window.parseText(text, IMAGE_BASE_PATH);
        }

        async function renderGachaRecords() {
            const detail = document.getElementById('activityDetail');
            const list = document.getElementById('activityList');
            if (!detail || !window.AKEV3?.table) return;
            detail.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const [chars, weapons, times] = await Promise.all([
                    window.AKEV3.table('GachaCharPoolTable'), window.AKEV3.table('GachaWeaponPoolTable'), window.AKEV3.table('TimeRangeTable')
                ]);
                const records = [];
                const add = (type, poolId, row) => {
                    const rangeId = row.clientTopTimeId || `time_${poolId}`;
                    const range = times[rangeId]?.timeRangeList?.[0]
                        || times[`time_activity_gacha_${poolId}`]?.timeRangeList?.[0]
                        || {};
                    records.push({ type, poolId, name: row.name?.text || poolId, open: range.openTime || '', close: range.closeTime || '', duration: range.openTime && range.closeTime ? Math.max(0, Math.ceil((new Date(range.closeTime) - new Date(range.openTime)) / 86400000)) : null });
                };
                Object.entries(chars || {}).forEach(([id, row]) => add(t('gacha.character', null, '角色寻访'), id, row));
                Object.entries(weapons || {}).forEach(([id, row]) => add(t('gacha.weapon', null, '武库寻访'), id, row));
                records.sort((a, b) => String(a.open).localeCompare(String(b.open)) || a.poolId.localeCompare(b.poolId));
                list.innerHTML = '';
                detail.innerHTML = `<article class="ake-ui-detail" data-detail-kind="gacha"><section class="ake-ui-section"><div class="ake-ui-section__header"><h2 class="ake-ui-section__title">${t('gachaRecords', null, '寻访记录')}</h2></div><div class="ake-ui-table-shell"><table class="ake-ui-table"><thead><tr><th>${t('gacha.type', null, '类型')}</th><th>${t('gacha.pool', null, '卡池')}</th><th>${t('gacha.start', null, '开始')}</th><th>${t('gacha.end', null, '结束')}</th><th>${t('gacha.duration', null, '持续天数')}</th></tr></thead><tbody>${records.map(row => `<tr><td>${row.type}</td><td>${row.name}</td><td>${formatTime(row.open)}</td><td>${formatTime(row.close)}</td><td>${row.duration ?? t('dates.permanent')}</td></tr>`).join('')}</tbody></table></div></section></article>`;
                const timeline = renderGachaTimeline(records);
                if (timeline) detail.querySelector('article')?.prepend(timeline);
            } catch (error) {
                detail.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: error.message })}</div>`;
            }
        }

        function getActivityStatus(openTime, closeTime) {
            const now = new Date();
            const open = openTime ? new Date(openTime) : null;
            const close = closeTime ? new Date(closeTime) : null;
            if (!close) return { text: t('statuses.permanent'), class: 'status-permanent' };
            if (close && now > close) return { text: t('statuses.closed'), class: 'status-closed' };
            if (open && now < open) return { text: t('statuses.upcoming'), class: 'status-upcoming' };
            return { text: t('statuses.active'), class: 'status-active' };
        }

        function formatTime(timeStr) {
            if (!timeStr) return t('dates.permanent');
            return timeStr.replace(/\s/g, ' ');
        }

        function getCountdownText(targetTimeStr, isEnd = false) {
            if (!targetTimeStr) return '';
            const target = new Date(targetTimeStr);
            const now = new Date();
            if (isNaN(target)) return '';
            const diff = target - now;
            if (diff <= 0) return isEnd ? t('countdown.ended') : t('countdown.started');
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (86400000)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (3600000)) / (1000 * 60));
            const parts = [];
            if (days > 0) parts.push(commonT('time.days', { count: days }));
            if (hours > 0 || days > 0) parts.push(commonT('time.hours', { count: hours }));
            parts.push(commonT('time.minutes', { count: minutes }));
            const duration = parts.join(t('countdown.unitSeparator'));
            return isEnd ? t('countdown.untilEnd', { duration }) : t('countdown.untilStart', { duration });
        }

        function filterActivities(activities) {
            return activities.filter(act => {
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const nameMatch = act.name && act.name.toLowerCase().includes(term);
                    const idMatch = act.activityId && act.activityId.toLowerCase().includes(term);
                    if (!nameMatch && !idMatch) return false;
                }
                if (selectedTagIds.size > 0 && !(act.tags || []).some(tag => selectedTagIds.has(tag.tagId))) return false;
                if (selectedStatus) {
                    const status = getActivityStatus(act.openTime, act.closeTime);
                    if (status.class !== selectedStatus) return false;
                }
                return true;
            });
        }

        function updateFilterSummary() {
            const filterPanel = document.getElementById('activityFilterBar');
            const count = selectedTagIds.size + (selectedStatus ? 1 : 0);
            window.AKEUI?.updateFilterPanel(filterPanel, {
                summary: count ? commonT('filterCount', { count }) : commonT('filter')
            });
        }

        function generateTypeButtons() {
            const container = document.getElementById('activityTypeFilter');
            if (!container) return;
            const tags = new Map();
            allActivities.forEach(activity => (activity.tags || []).forEach(tag => {
                if (!tags.has(tag.tagId)) tags.set(tag.tagId, tag);
            }));
            container.innerHTML = '';
            tags.forEach(tag => {
                const btn = window.AKEUI.filterButton({
                    label: tag.name || tag.tagId,
                    pressed: selectedTagIds.has(tag.tagId),
                    attributes: { 'data-tag-id': tag.tagId },
                    onChange: pressed => {
                        pressed ? selectedTagIds.add(tag.tagId) : selectedTagIds.delete(tag.tagId);
                        updateFilterSummary();
                        renderActivityList();
                        if (mobileOverlay?.classList.contains('is-open')) buildMobileList();
                    }
                });
                container.appendChild(btn);
            });
            updateFilterSummary();
        }

        function generateStatusButtons() {
            const container = document.getElementById('activityStatusFilter');
            if (!container) return;
            const statuses = [
                { value: null, label: commonT('all') },
                { value: 'status-active', label: t('statuses.active') },
                { value: 'status-upcoming', label: t('statuses.upcoming') },
                { value: 'status-closed', label: t('statuses.closed') },
                { value: 'status-permanent', label: t('statuses.permanent') }
            ];
            container.innerHTML = '';
            statuses.forEach(s => {
                const btn = window.AKEUI.filterButton({
                    label: s.label,
                    pressed: selectedStatus === s.value,
                    mode: 'single',
                    onChange: () => {
                        selectedStatus = s.value;
                        updateFilterSummary();
                        renderActivityList();
                        if (mobileOverlay?.classList.contains('is-open')) buildMobileList();
                    }
                });
                container.appendChild(btn);
            });
            updateFilterSummary();
        }

        async function loadActivityManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/activity/manifest.json');
                if (!res.ok) throw new Error('无法加载活动清单');
                const all = await res.json();
                rawAllActivities = all;
                let activities = showHidden ? all : all.filter(a => !a.hidden);
                activities.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return activities;
            } catch (err) {
                console.error('加载活动清单失败:', err);
                return [];
            }
        }

        const TIMELINE_DAY_MS = 24 * 60 * 60 * 1000;
        const TIMELINE_DAY_WIDTH = 28;
        const TIMELINE_WEEK_MS = 7 * TIMELINE_DAY_MS;
        const GACHA_TIMELINE_WEEK_WIDTH = 20;
        const TIMELINE_PAST_DAYS = 14;
        const TIMELINE_FUTURE_DAYS = 90;

        function getTimelineTooltip() {
            let tooltip = document.getElementById('activityTimelineTooltip');
            if (tooltip) return tooltip;
            tooltip = document.createElement('div');
            tooltip.id = 'activityTimelineTooltip';
            tooltip.className = 'activity-timeline-tooltip';
            tooltip.hidden = true;
            document.body.appendChild(tooltip);
            return tooltip;
        }

        function positionTimelineTooltip(tooltip, x, y) {
            const gap = 12;
            const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
            const maxTop = window.innerHeight - tooltip.offsetHeight - 8;
            tooltip.style.left = `${Math.max(8, Math.min(x + gap, maxLeft))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(y + gap, maxTop))}px`;
        }

        function showTimelineTooltip(item, x, y) {
            const tooltip = getTimelineTooltip();
            tooltip.textContent = `${item.name || item.activityId}\n${t('dates.range', { start: formatTime(item.openTime), end: formatTime(item.closeTime) })}`;
            tooltip.hidden = false;
            positionTimelineTooltip(tooltip, x, y);
        }

        function hideTimelineTooltip() {
            const tooltip = document.getElementById('activityTimelineTooltip');
            if (tooltip) tooltip.hidden = true;
        }

        function parseActivityTime(value) {
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }

        function startOfDay(value) {
            const date = new Date(value);
            date.setHours(0, 0, 0, 0);
            return date;
        }

        function startOfWeek(value) {
            const date = startOfDay(value);
            const mondayOffset = (date.getDay() + 6) % 7;
            date.setDate(date.getDate() - mondayOffset);
            return date;
        }

        function timelineLocale() {
            const language = window.akeData?.getLanguage?.() || 'CH';
            return { CH: 'zh-CN', TC: 'zh-TW', JP: 'ja-JP', KR: 'ko-KR', EN: 'en-US' }[language] || 'en-US';
        }

        function renderGachaTimeline(records) {
            const timed = records.map(record => ({
                record,
                open: parseActivityTime(record.open),
                close: parseActivityTime(record.close)
            })).filter(entry => entry.open && entry.close && entry.close > entry.open);
            if (!timed.length) return null;
            const rangeStart = startOfWeek(Math.min(...timed.map(entry => entry.open.getTime())));
            const rangeEnd = startOfWeek(Math.max(...timed.map(entry => entry.close.getTime())));
            rangeEnd.setDate(rangeEnd.getDate() + 7);
            const weekCount = Math.max(1, Math.ceil((rangeEnd - rangeStart) / TIMELINE_WEEK_MS));
            const section = document.createElement('section');
            section.className = 'activity-timeline';
            section.setAttribute('aria-label', t('gacha.timeline', null, '寻访时间轴'));
            section.classList.add('activity-timeline--weekly');
            section.style.setProperty('--timeline-days', weekCount);
            section.style.setProperty('--timeline-day-width', `${GACHA_TIMELINE_WEEK_WIDTH}px`);
            const viewport = document.createElement('div');
            viewport.className = 'activity-timeline__viewport';
            const canvas = document.createElement('div');
            canvas.className = 'activity-timeline__canvas';
            const axis = document.createElement('div');
            axis.className = 'activity-timeline__axis';
            const locale = timelineLocale();
            let previousMonth = -1;
            let previousYear = -1;
            for (let index = 0; index < weekCount; index += 1) {
                const date = new Date(rangeStart);
                date.setDate(date.getDate() + index * 7);
                const tick = document.createElement('div');
                tick.className = 'activity-timeline__tick';
                const isNewMonth = index === 0 || date.getMonth() !== previousMonth;
                const isNewYear = index === 0 || date.getFullYear() !== previousYear;
                if (isNewMonth) tick.classList.add('is-month-start');
                tick.textContent = new Intl.DateTimeFormat(locale, {
                    year: isNewYear ? '2-digit' : undefined,
                    month: isNewMonth ? 'numeric' : undefined,
                    day: '2-digit'
                }).format(date);
                previousMonth = date.getMonth();
                previousYear = date.getFullYear();
                axis.appendChild(tick);
            }
            canvas.appendChild(axis);
            timed.sort((a, b) => a.open - b.open || a.close - b.close).forEach(({ record, open, close }) => {
                const row = document.createElement('div');
                row.className = 'activity-timeline__row';
                const bar = document.createElement('div');
                const offsetWeeks = (open - rangeStart) / TIMELINE_WEEK_MS;
                const durationWeeks = Math.max(1 / 7, (close - open) / TIMELINE_WEEK_MS);
                const typeIndex = record.type === t('gacha.weapon', null, '武库寻访') ? 1 : 0;
                bar.className = `activity-timeline__bar activity-timeline__bar--type-${typeIndex}`;
                bar.style.left = `${offsetWeeks * GACHA_TIMELINE_WEEK_WIDTH}px`;
                bar.style.width = `${durationWeeks * GACHA_TIMELINE_WEEK_WIDTH}px`;
                const title = document.createElement('span');
                title.className = 'activity-timeline__bar-title';
                title.textContent = record.name;
                bar.appendChild(title);
                const tooltipItem = { name: record.name, activityId: record.poolId, openTime: record.open, closeTime: record.close };
                bar.addEventListener('pointerenter', event => showTimelineTooltip(tooltipItem, event.clientX, event.clientY));
                bar.addEventListener('pointermove', event => positionTimelineTooltip(getTimelineTooltip(), event.clientX, event.clientY));
                bar.addEventListener('pointerleave', hideTimelineTooltip);
                row.appendChild(bar);
                canvas.appendChild(row);
            });
            viewport.appendChild(canvas);
            section.appendChild(viewport);
            return section;
        }

        function renderActivityTimeline(items, container) {
            const now = new Date();
            const windowStart = startOfDay(now.getTime() - TIMELINE_PAST_DAYS * TIMELINE_DAY_MS);
            const windowEnd = startOfDay(now.getTime() + TIMELINE_FUTURE_DAYS * TIMELINE_DAY_MS);
            windowEnd.setDate(windowEnd.getDate() + 1);

            const timedItems = items.map(item => ({
                item,
                open: parseActivityTime(item.openTime),
                close: parseActivityTime(item.closeTime)
            })).filter(entry => entry.open && entry.close && entry.close > entry.open);
            let visibleItems = timedItems.filter(entry => entry.close > windowStart && entry.open < windowEnd);
            if (!visibleItems.length) {
                visibleItems = timedItems.sort((a, b) => b.close - a.close).slice(0, 12);
            }
            if (!visibleItems.length) return;

            visibleItems.sort((a, b) => a.open - b.open || a.close - b.close || String(a.item.name).localeCompare(String(b.item.name), timelineLocale()));
            const earliestOpen = Math.min(...visibleItems.map(entry => entry.open.getTime()));
            const latestClose = Math.max(...visibleItems.map(entry => entry.close.getTime()));
            const rangeStart = startOfDay(Math.max(earliestOpen, windowStart.getTime()));
            const rangeEnd = startOfDay(Math.min(latestClose, windowEnd.getTime()));
            rangeEnd.setDate(rangeEnd.getDate() + 1);
            const dayCount = Math.max(1, Math.ceil((rangeEnd - rangeStart) / TIMELINE_DAY_MS));

            const section = document.createElement('section');
            section.className = 'activity-timeline';
            section.setAttribute('aria-label', t('overview.title'));
            section.style.setProperty('--timeline-days', dayCount);
            section.style.setProperty('--timeline-day-width', `${TIMELINE_DAY_WIDTH}px`);

            const viewport = document.createElement('div');
            viewport.className = 'activity-timeline__viewport';
            const canvas = document.createElement('div');
            canvas.className = 'activity-timeline__canvas';

            const axis = document.createElement('div');
            axis.className = 'activity-timeline__axis';
            const locale = timelineLocale();
            for (let index = 0; index < dayCount; index += 1) {
                const date = new Date(rangeStart);
                date.setDate(date.getDate() + index);
                const tick = document.createElement('div');
                tick.className = 'activity-timeline__tick';
                if (date.getDate() === 1 || index === 0) tick.classList.add('is-month-start');
                tick.textContent = new Intl.DateTimeFormat(locale, {
                    month: date.getDate() === 1 || index === 0 ? 'numeric' : undefined,
                    day: '2-digit'
                }).format(date);
                axis.appendChild(tick);
            }
            canvas.appendChild(axis);

            visibleItems.forEach(({ item, open, close }) => {
                const row = document.createElement('div');
                row.className = 'activity-timeline__row';
                const clippedOpen = Math.max(open.getTime(), rangeStart.getTime());
                const clippedClose = Math.min(close.getTime(), rangeEnd.getTime());
                const offsetDays = Math.max(0, (clippedOpen - rangeStart) / TIMELINE_DAY_MS);
                const durationDays = Math.max(0, (clippedClose - clippedOpen) / TIMELINE_DAY_MS);
                const visibleDurationDays = Math.min(durationDays, dayCount - offsetDays);
                const bar = document.createElement('button');
                bar.type = 'button';
                const typeIndex = Math.abs(Number(item.rawType) || 0) % 5;
                const status = getActivityStatus(item.openTime, item.closeTime);
                bar.className = `activity-timeline__bar activity-timeline__bar--type-${typeIndex} ${status.class}`;
                bar.style.left = `${offsetDays * TIMELINE_DAY_WIDTH}px`;
                bar.style.width = `${visibleDurationDays * TIMELINE_DAY_WIDTH}px`;
                const title = document.createElement('span');
                title.className = 'activity-timeline__bar-title';
                title.textContent = item.name || item.activityId;
                bar.appendChild(title);
                if (item.tabImg) {
                    const image = document.createElement('img');
                    image.className = 'activity-timeline__bar-icon';
                    image.src = item.tabImg;
                    image.alt = '';
                    image.loading = 'lazy';
                    bar.appendChild(image);
                }
                bar.setAttribute('aria-label', `${item.name || item.activityId}，${t('dates.range', { start: formatTime(item.openTime), end: formatTime(item.closeTime) })}`);
                bar.addEventListener('pointerenter', event => showTimelineTooltip(item, event.clientX, event.clientY));
                bar.addEventListener('pointermove', event => positionTimelineTooltip(getTimelineTooltip(), event.clientX, event.clientY));
                bar.addEventListener('pointerleave', hideTimelineTooltip);
                bar.addEventListener('focus', () => {
                    const rect = bar.getBoundingClientRect();
                    showTimelineTooltip(item, rect.left + Math.min(rect.width, 160), rect.bottom);
                });
                bar.addEventListener('blur', hideTimelineTooltip);
                bar.addEventListener('click', () => {
                    hideTimelineTooltip();
                    activeActivityId = item.activityId;
                    renderActivityList();
                });
                row.appendChild(bar);
                canvas.appendChild(row);
            });

            if (now >= rangeStart && now <= rangeEnd) {
                const todayOffset = (now - rangeStart) / TIMELINE_DAY_MS;
                const marker = document.createElement('div');
                marker.className = 'activity-timeline__today';
                marker.style.setProperty('--today-offset', todayOffset);
                canvas.appendChild(marker);
            }

            viewport.appendChild(canvas);
            section.appendChild(viewport);
            container.querySelector('.ake-overview-heading[data-level="page"]')?.after(section);
            requestAnimationFrame(() => {
                const todayOffset = (now - rangeStart) / TIMELINE_DAY_MS;
                if (todayOffset >= 0) viewport.scrollLeft = Math.max(0, todayOffset * TIMELINE_DAY_WIDTH - viewport.clientWidth * 0.3);
            });
        }

        function renderActivityOverview(items, container) {
            const statusOrder = { 'status-active': 0, 'status-upcoming': 1, 'status-closed': 2, 'status-permanent': 3 };
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                variant: 'landscape',
                group: item => { const status = getActivityStatus(item.openTime, item.closeTime); return { id: status.class, name: status.text, order: statusOrder[status.class] }; },
                onReset: () => { activeActivityId = null; },
                afterRender: () => renderActivityTimeline(items, container),
                onSelect: item => { activeActivityId = item.activityId; renderActivityList(); },
                sidebarSelector: item => `.ake-ui-directory__item[data-activity-id="${CSS.escape(item.activityId)}"]`,
                items: items.map(item => {
                    const status = getActivityStatus(item.openTime, item.closeTime);
                    const outlines = { 'status-active': 'status-active', 'status-upcoming': 'status-upcoming', 'status-closed': 'status-closed' };
                    return { ...item, id: item.activityId, image: item.tabImg, fallback: t('overview.fallback'), outline: outlines[status.class],
                        tags: [...(item.tags || []).map(tag => tag.name || tag.tagId), item.openTime ? t('dates.opensOn', { date: item.openTime.split(' ')[0] }) : t('dates.permanentContent')] };
                })
            });
        }

        function createActivityDirectoryItem(activity, options = {}) {
            const status = getActivityStatus(activity.openTime, activity.closeTime);
            const statusKey = status.class.replace('status-', '');
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: activity.name,
                id: activity.activityId,
                background: activity.tabImg ? {
                    src: activity.tabImg,
                    alt: '',
                    className: 'activity-item__background'
                } : null,
                meta: [{ label: status.text, kind: `status-${statusKey}` }],
                accent: { type: 'status', value: statusKey },
                active: options.active,
                attributes: {
                    'data-activity-id': activity.activityId,
                    'data-content-file': activity.contentFile
                },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, activity);
            return item;
        }

        function renderActivityList() {
            const container = document.getElementById('activityList');
            const detailContainer = document.getElementById('activityDetail');
            if (!container) return;

            const filtered = filterActivities(allActivities);
            container.innerHTML = '';
            if (filtered.length === 0) {
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeActivityId = null;
                return;
            }

            filtered.forEach((act, index) => {
                const item = createActivityDirectoryItem(act, {
                    active: act.activityId === activeActivityId
                        || (index === 0 && !activeActivityId && !window.AKEModuleOverview?.isActive('activity')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, item);
                        activeActivityId = act.activityId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('activity', act.activityId);
                        loadActivityDetail(act, detailContainer);
                    }
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(c => c.activityId === window.__deepLinkId);
                if (deepItem) {
                    activeActivityId = deepItem.activityId;
                } else {
                    const existsInRaw = rawAllActivities.some(c => c.activityId === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }
            const activeExists = filtered.some(a => a.activityId === activeActivityId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('activity')) {
                    activeActivityId = null;
                    renderActivityOverview(filtered, detailContainer);
                    return;
                }
                activeActivityId = filtered[0].activityId;
                const firstItem = container.querySelector('.ake-ui-directory__item');
                if (firstItem) window.AKEUI.setDirectoryItemActive(container, firstItem);
                if (window.__akeRouter) window.__akeRouter.updateUrl('activity', activeActivityId);
                loadActivityDetail(filtered[0], detailContainer);
            } else if (activeExists) {
                const activeAct = filtered.find(a => a.activityId === activeActivityId);
                if (activeAct) {
                    const activeItem = container.querySelector(`.ake-ui-directory__item[data-activity-id="${activeActivityId}"]`);
                    if (activeItem) window.AKEUI.setDirectoryItemActive(container, activeItem);
                    if (window.__akeRouter) window.__akeRouter.updateUrl('activity', activeActivityId);
                    loadActivityDetail(activeAct, detailContainer);
                }
            }
        }

        async function loadActivityDetail(activity, container) {
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const data = await (window.akeFetch || fetch)(activity.contentFile).then(r => r.json());
                container.innerHTML = renderDetail(data, activity);
                window.AKEModuleOverview?.renderVersionDiff(container, data, data.__versionDiff?.baseline ? renderDetail(data.__versionDiff.baseline, activity) : '');
            } catch (err) {
                container.innerHTML = `<div class="ake-ui-state" data-state="error">${t('loadFailed', { message: err.message })}</div>`;
            }
        }

        function renderRewards(rewardList) {
            if (!rewardList || rewardList.length === 0) return `<p>${t('rewards.none')}</p>`;
            let html = '<div class="ake-ui-item-list">';
            rewardList.forEach(reward => {
                const iconSrc = reward.picpath || '';
                const countHtml = reward.count === null || reward.count === undefined
                    ? ''
                    : `<span class="ake-ui-item__meta">${t('rewards.count', { count: reward.count })}</span>`;
                html += `
                    <div class="ake-ui-item">
                        ${iconSrc ? `<img class="ake-ui-item__media" src="${iconSrc}" alt="">` : ''}
                        <div class="ake-ui-item__copy"><span class="ake-ui-item__title">${reward.name}</span>${countHtml}</div>
                    </div>
                `;
            });
            html += '</div>';
            return html;
        }

        function rewardGroupTitle(group, index) {
            if (group.title) return group.title;
            const titles = {
                checkin: () => t('rewards.day', { day: group.day ?? index + 1 }),
                level: () => t('rewards.level', { level: group.index ?? index + 1 }),
                task: () => t('rewards.task', { index: group.index ?? index + 1 }),
                milestone: () => t('rewards.milestoneScore', { score: group.score }),
                reflowOneTime: () => t('rewards.oneTime'),
                questionnaire: () => t('rewards.questionnaire', { index: group.index ?? index + 1 }),
                trial: () => t('rewards.trial', { index: group.index ?? index + 1 }),
                phase: () => t('rewards.phase', { index: group.index ?? index + 1 }),
                benefit: () => t('rewards.benefit', { index: group.index ?? index + 1 })
            };
            return (titles[group.kind] || titles.task)();
        }

        function renderRewardGroups(groups) {
            if (!groups || groups.length === 0) return '';
            let html = `<section class="ake-ui-section"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.rewardDetails')}</h3></header><div class="ake-ui-card-grid" data-size="regular">`;
            groups.forEach((group, index) => {
                const keyReward = group.keyReward ? `<div class="ake-ui-card__meta"><span class="ake-ui-badge">${t('rewards.keyReward')}</span></div>` : '';
                html += '<article class="ake-ui-card" data-card-kind="activity-reward" data-density="regular">' +
                    `<div class="ake-ui-card__title">${parseText(rewardGroupTitle(group, index))}</div>` +
                    (group.desc ? `<div class="ake-ui-card__body">${parseText(group.desc)}</div>` : '') +
                    keyReward +
                    '<div class="ake-ui-card__footer"><div class="stage-rewards">' +
                    `<span class="ake-ui-badge">${t('rewards.preview')}</span>` +
                    renderRewards(group.rewarddetail || []) +
                    '</div></div></article>';
            });
            html += '</div></section>';
            return html;
        }

        function renderStages(stageList) {
            if (!stageList || Object.keys(stageList).length === 0) return '';
            let html = `<section class="ake-ui-section"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.stages')}</h3></header><div class="ake-ui-card-grid" data-size="regular">`;
            const stages = Object.values(stageList);
            stages.sort((a, b) => (a.sortId || 0) - (b.sortId || 0));
            stages.forEach(function (stage) {
                let stageTimeHtml = '';
                if (stage.opentime && stage.opentime.trim() !== '') {
                    const startTimeStr = formatTime(stage.opentime);
                    const countdown = getCountdownText(stage.opentime, false);
                    const stageTime = countdown
                        ? t('dates.stageOpenTimeWithCountdown', { time: startTimeStr, countdown })
                        : t('dates.stageOpenTime', { time: startTimeStr });
                    stageTimeHtml = `<div class="ake-ui-card__meta">${stageTime}</div>`;
                }
                html += '<article class="ake-ui-card" data-card-kind="activity-stage" data-density="regular">' +
                    '<div class="ake-ui-card__title">' + stage.name + '</div>' +
                    '<div class="ake-ui-card__body">' + parseText(stage.desc || '') + '</div>' +
                    stageTimeHtml +
                    '<div class="ake-ui-card__footer"><div class="stage-rewards">' +
                    `<span class="ake-ui-badge">${t('rewards.stage')}</span>` +
                    renderRewards(stage.rewarddetail || []) +
                    '</div></div>' +
                    '</article>';
            });
            html += '</div></section>';
            return html;
        }

        function renderDetail(data, activity) {
            const status = getActivityStatus(activity.openTime, activity.closeTime);
            const openTimeStr = formatTime(activity.openTime);
            const closeTimeStr = formatTime(activity.closeTime);

            let countdownHtml = '';
            if (status.class === 'status-upcoming' && activity.openTime) {
                countdownHtml = `<span>${getCountdownText(activity.openTime, false)}</span>`;
            } else if (status.class === 'status-active' && activity.closeTime) {
                countdownHtml = `<span>${getCountdownText(activity.closeTime, true)}</span>`;
            }

            let conditionsHtml = '';
            if (data.conditions && data.conditions.length) {
                conditionsHtml = `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.conditions')}</h3></div><ul class="ake-ui-list">${data.conditions.map(c => `<li>${parseText(c)}</li>`).join('')}</ul></div>`;
            }

            let instructionHtml = '';
            if (data.instruction?.content) {
                const instructionTitle = data.instruction.title || t('sections.instructions');
                instructionHtml = `<section class="ake-ui-section"><header class="ake-ui-section__header"><h3 class="ake-ui-section__title">${parseText(instructionTitle)}</h3></header><div class="ake-ui-section__body">${parseText(data.instruction.content)}</div></section>`;
            }

            let rewardsHtml = '';
            if (data.rewarddetail && data.rewarddetail.length) {
                rewardsHtml = `<div class="ake-ui-section"><div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('rewards.activity')}</h3></div>${renderRewards(data.rewarddetail)}</div>`;
            }

            let stagesHtml = renderStages(data.stageList);
            const rewardGroupsHtml = renderRewardGroups(data.rewardGroups);
            const tagsHtml = (data.tags || []).length
                ? data.tags.map(tag => tag.name ? `<span class="ake-ui-badge">${tag.name}</span>` : '').join('')
                : '';
            const detailHeader = window.AKEUI.detailHeader({
                title: data.name || activity.name,
                badges: [{
                    label: status.text,
                    attributes: {
                        'data-accent': 'status',
                        'data-accent-value': status.class.replace('status-', '')
                    }
                }],
                content: window.AKEUI.fragment(`
                    <div class="ake-ui-detail-meta">
                        <span>${t('dates.range', { start: openTimeStr, end: closeTimeStr })}</span>
                        ${countdownHtml}
                    </div>
                    ${tagsHtml ? `<div class="ake-ui-detail-badges">${tagsHtml}</div>` : ''}
                    ${data.desc ? `<div class="ake-ui-detail-subtitle">${parseText(data.desc)}</div>` : ''}
                `)
            });

            return `
                <div class="ake-ui-detail" data-detail-kind="activity">
                    ${detailHeader?.outerHTML || ''}
                    ${instructionHtml}
                    ${conditionsHtml}
                    ${rewardsHtml}
                    ${rewardGroupsHtml}
                    ${stagesHtml}
                </div>
            `;
        }

        async function refreshModule() {
            const list = document.getElementById('activityList');
            const detail = document.getElementById('activityDetail');
            if (!list || !detail) return;
            const showHidden = getCurrentShowHidden();
            const acts = await loadActivityManifest(showHidden);
            allActivities = acts;
            generateTypeButtons();
            generateStatusButtons();
            renderActivityList();
            if (mobileOverlay?.classList.contains('is-open')) buildMobileList();
        }

        // 移动端列表
        const mobileBtn = document.getElementById('activityMobileListBtn');
        const mobileOverlay = document.getElementById('activityMobileListOverlay');
        const mobileContent = document.getElementById('activityMobileListContent');

        function buildMobileList() {
            if (!mobileContent) return;
            const filtered = filterActivities(allActivities);
            mobileContent.innerHTML = '';
            filtered.forEach(act => {
                const item = createActivityDirectoryItem(act, {
                    active: act.activityId === activeActivityId,
                    onSelect: () => {
                        activeActivityId = act.activityId;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('activity', act.activityId);
                        loadActivityDetail(act, document.getElementById('activityDetail'));
                        closeMobileList();
                        const desktopList = document.getElementById('activityList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-activity-id="${act.activityId}"]`);
                        if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                    }
                });
                mobileContent.appendChild(item);
            });
        }

        function openMobileList() {
            buildMobileList();
            if (mobileOverlay) mobileOverlay.classList.add('is-open'); mobileOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeMobileList() {
            if (mobileOverlay) mobileOverlay.classList.remove('is-open'); mobileOverlay.setAttribute('aria-hidden', 'true');
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;
            const gachaButton = document.createElement('button');
            gachaButton.type = 'button'; gachaButton.className = 'ake-ui-button'; gachaButton.textContent = t('gachaRecords', null, '寻访记录');
            gachaButton.addEventListener('click', () => { gachaMode = !gachaMode; gachaMode ? renderGachaRecords() : refreshModule(); });
            document.querySelector('#activitySearchInput')?.parentElement?.insertAdjacentElement('afterend', gachaButton);

            window.addEventListener('globalConfigChanged', (e) => {
                searchTerm = '';
                const searchInput = document.getElementById('activitySearchInput');
                if (searchInput) searchInput.value = '';
                selectedTagIds.clear();
                selectedStatus = null;
                refreshModule();
            });

            document.getElementById('activitySearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderActivityList();
                if (mobileOverlay?.classList.contains('is-open')) buildMobileList();
            });

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
                if (e.target === mobileOverlay) closeMobileList();
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
