(() => {
  'use strict';

  const storageKey = 'osn-grom-roster-draft-v4';
  const authSessionKey = 'osn-grom-admin-session-v1';
  const githubSettingsKey = 'osn-grom-github-settings-v1';
  const githubTokenKey = 'osn-grom-github-token-session-v1';

  const defaultData = {
    updated: new Date().toISOString().slice(0, 10),
    groups: [
      { title: 'Командование', members: [] },
      { title: 'Инструкторский состав', members: [] },
      { title: 'Оперативный состав', members: [] },
      { title: 'Стажёрский состав', members: [] },
      { title: 'Кадровый резерв', members: [] }
    ]
  };

  const authConfig = window.GROM_ADMIN_AUTH || { enabled: false, users: [] };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  let roster = clone(defaultData);
  let editing = null;
  let editorReady = false;

  function clone(value) {
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

  function normalize(value) {
    return String(value ?? '').toLowerCase().trim();
  }

  function statusText(status) {
    const map = { active: 'Активен', trainee: 'Стажёр', reserve: 'Резерв', leave: 'Отпуск' };
    return map[status] || status || 'Активен';
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function getElements() {
    return {
      loginPanel: $('#loginPanel'),
      workspace: $('#adminWorkspace'),
      loginForm: $('#loginForm'),
      login: $('#adminLogin'),
      password: $('#adminPassword'),
      loginStatus: $('#loginStatus'),
      userLabel: $('#adminUserLabel'),
      logoutBtn: $('#logoutBtn'),
      form: $('#memberForm'),
      groupTitle: $('#groupTitle'),
      groupOptions: $('#groupOptions'),
      name: $('#memberName'),
      rank: $('#memberRank'),
      position: $('#memberPosition'),
      callsign: $('#memberCallsign'),
      status: $('#memberStatus'),
      note: $('#memberNote'),
      submitBtn: $('#memberSubmitBtn'),
      cancelBtn: $('#cancelEditBtn'),
      updated: $('#rosterUpdatedInput'),
      search: $('#adminSearch'),
      list: $('#adminMemberList'),
      json: $('#jsonEditor'),
      copyBtn: $('#copyJsonBtn'),
      downloadBtn: $('#downloadJsonBtn'),
      applyJsonBtn: $('#applyJsonBtn'),
      resetBtn: $('#resetDraftBtn'),
      statusText: $('#adminStatus'),
      ghOwner: $('#ghOwner'),
      ghRepo: $('#ghRepo'),
      ghBranch: $('#ghBranch'),
      ghPath: $('#ghPath'),
      ghToken: $('#ghToken'),
      ghRemember: $('#ghRemember'),
      ghMessage: $('#ghMessage'),
      pushGitHubBtn: $('#pushGitHubBtn'),
      pullGitHubBtn: $('#pullGitHubBtn')
    };
  }

  function setLoginStatus(message, danger = false) {
    const node = $('#loginStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.danger = danger ? 'true' : 'false';
  }

  function setStatus(message, danger = false) {
    const elements = getElements();
    if (!elements.statusText) return;
    elements.statusText.textContent = message;
    elements.statusText.dataset.danger = danger ? 'true' : 'false';
    window.clearTimeout(setStatus.timeoutId);
    setStatus.timeoutId = window.setTimeout(() => {
      elements.statusText.textContent = '';
      elements.statusText.dataset.danger = 'false';
    }, 4200);
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToBytes(value) {
    const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  async function derivePasswordHash(password, user) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto API недоступен в этом браузере.');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: base64UrlToBytes(user.salt), iterations: user.iterations || 210000, hash: 'SHA-256' },
      key,
      256
    );
    return new Uint8Array(bits);
  }

  function equalBytes(left, right) {
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
    return diff === 0;
  }

  async function authenticate(login, password) {
    if (!authConfig.enabled) return { login: 'local', displayName: 'Локальный режим' };
    const user = (authConfig.users || []).find((item) => item.login === login);
    if (!user) return null;
    const actualHash = await derivePasswordHash(password, user);
    const expectedHash = base64UrlToBytes(user.hash);
    if (!equalBytes(actualHash, expectedHash)) return null;
    return { login: user.login, displayName: user.displayName || user.login };
  }

  function saveSession(user) {
    const minutes = Number(authConfig.sessionMinutes || 120);
    sessionStorage.setItem(authSessionKey, JSON.stringify({
      login: user.login,
      displayName: user.displayName,
      until: Date.now() + minutes * 60 * 1000
    }));
  }

  function readSession() {
    if (!authConfig.enabled) return { login: 'local', displayName: 'Локальный режим' };
    try {
      const session = JSON.parse(sessionStorage.getItem(authSessionKey) || 'null');
      if (!session || session.until < Date.now()) return null;
      const exists = (authConfig.users || []).some((user) => user.login === session.login);
      return exists ? session : null;
    } catch {
      return null;
    }
  }

  function lockAdmin() {
    const elements = getElements();
    if (elements.workspace) elements.workspace.hidden = true;
    if (elements.loginPanel) elements.loginPanel.hidden = false;
    sessionStorage.removeItem(authSessionKey);
    elements.password && (elements.password.value = '');
  }

  async function unlockAdmin(user) {
    const elements = getElements();
    if (elements.loginPanel) elements.loginPanel.hidden = true;
    if (elements.workspace) elements.workspace.hidden = false;
    if (elements.userLabel) elements.userLabel.textContent = user.displayName || user.login;
    if (!editorReady) await initEditor();
  }

  function initAuth() {
    const elements = getElements();
    if (!elements.loginForm) return;

    const session = readSession();
    if (session) unlockAdmin(session);
    else lockAdmin();

    elements.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = elements.loginForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setLoginStatus('Проверка доступа...');
      try {
        const user = await authenticate(elements.login.value.trim(), elements.password.value);
        if (!user) {
          setLoginStatus('Неверный логин или пароль.', true);
          return;
        }
        saveSession(user);
        elements.password.value = '';
        setLoginStatus('');
        await unlockAdmin(user);
      } catch (error) {
        setLoginStatus(error.message || 'Не удалось проверить пароль.', true);
      } finally {
        submit.disabled = false;
      }
    });

    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', () => {
        lockAdmin();
        setLoginStatus('Сессия завершена.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function normalizeRoster(data) {
    const normalized = {
      updated: data?.updated || today(),
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
      return clone(defaultData);
    }
  }

  function saveDraft() {
    localStorage.setItem(storageKey, JSON.stringify(roster, null, 2));
  }

  function prettyJson() {
    return JSON.stringify(roster, null, 2);
  }

  function syncGroupOptions() {
    const elements = getElements();
    if (!elements.groupOptions) return;
    elements.groupOptions.innerHTML = (roster.groups || [])
      .map((group) => `<option value="${escapeHtml(group.title)}"></option>`)
      .join('');
  }

  function syncJsonEditor() {
    const elements = getElements();
    if (elements.json) elements.json.value = prettyJson();
    if (elements.updated) elements.updated.value = roster.updated || today();
    syncGroupOptions();
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
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearForm() {
    const elements = getElements();
    elements.form.reset();
    elements.groupTitle.value = 'Оперативный состав';
    elements.status.value = 'active';
    elements.updated.value = roster.updated || today();
    editing = null;
    elements.submitBtn.textContent = 'Добавить сотрудника';
    elements.cancelBtn.hidden = true;
  }

  function removeEmptyGroups() {
    roster.groups = roster.groups.filter((group) => (group.members || []).length > 0 || group.title === 'Кадровый резерв');
  }

  function memberMatchesAdmin(group, member, query) {
    if (!query) return true;
    const haystack = [group.title, member.name, member.rank, member.position, member.callsign, member.note, statusText(member.status)].map(normalize).join(' ');
    return haystack.includes(query);
  }

  function renderList() {
    const elements = getElements();
    if (!elements.list) return;
    const query = normalize(elements.search?.value);

    if (!roster.groups.length) {
      elements.list.innerHTML = '<div class="empty-state">Состав пока пустой. Добавьте первого сотрудника через форму.</div>';
      syncJsonEditor();
      return;
    }

    const groupsHtml = roster.groups.map((group, groupIndex) => {
      const members = (group.members || []).map((member, memberIndex) => ({ member, memberIndex }))
        .filter(({ member }) => memberMatchesAdmin(group, member, query));
      if (!members.length && query) return '';

      const membersHtml = members.length ? members.map(({ member, memberIndex }) => `
        <div class="admin-member admin-member--v3">
          <div class="admin-member__avatar" aria-hidden="true">${escapeHtml((member.callsign || member.name || 'Г').slice(0, 2).toUpperCase())}</div>
          <div>
            <h4>${escapeHtml(member.name || 'Без ФИО')}</h4>
            <p>${escapeHtml(group.title)} · ${escapeHtml(member.position || 'Должность не указана')} · ${escapeHtml(member.callsign || 'позывной не указан')} · ${escapeHtml(statusText(member.status))}</p>
          </div>
          <div class="admin-member__actions">
            <button class="mini-btn" type="button" data-action="edit" data-group="${groupIndex}" data-member="${memberIndex}">Править</button>
            <button class="mini-btn mini-btn--danger" type="button" data-action="delete" data-group="${groupIndex}" data-member="${memberIndex}">Удалить</button>
          </div>
        </div>
      `).join('') : `<div class="empty-state">В группе «${escapeHtml(group.title)}» никого нет.</div>`;

      return `
        <section class="admin-roster-group">
          <div class="roster-group__title">
            <h3>${escapeHtml(group.title)}</h3>
            <span>${members.length} чел.</span>
          </div>
          ${membersHtml}
        </section>
      `;
    }).join('');

    elements.list.innerHTML = groupsHtml || '<div class="empty-state">По поиску ничего не найдено.</div>';

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
    roster.updated = elements.updated.value || today();
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

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
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

  async function copyJson() {
    try {
      await copyText(prettyJson());
      setStatus('JSON скопирован. Вставь его в data/roster.json.');
    } catch {
      setStatus('Автокопирование не сработало. Скопируй текст вручную.', true);
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
    } catch {
      setStatus('JSON сломан. Проверь запятые, кавычки и скобки.', true);
    }
  }

  async function resetDraft() {
    localStorage.removeItem(storageKey);
    roster = await loadRoster();
    clearForm();
    renderList();
    setStatus('Черновик сброшен до data/roster.json.');
  }

  function guessGitHubPages() {
    const host = location.hostname;
    if (!host.endsWith('.github.io')) return {};
    const owner = host.replace('.github.io', '');
    const pathParts = location.pathname.split('/').filter(Boolean);
    const repo = pathParts[0] || `${owner}.github.io`;
    return { owner, repo };
  }

  function loadGitHubSettings() {
    const elements = getElements();
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem(githubSettingsKey) || '{}'); } catch {}
    const guessed = guessGitHubPages();

    elements.ghOwner.value = settings.owner || guessed.owner || '';
    elements.ghRepo.value = settings.repo || guessed.repo || '';
    elements.ghBranch.value = settings.branch || 'main';
    elements.ghPath.value = settings.path || 'data/roster.json';
    elements.ghMessage.value = settings.message || 'Update OSN Grom roster';
    elements.ghToken.value = sessionStorage.getItem(githubTokenKey) || '';
    elements.ghRemember.checked = Boolean(elements.ghToken.value);
  }

  function saveGitHubSettings() {
    const elements = getElements();
    const settings = {
      owner: elements.ghOwner.value.trim(),
      repo: elements.ghRepo.value.trim(),
      branch: elements.ghBranch.value.trim() || 'main',
      path: elements.ghPath.value.trim() || 'data/roster.json',
      message: elements.ghMessage.value.trim() || 'Update OSN Grom roster'
    };
    localStorage.setItem(githubSettingsKey, JSON.stringify(settings));
    if (elements.ghRemember.checked && elements.ghToken.value.trim()) {
      sessionStorage.setItem(githubTokenKey, elements.ghToken.value.trim());
    } else {
      sessionStorage.removeItem(githubTokenKey);
    }
    return { ...settings, token: elements.ghToken.value.trim() };
  }

  function validateGitHubSettings(settings) {
    if (!settings.owner || !settings.repo || !settings.branch || !settings.path) {
      throw new Error('Заполни owner, repo, branch и path.');
    }
    if (!settings.token) throw new Error('Вставь GitHub token с доступом на запись contents.');
  }

  function encodeRepoPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function encodeBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function decodeBase64Utf8(text) {
    const clean = String(text || '').replace(/\s/g, '');
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function githubRequest(method, endpoint, token, body) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    if (!response.ok) {
      const error = new Error(data?.message || `GitHub API: HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function pullFromGitHub() {
    const settings = saveGitHubSettings();
    try {
      validateGitHubSettings(settings);
      setStatus('Загрузка roster.json из GitHub...');
      const endpoint = `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodeRepoPath(settings.path)}?ref=${encodeURIComponent(settings.branch)}`;
      const data = await githubRequest('GET', endpoint, settings.token);
      roster = normalizeRoster(JSON.parse(decodeBase64Utf8(data.content)));
      saveDraft();
      clearForm();
      renderList();
      setStatus('Состав подтянут из GitHub.');
    } catch (error) {
      setStatus(error.message || 'Не удалось подтянуть файл из GitHub.', true);
    }
  }

  async function pushToGitHub() {
    const settings = saveGitHubSettings();
    try {
      validateGitHubSettings(settings);
      const elements = getElements();
      roster.updated = elements.updated.value || today();
      saveDraft();
      syncJsonEditor();

      setStatus('Проверка текущего файла в GitHub...');
      const endpoint = `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodeRepoPath(settings.path)}`;
      const refEndpoint = `${endpoint}?ref=${encodeURIComponent(settings.branch)}`;
      let sha = null;
      try {
        const current = await githubRequest('GET', refEndpoint, settings.token);
        sha = current.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
      }

      setStatus('Отправка commit в GitHub...');
      const payload = {
        message: settings.message,
        content: encodeBase64Utf8(prettyJson()),
        branch: settings.branch,
        ...(sha ? { sha } : {})
      };
      await githubRequest('PUT', endpoint, settings.token, payload);
      setStatus('Готово: roster.json отправлен в GitHub. Подожди деплой Pages.');
    } catch (error) {
      setStatus(error.message || 'Не удалось отправить файл в GitHub.', true);
    }
  }

  async function initEditor() {
    const elements = getElements();
    if (!elements.form) return;
    editorReady = true;

    roster = await loadRoster();
    clearForm();
    renderList();
    loadGitHubSettings();

    elements.form.addEventListener('submit', submitForm);
    elements.cancelBtn.addEventListener('click', clearForm);
    elements.copyBtn.addEventListener('click', copyJson);
    elements.downloadBtn.addEventListener('click', downloadJson);
    elements.applyJsonBtn.addEventListener('click', applyJson);
    elements.resetBtn.addEventListener('click', resetDraft);
    elements.search.addEventListener('input', renderList);
    elements.updated.addEventListener('input', () => {
      roster.updated = elements.updated.value;
      saveDraft();
      syncJsonEditor();
    });

    [elements.ghOwner, elements.ghRepo, elements.ghBranch, elements.ghPath, elements.ghMessage, elements.ghToken, elements.ghRemember]
      .forEach((element) => element.addEventListener('input', saveGitHubSettings));
    elements.ghRemember.addEventListener('change', saveGitHubSettings);
    elements.pullGitHubBtn.addEventListener('click', pullFromGitHub);
    elements.pushGitHubBtn.addEventListener('click', pushToGitHub);
  }

  document.addEventListener('DOMContentLoaded', initAuth);
})();
