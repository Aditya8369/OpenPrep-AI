/**
 * Daily Study Reminder & Multi-Channel Alert Job
 * Dispatches Telegram and Discord notifications to students with pending cards or goals.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const User = require('../models/User');
const Flashcard = require('../models/Flashcard');
const NotificationSettings = require('../models/NotificationSettings');
const { dispatchUserStudyReminders } = require('../services/externalNotificationService');

/**
 * Runs the daily notification dispatch cycle across active users
 */
async function runDailyStudyReminderCycle() {
  try {
    const now = new Date();

    // Find all users with active external notification channels
    const settingsList = await NotificationSettings.findAll({
      where: {
        [Op.or]: [
          { channelDiscordEnabled: true, discordWebhookUrl: { [Op.ne]: null } },
          { channelTelegramEnabled: true, telegramChatId: { [Op.ne]: null } },
        ],
      },
    });

    for (const settings of settingsList) {
      try {
        const user = await User.findByPk(settings.userId);
        if (!user) continue;

        // Count pending due flashcards for this user
        let pendingCards = 0;
        try {
          pendingCards = await Flashcard.count({
            where: {
              user: user.id,
              nextReviewDate: { [Op.lte]: now },
            },
          });
        } catch (e) {
          // If query fails, default to 0
        }

        const stats = {
          pendingCards,
          streakCount: user.streak || 0,
        };

        await dispatchUserStudyReminders(user, settings, stats);
      } catch (userErr) {
        // Individual user failure should never crash the scheduler
        console.warn(`[StudyReminderJob] Failed to dispatch reminder for user ${settings.userId}:`, userErr.message);
      }
    }
  } catch (error) {
    console.error('[StudyReminderJob] Cron execution error:', error.message);
  }
}

/**
 * Initializes the daily cron job scheduler (default: runs daily at 08:00 AM)
 */
function initStudyReminderJob() {
  // Runs every day at 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[StudyReminderJob] Triggering daily multi-channel study reminders...');
    await runDailyStudyReminderCycle();
  });

  console.log('✅ Multi-Channel Study Reminder Job initialized (Daily at 08:00 AM)');
}

module.exports = {
  runDailyStudyReminderCycle,
  initStudyReminderJob,
};
