// ===================================================
//  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ===================================================
var undoStack = [];
var undoDebounceTimer = null;
var skipUndo = false;

var tooltip = document.getElementById('customTooltip');
var tooltipTimeout = null;

// ===================================================
//  ОТМЕНА ИЗМЕНЕНИЙ (UNDO) до 10 шагов
// ===================================================
function saveUndoState() {
  if (skipUndo) return;

  var state = {};

  var inputIds = [
    'age','height','weight','sbp','hr','creatinine','hb','hct','plt','wbc',
    'pesi_rr','pesi_temp','pesi_spo2','emrPaste','ck_total','ck_mb',
    'na_measured','glucose','potassium','magnesium','smoking','tchol','hdl','tg','ldl','hba1c','dm_age'
  ];
  inputIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id] = el.value;
  });

  var sexInput = document.getElementById('sex');
  if (sexInput) state['sex'] = sexInput.value;

  var commonCbIds = ['cb_dm','cb_hf','cb_htn','cb_stroke','cb_tia','cb_embolism','cb_vte','cb_vasc','cb_verapamil','cb_mi','cb_sghs','cb_dm_tod','cb_fh_cvd','cb_fh_lip','cb_asb50','cb_ath25','cb_gosghs'];
  commonCbIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id] = el.checked;
  });

  var allScaleCbIds = [
    'grace_killip',
    'grace_arrest','grace_st','grace_enzymes',
    'crusade_female','crusade_hf','crusade_vasc','crusade_dm',
    'arc_oac','arc_ckd_major','arc_hb_major','arc_bleed6m','arc_plt',
    'arc_diathesis','arc_cirrhosis','arc_cancer','arc_ich_spont',
    'arc_ich_trauma','arc_avm','arc_stroke_severe','arc_surgery30d',
    'arc_surgery_dapt','arc_age75','arc_ckd_minor','arc_hb_minor',
    'arc_bleed12m','arc_nsaid','arc_stroke_any',
    'hb_htn','hb_renal','hb_liver','hb_stroke','hb_bleed','hb_inr',
    'hb_age','hb_drugs','hb_alcohol',
    'cha_hf','cha_htn','cha_age75','cha_dm','cha_stroke','cha_vasc',
    'cha_age65','cha_female',
    'cap_age41','cap_obesity','cap_chf','cap_age61','cap_age75',
    'cap_minor_surgery','cap_varicose','cap_ibd','cap_swollen_legs',
    'cap_acs','cap_sepsis','cap_lung_disease','cap_bedrest',
    'cap_pregnancy','cap_miscarriage','cap_oc','cap_copd',
    'cap_arthroscopy','cap_cancer','cap_laparoscopy','cap_bedrest72',
    'cap_cast','cap_cvc','cap_open_surgery',
    'cap_dvt_hx','cap_fam_dvt','cap_factor_v','cap_prothrombin',
    'cap_lupus','cap_anticardiolipin','cap_heparin_hit',
    'cap_other_thrombophilia','cap_hyperhomocys',
    'cap_elective_hip','cap_hip_fx','cap_spinal_trauma','cap_stroke_5','cap_multiple_trauma',
    'pesi_cancer','pesi_hf','pesi_copd','pesi_altered_mental',
    'wells_dvt_signs','wells_alt_diag','wells_hr','wells_immob',
    'wells_prev_dvt','wells_hemoptysis','wells_cancer',
    'geneva_age','geneva_prev_dvt','geneva_surgery','geneva_cancer',
    'geneva_leg_pain','geneva_hemoptysis','geneva_hr75','geneva_hr95',
    'geneva_dvt_signs',
    'precise_bleed',
    'score2_2events','dm_age20'
  ];

  allScaleCbIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') {
        state[id] = el.checked;
      } else if (el.tagName === 'SELECT') {
        state[id] = el.value;
      }
    }
  });

  // Авто-состояние приёмников онкологии (pesi_cancer/cap_cancer/geneva_cancer)
  // и ХОБЛ (pesi_copd):
  // сохраняем, был ли чекбокс отмечен автоматически из «узких» шкал,
  // чтобы undo и перезагрузка страницы не превращали его в «ручной».
  ['pesi_cancer', 'cap_cancer', 'geneva_cancer', 'pesi_copd', 'cap_swollen_legs', 'wells_immob', 'hb_liver'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) state[id + '_auto'] = el.dataset.cancerAuto === '1';
  });

  undoStack.push(state);
  if (undoStack.length > 11) {
    undoStack.shift();
  }

  updateUndoButton();
}

function performUndo() {
  if (undoStack.length <= 1) return;

  if (undoDebounceTimer) {
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = null;
  }

  undoStack.pop();

  var prevState = undoStack[undoStack.length - 1];

  skipUndo = true;

  var inputIds = [
    'age','height','weight','sbp','hr','creatinine','hb','hct','plt','wbc',
    'pesi_rr','pesi_temp','pesi_spo2','emrPaste','ck_total','ck_mb',
    'na_measured','glucose','potassium','magnesium','smoking','tchol','hdl','tg','ldl','hba1c','dm_age'
  ];
  inputIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && prevState.hasOwnProperty(id)) {
      el.value = prevState[id];
    }
  });

  var sexInput = document.getElementById('sex');
  if (sexInput && prevState.hasOwnProperty('sex')) {
    sexInput.value = prevState['sex'];
  }
  syncSexFromHidden();
  syncSmokingFromHidden();

  var commonCbIds = ['cb_dm','cb_hf','cb_htn','cb_stroke','cb_tia','cb_embolism','cb_vte','cb_vasc','cb_verapamil','cb_mi','cb_sghs','cb_dm_tod','cb_fh_cvd','cb_fh_lip','cb_asb50','cb_ath25','cb_gosghs'];
  commonCbIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && prevState.hasOwnProperty(id)) {
      el.checked = prevState[id];
    }
  });

  var allScaleCbIds = [
    'grace_killip',
    'grace_arrest','grace_st','grace_enzymes',
    'crusade_female','crusade_hf','crusade_vasc','crusade_dm',
    'arc_oac','arc_ckd_major','arc_hb_major','arc_bleed6m','arc_plt',
    'arc_diathesis','arc_cirrhosis','arc_cancer','arc_ich_spont',
    'arc_ich_trauma','arc_avm','arc_stroke_severe','arc_surgery30d',
    'arc_surgery_dapt','arc_age75','arc_ckd_minor','arc_hb_minor',
    'arc_bleed12m','arc_nsaid','arc_stroke_any',
    'hb_htn','hb_renal','hb_liver','hb_stroke','hb_bleed','hb_inr',
    'hb_age','hb_drugs','hb_alcohol',
    'cha_hf','cha_htn','cha_age75','cha_dm','cha_stroke','cha_vasc',
    'cha_age65','cha_female',
    'cap_age41','cap_obesity','cap_chf','cap_age61','cap_age75',
    'cap_minor_surgery','cap_varicose','cap_ibd','cap_swollen_legs',
    'cap_acs','cap_sepsis','cap_lung_disease','cap_bedrest',
    'cap_pregnancy','cap_miscarriage','cap_oc','cap_copd',
    'cap_arthroscopy','cap_cancer','cap_laparoscopy','cap_bedrest72',
    'cap_cast','cap_cvc','cap_open_surgery',
    'cap_dvt_hx','cap_fam_dvt','cap_factor_v','cap_prothrombin',
    'cap_lupus','cap_anticardiolipin','cap_heparin_hit',
    'cap_other_thrombophilia','cap_hyperhomocys',
    'cap_elective_hip','cap_hip_fx','cap_spinal_trauma','cap_stroke_5','cap_multiple_trauma',
    'pesi_cancer','pesi_hf','pesi_copd','pesi_altered_mental',
    'wells_dvt_signs','wells_alt_diag','wells_hr','wells_immob',
    'wells_prev_dvt','wells_hemoptysis','wells_cancer',
    'geneva_age','geneva_prev_dvt','geneva_surgery','geneva_cancer',
    'geneva_leg_pain','geneva_hemoptysis','geneva_hr75','geneva_hr95',
    'geneva_dvt_signs',
    'precise_bleed',
    'score2_2events','dm_age20'
  ];

  allScaleCbIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && prevState.hasOwnProperty(id)) {
      if (el.type === 'checkbox') {
        el.checked = prevState[id];
      } else if (el.tagName === 'SELECT') {
        el.value = prevState[id];
      }
    }
  });

  // Восстанавливаем авто-состояние приёмников онкологии и ХОБЛ; классы и
  // метки «авто» дорисует autofill() → applyCancerAuto()/syncCopdAuto() ниже.
  ['pesi_cancer', 'cap_cancer', 'geneva_cancer', 'pesi_copd', 'cap_swollen_legs', 'wells_immob', 'hb_liver'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && prevState.hasOwnProperty(id + '_auto')) {
      if (prevState[id + '_auto']) {
        el.dataset.cancerAuto = '1';
      } else {
        delete el.dataset.cancerAuto;
      }
    }
  });

  autofill();
  updateFieldVisibility();
  updateAnalysisPanel();

  // После отмены обновляем подсветки: снимаем красные (от старого
  // «Рассчитать») и показываем актуальное оранжевое состояние.
  highlightErrorFields([]);
  applyRangeWarnings();
  updateCalcButtonWarnings(getRangeWarnings());

  updateUndoButton();
  skipUndo = false;
}

