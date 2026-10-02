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

// 🔹 Config (Loaded securely from environment variables)
const DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/").replace(/\/$/, "");
const GRAFANA_URL = process.env.GRAFANA_URL || "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render";
const GRAFANA_LOGIN_URL = process.env.GRAFANA_LOGIN_URL || "https://monitor-public.trax-cloud.com/login";

let SESSION_ID = process.env.GRAFANA_SESSION_ID;
const GRAFANA_USER = process.env.GRAFANA_USERNAME;
const GRAFANA_PASS = process.env.GRAFANA_PASSWORD;

// 🔹 Telegram Config (Loaded securely from environment variables)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_DROPS = process.env.TELEGRAM_CHAT_ID_DROPS || process.env.TELEGRAM_CHAT_ID || "@NestPT, -1004486777652";

// 🔹 Continuous mode: Default to true unless single run specified
const isSingleRun = process.argv.includes("--single-run");

// 🔹 Helper: Send Telegram Alert (supports single or comma-separated chat IDs)
async function sendTelegram(msg, chatIds = CHAT_DROPS) {
  if (!TELEGRAM_TOKEN || !chatIds) {
    console.error("❌ Telegram Bot Token or Chat ID is missing! Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
    return;
  }
  const targets = (Array.isArray(chatIds) ? chatIds : String(chatIds).split(","))
    .map(c => c.trim())
    .filter(Boolean);

  for (const chatId of targets) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: "HTML"
        })
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`❌ Telegram API Error (${chatId}): ${data.description} (Error code: ${data.error_code})`);
        if (data.description && data.description.includes("can't parse entities")) {
          // Retry without HTML parse mode if entity parsing failed
          console.log(`🔄 Retrying ${chatId} alert in plain text...`);
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: msg.replace(/<[^>]+>/g, "")
            })
          });
        }
        if (data.error_code === 429) {
          const retryAfter = (data.parameters && data.parameters.retry_after) || 5;
          console.log(`⏳ Telegram rate limited. Waiting ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
        }
      } else {
        console.log(`📱 Telegram alert delivered to ${chatId} (Msg ID: ${data.result.message_id})`);
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`❌ Telegram request failed for ${chatId}:`, e.message);
    }
  }
}

// 🔹 Auto-login to Grafana to get fresh session cookie
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
      redirect: "manual"
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
      console.error("❌ Grafana login did not return a session cookie. Status:", res.status);
      return null;
    }
  } catch (e) {
    console.error("❌ Grafana auto-login error:", e.message);
    return null;
  }
}

// 🔹 Helper: Load Firebase credentials safely
function getFirebaseCredentials() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    const possibleFiles = ["service-account.json", "serviceAccountKey.json", "firebase-service-account.json"];
    for (const f of possibleFiles) {
      const p = path.resolve(process.cwd(), f);
      if (fs.existsSync(p)) {
        console.log(`📁 Found Firebase Service Account file: ${f}`);
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
  console.log("🔥 Firebase Admin SDK initialized.");
} else {
  console.log("🔥 Using Firebase Realtime Database REST API (Direct Access).");
}

// 🔹 Helper: Read / Write to Firebase Database
async function readFirebaseBaseline() {
  if (db) {
    try {
      const snap = await db.ref("masking/grafana/queue_metrics").once("value");
      if (snap.exists()) return snap.val();
    } catch (e) {}
  }
  try {
    const res = await fetch(`${DATABASE_URL}/masking/grafana/queue_metrics.json`);
    if (res.ok) {
      const data = await res.json();
      return data || {};
    }
  } catch (e) {}
  return {};
}

async function writeFirebaseMetrics(data) {
  if (db) {
    await db.ref("masking/grafana/queue_metrics").set(data);
    return;
  }
  const res = await fetch(`${DATABASE_URL}/masking/grafana/queue_metrics.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    console.error("❌ Firebase REST write failed with status:", res.status);
  }
}

let denominatorData = {};
let poolProjects = new Set();

