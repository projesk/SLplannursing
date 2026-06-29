/* generator.js – rezultatų generavimas ir atvaizdavimas */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxODAbmdrmccCYCUkswsFgnz-nrC8clEQQf-5kId3y-3TCqUwsU4pyCze2Jojv43VV_1A/exec';

let lastPayload = null;

function valOrDash(v) { return (v == null || v === '') ? '-' : v; }
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Pagrindinis generatorius ──────────────────────────────────────
function generateResults() {
  hideSubmissionStatus();
  document.getElementById('results').innerHTML = '';

  const f = document.forms['nursingForm'];
  const ctx = detectProblems(f);
  if (ctx.error) return;

  renderOutput(f, ctx);
}

function hideSubmissionStatus() {
  document.getElementById('statusOk').style.display = 'none';
  document.getElementById('statusErr').style.display = 'none';
}

// ── Atvaizdavimas ─────────────────────────────────────────────────
function renderOutput(f, ctx) {
  const data = collectRenderData(f, ctx);
  const html = buildResultsHtml(data);

  document.getElementById('results').innerHTML = html;
  buildPayload(f, data);
}

function collectRenderData(f, ctx) {
  const { esamos, galimos, vitals, highSys30, painBlock, addExtrasForHelpDueToDizziness } = ctx;
  const { spo2, temp, sys, dia, hr, map } = vitals;

  const news = calcNEWS2({
    rr: toNum(f['rr'].value),
    spo2,
    spo2Scale: f['spo2Scale'] ? f['spo2Scale'].value : '1',
    onO2: f['o2'].value === 'taip',
    temp,
    sys,
    hr,
    avpu: f['avpu'].value
  });

  const dietCode = (document.getElementById('dieta_kodas').value || '').trim();
  const dietCustom = dietCode === 'KITA' ? (document.getElementById('dieta_kita').value || '').trim() : '';
  const pv = collectPrimaryAssessment();

  return {
    vitals,
    news,
    esamosU: uniq(esamos),
    galimosU: uniq(galimos),
    highSys30,
    painBlock,
    addExtrasForHelpDueToDizziness,
    combineBedRestAndUlcers: f['mobilumas'].value === 'lova' && f['pragulos'].value === 'yra',
    psichoSakinys: buildPsychologicalSentence(),
    restraintSentence: buildRestraintSentence(),
    isRestrained: Boolean(document.getElementById('suvarzymas') && document.getElementById('suvarzymas').checked),
    dietCode,
    dietCustom,
    hasDiet: Boolean((dietCode && dietCode !== 'KITA' && dietCode !== '—') || (dietCode === 'KITA' && dietCustom)),
    scalesSummary: buildScalesSummary(),
    pvSelected: pv.selected,
    pvExtraItems: pv.extraItems,
    pvSummaryText: pv.summaryText,
    hasPV: pv.hasPV
  };
}

function buildPsychologicalSentence() {
  const parts = [
    document.getElementById('ramus').checked ? 'ramus' : 'neramus',
    document.getElementById('orientuotas').checked ? 'orientuotas' : 'neorientuotas'
  ];

  if (document.getElementById('demencija')?.checked) parts.push('demencija');
  if (document.getElementById('agresyvus')?.checked) parts.push('agresyvus');

  return `Pacientas ${parts.join(', ')}.`;
}

function buildRestraintSentence() {
  if (!document.getElementById('suvarzymas')?.checked) return '';

  const nowTime = new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
  return `Dėl galimos žalos sau pačiam ir aplinkiniams, neveikiant kitoms priemonėms pacientas fiksuotas (${nowTime}).`;
}

function buildScalesSummary() {
  const summary = [];
  if (typeof bradenScore === 'number' && bradenScore !== null) summary.push(`Braden: ${bradenScore} bal.`);
  if (typeof mustScore === 'number' && mustScore !== null) summary.push(`MUST: ${mustScore} bal.`);
  if (typeof morseScore === 'number' && morseScore !== null) summary.push(`Morse: ${morseScore} bal.`);
  return summary;
}

