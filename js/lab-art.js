/* LearnQuest — графика лаборатории (подвал фермы): изометрическая комната, нарисованная кодом (SVG). Помощники и проекция — из farm-art.js.
   Комната 8×8 клеток. Стены: правая — плоскость y = 0, левая — плоскость x = 0. Предметы на стенах рисуются в «плоскости» (laPlane), на полу — в клетках. */
'use strict';

const LA = { N: 8, WALL: 190 };
/* кадки: клетки пола; расставлены «в шахматку», чтобы лампы и кроны не слипались */
const LA_POTS = [[1.6, 1.7], [3.6, 1.7], [5.6, 1.7], [3.2, 4.3], [5.2, 4.3], [7.2, 4.3]];
/* цвета хвои: тёмный, средний, светлый */
const LA_COL = {
  spruce_common: ['#1f6b3d', '#2f8a52', '#47a86a'], spruce_siberian: ['#1d5f4a', '#2a7a5e', '#3f9677'], fir_siberian: ['#2c6b32', '#41893f', '#5ea851'],
  spruce_blue: ['#3f6f9c', '#5a8fbf', '#86b4dc'], fir_balsam: ['#17573f', '#217552', '#33946b'], spruce_serbian: ['#1b4f4a', '#2a6e66', '#3f8f85'],
  fir_nordmann: ['#14502c', '#1d6e3d', '#2f8f55'], spruce_engelmann: ['#4d7fa0', '#6fa0bf', '#9cc5dc'], fir_korean: ['#2f6a2b', '#46893f', '#71b05e'],
  spruce_gold: ['#b8861c', '#e0b02f', '#fbe27a'], spruce_crystal: ['#6fb8d8', '#a8e4f5', '#e8fbff'],
};
const laIcon = id => id === 'spruce_gold' ? '🌟' : id === 'spruce_crystal' ? '💎' : id.startsWith('fir') ? '🎄' : '🌲';
const laConeCol = id => id === 'spruce_gold' ? ['#c9931a', '#f6cf4a'] : id === 'spruce_crystal' ? ['#7ec9e6', '#d8f6ff'] : ['#7a4c22', '#b98348'];
const LA_TIER = { spruce_common: 1, spruce_siberian: 1, fir_siberian: 1, spruce_blue: 2, fir_balsam: 2, spruce_serbian: 2, fir_nordmann: 3, spruce_engelmann: 3, fir_korean: 3, spruce_gold: 4, spruce_crystal: 4 };
const laUp = (st, key) => st.upgrades.find(u => u.key === key).level;

/** Группа в плоскости стены. 'R' — правая стена (y=0), локальная ось x идёт вправо-вниз; 'L' — левая (x=0), локальная ось x идёт вправо-вверх (к углу). Единица = 1 px. */
function laPlane(plane, u, z, inner, attrs = '') {
  const [x, y] = plane === 'R' ? [u, 0] : [0, u];
  return `<g ${attrs} transform="translate(${faX(x, y).toFixed(1)} ${faY(x, y, z).toFixed(1)}) matrix(1 ${plane === 'R' ? .5 : -.5} 0 1 0 0)">${inner}</g>`;
}
const laCone = (c, r = 1) => `<g transform="scale(${r})"><ellipse rx="3.4" ry="5.6" fill="${c[0]}" stroke="rgba(0,0,0,.3)" stroke-width=".6"/><path d="M-3 -2 L3 -2 M-3.2 1 L3.2 1 M-2.4 4 L2.4 4 M0 -5.4 L0 5.4" stroke="${c[1]}" stroke-width=".9" opacity=".8"/></g>`;

