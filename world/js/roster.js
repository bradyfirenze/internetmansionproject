// Who chose each room, with their city. DRAFT: local copies show made-up test names and nothing else.
// Going live means a new read-only address that returns only opted-in, reviewed people, as { handle, city, room }.
// A missing city shows as "City not shown". Age never comes to the browser.

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// Game areas that count as each of the 10 rooms people can choose
const ROOM_FOR = {
  stadium: 'Sports Stadium', field: 'Sports Stadium', locker: 'Sports Stadium', 'team-tunnel': 'Sports Stadium',
  'gaming-room': 'Gaming Room', backyard: 'Backyard Party', party: 'Party Room', 'chill-lounge': 'Chill Lounge',
  'music-studio': 'Music Studio', 'art-gallery': 'Art Gallery', 'designer-closet': 'Designer Closet',
  'hot-rod-garage': 'Hot Rod Garage', 'movie-theater': 'Movie Theater',
};

export function buildRoster(game) {
  const $ = (id) => document.getElementById(id);
  let people = [], here = null, shown = null;

  const render = () => {
    const inRoom = people.filter((p) => p.room === here);
    $('rosterTitle').textContent = here.toUpperCase();
    $('rosterCount').textContent = `${inRoom.length} ${inRoom.length === 1 ? 'person' : 'people'} chose this room`;
    const cities = [...new Set(inRoom.map((p) => p.city).filter(Boolean))].sort();
    const pick = $('rosterCity'), want = cities.includes(pick.value) ? pick.value : '';
    pick.replaceChildren(new Option('All cities', ''), ...cities.map((n) => new Option(n, n))); pick.value = want;
    const list = inRoom.filter((p) => !want || p.city === want).sort((a, b) => a.handle.localeCompare(b.handle));
    // Handles and cities are typed by people, so they only ever go in as plain text
    $('rosterList').replaceChildren(...list.map((p) => {
      const row = document.createElement('div'), h = document.createElement('b'), c = document.createElement('span');
      row.className = 'rosterRow'; h.textContent = '@' + p.handle; c.textContent = p.city || 'City not shown'; if (!p.city) c.className = 'none';
      row.append(h, c); return row;
    }));
  };

  const syncButton = () => {
    const n = here ? people.filter((p) => p.room === here).length : 0, b = $('rosterBtn');
    b.hidden = !n; if (!n) return;
    $('rosterBtnText').textContent = `${n} chose this room`;
    if (shown !== here) { shown = here; if (!$('roster').hidden) render(); }
  };

  game.toggleRoster = () => {
    if (!here || $('rosterBtn').hidden) return false;
    render(); return true;
  };
  game.setRosterRoom = (roomId) => { here = ROOM_FOR[roomId] || null; syncButton(); };
  $('rosterCity').onchange = render;

  if (LOCAL) fetch('assets/roster_test.json').then((r) => r.json()).then((d) => { people = d.people; syncButton(); }).catch(() => {});
}
