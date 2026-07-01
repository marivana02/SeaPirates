# SeaPirate i18n Audit Report — Hardcoded Strings

## Summary

- **21 HTML files** scanned (14 `lang="en"`, 7 `lang="tr"`)
- **7 JS files** examined for hardcoded user-facing strings
- Strings with `data-i18n` (even with English fallback) are considered OK (get replaced by `applyI18n()`)
- Strings set via JS without using `t('key')` are HARDCODED

---

## HTML Files — Missing `data-i18n`

### 1. `index.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 592 | `Weak` | Strength label, no `data-i18n` |
| 620 | `SeaPirates v1.0 © 2026` | Footer copyright |
| 628 | `⚓ TERMS OF SERVICE` | Modal header fallback (overwritten by JS, but still hardcoded fallback) |
| 803-817 | Full Terms & Privacy body text | All in English, no `data-i18n` anywhere in `<p>` elements |
| JS 785 | `'🚫 This device is banned. Registration not allowed.'` | Hardcoded in doRegister error handler |

### 2. `map.html` (lang="tr")
| Line | Text | Notes |
|------|------|-------|
| 1080 | `10 Level` | Lock overlay on PvP card |
| 1089 | `Tiamat` | Action card label for Tiamat button |
| 1139 | `0 / 0 HP` | HP text fallback (has no `data-i18n` on the `hp-bar-text` span itself) |
| 1166 | `1 LVL` | Level label fallback (no `data-i18n`) |
| 1168 | `XP` | XP label text (no `data-i18n`) |
| 1197 | `⚠️ Can attack once daily. Loading...` | Boss modal status info (no `data-i18n`) |
| 1202 | `⏳ Loading rankings...` | Boss ranking loading text |
| 1207 | `ATTACK` | Boss attack button (no `data-i18n`) |
| 1215 | `TIAMAT` | Tiamat modal title (no `data-i18n`) |
| 1217-1219 | `❤️ 12,000,000 HP` / `3,800 DMG` / `38,000 Pearl` | Tiamat stats (no `data-i18n`) |
| 1221 | `ATTACK` | Tiamat attack button |
| 1248 | `⚔️ GO TO EQUIPMENT` | No-cannon modal button |
| 1249 | `Go Back` | No-cannon modal button |

### 3. `shop.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 379 | `Mevcut: ` + qty | Turkish hardcoded label in JS template |
| 354-369 | Price display uses `.toLocaleString('en-US')` | Number formatting (OK for display, but not translatable) |
| JS 353 | `-10%` | VIP discount badge text (hardcoded) |
| JS 374 | `🔫` / `💎` | Fallback icons (OK) |

### 4. `equipment.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 286-293 | `30 Pounder`, `55 Pounder`, `60 Pounder`, `Wooden Beam`, `Elite Beam` | Item names in JS catalog, no `t()` wrapper |
| 366 | `' sn'` | Reload unit (hardcoded Turkish "sn") |
| 523 | `'Sunucuya bağlanılamadı!'` | Turkish hardcoded error in `doEquipAll` catch |
| JS 324 | `'Could not load inventory!'` | Hardcoded error |
| JS 328 | `'Could not connect to server!'` | Hardcoded error |
| JS 468 | `'Equip failed!'` | Hardcoded error |
| JS 475 | `'Could not connect to server!'` | Hardcoded error |
| JS 492 | `'Unequip failed!'` | Hardcoded error |
| JS 499 | `'Could not connect to server!'` | Hardcoded error |
| JS 516 | `'Equip all failed!'` | Hardcoded error |
| JS 540 | `'Unequip all failed!'` | Hardcoded error |
| JS 547 | `'Could not connect to server!'` | Hardcoded error |

### 5. `ships.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 206 | `Next: Elite I — 35,000 ELP required` | EP section text fallback (but overwritten by JS) |
| 214 | `Level 0` | Banner level fallback |
| 238-248 | Ship names: `Starter`, `Elite I`, ..., `Elite X` | Hardcoded English in GEMILER array |
| 292 | `'Could not load ship data!'` | Hardcoded error |
| 296 | `'Could not connect to server!'` | Hardcoded error |
| 403-404 | Design names: `Crystal Queen`, `Seahawk` | Hardcoded in TASARIMLAR array |
| 461 | `'Hata!'` | Turkish hardcoded error |
| 467 | `'Could not connect to server!'` | Hardcoded error |
| 497 | `'Ship selection failed!'` | Hardcoded error |
| 504 | `'Could not connect to server!'` | Hardcoded error |
| 522 | `'Visual selection failed!'` | Hardcoded error |
| 531 | `'Could not connect to server!'` | Hardcoded error |

