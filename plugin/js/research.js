(function() {
        const t = window.akeI18n.scope('modules.research');
        const commonT = window.akeI18n.scope('common');
        let allDocs = [];
        let rawAllDocs = [];
        let activeDocId = null;
        let isInitialized = false;
        let searchTerm = '';

        const mobileBtn = document.getElementById('researchMobileListBtn');
        const mobileOverlay = document.getElementById('researchMobileListOverlay');
        const mobileContent = document.getElementById('researchMobileListContent');

        function escapeHtml(text) {
            return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function isItemUnlocked(doc) {
            if (!doc.token) return true;
            return window.akeData && window.akeData.isTokenUnlocked
                ? window.akeData.isTokenUnlocked(doc.token)
                : false;
        }

        function filterDocs(docs) {
            let result = docs.filter(function(d) { return isItemUnlocked(d); });
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                result = result.filter(function(d) {
                    return (d.name && window.AKEModuleSearch.matches(d.name, term)) ||
                           (d.id && window.AKEModuleSearch.matches(d.id, term));
                });
            }
            return result;
        }

        async function loadResearchManifest(showHidden) {
            try {
                const res = await (window.akeFetch || fetch)('/public/CH/research/manifest.json');
                if (!res.ok) throw new Error('无法加载研究文档清单');
                const all = await res.json();
                rawAllDocs = all;
                let docs = showHidden ? all : all.filter(function(d) { return !d.hidden; });
                docs.sort(function(a, b) { return (a.priority || 999) - (b.priority || 999); });
                return docs;
            } catch (err) {
                console.error('加载研究文档清单失败:', err);
                return [];
            }
        }

        function renderResearchOverview(items, container) {
            window.AKEModuleOverview.render(container, {
                title: t('overview.title'), description: t('overview.description'),
                variant: 'text',
                group: function (item) { return { id: item.category || 'research-topic', name: item.category || t('topics.general'), order: item.categoryOrder }; },
                onReset: function () { activeDocId = null; },
                onSelect: function (item) { activeDocId = item.id; renderDocList(); },
                sidebarSelector: function (item) { return '.ake-ui-directory__item[data-doc-id="' + CSS.escape(item.id) + '"]'; },
                items: items.map(function (item) { return { ...item, fallback: t('overview.fallback'), tags: [item.summary] }; })
            });
            var toc = document.getElementById('researchToc');
            if (toc) toc.innerHTML = '';
        }

        function createResearchDirectoryItem(doc, options) {
            options = options || {};
            const item = window.AKEUI.directoryItem({
                layout: 'entity',
                title: doc.name,
                subtitle: doc.summary || doc.id,
                meta: [{ label: doc.category || '', kind: 'research-category' }],
                active: options.active,
                attributes: { 'data-doc-id': doc.id },
                onSelect: options.onSelect
            });
            window.AKEModuleOverview?.markVersionChange(item, doc);
            return item;
        }

        function renderDocList() {
            const container = document.getElementById('researchList');
            const detailContainer = document.getElementById('researchDetail');
            if (!container) return;

            const filtered = filterDocs(allDocs);
            container.innerHTML = '';

            if (filtered.length === 0) {
                container.innerHTML = '<div class="ake-ui-state">' + escapeHtml(searchTerm ? t('empty.noMatches') : t('empty.noDocuments')) + '</div>';
                if (detailContainer) detailContainer.innerHTML = '<div class="ake-ui-state">' + escapeHtml(t('empty.selectDocument')) + '</div>';
                activeDocId = null;
                return;
            }

            filtered.forEach(function(doc) {
                const item = createResearchDirectoryItem(doc, {
                    active: doc.id === activeDocId,
                    onSelect: function() {
                        window.AKEUI.setDirectoryItemActive(container, item);
                        activeDocId = doc.id;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('research', doc.id);
                        loadDocDetail(doc, detailContainer);
                    }
                });

                container.appendChild(item);
            });

            if (window.__deepLinkId) {
                const deepItem = filtered.find(function(d) { return d.id === window.__deepLinkId; });
                if (deepItem) {
                    activeDocId = deepItem.id;
                } else {
                    const existsInRaw = rawAllDocs.some(function(d) { return d.id === window.__deepLinkId; });
                    if (window.__akeRouter && window.__akeRouter.onDeepLinkNotFound) {
                        window.__akeRouter.onDeepLinkNotFound(window.__deepLinkId, existsInRaw);
                    }
                }
                window.__deepLinkId = null;
            }

            const activeExists = filtered.some(function(d) { return d.id === activeDocId; });
            if (!activeExists && filtered.length > 0) {
                activeDocId = null;
                renderResearchOverview(filtered, detailContainer);
            } else if (activeExists) {
                const activeDoc = filtered.find(function(d) { return d.id === activeDocId; });
                if (activeDoc) {
                    const activeItem = container.querySelector('.ake-ui-directory__item[data-doc-id="' + activeDocId + '"]');
                    if (activeItem) window.AKEUI.setDirectoryItemActive(container, activeItem);
                    if (window.__akeRouter) window.__akeRouter.updateUrl('research', activeDocId);
                    loadDocDetail(activeDoc, detailContainer);
                }
            }
        }

        function scrollToHeading(detailEl, targetId) {
            var target = detailEl.querySelector('#' + CSS.escape(targetId));
            if (!target) return;
            detailEl.scrollTo({ top: Math.max(0, target.offsetTop - 10), behavior: 'smooth' });
        }

        var tocObserver = null;

        function buildToc(detailEl) {
            var tocEl = document.getElementById('researchToc');
            if (!tocEl) return;
            var content = detailEl.querySelector('.article-content');
            if (!content) { tocEl.innerHTML = ''; return; }
            var headings = content.querySelectorAll('h1, h2, h3');
            if (headings.length < 2) { tocEl.innerHTML = ''; return; }

            var html = '<div class="ake-ui-toc__title">' + escapeHtml(t('toc.title')) + '</div><nav class="ake-ui-toc__nav">';
            for (var i = 0; i < headings.length; i++) {
                var h = headings[i];
                var level = parseInt(h.tagName.charAt(1), 10);
                var id = h.id;
                var text = h.textContent;
                html += '<a class="ake-ui-toc__link" data-level="' + level + '" href="#' + id + '" data-target="' + id + '">' + escapeHtml(text) + '</a>';
            }
            html += '</nav>';
            tocEl.innerHTML = html;

            tocEl.querySelectorAll('.ake-ui-toc__link').forEach(function(a) {
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    scrollToHeading(detailEl, a.dataset.target);
                });
            });

            if (tocObserver) tocObserver.disconnect();
            var links = tocEl.querySelectorAll('.ake-ui-toc__link');
            var linkMap = {};
            links.forEach(function(l) { linkMap[l.dataset.target] = l; });

            tocObserver = new IntersectionObserver(function(entries) {
                var active = null;
                for (var j = 0; j < entries.length; j++) {
                    if (entries[j].isIntersecting) {
                        active = entries[j].target.id;
                    }
                }
                if (active && linkMap[active]) {
                    links.forEach(function(l) { l.classList.remove('is-active'); });
                    linkMap[active].classList.add('is-active');
                }
            }, { root: detailEl, rootMargin: '-10% 0px -80% 0px', threshold: 0 });

            for (var k = 0; k < headings.length; k++) {
                tocObserver.observe(headings[k]);
            }
        }

        async function loadDocDetail(doc, container) {
            var tocEl = document.getElementById('researchToc');
            if (tocEl) tocEl.innerHTML = '';
            if (!isItemUnlocked(doc)) {
                container.innerHTML = '<div class="not-found-page">' +
                    '<div class="not-found-code">404</div>' +
                    '<div class="not-found-title">' + escapeHtml(t('notFound.title')) + '</div>' +
                    '<div class="not-found-desc">' + escapeHtml(t('notFound.description')) + '</div>' +
                    '</div>';
                return;
            }
            container.innerHTML = '<div class="ake-ui-state" data-state="loading">' + escapeHtml(t('document.loading')) + '</div>';
            try {
                const res = await (window.akeFetch || fetch)(doc.contentFile);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const mdText = await res.text();
                const fragment = await window.akeRenderMarkdown(mdText, doc.contentFile);
                if (activeDocId !== doc.id) return;
                container.innerHTML = '<div class="research-article"><div class="article-content"></div></div>';
                container.querySelector('.article-content').replaceChildren(fragment);
                container.scrollTop = 0;
                container.querySelectorAll('.anchor-link').forEach(function(a) {
                    a.addEventListener('click', function(e) {
                        e.preventDefault();
                        var targetId = a.getAttribute('href').substring(1);
                        scrollToHeading(container, targetId);
                    });
                });
                buildToc(container);
                container.querySelectorAll('.md-img').forEach(function(img) {
                    img.addEventListener('click', function() {
                        var lightbox = document.getElementById('imgLightbox');
                        var lightboxImg = lightbox ? lightbox.querySelector('.img-lightbox-img') : null;
                        if (lightbox && lightboxImg) {
                            lightboxImg.src = img.src;
                            lightboxImg.alt = img.alt;
                            lightbox.classList.add('is-open');
                        }
                    });
                });
            } catch (err) {
                if (activeDocId !== doc.id) return;
                container.innerHTML = '<div class="ake-ui-state" data-state="error">' + escapeHtml(t('document.loadFailed', { message: err.message })) + '</div>';
            }
        }

        function buildMobileList() {
            if (!mobileContent) return;
            const filtered = filterDocs(allDocs);
            mobileContent.innerHTML = '';
            if (filtered.length === 0) {
                mobileContent.innerHTML = '<div class="ake-ui-state">' + escapeHtml(searchTerm ? t('empty.noMatches') : t('empty.noDocuments')) + '</div>';
                return;
            }
            filtered.forEach(function(doc) {
                const item = createResearchDirectoryItem(doc, {
                    active: doc.id === activeDocId,
                    onSelect: function() {
                        activeDocId = doc.id;
                        if (window.__akeRouter) window.__akeRouter.updateUrl('research', doc.id);
                        loadDocDetail(doc, document.getElementById('researchDetail'));
                        closeMobileList();
                        var desktopList = document.getElementById('researchList');
                        var activeItem = desktopList && desktopList.querySelector('.ake-ui-directory__item[data-doc-id="' + CSS.escape(doc.id) + '"]');
                        if (activeItem) window.AKEUI.setDirectoryItemActive(desktopList, activeItem);
                    }
                });
                mobileContent.appendChild(item);
            });
        }

        function openMobileList() {
            buildMobileList();
            if (mobileOverlay) {
                mobileOverlay.classList.add('is-open');
                mobileOverlay.setAttribute('aria-hidden', 'false');
            }
        }

        function closeMobileList() {
            if (mobileOverlay) {
                mobileOverlay.classList.remove('is-open');
                mobileOverlay.setAttribute('aria-hidden', 'true');
            }
        }

        async function refreshModule() {
            var list = document.getElementById('researchList');
            var detail = document.getElementById('researchDetail');
            if (!list || !detail) return;
            list.innerHTML = '<div class="ake-ui-state" data-state="loading" data-density="compact">' + escapeHtml(t('loading')) + '</div>';
            if (!activeDocId) detail.innerHTML = '<div class="ake-ui-state" data-state="loading" data-layout="page">' + escapeHtml(commonT('loadingData')) + '</div>';
            var showHidden = (window.akeData && window.akeData.getConfig) ? window.akeData.getConfig().showHidden : false;
            var docs = await loadResearchManifest(showHidden);
            allDocs = docs;
            renderDocList();
            if (mobileOverlay && mobileOverlay.classList.contains('is-open')) buildMobileList();
        }

        async function initModule() {
            if (isInitialized) return;
            isInitialized = true;
            if (window.configLoaded) await window.configLoaded;

            window.addEventListener('globalConfigChanged', function() {
                searchTerm = '';
                var searchInput = document.getElementById('researchSearchInput');
                if (searchInput) searchInput.value = '';
                refreshModule();
            });

            var searchInput = document.getElementById('researchSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    searchTerm = e.target.value;
                    renderDocList();
                    if (mobileOverlay && mobileOverlay.classList.contains('is-open')) buildMobileList();
                });
            }

            if (mobileBtn) mobileBtn.addEventListener('click', openMobileList);
            if (mobileOverlay) mobileOverlay.addEventListener('click', function(e) {
                if (e.target === mobileOverlay) closeMobileList();
            });

            var lightbox = document.getElementById('imgLightbox');
            var lightboxImg = lightbox ? lightbox.querySelector('.img-lightbox-img') : null;
            var lightboxClose = lightbox ? lightbox.querySelector('.img-lightbox-close') : null;
            if (lightbox && lightboxClose) {
                lightboxClose.addEventListener('click', function() { lightbox.classList.remove('is-open'); });
                lightbox.addEventListener('click', function(e) {
                    if (e.target === lightbox) lightbox.classList.remove('is-open');
                });
            }

            var tocToggleBtn = document.getElementById('tocToggleBtn');
            var tocPanel = document.getElementById('researchToc');
            if (tocToggleBtn && tocPanel) {
                tocToggleBtn.addEventListener('click', function() {
                    var isOpen = tocPanel.classList.toggle('is-open');
                    tocToggleBtn.classList.toggle('is-open', isOpen);
                });
                document.addEventListener('click', function(e) {
                    if (tocPanel.classList.contains('is-open') && !tocPanel.contains(e.target) && e.target !== tocToggleBtn) {
                        tocPanel.classList.remove('is-open');
                        tocToggleBtn.classList.remove('is-open');
                    }
                });
            }

            await refreshModule();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModule);
        } else {
            initModule();
        }
    })();