function updateUndoButton() {
  var btn = document.getElementById('undoBtn');
  if (!btn) return;
  var countSpan = btn.querySelector('.undo-count');
  var count = undoStack.length - 1;
  if (count < 0) count = 0;
  if (countSpan) countSpan.textContent = count;
  btn.disabled = (undoStack.length <= 1);
}

function scheduleUndo() {
  if (skipUndo) return;
  if (undoDebounceTimer) clearTimeout(undoDebounceTimer);
  undoDebounceTimer = setTimeout(function() {
    saveUndoState();
    undoDebounceTimer = null;
  }, 800);
}

// Полный сброс Undo к чистому базовому состоянию:
// очищает стек, гасит отложенный таймер и сохраняет ровно 1 базовое состояние.
function resetUndoBaseState() {
  if (undoDebounceTimer) {
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = null;
  }
  skipUndo = false;
  undoStack = [];
  saveUndoState();
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    var activeEl = document.activeElement;
    if (activeEl && activeEl.id === 'emrPaste') return;
    e.preventDefault();
    performUndo();
  }
});

function initUndoTracking() {
  var inputFields = [
    'age','height','weight','sbp','hr','creatinine','hb','hct','plt','wbc',
    'pesi_rr','pesi_temp','pesi_spo2','emrPaste','ck_total','ck_mb',
    'na_measured','glucose','potassium','magnesium','smoking','tchol','hdl','tg','ldl','hba1c','dm_age'
  ];
  inputFields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function() {
        scheduleUndo();
      });
    }
  });

  var allTrackedIds = [
    'cb_dm','cb_hf','cb_htn','cb_stroke','cb_tia','cb_embolism','cb_vte','cb_vasc','cb_verapamil','cb_mi','cb_sghs','cb_dm_tod','cb_fh_cvd','cb_fh_lip','cb_asb50','cb_ath25','cb_gosghs','smoking',
    'grace_killip',
    'grace_arrest','grace_st','grace_enzymes',
    'crusade_female','crusade_hf','crusade_vasc','crusade_dm',
    'arc_oac','arc_ckd_major','arc_hb_major','arc_bleed6m','arc_plt',
    'arc_diathesis','arc_cirrhosis','arc_cancer','arc_ich_spont',
    'arc_ich_trauma','arc_avm','arc_stroke_severe','arc_surgery30d',
    'arc_surgery_dapt','arc_age75','arc_ckd_minor','arc_hb_minor',
    'arc_bleed12m','arc_nsaid','arc_stroke_any',
    'hb_htn','hb_renal','hb_liver','hb_stroke','hb_bleed','hb_inr',
    'hb_age','hb_drugs','hb_alcohol',
    'cha_hf','cha_htn','cha_age75','cha_dm','cha_stroke','cha_vasc',
    'cha_age65','cha_female',
    'cap_age41','cap_obesity','cap_chf','cap_age61','cap_age75',
    'cap_minor_surgery','cap_varicose','cap_ibd','cap_swollen_legs',
    'cap_acs','cap_sepsis','cap_lung_disease','cap_bedrest',
    'cap_pregnancy','cap_miscarriage','cap_oc','cap_copd',
    'cap_arthroscopy','cap_cancer','cap_laparoscopy','cap_bedrest72',
    'cap_cast','cap_cvc','cap_open_surgery',
    'cap_dvt_hx','cap_fam_dvt','cap_factor_v','cap_prothrombin',
    'cap_lupus','cap_anticardiolipin','cap_heparin_hit',
    'cap_other_thrombophilia','cap_hyperhomocys',
    'cap_elective_hip','cap_hip_fx','cap_spinal_trauma','cap_stroke_5','cap_multiple_trauma',
    'pesi_cancer','pesi_hf','pesi_copd','pesi_altered_mental',
    'wells_dvt_signs','wells_alt_diag','wells_hr','wells_immob',
    'wells_prev_dvt','wells_hemoptysis','wells_cancer',
    'geneva_age','geneva_prev_dvt','geneva_surgery','geneva_cancer',
    'geneva_leg_pain','geneva_hemoptysis','geneva_hr75','geneva_hr95',
    'geneva_dvt_signs',
    'precise_bleed',
    'score2_2events','dm_age20'
  ];

  allTrackedIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        saveUndoState();
      });
    }
  });

  document.querySelectorAll('.sex-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setTimeout(function() {
        saveUndoState();
      }, 0);
    });
  });

  saveUndoState();
}

// ===================================================
//  ТЁМНАЯ ТЕМА
// ===================================================
function initTheme() {
  var isDark = localStorage.getItem('darkMode') === 'true';
  var toggleBtn = document.getElementById('themeToggle');
  if (isDark) {
    document.body.classList.add('dark-theme');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-theme');
    if (toggleBtn) toggleBtn.textContent = '🌓';
  }
}

function toggleDarkMode() {
  var isDark = document.body.classList.contains('dark-theme');
  var toggleBtn = document.getElementById('themeToggle');
  if (isDark) {
    document.body.classList.remove('dark-theme');
    localStorage.setItem('darkMode', 'false');
    if (toggleBtn) toggleBtn.textContent = '🌓';
  } else {
    document.body.classList.add('dark-theme');
    localStorage.setItem('darkMode', 'true');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  }
}

// ===================================================
//  РЕЖИМ РАБОТЫ: СТАЦИОНАР / ПОЛИКЛИНИКА
// ===================================================
//  Одна страница работает в двух режимах. Общие данные
//  пациента (возраст, пол, АД, ЧСС, анализы) физически
//  одни и те же — при переключении режима они сохраняются,
//  ничего переносить не нужно.
//  Принадлежность шкалы режиму задаётся таблицей:
//  'emergency' — только стационар, 'both' — оба режима,
//  'outpatient' — только поликлиника (появится позже).
var SCALE_MODES = {
  ckdepi:  'both',
  cg:      'both',
  grace:   'emergency',
  crusade: 'emergency',
  archbr:  'emergency',
  caprini: 'emergency',
  precise: 'emergency',
  hasbled: 'both',
  cha2ds2: 'both',
  pesi:    'emergency',
  wells:   'emergency',
  geneva:  'emergency',
  score2:  'outpatient'
};

var MODE_STORAGE_KEY = 'medicschet_mode';
var MODE_SCALES_STORAGE_KEY = 'medicschet_mode_scales_v1';

// Стандартный набор включённых шкал для каждого режима
// (используется, пока пользователь не изменил выбор)
var MODE_SCALES_DEFAULTS = {
  emergency: ['ckdepi','cg','grace','crusade','archbr','caprini','hasbled','cha2ds2','pesi','wells','geneva','precise'],
  outpatient: ['ckdepi','cg','hasbled','cha2ds2','score2']
};

