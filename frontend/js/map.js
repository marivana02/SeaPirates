    // NPC isimlerinden asset dosya anahtarına dönüşüm (oyun verisi içermez, sadece resim yolu için)
    function getNpcFrontKey(name) {
      const map = {
        'Blackpearl': 'blackpearl', 'Rackham': 'rackham', 'Calicos Jack': 'calicosJack',
        'Wild 13': 'wild13', 'Red Korsar': 'red korsar', 'Ratpack': 'ratpack',
        'Sinclares Men': 'sinclaresmen', 'Tortuga Gang': 'tortugagang', 'Los Renegados': 'losrenegados',
        'Calocosmen': 'calocosmen', 'Morgansbuccaneers': 'morgansbuccaneers',
        'Flyingdutchman': 'flyingdutchman', 'Kiliwallis': 'kiliwallis',
        'Kilimatu': 'kilimatu', 'Kokelua': 'kokelua', 'Kiribati': 'kiribati'
      };
      return map[name] || 'default';
    }

    // State variables
    var player = { level: 1, gold: 0, pearl: 0, elite_points: 0, tier: 1, xp: 0, hp: 10000, max_hp: 10000, username: "Korsan", rankBadge: 13, rankName: "Kara Korsan" };
    var currentMapLevel = 1;
    var currentMapSub = 1;
    var mapNpcs = {};
    var mapBoss = null;
    var foundNpc = null;
    var bossRewardsCache = null; // { rank: { pearls, ammo } }
    var tiamatAvailable = false;
    var tiamatRespawnAt = null;

    const ROOT = window.__API_URL__ || '';

    var uiLocked = false;
    var isRepairing = false;
    var repairInterval = null;

    const btnSearch = document.getElementById('btn-search');

    function getNpcInfoPanel() {
      return document.getElementById('npc-info-panel');
    }

    function fmt(n) { return Number(n||0).toLocaleString('en-US'); }

    function toast(msg, duration = 2500) {
      window.showAlert(msg, 'SEAPIRATES', false);
    }

    function setUiLocked(locked) {
      uiLocked = locked;
      
      const btnSearchEl = document.getElementById('btn-search');
      if (btnSearchEl) {
        btnSearchEl.disabled = locked;
        btnSearchEl.style.opacity = locked ? '0.6' : '1';
        btnSearchEl.style.cursor = locked ? 'not-allowed' : 'pointer';
      }

      const prevMapBtn = document.getElementById('btn-prev-map');
      const nextMapBtn = document.getElementById('btn-next-map');
      if (prevMapBtn) {
        prevMapBtn.style.pointerEvents = locked ? 'none' : 'auto';
        prevMapBtn.style.opacity = locked ? '0.5' : '1';
      }
      if (nextMapBtn) {
        nextMapBtn.style.pointerEvents = locked ? 'none' : 'auto';
        nextMapBtn.style.opacity = locked ? '0.5' : '1';
      }

      const actionCards = document.querySelectorAll('.action-card');
      actionCards.forEach(card => {
        card.style.pointerEvents = locked ? 'none' : 'auto';
        card.style.opacity = locked ? '0.5' : '1';
      });

      const stackBtns = document.querySelectorAll('.stack-btn');
      stackBtns.forEach(btn => {
        btn.style.pointerEvents = locked ? 'none' : 'auto';
        btn.style.opacity = locked ? '0.5' : '1';
      });
    }

    // Helper functions for map coordinate math
    function getPrevMap(level, sub) {
      if (level === 1 && sub === 1) return null;
      if (sub === 2) {
        return { level, sub: 1 };
      } else {
        const prevLvl = level - 1;
        const prevSub = (prevLvl <= 4) ? 2 : 1;
        return { level: prevLvl, sub: prevSub };
      }
    }

    function getNextMap(level, sub) {
      if (level === 10 && sub === 1) return null;
      if (level <= 4 && sub === 1) {
        return { level, sub: 2 };
      } else {
        const nextLvl = level + 1;
        return { level: nextLvl, sub: 1 };
      }
    }

    // Map Navigation UI updates
    function updateMapNavigationButtons() {
      const prev = getPrevMap(currentMapLevel, currentMapSub);
      const btnPrev = document.getElementById('btn-prev-map');
      if (prev) {
        btnPrev.style.visibility = 'visible';
        btnPrev.innerHTML = `◀ ${t('page_map')} ${prev.level}-${prev.sub}`;
        btnPrev.className = 'nav-arrow-btn';
        btnPrev.onclick = () => doChangeMap(prev.level, prev.sub, btnPrev);
      } else {
        btnPrev.style.visibility = 'hidden';
      }

      document.getElementById('lbl-current-map').innerText = `${currentMapLevel}-${currentMapSub}`;

      const next = getNextMap(currentMapLevel, currentMapSub);
      const btnNext = document.getElementById('btn-next-map');
      if (next) {
        btnNext.style.visibility = 'visible';
        if (next.level > player.level) {
          btnNext.innerHTML = `${t('page_map')} ${next.level}-${next.sub} 🔒`;
          btnNext.className = 'nav-arrow-btn locked';
          btnNext.onclick = () => toast(`🔒 ${t('level_required')}${next.level}`, 3000);
        } else {
          btnNext.innerHTML = `${t('page_map')} ${next.level}-${next.sub} ▶`;
          btnNext.className = 'nav-arrow-btn';
          btnNext.onclick = () => doChangeMap(next.level, next.sub, btnNext);
        }
      } else {
        btnNext.style.visibility = 'hidden';
      }
    }

    // Call map change API with 5 seconds lock
    async function doChangeMap(targetLevel, targetSub, btn) {
      if (uiLocked) return;
      if (isRepairing) stopRepair();

      setUiLocked(true);

      let countdown = 5;
      const origText = btn.innerHTML;
      btn.innerHTML = `⏳ ${countdown}`;
      const countInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) btn.innerHTML = `⏳ ${countdown}`;
      }, 1000);

      setTimeout(async () => {
        clearInterval(countInterval);
        const token = localStorage.getItem('sp_token');
        try {
          const res = await fetch(ROOT + '/api/maps/change', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetLevel, targetSub })
          });
          const d = await res.json();
          if (d.success) {
            currentMapLevel = targetLevel;
            currentMapSub = targetSub;
            localStorage.setItem('sp_current_map', currentMapLevel);
            const ip = getNpcInfoPanel(); if (ip) ip.style.display = 'none';
            foundNpc = null;
            setupIsland(currentMapLevel);
            await fetchMapNpcs();
            updateMapNavigationButtons();
            checkAdmiralSpawns();
          } else {
            toast(d.error || t('map_change_failed'), 3000);
            updateMapNavigationButtons();
          }
        } catch(e) {
          console.error("Change map failed, running fallback", e);
          currentMapLevel = targetLevel;
          currentMapSub = targetSub;
          localStorage.setItem('sp_current_map', currentMapLevel);
          const ip2 = getNpcInfoPanel(); if (ip2) ip2.style.display = 'none';
          foundNpc = null;
          setupIsland(currentMapLevel);
          updateMapNavigationButtons();
          checkAdmiralSpawns();
        } finally {
          setUiLocked(false);
        }
      }, 5000);
    }

    function byId(id) { return document.getElementById(id); }

    function drawStats() {
      const el = (id) => byId(id);
      const setText = (id, txt) => { const e = el(id); if (e) e.innerText = txt; };
      const setStyle = (id, prop, val) => { const e = el(id); if (e) e.style[prop] = val; };
      const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };

      setText('p-gold', fmt(player.gold));
      setText('p-pearl', fmt(player.pearl));
      setText('p-elp', fmt(player.elite_points || player.elp || 0));
      setText('p-name', player.display_name || player.username || t('captain'));

      const badgeId = player.rankBadge || 13;
      setHtml('p-rank-box', `<img src="assets/ui/rank/rank${badgeId}.png" alt="${player.rankName || 'Rank'}" title="${player.rankName || 'Rank'}" />`);

      const vipB = document.getElementById('vip-badge');
      if (vipB) {
        if (player.vip_until) {
          vipB.className = 'vip-badge on';
          const daysLeft = Math.ceil((new Date(player.vip_until) - new Date()) / 86400000);
          vipB.textContent = daysLeft > 0 ? 'VIP · ' + daysLeft + ' ' + t('daily_day') : '👑 VIP';
        } else {
          vipB.className = 'vip-badge off';
          vipB.textContent = t('vip_status_off');
        }
      }

      const pct = Math.max(0, Math.min(100, (player.hp / player.max_hp) * 100));
      const hpBar = el('p-hp-bar');
      if (hpBar) {
        hpBar.style.width = pct + '%';
        hpBar.className = 'hp-bar-fill';
        if (pct <= 25) hpBar.classList.add('critical');
        else if (pct <= 50) hpBar.classList.add('low');
        else if (pct <= 75) hpBar.classList.add('medium');
      }
      setText('p-hp-text', `${fmt(player.hp)} / ${fmt(player.max_hp)} HP`);

      const xpNext = player.xpNext || 8000;
      setText('p-lvl-lbl', `${player.level} LVL`);
      const xpPct = Math.max(0, Math.min(100, (player.xp / xpNext) * 100));
      setStyle('p-lvl-fill', 'width', xpPct + '%');
      setText('p-lvl-pct', `${fmt(player.xp)} / ${fmt(xpNext)}`);

      updateRepairButton();
      updatePvpLock();
      updateQuestIcon();
    }

    function updateRepairButton() {
      const btn = document.getElementById('btn-tamir');
      if (!btn) return;
      const full = player.hp >= player.max_hp;
      btn.disabled = full;
      if (full) {
        btn.innerHTML = "✅ " + t('btn_repair');
      } else if (!isRepairing) {
        btn.innerHTML = "🔨 " + t('btn_repair');
      }
    }

    function setupIsland(mapLvl) {
      const island = document.getElementById('island-bg');
      if (!island) return;
      
      const islandFiles = {
        1: { src: 'assets/effects/island/images/1_tile_57.png', bottom: '80px', left: '5px', w: '120px' },
        2: { src: 'assets/effects/island/images/2_tile_56.png', bottom: '80px', right: '5px', w: '120px' },
        3: { src: 'assets/effects/island/images/3_tile_55.png', bottom: '100px', left: '5px', w: '120px' },
        4: { src: 'assets/effects/island/images/4_tile_54.png', bottom: '80px', right: '5px', w: '130px' },
        5: { src: 'assets/effects/island/images/5_tile_53.png', bottom: '80px', right: '5px', w: '130px' },
        6: { src: 'assets/effects/island/images/6_tile_52.png', bottom: '80px', left: '5px', w: '120px' },
        7: { src: 'assets/effects/island/images/1_tile_51.png', bottom: '90px', right: '5px', w: '120px' },
        8: { src: 'assets/effects/island/images/2_tile_50.png', bottom: '80px', left: '5px', w: '130px' },
        9: { src: 'assets/effects/island/images/3_tile_49.png', bottom: '80px', right: '5px', w: '120px' },
        10: { src: 'assets/effects/island/images/4_tile_48.png', bottom: '80px', left: '5px', w: '130px' }
      };
      
      const cfg = islandFiles[mapLvl];
      if (cfg) {
        island.src = cfg.src;
        island.style.display = 'block';
        island.style.width = cfg.w;
        island.style.top = 'auto';
        island.style.bottom = 'auto';
        island.style.left = 'auto';
        island.style.right = 'auto';
        if (cfg.top) island.style.top = cfg.top;
        if (cfg.bottom) island.style.bottom = cfg.bottom;
        if (cfg.left) island.style.left = cfg.left;
        if (cfg.right) island.style.right = cfg.right;
      } else {
        island.style.display = 'none';
      }
    }

    // Fetch active NPCs for the current map
    async function fetchMapNpcs() {
      const token = localStorage.getItem('sp_token');
      try {
        const res = await fetch(ROOT + '/api/maps/npcs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        mapNpcs = d.npcs || {};
        mapBoss = d.bossData || null;
      } catch(e) {
        console.error("Failed to fetch NPCs from server", e);
        mapNpcs = {};
        mapBoss = null;
      }
    }

    var knownAdmiralSpawns = new Set();
    var admiralNotifTimer = null;
    var admiralSpawnsInitialized = false;

    // Check for NEW admiral spawns within ±1 map
    async function checkAdmiralSpawns() {
      const token = localStorage.getItem('sp_token');
      if (!token) return;
      try {
        const res = await fetch(ROOT + '/api/maps/admiral-spawns', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const spawns = data.spawns || [];
        const relevant = spawns.filter(s => Math.abs(parseInt(s.map_level) - currentMapLevel) <= 1);
        const el = document.getElementById('admiral-notif');
        if (!el) return;

        // First call: just populate known set, don't show notifications
        if (!admiralSpawnsInitialized) {
          knownAdmiralSpawns = new Set(spawns.map(s => `${s.map_level}-${s.spawned_sub_map}`));
          admiralSpawnsInitialized = true;
          return;
        }

        // Find newly appeared spawns
        const newSpawns = relevant.filter(s => !knownAdmiralSpawns.has(`${s.map_level}-${s.spawned_sub_map}`));
        // Update known set with all current spawns
        knownAdmiralSpawns = new Set(spawns.map(s => `${s.map_level}-${s.spawned_sub_map}`));

        if (newSpawns.length > 0) {
          el.style.display = 'block';
          el.innerHTML = '⚓ ' + newSpawns.map(s => `Harita ${s.map_level}-${s.spawned_sub_map}'de ${s.name} göründü!`).join('<br>⚓ ');
          if (admiralNotifTimer) clearTimeout(admiralNotifTimer);
          admiralNotifTimer = setTimeout(() => { el.style.display = 'none'; }, 20000);
        }
      } catch (e) {
        console.error('Admiral spawn check failed:', e);
      }
    }

    // Fetch live backend player metrics via JWT
    async function loadData() {
      const token = localStorage.getItem('sp_token');
      if (!token) return;

      // Aktif savaş kontrolü
      try {
        const activeRes = await fetch(ROOT + '/api/combat/active', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          if (activeData.active) {
            // Temizlik yapalım
            ['sp_combat_is_tower', 'sp_combat_tower_id', 'sp_combat_is_weekly_boss', 'sp_combat_is_tiamat', 'sp_combat_is_pvp', 'sp_current_target_name', 'sp_current_target_img'].forEach(k => localStorage.removeItem(k));
            
            localStorage.setItem('sp_current_map', activeData.mapLevel || 1);
            if (activeData.isWeeklyBoss) {
              localStorage.setItem('sp_combat_is_weekly_boss', 'true');
            } else if (activeData.isTiamat) {
              localStorage.setItem('sp_combat_is_tiamat', 'true');
            } else if (activeData.isTower) {
              localStorage.setItem('sp_combat_is_tower', 'true');
              localStorage.setItem('sp_combat_tower_id', activeData.towerId);
            } else if (activeData.isPvP) {
              localStorage.setItem('sp_combat_is_pvp', 'true');
              localStorage.setItem('sp_current_target_name', activeData.npcName || 'Rakip');
              localStorage.setItem('sp_current_target_img', activeData.fullImg || 'assets/ships/elitship/default/7.png');
              goTo('fight-pvp.html');
              return;
            } else if (activeData.isAdmiral) {
              localStorage.setItem('sp_current_target_name', activeData.npcName || 'Amiral');
              localStorage.setItem('sp_current_target_img', activeData.fullImg || '');
            } else {
              localStorage.setItem('sp_current_target_name', activeData.npcName || 'Canavar');
              
              // NPC resim yolunu isimden belirle
              const mapLvl = activeData.mapLevel || 1;
              const frontKey = getNpcFrontKey(activeData.npcName);
              const imgUrl = `assets/ships/npcc/map${mapLvl}/${frontKey}.swf/images/7.png`;
              localStorage.setItem('sp_current_target_img', imgUrl);
            }
            goTo('fight.html');
            return;
          }
        }
      } catch (e) {
        console.error("Aktif savaş kontrolü başarısız:", e);
      }

      try {
        const res = await fetch(ROOT + '/api/player/panel', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        const d = await res.json();
        if (d.success) {
          player = d.player;
        }
      } catch(e) {
        console.error("Player loading failed, loading mock fallback", e);
        let savedPlayer = {};
        try { savedPlayer = JSON.parse(localStorage.getItem('sp_player') || '{}'); } catch(e2) {}
        player = {
          username: savedPlayer.username || "Korsan_Kaptan",
          level: savedPlayer.level || 2,
          gold: savedPlayer.gold || 450000,
          pearl: savedPlayer.pearl || 1400,
          elite_points: savedPlayer.elite_points || 4501908,
          tier: 1, xp: savedPlayer.xp || 4620,
          xpNext: savedPlayer.xpNext || 8000,
          hp: savedPlayer.hp || 5800,
          max_hp: savedPlayer.max_hp || 14500,
          rankBadge: savedPlayer.rankBadge || 13,
          vip_until: savedPlayer.vip_until || null,
          activeQuestId: null,
          activeQuestId2: null,
          hasActiveQuest: false,
          hasRedeemableQuest: false,
          questsAvailable: true
        };
      }
      updatePvpLock();
      updateQuestIcon();

      // Fetch map position separately so a failure here doesn't lose player data
      try {
        const mapRes = await fetch(ROOT + '/api/maps', { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        const mData = await mapRes.json();
        currentMapLevel = mData.currentMapLevel || 1;
        currentMapSub = mData.currentMapSub || 1;
        tiamatAvailable = mData.tiamatAvailable || false;
        tiamatRespawnAt = mData.tiamatRespawnAt || null;
      } catch(e) {
        console.error("Map loading failed, using saved/default", e);
        currentMapLevel = parseInt(localStorage.getItem('sp_current_map')) || 1;
        currentMapSub = currentMapLevel <= 4 ? 1 : 1;
      }

      drawStats();
      setupIsland(currentMapLevel);
      localStorage.setItem('sp_current_map', currentMapLevel);
      await fetchMapNpcs();
      updateMapNavigationButtons();
      updateTiamatButton();
      checkAdmiralSpawns();
      setInterval(checkAdmiralSpawns, 15000);

      // Trigger ambient sound
      const audio = document.getElementById('audio-sea');
      if (audio) {
        audio.volume = 0.15;
        if (localStorage.getItem('sp_setting_sound') !== 'false') {
          audio.play().catch(err => {});
        } else {
          audio.pause();
        }
      }
    }

    // "NPC ARA" click handler (3-second delay, locks UI, picks NPC)
    if (!btnSearch) console.error('btn-search element not found');
    else btnSearch.addEventListener('click', async () => {
      if (uiLocked && !foundNpc) return;
      if (isRepairing) stopRepair();

      // Top kontrolü — top yoksa NPC aranamaz
      const token = localStorage.getItem('sp_token');
      try {
        const checkRes = await fetch(ROOT + '/api/player/cannons/check', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkData = await checkRes.json();
        if (!checkData.hasCannons) {
          document.getElementById('nocannon-modal').style.display = 'flex';
          return;
        }
      } catch(e) {
        // API hatasında search'e izin ver
      }

      const keys = Object.keys(mapNpcs);
      if (keys.length === 0) {
        toast(t('search_failed'));
        return;
      }

      setUiLocked(true);
      btnSearch.classList.add('searching');
      let countdown = 3;
      btnSearch.innerText = `${t('searching')} (${countdown})`;

      const countInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) btnSearch.innerText = `${t('searching')} (${countdown})`;
      }, 1000);

      setTimeout(() => {
        clearInterval(countInterval);
        const roll = Math.random() * 100;
        let selectedNpc = null;
        let frontKey = '';

        if (mapBoss !== null && Math.random() < 0.15) {
          selectedNpc = mapBoss;
          frontKey = 'boss';
        } else {
          if (roll < 45) {
            frontKey = keys[0];
            selectedNpc = mapNpcs[frontKey];
          } else if (roll < 80) {
            frontKey = keys[1] || keys[0];
            selectedNpc = mapNpcs[frontKey];
          } else {
            frontKey = keys[2] || keys[1] || keys[0];
            selectedNpc = mapNpcs[frontKey];
          }
        }

        if (!selectedNpc) {
          btnSearch.innerText = t('btn_search');
          btnSearch.classList.remove('searching');
          setUiLocked(false);
          return;
        }

        foundNpc = {
          id: Math.floor(Math.random() * 9000) + 1,
          name: selectedNpc.name,
          hp: selectedNpc.hp,
          damage: selectedNpc.damage,
          gold: selectedNpc.gold || 0,
          pearl: selectedNpc.pearl || 0,
          xp: selectedNpc.xp || 0,
          isBoss: !!selectedNpc.isAdmiral,
          frontKey: frontKey,
          tier: selectedNpc.tier || (selectedNpc.isAdmiral ? 3 : 1),
          img: selectedNpc.isAdmiral ? selectedNpc.img : `assets/ships/npcc/map${currentMapLevel}/${frontKey || 'default'}.swf/images/7.png`
        };

        const nameEl = document.getElementById('npc-panel-name');
        nameEl.innerText = foundNpc.name;
        nameEl.className = foundNpc.isBoss ? "npc-name-text boss" : "npc-name-text";

        document.getElementById('npc-panel-img').src = foundNpc.img;
        document.getElementById('npc-panel-hp').innerText = `${fmt(foundNpc.hp)} HP`;
        document.getElementById('npc-panel-dmg').innerText = `${fmt(foundNpc.damage)} ${t('lbl_damage')}`;

        const lootBox = document.getElementById('npc-panel-loot-box');
        lootBox.innerHTML = '';
        if (foundNpc.gold > 0) {
          lootBox.innerHTML += `<div class="loot-item"><img src="assets/ui/gold.png" class="loot-icon" /> <span class="loot-val gold">${fmt(foundNpc.gold)}</span></div>`;
        }
        if (foundNpc.pearl > 0) {
          lootBox.innerHTML += `<div class="loot-item"><img src="assets/ui/pearl.png" class="loot-icon" /> <span class="loot-val pearl">${fmt(foundNpc.pearl)}</span></div>`;
        }
        if (foundNpc.xp > 0) {
          lootBox.innerHTML += `<div class="loot-item"><span class="loot-star">⭐</span> <span class="loot-val">${fmt(foundNpc.xp)} XP</span></div>`;
        }
        if (lootBox.innerHTML === '') lootBox.innerText = t('lbl_loot_none');

        const ip3 = getNpcInfoPanel(); if (ip3) ip3.style.display = 'flex';
        
        btnSearch.innerText = "NPC ARA";
        btnSearch.classList.remove('searching');
        // Only search + attack buttons enabled, everything else locked
        setNpcFoundLocked();

        const audio = document.getElementById('audio-sea');
        if (audio && audio.paused && localStorage.getItem('sp_setting_sound') !== 'false') {
          audio.play().catch(e => {});
        }
      }, 3000);
    });

    function setNpcFoundLocked() {
      // Re-enable only the search button and attack button
      const btnSearchEl = document.getElementById('btn-search');
      if (btnSearchEl) {
        btnSearchEl.disabled = false;
        btnSearchEl.style.opacity = '1';
        btnSearchEl.style.cursor = 'pointer';
      }
      const btnSalEl = document.getElementById('btn-saldır-trigger');
      if (btnSalEl) {
        btnSalEl.disabled = false;
        btnSalEl.style.opacity = '1';
        btnSalEl.style.cursor = 'pointer';
        btnSalEl.style.pointerEvents = 'auto';
      }
    }

    function closeNoCannon() {
      document.getElementById('nocannon-modal').style.display = 'none';
    }
    document.addEventListener('DOMContentLoaded', () => {
      const ncEquipBtn = document.getElementById('nocannon-goto-equip');
      if (ncEquipBtn) ncEquipBtn.addEventListener('click', () => goTo('equipment.html'));
      const ncCloseBtn = document.getElementById('nocannon-close');
      if (ncCloseBtn) ncCloseBtn.addEventListener('click', closeNoCannon);
    });

    // Start normal NPC battle
    let admiralWarningResolve = null;

    function showAdmiralWarning(playerLevel, mapLevel) {
      return new Promise(resolve => {
        const modal = document.getElementById('admiral-warning-modal');
        const textEl = document.getElementById('admiral-warning-text');
        if (!modal || !textEl) { resolve(true); return; }
        textEl.innerHTML = `<div style="margin-bottom:6px;">💰 <span data-i18n="reward_warning_line1">Bu harita artık sana fazla kolay.</span></div>
          <div><span data-i18n="reward_warning_line2">Yeni oyuncuların güçlenmesine izin verebilirsin.</span></div>
          <div style="margin-top:10px;color:var(--txt-d);font-size:0.7rem;">${t('lvl')} ${playerLevel} → ${t('map')} ${mapLevel}</div>`;
        modal.style.display = 'flex';
        admiralWarningResolve = resolve;
      });
    }

    // Admiral warning modal button handlers
    const admWarnClose = document.getElementById('btn-close-admiral-warning');
    const admWarnCancel = document.getElementById('btn-admiral-warning-cancel');
    const admWarnContinue = document.getElementById('btn-admiral-warning-continue');
    function closeAdmiralWarning(result) {
      const modal = document.getElementById('admiral-warning-modal');
      if (modal) modal.style.display = 'none';
      if (admiralWarningResolve) { admiralWarningResolve(result); admiralWarningResolve = null; }
    }
    if (admWarnClose) admWarnClose.addEventListener('click', () => closeAdmiralWarning(false));
    if (admWarnCancel) admWarnCancel.addEventListener('click', () => closeAdmiralWarning(false));
    if (admWarnContinue) admWarnContinue.addEventListener('click', () => closeAdmiralWarning(true));

    const btnSal = document.getElementById('btn-saldır-trigger');
    if (btnSal) btnSal.addEventListener('click', async () => {
      if (!foundNpc) return;
      if (isRepairing) stopRepair();
      
      if (foundNpc.isBoss && (foundNpc.name || '').startsWith('Admiral') && currentMapLevel <= 5) {
        const pLevel = player.level || 1;
        if (pLevel >= 10) {
          const proceed = await showAdmiralWarning(pLevel, currentMapLevel);
          if (!proceed) return;
        }
      }
      
      localStorage.setItem('sp_current_map', currentMapLevel);
      localStorage.setItem('sp_current_target_name', foundNpc.name);
      localStorage.setItem('sp_current_target_img', foundNpc.img);
      localStorage.setItem('sp_current_target_hp', foundNpc.hp);
      localStorage.setItem('sp_current_target_maxHp', foundNpc.hp);
      localStorage.setItem('sp_current_target_dmg', foundNpc.damage);
      localStorage.setItem('sp_current_target_gold', foundNpc.gold);
      localStorage.setItem('sp_current_target_pearl', foundNpc.pearl);
      localStorage.setItem('sp_current_target_xp', foundNpc.xp);
      localStorage.setItem('sp_current_target_tier', foundNpc.tier);

      goTo(`fight.html?npcId=${foundNpc.id}&map=${currentMapLevel}&submap=${currentMapSub}`);
    });

    // Weekly Boss Modal Triggers
    const bossModal = document.getElementById('boss-modal');
    
    async function loadBossLeaderboard() {
      // Cache weekly boss rewards from server
      if (!bossRewardsCache) {
        try {
          const token = localStorage.getItem('sp_token');
          const r = await fetch(ROOT + '/api/combat/boss-rewards', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          bossRewardsCache = await r.json();
        } catch(e) {
          console.error('Failed to fetch boss rewards:', e);
          bossRewardsCache = {};
        }
      }

      const listEl = document.getElementById('boss-ranking-list');
      const infoEl = document.getElementById('boss-modal-status-info');
      const atkBtn = document.getElementById('btn-boss-saldır-real');
      
      listEl.innerHTML = `<div class="boss-ranking-empty">${t('ranking_loading')}</div>`;
      
      const token = localStorage.getItem('sp_token');
      try {
        const res = await fetch(ROOT + '/api/combat/boss/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        // Update status info
        const canAttack = data.canAttack;
        const myDmg = data.weeklyDamage || 0;
        
        let cdText = '';
        if (data.countdownDays > 0) {
          cdText = data.countdownDays + 'd ' + data.countdownHours + 'h';
        } else {
          cdText = data.countdownHours + 'h';
        }
        let statusHtml = t('daily_boss_attack', { countdown: cdText });
        if (myDmg > 0) {
          statusHtml += `<br>🎯 ${t('lbl_damage')}: <b class="boss-my-dmg">${fmt(myDmg)}</b>`;
        }
        if (!canAttack) {
          statusHtml += `<br><span class="boss-attack-done">${t('boss_already_attacked')}</span>`;
        }
        infoEl.innerHTML = statusHtml;
        
        // Update attack button
        if (!canAttack) {
          atkBtn.disabled = true;
          atkBtn.innerHTML = '❌ ' + t('already_attacked');
        } else {
          atkBtn.disabled = false;
          atkBtn.innerHTML = '<img src="assets/ui/actionmenu/attack.png" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;">' + t('text_attack');
        }
        
        // Render leaderboard
        const lb = data.leaderboard || [];
        
        // Always show at least 10 rows to keep top 10 rewards visible, and up to 100 rows
        const totalRowsToShow = Math.max(10, Math.min(100, lb.length));
        
        let html = `
          <div class="boss-ranking-header" style="display: grid; grid-template-columns: 1.5fr 1fr 1.7fr; align-items: center; font-weight: 700; color: var(--gold-p); border-bottom: 1px solid rgba(200, 150, 42, 0.3); padding-bottom: 6px; margin-bottom: 6px; font-size: 0.65rem;">
            <div>🏴‍☠️ ${t('top_pirates')}</div>
            <div style="text-align: right; padding-right: 6px;">🎯 ${t('lbl_damage')}</div>
            <div style="text-align: right;">🏆 ${t('reward_header')}</div>
          </div>
        `;
        
        for (let idx = 0; idx < totalRowsToShow; idx++) {
          const rank = idx + 1;
          let rankClass = '';
          let dmgColor = 'var(--txt)';
          if (rank === 1) { rankClass = 'boss-rank-1'; dmgColor = 'var(--gold-b)'; }
          else if (rank === 2) { rankClass = 'boss-rank-2'; dmgColor = '#c0c0c0'; }
          else if (rank === 3) { rankClass = 'boss-rank-3'; dmgColor = '#cd7f32'; }
          
          const entry = lb[idx];
          const username = entry ? (entry.username || '???') : '—';
          const dmg = entry ? parseInt(entry.weekly_boss_damage || 0) : 0;
          const dmgText = entry ? fmt(dmg) : '—';
          
          let rewardHtml = '';
          if (rank <= 10) {
            const rw = bossRewardsCache[rank] || {};
            const pearls = rw.pearls || 0;
            const ammo = rw.ammo || 0;
            
            const pearlFormatted = pearls.toLocaleString('en-US');
            const ammoFormatted = ammo.toLocaleString('en-US');
            
            rewardHtml = `
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 0.62rem;">
                <span style="display: inline-flex; align-items: center; gap: 1px; color: #a78bfa; font-weight: 600;">
                  <img src="assets/ui/pearl.png" style="width: 10px; height: 10px; vertical-align: middle;">${pearlFormatted}
                </span>
                <span style="color: #f97316; font-weight: 500;">
                  ${t('boss_weekly_reward', { ammo: ammoFormatted })}
                </span>
              </div>
            `;
          } else {
            rewardHtml = `<div style="color: var(--txt-d); font-size: 0.65rem; text-align: right; padding-right: 10px;">-</div>`;
          }
          
          html += `<div class="boss-ranking-item">
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px;">
              <span class="boss-rank-badge ${rankClass}">${rank}.</span> ${username}
            </div>
            <div style="color: ${entry ? dmgColor : 'var(--txt-d)'}; font-weight: 600; text-align: right; padding-right: 6px;">${dmgText}</div>
            ${rewardHtml}
          </div>`;
        }
        listEl.innerHTML = html;
      } catch(e) {
        console.error('Boss leaderboard fetch failed:', e);
        infoEl.innerHTML = '⚠️ ' + t('connection_failed');
        listEl.innerHTML = `<div class="boss-ranking-empty" style="color:var(--gold);">${t('ranking_error')}</div>`;
      }
    }
    
    const btnBossTrigger = document.getElementById('btn-weekly-boss-trigger');
    if (btnBossTrigger) btnBossTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (uiLocked) return;
      if (isRepairing) stopRepair();
      bossModal.style.display = 'flex';
      loadBossLeaderboard();
    });

    const btnCloseBoss = document.getElementById('btn-close-boss-modal');
    if (btnCloseBoss) btnCloseBoss.addEventListener('click', () => {
      bossModal.style.display = 'none';
    });

    const btnBossSal = document.getElementById('btn-boss-saldır-real');
    if (btnBossSal) btnBossSal.addEventListener('click', () => {
      if (btnBossSal.disabled) return;
      bossModal.style.display = 'none';
      localStorage.setItem('sp_combat_is_weekly_boss', 'true');
      setTimeout(() => {
        goTo('fight.html');
      }, 800);
    });

    // TIAMAT MODAL
    const tiamatModal = document.getElementById('tiamat-modal');
    
    function updateTiamatButton() {
      const btn = document.getElementById('btn-tiamat-trigger');
      if (!btn) return;
      btn.style.display = (currentMapLevel === 10 && tiamatAvailable) ? 'flex' : 'none';
    }

    const btnTiamatTrigger = document.getElementById('btn-tiamat-trigger');
    if (btnTiamatTrigger) btnTiamatTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (uiLocked) return;
      if (isRepairing) stopRepair();
      tiamatModal.style.display = 'flex';
    });

    const btnCloseTiamat = document.getElementById('btn-close-tiamat-modal');
    if (btnCloseTiamat) btnCloseTiamat.addEventListener('click', () => {
      tiamatModal.style.display = 'none';
    });

    const btnTiamatSal = document.getElementById('btn-tiamat-saldir');
    if (btnTiamatSal) btnTiamatSal.addEventListener('click', () => {
      tiamatModal.style.display = 'none';
      localStorage.setItem('sp_combat_is_tiamat', 'true');
      localStorage.setItem('sp_current_map', currentMapLevel);
      setTimeout(() => {
        goTo('fight.html');
      }, 800);
    });

    function updateQuestIcon() {
      const img = document.querySelector('#btn-quest-trigger img.action-card-icon');
      if (!img) return;
      let src;
      if (player.hasRedeemableQuest) {
        src = 'assets/ui/ikon/images/4_quest_indicator_redeemable.png';
      } else if (player.hasActiveQuest) {
        src = 'assets/ui/ikon/images/3_quest_indicator_not_yet_redeemable.png';
      } else if (player.questsAvailable === false) {
        src = 'assets/ui/ikon/images/1_quest_indicator_not_available.png';
      } else {
        src = 'assets/ui/ikon/images/6_quest_indicator_available.png';
      }
      if (img.src.indexOf(src) === -1) {
        img.src = src;
      }
    }

    // PVP ARENA REDIRECT
    const btnPvpTrigger = document.getElementById('btn-pvp-trigger');
    const pvpLockOverlay = document.getElementById('pvp-lock-overlay');
    function updatePvpLock() {
      if (!btnPvpTrigger || !pvpLockOverlay) return;
      const locked = (player.level || 0) < 10;
      btnPvpTrigger.classList.toggle('locked', locked);
      pvpLockOverlay.style.display = locked ? '' : 'none';
    }
    if (btnPvpTrigger) {
      btnPvpTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (uiLocked) return;
        if ((player.level || 0) < 10) return;
        if (isRepairing) stopRepair();
        goTo('pvp.html');
      });
    }

    // Repair action functions with ticking / sounds / GDD alignment
    var repairCooldown = null;

    function stopRepair() {
      if (!isRepairing) return;
      clearInterval(repairInterval);
      repairInterval = null;
      isRepairing = false;

      const audRepair = document.getElementById('audio-repair');
      if (audRepair) {
        audRepair.loop = false;
        audRepair.pause();
        audRepair.currentTime = 0;
      }
      updateRepairButton();

      setRepairCooldown();
    }

    async function startRepair() {
      if (uiLocked) return;
      if (player.hp >= player.max_hp) return;
      if (isRepairing) return;

      isRepairing = true;
      const btn = document.getElementById('btn-tamir');
      if (btn) btn.innerHTML = "🔧 " + t('btn_stop_repair');

      const audRepair = document.getElementById('audio-repair');
      if (audRepair && localStorage.getItem('sp_setting_sound') !== 'false') {
        audRepair.volume = 0.25;
        audRepair.loop = true;
        audRepair.play().catch(e => {});
      }

      await doRepairStep();
      
      if (isRepairing && player.hp < player.max_hp) {
        repairInterval = setInterval(async () => {
          await doRepairStep();
        }, 500);
      }
    }

    async function doRepairStep() {
      if (!isRepairing) return;

      const token = localStorage.getItem('sp_token');
      try {
        const res = await fetch(ROOT + '/api/player/repair', { 
          method: 'POST', 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        const d = await res.json();
        if (!isRepairing) return;
        if (d.hp !== undefined) {
          player.hp = d.hp;
          player.max_hp = d.max_hp;
          drawStats();
          if (d.full || d.hp >= d.max_hp) {
            clearInterval(repairInterval);
            repairInterval = null;
            isRepairing = false;
            
            const btn = document.getElementById('btn-tamir');
            if (btn) btn.innerHTML = "🔨 " + t('btn_repair');

            const audRepair = document.getElementById('audio-repair');
            if (audRepair) {
              audRepair.loop = false;
              audRepair.pause();
              audRepair.currentTime = 0;
            }

            setRepairCooldown();
          }
        } else {
          stopRepair();
          toast(t('repair_failed'));
        }
      } catch(e) {
        stopRepair();
        toast(t('repair_connection_error'));
      }
    }

    function setRepairCooldown() {
      if (repairCooldown) clearTimeout(repairCooldown);
      repairCooldown = setTimeout(() => { repairCooldown = null; }, 2000);
    }

    const btnTamir = document.getElementById('btn-tamir');
    if (btnTamir) btnTamir.addEventListener('click', () => {
      if (btnTamir.disabled || repairCooldown) return;
      if (isRepairing) {
        stopRepair();
        setRepairCooldown();
      } else {
        startRepair();
        setRepairCooldown();
      }
    });

    // Check last battle results
    localStorage.removeItem('sp_lastBattle');

    // Clean up stale combat state from previous sessions
    ['sp_current_target_name','sp_current_target_img','sp_current_target_hp','sp_current_target_maxHp','sp_current_target_dmg','sp_current_target_gold','sp_current_target_pearl','sp_current_target_xp','sp_current_target_tier','sp_combat_is_weekly_boss','sp_combat_is_pvp','sp_combat_is_tiamat'].forEach(k => localStorage.removeItem(k));

    loadData();
    (function () {
      const cfg = [
        { p: 'assets/effects/DefineSprite_19_bird', f: 9, t: 'bird' },
        { p: 'assets/effects/DefineSprite_31_albatross', f: 15, t: 'bird' },
        { p: 'assets/effects/DefineSprite_27_dolphin4', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_54_dolphin3', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_81_dolphin2', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_108_dolphin1', f: 13, t: 'fish' }
      ];
      const layer = document.createElement('div');
      layer.style.cssText = 'position:absolute; inset:0; z-index:2; pointer-events:none; overflow:hidden;';
      const page = document.querySelector('.page') || document.body;
      page.appendChild(layer);

      function spawn() {
        if (localStorage.getItem('sp_setting_graphics') === 'false') return;
        if (Math.random() > 0.75) return;
        const c = cfg[Math.floor(Math.random() * cfg.length)];
        const img = document.createElement('img');
        img.style.position = 'absolute';
        img.style.width = c.t === 'bird' ? '30px' : '70px';
        img.style.height = c.t === 'bird' ? '30px' : '70px';
        img.style.objectFit = 'contain';
        img.style.opacity = '0';
        img.style.filter = 'drop-shadow(0 8px 8px rgba(0,0,0,0.5))';

        let flyRight = Math.random() > 0.5;
        let startX = c.t === 'bird' ? (flyRight ? -50 : 450) : (Math.random() * 350 - 20);
        let startY = c.t === 'bird' ? (Math.random() * 500 + 100) : (Math.random() * 150 + 350);

        let moveX = c.t === 'bird' ? (flyRight ? 520 : -520) : 0;
        let moveY = c.t === 'bird' ? ((Math.random() - 0.5) * 160) : 0;

        let duration = c.t === 'bird' ? 8000 : 1600;

        img.style.transition = `opacity 0.6s, transform ${duration}ms linear`;
        img.style.left = startX + 'px';
        img.style.top = startY + 'px';

        let scale = moveX < 0 ? 'scaleX(-1)' : 'scaleX(1)';

        let angle = 0;
        if (c.t === 'bird') {
          angle = Math.atan2(moveY, Math.abs(moveX)) * (180 / Math.PI);
          angle = angle * 0.5;
        }
        let rotate = c.t === 'bird' ? ` rotate(${angle}deg)` : '';

        img.style.transform = scale + rotate;
        layer.appendChild(img);

        let frame = 1;
        img.src = `${c.p}/${frame}.png`;

        setTimeout(() => {
          img.style.opacity = c.t === 'fish' ? '0.95' : '0.90';
          img.style.transform = `translate(${moveX}px, ${moveY}px) ${scale}${rotate}`;
        }, 50);

        let frameInterval = c.t === 'bird' ? 100 : 130;
        const anim = setInterval(() => {
          frame++;
          if (frame > c.f) {
            if (c.t === 'fish') {
              clearInterval(anim);
              return;
            }
            frame = 1;
          }
          img.src = `${c.p}/${frame}.png`;
        }, frameInterval);

        setTimeout(() => {
          img.style.opacity = '0';
          setTimeout(() => {
            clearInterval(anim);
            if (img.parentNode) img.parentNode.removeChild(img);
          }, 600);
        }, duration - 600);
      }

      setInterval(spawn, 2000);
      setTimeout(spawn, 500);
    })();
