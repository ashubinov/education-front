/* LearnQuest — общий «каркас» новых локаций фермы (пасека, шахта, караван): загрузка состояния, таймеры, окна-панели, действия, рисование базы сцены.
   Каждая локация описывает только свою сцену и свои окна. Помощники рисования (проекция, коробки, пузыри, кольца таймера) — из farm-art.js. */
'use strict';

/** Окно-«каркас» страницы локации: рамка-сцена, панель сверху, SVG-сцена, кнопки снизу. */
function locPage(c) {
  return html`<div class="fm-page ${c.cls}-page"><div class="fm-stage ${c.cls}-stage">
    <div class="fm-hud">${c.hud.map(p => html`<div class="fm-pill ${p.full ? 'full' : ''}" title="${p.title}">${p.text}</div>`)}</div>
    <div class="fm-scroll" id="fmScroll"><svg class="fm-world ${c.cls}-world" viewBox="0 -120 1120 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.label}">${raw(c.svg)}</svg></div>
    <div class="fm-dock">${c.dock.map(b => html`<button class="fm-db" data-act="${b.act}" ${b.off ? 'disabled' : ''}><span>${b.icon}</span>${b.text}${b.badge ? html`<i class="fm-n">${b.badge}</i>` : ''}</button>`)}</div>
  </div><p class="muted small fm-tip">${c.tip}</p></div>`;
}

/**
 * Фабрика локации. cfg: { api: '/mine', hash: /^#\/farm\/mine$/, page: st => html, name: 'Шахта', events: (events, st) => void }.
 * Возвращает объект с состоянием K (st — последнее состояние сервера) и функциями draw/paint/show/panel/act.
 */
