/* LearnQuest — «Шахта» (#/farm/mine): штреки, смены шахтёров с едой со склада, руда, продажа, улучшения. Всё считает сервер (/api/mine/*),
   добыча определяется при отправке смены. Здесь — сцена (рисуется кодом), таймеры и кнопки. Общий каркас — loc-kit.js. */
'use strict';

const MN_X = [1.5, 3.1, 4.7, 6.3, 7.9, 9.5];
Object.assign(SFX, { mnPick: () => tone([220, 262, 196], .06, 'square', .04), mnCave: () => tone([110, 82, 65], .12, 'sawtooth', .05) });

const MN = locKit({
  api: '/mine', hash: /^#\/farm\/mine$/, name: 'Шахта', page: s => mnPage(s),
  events(events) {
    const got = {};
    for (const e of events) {
      if (e.type === 'ore') got[e.ore] = (got[e.ore] || 0) + e.qty;
      if (e.type === 'discover') { const o = mnOre(e.ore); play('fmLevel'); confetti(e.ore === 'diamond' ? 220 : 90); toast(`${o.name}: первый образец! Бонус 💰 ${slFmt(e.bonus)}`, { icon: o.icon, title: 'Новая руда в коллекции' }); }
      if (e.type === 'cave') { play('mnCave'); toast('В забое случился обвал: добыча вдвое меньше. Крепь снижает риск', { icon: '🪨', title: 'Обвал!' }); }
      if (e.type === 'full') toast(`Вагонетки полны: ещё ${e.left} смен ждут. Продай руду или купи вагонетки`, { icon: '🛒' });
    }
    const list = Object.entries(got).map(([k, q]) => `${mnOre(k).icon} ${mnOre(k).name} ×${q}`);
    if (list.length) toast(list.join(', '), { icon: '⛏️', title: 'Добыча', ms: 2600 });
  },
});
const mnOre = id => MN.K.st.ores.find(o => o.id === id);
const mnTier = n => MN.K.st.tiers.find(t => t.tier === n);

function mnPage(s) {
  const ready = s.shafts.filter(x => x.state === 'ready').length;
  const found = s.ores.filter(o => o.discovered).length;
  return locPage({ cls: 'mn', label: 'Шахта', svg: mnScene(s), tip: 'Нажимай на штреки, вагонетку с рудой, домик штейгера и лифт. Смена идёт и без тебя, а шахтёрам нужна еда с кухни фермы.',
    hud: [{ title: 'Шахта', text: '⛏️ <b>Шахта</b>' }, { title: 'Монеты фермы', text: `💰 <b>${slFmt(s.coins)}</b>` }, { title: 'Вагонетки', text: `🛒 <b>${s.cart_used}/${s.cart_cap}</b>`, full: s.cart_used >= s.cart_cap },
      { title: 'Руд в коллекции', text: `📖 <b>${found}/${s.ores.length}</b>` }].map(p => ({ ...p, text: raw(p.text) })),
    dock: [{ act: 'mnCollectAll', icon: '⛏️', text: 'Забрать', off: !ready, badge: ready || '' }, { act: 'mnCart', icon: '🛒', text: 'Руда', badge: s.cart_used || '' },
      { act: 'mnUpgrades', icon: '⚙️', text: 'Улучшения', badge: locAffordable(s) ? '↑' : '' }, { act: 'mnExit', icon: '🌾', text: 'На ферму' }] });
}

