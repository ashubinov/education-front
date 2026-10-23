/* LearnQuest — «Ферма»: простой аналог большой фермы. Грядки → урожай на склад → корм животным → продукция → кухня → рынок и заказы.
   Всё считает сервер (/api/farm/*), время идёт и пока тебя нет. Здесь — только показ, таймеры и кнопки. Картинки — эмодзи и CSS. */
'use strict';

const FARM = { st: null, t0: 0, busy: false, target: null, reopen: null };
Object.assign(SFX, {
  fmPlant: () => tone([330, 392], .05, 'triangle', .05),
  fmHarvest: () => tone([523, 659, 784], .06, 'triangle', .06),
  fmCoin: () => tone([988, 1319], .05, 'square', .04),
  fmLevel: () => tone([392, 523, 659, 784, 1046], .09, 'triangle', .07),
  fmEat: () => tone([262, 330, 262], .06, 'triangle', .05),
});

const fmItem = id => FARM.st.catalog.items[id];
const fmIc = id => fmItem(id).icon;
const fmCrop = id => FARM.st.catalog.crops.find(c => c.id === id);
const fmClock = s => { s = Math.max(0, Math.ceil(s)); if (s >= 3600) return Math.floor(s / 3600) + ' ч ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ' мин'; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmEnd = left => Math.round(FARM.t0 + left * 1000);          // когда закончится, в мс по часам браузера
const fmTimer = (left, cls = '') => html`<span class="fm-timer ${cls}" data-end="${fmEnd(left)}">${fmClock(left)}</span>`;
const fmBar = (left, total) => html`<div class="bar thin fm-prog" data-end="${fmEnd(left)}" data-total="${total}"><i style="width:${Math.min(100, Math.round((1 - left / Math.max(1, total)) * 100))}%"></i></div>`;
const fmHave = id => FARM.st.stock[id] || 0;

route(/^#\/farm$/, async () => { await drawFarm(); });

async function drawFarm() {
  render(app(), shell('farm', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  fmSet(await api('/farm'));
  paintFarm();
  every(fmTick, 1000);
}
function fmSet(r) { FARM.st = r; FARM.t0 = Date.now(); S.balance = r.exchange.balance; }

function paintFarm() {
  const y = window.scrollY, old = $('#fmScroll'), sl = old ? old.scrollLeft : null;
  render(app(), shell('farm', fmPage(FARM.st)));
  const sc = $('#fmScroll'); if (sc) sc.scrollLeft = sl != null ? sl : (sc.scrollWidth - sc.clientWidth) / 2;
  window.scrollTo(0, y);
}
function fmTick() { fmTickWith(() => { if (!FARM.busy) api('/farm').then(r => { fmSet(r); paintFarm(); }).catch(() => { }); }); }
/** Общий таймер сцен (ферма и лаборатория): обновляет отсчёты и вызывает reload, когда какой-то из них дошёл до нуля. */
function fmTickWith(reload) {
  const now = Date.now(); let flip = false;
  $$('.fm-timer').forEach(t => { const left = (+t.dataset.end - now) / 1000; t.textContent = fmClock(left); if (left <= 0 && !t.dataset.done) { t.dataset.done = 1; flip = true; } });
  $$('.fs-prog').forEach(r => { const left = (+r.dataset.end - now) / 1000, tot = +r.dataset.total; r.setAttribute('width', Math.max(0, Math.min(1, 1 - left / tot)) * +r.dataset.w); if (left <= 0 && !r.dataset.done) { r.dataset.done = 1; flip = true; } });
  $$('.fs-ring').forEach(r => { const left = (+r.dataset.end - now) / 1000, tot = +r.dataset.total, c = +r.dataset.c; r.setAttribute('stroke-dasharray', Math.max(0, Math.min(1, 1 - left / tot)) * c + ' ' + c); if (left <= 0 && !r.dataset.done) { r.dataset.done = 1; flip = true; } });
  $$('.fm-prog').forEach(b => { const left = (+b.dataset.end - now) / 1000, tot = +b.dataset.total; b.firstElementChild.style.width = Math.max(0, Math.min(100, (1 - left / tot) * 100)) + '%'; });
  if (flip) reload();
}

/* ---------- страница: изометрическая сцена (farm-art.js) + панель сверху и кнопки снизу ---------- */
function fmPage(s) {
  const f = s.farm, pct = f.xp_next ? Math.min(100, Math.round((f.xp - f.xp_from) / (f.xp_next - f.xp_from) * 100)) : 100;
  const ready = s.plots.filter(p => p.state === 'ready').length, empty = s.plots.filter(p => p.state === 'empty').length;
  const doable = s.orders.filter(o => Object.entries(o.items).every(([i, q]) => fmHave(i) >= q)).length;
  return html`<div class="fm-page"><div class="fm-stage">
    <div class="fm-hud">
      <div class="fm-lvl" title="Опыт фермы: ${f.xp_next ? f.xp - f.xp_from + ' из ' + (f.xp_next - f.xp_from) : 'максимум'}"><div class="fm-lvl-b">${f.level}</div><div class="fm-lvl-r"><small>Уровень</small><div class="bar thin"><i style="width:${pct}%"></i></div></div></div>
      <div class="fm-pill" title="Монеты фермы">💰 <b>${slFmt(f.coins)}</b></div>
      <div class="fm-pill ${f.stock_total >= f.capacity ? 'full' : ''}" title="Склад">📦 <b>${f.stock_total}/${f.capacity}</b></div>
    </div>
    <div class="fm-scroll" id="fmScroll"><svg class="fm-world" viewBox="0 -120 1120 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ферма">${raw(farmScene(s))}</svg></div>
    <div class="fm-dock">
      <button class="fm-db" data-act="fmHarvestAll" ${ready ? '' : 'disabled'}><span>🧺</span>Собрать${ready ? html`<i class="fm-n">${ready}</i>` : ''}</button>
      <button class="fm-db" data-act="fmPlantAll" ${empty ? '' : 'disabled'}><span>🌱</span>Посадить</button>
      <button class="fm-db" data-act="fmBarn"><span>📦</span>Склад</button>
      <button class="fm-db" data-act="fmOrdersOpen"><span>📋</span>Заказы${doable ? html`<i class="fm-n">${doable}</i>` : ''}</button>
      <button class="fm-db" data-act="fmKitchenOpen"><span>🍳</span>Кухня${s.kitchen && s.kitchen.state === 'ready' ? html`<i class="fm-n">!</i>` : ''}</button>
      <button class="fm-db" data-act="fmExchange"><span>🔁</span>Обмен</button>
    </div>
  </div><p class="muted small fm-tip">Нажимай на грядки, животных, амбар, кухню и доску заказов. Всё растёт и без тебя.</p></div>`;
}

function fmPen(p) {
  const a = FARM.st.catalog.animals.find(x => x.id === p.pen), have = fmHave(a.feed), max = FARM.st.farm.pen_size, price = a.price;
  const body = p.locked ? html`<div class="fm-lock">🔒 откроется на уровне ${a.level}</div>`
    : html`<div class="fm-yard ${p.state}">${p.count ? Array.from({ length: p.count }, (_, i) => html`<span class="fm-an" style="animation-delay:${i * .4}s">${a.icon}</span>`) : html`<span class="muted small">пока никого</span>`}${p.state === 'ready' ? html`<span class="fm-bubble">${fmIc(a.product)} ×${p.fed_count}</span>` : ''}</div>
      ${p.state === 'working' ? html`<div class="small muted">${fmIc(a.product)} через ${fmTimer(p.left)}</div>${fmBar(p.left, p.total)}` : ''}
      <div class="fm-pen-act">
        ${p.state === 'ready' ? html`<button class="btn sm" data-act="fmCollect" data-pen="${p.pen}">Забрать ${fmIc(a.product)} ×${p.fed_count}</button>` : ''}
        ${p.state === 'idle' && p.count ? html`<button class="btn sm" data-act="fmFeed" data-pen="${p.pen}" ${have >= p.count ? '' : 'disabled'} title="Корм: ${fmItem(a.feed).name}">Кормить ${fmIc(a.feed)} ${have}/${p.count}</button>` : ''}
        ${p.count < max ? html`<button class="btn sm ghost" data-act="fmBuyAnimal" data-pen="${p.pen}">＋ 💰 ${price}</button>` : ''}</div>`;
  return html`<div class="fm-pen"><div class="fm-pen-h"><b>${a.icon} ${a.name}</b><span class="muted small">${p.count}/${max} · ест ${fmIc(a.feed)}, даёт ${fmIc(a.product)}</span></div>${body}</div>`;
}

function fmKitchen(s) {
  const k = s.kitchen, rec = s.catalog.recipes, lvl = s.farm.level;
  const job = k ? (() => { const r = rec.find(x => x.id === k.recipe); return html`<div class="fm-job"><div class="fm-job-ic">${r.icon}</div><div class="grow"><b>${r.name}</b>
      ${k.state === 'ready' ? html`<div class="small" style="color:var(--good)">Готово! ×${r.qty}</div>` : html`<div class="small muted">ещё ${fmTimer(k.left)}</div>${fmBar(k.left, k.total)}`}</div>
      ${k.state === 'ready' ? html`<button class="btn sm" data-act="fmCookCollect">Забрать</button>` : ''}</div>`; })() : '';
  return html`${job}<div class="fm-recipes">${rec.map(r => {
    const locked = lvl < r.level, enough = Object.entries(r.needs).every(([i, q]) => fmHave(i) >= q);
    return html`<button class="fm-recipe ${locked ? 'locked' : ''}" data-act="fmCook" data-recipe="${r.id}" ${locked || k || !enough ? 'disabled' : ''}>
        <span class="fm-r-ic">${r.icon}</span><b>${r.name}${r.qty > 1 ? ' ×' + r.qty : ''}</b>
        <span class="small">${locked ? '🔒 ур. ' + r.level : Object.entries(r.needs).map(([i, q]) => html`<span class="${fmHave(i) >= q ? 'ok' : 'no'}">${fmIc(i)} ${fmHave(i)}/${q}</span>`)}</span>
        <small class="muted">⏱ ${fmClock(r.time)}</small></button>`; })}</div>`;
}

function fmOrder(o) {
  const ok = Object.entries(o.items).every(([i, q]) => fmHave(i) >= q);
  return html`<div class="fm-order ${ok ? 'ok' : ''}"><div class="fm-order-items">${Object.entries(o.items).map(([i, q]) => html`<div class="fm-oi ${fmHave(i) >= q ? 'ok' : 'no'}"><span class="fm-oi-ic">${fmIc(i)}</span><b>${fmHave(i)}/${q}</b></div>`)}</div>
    <div class="fm-order-r"><span>💰 <b>${o.coins}</b></span><span class="muted small">+${o.xp} опыта</span></div>
    <div class="row gap-s"><button class="btn sm" data-act="fmDeliver" data-slot="${o.slot}" ${ok ? '' : 'disabled'}>Сдать</button><button class="btn sm ghost" data-act="fmSkip" data-slot="${o.slot}" title="Другой заказ за ${FARM.st.catalog.skip_cost} монет">↻ ${FARM.st.catalog.skip_cost}</button></div></div>`;
}

function fmStock(s) {
  const ids = Object.keys(s.stock).filter(i => s.stock[i] > 0);
  if (!ids.length) return html`<p class="muted" style="margin:6px 0 0">Склад пуст. Посади что-нибудь на грядках!</p>`;
  return html`<div class="fm-stock">${ids.map(i => { const it = s.catalog.items[i], pr = s.prices[i], q = s.stock[i], arrow = pr.mult >= 1.12 ? '↑' : pr.mult <= .93 ? '↓' : '';
    return html`<div class="fm-si"><div class="fm-si-ic">${it.icon}<i class="fm-q">${q}</i></div><b class="small">${it.name}</b>
      <span class="small ${arrow === '↑' ? 'up' : arrow === '↓' ? 'down' : ''}">💰 ${pr.price} ${arrow}</span>
      <div class="row gap-s"><button class="btn sm ghost" data-act="fmSell" data-item="${i}" data-qty="1">1</button><button class="btn sm ghost" data-act="fmSell" data-item="${i}">Все</button></div></div>`; })}</div>`;
}

/* ---------- действия ---------- */
/** Окна-панели (животные, кухня, склад, заказы) после действия перерисовываются, а не закрываются. */
function fmShow(fn) { fn(); FARM.reopen = fn; }
const fmPanelClose = () => { FARM.reopen = null; };
async function fmDo(path, json, sfx, keep) {
  if (FARM.busy) return null; FARM.busy = true;
  try {
    const r = await api('/farm/' + path, json === undefined ? { method: 'POST' } : { json });
    fmSet(r); paintFarm(); if (sfx) play(sfx);
    if (keep && FARM.reopen) { const f = FARM.reopen; f(); FARM.reopen = f; } else closeModal();
    for (const e of r.events || []) {
      if (e.type === 'level') { play('fmLevel'); confetti(120); toast(`Уровень фермы: ${e.level}. Открылось новое!`, { icon: '🎉', title: 'Новый уровень' }); }
      if (e.type === 'order') toast(`+${e.coins} монет и +${e.xp} опыта`, { icon: '📋', title: 'Заказ выполнен' });
      if (e.type === 'full') toast(`Склад полон: ещё ${e.left} гр. ждут урожая. Продай что-нибудь`, { icon: '📦' });
    }
    FARM.busy = false; return r;
  } catch (e) { toast(e.message, { icon: '⚠️' }); FARM.busy = false; return null; }
}

actions.fmPlot = b => {
  FARM.reopen = null;
  const p = FARM.st.plots[+b.dataset.i];
  if (p.state === 'empty') return fmSeeds(p.idx);
  if (p.state === 'ready') return fmDo('harvest', { idx: p.idx }, 'fmHarvest');
  toast(`${fmCrop(p.crop).name} созреет через ${fmClock(p.left - (Date.now() - FARM.t0) / 1000)}`, { icon: fmCrop(p.crop).icon, ms: 1800 });
};
actions.mapOpen = () => { closeModal(); location.hash = '#/farm/map'; };
actions.lakeOpen = () => {
  if (FARM.st.farm.level < 10) return toast('К озеру ведёт заросшая тропа. Подрасти ферму до 10 уровня', { icon: '🔒', ms: 2400 });
  closeModal(); location.hash = '#/farm/lake';
};
actions.labOpen = () => {
  if (FARM.st.farm.level < 6) return toast('Люк заперт на старый замок. Подрасти ферму до 6 уровня', { icon: '🔒', ms: 2400 });
  closeModal(); location.hash = '#/farm/lab';
};
actions.fmHarvestAll = () => fmDo('harvest', {}, 'fmHarvest');
actions.fmPlantAll = () => fmSeeds(null);
actions.fmBuyPlot = () => fmDo('plot/buy', undefined, 'fmCoin');
actions.fmUpgrade = () => fmDo('storage/upgrade', undefined, 'fmCoin', true);
actions.fmBuyAnimal = b => fmDo('animal/buy', { pen: b.dataset.pen }, 'fmCoin', true);
actions.fmFeed = b => fmDo('animal/feed', { pen: b.dataset.pen }, 'fmEat', true);
actions.fmCollect = b => fmDo('animal/collect', { pen: b.dataset.pen }, 'fmHarvest', true);
actions.fmCook = b => fmDo('cook', { recipe: b.dataset.recipe }, 'fmPlant', true);
actions.fmCookCollect = () => fmDo('cook/collect', undefined, 'fmHarvest', true);
actions.fmSell = async b => { const r = await fmDo('sell', b.dataset.qty ? { item: b.dataset.item, qty: +b.dataset.qty } : { item: b.dataset.item }, 'fmCoin', true); if (r) toast(`+${r.sold.coins} монет`, { icon: '💰', ms: 1200 }); };
actions.fmDeliver = b => fmDo('order/deliver', { slot: +b.dataset.slot }, 'fmCoin', true);
actions.fmSkip = b => fmDo('order/skip', { slot: +b.dataset.slot }, undefined, true);

function fmPanel(title, body, wide) {
  openModal(html`<div class="fm-panel-h"><h2>${title}</h2><button class="btn ghost sm" data-act="closeModal" aria-label="Закрыть">✕</button></div>${body}`, { onClose: fmPanelClose });
}
actions.fmPenOpen = b => fmShow(() => {
  const p = FARM.st.pens.find(z => z.pen === b.dataset.pen), a = FARM.st.catalog.animals.find(z => z.id === p.pen);
  fmPanel(`${a.icon} ${a.name}`, p.locked ? html`<p class="muted">Откроется на уровне ${a.level}. Нужно больше опыта: сажай, собирай, сдавай заказы.</p>` : html`<div class="fm-pens one">${fmPen(p)}</div>
    <p class="muted small" style="margin:10px 0 0">Накорми ${a.name.toLowerCase()} культурой «${fmItem(a.feed).name.toLowerCase()}», через ${fmClock(a.time)} получишь «${fmItem(a.product).name.toLowerCase()}» с каждого животного. Животных до ${FARM.st.farm.pen_size} штук.</p>`);
});
actions.fmKitchenOpen = () => fmShow(() => fmPanel('🍳 Кухня', fmKitchen(FARM.st)));
actions.fmOrdersOpen = () => fmShow(() => fmPanel('📋 Заказы', html`<p class="muted small" style="margin-top:0">Сдай товары со склада и получи больше монет, чем на рынке.</p><div class="fm-orders">${FARM.st.orders.map(fmOrder)}</div>`));
actions.fmBarn = () => fmShow(() => { const f = FARM.st.farm; fmPanel('📦 Склад и рынок', html`<div class="fm-barn-h"><span>Занято <b>${f.stock_total}/${f.capacity}</b></span>${f.capacity_cost != null ? html`<button class="btn ghost sm" data-act="fmUpgrade">⬆ +${f.capacity_step} мест · 💰 ${f.capacity_cost}</button>` : ''}</div>${fmStock(FARM.st)}<p class="muted small" style="margin:8px 0 0">Цены на рынке меняются каждый день: ↑ дороже обычного, ↓ дешевле.</p>`); });

function fmSeeds(idx) {
  FARM.target = idx; const s = FARM.st, lvl = s.farm.level, empty = s.plots.filter(p => p.state === 'empty').length;
  openModal(html`<h2>${idx == null ? 'Посадить на все пустые (' + empty + ')' : 'Что посадить?'}</h2>
    <div class="fm-seeds">${s.catalog.crops.map(c => { const locked = lvl < c.level, poor = s.farm.coins < c.seed; return html`<button class="fm-seed ${locked ? 'locked' : ''}" data-act="fmSeed" data-crop="${c.id}" ${locked || poor ? 'disabled' : ''}>
        <span class="fm-seed-ic">${c.icon}</span><b>${c.name}</b>
        <span class="small">${locked ? '🔒 ур. ' + c.level : html`💰 ${c.seed} · ⏱ ${fmClock(c.time)}`}</span>
        <span class="small muted">${locked ? '' : html`даёт ${c.yield} шт. · +${c.xp} опыта`}</span></button>`; })}</div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
}
actions.fmSeed = b => fmDo('plant', FARM.target == null ? { crop: b.dataset.crop } : { crop: b.dataset.crop, idx: FARM.target }, 'fmPlant');

actions.fmExchange = () => fmShow(() => {
  const e = FARM.st.exchange;
  openModal(html`<h2>🔁 Обмен</h2><p class="muted small">Монеты фермы 💰 и общие жетоны 🪙 (слоты, питомец, пикселы). Обмен идёт в обе стороны 1 к 1 и без лимита: выводи хоть все монеты.</p>
    <div class="fm-ex"><div><b>🪙 → 💰</b><p class="muted small" style="margin:2px 0 6px">1 жетон = ${e.in_rate} монета. У тебя ${slFmt(e.balance)} жетонов.</p>
        <div class="row gap-s"><input id="fmExIn" type="number" min="1" value="50" inputmode="numeric" style="width:110px"><button class="btn sm" data-act="fmExGo" data-dir="in">Купить монеты</button></div></div>
      <div><b>💰 → 🪙</b><p class="muted small" style="margin:2px 0 6px">${e.out_rate} монета = 1 жетон. У тебя ${slFmt(FARM.st.farm.coins)} монет.</p>
        <div class="row gap-s"><input id="fmExOut" type="number" min="1" value="10" inputmode="numeric" style="width:110px"><button class="btn sm ghost" data-act="fmExAll" title="Вывести все монеты">Все</button><button class="btn sm" data-act="fmExGo" data-dir="out">Получить жетоны</button></div></div></div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`, { onClose: fmPanelClose });
});
actions.fmExAll = () => { const n = Math.floor(FARM.st.farm.coins / FARM.st.exchange.out_rate); if (n < 1) return toast('Нет монет для вывода', { icon: '💰' }); $('#fmExOut').value = n; };
actions.fmExGo = b => { const dir = b.dataset.dir, n = Math.floor(+($(dir === 'in' ? '#fmExIn' : '#fmExOut').value)); if (!(n >= 1)) return toast('Введи количество', { icon: '✏️' }); fmDo('exchange', { direction: dir, amount: n }, 'fmCoin', true); };

/* ---------- карточка на странице друга ---------- */
function farmFriendCard(fm, name, lab) {
  return fm ? html`<div class="tiles slot-tiles"><div class="card tile"><b>🚜 ${fm.level}</b><span>уровень фермы</span></div><div class="card tile"><b>🌱 ${fm.plots}</b><span>грядок</span></div><div class="card tile"><b>🐔 ${fm.animals}</b><span>животных</span></div>${lab ? html`<div class="card tile"><b>🌲 ${lab.found}/${lab.total}</b><span>видов шишек</span></div>` : ''}</div>`
    : html`<p class="muted small" style="margin:0">${name} ещё не завёл ферму.</p>`;
}
