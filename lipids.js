// ============================================================================
// ЛИПИДНЫЕ ФОРМУЛЫ: расчёт ЛПНП и не-ЛПНП
//
// Единицы: ммоль/л (ввод) ↔ мг/дл (формулы). Пересчёт: мг/дл = ммоль/л × 38,67
// (холестерин); триглицериды: мг/дл = ммоль/л × 88,57.
//
// Формулы:
//   - Фридвальд (1972):      LDL = TC − HDL − TG/2,2  (ммоль/л), применим при TG ≤ 4,5
//   - Сампсон (NIH 2020):    см. sampsonLdl() — коэффициенты из JAMA Cardiol 2020
//   - Мартин-Хопкинс (2013): см. martinHopkinsLdl() — таблица adjustable factor
//   - не-ЛПВП = TC − HDL
// ============================================================================

var MGDL_TC = 38.67;    // ммоль/л → мг/дл (холестерин, ЛПНП, ЛПВП, не-ЛПВП)
var MGDL_TG = 88.57;    // ммоль/л → мг/дл (триглицериды)

function mmolToMgdl(x)   { return x * MGDL_TC; }
function mgdlToMmol(x)   { return x / MGDL_TC; }
function tgMmolToMgdl(x) { return x * MGDL_TG; }

// Фридвальд: LDL (ммоль/л) = TC − HDL − TG/2,2. Применим при TG ≤ 4,5 ммоль/л.
function friedewaldLdl(tc, hdl, tg) {
  if (tc === null || hdl === null || tg === null) return null;
  if (!isFinite(tc) || !isFinite(hdl) || !isFinite(tg)) return null;
  if (tc <= 0 || hdl <= 0 || tg < 0) return null;
  var ldl = tc - hdl - tg / 2.2;
  if (ldl < 0) return null; // физически невозможное отрицательное значение
  return ldl;
}

// Сампсон (NIH 2020): LDL (мг/дл) = TC/0.948 − HDL/0.971
//   − [ TG/8.56 + (TG × nonHDL)/2140 − TG²/16100 ] − 9.44
// Коэффициенты сверены с оригиналом: Sampson et al., JAMA Cardiol 2020;5(5):540-548,
// Equation 2 («LDL-C = TC/0.948 − HDL-C/0.971 − (TG/8.56 + TG×Non-HDL-C/2140 − TG²/16100) − 9.44»).
// Применим до TG ≤ 800 мг/дл.
function sampsonLdl(tc, hdl, tg) {
  if (tc === null || hdl === null || tg === null) return null;
  if (!isFinite(tc) || !isFinite(hdl) || !isFinite(tg)) return null;
  if (tc <= 0 || hdl <= 0 || tg < 0) return null;
  var tcMg = mmolToMgdl(tc);
  var hdlMg = mmolToMgdl(hdl);
  var tgMg = tgMmolToMgdl(tg);
  // При ТГ > 800 мг/дл (≈ 9 ммоль/л) формула даёт лишь ориентир:
  // предупреждение об этом показывает selectWorkingLdl (критерий ЛПНП ≥ 4,9 при ТГ > 9 не срабатывает)
  var nonHdlMg = tcMg - hdlMg;
  var ldlMg = tcMg / 0.948 - hdlMg / 0.971
            - (tgMg / 8.56 + (tgMg * nonHdlMg) / 2140 - tgMg * tgMg / 16100)
            - 9.44;
  if (ldlMg < 0) return null; // физически невозможное отрицательное значение
  return mgdlToMmol(ldlMg);
}

// Мартин-Хопкинс (JAMA 2013): LDL (мг/дл) = nonHDL − TG / f,
// где f — медианное отношение TG:VLDL-C из таблицы 360 ячеек (eTable 2B приложения).
// 180- и 360-ячеечные таблицы дают практически одинаковый результат
// (в статье: «LDL-C180 and LDL-C360 were within 0.5% of each other»).
// Источник: Martin SS et al. JAMA 2013;310(19):2061-8, Supplement eTable 2B.
var MH_NONHDL_STRATA = [100, 130, 160, 190, 220];  // 6 колонок не-ЛПВП (мг/дл)
var MH_TG_STRATA = [7, 45, 50, 54, 57, 60, 62, 65, 67, 69, 71, 73, 76, 78, 80, 82, 84, 86, 88, 90,
                    92, 94, 96, 98, 101, 103, 105, 107, 110, 112, 115, 117, 120, 122, 125, 128,
                    131, 134, 137, 141, 144, 148, 152, 156, 160, 165, 170, 175, 181, 188, 195,
                    203, 212, 222, 234, 249, 268, 293, 331, 400];  // 60 строк ТГ (мг/дл)