function collectPrimaryAssessment() {
  const planSets = {
    cv: ['AKS sekimas', 'Skysčių balanso stebėjimas', 'Edemų stebėjimas', 'Dusulio stebėjimas', 'Mitybos/dietos pritaikymas'],
    resp: ['SpO₂ stebėjimas'],
    endo: ['Glikemijos kontrolė', 'Mitybos/dietos pritaikymas'],
    rh: ['Skysčių balanso stebėjimas', 'Skysčių kiekio sekimas', 'AKS sekimas']
  };

  const selected = [];
  const extraItems = [];
  const addIfChecked = (id, label, items) => {
    if (!document.getElementById(id).checked) return;
    selected.push(label);
    extraItems.push(...items);
  };

  addIfChecked('pv_cv', 'Širdies–kraujotakos', planSets.cv);
  addIfChecked('pv_resp', 'Kvėpavimo', planSets.resp);
  addIfChecked('pv_endo_cd', 'Endokrininės (CD)', planSets.endo);
  addIfChecked('pv_renal_hep', 'Inkstų/kepenų', planSets.rh);

  const infection = (document.getElementById('pv_infection').value || '').trim();
  const allergy = (document.getElementById('pv_allergy').value || '').trim();
  const summaryParts = [];

  if (selected.length) summaryParts.push(`Sritys: ${selected.join(', ')}`);
  if (infection) summaryParts.push(`Infekcinės ligos: ${infection}`);
  if (allergy) summaryParts.push(`Alergijos: ${allergy}`);

  return {
    selected,
    extraItems,
    summaryText: summaryParts.join(' | '),
    hasPV: summaryParts.length > 0
  };
}

function buildResultsHtml(data) {
  return [
    buildVitalsHtml(data),
    buildPsychologicalHtml(data),
    buildProblemsHtml('Esamos problemos', data.esamosU),
    buildProblemsHtml('Galimos problemos', data.galimosU),
    buildCarePlanHtml(data),
    buildPrimaryAssessmentHtml(data),
    buildDietHintHtml(data)
  ].join('');
}

function buildVitalsHtml(data) {
  const { spo2, temp, sys, dia, hr, map } = data.vitals;
  const vitalsRows = [];
  const aksStr = sys != null && dia != null ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}` : null;

  if (spo2 != null) vitalsRows.push(`SpO₂ ${spo2} %`);
  if (aksStr) vitalsRows.push(`AKS ${aksStr}`);
  if (hr != null) vitalsRows.push(`ŠSD ${hr}/min`);
  if (temp != null) vitalsRows.push(`T ${Number(temp).toFixed(1)} °C`);

  let html = '';
  if (vitalsRows.length) html += `<p>${vitalsRows.join(' &nbsp;|&nbsp; ')}</p>`;
  html += `<p><strong>NEWS2:</strong> ${formatNewsScore(data.news)} &mdash; ${esc(news2Text(data.news.score, data.news.hasRedScore, data.news.isComplete, data.news.missingFields))}</p>`;

  if (data.scalesSummary.length) {
    html += `<p>${data.scalesSummary.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</p>`;
  }

  return `<h3>Gyvybiniai rodikliai</h3><div class="planas">${html}</div>`;
}

function formatNewsScore(news) {
  return news.isComplete ? `${news.score} bal.` : 'neapskaičiuotas';
}

function buildPsychologicalHtml(data) {
  let html = `<p>${esc(data.psichoSakinys)}</p>`;
  if (data.restraintSentence) html += `<p>${esc(data.restraintSentence)}</p>`;
  return `<h3>Psichologinė būsena</h3><div class="planas">${html}</div>`;
}

function buildProblemsHtml(title, problems) {
  const items = problems.length ? problems.map(p => `<li>${esc(p)}</li>`).join('') : '<li>Nenustatyta</li>';
  return `<h3>${title}</h3><div class="planas"><ul>${items}</ul></div>`;
}

function buildCarePlanHtml(data) {
  let html = '<h3>Slaugos planas</h3>';
  let blocks = 0;

  const addBlock = (title, items) => {
    if (!items.length) return;
    html += `<div class="planas"><h4>${esc(title)}</h4><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
    blocks++;
  };

  if (data.combineBedRestAndUlcers) {
    addBlock('Gulimas režimas ir pragulos', getProblemInterventions('Gulimas režimas ir pragulos'));
  }

  [...data.esamosU, ...data.galimosU].forEach(problem => {
    const items = getPlanItemsForProblem(problem, data);
    addBlock(problem, items);
  });

  if (data.painBlock) addBlock(`Skausmas (${data.painBlock.score}/10)`, getProblemInterventions(data.painBlock.key));

  const dietItems = data.dietCode && data.dietCode !== 'KITA' && data.dietCode !== '—' ? getDietPlan(data.dietCode) : [];
  addBlock(`Dieta ${data.dietCode}`, dietItems);

  if (data.isRestrained) addBlock('Fizinis suvaržymas', getProblemInterventions('Taikoma fizinė fiksacija'));

  if (blocks === 0) html += '<div class="planas"><p>Intervencijų nenustatyta</p></div>';
  return html;
}

