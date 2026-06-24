/** @typedef {'Male' | 'Not_Male'} Sex */
/** @typedef {'Yes' | 'No'} Cancer */
/** @typedef {'1-2' | '3' | '4-5'} Asa */
/** @typedef {'Elective' | 'Urgent'} Urgency */
/** @typedef {'Minor' | 'Intermediate' | 'Major'} Grade */

const MODEL_VERSION = 'ausRisk-demo-1.0';

const MODEL = {
  ageGompertz(age) {
    return Math.log(Math.max(age, 18));
  },
  horizons: {
    m30: {
      intercept: -7.55,
      age_gompertz: 0.5,
      sex: { Male: 0.2, Not_Male: 0 },
      cancer: { Yes: 0.35, No: 0 },
      asa: { '1-2': 0, 3: 0.25, '4-5': 0.5 },
      urgency: { Elective: 0, Urgent: 0.45 },
      specialty: {
        Reference: 0,
        'GI Tract': 0.15,
        Neurosurgery: 0.35,
        Orthopaedic: 0.08,
        Urology: 0.1,
        Vascular: 0.3,
        Cardiothoracic: 0.4,
        Gynaecology: 0.05,
        ENT: 0.04,
        Plastic: 0.08,
      },
      grade: { Minor: 0, Intermediate: 0.18, Major: 0.25 },
    },
    m1y: {
      intercept: -5.9,
      age_gompertz: 0.58,
      sex: { Male: 0.22, Not_Male: 0 },
      cancer: { Yes: 0.45, No: 0 },
      asa: { '1-2': 0, 3: 0.3, '4-5': 0.58 },
      urgency: { Elective: 0, Urgent: 0.52 },
      specialty: {
        Reference: 0,
        'GI Tract': 0.18,
        Neurosurgery: 0.4,
        Orthopaedic: 0.1,
        Urology: 0.12,
        Vascular: 0.35,
        Cardiothoracic: 0.45,
        Gynaecology: 0.06,
        ENT: 0.05,
        Plastic: 0.1,
      },
      grade: { Minor: 0, Intermediate: 0.22, Major: 0.32 },
    },
    m2y: {
      intercept: -5.35,
      age_gompertz: 0.62,
      sex: { Male: 0.24, Not_Male: 0 },
      cancer: { Yes: 0.5, No: 0 },
      asa: { '1-2': 0, 3: 0.32, '4-5': 0.62 },
      urgency: { Elective: 0, Urgent: 0.55 },
      specialty: {
        Reference: 0,
        'GI Tract': 0.2,
        Neurosurgery: 0.42,
        Orthopaedic: 0.12,
        Urology: 0.14,
        Vascular: 0.38,
        Cardiothoracic: 0.48,
        Gynaecology: 0.07,
        ENT: 0.06,
        Plastic: 0.11,
      },
      grade: { Minor: 0, Intermediate: 0.25, Major: 0.36 },
    },
  },
  deciles: {
    m30: [0.001, 0.002, 0.004, 0.006, 0.009, 0.013, 0.018, 0.025, 0.035, 1],
    m1y: [0.01, 0.02, 0.035, 0.05, 0.07, 0.095, 0.12, 0.16, 0.22, 1],
    m2y: [0.015, 0.03, 0.05, 0.07, 0.095, 0.12, 0.15, 0.19, 0.25, 1],
  },
};

function buildLifeTable(sex) {
  const table = {};
  for (let age = 0; age <= 110; age++) {
    if (sex === 'male') {
      if (age < 30) table[age] = 0.0005 + age * 0.00002;
      else if (age < 60) table[age] = 0.001 + (age - 30) * 0.00015;
      else if (age < 80) table[age] = 0.0055 + (age - 60) * 0.0018;
      else table[age] = Math.min(0.35, 0.041 + (age - 80) * 0.025);
    } else {
      if (age < 30) table[age] = 0.0003 + age * 0.000015;
      else if (age < 60) table[age] = 0.0007 + (age - 30) * 0.0001;
      else if (age < 80) table[age] = 0.0035 + (age - 60) * 0.0012;
      else table[age] = Math.min(0.3, 0.027 + (age - 80) * 0.02);
    }
  }
  return table;
}

const LIFE_TABLES = {
  Male: buildLifeTable('male'),
  Not_Male: buildLifeTable('female'),
};

