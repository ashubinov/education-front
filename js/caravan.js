/* LearnQuest — «Торговый тракт» (#/farm/caravan): повозки везут товары со склада фермы в дальние города, спрос меняется каждый день, в пути бывают разбойники.
   Всё считает сервер (/api/caravan/*). Здесь — сцена (рисуется кодом), таймеры и кнопки. Общий каркас — loc-kit.js. */
'use strict';

const CV_X = [2.0, 4.3, 6.6, 8.9];
const CV = locKit({
  api: '/caravan', hash: /^#\/farm\/caravan$/, name: 'Торговый тракт', page: s => cvPage(s),
  events(events) {
    for (const e of events) {
      if (e.type !== 'trade') continue;
      const t = cvTown(e.town);
      play(e.bandits ? 'mnCave' : 'fmCoin');
      if (e.bandits) toast(`На тракте напали разбойники: из ${slFmt(e.coins + e.lost)} монет удалось довезти ${slFmt(e.coins)}. Охрана снижает риск`, { icon: '🏴‍☠️', title: t.name });
      else toast(`+💰 ${slFmt(e.coins)}`, { icon: t.icon, title: `Караван вернулся из города «${t.name}»` });
    }
  },
});
const cvTown = id => CV.K.st.towns.find(t => t.id === id);
const cvItem = id => CV.K.st.items[id];
const CVN = { sel: null, wagon: 0 };

function cvPage(s) {
  const ready = s.wagons.filter(w => w.state === 'ready').length, away = s.wagons.filter(w => w.state === 'away').length;
  return locPage({ cls: 'cv', label: 'Торговый тракт', svg: cvScene(s), tip: 'Нажимай на повозки, доску спроса и контору. Повозка едет и без тебя, а за ходовой товар города платят в полтора раза больше.',
    hud: [{ title: 'Торговый тракт', text: '🐎 <b>Тракт</b>' }, { title: 'Монеты фермы', text: `💰 <b>${slFmt(s.coins)}</b>` }, { title: 'Повозок в пути', text: `🛒 <b>${away}/${s.wagons.length}</b>` },
      { title: 'Рейсов всего', text: `🧭 <b>${s.stats.trips}</b>` }].map(p => ({ ...p, text: raw(p.text) })),
    dock: [{ act: 'cvCollectAll', icon: '💰', text: 'Забрать', off: !ready, badge: ready || '' }, { act: 'cvBoard', icon: '📋', text: 'Спрос' },
      { act: 'cvUpgrades', icon: '⚙️', text: 'Улучшения', badge: locAffordable(s) ? '↑' : '' }, { act: 'cvExit', icon: '🌾', text: 'На ферму' }] });
}

