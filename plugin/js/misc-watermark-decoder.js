(function () {
    'use strict';

    const MODULE_ID = 'watermark_decoder';

    window.AKEMisc.register(MODULE_ID, async function (context) {
        const root = context.root;
        const fileInput = root.querySelector('#miscWatermarkDecoderFile');
        const chooseFileButton = root.querySelector('#miscWatermarkDecoderChooseFile');
        const decodeButton = root.querySelector('#miscWatermarkDecoderDecode');
        const status = root.querySelector('#miscWatermarkDecoderStatus');
        const result = root.querySelector('#miscWatermarkDecoderResult');
        const fields = root.querySelector('#miscWatermarkDecoderFields');
        const empty = root.querySelector('#miscWatermarkDecoderEmpty');
        let selectedFile = null;
        let disposed = false;

        const t = (key, params, fallback) => window.akeI18n?.t(
            `modules.misc.watermarkDecoder.${key}`,
            params,
            fallback
        ) || fallback || key;

        function setStatus(text, state = '') {
            status.textContent = text;
            status.dataset.state = state;
        }

        function selectFile(file, statusKey = 'fileSelected') {
            if (!file || !String(file.type || '').startsWith('image/')) return false;
            selectedFile = file;
            decodeButton.disabled = false;
            result.hidden = true;
            empty.hidden = false;
            setStatus(t(statusKey, null, statusKey === 'pasted' ? '已粘贴图片' : '已选择图片'));
            return true;
        }

        function formatTime(value) {
            const seconds = Number(value);
            if (!Number.isFinite(seconds) || seconds <= 0) return t('unknown', null, '未知');
            return new Intl.DateTimeFormat(
                window.akeI18n?.getLanguageInfo?.().htmlLang || 'zh-CN',
                { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Shanghai' }
            ).format(new Date(seconds * 1000));
        }

        function displayValue(key, value) {
            if (key === 't') return formatTime(value);
            if (key === 's' && Array.isArray(value)) return value.join(', ') || t('unknown', null, '未知');
            if (key === 'u' && !value) return t('anonymous', null, '未获取到用户 ID');
            if (key === 'b' && !value) return t('none', null, '无');
            if (key === 'z' && !value) return t('none', null, '无');
            if (value === undefined || value === null || value === '') return t('unknown', null, '未知');
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }

        function renderMetadata(metadata) {
            const entries = [
                ['t', t('fields.generatedAt', null, '生成时间')],
                ['c', t('fields.characterId', null, '角色 ID')],
                ['g', t('fields.groupId', null, '技能组/节点 ID')],
                ['s', t('fields.skillIds', null, '原始技能 ID')],
                ['q', t('fields.sourceId', null, '选中原始节点/效果 ID')],
                ['l', t('fields.level', null, '技能等级')],
                ['n', t('fields.nodeLevel', null, '节点等级')],
                ['b', t('fields.branch', null, '诀分支')],
                ['z', t('fields.branchValues', null, '诀条件值')],
                ['d', t('fields.dataVersion', null, '数据版本')],
                ['a', t('fields.appVersion', null, '网站版本')],
                ['u', t('fields.userId', null, '用户 ID')],
                ['h', t('fields.templateHash', null, '原始模板指纹')],
                ['e', t('fields.editedHash', null, '编辑后内容指纹')],
                ['r', t('fields.nonce', null, '生成编号')]
            ];
            fields.replaceChildren(...entries
                .filter(([key]) => Object.prototype.hasOwnProperty.call(metadata, key))
                .map(([key, label]) => {
                    const wrapper = document.createElement('div');
                    const term = document.createElement('dt');
                    term.textContent = label;
                    const value = document.createElement('dd');
                    value.textContent = displayValue(key, metadata[key]);
                    wrapper.append(term, value);
                    return wrapper;
                }));
            result.hidden = false;
            empty.hidden = true;
        }

        async function decodeSelectedFile() {
            if (!selectedFile || disposed) return;
            if (!window.AKEWatermark) {
                setStatus(t('failed', null, '水印解析模块未加载'), 'error');
                return;
            }
            setStatus(t('reading', null, '正在读取图片…'), 'loading');
            decodeButton.disabled = true;
            try {
                const url = URL.createObjectURL(selectedFile);
                try {
                    const image = await new Promise((resolve, reject) => {
                        const element = new Image();
                        element.onload = () => resolve(element);
                        element.onerror = () => reject(new Error(t('imageFailed', null, '图片读取失败')));
                        element.src = url;
                    });
                    if (disposed) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = image.naturalWidth || image.width;
                    canvas.height = image.naturalHeight || image.height;
                    const context2d = canvas.getContext('2d', { willReadFrequently: true });
                    if (!context2d || !canvas.width || !canvas.height) throw new Error(t('imageFailed', null, '图片读取失败'));
                    context2d.drawImage(image, 0, 0);
                    const decoded = await window.AKEWatermark.decodeAsync(
                        context2d.getImageData(0, 0, canvas.width, canvas.height)
                    );
                    if (!decoded.ok) throw new Error(t('notFound', null, '未找到可识别的频域水印'));
                    renderMetadata(decoded.metadata);
                    setStatus(t('success', null, '解析完成'), 'ready');
                } finally {
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                if (!disposed) {
                    result.hidden = true;
                    empty.hidden = false;
                    setStatus(error.message, 'error');
                }
            } finally {
                if (!disposed) decodeButton.disabled = !selectedFile;
            }
        }

        context.on(chooseFileButton, 'click', () => fileInput.click());
        context.on(fileInput, 'change', event => {
            selectFile(event.target.files?.[0] || null);
        });
        context.on(document, 'paste', event => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find(item => item.kind === 'file' && String(item.type || '').startsWith('image/'));
            const file = imageItem?.getAsFile?.();
            if (selectFile(file, 'pasted')) event.preventDefault();
        });
        context.on(decodeButton, 'click', () => void decodeSelectedFile());

        return {
            destroy() {
                disposed = true;
                selectedFile = null;
            }
        };
    });
})();
