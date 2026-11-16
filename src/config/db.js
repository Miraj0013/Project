'use strict';
const mysql = require('mysql2/promise');
const config = require('./index');

// Connection pool. Every query in the app goes through query()/the pool with
// `?` placeholders, so user input is never concatenated into SQL (SQL injection defence).
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
  multipleStatements: false, // stacked queries ("; DROP TABLE ...") are impossible
});

// Keep the DB session in UTC so CURRENT_TIMESTAMP matches JS Date values.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { pool, query, one };
