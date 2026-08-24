// ===================================================
//  CKD-EPI 2021
// ===================================================
function calcCKDEPI(age, sex, creatUmol) {
  var crMg = creatUmol / 88.4;
  var eGFR;
  if (sex === 'f') {
    var kappa = 0.7;
    var alpha = crMg <= kappa ? -0.241 : -1.200;
    eGFR = 142 * Math.pow(crMg / kappa, alpha) * Math.pow(0.9938, age) * 1.012;
  } else {
    var kappa = 0.9;
    var alpha = crMg <= kappa ? -0.302 : -1.200;
    eGFR = 142 * Math.pow(crMg / kappa, alpha) * Math.pow(0.9938, age);
  }
  return Math.round(eGFR * 10) / 10;
}

function ckdStage(egfr) {
  if (egfr >= 90) return { stage: 'G1', stageRu: 'C1', label: 'ХБП С1 (норма или ↑)' };
  if (egfr >= 60) return { stage: 'G2', stageRu: 'C2', label: 'ХБП С2 (незначительно снижена)' };
  if (egfr >= 45) return { stage: 'G3a', stageRu: 'C3а', label: 'ХБП С3а (умеренно снижена)' };
  if (egfr >= 30) return { stage: 'G3b', stageRu: 'C3б', label: 'ХБП С3б (существенно снижена)' };
  if (egfr >= 15) return { stage: 'G4', stageRu: 'C4', label: 'ХБП С4 (тяжело снижена)' };
  return { stage: 'G5', stageRu: 'C5', label: 'ХБП С5 (терминальная)' };
}

// ===================================================
//  КОКРОФТ-ГОЛТ
// ===================================================
function calcCG(age, sex, weight, creatUmol) {
  if (age === null || age >= 140) return null;
  if (weight === null || weight <= 0) return null;
  if (creatUmol === null || creatUmol <= 0) return null;

  var crMg = creatUmol / 88.4;
  var crcl = ((140 - age) * weight) / (72 * crMg);
  if (sex === 'f') crcl *= 0.85;
  if (crcl < 0) return null;
  return Math.round(crcl * 10) / 10;
}

// ===================================================
//  АНТРОПОМЕТРИЯ
// ===================================================
function calcBSA(heightCm, weightKg) {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  return Math.sqrt((heightCm * weightKg) / 3600);
}

function calcIBW(heightCm, sex) {
  if (!heightCm || heightCm <= 0 || !sex) return null;
  var inches = heightCm / 2.54;
  var base = sex === 'f' ? 45.5 : 50;
  var ibw = base + 2.3 * (inches - 60);
  return Math.round(ibw * 10) / 10;
}

function calcABW04(actualWeight, ibw) {
  if (actualWeight === null || actualWeight <= 0 || ibw === null || ibw <= 0) return null;
  if (actualWeight <= ibw) return Math.round(actualWeight * 10) / 10;
  return Math.round((ibw + 0.4 * (actualWeight - ibw)) * 10) / 10;
}

function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

function getWorkingCrClData(age, sex, height, weight, creatUmol) {
  if (age === null || !sex ||
      weight === null || weight <= 0 || creatUmol === null || creatUmol <= 0) {
    return null;
  }

  var tbwCrcl = calcCG(age, sex, weight, creatUmol);
  if (tbwCrcl === null) return null;

  var bmi = calcBMI(weight, height);
  var ibw = calcIBW(height, sex);
  var ibwCrcl = ibw !== null ? calcCG(age, sex, ibw, creatUmol) : null;
  var isOverweightForCg = (bmi !== null && bmi >= 25);
  var abw04 = (isOverweightForCg && ibw !== null && weight > ibw) ? calcABW04(weight, ibw) : null;
  var abwCrcl = abw04 !== null ? calcCG(age, sex, abw04, creatUmol) : null;

  var workingCrcl = tbwCrcl;
  var workingMethodLabel = 'TBW';

  // Рабочий КлКр: по решению врача (25.08.2026):
  // — при ожирении (ИМТ ≥ 30) — скорректированный вес (ABW 0.4);
  // — у остальных — фактический вес (TBW).
  // Идеальный вес (IBW) как «рабочий» НЕ используется автоматически.
  if (bmi !== null && bmi >= 30 && abwCrcl !== null) {
    workingCrcl = abwCrcl;
    workingMethodLabel = 'ABW 0.4';
  }

  return {
    bmi: bmi,
    tbwCrcl: tbwCrcl,
    ibw: ibw,
    ibwCrcl: ibwCrcl,
    abw04: abw04,
    abwCrcl: abwCrcl,
    workingCrcl: workingCrcl,
    workingMethodLabel: workingMethodLabel,
    isOverweightForCg: isOverweightForCg
  };
}

function getCockcroftWeightTooltipText() {
  return 'TBW — фактический вес.\n' +
    'IBW — идеальный вес (формула Devine).\n' +
    'ABW 0.4 — скорректированный вес: IBW + 40% разницы между фактическим и идеальным весом.\n' +
    'IBW–TBW — функциональный диапазон КлКр: от расчёта по идеальному до расчёта по фактическому весу.\n\n' +
    'При избытке массы тела расчёт по фактическому весу может завышать КлКр, потому что вклад жировой ткани в продукцию креатинина минимален.\n\n' +
    'Основано на:\n' +
    'Winter M.A., et al. Pharmacotherapy, 2012. DOI: 10.1002/j.1875-9114.2012.01098.x\n' +
    'Brown D.L., et al. Ann Pharmacother, 2013. DOI: 10.1345/aph.1S176';
}

function getDoacPlanByCrCl(crcl, age, actualWeight, creatUmol, verapamil, hasBledScore) {
  var result = {};

  // Дабигатран
  if (crcl < 30) {
    result.dabigatran = { key: 'contra', text: 'противопоказан', note: '' };
  } else if (crcl < 50) {
    result.dabigatran = { key: '110', text: '110 мг 2 р/д', note: 'КлКр 30–49 мл/мин' };
  } else {
    var dabiReasons = [];
    if (age >= 80) dabiReasons.push('возраст ≥80 лет');
    if (verapamil) dabiReasons.push('приём верапамила');
    if (hasBledScore >= 3) dabiReasons.push('HAS-BLED ≥3');

    if (dabiReasons.length > 0) {
      result.dabigatran = { key: '110', text: '110 мг 2 р/д', note: dabiReasons.join('; ') };
    } else {
      result.dabigatran = { key: '150', text: '150 мг 2 р/д', note: '' };
    }
  }

  // Ривароксабан
  if (crcl < 15) {
    result.rivaroxaban = { key: 'contra', text: 'противопоказан', note: '' };
  } else if (crcl < 50) {
    result.rivaroxaban = { key: '15', text: '15 мг 1 р/д', note: '' };
  } else {
    result.rivaroxaban = { key: '20', text: '20 мг 1 р/д', note: '' };
  }

  // Апиксабан
  var apixCriteriaCount = 0;
  var apixReasons = [];
  if (age >= 80) { apixCriteriaCount++; apixReasons.push('возраст ≥80 лет'); }
  if (actualWeight !== null && actualWeight <= 60) { apixCriteriaCount++; apixReasons.push('вес ≤60 кг'); }
  if (creatUmol !== null && creatUmol >= 133) { apixCriteriaCount++; apixReasons.push('креатинин ≥133 мкмоль/л'); }

  if (crcl < 15) {
    result.apixaban = { key: 'contra', text: 'противопоказан', note: '' };
  } else if (crcl < 30) {
    result.apixaban = { key: '2.5', text: '2,5 мг 2 р/д', note: 'КлКр 15–29 мл/мин' };
  } else if (apixCriteriaCount >= 2) {
    result.apixaban = { key: '2.5', text: '2,5 мг 2 р/д', note: apixReasons.join('; ') };
  } else {
    result.apixaban = { key: '5', text: '5 мг 2 р/д', note: '' };
  }

  return result;
}

function buildSingleCgHint(plan) {
  var dabigatranText = 'Дабигатран: ' + plan.dabigatran.text;
  if (plan.dabigatran.note) dabigatranText += ' (' + plan.dabigatran.note + ')';

  var rivaroxabanText = 'Ривароксабан: ' + plan.rivaroxaban.text;
  if (plan.rivaroxaban.note) rivaroxabanText += ' (' + plan.rivaroxaban.note + ')';

  var apixabanText = 'Апиксабан: ' + plan.apixaban.text;
  if (plan.apixaban.note) apixabanText += ' (' + plan.apixaban.note + ')';

  return dabigatranText + '; ' + rivaroxabanText + '; ' + apixabanText + '.';
}

function buildCgComparisonHint(plansByMethod, workingMethodLabel, workingCrcl) {
  var methodOrder = ['IBW', 'ABW 0.4', 'TBW'];
  var anyDifference = false;

  function buildDrugLine(drugKey, drugLabel) {
    var available = [];
    methodOrder.forEach(function(method) {
      if (plansByMethod[method] && plansByMethod[method][drugKey]) {
        available.push({
          method: method,
          key: plansByMethod[method][drugKey].key,
          text: plansByMethod[method][drugKey].text
        });
      }
    });

    if (available.length === 0) return '';
    if (available.length === 1) {
      return '✅ <strong>' + drugLabel + ':</strong> ' + available[0].text + '.';
    }

    var firstKey = available[0].key;
    var allSame = available.every(function(item) { return item.key === firstKey; });

    if (allSame) {
      return '✅ <strong>' + drugLabel + ':</strong> ' + available[0].text + ' — выбор веса не меняет дозу.';
    }

    anyDifference = true;
    var parts = available.map(function(item) {
      return item.method + ' — ' + item.text;
    });

    return '⚠️ <strong>' + drugLabel + ':</strong> ' + parts.join(' • ') + '.';
  }

  var html =
    '<div style="margin-bottom:6px;">' +
      'Рабочая оценка для дозирования: <strong>' + workingMethodLabel + ' = ' + workingCrcl.toFixed(1) + ' мл/мин</strong>.' +
    '</div>' +
    '<div style="font-size:12px;line-height:1.55;">' +
      '<div style="margin-bottom:4px;">' + buildDrugLine('dabigatran', 'Дабигатран') + '</div>' +
      '<div style="margin-bottom:4px;">' + buildDrugLine('rivaroxaban', 'Ривароксабан') + '</div>' +
      '<div>' + buildDrugLine('apixaban', 'Апиксабан') + '</div>' +
    '</div>';

  if (anyDifference) {
    html +=
      '<div style="margin-top:6px;">' +
        'Доза зависит от выбора веса. Принимайте решение с учётом клиники и риска кровотечения.' +
      '</div>';
  } else {
    html +=
      '<div style="margin-top:6px;">' +
        '✅ Выбор веса не меняет дозирование ПОАК.' +
      '</div>';
  }

  return html;
}

// ===================================================
//  GRACE 1.0
// ===================================================
function calcGRACE(age, hr, sbp, creatUmol, killip, arrest, stDeviation, enzymes) {
  var score = 0;

  if (age < 30) score += 0;
  else if (age <= 39) score += 8;
  else if (age <= 49) score += 25;
  else if (age <= 59) score += 41;
  else if (age <= 69) score += 58;
  else if (age <= 79) score += 75;
  else if (age <= 89) score += 91;
  else score += 100;

  if (hr < 50) score += 0;
  else if (hr <= 69) score += 3;
  else if (hr <= 89) score += 9;
  else if (hr <= 109) score += 15;
  else if (hr <= 149) score += 24;
  else if (hr <= 199) score += 38;
  else score += 46;

  if (sbp < 80) score += 58;
  else if (sbp <= 99) score += 53;
  else if (sbp <= 119) score += 43;
  else if (sbp <= 139) score += 34;
  else if (sbp <= 159) score += 24;
  else if (sbp <= 199) score += 10;
  else score += 0;

  var crMg = creatUmol / 88.4;
  if (crMg < 0.4) score += 1;
  else if (crMg < 0.8) score += 4;
  else if (crMg < 1.2) score += 7;
  else if (crMg < 1.6) score += 10;
  else if (crMg < 2.0) score += 13;
  else if (crMg < 4.0) score += 21;
  else score += 28;

  var killipPts = [0, 0, 20, 39, 59];
  score += killipPts[parseInt(killip)] || 0;

  if (arrest) score += 39;
  if (stDeviation) score += 28;
  if (enzymes) score += 14;

  return score;
}

function graceRisk(score) {
  if (score < 109) return 'low';
  if (score <= 140) return 'moderate';
  return 'high';
}

function graceRiskLabel(score) {
  if (score < 109) return 'Низкий риск';
  if (score <= 140) return 'Умеренный риск';
  return 'Высокий риск';
}

// ===================================================
//  GRACE 2.0
// ===================================================
function calcGRACE2_6month(age, hr, sbp, creatUmol, killip, arrest, stDeviation, enzymes) {
  var crMg = creatUmol / 88.4;

  var xb = -7.7035
           + (0.0531 * age)
           + (0.0087 * hr)
           - (0.0168 * sbp)
           + (0.1823 * crMg)
           + (0.6931 * killip)
           + (1.4586 * (arrest ? 1 : 0))
           + (0.4700 * (stDeviation ? 1 : 0))
           + (0.8755 * (enzymes ? 1 : 0));

  var risk = Math.exp(xb) / (1 + Math.exp(xb)) * 100;
  return Math.round(risk * 10) / 10;
}

// ===================================================
//  CRUSADE
// ===================================================
function calcCRUSADE(hct, cgCrcl, hr, isFemale, hasHF, hasPriorVasc, hasDM, sbp) {
  var score = 0;

  if (hct < 31) score += 9;
  else if (hct < 34) score += 7;
  else if (hct < 37) score += 3;
  else if (hct < 40) score += 2;
  else score += 0;

  if (cgCrcl <= 15) score += 39;
  else if (cgCrcl <= 30) score += 35;
  else if (cgCrcl <= 60) score += 28;
  else if (cgCrcl <= 90) score += 17;
  else if (cgCrcl <= 120) score += 7;
  else score += 0;

  if (hr <= 70) score += 0;
  else if (hr <= 80) score += 1;
  else if (hr <= 90) score += 3;
  else if (hr <= 100) score += 6;
  else if (hr <= 110) score += 8;
  else if (hr <= 120) score += 10;
  else score += 11;

  if (isFemale) score += 8;
  if (hasHF) score += 7;
  if (hasPriorVasc) score += 6;
  if (hasDM) score += 6;

  if (sbp <= 90) score += 10;
  else if (sbp <= 100) score += 8;
  else if (sbp <= 120) score += 5;
  else if (sbp <= 180) score += 1;
  else if (sbp <= 200) score += 3;
  else score += 5;

  return score;
}

function crusadeRisk(score) {
  if (score <= 20) return { risk: 'low', label: 'Очень низкий риск', pct: '~3,1%' };
  if (score <= 30) return { risk: 'low', label: 'Низкий риск', pct: '~5,5%' };
  if (score <= 40) return { risk: 'moderate', label: 'Умеренный риск', pct: '~8,6%' };
  if (score <= 50) return { risk: 'high', label: 'Высокий риск', pct: '~11,9%' };
  return { risk: 'veryhigh', label: 'Очень высокий риск', pct: '~19,5%' };
}

// ===================================================
//  ARC-HBR
// ===================================================
function calcARCHBR() {
  var major = 0, minor = 0;
  var majorIds = ['arc_oac','arc_ckd_major','arc_hb_major','arc_bleed6m','arc_plt',
    'arc_diathesis','arc_cirrhosis','arc_cancer','arc_ich_spont','arc_ich_trauma',
    'arc_avm','arc_stroke_severe','arc_surgery30d','arc_surgery_dapt'];
  var minorIds = ['arc_age75','arc_ckd_minor','arc_hb_minor','arc_bleed12m','arc_nsaid','arc_stroke_any'];

  majorIds.forEach(function(id) { if (cb(id)) major++; });
  minorIds.forEach(function(id) { if (cb(id)) minor++; });

  var isHBR = major >= 1 || minor >= 2;
  return { major: major, minor: minor, isHBR: isHBR };
}

// ===================================================
//  HAS-BLED
// ===================================================
function calcHASBLED() {
  var score = 0;
  var fields = ['hb_htn','hb_renal','hb_liver','hb_stroke','hb_bleed',
                'hb_inr','hb_age','hb_drugs','hb_alcohol'];
  fields.forEach(function(id) { if (cb(id)) score++; });
  return score;
}

