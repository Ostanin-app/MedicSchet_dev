// ===================================================
//  РАСШИРЕННЫЙ СПИСОК ПОКАЗАТЕЛЕЙ ДЛЯ EMR-ПАРСЕРА
// ===================================================
const OCR_INDICATORS = [
  { keys: ['креатинин', 'cr', 'creatinine', 'креатинин (мкмоль/л)', 'креатинин мкмоль/л'], field: 'creatinine', unitExpected: 'мкмоль/л' },
  { keys: ['гемоглобин', 'hb', 'hemoglobin', 'гемоглобин (г/л)', 'гемоглобин г/л'], field: 'hb', unitExpected: 'г/л' },
  { keys: ['гематокрит', 'ht', 'hematocrit', 'гематокрит (%)'], field: 'hct', unitExpected: '%' },
  { keys: ['тромбоциты', 'plt', 'platelets', 'тромбоциты (×10⁹/л)', 'тромбоциты ×10⁹/л'], field: 'plt', unitExpected: '×10⁹/л' },
  { keys: ['ад', 'артериальное давление', 'ад (мм рт.ст.)', 'систолическое ад'], field: 'sbp', unitExpected: 'мм рт.ст.' },
  { keys: ['чсс', 'пульс', 'hr', 'частота сердечных сокращений', 'чсс (уд/мин)'], field: 'hr', unitExpected: 'уд/мин' },
  { keys: ['вес', 'масса', 'вес (кг)', 'масса (кг)'], field: 'weight', unitExpected: 'кг' },
  { keys: ['рост', 'height', 'рост (см)'], field: 'height', unitExpected: 'см' },
  { keys: ['температура', 'т°', 'температура (°c)', 't°'], field: 'pesi_temp', unitExpected: '°C' },
  { keys: ['чд', 'чдд', 'частота дыханий', 'чдд (в мин)'], field: 'pesi_rr', unitExpected: 'в мин' },
  { keys: ['сатурация', 'spo2', 'spo₂', 'сатурация (%)'], field: 'pesi_spo2', unitExpected: '%' },
  { keys: ['натрий', 'na', 'sodium', 'натрий (ммоль/л)'], field: 'na_measured', unitExpected: 'ммоль/л' },
  { keys: ['глюкоза', 'glucose', 'глюкоза (ммоль/л)'], field: 'glucose', unitExpected: 'ммоль/л' },
  { keys: ['калий', 'k', 'potassium', 'калий (ммоль/л)', 'k+'], field: 'potassium', unitExpected: 'ммоль/л' },
  { keys: ['магний', 'mg', 'magnesium', 'магний (ммоль/л)', 'mg2+'], field: 'magnesium', unitExpected: 'ммоль/л' },
  { keys: ['кфк-мв', 'кфк мв', 'ck-mb', 'kk-mb', 'кк-мв', 'kk', 'креатинфосфокиназа-мв', 'креатинкиназа-мв'], field: 'ck_mb', unitExpected: 'Ед/л' },
  { keys: ['кфк', 'креатинфосфокиназа', 'креатинкиназа', 'ck', 'ck-nac', 'кфк общая'], field: 'ck_total', unitExpected: 'Ед/л' },
  { keys: ['лейкоциты', 'wbc', 'leukocytes', 'лейкоциты (×10⁹/л)'], field: 'wbc', unitExpected: '×10⁹/л' },
  { keys: ['холестерин-лпвп', 'холестерин лпвп', 'лпвп', 'hdl', 'hdl-c'], field: 'hdl', unitExpected: 'ммоль/л' },
  { keys: ['холестерин-лпнп', 'холестерин лпнп', 'лпнп', 'ldl', 'ldl-c'], field: 'ldl', unitExpected: 'ммоль/л' },
  { keys: ['триглицериды', 'триглецириды', 'тг', 'tg', 'triglycerides'], field: 'tg', unitExpected: 'ммоль/л' },
  { keys: ['общий холестерин', 'холестерин общий', 'холестерин', 'tchol', 'tc'], field: 'tchol', unitExpected: 'ммоль/л' }
];

// ===================================================
//  EMR-ПАРСЕР
// ===================================================
function findIndicator(rawName) {
  var words = rawName.toLowerCase().split(/[\s\-]+/).map(function(w) {
    return w.replace(/[^a-zа-я0-9]/g, '');
  }).filter(function(w) { return w.length > 0; });
  // «не-ЛПВП» / «не-ЛПНП» (non-HDL) — производные показатели, не вводим: слово «не» в названии
  if (words.indexOf('не') >= 0) return null;
  for (var i = 0; i < OCR_INDICATORS.length; i++) {
    var ind = OCR_INDICATORS[i];
    for (var j = 0; j < ind.keys.length; j++) {
      // Ключ может быть составным («холестерин-лпвп», «кфк-мв»): матчим по набору слов,
      // чтобы «Холестерин-ЛПВП» попадал в ЛПВП, а не в общий холестерин
      var keyWords = ind.keys[j].toLowerCase().split(/[\s\-]+/).map(function(w) {
        return w.replace(/[^a-zа-я0-9]/g, '');
      }).filter(function(w) { return w.length > 0; });
      if (keyWords.length === 0) continue;
      var allMatch = true;
      for (var k = 0; k < keyWords.length; k++) {
        if (words.indexOf(keyWords[k]) < 0) { allMatch = false; break; }
      }
      if (allMatch) return ind;
    }
  }
  return null;
}

function parseEMRText(text) {
  if (!text || typeof text !== 'string') return [];
  var lines = text.split(/\r?\n/);
  var results = [];

  // === ЭТАП 1: табулированный формат ===
  var usedTsv = false;
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line.trim()) continue;
    if (!/\t/.test(line)) continue;
    usedTsv = true;
    var parts = line.split('\t');
    if (parts.length < 2) continue;

    var rawName = (parts[0] || '').trim();
    var valueCell = '';
    var numMatch = null;
    var checkedCount = 0;

    for (var i = 1; i < parts.length; i++) {
      var cellText = (parts[i] || '').trim();
      if (!cellText) continue;
      checkedCount++;
      var cleanCell = cellText.replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim();
      var match = cleanCell.match(/^(\d+[.,]\d+|\d+)/);
      if (match) {
        valueCell = cleanCell;
        numMatch = match;
        break;
      }
      if (checkedCount >= 2) break;
    }

    if (!numMatch) continue;
    var numValue = parseFloat(numMatch[0].replace(',', '.'));
    if (isNaN(numValue)) continue;

    var unit = '';
    var unit = '';
    // Единица — первая непустая ячейка после значения (могут быть пустые/▲▼ ячейки)
    for (var ui = 2; ui < parts.length; ui++) {
      var u = (parts[ui] || '').trim();
      if (u && !/^[▲▼\s]*$/.test(u)) { unit = u.toLowerCase(); break; }
    }
    // Формат из двух колонок: единица следует за числом в той же ячейке («79.9 мкмоль/л»)
    if (!unit && parts.length === 2) {
      var afterNum = valueCell.replace(numMatch[0], '').trim();
      if (afterNum) unit = afterNum.toLowerCase();
    }

    var indicator = findIndicator(rawName);
    if (!indicator) continue;

    var finalValue = numValue;
    if (indicator.field === 'hb' && (unit.includes('г/дл') || unit.includes('g/dl'))) finalValue = numValue * 10;
    if (indicator.field === 'creatinine' && (unit.includes('мг/дл') || unit.includes('mg/dl'))) finalValue = numValue * 88.4;
    if (indicator.field === 'hct' && numValue < 1) finalValue = numValue * 100;
    if (indicator.field === 'sbp' && valueCell.includes('/')) finalValue = parseFloat(valueCell.split('/')[0].replace(/▲/g, '').trim());
    // Липиды в мг/дл → ммоль/л: холестерин × 0,0259; триглицериды × 0,0113
    if ((indicator.field === 'tchol' || indicator.field === 'hdl' || indicator.field === 'ldl') &&
        (unit.includes('мг/дл') || unit.includes('mg/dl'))) finalValue = numValue * 0.0259;
    if (indicator.field === 'tg' &&
        (unit.includes('мг/дл') || unit.includes('mg/dl'))) finalValue = numValue * 0.0113;

    results.push({
      fieldId: indicator.field,
      value: finalValue,
      displayValue: (indicator.field === 'sbp' || indicator.field === 'hr' || indicator.field === 'age') ? Math.round(finalValue) : finalValue,
      label: indicator.keys[0],
      rawName: rawName,
      extra: null
    });
  }

  // === ЭТАП 2: свободный текст ===
  if (!usedTsv) {
    var cleanText = text.replace(/[▲▼]/g, ' ');
    for (var ii = 0; ii < OCR_INDICATORS.length; ii++) {
      var ind2 = OCR_INDICATORS[ii];
      for (var jj = 0; jj < ind2.keys.length; jj++) {
        var key = ind2.keys[jj];
        var escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex = new RegExp(escapedKey + '\\s*[^\\d]*?(\\d+[.,]\\d+|\\d+)', 'gi');
        var m;
        while ((m = regex.exec(cleanText)) !== null) {
          // «не-ЛПВП» / «не-ЛПНП» (non-HDL) — пропускаем и продолжаем поиск дальше
          var beforeKey = cleanText.substring(0, m.index);
          if (/не\s*-?\s*$/i.test(beforeKey)) continue;
          // Ключ, за которым сразу идёт «/» — это единица измерения («mg/dl», «г/дл»), а не показатель
          if (cleanText.charAt(m.index + key.length) === '/') continue;
          var valStr = m[1].replace(',', '.');
          var numVal = parseFloat(valStr);
          if (!isNaN(numVal)) {
            if (ind2.field === 'hb' && /г\/дл|g\/dl/i.test(cleanText.substring(m.index))) numVal *= 10;
            if (ind2.field === 'creatinine' && /мг\/дл|mg\/dl/i.test(cleanText.substring(m.index))) numVal *= 88.4;
            // Липиды в мг/дл → ммоль/л: холестерин × 0,0259; триглицериды × 0,0113
            if ((ind2.field === 'tchol' || ind2.field === 'hdl' || ind2.field === 'ldl') &&
                /мг\/дл|mg\/dl/i.test(cleanText.substring(m.index))) numVal *= 0.0259;
            if (ind2.field === 'tg' &&
                /мг\/дл|mg\/dl/i.test(cleanText.substring(m.index))) numVal *= 0.0113;
            results.push({
              fieldId: ind2.field,
              value: numVal,
              displayValue: (ind2.field === 'sbp' || ind2.field === 'hr' || ind2.field === 'age') ? Math.round(numVal) : numVal,
              label: key,
              rawName: key,
              extra: null
            });
            // Вырезаем распознанный фрагмент, чтобы общий ключ («холестерин») не
            // перехватил уже распознанный «Холестерин-ЛПВП»/«Холестерин-ЛПНП»
            cleanText = cleanText.slice(0, m.index) + cleanText.slice(m.index + m[0].length);
            break;
          }
        }
      }
    }
  }

  return results;
}

