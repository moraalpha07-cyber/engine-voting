require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔹 Config
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/";
const GRAFANA_URL = "https://monitor.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

// 🔹 Telegram Config
const TELEGRAM_TOKEN = "1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA";
const TELEGRAM_CHAT_ID = "@NestPT";

async function sendTelegramAlert(project, delta, current) {
  const text = encodeURIComponent(`🚨 Masking Alert: ${project.toUpperCase()}\nAdu Wena Gaana: ${Math.abs(delta)}\nCurrent Queue: ${current}`);
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${text}`;
  try {
    await fetch(url);
    console.log(`📡 Telegram alert sent for ${project}`);
  } catch (e) {
    console.error("❌ Telegram error:", e.message);
  }
}

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
  "abinbevbr", "altriaus", "batru", "bdftr", "beiersdorfar", "beiersdorfau", "beiersdorfbe", "beiersdorfbo", "beiersdorfbr", "beiersdorfchl",
  "beiersdorfco", "beiersdorfcz", "beiersdorfde", "beiersdorfec", "beiersdorfeg", "beiersdorffr", "beiersdorfgr", "beiersdorfgt", "beiersdorfid",
  "beiersdorfin", "beiersdorfit", "beiersdorfke", "beiersdorfkz", "beiersdorfmx", "beiersdorfmy", "beiersdorfng", "beiersdorfnz", "beiersdorfpe",
  "beiersdorfph", "beiersdorfpl", "beiersdorfpt", "beiersdorfpy", "beiersdorfro", "beiersdorfru", "beiersdorfsa", "beiersdorfse", "beiersdorfsp",
  "beiersdorfth", "beiersdorftw", "beiersdorfuae", "beiersdorfuk", "beiersdorfvn", "beiersdorfza", "bimbomx", "bimbous", "biseask", "bivn",
  "bluetritonusa", "cbcdairyil", "cbcil", "ccaau", "ccanz", "ccbr-prod", "ccjp", "ccjpvm", "cclibertyus", "ccza", "diageoar", "diageoau",
  "diageobenelux", "diageobr", "diageoca", "diageoco", "diageoes", "diageoga", "diageogh", "diageogr", "diageogtr", "diageoid", "diageoie",
  "diageoin", "diageoit", "diageojp", "diageoke", "diageokr", "diageomx", "diageong", "diageopa", "diageopebac", "diageoph", "diageopl", "diageopt",
  "diageoromania", "diageosg", "diageostr", "diageoth", "diageotw", "diageotz", "diageoug", "diageouk", "diageous", "diageovn", "diageoza", "dlcpt",
  "femsaar", "fonterralk", "frucorau", "frucornz", "gmilac", "gskau", "gskch", "gskcz", "gskde", "gskes", "gskesph", "gskhu", "gskjp", "gsknz", "gskpl",
  "gskro", "gskruph", "gsksg", "haleonbr", "heinekenbr", "heinekentw", "heinzcr", "hphoodus", "inbevci", "inbevnl", "jtiro", "jtius", "jtjp", "kibonbr",
  "kirinjp", "labattplnoptca", "lionnz", "markanthonygroupus", "marsmx", "marspl", "mdlzrusf", "molsoncoorsuk", "mondelezau", "mondelezca", "mondelezde",
  "mondelezdmius", "mondelezes", "mondelezfi1", "mondelezkaza", "mondelezmy", "mondelezno", "mondelezprt", "mondelezsa", "mondelezse", "mondelezsg", "mondeleztr",
  "mondelezusps", "mondelezza", "munchysmy", "penaflorar", "pepsicofr", "pepsicopl", "pepsicotr", "pepsicouk", "pepside", "pepsigt", "pgpl", "pgpt", "pngcn-prod",
  "pnghk", "pngjp", "pngmx", "pngza2", "risparkwinede", "sanofiar", "sanofiat", "sanofiau", "sanofibe", "sanofibr", "sanofigr", "sanofihu", "sanofiit", "sanofijp",
  "sanofimx", "sanofiro", "scjohnsonar", "scjohnsonbr", "sindicatedmx", "sinoth", "sksignals", "solarbr", "suntoryjp2", "tempoil", "tevade", "tevapl", "tevaru",
  "ulbe", "ulbr", "ulde", "ules", "ulgr", "ulnl", "ulpt", "ulse", "unileverau", "unileverco", "unileverken", "unilevermx", "unileverus", "gskgr", "pernodus"
];

const metrics = [
  { path: "masking_engine",         name: "Masking Engine" },
  { path: "masking",                name: "Masking" }
];

async function fetchProject(project) {
  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(`target=alias(prod.gauges.selector.queue.${m.path}.${project}.total,'${m.name} - Total')`);
    payloadParts.push(`target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.${project}.oldestTask,4),'${m.name} - Oldest Task')`);
    if (m.path === "masking_engine") {
      payloadParts.push(`target=alias(prod.counters.selector.outflow.masking_engine.${project}.count,'${m.name} - Outflow')`);
    }
  });
  const payload = payloadParts.join("&") + "&from=today&until=now&format=json";

  const response = await fetch(GRAFANA_URL, {
    method: "POST",
    headers: {
      "Cookie": `grafana_session=${SESSION_ID}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload
  }).catch(() => null);

  if (!response || !response.ok) return null;

  const json = await response.json();
  const groupedData = {};
  json.forEach(series => {
    const datapoints = series.datapoints.filter(dp => dp[0] !== null);
    if (datapoints.length > 0) {
      const lastPoint = datapoints[datapoints.length - 1];
      const timestamp = lastPoint[1] * 1000;
      const value = lastPoint[0];
      const isOldestTask = series.target.includes("Oldest Task");
      const isOutflow = series.target.includes("Outflow");
      const metricName = series.target.replace(" - Total", "").replace(" - Oldest Task", "").replace(" - Outflow", "");

      if (!groupedData[metricName]) {
        groupedData[metricName] = { lastUpdated: timestamp, total: null, oldestTask: null, outflow: 0 };
      }

      if (isOldestTask) {
        groupedData[metricName].oldestTask = value;
      } else if (isOutflow) {
        groupedData[metricName].outflow = datapoints.reduce((acc, dp) => acc + dp[0], 0);
      } else {
        groupedData[metricName].total = value;
        groupedData[metricName].lastUpdated = timestamp;
      }
    }
  });
  return groupedData;
}

