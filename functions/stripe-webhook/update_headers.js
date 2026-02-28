const { execSync } = require('child_process');
const https = require('https');

const SHEET_ID = '1M4sf4aRxYB8ZXjVE2qL3owJROxKBPikEMxK_1lKGrlc';

function apiCall(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'sheets.googleapis.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
        else reject(new Error(`${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const token = execSync('gcloud auth print-access-token 2>/dev/null').toString().trim();
  console.log('Got token, updating headers...');

  await apiCall(token, 'PUT',
    `/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A1:L1?valueInputOption=RAW`,
    { values: [['Name','Email','Company','Phone','Mailbox ID','Package','Credits (£)','Total Spent (£)','Last Purchase','Joined','ID Completed','Notes']] }
  );

  await apiCall(token, 'POST',
    `/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    { requests: [
      { repeatCell: {
        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
          horizontalAlignment: 'CENTER'
        }},
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }},
      { updateSheetProperties: {
        properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount'
      }}
    ]}
  );

  console.log('Done! Headers updated.');
}

run().catch(e => console.error('Error:', e.message));
