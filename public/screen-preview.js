(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let modalEl = null;
  let previewData = null;   // { title, screen, screens, figma, status, version }
  let currentScreenIndex = 0;
  let currentDevice = 'desktop';

  const STATUS_LABELS = {
    draft:     '초안',
    review:    '검토중',
    confirmed: '확정',
    dev:       '개발중',
    done:      '완료',
  };

  // ── Button ─────────────────────────────────────────────────
  function createButton() {
    const btn = document.createElement('button');
    btn.className = 'toc-screen-preview-btn';
    btn.title = '화면 미리보기';
    btn.setAttribute('aria-label', '연결된 화면 미리보기');

    const status = previewData?.status;
    const statusBadge = status
      ? `<span class="screen-status-badge screen-status-${status}">${STATUS_LABELS[status] || status}</span>`
      : '';

    btn.innerHTML = `
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 15h14v2H5v-2zm0-4h14v2H5v-2zm0-4h14v2H5V7z"/>
      </svg>
      <span>화면 미리보기</span>
      ${statusBadge}
    `;
    btn.addEventListener('click', openModal);
    return btn;
  }

  // ── Page slug ──────────────────────────────────────────────
  function getSlug() {
    let slug = window.location.pathname.replace(/^\/+|\/+$/g, '');
    return slug || 'index';
  }

  // ── URL 해석 ────────────────────────────────────────────────
  // 규칙:
  //   외부 URL (http/https)      → 그대로 사용
  //   /downloads/... 로 시작     → 그대로 사용 (이미 변환된 절대경로)
  //   절대경로 /foo/bar.html      → /downloads/foo/bar.html  (source 루트 기준)
  //   상대경로 screens/home.html  → /downloads/[현재폴더]/screens/home.html
  function resolveScreenUrl(url, slug) {
    if (!url) return url;
    if (/^https?:\/\//.test(url)) return url;
    if (url.startsWith('/downloads/')) return url;

    if (url.startsWith('/')) {
      // 절대경로: source 루트 기준 → /downloads 접두 추가
      return '/downloads' + url;
    }

    // 상대경로: 현재 페이지의 폴더 기준으로 해석
    const relUrl = url.replace(/^\.\//, '');
    const dir = slug.includes('/') ? slug.replace(/\/[^/]+$/, '') : '';
    return dir ? `/downloads/${dir}/${relUrl}` : `/downloads/${relUrl}`;
  }

  // ── Load frontmatter from _sources JSON ───────────────────
  async function loadPreviewData() {
    const slug = getSlug();
    try {
      const res = await fetch(`/_sources/${slug.replace(/\//g, '_')}.json`);
      if (!res.ok) return null;
      const data = await res.json();
      const fm = data.frontmatter || {};
      if (!fm.screen && !fm.screens) return null;
      return {
        title:   fm.title   || document.title || '화면 미리보기',
        screen:  fm.screen  ? resolveScreenUrl(fm.screen, slug) : null,
        screens: fm.screens ? fm.screens.map(s => ({ ...s, url: resolveScreenUrl(s.url, slug) })) : null,
        figma:   fm.figma   || null,
        status:  fm.status  || null,
        version: fm.version || null,
      };
    } catch {
      return null;
    }
  }

  // ── Button factory (배치는 toc-button-helper 가 담당) ──────
  // screen frontmatter 가 있는 페이지에서만(desktop) 버튼을 만든다.
  // 페이지별로 한 번만 fetch (resize/재렌더 시 캐시 사용 → 중복 요청/깜빡임 방지).
  let cachedSlug = null;
  async function makeScreenButton(isMobile) {
    if (isMobile) return null;
    const slug = getSlug();
    if (cachedSlug !== slug) {
      previewData = await loadPreviewData();
      cachedSlug = slug;
    }
    return previewData ? createButton() : null;
  }

  // ── Modal ──────────────────────────────────────────────────
  function openModal() {
    if (!previewData) return;
    currentScreenIndex = 0;
    currentDevice = 'desktop';

    if (!modalEl) {
      modalEl = buildModal();
      document.body.appendChild(modalEl);
    }

    refreshModal();
    modalEl.classList.add('screen-preview-modal-visible');
    document.body.style.overflow = 'hidden';

    // 접근성: focus trap + role=dialog + 포커스 복귀
    if (window.modalA11y) {
      window.modalA11y.open(
        modalEl,
        modalEl.querySelector('.screen-preview-modal-content'),
        modalEl.querySelector('.screen-preview-modal-title')
      );
    }
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('screen-preview-modal-visible');
    document.body.style.overflow = '';
    if (window.modalA11y) window.modalA11y.close();
  }

  function buildModal() {
    const el = document.createElement('div');
    el.className = 'screen-preview-modal';
    el.innerHTML = `
      <div class="screen-preview-modal-overlay"></div>
      <div class="screen-preview-modal-content">
        <div class="screen-preview-modal-header">
          <h2 class="screen-preview-modal-title"></h2>
          <span class="screen-status-badge sp-status-badge" style="display:none"></span>
          <span class="screen-preview-version" style="display:none"></span>
          <button class="screen-preview-modal-close" aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div class="screen-preview-toolbar">
          <div class="screen-tabs"></div>
          <div class="screen-device-group">
            <button class="screen-device-btn" data-device="mobile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 2H7C5.9 2 5 2.9 5 4v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H7V4h10v12z"/>
              </svg>
              Mobile
            </button>
            <button class="screen-device-btn" data-device="tablet">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.5 0h-13C4.1 0 3 1.1 3 2.5v19C3 22.9 4.1 24 5.5 24h13c1.4 0 2.5-1.1 2.5-2.5v-19C21 1.1 19.9 0 18.5 0zm-5 23h-3v-1h3v1zm5.5-3h-14V3h14v17z"/>
              </svg>
              Tablet
            </button>
            <button class="screen-device-btn active" data-device="desktop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/>
              </svg>
              Desktop
            </button>
          </div>
          <div class="screen-preview-links"></div>
        </div>

        <div class="screen-preview-viewport">
          <div class="screen-preview-frame-wrap device-desktop">
            <div class="screen-preview-loading">로딩 중...</div>
            <iframe class="screen-preview-iframe" title="화면 미리보기" loading="lazy" tabindex="-1"></iframe>
          </div>
        </div>
      </div>
    `;

    // Events
    el.querySelector('.screen-preview-modal-overlay').addEventListener('click', closeModal);
    el.querySelector('.screen-preview-modal-close').addEventListener('click', closeModal);

    el.querySelectorAll('.screen-device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentDevice = btn.dataset.device;
        el.querySelectorAll('.screen-device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateFrameDevice();
      });
    });

    return el;
  }

  function refreshModal() {
    if (!modalEl || !previewData) return;

    // Title
    modalEl.querySelector('.screen-preview-modal-title').textContent = previewData.title;

    // Status badge
    const statusBadge = modalEl.querySelector('.sp-status-badge');
    if (previewData.status) {
      statusBadge.className = `screen-status-badge sp-status-badge screen-status-${previewData.status}`;
      statusBadge.textContent = STATUS_LABELS[previewData.status] || previewData.status;
      statusBadge.style.display = '';
    } else {
      statusBadge.style.display = 'none';
    }

    // Version
    const versionEl = modalEl.querySelector('.screen-preview-version');
    if (previewData.version) {
      versionEl.textContent = `v${previewData.version}`;
      versionEl.style.display = '';
    } else {
      versionEl.style.display = 'none';
    }

    // Build screen list
    const allScreens = buildScreenList();
    renderTabs(allScreens);
    renderLinks();
    updateIframe(allScreens[currentScreenIndex]?.url);
    updateFrameDevice();
  }

  function buildScreenList() {
    if (previewData.screens && previewData.screens.length > 0) {
      return previewData.screens;
    }
    if (previewData.screen) {
      return [{ url: previewData.screen, label: '화면' }];
    }
    return [];
  }

  function renderTabs(screens) {
    const tabsEl = modalEl.querySelector('.screen-tabs');
    tabsEl.innerHTML = '';

    if (screens.length <= 1) return;

    screens.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'screen-tab-btn' + (i === currentScreenIndex ? ' active' : '');
      btn.textContent = s.label || `화면 ${i + 1}`;
      btn.addEventListener('click', () => {
        currentScreenIndex = i;
        tabsEl.querySelectorAll('.screen-tab-btn').forEach((b, j) => {
          b.classList.toggle('active', j === i);
        });
        updateIframe(screens[i].url);
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderLinks() {
    const linksEl = modalEl.querySelector('.screen-preview-links');
    linksEl.innerHTML = '';

    const screens = buildScreenList();
    const currentUrl = screens[currentScreenIndex]?.url;

    if (currentUrl) {
      const a = document.createElement('a');
      a.href = currentUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'screen-preview-link-btn';
      a.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
        새 탭
      `;
      linksEl.appendChild(a);
    }

    if (previewData.figma) {
      const a = document.createElement('a');
      a.href = previewData.figma;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'screen-preview-link-btn';
      a.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4zm-8 4c0 2.21 1.79 4 4 4h4V12H4v4zm4-8h4V0H8C5.79 0 4 1.79 4 4s1.79 4 4 4zm-4 4v-.04C4.02 12.01 4 12.01 4 12c0-2.21 1.79-4 4-4v4H4zm8-8h4c2.21 0 4-1.79 4-4S18.21 0 16 0h-4v8z"/>
        </svg>
        Figma
      `;
      linksEl.appendChild(a);
    }
  }

  function updateIframe(url) {
    if (!modalEl) return;
    const iframe = modalEl.querySelector('.screen-preview-iframe');
    const loading = modalEl.querySelector('.screen-preview-loading');

    if (!url) {
      iframe.src = 'about:blank';
      return;
    }

    if (loading) loading.style.display = 'flex';
    iframe.onload = () => { if (loading) loading.style.display = 'none'; };
    iframe.src = url;
  }

  function updateFrameDevice() {
    if (!modalEl) return;
    const wrap = modalEl.querySelector('.screen-preview-frame-wrap');
    wrap.className = `screen-preview-frame-wrap device-${currentDevice}`;
  }

  // ── 등록 (배치/재초기화는 toc-button-helper.js 가 담당) ─────
  if (typeof window !== 'undefined' && window.registerTocButton) {
    window.registerTocButton({
      className: 'toc-screen-preview-btn',
      order: 50,
      mobile: false,            // desktop 전용
      presentationAware: true,
      create: makeScreenButton,
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalEl?.classList.contains('screen-preview-modal-visible')) {
      closeModal();
    }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { openModal, closeModal };
  }
})();
