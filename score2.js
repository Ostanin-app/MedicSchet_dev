// ============================================================================
// SCORE2 / SCORE2-Diabetes / SCORE2-OP — 10-летний риск сердечно-сосудистых
// событий (фатальных + нефатальных) по официальным моделям.
//
// Источники (материалы в папке «Исследования по SCORE2»):
//   SCORE2           — Lancet 2021;397:1645-54 + Updated Supplementary Material
//                      (таблицы 3-4: коэффициенты Log SHR, baseline survival,
//                      калибровка регионов; таблица 2 — контрольный пример).
//   SCORE2-Diabetes  — Eur Heart J 2023;44:2544-56 + appendix_2.xlsx
//                      (рабочий калькулятор авторов: β, взаимодействия,
//                      центрирование, калибровка регионов).
//   SCORE2-OP        — Eur Heart J 2021;42:2439-54 + Supplementary material
//                      (таблицы 1-3: коэффициенты, baseline survival, meanLP,
//                      калибровка регионов, контрольные примеры).
//
// Регион России — «Very high risk region» (ESC 2021).
//
// Общая схема расчёта:
//   1) LP = Σ β·(x − xcen)  [+ взаимодействия с возрастом]
//   2) θorig = 1 − S0^exp(LP − meanLP)      (meanLP = 0 для SCORE2 и SCORE2-Diabetes)
//   3) θ = 1 − exp(−exp(Scale1 + Scale2·ln(−ln(1 − θorig))))   — калибровка региона
//   4) риск (%) = θ × 100
// ============================================================================

// --- Регионы (Gumbel-калибровка Scale1/Scale2), общие для SCORE2 и SCORE2-Diabetes ---
var SCORE2_REGIONS = {
  low:      { m: [-0.5699, 0.7476], f: [-0.7380, 0.7019] },
  moderate: { m: [-0.1565, 0.8009], f: [-0.3143, 0.7701] },
  high:     { m: [ 0.3207, 0.9360], f: [ 0.5710, 0.9369] },
  veryhigh: { m: [ 0.5836, 0.8294], f: [ 0.9412, 0.8329] }
};

// Регионы для SCORE2-OP (отличаются)
var SCORE2OP_REGIONS = {
  low:      { m: [-0.34, 1.19], f: [-0.52, 1.01] },
  moderate: { m: [ 0.01, 1.25], f: [-0.10, 1.10] },
  high:     { m: [ 0.08, 1.15], f: [ 0.38, 1.09] },
  veryhigh: { m: [ 0.05, 0.70], f: [ 0.38, 0.69] }
};

function score2Gumbel(riskOrig, regionTable, sex, region) {
  var sc = regionTable[region][sex === 'f' ? 'f' : 'm'];
  return 1 - Math.exp(-Math.exp(sc[0] + sc[1] * Math.log(-Math.log(1 - riskOrig))));
}

// ============================================================================
// SCORE2 (40-69 лет)
// Коэффициенты: мужчины / женщины (Log SHR из Supplementary Table 3)
// Центрирование: age=60, SBP=120, tchol=6, HDL=1.3; S0 = 0.9605 / 0.9776
// ============================================================================
function score2Calc(age, sex, smoking, sbp, tchol, hdl, diabetes, region) {
  var cage  = (age - 60) / 5;
  var csbp  = (sbp - 120) / 20;
  var ctchol = (tchol - 6);
  var chdl  = (hdl - 1.3) / 0.5;
  var smoke = smoking;   // 0/1 (допускаются доли для групповых примеров)
  var diab  = diabetes;  // 0/1 (допускаются доли для групповых примеров)

  var b;
  if (sex === 'f') {
    b = { age: 0.4648, smoke: 0.7744, sbp: 0.3131, diab: 0.8096, tc: 0.1002, hdl: -0.2606,
          iSmoke: -0.1088, iSbp: -0.0277, iTc: -0.0226, iHdl: 0.0613, iDiab: -0.1272, s0: 0.9776 };
  } else {
    b = { age: 0.3742, smoke: 0.6012, sbp: 0.2777, diab: 0.6457, tc: 0.1458, hdl: -0.2698,
          iSmoke: -0.0755, iSbp: -0.0255, iTc: -0.0281, iHdl: 0.0426, iDiab: -0.0983, s0: 0.9605 };
  }

  var lp = b.age * cage
         + b.tc * ctchol
         + b.hdl * chdl
         + b.sbp * csbp
         + b.diab * diab
         + b.smoke * smoke
         + b.iTc * cage * ctchol
         + b.iHdl * cage * chdl
         + b.iSbp * cage * csbp
         + b.iDiab * cage * diab
         + b.iSmoke * cage * smoke;

  var riskOrig = 1 - Math.pow(b.s0, Math.exp(lp));
  var risk = score2Gumbel(riskOrig, SCORE2_REGIONS, sex, region);
  return { lp: lp, riskOrig: riskOrig, risk: risk * 100 };
}