/* ---------------- ель / пихта ---------------- */
/** Дерево в начале координат (низ ствола). k — рост 0…1, cones — сколько шишек показать. */
function laTreeSvg(sp, k, cones = 0, mutant = false) {
  const col = LA_COL[sp], tier = LA_TIER[sp], n = tier >= 3 ? 6 : 5, H = 34 + 96 * k, rad = 12 + 24 * k;
  let s = `<rect x="${-2.5 - 2 * k}" y="${-12 - 8 * k}" width="${5 + 4 * k}" height="${14 + 8 * k}" fill="#6b4426"/>`;
  const tiers = [];
  for (let i = 0; i < n; i++) {
    const f = i / n, hw = rad * (1 - f * .78), yb = -10 - (H - 14) * f * .92, th = (H / n) * 1.55;
    tiers.push({ hw, yb, th });
    const ragged = sp.startsWith('spruce') ? `L${(-hw * .55).toFixed(1)} ${(yb + 3).toFixed(1)} ` : '';
    s += `<path d="M${-hw.toFixed(1)} ${yb.toFixed(1)} ${ragged}L0 ${(yb - th).toFixed(1)} L${hw.toFixed(1)} ${yb.toFixed(1)}Z" fill="${i % 2 ? col[1] : col[0]}"/>`
      + `<path d="M0 ${(yb - th).toFixed(1)} L${hw.toFixed(1)} ${yb.toFixed(1)} L${(hw * .1).toFixed(1)} ${yb.toFixed(1)}Z" fill="${col[2]}" opacity=".55"/>`;
  }
  if (mutant) {
    const sp2 = sp === 'spruce_crystal' ? ['#fff', '#bdefff'] : ['#fff6b0', '#ffd24a'];
    s += [[-.5, -.35], [.45, -.62], [-.2, -.9], [.3, -.15]].map(([a, b], i) => `<path class="fs-glow" style="animation-delay:${i * .35}s" d="M${(a * rad * 1.4).toFixed(1)} ${(b * H - 6).toFixed(1)} l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2z" fill="${sp2[0]}" stroke="${sp2[1]}" stroke-width=".8"/>`).join('');
  }
  const cc = laConeCol(sp), m = Math.min(cones, 8), spots = [[-.7, 0], [.7, 1], [-.5, 2], [.55, 3], [-.3, 4], [.35, 1], [-.6, 3], [.6, 4]];
  for (let i = 0; i < m; i++) { const [side, ti] = spots[i], t = tiers[Math.min(ti, n - 1)]; s += `<g transform="translate(${(side * t.hw).toFixed(1)} ${(t.yb + 4).toFixed(1)}) rotate(${side * 12})">${laCone(cc, 1.05)}</g>`; }
  return s;
}
/** Кадка с деревом. t — состояние дерева с сервера. */
function laPot(t, st) {
  const [x, y] = LA_POTS[t.slot], sx = faX(x, y), sy = faY(x, y), lamps = laUp(st, 'lamps');
  let tree = '', info = '';
  if (t.state === 'growing') {
    const k = .16 + .5 * t.progress;
    tree = laTreeSvg(t.species, k);
    const total = t.progress < 1 ? t.left / (1 - t.progress) : t.left;
    info = faRing(x, y, -54, t.left, total, laIcon(t.species));
  } else if (t.state === 'mature') {
    tree = laTreeSvg(t.species, 1, t.cones, t.mutant);
    if (t.cones > 0) info = faBubble(x + .6, y - .6, 118, '🌰×' + t.cones, t.cones >= t.cap ? 'ready' : '');
    if (t.cones < t.cap && t.next_in > 0) info += faRing(x, y, -54, t.next_in, t.cycle, '🌰');
  } else info = faBubble(x, y, 70, '＋', 'add');
  info = `<g style="pointer-events:none">${info}</g>`;
  const lamp = `<g class="la-lamp"><path d="M0 -300 V-172" stroke="#4a5560" stroke-width="2"/>`
    + (lamps ? `<path d="M-12 -170 L-52 -22 L52 -22 L12 -170Z" fill="url(#laBeam)" opacity="${(.28 + .14 * lamps).toFixed(2)}"/>` : '')
    + `<path d="M-15 -166 Q0 -190 15 -166Z" fill="${lamps ? '#7b6fa8' : '#6a737c'}" stroke="#2f3640" stroke-width="2"/><ellipse cx="0" cy="-166" rx="15" ry="4" fill="${lamps ? '#f3d9ff' : '#9aa3ab'}" stroke="#2f3640" stroke-width="1.5"/></g>`;
  const pot = `<ellipse cx="0" cy="26" rx="30" ry="10" fill="rgba(0,0,0,.2)"/>`
    + `<ellipse cx="0" cy="0" rx="19" ry="7" fill="#4a3220"/>`
    + tree
    + `<path d="M-19 0 Q0 11 19 0 L14 24 Q0 31 -14 24Z" fill="#c4704a" stroke="#7a3d22" stroke-width="2"/><path d="M-16 8 Q0 17 16 8" stroke="#a85a37" stroke-width="3" fill="none"/>`
    + `<path d="M-21 -1 Q0 12 21 -1" stroke="#d98660" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return `<g class="fs-hit" data-act="laPot" data-i="${t.slot}" aria-label="Кадка ${t.slot + 1}"><g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})">${lamp}${pot}</g></g>` + info;
}
function laBuyPot(slot, cost, coins) {
  const [x, y] = LA_POTS[slot], sx = faX(x, y), sy = faY(x, y);
  return `<g class="fs-hit fs-buy" data-act="laUpgrades" aria-label="Новая кадка"><g transform="translate(${sx.toFixed(1)} ${sy.toFixed(1)})"><ellipse cy="10" rx="26" ry="10" fill="rgba(255,255,255,.1)" stroke="#9fd8e8" stroke-width="2.5" stroke-dasharray="7 5"/>`
    + `<text y="8" text-anchor="middle" font-size="24" font-weight="900" fill="#e6f8ff" stroke="rgba(0,0,0,.35)" stroke-width="1">＋</text><text y="26" text-anchor="middle" font-size="12" font-weight="800" fill="${coins >= cost ? '#e6f8ff' : '#ffb3b3'}" stroke="rgba(0,0,0,.4)" stroke-width=".5">💰 ${cost}</text></g></g>`;
}

