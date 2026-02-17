// Build management module

import { BUILD_API } from '../core.js';
import { esc, formatDate, formatDuration, showToast } from '../core.js';

function truncateLog(log, lines) {
  if (!log) return '';
  const arr = log.split('\n');
  if (arr.length <= lines) return log;
  return arr.slice(0, lines).join('\n') + '\n... (' + arr.length + ' lines total)';
}

export async function loadBuildStats() {
  try {
    const res = await fetch(BUILD_API + '/builds/stats');
    const s = await res.json();
    document.getElementById('buildStats').innerHTML =
      '<div class="stat-card"><div class="stat-value">' + s.total + '</div><div class="stat-label">Total Builds</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + s.success + '</div><div class="stat-label">Success</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + s.failed + '</div><div class="stat-label">Failed</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + formatDuration(s.avg_duration_ms) + '</div><div class="stat-label">Avg Duration</div></div>';
  } catch (e) {
    // Ignore errors
  }
}

export async function loadBuilds() {
  const status = document.getElementById('filterStatus').value;
  const trigger = document.getElementById('filterTrigger').value;
  let query = '?limit=50';
  if (status) query += '&status=' + status;
  if (trigger) query += '&trigger_type=' + trigger;

  try {
    const res = await fetch(BUILD_API + '/builds' + query);
    const data = await res.json();
    renderBuilds(data.builds || []);
    // Also refresh stats
    loadBuildStats();
  } catch (e) {
    document.getElementById('buildsList').innerHTML = '<div class="empty-msg">Failed to load builds</div>';
  }
}

export function renderBuilds(builds) {
  const el = document.getElementById('buildsList');
  if (builds.length === 0) {
    el.innerHTML = '<div class="empty-msg">No builds found</div>';
    return;
  }
  el.innerHTML = builds.map(b => {
    const failedCount = b.failed_files ? b.failed_files.length : 0;
    const failedBadge = failedCount > 0
      ? '<span class="badge badge-failed">' + failedCount + (failedCount >= 100 ? '+' : '') + ' failed files</span>'
      : '';

    return '<div class="build-card">' +
      '<div class="build-card-top">' +
        '<div class="build-card-info">' +
          '<span class="build-id">#' + b.id + '</span>' +
          '<span class="badge badge-' + esc(b.status) + '">' + esc(b.status) + '</span>' +
          '<span class="badge badge-trigger-' + esc(b.trigger_type) + '">' + esc(b.trigger_type) + '</span>' +
          failedBadge +
        '</div>' +
        '<div class="build-card-meta">' +
          '<span>' + esc(b.triggered_by || '-') + '</span>' +
          '<span>' + formatDate(b.started_at) + '</span>' +
          '<span>' + formatDuration(b.duration_ms) + '</span>' +
        '</div>' +
      '</div>' +
      (b.log_preview ? '<pre class="build-log-preview">' + esc(truncateLog(b.log_preview, 10)) + '</pre>' : '') +
      '<div class="build-card-actions">' +
        '<a href="/admin/build-detail.html?id=' + b.id + '" class="btn">View Full Log</a>' +
        '<button class="btn" onclick="window.adminModules.builds.copyBuildJsonFromList(' + b.id + ')">Copy JSON</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

export async function copyBuildJsonFromList(id) {
  try {
    const res = await fetch(BUILD_API + '/builds/' + id);
    const build = await res.json();
    const json = JSON.stringify({
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
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('JSON copied to clipboard');
    }
  } catch (e) {
    showToast('Failed to copy', 'error');
  }
}

export async function triggerBuildFromTab() {
  const btn = document.getElementById('buildRunBtn');
  btn.disabled = true;
  btn.textContent = 'Building...';
  showBuildProgress(true);

  try {
    const res = await fetch('/api/rebuild', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Run Build';
      showBuildProgress(false);
      return;
    }
    showToast('Build triggered');
    // SSE will send build:complete event, so no need to poll
  } catch (e) {
    showToast('Failed to trigger build', 'error');
    btn.disabled = false;
    btn.textContent = 'Run Build';
    showBuildProgress(false);
  }
}

export function showBuildProgress(show) {
  const el = document.getElementById('buildProgress');
  el.style.display = show ? 'flex' : 'none';
}

// Initialize filter change handlers
export function initializeFilters() {
  document.getElementById('filterStatus').addEventListener('change', loadBuilds);
  document.getElementById('filterTrigger').addEventListener('change', loadBuilds);
}
