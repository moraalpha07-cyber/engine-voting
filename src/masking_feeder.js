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
  "beiersdorfin",
  "pgpl",
  "diageotz",
  "inbevci"
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
  console.log("🚀 Starting Masking fetch cycle...");

  const RUN_DURATION_MS = 55 * 1000;
  const INTERVAL_MS     = 5 * 1000;
  const MIN_WAIT_MS     = 1000;

  const startTime = Date.now();
  let cycleCount = 0;

  console.log("📥 Fetching baseline data from Firebase (masking/grafana/queue_metrics)...");
  let baselineData = {};
  try {
    const snapshot = await db.ref("masking/grafana/queue_metrics").once("value");
    if (snapshot.exists()) {
      baselineData = snapshot.val();
      console.log("✅ Baseline data loaded.");
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch baseline data:", err.message);
  }

  const hardKillTimer = setTimeout(() => {
    console.log("⏱️ Hard kill timer triggered. Force exiting.");
    process.exit(0);
  }, 58 * 1000);

  while (Date.now() - startTime < RUN_DURATION_MS) {
    const cycleStart = Date.now();
    cycleCount++;
    console.log(`🔄 Masking Cycle #${cycleCount} started at ${new Date().toISOString()}`);

    try {
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

      await Promise.race([
        db.ref("masking/grafana/queue_metrics").set({
          ...allData,
          _lastUpdated: Date.now()
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firebase write timeout")), 4000)
        )
      ]);

      console.log(`✅ Firebase (Masking) updated at ${new Date().toISOString()}`);
    } catch (e) {
      console.error("❌ Cycle error:", e.message);
    }

    const cycleEnd = Date.now();
    const nextCycleTarget = cycleStart + INTERVAL_MS;
    const waitTime = Math.max(MIN_WAIT_MS, nextCycleTarget - cycleEnd);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  clearTimeout(hardKillTimer);
  console.log(`✅ Done. ${cycleCount} cycles completed. Exiting.`);
  await admin.app().delete();
  process.exit(0);
}

main().catch(err => {
  console.error("💥 Fatal error in main loop:");
  console.error(err);
  process.exit(1);
});
