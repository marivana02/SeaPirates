/* ─── SeaPirates — Helpers ─── */
(function () {
  'use strict';

  window.goTo = function (url) {
    if (!url || url === '#' || url.startsWith('javascript:')) return;
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

  setInterval(() => {
    if (!window.Auth || !Auth.isLoggedIn()) return;
    API.post('/player/ping').catch(() => {});
  }, 60000);

  /* Android geri tuşu */
  var _t = function(key, fallback) {
    return (typeof t === 'function' ? t(key) : null) || fallback;
  };
  var spFightBackConfirm = null;
  function showFightBackConfirm() {
    if (!spFightBackConfirm) {
      spFightBackConfirm = document.createElement('div');
      spFightBackConfirm.id = 'sp-fight-back-confirm';
      spFightBackConfirm.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
      spFightBackConfirm.innerHTML = [
        '<div style="background:linear-gradient(145deg,#1a0e05,#2d1a08);border:2px solid #c8962a;border-radius:16px;padding:28px 22px;max-width:320px;width:90%;text-align:center;box-shadow:0 0 40px rgba(200,150,42,0.3);">',
        '<div style="font-size:40px;margin-bottom:6px;">⚔️</div>',
        '<div style="font-family:\'Cinzel\',serif;font-size:17px;color:#e74c3c;margin-bottom:8px;">' + _t('fight_back_title', 'SAVAŞ DEVAM EDİYOR') + '</div>',
        '<div style="color:#b8956a;font-size:13px;margin-bottom:16px;">' + _t('fight_back_msg', 'Savaştan ayrılırsanız ilerlemeniz kaybolacak! Devam etmek istiyor musunuz?') + '</div>',
        '<div style="display:flex;gap:8px;">',
        '<button id="sp-fight-back-cancel" style="flex:1;padding:10px;background:rgba(90,53,24,0.5);border:1px solid #5c3518;border-radius:10px;color:#b8956a;font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;cursor:pointer;">' + _t('exit_confirm_no', 'HAYIR') + '</button>',
        '<button id="sp-fight-back-yes" style="flex:1;padding:10px;background:linear-gradient(135deg,#8b2500,#c0392b);border:2px solid #e74c3c;border-radius:10px;color:#fff;font-family:\'Cinzel\',serif;font-size:13px;font-weight:700;cursor:pointer;">' + _t('exit_confirm_yes', 'EVET') + '</button>',
        '</div></div>'
      ].join('');
      document.body.appendChild(spFightBackConfirm);
      document.getElementById('sp-fight-back-cancel').addEventListener('click', function() {
        spFightBackConfirm.style.display = 'none';
      });
      document.getElementById('sp-fight-back-yes').addEventListener('click', function() {
        spFightBackConfirm.style.display = 'none';
        window.history.back();
      });
      spFightBackConfirm.addEventListener('click', function(e) {
        if (e.target === spFightBackConfirm) spFightBackConfirm.style.display = 'none';
      });
    }
    spFightBackConfirm.style.display = 'flex';
  }

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('backButton', function(info) {
        var page = window.location.pathname.split('/').pop() || 'index.html';
        /* Savaş sayfalarında geri tuşu uyarısı */
        if ((page === 'fight.html' || page === 'fight-pvp.html') && info.canGoBack) {
          var outcomeEl = document.getElementById('outcome');
          if (!outcomeEl || !outcomeEl.classList.contains('show')) {
            showFightBackConfirm();
            return;
          }
        }
        if (info.canGoBack) {
          window.history.back();
        } else if (page !== 'home.html' && page !== 'index.html') {
          window.goTo('home.html');
        } else {
          /* Ana sayfada çıkış onayı göster (çoklu dil) */
          function _tr(key, fallback) {
            return (typeof t === 'function' ? t(key) : null) || fallback;
          }
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
              if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
              }
            });
            exitConfirm.addEventListener('click', function(e) {
              if (e.target === exitConfirm) exitConfirm.style.display = 'none';
            });
          }
          exitConfirm.style.display = 'flex';
        }
      });
    } catch(e) {
      /* Capacitor backButton plugin yoksa sessizce geç */
    }
  }
})();
