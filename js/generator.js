/* generator.js – rezultatų generavimas, HTML atvaizdavimas, siuntimas */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxODAbmdrmccCYCUkswsFgnz-nrC8clEQQf-5kId3y-3TCqUwsU4pyCze2Jojv43VV_1A/exec';

let lastPayload = null;

// ── Pagalbinės funkcijos ──────────────────────────────────────────
function valOrDash(v) { return (v == null || v === '') ? '-' : v; }

function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

function vitalsText(spo2, sys, dia, map, hr, temp) {
  const aks = (sys != null && dia != null)
    ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}`
    : '-';
  const t = (temp != null) ? `${Number(temp).toFixed(1)} °C` : '-';
  const s = (spo2 != null) ? `${spo2} %` : '-';
  const h = (hr   != null) ? `${hr}/min` : '-';
  return `SpO₂ ${s}, AKS ${aks}, ŠSD ${h}, T ${t}`;
}

// ── Pagrindinis generatorius ──────────────────────────────────────
async function generateResults() {
  document.getElementById('statusOk').style.display  = 'none';
  document.getElementById('statusErr').style.display = 'none';

  if (!CARE_LIBRARY) {
    await loadLibrary();
  }

  const f   = document.forms['nursingForm'];
  const ctx = detectProblems(f);
  if (ctx.error) return;

  renderOutput(f, ctx);
}

// ── Atvaizdavimas ─────────────────────────────────────────────────
function renderOutput(f, ctx) {
  const { esamos, galimos, pills, vitals, highSys30, painBlock, addExtrasForHelpDueToDizziness } = ctx;
  const { spo2, temp, sys, dia, hr, map } = vitals;

  const esamosU = uniq(esamos).sort();
  const galimosU = uniq(galimos).sort();

  const combineBedRestAndUlcers = (f['mobilumas'].value === 'lova' && f['pragulos'].value === 'yra');

  const pb_ramus  = document.getElementById('ramus').checked;
  const pb_orient = document.getElementById('orientuotas').checked;
  const psichoTekstas = `${pb_ramus ? 'ramus' : 'neramus'}, ${pb_orient ? 'orientuotas' : 'neorientuotas'}`;

  // ── IŠRAŠYMAS Į NAMUS ──
  const goingHome = document.getElementById('vykstaNamo').checked === true;
  if (goingHome) {
    _renderDischarge(f, vitals, psichoTekstas);
    return;
  }

  // ── Suvaržymas ──
  const isRestrained = document.getElementById('suvarzymas').checked === true;
  const nowTime = new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
  const restraintSentence = isRestrained
    ? `Dėl galimos žalos sau pačiam ir aplinkiniams, neveikiant kitoms priemonėms pacientas fiksuotas (${nowTime}).`
    : '';

  // ── Pirminis vertinimas ──
  const pvPlanSets = {
    cv:   ['AKS sekimas', 'Skysčių balanso stebėjimas', 'Edemų stebėjimas', 'Dusulio stebėjimas', 'Mitybos/dietos pritaikymas'],
    resp: ['SpO₂ stebėjimas'],
    endo: ['Glikemijos kontrolė', 'Mitybos/dietos pritaikymas'],
    rh:   ['Skysčių balanso stebėjimas', 'Skysčių kiekio sekimas', 'AKS sekimas']
  };
  const pvSelected = [], pvExtraItems = [];
  if (document.getElementById('pv_cv').checked)       { pvSelected.push('Širdies–kraujotakos');    pvExtraItems.push(...pvPlanSets.cv); }
  if (document.getElementById('pv_resp').checked)     { pvSelected.push('Kvėpavimo');              pvExtraItems.push(...pvPlanSets.resp); }
  if (document.getElementById('pv_endo_cd').checked)  { pvSelected.push('Endokrininės (CD)');      pvExtraItems.push(...pvPlanSets.endo); }
  if (document.getElementById('pv_renal_hep').checked){ pvSelected.push('Inkstų/kepenų');          pvExtraItems.push(...pvPlanSets.rh); }

  const pvInfection = (document.getElementById('pv_infection').value || '').trim();
  const pvAllergy   = (document.getElementById('pv_allergy').value || '').trim();
  const pvSummaryParts = [];
  if (pvSelected.length)  pvSummaryParts.push('Sritys: ' + pvSelected.join(', '));
  if (pvInfection)        pvSummaryParts.push('Infekcinės ligos: ' + pvInfection);
  if (pvAllergy)          pvSummaryParts.push('Alergijos: ' + pvAllergy);
  const pvSummaryText = pvSummaryParts.join(' | ');

  // ── Dieta ──
  const dietCode   = (document.getElementById('dieta_kodas').value || '').trim();
  const dietCustom = (dietCode === 'KITA') ? ((document.getElementById('dieta_kita').value || '').trim()) : '';
  const hasDiet = (dietCode && dietCode !== 'KITA') || (dietCode === 'KITA' && dietCustom);

  // ── NEWS2 ──
  const news = calcNEWS2({
    rr:   toNum(f['rr'].value),
    spo2,
    onO2: f['o2'].value === 'taip',
    temp,
    sys,
    hr,
    avpu: f['avpu'].value
  });

  // ─── HTML ───────────────────────────────────────────────────────
  let html = '';
  if (pills.length) html += `<div class="hint"><strong>Greita santrauka:</strong> ${pills.join(' ')}</div>`;

  html += `<h3>Esamos problemos</h3><ul>${
    esamosU.length ? esamosU.map(p => `<li>${escapeHtml(p)}</li>`).join('') : '<li>Nepastebėta</li>'
  }</ul>`;
  html += `<h3>Galimos problemos</h3><ul>${
    galimosU.length ? galimosU.map(p => `<li>${escapeHtml(p)}</li>`).join('') : '<li>Nepastebėta</li>'
  }</ul>`;

  html += '<h3>Slaugos planas</h3>';

  // 1) Kombinuotas planas
  if (combineBedRestAndUlcers) {
    const items = getProblemInterventions('Gulimas režimas ir pragulos');
    if (items.length) {
      html += `<div class="planas"><h4>Gulimas režimas ir pragulos</h4><ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
    }
  }

  // 2) Kiti planai
  [...esamosU, ...galimosU].forEach(p => {
    if (combineBedRestAndUlcers) {
      if (p === 'Pragulos') return;
      if (p === 'Rizika praguloms dėl lovos režimo') return;
    }
    if (addExtrasForHelpDueToDizziness && p === 'Rizika griuvimui dėl galvos svaigimo') return;

    const items = [...getProblemInterventions(p)];
    if (!items.length) return;

    if (p.startsWith('Padidėjęs kraujo spaudimas') && highSys30) {
      items.push('AKS sekimas kas 30 min.');
    }
    if (addExtrasForHelpDueToDizziness && p === 'Judėjimas su pagalba') {
      items.push('AKS sekimas');
      items.push('Griuvimų profilaktika');
    }

    html += `<div class="planas"><h4>${escapeHtml(p)}</h4><ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
  });

  // 3) Skausmo planas
  if (painBlock) {
    const items = getProblemInterventions(painBlock.key);
    if (items.length) {
      html += `<div class="planas"><h4>Skausmas (${painBlock.score}/10)</h4><ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
    }
  }

  // 4) Dietos planas
  const dietItems = (dietCode && dietCode !== 'KITA') ? getDietPlan(dietCode) : [];
  if (dietItems.length) {
    html += `<div class="planas"><h4>Dieta ${escapeHtml(dietCode)}</h4><ul>${dietItems.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
  }

  // 5) Suvaržymas
  if (isRestrained) {
    const items = getProblemInterventions('Taikoma fizinė fiksacija');
    html += `<div class="planas"><h4>Fizinis suvaržymas</h4><ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
  }

  // 6) Pirminis vertinimas
  if (pvExtraItems.length) {
    const extra = uniq(pvExtraItems);
    html += `<div class="planas"><h4>Pirminis vertinimas – papildomos intervencijos</h4><ul>${extra.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
  }

  // ── Gyvybiniai rodikliai ──
  const aksStr = (sys != null && dia != null)
    ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}`
    : '-';
  html += `<h3>Įvesti gyvybiniai rodikliai</h3>
  <p><strong>SpO₂</strong> ${valOrDash(spo2)} %<br>
  <strong>AKS</strong> ${aksStr}<br>
  <strong>ŠSD</strong> ${valOrDash(hr)}/min<br>
  <strong>Temperatūra</strong> ${temp != null ? Number(temp).toFixed(1) : '-'} °C</p>
  <p><strong>Pacientas:</strong> ${escapeHtml(psichoTekstas)}</p>`;

  html += `<p><strong>Ankstyvojo perspėjimo skalė (NEWS2):</strong> ${news.score} balai – ${news2Text(news.score, news.hasCritical)}</p>`;

  if (restraintSentence) html += `<p>${escapeHtml(restraintSentence)}</p>`;
  if (hasDiet) {
    const dietaUi = (dietCode === 'KITA') ? dietCustom : dietCode;
    html += `<p><strong>Pacientui skirta</strong> ${escapeHtml(dietaUi)} dieta</p>`;
  }
  html += `<p><strong>Pirminis vertinimas:</strong> ${escapeHtml(pvSummaryText || '—')}</p>`;

  document.getElementById('results').innerHTML = html;

  // ── Įrašas (JSON) ──
  _buildAndShowPayload(f, {
    esamosU, galimosU, combineBedRestAndUlcers,
    addExtrasForHelpDueToDizziness, highSys30,
    painBlock, dietCode, dietCustom, isRestrained, pvExtraItems,
    vitals, gyvybiniai: vitalsText(spo2, sys, dia, map, hr, temp),
    psichoTekstas, restraintSentence, hasDiet,
    dietaNote: (dietCode === 'KITA') ? dietCustom : dietCode,
    pvSummaryText, news
  });
}

