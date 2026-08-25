(function () {
    'use strict';

    const MODULE_ID = 'character_icon_generator';
    const IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites';
    const SKILL_ICON_ROOT = `${IMAGE_ROOT}/skillicon`;
    const SKILL_DATA_ROOT = '/public/Json/SkillData';
    const UI_ASSET_ROOT = '/public/misc';
    const SKILL_TYPES = [0, 1, 2, 3];
    const VALID_OUTPUT_SIZES = new Set([192, 256, 384, 512]);
    const SKILL_ATTRIBUTES_LAYOUT = 'skill-attributes';
    const SKILL_ATTRIBUTE_LAYERS = Object.freeze([
        'skill',
        'backgroundBase',
        'skillLine',
        'skillColor',
        'character',
        'portraitRing',
        'skillRing',
        'decoration'
    ]);
    const SUPER_SAMPLE = 4;
    const NATIVE_FIRST_HINT_SCALE = 1.365;
    const NATIVE_PORTRAIT_MASK_DIAMETER = 93 * 0.7326;
    const NATIVE_PORTRAIT_TEXTURE_DIAMETER = 104 * 0.7326;
    const NATIVE_PORTRAIT_RING_DIAMETER = 77.36256;
    const NATIVE_SKILL_RING_DIAMETER = 36;
    const NATIVE_SKILL_ICON_DIAMETER = 30;
    const NATIVE_SKILL_OFFSET = [25, 23.7];
    const NATIVE_DECORATION_SIZE = 42;
    const NATIVE_DECORATION_OFFSET = [-1.575, 78.1375];
    const SMALL_UI_SCALE = 54 / NATIVE_PORTRAIT_RING_DIAMETER;
    const SKILL_INNER_FILL = '#171a1e';
    const SKILL_DEFAULT_COLOR = 'rgb(95, 95, 95)';
    const SKILL_DAMAGE_COLORS = Object.freeze({
        2: 'rgb(255, 98, 61)',
        3: 'rgb(255, 192, 0)',
        4: 'rgb(33, 198, 208)',
        6: 'rgb(171, 191, 0)'
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
    const SKILL_TYPE_LINE_INDEX = Object.freeze({
        Attack: 1,
        BreakingAttack: 2,
        NormalAttack: 1,
        NormalSkill: 3,
        AttachSkill: 4,
        Dodge: 6,
        ComboSkill: 7,
        UltimateSkill: 8
    });
    const SKILL_GROUP_BACKGROUND = Object.freeze({
        0: { lineIndex: 1, colorIndex: 1 },
        1: { lineIndex: 3, colorIndex: 1 },
        2: { lineIndex: 8, colorIndex: 2 },
        3: { lineIndex: 7, colorIndex: 1 }
    });
    const SKILL_LINE_DIMENSIONS = Object.freeze({
        1: [128, 128],
        2: [128, 128],
        3: [128, 128],
        4: [88, 56],
        5: [96, 100],
        6: [100, 100],
        7: [128, 128],
        8: [128, 128]
    });
    const UI_ASSETS = {
        decoration: { path: `${UI_ASSET_ROOT}/icon_combos_01.png`, width: 64, height: 64 },
        portraitRing: { path: `${UI_ASSET_ROOT}/deco_combo_skill_progress.png`, width: 136, height: 136 },
        skillRing: { path: `${UI_ASSET_ROOT}/bg_combo_skill_icon.png`, width: 60, height: 60 },
        skillColor: {
            1: { path: `${SKILL_ICON_ROOT}/decal_skillcolorNew_01.png`, width: 84, height: 84 },
            2: { path: `${SKILL_ICON_ROOT}/decal_skillcolorNew_02.png`, width: 84, height: 84 }
        }
    };

    window.AKEMisc.register(MODULE_ID, async function (context) {
        const root = context.root;
        const canvas = root.querySelector('#miscIconCanvas');
        const canvasContext = canvas?.getContext('2d');
        const characterList = root.querySelector('#miscIconCharacterList');
        const characterCount = root.querySelector('#miscIconCharacterCount');
        const characterSearch = root.querySelector('#miscIconCharacterSearch');
        const skillList = root.querySelector('#miscIconSkillList');
        const layoutOptions = root.querySelector('#miscIconLayoutOptions');
        const sizeOptions = root.querySelector('#miscIconSizeOptions');
        const skillBackgroundOptions = root.querySelector('#miscIconSkillBackgroundOptions');
        const skillLayerOptions = root.querySelector('#miscIconSkillLayerOptions');
        const skillLayerInputs = [...(skillLayerOptions?.querySelectorAll('input[data-skill-layer]') || [])];
        const transparentInput = root.querySelector('#miscIconTransparent');
        const selectionLabel = root.querySelector('#miscIconSelection');
        const status = root.querySelector('#miscIconGeneratorStatus');
        const downloadButton = root.querySelector('#miscIconDownload');
        const imagePromises = new Map();
        const skillDataPromises = new Map();
        const loadedImages = new Set();
        const downloadUrls = new Set();
        let characters = [];
        let selectedCharacterId = '';
        let selectedSkillType = 0;
        let layout = 'character';
        const enabledSkillLayers = new Set(SKILL_ATTRIBUTE_LAYERS);
        let outputSize = 256;
        let renderGeneration = 0;
        let renderReady = false;
        let downloading = false;
        let disposed = false;

        const t = (key, params, fallback) => window.akeI18n?.t(
            `modules.misc.characterIconGenerator.${key}`,
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

        function avatarPath(characterId) {
            return dataResourceUrl(`${IMAGE_ROOT}/charroundicon/icon_round_${characterId}.png`);
        }

        function skillPath(iconId) {
            return dataResourceUrl(`${SKILL_ICON_ROOT}/${iconId}.png`);
        }

        function skillLineAsset(index) {
            const dimensions = SKILL_LINE_DIMENSIONS[index];
            if (!dimensions) return null;
            return {
                path: dataResourceUrl(`${SKILL_ICON_ROOT}/decal_skillline_0${index}.png`),
                width: dimensions[0],
                height: dimensions[1]
            };
        }

        function damageTypeId(value) {
            if (Number.isInteger(value)) return value;
            const numeric = Number(value);
            if (Number.isInteger(numeric)) return numeric;
            return DAMAGE_TYPE_IDS[String(value || '')] ?? 0;
        }

        function skillLineIndex(group, skillData) {
            const rawType = skillData?.skillType;
            if (typeof rawType === 'string' && SKILL_TYPE_LINE_INDEX[rawType]) {
                return SKILL_TYPE_LINE_INDEX[rawType];
            }
            const numericType = Number(rawType);
            if (Number.isInteger(numericType) && SKILL_LINE_DIMENSIONS[numericType + 1]) {
                return numericType + 1;
            }
            return group?.skillLineIndex || SKILL_GROUP_BACKGROUND[group?.type]?.lineIndex || 1;
        }

        function skillBackgroundSpec(group, skillData) {
            const fallback = SKILL_GROUP_BACKGROUND[group?.type] || SKILL_GROUP_BACKGROUND[0];
            const lineIndex = skillLineIndex(group, skillData);
            const colorIndex = Number(group?.skillColorIndex) || fallback.colorIndex;
            return {
                line: skillLineAsset(lineIndex) || skillLineAsset(fallback.lineIndex),
                color: UI_ASSETS.skillColor[colorIndex] || UI_ASSETS.skillColor[fallback.colorIndex],
                colorValue: SKILL_DAMAGE_COLORS[damageTypeId(group?.damageType ?? skillData?.iconBgType)] || SKILL_DEFAULT_COLOR
            };
        }

        function skillTypeLabel(type) {
            return t({
                0: 'skillTypes.normalAttack',
                1: 'skillTypes.normalSkill',
                2: 'skillTypes.ultimate',
                3: 'skillTypes.comboSkill'
            }[type], null, {
                0: '普通攻击',
                1: '战技',
                2: '终结技',
                3: '连携技'
            }[type]);
        }

        function selectedCharacter() {
            return characters.find(character => character.id === selectedCharacterId) || characters[0] || null;
        }

        function selectedSkill() {
            return selectedCharacter()?.groups.get(selectedSkillType) || null;
        }

        function normalizeSearch(value) {
            return String(value || '').trim().toLocaleLowerCase();
        }

        function updateSegmentedControl(container, dataName, value) {
            container.querySelectorAll(`[data-${dataName}]`).forEach(button => {
                const active = String(button.dataset[dataName]) === String(value);
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-checked', String(active));
            });
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
            image.src = avatarPath(character.id);
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
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
            SKILL_TYPES.forEach(type => {
                const group = character.groups.get(type);
                if (!group) return;
                const button = document.createElement('button');
                const active = type === selectedSkillType;
                button.type = 'button';
                button.className = `misc-icon-generator__skill${active ? ' is-active' : ''}`;
                button.dataset.skillType = String(type);
                button.setAttribute('role', 'radio');
                button.setAttribute('aria-checked', String(active));

                const image = document.createElement('img');
                image.src = skillPath(group.icon);
                image.alt = '';
                image.decoding = 'async';
                const copy = document.createElement('span');
                const typeName = document.createElement('small');
                const skillName = document.createElement('strong');
                typeName.textContent = skillTypeLabel(type);
                skillName.textContent = group.name;
                copy.append(typeName, skillName);
                button.append(image, copy);
                skillList.append(button);
            });
        }

        function updateSelectionLabel() {
            const character = selectedCharacter();
            const group = selectedSkill();
            selectionLabel.textContent = character && group ? `${character.name} · ${group.name}` : '';
            canvas.setAttribute('aria-label', selectionLabel.textContent || t('preview', null, '预览'));
        }

        function updateSkillBackgroundControl() {
            skillBackgroundOptions.hidden = layout === 'character';
            skillLayerOptions.hidden = layout !== SKILL_ATTRIBUTES_LAYOUT;
        }

        function isSkillAttributesLayout() {
            return layout === SKILL_ATTRIBUTES_LAYOUT;
        }

        function isSkillAttributeLayerEnabled(layer) {
            return !isSkillAttributesLayout() || enabledSkillLayers.has(layer);
        }

        async function decodeBlob(blob) {
            if (typeof window.createImageBitmap === 'function') return window.createImageBitmap(blob);
            const objectUrl = URL.createObjectURL(blob);
            try {
                return await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () => reject(new Error(t('renderFailed', null, '图标生成失败')));
                    image.src = objectUrl;
                });
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        }

        function loadImage(url) {
            if (!imagePromises.has(url)) {
                const promise = (async () => {
                    const response = await (window.akeFetch || fetch)(url, {
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

        function loadSkillData(skillId) {
            const id = String(skillId || '').trim();
            if (!id) return Promise.resolve(null);
            if (!skillDataPromises.has(id)) {
                const promise = (async () => {
                    const response = await (window.akeFetch || fetch)(
                        dataResourceUrl(`${SKILL_DATA_ROOT}/${encodeURIComponent(id)}.json`),
                        { signal: context.signal, akeProgress: false }
                    );
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })().catch(error => {
                    skillDataPromises.delete(id);
                    console.warn('角色技能 SkillData 加载失败', id, error);
                    return null;
                });
                skillDataPromises.set(id, promise);
            }
            return skillDataPromises.get(id);
        }

        async function loadUiAsset(spec) {
            const image = await loadImage(spec.path);
            const dimensions = imageDimensions(image);
            if (dimensions.width !== spec.width || dimensions.height !== spec.height) {
                throw new Error(`Invalid UI asset dimensions: ${spec.path}`);
            }
            return image;
        }

        async function loadOptionalUiAsset(spec) {
            if (!spec) return null;
            try {
                return await loadUiAsset(spec);
            } catch (error) {
                console.warn('角色图标背景素材加载失败', spec.path, error);
                return null;
            }
        }

        function roundLikePython(value) {
            const lower = Math.floor(value);
            const fraction = value - lower;
            if (fraction < 0.5) return lower;
            if (fraction > 0.5) return lower + 1;
            return lower % 2 === 0 ? lower : lower + 1;
        }

        function centeredBox(center, diameter) {
            const radius = diameter / 2;
            return [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius];
        }

        function scaleBox(box, scale) {
            return box.map(value => roundLikePython(value * scale));
        }

        function layoutForOutput() {
            const large = outputSize === 256 || outputSize === 512;
            const outputScale = outputSize > 256 ? 2 : 1;
            const contentScale = large ? NATIVE_FIRST_HINT_SCALE : 1;
            const mainCenter = large ? [128, 156] : [96, 117];
            const baseCanvas = large ? [256, 256] : [192, 192];
            const scale = SMALL_UI_SCALE * contentScale;
            const skillCenter = [
                mainCenter[0] + NATIVE_SKILL_OFFSET[0] * scale,
                mainCenter[1] + NATIVE_SKILL_OFFSET[1] * scale
            ];
            const decorationCenter = [
                mainCenter[0] + NATIVE_DECORATION_OFFSET[0] * SMALL_UI_SCALE,
                mainCenter[1] - NATIVE_DECORATION_OFFSET[1] * SMALL_UI_SCALE
            ];
            return {
                outputScale,
                canvas: baseCanvas.map(value => value * outputScale),
                portraitBox: centeredBox(mainCenter, NATIVE_PORTRAIT_RING_DIAMETER * scale),
                portraitMaskBox: centeredBox(mainCenter, NATIVE_PORTRAIT_MASK_DIAMETER * scale),
                portraitTextureBox: centeredBox(mainCenter, NATIVE_PORTRAIT_TEXTURE_DIAMETER * scale),
                skillBox: centeredBox(skillCenter, NATIVE_SKILL_RING_DIAMETER * scale),
                skillIconBox: centeredBox(skillCenter, NATIVE_SKILL_ICON_DIAMETER * scale),
                decorationBox: large ? centeredBox(decorationCenter, NATIVE_DECORATION_SIZE * SMALL_UI_SCALE) : null
            };
        }

        function imageDimensions(image) {
            return {
                width: image.naturalWidth || image.width || 1,
                height: image.naturalHeight || image.height || 1
            };
        }

        function drawFittedCover(ctx, image, box, scale) {
            const [left, top, right, bottom] = scaleBox(box, scale);
            const width = right - left;
            const height = bottom - top;
            const source = imageDimensions(image);
            const fitScale = Math.max(width / source.width, height / source.height);
            const sourceWidth = width / fitScale;
            const sourceHeight = height / fitScale;
            ctx.drawImage(
                image,
                (source.width - sourceWidth) / 2,
                (source.height - sourceHeight) / 2,
                sourceWidth,
                sourceHeight,
                left,
                top,
                width,
                height
            );
        }

        function drawCentered(ctx, image, box, scale) {
            const [left, top, right, bottom] = scaleBox(box, scale);
            ctx.drawImage(image, left, top, right - left, bottom - top);
        }

        function drawMaskedCircle(ctx, image, sourceBox, maskBox, scale) {
            const [left, top, right, bottom] = scaleBox(maskBox, scale);
            ctx.save();
            ctx.beginPath();
            ctx.ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2, 0, 0, Math.PI * 2);
            ctx.clip();
            drawFittedCover(ctx, image, sourceBox, scale);
            ctx.restore();
        }

        function drawCircleFill(ctx, box, scale) {
            const [left, top, right, bottom] = scaleBox(box, scale);
            ctx.fillStyle = SKILL_INNER_FILL;
            ctx.beginPath();
            ctx.ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        function drawTintedImage(ctx, image, box, scale, color) {
            if (!image) return;
            const [left, top, right, bottom] = scaleBox(box, scale);
            const width = right - left;
            const height = bottom - top;
            ctx.save();
            ctx.drawImage(image, left, top, width, height);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = color;
            ctx.fillRect(left, top, width, height);
            ctx.restore();
        }

        function drawSkillBackground(ctx, assets, box, scale, transparent, layers) {
            const showBase = !layers || layers.has('backgroundBase');
            const showLine = !layers || layers.has('skillLine');
            const showColor = !layers || layers.has('skillColor');
            const line = showLine ? assets?.line : null;
            const color = showColor ? assets?.color : null;
            if (!line && !color) {
                if (showBase && !transparent) drawCircleFill(ctx, box, scale);
                return;
            }
            if (line) drawCentered(ctx, line, box, scale);
            if (color) drawTintedImage(ctx, color, box, scale, assets.colorValue);
        }

        function drawComposite(portrait, skill, skillBackground, uiAssets) {
            const layoutData = layoutForOutput();
            const workingScale = SUPER_SAMPLE * layoutData.outputScale;
            const working = document.createElement('canvas');
            working.width = layoutData.canvas[0] * SUPER_SAMPLE;
            working.height = layoutData.canvas[1] * SUPER_SAMPLE;
            const ctx = working.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D is unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, working.width, working.height);

            const attributesLayout = isSkillAttributesLayout();
            const drawLayer = layer => isSkillAttributeLayerEnabled(layer);
            if (layoutData.decorationBox && drawLayer('decoration')) {
                drawCentered(ctx, uiAssets.decoration, layoutData.decorationBox, workingScale);
            }
            const mainSource = layout === 'character' ? portrait : skill;
            const badgeSource = layout === 'character' ? skill : portrait;
            if (layout === 'skill' && !transparentInput.checked) {
                drawCircleFill(ctx, layoutData.portraitMaskBox, workingScale);
            } else if (attributesLayout) {
                drawSkillBackground(
                    ctx,
                    skillBackground,
                    layoutData.portraitBox,
                    workingScale,
                    transparentInput.checked,
                    enabledSkillLayers
                );
            }
            if (drawLayer('skill')) {
                drawMaskedCircle(ctx, mainSource, layoutData.portraitTextureBox, layoutData.portraitMaskBox, workingScale);
            }
            if (drawLayer('portraitRing')) {
                drawCentered(ctx, uiAssets.portraitRing, layoutData.portraitBox, workingScale);
            }
            if (drawLayer('skillRing')) {
                drawCentered(ctx, uiAssets.skillRing, layoutData.skillBox, workingScale);
            }
            if (drawLayer('character')) {
                drawMaskedCircle(ctx, badgeSource, layoutData.skillIconBox, layoutData.skillIconBox, workingScale);
            }

            canvas.width = layoutData.canvas[0];
            canvas.height = layoutData.canvas[1];
            canvasContext.setTransform(1, 0, 0, 1, 0, 0);
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);
            canvasContext.imageSmoothingEnabled = true;
            canvasContext.imageSmoothingQuality = 'high';
            canvasContext.drawImage(working, 0, 0, canvas.width, canvas.height);
            working.width = 0;
            working.height = 0;
        }

        async function renderPreview() {
            const generation = ++renderGeneration;
            const character = selectedCharacter();
            const group = selectedSkill();
            renderReady = false;
            downloadButton.disabled = true;
            updateSelectionLabel();
            if (!character || !group || !canvasContext) {
                setStatus('renderFailed', '图标生成失败', 'error');
                return;
            }
            setStatus('rendering', '正在生成', 'loading');
            try {
                const attributesLayout = isSkillAttributesLayout();
                const skillData = attributesLayout ? await loadSkillData(group.skillId) : null;
                const backgroundSpec = attributesLayout ? skillBackgroundSpec(group, skillData) : null;
                const layerEnabled = layer => isSkillAttributeLayerEnabled(layer);
                const [portrait, skill, decoration, portraitRing, skillRing, skillLine, skillColor] = await Promise.all([
                    layerEnabled('character') ? loadImage(avatarPath(character.id)) : Promise.resolve(null),
                    layerEnabled('skill') ? loadImage(skillPath(group.icon)) : Promise.resolve(null),
                    layerEnabled('decoration') ? loadUiAsset(UI_ASSETS.decoration) : Promise.resolve(null),
                    layerEnabled('portraitRing') ? loadUiAsset(UI_ASSETS.portraitRing) : Promise.resolve(null),
                    layerEnabled('skillRing') ? loadUiAsset(UI_ASSETS.skillRing) : Promise.resolve(null),
                    attributesLayout && layerEnabled('skillLine')
                        ? loadOptionalUiAsset(backgroundSpec.line)
                        : Promise.resolve(null),
                    attributesLayout && layerEnabled('skillColor')
                        ? loadOptionalUiAsset(backgroundSpec.color)
                        : Promise.resolve(null)
                ]);
                if (disposed || context.signal.aborted || generation !== renderGeneration) return;
                drawComposite(portrait, skill, {
                    line: skillLine,
                    color: skillColor,
                    colorValue: backgroundSpec?.colorValue || SKILL_DEFAULT_COLOR
                }, { decoration, portraitRing, skillRing });
                renderReady = true;
                downloadButton.disabled = false;
                setStatus('ready', '已就绪', 'ready');
            } catch (error) {
                if (disposed || context.signal.aborted || generation !== renderGeneration) return;
                console.warn('角色图标生成失败', error);
                setStatus('renderFailed', '图标生成失败', 'error');
            }
        }

        function selectCharacter(characterId, updateRoute) {
            if (!characters.some(character => character.id === characterId)) return;
            selectedCharacterId = characterId;
            const character = selectedCharacter();
            if (!character.groups.has(selectedSkillType)) selectedSkillType = SKILL_TYPES.find(type => character.groups.has(type)) || 0;
            renderCharacterList();
            renderSkillList();
            updateSelectionLabel();
            if (updateRoute) context.navigate(characterId);
            void renderPreview();
        }

        function selectSkillType(type) {
            const parsed = Number(type);
            if (!selectedCharacter()?.groups.has(parsed)) return;
            selectedSkillType = parsed;
            renderSkillList();
            updateSelectionLabel();
            void renderPreview();
        }

        function safeFilename(value) {
            const cleaned = String(value || '')
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
                .replace(/[. ]+$/g, '')
                .trim()
                .slice(0, 96);
            return cleaned || 'AKEData-icon';
        }

        async function downloadPng() {
            if (!renderReady || downloading || disposed) return;
            const character = selectedCharacter();
            const group = selectedSkill();
            if (!character || !group) return;
            const exportLayout = layout;
            const exportSize = outputSize;
            const exportSkillType = selectedSkillType;
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            exportCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
            downloading = true;
            downloadButton.disabled = true;
            downloadButton.setAttribute('aria-busy', 'true');
            try {
                const blob = await new Promise((resolve, reject) => {
                    exportCanvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png');
                });
                if (disposed || context.signal.aborted) return;
                const url = URL.createObjectURL(blob);
                downloadUrls.add(url);
                const anchor = document.createElement('a');
                const layoutName = exportLayout === 'character'
                    ? t('characterFocus', null, '角色主图')
                    : exportLayout === 'skill'
                        ? t('skillFocus', null, '技能主图')
                        : t('skillAttributesFocus', null, '技能带属性');
                anchor.download = `${safeFilename(`${character.name}-${skillTypeLabel(exportSkillType)}-${layoutName}-${exportSize}`)}.png`;
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
                if (!disposed) {
                    console.warn('PNG 下载失败', error);
                    setStatus('downloadFailed', `下载失败：${error.message}`, 'error', { message: error.message });
                }
            } finally {
                downloading = false;
                if (!disposed) {
                    downloadButton.removeAttribute('aria-busy');
                    downloadButton.disabled = !renderReady;
                }
            }
        }

        if (!canvasContext) {
            setStatus('renderFailed', '图标生成失败', 'error');
            return {};
        }
        skillLayerInputs.forEach(input => {
            input.checked = true;
        });

        try {
            setStatus('rendering', '正在生成', 'loading');
            const [characterTable, growthTable, skillPatchTable] = await Promise.all([
                context.table('CharacterTable'),
                context.table('CharGrowthTable'),
                context.table('SkillPatchTable')
            ]);
            if (context.signal.aborted) return {};
            characters = Object.entries(characterTable || {})
                .filter(([id]) => id !== 'chr_9000_endmin')
                .map(([id, row]) => {
                    const groups = new Map();
                    Object.values(growthTable?.[id]?.skillGroupMap || {}).forEach(group => {
                        const type = Number(group.skillGroupType);
                        if (!SKILL_TYPES.includes(type) || !group.icon) return;
                        const firstSkillId = Array.isArray(group.skillIdList) ? group.skillIdList[0] : '';
                        const patchBundle = skillPatchTable?.[firstSkillId]?.SkillPatchDataBundle;
                        const patch = Array.isArray(patchBundle)
                            ? patchBundle.find(entry => Number(entry?.level) === 1) || patchBundle[0]
                            : patchBundle;
                        const background = SKILL_GROUP_BACKGROUND[type] || SKILL_GROUP_BACKGROUND[0];
                        groups.set(type, {
                            type,
                            skillId: firstSkillId,
                            icon: String(patch?.iconId || group.icon),
                            damageType: patch?.iconBgType == null ? null : damageTypeId(patch.iconBgType),
                            skillLineIndex: background.lineIndex,
                            skillColorIndex: background.colorIndex,
                            name: localizedText(group.name, skillTypeLabel(type))
                        });
                    });
                    const defaultName = localizedText(row.name, id);
                    const name = id === 'chr_0002_endminm'
                        ? t('administratorMale', null, '管理员（男）')
                        : id === 'chr_0003_endminf'
                            ? t('administratorFemale', null, '管理员（女）')
                            : defaultName;
                    return {
                        id,
                        name,
                        groups,
                        order: Number(row.sortOrder ?? growthTable?.[id]?.sortOrder ?? 9999),
                        searchText: normalizeSearch(`${name} ${id}`)
                    };
                })
                .filter(character => SKILL_TYPES.every(type => character.groups.has(type)))
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
            if (!characters.length) throw new Error('No character skill groups');

            const routeCharacter = characters.find(character => character.id === context.routeId)?.id;
            selectedCharacterId = routeCharacter || characters[0].id;
            renderCharacterList();
            renderSkillList();
            updateSegmentedControl(layoutOptions, 'layout', layout);
            updateSegmentedControl(sizeOptions, 'size', outputSize);
            updateSelectionLabel();
            updateSkillBackgroundControl();

            context.on(characterSearch, 'input', renderCharacterList);
            context.on(characterList, 'click', event => {
                const button = event.target.closest('[data-character-id]');
                if (button) selectCharacter(button.dataset.characterId, true);
            });
            context.on(skillList, 'click', event => {
                const button = event.target.closest('[data-skill-type]');
                if (button) selectSkillType(button.dataset.skillType);
            });
            context.on(layoutOptions, 'click', event => {
                const button = event.target.closest('[data-layout]');
                if (!button || !['character', 'skill', SKILL_ATTRIBUTES_LAYOUT].includes(button.dataset.layout)) return;
                layout = button.dataset.layout;
                updateSegmentedControl(layoutOptions, 'layout', layout);
                updateSkillBackgroundControl();
                void renderPreview();
            });
            context.on(sizeOptions, 'click', event => {
                const button = event.target.closest('[data-size]');
                const size = Number(button?.dataset.size);
                if (!VALID_OUTPUT_SIZES.has(size)) return;
                outputSize = size;
                updateSegmentedControl(sizeOptions, 'size', outputSize);
                void renderPreview();
            });
            context.on(skillLayerOptions, 'change', event => {
                const input = event.target.closest('input[data-skill-layer]');
                const layer = input?.dataset.skillLayer;
                if (!input || !SKILL_ATTRIBUTE_LAYERS.includes(layer)) return;
                if (input.checked) enabledSkillLayers.add(layer);
                else enabledSkillLayers.delete(layer);
                if (isSkillAttributesLayout()) void renderPreview();
            });
            context.on(transparentInput, 'change', () => void renderPreview());
            context.on(downloadButton, 'click', () => void downloadPng());
            await renderPreview();
        } catch (error) {
            if (!context.signal.aborted) {
                console.error('角色图标生成器加载失败', error);
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
                skillDataPromises.clear();
                if (canvas) {
                    canvas.width = 0;
                    canvas.height = 0;
                }
            }
        };
    });
})();
