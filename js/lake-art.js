/* LearnQuest — графика «Озера» (рыбалка у фермы): изометрическая сцена, нарисованная кодом (SVG). Помощники и проекция — из farm-art.js.
   Сцена 11×11 клеток: берег слева-сверху, озеро справа-снизу, деревянный пирс вдоль x, по бокам пирса — шесть удочек. */
'use strict';

const LK = { N: 11, PIER_Y: 5.0, PIER_X0: .6, PIER_X1: 8.1 };
/* удочки: клетка пирса и сторона (−1 — к верхнему берегу, +1 — к нижнему) */
const LK_RODS = [[3.3, -1], [3.3, 1], [4.8, -1], [4.8, 1], [6.3, -1], [6.3, 1]];
const lkFish = id => LAKE.st.fish.find(f => f.id === id);
const lkUp = (st, key) => st.upgrades.find(u => u.key === key).level;

const lkP = (x, y, z = 0) => `translate(${faX(x, y).toFixed(1)} ${faY(x, y, z).toFixed(1)})`;

/* ---------------- озеро, берег, камыш ---------------- */
function lkWater() {
  const blob = (k, cx, cy, rx, ry) => Array.from({ length: 30 }, (_, i) => { const a = i / 30 * Math.PI * 2; return [cx + Math.cos(a) * rx * k * (1 + Math.sin(a * 3 + 1) * .05), cy + Math.sin(a) * ry * k * (1 + Math.cos(a * 2) * .06), 0]; });
  let g = faPoly(blob(1.16, 6.2, 5.5, 4.9, 3.9), '#e9d9a8', 'stroke="#c8b27c" stroke-width="2"');           // песок
  g += faPoly(blob(1, 6.2, 5.5, 4.9, 3.9), '#5bb8e0', 'stroke="#2f86ad" stroke-width="3"');                  // вода
  g += faPoly(blob(.72, 6.4, 5.6, 4.9, 3.9), '#74c9ec', 'opacity=".75"') + faPoly(blob(.4, 6.8, 5.7, 4.9, 3.9), '#93d9f5', 'opacity=".6"');
  const rip = [[4.2, 7.4], [7.6, 7.6], [9.1, 4.3], [8.4, 3.0], [5.2, 3.1], [3.7, 8.4], [9.3, 6.6]];
  rip.forEach(([x, y], i) => { g += `<g transform="${lkP(x, y)}" class="lk-ripple" style="animation-delay:${i * .55}s"><ellipse rx="14" ry="5" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.8"/></g>`; });
  [[8.9, 8.1, 1], [3.6, 6.9, .8], [9.3, 5.7, .9]].forEach(([x, y, s]) => { g += `<g transform="${lkP(x, y)} scale(${s})"><ellipse rx="10" ry="4" fill="#4caf50" stroke="#2f7d34" stroke-width="1"/><path d="M0 0 L7 -1" stroke="#5bb8e0" stroke-width="2.4"/><circle cx="3" cy="-2" r="2.4" fill="#ff9ec2"/></g>`; });
  return g;
}
function lkSwimmers(st) {
  const n = 2 + Math.min(4, Math.floor(Object.values(st.inv).reduce((a, b) => a + b, 0) / 3));
  const spots = [[6.5, 6.8], [8.2, 6.2], [5.6, 3.6], [7.3, 3.9], [4.6, 7.0], [8.8, 7.4]];
  return spots.slice(0, n).map(([x, y], i) => `<g transform="${lkP(x, y)}"><g class="fs-wander" style="--ax:${(i % 2 ? 24 : -24)}px;--ay:${(i % 3) * 3 - 3}px;animation-duration:${9 + i * 1.7}s"><ellipse rx="10" ry="4" fill="rgba(30,80,110,.45)"/><path d="M-10 0 L-17 -4 L-17 4Z" fill="rgba(30,80,110,.45)"/></g></g>`).join('');
}
function lkReeds(x, y, k = 1) {
  return `<g transform="${lkP(x, y)} scale(${k})">` + [-9, -4, 1, 6, 11].map((dx, i) => `<path d="M${dx} 0 Q${dx + (i % 2 ? 5 : -5)} -22 ${dx + (i % 2 ? 9 : -9)} -${34 + i * 3}" stroke="#5a8f3c" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')
    + `<ellipse cx="-4" cy="-30" rx="2.6" ry="7" fill="#7a4b24"/><ellipse cx="6" cy="-34" rx="2.6" ry="7" fill="#8a5a2c"/></g>`;
}

/* ---------------- пирс ---------------- */
function lkPier() {
  const x0 = LK.PIER_X0, x1 = LK.PIER_X1, y0 = LK.PIER_Y - .45, y1 = LK.PIER_Y + .45, h = 14;
  let g = '';
  for (let x = x0 + .5; x < x1; x += 1.5) for (const y of [y0 + .08, y1 - .08]) g += faLine([x, y, -4], [x, y, h - 2], '#4a3320', 5);
  g += faPoly([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], '#9a6c3e') + faPoly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], '#6f4a28');
  g += faPoly([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], '#c89a62', 'stroke="#8a6238" stroke-width="1.5"');
  for (let x = x0 + .35; x < x1; x += .35) g += faLine([x, y0, h], [x, y1, h], '#9a6c3e', 1.3);
  g += faLine([x0, y0 + .02, h], [x1, y0 + .02, h], '#8a6238', 2.2) + faLine([x0, y1 - .02, h], [x1, y1 - .02, h], '#7a5430', 2.2);
  return g;
}

/* ---------------- удочка ---------------- */
function lkRod(r, st) {
  const [x, side] = LK_RODS[r.slot], y = LK.PIER_Y + side * .45, h = 14, tipY = y + side * .95, wy = y + side * 1.7, z0 = h + 2, z1 = h + 52;
  const rodSvg = faLine([x, y, z0], [x, tipY, z1], '#5b3a22', 3.6) + faLine([x, y, z0 + 1], [x, tipY, z1 + 1], '#a87b4a', 1.4)
    + `<g transform="${lkP(x, y, z0)}"><rect x="-4" y="-3" width="8" height="6" rx="2" fill="#3f4a55" stroke="#222" stroke-width="1"/></g>`;
  let water = '', info = '';
  if (r.state === 'fishing') {
    const bx = faX(x, wy), by = faY(x, wy), tx = faX(x, tipY), ty = faY(x, tipY, z1);
    water = `<path d="M${tx.toFixed(1)} ${ty.toFixed(1)} Q${((tx + bx) / 2 + side * 6).toFixed(1)} ${((ty + by) / 2 + 30).toFixed(1)} ${bx.toFixed(1)} ${(by - 2).toFixed(1)}" stroke="rgba(255,255,255,.85)" stroke-width="1.4" fill="none"/>`
      + `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><ellipse class="lk-ripple" rx="12" ry="4.5" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.6"/><g class="fs-bob"><circle cy="-4" r="4.4" fill="#fff" stroke="#333" stroke-width="1"/><path d="M-4.4 -4 a4.4 4.4 0 0 1 8.8 0Z" fill="#e63946"/></g></g>`;
    info = faRing(x, y + side * .4, 96, r.left, r.total, ITEMS_ICON(r.bait));
  } else if (r.state === 'ready') {
    const bx = faX(x, wy), by = faY(x, wy);
    water = `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><ellipse class="lk-ripple" rx="16" ry="6" fill="none" stroke="#fff" stroke-width="2.4"/><ellipse class="lk-ripple" style="animation-delay:.4s" rx="10" ry="3.6" fill="none" stroke="#fff" stroke-width="2"/></g>`;
    info = faBubble(x, y + side * .4, 98, '🐟', 'ready');
  } else info = faBubble(x, y + side * .4, 88, '＋', 'add');
  info = `<g style="pointer-events:none">${info}</g>`;
  return `<g class="fs-hit" data-act="lkRod" data-i="${r.slot}" aria-label="Удочка ${r.slot + 1}">${rodSvg}${water}<rect x="${(faX(x, y) - 18).toFixed(1)}" y="${(faY(x, y, 110)).toFixed(1)}" width="36" height="${side < 0 ? 70 : 70}" fill="rgba(0,0,0,0)"/></g>` + info;
}
const ITEMS_ICON = id => ({ wheat: '🌾', corn: '🌽', strawberry: '🍓' })[id] || '🎣';
function lkBuyRod(slot, cost, coins) {
  const [x, side] = LK_RODS[slot], y = LK.PIER_Y + side * .45;
  return `<g class="fs-hit fs-buy" data-act="lkUpgrades" aria-label="Новая удочка"><g transform="${lkP(x, y + side * .3, 14)}"><ellipse cy="4" rx="22" ry="8" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="2.2" stroke-dasharray="4 3"/>`
    + `<text y="2" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1">＋</text><text y="20" text-anchor="middle" font-size="11" font-weight="800" fill="${coins >= cost ? '#fff' : '#ffb3b3'}" stroke="rgba(0,0,0,.4)" stroke-width="2" paint-order="stroke">💰${cost}</text></g></g>`;
}

