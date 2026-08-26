(function () {
    'use strict';

    const MODULE_ID = 'character_skill_popup_generator';
    const IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites';
    const SKILL_ICON_ROOT = `${IMAGE_ROOT}/skillicon`;
    const ARTS_ROOT = '/public/images/assets/beyond/arts/ui/sprites';
    const SKILL_TYPES = [0, 1, 2, 3];
    const CONTENT_WIDTH = 664;
    const BACKGROUND_EXTENSION = 25;
    const OUTPUT_WIDTH = 714;
    const OUTPUT_SCALE = 2;
    const PADDING = Object.freeze({ left: 20, right: 20, top: 30, bottom: 28 });
    const TITLE_HEIGHT = 90;
    const DESCRIPTION_WIDTH = 622;
    const DESCRIPTION_MAX_HEIGHT = 320;
    const EXTRA_HEIGHT = 52;
    const DESCRIPTION_FONT_SIZE = 26;
    const DESCRIPTION_LINE_HEIGHT = 30.3;
    const FONT_FAMILY = '"HarmonyOS Sans SC Medium", "Microsoft YaHei", sans-serif';
    const MAX_SKILL_LEVEL = 12;
    const SKILL_DEFAULT_COLOR = '#d6d6d6';
    const SKILL_DAMAGE_COLORS = Object.freeze({
        0: '#d6d6d6',
        1: '#ffffff',
        2: '#ff623d',
        3: '#ffc000',
        4: '#21c6d0',
        5: '#db8cff',
        6: '#abbf00',
        7: '#b58cff'
    });
    const DAMAGE_TYPE_NAMES = Object.freeze({
        0: 'Physical',
        1: 'Real',
        2: 'Fire',
        3: 'Pulse',
        4: 'Cryst',
        5: 'LifeDrain',
        6: 'Natural',
        7: 'Ether'
    });
    const DAMAGE_TYPE_IDS = Object.freeze({
        Physical: 0,
        Real: 1,
        Fire: 2,
        Pulse: 3,
        Cryst: 4,
        Crystal: 4,
        LifeDrain: 5,
        Lifedrain: 5,
        Natural: 6,
        Ether: 7
    });
    const UI_ASSETS = Object.freeze({
        overlayMask: `${ARTS_ROOT}/charinfo/mainnew/deco_bg03.png`,
        blurMask: '/public/images/assets/beyond/dynamicassets/gameplay/ui/prefabs/nonnarrative/bg_white_full.png',
        cornerDeco: `${ARTS_ROOT}/charinfo/main/deco_levebreak_01.png`,
        cornerDecoLine: `${ARTS_ROOT}/charinfo/mainnew/deco_num03.png`,
        elitePolygon: `${ARTS_ROOT}/common/square/bg_common_polygon_00_00_00_00_p2.png`,
        rankDecoration: `${ARTS_ROOT}/common/deco_common_05.png`,
        proficientIcon: `${ARTS_ROOT}/charinfo/skill/icon_proficient.png`,
        arrow: `${ARTS_ROOT}/charinfo/mainnew/deco_arrow01.png`
    });
    const UI_SOURCE_RECTS = Object.freeze({
        overlayMask: { x: 1, y: 3, width: 80, height: 80 },
        blurMask: { x: 1, y: 3, width: 64, height: 64 },
        cornerDeco: { x: 1, y: 1, width: 26, height: 18 },
        cornerDecoLine: { x: 1, y: 4, width: 46, height: 7 },
        elitePolygon: { x: 1, y: 1, width: 53, height: 50 },
        rankDecoration: { x: 1, y: 2, width: 94, height: 9 },
        proficientIcon: { x: 0, y: 0, width: 44, height: 44 },
        arrow: { x: 1, y: 2, width: 50, height: 53 }
    });
    const UI_SLICE_BORDERS = Object.freeze({
        overlayMask: { left: 35, right: 37, top: 37, bottom: 34 },
        blurMask: { left: 15, right: 15, top: 14, bottom: 13 },
        blurMaskDestination: { left: 30, right: 30, top: 28, bottom: 26 }
    });
    const BLUR_KERNEL = Object.freeze([0.016216, 0.054054, 0.121622, 0.194595, 0.227027, 0.194595, 0.121622, 0.054054, 0.016216]);
    const BLUR_DOWNSAMPLE_FACTORS = Object.freeze([4, 8, 16]);
    const BLUR_RADIUS = Math.floor(BLUR_KERNEL.length / 2);
    const BLUR_PADDING = BLUR_RADIUS * BLUR_DOWNSAMPLE_FACTORS.reduce((sum, factor) => sum + factor, 0);

    window.AKEMisc.register(MODULE_ID, async function (context) {
        const root = context.root;
        const canvas = root.querySelector('#miscSkillPopupCanvas');
        const canvasContext = canvas?.getContext('2d');
        const characterList = root.querySelector('#miscSkillPopupCharacterList');
        const characterCount = root.querySelector('#miscSkillPopupCharacterCount');
        const characterSearch = root.querySelector('#miscSkillPopupCharacterSearch');
        const skillList = root.querySelector('#miscSkillPopupSkillList');
        const levelSelect = root.querySelector('#miscSkillPopupLevel');
        const lizhiyanConditions = root.querySelector('#miscSkillPopupLizhiyanConditions');
        const lizhiyanWill = root.querySelector('#miscSkillPopupLizhiyanWill');
        const lizhiyanWisd = root.querySelector('#miscSkillPopupLizhiyanWisd');
        const backgroundToggle = root.querySelector('#miscSkillPopupBackgroundToggle');
        const editorToggle = root.querySelector('#miscSkillPopupEditorToggle');
        const editorPanel = root.querySelector('#miscSkillPopupEditor');
        const editorWarning = root.querySelector('#miscSkillPopupEditorWarning');
        const editorName = root.querySelector('#miscSkillPopupEditorName');
        const editorBackground = root.querySelector('#miscSkillPopupEditorBackground');
        const editorChooseBackground = root.querySelector('#miscSkillPopupEditorChooseBackground');
        const editorClearBackground = root.querySelector('#miscSkillPopupEditorClearBackground');
        const editorStyle = root.querySelector('#miscSkillPopupEditorStyle');
        const editorDescription = root.querySelector('#miscSkillPopupEditorDescription');
        const editorExtras = root.querySelector('#miscSkillPopupEditorExtras');
        const editorAddExtra = root.querySelector('#miscSkillPopupEditorAddExtra');
        const selectionLabel = root.querySelector('#miscSkillPopupSelection');
        const status = root.querySelector('#miscSkillPopupGeneratorStatus');
        const downloadButton = root.querySelector('#miscSkillPopupDownload');
        const imagePromises = new Map();
        const loadedImages = new Set();
        const downloadUrls = new Set();
        let characters = [];
        let selectedCharacterId = '';
        let selectedSkillType = 0;
        let selectedLevel = 1;
        let renderGeneration = 0;
        let renderReady = false;
        let downloading = false;
        let disposed = false;
        let richTextConfig = { hyperlinks: {}, styles: {} };
        let editorDocument = null;
        let editorEnabled = false;
        let backgroundEnabled = false;
        let backgroundFileName = '';
        let backgroundReadGeneration = 0;

        const t = (key, params, fallback) => window.akeI18n?.t(
            `modules.misc.characterSkillPopupGenerator.${key}`,
            params,
            fallback
        ) || fallback || key;
        const localizedText = (value, fallback) => context.text(value, fallback) || fallback || '';

        function setStatus(key, fallback, state, params) {
            status.textContent = t(key, params, fallback);
            status.dataset.state = state || '';
        }

        function dataResourceUrl(path) {
            return window.akeDataSource?.resolveUrl?.(path) || path;
        }

        function normalizeSearch(value) {
            return String(value || '').trim().toLocaleLowerCase();
        }

        function skillTypeLabel(type) {
            if (type === 'talent') return t('skillTypes.talent', null, '天赋');
            if (type === 'attributeNode') return t('skillTypes.attributeNode', null, '属性节点');
            const normalizedType = Number.isInteger(type) ? type : skillTypeId(type);
            return t({
                0: 'skillTypes.normalAttack',
                1: 'skillTypes.combatSkill',
                2: 'skillTypes.ultimate',
                3: 'skillTypes.comboSkill'
            }[normalizedType], null, {
                0: '普通攻击',
                1: '战技',
                2: '终结技',
                3: '连携技'
            }[normalizedType]);
        }

        function damageTypeId(value) {
            if (Number.isInteger(value)) return value;
            const numeric = Number(value);
            if (Number.isInteger(numeric)) return numeric;
            return DAMAGE_TYPE_IDS[String(value || '')] ?? 0;
        }

        function damageTypeName(value) {
            return DAMAGE_TYPE_NAMES[damageTypeId(value)] || DAMAGE_TYPE_NAMES[0];
        }

        function avatarPath(characterId) {
            return dataResourceUrl(`${IMAGE_ROOT}/charroundicon/icon_round_${characterId}.png`);
        }

        function portraitPath(characterId) {
            return dataResourceUrl(`${IMAGE_ROOT}/characterportrait/${characterId}.png`);
        }

        function skillPath(iconId) {
            return dataResourceUrl(`${SKILL_ICON_ROOT}/${iconId}.png`);
        }

        function uiAssetPath(name) {
            return dataResourceUrl(UI_ASSETS[name]);
        }

        function normalizeRichTextImagePath(path) {
            if (!path) return '';
            const value = String(path).replace(/^\/?public\/images\//, '');
            const withExtension = value.includes('.') ? value : `${value}.png`;
            const source = `/public/images/${withExtension}`;
            return window.resolveImagePath?.(source) || source;
        }

        function normalizeRichTextConfig(hyperlinkTable, styleTable) {
            const hyperlinks = Object.fromEntries(Object.entries(hyperlinkTable || {}).map(([id, row]) => [id, {
                iconPath: row?.iconPath ? normalizeRichTextImagePath(row.iconPath) : '',
                styleid: row?.richTextId || row?.styleid || '',
                name: localizedText(row?.name || row?.localizedName, id) || id
            }]));
            const styles = {};
            Object.entries(styleTable || {}).forEach(([id, row]) => {
                const style = { color: [], image: [], scale: [] };
                if (!Array.isArray(row?.preDef) && (row?.color?.length || row?.image?.length)) {
                    style.color = [...(row.color || [])];
                    style.image = [...(row.image || [])];
                    style.scale = [...(row.scale || [])];
                    styles[id] = style;
                    return;
                }
                (row?.preDef || []).slice(0, 2).forEach((definition, index) => {
                    const value = String(definition || '');
                    const color = value.match(/<color=([^>]+)>/);
                    const image = value.match(/<image="([^"]+)"\s+scale=([0-9.]+)>/);
                    if (color) style.color[index] = color[1];
                    if (image) {
                        style.image[index] = normalizeRichTextImagePath(image[1]);
                        style.scale[index] = Number(image[2]) || 1;
                    }
                });
                if (style.color.length || style.image.length) styles[id] = style;
            });
            return { hyperlinks, styles };
        }

        function richTextStyle(id) {
            return richTextConfig.styles?.[id] || null;
        }

        function richTextImageUrl(path) {
            return path ? dataResourceUrl(path) : '';
        }

        function selectedCharacter() {
            return characters.find(character => character.id === selectedCharacterId) || characters[0] || null;
        }

        function selectableSkills(character = selectedCharacter()) {
            if (!character) return [];
            return [
                ...SKILL_TYPES.map(type => character.groups.get(type)).filter(Boolean),
                ...(character.specialSkills || [])
            ];
        }

        function skillSelectionKey(skill) {
            return Number.isInteger(skill?.type) ? skill.type : skill?.key;
        }

        function selectedSkill() {
            const character = selectedCharacter();
            return character?.groups.get(selectedSkillType)
                || character?.specialSkills?.find(skill => skill.key === selectedSkillType)
                || null;
        }

        function selectedPatch() {
            const group = selectedSkill();
            return group?.patches.find(patch => patch.level === selectedLevel) || group?.patches[0] || null;
        }

        function isLizhiyanBranchGroup(character = selectedCharacter(), group = selectedSkill()) {
            return character?.id === 'chr_0032_lizhiyan' && group?.type === 3 && group.conditions?.length > 1;
        }

        function activeSkillConditionId(character = selectedCharacter(), group = selectedSkill()) {
            if (!isLizhiyanBranchGroup(character, group)) return '';
            const will = Math.max(0, Number(lizhiyanWill?.value) || 0);
            const wisd = Math.max(0, Number(lizhiyanWisd?.value) || 0);
            return will > wisd ? 'lizhiyan_will' : 'lizhiyan_wisd';
        }

        function lizhiyanConditionSummary(character = selectedCharacter(), group = selectedSkill()) {
            if (!isLizhiyanBranchGroup(character, group)) return '';
            const activeId = activeSkillConditionId(character, group);
            const activeCondition = group.conditions.find(condition => condition.id === activeId);
            const relation = activeId === 'lizhiyan_wisd' ? '智识值 ≥ 意志值' : '意志值 > 智识值';
            const name = localizedText(activeCondition?.name, activeId === 'lizhiyan_wisd' ? '阵诀·智' : '阵诀·意');
            return `${relation}，${name}生效中。\n`;
        }

        function conditionDescriptionText(group) {
            return (group?.conditions || []).map(condition => {
                const name = localizedText(condition.name, condition.id || t('condition', null, '条件'));
                const values = [
                    localizedText(condition.conditionDesc, ''),
                    localizedText(condition.description, '')
                ].filter(Boolean);
                return values.length ? `${name}：\n${values.join('\n')}` : '';
            }).filter(Boolean).join('\n');
        }

        function updateLizhiyanConditionInputs() {
            if (lizhiyanConditions) lizhiyanConditions.hidden = !isLizhiyanBranchGroup();
        }

        const SKILL_TYPE_NAMES = Object.freeze({
            0: 'NormalAttack',
            1: 'NormalSkill',
            2: 'UltimateSkill',
            3: 'ComboSkill'
        });

        function skillTypeId(value) {
            if (Number.isInteger(value)) return value;
            const enumValue = String(value || '');
            const index = Object.entries(SKILL_TYPE_NAMES).find(([, name]) => name === enumValue)?.[0];
            return index === undefined ? 0 : Number(index);
        }

        function skillTypeName(value) {
            if (value === 'talent' || value === 'attributeNode') return value;
            return SKILL_TYPE_NAMES[skillTypeId(value)] || SKILL_TYPE_NAMES[0];
        }

        function cloneEditorDocument(documentValue) {
            return {
                schemaVersion: 1,
                skillName: String(documentValue?.skillName || ''),
                skillType: skillTypeName(documentValue?.skillType),
                rank: Math.min(MAX_SKILL_LEVEL, Math.max(1, Number(documentValue?.rank) || 1)),
                rankLabel: String(documentValue?.rankLabel || ''),
                nodeLevel: Math.max(0, Math.min(4, Number(documentValue?.nodeLevel) || 0)),
                extraInfos: (Array.isArray(documentValue?.extraInfos) ? documentValue.extraInfos : [])
                    .map(item => ({
                        title: String(item?.title ?? item?.name ?? ''),
                        value: String(item?.value ?? '')
                    }))
                    .filter(item => item.title || item.value),
                description: String(documentValue?.description || ''),
                backgroundSource: String(documentValue?.backgroundSource || '')
            };
        }

        function presetEditorDocument(group, patch) {
            return cloneEditorDocument({
                skillName: localizedText(patch?.skillName, '') || group?.name || '',
                skillType: skillTypeName(group?.type),
                rank: Number(patch?.level) || 1,
                rankLabel: group?.rankLabel || '',
                nodeLevel: patch?.nodeLevel || group?.nodeLevel || 0,
                extraInfos: extraInfo(group, patch),
                description: skillDescription(group, patch),
                backgroundSource: ''
            });
        }

        function currentPopupDocument() {
            const group = selectedSkill();
            const patch = selectedPatch();
            if (!group || !patch) return null;
            if (editorEnabled && editorDocument) {
                const value = cloneEditorDocument(editorDocument);
                value.skillType = skillTypeName(group.type);
                value.rank = Number(patch.level) || 1;
                value.rankLabel = group.rankLabel || '';
                value.nodeLevel = patch.nodeLevel || group.nodeLevel || 0;
                return value;
            }
            return presetEditorDocument(group, patch);
        }

        function renderEditorStyleOptions() {
            if (!editorStyle) return;
            const options = [document.createElement('option')];
            options[0].value = '';
            options[0].textContent = t('defaultStyle', null, '默认文本');
            const styleGroup = document.createElement('optgroup');
            styleGroup.label = t('styleTable', null, 'RichTextStyleTable');
            Object.keys(richTextConfig.styles || {}).sort().forEach(id => {
                const option = document.createElement('option');
                option.value = `@${id}`;
                option.textContent = `@${id}`;
                applyEditorStyleOptionPreview(option, option.value);
                styleGroup.append(option);
            });
            const hyperlinkGroup = document.createElement('optgroup');
            hyperlinkGroup.label = t('hyperlinkTable', null, 'HyperlinkTextTable');
            Object.entries(richTextConfig.hyperlinks || {})
                .sort(([left], [right]) => left.localeCompare(right))
                .forEach(([id, value]) => {
                    const option = document.createElement('option');
                    option.value = `#${id}`;
                    option.textContent = `#${id}${value.name && value.name !== id ? ` · ${value.name}` : ''}`;
                    applyEditorStyleOptionPreview(option, option.value);
                    hyperlinkGroup.append(option);
                });
            editorStyle.replaceChildren(options[0], styleGroup, hyperlinkGroup);
        }

        function applyEditorStyleOptionPreview(option, value) {
            if (!option || !value) return;
            const isStyle = value.startsWith('@');
            const id = value.slice(1);
            const hyperlink = richTextConfig.hyperlinks?.[id];
            const definition = richTextStyle(isStyle ? id : hyperlink?.styleid);
            const color = definition?.color?.[1]
                || definition?.color?.[0]
                || (isStyle ? SKILL_DEFAULT_COLOR : tagColor(id, SKILL_DEFAULT_COLOR));
            const image = definition?.image?.[1]
                || definition?.image?.[0]
                || (!isStyle ? hyperlink?.iconPath : '');
            const scale = !isStyle && hyperlink?.iconPath
                ? 1.25
                : Number(definition?.scale?.[1] || definition?.scale?.[0]) || 1;
            if (color) option.dataset.akeUiRichColor = color;
            if (image) option.dataset.akeUiRichImage = richTextImageUrl(image);
            option.dataset.akeUiRichScale = String(scale);
            option.dataset.akeUiRichUnderline = String(!isStyle);
        }

        function renderEditorExtras() {
            if (!editorExtras) return;
            editorExtras.replaceChildren(...(editorDocument?.extraInfos || []).map((item, index) => {
                const wrapper = document.createElement('div');
                wrapper.dataset.extraIndex = String(index);
                const title = document.createElement('input');
                title.className = 'ake-ui-control';
                title.type = 'text';
                title.maxLength = 40;
                title.value = item.title;
                title.dataset.editorField = 'extra-title';
                title.setAttribute('aria-label', `${t('extraInfo', null, '附加信息')} ${index + 1}`);
                const value = document.createElement('input');
                value.className = 'ake-ui-control';
                value.type = 'text';
                value.maxLength = 40;
                value.value = item.value;
                value.dataset.editorField = 'extra-value';
                value.setAttribute('aria-label', `${t('valueLabel', null, '数值')} ${index + 1}`);
                const titleRow = document.createElement('div');
                titleRow.className = 'app-field';
                const titleLabel = document.createElement('label');
                titleLabel.className = 'app-field-label';
                titleLabel.textContent = `${t('extraInfo', null, '附加信息')} ${index + 1}`;
                titleRow.append(titleLabel, title);
                const valueRow = document.createElement('div');
                valueRow.className = 'app-field';
                const valueLabel = document.createElement('label');
                valueLabel.className = 'app-field-label';
                valueLabel.textContent = t('valueLabel', null, '数值');
                valueRow.append(valueLabel, value);
                const remove = document.createElement('button');
                remove.className = 'ake-ui-button ake-ui-button--icon ake-ui-button--secondary';
                remove.type = 'button';
                remove.dataset.removeExtra = String(index);
                remove.textContent = '×';
                remove.title = t('removeExtra', null, '删除附加信息');
                wrapper.append(titleRow, valueRow, remove);
                return wrapper;
            }));
        }

        function syncEditorForm() {
            const value = editorDocument || {
                skillName: '', skillType: skillTypeName(0), rank: 1, description: '', extraInfos: []
            };
            if (editorName) editorName.value = value.skillName;
            if (editorDescription) editorDescription.value = value.description;
            if (editorBackground) editorBackground.title = backgroundFileName || value.backgroundSource ? (backgroundFileName || t('customBackground', null, '已选择自定义背景')) : '';
            if (editorStyle) editorStyle.value = '';
            renderEditorExtras();
        }

        function loadPresetIntoEditor() {
            const group = selectedSkill();
            const patch = selectedPatch();
            editorDocument = group && patch ? presetEditorDocument(group, patch) : null;
            backgroundFileName = '';
            backgroundReadGeneration += 1;
            if (editorBackground) editorBackground.value = '';
            syncEditorForm();
        }

        function setEditorEnabled(value) {
            editorEnabled = Boolean(value);
            if (editorPanel) editorPanel.hidden = !editorEnabled;
            if (editorWarning) editorWarning.hidden = !editorEnabled;
            if (editorToggle) editorToggle.checked = editorEnabled;
            syncEditorForm();
            void renderPreview();
        }

        function updateEditorField(field, value) {
            if (!editorDocument) return;
            if (field === 'skillName') editorDocument.skillName = String(value || '');
            if (field === 'description') editorDocument.description = String(value || '');
            void renderPreview();
        }

        function applyEditorStyle() {
            if (!editorStyle || !editorDescription) return;
            const value = editorStyle.value;
            if (!value) return;
            const start = editorDescription.selectionStart ?? editorDescription.value.length;
            const end = editorDescription.selectionEnd ?? start;
            const selected = editorDescription.value.slice(start, end);
            const isTerm = value.startsWith('#');
            const id = value.slice(1);
            const term = richTextConfig.hyperlinks?.[id];
            const fallback = isTerm ? (term?.name || id) : '';
            const content = selected || fallback;
            const inserted = `<${value}>${content}</>`;
            editorDescription.setRangeText(inserted, start, end, 'select');
            editorDocument.description = editorDescription.value;
            editorStyle.value = '';
            editorDescription.focus();
            void renderPreview();
        }


        function normalizePlaceholderValue(value) {
            if (!value || typeof value !== 'object') return value;
            for (const key of ['value', 'valueFloat', 'valueDouble', 'valueInt', 'floatValue', 'paramValue', 'attrValue']) {
                if (value[key] !== undefined && value[key] !== value) return normalizePlaceholderValue(value[key]);
            }
            return value;
        }

        function skillPlaceholderValues(patch) {
            const values = {};
            Object.entries(patch || {}).forEach(([key, value]) => {
                if (key === 'blackboard' || value == null || typeof value === 'object') return;
                values[key] = value;
            });
            const blackboard = Array.isArray(patch?.blackboard)
                ? patch.blackboard
                : patch?.blackboard && typeof patch.blackboard === 'object'
                    ? Object.entries(patch.blackboard).map(([key, value]) => ({ key, value }))
                    : [];
            blackboard.forEach(item => {
                if (!item || item.key === undefined) return;
                const rawValue = item.value ?? item.valueFloat ?? item.valueDouble ?? item.valueInt ?? item.floatValue ?? item.paramValue;
                values[String(item.key).trim()] = normalizePlaceholderValue(rawValue);
            });
            return values;
        }

        function formatPlaceholderValue(value, format) {
            const formatMatch = String(format || '').match(/^0(?:\.(0+))?(%)?$/);
            if (!formatMatch) return String(value);
            const precision = formatMatch[1]?.length || 0;
            const formattedValue = formatMatch[2] ? Number(value) * 100 : Number(value);
            return `${formattedValue.toFixed(precision)}${formatMatch[2] || ''}`;
        }

        function replaceSkillPlaceholders(description, patch) {
            const valueMap = {};
            Object.entries(skillPlaceholderValues(patch)).forEach(([key, value]) => {
                const normalized = normalizePlaceholderValue(value);
                if (normalized === undefined || normalized === null || normalized === '') return;
                valueMap[String(key).trim().toLowerCase()] = normalized;
            });
            return String(description || '')
                .replace(/[（(][^（）()]*\{floor:[^{}]+\}[^（）()]*[）)]/gi, '')
                .replace(/\{([^}]+)\}/g, (match, expression) => {
                    const parts = expression.split(':');
                    const expr = parts[0].replace(/\s+/g, '');
                    const format = parts[1] ? parts[1].trim() : '';
                    const names = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                    if (!names.length || names.some(name => !(name.toLowerCase() in valueMap))) return match;
                    let evaluatedExpression = expr;
                    names.forEach(name => {
                        const value = valueMap[name.toLowerCase()];
                        evaluatedExpression = evaluatedExpression.replace(
                            new RegExp(`\\b${name}\\b`, 'g'),
                            `(${value})`
                        );
                    });
                    let result;
                    try {
                        result = new Function(`return ${evaluatedExpression}`)();
                    } catch (error) {
                        return match;
                    }
                    if (typeof result !== 'number' || !Number.isFinite(result)) return match;
                    return formatPlaceholderValue(result, format);
                });
        }

        function relatedSkillPatches(group, patch) {
            const level = Number(patch?.level);
            return (Array.isArray(group?.skillEntries) ? group.skillEntries : [])
                .map(entry => entry.patches.find(candidate => Number(candidate.level) === level) || entry.patches[entry.patches.length - 1])
                .filter(Boolean);
        }

        function descriptionValuePatch(group, patch) {
            const relatedPatches = relatedSkillPatches(group, patch);
            const fallbackPatch = relatedPatches[relatedPatches.length - 1] || patch;
            const relatedBlackboard = relatedPatches.flatMap(candidate => Array.isArray(candidate.blackboard) ? candidate.blackboard : []);
            const currentBlackboard = Array.isArray(patch?.blackboard) ? patch.blackboard : [];
            return {
                ...(fallbackPatch || {}),
                ...(patch || {}),
                blackboard: [...relatedBlackboard, ...currentBlackboard]
            };
        }

        function skillDescription(group, patch) {
            const description = localizedText(group?.description, '')
                || localizedText(patch?.description, '')
                || t('emptyDescription', null, '暂无技能说明');
            const conditionSummary = lizhiyanConditionSummary();
            const conditionDescription = conditionDescriptionText(group);
            return replaceSkillPlaceholders(
                [conditionSummary, description, conditionDescription].filter(Boolean).join('\n'),
                descriptionValuePatch(group, patch)
            );
        }

        const ATTRIBUTE_NODE_NAMES = Object.freeze({
            1: '生命',
            2: '攻击',
            3: '防御',
            25: '物理附着伤害倍率',
            39: '力量',
            40: '敏捷',
            41: '智识',
            42: '意志',
            49: '术式附着伤害倍率'
        });

        function effectBlackboard(effect) {
            const blackboard = [];
            (effect?.dataList || []).forEach(item => {
                [...(item?.attachSkill?.blackboard || []), ...(item?.attachBuff?.blackboard || [])].forEach(value => {
                    if (value && value.key !== undefined) blackboard.push(value);
                });
                if (item?.skillBbModifier?.bbKey) {
                    blackboard.push({ key: item.skillBbModifier.bbKey, value: item.skillBbModifier.floatValue });
                }
            });
            return blackboard;
        }

        function buildCharacterEnhancements(growth, potentialTalentTable) {
            const nodes = Object.values(growth?.talentNodeMap || {});
            const talentGroups = new Map();
            nodes.filter(node => node?.nodeType === 4 && node.passiveSkillNodeInfo?.talentEffectId).forEach(node => {
                const info = node.passiveSkillNodeInfo;
                const index = info.index ?? 0;
                const levels = talentGroups.get(index) || [];
                levels.push(node);
                talentGroups.set(index, levels);
            });
            const talentSkills = Array.from(talentGroups.entries())
                .sort(([left], [right]) => left - right)
                .map((node, index) => {
                    const [talentIndex, talentNodes] = node;
                    const sortedNodes = talentNodes.sort((left, right) => {
                        const leftInfo = left.passiveSkillNodeInfo;
                        const rightInfo = right.passiveSkillNodeInfo;
                        return (leftInfo.level ?? 0) - (rightInfo.level ?? 0)
                            || (leftInfo.breakStage ?? 0) - (rightInfo.breakStage ?? 0);
                    });
                    const firstInfo = sortedNodes[0]?.passiveSkillNodeInfo || {};
                    const firstEffect = potentialTalentTable?.[firstInfo.talentEffectId];
                    const title = localizedText(firstInfo.name, '')
                        || localizedText(firstEffect?.name, '')
                        || `${t('talent', null, '天赋')} ${index + 1}`;
                    const patches = sortedNodes.map((talentNode, levelIndex) => {
                        const info = talentNode.passiveSkillNodeInfo;
                        const effect = potentialTalentTable?.[info.talentEffectId];
                        if (!effect) return null;
                        const value = replaceSkillPlaceholders(
                            localizedText(effect.desc, '') || t('emptyDescription', null, '暂无技能说明'),
                            { blackboard: effectBlackboard(effect) }
                        );
                        return {
                            level: Math.max(1, Math.min(3, Number(info.level) || levelIndex + 1)),
                            nodeLevel: Math.max(1, Math.min(3, Number(info.level) || levelIndex + 1)),
                            description: value,
                            blackboard: effectBlackboard(effect),
                            sourceId: String(info.talentEffectId || '')
                        };
                    }).filter(Boolean);
                    if (!patches.length) return null;
                    return {
                        key: `talent:${talentIndex}`,
                        type: 'talent',
                        name: title,
                        icon: String(firstInfo.iconId || ''),
                        description: '',
                        patches,
                        skillEntries: [],
                        sourceIds: sortedNodes.map(talentNode => String(talentNode.passiveSkillNodeInfo?.talentEffectId || '')).filter(Boolean),
                        groupId: `talent:${talentIndex}`,
                        rankLabel: '节点',
                        nodeLevel: patches[0].nodeLevel
                    };
                })
                .filter(Boolean);
            const attributeNodes = nodes
                .filter(node => node?.nodeType === 3)
                .sort((left, right) => (left.attributeNodeInfo?.breakStage ?? 0) - (right.attributeNodeInfo?.breakStage ?? 0))
                .map((node, index) => {
                    const info = node.attributeNodeInfo || {};
                    const modifiers = (info.attributeModifiers || [])
                        .filter(modifier => modifier && !(modifier.attrType === 0 && modifier.attrValue === 0))
                        .map(modifier => {
                            const name = ATTRIBUTE_NODE_NAMES[modifier.attrType] || `属性 ${modifier.attrType}`;
                            const value = Number(modifier.attrValue);
                            const formatted = Number.isFinite(value) && Number.isInteger(value)
                                ? String(value)
                                : String(Number.isFinite(value) ? Number(value.toFixed(2)) : modifier.attrValue);
                            return `${name}${value >= 0 ? '+' : ''}${formatted}`;
                        });
                    const description = localizedText(info.desc, '');
                    return {
                        sourceId: String(node.nodeId || ''),
                        breakStage: Number(info.breakStage) || index + 1,
                        title: localizedText(info.title, '')
                            || `${t('attributeNode', null, '属性节点')} ${info.breakStage ?? index + 1}`,
                        value: [description, modifiers.join('，')].filter(Boolean).join(' ')
                    };
                })
                .filter(Boolean);
            const attributePatches = attributeNodes.map((node, index) => ({
                level: Math.max(1, Math.min(4, Number(node.breakStage) || index + 1)),
                nodeLevel: Math.max(1, Math.min(4, Number(node.breakStage) || index + 1)),
                description: `${node.title}：${node.value}`,
                sourceId: node.sourceId
            }));
            const attributeSkill = attributePatches.length ? {
                key: 'attributeNode',
                type: 'attributeNode',
                name: t('attributeNode', null, '属性节点'),
                icon: 'icon_attribute_wisd_will',
                description: '',
                patches: attributePatches,
                skillEntries: [],
                sourceIds: attributeNodes.map(node => node.sourceId).filter(Boolean),
                groupId: 'attributeNode',
                rankLabel: '节点',
                nodeLevel: attributePatches[0]?.nodeLevel || 1
            } : null;
            return { talentSkills, attributeSkill };
        }

        function extraInfo(group, patch) {
            if (group?.type === 'talent' || group?.type === 'attributeNode') return [];
            const entries = Array.isArray(group?.skillEntries) && group.skillEntries.length
                ? group.skillEntries
                : [{ id: '', patches: [patch] }];
            const descriptions = entries.flatMap(entry => {
                const skillPatch = entry.patches.find(candidate => Number(candidate.level) === Number(patch?.level))
                    || entry.patches[entry.patches.length - 1]
                    || patch;
                if (!skillPatch) return [];
                const valuePatch = descriptionValuePatch(group, skillPatch);
                const descriptions = [];
                const description = localizedText(skillPatch.description, '');
                if (description) {
                    descriptions.push({
                        name: entry.name || t('skillDescription', null, '技能描述'),
                        value: replaceSkillPlaceholders(description, valuePatch)
                    });
                }
                (Array.isArray(skillPatch.subDescDataList) ? skillPatch.subDescDataList : []).forEach(item => {
                    const value = replaceSkillPlaceholders(localizedText(item.desc, String(item.desc || '')), valuePatch);
                    const condition = group?.conditions?.find(candidate => candidate.id === item.conditionId);
                    const name = localizedText(item.name, '')
                        || localizedText(condition?.name, '')
                        || (condition?.id || entry.name || '');
                    if (name || value) descriptions.push({ name, value });
                });
                return descriptions;
            }).filter(item => item.name || item.value);
            const primaryPatch = entries[0]?.patches.find(candidate => Number(candidate.level) === Number(patch?.level))
                || entries[0]?.patches[entries[0].patches.length - 1]
                || patch;
            const metrics = [];
            const formatMetricValue = (value, suffix = '') => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) return String(value ?? '');
                const normalized = Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
                return `${normalized}${suffix}`;
            };
            const cooldownRow = (label, value) => ({
                name: label,
                value: formatMetricValue(value, '秒')
            });
            if (group?.type === 2) {
                metrics.push(
                    { name: t('energyCost', null, '消耗能量'), value: formatMetricValue(primaryPatch?.costValue ?? 0) },
                    cooldownRow(t('cooldown', null, '冷却时间'), primaryPatch?.coolDown ?? 0)
                );
            } else if (group?.type === 3) {
                const conditions = Array.isArray(group.conditions) ? group.conditions : [];
                if (conditions.length > 1) {
                    conditions.forEach((condition, index) => {
                        const conditionName = localizedText(condition.name, '') || `形态 ${index + 1}`;
                        metrics.push(cooldownRow(`${conditionName} · ${t('cooldown', null, '冷却时间')}`, primaryPatch?.coolDown ?? 0));
                    });
                } else {
                    metrics.push(cooldownRow(t('cooldown', null, '冷却时间'), primaryPatch?.coolDown ?? 0));
                }
            }
            return [...descriptions, ...metrics].filter(item => item.name || item.value);
        }

        function resolvedPopupDocument(documentValue, patch) {
            const resolved = cloneEditorDocument(documentValue);
            resolved.description = replaceSkillPlaceholders(resolved.description, patch);
            resolved.extraInfos = resolved.extraInfos.map(item => ({
                ...item,
                value: replaceSkillPlaceholders(item.value, patch)
            }));
            return resolved;
        }

        function updateSelectionLabel() {
            const character = selectedCharacter();
            const group = selectedSkill();
            const patch = selectedPatch();
            const label = character && group
                ? `${character.name} · ${group.name} · ${t('levelValue', { level: patch?.level || selectedLevel }, `等级 ${patch?.level || selectedLevel}`)}`
                : '';
            selectionLabel.textContent = label;
            canvas.setAttribute('aria-label', label || t('preview', null, '预览'));
        }

        function createCharacterButton(character) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'misc-icon-generator__character';
            button.dataset.characterId = character.id;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', String(character.id === selectedCharacterId));
            button.title = character.name;
            const image = document.createElement('img');
            image.alt = '';
            image.src = avatarPath(character.id);
            const name = document.createElement('span');
            name.textContent = character.name;
            button.append(image, name);
            return button;
        }

        function renderCharacterList() {
            const query = normalizeSearch(characterSearch.value);
            const visible = characters.filter(character => !query || character.searchText.includes(query));
            characterList.replaceChildren(...visible.map(createCharacterButton));
            characterCount.textContent = `${visible.length}/${characters.length}`;
            if (!visible.length) {
                const empty = document.createElement('div');
                empty.className = 'misc-icon-generator__empty';
                empty.textContent = t('noCharacters', null, '没有匹配的角色');
                characterList.append(empty);
            }
        }

        function renderSkillList() {
            const character = selectedCharacter();
            skillList.replaceChildren();
            if (!character) return;
            selectableSkills(character).forEach(group => {
                const selectionKey = skillSelectionKey(group);
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `misc-icon-generator__skill${selectionKey === selectedSkillType ? ' is-active' : ''}`;
                button.dataset.skillType = String(selectionKey);
                button.setAttribute('role', 'radio');
                button.setAttribute('aria-checked', String(selectionKey === selectedSkillType));
                const image = document.createElement('img');
                image.alt = '';
                image.src = skillPath(group.icon);
                const copy = document.createElement('span');
                const typeName = document.createElement('small');
                typeName.textContent = skillTypeLabel(group.type);
                const skillName = document.createElement('strong');
                skillName.textContent = group.name;
                copy.append(typeName, skillName);
                button.append(image, copy);
                skillList.append(button);
            });
        }

        function renderLevelOptions() {
            const group = selectedSkill();
            const levels = group?.patches || [];
            if (!levels.some(patch => patch.level === selectedLevel)) selectedLevel = levels[0]?.level || 1;
            levelSelect.replaceChildren(...levels.map(patch => {
                const option = document.createElement('option');
                option.value = String(patch.level);
                option.textContent = t('levelValue', { level: patch.level }, `等级 ${patch.level}`);
                option.selected = patch.level === selectedLevel;
                return option;
            }));
        }

        function decodeBlob(blob) {
            if (typeof window.createImageBitmap === 'function') return window.createImageBitmap(blob);
            const objectUrl = URL.createObjectURL(blob);
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(image);
                };
                image.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error(t('renderFailed', null, '图标生成失败')));
                };
                image.src = objectUrl;
            });
        }

        function loadImage(url) {
            if (!imagePromises.has(url)) {
                const promise = (async () => {
                    const response = String(url).startsWith('data:')
                        ? await fetch(url)
                        : await (window.akeFetch || fetch)(url, {
                            signal: context.signal,
                            akeProgress: false
                        });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const image = await decodeBlob(await response.blob());
                    loadedImages.add(image);
                    return image;
                })().catch(error => {
                    imagePromises.delete(url);
                    throw error;
                });
                imagePromises.set(url, promise);
            }
            return imagePromises.get(url);
        }

        async function loadUiAsset(spec) {
            const image = await loadImage(spec.path);
            const width = image.naturalWidth || image.width || 0;
            const height = image.naturalHeight || image.height || 0;
            if (width !== spec.width || height !== spec.height) {
                throw new Error(`Invalid UI asset dimensions: ${spec.path}`);
            }
            return image;
        }

        function drawCover(ctx, image, x, y, width, height) {
            if (!image) return;
            const sourceWidth = image.naturalWidth || image.width || 1;
            const sourceHeight = image.naturalHeight || image.height || 1;
            const fitScale = Math.max(width / sourceWidth, height / sourceHeight);
            const cropWidth = width / fitScale;
            const cropHeight = height / fitScale;
            ctx.drawImage(
                image,
                (sourceWidth - cropWidth) / 2,
                (sourceHeight - cropHeight) / 2,
                cropWidth,
                cropHeight,
                x,
                y,
                width,
                height
            );
        }

        function drawImageCover(ctx, image, x, y, width, height, radius) {
            if (!image) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
            ctx.clip();
            drawCover(ctx, image, x, y, width, height);
            ctx.restore();
        }

        function roundedRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + width, y, x + width, y + height, radius);
            ctx.arcTo(x + width, y + height, x, y + height, radius);
            ctx.arcTo(x, y + height, x, y, radius);
            ctx.arcTo(x, y, x + width, y, radius);
            ctx.closePath();
        }

        function drawSprite(ctx, image, source, target) {
            if (!image) return;
            ctx.drawImage(image, source.x, source.y, source.width, source.height,
                target.x, target.y, target.width, target.height);
        }

        function drawTintedSprite(ctx, image, source, target, color) {
            if (!image) return;
            const layer = createCanvas(target.width, target.height);
            const layerContext = layer.getContext('2d');
            layerContext.drawImage(image, source.x, source.y, source.width, source.height,
                0, 0, target.width, target.height);
            layerContext.globalCompositeOperation = 'source-in';
            layerContext.fillStyle = color;
            layerContext.fillRect(0, 0, layer.width, layer.height);
            ctx.drawImage(layer, target.x, target.y);
        }

        function createCanvas(width, height) {
            const ownerDocument = canvas?.ownerDocument || document;
            const result = ownerDocument.createElement('canvas');
            result.width = Math.max(1, Math.ceil(width));
            result.height = Math.max(1, Math.ceil(height));
            return result;
        }

        function drawNineSlice(ctx, image, destination, source, sourceBorder, destinationBorder = sourceBorder) {
            if (!image) return;
            const sourceColumns = [source.x, source.x + sourceBorder.left, source.x + source.width - sourceBorder.right];
            const sourceRows = [source.y, source.y + sourceBorder.top, source.y + source.height - sourceBorder.bottom];
            const destinationColumns = [destination.x, destination.x + destinationBorder.left, destination.x + destination.width - destinationBorder.right];
            const destinationRows = [destination.y, destination.y + destinationBorder.top, destination.y + destination.height - destinationBorder.bottom];
            const sourceWidths = [sourceBorder.left, source.width - sourceBorder.left - sourceBorder.right, sourceBorder.right];
            const sourceHeights = [sourceBorder.top, source.height - sourceBorder.top - sourceBorder.bottom, sourceBorder.bottom];
            const destinationWidths = [destinationBorder.left, destination.width - destinationBorder.left - destinationBorder.right, destinationBorder.right];
            const destinationHeights = [destinationBorder.top, destination.height - destinationBorder.top - destinationBorder.bottom, destinationBorder.bottom];
            for (let row = 0; row < 3; row += 1) {
                for (let column = 0; column < 3; column += 1) {
                    if (destinationWidths[column] <= 0 || destinationHeights[row] <= 0) continue;
                    ctx.drawImage(
                        image,
                        sourceColumns[column], sourceRows[row], sourceWidths[column], sourceHeights[row],
                        destinationColumns[column], destinationRows[row], destinationWidths[column], destinationHeights[row]
                    );
                }
            }
        }

        function drawTintedNineSlice(ctx, image, destination, source, sourceBorder, color) {
            if (!image) return;
            const layer = createCanvas(destination.width, destination.height);
            const layerContext = layer.getContext('2d');
            drawNineSlice(layerContext, image, { x: 0, y: 0, width: destination.width, height: destination.height }, source, sourceBorder);
            layerContext.globalCompositeOperation = 'source-in';
            layerContext.fillStyle = color;
            layerContext.fillRect(0, 0, layer.width, layer.height);
            ctx.drawImage(layer, destination.x, destination.y);
        }

        function blurImageData(data, width, height, horizontal) {
            const result = new Uint8ClampedArray(data.length);
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const target = (y * width + x) * 4;
                    for (let channel = 0; channel < 4; channel += 1) {
                        let value = 0;
                        BLUR_KERNEL.forEach((weight, index) => {
                            const offset = index - BLUR_RADIUS;
                            const sampleX = horizontal ? Math.min(width - 1, Math.max(0, x + offset)) : x;
                            const sampleY = horizontal ? y : Math.min(height - 1, Math.max(0, y + offset));
                            value += data[(sampleY * width + sampleX) * 4 + channel] * weight;
                        });
                        result[target + channel] = value;
                    }
                }
            }
            return result;
        }

        function drawFallbackBackdrop(ctx, image, width, height) {
            ctx.fillStyle = '#555b5f';
            ctx.fillRect(0, 0, width, height);
            if (image) drawCover(ctx, image, 0, 0, width, height);
        }

        function createBlurredBackdrop(image, width, height) {
            const source = createCanvas(width + BLUR_PADDING * 2, height + BLUR_PADDING * 2);
            const sourceContext = source.getContext('2d', { alpha: true });
            sourceContext.imageSmoothingEnabled = true;
            sourceContext.imageSmoothingQuality = 'high';
            drawFallbackBackdrop(sourceContext, image, source.width, source.height);
            let layer = source;
            let previousFactor = 1;
            for (const factor of BLUR_DOWNSAMPLE_FACTORS) {
                const downsampled = createCanvas(Math.ceil(layer.width / (factor / previousFactor)), Math.ceil(layer.height / (factor / previousFactor)));
                const downsampledContext = downsampled.getContext('2d', { alpha: true });
                downsampledContext.imageSmoothingEnabled = true;
                downsampledContext.imageSmoothingQuality = 'high';
                downsampledContext.drawImage(layer, 0, 0, downsampled.width, downsampled.height);
                const imageData = downsampledContext.getImageData(0, 0, downsampled.width, downsampled.height);
                const vertical = blurImageData(blurImageData(imageData.data, downsampled.width, downsampled.height, true), downsampled.width, downsampled.height, false);
                imageData.data.set(vertical);
                downsampledContext.putImageData(imageData, 0, 0);
                layer = downsampled;
                previousFactor = factor;
            }
            const result = createCanvas(width, height);
            const resultContext = result.getContext('2d', { alpha: true });
            resultContext.imageSmoothingEnabled = true;
            resultContext.imageSmoothingQuality = 'high';
            resultContext.drawImage(layer, BLUR_PADDING / 16, BLUR_PADDING / 16, width / 16, height / 16, 0, 0, width, height);
            return result;
        }

        function drawMaskedBlur(ctx, image, mask, destination) {
            if (!image || !mask) return;
            const blurred = createBlurredBackdrop(image, destination.width, destination.height);
            const maskCanvas = createCanvas(destination.width, destination.height);
            const maskContext = maskCanvas.getContext('2d');
            drawNineSlice(maskContext, mask, { x: 0, y: 0, width: destination.width, height: destination.height }, UI_SOURCE_RECTS.blurMask, UI_SLICE_BORDERS.blurMask, UI_SLICE_BORDERS.blurMaskDestination);
            const blurredContext = blurred.getContext('2d');
            blurredContext.globalCompositeOperation = 'destination-in';
            blurredContext.drawImage(maskCanvas, 0, 0);
            ctx.drawImage(blurred, destination.x, destination.y);
        }

        function tagColor(tag, fallback) {
            const value = String(tag || '').toLocaleLowerCase();
            if (value.includes('fire') || value.includes('key') || value.includes('consume') || value.includes('enhance')) {
                return '#ffc000';
            }
            if (value.includes('natur') || value.includes('heal') || value.includes('vup')) {
                return '#a9c900';
            }
            if (value.includes('cryst') || value.includes('ice') || value.includes('frozen') || value.includes('elect')) {
                return '#25c8f5';
            }
            if (value.includes('burn') || value.includes('corrupt') || value.includes('physical')) {
                return '#ff9b39';
            }
            return fallback || SKILL_DEFAULT_COLOR;
        }

        function richTextRuns(value) {
            const source = String(value || '').replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n?/g, '\n');
            const runs = [];
            const baseStyle = { color: SKILL_DEFAULT_COLOR, bold: false, underline: false };
            const append = (text, style) => {
                if (!text) return;
                const previous = runs[runs.length - 1];
                if (previous && !previous.break && !previous.icon && previous.style.color === style.color && previous.style.bold === style.bold && previous.style.underline === style.underline) {
                    previous.text += text;
                } else {
                    runs.push({ text, style: { ...style } });
                }
            };
            const appendIcon = (path, scale, style) => {
                if (!path) return;
                runs.push({
                    icon: true,
                    iconUrl: richTextImageUrl(path),
                    iconScale: scale || 1,
                    style: { ...style }
                });
            };
            const styleForTag = (prefix, tagId, parentStyle) => {
                const style = { ...parentStyle };
                const styleDefinition = prefix === '@'
                    ? richTextStyle(tagId)
                    : richTextStyle(richTextConfig.hyperlinks?.[tagId]?.styleid);
                const styleColor = styleDefinition?.color?.[1] || styleDefinition?.color?.[0];
                const styleImage = styleDefinition?.image?.[1] || styleDefinition?.image?.[0];
                const styleScale = styleDefinition?.scale?.[1] || styleDefinition?.scale?.[0] || 1;
                const linkImage = richTextConfig.hyperlinks?.[tagId]?.iconPath;
                style.color = styleColor || tagColor(tagId, style.color);
                style.underline = prefix === '#';
                return {
                    style,
                    iconPath: prefix === '#' ? (linkImage || styleImage) : styleImage,
                    iconScale: linkImage ? 1.25 : styleScale
                };
            };
            const parseSequence = (start, inheritedStyle) => {
                let index = start;
                while (index < source.length) {
                    if (source[index] === '\n') {
                        runs.push({ break: true });
                        index += 1;
                        continue;
                    }
                    if (source[index] !== '<') {
                        const next = source.indexOf('<', index);
                        const end = next < 0 ? source.length : next;
                        append(source.slice(index, end), inheritedStyle);
                        index = end;
                        continue;
                    }
                    const close = source.indexOf('>', index + 1);
                    if (close < 0) {
                        append(source.slice(index), inheritedStyle);
                        return source.length;
                    }
                    const token = source.slice(index, close + 1);
                    const lower = token.toLocaleLowerCase();
                    if (lower === '</>' || lower === '</color>') return close + 1;
                    if (lower === '<br>' || lower === '<br/>') {
                        runs.push({ break: true });
                        index = close + 1;
                        continue;
                    }
                    const inlineImage = token.match(/^<image="([^"]+)"\s+scale=([0-9.]+)>$/i);
                    if (inlineImage) {
                        appendIcon(
                            normalizeRichTextImagePath(inlineImage[1]),
                            Number(inlineImage[2]) || 1,
                            inheritedStyle
                        );
                        index = close + 1;
                        continue;
                    }
                    const colored = token.match(/^<color=#([0-9a-f]{6}|[0-9a-f]{8})>$/i);
                    const gameTag = token.match(/^<([@#])([^>]+)>$/i);
                    const bold = /^<b>$/i.test(token);
                    if (colored || gameTag || bold) {
                        let nextStyle = { ...inheritedStyle };
                        if (colored) nextStyle.color = `#${colored[1]}`;
                        if (bold) nextStyle.bold = true;
                        if (gameTag) {
                            const tagStyle = styleForTag(gameTag[1], gameTag[2], nextStyle);
                            nextStyle = tagStyle.style;
                            appendIcon(tagStyle.iconPath, tagStyle.iconScale, nextStyle);
                        }
                        index = parseSequence(close + 1, nextStyle);
                        continue;
                    }
                    append(token, inheritedStyle);
                    index = close + 1;
                }
                return index;
            };
            parseSequence(0, baseStyle);
            return runs.length ? runs : [{ text: '', style: baseStyle }];
        }

        function fontFor(style, size = DESCRIPTION_FONT_SIZE) {
            return `${style?.bold ? '700' : '400'} ${size}px ${FONT_FAMILY}`;
        }

        function layoutRichText(ctx, runs, width, richTextImages) {
            const lines = [];
            let line = { width: 0, parts: [] };
            const pushLine = () => {
                lines.push(line);
                line = { width: 0, parts: [] };
            };
            const appendPart = (text, style, partWidth) => {
                const previous = line.parts[line.parts.length - 1];
                if (previous && previous.style.color === style.color && previous.style.bold === style.bold && previous.style.underline === style.underline && previous.type === 'text') {
                    previous.text += text;
                    previous.width += partWidth;
                } else {
                    line.parts.push({ type: 'text', text, style: { ...style }, width: partWidth });
                }
                line.width += partWidth;
            };
            runs.forEach(run => {
                if (run.break) {
                    pushLine();
                    return;
                }
                if (run.icon && run.iconUrl) {
                    const image = richTextImages?.get(run.iconUrl);
                    const aspect = image ? (image.naturalWidth || image.width || 1) / (image.naturalHeight || image.height || 1) : 1;
                    const height = DESCRIPTION_FONT_SIZE * (run.iconScale || 1);
                    const iconWidth = height * aspect;
                    if (line.width > 0 && line.width + iconWidth > width) pushLine();
                    line.parts.push({ type: 'icon', image, width: iconWidth, height, style: run.style || {} });
                    line.width += iconWidth;
                    return;
                }
                const style = run.style || { color: SKILL_DEFAULT_COLOR };
                for (const character of Array.from(run.text || '')) {
                    ctx.font = fontFor(style);
                    const characterWidth = ctx.measureText(character).width;
                    if (line.width > 0 && line.width + characterWidth > width) pushLine();
                    appendPart(character, style, characterWidth);
                }
            });
            if (line.parts.length || !lines.length) pushLine();
            const hasContent = lines.some(currentLine => currentLine.parts.length > 0);
            return { lines, height: hasContent ? Math.max(DESCRIPTION_LINE_HEIGHT, lines.length * DESCRIPTION_LINE_HEIGHT) : 0 };
        }

        function drawRichText(ctx, layout, x, y, scrollOffset = 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, DESCRIPTION_WIDTH, DESCRIPTION_MAX_HEIGHT);
            ctx.clip();
            layout.lines.forEach((line, lineIndex) => {
                let cursor = x;
                line.parts.forEach(part => {
                    if (part.type === 'icon') {
                        if (part.image) ctx.drawImage(part.image, cursor, y + lineIndex * DESCRIPTION_LINE_HEIGHT + 1 - scrollOffset, part.width, part.height);
                        cursor += part.width;
                        return;
                    }
                    ctx.font = fontFor(part.style);
                    ctx.fillStyle = part.style.color || SKILL_DEFAULT_COLOR;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText(part.text, cursor, y + lineIndex * DESCRIPTION_LINE_HEIGHT - scrollOffset + 24);
                    if (part.style.underline) {
                        ctx.fillRect(cursor, y + lineIndex * DESCRIPTION_LINE_HEIGHT + 26 - scrollOffset, part.width, 1);
                    }
                    cursor += part.width;
                });
            });
            ctx.restore();
        }

        function drawElitePolygon(ctx, image, level, showElite, offsetX, offsetY) {
            if (!image || !showElite) return;
            const root = {
                pivot: { x: 18.7, y: 82.6 },
                scale: 0.4,
                size: { width: 100, height: 100 },
                rectPivot: { x: 0, y: 0.5 },
                cells: [
                    { position: { x: -28.4, y: 0 }, anchorMin: { x: 0.5, y: 0.5 }, anchorMax: { x: 0.5, y: 0.5 }, size: { width: 50, height: 47 }, pivot: { x: 0.5, y: 0.5 }, rotation: 0 },
                    { position: { x: 5.5, y: -5 }, anchorMin: { x: 0.5, y: 0.5 }, anchorMax: { x: 0.5, y: 0.5 }, size: { width: 50, height: 47 }, pivot: { x: 1, y: 0.5 }, rotation: 120 },
                    { position: { x: 5.5, y: 5 }, anchorMin: { x: 0.5, y: 0.5 }, anchorMax: { x: 0.5, y: 0.5 }, size: { width: 50, height: 47 }, pivot: { x: 1, y: 0.5 }, rotation: -120 }
                ]
            };
            const baseX = -root.rectPivot.x * root.size.width;
            const baseY = -root.rectPivot.y * root.size.height;
            ctx.save();
            ctx.translate(offsetX + root.pivot.x, offsetY + root.pivot.y);
            ctx.scale(root.scale, root.scale);
            root.cells.forEach((cell, index) => {
                const anchorX = (cell.anchorMin.x + cell.anchorMax.x) / 2;
                const anchorY = (cell.anchorMin.y + cell.anchorMax.y) / 2;
                const x = baseX + root.size.width * anchorX + cell.position.x;
                const y = baseY + root.size.height * anchorY + cell.position.y;
                ctx.save();
                ctx.translate(x, -y);
                ctx.rotate(-cell.rotation * Math.PI / 180);
                ctx.globalAlpha = 0.2;
                drawSprite(ctx, image, UI_SOURCE_RECTS.elitePolygon, {
                    x: -cell.pivot.x * cell.size.width,
                    y: -cell.pivot.y * cell.size.height,
                    width: cell.size.width,
                    height: cell.size.height
                });
                if (level > index) {
                    ctx.globalAlpha = 1;
                    drawSprite(ctx, image, UI_SOURCE_RECTS.elitePolygon, {
                        x: -cell.pivot.x * cell.size.width,
                        y: -cell.pivot.y * cell.size.height,
                        width: cell.size.width,
                        height: cell.size.height
                    });
                }
                ctx.restore();
            });
            ctx.restore();
        }

        async function loadRichTextImages(description) {
            const imageUrls = [...new Set(richTextRuns(description).map(run => run.iconUrl).filter(Boolean))];
            const entries = await Promise.all(imageUrls.map(async url => {
                try {
                    return [url, await loadImage(url)];
                } catch (error) {
                    console.warn(`技能弹窗富文本图标加载失败：${url}`, error);
                    return [url, null];
                }
            }));
            return new Map(entries.filter(([, image]) => image));
        }

        function drawPopup(background, ui, documentValue, richTextImages) {
            const ctx = canvasContext;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const description = String(documentValue?.description || '');
            const extras = (Array.isArray(documentValue?.extraInfos) ? documentValue.extraInfos : [])
                .map(item => ({ name: String(item?.title || ''), value: String(item?.value || '') }))
                .filter(item => item.name || item.value);
            const descriptionRuns = richTextRuns(description);
            const layout = layoutRichText(ctx, descriptionRuns, DESCRIPTION_WIDTH, richTextImages);
            const descriptionHeight = Math.min(
                DESCRIPTION_MAX_HEIGHT,
                layout.height > 0 ? Math.max(DESCRIPTION_LINE_HEIGHT, Math.ceil(layout.height)) : 0
            );
            const contentHeight = 120 + descriptionHeight + extras.length * EXTRA_HEIGHT + PADDING.bottom;
            const exportHeight = contentHeight + BACKGROUND_EXTENSION * 2;
            const offsetX = BACKGROUND_EXTENSION;
            const offsetY = BACKGROUND_EXTENSION;
            canvas.width = OUTPUT_WIDTH * OUTPUT_SCALE;
            canvas.height = exportHeight * OUTPUT_SCALE;
            ctx.setTransform(OUTPUT_SCALE, 0, 0, OUTPUT_SCALE, 0, 0);
            ctx.clearRect(0, 0, OUTPUT_WIDTH, exportHeight);

            const panelRect = { x: 0, y: 0, width: OUTPUT_WIDTH, height: exportHeight };
            if (background && ui.blurMask) drawMaskedBlur(ctx, background, ui.blurMask, panelRect);
            if (ui.overlayMask) {
                drawTintedNineSlice(ctx, ui.overlayMask, panelRect, UI_SOURCE_RECTS.overlayMask, UI_SLICE_BORDERS.overlayMask, 'rgba(23, 23, 23, 0.80)');
            } else {
                ctx.save();
                roundedRect(ctx, 0, 0, OUTPUT_WIDTH, exportHeight, 9);
                ctx.clip();
                ctx.fillStyle = 'rgba(23, 23, 23, 0.80)';
                ctx.fillRect(0, 0, OUTPUT_WIDTH, exportHeight);
                ctx.restore();
            }

            drawTintedSprite(ctx, ui.cornerDeco, UI_SOURCE_RECTS.cornerDeco, { x: offsetX - 2, y: offsetY + 6.5, width: 22, height: 15 }, '#ffd21f');
            drawSprite(ctx, ui.cornerDecoLine, UI_SOURCE_RECTS.cornerDecoLine, { x: offsetX + 25, y: offsetY + 10.5, width: 46, height: 7 });

            const nameRect = { x: offsetX + 22, y: offsetY + 30, width: 580, height: 35 };
            const typeRect = { x: offsetX + 78.5, y: offsetY + 8, width: 569, height: 30 };
            const rankRect = { x: offsetX + 61.7, y: offsetY + 76.7, width: 260, height: 24 };
            const rankDecorationRect = { x: rankRect.x, y: offsetY + 66.6, width: 94, height: 9 };
            const boundaryRect = { x: offsetX + 22, y: offsetY + 107, width: 622, height: 2 };
            const descriptionRect = { x: offsetX + 22, y: offsetY + 120, width: DESCRIPTION_WIDTH, height: descriptionHeight };
            const rawLevel = Number(documentValue?.rank) || 1;
            const normalLevel = Math.min(9, rawLevel);
            const eliteLevel = Math.max(0, rawLevel - 9);
            const hasElite = rawLevel >= 9;
            const isNodeSkill = Boolean(documentValue?.rankLabel);
            const rankText = documentValue?.rankLabel || (rawLevel >= MAX_SKILL_LEVEL
                ? t('rankMax', null, 'RANK MAX')
                : t('rankValue', { level: normalLevel }, `RANK ${normalLevel}`));
            const drawFittedText = (text, rect, size, color, align = 'left', minSize = size) => {
                let actualSize = size;
                ctx.textAlign = align;
                while (actualSize > minSize) {
                    ctx.font = `400 ${actualSize}px ${FONT_FAMILY}`;
                    if (ctx.measureText(text).width <= rect.width) break;
                    actualSize -= 1;
                }
                ctx.font = `400 ${actualSize}px ${FONT_FAMILY}`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'middle';
                ctx.fillText(text, align === 'right' ? rect.x + rect.width : rect.x, rect.y + rect.height / 2);
            };
            drawFittedText(documentValue?.skillName || t('unknownSkill', null, '未命名技能'), nameRect, 30, '#d6d6d6', 'left', 24);
            drawFittedText(skillTypeLabel(documentValue?.skillType), typeRect, 26, 'rgba(214, 214, 214, 0.5)', 'right', 18);
            if (!isNodeSkill) drawElitePolygon(ctx, ui.elitePolygon, eliteLevel, hasElite, offsetX, offsetY);
            if (isNodeSkill) {
                const nodeRankRect = { ...rankRect, x: descriptionRect.x };
                drawFittedText(rankText, nodeRankRect, 24, 'rgba(255, 255, 255, 0.6)', 'left', 18);
                ctx.font = `400 24px ${FONT_FAMILY}`;
                const iconCount = Math.max(0, Math.min(4, Number(documentValue?.nodeLevel) || 0));
                const iconStart = nodeRankRect.x + ctx.measureText(rankText).width + 4;
                for (let index = 0; index < iconCount; index += 1) {
                    drawSprite(ctx, ui.proficientIcon, UI_SOURCE_RECTS.proficientIcon, {
                        x: iconStart + index * 21,
                        y: nodeRankRect.y + 1,
                        width: 22,
                        height: 22
                    });
                }
            } else {
                const rankOffset = hasElite ? 0 : -43;
                drawFittedText(rankText, { ...rankRect, x: rankRect.x + rankOffset }, 24, 'rgba(255, 255, 255, 0.6)', 'left', 18);
                drawSprite(ctx, ui.rankDecoration, UI_SOURCE_RECTS.rankDecoration, { ...rankDecorationRect, x: rankDecorationRect.x + rankOffset });
            }

            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(boundaryRect.x, boundaryRect.y, boundaryRect.width, boundaryRect.height);
            drawRichText(ctx, layout, descriptionRect.x, descriptionRect.y);

            extras.forEach((item, index) => {
                const y = descriptionRect.y + descriptionHeight + index * EXTRA_HEIGHT;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(descriptionRect.x, y + 12, descriptionRect.width, 2);
                drawFittedText(item.name || t('valueLabel', null, '数值'), {
                    x: descriptionRect.x, y: y + 22, width: 470, height: 35
                }, 30, '#d6d6d6', 'left', 30);
                drawFittedText(item.value, {
                    x: descriptionRect.x + descriptionRect.width - 200, y: y + 22, width: 200, height: 35
                }, 30, '#d6d6d6', 'right', 30);
            });

            if (layout.height > descriptionHeight && ui.arrow) {
                drawSprite(ctx, ui.arrow, UI_SOURCE_RECTS.arrow, {
                    x: offsetX + 20 + 624 - 46, y: offsetY + 120 + descriptionHeight / 2 - 26, width: 50, height: 53
                });
            }
        }

        async function renderPreview() {
            const generation = ++renderGeneration;
            const character = selectedCharacter();
            const group = selectedSkill();
            const patch = selectedPatch();
            const documentValue = currentPopupDocument();
            const renderPatch = descriptionValuePatch(group, patch);
            const renderDocument = documentValue ? resolvedPopupDocument(documentValue, renderPatch) : null;
            renderReady = false;
            downloadButton.disabled = true;
            updateSelectionLabel();
            if (!character || !group || !patch || !renderDocument || !canvasContext) {
                setStatus('renderFailed', '弹窗生成失败', 'error');
                return;
            }
            setStatus('rendering', '正在生成', 'loading');
            try {
                const uiNames = ['overlayMask', 'blurMask', 'cornerDeco', 'cornerDecoLine', 'elitePolygon', 'rankDecoration', 'proficientIcon', 'arrow'];
                const backgroundSource = renderDocument.backgroundSource
                    ? (renderDocument.backgroundSource.startsWith('data:') || renderDocument.backgroundSource.startsWith('http')
                        ? renderDocument.backgroundSource
                        : dataResourceUrl(renderDocument.backgroundSource))
                    : portraitPath(character.id);
                const [background, ...uiImages] = await Promise.all([
                    backgroundEnabled
                        ? loadImage(backgroundSource).catch(error => {
                            console.warn(`技能弹窗角色背景加载失败：${character.id}`, error);
                            return null;
                        })
                        : Promise.resolve(null),
                    ...uiNames.map(name => loadImage(uiAssetPath(name)).catch(error => {
                        console.warn(`技能弹窗 UI 素材加载失败：${name}`, error);
                        return null;
                    }))
                ]);
                if (disposed || context.signal.aborted || generation !== renderGeneration) return;
                const ui = Object.fromEntries(uiNames.map((name, index) => [name, uiImages[index]]));
                const richTextImages = await loadRichTextImages(renderDocument.description);
                if (disposed || context.signal.aborted || generation !== renderGeneration) return;
                drawPopup(background, ui, renderDocument, richTextImages);
                await applyCanvasWatermark(character, group, patch, renderDocument);
                renderReady = true;
                downloadButton.disabled = false;
                setStatus('ready', '已就绪', 'ready');
            } catch (error) {
                if (disposed || context.signal.aborted || generation !== renderGeneration) return;
                console.warn('角色技能弹窗生成失败', error);
                setStatus('renderFailed', `生成失败：${error.message}`, 'error', { message: error.message });
            }
        }

        function selectCharacter(characterId, updateRoute) {
            if (!characters.some(character => character.id === characterId)) return;
            selectedCharacterId = characterId;
            const character = selectedCharacter();
            if (!selectableSkills(character).some(skill => skillSelectionKey(skill) === selectedSkillType)) {
                selectedSkillType = skillSelectionKey(selectableSkills(character)[0]) ?? 0;
            }
            renderCharacterList();
            renderSkillList();
            renderLevelOptions();
            updateLizhiyanConditionInputs();
            loadPresetIntoEditor();
            updateSelectionLabel();
            if (updateRoute) context.navigate(characterId);
            void renderPreview();
        }

        function selectSkillType(type) {
            const numeric = Number(type);
            const parsed = String(type) === String(numeric) && SKILL_TYPES.includes(numeric) ? numeric : String(type);
            if (!selectableSkills().some(skill => skillSelectionKey(skill) === parsed)) return;
            selectedSkillType = parsed;
            selectedLevel = 1;
            renderSkillList();
            renderLevelOptions();
            updateLizhiyanConditionInputs();
            loadPresetIntoEditor();
            updateSelectionLabel();
            void renderPreview();
        }

        function safeFilename(value) {
            const cleaned = String(value || '')
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
                .replace(/[. ]+$/g, '')
                .trim()
                .slice(0, 96);
            return cleaned || 'AKEData-skill-popup';
        }

        function watermarkUserId() {
            const candidates = [
                window.akeUser?.id,
                window.akeUser?.userId,
                window.AKEUser?.id,
                window.AKEUser?.userId,
                window.akeAuth?.user?.id,
                window.__akeUser?.id,
                window.__akeUser?.userId
            ];
            const value = candidates.find(candidate => candidate !== undefined && candidate !== null && String(candidate).trim());
            return value === undefined ? '' : String(value).trim().slice(0, 96);
        }

        function watermarkDataVersion() {
            const state = window.akeDataSource?.getState?.() || {};
            return String(state.selected?.id || state.selected?.version || state.selection || '').slice(0, 64);
        }

        function buildWatermarkMetadata(character, group, patch, renderDocument) {
            const branchId = isLizhiyanBranchGroup(character, group) ? activeSkillConditionId(character, group) : '';
            const will = branchId ? Math.max(0, Number(lizhiyanWill?.value) || 0) : null;
            const wisd = branchId ? Math.max(0, Number(lizhiyanWisd?.value) || 0) : null;
            const sourceIds = (group?.sourceIds || group?.skillEntries?.map(entry => entry.id) || [])
                .map(value => String(value || '').trim())
                .filter(Boolean);
            const sourceSnapshot = {
                characterId: character.id,
                groupId: String(group.groupId || group.key || group.type),
                sourceIds,
                selectedSourceId: String(patch?.sourceId || ''),
                level: Number(patch?.level) || 1,
                nodeLevel: Number(patch?.nodeLevel) || 0,
                branchId,
                will,
                wisd
            };
            const editedSnapshot = {
                skillName: String(renderDocument?.skillName || ''),
                description: String(renderDocument?.description || ''),
                extraInfos: Array.isArray(renderDocument?.extraInfos) ? renderDocument.extraInfos : []
            };
            return {
                v: 1,
                m: 'skill-popup',
                t: Math.floor(Date.now() / 1000),
                c: character.id,
                g: sourceSnapshot.groupId,
                s: sourceIds,
                q: sourceSnapshot.selectedSourceId,
                l: sourceSnapshot.level,
                n: sourceSnapshot.nodeLevel,
                b: branchId,
                z: branchId ? `${will}:${wisd}` : '',
                d: watermarkDataVersion(),
                a: String(window.akeVersion?.appversion || window.__akeBootstrapVersion?.appversion || '').slice(0, 32),
                u: watermarkUserId(),
                h: window.AKEWatermark.hashText(JSON.stringify(sourceSnapshot)),
                e: window.AKEWatermark.hashText(JSON.stringify(editedSnapshot)),
                r: window.AKEWatermark.randomId()
            };
        }

        async function applyCanvasWatermark(character, group, patch, renderDocument) {
            if (!editorEnabled) return;
            if (!window.AKEWatermark) throw new Error('频域水印模块未加载');
            const metadata = buildWatermarkMetadata(character, group, patch, renderDocument);
            const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
            const result = await window.AKEWatermark.embedAsync(imageData, metadata);
            if (!result.ok) {
                const capacity = result.reason === 'tile-capacity' && result.required && result.available
                    ? `（需要 ${result.required}，可用 ${result.available}）`
                    : '';
                throw new Error(`频域水印写入失败：${result.reason}${capacity}`);
            }
            canvasContext.putImageData(result.imageData, 0, 0);
        }

        async function downloadPng() {
            if (!renderReady || downloading || disposed) return;
            const character = selectedCharacter();
            const group = selectedSkill();
            const patch = selectedPatch();
            const documentValue = currentPopupDocument();
            if (!character || !group || !patch || !documentValue) return;
            downloading = true;
            downloadButton.disabled = true;
            downloadButton.setAttribute('aria-busy', 'true');
            try {
                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png');
                });
                if (disposed || context.signal.aborted) return;
                const url = URL.createObjectURL(blob);
                downloadUrls.add(url);
                const anchor = document.createElement('a');
                anchor.download = `${safeFilename(`${character.name}-${documentValue.skillName || group.name}-技能弹窗-RANK${documentValue.rank}`)}.png`;
                anchor.href = url;
                anchor.rel = 'noopener';
                anchor.style.display = 'none';
                document.body.append(anchor);
                anchor.click();
                anchor.remove();
                context.setTimeout(() => {
                    URL.revokeObjectURL(url);
                    downloadUrls.delete(url);
                }, 30000);
                setStatus('ready', '已就绪', 'ready');
            } catch (error) {
                if (!disposed) setStatus('downloadFailed', `下载失败：${error.message}`, 'error', { message: error.message });
            } finally {
                downloading = false;
                if (!disposed) {
                    downloadButton.removeAttribute('aria-busy');
                    downloadButton.disabled = !renderReady;
                }
            }
        }

        if (!canvasContext) {
            setStatus('renderFailed', '弹窗生成失败', 'error');
            return {};
        }

        try {
            setStatus('rendering', '正在读取', 'loading');
            const [characterTable, growthTable, skillPatchTable, hyperlinkTable, richTextStyleTable, potentialTalentTable] = await Promise.all([
                context.table('CharacterTable'),
                context.table('CharGrowthTable'),
                context.table('SkillPatchTable'),
                context.table('HyperlinkTextTable').catch(() => ({})),
                context.table('RichTextStyleTable').catch(() => ({})),
                context.table('PotentialTalentEffectTable').catch(() => ({}))
            ]);
            if (context.signal.aborted) return {};
            richTextConfig = normalizeRichTextConfig(
                Object.keys(hyperlinkTable || {}).length ? hyperlinkTable : window.hyperlinkConfig,
                Object.keys(richTextStyleTable || {}).length ? richTextStyleTable : window.textstyleConfig
            );
            renderEditorStyleOptions();
            characters = Object.entries(characterTable || {})
                .filter(([id]) => id !== 'chr_9000_endmin')
                .map(([id, row]) => {
                    const enhancements = buildCharacterEnhancements(growthTable?.[id], potentialTalentTable);
                    const groups = new Map();
                    Object.values(growthTable?.[id]?.skillGroupMap || {}).forEach(group => {
                        const type = Number(group.skillGroupType);
                        if (!SKILL_TYPES.includes(type) || !group.icon) return;
                        const skillIds = Array.isArray(group.skillIdList) ? group.skillIdList.filter(Boolean) : [];
                        const skillEntries = skillIds.map(skillId => {
                            const bundle = skillPatchTable?.[skillId]?.SkillPatchDataBundle;
                            const patches = (Array.isArray(bundle) ? bundle : bundle ? [bundle] : [])
                                .filter(patch => Number.isFinite(Number(patch?.level)))
                                .sort((a, b) => Number(a.level) - Number(b.level));
                            const initialPatch = patches.find(patch => Number(patch.level) === 1) || patches[0];
                            return initialPatch ? {
                                id: skillId,
                                name: localizedText(initialPatch.skillName, ''),
                                patches
                            } : null;
                        }).filter(Boolean);
                        const primaryEntry = skillEntries[0];
                        const initialPatch = primaryEntry?.patches.find(patch => Number(patch.level) === 1) || primaryEntry?.patches[0];
                        if (!primaryEntry || !initialPatch) return;
                        const conditions = [1, 2].map(index => {
                            const conditionId = String(group[`conditionId${index}`] || '');
                            if (!conditionId) return null;
                            return {
                                id: conditionId,
                                name: group[`conditionName${index}`],
                                conditionDesc: group[`conditionDesc${index}`],
                                description: group[`conditionPostDesc${index}`]
                            };
                        }).filter(Boolean);
                        const defaultName = localizedText(group.name, skillTypeLabel(type));
                        const name = localizedText(initialPatch.skillName, '') || defaultName;
                        groups.set(type, {
                            type,
                            icon: String(initialPatch.iconId || group.icon),
                            name,
                            description: group.desc,
                            patches: primaryEntry.patches,
                            skillEntries,
                            sourceIds: skillEntries.map(entry => entry.id),
                            groupId: String(group.skillGroupId || `${id}_${SKILL_TYPE_NAMES[type] || type}`),
                            conditions
                        });
                    });
                    const fallbackSpecialIcon = groups.get(1)?.icon || groups.get(0)?.icon || '';
                    const specialSkills = [
                        ...enhancements.talentSkills,
                        ...(enhancements.attributeSkill ? [enhancements.attributeSkill] : [])
                    ].map(skill => ({ ...skill, icon: skill.icon || fallbackSpecialIcon }));
                    const defaultName = localizedText(row.name, id);
                    return {
                        id,
                        name: id === 'chr_0002_endminm'
                            ? t('administratorMale', null, '管理员（男）')
                            : id === 'chr_0003_endminf'
                                ? t('administratorFemale', null, '管理员（女）')
                        : defaultName,
                        groups,
                        specialSkills,
                        order: Number(row.sortOrder ?? growthTable?.[id]?.sortOrder ?? 9999),
                        searchText: normalizeSearch(`${defaultName} ${id}`)
                    };
                })
                .filter(character => SKILL_TYPES.every(type => character.groups.has(type)))
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
            if (!characters.length) throw new Error('No character skill groups');

            selectedCharacterId = characters.find(character => character.id === context.routeId)?.id || characters[0].id;
            renderCharacterList();
            renderSkillList();
            renderLevelOptions();
            updateLizhiyanConditionInputs();
            loadPresetIntoEditor();
            updateSelectionLabel();

            context.on(characterSearch, 'input', renderCharacterList);
            context.on(characterList, 'click', event => {
                const button = event.target.closest('[data-character-id]');
                if (button) selectCharacter(button.dataset.characterId, true);
            });
            context.on(skillList, 'click', event => {
                const button = event.target.closest('[data-skill-type]');
                if (button) selectSkillType(button.dataset.skillType);
            });
            context.on(levelSelect, 'change', event => {
                selectedLevel = Number(event.target.value) || 1;
                loadPresetIntoEditor();
                updateSelectionLabel();
                void renderPreview();
            });
            context.on(lizhiyanWill, 'input', () => void renderPreview());
            context.on(lizhiyanWisd, 'input', () => void renderPreview());
            context.on(backgroundToggle, 'change', event => {
                backgroundEnabled = Boolean(event.target.checked);
                void renderPreview();
            });
            context.on(editorToggle, 'change', event => setEditorEnabled(event.target.checked));
            context.on(editorName, 'input', event => updateEditorField('skillName', event.target.value));
            context.on(editorDescription, 'input', event => updateEditorField('description', event.target.value));
            context.on(editorStyle, 'change', applyEditorStyle);
            context.on(editorExtras, 'input', event => {
                const field = event.target.dataset.editorField;
                const wrapper = event.target.closest('[data-extra-index]');
                const index = Number(wrapper?.dataset.extraIndex);
                if (!editorDocument || !field || !Number.isInteger(index) || !editorDocument.extraInfos[index]) return;
                editorDocument.extraInfos[index][field === 'extra-title' ? 'title' : 'value'] = event.target.value;
                void renderPreview();
            });
            context.on(editorExtras, 'click', event => {
                const button = event.target.closest('[data-remove-extra]');
                const index = Number(button?.dataset.removeExtra);
                if (!editorDocument || !Number.isInteger(index)) return;
                editorDocument.extraInfos.splice(index, 1);
                renderEditorExtras();
                void renderPreview();
            });
            context.on(editorAddExtra, 'click', () => {
                if (!editorDocument || editorDocument.extraInfos.length >= 8) return;
                editorDocument.extraInfos.push({ title: t('extraInfo', null, '附加信息'), value: '0' });
                renderEditorExtras();
                void renderPreview();
            });
            context.on(editorChooseBackground, 'click', () => editorBackground?.click());
            context.on(editorClearBackground, 'click', () => {
                if (!editorDocument) return;
                backgroundReadGeneration += 1;
                backgroundFileName = '';
                editorDocument.backgroundSource = '';
                if (editorBackground) editorBackground.value = '';
                syncEditorForm();
                void renderPreview();
            });
            context.on(editorBackground, 'change', event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file || !editorDocument) return;
                const generation = ++backgroundReadGeneration;
                const reader = new FileReader();
                reader.onload = () => {
                    if (disposed || generation !== backgroundReadGeneration || !editorDocument) return;
                    editorDocument.backgroundSource = String(reader.result || '');
                    backgroundFileName = file.name;
                    syncEditorForm();
                    if (backgroundEnabled) void renderPreview();
                };
                reader.onerror = () => {
                    if (!disposed) setStatus('loadFailed', `读取失败：${t('backgroundImage', null, '背景图片')}`, 'error', { message: t('backgroundImage', null, '背景图片') });
                };
                reader.readAsDataURL(file);
            });
            context.on(downloadButton, 'click', () => void downloadPng());
            await renderPreview();
        } catch (error) {
            if (!context.signal.aborted) {
                console.error('角色技能弹窗生成器加载失败', error);
                setStatus('loadFailed', `读取失败：${error.message}`, 'error', { message: error.message });
                const empty = document.createElement('div');
                empty.className = 'misc-icon-generator__empty';
                empty.textContent = t('loadFailed', null, '读取角色数据失败');
                characterList.replaceChildren(empty);
            }
        }

        return {
            destroy() {
                disposed = true;
                renderGeneration += 1;
                downloadUrls.forEach(url => URL.revokeObjectURL(url));
                downloadUrls.clear();
                loadedImages.forEach(image => image.close?.());
                loadedImages.clear();
                imagePromises.clear();
                if (canvas) {
                    canvas.width = 0;
                    canvas.height = 0;
                }
            }
        };
    });
})();
