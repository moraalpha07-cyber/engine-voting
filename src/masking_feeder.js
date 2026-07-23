require("dotenv").config();
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 🔹 Config
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/";
const GRAFANA_URL = "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

// 🔹 Telegram Config (Loaded from environment variables for security)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "1623834999:AAH9kS6Y_R150sI98Qyk7v7SN5MgKhSq1kA";
const CHAT_NESTPT = process.env.TELEGRAM_CHAT_ID || "@NestPT";

async function sendTelegram(msg, chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}&parse_mode=HTML`;
  try { await fetch(url); } catch (e) { console.error("❌ Telegram failed:", e.message); }
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

// 🔹 Firebase init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: DATABASE_URL
  });
}
const db = admin.database();

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
      headers: {
        "Cookie": `grafana_session=${SESSION_ID}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-grafana-org-id": "18",
        "x-dashboard-id": "862",
        "x-panel-id": "30"
      },
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
  const colomboHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    hour12: false
  }).format(new Date()), 10);

  if (colomboHour < 6 || colomboHour >= 23) {
    console.log(`⏰ Current Colombo hour is ${colomboHour}. Outside active hours (6 AM - 11 PM). Exiting.`);
    process.exit(0);
  }

  // Fetch denominators from Google Sheets
  await fetchDenominators();
  await fetchPoolProjects();

  console.log("🚀 Starting Masking engine feeder...");
  const RUN_DURATION_MS = 55 * 1000;
  const INTERVAL_MS     = 5000;
  const startTime = Date.now();
  let baselineData = {};

  try {
    const snap = await db.ref("masking/grafana/queue_metrics").once("value");
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
                const msg = `<b>[${now}]</b>\n` +
                            `<b>${emoji} ${displayType} Alert:</b>\n\n` +
                            `<b>${project.toUpperCase()}${isPool ? " 🚫 (POOL - DO NOT WORK)" : ""}</b>\n\n` +
                            (isPool ? `<b>⚠️ POOL PROJECT - DO NOT TOUCH ⚠️</b>\n\n` : ``) +
                            `<code>Drop:          ${minuteDelta}</code>\n` +
                            `<code>Current Queue: ${cur.total}</code>\n` +
                            `<code>Deno:          ${denoVal}</code>\n` +
                            `<code>Outflow:       ${cur.outflow}</code>`;
                await sendTelegram(msg, CHAT_NESTPT);
             }
          }
        }
        allData[project] = processed;
      }

      await db.ref("masking/grafana/queue_metrics").set({ ...allData, _lastUpdated: Date.now() });
      baselineData = allData; // 🔹 Update baseline to prevent duplicate alerts
      console.log(`✅ Updated: ${new Date().toLocaleTimeString()}`);
    } catch (e) { console.error("❌ Cycle error:", e.message); }

    await new Promise(r => setTimeout(r, Math.max(1000, (cycleStart + INTERVAL_MS) - Date.now())));
  }
  clearTimeout(killTimer);
  await admin.app().delete();
  process.exit(0);
}

main().catch(() => process.exit(1));
