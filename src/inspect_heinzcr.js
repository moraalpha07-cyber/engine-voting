require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const GRAFANA_URL = process.env.GRAFANA_URL || "https://monitor-public.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;
const DATABASE_URL = (process.env.FIREBASE_DATABASE_URL || "https://projectallow-default-rtdb.firebaseio.com/").replace(/\/$/, "");

async function inspectHeinzcr() {
  console.log("🔍 Inspecting heinzcr data from Grafana & Firebase...");
  
  // 1. Fetch Grafana
  const metrics = [
    { path: "masking_engine", name: "Masking Engine" },
    { path: "masking", name: "Masking" }
  ];
  const payloadParts = [];
  metrics.forEach(m => {
    payloadParts.push(`target=alias(prod.gauges.selector.queue.${m.path}.heinzcr.total,'${m.name} - Total')`);
    payloadParts.push(`target=alias(aliasByNode(prod.gauges.selector.queue.${m.path}.heinzcr.oldestTask,4),'${m.name} - Oldest Task')`);
    payloadParts.push(`target=alias(summarize(prod.counters.selector.outflow.${m.path}.heinzcr.count,'1d','sum',true),'${m.name} - Outflow')`);
  });
  const payload = payloadParts.join("&") + "&from=-1h&until=now&format=json";

  const res = await fetch(GRAFANA_URL, {
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

  console.log("Grafana Status:", res.status);
  const json = await res.json();
  console.log("\n📊 Grafana Datapoints for HEINZCR:");
  if (Array.isArray(json)) {
    json.forEach(series => {
      const validPoints = series.datapoints.filter(d => d[0] !== null);
      const recent = validPoints.slice(-8);
      console.log(`\nTarget: ${series.target}`);
      console.log(`Recent Points:`, recent.map(p => `[Val: ${p[0]}, Time: ${new Date(p[1]*1000).toLocaleTimeString()}]`));
    });
  } else {
    console.log("JSON response:", json);
  }

  // 2. Fetch Firebase current baseline for heinzcr
  const fbRes = await fetch(`${DATABASE_URL}/masking/grafana/queue_metrics/heinzcr.json`);
  const fbData = await fbRes.json();
  console.log("\n🔥 Firebase Baseline Data for HEINZCR:", JSON.stringify(fbData, null, 2));

  // 3. Denominators
  const denoRes = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTeBLEp0p0cP2CNbrEx1NyKQYKJw-uo-TFNs_GHgcUrNEXYhA79LbC3r8gei8b_DcXbywiwRhzmEYCs/pub?gid=1191322481&single=true&output=csv");
  const denoCsv = await denoRes.text();
  const denoLines = denoCsv.split("\n");
  for (const l of denoLines) {
    if (l.toLowerCase().includes("heinzcr")) {
      console.log("\n📋 Denominator row for heinzcr:", l);
    }
  }
}

inspectHeinzcr().catch(console.error);
