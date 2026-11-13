// Telegram Bot notification helper for Romanian Test Platform (ANTEM)

const TG_BOT_TOKEN_KEY = 'romanian_tg_bot_token';
const TG_CHAT_ID_KEY = 'romanian_tg_chat_id';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export function getTelegramConfig(): TelegramConfig {
  const localToken = typeof window !== 'undefined' ? localStorage.getItem(TG_BOT_TOKEN_KEY) || '' : '';
  const localChatId = typeof window !== 'undefined' ? localStorage.getItem(TG_CHAT_ID_KEY) || '' : '';

  const envToken = (import.meta as any).env?.VITE_TELEGRAM_BOT_TOKEN || '';
  const envChatId = (import.meta as any).env?.VITE_TELEGRAM_CHAT_ID || '';

  return {
    botToken: (localToken || envToken).trim(),
    chatId: (localChatId || envChatId).trim()
  };
}

export function isTelegramConfigured(): boolean {
  const cfg = getTelegramConfig();
  return Boolean(cfg.botToken && cfg.chatId);
}

export function saveTelegramConfig(botToken: string, chatId: string) {
  if (botToken.trim()) {
    localStorage.setItem(TG_BOT_TOKEN_KEY, botToken.trim());
  } else {
    localStorage.removeItem(TG_BOT_TOKEN_KEY);
  }

  if (chatId.trim()) {
    localStorage.setItem(TG_CHAT_ID_KEY, chatId.trim());
  } else {
    localStorage.removeItem(TG_CHAT_ID_KEY);
  }
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { botToken, chatId } = getTelegramConfig();
  if (!botToken || !chatId) return false;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const json = await res.json();
    return Boolean(json.ok);
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
    return false;
  }
}

export async function notifyNewSubmission(submission: {
  userName: string;
  userEmail: string;
  activityTitle: string;
  submissionText: string;
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  const preview = submission.submissionText.length > 250
    ? submission.submissionText.substring(0, 250) + '...'
    : submission.submissionText;

  const message = [
    '🔔 <b>Temă nouă trimisă spre verificare!</b>',
    '',
    `👤 <b>Student:</b> ${escapeHtml(submission.userName)} (<code>${escapeHtml(submission.userEmail)}</code>)`,
    `📖 <b>Activitate:</b> ${escapeHtml(submission.activityTitle)}`,
    '',
    '📝 <b>Răspuns:</b>',
    `<i>${escapeHtml(preview)}</i>`,
    '',
    '👉 <a href="https://rmomd.github.io/new.invat.antem/">Deschide platforma pentru verificare</a>'
  ].join('\n');

  return sendTelegramMessage(message);
}

export async function notifyReviewedSubmission(submission: {
  userName: string;
  userEmail: string;
  activityTitle: string;
  grade?: number;
  feedback?: string;
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  const message = [
    '✅ <b>Temă verificată cu succes!</b>',
    '',
    `👤 <b>Student:</b> ${escapeHtml(submission.userName)} (<code>${escapeHtml(submission.userEmail)}</code>)`,
    `📖 <b>Activitate:</b> ${escapeHtml(submission.activityTitle)}`,
    `⭐️ <b>Nota:</b> ${submission.grade ?? '-'}/10`,
    '',
    submission.feedback ? `💬 <b>Feedback:</b>\n<i>${escapeHtml(submission.feedback.substring(0, 200))}...</i>` : '',
    '',
    '👉 <a href="https://rmomd.github.io/new.invat.antem/">Vezi rezultatul pe platformă</a>'
  ].filter(Boolean).join('\n');

  return sendTelegramMessage(message);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