function logOdds(inputs, coeffs) {
  let x = coeffs.intercept;
  x += coeffs.age_gompertz * MODEL.ageGompertz(inputs.age);
  x += coeffs.sex[inputs.sex] ?? 0;
  x += coeffs.cancer[inputs.cancer] ?? 0;
  x += coeffs.asa[inputs.asa] ?? 0;
  x += coeffs.urgency[inputs.urgency] ?? 0;
  x += coeffs.specialty[inputs.specialty] ?? 0;
  x += coeffs.grade[inputs.grade] ?? 0;
  return x;
}

function mortalityPct(lo) {
  return 1 / (1 + Math.exp(-lo));
}

function decile(pct, boundaries) {
  for (let i = 0; i < boundaries.length; i++) {
    if (pct <= boundaries[i]) return i + 1;
  }
  return 10;
}

function lifeExpectancy(age, sex) {
  const qx = LIFE_TABLES[sex] || LIFE_TABLES.Male;
  let years = 0;
  let survival = 1;
  for (let a = age; a <= 110; a++) {
    const q = qx[a] || 1;
    years += survival * (1 - q / 2);
    survival *= 1 - q;
    if (survival < 0.001) break;
  }
  return Math.round(years * 10) / 10;
}

function formatPct(p) {
  if (p < 0.001) return '<0.1%';
  if (p < 0.01) return `${(p * 100).toFixed(2)}%`;
  return `${(p * 100).toFixed(1)}%`;
}

function decileClass(d) {
  if (d <= 3) return 'decile-low';
  if (d <= 7) return 'decile-mid';
  return 'decile-high';
}

function normalizeInputs(raw) {
  const age = parseInt(raw.age, 10);
  if (!age || age < 18 || age > 110) {
    throw new Error('Invalid age. Must be between 18 and 110.');
  }

  const sex = raw.sex === 'Not_Male' ? 'Not_Male' : 'Male';
  const cancer = raw.cancer === 'Yes' ? 'Yes' : 'No';
  const asa = ['1-2', '3', '4-5'].includes(raw.asa) ? raw.asa : '1-2';
  const urgency = raw.urgency === 'Urgent' ? 'Urgent' : 'Elective';
  const grade = ['Minor', 'Intermediate', 'Major'].includes(raw.grade) ? raw.grade : 'Minor';

  const specialties = Object.keys(MODEL.horizons.m30.specialty);
  const specialty = specialties.includes(raw.specialty) ? raw.specialty : 'Reference';

  return {
    recordId: String(raw.recordId || '').trim(),
    age,
    sex,
    cancer,
    asa,
    urgency,
    specialty,
    grade,
    hospital: String(raw.hospital || '').trim(),
    surgeryDate: String(raw.surgeryDate || '').trim(),
  };
}

function calculateRisk(rawInputs) {
  const inputs = normalizeInputs(rawInputs);
  const horizons = {};

  for (const h of ['m30', 'm1y', 'm2y']) {
    const lo = logOdds(inputs, MODEL.horizons[h]);
    const pct = mortalityPct(lo);
    const d = decile(pct, MODEL.deciles[h]);
    horizons[h] = {
      pct,
      pctFormatted: formatPct(pct),
      decile: d,
      decileClass: decileClass(d),
    };
  }

  const lifeExp = lifeExpectancy(inputs.age, inputs.sex);

  const dateStructured = inputs.surgeryDate
    ? new Date(inputs.surgeryDate).toLocaleDateString('en-AU')
    : new Date().toLocaleDateString('en-AU');

  const reportMeta = `Patient Record: ${inputs.recordId || 'N/A'} · Facility: ${inputs.hospital || 'Unspecified'} · Date: ${dateStructured} · Metrics: Age ${inputs.age}, ${inputs.sex === 'Male' ? 'Male' : 'Female/Other'}, ASA ${inputs.asa}, Specialty: ${inputs.specialty}`;

  return {
    modelVersion: MODEL_VERSION,
    inputs,
    results: {
      m30: horizons.m30,
      m1y: horizons.m1y,
      m2y: horizons.m2y,
      lifeExpectancy: lifeExp,
      activeDecile: horizons.m30.decile,
      reportMeta,
    },
  };
}

module.exports = {
  MODEL_VERSION,
  calculateRisk,
  normalizeInputs,
};
