/* LearnQuest — слоты «Лапа удачи».
   Все решения принимает сервер (/api/slots/*): здесь только отрисовка, анимация барабанов и повтор запроса при сбое сети.
   Валюта — виртуальные жетоны, отдельные от XP. */
'use strict';

const SL = { st: null, board: [], bet: 20, spinning: false, pendingId: null, pendingBet: null, grid: null, lastWin: 0 };
const SL_START = [['bulldog', 'bone', 'ball'], ['corgi', 'collar', 'bowl'], ['pug', 'wild', 'bone'], ['chihuahua', 'ball', 'collar'], ['doberman', 'bowl', 'scatter']];
const SL_TIER = { big: 'BIG WIN', mega: 'MEGA WIN', jackpot: 'JACKPOT' };

Object.assign(SFX, {
  reelGo: () => tone([196, 262, 330], .05, 'sawtooth', .035),
  reelStop: () => tone([150], .07, 'square', .05),
  coin: () => tone([988, 1319], .05, 'triangle', .05),
  win1: () => tone([523, 659, 784], .08, 'sine', .07),
  win2: () => tone([523, 659, 784, 1047, 1319], .09, 'triangle', .07),
  bigwin: () => tone([392, 523, 659, 784, 1047, 1319, 1568, 2093], .1, 'triangle', .08),
  bonus: () => tone([660, 880, 660, 880, 1320], .1, 'square', .05),
});

