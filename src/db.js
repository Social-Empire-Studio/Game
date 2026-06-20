// MySQL / MariaDB data layer (replaces all JSON file storage)
const mysql = require("mysql2/promise");
const { db } = require("./config");

let pool = null;

// Create the database if it doesn't exist, then return a pool bound to it.
async function init() {
  // First connect without a database to ensure it exists.
  const bootstrap = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    multipleStatements: true,
  });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  pool = mysql.createPool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });

  await createTables();
  console.log(` [+] Connected to MySQL '${db.database}' at ${db.host}:${db.port}`);
  return pool;
}

async function createTables() {
  // Accounts: login + bcrypt password hash. One account = one empire (userid).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      username      VARCHAR(64)  NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      userid        VARCHAR(64)  NOT NULL UNIQUE,
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  // Saves: the full player document stored as JSON, keyed by userid.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS saves (
      userid     VARCHAR(64) NOT NULL PRIMARY KEY,
      account_id INT         NOT NULL,
      data       JSON        NOT NULL,
      updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_saves_account FOREIGN KEY (account_id)
        REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
}

function getPool() {
  if (!pool) throw new Error("DB not initialised. Call init() first.");
  return pool;
}

// ---------- Account helpers ----------

async function getAccountByUsername(username) {
  const [rows] = await getPool().query(
    "SELECT * FROM accounts WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function createAccount(username, password_hash, userid) {
  const [res] = await getPool().query(
    "INSERT INTO accounts (username, password_hash, userid) VALUES (?, ?, ?)",
    [username, password_hash, userid]
  );
  return res.insertId;
}

// ---------- Save helpers ----------

async function getSaveRow(userid) {
  const [rows] = await getPool().query(
    "SELECT data FROM saves WHERE userid = ? LIMIT 1",
    [String(userid)]
  );
  if (!rows[0]) return null;
  const data = rows[0].data;
  // mysql2 returns JSON columns already parsed; guard for string just in case.
  return typeof data === "string" ? JSON.parse(data) : data;
}

async function getAllSaves() {
  const [rows] = await getPool().query("SELECT userid, data FROM saves");
  const out = {};
  for (const row of rows) {
    out[String(row.userid)] =
      typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  }
  return out;
}

async function upsertSave(userid, account_id, data) {
  await getPool().query(
    `INSERT INTO saves (userid, account_id, data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [String(userid), account_id, JSON.stringify(data)]
  );
}

async function updateSaveData(userid, data) {
  await getPool().query("UPDATE saves SET data = ? WHERE userid = ?", [
    JSON.stringify(data),
    String(userid),
  ]);
}

module.exports = {
  init,
  getPool,
  getAccountByUsername,
  createAccount,
  getSaveRow,
  getAllSaves,
  upsertSave,
  updateSaveData,
};