/* ---------------- сцена ---------------- */
function mnMountain() {
  const N = 11, rock = '#8d8f9c', rock2 = '#74778a', lit = '#a9acba';
  let g = faPoly([[0, 0, 0], [N, 0, 0], [N, 0, 118], [9.4, 0, 170], [7.4, 0, 138], [5.3, 0, 205], [3.2, 0, 150], [1.2, 0, 188], [0, 0, 120]], rock)
    + faPoly([[0, 0, 0], [0, 4.2, 0], [0, 4.2, 70], [0, 1.9, 150], [0, 0, 120]], rock2);
  g += faPoly([[1.2, 0, 188], [2.2, 0, 160], [3.2, 0, 150], [4.2, 0, 178], [5.3, 0, 205], [4.4, 0, 160], [2.6, 0, 120]], lit, 'opacity=".28"');
  g += faPoly([[5.3, 0, 205], [5.9, 0, 188], [4.8, 0, 188]], '#f4f6fb') + faPoly([[1.2, 0, 188], [1.7, 0, 174], [.8, 0, 176]], '#f4f6fb');
  [[2.2, 0, 90], [4.1, 0, 112], [6.8, 0, 96], [8.8, 0, 106], [10.2, 0, 70]].forEach(([x, y, z]) => { g += faLine([x, y, z], [x + .5, y, z - 12], 'rgba(40,40,60,.35)', 3); });
  return g;
}
function mnShaftSvg(sh, st) {
  const x = MN_X[sh.slot], y = 0, z = 66;
  const mouth = faPoly([[x - .36, y, 0], [x + .36, y, 0], [x + .36, y, z * .7], [x, y, z], [x - .36, y, z * .7]], '#14151c', 'stroke="#5b3a22" stroke-width="3"')
    + faLine([x - .4, y, 0], [x - .4, y, z * .74], '#7a5030', 6) + faLine([x + .4, y, 0], [x + .4, y, z * .74], '#7a5030', 6) + faLine([x - .46, y, z * .74], [x + .46, y, z * .74], '#7a5030', 6)
    + (sh.state === 'working' ? `<g transform="${lcP(x, y + .1, 12)}"><circle r="5" fill="#ffd54a" opacity=".85" class="fs-glow"/></g>` : '');
  const rails = faLine([x - .15, .1, 1], [x - .15, 2.6, 1], '#4a3a2a', 2.4) + faLine([x + .15, .1, 1], [x + .15, 2.6, 1], '#4a3a2a', 2.4)
    + [.4, .9, 1.4, 1.9, 2.4].map(t => faLine([x - .26, t, 1], [x + .26, t, 1], '#7a5030', 2.2)).join('');
  let info;
  if (sh.state === 'ready') info = faBubble(x, 1.1, 54, '⛏️', 'ready');
  else if (sh.state === 'working') info = faRing(x, 1.1, 56, sh.left, sh.total, mnTier(sh.tier).icon);
  else info = faBubble(x, 1.1, 50, '＋', 'add');
  return rails + `<g class="fs-hit" data-act="mnShaft" data-i="${sh.slot}" aria-label="Штрек ${sh.slot + 1}">${mouth}<rect x="${(faX(x, 1.2) - 26).toFixed(1)}" y="${(faY(x, 1.2, 40)).toFixed(1)}" width="52" height="46" fill="rgba(0,0,0,0)"/></g><g style="pointer-events:none">${info}</g>`;
}
function mnCartSvg(st) {
  const x = 5.0, y = 6.4, n = st.cart_used, k = Math.min(1, n / Math.max(1, st.cart_cap));
  return `<g class="fs-hit" data-act="mnCart" aria-label="Вагонетка с рудой"><g transform="${lcP(x, y)}"><ellipse cy="6" rx="46" ry="14" fill="rgba(0,0,0,.2)"/>`
    + `<path d="M-38 -26 L38 -26 L30 8 L-30 8Z" fill="#6c4b2d" stroke="#3b2a1e" stroke-width="2.6"/><path d="M-38 -26 L38 -26" stroke="#9a7048" stroke-width="5"/>`
    + `<g transform="translate(0 -26)">${[[-22, 0, '#2f2f38'], [-6, -4, '#c97b3e'], [10, -2, '#b9b9c8'], [24, 1, '#f1c232'], [-12, -9, '#7e57c2'], [4, -10, '#2f2f38'], [16, -9, '#9c6b3a']].slice(0, 2 + Math.round(k * 5)).map(([dx, dy, c]) => `<ellipse cx="${dx}" cy="${dy}" rx="9" ry="6" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>`).join('')}</g>`
    + `<circle cx="-22" cy="10" r="8" fill="#2f2f38" stroke="#111" stroke-width="2"/><circle cx="22" cy="10" r="8" fill="#2f2f38" stroke="#111" stroke-width="2"/>`
    + `<g transform="translate(0 -58)"><rect x="-38" y="-9" width="76" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8fff4">РУДА ${n}/${st.cart_cap}</text></g></g></g>`;
}
function mnLift(st) {
  const x = 9.0, y = 5.6, lv = st.upgrades.find(u => u.key === 'lift').level;
  return `<g class="fs-hit" data-act="mnUpgrades" aria-label="Лифт"><g transform="${lcP(x, y)}"><ellipse cy="6" rx="34" ry="11" fill="rgba(0,0,0,.2)"/>`
    + `<path d="M-24 4 L-8 -96 M24 4 L8 -96 M-18 -28 H18 M-14 -56 H14 M-9 -82 H9 M-24 4 L8 -96 M24 4 L-8 -96" stroke="#5b3a22" stroke-width="4" fill="none"/>`
    + `<g transform="translate(0 -102)"><circle r="14" fill="#cfd3dc" stroke="#3b3b44" stroke-width="3"/><g class="${lv ? 'fs-spin' : ''}">${[0, 90, 180, 270].map(a => `<path transform="rotate(${a})" d="M0 -3 L0 -12" stroke="#3b3b44" stroke-width="3"/>`).join('')}</g></g>`
    + `<rect x="-10" y="-40" width="20" height="26" fill="#d9a441" stroke="#3b2a1e" stroke-width="2.4" class="fs-bob" style="animation-duration:3s"/>`
    + `<g transform="translate(0 -128)"><rect x="-26" y="-9" width="52" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8fff4">ЛИФТ ${lv}</text></g></g></g>`;
}
function mnScene(st) {
  const N = 11, objs = [], add = (d, svg) => objs.push({ d, svg });
  let g = locBase('mn', N, { grass: ['#bdb78f', '#a29a74'], side: ['#6f6a55', '#55503f'], sky: ['#b8d8f0', '#eef6fb'], seed: 8, deco: 70, blades: .9, blade: '#8a8a5a' });
  g += mnMountain();
  g += st.shafts.map(sh => mnShaftSvg(sh, st)).join('');
  if (st.shafts.length < st.max_shafts) { const c = st.upgrades.find(u => u.key === 'shafts').cost; if (c != null) g += locBuy(MN_X[st.shafts.length], 0.5, 30, 'mnUpgrades', c, st.coins, 'Новый штрек'); }
  add(5.0 + 6.4, mnCartSvg(st));
  add(9.0 + 5.6, mnLift(st));
  add(.4 + 6.2 + 1.8, locHut(.4, 6.2, 2.1, 1.8, 40, '#cdb892', '#5b6b8a', 'ШТЕЙГЕР', 'mnUpgrades', 'Домик штейгера', locAffordable(st)));
  add(1, locSign(10.0, 9.7, 'НА ФЕРМУ', 'mnExit', 'На ферму'));
  [[2.4, 4.6], [3.6, 8.4], [7.2, 8.2], [8.4, 3.4], [10.2, 4.4]].forEach(([x, y], i) => add(x + y, `<g transform="${lcP(x, y)}"><ellipse cy="2" rx="${14 + i * 2}" ry="6" fill="rgba(0,0,0,.18)"/><path d="M-14 0 L-8 -14 L6 -17 L15 -3 L11 4Z" fill="${['#8d8f9c', '#7a7d8c', '#9a9cab'][i % 3]}" stroke="#4a4c58" stroke-width="2"/></g>`));
  [[.4, 9.8, 'pine'], [10.6, 10.4, 'pine'], [6.4, 10.6, 'pine'], [10.5, 7.6, 'pine'], [.3, 4.6, 'pine']].forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 11 + 2)));
  return g + objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
}

