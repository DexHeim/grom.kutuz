(() => {
  'use strict';

  const activities = [
    {
      id: 'gmp',
      title: 'Участие в ГМП (3+ фракций, похищения, теракты и т.д.)',
      points: 100,
      proof: 'Скриншот начала, середины и конца'
    },
    {
      id: 'reports',
      title: 'Проверка рапортов (для инструкторов)',
      points: 15,
      proof: 'Ссылка на проверенный рапорт с галочкой'
    },
    {
      id: 'exams',
      title: 'Проведение экзаменов (для инструкторов)',
      points: 15,
      proof: 'Скриншот или ссылка на проведённый экзамен'
    },
    {
      id: 'supply',
      title: 'Участие в поставочных мероприятиях',
      points: 50,
      proof: 'Скриншот зоны с линией или плашка о вознаграждении на финальной поставке'
    },
    {
      id: 'raid_participation',
      title: 'Участие в отбитии налёта / ограбления',
      points: 30,
      proof: 'Скриншот зоны с линией'
    },
    {
      id: 'raid_success',
      title: 'Успешное отбитие налёта',
      points: 70,
      proof: 'Скриншот с плашкой об успешном отбитии'
    },
    {
      id: 'robbery_success',
      title: 'Успешное отбитие ограбления',
      points: 100,
      proof: 'Скриншот завезённой матовозки'
    },
    {
      id: 'flat_robbery',
      title: 'Участие в успешном предотвращении ограбления квартиры',
      points: 15,
      proof: 'Скриншот с плашкой о вознаграждении'
    },
    {
      id: 'kraz_participation',
      title: 'Участие в отбитии КРАЗа',
      points: 60,
      proof: 'Скриншот на фоне КРАЗа'
    },
    {
      id: 'kraz_success',
      title: 'Успешное отбитие КРАЗа',
      points: 90,
      proof: 'Скриншот КРАЗа около здания государственного органа, в который везётся КРАЗ'
    },
    {
      id: 'ik7',
      title: 'Участие в отбитии ИК-7',
      points: 100,
      proof: 'Скриншот участия в отбитии ИК-7'
    },
    {
      id: 'patrol',
      title: 'Патруль (30 минут)',
      points: 50,
      proof: 'Скриншот начала патруля, каждые 10 минут и окончания патруля'
    },
    {
      id: 'training',
      title: 'Участие в тренировке',
      points: 30,
      proof: 'Скриншот начала и окончания тренировки'
    },
    {
      id: 'arrest',
      title: 'Арест',
      points: 40,
      proof: 'Скриншот отправки в тюрьму'
    },
    {
      id: 'fine',
      title: 'Штраф',
      points: 10,
      proof: 'Скриншот выписки штрафа'
    }
  ];

  const promotionSteps = [
    {
      title: 'Сержант → Ст. Сержант',
      points: null,
      requirements: [
        '2 гос.поставки',
        'Запрос роли в моссетях',
        'Прикрепить личное дело',
        'Запросить позывной'
      ]
    },
    {
      title: 'Ст. Сержант → Старшина',
      points: 350,
      requirements: ['1 патруль по городу (30 минут)']
    },
    {
      title: 'Старшина → Прапорщик',
      points: 450,
      requirements: [
        '2 патруля по городу (30 минут)',
        { text: 'Сдать практику задержания у Инструктора или СС ОСН «Гром»', href: 'https://discord.com/channels/1465392165453828138/1495112904511459458' }
      ]
    },
    {
      title: 'Прапорщик → Ст. Прапорщик',
      points: 650,
      requirements: ['5 гос.поставок', '2 патруля по городу (30 минут)']
    },
    {
      title: 'Ст. Прапорщик → Мл. Лейтенант',
      points: 800,
      requirements: [
        '2 налёта',
        '10 гос.поставок',
        '2 патруля по городу (30 минут)',
        { text: 'Приложить военный билет', href: 'https://discord.com/channels/1465392165453828138/1473805325374197860' }
      ]
    },
    {
      title: 'Мл. Лейтенант → Лейтенант',
      points: 1000,
      requirements: ['1 арест', '2 штрафа', '10 гос.поставок', '2 патруля по городу (30 минут)']
    },
    {
      title: 'Лейтенант → Ст. Лейтенант',
      points: 1200,
      requirements: ['3 ареста', '15 гос.поставок', '4 штрафа', '2 патруля по городу (30 минут)']
    },
    {
      title: 'Ст. Лейтенант → Капитан',
      points: 1500,
      requirements: ['20 гос.поставок', '3 патруля по городу (30 минут)']
    }
  ];

  const storageKey = 'osn-grom-calculator-v2';
  const themeKey = 'osn-grom-theme';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  const elements = {
    activitiesBody: $('#activitiesBody'),
    promotionTableBody: $('#promotionTableBody'),
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
    reportTemplate: $('#reportTemplate'),
    themeToggle: $('#themeToggle')
  };

  const state = {
    values: loadValues()
  };

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

  function saveValues() {
    localStorage.setItem(storageKey, JSON.stringify(state.values));
  }

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

  function renderPromotionTable() {
    elements.promotionTableBody.innerHTML = promotionSteps.map((step) => {
      const points = typeof step.points === 'number' ? numberFormat(step.points) : 'без балльного порога';
      const requirements = step.requirements.map((item) => `<li>${renderRequirement(item)}</li>`).join('');
      return `
        <tr>
          <td><strong>${escapeHtml(step.title)}</strong></td>
          <td>${points}</td>
          <td><ul>${requirements}</ul></td>
        </tr>
      `;
    }).join('');
  }

  function renderActivities() {
    elements.activitiesBody.innerHTML = activities.map((activity) => {
      const savedValue = sanitizeCount(state.values[activity.id] ?? 0);
      return `
        <tr data-id="${escapeHtml(activity.id)}">
          <td>${escapeHtml(activity.title)}</td>
          <td>${escapeHtml(activity.proof)}</td>
          <td class="points">${numberFormat(activity.points)}</td>
          <td>
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
          </td>
          <td class="row-total" data-row-total="${escapeHtml(activity.id)}">0</td>
        </tr>
      `;
    }).join('');

    $$('#activitiesBody input').forEach((input) => {
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

    if (value > 0) {
      state.values[id] = value;
    } else {
      delete state.values[id];
    }

    saveValues();
    updateAll();
  }

  function getRowsData() {
    return activities.map((activity) => {
      const count = sanitizeCount(state.values[activity.id] ?? 0);
      return { ...activity, count, total: count * activity.points };
    });
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

    elements.tableTotal.textContent = numberFormat(totalPoints);
    elements.totalPoints.textContent = numberFormat(totalPoints);
    elements.totalActions.textContent = numberFormat(totalActions);
    elements.activeRows.textContent = numberFormat(activeRows);
    elements.promotionStatus.textContent = promotionInfo.status;
    elements.progressBar.style.width = `${promotionInfo.progress}%`;
    elements.nextThresholdText.textContent = promotionInfo.next
      ? `Следующий порог: ${promotionInfo.next.title} — ${numberFormat(promotionInfo.next.points)} баллов`
      : 'Следующий порог: балльная сетка закрыта';

    elements.reportTemplate.value = buildReport(rows, totalPoints, promotionInfo);
  }

  function buildReport(rows, totalPoints, promotionInfo) {
    const filledRows = rows.filter((row) => row.count > 0);
    const activityText = filledRows.length
      ? filledRows.map((row) => `- ${row.title}: ${row.count} × ${row.points} = ${row.total} баллов | док-во: ${row.proof}`).join('\n')
      : '- Активности пока не внесены';

    const statusText = promotionInfo.reached
      ? promotionInfo.reached.title
      : 'Балльный порог пока не достигнут';

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
    elements.copyStatus.textContent = message;
    window.clearTimeout(showCopyStatus.timeoutId);
    showCopyStatus.timeoutId = window.setTimeout(() => {
      elements.copyStatus.textContent = '';
    }, 2800);
  }

  function resetCalculator() {
    state.values = {};
    saveValues();
    $$('#activitiesBody input').forEach((input) => {
      input.value = '';
    });
    updateAll();
    showCopyStatus('Калькулятор очищен.');
  }

  function fillExample() {
    const example = {
      supply: 2,
      patrol: 1,
      gmp: 1,
      training: 2,
      arrest: 1,
      fine: 2
    };

    state.values = example;
    saveValues();

    $$('#activitiesBody input').forEach((input) => {
      const value = state.values[input.dataset.id] ?? 0;
      input.value = value || '';
    });

    updateAll();
    showCopyStatus('Пример внесён. Можно менять цифры под свой отчёт.');
  }

  function initTheme() {
    const saved = localStorage.getItem(themeKey);
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    const theme = saved || (prefersLight ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;

    elements.themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(themeKey, nextTheme);
    });
  }

  function bindActions() {
    elements.resetBtn.addEventListener('click', resetCalculator);
    elements.fillExampleBtn.addEventListener('click', fillExample);
    elements.copyReportBtn.addEventListener('click', () => copyText(elements.reportTemplate.value, 'Отчёт скопирован.'));
    elements.copyTemplateBtn.addEventListener('click', () => copyText(elements.reportTemplate.value, 'Шаблон рапорта скопирован.'));
  }

  function init() {
    initTheme();
    renderPromotionTable();
    renderActivities();
    bindActions();
    updateAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
