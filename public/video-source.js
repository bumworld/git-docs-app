(function () {
  function getSourceUrl(wrapper) {
    // YouTube iframe: extract video ID from embed URL → reconstruct watch URL
    var iframe = wrapper.querySelector('iframe');
    if (iframe) {
      var src = iframe.getAttribute('src') || '';
      var match = src.match(/youtube\.com\/embed\/([^?&#]+)/);
      if (match) return 'https://www.youtube.com/watch?v=' + match[1];
    }
    // Video element: get source src
    var source = wrapper.querySelector('video source');
    if (source) return source.getAttribute('src');
    return null;
  }

  document.querySelectorAll('.video-wrapper').forEach(function (wrapper) {
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
})();
