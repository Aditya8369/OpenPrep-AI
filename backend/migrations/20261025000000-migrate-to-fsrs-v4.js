'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add FSRS columns to Flashcards table
    const tableInfo = await queryInterface.describeTable('Flashcards').catch(() => ({}));

    if (!tableInfo.stability) {
      await queryInterface.addColumn('Flashcards', 'stability', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.fsrsDifficulty) {
      await queryInterface.addColumn('Flashcards', 'fsrsDifficulty', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.reps) {
      await queryInterface.addColumn('Flashcards', 'reps', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
    }

    if (!tableInfo.lapses) {
      await queryInterface.addColumn('Flashcards', 'lapses', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
    }

    if (!tableInfo.state) {
      await queryInterface.addColumn('Flashcards', 'state', {
        type: Sequelize.STRING,
        defaultValue: 'new',
      });
    }

    if (!tableInfo.retrievability) {
      await queryInterface.addColumn('Flashcards', 'retrievability', {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: null,
      });
    }

    if (!tableInfo.elapsedDays) {
      await queryInterface.addColumn('Flashcards', 'elapsedDays', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
    }

    if (!tableInfo.scheduledDays) {
      await queryInterface.addColumn('Flashcards', 'scheduledDays', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      });
    }

    // 2. Add fsrsTargetRetention to Users table
    const userTableInfo = await queryInterface.describeTable('Users').catch(() => ({}));
    if (!userTableInfo.fsrsTargetRetention) {
      await queryInterface.addColumn('Users', 'fsrsTargetRetention', {
        type: Sequelize.FLOAT,
        defaultValue: 0.90,
      });
    }

    // 3. Migrate existing SM-2 flashcard rows to initial FSRS (S, D) values
    try {
      await queryInterface.sequelize.query(`
        UPDATE "Flashcards"
        SET
          "stability" = GREATEST(0.4, COALESCE("interval", 1.0)),
          "fsrsDifficulty" = GREATEST(1.0, LEAST(10.0, 11.0 - (COALESCE("efactor", 2.5) - 1.3) * (9.0 / 1.7))),
          "reps" = COALESCE("repetitions", 0),
          "scheduledDays" = GREATEST(1, COALESCE("interval", 1)),
          "state" = CASE
            WHEN "repetitions" > 1 AND "interval" > 1 THEN 'review'
            WHEN "repetitions" = 1 THEN 'learning'
            ELSE 'new'
          END
        WHERE "stability" IS NULL;
      `);
    } catch {
      // Non-fatal if table is empty or in test dialect without quotes
    }
  },

  down: async (queryInterface) => {
    const columns = [
      'stability',
      'fsrsDifficulty',
      'reps',
      'lapses',
      'state',
      'retrievability',
      'elapsedDays',
      'scheduledDays',
    ];

    for (const col of columns) {
      try {
        await queryInterface.removeColumn('Flashcards', col);
      } catch {}
    }

    try {
      await queryInterface.removeColumn('Users', 'fsrsTargetRetention');
    } catch {}
  },
};
