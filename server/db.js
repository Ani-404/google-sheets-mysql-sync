const mysql = require('mysql2/promise');

let pool;

async function initPool(cfg) {
  pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10
  });
  return pool;
}

function getPool() {
  if (!pool) throw new Error('MySQL pool not initialized');
  return pool;
}

async function insertChangeLog(id, table, pk, op, row, source, processed = false) {
  const p = getPool();
  return p.query(
    `INSERT INTO change_log 
     (id, table_name, pk, op, row_data, source, processed) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, table, pk, op, JSON.stringify(row || {}), source, processed ? 1 : 0]
  );
}

async function upsertRow(table, row) {
  const p = getPool();

  if (!row.__id) {
    throw new Error('__id is required for upsert');
  }

  // HARD SAFETY: ensure no removed columns sneak in
  delete row.__last_modified_utc;

  const keys = Object.keys(row);
  const cols = keys.map(k => `\`${k}\``).join(',');
  const placeholders = keys.map(() => '?').join(',');
  const updates = keys
    .filter(k => k !== '__id')
    .map(k => `\`${k}\`=VALUES(\`${k}\`)`)
    .join(',');

  const sql = `
    INSERT INTO \`${table}\` (${cols})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}
  `;

  return p.query(sql, keys.map(k => row[k]));
}

async function getRowById(table, id) {
  const p = getPool();
  const [rows] = await p.query(
    `SELECT * FROM \`${table}\` WHERE __id=? LIMIT 1`,
    [id]
  );
  return rows[0];
}

async function fetchUnprocessedChangeLogs(limit = 50) {
  const p = getPool();
  const [rows] = await p.query(
    `SELECT * FROM change_log 
     WHERE processed=FALSE 
     ORDER BY created_at 
     LIMIT ?`,
    [limit]
  );
  return rows;
}

async function markChangeProcessed(id) {
  const p = getPool();
  return p.query(
    `UPDATE change_log 
     SET processed=TRUE, processed_at=CURRENT_TIMESTAMP 
     WHERE id=?`,
    [id]
  );
}

module.exports = {
  initPool,
  getPool,
  insertChangeLog,
  upsertRow,
  getRowById,
  fetchUnprocessedChangeLogs,
  markChangeProcessed
};
