# SeaPirates — VPS Kurulumu + APK Build Rehberi

## 🏗 İki Mimari Seçeneği

| | A: Frontend server'da | B: Frontend APK içinde |
|---|---|---|
| Güncelleme | Anında (server'ı güncelle, herkese yansır) | Yeni APK atman gerekir |
| Çevrimdışı | Hayır (internet gerekir) | Kısmen (SW cache varsa) |
| API çağrıları | Doğal çalışır (`window.location.origin`) | `capacitor.config.json`'da hostname ayarlanmalı |
| **Tavsiye** | ✅ **Önerilen** (Oyun server'a bağlı zaten) | ❌ Gereksiz karmaşıklık |

**Önerim: Seçenek A** — Frontend'i de VPS'deki Express sun, APK sadece bir WebView wrapper olsun.

---

## 1. VPS Hazırlık (Ubuntu 22.04/24.04 önerilir)

```bash
# SSH ile VPS'e bağlan
ssh root@<VPS-IP>

# Sistem güncelle
apt update && apt upgrade -y

# Node.js 20 LTS kur
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # v20.x olmalı

# PostgreSQL kur
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Git kur (opsiyonel, kod çekmek için)
apt install -y git
```

### PostgreSQL Veritabanı Oluştur
```bash
sudo -u postgres psql
CREATE DATABASE seapirates;
CREATE USER postgres WITH PASSWORD 'sifreni_belirle';
GRANT ALL PRIVILEGES ON DATABASE seapirates TO postgres;
\q
```

---

## 2. Projeyi VPS'e Yükle

**SSH üzerinden SCP ile** (Windows PowerShell):
```powershell
# Local'den VPS'e kopyala
scp -r C:\Users\marivana\Desktop\SeaPirate root@<VPS-IP>:/root/seapirate
```

**Veya Git ile** (önce GitHub'a push et, sonra VPS'te clone).

### `.env` Dosyasını Düzenle
```bash
nano /root/seapirate/server/.env
```

Şu şekilde güncelle:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seapirates
DB_USER=postgres
DB_PASSWORD=sifreni_belirle
JWT_SECRET=<random-güçlü-bir-şifre>
ADMIN_KEY=<random-bir-anahtar>
VAPID_PUBLIC_KEY=BFkQZIfl5cEmn4HIUU1omIKOQkerzjIQQrFXn1XIq5A1e5peKe-Gvh1rNPp1XTwd3X_x30GiJpFX1VSib-0Q5Kc
VAPID_PRIVATE_KEY=fis4a9bPLbpSewHJLVb0TRrMl68sk2bRiDrtGWexUfw
VAPID_SUBJECT=mailto:admin@seapirates.com
PUBLIC_URL=https://<VPS-IP-veya-domain>:3000
```

### Bağımlılıkları Kur ve Veritabanını Başlat
```bash
cd /root/seapirate/server
npm install
node init_db.js
```

### PM2 ile Server'ı Kalıcı Çalıştır
```bash
npm install -g pm2
pm2 start index.js --name seapirates
pm2 save
pm2 startup  # bu çıktıdaki komutu da çalıştır (systemd için)
```

Server artık `http://<VPS-IP>:3000` adresinde çalışıyor olmalı.

---

## 3. Domain + SSL (HTTPS) — Zorunlu

Push notification'lar için HTTPS gerekir. **Let's Encrypt + Nginx reverse proxy**:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/seapirates`:
```nginx
server {
    listen 80;
    server_name seapirates.com www.seapirates.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name seapirates.com www.seapirates.com;

    # certbot doldurur
    ssl_certificate /etc/letsencrypt/live/seapirates.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seapirates.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket için (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/seapirates /etc/nginx/sites-enabled/
certbot --nginx -d seapirates.com -d www.seapirates.com
nginx -t && systemctl reload nginx
```

---

## 4. APK Oluşturma (Kendi PC'nde)

### Gereksinimler
- **Node.js** kurulu olsun
- **Java 17** (Android Studio ile gelir veya ayrı kur)
- **Android Studio** (bir kere kur, sonra gerekmez)

### Adımlar

```powershell
# Frontend klasörüne git
cd C:\Users\marivana\Desktop\SeaPirate\frontend

# Capacitor kur
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android

# Capacitor config'i oluştur
npx cap init SeaPirates com.seapirates.app
```

`capacitor.config.json`'ı düzenle:
```json
{
  "appId": "com.seapirates.app",
  "appName": "SeaPirates",
  "webDir": ".",
  "bundledWebRuntime": false,
  "server": {
    "hostname": "seapirates.com",
    "androidScheme": "https"
  }
}
```

Android platformunu ekle:
```powershell
npx cap add android
```

**⚠️ Frontend'deki API URL'lerini güncelle** — frontend `window.location.origin + '/api'` kullanıyor. APK içinde bu `file://` olur. İki çözüm var:

**Çözüm 1 (Tavsiye edilen):** APK bir URL'yi açsın. `capacitor.config.json`'a ekle:
```json
"server": {
  "url": "https://seapirates.com",
  "cleartext": false
}
```
Bu durumda frontend server'da host edilir, APK sadece WebView açar. API çağrıları doğal çalışır.

**Çözüm 2 (Offline):** Frontend APK içinde gömülü olsun. O zaman API URL'i hardcode etmek gerekir. Tüm HTML/JS dosyalarındaki `window.location.origin + '/api'` yerine `'https://seapirates.com/api'` yaz.

### APK'yı Derle
```powershell
npx cap copy android
npx cap open android
```
Android Studio açılınca:
- **Build → Generate Signed Bundle / APK**
- **APK** seç
- **Create new keystore** (bir kere, sonra hep aynı key'i kullan)
- Store password, Key password, alias gir
- **release** variant seç
- Bitince `android/app/build/outputs/apk/release/app-release.apk` dosyan hazır

---

## 5. Komut Özeti (Hızlı Başlangıç)

```bash
# === VPS ===
ssh root@VPS_IP
apt update && apt install -y nodejs postgresql nginx
sudo -u postgres createdb seapirates
cd /root && git clone https://github.com/senin-repon/seapirate.git
cd seapirate/server && npm install && node init_db.js
npm install -g pm2 && pm2 start index.js --name seapirates && pm2 save

# === Local PC (APK) ===
cd C:\Users\marivana\Desktop\SeaPirate\frontend
npm init -y && npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init SeaPirates com.seapirates.app
npx cap add android
# capacitor.config.json'da "server.url" ayarla
npx cap copy android
npx cap open android  # Android Studio'da Build → Generate Signed APK
```

## 6. Önemli Notlar

- **VPS'te Android Studio kurmana gerek yok.** APK'yı kendi PC'nde derlersin.
- **Her güncellemede** frontend dosyalarını VPS'e yükle (SCP/Git) ve `pm2 restart seapirates` yap.
- **APK'yı her güncelleme** için tekrar derlemene gerek yok (eğer Çözüm 1 kullanıyorsan — APK sadece URL açar, frontend server'da güncel).
- **İlk APK derlemesinde** Android Studio kurulumu + SDK indirmesi 15-20 dk sürebilir.
