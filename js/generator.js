/* generator.js – rezultatų generavimas ir atvaizdavimas */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxODAbmdrmccCYCUkswsFgnz-nrC8clEQQf-5kId3y-3TCqUwsU4pyCze2Jojv43VV_1A/exec';

let lastPayload = null;

function valOrDash(v) { return (v == null || v === '') ? '-' : v; }
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Pagrindinis generatorius ──────────────────────────────────────
function generateResults() {
  document.getElementById('statusOk').style.display  = 'none';
  document.getElementById('statusErr').style.display = 'none';
  document.getElementById('results').innerHTML = '';

  const f   = document.forms['nursingForm'];
  const ctx = detectProblems(f);
  if (ctx.error) return;

  renderOutput(f, ctx);
}

// ── Atvaizdavimas ─────────────────────────────────────────────────
function renderOutput(f, ctx) {
  const { esamos, galimos, pills, vitals, highSys30, painBlock, addExtrasForHelpDueToDizziness } = ctx;
  const { spo2, temp, sys, dia, hr, map } = vitals;

  const esamosU = uniq(esamos);
  const galimosU = uniq(galimos);

  // ── Gyvybiniai rodikliai ──
  const hasVitals = (spo2 != null || sys != null || hr != null || temp != null);
  const aksStr = (sys != null && dia != null)
    ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}` : null;

  const news = calcNEWS2({
    rr:   toNum(f['rr'].value),
    spo2,
    spo2Scale: f['spo2Scale'] ? f['spo2Scale'].value : '1',
    onO2: f['o2'].value === 'taip',
    temp, sys, hr,
    avpu: f['avpu'].value
  });

  // ── Psichologinė būsena ──
  const pb_ramus    = document.getElementById('ramus').checked;
  const pb_orient   = document.getElementById('orientuotas').checked;
  const pb_dementia = document.getElementById('demencija') && document.getElementById('demencija').checked;
  const pb_agresyv  = document.getElementById('agresyvus')  && document.getElementById('agresyvus').checked;
  const psichoParts = [
    pb_ramus  ? 'ramus'       : 'neramus',
    pb_orient ? 'orientuotas' : 'neorientuotas'
  ];
  if (pb_dementia) psichoParts.push('demencija');
  if (pb_agresyv)  psichoParts.push('agresyvus');
  const psichoSakinys = 'Pacientas ' + psichoParts.join(', ') + '.';

  // ── Suvaržymas ──
  const isRestrained = document.getElementById('suvarzymas') && document.getElementById('suvarzymas').checked;
  const nowTime = new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
  const restraintSentence = isRestrained
    ? `Dėl galimos žalos sau pačiam ir aplinkiniams, neveikiant kitoms priemonėms pacientas fiksuotas (${nowTime}).`
    : '';

  // ── Dieta ──
  const dietCode   = (document.getElementById('dieta_kodas').value || '').trim();
  const dietCustom = (dietCode === 'KITA') ? ((document.getElementById('dieta_kita').value || '').trim()) : '';
  const hasDiet = (dietCode && dietCode !== 'KITA' && dietCode !== '—') || (dietCode === 'KITA' && dietCustom);

  // ── Skalių santrauka ──
  const scalesSummary = [];
  if (typeof bradenScore === 'number' && bradenScore !== null)
    scalesSummary.push(`Braden: ${bradenScore} bal.`);
  if (typeof mustScore === 'number' && mustScore !== null)
    scalesSummary.push(`MUST: ${mustScore} bal.`);
  if (typeof morseScore === 'number' && morseScore !== null)
    scalesSummary.push(`Morse: ${morseScore} bal.`);

  // ── Pirminis vertinimas ──
  const pvPlanSets = {
    cv:   ['AKS sekimas', 'Skysčių balanso stebėjimas', 'Edemų stebėjimas', 'Dusulio stebėjimas', 'Mitybos/dietos pritaikymas'],
    resp: ['SpO₂ stebėjimas'],
    endo: ['Glikemijos kontrolė', 'Mitybos/dietos pritaikymas'],
    rh:   ['Skysčių balanso stebėjimas', 'Skysčių kiekio sekimas', 'AKS sekimas']
  };
  const pvSelected = [], pvExtraItems = [];
  if (document.getElementById('pv_cv').checked)        { pvSelected.push('Širdies–kraujotakos');  pvExtraItems.push(...pvPlanSets.cv); }
  if (document.getElementById('pv_resp').checked)      { pvSelected.push('Kvėpavimo');            pvExtraItems.push(...pvPlanSets.resp); }
  if (document.getElementById('pv_endo_cd').checked)   { pvSelected.push('Endokrininės (CD)');    pvExtraItems.push(...pvPlanSets.endo); }
  if (document.getElementById('pv_renal_hep').checked) { pvSelected.push('Inkstų/kepenų');        pvExtraItems.push(...pvPlanSets.rh); }

  const pvInfection = (document.getElementById('pv_infection').value || '').trim();
  const pvAllergy   = (document.getElementById('pv_allergy').value   || '').trim();
  const pvSummaryParts = [];
  if (pvSelected.length) pvSummaryParts.push('Sritys: ' + pvSelected.join(', '));
  if (pvInfection)       pvSummaryParts.push('Infekcinės ligos: ' + pvInfection);
  if (pvAllergy)         pvSummaryParts.push('Alergijos: ' + pvAllergy);
  const pvSummaryText = pvSummaryParts.join(' | ');
  const hasPV = pvSummaryParts.length > 0;

  const combineBedRestAndUlcers = (f['mobilumas'].value === 'lova' && f['pragulos'].value === 'yra');

  // ──────────────────────────────────────────────────────────────────
  // HTML STRUKTŪRA
  // ──────────────────────────────────────────────────────────────────
  let html = '';

  // 1) GYVYBINIAI RODIKLIAI + NEWS2
  {
    let vHtml = '';
    const vitalsRows = [];
    if (spo2 != null) vitalsRows.push(`SpO₂ ${spo2} %`);
    if (aksStr)       vitalsRows.push(`AKS ${aksStr}`);
    if (hr != null)   vitalsRows.push(`ŠSD ${hr}/min`);
    if (temp != null) vitalsRows.push(`T ${Number(temp).toFixed(1)} °C`);

    if (vitalsRows.length) {
      vHtml += `<p>${vitalsRows.join(' &nbsp;|&nbsp; ')}</p>`;
    }
    vHtml += `<p><strong>NEWS2:</strong> ${news.isComplete ? news.score + ' bal.' : 'neapskaičiuotas'} &mdash; ${esc(news2Text(news.score, news.hasRedScore, news.isComplete, news.missingFields))}</p>`;
    if (scalesSummary.length) {
      vHtml += `<p>${scalesSummary.map(s => `<span class="pill">${esc(s)}</span>`).join('')}</p>`;
    }

    html += `<h3>Gyvybiniai rodikliai</h3><div class="planas">${vHtml}</div>`;
  }

  // 2) PSICHOLOGINĖ BŪSENA
  {
    let pHtml = `<p>${esc(psichoSakinys)}</p>`;
    if (restraintSentence) pHtml += `<p>${esc(restraintSentence)}</p>`;
    html += `<h3>Psichologinė būsena</h3><div class="planas">${pHtml}</div>`;
  }

  // 3) ESAMOS PROBLEMOS
  html += `<h3>Esamos problemos</h3><div class="planas"><ul>${
    esamosU.length
      ? esamosU.map(p => `<li>${esc(p)}</li>`).join('')
      : '<li>Nenustatyta</li>'
  }</ul></div>`;

  // 4) GALIMOS PROBLEMOS
  html += `<h3>Galimos problemos</h3><div class="planas"><ul>${
    galimosU.length
      ? galimosU.map(p => `<li>${esc(p)}</li>`).join('')
      : '<li>Nenustatyta</li>'
  }</ul></div>`;

  // 5) SLAUGOS PLANAS
  html += '<h3>Slaugos planas</h3>';
  let planBlocksCount = 0;

  // 5a) Kombinuotas lovos režimas + pragulos
  if (combineBedRestAndUlcers) {
    const items = getProblemInterventions('Gulimas režimas ir pragulos');
    if (items.length) {
      html += `<div class="planas"><h4>Gulimas režimas ir pragulos</h4><ul>${
        items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
      planBlocksCount++;
    }
  }

  // 5b) Kitos esamos ir galimos problemos
  [...esamosU, ...galimosU].forEach(p => {
    if (combineBedRestAndUlcers && (p === 'Pragulos' || p === 'Rizika praguloms dėl lovos režimo')) return;
    if (addExtrasForHelpDueToDizziness && p === 'Rizika griuvimui dėl galvos svaigimo') return;
    if (p === 'Taikoma fizinė fiksacija') return;

    const items = [...getProblemInterventions(p)];
    if (!items.length) return;

    if (p.startsWith('Padidėjęs kraujo spaudimas') && highSys30) items.push('AKS sekimas kas 30 min.');
    if (addExtrasForHelpDueToDizziness && p === 'Judėjimas su pagalba') {
      items.push('AKS sekimas');
      items.push('Griuvimų profilaktika');
    }

    html += `<div class="planas"><h4>${esc(p)}</h4><ul>${
      items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
    planBlocksCount++;
  });

  // 5c) Skausmo planas
  if (painBlock) {
    const items = getProblemInterventions(painBlock.key);
    if (items.length) {
      html += `<div class="planas"><h4>Skausmas (${painBlock.score}/10)</h4><ul>${
        items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
      planBlocksCount++;
    }
  }

  // 5d) Dieta
  const dietItems = (dietCode && dietCode !== 'KITA' && dietCode !== '—') ? getDietPlan(dietCode) : [];
  if (dietItems.length) {
    html += `<div class="planas"><h4>Dieta ${esc(dietCode)}</h4><ul>${
      dietItems.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
    planBlocksCount++;
  }

  // 5e) Fizinis suvaržymas
  if (isRestrained) {
    const items = getProblemInterventions('Taikoma fizinė fiksacija');
    if (items.length) {
      html += `<div class="planas"><h4>Fizinis suvaržymas</h4><ul>${
        items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
      planBlocksCount++;
    }
  }

  if (planBlocksCount === 0) {
    html += '<div class="planas"><p>Intervencijų nenustatyta</p></div>';
  }

  // 6) PIRMINIS VERTINIMAS – tik jei įvesta
  if (hasPV || pvExtraItems.length) {
    let pvHtml = '';
    if (pvSummaryText) pvHtml += `<p>${esc(pvSummaryText)}</p>`;
    if (pvExtraItems.length) {
      const extra = uniq(pvExtraItems);
      pvHtml += `<ul>${extra.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    }
    html += `<h3>Pirminis vertinimas</h3><div class="planas">${pvHtml}</div>`;
  }

  if (hasDiet) {
    const dietaUi = (dietCode === 'KITA') ? dietCustom : dietCode;
    html += `<p class="hint">Pacientui skirta <strong>${esc(dietaUi)}</strong> dieta</p>`;
  }

  document.getElementById('results').innerHTML = html;

  // ── Payload (JSON įrašas) ──
  _buildPayload(f, {
    esamosU, galimosU, combineBedRestAndUlcers,
    addExtrasForHelpDueToDizziness, highSys30,
    painBlock, dietCode, isRestrained, pvExtraItems,
    vitals,
    psichoSakinys, restraintSentence, hasDiet,
    dietaNote: (dietCode === 'KITA') ? dietCustom : dietCode,
    pvSummaryText, news, scalesSummary
  });
}

// ── Payload (tekstinis įrašas) ─────────────────────────────────────
function _buildPayload(f, d) {
  const seenPlan = new Set();
  const planItems = [];

  function addPlan(key) {
    getProblemInterventions(key).forEach(it => {
      if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
    });
  }

  if (d.combineBedRestAndUlcers) addPlan('Gulimas režimas ir pragulos');

  [...d.esamosU, ...d.galimosU].forEach(p => {
    if (d.combineBedRestAndUlcers && (p === 'Pragulos' || p === 'Rizika praguloms dėl lovos režimo')) return;
    if (d.addExtrasForHelpDueToDizziness && p === 'Rizika griuvimui dėl galvos svaigimo') return;
    if (p === 'Taikoma fizinė fiksacija') return;

    const items = [...getProblemInterventions(p)];
    if (p.startsWith('Padidėjęs kraujo spaudimas') && d.highSys30) items.push('AKS sekimas kas 30 min.');
    if (d.addExtrasForHelpDueToDizziness && p === 'Judėjimas su pagalba') {
      items.push('AKS sekimas'); items.push('Griuvimų profilaktika');
    }
    items.forEach(it => { if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); } });
  });

  if (d.painBlock) addPlan(d.painBlock.key);
  if (d.dietCode && d.dietCode !== 'KITA' && d.dietCode !== '—') {
    getDietPlan(d.dietCode).forEach(it => {
      if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
    });
  }
  if (d.isRestrained) addPlan('Taikoma fizinė fiksacija');
  if (d.pvExtraItems.length) uniq(d.pvExtraItems).forEach(it => {
    if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
  });

  const { spo2, sys, dia, map, hr, temp } = d.vitals;
  const aksStr = (sys != null && dia != null)
    ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}` : '-';

  const vitalsLine = [
    spo2 != null ? `SpO₂ ${spo2} %` : null,
    (sys != null && dia != null) ? `AKS ${aksStr}` : null,
    hr   != null ? `ŠSD ${hr}/min` : null,
    temp != null ? `T ${Number(temp).toFixed(1)} °C` : null
  ].filter(Boolean).join(', ') || '-';

  let irasas =
    `Gyvybiniai rodikliai:\n${vitalsLine}\n` +
    `NEWS2: ${d.news.isComplete ? d.news.score + ' bal.' : 'neapskaičiuotas'} – ${news2Text(d.news.score, d.news.hasRedScore, d.news.isComplete, d.news.missingFields)}\n`;

  if (d.scalesSummary.length) irasas += `Vertinimo skalės: ${d.scalesSummary.join(', ')}\n`;

  irasas += `\n${d.psichoSakinys}\n`;
  if (d.restraintSentence) irasas += `${d.restraintSentence}\n`;

  irasas +=
    `\nEsamos problemos:\n${d.esamosU.length ? d.esamosU.join('; ') : '-'}\n\n` +
    `Galimos problemos:\n${d.galimosU.length ? d.galimosU.join('; ') : '-'}\n\n` +
    `Slaugos planas:\n${planItems.length ? planItems.map(i => '• ' + i).join('\n') : '-'}`;

  if (d.hasDiet) irasas += `\n\nPacientui skirta ${d.dietaNote} dieta`;
  if (d.pvSummaryText) irasas += `\n\nPirminis vertinimas:\n${d.pvSummaryText}`;

  lastPayload = {
    Laikas:  new Date().toLocaleString('lt-LT'),
    palata:  (f['palata'].value || '').trim(),
    lova:    (f['lova'].value   || '').trim(),
    įrašas:  irasas
  };

  document.getElementById('results').insertAdjacentHTML('beforeend',
    `<div class="mono">${esc(JSON.stringify(lastPayload, null, 2))}</div>`);
}

// ── Siuntimas į Google Sheets ─────────────────────────────────────
function keltiISistema() {
  if (!lastPayload) { alert('Pirmiausia paspauskite „Generuoti".'); return; }
  const url = (GOOGLE_SCRIPT_URL || '').trim();
  if (!url || !url.endsWith('exec')) {
    alert('Patikrinkite WebApp URL – turi baigtis exec. Naudokite Apps Script Web app /exec adresą, ne Google Sheets lentelės adresą.');
    return;
  }

  submitToGoogleSheets(url, lastPayload)
    .then(() => {
      document.getElementById('statusErr').style.display = 'none';
      document.getElementById('statusOk').style.display  = 'block';
    })
    .catch(() => {
      document.getElementById('statusOk').style.display  = 'none';
      document.getElementById('statusErr').style.display = 'block';
    });
}

function submitToGoogleSheets(url, payload) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon(url, blob)) {
      return Promise.resolve();
    }
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body,
    mode: 'no-cors',
    keepalive: true
  }).catch(() => submitToGoogleSheetsWithForm(url, body));
}

function submitToGoogleSheetsWithForm(url, body) {
  return new Promise((resolve, reject) => {
    const id = `gs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');
    let settled = false;
    let submitted = false;

    function cleanup() {
      setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 1000);
    }

    function finish(ok) {
      if (settled) return;
      settled = true;
      cleanup();
      if (ok) resolve(); else reject(new Error('Google Sheets submission failed.'));
    }

    iframe.name = id;
    iframe.setAttribute('name', id);
    iframe.style.display = 'none';
    iframe.onload = () => { if (submitted) finish(true); };
    iframe.onerror = () => finish(false);

    form.action = url;
    form.method = 'POST';
    form.target = id;
    form.style.display = 'none';

    input.type = 'hidden';
    input.name = 'payload';
    input.value = body;

    form.appendChild(input);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    submitted = true;
    form.submit();

    setTimeout(() => finish(true), 3000);
  });
}

function spausdinti() { window.print(); }
