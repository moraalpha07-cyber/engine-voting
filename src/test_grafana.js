require("dotenv").config();
const fetch = require("node-fetch");

const GRAFANA_URL = process.env.GRAFANA_URL || "https://monitor.trax-cloud.com/api/datasources/proxy/29/render";
const SESSION_ID = process.env.GRAFANA_SESSION_ID;

async function testGrafana() {
  console.log("🔍 Testing Grafana Session & Connection...");
  console.log("🌐 Grafana URL:", GRAFANA_URL);
  console.log("🔑 Session ID:", SESSION_ID ? SESSION_ID.slice(0, 8) + "..." : "NOT SET");

  if (!SESSION_ID) {
    console.error("❌ ERROR: GRAFANA_SESSION_ID is not set in .env!");
    console.log("💡 Tip: Follow SECRETS_GUIDE.md to extract your grafana_session cookie.");
    return;
  }

  const payload = "target=alias(prod.gauges.selector.queue.masking.abinbevbr.total,'Masking - Total')&from=-1h&until=now&format=json";

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

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);

    if (response.status === 401 || response.status === 403) {
      console.error("❌ Session Expired / Unauthorized! Please login to Grafana and copy a new grafana_session cookie.");
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Grafana returned error response:", text.slice(0, 300));
      return;
    }

    const data = await response.json();
    console.log("🎉 SUCCESS: Grafana responded successfully!");
    console.log("Sample Data received:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Network / Fetch Error:", err.message);
  }
}

testGrafana();
