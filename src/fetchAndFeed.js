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
  console.log("👉 GitHub එකට ගිහින් 'FIREBASE_SERVICE_ACCOUNT' කියන Secret එක ඇතුළත් කරන්න.");
  console.log("👉 Go to GitHub Settings -> Secrets -> Actions and add FIREBASE_SERVICE_ACCOUNT.");
  process.exit(1);
}

if (!SESSION_ID) {
  console.error("❌ ERROR: GRAFANA_SESSION_ID is missing!");
  console.log("👉 GitHub එකට ගිහින් 'GRAFANA_SESSION_ID' කියන Secret එක ඇතුළත් කරන්න.");
  console.log("👉 Go to GitHub Settings -> Secrets -> Actions and add GRAFANA_SESSION_ID.");
  process.exit(1);
}

if (!process.env.FIREBASE_DATABASE_URL) {
  console.warn("⚠️ WARNING: FIREBASE_DATABASE_URL is missing. Using default.");
  console.log("👉 Default: " + DATABASE_URL);
}

// 🔹 Firebase init
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("❌ ERROR: FIREBASE_SERVICE_ACCOUNT is not a valid JSON string!");
  console.error("👉 හරිම JSON එක කොපි කරලා දැම්මද කියලා බලන්න (curly braces { } එක්කම).");
  console.error("Error details:", e.message);
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
  "abinbevbr",
  "abnz",
  "altriaus",
  "altriausdemo",
  "aneuae",
  "avidityuk",
  "batru",
  "bdftr",
  "beiersdorfar",
  "beiersdorfau",
  "beiersdorfbe",
  "beiersdorfbo",
  "beiersdorfbr",
  "beiersdorfchl",
  "beiersdorfco",
  "beiersdorfcz",
  "beiersdorfde",
  "beiersdorfec",
  "beiersdorfeg",
  "beiersdorffr",
  "beiersdorfgr",
  "beiersdorfgt",
  "beiersdorfid",
  "beiersdorfin",
  "beiersdorfit",
  "beiersdorfke",
  "beiersdorfkz",
  "beiersdorfmx",
  "beiersdorfmy",
  "beiersdorfng",
  "beiersdorfnz",
  "beiersdorfpe",
  "beiersdorfph",
  "beiersdorfpl",
  "beiersdorfpt",
  "beiersdorfpy",
  "beiersdorfro",
  "beiersdorfru",
  "beiersdorfsa",
  "beiersdorfse",
  "beiersdorfsp",
  "beiersdorfth",
  "beiersdorftw",
  "beiersdorfuae",
  "beiersdorfuk",
  "beiersdorfvn",
  "beiersdorfza",
  "bepensamx",
  "bikr",
  "bimboes",
  "bimbomx",
  "bimbous",
  "biph",
  "biseask",
  "bivn",
  "bluetritonusa",
  "cbcdairyil",
  "cbcil",
  "ccaau",
  "ccandinaar",
  "ccanz",
  "ccbr-prod",
  "ccjp",
  "ccjpvm",
  "cckh",
  "cckr",
  "cclibertyus",
  "ccphl",
  "ccusdemo",
  "ccza",
  "colgatelatam",
  "Comon",
  "cpgdemo",
  "danonear",
  "danonejp",
  "danoneuk",
  "deltafoodsgr",
  "diageoar",
  "diageoau",
  "diageobaltics",
  "diageobenelux",
  "diageobr",
  "diageoca",
  "diageoco",
  "diageoes",
  "diageoga",
  "diageogh",
  "diageogr",
  "diageogtr",
  "diageogtrassetpilot",
  "diageoid",
  "diageoie",
  "diageoiedemo",
  "diageoin",
  "diageoit",
  "diageojp",
  "diageoke",
  "diageokr",
  "diageomx",
  "diageong",
  "diageopa",
  "diageopebac",
  "diageoph",
  "diageopl",
  "diageopt",
  "diageoromania",
  "diageosc",
  "diageosg",
  "diageostr",
  "diageoth",
  "diageotw",
  "diageotz",
  "diageoug",
  "diageouk",
  "diageous",
  "diageovn",
  "diageoza",
  "dkshmy",
  "dlcpt",
  "dollargeneraldmxus",
  "dreyerus",
  "Edit Menu",
  "Edit Normal",
  "FactpharmaBE",
  "fapharmabe",
  "fapharmafr",
  "fazerfi",
  "femsaar",
  "femsamx",
  "ferreroid",
  "ferreromy",
  "ferreroph",
  "ferrerosg",
  "ferreroth",
  "ferrerovn",
  "fonterralk",
  "frucorau",
  "frucornz",
  "gdsar",
  "gmilac",
  "gmkr",
  "googlehk",
  "googlekr",
  "googlemx",
  "googleusa",
  "gpus",
  "gskau",
  "gskbg",
  "gskch",
  "gskcz",
  "gskde",
  "gskes",
  "gskesph",
  "gskfi",
  "gskglobal",
  "gskgr",
  "gskhu",
  "gskjp",
  "gskkz",
  "gsklt",
  "gsknz",
  "gskpl",
  "gskro",
  "gskruph",
  "gsksg",
  "gsksk",
  "gsktw",
  "gskua",
  "gskuz",
  "gskza",
  "haleonaesa",
  "haleonbr",
  "HALEONHU",
  "haleonil",
  "haleonmy",
  "haleonse",
  "haleonvn",
  "heinekenbr",
  "heinekentw",
  "heinzcr",
  "henkeltr",
  "hersheysusdemo",
  "hphoodus",
  "inbevci",
  "inbevnl",
  "intagejp2",
  "jdetr",
  "jdeza",
  "jnjanz",
  "jtiglobal",
  "jtihr",
  "jtimg",
  "jtiro",
  "jtisl",
  "jtius",
  "jtjp",
  "kenvuelatam",
  "kibonbr",
  "kirinjp",
  "labattplnoptca",
  "LIGA",
  "lightpilotdemo",
  "lionnz",
  "markanthonygroupus",
  "marsbh",
  "marsegy",
  "marskw",
  "marsmx",
  "marsom",
  "marspl",
  "marsqa",
  "marssa",
  "marstr",
  "marsuae",
  "marsuk",
  "mdlzdk",
  "mdlzrusf",
  "MENU",
  "moethennessyar",
  "moethennessyus",
  "molsoncoorsuk",
  "mondelezau",
  "mondelezaz",
  "mondelezca",
  "mondelezde",
  "mondelezdmius",
  "mondelezeg",
  "mondelezes",
  "mondelezfi1",
  "mondelezge",
  "mondelezkaza",
  "mondelezmy",
  "mondelezno",
  "mondelezprt",
  "mondelezsa",
  "mondelezse",
  "mondelezsg",
  "mondeleztr",
  "mondelezukre",
  "mondelezusps",
  "mondelezusquality",
  "mondelezuz",
  "mondelezza",
  "munchysmy",
  "newellus",
  "nrfbodycare",
  "nrfleaftea",
  "nrfsoftdrinks",
  "odcbcil",
  "odccbr-prod",
  "oddiageoiedemo",
  "odmondelezukre",
  "odmondelezusps",
  "odnrfbodycare",
  "odnrfleaftea",
  "odnrfsoftdrinks",
  "odpngjp",
  "odstraussdryil",
  "odtempoil",
  "odulpt",
  "odunileveril",
  "odunilevermx",
  "odunileverus",
  "penaflorar",
  "pepsibe",
  "pepsicoes",
  "pepsicofr",
  "pepsicopl",
  "pepsicotr",
  "pepsicouk",
  "pepside",
  "pepsidemoglobal",
  "pepsigt",
  "pernodin",
  "pernodricardes",
  "pernodus",
  "pgbaltics2",
  "pgcroatia",
  "pgcz",
  "pges",
  "pgespharma",
  "pghu",
  "pgpl",
  "pgpt",
  "pgsk",
  "pgua",
  "pngbr",
  "pngcn-prod",
  "pnghk",
  "pngjp",
  "pngmx",
  "pngvn",
  "pngza2",
  "pureaidemoamer",
  "pureaidemoapac",
  "pureaidemoemea",
  "refriangoao",
  "rinielsen2",
  "risparkwinede",
  "rjreynoldsus",
  "sanofiae",
  "sanofiar",
  "sanofiat",
  "sanofiau",
  "sanofibe",
  "sanofibr",
  "sanofich",
  "sanofico",
  "sanoficz",
  "sanofide",
  "sanofiec",
  "sanofieg",
  "sanofies",
  "sanofifr",
  "sanofigr",
  "sanofihu",
  "sanofiit",
  "sanofijp",
  "sanofimx",
  "sanofipl",
  "sanofipt",
  "sanofiro",
  "sanofiru",
  "sanofisa",
  "sanofitr",
  "sanofiua",
  "schwartautkde",
  "scjohnsonar",
  "scjohnsonbr",
  "sindicatedmx",
  "sinoth",
  "sksignals",
  "solarbr",
  "straussdryil",
  "straussfritolayil",
  "straussil",
  "suntoryjp2",
  "teamcorelatam",
  "tempoil",
  "tevade",
  "tevapl",
  "tevaru",
  "tnuvailv2",
  "traxtobaccous",
  "tuborgro",
  "ulbe",
  "ulbr",
  "ulde",
  "ules",
  "ulgr",
  "ulit",
  "ulnl",
  "ulpt",
  "ulse",
  "uluk",
  "unileverau",
  "unileverco",
  "unileveril",
  "unileverken",
  "unileverlk",
  "unilevermx",
  "unilevernz",
  "unileverus",
  "yalolatam"
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

