/**
 * Google Apps Script backend for the patient assessment form.
 *
 * Deployment:
 * 1. Create a Google Sheet that will store the assessment rows.
 * 2. Open Extensions → Apps Script and paste this file into Code.gs.
 * 3. Run setup() once from Apps Script editor and authorize it.
 * 4. Deploy as Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone with the link (or your Workspace choice)
 * 5. Copy the /exec Web app URL into GOOGLE_SCRIPT_URL in js/generator.js.
 */

const CONFIG = {
  // Optional, but recommended: paste the Google Sheet ID here if this script is not bound
  // directly to the Sheet. The ID is the long part between /d/ and /edit in the Sheet URL.
  SPREADSHEET_ID: '',
  SHEET_NAME: 'Vertinimai',
  RETENTION_DAYS: 7,
  HEADERS: [
    'Įkelta',
    'Vertinimo laikas',
    'Palata',
    'Lova',
    'Įrašas',
    'Žali duomenys'
  ]
};

/**
 * Creates the storage sheet and installs a daily cleanup trigger.
 * Run manually once after pasting this script into Apps Script.
 */
function setup() {
  ensureSheet_();
  installCleanupTrigger_();
  cleanupOldRows();
}

/**
 * Health check endpoint for the deployed Web app.
 */
function doGet() {
  return jsonResponse_({ ok: true, message: 'Patient assessment endpoint is running.' });
}

/**
 * Receives assessment payloads from the patient assessment page.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const sheet = ensureSheet_();
    const uploadedAt = new Date();

    sheet.appendRow([
      uploadedAt,
      payload.Laikas || '',
      payload.palata || '',
      payload.lova || '',
      payload['įrašas'] || payload.irasas || '',
      JSON.stringify(payload)
    ]);

    cleanupOldRows();

    return jsonResponse_({
      ok: true,
      message: 'Assessment saved.',
      retainedUntil: new Date(uploadedAt.getTime() + CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}


/**
 * Manual smoke test from the Apps Script editor. It should append one test row.
 */
function testWriteSample() {
  return doPost({
    parameter: {
      payload: JSON.stringify({
        Laikas: new Date().toLocaleString('lt-LT'),
        palata: 'TEST',
        lova: 'TEST',
        'įrašas': 'Bandomasis įrašas iš Apps Script testWriteSample().'
      })
    }
  });
}

/**
 * Deletes rows older than CONFIG.RETENTION_DAYS based on the uploaded-at column.
 * This is also safe to run manually.
 */
function cleanupOldRows() {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const cutoff = new Date(Date.now() - CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const uploadedAtValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = uploadedAtValues.length - 1; i >= 0; i--) {
    const value = uploadedAtValues[i][0];
    const uploadedAt = value instanceof Date ? value : new Date(value);
    if (uploadedAt instanceof Date && !Number.isNaN(uploadedAt.getTime()) && uploadedAt < cutoff) {
      sheet.deleteRow(i + 2);
    }
  }
}


function getSpreadsheet_() {
  const id = String(CONFIG.SPREADSHEET_ID || '').trim();
  if (id) return SpreadsheetApp.openById(id);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No active spreadsheet. Open Apps Script from Google Sheets Extensions → Apps Script or set CONFIG.SPREADSHEET_ID.');
  }
  return spreadsheet;
}

function ensureSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const hasHeaders = CONFIG.HEADERS.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    headerRange.setValues([CONFIG.HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, CONFIG.HEADERS.length);
  }

  return sheet;
}

function installCleanupTrigger_() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'cleanupOldRows');

  if (existing.length > 0) return;

  ScriptApp.newTrigger('cleanupOldRows')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
}

function parsePayload_(e) {
  const formPayload = e && e.parameter && e.parameter.payload;
  const body = formPayload || (e && e.postData && e.postData.contents);
  if (!body) throw new Error('Empty request body.');

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload must be an object.');
  if (!payload['įrašas'] && !payload.irasas) throw new Error('Payload is missing the assessment text.');
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
