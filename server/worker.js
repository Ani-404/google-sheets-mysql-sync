require('dotenv').config();
const path = require('path');
const { google } = require('googleapis');

const {
  initPool,
  fetchUnprocessedChangeLogs,
  markChangeProcessed
} = require('./db');

/* -------------------- MySQL INIT -------------------- */

async function initDB() {
  await initPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  console.log('MySQL pool initialized (worker)');
}

/* -------------------- GOOGLE SHEETS -------------------- */

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'service-account.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'users';

async function applyChangeToSheet(change) {
  const row =
  typeof change.row_data === 'string'
    ? JSON.parse(change.row_data)
    : change.row_data;

  const values = [[
    row.__id,
    row.name || '',
    row.email || '',
    row.role || '',
    row.__version
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

/* -------------------- WORKER LOOP -------------------- */

async function run() {
  await initDB(); // 🔥 THIS WAS MISSING

  while (true) {
    try {
      const changes = await fetchUnprocessedChangeLogs();

      for (const change of changes) {
        if (change.source === 'db') {
          await applyChangeToSheet(change);
        }
        await markChangeProcessed(change.id);
      }

    } catch (err) {
      console.error('Worker error:', err.message);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

run();