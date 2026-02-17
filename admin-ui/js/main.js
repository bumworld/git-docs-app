// Main entry point for admin panel

import { initializeTabs } from './core.js';
import * as users from './modules/users.js';
import * as builds from './modules/builds.js';
import * as sse from './modules/sse.js';
import * as settings from './modules/settings.js';
import * as whitelist from './modules/whitelist.js';

// Export modules to global scope for onclick handlers
window.adminModules = {
  users,
  builds,
  sse,
  settings,
  whitelist,
  loadAll
};

// Load all data
export function loadAll() {
  users.loadStats();
  users.loadPending();
  users.loadUsers(sse.onlineEmails);
  settings.loadSettings();
  whitelist.loadWhitelistedEmails();
}

// Initialize tabs with tab change handler
initializeTabs(tabName => {
  if (tabName === 'builds') {
    builds.loadBuilds();
  }
  if (tabName === 'whitelist') {
    whitelist.loadWhitelistedEmails();
  }
});

// Initialize builds filters
builds.initializeFilters();

// Initialize settings form
settings.initializeSettingsForm();

// Initialize SSE message handler
sse.initializeMessageHandler();

// Connect SSE for real-time updates
sse.connectSSE();

// Load all data on page load
loadAll();
