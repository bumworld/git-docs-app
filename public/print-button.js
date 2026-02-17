(function() {
  'use strict';

  function createPrintButton(isMobile) {
    const btn = document.createElement('button');
    btn.className = isMobile ? 'toc-print-btn-mobile' : 'toc-print-btn';
    btn.title = 'Print page as PDF';
    btn.setAttribute('aria-label', 'Print current page as PDF');
    btn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 3H6C4.9 3 4 3.9 4 5v6h16V5c0-1.1-.9-2-2-2zm-1 5H7V5h10v3zM19 12H5c-1.1 0-2 .9-2 2v4h4v3h10v-3h4v-4c0-1.1-.9-2-2-2zm-1 7H6v-3h12v3z"/>
      </svg>
      <span>Print PDF</span>
    `;
    btn.addEventListener('click', handlePrint);
    return btn;
  }

  function handlePrint(e) {
    e.preventDefault();
    prepareForPrint();
    window.print();
  }

  function prepareForPrint() {
    // Mermaid SVG 최적화
    document.querySelectorAll('.mermaid-viewport svg').forEach(svg => {
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
    });
  }

  function initPrintButton() {
    // 모바일 체크
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // 기존 모바일 버튼 제거
      const existingMobileBtn = document.querySelector('.toc-print-btn-mobile');
      if (existingMobileBtn) existingMobileBtn.remove();

      // 모바일: starlight mobile toc summary 찾기
      const mobileTocSummary = document.querySelector('#starlight__on-this-page--mobile');

      if (mobileTocSummary) {
        const btn = createPrintButton(true);
        mobileTocSummary.appendChild(btn);
      }
    } else {
      // PC: 우측 사이드바에 버튼 추가
      const rightSidebar = document.querySelector('.right-sidebar-container .right-sidebar');
      if (!rightSidebar) return;

      // 기존 버튼 제거
      const existingBtn = rightSidebar.querySelector('.toc-print-btn');
      if (existingBtn) existingBtn.remove();

      // "On this page" 헤더 찾기
      const tocHeading = rightSidebar.querySelector('h2');
      const btn = createPrintButton(false);

      if (tocHeading) {
        tocHeading.insertAdjacentElement('afterend', btn);
      } else {
        rightSidebar.insertBefore(btn, rightSidebar.firstChild);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrintButton);
  } else {
    initPrintButton();
  }

  document.addEventListener('astro:page-load', initPrintButton);

  // 리사이즈 시 재초기화
  window.addEventListener('resize', initPrintButton);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createPrintButton, handlePrint, prepareForPrint, initPrintButton };
  }
})();
