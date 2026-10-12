/* reassessment.js – pakartotinių rizikos vertinimų konfigūracija ir datos */

const REASSESSMENT_CONFIG = Object.freeze({
  MUST: {
    label: 'MUST mitybos rizika',
    intervals: { low: 7, medium: 7, high: 7 },
    pilot: false
  },
  BRADEN: {
    label: 'Braden pragulų rizika',
    intervals: { veryLow: 7, low: 7, medium: 3, high: 1, veryHigh: 1 },
    pilot: true
  },
  MORSE: {
    label: 'Morse griuvimų rizika',
    intervals: { low: 7, medium: 7, high: 7 },
    pilot: true
  }
});

function getScaleRisk(type, score) {
  if (score == null || score === '' || !Number.isFinite(Number(score))) return null;
  const value = Number(score);

  if (type === 'MUST') {
    if (value === 0) return { category: 'low', label: 'Maža rizika' };
    if (value === 1) return { category: 'medium', label: 'Vidutinė rizika' };
    return { category: 'high', label: 'Didelė rizika' };
  }

  if (type === 'BRADEN') {
    if (value <= 9) return { category: 'veryHigh', label: 'Labai didelė rizika' };
    if (value <= 12) return { category: 'high', label: 'Didelė rizika' };
    if (value <= 14) return { category: 'medium', label: 'Vidutinė rizika' };
    if (value <= 18) return { category: 'low', label: 'Maža rizika' };
    return { category: 'veryLow', label: 'Labai maža rizika' };
  }

  if (type === 'MORSE') {
    if (value <= 24) return { category: 'low', label: 'Maža rizika' };
    if (value <= 44) return { category: 'medium', label: 'Vidutinė rizika' };
    return { category: 'high', label: 'Didelė rizika' };
  }

  return null;
}

function toCalendarDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addCalendarDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return toCalendarDate(result);
}

function buildScaleAssessments(scores, performedAt = new Date()) {
  return ['MUST', 'BRADEN', 'MORSE'].flatMap(type => {
    const rawScore = scores[type];
    const risk = getScaleRisk(type, rawScore);
    if (!risk) return [];
    const score = Number(rawScore);

    const config = REASSESSMENT_CONFIG[type];
    const intervalDays = config.intervals[risk.category];
    return [{
      type,
      performedAt: performedAt.toISOString(),
      score,
      riskCategory: risk.category,
      riskLabel: risk.label,
      intervalDays: Number.isInteger(intervalDays) ? intervalDays : null,
      nextDueDate: Number.isInteger(intervalDays) ? addCalendarDays(performedAt, intervalDays) : null,
      reminderStatus: 'completed',
      pilotInterval: Boolean(config.pilot)
    }];
  });
}

function calendarDayNumber(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function getReminderStatus(nextDueDate, now = new Date()) {
  const dueDay = calendarDayNumber(nextDueDate);
  const today = calendarDayNumber(toCalendarDate(now));
  if (dueDay == null || today == null) return { key: 'unknown', label: 'Terminas nenustatytas' };

  const remaining = dueDay - today;
  if (remaining < 0) return { key: 'overdue', label: 'Pradelsta' };
  if (remaining === 0) return { key: 'due', label: 'Reikia atlikti šiandien' };
  if (remaining === 1) return { key: 'upcoming', label: 'Artėja – liko 1 diena' };
  return { key: 'completed', label: 'Atlikta' };
}

function getScaleRecommendation(type, riskCategory) {
  if (type === 'MUST' && riskCategory === 'medium') {
    return 'Rekomenduojama 3 dienas registruoti suvartojamą maistą.';
  }
  if (type === 'MUST' && riskCategory === 'high') {
    return 'Būtina peržiūrėti mitybos priežiūros planą pagal įstaigos tvarką.';
  }
  if (type === 'MORSE') {
    return 'Rizikos balas nėra patikima individualaus griuvimo prognozė.';
  }
  return '';
}
