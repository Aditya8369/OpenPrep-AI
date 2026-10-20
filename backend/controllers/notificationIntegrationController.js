/**
 * Notification Integration Controller
 * Manages user Discord Webhook and Telegram Bot notification channels
 */

const NotificationSettings = require('../models/NotificationSettings');
const {
  formatDiscordPayload,
  formatTelegramMessage,
  sendDiscordNotification,
  sendTelegramNotification,
} = require('../services/externalNotificationService');

/**
 * Updates external notification integration settings
 * PUT /api/users/notifications/integrations
 */
const updateNotificationIntegrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      channelDiscordEnabled,
      discordWebhookUrl,
      channelTelegramEnabled,
      telegramChatId,
      telegramBotToken,
    } = req.body;

    // Validate Discord webhook if provided
    if (discordWebhookUrl && typeof discordWebhookUrl === 'string') {
      if (!discordWebhookUrl.startsWith('https://discord.com/api/webhooks/') &&
          !discordWebhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
        return res.status(400).json({
          success: false,
          error: 'Discord webhook URL must start with https://discord.com/api/webhooks/',
        });
      }
    }

    let [settings] = await NotificationSettings.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    if (channelDiscordEnabled !== undefined) settings.channelDiscordEnabled = Boolean(channelDiscordEnabled);
    if (discordWebhookUrl !== undefined) settings.discordWebhookUrl = discordWebhookUrl || null;
    if (channelTelegramEnabled !== undefined) settings.channelTelegramEnabled = Boolean(channelTelegramEnabled);
    if (telegramChatId !== undefined) settings.telegramChatId = telegramChatId || null;
    if (telegramBotToken !== undefined) settings.telegramBotToken = telegramBotToken || null;

    await settings.save();

    return res.status(200).json({
      success: true,
      message: 'Notification integration preferences updated successfully',
      data: {
        channelDiscordEnabled: settings.channelDiscordEnabled,
        discordWebhookUrl: settings.discordWebhookUrl ? '***' + settings.discordWebhookUrl.slice(-12) : null,
        channelTelegramEnabled: settings.channelTelegramEnabled,
        telegramChatId: settings.telegramChatId,
        telegramBotTokenConfigured: Boolean(settings.telegramBotToken),
      },
    });
  } catch (error) {
    console.error('Error updating notification integrations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification integrations: ' + error.message,
    });
  }
};

/**
 * Tests external notification channel dispatch
 * POST /api/users/notifications/integrations/test
 */
const testNotificationIntegration = async (req, res) => {
  try {
    const { channel, discordWebhookUrl, telegramChatId, telegramBotToken } = req.body;
    const username = req.user?.name || req.user?.username || 'Student';

    if (channel === 'discord') {
      const targetUrl = discordWebhookUrl || req.user?.NotificationSetting?.discordWebhookUrl;
      if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'Discord webhook URL is required to test' });
      }

      const payload = formatDiscordPayload({
        username,
        pendingCards: 15,
        streakCount: 7,
        nextExamDays: 14,
        examName: 'Midterm Examination',
        quote: 'Test notification from OpenPrep AI! Your Discord webhook is working properly.',
      });

      await sendDiscordNotification(targetUrl, payload);
      return res.status(200).json({
        success: true,
        message: 'Test notification sent to Discord successfully!',
      });
    }

    if (channel === 'telegram') {
      const chatId = telegramChatId || req.user?.NotificationSetting?.telegramChatId;
      const botToken = telegramBotToken || req.user?.NotificationSetting?.telegramBotToken;

      if (!chatId) {
        return res.status(400).json({ success: false, error: 'Telegram Chat ID is required to test' });
      }

      const { text, reply_markup } = formatTelegramMessage({
        username,
        pendingCards: 15,
        streakCount: 7,
        nextExamDays: 14,
        examName: 'Midterm Examination',
        quote: 'Test alert from OpenPrep AI! Your Telegram connection is working properly.',
      });

      await sendTelegramNotification({
        botToken,
        chatId,
        text,
        reply_markup,
      });

      return res.status(200).json({
        success: true,
        message: 'Test notification sent to Telegram successfully!',
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid channel specified. Must be "discord" or "telegram"',
    });
  } catch (error) {
    console.error('Error testing notification integration:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dispatch test notification: ' + error.message,
    });
  }
};

module.exports = {
  updateNotificationIntegrations,
  testNotificationIntegration,
};
