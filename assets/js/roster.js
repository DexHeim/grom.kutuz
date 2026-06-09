(() => {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

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

  function statusText(status) {
    const map = {
      active: 'Активен',
      trainee: 'Стажёр',
      reserve: 'Резерв',
      leave: 'Отпуск'
    };
    return map[status] || status || 'Активен';
  }

  function statusClass(status) {
    if (status === 'reserve') return 'status-badge status-badge--reserve';
    if (status === 'leave') return 'status-badge status-badge--leave';
    if (status === 'trainee') return 'status-badge status-badge--trainee';
    return 'status-badge';
  }

  function getAllMembers(data) {
    return (data.groups || []).flatMap((group) => (group.members || []).map((member) => ({ ...member, groupTitle: group.title || 'Группа' })));
  }

  function initials(name, callsign) {
    const source = String(name || callsign || 'Г').replace(/\[[^\]]+\]/g, '').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Г';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function memberMatches(member, query, status) {
    const haystack = [member.name, member.rank, member.position, member.callsign, member.note, member.groupTitle].map(normalize).join(' ');
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
    const reserve = all.filter((member) => member.status === 'reserve' || member.status === 'leave').length;

    const values = {
      rosterTotal: all.length,
      rosterActive: active,
      rosterTrainee: trainee,
      rosterReserve: reserve,
      rosterUpdated: data.updated || 'не указано'
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
    const options = (data.groups || []).map((group) => `<option value="${escapeHtml(normalize(group.title))}">${escapeHtml(group.title || 'Группа')}</option>`).join('');
    select.innerHTML = `<option value="all">Все группы</option>${options}`;
    select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
  }

  function renderMember(member) {
    return `
      <article class="member-card member-card--v3">
        <div class="member-card__avatar" aria-hidden="true">${escapeHtml(initials(member.name, member.callsign))}</div>
        <div class="member-card__content">
          <div class="member-card__top">
            <div>
              <h4>${escapeHtml(member.name || 'Без ФИО')}</h4>
              <p>${escapeHtml(member.rank || 'Звание не указано')}</p>
            </div>
            <span class="${statusClass(member.status)}">${escapeHtml(statusText(member.status))}</span>
          </div>
          <div class="member-card__chips">
            <span>${escapeHtml(member.position || 'Должность не указана')}</span>
            <span>Позывной: ${escapeHtml(member.callsign || '—')}</span>
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

  async function initRoster() {
    const root = $('#rosterRoot');
    if (!root) return;

    let data;
    try {
      const response = await fetch('data/roster.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      root.innerHTML = `<div class="empty-state">Не удалось загрузить <code>data/roster.json</code>. Проверьте файл состава.</div>`;
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
