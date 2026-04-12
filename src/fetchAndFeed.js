require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔹 Config
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/";
const GRAFANA_URL = "https://monitor.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

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
  "abinbevbr", "abnz", "altriaus", "altriausdemo", "aneuae", "avidityuk", "batru", "bdftr", "beiersdorfar", "beiersdorfau", "beiersdorfbe", "beiersdorfbo", "beiersdorfbr", "beiersdorfchl", "beiersdorfco", "beiersdorfcz", "beiersdorfde", "beiersdorfec", "beiersdorfeg", "beiersdorffr", "beiersdorfgr", "beiersdorfgt", "beiersdorfid", "beiersdorfin", "beiersdorfit", "beiersdorfke", "beiersdorfkz", "beiersdorfmx", "beiersdorfmy", "beiersdorfng", "beiersdorfnz", "beiersdorfpe", "beiersdorfph", "beiersdorfpl", "beiersdorfpt", "beiersdorfpy", "beiersdorfro", "beiersdorfru", "beiersdorfsa", "beiersdorfse", "beiersdorfsp", "beiersdorfth", "beiersdorftw", "beiersdorfuae", "beiersdorfuk", "beiersdorfvn", "beiersdorfza", "bepensamx", "bikr", "bimboes", "bimbomx", "bimbous", "biph", "biseask", "bivn", "bluetritonusa", "cbcdairyil", "cbcil", "ccaau", "ccandinaar", "ccanz", "ccbr-prod", "ccjp", "ccjpvm", "cckh", "cckr", "cclibertyus", "ccphl", "ccusdemo", "ccza", "colgatelatam", "Comon", "cpgdemo", "danonear", "danonejp", "danoneuk", "deltafoodsgr", "diageoar", "diageoau", "diageobaltics", "diageobenelux", "diageobr", "diageoca", "diageoco", "diageoes", "diageoga", "diageogh", "diageogr", "diageogtr", "diageogtrassetpilot", "diageoid", "diageoie", "diageoiedemo", "diageoin", "diageoit", "diageojp", "diageoke", "diageokr", "diageomx", "diageong", "diageopa", "diageopebac", "diageoph", "diageopl", "diageopt", "diageoromania", "diageosc", "diageosg", "diageostr", "diageoth", "diageotw", "diageotz", "diageoug", "diageouk", "diageous", "diageovn", "diageoza", "dkshmy", "dlcpt", "dollargeneraldmxus", "dreyerus", "Edit Menu", "Edit Normal", "FactpharmaBE", "fapharmabe", "fapharmafr", "fazerfi", "femsaar", "femsamx", "ferreroid", "ferreromy", "ferreroph", "ferrerosg", "ferreroth", "ferrerovn", "fonterralk", "frucorau", "frucornz", "gdsar", "gmilac", "gmkr", "googlehk", "googlekr", "googlemx", "googleusa", "gpus", "gskau", "gskbg", "gskch", "gskcz", "gskde", "gskes", "gskesph", "gskfi", "gskglobal", "gskgr", "gskhu", "gskjp", "gskkz", "gsklt", "gsknz", "gskpl", "gskro", "gskruph", "gsksg", "gsksk", "gsktw", "gskua", "gskuz", "gskza", "haleonaesa", "haleonbr", "HALEONHU", "haleonil", "haleonmy", "haleonse", "haleonvn", "heinekenbr", "heinekentw", "heinzcr", "henkeltr", "hersheysusdemo", "hphoodus", "inbevci", "inbevnl", "intagejp2", "jdetr", "jdeza", "jnjanz", "jtiglobal", "jtihr", "jtimg", "jtiro", "jtisl", "jtius", "jtjp", "kenvuelatam", "kibonbr", "kirinjp", "labattplnoptca", "LIGA", "lightpilotdemo", "lionnz", "markanthonygroupus", "marsbh", "marsegy", "marskw", "marsmx", "marsom", "marspl", "marsqa", "marssa", "marstr", "marsuae", "marsuk", "mdlzdk", "mdlzrusf", "MENU", "moethennessyar", "moethennessyus", "molsoncoorsuk", "mondelezau", "mondelezaz", "mondelezca", "mondelezde", "mondelezdmius", "mondelezeg", "mondelezes", "mondelezfi1", "mondelezge", "mondelezkaza", "mondelezmy", "mondelezno", "mondelezprt", "mondelezsa", "mondelezse", "mondelezsg", "mondeleztr", "mondelezukre", "mondelezusps", "mondelezusquality", "mondelezuz", "mondelezza", "munchysmy", "newellus", "nrfbodycare", "nrfleaftea", "nrfsoftdrinks", "odcbcil", "odccbr-prod", "oddiageoiedemo", "odmondelezukre", "odmondelezusps", "odnrfbodycare", "odnrfleaftea", "odnrfsoftdrinks", "odpngjp", "odstraussdryil", "odtempoil", "odulpt", "odunileveril", "odunilevermx", "odunileverus", "penaflorar", "pepsibe", "pepsicoes", "pepsicofr", "pepsicopl", "pepsicotr", "pepsicouk", "pepside", "pepsidemoglobal", "pepsigt", "pernodin", "pernodricardes", "pernodus", "pgbaltics2", "pgcroatia", "pgcz", "pges", "pgespharma", "pghu", "pgpl", "pgpt", "pgsk", "pgua", "pngbr", "pngcn-prod", "pnghk", "pngjp", "pngmx", "pngvn", "pngza2", "pureaidemoamer", "pureaidemoapac", "pureaidemoemea", "refriangoao", "rinielsen2", "risparkwinede", "rjreynoldsus", "sanofiae", "sanofiar", "sanofiat", "sanofiau", "sanofibe", "sanofibr", "sanofich", "sanofico", "sanoficz", "sanofide", "sanofiec", "sanofieg", "sanofies", "sanofifr", "sanofigr", "sanofihu", "sanofiit", "sanofijp", "sanofimx", "sanofipl", "sanofipt", "sanofiro", "sanofiru", "sanofisa", "sanofitr", "sanofiua", "schwartautkde", "scjohnsonar", "scjohnsonbr", "sindicatedmx", "sinoth", "sksignals", "solarbr", "straussdryil", "straussfritolayil", "straussil", "suntoryjp2", "teamcorelatam", "tempoil", "tevade", "tevapl", "tevaru", "tnuvailv2", "traxtobaccous", "tuborgro", "ulbe", "ulbr", "ulde", "ules", "ulgr", "ulit", "ulnl", "ulpt", "ulse", "uluk", "unileverau", "unileverco", "unileveril", "unileverken", "unileverlk", "unilevermx", "unilevernz", "unileverus", "yalolatam"
];

