require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔹 Config
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/";
const GRAFANA_URL = "https://monitor.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

// 🔹 Telegram Config
const TELEGRAM_BOT_TOKEN = "1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA";
const TELEGRAM_CHAT_ID = "@MONDELEZSE";

// 🔹 Validate Secrets
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ ERROR: FIREBASE_SERVICE_ACCOUNT is missing!");
  process.exit(1);
}

if (!SESSION_ID) {
  console.error("❌ ERROR: GRAFANA_SESSION_ID is missing!");
  process.exit(1);
}

// 🔹 Firebase init
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("❌ ERROR: FIREBASE_SERVICE_ACCOUNT is not a valid JSON string!");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  });
}
const db = admin.database();

const projects = [
  "pepsicouk", "ulpt", "dlcpt", "bdftr", "mdlzrusf", "marspl", "mondelezde", "mondelezno", "mondelezkaza", "jtihr", "pngza2", "beiersdorfuk", "mondelezsa", "beiersdorfsp", "jdetr", "ulbe", "diageotz", "beiersdorfru", "marssa", "diageoie", "beiersdorfng", "marsbh", "marskw", "marsom", "marsqa", "mondelezse", "marsuae", "beiersdorfgr", "diageoes", "mondelezza"
];

const metrics = [
  { path: "voting_engine", name: "Voting Engine" }
];

// 🔹 Telegram Helper
async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) console.error("❌ Telegram failed:", await res.text());
    else console.log("✅ Telegram message sent.");
  } catch (err) {
    console.error("❌ Telegram error:", err.message);
  }
}

// 🔹 Fetch helper
async function fetchProject(project) {
  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(`target=alias(prod.gauges.selector.queue.${m.path}.${project}.total,'${m.name} - Total')`);
    payloadParts.push(`target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.${project}.oldestTask,4),'${m.name} - Oldest Task')`);
  });
  const payload = payloadParts.join("&") + "&from=-1h&until=now&format=json";

  try {
    const response = await fetch(GRAFANA_URL, {
      method: "POST",
      headers: {
        "Cookie": `grafana_session=${SESSION_ID}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    });
    if (!response.ok) return null;
    const json = await response.json();
    const groupedData = {};
    json.forEach(series => {
      const lastValidPoint = series.datapoints.filter(dp => dp[0] !== null).pop();
      if (lastValidPoint) {
        const timestamp = lastValidPoint[1] * 1000;
        const value = lastValidPoint[0];
        const isOldestTask = series.target.includes("Oldest Task");
        const metricName = series.target.replace(" - Total", "").replace(" - Oldest Task", "");
        if (!groupedData[metricName]) groupedData[metricName] = { lastUpdated: timestamp, total: null, oldestTask: null };
        if (isOldestTask) groupedData[metricName].oldestTask = value;
        else { groupedData[metricName].total = value; groupedData[metricName].lastUpdated = timestamp; }
      }
    });
    return groupedData;
  } catch (e) { return null; }
}

// 🔹 Main loop
async function main() {
  console.log("🚀 Starting Engine Voting fetch cycle with Telegram Alerts...");
  const RUN_DURATION_MS = 55 * 1000;
  const INTERVAL_MS     = 5000;
  const startTime = Date.now();
  let alertedSet = new Set(); // Track alerts in this script run

  console.log("📥 Fetching baseline...");
  let baselineData = {};
  try {
    const snapshot = await db.ref("engine-voting/grafana/queue_metrics").once("value");
    if (snapshot.exists()) baselineData = snapshot.val();
  } catch (err) {}

  const hardKillTimer = setTimeout(() => process.exit(0), 58 * 1000);

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const cycleStart = Date.now();
    try {
      const results = await Promise.all(projects.map(async p => ({ project: p, data: await fetchProject(p) })));
      const allDataWithDelta = {};

      for (const { project, data } of results) {
        if (!data) continue;
        const processed = {};
        
        Object.keys(data).forEach(mName => {
          const current = data[mName];
          const baseline = baselineData[project] ? baselineData[project][mName] : null;
          let delta = 0;

          if (baseline && baseline.total !== null && current.total !== null) {
            delta = current.total - baseline.total;
            
            // ⚠️ ALERT LOGIC: Drop > 5 pieces
            const drop = baseline.total - current.total;
            if (drop > 5 && !alertedSet.has(project)) {
              const msg = `⚠️ ${project.toUpperCase()} Engine Voting Drop!\nPrevious: ${baseline.total}\nCurrent: ${current.total}\nDrop: -${drop}`;
              sendTelegram(msg);
              alertedSet.add(project);
            }
          }
          processed[mName] = { ...current, minuteDelta: delta };
        });
        allDataWithDelta[project] = processed;
      }

      await db.ref("engine-voting/grafana/queue_metrics").set({ ...allDataWithDelta, _lastUpdated: Date.now() });
      console.log(`✅ Update complete: ${new Date().toLocaleTimeString()}`);
    } catch (e) { console.error("❌ Cycle error:", e.message); }

    const waitTime = Math.max(1000, (cycleStart + INTERVAL_MS) - Date.now());
    await new Promise(r => setTimeout(r, waitTime));
  }
  clearTimeout(hardKillTimer);
  await admin.app().delete();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