// ── Išrašymas į namus ─────────────────────────────────────────────
function _renderDischarge(f, vitals, psichoTekstas) {
  const { spo2, sys, dia, map, hr, temp } = vitals;
  const tId = (document.getElementById('rekomTemplate').value || '').trim();
  if (!tId) {
    alert('Pasirinkite rekomendacijų šabloną (Rekomendacijų šablonas).');
    document.getElementById('rekomTemplate').focus();
    return;
  }
  const templates = getDischargeTemplates();
  const tpl = templates.find(x => x.id === tId);
  if (!tpl) {
    alert('Nerastas rekomendacijų šablonas. Pasirinkite iš sąrašo dar kartą.');
    return;
  }

  const aksStr = (sys != null && dia != null)
    ? `${sys}/${dia} mmHg${map != null ? ` (MAP ${map})` : ''}` : '-';

  let html = `<h3>Įvesti gyvybiniai rodikliai</h3>
    <p><strong>SpO₂</strong> ${valOrDash(spo2)} %<br>
    <strong>AKS</strong> ${aksStr}<br>
    <strong>ŠSD</strong> ${valOrDash(hr)}/min<br>
    <strong>Temperatūra</strong> ${temp != null ? temp.toFixed(1) : '-'} °C</p>
    <p><strong>Pacientas:</strong> ${escapeHtml(psichoTekstas)}</p>
    <p><strong>Pacientas vyksta namo, ištrauktas intraveninis kateteris.</strong></p>
    <h3>Pacientui rekomenduota</h3>
    <ul>${tpl.items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`;

  const gyvybiniai = vitalsText(spo2, sys, dia, map, hr, temp);
  const irasas =
    `Gyvybiniai rodikliai:\n${gyvybiniai}\n\n` +
    `Pacientas ${psichoTekstas}\n` +
    `Pacientas vyksta namo, ištrauktas intraveninis kateteris.\n\n` +
    `Pacientui rekomenduota:\n` +
    tpl.items.map(i => '• ' + i).join('\n');

  lastPayload = {
    Laikas:  new Date().toLocaleString('lt-LT'),
    palata:  (f['palata'].value || '').trim(),
    lova:    (f['lova'].value   || '').trim(),
    įrašas: irasas
  };

  document.getElementById('results').innerHTML = html;
  document.getElementById('results').insertAdjacentHTML('beforeend',
    `<div class="mono">${escapeHtml(JSON.stringify(lastPayload, null, 2))}</div>`);
}

