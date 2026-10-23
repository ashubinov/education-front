/* LearnQuest — «Пасека» (#/farm/apiary): ульи, цветы со склада, мёд, продажа, улучшения. Всё считает сервер (/api/apiary/*), пчёлы работают и пока тебя нет.
   Здесь — сцена (рисуется кодом), таймеры и кнопки. Общий каркас — loc-kit.js. */
'use strict';

const AP_HIVES = [[3.0, 3.0], [4.9, 3.0], [6.8, 3.0], [8.7, 3.0], [3.0, 5.5], [4.9, 5.5], [6.8, 5.5], [8.7, 5.5]];
const AP_COL = { clover: '#e0c070', sunflower: '#f2cb3b', berry: '#e27b9b', pumpkin: '#ee9c45' };
Object.assign(SFX, { apBuzz: () => tone([392, 440, 392], .05, 'sawtooth', .03) });

const AP = locKit({
  api: '/apiary', hash: /^#\/farm\/apiary$/, name: 'Пасека', page: s => apPage(s),
  events(events) {
    const got = {};
    for (const e of events) {
      if (e.type === 'honey') got[e.honey] = (got[e.honey] || 0) + e.qty;
      if (e.type === 'discover') { const h = apHoney(e.honey); play('fmLevel'); confetti(90); toast(`${h.name}: первая баночка! Бонус 💰 ${slFmt(e.bonus)}`, { icon: h.icon, title: 'Новый вид мёда' }); }
    }
    const list = Object.entries(got).map(([k, q]) => `${apHoney(k).icon} ${apHoney(k).name} ×${q}`);
    if (list.length) toast(list.join(', '), { icon: '🍯', title: 'Мёд собран', ms: 2400 });
  },
});
const apHoney = id => AP.K.st.honey.find(h => h.id === id);
const apFlower = id => AP.K.st.flowers.find(f => f.id === id);
const apJars = () => Object.values(AP.K.st.inv).reduce((a, b) => a + b, 0);

function apPage(s) {
  const ready = s.hives.filter(h => h.state === 'ready').length, n = apJars();
  const found = s.honey.filter(h => h.discovered).length;
  return locPage({ cls: 'ap', label: 'Пасека', svg: apScene(s), tip: 'Нажимай на ульи, прилавок с мёдом и домик пасечника. Пчёлы работают и без тебя, пока у них есть цветы.',
    hud: [{ title: 'Пасека', text: '🐝 <b>Пасека</b>' }, { title: 'Монеты фермы', text: `💰 <b>${slFmt(s.coins)}</b>` }, { title: 'Банок мёда', text: `🍯 <b>${n}</b>` }, { title: 'Видов мёда', text: `📖 <b>${found}/${s.honey.length}</b>` }].map(p => ({ ...p, text: raw(p.text) })),
    dock: [{ act: 'apCollectAll', icon: '🧺', text: 'Собрать', off: !ready, badge: ready || '' }, { act: 'apStand', icon: '🍯', text: 'Мёд', badge: n || '' },
      { act: 'apUpgrades', icon: '⚙️', text: 'Улучшения', badge: locAffordable(s) ? '↑' : '' }, { act: 'apExit', icon: '🌾', text: 'На ферму' }] });
}

