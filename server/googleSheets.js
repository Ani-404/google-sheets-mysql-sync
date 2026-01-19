const {google} = require('googleapis');
const fs = require('fs');
let sheets;
function initSheetsClient(path){
  const key = JSON.parse(fs.readFileSync(path));
  const auth = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
  sheets = google.sheets({version:'v4', auth});
}
async function getValues(spreadsheetId, range){ const r = await sheets.spreadsheets.values.get({spreadsheetId, range, valueRenderOption:'UNFORMATTED_VALUE'}); return r.data.values||[]; }
async function applyChange(spreadsheetId, sheetName, op, pk, rowObj){
  const all = await getValues(spreadsheetId, sheetName);
  const header = all[0] || [];
  const rows = all.slice(1);
  const idIdx = header.indexOf('__id');
  if(idIdx === -1) throw new Error('__id missing');
  const idMap = {}; rows.forEach((r,i)=>{ if(r[idIdx]) idMap[r[idIdx]]=i+2; });
  if(op==='DELETE'){ if(!idMap[pk]) return; const lastCol = String.fromCharCode(65 + header.length - 1); await sheets.spreadsheets.values.clear({spreadsheetId, range:`${sheetName}!A${idMap[pk]}:${lastCol}${idMap[pk]}`}); return; }
  const rowArray = header.map(h => (rowObj[h]!==undefined?rowObj[h]:''));
  if(idMap[pk]){ await sheets.spreadsheets.values.update({spreadsheetId, range:`${sheetName}!A${idMap[pk]}`, valueInputOption:'RAW', requestBody:{values:[rowArray]}}); }
  else{ await sheets.spreadsheets.values.append({spreadsheetId, range:sheetName, valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{values:[rowArray]}}); }
}
module.exports = { initSheetsClient, applyChange };