function hasbledRisk(score) {
  if (score <= 1) return { risk: 'low', label: 'Низкий риск кровотечения' };
  if (score <= 2) return { risk: 'moderate', label: 'Умеренный риск кровотечения' };
  return { risk: 'high', label: 'Высокий риск кровотечения' };
}

// ===================================================
//  CHA2DS2-VASc
// ===================================================
function calcCHA2DS2VASc(age, sex) {
  var score = 0;
  if (cb('cha_hf')) score += 1;
  if (cb('cha_htn')) score += 1;
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;
  if (cb('cha_dm')) score += 1;
  if (cb('cha_stroke')) score += 2;
  if (cb('cha_vasc')) score += 1;
  if (sex === 'f') score += 1;
  return score;
}

function chaRisk(score, sex) {
  if (sex === 'f') {
    if (score <= 1) return { risk: 'low', label: 'Низкий риск' };
    if (score <= 2) return { risk: 'moderate', label: 'Умеренный риск' };
    return { risk: 'high', label: 'Высокий риск' };
  } else {
    if (score === 0) return { risk: 'low', label: 'Низкий риск' };
    if (score === 1) return { risk: 'moderate', label: 'Умеренный риск' };
    return { risk: 'high', label: 'Высокий риск' };
  }
}

// ===================================================
//  CAPRINI
// ===================================================
function calcCaprini() {
  var score = 0;

  var p1 = ['cap_minor_surgery','cap_varicose','cap_ibd','cap_swollen_legs',
    'cap_acs','cap_sepsis','cap_lung_disease','cap_bedrest',
    'cap_pregnancy','cap_miscarriage','cap_oc','cap_copd'];
  var p1auto = ['cap_age41','cap_obesity','cap_chf'];
  p1.concat(p1auto).forEach(function(id) { if (cb(id)) score += 1; });

  var p2 = ['cap_arthroscopy','cap_cancer','cap_laparoscopy','cap_bedrest72',
    'cap_cast','cap_cvc','cap_open_surgery'];
  var p2auto = ['cap_age61'];
  p2.concat(p2auto).forEach(function(id) { if (cb(id)) score += 2; });

  var p3 = ['cap_dvt_hx','cap_fam_dvt','cap_factor_v','cap_prothrombin',
    'cap_lupus','cap_anticardiolipin','cap_heparin_hit',
    'cap_other_thrombophilia','cap_hyperhomocys'];
  var p3auto = ['cap_age75'];
  p3.concat(p3auto).forEach(function(id) { if (cb(id)) score += 3; });

  var p5 = ['cap_elective_hip','cap_hip_fx','cap_spinal_trauma','cap_stroke_5','cap_multiple_trauma'];
  p5.forEach(function(id) { if (cb(id)) score += 5; });

  return score;
}

function capriniRisk(score) {
  if (score === 0) return { risk: 'low', label: 'Очень низкий риск', pct: '<0,5%', rec: 'Ранняя мобилизация' };
  if (score <= 2) return { risk: 'low', label: 'Низкий риск', pct: '~1,5%', rec: 'Механическая профилактика' };
  if (score <= 4) return { risk: 'moderate', label: 'Умеренный риск', pct: '~3%', rec: 'НМГ в низких дозах или механическая профилактика' };
  if (score <= 9) return { risk: 'high', label: 'Высокий риск', pct: '~6%', rec: 'НМГ в профилактических дозах' };
  return { risk: 'veryhigh', label: 'Очень высокий риск', pct: '>10%', rec: 'НМГ + механическая профилактика, рассмотреть продлённую профилактику' };
}

// ===================================================
//  PESI / sPESI
// ===================================================
function calcPESI() {
  var score = 0;
  var age = parseNum('age');
  var sex = document.getElementById('sex').value;
  var rr = parseNum('pesi_rr');
  var temp = parseNum('pesi_temp');
  var hr = parseNum('hr');
  var sbp = parseNum('sbp');
  var spo2 = parseNum('pesi_spo2');
  var alteredMental = cb('pesi_altered_mental');
  var cancer = cb('pesi_cancer');
  var hf = cb('cb_hf');
  var copd = cb('pesi_copd');

  if (age !== null) score += age;
  if (sex === 'm') score += 10;
  if (cancer) score += 30;
  if (hf) score += 10;
  if (copd) score += 10;
  if (hr !== null && hr >= 110) score += 20;
  if (sbp !== null && sbp < 100) score += 30;
  if (rr !== null && rr >= 30) score += 20;
  if (temp !== null && temp < 36) score += 20;
  if (alteredMental) score += 60;
  if (spo2 !== null && spo2 < 90) score += 20;

  var classRisk = '', mortality = '';
  if (score <= 65)        { classRisk = 'I (очень низкий)';   mortality = '0–1.6%'; }
  else if (score <= 85)   { classRisk = 'II (низкий)';         mortality = '1.7–3.5%'; }
  else if (score <= 105)  { classRisk = 'III (умеренный)';     mortality = '3.2–7.1%'; }
  else if (score <= 125)  { classRisk = 'IV (высокий)';        mortality = '4.0–11.4%'; }
  else                    { classRisk = 'V (очень высокий)';   mortality = '10.0–24.5%'; }

  return { score: score, class: classRisk, mortality: mortality };
}

function calcSPESI() {
  var age = parseNum('age');
  var cancer = cb('pesi_cancer');
  var hf = cb('cb_hf');
  var copd = cb('pesi_copd');
  var hr = parseNum('hr');
  var sbp = parseNum('sbp');
  var spo2 = parseNum('pesi_spo2');

  var points = 0;
  if (age !== null && age > 80) points++;
  if (cancer) points++;
  if (hf || copd) points++;
  if (hr !== null && hr >= 110) points++;
  if (sbp !== null && sbp < 100) points++;
  if (spo2 !== null && spo2 < 90) points++;

  var risk = (points === 0) ? 'Низкий (0 баллов)' : 'Высокий (≥1 балла)';
  var mortality30d = (points === 0) ? '~1.1%' : '~8.9%';
  return { points: points, risk: risk, mortality: mortality30d };
}

// ===================================================
//  WELLS (ТЭЛА)
// ===================================================
function calcWells() {
  var score = 0;
  if (cb('wells_dvt_signs'))  score += 3.0;
  if (cb('wells_alt_diag'))   score += 3.0;
  if (cb('wells_hr'))         score += 1.5;
  if (cb('wells_immob'))      score += 1.5;
  if (cb('wells_prev_dvt'))   score += 1.5;
  if (cb('wells_hemoptysis')) score += 1.0;
  if (cb('wells_cancer'))     score += 1.0;
  return score;
}

function wellsRisk3(score) {
  if (score <= 1)  return { risk: 'low',      label: 'Низкая клиническая вероятность',    pct: '~3–8%' };
  if (score <= 6)  return { risk: 'moderate', label: 'Умеренная клиническая вероятность', pct: '~25–30%' };
  return             { risk: 'high',     label: 'Высокая клиническая вероятность',  pct: '~60–80%' };
}

function wellsRisk2(score) {
  if (score <= 4) return { label: 'ТЭЛА маловероятна', likely: false };
  return            { label: 'ТЭЛА вероятна',       likely: true };
}

// ===================================================
//  REVISED GENEVA
// ===================================================
function calcGeneva() {
  var score = 0;
  if (cb('geneva_age'))        score += 1;
  if (cb('geneva_prev_dvt'))   score += 3;
  if (cb('geneva_surgery'))    score += 2;
  if (cb('geneva_cancer'))     score += 2;
  if (cb('geneva_leg_pain'))   score += 3;
  if (cb('geneva_hemoptysis')) score += 2;
  if (cb('geneva_hr95'))       score += 5;
  else if (cb('geneva_hr75'))  score += 3;
  if (cb('geneva_dvt_signs'))  score += 4;
  return score;
}

function genevaRisk3(score) {
  if (score <= 3)  return { risk: 'low',      label: 'Низкая клиническая вероятность',    pct: '~8%' };
  if (score <= 10) return { risk: 'moderate', label: 'Умеренная клиническая вероятность', pct: '~29%' };
  return             { risk: 'high',     label: 'Высокая клиническая вероятность',  pct: '~74%' };
}

function genevaRisk2(score) {
  if (score <= 5) return { label: 'ТЭЛА маловероятна', likely: false };
  return            { label: 'ТЭЛА вероятна',       likely: true };
}

// ===================================================
//  ДИНАМИЧЕСКОЕ СКРЫТИЕ ПОЛЕЙ
// ===================================================
function updateFieldVisibility() {
  var active = {
    ckdepi:  isScaleActive('ckdepi'),
    cg:      isScaleActive('cg'),
    grace:   isScaleActive('grace'),
    crusade: isScaleActive('crusade'),
    archbr:  isScaleActive('archbr'),
    hasbled: isScaleActive('hasbled'),
    cha2ds2: isScaleActive('cha2ds2'),
    caprini: isScaleActive('caprini'),
    pesi:    isScaleActive('pesi'),
    wells:   isScaleActive('wells'),
    geneva:  isScaleActive('geneva'),
    precise: isScaleActive('precise'),
    score2:  isScaleActive('score2')
  };

  function setVisible(className, condition) {
    var elements = document.querySelectorAll('.' + className);
    elements.forEach(function(el) {
      el.style.display = condition ? '' : 'none';
    });
  }

  var anyScale = active.ckdepi || active.cg || active.grace || active.crusade ||
                 active.archbr || active.hasbled || active.cha2ds2 || active.caprini ||
                 active.pesi || active.wells || active.geneva || active.precise || active.score2;
  var needAge    = anyScale;
  var noScaleHint = document.getElementById('noScaleHint');
  if (noScaleHint) noScaleHint.style.display = anyScale ? 'none' : '';
  var needSex    = active.ckdepi || active.cg || active.crusade || active.archbr || active.cha2ds2 || active.pesi || active.precise || active.score2;
  var needHeight = active.cg || active.caprini || active.crusade;
  var needWeight = active.cg || active.caprini || active.crusade || active.precise;
  var needSBP    = active.grace || active.crusade || active.hasbled || active.pesi || active.score2;
  var needHR     = active.grace || active.crusade || active.pesi || active.wells || active.geneva;
  var needCreat  = active.ckdepi || active.cg || active.grace || active.archbr || active.hasbled || active.crusade || active.precise || active.score2;
  var needHB     = active.archbr || active.precise;
  var needHCT    = active.crusade;
  var needPLT    = active.archbr;

  var needDM       = active.crusade || active.cha2ds2 || active.score2;
  var needHF       = active.crusade || active.cha2ds2 || active.caprini || active.pesi;
  var needHTN      = active.cha2ds2;
  var needStroke   = active.hasbled || active.cha2ds2;
  var needEmb      = active.cha2ds2;
  var needVte      = active.caprini || active.wells || active.geneva;
  var needVasc     = active.crusade || active.cha2ds2;
  var needVerapamil = active.cg;

  // Поля модуля «СС-риск и липиды»: HbA1c и возраст дебюта СД видны только при диабете
  var dmChecked = !!document.getElementById('cb_dm') && document.getElementById('cb_dm').checked;
  var needHba1c = active.score2 && dmChecked;
  var needDmAge = active.score2 && dmChecked;

  setVisible('field-age',      needAge);
  setVisible('field-sex',      needSex);
  setVisible('field-height',   needHeight);
  setVisible('field-weight',   needWeight);
  setVisible('field-sbp',      needSBP);
  setVisible('field-hr',       needHR);
  setVisible('field-creat',    needCreat);
  setVisible('field-hb',       needHB);
  setVisible('field-hct',      needHCT);
  setVisible('field-plt',      needPLT);

  setVisible('field-dm',       needDM);
  setVisible('field-hf',       needHF);
  setVisible('field-htn',      needHTN);
  setVisible('field-stroke',   needStroke);
  setVisible('field-embolism', needEmb);
  setVisible('field-vte',      needVte);
  setVisible('field-vasc',     needVasc);
  setVisible('field-verapamil', needVerapamil);
  // Чекбоксы, используемые только в поликлиническом режиме (модуль СС-риск и липиды)
  var isOutpatient = (typeof getCurrentMode === 'function') && getCurrentMode() === 'outpatient';
  setVisible('field-mi',       isOutpatient && anyScale);
  setVisible('field-sghs',     isOutpatient && anyScale);
  setVisible('field-fh-cvd',   isOutpatient && anyScale);
  setVisible('field-fh-lip',   isOutpatient && anyScale);
  setVisible('field-asb50',    isOutpatient && anyScale);
  setVisible('field-ath25',    isOutpatient && anyScale);
  setVisible('field-gosghs',   isOutpatient && anyScale);
  setVisible('field-dm-tod',   isOutpatient && anyScale);

  // Внутри блока SCORE2: HbA1c и дебют СД — только при отмеченном диабете
  setVisible('field-hba1c',    needHba1c);
  setVisible('field-dm-age',   needDmAge);
  setVisible('field-dm-age20', needDmAge);

  // «Длительность СД ≥ 20 лет» гасит поле «Возраст дебюта СД»
  var dmAgeEl = document.getElementById('dm_age');
  var dmAge20El = document.getElementById('dm_age20');
  if (dmAgeEl && dmAge20El) dmAgeEl.disabled = !!dmAge20El.checked;

  var anyCheckboxVisible = needDM || needHF || needHTN || needStroke || needEmb || needVte || needVasc || needVerapamil || (isOutpatient && anyScale);
  var divider = document.querySelector('.divider');
  if (divider) divider.style.display = anyCheckboxVisible ? '' : 'none';
}

// ===================================================
//  ОНКОЛОГИЯ: авто-связи Wells/Geneva/ARC-HBR → PESI/Caprini
// ===================================================
// «Узкие» шкалы означают активный рак (лечение сейчас/за 6 мес,
// активное сейчас, активное за 12 мес). Если отмечена хоть одна из них,
// «широкие» шкалы — PESI («активное или в анамнезе») и Caprini
// («настоящее или прошлое») — выполняются точно, поэтому приёмники
// отмечаются автоматически.
// Обратное НЕВЕРНО: «рак в анамнезе» не означает «активный сейчас»,
// поэтому приёмники источники не включают (там только подсказки ⚠️).
//
// Защита ручной отметки: если приёмник уже отмечен вручную — его не
// трогаем (не вешаем метку «авто» и не сбрасываем при снятии источников).
// Авто-состояние хранится в data-атрибуте el.dataset.cancerAuto и
// переносится в снимки undo / автосохранение, чтобы пережить
// перезагрузку страницы и отмену изменений (иначе после reload
// приёмник стал бы считаться «ручным» и не сбрасывался бы).
function applyCancerAuto() {
  // Сначала Geneva как приёмник от ARC-HBR (авто-связь ARC → Geneva).
  // ВАЖНО: Geneva имеет двойную роль — приёмник от ARC и источник для
  // PESI/Caprini. Обрабатываем её ДО вычисления cancerActive, иначе при
  // снятии ARC-HBR ещё отмеченная авто-Geneva «поддержит» PESI/Caprini
  // и они не сбросятся (баг «застрявших» авто-отметок).
  setCancerAuto(document.getElementById('geneva_cancer'), cb('arc_cancer'), 'auto-cb');

  // «Широкие» приёмники PESI/Caprini: отмечаются, если рак активен
  // (отмечена хотя бы одна «узкая» шкала — уже в актуальном состоянии).
  var cancerActive = cb('wells_cancer') || cb('geneva_cancer') || cb('arc_cancer');
  setCancerAuto(document.getElementById('pesi_cancer'), cancerActive, 'auto-filled');
  setCancerAuto(document.getElementById('cap_cancer'),  cancerActive, 'auto-cb');
}

