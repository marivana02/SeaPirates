function generateDeviceId() {
  let deviceId = localStorage.getItem('sp_device_id');
  if (!deviceId) {
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem('sp_device_id', deviceId);
  }
  return deviceId;
}

const API = (() => {
  const BASE = (window.__API_URL__ || window.location.origin) + '/api';

  function getToken() {
    return localStorage.getItem('sp_token');
  }

  function getHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Device-Id': generateDeviceId(), 'X-Requested-With': 'XMLHttpRequest', ...extra };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  function clearSession() {
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_player');
    localStorage.removeItem('sp_remember_me');
    sessionStorage.removeItem('sp_session_active');
  }

  let sessionExpiredShown = false;

  function showSessionExpired() {
    if (sessionExpiredShown) return;
    sessionExpiredShown = true;
    const overlay = document.createElement('div');
    overlay.id = 'sp-session-expired';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    overlay.innerHTML = `
      <div style="background:linear-gradient(145deg,#1a0e05,#2d1a08);border:2px solid #c8962a;border-radius:16px;padding:32px 28px;max-width:380px;width:90%;text-align:center;box-shadow:0 0 40px rgba(200,150,42,0.3);">
        <div style="font-size:48px;margin-bottom:8px;">🚫</div>
        <div style="font-family:'Cinzel',serif;font-size:20px;color:#f0c040;margin-bottom:12px;">OTURUM SONLANDI</div>
        <div style="color:#f5e6c8;font-size:15px;line-height:1.5;margin-bottom:20px;">Bu hesaba başka bir cihazdan giriş yapıldı.<br>Devam etmek için tekrar giriş yapmalısın.</div>
        <button style="width:100%;padding:12px;background:linear-gradient(135deg,#c8962a,#f0c040);border:none;border-radius:10px;color:#1a0e05;font-family:'Cinzel',serif;font-size:16px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">GİRİŞ YAP</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', () => {
      window.goTo('index.html');
    });
  }

  async function handleError(res) {
    if (res.status === 401 || res.status === 403) {
      clearSession();
      showSessionExpired();
      return null;
    }
    return res;
  }

  async function request(method, path, body = null) {
    const url = BASE + path;
    const options = { method, headers: getHeaders() };
    if (body !== null) options.body = JSON.stringify(body);

    try {
      const res = await fetch(url, options);
      const handled = await handleError(res);
      if (!handled) return null;
      const data = await handled.json();
      if (!handled.ok) throw new APIError(data.error || 'Request failed', handled.status, data);
      return data;
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError('Network error - ' + err.message, 0);
    }
  }

  class APIError extends Error {
    constructor(message, status, data = null) {
      super(message);
      this.name = 'APIError';
      this.status = status;
      this.data = data;
    }
  }

  return {
    get(path) { return request('GET', path); },
    post(path, body) { return request('POST', path, body); },
    put(path, body) { return request('PUT', path, body); },
    del(path) { return request('DELETE', path); },
    getToken,
    isAuthenticated() { return !!getToken(); },
    APIError
  };
})();
window.API = API;

/* Expose session helpers globally so pages can use them from direct fetch */
window.clearAuth = function() {
  localStorage.removeItem('sp_token');
  localStorage.removeItem('sp_player');
  localStorage.removeItem('sp_remember_me');
  sessionStorage.removeItem('sp_session_active');
};

/* Global fetch override — catches 401/403 from ANY fetch call, not just API.* */
(function() {
  let sessionExpiredShown = false;
  function showGlobalSessionExpired() {
    if (sessionExpiredShown) return;
    sessionExpiredShown = true;
    const overlay = document.createElement('div');
    overlay.id = 'sp-global-session-expired';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    overlay.innerHTML = [
      '<div style="background:linear-gradient(145deg,#1a0e05,#2d1a08);border:2px solid #c8962a;border-radius:16px;padding:32px 28px;max-width:380px;width:90%;text-align:center;box-shadow:0 0 40px rgba(200,150,42,0.3);">',
      '<div style="font-size:48px;margin-bottom:8px;">🚫</div>',
      '<div style="font-family:\'Cinzel\',serif;font-size:20px;color:#f0c040;margin-bottom:12px;">OTURUM SONLANDI</div>',
      '<div style="color:#f5e6c8;font-size:15px;line-height:1.5;margin-bottom:20px;">Bu hesaba başka bir cihazdan giriş yapıldı.<br>Devam etmek için tekrar giriş yapmalısın.</div>',
      '<button style="width:100%;padding:12px;background:linear-gradient(135deg,#c8962a,#f0c040);border:none;border-radius:10px;color:#1a0e05;font-family:\'Cinzel\',serif;font-size:16px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">GİRİŞ YAP</button>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', function() {
      window.goTo('index.html');
    });
  }

  const origFetch = window.fetch;
  window.fetch = function() {
    var input = arguments[0];
    var init = arguments[1];
    var method = init && init.method;
    if (typeof input === 'string' && input.includes('/api/') && !input.includes('/auth/') && (!init || !method || method === 'POST')) {
      if (!init) { init = {}; }
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        if (!init.headers.has('X-Requested-With')) init.headers.set('X-Requested-With', 'XMLHttpRequest');
      } else {
        init.headers['X-Requested-With'] = 'XMLHttpRequest';
      }
      arguments = [input, init];
    }
    return origFetch.apply(this, arguments).then(function(res) {
      if ((res.status === 401 || res.status === 403) && localStorage.getItem('sp_token')) {
        window.clearAuth();
        showGlobalSessionExpired();
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return res;
    });
  };
})();
