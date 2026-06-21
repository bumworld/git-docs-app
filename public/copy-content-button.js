(function() {
  'use strict';

  /**
   * Create Copy Content button
   */
  function createCopyContentButton(isMobile) {
    const btn = document.createElement('button');
    btn.className = isMobile ? 'toc-copy-content-btn-mobile' : 'toc-copy-content-btn';
    btn.title = 'Copy rendered page content';
    btn.setAttribute('aria-label', 'Copy page content as rich text');
    btn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      <span>Copy Content</span>
    `;
    btn.addEventListener('click', handleCopyContent);
    return btn;
  }

  /**
   * Handle copy content button click
   */
  async function handleCopyContent(e) {
    e.preventDefault();

    try {
      // Get the main content area
      const contentElement = document.querySelector('.sl-markdown-content');
      if (!contentElement) {
        throw new Error('Content area not found');
      }

      // Clone the content to avoid modifying the original
      const clonedContent = contentElement.cloneNode(true);

      // Remove unwanted elements from the clone
      const elementsToRemove = [
        '.not-content', // Any marked as not-content
        '[data-pagefind-ignore]', // Pagefind ignore markers
      ];

      elementsToRemove.forEach(selector => {
        clonedContent.querySelectorAll(selector).forEach(el => el.remove());
      });

      // Replace mermaid diagrams with original source code to avoid SVG rendering issues
      clonedContent.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        const source = wrapper.getAttribute('data-mermaid-source')
          || wrapper.querySelector('[data-original]')?.getAttribute('data-original')
          || '';
        const replacement = document.createElement('pre');
        replacement.style.cssText = 'background: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; font-family: monospace;';
        replacement.textContent = '```mermaid\n' + source + '\n```';
        wrapper.replaceWith(replacement);
      });

      // Get the HTML content
      const htmlContent = clonedContent.innerHTML;

      // Create a more complete HTML structure with basic styling
      const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 80ch;
      margin: 0 auto;
      padding: 2rem;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code {
      background: #f3f4f6;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    blockquote {
      border-left: 4px solid #d1d5db;
      margin: 1em 0;
      padding-left: 1em;
      color: #6b7280;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 0.5em 1em;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    li {
      margin: 0.5em 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>
      `.trim();

      // Copy as rich text
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([styledHtml], { type: 'text/html' }),
          'text/plain': new Blob([clonedContent.textContent || ''], { type: 'text/plain' })
        })
      ]);

      // Show success feedback
      showCopyFeedback(e.target);

    } catch (error) {
      console.error('[CopyContent] Copy failed:', error);
      alert('Failed to copy content. Please try again.');
    }
  }

  /**
   * Show visual feedback for successful copy
   */
  function showCopyFeedback(button) {
    const btn = button.closest('button');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      <span>Copied!</span>
    `;
    btn.classList.add('copy-success');

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('copy-success');
    }, 2000);
  }

  // TOC 버튼 등록 (배치/재초기화는 toc-button-helper.js 가 담당)
  if (typeof window !== 'undefined' && window.registerTocButton) {
    window.registerTocButton({
      className: 'toc-copy-content-btn',
      order: 20,
      presentationAware: true,
      create: createCopyContentButton,
    });
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createCopyContentButton,
      handleCopyContent
    };
  }
})();