const slId = () => { const a = new Uint8Array(12); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256)); return 'r' + [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
const slRand = () => { const ids = SL.st.meta.symbols.map(s => s.id); return ids[(Math.random() * ids.length) | 0]; };
const slName = id => (SL.st.meta.symbols.find(s => s.id === id) || {}).name || id;
const slFmt = n => Number(n).toLocaleString('ru-RU');

function slCell(id, c, r) { return `<div class="sym ${SLOT_DOGS.has(id) ? 'dog' : ''}" data-s="${id}" style="--d:${((c * 3 + r * 5) % 9) * -.4}s">${slotSvg(id)}</div>`; }
function slReel(col, c) { return `<div class="reel" data-c="${c}"><div class="reel-strip">${col.map((id, r) => slCell(id, c, r)).join('')}</div></div>`; }

/* =============================== экран =============================== */
route(/^#\/slots$/, async () => { await drawSlots(); });

async function drawSlots() {
  render(app(), shell('slots', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  const [st, board] = await Promise.all([api('/slots/state'), api('/slots/leaderboard').catch(() => [])]);
  SL.st = st; SL.board = board; SL.spinning = false;
  SL.bet = slValidBet(SL.bet) ? SL.bet : (slValidBet(+slStored()) ? +slStored() : (st.bets.includes(20) ? 20 : st.bets[0]));
  const last = st.history[0];
  SL.grid = last ? last.reels : SL_START;
  render(app(), shell('slots', html`${raw(SLOT_DEFS)}
    <div class="slots-page">
      <div class="slot-machine" id="machine">
        <div class="slot-head"><div class="mini-dog">${raw(slotSvg('pug'))}</div>
          <div class="slot-logo"><span class="l1">LUCKY</span><span class="l2"><i>🐾</i>PAW</span></div>
          <div class="mini-dog flip">${raw(slotSvg('corgi'))}</div></div>
        <div class="slot-sub">собачий автомат · жетоны виртуальные, не деньги</div>
        <div class="slot-screen"><div class="reels" id="reels">${raw(SL.grid.map(slReel).join(''))}</div><div class="slot-overlay" id="slotOverlay"></div></div>
        <div class="slot-msg" id="slotMsg"></div>
        <div class="slot-panel">
          <div class="slot-box"><span class="lbl">Баланс</span><b id="slBalance">🪙 ${slFmt(st.balance)}</b></div>
          <button class="spin-btn" id="spinBtn" data-act="slotSpin" aria-label="Крутить"><span class="sp-t">SPIN</span><span class="sp-s" id="spinSub"></span></button>
          <div class="slot-box"><span class="lbl">Ставка</span><div class="bet-row"><button class="bet-b" data-act="slotBet" data-d="-1" aria-label="Меньше">‹</button><button class="bet-val" id="slBet" data-len="${slBetLabel(SL.bet).length}" data-act="slotBetEdit" title="Выбрать свою сумму">${slBetLabel(SL.bet)}</button><button class="bet-b" data-act="slotBet" data-d="1" aria-label="Больше">›</button></div></div>
        </div>
      </div>
      <div class="slots-side" id="slotSide"></div>
    </div>`));
  slSide();
  slMsg(st.balance < st.min_bet ? 'Жетоны закончились — забери ежедневный бонус, докупи за XP или загляни завтра' : 'Крути барабаны и лови выигрыш! <small>Пробел — SPIN</small>');
  slControls();
  const onKey = e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement?.tagName || '')) { e.preventDefault(); actions.slotSpin(); } };
  document.addEventListener('keydown', onKey);
  S.onLeave = () => { document.removeEventListener('keydown', onKey); SL.spinning = false; };
}

function slMsg(h) { const m = $('#slotMsg'); if (m) m.innerHTML = h; }
function slControls() {
  const b = $('#spinBtn'); if (!b) return;
  const can = SL.st.balance >= SL.bet;
  b.disabled = SL.spinning || !can;
  b.classList.toggle('busy', SL.spinning); b.classList.toggle('idle', !SL.spinning && can);
  $('#spinSub').textContent = SL.spinning ? '' : can ? '−' + SL.bet : 'мало жетонов';
  $$('.bet-b').forEach(x => x.disabled = SL.spinning);
  $('#slBet').textContent = slBetLabel(SL.bet); $('#slBet').title = 'Ставка ' + slFmt(SL.bet) + ' — нажми, чтобы выбрать свою сумму'; $('#slBet').dataset.len = slBetLabel(SL.bet).length; $('#slBet').disabled = SL.spinning;
}
function slStored() { try { return localStorage.getItem('lq_slot_bet') || ''; } catch (e) { return ''; } }
/** Короткая подпись ставки в тесной рамке: от 10 000 — в тысячах (50000 → «50K», 12340 → «12.3K»), остальные суммы целиком. */
function slBetLabel(v) { return v >= 10000 ? String(+(v / 1000).toFixed(1)) + 'K' : String(v); }
function slValidBet(v) { const st = SL.st; return Number.isInteger(v) && st && v >= st.min_bet && v <= st.max_bet && v % st.bet_step === 0; }
function slSetBet(v, quiet) {
  SL.bet = v; SL.pendingId = null;
  try { localStorage.setItem('lq_slot_bet', String(v)); } catch (e) { /* без хранилища просто не запоминаем */ }
  if (!quiet) play('tap');
  slControls(); slPay();
}
actions.slotBet = b => {
  if (SL.spinning) return;
  const bets = [...SL.st.bets].sort((x, y) => x - y), d = +b.dataset.d;
  const next = d > 0 ? bets.find(x => x > SL.bet) : [...bets].reverse().find(x => x < SL.bet);
  if (next != null) slSetBet(next);
};
actions.slotBetEdit = () => {
  if (SL.spinning) return;
  const st = SL.st, maxAfford = Math.max(st.min_bet, Math.min(st.max_bet, Math.floor(st.balance / st.bet_step) * st.bet_step));
  openModal(html`<h2>🎰 Ставка</h2><p class="muted small" style="margin-top:0">Любая сумма от ${st.min_bet} до ${slFmt(st.max_bet)} жетонов, кратная ${st.bet_step}: ставка делится поровну между ${st.meta.lines.length} линиями. Выигрыш растёт вместе со ставкой.</p>
    <div class="field"><label>Своя ставка</label><input type="number" id="betInput" inputmode="numeric" min="${st.min_bet}" max="${st.max_bet}" step="${st.bet_step}" value="${SL.bet}" autocomplete="off"></div>
    <div class="bet-chips">${st.bets.map(v => html`<button class="bet-chip" data-act="betPick" data-v="${v}">${slFmt(v)}</button>`)}<button class="bet-chip max" data-act="betPick" data-v="${maxAfford}">МАКС ${slFmt(maxAfford)}</button></div>
    <div class="err" id="betErr"></div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Отмена</button><button class="btn" id="betOk" data-act="betApply">Готово</button></div>`);
  const inp = $('#betInput'); inp.focus(); inp.select();
  inp.addEventListener('input', slBetCheck); inp.addEventListener('keydown', e => { if (e.key === 'Enter') actions.betApply(); });
  slBetCheck();
};
function slBetCheck() {
  const st = SL.st, v = Number($('#betInput').value), err = $('#betErr');
  let m = '';
  if (!Number.isInteger(v)) m = 'Введи целое число';
  else if (v < st.min_bet || v > st.max_bet) m = `Ставка — от ${st.min_bet} до ${slFmt(st.max_bet)}`;
  else if (v % st.bet_step) m = `Сумма должна делиться на ${st.bet_step} (например ${Math.round(v / st.bet_step) * st.bet_step || st.bet_step})`;
  else if (v > st.balance) m = `Больше, чем на балансе (${slFmt(st.balance)}) — крутить с такой ставкой пока нельзя`;
  err.textContent = m; $('#betOk').disabled = !!m && !(Number.isInteger(v) && slValidBet(v));
  return slValidBet(v);
}
actions.betPick = b => { $('#betInput').value = b.dataset.v; slBetCheck(); };
actions.betApply = () => { const v = Number($('#betInput').value); if (!slValidBet(v)) { slBetCheck(); return; } closeModal(); slSetBet(v); };

function slNum(el, from, to, ms = 700) {
  if (!el) return;
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / ms), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    el.textContent = '🪙 ' + slFmt(v);
    if (k < 1 && $('#slBalance') === el) requestAnimationFrame(step);
  })(t0);
}

