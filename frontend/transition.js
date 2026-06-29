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

  /* Kalp atışı (1sn) — sp_hb_time güncelle + session timestamp tazele (app kill tespiti için) */
  setInterval(function() {
    var now = Date.now();
    sessionStorage.setItem('sp_hb_time', now.toString());
    if (typeof Auth !== 'undefined' && typeof Auth.touch === 'function') Auth.touch();
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
    showToast('Bağlantı kesildi! ' + _offlineCountdown + 'sn içinde çıkış yapılacak...');
    _offlineTimer = setInterval(function() {
      _offlineCountdown--;
      if (_offlineCountdown <= 0) {
        clearInterval(_offlineTimer);
        _offlineTimer = null;
        showAlert('İnternet bağlantınız 30 saniye boyunca gelmedi. Güvenlik nedeniyle çıkış yapıldı.', 'BAĞLANTI KESİLDİ', true);
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

  /* pageshow — bfcache/WebView state restore */
  window.addEventListener('pageshow', function(ev) {
    if (ev.persisted) onReopen();
  });
})();