// Общая логика авто-включения приёмника онкологии:
// active — следует ли отметить автоматически; autoClass — класс жёлтой
// метки (auto-filled для карточек PESI, auto-cb для остальных шкал).
// Защита ручной отметки: если приёмник уже отмечен вручную — не трогаем
// (не вешаем метку «авто» и не сбрасываем при снятии источников).
// Авто-состояние хранится в data-атрибуте el.dataset.cancerAuto и
// переносится в снимки undo / автосохранение, чтобы пережить
// перезагрузку страницы и отмену изменений (иначе после reload
// приёмник стал бы считаться «ручным» и не сбрасывался бы).
function setCancerAuto(el, active, autoClass) {
  if (!el) return;
  var label = el.closest('label');
  if (!label) return;
  var wasAuto = label.classList.contains(autoClass) || el.dataset.cancerAuto === '1';

  if (active) {
    if (!el.checked) {
      // Приёмник выключен — включаем автоматически
      el.checked = true;
      flashField(el);
      label.classList.add(autoClass);
      addCancerAutoTag(label);
      el.dataset.cancerAuto = '1';
    } else if (wasAuto) {
      // Отмечен и был авто (например, класс слетел после перезагрузки
      // страницы) — восстанавливаем метку «авто» и data-флаг
      label.classList.add(autoClass);
      addCancerAutoTag(label);
      el.dataset.cancerAuto = '1';
    }
    // Если приёмник отмечен вручную — не трогаем (остаётся ручным).
  } else {
    if (wasAuto) {
      // Источники сняты — авто-отметка снимается, приёмник снова ручной
      el.checked = false;
      label.classList.remove(autoClass);
      removeCancerAutoTag(label);
      delete el.dataset.cancerAuto;
    }
    // Ручные отметки не трогаем.
  }
}

// Жёлтая метка «авто» на карточке-чекбоксе (перед .pts или в .cb-label)
function addCancerAutoTag(label) {
  if (label.querySelector('.auto-tag')) return;
  var span = document.createElement('span');
  span.className = 'auto-tag';
  span.textContent = 'авто';
  var pts = label.querySelector('.pts');
  if (pts) {
    label.insertBefore(span, pts);
  } else {
    var cbLabel = label.querySelector('.cb-label');
    if (cbLabel) cbLabel.appendChild(span);
    else label.appendChild(span);
  }
}

function removeCancerAutoTag(label) {
  var tag = label.querySelector('.auto-tag');
  if (tag) tag.remove();
}

// Подсказки в обратную сторону: если «рак в анамнезе» отмечен вручную
// в PESI/Caprini, а ни одна из «узких» шкал (активный рак) не отмечена —
// показываем у Wells/Geneva/ARC-HBR иконку ⚠️ с индивидуальной подсказкой
// под критерий каждой шкалы (простые формулировки, без дословных копий).
// Дополнительно: уведомления между «узкими» шкалами — когда отмечена одна
// узкая шкала, а у другой критерий может выполняться (но не гарантирован),
// поэтому автоотметки нет — только напоминание врачу.
// Пункты НЕ отмечаем автоматически — это решает врач.
function updateCancerWarnings() {
  var wideChecked = cb('pesi_cancer') || cb('cap_cancer');
  var narrowChecked = cb('wells_cancer') || cb('geneva_cancer') || cb('arc_cancer');

  var texts = {
    'wells_cancer_warning': null,
    'geneva_cancer_warning': null,
    'arc_cancer_warning': null
  };

  // «Рак в анамнезе»: PESI/Caprini отмечены, ни одна узкая шкала не отмечена
  if (wideChecked && !narrowChecked) {
    texts['wells_cancer_warning'] = 'Рак в анамнезе. Отметьте в Wells, если рак лечится сейчас, лечился в последние полгода или назначена паллиативная помощь.';
    texts['geneva_cancer_warning'] = 'Рак в анамнезе. Отметьте в Geneva, если рак активен сейчас или считается излеченным меньше года назад.';
    texts['arc_cancer_warning'] = 'Рак в анамнезе. Отметьте в ARC-HBR, если рак был активен в последние 12 месяцев (кроме немеланомного рака кожи).';
  }

  // ARC-HBR отмечен → Wells: Wells требует лечения, автоотметка небезопасна
  if (cb('arc_cancer') && !cb('wells_cancer')) {
    texts['wells_cancer_warning'] = 'В оригинальных источниках (Wells 2000, NICE 2020) критерий сформулирован как: "Malignancy (on treatment, treated in the last 6 months, or palliative)". Это означает, что пункт применяется при наличии активного противоопухолевого лечения (включая паллиативное) в настоящее время или в течение последних 6 месяцев.';
  }

  // Wells отмечен → Geneva
  if (cb('wells_cancer') && !cb('geneva_cancer')) {
    texts['geneva_cancer_warning'] = 'Отмечено в Wells. Если заболевание активно сейчас или считается излеченным менее года назад, отметьте Geneva.';
  }

  // Geneva отмечена → ARC-HBR (ARC-HBR исключает немеланомный рак кожи,
  // поэтому автоотметка небезопасна)
  if (cb('geneva_cancer') && !cb('arc_cancer')) {
    texts['arc_cancer_warning'] = 'Критерий ARC-HBR: активное злокачественное новообразование (кроме немеланомного рака кожи) за последние 12 месяцев. Отметьте, если это выполняется.';
  }

  // Только Wells отмечен → ARC-HBR
  if (cb('wells_cancer') && !cb('geneva_cancer') && !cb('arc_cancer')) {
    texts['arc_cancer_warning'] = 'Отмечено в Wells. Если диагноз установлен в последние 12 месяцев или лечение проводится сейчас, отметьте ARC-HBR.';
  }

  Object.keys(texts).forEach(function(id) {
    var icon = document.getElementById(id);
    if (!icon) return;
    if (texts[id]) {
      icon.style.display = 'inline';
      setupTooltipTrigger(icon, texts[id]);
    } else {
      icon.style.display = 'none';
    }
  });
}

// ===================================================
//  ХОБЛ: авто-связь Caprini → PESI
// ===================================================
// Caprini «ХОБЛ» (узкий критерий) входит в PESI «Хроническое заболевание
// лёгких / ХОБЛ» (широкий критерий): ХОБЛ — всегда хроническое заболевание
// лёгких, поэтому отметка в Caprini автоматически отмечает PESI.
// Обратное НЕВЕРНО (астма и др. — не ХОБЛ), поэтому при ручной отметке
// PESI показываем у Caprini подсказку ⚠️ — решает врач.
// Персистинг авто-состояния — тот же паттерн, что у онкологии.
function syncCopdAuto() {
  // Авто-отметка PESI от Caprini (класс auto-filled — карточка PESI .cb-item)
  setCancerAuto(document.getElementById('pesi_copd'), cb('cap_copd'), 'auto-filled');

  // Подсказка у Caprini: PESI отмечен вручную, а Caprini нет
  var icon = document.getElementById('cap_copd_warning');
  if (icon) {
    if (cb('pesi_copd') && !cb('cap_copd')) {
      icon.style.display = 'inline';
      setupTooltipTrigger(icon, 'В PESI отмечено хроническое заболевание лёгких. Если у пациента именно ХОБЛ — отметьте в Caprini.');
    } else {
      icon.style.display = 'none';
    }
  }
}

// ===================================================
//  ПРИЗНАКИ ТГВ → «Отёчность ног» Caprini
// ===================================================
// «Клинические признаки ТГВ» (Wells) или «боль при пальпации глубоких вен
// и односторонний отёк» (Geneva) включают отёк ноги — поэтому Caprini
// «Отёчность ног в настоящее время» выполняется точно: авто-отметка.
// Обратное НЕВЕРНО (простой отёк без боли при пальпации ≠ ТГВ), поэтому
// Caprini на Wells/Geneva не влияет (только однонаправленно).
// Персистинг авто-состояния — тот же паттерн, что у онкологии/ХОБЛ.
function syncDvtEdemaAuto() {
  var dvtSigns = cb('wells_dvt_signs') || cb('geneva_dvt_signs');
  setCancerAuto(document.getElementById('cap_swollen_legs'), dvtSigns, 'auto-cb');
}

// ===================================================
//  ПОСТЕЛЬНЫЙ РЕЖИМ → «Иммобилизация» Wells
// ===================================================
// Caprini «Постельный режим >72 ч» — это иммобилизация ≥3 дней, ровно
// критерий Wells «Иммобилизация ≥3 дней или операция за 4 недели»:
// авто-отметка Wells.
// Обратное НЕВЕРНО: иммобилизация в Wells (гипс, операция — пациент
// может ходить) не означает постельного режима в Caprini, поэтому
// обратной связи и подсказок нет.
// Персистинг авто-состояния — тот же паттерн, что у остальных связок.
function syncBedrestAuto() {
  setCancerAuto(document.getElementById('wells_immob'), cb('cap_bedrest72'), 'auto-cb');
}

// ===================================================
//  ЦИРРОЗ ПЕЧЕНИ → «Нарушение функции печени» HAS-BLED
// ===================================================
// ARC-HBR «Цирроз печени с портальной гипертензией» входит в HAS-BLED
// «Нарушение функции печени (цирроз, или билирубин >2N с ферментами >3N)»
// как первое условие — авто-отметка HAS-BLED.
// Обратное НЕВЕРНО: в HAS-BLED пункт может стоять из-за изолированного
// повышения ферментов/билирубина без цирроза — ARC-HBR не трогаем
// (обратной связи и подсказок нет).
// Персистинг авто-состояния — тот же паттерн, что у остальных связок.
function syncCirrhosisAuto() {
  setCancerAuto(document.getElementById('hb_liver'), cb('arc_cirrhosis'), 'auto-cb');
}

