// Whitelist management module

import { api, esc, formatDate, showToast } from '../core.js';

export async function loadWhitelistedEmails() {
  const emails = await api('GET', '/whitelisted-emails');
  const el = document.getElementById('whitelistList');
  if (emails.length === 0) {
    el.innerHTML = '<div class="empty-msg">No pre-registered emails yet</div>';
    return;
  }
  el.innerHTML = emails.map(email => {
    return '<div class="whitelist-card">' +
      '<div class="whitelist-card-content">' +
        '<div class="whitelist-email">' + esc(email.email) + '</div>' +
        '<div class="whitelist-meta">' +
          '<span>Added by: ' + esc(email.added_by || '-') + '</span>' +
          '<span>' + formatDate(email.created_at) + '</span>' +
        '</div>' +
        (email.notes ? '<div class="whitelist-notes">' + esc(email.notes) + '</div>' : '') +
      '</div>' +
      '<button class="btn btn-danger" onclick="window.adminModules.whitelist.deleteWhitelistedEmail(' + email.id + ', \'' + esc(email.email) + '\')">Remove</button>' +
    '</div>';
  }).join('');
}

export function toggleAddEmailForm() {
  const form = document.getElementById('addEmailForm');
  if (form.style.display === 'none') {
    form.style.display = 'block';
    document.getElementById('whitelistEmail').focus();
  } else {
    form.style.display = 'none';
    document.getElementById('whitelistEmail').value = '';
    document.getElementById('whitelistNotes').value = '';
  }
}

export async function addWhitelistedEmail() {
  const emailInput = document.getElementById('whitelistEmail');
  const notesInput = document.getElementById('whitelistNotes');
  const email = emailInput.value.trim();
  const notes = notesInput.value.trim();

  if (!email) {
    showToast('Please enter an email address', 'error');
    return;
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  const r = await api('POST', '/whitelisted-emails', { email: email, notes: notes });
  if (r.error) {
    showToast(r.error, 'error');
  } else {
    showToast('Email added to whitelist');
    emailInput.value = '';
    notesInput.value = '';
    toggleAddEmailForm();
    loadWhitelistedEmails();
  }
}

export async function deleteWhitelistedEmail(id, email) {
  if (!confirm('Remove "' + email + '" from whitelist?')) return;
  const r = await api('DELETE', '/whitelisted-emails/' + id);
  if (r.error) {
    showToast(r.error, 'error');
  } else {
    showToast('Email removed from whitelist');
    loadWhitelistedEmails();
  }
}
