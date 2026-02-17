(function() {
  'use strict';

  // Modal state
  let modalElement = null;
  let currentSourceData = null;

  /**
   * Create View Source button
   */
  function createViewSourceButton(isMobile) {
    const btn = document.createElement('button');
    btn.className = isMobile ? 'toc-view-source-btn-mobile' : 'toc-view-source-btn';
    btn.title = 'View page source (Markdown & HTML)';
    btn.setAttribute('aria-label', 'View source code of this page');
    btn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
      </svg>
      <span>View Source</span>
    `;
    btn.addEventListener('click', handleViewSourceClick);
    return btn;
  }

  /**
   * Handle button click - load and display source
   */
  async function handleViewSourceClick(e) {
    e.preventDefault();

    // Derive slug from current URL
    const slug = getPageSlug();

    try {
      // Load source data
      const response = await fetch(`/_sources/${slug.replace(/\//g, '_')}.json`);
      if (!response.ok) {
        throw new Error(`Source not found (${response.status})`);
      }

      currentSourceData = await response.json();
      showModal();
    } catch (error) {
      console.error('[ViewSource] Failed to load source:', error);
      alert('Failed to load source data. This page may not have source available.');
    }
  }

  /**
   * Get current page slug from URL
   */
  function getPageSlug() {
    const pathname = window.location.pathname;

    // Remove leading/trailing slashes
    let slug = pathname.replace(/^\/+|\/+$/g, '');

    // Handle root/index
    if (!slug || slug === '') {
      return 'index';
    }

    return slug;
  }

  /**
   * Create and show modal
   */
  function showModal() {
    if (!currentSourceData) return;

    // Create modal if it doesn't exist
    if (!modalElement) {
      modalElement = createModalElement();
      document.body.appendChild(modalElement);
    }

    // Update modal content
    updateModalContent();

    // Show modal
    modalElement.classList.add('view-source-modal-visible');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Create modal DOM element
   */
  function createModalElement() {
    const modal = document.createElement('div');
    modal.className = 'view-source-modal';
    modal.innerHTML = `
      <div class="view-source-modal-overlay"></div>
      <div class="view-source-modal-content">
        <div class="view-source-modal-header">
          <h2>Page Source</h2>
          <button class="view-source-modal-close" aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="view-source-modal-tabs">
          <button class="view-source-tab view-source-tab-active" data-tab="markdown">Markdown</button>
          <button class="view-source-tab" data-tab="html">HTML</button>
        </div>
        <div class="view-source-modal-body">
          <div class="view-source-tab-content view-source-tab-content-active" data-tab-content="markdown">
            <div class="view-source-toolbar">
              <span class="view-source-file-path"></span>
              <button class="view-source-copy-btn" data-copy="markdown">Copy</button>
            </div>
            <pre class="view-source-code"><code class="view-source-markdown"></code></pre>
          </div>
          <div class="view-source-tab-content" data-tab-content="html">
            <div class="view-source-toolbar">
              <span class="view-source-file-path">Rendered HTML</span>
              <button class="view-source-copy-btn" data-copy="html">Copy</button>
            </div>
            <pre class="view-source-code"><code class="view-source-html"></code></pre>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    modal.querySelector('.view-source-modal-close').addEventListener('click', hideModal);
    modal.querySelector('.view-source-modal-overlay').addEventListener('click', hideModal);

    // Tab switching
    modal.querySelectorAll('.view-source-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
      });
    });

    // Copy buttons
    modal.querySelectorAll('.view-source-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.copy;
        copyToClipboard(type, e.target);
      });
    });

    return modal;
  }

  /**
   * Update modal with current source data
   */
  function updateModalContent() {
    if (!modalElement || !currentSourceData) return;

    // Update markdown content
    const markdownCode = modalElement.querySelector('.view-source-markdown');
    markdownCode.textContent = currentSourceData.markdown || '';

    // Update HTML content
    const htmlCode = modalElement.querySelector('.view-source-html');
    htmlCode.textContent = currentSourceData.html || '';

    // Update file path
    const filePath = modalElement.querySelector('.view-source-file-path');
    if (currentSourceData.sourceFilePath) {
      filePath.textContent = currentSourceData.sourceFilePath;
    }
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    if (!modalElement) return;

    // Update tab buttons
    modalElement.querySelectorAll('.view-source-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('view-source-tab-active');
      } else {
        tab.classList.remove('view-source-tab-active');
      }
    });

    // Update tab content
    modalElement.querySelectorAll('.view-source-tab-content').forEach(content => {
      if (content.dataset.tabContent === tabName) {
        content.classList.add('view-source-tab-content-active');
      } else {
        content.classList.remove('view-source-tab-content-active');
      }
    });
  }

  /**
   * Copy content to clipboard
   */
  function copyToClipboard(type, button) {
    if (!currentSourceData) return;

    let copyPromise;

    if (type === 'markdown') {
      // Markdown: copy as plain text
      copyPromise = navigator.clipboard.writeText(currentSourceData.markdown);
    } else {
      // HTML: copy as both HTML (for rich text paste) and plain text (fallback)
      const htmlContent = currentSourceData.html;
      const plainText = htmlContent; // Keep raw HTML as plain text fallback

      copyPromise = navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ]);
    }

    copyPromise.then(() => {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('view-source-copy-btn-success');
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('view-source-copy-btn-success');
      }, 1500);
    }).catch(err => {
      console.error('[ViewSource] Copy failed:', err);
      alert('Failed to copy to clipboard');
    });
  }

  /**
   * Hide modal
   */
  function hideModal() {
    if (!modalElement) return;
    modalElement.classList.remove('view-source-modal-visible');
    document.body.style.overflow = '';
  }

  /**
   * Initialize View Source button in the right sidebar
   */
  function initViewSourceButton() {
    // Check if we're in presentation mode - don't show button
    if (document.querySelector('.presentation-wrapper')) {
      return;
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // Remove existing mobile button
      const existingMobileBtn = document.querySelector('.toc-view-source-btn-mobile');
      if (existingMobileBtn) existingMobileBtn.remove();

      // Mobile: add to "On this page" summary
      const mobileTocSummary = document.querySelector('#starlight__on-this-page--mobile');

      if (mobileTocSummary) {
        const btn = createViewSourceButton(true);
        mobileTocSummary.appendChild(btn);
      }
    } else {
      // Desktop: add to right sidebar
      const rightSidebar = document.querySelector('.right-sidebar-container .right-sidebar');
      if (!rightSidebar) return;

      // Remove existing button
      const existingBtn = rightSidebar.querySelector('.toc-view-source-btn');
      if (existingBtn) existingBtn.remove();

      // Find "On this page" header
      const tocHeading = rightSidebar.querySelector('h2');
      const btn = createViewSourceButton(false);

      if (tocHeading) {
        // Insert after "On this page" heading, but before Print button if it exists
        const printBtn = rightSidebar.querySelector('.toc-print-btn');
        if (printBtn) {
          tocHeading.insertAdjacentElement('afterend', btn);
          btn.insertAdjacentElement('afterend', printBtn);
        } else {
          tocHeading.insertAdjacentElement('afterend', btn);
        }
      } else {
        rightSidebar.insertBefore(btn, rightSidebar.firstChild);
      }
    }
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initViewSourceButton);
  } else {
    initViewSourceButton();
  }

  // Re-initialize on Starlight navigation
  document.addEventListener('astro:page-load', initViewSourceButton);

  // Re-initialize on window resize
  window.addEventListener('resize', initViewSourceButton);

  // Handle Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalElement && modalElement.classList.contains('view-source-modal-visible')) {
      hideModal();
    }
  });

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createViewSourceButton,
      handleViewSourceClick,
      getPageSlug,
      initViewSourceButton
    };
  }
})();
