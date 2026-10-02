require("dotenv").config();
const fetch = require("node-fetch");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_INFLOW = process.env.TELEGRAM_CHAT_ID_INFLOW || "-1004486777652";

async function testTelegram() {
  console.log("🔍 Testing Telegram Inflow Notification Channel...");
  console.log("🔑 Bot Token:", TELEGRAM_TOKEN ? TELEGRAM_TOKEN.slice(0, 10) + "..." : "NOT SET");
  console.log("🎯 Target Inflow Chat ID:", TELEGRAM_CHAT_INFLOW);

  if (!TELEGRAM_TOKEN) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is not set in .env!");
    return;
  }

  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
  const sampleMsg = `<b>[${now}]</b>\n` +
                    `<b>🔴 📥 INFLOW ALERT (Deno RPH &gt; 60):</b> 🔥 <b>[HIGH DENO &gt; 1.0]</b>\n\n` +
                    `<b>Project:</b> <code>MONDELEZNO</code>\n` +
                    `<b>Task:</b> <code>Engine Masking</code>\n\n` +
                    `<code>Inflow Added:  +35</code>\n` +
                    `<code>Current Queue: 318</code>\n` +
                    `<code>Deno RPH:      162.42</code>\n` +
                    `<code>Deno:          1.15 🔥 (HIGH &gt; 1.0)</code>\n` +
                    `<code>Outflow:       141</code>\n\n` +
                    `<i>✅ This is a test notification from the Grafana Inflow Bot!</i>`;

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_INFLOW,
        text: sampleMsg,
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`🎉 SUCCESS: Test message successfully sent to ${TELEGRAM_CHAT_INFLOW}!`);
      console.log(`Message ID: ${data.result.message_id}`);
    } else {
      console.error(`❌ Telegram Error: ${data.description} (Error Code: ${data.error_code})`);
      console.log("💡 Tip: Make sure the bot is added as an Administrator to the group/channel.");
    }
  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
  }
}

testTelegram();
