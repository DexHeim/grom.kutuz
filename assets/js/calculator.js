(() => {
  'use strict';

  const activities = window.GROM_ACTIVITIES || [];
  const promotionSteps = window.GROM_PROMOTION_STEPS || [];
  const storageKey = 'osn-grom-calculator-v3';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  function numberFormat(value) {
    return new Intl.NumberFormat('ru-RU').format(value);
  }

  function sanitizeCount(value) {
    const parsed = Number.parseInt(String(value).replace(/\D/g, ''), 10);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(parsed, 9999);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadValues() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
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
    const container = $('#promotionCards');
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
    const list = $('#activityList');
    if (!list) return;

    const elements = {
      list,
      tableTotal: $('#tableTotal'),
      totalPoints: $('#totalPoints'),
      totalActions: $('#totalActions'),
      activeRows: $('#activeRows'),
      promotionStatus: $('#promotionStatus'),
      progressBar: $('#progressBar'),
      nextThresholdText: $('#nextThresholdText'),
      resetBtn: $('#resetBtn'),
      fillExampleBtn: $('#fillExampleBtn'),
      copyReportBtn: $('#copyReportBtn'),
      copyTemplateBtn: $('#copyTemplateBtn'),
      copyStatus: $('#copyStatus'),
      reportTemplate: $('#reportTemplate')
    };

    const state = { values: loadValues() };

    function getRowsData() {
      return activities.map((activity) => {
        const count = sanitizeCount(state.values[activity.id] ?? 0);
        return { ...activity, count, total: count * activity.points };
      });
    }

    function renderActivities() {
      elements.list.innerHTML = activities.map((activity) => {
        const savedValue = sanitizeCount(state.values[activity.id] ?? 0);
        return `
          <article class="activity-card" data-id="${escapeHtml(activity.id)}">
            <div class="activity-card__main">
              <h3>${escapeHtml(activity.title)}</h3>
              <p class="activity-card__proof">${escapeHtml(activity.proof)}</p>
            </div>
            <div class="activity-card__score">
              <span>баллов за 1</span>
              <strong>${numberFormat(activity.points)}</strong>
            </div>
            <label class="activity-card__input">
              <span class="mini-label">кол-во</span>
              <input
                type="number"
                min="0"
                max="9999"
                step="1"
                inputmode="numeric"
                value="${savedValue || ''}"
                aria-label="Количество: ${escapeHtml(activity.title)}"
                data-points="${activity.points}"
                data-id="${escapeHtml(activity.id)}">
            </label>
            <div class="activity-card__total">
              <span>итого</span>
              <strong data-row-total="${escapeHtml(activity.id)}">0</strong>
            </div>
          </article>
        `;
      }).join('');

      $$('#activityList input').forEach((input) => {
        input.addEventListener('input', handleInput);
        input.addEventListener('blur', () => {
          const value = sanitizeCount(input.value);
          input.value = value || '';
        });
      });
    }

    function handleInput(event) {
      const input = event.currentTarget;
      const id = input.dataset.id;
      const value = sanitizeCount(input.value);

      if (value > 0) state.values[id] = value;
      else delete state.values[id];

      saveValues(state.values);
      updateAll();
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

    function updateAll() {
      const rows = getRowsData();
      const totalPoints = rows.reduce((sum, row) => sum + row.total, 0);
      const totalActions = rows.reduce((sum, row) => sum + row.count, 0);
      const activeRows = rows.filter((row) => row.count > 0).length;
      const promotionInfo = getPromotionInfo(totalPoints);

      rows.forEach((row) => {
        const totalCell = $(`[data-row-total="${row.id}"]`);
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
      $$('#activityList input').forEach((input) => { input.value = ''; });
      updateAll();
      showCopyStatus('Калькулятор очищен.');
    }

    function fillExample() {
      state.values = { supply: 2, patrol: 1, gmp: 1, training: 2, arrest: 1, fine: 2 };
      saveValues(state.values);
      $$('#activityList input').forEach((input) => {
        const value = state.values[input.dataset.id] ?? 0;
        input.value = value || '';
      });
      updateAll();
      showCopyStatus('Пример внесён. Можно менять цифры под свой отчёт.');
    }

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