// ── Payload surinkimas ────────────────────────────────────────────
function _buildAndShowPayload(f, d) {
  const seenPlan = new Set();
  const planItems = [];

  function addItems(key) {
    getProblemInterventions(key).forEach(it => {
      if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
    });
  }

  if (d.combineBedRestAndUlcers) addItems('Gulimas režimas ir pragulos');

  [...d.esamosU, ...d.galimosU].forEach(p => {
    if (d.combineBedRestAndUlcers && (p === 'Pragulos' || p === 'Rizika praguloms dėl lovos režimo')) return;
    if (d.addExtrasForHelpDueToDizziness && p === 'Rizika griuvimui dėl galvos svaigimo') return;

    const items = [...getProblemInterventions(p)];
    if (p.startsWith('Padidėjęs kraujo spaudimas') && d.highSys30) items.push('AKS sekimas kas 30 min.');
    if (d.addExtrasForHelpDueToDizziness && p === 'Judėjimas su pagalba') {
      items.push('AKS sekimas');
      items.push('Griuvimų profilaktika');
    }
    items.forEach(it => { if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); } });
  });

  if (d.painBlock) addItems(d.painBlock.key);
  if (d.dietCode && d.dietCode !== 'KITA') getDietPlan(d.dietCode).forEach(it => {
    if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
  });
  if (d.isRestrained) addItems('Taikoma fizinė fiksacija');
  if (d.pvExtraItems.length) uniq(d.pvExtraItems).forEach(it => {
    if (!seenPlan.has(it)) { seenPlan.add(it); planItems.push(it); }
  });

  const planasText = planItems.length ? planItems.map(i => '• ' + i).join('\n') : '-';
  const { spo2, sys, dia, map, hr, temp } = d.vitals;

  let irasas =
    `Gyvybiniai rodikliai:\n${d.gyvybiniai}\n\n` +
    `Pacientas ${d.psichoTekstas}\n`;

  if (d.restraintSentence) irasas += `${d.restraintSentence}\n`;

  irasas += `\nAnkstyvojo perspėjimo skalė (NEWS2): ${d.news.score} balai – ${news2Text(d.news.score, d.news.hasCritical)}\n\n`;

  if (d.hasDiet) irasas += `Pacientui skirta ${d.dietaNote} dieta\n\n`;

  irasas +=
    `Pirminis vertinimas:\n${d.pvSummaryText || '—'}\n\n` +
    `Slaugos problemos:\n${d.esamosU.length ? d.esamosU.join('; ') : '-'}\n\n` +
    `Galimos problemos:\n${d.galimosU.length ? d.galimosU.join('; ') : '-'}\n\n` +
    `Slaugos planas:\n${planasText}`;

  lastPayload = {
    Laikas:  new Date().toLocaleString('lt-LT'),
    palata:  (f['palata'].value || '').trim(),
    lova:    (f['lova'].value   || '').trim(),
    įrašas: irasas
  };

  document.getElementById('results').insertAdjacentHTML('beforeend',
    `<div class="mono">${escapeHtml(JSON.stringify(lastPayload, null, 2))}</div>`);
}

// ── Siuntimas į Google Sheets ─────────────────────────────────────
function keltiISistema() {
  if (!lastPayload) { alert('Pirmiausia paspauskite „Generuoti".'); return; }
  const url = (GOOGLE_SCRIPT_URL || '').trim();
  if (!url || !url.endsWith('exec')) {
    alert('Patikrinkite WebApp URL – turi baigtis exec.');
    return;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(lastPayload),
    mode: 'no-cors'
  })
    .then(() => {
      document.getElementById('statusErr').style.display = 'none';
      document.getElementById('statusOk').style.display  = 'block';
    })
    .catch(() => {
      document.getElementById('statusOk').style.display  = 'none';
      document.getElementById('statusErr').style.display = 'block';
    });
}

// ── Spausdinimas ──────────────────────────────────────────────────
function spausdinti() {
  window.print();
}