async function fetchPoolProjects() {
  try {
    const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vT0M1HNtH1Y52wgEL4iqU2bhbNwLlOHbkaT480tOWhCAsxxQNrXPuzDvNZb9sG2HhxR-NGmMAx6ceqL/pub?gid=0&single=true&output=csv");
    if (!response.ok) return;
    const csvText = await response.text();
    const lines = csvText.split("\n");
    const temp = new Set();
    lines.forEach((line, index) => {
      if (index === 0) return;
      const row = parseCSVLine(line);
      if (row.length > 0) {
        const project = row[0].trim().toLowerCase();
        if (project) {
          temp.add(project);
        }
      }
    });
    poolProjects = temp;
    console.log(`🏊 Loaded ${poolProjects.size} pool projects from Google Sheets.`);
  } catch (e) {
    console.error("❌ Failed to fetch pool projects:", e.message);
  }
}

async function fetchDenominators() {
  try {
    const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTeBLEp0p0cP2CNbrEx1NyKQYKJw-uo-TFNs_GHgcUrNEXYhA79LbC3r8gei8b_DcXbywiwRhzmEYCs/pub?gid=1191322481&single=true&output=csv");
    if (!response.ok) return;
    const csvText = await response.text();
    const lines = csvText.split("\n");
    const temp = {};
    lines.forEach((line, index) => {
      if (index === 0) return;
      const row = parseCSVLine(line);
      if (row.length > 6) {
        const project = row[0].trim().toLowerCase();
        const maskingDeno = parseFloat(row[5]) || 0;
        const engineDeno = parseFloat(row[6]) || 0;
        if (project) {
          temp[project] = { masking: maskingDeno, engine: engineDeno };
        }
      }
    });
    denominatorData = temp;
    console.log(`📊 Loaded ${Object.keys(denominatorData).length} denominators from Google Sheets.`);
  } catch (e) {
    console.error("❌ Failed to fetch denominators:", e.message);
  }
}

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

