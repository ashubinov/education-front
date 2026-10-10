/* LearnQuest — графика питомцев: 8 животных (5 пород собак из слотов, петух, кучерявый баран, бобр), 3 стадии роста и настроение.
   Рисуется кодом из простых форм: petSvg(species, stage 0..2, mood). Размеры тела и головы зависят от стадии:
   малыш — большая голова на маленьком тельце, взрослый — пропорции крупнее. */
'use strict';

const PET_INK = '#3b2a26';
const _pe = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="${PET_INK}" stroke-width="2.6" ${extra}/>`;
const _pp = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${PET_INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const _pf = (cx, cy, rx, ry, fill, o = 1) => `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" opacity="${o}"/>`;

/** Лицо: глаза, румянец, рот и грусть по настроению. nose — функция, рисующая нос вида. */
function petFace(hx, hy, hr, mood, opt = {}) {
  const ex = hr * .38, ey = hy - hr * .02, er = hr * .105 * (opt.eye || 1), my = hy + hr * (opt.mouthY || .42), mw = hr * .2;
  let eyes = '', mouth = '', extra = '';
  const eye = x => `<ellipse cx="${(x).toFixed(1)}" cy="${ey.toFixed(1)}" rx="${er.toFixed(1)}" ry="${(er * 1.3).toFixed(1)}" fill="${PET_INK}"/><circle cx="${(x - er * .35).toFixed(1)}" cy="${(ey - er * .5).toFixed(1)}" r="${(er * .38).toFixed(1)}" fill="#fff"/>`;
  const droop = x => `<path d="M${(x - er * 1.2).toFixed(1)} ${ey.toFixed(1)} Q${x.toFixed(1)} ${(ey + er * 1.5).toFixed(1)} ${(x + er * 1.2).toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${PET_INK}" stroke-width="2.8" stroke-linecap="round"/>`;
  if (mood === 'starving') {
    eyes = droop(hx - ex) + droop(hx + ex);
    mouth = `<path d="M${(hx - mw).toFixed(1)} ${(my + 5).toFixed(1)} Q${hx} ${(my - 7).toFixed(1)} ${(hx + mw).toFixed(1)} ${(my + 5).toFixed(1)}" fill="none" stroke="${PET_INK}" stroke-width="2.8" stroke-linecap="round"/>`;
    extra = `<path d="M${(hx - ex - er * 1.4).toFixed(1)} ${(ey + er * 1.4).toFixed(1)} q-3 8 0 11 q4 -3 0 -11z" fill="#6ec8ff" stroke="#2d7fb5" stroke-width="1.2"/>`;
  } else if (mood === 'hungry') {
    eyes = eye(hx - ex) + eye(hx + ex)
      + `<path d="M${(hx - ex - er * 1.4).toFixed(1)} ${(ey - er * 2.4).toFixed(1)} L${(hx - ex + er * 1.2).toFixed(1)} ${(ey - er * 1.9).toFixed(1)} M${(hx + ex + er * 1.4).toFixed(1)} ${(ey - er * 2.4).toFixed(1)} L${(hx + ex - er * 1.2).toFixed(1)} ${(ey - er * 1.9).toFixed(1)}" stroke="${PET_INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    mouth = `<path d="M${(hx - mw * .8).toFixed(1)} ${(my + 3).toFixed(1)} Q${hx} ${(my - 3).toFixed(1)} ${(hx + mw * .8).toFixed(1)} ${(my + 3).toFixed(1)}" fill="none" stroke="${PET_INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    extra = `<path d="M${(hx + hr * .78).toFixed(1)} ${(hy - hr * .45).toFixed(1)} q-4 9 0 12 q5 -3 0 -12z" fill="#8fd6ff" stroke="#2d7fb5" stroke-width="1.2"/>`;
  } else {
    eyes = eye(hx - ex) + eye(hx + ex);
    const happy = mood === 'happy', w = happy ? mw * 1.15 : mw * .85, dip = happy ? hr * .2 : hr * .1;
    mouth = `<path d="M${(hx - w).toFixed(1)} ${(my - 2).toFixed(1)} Q${hx} ${(my + dip).toFixed(1)} ${(hx + w).toFixed(1)} ${(my - 2).toFixed(1)}" fill="none" stroke="${PET_INK}" stroke-width="2.8" stroke-linecap="round"/>`;
    if (happy) extra = _pf(hx - hr * .66, hy + hr * .24, hr * .13, hr * .09, '#ff7f9a', .5) + _pf(hx + hr * .66, hy + hr * .24, hr * .13, hr * .09, '#ff7f9a', .5);
  }
  return `<g class="pet-face">${extra}<g class="pet-eyes">${eyes}</g>${mouth}</g>`;
}

