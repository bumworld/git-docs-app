var API = '/api/admin';
var BUILD_API = '/api';
var onlineEmails = new Set();

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Tabs
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'builds') {
      loadBuilds();
    }
  });
});

// Handle hash navigation (e.g. /admin#builds)
function handleHash() {
  var hash = window.location.hash.replace('#', '');
  if (hash) {
    var tab = document.querySelector('.tab[data-tab="' + hash + '"]');
    if (tab) tab.click();
  }
}
window.addEventListener('hashchange', handleHash);
handleHash();

function showToast(message, type) {
  type = type || 'success';
  // 기존 토스트 제거 (겹침 방지)
  document.querySelectorAll('.toast').forEach(function(el) { el.remove(); });
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.style.opacity = '1';
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
    if (u.status === 'active') actions.push('<button class="btn btn-primary" onclick="toggleDM(\'' + esc(u.email) + '\',this)">Message</button>');
    if (!p) actions.push('<button class="btn btn-danger" onclick="deleteUser(' + u.id + ')">Delete</button>');

    var isOnline = onlineEmails.has(u.email);

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
function toggleDM(email, btn) {
  // 이미 열린 DM 입력창이 있으면 닫기
  var card = btn.closest('.user-card');
  var existing = card.querySelector('.dm-form');
  if (existing) {
    existing.remove();
    return;
  }
  // 다른 카드의 DM 입력창 닫기
  document.querySelectorAll('.dm-form').forEach(function(el) { el.remove(); });

  var form = document.createElement('div');
  form.className = 'dm-form';
  form.innerHTML =
    '<input type="text" class="dm-input" placeholder="Enter message..." maxlength="500">' +
    '<button class="btn btn-primary dm-send-btn" onclick="sendDirectMessage(\'' + esc(email) + '\',this)">Send</button>';
  card.appendChild(form);

  var input = form.querySelector('.dm-input');
  input.focus();
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendDirectMessage(email, form.querySelector('.dm-send-btn'));
  });
}

async function sendDirectMessage(email, btn) {
  var form = btn.closest('.dm-form');
  var input = form.querySelector('.dm-input');
  var message = input.value.trim();
  if (!message) return;

  btn.disabled = true;
  try {
    var res = await fetch('/api/sse/message/' + encodeURIComponent(email), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });
    var data = await res.json();
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

async function triggerBuild() {
  var res = await fetch('/api/rebuild', { method: 'POST' });
  var data = await res.json();
  if (data.success) { showToast('Build triggered'); } else { showToast(data.error || 'Build failed', 'error'); }
}

document.getElementById('settingsForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k) { data[k] = v; });
  await api('PUT', '/settings', data);
  showToast('Settings saved');
});

// ===== Build Management =====

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z'));
  return d.toLocaleString();
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '-';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function truncateLog(log, lines) {
  if (!log) return '';
  var arr = log.split('\n');
  if (arr.length <= lines) return log;
  return arr.slice(0, lines).join('\n') + '\n... (' + arr.length + ' lines total)';
}

async function loadBuildStats() {
  try {
    var res = await fetch(BUILD_API + '/builds/stats');
    var s = await res.json();
    document.getElementById('buildStats').innerHTML =
      '<div class="stat-card"><div class="stat-value">' + s.total + '</div><div class="stat-label">Total Builds</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + s.success + '</div><div class="stat-label">Success</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + s.failed + '</div><div class="stat-label">Failed</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + formatDuration(s.avg_duration_ms) + '</div><div class="stat-label">Avg Duration</div></div>';
  } catch (e) { /* ignore */ }
}

async function loadBuilds() {
  var status = document.getElementById('filterStatus').value;
  var trigger = document.getElementById('filterTrigger').value;
  var query = '?limit=50';
  if (status) query += '&status=' + status;
  if (trigger) query += '&trigger_type=' + trigger;

  try {
    var res = await fetch(BUILD_API + '/builds' + query);
    var data = await res.json();
    renderBuilds(data.builds || []);
    // Also refresh stats
    loadBuildStats();
  } catch (e) {
    document.getElementById('buildsList').innerHTML = '<div class="empty-msg">Failed to load builds</div>';
  }
}