var MARTIN_HOPKINS_FACTORS = [
  // <100  100-129  130-159  160-189  190-219  ≥220  | TG, мг/дл
  [3.3, 3.2, 3.1, 3.0, 2.9, 2.7],   // 7-44
  [3.8, 3.5, 3.5, 3.4, 3.3, 3.2],   // 45-49
  [4.0, 3.8, 3.6, 3.6, 3.5, 3.3],   // 50-53
  [4.2, 3.9, 3.9, 3.7, 3.6, 3.4],   // 54-56
  [4.2, 4.1, 3.9, 3.8, 3.7, 3.6],   // 57-59
  [4.4, 4.1, 4.0, 4.0, 3.8, 3.8],   // 60-61
  [4.5, 4.2, 4.1, 4.0, 3.9, 3.7],   // 62-64
  [4.6, 4.3, 4.1, 4.1, 4.1, 3.9],   // 65-66
  [4.5, 4.5, 4.2, 4.2, 3.9, 3.8],   // 67-68
  [4.7, 4.4, 4.3, 4.1, 4.1, 3.8],   // 69-70
  [4.7, 4.5, 4.2, 4.2, 4.2, 4.0],   // 71-72
  [4.9, 4.6, 4.4, 4.3, 4.2, 4.1],   // 73-75
  [4.8, 4.5, 4.5, 4.3, 4.2, 4.1],   // 76-77
  [4.9, 4.6, 4.4, 4.3, 4.3, 4.2],   // 78-79
  [5.0, 4.7, 4.5, 4.4, 4.3, 4.2],   // 80-81
  [5.1, 4.8, 4.6, 4.4, 4.4, 4.2],   // 82-83
  [5.0, 4.7, 4.7, 4.5, 4.4, 4.3],   // 84-85
  [5.1, 4.8, 4.6, 4.5, 4.5, 4.3],   // 86-87
  [5.2, 4.9, 4.7, 4.4, 4.4, 4.2],   // 88-89
  [5.3, 5.0, 4.7, 4.6, 4.5, 4.3],   // 90-91
  [5.2, 4.9, 4.8, 4.6, 4.4, 4.4],   // 92-93
  [5.3, 5.0, 4.8, 4.5, 4.5, 4.3],   // 94-95
  [5.3, 5.1, 4.8, 4.6, 4.6, 4.4],   // 96-97
  [5.4, 5.2, 4.9, 4.7, 4.5, 4.3],   // 98-100
  [5.6, 5.1, 4.9, 4.6, 4.6, 4.4],   // 101-102
  [5.5, 5.2, 5.0, 4.7, 4.7, 4.5],   // 103-104
  [5.5, 5.3, 5.0, 4.8, 4.6, 4.6],   // 105-106
  [5.6, 5.3, 5.0, 4.7, 4.7, 4.5],   // 107-109
  [5.8, 5.3, 5.0, 4.8, 4.6, 4.6],   // 110-111
  [5.7, 5.4, 5.1, 4.9, 4.7, 4.5],   // 112-114
  [5.8, 5.5, 5.2, 4.8, 4.8, 4.6],   // 115-116
  [5.9, 5.4, 5.1, 5.0, 4.8, 4.6],   // 117-119
  [6.0, 5.5, 5.2, 5.0, 4.8, 4.6],   // 120-121
  [5.9, 5.6, 5.3, 5.0, 4.8, 4.6],   // 122-124
  [6.0, 5.7, 5.3, 5.0, 4.8, 4.6],   // 125-127
  [6.1, 5.7, 5.4, 5.1, 4.9, 4.7],   // 128-130
  [6.0, 5.7, 5.3, 5.1, 4.9, 4.7],   // 131-133
  [6.2, 5.8, 5.4, 5.2, 5.0, 4.7],   // 134-136
  [6.3, 5.8, 5.5, 5.2, 5.0, 4.8],   // 137-140
  [6.2, 5.9, 5.5, 5.3, 5.1, 4.9],   // 141-143
  [6.4, 5.9, 5.6, 5.3, 5.1, 4.8],   // 144-147
  [6.5, 6.0, 5.6, 5.4, 5.1, 4.8],   // 148-151
  [6.6, 6.1, 5.7, 5.4, 5.2, 4.9],   // 152-155
  [6.6, 6.1, 5.8, 5.4, 5.2, 4.9],   // 156-159
  [6.7, 6.2, 5.8, 5.5, 5.2, 4.9],   // 160-164
  [6.8, 6.3, 5.9, 5.5, 5.3, 5.0],   // 165-169
  [6.9, 6.4, 6.0, 5.6, 5.3, 5.0],   // 170-174
  [7.0, 6.4, 6.0, 5.6, 5.4, 5.0],   // 175-180
  [7.1, 6.5, 6.1, 5.8, 5.4, 5.1],   // 181-187
  [7.3, 6.6, 6.2, 5.8, 5.5, 5.2],   // 188-194
  [7.4, 6.7, 6.3, 5.9, 5.6, 5.2],   // 195-202
  [7.5, 6.8, 6.4, 6.0, 5.6, 5.3],   // 203-211
  [7.6, 7.0, 6.5, 6.1, 5.7, 5.4],   // 212-221
  [7.9, 7.2, 6.6, 6.2, 5.8, 5.4],   // 222-233
  [8.1, 7.3, 6.7, 6.3, 5.9, 5.5],   // 234-248
  [8.4, 7.5, 6.9, 6.4, 6.0, 5.6],   // 249-267
  [8.6, 7.7, 7.1, 6.6, 6.2, 5.6],   // 268-292
  [9.2, 8.1, 7.3, 6.8, 6.3, 5.8],   // 293-330
  [9.9, 8.6, 7.8, 7.2, 6.7, 6.0],   // 331-399
  [11.9, 10.0, 8.8, 8.1, 7.5, 6.7]  // 400-13975
];

