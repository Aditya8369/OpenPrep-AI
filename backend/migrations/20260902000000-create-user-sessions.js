'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      refresh_token_hash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      device_fingerprint: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      geo_country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      geo_city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      longitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_active_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('user_sessions', ['user_id'], {
      name: 'idx_user_sessions_user_id',
    });
    await queryInterface.addIndex('user_sessions', ['user_id', 'is_revoked'], {
      name: 'idx_user_sessions_user_revoked',
    });
    await queryInterface.addIndex('user_sessions', ['refresh_token_hash'], {
      name: 'idx_user_sessions_refresh_hash',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_sessions');
  },
};
