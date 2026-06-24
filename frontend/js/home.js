    if (!Auth.isLoggedIn()) {
      Auth.redirectToLogin();
    }

    function fmt(n) { return Number(n).toLocaleString('en-US'); }
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function toast2(msg, type = 'ok', ms = 2400) {
      window.showAlert(t(msg), type === 'err' ? t('error') : 'SEAPIRATES', type === 'err');
    }

    async function fetchPlayer() {
      try {
        const data = await API.get('/player/me');
        Auth.setPlayer(data);
        return data;
      } catch (err) {
        console.error(err);
        return Auth.getPlayer() || {};
      }
    }

    async function fetchLeaderboard() {
      try {
        return await API.get('/player/leaderboard');
      } catch {
        return [];
      }
    }

    async function init() {
      const [playerData, lbData] = await Promise.all([fetchPlayer(), fetchLeaderboard()]);
      if (!playerData) return;
      const myName = playerData.display_name || playerData.username || t('captain');

      document.getElementById('p-name').textContent = myName;
      document.getElementById('p-pearl').textContent = fmt(playerData.pearl || 0);
      document.getElementById('p-gold').textContent = fmt(playerData.gold || 0);
      document.getElementById('p-elp').textContent = fmt(playerData.elite_points || 0);
      document.getElementById('p-lvl').textContent = (playerData.level || 1) + ' ' + t('profile_level');

      const rankIconEl = document.getElementById('p-rank-icon');
      if (rankIconEl) {
        rankIconEl.innerHTML = `<img src="assets/ui/rank/rank${playerData.rankBadge}.png" style="width: 100%; height: 100%; object-fit: contain;" alt="${playerData.rankName}" title="${playerData.rankName}">`;
      }

      const xpNext = playerData.xpNext || 999999999;
      document.getElementById('p-lvl-pct').textContent = fmt(playerData.xp || 0) + ' / ' + fmt(xpNext);
      const pct = Math.min(100, ((playerData.xp || 0) / xpNext) * 100);
      document.getElementById('p-lvl-fill').style.width = pct + '%';

      if (playerData.vip_until) {
        const b = document.getElementById('vip-badge');
        b.className = 'vip-badge on';
        const daysLeft = Math.ceil((new Date(playerData.vip_until) - new Date()) / 86400000);
        b.textContent = daysLeft > 0 ? t('vip_status_on') + ' · ' + daysLeft : t('vip_status_on');
      }

      const body = document.getElementById('lb-body');
      let html = '';
      lbData.forEach((row, i) => {
        const rank = i + 1;
        const rowName = row.display_name || row.name || row.username || '';
        const isMe = rowName === myName || row.id === playerData.id;
        const badge = row.rankBadge || 13;
        const rbClass = badge === 1 ? 'r1' : (badge === 2 || badge === 3) ? 'r2-3' : badge <= 10 ? 'r4-10' : 'r-low';
        const rankName = t('rank_' + badge);

        html += `<div class="lb-row${isMe ? ' me' : ''}">
      <div class="sira">${rank}</div>
      <span class="nick">${esc(rowName)}</span>
      <div class="rutbe-col">
        <span class="rutbe-puan">${fmt(row.score || 0)}</span>
      </div>
      <div class="rutbe-icon ${rbClass}" title="${esc(rankName)}">
        <img src="assets/ui/rank/rank${badge}.png" alt="${esc(rankName)}">
      </div>
    </div>`;
      });

      const inList = lbData.some(r => {
        const rn = r.display_name || r.name || r.username || '';
        return rn === myName || r.id === playerData.id;
      });
      if (!inList) {
        const badge = playerData.rankBadge || 13;
        const rbClass = badge === 1 ? 'r1' : (badge === 2 || badge === 3) ? 'r2-3' : badge <= 10 ? 'r4-10' : 'r-low';
        const rankName = t('rank_' + badge);
        html += `<div class="lb-sep">· · ·</div>
    <div class="lb-row me">
      <div class="sira">—</div>
      <span class="nick">${esc(myName)}</span>
      <div class="rutbe-col">
        <span class="rutbe-puan">${fmt(playerData.score || 0)}</span>
      </div>
      <div class="rutbe-icon ${rbClass}" title="${esc(rankName)}">
        <img src="assets/ui/rank/rank${badge}.png" alt="${esc(rankName)}">
      </div>
    </div>`;
      }

      body.innerHTML = html;
    }

    function modalGoster(id) { document.getElementById(id).classList.add('show'); }
    function modalGizle(id) { document.getElementById(id).classList.remove('show'); }

    let vipPrices = null;
    let vipCurrencies = null;
    let currentCurrency = 'TRY';

    async function fetchVipCurrency() {
      try {
        const [pricesRes, currencyRes] = await Promise.all([
          API.get('/vip/prices'),
          API.get('/vip/currency')
        ]);
        if (!pricesRes || !currencyRes) return;
        vipPrices = pricesRes.prices;
        vipCurrencies = pricesRes.currencies;
        currentCurrency = currencyRes.currency;
      } catch (e) { console.error('VIP fiyat yüklenemedi:', e); }
    }

    function updateVipPrices() {
      const sym = vipCurrencies?.symbols[currentCurrency] || '₺';
      document.querySelectorAll('#vip-modal-home .magaza-card-price').forEach(el => {
        const plan = parseInt(el.dataset.plan);
        if (vipPrices?.[plan]) el.textContent = `${vipPrices[plan][currentCurrency]} ${sym}`;
      });
    }

    const vipBtn = document.getElementById('btn-vip-home');
    const vipModal = document.getElementById('vip-modal-home');
    const vipClose = document.getElementById('btn-close-vip-home');
    if (vipBtn) vipBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetchVipCurrency();
      updateVipPrices();
      modalGoster('vip-modal-home');
    });
    if (vipClose) vipClose.addEventListener('click', () => modalGizle('vip-modal-home'));
    if (vipModal) vipModal.addEventListener('click', (e) => { if (e.target === vipModal) modalGizle('vip-modal-home'); });

    const starterBtn = document.getElementById('btn-starter-home');
    const starterModal = document.getElementById('starter-modal-home');
    const starterClose = document.getElementById('btn-close-starter-home');
    if (starterBtn) starterBtn.addEventListener('click', (e) => { e.preventDefault(); modalGoster('starter-modal-home'); });
    if (starterClose) starterClose.addEventListener('click', () => modalGizle('starter-modal-home'));
    if (starterModal) starterModal.addEventListener('click', (e) => { if (e.target === starterModal) modalGizle('starter-modal-home'); });

    document.querySelectorAll('#vip-modal-home .magaza-card-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const plan = this.dataset.plan;
        const type = this.dataset.type;
        const sym = vipCurrencies?.symbols[currentCurrency] || '₺';
        const price = vipPrices?.[plan]?.[currentCurrency] || '?';
        toast2(`🔒 ${type === 'vip' ? 'VIP' : 'Starter'} "${plan}" gün paket — ${price} ${sym}. Ödeme sistemi yakında!`, 'ok', 3000);
      });
    });

    setInterval(() => {
      API.post('/player/ping').catch(() => {});
    }, 60000);

    init();
