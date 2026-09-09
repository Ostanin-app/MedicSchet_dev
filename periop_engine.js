/* periop_engine.js — движок вердикта модуля «Перед операцией» (МедикСчет)
 * Изолированная логика: вход — ответы вкладок + RCRI-факторы; выход — вердикт и тексты.
 * Источник: 2024 AHA/ACC Guideline for Perioperative Cardiovascular Management
 * for Noncardiac Surgery (номера разделов в текстах).
 * Браузер: window.PeriopEngine; Node: module.exports.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./periop_data.js'));
  else root.PeriopEngine = factory(root.PeriopData);
})(typeof self !== 'undefined' ? self : this, function (PeriopData) {
  'use strict';

  function has(v) { return v === true; }

  // RCRI: пункт «высокорисковая операция» вычисляется по типу операции (Table 4, 1.5)
  function rcriHighRiskSurgery(opType, opIntraperitoneal) {
    if (opType === 'vascular' || opType === 'thoracic') return true;
    if (opType === 'general' || opType === 'gyn' || opType === 'transplant') return opIntraperitoneal === true;
    return false;
  }

  function computeRcri(input) {
    var r = input.rcri || {};
    var highRiskSurg = (typeof r.highRiskSurg === 'boolean') ? r.highRiskSurg : rcriHighRiskSurgery(input.opType, input.opIntraperitoneal);
    var items = [
      { code: 'ihd', label: 'ИБС (инфаркт/стенокардия)', active: has(r.ihd) },
      { code: 'cvd', label: 'ЦВБ (инсульт/ТИА)', active: has(r.cvd) },
      { code: 'hf', label: 'ХСН в анамнезе', active: has(r.hf) },
      { code: 'dmInsulin', label: 'СД на инсулине', active: has(r.dmInsulin) },
      { code: 'crea177', label: 'Креатинин ≥2,0 мг/дл', active: has(r.crea177) },
      { code: 'highRiskSurg', label: 'Высокорисковая операция', active: highRiskSurg }
    ];
    var points = 0;
    items.forEach(function (it) { if (it.active) points++; });
    var classLabel = points === 0 ? 'I (низкий)' : points === 1 ? 'II (умеренный)' : points === 2 ? 'III (высокий)' : 'IV (очень высокий)';
    return { points: points, classLabel: classLabel, items: items };
  }

  // Стент-тайминги (7.5): возвращает {level:'ok'|'defer', note}
  function checkStent(pci, urgency) {
    if (!pci || !has(pci.ever)) return { level: 'ok', note: null };
    if (urgency === 'urgent' || urgency === 'emergency') {
      return { level: 'ok', note: 'Срочная/экстренная операция: решение команды; учесть риск ДАТ и срок после ЧКВ (7.5).' };
    }
    var months = (typeof pci.months === 'number') ? pci.months : 0;
    if (pci.balloon) {
      if (urgency === 'elective' && months * 30 < 14) {
        return { level: 'defer', note: 'После баллонной ангиопластики без стента плановая операция — минимум через 14 дней (7.5).' };
      }
      return { level: 'ok', note: 'Баллонная ангиопластика без стента: плановая операция допустима через ≥14 дней (7.5).' };
    }
    var indicationWord = pci.indication === 'acs' ? 'по поводу ОКС' : (pci.indication === 'ccd' ? 'при стабильной ИБС' : 'со стентом (детали неизвестны)');
    var complex = pci.complex === true || pci.indication === 'unknown' || pci.indication == null;
    var threshold = (pci.indication === 'acs' || complex) ? 12 : 6;
    if (urgency === 'elective') {
      if (months < threshold) {
        return { level: 'defer', note: 'ЧКВ ' + indicationWord + ' ' + months + ' мес назад: плановую операцию отложить — рекомендуется ≥' + threshold + ' мес (7.5).' };
      }
      return { level: 'ok', note: 'ЧКВ ' + months + ' мес назад (' + indicationWord + '): срок достаточен для плановой операции (≥' + threshold + ' мес, 7.5).' };
    }
    // timeSensitive
    if (months < 3) {
      return { level: 'defer', note: 'ЧКВ менее 3 мес назад: time-sensitive операцию не рекомендуется; рассмотреть позже (7.5).' };
    }
    return { level: 'ok', note: 'ЧКВ ' + months + ' мес назад: time-sensitive операцию можно рассмотреть (≥3 мес), если польза операции > риска (7.5).' };
  }

  function shortAction(drug) {
    if (!drug) return '';
    if (drug.stopDays !== null) return 'отменить за ' + drug.stopDays;
    if (drug.id === 'bbNew') return 'начать ≥7 дней до операции (не в день операции)';
    if (drug.id === 'clonidine') return 'продолжать (не отменять резко)';
    if (drug.id === 'aceiArb') return 'продолжать (индивидуально; можно пропустить утреннюю дозу в день операции)';
    return 'продолжать';
  }

  function drugNotes(drugs) {
    if (!drugs || !drugs.length) return [];
    return drugs.map(function (id) {
      var d = PeriopData.findDrug(id);
      if (!d) return null;
      return { id: id, label: d.label, action: d.action, short: shortAction(d), stopDays: d.stopDays };
    }).filter(Boolean);
  }

  function evaluate(input) {
    input = input || {};
    var opType = input.opType || 'unknown';
    var opUrgency = input.opUrgency || 'elective';
    var opRisk = input.opRisk || null;
    var unst = input.unstable || {};
    var rcri = computeRcri(input);
    var stent = checkStent(input.pci, opUrgency);
    var drugs = drugNotes(input.drugs);

    var unstableReasons = [];
    if (has(unst.acs)) unstableReasons.push('ОКС (нестабильная стенокардия/ИМ ≤30 дней): лечение по протоколу ОКС; операцию отложить (6.1).');
    if (has(unst.hf)) unstableReasons.push('Декомпенсация ХСН: стабилизация до операции (6.3).');
    if (has(unst.asSympt)) unstableReasons.push('Симптомный тяжёлый АС: клапанная бригада; TAVR/SAVR до плановой операции; при срочной операции повышенного риска — баллонная вальвулопластика как мост (6.4.1).');
    if (has(unst.arrhythmia)) unstableReasons.push('Значимая симптомная аритмия: контроль ритма/ЧСС по показаниям (6.5–6.6).');
    if (has(unst.stroke)) unstableReasons.push('Недавний инсульт/ТИА или нестабильная ЦВБ: оценка невролога, определение сроков (6.7).');

    var recommendations = [];
    var hints = [];
    var minsFlag = false;

    // Особое — АС (6.4.1): известный тяжёлый АС + операция повышенного риска → ЭхоКГ ≤1 года
    if (input.asKnown === true && opRisk === 'elevated') {
      recommendations.push('ЭхоКГ давностью ≤1 года (известный тяжёлый АС, операция повышенного риска; 6.4.1)');
    }
    // СД / глюкоза (7.8)
    if (input.dm && input.hba1c && input.hba1c.recent === false) {
      recommendations.push('Проверить HbA1c (не измерялся за 3 мес; 7.8)');
    }
    if (input.dm && input.hba1c && typeof input.hba1c.value === 'number' && input.hba1c.value > 8) {
      hints.push('HbA1c >8%: может быть разумно отложить элективную операцию; нет доказательств пользы отсрочки; экстренные/time-sensitive не задерживать (7.8).');
    }
    if (input.hba1c && typeof input.hba1c.glucose === 'number' && input.hba1c.glucose >= 11.1) {
      hints.push('Глюкоза ≥11,1 ммоль/л (200 мг/дл) ассоциирована с более высокой смертностью (7.8).');
    }
    // Хрупкость (3.3)
    if (typeof input.age === 'number' && input.age >= 75) {
      hints.push('Возраст ≥75 лет: обратить внимание на хрупкость (слабость, потеря веса, истощение) — фактор риска осложнений (3.3).');
    }
    // Тяжёлая АГ (6.2) — не стоп
    if (has(input.htnSevere)) {
      hints.push('Тяжёлая АГ ≥180/110: продолжать хроническую гипотензивную терапию; АД экстренно не снижать (нет доказательств пользы); решение об отсрочке — с анестезиологом; опираться на амбулаторное АД (6.2).');
    }

    // Вердикт
    var level, title, explanation = [];
    if (unstableReasons.length) {
      level = 'defer';
      title = 'Плановую операцию отложить. Сначала — лечение/стабилизация';
      explanation = unstableReasons;
    } else if (stent.level === 'defer') {
      level = 'defer';
      title = 'Плановую операцию отложить (срок после ЧКВ)';
      explanation = [stent.note];
    } else if (!opRisk) {
      level = 'pending';
      title = 'Укажите риск операции (низкий <1% / повышенный ≥1%)';
      explanation = ['Категория операции — ориентир; итоговый риск зависит и от пациента (1.5).'];
    } else if (opRisk === 'low') {
      level = 'ok';
      title = 'Можно оперировать';
      explanation = ['Риск операции низкий (<1%): дополнительные тесты не требуются; оптимизировать терапию (5.1).'];
    } else { // elevated
      minsFlag = (rcri.points >= 1 || input.dm === true) || false; // известное ССЗ/факторы риска
      if (rcri.points === 0 && input.met4 === true) {
        level = 'ok';
        title = 'Можно оперировать';
        explanation = ['Риск операции повышенный (≥1%), но RCRI = 0 и функциональный статус хороший (≥4 METs): дополнительные тесты не требуются.'];
        minsFlag = false; // нет ССЗ/факторов — MINS-блок не нужен
      } else {
        level = 'caution';
        title = 'Можно, но обсудить с анестезиологом';
        explanation = ['RCRI = ' + rcri.points + ' (класс ' + rcri.classLabel + ').'];
        if (input.met4 === false) explanation.push('Функциональный статус <4 METs (не поднимается на 2 лестничных пролёта) — фактор риска.');
        if (input.met4 == null) explanation.push('Функциональный статус не уточнён.');
        explanation.push('Тесты не рутинно: ЭКГ — при повышенном риске операции/пациента (4.1); ЭхоКГ — при необъяснимых сердечных симптомах или известном/подозреваемом АС (4.2); стресс-тест/визуализация ишемии — только при подозрении на высокорисковую ишемию (симптомы + низкая переносимость нагрузки), если результат изменит тактику (4.3).');
        if (has(input.unexplainedChestPain)) {
          recommendations.push('Дообследование до операции: ЭхоКГ/стресс-тест по ситуации (необъяснимая одышка/боль в груди)');
          level = 'caution';
        }
        if (input.asKnown === true && input.met4 !== false) {
          // уже добавлена ЭхоКГ выше при opRisk elevated
        }
      }
    }

    // MINS (9.1): известное ССЗ/факторы риска + операция повышенного риска
    if (minsFlag && (level === 'ok' || level === 'caution')) {
      // определение: факторы риска считаем по пунктам RCRI/СД/возрасту
      var hasCvdRisk = rcri.points >= 1 || input.dm === true || (typeof input.age === 'number' && input.age >= 65);
      if (hasCvdRisk) {
        // оставляем пометку для блока хирургу (формируется ниже)
      } else {
        minsFlag = false;
      }
    } else {
      minsFlag = false;
    }

    // Сборка текстов
    var opLabels = { vascular: 'сосудистая (выше паховой связки)', thoracic: 'торакальная', transplant: 'трансплантация', neuro: 'нейрохирургия', general: 'общая хирургия', ent: 'ЛОР', urology: 'урология', ortho: 'ортопедия', endocrine: 'эндокринные операции', breast: 'молочная железа', gyn: 'гинекология/акушерство', unknown: 'не уточнена' };
    var urgencyLabel = { elective: 'плановая', timeSensitive: 'time-sensitive', urgent: 'срочная', emergency: 'экстренная' }[opUrgency] || opUrgency;
    var riskLabel = opRisk === 'low' ? 'низкий (<1%)' : opRisk === 'elevated' ? 'повышенный (≥1%)' : 'не указан';

    var metLabel = input.met4 === true ? '≥4 METs (2 лестничных пролёта)' : input.met4 === false ? '<4 METs' : 'не уточнён';
    var historyParts = [
      'Консультация перед операцией: ' + (opLabels[opType] || opType) + ' (' + urgencyLabel + ').',
      'Состояние: ' + (unstableReasons.length ? 'нестабильное — ' + unstableReasons.join(' ') : 'стабильное') + '.',
      'Риск операции: ' + riskLabel + '.',
      'RCRI = ' + rcri.points + ' (класс ' + rcri.classLabel + ').',
      'Функциональный статус: ' + metLabel + '.',
      'Вердикт: ' + title + '.'
    ];
    if (stent.note && level !== 'defer') historyParts.push('ЧКВ: ' + stent.note);
    if (explanation.length) historyParts.push(explanation.join(' '));
    if (recommendations.length) historyParts.push('Рекомендовано: ' + recommendations.join('; ') + '.');
    if (drugs.length) historyParts.push('Лекарства: ' + drugs.map(function (d) { return d.label + ' — ' + d.action; }).join(' '));
    if (hints.length) historyParts.push(hints.join(' '));
    var historyText = historyParts.join('\n');

    var surgeonParts = ['Риск по RCRI — ' + rcri.points + ' (класс ' + rcri.classLabel + ').', 'Вердикт: ' + title + '.'];
    if (drugs.length) surgeonParts.push('Препараты: ' + drugs.map(function (d) { return d.label + ' — ' + d.short + '.'; }).join(' '));
    var specials = [];
    if (stent.note) specials.push(stent.note);
    if (minsFlag) specials.push('После операции: рассмотреть контроль тропонина (MINS; 9.1).');
    if (specials.length) surgeonParts.push('Особое: ' + specials.join(' '));
    var surgeonText = surgeonParts.join(' ');

    return {
      verdict: { level: level, title: title, explanation: explanation },
      rcri: rcri,
      stent: stent,
      drugsNotes: drugs,
      recommendations: recommendations,
      hints: hints,
      minsFlag: minsFlag,
      historyText: historyText,
      surgeonText: surgeonText
    };
  }

  return {
    evaluate: evaluate,
    computeRcri: computeRcri,
    checkStent: checkStent,
    rcriHighRiskSurgery: rcriHighRiskSurgery,
    drugNotes: drugNotes
  };
});