/* ---------------- стены ---------------- */
function laWalls() {
  const N = LA.N, W = LA.WALL, T = 26;
  let g = '';
  // плита-основание
  g += faPoly([[0, N, 0], [N, N, 0], [N, N, -T], [0, N, -T]], '#4b5560') + faPoly([[N, 0, 0], [N, N, 0], [N, N, -T], [N, 0, -T]], '#39424b');
  // пол — плитка в шахматку
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) g += faPoly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], (i + j) % 2 ? '#c9d5da' : '#dce5e8', 'stroke="#aebcc3" stroke-width="1"');
  // правая стена (y=0) и левая (x=0)
  g += faPoly([[0, 0, 0], [N, 0, 0], [N, 0, W], [0, 0, W]], '#e2efe9') + faPoly([[0, 0, 0], [0, N, 0], [0, N, W], [0, 0, W]], '#c6dad2');
  // цоколь из плитки до 64 по высоте, потолочная балка
  g += faPoly([[0, 0, 0], [N, 0, 0], [N, 0, 64], [0, 0, 64]], '#f4f8f6') + faPoly([[0, 0, 0], [0, N, 0], [0, N, 64], [0, 0, 64]], '#dbe8e2');
  for (let i = 1; i < N; i++) g += faLine([i, 0, 0], [i, 0, 64], '#c6d6ce', 1.5) + faLine([0, i, 0], [0, i, 64], '#b4c6bd', 1.5);
  g += faLine([0, 0, 32], [N, 0, 32], '#c6d6ce', 1.5) + faLine([0, 0, 32], [0, N, 32], '#b4c6bd', 1.5);
  g += faLine([0, 0, 64], [N, 0, 64], '#8aa39a', 3.5) + faLine([0, 0, 64], [0, N, 64], '#7d968d', 3.5);
  g += faPoly([[0, 0, W - 16], [N, 0, W - 16], [N, 0, W], [0, 0, W]], '#7f9a90') + faPoly([[0, 0, W - 16], [0, N, W - 16], [0, N, W], [0, 0, W]], '#6c857b');
  g += faLine([0, 0, 0], [0, 0, W], '#9bb3aa', 4);
  // плинтус
  g += faLine([0, 0, 3], [N, 0, 3], '#90a59d', 5) + faLine([0, 0, 3], [0, N, 3], '#7e938b', 5);
  return g;
}
const LA_LAB_TXT = (t, x, y, sz = 11, col = '#2a4a6a') => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="800" fill="${col}" font-family="ui-monospace,Consolas,monospace">${t}</text>`;

/** Доска с формулами (журнал коллекции). Правая стена, x от 2.1. */
function laBoard(st) {
  const found = Object.values(st.tiers).reduce((a, t) => a + t.found, 0), total = Object.values(st.tiers).reduce((a, t) => a + t.total, 0);
  const inner = `<rect x="0" y="0" width="170" height="86" rx="4" fill="#fbfdfc" stroke="#8a6a44" stroke-width="5"/><rect x="6" y="64" width="158" height="3" fill="#e1e8e6"/>`
    + LA_LAB_TXT('C₁₀H₁₆ + 4 O₂ → ?', 10, 17) + LA_LAB_TXT('Picea · Abies', 92, 38, 10, '#3a7a52')
    + `<path d="M12 70 Q28 40 44 54 T76 46 T108 54" stroke="#d94f3d" stroke-width="2.4" fill="none"/><circle cx="108" cy="54" r="3" fill="#d94f3d"/>`
    + `<path d="M120 40 q8 -8 16 0 t16 0" stroke="#2f7fc4" stroke-width="2" fill="none"/><path d="M120 50 q8 8 16 0 t16 0" stroke="#2f7fc4" stroke-width="2" fill="none"/>${[0, 1, 2, 3].map(i => `<path d="M${124 + i * 8} 41 v8" stroke="#8aa0b8" stroke-width="1.2"/>`).join('')}`
    + `<g transform="translate(10 26)"><rect width="76" height="14" rx="3" fill="#ffe9a8" stroke="#b58a1c" stroke-width="1.2"/>${LA_LAB_TXT('вид ' + found + ' из ' + total, 5, 10.5, 9.5, '#5a3d00')}</g>`
    + `<rect x="26" y="90" width="118" height="4" fill="#8a6a44"/><rect x="40" y="94" width="14" height="5" rx="1" fill="#e04b4b"/><rect x="60" y="94" width="14" height="5" rx="1" fill="#2f7fc4"/>`;
  return laPlane('R', 2.1, 168, inner, 'class="fs-hit" data-act="laJournal" aria-label="Журнал видов"');
}
/** Дверь-выход наверх (на ферму). */
function laDoor() {
  const inner = `<rect x="-4" y="-4" width="66" height="114" rx="3" fill="#5f4a36"/><rect x="0" y="0" width="58" height="110" fill="url(#laLight)"/>`
    + `<path d="M6 104 L52 104 M6 92 L52 92" stroke="rgba(120,90,40,.35)" stroke-width="2"/><path d="M29 20 l12 14 h-8 v26 h-8 v-26 h-8z" fill="#fff" opacity=".85"/>`
    + `<g transform="translate(29 -16)"><rect x="-34" y="-9" width="68" height="16" rx="8" fill="#2f4a40"/><text y="3.5" text-anchor="middle" font-size="9.5" font-weight="900" fill="#e8fff4">НА ФЕРМУ</text></g>`;
  return laPlane('R', 6.4, 110, inner, 'class="fs-hit" data-act="laExit" aria-label="На ферму"')
    + [0, 1, 2].map(i => faBox(6.35 + i * .05, .02 + i * .22, 1.2 - i * .1, .2, 15 - i * 5, '#c9b99a')).join('');
}
/** Левая стена: стеллаж с банками шишек. */
function laShelf(st) {
  const inv = st.cones, W = 3.7 * 48, seen = st.species.filter(x => x.discovered);
  let inner = [58, 104].map(z => `<rect x="0" y="${-z + 4}" width="${W}" height="6" fill="#9c7a52" stroke="#6b4e2e" stroke-width="1.5"/>`).join('');
  seen.forEach((sp, i) => {
    const q = inv[sp.id] || 0, c = laConeCol(sp.id), z = i < 6 ? 58 : 104, cx = 8 + (i % 6) * 28, n = q ? Math.max(1, Math.min(4, Math.round(q / 3))) : 0;
    inner += `<g transform="translate(${cx} ${-z + 4})"><rect x="0" y="-36" width="22" height="36" rx="5" fill="rgba(220,245,255,${q ? .55 : .28})" stroke="#7aa0b0" stroke-width="1.6"/><rect x="3" y="-40" width="16" height="5" rx="2" fill="#8a6a44"/>`
      + Array.from({ length: n }, (_, k) => `<g transform="translate(${6 + (k % 2) * 10} ${-6 - k * 7}) rotate(${(k * 37) % 50 - 25})">${laCone(c, .8)}</g>`).join('')
      + (q ? `<text x="11" y="-44" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" stroke="#000" stroke-width="2.4" paint-order="stroke">${q}</text>` : '') + `</g>`;
  });
  if (!seen.length) inner += `<text x="${W / 2}" y="-66" text-anchor="middle" font-size="12" fill="#6b4e2e" font-weight="800" opacity=".7">банки пусты</text>`;
  return laPlane('L', 4.1, 0, inner, 'class="fs-hit" data-act="laShelf" aria-label="Шишки"');
}
/** Левая стена: климат-блок. */
function laClimate(st) {
  const lv = laUp(st, 'climate'), on = lv > 0;
  const inner = `<rect x="0" y="0" width="104" height="52" rx="5" fill="#e9eef0" stroke="#7b8a92" stroke-width="2.5"/>`
    + `<g transform="translate(26 26)"><circle r="19" fill="#cfd8dc" stroke="#7b8a92" stroke-width="1.5"/><g class="${on ? 'fs-spin la-fan' : ''}">${[0, 90, 180, 270].map(a => `<path transform="rotate(${a})" d="M0 0 Q6 -16 13 -10 Q8 -4 0 0Z" fill="#8fa3ad"/>`).join('')}</g><circle r="3" fill="#586872"/></g>`
    + `<rect x="54" y="8" width="42" height="18" rx="3" fill="#10242c"/>` + `<text x="75" y="21" text-anchor="middle" font-size="12" font-weight="900" fill="${on ? '#58f0a8' : '#40565e'}" font-family="ui-monospace,Consolas,monospace">${on ? '21.5°' : '-- °'}</text>`
    + `<circle cx="62" cy="39" r="3.2" fill="${on ? '#3ddc84' : '#6c7a80'}"/><rect x="72" y="36" width="22" height="6" rx="2" fill="#b4c1c7"/>`;
  return laPlane('L', 7.4, 100, inner, 'class="fs-hit" data-act="laUpgrades" aria-label="Климат"');
}

