(function () {
  var STORAGE_KEY = 'sl-toc-collapsed';
  var DESKTOP_MQ = '(min-width: 72rem)';
  var MIN_TOC_PX = 128; // 이 너비 미만이면 PC TOC 자동 숨김
  var wasAutoCollapsed = false;
  var resizeTimer = null;

  function isDesktop() {
    return window.matchMedia(DESKTOP_MQ).matches;
  }

  function isCollapsed() {
    return document.documentElement.classList.contains('toc-collapsed');
  }

  // classList만 조작 (localStorage 저장 없음 - 자동 처리용)
  function autoSetCollapsed(collapsed) {
    var root = document.documentElement;
    if (collapsed) {
      root.classList.add('toc-collapsed');
    } else {
      root.classList.remove('toc-collapsed');
    }
    updateButton();
  }

  function setCollapsed(collapsed) {
    autoSetCollapsed(collapsed);
    wasAutoCollapsed = false;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (e) {}
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

  function handleResize() {
    if (!isDesktop()) return;

    // resize 중 transition 비활성화 → fixed element static position 즉시 반영
    document.documentElement.classList.remove('toc-animate');

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var container = document.querySelector('.right-sidebar-container');
      if (!container) {
        document.documentElement.classList.add('toc-animate');
        return;
      }

      var containerRect = container.getBoundingClientRect();
      var panelWidth = Math.round(document.documentElement.clientWidth - containerRect.left);

      // 너무 좁으면 자동으로 TOC 닫기
      if (panelWidth < MIN_TOC_PX && !isCollapsed()) {
        wasAutoCollapsed = true;
        autoSetCollapsed(true);
      }
      // 충분히 넓어졌고 자동으로 닫혔던 경우 → 다시 열기
      else if (panelWidth >= MIN_TOC_PX && isCollapsed() && wasAutoCollapsed) {
        var userClosed = localStorage.getItem(STORAGE_KEY) === '1';
        if (!userClosed) {
          wasAutoCollapsed = false;
          autoSetCollapsed(false);
        }
      }

      // transition 복원
      document.documentElement.classList.add('toc-animate');
    }, 100);
  }

  function init() {
    if (!document.querySelector('.right-sidebar-container')) return;
    if (!isDesktop()) return;

    createToggleButton();

    // 초기 로드 시에도 패널 너비 체크 (resize와 동일한 로직)
    var container = document.querySelector('.right-sidebar-container');
    var containerRect = container.getBoundingClientRect();
    var panelWidth = Math.round(document.documentElement.clientWidth - containerRect.left);

    if (panelWidth < MIN_TOC_PX && !isCollapsed()) {
      wasAutoCollapsed = true;
      autoSetCollapsed(true);
    }

    updateButton();

    window.addEventListener('resize', handleResize);

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
