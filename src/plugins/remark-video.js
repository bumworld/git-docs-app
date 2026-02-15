import { visit } from 'unist-util-visit';

/**
 * YouTube URL에서 video ID 추출
 * 지원 형식: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
 */
function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1);
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
      if (u.searchParams.has('v')) return u.searchParams.get('v');
    }
  } catch { /* invalid URL */ }
  return null;
}

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

function isVideoUrl(url) {
  try {
    const pathname = new URL(url, 'https://placeholder').pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function buildYouTubeHtml(videoId, url) {
  return `<div class="video-wrapper">
<iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
</div>`;
}

function buildVideoHtml(url) {
  const ext = url.split('.').pop().toLowerCase();
  const mime = ext === 'mov' ? 'video/mp4' : `video/${ext}`;
  return `<div class="video-wrapper">
<video controls preload="metadata">
<source src="${url}" type="${mime}">
<a href="${url}">Download video</a>
</video>
</div>`;
}

/**
 * Remark 플러그인: 마크다운의 YouTube 링크 및 비디오 파일 링크를 플레이어로 변환
 *
 * 지원 패턴:
 * 1. 베어 URL (한 줄에 URL만): https://www.youtube.com/watch?v=xxx
 * 2. 마크다운 링크: [text](https://youtu.be/xxx)
 * 3. 비디오 파일 링크: [video](./video.mp4) 또는 https://example.com/video.mp4
 */
export function remarkVideo() {
  return (tree) => {
    // 1) paragraph 내 단독 링크 또는 베어 URL 처리
    visit(tree, 'paragraph', (node, index, parent) => {
      // paragraph에 자식이 1개이고 link인 경우
      if (node.children.length === 1 && node.children[0].type === 'link') {
        const link = node.children[0];
        const url = link.url;

        const ytId = getYouTubeId(url);
        if (ytId) {
          parent.children.splice(index, 1, { type: 'html', value: buildYouTubeHtml(ytId, url) });
          return;
        }
        if (isVideoUrl(url)) {
          parent.children.splice(index, 1, { type: 'html', value: buildVideoHtml(url) });
          return;
        }
      }

      // paragraph에 자식이 1개이고 text인 경우 (베어 URL autolink)
      if (node.children.length === 1 && node.children[0].type === 'text') {
        const text = node.children[0].value.trim();
        if (!text.startsWith('http://') && !text.startsWith('https://')) return;

        const ytId = getYouTubeId(text);
        if (ytId) {
          parent.children.splice(index, 1, { type: 'html', value: buildYouTubeHtml(ytId, text) });
          return;
        }
        if (isVideoUrl(text)) {
          parent.children.splice(index, 1, { type: 'html', value: buildVideoHtml(text) });
          return;
        }
      }
    });
  };
}
