(function () {
    'use strict';
    const t = (key, params) => window.akeI18n.t(`modules.spaceship.skills.${key}`, params);
    const skillIcon = skill => skill.icon ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon/${skill.icon}.png` : '';
    const portrait = id => `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charroundicon/icon_round_${id}.png`;
    const plain = text => String(text || '').replace(/<[^>]*>/g, '').toLocaleLowerCase();
    // Parameter positions are matched against SpaceshipSkillTable descriptions in the current data.
    // effectType is not the same enum as SpaceshipRoomAttrTypeTable.type.
    function numericEffect(row, c, id) {
        const effect = String(row.effectType ?? 'unknown');
        const read = index => {
            const p = row.parameters?.[index];
            if (p?.realType !== 0 || p?.valueType !== 0) return null;
            const value = p?.valueFloatList?.[0] ?? p?.valueIntList?.[0];
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
        };
        const known = ['0', '1', '3', '4', '6', '7'].includes(effect);
        const value = known ? read(effect === '6' ? 1 : 0) : null;
        const targetValue = ['3', '6', '7'].includes(effect) ? read(effect === '6' ? 0 : 1) : null;
        const target = targetValue === null ? '' : String(targetValue);
        let targetName = '';
        if (['3', '6'].includes(effect) && target) {
            const source = effect === '3' ? 'SpaceshipGrowCabinFormulaShowingTypeTable' : 'SpaceshipClueDataIndex2IdTable';
            const entry = c.tables[source][target];
            if (!entry) c.issue('missing-reference', source, target);
            targetName = entry ? c.name(entry.name, target) : t('unknownTarget', { value: target });
        }
        if (effect === '7' && target) {
            // Skill product enum 1/2 corresponds to operator/weapon EXP; room attribute enum is 16/17.
            const attr = { '1': '16', '2': '17' }[target];
            if (attr && !c.tables.SpaceshipRoomAttrTypeTable[attr]) c.issue('missing-reference', 'SpaceshipRoomAttrTypeTable', attr);
            targetName = attr ? c.name(c.tables.SpaceshipRoomAttrTypeTable[attr]?.name, attr) : t('unknownTarget', { value: target });
            if (!attr) c.issue('unknown-skill-target', 'SpaceshipSkillTable', id, target);
        }
        if (!known) c.issue('unknown-skill-effect', 'SpaceshipSkillTable', id, effect);
        if (known && (value === null || (['3', '6', '7'].includes(effect) && !target))) c.issue('invalid-skill-parameters', 'SpaceshipSkillTable', id);
        const comparable = known && value !== null && (!['3', '6', '7'].includes(effect) || target !== '');
        return { effect, target, targetName, value: comparable ? (effect === '6' ? value : Number((value * 100).toFixed(6))) : null,
            label: known ? t(`effects.${effect}`) : t('unknownEffect', { value: effect }) };
    }

    function collect(c) {
        const T = c.tables, characters = [], referenced = new Set();
        const makeSkill = (id, slot, order) => {
            const skill = T.SpaceshipSkillTable[id];
            if (!skill) c.issue('missing-reference', 'SpaceshipSkillTable', id);
            const row = skill || {};
            const room = String(row.roomType ?? 'unknown');
            if (!T.SpaceshipRoomTypeTable[room]) c.issue('unmapped-room', 'SpaceshipRoomTypeTable', room);
            // Like the character module, use skillIndex for progression.
            // Keep every level, and keep missing references visible instead of discarding them.
            return { id, slot, order, room, row, numeric: numericEffect(row, c, id),
                name: skill ? c.name(row.name, id) : c.t('unavailable'),
                roomName: c.name(T.SpaceshipRoomTypeTable[room]?.name, room),
                desc: c.rich(row.desc), unlock: c.rich(slot.unlockHint),
                search: plain([c.text(row.name), c.text(row.talentName), c.text(row.desc), c.text(slot.unlockHint)].join(' ')) };
        };
        for (const [charId, record] of c.entries(T.SpaceshipCharSkillTable)) {
            const character = T.CharacterTable[charId];
            if (!character) c.issue('missing-reference', 'CharacterTable', charId);
            const seen = new Set(), skills = [];
            for (const [order, slot] of (record.skillList || []).entries()) {
                const identity = JSON.stringify([slot.skillIndex, slot.skillId, slot.unlockHint?.id]);
                if (seen.has(identity)) { c.issue('duplicate-skill-slot', 'SpaceshipCharSkillTable', charId, slot.skillId); continue; }
                seen.add(identity);
                referenced.add(slot.skillId);
                skills.push(makeSkill(slot.skillId, slot, order));
            }
            skills.sort((a, b) => Number(a.slot.skillIndex ?? a.order) - Number(b.slot.skillIndex ?? b.order)
                || Number(a.row.level || 0) - Number(b.row.level || 0) || a.order - b.order);
            if (skills.length) characters.push({ charId, character, name: c.name(character?.name, charId), skills });
        }
        const orphaned = c.entries(T.SpaceshipSkillTable).filter(([id]) => !referenced.has(id));
        if (orphaned.length) characters.push({ charId: '', name: t('unassigned'), skills: orphaned.map(([id], order) => {
            c.issue('unassigned-skill', 'SpaceshipSkillTable', id);
            return makeSkill(id, {}, order);
        }) });
        return characters;
    }

    function mount(root, c, roomPresentation = {}) {
        const abort = new AbortController(), characters = collect(c);
        const rooms = new Map();
        const filters = new Map();
        let activeFilter = '', sortOrder = '';
        const selectedRooms = new Set();
        for (const character of characters) for (const skill of character.skills) {
            rooms.set(skill.room, skill.roomName);
            const n = skill.numeric;
            const key = JSON.stringify([skill.room, n.effect, n.target]);
            filters.set(key, { room: skill.room, effect: n.effect, target: n.target, label: n.targetName || n.label });
        }
        const button = (label, attrs) => window.AKEUI.filterButton({ label, attributes: attrs, pressed: false });
        const group = (label, content) => `<div class="ake-ui-filter__group"><div class="ake-ui-filter__label">${c.h(label)}</div><div class="ake-ui-filter__options">${content}</div></div>`;
        const roomColor = id => {
            const color = c.tables.SpaceshipRoomTypeTable[id]?.color;
            return roomPresentation[id]?.background || (/^[0-9a-f]{6}$/i.test(color || '') ? `#${color}` : 'var(--accent-color)');
        };
        const orderedRooms = [...rooms].sort(([a], [b]) => Number(a) - Number(b));
        const roomButtons = orderedRooms.map(([id, label]) => button(label, { 'data-room': id, style: `--ake-spaceship-filter-color: ${roomColor(id)}` }).outerHTML).join('');
        const effectButtons = orderedRooms.map(([room, label]) => group(label, [...filters].filter(([, filter]) => filter.room === room).map(([key, filter]) =>
            button(filter.label, { 'data-numeric-filter': key, style: `--ake-spaceship-filter-color: ${roomColor(room)}` }).outerHTML).join(''))).join('');
        root.innerHTML = `<section class="ake-ui-section" data-variant="surface">${group(t('rooms'), roomButtons)}${effectButtons}</section>
            <section class="ake-ui-section"><div class="ake-ui-toolbar">
                <button class="ake-ui-button" type="button" data-reset>${c.h(t('reset'))}</button>
                <label><input type="checkbox" data-related-only> ${c.h(t('relatedOnly'))}</label>
                <label><input type="checkbox" data-highest-only> ${c.h(t('highestOnly'))}</label>
            </div><p class="ake-ui-section__description" data-numeric-hint></p><input class="ake-ui-input" type="search" data-skill-search aria-label="${c.h(t('search'))}" placeholder="${c.h(t('search'))}"></section>
            <section class="ake-ui-section" data-skill-results aria-live="polite"></section>`;
        const search = root.querySelector('[data-skill-search]');
        const relatedOnly = root.querySelector('[data-related-only]');
        const highestOnly = root.querySelector('[data-highest-only]');
        const results = root.querySelector('[data-skill-results]');
        function refreshNumeric() {
            const filter = filters.get(activeFilter);
            const comparable = filter && ['0', '1', '3', '4', '6', '7'].includes(filter.effect)
                && (!['3', '6', '7'].includes(filter.effect) || filter.target !== '');
            sortOrder = comparable ? 'desc' : '';
            root.querySelector('[data-numeric-hint]').textContent = t(filter?.effect === '6' ? 'tierHint' : 'numericHint');
            root.querySelectorAll('[data-numeric-filter]').forEach(node => {
                const selected = node.dataset.numericFilter === activeFilter;
                node.setAttribute('aria-pressed', String(selected));
                node.classList.toggle('is-active', selected);
            });
        }
        const matches = (character, skill, query) => (!selectedRooms.size || selectedRooms.has(skill.room))
            && (!activeFilter || (skill.room === filters.get(activeFilter).room && skill.numeric.effect === filters.get(activeFilter).effect && skill.numeric.target === filters.get(activeFilter).target))
            && (!query || window.AKEModuleSearch.matches(`${plain(character.name)} ${skill.search} ${c.hidden() ? `${character.charId} ${skill.id}` : ''}`, query));
        const material = (name, icon) => window.AKEUI.materialItem({ name, icon })?.outerHTML || c.h(name);
        function renderResults() {
            const query = search.value.trim().toLocaleLowerCase();
            const bodies = [];
            const groups = [];
            for (const character of characters) {
                let skills = character.skills;
                if (highestOnly.checked) {
                    const best = new Map();
                    for (const skill of skills) {
                        const key = String(skill.slot.skillIndex ?? skill.id);
                        best.set(key, Math.max(best.get(key) ?? -Infinity, Number(skill.row.level || 0)));
                    }
                    skills = skills.filter(skill => Number(skill.row.level || 0) === best.get(String(skill.slot.skillIndex ?? skill.id)));
                }
                const matched = skills.filter(skill => matches(character, skill, query));
                if (!matched.length) continue;
                if (relatedOnly.checked) skills = skills.filter(skill => matches(character, skill, query));
                const values = matched.map(skill => skill.numeric.value).filter(value => value !== null);
                const score = values.length ? Math.max(...values) : null;
                groups.push({ character, skills, score });
            }
            if (sortOrder) groups.sort((a, b) => a.score === null ? (b.score === null ? 0 : 1) : b.score === null ? -1 : b.score - a.score);
            for (const { character, skills } of groups) {
                const identity = character.character ? window.AKEUI.entryLinkHtml({ plugin: 'v3_character', id: character.charId, label: character.name,
                    contentHtml: material(character.name, portrait(character.charId)) }) : c.h(character.name);
                bodies.push(`<tbody>${skills.map((skill, index) => `<tr>
                    ${index === 0 ? `<th scope="rowgroup" rowspan="${skills.length}">${identity}${c.hidden() && character.charId ? `<small class="ake-ui-section__description">${c.h(character.charId)}</small>` : ''}</th>` : ''}
                    <td>${skill.unlock || '—'}</td><td>${c.h(skill.roomName)}</td>
                    <td>${material(skill.name, skillIcon(skill.row))}${c.hidden() ? `<small class="ake-ui-section__description">${c.h(skill.id)}</small>` : ''}</td>
                    <td><div class="ake-ui-section__body">${skill.desc || c.h(c.t('unavailable'))}</div>${c.hidden() ? `<span class="ake-ui-badge">${c.h(skill.numeric.label)}${skill.numeric.targetName ? ` · ${c.h(skill.numeric.targetName)}` : ''} · ${skill.numeric.value === null ? c.h(c.t('unavailable')) : skill.numeric.effect === '6' ? c.h(t('tier', { value: skill.numeric.value })) : `${c.number(skill.numeric.value)}%`}</span>` : ''}</td>
                </tr>`).join('')}</tbody>`);
            }
            results.innerHTML = bodies.length ? `<div class="ake-ui-table-shell"><table class="ake-ui-table" data-table-kind="spaceship-skills"><thead><tr>${['character', 'unlock', 'rooms', 'skill', 'effect'].map(key => `<th scope="col">${c.h(t(key))}</th>`).join('')}</tr></thead>${bodies.join('')}</table></div>` : c.state(c.t('noMatches'));
        }
        function refreshButtons() {
            root.querySelectorAll('[data-room]').forEach(node => {
                const selected = selectedRooms.has(node.dataset.room);
                node.setAttribute('aria-pressed', String(selected));
                node.classList.toggle('is-active', selected);
            });
        }
        root.addEventListener('click', event => {
            const node = event.target.closest('button');
            if (!node) return;
            if (node.hasAttribute('data-reset')) {
                selectedRooms.clear(); search.value = ''; relatedOnly.checked = false; highestOnly.checked = false;
                activeFilter = ''; sortOrder = '';
            } else if (node.hasAttribute('data-room')) {
                const id = node.dataset.room;
                selectedRooms.has(id) ? selectedRooms.delete(id) : selectedRooms.add(id);
                activeFilter = ''; sortOrder = '';
            } else if (node.hasAttribute('data-numeric-filter')) {
                activeFilter = activeFilter === node.dataset.numericFilter ? '' : node.dataset.numericFilter;
                selectedRooms.clear();
                if (activeFilter) selectedRooms.add(filters.get(activeFilter).room);
            } else return;
            refreshButtons(); refreshNumeric(); renderResults();
        }, { signal: abort.signal });
        let timer;
        const queueSearch = () => { clearTimeout(timer); timer = setTimeout(renderResults, 150); };
        search.addEventListener('compositionstart', () => clearTimeout(timer), { signal: abort.signal });
        search.addEventListener('input', event => { if (!event.isComposing) queueSearch(); }, { signal: abort.signal });
        search.addEventListener('compositionend', queueSearch, { signal: abort.signal });
        relatedOnly.addEventListener('change', renderResults, { signal: abort.signal });
        highestOnly.addEventListener('change', renderResults, { signal: abort.signal });
        refreshNumeric();
        renderResults();
        return () => { clearTimeout(timer); abort.abort(); };
    }
    window.AKESpaceshipSkills = { mount };
})();
