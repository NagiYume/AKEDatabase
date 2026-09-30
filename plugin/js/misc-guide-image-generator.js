(function () {
    'use strict';

    const MODULE_ID = 'guide_image_generator';
    const IMAGE_ROOT = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites';
    const PROFESSION_NAMES = { 0: '近卫', 2: '重装', 4: '辅助', 5: '术师', 7: '先锋', 8: '突击' };
    const ELEMENT_NAMES = { 0: '物理', 1: '灼热', 2: '寒冷', 3: '自然', 4: '电磁', 5: '物理', 39: '物理', 40: '灼热', 41: '寒冷', 42: '自然', 43: '电磁', Pulse: '电磁', Fire: '灼热', Cold: '寒冷', Natural: '自然', Physical: '物理', Cryst: '寒冷' };
    const SKILL_NAMES = ['普通攻击', '战技', '连携技', '终结技'];
    const REFERENCE_ASSETS = '/plugin/js/guide-reference';
    const REFERENCE_ELEMENT = { 0: 'Physical', 1: 'Fire', 2: 'Cold', 3: 'Natural', 4: 'Pulse', 39: 'Physical', 40: 'Fire', 41: 'Cold', 42: 'Natural', 43: 'Pulse' };
    const ELEMENT_ICONS = { Natural: 'nature', Physical: 'physical', Pulse: 'pulse', Fire: 'fire', Cold: 'cold' };
    const DEFAULT_LAYOUTS = {
        horizontal: {
            portrait: { x: 30, y: 20, w: 300, h: 340, label: '角色立绘' },
            skills: { x: 340, y: 20, w: 610, h: 340, label: '技能加点' },
            potential: { x: 966, y: 20, w: 924, h: 504, label: '潜能收益' },
            weapons: { x: 30, y: 372, w: 320, h: 504, label: '武器建议' },
            equipments: { x: 366, y: 372, w: 588, h: 504, label: '装备建议' },
            ratio: { x: 966, y: 540, w: 462, h: 338, label: '倍率分布' },
            dmg: { x: 1444, y: 540, w: 446, h: 338, label: '伤害分布' }
        },
        vertical: {
            header: { x: 44, y: 45, w: 1832, h: 565, label: '干员信息' },
            recommendations: { x: 44, y: 659, w: 906, h: 684, label: '武器推荐' },
            equipments: { x: 969, y: 659, w: 907, h: 684, label: '装备推荐' },
            skills: { x: 44, y: 1374, w: 906, h: 1001, label: '技能加点' },
            rotation: { x: 969, y: 1374, w: 907, h: 1001, label: '推荐手法' },
            potential: { x: 44, y: 2398, w: 1832, h: 1052, label: '潜能收益' },
            comparison: { x: 44, y: 3470, w: 1832, h: 1960, label: '配置分析' },
            team: { x: 44, y: 5486, w: 1832, h: 804, label: '队伍搭配' }
        }
    };
    const root = document.querySelector('[data-misc-module="guide_image_generator"]');
    if (!root) return;

    const $ = selector => root.querySelector(selector);
    const canvas = $('#guideImageCanvas');
    const ctx = canvas?.getContext('2d');
    const status = $('#guideImageGeneratorStatus');
    const dimensions = $('#guideImageDimensions');
    const imageCache = new Map();
    const referenceImages = new Map();
    let disposed = false;
    let characters = [];
    let characterTable = {};
    let growthTable = {};
    let skillPatchTable = {};
    let itemTable = {};
    let weaponTable = {};
    let equipTable = {};
    let attributeNames = {};
    let state = {
        mode: 'horizontal', title: '', background: '#212121', characterId: '', characterName: '', description: '',
        skills: SKILL_NAMES.map(name => ({ name, rank: '9' })), weapons: Array.from({ length: 4 }, () => ({ id: '', note: '' })),
        equips: Array.from({ length: 8 }, () => ({ id: '', note: '' })), team: Array.from({ length: 4 }, () => ''),
        potentialLabels: '0潜,1潜,2潜,3潜,4潜,5潜,5+6潜', potentialValues: '100,110,115,115,119,134,163',
        potentialNote: '', teamNote: '', buildNote: '', rotationNote: '', ratioTitle: '倍率分布(无buff)', damageTitle: '伤害分布(有buff)',
        ratio: '大招:0,战技:54.3,连携:16.55,普攻:29.15', damage: '大招:0,战技:65.87,连携:13.2,普攻:20.93',
        layout: { horizontal: {}, vertical: {} }, layoutMode: false
    };

    function layoutRect(mode, id) {
        const fallback = DEFAULT_LAYOUTS[mode][id];
        const custom = state.layout?.[mode]?.[id] || {};
        return { ...fallback, ...custom };
    }

    function layoutSize(mode) {
        if (mode === 'horizontal') return { width: 1920, height: 1080 };
        const last = layoutRect('vertical', 'team');
        return { width: 1920, height: Math.max(6349, last.y + last.h + 59) };
    }

    function setStatus(message, kind) {
        if (!status) return;
        status.textContent = message || '';
        status.dataset.state = kind || '';
    }

    function text(value, fallback) {
        return context.text(value, fallback) || fallback || '';
    }

    function assetUrl(path) {
        return context.dataResourceUrl(`${IMAGE_ROOT}/${path}`);
    }

    function characterName(id, row) {
        const fallback = id === 'chr_0002_endminm' ? '管理员（男）' : id === 'chr_0003_endminf' ? '管理员（女）' : '未命名干员';
        return text(row?.name, fallback);
    }

    function itemName(id) {
        return text(itemTable[id]?.name || weaponTable[id]?.name, id ? '未命名物品' : '');
    }

    function assetEntryName(id, kind) {
        return text(kind === 'weapon' ? weaponTable[id]?.name || itemTable[id]?.name : itemTable[id]?.name, id ? '未命名物品' : '');
    }

    function image(path) {
        if (!path) return Promise.resolve(null);
        const url = assetUrl(path);
        if (imageCache.has(url)) return imageCache.get(url);
        const request = new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                imageCache.delete(url);
                resolve(null);
            };
            img.src = url;
        });
        imageCache.set(url, request);
        return request;
    }

    function referenceImage(name) {
        if (referenceImages.has(name)) return referenceImages.get(name);
        const request = new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                referenceImages.delete(name);
                resolve(null);
            };
            const url = new URL(`${REFERENCE_ASSETS}/${name}`, window.location.href);
            url.searchParams.set('v', window.__akeBootstrapVersion?.jsversion?.['plugin/js/misc-guide-image-generator.js'] || '1.2.21-pre1');
            img.src = url.href;
        });
        referenceImages.set(name, request);
        return request;
    }

    function characterImage(id) { return image(`charroundicon/icon_round_${id}.png`); }
    function portraitImage(id) { return image(`charicon/icon_${id}.png`); }
    function skillImage(icon) { return image(`skillicon/${icon}.png`); }
    function itemImage(id) { return image(`itemiconbig/${itemTable[id]?.iconId || id}.png`); }

    function buildAttributeNames(filters, shows) {
        attributeNames = {};
        Object.entries(shows || {}).forEach(([attrType, group]) => (group.list || []).forEach(entry => {
            if (entry.name) attributeNames[`${entry.attributeModifier}:${attrType}:`] = text(entry.name, '');
        }));
        Object.values(filters || {}).forEach(group => (group.list || []).forEach(entry => {
            const name = text(entry.name, '');
            if (!name) return;
            const key = `${entry.attributeModifier}:${entry.attributeType}:${entry.compositeAttr || ''}`;
            attributeNames[key] = name;
            if (entry.compositeAttr) attributeNames[entry.compositeAttr] = name;
        }));
    }

    function autoEntryLabels(id, kind) {
        if (kind === 'weapon') {
            const row = weaponTable[id] || {};
            return (row.weaponSkillList || []).map(skillId => {
                const bundle = skillPatchTable[skillId]?.SkillPatchDataBundle || [];
                const skill = bundle[bundle.length - 1] || {};
                return text(skill.skillName, '') || text(skill.description, '') || skillId;
            }).filter(Boolean).slice(0, 3);
        }
        const row = equipTable[id] || {};
        return (row.displayAttrModifiers || []).map(modifier => {
            const key = `${modifier.modifierType}:${modifier.attrType}:${modifier.compositeAttr || ''}`;
            return attributeNames[key] || attributeNames[modifier.compositeAttr] || `属性 ${modifier.attrType}`;
        }).filter(Boolean).slice(0, 3);
    }

    function syncAutoEntry(entry, kind) {
        entry.note = autoEntryLabels(entry.id, kind).join(',');
        entry.name = assetEntryName(entry.id, kind);
    }

    function normalizeNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function splitList(value, fallback) {
        const result = String(value || '').split(/[,，]/).map(item => item.trim()).filter(Boolean);
        return result.length ? result : fallback;
    }

    function option(value, label) {
        const element = document.createElement('option');
        element.value = value;
        element.textContent = label;
        return element;
    }

    function populateSelect(select, values, selected) {
        select.replaceChildren(...values.map(item => option(item.value, item.label)));
        if (selected != null) select.value = selected;
    }

    function createRow(label, control) {
        const row = document.createElement('div');
        row.className = 'ake-ui-form-row';
        const title = document.createElement('label');
        title.textContent = label;
        row.append(title, control);
        return row;
    }

    function createSelect(values, selected, label) {
        const select = document.createElement('select');
        select.className = 'ake-ui-control ake-ui-control--select';
        select.setAttribute('aria-label', label);
        populateSelect(select, values, selected);
        return select;
    }

    function createAssetPicker(values, selected, label, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'guide-image-picker';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'guide-image-picker__button';
        button.setAttribute('aria-label', label);
        const buttonImage = document.createElement('img');
        buttonImage.alt = '';
        const buttonText = document.createElement('span');
        button.append(buttonImage, buttonText);
        const panel = document.createElement('div');
        panel.className = 'guide-image-picker__panel';
        panel.hidden = true;
        const search = createInput('', `${label}搜索`);
        search.classList.add('guide-image-picker__search');
        panel.append(search);
        const grid = document.createElement('div');
        grid.className = 'guide-image-picker__grid';
        panel.append(grid);
        const renderButton = value => {
            buttonText.textContent = value ? value.label : '不显示';
            buttonImage.hidden = !value;
            if (value) {
                buttonImage.src = assetUrl(`itemiconbig/${itemTable[value.value]?.iconId || value.value}.png`);
            }
        };
        const renderGrid = () => {
            const query = search.value.trim().toLowerCase();
            grid.replaceChildren();
            values.filter(value => !query || value.label.toLowerCase().includes(query)).forEach(value => {
                const optionButton = document.createElement('button');
                optionButton.type = 'button';
                optionButton.className = 'guide-image-picker__option';
                const imageElement = document.createElement('img');
                imageElement.src = assetUrl(`itemiconbig/${itemTable[value.value]?.iconId || value.value}.png`);
                imageElement.alt = '';
                const name = document.createElement('span');
                name.textContent = value.label;
                optionButton.append(imageElement, name);
                optionButton.addEventListener('click', () => {
                    onChange(value.value);
                    renderButton(value);
                    panel.hidden = true;
                });
                grid.append(optionButton);
            });
        };
        const selectedValue = values.find(value => value.value === selected);
        renderButton(selectedValue);
        button.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderGrid(); });
        search.addEventListener('input', renderGrid);
        wrapper.append(button, panel);
        return wrapper;
    }

    function createInput(value, label, type = 'text') {
        const input = document.createElement('input');
        input.className = 'ake-ui-control';
        input.type = type;
        input.value = value ?? '';
        input.maxLength = 160;
        input.setAttribute('aria-label', label);
        return input;
    }

    function renderCharacterOptions() {
        const select = $('#guideImageCharacter');
        const values = characters.map(row => ({ value: row.id, label: row.name }));
        populateSelect(select, values, state.characterId || values[0]?.value);
    }

    function characterSkillOptions(characterId) {
        const groups = Object.values(growthTable[characterId]?.skillGroupMap || {});
        return SKILL_NAMES.map((label, index) => {
            const group = groups.find(item => Number(item.skillGroupType) === index) || groups[index] || {};
            const skillId = Array.isArray(group.skillIdList) ? group.skillIdList[0] : '';
            const patch = skillPatchTable[skillId]?.SkillPatchDataBundle?.[0] || {};
            return { label, group, skillId, icon: patch.iconId || group.icon || 'icon_attack_sword' };
        });
    }

    function renderDynamicControls() {
        const skills = $('#guideImageSkills');
        skills.replaceChildren();
        characterSkillOptions(state.characterId).forEach((skill, index) => {
            const name = createInput(state.skills[index]?.name || skill.label, `${skill.label}名称`);
            const rank = createInput(state.skills[index]?.rank || '9', `${skill.label}等级`);
            name.addEventListener('input', () => { state.skills[index].name = name.value; render(); });
            rank.addEventListener('input', () => { state.skills[index].rank = rank.value; render(); });
            skills.append(createRow(`${skill.label}名称`, name), createRow('等级', rank));
        });

        const weaponValues = Object.entries(weaponTable).map(([id]) => ({ value: id, label: assetEntryName(id, 'weapon') }));
        const weapons = $('#guideImageWeapons');
        weapons.replaceChildren();
        state.weapons.forEach((entry, index) => {
            const picker = createAssetPicker(weaponValues, entry.id, `武器${index + 1}`, id => {
                entry.id = id;
                syncAutoEntry(entry, 'weapon');
                renderDynamicControls(); render();
            });
            const name = createInput(entry.name || '', `武器${index + 1}名称`);
            const note = createInput(entry.note || '', `武器${index + 1}词条`);
            name.addEventListener('input', () => { entry.name = name.value; render(); });
            note.addEventListener('input', () => { entry.note = note.value; render(); });
            weapons.append(createRow(`武器${index + 1}`, picker), createRow('名称', name), createRow('词条', note));
        });

        const equipValues = Object.entries(equipTable).map(([id]) => ({ value: id, label: itemName(id) }));
        const equips = $('#guideImageEquips');
        equips.replaceChildren();
        state.equips.forEach((entry, index) => {
            const picker = createAssetPicker(equipValues, entry.id, `装备${index + 1}`, id => {
                entry.id = id;
                syncAutoEntry(entry, 'equip');
                renderDynamicControls(); render();
            });
            const name = createInput(entry.name || '', `装备${index + 1}名称`);
            const note = createInput(entry.note || '', `装备${index + 1}词条`);
            name.addEventListener('input', () => { entry.name = name.value; render(); });
            note.addEventListener('input', () => { entry.note = note.value; render(); });
            equips.append(createRow(`装备${index + 1}`, picker), createRow('名称', name), createRow('词条', note));
        });

        const team = $('#guideImageTeam');
        team.replaceChildren();
        const teamValues = [{ value: '', label: '不显示' }, ...characters.map(row => ({ value: row.id, label: row.name }))];
        state.team.forEach((id, index) => {
            const select = createSelect(teamValues, id, `队伍干员${index + 1}`);
            select.addEventListener('change', () => { state.team[index] = select.value; render(); });
            team.append(createRow(`干员${index + 1}`, select));
        });

        renderLayoutFields();
    }

    function renderLayoutFields() {
        const host = $('#guideImageLayoutFields');
        if (!host) return;
        host.replaceChildren();
        const title = document.createElement('div');
        title.className = 'guide-image-layout-fields-title';
        title.textContent = '当前版式模块位置 / 大小（X、Y、宽、高）';
        host.append(title);
        layoutModulesForMode(state.mode).forEach(module => {
            const rect = layoutRect(state.mode, module.id);
            const row = document.createElement('div');
            row.className = 'guide-image-layout-grid';
            ['x', 'y', 'w', 'h'].forEach(axis => {
                const input = createInput(rect[axis], `${module.label}${axis}`, 'number');
                input.min = '0';
                input.placeholder = axis.toUpperCase();
                input.addEventListener('input', () => {
                    if (!state.layout[state.mode]) state.layout[state.mode] = {};
                    state.layout[state.mode][module.id] = { ...layoutRect(state.mode, module.id), [axis]: normalizeNumber(input.value, rect[axis]) };
                    void render();
                });
                row.append(input);
            });
            const label = document.createElement('div');
            label.textContent = module.label;
            label.className = 'guide-image-layout-fields-title';
            host.append(label, row);
        });
    }

    function layoutModulesForMode(mode) {
        return Object.entries(DEFAULT_LAYOUTS[mode] || {}).map(([id, value]) => ({ id, ...value }));
    }

    function syncBaseControls() {
        $('#guideImageMode').value = state.mode;
        $('#guideImageTitle').value = state.title;
        $('#guideImageBackground').value = state.background;
        $('#guideImageCharacter').value = state.characterId;
        $('#guideImageCharacterName').value = state.characterName;
        $('#guideImageDescription').value = state.description;
        $('#guideImageBuildNote').value = state.buildNote;
        $('#guideImageRotationNote').value = state.rotationNote;
        $('#guideImageRatioTitle').value = state.ratioTitle;
        $('#guideImageDamageTitle').value = state.damageTitle;
        $('#guideImagePotentialLabels').value = state.potentialLabels;
        $('#guideImagePotentialValues').value = state.potentialValues;
        $('#guideImagePotentialNote').value = state.potentialNote;
        $('#guideImageTeamNote').value = state.teamNote;
        $('#guideImageRatio').value = state.ratio;
        $('#guideImageDamage').value = state.damage;
    }

    function selectCharacter(id) {
        const row = characterTable[id] || {};
        state.characterId = id;
        state.characterName = characterName(id, row);
        const skills = characterSkillOptions(id);
        state.skills = skills.map((skill, index) => ({ name: text(skill.group.name, skill.label), rank: state.skills[index]?.rank || '9' }));
        renderDynamicControls();
        syncBaseControls();
        render();
    }

    function roundRect(context, x, y, w, h, radius, fill, stroke) {
        const r = Math.min(radius, w / 2, h / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + w, y, x + w, y + h, r);
        context.arcTo(x + w, y + h, x, y + h, r);
        context.arcTo(x, y + h, x, y, r);
        context.arcTo(x, y, x + w, y, r);
        context.closePath();
        if (fill) { context.fillStyle = fill; context.fill(); }
        if (stroke) { context.strokeStyle = stroke; context.stroke(); }
    }

    function fitText(value, maxWidth, size) {
        let result = String(value || '');
        ctx.font = `700 ${size}px "Microsoft YaHei", sans-serif`;
        while (result.length > 1 && ctx.measureText(result).width > maxWidth) result = `${result.slice(0, -2)}…`;
        return result;
    }

    function drawText(value, x, y, size, color = '#222', align = 'left', weight = 600) {
        ctx.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value || ''), x, y);
    }

    function drawImageCover(img, x, y, w, h) {
        if (!img) return;
        const scale = Math.max(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        ctx.restore();
    }

    function drawImageContain(img, x, y, w, h) {
        if (!img) return;
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }

    function drawPanel(x, y, w, h, title, dark = true, headerH = 54) {
        roundRect(ctx, x, y, w, h, 10, dark ? '#282828' : '#f4f4f4', dark ? '#3e3e3e' : '#c2c2c2');
        ctx.save();
        roundRect(ctx, x, y, w, headerH, 10, dark ? '#383838' : '#333', null);
        ctx.fillStyle = dark ? '#383838' : '#333';
        ctx.fillRect(x, y + headerH - 6, w, 6);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(x + 8, y + headerH - 1, w - 16, 1);
        ctx.fillStyle = '#ffb228';
        roundRect(ctx, x + 16, y + (headerH - 18) / 2, 5, 18, 2, '#ffb228', null);
        ctx.restore();
        drawText(title, x + 32, y + headerH / 2, 27, '#fff', 'left', 700);
    }

    function drawBarChart(x, y, w, h) {
        const labels = splitList(state.potentialLabels, ['0潜', '1潜', '2潜', '3潜', '4潜', '5潜', '5+6潜']);
        const values = splitList(state.potentialValues, labels.map(() => '100')).map(value => normalizeNumber(value, 0));
        const max = Math.max(...values, 1);
        const gap = w / Math.max(1, labels.length);
        const plotH = h - 68;
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        for (let line = 1; line <= 4; line += 1) {
            const gy = y + 34 + plotH * (1 - line / 4);
            ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
        }
        values.forEach((value, index) => {
            const barH = Math.max(6, (value / max) * plotH);
            const bx = x + gap * index + gap * 0.25;
            const bw = Math.min(52, gap * 0.55);
            const barX = x + gap * index + gap / 2 - bw / 2;
            const barY = y + 34 + plotH - barH;
            const gradient = ctx.createLinearGradient(barX, barY, barX, barY + barH);
            gradient.addColorStop(0, '#ffd873');
            gradient.addColorStop(1, '#ffb228');
            roundRect(ctx, barX, barY, bw, barH, Math.min(6, bw / 2), gradient, 'rgba(255,255,255,.18)');
            const valueText = `${value.toFixed(1)}%`;
            roundRect(ctx, barX + bw / 2 - 31, barY - 28, 62, 24, 5, 'rgba(20,16,4,.85)', null);
            drawText(valueText, barX + bw / 2, barY - 16, 17, '#ffd873', 'center', 700);
            drawText(labels[index] || '', barX + bw / 2, y + h - 8, 19, '#e8e8e8', 'center', 600);
        });
    }

    function segmentList(value) {
        return String(value || '').split(/[,，]/).map(item => {
            const parts = item.split(/[:：]/);
            return { label: parts[0]?.trim() || '', value: normalizeNumber(parts[1], 0) };
        }).filter(item => item.label);
    }

    function drawDonut(x, y, radius, value) {
        const segments = segmentList(value);
        const total = segments.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
        const colors = window.AKEGuideReference?.DONUT_COLORS || ['#ef822f', '#76bd43', '#f2ba03', '#4874cb'];
        let angle = -Math.PI / 2;
        segments.forEach((item, index) => {
            const next = angle + Math.PI * 2 * Math.max(0, item.value) / total;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, angle, next);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            angle = next;
        });
        segments.forEach((item, index) => {
            const ly = y - (Math.min(segments.length, 5) - 1) * 20 + index * 40;
            if (index >= 5) return;
            ctx.fillStyle = colors[index % colors.length];
            roundRect(ctx, x + radius + 28, ly - 7, 28, 14, 4, colors[index % colors.length], null);
            drawText(item.label, x + radius + 66, ly, 19, '#d0d0d0');
            drawText(`${item.value.toFixed(2)}%`, x + radius + 66 + 125, ly, 20, '#fff', 'right', 700);
        });
    }


    async function renderHorizontal() {
        const template = window.AKEGuideTemplate;
        if (!template) throw new Error('参考横版模板未加载');
        const char = characterTable[state.characterId] || {};
        const element = REFERENCE_ELEMENT[char.mainAttrType] || REFERENCE_ELEMENT[char.subAttrType] || '';
        const skills = characterSkillOptions(state.characterId);
        const [bg, subtitle, blank, portrait, ...icons] = await Promise.all([
            referenceImage('bg.jpg'), referenceImage('subtitle.png'), referenceImage('blank.png'),
            portraitImage(state.characterId),
            ...skills.map(skill => skillImage(skill.icon)),
            ...state.weapons.map(entry => entry.id ? itemImage(entry.id) : Promise.resolve(null)),
            ...state.equips.map(entry => entry.id ? itemImage(entry.id) : Promise.resolve(null)),
            image(`charprofessionicon/icon_profession_${char.profession}.png`),
            element ? image(`elementicon/icon_charattrtype_${ELEMENT_ICONS[element]}.png`) : Promise.resolve(null),
            ...[1, 2, 3].map(n => referenceImage(`spec${n}.svg`))
        ]);
        const assets = { vicon: portrait, profIcon: icons[16], elemIcon: icons[17] };
        skills.forEach((skill, i) => { assets[`skills.${i}.icon`] = icons[i]; });
        state.weapons.forEach((entry, i) => { assets[`weapons.${i}.icon`] = icons[4 + i]; });
        state.equips.forEach((entry, i) => { assets[`equipments.${i}.icon`] = icons[8 + i]; });
        const oldLayout = state.layout.horizontal || {};
        const fields = {
            characterName: state.characterName, profession: String(char.profession ?? ''), element,
            rarity: char.rarity, bgColor: state.background, skills: state.skills.map((entry, index) => ({ name: entry?.name || skills[index]?.label, rank: entry?.rank || '9' })),
            skillsTitle: '技能加点',
            weapons: state.weapons.map(entry => ({ name: entry.id ? entry.name || assetEntryName(entry.id, 'weapon') : '', stars: weaponTable[entry.id]?.rarity || itemTable[entry.id]?.rarity, stats: entry.note })),
            equipments: state.equips.map(entry => ({ name: entry.id ? entry.name || itemName(entry.id) : '', stars: itemTable[entry.id]?.rarity, stats: entry.note })),
            potLabels: state.potentialLabels, potValues: state.potentialValues, potNote: state.potentialNote,
            ratioTitle: state.ratioTitle, dmgTitle: state.damageTitle,
            ratioSegments: segmentList(state.ratio), dmgSegments: segmentList(state.damage),
            layout: Object.fromEntries(Object.keys(DEFAULT_LAYOUTS.horizontal).map(id => [id, oldLayout[id] || oldLayout[id === 'equipments' ? 'equips' : id === 'dmg' ? 'damage' : id] || {}]))
        };
        canvas.width = template.width;
        canvas.height = template.height;
        template.draw(ctx, fields, assets, { bg, subtitle, blank, specs: { 1: icons[18], 2: icons[19], 3: icons[20] } });
        dimensions.textContent = `${canvas.width} × ${canvas.height}`;
    }

    function verticalSection(rect, title) {
        ctx.fillStyle = '#202326';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = '#555a60';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = '#34383c';
        ctx.fillRect(rect.x, rect.y, rect.w, 65);
        ctx.fillStyle = '#ffc247';
        ctx.fillRect(rect.x + 26, rect.y + 15, 7, 35);
        drawText(title, rect.x + 51, rect.y + 34, 32, '#fff', 'left', 800);
    }

    function verticalLines(value, x, y, maxWidth, lineHeight, size, color = '#eee') {
        const paragraphs = String(value || '').split(/\n/);
        let row = 0;
        ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
        for (const paragraph of paragraphs) {
            let line = '';
            for (const character of paragraph) {
                if (line && ctx.measureText(line + character).width > maxWidth) {
                    drawText(line, x, y + row++ * lineHeight, size, color);
                    line = '';
                }
                line += character;
            }
            drawText(line, x, y + row++ * lineHeight, size, color);
        }
    }

    async function renderVertical() {
        const W = 1920, H = layoutSize('vertical').height;
        const skills = characterSkillOptions(state.characterId);
        const [portrait, ...images] = await Promise.all([
            portraitImage(state.characterId),
            ...skills.map(skill => skillImage(skill.icon)),
            ...state.weapons.map(entry => entry.id ? itemImage(entry.id) : Promise.resolve(null)),
            ...state.equips.map(entry => entry.id ? itemImage(entry.id) : Promise.resolve(null)),
            ...state.team.map(id => id ? characterImage(id) : Promise.resolve(null))
        ]);
        canvas.width = W; canvas.height = H;
        ctx.fillStyle = '#13171a'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#30363a'; ctx.fillRect(0, 0, W, 46);
        ctx.fillStyle = '#f5be45'; ctx.fillRect(44, 44, 14, H - 88);
        ctx.fillRect(W - 58, 44, 14, H - 88);
        const header = layoutRect('vertical', 'header');
        verticalSection(header, state.title || '干员攻略');
        drawImageCover(portrait, header.x + 35, header.y + 95, 290, 420);
        drawText(state.characterName, header.x + 370, header.y + 160, 68, '#fff', 'left', 800);
        const char = characterTable[state.characterId] || {};
        const profession = PROFESSION_NAMES[char.profession] || '未分类';
        const element = ELEMENT_NAMES[char.mainAttrType] || ELEMENT_NAMES[char.subAttrType] || '未知属性';
        drawText(`${profession}  ·  ${element}`, header.x + 375, header.y + 240, 32, '#ffc247');
        verticalLines(state.description, header.x + 375, header.y + 335, header.w - 430, 51, 30);

        const recommendations = layoutRect('vertical', 'recommendations');
        verticalSection(recommendations, '武器推荐');
        state.weapons.forEach((entry, index) => {
            if (!entry.id) return;
            const col = index % 2, row = Math.floor(index / 2);
            const x = recommendations.x + 45 + col * (recommendations.w / 2);
            const y = recommendations.y + 110 + row * 265;
            drawImageContain(images[4 + index], x, y, 165, 165);
            drawText(fitText(entry.name || assetEntryName(entry.id, 'weapon'), 220, 29), x + 180, y + 32, 29, '#fff', 'left', 800);
            verticalLines(entry.note, x + 180, y + 94, 240, 32, 19, '#d6d8db');
        });
        const equipments = layoutRect('vertical', 'equipments');
        verticalSection(equipments, '装备推荐');
        state.equips.forEach((entry, index) => {
            if (!entry.id) return;
            const x = equipments.x + 35 + index % 4 * 218;
            const y = equipments.y + 104 + Math.floor(index / 4) * 270;
            drawImageContain(images[8 + index], x + 20, y, 135, 135);
            drawText(fitText(entry.name || itemName(entry.id), 200, 22), x + 100, y + 165, 22, '#fff', 'center', 700);
            verticalLines(String(entry.note || '').replace(/[,，]/g, '\n'), x + 16, y + 197, 190, 24, 16, '#d6d8db');
        });
        const skillPanel = layoutRect('vertical', 'skills');
        verticalSection(skillPanel, '技能加点');
        skills.forEach((skill, index) => {
            const x = skillPanel.x + 64 + (index % 2) * 445;
            const y = skillPanel.y + 135 + Math.floor(index / 2) * 245;
            drawImageContain(images[index], x, y, 140, 140);
            drawText(state.skills[index]?.name || skill.label, x + 165, y + 43, 30, '#fff', 'left', 800);
            drawText(`RANK ${state.skills[index]?.rank || '9'}`, x + 165, y + 102, 24, '#ffc247');
        });
        verticalLines(state.buildNote, skillPanel.x + 75, skillPanel.y + 750, skillPanel.w - 150, 43, 25);
        const rotation = layoutRect('vertical', 'rotation');
        verticalSection(rotation, '推荐手法');
        verticalLines(state.rotationNote, rotation.x + 68, rotation.y + 130, rotation.w - 136, 53, 28);

        const potential = layoutRect('vertical', 'potential');
        verticalSection(potential, '潜能收益');
        drawBarChart(potential.x + 110, potential.y + 125, potential.w - 220, potential.h - 290);
        verticalLines(state.potentialNote, potential.x + 95, potential.y + potential.h - 100, potential.w - 190, 37, 24, '#ffc247');
        const comparison = layoutRect('vertical', 'comparison');
        verticalSection(comparison, '配置分析');
        drawText(state.ratioTitle, comparison.x + 85, comparison.y + 180, 38, '#fff', 'left', 800);
        drawDonut(comparison.x + comparison.w * .31, comparison.y + 510, 235, state.ratio);
        drawText(state.damageTitle, comparison.x + 85, comparison.y + 1060, 38, '#fff', 'left', 800);
        drawDonut(comparison.x + comparison.w * .31, comparison.y + 1400, 235, state.damage);
        const team = layoutRect('vertical', 'team');
        verticalSection(team, '队伍搭配');
        state.team.forEach((id, index) => {
            if (!id) return;
            const x = team.x + 40 + index * (team.w / 4);
            drawImageContain(images[16 + index], x + 35, team.y + 130, 220, 220);
            drawText(characterName(id, characterTable[id]), x + 150, team.y + 420, 29, '#fff', 'center', 800);
        });
        verticalLines(state.teamNote, team.x + 65, team.y + team.h - 150, team.w - 130, 45, 25);
        dimensions.textContent = `${W} × ${H}`;
    }

    function layoutModules() {
        return layoutModulesForMode(state.mode);
    }

    function updateLayoutOverlay() {
        const overlay = $('#guideImageLayoutOverlay');
        if (!overlay) return;
        overlay.hidden = !state.layoutMode;
        overlay.replaceChildren();
        if (!state.layoutMode) return;
        const size = layoutSize(state.mode);
        layoutModules().forEach(module => {
            const rect = layoutRect(state.mode, module.id);
            const element = document.createElement('div');
            element.className = 'guide-image-layout-module';
            element.dataset.layoutId = module.id;
            element.style.left = `${rect.x / size.width * 100}%`;
            element.style.top = `${rect.y / size.height * 100}%`;
            element.style.width = `${rect.w / size.width * 100}%`;
            element.style.height = `${rect.h / size.height * 100}%`;
            const label = document.createElement('span');
            label.className = 'guide-image-layout-label';
            label.textContent = module.label;
            const handle = document.createElement('span');
            handle.className = 'guide-image-layout-handle';
            element.append(label, handle);
            element.addEventListener('pointerdown', event => startLayoutDrag(event, module.id, 'move'));
            handle.addEventListener('pointerdown', event => {
                event.stopPropagation();
                startLayoutDrag(event, module.id, 'resize');
            });
            overlay.append(element);
        });
    }

    let layoutDrag = null;
    function startLayoutDrag(event, id, mode) {
        if (!state.layoutMode) return;
        event.preventDefault();
        const rect = layoutRect(state.mode, id);
        layoutDrag = { id, mode, startX: event.clientX, startY: event.clientY, original: { ...rect }, size: layoutSize(state.mode) };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.style.userSelect = 'none';
    }

    function moveLayoutDrag(event) {
        if (!layoutDrag) return;
        const preview = $('.guide-image-preview-wrap');
        const bounds = preview.getBoundingClientRect();
        const scaleX = layoutDrag.size.width / bounds.width;
        const scaleY = layoutDrag.size.height / bounds.height;
        const dx = (event.clientX - layoutDrag.startX) * scaleX;
        const dy = (event.clientY - layoutDrag.startY) * scaleY;
        const original = layoutDrag.original;
        let x = original.x, y = original.y, w = original.w, h = original.h;
        if (layoutDrag.mode === 'move') {
            x = Math.max(0, Math.min(layoutDrag.size.width - w, original.x + dx));
            y = Math.max(0, Math.min(layoutDrag.size.height - h, original.y + dy));
        } else {
            w = Math.max(140, Math.min(layoutDrag.size.width - original.x, original.w + dx));
            h = Math.max(120, Math.min(layoutDrag.size.height - original.y, original.h + dy));
        }
        if (!state.layout[state.mode]) state.layout[state.mode] = {};
        state.layout[state.mode][layoutDrag.id] = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
        void render();
    }

    function finishLayoutDrag() {
        if (!layoutDrag) return;
        layoutDrag = null;
        document.body.style.userSelect = '';
        renderLayoutFields();
        updateLayoutOverlay();
    }

    let renderToken = 0;
    async function render() {
        const token = ++renderToken;
        if (disposed || !ctx) return;
        setStatus('正在生成预览…', 'loading');
        try {
            if (state.mode === 'vertical') await renderVertical(); else await renderHorizontal();
            // During a pointer drag the reference project keeps the same overlay
            // nodes alive. Replacing them here loses pointer capture and makes
            // the module appear to stop dragging after the first frame.
            if (!layoutDrag) updateLayoutOverlay();
            if (token === renderToken) setStatus('预览已更新', '');
        } catch (error) {
            if (token === renderToken) setStatus(`生成失败：${error.message}`, 'error');
        }
    }

    function bindBaseControls() {
        $('#guideImageMode').addEventListener('change', event => { state.mode = event.target.value; renderDynamicControls(); render(); });
        $('#guideImageLayoutToggle').addEventListener('click', event => {
            state.layoutMode = !state.layoutMode;
            event.currentTarget.textContent = state.layoutMode ? '退出布局模式' : '布局模式';
            updateLayoutOverlay();
        });
        $('#guideImageLayoutReset').addEventListener('click', () => {
            state.layout[state.mode] = {};
            renderLayoutFields();
            void render();
        });
        context.on(document, 'pointermove', moveLayoutDrag);
        context.on(document, 'pointerup', finishLayoutDrag);
        context.on(document, 'pointercancel', finishLayoutDrag);
        $('#guideImageTitle').addEventListener('input', event => { state.title = event.target.value; render(); });
        $('#guideImageBackground').addEventListener('input', event => { state.background = event.target.value; render(); });
        $('#guideImageCharacter').addEventListener('change', event => selectCharacter(event.target.value));
        $('#guideImageCharacterName').addEventListener('input', event => { state.characterName = event.target.value; render(); });
        $('#guideImageDescription').addEventListener('input', event => { state.description = event.target.value; render(); });
        $('#guideImageBuildNote').addEventListener('input', event => { state.buildNote = event.target.value; render(); });
        $('#guideImageRotationNote').addEventListener('input', event => { state.rotationNote = event.target.value; render(); });
        $('#guideImageRatioTitle').addEventListener('input', event => { state.ratioTitle = event.target.value; render(); });
        $('#guideImageDamageTitle').addEventListener('input', event => { state.damageTitle = event.target.value; render(); });
        $('#guideImagePotentialLabels').addEventListener('input', event => { state.potentialLabels = event.target.value; render(); });
        $('#guideImagePotentialValues').addEventListener('input', event => { state.potentialValues = event.target.value; render(); });
        $('#guideImagePotentialNote').addEventListener('input', event => { state.potentialNote = event.target.value; render(); });
        $('#guideImageTeamNote').addEventListener('input', event => { state.teamNote = event.target.value; render(); });
        $('#guideImageRatio').addEventListener('input', event => { state.ratio = event.target.value; render(); });
        $('#guideImageDamage').addEventListener('input', event => { state.damage = event.target.value; render(); });
        $('#guideImageExport').addEventListener('click', exportPng);
        $('#guideImageSave').addEventListener('click', saveConfig);
        $('#guideImageLoad').addEventListener('click', () => $('#guideImageConfigInput').click());
        $('#guideImageConfigInput').addEventListener('change', loadConfig);
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function safeName(value) { return String(value || 'guide').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80); }

    async function exportPng() {
        try {
            await render();
            if (status.dataset.state === 'error') throw new Error(status.textContent);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('浏览器未生成 PNG 数据');
            downloadBlob(blob, `${safeName(state.characterName || state.title || '兔头攻略')}-${state.mode}.png`);
            setStatus('PNG 已导出', '');
        } catch (error) {
            setStatus(`PNG 导出失败：${error.message}`, 'error');
        }
    }

    function saveConfig() {
        downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${safeName(state.characterName || 'guide')}-攻略图配置.json`);
    }

    function loadConfig(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                state = { ...state, ...parsed };
                renderCharacterOptions();
                renderDynamicControls();
                syncBaseControls();
                render();
            } catch (error) { setStatus(`配置导入失败：${error.message}`, 'error'); }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    let context;
    async function initialize(scopeContext) {
        context = {
            ...scopeContext,
            dataResourceUrl: path => window.akeDataSource?.resolveUrl?.(path) || path
        };
        setStatus('正在读取 TableCfg…', 'loading');
        const [chars, growth, skills, items, weapons, equips, attributeFilters, attributeShows] = await Promise.all([
            context.table('CharacterTable'), context.table('CharGrowthTable'), context.table('SkillPatchTable'),
            context.table('ItemTable'), context.table('WeaponBasicTable'), context.table('EquipTable'),
            context.table('AttributeFilterTable'), context.table('AttributeShowConfigTable')
        ]);
        if (context.signal.aborted) return {};
        characterTable = chars || {}; growthTable = growth || {}; skillPatchTable = skills || {};
        itemTable = items || {}; weaponTable = weapons || {}; equipTable = equips || {};
        buildAttributeNames(attributeFilters, attributeShows);
        state.weapons.forEach(entry => { if (entry.id && !entry.name && !entry.note) syncAutoEntry(entry, 'weapon'); });
        state.equips.forEach(entry => { if (entry.id && !entry.name && !entry.note) syncAutoEntry(entry, 'equip'); });
        characters = Object.entries(characterTable).map(([id, row]) => ({ id, name: characterName(id, row), order: Number(row.sortOrder || 9999) }))
            .filter(row => growthTable[row.id]).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        if (!characters.length) throw new Error('没有可用干员数据');
        state.characterId = characters.some(row => row.id === state.characterId) ? state.characterId : characters[0].id;
        if (!state.characterName) state.characterName = characterName(state.characterId, characterTable[state.characterId]);
        renderCharacterOptions();
        bindBaseControls();
        renderDynamicControls();
        syncBaseControls();
        await render();
        return {
            destroy() { disposed = true; imageCache.clear(); referenceImages.clear(); canvas.width = 0; canvas.height = 0; }
        };
    }

    window.AKEMisc?.register?.(MODULE_ID, initialize);
})();
