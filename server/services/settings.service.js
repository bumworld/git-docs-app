import { getAllSettings, updateSettings } from '../db.js';

const ALLOWED_KEYS = ['site_title', 'site_description', 'contact_email', 'footer_text', 'language'];

export function isValidEmail(email) {
  return !!(email && email.includes('@'));
}

// { success, updates?, error?, code? }
export function filterAndUpdateSettings(body) {
  const updates = {};
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = String(body[key]);
    }
  }
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No valid settings provided', code: 400 };
  }
  updateSettings(updates);
  return { success: true, updates };
}

export function triggerRebuildIfNeeded(updates, reqUser, buildRunner) {
  const needsRebuild = updates.site_title !== undefined || updates.site_description !== undefined;
  if (needsRebuild && buildRunner) {
    console.log('[Admin] Settings changed, triggering rebuild...');
    buildRunner.triggerBuild('settings', reqUser.email);
  }
}

export function getSettings() {
  return getAllSettings();
}
