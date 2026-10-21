/* LearnQuest — графика фермы: изометрическая сцена, нарисованная кодом (SVG). Без картинок.
   Мир — сетка 11×11 клеток. Проекция: sx = (x−y)·48, sy = (x+y)·24 − высота. Сначала рисуется земля, затем предметы по глубине (x+y), чтобы ближние закрывали дальние. */
'use strict';

const FA = { N: 11, OX: 560, OY: 8, INK: '#3b2a1e' };
const faX = (x, y) => (x - y) * 48 + FA.OX, faY = (x, y, z = 0) => (x + y) * 24 - z + FA.OY;
const faPt = (x, y, z = 0) => faX(x, y).toFixed(1) + ',' + faY(x, y, z).toFixed(1);
const faPoly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => faPt(...p)).join(' ')}" fill="${fill}" ${extra}/>`;
const faLine = (a, b, stroke, w = 2) => `<line x1="${faX(a[0], a[1]).toFixed(1)}" y1="${faY(...a).toFixed(1)}" x2="${faX(b[0], b[1]).toFixed(1)}" y2="${faY(...b).toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
function faRng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const faShade = (hex, k) => { const n = parseInt(hex.slice(1), 16), c = i => Math.max(0, Math.min(255, Math.round(((n >> i) & 255) * k))); return '#' + [16, 8, 0].map(i => c(i).toString(16).padStart(2, '0')).join(''); };

/** Коробка: нижние грани видны слева (плоскость y = y+d) и справа (x = x+w), сверху крышка. */
function faBox(x, y, w, d, h, c, extra = '') {
  const L = faShade(c, .86), R = faShade(c, .68);
  return `<g ${extra}>` + faPoly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], L) + faPoly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], R) + faPoly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], c) + '</g>';
}
/** Двускатная крыша, конёк вдоль x. */
function faGable(x, y, w, d, h, r, roof, wall, ov = .12) {
  const R = faShade(wall, .68);
  return faPoly([[x + w, y, h], [x + w, y + d, h], [x + w, y + d / 2, h + r]], R)
    + faPoly([[x - ov, y - ov, h - 2], [x + w + ov, y - ov, h - 2], [x + w + ov, y + d / 2, h + r], [x - ov, y + d / 2, h + r]], faShade(roof, .8))
    + faPoly([[x - ov, y + d + ov, h - 2], [x + w + ov, y + d + ov, h - 2], [x + w + ov, y + d / 2, h + r], [x - ov, y + d / 2, h + r]], roof)
    + faPoly([[x + w + ov, y + d + ov, h - 2], [x + w + ov, y + d / 2, h + r], [x + w + ov, y + d / 2 + .06, h + r - 3], [x + w + ov, y + d + ov, h - 5]], faShade(roof, .7))
    + faLine([x - ov, y + d / 2, h + r], [x + w + ov, y + d / 2, h + r], faShade(roof, .6), 2.5);
}
const faWindow = (x, y, z, plane, s = .26, c = '#ffe9a8') => plane === 'L'
  ? faPoly([[x, y, z], [x + s, y, z], [x + s, y, z + s * 40], [x, y, z + s * 40]], c, 'stroke="#5b3a22" stroke-width="2"')
  : faPoly([[x, y, z], [x, y + s, z], [x, y + s, z + s * 40], [x, y, z + s * 40]], c, 'stroke="#5b3a22" stroke-width="2"');

/* ---------------- растения ---------------- */
const faBlades = (n, h, col, w = 2.2) => Array.from({ length: n }, (_, i) => { const k = i - (n - 1) / 2; return `<path d="M${k * 2.6} 0 Q${k * 2.6 + (i % 2 ? 4 : -4)} ${-h * .55} ${k * 3.6} ${-h}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; }).join('');
const faBush = (r, col, hl) => `<ellipse cx="0" cy="${-r * .55}" rx="${r}" ry="${r * .8}" fill="${col}"/><ellipse cx="${-r * .3}" cy="${-r * .85}" rx="${r * .55}" ry="${r * .4}" fill="${hl}" opacity=".7"/>`;
const faDots = (list, col, r = 2.6) => list.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>`).join('');
const FA_CROPS = {
  wheat: s => s === 0 ? faBlades(2, 7, '#7bcf55') : s === 1 ? faBlades(5, 15, '#5fb642') : faBlades(5, 23, '#dca92b', 2) + `<g fill="#f0c53c" stroke="#b98a14" stroke-width=".6">${[-2, -1, 0, 1, 2].map(k => `<ellipse cx="${k * 3.6}" cy="-23" rx="2.2" ry="5" transform="rotate(${k * 6} ${k * 3.6} -23)"/>`).join('')}</g>`,
  carrot: s => s === 0 ? faBlades(2, 6, '#7bcf55') : faBlades(s === 1 ? 3 : 5, s === 1 ? 13 : 17, '#4fae3a', 1.8) + (s === 2 ? '<ellipse cx="0" cy="1" rx="5" ry="3" fill="#f08a24" stroke="#b9560f" stroke-width="1"/>' : ''),
  corn: s => s === 0 ? faBlades(2, 7, '#7bcf55') : `<path d="M0 0 L0 ${s === 1 ? -18 : -28}" stroke="#4fae3a" stroke-width="3.2" stroke-linecap="round"/><path d="M0 -6 Q-12 -9 -14 -18 M0 -11 Q12 -13 14 -22 M0 -17 Q-10 -19 -11 -27" stroke="#5fb642" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + (s === 2 ? '<ellipse cx="5" cy="-15" rx="3.4" ry="7" fill="#f4cb34" stroke="#b58a0c" stroke-width="1"/><path d="M5 -9 Q8 -16 5 -22" stroke="#7bcf55" stroke-width="3" fill="none"/>' : ''),
  potato: s => s === 0 ? faBlades(2, 6, '#7bcf55') : faBush(s === 1 ? 8 : 10, '#4fa53c', '#78c95a') + (s === 2 ? '<ellipse cx="-6" cy="1" rx="4" ry="2.6" fill="#b88a55" stroke="#7b5a2e" stroke-width=".8"/><ellipse cx="5" cy="2" rx="4.5" ry="2.8" fill="#c39a63" stroke="#7b5a2e" stroke-width=".8"/>' : ''),
  tomato: s => s === 0 ? faBlades(2, 6, '#7bcf55') : faBush(s === 1 ? 9 : 11, '#3f9a3a', '#6cc653') + faDots(s === 1 ? [[-3, -8], [4, -6]] : [[-5, -9], [3, -13], [6, -5], [-1, -4], [-7, -3]], s === 1 ? '#9bd45a' : '#e5392e', 3),
  strawberry: s => s === 0 ? faBlades(2, 5, '#7bcf55') : `<ellipse cx="0" cy="-4" rx="${s === 1 ? 8 : 11}" ry="5" fill="#3f9a3a"/><ellipse cx="-2" cy="-6" rx="6" ry="3" fill="#6cc653"/>` + (s === 2 ? faDots([[-6, -4], [3, -2], [7, -6], [-1, -8]], '#e0263f', 2.8) : ''),
  sunflower: s => s === 0 ? faBlades(2, 7, '#7bcf55') : `<path d="M0 0 L0 ${s === 1 ? -20 : -30}" stroke="#4fae3a" stroke-width="3" stroke-linecap="round"/><path d="M0 -8 Q-9 -10 -11 -17 M0 -13 Q9 -14 11 -21" stroke="#5fb642" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + (s === 2 ? `<g transform="translate(0 -33)">${Array.from({ length: 10 }, (_, i) => `<ellipse cx="0" cy="-6.4" rx="2.3" ry="4.6" fill="#f7c928" transform="rotate(${i * 36})"/>`).join('')}<circle r="4.6" fill="#7a4a1d"/></g>` : '<circle cx="0" cy="-22" r="3.5" fill="#8fd05a"/>'),
  pumpkin: s => s === 0 ? faBlades(2, 6, '#7bcf55') : `<path d="M-12 -4 Q-6 -14 0 -6 Q6 -14 12 -4" fill="#4fa53c" stroke="#2f7a2a" stroke-width="1.2"/>` + (s === 2 ? '<ellipse cx="0" cy="-5" rx="9" ry="7" fill="#f08a1c" stroke="#a85a0c" stroke-width="1.2"/><path d="M-3 -11 Q-4 -5 -3 1 M3 -11 Q4 -5 3 1" stroke="#c46a10" stroke-width="1.2" fill="none"/><rect x="-1.2" y="-14" width="2.4" height="4" fill="#5a8a2a"/>' : '<ellipse cx="0" cy="-3" rx="5" ry="3.5" fill="#9bd45a"/>'),
};

/* ---------------- животные (ноги стоят в точке 0,0) ---------------- */
const FA_ANIMALS = {
  chicken: '<ellipse cx="0" cy="-8" rx="8.5" ry="6.5" fill="#fffdf7" stroke="#6a5a48" stroke-width="1.2"/><path d="M-8 -9 L-13 -14 L-9 -5Z" fill="#f2e7d2" stroke="#6a5a48" stroke-width="1"/><circle cx="7" cy="-15" r="4.2" fill="#fffdf7" stroke="#6a5a48" stroke-width="1.2"/><path d="M5 -20 q2 -4 4 0 q2 -3 1 1z" fill="#e0392f"/><path d="M11 -15 L15 -14 L11 -13Z" fill="#f5a623"/><circle cx="8" cy="-16" r="1" fill="#222"/><path d="M-2 -2 v3 M3 -2 v3" stroke="#e89a1c" stroke-width="1.6"/>',
  cow: '<path d="M-6 -2 v7 M6 -2 v7 M-14 -2 v7 M14 -2 v7" stroke="#4a3b30" stroke-width="3.2" stroke-linecap="round"/><rect x="-19" y="-20" width="38" height="19" rx="8" fill="#fffdf9" stroke="#4a3b30" stroke-width="1.5"/><path d="M-9 -19 q5 1 4 7 q-6 1 -4 -7zM6 -8 q7 -1 8 5 q-7 3 -8 -5z" fill="#3b3430"/><rect x="15" y="-27" width="14" height="14" rx="5" fill="#fffdf9" stroke="#4a3b30" stroke-width="1.5"/><rect x="21" y="-18" width="8" height="6" rx="3" fill="#f5b8c0"/><path d="M17 -27 l-2 -5 M27 -27 l2 -5" stroke="#d9c9a0" stroke-width="2.6" stroke-linecap="round"/><circle cx="21" cy="-22" r="1.4" fill="#222"/><ellipse cx="2" cy="-1" rx="4" ry="2.6" fill="#f5b8c0"/>',
  pig: '<path d="M-9 -2 v6 M9 -2 v6" stroke="#d98a96" stroke-width="3.6" stroke-linecap="round"/><ellipse cx="0" cy="-11" rx="16" ry="10" fill="#f7b3bd" stroke="#a65b68" stroke-width="1.4"/><circle cx="14" cy="-13" r="8" fill="#f7b3bd" stroke="#a65b68" stroke-width="1.4"/><ellipse cx="20" cy="-11" rx="4.2" ry="3.2" fill="#f19aa8" stroke="#a65b68" stroke-width="1"/><path d="M12 -20 l-1 -5 l5 3z" fill="#f19aa8" stroke="#a65b68" stroke-width="1"/><circle cx="14" cy="-15" r="1.3" fill="#222"/><path d="M-16 -12 q-6 -2 -4 4" stroke="#a65b68" stroke-width="1.8" fill="none"/>',
  sheep: '<path d="M-8 -2 v7 M8 -2 v7" stroke="#3a3430" stroke-width="3" stroke-linecap="round"/><g fill="#fbfaf6" stroke="#9a948a" stroke-width="1.2"><circle cx="-10" cy="-12" r="8"/><circle cx="0" cy="-16" r="9"/><circle cx="10" cy="-12" r="8"/><circle cx="-2" cy="-8" r="9"/></g><ellipse cx="17" cy="-12" rx="6" ry="6.6" fill="#4a423c"/><circle cx="19" cy="-13" r="1.2" fill="#fff"/><path d="M13 -17 l-3 -3 M20 -18 l2 -4" stroke="#4a423c" stroke-width="2.4" stroke-linecap="round"/>',
};

/* ---------------- постройки ---------------- */
function faBubble(x, y, z, text, cls = '') {
  return `<g transform="translate(${faX(x, y).toFixed(1)} ${faY(x, y, z).toFixed(1)})" class="fs-bubble ${cls}"><g class="fs-bob"><path d="M-17 -14 h34 q8 0 8 8 v10 q0 8 -8 8 h-9 l-8 9 l-8 -9 h-9 q-8 0 -8 -8 v-10 q0 -8 8 -8z" fill="#fff" stroke="${FA.INK}" stroke-width="2"/><text y="8" text-anchor="middle" font-size="22">${text}</text></g></g>`;
}
function faRing(x, y, z, left, total, icon = '') {
  const R = 15, C = 2 * Math.PI * R, k = Math.max(0, Math.min(1, 1 - left / Math.max(1, total)));
  return `<g transform="translate(${faX(x, y).toFixed(1)} ${faY(x, y, z).toFixed(1)})"><circle r="${R + 3}" fill="#fff" stroke="${FA.INK}" stroke-width="2"/><circle r="${R}" fill="none" stroke="#e3dccb" stroke-width="5"/><circle class="fs-ring" data-total="${total}" data-end="${FARM_END(left)}" data-c="${C.toFixed(1)}" r="${R}" fill="none" stroke="#3ddc84" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(C * k).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>${icon ? `<text y="6" text-anchor="middle" font-size="16">${icon}</text>` : ''}</g>`;
}
const FARM_END = left => Math.round(FARM.t0 + left * 1000);

function faBarn(x, y, st) {
  const w = 2.6, d = 2.2, h = 46;
    return `<g class="fs-hit" data-act="fmBarn" aria-label="Склад">` + faBox(x, y, w, d, h, '#c8412f')
    + faPoly([[x + w * .3, y + d, 0], [x + w * .7, y + d, 0], [x + w * .7, y + d, h * .78], [x + w * .3, y + d, h * .78]], '#a3321f', 'stroke="#f8efe0" stroke-width="3"')
    + faLine([x + w * .3, y + d, 0], [x + w * .7, y + d, h * .78], '#f8efe0', 3) + faLine([x + w * .7, y + d, 0], [x + w * .3, y + d, h * .78], '#f8efe0', 3)
    + faGable(x, y, w, d, h, 30, '#7a5338', '#c8412f') + faPoly([[x + w, y + d * .35, h + 4], [x + w, y + d * .65, h + 4], [x + w, y + d * .65, h + 18], [x + w, y + d * .35, h + 18]], '#3a1e16')
    + faLine([x, y + d, h], [x + w, y + d, h], '#f8efe0', 2.5)
    + `</g>`;
}

function faKitchen(x, y, st) {
  const w = 2, d = 1.8, h = 34, k = st.kitchen;
  const smoke = k && k.state === 'working' ? [0, 1, 2].map(i => `<circle class="fs-smoke" style="animation-delay:${i * .9}s" cx="0" cy="0" r="6" fill="#fff"/>`).join('') : '';
  return `<g class="fs-hit" data-act="fmKitchenOpen" aria-label="Кухня">` + faBox(x, y, w, d, h, '#e6d7b4')
    + faPoly([[x + w * .12, y + d, 0], [x + w * .38, y + d, 0], [x + w * .38, y + d, h * .66], [x + w * .12, y + d, h * .66]], '#8a5a34', 'stroke="#5b3a22" stroke-width="2"') + faWindow(x + w * .55, y + d, h * .35, 'L', .3) + faWindow(x + w, y + d * .35, h * .35, 'R', .3)
    + faBox(x + w * .66, y + d * .15, .3, .3, h + 24, '#a85c44')
    + `<g transform="translate(${faX(x + w * .8, y + d * .3).toFixed(1)} ${faY(x + w * .8, y + d * .3, h + 28).toFixed(1)})">${smoke}</g>`
    + faGable(x, y, w, d, h, 22, '#b4513a', '#e6d7b4')
    + `<text x="${faX(x + w * .25, y + d).toFixed(1)}" y="${(faY(x + w * .25, y + d, h + 6) - 2).toFixed(1)}" text-anchor="middle" font-size="22">🍞</text>`
    + `</g>` + (k ? (k.state === 'ready' ? faBubble(x + w * .5, y + d * .5, h + 56, FARM.st.catalog.items[k.recipe].icon, 'ready') : faRing(x + w * .5, y + d * .5, h + 56, k.left, k.total, FARM.st.catalog.items[k.recipe].icon)) : '');
}

function faBoard(x, y, st) {
  const n = st.orders.filter(o => Object.entries(o.items).every(([i, q]) => (st.stock[i] || 0) >= q)).length;
  const papers = [['#fff7c2', .22, 22], ['#cfe9ff', .52, 26], ['#ffd9d9', .34, 38]];
  return `<g class="fs-hit" data-act="fmOrdersOpen" aria-label="Заказы">` + faBox(x, y, .12, .12, 44, '#7a5230') + faBox(x, y + 1.3, .12, .12, 44, '#7a5230')
    + faPoly([[x + .14, y - .1, 20], [x + .14, y + 1.5, 20], [x + .14, y + 1.5, 58], [x + .14, y - .1, 58]], '#a8774a', 'stroke="#5b3a22" stroke-width="2.5"')
    + papers.map(([c, t, z]) => faPoly([[x + .15, y + t * 3 + .1, z + 1], [x + .15, y + t * 3 + .55, z + 1], [x + .15, y + t * 3 + .55, z + 17], [x + .15, y + t * 3 + .1, z + 17]], c, 'stroke="#7a5a3a" stroke-width="1"')).join('')
    + `<text x="${faX(x + .15, y + .8).toFixed(1)}" y="${(faY(x + .15, y + .8, 66)).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" stroke="#000" stroke-width=".6">ЗАКАЗЫ</text></g>` + (n ? `<g transform="translate(${faX(x, y + .9).toFixed(1)} ${faY(x, y + .9, 96).toFixed(1)})"><g class="fs-bob"><circle r="11" fill="#2fbf6a" stroke="#fff" stroke-width="2"/><text y="5" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">${n}</text></g></g>` : '');
}

