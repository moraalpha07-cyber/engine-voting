require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// =========================================================================
// 🔹 Global Error Handlers (Prevents Bot from Crashing on Network Glitches)
// =========================================================================
process.on("uncaughtException", (err) => {
  console.error("⚠️ [Recovered] Uncaught Exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [Recovered] Unhandled Promise Rejection:", reason);
});

// =========================================================================
// 🔹 Configuration
// =========================================================================
const DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/").replace(/\/$/, "");
const GRAFANA_URL = process.env.GRAFANA_URL || "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render";
const GRAFANA_LOGIN_URL = process.env.GRAFANA_LOGIN_URL || "https://monitor-public.trax-cloud.com/login";

let SESSION_ID = process.env.GRAFANA_SESSION_ID;
const GRAFANA_USER = process.env.GRAFANA_USERNAME;
const GRAFANA_PASS = process.env.GRAFANA_PASSWORD;

// Telegram Config
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Dedicated Inflow Chat / Channel / Group ID (Falls back to Masking Easy group)
const TELEGRAM_CHAT_INFLOW = process.env.TELEGRAM_CHAT_ID_INFLOW || "-1004486777652";

// Google Sheet URL for Deno RPH > 60 Filter
const SHEET_CSV_URL = process.env.INFLOW_SHEET_CSV_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQNNSc4kr3Q0JqpkAgOW6Po8KECailK3FVp81Zj4y2X8R7KWVfDGvmbizcatCXqUreoRP2T366ehw-R/pub?gid=619575519&single=true&output=csv";
const DENO_RPH_THRESHOLD = parseFloat(process.env.INFLOW_DENO_RPH_THRESHOLD) || 60;

// Continuous Mode: Run continuously forever by default
const isSingleCycle = process.argv.includes("--single-cycle");

// =========================================================================
// 🔹 Telegram Alert Helper
// =========================================================================
async function sendTelegram(msg, chatId = TELEGRAM_CHAT_INFLOW) {
  if (!TELEGRAM_TOKEN || !chatId) {
    console.error("❌ Telegram Bot Token or Chat ID is missing! Please configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID_INFLOW.");
    return false;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: "HTML"
      }),
      timeout: 10000
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`❌ Telegram API Error (${chatId}): ${data.description} (Code: ${data.error_code})`);
      if (data.error_code === 429) {
        const retryAfter = (data.parameters && data.parameters.retry_after) || 5;
        console.log(`⏳ Telegram rate limited. Waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      }
      return false;
    } else {
      console.log(`📱 Inflow Alert delivered to ${chatId} (Msg ID: ${data.result.message_id})`);
      await new Promise(r => setTimeout(r, 200));
      return true;
    }
  } catch (e) {
    console.error("❌ Telegram request failed:", e.message);
    return false;
  }
}

// =========================================================================
// 🔹 Grafana Session & Auto-Login
// =========================================================================
async function loginToGrafana() {
  if (!GRAFANA_USER || !GRAFANA_PASS) {
    return null;
  }
  console.log("🔐 Logging in to Grafana as:", GRAFANA_USER);
  try {
    const res = await fetch(GRAFANA_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: GRAFANA_USER,
        email: GRAFANA_USER,
        password: GRAFANA_PASS
      }),
      redirect: "manual",
      timeout: 15000
    });

    const cookies = res.headers.raw()['set-cookie'] || [];
    let sessionCookie = null;
    cookies.forEach(c => {
      const match = c.match(/grafana_session=([^;]+)/);
      if (match) {
        sessionCookie = match[1];
      }
    });

    if (sessionCookie) {
      console.log("🎉 Successfully acquired new Grafana session cookie!");
      SESSION_ID = sessionCookie;
      return sessionCookie;
    } else {
      console.error("❌ Grafana login did not return session cookie. Status:", res.status);
      return null;
    }
  } catch (e) {
    console.error("❌ Grafana auto-login error:", e.message);
    return null;
  }
}

// =========================================================================
// 🔹 Firebase Realtime DB Setup (Optional State Storage)
// =========================================================================
function getFirebaseCredentials() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    const possibleFiles = ["service-account.json", "serviceAccountKey.json", "firebase-service-account.json"];
    for (const f of possibleFiles) {
      const p = path.resolve(process.cwd(), f);
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    }
    return null;
  }
  const resolvedPath = path.resolve(process.cwd(), sa);
  if (fs.existsSync(resolvedPath)) {
    return JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  }
  try {
    return JSON.parse(sa);
  } catch (e) {
    try {
      return JSON.parse(sa.replace(/\\n/g, "\n"));
    } catch (e2) {
      return null;
    }
  }
}

let db = null;
const creds = getFirebaseCredentials();
if (creds) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      databaseURL: DATABASE_URL
    });
  }
  db = admin.database();
}

async function readFirebaseInflowBaseline() {
  if (db) {
    try {
      const snap = await db.ref("inflow/grafana/queue_metrics").once("value");
      if (snap.exists()) return snap.val();
    } catch (e) {}
  }
  try {
    const res = await fetch(`${DATABASE_URL}/inflow/grafana/queue_metrics.json`, { timeout: 10000 });
    if (res.ok) {
      const data = await res.json();
      return data || {};
    }
  } catch (e) {}
  return {};
}

async function writeFirebaseInflowMetrics(data) {
  if (db) {
    await db.ref("inflow/grafana/queue_metrics").set(data);
    return;
  }
  try {
    await fetch(`${DATABASE_URL}/inflow/grafana/queue_metrics.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      timeout: 10000
    });
  } catch (e) {}
}

