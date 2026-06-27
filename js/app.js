/* app.js – programos paleidimas ir modulių inicijavimas */

document.addEventListener('DOMContentLoaded', () => {
  // Įkelti biblioteką (sinchroniškai iš globalaus kintamojo)
  loadLibrary();

  // Inicijuoti formas
  initForms();

  // DVPRS
  renderDvprs();
  document.getElementById('openDvprsBtn').addEventListener('click', openDvprs);
  document.getElementById('dvprsCloseBtn').addEventListener('click', closeDvprs);
  document.getElementById('dvprsCancelBtn').addEventListener('click', closeDvprs);
  document.getElementById('dvprsCloseBackdrop').addEventListener('click', closeDvprs);

  // Braden
  document.getElementById('openBradenBtn').addEventListener('click', openBraden);

  // MUST
  document.getElementById('openMustBtn').addEventListener('click', openMust);

  // Morse
  document.getElementById('openMorseBtn').addEventListener('click', openMorse);

  // ESC uždaro aktyvų modalą
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('dvprsModal').getAttribute('aria-hidden') === 'false') closeDvprs();
    if (document.getElementById('bradenModal').getAttribute('aria-hidden') === 'false') closeBraden();
    if (document.getElementById('mustModal').getAttribute('aria-hidden') === 'false')   closeMust();
    if (document.getElementById('morseModal').getAttribute('aria-hidden') === 'false')  closeMorse();
  });
});