function faWindmill(x, y) {
  const hx = faX(x + .5, y + .5), hy = faY(x + .5, y + .5, 78);
  return faBox(x, y, 1, 1, 58, '#efe6d3') + faPoly([[x - .1, y - .1, 58], [x + 1.1, y - .1, 58], [x + 1.1, y + 1.1, 58], [x - .1, y + 1.1, 58]], '#b6573f')
    + faPoly([[x - .1, y + 1.1, 58], [x + 1.1, y + 1.1, 58], [x + .5, y + .5, 86]], '#c96a4f') + faPoly([[x + 1.1, y - .1, 58], [x + 1.1, y + 1.1, 58], [x + .5, y + .5, 86]], '#a4503a')
    + faPoly([[x + .3, y + 1, 0], [x + .7, y + 1, 0], [x + .7, y + 1, 22], [x + .3, y + 1, 22]], '#7a5230')
    + `<g transform="translate(${hx.toFixed(1)} ${(hy + 10).toFixed(1)})"><g class="fs-spin">${[0, 90, 180, 270].map(a => `<g transform="rotate(${a})"><rect x="-2.5" y="-46" width="5" height="46" fill="#7a5230"/><rect x="3" y="-46" width="14" height="30" fill="#fff" stroke="#9a8a70" stroke-width="1.5"/></g>`).join('')}<circle r="5" fill="#5b3a22"/></g></g>`;
}