// 🔹 Fetch one project
async function fetchProject(project) {
  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(
      `target=alias(prod.gauges.selector.queue.${m.path}.${project}.total,'${m.name} - Total')`
    );
    payloadParts.push(
      `target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.${project}.oldestTask,4),'${m.name} - Oldest Task')`
    );
  });
  const payload = payloadParts.join("&") + "&from=-1h&until=now&format=json";

  const response = await fetchWithTimeout(GRAFANA_URL, {
    method: "POST",
    headers: {
      "Cookie": `grafana_session=${SESSION_ID}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload
  }, 8000);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Error ${project}: ${response.status} - ${errorText.substring(0, 100)}`);
    return null;
  }

  const json = await response.json();

  // 🔹 Group total + oldestTask
  const groupedData = {};
  json.forEach(series => {
    const lastValidPoint = series.datapoints
      .filter(dp => dp[0] !== null)
      .pop();
    if (lastValidPoint) {
      const timestamp = lastValidPoint[1] * 1000;
      const value = lastValidPoint[0];
      const isOldestTask = series.target.includes("Oldest Task");
      const metricName = series.target
        .replace(" - Total", "")
        .replace(" - Oldest Task", "");

      if (!groupedData[metricName]) {
        groupedData[metricName] = {
          lastUpdated: timestamp,
          total: null,
          oldestTask: null
        };
      }
      if (isOldestTask) {
        groupedData[metricName].oldestTask = value;
      } else {
        groupedData[metricName].total = value;
        groupedData[metricName].lastUpdated = timestamp;
      }
    }
  });

  return groupedData;
}

