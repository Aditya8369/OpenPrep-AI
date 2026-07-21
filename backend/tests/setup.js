process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST || 'postgres://postgres:postgres@localhost:5432/openprep_test';

const { sequelize } = require('../models');

beforeAll(async () => {
  try {
    // Clear and recreate all tables for clean test execution
    await sequelize.sync({ force: true });
  } catch (err) {
    console.warn('\n⚠️ PostgreSQL connection failed in test setup. Ensure PostgreSQL is running on localhost:5432 or set DATABASE_URL_TEST.\n', err.message);
  }
});

afterAll(async () => {
  try {
    await sequelize.close();
  } catch {}
});