const metrics = [
  { path: "validation",             name: "Validation" },
  { path: "masking",                name: "Masking" },
  { path: "voting",                 name: "Voting" },
  { path: "stitching",              name: "Stitching" },
  { path: "online_pricing",         name: "Online Pricing" },
  { path: "offline_pricing",        name: "Offline Pricing" },
  { path: "scene_recognition",      name: "Scene Recognitions" },
  { path: "category_expert",        name: "Category Expert" },
  { path: "offline_validation",     name: "Offline Validation" },
  { path: "offline_voting",         name: "Offline Voting" },
  { path: "offline_pricing_voting", name: "Offline Pricing Voting" },
  { path: "voting_engine",          name: "Voting Engine" },
  { path: "masking_engine",         name: "Masking Engine" },
  { path: "pricing_voting",         name: "Pricing Voting" },
  { path: "special_masking",        name: "Special Masking" },
  { path: "masking_menu_items",     name: "Masking Menu Items" },
  { path: "masking_price_labels",   name: "Masking Labels" },
  { path: "masking_brand_hunt",     name: "Masking Brand Hunt" },
  { path: "category_expert_voting", name: "Expert Voting" },
  { path: "offline_posm",           name: "Offline POSM" }
];

// 🔹 Fetch with timeout helper
function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// 🔹 Telegram Alert Config
const TELEGRAM_BOT_TOKEN = "1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA";
const CHAT_ID = "@NestPT";

