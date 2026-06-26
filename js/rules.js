/* rules.js – sprendimų variklis: formos laukai → slaugos problemos */

const THRESHOLDS = {
  spo2Warn: 95, spo2Critical: 90,
  tempSubfebrile: 37.1, tempFever: 38.0, tempHypothermia: 35.6,
  sysLow: 100, mapLow: 65, sysHigh: 140, diaHigh: 90, sysVeryHigh_30min: 165,
  hrTachy: 100, hrBrady: 50
};

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function classifyPill(text, severity = 'ok') {
  const cls = severity === 'bad' ? 'pill bad' : severity === 'warn' ? 'pill warn' : 'pill ok';
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

function detectProblems(f) {
  const esamos = [], galimos = [], pills = [];

  const spo2 = toNum(f['saturacija'].value);
  const temp = toNum(f['temperatura'].value);
  const sys  = toNum(f['sistolinis'].value);
  const dia  = toNum(f['diastolinis'].value);
  const hr   = toNum(f['pulsas'].value);
  const map  = calcMAP(sys, dia);
  const highSys30 = (sys != null && sys >= THRESHOLDS.sysVeryHigh_30min);

  // ── SpO₂ ──
  if (spo2 != null) {
    if (spo2 < THRESHOLDS.spo2Critical) {
      esamos.push('Neefektyvi dujų apykaita');
      pills.push(classifyPill(`SpO₂ ${spo2}% (kritiškai žema)`, 'bad'));
    } else if (spo2 < THRESHOLDS.spo2Warn) {
      esamos.push('Neefektyvi dujų apykaita');
      pills.push(classifyPill(`SpO₂ ${spo2}% (žema)`, 'warn'));
    } else {
      pills.push(classifyPill(`SpO₂ ${spo2}%`, 'ok'));
    }
  }

  // ── Temperatūra ──
  if (temp != null) {
    if (temp >= THRESHOLDS.tempFever) {
      esamos.push('Padidėjusi temperatūra');
      pills.push(classifyPill(`T ${temp.toFixed(1)}°C (karščiavimas)`, 'warn'));
    } else if (temp >= THRESHOLDS.tempSubfebrile) {
      esamos.push('Padidėjusi temperatūra');
      pills.push(classifyPill(`T ${temp.toFixed(1)}°C (subfebrilus)`, 'warn'));
    } else if (temp < THRESHOLDS.tempHypothermia) {
      esamos.push('Hipotermija');
      pills.push(classifyPill(`T ${temp.toFixed(1)}°C (žema)`, 'warn'));
    } else {
      pills.push(classifyPill(`T ${temp.toFixed(1)}°C`, 'ok'));
    }
  }

  // ── Pulsas ──
  if (hr != null) {
    if (hr > THRESHOLDS.hrTachy) {
      esamos.push('Tachikardija');
      pills.push(classifyPill(`Pulsas ${hr}/min (tachikardija)`, 'warn'));
    } else if (hr < THRESHOLDS.hrBrady) {
      esamos.push('Bradikardija');
      pills.push(classifyPill(`Pulsas ${hr}/min (bradikardija)`, 'warn'));
    } else {
      pills.push(classifyPill(`Pulsas ${hr}/min`, 'ok'));
    }
  }

  // ── Tracheostoma ──
  if (f['trach'].value === 'taip' &&
      f['sekretas_trach'].value === 'taip' &&
      f['siurbimas'].value === 'taip') {
    esamos.push('Kvėpavimo takai su tracheostominiu vamzdžiu');
  }

  // ── Nosis / dusulys ──
  if (f['nosis'].value === 'tamponuota') {
    esamos.push('Tamponuota nosis');
    galimos.push('Sutrikęs miegas');
  } else if (f['nosis'].value === 'istraukti') {
    esamos.push('Nedidelis kraujavimas iš nosies');
  }
  if (f['dusulys'].value === 'taip') esamos.push('Sutrikusi kvėpavimo funkcija');

  // ── Papildomas O₂ ──
  if (f['o2'] && f['o2'].value === 'taip') esamos.push('Deguonies terapijos poreikis');

  // ── AKS ──
  if (sys != null && dia != null) {
    if (sys < THRESHOLDS.sysLow || (map != null && map < THRESHOLDS.mapLow)) {
      esamos.push('Pažemėjęs kraujo spaudimas');
    }
    if (sys >= THRESHOLDS.sysHigh || dia >= THRESHOLDS.diaHigh) {
      esamos.push('Padidėjęs kraujo spaudimas');
    }
  }
  if (map != null) {
    pills.push(classifyPill(`MAP ${map} mmHg`,
      map < THRESHOLDS.mapLow ? 'bad' : map < (THRESHOLDS.mapLow + 10) ? 'warn' : 'ok'));
  }
  if (sys != null && dia != null) {
    pills.push(classifyPill(`AKS ${sys}/${dia} mmHg`,
      (sys >= THRESHOLDS.sysHigh || dia >= THRESHOLDS.diaHigh) ? 'warn' :
      sys < THRESHOLDS.sysLow ? 'warn' : 'ok'));
  }
  if (highSys30) pills.push(classifyPill(`SYS ${sys} mmHg (≥165) – kas 30 min.`, 'warn'));

  // ── Mityba ──
  const m      = f['mityba'].value;
  const rij    = f['rijimas'].value;
  const suvalgo = f['suvalgo'].value;

  if (m === 'burna') {
    if (rij === 'taip') {
      esamos.push('Rijimo sutrikimas / aspiracijos rizika');
    } else if (suvalgo !== 'taip') {
      esamos.push('Sumažėjęs suvartojamo maisto kiekis');
    }
  } else if (m === 'zondas') {
    esamos.push('Mityba per zondą (NG)');
  } else if (m === 'peg') {
    esamos.push('Mityba per PEG');
  }

  // ── Šalinimas ──
  if (f['kateteris'].value === 'yra') esamos.push('Šlapimo kateteris');
  if (f['slapimo_nelaikymas'] && f['slapimo_nelaikymas'].value === 'taip') esamos.push('Šlapimo nelaikymas');
  if (f['ismatu_nelaikymas'] && f['ismatu_nelaikymas'].value === 'taip')   esamos.push('Išmatų nelaikymas');
  if (f['viduriai'].value === 'taip')      esamos.push('Vidurių užkietėjimas');
  if (f['viduriavimas'].value === 'taip')  esamos.push('Viduriavimas');

  // ── Miegas ──
  if (f['miegas'] && f['miegas'].value === 'sutrikusi') esamos.push('Sutrikęs miegas');

  // ── Judėjimas / pragulos / griuvimai ──
  const bedRest      = (f['mobilumas'].value === 'lova');
  const needHelp     = (f['mobilumas'].value === 'pagalba');
  const hasPressureUlcer = (f['pragulos'].value === 'yra');

  if (needHelp) {
    esamos.push('Judėjimas su pagalba');
    galimos.push('Rizika griuvimui dėl pagalbos poreikio');
  } else if (bedRest) {
    galimos.push('Rizika praguloms dėl lovos režimo');
    galimos.push('Kontraktūrų rizika');
  }
  if (hasPressureUlcer) esamos.push('Pragulos');

  // ── Oda (žaizda) ──
  if (f['zaizdos'].value === 'yra') {
    const apr = (f['zaizdos_text'].value || '').trim();
    esamos.push('Odos vientisumo pažeidimas (žaizda)' + (apr ? (' – ' + apr) : ''));
  }

  // ── Galvos svaigimas ──
  const headSpin = (f['galvos_svaigimas'].value === 'taip');
  let addExtrasForHelpDueToDizziness = false;
  if (headSpin) {
    galimos.push('Rizika griuvimui dėl galvos svaigimo');
    if (needHelp) addExtrasForHelpDueToDizziness = true;
  }

  // ── Psichinė būklė ──
  const pb_ramus  = document.getElementById('ramus')  && document.getElementById('ramus').checked;
  const pb_orient = document.getElementById('orientuotas') && document.getElementById('orientuotas').checked;
  if (!pb_ramus)  galimos.push('Nerimas / neramus');
  if (!pb_orient) galimos.push('Sumišimas');

  const demencija = document.getElementById('demencija');
  if (demencija && demencija.checked) esamos.push('Demencija');

  const agresyvus = document.getElementById('agresyvus');
  if (agresyvus && agresyvus.checked) esamos.push('Agresyvus elgesys');

  const bendradarbiauja = document.getElementById('bendradarbiauja');
  if (bendradarbiauja && !bendradarbiauja.checked) galimos.push('Bendradarbiavimo stoka');

  // ── Skausmas ──
  let painBlock = null;
  if (f['skausmas'].value === 'taip') {
    const val = toNum(f['skausmoLygis'].value);
    if (val == null || val < 0 || val > 10) {
      alert('Įveskite skausmo intensyvumą (0–10).');
      document.getElementById('skausmoLygis').focus();
      return { error: true };
    }
    esamos.push(`Skausmas ${val}/10`);
    let key = null;
    if (val >= 1 && val <= 3) key = 'Nedidelis skausmas (1–3/10)';
    else if (val >= 4 && val <= 6) key = 'Vidutinis skausmas (4–6/10)';
    else if (val >= 7 && val <= 10) key = 'Didelis skausmas (7–10/10)';
    const sev = val >= 7 ? 'bad' : val >= 4 ? 'warn' : 'ok';
    pills.push(classifyPill(`Skausmas ${val}/10`, sev));
    if (key) { painBlock = { score: val, key }; }
  }

  // ── Kraujavimo rizika ──
  if (f['kraujavimo_rizika'].value === 'yra') galimos.push('Kraujavimo rizika');

  return {
    error: false, esamos, galimos, pills,
    vitals: { spo2, temp, sys, dia, hr, map },
    highSys30, painBlock, addExtrasForHelpDueToDizziness
  };
}