function faTree(x, y, kind, seed) {
  const r = faRng(seed), s = .85 + r() * .4, cx = faX(x, y), cy = faY(x, y);
  if (kind === 'pine') return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(2)})"><ellipse cy="2" rx="16" ry="6" fill="rgba(0,0,0,.18)"/><rect x="-4" y="-12" width="8" height="14" fill="#6b4426"/><path d="M-22 -10 L0 -46 L22 -10Z" fill="#2f8a4a"/><path d="M-18 -30 L0 -64 L18 -30Z" fill="#37a058"/><path d="M-13 -50 L0 -80 L13 -50Z" fill="#43b868"/></g>`;
  const col = ['#4caf50', '#5cbf55', '#3f9e46'][seed % 3];
  return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(2)})"><ellipse cy="2" rx="20" ry="7" fill="rgba(0,0,0,.18)"/><rect x="-5" y="-30" width="10" height="32" rx="2" fill="#7a5230"/><circle cx="-12" cy="-40" r="16" fill="${faShade(col, .85)}"/><circle cx="12" cy="-42" r="16" fill="${faShade(col, .9)}"/><circle cx="0" cy="-54" r="19" fill="${col}"/><circle cx="-6" cy="-60" r="9" fill="#8ad46f" opacity=".6"/></g>`;
}
const faBushSvg = (x, y) => `<g transform="translate(${faX(x, y).toFixed(1)} ${faY(x, y).toFixed(1)})"><ellipse cy="1" rx="13" ry="5" fill="rgba(0,0,0,.15)"/><circle cx="-6" cy="-6" r="8" fill="#3f9e46"/><circle cx="6" cy="-6" r="8" fill="#4caf50"/><circle cy="-11" r="8" fill="#5cbf55"/>${faDots([[-6, -8], [5, -4], [0, -14]], '#ff6b8a', 2.2)}</g>`;


