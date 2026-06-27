/* popups.js – DVPRS, Braden, MUST, Morse modalai */

/* ═══════════════════════════════════════════
   DVPRS
═══════════════════════════════════════════ */
const dvprs = [
  { n: 0,  emoji: '😀', color: '#16a34a', text: 'NERA SKAUSMO' },
  { n: 1,  emoji: '🙂', color: '#22c55e', text: 'NEPASTEBIMAS SKAUSMAS' },
  { n: 2,  emoji: '🙂', color: '#4ade80', text: 'PASTEBIMAS SKAUSMAS, NEKELIANTIS NEPATOGUMŲ' },
  { n: 3,  emoji: '🙂', color: '#86efac', text: 'SKAUSMAS, KURIS KARTAIS NELEIDŽIA SUSIKAUPTI' },
  { n: 4,  emoji: '😐', color: '#facc15', text: 'SKAUSMAS, KURIS NELEIDŽIA SUSIKAUPTI' },
  { n: 5,  emoji: '😐', color: '#fbbf24', text: 'SKAUSMAS, KURIS TRUKDO VEIKLOMS' },
  { n: 6,  emoji: '😐', color: '#f59e0b', text: 'SUNKU IGNORUOTI SKAUSMĄ' },
  { n: 7,  emoji: '😣', color: '#fb7185', text: 'SUNKU SUSIKAUPTI DĖL SKAUSMO' },
  { n: 8,  emoji: '😣', color: '#f43f5e', text: 'DĖL SKAUSMO SUNKU KĄ NORS DARYTI' },
  { n: 9,  emoji: '😭', color: '#ef4444', text: 'NEPAKELIAMAS SKAUSMAS, NIEKO NEĮMANOMA DARYTI' },
  { n: 10, emoji: '😭', color: '#b91c1c', text: 'DIDŽIAUSIAS SKAUSMAS, NIEKAS DAUGIAU NERŪPI' }
];

