var BUILD_API = '/api';

function esc(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function showToast(message, type) {
  type = type || 'success';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z'));
  return d.toLocaleString();
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '-';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function getBuildId() {
  var params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function copyBuildJson(build) {
  var json = JSON.stringify({
    id: build.id,
    status: build.status,
    trigger_type: build.trigger_type,
    triggered_by: build.triggered_by,
    started_at: build.started_at,
    finished_at: build.finished_at,
    duration_ms: build.duration_ms,
    failed_files: build.failed_files || [],
    log: build.log || ''
  }, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    showToast('JSON copied to clipboard');
  } catch (e) {
    // Fallback for older browsers
    var ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('JSON copied to clipboard');
  }
}

async function loadBuildDetail() {
  var id = getBuildId();
  if (!id) {
    document.getElementById('buildDetail').innerHTML = '<div class="empty-msg">No build ID specified</div>';
    return;
  }

  try {
    var res = await fetch(BUILD_API + '/builds/' + id);
    if (!res.ok) {
      document.getElementById('buildDetail').innerHTML = '<div class="empty-msg">Build not found</div>';
      return;
    }
    var build = await res.json();
    renderBuildDetail(build);
  } catch (e) {
    document.getElementById('buildDetail').innerHTML = '<div class="empty-msg">Failed to load build</div>';
  }
}

function renderBuildDetail(build) {
  var failedFilesHtml = '';
  if (build.failed_files && build.failed_files.length > 0) {
    failedFilesHtml = '<div class="build-detail-section">' +
      '<h3 class="section-title">Failed Files (' + build.failed_files.length + (build.failed_files.length >= 100 ? '+' : '') + ')</h3>' +
      '<div class="failed-files-list">' +
      build.failed_files.map(function(f) {
        return '<div class="failed-file-item">' + esc(f) + '</div>';
      }).join('') +
      (build.failed_files.length >= 100 ? '<div class="failed-file-item" style="color:#94a3b8;font-style:italic">Showing first 100 files. Check full log for more.</div>' : '') +
      '</div></div>';
  }

  var html = '<div class="build-detail-header">' +
    '<div class="build-detail-meta">' +
      '<span class="badge badge-' + esc(build.status) + '">' + esc(build.status) + '</span>' +
      '<span class="badge badge-trigger-' + esc(build.trigger_type) + '">' + esc(build.trigger_type) + '</span>' +
      '<span class="build-detail-id">#' + build.id + '</span>' +
    '</div>' +
    '<div class="build-detail-actions">' +
      '<button class="btn btn-primary" onclick="copyBuildJson(window._buildData)">Copy JSON</button>' +
    '</div>' +
  '</div>' +
  '<div class="build-detail-info">' +
    '<div class="build-info-row"><span class="build-info-label">Triggered By</span><span>' + esc(build.triggered_by) + '</span></div>' +
    '<div class="build-info-row"><span class="build-info-label">Started</span><span>' + formatDate(build.started_at) + '</span></div>' +
    '<div class="build-info-row"><span class="build-info-label">Finished</span><span>' + formatDate(build.finished_at) + '</span></div>' +
    '<div class="build-info-row"><span class="build-info-label">Duration</span><span>' + formatDuration(build.duration_ms) + '</span></div>' +
  '</div>' +
  failedFilesHtml +
  '<div class="build-detail-section">' +
    '<h3 class="section-title">Build Log</h3>' +
    '<pre class="build-log-full">' + esc(build.log || 'No log available') + '</pre>' +
  '</div>';

  document.getElementById('buildDetail').innerHTML = html;
  window._buildData = build;
}

loadBuildDetail();
