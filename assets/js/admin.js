(() => {
  'use strict';

  const storageKey = 'osn-grom-roster-draft-v1';
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  const defaultData = { updated: new Date().toISOString().slice(0, 10), groups: [] };
  let roster = structuredCloneSafe(defaultData);
  let editing = null;

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getElements() {
    return {
      form: $('#memberForm'),
      groupTitle: $('#groupTitle'),
      name: $('#memberName'),
      rank: $('#memberRank'),
      position: $('#memberPosition'),
      callsign: $('#memberCallsign'),
      status: $('#memberStatus'),
      note: $('#memberNote'),
      submitBtn: $('#memberSubmitBtn'),
      cancelBtn: $('#cancelEditBtn'),
      updated: $('#rosterUpdatedInput'),
      list: $('#adminMemberList'),
      json: $('#jsonEditor'),
      copyBtn: $('#copyJsonBtn'),
      downloadBtn: $('#downloadJsonBtn'),
      applyJsonBtn: $('#applyJsonBtn'),
      resetBtn: $('#resetDraftBtn'),
      statusText: $('#adminStatus')
    };
  }

  function normalizeRoster(data) {
    const normalized = {
      updated: data?.updated || new Date().toISOString().slice(0, 10),
      groups: Array.isArray(data?.groups) ? data.groups : []
    };

    normalized.groups = normalized.groups.map((group) => ({
      title: group?.title || 'Без группы',
      members: Array.isArray(group?.members) ? group.members.map((member) => ({
        name: member?.name || '',
        rank: member?.rank || '',
        position: member?.position || '',
        callsign: member?.callsign || '',
        status: member?.status || 'active',
        note: member?.note || ''
      })) : []
    }));

    return normalized;
  }

  async function loadRoster() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return normalizeRoster(JSON.parse(raw));
    } catch {}

    try {
      const response = await fetch('data/roster.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return normalizeRoster(await response.json());
    } catch {
      return structuredCloneSafe(defaultData);
    }
  }

  function saveDraft() {
    localStorage.setItem(storageKey, JSON.stringify(roster, null, 2));
  }

  function setStatus(message) {
    const elements = getElements();
    if (!elements.statusText) return;
    elements.statusText.textContent = message;
    window.clearTimeout(setStatus.timeoutId);
    setStatus.timeoutId = window.setTimeout(() => {
      elements.statusText.textContent = '';
    }, 3200);
  }

  function prettyJson() {
    return JSON.stringify(roster, null, 2);
  }

  function syncJsonEditor() {
    const elements = getElements();
    if (elements.json) elements.json.value = prettyJson();
    if (elements.updated) elements.updated.value = roster.updated || new Date().toISOString().slice(0, 10);
  }

  function findOrCreateGroup(title) {
    const safeTitle = title.trim() || 'Без группы';
    let group = roster.groups.find((item) => item.title.toLowerCase() === safeTitle.toLowerCase());
    if (!group) {
      group = { title: safeTitle, members: [] };
      roster.groups.push(group);
    }
    return group;
  }

  function getMemberFromForm() {
    const elements = getElements();
    return {
      groupTitle: elements.groupTitle.value.trim() || 'Без группы',
      member: {
        name: elements.name.value.trim() || '[ФИО]',
        rank: elements.rank.value.trim() || '[звание]',
        position: elements.position.value.trim() || '[должность]',
        callsign: elements.callsign.value.trim() || '[позывной]',
        status: elements.status.value || 'active',
        note: elements.note.value.trim()
      }
    };
  }

  function fillForm(groupIndex, memberIndex) {
    const elements = getElements();
    const group = roster.groups[groupIndex];
    const member = group.members[memberIndex];
    elements.groupTitle.value = group.title;
    elements.name.value = member.name;
    elements.rank.value = member.rank;
    elements.position.value = member.position;
    elements.callsign.value = member.callsign;
    elements.status.value = member.status || 'active';
    elements.note.value = member.note || '';
    editing = { groupIndex, memberIndex };
    elements.submitBtn.textContent = 'Сохранить изменения';
    elements.cancelBtn.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearForm() {
    const elements = getElements();
    elements.form.reset();
    elements.groupTitle.value = 'Оперативный состав';
    elements.status.value = 'active';
    editing = null;
    elements.submitBtn.textContent = 'Добавить сотрудника';
    elements.cancelBtn.hidden = true;
  }

  function removeEmptyGroups() {
    roster.groups = roster.groups.filter((group) => (group.members || []).length > 0 || group.title === 'Кадровый резерв');
  }

  function renderList() {
    const elements = getElements();
    if (!elements.list) return;

    if (!roster.groups.length) {
      elements.list.innerHTML = '<div class="empty-state">Состав пока пустой. Добавьте первого сотрудника через форму.</div>';
      syncJsonEditor();
      return;
    }

    elements.list.innerHTML = roster.groups.map((group, groupIndex) => {
      const members = group.members || [];
      const membersHtml = members.length ? members.map((member, memberIndex) => `
        <div class="admin-member">
          <div>
            <h4>${escapeHtml(member.name || 'Без ФИО')}</h4>
            <p>${escapeHtml(group.title)} · ${escapeHtml(member.position || 'Должность не указана')} · ${escapeHtml(member.callsign || 'позывной не указан')}</p>
          </div>
          <div class="admin-member__actions">
            <button class="mini-btn" type="button" data-action="edit" data-group="${groupIndex}" data-member="${memberIndex}">Редачить</button>
            <button class="mini-btn mini-btn--danger" type="button" data-action="delete" data-group="${groupIndex}" data-member="${memberIndex}">Удалить</button>
          </div>
        </div>
      `).join('') : `<div class="empty-state">В группе «${escapeHtml(group.title)}» никого нет.</div>`;

      return `
        <section>
          <div class="roster-group__title">
            <h3>${escapeHtml(group.title)}</h3>
            <span>${members.length} чел.</span>
          </div>
          ${membersHtml}
        </section>
      `;
    }).join('');

    $$('[data-action="edit"]', elements.list).forEach((button) => {
      button.addEventListener('click', () => fillForm(Number(button.dataset.group), Number(button.dataset.member)));
    });

    $$('[data-action="delete"]', elements.list).forEach((button) => {
      button.addEventListener('click', () => {
        const groupIndex = Number(button.dataset.group);
        const memberIndex = Number(button.dataset.member);
        roster.groups[groupIndex].members.splice(memberIndex, 1);
        removeEmptyGroups();
        saveDraft();
        renderList();
        setStatus('Сотрудник удалён из черновика.');
      });
    });

    syncJsonEditor();
  }

  function submitForm(event) {
    event.preventDefault();
    const elements = getElements();
    roster.updated = elements.updated.value || new Date().toISOString().slice(0, 10);
    const { groupTitle, member } = getMemberFromForm();

    if (editing) {
      const oldGroup = roster.groups[editing.groupIndex];
      oldGroup.members.splice(editing.memberIndex, 1);
      const targetGroup = findOrCreateGroup(groupTitle);
      targetGroup.members.push(member);
      removeEmptyGroups();
      setStatus('Изменения сохранены в черновик.');
    } else {
      const targetGroup = findOrCreateGroup(groupTitle);
      targetGroup.members.push(member);
      setStatus('Сотрудник добавлен в черновик.');
    }

    saveDraft();
    clearForm();
    renderList();
  }

  async function copyJson() {
    const text = prettyJson();
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
      setStatus('JSON скопирован. Вставь его в data/roster.json.');
    } catch {
      setStatus('Автокопирование не сработало. Скопируй текст вручную.');
    }
  }

  function downloadJson() {
    const blob = new Blob([prettyJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roster.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Файл roster.json скачан. Замени им data/roster.json в репозитории.');
  }

  function applyJson() {
    const elements = getElements();
    try {
      roster = normalizeRoster(JSON.parse(elements.json.value));
      saveDraft();
      clearForm();
      renderList();
      setStatus('JSON применён к черновику.');
    } catch (error) {
      setStatus('JSON сломан. Проверь запятые, кавычки и скобки.');
    }
  }

  async function resetDraft() {
    localStorage.removeItem(storageKey);
    roster = await loadRoster();
    clearForm();
    renderList();
    setStatus('Черновик сброшен до data/roster.json.');
  }

  async function initAdmin() {
    const elements = getElements();
    if (!elements.form) return;

    roster = await loadRoster();
    clearForm();
    renderList();

    elements.form.addEventListener('submit', submitForm);
    elements.cancelBtn.addEventListener('click', clearForm);
    elements.copyBtn.addEventListener('click', copyJson);
    elements.downloadBtn.addEventListener('click', downloadJson);
    elements.applyJsonBtn.addEventListener('click', applyJson);
    elements.resetBtn.addEventListener('click', resetDraft);
    elements.updated.addEventListener('input', () => {
      roster.updated = elements.updated.value;
      saveDraft();
      syncJsonEditor();
    });
  }

  document.addEventListener('DOMContentLoaded', initAdmin);
})();
