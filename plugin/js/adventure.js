(function () {
    'use strict';
    window.AKECatalog.mount({
        id: 'adventure',
        tables: ['AdventureTaskTable', 'AdventureTaskGroupTable', 'AdventureBookStageRewardTable', 'AdventureWorldLevelTable', 'AdventureWorldLevelUnlockTaskGroupTable', 'AdventureLevelTable', 'DailyActivationRewardTable', 'DomainDataTable', 'TextTable', 'SystemJumpTable'],
        primary: ['AdventureTaskTable', 'AdventureBookStageRewardTable', 'AdventureWorldLevelTable', 'AdventureLevelTable', 'DailyActivationRewardTable'],
        build(c) {
            const T = c.tables, rows = [];
            for (const [key, row] of c.entries(T.AdventureTaskTable)) {
                const group = T.AdventureTaskGroupTable[row.belongingGroup];
                rows.push({ id: `task:${key}`, key, kind: 'task', raw: row, name: c.name(row.taskDesc, key),
                    group: group?.domainId ? c.domain(group.domainId) : c.t('handbookTasks'), search: c.t('stageValue', { value: row.adventureBookStage }), sources: [{ table: 'AdventureTaskTable', key }] });
            }
            for (const [source, kind, group, label] of [
                ['AdventureBookStageRewardTable', 'stage', 'stageRewards', 'stageValue'],
                ['AdventureWorldLevelTable', 'world', 'worldLevels', 'worldLevelValue'],
                ['AdventureLevelTable', 'level', 'adventureLevels', 'levelValue'],
                ['DailyActivationRewardTable', 'daily', 'dailyRewards', 'activationValue']
            ]) for (const [key, row] of c.entries(T[source])) rows.push({ id: `${kind}:${key}`, key, kind, raw: row,
                name: c.t(label, { value: row.adventureBookStage ?? row.level ?? row.activation ?? (/^\d+$/.test(key) ? key : c.t('unavailable')) }), group: c.t(group), sources: [{ table: source, key }] });
            return rows;
        },
        render(entry, c) {
            const T = c.tables, r = entry.raw;
            const taskLink = id => c.link('adventure', `task:${id}`, c.name(T.AdventureTaskTable[id]?.taskDesc, id));
            if (entry.kind === 'task') {
                const stage = c.entries(T.AdventureBookStageRewardTable).find(([, row]) => row.adventureBookStage === r.adventureBookStage);
                let html = c.section(c.t('objective'), c.rich(r.taskDesc), true)
                    + c.section(c.t('rewards'), c.reward(r.rewardId), true)
                    + c.section(c.t('conditions'), c.conditions(r.conditionDataList));
                if (stage) html += c.section(c.t('stageRewards'), c.link('adventure', `stage:${stage[0]}`, c.t('stageValue', { value: r.adventureBookStage })));
                const jump = T.SystemJumpTable[r.jumpSystemId];
                if (jump) html += c.section(c.t('destination'), c.rich(jump.name || jump.desc) || c.h(c.t('inGameDestination')));
                return html;
            }
            if (entry.kind === 'stage') {
                const taskIds = new Set([...(r.taskIds || []), ...c.entries(T.AdventureTaskTable).filter(([, row]) => row.adventureBookStage === r.adventureBookStage).map(([id]) => id)]);
                return c.section(c.t('rewards'), c.reward(r.rewardId), true) + c.section(c.t('handbookTasks'), c.table([c.t('objective'), c.t('rewards')], [...taskIds].map(id => {
                    if (!T.AdventureTaskTable[id]) c.issue('missing-reference', 'AdventureTaskTable', id, entry.key);
                    return [taskLink(id), c.reward(T.AdventureTaskTable[id]?.rewardId)];
                })), true);
            }
            if (entry.kind === 'world') {
                const unlock = T.AdventureWorldLevelUnlockTaskGroupTable[r.taskUnlockGroupId];
                if (r.taskUnlockGroupId && !unlock) c.issue('missing-reference', 'AdventureWorldLevelUnlockTaskGroupTable', r.taskUnlockGroupId);
                let html = c.fields(r, ['needAdventureLv', 'charMaxLv', 'monsterBaseLv']);
                const tasks = unlock?.unlockTaskInfos || [];
                html += c.section(c.t('unlockTasks'), c.table([c.t('mission'), c.t('requiredState'), c.t('option')], tasks.map((task, index) => [
                    c.link('v3_mission', task.missionId, c.t('relatedMission', { index: index + 1 })), c.number(task.missionState), c.number(task.optionId)
                ])), true);
                if (r.missionId) html += c.link('v3_mission', r.missionId, c.t('relatedMission', { index: 1 }));
                for (const [key, label] of [['levelUpTipTextIds', 'levelUpEffects'], ['levelDownTipTextIds', 'levelDownEffects']]) {
                    const tips = (r[key] || []).map(id => {
                        const row = T.TextTable[id];
                        const value = row?.text || row?.value || row;
                        if (!c.text(value)) c.issue('missing-text', 'TextTable', id, entry.key);
                        return c.rich(value) || c.h(c.t('unavailable'));
                    });
                    if (tips.length) html += c.section(c.t(label), tips.join('<br>'));
                }
                return html;
            }
            if (entry.kind === 'level') return c.fields(r, ['levelUpExp', 'nextLevelUpExp', 'raiseMaxStamina']) + c.section(c.t('rewards'), c.reward(r.rewardId), true);
            return c.fields(r, ['activation']) + c.section(c.t('rewards'), c.reward(r.rewardId), true);
        }
    });
})();
