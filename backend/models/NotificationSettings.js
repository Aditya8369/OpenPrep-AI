const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const NotificationSettings = sequelize.define(
  'NotificationSettings',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    dailyDigestEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    dailyDigestTime: {
      type: DataTypes.TIME,
      allowNull: false,
      defaultValue: '07:00:00',
    },
    streakFreezeWarningEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    overdueFlashcardAlertsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    channelEmailEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    channelTelegramEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    channelDiscordEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    channelInAppEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    telegramChatId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    telegramBotToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    discordWebhookUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: 'NotificationSettings',
  }
);

module.exports = NotificationSettings;
