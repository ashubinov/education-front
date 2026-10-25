/* LearnQuest — «Карта мира» (#/farm/map): ферма в центре и вокруг неё локации (лаборатория, озеро, пасека, шахта, торговый тракт, аэропорт) с замками по уровню фермы
   и значками «что-то готово». Данные — /api/world, картинка рисуется кодом. */
'use strict';

const WD = { st: null };
/* положение острова на карте (в пикселях сцены 1000×620), цвета и подпись */
const WD_POS = {
  farm: { x: 500, y: 300, r: 150, c: ['#8ed05a', '#6fb040'], hint: 'грядки, животные, кухня' },
  lab: { x: 500, y: 530, r: 70, c: ['#9fb0c4', '#7e90a6'], hint: 'подвал: ели и шишки' },
  lake: { x: 150, y: 330, r: 110, c: ['#74c9ec', '#4fa8d0'], hint: 'рыбалка и атлас' },
  apiary: { x: 280, y: 105, r: 92, c: ['#b8e27a', '#92c850'], hint: 'ульи и мёд' },
  mine: { x: 735, y: 100, r: 100, c: ['#b4b6c4', '#8d8fa0'], hint: 'руда и самоцветы' },
  caravan: { x: 860, y: 365, r: 112, c: ['#e4c98f', '#c6a566'], hint: 'торговые повозки' },
  airport: { x: 215, y: 525, r: 62, c: ['#c9ced6', '#a4abb6'], hint: 'рейсы… иногда' },
};