function applyParsedData(parsedItems) {
  var applied = [];
  var skipped = [];

  for (var i = 0; i < parsedItems.length; i++) {
    var item = parsedItems[i];
    var input = document.getElementById(item.fieldId);
    if (!input) continue;

    if (input.value && input.value.trim() !== '') {
      skipped.push(item.label);
      continue;
    }

    var valueToSet = item.displayValue;
    if (item.fieldId === 'sbp' || item.fieldId === 'hr' || item.fieldId === 'age') {
      valueToSet = Math.round(item.displayValue);
    }

    input.value = valueToSet;
    flashField(input);

    var parentGroup = input.closest('.input-group');
    if (parentGroup) {
      parentGroup.classList.add('emr-filled');
      input.addEventListener('input', function removeMarker(e) {
        var group = e.target.closest('.input-group');
        if (group) group.classList.remove('emr-filled');
      }, { once: true });
    }

    if (item.fieldId === 'hr' && item.extra && item.extra.isRangeAvg) {
      var warningSpan = parentGroup ? parentGroup.querySelector('.hr-range-warning') : null;
      if (!warningSpan && parentGroup) {
        warningSpan = document.createElement('span');
        warningSpan.className = 'warning-icon hr-range-warning';
        warningSpan.style.marginLeft = '8px';
        warningSpan.style.cursor = 'help';
        warningSpan.innerHTML = '⚠️';
        parentGroup.appendChild(warningSpan);

        var tooltipText = 'ЧСС вычислена как средняя из диапазона (' + item.extra.originalRange + ' → ' + valueToSet + '). Проверьте и при необходимости исправьте вручную.';
        setupTooltipTrigger(warningSpan, tooltipText);

        var removeWarning = function() {
          if (warningSpan && warningSpan.parentNode) warningSpan.parentNode.removeChild(warningSpan);
          input.removeEventListener('input', removeWarning);
        };
        input.addEventListener('input', removeWarning);
      }
    }

    applied.push(item.label);
  }

  updateAnalysisPanel();
  return { applied: applied, skipped: skipped };
}

function handleEmrPaste() {
  var textarea = document.getElementById('emrPaste');
  var statusEl = document.getElementById('emrStatus');
  var text = textarea.value;

  if (!text || text.length < 5) {
    statusEl.textContent = '⏳ Вставьте текст из ЭМК...';
    statusEl.style.color = 'var(--muted)';
    return;
  }

  saveUndoState();

  var parsed = parseEMRText(text);

  if (parsed.length === 0) {
    statusEl.textContent = '❌ Данные не распознаны. Проверьте формат или заполните вручную.';
    statusEl.style.color = 'var(--red)';
    return;
  }

  var result = applyParsedData(parsed);
  var applied = result.applied;
  var skipped = result.skipped;
  var totalParsed = parsed.length;
  var ignoredCount = totalParsed - applied.length - skipped.length;

  var statusMsg = '';
  if (applied.length > 0) {
    statusMsg = '✅ Заполнено: ' + applied.join(', ') + '. ';
    statusEl.style.color = 'var(--green)';
  }
  if (skipped.length > 0) {
    statusMsg += '⚠️ Пропущено (уже заполнены): ' + skipped.join(', ') + '. ';
    statusEl.style.color = 'var(--orange)';
  }
  if (ignoredCount > 0) {
    statusMsg += 'ℹ️ Проигнорировано показателей: ' + ignoredCount + '.';
  }
  if (applied.length === 0 && skipped.length === 0) {
    statusMsg = '❌ Данные не распознаны. Проверьте формат или заполните вручную.';
    statusEl.style.color = 'var(--red)';
  }

  statusEl.textContent = statusMsg;
  autofill();
  updateAnalysisPanel();
  saveAppState();
}