/* ---------------- пол: стол с микроскопом, шкаф, ящик ---------------- */
function laBench(st) {
  const x = .3, y = 5.3, w = 1.5, d = 2.3, h = 36, aff = st.upgrades.some(u => u.cost != null && u.cost <= st.coins);
  const top = (a, b, z = h) => [x + w * a, y + d * b, z];
  const tubes = [['#e04b4b', 0], ['#3a8bd9', 1], ['#58c46a', 2], ['#f0c53c', 3]].map(([c, i]) => {
    const p = top(.62, .18 + i * .17), px = faX(p[0], p[1]), py = faY(...p);
    return `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><rect x="-3" y="-20" width="6" height="20" rx="3" fill="rgba(230,248,255,.8)" stroke="#6f8e9b" stroke-width="1"/><rect x="-2.2" y="-12" width="4.4" height="11.5" rx="2.2" fill="${c}"/></g>`;
  }).join('');
  const m = top(.35, .55), mx = faX(m[0], m[1]), my = faY(...m);
  const micro = `<g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><ellipse cx="0" cy="0" rx="14" ry="5" fill="#2f3b44"/><path d="M-4 -2 Q16 -6 12 -26 Q10 -34 2 -36" stroke="#2f3b44" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + `<g transform="rotate(-24 0 -36)"><rect x="-5" y="-62" width="10" height="28" rx="3" fill="#cfd8dc" stroke="#2f3b44" stroke-width="2"/><rect x="-3" y="-69" width="6" height="8" rx="2" fill="#2f3b44"/><rect x="-2.5" y="-30" width="5" height="7" fill="#7b8a92"/></g><rect x="-9" y="-4" width="18" height="3" rx="1" fill="#8fa3ad"/></g>`;
  const badge = aff ? `<g transform="translate(${faX(x + w * .5, y + d * .5).toFixed(1)} ${faY(x + w * .5, y + d * .5, h + 96).toFixed(1)})"><g class="fs-bob"><circle r="12" fill="#2fbf6a" stroke="#fff" stroke-width="2.5"/><text y="5.5" text-anchor="middle" font-size="15" font-weight="900" fill="#fff">↑</text></g></g>` : '';
  return `<g class="fs-hit" data-act="laUpgrades" aria-label="Селекционный стол">` + faBox(x, y, w, d, h, '#dfe7ea')
    + faPoly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], '#6f8e9b', 'stroke="#4d6772" stroke-width="2"')
    + faPoly([[x + w * .12, y + d + 0, 0], [x + w * .88, y + d, 0], [x + w * .88, y + d, h * .8], [x + w * .12, y + d, h * .8]], '#c3ced3', 'stroke="#8fa3ad" stroke-width="1.5"')
    + tubes + micro + `</g>` + badge;
}
function laPlant() {
  const x = 7.4, y = 7.1, cx = faX(x, y), cy = faY(x, y);
  return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><ellipse cy="3" rx="13" ry="5" fill="rgba(0,0,0,.18)"/><path d="M-9 -16 L9 -16 L6 2 L-6 2Z" fill="#e8e0d0" stroke="#9a8f78" stroke-width="1.5"/>`
    + [[-14, -34, -20], [0, -44, 0], [14, -34, 20], [-8, -26, -35], [9, -26, 35]].map(([a, b, r]) => `<path transform="rotate(${r} 0 -16)" d="M0 -16 Q${a} ${b - 6} ${a * .6} ${b - 14} Q${a * .1} ${b} 0 -16Z" fill="#3f9a4a" stroke="#2c7a38" stroke-width="1"/>`).join('') + `</g>`;
}
function laPipes(st) {
  const drip = laUp(st, 'drip');
  if (!drip) return '';
  let g = faLine([.2, .05, 178], [LA.N - .2, .05, 178], '#4d8fb3', 5 + drip);
  g += st.trees.map(t => { const [x, y] = LA_POTS[t.slot]; return faLine([x, .05, 178], [x, y, 66], '#6fb8e0', 2) + faLine([x, .05, 178], [x, y, 66], '#d6f1ff', 1.6).replace('<line ', '<line class="la-flow" '); }).join('');
  return g;
}

