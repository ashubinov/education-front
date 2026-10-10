/* LearnQuest — «Лаборатория»: подвал фермы (#/farm/lab). Здесь растят ели и пихты, собирают шишки и улучшают лабораторию.
   Всё считает сервер (/api/lab/*), время идёт и пока тебя нет. Здесь — только показ, таймеры и кнопки. Сцена — lab-art.js. */
'use strict';

const LAB = { st: null, t0: 0, busy: false, reopen: null };
Object.assign(SFX, { laDisc: () => tone([523, 659, 784, 1046, 1319], .08, 'triangle', .07) });

const labSp = id => LAB.st.species.find(x => x.id === id);
const labCones = () => Object.values(LAB.st.cones).reduce((a, b) => a + b, 0);

route(/^#\/farm\/lab$/, async () => { await drawLab(); });

async function drawLab() {
  render(app(), shell('farm', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  let r;
  try { r = await api('/lab'); } catch (e) { toast(e.message, { icon: '⚠️' }); location.hash = '#/farm'; return; }
  if (!r.unlocked) { toast(`Дверь заперта: нужен уровень фермы ${r.need_level}`, { icon: '🔒' }); location.hash = '#/farm'; return; }
  labSet(r); paintLab();
  every(labTick, 1000);
}
function labSet(r) { LAB.st = r; LAB.t0 = FARM.t0 = Date.now(); }
function paintLab() {
  const y = window.scrollY, old = $('#fmScroll'), sl = old ? old.scrollLeft : null;
  render(app(), shell('farm', labPage(LAB.st)));
  const sc = $('#fmScroll'); if (sc) sc.scrollLeft = sl != null ? sl : (sc.scrollWidth - sc.clientWidth) / 2;
  window.scrollTo(0, y);
}
function labTick() { fmTickWith(() => { if (!LAB.busy) api('/lab').then(r => { labSet(r); paintLab(); }).catch(() => { }); }); }

function labPage(s) {
  const ready = s.trees.reduce((a, t) => a + (t.state === 'mature' ? t.cones : 0), 0), n = labCones();
  const aff = s.upgrades.some(u => u.cost != null && u.cost <= s.coins);
  const found = Object.values(s.tiers).reduce((a, t) => a + t.found, 0), total = Object.values(s.tiers).reduce((a, t) => a + t.total, 0);
  return html`<div class="fm-page la-page"><div class="fm-stage la-stage">
    <div class="fm-hud">
      <div class="fm-pill" title="Подвал фермы">🔬 <b>Лаборатория</b></div>
      <div class="fm-pill" title="Монеты фермы">💰 <b>${slFmt(s.coins)}</b></div>
      <div class="fm-pill" title="Шишки в банках">🌰 <b>${n}</b></div>
      <div class="fm-pill" title="Найдено видов">📖 <b>${found}/${total}</b></div>
    </div>
    <div class="fm-scroll" id="fmScroll"><svg class="fm-world la-world" viewBox="130 -205 860 670" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Лаборатория">${raw(labScene(s))}</svg></div>
    <div class="fm-dock">
      <button class="fm-db" data-act="laHarvest" ${ready ? '' : 'disabled'}><span>🧺</span>Собрать${ready ? html`<i class="fm-n">${ready}</i>` : ''}</button>
      <button class="fm-db" data-act="laShelf"><span>🌰</span>Шишки${n ? html`<i class="fm-n">${n}</i>` : ''}</button>
      <button class="fm-db" data-act="laJournal"><span>📖</span>Журнал</button>
      <button class="fm-db" data-act="laUpgrades"><span>🧬</span>Стол${aff ? html`<i class="fm-n">↑</i>` : ''}</button>
      <button class="fm-db" data-act="laExit"><span>⬆️</span>На ферму</button>
    </div>
  </div><p class="muted small fm-tip">Нажимай на кадки, стеллаж с банками, доску и стол с микроскопом. Деревья растут и без тебя.</p></div>`;
}

/* ---------- действия ---------- */
function labShow(fn) { fn(); LAB.reopen = fn; }
const labPanelClose = () => { LAB.reopen = null; };
function labPanel(title, body) {
  openModal(html`<div class="fm-panel-h"><h2>${title}</h2><button class="btn ghost sm" data-act="closeModal" aria-label="Закрыть">✕</button></div>${body}`, { onClose: labPanelClose });
}
async function labDo(path, json, sfx, keep) {
  if (LAB.busy) return null; LAB.busy = true;
  try {
    const r = await api('/lab/' + path, { json: json || {} });
    labSet(r); paintLab(); if (sfx) play(sfx);
    if (keep && LAB.reopen) { const f = LAB.reopen; f(); LAB.reopen = f; } else closeModal();
    const got = {};
    for (const e of r.events || []) {
      if (e.type === 'cones') got[e.species] = (got[e.species] || 0) + e.qty;
      if (e.type === 'discover') { play('laDisc'); confetti(e.mutant ? 220 : 110); toast(`${labSp(e.species).name}: первая шишка! Бонус 💰 ${slFmt(e.bonus)}`, { icon: laIcon(e.species), title: e.mutant ? 'Мутант найден!' : 'Новый вид' }); }
      if (e.type === 'tier') toast('Ступень коллекции собрана целиком: шишки дороже навсегда', { icon: '🏆', title: 'Коллекция' });
    }
    const list = Object.entries(got).map(([k, q]) => `${laIcon(k)} ${labSp(k).name} ×${q}`);
    if (list.length) toast(list.join(', '), { icon: '🌰', title: 'Собрано', ms: 2200 });
    LAB.busy = false; return r;
  } catch (e) { toast(e.message, { icon: '⚠️' }); LAB.busy = false; return null; }
}

actions.laExit = () => { closeModal(); location.hash = '#/farm'; };
actions.laHarvest = b => labDo('harvest', b && b.dataset && b.dataset.slot != null ? { slot: +b.dataset.slot } : {}, 'fmHarvest', !!(b && b.dataset && b.dataset.slot != null));
actions.laPlant = b => labDo('plant', { slot: +b.dataset.slot, species: b.dataset.sp }, 'fmPlant');
actions.laUpgrade = b => labDo('upgrade', { key: b.dataset.key }, 'fmCoin', true);
actions.laSell = async b => { const r = await labDo('sell', b.dataset.sp ? { species: b.dataset.sp } : {}, 'fmCoin', true); if (r) toast(`+${slFmt(r.sold.coins)} монет за ${r.sold.qty} шт.`, { icon: '💰', ms: 1500 }); };
actions.laRemove = async b => {
  if (!(await askConfirm('Убрать дерево?', 'Дерево и шишки на нём пропадут, кадка освободится. Саженец заново придётся покупать.', 'Убрать', 'Отмена', true))) return;
  labDo('remove', { slot: +b.dataset.slot }, undefined, false);
};

/* ---------- кадка ---------- */
const labTierName = t => ({ 1: 'Обычные', 2: 'Декоративные', 3: 'Элитные', 4: 'Мутанты' })[t];
function labCard(sp, slot) {
  const poor = LAB.st.coins < sp.sapling;
  return html`<button class="fm-seed la-sp t${sp.tier} ${sp.locked ? 'locked' : ''}" data-act="laPlant" data-slot="${slot}" data-sp="${sp.id}" ${sp.locked || poor ? 'disabled' : ''}>
    <span class="fm-seed-ic">${laIcon(sp.id)}</span><b>${sp.name}</b>
    ${sp.locked ? html`<span class="small">🔒 селекция ур. ${sp.tier === 2 ? 1 : 3}</span>` : html`<span class="small">💰 ${slFmt(sp.sapling)} · ⏱ ${fmClock(sp.grow)}</span><span class="small muted">шишка 💰 ${slFmt(sp.price)} раз в ${fmClock(sp.cycle)}</span>`}</button>`;
}
actions.laPot = b => {
  const i = +b.dataset.i;
  labShow(() => {
    const s = LAB.st, t = s.trees[i];
    if (!t) return;
    if (t.state === 'empty') {
      const groups = [1, 2, 3].map(k => html`<h3 class="la-h">${labTierName(k)}</h3><div class="fm-seeds">${s.species.filter(x => x.tier === k && !x.mutant).map(x => labCard(x, i))}</div>`);
      return labPanel('🪴 Что посадить?', html`<p class="muted small" style="margin:0">Дерево растёт долго, зато потом не гибнет и даёт шишки круглый год.${s.mutation_chance ? html` Шанс мутанта при посадке: <b>${Math.round(s.mutation_chance * 100)}%</b>.` : ''}</p>${groups}`);
    }
    const sp = labSp(t.species);
    if (t.state === 'growing') {
      return labPanel(`${laIcon(t.species)} ${t.name}`, html`<p class="muted" style="margin:0 0 8px">Саженец растёт. Останется <b>${fmTimer(t.left)}</b></p>${fmBar(t.left, t.progress < 1 ? t.left / (1 - t.progress) : t.left)}
        <p class="muted small">Когда подрастёт, будет давать шишки по 💰 ${slFmt(sp.price)}. Мутант (золотая или хрустальная ель) станет виден только взрослым.</p>
        <div class="row mt" style="justify-content:space-between"><button class="btn ghost sm" data-act="laRemove" data-slot="${i}">Убрать</button><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
    }
    const ts = labSp(t.species);
    return labPanel(`${laIcon(t.species)} ${t.name}${t.mutant ? ' ✨' : ''}`, html`${t.mutant ? html`<p class="la-mut">Редкий мутант! Шишки стоят намного дороже обычных.</p>` : ''}
      <div class="la-row"><span>🌰 На дереве</span><b>${t.cones}/${t.cap}</b></div>
      <div class="la-row"><span>Цена шишки</span><b>💰 ${slFmt(ts.price)}</b></div>
      <div class="la-row"><span>Новая шишка раз в</span><b>${fmClock(t.cycle)}</b></div>
      ${t.cones < t.cap ? html`<p class="small muted" style="margin:8px 0 4px">Следующая шишка через ${fmTimer(t.next_in)}</p>${fmBar(t.next_in, t.cycle)}` : html`<p class="small" style="color:var(--bad);margin:8px 0 0">Шишки больше не помещаются на дереве — собери их! Больше мест даёт «Хранилище».</p>`}
      <div class="row mt" style="justify-content:space-between"><button class="btn ghost sm" data-act="laRemove" data-slot="${i}">Убрать</button>
        <span class="row gap-s"><button class="btn" data-act="laHarvest" data-slot="${i}" ${t.cones ? '' : 'disabled'}>Собрать 🌰×${t.cones}</button><button class="btn ghost" data-act="closeModal">Закрыть</button></span></div>`);
  });
};

/* ---------- стеллаж: продажа шишек ---------- */
actions.laShelf = () => labShow(() => {
  const s = LAB.st, ids = Object.keys(s.cones).filter(k => s.cones[k] > 0).sort((a, b) => labSp(b).price - labSp(a).price);
  if (!ids.length) return labPanel('🌰 Банки с шишками', html`<p class="muted" style="margin:0">Пока пусто. Посади ель или пихту в кадку, дождись шишек и собери их.</p>`);
  const total = ids.reduce((a, k) => a + s.cones[k] * labSp(k).price, 0);
  labPanel('🌰 Банки с шишками', html`<div class="la-sell">${ids.map(k => {
    const sp = labSp(k), q = s.cones[k], r = sp.price / (sp.base_price * (1 + s.bonus)), arrow = r >= 1.12 ? '↑' : r <= .93 ? '↓' : '';
    return html`<div class="la-sell-r"><span class="la-sell-ic">${laIcon(k)}</span><div class="grow"><b>${sp.name}</b><div class="small muted">×${q} · по <span class="${arrow === '↑' ? 'up' : arrow === '↓' ? 'down' : ''}">💰 ${slFmt(sp.price)} ${arrow}</span></div></div>
      <button class="btn sm" data-act="laSell" data-sp="${k}">Продать 💰 ${slFmt(sp.price * q)}</button></div>`; })}</div>
    <div class="row mt" style="justify-content:space-between"><button class="btn" data-act="laSell">Продать всё · 💰 ${slFmt(total)}</button><button class="btn ghost" data-act="closeModal">Закрыть</button></div>
    <p class="muted small" style="margin:8px 0 0">Цены меняются каждый день. Оценщик и собранные ступени коллекции поднимают их ещё выше (сейчас +${Math.round(s.bonus * 100)}%).</p>`);
});

/* ---------- журнал видов ---------- */
actions.laJournal = () => labShow(() => {
  const s = LAB.st;
  labPanel('📖 Журнал видов', html`<p class="muted small" style="margin:0 0 6px">Первая шишка нового вида даёт бонус открытия — втрое больше её цены. Собрал всю ступень — шишки дорожают на 3% навсегда. Сейчас бонус к цене: <b>+${Math.round(s.bonus * 100)}%</b>.</p>
    ${[1, 2, 3, 4].map(k => { const t = s.tiers[k]; return html`<h3 class="la-h">${labTierName(k)} <span class="muted small">${t.found}/${t.total}</span></h3><div class="la-grid">${s.species.filter(x => x.tier === k).map(x => x.discovered
      ? html`<div class="la-j t${k}"><span class="la-j-ic">${laIcon(x.id)}</span><b class="small">${x.name}</b><span class="small muted">🌰 ${slFmt(x.price)}</span></div>`
      : html`<div class="la-j unk"><span class="la-j-ic">❔</span><b class="small">???</b><span class="small muted">${x.mutant ? 'мутант' : x.locked ? '🔒 селекция' : 'не найден'}</span></div>`)}</div>`; })}
    <p class="muted small" style="margin:10px 0 0">Мутанты иногда вырастают из обычных саженцев. Чем выше селекция, тем чаще (сейчас ${Math.round(s.mutation_chance * 100)}%), а хрустальная ель появляется только на высшем уровне.</p>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
});

/* ---------- стол с микроскопом: улучшения ---------- */
actions.laUpgrades = () => labShow(() => {
  const s = LAB.st;
  labPanel('🧬 Стол и оборудование', html`<p class="muted small" style="margin:0 0 8px">Улучшения навсегда. У тебя 💰 <b>${slFmt(s.coins)}</b>.</p><div class="la-ups">${s.upgrades.map(u => html`<div class="la-up">
    <span class="la-up-ic">${u.icon}</span><div class="grow"><b>${u.name}</b><div class="small muted">${u.desc}</div>
      <div class="la-pips">${Array.from({ length: u.max }, (_, i) => html`<i class="${i < u.level ? 'on' : ''}"></i>`)}</div></div>
    ${u.cost == null ? html`<span class="small" style="color:var(--good);font-weight:800">Макс.</span>` : html`<button class="btn sm" data-act="laUpgrade" data-key="${u.key}" ${s.coins >= u.cost ? '' : 'disabled'}>💰 ${slFmt(u.cost)}</button>`}</div>`)}</div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
});