// ===================================================
//  ИИ-РАЗБОР СЛУЧАЯ (публичный прокси Yandex Cloud Function → GigaChat)
// ===================================================
//  Берёт произвольный текст из emrPaste, отправляет на публичный прокси
//  (Yandex Cloud Function → GigaChat), получает JSON {fields, comment} и:
//   1) заполняет поля тем же способом, что applyParsedData (через getElementById);
//   2) показывает комментарий ИИ (с упоминанием уместных шкал).
window.handleAiParse = function() {
  var textarea = document.getElementById('emrPaste');
  var statusEl = document.getElementById('aiStatus');
  var btn = document.getElementById('aiParseBtn');
  if (!textarea || !statusEl) return;

  var text = textarea.value;
  if (!text || text.trim().length < 5) {
    showAiMsg('warn', 'Сначала вставьте текст выписки или протокола в поле выше.');
    return;
  }

  // состояние загрузки
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="ai-dot loading" id="aiDot"></span><span class="ai-ico">🤖</span><span>Анализирую…</span>';
  }
  showAiMsg('loading', 'ИИ разбирает текст…');

  fetch('https://functions.yandexcloud.net/d4evnu5gkvglk7oah3qi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
  .then(function(res) {
    if (!res.ok) {
      showAiMsg('err', 'Ошибка ИИ: ' + (res.data.error || 'неизвестно') +
        '\nПопробуйте ещё раз или проверьте подключение к интернету.');
      return;
    }

    var parsed = res.data || {};
    var fields = parsed.fields || {};
    var applied = [];

    // --- пол (sex) обрабатываем отдельно: это переключатель, не число ---
    if (fields.sex === 'm' || fields.sex === 'f') {
      var sexInput = document.getElementById('sex');
      if (sexInput) {
        sexInput.value = fields.sex;
        if (window.syncSexFromHidden) syncSexFromHidden();
        else {
          // запасной вариант, если функция недоступна
          document.querySelectorAll('.sex-btn[data-sex]').forEach(function(b){
            b.classList.toggle('active', b.dataset.sex === fields.sex);
          });
        }
        applied.push('sex');
      }
    }

    // --- курение (smoking): переключатель Не курит/Бросил/Курит, не число ---
    if (fields.smoking === 'yes' || fields.smoking === 'quit' || fields.smoking === 'no') {
      var smokeInput = document.getElementById('smoking');
      if (smokeInput) {
        smokeInput.value = fields.smoking;
        if (window.syncSmokingFromHidden) syncSmokingFromHidden();
        else {
          // запасной вариант, если функция недоступна
          document.querySelectorAll('.sex-btn[data-smoke]').forEach(function(b){
            b.classList.toggle('active', b.dataset.smoke === fields.smoking);
          });
        }
        applied.push('smoking');
      }
    }

    // --- заполняем числовые поля (как applyParsedData, но без пропуска заполненных) ---
    Object.keys(fields).forEach(function(id) {
      if (id === 'sex' || id === 'smoking') return; // уже обработали отдельно
      var input = document.getElementById(id);
      if (!input) return;
      var val = fields[id];
      if (val === null || val === undefined || val === '') return;
      var num = parseFloat(String(val).replace(',', '.'));
      if (isNaN(num)) return;
      if (id === 'sbp' || id === 'hr' || id === 'age') num = Math.round(num);
      input.value = num;
      var grp = input.closest('.input-group');
      if (grp) {
        grp.classList.add('emr-filled');
        input.addEventListener('input', function rem(e) {
          var g = e.target.closest('.input-group');
          if (g) g.classList.remove('emr-filled');
        }, { once: true });
      }
      applied.push(id);
    });

    // --- заполняем чекбоксы состояний (вариант А: только ставим, не снимаем) ---
    var checkboxes = parsed.checkboxes || {};
    Object.keys(CHECKBOX_LABELS).forEach(function(cbId) {
      if (checkboxes[cbId] !== true) return; // только подтверждённые true
      var cbEl = document.getElementById(cbId);
      if (!cbEl) return;
      if (cbEl.checked) return; // уже отмечен врачом — не трогаем (вариант А)
      cbEl.checked = true;
      var grp = cbEl.closest('.cb-item');
      if (grp) {
        grp.classList.add('emr-filled');
        cbEl.addEventListener('change', function rem(e) {
          var g = e.target.closest('.cb-item');
          if (g) g.classList.remove('emr-filled');
        }, { once: true });
      }
      applied.push(cbId);
    });

    // --- показываем карточку ответа ---
    renderAiAnswer(parsed, applied);

    // точка: зелёная «готово», через 3 с вернётся в покой
    var d = document.getElementById('aiDot');
    if (d) { d.classList.remove('loading'); d.classList.add('done'); setTimeout(function() { d.classList.remove('done'); }, 3000); }

    // обновляем зависимые панели, как после обычного ввода
    if (window.autofill) autofill();
    if (window.updateAnalysisPanel) updateAnalysisPanel();
    if (window.saveAppState) saveAppState();
  })
  .catch(function(err) {
    showAiMsg('err', 'Не удалось связаться с прокси: ' + err.message +
      '\nЗапустите прокси: node server.js (папка MedicSchet-proxy).');
    var d = document.getElementById('aiDot');
    if (d) { d.classList.remove('loading'); d.classList.add('error'); setTimeout(function() { d.classList.remove('error'); }, 3000); }
  })
  .then(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ai-dot" id="aiDot"></span><span class="ai-ico">🤖</span><span id="aiBtnLabel">Разобрать ИИ</span>'; }
  });
};

// Показывает служебное сообщение (loading / warn / err) в карточке ИИ.
function showAiMsg(kind, msg) {
  var statusEl = document.getElementById('aiStatus');
  if (!statusEl) return;
  statusEl.className = 'ai-answer' + (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : '');
  statusEl.style.display = '';
  // прячем секции с данными, показываем только сообщение
  var secs = ['aiFieldsSec', 'aiCommentSec'];
  secs.forEach(function(s) { var el = document.getElementById(s); if (el) el.style.display = 'none'; });
  var msgSec = document.getElementById('aiMsgSec');
  var msgEl = document.getElementById('aiMsg');
  if (msgSec) msgSec.style.display = '';
  if (msgEl) {
    msgEl.textContent = msg;
    msgEl.innerHTML = escapeHtml(msg).replace(/\n/g, '<br>');
  }
  var timeEl = document.getElementById('aiTime');
  if (timeEl) timeEl.textContent = '';
}

// Рендерит карточку ответа ИИ: чипы полей, комментарий, шкалы.
function renderAiAnswer(parsed, applied) {
  var statusEl = document.getElementById('aiStatus');
  if (!statusEl) return;
  statusEl.className = 'ai-answer';
  statusEl.style.display = '';

  var timeEl = document.getElementById('aiTime');
  if (timeEl) timeEl.textContent = 'только что';

  // --- секция полей (чипы) ---
  var fieldsSec = document.getElementById('aiFieldsSec');
  var chipsEl = document.getElementById('aiChips');
  if (fieldsSec && chipsEl) {
    chipsEl.innerHTML = '';
    if (applied.length > 0) {
      fieldsSec.style.display = '';
      applied.forEach(function(id) {
        // чекбокс состояния — показываем галочку вместо значения
        if (id.indexOf('cb_') === 0) {
          var cbLabel = CHECKBOX_LABELS[id] || id;
          var chipCb = document.createElement('span');
          chipCb.className = 'chip';
          chipCb.innerHTML = '<span>' + escapeHtml(cbLabel) + '</span>' +
            '<span class="v">✓</span>';
          chipsEl.appendChild(chipCb);
          return;
        }
        var label = FIELD_LABELS[id] || id;
        var unit = FIELD_UNITS[id] || '';
        var val = parsed.fields[id];
        var displayVal = val;
        if (id === 'sex') {
          displayVal = (val === 'm') ? 'мужской' : (val === 'f') ? 'женский' : val;
          unit = ''; // у пола нет единиц
        } else if (id === 'smoking') {
          displayVal = (val === 'yes') ? 'курит' : (val === 'quit') ? 'бросил' : (val === 'no') ? 'не курит' : val;
          unit = ''; // у курения нет единиц
        }
        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.innerHTML = '<span>' + escapeHtml(label) + '</span>' +
          '<span class="v">' + escapeHtml(String(displayVal)) + '</span>' +
          (unit ? '<span class="u">' + escapeHtml(unit) + '</span>' : '');
        chipsEl.appendChild(chip);
      });
    } else {
      fieldsSec.style.display = 'none';
    }
  }

  // --- секция комментария ---
  var commentSec = document.getElementById('aiCommentSec');
  var commentEl = document.getElementById('aiComment');
  if (commentSec && commentEl) {
    if (parsed.comment) {
      commentSec.style.display = '';
      commentEl.textContent = parsed.comment;
    } else {
      commentSec.style.display = 'none';
    }
  }

  // сообщение скрываем (показываем только данные)
  var msgSec = document.getElementById('aiMsgSec');
  if (msgSec) msgSec.style.display = 'none';
}