function locKit(cfg) {
  const K = { st: null, t0: 0, busy: false, reopen: null };
  const set = r => { K.st = r; K.t0 = FARM.t0 = Date.now(); };
  const paint = () => {
    const y = window.scrollY, old = $('#fmScroll'), sl = old ? old.scrollLeft : null;
    render(app(), shell('farm', cfg.page(K.st)));
    const sc = $('#fmScroll'); if (sc) sc.scrollLeft = sl != null ? sl : (sc.scrollWidth - sc.clientWidth) / 2;
    window.scrollTo(0, y);
  };
  const tick = () => fmTickWith(() => { if (!K.busy) api(cfg.api).then(r => { set(r); paint(); }).catch(() => { }); });
  async function draw() {
    render(app(), shell('farm', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
    let r;
    try { r = await api(cfg.api); } catch (e) { toast(e.message, { icon: '⚠️' }); location.hash = '#/farm'; return; }
    if (!r.unlocked) { toast(`${cfg.name}: нужен уровень фермы ${r.need_level}`, { icon: '🔒' }); location.hash = '#/farm'; return; }
    set(r); paint();
    every(tick, 1000);
  }
  const show = fn => { fn(); K.reopen = fn; };
  const close = () => { K.reopen = null; };
  const panel = (title, body) => openModal(html`<div class="fm-panel-h"><h2>${title}</h2><button class="btn ghost sm" data-act="closeModal" aria-label="Закрыть">✕</button></div>${body}`, { onClose: close });
  /** Действие на сервере: path — адрес внутри локации, keep — после ответа перерисовать открытое окно, а не закрывать. */
  async function act(path, json, sfx, keep) {
    if (K.busy) return null; K.busy = true;
    try {
      const r = await api(cfg.api + '/' + path, { json: json || {} });
      set(r); paint(); if (sfx) play(sfx);
      if (keep && K.reopen) { const f = K.reopen; f(); K.reopen = f; } else closeModal();
      if (cfg.events) cfg.events(r.events || [], r);
      K.busy = false; return r;
    } catch (e) { toast(e.message, { icon: '⚠️' }); K.busy = false; return null; }
  }
  route(cfg.hash, async () => { await draw(); });
  return { K, draw, set, paint, tick, show, panel, act };
}

const locCloseBtn = html`<div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`;
/** Список улучшений: окно «Лавка» любой локации (кнопка покупки вызывает data-act = buyAct с data-key). */
function locUpgradesBody(st, buyAct) {
  return html`<p class="muted small" style="margin:0 0 8px">Улучшения навсегда. У тебя 💰 <b>${slFmt(st.coins)}</b>.</p><div class="la-ups">${st.upgrades.map(u => html`<div class="la-up">
    <span class="la-up-ic">${u.icon}</span><div class="grow"><b>${u.name}</b><div class="small muted">${u.desc}</div>
      <div class="la-pips">${Array.from({ length: u.max }, (_, i) => html`<i class="${i < u.level ? 'on' : ''}"></i>`)}</div></div>
    ${u.cost == null ? html`<span class="small" style="color:var(--good);font-weight:800">Макс.</span>` : html`<button class="btn sm" data-act="${buyAct}" data-key="${u.key}" ${st.coins >= u.cost ? '' : 'disabled'}>💰 ${slFmt(u.cost)}</button>`}</div>`)}</div>${locCloseBtn}`;
}
const locAffordable = st => st.upgrades.some(u => u.cost != null && u.cost <= st.coins);

/* ---------------- рисование: основа и постройки ---------------- */
const lcP = (x, y, z = 0) => `translate(${faX(x, y).toFixed(1)} ${faY(x, y, z).toFixed(1)})`;
/** Небо, облака, земля-плита и трава с пятнами. p: { grass: [верх, низ], side: [левая, правая грань], skip: (x, y) => пропустить декор }. */
function locBase(id, N, p) {
  const r = faRng(p.seed || 5);
  let g = `<defs><linearGradient id="${id}Grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.grass[0]}"/><stop offset="1" stop-color="${p.grass[1]}"/></linearGradient>`
    + `<linearGradient id="${id}Sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky ? p.sky[0] : '#8fd3ff'}"/><stop offset="1" stop-color="${p.sky ? p.sky[1] : '#e6f7ff'}"/></linearGradient></defs>`;
  g += `<rect x="-200" y="-300" width="1600" height="1200" fill="url(#${id}Sky)"/>`;
  g += `<g opacity=".9"><ellipse cx="190" cy="30" rx="72" ry="16" fill="#fff"/><ellipse cx="236" cy="20" rx="46" ry="14" fill="#fff"/><ellipse cx="880" cy="60" rx="82" ry="17" fill="#fff"/><ellipse cx="930" cy="48" rx="48" ry="14" fill="#fff"/></g>`;
  g += faPoly([[0, N, 0], [N, N, 0], [N, N, -26], [0, N, -26]], p.side[0]) + faPoly([[N, 0, 0], [N, N, 0], [N, N, -26], [N, 0, -26]], p.side[1]);
  g += faPoly([[0, N, -26], [N, N, -26], [N, N, -34], [0, N, -34]], '#7a5a3a') + faPoly([[N, 0, -26], [N, N, -26], [N, N, -34], [N, 0, -34]], '#5d422a');
  g += faPoly([[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]], `url(#${id}Grass)`);
  for (let i = 0; i < (p.deco || 100); i++) {
    const x = r() * N, y = r() * N, px = faX(x, y), py = faY(x, y), k = r();
    if (p.skip && p.skip(x, y)) continue;
    g += k < (p.blades || .8) ? `<path d="M${(px - 4).toFixed(1)} ${py.toFixed(1)} l2 -6 M${px.toFixed(1)} ${py.toFixed(1)} l0 -7 M${(px + 4).toFixed(1)} ${py.toFixed(1)} l-2 -6" stroke="${p.blade || '#6bb24a'}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`
      : `<circle cx="${px.toFixed(1)}" cy="${(py - 3).toFixed(1)}" r="2.6" fill="${(p.dots || ['#fff', '#ffd54a', '#ff9ec2', '#b9a1ff'])[Math.floor(r() * 4)]}"/>`;
  }
  return g;
}
/** Указатель с надписью на столбе (выход, доска). */
function locSign(x, y, text, act, label, w = 74) {
  return `<g class="fs-hit" data-act="${act}" aria-label="${label}"><g transform="${lcP(x, y)}"><ellipse cy="3" rx="22" ry="7" fill="rgba(0,0,0,.18)"/><rect x="-3" y="-66" width="6" height="68" fill="#6b4426"/>`
    + `<path d="M${-w + 28} -62 H26 L40 -50 L26 -38 H${-w + 28}Z" fill="#f5ead0" stroke="#7a5430" stroke-width="3"/><text x="${(-w + 28 + 26) / 2}" y="-45" text-anchor="middle" font-size="12" font-weight="900" fill="#3b2a1e">${text}</text></g></g>`;
}
/** Домик с вывеской: wall/roof — цвета, title — надпись над дверью; badge — зелёная стрелка «можно улучшить». */
function locHut(x, y, w, d, h, wall, roof, title, act, label, badge) {
  return `<g class="fs-hit" data-act="${act}" aria-label="${label}">` + faBox(x, y, w, d, h, wall)
    + faPoly([[x + w * .15, y + d, 0], [x + w * .5, y + d, 0], [x + w * .5, y + d, h * .74], [x + w * .15, y + d, h * .74]], '#7a5030', 'stroke="#f8efe0" stroke-width="2.4"')
    + faPoly([[x + w * .6, y + d, h * .3], [x + w * .88, y + d, h * .3], [x + w * .88, y + d, h * .7], [x + w * .6, y + d, h * .7]], '#bfe6f5', 'stroke="#5b3a22" stroke-width="2.4"')
    + faGable(x, y, w, d, h, 26, roof, wall)
    + `<g transform="${lcP(x + w * .5, y + d + .12, h * .9)}"><rect x="-40" y="-9" width="80" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8fff4">${title}</text></g></g>`
    + (badge ? `<g transform="${lcP(x + w / 2, y + d / 2, h + 62)}" style="pointer-events:none"><g class="fs-bob"><circle r="12" fill="#2fbf6a" stroke="#fff" stroke-width="2.5"/><text y="5.5" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">↑</text></g></g>` : '');
}
/** Кнопка «купить ещё одно место» на сцене (ghost-кружок с ценой). */
function locBuy(x, y, z, act, cost, coins, label) {
  return `<g class="fs-hit fs-buy" data-act="${act}" aria-label="${label}"><g transform="${lcP(x, y, z)}"><ellipse cy="4" rx="24" ry="9" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="2.2" stroke-dasharray="4 3"/>`
    + `<text y="2" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1">＋</text><text y="21" text-anchor="middle" font-size="11" font-weight="800" fill="${coins >= cost ? '#fff' : '#ffb3b3'}" stroke="rgba(0,0,0,.4)" stroke-width="2" paint-order="stroke">💰${slFmt(cost)}</text></g></g>`;
}
