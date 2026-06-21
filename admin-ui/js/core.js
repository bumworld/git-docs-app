// Core utilities and shared functions for admin panel

export const API = '/api/admin';
export const BUILD_API = '/api';

// HTML escape utility
export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Copy text to clipboard with fallback for older browsers
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// Toast notification
export function showToast(message, type) {
  type = type || 'success';
  // Remove existing toasts to prevent overlap
  document.querySelectorAll('.toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.style.opacity = '1';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// API call helper
export async function api(method, path, body) {
  const opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

// Avatar HTML generation
export function avatarHtml(u) {
  if (u.avatar) return '<img src="' + esc(u.avatar) + '" class="user-avatar">';
  const initial = (u.name || u.email || '?').charAt(0).toUpperCase();
  return '<div class="user-avatar-placeholder">' + esc(initial) + '</div>';
}

// Date formatting
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z'));
  return d.toLocaleString();
}

// Duration formatting
export function formatDuration(ms) {
  if (!ms && ms !== 0) return '-';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

// Tab management (ARIA tablist + roving tabindex + 키보드 네비게이션)
export function initializeTabs(onTabChange) {
  const tabs = Array.from(document.querySelectorAll('.tab'));

  function activate(tab, opts) {
    opts = opts || {};
    tabs.forEach(t => {
      const selected = t === tab;
      t.classList.toggle('active', selected);
      t.setAttribute('aria-selected', selected ? 'true' : 'false');
      t.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (opts.focus) tab.focus();

    // 키보드 화살표 이동은 history 를 쌓지 않도록 replaceState 사용
    // (클릭/해시 진입은 기존대로 push 해 딥링크/Back 동작 유지).
    if (opts.replaceHash) {
      history.replaceState(null, '', '#' + tab.dataset.tab);
    } else {
      window.location.hash = tab.dataset.tab;
    }

    // Notify callback for special tab handling
    if (onTabChange) {
      onTabChange(tab.dataset.tab);
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', e => {
      let next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      activate(tabs[next], { focus: true, replaceHash: true });
    });
  });

  // Handle hash navigation
  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const tab = tabs.find(t => t.dataset.tab === hash);
      if (tab) activate(tab);
    }
  }

  window.addEventListener('hashchange', handleHash);
  handleHash();
}