// Русские подписи и единицы для чипов заполненных полей (ИИ-ответ).
var FIELD_LABELS = {
  sex: 'Пол', age: 'Возраст', height: 'Рост', weight: 'Вес', sbp: 'АД сист.', hr: 'ЧСС',
  creatinine: 'Креатинин', hb: 'Гемоглобин', hct: 'Гематокрит', plt: 'Тромбоциты',
  wbc: 'Лейкоциты', ck_total: 'КФК общая', ck_mb: 'КФК-МВ',
  na_measured: 'Натрий', glucose: 'Глюкоза', potassium: 'Калий', magnesium: 'Магний',
  tchol: 'Холестерин', hdl: 'ЛПВП', tg: 'Триглицериды', ldl: 'ЛПНП', hba1c: 'HbA1c',
  smoking: 'Курение'
};
// Русские подписи для чекбоксов состояний (ИИ-ответ).
var CHECKBOX_LABELS = {
  'cb_dm': 'Сахарный диабет',
  'cb_hf': 'Сердечная недостаточность',
  'cb_htn': 'АГ (диагностированная)',
  'cb_stroke': 'Инсульт в анамнезе',
  'cb_tia': 'ТИА в анамнезе',
  'cb_embolism': 'Системная эмболия',
  'cb_vte': 'ТГВ/ТЭЛА в анамнезе',
  'cb_vasc': 'Сосудистое заболевание',
  'cb_verapamil': 'Приём верапамила',
  'pesi_cancer': 'ЗНО (активное или в анамнезе)',
    'cap_cancer': 'Злокачественная опухоль (Caprini)',
    'wells_cancer': 'ЗНО с лечением (Wells)',
    'geneva_cancer': 'Активное ЗНО (Женева)',
    'arc_cancer': 'Активное ЗНО (ARC-HBR)',
    'cap_copd': 'ХОБЛ (Caprini)',
    'pesi_copd': 'Хроническое заболевание лёгких (PESI)'
};
var FIELD_UNITS = {
  age: 'лет', height: 'см', weight: 'кг', sbp: 'мм рт.ст.', hr: 'уд/мин',
  creatinine: 'мкмоль/л', hb: 'г/л', hct: '%', plt: '×10⁹/л', wbc: '×10⁹/л',
  ck_total: 'Ед/л', ck_mb: 'Ед/л', na_measured: 'ммоль/л', glucose: 'ммоль/л',
  potassium: 'ммоль/л', magnesium: 'ммоль/л', tchol: 'ммоль/л', hdl: 'ммоль/л',
  tg: 'ммоль/л', ldl: 'ммоль/л', hba1c: '%'
};

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===================================================
//  МОДУЛЬ: КАЛИЙ
// ===================================================
window.calcKInfusion = function() {
  var deficitEl = document.getElementById('k_hidden_deficit');
  var resEl = document.getElementById('k_calc_result');
  if (!deficitEl || !resEl) return;

  var deficit = parseFloat(deficitEl.value);
  if (isNaN(deficit) || deficit <= 0) {
    resEl.innerHTML = '';
    return;
  }

  var potassiumEl = document.getElementById('potassium');
  var magnesiumEl = document.getElementById('magnesium');
  var kValueRaw  = potassiumEl ? potassiumEl.value.trim().replace(',', '.') : '';
  var mgValueRaw = magnesiumEl ? magnesiumEl.value.trim().replace(',', '.') : '';
  var kValueNum  = parseFloat(kValueRaw);
  var mgValueNum = parseFloat(mgValueRaw);

  // Препарат KCl
  var drugEls  = document.getElementsByName('k_drug');
  var drugMmol = 0.54;
  var drugName = '4';
  for (var i = 0; i < drugEls.length; i++) {
    if (drugEls[i].checked) {
      drugMmol = parseFloat(drugEls[i].getAttribute('data-mmol'));
      drugName = drugEls[i].value;
      break;
    }
  }

  // Объём растворителя
  var volEl = document.getElementById('k_vol');
  if (!volEl) return;
  var volMl = parseFloat(volEl.value);
  if (isNaN(volMl) || volMl <= 0) return;
  var volL = volMl / 1000;

  // Доступ
  var accEls = document.getElementsByName('k_acc');
  var isCvk  = false;
  for (var j = 0; j < accEls.length; j++) {
    if (accEls[j].checked && accEls[j].value === 'cvk') {
      isCvk = true;
      break;
    }
  }
  var accessText = isCvk ? 'ЦВК' : 'ПВК';

  var maxConc = isCvk ? 120 : 40;
  var maxRate = isCvk ? 20  : 10;

  var maxMmolForVol  = maxConc * volL;
  var mmolToInfuse   = Math.min(deficit, maxMmolForVol);
  mmolToInfuse       = Math.floor(mmolToInfuse * 10) / 10;

  if (mmolToInfuse <= 0) {
    resEl.innerHTML = '';
    return;
  }

  var requiredMlNum = mmolToInfuse / drugMmol;
  var requiredMl    = requiredMlNum.toFixed(1).replace('.', ',');

  // Магний
  var addMgCheckbox = document.getElementById('k_add_mg');
  var addMg         = !!(addMgCheckbox && addMgCheckbox.checked);
  var mgMlNum       = 0;
  var mgLabelText   = '';
  var mgWarningText = '';

  if (addMg && !isNaN(mgValueNum)) {
    if (mgValueNum < 0.5)       mgMlNum = 10;
    else if (mgValueNum < 0.7)  mgMlNum = 5;

    if (mgMlNum > 0) {
      mgLabelText = '<div class="k-builder__result-line">Дополнительно: <strong>' + mgMlNum + ' мл</strong> (MgSO₄ 25%)</div>';
    }

    var ageK    = parseNum('age');
    var sexElK  = document.getElementById('sex');
    var sexK    = sexElK ? sexElK.value : '';
    var heightK = parseNum('height');
    var weightK = parseNum('weight');
    var creatK  = parseNum('creatinine');

    var crclData = getWorkingCrClData(ageK, sexK, heightK, weightK, creatK);

    if (!crclData || crclData.workingCrcl === null) {
      mgWarningText = 'Функция почек не оценена. При тяжёлой ХБП риск гипермагниемии. Осторожно при AV-блокадах.';
    } else if (crclData.workingCrcl < 30) {
      mgWarningText = 'Внимание: рабочий КлКр ' + crclData.workingCrcl.toFixed(1).replace('.', ',') +
        ' мл/мин. Повышен риск гипермагниемии. Требуется осторожность, контроль Mg²⁺ и клинический мониторинг.';
    }
  }

  // Время
  var minTimeMinutes    = (mmolToInfuse / maxRate) * 60;
  var roundedTimeMinutes = Math.ceil(minTimeMinutes / 15) * 15;
  if (roundedTimeMinutes < 15) roundedTimeMinutes = 15;

  function formatTime(totalMinutes) {
    var hrs  = Math.floor(totalMinutes / 60);
    var mins = totalMinutes % 60;
    if (hrs > 0 && mins > 0) return hrs + ' ч ' + mins + ' мин';
    if (hrs > 0) return hrs + ' ч';
    return mins + ' мин';
  }

  var timeStr         = formatTime(roundedTimeMinutes);
  var finalVolumeMl   = volMl + requiredMlNum + mgMlNum;
  var rateMlPerHour   = Math.round(finalVolumeMl / (roundedTimeMinutes / 60));
  var remainderNum    = Math.max(0, deficit - mmolToInfuse);
  var remainderStr    = remainderNum.toFixed(1).replace('.', ',');
  var coveredPercentRaw = (mmolToInfuse / deficit) * 100;
  var coveredPercent  = Math.min(100, Math.round(coveredPercentRaw));

  var kValueForText  = kValueRaw  ? kValueRaw.replace('.', ',')  : '';
  var mgValueForText = mgValueRaw ? mgValueRaw.replace('.', ',') : '';

  var copyText = '';
  if (addMg && mgMlNum > 0) {
    copyText = 'Учитывая результаты анализов крови (калий ' + kValueForText + ' ммоль/л, магний ' + mgValueForText +
      ' ммоль/л), назначена инфузия: KCl ' + drugName + '% — ' + requiredMl +
      ' мл + MgSO₄ 25% — ' + mgMlNum + ' мл + NaCl 0,9% — ' + volMl +
      ' мл. В/в ч/з ' + accessText + ', не быстрее чем за ' + timeStr + '.';
  } else {
    copyText = 'Учитывая результаты анализов крови (калий ' + kValueForText +
      ' ммоль/л), назначена инфузия калия: KCl ' + drugName + '% — ' + requiredMl +
      ' мл + NaCl 0,9% — ' + volMl +
      ' мл. В/в ч/з ' + accessText + ', не быстрее чем за ' + timeStr + '.';
  }

  var remainderHtml = '';
  if (remainderNum <= 0.05) {
    remainderHtml = 'Расчётный внеклеточный дефицит может быть восполнен.';
  } else {
    remainderHtml = 'Ориентировочный остаток внеклеточного дефицита: <strong>' + remainderStr + '</strong> ммоль.';
  }

  var infusionWarnings = [];
  if (coveredPercentRaw < 20) {
    if (isCvk) {
      infusionWarnings.push('При выбранных условиях восполняется лишь ' + coveredPercent + '% дефицита. Рассмотрите увеличение объёма растворителя или проведение последовательных инфузий.');
    } else {
      infusionWarnings.push('При выбранных условиях восполняется лишь ' + coveredPercent + '% дефицита. Рассмотрите увеличение объёма растворителя или использование ЦВК.');
    }
  }
  if (!isCvk && !isNaN(kValueNum) && kValueNum < 2.5) {
    infusionWarnings.push('При данном уровне гипокалиемии предпочтительно рассмотреть ЦВК.');
  }
  if (!isCvk && requiredMlNum > 40) {
    infusionWarnings.push('Требуется большой объём концентрата калия (>40 мл). Рассмотрите разделение на несколько последовательных инфузий.');
  }
  if (isCvk && requiredMlNum > 60) {
    infusionWarnings.push('Требуется большой объём концентрата калия (>60 мл). Рассмотрите разделение на несколько последовательных инфузий.');
  }
  if (mgWarningText) infusionWarnings.push(mgWarningText);

  var warningsHtml = '';
  if (infusionWarnings.length > 0) {
    warningsHtml = '<div class="k-note-box k-note-box--warning">';
    infusionWarnings.forEach(function(w) {
      warningsHtml += '<div style="margin-bottom:4px;">' + w + '</div>';
    });
    warningsHtml += '</div>';
  }

  resEl.innerHTML =
    '<div class="k-builder__result">' +
      '<div class="k-builder__result-line">Добавить: <strong>' + requiredMl + ' мл</strong> (KCl ' + drugName + '%)</div>' +
      mgLabelText +
      '<div class="k-builder__result-line">В раствор: <strong>' + volMl + ' мл</strong> (NaCl 0,9%)</div>' +
      '<div class="k-builder__result-time">Капать <strong>НЕ БЫСТРЕЕ</strong>, чем за <strong>' + timeStr + '</strong></div>' +
      '<div class="k-builder__meta">' +
        'Восполняется: <strong>' + mmolToInfuse.toFixed(1).replace('.', ',') + '</strong> ммоль K⁺.<br>' +
        'Ориентировочная скорость: <strong>~' + rateMlPerHour + '</strong> мл/ч.<br>' +
        remainderHtml + '<br>' +
        'Контроль K⁺ через 2–4 ч после окончания инфузии.' +
      '</div>' +
      warningsHtml +
      '<button onclick="window.copyKInfusion(this)" data-text="' + copyText + '" class="k-builder__copy-btn">📋 Копировать назначение</button>' +
    '</div>';
};

