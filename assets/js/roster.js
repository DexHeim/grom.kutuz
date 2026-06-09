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
    return 'status-badge';
  }

  function countMembers(data) {
    return (data.groups || []).reduce((sum, group) => sum + (group.members || []).length, 0);
  }

  function memberMatches(member, query, status) {
    const haystack = [member.name, member.rank, member.position, member.callsign, member.note].map(normalize).join(' ');
    const queryOk = !query || haystack.includes(query);
    const statusOk = !status || status === 'all' || member.status === status;
    return queryOk && statusOk;
  }

  function renderRoster(data, query = '', status = 'all') {
    const root = $('#rosterRoot');
    const updated = $('#rosterUpdated');
    const total = $('#rosterTotal');
    if (!root) return;

    if (updated) updated.textContent = data.updated || 'не указано';
    if (total) total.textContent = countMembers(data);

    const html = (data.groups || []).map((group) => {
      const members = (group.members || []).filter((member) => memberMatches(member, query, status));
      const memberHtml = members.length
        ? members.map((member) => `
            <article class="member-card">
              <div class="member-card__top">
                <div>
                  <h4>${escapeHtml(member.name || 'Без ФИО')}</h4>
                  <p>${escapeHtml(member.position || 'Должность не указана')}</p>
                </div>
                <span class="${statusClass(member.status)}">${escapeHtml(statusText(member.status))}</span>
              </div>
              <div class="mini-grid">
                <small><strong>Звание:</strong> ${escapeHtml(member.rank || '—')}</small>
                <small><strong>Позывной:</strong> ${escapeHtml(member.callsign || '—')}</small>
              </div>
              ${member.note ? `<small>${escapeHtml(member.note)}</small>` : ''}
            </article>
          `).join('')
        : `<div class="empty-state">По текущему фильтру сотрудников нет.</div>`;

      return `
        <section class="roster-group reveal">
          <div class="roster-group__title">
            <h3>${escapeHtml(group.title || 'Группа')}</h3>
            <span>${members.length} чел.</span>
          </div>
          <div class="member-grid">${memberHtml}</div>
        </section>
      `;
    }).join('');

    root.innerHTML = html || '<div class="empty-state">Состав пока не заполнен.</div>';
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

    const search = $('#rosterSearch');
    const status = $('#rosterStatus');

    function update() {
      renderRoster(data, normalize(search?.value), status?.value || 'all');
    }

    if (search) search.addEventListener('input', update);
    if (status) status.addEventListener('change', update);
    update();
  }

  document.addEventListener('DOMContentLoaded', initRoster);
})();
