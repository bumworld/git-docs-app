(function () {
  var STORAGE_KEY = 'sl-sidebar-collapsed';
  var DESKTOP_MQ = '(min-width: 50rem)';
  // 72rem 미만: 모바일 TOC 오버뷰 바가 표시되는 구간 → 사이드바 자동 접힘
  var TOC_MOBILE_MQ = '(min-width: 72rem)';
  var wasAutoCollapsed = false;

  function isDesktop() {
    return window.matchMedia(DESKTOP_MQ).matches;
  }

  function isTocDesktop() {
    return window.matchMedia(TOC_MOBILE_MQ).matches;
  }

  function isCollapsed() {
    return document.documentElement.classList.contains('sidebar-collapsed');
  }

  function autoSetCollapsed(collapsed) {
    var root = document.documentElement;
    if (collapsed) {
      root.classList.add('sidebar-collapsed');
    } else {
      root.classList.remove('sidebar-collapsed');
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

  function handleResize() {
    if (!isDesktop()) return;

    if (!isTocDesktop() && !isCollapsed()) {
      // 72rem 미만: 모바일 TOC 구간 → 사이드바 자동 접힘
      wasAutoCollapsed = true;
      autoSetCollapsed(true);
    } else if (isTocDesktop() && isCollapsed() && wasAutoCollapsed) {
      // 72rem 이상으로 돌아왔고 자동으로 접혔던 경우 → 복원
      var userClosed = null;
      try { userClosed = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (userClosed !== '1') {
        wasAutoCollapsed = false;
        autoSetCollapsed(false);
      }
    }
  }

  function init() {
    // iframe(프리젠테이션 모드) 내부에서는 실행 안 함
    if (window.top !== window.self) return;
    // 사이드바 없는 페이지 건너뜀
    if (!document.documentElement.hasAttribute('data-has-sidebar')) return;
    // 모바일 건너뜀
    if (!isDesktop()) return;

    createToggleButton();

    // 초기 로드 시 72rem 미만이면 사이드바 자동 접힘
    if (!isTocDesktop() && !isCollapsed()) {
      wasAutoCollapsed = true;
      autoSetCollapsed(true);
    }

    updateButton();

    window.addEventListener('resize', handleResize);

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
