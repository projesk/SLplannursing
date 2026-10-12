/* forms.js – formos logika: įvykiai, tikrinimas, reset */

function initForms() {
  bindVisibilityToggle('zaizdos', 'zaizdos_aprasymas', value => value === 'yra');
  bindVisibilityToggle('pragulos', 'pragulos_detales', value => value === 'yra');
  bindVisibilityToggle('suvarzymas', 'fiksacija_detales', (_value, el) => el.checked, 'change');
  bindVisibilityToggle('griuvimo_ivykis', 'griuvimo_detales', value => value === 'taip');

  const fallEvent = document.getElementById('griuvimo_ivykis');
  const fallTime = document.getElementById('griuvimo_laikas');
  fallEvent.addEventListener('change', () => {
    if (fallEvent.value !== 'taip' || fallTime.value) return;
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    fallTime.value = local.toISOString().slice(0, 16);
  });

  const skausmas = document.getElementById('skausmas');
  const skausmoLygis = document.getElementById('skausmoLygis');
  const updatePainDetails = () => {
    const nrs = toNum(skausmoLygis.value);
    const hasPain = skausmas.value === 'taip' || (nrs != null && nrs > 0);
    document.getElementById('skausmo_detales').style.display = hasPain ? 'block' : 'none';
    skausmoLygis.toggleAttribute('required', skausmas.value === 'taip');
  };
  skausmas.addEventListener('change', updatePainDetails);
  skausmoLygis.addEventListener('input', updatePainDetails);

  // Dieta „Kita"
  document.getElementById('dieta_kodas').addEventListener('change', () => {
    document.getElementById('dieta_kita_wrap').style.display =
      document.getElementById('dieta_kodas').value === 'KITA' ? 'block' : 'none';
  });


  // Reset mygtukas
  document.getElementById('resetBtn').addEventListener('click', resetForm);

  updatePainDetails();
}

function bindVisibilityToggle(controllerId, targetId, predicate, eventName = 'change') {
  const controller = document.getElementById(controllerId);
  const target = document.getElementById(targetId);
  if (!controller || !target) return;

  const update = () => {
    target.style.display = predicate(controller.value, controller) ? 'block' : 'none';
  };

  controller.addEventListener(eventName, update);
  update();
}

function resetForm() {
  document.forms['nursingForm'].reset();

  const results = document.getElementById('results');
  if (results) results.innerHTML = '';

  ['statusOk', 'statusErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  ['zaizdos_aprasymas', 'pragulos_detales', 'skausmo_detales', 'fiksacija_detales', 'griuvimo_detales', 'dieta_kita_wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Skalių rezultatų nuliavimas
  ['bradenResult', 'mustResult', 'morseResult'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  // Globalių skalių kintamųjų nuliavimas
  if (typeof bradenScore !== 'undefined') bradenScore = null;
  if (typeof mustScore   !== 'undefined') mustScore   = null;
  if (typeof morseScore  !== 'undefined') morseScore  = null;

  if (typeof closeDvprs  === 'function') closeDvprs();
  if (typeof closeBraden === 'function') closeBraden();
  if (typeof closeMust   === 'function') closeMust();
  if (typeof closeMorse  === 'function') closeMorse();

  window.reassessmentContextData = null;
  const reassessmentNotice = document.getElementById('reassessmentContext');
  if (reassessmentNotice) reassessmentNotice.hidden = true;
  if (window.history && window.location.search) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  lastPayload = null;
}

function applyReassessmentContext() {
  const params = new URLSearchParams(window.location.search);
  const type = String(params.get('assessment') || '').toUpperCase();
  const openers = { MUST: openMust, BRADEN: openBraden, MORSE: openMorse };
  if (!openers[type]) return;

  const palata = String(params.get('palata') || '').trim();
  const lova = String(params.get('lova') || '').trim();
  const episodeId = String(params.get('episodeId') || '').trim();
  if (palata) document.getElementById('palata').value = palata;
  if (lova) document.getElementById('lova').value = lova;

  window.reassessmentContextData = { type, episodeId };
  const notice = document.getElementById('reassessmentContext');
  notice.hidden = false;
  notice.textContent = `Pakartotinis ${REASSESSMENT_CONFIG[type].label} vertinimas · Palata ${palata || '—'}, lova ${lova || '—'}. Papildomą vertinimą galima atlikti bet kada pasikeitus paciento būklei.`;
  setTimeout(openers[type], 0);
}
