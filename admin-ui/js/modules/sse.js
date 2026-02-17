// SSE (Server-Sent Events) real-time communication module

import { esc, showToast, formatDuration } from '../core.js';

export const onlineEmails = new Set();
let evtSource = null;

export function connectSSE() {
  if (evtSource) {
    evtSource.close();
  }

  evtSource = new EventSource('/api/sse');

  evtSource.addEventListener('connected', e => {
    const data = JSON.parse(e.data);
    console.log('[SSE] Connected', data);
    // Sync UI if build is running
    if (data.building) {
      const btn = document.getElementById('buildRunBtn');
      btn.disabled = true;
      btn.textContent = 'Building...';
      if (window.adminModules && window.adminModules.builds) {
        window.adminModules.builds.showBuildProgress(true);
      }
    }
    // Initialize online counts
    updateOnlineCounts(data.clientCount, data.userCount);
    // Load initial online users
    fetchOnlineUsers();
  });

  evtSource.addEventListener('build:start', e => {
    const data = JSON.parse(e.data);
    console.log('[SSE] Build started:', data);
    const btn = document.getElementById('buildRunBtn');
    btn.disabled = true;
    btn.textContent = 'Building...';
    if (window.adminModules && window.adminModules.builds) {
      window.adminModules.builds.showBuildProgress(true);
    }
  });

  evtSource.addEventListener('build:complete', e => {
    const data = JSON.parse(e.data);
    console.log('[SSE] Build complete:', data);
    const btn = document.getElementById('buildRunBtn');
    btn.disabled = false;
    btn.textContent = 'Run Build';
    if (window.adminModules && window.adminModules.builds) {
      window.adminModules.builds.showBuildProgress(false);
    }

    if (data.success) {
      showToast('Build completed (' + formatDuration(data.durationMs) + ')');
    } else {
      showToast('Build failed', 'error');
    }

    // Refresh builds list if on builds tab
    const buildsTab = document.querySelector('.tab[data-tab="builds"]');
    if (buildsTab && buildsTab.classList.contains('active')) {
      if (window.adminModules && window.adminModules.builds) {
        window.adminModules.builds.loadBuilds();
      }
    }
  });

  evtSource.addEventListener('clients:update', e => {
    const data = JSON.parse(e.data);
    updateOnlineCounts(data.count, data.userCount);
    renderOnlineUsers(data.users);
    updateOnlineDots(data.users);
  });

  evtSource.addEventListener('admin:message', e => {
    const data = JSON.parse(e.data);
    showToast(data.sender + ': ' + data.message, 'admin');
  });

  evtSource.addEventListener('error', () => {
    console.log('[SSE] Connection lost, reconnecting...');
  });
}

export function updateOnlineCounts(connCount, userCount) {
  const connEl = document.getElementById('onlineConnCount');
  const userEl = document.getElementById('onlineUserCount');
  if (connEl) connEl.textContent = connCount + ' connections';
  if (userEl) userEl.textContent = userCount + ' users';
}

export async function fetchOnlineUsers() {
  try {
    const res = await fetch('/api/sse/clients');
    const data = await res.json();
    updateOnlineCounts(data.count, data.userCount);
    renderOnlineUsers(data.users);
    updateOnlineDots(data.users);
  } catch (e) {
    // Ignore errors
  }
}

export function updateOnlineDots(users) {
  // Update onlineEmails set
  onlineEmails.clear();
  if (users) {
    users.forEach(u => onlineEmails.add(u.email));
  }
  // Update all online dots in Users tab
  document.querySelectorAll('[data-online-dot]').forEach(dot => {
    const email = dot.getAttribute('data-online-dot');
    if (onlineEmails.has(email)) {
      dot.classList.remove('offline');
    } else {
      dot.classList.add('offline');
    }
  });
}

export function renderOnlineUsers(users) {
  const el = document.getElementById('onlineUsers');
  if (!el) return;
  if (!users || users.length === 0) {
    el.innerHTML = '<div class="empty-msg">No users online</div>';
    return;
  }
  el.innerHTML = users.map(u => {
    return '<div class="user-card" style="padding:0.625rem 1rem">' +
      '<div class="user-card-top" style="margin-bottom:0">' +
        '<span class="online-dot"></span>' +
        (u.avatar ? '<img src="' + esc(u.avatar) + '" class="user-avatar">' :
          '<div class="user-avatar-placeholder">' + esc((u.name || u.email || '?').charAt(0).toUpperCase()) + '</div>') +
        '<div class="user-detail">' +
          '<div class="user-detail-name">' + esc(u.name || '-') + '</div>' +
          '<div class="user-detail-email">' + esc(u.email) + '</div>' +
        '</div>' +
        '<span class="badge badge-' + esc(u.role) + '">' + esc(u.role) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

export async function sendAdminMessage() {
  const input = document.getElementById('adminMessage');
  const message = input.value.trim();
  if (!message) return;

  const btn = document.getElementById('sendMsgBtn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/sse/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
    } else {
      input.value = '';
      showToast('Message sent');
    }
  } catch (e) {
    showToast('Failed to send message', 'error');
  } finally {
    btn.disabled = false;
  }
}

// Initialize message send on Enter key
export function initializeMessageHandler() {
  const input = document.getElementById('adminMessage');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendAdminMessage();
    });
  }
}
