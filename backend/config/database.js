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

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
const connectionOptions = {
  dialect: 'mysql',
  logging: false,
  dialectOptions: useSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  define: { timestamps: true },
};

// Hosted databases commonly provide a complete mysql:// connection URL. The
// previous setup used that URL as a hostname, which made hosted deployments
// fail to connect. Local development can continue to use the individual DB_*
// variables from .env.example.
const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, connectionOptions)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...connectionOptions,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
      }
    );

// Simple helper to test the connection when the server starts.
// This does NOT create tables — that happens via sequelize.sync()
// in server.js. This just confirms credentials/host are correct.
async function testConnection() {
  if (!databaseUrl && (!process.env.DB_NAME || !process.env.DB_USER)) {
    console.error('❌ Database configuration is missing. Create backend/.env from backend/.env.example, or set DATABASE_URL/MYSQL_URL in your hosting service.');
    process.exit(1);
  }
  try {
    await sequelize.authenticate();
    console.log('MySQL connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1); // stop the server if the DB is unreachable
  }
}

module.exports = { sequelize, testConnection };