// ===================================================
//  AUTOFILL
// ===================================================
function autofill() {
  var age    = parseNum('age');
  var sex    = document.getElementById('sex').value;
  var sbp    = parseNum('sbp');
  var hb     = parseNum('hb');
  var plt    = parseNum('plt');
  var weight = parseNum('weight');
  var height = parseNum('height');
  var creat  = parseNum('creatinine');
  var hr     = parseNum('hr');

  var prevSkipUndo = skipUndo;
  skipUndo = true;

  var egfr = null;
  if (age && creat && sex) {
    egfr = calcCKDEPI(age, sex, creat);
  }

  // ARC-HBR auto
  if (age !== null) {
    var isAge75 = age >= 75;
    var arcAge75 = document.getElementById('arc_age75');
    arcAge75.checked = isAge75;
    if (isAge75) flashField(arcAge75);
    document.getElementById('arc_age75_row').classList.toggle('auto-cb', isAge75);
  }

  if (egfr !== null) {
    var majorCkd = document.getElementById('arc_ckd_major');
    var minorCkd = document.getElementById('arc_ckd_minor');
    majorCkd.checked = egfr < 30;
    minorCkd.checked = egfr >= 30 && egfr < 60;
    if (egfr < 30) flashField(majorCkd);
    if (egfr >= 30 && egfr < 60) flashField(minorCkd);
  }

  if (hb !== null) {
    var hbMajor = document.getElementById('arc_hb_major');
    var hbMinor = document.getElementById('arc_hb_minor');
    hbMajor.checked = hb < 110;
    var isHbMinor = sex === 'm' ? (hb >= 110 && hb < 130) : (hb >= 110 && hb < 120);
    hbMinor.checked = isHbMinor;
    if (hb < 110) flashField(hbMajor);
    if (isHbMinor) flashField(hbMinor);
  }

  if (plt !== null) {
    var arcPlt = document.getElementById('arc_plt');
    arcPlt.checked = plt < 100;
    if (plt < 100) flashField(arcPlt);
  }

  // HAS-BLED auto
  if (sbp !== null) {
    var hbHtn = document.getElementById('hb_htn');
    hbHtn.checked = sbp > 160;
    if (sbp > 160) flashField(hbHtn);
  }

  if (age !== null) {
    var hbAge = document.getElementById('hb_age');
    hbAge.checked = age > 65;
    if (age > 65) flashField(hbAge);
  }

  setCb('hb_stroke', cb('cb_stroke'));
  if (cb('cb_stroke')) flashField(document.getElementById('hb_stroke'));

  // CHA2DS2-VASc auto
  setCb('cha_hf', cb('cb_hf'));
  if (cb('cb_hf')) flashField(document.getElementById('cha_hf'));
  setCb('cha_htn', cb('cb_htn'));
  if (cb('cb_htn')) flashField(document.getElementById('cha_htn'));
  setCb('cha_dm', cb('cb_dm'));
  if (cb('cb_dm')) flashField(document.getElementById('cha_dm'));
  setCb('cha_stroke', cb('cb_stroke') || cb('cb_tia') || cb('cb_embolism'));
  if (cb('cb_stroke') || cb('cb_tia') || cb('cb_embolism')) flashField(document.getElementById('cha_stroke'));
  setCb('cha_vasc', cb('cb_vasc'));
  if (cb('cb_vasc')) flashField(document.getElementById('cha_vasc'));

  if (age !== null) {
    var cha75 = document.getElementById('cha_age75');
    var cha65 = document.getElementById('cha_age65');
    cha75.checked = age >= 75;
    cha65.checked = age >= 65 && age < 75;
    if (age >= 75) flashField(cha75);
    if (age >= 65 && age < 75) flashField(cha65);
  }

  if (sex) {
    var chaFemale = document.getElementById('cha_female');
    chaFemale.checked = sex === 'f';
    if (sex === 'f') flashField(chaFemale);
  }

  // CRUSADE auto
  setCb('crusade_hf', cb('cb_hf'));
  setCb('crusade_vasc', cb('cb_vasc'));
  setCb('crusade_dm', cb('cb_dm'));

  if (sex === 'f') {
    var crusadeFemale = document.getElementById('crusade_female');
    crusadeFemale.checked = true;
    flashField(crusadeFemale);
    document.getElementById('crusade_auto_sex_row').style.display = '';
  } else {
    document.getElementById('crusade_female').checked = false;
    document.getElementById('crusade_auto_sex_row').style.display = 'none';
  }

  // Caprini auto
  if (age !== null) {
    var cap41 = document.getElementById('cap_age41');
    var cap61 = document.getElementById('cap_age61');
    var cap75 = document.getElementById('cap_age75');
    cap41.checked = age >= 41 && age <= 60;
    cap61.checked = age >= 61 && age <= 74;
    cap75.checked = age >= 75;
    if (age >= 41 && age <= 60) flashField(cap41);
    if (age >= 61 && age <= 74) flashField(cap61);
    if (age >= 75) flashField(cap75);
  }

  if (weight !== null && height !== null && height > 0) {
    var bmi = weight / Math.pow(height / 100, 2);
    var capObesity = document.getElementById('cap_obesity');
    capObesity.checked = bmi > 25;
    if (bmi > 25) flashField(capObesity);
  }

  setCb('cap_chf', cb('cb_hf'));
  if (cb('cb_hf')) flashField(document.getElementById('cap_chf'));

  // Caprini «ТГВ / ТЭЛА в анамнезе» — автозаполняется из общего чекбокса ВТЭО.
  // ВНИМАНИЕ: «Инсульт (давностью до 1 мес.)» (cap_stroke_5) НЕ автозаполняется —
  // нужна давность < 1 мес., её нет в общих данных; отмечается вручную.
  setCb('cap_dvt_hx', cb('cb_vte'));
  if (cb('cb_vte')) flashField(document.getElementById('cap_dvt_hx'));

  // Wells и Женева: «ТГВ или ТЭЛА в анамнезе» — из общего чекбокса ВТЭО
  setCb('wells_prev_dvt', cb('cb_vte'));
  if (cb('cb_vte')) flashField(document.getElementById('wells_prev_dvt'));
  setCb('geneva_prev_dvt', cb('cb_vte'));
  if (cb('cb_vte')) flashField(document.getElementById('geneva_prev_dvt'));

  // GRACE → Caprini предупреждение
  var capAcsWarningIcon = document.getElementById('cap_acs_warning');
  if (capAcsWarningIcon) {
    if (isScaleActive('grace') && cb('grace_enzymes')) {
      var warningText = 'В GRACE отмечено повышение кардиоспецифических маркёров. Уточните диагноз ОИМ и при необходимости отметьте критерий.';
      capAcsWarningIcon.style.display = 'inline';
      setupTooltipTrigger(capAcsWarningIcon, warningText);
    } else {
      capAcsWarningIcon.style.display = 'none';
    }
  }

  // Caprini «Инсульт (давностью до 1 мес.)»: если в общих данных отмечен
  // инсульт (ТИА не триггерит — пункт про инсульт) — показываем уведомление,
  // но пункт НЕ автозаполняем (нужна давность < 1 мес.), врач отмечает его
  // вручную при необходимости.
  var capStrokeWarning = document.getElementById('cap_stroke_warning');
  if (capStrokeWarning) {
    if (cb('cb_stroke')) {
      capStrokeWarning.style.display = 'inline';
      setupTooltipTrigger(capStrokeWarning, 'Инсульт отмечен в общих данных. Уточните давность: если < 1 мес., отметьте пункт вручную.');
    } else {
      capStrokeWarning.style.display = 'none';
    }
  }

  // HAS-BLED критерий B (анемия/тромбоцитопения)
  var hbValue   = hb;
  var pltValue  = plt;
  var sexValue  = sex;

  var isAnemiaAuto = false;
  var isAnemiaWarn = false;
  var isPltAuto    = false;
  var isPltWarn    = false;

  if (hbValue !== null) {
    var hbThreshold = 100;
    var hbWarnHigh  = (sexValue === 'm') ? 129 : 119;
    if (hbValue < hbThreshold) {
      isAnemiaAuto = true;
    } else if (hbValue >= hbThreshold && hbValue <= hbWarnHigh) {
      isAnemiaWarn = true;
    }
  }

  if (pltValue !== null) {
    if (pltValue < 50) {
      isPltAuto = true;
    } else if (pltValue >= 50 && pltValue < 100) {
      isPltWarn = true;
    }
  }

  var bothWarn  = (isAnemiaWarn && isPltWarn);
  var autoCheck = isAnemiaAuto || isPltAuto || bothWarn;
  var showWarning = (isAnemiaWarn || isPltWarn) && !autoCheck;

  var hbBleedCheckbox  = document.getElementById('hb_bleed');
  var warningIcon      = document.getElementById('hb_bleed_warning');
  var labelContainer   = document.getElementById('hb_bleed_label');

  if (hbBleedCheckbox) {
    var wasAuto = labelContainer && labelContainer.classList.contains('auto-cb');

    if (autoCheck) {
      hbBleedCheckbox.checked = true;
      flashField(hbBleedCheckbox);
      if (labelContainer) {
        labelContainer.classList.add('auto-cb');
        if (!labelContainer.querySelector('.auto-tag')) {
          var autoSpan = document.createElement('span');
          autoSpan.className = 'auto-tag';
          autoSpan.textContent = 'авто';
          var ptsSpan = labelContainer.querySelector('.pts');
          if (ptsSpan) {
            labelContainer.insertBefore(autoSpan, ptsSpan);
          } else {
            labelContainer.appendChild(autoSpan);
          }
        }
      }
      if (warningIcon) warningIcon.style.display = 'none';
    } else {
      if (wasAuto) hbBleedCheckbox.checked = false;
      if (labelContainer) {
        labelContainer.classList.remove('auto-cb');
        var autoTag = labelContainer.querySelector('.auto-tag');
        if (autoTag) autoTag.remove();
      }
      if (showWarning) {
        var warnText = '';
        if (isAnemiaWarn) warnText += 'Умеренная анемия (Hb ' + hbValue + ' г/л). ';
        if (isPltWarn)    warnText += 'Умеренная тромбоцитопения (Plt ' + pltValue + '×10⁹/л). ';
        warnText += 'Рассмотрите необходимость отметки критерия B.';
        if (warningIcon) {
          warningIcon.style.display = 'inline';
          setupTooltipTrigger(warningIcon, warnText);
        }
      } else {
        if (warningIcon) warningIcon.style.display = 'none';
      }
    }
  }

  // HAS-BLED критерий A (почки)
  var hbRenalCheckbox  = document.getElementById('hb_renal');
  var renalWarningIcon = document.getElementById('hb_renal_warning');
  var renalLabel       = document.getElementById('hb_renal_label');

  if (hbRenalCheckbox) {
    var isRenalAuto = (creat !== null && creat >= 200);
    var isRenalWarn = (egfr !== null && egfr < 60) && !isRenalAuto;
    var wasRenalAuto = renalLabel && renalLabel.classList.contains('auto-cb');

    if (isRenalAuto) {
      hbRenalCheckbox.checked = true;
      flashField(hbRenalCheckbox);
      if (renalLabel) {
        renalLabel.classList.add('auto-cb');
        if (!renalLabel.querySelector('.auto-tag')) {
          var autoSpanR = document.createElement('span');
          autoSpanR.className = 'auto-tag';
          autoSpanR.textContent = 'авто';
          var ptsSpanR = renalLabel.querySelector('.pts');
          if (ptsSpanR) {
            renalLabel.insertBefore(autoSpanR, ptsSpanR);
          } else {
            renalLabel.appendChild(autoSpanR);
          }
        }
      }
      if (renalWarningIcon) renalWarningIcon.style.display = 'none';
    } else {
      if (wasRenalAuto) hbRenalCheckbox.checked = false;
      if (renalLabel) {
        renalLabel.classList.remove('auto-cb');
        var autoTagR = renalLabel.querySelector('.auto-tag');
        if (autoTagR) autoTagR.remove();
      }
      if (isRenalWarn) {
        var renalWarnText = 'Снижение СКФ <60 мл/мин/1,73 м². Оригинальный критерий HAS-BLED — креатинин ≥200 мкмоль/л. Для добавления балла используйте ручную отметку.';
        if (renalWarningIcon) {
          renalWarningIcon.style.display = 'inline';
          setupTooltipTrigger(renalWarningIcon, renalWarnText);
        }
      } else {
        if (renalWarningIcon) renalWarningIcon.style.display = 'none';
      }
    }
  }

  // Wells: ЧСС >100
  if (hr !== null) {
    var wellsHr = document.getElementById('wells_hr');
    if (wellsHr) {
      wellsHr.checked = hr > 100;
      if (hr > 100) flashField(wellsHr);
    }
  }

  // Geneva: возраст >65 и ЧСС
  if (age !== null) {
    var genevaAge = document.getElementById('geneva_age');
    if (genevaAge) {
      genevaAge.checked = age > 65;
      if (age > 65) flashField(genevaAge);
    }
  }

  if (hr !== null) {
    var genevaHr75 = document.getElementById('geneva_hr75');
    var genevaHr95 = document.getElementById('geneva_hr95');
    if (genevaHr75 && genevaHr95) {
      if (hr >= 95) {
        genevaHr95.checked = true;
        genevaHr75.checked = false;
        flashField(genevaHr95);
      } else if (hr >= 75) {
        genevaHr75.checked = true;
        genevaHr95.checked = false;
        flashField(genevaHr75);
      } else {
        genevaHr75.checked = false;
        genevaHr95.checked = false;
      }
    }
  }

  // PESI: ХСН
  var hfCheck = document.getElementById('pesi_hf');
  if (hfCheck) {
    hfCheck.checked = cb('cb_hf');
    if (cb('cb_hf')) flashField(hfCheck);
  }

  // Онкология: узкие шкалы (активный рак) → широкие (PESI/Caprini)
  applyCancerAuto();

  // Онкология: подсказки-напоминания, если рак отмечен только в анамнезе
  updateCancerWarnings();

  // ХОБЛ: авто-связь Caprini → PESI + подсказка в обратную сторону
  syncCopdAuto();

  // Признаки ТГВ (Wells/Geneva) → «Отёчность ног» Caprini
  syncDvtEdemaAuto();

  // Постельный режим >72 ч (Caprini) → «Иммобилизация» Wells
  syncBedrestAuto();

  // Цирроз печени (ARC-HBR) → «Нарушение функции печени» HAS-BLED
  syncCirrhosisAuto();

  // Wells ↔ Geneva: связанные пары «Кровохарканье» и «Признаки ТГВ»,
  // а также PESI ↔ Caprini выравниваются при каждом пересчёте
  // (и после отмены изменений).
  syncLinkedCheckboxes();

  syncSexFromHidden();
  skipUndo = prevSkipUndo;
}

// ===================================================
//  SCORE2: сердечно-сосудистый риск и липиды
//  Стратификация — рос. КР 2023 (план 2026-08-16).
// ===================================================

function score2DurYears(age, dmAge, dmAge20) {
  if (dmAge20) return 99;
  if (dmAge && isFinite(dmAge) && age && isFinite(age)) return age - dmAge;
  return null;
}

// Клиническая категория риска (без SCORE2). Возвращает ключ или null,
// Подсчёт факторов риска по таблице А3.3 рос. КР 2023 (для правил СД и СГХС):
// возраст (м >40 / ж >55), курение, АГ, отягощённая наследственность,
// ожирение (ИМТ >25), ХБП (СКФ <60), семейная гиперлипидемия.
// includeAge=false — для проверки «молодые <50 лет без ФР» (возраст не считаем,
// иначе «умеренный» был бы недостижим для мужчин 40–49).
function score2RfCount(ctx, includeAge) {
  var rf = 0;
  if (includeAge !== false && ctx.age !== null && ctx.age > 40 && (ctx.sex !== 'f' || ctx.age > 55)) rf++;
  if (ctx.smoking) rf++;
  if (ctx.htn || ctx.sbp >= 140) rf++;
  if (ctx.fhCvd) rf++;
  if (ctx.weight !== null && ctx.height !== null && ctx.height > 0 &&
      ctx.weight / Math.pow(ctx.height / 100, 2) > 25) rf++;
  if (ctx.egfr !== null && ctx.egfr < 60) rf++;
  if (ctx.fhLip) rf++;
  return rf;
}

// Клиническая категория риска (рос. КР 2023). Возвращает категорию, либо null,
// если нужен расчёт по SCORE2.
function score2ClinicalCat(ctx) {
  var assz = ctx.mi || ctx.stroke || ctx.tia || ctx.vasc || ctx.asb50; // АСБ >50% = АССЗ по данным обследования
  var ckd = ctx.egfr;
  var rf = score2RfCount(ctx);

  if (ctx.events2) return 'extreme';                                     // ≥2 СС-события за 2 года
  if (ctx.gosghs) return 'extreme';                                      // гомозиготная СГХС
  if (assz) return 'veryhigh';                                           // документированное АССЗ (в т.ч. АСБ >50%)
  if (ctx.sghs && (ctx.dm || rf >= 1)) return 'veryhigh';                // СГХС + ФР (или СД) — очень высокий
  if (ctx.sghs) return 'high';                                           // СГХС без ФР
  if (ckd !== null && ckd < 30) return 'veryhigh';                       // тяжёлая ХБП
  if (ctx.dm && (ctx.tod || ctx.dm20 || (ctx.dur !== null && ctx.dur > 20))) return 'veryhigh'; // СД + ПOM или >20 лет

  // Клинические «высокие» критерии (ЛПНП ≥4,9, ОХ >8, АД ≥180/110, ХБП 30–59, атеросклероз 25–49%)
  // НЕ блокируют расчёт: модель SCORE2 считается, категория = максимум (см. buildScore2Result).
  // Это важно: SCORE2 ≥10% (очень высокий) не должен «затираться» до «высокого» чекбоксом 25–49%.
  return null;
}

// Причины реклассификации до «высокого риска» вне клинической ветки score2ClinicalCat.
// Используется только для пояснения, почему итоговая категория оказалась выше расчётной по модели.
function score2FloorHighCriteria(ctx, ldlForHighRiskCriterion) {
  var causes = [];
  if (ctx.tchol > 8) causes.push('Общий холестерин > 8 ммоль/л');
  if (ldlForHighRiskCriterion !== null && ldlForHighRiskCriterion >= 4.9) causes.push('ЛПНП ≥ 4,9 ммоль/л');
  if (ctx.sbp >= 180) causes.push('САД ≥ 180 мм рт.ст.');
  if (ctx.egfr !== null && ctx.egfr >= 30 && ctx.egfr < 60) causes.push('Умеренная ХБП (рСКФ 30–59 мл/мин/1,73 м²)');
  if (ctx.ath25) causes.push('Атеросклероз некоронарных артерий (стеноз 25–49%)');
  return causes;
}

// ============================================================================
// Клинические критерии, определившие категорию риска (для тултипа карточки
// «Сердечно-сосудистый риск»). Должна оставаться синхронизированной
// с score2ClinicalCat: те же условия и тот же порядок. Возвращает ВСЕ
// сработавшие критерии (не только «победивший»).
// ============================================================================
function score2ClinicalCriteria(ctx) {
  var causes = [];
  var rf = score2RfCount(ctx);

  if (ctx.events2) causes.push('2 сердечно-сосудистых события за 2 года на фоне оптимальной гиполипидемической терапии');
  if (ctx.gosghs) causes.push('Гомозиготная семейная гиперхолестеринемия (гоСГХС)');
  if (ctx.mi) causes.push('Инфаркт миокарда в анамнезе');
  if (ctx.stroke) causes.push('Инсульт в анамнезе');
  if (ctx.tia) causes.push('ТИА в анамнезе');
  if (ctx.vasc) causes.push('Сосудистое заболевание в анамнезе');
  if (ctx.asb50) causes.push('АСБ со стенозом > 50%');
  if (ctx.sghs && ctx.dm) causes.push('СГХС в сочетании с сахарным диабетом');
  if (ctx.sghs && rf >= 1) causes.push('СГХС в сочетании с дополнительными факторами риска');
  if (ctx.sghs && !ctx.dm && rf < 1) causes.push('СГХС без дополнительных факторов риска');
  if (ctx.egfr !== null && ctx.egfr < 30) causes.push('Тяжёлая ХБП (рСКФ < 30 мл/мин/1,73 м²)');
  if (ctx.dm && ctx.tod) causes.push('СД с поражением органов-мишеней');
  if (ctx.dm && (ctx.dm20 || (ctx.dur !== null && ctx.dur > 20))) causes.push('Длительность СД > 20 лет');

  return causes;
}

// Категория по порогам SCORE2 (рос. КР 2023)
function score2ThresholdCat(model, risk, age) {
  if (model === 'score2') {
    if (age < 50) return risk < 1 ? 'low' : risk < 2.5 ? 'moderate' : risk < 7.5 ? 'high' : 'veryhigh';
    return risk < 1 ? 'low' : risk < 5 ? 'moderate' : risk < 10 ? 'high' : 'veryhigh';
  }
  if (model === 'diab') {
    return risk < 5 ? 'low' : risk < 10 ? 'moderate' : risk < 20 ? 'high' : 'veryhigh';
  }
  // op (70–89 лет)
  return risk < 1 ? 'low' : risk < 7.5 ? 'moderate' : risk < 15 ? 'high' : 'veryhigh';
}

// Правила СД (рос. КР 2023) — для категории «по максимуму»
function score2DmRuleCat(ctx) {
  if (ctx.tod || ctx.dm20 || (ctx.dur !== null && ctx.dur > 20)) return 'veryhigh';
  var dur = ctx.dur;
  var rf = score2RfCount(ctx);
  // Очень высокий: СД + ≥3 ФР
  if (rf >= 3) return 'veryhigh';
  // Высокий: СД без ПОМ, ≥10 лет
  if (dur !== null && dur >= 10) return 'high';
  // Умеренный: молодые пациенты (СД2 < 50 лет), длительность < 10 лет, без ФР
  // (возрастной ФР не считаем — иначе «молодой без ФР» недостижим)
  if (ctx.age !== null && ctx.age < 50 && dur < 10 && score2RfCount(ctx, false) === 0) return 'moderate';
  // Высокий: СД с ФР (1–2)
  if (rf >= 1) return 'high';
  return 'moderate';
}

// Причины реклассификации по правилам СД в ветке, где SCORE2 всё ещё считается.
// ПОМ и длительность >20 лет сюда не включаем: эти случаи уже отсекаются раньше
// в score2ClinicalCat как клинически очень высокий риск, без расчёта модели.
function score2DmReclassCriteria(ctx) {
  var causes = [];
  var rf = score2RfCount(ctx);
  var dur = ctx.dur;

  if (rf >= 3) causes.push('СД в сочетании с ≥3 факторами риска');
  if (dur !== null && dur >= 10) causes.push('Длительность СД ≥ 10 лет');
  if (rf >= 1 && rf < 3) causes.push('СД в сочетании с факторами риска');

  return causes;
}

var SCORE2_CAT_ORDER = ['low', 'moderate', 'high', 'veryhigh', 'extreme'];

var SCORE2_LDL_TARGETS = {
  extreme:  1.0,
  veryhigh: 1.4,
  high:     1.8,
  moderate: 2.6,
  low:      3.0
};