/** Люк в лабораторию: почти не заметен среди травы, при наведении подсвечивается. */
function faHatch(x, y) {
  const w = .9, d = .66, p = (a, b, z = 0) => [x + w * a, y + d * b, z], c = (a, b, z = 0) => [faX(x + w * a, y + d * b), faY(x + w * a, y + d * b, z)];
  const [hx, hy] = c(.5, .5, 5), [t1x, t1y] = c(.1, .9), [t2x, t2y] = c(.92, .16);
  return `<g class="fs-hatch" data-act="labOpen" aria-label="Люк">`
    + faPoly([p(-.15, -.2), p(1.15, -.2), p(1.15, 1.2), p(-.15, 1.2)], 'rgba(0,0,0,0)')
    + faPoly([p(0, 0), p(1, 0), p(1, 1), p(0, 1)], '#4f6f3a', 'stroke="#3f5a2e" stroke-width="2.5"')
    + faPoly([p(.04, .04, 5), p(.96, .04, 5), p(.96, .96, 5), p(.04, .96, 5)], '#8a7350', 'stroke="#5e4a2e" stroke-width="2" class="fs-hatch-fr"')
    + [.25, .5, .75].map(t => faLine(p(.04, t, 5), p(.96, t, 5), '#6a5636', 1.8)).join('')
    + faLine(p(.5, .04, 5), p(.5, .96, 5), '#6a5636', 1.8)
    + `<ellipse cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" rx="4.6" ry="2.4" fill="none" stroke="#3b3b40" stroke-width="2"/>`
    + `<path d="M${t1x - 3} ${t1y} l2 -7 M${t1x + 2} ${t1y} l0 -8 M${t1x + 6} ${t1y} l-1 -6 M${t2x - 2} ${t2y} l1 -7 M${t2x + 3} ${t2y} l0 -6" stroke="#6bb24a" stroke-width="2" stroke-linecap="round" fill="none"/></g>`;
}