// =========================================================================
// 🔹 Parse CSV Helper
// =========================================================================
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Map task name from sheet to Grafana metric path and display name
function getTaskDetails(rawTask) {
  const normalized = (rawTask || "").toLowerCase().trim();
  if (normalized.includes("engine")) {
    return { path: "masking_engine", name: "Masking Engine", displayName: "Engine Masking", emoji: "🔴" };
  }
  return { path: "masking", name: "Masking", displayName: "Regular Masking", emoji: "🔵" };
}

// =========================================================================
// 🔹 Dynamic Sheet Fetcher (Deno RPH > 60)
// =========================================================================
let monitoredTargets = []; // Array of { task, project, count, time, rph, deno, denoRph, metricPath, metricName, displayName, emoji, key }

async function fetchMonitoredTargets() {
  try {
    console.log(`📥 Fetching target projects from Google Sheets (Threshold: Deno RPH > ${DENO_RPH_THRESHOLD})...`);
    const res = await fetch(SHEET_CSV_URL, { timeout: 15000 });
    if (!res.ok) {
      console.error("❌ Failed to fetch Google Sheet CSV. HTTP status:", res.status);
      return;
    }
    const csvText = await res.text();
    const lines = csvText.split("\n");
    const targets = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      if (cols.length >= 7) {
        const rawTask = cols[0].trim();
        const project = cols[1].trim().toLowerCase();
        const count = cols[2].trim();
        const time = cols[3].trim();
        const rph = cols[4].trim();
        const deno = cols[5].trim();
        const denoRph = parseFloat(cols[6].trim()) || 0;

        if (denoRph > DENO_RPH_THRESHOLD && project) {
          const taskInfo = getTaskDetails(rawTask);
          targets.push({
            rawTask,
            project,
            count,
            time,
            rph,
            deno,
            denoRph,
            metricPath: taskInfo.path,
            metricName: taskInfo.name,
            displayName: taskInfo.displayName,
            emoji: taskInfo.emoji,
            key: `${project}_${taskInfo.path}`
          });
        }
      }
    }

    if (targets.length > 0) {
      monitoredTargets = targets;
      console.log(`🎯 Loaded ${monitoredTargets.length} target projects with Deno RPH > ${DENO_RPH_THRESHOLD}`);
    } else {
      console.warn("⚠️ No targets found with Deno RPH >", DENO_RPH_THRESHOLD);
    }
  } catch (e) {
    console.error("❌ Error fetching target sheet:", e.message);
  }
}

// =========================================================================
// 🔹 Grafana Query Helper
// =========================================================================
let grafanaAuthError = false;