/* ---------------- лодка ---------------- */
function lkBoat(st) {
  const lv = st.boat, x = 8.9, y = 5.0, big = lv >= 1, hull = lv >= 2 ? '#2f6aa8' : lv >= 1 ? '#a8512f' : '#8a6238';
  const L = big ? 56 : 42;
  let g = `<g class="fs-hit" data-act="lkUpgrades" aria-label="Лодка"><g transform="${lkP(x, y)}"><g class="fs-bob" style="animation-duration:2.6s"><ellipse cy="10" rx="${L + 6}" ry="12" fill="rgba(20,70,100,.3)"/>`
    + `<path d="M${-L} -6 L${L} -6 L${L - 12} 12 L${-L + 12} 12Z" fill="${hull}" stroke="#3b2a1e" stroke-width="2.4"/><path d="M${-L} -6 L${L} -6" stroke="#f2e0b8" stroke-width="4"/>`
    + `<path d="M${-L + 8} 2 L${L - 8} 2" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
  if (big) g += `<rect x="-2" y="-62" width="4" height="58" fill="#5b3a22"/><path d="M3 -60 Q34 -34 3 -8Z" fill="#fff6e0" stroke="#bda98a" stroke-width="1.6"/>`
    + (lv >= 2 ? `<path d="M-2 -62 L-2 -76 L16 -70 L-2 -64Z" fill="#e63946"/><circle cx="-24" cy="-12" r="7" fill="#f2e0b8" stroke="#3b2a1e" stroke-width="1.6"/>` : '');
  else g += `<path d="M-22 -6 L-34 -26" stroke="#5b3a22" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="-36" cy="-30" rx="3.4" ry="7" fill="#a87b4a" transform="rotate(-24 -36 -30)"/>`;
  g += `</g></g>` + (lv < 2 ? `<g transform="${lkP(x, y, 88)}" style="pointer-events:none"><g class="fs-bob"><circle r="11" fill="#2fbf6a" stroke="#fff" stroke-width="2.4"/><text y="5" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">↑</text></g></g>` : '') + `</g>`;
  return g;
}