/* ---------------- загоны ---------------- */
const FA_PENS = {
  chicken: { x: .4, y: 5.6, w: 2.6, d: 2.5, ground: '#d9c58a', shed: '#c98f4f', roof: '#c8412f', mark: '🐔' },
  cow: { x: 8.1, y: 3.5, w: 2.7, d: 2.7, ground: '#a9d27e', shed: '#e8e0d0', roof: '#4a6fa5', mark: '🐄' },
  pig: { x: 3.3, y: 8.1, w: 2.8, d: 2.6, ground: '#a98560', shed: '#c28a6a', roof: '#7a4a38', mark: '🐖' },
  sheep: { x: 7.7, y: 7.5, w: 2.9, d: 2.7, ground: '#b8dc8c', shed: '#dcc093', roof: '#4f8a52', mark: '🐑' },
};
function faFence(x, y, w, d, sides, locked) {
  const col = locked ? '#9a9288' : '#a8774a', hi = locked ? '#b8b0a4' : '#c99a64', out = [];
  const edge = (a, b) => {
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / .5)), pts = Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    out.push(faLine([a[0], a[1], 7], [b[0], b[1], 7], hi, 3), faLine([a[0], a[1], 13], [b[0], b[1], 13], hi, 3));
    pts.forEach(p => out.push(faLine([p[0], p[1], 0], [p[0], p[1], 16], col, 4)));
  };
  if (sides === 'back') { edge([x, y], [x + w, y]); edge([x, y], [x, y + d]); }
  else { edge([x, y + d], [x + w, y + d]); edge([x + w, y], [x + w, y + d]); }
  return out.join('');
}
function faPen(p, st) {
  const g = FA_PENS[p.pen], a = st.catalog.animals.find(z => z.id === p.pen), c = faRng(p.pen.length * 977 + 11);
  const { x, y, w, d } = g, locked = p.locked, cx = x + w / 2, cy = y + d / 2;
  const sx0 = x + .35, sy0 = y + .35;
  const shed = faBox(sx0, sy0, 1.1, 1.0, 26, g.shed) + faGable(sx0, sy0, 1.1, 1.0, 26, 13, g.roof, g.shed, .08)
    + faPoly([[sx0 + .3, sy0 + 1.0, 0], [sx0 + .8, sy0 + 1.0, 0], [sx0 + .8, sy0 + 1.0, 14], [sx0 + .3, sy0 + 1.0, 14]], '#4a2f1c');
  const ax = (w - .9) * 48 * .55, ay = (d - .9) * 24 * .8;
  const animals = locked ? '' : Array.from({ length: p.count }, (_, i) => {
    const px = x + .9 + c() * (w - 1.5), py = y + 1.2 + c() * (d - 1.7), amp = 10 + c() * 14;
    return { d: px + py, svg: `<g transform="translate(${faX(px, py).toFixed(1)} ${faY(px, py).toFixed(1)})"><g class="fs-wander" style="--ax:${(c() * 2 - 1) * amp}px;--ay:${(c() * 2 - 1) * amp * .5}px;--bx:${(c() * 2 - 1) * amp}px;--by:${(c() * 2 - 1) * amp * .5}px;animation-duration:${9 + c() * 8}s;animation-delay:-${(c() * 12).toFixed(1)}s"><ellipse cy="1" rx="12" ry="4" fill="rgba(0,0,0,.2)"/>${FA_ANIMALS[p.pen]}</g></g>` };
  }).sort((u, v) => u.d - v.d).map(u => u.svg).join('');
  void ax; void ay;
  const label = locked ? `<g transform="translate(${faX(cx, cy).toFixed(1)} ${faY(cx, cy, 20).toFixed(1)})"><rect x="-44" y="-16" width="88" height="34" rx="12" fill="rgba(20,22,30,.78)"/><text y="1" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">🔒 ${g.mark} уровень ${a.level}</text><text y="14" text-anchor="middle" font-size="10" fill="#cfd5e6">откроется позже</text></g>` : '';
  const info = !locked && p.state === 'ready' ? faBubble(cx, cy, 42, a.product && FARM.st.catalog.items[a.product].icon + '×' + p.fed_count, 'ready')
    : !locked && p.state === 'working' ? faRing(cx, cy, 42, p.left, p.total, FARM.st.catalog.items[a.product].icon) : !locked && p.count === 0 ? faBubble(cx, cy, 36, '＋', 'add') : '';
  return `<g class="fs-hit ${locked ? 'locked' : ''}" data-act="fmPenOpen" data-pen="${p.pen}" aria-label="${a.name}">`
    + faPoly([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]], g.ground, 'stroke="rgba(0,0,0,.18)" stroke-width="2"')
    + faFence(x, y, w, d, 'back', locked) + shed + animals + faFence(x, y, w, d, 'front', locked) + '</g>' + label + info;
}