function renderPotassiumModule() {
  var k = parseNum('potassium');
  if (k === null) return null;

  if (k <= 0) {
    return makeResultCard('Калий', 'Ошибка данных',
      'Значение должно быть больше 0', 'moderate',
      'Проверьте корректность введённого значения калия.', '');
  }

  var mg     = parseNum('magnesium');
  var weight = parseNum('weight');
  var plt    = parseNum('plt');
  var hasDM  = cb('cb_dm');

  // ===== НОРМА =====
  if (k >= 3.5 && k <= 5.0) {
    return makeResultCard('Калий', k.toFixed(1) + ' ммоль/л',
      'Калий в пределах нормы', 'low',
      'Коррекция обычно не требуется.', '');
  }

  // ===== ГИПОКАЛИЕМИЯ =====
  if (k < 3.5) {
    var hypoGrade = '';
    var hypoRisk  = 'moderate';
    if (k >= 3.0)      { hypoGrade = 'Лёгкая гипокалиемия';     hypoRisk = 'moderate'; }
    else if (k >= 2.5) { hypoGrade = 'Умеренная гипокалиемия';   hypoRisk = 'high'; }
    else if (k >= 2.0) { hypoGrade = 'Тяжёлая гипокалиемия';     hypoRisk = 'veryhigh'; }
    else               { hypoGrade = 'Критическая гипокалиемия';  hypoRisk = 'veryhigh'; }

    var empiricalDeficit = '';
    if (k >= 3.0)      empiricalDeficit = '~200 ммоль';
    else if (k >= 2.5) empiricalDeficit = '200–400 ммоль';
    else if (k >= 2.0) empiricalDeficit = '400–600 ммоль';
    else               empiricalDeficit = '600–800+ ммоль';

    var formulaDeficit = null;
    if (weight !== null && weight > 0) {
      formulaDeficit = Math.round((4.0 - k) * weight * 0.4);
    }

    var ivBlock = '';
    if (formulaDeficit !== null && formulaDeficit > 0) {
      // Сохраняем выбор пользователя при пересборке блока (объём/препарат/доступ)
      var prevVolEl = document.getElementById('k_vol');
      var prevVolValue = prevVolEl ? prevVolEl.value : '250';
      var prevDrugEl = document.querySelector('input[name="k_drug"]:checked');
      var prevDrugValue = prevDrugEl ? prevDrugEl.value : '4';
      var prevAccEl = document.querySelector('input[name="k_acc"]:checked');
      var prevAccValue = prevAccEl ? prevAccEl.value : 'pvk';
      var magnesiumOptionBlock = '';
      if (mg !== null && mg < 0.7) {
        var mgDisplay = mg.toFixed(2).replace('.', ',');
        magnesiumOptionBlock =
          '<div class="k-builder__section">' +
            '<span class="k-builder__label">Сопутствующая коррекция:</span>' +
            '<div class="k-builder__options">' +
              '<label class="k-builder__option">' +
                '<input type="checkbox" id="k_add_mg" onchange="window.calcKInfusion()"> ' +
                '<span>Добавить MgSO₄ 25% (Mg ' + mgDisplay + ' ммоль/л)</span>' +
              '</label>' +
            '</div>' +
          '</div>';
      }

      ivBlock =
        '<div class="k-builder">' +
          '<div class="k-builder__title">💡 Расчёт инфузии</div>' +
          '<div class="k-builder__deficit">' +
            '<span class="k-inline-help" title="Отражает только дефицит в плазме крови. Внутриклеточный (общий) дефицит восполняется несколько суток.">' +
              'Внеклеточный' +
            '</span> дефицит: <strong>~' + formulaDeficit + ' ммоль</strong>' +
          '</div>' +
          '<input type="hidden" id="k_hidden_deficit" value="' + formulaDeficit + '">' +
          '<div class="k-builder__section">' +
            '<span class="k-builder__label">Препарат KCl:</span>' +
            '<div class="k-builder__options">' +
              '<label class="k-builder__option"><input type="radio" name="k_drug" value="4" data-mmol="0.54"' + (prevDrugValue === '4' ? ' checked' : '') + ' onchange="window.calcKInfusion()"> <span>4%</span></label>' +
              '<label class="k-builder__option"><input type="radio" name="k_drug" value="7.5" data-mmol="1.0"' + (prevDrugValue === '7.5' ? ' checked' : '') + ' onchange="window.calcKInfusion()"> <span>7.5%</span></label>' +
              '<label class="k-builder__option"><input type="radio" name="k_drug" value="10" data-mmol="1.34"' + (prevDrugValue === '10' ? ' checked' : '') + ' onchange="window.calcKInfusion()"> <span>10%</span></label>' +
            '</div>' +
          '</div>' +
          '<div class="k-builder__section">' +
            '<span class="k-builder__label">Растворитель (NaCl 0,9%):</span>' +
            '<select id="k_vol" onchange="window.calcKInfusion()" class="k-builder__select">' +
              '<option value="100"' + (prevVolValue === '100' ? ' selected' : '') + '>100 мл</option>' +
              '<option value="200"' + (prevVolValue === '200' ? ' selected' : '') + '>200 мл</option>' +
              '<option value="250"' + (prevVolValue === '250' ? ' selected' : '') + '>250 мл</option>' +
              '<option value="400"' + (prevVolValue === '400' ? ' selected' : '') + '>400 мл</option>' +
              '<option value="500"' + (prevVolValue === '500' ? ' selected' : '') + '>500 мл</option>' +
              '<option value="1000"' + (prevVolValue === '1000' ? ' selected' : '') + '>1000 мл</option>' +
            '</select>' +
          '</div>' +
          '<div class="k-builder__section">' +
            '<span class="k-builder__label">Доступ:</span>' +
            '<div class="k-builder__options">' +
              '<label class="k-builder__option"><input type="radio" name="k_acc" value="pvk"' + (prevAccValue === 'pvk' ? ' checked' : '') + ' onchange="window.calcKInfusion()"> <span>ПВК</span></label>' +
              '<label class="k-builder__option"><input type="radio" name="k_acc" value="cvk"' + (prevAccValue === 'cvk' ? ' checked' : '') + ' onchange="window.calcKInfusion()"> <span>ЦВК</span></label>' +
            '</div>' +
          '</div>' +
          magnesiumOptionBlock +
          '<div id="k_calc_result"></div>' +
        '</div>';
    } else {
      ivBlock =
        '<div class="k-note-box k-note-box--primary">' +
          '<div class="k-note-box__title">💉 В/в коррекция</div>' +
          '<div><em>Введите вес пациента для генерации расчётов.</em></div>' +
        '</div>';
    }

    var totalBlock =
      '<div class="k-note-box k-note-box--secondary">' +
        '<div class="k-note-box__title">💊 Общий дефицит</div>' +
        '<div>Ориентировочно: <strong>' + empiricalDeficit + '</strong></div>' +
        '<div>После стабилизации K⁺ ≥ 3,5 — переход на пероральный приём (40–60 ммоль/сут).</div>' +
      '</div>';

    var warnings = [];
    if (k < 3.5 && mg === null) {
      warnings.push('🔍 Проверьте магний. Гипомагниемия — частая причина рефрактерной гипокалиемии.');
    } else if (k < 3.5 && mg !== null && mg < 0.7) {
      warnings.push('⚠️ Гипомагниемия (Mg ' + mg.toFixed(2) + ' ммоль/л). Сначала скорректируйте магний!');
    }
    if (k < 2.5) warnings.push('⚠️ Риск аритмий. Показан мониторинг ЭКГ. Контроль K⁺ через 2–4 ч.');
    if (hasDM)   warnings.push('💉 При инсулинотерапии (особенно ДКА) потребность в калии резко возрастает.');

    var warningsHtml = '';
    if (warnings.length > 0) {
      warningsHtml = '<div class="k-note-box k-note-box--warning">';
      warnings.forEach(function(w) { warningsHtml += '<div style="margin-bottom:4px;">' + w + '</div>'; });
      warningsHtml += '</div>';
    }

    var tooltipId   = 'k_hypo_tooltip_' + Date.now();
    var tooltipText =
      'ЭКСТРЕННАЯ В/В КОРРЕКЦИЯ\n' +
      'Формула (внеклеточный дефицит): (4,0 − K⁺) × вес × 0,4\n\n' +
      'БЕЗОПАСНОСТЬ (СОВРЕМЕННЫЕ СТАНДАРТЫ)\n' +
      'Периферическая вена (ПВК):\n' +
      '• Макс. концентрация: 40 ммоль/л\n' +
      '• Макс. скорость: 10 ммоль/ч\n' +
      'Центральная вена (ЦВК):\n' +
      '• Макс. концентрация: 120 ммоль/л\n' +
      '• Макс. скорость: 20 ммоль/ч\n\n' +
      'ОФИЦИАЛЬНАЯ ИНСТРУКЦИЯ (РФ)\n' +
      'Инструкция допускает разведение 10 мл 4% KCl в 100 мл NaCl (54 ммоль/л).\n' +
      'Однако по современным гайдам это значительно повышает риск химического флебита. Наш калькулятор использует строгий предел 40 ммоль/л для защиты вены.';

    var valueWithIcon = k.toFixed(1) + ' ммоль/л ' +
      '<span class="info-icon" id="' + tooltipId + '" style="cursor:help;font-size:20px;opacity:0.6;vertical-align:middle;">ⓘ</span>';

    var html = makeResultCard('Калий — коррекция', valueWithIcon, hypoGrade, hypoRisk,
      ivBlock + totalBlock + warningsHtml, '');

    setTimeout(function() {
      if (typeof window.calcKInfusion === 'function') window.calcKInfusion();
      var icon = document.getElementById(tooltipId);
      if (icon) setupTooltipTrigger(icon, tooltipText);
    }, 50);

    return html;
  }

  // ===== ГИПЕРКАЛИЕМИЯ =====
  if (k > 5.0) {
    var hyperGrade    = '';
    var hyperRisk     = 'moderate';
    var hyperDetails  = '';
    var hyperWarnings = [];

    hyperWarnings.push('🔬 Исключите ложную гиперкалиемию (гемолиз, жгут).');
    if (plt !== null && plt > 400) {
      hyperWarnings.push('🔬 Тромбоцитоз (' + plt + '×10⁹/л). Возможна псевдогиперкалиемия. Проверьте K⁺ в плазме.');
    }

    if (k <= 5.4) {
      hyperGrade   = 'Лёгкая гиперкалиемия';
      hyperRisk    = 'moderate';
      hyperDetails =
        '<div class="k-note-box k-note-box--plain">' +
          '<div>• Повторный контроль K⁺ для подтверждения</div>' +
          '<div>• Пересмотреть приём: <strong>АМКР, иАПФ, БРА, НПВП</strong></div>' +
          '<div>• Ограничить калий в диете</div>' +
        '</div>';
    } else if (k <= 6.0) {
      hyperGrade   = 'Умеренная гиперкалиемия';
      hyperRisk    = 'high';
      hyperDetails =
        '<div class="k-note-box k-note-box--plain">' +
          '<div>• <strong>Оценить ЭКГ</strong> (поиск высоких остроконечных Т)</div>' +
          '<div>• Временная отмена калийсберегающих препаратов</div>' +
          '<div>• Оценить функцию почек, рассмотреть петлевые диуретики</div>' +
        '</div>';
    } else if (k <= 6.4) {
      hyperGrade   = 'Тяжёлая гиперкалиемия';
      hyperRisk    = 'veryhigh';
      hyperDetails =
        '<div class="k-note-box k-note-box--plain">' +
          '<div>• <strong>Мониторинг ЭКГ обязателен</strong></div>' +
          '<div>• При изменениях на ЭКГ ➔ <strong>Кальция глюконат 10% 10-20 мл в/в</strong> (стабилизация миокарда)</div>' +
          '<div>• Инсулин 10 ЕД + глюкоза 40% 50 мл (сдвиг в клетки)</div>' +
          '<div>• Сальбутамол небулайзер 10-20 мг</div>' +
        '</div>';
    } else {
      hyperGrade   = 'Жизнеугрожающая гиперкалиемия ⚠️';
      hyperRisk    = 'veryhigh';
      hyperDetails =
        '<div class="k-urgent-box">' +
          '<div class="k-urgent-box__title">НЕОТЛОЖНЫЕ МЕРЫ:</div>' +
          '<div class="k-urgent-box__item">1. <strong>Стабилизация миокарда:</strong><br>' +
            '<em>СТРОГО при наличии изменений ЭКГ / кардиотоксичности!</em><br>' +
            'Кальция глюконат 10% 10–20 мл в/в.</div>' +
          '<div class="k-urgent-box__item">2. <strong>Сдвиг калия в клетки:</strong><br>' +
            'Инсулин 10 ЕД + глюкоза 40% 50 мл в/в.</div>' +
          '<div class="k-urgent-box__item">3. <strong>Удаление калия:</strong><br>' +
            'Петлевые диуретики / экстренный гемодиализ.</div>' +
        '</div>';
    }

    var hyperWarningsHtml = '';
    if (hyperWarnings.length > 0) {
      hyperWarningsHtml = '<div class="k-note-box k-note-box--warning">';
      hyperWarnings.forEach(function(w) { hyperWarningsHtml += '<div style="margin-bottom:4px;">' + w + '</div>'; });
      hyperWarningsHtml += '</div>';
    }

    var tooltipIdH   = 'k_hyper_tooltip_' + Date.now();
    var tooltipTextH =
      'Классификация гиперкалиемии:\n' +
      'Лёгкая: 5,1–5,4 ммоль/л\n' +
      'Умеренная: 5,5–6,0 ммоль/л\n' +
      'Тяжёлая: 6,1–6,4 ммоль/л\n' +
      'Жизнеугрожающая: ≥6,5 ммоль/л\n\n' +
      'Препараты, повышающие K⁺:\n' +
      'АМКР, иАПФ, БРА, НПВП, гепарин.';

    var valueWithIconH = k.toFixed(1) + ' ммоль/л ' +
      '<span class="info-icon" id="' + tooltipIdH + '" style="cursor:help;font-size:20px;opacity:0.6;vertical-align:middle;">ⓘ</span>';

    var htmlH = makeResultCard('Калий — оценка', valueWithIconH, hyperGrade, hyperRisk,
      hyperDetails + hyperWarningsHtml, '');

    setTimeout(function() {
      var icon = document.getElementById(tooltipIdH);
      if (icon) setupTooltipTrigger(icon, tooltipTextH);
    }, 50);

    return htmlH;
  }

  return null;
}