// ============================================================================
// SCORE2-Diabetes (40-69 лет, пациенты с СД)
// Коэффициенты из appendix_2.xlsx (values-лист; «points» мужчин/женщин)
// Центрирование: age=60, dmAge=50, SBP=120, tchol=6, HDL=1.3, HbA1c=31, ln(eGFR)=4.5
// ============================================================================
function score2DiabetesCalc(age, sex, dmAge, smoking, sbp, tchol, hdl, hba1c, egfr, region) {
  var cAge  = (age - 60) / 5;
  var cDm   = (dmAge - 50) / 5;
  var cSbp  = (sbp - 120) / 20;
  var cTc   = (tchol - 6);
  var cHdl  = (hdl - 1.3) / 0.5;
  var cHbA1c = (hba1c - 31) / 9.34;
  var cEgfr = (Math.log(egfr) - 4.5) / 0.15;
  var smoke = smoking ? 1 : 0;

  var b;
  if (sex === 'f') {
    b = { diab: 0.8096, iDiab: -0.1272, age: 0.6624, dmAge: -0.118,
          smoke: 0.6139, iSmoke: -0.1122, sbp: 0.1421, iSbp: -0.0167,
          tc: 0.1127, iTc: -0.02, hdl: -0.1568, iHdl: 0.0186,
          hba1c: 0.1173, iHbA1c: -0.0196, egfr: -0.064, iEgfr: 0.0169, egfr2: 0.0062,
          s0: 0.9776 };
  } else {
    b = { diab: 0.6457, iDiab: -0.0983, age: 0.5368, dmAge: -0.0998,
          smoke: 0.4774, iSmoke: -0.0672, sbp: 0.1322, iSbp: -0.0268,
          tc: 0.1102, iTc: -0.0181, hdl: -0.1087, iHdl: 0.0095,
          hba1c: 0.0955, iHbA1c: -0.0134, egfr: -0.0591, iEgfr: 0.0115, egfr2: 0.0058,
          s0: 0.9605 };
  }

  // «points» по строкам калькулятора авторов (сумма = LP)
  var pDiab  = b.diab + cAge * b.iDiab + cAge * b.age;   // строка «Age» включает диабет
  var pDmAge = cDm * b.dmAge;
  var pSmoke = smoke ? b.smoke + cAge * b.iSmoke : 0;
  var pSbp   = cSbp * b.sbp + cAge * cSbp * b.iSbp;
  var pTc    = cTc * b.tc + cAge * cTc * b.iTc;
  var pHdl   = cHdl * b.hdl + cAge * cHdl * b.iHdl;
  var pHbA1c = cHbA1c * b.hba1c + cAge * cHbA1c * b.iHbA1c;
  var pEgfr  = cEgfr * b.egfr + cAge * cEgfr * b.iEgfr + cEgfr * cEgfr * b.egfr2;

  var lp = pDiab + pDmAge + pSmoke + pSbp + pTc + pHdl + pHbA1c + pEgfr;
  var riskOrig = 1 - Math.pow(b.s0, Math.exp(lp));
  var risk = score2Gumbel(riskOrig, SCORE2_REGIONS, sex, region);
  return { lp: lp, riskOrig: riskOrig, risk: risk * 100 };
}

// ============================================================================
// SCORE2-OP (70-89 лет)
// Коэффициенты из Supplementary Table 3 (примеры Table 2: baseline survival,
// meanLP). Центрирование: age=73, SBP=150, tchol=6, HDL=1.4.
// S0: мужчины 0.7576, женщины 0.8082; meanLP: 0.0929 / 0.229.
// ============================================================================
function score2opCalc(age, sex, smoking, sbp, tchol, hdl, diabetes, region) {
  var cAge = age - 73;
  var cSbp = sbp - 150;
  var cTc  = tchol - 6;
  var cHdl = hdl - 1.4;
  var smoke = smoking ? 1 : 0;
  var diab  = diabetes ? 1 : 0;

  var b;
  if (sex === 'f') {
    b = { age: 0.0789, diab: 0.6010, smoke: 0.4921, sbp: 0.0102, tc: 0.0605, hdl: -0.3040,
          iDiab: -0.0107, iSmoke: -0.0255, iSbp: -0.0004, iTc: -0.0009, iHdl: 0.0154,
          s0: 0.8082, meanLp: 0.229 };
  } else {
    b = { age: 0.0634, diab: 0.4245, smoke: 0.3524, sbp: 0.0094, tc: 0.0850, hdl: -0.3564,
          iDiab: -0.0174, iSmoke: -0.0247, iSbp: -0.0005, iTc: 0.0073, iHdl: 0.0091,
          s0: 0.7576, meanLp: 0.0929 };
  }

  var lp = b.age * cAge
         + b.diab * diab
         + b.smoke * smoke
         + b.sbp * cSbp
         + b.tc * cTc
         + b.hdl * cHdl
         + b.iDiab * cAge * diab
         + b.iSmoke * cAge * smoke
         + b.iSbp * cAge * cSbp
         + b.iTc * cAge * cTc
         + b.iHdl * cAge * cHdl;

  var riskOrig = 1 - Math.pow(b.s0, Math.exp(lp - b.meanLp));
  var risk = score2Gumbel(riskOrig, SCORE2OP_REGIONS, sex, region);
  return { lp: lp, riskOrig: riskOrig, risk: risk * 100 };
}