// 🔹 Main loop
async function main() {
  console.log("🚀 Starting fetch cycle...");

  const RUN_DURATION_MS = 55 * 1000; // 55 seconds total
  const INTERVAL_MS     = 5 * 1000;  // every 5 seconds
  const MIN_WAIT_MS     = 1000;      // minimum 1s between cycles (runaway fix)

  const startTime = Date.now();
  let cycleCount = 0;

  // 🔹 Fetch Baseline Data (Compare current run against the state from the end of the previous minute)
  console.log("📥 Fetching baseline data from Firebase for delta calculation...");
  let baselineData = {};
  try {
    const snapshot = await db.ref("trax/queue_metrics").once("value");
    if (snapshot.exists()) {
      baselineData = snapshot.val();
      console.log("✅ Baseline data loaded.");
    } else {
      console.log("⚠️ No baseline data found. First run?");
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch baseline data:", err.message);
  }

  // 🔹 Hard kill safety net — 58s වෙද්දී force exit
  const hardKillTimer = setTimeout(() => {
    console.log("⏱️ Hard kill timer triggered. Force exiting.");
    process.exit(0);
  }, 58 * 1000);

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const cycleStart = Date.now();
    cycleCount++;
    console.log(`🔄 Cycle #${cycleCount} started at ${new Date().toISOString()}`);

    try {
      // 🔹 All projects parallel fetch — with per-project error isolation
      const results = await Promise.all(
        projects.map(async project => {
          try {
            const data = await fetchProject(project);
            return { project, data };
          } catch (err) {
            console.error(`❌ Project ${project} failed: ${err.message}`);
            return { project, data: null };
          }
        })
      );

      const allData = {};
      results.forEach(({ project, data }) => {
        if (!data) return;

        // 🔹 Calculate Deltas against Baseline
        const processedData = {};
        Object.keys(data).forEach(metricName => {
          const current = data[metricName];
          const baseline = baselineData[project] ? baselineData[project][metricName] : null;
          
          let delta = 0;
          if (baseline && baseline.total !== null && current.total !== null) {
            delta = current.total - baseline.total;
          }

          processedData[metricName] = {
            ...current,
            minuteDelta: delta
          };
        });

        allData[project] = processedData;
      });

      // 🔹 Firebase update with timeout
      await Promise.race([
        db.ref("trax/queue_metrics").set({
          ...allData,
          _lastUpdated: Date.now()
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firebase write timeout")), 4000)
        )
      ]);

      console.log(`✅ Firebase updated at ${new Date().toISOString()}`);
    } catch (e) {
      console.error("❌ Cycle error:", e.message);
    }

    // 🔹 FIX: cycleStart-based wait — error/slow cycles වලදී runaway loop නවතිනවා
    const cycleEnd = Date.now();
    const nextCycleTarget = cycleStart + INTERVAL_MS;
    const waitTime = Math.max(MIN_WAIT_MS, nextCycleTarget - cycleEnd);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  clearTimeout(hardKillTimer);
  console.log(`✅ Done. ${cycleCount} cycles completed. Exiting.`);

  // 🔹 Firebase connection cleanly close
  await admin.app().delete();
  process.exit(0);
}

main().catch(err => {
  console.error("💥 Fatal error in main loop:");
  console.error(err);
  if (err.message && err.message.includes("permission_denied")) {
    console.error("👉 Firebase Permissions බලන්න. Database Rules වලට access දීලා නැතුව ඇති.");
  }
  process.exit(1);
});