var SCORE2_CAT_LABELS = {
  extreme:  'Экстремальный риск',
  veryhigh: 'Очень высокий риск',
  high:     'Высокий риск',
  moderate: 'Умеренный риск',
  low:      'Низкий риск'
};

// Тексты тултипов (ⓘ в заголовке карточки) — по образцу MDCalc
var SCORE2_TIP_TEXTS = {
  diab:
    'Рассчитывает 10-летний риск сердечно-сосудистых событий у пациентов с сахарным диабетом 2 типа. Применяется у взрослых 40–69 лет с СД 2 типа.\n\n' +
    'НЕ ПРИМЕНЯТЬ, ЕСЛИ:\n' +
    '— известное атеросклеротическое ССЗ (ИМ, инсульт и др.) — риск и так очень высокий;\n' +
    '— СД 1 типа;\n' +
    '— возраст 40–69 лет без диабета (используйте SCORE2);\n' +
    '— возраст ≥ 70 лет (используйте SCORE2-OP).\n\n' +
    'КАК ИНТЕРПРЕТИРОВАТЬ:\n' +
    'Оценивайте риск в контексте ведения диабета: длительность СД, контроль гликемии, функция почек, микрососудистые осложнения. Результат — помощь клиническому суждению. Пересматривайте риск периодически (после изменений гликемии, курения, АД, липидов, функции почек). При пограничном риске учитывайте дополнительные модификаторы (липопротеин(а), СРБ, альбуминурия) или визуализацию.\n\n' +
    'КАТЕГОРИИ РИСКА ПРИ СД 2 ТИПА:\n' +
    '— очень высокий: ≥ 20%;\n' +
    '— высокий: 10% – < 20%;\n' +
    '— умеренный: 5% – < 10%;\n' +
    '— низкий: < 5%.',
  score2:
    'Рассчитывает 10-летний риск сердечно-сосудистых событий у людей 40–69 лет без установленного ССЗ и без диабета.\n\n' +
    'НЕ ПРИМЕНЯТЬ, ЕСЛИ:\n' +
    '— известное атеросклеротическое ССЗ;\n' +
    '— сахарный диабет (используйте SCORE2-Diabetes);\n' +
    '— тяжёлая ХБП (СКФ < 30);\n' +
    '— семейная гиперхолестеринемия;\n' +
    '— возраст ≥ 70 лет (используйте SCORE2-OP).\n\n' +
    'КАК ИНТЕРПРЕТИРОВАТЬ:\n' +
    'Результат — помощь клиническому суждению. У молодых умеренный 10-летний риск может отражать существенный пожизненный риск; у пожилых конкурирующая не-сердечно-сосудистая смертность может снижать пользу лечения. Пересматривайте риск периодически (после изменений курения, АД, липидов).\n\n' +
    'КАТЕГОРИИ РИСКА (рос. КР 2023):\n' +
    '— очень высокий: ≥ 10% (50–69 лет), ≥ 7,5% (40–49 лет);\n' +
    '— высокий: 5% – < 10% (50–69), 2,5% – < 7,5% (40–49);\n' +
    '— умеренный: 1% – < 5% (50–69), 1% – < 2,5% (40–49);\n' +
    '— низкий: < 1%.',
  op:
    'Рассчитывает 10-летний риск сердечно-сосудистых событий у людей 70–89 лет (диабет учитывается внутри модели как фактор риска).\n\n' +
    'НЕ ПРИМЕНЯТЬ, ЕСЛИ:\n' +
    '— известное ССЗ — риск и так очень высокий;\n' +
    '— тяжёлая ХБП (СКФ < 30);\n' +
    '— возраст до 70 лет (используйте SCORE2 или SCORE2-Diabetes).\n\n' +
    'КАК ИНТЕРПРЕТИРОВАТЬ:\n' +
    'Оценивайте риск с учётом хрупкости, ожидаемой продолжительности жизни, конкурирующей не-сердечно-сосудистой смертности, полипрагмазии и переносимости лечения. Совместное решение с пациентом особенно важно у пожилых. Пересматривайте риск периодически (после изменений курения, АД, липидов).\n\n' +
    'КАТЕГОРИИ РИСКА (рос. КР 2023):\n' +
    '— очень высокий: ≥ 15%;\n' +
    '— высокий: 7,5% – < 15%;\n' +
    '— умеренный: 1% – < 7,5%;\n' +
    '— низкий: < 1%.',
  dmRules:
    'SCORE2 неприменима для этого возраста. Категория определена по клиническим правилам СД (рос. КР 2023): поражение органов-мишеней, длительность диабета и факторы риска.'
};

// Таблица А3.5 проекта КР «Нарушения липидного обмена» (09.04.2026):
// расчётное снижение ХС ЛНП при различных вариантах гиполипидемической терапии
var SCORE2_THERAPY_TABLE = [
  { label: 'Эзетимиб', pct: 25 },
  { label: 'Бемпедоевая кислота', pct: 25 },
  { label: 'Умеренная статинотерапия', pct: 30 },
  { label: 'Бемпедоевая кислота с эзетимибом', pct: 45 },
  { label: 'Интенсивная статинотерапия', pct: 50 },
  { label: 'Инклисиран', pct: 50 },
  { label: 'Бемпедоевая кислота со статином', pct: 60 },
  { label: 'Алирокумаб / эволокумаб', pct: 60 },
  { label: 'Интенсивная статинотерапия + эзетимиб', pct: 65 },
  { label: 'Бемпедоевая кислота со статином и эзетимибом', pct: 70 },
  { label: 'Алирокумаб / эволокумаб / инклисиран + интенсивная статинотерапия', pct: 75 },
  { label: 'Алирокумаб / эволокумаб / инклисиран + интенсивная статинотерапия + эзетимиб', pct: 85 },
  { label: 'Алирокумаб / эволокумаб / инклисиран + интенсивная статинотерапия + эзетимиб + бемпедоевая кислота', pct: 90 }
];

// Варианты терапии, достигающие нужного снижения: не слабее требуемого
// и не «сильно сильнее» (не более +25 п.п.), иначе — чрезмерно агрессивные схемы
function score2TherapyOptions(needPct) {
  var out = [];
  for (var i = 0; i < SCORE2_THERAPY_TABLE.length; i++) {
    var t = SCORE2_THERAPY_TABLE[i];
    if (t.pct >= needPct && t.pct <= needPct + 25) out.push(t);
  }
  return out;
}

var SCORE2_RECOMMENDATIONS = {
  extreme:  'Достичь ХС ЛНП < 1,0 ммоль/л.',
  veryhigh: 'Достичь ХС ЛНП < 1,4 ммоль/л и снизить его ≥50% от исходного.',
  high:     'Достичь ХС ЛНП < 1,8 ммоль/л и снизить его ≥50% от исходного.',
  moderate: 'Достичь ХС ЛНП < 2,6 ммоль/л. Статин умеренной интенсивности по показаниям.',
  low:      'Достичь ХС ЛНП < 3,0 ммоль/л. Коррекция образа жизни; статины, как правило, не требуются.'
};

function fmtLdl(x) {
  return x.toFixed(1).replace('.', ',');
}

