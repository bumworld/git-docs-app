// Settings management module

import { api, showToast } from '../core.js';

export async function loadSettings() {
  const settings = await api('GET', '/settings');
  for (const key in settings) {
    const el = document.getElementById('set_' + key);
    if (el) el.value = settings[key];
  }
}

export function initializeSettingsForm() {
  const form = document.getElementById('settingsForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    await api('PUT', '/settings', data);
    showToast('Settings saved');
  });
}