/* =============================== вращение =============================== */
actions.slotSpin = async () => {
  if (SL.spinning || !SL.st) return;
  if (SL.st.balance < SL.bet) { slMsg('Не хватает жетонов для такой ставки — уменьши ставку или забери бонус'); return; }
  SL.spinning = true; slControls(); slClearWin(); slMsg('Удачи…');
  if (SL.pendingBet !== SL.bet) SL.pendingId = null;
  SL.pendingId = SL.pendingId || slId(); SL.pendingBet = SL.bet;
  $('#reels').classList.add('windup'); play('reelGo');
  let res;
  try {
    [res] = await Promise.all([api('/slots/spin', { json: { bet: SL.bet, request_id: SL.pendingId } }), sleep(240)]);
  } catch (e) {
    $('#reels')?.classList.remove('windup'); SL.spinning = false;
    if (e.status === 429) slMsg('Не так быстро — дождись окончания вращения');
    else if (!e.status) slMsg('Нет связи с сервером. Нажми SPIN ещё раз — ставка не спишется дважды');  // тот же request_id: сервер вернёт уже посчитанный результат
    else { SL.pendingId = null; slMsg(esc(e.message)); toast(e.message, { icon: '🎰' }); }
    slControls(); return;
  }
  SL.pendingId = null;
  if (!$('#reels')) return;  // ушли с экрана во время запроса: результат уже сохранён на сервере
  $('#reels').classList.remove('windup');
  const before = res.balance - res.payout;
  $('#slBalance').textContent = '🪙 ' + slFmt(before);
  SL.st.balance = before;
  await slAnimate(res.reels);
  SL.grid = res.reels;
  await slResult(res);
  SL.st.balance = res.balance; SL.spinning = false;
  if (res.balance < SL.bet && res.balance >= SL.st.min_bet) { const lower = Math.floor(res.balance / SL.st.bet_step) * SL.st.bet_step; slSetBet(lower, true); slMsg(`Жетонов осталось ${slFmt(res.balance)} — ставка снижена до <b>${slFmt(lower)}</b>`); }
  slControls();
  slRefresh();
};

