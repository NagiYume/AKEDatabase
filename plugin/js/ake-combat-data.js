(function () {
    if (window.AKECombatData) return;
    const sceneScriptCache = new Map();

    function constValue(parameter) {
        if (!parameter || typeof parameter !== 'object' || !Object.prototype.hasOwnProperty.call(parameter, 'constValue')) return undefined;
        if (parameter.paramSource !== undefined && parameter.paramSource !== 0) return undefined;
        return parameter.constValue;
    }

    function blackboardValue(row) {
        return row?.valueFloat ?? row?.valueDouble ?? row?.valueInt ?? row?.valueLong ?? row?.value ?? 0;
    }

    function configId(sceneId, spawnerId) {
        return `sc_${sceneId}_${spawnerId}`;
    }

    function actionNodes(script) {
        const data = script?.actionMap?.dataMap || {};
        return [...(data.headerList || []), ...(data.actionList || []), ...(data.getterList || [])];
    }

    function targetNode(parameter, byId) {
        if (!parameter) return null;
        if (parameter.idRef !== undefined && parameter.idRef !== -1) return byId.get(Number(parameter.idRef)) || null;
        const match = String(parameter.path || '').match(/^\$(\d+)@/);
        return match ? byId.get(Number(match[1])) || null : null;
    }

    function nodeSpawnerIds(node, byId, visited) {
        if (!node || visited.has(node)) return [];
        visited.add(node);
        if (node.$type?.includes('SpawnerGetSpawnedEntityList')) {
            const ptr = constValue(node._spawnerPtr);
            return ptr?.id ? [ptr.id] : [];
        }
        if (node.$type?.includes('OnSpawnerEntitySpawn')) {
            const filter = constValue(node._spawnerFilter);
            return filter?.id ? [filter.id] : [];
        }
        const ids = new Set();
        Object.values(node).forEach(value => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;
            const source = targetNode(value, byId);
            nodeSpawnerIds(source, byId, visited).forEach(id => ids.add(id));
        });
        return [...ids];
    }

    function targetSpawnerIds(action, byId) {
        const parameter = action._target || action._targets || action._targetEntity;
        return nodeSpawnerIds(targetNode(parameter, byId), byId, new Set());
    }

    function isPlayerTarget(action, byId) {
        const parameter = action._target || action._targets || action._targetEntity;
        const node = targetNode(parameter, byId);
        return Boolean(node?.$type && /GetSquadMembers|GetMainCharacter|GetAllCharacter/.test(node.$type));
    }

    function extractScriptBuffs(sceneId, script) {
        const nodes = actionNodes(script);
        const byId = new Map(nodes.filter(node => node?._ID !== undefined).map(node => [Number(node._ID), node]));
        const moduleSpawnerIds = [...new Set(Object.values(script.modules || {}).map(module => module.spawnerId).filter(Boolean))];
        const applications = [];
        const seen = new Set();
        (script.actionMap?.dataMap?.actionList || []).forEach(action => {
            if (!/AddBuffs?ToTargets?/.test(action.$type || '') || action.$type?.includes('AddGlobalBuff')) return;
            const buffId = constValue(action._buffId);
            if (!buffId || isPlayerTarget(action, byId)) return;
            let spawnerIds = targetSpawnerIds(action, byId);
            let confidence = 'exact';
            if (!spawnerIds.length && moduleSpawnerIds.length === 1) {
                spawnerIds = moduleSpawnerIds;
                confidence = 'script';
            }
            const blackboard = constValue(action._blackboardKVPairList) || [];
            spawnerIds.forEach(spawnerId => {
                const key = `${spawnerId}:${buffId}:${JSON.stringify(blackboard)}`;
                if (seen.has(key)) return;
                seen.add(key);
                applications.push({
                    buffId,
                    blackboard,
                    conditional: true,
                    scriptId: script.scriptId,
                    actionId: action._ID,
                    spawnerId,
                    configId: configId(sceneId, spawnerId),
                    confidence
                });
            });
        });
        return applications;
    }

    function indexScriptBuffs(sceneId, scripts) {
        const bySpawner = {};
        (scripts || []).forEach(script => extractScriptBuffs(sceneId, script).forEach(application => {
            bySpawner[application.configId] ||= [];
            bySpawner[application.configId].push(application);
        }));
        return bySpawner;
    }

    function extractScriptEnemies(script) {
        return Object.entries(script.enemies || {}).map(([slotId, enemy]) => ({
            enemyId: enemy.entityDataIdKey,
            level: Number(enemy.level || 0),
            buffs: enemy.buffs || [],
            scriptId: script.scriptId,
            slotId
        })).filter(enemy => enemy.enemyId);
    }

    function staticEnemyBuffs(dungeon, enemyId, level) {
        const matches = (dungeon?.LevelScriptEnemies || []).filter(enemy => enemy.enemyId === enemyId);
        const exact = matches.filter(enemy => Number(enemy.level) === Number(level));
        const selected = exact.length ? exact : (matches.length === 1 ? matches : []);
        return selected.flatMap(enemy => enemy.buffs || []);
    }

    function collectScriptBuffIds(dungeon) {
        return [
            ...Object.values(dungeon?.ScriptBuffsBySpawner || {}).flatMap(rows => rows.map(row => row.buffId)),
            ...(dungeon?.LevelScriptEnemies || []).flatMap(enemy => (enemy.buffs || []).map(row => row.buffId))
        ];
    }

    async function loadSceneScriptBuffs(sceneId) {
        if (!sceneId) return {};
        if (!sceneScriptCache.has(sceneId)) {
            sceneScriptCache.set(sceneId, (async () => {
                const manifest = await window.akeAssetIndex.listJsonFiles(`LevelScriptData/${sceneId}`);
                const scripts = await Promise.all(manifest.filter(entry => !entry.hidden).map(async entry => {
                    if (window.akeDataLoader?.loadJson) return window.akeDataLoader.loadJson(entry.contentFile, { priority: 'dependency' });
                    const response = await (window.akeFetch || fetch)(entry.contentFile);
                    if (!response.ok) throw new Error(`LevelScript ${entry.id}: HTTP ${response.status}`);
                    return response.json();
                }));
                return { scriptBuffs: indexScriptBuffs(sceneId, scripts), enemies: scripts.flatMap(extractScriptEnemies) };
            })().catch(error => {
                sceneScriptCache.delete(sceneId);
                throw error;
            }));
        }
        return (await sceneScriptCache.get(sceneId)).scriptBuffs;
    }

    async function loadSceneScriptEnemies(sceneId) {
        if (!sceneId) return [];
        await loadSceneScriptBuffs(sceneId);
        return (await sceneScriptCache.get(sceneId)).enemies;
    }

    async function enrichDungeonScripts(detail) {
        await Promise.all(Object.values(detail?.dungeontable || {}).map(async dungeon => {
            if (!dungeon.sceneId) return;
            const [scriptBuffs, enemies] = await Promise.all([
                dungeon.ScriptBuffsBySpawner ? dungeon.ScriptBuffsBySpawner : loadSceneScriptBuffs(dungeon.sceneId),
                dungeon.LevelScriptEnemies ? dungeon.LevelScriptEnemies : loadSceneScriptEnemies(dungeon.sceneId)
            ]);
            dungeon.ScriptBuffsBySpawner = scriptBuffs;
            dungeon.LevelScriptEnemies = enemies;
        }));
        return detail;
    }

    window.AKECombatData = { blackboardValue, collectScriptBuffIds, configId, enrichDungeonScripts, extractScriptBuffs, extractScriptEnemies, indexScriptBuffs, loadSceneScriptBuffs, loadSceneScriptEnemies, staticEnemyBuffs };
})();