### 6. `my-hall.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 321 | `Damage` | Math desc label (no `data-i18n`) |
| 326 | `Elite` | Math desc label (`data-i18n` present but also fallback English) |
| 331 | `Experience` | Math desc label (no `data-i18n`) |
| 336 | `Level` | Math desc label (no `data-i18n`) |
| 341 | `Days` | Math desc label (no `data-i18n`) |
| 361 | `Pirate King` | Target rank name fallback |
| 363 | `needs 0 Rank Points` | Target description fallback |
| 370 | `Korsan Baronu` | Turkish fallback for lower rank name |
| 372 | `has 0 Rank Points` | Lower rank description fallback |
| JS 449 | `'(DMG / 200.000)'` | Math calculation detail (hardcoded) |
| JS 452 | `'(EP / 5.000)'` | Math calculation detail (hardcoded) |
| JS 455 | `'(XP / 1.500)'` | Math calculation detail (hardcoded) |
| JS 458 | `'(LVL × 100)'` | Math calculation detail (hardcoded) |
| JS 461 | `'(DAY × 5)'` | Math calculation detail (hardcoded) |

### 7. `hall-of-fame.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 175 | `Experience Points` | Category label fallback |
| 178-187 | All `<option>` texts have `data-i18n` — OK |
| JS 241 | `` `${hours}h ${mins}m` `` | Playtime formatting (hardcoded English) |

### 8. `level-bonus.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 718 | `⭐ Seviye` | Turkish fallback (has `data-i18n` so OK) |
| 722 | `NOT ACTIVE` | VIP status fallback (no `data-i18n` on the span itself, just on parent) |
| 755-778 | Reward descriptions: `20,000 Gold`, `500 Pearl`, `5,000 Hollow`, etc. | Hardcoded English text in LV_normal / LV_vip arrays (uses `lk` for translation, but `text` field is fallback) |
| 784 | `'Reward claimed successfully!'` | Hardcoded toast message |
| 965 | `'Could not claim reward!'` | Hardcoded error |
| 973 | `'Server error!'` | Hardcoded error |
| 1032 | Alert text with Turkish: `"... gün paket — ... Ödeme sistemi yakında!"` | Hardcoded Turkish |

### 9. `daily-reward.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 473 | `MONTH` | Info box label fallback |
| 477 | `NOT ACTIVE` | VIP status fallback |
| 507-571 | All reward amounts (e.g. `2,000`, `100`, etc.) in D_NORMAL / D_VIP arrays | Uses `lk` for translation — OK |
| 581-582 | `MONTHS_TR`, `MONTHS_EN` arrays | Hardcoded month names (used via `getMonthName`) |
| 723 | `'daily_claimed_success'` | Uses `t()` — OK |
| 726 | `data.error || 'err_daily_claim_failed'` | OK (uses error key) |
| 730 | `'Server error!'` | Hardcoded error |
| 789 | Alert text with Turkish: `"... gün paket — ... Ödeme sistemi yakında!"` | Hardcoded Turkish |

### 10. `events.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 582 | `⚓ Loading events...` | Loading text |
| 599 | `['Mon','Tue','Wed','Thu','Fri','Sat','Sun']` | Hardcoded day names in JS |
| 632 | `['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']` | Hardcoded month abbreviations in JS |
| 669 | `'❌ Server error (' + r.status + ')...'` | Hardcoded error |
| 682 | `'❌ Connection failed: ' + e.message` | Hardcoded error |
| 696 | Comment in Turkish, not user-facing | OK |

### 11. `glitter.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 442 | `BACK TO MAP` | Back button fallback (has `data-i18n` — OK) |
| 444 | `GLITTER` | Title fallback (has `data-i18n` — OK) |
| 458 | `Collect glitter from the sea to earn rewards!` | Empty state text (has `data-i18n` — OK) |
| 464 | `Kaptan...` | Player name fallback |
| 492 | `1 LVL` | Level label fallback |
| 494 | `XP` | XP label fallback |
| 520 | `'Ammo'` | Fallback in `ammoLabel()` |
| 747 | `'🎉 LEVEL UP! → ... LVL'` | Level up toast |
| 788-794 | `+... Gold` / `+... Pearl` / `+... XP` | Float text rewards (hardcoded English labels) |
| 808-830 | `Gold`, `Pearl`, `XP` | Reward display text (hardcoded) |

