document.addEventListener('DOMContentLoaded', function() {
  function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  fetch('/auth/me')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.authenticated) return;
      var u = data.user;
      var btnHtml = '<a href="/auth/logout" class="auth-btn">Logout</a>';
      if (u.role === 'admin') btnHtml += '<a href="/admin" class="auth-btn auth-btn-admin">Admin</a>';
      var nameHtml = '<span class="auth-name">' + esc(u.name || u.email) + '</span>';
      if (u.avatar) nameHtml = '<img src="' + esc(u.avatar) + '" alt="" class="auth-avatar"/>' + nameHtml;

      var el = document.createElement('div');
      el.className = 'auth-bar';
      el.innerHTML = nameHtml + btnHtml;

      var rightGroup = document.querySelector('.header .right-group');
      if (rightGroup) {
        rightGroup.insertBefore(el, rightGroup.firstChild);
      }
    })
    .catch(function() {});
});