// Память выбранных шкал режима: каждый режим хранит свой список
// включённых шкал отдельно (localStorage), поэтому при переключении
// туда-обратно выбор шкал восстанавливается, а не теряется.
function getModeScales(mode) {
  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(MODE_SCALES_STORAGE_KEY) || 'null'); } catch (e) {}
  if (stored && stored.hasOwnProperty(mode) && Array.isArray(stored[mode])) {
    return stored[mode].slice();
  }
  return (MODE_SCALES_DEFAULTS[mode] || []).slice();
}

function saveModeScales(mode, scaleNames) {
  var stored = {};
  try { stored = JSON.parse(localStorage.getItem(MODE_SCALES_STORAGE_KEY) || 'null') || {}; } catch (e) { stored = {}; }
  stored[mode] = scaleNames.slice();
  try { localStorage.setItem(MODE_SCALES_STORAGE_KEY, JSON.stringify(stored)); } catch (e) {}
}

// Сохраняет текущее состояние галочек как память текущего режима
function saveCurrentModeScales() {
  var mode = getCurrentMode();
  var scales = ['ckdepi','cg','grace','crusade','archbr','caprini','hasbled','cha2ds2','pesi','wells','geneva','precise','score2'];
  var enabled = [];
  scales.forEach(function(name) {
    var toggleEl = document.querySelector('#toggle_' + name + ' input');
    if (toggleEl && toggleEl.checked) enabled.push(name);
  });
  saveModeScales(mode, enabled);
}

function getCurrentMode() {
  var mode = 'emergency';
  try {
    var saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === 'emergency' || saved === 'outpatient') mode = saved;
  } catch (e) {}
  return mode;
}

function saveMode(mode) {
  try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (e) {}
}

// Применяет текущий режим ко всей странице:
// 1. подсвечивает нужную кнопку переключателя;
// 2. показывает в селекторе только шкалы текущего режима;
// 3. включает шкалы из памяти режима, остальные — выключает и скрывает
//    (выключение обязательно: иначе «Рассчитать» посчитает чужой режим);
// 4. показывает/скрывает подсказку поликлинического режима;
// 5. скрывает кнопки групп ОКС/ФП/ТЭЛА в поликлинике;
// 6. пересчитывает видимость полей и панель анализа.
function applyMode() {
  var mode = getCurrentMode();
  var remembered = getModeScales(mode);

  // 1. Кнопки переключателя
  var btns = document.querySelectorAll('.mode-btn');
  btns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // 2–3. Селектор шкал и блоки шкал: применяем память текущего режима
  var scales = ['ckdepi','cg','grace','crusade','archbr','caprini','hasbled','cha2ds2','pesi','wells','geneva','precise','score2'];
  scales.forEach(function(name) {
    var scaleMode = SCALE_MODES[name] || 'emergency';
    var visibleInMode = (scaleMode === 'both' || scaleMode === mode);
    var toggleEl = document.querySelector('#toggle_' + name + ' input');
    var toggleLabel = document.getElementById('toggle_' + name);
    var block = document.getElementById('block_' + name);

    if (visibleInMode) {
      var enabled = remembered.indexOf(name) !== -1;
      if (toggleEl) toggleEl.checked = enabled;
      if (toggleLabel) {
        toggleLabel.classList.toggle('active', enabled);
        toggleLabel.style.display = '';
      }
      if (block) block.classList.toggle('hidden', !enabled);
    } else {
      // Шкала чужого режима: всегда выключена и скрыта
      if (toggleEl) toggleEl.checked = false;
      if (toggleLabel) {
        toggleLabel.classList.remove('active');
        toggleLabel.style.display = 'none';
      }
      if (block) block.classList.add('hidden');
    }
  });

  // 5. Кнопки групп ОКС/ФП/ТЭЛА — только в стационаре
  // Кнопки групп: в стационаре — ОКС/ФП/ТЭЛА, в поликлинике — «Липиды»
  var groupBtns = document.getElementById('scaleGroupBtns');
  if (groupBtns) groupBtns.style.display = '';
  document.querySelectorAll('.group-emergency').forEach(function(b) {
    b.style.display = (mode === 'emergency') ? '' : 'none';
  });
  document.querySelectorAll('.group-outpatient').forEach(function(b) {
    b.style.display = (mode === 'outpatient') ? '' : 'none';
  });

  // 6. Видимость полей и панель анализа
  updateFieldVisibility();
  updateGroupButtonsUI();
  updateAnalysisPanel();
}

// Очистка результатов и текста для истории болезни при смене режима.
// Результаты жёстко привязаны к текущему режиму: в выписку или справку
// не должен попасть расчёт, сделанный в другом режиме.
function clearResultsForModeChange(mode) {
  var results = document.getElementById('results');
  if (results) results.style.display = 'none';
  var grid = document.getElementById('resultsGrid');
  if (grid) grid.innerHTML = '';
  var copyText = document.getElementById('copyText');
  if (copyText) copyText.textContent = '';

  var modeLabel = (mode === 'outpatient') ? '«Поликлиника»' : '«Стационар»';
  showToast('Результаты и текст для истории болезни очищены. Нажмите «⚡ Рассчитать шкалы», чтобы получить результаты для режима ' + modeLabel + '.', 'warning');
}

function initModeSwitch() {
  var btns = document.querySelectorAll('.mode-btn');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mode = this.dataset.mode;
      if (!mode) return;
      var prevMode = getCurrentMode();
      // Повторный клик на уже активный режим — ничего не делаем
      if (mode === prevMode) return;
      // Сначала сохраняем выбор шкал текущего режима в его память,
      // затем переключаем режим и применяем память нового режима.
      saveCurrentModeScales();
      saveMode(mode);
      applyMode();
      // Результаты очищаем при каждой реальной смене режима
      clearResultsForModeChange(mode);
    });
  });
  applyMode();
}

// ===================================================
//  ДЕМОНСТРАЦИОННЫЕ СЦЕНАРИИ
// ===================================================
function resetAllFields() {
  var inputIds = ['age','height','weight','sbp','hr','creatinine','hb','hct','plt','wbc',
    'pesi_rr','pesi_temp','pesi_spo2','ck_total','ck_mb','na_measured','glucose','potassium','magnesium','smoking','tchol','hdl','tg','ldl','hba1c','dm_age'];
  inputIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('sex').value = '';
  syncSexFromHidden();

  var smokeEl = document.getElementById('smoking');
  if (smokeEl) smokeEl.value = 'no';
  syncSmokingFromHidden();

  var commonCbs = ['cb_dm','cb_hf','cb_htn','cb_stroke','cb_tia','cb_embolism','cb_vte','cb_vasc','cb_verapamil','cb_mi','cb_sghs','cb_dm_tod','cb_fh_cvd','cb_fh_lip','cb_asb50','cb_ath25','cb_gosghs'];
  commonCbs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.checked = false;
  });

  var scaleCbs = [
    'grace_arrest','grace_st','grace_enzymes',
    'crusade_female','crusade_hf','crusade_vasc','crusade_dm',
    'arc_oac','arc_ckd_major','arc_hb_major','arc_bleed6m','arc_plt','arc_diathesis','arc_cirrhosis',
    'arc_cancer','arc_ich_spont','arc_ich_trauma','arc_avm','arc_stroke_severe','arc_surgery30d',
    'arc_surgery_dapt','arc_age75','arc_ckd_minor','arc_hb_minor','arc_bleed12m','arc_nsaid','arc_stroke_any',
    'hb_htn','hb_renal','hb_liver','hb_stroke','hb_bleed','hb_inr','hb_age','hb_drugs','hb_alcohol',
    'cha_hf','cha_htn','cha_age75','cha_dm','cha_stroke','cha_vasc','cha_age65','cha_female',
    'cap_age41','cap_obesity','cap_chf','cap_age61','cap_age75',
    'cap_minor_surgery','cap_varicose','cap_ibd','cap_swollen_legs','cap_acs','cap_sepsis',
    'cap_lung_disease','cap_bedrest','cap_pregnancy','cap_miscarriage','cap_oc','cap_copd',
    'cap_arthroscopy','cap_cancer','cap_laparoscopy','cap_bedrest72','cap_cast','cap_cvc','cap_open_surgery',
    'cap_dvt_hx','cap_fam_dvt','cap_factor_v','cap_prothrombin','cap_lupus','cap_anticardiolipin',
    'cap_heparin_hit','cap_other_thrombophilia','cap_hyperhomocys',
    'cap_elective_hip','cap_hip_fx','cap_spinal_trauma','cap_stroke_5','cap_multiple_trauma',
    'pesi_cancer','pesi_hf','pesi_copd','pesi_altered_mental',
    'wells_dvt_signs','wells_alt_diag','wells_hr','wells_immob',
    'wells_prev_dvt','wells_hemoptysis','wells_cancer',
    'geneva_age','geneva_prev_dvt','geneva_surgery','geneva_cancer',
    'geneva_leg_pain','geneva_hemoptysis','geneva_hr75','geneva_hr95',
    'geneva_dvt_signs',
    'precise_bleed',
    'score2_2events','dm_age20'
  ];
  scaleCbs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.checked = false;
  });

  var emrTextarea = document.getElementById('emrPaste');
  if (emrTextarea) emrTextarea.value = '';
  var emrStatus = document.getElementById('emrStatus');
  if (emrStatus) {
    emrStatus.textContent = '⏳ Вставьте текст из ЭМК...';
    emrStatus.style.color = 'var(--muted)';
  }

  document.querySelectorAll('.emr-filled').forEach(function(el) {
    el.classList.remove('emr-filled');
  });

  document.getElementById('results').style.display = 'none';

  updateAnalysisPanel();
}