// ===================================================
//  МОДУЛЬ: НАТРИЙ
// ===================================================
function renderSodiumCorrectionModule() {
  var na  = parseNum('na_measured');
  var glu = parseNum('glucose');

  if (na === null || glu === null) return null;

  if (na <= 0 || glu <= 0) {
    return makeResultCard('Натрий', 'Ошибка данных',
      'Проверьте корректность введённых значений', 'moderate',
      'Значения должны быть больше 0.', '');
  }

  var measuredNa = na;
  var glucose    = glu;
  var katz       = measuredNa + 1.6 * ((glucose - 5.55) / 5.55);
  var hillier    = measuredNa + 2.4 * ((glucose - 5.55) / 5.55);

  var trueNa = (glucose <= 5.55) ? measuredNa : hillier;

  var interp = '', risk = '', detailsExtra = '';

  if (trueNa < 120)        { risk = 'veryhigh'; interp = '⚠️ Критическая гипонатриемия'; }
  else if (trueNa < 125)   { risk = 'veryhigh'; interp = 'Тяжелая гипонатриемия'; }
  else if (trueNa < 130)   { risk = 'high';     interp = 'Умеренная гипонатриемия'; }
  else if (trueNa < 135)   { risk = 'moderate'; interp = 'Лёгкая гипонатриемия'; }
  else if (trueNa <= 145)  { risk = 'low';      interp = 'Натрий в норме'; }
  else if (trueNa <= 150)  { risk = 'moderate'; interp = 'Лёгкая гипернатриемия'; }
  else if (trueNa <= 155)  { risk = 'high';     interp = 'Умеренная гипернатриемия'; }
  else                     { risk = 'veryhigh'; interp = '⚠️ Тяжелая гипернатриемия'; }

  if (glucose > 5.55) {
    if (measuredNa < 135 && trueNa >= 135 && trueNa <= 145) {
      interp = 'Псевдогипонатриемия';
      detailsExtra =
        '<div style="margin-bottom:6px;">Снижение натрия на бумаге обусловлено сдвигом воды из-за гипергликемии. Истинный уровень натрия находится в пределах нормы.</div>' +
        '<div style="padding:6px 8px;background:var(--orange-soft);border-left:3px solid var(--orange);border-radius:0 4px 4px 0;font-size:11.5px;">❗️ <strong>Важно:</strong> введение гипертонического натрия в этой ситуации противопоказано.</div>';
    } else if (measuredNa <= 145 && trueNa > 145) {
      detailsExtra = '<div style="margin-bottom:6px;">Истинный уровень натрия выше измеренного. Гипергликемия маскирует гипернатриемию (вероятна дегидратация).</div>';
    } else if (trueNa < 135) {
      detailsExtra = '<div style="margin-bottom:6px;">Даже с поправкой на гипергликемию у пациента сохраняется истинный дефицит натрия.</div>';
    } else {
      detailsExtra = '<div style="margin-bottom:6px;">Скорректированный с учётом гипергликемии истинный уровень натрия.</div>';
    }

    var tooltipIdNa = 'na_correction_tooltip_' + Date.now();
    var valueWithIconNa = hillier.toFixed(1) + ' / ' + katz.toFixed(1) + ' ммоль/л ' +
      '<span class="info-icon" id="' + tooltipIdNa + '" style="cursor:help;font-size:20px;opacity:0.6;vertical-align:middle;">ⓘ</span>';

    var htmlNa = makeResultCard('Скорректированный натрий', valueWithIconNa, interp, risk, detailsExtra, '');

    var tooltipTextNa =
      'Измеренный Na: ' + measuredNa.toFixed(1) + ' ммоль/л\n' +
      'Глюкоза: ' + glucose.toFixed(1) + ' ммоль/л\n\n' +
      'Хиллиер (коэф. 2,4): ' + hillier.toFixed(1) + ' ммоль/л\n' +
      'Кац (коэф. 1,6): ' + katz.toFixed(1) + ' ммоль/л\n\n' +
      'Формула Хиллиера считается более точной при выраженной гипергликемии (>22 ммоль/л).';

    setTimeout(function() {
      var icon = document.getElementById(tooltipIdNa);
      if (icon) setupTooltipTrigger(icon, tooltipTextNa);
    }, 50);

    return htmlNa;

  } else {
    if (glucose < 3.3) {
      detailsExtra = '<div style="margin-bottom:6px;">Гипогликемия. Коррекция натрия не требуется, измеренный показатель является истинным.</div>';
    } else {
      detailsExtra = '<div style="margin-bottom:6px;">Глюкоза в норме. Измеренный натрий является истинным.</div>';
    }
    return makeResultCard('Натрий', measuredNa.toFixed(1) + ' ммоль/л', interp, risk, detailsExtra, '');
  }
}