/* ---------------- сцена ---------------- */
function apHiveSvg(h, st) {
  const [x, y] = AP_HIVES[h.slot], col = h.flower ? AP_COL[st.flowers.find(f => f.id === h.flower).honey] : '#cdbb98', w = .9, d = .9, hh = 34;
  const body = faBox(x, y, w, d, hh, col)
    + [8, 17, 26].map(z => faLine([x, y + d, z], [x + w, y + d, z], 'rgba(255,255,255,.55)', 2.2) + faLine([x + w, y, z], [x + w, y + d, z], 'rgba(0,0,0,.18)', 2)).join('')
    + faPoly([[x + w * .3, y + d, 3], [x + w * .7, y + d, 3], [x + w * .7, y + d, 9], [x + w * .3, y + d, 9]], '#3b2a1e')
    + faPoly([[x - .08, y - .08, hh + 5], [x + w + .08, y - .08, hh + 5], [x + w + .08, y + d + .08, hh + 5], [x - .08, y + d + .08, hh + 5]], '#7a5030', 'stroke="#4f3320" stroke-width="2"')
    + faPoly([[x - .08, y + d + .08, hh], [x + w + .08, y + d + .08, hh], [x + w + .08, y + d + .08, hh + 5], [x - .08, y + d + .08, hh + 5]], '#6a4528');
  const bees = h.state === 'empty' ? '' : [0, 1, 2].map(i => `<g transform="${lcP(x + w / 2, y + d / 2, hh + 14)}"><g class="fs-wander" style="--ax:${(i - 1) * 22}px;--ay:${-8 - i * 4}px;animation-duration:${3.2 + i * .8}s;animation-delay:${i * -.7}s"><ellipse rx="3.6" ry="2.6" fill="#ffd23f" stroke="#3b2a1e" stroke-width=".8"/><path d="M-1 -2.6 v5.2 M1.4 -2.4 v4.8" stroke="#3b2a1e" stroke-width=".9"/></g></g>`).join('');
  const cx = x + w / 2, cy = y + d / 2;
  let info;
  if (h.state === 'ready') info = faBubble(cx, cy, hh + 54, '🍯×' + h.jars, h.full ? 'ready' : '');
  else if (h.state === 'working') info = faRing(cx, cy, hh + 40, h.next_in, h.cycle, apFlower(h.flower).icon);
  else info = faBubble(cx, cy, hh + 50, h.state === 'idle' ? '🌼' : '＋', 'add');
  return `<g class="fs-hit" data-act="apHive" data-i="${h.slot}" aria-label="Улей ${h.slot + 1}"><ellipse cx="${faX(cx, cy).toFixed(1)}" cy="${(faY(cx, cy) + 4).toFixed(1)}" rx="40" ry="14" fill="rgba(0,0,0,.16)"/>${body}${bees}</g><g style="pointer-events:none">${info}</g>`;
}
function apStandSvg(st) {
  const x = .9, y = 6.9, n = Math.min(10, apJars()), inv = st.inv;
  return `<g class="fs-hit" data-act="apStand" aria-label="Прилавок с мёдом">` + faBox(x, y, 1.8, .9, 24, '#c9955a')
    + faPoly([[x - .06, y - .06, 24], [x + 1.86, y - .06, 24], [x + 1.86, y + .96, 24], [x - .06, y + .96, 24]], '#e3b87a', 'stroke="#8a5f30" stroke-width="2"')
    + Array.from({ length: Math.max(n, 1) }, (_, i) => { const px = x + .25 + (i % 5) * .32, py = y + .2 + Math.floor(i / 5) * .4; return n ? `<g transform="${lcP(px, py, 24)}"><rect x="-6" y="-14" width="12" height="14" rx="3" fill="#f2b632" stroke="#8a5f30" stroke-width="1.4"/><rect x="-5" y="-17" width="10" height="4" rx="1.5" fill="#fff6e0" stroke="#8a5f30" stroke-width="1"/></g>` : ''; }).join('')
    + `<g transform="${lcP(x + .9, y + .95, 46)}"><rect x="-34" y="-9" width="68" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8fff4">МЁД ${apJars() ? '· ' + apJars() : ''}</text></g></g>`
    + (Object.keys(inv).length ? '' : '');
}
function apScene(st) {
  const N = 11, objs = [], add = (d, svg) => objs.push({ d, svg });
  let g = locBase('ap', N, { grass: ['#a8e07a', '#86cc5c'], side: ['#6b8f3a', '#527030'], seed: 21, deco: 150, blades: .55, dots: ['#fff', '#ffd54a', '#ff9ec2', '#b9a1ff'] });
  [[2.4, 4.2], [5.9, 4.2], [7.8, 4.2], [4.0, 4.2], [9.6, 4.2], [2.2, 6.7], [5.8, 7.3], [8.2, 7.2]].forEach(([x, y], i) => {
    g += `<g transform="${lcP(x, y)}">` + [[-8, 2, '#ff6f91'], [0, -2, '#ffd54a'], [8, 3, '#b39cff'], [-3, 6, '#fff'], [5, 8, '#ff9ec2']].map(([dx, dy, c], k) => `<circle cx="${dx}" cy="${dy - 4}" r="${3.4 + (i + k) % 2}" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width=".8"/><path d="M${dx} ${dy - 1} v5" stroke="#5aa043" stroke-width="1.6"/>`).join('') + '</g>';
  });
  add(.4 + 1.2 + 1.8, locHut(.4, 1.2, 2.1, 1.8, 40, '#f0d9a0', '#c0612b', 'ПАСЕЧНИК', 'apUpgrades', 'Домик пасечника', locAffordable(st)));
  add(.9 + 6.9 + .9, apStandSvg(st));
  add(1, locSign(.6, 9.6, 'НА ФЕРМУ', 'apExit', 'На ферму'));
  st.hives.forEach(h => add(AP_HIVES[h.slot][0] + AP_HIVES[h.slot][1] + 1, apHiveSvg(h, st)));
  if (st.hives.length < st.max_hives) { const c = st.upgrades.find(u => u.key === 'hives').cost; if (c != null) { const [x, y] = AP_HIVES[st.hives.length]; add(x + y + 1, locBuy(x + .45, y + .45, 6, 'apUpgrades', c, st.coins, 'Новый улей')); } }
  [[.3, 4.8, 'oak'], [10.4, 1.2, 'pine'], [10.6, 9.8, 'oak'], [3.8, 10.5, 'pine'], [9.8, 8.4, 'oak'], [5.6, .4, 'pine'], [8.4, .5, 'oak']].forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 13 + 4)));
  return g + objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
}

