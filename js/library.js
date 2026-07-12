/* library.js – slaugos problemų bibliotekos prieiga
   CARE_LIBRARY_DATA įkeliama iš data/careLibrary.js <script> žymos prieš šį failą. */

function _lib() {
  return (typeof CARE_LIBRARY_DATA !== 'undefined') ? CARE_LIBRARY_DATA : null;
}

function loadLibrary() {
  return _lib(); // suderinimui su app.js iškvietimu
}

function getProblemInterventions(key) {
  const data = _lib();
  if (!data) return [];
  const lib = data.problems;

  // Tikslus atitikimas
  if (lib[key]) return lib[key].interventions || [];

  // Pradžios atitikimas (pvz. "Odos vientisumo pažeidimas (žaizda) – aprašymas")
  const match = Object.keys(lib).find(k => key.startsWith(k));
  if (match) return lib[match].interventions || [];

  return [];
}

function getDietPlan(code) {
  const data = _lib();
  if (!data) return [];
  return (data.dietPlan[code] || []);
}

