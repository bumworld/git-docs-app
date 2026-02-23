(function () {
  var STORAGE_KEY = 'sl-toc-collapsed';
  var DESKTOP_MQ = '(min-width: 72rem)';

  function isDesktop() {
    return window.matchMedia(DESKTOP_MQ).matches;
  }

  function isCollapsed() {
    return document.documentElement.classList.contains('toc-collapsed');
  }

  // right-sidebar의 실제 left 위치를 측정해서 CSS 변수로 설정
  function measureToc() {
    if (isCollapsed()) return;
    var sidebar = document.querySelector('.right-sidebar');
    if (!sidebar) return;

    // right-sidebar(fixed)의 실제 left를 측정 → border-inline-start 라인 위치
    // CSS fixed positioning 기준은 clientWidth (스크롤바 제외), innerWidth(X)
    var sidebarRect = sidebar.getBoundingClientRect();
    var fromRight = document.documentElement.clientWidth - sidebarRect.left;
    if (fromRight <= 0) return;

    document.documentElement.style.setProperty('--sl-toc-actual-right', fromRight + 'px');
  }

  function setCollapsed(collapsed) {
    var root = document.documentElement;
    if (collapsed) {
      root.classList.add('toc-collapsed');
    } else {
      root.classList.remove('toc-collapsed');
    }
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (e) {}
    updateButton();
  }

  function updateButton() {
    var btn = document.getElementById('sl-toc-toggle');
    if (!btn) return;
    var collapsed = isCollapsed();
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.querySelector('.sl-toc-icon').textContent = collapsed ? '‹' : '›';
  }

  function createToggleButton() {
    if (document.getElementById('sl-toc-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'sl-toc-toggle';
    btn.className = 'sl-toc-toggle';
    btn.setAttribute('aria-label', 'Toggle table of contents');
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<span class="sl-toc-icon" aria-hidden="true">›</span>';
    btn.addEventListener('click', function () {
      setCollapsed(!isCollapsed());
    });
    document.body.appendChild(btn);
  }

  function init() {
    if (!document.querySelector('.right-sidebar-container')) return;
    if (!isDesktop()) return;

    measureToc();
    createToggleButton();
    updateButton();

    window.addEventListener('resize', function () {
      if (!isCollapsed()) measureToc();
    });

    // LNB 접힘/펼침 시 레이아웃이 바뀌므로 transition 완료 후 재측정
    var sidebar = document.getElementById('starlight__sidebar');
    if (sidebar) {
      sidebar.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'width' && !isCollapsed()) measureToc();
      });
    }

    // 페이지 로드 후 transition 활성화 (FOUC 방지)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add('toc-animate');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