function martinHopkinsLdl(tc, hdl, tg) {
  if (tc === null || hdl === null || tg === null) return null;
  if (!isFinite(tc) || !isFinite(hdl) || !isFinite(tg)) return null;
  if (tc <= 0 || hdl <= 0 || tg < 0) return null;
  if (!MARTIN_HOPKINS_FACTORS) return null;
  var nonHdlMg = mmolToMgdl(tc) - mmolToMgdl(hdl);
  var tgMg = tgMmolToMgdl(tg);
  var f = martinHopkinsFactor(nonHdlMg, tgMg);
  if (f === null) return null;
  var ldlMg = nonHdlMg - tgMg / f;
  if (ldlMg < 0) return null; // физически невозможное отрицательное значение
  return mgdlToMmol(ldlMg);
}

function martinHopkinsFactor(nonHdlMg, tgMg) {
  if (!MARTIN_HOPKINS_FACTORS) return null;
  var row = 0;
  for (var i = 0; i < MH_TG_STRATA.length; i++) {
    if (tgMg >= MH_TG_STRATA[i]) row = i;
  }
  var col = 0;
  for (var j = 0; j < MH_NONHDL_STRATA.length; j++) {
    if (nonHdlMg >= MH_NONHDL_STRATA[j]) col = j + 1;
  }
  if (row >= MARTIN_HOPKINS_FACTORS.length) row = MARTIN_HOPKINS_FACTORS.length - 1;
  if (col >= MARTIN_HOPKINS_FACTORS[0].length) col = MARTIN_HOPKINS_FACTORS[0].length - 1;
  return MARTIN_HOPKINS_FACTORS[row][col];
}

// не-ЛПВП (ммоль/л) = TC − HDL
function nonHdl(tc, hdl) {
  if (tc === null || hdl === null) return null;
  if (!isFinite(tc) || !isFinite(hdl)) return null;
  if (tc <= 0 || hdl <= 0) return null;
  return tc - hdl;
}