function fillDemo(scenario) {
  skipUndo = true;
  resetAllFields();
  undoStack = [];

  // Демо-сценарии «Липиды» относятся к поликлиническому режиму,
  // остальные (ОКС/ФП/ТЭЛА) — к стационарному.
  if (scenario.indexOf('lipids') === 0) {
    saveMode('outpatient');
  } else if (getCurrentMode() !== 'emergency') {
    saveMode('emergency');
  }
  applyMode();

  var allScales = ['ckdepi','cg','grace','crusade','archbr','caprini','hasbled','cha2ds2','pesi','wells','geneva','precise','score2'];
  allScales.forEach(function(scale) {
    var toggleEl = document.querySelector('#toggle_' + scale + ' input');
    if (toggleEl) {
      toggleEl.checked = false;
      toggleScale(scale, toggleEl);
    }
  });

  if (scenario === 'acs') {
    document.getElementById('age').value = 72;
    document.getElementById('sex').value = 'm';
    document.getElementById('height').value = 175;
    document.getElementById('weight').value = 85;
    document.getElementById('sbp').value = 105;
    document.getElementById('hr').value = 95;
    document.getElementById('creatinine').value = 130;
    document.getElementById('hb').value = 125;
    document.getElementById('hct').value = 38;
    document.getElementById('plt').value = 210;
    document.getElementById('cb_dm').checked = true;
    document.getElementById('cb_htn').checked = true;
    document.getElementById('grace_killip').value = 2;
    document.getElementById('grace_st').checked = true;
    document.getElementById('grace_enzymes').checked = true;
    document.getElementById('ck_total').value = 850;
    document.getElementById('ck_mb').value = 68;
    document.getElementById('wbc').value = 7.5;
    toggleGroup('acs');
  } else if (scenario === 'afib') {
    document.getElementById('age').value = 78;
    document.getElementById('sex').value = 'f';
    document.getElementById('height').value = 160;
    document.getElementById('weight').value = 62;
    document.getElementById('sbp').value = 165;
    document.getElementById('hr').value = 88;
    document.getElementById('creatinine').value = 95;
    document.getElementById('hb').value = 118;
    document.getElementById('hct').value = 36;
    document.getElementById('plt').value = 180;
    document.getElementById('cb_htn').checked = true;
    document.getElementById('cb_dm').checked = true;
    document.getElementById('cb_stroke').checked = true;
    document.getElementById('cb_vasc').checked = true;
    toggleGroup('afib');
  } else if (scenario === 'pe') {
    document.getElementById('age').value = 68;
    document.getElementById('sex').value = 'm';
    document.getElementById('height').value = 182;
    document.getElementById('weight').value = 92;
    document.getElementById('sbp').value = 100;
    document.getElementById('hr').value = 112;
    document.getElementById('pesi_rr').value = 26;
    document.getElementById('pesi_temp').value = '36.7';
    document.getElementById('pesi_spo2').value = 88;
    document.getElementById('hb').value = 140;
    document.getElementById('plt').value = 250;
    document.getElementById('cb_hf').checked = true;
    document.getElementById('pesi_cancer').checked = true;
    document.getElementById('pesi_altered_mental').checked = true;
    document.getElementById('wells_alt_diag').checked = true;
    document.getElementById('wells_prev_dvt').checked = true;
    document.getElementById('geneva_leg_pain').checked = true;
    toggleGroup('pe');
  } else if (scenario === 'lipids') {
    document.getElementById('age').value = 55;
    document.getElementById('sex').value = 'm';
    document.getElementById('height').value = 175;
    document.getElementById('weight').value = 80;
    document.getElementById('sbp').value = 130;
    document.getElementById('creatinine').value = 90;
    document.getElementById('tchol').value = 5.5;
    document.getElementById('hdl').value = 1.3;
    document.getElementById('tg').value = 1.5;
    var smokingEl = document.getElementById('smoking');
    if (smokingEl) smokingEl.value = 'no';
    toggleGroup('lipids');
  } else if (scenario === 'lipids_dm') {
    // СД 2 типа 8 лет → SCORE2-Diabetes; ФР: возраст (м>40) + ожирение (ИМТ ~28) → высокий риск
    document.getElementById('age').value = 60;
    document.getElementById('sex').value = 'm';
    document.getElementById('height').value = 172;
    document.getElementById('weight').value = 84;
    document.getElementById('sbp').value = 135;
    document.getElementById('creatinine').value = 88;
    document.getElementById('tchol').value = 5.8;
    document.getElementById('hdl').value = 1.2;
    document.getElementById('tg').value = 1.8;
    document.getElementById('hba1c').value = 7.5;
    document.getElementById('dm_age').value = 52;
    document.getElementById('cb_dm').checked = true;
    var smokingDm = document.getElementById('smoking');
    if (smokingDm) smokingDm.value = 'no';
    toggleGroup('lipids');
  } else if (scenario === 'lipids_mi') {
    // После инфаркта → очень высокий риск, SCORE2 не применяется
    document.getElementById('age').value = 58;
    document.getElementById('sex').value = 'm';
    document.getElementById('height').value = 178;
    document.getElementById('weight').value = 82;
    document.getElementById('sbp').value = 125;
    document.getElementById('creatinine').value = 92;
    document.getElementById('tchol').value = 4.8;
    document.getElementById('hdl').value = 1.1;
    document.getElementById('tg').value = 1.6;
    document.getElementById('cb_mi').checked = true;
    var smokingMi = document.getElementById('smoking');
    if (smokingMi) smokingMi.value = 'no';
    toggleGroup('lipids');
  } else if (scenario === 'lipids_op') {
    // Пожилая 75 лет → SCORE2-OP
    document.getElementById('age').value = 75;
    document.getElementById('sex').value = 'f';
    document.getElementById('height').value = 162;
    document.getElementById('weight').value = 68;
    document.getElementById('sbp').value = 145;
    document.getElementById('creatinine').value = 100;
    document.getElementById('tchol').value = 6.2;
    document.getElementById('hdl').value = 1.4;
    document.getElementById('tg').value = 1.3;
    var smokingOp = document.getElementById('smoking');
    if (smokingOp) smokingOp.value = 'no';
    toggleGroup('lipids');
  } else if (scenario === 'lipids_young') {
    // Молодая диабетик 42 года, СД 5 лет без ФР → SCORE2-Diabetes, умеренный риск
    document.getElementById('age').value = 42;
    document.getElementById('sex').value = 'f';
    document.getElementById('height').value = 165;
    document.getElementById('weight').value = 60;
    document.getElementById('sbp').value = 120;
    document.getElementById('creatinine').value = 80;
    document.getElementById('tchol').value = 5.2;
    document.getElementById('hdl').value = 1.5;
    document.getElementById('tg').value = 1.0;
    document.getElementById('hba1c').value = 6.8;
    document.getElementById('dm_age').value = 37;
    document.getElementById('cb_dm').checked = true;
    var smokingYoung = document.getElementById('smoking');
    if (smokingYoung) smokingYoung.value = 'no';
    toggleGroup('lipids');
  }

  ['ckdepi', 'cg'].forEach(function(scale) {
    var toggleEl = document.querySelector('#toggle_' + scale + ' input');
    if (toggleEl) {
      if (!toggleEl.checked) {
        toggleEl.checked = true;
        toggleScale(scale, toggleEl);
      }
    }
  });

  skipUndo = false;
  saveUndoState();
  skipUndo = true;

  syncSexFromHidden();
  updateFieldVisibility();
  updateGroupButtonsUI();
  autofill();
  updateAnalysisPanel();
  syncCustomSelects();
  applyMode();
  saveAppState();

  skipUndo = false;

  document.querySelector('.scale-selector').scrollIntoView({ behavior: 'smooth' });
}