/* ---------------- грядки ---------------- */
function faPlot(p, st) {
  const x = 3 + (p.idx % 4), y = 3 + Math.floor(p.idx / 4), m = .06, X = x + m, Y = y + m, S = 1 - 2 * m;
  const soil = p.state === 'empty' ? '#6e4527' : '#8a5a34';
  let s = `<g class="fs-hit fs-plot ${p.state}" data-act="fmPlot" data-i="${p.idx}" aria-label="Грядка ${p.idx + 1}">`
    + faPoly([[X, Y + S, 0], [X + S, Y + S, 0], [X + S, Y + S, -9], [X, Y + S, -9]], '#5b3a22') + faPoly([[X + S, Y, 0], [X + S, Y + S, 0], [X + S, Y + S, -9], [X + S, Y, -9]], '#46301c')
    + faPoly([[X, Y, 0], [X + S, Y, 0], [X + S, Y + S, 0], [X, Y + S, 0]], soil, 'stroke="#4a2f1b" stroke-width="2.5"');
  for (let i = 1; i <= 3; i++) s += faLine([X + .04, Y + S * i / 4, 0], [X + S - .04, Y + S * i / 4, 0], faShade(soil, .78), 2.5);
  if (p.state !== 'empty') {
    const crop = p.crop, stage = p.state === 'ready' ? 2 : p.progress < .34 ? 0 : 1, scale = stage === 0 ? 1.15 : 1.4;
    const spots = [];
    for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) spots.push([X + S * (.26 + q * .48), Y + S * (.2 + r * .3)]);
    s += spots.map(([px, py], i) => `<g transform="translate(${faX(px, py).toFixed(1)} ${faY(px, py).toFixed(1)}) scale(${scale})"><g class="${stage === 2 ? 'fs-sway' : ''}" style="animation-delay:${(i * .23).toFixed(2)}s">${FA_CROPS[crop](stage)}</g></g>`).join('');
    if (p.state === 'growing') {
      const c = st.catalog.crops.find(z => z.id === crop), bx = faX(X + S, Y + S) - 22, by = faY(X + S, Y + S) + 7;
      s += `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><rect width="44" height="7" rx="3.5" fill="rgba(0,0,0,.5)"/><rect class="fs-prog" data-w="42" data-total="${c.time}" data-end="${FARM_END(p.left)}" x="1" y="1" width="${(42 * p.progress).toFixed(1)}" height="5" rx="2.5" fill="#6fe08a"/></g>`;
    } else s += `<polygon points="${[[X, Y], [X + S, Y], [X + S, Y + S], [X, Y + S]].map(q => faPt(q[0], q[1])).join(' ')}" fill="none" stroke="#ffe566" stroke-width="3.5" class="fs-glow"/>`;
  }
  return s + '</g>';
}
function faBuyPlot(idx, cost, coins) {
  const x = 3 + (idx % 4), y = 3 + Math.floor(idx / 4), m = .06, X = x + m, Y = y + m, S = 1 - 2 * m;
  return `<g class="fs-hit fs-buy" data-act="fmBuyPlot" aria-label="Новая грядка">` + faPoly([[X, Y, 0], [X + S, Y, 0], [X + S, Y + S, 0], [X, Y + S, 0]], 'rgba(255,255,255,.28)', 'stroke="#fff" stroke-width="3" stroke-dasharray="7 5"')
    + `<text x="${faX(X + S / 2, Y + S / 2).toFixed(1)}" y="${(faY(X + S / 2, Y + S / 2) - 2).toFixed(1)}" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1">＋</text>`
    + `<text x="${faX(X + S / 2, Y + S / 2).toFixed(1)}" y="${(faY(X + S / 2, Y + S / 2) + 15).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="${coins >= cost ? '#fff' : '#ffb3b3'}" stroke="rgba(0,0,0,.4)" stroke-width=".5">💰 ${cost}</text></g>`;
}

