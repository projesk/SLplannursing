/* library.js – slaugos problemų bibliotekos prieiga */

// Inicializuojama iš karto kai skriptas įkeliamas (careLibrary.js turi būti prieš šį failą)
let CARE_LIBRARY = (typeof CARE_LIBRARY_DATA !== 'undefined') ? CARE_LIBRARY_DATA : null;

function loadLibrary() {
  if (!CARE_LIBRARY && typeof CARE_LIBRARY_DATA !== 'undefined') {
    CARE_LIBRARY = CARE_LIBRARY_DATA;
  }
  return CARE_LIBRARY;
}

function getProblemInterventions(key) {
  // Papildomas bandymas įkelti jei dar ne
  if (!CARE_LIBRARY) loadLibrary();
  if (!CARE_LIBRARY) return [];

  const lib = CARE_LIBRARY.problems;

  // Tikslus atitikimas
  if (lib[key]) return lib[key].interventions || [];

  // Pradžios atitikimas (pvz. "Odos vientisumo pažeidimas (žaizda) – lokalizacija...")
  const match = Object.keys(lib).find(k => key.startsWith(k));
  if (match) return lib[match].interventions || [];

  return [];
}

function getDietPlan(code) {
  if (!CARE_LIBRARY) loadLibrary();
  if (!CARE_LIBRARY) return [];
  return (CARE_LIBRARY.dietPlan[code] || []);
}

function getDischargeTemplates() {
  if (!CARE_LIBRARY) loadLibrary();
  if (!CARE_LIBRARY) return [];
  return CARE_LIBRARY.dischargeTemplates || [];
}
