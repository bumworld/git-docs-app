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

  // TOC 버튼 등록 (배치/재초기화는 toc-button-helper.js 가 담당)
  if (typeof window !== 'undefined' && window.registerTocButton) {
    window.registerTocButton({
      className: 'toc-print-btn',
      order: 40,
      create: createPrintButton,
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createPrintButton, handlePrint, prepareForPrint };
  }
})();