function toggleDemoMenu() {
  var dropdown = document.getElementById('demoDropdown');
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    dropdown.style.display = 'block';
  } else {
    dropdown.style.display = 'none';
  }
}

document.addEventListener('click', function(e) {
  var dropdown = document.getElementById('demoDropdown');
  var demoToggle = document.getElementById('demoToggle');
  if (!demoToggle || !dropdown) return;
  if (!e.target.closest('#demoToggle') && !e.target.closest('#demoDropdown')) {
    dropdown.style.display = 'none';
  }
});

// ===================================================
//  ГЛОБАЛЬНЫЙ ТУЛТИП
// ===================================================
function showTooltip(text, x, y) {
  if (!tooltip) return;

  tooltip.innerText = text;
  tooltip.style.display = 'block';
  tooltip.style.opacity = '0';

  var offset = 12;
  var screenPadding = 12;
  var left = x + offset;
  var top = y + offset;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';

  var rect = tooltip.getBoundingClientRect();

  if (left + rect.width > window.innerWidth - screenPadding) {
    left = window.innerWidth - rect.width - screenPadding;
  }
  if (top + rect.height > window.innerHeight - screenPadding) {
    top = y - rect.height - offset;
  }
  if (left < screenPadding) left = screenPadding;
  if (top < screenPadding) top = screenPadding;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';

  setTimeout(function() { tooltip.style.opacity = '1'; }, 10);
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.style.opacity = '0';
  setTimeout(function() { tooltip.style.display = 'none'; }, 150);
}

function setupTooltipTrigger(icon, text) {
  if (!icon) return;
  icon.dataset.tooltip = text;
  icon.removeEventListener('mouseenter', icon._tooltipEnter);
  icon.removeEventListener('mouseleave', icon._tooltipLeave);
  icon.removeEventListener('mousemove', icon._tooltipMove);

  icon._tooltipEnter = function() {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(function() {
      showTooltip(icon.dataset.tooltip, parseInt(icon.dataset.mouseX), parseInt(icon.dataset.mouseY));
    }, 100);
  };
  icon._tooltipLeave = function() {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    hideTooltip();
  };
  icon._tooltipMove = function(e) {
    icon.dataset.mouseX = e.clientX;
    icon.dataset.mouseY = e.clientY;
  };

  icon.addEventListener('mouseenter', icon._tooltipEnter);
  icon.addEventListener('mouseleave', icon._tooltipLeave);
  icon.addEventListener('mousemove', icon._tooltipMove);
}

// ===================================================
//  TOAST-УВЕДОМЛЕНИЯ
// ===================================================
function showToast(message, type) {
  type = type || 'error';
  var container = document.getElementById('toastContainer');
  if (!container) return;

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('fade-out');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 4000);
}

