/**
 * Presentation Mode Script
 * Converts markdown pages with presentation: true frontmatter into reveal.js presentations
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Check if this is a presentation page by looking for slide sections
    const slides = document.querySelectorAll('section[data-slide]');
    if (slides.length === 0) {
      console.log('[Presentation] No slides found');
      return; // Not a presentation page
    }

    console.log(`[Presentation] Found ${slides.length} slides`);

    // Get theme from document or default
    const htmlElement = document.documentElement;
    const detectedTheme = htmlElement.getAttribute('data-theme');
    const theme = 'black'; // Default theme for now

    // Check URL for presentation mode
    const urlParams = new URLSearchParams(window.location.search);
    const presentationMode = urlParams.get('mode') === 'presentation';

    console.log('[Presentation] Mode:', presentationMode ? 'presentation' : 'document');

    // Initialize based on mode
    if (presentationMode) {
      initPresentationMode(slides, theme);
    } else {
      addPresentationButton();
    }
  }

  function addPresentationButton() {
    const main = document.querySelector('main');
    if (!main) {
      console.warn('[Presentation] Main element not found');
      return;
    }

    const btnContainer = document.createElement('div');
    btnContainer.className = 'presentation-mode-controls';
    btnContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      gap: 10px;
    `;

    const btn = document.createElement('button');
    btn.className = 'presentation-mode-btn';
    btn.innerHTML = '🎬 Presentation Mode';
    btn.style.cssText = `
      padding: 12px 20px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });

    btn.addEventListener('click', () => {
      const url = new URL(window.location);
      url.searchParams.set('mode', 'presentation');
      window.location.href = url.toString();
    });

    btnContainer.appendChild(btn);
    document.body.appendChild(btnContainer);

    console.log('[Presentation] Button added');
  }

  function initPresentationMode(slides, theme) {
    console.log('[Presentation] Initializing presentation mode');

    // Hide Starlight UI
    const elementsToHide = [
      '.header',
      '.sidebar',
      '.right-sidebar-container',
      'nav',
      '.content-panel:first-child',
      '.right-sidebar'
    ];

    elementsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.display = 'none';
      });
    });

    // Create reveal.js container
    const revealWrapper = document.createElement('div');
    revealWrapper.className = 'presentation-wrapper';

    const revealDiv = document.createElement('div');
    revealDiv.className = 'reveal';

    const slidesDiv = document.createElement('div');
    slidesDiv.className = 'slides';

    // Move slides into reveal structure
    slides.forEach(slide => {
      const slideClone = slide.cloneNode(true);
      slidesDiv.appendChild(slideClone);
      slide.style.display = 'none'; // Hide original
    });

    revealDiv.appendChild(slidesDiv);
    revealWrapper.appendChild(revealDiv);

    // Add to page
    const main = document.querySelector('main');
    if (main) {
      main.appendChild(revealWrapper);
    }

    // Add styles
    addPresentationStyles();

    // Add exit button
    addExitButton();

    // Load reveal.js
    loadRevealJS(theme);
  }

  function addExitButton() {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'presentation-mode-controls';
    btnContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      gap: 10px;
    `;

    const btn = document.createElement('button');
    btn.className = 'presentation-mode-btn';
    btn.innerHTML = '📄 Document Mode';
    btn.style.cssText = `
      padding: 12px 20px;
      background: rgba(255,255,255,0.9);
      color: #333;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transition: all 0.2s;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', () => {
      const url = new URL(window.location);
      url.searchParams.delete('mode');
      window.location.href = url.toString();
    });

    btnContainer.appendChild(btn);
    document.body.appendChild(btnContainer);
  }

  function addPresentationStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .presentation-wrapper {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 99999 !important;
        background: #191919 !important;
      }

      body:has(.presentation-wrapper) {
        overflow: hidden !important;
      }

      .reveal {
        width: 100% !important;
        height: 100% !important;
      }

      .reveal .slides {
        text-align: left !important;
      }

      .reveal .slides section {
        height: 100%;
        padding: 40px;
      }

      .reveal h1 {
        font-size: 2.5em !important;
        margin-bottom: 0.5em !important;
        text-align: center !important;
      }

      .reveal h2 {
        font-size: 1.8em !important;
        margin-bottom: 0.5em !important;
        text-align: center !important;
      }

      .reveal h3 {
        font-size: 1.4em !important;
        margin-bottom: 0.5em !important;
      }

      .reveal ul, .reveal ol {
        margin-left: 2em !important;
        margin-bottom: 1em !important;
      }

      .reveal li {
        margin-bottom: 0.5em !important;
      }

      .reveal pre {
        width: 100% !important;
        font-size: 0.6em !important;
      }

      .reveal code {
        font-family: 'Courier New', monospace !important;
      }

      .reveal img {
        max-width: 100% !important;
        max-height: 60vh !important;
        object-fit: contain !important;
      }

      .reveal .mermaid-wrapper {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        margin: 1em 0 !important;
      }

      .reveal .mermaid {
        max-width: 100% !important;
        max-height: 60vh !important;
      }
    `;
    document.head.appendChild(style);
  }

  async function loadRevealJS(theme) {
    console.log('[Presentation] Loading reveal.js from CDN');

    try {
      // Load reveal.js CSS
      const revealCSS = document.createElement('link');
      revealCSS.rel = 'stylesheet';
      revealCSS.href = 'https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.css';
      document.head.appendChild(revealCSS);

      // Load theme CSS
      const themeCSS = document.createElement('link');
      themeCSS.rel = 'stylesheet';
      themeCSS.href = `https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/theme/${theme}.css`;
      document.head.appendChild(themeCSS);

      // Load reveal.js script
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.js';
      script.onload = () => {
        console.log('[Presentation] Reveal.js loaded');
        if (window.Reveal) {
          window.Reveal.initialize({
            embedded: false,
            hash: true,
            center: true,
            transition: 'slide',
            width: 960,
            height: 700,
            margin: 0.1,
            minScale: 0.2,
            maxScale: 2.0,
            controls: true,
            progress: true,
            slideNumber: 'c/t',
            keyboard: true,
            overview: true,
            touch: true,
            loop: false,
            rtl: false,
            fragments: true,
            help: true,
            showNotes: false,
            mouseWheel: false,
            hideInactiveCursor: true,
            hideCursorTime: 5000,
          }).then(() => {
            console.log('[Presentation] Reveal.js initialized');
          });
        }
      };
      script.onerror = () => {
        console.error('[Presentation] Failed to load reveal.js');
      };
      document.head.appendChild(script);

    } catch (error) {
      console.error('[Presentation] Error loading reveal.js:', error);
    }
  }
})();
