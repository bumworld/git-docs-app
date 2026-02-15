(function () {
  function getSourceUrl(wrapper) {
    var iframe = wrapper.querySelector('iframe');
    if (iframe) {
      var src = iframe.getAttribute('src') || '';
      var match = src.match(/youtube\.com\/embed\/([^?&#]+)/);
      if (match) return 'https://www.youtube.com/watch?v=' + match[1];
    }
    var source = wrapper.querySelector('video source');
    if (source) return source.getAttribute('src');
    return null;
  }

  function initVideoSources() {
    document.querySelectorAll('.video-wrapper').forEach(function (wrapper) {
      if (wrapper.querySelector('.video-source')) return; // already initialized
      var url = getSourceUrl(wrapper);
      if (!url) return;

      var bar = document.createElement('div');
      bar.className = 'video-source';

      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = url;

      var btn = document.createElement('button');
      btn.className = 'video-copy-btn';
      btn.textContent = 'Copy';
      btn.title = 'Copy URL';
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(url).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        });
      });

      bar.appendChild(link);
      bar.appendChild(btn);
      wrapper.appendChild(bar);
    });
  }

  // Run on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoSources);
  } else {
    initVideoSources();
  }

  // Run on Starlight View Transitions navigation
  document.addEventListener('astro:page-load', initVideoSources);
})();