// Собирает карточки результата модуля «СС-риск и липиды»
function buildScore2Result(v) {
  var html = '';
  var copy = '';
  var ctx = {
    dm: v.dm, tod: v.tod, dm20: v.dm20, mi: v.mi, stroke: v.stroke, tia: v.tia,
    vasc: v.vasc, sghs: v.sghs, htn: v.htn, smoking: v.smoking, events2: v.events2,
    tchol: v.tchol, hdl: v.hdl, ldl: v.ldl, tg: v.tg, sbp: v.sbp, egfr: v.egfr,
    age: v.age, sex: v.sex, weight: v.weight, height: v.height, fhCvd: v.fhCvd,
    fhLip: v.fhLip, asb50: v.asb50, ath25: v.ath25, gosghs: v.gosghs,
    dur: score2DurYears(v.age, v.dmAge, v.dm20)
  };
  // Липидные формулы и рабочий ЛПНП считаем сразу, чтобы и стратификация риска,
  // и терапевтический блок опирались на один и тот же источник.
  var lip = calcLipids(v.tchol, v.hdl, v.tg, v.ldl);
  var workingLdl = selectWorkingLdl(v.ldl, lip, v.tg);

  // Для клинического критерия «ЛПНП ≥ 4,9 → минимум высокий риск»
  // используем лабораторный ЛПНП всегда; расчётный — только если он получен
  // валидным методом в допустимом диапазоне ТГ. Сампсон при ТГ > 9,0
  // оставляем как ориентир для терапии, но не для авто-повышения риска.
  var ldlForHighRiskCriterion = null;
  if (v.ldl !== null && isFinite(v.ldl) && v.ldl > 0) {
    ldlForHighRiskCriterion = v.ldl;
  } else if (workingLdl.value !== null) {
    var canUseWorkingLdlForHighRiskCriterion =
      workingLdl.source === 'friedewald' ||
      workingLdl.source === 'martinHopkins' ||
      (workingLdl.source === 'sampson' && v.tg !== null && isFinite(v.tg) && v.tg <= 9.0);

    if (canUseWorkingLdlForHighRiskCriterion) {
      ldlForHighRiskCriterion = workingLdl.value;
    }
  }

  // Клинические «высокие» критерии: не блокируют модель SCORE2 — категория по максимуму
  var floorHigh = ctx.tchol > 8 || (ldlForHighRiskCriterion !== null && ldlForHighRiskCriterion >= 4.9) || ctx.sbp >= 180 ||
                  (ctx.egfr !== null && ctx.egfr >= 30 && ctx.egfr < 60) || ctx.ath25;
  var cat = score2ClinicalCat(ctx);
  var modelLabel = null;
  var riskPct = null;

  if (cat === null) {
    if (v.age < 40 || v.age > 89) {
      if (v.dm) {
        // SCORE2 неприменима, но правила СД (рос. КР 2023) дают категорию риска и цель
        cat = score2DmRuleCat(ctx);
        // Клинические «высокие» факторы не теряем и здесь
        if (floorHigh) {
          cat = SCORE2_CAT_ORDER[Math.max(SCORE2_CAT_ORDER.indexOf(cat), SCORE2_CAT_ORDER.indexOf('high'))];
        }
        var dmRulesTipId = 'dmrules_tip_' + Date.now();
        html += makeResultCard('Категория риска (правила СД)' +
            '<span class="info-icon" id="' + dmRulesTipId + '" style="cursor:help;font-size:15px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>',
          SCORE2_CAT_LABELS[cat],
          'SCORE2 неприменима для возраста ' + v.age + ' лет; категория по правилам СД (рос. КР 2023).',
          (cat === 'veryhigh' || cat === 'high') ? 'high' : (cat === 'moderate' ? 'moderate' : 'low'),
          '', '');
        setTimeout(function() {
          var dmRulesIcon = document.getElementById(dmRulesTipId);
          if (dmRulesIcon) setupTooltipTrigger(dmRulesIcon, SCORE2_TIP_TEXTS.dmRules);
        }, 50);
        var catDmLabel = SCORE2_CAT_LABELS[cat].toLowerCase().replace(' риск', '');
        copy = 'Категория риска (правила СД): ' + catDmLabel +
               '; SCORE2 неприменима (возраст ' + v.age + ' лет)';
      } else if (floorHigh) {
        // Возраст вне диапазона SCORE2, но есть клинический «высокий» критерий — категория клинически
        cat = 'high';
        html += makeResultCard('Категория риска (клинически)', SCORE2_CAT_LABELS[cat],
          'SCORE2 неприменима для возраста ' + v.age + ' лет; категория по клиническим критериям (рос. КР 2023).',
          'high', '', '');
        var catFloorLabel = SCORE2_CAT_LABELS[cat].toLowerCase().replace(' риск', '');
        copy = 'Категория риска (клинически): ' + catFloorLabel +
               '; SCORE2 неприменима (возраст ' + v.age + ' лет)';
      } else {
        html += makeResultCard('Сердечно-сосудистый риск (SCORE2)', '—',
          'Шкала SCORE2 неприменима для возраста ' + v.age + ' лет',
          'low', '', 'SCORE2 валидирована для возраста 40–89 лет.');
        copy = 'SCORE2 неприменима (возраст ' + v.age + ' лет)';
      }
    } else {
      var risk = null;
      if (v.age <= 69 && v.dm) {
        modelLabel = 'SCORE2-Diabetes';
        // Поле в UI — %, модель авторов считает в ммоль/моль (IFCC): ммоль/моль = (% − 2,15) × 10,93
      var hba1cMmol = (v.hba1c - 2.15) * 10.93;
      risk = score2DiabetesCalc(v.age, v.sex, v.dmAge, v.smoking, v.sbp, v.tchol, v.hdl, hba1cMmol, v.egfr, 'veryhigh');
      } else if (v.age <= 69) {
        modelLabel = 'SCORE2';
        risk = score2Calc(v.age, v.sex, v.smoking, v.sbp, v.tchol, v.hdl, false, 'veryhigh');
      } else {
        modelLabel = 'SCORE2-OP';
        risk = score2opCalc(v.age, v.sex, v.smoking, v.sbp, v.tchol, v.hdl, v.dm, 'veryhigh');
      }
      riskPct = risk.risk;
      var tcat = score2ThresholdCat(modelLabel === 'SCORE2-Diabetes' ? 'diab' : modelLabel === 'SCORE2-OP' ? 'op' : 'score2', riskPct, v.age);
      var modelCat = tcat;
      var dmcat = null;

      // Категория по максимуму: пороги модели + правила СД (при диабете) + клинические «высокие» критерии
      if (v.dm) {
        dmcat = score2DmRuleCat(ctx);
        var minIdx = Math.max(SCORE2_CAT_ORDER.indexOf(dmcat), floorHigh ? SCORE2_CAT_ORDER.indexOf('high') : 0);
        tcat = SCORE2_CAT_ORDER[Math.max(SCORE2_CAT_ORDER.indexOf(tcat), minIdx)];
      } else if (floorHigh) {
        tcat = SCORE2_CAT_ORDER[Math.max(SCORE2_CAT_ORDER.indexOf(tcat), SCORE2_CAT_ORDER.indexOf('high'))];
      }
      cat = tcat;

      // Если итоговая категория выше расчётной по модели, показываем врачу всю
      // цепочку повышений: по шкале → с учётом правил СД → по клиническим критериям.
      var wasReclassified = (SCORE2_CAT_ORDER.indexOf(cat) > SCORE2_CAT_ORDER.indexOf(modelCat));
      var reclassDetails = '';
      var copyReclassNote = '';
      if (wasReclassified) {
        var lines = [];
        lines.push('По шкале ' + modelLabel + ': ' + riskPct.toFixed(1).replace('.', ',') + '% — ' + SCORE2_CAT_LABELS[modelCat].toLowerCase() + '.');
        var preCat = modelCat;
        if (v.dm && dmcat !== null && SCORE2_CAT_ORDER.indexOf(dmcat) > SCORE2_CAT_ORDER.indexOf(preCat)) {
          preCat = dmcat;
          lines.push('С учётом клинических критериев при сахарном диабете (рос. КР 2023): ' + SCORE2_CAT_LABELS[dmcat].toLowerCase() + '.');
          copyReclassNote += '; с учётом клинических критериев при СД' + (dmcat !== cat ? ': ' + SCORE2_CAT_LABELS[dmcat].toLowerCase().replace(' риск', '') : '');
        }
        if (SCORE2_CAT_ORDER.indexOf(cat) > SCORE2_CAT_ORDER.indexOf(preCat)) {
          var floorReasons = [];
          if (floorHigh && SCORE2_CAT_ORDER.indexOf('high') > SCORE2_CAT_ORDER.indexOf(preCat)) {
            floorReasons = score2FloorHighCriteria(ctx, ldlForHighRiskCriterion);
          }
          if (floorReasons.length > 0) {
            var catAcc = SCORE2_CAT_LABELS[cat].toLowerCase().replace(' риск', '')
              .replace('высокий', 'высокого').replace('низкий', 'низкого')
              .replace('умеренный', 'умеренного').replace('экстремальный', 'экстремального');
            lines.push('Категория повышена до ' + catAcc + ' риска по клиническому критерию' + (floorReasons.length > 1 ? 'ям' : '') + ':');
            lines.push('• ' + floorReasons.join('<br>• '));
            copyReclassNote += '; категория повышена: ' + floorReasons.join(', ');
          }
        }
        reclassDetails = lines.join('<br>');
      }

      var s2TipId = 's2tip_' + Date.now();
      var s2TipText = SCORE2_TIP_TEXTS[modelLabel === 'SCORE2-Diabetes' ? 'diab' : modelLabel === 'SCORE2-OP' ? 'op' : 'score2'] +
        '\n\nВыбранный регион для SCORE2 — регион очень высокого риска.';
      html += makeResultCard(modelLabel +
          '<span class="info-icon" id="' + s2TipId + '" style="cursor:help;font-size:15px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>',
        riskPct.toFixed(1).replace('.', ',') + ' %',
        '10-летний риск СС-событий · ' + SCORE2_CAT_LABELS[cat],
        (cat === 'veryhigh' || cat === 'high') ? 'high' : (cat === 'moderate' ? 'moderate' : 'low'),
        reclassDetails, '');
      setTimeout(function() {
        var tipIcon = document.getElementById(s2TipId);
        if (tipIcon) setupTooltipTrigger(tipIcon, s2TipText);
      }, 50);
      var catCopyLabel = SCORE2_CAT_LABELS[cat].toLowerCase();
      copy = modelLabel + ': ' + riskPct.toFixed(1).replace('.', ',') + '% (' + catCopyLabel;
      if (copyReclassNote) {
        copy += copyReclassNote;
      }
      copy += ')';
    }
  } else {
    // Клинические критерии для тултипа: показываем все реально сработавшие
    // основания из ветки score2ClinicalCat, а не только «победивший» критерий.
    var clinicalCauses = score2ClinicalCriteria(ctx);
    var clinTipId = 'clintip_' + Date.now();
    var clinTipText;

    if (clinicalCauses.length === 1) {
      clinTipText = 'Критерий для определения риска:\n• ' + clinicalCauses[0];
    } else if (clinicalCauses.length > 1) {
      clinTipText = 'Критерии для определения риска:\n• ' + clinicalCauses.join('\n• ');
    } else {
      // Страховка: по нормальной логике сюда не должны попадать без причины
      clinTipText = 'Риск определён клинически; детализация критерия недоступна.';
    }

    html += makeResultCard('Сердечно-сосудистый риск',
      '— <span class="info-icon" id="' + clinTipId + '" style="cursor:help;font-size:15px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>',
      'SCORE2 не применяется · ' + SCORE2_CAT_LABELS[cat],
      'high', '', 'Риск определён клинически (рос. КР 2023); расчёт SCORE2 не требуется.');

    setTimeout(function() {
      var icon = document.getElementById(clinTipId);
      if (icon) setupTooltipTrigger(icon, clinTipText);
    }, 50);

    var catClinLabel = SCORE2_CAT_LABELS[cat].toLowerCase().replace(' риск', '');
    copy = 'Категория риска: ' + catClinLabel + ' (клинически)';
  }

  // Липидные формулы (ЛПНП) — карточка выводится всегда (не-ЛПВП доступен и без ТГ).
  // ВАЖНО: lip и workingLdl уже посчитаны в начале функции — пересчитывать их здесь
  // нельзя: карточка, критерий ЛПНП ≥ 4,9 и блок терапии должны видеть один и тот же источник.
  // Символ ★ ставится перед источником ЛПНП, который реально взят для расчёта цели терапии.
  var lipParts = [];
  if (v.tg !== null && isFinite(v.tg) && lip) {
    if (lip.friedewald !== null) lipParts.push((workingLdl.source === 'friedewald' ? '★ ' : '') + 'Фридвальд ' + lip.friedewald.toFixed(2).replace('.', ','));
    if (lip.sampson !== null) lipParts.push((workingLdl.source === 'sampson' ? '★ ' : '') + 'Сампсон ' + lip.sampson.toFixed(2).replace('.', ','));
    if (lip.martinHopkins !== null) lipParts.push((workingLdl.source === 'martinHopkins' ? '★ ' : '') + 'Мартин-Хопкинс ' + lip.martinHopkins.toFixed(2).replace('.', ','));
  }
  // Лабораторный ЛПНП показываем ВСЕГДА, если введён — независимо от наличия ТГ
  if (v.ldl !== null && isFinite(v.ldl) && v.ldl > 0) {
    lipParts.push((workingLdl.source === 'lab' ? '★ ' : '') + 'лаборатория ' + v.ldl.toFixed(2).replace('.', ','));
  }
  var lipText = 'ЛПНП: ' + (lipParts.length ? lipParts.join(' · ') : 'введите триглицериды или лабораторный ЛПНП');
  if (lip && lip.tgTooHighFriedewald) lipText += ' · Фридвальд неприменим при ТГ > 4,5 ммоль/л';
  var lipTipId = 'lip_tip_' + Date.now();
  // не-ЛПВП = ХС − ЛПВП — вычислим всегда, ТГ не нужны
  var lipNonHdl = (v.tchol && v.hdl && isFinite(v.tchol) && isFinite(v.hdl)) ? v.tchol - v.hdl : null;
  var lipValue = (lipNonHdl !== null ? 'не-ЛПВП ' + lipNonHdl.toFixed(2).replace('.', ',') : '—') +
    '<span class="info-icon" id="' + lipTipId + '" style="cursor:help;font-size:16px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>';
  html += makeResultCard('Липиды',
    lipValue,
    lipParts.length ? '' : 'ТГ не введены', 'low', lipText, '');
  setTimeout(function() {
    var icon = document.getElementById(lipTipId);
    if (icon) setupTooltipTrigger(icon,
      'не-ЛПВП = ХС − ЛПВП (общий холестерин минус ЛПВП). Отражает суммарный атерогенный холестерин.\n\n' +
      '★ — источник ЛПНП, использованный для расчёта цели терапии и процента снижения.');
  }, 50);
  copy += (copy ? '; ' : '') + 'не-ЛПВП ' + (lipNonHdl !== null ? lipNonHdl.toFixed(2).replace('.', ',') : '—');

  // Цель терапии и рекомендации (только если категория определена)
  if (cat !== null) {
    var target = SCORE2_LDL_TARGETS[cat];
    var curLdl = workingLdl.value;
    var ldlSourceLabel = workingLdl.sourceLabel;
    var ldlWarning = workingLdl.warning;
    
    var pct = null;
    if (curLdl !== null && curLdl > target) {
      pct = Math.round((curLdl - target) / curLdl * 100);
    }

    // Дополнительная цель при высоких ТГ: не-ЛПВП = целевой ЛПНП + 0,8 ммоль/л.
    // Отдельную таблицу не заводим, чтобы не было второго источника истины.
    var nonHdlTarget = Math.round((target + 0.8) * 10) / 10;
    var showNonHdlTarget = (v.tg !== null && isFinite(v.tg) && v.tg > 4.5);
    var nonHdlTargetText = '';
    if (showNonHdlTarget) {
      if (v.tg > 9.0) {
        nonHdlTargetText = 'Дополнительный ориентир при очень высоких ТГ: целевой не-ЛПВП < ' + fmtLdl(nonHdlTarget) + ' ммоль/л.';
      } else {
        nonHdlTargetText = 'Дополнительный ориентир при высоких ТГ: целевой не-ЛПВП < ' + fmtLdl(nonHdlTarget) + ' ммоль/л.';
      }
    }

    // Формируем заголовок цели в зависимости от категории риска
    var targetHeadline = '';
    if (cat === 'veryhigh' || cat === 'high') {
      targetHeadline = 'Целевой уровень ХС ЛНП < ' + fmtLdl(target) + ' ммоль/л и снижение ≥50% от исходного.';
    } else {
      targetHeadline = 'Целевой уровень ХС ЛНП < ' + fmtLdl(target) + ' ммоль/л.';
    }
    
    // Объединённый блок «Цель терапии и варианты» (широкий, 2 колонки)
    var therapyDetails = '<div class="therapy-grid">';
    
    // Левая колонка: целевой уровень
    therapyDetails += '<div><strong>' + targetHeadline + '</strong>';
    
    // Показываем исходный ЛПНП и его источник
    if (curLdl !== null) {
      if (pct !== null) {
        therapyDetails += '<br><br>Исходный ЛПНП ' + curLdl.toFixed(2).replace('.', ',') + ' ммоль/л (' + ldlSourceLabel + ') — требуется снижение на ' + pct + '% для достижения < ' + fmtLdl(target) + ' ммоль/л.';
      } else {
        therapyDetails += '<br><br>Исходный ЛПНП ' + curLdl.toFixed(2).replace('.', ',') + ' ммоль/л (' + ldlSourceLabel + ') — целевой уровень достигнут.';
      }
      if (nonHdlTargetText) {
        therapyDetails += '<br><br><span style="font-size:12px;color:var(--text-2);">' + nonHdlTargetText + '</span>';
      }
      // Дополнительное предупреждение при сниженной точности (например, ТГ > 9)
      if (ldlWarning !== null) {
        therapyDetails += '<div style="margin-top:8px;padding:8px 10px;background:var(--orange-soft);border-left:3px solid var(--orange);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;">' +
          '⚠️ ' + ldlWarning + '</div>';
      }
    } else {
      if (nonHdlTargetText) {
        therapyDetails += '<br><br><span style="font-size:12px;color:var(--text-2);">' + nonHdlTargetText + '</span>';
      }
      if (ldlWarning !== null) {
        // Нет расчёта вообще — только предупреждение
        therapyDetails += '<div style="margin-top:8px;padding:8px 10px;background:var(--orange-soft);border-left:3px solid var(--orange);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;">' +
          '⚠️ ' + ldlWarning + '</div>';
      }
    }
    
    therapyDetails += '</div>';
    
    // Правая колонка: Варианты терапии
    therapyDetails += '<div><div class="therapy-col-title">Варианты терапии</div>';
    if (pct !== null) {
      var opts = score2TherapyOptions(pct);
      if (opts.length > 0) {
        var optList = [];
        for (var oi = 0; oi < opts.length; oi++) optList.push('— ' + opts[oi].label + ' (≈' + opts[oi].pct + '%)');
        therapyDetails += optList.join('<br>');
      } else {
        therapyDetails += 'Стандартные схемы не достигают цели — рассмотрите максимальную комбинацию: алирокумаб / эволокумаб / инклисиран + интенсивная статинотерапия + эзетимиб + бемпедоевая кислота (≈90%).';
      }
    } else if (curLdl === null) {
      therapyDetails += 'Введите триглицериды или лабораторный ЛПНП, чтобы рассчитать необходимое снижение.';
    } else {
      therapyDetails += '<span style="color:var(--green);">Целевой уровень достигнут. Продолжайте текущую терапию и контролируйте липидный профиль.</span>';
    }
    therapyDetails += '</div></div>';
    
    var thTipId = 'thtip_' + Date.now();
    html += makeResultCard('Цель терапии и варианты' +
        '<span class="info-icon" id="' + thTipId + '" style="cursor:help;font-size:15px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>',
      SCORE2_CAT_LABELS[cat],
      '',
      (cat === 'extreme' || cat === 'veryhigh' || cat === 'high') ? 'high' : (cat === 'moderate' ? 'moderate' : 'low'),
      therapyDetails, '',
      'card-span-2');
    setTimeout(function() {
      var thIcon = document.getElementById(thTipId);
      if (thIcon) setupTooltipTrigger(thIcon, 'Расчётное снижение по таблице А3.5 КР «Нарушения липидного обмена» (проект, 09.04.2026). Выбор терапии — на усмотрение врача.');
    }, 50);
    var copyTargetHeadline = '';
    if (cat === 'veryhigh' || cat === 'high') {
      copyTargetHeadline = 'целевой уровень ХС ЛНП < ' + fmtLdl(target) + ' ммоль/л и снижение ≥50% от исходного';
    } else {
      copyTargetHeadline = 'целевой уровень ХС ЛНП < ' + fmtLdl(target) + ' ммоль/л';
    }

    copy += (copy ? '; ' : '') + copyTargetHeadline;
    if (showNonHdlTarget) {
      copy += '; целевой не-ЛПВП < ' + fmtLdl(nonHdlTarget) + ' ммоль/л';
    }

    if (curLdl !== null) {
      if (pct !== null) {
        copy += '; исходный ЛПНП ' + curLdl.toFixed(2).replace('.', ',') + ' ммоль/л (' + ldlSourceLabel + ') — требуется снижение на ' + pct + '% для достижения < ' + fmtLdl(target) + ' ммоль/л.';
      } else {
        copy += '; исходный ЛПНП ' + curLdl.toFixed(2).replace('.', ',') + ' ммоль/л (' + ldlSourceLabel + ') — целевой уровень достигнут.';
      }
    } else if (ldlWarning !== null) {
      copy += '; ' + ldlWarning;
    } else {
      copy += '.';
    }
  }

  return { html: html, copy: copy };
}

