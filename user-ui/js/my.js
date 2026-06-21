/* /my 페이지 로직 — 프로필 / 북마크 / 방문 기록 */
(function () {
  'use strict';

  function esc(s) { var d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

  function relTime(str) {
    var diff = Date.now() - new Date(str + (str.endsWith('Z') ? '' : 'Z')).getTime();
    var s = Math.floor(diff / 1000);
    if (s < 60) return '방금';
    var m = Math.floor(s / 60); if (m < 60) return m + '분 전';
    var h = Math.floor(m / 60); if (h < 24) return h + '시간 전';
    var d = Math.floor(h / 24); if (d < 7) return d + '일 전';
    return Math.floor(d / 7) + '주 전';
  }

  function apiFetch(url, opts) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  // ── 북마크 렌더 ──
  var bookmarks = [];

  function renderBookmarks() {
    var c = document.getElementById('bm-container');
    document.getElementById('bm-count').textContent = bookmarks.length;
    if (bookmarks.length === 0) {
      c.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div>북마크가 없습니다.</div>';
      return;
    }
    c.innerHTML = '<div class="card-list">' + bookmarks.map(function (b) {
      return '<div class="list-item" data-path="' + esc(b.page_path) + '">'
        + '<span class="item-icon">⭐</span>'
        + '<div class="item-body">'
        + '<a href="' + esc(b.page_path) + '" class="item-title" style="display:block;text-decoration:none;color:inherit">'
        + esc(b.page_title || b.page_path) + '</a>'
        + '<div class="item-path">' + esc(b.page_path) + '</div>'
        + '</div>'
        + '<button class="item-remove bm-remove-btn" data-path="' + esc(b.page_path) + '" title="북마크 해제">✕</button>'
        + '</div>';
    }).join('') + '</div>';

    c.querySelectorAll('.bm-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = btn.getAttribute('data-path');
        apiFetch('/api/me/bookmarks', { method: 'DELETE', body: JSON.stringify({ path: p }) })
          .then(function () {
            bookmarks = bookmarks.filter(function (b) { return b.page_path !== p; });
            renderBookmarks();
          });
      });
    });
  }

  // ── 히스토리 렌더 ──
  var historyList = [];

  function renderHistory() {
    var c = document.getElementById('his-container');
    document.getElementById('his-count').textContent = historyList.length;
    if (historyList.length === 0) {
      c.innerHTML = '<div class="empty-state"><div class="empty-icon">🕐</div>방문 기록이 없습니다.</div>';
      return;
    }
    c.innerHTML = '<div class="card-list">' + historyList.map(function (h) {
      return '<div class="list-item" data-path="' + esc(h.page_path) + '">'
        + '<span class="item-icon" style="color:#64748b">🕐</span>'
        + '<div class="item-body">'
        + '<a href="' + esc(h.page_path) + '" class="item-title" style="display:block;text-decoration:none;color:inherit">'
        + esc(h.page_title || h.page_path) + '</a>'
        + '<div class="item-path">' + esc(h.page_path) + '</div>'
        + '</div>'
        + '<span class="item-time">' + esc(relTime(h.viewed_at)) + '</span>'
        + '<button class="item-remove his-remove-btn" data-path="' + esc(h.page_path) + '" title="기록 삭제">✕</button>'
        + '</div>';
    }).join('') + '</div>';

    c.querySelectorAll('.his-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = btn.getAttribute('data-path');
        apiFetch('/api/me/history', { method: 'DELETE', body: JSON.stringify({ path: p }) })
          .then(function () {
            historyList = historyList.filter(function (h) { return h.page_path !== p; });
            renderHistory();
          });
      });
    });
  }

  // ── 히스토리 전체 삭제 ──
  document.getElementById('clear-history-btn').addEventListener('click', function () {
    if (!confirm('방문 기록을 모두 삭제할까요?')) return;
    apiFetch('/api/me/history', { method: 'DELETE' }).then(function () {
      historyList = [];
      renderHistory();
    });
  });

  // ── 초기 로드 ──
  // 1단계: 인증 확인
  fetch('/auth/me')
    .then(function (r) { return r.json(); })
    .then(function (auth) {
      if (!auth || !auth.authenticated) {
        window.location.href = '/login';
        return;
      }

      // 프로필 렌더
      var u = auth.user;
      document.getElementById('profile').style.display = 'flex';
      document.getElementById('profile-name').textContent = u.name || u.email;
      document.getElementById('profile-email').textContent = u.email;
      var roleEl = document.getElementById('profile-role');
      roleEl.textContent = u.role === 'admin' ? 'Admin' : 'Member';
      roleEl.className = 'badge profile-role ' + (u.role === 'admin' ? 'badge-admin' : 'badge-user');
      if (u.avatar) {
        var img = document.createElement('img');
        img.src = u.avatar; img.alt = ''; img.className = 'profile-avatar';
        img.onerror = function () { img.style.display = 'none'; };
        document.getElementById('avatar-placeholder').replaceWith(img);
      }

      // 사이트 제목 반영
      fetch('/api/settings').then(function (r) { return r.json(); }).then(function (s) {
        if (s.site_title) document.title = '내 페이지 — ' + s.site_title;
      }).catch(function () {});

      // 2단계: 데이터 로딩 (실패해도 로그인 redirect 안 함)
      Promise.all([
        apiFetch('/api/me/bookmarks'),
        apiFetch('/api/me/history'),
      ]).then(function (results) {
        bookmarks = (results[0] && results[0].bookmarks) || [];
        renderBookmarks();
        historyList = (results[1] && results[1].history) || [];
        renderHistory();
      }).catch(function () {
        // API 오류 시 빈 상태 유지 (로그인 redirect 안 함)
        renderBookmarks();
        renderHistory();
      });
    })
    .catch(function () {
      window.location.href = '/login';
    });
})();
