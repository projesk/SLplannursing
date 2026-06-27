/* calculators.js – NEWS2 skaičiavimas */

function toNum(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcMAP(sys, dia) {
  if (sys == null || dia == null) return null;
  return Math.round(((2 * dia) + sys) / 3);
}

function calcNEWS2({ rr, spo2, onO2, temp, sys, hr, avpu }) {
  let score = 0;
  let hasCritical = false;

  // Kvėpavimo dažnis
  if (rr != null) {
    if (rr <= 8)       { score += 3; hasCritical = true; }
    else if (rr <= 11)   score += 1;
    else if (rr <= 20)   score += 0;
    else if (rr <= 24)   score += 2;
    else               { score += 3; hasCritical = true; }
  }

  // SpO2
  if (spo2 != null) {
    if (spo2 <= 91)    { score += 3; hasCritical = true; }
    else if (spo2 <= 93) score += 2;
    else if (spo2 <= 95) score += 1;
  }

  // Papildomas O2
  if (onO2) score += 2;

  // Temperatūra
  if (temp != null) {
    if (temp <= 35.0)  { score += 3; hasCritical = true; }
    else if (temp <= 36.0) score += 1;
    else if (temp <= 38.0) score += 0;
    else if (temp <= 39.0) score += 1;
    else score += 2;
  }

  // AKS sistolinis
  if (sys != null) {
    if (sys <= 90)     { score += 3; hasCritical = true; }
    else if (sys <= 100) score += 2;
    else if (sys <= 110) score += 1;
  }

  // Pulsas
  if (hr != null) {
    if (hr <= 40)      { score += 3; hasCritical = true; }
    else if (hr <= 50)   score += 1;
    else if (hr <= 90)   score += 0;
    else if (hr <= 110)  score += 1;
    else if (hr <= 130)  score += 2;
    else               { score += 3; hasCritical = true; }
  }

  // AVPU
  if (avpu && avpu !== 'A') { score += 3; hasCritical = true; }

  return { score, hasCritical };
}

function news2Text(score, hasCritical) {
  if (score === 0) {
    return 'paciento būklė stabili. Rekomenduojama tęsti stebėseną ir kartoti gyvybinius rodiklius pagal įprastą skyriaus tvarką.';
  }
  if (score >= 7 || hasCritical) {
    return 'aukšta klinikinė rizika. Nedelsiant pranešti gydytojui, reikalingas skubus gydytojo įvertinimas. Reikalinga nuolatinė gyvybinių rodiklių stebėsena.';
  }
  if (score >= 5) {
    return 'vidutinė klinikinė rizika. Skubiai informuoti gydytoją, užtikrinti dažną paciento būklės stebėseną – kas 30–60 min., svarstyti papildomą monitoravimą pagal būklę.';
  }
  if (score >= 4 && hasCritical) {
    return 'Yra bent vienas kritinis (3 balų) parametras – tai rodo galimą paciento būklės blogėjimą. Reikėtų įvertinti paciento būklę ir informuoti gydytoją. Gyvybinių rodiklių stebėjimą kartoti dažniau – kas 1 val.';
  }
  return 'padidinta stebėsena. Rekomenduojama įvertinti bendrą paciento klinikinę būklę ir kartoti gyvybinius rodiklius dažniau kas 4–6 val.';
}

function news2ProblemKey(score, hasCritical) {
  if (score === 0) return 'NEWS2 0 – stabili būklė';
  if (score >= 7 || hasCritical) return 'NEWS2 ≥7 – didelė klinikinė rizika';
  if (score >= 5) return 'NEWS2 ≥5 – vidutinė klinikinė rizika';
  return 'NEWS2 1–4 – nedidelė klinikinė rizika';
}
