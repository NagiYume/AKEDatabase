(function () {
    const sponsorGrid = document.getElementById('sponsorGrid');
    const sponsorCard = document.getElementById('sponsorCard');
    if (!sponsorGrid || !sponsorCard) return;

    const t = window.akeI18n.scope('modules.about.sponsor');
    const language = window.akeI18n.getLanguage();
    const changelog = document.getElementById('aboutChangelog');
    if (changelog && language !== 'CH' && language !== 'TC') {
        changelog.href = 'https://github.com/NagiYume/AKEDatabase/blob/main/public/EN/tip.md';
    }

    const versionLabel = document.getElementById('aboutVersion');
    const version = window.__akeBootstrapVersion?.appversion;
    if (versionLabel && version) {
        versionLabel.textContent = window.akeI18n.t('modules.about.introduction.version', { version });
        versionLabel.hidden = false;
    }

    async function loadSponsors() {
        try {
            const response = await (window.akeFetch || fetch)('/public/CH/about/sponsors.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const records = await response.json();
            if (!Array.isArray(records)) throw new Error('Invalid sponsor list');

            const sponsors = records.filter(record => !record.languages || record.languages.includes(language));
            if (!sponsors.length) {
                window.AKEUI.setState(sponsorGrid, { state: 'empty', density: 'compact', message: t('empty') });
                return;
            }
            sponsors.sort((a, b) => {
                const amountDifference = Number(b.money.replace(/^CNY\s+/, '')) - Number(a.money.replace(/^CNY\s+/, ''));
                return amountDifference || (b.time || '').localeCompare(a.time || '');
            });
            sponsorGrid.replaceChildren(...sponsors.map(renderSponsor));
        } catch (error) {
            console.error('加载赞助列表失败:', error);
            window.AKEUI.setState(sponsorGrid, { state: 'error', density: 'compact', message: t('loadFailed') });
        }
    }

    function renderSponsor(sponsor) {
        const card = sponsorCard.content.firstElementChild.cloneNode(true);
        card.querySelector('.ake-about__sponsor-name').textContent = sponsor.name;
        const amount = card.querySelector('.ake-about__sponsor-amount');
        amount.textContent = sponsor.money;
        amount.dataset.rarity = sponsor.rarity || 1;
        const date = card.querySelector('time');
        if (sponsor.time) {
            date.dateTime = sponsor.time;
            date.textContent = sponsor.time;
        } else {
            date.remove();
        }
        const method = card.querySelector('.ake-about__sponsor-method');
        if (sponsor.method) method.textContent = t(`payment.${sponsor.method}`, null, sponsor.method);
        else method.remove();
        card.querySelector('.ake-about__sponsor-remark').textContent = sponsor.content || t('noRemarks');
        return card;
    }

    loadSponsors();
})();
