require("dotenv").config();
const fetch = require("node-fetch");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_DROPS = process.env.TELEGRAM_CHAT_ID_DROPS || process.env.TELEGRAM_CHAT_ID || "@NestPT";

async function testTelegram() {
  console.log("🔍 Testing Telegram Masking Drop Alert Channel...");
  console.log("🤖 Bot Token:", TELEGRAM_TOKEN ? TELEGRAM_TOKEN.slice(0, 10) + "..." : "NOT SET");
  console.log("📢 Target Drops Group ID:", CHAT_DROPS);

  if (!TELEGRAM_TOKEN) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is not set in .env!");
    return;
  }

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      console.error("❌ Telegram Token Invalid:", meData.description);
      return;
    }
    console.log(`✅ Bot Authenticated: @${meData.result.username} (${meData.result.first_name})`);

    const targets = String(CHAT_DROPS).split(",").map(c => c.trim()).filter(Boolean);
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
    const testMsg = `<b>[${now}]</b>\n` +
                    `<b>🔴 Engine Masking Alert:</b>\n\n` +
                    `<b>FRUCORAU</b>\n\n` +
                    `<code>Drop:          -89</code>\n` +
                    `<code>Current Queue: 181 🚨 (VERY HIGH)</code>\n` +
                    `<code>Deno:          0.25</code>\n` +
                    `<code>Outflow:       188</code>\n\n` +
                    `<i>✅ (Test Alert Verification)</i>`;

    for (const chatId of targets) {
      console.log(`📤 Sending test Masking Drop alert to ${chatId}...`);
      const sendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMsg,
          parse_mode: "HTML"
        })
      });

      const sendData = await sendRes.json();
      if (!sendData.ok) {
        console.error(`❌ Send Message Failed to ${chatId}: ${sendData.description} (Error code: ${sendData.error_code})`);
      } else {
        console.log(`🎉 SUCCESS: Test message delivered to ${chatId}! Msg ID: ${sendData.result.message_id}`);
      }
    }
  } catch (err) {
    console.error("❌ Network / Fetch Error:", err.message);
  }
}

testTelegram();
