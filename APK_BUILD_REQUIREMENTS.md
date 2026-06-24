# SeaPirates APK Build Requirements

## ✅ Fixed Issues (already done)
- `assets/pırıltı/` → `assets/glitter/` (updated: map.html, glitter.html)
- `assets/savaş puanı/` → `assets/pvp-badges/` (updated: pvp.html, fight.js)
- `manifest.json` created (PWA manifest)
- `sw.js` updated (adds cache-first strategy for offline support)
- `index.html` / `home.html` now include `<link rel="manifest">` and theme-color meta tags
- Notification row now shows "unsupported" message instead of hiding completely

---

## 📋 APK Build Requirements

### 1. App Icons (required)
Create PNG icons and place in `frontend/assets/`:
| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192×192 | Android notification icon, PWA icon |
| `icon-512.png` | 512×512 | Splash screen, high-res icon |
| `icon-foreground.png` | 108×108 | Android adaptive icon foreground (optional) |
| `icon-background.png` | 108×108 | Android adaptive icon background (optional) |

Update `manifest.json` with correct icon paths.

### 2. Capacitor Setup
Install Node.js then run in `frontend/` directory:
```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init SeaPirates com.seapirates.app
npx cap add android
```

### 3. Capacitor Config
Create `frontend/capacitor.config.json`:
```json
{
  "appId": "com.seapirates.app",
  "appName": "SeaPirates",
  "webDir": ".",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https",
    "hostname": "seapirates.com"
  }
}
```

### 4. Android Specifics
After `npx cap add android`:

- **Google Fonts**: Capacitor WebView has internet by default, but for offline: download fonts and host them locally
- **`AndroidManifest.xml`** changes:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
  ```
- **WebView config**: Enable dom storage, allow mixed content if needed

### 5. Server/API Configuration
The `.env` file has `PUBLIC_URL=http://localhost:3000` — change this to your production server URL:
```
PUBLIC_URL=https://your-server.com
```
The frontend uses `window.location.origin + '/api'` for API calls, which works in Capacitor if the app loads from the same domain as the API. For a remote server:
- In Capacitor, the frontend is served from the device's file system (`file://`), so `window.location.origin` won't point to your server.
- **Solution**: Either:
  - Host the frontend on the same server (e.g., `https://your-server.com/index.html`)
  - Or set a hardcoded API URL in a config variable

### 6. App Splash Screen
```bash
npm install @capacitor/splash-screen
npx cap sync
```
Add splash config to `capacitor.config.json`:
```json
"plugins": {
  "SplashScreen": {
    "launchShowDuration": 2000,
    "backgroundColor": "#0d0702"
  }
}
```
Create splash image (ideally 2732×2732 for Android).

### 7. Build & Sign APK
```bash
npx cap copy android
npx cap open android
```
In Android Studio:
- **Build → Generate Signed Bundle / APK**
- Create a keystore (if first time)
- Select release build variant
- APK will be in `android/app/build/outputs/apk/release/`

### 8. Additional Considerations

| Item | Status | Note |
|------|--------|------|
| Google Fonts | ⚠️ External CDN | Fonts won't load offline. Bundle locally if offline support needed. |
| Push Notifications | ⚠️ Requires VAPID keys | Already configured in server `.env`. Need HTTPS in production. |
| Service Worker | ✅ | Works in Capacitor WebView. Cache-first strategy added. |
| Sound Files | ✅ | MP3 files in `assets/sounds/` — compatible with WebView. |
| localStorage | ✅ | Persists in Capacitor WebView. |
| Socket.io | ⚠️ | Works with Capacitor. Uses `window.location.origin` for WebSocket. |
| .swf directories | ✅ | Already extracted to PNG files. No Flash dependency. |
| Content Security | ⚠️ | Add CSP meta tag if needed for production. |

### 9. Quick Build Command Summary
```bash
# One-time setup
cd frontend
npm install -g @capacitor/core @capacitor/cli
npm init -y
npm install @capacitor/core @capacitor/android
npx cap init SeaPirates com.seapirates.app
npx cap add android
npm install @capacitor/splash-screen

# Every build
npx cap copy android
npx cap open android
# Then Build → Generate Signed APK in Android Studio
```

### 10. Production Checklist
- [ ] App icons created (192×192, 512×512)
- [ ] `PUBLIC_URL` in server `.env` changed to production domain
- [ ] API URL hardcoded or configured for remote server
- [ ] JWT_SECRET changed from default
- [ ] VAPID keys regenerated for production
- [ ] Android keystore created and saved
- [ ] App signed with release key
- [ ] Tested on real Android device
- [ ] HTTPS enabled on server