/* ---------------- сцена ---------------- */
function cvWagonSvg(w, st) {
  const x = CV_X[w.slot], y = 4.7, away = w.state === 'away';
  const body = `<g transform="${lcP(x, y)}"${away ? ' opacity=".22"' : ''}><ellipse cy="8" rx="52" ry="15" fill="rgba(0,0,0,.2)"/>`
    + `<rect x="-38" y="-22" width="76" height="22" rx="4" fill="#9a6c3e" stroke="#3b2a1e" stroke-width="2.4"/><path d="M-38 -10 H38" stroke="#6f4a28" stroke-width="2"/>`
    + `<path d="M-34 -22 Q-34 -62 0 -62 Q34 -62 34 -22Z" fill="#f4ead2" stroke="#8a7a58" stroke-width="2.4"/><path d="M-18 -22 Q-18 -56 0 -58 M18 -22 Q18 -56 0 -58" stroke="#c9b98f" stroke-width="2" fill="none"/>`
    + `<path d="M38 -14 H58" stroke="#5b3a22" stroke-width="4"/><circle cx="-22" cy="2" r="11" fill="#6f4a28" stroke="#2b1e12" stroke-width="3"/><circle cx="22" cy="2" r="11" fill="#6f4a28" stroke="#2b1e12" stroke-width="3"/>`
    + `<path d="M-22 -9 V13 M-33 2 H-11 M22 -9 V13 M11 2 H33" stroke="#2b1e12" stroke-width="2"/></g>`;
  let info;
  if (w.state === 'ready') info = faBubble(x, y, 84, '💰', 'ready');
  else if (away) info = faRing(x, y, 70, w.left, w.total, cvTown(w.town).icon);
  else info = faBubble(x, y, 84, '＋', 'add');
  return `<g class="fs-hit" data-act="cvWagon" data-i="${w.slot}" aria-label="Повозка ${w.slot + 1}">${body}<rect x="${(faX(x, y) - 50).toFixed(1)}" y="${(faY(x, y, 70)).toFixed(1)}" width="100" height="80" fill="rgba(0,0,0,0)"/></g><g style="pointer-events:none">${info}</g>`;
}
function cvBoardSvg(st) {
  const x = 5.2, y = 2.4;
  return `<g class="fs-hit" data-act="cvBoard" aria-label="Доска спроса"><g transform="${lcP(x, y)}"><ellipse cy="3" rx="52" ry="13" fill="rgba(0,0,0,.18)"/><rect x="-44" y="-70" width="7" height="72" fill="#6b4426"/><rect x="37" y="-70" width="7" height="72" fill="#6b4426"/>`
    + `<rect x="-52" y="-118" width="104" height="58" rx="5" fill="#f5ead0" stroke="#7a5430" stroke-width="3.4"/><text y="-100" text-anchor="middle" font-size="11" font-weight="900" fill="#5a3d00">ДОСКА СПРОСА</text>`
    + st.towns.filter(t => !t.locked).slice(0, 4).map((t, i) => `<text x="${-42 + i * 28}" y="-76" font-size="17">${t.icon}</text>`).join('')
    + `<text y="-64" x="-46" font-size="9" font-weight="800" fill="#7a5430">кто что хочет сегодня</text></g></g>`;
}
function cvScene(st) {
  const N = 11, objs = [], add = (d, svg) => objs.push({ d, svg });
  let g = locBase('cv', N, { grass: ['#b6df7c', '#97c862'], side: ['#6b8f3a', '#527030'], seed: 14, deco: 90 });
  const road = (y0, y1, c, ex = '') => faPoly([[0, y0, 0], [N, y0, 0], [N, y1, 0], [0, y1, 0]], c, ex);
  g += road(3.9, 5.7, '#cbaa72', 'stroke="#a98a54" stroke-width="2"') + road(4.1, 5.5, '#d9bb84');
  for (let x = .3; x < N; x += .9) g += faLine([x, 4.5, 0], [x + .4, 4.5, 0], '#b8975f', 2) + faLine([x + .2, 5.1, 0], [x + .6, 5.1, 0], '#b8975f', 2);
  [[1.5, 3.9], [5.0, 5.7], [9.4, 3.9], [3.4, 5.7], [7.3, 5.7]].forEach(([x, y]) => { g += `<g transform="${lcP(x, y)}"><ellipse rx="8" ry="3" fill="#a79a85"/></g>`; });
  st.wagons.forEach(w => add(CV_X[w.slot] + 4.7 + 1, cvWagonSvg(w, st)));
  if (st.wagons.length < st.max_wagons) { const c = st.upgrades.find(u => u.key === 'wagons').cost; if (c != null) add(CV_X[st.wagons.length] + 5.7, locBuy(CV_X[st.wagons.length], 4.7, 6, 'cvUpgrades', c, st.coins, 'Новая повозка')); }
  add(5.2 + 2.4, cvBoardSvg(st));
  add(.4 + 1.2 + 2, locHut(.4, 1.0, 2.4, 2.0, 44, '#e6cfa0', '#8a3b2e', 'КОНТОРА', 'cvUpgrades', 'Контора', locAffordable(st)));
  add(.5 + 7.4 + 2, locHut(.5, 7.4, 2.6, 2.0, 40, '#d0b48a', '#46688c', 'СКЛАД ФЕРМЫ', 'cvExit', 'Склад (на ферму)', false));
  add(1, locSign(10.0, 9.7, 'НА ФЕРМУ', 'cvExit', 'На ферму'));
  [[5.6, 8.0], [3.6, 7.2], [8.2, 8.0]].forEach(([x, y]) => add(x + y, `<g transform="${lcP(x, y)}"><ellipse cy="2" rx="14" ry="5" fill="rgba(0,0,0,.18)"/>${faBox2()}</g>`));
  [[7.6, .5, 'pine'], [9.4, 1.2, 'oak'], [10.5, 2.4, 'pine'], [10.5, 7.8, 'oak'], [4.6, 10.4, 'pine'], [8.0, 10.2, 'oak']].forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 19 + 6)));
  return g + objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
}
const faBox2 = () => `<rect x="-11" y="-16" width="22" height="16" fill="#b98a56" stroke="#5e4020" stroke-width="2"/><path d="M-11 -8 H11 M0 -16 V0" stroke="#7a5430" stroke-width="1.6"/>`;

