/* Swimlane-visning for Trello.
 * All data hentes via Trello sitt eget klientbibliotek (postMessage til trello.com).
 * Ingen data sendes til noen annen server. */
const t = window.TrelloPowerUp.iframe();

const LABEL_COLORS = {
  green: '#4bce97', yellow: '#f5cd47', orange: '#fea362', red: '#f87168',
  purple: '#9f8fef', blue: '#579dff', sky: '#6cc3e0', lime: '#94c748',
  pink: '#e774bb', black: '#8590a2'
};
const NONE = '__none__';
const collapsed = new Set();
const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text; // textContent = trygt mot HTML-injeksjon
  return e;
}
function labelColor(c) { return c ? (LABEL_COLORS[c.split('_')[0]] || '#8590a2') : '#8590a2'; }

/* ---- Grupperingsvalg ---- */
function groupOptions(board) {
  const opts = [
    { value: 'label', text: 'Etikett' },
    { value: 'member', text: 'Medlem' }
  ];
  (board.customFields || []).forEach((f) => {
    if (['list', 'text', 'number', 'checkbox'].includes(f.type)) {
      opts.push({ value: 'cf:' + f.id, text: 'Egendefinert felt: ' + f.name });
    }
  });
  return opts;
}

/* Returnerer [{key, name, color}] for én card. Et kort kan havne i flere baner (f.eks. flere etiketter). */
function keysForCard(card, groupBy, board) {
  if (groupBy === 'label') {
    return card.labels && card.labels.length
      ? card.labels.map((l) => ({ key: l.id, name: l.name || '(uten navn)', color: labelColor(l.color) }))
      : [{ key: NONE, name: 'Uten etikett' }];
  }
  if (groupBy === 'member') {
    return card.members && card.members.length
      ? card.members.map((m) => ({ key: m.id, name: m.fullName || m.username }))
      : [{ key: NONE, name: 'Ikke tildelt' }];
  }
  if (groupBy.startsWith('cf:')) {
    const fieldId = groupBy.slice(3);
    const field = (board.customFields || []).find((f) => f.id === fieldId);
    const item = (card.customFieldItems || []).find((i) => i.idCustomField === fieldId);
    if (!field || !item) return [{ key: NONE, name: 'Ikke satt' }];
    if (field.type === 'list') {
      const opt = (field.options || []).find((o) => o.id === item.idValue);
      return opt ? [{ key: opt.id, name: opt.value.text, color: labelColor(opt.color) }]
                 : [{ key: NONE, name: 'Ikke satt' }];
    }
    const v = item.value || {};
    const text = v.text ?? v.number ?? (v.checked === 'true' ? 'Ja' : v.checked === 'false' ? 'Nei' : null);
    return text != null ? [{ key: 'v:' + text, name: String(text) }] : [{ key: NONE, name: 'Ikke satt' }];
  }
  return [{ key: NONE, name: 'Alle kort' }];
}

/* Rekkefølge på baner: følg rekkefølgen definert på tavla der det finnes. */
function laneOrder(groupBy, board) {
  if (groupBy === 'label') return (board.labels || []).map((l) => l.id);
  if (groupBy === 'member') return (board.members || []).map((m) => m.id);
  if (groupBy.startsWith('cf:')) {
    const f = (board.customFields || []).find((x) => x.id === groupBy.slice(3));
    return f && f.options ? f.options.map((o) => o.id) : [];
  }
  return [];
}

