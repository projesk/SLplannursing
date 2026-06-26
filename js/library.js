/* library.js – slaugos problemų bibliotekos įkėlimas ir prieiga */

let CARE_LIBRARY = null;

async function loadLibrary() {
  if (CARE_LIBRARY) return CARE_LIBRARY;
  const resp = await fetch('data/careLibrary.json');
  CARE_LIBRARY = await resp.json();
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
