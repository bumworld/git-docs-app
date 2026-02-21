document.addEventListener('DOMContentLoaded', function() {
  function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  fetch('/auth/me')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.authenticated) return;
      var u = data.user;
      var btnHtml = '<a href="/my" data-astro-reload class="auth-btn">My</a>'
        + '<a href="/auth/logout" class="auth-btn">Logout</a>';
      if (u.role === 'admin') btnHtml += '<a href="/admin" data-astro-reload class="auth-btn auth-btn-admin">Admin</a>';
      var nameHtml = '<span class="auth-name">' + esc(u.name || u.email) + '</span>';
      if (u.avatar) nameHtml = '<img src="' + esc(u.avatar) + '" alt="" class="auth-avatar"/>' + nameHtml;

      var el = document.createElement('div');
      el.className = 'auth-bar';
      el.innerHTML = nameHtml + btnHtml;

      var rightGroup = document.querySelector('.header .right-group');
      if (rightGroup) {
        rightGroup.insertBefore(el, rightGroup.firstChild);
      }

      // SSE 연결: 빌드 알림 + 관리자 메시지 수신
      connectSSE();
    })
    .catch(function() {});

  // ===== SSE: 실시간 알림 =====
  function connectSSE() {
    // admin 페이지에서는 admin.js가 별도 SSE를 관리하므로 제외
    if (window.location.pathname.startsWith('/admin')) return;

    var evtSource = new EventSource('/api/sse');

    evtSource.addEventListener('build:start', function() {
      showNotification('Wiki is rebuilding...', 'info');
    });

    evtSource.addEventListener('build:complete', function(e) {
      var data = JSON.parse(e.data);
      if (data.success) {
        showNotification('Wiki updated. Refresh for latest content.', 'success', true);
      } else {
        showNotification('Build failed.', 'error');
      }
    });

    evtSource.addEventListener('admin:message', function(e) {
      var data = JSON.parse(e.data);
      showNotification(data.sender + ': ' + data.message, 'admin');
    });

    evtSource.addEventListener('error', function() {
      // EventSource 자동 재연결 - 별도 처리 불필요
    });
  }

  // ===== 알림 토스트 =====
  function showNotification(message, type, showRefresh) {
    // 기존 알림 제거
    var existing = document.querySelectorAll('.sse-toast');
    existing.forEach(function(el) { el.remove(); });

    var toast = document.createElement('div');
    toast.className = 'sse-toast sse-toast-' + type;
    toast.textContent = message;

    if (showRefresh) {
      var btn = document.createElement('button');
      btn.textContent = 'Refresh';
      btn.className = 'sse-toast-btn';
      btn.onclick = function() { location.reload(); };
      toast.appendChild(btn);
    }

    document.body.appendChild(toast);

    // 자동 사라짐 (refresh 버튼이 있으면 더 오래 유지)
    var duration = showRefresh ? 10000 : 4000;
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  }

  // 토스트 스타일 주입 (wiki 페이지에는 admin.css가 없으므로)
  var style = document.createElement('style');
  style.textContent = [
    '.sse-toast { position:fixed; bottom:1.5rem; right:1.5rem; padding:0.75rem 1.25rem;',
    '  border-radius:8px; font-size:0.875rem; z-index:10000; transition:opacity 0.3s;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '  display:flex; align-items:center; gap:0.75rem; max-width:420px; }',
    '.sse-toast-success { background:#064e3b; color:#6ee7b7; border:1px solid #059669; }',
    '.sse-toast-error { background:#7f1d1d; color:#fca5a5; border:1px solid #dc2626; }',
    '.sse-toast-info { background:#1e3a5f; color:#93c5fd; border:1px solid #3b82f6; }',
    '.sse-toast-admin { background:#312e81; color:#a5b4fc; border:1px solid #4338ca; }',
    '.sse-toast-btn { background:none; border:1px solid currentColor; color:inherit;',
    '  padding:0.2rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.8rem;',
    '  white-space:nowrap; }',
    '.sse-toast-btn:hover { opacity:0.8; }',
  ].join('\n');
  document.head.appendChild(style);
});