function openDvprs() {
  document.getElementById('dvprsModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeDvprs() {
  document.getElementById('dvprsModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function setPainFromDvprs(n) {
  document.getElementById('skausmas').value = 'taip';
  document.getElementById('skausmoLygis').value = String(n);
  document.getElementById('skausmoLygis').toggleAttribute('required', true);
  closeDvprs();
  document.getElementById('skausmas_section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderDvprs() {
  const grid = document.getElementById('dvprsGrid');
  if (!grid) return;
  grid.innerHTML = dvprs.map(item => `
    <button type="button" class="dvprsCard" style="--dvprsColor:${item.color}"
      onclick="setPainFromDvprs(${item.n})" aria-label="Skausmo lygis ${item.n} iš 10">
      <div class="dvprsBar" style="background-color:${item.color}"></div>
      <div class="dvprsTop">
        <div class="dvprsLeft">
          <div class="dvprsEmoji" aria-hidden="true">${item.emoji}</div>
          <div class="dvprsNum">${item.n}</div>
        </div>
        <div class="dvprsTag">${item.n}/10</div>
      </div>
      <div class="dvprsText">${escapeHtml(item.text)}</div>
    </button>`).join('');
}

/* ═══════════════════════════════════════════
   BRADEN skalė (pragulų rizika)
   Suma 6–23. Mažesnis = didesnė rizika.
   ≤9 labai didelė, 10–12 didelė, 13–14 vidutinė, 15–18 maža, 19–23 labai maža
═══════════════════════════════════════════ */
const BRADEN_CATEGORIES = [
  {
    id: 'br_jutimas', label: 'Jutiminė percepcija',
    options: [
      { v: 1, text: '1 – Visiškai sutrikusi' },
      { v: 2, text: '2 – Labai sutrikusi' },
      { v: 3, text: '3 – Šiek tiek sutrikusi' },
      { v: 4, text: '4 – Nesutrikusi' }
    ]
  },
  {
    id: 'br_dregme', label: 'Drėgmė',
    options: [
      { v: 1, text: '1 – Nuolat drėgna' },
      { v: 2, text: '2 – Dažnai drėgna' },
      { v: 3, text: '3 – Kartais drėgna' },
      { v: 4, text: '4 – Retai drėgna' }
    ]
  },
  {
    id: 'br_aktyvumas', label: 'Aktyvumas',
    options: [
      { v: 1, text: '1 – Guli lovoje' },
      { v: 2, text: '2 – Sėdi kėdėje' },
      { v: 3, text: '3 – Kartais vaikšto' },
      { v: 4, text: '4 – Dažnai vaikšto' }
    ]
  },
  {
    id: 'br_judrumas', label: 'Judrumas',
    options: [
      { v: 1, text: '1 – Visiškai nejudrus' },
      { v: 2, text: '2 – Labai ribotas' },
      { v: 3, text: '3 – Šiek tiek ribotas' },
      { v: 4, text: '4 – Nejudrus' }
    ]
  },
  {
    id: 'br_mityba', label: 'Mityba',
    options: [
      { v: 1, text: '1 – Labai prasta' },
      { v: 2, text: '2 – Nepatenkinama' },
      { v: 3, text: '3 – Patenkinama' },
      { v: 4, text: '4 – Puiki' }
    ]
  },
  {
    id: 'br_trintis', label: 'Trintis ir šlytis',
    options: [
      { v: 1, text: '1 – Problema' },
      { v: 2, text: '2 – Galima problema' },
      { v: 3, text: '3 – Nėra problemos' }
    ]
  }
];

let bradenScore = null;

function bradenRiskLabel(sum) {
  if (sum <= 9)  return { label: 'Labai didelė rizika', cls: 'risk-bad' };
  if (sum <= 12) return { label: 'Didelė rizika', cls: 'risk-bad' };
  if (sum <= 14) return { label: 'Vidutinė rizika', cls: 'risk-warn' };
  if (sum <= 18) return { label: 'Maža rizika', cls: 'risk-ok' };
  return { label: 'Labai maža rizika', cls: 'risk-ok' };
}

function renderBraden() {
  const grid = document.getElementById('bradenGrid');
  if (!grid) return;
  grid.innerHTML = BRADEN_CATEGORIES.map(cat => `
    <div class="scaleCard">
      <div class="scaleCardLabel">${escapeHtml(cat.label)}</div>
      <div class="scaleOptions">
        ${cat.options.map(o => `
          <label class="scaleOpt">
            <input type="radio" name="${cat.id}" value="${o.v}" onchange="updateBradenTotal()">
            <span>${escapeHtml(o.text)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
  updateBradenTotal();
}

function updateBradenTotal() {
  let sum = 0, filled = 0;
  BRADEN_CATEGORIES.forEach(cat => {
    const el = document.querySelector(`input[name="${cat.id}"]:checked`);
    if (el) { sum += parseInt(el.value); filled++; }
  });
  const el = document.getElementById('bradenTotal');
  if (filled === BRADEN_CATEGORIES.length) {
    const { label, cls } = bradenRiskLabel(sum);
    el.innerHTML = `Suma: <span class="${cls}">${sum} – ${label}</span>`;
    bradenScore = sum;
  } else {
    el.textContent = `Suma: — (užpildyta ${filled}/${BRADEN_CATEGORIES.length})`;
    bradenScore = null;
  }
}

function openBraden() {
  renderBraden();
  document.getElementById('bradenModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeBraden() {
  document.getElementById('bradenModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function confirmBraden() {
  if (bradenScore === null) { alert('Užpildykite visas kategorijas.'); return; }
  const { label } = bradenRiskLabel(bradenScore);
  document.getElementById('bradenResult').textContent = `✓ Braden: ${bradenScore} balai – ${label}`;
  closeBraden();
}

/* ═══════════════════════════════════════════
   MUST skalė (mitybos rizika)
   0 = maža, 1 = vidutinė, ≥2 = didelė
═══════════════════════════════════════════ */
const MUST_CATEGORIES = [
  {
    id: 'must_bmi', label: '1 žingsnis – KMI (kg/m²)',
    options: [
      { v: 0, text: '0 – KMI >20' },
      { v: 1, text: '1 – KMI 18.5–20' },
      { v: 2, text: '2 – KMI <18.5' }
    ]
  },
  {
    id: 'must_loss', label: '2 žingsnis – Netyčinis svorio kritimas per 3–6 mėn.',
    options: [
      { v: 0, text: '0 – <5%' },
      { v: 1, text: '1 – 5–10%' },
      { v: 2, text: '2 – >10%' }
    ]
  },
  {
    id: 'must_acute', label: '3 žingsnis – Ūmus ligos poveikis',
    options: [
      { v: 0, text: '0 – Nėra' },
      { v: 2, text: '2 – Pacientas nevalgo >5 paras arba gali nevalgyti' }
    ]
  }
];

let mustScore = null;

function mustRiskLabel(sum) {
  if (sum === 0) return { label: 'Maža rizika', cls: 'risk-ok' };
  if (sum === 1) return { label: 'Vidutinė rizika', cls: 'risk-warn' };
  return { label: 'Didelė rizika', cls: 'risk-bad' };
}

function renderMust() {
  const grid = document.getElementById('mustGrid');
  if (!grid) return;
  grid.innerHTML = MUST_CATEGORIES.map(cat => `
    <div class="scaleCard">
      <div class="scaleCardLabel">${escapeHtml(cat.label)}</div>
      <div class="scaleOptions">
        ${cat.options.map(o => `
          <label class="scaleOpt">
            <input type="radio" name="${cat.id}" value="${o.v}" onchange="updateMustTotal()">
            <span>${escapeHtml(o.text)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
  updateMustTotal();
}

function updateMustTotal() {
  let sum = 0, filled = 0;
  MUST_CATEGORIES.forEach(cat => {
    const el = document.querySelector(`input[name="${cat.id}"]:checked`);
    if (el) { sum += parseInt(el.value); filled++; }
  });
  const el = document.getElementById('mustTotal');
  if (filled === MUST_CATEGORIES.length) {
    const { label, cls } = mustRiskLabel(sum);
    el.innerHTML = `Suma: <span class="${cls}">${sum} – ${label}</span>`;
    mustScore = sum;
  } else {
    el.textContent = `Suma: — (užpildyta ${filled}/${MUST_CATEGORIES.length})`;
    mustScore = null;
  }
}

function openMust() {
  renderMust();
  document.getElementById('mustModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeMust() {
  document.getElementById('mustModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function confirmMust() {
  if (mustScore === null) { alert('Užpildykite visas kategorijas.'); return; }
  const { label } = mustRiskLabel(mustScore);
  document.getElementById('mustResult').textContent = `✓ MUST: ${mustScore} balai – ${label}`;
  closeMust();
}

/* ═══════════════════════════════════════════
   MORSE skalė (griuvimų rizika)
   0–24 = maža, 25–44 = vidutinė, ≥45 = didelė
═══════════════════════════════════════════ */
const MORSE_CATEGORIES = [
  {
    id: 'morse_fall', label: 'Griuvimo istorija per pastaruosius 3 mėn.',
    options: [
      { v: 0,  text: '0 – Ne' },
      { v: 25, text: '25 – Taip' }
    ]
  },
  {
    id: 'morse_diag', label: 'Antrinė diagnozė',
    options: [
      { v: 0,  text: '0 – Ne' },
      { v: 15, text: '15 – Taip' }
    ]
  },
  {
    id: 'morse_aid', label: 'Judėjimo pagalbinė priemonė',
    options: [
      { v: 0,  text: '0 – Nėra / lovos režimas / slaugytojo pagalba' },
      { v: 15, text: '15 – Ramentai / lazda / vaikštynė' },
      { v: 30, text: '30 – Laikosi baldų' }
    ]
  },
  {
    id: 'morse_iv', label: 'IV sistema / heparino spyna',
    options: [
      { v: 0,  text: '0 – Ne' },
      { v: 20, text: '20 – Taip' }
    ]
  },
  {
    id: 'morse_gait', label: 'Eisena / persikėlimas',
    options: [
      { v: 0,  text: '0 – Normali / lovos režimas / nejuda' },
      { v: 10, text: '10 – Silpna' },
      { v: 20, text: '20 – Sutrikusi' }
    ]
  },
  {
    id: 'morse_mental', label: 'Psichinė būklė',
    options: [
      { v: 0,  text: '0 – Žino savo galimybių ribas' },
      { v: 15, text: '15 – Pervertina galimybes / pamiršta apribojimus' }
    ]
  }
];

let morseScore = null;

function morseRiskLabel(sum) {
  if (sum <= 24) return { label: 'Maža rizika', cls: 'risk-ok' };
  if (sum <= 44) return { label: 'Vidutinė rizika', cls: 'risk-warn' };
  return { label: 'Didelė rizika', cls: 'risk-bad' };
}

function renderMorse() {
  const grid = document.getElementById('morseGrid');
  if (!grid) return;
  grid.innerHTML = MORSE_CATEGORIES.map(cat => `
    <div class="scaleCard">
      <div class="scaleCardLabel">${escapeHtml(cat.label)}</div>
      <div class="scaleOptions">
        ${cat.options.map(o => `
          <label class="scaleOpt">
            <input type="radio" name="${cat.id}" value="${o.v}" onchange="updateMorseTotal()">
            <span>${escapeHtml(o.text)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
  updateMorseTotal();
}

function updateMorseTotal() {
  let sum = 0, filled = 0;
  MORSE_CATEGORIES.forEach(cat => {
    const el = document.querySelector(`input[name="${cat.id}"]:checked`);
    if (el) { sum += parseInt(el.value); filled++; }
  });
  const el = document.getElementById('morseTotal');
  if (filled === MORSE_CATEGORIES.length) {
    const { label, cls } = morseRiskLabel(sum);
    el.innerHTML = `Suma: <span class="${cls}">${sum} – ${label}</span>`;
    morseScore = sum;
  } else {
    el.textContent = `Suma: — (užpildyta ${filled}/${MORSE_CATEGORIES.length})`;
    morseScore = null;
  }
}

function openMorse() {
  renderMorse();
  document.getElementById('morseModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeMorse() {
  document.getElementById('morseModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function confirmMorse() {
  if (morseScore === null) { alert('Užpildykite visas kategorijas.'); return; }
  const { label } = morseRiskLabel(morseScore);
  document.getElementById('morseResult').textContent = `✓ Morse: ${morseScore} balai – ${label}`;
  closeMorse();
}