async function sendTelegram(msg) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(msg)}`;
  try { await fetch(url); } catch (e) { console.error("❌ Telegram failed:", e.message); }
}

// 🔹 Fetch one project
async function fetchProject(project) {
  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(`target=alias(prod.gauges.selector.queue.${m.path}.${project}.total,'${m.name} - Total')`);
    payloadParts.push(`target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.${project}.oldestTask,4),'${m.name} - Oldest Task')`);
  });
  
  // Add Outflow for Voting Engine
  payloadParts.push(`target=alias(summarize(prod.counters.selector.outflow.voting_engine.${project}.count,'1d','sum',true),'Voting Engine - Outflow')`);

  const payload = payloadParts.join("&") + "&from=-1h&until=now&format=json";

  const response = await fetchWithTimeout(GRAFANA_URL, {
    method: "POST",
    headers: {
      "Cookie": `grafana_session=${SESSION_ID}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload
  }, 10000);

  if (!response.ok) return null;

  const json = await response.json();
  const groupedData = {};
  json.forEach(series => {
    const lastValidPoint = series.datapoints.filter(dp => dp[0] !== null).pop();
    if (lastValidPoint) {
      const timestamp = lastValidPoint[1] * 1000;
      const value = lastValidPoint[0];
      
      if (series.target.includes("Outflow")) {
        const metricName = series.target.replace(" - Outflow", "");
        if (!groupedData[metricName]) groupedData[metricName] = { lastUpdated: timestamp, total: 0, oldestTask: 0, outflow: 0 };
        groupedData[metricName].outflow = value;
      } else {
        const isOldestTask = series.target.includes("Oldest Task");
        const metricName = series.target.replace(" - Total", "").replace(" - Oldest Task", "");
        if (!groupedData[metricName]) groupedData[metricName] = { lastUpdated: timestamp, total: 0, oldestTask: 0, outflow: 0 };
        
        if (isOldestTask) groupedData[metricName].oldestTask = value;
        else groupedData[metricName].total = value;
        groupedData[metricName].lastUpdated = timestamp;
      }
    }
  });
  return groupedData;
}

// 🔹 Main loop
async function main() {
  console.log("🚀 Starting fetch cycle (Voting + Trax)...");

  const RUN_DURATION_MS = 55 * 1000;
  const startTime = Date.now();
  let baselineData = {};
  
  try {
    const snapshot = await db.ref("trax/queue_metrics").once("value");
    if (snapshot.exists()) baselineData = snapshot.val();
  } catch (err) {}

  const hardKillTimer = setTimeout(() => process.exit(0), 58 * 1000);

  try {
    const BATCH_SIZE = 15;
    const results = [];
    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async p => ({ project: p, data: await fetchProject(p) })));
      results.push(...batchResults);
    }

    const allData = {};
    for (const { project, data } of results) {
      if (!data) continue;
      const processedData = {};
      
      for (const mName of Object.keys(data)) {
        const current = data[mName];
        const prev = (baselineData[project] && baselineData[project][mName]) ? baselineData[project][mName] : null;
        
        const minuteDelta = prev ? current.total - prev.total : 0;
        const outflowDelta = prev ? current.outflow - (prev.outflow || 0) : 0;

        processedData[mName] = { ...current, minuteDelta, outflowDelta };

        const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
        // Alert for Voting Engine drops
        if (mName === "Voting Engine" && minuteDelta < -15) {
          const alertMsg = `[${now}]\n🚨 Voting Engine Alert: ${project.toUpperCase()}\nDrop: ${minuteDelta}\nCurrent Queue: ${current.total}\nOutflow: ${current.outflow}`;
          await sendTelegram(alertMsg);
        }

        // Alert for Voting Engine Outflow Increase
        if (mName === "Voting Engine" && outflowDelta >= 5) {
          const msg = `[${now}]\n✅ Voting Engine Increase: ${project.toUpperCase()}\nAmount: +${outflowDelta}\nTotal Outflow: ${current.outflow}`;
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=@MONDELEZSE&text=${encodeURIComponent(msg)}`).catch(() => {});
        }
      }
      allData[project] = processedData;
    }

    await db.ref("trax/queue_metrics").set({ ...allData, _lastUpdated: Date.now() });
    console.log(`✅ Updated successfully.`);
  } catch (e) {
    console.error("❌ Execution error:", e.message);
  }

  clearTimeout(hardKillTimer);
  await admin.app().delete();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