/* ---------------- действия и окна ---------------- */
actions.mnExit = () => { closeModal(); location.hash = '#/farm'; };
actions.mnCollectAll = () => MN.act('collect', {}, 'mnPick');
actions.mnUpgrade = b => MN.act('upgrade', { key: b.dataset.key }, 'fmCoin', true);
actions.mnSend = b => MN.act('send', { shaft: +b.dataset.shaft, tier: +b.dataset.tier }, 'mnPick');
actions.mnSell = async b => { const r = await MN.act('sell', b.dataset.ore ? { ore: b.dataset.ore } : {}, 'fmCoin', true); if (r) toast(`+${slFmt(r.sold.coins)} монет за ${r.sold.qty} шт.`, { icon: '💰', ms: 1500 }); };
actions.mnUpgrades = () => MN.show(() => MN.panel('⚙️ Домик штейгера и лифт', locUpgradesBody(MN.K.st, 'mnUpgrade')));

actions.mnShaft = b => {
  const i = +b.dataset.i, sh = MN.K.st.shafts[i];
  if (!sh) return;
  if (sh.state === 'ready') return MN.act('collect', { shaft: i }, 'mnPick');
  MN.show(() => {
    const s = MN.K.st, r = s.shafts[i];
    if (!r) return;
    if (r.state === 'working') {
      const t = mnTier(r.tier);
      return MN.panel(`⛏️ Штрек ${i + 1}: ${t.name}`, html`<p class="muted" style="margin:0 0 8px">Смена вернётся через <b>${fmTimer(r.left)}</b></p>${fmBar(r.left, r.total)}
        <p class="muted small">Что добыто, станет ясно, когда смена вернётся. Еда: ${t.food_icon} ${t.food_name}.</p>${locCloseBtn}`);
    }
    MN.panel(`⛏️ Штрек ${i + 1}: куда спускаем смену?`, html`<p class="muted small" style="margin:0 0 6px">Шахтёрам нужна еда с кухни фермы (одна порция на смену). Глубже — дольше, богаче и опаснее: на глубине бывает обвал, тогда добыча вдвое меньше.</p>
      <div class="fm-seeds">${s.tiers.map(t => mnTierCard(t, i))}</div>${locCloseBtn}`);
  });
};
function mnTierCard(t, shaft) {
  const none = t.have < 1, off = t.locked || none;
  return html`<button class="fm-seed mn-tier t${t.tier}" data-act="mnSend" data-shaft="${shaft}" data-tier="${t.tier}" ${off ? 'disabled' : ''}>
    <span class="fm-seed-ic">${t.icon}</span><b>${t.name}</b><span class="small">⏱ ${fmClock(t.time)} · ${t.finds} находок</span>
    <span class="small muted">обвал: ${Math.round(t.risk * 100)}%</span>
    <span class="small ${t.locked || none ? 'no' : 'muted'}">${t.locked ? '🔒 нужен лифт получше' : none ? `нет еды: ${t.food_icon} ${t.food_name}` : `${t.food_icon} ${t.food_name}: ${t.have}`}</span></button>`;
}

