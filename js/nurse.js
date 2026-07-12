/* nurse.js – slaugytojos posto anoniminis palatų / lovų vaizdas */

const NURSE_GOOGLE_SCRIPT_URL_FALLBACK = 'https://script.google.com/macros/s/AKfycbxODAbmdrmccCYCUkswsFgnz-nrC8clEQQf-5kId3y-3TCqUwsU4pyCze2Jojv43VV_1A/exec';
let resolvedNurseGoogleScriptUrl = null;
const ROOMS = ['1', '2', '3', '4', '5'];
const BEDS = ['1', '2', '3', '4'];

let nurseState = {
  records: [],
  grouped: new Map(),
  selectedKey: null,
  activeRecord: null,
  printPreview: false
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadNurseData);
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closePlanModal));
  document.getElementById('printPlanBtn').addEventListener('click', printCurrentPlan);
  document.getElementById('editPlanBtn').addEventListener('click', handleEditPlanClick);
  document.getElementById('savePlanBtn').addEventListener('click', savePlanEdit);
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
  return getNurseGoogleScriptUrl().then(url => jsonp(`${url}?action=list`));
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
      else resolve(data.records || []);
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
      return {
        id: `${record.uploadedAt || record.Laikas || index}_${index}`,
        uploadedAt: record.uploadedAt || '',
        time: record.Laikas || raw.Laikas || record.laikas || '',
        palata: String(record.palata || raw.palata || '').trim(),
        lova: String(record.lova || raw.lova || '').trim(),
        text,
        parsed,
        editedPlan: null
      };
    })
    .filter(record => record.palata && record.lova)
    .sort((a, b) => getRecordDate(b) - getRecordDate(a));
}