// ===================================================
//  УТИЛИТЫ
// ===================================================
function parseNum(id) {
  var el = document.getElementById(id);
  if (!el) return null;
  var v = el.value.replace(',', '.');
  var n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function cb(id) {
  var el = document.getElementById(id);
  return el ? el.checked : false;
}

function setCb(id, val) {
  var el = document.getElementById(id);
  if (el) el.checked = val;
}

// Синхронизация связанных пар чекбоксов:
// - Wells ↔ Geneva: «Кровохарканье» и «Клинические признаки ТГВ» —
//   одни и те же клинические признаки в обеих шкалах.
// - PESI ↔ Caprini: «Злокачественная опухоль (активное/в анамнезе)» и
//   «Злокачественная опухоль (настоящее или прошлое)» — синонимы.
// Отметка или снятие одного автоматически применяется к парному
// (двусторонняя связь).
// В штатной работе пара всегда согласована (её синхронизируют слушатели
// change), поэтому здесь при рассинхроне (возможен только в старых
// сохранениях) включаем оба чекбокса.

function syncLinkedCheckboxes() {
  var pairs = [
    ['wells_hemoptysis', 'geneva_hemoptysis'],
    ['wells_dvt_signs',  'geneva_dvt_signs'],
    ['pesi_cancer',      'cap_cancer']
  ];
  pairs.forEach(function(pair) {
    var a = document.getElementById(pair[0]);
    var b = document.getElementById(pair[1]);
    if (!a || !b) return;
    if (a.checked !== b.checked) {
      var combined = a.checked || b.checked;
      a.checked = combined;
      b.checked = combined;
    }
  });
}

// Подсветка незаполненных обязательных полей после нажатия «Рассчитать».
// fieldIds — массив id полей (null пропускаются); класс .field-error
// снимается со всех контейнеров и вешается на указанные.
function highlightErrorFields(fieldIds) {
  var groups = document.querySelectorAll('.input-group.field-error');
  for (var i = 0; i < groups.length; i++) {
    groups[i].classList.remove('field-error');
  }
  if (!fieldIds) return;
  fieldIds.forEach(function(id) {
    if (!id) return;
    var el = document.getElementById(id);
    var grp = el ? el.closest('.input-group') : null;
    if (grp) grp.classList.add('field-error');
  });
}

// Реалистичные диапазоны полей для оранжевого предупреждения.
// Поле со значением вне [min, max] подсвечивается оранжевым,
// но расчёт НЕ блокируется (вдруг редкий клинический случай).
var FIELD_RANGES = [
  { id: 'age',         min: 0,   max: 130,  label: 'возраст' },
  { id: 'height',      min: 50,  max: 250,  label: 'рост' },
  { id: 'weight',      min: 2,   max: 300,  label: 'вес' },
  { id: 'sbp',         min: 50,  max: 300,  label: 'систолическое АД' },
  { id: 'hr',          min: 20,  max: 250,  label: 'ЧСС' },
  { id: 'creatinine',  min: 20,  max: 1500, label: 'креатинин' },
  { id: 'hb',          min: 30,  max: 250,  label: 'гемоглобин' },
  { id: 'hct',         min: 10,  max: 75,   label: 'гематокрит' },
  { id: 'plt',         min: 10,  max: 1000, label: 'тромбоциты' },
  { id: 'pesi_rr',     min: 4,   max: 60,   label: 'частота дыханий' },
  { id: 'pesi_temp',   min: 30,  max: 45,   label: 'температура' },
  { id: 'pesi_spo2',   min: 40,  max: 100,  label: 'SpO₂' },
  { id: 'ck_total',    min: 10,  max: 100000, label: 'КФК общая' },
  { id: 'ck_mb',       min: 1,   max: 10000,  label: 'КФК-МВ' },
  { id: 'na_measured', min: 100, max: 180,  label: 'натрий' },
  { id: 'glucose',     min: 1,   max: 50,   label: 'глюкоза' },
  { id: 'potassium',   min: 1,   max: 10,   label: 'калий' },
  { id: 'magnesium',   min: 0.1, max: 5,    label: 'магний' },
  { id: 'wbc',         min: 0.5, max: 50,   label: 'лейкоциты' },
  { id: 'tchol',       min: 1,   max: 20,   label: 'общий холестерин' },
  { id: 'hdl',         min: 0.2, max: 5,    label: 'ЛПВП' },
  { id: 'tg',          min: 0.2, max: 20,   label: 'триглицериды' },
  { id: 'ldl',         min: 0.3, max: 15,   label: 'ЛПНП (лаборатория)' },
  { id: 'hba1c',       min: 3,   max: 20,   label: 'HbA1c, %' },
  { id: 'dm_age',      min: 5,   max: 90,   label: 'возраст дебюта СД' }
];

// Возвращает [{ id, label }] для полей, значение которых заполнено и вне [min, max].
function getRangeWarnings() {
  var out = [];
  FIELD_RANGES.forEach(function(r) {
    var el = document.getElementById(r.id);
    if (!el) return;
    if (el.type === 'checkbox') return;
    var v = parseFloat(el.value.replace(',', '.')); // «0,85» → 0.85
    if (isNaN(v) || el.value === '') return; // пустое — обрабатывается красной подсветкой
    if (v < r.min || v > r.max) out.push({ id: r.id, label: r.label });
  });
  return out;
}

// Оранжевая подсветка полей вне диапазона (не трогает красные field-error).
function applyRangeWarnings() {
  var groups = document.querySelectorAll('.input-group.field-warning');
  for (var i = 0; i < groups.length; i++) {
    groups[i].classList.remove('field-warning');
  }
  getRangeWarnings().forEach(function(w) {
    var el = document.getElementById(w.id);
    var grp = el ? el.closest('.input-group') : null;
    if (!grp) return;
    if (grp.classList.contains('field-error')) return; // пустое приоритетнее
    grp.classList.add('field-warning');
  });
}

// Обновляет кнопку «Рассчитать» при наличии значений вне диапазона.
// warnings — массив { label } из getRangeWarnings().
function updateCalcButtonWarnings(warnings) {
  var btn = document.getElementById('calcBtn');
  var txt = document.getElementById('calcBtnText');
  if (!btn || !txt) return;
  if (warnings && warnings.length > 0) {
    btn.classList.add('has-warnings');
    var labels = warnings.slice(0, 4).map(function(w) { return w.label; });
    var extra = warnings.length > 4 ? ', и др.' : '';
    txt.textContent = 'Проверьте значения: ' + labels.join(', ') + extra;
  } else {
    btn.classList.remove('has-warnings');
    txt.textContent = '⚡ РАССЧИТАТЬ ШКАЛЫ';
  }
}

document.getElementById('clearScalesBtn').addEventListener('click', function() {
  document.querySelectorAll('#scaleSelector input[type="checkbox"]').forEach(function(cb) {
    cb.checked = false;
    var name = cb.id.replace('scale_','');
    toggleScale(name, cb);
  });
});

// PRECISE-DAPT: официальная номограмма (Costa F, et al. Lancet 2017;389(10073):1025-34; приложение).
// Непрерывная шкала 0–100: балл = линейная функция от значения (считывается по оси Points номограммы),
// каждый компонент округляется до целого. Ограничения переменных (приложение, eTable 5):
// возраст <50 → 0; КлКр >100 → 0; Hb ≥12 → 0 и ≤10 → 15 (г/дл); WBC ≤5 → 0 и ≥20 → 15.
// Ось «Bleeding score» на номограмме обрезана на 36 (95-й процентиль) — только для графика, не для расчёта.
function calcPreciseScore(age, crCl, hbGdl, wbc, bleed) {
  var ptsAge  = Math.round(Math.max(0, Math.min(19, (age - 50) / 40 * 19)));
  var ptsCr   = Math.round(Math.max(0, Math.min(25, (100 - crCl) / 100 * 25)));
  var ptsHb   = Math.round(Math.max(0, Math.min(15, (12 - hbGdl) / 2 * 15)));
  var ptsWbc  = Math.round(Math.max(0, Math.min(15, (wbc - 5) / 15 * 15)));
  var ptsBleed = bleed ? 26 : 0;
  return ptsAge + ptsCr + ptsHb + ptsWbc + ptsBleed;
}

function calculatePreciseDapt() {
  var age = parseNum('age');
  var sex = document.getElementById('sex').value;
  var weight = parseNum('weight');
  var creat = parseNum('creatinine');
  var hbGdl = parseNum('hb');
  if (hbGdl !== null) hbGdl = hbGdl / 10;
  var wbc = parseNum('wbc');
  var bleed = document.getElementById('precise_bleed').checked;
  if (!age || !sex || !weight || creat === null || creat <= 0 || hbGdl === null || wbc === null) return null;
  var crCl = calcCG(age, sex, weight, creat);
  if (crCl === null) return null;
  var score = calcPreciseScore(age, crCl, hbGdl, wbc, bleed);
  return {
    score: score,
    risk: score >= 25 ? 'high' : score >= 18 ? 'moderate' : score >= 11 ? 'low' : 'verylow',
    crCl: crCl,
    hb: hbGdl.toFixed(1),
    wbc: wbc,
    bleed: bleed
  };
}
function toggleScale(name, el) {
  var lbl = document.getElementById('toggle_' + name);
  var blk = document.getElementById('block_' + name);
  if (el.checked) {
    if (lbl) lbl.classList.add('active');
    if (blk) blk.classList.remove('hidden');
  } else {
    if (lbl) lbl.classList.remove('active');
    if (blk) blk.classList.add('hidden');
  }
  updateFieldVisibility();
  updateGroupButtonsUI();
  // Любое изменение выбора шкал сохраняем в память текущего режима
  saveCurrentModeScales();
}

function isScaleActive(name) {
  var toggleEl = document.querySelector('#toggle_' + name + ' input');
  return toggleEl ? toggleEl.checked : false;
}

function pluralizeBalls(n) {
  var lastTwo = n % 100;
  var lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'баллов';
  if (lastOne === 1) return 'балл';
  if (lastOne >= 2 && lastOne <= 4) return 'балла';
  return 'баллов';
}

function pluralizeBallsWells(score) {
  if (score % 1 !== 0) return 'балла';
  return pluralizeBalls(score);
}

function formatWellsScore(score) {
  if (score % 1 === 0) return score.toString();
  return score.toFixed(1).replace('.', ',');
}

function flashField(inputElement) {
  if (!inputElement) return;
  var container = inputElement.closest('.input-group');
  if (!container) {
    container = inputElement.closest('.scale-cb-item');
  }
  if (!container) return;

  container.classList.add('autofill-flash');

  var onAnimationEnd = function() {
    container.classList.remove('autofill-flash');
    container.removeEventListener('animationend', onAnimationEnd);
  };
  container.addEventListener('animationend', onAnimationEnd);
}

// ===================================================
//  ПЕРЕКЛЮЧАТЕЛЬ ПОЛА
// ===================================================
function syncSexFromHidden() {
  var sexInput = document.getElementById('sex');
  if (!sexInput) return;
  var currentVal = sexInput.value;
  var btns = document.querySelectorAll('.sex-btn[data-sex]');
  btns.forEach(function(btn) {
    if (btn.dataset.sex === currentVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function initSexToggle() {
  var btns = document.querySelectorAll('.sex-btn[data-sex]');
  var sexInput = document.getElementById('sex');

  function setActive(value) {
    btns.forEach(function(btn) {
      if (btn.dataset.sex === value) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (sexInput) sexInput.value = value || '';
  }

  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var currentVal = sexInput ? sexInput.value : '';
      var clickedVal = this.dataset.sex;
      if (currentVal === clickedVal) {
        setActive('');
      } else {
        setActive(clickedVal);
      }
      autofill();
      if (typeof updateAnalysisPanel === 'function') updateAnalysisPanel();
      if (typeof scheduleStateSave === 'function') scheduleStateSave();
    });
  });

  setActive('');
}

// ===================================================
//  Курение: кнопки «Не курит / Бросил / Курит» (как М/Ж)
// ===================================================
function syncSmokingFromHidden() {
  var smokeInput = document.getElementById('smoking');
  if (!smokeInput) return;
  var currentVal = smokeInput.value;
  document.querySelectorAll('.sex-btn[data-smoke]').forEach(function(btn) {
    if (btn.dataset.smoke === currentVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function initSmokingToggle() {
  var btns = document.querySelectorAll('.sex-btn[data-smoke]');
  var smokeInput = document.getElementById('smoking');

  function setActive(value) {
    btns.forEach(function(btn) {
      if (btn.dataset.smoke === value) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (smokeInput) smokeInput.value = value;
  }

  btns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var clickedVal = btn.dataset.smoke;
      var currentVal = smokeInput ? smokeInput.value : '';
      setActive(currentVal === clickedVal ? '' : clickedVal);
      if (typeof scheduleStateSave === 'function') scheduleStateSave();
    });
  });

  setActive(smokeInput ? smokeInput.value : 'no');
}

// ===================================================
//  ГРУППЫ ШКАЛ
// ===================================================
function toggleGroup(groupName) {
  var scales = [];
  if (groupName === 'acs') {
    scales = ['grace', 'crusade', 'archbr', 'caprini', 'precise'];
  } else if (groupName === 'afib') {
    scales = ['hasbled', 'cha2ds2'];
  } else if (groupName === 'pe') {
    scales = ['pesi', 'wells', 'geneva'];
  } else if (groupName === 'lipids') {
    scales = ['score2'];
  } else {
    return;
  }

  var allActive = scales.every(function(scale) {
    return isScaleActive(scale);
  });

  scales.forEach(function(scale) {
    var toggleEl = document.querySelector('#toggle_' + scale + ' input');
    if (!toggleEl) return;
    var newState = !allActive;
    if (toggleEl.checked !== newState) {
      toggleEl.checked = newState;
      toggleScale(scale, toggleEl);
    }
  });
  updateGroupButtonsUI();
}

function updateGroupButtonsUI() {
  var groups = {
    acs: ['grace', 'crusade', 'archbr', 'caprini', 'precise'],
    afib: ['hasbled', 'cha2ds2'],
    pe: ['pesi', 'wells', 'geneva'],
    lipids: ['score2']
  };

  for (var groupName in groups) {
    var scales = groups[groupName];
    var allActive = scales.every(function(scale) {
      return isScaleActive(scale);
    });
    var btn = document.querySelector('.group-btn[data-group="' + groupName + '"]');
    if (btn) {
      if (allActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

// ===================================================
//  НАВИГАЦИОННЫЕ КНОПКИ
// ===================================================
function updateNavButtons() {
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  var windowHeight = window.innerHeight;
  var documentHeight = document.documentElement.scrollHeight;
  var scrollBottom = scrollTop + windowHeight;

  var isAtTop = scrollTop < 50;
  var isAtBottom = scrollBottom >= documentHeight - 50;

  var btnUp = document.querySelector('.scroll-top-btn');
  var btnDown = document.querySelector('.scroll-down-btn');

  if (!btnUp || !btnDown) return;

  if (isAtTop) {
    btnUp.style.display = 'none';
    btnDown.style.display = 'flex';
  } else if (isAtBottom) {
    btnUp.style.display = 'flex';
    btnDown.style.display = 'none';
  } else {
    btnUp.style.display = 'flex';
    btnDown.style.display = 'flex';
  }
}

// ===================================================
//  ДИСКЛЕЙМЕР
// ===================================================
function acceptDisclaimer() {
  localStorage.setItem('disclaimerAccepted', 'true');
  var overlay = document.getElementById('disclaimerOverlay');
  overlay.classList.remove('visible');
  setTimeout(function() { overlay.style.display = 'none'; }, 300);
}

function checkDisclaimer() {
  var accepted = localStorage.getItem('disclaimerAccepted');
  if (!accepted) {
    var overlay = document.getElementById('disclaimerOverlay');
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('visible'); }, 50);
  }
}

// ===================================================
//  ОТРИСОВКА КАРТОЧКИ РЕЗУЛЬТАТА
// ===================================================
function makeResultCard(title, value, interp, risk, details, hint, extraClass, rationale) {
  var cls = extraClass ? ' ' + extraClass : '';
  var face = '<div class="result-card risk-' + risk + '">' +
    '<div class="result-card-header">' + title + '</div>' +
    '<div class="result-card-body">' +
      '<div class="result-value">' + value + '</div>' +
      '<div class="result-interp">' + interp + '</div>' +
      (details ? '<div class="result-details">' + details + '</div>' : '') +
      (hint ? '<div class="result-hint">' + hint + '</div>' : '') +
    '</div>' +
  '</div>';
  // Если есть обоснование — карточка двусторонняя (flip)
  if (rationale) {
    return '<div class="flip-card' + cls + '">' +
      '<div class="flip-inner">' +
        '<div class="flip-front">' + face + '</div>' +
        '<div class="flip-back">' +
          '<div class="result-card result-card-back">' +
            '<div class="result-card-header result-card-header-back"><span>📋 Обоснование расчёта</span><span class="flip-back-link">⟳ Вернуться</span></div>' +
            '<div class="result-card-body">' + rationale + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  return face;
}

// ===================================================
//  КОПИРОВАНИЕ В БУФЕР ОБМЕНА
// ===================================================
function copyToClipboard() {
  var text = document.getElementById('copyText').textContent;
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.getElementById('copyBtn');
    btn.textContent = '✅ Скопировано!';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = '📋 Копировать в буфер обмена';
      btn.classList.remove('copied');
    }, 2500);
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    var btn = document.getElementById('copyBtn');
    btn.textContent = '✅ Скопировано!';
    setTimeout(function() { btn.textContent = '📋 Копировать в буфер обмена'; }, 2500);
  });
}

window.copyKInfusion = function(btn) {
  var text = btn.getAttribute('data-text');

  function showCopiedState() {
    btn.innerHTML = '✅ Скопировано!';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.innerHTML = '📋 Копировать назначение';
      btn.classList.remove('copied');
    }, 2000);
  }

  navigator.clipboard.writeText(text).then(function() {
    showCopiedState();
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopiedState();
  });
};

// ===================================================
//  КАСТОМНЫЕ РАСКРЫВАЮЩИЕСЯ СПИСКИ
//  Системные <select> в тёмной теме рисуют белую рамку и белое
//  выделение. Оборачиваем нативный select в свой виджет: нативный
//  элемент остаётся в DOM скрытым (с ним работают все скрипты —
//  читают .value и слушают события), а виджет только меняет его
//  значение и шлёт события input/change.
// ===================================================
function initCustomSelect(selectEl) {
  if (!selectEl || selectEl.dataset.customSelect === '1') return;
  selectEl.dataset.customSelect = '1';

  var wrapper = document.createElement('div');
  wrapper.className = 'custom-select';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-select__btn';
  btn.innerHTML = '<span class="custom-select__value"></span><span class="custom-select__arrow">▾</span>';

  var list = document.createElement('div');
  list.className = 'custom-select__list';

  function buildList() {
    list.innerHTML = '';
    for (var i = 0; i < selectEl.options.length; i++) {
      (function(opt, idx) {
        var item = document.createElement('div');
        item.className = 'custom-select__item';
        item.textContent = opt.text;
        item.dataset.index = idx;
        item.addEventListener('click', function() {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event('input', { bubbles: true }));
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          syncLabel();
          closeList();
        });
        list.appendChild(item);
      })(selectEl.options[i], i);
    }
  }

  function syncLabel() {
    var idx = selectEl.selectedIndex;
    btn.querySelector('.custom-select__value').textContent =
      selectEl.options[idx] ? selectEl.options[idx].text : '';
    var items = list.querySelectorAll('.custom-select__item');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('active', items[j].dataset.index == idx);
    }
  }

  function openList() {
    list.style.display = 'block';
    btn.classList.add('open');
    document.addEventListener('click', outsideClose);
  }

  function closeList() {
    list.style.display = 'none';
    btn.classList.remove('open');
    document.removeEventListener('click', outsideClose);
  }

  function outsideClose(e) {
    if (!wrapper.contains(e.target)) closeList();
  }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (list.style.display === 'block') closeList(); else openList();
  });

  // Если значение изменили программно (например, демо-сценарий)
  selectEl.addEventListener('change', syncLabel);

  buildList();
  syncLabel();

  // Нативный select прячем визуально, но оставляем в DOM
  selectEl.style.position = 'absolute';
  selectEl.style.opacity = '0';
  selectEl.style.pointerEvents = 'none';
  selectEl.style.width = '1px';
  selectEl.style.height = '1px';

  wrapper.appendChild(btn);
  wrapper.appendChild(list);
  selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
}