// ===================================================
//  МОДУЛЬ: КФК-МВ
// ===================================================
function renderCKMBIndexModule() {
  var ckTotal = parseNum('ck_total');
  var ckMb    = parseNum('ck_mb');

  if (ckTotal === null || ckMb === null) return null;

  if (ckTotal <= 0 || ckMb < 0) {
    return makeResultCard('Индекс КФК-МВ', 'Ошибка данных',
      'Проверьте корректность значений', 'moderate',
      'КФК общая должна быть больше 0.', '');
  }

  if (ckMb > ckTotal) {
    return makeResultCard('Индекс КФК-МВ', 'Ошибка данных',
      'КФК-МВ не может превышать общую КФК', 'moderate',
      'Проверьте значения.', '');
  }

  var CK_TOTAL_UPPER_LIMIT = 171;
  if (ckTotal <= CK_TOTAL_UPPER_LIMIT) return null;

  var ri           = (ckMb / ckTotal) * 100;
  var riFormatted  = ri.toFixed(1).replace('.', ',');
  var risk         = 'moderate';
  var interp       = 'Пограничный результат';
  var detailsExtra = 'Требуется дополнительная клиническая оценка.';

  if (ri < 3.0) {
    risk         = 'low';
    interp       = 'Кардиальный источник маловероятен';
    detailsExtra = 'Повышение КФК-МВ, скорее всего, связано с внесердечным источником.';
  } else if (ri > 5.0) {
    risk         = 'neutral';
    interp       = 'Кардиальный источник более вероятен';
    detailsExtra = 'Соотношение типично для кардиального происхождения ферментов.';
  }

  var details = 'КФК-МВ ' + ckMb.toFixed(1) + ' / КФК ' + ckTotal.toFixed(1) +
    ' × 100 = ' + riFormatted + '%<br>' + detailsExtra;
  var hint = 'Индекс не входит в современные диагностические критерии ИМ. ' +
    'Интерпретировать с учётом клиники, ЭКГ и тропонина.';

  return makeResultCard('Индекс КФК-МВ', riFormatted + '%', interp, risk, details, hint);
}

// ===================================================
//  ПАНЕЛЬ АНАЛИЗА
// ===================================================
function updateAnalysisPanel() {
  var panel            = document.getElementById('analysisPanel');
  var modulesContainer = document.getElementById('analysisModules');
  if (!panel || !modulesContainer) return;

  var modules = [];

  var ckmbModule = renderCKMBIndexModule();
  if (ckmbModule) modules.push(ckmbModule);

  var naModule = renderSodiumCorrectionModule();
  if (naModule) modules.push(naModule);

  var kModule = renderPotassiumModule();
  if (kModule) modules.push(kModule);

  if (modules.length === 0) {
    modulesContainer.innerHTML = '';
    panel.style.display = 'none';
    return;
  }

  modulesContainer.innerHTML = modules.join('');
  initCustomSelect(document.getElementById('k_vol'));
  panel.style.display = 'block';
}

