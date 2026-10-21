/* LearnQuest — «Озеро»: рыбалка рядом с фермой (#/farm/lake). Закидываешь удочки на наживку со склада фермы, ждёшь клёва, собираешь улов,
   продаёшь рыбу за монеты фермы, пополняешь рыбный атлас и улучшаешь снасти. Всё считает сервер (/api/lake/*), клёв идёт и пока тебя нет.
   Здесь — только показ, таймеры и кнопки. Сцена — lake-art.js. */
'use strict';

const LAKE = { st: null, t0: 0, busy: false, reopen: null };
Object.assign(SFX, { lkSplash: () => tone([523, 392, 330], .05, 'sine', .05), lkDisc: () => tone([523, 659, 784, 1046, 1319], .08, 'triangle', .07) });

const lkTierName = t => ({ 1: 'Пруд', 2: 'Река', 3: 'Глубина', 4: 'Легенды' })[t];
const lkBait = id => LAKE.st.baits.find(b => b.id === id);
const lkInvTotal = () => LAKE.st.keep_used;

route(/^#\/farm\/lake$/, async () => { await drawLake(); });

async function drawLake() {
  render(app(), shell('farm', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  let r;
  try { r = await api('/lake'); } catch (e) { toast(e.message, { icon: '⚠️' }); location.hash = '#/farm'; return; }
  if (!r.unlocked) { toast(`К озеру пока не пройти: нужен уровень фермы ${r.need_level}`, { icon: '🔒' }); location.hash = '#/farm'; return; }
  lkSet(r); paintLake();
  every(lkTick, 1000);
}
function lkSet(r) { LAKE.st = r; LAKE.t0 = FARM.t0 = Date.now(); }
function paintLake() {
  const y = window.scrollY, old = $('#fmScroll'), sl = old ? old.scrollLeft : null;
  render(app(), shell('farm', lakePage(LAKE.st)));
  const sc = $('#fmScroll'); if (sc) sc.scrollLeft = sl != null ? sl : (sc.scrollWidth - sc.clientWidth) / 2;
  window.scrollTo(0, y);
}
function lkTick() { fmTickWith(() => { if (!LAKE.busy) api('/lake').then(r => { lkSet(r); paintLake(); }).catch(() => { }); }); }

function lakePage(s) {
  const ready = s.rods.filter(r => r.state === 'ready').length, n = lkInvTotal();
  const aff = s.upgrades.some(u => u.cost != null && u.cost <= s.coins);
  const found = Object.values(s.tiers).reduce((a, t) => a + t.found, 0), total = Object.values(s.tiers).reduce((a, t) => a + t.total, 0);
  return html`<div class="fm-page lk-page"><div class="fm-stage lk-stage">
    <div class="fm-hud">
      <div class="fm-pill" title="Озеро">🎣 <b>Озеро</b></div>
      <div class="fm-pill" title="Монеты фермы">💰 <b>${slFmt(s.coins)}</b></div>
      <div class="fm-pill ${n >= s.keep_cap ? 'full' : ''}" title="Садок">🐟 <b>${n}/${s.keep_cap}</b></div>
      <div class="fm-pill" title="Найдено видов">📖 <b>${found}/${total}</b></div>
    </div>
    <div class="fm-scroll" id="fmScroll"><svg class="fm-world lk-world" viewBox="0 -120 1120 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Озеро">${raw(lakeScene(s))}</svg></div>
    <div class="fm-dock">
      <button class="fm-db" data-act="lkCollectAll" ${ready ? '' : 'disabled'}><span>🎣</span>Поднять${ready ? html`<i class="fm-n">${ready}</i>` : ''}</button>
      <button class="fm-db" data-act="lkKeep"><span>🧺</span>Садок${n ? html`<i class="fm-n">${n}</i>` : ''}</button>
      <button class="fm-db" data-act="lkAtlas"><span>📖</span>Атлас</button>
      <button class="fm-db" data-act="lkUpgrades"><span>⚙️</span>Снасти${aff ? html`<i class="fm-n">↑</i>` : ''}</button>
      <button class="fm-db" data-act="lkExit"><span>🌾</span>На ферму</button>
    </div>
  </div><p class="muted small fm-tip">Нажимай на удочки, садок, лавку со снастями, лодку и атлас. Наживка берётся со склада фермы, а клёв идёт и без тебя.</p></div>`;
}

/* ---------- действия ---------- */
function lkShow(fn) { fn(); LAKE.reopen = fn; }
const lkPanelClose = () => { LAKE.reopen = null; };
function lkPanel(title, body) {
  openModal(html`<div class="fm-panel-h"><h2>${title}</h2><button class="btn ghost sm" data-act="closeModal" aria-label="Закрыть">✕</button></div>${body}`, { onClose: lkPanelClose });
}
async function lkDo(path, json, sfx, keep) {
  if (LAKE.busy) return null; LAKE.busy = true;
  try {
    const r = await api('/lake/' + path, { json: json || {} });
    lkSet(r); paintLake(); if (sfx) play(sfx);
    if (keep && LAKE.reopen) { const f = LAKE.reopen; f(); LAKE.reopen = f; } else closeModal();
    const got = {};
    for (const e of r.events || []) {
      if (e.type === 'catch') got[e.fish] = (got[e.fish] || 0) + e.qty;
      if (e.type === 'discover') { play('lkDisc'); confetti(e.legend ? 220 : 110); const f = lkFish(e.fish); toast(`${f.name}: первая поимка! Бонус 💰 ${slFmt(e.bonus)}`, { icon: f.icon, title: e.legend ? 'Легенда озера!' : 'Новый вид в атласе' }); }
      if (e.type === 'chest') toast(`Со дна поднят сундук: +💰 ${slFmt(e.coins)}`, { icon: '🧰', title: 'Сокровище!' });
      if (e.type === 'full') toast(`Садок полон: ещё ${e.left} уд. ждут. Продай рыбу или расширь садок`, { icon: '🧺' });
      if (e.type === 'tier') toast('Ступень атласа собрана целиком: рыба дороже навсегда', { icon: '🏆', title: 'Атлас' });
    }
    const list = Object.entries(got).map(([k, q]) => `${lkFish(k).icon} ${lkFish(k).name} ×${q}`);
    if (list.length) toast(list.join(', '), { icon: '🎣', title: 'Улов', ms: 2600 });
    LAKE.busy = false; return r;
  } catch (e) { toast(e.message, { icon: '⚠️' }); LAKE.busy = false; return null; }
}

actions.lkExit = () => { closeModal(); location.hash = '#/farm'; };
actions.lkCollectAll = () => lkDo('collect', {}, 'fmHarvest');
actions.lkCast = b => lkDo('cast', { rod: +b.dataset.rod, bait: b.dataset.bait }, 'lkSplash');
actions.lkUpgrade = b => lkDo('upgrade', { key: b.dataset.key }, 'fmCoin', true);
actions.lkSell = async b => { const r = await lkDo('sell', b.dataset.fish ? { fish: b.dataset.fish } : {}, 'fmCoin', true); if (r) toast(`+${slFmt(r.sold.coins)} монет за ${r.sold.qty} шт.`, { icon: '💰', ms: 1500 }); };

/* ---------- удочка ---------- */
actions.lkRod = b => {
  const i = +b.dataset.i, rod = LAKE.st.rods[i];
  if (!rod) return;
  if (rod.state === 'ready') return lkDo('collect', { rod: i }, 'fmHarvest');
  lkShow(() => {
    const s = LAKE.st, r = s.rods[i];
    if (!r) return;
    if (r.state === 'fishing') {
      const bait = lkBait(r.bait);
      return lkPanel(`🎣 Удочка ${i + 1}`, html`<p class="muted" style="margin:0 0 8px">Наживка: ${fmItemIcon(bait)} ${bait.name}. Клюнет через <b>${fmTimer(r.left)}</b></p>${fmBar(r.left, r.total)}
        <p class="muted small">Что поймается, станет ясно, когда поднимешь удочку.</p><div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
    }
    if (r.state === 'ready') return;
    lkPanel(`🎣 Удочка ${i + 1}: чем ловим?`, html`<p class="muted small" style="margin:0 0 6px">Наживка списывается со склада фермы. Чем дороже наживка, тем дольше клёв и тем ценнее рыба.</p>
      <div class="fm-seeds">${s.baits.map(b => lkBaitCard(b, i))}</div>
      <p class="muted small" style="margin:8px 0 0">Глубина (ступень 3) открывается лодкой, легенды — лодкой 2 и эхолотом.</p>
      <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
  });
};
const fmItemIcon = b => b.icon;
function lkBaitCard(b, rod) {
  const none = b.have < 1;
  return html`<button class="fm-seed lk-bait t${b.tier}" data-act="lkCast" data-rod="${rod}" data-bait="${b.id}" ${none ? 'disabled' : ''}>
    <span class="fm-seed-ic">${b.icon}</span><b>${b.name}</b><span class="small">⏱ ${fmClock(b.time)} · ${lkTierName(Math.min(b.tier, LAKE.st.boat >= 1 ? 3 : 2))}</span>
    <span class="small ${none ? 'no' : 'muted'}">${none ? 'нет на складе фермы' : 'на складе: ' + b.have}</span></button>`;
}

/* ---------- садок: рыба и продажа ---------- */
actions.lkKeep = () => lkShow(() => {
  const s = LAKE.st, ids = Object.keys(s.inv).filter(k => s.inv[k] > 0).sort((a, b) => lkFish(b).price - lkFish(a).price);
  if (!ids.length) return lkPanel('🧺 Садок', html`<p class="muted" style="margin:0">Пока пусто. Закинь удочку, дождись клёва и подними улов.</p><div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
  const total = ids.reduce((a, k) => a + s.inv[k] * lkFish(k).price, 0);
  lkPanel(`🧺 Садок · ${s.keep_used}/${s.keep_cap}`, html`<div class="la-sell">${ids.map(k => {
    const f = lkFish(k), q = s.inv[k], r = f.price / (f.base_price * (1 + s.bonus)), arrow = r >= 1.12 ? '↑' : r <= .93 ? '↓' : '';
    return html`<div class="la-sell-r"><span class="la-sell-ic">${f.icon}</span><div class="grow"><b>${f.name}</b><div class="small muted">×${q} · по <span class="${arrow === '↑' ? 'up' : arrow === '↓' ? 'down' : ''}">💰 ${slFmt(f.price)} ${arrow}</span></div></div>
      <button class="btn sm" data-act="lkSell" data-fish="${k}">Продать 💰 ${slFmt(f.price * q)}</button></div>`; })}</div>
    <div class="row mt" style="justify-content:space-between"><button class="btn" data-act="lkSell">Продать всё · 💰 ${slFmt(total)}</button><button class="btn ghost" data-act="closeModal">Закрыть</button></div>
    <p class="muted small" style="margin:8px 0 0">Цены меняются каждый день. Оценщик и собранные ступени атласа поднимают их ещё выше (сейчас +${Math.round(s.bonus * 100)}%).</p>`);
});

/* ---------- рыбный атлас ---------- */
actions.lkAtlas = () => lkShow(() => {
  const s = LAKE.st;
  lkPanel('📖 Рыбный атлас', html`<p class="muted small" style="margin:0 0 6px">Первая рыба нового вида даёт бонус открытия — втрое больше её цены. Собрал всю ступень — рыба дорожает навсегда.</p>
    ${[1, 2, 3, 4].map(k => { const t = s.tiers[k]; return html`<h3 class="la-h">${lkTierName(k)} <span class="muted small">${t.found}/${t.total}</span></h3><div class="la-grid">${s.fish.filter(x => x.tier === k).map(x => x.discovered
      ? html`<div class="la-j t${k}"><span class="la-j-ic">${x.icon}</span><b class="small">${x.name}</b><span class="small muted">💰 ${slFmt(x.price)}</span></div>`
      : html`<div class="la-j unk"><span class="la-j-ic">❔</span><b class="small">???</b><span class="small muted">${x.locked ? (k === 4 ? '🔒 лодка 2' : '🔒 лодка') : 'не поймана'}</span></div>`)}</div>`; })}
    <p class="muted small" style="margin:10px 0 0">Иногда на крючок попадает не рыба: жемчужина (💰 ${slFmt(s.fish.find(f => f.id === 'pearl').base_price)}), старый сапог, а то и сундук с монетами. Легендарная рыба ловится с лодкой 2 (сейчас шанс ${Math.round(s.legend_chance * 100)}% за заброс).</p>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
});

/* ---------- лавка снастей: улучшения ---------- */
actions.lkUpgrades = () => lkShow(() => {
  const s = LAKE.st;
  lkPanel('⚙️ Лавка снастей и лодка', html`<p class="muted small" style="margin:0 0 8px">Улучшения навсегда. У тебя 💰 <b>${slFmt(s.coins)}</b>.</p><div class="la-ups">${s.upgrades.map(u => html`<div class="la-up">
    <span class="la-up-ic">${u.icon}</span><div class="grow"><b>${u.name}</b><div class="small muted">${u.desc}</div>
      <div class="la-pips">${Array.from({ length: u.max }, (_, i) => html`<i class="${i < u.level ? 'on' : ''}"></i>`)}</div></div>
    ${u.cost == null ? html`<span class="small" style="color:var(--good);font-weight:800">Макс.</span>` : html`<button class="btn sm" data-act="lkUpgrade" data-key="${u.key}" ${s.coins >= u.cost ? '' : 'disabled'}>💰 ${slFmt(u.cost)}</button>`}</div>`)}</div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
});
