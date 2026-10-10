/* LearnQuest — «Пиксел баттл»: общая доска 128×128 для всей компании, как r/place.
   Всё решает сервер (/api/pixels/*): лимит «один пиксел в минуту (копятся до 5)», границы, цвета, покупка пиксела за жетоны.
   Здесь — холст с зумом и перетаскиванием, палитра, таймер и опрос изменений раз в пару секунд. */
'use strict';

const PX = { w: 128, h: 128, palette: [], empty: 255, me: null, lastId: 0, z: 4, tx: 0, ty: 0, sel: null, color: 5, cell: null, nextAt: 0, ctx: null, busy: false, poll: false, top: null };
const PX_EMPTY = '#e9ecf4';
const pxFmtAgo = ts => {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 45) return 'только что'; if (s < 3600) return Math.round(s / 60) + ' мин назад'; if (s < 86400) return Math.round(s / 3600) + ' ч назад'; return Math.round(s / 86400) + ' дн. назад';
};
const pxClock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const pxCol = i => (i === PX.empty || i == null) ? PX_EMPTY : PX.palette[i];

Object.assign(SFX, {
  pxPlace: () => tone([523, 784], .05, 'square', .04),
  pxBuy: () => tone([392, 523, 659], .06, 'triangle', .06),
});

route(/^#\/pixels$/, async () => { await drawPixels(); });

async function drawPixels() {
  render(app(), shell('pixels', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  const [st, top] = await Promise.all([api('/pixels/state'), api('/pixels/top').catch(() => null)]);
  Object.assign(PX, { w: st.w, h: st.h, palette: st.palette, empty: st.empty, lastId: st.last_id, sel: null, cell: null, top, busy: false });
  if (!(PX.color >= 0 && PX.color < st.palette.length)) PX.color = 5;
  pxSetMe(st);
  S.balance = st.balance;
  render(app(), shell('pixels', html`<div class="px-page">
    <div class="px-top"><div><h2>🎨 Пиксел баттл</h2><p class="muted small" style="margin:0">Одна общая доска на всех. Ставь пиксел раз в минуту и защищай свой уголок!</p></div>
      <div class="px-bal" title="Общие жетоны">🪙 <b id="pxBal">${slFmt(st.balance)}</b></div></div>
    <div class="px-grid">
      <div class="px-main">
        <div class="px-view" id="pxView"><div class="px-stage" id="pxStage"><canvas id="pxCanvas" width="${st.w}" height="${st.h}"></canvas></div><canvas class="px-gridcv" id="pxGrid"></canvas><div class="px-hover" id="pxHover" hidden></div><div class="px-cursor" id="pxCursor" hidden></div>
          <button class="btn px-quick" id="pxQuick" data-act="pxPlace" hidden></button>
          <div class="px-zoom"><button data-act="pxZoom" data-d="1" aria-label="Приблизить">＋</button><button data-act="pxZoom" data-d="-1" aria-label="Отдалить">－</button><button data-act="pxFit" aria-label="Вся доска" title="Вся доска">⤢</button></div></div>
        <div class="px-palette" id="pxPalette">${st.palette.map((c, i) => html`<button class="px-sw" data-act="pxColor" data-i="${i}" style="background:${c}" aria-label="Цвет ${i + 1}"></button>`)}</div>
        <div class="px-act"><button class="btn px-place" id="pxPlace" data-act="pxPlace">Поставить пиксел</button>
          <div class="px-charges"><div id="pxDots"></div><span class="muted small" id="pxTimer"></span></div>
          <button class="btn ghost sm" id="pxBuy" data-act="pxBuy">+1 пиксел · 🪙 ${st.price}</button></div>
        <div class="px-hint muted small" id="pxHint"></div>
      </div>
      <aside class="px-side">
        <div class="card px-cell" id="pxCellBox"></div>
        <div class="card"><h3>🏆 Хозяева доски</h3><div id="pxTop"></div></div>
      </aside>
    </div></div>`));
  PX.ctx = $('#pxCanvas').getContext('2d');
  pxPaintAll(st.board);
  pxFit(true);
  pxBind();
  pxUi(); pxCellUi(); pxTopUi();
  S.timers.push(setInterval(pxTick, 1000), setInterval(pxPoll, 2000), setInterval(pxRefreshTop, 30000));
}

function pxSetMe(m) {
  PX.me = { charges: m.charges, max: m.max_charges, cooldown: m.cooldown, price: m.price };
  PX.nextAt = m.charges >= m.max_charges ? 0 : Date.now() + m.next_in * 1000;
}
function pxTick() {
  const m = PX.me; if (!m) return;
  while (m.charges < m.max && Date.now() >= PX.nextAt) { m.charges++; PX.nextAt += m.cooldown * 1000; if (m.charges >= m.max) PX.nextAt = 0; }
  pxUi();
}
function pxUi() {
  const m = PX.me; if (!$('#pxDots') || !m) return;
  $('#pxDots').innerHTML = Array.from({ length: m.max }, (_, i) => `<i class="${i < m.charges ? 'on' : ''}"></i>`).join('');
  $('#pxTimer').textContent = m.charges >= m.max ? 'запас полный' : `${m.charges}/${m.max} · следующий через ${pxClock((PX.nextAt - Date.now()) / 1000)}`;
  const can = m.charges > 0 && !!PX.sel && !PX.busy;
  const b = $('#pxPlace'); b.disabled = !can;
  b.textContent = !PX.sel ? 'Выбери клетку на доске' : m.charges < 1 ? 'Жди следующий пиксел' : 'Поставить пиксел';
  $('#pxBuy').disabled = m.charges >= m.max || PX.busy;
  const q = $('#pxQuick'); if (q) { q.hidden = !PX.sel; q.disabled = !can; q.textContent = m.charges < 1 ? `Пиксел через ${pxClock((PX.nextAt - Date.now()) / 1000)}` : `Поставить в ${PX.sel ? PX.sel.x + ', ' + PX.sel.y : ''}`; }
  $$('#pxPalette .px-sw').forEach((el, i) => el.classList.toggle('on', i === PX.color));
  pxCursorUi();
}

/* ---------- холст ---------- */
function pxPaintAll(b64) {
  const bin = atob(b64), ctx = PX.ctx, img = ctx.createImageData(PX.w, PX.h), cols = PX.palette.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  const em = [0xe9, 0xec, 0xf4];
  for (let i = 0; i < bin.length; i++) { const c = bin.charCodeAt(i), rgb = c === PX.empty ? em : cols[c] || em; img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
function pxDot(x, y, c) { if (!PX.ctx) return; PX.ctx.fillStyle = pxCol(c); PX.ctx.fillRect(x, y, 1, 1); }

function pxBox() { const v = $('#pxView'); return { w: v.clientWidth, h: v.clientHeight }; }
function pxApply() {
  const { w, h } = pxBox(), minZ = Math.min(w / PX.w, h / PX.h), z = Math.max(minZ * .9, Math.min(48, PX.z));
  PX.z = z;
  const bw = PX.w * z, bh = PX.h * z, pad = Math.min(w, h) * .25;  // доску можно утащить, но не потерять из виду
  PX.tx = bw <= w ? (w - bw) / 2 : Math.min(pad, Math.max(w - bw - pad, PX.tx));
  PX.ty = bh <= h ? (h - bh) / 2 : Math.min(pad, Math.max(h - bh - pad, PX.ty));
  const st = $('#pxStage'); if (!st) return;
  st.style.transform = `translate(${PX.tx}px, ${PX.ty}px) scale(${z})`;
  pxGridDraw(w, h);
  pxCursorUi();
  pxHoverUi();
}
/** Сетка рисуется на отдельном холсте по реальным пикселам экрана: CSS-градиенты в масштабированном блоке на части браузеров превращаются в точки. */
function pxGridDraw(w, h) {
  const cv = $('#pxGrid'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  const z = PX.z; if (z < 6) return;
  const x0 = Math.max(0, Math.floor(-PX.tx / z)), x1 = Math.min(PX.w, Math.ceil((w - PX.tx) / z)), y0 = Math.max(0, Math.floor(-PX.ty / z)), y1 = Math.min(PX.h, Math.ceil((h - PX.ty) / z));
  const top = Math.max(0, Math.round(PX.ty * dpr)), bot = Math.min(H, Math.round((PX.ty + PX.h * z) * dpr)), left = Math.max(0, Math.round(PX.tx * dpr)), right = Math.min(W, Math.round((PX.tx + PX.w * z) * dpr));
  const fade = Math.min(1, (z - 6) / 6);  // плавно проявляется при приближении
  for (let i = x0; i <= x1; i++) { g.fillStyle = `rgba(30,35,60,${(i % 8 ? .16 : .34) * fade})`; g.fillRect(Math.round((PX.tx + i * z) * dpr), top, 1, bot - top); }
  for (let j = y0; j <= y1; j++) { g.fillStyle = `rgba(30,35,60,${(j % 8 ? .16 : .34) * fade})`; g.fillRect(left, Math.round((PX.ty + j * z) * dpr), right - left, 1); }
}
function pxFit(init) { const { w, h } = pxBox(); PX.z = Math.min(w / PX.w, h / PX.h); PX.tx = PX.ty = 0; pxApply(); }
function pxZoomAt(f, cx, cy) {
  const { w, h } = pxBox(); cx = cx ?? w / 2; cy = cy ?? h / 2;
  const nz = Math.max(Math.min(w / PX.w, h / PX.h) * .9, Math.min(48, PX.z * f)), k = nz / PX.z;
  PX.tx = cx - (cx - PX.tx) * k; PX.ty = cy - (cy - PX.ty) * k; PX.z = nz; pxApply();
}
actions.pxZoom = b => pxZoomAt(+b.dataset.d > 0 ? 1.6 : 1 / 1.6);
actions.pxFit = () => pxFit();

/** Рамки наведения и выбора лежат поверх доски в экранных пикселах (не внутри масштабируемого блока): иначе Chrome местами растягивает их неравномерно. */
function pxBoxAt(el, x, y, col, ring, ring2, op) {
  const z = PX.z;
  el.hidden = false;
  el.style.cssText = `left:${(PX.tx + x * z).toFixed(2)}px;top:${(PX.ty + y * z).toFixed(2)}px;width:${z.toFixed(2)}px;height:${z.toFixed(2)}px;background:${col};opacity:${op};box-shadow:0 0 0 ${ring}px rgba(255,255,255,.95), 0 0 0 ${ring2}px rgba(0,0,0,.55)`;
}
function pxHoverUi(x, y) {
  const c = $('#pxHover'); if (!c) return;
  if (arguments.length) PX.hov = x == null ? null : { x, y };
  const h = PX.hov;
  if (!h || (PX.sel && PX.sel.x === h.x && PX.sel.y === h.y)) { c.hidden = true; return; }
  pxBoxAt(c, h.x, h.y, pxCol(PX.color), 1.5, 3, .75);
}
function pxCursorUi() {
  const c = $('#pxCursor'); if (!c) return;
  if (!PX.sel) { c.hidden = true; return; }
  pxBoxAt(c, PX.sel.x, PX.sel.y, pxCol(PX.color), 2, 4, 1);
}

/* ---------- мышь, палец, колесо ---------- */
function pxBind() {
  const v = $('#pxView'), ptr = new Map();
  let moved = false, start = null, pinch = 0;
  v.addEventListener('pointerdown', e => { if (e.target.closest('.px-zoom, .px-quick')) return; v.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { x: e.clientX, y: e.clientY }; moved = false; pinch = 0; });
  const hov = e => { const r = v.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - PX.tx) / PX.z), y = Math.floor((e.clientY - r.top - PX.ty) / PX.z); x >= 0 && y >= 0 && x < PX.w && y < PX.h ? pxHoverUi(x, y) : pxHoverUi(null); };
  v.addEventListener('pointerleave', () => pxHoverUi(null));
  v.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && !ptr.size && !e.target.closest('.px-zoom, .px-quick')) hov(e);
    if (!ptr.has(e.pointerId)) return;
    const p = ptr.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (ptr.size === 1) {
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) moved = true;
      if (moved) { PX.tx += dx; PX.ty += dy; pxHoverUi(null); pxApply(); }
    } else if (ptr.size === 2) {
      moved = true;
      const other = [...ptr.entries()].find(([id]) => id !== e.pointerId)[1], d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y), d0 = Math.hypot(p.x - other.x, p.y - other.y);
      const r = v.getBoundingClientRect();
      if (d0 > 0) pxZoomAt(d1 / d0, (e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top);
    }
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = e => {
    if (!ptr.has(e.pointerId)) return;
    ptr.delete(e.pointerId);
    if (!moved && ptr.size === 0 && e.type === 'pointerup') {
      const r = v.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - PX.tx) / PX.z), y = Math.floor((e.clientY - r.top - PX.ty) / PX.z);
      if (x >= 0 && y >= 0 && x < PX.w && y < PX.h) pxSelect(x, y);
    }
  };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  v.addEventListener('wheel', e => { e.preventDefault(); const r = v.getBoundingClientRect(); pxZoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const onResize = () => pxApply();
  window.addEventListener('resize', onResize);
  const prev = S.onLeave; S.onLeave = () => { window.removeEventListener('resize', onResize); if (prev) prev(); PX.ctx = null; };
}

async function pxSelect(x, y) {
  PX.sel = { x, y }; PX.cell = null; pxUi(); pxCellUi();
  play('tap');
  await pxLoadCell(x, y);
}
async function pxLoadCell(x, y) {
  try { const c = await api(`/pixels/cell?x=${x}&y=${y}`); if (PX.sel && PX.sel.x === x && PX.sel.y === y) { PX.cell = c; pxCellUi(); } } catch (e) { /* не критично */ }
}
function pxCellUi() {
  const box = $('#pxCellBox'); if (!box) return;
  if (!PX.sel) { box.innerHTML = unraw(html`<h3>📍 Клетка</h3><p class="muted small" style="margin:0">Нажми на доску, чтобы выбрать клетку: увидишь, кто её рисовал. Колесо мыши или щипок — зум, перетаскивание — двигать.</p>`); return; }
  const c = PX.cell, who = p => p ? html`<span class="avatar sm">${av(p)}</span> <b>${p.display_name}</b>` : html`<span class="muted">неизвестно</span>`;
  box.innerHTML = unraw(html`<h3>📍 Клетка ${PX.sel.x}, ${PX.sel.y}</h3>
    ${!c ? html`<span class="spinner"></span>` : html`<div class="px-cellrow"><i class="px-sw static" style="background:${pxCol(c.color)}"></i>
        <div>${c.color === PX.empty ? html`<b>Пусто</b><div class="muted small">Здесь ещё никто не рисовал</div>` : html`<div>${who(c.by)}</div><div class="muted small">${pxFmtAgo(c.at)} · ходов в этой клетке: ${c.total}</div>`}</div></div>
      ${c.history.length > 1 ? html`<div class="px-hist">${c.history.slice(1).map(h => html`<div><i class="px-sw static s" style="background:${pxCol(h.color)}"></i><span>${h.by ? h.by.display_name : 'неизвестно'}</span><span class="muted small">${pxFmtAgo(h.at)}</span></div>`)}</div>` : ''}`}`);
}
function pxTopUi() {
  const t = $('#pxTop'); if (!t) return;
  const d = PX.top;
  t.innerHTML = d ? unraw(html`${d.top.length ? html`<div class="px-top-list">${d.top.map((x, i) => html`<div><span class="px-rank">${i + 1}</span><span class="avatar sm">${av(x)}</span><b>${x.display_name}</b><span class="muted">${slFmt(x.pixels)}</span></div>`)}</div>` : html`<p class="muted small" style="margin:0">Доска пока пустая — нарисуй первый пиксел!</p>`}
    <div class="muted small mt">Закрашено ${slFmt(d.stats.painted)} из ${slFmt(d.stats.total)} клеток · ходов ${slFmt(d.stats.moves)}</div>`) : '';
}
async function pxRefreshTop() { try { PX.top = await api('/pixels/top'); pxTopUi(); } catch (e) { /* ничего */ } }

/* ---------- опрос изменений ---------- */
async function pxPoll() {
  if (PX.poll || document.hidden || !PX.ctx) return;
  PX.poll = true;
  try {
    for (let i = 0; i < 20 && PX.ctx; i++) {
      const d = await api('/pixels/changes?after=' + PX.lastId);
      d.changes.forEach(c => { pxDot(c.x, c.y, c.c); if (PX.sel && PX.sel.x === c.x && PX.sel.y === c.y) pxLoadCell(c.x, c.y); });
      PX.lastId = d.last_id;
      if (!d.more) break;
    }
  } catch (e) { /* пропустим тик, сеть могла моргнуть */ } finally { PX.poll = false; }
}

/* ---------- действия ---------- */
actions.pxColor = b => { PX.color = +b.dataset.i; pxUi(); pxHoverUi(); play('tap'); };
actions.pxPlace = async () => {
  if (PX.busy || !PX.sel) return;
  const { x, y } = PX.sel, hint = $('#pxHint');
  PX.busy = true; pxUi(); hint.textContent = '';
  try {
    const r = await api('/pixels/place', { json: { x, y, color: PX.color } });
    pxDot(x, y, r.color); play('pxPlace');
    pxSetMe({ charges: r.charges, max_charges: r.max_charges, cooldown: r.cooldown, price: r.price, next_in: r.next_in });
    pxLoadCell(x, y);
    hint.textContent = `Готово: клетка ${x}, ${y} закрашена.`;
  } catch (e) {
    hint.textContent = e.message;
    if (e.status === 429) { try { const s = await api('/pixels/state'); pxSetMe(s); } catch (e2) { /* ничего */ } }
  }
  PX.busy = false; pxUi();
};
actions.pxBuy = async () => {
  if (PX.busy) return;
  PX.busy = true; pxUi();
  try {
    const r = await api('/pixels/buy', { method: 'POST' });
    pxSetMe({ charges: r.charges, max_charges: r.max_charges, cooldown: r.cooldown, price: r.price, next_in: r.next_in });
    const bal = $('#pxBal'); if (bal) bal.textContent = slFmt(r.balance);
    play('pxBuy'); $('#pxHint').textContent = `Куплен пиксел за ${r.price} жетонов.`;
  } catch (e) { $('#pxHint').textContent = e.message; toast(e.message, { icon: '🎨' }); }
  PX.busy = false; pxUi();
};
