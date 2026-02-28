// Run this once from Cloud Shell: node update_headers.js
const { google } = require('googleapis');
const path = require('path');

// Try service account key first, fall back to ADC
let authConfig = {
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
};

// If running locally with a key file, use it
const keyFile = path.join(__dirname, 'serviceAccountKey.json');
try {
  require(keyFile);
  authConfig.keyFile = keyFile;
} catch(e) {
  // No key file - will use ADC or gcloud credentials
}

const auth = new google.auth.GoogleAuth(authConfig);
const SHEET_ID = '1M4sf4aRxYB8ZXjVE2qL3owJROxKBPikEMxK_1lKGrlc';

async function updateHeaders() {
  // Use gcloud access token directly
  const { execSync } = require('child_process');
  let token;
  try {
    token = execSync('gcloud auth print-access-token').toString().trim();
  } catch(e) {
    console.error('Could not get gcloud token:', e.message);
    process.exit(1);
  }

  const { google: g } = require('googleapis');
  const authClient = new g.auth.OAuth2();
  authClient.setCredentials({ access_token: token });
  const sheets = g.sheets({ version: 'v4', auth: authClient });

  // Set headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:L1',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        'Name', 'Email', 'Company', 'Phone', 'Mailbox ID',
        'Package', 'Credits (£)', 'Total Spent (£)', 'Last Purchase',
        'Joined', 'ID Completed', 'Notes'
      ]]
    }
  });

  // Navy header style + freeze row 1
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
          }
        }
      ]
    }
  });

  console.log('Done! Headers updated with navy styling and frozen.');
}

updateHeaders().catch(console.error);
