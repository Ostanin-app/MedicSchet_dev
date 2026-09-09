/* periop_data.js — референс-данные модуля «Перед операцией» (МедикСчет)
 * Источник: 2024 AHA/ACC Guideline for Perioperative Cardiovascular Management
 * for Noncardiac Surgery. Свои добавки не вносим.
 * Работает и в браузере (window.PeriopData), и в Node (module.exports).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PeriopData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Категории операций — раздел 1.5 (риск MACCE: наивысший/промежуточный/наименьший)
  var SURGERIES = [
    { id: 'vascular', label: 'Сосудистая (выше паховой связки)', macce: 'highest', rcriHigh: true },
    { id: 'thoracic', label: 'Торакальная', macce: 'highest', rcriHigh: true },
    { id: 'transplant', label: 'Трансплантация', macce: 'highest', rcriHigh: null, askIntraperitoneal: true },
    { id: 'neuro', label: 'Нейрохирургия', macce: 'highest', rcriHigh: false },
    { id: 'general', label: 'Общая хирургия', macce: 'intermediate', rcriHigh: null, askIntraperitoneal: true },
    { id: 'ent', label: 'ЛОР', macce: 'intermediate', rcriHigh: false },
    { id: 'urology', label: 'Урология', macce: 'intermediate', rcriHigh: false },
    { id: 'ortho', label: 'Ортопедия', macce: 'intermediate', rcriHigh: false },
    { id: 'endocrine', label: 'Эндокринные операции', macce: 'lowest', rcriHigh: false },
    { id: 'breast', label: 'Молочная железа', macce: 'lowest', rcriHigh: false },
    { id: 'gyn', label: 'Гинекология / акушерство', macce: 'lowest', rcriHigh: null, askIntraperitoneal: true },
    { id: 'unknown', label: 'Не знаю / другое', macce: null, rcriHigh: null }
  ];

  // Срочность — Table 2 (раздел 1.5)
  var URGENCIES = [
    { id: 'elective', label: 'Плановая' },
    { id: 'timeSensitive', label: 'Time-sensitive (можно отложить до 3 мес)' },
    { id: 'urgent', label: 'Срочная (2–24 ч)' },
    { id: 'emergency', label: 'Экстренная (<2 ч)' }
  ];

  // RCRI — 6 критериев (Table 4). Расчёт в движке; здесь подписи.
  var RCRI_ITEMS = [
    { id: 'ihd', label: 'ИБС (инфаркт в анамнезе, стенокардия)' },
    { id: 'cvd', label: 'ЦВБ (инсульт/ТИА в анамнезе)' },
    { id: 'hf', label: 'ХСН в анамнезе' },
    { id: 'dmInsulin', label: 'Сахарный диабет на инсулине' },
    { id: 'crea177', label: 'Креатинин ≥2,0 мг/дл (≈177 мкмоль/л)' },
    { id: 'highRiskSurg', label: 'Высокорисковая операция (внутрибрюшная / внутригрудная / сосудистая)' }
  ];

  // Препараты — разделы 7.1–7.8. stopDays: null = «продолжать»; число = дней; текст = особый случай.
  var DRUGS = [
    { id: 'statin', label: 'Статин', stopDays: null, action: 'Продолжать домашнюю дозу; не задерживать операцию ради ЛПНП; не начинать рутинно перед операцией (7.1).' },
    { id: 'bbChronic', label: 'Бета-блокатор (принимает давно)', stopDays: null, action: 'Продолжать, титровать по гемодинамике; продолжить на выписку; резко не отменять (7.7).' },
    { id: 'bbNew', label: 'Бета-блокатор (нужно начать)', stopDays: null, action: 'Не начинать в день операции; при необходимости — ≥7 дней до операции, только при ясных показаниях (7.7).' },
    { id: 'aceiArb', label: 'иАПФ / БРА', stopDays: null, action: 'Индивидуально: продолжение чаще даёт интраоперационную гипотензию, исходы не хуже; при ХСН с ФВ<40% перерыв минимизировать; вариант — пропустить утреннюю дозу в день операции (7.2).' },
    { id: 'ccb', label: 'Блокатор кальциевых каналов', stopDays: null, action: 'Продолжение разумно; учесть гипотензию (дигидропиридины) и брадикардию (верапамил/дилтиазем) (7.3).' },
    { id: 'clonidine', label: 'Клонидин / альфа-2 агонисты', stopDays: null, action: 'Не начинать (POISE-2); при хроническом приёме не отменять резко — рикошетная гипертензия (7.4).' },
    { id: 'aspirinSecondary', label: 'Аспирин (вторичная профилактика / иные показания)', stopDays: 4, action: 'Продолжение или прерывание — мультидисциплинарное решение; при прерывании минимум 4 дня до операции (7.5).' },
    { id: 'aspirinPrimary', label: 'Аспирин (только первичная профилактика)', stopDays: 4, action: 'Можно прервать; командный консенсус не требуется (7.5).' },
    { id: 'clopidogrel', label: 'Клопидогрел', stopDays: '5–7', action: 'Минимум 5–7 дней до операции (Table 12).' },
    { id: 'prasugrel', label: 'Прасугрел', stopDays: '7–10', action: 'Минимум 7–10 дней до операции (Table 12).' },
    { id: 'ticagrelor', label: 'Тикагрелор', stopDays: '3–5', action: 'Минимум 3–5 дней до операции (Table 12).' },
    { id: 'warfarin', label: 'Варфарин', stopDays: 5, action: 'Отменить за 5 дней; мост — только очень высокий тромботический риск; возобновление через 12–24 ч после гемостаза (7.6).' },
    { id: 'rivaroxaban', label: 'Ривароксабан', stopDays: 3, action: 'Отменить за ≥3 дней до операции (7.6).' },
    { id: 'apixaban', label: 'Апиксабан', stopDays: 3, action: 'Отменить за ≥3 дней до операции (7.6).' },
    { id: 'edoxaban', label: 'Эдоксабан', stopDays: 3, action: 'Отменить за ≥3 дней до операции (7.6).' },
    { id: 'dabigatran', label: 'Дабигатран', stopDays: '4 (5–6 при ClCr <50)', action: 'Отменить за ≥4 дней; 5–6 дней при ClCr <50 мл/мин (7.6).' },
    { id: 'sglt2', label: 'SGLT2-ингибитор (дапаглифлозин, эмпаглифлозин и др.)', stopDays: '3–4', action: 'Отменить за 3–4 дня до операции (риск кетоацидоза); возобновить, когда пациент стабилен и ест нормально (7.8).' },
    { id: 'glp1Weekly', label: 'ГПП-1 недельный (семаглутид и др.)', stopDays: '>7 дней', action: 'Пропустить приём >1 недели до операции (риск аспирации; консенсус ASA) (7.8).' },
    { id: 'glp1Daily', label: 'ГПП-1 дневной', stopDays: 1, action: 'Пропустить приём за день до операции (7.8).' },
    { id: 'metformin', label: 'Метформин', stopDays: null, action: 'Оснований для отмены нет: современные данные — не связан с лактатацидозом (7.8).' }
  ];

  return {
    SURGERIES: SURGERIES,
    URGENCIES: URGENCIES,
    RCRI_ITEMS: RCRI_ITEMS,
    DRUGS: DRUGS,
    // Подсказка риска операции по категории (1.5); null = решает врач.
    riskHint: function (opType) {
      var s = null;
      for (var i = 0; i < SURGERIES.length; i++) if (SURGERIES[i].id === opType) s = SURGERIES[i];
      if (!s) return null;
      if (s.macce === 'lowest') return 'low';
      if (s.macce === 'highest') return 'elevated';
      return null; // intermediate — врач решает после вкладки «Риск»
    },
    findDrug: function (id) {
      for (var i = 0; i < DRUGS.length; i++) if (DRUGS[i].id === id) return DRUGS[i];
      return null;
    }
  };
});