// Синхронизация подписей всех виджетов с их нативными select
// (нужно после программных изменений значений, например, демо)
function syncCustomSelects() {
  document.querySelectorAll('select[data-custom-select="1"]').forEach(function(s) {
    var w = s.parentNode.querySelector('.custom-select');
    if (!w) return;
    var idx = s.selectedIndex;
    var valueEl = w.querySelector('.custom-select__value');
    if (valueEl) valueEl.textContent = s.options[idx] ? s.options[idx].text : '';
    w.querySelectorAll('.custom-select__item').forEach(function(it) {
      it.classList.toggle('active', it.dataset.index == idx);
    });
  });
}

// ===================================================
//  АВТОСОХРАНЕНИЕ ДАННЫХ (localStorage)
//  Значения полей, галочки, радио, списки и поле ЭМК
//  переживают обновление страницы. Ключ версионируется:
//  при изменении формата старые сохранения игнорируются.
// ===================================================
var APP_STATE_KEY = 'medicschet_state';
var APP_STATE_VERSION = 1;
var stateSaveTimer = null;

function collectAppState() {
  var fields = {};
  var els = document.querySelectorAll(
    'input[type="text"], input[type="number"], input[type="hidden"], input[type="checkbox"], ' +
    'input[type="radio"]:checked, select, textarea'
  );
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (!el.id) continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      fields[el.id] = el.checked;
    } else {
      fields[el.id] = el.value;
    }
  }

  // Авто-состояние приёмников онкологии и ХОБЛ — чтобы после перезагрузки
  // страницы они не превращались в «ручные».
  ['pesi_cancer', 'cap_cancer', 'geneva_cancer', 'pesi_copd', 'cap_swollen_legs', 'wells_immob', 'hb_liver'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) fields[id + '_auto'] = el.dataset.cancerAuto === '1';
  });

  return { version: APP_STATE_VERSION, fields: fields };
}

