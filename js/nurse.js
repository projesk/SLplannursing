/* nurse.js – slaugytojos posto anoniminis palatų / lovų vaizdas */

const NURSE_GOOGLE_SCRIPT_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbyz9PsXD4u_e_QjM9ETDtEdTVcjEIaE0MFTACpzBSDE6Em6EeoP76495aE26HmqNk5KjQ/exec';
let resolvedNurseGoogleScriptUrl = null;
const ROOMS = ['1', '2', '3', '4', '5'];
const BEDS = ['1', '2', '3', '4'];

let nurseState = {
  records: [],
  grouped: new Map(),
  selectedKey: null,
  activeRecord: null,
  printPreview: false,
  hasUnsavedChanges: false,
  savedEditState: null
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadNurseData);
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closePlanModal));
  document.getElementById('printPlanBtn').addEventListener('click', printCurrentPlan);
  document.getElementById('editPlanBtn').addEventListener('click', handleEditPlanClick);
  document.getElementById('savePlanBtn').addEventListener('click', savePlanEdit);
  document.getElementById('saveChangesPromptBtn').addEventListener('click', savePromptedChanges);
  document.getElementById('discardChangesPromptBtn').addEventListener('click', discardPromptedChanges);
  document.getElementById('continueEditingPromptBtn').addEventListener('click', continueEditingFromPrompt);
  loadNurseData();
});

function loadNurseData() {
  setLoading('Kraunami duomenys…');
  fetchAssessments()
    .then(records => {
      nurseState.records = normalizeRecords(records);
      nurseState.grouped = groupByBed(nurseState.records);
      renderRoomsGrid();
      if (nurseState.selectedKey) renderPatientCard(nurseState.selectedKey);
      setLoading('');
    })
    .catch(() => {
      setLoading('Nepavyko įkelti duomenų. Patikrinkite Apps Script /exec adresą ir deployment teises.');
      nurseState.records = [];
      nurseState.grouped = new Map();
      renderRoomsGrid();
    });
}

function fetchAssessments() {
  return getNurseGoogleScriptUrl()
    .then(url => jsonp(`${url}?action=list`))
    .then(data => data.records || []);
}

function clearBedAssessments(room, bed) {
  return getNurseGoogleScriptUrl().then(baseUrl => {
    const url = `${baseUrl}?action=clearBed&palata=${encodeURIComponent(room)}&lova=${encodeURIComponent(bed)}`;
    return jsonp(url);
  });
}