function slAnimate(grid) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Promise.all($$('#reels .reel').map((el, i) => new Promise(done => {
    const strip = el.querySelector('.reel-strip'), cur = [...strip.children].map(c => c.dataset.s);
    const dur = reduce ? 260 : 950 + i * 330, n = reduce ? 3 : Math.round(dur / 55);
    strip.innerHTML = [...grid[i], ...Array.from({ length: n }, slRand), ...cur].map((id, r) => slCell(id, i, r)).join('');
    strip.style.transition = 'none'; strip.style.transform = `translateY(${-(n + 3) / (n + 6) * 100}%)`;
    el.classList.add('spinning'); void strip.offsetHeight;
    strip.style.transition = `transform ${dur}ms cubic-bezier(.22,.7,.2,1.07)`; strip.style.transform = 'translateY(0)';
    setTimeout(() => el.classList.remove('spinning'), Math.max(0, dur - 240));
    setTimeout(() => {
      strip.style.transition = 'none'; strip.style.transform = ''; strip.innerHTML = grid[i].map((id, r) => slCell(id, i, r)).join('');
      el.classList.add('stop'); setTimeout(() => el.classList.remove('stop'), 220); play('reelStop'); done();
    }, dur + 40);
  })));
}

function slClearWin() { $('#reels')?.classList.remove('winning'); $$('#reels .sym.win').forEach(x => x.classList.remove('win')); const o = $('#slotOverlay'); if (o) o.innerHTML = ''; }
function slMark(res) {
  const cells = [...res.lines.flatMap(l => l.positions), ...(res.scatter ? res.scatter.positions : []), ...(res.bonus ? res.bonus.positions : [])];
  cells.forEach(([c, r]) => $(`#reels .reel:nth-child(${c + 1}) .sym:nth-child(${r + 1})`)?.classList.add('win'));
  if (cells.length) $('#reels').classList.add('winning');
}

async function slResult(res) {
  const bal = $('#slBalance');
  if (res.payout <= 0) { slMsg(`Без выигрыша. Баланс: <b>${slFmt(res.balance)}</b>`); return; }
  slMark(res);
  const parts = [...res.lines.slice(0, 3).map(l => `${esc(slName(l.symbol))} ×${l.count} <b>+${slFmt(l.pay)}</b>`)];
  if (res.lines.length > 3) parts.push(`ещё ${res.lines.length - 3} лин.`);
  if (res.scatter) parts.push(`SCATTER ×${res.scatter.count} <b>+${slFmt(res.scatter.pay)}</b>`);
  if (res.bonus) parts.push(`BONUS ×${res.bonus.count}: приз <b>+${slFmt(res.bonus.prize)}</b>`);
  slMsg(`<span class="win-total">+${slFmt(res.payout)}</span><span class="win-list">${parts.join(' · ')}</span>`);
  slNum(bal, res.balance - res.payout, res.balance, 900);
  const tier = res.tier, big = SL_TIER[tier];
  if (big || res.bonus) {
    play(big ? 'bigwin' : 'bonus');
    const o = $('#slotOverlay');
    o.innerHTML = `<div class="bigwin tier-${big ? tier : 'bonus'}"><div class="bw-rays"></div><div class="bw-body">${res.bonus && !big ? `<div class="bw-icon">${slotSvg('bonus')}</div>` : ''}<div class="bw-title">${big || 'BONUS'}</div><div class="bw-amount">0</div><div class="bw-sub">нажми, чтобы закрыть</div></div></div>`;
    const amt = o.querySelector('.bw-amount'), t0 = performance.now(), total = res.payout;
    requestAnimationFrame(function step(t) { const k = Math.min(1, (t - t0) / 1600); amt.textContent = '+' + slFmt(Math.round(total * (1 - Math.pow(1 - k, 3)))); if (k < 1 && amt.isConnected) requestAnimationFrame(step); });
    confetti(big ? (tier === 'jackpot' ? 320 : 200) : 90);
    await new Promise(r => { const close = () => { o.innerHTML = ''; r(); }; o.firstElementChild.addEventListener('click', close, { once: true }); setTimeout(close, tier === 'jackpot' ? 4200 : 2800); });
  } else { play(res.payout >= SL.bet * 3 ? 'win2' : 'win1'); setTimeout(() => play('coin'), 180); await sleep(500); }
}

