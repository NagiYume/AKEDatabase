import DOMPurify from './vendor/dompurify-3.5.0/purify.es.mjs';

const markedModule = () => import('https://cdn.jsdelivr.net/npm/marked@18.3.0/lib/marked.esm.js')
    .catch(() => import('./vendor/marked-18.3.0/marked.esm.js'));
const highlightModule = () => import('https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/highlight.min.js')
    .catch(() => import('./vendor/highlight-11.12.0/highlight.min.js'));

function slugify(text) {
    return text.replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().replace(/\s+/g, '-').toLowerCase();
}

function decodeFragment(hash) {
    try { return decodeURIComponent(hash); } catch { return hash; }
}

export async function renderMarkdown(source, documentUrl, headingPrefix = 'heading-') {
    const { marked } = await markedModule();
    const html = marked.parse(source, { gfm: true, async: false });
    const fragment = DOMPurify.sanitize(html, {
        RETURN_DOM_FRAGMENT: true,
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'pre', 'code',
            'blockquote', 'ul', 'ol', 'li', 'input', 'em', 'strong', 'del', 'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'sup', 'sub'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'align', 'start', 'class', 'type', 'checked', 'disabled'],
        ALLOW_DATA_ATTR: false
    });
    const base = new URL(documentUrl, location.href);
    const ids = new Set();
    for (const heading of fragment.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        const stem = headingPrefix + (slugify(heading.textContent) || 'section');
        let id = stem;
        let n = 1;
        while (ids.has(id)) id = stem + '-' + n++;
        heading.id = id;
        ids.add(id);
    }

    for (const element of fragment.querySelectorAll('a[href], img[src]')) {
        const isImage = element.tagName === 'IMG';
        const attribute = isImage ? 'src' : 'href';
        const raw = element.getAttribute(attribute);
        if (!isImage && raw.startsWith('#')) {
            const target = decodeFragment(raw.slice(1));
            element.setAttribute('href', '#' + (ids.has(target) ? target : headingPrefix + slugify(target)));
            element.classList.add('anchor-link');
            continue;
        }
        try {
            // Existing research articles refer to site assets as public/images/...
            const url = new URL(raw.startsWith('public/') ? '/' + raw : raw, base);
            if (!['http:', 'https:'].includes(url.protocol) && !(url.protocol === 'mailto:' && !isImage)) {
                element.removeAttribute(attribute);
                continue;
            }
            element.setAttribute(attribute, url.href);
            if (isImage) element.classList.add('md-img');
            else {
                element.target = '_blank';
                element.rel = 'noopener noreferrer';
            }
        } catch {
            element.removeAttribute(attribute);
        }
    }
    fragment.querySelectorAll('input').forEach(input => {
        if (input.type === 'checkbox') input.disabled = true;
        else input.remove();
    });
    fragment.querySelectorAll('table').forEach(table => table.classList.add('ake-ui-table'));
    fragment.querySelectorAll('th[align], td[align]').forEach(cell => { cell.dataset.align = cell.getAttribute('align'); });
    fragment.querySelectorAll(':not(pre) > code').forEach(code => code.classList.add('inline-code'));

    const blocks = fragment.querySelectorAll('pre > code');
    if (blocks.length) {
        const { default: hljs } = await highlightModule();
        for (const code of blocks) {
            code.parentElement.classList.add('code-block');
            const language = code.className.match(/\blanguage-([^\s]+)/)?.[1].toLowerCase();
            if (language && (!hljs.getLanguage(language) || ['plain', 'text', 'plaintext'].includes(language))) continue;
            const text = code.textContent;
            const highlighted = language ? hljs.highlight(text, { language, ignoreIllegals: true }) : hljs.highlightAuto(text);
            code.innerHTML = highlighted.value;
            code.classList.add('hljs');
        }
    }
    return fragment;
}
