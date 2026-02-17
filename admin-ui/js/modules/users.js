// User management module

import { api, esc, avatarHtml, showToast } from '../core.js';

// Stats
export async function loadStats() {
  const s = await api('GET', '/stats');
  document.getElementById('stats').innerHTML =
    '<div class="stat-card"><div class="stat-value">' + s.total_users + '</div><div class="stat-label">Total Users</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.active_users + '</div><div class="stat-label">Active</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.pending_users + '</div><div class="stat-label">Pending</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.blocked_users + '</div><div class="stat-label">Blocked</div></div>';
}

// Pending users
export async function loadPending() {
  const users = await api('GET', '/users/pending');
  const el = document.getElementById('pendingList');
  if (users.length === 0) {
    el.innerHTML = '<div class="empty-msg">No pending requests</div>';
    return;
  }
  el.innerHTML = users.map(u => {
    return '<div class="user-card">' +
      '<div class="user-card-top">' +
        avatarHtml(u) +
        '<div class="user-detail">' +
          '<div class="user-detail-name">' + esc(u.name || '-') + '</div>' +
          '<div class="user-detail-email">' + esc(u.email) + '</div>' +
        '</div>' +
        '<div class="user-badges"><span class="badge badge-pending">pending</span></div>' +
      '</div>' +
      '<div class="user-card-actions">' +
        '<button class="btn btn-approve" onclick="window.adminModules.users.updateStatus(' + u.id + ',\'active\')">Approve</button>' +
        '<button class="btn btn-block" onclick="window.adminModules.users.updateStatus(' + u.id + ',\'blocked\')">Block</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// All users (note: onlineEmails will be managed by SSE module)
export async function loadUsers(onlineEmails) {
  const users = await api('GET', '/users');
  const el = document.getElementById('usersList');
  el.innerHTML = users.map(u => {
    const p = u.protected;
    const actions = [];

    if (u.status === 'pending') actions.push('<button class="btn btn-approve" onclick="window.adminModules.users.updateStatus(' + u.id + ',\'active\')">Approve</button>');
    if (u.status === 'active' && !p) actions.push('<button class="btn btn-block" onclick="window.adminModules.users.updateStatus(' + u.id + ',\'blocked\')">Block</button>');
    if (u.status === 'blocked') actions.push('<button class="btn btn-approve" onclick="window.adminModules.users.updateStatus(' + u.id + ',\'active\')">Unblock</button>');
    if (u.role === 'user') actions.push('<button class="btn" onclick="window.adminModules.users.updateRole(' + u.id + ',\'admin\')">Make Admin</button>');
    if (u.role === 'admin' && !p) actions.push('<button class="btn" onclick="window.adminModules.users.updateRole(' + u.id + ',\'user\')">Remove Admin</button>');
    if (u.status === 'active') actions.push('<button class="btn btn-primary" onclick="window.adminModules.users.toggleDM(\'' + esc(u.email) + '\',this)">Message</button>');
    if (!p) actions.push('<button class="btn btn-danger" onclick="window.adminModules.users.deleteUser(' + u.id + ')">Delete</button>');

    const isOnline = onlineEmails && onlineEmails.has(u.email);

    return '<div class="user-card" id="user-card-' + u.id + '" data-email="' + esc(u.email) + '">' +
      '<div class="user-card-top">' +
        '<span class="online-dot' + (isOnline ? '' : ' offline') + '" data-online-dot="' + esc(u.email) + '"></span>' +
        avatarHtml(u) +
        '<div class="user-detail">' +
          '<div class="user-detail-name">' + esc(u.name || '-') + '</div>' +
          '<div class="user-detail-email">' + esc(u.email) + '</div>' +
        '</div>' +
        '<div class="user-badges">' +
          '<span class="badge badge-' + esc(u.role) + '">' + esc(u.role) + '</span>' +
          '<span class="badge badge-' + esc(u.status) + '">' + esc(u.status) + '</span>' +
          (p ? '<span class="badge badge-protected">protected</span>' : '') +
        '</div>' +
      '</div>' +
      (actions.length > 0
        ? '<div class="user-card-actions">' + actions.join('') + '</div>'
        : '') +
    '</div>';
  }).join('');
}

export async function updateStatus(id, status) {
  const r = await api('PUT', '/users/' + id + '/status', { status: status });
  if (r.error) {
    showToast(r.error, 'error');
  } else {
    showToast('User status updated');
  }
  // Reload all data
  if (window.adminModules && window.adminModules.loadAll) {
    window.adminModules.loadAll();
  }
}

export async function updateRole(id, role) {
  const r = await api('PUT', '/users/' + id + '/role', { role: role });
  if (r.error) {
    showToast(r.error, 'error');
  } else {
    showToast('User role updated');
  }
  if (window.adminModules && window.adminModules.loadAll) {
    window.adminModules.loadAll();
  }
}

export async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  const r = await api('DELETE', '/users/' + id);
  if (r.error) {
    showToast(r.error, 'error');
  } else {
    showToast('User deleted');
    if (window.adminModules && window.adminModules.loadAll) {
      window.adminModules.loadAll();
    }
  }
}

export function toggleDM(email, btn) {
  // Close existing DM form in the same card
  const card = btn.closest('.user-card');
  const existing = card.querySelector('.dm-form');
  if (existing) {
    existing.remove();
    return;
  }
  // Close DM forms in other cards
  document.querySelectorAll('.dm-form').forEach(el => el.remove());

  const form = document.createElement('div');
  form.className = 'dm-form';
  form.innerHTML =
    '<input type="text" class="dm-input" placeholder="Enter message..." maxlength="500">' +
    '<button class="btn btn-primary dm-send-btn" onclick="window.adminModules.users.sendDirectMessage(\'' + esc(email) + '\',this)">Send</button>';
  card.appendChild(form);

  const input = form.querySelector('.dm-input');
  input.focus();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendDirectMessage(email, form.querySelector('.dm-send-btn'));
  });
}

export async function sendDirectMessage(email, btn) {
  const form = btn.closest('.dm-form');
  const input = form.querySelector('.dm-input');
  const message = input.value.trim();
  if (!message) return;

  btn.disabled = true;
  try {
    const res = await fetch('/api/sse/message/' + encodeURIComponent(email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });
    const data = await res.json();
    if (data.offline) {
      showToast('User is not online', 'error');
    } else if (data.success) {
      showToast('Message sent to ' + email);
      form.remove();
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Failed to send', 'error');
  } finally {
    btn.disabled = false;
  }
}
