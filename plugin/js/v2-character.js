(function() {
        const t = window.akeI18n.scope('modules.character');
        const commonT = window.akeI18n.scope('common');
        let allCharacters = [];
        let rawAllCharacters = [];
        let activeCharId = null;
        let isInitialized = false;
        let attrMap = {};
        let attrEnMap = {};
        let paramTypeMap = {};
        let modifierTypeMap = {};
        let charTypeMap = {};
        let weaponMap = {};
        let professionMap = {};
        let roomTypeMap = {};
        let searchTerm = '';
        let currentCharacter = null;
        let currentCharData = null;
        let charLevelsToShow = null;
        let skillLevelsToShow = null;
        let globalSkillExpand = false;
        let skillExpandMap = {};
        let showAllCharLevels = false;

        // 筛选状态
        let selectedRarities = new Set();
        let selectedCharTypes = new Set();
        let selectedProfessions = new Set();
        let selectedWeaponTypes = new Set();

        const CHARACTER_META_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/elementicon/';
        const CHARACTER_PROFESSION_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charprofessionicon/';
        const CHARACTER_WEAPON_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/wiki/groupicon/';
        const CHARACTER_PORTRAIT_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charicon/';
        const CHARACTER_SKILL_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/';
        const ITEM_ICON_BASE = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/';
        const CHAR_TYPE_ICON_MAP = {
            Physical: 'physical', Fire: 'fire', Pulse: 'pulse', Cryst: 'cold', Natural: 'nature'
        };
        const PROFESSION_ICON_MAP = {
            0: '0', 2: '2', 4: '4', 5: '5', 7: '7', 8: '8',
            GUARD: '0', DEFENDER: '2', SUPPORTER: '4', CASTER: '5', VANGUARD: '7', ASSAULT: '8'
        };
        const WEAPON_ICON_MAP = {
            1: 'sword', 2: 'wand', 3: 'claymores', 5: 'lance', 6: 'pistol',
            Sword: 'sword', Wand: 'wand', Claymores: 'claymores', Lance: 'lance', Pistol: 'pistol'
        };

        const IMAGE_BASE_PATH = '/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/bufficon/';
        const COLUMN_KEY_MAP = {
            'coolDown': 'columns.coolDown',
            'costValue': 'columns.costValue',
        };
        const ALWAYS_SHOW_COLS = ['coolDown', 'costValue'];
        function isAlwaysShowColumn(column) {
            return ALWAYS_SHOW_COLS.includes(column) || column.startsWith('coolDown:');
        }
        function isZeroSuppressedSkillField(field) {
            const normalized = String(field || '').trim().toLowerCase();
            return normalized === 'cooldown'
                || normalized.startsWith('cooldown:')
                || normalized === 'costvalue'
                || /(^|_)atb(?:_|\d|$)/.test(normalized)
                || /(^|_)usp(?:_|\d|$)/.test(normalized);
        }
        function hasOnlyZeroNumericValues(values) {
            let foundNumber = false;
            for (const value of values || []) {
                if (value === '' || value === null || value === undefined) continue;
                const number = Number(value);
                if (!Number.isFinite(number)) return false;
                foundNumber = true;
                if (number !== 0) return false;
            }
            return foundNumber;
        }
        function hiddenFieldTranslation(field) {
            const terms = window.akeI18n?.getValue?.('modules.character.hiddenFieldTerms', null);
            if (!terms || typeof terms !== 'object' || Array.isArray(terms)) return '';
            let translatedTerms = 0;
            const translation = String(field || '').trim().toLowerCase()
                .split('_')
                .filter(Boolean)
                .flatMap(term => term.match(/\d+|[^\d]+/g) || [])
                .map(term => {
                    const translated = terms[term];
                    if (typeof translated !== 'string' || !translated) return term;
                    translatedTerms++;
                    return translated;
                })
                .join('');
            return translatedTerms ? translation : '';
        }
        const GROWTH_ATTRIBUTES = [
            { id: 'strength', key: 'attributes.strength' },
            { id: 'agility', key: 'attributes.agility' },
            { id: 'intellect', key: 'attributes.intellect' },
            { id: 'will', key: 'attributes.will' },
            { id: 'hp', key: 'attributes.hp' },
            { id: 'attack', key: 'attributes.attack' },
            { id: 'defense', key: 'attributes.defense' },
            { id: 'artsInflictionDamageMultiplier', key: 'attributes.artsInflictionDamageMultiplier', precise: true },
            { id: 'physicalInflictionDamageMultiplier', key: 'attributes.physicalInflictionDamageMultiplier', precise: true }
        ];
        const GROWTH_ATTR_TYPE_TO_ID = Object.freeze({
            39: 'strength',
            40: 'agility',
            41: 'intellect',
            42: 'will',
            1: 'hp',
            2: 'attack',
            3: 'defense',
            49: 'artsInflictionDamageMultiplier',
            25: 'physicalInflictionDamageMultiplier'
        });
        const SKILL_GROUP_ORDER = { 0: 0, 1: 1, 2: 3, 3: 2 };
        const HIDDEN_KEYWORDS = ['atb', 'scale', 'usp', 'duration', 'poise', '_', 'count', 'layer', 'prob'];

        function getCurrentShowHidden() {
            return window.akeData?.getConfig().showHidden ?? false;
        }

        function parseText(text) {
            const normalized = typeof text === 'string' ? text.replace(/\\r\\n|\\n|\\r/g, '\n') : text;
            return window.parseText(normalized, IMAGE_BASE_PATH);
        }

        function getText(value) {
            if (typeof value === 'string') return value;
            return typeof value?.text === 'string' ? value.text : '';
        }

        function voiceButtonHtml(voId) {
            return window.AKEVoicePlayer?.buttonHtml(voId, {
                play: t('audio.play', null, '播放语音'),
                pause: t('audio.pause', null, '暂停语音'),
                error: t('audio.error', null, '语音播放失败')
            }) || '';
        }

        function parseLevelInput(input, maxLevel = 90) {
            if (!input || input.trim() === '') return [];
            const parts = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLevel);
            return parts.length ? parts : [maxLevel];
        }

        function formatPlaceholderValue(value, format) {
            const formatMatch = String(format || '').match(/^0(?:\.(0+))?(%)?$/);
            if (!formatMatch) return String(value);

            const precision = formatMatch[1]?.length || 0;
            const formattedValue = formatMatch[2] ? value * 100 : value;
            return formattedValue.toFixed(precision) + (formatMatch[2] || '');
        }

        function removeDynamicFloorSegments(text) {
            return String(text || '').replace(/[（(][^（）()]*\{floor:[^{}]+\}[^（）()]*[）)]/gi, '');
        }

        function replacePlaceholders(desc, valueMap, modifierTypes, showModTag) {
            const normalizePlaceholderValue = value => {
                if (!value || typeof value !== 'object') return value;
                for (const key of ['value', 'valueFloat', 'valueDouble', 'valueInt', 'floatValue', 'paramValue', 'attrValue']) {
                    if (value[key] !== undefined && value[key] !== value) return normalizePlaceholderValue(value[key]);
                }
                return value;
            };
            const lowerValueMap = {};
            for (const [key, val] of Object.entries(valueMap || {})) {
                lowerValueMap[String(key).toLowerCase()] = normalizePlaceholderValue(val);
            }
            const lowerModTypes = {};
            if (modifierTypes) {
                for (const [key, val] of Object.entries(modifierTypes)) {
                    lowerModTypes[String(key).toLowerCase()] = val;
                }
            }
            return removeDynamicFloorSegments(desc).replace(/\{([^}]+)\}/g, (match, p1) => {
                const parts = p1.split(':');
                const expr = parts[0].replace(/\s+/g, '');
                const format = parts[1] ? parts[1].trim() : '';
                const varNames = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                const missingVar = varNames.find(name => !(name.toLowerCase() in lowerValueMap));
                if (missingVar) return match;
                let evalExpr = expr;
                for (const name of varNames) {
                    const value = lowerValueMap[name.toLowerCase()];
                    const regex = new RegExp(`\\b${name}\\b`, 'g');
                    evalExpr = evalExpr.replace(regex, `(${value})`);
                }
                let result;
                try {
                    result = new Function('return ' + evalExpr)();
                } catch (e) {
                    return match;
                }
                let formatted = formatPlaceholderValue(result, format);
                if (showModTag && lowerModTypes) {
                    const matchedModType = varNames.map(name => lowerModTypes[name.toLowerCase()]).find(v => v != null);
                    if (matchedModType != null) {
                        const modName = modifierTypeMap[String(matchedModType)] || '';
                        if (modName) formatted += ` <span class="attr-node-modifier-tag">${modName}</span>`;
                    }
                }
                const bindings = Object.fromEntries(varNames.map(name => [name, lowerValueMap[name.toLowerCase()]]));
                const changed = !(varNames.length === 1 && expr.toLowerCase() === varNames[0].toLowerCase());
                const rawValue = varNames.length === 1 ? bindings[varNames[0]] : Object.entries(bindings).map(([key, value]) => `${key}=${value}`).join(', ');
                return window.renderRawValueTip ? window.renderRawValueTip(formatted, {
                    rawValue, value: result, changed, expression: expr,
                    formula: changed ? `${evalExpr} = ${result}` : undefined,
                    bindings
                }) : formatted;
            });
        }

        async function loadMaps() {
            try {
                const data = await window.akeLoadMaps();
                attrMap = data.ATTR_MAP || {};
                attrEnMap = data.ATTR_MAP_EN || {};
                paramTypeMap = data.param_type_map || {};
                modifierTypeMap = data.MODIFIER_TYPE_MAP || {};
                charTypeMap = data.char_type_map || {};
                weaponMap = data.weapon_map || {};
                professionMap = data.profession_map || {};
                roomTypeMap = data.room_type_map || {};
            } catch (err) {
                console.error('加载映射数据失败:', err);
                attrMap = {};
                attrEnMap = {};
                paramTypeMap = {};
                charTypeMap = {};
                weaponMap = {};
                professionMap = {};
                roomTypeMap = {};
            }
        }

        function getAttrName(attrType) {
            return attrMap[attrType] || t('attributeFallback', { name: attrType });
        }

        function getCharTypeName(charType) {
            return charTypeMap[charType] || charType;
        }

        function getWeaponName(weapon) {
            return weaponMap[weapon] || weapon;
        }

        function getProfessionName(prof) {
            return professionMap[prof] || prof;
        }

        function findMapKey(map, value) {
            if (value === undefined || value === null || value === '') return '';
            const directKey = String(value);
            if (Object.prototype.hasOwnProperty.call(map, directKey)) return directKey;
            return Object.keys(map).find(key => map[key] === value) || directKey;
        }

        function getCharacterMetaIcons(character) {
            const charTypeId = character.charTypeId || findMapKey(charTypeMap, character.charType);
            const professionId = character.professionId ?? findMapKey(professionMap, character.profession);
            const weaponTypeId = character.weaponTypeId ?? findMapKey(weaponMap, character.weapontype);
            const charTypeIcon = CHAR_TYPE_ICON_MAP[charTypeId];
            const professionIcon = PROFESSION_ICON_MAP[professionId];
            const weaponIcon = WEAPON_ICON_MAP[weaponTypeId];
            const icons = [];
            if (charTypeIcon) {
                icons.push({
                    src: `${CHARACTER_META_ICON_BASE}icon_charattrtype_${charTypeIcon}.png`,
                    label: character.charType || getCharTypeName(charTypeId) || charTypeId,
                    kind: `element-${charTypeIcon}`,
                    tooltip: false
                });
            }
            if (professionIcon) {
                icons.push({
                    src: `${CHARACTER_PROFESSION_ICON_BASE}icon_profession_${professionIcon}.png`,
                    label: character.profession || getProfessionName(professionId) || professionId,
                    kind: 'profession',
                    tooltip: false
                });
            }
            if (weaponIcon) {
                icons.push({
                    src: `${CHARACTER_WEAPON_ICON_BASE}icon_wiki_group_weapon_${weaponIcon}.png`,
                    label: character.weapontype || getWeaponName(weaponTypeId) || weaponTypeId,
                    kind: 'weapon',
                    tooltip: false
                });
            }
            return icons;
        }

        function createCharacterDirectoryItem(character, options = {}) {
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: character.name,
                id: character.charId,
                icon: { src: character.icon || '', alt: '' },
                meta: getCharacterMetaIcons(character),
                accent: { type: 'rarity', value: character.rarity || 1 },
                active: options.active,
                attributes: {
                    'data-char-id': character.charId,
                    'data-content-file': character.contentFile
                },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, character);
            return item;
        }

        function filterCharacters(chars) {
            return chars.filter(c => {
                // 搜索过滤
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const nameMatch = c.name && c.name.toLowerCase().includes(term);
                    const idMatch = c.charId && c.charId.toLowerCase().includes(term);
                    if (!nameMatch && !idMatch) return false;
                }
                // 稀有度筛选
                if (selectedRarities.size > 0 && !selectedRarities.has(c.rarity)) return false;
                // 属性筛选
                if (selectedCharTypes.size > 0 && !selectedCharTypes.has(c.charType)) return false;
                // 职业筛选
                if (selectedProfessions.size > 0 && !selectedProfessions.has(c.profession)) return false;
                // 武器类型筛选
                if (selectedWeaponTypes.size > 0 && !selectedWeaponTypes.has(c.weapontype)) return false;
                return true;
            });
        }

        // 生成筛选按钮
        function generateFilterButtons() {
            const filterPanel = document.getElementById('v2charFilterBar');
            const rarityContainer = document.getElementById('v2charRarityFilter');
            const typeContainer = document.getElementById('v2charTypeFilter');
            const profContainer = document.getElementById('v2charProfessionFilter');
            const weaponContainer = document.getElementById('v2charWeaponFilter');
            if (!rarityContainer || !typeContainer || !profContainer || !weaponContainer) return;

            const updateFilterSummary = () => {
                const count = selectedRarities.size + selectedCharTypes.size
                    + selectedProfessions.size + selectedWeaponTypes.size;
                window.AKEUI?.updateFilterPanel(filterPanel, {
                    summary: count ? commonT('filterCount', { count }) : commonT('filter')
                });
            };

            // 稀有度按钮
            const existingRarities = new Set(allCharacters.map(c => c.rarity));
            rarityContainer.innerHTML = '';
            for (let r = 1; r <= 6; r++) {
                if (existingRarities.has(r)) {
                    const btn = window.AKEUI.filterButton({
                        label: t('rarityStars', { name: r }),
                        pressed: selectedRarities.has(r),
                        attributes: { 'data-rarity': r },
                        onChange: pressed => {
                            pressed ? selectedRarities.add(r) : selectedRarities.delete(r);
                            updateFilterSummary();
                            renderCharacterList();
                        }
                    });
                    rarityContainer.appendChild(btn);
                }
            }

            // 属性按钮
            const existingTypes = new Set(allCharacters.map(c => c.charType).filter(t => t));
            typeContainer.innerHTML = '';
            existingTypes.forEach(type => {
                const tName = getCharTypeName(type) || type;
                const btn = window.AKEUI.filterButton({
                    label: tName,
                    pressed: selectedCharTypes.has(type),
                    attributes: { 'data-type': type },
                    onChange: pressed => {
                        pressed ? selectedCharTypes.add(type) : selectedCharTypes.delete(type);
                        updateFilterSummary();
                        renderCharacterList();
                    }
                });
                typeContainer.appendChild(btn);
            });

            // 职业按钮
            const existingProfessions = new Set(allCharacters.map(c => c.profession).filter(p => p));
            profContainer.innerHTML = '';
            existingProfessions.forEach(prof => {
                const pName = getProfessionName(prof) || prof;
                const btn = window.AKEUI.filterButton({
                    label: pName,
                    pressed: selectedProfessions.has(prof),
                    attributes: { 'data-profession': prof },
                    onChange: pressed => {
                        pressed ? selectedProfessions.add(prof) : selectedProfessions.delete(prof);
                        updateFilterSummary();
                        renderCharacterList();
                    }
                });
                profContainer.appendChild(btn);
            });

            // 武器类型按钮
            const existingWeapons = new Set(allCharacters.map(c => c.weapontype).filter(w => w));
            weaponContainer.innerHTML = '';
            existingWeapons.forEach(weapon => {
                const wName = getWeaponName(weapon) || weapon;
                const btn = window.AKEUI.filterButton({
                    label: wName,
                    pressed: selectedWeaponTypes.has(weapon),
                    attributes: { 'data-weapon': weapon },
                    onChange: pressed => {
                        pressed ? selectedWeaponTypes.add(weapon) : selectedWeaponTypes.delete(weapon);
                        updateFilterSummary();
                        renderCharacterList();
                    }
                });
                weaponContainer.appendChild(btn);
            });
            updateFilterSummary();
        }

        const mobileBtn = document.getElementById('v2charMobileListBtn');
        const mobileOverlay = document.getElementById('v2charMobileListOverlay');
        const mobileContent = document.getElementById('v2charMobileListContent');

        function buildMobileList() {
            const filtered = filterCharacters(allCharacters);
            mobileContent.innerHTML = '';
            filtered.forEach(char => {
                const item = createCharacterDirectoryItem(char, {
                    active: char.charId === activeCharId,
                    onSelect: () => {
                        activeCharId = char.charId;
                        loadCharacterDetail(char, document.getElementById('v2characterDetail'));
                        closeMobileList();
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_character', char.charId);
                        const desktopList = document.getElementById('v2characterList');
                        const activeItem = desktopList?.querySelector(`.ake-ui-directory__item[data-char-id="${CSS.escape(char.charId)}"]`);
                        if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                    }
                });
                mobileContent.appendChild(item);
            });
        }

        function openMobileList() {
            buildMobileList();
            mobileOverlay.classList.add('is-open'); mobileOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeMobileList() {
            mobileOverlay.classList.remove('is-open'); mobileOverlay.setAttribute('aria-hidden', 'true');
        }

        async function loadCharacterManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/v2_character/manifest.json');
                if (!res.ok) throw new Error('无法加载角色清单');
                const allChars = await res.json();
                rawAllCharacters = allChars;
                let chars = showHidden ? allChars : allChars.filter(c => !c.hidden);
                chars.sort((a, b) => (a.priority || 999) - (b.priority || 999));
                return chars;
            } catch (err) {
                console.error('加载角色清单失败:', err);
                return [];
            }
        }

        function renderCharacterOverview(items, container) {
            window.AKEVoicePlayer?.stop();
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                variant: 'character',
                group: char => ({ id: char.profession || 'unknown', name: char.profession || t('unknownProfession') }),
                onReset: () => { activeCharId = null; },
                onSelect: char => { activeCharId = char.charId; renderCharacterList(); },
                sidebarSelector: char => `.ake-ui-directory__item[data-char-id="${CSS.escape(char.charId)}"]`,
                items: items.map(char => ({ ...char, id: char.charId,
                    image: `${CHARACTER_PORTRAIT_BASE}icon_${encodeURIComponent(char.charId)}.png`, imageFallback: char.icon,
                    fallback: t('overview.fallback'),
                    icons: getCharacterMetaIcons(char) }))
            });
        }

        function renderCharacterList() {
            const container = document.getElementById('v2characterList');
            const detailContainer = document.getElementById('v2characterDetail');
            if (!container) return;

            const filtered = filterCharacters(allCharacters);

            container.innerHTML = '';
            if (filtered.length === 0) {
                window.AKEVoicePlayer?.stop();
                container.innerHTML = `<div class="ake-ui-state">${t('noMatches')}</div>`;
                if (detailContainer) detailContainer.innerHTML = `<div class="ake-ui-state">${t('select')}</div>`;
                activeCharId = null;
                return;
            }

            filtered.forEach((char, index) => {
                const item = createCharacterDirectoryItem(char, {
                    active: char.charId === activeCharId
                        || (index === 0 && !activeCharId && !window.AKEModuleOverview?.isActive('character')),
                    onSelect: () => {
                        window.AKEUI.setDirectoryItemActive(container, item);
                        activeCharId = char.charId;
                        loadCharacterDetail(char, detailContainer);
                        if (window.__akeRouter) window.__akeRouter.updateUrl('v2_character', char.charId);
                    }
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepChar = filtered.find(c => c.charId === window.__deepLinkId);
                if (deepChar) {
                    activeCharId = deepChar.charId;
                } else {
                    const existsInRaw = rawAllCharacters.some(c => c.charId === window.__deepLinkId);
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(c => c.charId === activeCharId);
            if (!activeExists && filtered.length > 0) {
                if (window.AKEModuleOverview?.isActive('character')) {
                    activeCharId = null;
                    renderCharacterOverview(filtered, detailContainer);
                    return;
                }
                activeCharId = filtered[0].charId;
                const firstItem = container.querySelector('.ake-ui-directory__item');
                if (firstItem) window.AKEUI.setDirectoryItemActive(container, firstItem);
                loadCharacterDetail(filtered[0], detailContainer);
                if (window.__akeRouter) window.__akeRouter.updateUrl('v2_character', filtered[0].charId);
            } else if (activeExists) {
                const activeChar = filtered.find(c => c.charId === activeCharId);
                if (activeChar) {
                    const activeItem = container.querySelector(`.ake-ui-directory__item[data-char-id="${activeCharId}"]`);
                    if (activeItem) window.AKEUI.setDirectoryItemActive(container, activeItem);
                    loadCharacterDetail(activeChar, detailContainer);
                    if (window.__akeRouter) window.__akeRouter.updateUrl('v2_character', activeCharId);
                }
            }
        }

        async function loadCharacterDetail(character, container) {
            window.AKEVoicePlayer?.stop();
            container.__akeCharacterDetailNavCleanup?.();
            container.innerHTML = `<div class="ake-ui-state" data-state="loading">${t('loading')}</div>`;
            try {
                const fileName = (character.contentFile || '').split('/').pop() || `${character.charId}.json`;
                const contentFile = `/public/CH/v2_character/${fileName}`;
                const rawData = await (window.akeFetch || fetch)(contentFile).then(r => r.json());
                const data = normalizeV2ToLegacy(character, rawData);
                currentCharData = data;
                currentCharacter = character;
                container.innerHTML = renderDetail(data);
                const baselineData = rawData.__versionDiff?.baseline
                    ? normalizeV2ToLegacy(character, rawData.__versionDiff.baseline)
                    : null;
                window.AKEModuleOverview?.renderVersionDiff(container, rawData, baselineData ? renderDetail(baselineData) : '');
                initCharacterDetailNav(container);

                const globalSkillBtn = container.querySelector('.global-skill-toggle-btn');
                if (globalSkillBtn) {
                    globalSkillBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        globalSkillExpand = !globalSkillExpand;
                        if (globalSkillExpand) skillExpandMap = {};
                        window.AKEUI.setDisclosureButtonExpanded(globalSkillBtn, globalSkillExpand);
                        updateAllSkillTables();
                    });
                }

                const skillToggleBtns = container.querySelectorAll('.skill-toggle-btn');
                skillToggleBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const skillKey = btn.dataset.skillKey;
                        if (!skillKey) return;
                        const wasGlobalExpanded = globalSkillExpand;
                        if (globalSkillExpand) globalSkillExpand = false;
                        skillExpandMap[skillKey] = !skillExpandMap[skillKey];
                        window.AKEUI.setDisclosureButtonExpanded(globalSkillBtn, false);
                        if (wasGlobalExpanded) updateAllSkillTables();
                        else updateSkillTable(skillKey);
                    });
                });

                const toggleCharBtn = container.querySelector('.toggle-char-levels-btn');
                if (toggleCharBtn) {
                    toggleCharBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        showAllCharLevels = !showAllCharLevels;
                        updateGrowthTable();
                    });
                }

                container.querySelectorAll('.collapsible-section > .ake-ui-section__header').forEach(header => {
                    header.addEventListener('click', () => {
                        const toggle = header.querySelector('.character-collapse-toggle');
                        const content = header.nextElementSibling;
                        if (content && content.classList.contains('collapse-content')) {
                            const isOpen = header.parentElement.classList.toggle('is-open');
                            toggle?.setAttribute('aria-expanded', String(isOpen));
                        }
                    });
                });
            } catch (err) {
                const error = document.createElement('div');
                error.className = 'ake-ui-state';
                error.dataset.state = 'error';
                error.textContent = t('loadFailed', { name: err.message });
                container.replaceChildren(error);
            }
        }

        function initCharacterDetailNav(container) {
            container.__akeCharacterDetailNavCleanup?.();

            const detail = container.querySelector(':scope > .ake-ui-detail[data-detail-kind="character"]');
            const nav = detail?.querySelector(':scope > .character-detail-nav');
            if (!detail || !nav) return;

            const entries = Array.from(nav.querySelectorAll('a[href^="#"]'))
                .map(link => ({ link, target: detail.querySelector(link.getAttribute('href')) }))
                .filter(entry => entry.target);
            if (!entries.length) return;

            let animationFrame = 0;
            const setActive = activeLink => {
                entries.forEach(({ link }) => {
                    const isActive = link === activeLink;
                    link.classList.toggle('is-active', isActive);
                    if (isActive) link.setAttribute('aria-current', 'location');
                    else link.removeAttribute('aria-current');
                });
            };
            const updateActive = () => {
                animationFrame = 0;
                const activationLine = container.getBoundingClientRect().top + nav.offsetHeight + 16;
                let activeEntry = entries[0];

                entries.forEach(entry => {
                    if (entry.target.getBoundingClientRect().top <= activationLine) activeEntry = entry;
                });
                if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
                    activeEntry = entries[entries.length - 1];
                }
                setActive(activeEntry.link);
            };
            const scheduleUpdate = () => {
                if (!animationFrame) animationFrame = requestAnimationFrame(updateActive);
            };
            const clickHandlers = entries.map(({ link }) => {
                const handleClick = () => setActive(link);
                link.addEventListener('click', handleClick);
                return { link, handleClick };
            });

            container.addEventListener('scroll', scheduleUpdate, { passive: true });
            window.addEventListener('resize', scheduleUpdate);
            container.__akeCharacterDetailNavCleanup = () => {
                container.removeEventListener('scroll', scheduleUpdate);
                window.removeEventListener('resize', scheduleUpdate);
                clickHandlers.forEach(({ link, handleClick }) => link.removeEventListener('click', handleClick));
                if (animationFrame) cancelAnimationFrame(animationFrame);
                delete container.__akeCharacterDetailNavCleanup;
            };
            updateActive();
        }

        function normalizeV2ToLegacy(baseInfo, rawData) {
            const legacy = {
                charId: baseInfo.charId,
                icon: baseInfo.icon || '',
                pic: rawData.pic || `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/characterportrait/${baseInfo.charId}.png`,
                potentialpics: [],
                name: baseInfo.name || rawData.name || '',
                rarity: baseInfo.rarity,
                charType: baseInfo.charType,
                profession: baseInfo.profession,
                weapontype: baseInfo.weapontype,
                weaponTypeId: baseInfo.weaponTypeId,
                mainAttrType: getAttrName(rawData.charactertable?.mainAttrType) || baseInfo.mainAttrType || '-',
                subAttrType: getAttrName(rawData.chargrowthtable?.subAttrType) || baseInfo.subAttrType || '-',
                charBattleTag: rawData.chargrowthtable?.charBattleTag || baseInfo.charBattleTag || [],
                profile: rawData.itemtable?.desc?.text || baseInfo.profile || '',
                feature: rawData.charprofessiontable?.desc?.text || baseInfo.feature || '',
                cvName: (function() {
                    const cv = rawData.charactertable?.cvName;
                    if (!cv) return baseInfo.cvName || [];
                    const names = [];
                    if (cv.ChiCVName?.text) names.push(cv.ChiCVName.text);
                    if (cv.JapCVName?.text) names.push(cv.JapCVName.text);
                    if (cv.EngCVName?.text) names.push(cv.EngCVName.text);
                    if (cv.KorCVName?.text) names.push(cv.KorCVName.text);
                    return names.length ? names : (baseInfo.cvName || []);
                })(),
                growth: {},
                growthDetails: {},
                talents: [],
                potentials: [],
                attributeNodes: [],
                skills: [],
                skill: {},
                spaceshipSkills: [],
                giftStages: [],
                weaponRecommendations: { skillAdaptation: [], attributeAdaptation: [] },
                profileRecord: [],
                profileVoice: []
            };

            const preferredAttrs = GROWTH_ATTRIBUTES.map(attribute => attribute.id);
            preferredAttrs.forEach(id => {
                legacy.growth[id] = [];
            });

            const attributes = rawData.charactertable?.attributes || [];
            const levelMap = {};
            attributes.forEach(levelData => {
                const attrs = levelData?.Attribute?.attrs || [];
                const breakStage = levelData?.breakStage ?? 0;
                const levelEntry = attrs.find(a => a.attrType === 0);
                const level = levelEntry ? levelEntry.attrValue : null;
                if (level == null) return;
                if (!levelMap[level] || breakStage >= levelMap[level].breakStage) {
                    const idValueMap = {};
                    attrs.forEach(a => {
                        const id = GROWTH_ATTR_TYPE_TO_ID[a.attrType];
                        if (id) idValueMap[id] = a.attrValue;
                    });
                    levelMap[level] = { breakStage, idValueMap };
                }
            });
            const sortedLevels = Object.keys(levelMap).map(Number).sort((a, b) => a - b);
            sortedLevels.forEach(level => {
                const idValueMap = levelMap[level].idValueMap;
                preferredAttrs.forEach(id => {
                    const val = idValueMap[id];
                    legacy.growth[id].push(typeof val === 'number' ? val : 0);
                });
            });

            if (sortedLevels.length > 0) {
                legacy.growth.hp = sortedLevels.map(level => Math.round((500 + 5500 / 98 * (level - 1)) * 100) / 100);
                legacy.growthDetails.hp = sortedLevels.map((level, index) => {
                    const rawValue = levelMap[level].idValueMap.hp ?? legacy.growth.hp[index];
                    const value = legacy.growth.hp[index];
                    return {
                        name: 'hp',
                        rawValue,
                        value,
                        changed: value !== rawValue,
                        formula: `(500 + 5500 / 98 × (${level} - 1)) = ${value}`,
                        bindings: { level }
                    };
                });
            }

            legacy.itemInfoMap = Object.fromEntries(Object.entries(rawData.costitemtable || {}).map(([id, item]) => [id, {
                name: getText(item.name) || id,
                description: getText(item.desc),
                iconId: item.iconId || id
            }]));

            const talentNodes = Object.values(rawData.chargrowthtable?.talentNodeMap || {}).filter(n => n.nodeType === 4 && n.passiveSkillNodeInfo?.talentEffectId);
            talentNodes.sort((a, b) => {
                const ai = a.passiveSkillNodeInfo.index ?? 0;
                const bi = b.passiveSkillNodeInfo.index ?? 0;
                if (ai !== bi) return ai - bi;
                return (a.passiveSkillNodeInfo.level ?? 0) - (b.passiveSkillNodeInfo.level ?? 0);
            });
            legacy.talents = talentNodes.map(n => {
                const effect = rawData.potentialtalenteffecttable?.[n.passiveSkillNodeInfo.talentEffectId];
                if (!effect) return null;
                const descRaw = getText(effect.desc);
                const values = {};
                const modifierTypes = {};
                (effect.dataList || []).forEach(item => {
                    (item.attachSkill?.blackboard || []).forEach(bb => {
                        if (bb && bb.key !== undefined) values[bb.key] = bb.value;
                    });
                    (item.attachBuff?.blackboard || []).forEach(bb => {
                        if (bb && bb.key !== undefined) values[bb.key] = bb.value;
                    });
                    if (item.skillBbModifier?.bbKey && item.skillBbModifier.bbKey !== '') {
                        values[item.skillBbModifier.bbKey] = item.skillBbModifier.floatValue;
                    }
                    if (item.skillParamModifier?.paramType && item.skillParamModifier.paramValue) {
                        const ptName = paramTypeMap[item.skillParamModifier.paramType];
                        if (ptName) values[ptName] = item.skillParamModifier.paramValue;
                    }
                    if (item.attrModifier?.attrType && item.attrModifier.attrValue) {
                        const atName = attrEnMap[item.attrModifier.attrType];
                        if (atName) {
                            values[atName] = item.attrModifier.attrValue;
                            if (item.attrModifier.modifierType != null) {
                                modifierTypes[atName] = item.attrModifier.modifierType;
                            }
                        }
                    }
                });
                return {
                    name: n.passiveSkillNodeInfo.name?.text || effect.name?.text || effect.name || t('sections.talents'),
                    description: descRaw,
                    values,
                    modifierTypes,
                    groupIndex: n.passiveSkillNodeInfo.index ?? 0,
                    level: n.passiveSkillNodeInfo.level ?? 0,
                    icon: n.passiveSkillNodeInfo.iconId
                        ? `${CHARACTER_SKILL_ICON_BASE}${n.passiveSkillNodeInfo.iconId}.png`
                        : '',
                    requiredItem: n.requiredItem || []
                };
            }).filter(Boolean);

            const potentials = rawData.characterpotentialtable?.potentialUnlockBundle || [];
            legacy.potentials = potentials.map(p => {
                const effId = p.potentialEffectId;
                let effect = rawData.potentialtalenteffecttable?.[effId];
                let desc = getText(effect?.desc);
                let dataList = effect?.dataList || [];
                if (!desc) {
                    const patch = rawData.skillpatchtable?.[effId]?.SkillPatchDataBundle?.[0];
                    desc = patch?.description?.text || '';
                    if (patch?.blackboard?.length) {
                        dataList = [{ attachBuff: { blackboard: patch.blackboard } }];
                    }
                }
                const values = {};
                const modifierTypes = {};
                dataList.forEach(item => {
                    (item.attachSkill?.blackboard || []).forEach(bb => {
                        if (bb && bb.key !== undefined) values[bb.key] = bb.value;
                    });
                    (item.attachBuff?.blackboard || []).forEach(bb => {
                        if (bb && bb.key !== undefined) values[bb.key] = bb.value;
                    });
                    if (item.skillBbModifier?.bbKey && item.skillBbModifier.bbKey !== '') {
                        values[item.skillBbModifier.bbKey] = item.skillBbModifier.floatValue;
                    }
                    if (item.skillParamModifier?.paramType && item.skillParamModifier.paramValue) {
                        const ptName = paramTypeMap[item.skillParamModifier.paramType];
                        if (ptName) values[ptName] = item.skillParamModifier.paramValue;
                    }
                    if (item.attrModifier?.attrType && item.attrModifier.attrValue) {
                        const atName = attrEnMap[item.attrModifier.attrType];
                        if (atName) {
                            values[atName] = item.attrModifier.attrValue;
                            if (item.attrModifier.modifierType != null) {
                                modifierTypes[atName] = item.attrModifier.modifierType;
                            }
                        }
                    }
                });
                const costItems = (p.itemIds || []).map((id, i) => ({ id, count: (p.itemCnts || [])[i] || 0 }));
                return {
                    level: p.level,
                    name: p.name?.text || p.name || t('potentialName', { name: p.level || '' }),
                    description: desc,
                    values: values,
                    modifierTypes: modifierTypes,
                    costItems: costItems
                };
            });

            const potentialBundles = rawData.characterpotentialtable?.potentialUnlockBundle || [];
            potentialBundles.forEach(p => {
                (p.unlockCharPictureItemList || []).forEach(itemId => {
                    if (!itemId) return;
                    const imgName = itemId.replace(/^item_/, '');
                    legacy.potentialpics.push(`/public/images/assets/beyond/dynamicassets/gameplay/ui/textures/spaceship/imageposter/largesize/${imgName}.png`);
                });
            });

            const attrNodes = Object.values(rawData.chargrowthtable?.talentNodeMap || {}).filter(n => n.nodeType === 3);
            attrNodes.sort((a, b) => (a.attributeNodeInfo?.breakStage ?? 0) - (b.attributeNodeInfo?.breakStage ?? 0));
            legacy.attributeNodes = attrNodes.map(n => {
                const info = n.attributeNodeInfo || {};
                const modifiers = (info.attributeModifiers || []).filter(mod => mod && !(mod.attrType === 0 && mod.attrValue === 0));
                if (modifiers.length === 0) return null;
                return {
                    breakStage: info.breakStage,
                    title: info.title?.text || '',
                    modifiers: modifiers.map(mod => ({
                        name: getAttrName(mod.attrType) || mod.attrType,
                        value: mod.attrValue,
                        text: `${getAttrName(mod.attrType) || mod.attrType}${mod.attrValue >= 0 ? '+' : ''}${mod.attrValue}`,
                        modifierType: mod.modifierType
                    })),
                    requiredItem: n.requiredItem || []
                };
            }).filter(Boolean);

            const skillGroupMap = rawData.chargrowthtable?.skillGroupMap || {};
            const skillGroups = Object.values(skillGroupMap).sort((a, b) => (SKILL_GROUP_ORDER[a.skillGroupType] ?? a.skillGroupType) - (SKILL_GROUP_ORDER[b.skillGroupType] ?? b.skillGroupType));
            const highestTalentNodes = new Map();
            Object.values(rawData.chargrowthtable?.talentNodeMap || {}).forEach(node => {
                const info = node.passiveSkillNodeInfo;
                if (node.nodeType !== 4 || !info?.talentEffectId) return;
                const previous = highestTalentNodes.get(info.index);
                const previousInfo = previous?.passiveSkillNodeInfo;
                if (!previous || (info.level ?? 0) > (previousInfo.level ?? 0) ||
                    ((info.level ?? 0) === (previousInfo.level ?? 0) && (info.breakStage ?? 0) > (previousInfo.breakStage ?? 0))) {
                    highestTalentNodes.set(info.index, node);
                }
            });
            const highestTalentEffects = Array.from(highestTalentNodes.values())
                .map(node => rawData.potentialtalenteffecttable?.[node.passiveSkillNodeInfo.talentEffectId])
                .filter(Boolean);
            legacy.skills = skillGroups.map(s => {
                const iconPath = s.icon ? `${CHARACTER_SKILL_ICON_BASE}${s.icon}.png` : '';
                const groupName = getText(s.name);
                const groupDescription = getText(s.desc);
                const skillIdList = Array.isArray(s.skillIdList) ? s.skillIdList : [];
                let patchLists = skillIdList
                    .map(skillId => rawData.skillpatchtable?.[skillId]?.SkillPatchDataBundle || [])
                    .filter(patches => patches.length > 0);
                if (patchLists.length === 0 && s.skillGroupId) {
                    const groupPatches = rawData.skillpatchtable?.[s.skillGroupId]?.SkillPatchDataBundle || [];
                    if (groupPatches.length > 0) patchLists = [groupPatches];
                }

                const conditions = [1, 2].map(index => {
                    const conditionId = s[`conditionId${index}`] || '';
                    if (!conditionId) return null;
                    return {
                        id: conditionId,
                        name: s[`conditionName${index}`]?.text || '',
                        icon: s[`conditionIcon${index}`] ? `${CHARACTER_SKILL_ICON_BASE}${s[`conditionIcon${index}`]}.png` : iconPath,
                        conditionDesc: s[`conditionDesc${index}`]?.text || '',
                        description: s[`conditionPostDesc${index}`]?.text || ''
                    };
                }).filter(Boolean);
                const conditionNames = Object.fromEntries(conditions.map(condition => [condition.id, condition.name]));
                const values = { coolDown: [], costValue: [] };
                const subDescNames = [];
                const subDescLabels = {};
                const subDescValues = {};
                const hiddenFieldLabels = {};
                const fieldGroups = [];
                if (patchLists.length > 0) {
                    patchLists[0].forEach(patch => {
                        values.coolDown.push(patch.coolDown ?? 0);
                        values.costValue.push(patch.costValue ?? 0);
                    });
                    const seenKeys = new Set();
                    patchLists.forEach((patchList, patchListIndex) => {
                        const localKeyMap = {};
                        const localBlackboardKeys = [];
                        const ensureBlackboardKey = rawKey => {
                            if (localKeyMap[rawKey]) return localKeyMap[rawKey];
                            let finalKey = rawKey;
                            if (seenKeys.has(finalKey)) {
                                let seq = 2;
                                finalKey = `${rawKey}_${seq}`;
                                while (seenKeys.has(finalKey)) {
                                    seq++;
                                    finalKey = `${rawKey}_${seq}`;
                                }
                            }
                            localKeyMap[rawKey] = finalKey;
                            localBlackboardKeys.push(finalKey);
                            hiddenFieldLabels[finalKey] = rawKey;
                            seenKeys.add(finalKey);
                            return finalKey;
                        };
                        const localSubDescKeys = [];
                        patchList.forEach((patch, levelIndex) => {
                            (patch.blackboard || []).forEach(bb => {
                                if (!bb || !bb.key) return;
                                const finalKey = ensureBlackboardKey(bb.key);
                                if (!values[finalKey]) values[finalKey] = Array(levelIndex).fill('');
                                values[finalKey][levelIndex] = bb.value ?? 0;
                            });
                            localBlackboardKeys.forEach(key => {
                                if (values[key].length <= levelIndex) values[key].push('');
                            });
                            const occurrenceMap = {};
                            (patch.subDescDataList || []).forEach(subDesc => {
                                const name = subDesc.name?.text || '';
                                if (!name) return;
                                const conditionId = subDesc.conditionId || '';
                                const signature = `${conditionId}\u0000${name}`;
                                const occurrence = occurrenceMap[signature] || 0;
                                occurrenceMap[signature] = occurrence + 1;
                                const localId = `${signature}\u0000${occurrence}`;
                                let column = localSubDescKeys.find(item => item.localId === localId);
                                if (!column) {
                                    const key = `subDesc:${patchListIndex}:${localSubDescKeys.length}`;
                                    column = { localId, key };
                                    localSubDescKeys.push(column);
                                    subDescNames.push(key);
                                    subDescLabels[key] = conditionNames[conditionId]
                                        ? `${conditionNames[conditionId]} · ${name}`
                                        : name;
                                    subDescValues[key] = Array(levelIndex).fill('');
                                }
                                subDescValues[column.key][levelIndex] = subDesc.desc ?? '';
                            });
                            localSubDescKeys.forEach(column => {
                                if (subDescValues[column.key].length <= levelIndex) subDescValues[column.key].push('');
                            });
                        });
                        fieldGroups.push({
                            descriptions: localSubDescKeys.map(column => column.key),
                            hiddenFields: localBlackboardKeys
                        });
                    });
                }

                if (s.skillGroupType === 3 && conditions.length > 1 && values.coolDown.length > 0) {
                    conditions.forEach(condition => {
                        const adjustments = { 2: 0, 4: 0 };
                        const found = { 2: false, 4: false };
                        highestTalentEffects.forEach(effect => {
                            (effect.dataList || []).forEach(item => {
                                const modifier = item.skillParamModifier;
                                if (!modifier || ![2, 4].includes(modifier.paramType) || modifier.modifyType !== 1) return;
                                if (!skillIdList.includes(modifier.skillId) || !(item.activeCondition || []).includes(condition.id)) return;
                                if (typeof modifier.paramValue !== 'number') return;
                                adjustments[modifier.paramType] += modifier.paramValue;
                                found[modifier.paramType] = true;
                            });
                        });
                        const adjustment = found[4] ? adjustments[4] : (found[2] ? adjustments[2] : 0);
                        const key = `coolDown:${condition.id}`;
                        values[key] = values.coolDown.map(coolDown => coolDown + adjustment);
                        subDescLabels[key] = `${condition.name || condition.id} · ${t('columns.coolDown')}`;
                    });
                    delete values.coolDown;
                }

                const descriptionValues = {};
                patchLists.forEach(patches => {
                    const lastPatch = patches[patches.length - 1];
                    (lastPatch.blackboard || []).forEach(bb => {
                        if (bb && bb.key !== undefined) descriptionValues[bb.key] = bb.value;
                    });
                });
                const skillGroupId = s.skillGroupId || skillIdList[0] || groupName;
                const skillKey = `${skillGroupId}:${skillGroupId}`;
                const conditionVariants = conditions.map(condition => ({
                    ...condition,
                    conditionDesc: replacePlaceholders(condition.conditionDesc, descriptionValues).replace(/^\/\*|\*\/$/g, '').trim(),
                    description: replacePlaceholders(condition.description, descriptionValues)
                }));
                legacy.skill[skillKey] = {
                    skillKey,
                    name: groupName,
                    values,
                    subDescNames,
                    subDescLabels,
                    subDescValues,
                    hiddenFieldLabels,
                    fieldGroups
                };
                return {
                    skillKey,
                    name: groupName,
                    icon: iconPath,
                    description: replacePlaceholders(groupDescription, descriptionValues),
                    conditionVariants,
                    groupType: s.skillGroupType || 0,
                    skillIds: skillIdList,
                    skillGroupId: s.skillGroupId || '',
                    showGroupCosts: true
                };
            });

            const skillLevelUp = rawData.chargrowthtable?.skillLevelUp || [];
            const skillCosts = {};
            const skillGroupIdToName = {};
            legacy.skills.forEach(g => { skillGroupIdToName[g.skillIds?.[0]?.split('_').slice(0, -1).join('_') || ''] = g.name; });
            Object.values(rawData.chargrowthtable?.skillGroupMap || {}).forEach(sg => {
                skillGroupIdToName[sg.skillGroupId] = getText(sg.name);
            });
            skillLevelUp.forEach(entry => {
                const gid = entry.skillGroupId;
                if (!skillCosts[gid]) skillCosts[gid] = [];
                skillCosts[gid].push({ level: entry.level, goldCost: entry.goldCost || 0, items: entry.itemBundle || [] });
            });
            Object.values(skillCosts).forEach(arr => arr.sort((a, b) => a.level - b.level));
            legacy.skillCosts = skillCosts;
            legacy.skillGroupIdToName = skillGroupIdToName;

            const spaceshipChars = rawData.spaceshipcharskilltable?.skillList || [];
            const spaceshipSkills = rawData.spaceshipskilltable || {};
            const groupedSkills = {};
            spaceshipChars.forEach(s => {
                const skill = spaceshipSkills[s.skillId];
                if (!skill) return;
                const tName = getText(skill.talentName);
                if (!groupedSkills[tName]) {
                    groupedSkills[tName] = {
                        icon: skill.icon ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon/${skill.icon}.png` : '',
                        talentName: tName,
                        roomTypeName: roomTypeMap[String(skill.roomType)] || '',
                        levels: []
                    };
                }
                groupedSkills[tName].levels.push({
                    postfix: skill.skillNamePostfix || '',
                    skillName: getText(skill.name),
                    skillDesc: parseText(getText(skill.desc)),
                    unlockHint: getText(s.unlockHint)
                });
            });
            legacy.spaceshipSkills = Object.values(groupedSkills);

            const giftStageDefinitions = [
                { suffix: '_1', label: t('gifts.stage0') },
                { suffix: '_2', label: t('gifts.stage100') },
                { suffix: '_3', label: t('gifts.stage200') }
            ];
            legacy.giftStages = giftStageDefinitions.map(stage => {
                const rewardId = Object.keys(rawData.giftrewardtable || {}).find(id => id.endsWith(stage.suffix));
                const reward = rewardId ? rawData.giftrewardtable[rewardId] : null;
                if (!reward) return null;
                const fixedItems = (reward.itemBundles || []).map(item => ({ ...item, isPossible: false }));
                const possibleItems = (reward.probItemBundles || []).map(item => ({ ...item, isPossible: true }));
                return { label: stage.label, items: [...fixedItems, ...possibleItems] };
            }).filter(stage => stage?.items?.length);

            const weaponRecommendation = rawData.charwpnrecommendtable || {};
            legacy.weaponRecommendations = {
                skillAdaptation: (weaponRecommendation.weaponIds1 || []).map(id => ({ id })),
                attributeAdaptation: (weaponRecommendation.weaponIds2 || []).map(id => ({ id }))
            };

            legacy.profileRecord = (rawData.charactertable?.profileRecord || []).map(rec => ({
                title: rec.recordTitle?.text || '',
                desc: rec.recordDesc?.text || ''
            }));
            legacy.profileVoice = (rawData.charactertable?.profileVoice || []).map(v => ({
                title: getText(v.voiceTitle) || v.voId || '',
                desc: getText(v.voiceDesc),
                voId: v.voId || ''
            }));

            return legacy;
        }

        function getVisibleLevels(levelCount, configuredLevels, isExpanded) {
            const allLevels = Array.from({ length: levelCount }, (_, index) => index + 1);
            if (isExpanded || !configuredLevels) return allLevels;
            const configuredSet = new Set(configuredLevels);
            const visibleLevels = allLevels.filter(level => configuredSet.has(level));
            if (visibleLevels.length || configuredLevels.length === 0) return visibleLevels;
            const fallbackLevel = Math.max(...configuredLevels);
            return allLevels.includes(fallbackLevel) ? [fallbackLevel] : [];
        }

        function renderGrowthMatrix(data, isExpanded) {
            const growth = data.growth || {};
            const attributes = GROWTH_ATTRIBUTES.map(attribute => attribute.id);
            const preciseAttrs = new Set(GROWTH_ATTRIBUTES.filter(attribute => attribute.precise).map(attribute => attribute.id));
            const showHiddenGrowth = getCurrentShowHidden();
            const firstAttr = attributes.find(attr => growth[attr] && growth[attr].length);
            const levelCount = firstAttr ? growth[firstAttr].length : 0;
            const visibleLevels = getVisibleLevels(levelCount, charLevelsToShow, isExpanded);
            const header = `
                <tr>
                    <th scope="col">${t('level')}</th>
                    ${visibleLevels.map(level => `<th scope="col">${t('levelAbbreviation', { name: level })}</th>`).join('')}
                </tr>
            `;
            const rows = GROWTH_ATTRIBUTES.map(attribute => {
                const cells = visibleLevels.map(level => {
                    const val = growth[attribute.id]?.[level - 1];
                    const precision = preciseAttrs.has(attribute.id) ? (showHiddenGrowth ? 5 : 3) : 2;
                    if (val === undefined) return '<td>-</td>';
                    const display = Number(val).toFixed(precision);
                    const detail = data.growthDetails?.[attribute.id]?.[level - 1];
                    const html = window.renderRawValueTip ? window.renderRawValueTip(display, detail || val) : display;
                    return `<td>${html}</td>`;
                }).join('');
                return `<tr><th scope="row">${t(attribute.key)}</th>${cells}</tr>`;
            }).join('');
            return { header, rows };
        }

        function updateGrowthTable() {
            const table = document.querySelector('#character-growth .character-matrix-table');
            if (!table || !currentCharData) return;
            const matrix = renderGrowthMatrix(currentCharData, showAllCharLevels);
            table.querySelector('thead').innerHTML = matrix.header;
            table.querySelector('tbody').innerHTML = matrix.rows;

            const btn = document.querySelector('.toggle-char-levels-btn');
            window.AKEUI.setDisclosureButtonExpanded(btn, showAllCharLevels);
        }

        function renderSkillMatrix(skillDetail, isExpanded) {
            const showHidden = getCurrentShowHidden();
            const values = skillDetail.values || {};
            const subDescNames = skillDetail.subDescNames || [];
            const subDescLabels = skillDetail.subDescLabels || {};
            const subDescValues = skillDetail.subDescValues || {};
            const hiddenFieldLabels = skillDetail.hiddenFieldLabels || {};
            const fieldGroups = skillDetail.fieldGroups || [];
            const bbColumns = Object.keys(values).filter(key => Array.isArray(values[key]));
            const hasSubDesc = subDescNames.length > 0;
            const rows = [];
            const groupedFields = new Set();
            const groupedDescriptions = new Set();
            bbColumns.filter(isAlwaysShowColumn).forEach(field => {
                rows.push({ field, kind: 'value', depth: 0 });
                groupedFields.add(field);
            });
            if (hasSubDesc) {
                fieldGroups.forEach(group => {
                    const descriptions = group.descriptions || [];
                    descriptions.forEach(field => {
                        rows.push({ field, kind: 'description', depth: 0 });
                        groupedDescriptions.add(field);
                    });
                    if (!showHidden) return;
                    (group.hiddenFields || []).forEach(field => {
                        if (groupedFields.has(field)) return;
                        rows.push({ field, kind: 'hidden', depth: descriptions.length ? 1 : 0 });
                        groupedFields.add(field);
                    });
                });
                subDescNames.filter(field => !groupedDescriptions.has(field)).forEach(field => {
                    rows.push({ field, kind: 'description', depth: 0 });
                });
                if (showHidden) {
                    bbColumns.filter(field => !groupedFields.has(field)).forEach(field => {
                        rows.push({ field, kind: 'hidden', depth: 1 });
                    });
                }
            } else {
                bbColumns.filter(field => !groupedFields.has(field)).forEach(field => {
                    rows.push({ field, kind: 'hidden', depth: 0 });
                });
            }
            const visibleRows = rows.filter(row => {
                if (row.kind === 'description') return true;
                const rawField = hiddenFieldLabels[row.field] || row.field;
                return !isZeroSuppressedSkillField(rawField) || !hasOnlyZeroNumericValues(values[row.field]);
            });
            if (visibleRows.length === 0) return '';

            const levelCount = Math.max(0, ...visibleRows.map(row => (subDescValues[row.field] || values[row.field] || []).length));
            const visibleLevels = getVisibleLevels(levelCount, skillLevelsToShow, isExpanded);
            const header = `
                <tr>
                    <th scope="col">${t('level')}</th>
                    ${visibleLevels.map(level => `<th scope="col">${t('levelAbbreviation', { name: level })}</th>`).join('')}
                </tr>
            `;
            const bodyRows = visibleRows.map(row => {
                const field = row.field;
                const rawField = hiddenFieldLabels[field] || field;
                let label = COLUMN_KEY_MAP[field] ? t(COLUMN_KEY_MAP[field]) : (subDescLabels[field] || rawField);
                if (row.kind === 'hidden') {
                    const translation = hiddenFieldTranslation(rawField);
                    label = `<span class="character-skill-field-label"><span class="character-skill-field-key">${rawField}</span>${translation ? `<small class="character-skill-field-translation">${translation}</small>` : ''}</span>`;
                }
                const cells = visibleLevels.map(level => {
                    if (hasSubDesc && subDescValues[field] !== undefined) {
                        return `<td>${subDescValues[field][level - 1] ?? ''}</td>`;
                    }
                    const valuesForField = values[field];
                    let value = valuesForField
                        ? (valuesForField[level - 1] !== undefined ? valuesForField[level - 1] : valuesForField[valuesForField.length - 1])
                        : '';
                    if (typeof value === 'number') {
                        const display = value.toFixed(2);
                        value = window.renderRawValueTip ? window.renderRawValueTip(display, value, field) : display;
                    }
                    return `<td>${value}</td>`;
                }).join('');
                return `<tr${row.kind === 'hidden' ? ' class="character-skill-field-row"' : ''} data-row-depth="${row.depth}"><th scope="row">${label}</th>${cells}</tr>`;
            }).join('');
            return `
                <div class="ake-ui-table-shell">
                    <table class="ake-ui-table character-matrix-table">
                        <thead>${header}</thead>
                        <tbody>${bodyRows}</tbody>
                    </table>
                </div>
            `;
        }

        function updateSkillTable(skillKey) {
            const skillItem = Array.from(document.querySelectorAll('[data-card-kind="character-skill"]')).find(item => item.dataset.skillKey === skillKey);
            const skillContainer = skillItem?.querySelector('.skill-detail');
            if (!skillContainer || !currentCharData) return;

            const group = currentCharData.skills?.find(g => g.skillKey === skillKey);
            const skillDetail = currentCharData.skill?.[skillKey];
            if (!group || !skillDetail) return;

            const isExpanded = globalSkillExpand ? true : (skillExpandMap[skillKey] || false);
            const matrixHtml = renderSkillMatrix(skillDetail, isExpanded);
            if (!matrixHtml) {
                skillContainer.innerHTML = '';
                return;
            }
            const toggle = skillLevelsToShow ? window.AKEUI.disclosureButton({
                className: 'skill-toggle-btn',
                expanded: isExpanded,
                expandLabel: t('expandAllLevels'),
                collapseLabel: t('collapseExtraLevels'),
                attributes: { 'data-skill-key': skillKey }
            }) : null;
            const tableHtml = `
                ${toggle ? `<div class="skill-toggle-container">${toggle.outerHTML}</div>` : ''}
                ${matrixHtml}
            `;
            skillContainer.innerHTML = tableHtml;

            const newBtn = skillContainer.querySelector('.skill-toggle-btn');
            if (newBtn) {
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const wasGlobalExpanded = globalSkillExpand;
                    if (globalSkillExpand) globalSkillExpand = false;
                    skillExpandMap[skillKey] = !skillExpandMap[skillKey];
                    const globalButton = document.querySelector('.global-skill-toggle-btn');
                    window.AKEUI.setDisclosureButtonExpanded(globalButton, false);
                    if (wasGlobalExpanded) updateAllSkillTables();
                    else updateSkillTable(skillKey);
                });
            }
        }

        function updateAllSkillTables() {
            const skillKeys = currentCharData.skills?.map(g => g.skillKey) || [];
            skillKeys.forEach(skillKey => updateSkillTable(skillKey));
        }

        function escapeAttribute(value) {
            return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function materialItem(item, itemInfoMap) {
            const info = itemInfoMap?.[item.id] || {};
            return {
                icon: `${ITEM_ICON_BASE}${info.iconId || item.id}.png`,
                name: info.name || item.id,
                count: Number(item.count) > 0 ? item.count : undefined,
                description: info.description
            };
        }

        function itemCardHtml(item, itemInfoMap, subtitle = '') {
            const displayItem = materialItem(item, itemInfoMap);
            const count = Number(item.count) > 0 ? `×${item.count}` : '';
            const cardSubtitle = [subtitle, count].filter(Boolean).join(' · ');
            return window.AKEUI.card({
                media: { src: displayItem.icon, alt: displayItem.name },
                header: { title: displayItem.name, subtitle: cardSubtitle }
            }).outerHTML;
        }

        function materialPopover(options, itemInfoMap) {
            const rows = (options.rows || []).map(row => ({
                label: row.label,
                items: (row.items || []).map(item => materialItem(item, itemInfoMap))
            }));
            const items = (options.items || []).map(item => materialItem(item, itemInfoMap));
            const icons = [...new Set(options.iconIds || [])].map(id => ({
                icon: materialItem({ id }, itemInfoMap).icon
            }));
            return window.AKEUI.materialPopover({
                label: t('developmentCost'),
                placement: options.placement || 'top',
                rows,
                items,
                icons
            });
        }

        function materialPopoverHtml(options, itemInfoMap) {
            return materialPopover(options, itemInfoMap)?.outerHTML || '';
        }

        function renderDetail(data) {
            const showHidden = getCurrentShowHidden();
            const overviewMetaTags = getCharacterMetaIcons(data).map(icon => `
                <span class="character-detail-tag">
                    <img class="ake-ui-meta-icon" src="${icon.src}" alt="" data-kind="${icon.kind || ''}">
                    <span>${icon.label || ''}</span>
                </span>
            `).join('');

            const headerContent = window.AKEUI.fragment(`
                <div class="character-detail-tags">
                    ${overviewMetaTags}
                    ${(data.charBattleTag || []).map(tag => `<span class="ake-ui-badge">${tag}</span>`).join('')}
                </div>
                <dl class="character-detail-facts">
                    <div><dt>${commonT('rarity')}</dt><dd>${t('rarityStars', { name: data.rarity })}</dd></div>
                    <div><dt>${t('meta.weaponType')}</dt><dd>${data.weapontype || '-'}</dd></div>
                    <div><dt>${t('meta.voiceActor')}</dt><dd>${(data.cvName || []).join(' / ') || '-'}</dd></div>
                    <div class="character-detail-fact--key"><dt>${t('meta.mainAttribute')}</dt><dd>${data.mainAttrType || '-'}</dd></div>
                    <div class="character-detail-fact--key"><dt>${t('meta.subAttribute')}</dt><dd>${data.subAttrType || '-'}</dd></div>
                </dl>
                ${(data.profile || data.feature) ? `<div class="ake-ui-detail-summary">
                    ${data.profile ? `<div>${parseText(data.profile)}</div>` : ''}
                    ${data.feature ? `<div>${parseText(data.feature)}</div>` : ''}
                </div>` : ''}
            `);
            const detailHeader = window.AKEUI.detailHeader({
                layout: 'showcase',
                className: 'character-detail-hero',
                attributes: { id: 'character-overview' },
                icon: { src: data.icon || '' },
                title: data.name,
                content: headerContent,
                visual: {
                    element: 'figure',
                    className: 'character-detail-art',
                    src: data.pic || ''
                }
            });
            const basicHtml = detailHeader?.outerHTML || '';

            const detailNavHtml = `
                <nav class="character-detail-nav" aria-label="${escapeAttribute(data.name)}">
                    <a href="#character-growth">${t('sections.attributeGrowth')}</a>
                    <a href="#character-progression">${t('sections.potentials')}</a>
                    <a href="#character-skills">${t('sections.skills')}</a>
                    <a href="#character-gifts">${t('sections.gifts')}</a>
                    <a href="#character-weapon-recommendations">${t('sections.weaponRecommendations')}</a>
                    <a href="#character-archive">${t('sections.profile')}</a>
                </nav>
            `;

            const growthMatrix = renderGrowthMatrix(data, showAllCharLevels);
            const growthToggle = charLevelsToShow ? window.AKEUI.disclosureButton({
                className: 'toggle-char-levels-btn',
                expanded: showAllCharLevels,
                expandLabel: t('expandAllLevels'),
                collapseLabel: t('collapseExtraLevels')
            }) : null;

            const growthHtml = `
                <div class="ake-ui-section" id="character-growth">
                    <div class="ake-ui-section__header">
                        <h3 class="ake-ui-section__title">${t('sections.attributeGrowth')}</h3>
                        ${growthToggle?.outerHTML || ''}
                    </div>
                    <div class="ake-ui-table-shell">
                        <table class="ake-ui-table character-matrix-table">
                            <thead>${growthMatrix.header}</thead>
                            <tbody>${growthMatrix.rows}</tbody>
                        </table>
                    </div>
                </div>
            `;

            const itemInfoMap = data.itemInfoMap || {};
            const showHiddenAttr = getCurrentShowHidden();
            const talentGroups = [];
            (data.talents || []).forEach(talent => {
                const groupKey = talent.groupIndex ?? talent.icon ?? talent.name;
                let group = talentGroups.find(item => item.key === groupKey);
                if (!group) {
                    group = { key: groupKey, name: talent.name, icon: talent.icon, levels: [] };
                    talentGroups.push(group);
                }
                group.levels.push(talent);
            });
            const talentsHtml = talentGroups.map(group => {
                const talentCostRows = group.levels.map((talent, index) => {
                    const displayLevel = talent.level || index + 1;
                    return {
                        label: t('levelAbbreviation', { name: displayLevel }),
                        items: talent.requiredItem
                    };
                });
                const talentCostIconIds = [...new Set(group.levels.flatMap(talent =>
                    (talent.requiredItem || []).map(item => item.id)
                ))];

                return `
                    <div class="ake-ui-card" data-card-kind="character-talent" data-density="regular">
                        <div class="ake-ui-card__header character-talent-header">
                            ${group.icon ? `<img class="skill-icon character-talent-icon" src="${group.icon}" alt="">` : ''}
                            <div class="ake-ui-card__title">${group.name}</div>
                            <div class="character-card-cost">${materialPopoverHtml({ rows: talentCostRows, iconIds: talentCostIconIds }, itemInfoMap)}</div>
                        </div>
                        <div class="ake-ui-card__body character-talent-levels">
                            ${group.levels.map((talent, index) => {
                                const valueMap = talent.values || {};
                                const desc = parseText(replacePlaceholders(talent.description, valueMap, talent.modifierTypes, showHiddenAttr));
                                const displayLevel = talent.level || index + 1;
                                return `
                                    <div class="character-talent-level">
                                        <span class="character-talent-level-label">${t('levelAbbreviation', { name: displayLevel })}</span>
                                        <div class="character-talent-level-desc">${desc}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            const potentials = data.potentials || [];
            const potentialLevelOffset = potentials.some(pot => Number(pot.level) === 0) ? 1 : 0;
            const potentialRows = potentials.map((pot, index) => {
                const valueMap = pot.values || {};
                let desc = replacePlaceholders(pot.description, valueMap, pot.modifierTypes, showHiddenAttr);
                desc = parseText(desc);
                const costIconIds = (pot.costItems || []).map(it => it.id);
                const rawLevel = pot.level == null ? NaN : Number(pot.level);
                const displayLevel = Number.isFinite(rawLevel) ? rawLevel + potentialLevelOffset : index + 1;
                return window.AKEUI.progressionRow({
                    kind: 'potential',
                    stage: t('potentialName', { name: displayLevel }),
                    title: pot.name,
                    description: window.AKEUI.fragment(desc),
                    action: materialPopover({ items: pot.costItems, iconIds: costIconIds }, itemInfoMap)
                });
            });
            const potentialsHtml = window.AKEUI.progressionList({
                rows: potentialRows,
                empty: window.AKEUI.element('p', null, t('none'))
            }).outerHTML;

            const attrNodes = data.attributeNodes || [];
            const attrStageOffset = attrNodes.some(node => Number(node.breakStage) === 0) ? 1 : 0;
            const attrNodeGroups = [];
            attrNodes.forEach((node, index) => {
                const title = node.title || '';
                let group = attrNodeGroups.find(item => item.title === title);
                if (!group) {
                    group = { title, nodes: [] };
                    attrNodeGroups.push(group);
                }
                const rawStage = node.breakStage == null ? NaN : Number(node.breakStage);
                group.nodes.push({
                    ...node,
                    displayStage: Number.isFinite(rawStage) ? rawStage + attrStageOffset : index + 1
                });
            });
            const attrNodesHtml = `
                <div class="ake-ui-section">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.attributeNodes')}</h3></div>
                    <div class="character-attribute-groups">
                        ${attrNodeGroups.map(group => `
                            <div class="character-attribute-group">
                                ${group.title ? `<div class="character-attribute-group-title">${group.title}</div>` : ''}
                                ${window.AKEUI.progressionList({
                                    rows: group.nodes.map(node => {
                                        const costIconIds = (node.requiredItem || []).map(it => it.id);
                                        const stats = (node.modifiers || []).map(mod => {
                                            const modifierName = modifierTypeMap[String(mod.modifierType)] || '';
                                            const modTypeTag = showHiddenAttr && modifierName
                                                ? window.AKEUI.element('span', 'attr-node-modifier-tag', modifierName)
                                                : null;
                                            const hasStructuredValue = mod.name != null && mod.value != null;
                                            const value = hasStructuredValue && typeof mod.value === 'number'
                                                ? `${mod.value >= 0 ? '+' : ''}${mod.value}`
                                                : '';
                                            return hasStructuredValue
                                                ? { label: mod.name, value, meta: modTypeTag }
                                                : { content: window.AKEUI.fragment(`<strong>${mod.text || ''}</strong>`), meta: modTypeTag };
                                        });
                                        return window.AKEUI.progressionRow({
                                            kind: 'attribute',
                                            stage: t('breakthroughStage', { name: node.displayStage }, `#${node.displayStage}`),
                                            stats,
                                            action: materialPopover({ items: node.requiredItem, iconIds: costIconIds }, itemInfoMap)
                                        });
                                    })
                                }).outerHTML}
                            </div>
                        `).join('') || `<p>${t('none')}</p>`}
                    </div>
                </div>
            `;

            const skillsGroups = data.skills || [];
            const skillTypePrefix = [t('skillTypes.basicAttack'), t('skillTypes.combatSkill'), t('skillTypes.comboSkill'), t('skillTypes.ultimate')];
            const skillsHtml = skillsGroups.map(group => {
                const skillDetail = data.skill?.[group.skillKey];
                if (!skillDetail) return '';

                const values = skillDetail.values || {};
                const level1Values = {};
                for (const [key, val] of Object.entries(values)) {
                    if (Array.isArray(val) && val.length > 0) level1Values[key] = val[0];
                    else level1Values[key] = val;
                }

                const groupDesc = parseText(replacePlaceholders(group.description || '', level1Values));
                const prefixIndex = SKILL_GROUP_ORDER[group.groupType] ?? group.groupType;
                const prefix = skillTypePrefix[prefixIndex] || t('sections.skills');
                const displayName = `${prefix}·${group.name}`;

                const isExpanded = globalSkillExpand ? true : (skillExpandMap[group.skillKey] || false);
                const matrixHtml = renderSkillMatrix(skillDetail, isExpanded);
                let skillTables = '';
                if (matrixHtml) {
                    const toggle = skillLevelsToShow ? window.AKEUI.disclosureButton({
                        className: 'skill-toggle-btn',
                        expanded: isExpanded,
                        expandLabel: t('expandAllLevels'),
                        collapseLabel: t('collapseExtraLevels'),
                        attributes: { 'data-skill-key': group.skillKey }
                    }) : null;

                    skillTables = `
                        <div class="skill-detail">
                            ${toggle ? `<div class="skill-toggle-container">${toggle.outerHTML}</div>` : ''}
                            ${matrixHtml}
                        </div>
                    `;
                }

                const skCosts = group.showGroupCosts ? ((data.skillCosts || {})[group.skillGroupId] || []) : [];
                let skCostRows = [];
                if (skCosts.length > 0) {
                    const rows = skCosts.map(c => {
                        const itemParts = [...(c.goldCost > 0 ? [{ id: 'item_gold', count: c.goldCost }] : []), ...c.items.filter(it => it.id !== 'item_gold')];
                        return {
                            label: t('levelRange', { name: `${c.level - 1}→${c.level}` }),
                            items: itemParts
                        };
                    });
                    skCostRows = rows;
                }

                const conditionHtml = (group.conditionVariants || []).map(condition => `
                    <div class="skill-condition">
                        <div class="skill-condition-name">
                            <img class="skill-condition-icon" src="${condition.icon}" alt="">
                            ${condition.name}
                        </div>
                        ${condition.conditionDesc ? `<div class="skill-condition-trigger">${parseText(condition.conditionDesc)}</div>` : ''}
                        ${condition.description ? `<div class="skill-condition-desc">${parseText(condition.description)}</div>` : ''}
                    </div>
                `).join('');

                return `
                    <div class="ake-ui-card" data-card-kind="character-skill" data-density="regular" data-skill-key="${group.skillKey}">
                        <div class="ake-ui-card__header character-skill-header">
                            <div class="ake-ui-card__header-start">
                                <img class="skill-icon" src="${group.icon}" alt="">
                                <div class="ake-ui-card__title">${displayName}</div>
                            </div>
                            <div class="character-card-cost">
                                ${materialPopoverHtml({ rows: skCostRows, iconIds: ['item_gold', ...new Set(skCosts.flatMap(c => c.items.map(it => it.id)))] }, itemInfoMap)}
                            </div>
                        </div>
                        <div class="ake-ui-card__body">${groupDesc}${conditionHtml ? `<div class="skill-conditions">${conditionHtml}</div>` : ''}${skillTables}</div>
                    </div>
                `;
            }).join('');

            const potentialPics = data.potentialpics || [];
            const potentialPicsHtml = potentialPics.length > 0 ? `
                <div class="ake-ui-section collapsible-section">
                    <div class="ake-ui-section__header">
                        <button class="character-collapse-toggle" type="button" aria-expanded="false">
                            <span class="ake-ui-section__title">${t('sections.potentialImages')}</span>
                            <span class="collapse-indicator" aria-hidden="true"></span>
                        </button>
                    </div>
                    <div class="collapse-content">
                        <div class="potential-pics">
                            ${potentialPics.map(src => `<figure class="potential-pic-frame"><img src="${src}" alt=""></figure>`).join('')}
                        </div>
                    </div>
                </div>
            ` : '';

            const profileRecordsHtml = (data.profileRecord || []).map(rec => `
                <div class="ake-ui-card" data-card-kind="character-profile" data-density="regular">
                    <div class="ake-ui-card__title">${rec.title}</div>
                    <div class="ake-ui-card__body">${parseText(rec.desc)}</div>
                </div>
            `).join('');

            const voiceHtml = (data.profileVoice || []).length ? `
                <div class="character-voice-list">
                    ${(data.profileVoice || []).map(v => `
                        <div class="character-voice-row">
                            <div class="voice-title">${voiceButtonHtml(v.voId)}${v.title}</div>
                            <div class="voice-desc">${v.desc}</div>
                        </div>
                    `).join('')}
                </div>
            ` : `<p>${t('none')}</p>`;

            const spaceshipSkills = data.spaceshipSkills || [];
            const spaceshipHtml = spaceshipSkills.length ? spaceshipSkills.map(slot => `
                <div class="ake-ui-card" data-card-kind="character-spaceship-skill" data-density="regular">
                    <div class="ake-ui-card__header">
                        <img class="spaceship-icon" src="${slot.icon}" alt="">
                        <span class="ake-ui-card__title">${slot.talentName}</span>
                        <span class="spaceship-skill-room">${slot.roomTypeName}</span>
                    </div>
                    <div class="ake-ui-card__body">
                        ${slot.levels.map(lv => `
                            <div class="spaceship-skill-level">
                                <span class="spaceship-skill-postfix">${lv.postfix}</span>
                                <div class="spaceship-skill-info">
                                    <div class="spaceship-skill-fullname">${lv.skillName}</div>
                                    <div class="spaceship-skill-desc">${lv.skillDesc}</div>
                                    <div class="spaceship-skill-unlock">${lv.unlockHint}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('') : `<p>${t('none')}</p>`;

            const giftSectionHtml = data.giftStages?.length ? `
                <div class="ake-ui-section" id="character-gifts">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.gifts')}</h3></div>
                    ${data.giftStages.map(stage => `
                        <div class="ake-ui-section__header"><h4 class="ake-ui-section__title">${stage.label}</h4></div>
                        <div class="ake-ui-card-grid" data-size="regular">
                            ${stage.items.map(item => itemCardHtml(
                                item, itemInfoMap, item.isPossible ? t('gifts.possibleItems') : t('gifts.returnItems')
                            )).join('')}
                        </div>
                    `).join('')}
                </div>
            ` : '';

            const weaponRecommendationsHtml = `
                <div class="ake-ui-section" id="character-weapon-recommendations">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.weaponRecommendations')}</h3></div>
                    <div class="ake-ui-card-grid" data-size="regular">
                        <div class="ake-ui-card" data-card-kind="character-weapon-recommendation" data-density="regular">
                            <div class="ake-ui-card__header"><div class="ake-ui-card__title">${t('weaponRecommendations.skillAdaptation')}</div></div>
                            <div class="ake-ui-card__body">
                                ${data.weaponRecommendations?.skillAdaptation?.length
                                    ? `<div class="ake-ui-card-grid" data-size="regular">${data.weaponRecommendations.skillAdaptation.map(item => itemCardHtml(item, itemInfoMap)).join('')}</div>`
                                    : `<p>${t('none')}</p>`}
                            </div>
                        </div>
                        <div class="ake-ui-card" data-card-kind="character-attribute-recommendation" data-density="regular">
                            <div class="ake-ui-card__header"><div class="ake-ui-card__title">${t('weaponRecommendations.attributeAdaptation')}</div></div>
                            <div class="ake-ui-card__body">
                                ${data.weaponRecommendations?.attributeAdaptation?.length
                                    ? `<div class="ake-ui-card-grid" data-size="regular">${data.weaponRecommendations.attributeAdaptation.map(item => itemCardHtml(item, itemInfoMap)).join('')}</div>`
                                    : `<p>${t('none')}</p>`}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const globalSkillToggle = skillLevelsToShow ? window.AKEUI.disclosureButton({
                className: 'global-skill-toggle-btn',
                expanded: globalSkillExpand,
                expandLabel: t('expandAllSkillLevels'),
                collapseLabel: t('collapseAllSkillLevels')
            }) : null;

            return `<article class="ake-ui-detail" data-detail-kind="character">
                ${basicHtml}
                ${detailNavHtml}
                ${growthHtml}
                <div class="character-progression-grid" id="character-progression">
                    <div class="ake-ui-section character-talent-section">
                        <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.talents')}</h3></div>
                        <div class="ake-ui-card-grid" data-size="full">${talentsHtml || `<p>${t('none')}</p>`}</div>
                    </div>
                    <div class="ake-ui-section character-potential-section">
                        <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.potentials')}</h3></div>
                        ${potentialsHtml}
                    </div>
                </div>
                ${attrNodesHtml}
                <div class="ake-ui-section" id="character-skills">
                    <div class="ake-ui-section__header">
                        <h3 class="ake-ui-section__title">${t('sections.skills')}</h3>
                        ${globalSkillToggle?.outerHTML || ''}
                    </div>
                    <div class="ake-ui-card-grid" data-size="full">${skillsHtml || `<p>${t('none')}</p>`}</div>
                </div>
                <div class="ake-ui-section" id="character-logistics">
                    <div class="ake-ui-section__header"><h3 class="ake-ui-section__title">${t('sections.logisticsSkills')}</h3></div>
                    <div class="ake-ui-card-grid" data-size="regular">${spaceshipHtml}</div>
                </div>
                ${giftSectionHtml}
                ${weaponRecommendationsHtml}
                <div class="character-archive-stack" id="character-archive">
                    ${potentialPicsHtml}
                    <div class="ake-ui-section collapsible-section">
                        <div class="ake-ui-section__header">
                            <button class="character-collapse-toggle" type="button" aria-expanded="false">
                                <span class="ake-ui-section__title">${t('sections.profile')}</span>
                                <span class="collapse-indicator" aria-hidden="true"></span>
                            </button>
                        </div>
                        <div class="collapse-content">
                            <div class="ake-ui-card-grid" data-size="full">${profileRecordsHtml || `<p>${t('none')}</p>`}</div>
                        </div>
                    </div>
                    <div class="ake-ui-section collapsible-section">
                        <div class="ake-ui-section__header">
                            <button class="character-collapse-toggle" type="button" aria-expanded="false">
                                <span class="ake-ui-section__title">${t('sections.voiceRecords')}</span>
                                <span class="collapse-indicator" aria-hidden="true"></span>
                            </button>
                        </div>
                        <div class="collapse-content">
                            ${voiceHtml}
                        </div>
                    </div>
                </div>
                </article>
            `;
        }

        async function refreshModule() {
            const list = document.getElementById('v2characterList');
            const detail = document.getElementById('v2characterDetail');
            if (!list || !detail) return;
            const showHidden = window.akeData?.getConfig().showHidden ?? false;
            const chars = await loadCharacterManifest(showHidden);
            allCharacters = chars;
            generateFilterButtons();
            renderCharacterList();
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;
            await loadMaps();

            const settings = window.akeData?.getLevelSettings?.() || {};
            if (settings.enabled) {
                charLevelsToShow = parseLevelInput(settings.characterLevels, 90);
                const skillEnabled = settings.skillLevels || Array(12).fill(true);
                skillLevelsToShow = skillEnabled.reduce((acc, checked, idx) => {
                    if (checked) acc.push(idx + 1);
                    return acc;
                }, []);
            }

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', (e) => {
                if (e.target === mobileOverlay) closeMobileList();
            });

            window.addEventListener('globalConfigChanged', (e) => {
                searchTerm = '';
                const searchInput = document.getElementById('v2charSearchInput');
                if (searchInput) searchInput.value = '';

                const settings = window.akeData?.getLevelSettings?.() || {};
                if (settings.enabled) {
                    charLevelsToShow = parseLevelInput(settings.characterLevels, 90);
                    const skillEnabled = settings.skillLevels || Array(12).fill(true);
                    skillLevelsToShow = skillEnabled.reduce((acc, checked, idx) => {
                        if (checked) acc.push(idx + 1);
                        return acc;
                    }, []);
                } else {
                    charLevelsToShow = null;
                    skillLevelsToShow = null;
                }
                showAllCharLevels = false;
                globalSkillExpand = false;
                skillExpandMap = {};

                selectedRarities.clear();
                selectedCharTypes.clear();
                selectedProfessions.clear();
                selectedWeaponTypes.clear();
                refreshModule();
            });

            document.getElementById('v2charSearchInput')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderCharacterList();
            });

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