async function fetchProjectMetrics(project, metricPath, metricName) {
  if (!SESSION_ID) {
    await loginToGrafana();
    if (!SESSION_ID) return null;
  }

  const payload = [
    `target=alias(prod.gauges.selector.queue.${metricPath}.${project}.total,'${metricName} - Total')`,
    `target=alias(aliasByNode(prod.gauges.selector.queue.${metricPath}.${project}.oldestTask,4),'${metricName} - Oldest Task')`,
    `target=alias(summarize(prod.counters.selector.outflow.${metricPath}.${project}.count,'1d','sum',true),'${metricName} - Outflow')`
  ].join("&") + "&from=-1h&until=now&format=json";

  try {
    const response = await fetch(GRAFANA_URL, {
      method: "POST",
      headers: {
        "Cookie": `grafana_session=${SESSION_ID}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-grafana-org-id": "18",
        "x-dashboard-id": "862",
        "x-panel-id": "30"
      },
      body: payload,
      timeout: 10000
    });

    if (response.status === 401 || response.status === 403) {
      if (!grafanaAuthError) {
        console.warn(`⚠️ Grafana session expired. Attempting auto-login...`);
        grafanaAuthError = true;
        await loginToGrafana();
        grafanaAuthError = false;
      }
      return null;
    }

    if (!response.ok) return null;

    const json = await response.json();
    if (!Array.isArray(json)) return null;

    let total = 0;
    let oldestTask = 0;
    let outflow = 0;

    json.forEach(series => {
      if (!series || !series.datapoints) return;
      const dp = series.datapoints.filter(d => d[0] !== null);
      if (dp.length > 0) {
        const last = dp[dp.length - 1];
        if (series.target && series.target.includes("Outflow")) {
          outflow = last[0];
        } else if (series.target && series.target.includes("Oldest Task")) {
          oldestTask = last[0];
        } else {
          total = last[0];
        }
      }
    });

    return { total, oldestTask, outflow };
  } catch (e) {
    return null;
  }
}

// =========================================================================
// 🔹 Main Inflow Monitoring Loop
// =========================================================================
async function main() {
  const enforceTime = process.env.ENFORCE_ACTIVE_HOURS === "true";
  function isWithinActiveHours() {
    if (!enforceTime) return true;
    const colomboHour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Colombo',
      hour: 'numeric',
      hour12: false
    }).format(new Date()), 10);
    return colomboHour >= 6 && colomboHour < 23;
  }

  console.log("=================================================================");
  console.log("🚀 STARTING GRAFANA INFLOW MONITOR (Deno RPH > 60)");
  console.log(`🎯 Target Telegram Chat: ${TELEGRAM_CHAT_INFLOW}`);
  console.log(`⚙️ Mode: ${isSingleCycle ? "Single Cycle Test" : "Continuous Infinite Background Monitor"}`);
  console.log("=================================================================");

  // Ensure Grafana session
  if (!SESSION_ID) {
    await loginToGrafana();
  }

  // Initial fetch of monitored projects from Google Sheet (with retries)
  let sheetRetry = 0;
  while (monitoredTargets.length === 0 && sheetRetry < 5) {
    sheetRetry++;
    await fetchMonitoredTargets();
    if (monitoredTargets.length === 0) {
      console.log(`⏳ Retrying Google Sheet fetch (${sheetRetry}/5) in 3 seconds...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (monitoredTargets.length === 0) {
    console.warn("⚠️ No target projects loaded from Google Sheet yet. Monitoring will keep retrying.");
  }

  const customDurationMin = parseFloat(process.env.RUN_DURATION_MINUTES);
  const RUN_DURATION_MS = (!isNaN(customDurationMin) && customDurationMin > 0)
    ? customDurationMin * 60 * 1000
    : Infinity;
  const startTime = Date.now();

  const INTERVAL_MS = 5000; // Check every 5 seconds for fast alert response
  let baselineData = await readFirebaseInflowBaseline(); // In-memory baseline dictionary initialized with last saved state
  let lastSavedHash = "";
  let lastSheetRefreshTime = Date.now();
  let cycleCount = 0;

  while (Date.now() - startTime < RUN_DURATION_MS) {
    if (enforceTime && !isWithinActiveHours()) {
      console.log(`⏰ [${new Date().toLocaleTimeString()}] Current Colombo time is outside active hours (6 AM - 11 PM). Waiting 60s...`);
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }

    // 🔹 Refresh Google Sheet once every 1 hour to get the latest list of good Deno projects
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (Date.now() - lastSheetRefreshTime >= ONE_HOUR_MS) {
      console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Hourly Refresh: Fetching latest Deno > 60 projects from Google Sheets...`);
      await fetchMonitoredTargets();
      lastSheetRefreshTime = Date.now();
    }

    const cycleStart = Date.now();
    cycleCount++;

    try {
      const BATCH_SIZE = 12;
      const currentCycleData = {};
      let alertCountThisCycle = 0;

      for (let i = 0; i < monitoredTargets.length; i += BATCH_SIZE) {
        const batch = monitoredTargets.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async item => {
          const res = await fetchProjectMetrics(item.project, item.metricPath, item.metricName);
          return { item, data: res };
        }));

        for (const { item, data } of batchResults) {
          if (!data) continue;

          const key = item.key;
          const currentTotal = data.total || 0;
          const prevEntry = baselineData[key];
          const prevTotal = prevEntry !== undefined ? (prevEntry.total || 0) : 0;
          const minuteDelta = currentTotal - prevTotal;

          currentCycleData[key] = {
            project: item.project,
            task: item.metricPath,
            total: currentTotal,
            outflow: data.outflow || 0,
            oldestTask: data.oldestTask || 0,
            minuteDelta: minuteDelta,
            lastChecked: Date.now()
          };

          // 🚨 INFLOW DETECTION:
          // Trigger alert on EVERY positive queue addition (inflow > 0 and currentTotal > 0)
          if (minuteDelta > 0 && currentTotal > 0) {
            alertCountThisCycle++;
            const nowColombo = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
            
            const parsedDeno = parseFloat(item.deno) || 0;
            const isHighDeno = parsedDeno >= 1.0;
            const highDenoBadge = isHighDeno ? " 🔥 <b>[HIGH DENO &gt; 1.0]</b>" : "";
            const denoLine = isHighDeno
              ? `<code>Deno:          ${item.deno} 🔥 (HIGH &gt; 1.0)</code>`
              : `<code>Deno:          ${item.deno}</code>`;

            const msg = `<b>[${nowColombo}]</b>\n` +
                        `<b>${item.emoji} 📥 INFLOW ALERT (Deno RPH &gt; 60):</b>${highDenoBadge}\n\n` +
                        `<b>Project:</b> <code>${item.project.toUpperCase()}</code>\n` +
                        `<b>Task:</b> <code>${item.displayName}</code>\n\n` +
                        `<code>Inflow Added:  +${minuteDelta}</code>\n` +
                        `<code>Current Queue: ${currentTotal}</code>\n` +
                        `<code>Deno RPH:      ${item.denoRph}</code>\n` +
                        `${denoLine}\n` +
                        `<code>Outflow:       ${data.outflow}</code>`;

            console.log(`🚨 [Alert #${alertCountThisCycle}] Inflow detected for ${item.project.toUpperCase()} (${item.displayName})! Added: +${minuteDelta}, Total: ${currentTotal}, Deno: ${item.deno}${isHighDeno ? " [HIGH DENO > 1.0]" : ""}`);
            await sendTelegram(msg, TELEGRAM_CHAT_INFLOW);
          }
        }
      }

      if (Object.keys(currentCycleData).length > 0) {
        // Save to Firebase if changed
        const currentHash = JSON.stringify(currentCycleData);
        if (currentHash !== lastSavedHash) {
          await writeFirebaseInflowMetrics({ ...currentCycleData, _lastUpdated: Date.now() });
          lastSavedHash = currentHash;
        }

        // Update in-memory baseline
        baselineData = currentCycleData;

        if (cycleCount === 1) {
          console.log(`✅ [${new Date().toLocaleTimeString()}] Baseline active for ${Object.keys(currentCycleData).length} target projects. Monitoring inflow continuously.`);
        } else if (cycleCount % 12 === 0) { // Log heartbeat every ~1 minute
          console.log(`💓 [${new Date().toLocaleTimeString()}] Monitoring active (${Object.keys(currentCycleData).length} projects checked, Cycle #${cycleCount})`);
        }
      }

      if (isSingleCycle) {
        console.log("🏁 Single cycle completed.");
        break;
      }
    } catch (cycleErr) {
      console.error("❌ Inflow cycle error:", cycleErr.message);
    }

    const elapsed = Date.now() - cycleStart;
    const sleepTime = Math.max(1000, INTERVAL_MS - elapsed);
    await new Promise(r => setTimeout(r, sleepTime));
  }

  if (db && admin.apps.length) await admin.app().delete();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal Error in Inflow Monitor:", err);
  // Auto-restart after 5s if main fails
  setTimeout(() => main(), 5000);
});
