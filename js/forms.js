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

  // Pacientas vyksta namo
  function fillDischargeTemplates() {
    const sel = document.getElementById('rekomTemplate');
    if (!sel) return;
    [...sel.querySelectorAll('option')].slice(1).forEach(o => o.remove());
    const templates = getDischargeTemplates();
    if (!Array.isArray(templates)) return;
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
  }

  function toggleDischargeUI() {
    const going = document.getElementById('vykstaNamo').checked === true;
    const box = document.getElementById('namoBox');
    if (box) box.style.display = going ? 'block' : 'none';
  }

  fillDischargeTemplates();
  toggleDischargeUI();
  document.getElementById('vykstaNamo').addEventListener('change', toggleDischargeUI);
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

  if (typeof closeDvprs === 'function') closeDvprs();

  const vn = document.getElementById('vykstaNamo');
  if (vn) vn.checked = false;

  const box = document.getElementById('namoBox');
  if (box) box.style.display = 'none';

  const sel = document.getElementById('rekomTemplate');
  if (sel) sel.value = '';

  lastPayload = null;
}