### 12. `tower.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 131 | `BACK` | Back button text (has `data-i18n` on parent but text is hardcoded) |
| 141 | `Loading tower data...` | Banner fallback (has `data-i18n` — OK) |
| 157-161 | Difficulty labels: `EASY`, `MEDIUM`, `HARD` | Hardcoded in TOWERS object |
| JS 211 | `` `⚠️ ${t('tower_req_level',...)}` `` | OK, uses `t()` |
| JS 214 | `` `⚠️ ${t('tower_daily_used',...)}` `` | OK, uses `t()` |

### 13. `pvp.html` (lang="en")
| Line | Text | Notes |
|------|------|-------|
| 486 | `Crew` | Current rank name fallback (no `data-i18n` on the span) |
| 496 | `BATTLE POINTS (BP)` | Progress bar label (no `data-i18n`) |
| 503 | `Apprentice Sailor` | Next rank name fallback (no `data-i18n`) |
| 518 | `SeaPirate` | Player name fallback |
| 527 | `VS` | VS circle text |
| 542 | `Loading...` | Target name fallback |
| 553 | `Refresh Opponents` | Change button text (no `data-i18n`) |
| 554 | `(Remaining: 10)` | Changes remaining label |
| 558 | `ATTACK` | Attack button text |
| 604 | `` `❌ PvP error: ${data.error}` `` | Hardcoded error |
| 697 | `t('pvp_unknown_opponent')` | OK, uses `t()` |
| 703 | `'⚠️ Server error, could not load PvP info!'` | Hardcoded error |
| 729 | `` `❌ ${data.error || 'Could not change opponent.'}` `` | Hardcoded fallback |
| 733 | `'⚠️ Could not connect to server!'` | Hardcoded error |