actions.mnCart = () => MN.show(() => {
  const s = MN.K.st, ids = Object.keys(s.inv).filter(k => s.inv[k] > 0).sort((a, b) => mnOre(b).price - mnOre(a).price);
  const total = ids.reduce((a, k) => a + s.inv[k] * mnOre(k).price, 0);
  const list = ids.length ? html`<div class="la-sell">${ids.map(k => { const o = mnOre(k), q = s.inv[k];
    return html`<div class="la-sell-r"><span class="la-sell-ic">${o.icon}</span><div class="grow"><b>${o.name}</b><div class="small muted">×${q} · по 💰 ${slFmt(o.price)}</div></div><button class="btn sm" data-act="mnSell" data-ore="${k}">Продать 💰 ${slFmt(o.price * q)}</button></div>`; })}</div>
    <div class="row mt"><button class="btn" data-act="mnSell">Продать всё · 💰 ${slFmt(total)}</button></div>` : html`<p class="muted" style="margin:0">В вагонетках пусто. Отправь смену в шахту и забери добычу.</p>`;
  MN.panel(`🛒 Вагонетки · ${s.cart_used}/${s.cart_cap}`, html`${list}<h3 class="la-h">Коллекция руд <span class="muted small">${s.ores.filter(o => o.discovered).length}/${s.ores.length}</span></h3><div class="la-grid">${s.ores.map(o => o.discovered
    ? html`<div class="la-j"><span class="la-j-ic">${o.icon}</span><b class="small">${o.name}</b><span class="small muted">💰 ${slFmt(o.price)}</span></div>`
    : html`<div class="la-j unk"><span class="la-j-ic">❔</span><b class="small">???</b><span class="small muted">не найдена</span></div>`)}</div>
    <p class="muted small" style="margin:8px 0 0">Первый образец новой руды даёт бонус открытия — втрое больше её цены. Цены меняются каждый день (сейчас оценщик +${Math.round(s.bonus * 100)}%).</p>${locCloseBtn}`);
});
