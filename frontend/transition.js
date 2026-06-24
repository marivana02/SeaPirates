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

})();