/* ---------------- берег: лавка, садок, атлас, указатель ---------------- */
function lkShop(st) {
  const x = .3, y = 1.4, w = 2.1, d = 1.8, h = 40, aff = st.upgrades.some(u => u.cost != null && u.cost <= st.coins);
  return `<g class="fs-hit" data-act="lkUpgrades" aria-label="Лавка снастей">` + faBox(x, y, w, d, h, '#d9b88a')
    + faPoly([[x + w * .15, y + d, 0], [x + w * .5, y + d, 0], [x + w * .5, y + d, h * .74], [x + w * .15, y + d, h * .74]], '#7a5030', 'stroke="#f8efe0" stroke-width="2.4"')
    + faPoly([[x + w * .6, y + d, h * .3], [x + w * .88, y + d, h * .3], [x + w * .88, y + d, h * .7], [x + w * .6, y + d, h * .7]], '#bfe6f5', 'stroke="#5b3a22" stroke-width="2.4"')
    + faGable(x, y, w, d, h, 26, '#2f6aa8', '#d9b88a')
    + `<g transform="${lkP(x + w * .5, y + d + .12, h * .88)}"><rect x="-38" y="-9" width="76" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#e8fff4">СНАСТИ</text></g>`
    + `<g transform="${lkP(x + w + .15, y + d * .9)}"><path d="M0 0 V-34" stroke="#5b3a22" stroke-width="3"/><path d="M0 -34 Q16 -30 20 -12" stroke="#a87b4a" stroke-width="2.4" fill="none"/><path d="M20 -12 l-3 -5 l6 0z" fill="#888"/></g>`
    + `</g>` + (aff ? `<g transform="${lkP(x + w / 2, y + d / 2, h + 60)}" style="pointer-events:none"><g class="fs-bob"><circle r="12" fill="#2fbf6a" stroke="#fff" stroke-width="2.5"/><text y="5.5" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">↑</text></g></g>` : '');
}
function lkKeep(st) {
  const x = 1.3, y = 6.0, w = .95, d = .8, h = 24, n = st.keep_used, full = n >= st.keep_cap;
  return `<g class="fs-hit" data-act="lkKeep" aria-label="Садок">` + faBox(x, y, w, d, h, '#b98a56')
    + [.33, .66].map(t => faLine([x, y + d, h * t], [x + w, y + d, h * t], '#7a5430', 2)).join('') + faLine([x + w, y, h * .5], [x + w, y + d, h * .5], '#5e4020', 2)
    + `<g transform="${lkP(x + w / 2, y + d / 2, h)}"><ellipse rx="22" ry="8" fill="#5bb8e0" stroke="#7a5430" stroke-width="3"/>${n ? '<text y="4" text-anchor="middle" font-size="14">🐟</text>' : ''}</g></g>`
    + (n ? faBubble(x + w / 2, y + d / 2, h + 44, `${n}/${st.keep_cap}`, full ? 'ready' : '').replace('font-size="22"', 'font-size="15"') : '');
}
function lkAtlas(st) {
  const found = Object.values(st.tiers).reduce((a, t) => a + t.found, 0), total = Object.values(st.tiers).reduce((a, t) => a + t.total, 0);
  const x = .7, y = 8.0;
  return `<g class="fs-hit" data-act="lkAtlas" aria-label="Рыбный атлас"><g transform="${lkP(x, y)}"><ellipse cy="3" rx="46" ry="12" fill="rgba(0,0,0,.18)"/><rect x="-36" y="-60" width="7" height="62" fill="#6b4426"/><rect x="29" y="-60" width="7" height="62" fill="#6b4426"/>`
    + `<rect x="-42" y="-100" width="84" height="48" rx="5" fill="#f5ead0" stroke="#7a5430" stroke-width="3.4"/><text y="-80" text-anchor="middle" font-size="11" font-weight="900" fill="#5a3d00">РЫБНЫЙ АТЛАС</text>`
    + `<text y="-62" text-anchor="middle" font-size="16" font-weight="900" fill="#2f6aa8">🐟 ${found}/${total}</text></g></g>`;
}
function lkExit() {
  const x = .5, y = .5;
  return `<g class="fs-hit" data-act="lkExit" aria-label="На ферму"><g transform="${lkP(x, y)}"><ellipse cy="3" rx="22" ry="7" fill="rgba(0,0,0,.18)"/><rect x="-3" y="-66" width="6" height="68" fill="#6b4426"/>`
    + `<path d="M-46 -62 H26 L40 -50 L26 -38 H-46 Z" fill="#f5ead0" stroke="#7a5430" stroke-width="3"/><text x="-8" y="-45" text-anchor="middle" font-size="12" font-weight="900" fill="#3b2a1e">НА ФЕРМУ</text></g></g>`;
}