function saveAppState() {
  try {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(collectAppState()));
  } catch (e) {
    // Хранилище недоступно или переполнено — молча пропускаем
  }
}

function scheduleStateSave() {
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(function() {
    stateSaveTimer = null;
    saveAppState();
  }, 400);
}

// Восстановление сохранённого состояния при загрузке страницы.
// Битые/устаревшие сохранения молча игнорируются.
function restoreAppState() {
  var raw = null;
  try {
    raw = localStorage.getItem(APP_STATE_KEY);
  } catch (e) { return; }
  if (!raw) return;

  var data = null;
  try {
    data = JSON.parse(raw);
  } catch (e) { return; }
  if (!data || data.version !== APP_STATE_VERSION || !data.fields) return;

  var fields = data.fields;
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var v = fields[id];
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!v;
    } else {
      el.value = String(v);
    }
  });

  // Восстанавливаем авто-состояние приёмников онкологии и ХОБЛ (классы и
  // метки «авто» дорисует applyCancerAuto()/syncCopdAuto() ниже).
  ['pesi_cancer', 'cap_cancer', 'geneva_cancer', 'pesi_copd', 'cap_swollen_legs', 'wells_immob', 'hb_liver'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (fields.hasOwnProperty(id + '_auto')) {
      if (fields[id + '_auto']) {
        el.dataset.cancerAuto = '1';
      } else {
        delete el.dataset.cancerAuto;
      }
    }
  });

  // Выравниваем связанные пары Wells ↔ Geneva (кровохарканье, признаки ТГВ),
  // а также PESI ↔ Caprini: старые сохранения могли быть рассинхронизированы.
  syncLinkedCheckboxes();

  // Кнопка пола М/Ж — подсветка по восстановленному значению
  syncSexFromHidden();
  // Кнопки курения — подсветка по восстановленному значению
  syncSmokingFromHidden();

  // Онкология: применяем авто-связи узких шкал → PESI/Caprini, чтобы
  // при загрузке страницы состояние онкологии было сразу согласовано.
  applyCancerAuto();

  // Онкология: сразу показываем подсказки ⚠️, если рак отмечен только
  // в анамнезе (без ожидания первого пересчёта).
  updateCancerWarnings();

  // ХОБЛ: применяем авто-связь Caprini → PESI и подсказку сразу при загрузке.
  syncCopdAuto();

  // Признаки ТГВ → «Отёчность ног» Caprini: применяем авто-связь сразу.
  syncDvtEdemaAuto();

  // Постельный режим >72 ч → «Иммобилизация» Wells: применяем сразу.
  syncBedrestAuto();

  // Цирроз печени → «Нарушение функции печени» HAS-BLED: применяем сразу.
  syncCirrhosisAuto();

  // Применяем видимость блоков шкал и их подсветку по восстановленным чекбоксам
  var scales = ['ckdepi','cg','grace','crusade','archbr','caprini','hasbled','cha2ds2','pesi','wells','geneva','precise','score2'];
  scales.forEach(function(name) {
    var toggleEl = document.querySelector('#toggle_' + name + ' input');
    if (toggleEl) toggleScale(name, toggleEl);
  });
}

// Полный сброс: очищает сохранение, все поля, галочки, списки,
// возвращает все шкалы «включены», прячет результаты и чистит историю отмен.
function resetAllData() {
  try { localStorage.removeItem(APP_STATE_KEY); } catch (e) {}
  // Сбрасываем и память выбранных шкал обоих режимов
  try { localStorage.removeItem(MODE_SCALES_STORAGE_KEY); } catch (e) {}

  resetAllFields();

  // Списки
  var killip = document.getElementById('grace_killip');
  if (killip) killip.value = '1';

  // Переключатели шкал — по умолчанию для текущего режима
  // (память шкал очищена, поэтому applyMode() применит стандартный набор)
  applyMode();

  syncCustomSelects();

  // Онкология: после сброса все источники выключены — снимаем остаточные
  // авто-метки/data-флаги приёмников и прячем подсказки ⚠️.
  applyCancerAuto();
  updateCancerWarnings();

  // ХОБЛ: после сброса снимаем авто-метку/data-флаг PESI и прячем ⚠️.
  syncCopdAuto();

  // Признаки ТГВ: после сброса снимаем авто-метку «Отёчности ног» Caprini.
  syncDvtEdemaAuto();

  // Постельный режим: после сброса снимаем авто-метку «Иммобилизации» Wells.
  syncBedrestAuto();

  // Цирроз печени: после сброса снимаем авто-метку HAS-BLED «Печень».
  syncCirrhosisAuto();

  // Снимаем подсветки: красные (пустые поля) и оранжевые (вне диапазона),
  // возвращаем кнопке «Рассчитать» обычный вид.
  // Сначала autofill() — при пустых полях он скрывает все подсказки ⚠️
  // (Caprini «Инсульт», «ОИМ», HAS-BLED «Кровотечение», онкологические).
  autofill();
  highlightErrorFields([]);
  applyRangeWarnings();
  updateCalcButtonWarnings([]);

  resetUndoBaseState();

  // После сброса — плавно наверх, чтобы было видно начало страницы
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Досохранить при обновлении/закрытии страницы (последний ввод не теряется)
window.addEventListener('pagehide', saveAppState);

// ===================================================
//  КАРТОЧКИ-ЧЕКБОКСЫ: блокировка авто-карточек
//  Клик по авто-карточке (жёлтой, классы .auto-cb /
//  .cb-item.auto-filled) игнорируется — значение приходит
//  из общих данных/анализов. Ручные карточки переключаются
//  штатной label-активацией скрытого чекбокса.
//  Значки-подсказки (⚠️) работают по наведению и не
//  затрагиваются; на всякий случай их клики пропускаем.
// ===================================================
document.addEventListener('click', function(e) {
  var target = e.target;
  if (!target || !target.closest) return;
  if (target.closest('.warning-icon')) return;
  var label = target.closest('label.auto-cb, label.cb-item.auto-filled');
  if (label) e.preventDefault();
});