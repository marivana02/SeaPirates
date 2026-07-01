    /* ══════════════════════════════════════════════
       PvE STATE VARS
    ══════════════════════════════════════════════ */
    isWeeklyBoss = localStorage.getItem('sp_combat_is_weekly_boss') === 'true';
    isTowerMode = localStorage.getItem('sp_combat_is_tower') === 'true';
    isTiamat = localStorage.getItem('sp_combat_is_tiamat') === 'true';
    const towerId = parseInt(localStorage.getItem('sp_combat_tower_id')) || 1;
    const TOWERS_LOAD = {
       1: { name: 'Tower (Lvl 1)', img: 'assets/enemies/tower/low1.png', damaged: 'assets/enemies/tower/low2.png' },
       2: { name: 'Tower (Lvl 2)', img: 'assets/enemies/tower/low3.png', damaged: 'assets/enemies/tower/low4.png' },
       3: { name: 'Tower (Lvl 3)', img: 'assets/enemies/tower/middle1.png', damaged: 'assets/enemies/tower/middle2.png' },
       4: { name: 'Tower (Lvl 4)', img: 'assets/enemies/tower/middle3.png', damaged: 'assets/enemies/tower/middle4.png' },
       5: { name: 'Tower (Lvl 5)', img: 'assets/enemies/tower/hard1.png', damaged: 'assets/enemies/tower/hard2.png' }
    };
    const tInit = TOWERS_LOAD[towerId] || TOWERS_LOAD[1];

    npc.name = isWeeklyBoss ? 'Efsanevi Leviathan' : (isTiamat ? 'Tiamat' : (isTowerMode ? tInit.name : (localStorage.getItem('sp_current_target_name') || 'Korsan')));
    npc.img = isWeeklyBoss ? 'assets/ui/weekly_boss.png' : (isTiamat ? 'assets/enemies/tiamat/sprite-256px-36_1.webp' : (isTowerMode ? tInit.img : (localStorage.getItem('sp_current_target_img') || 'assets/ships/npcc/map1/1/7.png')));
    npc.hp = isWeeklyBoss ? 999999999 : (isTiamat ? 12000000 : 30000);
    npc.maxHp = isWeeklyBoss ? 999999999 : (isTiamat ? 12000000 : 30000);

    /* Init */
    if (npcNameEl) npcNameEl.textContent = npc.name;

    if (npc.img) {
      let src = npc.img;
      if (!isWeeklyBoss && (src.includes('/images/') || src.includes('elitship/'))) {
        src = src.replace(/\/\d+\.png$/, '/1.png');
      }
      if (!isWeeklyBoss && !src.includes('assets/ships/npcc/') && src.includes('npcc/')) src = 'assets/' + src;

      const npcImgEl = document.getElementById('npc-img');
      if (npcImgEl) {
        npcImgEl.onload = repositionFires;
        npcImgEl.src = src;
        if (isTowerMode) {
          npcImgEl.style.maxWidth = '90px';
          npcImgEl.style.maxHeight = '90px';
          npc.isTower = true;
          npc.fullImg = tInit.img;
          npc.damagedImg = tInit.damaged;
        } else if (isWeeklyBoss) {
          npcImgEl.style.maxWidth = '280px';
          npcImgEl.style.maxHeight = '280px';
          npcImgEl.style.mixBlendMode = 'normal';
          npcImgEl.style.filter = 'drop-shadow(0 15px 30px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 15px rgba(231, 76, 60, 0.35))';

          const npcWrapEl = document.querySelector('.npc-wrap');
          if (npcWrapEl) {
            npcWrapEl.style.right = '10px';
            npcWrapEl.style.transform = 'none';
            npcWrapEl.style.top = '25px';
            const npcInfoEl = npcWrapEl.querySelector('.ship-info');
            if (npcInfoEl) {
              npcInfoEl.classList.add('boss-decor');
            }
          }
        } else if (npc.name && npc.name.toLowerCase().includes('admiral')) {
          npcImgEl.style.maxWidth = '135px';
          npcImgEl.style.maxHeight = '135px';
          npcImgEl.style.mixBlendMode = 'normal';
          npcImgEl.style.filter = 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 10px rgba(240, 192, 64, 0.35))';

          const npcWrapEl = document.querySelector('.npc-wrap');
          if (npcWrapEl) {
            npcWrapEl.style.right = '20px';
            npcWrapEl.style.top = '35px';
            const npcInfoEl = npcWrapEl.querySelector('.ship-info');
            if (npcInfoEl) {
              npcInfoEl.classList.add('boss-decor');
            }
          }
        } else if (isTiamat) {
          npcImgEl.style.display = 'none';
          const npcWrapEl = document.querySelector('.npc-wrap');
          if (npcWrapEl) {
            npcWrapEl.style.right = '0px';
            npcWrapEl.style.top = '35px';
            npcWrapEl.style.left = 'auto';
            const npcInfoEl = npcWrapEl.querySelector('.ship-info');
            if (npcInfoEl) {
              npcInfoEl.classList.add('boss-decor');
            }
          }
          startTiamatAnimation(npcImgEl, src);
        }
      }
    }

    /* ══════════════════════════════════════════════
       START COMBAT (PvE)
    ══════════════════════════════════════════════ */
    async function startCombat() {
      try {
        const mapLvl = parseInt(localStorage.getItem('sp_current_map')) || 1;
        const isTower = localStorage.getItem('sp_combat_is_tower') === 'true';

        let payload;
        if (isWeeklyBoss) {
          setupIsland('weeklyboss');
          payload = { isWeeklyBoss: true };
        } else if (isTiamat) {
          setupIsland('tiamat');
          payload = { isTiamat: true, mapLevel: mapLvl };
        } else if (isTower) {
          setupIsland('tower');
          payload = { isTower: true, towerId: towerId };
        } else {
          setupIsland(mapLvl);
          payload = { mapLevel: mapLvl, npcName: npc.name };
        }

        const res = await fetch(`${ATTACK_API_URL}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          player.hp = data.playerHp; player.maxHp = data.playerMaxHp;
          npc.hp = data.npcHp; npc.maxHp = data.npcMaxHp;
          player.cooldownMs = data.playerCooldownMs || 4000;
          if (isTiamat) player.cooldownMs = 3000;

          if (!isWeeklyBoss && data.isTower && data.fullImg) {
            npc.isTower = true;
            npc.fullImg = data.fullImg;
            npc.damagedImg = data.damagedImg;
            if (data.npcName) {
              npc.name = data.npcName;
              document.getElementById('npc-name').textContent = data.npcName;
            }
            const npcImgEl = document.getElementById('npc-img');
            if (npcImgEl) {
              npcImgEl.src = data.fullImg;
              npcImgEl.style.maxWidth = '90px';
              npcImgEl.style.maxHeight = '90px';
            }
          }

          refreshHP();
          attackInterval = setInterval(doAttack, player.cooldownMs || 4000);

          if (data.isAdmiral) {
            document.getElementById('admiral-leaderboard').style.display = 'block';
            startAdmiralStatusTracking();
          }

          if (isWeeklyBoss) {
            document.getElementById('boss-timer').style.display = 'flex';
            let bossTimeLeft = 60;
            const bossTimerValEl = document.getElementById('boss-timer-val');

            const timerInterval = setInterval(() => {
              if (!active) {
                clearInterval(timerInterval);
                return;
              }
              bossTimeLeft--;
              bossTimerValEl.textContent = bossTimeLeft;

              if (bossTimeLeft <= 0) {
                clearInterval(timerInterval);
                clearInterval(attackInterval);
                fetch(`${SHARED_API_URL}/end`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                }).catch(e => logError('fight-pve:end', e))
                  .finally(() => endFight(true));
              }
            }, 1000);
          }
        } else {
          if (data.noCannons) {
            const ncModal = document.getElementById('nocannon-modal');
            if (ncModal) ncModal.style.display = 'flex';
          } else {
            window.showAlert(data.error, t('server_error'), true);
            goTo(isTower ? 'tower.html' : 'map.html');
          }
        }
      } catch (e) { logError('fight-pve:attack', e); }
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
       END FIGHT (PvE)
    ══════════════════════════════════════════════ */
    function endFight(won, rewards, leveledUp, newLevel, serverHp, note) {
      active = false;
      if (bossSocket) {
        try {
          const room = isTiamat ? 0 : (parseInt(localStorage.getItem('sp_current_map')) || 1);
          bossSocket.emit('leave:boss', room);
          bossSocket.disconnect();
        } catch (e) {}
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

      const isTower = localStorage.getItem('sp_combat_is_tower') === 'true';
      const isAdmiral = npc.name && npc.name.toLowerCase().includes('admiral');
      let titleText, subText;

      if (isWeeklyBoss) {
        titleText = t('combat_timer');
        subText = t('weekly_boss_title');
      } else if (isTiamat && won) {
        titleText = t('victory');
        subText = 'Tiamat ' + t('victory');
      } else if (!won) {
        titleText = t('defeat');
        subText = t('pvp_defeat_msg', { name: npc.name });
      } else if (won) {
        if (isTower) { titleText = t('victory'); subText = t('daily_tower_title'); }
        else if (isAdmiral) { titleText = t('victory'); subText = npc.name || 'Admiral'; }
        else { titleText = t('victory'); subText = t('pvp_victory_msg', { name: npc.name }); }
      }

      titleEl.textContent = titleText;
      titleEl.className = won ? 'outcome-title win' : 'outcome-title loss';
      subEl.textContent = subText;

      if (!won) {
        rewardsEl.innerHTML = '';
      } else {
        let html = '';

        if (isWeeklyBoss) {
          const bossDmg = Number(localStorage.getItem('sp_boss_dmg_dealt') || 0);
          html += '<div class="outcome-reward-row"><span style="font-weight:700;color:#ff6b6b;">' + bossDmg.toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US') + ' ' + t('rank_score') + '</span></div>';
        } else {
          const hasAny = rw.gold > 0 || rw.pearl > 0 || rw.xp > 0;
          if (note) html += `<div class="outcome-empty" style="font-size:0.85rem;line-height:1.3">${note}</div>`;
          else if (!hasAny) html += `<div class="outcome-empty">${t('no_bids_yet')}</div>`;
          if (rw.gold > 0) html += '<div class="outcome-reward-row"><img src="assets/ui/gold.png" /><span class="r-gold">+' + fmt(rw.gold) + '</span></div>';
          if (rw.pearl > 0) html += '<div class="outcome-reward-row"><img src="assets/ui/pearl.png" /><span class="r-pearl">+' + fmt(rw.pearl) + '</span></div>';
          if (rw.xp > 0) html += '<div class="outcome-reward-row"><span style="font-size:1.1rem;">⭐</span><span class="r-xp">+' + fmt(rw.xp) + ' XP</span></div>';
        }
        if (leveledUp) html += `<div class="outcome-lvlup">${t('level_up')} → ${newLevel} LVL</div>`;
        rewardsEl.innerHTML = html;
      }
      setTimeout(() => document.getElementById('outcome').classList.add('show'), 900);
    }

    function showPage() {
      const page = document.querySelector('.page');
      if (page) setTimeout(() => page.classList.add('visible'), 350);
    }

    startCombat().finally(showPage);
