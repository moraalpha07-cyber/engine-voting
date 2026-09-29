require("dotenv").config();
const fetch = require("node-fetch");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_NESTPT = process.env.TELEGRAM_CHAT_ID || "@NestPT";

async function testTelegram() {
  console.log("🔍 Testing Telegram Bot Connection...");
  console.log("🤖 Bot Token:", TELEGRAM_TOKEN ? TELEGRAM_TOKEN.slice(0, 10) + "..." : "NOT SET");
  console.log("📢 Chat ID:", CHAT_NESTPT);

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

    console.log(`📤 Sending test alert message to ${CHAT_NESTPT}...`);
    const testMsg = `<b>🔔 Masking Feeder Test Alert</b>\n\n` +
                    `Telegram notification system is functioning properly!\n` +
                    `<i>Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}</i>`;

    const sendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_NESTPT,
        text: testMsg,
        parse_mode: "HTML"
      })
    });

    const sendData = await sendRes.json();
    if (!sendData.ok) {
      console.error(`❌ Send Message Failed: ${sendData.description} (Error code: ${sendData.error_code})`);
      console.log("💡 Tip: Make sure the bot is an Administrator/Member of the channel/group!");
    } else {
      console.log(`🎉 SUCCESS: Test message sent! Message ID: ${sendData.result.message_id}`);
    }
  } catch (err) {
    console.error("❌ Network / Fetch Error:", err.message);
  }
}

testTelegram();
