/* forms.js – formos logika: įvykiai, tikrinimas, reset */

function initForms() {
  bindVisibilityToggle('zaizdos', 'zaizdos_aprasymas', value => value === 'yra');
  bindVisibilityToggle('pragulos', 'pragulos_detales', value => value === 'yra');
  bindVisibilityToggle('suvarzymas', 'fiksacija_detales', (_value, el) => el.checked, 'change');

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

  ['zaizdos_aprasymas', 'pragulos_detales', 'skausmo_detales', 'fiksacija_detales', 'dieta_kita_wrap'].forEach(id => {
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

  lastPayload = null;
}
