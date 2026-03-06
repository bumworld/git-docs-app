(function () {
  'use strict';

  var EXCLUDED_PREFIXES = ['/login', '/pending', '/admin'];
  var LS_BM_OPEN  = 'uf-bookmarks-open';
  var LS_HIS_OPEN = 'uf-history-open';

  // ─── 유틸 ───────────────────────────────────────────

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function normalizePath(path) {
    return path.replace(/\/$/, '') || '/';
  }

  function isExcluded(path) {
    return EXCLUDED_PREFIXES.some(function (p) { return path.startsWith(p); });
  }

  function getPageTitle() {
    var h1 = document.querySelector('.sl-markdown-content h1') || document.querySelector('h1');
    if (h1) return h1.textContent.trim();
    var t = document.title;
    return t.includes('|') ? t.split('|')[0].trim() : t.trim();
  }

  function relTime(dateStr) {
    var diff = Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).getTime();
    var s = Math.floor(diff / 1000);
    if (s < 60)  return '방금';
    var m = Math.floor(s / 60);
    if (m < 60)  return m + '분 전';
    var h = Math.floor(m / 60);
    if (h < 24)  return h + '시간 전';
    var d = Math.floor(h / 24);
    if (d < 7)   return d + '일 전';
    return Math.floor(d / 7) + '주 전';
  }

  function apiFetch(url, opts) {
    return fetch(url, Object.assign(
      { headers: { 'Content-Type': 'application/json' } },
      opts
    )).then(function (r) { return r.ok ? r.json() : null; });
  }

  // ─── 상태 ───────────────────────────────────────────

  var state = { bookmarks: [], history: [], isBookmarked: false };
  var currentPath = '';

  // ─── 정리 ───────────────────────────────────────────

  function cleanup() {
    ['#uf-sidebar-panel', '.toc-bookmark-btn', '.toc-bookmark-btn-mobile']
      .forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) { el.remove(); });
      });
  }

  // ─── 초기화 ─────────────────────────────────────────

  function init() {
    currentPath = normalizePath(window.location.pathname);
    if (isExcluded(currentPath)) return;
    cleanup();

    fetch('/auth/me')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.authenticated) return null;

        // 페이지 뷰 기록 (응답 기다리지 않음)
        apiFetch('/api/me/history', {
          method: 'POST',
          body: JSON.stringify({ path: currentPath, title: getPageTitle() }),
        });

        return Promise.all([
          apiFetch('/api/me/bookmarks'),
          apiFetch('/api/me/history'),
        ]);
      })
      .then(function (results) {
        if (!results) return;
        state.bookmarks  = (results[0] && results[0].bookmarks) || [];
        state.history    = (results[1] && results[1].history)   || [];
        state.isBookmarked = state.bookmarks.some(function (b) {
          return b.page_path === currentPath;
        });
        renderBookmarkButton();
        renderSidebarPanel();
      })
      .catch(function () {});
  }

  // ─── 북마크 버튼 (우측 TOC) ─────────────────────────

  var STAR_FILLED = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  var STAR_OUTLINE = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  function updateBtnContent(btn, bookmarked) {
    var mobile = btn.classList.contains('toc-bookmark-btn-mobile');
    btn.classList.toggle('bookmarked', bookmarked);
    btn.setAttribute('aria-label', bookmarked ? '북마크 제거' : '북마크 추가');
    btn.title = bookmarked ? '북마크 제거' : '북마크 추가';
    if (mobile) {
      btn.innerHTML = bookmarked ? STAR_FILLED : STAR_OUTLINE;
    } else {
      btn.innerHTML = (bookmarked ? STAR_FILLED : STAR_OUTLINE)
        + '<span>' + (bookmarked ? '북마크됨' : '북마크') + '</span>';
    }
  }

  function handleBookmarkToggle(e) {
    e.preventDefault();
    var title = getPageTitle();
    if (state.isBookmarked) {
      apiFetch('/api/me/bookmarks', {
        method: 'DELETE',
        body: JSON.stringify({ path: currentPath }),
      }).then(function () {
        state.isBookmarked = false;
        state.bookmarks = state.bookmarks.filter(function (b) {
          return b.page_path !== currentPath;
        });
        refreshBookmarkButtons();
        refreshBookmarkList();
      });
    } else {
      apiFetch('/api/me/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ path: currentPath, title: title }),
      }).then(function () {
        state.isBookmarked = true;
        state.bookmarks.unshift({
          page_path: currentPath,
          page_title: title,
          created_at: new Date().toISOString(),
        });
        refreshBookmarkButtons();
        refreshBookmarkList();
      });
    }
  }

  function makeBookmarkBtn(mobile) {
    var btn = document.createElement('button');
    btn.className = mobile ? 'toc-bookmark-btn-mobile' : 'toc-bookmark-btn';
    btn.setAttribute('type', 'button');
    updateBtnContent(btn, state.isBookmarked);
    btn.addEventListener('click', handleBookmarkToggle);
    return btn;
  }

  function renderBookmarkButton() {
    var isDesktop = window.matchMedia('(min-width: 72rem)').matches;
    // 반대편 버튼 제거
    if (!isDesktop) {
      document.querySelectorAll('.toc-bookmark-btn').forEach(function(el) { el.remove(); });
      document.querySelectorAll('.toc-bookmark-btn-mobile').forEach(function(el) { el.remove(); });
      var summary = document.querySelector('#starlight__on-this-page--mobile');
      if (summary) summary.appendChild(makeBookmarkBtn(true));
    } else {
      document.querySelectorAll('.toc-bookmark-btn-mobile').forEach(function(el) { el.remove(); });
      document.querySelectorAll('.toc-bookmark-btn').forEach(function(el) { el.remove(); });
      var rightSidebar = document.querySelector('.right-sidebar-container .right-sidebar');
      if (!rightSidebar) return;
      var btn = makeBookmarkBtn(false);
      // print 버튼 앞에 삽입, 없으면 h2 다음에
      var printBtn = rightSidebar.querySelector('.toc-print-btn');
      var h2 = rightSidebar.querySelector('h2');
      if (printBtn) {
        printBtn.insertAdjacentElement('beforebegin', btn);
      } else if (h2) {
        h2.insertAdjacentElement('afterend', btn);
      } else {
        rightSidebar.insertBefore(btn, rightSidebar.firstChild);
      }
    }
  }

  function refreshBookmarkButtons() {
    document.querySelectorAll('.toc-bookmark-btn, .toc-bookmark-btn-mobile')
      .forEach(function (btn) { updateBtnContent(btn, state.isBookmarked); });
  }

  // ─── 사이드바 패널 (좌측, PC 전용) ─────────────────

  function renderSidebarPanel() {
    if (!window.matchMedia('(min-width: 72rem)').matches) return;
    var sidebar = document.querySelector('#starlight__sidebar');
    if (!sidebar) return;

    var panel = document.createElement('div');
    panel.id = 'uf-sidebar-panel';
    panel.innerHTML = buildPanelHTML();
    sidebar.appendChild(panel);

    bindPanelEvents(panel);
  }

  var SIDEBAR_LIMIT = 5;

  function bookmarkListHTML() {
    if (state.bookmarks.length === 0) {
      return '<p class="uf-empty">북마크가 없습니다.</p>';
    }
    var shown = state.bookmarks.slice(0, SIDEBAR_LIMIT);
    var remaining = state.bookmarks.length - SIDEBAR_LIMIT;
    var html = shown.map(function (b) {
      var active = b.page_path === currentPath ? ' uf-item-active' : '';
      return '<a href="' + esc(b.page_path) + '" class="uf-item' + active + '">'
        + '<span class="uf-item-title">' + esc(b.page_title || b.page_path) + '</span>'
        + '</a>';
    }).join('');
    if (remaining > 0) {
      html += '<a href="/my" class="uf-more-link" data-astro-reload>' + remaining + '개 더 보기 →</a>';
    }
    return html;
  }

  function historyListHTML() {
    if (state.history.length === 0) {
      return '<p class="uf-empty">기록이 없습니다.</p>';
    }
    var shown = state.history.slice(0, SIDEBAR_LIMIT);
    var remaining = state.history.length - SIDEBAR_LIMIT;
    var html = shown.map(function (h) {
      var active = h.page_path === currentPath ? ' uf-item-active' : '';
      return '<a href="' + esc(h.page_path) + '" class="uf-item' + active + '">'
        + '<span class="uf-item-title">' + esc(h.page_title || h.page_path) + '</span>'
        + '<span class="uf-item-time">' + esc(relTime(h.viewed_at)) + '</span>'
        + '</a>';
    }).join('');
    if (remaining > 0) {
      html += '<a href="/my" class="uf-more-link" data-astro-reload>' + remaining + '개 더 보기 →</a>';
    }
    return html;
  }

  function buildPanelHTML() {
    var bmOpen  = localStorage.getItem(LS_BM_OPEN)  !== '0';
    var hisOpen = localStorage.getItem(LS_HIS_OPEN) !== '0';

    return '<div class="uf-panel-inner">'
      // 북마크 섹션
      + '<details class="uf-section" id="uf-bm-section"' + (bmOpen ? ' open' : '') + '>'
      + '<summary class="uf-section-header">'
      + STAR_FILLED + ' 북마크'
      + '<span class="uf-count">' + state.bookmarks.length + '</span>'
      + '</summary>'
      + '<div class="uf-section-body" id="uf-bm-list">' + bookmarkListHTML() + '</div>'
      + '</details>'
      // 히스토리 섹션
      + '<details class="uf-section" id="uf-his-section"' + (hisOpen ? ' open' : '') + '>'
      + '<summary class="uf-section-header">'
      + '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm-1 5v5.41l3.3 3.29 1.4-1.41-2.7-2.7V8H12z"/></svg>'
      + ' 최근 본 페이지'
      + '<button class="uf-clear-btn" id="uf-clear-btn" title="히스토리 지우기" type="button">✕</button>'
      + '</summary>'
      + '<div class="uf-section-body">' + historyListHTML() + '</div>'
      + '</details>'
      + '<a href="/my" class="uf-my-link" data-astro-reload>'
      + '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>'
      + '내 페이지 전체 보기'
      + '<svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="margin-left:auto"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>'
      + '</a>'
      + '</div>';
  }

  function bindPanelEvents(panel) {
    // 접힘 상태 저장
    var bmSection = panel.querySelector('#uf-bm-section');
    if (bmSection) {
      bmSection.addEventListener('toggle', function () {
        localStorage.setItem(LS_BM_OPEN, bmSection.open ? '1' : '0');
      });
    }
    var hisSection = panel.querySelector('#uf-his-section');
    if (hisSection) {
      hisSection.addEventListener('toggle', function () {
        localStorage.setItem(LS_HIS_OPEN, hisSection.open ? '1' : '0');
      });
    }

    // 히스토리 지우기
    var clearBtn = panel.querySelector('#uf-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.stopPropagation(); // details 토글 방지
        apiFetch('/api/me/history', { method: 'DELETE' }).then(function () {
          state.history = [];
          var body = panel.querySelector('#uf-his-section .uf-section-body');
          if (body) body.innerHTML = historyListHTML();
        });
      });
    }
  }

  function refreshBookmarkList() {
    var list = document.getElementById('uf-bm-list');
    if (list) list.innerHTML = bookmarkListHTML();
    var count = document.querySelector('#uf-bm-section .uf-count');
    if (count) count.textContent = state.bookmarks.length;
  }

  // ─── 진입점 ─────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('astro:page-load', init);
})();
