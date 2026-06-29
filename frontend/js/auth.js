const Auth = (() => {
  const TOKEN_KEY = 'sp_token';
  const PLAYER_KEY = 'sp_player';
  const REMEMBER_KEY = 'sp_remember_me';
  const SESSION_KEY = 'sp_session_active';
  const TS_KEY = 'sp_session_ts';
  const SESSION_MAX_MS = 60000; // 60 saniye (app kill tespiti için kısa tutulur)

  return {
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },

    getPlayer() {
      const raw = localStorage.getItem(PLAYER_KEY);
      try { return raw ? JSON.parse(raw) : null; }
      catch { return null; }
    },

    setPlayer(data) {
      if (data) {
        localStorage.setItem(PLAYER_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(PLAYER_KEY);
      }
    },

    isLoggedIn() {
      const token = this.getToken();
      if (!token) return false;
      const remember = localStorage.getItem(REMEMBER_KEY);
      const session = sessionStorage.getItem(SESSION_KEY);
      if (remember) return true;
      if (!session) {
        this.logout();
        return false;
      }
      const ts = parseInt(localStorage.getItem(TS_KEY) || '0');
      if (ts > 0 && Date.now() - ts > SESSION_MAX_MS) {
        this.logout();
        return false;
      }
      return true;
    },

    login(token, player, remember = false) {
      localStorage.setItem(TOKEN_KEY, token);
      this.setPlayer(player);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, 'true');
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, 'true');
        localStorage.removeItem(REMEMBER_KEY);
      }
      localStorage.setItem(TS_KEY, Date.now().toString());
    },

    touch() {
      if (this.getToken() && !localStorage.getItem(REMEMBER_KEY)) {
        localStorage.setItem(TS_KEY, Date.now().toString());
      }
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PLAYER_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TS_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },

    redirectToLogin() {
      this.logout();
      window.goTo('index.html');
    }
  };
})();
Auth.isLoggedIn();
