// Short gate for playing: handle, room, a contact box that can stay blank, and the 13+ check. The full RSVP lives on its own page.
// Runs apart from the 3D code, so a signup still saves if the world is slow or can't load.
// Uses the same Google Sheet and script as the RSVP page, so there is one list.
(function () {
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzrXaiwLzOEsHZmQ6K9aYMmTniFYCrApmrzUoanpTTBbgFFlmPjzmujxv4gRQELFUPA/exec';
  var SIGNED = 'imp_signed', PENDING = 'imp_pending', TIMEOUT_MS = 20000;
  var $ = function (id) { return document.getElementById(id); };

  // Copies running on this Mac never write to the real sheet.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Errors the person can fix in this form. Anything else, like a script that isn't updated yet, is not theirs to fix: let them in and resend later.
  var FIXABLE = /^(Enter your|Enter a valid|Pick a room|Check the box|You have to be)/;

  function post(body) {
    if (LOCAL) return Promise.resolve({ ok: true });
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
    // Plain text so the browser goes straight to Apps Script, which can't answer preflight checks.
    return fetch(ENDPOINT, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { clearTimeout(timer); return r.json(); });
  }

  function letIn(handle, room, returning) {
    localStorage.setItem(SIGNED, handle);
    localStorage.setItem('imp_name', handle);
    $('name').value = handle;
    $('inHead').textContent = returning ? 'WELCOME BACK, @' + handle : "YOU'RE IN, @" + handle;
    $('inSub').textContent = room || '';
    $('title').classList.add('in');
  }

  // The sheet can be slow or busy during a spike. Let them in and resend on their next visit.
  function saveForLater(d) {
    localStorage.setItem(PENDING, JSON.stringify(d));
    letIn(d.handle, d.room);
  }

  function showError(msg) {
    var e = $('suErr');
    e.textContent = msg;
    e.hidden = false;
  }

  function check(d) {
    if (!/^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/.test(d.handle)) return 'Enter your real Instagram handle.';
    if (!d.room) return 'Pick a room.';
    if (d.reach) {
      var digits = d.reach.replace(/\D/g, '');
      var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.reach);
      var isPhone = /^\+?[\d\s().-]+$/.test(d.reach) && digits.length >= 10 && digits.length <= 15;
      if (!isEmail && !isPhone) return 'Enter a valid email or phone number.';
    }
    if (!d.agree) return 'Check the box to get in.';
    return '';
  }

  $('signup').onsubmit = function (ev) {
    ev.preventDefault();
    $('suErr').hidden = true;
    var d = {
      kind: 'play',
      handle: $('suHandle').value.trim().replace(/^@/, '').toLowerCase(),
      room: $('suRoom').value,
      reach: $('suReach').value.trim(),
      agree: $('suAgree').checked,
      website: $('suTrap').value
    };
    var problem = check(d);
    if (problem) { showError(problem); return; }

    var btn = $('suGo');
    btn.disabled = true;
    btn.textContent = 'SAVING...';
    post(d).then(function (res) {
      if (res.ok) { letIn(d.handle, d.room); return; }
      if (FIXABLE.test(res.error || '')) { showError(res.error); return; }
      saveForLater(d);
    }).catch(function () {
      saveForLater(d);
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'LET ME IN';
    });
  };

  var waiting = localStorage.getItem(PENDING);
  if (waiting) {
    post(JSON.parse(waiting)).then(function (res) {
      if (res.ok) localStorage.removeItem(PENDING);
    }).catch(function () {});
  }

  // Testing on this Mac skips the form and sends nothing. Add ?signup to the address to see it.
  var query = new URLSearchParams(location.search);
  var skipAs = function (name) {
    $('name').value = name;
    localStorage.setItem('imp_name', name);
    $('title').classList.add('in');
  };
  var signed = localStorage.getItem(SIGNED);
  if (signed) letIn(signed, '', true);
  else if (LOCAL && !query.has('signup')) skipAs('brady');
})();
