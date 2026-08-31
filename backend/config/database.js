// =====================================================
// config/database.js
// Sets up the Sequelize connection instance to MySQL.
// All model files import this "sequelize" instance so
// that every model shares the same underlying connection.
//
// Works for BOTH local MySQL and external/cloud MySQL
// (e.g. Railway, Aiven, PlanetScale, Clever Cloud, a VPS).
// Most external hosts require SSL — set DB_SSL=true in
// .env to enable it (see .env.example for details).
// =====================================================

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Some cloud MySQL providers require SSL and reject plain connections.
// Others (plain local MySQL) don't support SSL at all and will error
// if you try to force it. DB_SSL in .env toggles this per-environment.
const useSSL = process.env.DB_SSL === 'true';

// Create a new Sequelize instance using the credentials from .env
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DATABASE_URL || process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false, // set to console.log if you want to see raw SQL queries
    dialectOptions: useSSL
      ? {
          ssl: {
            // "require: true" enables SSL; most managed MySQL hosts use
            // certificates that Node won't validate against a local CA
            // bundle, so we relax certificate verification here. This
            // is the standard approach for connecting to hosts like
            // Railway/Aiven/PlanetScale from a typical app server.
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
    define: {
      // Automatically add createdAt / updatedAt timestamps to every model
      timestamps: true,
    },
  }
);

// Simple helper to test the connection when the server starts.
// This does NOT create tables — that happens via sequelize.sync()
// in server.js. This just confirms credentials/host are correct.
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1); // stop the server if the DB is unreachable
  }
}

module.exports = { sequelize, testConnection };
