(() => {
  'use strict';

  const activities = window.GROM_ACTIVITIES || [];
  const promotionSteps = window.GROM_PROMOTION_STEPS || [];
  const storageKey = 'osn-grom-calculator-v4';
  const warehouseStorageKey = 'osn-grom-warehouse-calculator-v2';
  const promotionReportChannelUrl = 'https://discord.com/channels/1465392165453828138/1465600194199552064';
  const warehouseChannelUrl = 'https://discord.com/channels/1465392165453828138/1465600295424884889';

  const warehouseTiers = [
    {
      id: 'sergeant',
      title: '@||| Сержант полиции',
      ranks: ['Сержант полиции'],
      limits: { weapons: 2, ammo: 360, materials: 1000, armorMedium: 10, armorHeavy: 5, medkits: 10, defibs: 3, painkillers: 8, bodycams: 15 },
      weapons: ['Кольт М16', 'Штейр АУГ-А3', 'FN-Scar']
    },
    {
      id: 'senior-sergeant',
      title: 'Ст. сержант полиции - @☆☆ Прапорщик полиции',
      ranks: ['Ст. сержант полиции', 'Старшина полиции', 'Прапорщик полиции'],
      limits: { weapons: 2, ammo: 360, materials: 1000, armorMedium: 10, armorHeavy: 5, medkits: 10, defibs: 3, painkillers: 8, bodycams: 15 },
      weapons: ['Кольт М16', 'Штейр АУГ-А3', 'FN-Scar', 'САР М249']
    },
    {
      id: 'senior-warrant',
      title: 'Ст. прапорщик полиции - @✮✮ Лейтенант полиции',
      ranks: ['Ст. прапорщик полиции', 'Младший лейтенант полиции', 'Лейтенант полиции'],
      limits: { weapons: 2, ammo: 360, materials: 1000, armorMedium: 10, armorHeavy: 10, medkits: 15, defibs: 4, painkillers: 10, bodycams: 15 },
      weapons: ['Кольт М16', 'Штейр АУГ-А3', 'FN-Scar', 'Кольт 416 "Канада"', 'САР М249']
    },
    {
      id: 'senior-lieutenant',
      title: 'Ст. лейтенант полиции - @✮✮✮✮ Капитан полиции',
      ranks: ['Ст. лейтенант полиции', 'Капитан полиции'],
      limits: { weapons: 3, ammo: 360, materials: 1000, armorMedium: 15, armorHeavy: 15, medkits: 15, defibs: 5, painkillers: 15, bodycams: 15 },
      weapons: ['Любое оружие со склада']
    },
    {
      id: 'major',
      title: '@★ Майор полиции - @⭐ Генерал-майор полиции',
      ranks: ['Майор полиции', 'Подполковник полиции', 'Полковник полиции', 'Генерал-майор полиции'],
      limits: { weapons: 3, ammo: 360, materials: 2000, armorMedium: 20, armorHeavy: 20, medkits: 25, defibs: 15, painkillers: 15, otherMedical: 15, bodycams: 15 },
      weapons: ['Любое оружие со склада (общий лимит 4.20 ПП)']
    }
  ];

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  const categoryMap = {
    gmp: 'ГМП', reports: 'Инструктор', exams: 'Инструктор', weekly_report_check: 'Инструктор',
    uvd_tour: 'Инструктор', internship: 'Инструктор', squad_check: 'Инструктор',
    supply: 'Поставка', raid_participation: 'Налёты', raid_success: 'Налёты',
    flat_robbery: 'Ограбления', kraz_participation: 'КРАЗ', kraz_delivery: 'КРАЗ',
    federal_prison: 'Фед. тюрьма', training: 'Тренировка', reinforced_patrol: 'Патруль',
    duty_unit: 'ДП', arrest: 'Задержание', fine: 'Штраф'
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
        `Канал подачи отчёта: ${promotionReportChannelUrl}`,
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
      state.values = { supply: 2, reinforced_patrol: 1, gmp: 1, training: 2, arrest: 1, fine: 2 };
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
    initWarehouseCalculator();
  });

  function initWarehouseCalculator() {
    const rankSelect = $id('warehouseRank');
    if (!rankSelect) return;

    const elements = {
      rank: rankSelect,
      callsign: $id('warehouseCallsign'),
      serviceId: $id('warehouseServiceId'),
      weapons: $id('warehouseWeapons'),
      ammo: $id('warehouseAmmo'),
      materials: $id('warehouseMaterials'),
      armorType: $id('warehouseArmorType'),
      armor: $id('warehouseArmor'),
      medkits: $id('warehouseMedkits'),
      defibs: $id('warehouseDefibs'),
      painkillers: $id('warehousePainkillers'),
      bodycams: $id('warehouseBodycams'),
      tier: $id('warehouseTier'),
      limits: $id('warehouseLimitList'),
      weaponList: $id('warehouseWeaponList'),
      template: $id('warehouseTemplate'),
      copy: $id('copyWarehouseBtn'),
      reset: $id('resetWarehouseBtn'),
      status: $id('warehouseCopyStatus')
    };

    const countKeys = ['weapons', 'ammo', 'materials', 'armor', 'medkits', 'defibs', 'painkillers', 'bodycams'];
    const state = loadWarehouseState();

    function loadWarehouseState() {
      try {
        const raw = localStorage.getItem(warehouseStorageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }

    function saveWarehouseState() {
      localStorage.setItem(warehouseStorageKey, JSON.stringify(state));
    }

    function findTierByRank(rank) {
      return warehouseTiers.find((tier) => tier.ranks.includes(rank)) || null;
    }

    function getTierByRank(rank) {
      return findTierByRank(rank) || warehouseTiers[0];
    }

    function getSelectedTier() {
      return getTierByRank(elements.rank.value);
    }

    function fillRankOptions() {
      elements.rank.innerHTML = warehouseTiers.map((tier) => {
        const options = tier.ranks.map((rank) => `<option value="${escapeHtml(rank)}">${escapeHtml(rank)}</option>`).join('');
        return `<optgroup label="${escapeHtml(tier.title)}">${options}</optgroup>`;
      }).join('');
    }

    function sanitizeWarehouseCount(value, max) {
      const parsed = Number.parseInt(String(value).replace(/\D/g, ''), 10);
      if (Number.isNaN(parsed) || parsed < 0) return 0;
      return Math.min(parsed, max);
    }

    function getBadgeNumber() {
      const digits = String(elements.serviceId.value || '').replace(/\D/g, '');
      return digits.length >= 2 ? digits.slice(-2) : 'NN';
    }

    function getArmorType() {
      return elements.armorType.value === 'heavy' ? 'heavy' : 'medium';
    }

    function getArmorTypeLabel() {
      return getArmorType() === 'heavy' ? 'тяжёлые' : 'средние';
    }

    function getLimit(tier, key) {
      if (key === 'armor') return getArmorType() === 'heavy' ? tier.limits.armorHeavy : tier.limits.armorMedium;
      return tier.limits[key] ?? 0;
    }

    function getCounts() {
      const tier = getSelectedTier();
      const counts = {};
      countKeys.forEach((key) => {
        counts[key] = sanitizeWarehouseCount(elements[key].value, getLimit(tier, key));
      });

      if (tier.limits.otherMedical && counts.defibs + counts.painkillers > tier.limits.otherMedical) {
        counts.painkillers = Math.max(0, tier.limits.otherMedical - counts.defibs);
      }

      return counts;
    }

    function writeCounts(counts) {
      const tier = getSelectedTier();
      countKeys.forEach((key) => {
        elements[key].max = getLimit(tier, key);
        elements[key].value = counts[key] || '';
      });
    }

    function fillMaximums() {
      const tier = getSelectedTier();
      const counts = { ...tier.limits, armor: getLimit(tier, 'armor') };
      if (tier.limits.otherMedical) {
        counts.defibs = 5;
        counts.painkillers = Math.max(0, tier.limits.otherMedical - counts.defibs);
      }
      writeCounts(counts);
    }

    function renderLimits(tier) {
      const armorText = tier.limits.armorMedium === tier.limits.armorHeavy
        ? `${tier.limits.armorMedium} средних или тяжёлых`
        : `${tier.limits.armorMedium} средних / ${tier.limits.armorHeavy} тяжёлых`;
      const limitRows = [
        ['Оружие', `${tier.limits.weapons} ед.`],
        ['Патроны', `${tier.limits.ammo} ед.`],
        ['Материалы', `${numberFormat(tier.limits.materials)} ед.`],
        ['Бронежилеты', armorText],
        ['Аптечки', `${tier.limits.medkits} ед.`],
        tier.limits.otherMedical
          ? ['Дефибриллятор + обезболивающее', `${tier.limits.otherMedical} предметов суммарно`]
          : ['Дефибрилляторы / обезболивающее', `${tier.limits.defibs} / ${tier.limits.painkillers} ед.`],
        ['Бодикамеры', `${tier.limits.bodycams} ед.`]
      ];

      elements.tier.textContent = tier.title;
      elements.limits.innerHTML = limitRows.map(([label, value]) => `
        <div class="warehouse-limit-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join('');
      elements.weaponList.innerHTML = tier.weapons.map((weapon) => `<span>${escapeHtml(weapon)}</span>`).join('');
    }

    function buildWarehouseMessage() {
      const tier = getSelectedTier();
      const counts = getCounts();
      const callsign = elements.callsign.value.trim() || '[позывной]';
      const serviceId = elements.serviceId.value.trim() || '[статический ID]';
      const badgeNumber = getBadgeNumber();

      const medicalLine = tier.limits.otherMedical
        ? `Дефибриллятор / обезболивающее: ${counts.defibs + counts.painkillers} предметов суммарно (${counts.defibs} дефиб., ${counts.painkillers} обезб.)`
        : `Дефибриллятор: ${counts.defibs} ед.\nОбезболивающее: ${counts.painkillers} ед.`;

      return [
        'Запрос склада ОСН «ГРОМ»',
        '',
        `Канал запроса: ${warehouseChannelUrl}`,
        `Звание: ${elements.rank.value}`,
        `Позывной: ${callsign}`,
        `Статический ID: ${serviceId}`,
        `Жетон: /do На бронежилете висит нагрудный знак : «УВД | ОСН ГРОМ | ${callsign} | ${badgeNumber}-й».`,
        '',
        `Лимит: ${tier.title}`,
        `Оружие: ${counts.weapons} ед. из списка: ${tier.weapons.join(', ')}`,
        `Патроны: ${counts.ammo} ед.`,
        `Материалы: ${counts.materials} ед.`,
        `Экипировка (бронежилеты): ${counts.armor} ед. (${getArmorTypeLabel()})`,
        `Медикаменты (аптечки): ${counts.medkits} ед.`,
        medicalLine,
        `Бодикамеры: ${counts.bodycams} ед.`,
        '',
        'Склад беру не чаще 1 раза в 4 часа.'
      ].join('\n');
    }

    function updateWarehouse() {
      const tier = getSelectedTier();
      renderLimits(tier);
      const counts = getCounts();
      writeCounts(counts);

      state.rank = elements.rank.value;
      state.callsign = elements.callsign.value;
      state.serviceId = elements.serviceId.value;
      state.armorType = getArmorType();
      state.counts = counts;
      saveWarehouseState();

      elements.template.value = buildWarehouseMessage();
    }

    function restoreWarehouseState() {
      fillRankOptions();
      elements.rank.value = state.rank && findTierByRank(state.rank) ? state.rank : warehouseTiers[0].ranks[0];
      elements.callsign.value = state.callsign || '';
      elements.serviceId.value = state.serviceId || '';
      elements.armorType.value = state.armorType === 'heavy' ? 'heavy' : 'medium';
      const tier = getSelectedTier();
      const counts = state.counts || { ...tier.limits, armor: getLimit(tier, 'armor') };
      writeCounts(counts);
    }

    async function copyWarehouseText() {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(elements.template.value);
        } else {
          const temp = document.createElement('textarea');
          temp.value = elements.template.value;
          temp.setAttribute('readonly', '');
          temp.style.position = 'fixed';
          temp.style.top = '-1000px';
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          temp.remove();
        }
        elements.status.textContent = 'Запрос склада скопирован.';
      } catch {
        elements.status.textContent = 'Не вышло скопировать автоматически. Выделите текст вручную.';
      }
      window.clearTimeout(copyWarehouseText.timeoutId);
      copyWarehouseText.timeoutId = window.setTimeout(() => { elements.status.textContent = ''; }, 2800);
    }

    restoreWarehouseState();
    updateWarehouse();
    elements.rank.addEventListener('change', () => {
      fillMaximums();
      updateWarehouse();
    });
    elements.armorType.addEventListener('change', updateWarehouse);
    [elements.callsign, elements.serviceId, ...countKeys.map((key) => elements[key])].forEach((element) => {
      element.addEventListener('input', updateWarehouse);
      element.addEventListener('blur', updateWarehouse);
    });
    elements.copy.addEventListener('click', copyWarehouseText);
    elements.reset.addEventListener('click', () => {
      localStorage.removeItem(warehouseStorageKey);
      Object.keys(state).forEach((key) => { delete state[key]; });
      restoreWarehouseState();
      fillMaximums();
      updateWarehouse();
      elements.status.textContent = 'Калькулятор склада очищен.';
    });
  }
})();