/* ---------------- действия и окна ---------------- */
actions.cvExit = () => { closeModal(); location.hash = '#/farm'; };
actions.cvCollectAll = () => CV.act('collect', {}, 'fmCoin');
actions.cvUpgrade = b => CV.act('upgrade', { key: b.dataset.key }, 'fmCoin', true);
actions.cvUpgrades = () => CV.show(() => CV.panel('⚙️ Контора тракта', locUpgradesBody(CV.K.st, 'cvUpgrade')));

actions.cvWagon = b => {
  const i = +b.dataset.i, w = CV.K.st.wagons[i];
  if (!w) return;
  if (w.state === 'ready') return CV.act('collect', { wagon: i }, 'fmCoin');
  CVN.wagon = i;
  CV.show(() => {
    const s = CV.K.st, r = s.wagons[i];
    if (!r) return;
    if (r.state === 'away') {
      const t = cvTown(r.town);
      return CV.panel(`🛒 Повозка ${i + 1} → ${t.icon} ${t.name}`, html`<p class="muted" style="margin:0 0 8px">Вернётся через <b>${fmTimer(r.left)}</b>. Выручка зафиксирована при отправке: <b>💰 ${slFmt(r.payout)}</b>${t.risk ? ` (разбойники нападают с шансом ${Math.round(t.risk * 100)}%)` : ''}.</p>${fmBar(r.left, r.total)}
        <div class="la-row"><span>Груз</span><b>${Object.entries(r.cargo).map(([k, q]) => `${cvItem(k).icon}×${q}`).join(' ')}</b></div>${locCloseBtn}`);
    }
    cvSendPanel(s, i);
  });
};
function cvSendPanel(s, i) {
  const open = s.towns.filter(t => !t.locked);
  if (!CVN.sel || !open.some(t => t.id === CVN.sel)) CVN.sel = open[0].id;
  const t = cvTown(CVN.sel), ids = Object.keys(s.stock).filter(k => s.stock[k] > 0 && s.items[k]);
  const rows = ids.length ? ids.map(k => { const it = s.items[k], want = t.wanted.includes(k);
    return html`<div class="cv-row ${want ? 'want' : ''}"><span class="cv-ic">${it.icon}</span><div class="grow"><b>${it.name}</b>${want ? html` <span class="cv-star" title="Ходовой товар: платят в ${s.want_mult} раза больше">⭐</span>` : ''}
      <div class="small muted">на складе ${s.stock[k]} · 💰 ${t.price[k]} за шт. <span class="muted">(рынок фермы ~${it.price})</span></div></div>
      <input class="cv-qty" type="number" min="0" max="${s.stock[k]}" value="${(CVN.cargo || {})[k] || 0}" data-item="${k}" inputmode="numeric"><button class="btn sm ghost" data-act="cvMax" data-item="${k}" title="Положить сколько влезет">Макс</button></div>`; })
    : html`<p class="muted">На складе фермы пусто — нечего везти. Вырасти урожай или приготовь блюда.</p>`;
  CV.panel(`🛒 Повозка ${i + 1}: что и куда везти?`, html`<div class="cv-towns">${s.towns.map(x => html`<button class="cv-town ${x.id === CVN.sel ? 'on' : ''}" data-act="cvTown" data-town="${x.id}" ${x.locked ? 'disabled' : ''}>
      <span class="cv-t-ic">${x.icon}</span><b>${x.name}</b><span class="small">${x.locked ? '🔒 дороги' : `⏱ ${fmClock(x.time)} · ×${x.mult}`}</span><span class="small ${x.risk ? 'no' : 'muted'}">${x.locked ? '' : x.risk ? `разбойники ${Math.round(x.risk * 100)}%` : 'безопасно'}</span></button>`)}</div>
    <div class="cv-list">${rows}</div>
    <div class="cv-sum"><span id="cvSum">Выбрано: 0 / ${s.cargo_cap} · выручка 💰 0</span><button class="btn" id="cvGo" data-act="cvGo" data-wagon="${i}" disabled>Отправить</button></div>${locCloseBtn}`);
  cvRecalc();
}
function cvRead() {
  const cargo = {};
  $$('.modal .cv-qty').forEach(el => { const q = Math.max(0, Math.min(+el.max || 0, Math.floor(+el.value || 0))); if (q) cargo[el.dataset.item] = q; });
  return cargo;
}
function cvRecalc() {
  const s = CV.K.st, t = cvTown(CVN.sel), cargo = cvRead(), n = Object.values(cargo).reduce((a, b) => a + b, 0), pay = Object.entries(cargo).reduce((a, [k, q]) => a + t.price[k] * q, 0);
  const sum = $('#cvSum'), go = $('#cvGo'); if (!sum || !go) return;
  sum.innerHTML = `Выбрано: <b class="${n > s.cargo_cap ? 'no' : ''}">${n} / ${s.cargo_cap}</b> · выручка 💰 <b>${slFmt(pay)}</b>`;
  go.disabled = !n || n > s.cargo_cap;
}
document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('cv-qty')) cvRecalc(); });
actions.cvTown = b => { CVN.cargo = cvRead(); CVN.sel = b.dataset.town; closeModal(); const f = () => { CV.show(() => { cvSendPanel(CV.K.st, CVN.wagon); }); }; f(); };
actions.cvMax = b => {
  const s = CV.K.st, cargo = cvRead(), k = b.dataset.item, others = Object.entries(cargo).filter(([i]) => i !== k).reduce((a, [, q]) => a + q, 0);
  const el = $(`.modal .cv-qty[data-item="${k}"]`); el.value = Math.max(0, Math.min(s.stock[k], s.cargo_cap - others)); cvRecalc();
};
actions.cvGo = async b => {
  const cargo = cvRead();
  const r = await CV.act('send', { wagon: +b.dataset.wagon, town: CVN.sel, cargo }, 'fmPlant');
  if (r) { CVN.cargo = {}; toast('Караван отправился в путь', { icon: cvTown(CVN.sel).icon, ms: 1800 }); }
};
actions.cvBoard = () => CV.show(() => {
  const s = CV.K.st;
  CV.panel('📋 Доска спроса', html`<p class="muted small" style="margin:0 0 6px">Каждый день в каждом городе два ходовых товара (⭐): за них платят в ${s.want_mult} раза больше. Цены на тракте выше рынка фермы, но повозка уходит надолго.</p>
    ${s.towns.map(t => html`<div class="cv-bd ${t.locked ? 'locked' : ''}"><div class="cv-bd-h"><span class="cv-t-ic">${t.icon}</span><b>${t.name}</b><span class="small muted">${t.locked ? '🔒 дороги не построены' : `⏱ ${fmClock(t.time)} · ×${t.mult} · разбойники ${Math.round(t.risk * 100)}%`}</span></div>
      ${t.locked ? '' : html`<div class="cv-want">${t.wanted.map(k => html`<span class="chip warn">⭐ ${cvItem(k).icon} ${cvItem(k).name}: 💰 ${t.price[k]}</span>`)}</div>`}</div>`)}${locCloseBtn}`);
});
