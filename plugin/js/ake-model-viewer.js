(function () {
    'use strict';

    const t = window.akeI18n?.scope?.('modules.modelViewer') || ((key, params, fallback) => fallback ?? key);
    const root = document.getElementById('modelViewerModule');
    if (!root) return;

    const MODEL_BUCKET_PATH = '/endfield-bundles/';
    const FALLBACK_DATA_BASE_URL = 'https://data.akedata.wiki';

    const viewer = root.querySelector('#modelViewerViewport');
    const character = root.querySelector('#modelViewerCharacter');
    const loadButton = root.querySelector('#modelViewerLoad');
    const category = root.querySelector('#modelViewerCategory');
    const animation = root.querySelector('#modelViewerAnimation');
    const state = root.querySelector('#modelViewerState');
    const play = root.querySelector('#modelViewerPlay');
    const pause = root.querySelector('#modelViewerPause');
    const timeline = root.querySelector('#modelViewerTimeline');
    const timeOutput = root.querySelector('#modelViewerTime');
    const status = root.querySelector('#modelViewerStatus');
    const progress = root.querySelector('#modelViewerProgress');
    const progressBar = root.querySelector('#modelViewerProgressBar');
    let clips = [];
    let scrubbing = false;
    let renderer = null;
    let pending = null;

    function resolveBucketUrl() {
        const state = window.akeDataSource?.getState?.();
        const rawBaseUrl = state?.defaultBaseUrl ||
            window.__akeBootstrapVersion?.dataBaseUrl ||
            FALLBACK_DATA_BASE_URL;
        try {
            return new URL(MODEL_BUCKET_PATH, new URL(rawBaseUrl, window.location.href)).href;
        } catch (error) {
            console.error('Invalid model bucket base URL:', rawBaseUrl, error);
            viewer.setAttribute('bucket', '');
            return '';
        }
    }

    if (viewer) {
        const bucketUrl = resolveBucketUrl();
        if (viewer.getAttribute('bucket') !== bucketUrl) {
            viewer.setAttribute('bucket', bucketUrl);
        }
    }

    function localizedStatus() {
        if (!customElements.get('endfield-viewer')) return '';
        return viewer?.shadowRoot?.querySelector('[data-status]')?.textContent || '';
    }

    function showStatus(state, title, message) {
        if (!status) return;
        status.dataset.state = state;
        status.querySelector('.ake-ui-state__title').textContent = title;
        status.querySelector('.ake-ui-state__message').textContent = message || '';
    }

    function resetAnimationControls() {
        clips = [];
        renderer = null;
        pending = null;
        loadButton.disabled = false;
        category.replaceChildren(new Option(t('allAnimations', null, '全部动画'), ''));
        animation.replaceChildren(new Option(t('defaultPose', null, '默认姿态'), ''));
        updateStates();
        showStatus('loading', t('selectCharacter', null, '请选择角色'),
            t('selectCharacterHint', null, '从列表中选择一个角色，然后点击加载。'));
    }

    function showProgress(loaded, total) {
        if (!progress || !progressBar) return;
        const value = total > 0 ? Math.max(0, Math.min(1, loaded / total)) : 0;
        progressBar.style.width = `${(value * 100).toFixed(1)}%`;
        progress.classList.toggle('is-indeterminate', total <= 0);
        progress.hidden = false;
    }

    function hideProgress() {
        if (!progress || !progressBar) return;
        progress.hidden = true;
        progressBar.style.width = '0%';
        progress.classList.remove('is-indeterminate');
    }

    function filterAnimations() {
        const selected = animation.value;
        const visible = clips.filter(clip => !category.value || (clip.category || 'uncategorized') === category.value);
        animation.replaceChildren(new Option(t('defaultPose', null, '默认姿态'), ''));
        const current = clips.find(clip => clip.id === selected);
        if (current && !visible.includes(current)) {
            const group = document.createElement('optgroup');
            group.label = t('currentAnimation', null, '当前动画');
            group.append(new Option(current.name, current.id));
            animation.append(group);
        }
        visible.forEach(clip => animation.append(new Option(clip.name, clip.id)));
        animation.value = selected;
    }

    function updateStates() {
        const clip = clips.find(entry => entry.id === animation.value);
        const states = clip?.states || [];
        state.replaceChildren(new Option(t('selectState', null, '选择状态'), ''),
            ...states.map(entry => new Option(entry.name, entry.id)));
        state.hidden = state.disabled = states.length === 0;
        if (states.length === 1) state.value = states[0].id;
    }

    function playSelection() {
        const clip = clips.find(entry => entry.id === animation.value);
        if (!clip || (clip.states?.length && !state.value)) {
            timeline.disabled = !animation.value;
            return;
        }
        if (!renderer) {
            showStatus('loading', t('loading', null, '正在加载'), t('webgpuHint', null, '需要支持 WebGPU 的浏览器'));
            timeline.disabled = true;
            return;
        }
        const animationId = clip.id;
        const stateId = state.value || undefined;
        if (typeof viewer?.ensureAnimation !== 'function') {
            renderer.playAnimation(animationId, true, stateId);
            timeline.disabled = false;
            return;
        }
        if (pending) return;
        pending = viewer.ensureAnimation(animationId).then(() => {
            renderer.playAnimation(animationId, true, stateId);
            timeline.disabled = false;
            showStatus('ready', clip.name, localizedStatus() || '');
        }).catch(error => {
            console.error(error);
            showStatus('error', t('loadFailed', null, '加载失败'), error?.message || '');
            timeline.disabled = true;
        }).finally(() => {
            pending = null;
        });
    }

    function updatePlayback() {
        if (!renderer) {
            requestAnimationFrame(updatePlayback);
            return;
        }
        const playback = renderer.getPlaybackState();
        if (!scrubbing) timeline.value = String(playback.time);
        timeline.max = String(Math.max(1, playback.duration));
        timeOutput.textContent = `${playback.time.toFixed(2)} / ${playback.duration.toFixed(2)}`;
        play.disabled = playback.id === null || playback.playing;
        pause.disabled = playback.id === null || !playback.playing;
        requestAnimationFrame(updatePlayback);
    }

    viewer.addEventListener('catalog-loaded', event => {
        const ids = event.detail?.characters || [];
        character.replaceChildren(new Option(t('selectCharacter', null, '请选择角色'), ''),
            ...ids.map(id => new Option(id, id)));
        character.disabled = ids.length === 0;
        loadButton.disabled = ids.length === 0;
        resetAnimationControls();
        showStatus('ready', t('selectCharacter', null, '请选择角色'),
            t('selectCharacterHint', null, '从列表中选择一个角色，然后点击加载。'));
    });

    viewer.addEventListener('character-loaded', event => {
        renderer = event.detail.renderer || null;
        clips = event.detail.animations || [];
        pending = null;
        if (character.options.length <= 1) {
            character.replaceChildren(...(event.detail.characters || []).map(id => new Option(id, id)));
        }
        character.value = event.detail.characterId;
        character.disabled = false;
        loadButton.disabled = false;
        category.replaceChildren(new Option(t('allAnimations', null, '全部动画'), ''),
            ...['battle', 'interaction', 'dialogue', 'ui', 'locomotion', 'expression', 'cinematic', 'uncategorized']
                .filter(value => clips.some(clip => (clip.category || 'uncategorized') === value))
                .map(value => new Option(t(`categories.${value}`, null, value), value)));
        filterAnimations();
        updateStates();
        hideProgress();
        showStatus('ready', event.detail.characterId, localizedStatus() || event.detail.characterId);
    });

    viewer.addEventListener('character-error', event => {
        showStatus('error', t('loadFailed', null, '加载失败'), event.detail?.error?.message || '');
        hideProgress();
    });

    loadButton.onclick = async () => {
        const characterId = character.value;
        if (!characterId || typeof viewer?.loadCharacter !== 'function') return;
        loadButton.disabled = true;
        resetAnimationControls();
        showStatus('loading', t('loadingModel', null, '正在加载模型...'), characterId);
        showProgress(0, 0);
        try {
            await viewer.loadCharacter(characterId);
        } catch (error) {
            console.error(error);
            showStatus('error', t('loadFailed', null, '加载失败'), error?.message || '');
            hideProgress();
            loadButton.disabled = false;
        }
    };
    category.onchange = filterAnimations;
    animation.onchange = () => {
        updateStates();
        playSelection();
    };
    state.onchange = playSelection;
    play.onclick = () => {
        if (!animation.value || !renderer) return;
        playSelection();
    };
    pause.onclick = () => renderer?.pauseAnimation();
    timeline.oninput = () => {
        scrubbing = true;
        renderer?.seekAnimation(Number(timeline.value));
    };
    timeline.onchange = () => {
        scrubbing = false;
        playSelection();
    };
    requestAnimationFrame(updatePlayback);
})();