async function main() {
  console.log("🚀 Starting Masking fetch cycle (Chunked for stability)...");

  const RUN_DURATION_MS = 55 * 1000;
  const INTERVAL_MS     = 5000;
  const HISTORY_SIZE    = 6;

  const startTime = Date.now();
  let cycleCount = 0;
  let history = []; 

  try {
    const snap = await db.ref("masking/grafana/queue_metrics").once("value");
    if (snap.exists()) {
      const initial = snap.val();
      for (let i = 0; i < HISTORY_SIZE; i++) history.push(initial);
    }
  } catch (e) {}

  const hardKillTimer = setTimeout(() => process.exit(0), 58 * 1000);

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const cycleStart = Date.now();
    cycleCount++;
    console.log(`🔄 Cycle #${cycleCount} [Chunked Fetch]`);

    try {
      const BATCH_SIZE = 15;
      const results = [];
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async p => ({ project: p, data: await fetchProject(p) })));
        results.push(...batchResults);
      }

      const currentSnapshot = {};
      results.forEach(({ project, data }) => { if (data) currentSnapshot[project] = data; });

      const baseline = history.length > 0 ? history[0] : currentSnapshot;
      const allDataWithDelta = {};

      Object.keys(currentSnapshot).forEach(project => {
        const currentM = currentSnapshot[project];
        const baselineM = baseline[project] || {};
        const processed = {};

        Object.keys(currentM).forEach(mName => {
            const cur = currentM[mName];
            const base = baselineM[mName] || { total: cur.total, outflow: cur.outflow };
            processed[mName] = { 
                ...cur, 
                minuteDelta: cur.total - base.total,
                outflowDelta: cur.outflow - base.outflow
            };

            if (mName === "Masking Engine" && processed[mName].minuteDelta < -15) {
                sendTelegramAlert(project, processed[mName].minuteDelta, cur.total);
            }

            // Alert for Masking Outflow Increase
            if (mName === "Masking Engine" && processed[mName].outflowDelta > 0) {
                const msg = encodeURIComponent(`✅ Masking Outflow Increase: ${project.toUpperCase()}\nAmount: +${processed[mName].outflowDelta}\nTotal Outflow: ${cur.outflow}`);
                fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=@NestPT&text=${msg}`).catch(() => {});
            }
        });
        allDataWithDelta[project] = processed;
      });

      history.push(currentSnapshot);
      if (history.length > HISTORY_SIZE) history.shift();

      await db.ref("masking/grafana/queue_metrics").set({ ...allDataWithDelta, _lastUpdated: Date.now() });
      console.log(`✅ Updated at ${new Date().toISOString()}`);

    } catch (e) {
      console.error("❌ Cycle error:", e.message);
    }

    const waitTime = Math.max(1000, (cycleStart + INTERVAL_MS) - Date.now());
    await new Promise(r => setTimeout(r, waitTime));
  }

  clearTimeout(hardKillTimer);
  await admin.app().delete();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