function getNurseGoogleScriptUrl() {
  if (resolvedNurseGoogleScriptUrl) return Promise.resolve(resolvedNurseGoogleScriptUrl);

  return fetch('js/generator.js', { cache: 'no-store' })
    .then(response => response.ok ? response.text() : '')
    .then(source => {
      const match = source.match(/const\s+GOOGLE_SCRIPT_URL\s*=\s*['"]([^'"]+)['"]/);
      resolvedNurseGoogleScriptUrl = match ? match[1] : NURSE_GOOGLE_SCRIPT_URL_FALLBACK;
      return resolvedNurseGoogleScriptUrl;
    })
    .catch(() => {
      resolvedNurseGoogleScriptUrl = NURSE_GOOGLE_SCRIPT_URL_FALLBACK;
      return resolvedNurseGoogleScriptUrl;
    });
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `nurseJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';

    window[callbackName] = data => {
      delete window[callbackName];
      script.remove();
      if (data && data.ok === false) reject(new Error(data.error || 'Apps Script error'));
      else resolve(data || {});
    };

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error('JSONP load failed'));
    };

    script.src = `${url}${separator}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

function normalizeRecords(records) {
  return records
    .map((record, index) => {
      const raw = record.raw || {};
      const text = record.irasas || raw['įrašas'] || raw.irasas || '';
      const parsed = parseAssessmentText(text);
      const storedEdit = normalizeStoredEdit(record.edited);
      if (storedEdit) {
        parsed.esamos = storedEdit.esamos;
        parsed.galimos = storedEdit.galimos;
        parsed.plan = storedEdit.planas;
      }
      return {
        id: `${record.uploadedAt || record.Laikas || index}_${index}`,
        uploadedAt: record.uploadedAt || '',
        time: record.Laikas || raw.Laikas || record.laikas || '',
        palata: String(record.palata || raw.palata || '').trim(),
        lova: String(record.lova || raw.lova || '').trim(),
        episodeId: String(record.episodeId || raw.episodeId || '').trim(),
        assessmentId: String(record.assessmentId || raw.assessmentId || '').trim(),
        editedAt: record.editedAt || '',
        text,
        parsed,
        editedPlan: storedEdit ? storedEdit.planas : null
      };
    })
    .filter(record => record.palata && record.lova)
    .sort((a, b) => getRecordDate(b) - getRecordDate(a));
}

function normalizeStoredEdit(value) {
  if (!value || typeof value !== 'object') return null;
  const hasStoredEdit = ['esamos', 'galimos', 'planas']
    .some(key => Object.prototype.hasOwnProperty.call(value, key));
  if (!hasStoredEdit) return null;

  return {
    esamos: Array.isArray(value.esamos) ? value.esamos.map(String).filter(Boolean) : [],
    galimos: Array.isArray(value.galimos) ? value.galimos.map(String).filter(Boolean) : [],
    planas: String(value.planas || '').trim()
  };
}

function parseAssessmentText(text) {
  return {
    news: parseNumber(/NEWS2:\s*(\d+)\s*bal\./i, text),
    braden: parseNumber(/Braden:\s*(\d+)\s*bal\./i, text),
    must: parseNumber(/MUST:\s*(\d+)\s*bal\./i, text),
    morse: parseNumber(/Morse:\s*(\d+)\s*bal\./i, text),
    pain: parseNumber(/Skausmas\s*(\d+)\s*\/\s*10/i, text),
    vitals: extractVitalsLine(text),
    psychological: extractPsychologicalLine(text),
    restraint: extractRestraintLine(text),
    esamos: splitSection(text, 'Esamos problemos', 'Galimos problemos'),
    galimos: splitSection(text, 'Galimos problemos', 'Slaugos planas'),
    plan: dedupePlanLines(extractPlan(text)),
    hasFixation: /Taikoma fizinė fiksacija|Fiksacijos priežastis|fiksuot/i.test(text)
  };
}

function parseNumber(regex, text) {
  const match = text.match(regex);
  return match ? Number(match[1]) : null;
}

function extractVitalsLine(text) {
  const match = text.match(/Gyvybiniai rodikliai:\n([^\n]*)/i);
  const value = match ? match[1].trim() : '';
  return value && value !== '-' ? value : '';
}

function extractPsychologicalLine(text) {
  const match = text.match(/(?:^|\n)(Pacientas[^\n]*\.)/i);
  return match ? match[1].trim() : '';
}

function extractRestraintLine(text) {
  const match = text.match(/(?:^|\n)(Dėl galimos žalos[^\n]*\.)/i);
  return match ? match[1].trim() : '';
}

function splitSection(text, start, end) {
  const regex = new RegExp(`${escapeRegExp(start)}:\\n([\\s\\S]*?)\\n\\n${escapeRegExp(end)}:`, 'i');
  const match = text.match(regex);
  if (!match) return [];
  const value = match[1].trim();
  if (!value || value === '-') return [];
  return value.split(';').map(item => item.trim()).filter(Boolean);
}

function extractPlan(text) {
  const match = text.match(/Slaugos planas:\n([\s\S]*?)(\n\nPapildomi vertinimo duomenys:|\n\nPacientui skirta|\n\nPirminis vertinimas:|$)/i);
  return match ? match[1].trim() : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function groupByBed(records) {
  const grouped = new Map();
  const activeEpisodeByBed = new Map();

  records.forEach(record => {
    const key = bedKey(record.palata, record.lova);
    const episodeKey = record.episodeId || '__legacy__';

    if (!activeEpisodeByBed.has(key)) activeEpisodeByBed.set(key, episodeKey);
    if (activeEpisodeByBed.get(key) !== episodeKey) return;

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  });
  return grouped;
}

function bedKey(room, bed) {
  return `${room}__${bed}`;
}

function getRecordDate(record) {
  const candidates = [record.uploadedAt, record.time];
  for (const candidate of candidates) {
    const date = parseLtDate(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date(0);
}

function parseLtDate(value) {
  if (!value) return new Date(NaN);
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso;

  const match = String(value).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00`);

  return new Date(value);
}

function renderRoomsGrid() {
  const grid = document.getElementById('roomsGrid');
  grid.innerHTML = '';

  ROOMS.forEach(room => {
    BEDS.forEach(bed => {
      const key = bedKey(room, bed);
      const records = nurseState.grouped.get(key) || [];
      const latest = records[0] || null;
      const risk = latest ? calculateRisk(latest) : { level: 'green', label: 'Laisva / nėra duomenų' };

      const card = document.createElement('div');
      card.className = `bed-card risk-${risk.level}${nurseState.selectedKey === key ? ' active' : ''}`;
      card.innerHTML = `
        <div class="room-bed">Palata ${room} · Lova ${bed}</div>
        <div class="time">${latest ? `Paskutinis: ${escapeHtml(formatAssessmentDate(latest))}` : 'Vertinimų nėra'}</div>
        <span class="risk-pill">${risk.label}</span>
        <div class="bed-actions">
          <button type="button" class="open-bed-btn">Atidaryti</button>
          <button type="button" class="new-patient-btn">Naujas pacientas</button>
        </div>
      `;
      card.querySelector('.open-bed-btn').addEventListener('click', () => renderPatientCard(key));
      card.querySelector('.new-patient-btn').addEventListener('click', () => handleNewPatient(room, bed));
      grid.appendChild(card);
    });
  });
}


function handleNewPatient(room, bed) {
  const confirmed = window.confirm(`Ar norite užbaigti dabartinio paciento istoriją?\nPalata ${room}, lova ${bed}.\n\nAktyvūs vertinimai bus perkelti į neaktyvių istorijų archyvą.`);
  if (!confirmed) return;

  setLoading(`Užbaigiama palatos ${room}, lovos ${bed} paciento istorija…`);
  clearBedAssessments(room, bed)
    .then(result => {
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'Nepavyko ištrinti duomenų.');
      if (nurseState.selectedKey === bedKey(room, bed)) {
        nurseState.selectedKey = null;
        document.getElementById('patientPanel').innerHTML = '<div class="empty-state"><h2>Pasirinkite palatą ir lovą</h2><p>Paciento istorija užbaigta ir perkelta į neaktyvių istorijų archyvą.</p></div>';
      }
      return loadNurseData();
    })
    .catch(() => {
      setLoading('Nepavyko užbaigti paciento istorijos. Patikrinkite Apps Script deployment teises.');
    });
}

function renderPatientCard(key) {
  nurseState.selectedKey = key;
  const panel = document.getElementById('patientPanel');
  const records = nurseState.grouped.get(key) || [];
  renderRoomsGrid();

  if (!records.length) {
    const [room, bed] = key.split('__');
    panel.innerHTML = `<div class="empty-state"><h2>Palata ${escapeHtml(room)} · Lova ${escapeHtml(bed)}</h2><p>Šiai lovai vertinimų nėra.</p></div>`;
    return;
  }

  const latest = records[0];
  const risk = calculateRisk(latest);
  panel.innerHTML = `
    <article class="patient-card risk-${risk.level}">
      <div class="card-header">
        <div>
          <h2>Palata ${escapeHtml(latest.palata)} · Lova ${escapeHtml(latest.lova)}</h2>
          <p class="meta">Paskutinis vertinimas: ${escapeHtml(formatAssessmentDate(latest))}</p>
        </div>
        <span class="risk-pill">${risk.label}</span>
      </div>
      ${renderScaleSummary(latest, { historyRecords: records })}
      ${renderProblems('Esamos slaugos problemos', latest.parsed.esamos)}
      ${renderProblems('Galimos problemos / rizikos', latest.parsed.galimos)}
      <div class="section">
        <h3>Vertinimų istorija</h3>
        <div class="history-list">
          ${records.map(record => `<button type="button" class="history-item" data-record-id="${escapeHtml(record.id)}"><span class="history-date">${escapeHtml(formatAssessmentDate(record))}</span><span class="history-risk">${escapeHtml(calculateRisk(record).label)}</span></button>`).join('')}
        </div>
      </div>
    </article>
  `;

  panel.querySelectorAll('[data-record-id]').forEach(button => {
    button.addEventListener('click', () => openPlanModal(records.find(record => record.id === button.dataset.recordId)));
  });
}

function renderScaleSummary(record, options = {}) {
  const p = record.parsed;
  const usesPatientHistory = Array.isArray(options.historyRecords);
  const historyRecords = options.historyRecords || [record];
  const rows = [
    ['NEWS2', 'news', interpretNews2],
    ['Braden', 'braden', interpretBraden],
    ['MUST', 'must', interpretMust],
    ['Morse', 'morse', interpretMorse],
    ['Skausmas / NRS', 'pain', interpretPain]
  ].map(([label, key, interpret]) => {
    const assessment = historyRecords.find(item => item.parsed && item.parsed[key] != null) || null;
    const value = assessment ? assessment.parsed[key] : null;
    return { label, value, interpretation: value == null ? '' : interpret(value), assessment };
  }).filter(row => !options.hideUnassessed || row.value != null);

  const contextLines = [
    p.vitals && !usesPatientHistory ? `<p><strong>Rodikliai:</strong> ${escapeHtml(p.vitals)}</p>` : '',
    p.psychological ? `<p><strong>Būsena:</strong> ${escapeHtml(p.psychological)}</p>` : '',
    p.restraint ? `<p><strong>Fiksacija:</strong> ${escapeHtml(p.restraint)}</p>` : ''
  ].filter(Boolean).join('');

  if (!rows.length && !contextLines) return '';

  if (options.compact) {
    const scaleLines = rows.map(row =>
      `<p>${formatScaleLine(row.label, row.value, row.interpretation, row.assessment)}</p>`
    ).join('');
    return `<div class="section scale-summary compact-scale-summary"><h3>Skalės ir rodikliai</h3><div class="compact-scale-list">${contextLines}${scaleLines}</div></div>`;
  }

  const vitalsHistory = usesPatientHistory ? renderVitalsHistory(historyRecords) : '';
  return `<div class="section scale-summary"><h3>Skalės ir rodikliai</h3><div class="scale-context">${contextLines}</div><div class="scale-grid">${rows.map(row => `
    <div class="scale-item${row.value == null ? ' scale-unassessed' : ''}"><strong>${row.label}</strong><br><span class="scale-value">${row.value == null ? '—' : escapeHtml(row.value)}</span>${renderScaleAssessmentDetails(row, usesPatientHistory)}</div>
  `).join('')}</div>${vitalsHistory}</div>`;
}

function renderVitalsHistory(records) {
  const measurements = records
    .filter(record => record.parsed && record.parsed.vitals)
    .slice(0, 5);

  const content = measurements.length
    ? measurements.map(record => `<div class="vitals-history-item"><time>${escapeHtml(formatAssessmentDate(record))}</time><span>${escapeHtml(record.parsed.vitals)}</span></div>`).join('')
    : '<p class="meta">Šiam pacientui gyvybiniai rodikliai dar neįvesti.</p>';

  return `<div class="vitals-history"><h4>Paskutiniai gyvybiniai rodikliai</h4>${content}</div>`;
}

function renderScaleAssessmentDetails(row, usesPatientHistory) {
  if (row.value == null || !row.assessment) {
    const message = usesPatientHistory ? 'Šiam pacientui dar neįvertinta.' : 'Šiame vertinime neįvertinta.';
    return `<div class="scale-last-assessed scale-never-assessed">${message}</div>`;
  }

  return `<div class="scale-note"><strong>Vertinimas:</strong> ${escapeHtml(row.interpretation)}</div>
    <div class="scale-last-assessed"><strong>Paskutinis vertinimas:</strong> ${escapeHtml(formatScaleScore(row.label, row.value))} · ${escapeHtml(formatAssessmentDate(row.assessment))}</div>`;
}

function formatScaleLine(label, value, interpretation, assessment) {
  const safeLabel = label === 'Skausmas / NRS' ? 'Skausmas' : label;
  const scoreText = formatScaleScore(label, value);
  const assessedAt = assessment ? ` · ${formatAssessmentDate(assessment)}` : '';
  return `<strong>${escapeHtml(safeLabel)}:</strong> ${escapeHtml(scoreText)} — ${escapeHtml(interpretation)}${escapeHtml(assessedAt)}`;
}

function formatScaleScore(label, value) {
  return label === 'Skausmas / NRS' ? `${value}/10` : `${value} bal.`;
}

function formatAssessmentDate(record) {
  const date = getRecordDate(record);
  if (date.getTime() > 0) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return record.time || record.uploadedAt || 'data nenurodyta';
}



function normalizePlanLine(line) {
  return String(line || '')
    .replace(/^\s*•\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/g, '')
    .trim()
    .toLowerCase();
}

function dedupePlanLines(plan) {
  const seen = new Set();
  return plan
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      const normalized = normalizePlanLine(line);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join('\n');
}

function interpretNews2(value) {
  if (value == null) return 'NEWS2 neapskaičiuotas arba nėra duomenų.';
  if (value >= 7) return 'Aukšta klinikinė rizika.';
  if (value >= 5) return 'Vidutinė klinikinė rizika.';
  if (value >= 1) return 'Žema klinikinė rizika / reikia stebėti dinamiką.';
  return 'Stabili būklė pagal NEWS2.';
}

function interpretBraden(value) {
  if (value == null) return 'Braden neįvertinta.';
  if (value <= 12) return 'Didelė pragulų rizika.';
  if (value <= 14) return 'Vidutinė pragulų rizika.';
  if (value <= 18) return 'Padidėjusi pragulų rizika.';
  return 'Maža pragulų rizika.';
}

function interpretMust(value) {
  if (value == null) return 'MUST neįvertinta.';
  if (value >= 2) return 'Didelė mitybos nepakankamumo rizika.';
  if (value === 1) return 'Vidutinė mitybos nepakankamumo rizika.';
  return 'Maža mitybos nepakankamumo rizika.';
}

function interpretMorse(value) {
  if (value == null) return 'Morse neįvertinta.';
  if (value >= 45) return 'Didelė griuvimų rizika.';
  if (value >= 25) return 'Vidutinė griuvimų rizika.';
  return 'Maža griuvimų rizika.';
}

function interpretPain(value) {
  if (value == null) return 'Skausmo balas nenurodytas.';
  if (value >= 7) return 'Didelis skausmas.';
  if (value >= 4) return 'Vidutinis skausmas.';
  if (value >= 1) return 'Nedidelis skausmas.';
  return 'Skausmo nėra.';
}

function renderProblems(title, problems) {
  const items = problems.length ? problems.map(problem => `<li>${escapeHtml(problem)}</li>`).join('') : '<li>Nėra duomenų</li>';
  return `<div class="section"><h3>${title}</h3><ul class="clean">${items}</ul></div>`;
}

function calculateRisk(record) {
  const p = record.parsed;
  let score = 0;

  if (p.news >= 7) score = Math.max(score, 3);
  else if (p.news >= 5) score = Math.max(score, 2);
  else if (p.news >= 1) score = Math.max(score, 1);

  if (p.braden != null && p.braden <= 12) score = Math.max(score, 3);
  else if (p.braden != null && p.braden <= 14) score = Math.max(score, 2);

  if (p.must != null && p.must >= 2) score = Math.max(score, 2);
  if (p.morse != null && p.morse >= 45) score = Math.max(score, 3);
  else if (p.morse != null && p.morse >= 25) score = Math.max(score, 2);

  if (p.pain != null && p.pain >= 7) score = Math.max(score, 3);
  else if (p.pain != null && p.pain >= 4) score = Math.max(score, 2);

  if (p.hasFixation) score = Math.max(score, 2);
  if (/didelė|infekcijos rizika|dehidratacijos rizika|griuvimų rizika/i.test(record.text)) score = Math.max(score, 2);

  if (score >= 3) return { level: 'red', label: 'Aukšta rizika' };
  if (score >= 2) return { level: 'yellow', label: 'Vidutinė rizika' };
  return { level: 'green', label: 'Žema rizika' };
}


function renderEditableList(title, id, items) {
  const value = items.length ? items.map(item => `• ${item}`).join('\n') : '-';
  return `<div class="section"><h3>${title}</h3><div id="${id}" class="editable-list" data-editable-block tabindex="0">${escapeHtml(value)}</div></div>`;
}

function parseEditableList(text) {
  return text
    .split('\n')
    .map(line => line.replace(/^•\s*/, '').trim())
    .filter(line => line && line !== '-');
}

function openPlanModal(record) {
  if (!record) return;
  nurseState.activeRecord = record;
  nurseState.printPreview = false;
  nurseState.hasUnsavedChanges = false;
  nurseState.savedEditState = getRecordEditState(record);
  renderPlanModalBody(record, { hideUnassessedScales: false, isPreview: false });
  resetModalActions();
  document.getElementById('planModal').setAttribute('aria-hidden', 'false');
}

function renderPlanModalBody(record, options = {}) {
  const risk = calculateRisk(record);
  const plan = record.editedPlan || record.parsed.plan || '-';
  document.getElementById('modalTitle').textContent = options.isPreview
    ? `Spausdinimo peržiūra · Palata ${record.palata} · Lova ${record.lova}`
    : `Palata ${record.palata} · Lova ${record.lova}`;
  document.getElementById('modalBody').innerHTML = `
    <div id="printArea" class="${options.isPreview ? 'print-preview-content' : ''}">
      ${options.isPreview ? '<p class="preview-note">Spausdinimo peržiūra: nevertinti testai šiame lape nerodomi.</p>' : ''}
      <div class="handwrite-line"><strong>Pacientas:</strong><span></span></div>
      <p><strong>Vertinimo laikas:</strong> ${escapeHtml(record.time || record.uploadedAt || '-')}</p>
      <p><strong>Rizika:</strong> <span class="risk-pill risk-${risk.level}">${risk.label}</span></p>
      ${renderScaleSummary(record, { hideUnassessed: options.hideUnassessedScales, compact: options.isPreview })}
      ${renderEditableList('Esamos slaugos problemos', 'currentProblemsText', record.parsed.esamos)}
      ${renderEditableList('Galimos problemos / rizikos', 'possibleProblemsText', record.parsed.galimos)}
      <div class="section"><h3>Slaugos planas</h3><div id="planText" class="plan-text">${escapeHtml(plan)}</div></div>
      <div class="handwrite-line nurse-signature"><strong>Bendrosios praktikos slaugytojas:</strong><span></span></div>
    </div>
  `;
}

function resetModalActions() {
  document.getElementById('printPlanBtn').textContent = 'Spausdinti';
  document.getElementById('editPlanBtn').textContent = nurseState.printPreview ? 'Taisyti' : 'Taisyti planą ir problemas';
  document.getElementById('editPlanBtn').hidden = false;
  document.getElementById('savePlanBtn').hidden = true;
}

function closePlanModal() {
  captureCurrentEdits();
  if (nurseState.hasUnsavedChanges) {
    showUnsavedChangesPrompt();
    return;
  }
  finalizeClosePlanModal();
}

function finalizeClosePlanModal() {
  document.getElementById('planModal').setAttribute('aria-hidden', 'true');
  nurseState.activeRecord = null;
  nurseState.printPreview = false;
  nurseState.hasUnsavedChanges = false;
  nurseState.savedEditState = null;
}

function handleEditPlanClick() {
  if (nurseState.printPreview && nurseState.activeRecord) {
    nurseState.printPreview = false;
    renderPlanModalBody(nurseState.activeRecord, { hideUnassessedScales: false, isPreview: false });
    resetModalActions();
  }
  enablePlanEdit();
}

function enablePlanEdit() {
  const plan = document.getElementById('planText');
  if (!plan) return;

  plan.setAttribute('contenteditable', 'true');
  replaceProblemBlockWithTextarea('currentProblemsText');
  replaceProblemBlockWithTextarea('possibleProblemsText');

  document.getElementById('currentProblemsTextEdit')?.focus();
  document.getElementById('editPlanBtn').hidden = true;
  document.getElementById('savePlanBtn').hidden = false;
}

function replaceProblemBlockWithTextarea(id) {
  const block = document.getElementById(id);
  if (!block || document.getElementById(`${id}Edit`)) return;

  const textarea = document.createElement('textarea');
  textarea.id = `${id}Edit`;
  textarea.className = 'editable-textarea';
  textarea.value = block.textContent.trim();
  textarea.placeholder = 'Kiekvieną problemą ar riziką rašykite naujoje eilutėje.';
  textarea.spellcheck = true;
  textarea.setAttribute('aria-label', id === 'currentProblemsText' ? 'Esamos slaugos problemos' : 'Galimos problemos ir rizikos');
  block.replaceWith(textarea);
}

async function savePlanEdit() {
  captureCurrentEdits();
  if (!nurseState.activeRecord) return;

  if (nurseState.hasUnsavedChanges) {
    const saved = await persistActiveRecordEdits();
    if (!saved) return;
  }

  finishPlanEditMode();
}

function captureCurrentEdits() {
  const plan = document.getElementById('planText');
  if (!plan || !nurseState.activeRecord) return;

  const currentEditor = document.getElementById('currentProblemsTextEdit');
  const possibleEditor = document.getElementById('possibleProblemsTextEdit');
  if (!currentEditor || !possibleEditor) return;

  nurseState.activeRecord.editedPlan = plan.textContent.trim();
  nurseState.activeRecord.parsed.plan = nurseState.activeRecord.editedPlan;
  nurseState.activeRecord.parsed.esamos = parseEditableList(currentEditor.value);
  nurseState.activeRecord.parsed.galimos = parseEditableList(possibleEditor.value);
  nurseState.hasUnsavedChanges = editStateSignature(getRecordEditState(nurseState.activeRecord)) !== editStateSignature(nurseState.savedEditState);
}

function finishPlanEditMode() {
  const plan = document.getElementById('planText');
  if (!plan || !nurseState.activeRecord) return;

  if (nurseState.selectedKey) renderPatientCard(nurseState.selectedKey);

  plan.setAttribute('contenteditable', 'false');
  replaceTextareaWithProblemBlock('currentProblemsText', nurseState.activeRecord.parsed.esamos);
  replaceTextareaWithProblemBlock('possibleProblemsText', nurseState.activeRecord.parsed.galimos);

  document.getElementById('editPlanBtn').hidden = false;
  document.getElementById('savePlanBtn').hidden = true;
}

function getRecordEditState(record) {
  return {
    esamos: [...(record.parsed.esamos || [])],
    galimos: [...(record.parsed.galimos || [])],
    planas: String(record.editedPlan || record.parsed.plan || '').trim()
  };
}

function editStateSignature(state) {
  return JSON.stringify(state || { esamos: [], galimos: [], planas: '' });
}

async function persistActiveRecordEdits() {
  const record = nurseState.activeRecord;
  if (!record || !record.assessmentId || !record.episodeId) {
    alert('Nepavyko nustatyti vertinimo arba epizodo ID. Atnaujinkite slaugytojos puslapį ir bandykite dar kartą.');
    return false;
  }

  const editState = getRecordEditState(record);
  const saveButton = document.getElementById('savePlanBtn');
  saveButton.disabled = true;
  saveButton.textContent = 'Saugoma…';

  try {
    const url = await getNurseGoogleScriptUrl();
    await postNursePayload(url, {
      action: 'updateAssessment',
      assessmentId: record.assessmentId,
      episodeId: record.episodeId,
      palata: record.palata,
      lova: record.lova,
      edited: editState
    });
    const records = await fetchAssessments();
    const savedRecord = records.find(item => String(item.assessmentId || item.raw?.assessmentId || '').trim() === record.assessmentId);
    const savedEdit = savedRecord ? normalizeStoredEdit(savedRecord.edited) : null;
    if (!savedEdit || editStateSignature(savedEdit) !== editStateSignature(editState)) {
      throw new Error('Saved edit could not be verified.');
    }
    nurseState.savedEditState = editState;
    nurseState.hasUnsavedChanges = false;
    record.editedPlan = editState.planas;
    return true;
  } catch (error) {
    alert('Nepavyko išsaugoti pakeitimų Google Sheets. Patikrinkite interneto ryšį ir Apps Script deployment.');
    return false;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Išsaugoti pakeitimus';
  }
}

function postNursePayload(url, payload) {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) });
  return fetch(url, { method: 'POST', body, mode: 'no-cors', keepalive: true });
}

function replaceTextareaWithProblemBlock(id, items) {
  const textarea = document.getElementById(`${id}Edit`);
  if (!textarea) return;

  const value = items.length ? items.map(item => `• ${item}`).join('\n') : '-';
  const block = document.createElement('div');
  block.id = id;
  block.className = 'editable-list';
  block.dataset.editableBlock = '';
  block.tabIndex = 0;
  block.textContent = value;
  textarea.replaceWith(block);
}

function printCurrentPlan() {
  if (!nurseState.activeRecord) return;

  if (!nurseState.printPreview) {
    captureCurrentEdits();
    nurseState.printPreview = true;
    renderPlanModalBody(nurseState.activeRecord, { hideUnassessedScales: true, isPreview: true });
    resetModalActions();
    return;
  }

  document.body.classList.add('print-modal');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('print-modal');
    if (nurseState.hasUnsavedChanges) showUnsavedChangesPrompt();
  }, 250);
}

function showUnsavedChangesPrompt() {
  document.getElementById('unsavedChangesModal').setAttribute('aria-hidden', 'false');
}

function hideUnsavedChangesPrompt() {
  document.getElementById('unsavedChangesModal').setAttribute('aria-hidden', 'true');
}

async function savePromptedChanges() {
  const saved = await persistActiveRecordEdits();
  if (!saved) return;
  hideUnsavedChangesPrompt();
  finalizeClosePlanModal();
}

function discardPromptedChanges() {
  restoreSavedEditState();
  hideUnsavedChangesPrompt();
  finalizeClosePlanModal();
}

function continueEditingFromPrompt() {
  hideUnsavedChangesPrompt();
  if (nurseState.printPreview && nurseState.activeRecord) {
    nurseState.printPreview = false;
    renderPlanModalBody(nurseState.activeRecord, { hideUnassessedScales: false, isPreview: false });
    resetModalActions();
  }
  enablePlanEdit();
}

function restoreSavedEditState() {
  if (!nurseState.activeRecord || !nurseState.savedEditState) return;
  nurseState.activeRecord.parsed.esamos = [...nurseState.savedEditState.esamos];
  nurseState.activeRecord.parsed.galimos = [...nurseState.savedEditState.galimos];
  nurseState.activeRecord.parsed.plan = nurseState.savedEditState.planas;
  nurseState.activeRecord.editedPlan = nurseState.savedEditState.planas;
  nurseState.hasUnsavedChanges = false;
}

function setLoading(message) {
  document.getElementById('loading').textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
