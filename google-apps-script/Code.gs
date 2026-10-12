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
  ARCHIVE_SHEET_NAME: 'Neaktyvios istorijos',
  ARCHIVED_HISTORIES_PER_BED: 2,
  HEADERS: [
    'Įkelta',
    'Vertinimo laikas',
    'Palata',
    'Lova',
    'Įrašas',
    'Žali duomenys',
    'Epizodo ID',
    'Vertinimo ID',
    'Slaugytojos pataisymas',
    'Pataisyta'
  ],
  ARCHIVE_HEADERS: [
    'Įkelta',
    'Vertinimo laikas',
    'Palata',
    'Lova',
    'Įrašas',
    'Žali duomenys',
    'Istorija užbaigta',
    'Istorijos ID',
    'Epizodo ID',
    'Vertinimo ID',
    'Slaugytojos pataisymas',
    'Pataisyta'
  ]
};

/**
 * Creates active/archive sheets and installs a weekly archive cleanup trigger.
 * Run manually once after pasting this script into Apps Script.
 */
function setup() {
  ensureSheet_();
  ensureArchiveSheet_();
  installArchiveCleanupTrigger_();
  cleanupArchivedHistories();
}

/**
 * Health check endpoint for the deployed Web app.
 */
function doGet(e) {
  try {
    const spreadsheet = getSpreadsheet_();
    const action = e && e.parameter && e.parameter.action;
    const callback = e && e.parameter && e.parameter.callback;

    if (action === 'list') {
      return response_(callback, {
        ok: true,
        records: listAssessmentRows_()
      });
    }

    if (action === 'clearBed') {
      const palata = e && e.parameter && e.parameter.palata;
      const lova = e && e.parameter && e.parameter.lova;
      return response_(callback, archiveBedRows_(palata, lova));
    }

    return response_(callback, {
      ok: true,
      message: 'Patient assessment endpoint is running.',
      spreadsheet: spreadsheet.getName(),
      sheet: CONFIG.SHEET_NAME
    });
  } catch (error) {
    return response_(e && e.parameter && e.parameter.callback, {
      ok: false,
      message: 'Endpoint is running, but the spreadsheet is not connected.',
      error: String(error && error.message ? error.message : error)
    });
  }
}

/**
 * Receives assessment payloads from the patient assessment page.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);
    if (payload.action === 'updateAssessment') {
      return jsonResponse_(updateAssessment_(payload));
    }
    validatePayload_(payload);

    const sheet = ensureSheet_();
    const uploadedAt = new Date();
    const episodeId = getOrCreateEpisodeId_(sheet, payload.palata, payload.lova);
    const assessmentId = Utilities.getUuid();
    payload.episodeId = episodeId;
    payload.assessmentId = assessmentId;

    sheet.appendRow([
      uploadedAt,
      payload.Laikas || '',
      payload.palata || '',
      payload.lova || '',
      payload['įrašas'] || payload.irasas || '',
      JSON.stringify(payload),
      episodeId,
      assessmentId,
      '',
      ''
    ]);

    return jsonResponse_({
      ok: true,
      message: 'Assessment saved.',
      episodeId,
      assessmentId
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
 * Keeps only the newest archived histories for each room/bed.
 * One history can contain multiple assessment rows and is identified by history ID.
 * This is safe to run manually and is also run by a weekly trigger.
 */
function cleanupArchivedHistories() {
  const sheet = ensureArchiveSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.ARCHIVE_HEADERS.length).getValues();
  const historiesByBed = {};

  values.forEach((row, index) => {
    const room = String(row[2] || '').trim();
    const bed = String(row[3] || '').trim();
    const closedAt = row[6] instanceof Date ? row[6] : new Date(row[6]);
    const historyId = String(row[7] || '').trim();
    if (!room || !bed || !historyId) return;

    const bedKey = `${room}__${bed}`;
    if (!historiesByBed[bedKey]) historiesByBed[bedKey] = {};
    if (!historiesByBed[bedKey][historyId]) {
      historiesByBed[bedKey][historyId] = {
        closedAt: Number.isNaN(closedAt.getTime()) ? 0 : closedAt.getTime(),
        rowIndexes: []
      };
    }
    historiesByBed[bedKey][historyId].rowIndexes.push(index + 2);
  });

  const rowsToDelete = [];
  Object.keys(historiesByBed).forEach(bedKey => {
    const histories = Object.values(historiesByBed[bedKey])
      .sort((a, b) => b.closedAt - a.closedAt);

    histories.slice(CONFIG.ARCHIVED_HISTORIES_PER_BED).forEach(history => {
      rowsToDelete.push(...history.rowIndexes);
    });
  });

  rowsToDelete.sort((a, b) => b - a).forEach(rowNumber => sheet.deleteRow(rowNumber));
}