### 14. `admin.html` (lang="tr")
| Line | Text | Notes |
|------|------|-------|
| 126 | `&larr; Geri` | Back button (has `data-i18n` — OK) |
| 127 | `&#9879; Admin Panel` | Title (hardcoded) |
| 140 | `ID / kullanıcı adı / e-posta...` | Search placeholder (Turkish) |
| 141 | `Ara` | Search button (has `data-i18n` — OK) |
| 151-156 | `<option>` values: `Tümü`, `Ban`, `Unban`, `VIP`, `Register`, `Login` | Filter options (some have `data-i18n`) |
| 229 | `ADMIN` | Badge text (hardcoded) |
| 230 | `BANNED` | Badge text (hardcoded) |
| 231 | `VIP` | Badge text (hardcoded) |
| 232 | `AKTİF` | Badge text (Turkish, hardcoded) |
| 221-222 | `ID`, `Lv`, `Email`, `Kullanıcı`, `Görünen`, `Durum`, `İşlem` | Table headers (some have `data-i18n`, some don't) |
| 277-296 | Field labels in detail modal: `ID`, `Username`, `Display Name`, `Email`, `Level`, etc. | All hardcoded in JS |
| 311-320 | Button texts: `Unban`, `Ban`, `+7 Gün VIP`, `+VIP Ekle` | Hardcoded |
| 328-337 | Ban form texts: `Ban sebebi...`, `Kalıcı`, `1 saat`, etc. | Turkish hardcoded |
| 340 | `Cihaz banı da ekle` | Turkish hardcoded |
| 342 | `Ban Uygula` | Turkish hardcoded |
| 347 | `Son İşlemler` | Turkish hardcoded |

---

## JS Files — Hardcoded User-Facing Strings (not using `t('key')`)

### `map.js`
| Line | String | Context |
|------|--------|---------|
| 227 | `` `${fmt(player.hp)} / ${fmt(player.max_hp)} HP` `` | HP bar text |
| 230 | `` `${player.level} LVL` `` | Level label |
| 337 | Turkish: `Harita ${s.map_level}-${s.spawned_sub_map}'de ${s.name} göründü!` | Admiral notification |
| 552 | `` `${fmt(foundNpc.hp)} HP` `` | NPC panel HP |
| 564 | `` `${fmt(foundNpc.xp)} XP` `` | NPC loot XP |
| 570 | `"NPC ARA"` | Search button text (Turkish) |

### `fight-shared.js`
| Line | String | Context |
|------|--------|---------|
| 842 | `name: 'Kaptan'` | Default player name (Turkish) |
| 861 | `` `#ID:${data.id}` `` | Player ID display |
| 868 | `data.rankName || 'Kara Adamı'` | Rank title fallback (Turkish) |
| 949 | `'Vurulan Hasar: ' + fmt(bossDmg)` | Boss damage display (Turkish) |
| 1115-1119 | `'Grapeshot'`, `'Hollow Shot'`, `'Elite Shot'`, `'Gunpowder'`, `'Armor'` | Slot item titles |

### `fight-pvp.js`
| Line | String | Context |
|------|--------|---------|
| 9 | `localStorage.getItem(...) || 'Korsan'` | Default opponent name (Turkish) |
| 88 | `data.pvpOpponentRankName || 'Tayfa'` | Rank name fallback (Turkish) |
| 97 | `` `#ID:${data.pvpOpponentId}` `` | Opponent ID display |
| 140 | (none) | |
| 173 | `` `${t('level_up')} → ${newLevel} LVL` `` | Level up text (hardcoded ` LVL`) |

### `fight-pve.js`
| Line | String | Context |
|------|--------|---------|
| 9-13 | `'Tower (Lvl 1)'`, `'Tower (Lvl 2)'`, etc. | Tower names (hardcoded English) |
| 17 | `'Efsanevi Leviathan'`, `'Tiamat'`, `'Korsan'` | NPC name fallbacks |
| 234 | `'Tiamat ' + t('victory')` | Victory text with hardcoded Tiamat |
| 240 | `npc.name || 'Admiral'` | Admiral name fallback |
| 255 | Hardcoded format with `toLocaleString` | Boss damage display |
| 262 | `` `+${fmt(rw.xp)} XP` `` | XP reward display |

### `api.js`
| Line | String | Context |
|------|--------|---------|
| 43-48 | Turkish: `OTURUM SONLANDI`, `Bu hesaba başka bir cihazdan giriş yapıldı...`, `GİRİŞ YAP` | Session expired modal (hardcoded Turkish) |
| 122-125 | Same Turkish text | Global fetch override modal |

---

## Summary of Critical Issues

### Most impactful (visible to all users):
1. **`index.html`**: Terms/Privacy modal body (lines 803-817) — full English legal text, no i18n
2. **`map.html`**: Tiamat modal (lines 1215-1221) — HP, DMG, Pearl, ATTACK all hardcoded
3. **`map.html`**: Boss modal (lines 1197-1207) — loading/status text, ATTACK button hardcoded
4. **`pvp.html`**: Rank names (`Crew`, `Apprentice Sailor`), VS text, button labels all hardcoded
5. **`my-hall.html`**: Math calculation descriptions (`Damage`, `Experience`, `Level`, `Days`) have no `data-i18n`
6. **`admin.html`**: Player detail modal field labels (ID, Username, Email, Level, etc.) hardcoded in JS
7. **`api.js`**: Session expired modals are entirely in Turkish (hardcoded)
8. **`fight-shared.js`**: Player ID (`#ID:`), boss damage label (`Vurulan Hasar:`), slot titles all hardcoded
9. **`ships.html`**: All ship names (`Starter`, `Elite I`-`X`), design names (`Crystal Queen`, `Seahawk`) hardcoded
10. **`equipment.html`**: Cannon/mast names and all error messages hardcoded

### Number of hardcoded user-facing strings by file:
- `index.html`: ~15 strings (mostly Terms/Privacy body)
- `map.html`: ~15 strings (modals, labels, button)
- `shop.html`: ~3 strings
- `equipment.html`: ~12 strings (mostly JS error messages)
- `ships.html`: ~18 strings (ship/design names + errors)
- `my-hall.html`: ~12 strings (math descriptions + JS calculations)
- `hall-of-fame.html`: ~1 string (playtime format)
- `level-bonus.html`: ~25 strings (reward descriptions + errors)
- `daily-reward.html`: ~5 strings (month names + errors)
- `events.html`: ~8 strings (day/month names + errors)
- `glitter.html`: ~12 strings (reward labels + level up toast)
- `tower.html`: ~4 strings (difficulty labels)
- `pvp.html`: ~15 strings (rank names, buttons, errors)
- `admin.html`: ~30 strings (table headers, badges, field labels, buttons)
- `map.js`: ~6 strings
- `fight-shared.js`: ~5 strings
- `fight-pvp.js`: ~3 strings
- `fight-pve.js`: ~5 strings
- `api.js`: ~2 modals with ~6 lines of text each

**Total estimated hardcoded user-facing strings: ~180+**