// Удобная обёртка: возвращает все применимые формулы для карточки результата.
// { friedewald, sampson, martinHopkins, nonHdl, labLdl, tgTooHighFriedewald }
function calcLipids(tc, hdl, tg, labLdl) {
  var out = { nonHdl: nonHdl(tc, hdl), labLdl: labLdl || null };
  var tgHigh = tg !== null && isFinite(tg) && tg > 4.5;
  out.friedewald = friedewaldLdl(tc, hdl, tg);
  out.tgTooHighFriedewald = !!tgHigh;
  if (out.friedewald !== null && tgHigh) out.friedewald = null; // неприменим
  out.sampson = sampsonLdl(tc, hdl, tg);
  out.martinHopkins = martinHopkinsLdl(tc, hdl, tg);
  return out;
}

// ============================================================================
// Выбор рабочего ЛПНП для расчёта цели и процента снижения.
// Приоритет (согласно гайдлайнам ACC/AHA 2018, ESC 2019/2021):
//   1. Лабораторный ЛПНП (прямое измерение) — всегда приоритет
//   2. Если лабораторного нет — выбор формулы по уровню ТГ:
//      - ТГ ≤ 2,0 ммоль/л → Фридвальд (достаточно точен)
//      - ТГ 2,0–4,5 ммоль/л → Мартин-Хопкинс (точнее Фридвальда)
//      - ТГ 4,5–9,0 ммоль/л → Сампсон (создан для высоких ТГ)
//      - ТГ > 9,0 ммоль/л → формулы ненадёжны, нужно прямое измерение
// Возвращает: { value, source, sourceLabel, warning }
// ============================================================================
function selectWorkingLdl(labLdl, lip, tg) {
  // Приоритет 1: лабораторный ЛПНП
  if (labLdl !== null && isFinite(labLdl) && labLdl > 0) {
    return { value: labLdl, source: 'lab', sourceLabel: 'лаборатория', warning: null };
  }

  // Если ТГ не введены — пробуем любую доступную формулу
  if (tg === null || !isFinite(tg)) {
    if (lip) {
      if (lip.friedewald !== null) return { value: lip.friedewald, source: 'friedewald', sourceLabel: 'Фридвальд', warning: null };
      if (lip.martinHopkins !== null) return { value: lip.martinHopkins, source: 'martinHopkins', sourceLabel: 'Мартин-Хопкинс', warning: null };
      if (lip.sampson !== null) return { value: lip.sampson, source: 'sampson', sourceLabel: 'Сампсон', warning: null };
    }
    return { value: null, source: 'none', sourceLabel: null, warning: 'Недостаточно данных для расчёта ЛПНП' };
  }

  // Приоритет 2: выбор формулы по уровню ТГ
  if (tg <= 2.0) {
    // Фридвальд — точен при низких ТГ
    if (lip && lip.friedewald !== null) {
      return { value: lip.friedewald, source: 'friedewald', sourceLabel: 'Фридвальд', warning: null };
    }
  } else if (tg <= 4.5) {
    // Мартин-Хопкинс — точнее при умеренно повышенных ТГ
    if (lip && lip.martinHopkins !== null) {
      return { value: lip.martinHopkins, source: 'martinHopkins', sourceLabel: 'Мартин-Хопкинс', warning: null };
    }
  } else {
    // ТГ > 4,5 — Сампсон (валидирован до ТГ ≤ 9 ммоль/л)
    if (lip && lip.sampson !== null) {
      var sampsonWarning = null;
      if (tg > 9.0) {
        sampsonWarning = 'Формула Сампсона валидирована при ТГ ≤ 9,0 ммоль/л (≈800 мг/дл). ' +
          'При более высоких значениях она используется только ориентировочно; для критерия ЛПНП ≥ 4,9 ммоль/л ' +
          'такой расчёт вне валидированного диапазона. Желательно прямое измерение ЛПНП; ориентируйтесь также на не-ЛПВП.';
      }
      return { value: lip.sampson, source: 'sampson', sourceLabel: 'Сампсон', warning: sampsonWarning };
    }
  }

  return { value: null, source: 'none', sourceLabel: null, warning: 'Недостаточно данных для расчёта ЛПНП' };
}