/** Мосток и табличка у пруда: вход на «Озеро» (рыбалка). Пока ферма ниже 10 уровня, табличка с замком. */
function faLakeGate(st) {
  const ok = st.farm.level >= 10, x = 1.45, y = .5;
  let g = faPoly([[x - .32, y - .1, 5], [x + .32, y - .1, 5], [x + .32, y + .85, 5], [x - .32, y + .85, 5]], '#c89a62', 'stroke="#8a6238" stroke-width="1.6"');
  for (let t = 0; t < .85; t += .22) g += faLine([x - .32, y + t, 5], [x + .32, y + t, 5], '#9a6c3e', 1.2);
  g += `<g transform="translate(${faX(x + .75, y - .1).toFixed(1)} ${faY(x + .75, y - .1).toFixed(1)})"><ellipse cy="3" rx="20" ry="6" fill="rgba(0,0,0,.16)"/><rect x="-2.5" y="-50" width="5" height="52" fill="#6b4426"/>`
    + `<path d="M-30 -56 H26 L38 -44 L26 -32 H-30Z" fill="${ok ? '#f5ead0' : '#cfc7b4'}" stroke="#7a5430" stroke-width="2.6"/><text x="-2" y="-39" text-anchor="middle" font-size="11.5" font-weight="900" fill="#3b2a1e">${ok ? '🎣 Озеро' : '🔒 ур. 10'}</text></g>`;
  return g;
}