// ===================================================
//  ГЛАВНЫЙ РАСЧЁТ
// ===================================================
function calculate() {
  autofill();

  var errors = [];

  var age    = parseNum('age');
  var sex    = document.getElementById('sex').value;
  var height = parseNum('height');
  var weight = parseNum('weight');
  var sbp    = parseNum('sbp');
  var hr     = parseNum('hr');
  var creat  = parseNum('creatinine');
  var hb     = parseNum('hb');
  var hct    = parseNum('hct');
  var plt    = parseNum('plt');
  var wbc    = parseNum('wbc');
  var tchol  = parseNum('tchol');
  var hdl    = parseNum('hdl');
  var tg     = parseNum('tg');
  var ldlLab = parseNum('ldl');
  var hba1c  = parseNum('hba1c');
  var dmAge  = parseNum('dm_age');
  var smokingEl = document.getElementById('smoking');
  var smoking = !!smokingEl && smokingEl.value === 'yes';
  var dm      = !!document.getElementById('cb_dm') && document.getElementById('cb_dm').checked;
  var dm20    = !!document.getElementById('dm_age20') && document.getElementById('dm_age20').checked;
  var dmTod   = !!document.getElementById('cb_dm_tod') && document.getElementById('cb_dm_tod').checked;

  if (!age) errors.push({ field: 'age', msg: 'Введите возраст' });

  var sexRequiredScales = ['ckdepi', 'cg', 'crusade', 'cha2ds2', 'pesi', 'precise', 'score2'];
  var needSex = sexRequiredScales.some(function(scale) { return isScaleActive(scale); });
  if (needSex && (!sex || sex === '')) errors.push({ field: 'sex', msg: 'Выберите пол' });

  if (!creat && (isScaleActive('ckdepi') || isScaleActive('cg') || isScaleActive('grace') ||
      isScaleActive('crusade') || isScaleActive('archbr') || isScaleActive('hasbled') || isScaleActive('precise'))) {
    errors.push({ field: 'creatinine', msg: 'Введите креатинин' });
  }

  if (isScaleActive('cg')) {
    if (!weight) errors.push({ field: 'weight', msg: 'Введите вес (для шкалы Кокрофт-Голт)' });
  }

  if (isScaleActive('crusade')) {
    if (hct === null) errors.push({ field: 'hct', msg: 'Введите гематокрит (для шкалы CRUSADE)' });
    if (!weight) errors.push({ field: 'weight', msg: 'Введите вес (для расчёта КлКр в CRUSADE)' });
  }

  // GRACE: без АД/ЧСС результат не выводится (тихий пропуск)
  if (isScaleActive('grace')) {
    if (!sbp) errors.push({ field: 'sbp', msg: 'Введите систолическое АД (для GRACE)' });
    if (!hr)  errors.push({ field: 'hr',  msg: 'Введите ЧСС (для GRACE)' });
  }

  // CRUSADE: без АД/ЧСС результат не выводится
  if (isScaleActive('crusade')) {
    if (!hr)  errors.push({ field: 'hr',  msg: 'Введите ЧСС (для CRUSADE)' });
    if (!sbp) errors.push({ field: 'sbp', msg: 'Введите систолическое АД (для CRUSADE)' });
  }

  // PESI: все 5 параметров дают баллы — иначе занижение риска
  if (isScaleActive('pesi')) {
    if (!hr)  errors.push({ field: 'hr',        msg: 'Введите ЧСС (для PESI)' });
    if (!sbp) errors.push({ field: 'sbp',       msg: 'Введите систолическое АД (для PESI)' });
    if (!parseNum('pesi_rr'))   errors.push({ field: 'pesi_rr',   msg: 'Введите ЧДД (для PESI)' });
    if (!parseNum('pesi_temp')) errors.push({ field: 'pesi_temp', msg: 'Введите температуру (для PESI)' });
    if (!parseNum('pesi_spo2')) errors.push({ field: 'pesi_spo2', msg: 'Введите SpO₂ (для PESI)' });
  }

  // ARC-HBR: гемоглобин/тромбоциты нужны для авто-критериев
  if (isScaleActive('archbr')) {
    if (!hb)  errors.push({ field: 'hb',  msg: 'Введите гемоглобин (для ARC-HBR)' });
    if (!plt) errors.push({ field: 'plt', msg: 'Введите тромбоциты (для ARC-HBR)' });
  }

  // HAS-BLED: АД нужно для авто-критерия АГ >160
  if (isScaleActive('hasbled')) {
    if (!sbp) errors.push({ field: 'sbp', msg: 'Введите систолическое АД (для HAS-BLED)' });
  }

  // PRECISE-DAPT: нужны вес (КлКр), гемоглобин (г/дл) и лейкоциты
  if (isScaleActive('precise')) {
    if (!weight) errors.push({ field: 'weight', msg: 'Введите вес (для расчёта КлКр в PRECISE-DAPT)' });
    if (!hb)     errors.push({ field: 'hb',     msg: 'Введите гемоглобин (для PRECISE-DAPT)' });
    if (!wbc)    errors.push({ field: 'wbc',    msg: 'Введите лейкоциты (для PRECISE-DAPT)' });
  }

  // SCORE2 (СС-риск и липиды): обязательные поля
  if (isScaleActive('score2')) {
    if (tchol === null) errors.push({ field: 'tchol', msg: 'Введите общий холестерин (для SCORE2)' });
    else if (tchol <= 0) errors.push({ field: 'tchol', msg: 'Общий холестерин должен быть больше 0' });
    if (hdl === null)   errors.push({ field: 'hdl',   msg: 'Введите ЛПВП (для SCORE2)' });
    else if (hdl <= 0) errors.push({ field: 'hdl', msg: 'ЛПВП должен быть больше 0' });
    if (!sbp)   errors.push({ field: 'sbp',   msg: 'Введите систолическое АД (для SCORE2)' });
    if (tg !== null && tg < 0) errors.push({ field: 'tg', msg: 'Триглицериды не могут быть отрицательными' });
    if (ldlLab !== null && ldlLab <= 0) errors.push({ field: 'ldl', msg: 'ЛПНП (лаборатория) должен быть больше 0' });
    if (creat !== null && creat <= 0) errors.push({ field: 'creatinine', msg: 'Креатинин должен быть больше 0' });
    if (dm && age !== null && age >= 40 && age <= 69) {
      // HbA1c и креатинин нужны только для SCORE2-Diabetes (40–69 лет);
      // для 70–89 (SCORE2-OP) и вне диапазона SCORE2 они не используются
      if (!hba1c) errors.push({ field: 'hba1c', msg: 'Введите HbA1c (для SCORE2-Diabetes)' });
      if (!dm20 && !dmAge) errors.push({ field: 'dm_age', msg: 'Укажите возраст дебюта СД или отметьте «длительность ≥ 20 лет»' });
      if (dmAge !== null && age !== null && dmAge > age) errors.push({ field: 'dm_age', msg: 'Возраст дебюта СД не может быть больше возраста пациента' });
      if (!creat) errors.push({ field: 'creatinine', msg: 'Введите креатинин (для SCORE2-Diabetes)' });
    }
  }

  var resultsHTML = '';
  var copyLines   = [];
  var egfr = null, cgCrcl = null;

  if (isScaleActive('crusade') && !isScaleActive('cg') && age && weight && creat) {
    cgCrcl = calcCG(age, sex, weight, creat);
  }

  // --- CKD-EPI ---
  if (isScaleActive('ckdepi') && age && creat) {
    egfr = calcCKDEPI(age, sex, creat);
    var stg = ckdStage(egfr);
    var ckdRisk = egfr >= 60 ? 'low' : egfr >= 30 ? 'moderate' : 'high';
    resultsHTML += makeResultCard(
      'CKD-EPI 2021',
      egfr.toFixed(1) + ' мл/мин/1,73 м²',
      stg.stageRu,
      ckdRisk,
      'Для выбора дозы ПОАК используйте клиренс креатинина (Кокрофт‑Голт).'
    );
    copyLines.push('CKD-EPI: ' + egfr.toFixed(1) + ' мл/мин/1,73 м²');
  }

  // --- Кокрофт-Голт ---
  if (isScaleActive('cg') && age && weight && creat) {
    var cgCrclTbw = calcCG(age, sex, weight, creat);
    cgCrcl = cgCrclTbw;

    if (cgCrclTbw === null) {
      errors.push({ field: null, msg: 'Некорректные данные для Кокрофт-Голт (проверьте возраст <140, вес >0, креатинин >0)' });
    } else {
      var bmi = calcBMI(weight, height);
      var isOverweightForCg = (bmi !== null && bmi >= 25);
      var ibw = calcIBW(height, sex);
      var cgCrclIbw = ibw !== null ? calcCG(age, sex, ibw, creat) : null;
      var abw04 = (isOverweightForCg && ibw !== null && weight > ibw) ? calcABW04(weight, ibw) : null;
      var cgCrclAbw = abw04 !== null ? calcCG(age, sex, abw04, creat) : null;

      var workingCrcl = cgCrclTbw;
      var workingMethodLabel = 'TBW';
      var workingMethodRu    = 'фактический вес';
      var categoryText       = 'Дефицит массы тела';
      var methodNote         = 'Рабочий КлКр рассчитан по фактическому весу (Winter, 2012).';
      var methodBlockStyle   = 'margin-top:8px;padding:8px 10px;background:var(--green-soft);border-left:3px solid var(--green);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;';
      var brownLower = null;
      var brownUpper = null;

      // Рост не указан — считаем по фактическому весу (TBW) с подсказкой,
      // категория по ИМТ невозможна.
      if (height === null || height <= 0) {
        categoryText = 'Рост не указан — расчёт по фактическому весу (TBW)';
        methodNote = 'Рабочий КлКр рассчитан по фактическому весу (Winter, 2012). Для оценки по идеальной массе тела (IBW) внесите рост.';
      }

      if (bmi !== null) {
              if (bmi >= 30 && cgCrclAbw !== null) {
                // Ожирение: рабочий КлКр по скорректированному весу (ABW 0.4)
                workingCrcl = cgCrclAbw; workingMethodLabel = 'ABW 0.4'; workingMethodRu = 'скорректированный вес';
                categoryText = 'Ожирение';
                methodNote = 'Рабочий КлКр рассчитан по скорректированному весу (ABW 0.4): при ожирении фактический вес завышает функцию почек (Winter, 2012).';
                methodBlockStyle = 'margin-top:8px;padding:8px 10px;background:var(--red-soft);border-left:3px solid var(--red);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;';
              } else {
                // Все остальные: рабочий КлКр по фактическому весу (TBW)
                workingCrcl = cgCrclTbw; workingMethodLabel = 'TBW'; workingMethodRu = 'фактический вес';
                if (bmi < 18.5) {
                  categoryText = 'Дефицит массы тела';
                } else if (bmi < 25) {
                  categoryText = 'Нормальная масса тела';
                } else {
                  categoryText = 'Избыточная масса тела';
                }
                methodNote = 'Рабочий КлКр рассчитан по фактическому весу (Winter, 2012).';
                methodBlockStyle = 'margin-top:8px;padding:8px 10px;background:var(--green-soft);border-left:3px solid var(--green);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;';
              }
            }

      if (isOverweightForCg && ibw !== null && cgCrclIbw !== null && cgCrclTbw !== null && weight > ibw) {
        brownLower = Math.min(cgCrclIbw, cgCrclTbw);
        brownUpper = Math.max(cgCrclIbw, cgCrclTbw);
      }

      var cgRisk   = workingCrcl >= 50 ? 'low' : workingCrcl >= 30 ? 'moderate' : 'high';
      var cgInterp = workingCrcl >= 50 ? 'Норма / незначительное снижение' : workingCrcl >= 30 ? 'Умеренное снижение' : 'Тяжёлое снижение';

      var cgTooltipId   = 'cg_weight_tooltip_' + Date.now();
      var cgTooltipText = getCockcroftWeightTooltipText();

      var detailsParts = [];
      if (bmi !== null) detailsParts.push('ИМТ: ' + bmi.toFixed(1) + ' кг/м²');
      detailsParts.push('Рабочий КлКр (' + workingMethodLabel + ', ' + workingMethodRu + '): ' + workingCrcl.toFixed(1) + ' мл/мин');
      detailsParts.push('КлКр (TBW, фактический вес ' + weight.toFixed(1) + ' кг): ' + cgCrclTbw.toFixed(1) + ' мл/мин');
      if (ibw !== null && cgCrclIbw !== null) {
        detailsParts.push('КлКр (IBW, идеальный вес ' + ibw.toFixed(1) + ' кг): ' + cgCrclIbw.toFixed(1) + ' мл/мин');
      }
      if (isOverweightForCg && abw04 !== null && cgCrclAbw !== null) {
        detailsParts.push('КлКр (ABW 0.4, скорректированный вес ' + abw04.toFixed(1) + ' кг): ' + cgCrclAbw.toFixed(1) + ' мл/мин');
      }
      if (brownLower !== null && brownUpper !== null) {
        detailsParts.push('Функциональный диапазон IBW–TBW: ' + brownLower.toFixed(1) + '–' + brownUpper.toFixed(1) + ' мл/мин');
      }

      var detailsText = detailsParts.join('<br>') +
        '<div style="' + methodBlockStyle + '">' +
          '<strong>' + categoryText + '</strong> ' +
          '<span class="info-icon" id="' + cgTooltipId + '" style="cursor:help;font-size:18px;opacity:0.6;vertical-align:middle;">ⓘ</span><br>' +
          methodNote +
        '</div>';

      var hasBledScoreForCg = calcHASBLED();
      var verapamil = cb('cb_verapamil');
      var workingPlan = getDoacPlanByCrCl(workingCrcl, age, weight, creat, verapamil, hasBledScoreForCg);
      var hintText = '';
      var plansByMethod;

      if (bmi !== null && bmi >= 25 && cgCrclIbw !== null) {
        plansByMethod = {
          'IBW': getDoacPlanByCrCl(cgCrclIbw, age, weight, creat, verapamil, hasBledScoreForCg),
          'TBW': getDoacPlanByCrCl(cgCrclTbw, age, weight, creat, verapamil, hasBledScoreForCg)
        };
        if (cgCrclAbw !== null) {
          plansByMethod['ABW 0.4'] = getDoacPlanByCrCl(cgCrclAbw, age, weight, creat, verapamil, hasBledScoreForCg);
        }
        hintText = buildCgComparisonHint(plansByMethod, workingMethodLabel, workingCrcl);
      } else {
        hintText = buildSingleCgHint(workingPlan);
      }

      // Крупно показываем ВСЕ доступные методы (TBW/IBW/ABW) с подписями,
      // «рабочий» метод выделяем жирным и цветом риска; единица «мл/мин»
      // ставится сразу после рабочего значения (решение врача 25.08.2026).
      var cgValueParts = [];
      function cgPart(methodKey, methodLabel, val) {
        if (val === null) return;
        var isWorking = (workingMethodLabel === methodKey);
        var txt = methodLabel + ' ' + val.toFixed(1).replace('.', ',') +
          (isWorking ? ' мл/мин' : '');
        cgValueParts.push(
          (isWorking ? '<b class="cg-working">' : '<span class="cg-plain">') +
          txt +
          (isWorking ? '</b>' : '</span>')
        );
      }
      cgPart('TBW', 'TBW', cgCrclTbw);
      cgPart('IBW', 'IBW', cgCrclIbw);
      cgPart('ABW 0.4', 'ABW', cgCrclAbw);
      var cgValueHtml = cgValueParts.join('');

      resultsHTML += makeResultCard(
        'Кокрофт-Голт',
        cgValueHtml,
        cgInterp,
        cgRisk,
        detailsText,
        hintText,
        'card-span-2'
      );

      setTimeout(function() {
        var icon = document.getElementById(cgTooltipId);
        if (icon) setupTooltipTrigger(icon, cgTooltipText);
      }, 50);

      var copyStr = 'КлКр по Кокрофту-Голту: ';
      if (cgCrclTbw !== null) copyStr += cgCrclTbw.toFixed(1).replace('.', ',') + ' мл/мин (по фактической массе тела (TBW))';
      if (cgCrclIbw !== null) copyStr += ', ' + cgCrclIbw.toFixed(1).replace('.', ',') + ' мл/мин (по идеальной массе тела (IBW))';
      if (isOverweightForCg && cgCrclAbw !== null) copyStr += ', ' + cgCrclAbw.toFixed(1).replace('.', ',') + ' мл/мин (по скорректированной массе тела (ABW 0.4))';
      if (isOverweightForCg && brownLower !== null && brownUpper !== null) {
        copyStr += '; диапазон IBW–TBW: ' + brownLower.toFixed(1).replace('.', ',') + '–' + brownUpper.toFixed(1).replace('.', ',') + ' мл/мин';
      }
      if (bmi !== null) copyStr += '. ИМТ: ' + bmi.toFixed(1).replace('.', ',') + ' кг/м²';

      if (isOverweightForCg && typeof plansByMethod !== 'undefined') {
        var diff = false;
        ['dabigatran', 'rivaroxaban', 'apixaban'].forEach(function(drug) {
          var vals = [];
          if (plansByMethod['IBW'] && plansByMethod['IBW'][drug]) vals.push(plansByMethod['IBW'][drug].key);
          if (plansByMethod['TBW'] && plansByMethod['TBW'][drug]) vals.push(plansByMethod['TBW'][drug].key);
          if (plansByMethod['ABW 0.4'] && plansByMethod['ABW 0.4'][drug]) vals.push(plansByMethod['ABW 0.4'][drug].key);
          for (var i = 1; i < vals.length; i++) {
            if (vals[i] !== vals[0]) diff = true;
          }
        });
        if (diff) {
          copyStr += '. Дозирование ПОАК зависит от выбора массы тела, требуется клиническая оценка.';
        } else {
          copyStr += '. Дозирование ПОАК не зависит от выбора массы тела.';
        }
      }

      copyLines.push(copyStr);
    }
  }

  // --- GRACE ---
  if (isScaleActive('grace') && age && hr && sbp && creat) {
    var killip  = parseInt(document.getElementById('grace_killip').value);
    var arrest  = cb('grace_arrest');
    var stDev   = cb('grace_st');
    var enzymes = cb('grace_enzymes');

    var gScore     = calcGRACE(age, hr, sbp, creat, killip, arrest, stDev, enzymes);
    var gRisk      = graceRisk(gScore);
    var gLabel     = graceRiskLabel(gScore);
    var grace2_6m  = calcGRACE2_6month(age, hr, sbp, creat, killip, arrest, stDev, enzymes);

    var rkoRiskText = '';
    if (gScore <= 108)      rkoRiskText = 'низкий (≤108 баллов)';
    else if (gScore <= 140) rkoRiskText = 'умеренный (109–140 баллов)';
    else                    rkoRiskText = 'высокий (≥141 балл)';

    var graceDetails =
      '<div style="margin-bottom:6px;font-size:13px;">' +
        '<span style="font-weight:600;">Риск смерти в стационаре (РКО):</span> ' + rkoRiskText +
      '</div>' +
      '<div style="margin-bottom:6px;font-size:13px;">' +
        '<span style="font-weight:600;">6‑месячная смертность (GRACE 2.0):</span> ' + grace2_6m.toFixed(1) + '%' +
      '</div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--text-2);">' +
        'ИИ калькулятор <a href="https://www.grace-3.com/" target="_blank" style="color:var(--primary);font-weight:600;text-decoration:none;">GRACE 3.0</a>' +
      '</div>';

    var graceHint = gRisk === 'low'
      ? 'Низкий риск. Возможна консервативная стратегия или отсроченная коронарография.'
      : gRisk === 'moderate'
      ? 'Умеренный риск. Ранняя инвазивная стратегия в течение 24–72 ч.'
      : 'Высокий риск. Срочная инвазивная стратегия в течение 24 ч.';

    resultsHTML += makeResultCard(
      'GRACE',
      gScore + ' ' + pluralizeBalls(gScore) + ' (GRACE 1.0)',
      gLabel,
      gRisk,
      graceDetails,
      graceHint
    );

    var rkoCategoryText = gScore <= 108 ? 'низкий' : gScore <= 140 ? 'умеренный' : 'высокий';
    var rkoThresholds = { 'низкий': '≤108 баллов', 'умеренный': '109–140 баллов', 'высокий': '≥141 балла' };
    copyLines.push('GRACE 1.0: ' + gScore + ' ' + pluralizeBalls(gScore) + ' — ' + rkoCategoryText +
      ' риск по РКО (' + (rkoThresholds[rkoCategoryText] || '') + '). Риск 6-месячной летальности по GRACE 2.0: ' + grace2_6m.toFixed(1) + '%.');
  }

  // --- CRUSADE ---
  if (isScaleActive('crusade') && hct !== null && sbp && hr && cgCrcl !== null) {
    var isFemale = sex === 'f';
    var crusScore = calcCRUSADE(hct, cgCrcl, hr, isFemale, cb('cb_hf'), cb('cb_vasc'), cb('cb_dm'), sbp);
    var crusR = crusadeRisk(crusScore);

    var crusHint = '';
    if (crusR.risk === 'low') {
      crusHint = 'Низкий геморрагический риск. Стандартная антитромботическая терапия.';
    } else if (crusR.risk === 'moderate') {
      crusHint = 'Умеренный геморрагический риск. Учитывайте при выборе антикоагулянта и дозы.';
    } else {
      crusHint = 'Высокий геморрагический риск. Рассмотрите снижение дозы или отказ от агрессивной антикоагуляции.';
    }

    resultsHTML += makeResultCard(
      'CRUSADE',
      crusScore + ' ' + pluralizeBalls(crusScore),
      'Риск внутрибольничного большого кровотечения: ' + crusR.pct,
      crusR.risk,
      '',
      crusHint
    );
    copyLines.push('CRUSADE: ' + crusScore + ' ' + pluralizeBalls(crusScore) + ' — ' + crusR.label + ' (риск кровотечения ' + crusR.pct + ')');
  }

  // --- ARC-HBR ---
  if (isScaleActive('archbr')) {
    var arc = calcARCHBR();
    var arcRisk  = arc.isHBR ? 'high' : 'low';
    var arcLabel = arc.isHBR ? 'Высокий риск кровотечения' : 'Нет высокого риска кровотечения';
    resultsHTML += makeResultCard(
      'ARC-HBR',
      arc.isHBR ? '✅ HBR' : '❌ Не HBR',
      arcLabel,
      arcRisk,
      '<div class="arc-summary">' +
        '<div class="arc-num"><div class="n">' + arc.major + '</div><div class="lbl">Больших</div></div>' +
        '<div class="arc-num"><div class="n">' + arc.minor + '</div><div class="lbl">Малых</div></div>' +
        '<div style="font-size:12px;color:var(--muted);align-self:center;">Критерий HBR:<br>≥1 большого ИЛИ ≥2 малых</div>' +
      '</div>',
      arc.isHBR
        ? 'Рассмотреть сокращение ДАТТ (1–3 мес. при плановом ЧКВ, 3–6 мес. при ОКС) или деэскалацию. Обязательно назначение ИПП.'
        : 'Показана стандартная ДАТТ (6 мес. при плановом ЧКВ, 12 мес. при ОКС).'
    );
    copyLines.push('ARC-HBR: ' + arcLabel + ' (большие критерии: ' + arc.major + ', малые критерии: ' + arc.minor + ')');
  }

  // --- Caprini ---
  if (isScaleActive('caprini')) {
    var capScore = calcCaprini();
    var capR = capriniRisk(capScore);
    resultsHTML += makeResultCard(
      'Caprini 2010',
      capScore + ' ' + pluralizeBalls(capScore),
      capR.label + ' | Риск ВТЭО ' + capR.pct,
      capR.risk,
      'Риск ВТЭО: ' + capR.pct,
      capR.rec
    );
    copyLines.push('Caprini: ' + capScore + ' ' + pluralizeBalls(capScore) + ' — ' + capR.label + ' (риск ВТЭО ' + capR.pct + ')');
  }

  // --- HAS-BLED ---
  if (isScaleActive('hasbled')) {
    var hbScore = calcHASBLED();
    var hbR = hasbledRisk(hbScore);

    var hbHint = '';
    if (hbScore >= 3) {
      var modFactors = [];
      if (cb('hb_htn'))   modFactors.push('АД >160 мм рт.ст.');
      if (cb('hb_inr'))   modFactors.push('лабильное МНО');
      if (cb('hb_drugs')) modFactors.push('приём НПВП/антиагрегантов');
      if (cb('hb_alcohol')) modFactors.push('злоупотребление алкоголем');
      if (modFactors.length > 0) hbHint = 'Устранить модифицируемые факторы: ' + modFactors.join('; ') + '.';
    }

    resultsHTML += makeResultCard(
      'HAS-BLED',
      hbScore + ' ' + pluralizeBalls(hbScore),
      hbR.label,
      hbR.risk,
      'Счёт ' + hbScore + ' из 9',
      hbHint
    );
    copyLines.push('HAS-BLED: ' + hbScore + ' ' + pluralizeBalls(hbScore) + ' — ' + hbR.label);
  }

  // --- CHA2DS2-VASc ---
  if (isScaleActive('cha2ds2') && age) {
    var chaScore = calcCHA2DS2VASc(age, sex);
    var chaR = chaRisk(chaScore, sex);
    resultsHTML += makeResultCard(
      'CHA₂DS₂-VASc',
      chaScore + ' ' + pluralizeBalls(chaScore),
      chaR.label,
      chaR.risk,
      'Счёт ' + chaScore,
      sex === 'm'
        ? (chaScore === 0 ? 'Антикоагуляция не показана.'
          : chaScore === 1 ? 'Антикоагуляция может рассматриваться индивидуально.'
          : 'Антикоагуляция показана (ПОАК предпочтительнее варфарина).')
        : (chaScore <= 1 ? 'Антикоагуляция не показана (пол как единственный фактор).'
          : chaScore === 2 ? 'Антикоагуляция может рассматриваться.'
          : 'Антикоагуляция показана.')
    );
    copyLines.push('CHA₂DS₂-VASc: ' + chaScore + ' ' + pluralizeBalls(chaScore) + ' — ' + chaR.label);
  }

  // --- PESI / sPESI ---
  if (isScaleActive('pesi')) {
    var pesi  = calcPESI();
    var spesi = calcSPESI();

    resultsHTML += makeResultCard(
      'PESI (ТЭЛА)',
      pesi.score + ' баллов (класс ' + pesi.class + ')',
      '30‑дневная летальность: ' + pesi.mortality,
      pesi.score <= 85 ? 'low' : (pesi.score <= 125 ? 'moderate' : 'high'),
      'Полный PESI',
      ''
    );

    var spesiRiskClass = (spesi.points === 0) ? 'low' : (spesi.points === 1 ? 'moderate' : 'high');
    resultsHTML += makeResultCard(
      'sPESI (упрощённый)',
      spesi.points + ' балл(ов)',
      spesi.risk + ' | 30‑дневная летальность ' + spesi.mortality,
      spesiRiskClass,
      'Упрощённая шкала',
      (spesi.points === 0) ? 'Возможно амбулаторное лечение' : 'Показана госпитализация'
    );

    copyLines.push('PESI: ' + pesi.score + ' баллов, класс ' + pesi.class + ', летальность ' + pesi.mortality);
    copyLines.push('sPESI: ' + spesi.points + ' баллов — ' + spesi.risk);
  }

  // --- Wells ---
  if (isScaleActive('wells')) {
    var wellsScore          = calcWells();
    var wR3                 = wellsRisk3(wellsScore);
    var wR2                 = wellsRisk2(wellsScore);
    var wellsScoreFormatted = formatWellsScore(wellsScore);

    var wellsDetails =
      '<div style="margin-bottom:4px;font-size:13px;">' +
        '<span style="font-weight:600;">Трёхуровневая оценка:</span> ' + wR3.label + ' (' + wR3.pct + ')' +
      '</div>' +
      '<div style="font-size:13px;">' +
        '<span style="font-weight:600;">Двухуровневая оценка:</span> ' + wR2.label +
        (wellsScore <= 4 ? ' (≤4 баллов)' : ' (>4 баллов)') +
      '</div>';

    var wellsIsAlarm = (wR3.risk === 'high' || wR2.likely);
    var wellsHint = '';

    if (wellsIsAlarm) {
      wellsHint = 'Показана КТ-ангиопульмонография без предварительного определения D-димера.';
    } else {
      var wellsAge = parseNum('age');
      if (wellsAge !== null && wellsAge > 50) {
        wellsHint = 'Определить D-димер (предпочтительно высокочувствительным методом). ' +
          'Возрастной порог: ' + (wellsAge * 10) + ' мкг/л. ' +
          'При отрицательном результате ТЭЛА может быть исключена. ' +
          'При положительном — показана КТ-ангиопульмонография.';
      } else {
        wellsHint = 'Определить D-димер (предпочтительно высокочувствительным методом). ' +
          'При отрицательном результате ТЭЛА может быть исключена. ' +
          'При положительном — показана КТ-ангиопульмонография.';
      }
    }

    resultsHTML += makeResultCard(
      'Wells — вероятность ТЭЛА',
      wellsScoreFormatted + ' ' + pluralizeBallsWells(wellsScore),
      wR3.label,
      wR3.risk,
      wellsDetails,
      wellsHint
    );

    var wellsCopyR2 = wR2.likely ? 'ТЭЛА вероятна' : 'ТЭЛА маловероятна';
    copyLines.push('Wells: ' + wellsScoreFormatted + ' ' + pluralizeBallsWells(wellsScore) +
      ' — ' + wR3.label.toLowerCase() + '. По двухуровневой модели — ' + wellsCopyR2.toLowerCase() + '.');
  }

  // --- Revised Geneva ---
  if (isScaleActive('geneva')) {
    var genevaScore = calcGeneva();
    var gR3 = genevaRisk3(genevaScore);
    var gR2 = genevaRisk2(genevaScore);

    var genevaDetails =
      '<div style="margin-bottom:4px;font-size:13px;">' +
        '<span style="font-weight:600;">Трёхуровневая оценка:</span> ' + gR3.label + ' (' + gR3.pct + ')' +
      '</div>' +
      '<div style="font-size:13px;">' +
        '<span style="font-weight:600;">Двухуровневая оценка:</span> ' + gR2.label +
        (genevaScore <= 5 ? ' (0–5 баллов)' : ' (≥6 баллов)') +
      '</div>';

    var genevaIsAlarm = (gR3.risk === 'high' || gR2.likely);
    var genevaHint = '';

    if (genevaIsAlarm) {
      genevaHint = 'Показана КТ-ангиопульмонография без предварительного определения D-димера.';
    } else {
      var genevaAge = parseNum('age');
      if (genevaAge !== null && genevaAge > 50) {
        genevaHint = 'Определить D-димер (предпочтительно высокочувствительным методом). ' +
          'Возрастной порог: ' + (genevaAge * 10) + ' мкг/л. ' +
          'При отрицательном результате ТЭЛА может быть исключена. ' +
          'При положительном — показана КТ-ангиопульмонография.';
      } else {
        genevaHint = 'Определить D-димер (предпочтительно высокочувствительным методом). ' +
          'При отрицательном результате ТЭЛА может быть исключена. ' +
          'При положительном — показана КТ-ангиопульмонография.';
      }
    }

    resultsHTML += makeResultCard(
      'Revised Geneva — вероятность ТЭЛА',
      genevaScore + ' ' + pluralizeBalls(genevaScore),
      gR3.label,
      gR3.risk,
      genevaDetails,
      genevaHint
    );

    var genevaCopyR2 = gR2.likely ? 'ТЭЛА вероятна' : 'ТЭЛА маловероятна';
    copyLines.push('Revised Geneva: ' + genevaScore + ' ' + pluralizeBalls(genevaScore) +
      ' — ' + gR3.label.toLowerCase() + '. По двухуровневой модели — ' + genevaCopyR2.toLowerCase() + '.');
  }

  // --- PRECISE-DAPT ---
  if (isScaleActive('precise') && age && sex && weight && creat && hb !== null && wbc !== null) {
    var pd = calculatePreciseDapt();
    if (pd !== null) {
      var pdRiskLabel = pd.risk === 'high' ? 'Высокий риск кровотечения'
        : pd.risk === 'moderate' ? 'Умеренный риск кровотечения'
        : pd.risk === 'low' ? 'Низкий риск кровотечения'
        : 'Очень низкий риск кровотечения';
      var pdRiskClass = pd.risk === 'high' ? 'high' : pd.risk === 'moderate' ? 'moderate' : 'low';
      var pdInfoId = 'precise_info_' + Date.now();
      var pdHint = 'Баллы ≥25 — рассмотрите короткую ДАТТ (3–6 мес) после ЧКВ; при <25 рекомендована стандартная ДАТТ (12 мес).' +
        '<span class="info-icon" id="' + pdInfoId + '" style="cursor:help;font-size:16px;opacity:0.6;vertical-align:middle;margin-left:6px;">ⓘ</span>';
      resultsHTML += makeResultCard(
        'PRECISE-DAPT',
        pd.score + ' ' + pluralizeBalls(pd.score),
        pdRiskLabel,
        pdRiskClass,
        '',
        pdHint
      );
      setTimeout(function() {
        var icon = document.getElementById(pdInfoId);
        if (icon) setupTooltipTrigger(icon,
          'Шкала помогает подобрать длительность двойной антиагрегантной терапии (ДАТТ) после ЧКВ. ' +
          'Баллы ≥25 — высокий риск кровотечения: целесообразна короткая ДАТТ (3–6 мес) с переходом на монотерапию. ' +
          'При баллах <25 стандартная ДАТТ (12 мес) обычно допустима. ' +
          'Решение принимайте индивидуально — с учётом ишемического риска, сопутствующих заболеваний и общего состояния пациента; ' +
          'при изменении функции почек или гемоглобина шкалу стоит пересчитать.');
      }, 50);
      copyLines.push('PRECISE-DAPT: ' + pd.score + ' ' + pluralizeBalls(pd.score) + ' — ' + pdRiskLabel.toLowerCase());
    }
  }

  // --- SCORE2: сердечно-сосудистый риск и липиды ---
  if (isScaleActive('score2')) {
    var s2egfr = null;
    if (age && sex && creat) {
      s2egfr = calcCKDEPI(age, sex, creat);
    }
    var s2ctx = {
      age: age, sex: sex, sbp: sbp, tchol: tchol, hdl: hdl, tg: tg, ldl: ldlLab,
      hba1c: hba1c, dmAge: dmAge, dm: dm, dm20: dm20, tod: dmTod,
      mi: cb('cb_mi'), stroke: cb('cb_stroke'), tia: cb('cb_tia'), vasc: cb('cb_vasc'),
      sghs: cb('cb_sghs'), htn: cb('cb_htn'), events2: cb('score2_2events'),
      fhCvd: cb('cb_fh_cvd'), fhLip: cb('cb_fh_lip'), asb50: cb('cb_asb50'),
      ath25: cb('cb_ath25'), gosghs: cb('cb_gosghs'), weight: weight, height: height,
      smoking: smoking, egfr: s2egfr
    };
    var s2out = buildScore2Result(s2ctx);
    if (s2out.html) resultsHTML += s2out.html;
    if (s2out.copy) copyLines.push(s2out.copy);
  }

  if (errors.length > 0) {
    showToast(errors.map(function(e) { return e.msg; }).join(', '), 'error');
    highlightErrorFields(errors.map(function(e) { return e.field; }));
    return;
  }

  // Оранжевое предупреждение о значениях вне диапазона (не блокирует расчёт)
  var rangeWarnings = getRangeWarnings();
  applyRangeWarnings();
  updateCalcButtonWarnings(rangeWarnings);

  document.getElementById('resultsGrid').innerHTML = resultsHTML;
  document.getElementById('copyText').textContent  = copyLines.map(function(s) { return '- ' + s; }).join('\n');
  document.getElementById('results').style.display = 'block';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}