/* ---- Tegning ---- */
async function draw() {
  $('#status').textContent = 'Henter tavle …';
  try {
    const [board, lists, saved] = await Promise.all([
      t.board('id', 'name', 'labels', 'members', 'customFields'),
      t.lists('all'),
      t.get('board', 'shared', 'groupBy')
    ]);

    const select = $('#groupBy');
    const opts = groupOptions(board);
    const current = opts.some((o) => o.value === select.value) ? select.value
                  : opts.some((o) => o.value === saved) ? saved : 'label';
    select.replaceChildren(...opts.map((o) => {
      const op = el('option', null, o.text); op.value = o.value; return op;
    }));
    select.value = current;

    // Bygg baner: key -> { name, color, cells: { listId: [cards] }, count }
    const lanes = new Map();
    for (const list of lists) {
      for (const card of list.cards || []) {
        for (const k of keysForCard(card, current, board)) {
          if (!lanes.has(k.key)) lanes.set(k.key, { ...k, cells: {}, count: 0 });
          const lane = lanes.get(k.key);
          (lane.cells[list.id] ||= []).push(card);
          lane.count++;
        }
      }
    }
    // Ta med tomme baner (f.eks. etiketter uten kort) slik at strukturen er stabil
    const order = laneOrder(current, board);
    if (!$('#hideEmpty').checked) {
      if (current === 'label') (board.labels || []).forEach((l) => lanes.has(l.id) || lanes.set(l.id, { key: l.id, name: l.name || '(uten navn)', color: labelColor(l.color), cells: {}, count: 0 }));
      if (current === 'member') (board.members || []).forEach((m) => lanes.has(m.id) || lanes.set(m.id, { key: m.id, name: m.fullName, cells: {}, count: 0 }));
    }
    const sorted = [...lanes.values()].sort((a, b) => {
      if (a.key === NONE) return 1;
      if (b.key === NONE) return -1;
      const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      return a.name.localeCompare(b.name, 'no');
    });

    render(lists, sorted);
    $('#status').textContent = `${board.name}: ${lists.reduce((n, l) => n + (l.cards || []).length, 0)} kort`;
  } catch (err) {
    console.error(err);
    $('#status').textContent = 'Klarte ikke å hente tavla. Lukk og åpne visningen på nytt.';
  }
}

function render(lists, lanes) {
  const root = $('#board');
  if (!lists.length) { root.replaceChildren(el('p', 'empty', 'Tavla har ingen lister ennå.')); return; }

  const grid = el('div', 'grid');
  grid.style.gridTemplateColumns = `minmax(160px, 200px) repeat(${lists.length}, 260px)`;

  grid.append(el('div', 'corner'));
  lists.forEach((l) => grid.append(el('div', 'list-head', l.name)));

  for (const lane of lanes) {
    const isCollapsed = collapsed.has(lane.key);
    const head = el('div', 'lane-head' + (isCollapsed ? ' collapsed' : ''));
    const btn = el('button');
    btn.setAttribute('aria-expanded', String(!isCollapsed));
    btn.append(el('span', 'caret', '▾'));
    if (lane.color) { const s = el('span', 'swatch'); s.style.background = lane.color; btn.append(s); }
    btn.append(el('span', null, lane.name));
    btn.addEventListener('click', () => {
      collapsed.has(lane.key) ? collapsed.delete(lane.key) : collapsed.add(lane.key);
      render(lists, lanes);
    });
    head.append(btn, el('span', 'count', `${lane.count} kort`));
    grid.append(head);

    for (const list of lists) {
      const cell = el('div', 'cell' + (isCollapsed ? ' collapsed-cell' : ''));
      if (!isCollapsed) (lane.cells[list.id] || []).forEach((c) => cell.append(cardEl(c)));
      grid.append(cell);
    }
  }
  root.replaceChildren(grid);
}

function cardEl(card) {
  const c = el('div', 'card');
  c.tabIndex = 0;
  c.setAttribute('role', 'button');
  if (card.labels && card.labels.length) {
    const ls = el('div', 'labels');
    card.labels.forEach((l) => { const s = el('span'); s.style.background = labelColor(l.color); s.title = l.name || ''; ls.append(s); });
    c.append(ls);
  }
  c.append(el('div', null, card.name));
  if (card.members && card.members.length) {
    c.append(el('div', 'meta', card.members.map((m) => m.fullName || m.username).join(', ')));
  }
  const open = () => t.showCard(card.id);
  c.addEventListener('click', open);
  c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return c;
}

/* ---- Hendelser ---- */
$('#groupBy').addEventListener('change', async (e) => {
  collapsed.clear();
  // Lagres i Trello sin egen pluginData på tavla – delt for hele teamet
  await t.set('board', 'shared', 'groupBy', e.target.value);
  draw();
});
$('#hideEmpty').addEventListener('change', draw);

// t.render kalles av Trello når tavla endres, så visningen holder seg oppdatert
t.render(draw);