/* ---------------- действия и окна ---------------- */
actions.apExit = () => { closeModal(); location.hash = '#/farm'; };
actions.apCollectAll = () => AP.act('collect', {}, 'fmHarvest');
actions.apUpgrade = b => AP.act('upgrade', { key: b.dataset.key }, 'fmCoin', true);
actions.apFlowers = b => AP.act('flowers', { hive: +b.dataset.hive, flower: b.dataset.flower }, 'apBuzz');
actions.apSell = async b => { const r = await AP.act('sell', b.dataset.honey ? { honey: b.dataset.honey } : {}, 'fmCoin', true); if (r) toast(`+${slFmt(r.sold.coins)} монет за ${r.sold.qty} шт.`, { icon: '💰', ms: 1500 }); };
actions.apUpgrades = () => AP.show(() => AP.panel('⚙️ Домик пасечника', locUpgradesBody(AP.K.st, 'apUpgrade')));

actions.apHive = b => {
  const i = +b.dataset.i, h = AP.K.st.hives[i];
  if (!h) return;
  if (h.state === 'ready') return AP.act('collect', { hive: i }, 'fmHarvest');
  AP.show(() => {
    const s = AP.K.st, r = s.hives[i];
    if (!r) return;
    if (r.state === 'working') {
      const f = apFlower(r.flower), hn = apHoney(f.honey);
      return AP.panel(`🐝 Улей ${i + 1}`, html`<p class="muted" style="margin:0 0 8px">Цветы: ${f.icon} ${f.name}. Следующая баночка ${hn.icon} через <b>${fmTimer(r.next_in)}</b></p>${fmBar(r.next_in, r.cycle)}
        <div class="la-row"><span>Цена баночки</span><b>💰 ${slFmt(hn.price)}</b></div><div class="la-row"><span>Цветов хватит ещё на</span><b>${r.left == null ? 'бесконечно' : r.left + ' ' + plural(r.left, 'цикл', 'цикла', 'циклов')}</b></div>
        ${f.id === 'clover' ? html`<p class="muted small">Луга бесплатны. Можно сменить цветы на дорогие: мёд будет ценнее.</p><div class="fm-seeds">${s.flowers.filter(x => x.id !== 'clover').map(x => apFlowerCard(x, i))}</div>` : ''}${locCloseBtn}`);
    }
    AP.panel(`🐝 Улей ${i + 1}: на какие цветы?`, html`<p class="muted small" style="margin:0 0 6px">Цветы со склада фермы тратятся (одна штука на несколько циклов), луга бесплатны. Чем дороже цветы, тем дороже мёд.</p>
      <div class="fm-seeds">${s.flowers.map(x => apFlowerCard(x, i))}</div>${locCloseBtn}`);
  });
};
function apFlowerCard(f, hive) {
  const none = f.item && f.have < 1, hn = apHoney(f.honey);
  return html`<button class="fm-seed ap-flower" data-act="apFlowers" data-hive="${hive}" data-flower="${f.id}" ${none ? 'disabled' : ''}>
    <span class="fm-seed-ic">${f.icon}</span><b>${f.name}</b><span class="small">${hn.icon} 💰 ${slFmt(hn.price)} · ⏱ ${fmClock(f.cycle)}</span>
    <span class="small ${none ? 'no' : 'muted'}">${f.item ? (none ? 'нет на складе фермы' : `${ITEM_ICON_OF(f)} на складе: ${f.have} · на ${f.lasts} циклов`) : 'бесплатно, бесконечно'}</span></button>`;
}
const ITEM_ICON_OF = f => (FARM.st && FARM.st.catalog && FARM.st.catalog.items[f.item]) ? FARM.st.catalog.items[f.item].icon : f.icon;

