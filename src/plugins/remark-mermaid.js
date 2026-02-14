import { visit } from 'unist-util-visit';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid') return;

      const id = `mermaid-${index}-${Date.now()}`;
      const html = `<div class="mermaid-wrapper" id="${id}">
<div class="mermaid-toolbar">
<button class="mermaid-tb-btn" onclick="window.__copyMermaidSource(this)" title="Copy source">Copy</button>
<button class="mermaid-tb-btn" onclick="window.__openMermaidNewTab(this)" title="Open in new tab">New tab</button>
</div>
<div class="mermaid-viewport">
<pre class="mermaid">${escapeHtml(node.value)}</pre>
</div>
</div>`;

      parent.children.splice(index, 1, {
        type: 'html',
        value: html,
      });
    });
  };
}