const projects = [
  "abinbevbr", "abnz", "altriaus", "altriausdemo", "aneuae", "avidityuk", "batru", "bdftr", "beiersdorfar", "beiersdorfau", "beiersdorfbe", "beiersdorfbo", "beiersdorfbr", "beiersdorfchl",
  "beiersdorfco", "beiersdorfcz", "beiersdorfde", "beiersdorfec", "beiersdorfeg", "beiersdorffr", "beiersdorfgr", "beiersdorfgt", "beiersdorfid", "beiersdorfin", "beiersdorfit", "beiersdorfke",
  "beiersdorfkz", "beiersdorfmx", "beiersdorfmy", "beiersdorfng", "beiersdorfnz", "beiersdorfpe", "beiersdorfph", "beiersdorfpl", "beiersdorfpt", "beiersdorfpy", "beiersdorfro", "beiersdorfru",
  "beiersdorfsa", "beiersdorfse", "beiersdorfsp", "beiersdorfth", "beiersdorftw", "beiersdorfuae", "beiersdorfuk", "beiersdorfvn", "beiersdorfza", "bepensamx", "bikr", "bimboes", "bimbomx",
  "bimbous", "biph", "biseask", "bivn", "bluetritonusa", "cbcdairyil", "cbcil", "ccaau", "ccandinaar", "ccanz", "ccbr-prod", "ccjp", "ccjpvm", "cckh", "cckr", "cclibertyus",
  "ccphl", "ccusdemo", "ccza", "colgatelatam", "cpgdemo", "danonear", "danonejp", "danoneuk", "deltafoodsgr", "diageoar", "diageoau", "diageobaltics", "diageobenelux",
  "diageobr", "diageoca", "diageoco", "diageoes", "diageofr", "diageoga", "diageogh", "diageogr", "diageogtr", "diageogtrassetpilot", "diageoid", "diageoie",
  "diageoiedemo", "diageoin", "diageoit", "diageojp", "diageoke", "diageokr", "diageomx", "diageong", "diageopa", "diageopebac", "diageoph", "diageopl",
  "diageopt", "diageoromania", "diageosc", "diageosg", "diageostr", "diageoth", "diageotw", "diageotz", "diageoug", "diageouk", "diageous", "diageovn",
  "diageoza", "dkshmy", "dlcpt", "dollargeneraldmxus", "dreyerus", "Edit Menu", "Edit Normal", "essitymx", "FactpharmaBE", "fapharmabe", "fapharmafr", "fapharmafr2",
  "fazerfi", "femsaar", "femsamx", "ferreroid", "ferreromy", "ferreroph", "ferrerosg", "ferreroth", "ferrerovn", "fonterralk", "frucorau", "frucornz",
  "gdsar", "gmilac", "gmkr", "gmtw", "googlehk", "googlekr", "googlemx", "googleusa", "gpus", "gskau", "gskbg", "gskch", "gskcz", "gskde", "gskes",
  "gskesph", "gskfi", "gskglobal", "gskgr", "gskhu", "gskjp", "gskkz", "gsklt", "gsknz", "gskpl", "gskro", "gskruph", "gsksg", "gsksk", "gsktw",
  "gskua", "gskuz", "gskza", "haleonaesa", "haleonbr", "haleongb", "HALEONHU", "haleonil", "haleonmy", "haleonse", "haleonvn", "heinekenbr",
  "heinekentw", "heinzcr", "henkeltr", "hersheysusdemo", "hphoodus", "inbevci", "inbevnl", "intagejp2", "jdetr", "jdeza", "jnjanz", "jtiglobal",
  "jtihr", "jtimg", "jtiro", "jtisl", "jtius", "jtjp", "kenvuelatam", "kibonbr", "kirinjp", "kraftheinzde", "labattplnoptca", "LIGA", "lightpilotdemo",
  "lionaus", "lionnz", "markanthonygroupus", "marsbh", "marsegy", "marskw", "marsmx", "marsom", "marspl", "marsqa", "marssa", "marstr", "marsuae",
  "marsuk", "mdlzdk", "mdlzrusf", "MENU", "moethennessyar", "moethennessyus", "molsoncoorsuk", "mondelezau", "mondelezaz", "mondelezca",
  "mondelezde", "mondelezdmius", "mondelezeg", "mondelezes", "mondelezfi1", "mondelezge", "mondelezkaza", "mondelezmy", "mondelezno",
  "mondelezprt", "mondelezsa", "mondelezse", "mondelezsg", "mondeleztr", "mondelezukre", "mondelezusps", "mondelezusquality", "mondelezuz",
  "mondelezza", "munchysmy", "newellus", "nrfbodycare", "nrfleaftea", "nrfsoftdrinks", "odcbcil", "odccbr-prod", "oddiageoiedemo", "odmondelezdmius",
  "odmondelezukre", "odmondelezusps", "odnrfbodycare", "odnrfleaftea", "odnrfsoftdrinks", "odpngjp", "odstraussdryil", "odtempoil", "odulnl",
  "odulpt", "odunileveril", "odunilevermx", "odunileverus", "opellain", "penaflorar", "pepsibe", "pepsicoes", "pepsicofr", "pepsicopl",
  "pepsicotr", "pepsicouk", "pepside", "pepsidemoglobal", "pepsigt", "pernodin", "pernodricardes", "pernodus", "pgbaltics2", "pgcroatia",
  "pgcz", "pges", "pgespharma", "pghu", "pgpl", "pgpt", "pgsk", "pgua", "pguk", "pngbr", "pngcn-prod", "pnghk", "pngjp", "pngmx", "pngmy",
  "pngvn", "pngza2", "pureaidemoamer", "pureaidemoapac", "pureaidemoemea", "refriangoao", "rinielsen2", "risparkwinede", "rjreynoldsus",
  "sanofiae", "sanofiar", "sanofiat", "sanofiau", "sanofibe", "sanofibr", "sanofich", "sanofico", "sanoficz", "sanofide", "sanofiec",
  "sanofieg", "sanofies", "sanofifr", "sanofigr", "sanofihu", "sanofiit", "sanofijp", "sanofimx", "sanofipl", "sanofipt", "sanofiro",
  "sanofiru", "sanofisa", "sanofitr", "sanofiua", "schwartautkde", "scjohnsonar", "scjohnsonbr", "sindicatedmx", "sinoth", "sksignals",
  "solarbr", "straussdryil", "straussfritolayil", "straussil", "suntoryjp2", "teamcorelatam", "tempoil", "tevade", "tevapl", "tevaru",
  "tnuvailv2", "traxtobaccous", "tuborgro", "ulbe", "ulbr", "ulde", "ules", "ulgr", "ulit", "ulnl", "ulpt", "ulse", "uluk", "unileverau",
  "unileverco", "unileveril", "unileverken", "unileverlk", "unilevermx", "unilevernz", "unileverus", "yalolatam"
];

