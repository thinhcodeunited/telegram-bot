const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const MenuModel = require('./database/menu.cjs');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// SCAN DOCUMENT
const sheet_id = process.env.SHEET_ID;

async function test_sheet() {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      range: `A5:G`,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data sheet found');
      return;
    }

    console.log(rows);
  } catch (error) {
    console.error(error.message);
    console.log('Test menu yesterday fail');
  }
}

async function scan() {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      range: `A5:M`,
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data sheet found');
      return;
    }

    let query = [];
    for (let row of rows) {
      if (!row[1] ) continue;
 
      query.push({
        name: row[1],
        set: row[4] + ' + ' + row[5] + ' + ' + row[6] + ' + ' + row[7] + ' + ' + row[8],
        note: row[3],
        price: 35000,
        count: null
      })
    }

    await MenuModel.create(query);

    console.log('Scan menu yesterday successfully');
  } catch (error) {
    console.error(error.message);
    console.log('Scan menu yesterday fail');
  }

}


async function clean() {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId: sheet_id,
      range: `B6:M18`,
    });

    console.log('Clean menu yesterday successfully');
  } catch (error) {
    console.error(error.message);
    console.log('Clean menu yesterday fail');
  }
}

module.exports = { scan, clean, test_sheet }