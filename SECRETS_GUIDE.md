# Secrets Setup Guide (සිංහල උපදෙස්)

මේ script එක හරියට වැඩ කරන්න නම් ඔයා පහත දේවල් ටික GitHub එකට හෝ `.env` file එකට ඇතුලත් කරන්න ඕනේ.

## 1. FIREBASE_SERVICE_ACCOUNT
මේක තමයි වැදගත්ම දේ. මේක ගන්න විදිහ:
1. Firebase Console එකට යන්න.
2. **Project Settings** (gear icon) -> **Service Accounts** වලට යන්න.
3. **Generate New Private Key** button එක click කරන්න.
4. Download වුන `.json` file එක open කරලා ඒකේ තියෙන මුළු code එකම (curly braces `{ }` එක්කම) කොපි කරගන්න.
5. GitHub එකේ `FIREBASE_SERVICE_ACCOUNT` කියලා secret එකක් හදලා ඒකට මේ code එක paste කරන්න.

## 2. GRAFANA_SESSION_ID
 Grafana dashboard එකෙන් data ගන්න මේ session ID එක ඕනේ:
1. Grafana dashboard එකට login වෙන්න.
2. Browser එකේ `F12` හෝ Right Click කරලා `Inspect` කරන්න.
3. **Application** (Chrome) හෝ **Storage** (Firefox) tab එකට යන්න.
4. **Cookies** යටතේ `monitor.trax-cloud.com` තෝරන්න.
5. එතන තියෙන `grafana_session` කියන එකේ `Value` එක කොපි කරගන්න.
6. GitHub එකේ `GRAFANA_SESSION_ID` කියලා secret එකක් හදලා ඒකට මේක paste කරන්න.

---

## English Guide

### 1. FIREBASE_SERVICE_ACCOUNT
1. Go to Firebase Console -> Project Settings -> Service Accounts.
2. Click **Generate New Private Key**.
3. Open the downloaded `.json` file and copy the **entire content**.
4. Add it to GitHub Secrets as `FIREBASE_SERVICE_ACCOUNT`.

### 2. GRAFANA_SESSION_ID
1. Log in to your Grafana dashboard.
2. Open Browser Dev Tools (F12) -> Application -> Cookies.
3. Copy the value of the `grafana_session` cookie.
4. Add it to GitHub Secrets as `GRAFANA_SESSION_ID`.

---

## Local Testing
ඔයාගේ computer එකේ මේක run කරන්න ඕනේ නම්:
1. මේ project එකේ `.env` කියලා file එකක් හදන්න.
2. `.env.example` එකේ තියෙන විදිහට අර secrets ටික ඒකට දාන්න.
3. `npm install` කරලා `npm start` කරන්න.