const metrics = [
  { path: "masking_engine",         name: "Masking Engine" },
  { path: "masking",                name: "Masking" }
];

let grafanaAuthError = false;

async function fetchProject(project) {
  if (!SESSION_ID) {
    await loginToGrafana();
    if (!SESSION_ID) return null;
  }

  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(`target=alias(prod.gauges.selector.queue.${m.path}.${project}.total,'${m.name} - Total')`);
    payloadParts.push(`target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.${project}.oldestTask,4),'${m.name} - Oldest Task')`);
    payloadParts.push(`target=alias(summarize(prod.counters.selector.outflow.${m.path}.${project}.count,'1d','sum',true),'${m.name} - Outflow')`);
  });
  const payload = payloadParts.join("&") + "&from=-1h&until=now&format=json";

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
      body: payload
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

    const groupedData = {};
    json.forEach(series => {
      if (!series || !series.datapoints) return;
      const dp = series.datapoints.filter(d => d[0] !== null);
      if (dp.length > 0) {
        const last = dp[dp.length - 1];
        const isOutflow = series.target && series.target.includes("Outflow");
        const isOldest = series.target && series.target.includes("Oldest Task");
        const mName = series.target ? series.target.split(" - ")[0] : "Unknown";

        if (!groupedData[mName]) groupedData[mName] = { total: 0, oldestTask: 0, outflow: 0 };
        if (isOutflow) groupedData[mName].outflow = last[0];
        else if (isOldest) groupedData[mName].oldestTask = last[0];
        else { groupedData[mName].total = last[0]; }
      }
    });
    return groupedData;
  } catch (e) {
    return null;
  }
}

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

  if (!isWithinActiveHours()) {
    console.log(`⏰ Current Colombo time is outside active hours (6 AM - 11 PM). Exiting gracefully.`);
    process.exit(0);
  }

  // Ensure valid Grafana session before loop
  if (!SESSION_ID) {
    await loginToGrafana();
  }

  // Fetch denominators & pool projects from Google Sheets
  await fetchDenominators();
  await fetchPoolProjects();

  console.log(`🚀 Starting Masking engine feeder (Mode: ${isSingleRun ? "Single Run" : "Continuous Infinite Monitor"})...`);
  const customDurationMin = parseFloat(process.env.RUN_DURATION_MINUTES);
  const RUN_DURATION_MS = (!isNaN(customDurationMin) && customDurationMin > 0)
    ? customDurationMin * 60 * 1000
    : Infinity;
  const startTime = Date.now();

  const INTERVAL_MS = 5000;
  let baselineData = await readFirebaseBaseline();
  let lastSavedHash = "";
  let lastWriteTimestamp = 0;

  while (Date.now() - startTime < RUN_DURATION_MS) {
    if (enforceTime && !isWithinActiveHours()) {
      console.log(`⏰ [${new Date().toLocaleTimeString()}] Current Colombo time is outside active hours (6 AM - 11 PM). Waiting 60s...`);
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }

    const cycleStart = Date.now();
    try {
      const BATCH_SIZE = 15;
      const results = [];
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);
        const batchRes = await Promise.all(batch.map(async p => ({ project: p, data: await fetchProject(p) })));
        results.push(...batchRes);
      }

      let validCount = 0;
      const allActiveData = {};
      for (const { project, data } of results) {
        if (!data || Object.keys(data).length === 0) continue;
        validCount++;
        const processed = {};
        let hasActivity = false;

        for (const mName of Object.keys(data)) {
          const cur = data[mName];
          const prev = (baselineData[project] && baselineData[project][mName]) ? baselineData[project][mName] : null;
          const minuteDelta = prev ? (cur.total - (prev.total || 0)) : 0;
          const outflowDelta = prev ? (cur.outflow - (prev.outflow || 0)) : 0;

          // Essential lightweight structure (saves 85% Firebase bandwidth)
          const metricObj = {
            total: cur.total || 0,
            minuteDelta: minuteDelta || 0,
            outflow: cur.outflow || 0,
            outflowDelta: outflowDelta || 0
          };
          if (cur.oldestTask > 0) metricObj.oldestTask = cur.oldestTask;

          processed[mName] = metricObj;

          if (cur.total > 0 || cur.outflow > 0 || minuteDelta !== 0 || outflowDelta !== 0) {
            hasActivity = true;
          }

          // Alerts for Masking and Masking Engine
          if (mName === "Masking Engine" || mName === "Masking") {
             const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
             const displayType = mName === "Masking Engine" ? "Engine Masking" : "Regular Masking";
             const isPool = poolProjects.has(project.toLowerCase());
             const emoji = isPool ? "🚫" : (mName === "Masking Engine" ? "🔴" : "🔵");
             
             // Get Deno Count
             const pKey = project.toLowerCase();
             const denoObj = denominatorData[pKey];
             const denoVal = denoObj ? (mName === "Masking Engine" ? denoObj.engine : denoObj.masking) : "-";

             if (minuteDelta < -15) {
                let queueWarning = "";
                if (cur.total > 100) queueWarning = " 🚨 (VERY HIGH)";
                else if (cur.total > 50) queueWarning = " ⚠️ (HIGH)";

                let denoPrefixOrSuffix = "";
                const parsedDeno = parseFloat(denoVal);
                if (!isNaN(parsedDeno) && parsedDeno >= 0.4) {
                   denoPrefixOrSuffix = " 🟢 (GOOD)";
                }

                // Compact pool badge (small indicator without huge warnings)
                const poolBadge = isPool ? " 🚫 <i>[POOL]</i>" : "";

                const msg = `<b>[${now}]</b>\n` +
                            `<b>${emoji} ${displayType} Alert:</b>\n\n` +
                            `<b>${project.toUpperCase()}${poolBadge}</b>\n\n` +
                            `<code>Drop:          ${minuteDelta}</code>\n` +
                            `<code>Current Queue: ${cur.total}${queueWarning}</code>\n` +
                            `<code>Deno:          ${denoVal}${denoPrefixOrSuffix}</code>\n` +
                            `<code>Outflow:       ${cur.outflow}</code>`;
                console.log(`🚨 Alert sent for ${project} (${mName})! Drop: ${minuteDelta}${isPool ? " [Pool]" : ""}`);
                await sendTelegram(msg, CHAT_DROPS);
             }
          }
        }

        // Only store projects with actual tasks or active queues
        if (hasActivity) {
          allActiveData[project] = processed;
        }
      }

      if (validCount > 0) {
        const currentHash = JSON.stringify(allActiveData);
        const timeSinceLastWrite = Date.now() - lastWriteTimestamp;

        // 🔹 Smart Save: Only write to Firebase if data changed OR every 30 seconds
        if (currentHash !== lastSavedHash || timeSinceLastWrite >= 30000) {
          await writeFirebaseMetrics({ ...allActiveData, _lastUpdated: Date.now() });
          lastSavedHash = currentHash;
          lastWriteTimestamp = Date.now();
          console.log(`✅ [${new Date().toLocaleTimeString()}] Saved ${Object.keys(allActiveData).length} active projects to Firebase (Optimized).`);
        } else {
          console.log(`⚡ [${new Date().toLocaleTimeString()}] No metric changes detected. Skipped Firebase write to save bandwidth.`);
        }
        baselineData = allActiveData;
      }
    } catch (e) {
      console.error("❌ Cycle error:", e.message);
    }

    if (isSingleRun) {
      console.log("🏁 Single run completed.");
      break;
    }

    const elapsed = Date.now() - cycleStart;
    const sleepTime = Math.max(1000, INTERVAL_MS - elapsed);
    await new Promise(r => setTimeout(r, sleepTime));
  }

  if (db && admin.apps.length) await admin.app().delete();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal Error:", err);
  setTimeout(() => main(), 5000);
});