function renderBuilds(builds) {
  var el = document.getElementById('buildsList');
  if (builds.length === 0) {
    el.innerHTML = '<div class="empty-msg">No builds found</div>';
    return;
  }
  el.innerHTML = builds.map(function(b) {
    var failedCount = b.failed_files ? b.failed_files.length : 0;
    var failedBadge = failedCount > 0
      ? '<span class="badge badge-failed">' + failedCount + (failedCount >= 100 ? '+' : '') + ' failed files</span>'
      : '';

    return '<div class="build-card">' +
      '<div class="build-card-top">' +
        '<div class="build-card-info">' +
          '<span class="build-id">#' + b.id + '</span>' +
          '<span class="badge badge-' + esc(b.status) + '">' + esc(b.status) + '</span>' +
          '<span class="badge badge-trigger-' + esc(b.trigger_type) + '">' + esc(b.trigger_type) + '</span>' +
          failedBadge +
        '</div>' +
        '<div class="build-card-meta">' +
          '<span>' + esc(b.triggered_by || '-') + '</span>' +
          '<span>' + formatDate(b.started_at) + '</span>' +
          '<span>' + formatDuration(b.duration_ms) + '</span>' +
        '</div>' +
      '</div>' +
      (b.log_preview ? '<pre class="build-log-preview">' + esc(truncateLog(b.log_preview, 10)) + '</pre>' : '') +
      '<div class="build-card-actions">' +
        '<a href="/admin/build-detail.html?id=' + b.id + '" class="btn">View Full Log</a>' +
        '<button class="btn" onclick="copyBuildJsonFromList(' + b.id + ')">Copy JSON</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function copyBuildJsonFromList(id) {
  try {
    var res = await fetch(BUILD_API + '/builds/' + id);
    var build = await res.json();
    var json = JSON.stringify({
      id: build.id,
      status: build.status,
      trigger_type: build.trigger_type,
      triggered_by: build.triggered_by,
      started_at: build.started_at,
      finished_at: build.finished_at,
      duration_ms: build.duration_ms,
      failed_files: build.failed_files || [],
      log: build.log || ''
    }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      showToast('JSON copied to clipboard');
    } catch (e) {
      var ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('JSON copied to clipboard');
    }
  } catch (e) {
    showToast('Failed to copy', 'error');
  }
}

async function triggerBuildFromTab() {
  var btn = document.getElementById('buildRunBtn');
  btn.disabled = true;
  btn.textContent = 'Building...';
  showBuildProgress(true);

  try {
    var res = await fetch('/api/rebuild', { method: 'POST' });
    var data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Run Build';
      showBuildProgress(false);
      return;
    }
    showToast('Build triggered');
    // SSE가 build:complete 이벤트를 전달하므로 폴링 불필요
  } catch (e) {
    showToast('Failed to trigger build', 'error');
    btn.disabled = false;
    btn.textContent = 'Run Build';
    showBuildProgress(false);
  }
}

function showBuildProgress(show) {
  var el = document.getElementById('buildProgress');
  el.style.display = show ? 'flex' : 'none';
}

// ===== SSE: Real-time Events =====
var evtSource = null;

function connectSSE() {
  if (evtSource) {
    evtSource.close();
  }

  evtSource = new EventSource('/api/sse');

  evtSource.addEventListener('connected', function(e) {
    var data = JSON.parse(e.data);
    console.log('[SSE] Connected', data);
    // 현재 빌드 중이면 UI 동기화
    if (data.building) {
      var btn = document.getElementById('buildRunBtn');
      btn.disabled = true;
      btn.textContent = 'Building...';
      showBuildProgress(true);
    }
    // 접속자 수 초기화
    updateOnlineCounts(data.clientCount, data.userCount);
    // 초기 접속자 목록 로드
    fetchOnlineUsers();
  });

  evtSource.addEventListener('build:start', function(e) {
    var data = JSON.parse(e.data);
    console.log('[SSE] Build started:', data);
    var btn = document.getElementById('buildRunBtn');
    btn.disabled = true;
    btn.textContent = 'Building...';
    showBuildProgress(true);
  });

  evtSource.addEventListener('build:complete', function(e) {
    var data = JSON.parse(e.data);
    console.log('[SSE] Build complete:', data);
    var btn = document.getElementById('buildRunBtn');
    btn.disabled = false;
    btn.textContent = 'Run Build';
    showBuildProgress(false);

    if (data.success) {
      showToast('Build completed (' + formatDuration(data.durationMs) + ')');
    } else {
      showToast('Build failed', 'error');
    }

    // 빌드 탭이 활성화되어 있으면 목록 갱신
    var buildsTab = document.querySelector('.tab[data-tab="builds"]');
    if (buildsTab && buildsTab.classList.contains('active')) {
      loadBuilds();
    }
  });

  evtSource.addEventListener('clients:update', function(e) {
    var data = JSON.parse(e.data);
    updateOnlineCounts(data.count, data.userCount);
    renderOnlineUsers(data.users);
    updateOnlineDots(data.users);
  });

  evtSource.addEventListener('admin:message', function(e) {
    var data = JSON.parse(e.data);
    showToast(data.sender + ': ' + data.message, 'admin');
  });

  evtSource.addEventListener('error', function() {
    console.log('[SSE] Connection lost, reconnecting...');
  });
}

function updateOnlineCounts(connCount, userCount) {
  var connEl = document.getElementById('onlineConnCount');
  var userEl = document.getElementById('onlineUserCount');
  if (connEl) connEl.textContent = connCount + ' connections';
  if (userEl) userEl.textContent = userCount + ' users';
}

async function fetchOnlineUsers() {
  try {
    var res = await fetch('/api/sse/clients');
    var data = await res.json();
    updateOnlineCounts(data.count, data.userCount);
    renderOnlineUsers(data.users);
    updateOnlineDots(data.users);
  } catch (e) { /* ignore */ }
}

function updateOnlineDots(users) {
  // onlineEmails 갱신
  onlineEmails.clear();
  if (users) {
    users.forEach(function(u) { onlineEmails.add(u.email); });
  }
  // Users 탭의 모든 dot 업데이트
  document.querySelectorAll('[data-online-dot]').forEach(function(dot) {
    var email = dot.getAttribute('data-online-dot');
    if (onlineEmails.has(email)) {
      dot.classList.remove('offline');
    } else {
      dot.classList.add('offline');
    }
  });
}

function renderOnlineUsers(users) {
  var el = document.getElementById('onlineUsers');
  if (!el) return;
  if (!users || users.length === 0) {
    el.innerHTML = '<div class="empty-msg">No users online</div>';
    return;
  }
  el.innerHTML = users.map(function(u) {
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

async function sendAdminMessage() {
  var input = document.getElementById('adminMessage');
  var message = input.value.trim();
  if (!message) return;

  var btn = document.getElementById('sendMsgBtn');
  btn.disabled = true;

  try {
    var res = await fetch('/api/sse/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });
    var data = await res.json();
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

// Enter 키로 메시지 발송
document.getElementById('adminMessage').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendAdminMessage();
});

// SSE 연결 시작
connectSSE();

function loadAll() { loadStats(); loadPending(); loadUsers(); loadSettings(); }
loadAll();
