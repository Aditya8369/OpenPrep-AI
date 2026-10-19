/**
 * External Notification Dispatcher Service
 * Dispatches rich formatted study reminders and streak alerts
 * to Discord Webhooks and Telegram Bots.
 */

const MOTIVATIONAL_QUOTES = [
  "Continuous improvement is better than delayed perfection.",
  "Small daily efforts compound into extraordinary results.",
  "The secret of getting ahead is getting started.",
  "Focus on progress, not perfection.",
  "Discipline is choosing between what you want now and what you want most.",
];

function getRandomQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
}

/**
 * Builds formatted Discord Rich Embed payload
 */
function formatDiscordPayload({
  username = 'Student',
  pendingCards = 0,
  streakCount = 0,
  nextExamDays = null,
  examName = 'Upcoming Exam',
  quote = getRandomQuote(),
}) {
  const fields = [
    {
      name: '🗂 Pending Flashcards',
      value: pendingCards > 0 ? `**${pendingCards} cards** due for review` : 'All caught up! 🎉',
      inline: true,
    },
    {
      name: '🔥 Current Streak',
      value: `**${streakCount} Days**`,
      inline: true,
    },
  ];

  if (nextExamDays !== null && nextExamDays !== undefined) {
    fields.push({
      name: '⏳ Exam Countdown',
      value: `**${nextExamDays} days** until ${examName}`,
      inline: false,
    });
  }

  return {
    username: 'OpenPrep AI Tutor',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/3413/3413535.png',
    embeds: [
      {
        title: '📚 Daily Study & Spaced Repetition Agenda',
        description: `Hello **${username}**! Here is your daily preparation brief to keep your retention high.`,
        color: 0x4f46e5, // Indigo
        fields,
        footer: {
          text: `💡 "${quote}"`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Builds formatted Telegram Markdown message & optional inline buttons
 */
function formatTelegramMessage({
  username = 'Student',
  pendingCards = 0,
  streakCount = 0,
  nextExamDays = null,
  examName = 'Upcoming Exam',
  quote = getRandomQuote(),
  appBaseUrl = process.env.CLIENT_URL || 'https://openprep.ai',
}) {
  let text = `📚 *OpenPrep AI Daily Briefing*\n\n`;
  text += `Hello *${username}*, here is your spaced repetition schedule for today:\n\n`;
  text += `• 🗂 *Pending Cards:* ${pendingCards} due for review\n`;
  text += `• 🔥 *Daily Streak:* ${streakCount} days active\n`;

  if (nextExamDays !== null && nextExamDays !== undefined) {
    text += `• ⏳ *Countdown:* ${nextExamDays} days until *${examName}*\n`;
  }

  text += `\n💡 _"${quote}"_`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '⚡ Review Flashcards Now', url: `${appBaseUrl}/flashcards/review` },
        { text: '📊 Open Dashboard', url: `${appBaseUrl}/dashboard` },
      ],
    ],
  };

  return { text, reply_markup: inlineKeyboard };
}

/**
 * Sends a notification payload to a Discord Webhook
 * @param {string} webhookUrl
 * @param {Object} payload
 * @returns {Promise<{success: boolean, status: number, message: string}>}
 */
async function sendDiscordNotification(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('Invalid or missing Discord webhook URL');
  }

  // Validate webhook URL domain
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
      !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
    throw new Error('Discord webhook URL must start with https://discord.com/api/webhooks/');
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Discord API responded with status ${res.status}: ${errorText}`);
  }

  return { success: true, status: res.status, message: 'Discord notification dispatched' };
}

/**
 * Sends a notification message to a Telegram chat via Telegram Bot API
 * @param {{botToken: string, chatId: string|number, text: string, reply_markup?: Object}} options
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendTelegramNotification({ botToken, chatId, text, reply_markup }) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Telegram bot token is not configured');
  }
  if (!chatId) {
    throw new Error('Telegram chat ID is required');
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  const bodyPayload = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };

  if (reply_markup) {
    bodyPayload.reply_markup = reply_markup;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  const responseJson = await res.json().catch(() => ({}));

  if (!res.ok || !responseJson.ok) {
    throw new Error(`Telegram API error: ${responseJson.description || res.statusText}`);
  }

  return { success: true, message: 'Telegram notification dispatched' };
}

/**
 * Dispatches multi-channel notifications for a user based on their NotificationSettings
 */
async function dispatchUserStudyReminders(user, settings, stats = {}) {
  const results = { discord: null, telegram: null };
  const username = user.name || user.username || 'Student';

  // 1. Dispatch Discord
  if (settings.channelDiscordEnabled && settings.discordWebhookUrl) {
    try {
      const payload = formatDiscordPayload({
        username,
        pendingCards: stats.pendingCards || 0,
        streakCount: stats.streakCount || user.streak || 0,
        nextExamDays: stats.nextExamDays,
        examName: stats.examName,
      });
      results.discord = await sendDiscordNotification(settings.discordWebhookUrl, payload);
    } catch (err) {
      console.warn(`[ExternalNotification] Discord dispatch failed for user ${user.id}:`, err.message);
      results.discord = { success: false, error: err.message };
    }
  }

  // 2. Dispatch Telegram
  if (settings.channelTelegramEnabled && settings.telegramChatId) {
    try {
      const { text, reply_markup } = formatTelegramMessage({
        username,
        pendingCards: stats.pendingCards || 0,
        streakCount: stats.streakCount || user.streak || 0,
        nextExamDays: stats.nextExamDays,
        examName: stats.examName,
      });

      results.telegram = await sendTelegramNotification({
        botToken: settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN,
        chatId: settings.telegramChatId,
        text,
        reply_markup,
      });
    } catch (err) {
      console.warn(`[ExternalNotification] Telegram dispatch failed for user ${user.id}:`, err.message);
      results.telegram = { success: false, error: err.message };
    }
  }

  return results;
}

module.exports = {
  formatDiscordPayload,
  formatTelegramMessage,
  sendDiscordNotification,
  sendTelegramNotification,
  dispatchUserStudyReminders,
};