// Compatibility for an old installed trigger. setup() removes that trigger.
function cleanupOldRows() {
  cleanupArchivedHistories();
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



function archiveBedRows_(palata, lova) {
  const room = String(palata || '').trim();
  const bed = String(lova || '').trim();
  if (!room || !bed) return { ok: false, error: 'Missing palata or lova.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = ensureSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { ok: true, archived: 0 };

    const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
    const rowsToArchive = [];
    const sourceRowsToDelete = [];
    const closedAt = new Date();
    let historyId = '';

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const raw = parseRawPayload_(row[5]);
      const rowRoom = String(row[2] || raw.palata || '').trim();
      const rowBed = String(row[3] || raw.lova || '').trim();

      if (rowRoom === room && rowBed === bed) {
        const episodeId = String(row[6] || raw.episodeId || '').trim();
        if (!historyId && episodeId) historyId = episodeId;
        rowsToArchive.push({ row, episodeId });
        sourceRowsToDelete.push(i + 2);
      }
    }

    if (!rowsToArchive.length) return { ok: true, archived: 0 };
    if (!historyId) historyId = Utilities.getUuid();

    const archiveValues = rowsToArchive.map(item => [
      ...item.row.slice(0, 6),
      closedAt,
      historyId,
      item.episodeId || historyId,
      item.row[7] || Utilities.getUuid(),
      item.row[8] || '',
      item.row[9] || ''
    ]);

    const archiveSheet = ensureArchiveSheet_();
    const archiveStartRow = archiveSheet.getLastRow() + 1;
    archiveSheet
      .getRange(archiveStartRow, 1, archiveValues.length, CONFIG.ARCHIVE_HEADERS.length)
      .setValues(archiveValues);
    SpreadsheetApp.flush();

    sourceRowsToDelete.sort((a, b) => b - a).forEach(rowNumber => sheet.deleteRow(rowNumber));

    return { ok: true, archived: rowsToArchive.length, historyId };
  } finally {
    lock.releaseLock();
  }
}

function updateAssessment_(payload) {
  const assessmentId = String(payload.assessmentId || '').trim();
  const episodeId = String(payload.episodeId || '').trim();
  const room = String(payload.palata || '').trim();
  const bed = String(payload.lova || '').trim();
  const edited = payload.edited;

  if (!assessmentId || !episodeId || !room || !bed) {
    throw new Error('Assessment update is missing identifying fields.');
  }
  if (!edited || typeof edited !== 'object') {
    throw new Error('Assessment update is missing edited data.');
  }

  const normalizedEdit = {
    esamos: normalizeStringArray_(edited.esamos),
    galimos: normalizeStringArray_(edited.galimos),
    planas: String(edited.planas || '').trim()
  };
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('Assessment not found.');

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (
      String(row[7] || '').trim() === assessmentId &&
      String(row[6] || '').trim() === episodeId &&
      String(row[2] || '').trim() === room &&
      String(row[3] || '').trim() === bed
    ) {
      const editedAt = new Date();
      sheet.getRange(i + 2, 9).setValue(JSON.stringify(normalizedEdit));
      sheet.getRange(i + 2, 10).setValue(editedAt);
      return { ok: true, assessmentId, episodeId, editedAt: editedAt.toISOString() };
    }
  }

  throw new Error('Assessment not found or identifiers do not match.');
}

function normalizeStringArray_(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean);
}

