(function () {
  'use strict';

  // 공용 모달 접근성 유틸: focus trap + role=dialog + 포커스 복귀.
  // view-source / screen-preview 등 클래스 토글 방식 모달이 open/close 시점에 호출한다.
  // (defer 스크립트라 modal-a11y.js 가 소비 스크립트보다 먼저 로드됨)

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let lastFocused = null;
  let activeDialog = null;
  let idCounter = 0;

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE))
      .filter(el => el.offsetParent !== null); // 숨김(display:none) 요소 제외
  }

  function onKeydown(e) {
    if (e.key !== 'Tab' || !activeDialog) return;
    const items = getFocusable(activeDialog);
    if (items.length === 0) {
      e.preventDefault();
      activeDialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // open(modalEl, contentEl, labelEl)
  //   modalEl   : visible 클래스가 붙는 래퍼 (참조용)
  //   contentEl : dialog 역할을 할 패널 (없으면 modalEl)
  //   labelEl   : 제목 요소 (aria-labelledby 연결, 선택)
  function open(modalEl, contentEl, labelEl) {
    const dialog = contentEl || modalEl;
    // 재진입/중첩 가드: 이미 trap 중이면 트리거 포커스를 덮어쓰지 않는다
    // (예: fetch 더블클릭으로 같은 모달 재오픈 → 복귀 지점이 모달 내부로 오염되는 것 방지).
    if (!activeDialog) {
      lastFocused = document.activeElement;
    }
    activeDialog = dialog;

    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    if (labelEl) {
      if (!labelEl.id) labelEl.id = 'modal-a11y-title-' + (++idCounter);
      dialog.setAttribute('aria-labelledby', labelEl.id);
    }

    document.addEventListener('keydown', onKeydown, true);

    const items = getFocusable(dialog);
    (items[0] || dialog).focus();
  }

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    activeDialog = null;
    // 복귀 대상이 DOM 에서 분리(리렌더/반응형 전환 등)됐으면 focus() 하지 않는다.
    if (lastFocused && lastFocused.isConnected && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  window.modalA11y = { open, close };
})();
