/* LearnQuest — «Арена»: петушиные бои (#/pet/arena). Драться могут только петухи. Бой до двух раундов, исход считает сервер (/api/pet/arena/*),
   здесь — показ и анимация боя по раундам, которые прислал сервер. Графика петухов — pet-art.js. */
'use strict';

const AR = { st: null, bet: 10, busy: false };
Object.assign(SFX, {
  arHit: () => tone([180, 120], .05, 'square', .06),
  arWin: () => tone([523, 659, 784, 1046], .09, 'triangle', .07),
  arLose: () => tone([330, 262, 196], .1, 'sawtooth', .04),
});
const arSleep = ms => new Promise(r => setTimeout(r, ms));
const arAlive = () => !!$('#arRing');

route(/^#\/pet\/arena$/, async () => { await drawArena(); });

async function drawArena() {
  render(app(), shell('pet', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  AR.st = await api('/pet/arena'); S.balance = AR.st.balance;
  if (!AR.st.bets.includes(AR.bet)) AR.bet = AR.st.bets[1];
  paintArena();
}
function paintArena() { const y = window.scrollY; render(app(), shell('pet', arenaPage(AR.st))); window.scrollTo(0, y); }

const arPowerTxt = p => (Math.round(p * 10) / 10).toString().replace('.', ',');
function arFighter(p, cls, opts = {}) {
  return html`<div class="ar-fighter ${cls}" id="${opts.id || ''}"><div class="ar-art ${opts.fx || ''}">${raw(petSvg('rooster', p.stage_index ?? 0, p.mood || 'happy'))}</div><b class="ar-name">${opts.crown ? '👑 ' : ''}${opts.name || p.name}</b></div>`;
}

function arenaPage(s) {
  const head = html`<div class="pet-top"><div><h2>⚔️ Арена</h2><p class="muted small" style="margin:0">Петушиные бои до двух раундов. Сила зависит от возраста петуха и от сытости: голодный бьёт слабее.</p></div>
    <div class="row gap-s wrap"><a class="btn ghost sm" href="#/pet">← К питомцу</a><div class="px-bal" title="Общие жетоны">🪙 <b>${slFmt(s.balance)}</b></div></div></div>`;
  if (!s.rooster) {
    return html`<div class="ar-page">${head}<div class="card ar-gate"><div class="ar-gate-ic">🐓</div>
      <h3 style="margin:0">Для боёв нужен петух</h3>
      <p class="muted" style="margin:6px 0 12px">${!s.has_pet ? 'У тебя пока нет питомца. Возьми петуха — и на арену.' : 'Сейчас у тебя другой питомец. Отпусти его и заведи петуха, чтобы драться (еда у тебя останется).'}</p>
      <a class="btn" href="#/pet">К питомцу</a></div></div>`;
  }
  const r = s.rooster, ready = r.fullness >= s.min_fullness && s.fights_left > 0;
  return html`<div class="ar-page">${head}
    <div class="ar-ring" id="arRing"><div class="ar-floor"></div>
      ${arFighter(r, 'me', { id: 'arMe' })}
      <div class="ar-vs" id="arVs">VS</div>
      <div class="ar-fighter foe" id="arFoe"><div class="ar-art ar-empty">?</div><b class="ar-name">Выбери соперника</b></div>
      <div class="ar-banner" id="arBanner" hidden></div></div>
    <div class="ar-grid">
      <div class="card ar-me"><h3 style="margin:0 0 8px">🐓 ${r.name}</h3>
        <div class="row gap-s wrap"><span class="chip accent">💪 Сила ${arPowerTxt(s.power)}</span><span class="chip">🏆 ${s.record.wins} · 💀 ${s.record.losses}</span><span class="chip">⚔️ Боёв сегодня: ${s.fights_left} из ${s.fights_per_day}</span></div>
        <div class="pet-bar mt-s"><span>🍖 Сытость</span><div class="bar thin"><i class="pet-fill ${r.mood}" style="width:${Math.round(r.fullness)}%"></i></div><b>${Math.round(r.fullness)}%</b></div>
        ${r.fullness < s.min_fullness ? html`<p class="small" style="color:var(--bad);margin:8px 0 0">Слишком голоден для боя. <a href="#/pet">Покорми его</a>.</p>` : html`<p class="muted small" style="margin:8px 0 0">Каждый бой отнимает ${s.fullness_cost}% сытости. Победа даёт петуху +15 роста, поражение +5.</p>`}
        <div class="mt-s"><span class="small muted">Ставка:</span><div class="ar-bets">${s.bets.map(b => html`<button class="ar-bet ${b === AR.bet ? 'on' : ''}" data-act="arBet" data-v="${b}" ${b > s.balance ? 'disabled' : ''}>${b ? '🪙 ' + b : 'Без ставки'}</button>`)}</div>
          <p class="muted small" style="margin:6px 0 0">Победил — получаешь ставку сверху. Проиграл против друга — ставка достаётся ему, против бота — сгорает.</p></div></div>
      <div class="ar-opps"><h3 style="margin:0 0 8px">Соперники</h3>${s.opponents.map(o => arOpp(o, r, ready))}
        ${s.opponents.some(o => o.kind === 'user') ? '' : html`<p class="muted small">У друзей пока нет петухов. Позови кого-нибудь завести петуха — будет с кем драться по-настоящему.</p>`}</div>
    </div>
    <div class="card"><h3 style="margin:0 0 8px">Последние бои</h3>${s.recent.length ? html`<div class="ar-recent">${s.recent.map(f => html`<div class="ar-rec ${f.won ? 'win' : 'lose'}">
        <span>${f.won ? '🏆' : '💀'}</span><div class="grow"><b>${f.role === 'attacker' ? 'Ты → ' + f.opponent : f.opponent + ' → тебя'}</b><div class="small muted">${f.won ? 'победа' : 'поражение'} · раунды ${f.rounds.map(x => (f.role === 'attacker' ? x : 1 - x) ? '🟢' : '🔴').join('')}</div></div>
        ${f.delta ? html`<b class="${f.delta > 0 ? 'up' : 'down'}">${f.delta > 0 ? '+' : ''}${f.delta} 🪙</b>` : ''}</div>`)}</div>` : html`<p class="muted small" style="margin:0">Боёв ещё не было.</p>`}</div>
  </div>`;
}
function arOpp(o, mine, ready) {
  const isNpc = o.kind === 'npc', can = ready && (isNpc || o.pair_left > 0) && AR.bet <= AR.st.balance;
  const pv = isNpc ? { stage_index: o.key === 'npc_boris' ? 2 : 0, mood: 'ok' } : o.pet;
  const key = raw(isNpc ? `data-npc="${o.key}"` : `data-id="${o.id}"`);
  return html`<div class="card ar-opp"><div class="ar-opp-art ${o.key === 'npc_boris' ? 'boris' : ''}">${raw(petSvg('rooster', pv.stage_index ?? 0, pv.mood || 'happy'))}</div>
    <div class="grow"><b>${isNpc ? (o.key === 'npc_boris' ? '👑 ' : '🤖 ') + o.name : o.name}</b><div class="small muted">${isNpc ? o.note : html`петух ${o.pet.name} · ${o.pet.stage_name.toLowerCase()} · 🏆 ${o.record.wins} / 💀 ${o.record.losses}`}</div>
      <div class="row gap-s wrap mt-s"><span class="chip">💪 ${arPowerTxt(o.power)}</span><span class="chip ${o.chance >= 60 ? 'good' : o.chance <= 35 ? 'bad' : ''}">шанс победы ${o.chance}%</span>${!isNpc && o.pair_left < 2 ? html`<span class="chip">с ним сегодня: ещё ${o.pair_left}</span>` : ''}</div></div>
    <button class="btn" data-act="arFight" ${key} ${can ? '' : 'disabled'}>Вызвать</button></div>`;
}

actions.arBet = b => { if (AR.busy) return; AR.bet = +b.dataset.v; $$('.ar-bet').forEach(x => x.classList.toggle('on', x === b)); play('tap'); paintArena(); };

function arFeathers(box, n = 8) {
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i'); f.className = 'ar-feather'; f.textContent = '🪶';
    f.style.cssText = `--dx:${Math.round((Math.random() - .5) * 220)}px;--dy:${Math.round(-40 - Math.random() * 90)}px;--r:${Math.round((Math.random() - .5) * 540)}deg;left:${45 + Math.random() * 10}%`;
    box.appendChild(f); setTimeout(() => f.remove(), 1300);
  }
}
async function arBanner(text, cls, ms) {
  const b = $('#arBanner'); if (!b) return; b.hidden = false; b.className = 'ar-banner ' + (cls || ''); b.textContent = text;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; await arSleep(ms);
}

actions.arFight = async b => {
  if (AR.busy) return; AR.busy = true;
  const st = AR.st, npc = b.dataset.npc, id = b.dataset.id ? +b.dataset.id : null;
  const opp = st.opponents.find(o => npc ? o.key === npc : o.id === id);
  $$('.ar-opp .btn').forEach(x => x.disabled = true);
  let r;
  try { r = await api('/pet/arena/fight', { json: npc ? { npc, bet: AR.bet } : { opponent_id: id, bet: AR.bet } }); }
  catch (e) { toast(e.message, { icon: '⚠️' }); AR.busy = false; paintArena(); return; }
  const res = r.result, ring = $('#arRing'); if (!ring) { AR.busy = false; return; }
  // соперник выходит на ринг
  const pv = opp.kind === 'npc' ? { stage_index: npc === 'npc_boris' ? 2 : 0 } : opp.pet;
  const foe = $('#arFoe'); foe.innerHTML = `<div class="ar-art ${npc === 'npc_boris' ? 'boris' : ''}">${petSvg('rooster', pv.stage_index ?? 0, 'happy')}</div><b class="ar-name">${npc === 'npc_boris' ? '👑 ' : ''}${esc(opp.name)}</b>`;
  foe.classList.add('enter'); window.scrollTo({ top: Math.max(0, ring.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
  await arBanner(`${st.rooster.name} против ${opp.name}`, 'vs', 1300);
  let me = 0, they = 0;
  for (const w of res.rounds) {
    if (!arAlive()) break;
    const meEl = $('#arMe'), foeEl = $('#arFoe');
    meEl.classList.remove('lunge'); foeEl.classList.remove('lunge'); void meEl.offsetWidth;
    meEl.classList.add('lunge'); foeEl.classList.add('lunge'); await arSleep(380); play('arHit');
    const loser = w ? foeEl : meEl; loser.classList.add('hit'); arFeathers(ring, w ? 9 : 5); setTimeout(() => loser.classList.remove('hit'), 450);
    w ? me++ : they++;
    await arBanner(`${w ? 'Твой раунд' : 'Раунд соперника'} · ${me}:${they}`, w ? 'good' : 'bad', 1100);
  }
  if (arAlive()) {
    const loserEl = res.won ? $('#arFoe') : $('#arMe'), winEl = res.won ? $('#arMe') : $('#arFoe');
    const art = loserEl.querySelector('.ar-art'); if (art) art.innerHTML = petSvg('rooster', loserEl === $('#arMe') ? st.rooster.stage_index : pv.stage_index ?? 0, 'starving');
    winEl.classList.add('win'); loserEl.classList.add('lose');
    play(res.won ? 'arWin' : 'arLose'); if (res.won) confetti(res.bet >= 25 ? 160 : 90);
    await arBanner(res.won ? `ПОБЕДА${res.delta ? ' +' + res.delta + ' 🪙' : ''}` : `Поражение${res.delta ? ' ' + res.delta + ' 🪙' : ''}`, res.won ? 'good big' : 'bad big', 1900);
  }
  AR.st = r; S.balance = r.balance; AR.busy = false;
  if (arAlive()) paintArena();
};
