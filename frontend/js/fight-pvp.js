    /* ══════════════════════════════════════════════
       PvP ATTACK API OVERRIDE
    ══════════════════════════════════════════════ */
    ATTACK_API_URL = (window.__API_URL__ || window.location.origin) + '/api/combat/pvp';

    /* ══════════════════════════════════════════════
       PvP NPC SETUP - Sadece npc propert'lerini ayarla
       Görsel işini fight-shared.js refreshHP halletsin
    ══════════════════════════════════════════════ */
    npc.name = localStorage.getItem('sp_current_target_name') || 'Korsan';
    var pvpBasePath = (localStorage.getItem('sp_current_target_img') || 'assets/ships/elitship/default/1.png').replace(/\/\d+\.png$/, '');
    var pvpFullImg = pvpBasePath + '/1.png';
    var pvpDamagedImg = pvpBasePath + '/9.png';

    npc.img = pvpFullImg;
    npc.fullImg = pvpFullImg;
    npc.damagedImg = pvpDamagedImg;
    npc.isPvP = true;
    npc.hp = 30000;
    npc.maxHp = 30000;

    if (npcNameEl) npcNameEl.textContent = npc.name;

    // Override refreshHP - PvP'de scaleX(-1) transform'unu kaldır + yangın pozisyonunu güncelle
    var _origRefreshHP1 = window.refreshHP;
    window.refreshHP = function() {
      if (_origRefreshHP1) _origRefreshHP1();
      if (npc.isPvP) {
        var el = document.getElementById('npc-img');
        if (el) el.style.transform = 'none';
        setTimeout(repositionFires, 50);
      }
    };

    setupWarBg();

    /* ══════════════════════════════════════════════
        START COMBAT (PvP)
    ══════════════════════════════════════════════ */
    async function startCombat() {
      try {
        const res = await fetch(`${ATTACK_API_URL}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ isPvP: true })
        });
        const data = await res.json();
        if (res.ok) {
          player.hp = data.playerHp; player.maxHp = data.playerMaxHp;
          npc.hp = data.npcHp; npc.maxHp = data.npcMaxHp;
          player.cooldownMs = data.playerCooldownMs || 4000;

          if (data.isPvP) {
            if (data.npcName) {
              npc.name = data.npcName;
              document.getElementById('npc-name').textContent = data.npcName;
            }
          }

          // PvP Opponent details (ID and Rank)
          const npcRankLeftEl = document.getElementById('npc-rank-left');
          const npcRankRightEl = document.getElementById('npc-rank-right');
          if (npcRankLeftEl) {
            if (data.pvpOpponentMainRankBadge) {
              npcRankLeftEl.src = `assets/ui/rank/rank${data.pvpOpponentMainRankBadge}.png`;
              npcRankLeftEl.title = data.pvpOpponentMainRankName || '';
              npcRankLeftEl.classList.remove('hidden');
            } else {
              npcRankLeftEl.classList.add('hidden');
            }
          }
          if (npcRankRightEl) {
            if (data.pvpOpponentRankBadge) {
              npcRankRightEl.src = `assets/ui/pvp-badges/${data.pvpOpponentRankBadge}.png`;
              npcRankRightEl.title = data.pvpOpponentRankName || 'Tayfa';
              npcRankRightEl.classList.remove('hidden');
            } else {
              npcRankRightEl.classList.add('hidden');
            }
          }
          const npcPidEl = document.getElementById('npc-pid');
          if (npcPidEl) {
            if (data.pvpOpponentId) {
              npcPidEl.textContent = `#ID:${data.pvpOpponentId}`;
              npcPidEl.style.display = 'block';
            } else {
              npcPidEl.style.display = 'none';
            }
          }

          refreshHP();
          attackInterval = setInterval(doAttack, player.cooldownMs || 4000);
        } else {
          if (data.noCannons) {
            const ncModal = document.getElementById('nocannon-modal');
            if (ncModal) ncModal.style.display = 'flex';
          } else {
            window.showAlert(data.error, t('server_error'), true);
            goTo('map.html');
          }
        }
      } catch (e) { logError('fight-pvp:attack', e); }
    }

    // No-cannon modal buttons
    const ncEquipBtn = document.getElementById('nocannon-goto-equip');
    if (ncEquipBtn) ncEquipBtn.addEventListener('click', () => {
      goTo('equipment.html');
    });
    const ncCloseBtn = document.getElementById('nocannon-close');
    if (ncCloseBtn) ncCloseBtn.addEventListener('click', () => {
      const ncModal = document.getElementById('nocannon-modal');
      if (ncModal) ncModal.style.display = 'none';
      goTo('map.html');
    });

    /* ══════════════════════════════════════════════
       END FIGHT (PvP)
    ══════════════════════════════════════════════ */
    let pvpWon = false;

    function endFight(won, rewards, leveledUp, newLevel, serverHp, note) {
      pvpWon = won;
      active = false;
      if (bossSocket) {
        try { bossSocket.disconnect(); } catch (e) {}
        bossSocket = null;
      }
      if (bossPollInterval) { clearInterval(bossPollInterval); bossPollInterval = null; }

      if (player) {
        let existing = {};
        try { existing = JSON.parse(localStorage.getItem('sp_player') || '{}'); } catch(e) {}
        existing.hp = serverHp !== undefined ? serverHp : player.hp;
        existing.max_hp = player.maxHp || existing.max_hp;
        if (newLevel) existing.level = newLevel;
        localStorage.setItem('sp_player', JSON.stringify(existing));
      }

      const rw = rewards || {};
      const titleEl = document.getElementById('outcome-title');
      const subEl = document.getElementById('outcome-sub');
      const rewardsEl = document.getElementById('outcome-rewards');

      let titleText, subText;

      if (won) {
        titleText = npc.name.toUpperCase();
        subText = t('pvp_victory_msg', { name: npc.name });
      } else {
        titleText = t('pvp_header');
        subText = t('pvp_defeat_msg', { name: npc.name });
      }

      titleEl.textContent = titleText;
      titleEl.className = won ? 'outcome-title win' : 'outcome-title loss';
      subEl.textContent = subText;

      let html = '';
      const bp = rw.pvpPoints !== undefined ? rw.pvpPoints : (won ? 3 : 0);
      const bpSign = bp > 0 ? '+' : '';
      const bpColor = bp > 0 ? '#ffd700' : '#ff6b6b';
      html += `<div class="outcome-reward-row"><span style="font-size:1.1rem;">⚔️</span><span style="color: ${bpColor}; font-weight: bold; font-family: 'Cinzel', serif; font-size: 1.1rem; text-shadow: 0 0 5px rgba(0,0,0,0.5);">${bpSign}${bp} ${t('battle_points')}</span></div>`;

      if (leveledUp) html += `<div class="outcome-lvlup">${t('level_up')} → ${newLevel} LVL</div>`;
      rewardsEl.innerHTML = html;
      setTimeout(() => document.getElementById('outcome').classList.add('show'), 900);
    }

    /* ══════════════════════════════════════════════
       OVERRIDE RETURN: WIN → PvP page, LOSE → map
    ══════════════════════════════════════════════ */
    window.handleReturn = function() {
      localStorage.removeItem('sp_combat_is_tower');
      localStorage.removeItem('sp_combat_tower_id');
      localStorage.removeItem('sp_combat_is_weekly_boss');
      localStorage.removeItem('sp_combat_is_tiamat');
      localStorage.removeItem('sp_combat_is_pvp');
      localStorage.removeItem('sp_boss_dmg_dealt');
      fetch(`${SHARED_API_URL}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }
      }).catch(e => logError('fight-pvp:end', e))
        .finally(() => { sessionStorage.setItem('sp_navigating','1'); window.location.replace(pvpWon ? 'pvp.html' : 'map.html'); });
    };

    function showPage() {
      if (typeof readyNow === 'function') readyNow();
      const page = document.querySelector('.page');
      if (page) page.classList.add('visible');
    }

    startCombat().finally(showPage);
