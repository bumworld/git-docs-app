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

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const newMode = urlParams.get('mode') === 'presentation';

      console.log('[Presentation] Popstate detected, new mode:', newMode ? 'presentation' : 'document');

      // If URL changed from presentation to document mode, reload page
      if (!newMode && document.querySelector('.presentation-wrapper')) {
        console.log('[Presentation] Exiting presentation mode via browser navigation');
        window.location.reload();
      }
      // If URL changed from document to presentation mode, enter presentation mode
      else if (newMode && !document.querySelector('.presentation-wrapper')) {
        console.log('[Presentation] Entering presentation mode via browser navigation');
        initPresentationMode(slides, theme);
      }
    });
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
      // Get slides and theme
      const slides = document.querySelectorAll('section[data-slide]');
      const theme = 'black';

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('mode', 'presentation');
      history.pushState({}, '', url.toString());

      // Hide the button
      btnContainer.remove();

      // Enter presentation mode immediately
      initPresentationMode(slides, theme);
    });

    btnContainer.appendChild(btn);
    document.body.appendChild(btnContainer);

    console.log('[Presentation] Button added');
  }

  async function waitForMermaidReady() {
    console.log('[Presentation] Waiting for mermaid to be ready...');

    try {
      // Wait for mermaid library to be available (with timeout)
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 20; // 1 second max

        const checkMermaid = () => {
          if (window.mermaid) {
            console.log('[Presentation] Mermaid library found');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.log('[Presentation] Mermaid library not found, proceeding anyway');
            resolve(); // Continue even if mermaid is not found
          } else {
            attempts++;
            setTimeout(checkMermaid, 50);
          }
        };
        checkMermaid();
      });

      // Wait a bit for mermaid to finish rendering existing diagrams
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[Presentation] Mermaid ready, proceeding with presentation mode');
    } catch (error) {
      console.error('[Presentation] Error in waitForMermaidReady:', error);
    }
  }

  async function initPresentationMode(slides, theme) {
    console.log('[Presentation] Initializing presentation mode');

    try {
      // No need to wait for mermaid here - we'll re-render it after reveal.js initializes
      console.log('[Presentation] Starting initialization immediately');

    // Hide Starlight UI
    const elementsToHide = [
      '.header',
      '.sidebar',
      '.right-sidebar-container',
      'nav',
      '.content-panel:first-child',
      '.right-sidebar',
      '.sl-sidebar-toggle'
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

      console.log('[Presentation] Initialization complete');
    } catch (error) {
      console.error('[Presentation] Error in initPresentationMode:', error);
      console.error('[Presentation] Stack trace:', error.stack);

      // Continue with initialization even if there's an error
      try {
        loadRevealJS(theme);
      } catch (e) {
        console.error('[Presentation] Failed to load reveal.js:', e);
      }
    }
  }

  function addExitButton() {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'presentation-mode-controls';
    btnContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      gap: 10px;
    `;

    // Document Mode button
    const docBtn = document.createElement('button');
    docBtn.className = 'presentation-mode-btn';
    docBtn.innerHTML = '📄 Document Mode';
    docBtn.style.cssText = `
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

    docBtn.addEventListener('mouseenter', () => {
      docBtn.style.transform = 'scale(1.05)';
    });

    docBtn.addEventListener('mouseleave', () => {
      docBtn.style.transform = 'scale(1)';
    });

    docBtn.addEventListener('click', () => {
      console.log('[Presentation] Document Mode button clicked');
      const url = new URL(window.location);

      // Remove mode parameter if exists
      if (url.searchParams.has('mode')) {
        url.searchParams.delete('mode');
        window.location.href = url.toString();
      } else {
        // If parameter doesn't exist (e.g., after browser back), just reload
        console.log('[Presentation] Mode parameter not found, reloading page');
        window.location.reload();
      }
    });

    // New Tab button for current mermaid diagram
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'presentation-mode-btn presentation-new-tab-btn';
    newTabBtn.innerHTML = '🔗 Open Diagram';
    newTabBtn.style.cssText = `
      padding: 12px 20px;
      background: rgba(99, 102, 241, 0.9);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transition: all 0.2s;
      display: none;
    `;

    newTabBtn.addEventListener('mouseenter', () => {
      newTabBtn.style.transform = 'scale(1.05)';
    });

    newTabBtn.addEventListener('mouseleave', () => {
      newTabBtn.style.transform = 'scale(1)';
    });

    newTabBtn.addEventListener('click', () => {
      // Find current mermaid diagram in view
      const currentSlide = document.querySelector('.reveal .slides section.present');
      if (currentSlide) {
        const mermaidSvg = currentSlide.querySelector('.mermaid svg');
        if (mermaidSvg) {
          // Serialize SVG
          const svgData = new XMLSerializer().serializeToString(mermaidSvg);

          // Create HTML with zoom controls
          const newTabHTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mermaid Diagram</title>'
            + '<style>'
            + '*{margin:0;padding:0;box-sizing:border-box;}'
            + 'body{background:#fff;}'
            + '.toolbar{position:fixed;top:0;left:0;right:0;height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;background:#f8f9fa;border-bottom:1px solid #ddd;z-index:10;font-family:sans-serif;font-size:14px;}'
            + '.toolbar button{border:1px solid #ccc;background:#fff;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:14px;}'
            + '.toolbar button:hover{background:#e9ecef;}'
            + '.toolbar span{color:#666;min-width:48px;text-align:center;}'
            + '#diagram{padding:24px;padding-top:68px;}'
            + '#diagram svg{display:block;transform-origin:top left;transition:transform 0.15s ease;}'
            + '</style>'
            + '</head><body>'
            + '<div class="toolbar">'
            + '<button onclick="zoom(-1)">- Zoom Out</button>'
            + '<span id="level">100%</span>'
            + '<button onclick="zoom(1)">+ Zoom In</button>'
            + '<button onclick="zoom(0)">Reset</button>'
            + '</div>'
            + '<div id="diagram">' + svgData + '</div>'
            + '<script>'
            + 'var scale=1;'
            + 'window.zoom=function(d){scale=d===0?1:Math.min(5,Math.max(0.2,scale+d*0.25));document.querySelector("#diagram svg").style.transform="scale("+scale+")";document.getElementById("level").textContent=Math.round(scale*100)+"%";};'
            + '</script>'
            + '</body></html>';

          const blob = new Blob([newTabHTML], { type: 'text/html' });
          window.open(URL.createObjectURL(blob), '_blank');
        }
      }
    });

    btnContainer.appendChild(docBtn);
    btnContainer.appendChild(newTabBtn);
    document.body.appendChild(btnContainer);

    // Update button visibility based on current slide content
    function updateNewTabButtonVisibility() {
      // Check if in overview mode
      const isOverview = document.querySelector('.reveal.overview');
      if (isOverview) {
        newTabBtn.style.display = 'none';
        return;
      }

      const currentSlide = document.querySelector('.reveal .slides section.present');
      const hasMermaid = currentSlide && currentSlide.querySelector('.mermaid');
      newTabBtn.style.display = hasMermaid ? 'block' : 'none';

      console.log('[Presentation] Update button visibility - hasMermaid:', hasMermaid);
    }

    // Listen for slide changes
    if (window.Reveal) {
      window.Reveal.on('slidechanged', updateNewTabButtonVisibility);
      window.Reveal.on('ready', updateNewTabButtonVisibility);
      window.Reveal.on('overviewshown', () => {
        newTabBtn.style.display = 'none';
      });
      window.Reveal.on('overviewhidden', updateNewTabButtonVisibility);
    } else {
      // Fallback: check periodically if Reveal is not ready yet
      const checkInterval = setInterval(() => {
        if (window.Reveal) {
          window.Reveal.on('slidechanged', updateNewTabButtonVisibility);
          window.Reveal.on('ready', updateNewTabButtonVisibility);
          window.Reveal.on('overviewshown', () => {
            newTabBtn.style.display = 'none';
          });
          window.Reveal.on('overviewhidden', updateNewTabButtonVisibility);
          updateNewTabButtonVisibility();
          clearInterval(checkInterval);
        }
      }, 100);
    }

    // Initial check
    setTimeout(updateNewTabButtonVisibility, 500);
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

  async function initializeMermaidInSlides() {
    console.log('[Presentation] Initializing mermaid diagrams in slides');

    try {
      // Find all mermaid elements in slides
      const mermaidElements = document.querySelectorAll('.reveal .slides pre.mermaid');
      console.log(`[Presentation] Found ${mermaidElements.length} mermaid diagrams`);

      if (mermaidElements.length === 0) {
        console.log('[Presentation] No mermaid diagrams to render');
        return;
      }

      // Wait for mermaid library to be available (up to 5 seconds)
      console.log('[Presentation] Waiting for mermaid library...');
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 100; // 5 seconds

        const checkMermaid = () => {
          if (window.mermaid) {
            console.log('[Presentation] Mermaid library loaded!');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.warn('[Presentation] Mermaid library not available after 5 seconds');
            resolve(); // Continue anyway
          } else {
            attempts++;
            setTimeout(checkMermaid, 50);
          }
        };
        checkMermaid();
      });

      if (!window.mermaid) {
        console.error('[Presentation] Mermaid is not available, cannot render diagrams');
        return;
      }

      // Process each mermaid element
      mermaidElements.forEach((element, index) => {
        // Get original source from data-original attribute or text content
        let originalSource = element.getAttribute('data-original');

        if (!originalSource) {
          // If no data-original, try to get from text content
          // Remove any existing SVG and get the text
          const svgElement = element.querySelector('svg');
          if (svgElement) {
            svgElement.remove();
          }
          originalSource = element.textContent.trim();
        }

        // Clean up the element
        element.innerHTML = '';
        element.textContent = originalSource;
        element.setAttribute('data-original', originalSource);
        element.removeAttribute('data-processed');

        console.log(`[Presentation] Prepared mermaid diagram ${index + 1}:`, originalSource.substring(0, 50) + '...');
      });

      // Re-initialize mermaid with current settings
      const isDark = document.documentElement.dataset.theme === 'dark'
        || document.querySelector('[data-theme="dark"]') !== null
        || window.matchMedia('(prefers-color-scheme: dark)').matches;

      console.log('[Presentation] Initializing mermaid with theme:', isDark ? 'dark' : 'default');

      window.mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
      });

      // Render all mermaid diagrams
      console.log('[Presentation] Running mermaid.run()...');
      await window.mermaid.run({
        querySelector: '.reveal .slides pre.mermaid',
      });

      console.log('[Presentation] Mermaid diagrams rendered successfully');
    } catch (error) {
      console.error('[Presentation] Error initializing mermaid:', error);
      console.error('[Presentation] Error details:', error.message, error.stack);
    }
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
            // Re-render mermaid diagrams after reveal.js initialization
            initializeMermaidInSlides();
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
