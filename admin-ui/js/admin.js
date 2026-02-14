var API = '/api/admin';

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Tabs
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

function showToast(message, type) {
  type = type || 'success';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
}

async function api(method, path, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(API + path, opts);
  return res.json();
}

function avatarHtml(u) {
  if (u.avatar) return '<img src="' + esc(u.avatar) + '" class="user-avatar">';
  var initial = (u.name || u.email || '?').charAt(0).toUpperCase();
  return '<div class="user-avatar-placeholder">' + esc(initial) + '</div>';
}

// Stats
async function loadStats() {
  var s = await api('GET', '/stats');
  document.getElementById('stats').innerHTML =
    '<div class="stat-card"><div class="stat-value">' + s.total_users + '</div><div class="stat-label">Total Users</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.active_users + '</div><div class="stat-label">Active</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.pending_users + '</div><div class="stat-label">Pending</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + s.blocked_users + '</div><div class="stat-label">Blocked</div></div>';
}

// Pending
async function loadPending() {
  var users = await api('GET', '/users/pending');
  var el = document.getElementById('pendingList');
  if (users.length === 0) {
    el.innerHTML = '<div class="empty-msg">No pending requests</div>';
    return;
  }
  el.innerHTML = users.map(function(u) {
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
        '<button class="btn btn-approve" onclick="updateStatus(' + u.id + ',\'active\')">Approve</button>' +
        '<button class="btn btn-block" onclick="updateStatus(' + u.id + ',\'blocked\')">Block</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// All users
async function loadUsers() {
  var users = await api('GET', '/users');
  var el = document.getElementById('usersList');
  el.innerHTML = users.map(function(u) {
    var p = u.protected;
    var actions = [];

    if (u.status === 'pending')  actions.push('<button class="btn btn-approve" onclick="updateStatus(' + u.id + ',\'active\')">Approve</button>');
    if (u.status === 'active' && !p)  actions.push('<button class="btn btn-block" onclick="updateStatus(' + u.id + ',\'blocked\')">Block</button>');
    if (u.status === 'blocked') actions.push('<button class="btn btn-approve" onclick="updateStatus(' + u.id + ',\'active\')">Unblock</button>');
    if (u.role === 'user')      actions.push('<button class="btn" onclick="updateRole(' + u.id + ',\'admin\')">Make Admin</button>');
    if (u.role === 'admin' && !p) actions.push('<button class="btn" onclick="updateRole(' + u.id + ',\'user\')">Remove Admin</button>');
    if (!p) actions.push('<button class="btn btn-danger" onclick="deleteUser(' + u.id + ')">Delete</button>');

    return '<div class="user-card">' +
      '<div class="user-card-top">' +
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

async function loadSettings() {
  var settings = await api('GET', '/settings');
  for (var key in settings) {
    var el = document.getElementById('set_' + key);
    if (el) el.value = settings[key];
  }
}

async function updateStatus(id, status) {
  var r = await api('PUT', '/users/' + id + '/status', { status: status });
  if (r.error) { showToast(r.error, 'error'); } else { showToast('User status updated'); }
  loadAll();
}
async function updateRole(id, role) {
  var r = await api('PUT', '/users/' + id + '/role', { role: role });
  if (r.error) { showToast(r.error, 'error'); } else { showToast('User role updated'); }
  loadAll();
}
async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  var r = await api('DELETE', '/users/' + id);
  if (r.error) { showToast(r.error, 'error'); } else { showToast('User deleted'); loadAll(); }
}
async function triggerBuild() {
  var res = await fetch('/api/rebuild', { method: 'POST' });
  var data = await res.json();
  if (data.success) { showToast('Build triggered'); } else { showToast('Build failed: ' + (data.error || 'unknown'), 'error'); }
}

document.getElementById('settingsForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k) { data[k] = v; });
  await api('PUT', '/settings', data);
  showToast('Settings saved');
});

function loadAll() { loadStats(); loadPending(); loadUsers(); loadSettings(); }
loadAll();
