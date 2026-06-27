/* forms.js – formos logika: įvykiai, tikrinimas, reset */

function initForms() {
  // Žaizdos aprašymas
  document.getElementById('zaizdos').addEventListener('change', e => {
    document.getElementById('zaizdos_aprasymas').style.display =
      e.target.value === 'yra' ? 'block' : 'none';
  });

  // Skausmo lygis required
  document.getElementById('skausmas').addEventListener('change', e => {
    document.getElementById('skausmoLygis').toggleAttribute('required', e.target.value === 'taip');
  });

  // Dieta „Kita"
  document.getElementById('dieta_kodas').addEventListener('change', () => {
    document.getElementById('dieta_kita_wrap').style.display =
      document.getElementById('dieta_kodas').value === 'KITA' ? 'block' : 'none';
  });

  // Reset mygtukas
  document.getElementById('resetBtn').addEventListener('click', resetForm);
}

function resetForm() {
  document.forms['nursingForm'].reset();

  const results = document.getElementById('results');
  if (results) results.innerHTML = '';

  ['statusOk', 'statusErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const zaizdosApr = document.getElementById('zaizdos_aprasymas');
  if (zaizdosApr) zaizdosApr.style.display = 'none';

  const dietaKita = document.getElementById('dieta_kita_wrap');
  if (dietaKita) dietaKita.style.display = 'none';

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
