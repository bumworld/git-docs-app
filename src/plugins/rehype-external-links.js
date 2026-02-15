import { visit } from 'unist-util-visit';
import fs from 'fs';
import path from 'path';

function loadSiteHosts() {
  const hosts = new Set();
  try {
    const confPath = path.resolve(process.cwd(), 'conf', 'google_auth.json');
    const raw = fs.readFileSync(confPath, 'utf-8');
    const config = JSON.parse(raw);
    const uris = (config.web || config).redirect_uris || [];
    for (const uri of uris) {
      try {
        hosts.add(new URL(uri).hostname);
      } catch { /* skip invalid */ }
    }
  } catch { /* google_auth.json not found */ }
  return hosts;
}

export function rehypeExternalLinks() {
  const siteHosts = loadSiteHosts();

  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;

      const href = node.properties?.href;
      if (!href || typeof href !== 'string') return;

      // relative or anchor links → internal
      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')) return;

      try {
        const linkHost = new URL(href, 'https://placeholder').hostname;
        if (siteHosts.has(linkHost)) return; // same host → normal navigation
      } catch {
        return;
      }

      node.properties.target = '_blank';
      node.properties.rel = 'noopener noreferrer';
    });
  };
}
