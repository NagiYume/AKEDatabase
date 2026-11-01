(function () {
    'use strict';

    const root = document.getElementById('missionModule');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const TYPE_DEFS = {
        0: { name: '主线', enumName: 'Main', view: 'main' },
        1: { name: '角色任务', enumName: 'Char', view: 'side' },
        2: { name: '探索任务', enumName: 'Factory', view: 'discovery' },
        4: { name: '隐藏任务', enumName: 'Hide', view: 'other' },
        5: { name: '杂项任务', enumName: 'Misc', view: 'other' },
        7: { name: '世界任务', enumName: 'World', view: 'discovery' },
        8: { name: '战争回响内部任务', enumName: 'WeekRaid', view: 'other' },
        9: { name: '伪主线', enumName: 'FakeMain', view: 'main' },
        10: { name: '支线', enumName: 'Side', view: 'side' },
        11: { name: '活动任务', enumName: 'Activity', view: 'activity' },
        12: { name: '待开放主线', enumName: 'TBCMain', view: 'main' }
    };
    const TYPE_IDS_BY_ENUM = Object.fromEntries(
        Object.entries(TYPE_DEFS).map(([id, definition]) => [definition.enumName, Number(id)])
    );
    const IMPORTANCE = { 1: '高', 2: '中', 3: '低', High: '高', Mid: '中', Low: '低' };
    const IMPORTANCE_LEVEL = { 1: '1', 2: '2', 3: '3', High: '1', Mid: '2', Low: '3' };
    const QUEST_TYPES = { 0: '普通', 1: '阻断', 2: '可选' };
    const TABLE_NAMES = {
        auxiliary: ['RewardTable', 'ItemTable', 'LevelDescTable', 'CharacterTable', 'MissionExtraInfoTable', 'EnemyTemplateDisplayInfoTable'],
        dialogue: ['DialogTextTable', 'DialogOptionTable', 'DialogSummaryTable', 'SNSDialogTable', 'SNSDialogOptionTable', 'SNSChatTable', 'NpcTable', 'CharacterTable', 'RadioTable']
    };
    const PLAY_DIALOG_ACTIONS = new Set([
        'StartDialogAction',
        'StartDialogAndTeleportAction',
        'PlayDialogAndHideSceneObjectAction'
    ]);

    const state = {
        manifest: [],
        missionEntries: new Map(),
        metaEntries: new Map(),
        missionCache: new Map(),
        metaCache: new Map(),
        stats: { missionCount: 0, metaCount: 0, questCount: 0, objectiveCount: 0 },
        typeInfo: {},
        textTable: {},
        rows: [],
        selectedId: null,
        search: '',
        type: 'all',
        chapter: 'all',
        showHidden: window.akeData?.getConfig?.().showHidden === true,
        auxiliary: new Map(),
        dialogue: new Map(),
        avatarCache: new Map(),
        dialogueChoices: new Map(),
        levelScriptScenes: new Map(),
        missionScriptCache: new Map(),
        missionOwnedScripts: new Map(),
        levelDataScenes: new Map(),
        spawnerConfigs: new Map(),
        renderToken: 0
    };

    const elements = {
        search: document.getElementById('missionSearchInput'),
        filterPanel: document.getElementById('missionFilterBar'),
        type: document.getElementById('missionTypeFilter'),
        chapter: document.getElementById('missionChapterFilter'),
        hidden: document.getElementById('missionHiddenToggle'),
        summary: document.getElementById('missionListSummary'),
        list: document.getElementById('missionList'),
        detail: document.getElementById('missionDetail'),
        home: document.getElementById('missionHomeButton'),
        mobile: document.getElementById('missionMobileListButton'),
        backdrop: document.getElementById('missionMobileBackdrop')
    };

    function updateFilterSummary() {
        const count = Number(state.type !== 'all') + Number(state.chapter !== 'all') + Number(state.showHidden);
        window.AKEUI?.updateFilterPanel(elements.filterPanel, {
            summary: count ? `筛选 (${count})` : '筛选'
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function richText(value) {
        const text = String(value || '');
        return window.parseText ? window.parseText(text, '/public/images/') : escapeHtml(text);
    }

    function shortType(value) {
        return String(value || '').replace(/,.*$/, '').replace(/^Beyond\.Gameplay\./, '') || 'Unknown';
    }

    function naturalCompare(a, b) {
        return String(a || '').localeCompare(String(b || ''), 'en', { numeric: true, sensitivity: 'base' });
    }

    function textByKey(key, table = state.textTable, fallback = '') {
        if (!key) return fallback;
        return table?.[key]?.text || fallback || key;
    }

    function typeDefinition(type) {
        const base = TYPE_DEFS[type] || { name: `类型 ${type}`, enumName: `Type${type}`, view: 'other' };
        const config = state.typeInfo?.[type] || {};
        const viewNames = { 0: 'main', 1: 'discovery', 2: 'side', 3: 'activity', 4: 'other' };
        return {
            ...base,
            view: viewNames[config.missionViewType] || base.view,
            visible: config.isVisible !== undefined ? Boolean(config.isVisible) : type !== 4 && type !== 8,
            priority: Number(config.typePriority ?? 0)
        };
    }

    function missionTypeId(value) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
        return TYPE_IDS_BY_ENUM[String(value || '')] ?? -1;
    }

    function chapterName(value) {
        if (Number(value) === 1) return '第一章';
        if (Number(value) === 2) return '第二章';
        if (Number(value) === 4) return '独立章节';
        return '未分章';
    }

    function questEntries(mission) {
        const entries = Object.entries(mission?.questDic || {}).map(([id, quest]) => ({ id, ...quest }));
        const byId = new Map(entries.map(entry => [entry.id, entry]));
        const indegree = new Map(entries.map(entry => [entry.id, 0]));
        const next = new Map(entries.map(entry => [entry.id, []]));
        entries.forEach(entry => (entry.prevQuestIdList || []).forEach(previous => {
            if (!byId.has(previous)) return;
            indegree.set(entry.id, (indegree.get(entry.id) || 0) + 1);
            next.get(previous).push(entry.id);
        }));
        const sortQueue = queue => queue.sort((a, b) => (a.flowIndex || 0) - (b.flowIndex || 0) || naturalCompare(a.id, b.id));
        const queue = sortQueue(entries.filter(entry => indegree.get(entry.id) === 0));
        const result = [];
        while (queue.length) {
            const entry = queue.shift();
            result.push(entry);
            (next.get(entry.id) || []).forEach(id => {
                indegree.set(id, indegree.get(id) - 1);
                if (indegree.get(id) === 0) queue.push(byId.get(id));
            });
            sortQueue(queue);
        }
        entries.filter(entry => !result.includes(entry)).sort((a, b) => naturalCompare(a.id, b.id)).forEach(entry => result.push(entry));
        return result;
    }

    function mainPathQuestEntries(mission) {
        const quests = mission?.questDic || {};
        const path = (mission?.mainPathQuests || []).filter(id => quests[id]).map(id => ({ id, ...quests[id] }));
        return path.length ? path : questEntries(mission);
    }

    function questFlow(mission) {
        const path = mainPathQuestEntries(mission);
        const pathIds = new Set(path.map(quest => quest.id));
        let segments = [];
        let current = null;
        let gap = [];
        path.forEach(quest => {
            if (!(quest.objectiveList || []).length) {
                current = null;
                gap.push(quest);
                return;
            }
            quest.objectiveList.forEach((objective, index) => {
                const key = objective.description?.key || `${quest.id}:${index}`;
                if (!current || current.key !== key) {
                    current = { key, objectives: [], quests: [], gapBefore: gap, branch: false };
                    segments.push(current);
                    gap = [];
                }
                current.objectives.push(objective);
                if (!current.quests.includes(quest)) current.quests.push(quest);
            });
        });

        const pathIndex = new Map(path.map((quest, index) => [quest.id, index]));
        const optionalStarts = new Set();
        questEntries(mission).filter(quest => !pathIds.has(quest.id) && quest.questType === 'Optional').forEach(quest => {
            const queue = [...(quest.prevQuestIdList || [])];
            const seen = new Set();
            while (queue.length) {
                const id = queue.shift();
                if (seen.has(id)) continue;
                seen.add(id);
                if (pathIndex.has(id)) {
                    optionalStarts.add(pathIndex.get(id) + 1);
                    break;
                }
                queue.push(...(mission.questDic?.[id]?.prevQuestIdList || []));
            }
        });
        // A repeated objective starts a parallel phase only when an optional path opens at its preceding step.
        segments.forEach((segment, index) => {
            const next = segments[index + 1];
            const preceding = segments[index - 1];
            if (next?.key === segment.key && next.gapBefore.some(quest => quest.showMode === 'AlwaysHide') &&
                preceding && optionalStarts.has(pathIndex.get(preceding.quests[0].id))) {
                segment.branch = true;
            }
        });
        const consolidated = [];
        segments.forEach(segment => {
            const previous = consolidated[consolidated.length - 1];
            if (previous && !previous.branch && !segment.branch && previous.key === segment.key) {
                previous.objectives.push(...segment.objectives);
                segment.quests.forEach(quest => { if (!previous.quests.includes(quest)) previous.quests.push(quest); });
            } else {
                consolidated.push(segment);
            }
        });
        segments = consolidated;
        const steps = segments.filter(segment => !segment.branch);
        const branches = segments.filter(segment => segment.branch).map(segment => ({
            ...segment, anchor: steps.findLastIndex(step => segments.indexOf(step) < segments.indexOf(segment))
        }));
        const findMainPredecessor = quest => {
            const queue = [...(quest.prevQuestIdList || [])];
            const seen = new Set();
            while (queue.length) {
                const id = queue.shift();
                if (seen.has(id)) continue;
                seen.add(id);
                const index = steps.findIndex(step => step.quests.some(item => item.id === id));
                if (index >= 0) return index;
                queue.push(...(mission.questDic?.[id]?.prevQuestIdList || []));
            }
            return -1;
        };
        if ((mission.mainPathQuests || []).length) {
            questEntries(mission).filter(quest => !pathIds.has(quest.id)).forEach(quest => {
                (quest.objectiveList || []).forEach((objective, index) => {
                    const key = objective.description?.key || `${quest.id}:${index}`;
                    const equivalent = steps.find(step => step.key === key && step.quests.some(item =>
                        (item.prevQuestIdList || []).some(id => (quest.prevQuestIdList || []).includes(id))
                    ));
                    if (equivalent) {
                        equivalent.objectives.push(objective);
                        if (!equivalent.quests.includes(quest)) equivalent.quests.push(quest);
                        return;
                    }
                    const predecessor = findMainPredecessor(quest);
                    const concurrent = quest.questType === 'Optional' || Number(quest.flowIndex) > 0;
                    const anchor = predecessor < 0 ? -1 : Math.min(predecessor + (concurrent ? 1 : 0), steps.length - 1);
                    branches.push({ key, objectives: [objective], quests: [quest], branch: true, anchor });
                });
            });
        }
        const ordered = [];
        steps.forEach((step, index) => {
            step.number = index + 1;
            step.label = `第 ${step.number} 步`;
            ordered.push(step);
            branches.filter(branch => branch.anchor === index).forEach((branch, branchIndex) => {
                branch.number = index + 1;
                branch.label = `${step.label} · 并行目标 ${String.fromCharCode(65 + branchIndex)}${branch.quests.some(quest => quest.questType === 'Optional') ? '（可选）' : ''}`;
                branch.marker = String.fromCharCode(65 + branchIndex);
                ordered.push(branch);
            });
        });
        branches.filter(branch => branch.anchor < 0).forEach(branch => {
            branch.number = null;
            branch.label = '其他分支目标';
            branch.marker = '?';
            ordered.push(branch);
        });
        return { steps, ordered };
    }

    function walk(value, visitor, path = '$', seen = new WeakSet()) {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        visitor(value, path);
        if (Array.isArray(value)) value.forEach((child, index) => walk(child, visitor, `${path}[${index}]`, seen));
        else Object.entries(value).forEach(([key, child]) => walk(child, visitor, `${path}.${key}`, seen));
    }

    function objectiveDescription(objective) {
        const key = objective?.description?.key;
        return textByKey(key, state.textTable, key || '未配置目标文本');
    }

    function buildSearchText(entry, name) {
        return [entry.id, name, entry.missionName?.key, typeDefinition(missionTypeId(entry.missionType)).name]
            .filter(Boolean).join('\n').toLowerCase();
    }

    function createRow(entry) {
        const nameKey = entry.missionName?.key;
        const name = textByKey(nameKey, state.textTable, nameKey || entry.id);
        const type = missionTypeId(entry.missionType);
        return {
            id: entry.id, entry, mission: null, meta: null, name, description: '', type,
            typeDef: typeDefinition(type),
            chapter: Number(entry.missionChapterBitmask ?? 0),
            importance: entry.missionImportance,
            questCount: Number(entry.questCount ?? 0),
            objectiveCount: Number(entry.objectiveCount ?? 0),
            searchText: buildSearchText(entry, name)
        };
    }

    function rebuildRows() {
        state.rows = Array.from(state.missionEntries.values()).map(createRow).sort((a, b) =>
            b.typeDef.priority - a.typeDef.priority
            || Number(IMPORTANCE_LEVEL[a.importance] || 99) - Number(IMPORTANCE_LEVEL[b.importance] || 99)
            || naturalCompare(a.id, b.id)
        );
    }

    async function fetchJson(url) {
        const response = await (window.akeFetch || fetch)(url);
        if (!response.ok) throw new Error(`无法加载 ${url} (HTTP ${response.status})`);
        return response.json();
    }

    function valueOf(field) {
        return field && typeof field === 'object' && Object.hasOwn(field, 'constValue') ? field.constValue : field;
    }

    function collectLevelScriptSceneIds(row) {
        const sceneIds = new Set();
        const inspect = value => {
            ['sceneId', 'levelId', 'levelIdOverride'].forEach(key => {
                const sceneId = valueOf(value?.[key]);
                if (typeof sceneId === 'string' && sceneId.trim()) sceneIds.add(sceneId.trim());
            });
        };
        walk(row?.mission, inspect);
        walk(row?.meta, inspect);
        return Array.from(sceneIds);
    }

    async function loadLevelScriptScene(sceneId) {
        if (!state.levelScriptScenes.has(sceneId)) {
            const request = (async () => {
                const manifest = await window.akeAssetIndex.listJsonFiles(`LevelScriptData/${sceneId}`);
                const base = `/public/Json/LevelScriptData/${encodeURIComponent(sceneId)}`;
                const scripts = await Promise.all(manifest.filter(entry => !entry.hidden).map(async entry => {
                    try {
                        const script = await fetchJson(entry.contentFile || `${base}/${encodeURIComponent(entry.id)}.json`);
                        return { sceneId, scriptId: String(entry.id), script };
                    } catch (error) {
                        console.warn(`LevelScriptData ${sceneId}/${entry.id} 加载失败。`, error);
                        return null;
                    }
                }));
                return scripts.filter(Boolean);
            })().catch(error => {
                state.levelScriptScenes.delete(sceneId);
                throw error;
            });
            state.levelScriptScenes.set(sceneId, request);
        }
        return state.levelScriptScenes.get(sceneId);
    }

    async function ensureMissionLevelScripts(row) {
        if (!state.missionScriptCache.has(row.id)) {
            state.missionScriptCache.set(row.id, Promise.all(collectLevelScriptSceneIds(row).map(async sceneId => {
                try {
                    return await loadLevelScriptScene(sceneId);
                } catch (error) {
                    console.warn(`任务 ${row.id} 的 LevelScriptData 场景 ${sceneId} 加载失败。`, error);
                    return [];
                }
            })).then(groups => groups.flat()));
        }
        return state.missionScriptCache.get(row.id);
    }

    async function missionOwnedScriptIds(row) {
        if (!state.missionOwnedScripts.has(row.id)) {
            const request = Promise.all(collectLevelScriptSceneIds(row).map(async sceneId => {
                const path = `LevelData/${sceneId}/${sceneId}_lv_data_sub_${row.id}.json`;
                const entry = await window.akeAssetIndex.getJsonFile(path);
                if (!entry) return [];
                const data = await fetchJson(entry.contentFile);
                return Object.keys(data.levelScriptBriefDataDict || {});
            })).then(groups => new Set(groups.flat())).catch(error => {
                state.missionOwnedScripts.delete(row.id);
                throw error;
            });
            state.missionOwnedScripts.set(row.id, request);
        }
        return state.missionOwnedScripts.get(row.id);
    }

    function loadLevelDataEntry(entry) {
        if (!state.levelDataScenes.has(entry.path)) {
            state.levelDataScenes.set(entry.path, fetchJson(entry.contentFile).catch(error => {
                state.levelDataScenes.delete(entry.path);
                throw error;
            }));
        }
        return state.levelDataScenes.get(entry.path);
    }

    async function levelDataForScript(sceneId, missionId, scriptId) {
        const entries = await window.akeAssetIndex.listJsonFiles(`LevelData/${sceneId}`);
        const group = Number(String(scriptId).slice(2, 6));
        const candidateIds = new Set([
            `${sceneId}_lv_data`, `${sceneId}_lv_data_sub_${missionId}`,
            ...(Number.isFinite(group) ? [`${sceneId}_lv_data_sub_${String(group).padStart(2, '0')}`] : [])
        ]);
        const matches = data => Boolean(data.levelScriptBriefDataDict?.[scriptId]) ||
            (data.spawners || []).some(spawner => String(spawner.belongLevelScriptId) === scriptId);
        const preferred = entries.filter(entry => candidateIds.has(entry.id));
        const loaded = await Promise.all(preferred.map(loadLevelDataEntry));
        const found = loaded.filter(matches);
        if (found.length) return found;
        for (const entry of entries.filter(item => !candidateIds.has(item.id))) {
            const data = await loadLevelDataEntry(entry);
            if (matches(data)) return [data];
        }
        return [];
    }

    async function loadSpawnerConfig(sceneId, configId) {
        const key = `${sceneId}/${configId}`;
        if (!state.spawnerConfigs.has(key)) {
            const request = (async () => {
                const entry = await window.akeAssetIndex.getJsonFile(`SpawnerConfig/${sceneId}/${configId}.json`);
                return entry ? fetchJson(entry.contentFile) : null;
            })().catch(error => {
                state.spawnerConfigs.delete(key);
                throw error;
            });
            state.spawnerConfigs.set(key, request);
        }
        return state.spawnerConfigs.get(key);
    }

    async function stepEnemies(row, step, scripts) {
        const questIds = new Set(step.quests.map(quest => quest.id));
        const related = scripts.filter(entry => actionNodes(entry.script).some(action =>
            actionType(action) === 'OnQuestStateChanged' && questIds.has(String(valueOf(action._filtedQuestId) || ''))
        ));
        const fixed = new Map();
        const waves = [];
        for (const entry of related) {
            const levelFiles = await levelDataForScript(entry.sceneId, row.id, entry.scriptId);
            for (const level of levelFiles) {
                const worldIds = new Set((level.levelScriptBriefDataDict?.[entry.scriptId]?.refWorldEntityIdList || []).map(String));
                (level.enemies || []).filter(enemy => worldIds.has(String(enemy.levelLogicId))).forEach(enemy =>
                    fixed.set(String(enemy.levelLogicId), enemy)
                );
                for (const spawner of (level.spawners || []).filter(item => String(item.belongLevelScriptId) === entry.scriptId)) {
                    const config = await loadSpawnerConfig(entry.sceneId, spawner.configId);
                    const library = new Map((config?.enemyLibrary || []).map(enemy => [enemy.key, enemy]));
                    Object.values(config?.waveMap || {}).forEach(wave => Object.values(wave.groupMap || {}).forEach(group =>
                        Object.values(group.actionMap || {}).forEach(action => {
                            const enemy = library.get(action.libraryKey);
                            if (enemy?.enemyId && Number(action.spawnCount) > 0) waves.push({
                                wave: wave.waveId, id: enemy.enemyId, level: enemy.enemyLevel,
                                count: Number(action.spawnCount), configId: spawner.configId
                            });
                        })
                    ));
                }
            }
            Object.entries(entry.script?.enemies || {}).forEach(([slot, enemy]) =>
                fixed.set(`${entry.scriptId}:${slot}`, enemy)
            );
        }
        return { fixed: [...fixed.values()], waves };
    }

    function actionNodes(script) {
        const dataMap = script?.actionMap?.dataMap || {};
        return [...(dataMap.headerList || []), ...(dataMap.actionList || []), ...(dataMap.getterList || [])];
    }

    function actionNextIds(action, nodeMap) {
        const ids = [];
        const add = value => {
            const id = Number(value);
            if (Number.isFinite(id) && nodeMap.has(id) && !ids.includes(id)) ids.push(id);
        };
        const addList = value => (Array.isArray(value) ? value : []).forEach(add);
        add(action?._nextID);
        add(action?.m_nextID);
        addList(action?._idList);
        addList(action?._caseIDList);
        addList(action?.m_extraThreadIDList);
        add(action?._defaultID);
        add(action?._onTrueID);
        add(action?._onFalseID);
        add(action?._successID);
        add(action?._failedID);
        return ids;
    }

    function actionDialogId(action) {
        return valueOf(action?._dialogId) || valueOf(action?.dialogId) || '';
    }

    function actionType(action) {
        return shortType(action?.$type).split('.').pop();
    }

    function downstreamDialogs(startId, nodeMap) {
        const targets = new Set();
        const queue = [Number(startId)];
        const visited = new Set();
        while (queue.length && visited.size < 200) {
            const id = queue.shift();
            if (!Number.isFinite(id) || visited.has(id)) continue;
            visited.add(id);
            const action = nodeMap.get(id);
            if (!action) continue;
            const type = actionType(action);
            const dialogId = actionDialogId(action);
            if (PLAY_DIALOG_ACTIONS.has(type) && dialogId) {
                targets.add(String(dialogId));
                continue;
            }
            actionNextIds(action, nodeMap).forEach(nextId => queue.push(nextId));
        }
        return Array.from(targets);
    }

    function levelScriptDialogFlow(scriptEntries) {
        const flow = new Map();
        scriptEntries.forEach(entry => {
            const nodes = actionNodes(entry.script);
            const nodeMap = new Map(nodes.map(action => [Number(action?._ID), action]).filter(([id]) => Number.isFinite(id)));
            nodes.filter(action => actionType(action) === 'OnDialogExit').forEach(action => {
                const dialogId = String(valueOf(action?._filteredDialogId) || '');
                if (!dialogId) return;
                const finishId = Number(valueOf(action?._filteredFinishId));
                const targets = downstreamDialogs(action?._nextID, nodeMap);
                const transition = {
                    finishId: Number.isFinite(finishId) ? finishId : -1,
                    targets,
                    sceneId: entry.sceneId,
                    scriptId: entry.scriptId
                };
                if (!flow.has(dialogId)) flow.set(dialogId, []);
                const transitions = flow.get(dialogId);
                const key = `${transition.finishId}|${targets.join(',')}`;
                if (!transitions.some(item => `${item.finishId}|${item.targets.join(',')}` === key)) transitions.push(transition);
            });
        });
        return flow;
    }

    function missionScriptEvents(row, scriptEntries, ownedScriptIds = new Set()) {
        const questIds = new Set(Object.keys(row.mission?.questDic || {}));
        const questsByScript = new Map();
        questEntries(row.mission).forEach(quest => walk(quest, value => {
            [value?.scriptId, value?._scriptId].forEach(field => {
                const reference = valueOf(field);
                const scriptId = reference && typeof reference === 'object' ? reference.scriptId : reference;
                if (scriptId === undefined || scriptId === null || scriptId === '' || scriptId === 0) return;
                const id = String(scriptId);
                if (!questsByScript.has(id)) questsByScript.set(id, new Set());
                questsByScript.get(id).add(quest.id);
            });
        }));
        const events = [];
        scriptEntries.forEach(entry => {
            const nodes = actionNodes(entry.script);
            const nodeMap = new Map(nodes.map(action => [Number(action?._ID), action]).filter(([id]) => Number.isFinite(id)));
            const anchors = new Map();
            nodes.filter(action => actionType(action) === 'OnQuestStateChanged').forEach(header => {
                const questId = String(valueOf(header._filtedQuestId) || '');
                if (!questIds.has(questId)) return;
                const queue = actionNextIds(header, nodeMap);
                const visited = new Set();
                while (queue.length && visited.size < 500) {
                    const id = queue.shift();
                    if (visited.has(id)) continue;
                    visited.add(id);
                    if (!anchors.has(id)) anchors.set(id, new Set());
                    anchors.get(id).add(questId);
                    actionNextIds(nodeMap.get(id), nodeMap).forEach(next => queue.push(next));
                }
            });
            nodes.forEach(action => {
                const type = actionType(action);
                const dialogId = String(actionDialogId(action) || '');
                const radioId = String(valueOf(action?._radioId) || '');
                const questAnchors = [...(anchors.get(Number(action?._ID)) || questsByScript.get(entry.scriptId) || [])];
                const ownedDialog = dialogId.startsWith(`dlg_${row.id}_`) || dialogId.startsWith(`sns_${row.id}_`);
                const ownedRadio = radioId.startsWith(`radio_${row.id}_`);
                let kind = '', id = '';
                if (PLAY_DIALOG_ACTIONS.has(type) && (ownedDialog || questAnchors.length)) {
                    kind = dialogId.startsWith('sns_') ? 'sns' : 'dialog'; id = dialogId;
                } else if (type.startsWith('PlayRadio') && (ownedRadio || questAnchors.length)) {
                    kind = 'radio'; id = radioId;
                } else if ((questAnchors.length || ownedScriptIds.has(entry.scriptId)) && ['PlayCutsceneAction', 'PlayFmvAction'].includes(type)) {
                    kind = 'cutscene'; id = String(valueOf(action._cutsceneId) || valueOf(action._moviePath) || action._ID);
                } else if ((questAnchors.length || ownedScriptIds.has(entry.scriptId)) && ['ShowLimitedGuide', 'ManuallyStartGuideGroup'].includes(type)) {
                    kind = 'guide'; id = String(valueOf(action._mediaGuideGroupId) || valueOf(action._guideGroupId) || action._ID);
                }
                if (!kind || !id) return;
                events.push({ kind, id, questAnchors, sceneId: entry.sceneId, scriptId: entry.scriptId,
                    actionId: action._ID, position: entry.script?.activeShapeList?.[0]?.offset || null });
            });
        });
        return events;
    }

    function missionClientEvents(row) {
        const mission = row.mission || {};
        const actions = new Map((mission.actionMapRaw?.dataMap?.actionList || []).map(action => [Number(action._ID), action]));
        return (mission.clientActionMapKey || []).flatMap((binding, index) => {
            const action = actions.get(Number(mission.clientActionMapValue?.[index]));
            if (!action || !mission.questDic?.[binding.questId]) return [];
            const type = actionType(action);
            const dialogId = String(actionDialogId(action) || '');
            const radioId = String(valueOf(action._radioId) || '');
            let kind = '', id = '', titleKey = '';
            if (PLAY_DIALOG_ACTIONS.has(type) && dialogId) {
                kind = dialogId.startsWith('sns_') ? 'sns' : 'dialog'; id = dialogId;
            } else if (type.startsWith('PlayRadio') && radioId) {
                kind = 'radio'; id = radioId;
            } else if (['PlayCutsceneAction', 'PlayFmvAction'].includes(type)) {
                kind = 'cutscene'; id = String(valueOf(action._cutsceneId) || valueOf(action._moviePath) || action._ID);
            } else if (['ShowLimitedGuide', 'ManuallyStartGuideGroup'].includes(type)) {
                kind = 'guide'; id = String(valueOf(action._mediaGuideGroupId) || valueOf(action._guideGroupId) || action._ID);
                titleKey = String(valueOf(action._textId) || '');
            }
            return kind && id ? [{ kind, id, titleKey, questAnchors: [binding.questId],
                sceneId: mission.levelId, scriptId: '', position: null }] : [];
        });
    }

    async function loadCore() {
        const [manifest, typeInfo, textTable] = await Promise.all([
            window.akeAssetIndex.listJsonFiles('MissionRuntimeAsset'),
            window.AKEV3.table('MissionTypeInfoTable'),
            window.AKEV3.table('TextTable')
        ]);
        state.manifest = manifest;
        state.typeInfo = typeInfo || {};
        state.textTable = textTable || {};
        manifest.forEach(entry => {
            if (!entry?.id || !entry?.contentFile) return;
            if (entry.id.endsWith('_meta')) state.metaEntries.set(entry.id.slice(0, -5), entry);
            else state.missionEntries.set(entry.id, entry);
        });
        const entries = Array.from(state.missionEntries.values());
        if (entries.some(entry => entry.missionType === undefined || !entry.missionName || entry.missionImportance === undefined || entry.questCount === undefined)) {
            throw new Error('MissionRuntimeAsset 远端资产索引缺少任务基础索引字段');
        }
        state.stats = {
            missionCount: entries.length,
            metaCount: state.metaEntries.size,
            questCount: entries.reduce((sum, entry) => sum + Number(entry.questCount || 0), 0),
            objectiveCount: entries.reduce((sum, entry) => sum + Number(entry.objectiveCount || 0), 0)
        };
        rebuildRows();
    }

    async function loadMission(row) {
        if (row.mission) return row.mission;
        if (!state.missionCache.has(row.id)) {
            state.missionCache.set(row.id, fetchJson(row.entry.contentFile).catch(error => {
                state.missionCache.delete(row.id);
                throw error;
            }));
        }
        row.mission = await state.missionCache.get(row.id);
        const descriptionKey = row.mission?.missionDescription?.key;
        row.description = textByKey(descriptionKey, state.textTable, descriptionKey || '');
        return row.mission;
    }

    async function loadMeta(row) {
        if (row.meta || !state.metaEntries.has(row.id)) return row.meta;
        if (!state.metaCache.has(row.id)) {
            state.metaCache.set(row.id, fetchJson(state.metaEntries.get(row.id).contentFile).catch(error => {
                state.metaCache.delete(row.id);
                throw error;
            }));
        }
        row.meta = await state.metaCache.get(row.id);
        return row.meta;
    }

    function versionKey(version) {
        return version?.id || 'current';
    }

    async function loadTableSet(names, version, cache, optional = false) {
        const key = versionKey(version);
        if (!cache.has(key)) {
            cache.set(key, Promise.all(names.map(name => window.AKEV3.table(name, version).catch(error => {
                if (!optional) throw error;
                console.warn(`可选 TableCfg ${name} 加载失败，按空表处理。`, error);
                return {};
            }))).then(values =>
                Object.fromEntries(names.map((name, index) => [name, values[index]]))
            ).catch(error => {
                cache.delete(key);
                throw error;
            }));
        }
        return cache.get(key);
    }

    function ensureAuxiliary(version) {
        return loadTableSet(TABLE_NAMES.auxiliary, version, state.auxiliary, true);
    }

    function ensureDialogue(version) {
        return loadTableSet(TABLE_NAMES.dialogue, version, state.dialogue);
    }

    function filteredRows() {
        const search = state.search.trim().toLowerCase();
        return state.rows.filter(row => {
            if (!state.showHidden && !row.typeDef.visible) return false;
            if (state.type !== 'all' && String(row.type) !== state.type) return false;
            if (state.chapter !== 'all' && String(row.chapter) !== state.chapter) return false;
            return !search || window.AKEModuleSearch.matches(row.searchText, search);
        });
    }

    function renderTypeOptions() {
        const types = Array.from(new Set(state.rows.map(row => row.type))).sort((a, b) => a - b);
        elements.type.innerHTML = '<option value="all">全部类型</option>' + types.map(type => {
            const definition = typeDefinition(type);
            const count = state.rows.filter(row => row.type === type).length;
            return `<option value="${type}">${escapeHtml(definition.name)} (${count})</option>`;
        }).join('');
        elements.type.value = state.type;
        window.AKEUI?.refreshSelect(elements.type);
    }

    function createMissionDirectoryItem(row) {
        const importanceLevel = IMPORTANCE_LEVEL[row.importance];
        return window.AKEUI.directoryItem({
            layout: 'entity',
            title: row.name,
            id: row.id,
            meta: [
                { label: row.typeDef.name, kind: 'mission-type' },
                { label: `${row.questCount} 步`, kind: 'mission-steps' },
                importanceLevel
                    ? { label: IMPORTANCE[row.importance], kind: `mission-importance-${importanceLevel}` }
                    : null
            ].filter(Boolean),
            accent: {
                type: 'mission',
                value: importanceLevel ? `importance-${importanceLevel}` : row.typeDef.view
            },
            active: row.id === state.selectedId,
            attributes: {
                'data-mission-id': row.id,
                'data-view': row.typeDef.view,
                'data-importance': row.importance ?? ''
            },
            onSelect: () => selectMission(row.id)
        });
    }

    function renderList() {
        const rows = filteredRows();
        elements.summary.textContent = `${rows.length} / ${state.rows.length} 个任务`;
        if (!rows.length) {
            elements.list.innerHTML = '<div class="ake-ui-state" data-state="empty" data-density="compact">没有符合条件的任务</div>';
            return;
        }
        elements.list.replaceChildren(...rows.map(createMissionDirectoryItem));
    }

    function renderOverview() {
        state.selectedId = null;
        renderList();
        const currentRows = state.rows;
        const stats = state.stats;
        const version = window.akeDataSource?.getState?.()?.selected?.id || 'local';
        const typeCards = Array.from(new Set(currentRows.map(row => row.type))).sort((a, b) => {
            return typeDefinition(b).priority - typeDefinition(a).priority || a - b;
        }).map(type => {
            const definition = typeDefinition(type);
            const rows = currentRows.filter(row => row.type === type);
            const objectives = rows.reduce((sum, row) => sum + row.objectiveCount, 0);
            return `<button class="ake-ui-card is-interactive" data-card-kind="mission-type" type="button" data-overview-type="${type}">
                <b class="ake-ui-card__title">${escapeHtml(definition.name)}</b><strong>${rows.length}</strong><small class="ake-ui-card__subtitle">${objectives} 个目标 · ${definition.visible ? '列表可见' : '内部类型'}</small>
            </button>`;
        }).join('');
        elements.detail.innerHTML = `<div class="ake-ui-page" data-ake-view="overview">
            <header class="ake-ui-page__header"><div><div class="ake-ui-page__eyebrow">Mission Runtime Database</div><h2>任务总览</h2><p class="ake-ui-page__summary">汇总任务定义、目标、奖励与相关剧情。</p></div><div class="ake-ui-page__status">${escapeHtml(version)}</div></header>
            <div class="ake-ui-card-grid" data-size="compact"><div class="ake-ui-card" data-card-kind="mission-stat"><b>${stats.missionCount}</b><span>任务</span></div><div class="ake-ui-card" data-card-kind="mission-stat"><b>${stats.questCount}</b><span>Quest 步骤</span></div><div class="ake-ui-card" data-card-kind="mission-stat"><b>${stats.objectiveCount}</b><span>任务目标</span></div><div class="ake-ui-card" data-card-kind="mission-stat"><b>${stats.metaCount}</b><span>Meta 配置</span></div></div>
            <section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">全部任务数据</h2></header><div class="ake-ui-card-grid" data-size="narrow">${typeCards}</div></section>
            <section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">数据范围</h2></header><div class="mission-description">打开任务后加载任务流程、相关剧情与奖励。无法确认触发步骤的剧情单独列出。</div></section>
        </div>`;
        elements.detail.querySelectorAll('[data-overview-type]').forEach(button => button.addEventListener('click', () => {
            state.type = button.dataset.overviewType;
            elements.type.value = state.type;
            renderList();
            elements.list.querySelector('[data-mission-id]')?.focus();
        }));
        window.__akeRouter?.updateUrl('v3_mission');
    }

    function closeMobileList() {
        root.classList.remove('is-mobile-open');
    }

    async function selectMission(id) {
        const row = state.rows.find(item => item.id === id);
        if (!row) return;
        state.selectedId = id;
        renderList();
        requestAnimationFrame(() => elements.list.querySelector(`[data-mission-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
        closeMobileList();
        window.__akeRouter?.updateUrl('v3_mission', id);
        elements.detail.innerHTML = '<div class="ake-ui-state" data-state="loading"><p>正在读取任务详情…</p></div>';
        try {
            await loadMission(row);
        } catch (error) {
            if (state.selectedId === id) elements.detail.innerHTML = `<div class="ake-ui-state" data-state="error">任务数据加载失败：${escapeHtml(error.message)}</div>`;
            return;
        }
        await loadMeta(row).catch(error => console.warn(`任务 ${id} 的 Meta 加载失败。`, error));
        if (state.selectedId === id) renderSelectedMission(row);
    }

    function renderHero(row) {
        const mission = row.mission || {};
        const mapId = mission.levelId || '未指定地图';
        const mapCode = state.showHidden ? window.AKEUI.element('code', 'ake-ui-detail-id', mapId) : null;
        if (mapCode) mapCode.title = mapId;
        const header = window.AKEUI.detailHeader({
            eyebrow: row.typeDef.name,
            title: row.name,
            subtitle: row.description
                ? window.AKEUI.fragment(richText(row.description))
                : '该任务没有可用描述。',
            content: window.AKEUI.fragment(`<div class="ake-ui-detail-badges"><span class="ake-ui-badge">${escapeHtml(row.typeDef.name)}</span><span class="ake-ui-badge">${chapterName(row.chapter)}</span><span class="ake-ui-badge">重要度 ${IMPORTANCE[row.importance] ?? '未配置'}</span><span class="ake-ui-badge">${row.questCount} Quest</span></div>`),
            after: mapCode
        });
        return header?.outerHTML || '';
    }

    function renderSelectedMission(row) {
        elements.detail.innerHTML = `<article class="ake-ui-detail" data-detail-kind="mission">${renderHero(row)}<section id="missionPanel"><div class="ake-ui-state" data-state="loading"><p>正在加载任务内容…</p></div></section></article>`;
        renderActivePanel(row);
    }

    function renderInfoGrid(row, auxiliary) {
        const mission = row.mission || {};
        const level = auxiliary?.LevelDescTable?.[mission.levelId];
        const character = auxiliary?.CharacterTable?.[mission.charId];
        const extraInfo = auxiliary?.MissionExtraInfoTable?.[row.id];
        const acceptMode = { Automatic: '自动接取', EnterArea: '进入区域', Interaction: '交互接取' };
        const cells = [
            ['类型', row.typeDef.name],
            ['重要度', IMPORTANCE[row.importance] ?? '未配置'], ['章节', chapterName(row.chapter)],
            ['地图', level?.showName?.text || (state.showHidden ? mission.levelId : '未配置')], ['关联角色', character?.name?.text || (state.showHidden ? mission.charId : '无')],
            ['领取方式', acceptMode[row.meta?.acceptMode?.mode] || row.meta?.acceptMode?.mode || '未配置'],
            ['额外说明', extraInfo?.extraInfoDesc?.text || '无']
        ];
        if (state.showHidden) cells.unshift(['任务 ID', row.id]);
        return `<dl class="ake-ui-meta-grid">${cells.map(([label, value]) => {
            const content = label === '关联角色' && mission.charId
                ? window.AKEUI.entryLinkHtml({ plugin: 'v3_character', id: mission.charId, label: value, contentHtml: escapeHtml(value) })
                : escapeHtml(value);
            return `<div class="ake-ui-meta-grid__item"><dt>${label}</dt><dd>${content}</dd></div>`;
        }).join('')}</dl>`;
    }

    function conditionSummary(objective) {
        const condition = objective?.condition || {};
        const parts = [shortType(condition.$type)];
        if (condition._progressToCompare?.constValue !== undefined) parts.push(`目标 ${condition._progressToCompare.constValue}`);
        if (condition._itemId?.constValue) parts.push(condition._itemId.constValue);
        if (condition._dialogId?.constValue) parts.push(condition._dialogId.constValue);
        const tracking = (objective.trackingInfoList || []).map(item => shortType(item.$type)).filter(Boolean);
        if (tracking.length) parts.push(`追踪：${tracking.join(' / ')}`);
        return parts.join(' · ');
    }

    function rewardHtml(rewardId, auxiliary) {
        const reward = auxiliary?.RewardTable?.[rewardId];
        if (!rewardId) return '';
        if (!reward) return `<div class="mission-reward-list"><div class="mission-reward"><b>${state.showHidden ? escapeHtml(rewardId) : '奖励数据暂不可用'}</b></div></div>`;
        const bundles = [...(reward.itemBundles || []), ...(reward.probItemBundles || [])];
        return `<div class="mission-reward-list">${bundles.map(bundle => {
            const item = auxiliary.ItemTable?.[bundle.id] || {};
            const icon = item.iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${item.iconId}.png` : '';
            const name = item.name?.text || (state.showHidden ? bundle.id : '未命名物品');
            return window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: bundle.id, label: name, className: 'mission-reward', contentHtml: `${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ''}<div><b>${escapeHtml(name)}</b><br><small>× ${escapeHtml(bundle.count ?? '?')}</small></div>` });
        }).join('') || `<div class="mission-reward"><b>${state.showHidden ? escapeHtml(rewardId) : '未配置奖励物品'}</b></div>`}</div>`;
    }

    async function renderQuestPanel(row, panel, token) {
        const auxiliary = await ensureAuxiliary().catch(() => ({}));
        if (token !== state.renderToken || state.selectedId !== row.id) return;
        const flow = questFlow(row.mission);
        const steps = flow.ordered;
        const renderedSteps = panel.querySelectorAll('[data-mission-step]');
        const openSteps = new Set([...renderedSteps].filter(step => step.open).map(step => step.dataset.missionStep));
        const renderItems = ids => ids.map(itemId => {
            const name = auxiliary.ItemTable?.[itemId]?.name?.text || (state.showHidden ? itemId : '未命名物品');
            return window.AKEUI.entryLinkHtml({ plugin: 'v3_item', id: itemId, label: name, contentHtml: escapeHtml(name) });
        }).join('、');
        panel.innerHTML = `${renderInfoGrid(row, auxiliary)}<div class="mission-quest-list">${steps.map((step, index) => {
            const itemIds = [...new Set(step.quests.flatMap(quest => quest.needItemIds || []))];
            const sceneIds = [...new Set(step.objectives.flatMap(objective => (objective.trackingInfoList || []).map(track => track.sceneId).filter(Boolean)))];
            const sceneNames = sceneIds.map(id => auxiliary.LevelDescTable?.[id]?.showName?.text || (state.showHidden ? id : '未命名区域'));
            const details = state.showHidden ? `<div class="mission-objective__meta">${step.quests.map(quest => escapeHtml(quest.id)).join(' · ')}</div>` : '';
            return `<details class="mission-quest" data-mission-step="${index}" ${renderedSteps.length ? (openSteps.has(String(index)) ? 'open' : '') : (index === 0 ? 'open' : '')}><summary><span class="mission-objective__index">${escapeHtml(step.branch ? step.marker : step.number)}</span><span class="mission-quest__desc">${step.branch ? `${escapeHtml(step.label)} · ` : ''}${richText(objectiveDescription(step.objectives[0]))}</span></summary><div class="mission-quest__body">
                ${sceneNames.length ? `<div class="mission-objective__meta">区域：${sceneNames.map(escapeHtml).join('、')}</div>` : ''}
                ${itemIds.length ? `<div class="mission-objective__meta">需要：${renderItems(itemIds)}</div>` : ''}
                ${state.showHidden ? `${details}${step.objectives.map(objective => `<div class="mission-objective__meta">${escapeHtml(conditionSummary(objective))}</div>`).join('')}` : ''}
                ${step.quests.filter(quest => quest.rewardId).map(quest => rewardHtml(quest.rewardId, auxiliary)).join('')}
            </div></details>`;
        }).join('')}</div>${row.mission.rewardId ? `<div class="mission-description"><b>任务完成奖励</b>${rewardHtml(row.mission.rewardId, auxiliary)}</div>` : ''}`;
        try {
            const [tables, scripts, ownedScriptIds] = await Promise.all([ensureDialogue(), ensureMissionLevelScripts(row), missionOwnedScriptIds(row)]);
            if (token !== state.renderToken || state.selectedId !== row.id) return;
            const data = dialogueData(row, tables, scripts);
            const groups = new Map(data.groups.map(group => [group.id, group]));
            const stepByQuest = new Map(steps.flatMap((step, index) =>
                [...(step.gapBefore || []), ...step.quests].map(quest => [quest.id, index])
            ));
            const unresolved = [];
            const shownGroups = new Set();
            const appendEvent = (html, stepIndex) => {
                const target = Number.isInteger(stepIndex) ? panel.querySelector(`[data-mission-step="${stepIndex}"] .mission-quest__body`) : null;
                if (target) target.insertAdjacentHTML('beforeend', html);
                else unresolved.push(html);
            };
            [...missionClientEvents(row), ...missionScriptEvents(row, scripts, ownedScriptIds)].forEach(event => {
                const group = groups.get(event.id);
                if (group) {
                    if (shownGroups.has(group.id)) return;
                    shownGroups.add(group.id);
                    appendEvent(renderMissionEvent(event, groups, auxiliary), group.stepOrder);
                    return;
                }
                const anchors = [...new Set(event.questAnchors.map(id => stepByQuest.get(id)).filter(Number.isInteger))];
                appendEvent(renderMissionEvent(event, groups, auxiliary), anchors.length === 1 ? anchors[0] : null);
            });
            data.groups.filter(group => !shownGroups.has(group.id)).forEach(group =>
                appendEvent(renderDialogueGroup(group), group.stepOrder)
            );
            if (unresolved.length) panel.insertAdjacentHTML('beforeend', `<section class="ake-ui-section"><header class="ake-ui-section__header"><h2 class="ake-ui-section__title">未定位到具体步骤的剧情</h2></header>${unresolved.join('')}</section>`);
            bindDialogueActions(panel, data, () => renderQuestPanel(row, panel, token));
            panel.querySelectorAll('[data-mission-step]').forEach((details, index) => {
                const step = steps[index];
                const questIds = new Set(step.quests.map(quest => quest.id));
                if (!scripts.some(entry => actionNodes(entry.script).some(action =>
                    actionType(action) === 'OnQuestStateChanged' && questIds.has(String(valueOf(action._filtedQuestId) || ''))
                ))) return;
                const load = async () => {
                    if (!details.open || details.dataset.enemyLoaded) return;
                    details.dataset.enemyLoaded = 'loading';
                    const target = details.querySelector('.mission-quest__body');
                    const marker = document.createElement('div');
                    marker.className = 'mission-objective__meta';
                    marker.textContent = '正在读取敌人配置…';
                    target.append(marker);
                    try {
                        const enemies = await stepEnemies(row, step, scripts);
                        if (token === state.renderToken && details.isConnected) {
                            const html = renderStepEnemies(enemies, auxiliary);
                            if (html) marker.innerHTML = html;
                            else marker.remove();
                        }
                        details.dataset.enemyLoaded = 'done';
                    } catch (error) {
                        details.dataset.enemyLoaded = '';
                        if (details.isConnected) marker.textContent = '敌人配置暂不可用';
                        console.warn(`任务 ${row.id} 的敌人配置加载失败。`, error);
                    }
                };
                details.addEventListener('toggle', load);
                if (details.open) load();
            });
        } catch (error) {
            console.warn(`任务 ${row.id} 的剧情事件加载失败。`, error);
            if (token === state.renderToken && panel.isConnected) {
                panel.insertAdjacentHTML('beforeend', '<div class="ake-ui-state" data-state="error">相关剧情暂时无法加载。</div>');
            }
        }
    }

    function visitDialogueRefs(value, add) {
        const dialogId = value?._dialogId?.constValue || value?.dialogId;
        const radioId = value?._radioId?.constValue;
        if (dialogId && String(dialogId).startsWith('dlg_')) add('dialog', dialogId);
        if (value?.snsDialogId) add('sns', value.snsDialogId);
        if (dialogId && String(dialogId).startsWith('sns_')) add('sns', dialogId);
        if (radioId) add('radio', radioId);
    }

    function collectRuntimeDialogueRefs(mission, scriptEntries = []) {
        const refs = { dialog: new Set(), sns: new Set(), radio: new Set(), order: new Map() };
        let sequence = 0;
        const add = (kind, id) => {
            if (!id) return;
            const normalized = String(id);
            refs[kind].add(normalized);
            if (!refs.order.has(normalized)) refs.order.set(normalized, sequence++);
        };
        const inspect = value => visitDialogueRefs(value, add);
        questEntries(mission).forEach(quest => walk(quest, inspect));
        Object.entries(mission || {}).filter(([key]) => key !== 'questDic').forEach(([, value]) => walk(value, inspect));
        const missionId = mission?.missionId;
        scriptEntries.forEach(entry => {
            const nodes = actionNodes(entry.script);
            const hasQuest = nodes.some(action => mission?.questDic?.[valueOf(action?._filtedQuestId)]);
            nodes.forEach(action => {
                const dialogId = String(actionDialogId(action) || '');
                const radioId = String(valueOf(action?._radioId) || '');
                if (dialogId?.startsWith(`dlg_${missionId}_`) || (hasQuest && dialogId?.startsWith('dlg_'))) add('dialog', dialogId);
                if (dialogId?.startsWith(`sns_${missionId}_`) || (hasQuest && dialogId?.startsWith('sns_'))) add('sns', dialogId);
                if (radioId?.startsWith(`radio_${missionId}_`) || (hasQuest && radioId?.startsWith('radio_'))) add('radio', radioId);
            });
        });
        return refs;
    }

    function dialogueAvatar(value, tables) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (state.avatarCache.has(raw)) return state.avatarCache.get(raw);
        const alias = raw.replace(/^sns_(?:npc|chr)_/, '').replace(/^chr_\d+_/, '');
        const overrides = {
            endmin: 'icon_chr_0003_endminf',
            fiona: 'icon_chr_0102_fiona'
        };
        let iconId = overrides[alias] || '';
        if (!iconId) {
            const characterId = Object.keys(tables.CharacterTable || {}).find(id => id === raw || id.endsWith(`_${alias}`));
            if (characterId) iconId = `icon_${characterId}`;
        }
        if (!iconId) {
            const directNpc = tables.NpcTable?.[raw] || tables.NpcTable?.[alias];
            const npc = directNpc || Object.values(tables.NpcTable || {}).find(item =>
                item?.npcId === alias || String(item?.dataKey || '').toLowerCase().includes(alias.toLowerCase())
            );
            if (npc?.headIcon && npc.headIcon !== 'icon_default') iconId = npc.headIcon;
        }
        const path = iconId ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/${iconId}.png` : '';
        state.avatarCache.set(raw, path);
        return path;
    }

    function standardDialogGroups(missionId, mission, tables, refs = collectRuntimeDialogueRefs(mission), scriptFlow = new Map()) {
        const escapedId = missionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keyPattern = new RegExp(`^(dlg_${escapedId}_.+)_\\d{3}$`);
        Object.keys(tables.DialogTextTable || {}).forEach(key => {
            const match = key.match(keyPattern);
            if (match) refs.dialog.add(match[1]);
        });
        return Array.from(refs.dialog).sort(naturalCompare).map(dialogId => {
            const lines = Object.entries(tables.DialogTextTable || {}).filter(([key]) => key.startsWith(`${dialogId}_`)).sort(([a], [b]) => naturalCompare(a, b)).map(([id, line]) => ({
                id, speaker: line.actorName?.text || line.actorNameId || '旁白', avatar: dialogueAvatar(line.actorNameId, tables), text: line.dialogText?.text || '', hint: line.hint?.text || '', audio: line.audioOverride || ''
            }));
            const optionPattern = new RegExp(`^option_${dialogId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)_(\\d+)$`);
            const options = Object.entries(tables.DialogOptionTable || {}).filter(([key]) => key.startsWith(`option_${dialogId}_`)).sort(([a], [b]) => naturalCompare(a, b)).map(([id, option]) => {
                const match = id.match(optionPattern);
                return { id, text: option.optionText?.text || '', iconType: option.iconType || '', group: Number(match?.[1]), index: Number(match?.[2]) };
            });
            const optionGroups = Array.from(new Set(options.map(option => option.group).filter(Number.isFinite))).sort((a, b) => a - b).map(group => ({
                group,
                options: options.filter(option => option.group === group)
            }));
            const summaryPrefix = `summary_${dialogId.replace(/^dlg_/, '')}_`;
            const summaries = Object.entries(tables.DialogSummaryTable || {}).filter(([key]) => key.startsWith(summaryPrefix)).sort(([a], [b]) => naturalCompare(a, b)).map(([id, summary]) => ({ id, text: summary.text || '' }));
            return { kind: 'dialog', id: dialogId, lines, options, optionGroups, summaries, transitions: scriptFlow.get(dialogId) || [] };
        }).filter(group => group.lines.length || group.options.length || refs.dialog.has(group.id));
    }

    function snsSpeaker(value, tables) {
        const raw = String(value || '');
        if (!raw) return '系统';
        if (raw === 'endmin') return '管理员';
        const id = raw.replace(/^sns_(?:npc|chr)_/, '');
        return tables.SNSChatTable?.[raw]?.name?.text || tables.NpcTable?.[id]?.name?.text || id || raw;
    }

    function snsDialogGroups(missionId, mission, tables, refs = collectRuntimeDialogueRefs(mission)) {
        Object.entries(tables.SNSDialogTable || {}).forEach(([id, row]) => {
            if (row.relatedMissionId === missionId || id.startsWith(`sns_${missionId}_`)) refs.sns.add(id);
        });
        return Array.from(refs.sns).sort(naturalCompare).map(id => {
            const row = tables.SNSDialogTable?.[id];
            if (!row) return { kind: 'sns', id, nodes: {}, optionTable: {}, start: null, missing: true };
            const content = row.dialogContentData || {};
            const optionsTable = tables.SNSDialogOptionTable || {};
            const nodes = Object.fromEntries(Object.entries(content).filter(([key]) => Number(key) >= 0).map(([key, node]) => [key, {
                id: `${id}#${key}`,
                contentId: key,
                speaker: snsSpeaker(node.speaker, tables),
                avatar: dialogueAvatar(node.speaker, tables),
                text: node.content?.text || '',
                contentType: node.contentType,
                optionIds: node.dialogOptionIds || [],
                nextContentId: node.nextContentId
            }]));
            const optionTable = {};
            Object.values(nodes).forEach(node => node.optionIds.forEach(optionId => {
                const option = optionsTable[optionId] || {};
                optionTable[optionId] = {
                    id: optionId,
                    text: option.optionDesc?.text || optionId,
                    next: option.optionNextContentId
                };
            }));
            const start = Object.values(content).find(node => Number(node.preContentId) === 0 && Number(node.contentId) >= 0)?.contentId ??
                Object.keys(content).filter(key => Number(key) >= 0).sort(naturalCompare)[0];
            return { kind: 'sns', id, nodes, optionTable, start, chatId: row.chatId, missing: false };
        });
    }

    function radioGroups(refs, tables) {
        return Array.from(refs.radio).map(id => {
            const row = tables.RadioTable?.[id];
            const lines = [...(row?.radioSingleDataList || [])].sort((a, b) => Number(a.index || 0) - Number(b.index || 0)).map(line => ({
                id: line.id, speaker: line.actorName?.text || line.actorNameId || '广播',
                avatar: dialogueAvatar(line.actorNameId, tables), text: line.radioText?.text || '', audio: line.audioOverride || ''
            }));
            return { kind: 'radio', id, lines, missing: !row };
        });
    }

    function questDialogueIds(quest) {
        const ids = new Set();
        walk(quest, value => visitDialogueRefs(value, (_, id) => ids.add(String(id))));
        return ids;
    }

    function dialogueData(row, tables, scriptEntries = []) {
        const refs = collectRuntimeDialogueRefs(row.mission, scriptEntries);
        const scriptFlow = levelScriptDialogFlow(scriptEntries);
        const standard = standardDialogGroups(row.id, row.mission, tables, refs, scriptFlow);
        const sns = snsDialogGroups(row.id, row.mission, tables, refs);
        const stepByQuest = new Map();
        const directStages = new Map();
        questFlow(row.mission).ordered.forEach((step, index) => {
            const placement = { number: step.number, label: step.label, order: index };
            [...(step.gapBefore || []), ...step.quests].forEach(quest => {
                stepByQuest.set(quest.id, placement);
                questDialogueIds(quest).forEach(id => {
                    if (!directStages.has(id)) directStages.set(id, new Map());
                    directStages.get(id).set(index, placement);
                });
            });
        });
        const stages = new Map();
        [...missionClientEvents(row), ...missionScriptEvents(row, scriptEntries)].forEach(event => {
            if (!['dialog', 'sns', 'radio'].includes(event.kind)) return;
            const steps = [...new Set(event.questAnchors.map(id => stepByQuest.get(id)).filter(Boolean))];
            if (!stages.has(event.id)) stages.set(event.id, new Map());
            steps.forEach(step => stages.get(event.id).set(step.label, step));
        });
        const groups = [...standard, ...sns, ...radioGroups(refs, tables)].map(group => {
            const linked = [...(directStages.get(group.id)?.values() || stages.get(group.id)?.values() || [])];
            const step = linked.length === 1 ? linked[0] : null;
            return { ...group, stepNumber: step?.number ?? null, stepLabel: step?.label || '', stepOrder: step?.order ?? Infinity };
        }).sort((a, b) => a.stepOrder - b.stepOrder || naturalCompare(a.id, b.id));
        return { groups };
    }

    function renderDialogueLine(line) {
        return `<div class="mission-dialog-line${line.avatar ? ' has-avatar' : ''}">${line.avatar ? `<img class="mission-dialog-line__avatar" src="${escapeHtml(line.avatar)}" alt="" loading="lazy">` : ''}<div class="mission-dialog-line__speaker">${escapeHtml(line.speaker)}</div><div class="mission-dialog-line__text">${line.text ? richText(line.text) : '<span class="ake-ui-muted">（空台词）</span>'}${line.hint ? `<div class="mission-objective__meta">${richText(line.hint)}</div>` : ''}</div>${state.showHidden ? `<div class="mission-dialog-line__id">${escapeHtml(line.id)}${line.audio ? ` · ${escapeHtml(line.audio)}` : ''}</div>` : ''}</div>`;
    }

    function snsChoiceState(groupId) {
        if (!state.dialogueChoices.has(groupId)) state.dialogueChoices.set(groupId, new Map());
        return state.dialogueChoices.get(groupId);
    }

    function snsTimeline(group) {
        const items = [];
        const choices = snsChoiceState(group.id);
        const visited = new Set();
        let contentId = group.start;
        while (contentId !== undefined && contentId !== null && Number(contentId) >= 0) {
            const key = String(contentId);
            const node = group.nodes?.[key];
            if (!node || visited.has(key)) break;
            visited.add(key);
            if (node.text) items.push({ kind: 'line', line: node });
            const options = node.optionIds.map(id => group.optionTable[id]).filter(Boolean);
            if (options.length) {
                const saved = choices.get(key);
                const selected = options.find(option => option.id === saved) || options[0];
                items.push({ kind: 'choice', contentId: key, options, selectedId: selected.id });
                contentId = selected.next;
            } else {
                contentId = node.nextContentId;
            }
        }
        return items;
    }

    function selectSnsOption(group, contentId, optionId) {
        const choices = snsChoiceState(group.id);
        const choiceItems = snsTimeline(group).filter(item => item.kind === 'choice');
        const selectedIndex = choiceItems.findIndex(item => item.contentId === contentId);
        choiceItems.slice(selectedIndex + 1).forEach(item => choices.delete(item.contentId));
        choices.set(contentId, optionId);
    }

    function renderSnsDialogueGroup(group) {
        const timeline = snsTimeline(group);
        const content = timeline.map(item => {
            if (item.kind === 'line') return renderDialogueLine(item.line);
            return `<div class="mission-dialog-choice"><div class="mission-dialog-choice__label">选择任务选项</div><div class="mission-dialog-choice__buttons">${item.options.map(option => `<button class="mission-dialog-choice__button${option.id === item.selectedId ? ' is-selected' : ''}" type="button" data-sns-group="${escapeHtml(group.id)}" data-sns-content="${escapeHtml(item.contentId)}" data-sns-option="${escapeHtml(option.id)}" aria-pressed="${option.id === item.selectedId}">${richText(option.text || (state.showHidden ? option.id : '未命名选项'))}</button>`).join('')}</div></div>`;
        }).join('');
        return `<section class="mission-dialog-group"><h2 class="mission-dialog-group__title"><span class="ake-ui-badge">SNS 对话</span>${state.showHidden ? `<code>${escapeHtml(group.id)}</code>` : ''}${group.missing ? '<span class="ake-ui-badge">表中缺失</span>' : ''}</h2>${content || '<div class="mission-dialog-empty">找到了对话引用，但没有对应台词。</div>'}</section>`;
    }

    function renderDialogueGroup(group) {
        if (group.kind === 'sns') return renderSnsDialogueGroup(group);
        if (group.kind === 'radio') return `<section class="mission-dialog-group"><h2 class="mission-dialog-group__title"><span class="ake-ui-badge">广播</span>${state.showHidden ? `<code>${escapeHtml(group.id)}</code>` : ''}</h2>${group.lines.map(renderDialogueLine).join('') || '<div class="mission-dialog-empty">未找到广播台词。</div>'}</section>`;
        const summaries = (group.summaries || []).map(item => `<div class="mission-description">${richText(item.text)}</div>`).join('');
        const lines = group.lines.map(renderDialogueLine).join('');
        const options = group.options.map(option => `<div class="mission-dialog-option">选择：${richText(option.text || (state.showHidden ? option.id : '未命名选项'))}${state.showHidden ? ` <small>${escapeHtml(option.id)}</small>` : ''}</div>`).join('');
        const specificTransitions = (group.transitions || []).filter(transition => transition.finishId >= 0);
        const maxFinishId = specificTransitions.reduce((max, transition) => Math.max(max, transition.finishId), -1);
        const optionGroup = [...(group.optionGroups || [])].reverse().find(item => item.options.length > maxFinishId);
        const transitions = (group.transitions || []).filter(transition => transition.finishId >= 0 || transition.targets.length).map(transition => {
            const option = transition.finishId >= 0 ? optionGroup?.options?.[transition.finishId] : null;
            const label = option?.text || (transition.finishId >= 0 ? `分支 ${transition.finishId + 1}` : '完成对话');
            const target = transition.targets[0] || '';
            const destination = transition.targets.length ? transition.targets.join(' / ') : '结束';
            return `<button class="mission-dialog-choice__button" type="button"${target ? ` data-dialog-target="${escapeHtml(target)}"` : ' disabled'}>${richText(label)} <small>→ ${state.showHidden ? escapeHtml(destination) : (target ? '下一段剧情' : '结束')}</small></button>`;
        }).join('');
        const flow = transitions ? `<div class="mission-dialog-choice"><div class="mission-dialog-choice__label">LevelScript 对话跳转</div><div class="mission-dialog-choice__buttons">${transitions}</div></div>` : '';
        return `<section class="mission-dialog-group" id="mission-dialog-${escapeHtml(group.id)}"><h2 class="mission-dialog-group__title"><span class="ake-ui-badge">剧情对话</span>${state.showHidden ? `<code>${escapeHtml(group.id)}</code>` : ''}${group.missing ? '<span class="ake-ui-badge">表中缺失</span>' : ''}</h2>${summaries}${lines || '<div class="mission-dialog-empty">找到了对话引用，但没有对应台词。</div>'}${options}${flow}</section>`;
    }

    function renderMissionEvent(event, groups, auxiliary) {
        const group = groups.get(event.id);
        const position = event.position && ['x', 'y', 'z'].every(axis => Number.isFinite(Number(event.position[axis])))
            ? ` · ${['x', 'y', 'z'].map(axis => Number(event.position[axis]).toFixed(1)).join(', ')}` : '';
        const scene = auxiliary.LevelDescTable?.[event.sceneId]?.showName?.text || (state.showHidden ? event.sceneId : '场景');
        const label = event.kind === 'cutscene' ? '剧情过场' : '引导教学';
        const title = event.titleKey ? (state.textTable?.[event.titleKey]?.text || (state.showHidden ? event.titleKey : '')) : '';
        const content = group ? renderDialogueGroup(group)
            : `<div class="mission-dialog-group"><span class="ake-ui-badge">${label}</span>${title ? ` ${richText(title)}` : ''}${state.showHidden ? ` <code>${escapeHtml(event.id)}</code>` : ''}</div>`;
        return `<div class="mission-objective__meta">${escapeHtml(scene)}${escapeHtml(position)}</div>${content}`;
    }

    function renderStepEnemies(enemies, auxiliary) {
        const fixed = new Map();
        enemies.fixed.forEach(enemy => {
            const key = `${enemy.entityDataIdKey}:${enemy.level}`;
            if (!enemy.entityDataIdKey) return;
            if (!fixed.has(key)) fixed.set(key, { id: enemy.entityDataIdKey, level: enemy.level, count: 0 });
            fixed.get(key).count++;
        });
        const waves = new Map();
        enemies.waves.forEach(enemy => {
            const key = `${enemy.configId}:${enemy.wave}:${enemy.id}:${enemy.level}`;
            if (!waves.has(key)) waves.set(key, { ...enemy, count: 0 });
            waves.get(key).count += enemy.count;
        });
        const totals = new Map();
        [...fixed.values(), ...waves.values()].forEach(enemy => {
            const key = `${enemy.id}:${enemy.level}`;
            if (!totals.has(key)) totals.set(key, { id: enemy.id, level: enemy.level, count: 0 });
            totals.get(key).count += enemy.count;
        });
        const entry = enemy => {
            const name = auxiliary.EnemyTemplateDisplayInfoTable?.[enemy.id]?.name?.text || (state.showHidden ? enemy.id : '未命名敌人');
            const link = window.AKEUI.entryLinkHtml({ plugin: 'v3_enemy', id: enemy.id, label: name, contentHtml: escapeHtml(name) });
            return `${link} Lv.${escapeHtml(enemy.level ?? '?')} ×${escapeHtml(enemy.count)}`;
        };
        const parts = [];
        if (totals.size) parts.push(`出现敌人：${[...totals.values()].map(entry).join('、')}`);
        if (fixed.size) parts.push(`场景配置：${[...fixed.values()].map(entry).join('、')}`);
        if (waves.size) parts.push(`刷怪配置：${[...waves.values()].map(enemy => `配置第${escapeHtml(enemy.wave)}波 ${entry(enemy)}`).join('、')}`);
        return parts.join('<br>');
    }

    function bindDialogueActions(panel, data, refresh) {
        panel.querySelectorAll('[data-sns-option]').forEach(button => button.addEventListener('click', () => {
            const group = data.groups.find(item => item.kind === 'sns' && item.id === button.dataset.snsGroup);
            if (!group) return;
            selectSnsOption(group, button.dataset.snsContent, button.dataset.snsOption);
            refresh();
        }));
        panel.querySelectorAll('[data-dialog-target]').forEach(button => button.addEventListener('click', () => {
            const target = document.getElementById(`mission-dialog-${button.dataset.dialogTarget}`);
            if (!target) return;
            const step = target.closest('[data-mission-step]');
            if (step) step.open = true;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
    }

    function renderActivePanel(row) {
        const panel = document.getElementById('missionPanel');
        if (!panel) return;
        const token = ++state.renderToken;
        panel.innerHTML = '<div class="ake-ui-state" data-state="loading"><p>正在加载数据…</p></div>';
        renderQuestPanel(row, panel, token);
    }

    async function enrichDialogueSearch() {
        try {
            const tables = await ensureDialogue();
            const standardByMission = new Map();
            const currentRows = state.rows;
            const rowById = new Map(currentRows.map(row => [row.id, row]));
            const idsWithSeparator = currentRows.map(row => row.id).filter(id => id.includes('_')).sort((a, b) => b.length - a.length);
            const missionIdFromPrefixedKey = (key, prefix) => {
                const rest = String(key || '').slice(prefix.length);
                const direct = rest.split('_')[0];
                if (rowById.has(direct)) return direct;
                return idsWithSeparator.find(id => rest.startsWith(`${id}_`)) || '';
            };
            Object.entries(tables.DialogTextTable || {}).forEach(([id, line]) => {
                const missionId = missionIdFromPrefixedKey(id, 'dlg_');
                if (!missionId) return;
                if (!standardByMission.has(missionId)) standardByMission.set(missionId, []);
                standardByMission.get(missionId).push(line.actorName?.text, line.dialogText?.text);
            });
            Object.values(tables.SNSDialogTable || {}).forEach(dialog => {
                const missionId = dialog.relatedMissionId || missionIdFromPrefixedKey(dialog.dialogId, 'sns_');
                if (!missionId) return;
                if (!standardByMission.has(missionId)) standardByMission.set(missionId, []);
                Object.values(dialog.dialogContentData || {}).forEach(node => standardByMission.get(missionId).push(node.content?.text));
            });
            state.rows.forEach(row => {
                if (standardByMission.has(row.id)) row.searchText += `\n${standardByMission.get(row.id).filter(Boolean).join('\n').toLowerCase()}`;
            });
            if (state.search) renderList();
        } catch (error) {
            console.warn('无法为任务列表建立对话全文索引。', error);
        }
    }

    function installEvents() {
        elements.hidden.checked = state.showHidden;
        elements.search.addEventListener('input', () => { state.search = elements.search.value; renderList(); });
        elements.type.addEventListener('change', () => { state.type = elements.type.value; updateFilterSummary(); renderList(); });
        elements.chapter.addEventListener('change', () => { state.chapter = elements.chapter.value; updateFilterSummary(); renderList(); });
        elements.hidden.addEventListener('change', () => { state.showHidden = elements.hidden.checked; updateFilterSummary(); renderList(); });
        elements.home.addEventListener('click', renderOverview);
        elements.mobile.addEventListener('click', () => root.classList.add('is-mobile-open'));
        elements.backdrop.addEventListener('click', closeMobileList);
    }

    async function initialize() {
        try {
            if (!window.AKEV3?.table) throw new Error('AKEV3 数据适配层尚未加载');
            await loadCore();
            renderTypeOptions();
            installEvents();
            updateFilterSummary();
            const deepId = window.__deepLinkId;
            window.__deepLinkId = null;
            if (deepId) {
                const row = state.rows.find(item => item.id === deepId);
                if (row) await selectMission(row.id);
                else {
                    window.__akeRouter?.onDeepLinkNotFound?.(deepId, false);
                    renderOverview();
                }
            } else renderOverview();
            enrichDialogueSearch();
        } catch (error) {
            console.error('任务模块初始化失败', error);
            elements.detail.innerHTML = `<div class="ake-ui-state" data-state="error"><div><b>任务模块加载失败</b><br>${escapeHtml(error.message)}</div></div>`;
            elements.summary.textContent = '加载失败';
        }
    }

    window.__akeMission = { state, dialogueData, questEntries, collectRuntimeDialogueRefs, levelScriptDialogFlow, snsTimeline, selectSnsOption };
    initialize();
})();