/* ---------------- сцена целиком ---------------- */
function labScene(st) {
  let g = `<defs><radialGradient id="laBg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#27384a"/><stop offset="1" stop-color="#0f1620"/></radialGradient>`
    + `<linearGradient id="laBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d8ff" stop-opacity=".95"/><stop offset="1" stop-color="#d9a8ff" stop-opacity=".05"/></linearGradient>`
    + `<linearGradient id="laLight" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#fffbe6"/></linearGradient></defs>`;
  g += `<rect x="-200" y="-400" width="1600" height="1200" fill="url(#laBg)"/>`;
  g += laWalls() + laPipes(st);
  g += laBoard(st) + laDoor() + laShelf(st) + laClimate(st);
  const objs = [], add = (d, svg) => objs.push({ d, svg });
  add(0.3 + 5.3 + 1, laBench(st));
  add(7.4 + 7.1, laPlant());
  st.trees.forEach(t => add(LA_POTS[t.slot][0] + LA_POTS[t.slot][1], laPot(t, st)));
  if (st.pots < st.max_pots) { const c = st.upgrades.find(u => u.key === 'pots').cost; if (c != null) add(LA_POTS[st.pots][0] + LA_POTS[st.pots][1], laBuyPot(st.pots, c, st.coins)); }
  g += objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
  return g;
}
