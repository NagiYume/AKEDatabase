(function () {
    'use strict';

    if (window.AKEVoicePlayer) return;

    const AUDIO_HOSTS = Object.freeze([
        'cn.endfield.fffdan.com',
        'cn2.endfield.fffdan.com',
        'endfield-assets.fffdan.com'
    ]);
    const LANGUAGE_PATHS = Object.freeze({
        CH: 'chinese',
        TC: 'chinese',
        EN: 'english',
        JP: 'japanese',
        KR: 'korean'
    });
    const VOICE_LANGUAGES = Object.freeze(['chinese', 'japanese', 'english', 'korean']);
    const LANGUAGE_LABEL_KEYS = Object.freeze({
        chinese: ['voice.languages.chinese', '中文'],
        japanese: ['voice.languages.japanese', '日语'],
        english: ['voice.languages.english', '英语'],
        korean: ['voice.languages.korean', '韩语']
    });
    let activeAudio = null;
    let activeButton = null;
    function readStoredLanguage() {
        try { return localStorage.getItem('akedata-voiceLanguage'); } catch { return null; }
    }
    function storeLanguage(language) {
        try { localStorage.setItem('akedata-voiceLanguage', language); } catch { /* Keep the in-memory selection. */ }
    }
    const storedLanguage = readStoredLanguage();
    let selectedLanguage = VOICE_LANGUAGES.includes(storedLanguage)
        ? storedLanguage
        : (LANGUAGE_PATHS[window.akeI18n?.getLanguage?.() || 'CH'] || 'chinese');

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function audioLanguage() {
        return selectedLanguage;
    }

    function audioUrls(voId) {
        const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:';
        const path = `/audios/dialogs/vo/${audioLanguage()}/${encodeURIComponent(String(voId || ''))}`;
        return AUDIO_HOSTS.map(host => `${protocol}//${host}${path}`);
    }

    function setButtonState(button, state) {
        if (!button) return;
        const playing = state === 'playing';
        button.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;';
        button.setAttribute('aria-pressed', String(playing));
        button.setAttribute('aria-label', button.dataset[playing ? 'pauseLabel' : 'playLabel'] || 'Play voice');
        button.title = state === 'error'
            ? (button.dataset.errorLabel || 'Voice playback failed')
            : (button.dataset[playing ? 'pauseLabel' : 'playLabel'] || 'Play voice');
    }

    function releaseActive() {
        if (activeAudio) {
            activeAudio.pause();
            activeAudio = null;
        }
        setButtonState(activeButton, 'idle');
        activeButton = null;
    }

    function syncLanguageControls() {
        document.querySelectorAll('[data-ake-voice-language]').forEach(button => {
            const active = button.dataset.akeVoiceLanguage === selectedLanguage;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function setLanguage(language) {
        const normalized = String(language || '').toLowerCase();
        if (!VOICE_LANGUAGES.includes(normalized)) return false;
        if (selectedLanguage !== normalized) {
            releaseActive();
            selectedLanguage = normalized;
            storeLanguage(selectedLanguage);
        }
        syncLanguageControls();
        return true;
    }

    function languageControlHtml() {
        const label = window.akeData?.t?.('voice.language', null, '语音语言') || '语音语言';
        const buttons = VOICE_LANGUAGES.map(language => {
            const [key, fallback] = LANGUAGE_LABEL_KEYS[language];
            const text = window.akeData?.t?.(key, null, fallback) || fallback;
            const active = language === selectedLanguage;
            return `<button type="button" class="ake-ui-tabs__button${active ? ' is-active' : ''}" data-ake-voice-language="${language}" aria-pressed="${active}">${escapeHtml(text)}</button>`;
        }).join('');
        return `<div class="ake-ui-tabs" data-variant="segment" data-layout="equal" role="group" aria-label="${escapeHtml(label)}" data-ake-voice-language-control>${buttons}</div>`;
    }

    function toggle(button) {
        const voId = String(button?.dataset?.akeVoiceId || '').trim();
        if (!voId) return;
        if (button === activeButton && activeAudio) {
            if (activeAudio.paused) {
                const audio = activeAudio;
                audio.play().then(() => {
                    if (activeAudio === audio) setButtonState(button, 'playing');
                }).catch(() => {
                    if (activeAudio === audio) setButtonState(button, 'error');
                });
            } else {
                activeAudio.pause();
                setButtonState(button, 'idle');
            }
            return;
        }

        releaseActive();
        const audio = new Audio();
        const urls = audioUrls(voId);
        let sourceIndex = 0;
        let attemptId = 0;
        activeAudio = audio;
        activeButton = button;
        audio.preload = 'none';
        const fail = () => {
            if (activeAudio !== audio) return;
            setButtonState(button, 'error');
            activeAudio = null;
            activeButton = null;
        };
        const trySource = () => {
            if (activeAudio !== audio) return;
            const attempt = ++attemptId;
            audio.src = urls[sourceIndex];
            audio.play().then(() => {
                if (activeAudio === audio && attempt === attemptId) setButtonState(button, 'playing');
            }).catch(error => {
                if (activeAudio !== audio || attempt !== attemptId) return;
                if (error?.name === 'NotAllowedError' || sourceIndex >= urls.length - 1) {
                    fail();
                    return;
                }
                sourceIndex += 1;
                trySource();
            });
        };
        audio.addEventListener('ended', () => {
            if (activeAudio !== audio) return;
            setButtonState(button, 'idle');
            activeAudio = null;
            activeButton = null;
        }, { once: true });
        audio.addEventListener('error', () => {
            if (activeAudio !== audio) return;
            if (sourceIndex >= urls.length - 1) {
                fail();
                return;
            }
            sourceIndex += 1;
            trySource();
        });
        trySource();
    }

    function buttonHtml(voId, labels = {}) {
        if (!voId) return '';
        const playLabel = labels.play || 'Play voice';
        const pauseLabel = labels.pause || 'Pause voice';
        const errorLabel = labels.error || 'Voice playback failed';
        return `<button type="button" class="ake-ui-icon-button" data-ake-voice-id="${escapeHtml(voId)}" data-play-label="${escapeHtml(playLabel)}" data-pause-label="${escapeHtml(pauseLabel)}" data-error-label="${escapeHtml(errorLabel)}" aria-label="${escapeHtml(playLabel)}" title="${escapeHtml(playLabel)}" aria-pressed="false">&#9654;</button>`;
    }

    document.addEventListener('click', event => {
        const languageButton = event.target.closest?.('[data-ake-voice-language]');
        if (languageButton) {
            setLanguage(languageButton.dataset.akeVoiceLanguage);
            return;
        }
        const button = event.target.closest?.('[data-ake-voice-id]');
        if (button) toggle(button);
    });
    window.addEventListener('ake:module-deactivate', releaseActive);

    window.AKEVoicePlayer = {
        buttonHtml,
        languageControlHtml,
        getLanguage: audioLanguage,
        setLanguage,
        stop: releaseActive,
        toggle
    };
})();