actions.apStand = () => AP.show(() => {
  const s = AP.K.st, ids = Object.keys(s.inv).filter(k => s.inv[k] > 0).sort((a, b) => apHoney(b).price - apHoney(a).price);
  const total = ids.reduce((a, k) => a + s.inv[k] * apHoney(k).price, 0);
  const list = ids.length ? html`<div class="la-sell">${ids.map(k => { const h = apHoney(k), q = s.inv[k];
    return html`<div class="la-sell-r"><span class="la-sell-ic">${h.icon}</span><div class="grow"><b>${h.name}</b><div class="small muted">×${q} · по 💰 ${slFmt(h.price)}</div></div><button class="btn sm" data-act="apSell" data-honey="${k}">Продать 💰 ${slFmt(h.price * q)}</button></div>`; })}</div>
    <div class="row mt"><button class="btn" data-act="apSell">Продать всё · 💰 ${slFmt(total)}</button></div>` : html`<p class="muted" style="margin:0">Банок пока нет. Дождись, пока пчёлы наработают мёд, и собери его в ульях.</p>`;
  AP.panel('🍯 Прилавок с мёдом', html`${list}<h3 class="la-h">Виды мёда <span class="muted small">${s.honey.filter(h => h.discovered).length}/${s.honey.length}</span></h3><div class="la-grid">${s.honey.map(h => h.discovered
    ? html`<div class="la-j t${h.tier || 4}"><span class="la-j-ic">${h.icon}</span><b class="small">${h.name}</b><span class="small muted">💰 ${slFmt(h.price)}</span></div>`
    : html`<div class="la-j unk"><span class="la-j-ic">❔</span><b class="small">???</b><span class="small muted">не собран</span></div>`)}</div>
    <p class="muted small" style="margin:8px 0 0">Первая баночка нового вида даёт бонус открытия — втрое больше её цены. Цены меняются каждый день (сейчас оценщик +${Math.round(s.bonus * 100)}%).</p>${locCloseBtn}`);
});
