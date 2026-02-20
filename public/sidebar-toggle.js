(function () {
  var STORAGE_KEY = 'sl-sidebar-collapsed';
  var DESKTOP_MQ = '(min-width: 50rem)';

  function isDesktop() {
    return window.matchMedia(DESKTOP_MQ).matches;
  }

  function isCollapsed() {
    return document.documentElement.classList.contains('sidebar-collapsed');
  }

  function setCollapsed(collapsed) {
    var root = document.documentElement;
    if (collapsed) {
      root.classList.add('sidebar-collapsed');
    } else {
      root.classList.remove('sidebar-collapsed');
    }
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch (e) {}
    updateButton();
  }

  function updateButton() {
    var btn = document.getElementById('sl-sidebar-toggle');
    if (!btn) return;
    var collapsed = isCollapsed();
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.querySelector('.sl-st-icon').textContent = collapsed ? '›' : '‹';
  }

  function createToggleButton() {
    if (document.getElementById('sl-sidebar-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'sl-sidebar-toggle';
    btn.className = 'sl-sidebar-toggle';
    btn.setAttribute('aria-label', 'Toggle sidebar navigation');
    btn.setAttribute('type', 'button');
    btn.innerHTML = '<span class="sl-st-icon" aria-hidden="true">‹</span>';
    btn.addEventListener('click', function () {
      setCollapsed(!isCollapsed());
    });
    document.body.appendChild(btn);
  }

  function init() {
    // 사이드바 없는 페이지 건너뜀
    if (!document.documentElement.hasAttribute('data-has-sidebar')) return;
    // 모바일 건너뜀
    if (!isDesktop()) return;

    createToggleButton();
    updateButton();

    // 페이지 로드 후 transition 활성화 (FOUC 방지: 로드 시엔 transition 없음)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.add('sidebar-animate');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
