const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const UserSession = sequelize.define(
  'UserSession',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    refreshTokenHash: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'refresh_token_hash',
    },
    deviceFingerprint: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      field: 'device_fingerprint',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address',
    },
    geoCountry: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'geo_country',
    },
    geoCity: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'geo_city',
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_revoked',
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_active_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
  },
  {
    tableName: 'user_sessions',
    timestamps: true,
    underscored: true,
  }
);

module.exports = UserSession;
