// Signup gate. Runs apart from the 3D code, so a signup still saves if the world is slow or can't load.
// Uses the same Google Sheet and script as the RSVP page, so there is one list.
(function () {
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzrXaiwLzOEsHZmQ6K9aYMmTniFYCrApmrzUoanpTTBbgFFlmPjzmujxv4gRQELFUPA/exec';
  var SIGNED = 'imp_signed', PENDING = 'imp_pending', TIMEOUT_MS = 20000;
  var $ = function (id) { return document.getElementById(id); };
  var contact = 'text';

  // Copies running on this Mac never write to the real sheet.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Errors the person can fix in the form. Anything else is the sheet having trouble, not them.
  var FIXABLE = /^(Enter|Pick|Check|You have to be)/;

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
    $('inSub').textContent = room ? 'VIP. ' + room + '.' : 'VIP.';
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
    if (d.contact === 'text') {
      var digits = d.phone.replace(/\D/g, '');
      if (!/^\+?[\d\s().-]+$/.test(d.phone) || digits.length < 10 || digits.length > 15) return 'Enter a valid phone number.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return 'Enter a valid email.';
    if (!d.city) return 'Enter your city.';
    if (!d.room) return 'Pick a room.';
    if (!d.age) return 'Pick your age group.';
    if (d.age === 'under13') return 'You have to be at least 13 to sign up.';
    if (!d.agree) return 'Check the box to get in.';
    return '';
  }

  function setContact(next) {
    contact = next;
    $('suText').classList.toggle('on', next === 'text');
    $('suEmail').classList.toggle('on', next === 'email');
    $('suPhone').hidden = next !== 'text';
    $('suMail').hidden = next !== 'email';
    $('suVerb').textContent = next;
  }

  $('suText').onclick = function () { setContact('text'); };
  $('suEmail').onclick = function () { setContact('email'); };

  $('signup').onsubmit = function (ev) {
    ev.preventDefault();
    $('suErr').hidden = true;
    var d = {
      handle: $('suHandle').value.trim().replace(/^@/, '').toLowerCase(),
      contact: contact,
      phone: contact === 'text' ? $('suPhone').value.trim() : '',
      email: contact === 'email' ? $('suMail').value.trim() : '',
      city: $('suCity').value.trim(),
      room: $('suRoom').value,
      age: $('suAge').value,
      agree: $('suAgree').checked,
      roster: false, picture: '',
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

  var signed = localStorage.getItem(SIGNED);
  if (signed) letIn(signed, '', true);
  // Testing on this Mac skips the form. Add ?signup to the address to see it.
  else if (LOCAL && !/[?&]signup\b/.test(location.search)) {
    $('name').value = 'brady';
    localStorage.setItem('imp_name', 'brady');
    $('title').classList.add('in');
  }
})();