const PET_ART = {
  corgi(B, H, mood) {
    const c = '#f0a244', w = '#fff3df', pink = '#f7b8a4';
    const back = _pe(B.cx + B.rx - 2, B.cy - B.ry * .35, 10, 8, c);
    const body = _pe(B.cx, B.cy, B.rx, B.ry, c) + _pf(B.cx, B.cy + B.ry * .25, B.rx * .6, B.ry * .66, w)
      + _pe(B.cx - B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, w) + _pe(B.cx + B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, w);
    const ears = [-1, 1].map(s => _pp(`M${H.cx + s * H.r * .88} ${H.cy - H.r * .1} L${H.cx + s * H.r * .78} ${H.cy - H.r * 1.3} L${H.cx + s * H.r * .12} ${H.cy - H.r * .86} Z`, c)
      + _pp(`M${H.cx + s * H.r * .72} ${H.cy - H.r * .35} L${H.cx + s * H.r * .68} ${H.cy - H.r * 1.0} L${H.cx + s * H.r * .32} ${H.cy - H.r * .78} Z`, pink)).join('');
    const head = _pe(H.cx, H.cy, H.r, H.r * .94, c) + _pf(H.cx, H.cy + H.r * .3, H.r * .56, H.r * .6, w)
      + _pf(H.cx, H.cy - H.r * .35, H.r * .14, H.r * .4, w);
    const nose = _pe(H.cx, H.cy + H.r * .22, H.r * .15, H.r * .1, PET_INK, 'stroke-width="1"');
    const tongue = mood === 'happy' ? `<path d="M${H.cx - 6} ${H.cy + H.r * .5} q6 14 12 0z" fill="#ff7b8f" stroke="${PET_INK}" stroke-width="1.6"/>` : '';
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood) + tongue };
  },
  doberman(B, H, mood) {
    const c = '#4b4c5e', tan = '#c9783a', inner = '#7a4a3a';
    const back = _pp(`M${B.cx + B.rx - 4} ${B.cy - B.ry * .2} Q${B.cx + B.rx + 22} ${B.cy - B.ry * .9} ${B.cx + B.rx + 12} ${B.cy - B.ry * 1.1}`, 'none', 'stroke-width="9"');
    const body = _pe(B.cx, B.cy, B.rx, B.ry, c) + _pf(B.cx, B.cy + B.ry * .3, B.rx * .5, B.ry * .6, tan, .95)
      + _pe(B.cx - B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, tan) + _pe(B.cx + B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, tan);
    const ears = [-1, 1].map(s => _pp(`M${H.cx + s * H.r * .5} ${H.cy - H.r * .55} L${H.cx + s * H.r * .66} ${H.cy - H.r * 1.55} L${H.cx + s * H.r * .12} ${H.cy - H.r * .82} Z`, c)
      + _pp(`M${H.cx + s * H.r * .48} ${H.cy - H.r * .7} L${H.cx + s * H.r * .6} ${H.cy - H.r * 1.3} L${H.cx + s * H.r * .24} ${H.cy - H.r * .8} Z`, inner, 'stroke="none"')).join('');
    const head = _pe(H.cx, H.cy, H.r * .95, H.r * .94, c) + _pf(H.cx, H.cy + H.r * .42, H.r * .52, H.r * .42, tan)
      + [-1, 1].map(s => _pf(H.cx + s * H.r * .38, H.cy - H.r * .02, H.r * .2, H.r * .22, tan, .95)).join('');
    const nose = _pe(H.cx, H.cy + H.r * .26, H.r * .16, H.r * .1, PET_INK, 'stroke-width="1"');
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood, { mouthY: .5 }) };
  },
  bulldog(B, H, mood) {
    const c = '#d9ad7c', w = '#fbf1e2', dark = '#a8734a';
    const back = _pe(B.cx + B.rx - 2, B.cy - B.ry * .1, 7, 7, c);
    const body = _pe(B.cx, B.cy, B.rx * 1.08, B.ry, c) + _pf(B.cx, B.cy + B.ry * .3, B.rx * .6, B.ry * .62, w)
      + _pe(B.cx - B.rx * .56, B.cy + B.ry - 3, B.rx * .32, 8, w) + _pe(B.cx + B.rx * .56, B.cy + B.ry - 3, B.rx * .32, 8, w);
    const ears = [-1, 1].map(s => _pp(`M${H.cx + s * H.r * .95} ${H.cy - H.r * .5} Q${H.cx + s * H.r * 1.05} ${H.cy - H.r * 1.05} ${H.cx + s * H.r * .45} ${H.cy - H.r * .85} Z`, dark)).join('');
    const head = _pe(H.cx, H.cy + H.r * .04, H.r * 1.1, H.r * .9, c) + _pf(H.cx, H.cy - H.r * .3, H.r * .12, H.r * .5, w, .9)
      + _pf(H.cx, H.cy + H.r * .48, H.r * .66, H.r * .4, w)
      + `<path d="M${H.cx - H.r * .3} ${H.cy - H.r * .62} q${H.r * .3} -${H.r * .12} ${H.r * .6} 0 M${H.cx - H.r * .22} ${H.cy - H.r * .46} q${H.r * .22} -${H.r * .1} ${H.r * .44} 0" fill="none" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`;
    const nose = _pe(H.cx, H.cy + H.r * .22, H.r * .24, H.r * .12, PET_INK, 'stroke-width="1"');
    const teeth = `<path d="M${H.cx - H.r * .36} ${H.cy + H.r * .56} l${H.r * .08} -${H.r * .2} l${H.r * .1} ${H.r * .2}z M${H.cx + H.r * .36} ${H.cy + H.r * .56} l-${H.r * .08} -${H.r * .2} l-${H.r * .1} ${H.r * .2}z" fill="#fff" stroke="${PET_INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood, { mouthY: .56 }) + teeth };
  },
  pug(B, H, mood) {
    const c = '#e8c79b', mask = '#6a5548', dark = '#4a3b34';
    const back = `<path d="M${B.cx + B.rx - 4} ${B.cy - B.ry * .3} q18 -6 14 -18 q-6 -10 -16 -2 q-4 8 6 8" fill="none" stroke="${PET_INK}" stroke-width="10" stroke-linecap="round"/><path d="M${B.cx + B.rx - 4} ${B.cy - B.ry * .3} q18 -6 14 -18 q-6 -10 -16 -2 q-4 8 6 8" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
    const body = _pe(B.cx, B.cy, B.rx * 1.04, B.ry, c) + _pf(B.cx, B.cy + B.ry * .3, B.rx * .55, B.ry * .6, '#f6e3c4')
      + _pe(B.cx - B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, c) + _pe(B.cx + B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, c);
    const ears = [-1, 1].map(s => _pp(`M${H.cx + s * H.r * .9} ${H.cy - H.r * .55} Q${H.cx + s * H.r * 1.12} ${H.cy + H.r * .15} ${H.cx + s * H.r * .66} ${H.cy + H.r * .18} Q${H.cx + s * H.r * .5} ${H.cy - H.r * .3} ${H.cx + s * H.r * .5} ${H.cy - H.r * .78}Z`, dark)).join('');
    const head = _pe(H.cx, H.cy, H.r * 1.02, H.r * .92, c) + _pe(H.cx, H.cy + H.r * .36, H.r * .55, H.r * .44, mask, 'stroke-width="0"')
      + `<path d="M${H.cx - H.r * .28} ${H.cy - H.r * .7} q${H.r * .28} -${H.r * .12} ${H.r * .56} 0 M${H.cx - H.r * .2} ${H.cy - H.r * .54} q${H.r * .2} -${H.r * .1} ${H.r * .4} 0" fill="none" stroke="#b98d5e" stroke-width="2.4" stroke-linecap="round"/>`;
    const nose = _pe(H.cx, H.cy + H.r * .22, H.r * .15, H.r * .1, PET_INK, 'stroke-width="1"');
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood, { mouthY: .5, eye: 1.2 }) };
  },
  chihuahua(B, H, mood) {
    const c = '#e6c39a', w = '#fff3df', pink = '#f5b3b3';
    const back = `<path d="M${B.cx + B.rx - 4} ${B.cy - B.ry * .1} Q${B.cx + B.rx + 26} ${B.cy - B.ry * .2} ${B.cx + B.rx + 16} ${B.cy - B.ry * 1.1}" fill="none" stroke="${PET_INK}" stroke-width="9" stroke-linecap="round"/><path d="M${B.cx + B.rx - 4} ${B.cy - B.ry * .1} Q${B.cx + B.rx + 26} ${B.cy - B.ry * .2} ${B.cx + B.rx + 16} ${B.cy - B.ry * 1.1}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    const body = _pe(B.cx, B.cy, B.rx * .9, B.ry * .96, c) + _pf(B.cx, B.cy + B.ry * .3, B.rx * .5, B.ry * .6, w)
      + _pe(B.cx - B.rx * .45, B.cy + B.ry * .96 - 3, B.rx * .26, 8, c) + _pe(B.cx + B.rx * .45, B.cy + B.ry * .96 - 3, B.rx * .26, 8, c);
    const ears = [-1, 1].map(s => _pp(`M${H.cx + s * H.r * .55} ${H.cy - H.r * .55} L${H.cx + s * H.r * 1.5} ${H.cy - H.r * 1.2} L${H.cx + s * H.r * 1.1} ${H.cy + H.r * .1} Z`, c)
      + _pp(`M${H.cx + s * H.r * .7} ${H.cy - H.r * .5} L${H.cx + s * H.r * 1.3} ${H.cy - H.r * .98} L${H.cx + s * H.r * 1.02} ${H.cy - H.r * .08} Z`, pink, 'stroke="none"')).join('');
    const head = _pe(H.cx, H.cy, H.r * .98, H.r * .92, c) + _pf(H.cx, H.cy + H.r * .36, H.r * .46, H.r * .4, w);
    const nose = _pe(H.cx, H.cy + H.r * .22, H.r * .12, H.r * .085, PET_INK, 'stroke-width="1"');
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood, { mouthY: .46, eye: 1.3 }) };
  },
  rooster(B, H, mood) {
    const c = '#c8582b', belly = '#f0b24a', red = '#e0392f';
    const back = [['#2f9a6b', -62], ['#2a7fb0', -40], ['#e9822b', -18]].map(([col, a]) => `<g transform="rotate(${a} ${B.cx + B.rx * .6} ${B.cy})">${_pe(B.cx + B.rx * .6 + B.rx * .55, B.cy, B.rx * .62, B.ry * .3, col)}</g>`).join('');
    const body = _pe(B.cx, B.cy, B.rx, B.ry, c) + _pf(B.cx - B.rx * .1, B.cy + B.ry * .3, B.rx * .6, B.ry * .6, belly)
      + `<g transform="rotate(-18 ${B.cx + B.rx * .5} ${B.cy})">${_pe(B.cx + B.rx * .45, B.cy, B.rx * .42, B.ry * .5, '#a8421f')}<path d="M${B.cx + B.rx * .2} ${B.cy} h${B.rx * .5} M${B.cx + B.rx * .25} ${B.cy + B.ry * .2} h${B.rx * .4}" stroke="${PET_INK}" stroke-width="1.8" opacity=".4"/></g>`
      + `<path d="M${B.cx - B.rx * .3} ${B.cy + B.ry - 2} v10 M${B.cx + B.rx * .3} ${B.cy + B.ry - 2} v10" stroke="#e8a21c" stroke-width="4" stroke-linecap="round"/>`
      + _pe(B.cx - B.rx * .3, B.cy + B.ry + 10, 9, 3.5, '#e8a21c', 'stroke-width="2"') + _pe(B.cx + B.rx * .3, B.cy + B.ry + 10, 9, 3.5, '#e8a21c', 'stroke-width="2"');
    const comb = [[-.3, .2], [0, .27], [.3, .2]].map(([k, r]) => _pe(H.cx + k * H.r, H.cy - H.r * .92, H.r * r, H.r * r, red)).join('');
    const head = _pe(H.cx, H.cy, H.r * .92, H.r * .92, c) + _pf(H.cx, H.cy + H.r * .3, H.r * .55, H.r * .5, '#f6dcae');
    const beak = `<path d="M${H.cx - H.r * .2} ${H.cy + H.r * .16} L${H.cx + H.r * .2} ${H.cy + H.r * .16} L${H.cx} ${H.cy + H.r * .58} Z" fill="#f5b83a" stroke="${PET_INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const wattle = _pe(H.cx, H.cy + H.r * .72, H.r * .1, H.r * .16, red, 'stroke-width="2"');
    return { back, body, front: comb + head + wattle + petFace(H.cx, H.cy, H.r, mood, { mouthY: .62 }) + beak };
  },
  ram(B, H, mood) {
    const wool = '#f8f4ea', face = '#d9c2a3', horn = '#c9a05a', dark = '#5a4a42';
    const bumps = n => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return _pe(B.cx + Math.cos(a) * B.rx * .92, B.cy + Math.sin(a) * B.ry * .88, B.rx * .3, B.rx * .3, wool); }).join('');
    const back = '';
    const body = `<path d="M${B.cx - B.rx * .5} ${B.cy + B.ry - 4} v10 M${B.cx + B.rx * .5} ${B.cy + B.ry - 4} v10" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>` + bumps(10)
      + `<ellipse cx="${B.cx}" cy="${B.cy}" rx="${(B.rx * .95).toFixed(1)}" ry="${(B.ry * .92).toFixed(1)}" fill="${wool}"/>`;
    const hornPath = s => `M${H.cx + s * H.r * .62} ${H.cy - H.r * .45} C${H.cx + s * H.r * 1.55} ${H.cy - H.r * 1.0} ${H.cx + s * H.r * 1.85} ${H.cy + H.r * .6} ${H.cx + s * H.r * 1.05} ${H.cy + H.r * .55} C${H.cx + s * H.r * .75} ${H.cy + H.r * .5} ${H.cx + s * H.r * .85} ${H.cy + H.r * .08} ${H.cx + s * H.r * 1.05} ${H.cy + H.r * .18}`;
    const horns = [-1, 1].map(s => `<path d="${hornPath(s)}" fill="none" stroke="${PET_INK}" stroke-width="17" stroke-linecap="round"/><path d="${hornPath(s)}" fill="none" stroke="${horn}" stroke-width="11" stroke-linecap="round"/><path d="${hornPath(s)}" fill="none" stroke="#a37c3a" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>`).join('');
    const ears = [-1, 1].map(s => `<g transform="rotate(${s * 24} ${H.cx + s * H.r * .9} ${H.cy - H.r * .1})">${_pe(H.cx + s * H.r * 1.0, H.cy - H.r * .1, H.r * .3, H.r * .16, face)}</g>`).join('');
    const head = _pe(H.cx, H.cy + H.r * .05, H.r * .78, H.r * .86, face)
      + [-.4, -.14, .12, .38].map((k, i) => _pe(H.cx + k * H.r, H.cy - H.r * (.82 - (i === 1 || i === 2 ? .06 : 0)), H.r * .2, H.r * .2, wool)).join('');
    const nose = _pe(H.cx, H.cy + H.r * .34, H.r * .17, H.r * .1, '#e9a39a', 'stroke-width="1.6"');
    return { back, body: body, front: horns + ears + head + nose + petFace(H.cx, H.cy, H.r * .9, mood, { mouthY: .52 }) };
  },
  beaver(B, H, mood) {
    const c = '#8a5a36', belly = '#c99b6a', dark = '#5b3a26';
    const hatch = Array.from({ length: 4 }, (_, i) => `<path d="M${-14 + i * 9} -9 l-6 18" stroke="${PET_INK}" stroke-width="1.6" opacity=".35"/>`).join('');
    const back = `<g transform="translate(${B.cx + B.rx + 8} ${B.cy + B.ry * .5}) rotate(-14)">${_pe(14, 0, 30, 14, dark)}<g transform="translate(14 0)">${hatch}</g></g>`;
    const body = _pe(B.cx, B.cy, B.rx, B.ry, c) + _pf(B.cx, B.cy + B.ry * .3, B.rx * .55, B.ry * .62, belly)
      + _pe(B.cx - B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, dark) + _pe(B.cx + B.rx * .5, B.cy + B.ry - 3, B.rx * .3, 8, dark);
    const ears = [-1, 1].map(s => _pe(H.cx + s * H.r * .62, H.cy - H.r * .78, H.r * .2, H.r * .2, dark) + _pf(H.cx + s * H.r * .62, H.cy - H.r * .78, H.r * .1, H.r * .1, '#b98a72')).join('');
    const head = _pe(H.cx, H.cy, H.r, H.r * .92, c) + _pf(H.cx, H.cy + H.r * .36, H.r * .5, H.r * .4, '#d6ad7c');
    const nose = _pe(H.cx, H.cy + H.r * .2, H.r * .16, H.r * .1, PET_INK, 'stroke-width="1"');
    const teeth = `<rect x="${H.cx - H.r * .17}" y="${H.cy + H.r * .36}" width="${H.r * .34}" height="${H.r * .26}" rx="3" fill="#fffdf4" stroke="${PET_INK}" stroke-width="2"/><path d="M${H.cx} ${H.cy + H.r * .36} v${H.r * .26}" stroke="${PET_INK}" stroke-width="1.6"/>`;
    return { back, body, front: ears + head + nose + petFace(H.cx, H.cy, H.r, mood, { mouthY: .5 }) + teeth };
  },
};

/** Питомец целиком. stage — 0 малыш, 1 подросток, 2 взрослый. */
function petSvg(species, stage, mood) {
  const s = Math.min(2, Math.max(0, stage | 0)), draw = PET_ART[species] || PET_ART.corgi;
  const B = { cx: 100, cy: [150, 146, 142][s], rx: [32, 44, 54][s], ry: [26, 36, 46][s] }, H = { cx: 100, cy: [104, 96, 88][s], r: [50, 46, 42][s] };
  const p = draw(B, H, mood || 'happy');
  return `<svg class="pet-svg pet-${esc(species)} mood-${esc(mood || 'happy')}" viewBox="0 0 200 200" role="img" aria-label="${esc(species)}"><ellipse class="pet-shadow" cx="100" cy="${B.cy + B.ry + 6}" rx="${B.rx + 14}" ry="7" fill="#000" opacity=".22"/>
    <g class="pet-body">${p.back}${p.body}${p.front}</g></svg>`;
}
