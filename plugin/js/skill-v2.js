(function () {
    const t = window.akeI18n.scope('modules.skill');
    const commonT = window.akeI18n.scope('common');
    let manifestList = [];
    let rawAllSkills = [];
    let activeSkillId = null;
    let searchTerm = '';
    let isInitialized = false;
    let currentSkillData = null;
    let timelineHideNodesMode = false;

    const KEY_LABEL_MAP = {
        skillId: 'skillId',
        level: 'level',
        skillName: 'skillName',
        castType: 'castType',
        skillSpecification: 'skillSpecification',
        durationFrame: 'durationFrame',
        exclusiveFrame: 'exclusiveFrame',
        timelineActions: 'timelineActions',
        passiveEventActions: 'passiveEventActions',
        actionGroupData: 'actionGroupData',
        conditionAction: 'conditionAction',
        succeedActions: 'succeedActions',
        failActions: 'failActions',
        actionData: 'actionData',
        isEnable: 'isEnable',
        priorityLevel: 'priorityLevel',
        priorityOffset: 'priorityOffset',
        serverActionIndex: 'serverActionIndex',
        duration: 'duration',
        startTime: 'startTime',
        playbackSpeed: 'playbackSpeed',
        blendDuration: 'blendDuration',
        blendOut: 'blendOut',
        exitToIdle: 'exitToIdle',
        contextKey: 'contextKey',
        targetSettings: 'targetSettings',
        selectorData: 'selectorData',
        finderData: 'finderData',
        validatorData: 'validatorData',
        postProcessorData: 'postProcessorData',
        rotateType: 'rotateType',
        compareType: 'compareType',
        checkType: 'checkType',
        targetSource: 'targetSource',
        selectorOwner: 'selectorOwner',
        centerType: 'centerType',
        _startFrame: 'startFrame',
        _endFrame: 'endFrame',
        targetGroupKey: 'targetGroupKey',
        checkTarget: 'checkTarget',
        minNum: 'minNum',
        abilityEvent: 'abilityEvent',
        animName: 'animName',
        cooldownTime: 'cooldownTime',
        castDistance: 'castDistance',
        costData: 'costData',
        costType: 'costType',
        costValue: 'costValue',
        atbValueThreshold: 'atbValueThreshold',
        canMove: 'canMove',
        canCastInAir: 'canCastInAir',
        passiveSkillType: 'passiveSkillType'
    };

    const VALUE_LABEL_MAP = {
        Active: 'active',
        Passive: 'passive',
        CharacterNormalSkill: 'characterNormalSkill',
        Default: 'default',
        UltimateSp: 'ultimateSp',
        RotateToTarget: 'rotateToTarget',
        RotateToMoveDirection: 'rotateToMoveDirection',
        GE: 'ge',
        LE: 'le',
        EQ: 'eq',
        HasAny: 'hasAny',
        Context: 'context',
        Source: 'source',
        Owner: 'owner',
        Target: 'target',
        ActionSource: 'actionSource',
        ContextTarget: 'contextTarget'
    };

    function htmlMessage(key, params) {
        return escapeHtml(t(key, params));
    }

    function emptyHtml(key, params) {
        return '<div class="skillv2-empty">' + htmlMessage(key, params) + '</div>';
    }

    function loaderHtml(key, params) {
        return '<div class="loader">' + htmlMessage(key, params) + '</div>';
    }

    function labelKey(key) {
        return 'labels.keys.' + key;
    }

    function valueKey(key) {
        return 'labels.values.' + key;
    }

    function categoryLabel(key) {
        return t('categories.' + key);
    }

    function getCurrentShowHidden() {
        return window.akeData?.getConfig().showHidden ?? false;
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeJson(value) {
        try {
            return JSON.stringify(value, null, 2);
        } catch (err) {
            return String(value);
        }
    }

    function formatType(typeText) {
        if (!typeText) return 'UnknownAction';
        const typePart = String(typeText).split(',')[0] || String(typeText);
        const plusParts = typePart.split('+').map(part => part.split('.').pop()).filter(Boolean);
        if (plusParts.length <= 1) return plusParts[0] || typePart;

        const root = plusParts[0];
        const nested = plusParts.slice(1).filter(part => part !== 'Data' && part !== (root + 'Data'));
        return nested.length ? (root + '.' + nested.join('.')) : root;
    }

    function normalizeManifest(list) {
        const showHidden = getCurrentShowHidden();
        const visible = showHidden ? list : list.filter(item => !item.hidden);
        visible.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999));
        return visible;
    }

    function filterList(list) {
        if (!searchTerm) return list;
        const term = searchTerm.toLowerCase();
        return list.filter(item => {
            const id = String(item.id || '').toLowerCase();
            const name = String(item.name || '').toLowerCase();
            return window.AKEModuleSearch.matches(id, term) || window.AKEModuleSearch.matches(name, term);
        });
    }

    async function fetchManifest() {
        const json = await window.akeAssetIndex.listJsonFiles('SkillData', { hidden: getCurrentShowHidden() });
        rawAllSkills = json || [];
        return normalizeManifest(rawAllSkills);
    }

    async function fetchSkillData(contentFile) {
        const res = await (window.akeFetch || fetch)(contentFile);
        if (!res.ok) throw new Error('无法加载技能详情: ' + contentFile);
        return res.json();
    }

    function renderList() {
        const listEl = document.getElementById('skillv2List');
        const metaEl = document.getElementById('skillv2ListMeta');
        const mainEl = document.getElementById('skillv2Main');
        if (!listEl || !metaEl || !mainEl) return;

        const filtered = filterList(manifestList);
        metaEl.textContent = t('list.count', { count: filtered.length });
        listEl.innerHTML = '';

        if (filtered.length === 0) {
            listEl.innerHTML = loaderHtml('noMatches');
            mainEl.innerHTML = loaderHtml('select');
            activeSkillId = null;
            return;
        }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'skillv2-item' + (item.id === activeSkillId ? ' active' : '');
            div.dataset.id = item.id;
            div.innerHTML = `
                <div class="skillv2-item-title">${escapeHtml(item.name || item.id)}</div>
                <div class="skillv2-item-sub">${escapeHtml(item.id)}</div>
            `;
            div.addEventListener('click', () => {
                activeSkillId = item.id;
                if (window.__akeRouter) window.__akeRouter.updateUrl('skill_v2', item.id);
                highlightActive();
                loadSkillDetail(item);
            });
            listEl.appendChild(div);
        });

        if (window.__deepLinkId) {
            const deepItem = filtered.find(c => c.id === window.__deepLinkId);
            if (deepItem) {
                activeSkillId = deepItem.id;
            } else {
                const existsInRaw = rawAllSkills.some(c => c.id === window.__deepLinkId);
                if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                    window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                }
            }
            window.__deepLinkId = null;
        }

        if (!filtered.some(s => s.id === activeSkillId)) {
            activeSkillId = filtered[0].id;
            if (window.__akeRouter) window.__akeRouter.updateUrl('skill_v2', activeSkillId);
            highlightActive();
            loadSkillDetail(filtered[0]);
        } else {
            if (window.__akeRouter) window.__akeRouter.updateUrl('skill_v2', activeSkillId);
        }

        buildMobileList();
    }

    function highlightActive() {
        document.querySelectorAll('.skillv2-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === activeSkillId);
        });
    }

    function summarizePrimitive(value) {
        if (value === null) return '<null>';
        if (value === undefined) return '<undefined>';
        const t = typeof value;
        if (t === 'string') return value.length > 120 ? value.slice(0, 120) + '...' : value;
        if (t === 'number' || t === 'boolean') return String(value);
        if (Array.isArray(value)) return '[Array(' + value.length + ')]';
        if (t === 'object') return '{Object}';
        return String(value);
    }

    function translateKey(key) {
        const mapped = KEY_LABEL_MAP[key];
        return mapped ? (t(labelKey(mapped)) + ' (' + key + ')') : key;
    }

    function translateValue(value) {
        if (typeof value === 'boolean') {
            return (value ? commonT('yes') : commonT('no')) + ' (' + String(value) + ')';
        }
        if (typeof value !== 'string') return summarizePrimitive(value);
        const mapped = VALUE_LABEL_MAP[value];
        if (!mapped) return summarizePrimitive(value);
        return t(valueKey(mapped)) + ' (' + value + ')';
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj || {}, key);
    }

    function isBlackboardValueRef(value) {
        return isPlainObject(value) && hasOwn(value, 'useBlackboardKey') && hasOwn(value, 'value') && hasOwn(value, 'blackboardKey');
    }

    function formatNumber(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return summarizePrimitive(value);
        return String(Math.round(num * 10000) / 10000);
    }

    function formatBlackboardEntry(entry) {
        if (!entry || typeof entry !== 'object') return '';
        const valueText = entry.valueStr ? entry.valueStr : formatNumber(entry.valueDouble ?? entry.value ?? 0);
        return valueText + (entry.isDynamic ? t('summary.dynamicSuffix') : '');
    }

    function getBlackboardMap(data) {
        const map = new Map();
        (data?.blackboard || []).forEach(item => {
            if (item && item.key) map.set(String(item.key), item);
        });
        return map;
    }

    function formatBlackboardValueRef(value, blackboardMap) {
        if (!isBlackboardValueRef(value)) return null;
        if (value.useBlackboardKey && value.blackboardKey) {
            const entry = blackboardMap?.get(String(value.blackboardKey));
            const resolved = entry ? ' = ' + formatBlackboardEntry(entry) : '';
            return 'BB(' + value.blackboardKey + ')' + resolved;
        }
        return formatNumber(value.value);
    }

    function formatVectorValue(value, blackboardMap) {
        if (!isPlainObject(value)) return null;
        const keys = ['x', 'y', 'z'];
        if (!keys.every(k => hasOwn(value, k))) return null;
        return keys.map(k => k + '=' + (formatBlackboardValueRef(value[k], blackboardMap) || summarizePrimitive(value[k]))).join(', ');
    }

    function getObjectTypeName(value) {
        return value?.$type ? formatType(value.$type) : '';
    }

    function summarizeShape(shape, blackboardMap) {
        if (!isPlainObject(shape)) return '';
        const parts = [];
        if (shape.shapeType) parts.push(shape.shapeType);
        if (shape.size) parts.push(t('summary.size', { value: formatVectorValue(shape.size, blackboardMap) || summarizePrimitive(shape.size) }));
        if (shape.radius) parts.push(t('summary.radius', { value: formatBlackboardValueRef(shape.radius, blackboardMap) || summarizePrimitive(shape.radius) }));
        if (shape.height) parts.push(t('summary.height', { value: formatBlackboardValueRef(shape.height, blackboardMap) || summarizePrimitive(shape.height) }));
        if (shape.centerOffset) parts.push(t('summary.offset', { value: formatVectorValue(shape.centerOffset, blackboardMap) || summarizePrimitive(shape.centerOffset) }));
        if (shape.positionRef) parts.push(t('summary.position', { value: shape.positionRef }));
        if (shape.directionRef) parts.push(t('summary.direction', { value: shape.directionRef }));
        return parts.filter(Boolean).join(' | ');
    }

    function summarizeSelector(selectorData, blackboardMap) {
        if (!isPlainObject(selectorData)) return '';
        const finder = selectorData.finderData || {};
        const parts = [];
        const finderType = getObjectTypeName(finder);
        if (finderType) parts.push(t('summary.finder', { value: finderType }));
        if (finder.factionTarget) parts.push('faction=' + finder.factionTarget);
        if (Array.isArray(finder.shapeList) && finder.shapeList.length) {
            const shapes = finder.shapeList.slice(0, 2).map(shape => summarizeShape(shape, blackboardMap)).filter(Boolean);
            parts.push(t('summary.shape', { value: shapes.join(' / ') + (finder.shapeList.length > 2 ? ' ...' : '') }));
        }
        if (Array.isArray(selectorData.validatorData) && selectorData.validatorData.length) {
            parts.push(t('summary.validators', { value: selectorData.validatorData.map(getObjectTypeName).filter(Boolean).join(', ') }));
        }
        if (Array.isArray(selectorData.postProcessorData) && selectorData.postProcessorData.length) {
            parts.push(t('summary.postProcessors', { value: selectorData.postProcessorData.map(getObjectTypeName).filter(Boolean).join(', ') }));
        }
        return parts.join(' | ');
    }

    function summarizeTargetSettings(target, blackboardMap) {
        if (!isPlainObject(target)) return '';
        const parts = [];
        ['targetSource', 'target', 'targetGroupKey', 'centerType', 'selectorOwner', 'selectorDirection'].forEach(key => {
            if (target[key]) parts.push(key + '=' + target[key]);
        });
        const selector = summarizeSelector(target.selectorData, blackboardMap);
        if (selector) parts.push(selector);
        return parts.join(' | ');
    }

    function summarizeStructuredValue(value, key, blackboardMap) {
        if (!value || typeof value !== 'object') return null;
        if (isBlackboardValueRef(value)) return formatBlackboardValueRef(value, blackboardMap);
        const vector = formatVectorValue(value, blackboardMap);
        if (vector) return vector;
        const lowerKey = String(key || '').toLowerCase();
        if (lowerKey.includes('selector') && value.finderData) return summarizeSelector(value, blackboardMap);
        if (lowerKey.includes('target') || lowerKey === 'source' || lowerKey === 'destination' || lowerKey === 'bornat' || lowerKey === 'moveto' || lowerKey === 'teleportto') {
            const target = summarizeTargetSettings(value, blackboardMap);
            if (target) return target;
        }
        if (value.shapeType) return summarizeShape(value, blackboardMap);
        return null;
    }

    function findFirstDeep(value, keys) {
        const wanted = new Set(keys || []);
        const seen = new Set();

        const walk = (node) => {
            if (!node || typeof node !== 'object' || seen.has(node)) return undefined;
            seen.add(node);
            if (!Array.isArray(node)) {
                for (const key of Object.keys(node)) {
                    const candidate = node[key];
                    const isEmptyArray = Array.isArray(candidate) && candidate.length === 0;
                    if (wanted.has(key) && candidate !== '' && candidate !== null && candidate !== undefined && !isEmptyArray) return candidate;
                }
            }
            const children = Array.isArray(node) ? node : Object.keys(node).map(k => node[k]);
            for (const child of children) {
                const found = walk(child);
                if (found !== undefined) return found;
            }
            return undefined;
        };

        return walk(value);
    }

    function summarizeAction(action) {
        const shortType = formatType(action?.$type || 'UnknownAction');
        if (action?.animName) return shortType + ': ' + action.animName;
        if (action?.abilityEvent) return shortType + ': ' + action.abilityEvent;
        if (action?.targetGroupKey) return shortType + ': ' + t('summary.target', { value: action.targetGroupKey });
        if (action?.costType) return shortType + ': ' + t('summary.cost', { value: action.costType });
        const effect = findFirstDeep(action, ['effectName', 'effectKey', 'effectId', 'effectPath']);
        if (effect) return shortType + ': ' + t('summary.effect', { value: summarizePrimitive(effect) });
        const sound = findFirstDeep(action, ['soundEvent', 'soundName', 'eventName', 'wwiseEvent']);
        if (sound) return shortType + ': ' + t('summary.sound', { value: summarizePrimitive(sound) });
        const buff = findFirstDeep(action, ['buffId', 'buffID', 'buffIds', 'buffIdList']);
        if (buff) return shortType + ': ' + t('summary.buff', { value: summarizePrimitive(buff) });
        const skill = findFirstDeep(action, ['skillId', 'castSkillId', 'abilityEntityId', 'entityId', 'projectileId']);
        if (skill) return shortType + ': ' + summarizePrimitive(skill);
        const atkScale = findFirstDeep(action, ['atkScale', 'damageScale', 'damageRate']);
        if (atkScale) return shortType + ': ' + t('summary.scale', { value: summarizePrimitive(atkScale) });
        return shortType;
    }

    function getIfElseBranchMeta(action) {
        if (!action || typeof action !== 'object') return null;
        const isIfElse = !!(action.conditionAction || action.succeedActions || action.failActions) || formatType(action.$type || '').toLowerCase().includes('ifelseaction');
        if (!isIfElse) return null;

        const cond = action.conditionAction?.actionData || [];
        const succ = action.succeedActions?.actionData || [];
        const fail = action.failActions?.actionData || [];

        const firstType = (arr) => {
            if (!Array.isArray(arr) || !arr.length) return commonT('none');
            return formatType(arr[0]?.$type || 'UnknownAction');
        };

        return {
            condCount: cond.length,
            succCount: succ.length,
            failCount: fail.length,
            condFirst: firstType(cond),
            succFirst: firstType(succ),
            failFirst: firstType(fail)
        };
    }

    const ACTION_CATEGORY_DEFS = [
        { key: 'anim', patterns: ['animation', 'animator', 'hurtanim', 'weaponvisible', 'weaponanimation', 'animeventreceiver', 'playperfectdodgeanim'] },
        { key: 'damage', patterns: ['damage', 'blowoff', 'pushback', 'pull', 'knockdown', 'launchupward', 'airborne', 'crushaction', 'fractureaction', 'igniteaction', 'recoverpoise'] },
        { key: 'buff', patterns: ['buff', 'superarmor', 'tagaction', 'addtag', 'auraaction', 'weakness', 'inherit', 'dynamicccs', 'finishangry', 'temporarilyunlock', 'temporaryunlock'] },
        { key: 'target', patterns: ['findtarget', 'selector', 'finder', 'validator', 'targetpostprocessor', 'targetpriorityfilter', 'mergetarget', 'savetargetdistance', 'picktarget', 'distance', 'shapefinder', 'interactiveshapefinder', 'hittableobjectvalidator'] },
        { key: 'move', patterns: ['move', 'jump', 'teleport', 'rootmotion', 'rotate', 'snaptotarget', 'lookataction', 'receivemoveinput', 'moveto', 'movetolocation', 'movetotarget', 'movetoslot', 'movetodirection'] },
        { key: 'camera', patterns: ['camera', 'timedilation', 'hitstop', 'ultimatetime', 'lockcamera', 'overridecamera', 'addcameracontrolstate', 'setignoreglobaltimescale'] },
        { key: 'av', patterns: ['playsound', 'voice', 'effect', 'raycasteffect', 'showhideactor', 'facbuildingplayanimation'] },
        { key: 'condition', patterns: ['ifelse', 'condition', 'check', 'compare', 'randomaction', 'switchaction', 'doonce', 'togglable', 'foreachaction', 'eventlistener', 'notnextcheck', 'probablity'] },
        { key: 'spawn', patterns: ['projectile', 'spawn', 'castskill', 'commandtocharacters', 'abilityentity', 'createadditionalbattleshape'] },
        { key: 'resource', patterns: ['blackboard', 'calc', 'calculation', 'obtaincost', 'setskillcd', 'atkscale', 'storeattribute', 'modifydynamicblackboard', 'multiplyattribute', 'instantmodifyattribute', 'savevalue'] },
        { key: 'misc', patterns: [] }
    ];

    function normalizeTypeForCategory(typeName) {
        return String(typeName || '')
            .replace(/\+|\.|,/g, ' ')
            .toLowerCase();
    }

    function getActionCategories(typeName) {
        const normalized = normalizeTypeForCategory(typeName);
        const matched = [];

        ACTION_CATEGORY_DEFS.forEach(def => {
            if (def.key === 'misc') return;
            if (def.patterns.some(p => normalized.includes(p))) {
                matched.push({ key: def.key, label: categoryLabel(def.key) });
            }
        });

        if (!matched.length) {
            const misc = ACTION_CATEGORY_DEFS.find(def => def.key === 'misc');
            return [{ key: misc.key, label: categoryLabel(misc.key) }];
        }

        return matched;
    }

    function getActionCategory(typeName) {
        return getActionCategories(typeName)[0];
    }

    function formatFrameDuration(frameCount) {
        const safe = Math.max(0, Math.floor(Number(frameCount) || 0));
        const seconds = Math.floor(safe / 30);
        const frames = safe % 30;
        return seconds + 's' + frames + 'f';
    }

    function collectActionTypesDeep(value, typeSet) {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(item => collectActionTypesDeep(item, typeSet));
            return;
        }
        if (typeof value !== 'object') return;

        if (value.$type) {
            typeSet.add(formatType(value.$type));
        }

        Object.keys(value).forEach(key => {
            const child = value[key];
            if (child && typeof child === 'object') {
                collectActionTypesDeep(child, typeSet);
            }
        });
    }

    function extractTimelineActionTypes(timeline) {
        const groupTypeList = [];
        const allTypeSet = new Set();

        (timeline || []).forEach(group => {
            const set = new Set();
            const actions = group?._sequenceActionData?.actionData || [];
            collectActionTypesDeep(actions, set);
            const types = Array.from(set).sort();
            groupTypeList.push(types);
            types.forEach(t => allTypeSet.add(t));
        });

        return {
            groupTypeList,
            allTypes: Array.from(allTypeSet).sort()
        };
    }

    function extractAllActionTypes(value) {
        const typeSet = new Set();
        collectActionTypesDeep(value, typeSet);
        return Array.from(typeSet).sort();
    }

    function analyzeTimeline(timeline) {
        const groups = Array.isArray(timeline) ? timeline : [];
        let negativeRanges = 0;
        let emptyGroups = 0;
        let unsortedPairs = 0;
        let lastStart = Number.NEGATIVE_INFINITY;

        groups.forEach(group => {
            const start = Number(group?._startFrame ?? 0);
            const end = Number(group?._endFrame ?? start);
            const actions = group?._sequenceActionData?.actionData || [];
            if (end < start) negativeRanges += 1;
            if (!actions.length) emptyGroups += 1;
            if (start < lastStart) unsortedPairs += 1;
            lastStart = start;
        });

        return { negativeRanges, emptyGroups, unsortedPairs };
    }

    function renderKeyValueRows(obj, omitKeys, blackboardMap) {
        const rows = [];
        const omitted = new Set(omitKeys || []);

        const renderValueCell = (value, key) => {
            const translated = translateValue(value);
            const structuredSummary = summarizeStructuredValue(value, key, blackboardMap);
            const isComplex = value && typeof value === 'object';
            if (!isComplex) return escapeHtml(translated);

            const fullText = safeJson(value);
            return `
                <details class="skillv2-value-details">
                    <summary class="skillv2-value-summary" title="${escapeHtml(fullText)}">${escapeHtml(structuredSummary || translated)}</summary>
                    <pre class="skillv2-value-expanded">${escapeHtml(fullText)}</pre>
                </details>
            `;
        };

        Object.keys(obj || {}).forEach(key => {
            if (omitted.has(key)) return;
            const value = obj[key];
            rows.push(`
                <tr>
                    <td>${escapeHtml(translateKey(key))}</td>
                    <td>${renderValueCell(value, key)}</td>
                </tr>
            `);
        });
        if (!rows.length) {
            return emptyHtml('empty.noDisplayParams');
        }
        return `
            <table class="skillv2-table">
                <thead><tr><th>${htmlMessage('table.key')}</th><th>${htmlMessage('table.valueSummary')}</th></tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        `;
    }

    function renderActionSequence(actions, depth, pathLabel, blackboardMap) {
        if (!Array.isArray(actions) || actions.length === 0) {
            return emptyHtml('empty.noActionNodes');
        }

        return actions.map((action, index) => {
            const typeText = action?.$type || 'UnknownAction';
            const shortType = formatType(typeText);
            const category = getActionCategory(shortType);
            const nodePath = pathLabel + '.' + (index + 1);

            let branchHtml = '';
            const hasIfElse = !!(action && (action.conditionAction || action.succeedActions || action.failActions));
            if (hasIfElse) {
                branchHtml = `
                    <div class="skillv2-branch-wrap">
                        <div class="skillv2-branch-block">
                            <div class="skillv2-branch-title">${htmlMessage('branches.conditionAction')}</div>
                            ${renderActionSequence(action.conditionAction?.actionData || [], depth + 1, nodePath + '.if', blackboardMap)}
                        </div>
                        <div class="skillv2-branch-block">
                            <div class="skillv2-branch-title">${htmlMessage('branches.succeedActions')}</div>
                            ${renderActionSequence(action.succeedActions?.actionData || [], depth + 1, nodePath + '.then', blackboardMap)}
                        </div>
                        <div class="skillv2-branch-block">
                            <div class="skillv2-branch-title">${htmlMessage('branches.failActions')}</div>
                            ${renderActionSequence(action.failActions?.actionData || [], depth + 1, nodePath + '.else', blackboardMap)}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="skillv2-action-node cat-${category.key}" style="--depth:${depth};">
                    <div class="skillv2-action-head">
                        <span class="skillv2-action-index">${htmlMessage('node.named', { id: nodePath })}</span>
                        <span class="skillv2-action-type">${escapeHtml(shortType)}</span>
                        <span class="skillv2-action-cat">${escapeHtml(category.label)}</span>
                        <span class="skillv2-action-full">${escapeHtml(typeText)}</span>
                    </div>
                    <div class="skillv2-action-body">
                        <div class="skillv2-subtitle">${htmlMessage('titles.parameterSummary')}</div>
                        ${renderKeyValueRows(action || {}, ['$type', 'conditionAction', 'succeedActions', 'failActions'], blackboardMap)}
                        ${branchHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    function isIfElseAction(action) {
        if (!action || typeof action !== 'object') return false;
        if (action.conditionAction || action.succeedActions || action.failActions) return true;
        return formatType(action.$type || '').toLowerCase().includes('ifelseaction');
    }

    function renderFlowLeafNode(action, indexLabel) {
        const typeText = formatType(action?.$type || 'UnknownAction');
        const category = getActionCategory(typeText);
        return `<div class="skillv2-flow-step"><div class="skillv2-flow-node cat-${category.key}" title="${escapeHtml(category.label)} | ${escapeHtml(typeText)}">
            <div class="skillv2-flow-main">
                <span class="skillv2-flow-index">${escapeHtml(String(indexLabel || ''))}</span>
                <span>${escapeHtml(summarizeAction(action))}</span>
                <span class="skillv2-flow-cat">${escapeHtml(category.label)}</span>
            </div>
        </div></div>`;
    }

    function renderFlowSequenceRecursive(actions, prefix) {
        if (!Array.isArray(actions) || actions.length === 0) {
            return '<span class="skillv2-empty">' + htmlMessage('empty.noNodes') + '</span>';
        }

        let content = '';
        actions.forEach((action, idx) => {
            if (idx > 0) {
                content += '<span class="skillv2-flow-link" aria-hidden="true"></span>';
            }
            const indexLabel = (prefix || '') + (idx + 1);
            content += renderFlowActionRecursive(action, indexLabel, prefix + (idx + 1) + '.');
        });
        return `<div class="skillv2-flow-seq">${content}</div>`;
    }

    function renderFlowActionRecursive(action, indexLabel, nestedPrefix) {
        if (!isIfElseAction(action)) {
            return renderFlowLeafNode(action, indexLabel);
        }

        const condActions = action?.conditionAction?.actionData || [];
        const succActions = action?.succeedActions?.actionData || [];
        const failActions = action?.failActions?.actionData || [];
        const condSummary = condActions.length
            ? condActions.slice(0, 2).map(a => summarizeAction(a)).join(' / ') + (condActions.length > 2 ? ' ...' : '')
            : t('empty.noCondition');
        const ifTypeText = formatType(action?.$type || 'IfElseAction');
        const category = getActionCategory(ifTypeText);

        const ifNode = `<div class="skillv2-flow-node cat-${category.key} has-branch" title="${escapeHtml(category.label)} | ${escapeHtml(ifTypeText)}">
            <div class="skillv2-flow-main">
                <span class="skillv2-flow-index">${escapeHtml(String(indexLabel || ''))}</span>
                <span>${escapeHtml(summarizeAction(action))}</span>
                <span class="skillv2-flow-cat">${escapeHtml(category.label)}</span>
            </div>
            <div class="skillv2-flow-if-cond">${htmlMessage('summary.condition', { value: condSummary })}</div>
        </div>`;

        const thenSequence = renderFlowSequenceRecursive(succActions, (nestedPrefix || '') + 'T');
        const elseSequence = renderFlowSequenceRecursive(failActions, (nestedPrefix || '') + 'F');

        return `<div class="skillv2-flow-step skillv2-flow-step-ifelse">
            <div class="skillv2-flow-ifelse">
                <div class="skillv2-flow-ifelse-frame-title">IfElseAction</div>
                <div class="skillv2-flow-if-head">${ifNode}</div>
                <div class="skillv2-flow-branch-lanes">
                    <div class="skillv2-flow-branch-lane true">
                        <div class="skillv2-flow-branch-entry true">
                            <span class="skillv2-flow-branch-text true">${escapeHtml(commonT('yes'))}</span>
                            <span class="skillv2-flow-link" aria-hidden="true"></span>
                        </div>
                        <div class="skillv2-flow-branch-content">${thenSequence}</div>
                    </div>
                    <div class="skillv2-flow-branch-lane false">
                        <div class="skillv2-flow-branch-entry false">
                            <span class="skillv2-flow-branch-text false">${escapeHtml(commonT('no'))}</span>
                            <span class="skillv2-flow-link" aria-hidden="true"></span>
                        </div>
                        <div class="skillv2-flow-branch-content">${elseSequence}</div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function renderTimelineGraph(actionGroupData) {
        const timeline = actionGroupData?.timelineActions || [];
        if (!timeline.length) {
            return emptyHtml('empty.timelineGraphUnavailable');
        }

        const summarizeTimelineNodes = (actions) => {
            const list = Array.isArray(actions) ? actions : [];
            if (!list.length) return t('timeline.nodeSummaryEmpty');
            const head = list.slice(0, 4).map(a => summarizeAction(a)).join(' → ');
            const more = list.length > 4 ? t('timeline.nodeSummaryMore', { count: list.length }) : '';
            return t('timeline.nodeSummary', { summary: head, more });
        };

        const typeInfo = extractTimelineActionTypes(timeline);
        const groupTypeList = typeInfo.groupTypeList;
        const allCategoryMap = new Map();
        const groupCategoryList = groupTypeList.map(types => {
            const catSet = new Set();
            types.forEach(typeName => {
                const categories = getActionCategories(typeName);
                categories.forEach(c => {
                    catSet.add(c.key);
                    allCategoryMap.set(c.key, c.label);
                });
            });
            return Array.from(catSet);
        });

        let minFrame = Number.POSITIVE_INFINITY;
        let maxFrame = 0;
        timeline.forEach(group => {
            const s = Number(group?._startFrame ?? 0);
            const e = Number(group?._endFrame ?? s);
            if (s < minFrame) minFrame = s;
            if (e < minFrame) minFrame = e;
            if (e > maxFrame) maxFrame = e;
            if (s > maxFrame) maxFrame = s;
        });
        if (!Number.isFinite(minFrame)) minFrame = 0;
        const span = Math.max(1, maxFrame - minFrame);

        const lines = timeline.map((group, index) => {
            const s = Number(group?._startFrame ?? 0);
            const e = Number(group?._endFrame ?? s);
            const visualStart = Math.min(s, e);
            const left = ((visualStart - minFrame) / span) * 100;
            const rawDuration = e - s;
            const duration = Math.abs(rawDuration);
            const width = Math.max(0.35, (duration / span) * 100);
            const actions = group?._sequenceActionData?.actionData || [];
            const isSingleFrame = duration <= 1;
            const isInvalidRange = e < s;
            const groupTypes = groupTypeList[index] || [];
            const groupCats = groupCategoryList[index] || [];
            const groupTypeData = groupTypes.join('|');
            const groupCatData = groupCats.join('|');
            const nodes = renderFlowSequenceRecursive(actions, 'G' + (index + 1) + '.');
            const nodeSummary = summarizeTimelineNodes(actions);

            return `
                <div class="skillv2-timeline-line${isInvalidRange ? ' invalid-range' : ''}" data-group-index="${index}" data-start-frame="${s}" data-end-frame="${e}" data-action-types="${escapeHtml(groupTypeData)}" data-action-cats="${escapeHtml(groupCatData)}" data-node-summary="${escapeHtml(nodeSummary)}">
                    <div class="skillv2-timeline-label">${htmlMessage('timeline.groupShort', { id: index + 1 })}${isInvalidRange ? '<br><span class="skillv2-warn-text">' + htmlMessage('timeline.reversed') + '</span>' : ''}</div>
                    <div class="skillv2-timeline-body">
                        <div class="skillv2-timeline-track">
                            ${isSingleFrame
                                ? `<div class="skillv2-timeline-point" style="left:${left.toFixed(2)}%;" title="${htmlMessage('timeline.frame', { id: s })}"><span>F${s}</span></div>`
                                : `<div class="skillv2-timeline-seg${isInvalidRange ? ' invalid-range' : ''}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;">${s} - ${e}</div>`
                            }
                        </div>
                        <div class="skillv2-flow-row">
                            ${nodes || '<span class="skillv2-empty">' + htmlMessage('empty.noNodes') + '</span>'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const allCategories = Array.from(allCategoryMap.entries()).sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
        const filterButtons = allCategories.map(([key, label]) =>
            `<button class="skillv2-action-filter-btn" data-cat="${escapeHtml(key)}">${escapeHtml(label)}</button>`
        ).join('');

        const filterHtml = `
            <div class="skillv2-action-filter" id="skillv2ActionFilter">
                <div class="skillv2-action-filter-head">
                    <div class="skillv2-action-filter-title">${htmlMessage('filter.title')}</div>
                    <button class="skillv2-node-visibility-toggle" id="skillv2NodeVisibilityToggle" data-hide="${timelineHideNodesMode ? 'true' : 'false'}">${htmlMessage(timelineHideNodesMode ? 'buttons.showNodes' : 'buttons.hideNodes')}</button>
                </div>
                <div class="skillv2-action-filter-buttons">
                    <button class="skillv2-action-filter-btn active" data-cat="__ALL__">${escapeHtml(commonT('all'))}</button>
                    ${filterButtons}
                </div>
            </div>
        `;

        const toggleButton = timeline.length > 5
            ? '<button id="skillv2TimelineExpandBtn" class="skillv2-timeline-expand-btn" data-expanded="false">' + htmlMessage('buttons.expandAll') + '</button>'
            : '';

        return `
            <div class="skillv2-timeline-graph" id="skillv2TimelineGraph" data-hide-nodes="${timelineHideNodesMode ? 'true' : 'false'}">
                <div class="skillv2-timeline-axis">${htmlMessage('timeline.axis', { start: minFrame, end: maxFrame })}</div>
                ${filterHtml}
                <div class="skillv2-timeline-lines" id="skillv2TimelineLines">${lines}</div>
                ${toggleButton}
            </div>
        `;
    }

    function renderSingleTimelineGroupDetail(group, index, blackboardMap) {
        const actions = group?._sequenceActionData?.actionData || [];
        return `
            <div class="skillv2-time-group compact-open">
                <div class="skillv2-time-head">
                    <span>${htmlMessage('timeline.group', { id: index + 1 })}</span>
                    <span>${htmlMessage('timeline.frameRange', { start: group?._startFrame ?? '?', end: group?._endFrame ?? '?' })}</span>
                    <span>${htmlMessage('timeline.nodeCount', { count: actions.length })}</span>
                </div>
                <div class="skillv2-time-body">
                    ${renderActionSequence(actions, 0, 'T' + (index + 1), blackboardMap)}
                </div>
            </div>
        `;
    }

    function updateTimelineDetailFromSelection() {
        const panel = document.getElementById('skillv2TimelineDetailPanel');
        if (!panel) return;

        const selectedLine = document.querySelector('.skillv2-timeline-line.selected');
        if (!selectedLine || selectedLine.style.display === 'none') {
            panel.innerHTML = emptyHtml('empty.selectTimelineGroup');
            return;
        }

        const groups = currentSkillData?.actionGroupData?.timelineActions || [];
        const index = Number(selectedLine.dataset.groupIndex);
        if (!Number.isFinite(index) || !groups[index]) {
            panel.innerHTML = emptyHtml('empty.timelineGroupUnavailable');
            return;
        }

        panel.innerHTML = renderSingleTimelineGroupDetail(groups[index], index, getBlackboardMap(currentSkillData));
    }

    function bindTimelineInteractions() {
        const lines = document.querySelectorAll('.skillv2-timeline-line');
        if (!lines.length) return;

        const inHideMode = () => {
            const graph = document.getElementById('skillv2TimelineGraph');
            return graph?.dataset.hideNodes === 'true';
        };

        const applyNodeVisibilityMode = () => {
            const hidden = inHideMode();
            const pinned = document.querySelector('.skillv2-timeline-line.nodes-pinned');
            lines.forEach(line => {
                line.classList.remove('nodes-hover');
                if (!hidden) {
                    line.classList.remove('nodes-collapsed');
                    line.classList.remove('nodes-pinned');
                    return;
                }
                const keep = pinned && pinned === line;
                line.classList.toggle('nodes-collapsed', !keep);
            });
        };

        lines.forEach(line => {
            line.addEventListener('click', () => {
                if (line.style.display === 'none') return;

                const alreadySelected = line.classList.contains('selected');
                document.querySelectorAll('.skillv2-timeline-line.selected').forEach(n => n.classList.remove('selected'));

                if (!alreadySelected) {
                    line.classList.add('selected');
                }

                if (inHideMode()) {
                    document.querySelectorAll('.skillv2-timeline-line.nodes-pinned').forEach(n => n.classList.remove('nodes-pinned'));
                    if (!alreadySelected) {
                        line.classList.add('nodes-pinned');
                    }
                }

                updateTimelineDetailFromSelection();
                applyNodeVisibilityMode();
            });
        });

        applyNodeVisibilityMode();
    }

    function bindNodeVisibilityToggle() {
        const graph = document.getElementById('skillv2TimelineGraph');
        const btn = document.getElementById('skillv2NodeVisibilityToggle');
        if (!graph || !btn) return;

        const apply = () => {
            graph.dataset.hideNodes = timelineHideNodesMode ? 'true' : 'false';
            btn.dataset.hide = timelineHideNodesMode ? 'true' : 'false';
            btn.textContent = t(timelineHideNodesMode ? 'buttons.showNodes' : 'buttons.hideNodes');

            const lines = Array.from(document.querySelectorAll('.skillv2-timeline-line'));
            const selected = document.querySelector('.skillv2-timeline-line.selected');
            lines.forEach(line => {
                line.classList.remove('nodes-hover');
                line.classList.remove('nodes-pinned');
                if (!timelineHideNodesMode) {
                    line.classList.remove('nodes-collapsed');
                    return;
                }
                const keep = selected && selected === line && line.style.display !== 'none';
                if (keep) {
                    line.classList.add('nodes-pinned');
                    line.classList.remove('nodes-collapsed');
                } else {
                    line.classList.add('nodes-collapsed');
                }
            });
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            timelineHideNodesMode = !timelineHideNodesMode;
            apply();
        });

        apply();
    }

    function bindTimelineTooltip() {
        const tooltip = document.getElementById('skillv2TimelineTooltip');
        const lines = document.querySelectorAll('.skillv2-timeline-line');
        if (!tooltip || !lines.length) return;

        const show = (line, event) => {
            const start = line.dataset.startFrame || '?';
            const end = line.dataset.endFrame || '?';
            const nodeSummary = line.dataset.nodeSummary || t('timeline.nodeSummaryEmpty');
            const startNum = Number(start);
            const endNum = Number(end);
            const rawDurationFrame = (Number.isFinite(startNum) && Number.isFinite(endNum)) ? endNum - startNum : 0;
            const durationFrame = Math.abs(rawDurationFrame);
            const durationText = formatFrameDuration(durationFrame);
            const rangeNote = rawDurationFrame < 0 ? t('tooltip.invalidRangeNote') : '';
            tooltip.innerHTML = `
                <div class="skillv2-tooltip-line-main">${htmlMessage('tooltip.lineMain', { start, end, durationFrame, durationTime: durationText, note: rangeNote })}</div>
                <div class="skillv2-tooltip-line-node">${escapeHtml(nodeSummary)}</div>
            `;
            tooltip.classList.add('show');
            tooltip.setAttribute('aria-hidden', 'false');
            move(event);
        };

        const move = (event) => {
            const offset = 14;
            tooltip.style.left = event.clientX + offset + 'px';
            tooltip.style.top = event.clientY + offset + 'px';
        };

        const hide = () => {
            tooltip.classList.remove('show');
            tooltip.setAttribute('aria-hidden', 'true');
        };

        lines.forEach(line => {
            line.addEventListener('mouseenter', (event) => show(line, event));
            line.addEventListener('mousemove', move);
            line.addEventListener('mouseleave', hide);
        });
    }

    function bindFlowDragScroll() {
        const rows = document.querySelectorAll('.skillv2-flow-row');
        if (!rows.length) return;

        rows.forEach(row => {
            let dragging = false;
            let startX = 0;
            let startScrollLeft = 0;

            row.addEventListener('mousedown', (event) => {
                dragging = true;
                row.classList.add('dragging');
                startX = event.clientX;
                startScrollLeft = row.scrollLeft;
            });

            row.addEventListener('mousemove', (event) => {
                if (!dragging) return;
                event.preventDefault();
                const deltaX = event.clientX - startX;
                row.scrollLeft = startScrollLeft - deltaX;
            });

            const stopDrag = () => {
                dragging = false;
                row.classList.remove('dragging');
            };

            row.addEventListener('mouseleave', stopDrag);
            row.addEventListener('mouseup', stopDrag);
        });
    }

    function bindTimelineExpandButton() {
        const btn = document.getElementById('skillv2TimelineExpandBtn');
        const linesWrap = document.getElementById('skillv2TimelineLines');
        if (!btn || !linesWrap) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = btn.dataset.expanded === 'true';
            if (expanded) {
                linesWrap.classList.remove('expanded');
                btn.dataset.expanded = 'false';
                btn.textContent = t('buttons.expandAll');
            } else {
                linesWrap.classList.add('expanded');
                btn.dataset.expanded = 'true';
                btn.textContent = t('buttons.restoreScrollView');
            }
        });
    }

    function bindActionTypeFilter() {
        const filterRoot = document.getElementById('skillv2ActionFilter');
        const lines = Array.from(document.querySelectorAll('.skillv2-timeline-line'));
        if (!filterRoot || !lines.length) return;

        const buttons = Array.from(filterRoot.querySelectorAll('.skillv2-action-filter-btn'));

        const applyFilter = (selectedCats) => {
            lines.forEach(line => {
                if (!selectedCats.size) {
                    line.style.display = 'grid';
                    return;
                }
                const cats = String(line.dataset.actionCats || '').split('|').filter(Boolean);
                const hit = cats.some(c => selectedCats.has(c));
                line.style.display = hit ? 'grid' : 'none';
            });
            document.querySelectorAll('.skillv2-timeline-line.selected').forEach(line => {
                if (line.style.display === 'none') line.classList.remove('selected');
            });

            if (timelineHideNodesMode) {
                const selected = document.querySelector('.skillv2-timeline-line.selected');
                lines.forEach(line => {
                    line.classList.remove('nodes-hover');
                    line.classList.remove('nodes-pinned');
                    if (line.style.display === 'none') {
                        line.classList.remove('nodes-collapsed');
                        return;
                    }
                    if (selected && selected === line) {
                        line.classList.add('nodes-pinned');
                        line.classList.remove('nodes-collapsed');
                    } else {
                        line.classList.add('nodes-collapsed');
                    }
                });
            }

            updateTimelineDetailFromSelection();
        };

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.cat || '__ALL__';
                const allBtn = buttons.find(b => (b.dataset.cat || '__ALL__') === '__ALL__');

                if (key === '__ALL__') {
                    buttons.forEach(b => b.classList.remove('active'));
                    if (allBtn) allBtn.classList.add('active');
                    applyFilter(new Set());
                    return;
                }

                btn.classList.toggle('active');
                if (allBtn) allBtn.classList.remove('active');

                const selected = new Set(
                    buttons
                        .filter(b => b.classList.contains('active') && (b.dataset.cat || '__ALL__') !== '__ALL__')
                        .map(b => b.dataset.cat)
                        .filter(Boolean)
                );

                if (!selected.size && allBtn) {
                    allBtn.classList.add('active');
                }

                applyFilter(selected);
            });
        });
    }

    function renderTimelineSection(actionGroupData, blackboardMap) {
        const timeline = actionGroupData?.timelineActions || [];
        if (!timeline.length) {
            return emptyHtml('empty.timelineActions');
        }

        return timeline.map((group, index) => {
            const actions = group?._sequenceActionData?.actionData || [];
            return `
                <div class="skillv2-time-group">
                    <div class="skillv2-time-head">
                        <span>${htmlMessage('timeline.group', { id: index + 1 })}</span>
                        <span>${htmlMessage('timeline.frameRange', { start: group?._startFrame ?? '?', end: group?._endFrame ?? '?' })}</span>
                        <span>${htmlMessage('timeline.nodeCount', { count: actions.length })}</span>
                    </div>
                    <div class="skillv2-time-body">
                        ${renderActionSequence(actions, 0, 'T' + (index + 1), blackboardMap)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPassiveEventsSection(actionGroupData, blackboardMap) {
        const events = actionGroupData?.passiveEventActions || [];
        if (!events.length) {
            return emptyHtml('empty.passiveEventActions');
        }

        return events.map((eventItem, eventIndex) => {
            const actionWrappers = Array.isArray(eventItem?.actions) ? eventItem.actions : [];
            const blocks = actionWrappers.map((wrap, idx) => {
                const actions = wrap?.actionData || [];
                return `
                    <div class="skillv2-passive-block">
                        <div class="skillv2-passive-title">${htmlMessage('passive.triggerSequence', { id: idx + 1, count: actions.length })}</div>
                        ${renderActionSequence(actions, 0, 'P' + (eventIndex + 1) + '.' + (idx + 1), blackboardMap)}
                    </div>
                `;
            }).join('');

            return `
                <div class="skillv2-passive-event">
                    <div class="skillv2-passive-head">${htmlMessage('passive.event', { id: eventIndex + 1, name: eventItem?.abilityEvent || 'Unknown' })}</div>
                    ${blocks || emptyHtml('empty.passiveEventNoActions')}
                </div>
            `;
        }).join('');
    }

    function renderPill(label, value) {
        return `
            <div class="skillv2-pill">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
            </div>
        `;
    }

    function renderMetricGrid(items) {
        return `<div class="skillv2-metric-grid">${items.map(item => renderPill(item[0], translateValue(item[1]))).join('')}</div>`;
    }

    function renderBlackboardSection(data) {
        const blackboard = Array.isArray(data?.blackboard) ? data.blackboard : [];
        if (!blackboard.length) {
            return emptyHtml('empty.blackboard');
        }

        const rows = blackboard.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td><code>${escapeHtml(item?.key || '')}</code></td>
                <td>${escapeHtml(formatBlackboardEntry(item))}</td>
                <td>${htmlMessage(item?.isDynamic ? 'blackboard.dynamic' : 'blackboard.fixed')}</td>
            </tr>
        `).join('');

        return `
            <table class="skillv2-table skillv2-blackboard-table">
                <thead><tr><th>#</th><th>${htmlMessage('table.key')}</th><th>${htmlMessage('table.value')}</th><th>${htmlMessage('table.type')}</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    function renderCastSection(data, blackboardMap) {
        const castData = data?.castData || {};
        const distance = formatBlackboardValueRef(castData.castDistance, blackboardMap) || summarizePrimitive(castData.castDistance);
        const height = formatBlackboardValueRef(castData.heightDiffLimit, blackboardMap) || summarizePrimitive(castData.heightDiffLimit);
        return `
            <div class="skillv2-structured-grid">
                <div class="skillv2-structured-panel">
                    <div class="skillv2-structured-title">${htmlMessage('titles.castRules')}</div>
                    ${renderMetricGrid([
                        [t('metrics.distanceCheck'), castData.checkCastDistanceType ?? ''],
                        [t('metrics.customDistance'), castData.useCustomCastDistance ?? false],
                        [t('metrics.castDistance'), distance],
                        [t('metrics.heightDiffCheck'), castData.checkHeightDiff ?? false],
                        [t('metrics.heightDiffLimit'), height],
                        [t('metrics.rotation'), castData.rotateType ?? ''],
                        [t('metrics.angle'), castData.castAngle ?? ''],
                        [t('metrics.cooldown'), castData.cooldownTime ?? 0],
                        [t('metrics.startCdFrame'), castData.startCdFrame ?? 0],
                        [t('metrics.maxCharge'), castData.maxChargeTime ?? 0]
                    ])}
                </div>
                <div class="skillv2-structured-panel">
                    <div class="skillv2-structured-title">${htmlMessage('titles.cost')}</div>
                    ${renderKeyValueRows(castData.costData || {}, [], blackboardMap)}
                </div>
            </div>
        `;
    }

    function renderTagsSection(data) {
        const renderTagList = (tags) => {
            const list = Array.isArray(tags) ? tags : [];
            if (!list.length) return '<span class="skillv2-muted">' + escapeHtml(commonT('none')) + '</span>';
            return list.map(tag => `<span class="skillv2-tag">${escapeHtml(tag)}</span>`).join('');
        };

        return `
            <div class="skillv2-structured-grid">
                <div class="skillv2-structured-panel">
                    <div class="skillv2-structured-title">${htmlMessage('titles.skillTags')}</div>
                    <div class="skillv2-tag-list">${renderTagList(data?.skillTags?.predefinedTag)}</div>
                </div>
                <div class="skillv2-structured-panel">
                    <div class="skillv2-structured-title">${htmlMessage('titles.tagDuringAttach')}</div>
                    <div class="skillv2-tag-list">${renderTagList(data?.tagDuringAttach?.predefinedTag)}</div>
                </div>
            </div>
        `;
    }

    function renderDataMap(data, blackboardMap) {
        const actionGroupData = data?.actionGroupData || {};
        const timeline = actionGroupData.timelineActions || [];
        const passiveEvents = actionGroupData.passiveEventActions || [];
        const actionTypes = extractAllActionTypes(actionGroupData);
        const categories = new Map();
        actionTypes.forEach(typeName => getActionCategories(typeName).forEach(cat => categories.set(cat.key, cat.label)));
        const timelineHealth = analyzeTimeline(timeline);

        const basicFields = [
            [t('metrics.iconBackground'), data?.iconBgType],
            [t('metrics.attackRange'), data?.attackRangeType],
            [t('metrics.selectStrategy'), data?.selectStrategy],
            [t('metrics.smartTargetSelect'), data?.smartTargetSelectStrategy],
            [t('metrics.canDummyCast'), data?.canDummyCast],
            [t('metrics.canMove'), data?.canMove],
            [t('metrics.canCastInAir'), data?.canCastInAir],
            [t('metrics.rootMotionCliffCheck'), data?.rootMotionCliffCheck],
            [t('metrics.returnToIdle'), data?.characterReturnToIdle],
            [t('metrics.blackboardItems'), (data?.blackboard || []).length],
            [t('metrics.buffs'), (data?.buffs || []).length],
            [t('metrics.toggleBuffs'), (data?.toggleBuffs || []).length]
        ];

        const catTags = Array.from(categories.values()).map(label => `<span class="skillv2-tag">${escapeHtml(label)}</span>`).join('') || '<span class="skillv2-muted">' + htmlMessage('empty.noActionNodes') + '</span>';

        return `
            <div class="skillv2-card">
                <div class="skillv2-card-title">${htmlMessage('titles.dataMap')}</div>
                ${renderMetricGrid(basicFields)}
                <div class="skillv2-block-title">${htmlMessage('titles.actionTypeOverview')}</div>
                <div class="skillv2-tag-list">${catTags}</div>
                <div class="skillv2-block-title">${htmlMessage('titles.timelineHealth')}</div>
                ${renderMetricGrid([
                    [t('metrics.timelineGroups'), timeline.length],
                    [t('metrics.reversedFrameGroups'), timelineHealth.negativeRanges],
                    [t('metrics.emptyActionGroups'), timelineHealth.emptyGroups],
                    [t('metrics.unsortedNeighborGroups'), timelineHealth.unsortedPairs]
                ])}
                <div class="skillv2-block-title">${htmlMessage('titles.castData')}</div>
                ${renderCastSection(data, blackboardMap)}
                <div class="skillv2-block-title">${htmlMessage('titles.blackboard')}</div>
                ${renderBlackboardSection(data)}
                <div class="skillv2-block-title">${htmlMessage('titles.tags')}</div>
                ${renderTagsSection(data)}
                <div class="skillv2-block-title">${htmlMessage('titles.passiveEventSummary')}</div>
                ${passiveEvents.length
                    ? `<div class="skillv2-tag-list">${passiveEvents.map((eventItem, index) => `<span class="skillv2-tag">#${index + 1} ${escapeHtml(eventItem?.abilityEvent || 'Unknown')} (${(eventItem?.actions || []).length})</span>`).join('')}</div>`
                    : emptyHtml('empty.noPassiveEvents')}
            </div>
        `;
    }

    function renderAdditionalDataSection(data, blackboardMap) {
        const omitted = new Set(['skillId', 'level', 'skillName', 'castType', 'skillSpecification', 'durationFrame', 'exclusiveFrame', 'castData', 'actionGroupData', 'blackboard', 'skillTags', 'tagDuringAttach']);
        return `
            <div class="skillv2-card">
                <div class="skillv2-card-title">${htmlMessage('titles.otherTopLevelFields')}</div>
                ${renderKeyValueRows(data || {}, Array.from(omitted), blackboardMap)}
            </div>
        `;
    }

    function renderRawDataSection(data) {
        return `
            <div class="skillv2-card">
                <div class="skillv2-card-title">${htmlMessage('titles.rawData')}</div>
                <div class="skillv2-raw-note">${htmlMessage('raw.note')}</div>
                <details class="skillv2-raw-details">
                    <summary>${htmlMessage('buttons.expandRawJson')}</summary>
                    <pre class="skillv2-raw-json">${escapeHtml(safeJson(data))}</pre>
                </details>
            </div>
        `;
    }

    function renderJsonTree(value, keyPath, depth) {
        const safeDepth = depth || 0;
        const nextDepth = safeDepth + 1;

        if (value === null || value === undefined) {
            return `<span class="skillv2-json-primitive">${escapeHtml(String(value))}</span>`;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return `<span class="skillv2-json-primitive">${escapeHtml(String(value))}</span>`;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '<span class="skillv2-json-primitive">[]</span>';
            }
            const openByDefault = nextDepth <= 2 ? ' open' : '';
            const items = value.map((item, idx) => `
                <div class="skillv2-json-row">
                    <div class="skillv2-json-key">[${idx}]</div>
                    <div class="skillv2-json-value">${renderJsonTree(item, keyPath + '[' + idx + ']', nextDepth)}</div>
                </div>
            `).join('');
            return `
                <details class="skillv2-json-node"${openByDefault}>
                    <summary>${htmlMessage('json.array', { count: value.length })}</summary>
                    <div class="skillv2-json-children">${items}</div>
                </details>
            `;
        }

        const entries = Object.entries(value);
        if (!entries.length) {
            return '<span class="skillv2-json-primitive">{}</span>';
        }

        const openByDefault = nextDepth <= 2 ? ' open' : '';
        const content = entries.map(([k, v]) => `
            <div class="skillv2-json-row">
                <div class="skillv2-json-key">${escapeHtml(translateKey(k))}</div>
                <div class="skillv2-json-value">${renderJsonTree(v, keyPath + '.' + k, nextDepth)}</div>
            </div>
        `).join('');

        return `
            <details class="skillv2-json-node"${openByDefault}>
                <summary>${htmlMessage('json.object', { count: entries.length })}</summary>
                <div class="skillv2-json-children">${content}</div>
            </details>
        `;
    }

    function renderOverview(data, manifestItem) {
        const basic = [
            ['skillId', data?.skillId],
            ['level', data?.level],
            ['skillName', data?.skillName],
            ['castType', data?.castType],
            ['skillSpecification', data?.skillSpecification],
            ['durationFrame', data?.durationFrame],
            ['exclusiveFrame', data?.exclusiveFrame],
            ['timelineActions', data?.actionGroupData?.timelineActions?.length || 0],
            ['passiveEventActions', data?.actionGroupData?.passiveEventActions?.length || 0]
        ];

        const rows = basic.map(([k, v]) => `
            <tr><td>${escapeHtml(translateKey(k))}</td><td>${escapeHtml(translateValue(v))}</td></tr>
        `).join('');

        return `
            <div class="skillv2-card">
                <div class="skillv2-card-title">${htmlMessage('titles.overview')}</div>
                <div class="skillv2-overview-id">${escapeHtml(manifestItem?.id || data?.skillId || commonT('unknown'))}</div>
                <table class="skillv2-table">
                    <thead><tr><th>${htmlMessage('table.field')}</th><th>${htmlMessage('table.value')}</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    function renderDetail(data, manifestItem) {
        const actionGroupData = data?.actionGroupData || {};
        const blackboardMap = getBlackboardMap(data);
        return `
            <div class="skillv2-detail-wrap">
                ${renderOverview(data, manifestItem)}
                ${renderDataMap(data, blackboardMap)}

                <div class="skillv2-card">
                    <div class="skillv2-card-title">${htmlMessage('titles.actionGroupView')}</div>
                    <div class="skillv2-block-title">${htmlMessage('titles.timelineFlowGraph')}</div>
                    ${renderTimelineGraph(actionGroupData)}
                    <div class="skillv2-block-title">${htmlMessage('titles.timelineActionsDetail')}</div>
                    <div id="skillv2TimelineDetailPanel" class="skillv2-timeline-detail-panel">
                        ${emptyHtml('empty.timelineDetailInitial')}
                    </div>
                    <div class="skillv2-block-title">${htmlMessage('titles.passiveEventActions')}</div>
                    ${renderPassiveEventsSection(actionGroupData, blackboardMap)}
                </div>
                ${renderAdditionalDataSection(data, blackboardMap)}
                ${renderRawDataSection(data)}
            </div>
        `;
    }

    async function loadSkillDetail(item) {
        const main = document.getElementById('skillv2Main');
        if (!main) return;
        main.innerHTML = loaderHtml('loadingDetail');

        try {
            const data = await fetchSkillData(item.contentFile);
            currentSkillData = data;
            main.innerHTML = renderDetail(data, item);
            bindActionTypeFilter();
            bindNodeVisibilityToggle();
            bindTimelineInteractions();
            bindTimelineExpandButton();
            bindTimelineTooltip();
            bindFlowDragScroll();
        } catch (err) {
            currentSkillData = null;
            main.innerHTML = '<div class="error-message">' + htmlMessage('loadFailed', { message: err.message }) + '</div>';
        }
    }

    function buildMobileList() {
        const mobileContent = document.getElementById('skillv2MobileContent');
        if (!mobileContent) return;

        const filtered = filterList(manifestList);
        mobileContent.innerHTML = '';

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'skillv2-mobile-item' + (item.id === activeSkillId ? ' active' : '');
            div.innerHTML = `
                <div class="skillv2-mobile-item-title">${escapeHtml(item.name || item.id)}</div>
                <div class="skillv2-mobile-item-sub">${escapeHtml(item.id)}</div>
            `;
            div.addEventListener('click', () => {
                activeSkillId = item.id;
                if (window.__akeRouter) window.__akeRouter.updateUrl('skill_v2', item.id);
                highlightActive();
                loadSkillDetail(item);
                closeMobileList();
            });
            mobileContent.appendChild(div);
        });
    }

    function openMobileList() {
        buildMobileList();
        const overlay = document.getElementById('skillv2MobileOverlay');
        if (overlay) overlay.style.display = 'flex';
    }

    function closeMobileList() {
        const overlay = document.getElementById('skillv2MobileOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    async function refreshModule() {
        const list = await fetchManifest();
        manifestList = list;
        renderList();
    }

    async function initModule() {
        if (isInitialized) return;
        isInitialized = true;

        if (window.configLoaded) {
            await window.configLoaded;
        }

        window.addEventListener('globalConfigChanged', () => {
            searchTerm = '';
            const input = document.getElementById('skillv2SearchInput');
            if (input) input.value = '';
            refreshModule();
        });

        document.getElementById('skillv2SearchInput')?.addEventListener('input', (e) => {
            searchTerm = e.target.value || '';
            renderList();
        });

        document.getElementById('skillv2MobileBtn')?.addEventListener('click', openMobileList);
        document.getElementById('skillv2MobileOverlay')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'skillv2MobileOverlay') {
                closeMobileList();
            }
        });

        await refreshModule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModule);
    } else {
        initModule();
    }
})();