/* ---------------- сцена целиком ---------------- */
function farmScene(st) {
  const N = FA.N, r = faRng(7), objs = [];
  let g = `<defs><linearGradient id="faGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9edb6f"/><stop offset="1" stop-color="#7ac555"/></linearGradient><linearGradient id="faSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e8f7ff"/></linearGradient></defs>`;
  g += `<rect x="-200" y="-300" width="1600" height="1200" fill="url(#faSky)"/>`;
  g += `<g opacity=".9"><ellipse cx="170" cy="40" rx="70" ry="16" fill="#fff"/><ellipse cx="215" cy="30" rx="44" ry="14" fill="#fff"/><ellipse cx="900" cy="70" rx="80" ry="17" fill="#fff"/><ellipse cx="950" cy="58" rx="48" ry="14" fill="#fff"/></g>`;
  // земля-плита
  g += faPoly([[0, N, 0], [N, N, 0], [N, N, -26], [0, N, -26]], '#6b8f3a') + faPoly([[N, 0, 0], [N, N, 0], [N, N, -26], [N, 0, -26]], '#527030');
  g += faPoly([[0, N, -26], [N, N, -26], [N, N, -34], [0, N, -34]], '#7a5a3a') + faPoly([[N, 0, -26], [N, N, -26], [N, N, -34], [N, 0, -34]], '#5d422a');
  g += faPoly([[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]], 'url(#faGrass)');
  for (let i = 0; i < 150; i++) {
    const x = r() * N, y = r() * N, px = faX(x, y), py = faY(x, y), k = r();
    g += k < .78 ? `<path d="M${(px - 4).toFixed(1)} ${py.toFixed(1)} l2 -6 M${px.toFixed(1)} ${py.toFixed(1)} l0 -7 M${(px + 4).toFixed(1)} ${py.toFixed(1)} l-2 -6" stroke="#6bb24a" stroke-width="1.6" stroke-linecap="round" fill="none"/>`
      : `<circle cx="${px.toFixed(1)}" cy="${(py - 3).toFixed(1)}" r="2.6" fill="${['#fff', '#ffd54a', '#ff9ec2', '#b9a1ff'][Math.floor(r() * 4)]}"/>`;
  }
  // дорожка из камней
  const stones = [[5.2, 2.6], [5.6, 2.1], [4.8, 2.9], [2.9, 4.5], [2.6, 5.2], [7.4, 5.5], [7.7, 6.4], [5.5, 7.6], [5.0, 8.0]];
  stones.forEach(([x, y]) => { g += faPoly([[x, y, 0], [x + .38, y, 0], [x + .38, y + .38, 0], [x, y + .38, 0]], '#d4c6a0', 'stroke="#a8996f" stroke-width="1.5"'); });
  // пруд
  const pond = Array.from({ length: 22 }, (_, i) => { const a = i / 22 * Math.PI * 2; return [1.35 + Math.cos(a) * 1.15 + Math.sin(a * 3) * .08, 1.45 + Math.sin(a) * .85, 0]; });
  g += `<g class="fs-hit" data-act="lakeOpen" aria-label="Озеро">` + faPoly(pond, '#6ec8ec', 'stroke="#3d95b8" stroke-width="3"') + faPoly(pond.map(([x, y]) => [1.35 + (x - 1.35) * .6, 1.45 + (y - 1.45) * .6 - .05, 0]), '#8fdcf5', 'opacity=".7"')
    + `<g transform="translate(${faX(1.2, 1.4).toFixed(1)} ${faY(1.2, 1.4).toFixed(1)})"><ellipse rx="9" ry="4" fill="#4caf50"/><circle cx="3" cy="-1" r="2.4" fill="#ff9ec2"/><ellipse cx="34" cy="8" rx="7" ry="3" fill="#4caf50"/></g>` + faLakeGate(st) + `</g>`;

  // предметы, отсортированные по глубине
  const add = (d, svg) => objs.push({ d, svg });
  add(6.2 + 1.4, faBarn(4.9, .3, st));
  add(1.6 + 4.2, faKitchen(.6, 3.2, st));
  add(3.4 + 1.7, faBoard(3.4, 1.0, st));
  add(8.4 + .8, faWindmill(8.6, .5));
  add(9.0 + 1.95, faHatch(9.0, 1.9));
  st.plots.forEach(p => add(3 + p.idx % 4 + 3 + Math.floor(p.idx / 4) + 1, faPlot(p, st)));
  if (st.farm.plot_cost != null) { const i = st.plots.length; add(3 + i % 4 + 3 + Math.floor(i / 4) + 1, faBuyPlot(i, st.farm.plot_cost, st.farm.coins)); }
  st.pens.forEach(p => { const pg = FA_PENS[p.pen]; add(pg.x + pg.w / 2 + pg.y + pg.d / 2, faPen(p, st)); });
  const trees = [[.4, .4, 'oak'], [2.6, .3, 'pine'], [3.4, 1.6, 'pine'], [.5, 2.4, 'oak'], [10.2, .4, 'pine'], [10.4, 1.9, 'oak'], [7.9, 1.0, 'pine'], [.6, 9.9, 'oak'], [2.0, 10.4, 'pine'], [10.3, 10.4, 'oak'], [6.7, 10.5, 'pine'], [10.6, 6.9, 'pine'], [.3, 4.9, 'pine']];
  trees.forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 31 + 5)));
  [[2.8, 3.3], [7.5, 7.3], [3.1, 10.4], [6.9, 2.6]].forEach(([x, y]) => add(x + y, faBushSvg(x, y)));
  g += objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
  return g;
}
