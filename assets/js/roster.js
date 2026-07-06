(() => {
  'use strict';

  const SHEET_ID = '1e4rEXR7FlKvlLoiWK41Aer0tLpqLuhXVbyrpipALhBQ';
  const SHEET_GID = '0';
  const LOCAL_ROSTER_URL = 'data/roster.json';

  const GROUP_ORDER = [
    'Командование',
    'Инструкторский состав',
    'Оперативный состав',
    'Стажёрский состав',
    'Вакантно',
    'Кадровый резерв'
  ];

  const STATUS_LABELS = {
    active: 'Активен',
    trainee: 'Стажёр',
    reserve: 'Резерв',
    leave: 'Отпуск',
    vacant: 'Вакантно'
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clean(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase();
  }

  function statusText(status) {
    return STATUS_LABELS[status] || status || STATUS_LABELS.active;
  }

  const URL_PATTERN = /https?:\/\/\S+/gi;

  function extractProfileLink(member) {
    const fields = ['name', 'rank', 'position', 'callsign', 'serviceId', 'badge', 'note'];
    let profileUrl = clean(member.profileUrl);

    fields.forEach((field) => {
      const value = String(member[field] ?? '');
      if (!value) return;
      const stripped = value.replace(URL_PATTERN, (url) => {
        if (!profileUrl) profileUrl = url.replace(/[).,;>»]+$/, '');
        return ' ';
      });
      member[field] = stripped
        .split('·')
        .map((part) => clean(part))
        .filter(Boolean)
        .join(' · ');
    });

    if (profileUrl) member.profileUrl = profileUrl;
    return member;
  }

  function sanitizeRosterData(data) {
    (data.groups || []).forEach((group) => {
      (group.members || []).forEach(extractProfileLink);
    });
    return data;
  }

  function statusClass(status) {
    const classes = ['status-badge'];
    if (status && status !== 'active') classes.push(`status-badge--${status}`);
    return classes.join(' ');
  }

  function getAllMembers(data) {
    return (data.groups || []).flatMap((group) =>
      (group.members || []).map((member) => ({ ...member, groupTitle: group.title || 'Группа' }))
    );
  }

  function initials(name, callsign, status) {
    if (status === 'vacant') return '—';
    const source = clean(name || callsign || 'Г').replace(/\[[^\]]+]/g, '');
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Г';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function memberMatches(member, query, status) {
    const haystack = [
      member.name,
      member.rank,
      member.position,
      member.callsign,
      member.serviceId,
      member.note,
      member.badge,
      member.groupTitle,
      statusText(member.status)
    ].map(normalize).join(' ');
    const queryOk = !query || haystack.includes(query);
    const statusOk = !status || status === 'all' || (member.status || 'active') === status;
    return queryOk && statusOk;
  }

  function groupMatches(group, selectedGroup) {
    return !selectedGroup || selectedGroup === 'all' || normalize(group.title) === selectedGroup;
  }

  function updateStats(data) {
    const all = getAllMembers(data);
    const active = all.filter((member) => (member.status || 'active') === 'active').length;
    const trainee = all.filter((member) => member.status === 'trainee').length;
    const reserve = all.filter((member) => ['reserve', 'leave', 'vacant'].includes(member.status)).length;

    const values = {
      rosterTotal: all.length,
      rosterActive: active,
      rosterTrainee: trainee,
      rosterReserve: reserve,
      rosterUpdated: data.updated || 'Google Sheets'
    };

    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
  }

  function fillGroupFilter(data) {
    const select = $('#rosterGroup');
    if (!select) return;
    const current = select.value || 'all';
    const groups = data.groups?.length ? data.groups : GROUP_ORDER.map((title) => ({ title, members: [] }));
    const options = groups
      .map((group) => `<option value="${escapeHtml(normalize(group.title))}">${escapeHtml(group.title || 'Группа')}</option>`)
      .join('');
    select.innerHTML = `<option value="all">Все группы</option>${options}`;
    select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
  }

  function renderMember(member) {
    const badge = member.badge || statusText(member.status);
    const chips = [
      member.position || 'Должность не указана',
      member.rank || 'Звание не указано',
      member.callsign ? `Позывной: ${member.callsign}` : '',
      member.serviceId ? `Жетон: ${member.serviceId}` : ''
    ].filter(Boolean);

    return `
      <article class="member-card member-card--v3${member.status === 'vacant' ? ' member-card--vacant' : ''}">
        <div class="member-card__avatar" aria-hidden="true">${escapeHtml(initials(member.name, member.callsign, member.status))}</div>
        <div class="member-card__content">
          <div class="member-card__top">
            <div>
              <h4>${escapeHtml(member.name || (member.status === 'vacant' ? 'Вакантно' : 'Без ФИО'))}</h4>
              <p>${escapeHtml(member.status === 'vacant' ? 'Свободная позиция' : (member.rank || member.position || 'Данные не указаны'))}</p>
            </div>
            <span class="${statusClass(member.status)}">${escapeHtml(badge)}</span>
          </div>
          <div class="member-card__chips">
            ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
            ${member.profileUrl ? `<a class="member-card__file" href="${escapeHtml(member.profileUrl)}" target="_blank" rel="noopener noreferrer">Личное дело ↗</a>` : ''}
          </div>
          ${member.note ? `<small>${escapeHtml(member.note)}</small>` : ''}
        </div>
      </article>
    `;
  }

  function renderRoster(data, query = '', status = 'all', selectedGroup = 'all') {
    const root = $('#rosterRoot');
    if (!root) return;

    updateStats(data);

    const groups = (data.groups || [])
      .filter((group) => groupMatches(group, selectedGroup))
      .map((group) => {
        const members = (group.members || [])
          .map((member) => ({ ...member, groupTitle: group.title || 'Группа' }))
          .filter((member) => memberMatches(member, query, status));
        return { ...group, members };
      });

    const visibleGroups = groups.filter((group) => group.members.length > 0);
    const shouldShowEmptyGroups = !query && status === 'all' && selectedGroup !== 'all';
    const renderedGroups = shouldShowEmptyGroups ? groups : visibleGroups;

    if (!renderedGroups.length) {
      root.innerHTML = '<div class="empty-state empty-state--big">По текущим фильтрам сотрудников нет.</div>';
      return;
    }

    root.innerHTML = renderedGroups.map((group) => {
      const membersHtml = group.members.length
        ? group.members.map(renderMember).join('')
        : `<div class="empty-state">В группе «${escapeHtml(group.title)}» пока никого нет.</div>`;

      return `
        <section class="roster-group roster-group--v3 reveal">
          <div class="roster-group__title">
            <div>
              <span class="tag">${escapeHtml(group.title || 'Группа')}</span>
              <h3>${escapeHtml(group.title || 'Группа')}</h3>
            </div>
            <strong>${group.members.length} чел.</strong>
          </div>
          <div class="member-grid member-grid--v3">${membersHtml}</div>
        </section>
      `;
    }).join('');
  }

  function cellValue(cell) {
    if (!cell) return '';
    return clean(cell.f ?? cell.v ?? '');
  }

  function parseGvizJson(text) {
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
    if (!match) throw new Error('Bad Google Sheets response');
    return JSON.parse(match[1]);
  }

  function rowCells(row) {
    return (row.c || []).map(cellValue);
  }

  function groupFromHeader(text) {
    const value = normalize(text);
    if (!value) return '';
    if (value.includes('руковод') || value.includes('командован')) return 'Командование';
    if (value.includes('инструктор')) return 'Инструкторский состав';
    if (value.includes('стаж')) return 'Стажёрский состав';
    if (value.includes('кадров') || value.includes('резерв')) return 'Кадровый резерв';
    if (value.includes('спецназ') || value.includes('оператив')) return 'Оперативный состав';
    return '';
  }

  function isServiceNumber(value) {
    return /^\d{2,4}\s*[-/]\s*\d{2,4}/.test(clean(value));
  }

  function isCallsignNumber(value) {
    return /^\d{1,3}\s*[-‐‑]?\s*[йя]$/i.test(clean(value));
  }

  function isRole(value) {
    const text = normalize(value);
    return /(командир|ком\.?|оперативник|стаж[её]р|инструктор|резерв|руковод|зам\.?)/i.test(text);
  }

  function isRank(value) {
    const text = normalize(value);
    return /(сержант|старшина|прапорщик|лейтенант|капитан|майор|подполковник|полковник|генерал)/i.test(text);
  }

  function guessStatus(member, rawText, currentGroup = '') {
    const text = normalize([rawText, member.name, member.position, member.rank, member.note, member.badge, currentGroup].join(' '));
    if (/отпуск/.test(text)) return 'leave';
    if (/кадров|резерв/.test(text)) return 'reserve';
    if (/вакант|свободн/.test(text)) return 'vacant';
    if (/стаж[её]р/.test(text)) return 'trainee';
    if (/актив|действующ/.test(text)) return 'active';
    return 'active';
  }

  function groupFromMember(member, currentGroup) {
    const text = normalize([member.name, member.position, member.rank, member.note, member.badge].join(' '));
    if (member.status === 'vacant') return 'Вакантно';
    if (currentGroup === 'Командование' || /командир|зам\.?\s*ком|руковод/.test(text)) return 'Командование';
    if (/старш(?:ий|его)?\s+инструктор|инструктор/.test(text)) return 'Инструкторский состав';
    if (/стаж[её]р/.test(text)) return 'Стажёрский состав';
    if (member.status === 'reserve' || /кадров|резерв/.test(text)) return 'Кадровый резерв';
    return currentGroup && GROUP_ORDER.includes(currentGroup) ? currentGroup : 'Оперативный состав';
  }

  function looksLikeHeader(cells) {
    const nonEmpty = cells.filter(Boolean);
    if (!nonEmpty.length) return true;
    const text = nonEmpty.join(' ');
    if (/вакант|свободн/i.test(text)) return false;
    if (/^\d+$/.test(text)) return true;
    if (/примечание/i.test(text) && nonEmpty.length <= 2) return true;
    if (groupFromHeader(text) && nonEmpty.length <= 2) return true;
    if (cells.slice(0, 9).every((cell) => !cell)) return true;
    if (groupFromHeader(cells[0]) && cells.slice(1, 9).every((cell) => !cell)) return true;
    return false;
  }

  function parseLooseMember(text, currentGroup) {
    const value = clean(text);
    if (!value || /^\d+$/.test(value)) return null;
    const vacant = /вакант|свободн/i.test(value);
    if (vacant) {
      const member = { name: 'Вакантно', rank: '', position: value.replace(/вакантно?/i, '').trim() || 'Свободная позиция', callsign: '', serviceId: '', badge: 'Вакантно', note: '' };
      member.status = 'vacant';
      member.groupTitle = groupFromMember(member, currentGroup);
      return member;
    }
    return null;
  }

  function joinSheetColumns(cells, indexes) {
    return indexes
      .map((index) => clean(cells[index]))
      .filter(Boolean)
      .join(' ');
  }

  function splitServiceIdAndCallsign(serviceId, callsign) {
    let id = clean(serviceId);
    let call = clean(callsign);

    if (id.includes('|')) {
      const parts = id.split('|').map(clean).filter(Boolean);
      id = parts.shift() || '';
      call = [parts.join(' '), call].filter(Boolean).join(' ');
    }

    return { serviceId: id, callsign: call };
  }

  function parseSheetMember(cells, currentGroup) {
    const normalizedCells = cells.map(clean);
    const compact = normalizedCells.filter(Boolean);
    const rawText = compact.join(' ');
    if (!rawText || looksLikeHeader(normalizedCells)) return null;

    if (compact.length === 1) return parseLooseMember(compact[0], currentGroup);

    const rawName = joinSheetColumns(normalizedCells, [0, 1]);
    const rawServiceId = joinSheetColumns(normalizedCells, [2, 3]);
    const rawCallsign = joinSheetColumns(normalizedCells, [4, 5]);
    const rawPosition = joinSheetColumns(normalizedCells, [6, 7]);
    const rawRank = clean(normalizedCells[8]);
    const rawBadge = clean(normalizedCells[9]);
    const rawNote = normalizedCells.slice(10).map(clean)
      .filter(Boolean)
      .join(' · ');

    const vacant = /вакант|свободн/i.test(rawText);
    const { serviceId, callsign } = splitServiceIdAndCallsign(rawServiceId, rawCallsign);

    const member = {
      name: rawName || (vacant ? 'Вакантно' : 'Без ФИО'),
      rank: rawRank,
      position: rawPosition || (vacant ? 'Свободная позиция' : ''),
      callsign,
      serviceId,
      badge: rawBadge,
      note: rawNote
    };

    member.status = guessStatus(member, rawText, currentGroup);
    if (member.status === 'reserve' && vacant && !rawName) {
      member.name = 'Кадровый резерв';
      member.rank = rawRank && !/вакант/i.test(rawRank) ? rawRank : '';
      member.position = 'Свободный слот кадрового резерва';
      member.badge = rawBadge || 'Вакантно';
      member.note = rawNote || 'Место доступно для перевода в резерв';
    } else if (member.status === 'vacant') {
      member.name = 'Вакантно';
      member.badge = member.badge || 'Вакантно';
      member.note = member.note || 'Свободная позиция';
    }
    member.groupTitle = groupFromMember(member, currentGroup);
    return member;
  }

  function normalizeSheetData(table) {
    const groupMap = new Map(GROUP_ORDER.map((title) => [title, { title, members: [] }]));
    let currentGroup = 'Оперативный состав';

    (table.rows || []).forEach((row) => {
      const cells = rowCells(row);
      const compact = cells.filter(Boolean);
      const rawText = compact.join(' ');
      const headerGroup = groupFromHeader(rawText);

      if (headerGroup && looksLikeHeader(cells)) {
        currentGroup = headerGroup;
        return;
      }

      const member = parseSheetMember(cells, currentGroup);
      if (!member) return;

      const groupTitle = member.groupTitle || groupFromMember(member, currentGroup);
      if (!groupMap.has(groupTitle)) groupMap.set(groupTitle, { title: groupTitle, members: [] });
      groupMap.get(groupTitle).members.push(member);
    });

    return {
      updated: 'Google Sheets',
      groups: Array.from(groupMap.values())
    };
  }


  async function fetchWithTimeout(url, options = {}, timeoutMs = 5500) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchGoogleRoster() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${encodeURIComponent(SHEET_GID)}&headers=0&tqx=out:json&cache=${Date.now()}`;
    const response = await fetchWithTimeout(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
    const text = await response.text();
    const payload = parseGvizJson(text);
    return normalizeSheetData(payload.table || {});
  }

  async function fetchLocalRoster() {
    const response = await fetch(LOCAL_ROSTER_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Local roster HTTP ${response.status}`);
    const data = await response.json();
    return {
      ...data,
      updated: data.updated ? `${data.updated} · резервный JSON` : 'резервный JSON'
    };
  }

  async function loadRoster() {
    try {
      const googleData = await fetchGoogleRoster();
      if (getAllMembers(googleData).length > 0) return googleData;
      throw new Error('Google Sheets roster is empty');
    } catch (googleError) {
      console.warn('[roster] Google Sheets unavailable, falling back to local JSON:', googleError);
      return fetchLocalRoster();
    }
  }

  async function initRoster() {
    const root = $('#rosterRoot');
    if (!root) return;

    let data;
    try {
      data = sanitizeRosterData(await loadRoster());
    } catch (error) {
      root.innerHTML = '<div class="empty-state">Не удалось загрузить состав из Google Sheets и резервного JSON. Проверьте доступ к таблице или файл <code>data/roster.json</code>.</div>';
      return;
    }

    fillGroupFilter(data);

    const search = $('#rosterSearch');
    const status = $('#rosterStatus');
    const group = $('#rosterGroup');

    function update() {
      renderRoster(data, normalize(search?.value), status?.value || 'all', group?.value || 'all');
    }

    [search, status, group].forEach((element) => {
      if (!element) return;
      element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', update);
    });

    update();
  }

  document.addEventListener('DOMContentLoaded', initRoster);
})();