async function slRefresh() {
  try { const st = await api('/slots/state'); SL.st = st; SL.board = await api('/slots/leaderboard').catch(() => SL.board); slSide(); slControls(); } catch (e) { /* не критично */ }
}

/* =============================== нижние блоки =============================== */
function slPay() {
  const box = $('#slPay'); if (!box) return;
  box.innerHTML = unraw(slPayHtml());
}
function slPayHtml() {
  const k = SL.bet / SL.st.meta.lines.length, m = SL.st.meta;
  return html`<div class="pay-grid">${m.symbols.filter(s => s.pays).map(s => html`<div class="pay-row"><span class="pay-ic">${raw(slotSvg(s.id))}</span><b>${s.name}</b><span class="pay-v">${s.pays.map((p, i) => html`<i>${i + 3}× <b>${slFmt(p * k)}</b></i>`)}</span></div>`)}
    <div class="pay-row"><span class="pay-ic">${raw(slotSvg('scatter'))}</span><b>SCATTER</b><span class="pay-v">${Object.entries(m.scatter_pays).map(([n, p]) => html`<i>${n}× <b>${slFmt(p * SL.bet)}</b></i>`)}</span></div>
    <div class="pay-row"><span class="pay-ic">${raw(slotSvg('bonus'))}</span><b>BONUS</b><span class="pay-v"><i>3+ будки — бонусный приз до ${slFmt(60 * 5 * SL.bet)}</i></span></div></div>
    <p class="small muted" style="margin:10px 0 0">10 линий, выплаты слева направо от первого барабана. WILD заменяет любые символы, кроме SCATTER и BONUS; SCATTER и BONUS платят за любое расположение. Цифры — для текущей ставки (${SL.bet}).</p>`;
}
function slSide() {
  const st = SL.st, s = st.stats, d = st.daily;
  const hist = st.history.length ? st.history.map(h => html`<div class="h-row ${h.payout > 0 ? 'won' : ''}"><span class="h-reels">${h.reels.map(col => html`<span class="h-sym">${raw(slotSvg(col[1]))}</span>`)}</span><span class="h-bet">−${h.bet}</span><b class="h-pay">${h.payout > 0 ? '+' + slFmt(h.payout) : '0'}</b></div>`) : html`<p class="muted small" style="margin:0">Пока ни одного вращения.</p>`;
  const board = SL.board.length ? SL.board.map((b, i) => html`<div class="lb-row"><span class="lb-n">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="pav sm">${av(b)}</span><span class="grow pname"><b>${b.display_name}</b></span><b>🪙 ${slFmt(b.best_win)}</b></div>`) : html`<p class="muted small" style="margin:0">Таблица пуста — стань первым.</p>`;
  const el = $('#slotSide'); if (!el) return;
  el.innerHTML = unraw(html`
    <div class="card daily-card ${d.available ? 'ready' : ''}"><div class="row spread wrap"><div><h3 style="margin:0">🎁 Ежедневный бонус</h3><div class="small muted">${d.available ? `Забери ${d.amount} жетонов — раз в день.` : 'Сегодняшний бонус уже получен. Загляни завтра!'}</div></div>
      ${d.available ? html`<button class="btn good" data-act="slotDaily">Забрать +${d.amount}</button>` : html`<span class="chip">⏳ завтра</span>`}</div></div>
    ${slExchangeHtml()}
    <div class="tiles slot-tiles"><div class="card tile"><b>🎰 ${slFmt(s.spins)}</b><span>вращений</span></div><div class="card tile"><b>🏆 ${slFmt(s.best_win)}</b><span>лучший выигрыш</span></div><div class="card tile"><b>🪙 ${slFmt(s.won_total)}</b><span>всего выиграно</span></div><div class="card tile"><b>${Math.round(s.win_rate * 100)}%</b><span>вращений с выигрышем</span></div></div>
    <div class="two"><div class="card"><h3>Последние вращения</h3><div class="col" style="gap:6px" id="slHist">${hist}</div></div>
      <div class="card"><h3>🏅 Лучшие выигрыши</h3><div class="col" style="gap:8px">${board}</div></div></div>
    <details class="card"><summary style="cursor:pointer;font-weight:900">📋 Таблица выплат</summary><div id="slPay" class="mt">${slPayHtml()}</div></details>`);
}
actions.slotDaily = async b => {
  busy(b, true);
  try {
    const r = await api('/slots/daily', { method: 'POST' });
    SL.st.balance = r.balance; play('coin'); toast(`+${r.amount} жетонов`, { icon: '🎁', title: 'Ежедневный бонус', ms: 2600 });
    slNum($('#slBalance'), r.balance - r.amount, r.balance, 700); slMsg('Бонус получен — крути!'); slControls(); await slRefresh();
  } catch (e) { busy(b, false); toast(e.message, { icon: '⚠️' }); }
};

