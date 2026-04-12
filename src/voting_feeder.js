require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔹 Config
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/";
const GRAFANA_URL = "https://monitor.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

// 🔹 Telegram Config
const TELEGRAM_TOKEN = "1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA";
const CHAT_NESTPT = "@NestPT";
const CHAT_MONDELEZSE = "@MONDELEZSE";

async function sendTelegram(msg, chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`;
  try { await fetch(url); } catch (e) { console.error("❌ Telegram failed:", e.message); }
}

// 🔹 Firebase init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: DATABASE_URL
  });
}
const db = admin.database();

const projects = [
  "straussil", "cbcdairyil", "straussdryil", "mondelezuz", "danoneuk", "mdlzrusf", "gskhu", "pgpl", "mondelezza", "ulnl", "beiersdorfkz", "beiersdorfpt",
  "pepsicouk", "ulpt", "dlcpt", "bdftr", "marspl", "mondelezde", "mondelezno", "jtihr", "pngza2", "beiersdorfuk", "mondelezsa", "beiersdorfsp", "jdetr", "diageotz", "beiersdorfru", "marssa", "marsbh", "marsom", "mondelezse", "marsuae", "beiersdorfgr"
];

const metrics = [
  { path: "voting_engine", name: "Voting Engine" }
];

async function fetchProject(project) {
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
      headers: { "Cookie": `grafana_session=${SESSION_ID}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    });
    if (!response.ok) return null;
    const json = await response.json();
    const groupedData = {};
    json.forEach(series => {
      const dp = series.datapoints.filter(d => d[0] !== null);
      if (dp.length > 0) {
        const last = dp[dp.length - 1];
        const isOutflow = series.target.includes("Outflow");
        const isOldest = series.target.includes("Oldest Task");
        const mName = series.target.split(" - ")[0];

        if (!groupedData[mName]) groupedData[mName] = { lastUpdated: last[1]*1000, total: 0, oldestTask: 0, outflow: 0 };
        if (isOutflow) groupedData[mName].outflow = last[0];
        else if (isOldest) groupedData[mName].oldestTask = last[0];
        else { groupedData[mName].total = last[0]; groupedData[mName].lastUpdated = last[1]*1000; }
      }
    });
    return groupedData;
  } catch (e) { return null; }
}

async function main() {
  console.log("🚀 Starting specialized Voting Engine feeder...");
  const RUN_DURATION_MS = 55 * 1000;
  const INTERVAL_MS     = 5000;
  const startTime = Date.now();
  let baselineData = {};

  try {
    const snap = await db.ref("engine-voting/grafana/queue_metrics").once("value");
    if (snap.exists()) baselineData = snap.val();
  } catch (e) {}

  const killTimer = setTimeout(() => process.exit(0), 58 * 1000);

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const cycleStart = Date.now();
    try {
      const BATCH_SIZE = 15;
      const results = [];
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);
        const batchRes = await Promise.all(batch.map(async p => ({ project: p, data: await fetchProject(p) })));
        results.push(...batchRes);
      }

      const allData = {};
      for (const { project, data } of results) {
        if (!data) continue;
        const processed = {};
        for (const mName of Object.keys(data)) {
          const cur = data[mName];
          const prev = (baselineData[project] && baselineData[project][mName]) ? baselineData[project][mName] : null;
          const minuteDelta = prev ? cur.total - prev.total : 0;
          const outflowDelta = prev ? cur.outflow - (prev.outflow || 0) : 0;

          processed[mName] = { ...cur, minuteDelta, outflowDelta };

          // Alerts
          if (mName === "Voting Engine" && minuteDelta < -15) {
            await sendTelegram(`🚨 Voting Drop: ${project.toUpperCase()}\nDrop: ${minuteDelta}\nQueue: ${cur.total}`, CHAT_NESTPT);
          }
          if (mName === "Voting Engine" && outflowDelta > 0) {
            await sendTelegram(`✅ Voting Increase: ${project.toUpperCase()}\nAmount: +${outflowDelta}\nTotal Outflow: ${cur.outflow}`, CHAT_MONDELEZSE);
          }
        }
        allData[project] = processed;
      }

      await db.ref("engine-voting/grafana/queue_metrics").set({ ...allData, _lastUpdated: Date.now() });
      console.log(`✅ Updated: ${new Date().toLocaleTimeString()}`);
    } catch (e) { console.error("❌ Cycle error:", e.message); }

    await new Promise(r => setTimeout(r, Math.max(1000, (cycleStart + INTERVAL_MS) - Date.now())));
  }
  clearTimeout(killTimer);
  await admin.app().delete();
  process.exit(0);
}

main().catch(() => process.exit(1));