// ===================================================
//  ЕДИНЫЙ БЛОК ИНИЦИАЛИЗАЦИИ
//  Запускается после загрузки DOM.
//  К этому моменту core.js и scales.js уже загружены,
//  поэтому все функции гарантированно доступны.
// ===================================================
document.addEventListener('DOMContentLoaded', function() {

  // --- Инициализация темы ---
  initTheme();

  // --- Инициализация режима: Стационар / Поликлиника ---
  initModeSwitch();

  // --- Инициализация переключателя пола ---
  initSexToggle();
  initSmokingToggle();

  // --- Тултипы (ⓘ) режима и модуля «СС-риск и липиды» ---
  setupTooltipTrigger(document.getElementById('outpatientHintIcon'),
    'Режим «Поликлиника»: здесь доступны шкалы для планового приёма. Стационарные шкалы (GRACE, CRUSADE, ARC-HBR, Caprini, PRECISE-DAPT, PESI, Wells, Geneva) в этом режиме скрыты и не участвуют в расчётах.');
  setupTooltipTrigger(document.getElementById('score2HintIcon'),
    'Модуль сам выберет нужный вариант SCORE2 по возрасту и диабету и рассчитает ЛПНП по формулам. Если риск и так очевидно очень высокий (инфаркт, инсульт и т.п.) — SCORE2 показываться не будет.');
  setupTooltipTrigger(document.getElementById('ldlHintIcon'),
    'По желанию — сравним лабораторный ЛПНП с расчётом по формулам.');

  // --- Инициализация дисклеймера ---
  checkDisclaimer();

  // --- Связанные пары Wells ↔ Geneva (кровохарканье, признаки ТГВ) ---
  // Отметка или снятие любого чекбокса пары мгновенно применяется к парному
  // (значение изменившегося чекбокса распространяется на второй).
  // Регистрируются ДО initUndoTracking(), чтобы undo-снимки всегда
  // содержали согласованную пару (иначе отмена ломала бы связку).
  var linkedPairs = {
    'wells_hemoptysis': 'geneva_hemoptysis',
    'geneva_hemoptysis': 'wells_hemoptysis',
    'wells_dvt_signs':  'geneva_dvt_signs',
    'geneva_dvt_signs': 'wells_dvt_signs',
    'pesi_cancer':      'cap_cancer',
    'cap_cancer':       'pesi_cancer'
  };
  Object.keys(linkedPairs).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        var tgt = document.getElementById(linkedPairs[id]);
        if (tgt && tgt.checked !== el.checked) tgt.checked = el.checked;
      });
    }
  });

  // --- Снятие красной подсветки при заполнении поля ---
  document.addEventListener('input', function(e) {
    var grp = e.target && e.target.closest ? e.target.closest('.input-group') : null;
    if (grp) grp.classList.remove('field-error');
    applyRangeWarnings();
    updateCalcButtonWarnings(getRangeWarnings());
  });
  document.addEventListener('change', function(e) {
    var grp = e.target && e.target.closest ? e.target.closest('.input-group') : null;
    if (grp) grp.classList.remove('field-error');
  });

  // --- Модуль SCORE2: видимость HbA1c/дебюта СД при изменении диабета ---
  ['cb_dm', 'dm_age20'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', updateFieldVisibility);
  });
  document.addEventListener('click', function(e) {
    var grp = e.target && e.target.closest ? e.target.closest('.input-group') : null;
    if (grp) grp.classList.remove('field-error');
  });

  // --- Инициализация Undo ---
  initUndoTracking();

  // --- Кастомные раскрывающиеся списки (тёмная тема) ---
  initCustomSelect(document.getElementById('grace_killip'));

  // --- Автосохранение: любое изменение поля/галочки/списка → сохранение ---
  document.addEventListener('input', scheduleStateSave);
  document.addEventListener('change', scheduleStateSave);

  // --- Кнопка темы ---
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleDarkMode);

  // --- Кнопка «Сбросить всё» ---
  var resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetAllData);

  // --- Кнопка Undo ---
  var undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.addEventListener('click', performUndo);

  // --- Демо-меню ---
  var demoToggle = document.getElementById('demoToggle');
  if (demoToggle) {
    demoToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDemoMenu();
    });
  }

  var demoItems = document.querySelectorAll('#demoDropdown .demo-item');
  demoItems.forEach(function(item) {
    item.addEventListener('click', function() {
      fillDemo(this.dataset.demo);
      document.getElementById('demoDropdown').style.display = 'none';
    });
  });

  // --- Кнопки групп шкал ---
  document.querySelectorAll('.group-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggleGroup(this.dataset.group);
    });
  });

  // --- Навигационные кнопки ---
  window.addEventListener('scroll', updateNavButtons);
  window.addEventListener('resize', updateNavButtons);
  window.addEventListener('load',   updateNavButtons);

  // --- EMR-парсер ---
  var emrTextarea = document.getElementById('emrPaste');
  var clearBtn    = document.getElementById('clearEmrBtn');
  var statusEl    = document.getElementById('emrStatus');

  if (emrTextarea) {
    emrTextarea.addEventListener('input', function() {
      clearTimeout(window._emrDebounce);
      window._emrDebounce = setTimeout(function() { handleEmrPaste(); }, 400);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (emrTextarea) {
        emrTextarea.value = '';
        statusEl.textContent = '⏳ Вставьте текст из ЭМК...';
        statusEl.style.color = 'var(--muted)';
      }
    });
  }

  // --- ИИ: разбор произвольного текста выписки (прокси Yandex Cloud Function) ---
  var aiBtn = document.getElementById('aiParseBtn');
  if (aiBtn) {
    aiBtn.addEventListener('click', function() { handleAiParse(); });
  }

  // --- Обработчики полей анализа (КФК, Na, K, Mg) ---
  var ckTotal      = document.getElementById('ck_total');
  var ckMb         = document.getElementById('ck_mb');
  var naMeasured   = document.getElementById('na_measured');
  var glucoseInput = document.getElementById('glucose');
  var potassiumInput = document.getElementById('potassium');
  var magnesiumInput = document.getElementById('magnesium');

  if (ckTotal)       ckTotal.addEventListener('input', updateAnalysisPanel);
  if (ckMb)          ckMb.addEventListener('input', updateAnalysisPanel);
  if (naMeasured)    naMeasured.addEventListener('input', updateAnalysisPanel);
  if (glucoseInput)  glucoseInput.addEventListener('input', updateAnalysisPanel);
  if (potassiumInput) potassiumInput.addEventListener('input', updateAnalysisPanel);
  if (magnesiumInput) magnesiumInput.addEventListener('input', updateAnalysisPanel);

  // --- Обработчики общих полей (вызывают autofill + updateAnalysisPanel) ---
  var commonInputIds = ['age', 'sex', 'sbp', 'hb', 'plt', 'weight', 'height', 'creatinine'];
  commonInputIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function() {
        autofill();
        updateAnalysisPanel();
      });
    }
  });

  // --- Обработчики общих чекбоксов и онкологических источников ---
  // (wells_cancer/geneva_cancer/arc_cancer вызывают autofill, чтобы
  // авто-связь онкологии → PESI/Caprini срабатывала сразу при клике;
  // pesi_cancer/cap_cancer — чтобы сразу обновлялись подсказки ⚠️)
  ['cb_hf', 'cb_htn', 'cb_dm', 'cb_stroke', 'cb_tia', 'cb_embolism', 'cb_vte', 'cb_vasc', 'grace_enzymes',
   'wells_cancer', 'geneva_cancer', 'arc_cancer', 'pesi_cancer', 'cap_cancer',
   'pesi_copd', 'cap_copd',
   'wells_dvt_signs', 'geneva_dvt_signs', 'cap_swollen_legs',
   'cap_bedrest72', 'wells_immob',
   'arc_cirrhosis', 'hb_liver'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function() {
        autofill();
        updateAnalysisPanel();
      });
    }
  });

  // --- Очистка начальных значений полей анализа ---
  ['ck_total', 'ck_mb', 'na_measured', 'glucose', 'potassium', 'magnesium'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  // --- Первичная инициализация состояния страницы ---
  syncSexFromHidden();
  autofill();
  updateFieldVisibility();
  updateGroupButtonsUI();
  updateAnalysisPanel();
  updateNavButtons();

  // --- Восстановление сохранённых данных (поля, галочки, списки, шкалы) ---
  restoreAppState();
  applyMode();
  syncCustomSelects();
  updateFieldVisibility();
  updateGroupButtonsUI();
  updateAnalysisPanel();

  // --- Чистое стартовое состояние Undo: сбрасываем стек и таймер,
  //     сохраняем ровно 1 базовое состояние (счётчик отмен = 0) ---
  resetUndoBaseState();

});