function parseAssessmentText(text) {
  return {
    news: parseNumber(/NEWS2:\s*(\d+)\s*bal\./i, text),
    braden: parseNumber(/Braden:\s*(\d+)\s*bal\./i, text),
    must: parseNumber(/MUST:\s*(\d+)\s*bal\./i, text),
    morse: parseNumber(/Morse:\s*(\d+)\s*bal\./i, text),
    pain: parseNumber(/Skausmas\s*(\d+)\s*\/\s*10/i, text),
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
  records.forEach(record => {
    const key = bedKey(record.palata, record.lova);
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
        <div class="time">${latest ? `Paskutinis: ${escapeHtml(latest.time || latest.uploadedAt || '-')}` : 'Vertinimų nėra'}</div>
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
  const confirmed = window.confirm(`Ar norite ištrinti visus paciento vertinimus?\nPalata ${room}, lova ${bed}.`);
  if (!confirmed) return;

  setLoading(`Trinami palatos ${room}, lovos ${bed} vertinimai…`);
  clearBedAssessments(room, bed)
    .then(result => {
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'Nepavyko ištrinti duomenų.');
      if (nurseState.selectedKey === bedKey(room, bed)) {
        nurseState.selectedKey = null;
        document.getElementById('patientPanel').innerHTML = '<div class="empty-state"><h2>Pasirinkite palatą ir lovą</h2><p>Paciento duomenys ištrinti. Pasirinkite kitą lovą arba atnaujinkite sąrašą.</p></div>';
      }
      return loadNurseData();
    })
    .catch(() => {
      setLoading('Nepavyko ištrinti lovos duomenų. Patikrinkite Apps Script deployment teises.');
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
          <p class="meta">Paskutinis vertinimas: ${escapeHtml(latest.time || latest.uploadedAt || '-')}</p>
        </div>
        <span class="risk-pill">${risk.label}</span>
      </div>
      ${renderScaleSummary(latest)}
      ${renderProblems('Esamos slaugos problemos', latest.parsed.esamos)}
      ${renderProblems('Galimos problemos / rizikos', latest.parsed.galimos)}
      <div class="section">
        <h3>Vertinimų istorija</h3>
        <div class="history-list">
          ${records.map(record => `<button type="button" class="history-item" data-record-id="${escapeHtml(record.id)}">${escapeHtml(record.time || record.uploadedAt || '-')} · ${calculateRisk(record).label}</button>`).join('')}
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
  const rows = [
    ['NEWS2', p.news, interpretNews2(p.news)],
    ['Braden', p.braden, interpretBraden(p.braden)],
    ['MUST', p.must, interpretMust(p.must)],
    ['Morse', p.morse, interpretMorse(p.morse)],
    ['Skausmas / NRS', p.pain, interpretPain(p.pain)]
  ].filter(([, value]) => !options.hideUnassessed || value != null);

  if (!rows.length) return '';

  return `<div class="section scale-summary"><h3>Skalės ir rodikliai</h3><div class="scale-grid">${rows.map(([label, value, interpretation]) => `
    <div class="scale-item${value == null ? ' scale-unassessed' : ''}"><strong>${label}</strong><br><span class="scale-value">${value == null ? '—' : escapeHtml(value)}</span><div class="scale-note"><strong>Vertinimas:</strong> ${escapeHtml(interpretation)}</div></div>
  `).join('')}</div></div>`;
}


function dedupePlanLines(plan) {
  const seen = new Set();
  return plan
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      const normalized = line.replace(/^•\s*/, '').trim().toLowerCase();
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
    <div id="printArea">
      ${options.isPreview ? '<p class="preview-note">Spausdinimo peržiūra: nevertinti testai šiame lape nerodomi.</p>' : ''}
      <div class="handwrite-line"><strong>Pacientas:</strong><span></span></div>
      <p><strong>Vertinimo laikas:</strong> ${escapeHtml(record.time || record.uploadedAt || '-')}</p>
      <p><strong>Rizika:</strong> <span class="risk-pill risk-${risk.level}">${risk.label}</span></p>
      ${renderScaleSummary(record, { hideUnassessed: options.hideUnassessedScales })}
      ${renderEditableList('Esamos slaugos problemos', 'currentProblemsText', record.parsed.esamos)}
      ${renderEditableList('Galimos problemos / rizikos', 'possibleProblemsText', record.parsed.galimos)}
      <div class="section"><h3>Pilnas sugeneruotas slaugos planas</h3><div id="planText" class="plan-text">${escapeHtml(plan)}</div></div>
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
  document.getElementById('planModal').setAttribute('aria-hidden', 'true');
  nurseState.activeRecord = null;
  nurseState.printPreview = false;
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

function savePlanEdit() {
  const plan = document.getElementById('planText');
  if (!plan || !nurseState.activeRecord) return;

  const currentText = document.getElementById('currentProblemsTextEdit')?.value || '';
  const possibleText = document.getElementById('possibleProblemsTextEdit')?.value || '';

  nurseState.activeRecord.editedPlan = plan.textContent.trim();
  nurseState.activeRecord.parsed.plan = nurseState.activeRecord.editedPlan;
  nurseState.activeRecord.parsed.esamos = parseEditableList(currentText);
  nurseState.activeRecord.parsed.galimos = parseEditableList(possibleText);

  if (nurseState.selectedKey) renderPatientCard(nurseState.selectedKey);

  plan.setAttribute('contenteditable', 'false');
  replaceTextareaWithProblemBlock('currentProblemsText', nurseState.activeRecord.parsed.esamos);
  replaceTextareaWithProblemBlock('possibleProblemsText', nurseState.activeRecord.parsed.galimos);

  document.getElementById('editPlanBtn').hidden = false;
  document.getElementById('savePlanBtn').hidden = true;
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
    nurseState.printPreview = true;
    renderPlanModalBody(nurseState.activeRecord, { hideUnassessedScales: true, isPreview: true });
    resetModalActions();
    return;
  }

  document.body.classList.add('print-modal');
  window.print();
  setTimeout(() => document.body.classList.remove('print-modal'), 250);
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
