/* app.js – programos paleidimas ir modulių inicijavimas */

function onReady(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

onReady(async () => {
  // Įkelti biblioteką
  await loadLibrary();

  // Inicijuoti formas
  initForms();

  // DVPRS modalas
  renderDvprs();
  document.getElementById('openDvprsBtn').addEventListener('click', openDvprs);
  document.getElementById('dvprsCloseBtn').addEventListener('click', closeDvprs);
  document.getElementById('dvprsCancelBtn').addEventListener('click', closeDvprs);
  document.getElementById('dvprsCloseBackdrop').addEventListener('click', closeDvprs);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' &&
        document.getElementById('dvprsModal').getAttribute('aria-hidden') === 'false') {
      closeDvprs();
    }
  });

  // Discharge šablonai įkeliami po bibliotekos
  if (typeof fillDischargeTemplatesAfterLoad === 'function') {
    fillDischargeTemplatesAfterLoad();
  }
});
