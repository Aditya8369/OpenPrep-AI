const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BattleSession = sequelize.define(
  'BattleSession',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    roomCode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    roomName: {
      type: DataTypes.STRING(255),
      defaultValue: 'Battle Room',
    },
    password: {
      type: DataTypes.STRING(255),
      defaultValue: '',
    },
    hostUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    topicId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    questionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    timePerQuestion: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
    },
    status: {
      type: DataTypes.ENUM('waiting', 'playing', 'finished'),
      defaultValue: 'waiting',
    },
    scores: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['roomCode'],
      },
    ],
  }
);

module.exports = BattleSession;
