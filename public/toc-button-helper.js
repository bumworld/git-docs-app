/**
 * TOC 액션 버튼 공통 배치 헬퍼.
 *
 * print/view-source/copy-content/bookmark/screen-preview 등 우측 "On this page"
 * TOC 에 붙는 액션 버튼들의 중복 배치 로직(데스크탑/모바일 분기, 기존 버튼 제거,
 * astro:page-load/resize 재초기화, 삽입 순서)을 한곳에서 관리한다.
 *
 * 각 스크립트는 window.registerTocButton(config) 로 등록만 한다:
 *   - className        : 버튼 클래스(데스크탑). 모바일은 `${className}-mobile` 로 관리/제거된다.
 *   - order            : 버튼 정렬 순서 (작을수록 위/앞)
 *   - create(isMobile) : 버튼 엘리먼트를 생성해 반환. Promise 반환 가능(비동기 로드). null 이면 미표시
 *   - desktop          : 데스크탑 표시 여부 (기본 true)
 *   - mobile           : 모바일 표시 여부 (기본 true)
 *   - presentationAware: true 면 프레젠테이션 모드에서 표시하지 않음 (기본 false)
 *
 * 상태가 바뀌어 재배치가 필요하면 window.refreshTocButtons() 호출(Promise 반환).
 */
(function () {
  'use strict';

  var DESKTOP_MQ = '(min-width: 72rem)';
  var registry = [];
  var chain = Promise.resolve(); // render 직렬화 (동시 호출 시 순차 실행)

  function isDesktop() { return window.matchMedia(DESKTOP_MQ).matches; }
  function inPresentation() { return !!document.querySelector('.presentation-wrapper'); }

  async function doRender() {
    var sorted = registry.slice().sort(function (a, b) { return a.order - b.order; });
    var desktop = isDesktop();
    var presentation = inPresentation();

    // 1) 모든 버튼을 먼저 생성(async). 이 단계에서는 DOM 을 건드리지 않으므로
    //    비동기 create(예: screen-preview 의 fetch) 중에도 기존 버튼이 사라지지 않는다.
    var built = [];
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      var show = desktop ? c.desktop !== false : c.mobile !== false;
      if (!show) continue;
      if (c.presentationAware && presentation) continue;
      var el = await c.create(!desktop);
      if (el) built.push(el);
    }

    // 2) 기존 관리 버튼 제거 + 새 버튼 삽입을 동기적으로 수행 (갭 없는 원자적 교체)
    sorted.forEach(function (cfg) {
      document.querySelectorAll('.' + cfg.className + ', .' + cfg.className + '-mobile')
        .forEach(function (el) { el.remove(); });
    });

    if (desktop) {
      var sidebar = document.querySelector('.right-sidebar-container .right-sidebar');
      if (!sidebar) return;
      var anchor = sidebar.querySelector('h2'); // "On this page" 헤더
      built.forEach(function (btn) {
        if (anchor) {
          anchor.insertAdjacentElement('afterend', btn);
        } else {
          sidebar.insertBefore(btn, sidebar.firstChild);
        }
        anchor = btn; // 다음 버튼은 이 버튼 뒤에 → order 순서 유지
      });
    } else {
      var mobileToc = document.querySelector('#starlight__on-this-page--mobile');
      if (!mobileToc) return;
      built.forEach(function (btn) { mobileToc.appendChild(btn); });
    }
  }

  function render() {
    chain = chain.then(doRender, doRender); // 이전 render 실패해도 계속
    return chain;
  }

  window.registerTocButton = function (config) {
    registry.push(config);
    return render();
  };
  window.refreshTocButtons = render;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  document.addEventListener('astro:page-load', render);
  window.addEventListener('resize', render);

  // 테스트용 export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { render, registry, _reset: function () { registry.length = 0; } };
  }
})();