function getOrCreateEpisodeId_(sheet, palata, lova) {
  const room = String(palata || '').trim();
  const bed = String(lova || '').trim();
  if (!room || !bed) throw new Error('Payload is missing palata or lova.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return Utilities.getUuid();

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  const matchingRows = [];
  let episodeId = '';

  values.forEach((row, index) => {
    const raw = parseRawPayload_(row[5]);
    const rowRoom = String(row[2] || raw.palata || '').trim();
    const rowBed = String(row[3] || raw.lova || '').trim();
    if (rowRoom !== room || rowBed !== bed) return;

    matchingRows.push({ rowNumber: index + 2, episodeId: String(row[6] || raw.episodeId || '').trim() });
  });

  const latestIdentifiedRow = [...matchingRows].reverse().find(item => item.episodeId);
  if (latestIdentifiedRow) episodeId = latestIdentifiedRow.episodeId;
  if (!episodeId) episodeId = Utilities.getUuid();

  matchingRows.forEach(item => {
    if (!item.episodeId) sheet.getRange(item.rowNumber, 7).setValue(episodeId);
  });

  return episodeId;
}

function parseRawPayload_(rawText) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return {};
  }
}

function listAssessmentRows_() {
  const sheet = ensureSheet_();
  ensureActiveEpisodeIds_(sheet);
  ensureAssessmentIds_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  return values.map(row => {
    const raw = parseRawPayload_(row[5]);

    return {
      uploadedAt: row[0] instanceof Date ? row[0].toISOString() : row[0],
      Laikas: row[1] || raw.Laikas || '',
      palata: row[2] || raw.palata || '',
      lova: row[3] || raw.lova || '',
      irasas: row[4] || raw['įrašas'] || raw.irasas || '',
      episodeId: row[6] || raw.episodeId || '',
      assessmentId: row[7] || raw.assessmentId || '',
      edited: parseRawPayload_(row[8]),
      editedAt: row[9] instanceof Date ? row[9].toISOString() : row[9],
      raw
    };
  }).filter(record => record.palata && record.lova);
}

function ensureActiveEpisodeIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  const rowsByBed = {};

  values.forEach((row, index) => {
    const raw = parseRawPayload_(row[5]);
    const room = String(row[2] || raw.palata || '').trim();
    const bed = String(row[3] || raw.lova || '').trim();
    if (!room || !bed) return;

    const key = `${room}__${bed}`;
    if (!rowsByBed[key]) rowsByBed[key] = [];
    rowsByBed[key].push({
      rowNumber: index + 2,
      episodeId: String(row[6] || raw.episodeId || '').trim()
    });
  });

  Object.values(rowsByBed).forEach(rows => {
    const identifiedRow = [...rows].reverse().find(item => item.episodeId);
    const episodeId = identifiedRow ? identifiedRow.episodeId : Utilities.getUuid();
    rows.forEach(item => {
      if (!item.episodeId) sheet.getRange(item.rowNumber, 7).setValue(episodeId);
    });
  });
}

function ensureAssessmentIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, 8, lastRow - 1, 1).getValues();
  values.forEach((row, index) => {
    if (!String(row[0] || '').trim()) {
      sheet.getRange(index + 2, 8).setValue(Utilities.getUuid());
    }
  });
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

function ensureArchiveSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.ARCHIVE_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.ARCHIVE_SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, CONFIG.ARCHIVE_HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const hasHeaders = CONFIG.ARCHIVE_HEADERS.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    headerRange.setValues([CONFIG.ARCHIVE_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, CONFIG.ARCHIVE_HEADERS.length);
  }

  return sheet;
}

function installArchiveCleanupTrigger_() {
  const cleanupHandlers = ['cleanupOldRows', 'cleanupArchivedHistories'];
  const existing = ScriptApp.getProjectTriggers()
    .filter(trigger => cleanupHandlers.includes(trigger.getHandlerFunction()));

  existing.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('cleanupArchivedHistories')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
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
    const decodedPayload = parseUrlEncodedPayload_(body);
    if (decodedPayload) return decodedPayload;
    throw new Error('Request body must be valid JSON.');
  }
}

function parseUrlEncodedPayload_(body) {
  const match = String(body).match(/(?:^|&)payload=([^&]+)/);
  if (!match) return null;

  try {
    return JSON.parse(decodeURIComponent(match[1].replace(/\+/g, ' ')));
  } catch (error) {
    return null;
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload must be an object.');
  if (!payload['įrašas'] && !payload.irasas) throw new Error('Payload is missing the assessment text.');
}

function response_(callback, data) {
  if (callback) return jsonpResponse_(callback, data);
  return jsonResponse_(data);
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse_(callback, data) {
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(data)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