route(/^#\/farm\/map$/, async () => { await drawWorld(); });
async function drawWorld() {
  render(app(), shell('farm', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  let r;
  try { r = await api('/world'); } catch (e) { toast(e.message, { icon: '⚠️' }); location.hash = '#/farm'; return; }
  WD.st = r;
  render(app(), shell('farm', worldPage(r)));
  every(async () => { try { WD.st = await api('/world'); const sc = $('#wdScroll'); if (sc) { const l = sc.scrollLeft; render(app(), shell('farm', worldPage(WD.st))); const n = $('#wdScroll'); if (n) n.scrollLeft = l; } } catch (e) { /* ignore */ } }, 15000);
}
function worldPage(s) {
  const open = s.locations.filter(l => l.unlocked).length;
  return html`<div class="fm-page wd-page"><div class="fm-stage wd-stage">
    <div class="fm-hud"><div class="fm-pill" title="Карта мира">🗺️ <b>Карта мира</b></div><div class="fm-pill" title="Уровень фермы">🚜 <b>Ур. ${s.farm_level}</b></div><div class="fm-pill" title="Открыто локаций">📍 <b>${open}/${s.locations.length}</b></div></div>
    <div class="fm-scroll" id="wdScroll"><svg class="fm-world wd-world" viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Карта мира">${raw(worldScene(s))}</svg></div>
    <div class="fm-dock"><button class="fm-db" data-act="worldBack"><span>🌾</span>На ферму</button></div>
  </div><p class="muted small fm-tip">Нажми на остров, чтобы отправиться туда. Новые места открываются с ростом уровня фермы, а значок над островом показывает, что там что-то готово.</p></div>`;
}
const wdBlob = (x, y, r, k = 1, seed = 1) => Array.from({ length: 36 }, (_, i) => { const a = i / 36 * Math.PI * 2, w = 1 + Math.sin(a * 3 + seed) * .07 + Math.cos(a * 5 + seed * 2) * .04; return `${(x + Math.cos(a) * r * 1.25 * k * w).toFixed(1)},${(y + Math.sin(a) * r * .8 * k * w).toFixed(1)}`; }).join(' ');

function worldScene(s) {
  let g = `<defs><radialGradient id="wdSea" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#6fc6ee"/><stop offset="1" stop-color="#2f86ad"/></radialGradient></defs><rect width="1000" height="620" fill="url(#wdSea)"/>`;
  [[90, 60], [930, 560], [60, 560], [940, 60]].forEach(([x, y], i) => { g += `<path d="M${x - 50} ${y} q25 -12 50 0 t50 0" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/><path d="M${x - 30} ${y + 14} q25 -12 50 0" stroke="rgba(255,255,255,.25)" stroke-width="3" fill="none" transform="translate(${i * 6} 0)"/>`; });
  const by = Object.fromEntries(s.locations.map(l => [l.id, l]));
  // тропы от фермы к островам
  Object.keys(WD_POS).filter(k => k !== 'farm').forEach(k => { const p = WD_POS[k], f = WD_POS.farm; g += `<path d="M${f.x} ${f.y} Q${(f.x + p.x) / 2 + (k === 'lab' ? 0 : 0)} ${(f.y + p.y) / 2 - 20} ${p.x} ${p.y}" stroke="${by[k].unlocked ? '#f3e2b3' : 'rgba(255,255,255,.35)'}" stroke-width="${by[k].unlocked ? 6 : 4}" stroke-dasharray="${by[k].unlocked ? '2 12' : '3 10'}" stroke-linecap="round" fill="none"/>`; });
  const order = ['lab', 'lake', 'apiary', 'mine', 'caravan', 'airport', 'farm'];
  order.forEach((id, i) => {
    const l = by[id], p = WD_POS[id], on = l.unlocked;
    g += `<g class="fs-hit wd-loc ${on ? '' : 'locked'}" data-act="worldGo" data-id="${id}" aria-label="${l.name}${on ? '' : ', закрыто'}">`
      + `<polygon points="${wdBlob(p.x, p.y + 10, p.r, 1.08, i + 1)}" fill="rgba(0,0,0,.18)"/><polygon points="${wdBlob(p.x, p.y, p.r, 1.1, i + 1)}" fill="#f1e4b6" stroke="#d6c288" stroke-width="3"/>`
      + `<polygon points="${wdBlob(p.x, p.y, p.r, 1, i + 1)}" fill="${p.c[0]}" stroke="${p.c[1]}" stroke-width="3"/>${wdDeco(id, p)}`
      + `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-size="${id === 'farm' ? 64 : 48}" ${on ? '' : 'opacity=".55"'}>${l.icon}</text>`
      + `<g transform="translate(${p.x} ${p.y + p.r * .72 + 22})"><rect x="-76" y="-15" width="152" height="40" rx="12" fill="${on ? '#2f4a40' : '#4a4f5a'}" stroke="#f8efe0" stroke-width="2"/><text y="2" text-anchor="middle" font-size="15" font-weight="900" fill="#fff">${l.name}</text>`
      + `<text y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${on ? '#bfe9d2' : '#ffd2a8'}">${on ? p.hint : '🔒 с ' + l.need_level + ' уровня фермы'}</text></g>`
      + (on && l.ready ? `<g transform="translate(${p.x + p.r * .62} ${p.y - p.r * .5})"><g class="fs-bob"><circle r="17" fill="#e63946" stroke="#fff" stroke-width="3"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">${l.ready}</text></g></g>` : '')
      + (!on ? `<g transform="translate(${p.x + p.r * .62} ${p.y - p.r * .5})"><circle r="17" fill="#3a3f4a" stroke="#fff" stroke-width="3"/><text y="6" text-anchor="middle" font-size="17">🔒</text></g>` : '') + `</g>`;
  });
  return g;
}
function wdDeco(id, p) {
  const t = (dx, dy, c = '#2f7d34') => `<path transform="translate(${p.x + dx} ${p.y + dy})" d="M0 0 L-9 16 H9Z M0 -12 L-8 6 H8Z" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>`;
  if (id === 'farm') return t(-100, -40) + t(110, -50) + t(-70, 60) + `<rect x="${p.x + 52}" y="${p.y - 66}" width="38" height="28" fill="#c8412f" stroke="#7a2418" stroke-width="2"/><path d="M${p.x + 48} ${p.y - 66} L${p.x + 71} ${p.y - 86} L${p.x + 94} ${p.y - 66}Z" fill="#7a5338"/>`;
  if (id === 'mine') return `<path d="M${p.x - 70} ${p.y + 30} L${p.x - 30} ${p.y - 58} L${p.x} ${p.y - 16} L${p.x + 34} ${p.y - 70} L${p.x + 80} ${p.y + 30}Z" fill="#8d8fa0" stroke="#5e6070" stroke-width="2"/><path d="M${p.x + 34} ${p.y - 70} l-10 18 h20z" fill="#fff"/>`;
  if (id === 'lake') return `<ellipse cx="${p.x}" cy="${p.y + 10}" rx="${p.r * .62}" ry="${p.r * .36}" fill="#b8ecff" stroke="#7fc7e3" stroke-width="3" opacity=".9"/>`;
  if (id === 'apiary') return [[-50, -20], [48, -26], [-34, 36], [40, 34], [0, -50]].map(([dx, dy], i) => `<circle cx="${p.x + dx}" cy="${p.y + dy}" r="6" fill="${['#ff6f91', '#ffd54a', '#b39cff', '#fff', '#ff9ec2'][i]}" stroke="rgba(0,0,0,.2)"/>`).join('');
  if (id === 'caravan') return `<path d="M${p.x - 100} ${p.y + 40} Q${p.x} ${p.y - 20} ${p.x + 100} ${p.y - 30}" stroke="#a98a54" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/>`;
  if (id === 'airport') return `<rect x="${p.x - 70}" y="${p.y + 14}" width="140" height="16" rx="3" fill="#4b505a"/><path d="M${p.x - 56} ${p.y + 22} H${p.x + 56}" stroke="#fff" stroke-width="2.5" stroke-dasharray="9 8"/>`;
  if (id === 'lab') return `<rect x="${p.x - 30}" y="${p.y + 22}" width="60" height="14" fill="#6b7a8c" opacity=".6"/>`;
  return '';
}
actions.worldBack = () => { location.hash = '#/farm'; };
actions.worldGo = b => {
  const l = WD.st.locations.find(x => x.id === b.dataset.id);
  if (!l) return;
  if (!l.unlocked) return toast(`«${l.name}» откроется на уровне фермы ${l.need_level} (сейчас ${WD.st.farm_level})`, { icon: '🔒', ms: 2600 });
  location.hash = l.route;
};
