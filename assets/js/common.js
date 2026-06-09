(() => {
  'use strict';

  const themeKey = 'osn-grom-theme';
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

  function initTheme() {
    const toggle = $('#themeToggle');
    const saved = localStorage.getItem(themeKey);
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    const theme = saved || (prefersLight ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;

    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(themeKey, nextTheme);
    });
  }

  function initActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) link.classList.add('is-active');
    });
  }

  function initFooterYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initActiveNav();
    initFooterYear();
  });
})();
