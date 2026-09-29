# Secrets & Local Setup Guide (සිංහල උපදෙස්)

මේ project එක ඔයාගේ local computer එකේ හෝ GitHub Actions එකේ run කරගන්නේ කොහොමද කියලා මෙතනින් බලන්න.

---

## 1. Local එකේ Run කරගන්නා ආකාරය (Quick Start)

### පියවර 1: `.env` file එක සකස් කිරීම
Project root එකේ තියෙන [.env](file:///d:/masking%20feeder/.env) file එක open කරලා පහත තොරතුරු පුරවන්න:

1. **`GRAFANA_SESSION_ID`**:
   - Grafana dashboard එකට login වෙන්න (`https://monitor.trax-cloud.com`).
   - Browser එකේ `F12` ඔබන්න -> **Application** (Chrome) / **Storage** (Firefox) -> **Cookies** -> `monitor.trax-cloud.com`.
   - `grafana_session` එකේ value එක copy කර [.env](file:///d:/masking%20feeder/.env) එකට දාන්න.

2. **`FIREBASE_SERVICE_ACCOUNT`**:
   - Firebase Console -> **Project Settings** -> **Service Accounts** -> **Generate New Private Key** click කරන්න.
   - Download වන `.json` file එක project folder එකට දාලා නම `service-account.json` කියලා rename කරන්න (හෝ සම්පූර්ණ JSON content එක `.env` එකට paste කරන්න).

3. **`TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`**:
   - Default bot token එක හා channel username එක (`@NestPT`) දැනටමත් configure කර ඇත. වෙනස් කිරීමට අවශ්‍ය නම් පමණක් වෙනස් කරන්න.

---

## 2. Testing සහ Scripts

- **Telegram Alert Test කිරීමට:**
  ```bash
  npm run test-telegram
  ```
  *(හෝ [test_telegram.bat](file:///d:/masking%20feeder/test_telegram.bat) double-click කරන්න)*

- **Grafana Session Test කිරීමට:**
  ```bash
  npm run test-grafana
  ```

- **Feeder එක Continuous (නොනැවතී) Run කිරීමට:**
  ```bash
  npm run dev
  ```
  *(හෝ [start_masking.bat](file:///d:/masking%20feeder/start_masking.bat) double-click කරන්න)*

- **Single Run (GitHub Actions මාදිලිය):**
  ```bash
  npm start
  ```

---

## 3. Telegram Notifications නොඑන හේතු සහ විසඳුම්

1. **Drop එක < -15 නොවීම:** Telegram alert යවන්නේ queue එකේ drop එක -15 ට වඩා වැඩි වූ විට පමණි (`minuteDelta < -15`).
2. **Grafana Session Expire වීම:** `GRAFANA_SESSION_ID` expire වී ඇත්නම් Grafana වලින් data නොලැබේ. `npm run test-grafana` run කර session එක check කරන්න.
3. **Bot Permissions:** Bot, channel එකේ Administrator ලෙස add කර message post කිරීමට permission ලබාදී තිබිය යුතුය.

---

## 4. GitHub Actions Setup

GitHub repo එකේ **Settings** -> **Secrets and variables** -> **Actions** වෙත ගොස් පහත Secrets add කරන්න:

| Secret Name | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Private Key JSON (සම්පූර්ණ JSON text එක) |
| `FIREBASE_DATABASE_URL` | `https://projectallow-default-rtdb.firebaseio.com/` |
| `GRAFANA_SESSION_ID` | Grafana session cookie value |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID / Channel (`@NestPT`) |
