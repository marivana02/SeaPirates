@echo off
chcp 65001 > nul
echo ===================================================
echo             ⚓ SEAPIRATE POSTGRESQL KONTROL ⚓
echo ===================================================
echo.

:: PostgreSQL servis adını tespit et
set SERVICE_NAME=postgresql-x64-18

echo [%SERVICE_NAME%] servisi denetleniyor...
sc query %SERVICE_NAME% | find "RUNNING" > nul
if %ERRORLEVEL% equ 0 (
    echo.
    echo 🟩 PostgreSQL servisi zaten aktif ve ÇALIŞIYOR.
    echo.
) else (
    echo.
    echo ⚠️ PostgreSQL servisi kapalı! Yönetici izinleriyle başlatılıyor...
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c net start %SERVICE_NAME%' -Verb RunAs -Wait"
    
    :: Yeniden sorgula
    sc query %SERVICE_NAME% | find "RUNNING" > nul
    if %ERRORLEVEL% equ 0 (
        echo 🟩 PostgreSQL servisi BAŞARIYLA BAŞLATILDI.
    ) else (
        echo ❌ Servis başlatılamadı. Lütfen Windows Hizmetler (services.msc) panelini kontrol edin.
    )
)

echo.
echo Veritabanı tabloları kontrol ediliyor...
node check_db.js
echo.
pause