function getPlanItemsForProblem(problem, data) {
  if (data.combineBedRestAndUlcers && (problem === 'Pragulos' || problem === 'Rizika praguloms dėl lovos režimo')) return [];
  if (data.addExtrasForHelpDueToDizziness && problem === 'Rizika griuvimui dėl galvos svaigimo') return [];
  if (problem === 'Taikoma fizinė fiksacija') return [];

  const items = [...getProblemInterventions(problem)];
  if (!items.length) return [];

  if (problem.startsWith('Padidėjęs kraujo spaudimas') && data.highSys30) items.push('AKS sekimas kas 30 min.');
  if (data.addExtrasForHelpDueToDizziness && problem === 'Judėjimas su pagalba') {
    items.push('AKS sekimas', 'Griuvimų profilaktika');
  }

  return items;
}

function buildPrimaryAssessmentHtml(data) {
  if (!data.hasPV && !data.pvExtraItems.length) return '';

  let html = '';
  if (data.pvSummaryText) html += `<p>${esc(data.pvSummaryText)}</p>`;
  if (data.pvExtraItems.length) {
    html += `<ul>${uniq(data.pvExtraItems).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  return `<h3>Pirminis vertinimas</h3><div class="planas">${html}</div>`;
}

function buildDietHintHtml(data) {
  if (!data.hasDiet) return '';
  const dietaUi = data.dietCode === 'KITA' ? data.dietCustom : data.dietCode;
  return `<p class="hint">Pacientui skirta <strong>${esc(dietaUi)}</strong> dieta</p>`;
}

// ── Payload (tekstinis įrašas) ─────────────────────────────────────
function buildPayload(f, data) {
  const planItems = collectPlanItems(data);
  const vitalsLine = formatVitalsLine(data.vitals);

  let irasas =
    `Gyvybiniai rodikliai:\n${vitalsLine}\n` +
    `NEWS2: ${formatNewsScore(data.news)} – ${news2Text(data.news.score, data.news.hasRedScore, data.news.isComplete, data.news.missingFields)}\n`;

  if (data.scalesSummary.length) irasas += `Vertinimo skalės: ${data.scalesSummary.join(', ')}\n`;

  irasas += `\n${data.psichoSakinys}\n`;
  if (data.restraintSentence) irasas += `${data.restraintSentence}\n`;

  irasas +=
    `\nEsamos problemos:\n${data.esamosU.length ? data.esamosU.join('; ') : '-'}\n\n` +
    `Galimos problemos:\n${data.galimosU.length ? data.galimosU.join('; ') : '-'}\n\n` +
    `Slaugos planas:\n${planItems.length ? planItems.map(i => '• ' + i).join('\n') : '-'}`;

  if (data.hasDiet) irasas += `\n\nPacientui skirta ${data.dietCode === 'KITA' ? data.dietCustom : data.dietCode} dieta`;
  if (data.pvSummaryText) irasas += `\n\nPirminis vertinimas:\n${data.pvSummaryText}`;

  lastPayload = {
    Laikas: new Date().toLocaleString('lt-LT'),
    palata: (f['palata'].value || '').trim(),
    lova: (f['lova'].value || '').trim(),
    įrašas: irasas
  };

  document.getElementById('results').insertAdjacentHTML('beforeend', `<div class="mono">${esc(JSON.stringify(lastPayload, null, 2))}</div>`);
}

function collectPlanItems(data) {
  const seen = new Set();
  const planItems = [];

  const addItems = items => {
    items.forEach(item => {
      if (seen.has(item)) return;
      seen.add(item);
      planItems.push(item);
    });
  };

  if (data.combineBedRestAndUlcers) addItems(getProblemInterventions('Gulimas režimas ir pragulos'));

  [...data.esamosU, ...data.galimosU].forEach(problem => addItems(getPlanItemsForProblem(problem, data)));

  if (data.painBlock) addItems(getProblemInterventions(data.painBlock.key));
  if (data.dietCode && data.dietCode !== 'KITA' && data.dietCode !== '—') addItems(getDietPlan(data.dietCode));
  if (data.isRestrained) addItems(getProblemInterventions('Taikoma fizinė fiksacija'));
  if (data.pvExtraItems.length) addItems(uniq(data.pvExtraItems));

  return planItems;
}

function formatVitalsLine(vitals) {
  const { spo2, sys, dia, map, hr, temp } = vitals;
  const aksStr = sys != null && dia != null ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}` : null;

  return [
    spo2 != null ? `SpO₂ ${spo2} %` : null,
    aksStr ? `AKS ${aksStr}` : null,
    hr != null ? `ŠSD ${hr}/min` : null,
    temp != null ? `T ${Number(temp).toFixed(1)} °C` : null
  ].filter(Boolean).join(', ') || '-';
}

// ── Siuntimas per Google Form (neblokuojama ad-blocker) ───────────
const GFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScGnmK642MU0iv_jd6lMGUe62uF_q9F3CWwXVMis49nu6oqqg/formResponse';
const GFORM_ENTRIES = {
  Laikas: 'entry.289012486',
  palata:  'entry.438253715',
  lova:    'entry.326926890',
  irasas:  'entry.1648745400'
};

function keltiISistema() {
  if (!lastPayload) {
    alert('Pirmiausia paspauskite „Generuoti".');
    return;
  }

  const url = (GOOGLE_SCRIPT_URL || '').trim();
  if (!url || !url.endsWith('exec')) {
    alert('Patikrinkite WebApp URL – turi baigtis exec. Naudokite Apps Script Web app /exec adresą, ne Google Sheets lentelės adresą.');
    return;
  }

  submitToGoogleSheets(url, lastPayload)
    .then(() => {
      document.getElementById('statusErr').style.display = 'none';
      document.getElementById('statusOk').style.display = 'block';
    })
    .catch(() => {
      document.getElementById('statusOk').style.display = 'none';
      document.getElementById('statusErr').style.display = 'block';
    });
}

function submitToGoogleSheets(url, payload) {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) });

  return fetch(url, {
    method: 'POST',
    body,
    mode: 'no-cors',
    keepalive: true
  }).catch(() => submitToGoogleSheetsWithForm(url, body.toString()));
}

function submitToGoogleSheetsWithForm(url, body) {
  return new Promise(resolve => {
    const id = `gs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');

    iframe.name = id;
    iframe.setAttribute('name', id);
    iframe.style.display = 'none';

    form.action = url;
    form.method = 'POST';
    form.target = id;
    form.style.display = 'none';

    input.type = 'hidden';
    input.name = 'payload';
    input.value = new URLSearchParams(body).get('payload') || body;

    form.appendChild(input);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      iframe.remove();
      form.remove();
      resolve();
    }, 3000);
  });
}

function spausdinti() { window.print(); }
