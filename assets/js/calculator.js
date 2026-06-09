(() => {
  'use strict';

  const activities = window.GROM_ACTIVITIES || [];
  const promotionSteps = window.GROM_PROMOTION_STEPS || [];
  const storageKey = 'osn-grom-calculator-v4';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  const categoryMap = {
    gmp: 'ГМП', reports: 'Инструктор', exams: 'Инструктор', supply: 'Поставка',
    raid_participation: 'Налёты', raid_success: 'Налёты', robbery_success: 'Ограбления',
    flat_robbery: 'Ограбления', kraz_participation: 'КРАЗ', kraz_success: 'КРАЗ',
    ik7: 'ИК-7', patrol: 'Патруль', training: 'Тренировка', arrest: 'Арест', fine: 'Штраф'
  };

  const $id = (id) => document.getElementById(id);

  function numberFormat(value) {
    return new Intl.NumberFormat('ru-RU').format(value);
  }

  function sanitizeCount(value) {
    const parsed = Number.parseInt(String(value).replace(/\D/g, ''), 10);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(parsed, 9999);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value ?? '').toLowerCase().trim();
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/[\\"']/g, '\\$&');
  }

  function loadValues() {
    const keys = ['osn-grom-calculator-v4', 'osn-grom-calculator-v3'];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch {}
    }
    return {};
  }

  function saveValues(values) {
    localStorage.setItem(storageKey, JSON.stringify(values));
  }

  function getRequirementText(requirement) {
    return typeof requirement === 'string' ? requirement : requirement.text;
  }

  function renderRequirement(requirement) {
    if (typeof requirement === 'string') return escapeHtml(requirement);
    return `<a href="${escapeHtml(requirement.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(requirement.text)}</a>`;
  }

  function getPointSteps() {
    return promotionSteps
      .filter((step) => typeof step.points === 'number')
      .sort((a, b) => a.points - b.points);
  }

  function getPromotionInfo(total) {
    const steps = getPointSteps();
    const reached = steps.filter((step) => total >= step.points).at(-1) ?? null;
    const next = steps.find((step) => total < step.points) ?? null;

    if (!next) {
      const top = steps.at(-1);
      return {
        reached,
        next: null,
        progress: 100,
        status: `Балльные пороги закрыты до ступени «${top.title}». Дополнительные условия всё равно нужно приложить.`
      };
    }

    const previousMin = reached?.points ?? 0;
    const range = Math.max(next.points - previousMin, 1);
    const progress = Math.max(0, Math.min(100, ((total - previousMin) / range) * 100));
    const left = next.points - total;

    const status = reached
      ? `По баллам закрыто: «${reached.title}». До «${next.title}» осталось ${numberFormat(left)} баллов.`
      : `До первого балльного порога «${next.title}» осталось ${numberFormat(left)} баллов.`;

    return { reached, next, progress, status };
  }

  function renderPromotionCards() {
    const container = $id('promotionCards');
    if (!container) return;

    container.innerHTML = promotionSteps.map((step, index) => {
      const points = typeof step.points === 'number' ? `${numberFormat(step.points)} баллов` : 'без балльного порога';
      const requirements = step.requirements.map((item) => `<li>${renderRequirement(item)}</li>`).join('');
      return `
        <article class="rank-card reveal">
          <div class="rank-card__top">
            <div>
              <span class="tag">ступень ${index + 1}</span>
              <h3>${escapeHtml(step.title)}</h3>
            </div>
            <strong class="rank-card__points">${escapeHtml(points)}</strong>
          </div>
          <ul>${requirements}</ul>
        </article>
      `;
    }).join('');
  }

  function initCalculator() {
    const list = $id('activityList');
    if (!list) return;

    const elements = {
      list,
      search: $id('activitySearch'),
      tableTotal: $id('tableTotal'),
      totalPoints: $id('totalPoints'),
      totalActions: $id('totalActions'),
      activeRows: $id('activeRows'),
      promotionStatus: $id('promotionStatus'),
      progressBar: $id('progressBar'),
      nextThresholdText: $id('nextThresholdText'),
      filledActivities: $id('filledActivities'),
      resetBtn: $id('resetBtn'),
      fillExampleBtn: $id('fillExampleBtn'),
      copyReportBtn: $id('copyReportBtn'),
      copyTemplateBtn: $id('copyTemplateBtn'),
      copyStatus: $id('copyStatus'),
      reportTemplate: $id('reportTemplate')
    };

    const state = {
      values: loadValues(),
      query: ''
    };

    function activityMatches(activity) {
      if (!state.query) return true;
      const haystack = [activity.title, activity.proof, categoryMap[activity.id]].map(normalize).join(' ');
      return haystack.includes(state.query);
    }

    function getRowsData() {
      return activities.map((activity) => {
        const count = sanitizeCount(state.values[activity.id] ?? 0);
        return { ...activity, category: categoryMap[activity.id] || 'Активность', count, total: count * activity.points };
      });
    }

    function renderActivities() {
      const visible = activities.filter(activityMatches);

      if (!visible.length) {
        elements.list.innerHTML = '<div class="empty-state">По такому поиску активностей нет.</div>';
        return;
      }

      elements.list.innerHTML = visible.map((activity, index) => {
        const savedValue = sanitizeCount(state.values[activity.id] ?? 0);
        const category = categoryMap[activity.id] || 'Активность';
        return `
          <article class="activity-card activity-card--v3" data-id="${escapeHtml(activity.id)}">
            <div class="activity-card__num">${String(index + 1).padStart(2, '0')}</div>
            <div class="activity-card__main">
              <div class="activity-card__meta">
                <span>${escapeHtml(category)}</span>
                <strong>${numberFormat(activity.points)} баллов за 1</strong>
              </div>
              <h3>${escapeHtml(activity.title)}</h3>
              <p class="activity-card__proof"><b>Док-во:</b> ${escapeHtml(activity.proof)}</p>
            </div>
            <div class="counter" aria-label="Количество активности">
              <button class="counter__btn" type="button" data-counter="-1" data-id="${escapeHtml(activity.id)}" aria-label="Уменьшить количество">−</button>
              <input
                type="number"
                min="0"
                max="9999"
                step="1"
                inputmode="numeric"
                value="${savedValue || ''}"
                placeholder="0"
                aria-label="Количество: ${escapeHtml(activity.title)}"
                data-id="${escapeHtml(activity.id)}">
              <button class="counter__btn" type="button" data-counter="1" data-id="${escapeHtml(activity.id)}" aria-label="Увеличить количество">+</button>
            </div>
            <div class="activity-card__total">
              <span>итого</span>
              <strong data-row-total="${escapeHtml(activity.id)}">0</strong>
            </div>
          </article>
        `;
      }).join('');

      $$('input[data-id]', elements.list).forEach((input) => {
        input.addEventListener('input', handleInput);
        input.addEventListener('blur', () => {
          const value = sanitizeCount(input.value);
          input.value = value || '';
        });
      });
    }

    function setValue(id, value) {
      const safeValue = sanitizeCount(value);
      if (safeValue > 0) state.values[id] = safeValue;
      else delete state.values[id];
      saveValues(state.values);

      const input = $(`input[data-id="${cssEscape(id)}"]`, elements.list);
      if (input) input.value = safeValue || '';
      updateAll();
    }

    function handleInput(event) {
      const input = event.currentTarget;
      setValue(input.dataset.id, input.value);
    }

    function handleCounterClick(event) {
      const button = event.target.closest('[data-counter]');
      if (!button) return;
      const id = button.dataset.id;
      const delta = Number(button.dataset.counter);
      const current = sanitizeCount(state.values[id] ?? 0);
      setValue(id, Math.max(0, current + delta));
    }

    function buildReport(rows, totalPoints, promotionInfo) {
      const filledRows = rows.filter((row) => row.count > 0);
      const activityText = filledRows.length
        ? filledRows.map((row) => `- ${row.title}: ${row.count} × ${row.points} = ${row.total} баллов | док-во: ${row.proof}`).join('\n')
        : '- Активности пока не внесены';

      const statusText = promotionInfo.reached ? promotionInfo.reached.title : 'Балльный порог пока не достигнут';
      const targetStep = promotionInfo.next ?? promotionInfo.reached;
      const requirementsText = targetStep
        ? targetStep.requirements.map((item) => `- ${getRequirementText(item)}`).join('\n')
        : '- Все балльные пороги закрыты, требования сверить с командованием';

      return [
        'Рапорт на повышение в ОСН «Гром»',
        '',
        'Я, [Фамилия Имя Отчество], [звание/должность], прошу рассмотреть рапорт на повышение.',
        '',
        'Подразделение: ОСН «Гром»',
        `Итоговая сумма баллов: ${totalPoints}`,
        `Статус по балльной сетке: ${statusText}`,
        '',
        'Активности:',
        activityText,
        '',
        targetStep ? `Дополнительные условия для ступени «${targetStep.title}»:` : 'Дополнительные условия:',
        requirementsText,
        '',
        'Доказательства:',
        '- [ссылка/скриншот/видео]',
        '- [ссылка/скриншот/видео]',
        '',
        'С уставом, правилами сервера, внутренними правилами ОСН и актуальной законкой ознакомлен.',
        'Дата: [дд.мм.гггг]',
        'Подпись: [ФИО]'
      ].join('\n');
    }

    function renderFilledActivities(rows) {
      if (!elements.filledActivities) return;
      const filled = rows.filter((row) => row.count > 0);
      if (!filled.length) {
        elements.filledActivities.innerHTML = '<div class="empty-state">Пока ничего не внесено.</div>';
        return;
      }

      elements.filledActivities.innerHTML = filled.map((row) => `
        <div class="selected-activity">
          <span>${escapeHtml(row.title)}</span>
          <strong>${row.count} × ${row.points} = ${numberFormat(row.total)}</strong>
        </div>
      `).join('');
    }

    function updateAll() {
      const rows = getRowsData();
      const totalPoints = rows.reduce((sum, row) => sum + row.total, 0);
      const totalActions = rows.reduce((sum, row) => sum + row.count, 0);
      const activeRows = rows.filter((row) => row.count > 0).length;
      const promotionInfo = getPromotionInfo(totalPoints);

      rows.forEach((row) => {
        const totalCell = $(`[data-row-total="${cssEscape(row.id)}"]`);
        if (totalCell) totalCell.textContent = numberFormat(row.total);
      });

      if (elements.tableTotal) elements.tableTotal.textContent = numberFormat(totalPoints);
      if (elements.totalPoints) elements.totalPoints.textContent = numberFormat(totalPoints);
      if (elements.totalActions) elements.totalActions.textContent = numberFormat(totalActions);
      if (elements.activeRows) elements.activeRows.textContent = numberFormat(activeRows);
      if (elements.promotionStatus) elements.promotionStatus.textContent = promotionInfo.status;
      if (elements.progressBar) elements.progressBar.style.width = `${promotionInfo.progress}%`;
      if (elements.nextThresholdText) {
        elements.nextThresholdText.textContent = promotionInfo.next
          ? `Следующий порог: ${promotionInfo.next.title} — ${numberFormat(promotionInfo.next.points)} баллов`
          : 'Следующий порог: балльная сетка закрыта';
      }
      renderFilledActivities(rows);
      if (elements.reportTemplate) elements.reportTemplate.value = buildReport(rows, totalPoints, promotionInfo);
    }

    async function copyText(text, successMessage) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const temp = document.createElement('textarea');
          temp.value = text;
          temp.setAttribute('readonly', '');
          temp.style.position = 'fixed';
          temp.style.top = '-1000px';
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
        }
        showCopyStatus(successMessage);
      } catch {
        showCopyStatus('Не вышло скопировать автоматически. Выделите текст вручную.');
      }
    }

    function showCopyStatus(message) {
      if (!elements.copyStatus) return;
      elements.copyStatus.textContent = message;
      window.clearTimeout(showCopyStatus.timeoutId);
      showCopyStatus.timeoutId = window.setTimeout(() => {
        elements.copyStatus.textContent = '';
      }, 2800);
    }

    function resetCalculator() {
      state.values = {};
      saveValues(state.values);
      $$('input[data-id]', elements.list).forEach((input) => { input.value = ''; });
      updateAll();
      showCopyStatus('Калькулятор очищен.');
    }

    function fillExample() {
      state.values = { supply: 2, patrol: 1, gmp: 1, training: 2, arrest: 1, fine: 2 };
      saveValues(state.values);
      renderActivities();
      updateAll();
      showCopyStatus('Пример внесён. Можно менять цифры под свой отчёт.');
    }

    function updateSearch() {
      state.query = normalize(elements.search?.value);
      renderActivities();
      updateAll();
    }

    elements.list.addEventListener('click', handleCounterClick);
    if (elements.search) elements.search.addEventListener('input', updateSearch);
    if (elements.resetBtn) elements.resetBtn.addEventListener('click', resetCalculator);
    if (elements.fillExampleBtn) elements.fillExampleBtn.addEventListener('click', fillExample);
    if (elements.copyReportBtn) elements.copyReportBtn.addEventListener('click', () => copyText(elements.reportTemplate.value, 'Отчёт скопирован.'));
    if (elements.copyTemplateBtn) elements.copyTemplateBtn.addEventListener('click', () => copyText(elements.reportTemplate.value, 'Шаблон рапорта скопирован.'));

    renderActivities();
    updateAll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderPromotionCards();
    initCalculator();
  });
})();
