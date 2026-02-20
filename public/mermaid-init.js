import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const isDark = document.documentElement.dataset.theme === 'dark'
  || document.querySelector('[data-theme="dark"]') !== null
  || window.matchMedia('(prefers-color-scheme: dark)').matches;

// Save original source before mermaid replaces it
document.querySelectorAll('.mermaid-wrapper').forEach(function(wrapper) {
  var pre = wrapper.querySelector('pre.mermaid');
  if (pre) {
    var source = pre.textContent;
    pre.setAttribute('data-original', source);
    wrapper.setAttribute('data-mermaid-source', source);
  }
});

mermaid.initialize({
  startOnLoad: true,
  theme: isDark ? 'dark' : 'default',
  securityLevel: 'loose',
});

// Copy mermaid source to clipboard
window.__copyMermaidSource = function(btn) {
  var wrapper = btn.closest('.mermaid-wrapper');
  var source = wrapper.querySelector('[data-original]')?.getAttribute('data-original') || '';
  navigator.clipboard.writeText(source).then(function() {
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = orig; }, 1500);
  });
};

// Open diagram in new tab - re-render from source with light theme
window.__openMermaidNewTab = async function(btn) {
  var wrapper = btn.closest('.mermaid-wrapper');
  var source = wrapper.querySelector('[data-original]')?.getAttribute('data-original');
  if (!source) return;

  var escaped = source.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var newTabHTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mermaid Diagram</title>'
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
    + '<div id="diagram"></div>'
    + '<scr' + 'ipt type="module">'
    + 'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";'
    + 'mermaid.initialize({startOnLoad:false,theme:"default",securityLevel:"loose"});'
    + 'var source = ' + JSON.stringify(source) + ';'
    + 'var {svg} = await mermaid.render("m1", source);'
    + 'document.getElementById("diagram").innerHTML = svg;'
    + 'var scale=1;'
    + 'window.zoom=function(d){scale=d===0?1:Math.min(5,Math.max(0.2,scale+d*0.25));document.querySelector("#diagram svg").style.transform="scale("+scale+")";document.getElementById("level").textContent=Math.round(scale*100)+"%";};'
    + '</scr' + 'ipt>'
    + '</body></html>';

  var blob = new Blob([newTabHTML], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
};
