/**
 * Telegram notifications (via AfroMessage bot integration, already working).
 * Used for crisis escalation to a configured emergency contact.
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN || !chatId) {
    console.warn("[telegram] missing token or chatId — skipping send");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[telegram] send failed", e);
    return false;
  }
}

export function crisisMessage(userName: string | null): string {
  const who = userName ?? "Someone you support";
  return (
    `<b>Dildi wellbeing alert</b>\n\n` +
    `${who} may be in crisis and listed you as their emergency contact. ` +
    `Please reach out to them now. If you believe they are in immediate ` +
    `danger, contact local emergency services.`
  );
}
