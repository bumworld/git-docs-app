// Core utilities and shared functions for admin panel

export const API = '/api/admin';
export const BUILD_API = '/api';

// HTML escape utility
export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
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

// Tab management
export function initializeTabs(onTabChange) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      window.location.hash = tab.dataset.tab;

      // Notify callback for special tab handling
      if (onTabChange) {
        onTabChange(tab.dataset.tab);
      }
    });
  });

  // Handle hash navigation
  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const tab = document.querySelector('.tab[data-tab="' + hash + '"]');
      if (tab) tab.click();
    }
  }

  window.addEventListener('hashchange', handleHash);
  handleHash();
}
