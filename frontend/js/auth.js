const Auth = (() => {
  const TOKEN_KEY = 'sp_token';
  const PLAYER_KEY = 'sp_player';
  const REMEMBER_KEY = 'sp_remember_me';
  const SESSION_KEY = 'sp_session_active';

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
      if (!remember && !session) {
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
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PLAYER_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },

    redirectToLogin() {
      this.logout();
      window.goTo('index.html');
    }
  };
})();