/* =============================== обмен XP на жетоны =============================== */
function slBuyReason(p) {
  const ex = SL.st.exchange;
  if (ex.buy_only_below != null && SL.st.balance >= ex.buy_only_below) return `Докупить можно, когда жетонов меньше ${ex.buy_only_below}`;
  if (ex.remaining_today != null && p.chips > ex.remaining_today) return ex.remaining_today ? `Дневной лимит: сегодня можно ещё ${ex.remaining_today}` : 'Дневной лимит покупок исчерпан — приходи завтра';
  if (p.xp > ex.xp_available) return `Не хватает ${p.xp - ex.xp_available} XP`;
  return '';
}
function slExchangeHtml() {
  const ex = SL.st.exchange, reasons = ex.packs.map(slBuyReason), allOff = reasons.every(x => x);
  return html`<div class="card exch-card"><h3 style="margin:0 0 10px">💱 Докупить жетоны за XP</h3>
    <div class="row wrap gap-s mb"><span class="chip accent">⭐ доступно ${slFmt(ex.xp_available)} XP</span><span class="chip">заработано ${slFmt(ex.xp_total)}</span><span class="chip">потрачено ${slFmt(ex.xp_spent)}</span>${ex.daily_limit != null ? html`<span class="chip ${ex.remaining_today ? '' : 'warn'}">сегодня куплено ${ex.bought_today} / ${ex.daily_limit}</span>` : ''}</div>
    <div class="packs">${ex.packs.map((p, i) => html`<button class="pack ${reasons[i] ? 'off' : ''}" data-act="slotBuy" data-chips="${p.chips}" data-xp="${p.xp}" ${reasons[i] ? 'disabled' : ''} title="${reasons[i]}"><b>+${p.chips} 🪙</b><span>${slFmt(p.xp)} XP</span></button>`)}</div>
    ${allOff ? html`<div class="small muted mt">${reasons[0]}</div>` : ''}</div>`;
}
actions.slotBuy = async b => {
  const chips = +b.dataset.chips, xp = +b.dataset.xp;
  if (SL.spinning) return;
  if (!await askConfirm('Купить жетоны?', `Потратить ${slFmt(xp)} XP и получить ${chips} жетонов? Обратно XP не вернуть (уровень не изменится).`, `Купить за ${slFmt(xp)} XP`, 'Отмена')) return;
  busy(b, true);
  try {
    const r = await api('/slots/buy', { json: { chips, request_id: slId() } });
    const prev = SL.st.balance; SL.st.balance = r.balance; play('coin');
    toast(`+${r.chips} жетонов за ${slFmt(r.xp)} XP`, { icon: '💱', ms: 2600 });
    slNum($('#slBalance'), prev, r.balance, 700); slMsg('Жетоны куплены — крути!'); slControls();
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
  await slRefresh();
};
