/* calculators.js – NEWS2 skaičiavimas */

function toNum(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcMAP(sys, dia) {
  if (sys == null || dia == null) return null;
  return Math.round(((2 * dia) + sys) / 3);
}

function calcNEWS2({ rr, spo2, spo2Scale = '1', onO2, temp, sys, hr, avpu }) {
  let score = 0;
  let hasRedScore = false;
  const missingFields = [];

  function add(points) {
    score += points;
    if (points === 3) hasRedScore = true;
  }

  // Kvėpavimo dažnis
  if (rr == null) missingFields.push('kvėpavimo dažnis');
  else if (rr <= 8)       add(3);
  else if (rr <= 11)      add(1);
  else if (rr <= 20)      add(0);
  else if (rr <= 24)      add(2);
  else                    add(3);

  // SpO₂ (Scale 1 arba Scale 2 pacientams su hiperkapninio kvėpavimo nepakankamumo rizika)
  if (spo2 == null) missingFields.push('SpO₂');
  else if (spo2Scale === '2') {
    if (spo2 <= 83)        add(3);
    else if (spo2 <= 85)   add(2);
    else if (spo2 <= 87)   add(1);
    else if (spo2 <= 92)   add(0);
    else if (!onO2 && spo2 <= 94) add(1);
    else if (!onO2 && spo2 <= 96) add(2);
    else if (!onO2)        add(3);
    else                   add(0);
  } else {
    if (spo2 <= 91)        add(3);
    else if (spo2 <= 93)   add(2);
    else if (spo2 <= 95)   add(1);
    else                   add(0);
  }

  // Papildomas O₂
  if (onO2) add(2);

  // Temperatūra
  if (temp == null) missingFields.push('temperatūra');
  else if (temp <= 35.0)  add(3);
  else if (temp <= 36.0)  add(1);
  else if (temp <= 38.0)  add(0);
  else if (temp <= 39.0)  add(1);
  else                    add(2);

  // AKS sistolinis
  if (sys == null) missingFields.push('sistolinis AKS');
  else if (sys <= 90)     add(3);
  else if (sys <= 100)    add(2);
  else if (sys <= 110)    add(1);
  else if (sys <= 219)    add(0);
  else                    add(3);

  // Pulsas
  if (hr == null) missingFields.push('pulsas');
  else if (hr <= 40)      add(3);
  else if (hr <= 50)      add(1);
  else if (hr <= 90)      add(0);
  else if (hr <= 110)     add(1);
  else if (hr <= 130)     add(2);
  else                    add(3);

  // AVPU / naujai atsiradęs sumišimas
  if (!avpu) missingFields.push('sąmonės būklė');
  else if (avpu !== 'A')  add(3);

  return {
    score,
    hasRedScore,
    hasCritical: hasRedScore, // palikta suderinamumui su esamu kodu
    isComplete: missingFields.length === 0,
    missingFields
  };
}

function news2Text(score, hasRedScore, isComplete = true, missingFields = []) {
  if (!isComplete) {
    return `NEWS2 neapskaičiuotas – trūksta duomenų: ${missingFields.join(', ')}. Užpildykite visus NEWS2 gyvybinius rodiklius, kad nebūtų klaidingai rodoma stabili būklė.`;
  }
  if (score >= 7) {
    return 'aukšta klinikinė rizika. Nedelsiant pranešti gydytojui, reikalingas skubus gydytojo įvertinimas. Reikalinga nuolatinė gyvybinių rodiklių stebėsena.';
  }
  if (score >= 5) {
    return 'vidutinė klinikinė rizika. Skubiai informuoti gydytoją, užtikrinti dažną paciento būklės stebėseną – kas 30–60 min., svarstyti papildomą monitoravimą pagal būklę.';
  }
  if (hasRedScore) {
    return 'žemos–vidutinės rizikos trigeris: yra vienas 3 balų („raudonas“) parametras. Reikėtų įvertinti paciento būklę, informuoti gydytoją ir gyvybinius rodiklius kartoti dažniau – kas 1 val.';
  }
  if (score === 0) {
    return 'paciento būklė stabili. Rekomenduojama tęsti stebėseną ir kartoti gyvybinius rodiklius pagal įprastą skyriaus tvarką.';
  }
  return 'padidinta stebėsena. Rekomenduojama įvertinti bendrą paciento klinikinę būklę ir kartoti gyvybinius rodiklius dažniau kas 4–6 val.';
}

function news2ProblemKey(score, hasRedScore, isComplete = true) {
  if (!isComplete) return null;
  if (score >= 7) return 'NEWS2 ≥7 – didelė klinikinė rizika';
  if (score >= 5) return 'NEWS2 ≥5 – vidutinė klinikinė rizika';
  if (score === 0) return 'NEWS2 0 – stabili būklė';
  return 'NEWS2 1–4 – nedidelė klinikinė rizika';
}