/* ---------------- сцена целиком ---------------- */
function lakeScene(st) {
  const N = LK.N, r = faRng(11), objs = [];
  let g = `<defs><linearGradient id="lkGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9edb6f"/><stop offset="1" stop-color="#7ac555"/></linearGradient><linearGradient id="lkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient></defs>`;
  g += `<rect x="-200" y="-300" width="1600" height="1200" fill="url(#lkSky)"/>`;
  g += `<g opacity=".9"><ellipse cx="190" cy="30" rx="72" ry="16" fill="#fff"/><ellipse cx="236" cy="20" rx="46" ry="14" fill="#fff"/><ellipse cx="880" cy="60" rx="82" ry="17" fill="#fff"/><ellipse cx="930" cy="48" rx="48" ry="14" fill="#fff"/></g>`;
  g += faPoly([[0, N, 0], [N, N, 0], [N, N, -26], [0, N, -26]], '#6b8f3a') + faPoly([[N, 0, 0], [N, N, 0], [N, N, -26], [N, 0, -26]], '#527030');
  g += faPoly([[0, N, -26], [N, N, -26], [N, N, -34], [0, N, -34]], '#7a5a3a') + faPoly([[N, 0, -26], [N, N, -26], [N, N, -34], [N, 0, -34]], '#5d422a');
  g += faPoly([[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]], 'url(#lkGrass)');
  for (let i = 0; i < 110; i++) {
    const x = r() * N, y = r() * N, px = faX(x, y), py = faY(x, y), k = r();
    if (Math.hypot(x - 6.2, (y - 5.5) * 1.2) < 3.9) continue;
    g += k < .8 ? `<path d="M${(px - 4).toFixed(1)} ${py.toFixed(1)} l2 -6 M${px.toFixed(1)} ${py.toFixed(1)} l0 -7 M${(px + 4).toFixed(1)} ${py.toFixed(1)} l-2 -6" stroke="#6bb24a" stroke-width="1.6" stroke-linecap="round" fill="none"/>`
      : `<circle cx="${px.toFixed(1)}" cy="${(py - 3).toFixed(1)}" r="2.6" fill="${['#fff', '#ffd54a', '#ff9ec2', '#b9a1ff'][Math.floor(r() * 4)]}"/>`;
  }
  g += lkWater() + lkSwimmers(st) + lkPier();
  const add = (d, svg) => objs.push({ d, svg });
  add(.3 + 1.4 + 1.8, lkShop(st));
  add(1.3 + 6.0 + .8, lkKeep(st));
  add(.7 + 8.0, lkAtlas(st));
  add(1, lkExit());
  add(8.9 + 5.0 + 3, lkBoat(st));
  st.rods.forEach(rd => add(LK_RODS[rd.slot][0] + LK.PIER_Y + LK_RODS[rd.slot][1] * .45 + (LK_RODS[rd.slot][1] > 0 ? .3 : 0), lkRod(rd, st)));
  if (st.rods.length < st.max_rods) { const c = st.upgrades.find(u => u.key === 'rods').cost; if (c != null) add(LK_RODS[st.rods.length][0] + LK.PIER_Y + 1, lkBuyRod(st.rods.length, c, st.coins)); }
  [[1.4, 9.8], [2.6, 9.9]].forEach(([x, y], i) => add(x + y, lkReeds(x, y, .9 + i * .1)));
  [[2.2, 3.7], [1.9, 4.4], [2.0, 6.7], [9.9, 9.5], [10.2, 2.2]].forEach(([x, y], i) => add(x + y + 4, lkReeds(x, y, 1 + (i % 2) * .15)));
  const trees = [[.4, 3.9, 'oak'], [.3, 10.3, 'pine'], [3.2, .5, 'pine'], [5.2, .4, 'oak'], [8.4, .5, 'pine'], [10.4, .6, 'oak'], [10.6, 10.5, 'pine'], [.3, 5.4, 'pine'], [4.0, 10.5, 'oak']];
  trees.forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 17 + 3)));
  g += objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
  return g;
}
