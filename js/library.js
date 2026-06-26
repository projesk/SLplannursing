/* library.js – slaugos problemų bibliotekos prieiga (sinchroninė) */

let CARE_LIBRARY = null;

function loadLibrary() {
  if (CARE_LIBRARY) return CARE_LIBRARY;
  // CARE_LIBRARY_DATA įkeliamas iš data/careLibrary.js <script> žymos
  if (typeof CARE_LIBRARY_DATA !== 'undefined') {
    CARE_LIBRARY = CARE_LIBRARY_DATA;
  } else {
    console.error('careLibrary.js neįkeltas!');
  }
  return CARE_LIBRARY;
}

function getProblemInterventions(key) {
  if (!CARE_LIBRARY) return [];
  const lib = CARE_LIBRARY.problems;

  // Tikslus atitikimas
  if (lib[key]) return lib[key].interventions || [];

  // Pradžios atitikimas (pvz. "Odos vientisumo pažeidimas (žaizda) – ...")
  const match = Object.keys(lib).find(k => key.startsWith(k));
  if (match) return lib[match].interventions || [];

  return [];
}

function getDietPlan(code) {
  if (!CARE_LIBRARY) return [];
  return (CARE_LIBRARY.dietPlan[code] || []);
}

function getDischargeTemplates() {
  if (!CARE_LIBRARY) return [];
  return CARE_LIBRARY.dischargeTemplates || [];
}
