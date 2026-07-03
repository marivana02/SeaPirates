/* ─── SeaPirates — Helpers ─── */
(function () {
  'use strict';

  window.goTo = function (url) {
    if (!url || url === '#' || url.startsWith('javascript:')) return;
    sessionStorage.setItem('sp_navigating', '1');
    window.location.href = url;
  };

  window.showAlert = function (message, title = 'SEAPIRATES', isError = false) {
    let alertOverlay = document.getElementById('sp-alert-modal');
    if (!alertOverlay) {
      alertOverlay = document.createElement('div');
      alertOverlay.id = 'sp-alert-modal';
      alertOverlay.className = 'sp-alert-overlay';
      alertOverlay.innerHTML = `
        <div class="sp-alert-card">
          <div class="sp-alert-header" id="sp-alert-title">☠️ SEAPIRATES</div>
          <div class="sp-alert-body" id="sp-alert-text"></div>
          <div class="sp-alert-footer">
            <button class="sp-alert-btn" id="sp-alert-close-btn"></button>
          </div>
        </div>
      `;
      document.body.appendChild(alertOverlay);

      const closeBtn = document.getElementById('sp-alert-close-btn');
      closeBtn.textContent = typeof t === 'function' ? t('modal_close') : 'TAMAM';
      closeBtn.addEventListener('click', function () {
        alertOverlay.classList.remove('show');
      });
      alertOverlay.addEventListener('click', function (e) {
        if (e.target === alertOverlay) {
          alertOverlay.classList.remove('show');
        }
      });
    }

    const titleEl = document.getElementById('sp-alert-title');
    const textEl = document.getElementById('sp-alert-text');

    titleEl.innerHTML = (isError ? '⚠️ ' : '⚓ ') + title.toUpperCase();
    textEl.innerHTML = message;
    alertOverlay.classList.add('show');
  };

  /* Kalp atışı (1sn) — sp_session_ts her zaman tazele (auth.js olmayan sayfalar için de) */
  setInterval(function() {
    var now = Date.now();
    sessionStorage.setItem('sp_hb_time', now.toString());
    if (localStorage.getItem('sp_token')) {
      localStorage.setItem('sp_session_ts', now.toString());
    }
  }, 1000);

  /* Ping (60sn) — sunucu last_seen güncelle + sp_session_ts yenile */
  setInterval(function() {
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) return;
    API.post('/player/ping').then(function() {
      if (typeof Auth.touch === 'function') Auth.touch();
    }).catch(function() {});
  }, 60000);

  /* İNTERNET KESİNTİSİ — offline olunca 30sn sayaç, dolunca logout */
  var _offlineTimer = null;
  var _offlineCountdown = 30;
  function startOfflineTimer() {
    if (_offlineTimer) return;
    _offlineCountdown = 30;
    showToast(t('offline_toast').replace('{seconds}', _offlineCountdown));
    _offlineTimer = setInterval(function() {
      _offlineCountdown--;
      if (_offlineCountdown <= 0) {
        clearInterval(_offlineTimer);
        _offlineTimer = null;
        showAlert(t('offline_msg'), t('offline_title'), true);
        API.post('/auth/logout').catch(function() {});
        localStorage.removeItem('sp_token'); localStorage.removeItem('sp_player');
        localStorage.removeItem('sp_remember_me'); localStorage.removeItem('sp_session_ts');
        sessionStorage.removeItem('sp_session_active');
        setTimeout(function() { window.location.href = 'index.html'; }, 2000);
      }
    }, 1000);
  }
  function clearOfflineTimer() {
    if (_offlineTimer) {
      clearInterval(_offlineTimer);
      _offlineTimer = null;
    }
  }
  window.addEventListener('offline', startOfflineTimer);
  window.addEventListener('online', clearOfflineTimer);

  /* APP KILL TESPİTİ — her 3sn kontrol et, sp_session_ts >60sn ise logout */
  setInterval(function sessionTimeout() {
    if (!localStorage.getItem('sp_token')) return;
    var ts = parseInt(localStorage.getItem('sp_session_ts') || '0');
    if (ts > 0 && Date.now() - ts > 60000) {
      localStorage.removeItem('sp_token'); localStorage.removeItem('sp_player');
      localStorage.removeItem('sp_remember_me'); localStorage.removeItem('sp_session_ts');
      sessionStorage.removeItem('sp_session_active');
      if (window.location.href.indexOf('index.html') === -1) window.location.href = 'index.html';
    }
  }, 3000);
  /* Uygulama geri geldiğinde session'ı tazele (30dk timeout mekanizması yeterli) */
  window.onReopen = function() {
    if (typeof Auth !== 'undefined' && typeof Auth.touch === 'function') Auth.touch();
  };

  /* Capacitor native appStateChange — Java katmanından gelir, WebView serialize'ından etkilenmez */
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) {
    try { Capacitor.Plugins.App.addListener('appStateChange', function(s) { if (s.isActive) onReopen(); }); } catch(e) {}
  }

  /* Android geri tuşu — savaş blokajı + ana sayfa çift basış */
  var _tr = function(key, fallback) {
    return (typeof t === 'function' ? t(key) : null) || fallback;
  };
  var backPressedOnce = false;

  function showToast(msg) {
    var el = document.getElementById('sp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sp-toast';
      el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99998;background:rgba(0,0,0,0.88);color:#f5e6c8;font-family:Inter,sans-serif;font-size:0.78rem;padding:12px 20px;border-radius:10px;border:1px solid rgba(200,150,42,0.3);text-align:center;max-width:320px;width:90%;pointer-events:none;transition:opacity 0.3s;opacity:0;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(function() { el.style.opacity = '0'; }, 2000);
  }

  function showExitConfirm() {
    var exitConfirm = document.getElementById('sp-exit-confirm');
    if (!exitConfirm) {
      exitConfirm = document.createElement('div');
      exitConfirm.id = 'sp-exit-confirm';
      exitConfirm.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
      exitConfirm.innerHTML = [
        '<div style="background:linear-gradient(145deg,#1a0e05,#2d1a08);border:2px solid #c8962a;border-radius:16px;padding:28px 22px;max-width:320px;width:90%;text-align:center;box-shadow:0 0 40px rgba(200,150,42,0.3);">',
        '<div style="font-size:40px;margin-bottom:6px;">🚪</div>',
        '<div style="font-family:\'Cinzel\',serif;font-size:17px;color:#f0c040;margin-bottom:8px;">' + _tr('exit_confirm_title', 'UYGULAMADAN ÇIK') + '</div>',
        '<div style="color:#b8956a;font-size:13px;margin-bottom:16px;">' + _tr('exit_confirm_msg', 'Çıkmak istediğinize emin misiniz?') + '</div>',
        '<div style="display:flex;gap:8px;">',
        '<button id="sp-exit-cancel" style="flex:1;padding:10px;background:rgba(90,53,24,0.5);border:1px solid #5c3518;border-radius:10px;color:#b8956a;font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;cursor:pointer;">' + _tr('exit_confirm_no', 'HAYIR') + '</button>',
        '<button id="sp-exit-yes" style="flex:1;padding:10px;background:linear-gradient(135deg,#8b2500,#c0392b);border:2px solid #e74c3c;border-radius:10px;color:#fff;font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;cursor:pointer;">' + _tr('exit_confirm_yes', 'EVET') + '</button>',
        '</div></div>'
      ].join('');
      document.body.appendChild(exitConfirm);
      document.getElementById('sp-exit-cancel').addEventListener('click', function() {
        exitConfirm.style.display = 'none';
      });
      document.getElementById('sp-exit-yes').addEventListener('click', function() {
        // Hesabı temizle ve logout yap, sonra kapat
        API.post('/auth/logout').catch(function() {});
        localStorage.removeItem('sp_token'); localStorage.removeItem('sp_player');
        localStorage.removeItem('sp_remember_me'); localStorage.removeItem('sp_session_ts');
        sessionStorage.removeItem('sp_session_active');
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          setTimeout(function() {
            window.Capacitor.Plugins.App.exitApp();
          }, 500);
        }
      });
      exitConfirm.addEventListener('click', function(e) {
        if (e.target === exitConfirm) exitConfirm.style.display = 'none';
      });
    }
    exitConfirm.style.display = 'flex';
  }

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('backButton', function(info) {
        var page = window.location.pathname.split('/').pop() || 'index.html';

        // 1. SAVAŞ AKTİFSE — tamamen bloke et
        if (page === 'fight.html' || page === 'fight-pvp.html') {
          var outcomeEl = document.getElementById('outcome');
          if (!outcomeEl || !outcomeEl.classList.contains('show')) {
            return; // hiçbir şey yapma, navigasyon olmasın
          }
        }

        // 1b. HARİTA — NPC aranıyor veya NPC kartı açıksa bloke et
        if (page === 'map.html') {
          var npcPanel = document.getElementById('npc-info-panel');
          if (npcPanel && npcPanel.style.display === 'flex') {
            return; // NPC kartı açıkken geri tuşu çalışmasın
          }
          var btnSearch = document.getElementById('btn-search');
          if (btnSearch && btnSearch.classList.contains('searching')) {
            return; // NPC aranırken geri tuşu çalışmasın
          }
        }

        // 2. ANA SAYFA — çift basış
        if (page === 'home.html' || page === 'index.html') {
          if (backPressedOnce) {
            backPressedOnce = false;
            showExitConfirm();
          } else {
            backPressedOnce = true;
            setTimeout(function() { backPressedOnce = false; }, 2000);
            showToast(_tr('back_double_tap', 'Çıkış yapmak için ard arda iki defa deneyin'));
          }
          return;
        }

        // 3. DİĞER SAYFALAR
        if (info.canGoBack) {
          window.history.back();
        } else {
          window.goTo('home.html');
        }
      });
    } catch(e) {
      /* Capacitor backButton plugin yoksa sessizce geç */
    }
  }

  /* pageshow — bfcache/WebView state restore (sigorta) */
  window.addEventListener('pageshow', function(ev) {
    if (typeof renderFromCache === 'function') {
      try { renderFromCache(); } catch (e) {}
    }
    if (document.body) document.body.style.visibility = 'visible';
    if (ev.persisted && typeof onReopen === 'function') onReopen();
  });

  /* ─── Page Reveal: API cevabını 150ms'ye kadar bekle, yoksa önbellekten göster ─── */
  window._pageReady = false;

  function _showPage() {
    window._pageReady = true;
    document.body.style.visibility = 'visible';
  }

  function _waitImages(cb, ms) {
    var imgs = document.querySelectorAll('img');
    var inc = [];
    for (var i = 0; i < imgs.length; i++) { if (!imgs[i].complete) inc.push(imgs[i]); }
    if (inc.length === 0) { cb(); return; }
    var t = setTimeout(cb, ms);
    var n = 0;
    inc.forEach(function (img) {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    function done() { n++; if (n >= inc.length) { clearTimeout(t); cb(); } }
  }

  window.revealPage = function () {
    if (window._pageReady) return;
    renderFromCache();
    var timer = setTimeout(function () { _waitImages(_showPage, 400); }, 150);
    window.readyNow = function () {
      if (window._pageReady) return;
      clearTimeout(timer);
      _waitImages(_showPage, 400);
    };
  };

  /* ─── Cache-First Render (önbellekten anlık doldurma) ─── */
  window.renderFromCache = function () {
    try {
      var p = JSON.parse(localStorage.getItem('sp_player') || 'null');
      if (!p) return;

      var el;

      // İsim
      el = document.getElementById('p-name');
      if (el) el.textContent = p.display_name || p.username || 'Kaptan';

      // Altın
      el = document.getElementById('p-gold') || document.getElementById('disp-gold');
      if (el) el.textContent = Number(p.gold || 0).toLocaleString('en-US');

      // İnci
      el = document.getElementById('p-pearl') || document.getElementById('disp-pearl');
      if (el) el.textContent = Number(p.pearl || 0).toLocaleString('en-US');

      // ELP
      el = document.getElementById('p-elp');
      if (el) el.textContent = Number(p.elite_points || 0).toLocaleString('tr-TR');

      // Level
      el = document.getElementById('p-lvl') || document.getElementById('p-lvl-lbl');
      if (el) el.textContent = (p.level || 1) + ' LVL';

      // XP yazısı
      el = document.getElementById('p-lvl-pct');
      if (el && p.xp !== undefined) {
        var xpNext = p.xpNext || 999999999;
        el.textContent = Number(p.xp || 0).toLocaleString('tr-TR') + ' / ' + Number(xpNext).toLocaleString('tr-TR');
      }

      // XP bar
      el = document.getElementById('p-lvl-fill');
      if (el && p.xp !== undefined) {
        var pct = Math.min(100, ((p.xp || 0) / (p.xpNext || 999999999)) * 100);
        el.style.width = pct + '%';
      }

      // HP
      el = document.getElementById('p-hp-text');
      if (el && p.hp !== undefined) {
        el.textContent = Number(p.hp || 0) + ' / ' + Number(p.max_hp || 0) + ' HP';
      }
      el = document.getElementById('p-hp-bar');
      if (el && p.hp !== undefined && p.max_hp) {
        el.style.width = Math.min(100, ((p.hp || 0) / p.max_hp) * 100) + '%';
      }

      // Rütbe ikonu (home.html stili)
      el = document.getElementById('p-rank-icon');
      if (el && p.rankBadge) {
        el.innerHTML = '<img src="assets/ui/rank/rank' + p.rankBadge + '.png" style="width:100%;height:100%;object-fit:contain;" alt="' + (p.rankName || '') + '">';
      }
      // Rütbe ikonu (map.html stili)
      el = document.getElementById('p-rank-box');
      if (el && p.rankBadge) {
        var img = el.querySelector('img');
        if (img) img.src = 'assets/ui/rank/rank' + p.rankBadge + '.png';
      }

      // VIP rozeti
      el = document.getElementById('vip-badge');
      if (el && p.vip_until) {
        var daysLeft = Math.ceil((new Date(p.vip_until) - new Date()) / 86400000);
        if (daysLeft > 0) {
          el.className = 'vip-badge on';
          el.innerHTML = '<img src="assets/ui/vip-ikon.png" class="vip-icon" alt=""> VIP \u00b7 ' + daysLeft + ' ' + (typeof t === 'function' ? t('daily_day') : 'gün');
        } else {
          el.className = 'vip-badge on';
          el.innerHTML = '<img src="assets/ui/vip-ikon.png" class="vip-icon" alt=""> VIP';
        }
      }
    } catch (e) { /* cache bozuk — sorun değil */ }
  };

  /* Cross-Document View Transitions varsa page'i readyNow() göstersin (2sn safety timeout) */
  if (CSS.supports && CSS.supports('view-transition-name', 'none')) {
    window.revealPage = function () {
      if (window._pageReady) return;
      renderFromCache();
      setTimeout(function () {
        if (!window._pageReady) _showPage();
      }, 2000);
    };
    window.readyNow = function () {
      if (window._pageReady) return;
      _showPage();
    };
  }
})();
