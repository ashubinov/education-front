/* LearnQuest Pet PvP — two actual players, authoritative escrow, websocket push. */
'use strict';
const PVP = {
  state: null, ws: null, token: '', user: 0, retry: 0, refreshBusy: false,
  refreshAgain: false, lastRefresh: 0, seenInvite: 0, seenRound: '',
  beat: null, ticker: null, raise: 20, busy: false, skew: 0, result: null, nextConnect: 0,
};
function pvpRequestId() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a, n => n.toString(16).padStart(2, '0')).join('');
}
function pvpCash(n) { return Number(n || 0).toLocaleString('ru-RU'); }
function pvpOnPage() { return location.hash === '#/pet/pvp'; }
function pvpTimeLeft(deadline) { return Math.max(0, Math.ceil(deadline - Date.now() / 1000 + PVP.skew)); }
function pvpPhoto(p) { return p ? petSvg(p.species, p.stage_index ?? 0, p.mood || 'happy') : ''; }
function pvpFriendPhoto(p) { return p ? petSvg(p.species, p.xp >= 900 ? 2 : p.xp >= 220 ? 1 : 0, 'happy') : ''; }

function pvpDisconnect() {
  if (PVP.ws) { const ws = PVP.ws; PVP.ws = null; try { ws.close(); } catch(e) {} }
  clearInterval(PVP.beat); PVP.beat = null;
  PVP.user = 0; PVP.token = ''; PVP.nextConnect = 0;
}
function pvpConnect() {
  if (!S.user || !Token.get()) { pvpDisconnect(); return; }
  const token = Token.get();
  if (PVP.ws && PVP.token === token && PVP.user === S.user.id &&
      (PVP.ws.readyState === WebSocket.OPEN || PVP.ws.readyState === WebSocket.CONNECTING)) return;
  pvpDisconnect();
  PVP.user = S.user.id; PVP.token = token;
  const url = (API_BASE || location.origin).replace(/^http/i, 'ws') + '/api/pet/pvp/ws';
  let ws;
  try { ws = new WebSocket(url); } catch(e) { return; }
  PVP.ws = ws;
  ws.onopen = () => { if (PVP.ws === ws) ws.send(JSON.stringify({type: 'auth', token})); };
  ws.onmessage = e => {
    if (PVP.ws !== ws) return;
    let m; try { m = JSON.parse(e.data); } catch(err) { return; }
    if (m.type === 'pvp_ready') {
      PVP.retry = 0; PVP.nextConnect = 0;
      clearInterval(PVP.beat);
      PVP.beat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type:'ping'})); }, 18000);
    }
    if (m.type === 'pvp_change' || m.type === 'pvp_ready') pvpRefresh();
  };
  ws.onclose = () => {
    if (PVP.ws !== ws) return;
    PVP.ws = null; clearInterval(PVP.beat);
    if (S.user && S.user.id === PVP.user && Token.get() === token) {
      const ms = Math.min(16000, 1200 * Math.pow(1.7, Math.min(6, PVP.retry++)));
      PVP.nextConnect = Date.now() + ms;
    }
  };
  ws.onerror = () => { try { ws.close(); } catch(e) {} };
}
function pvpBoot() {
  if (PVP.ticker) return;
  PVP.ticker = setInterval(() => {
    const uid = S.user && S.user.id;
    if (!uid || !Token.get()) {
      if (PVP.ws) pvpDisconnect();
      PVP.state = null; PVP.seenInvite = 0;
      return;
    }
    if ((!PVP.ws || uid !== PVP.user || Token.get() !== PVP.token) && Date.now() >= PVP.nextConnect) pvpConnect();
    const tm = document.getElementById('pvpTimer');
    if (tm && PVP.state?.active) tm.textContent = pvpTimeLeft(PVP.state.active.deadline) + ' c';
    if (PVP.result && PVP.result.until < Date.now()) { PVP.result = null; if (pvpOnPage()) pvpPaint(); }
    // Also works when a reverse proxy does not support WebSocket upgrades.
    if (Date.now() - PVP.lastRefresh > (pvpOnPage() ? 6000 : 12000)) pvpRefresh();
  }, 1000);
}
async function pvpRefresh() {
  if (!S.user || !Token.get()) return;
  if (PVP.refreshBusy) { PVP.refreshAgain = true; return; }
  PVP.refreshBusy = true;
  try {
    const data = await api('/pet/pvp');
    if (S.user && S.user.id === PVP.user || (S.user && !PVP.user)) {
      PVP.skew = Date.now() / 1000 - data.server_now;
      const old = PVP.state?.active;
      PVP.state = data;
      if (old && !data.active && data.recent.length && data.recent[0].id === old.id && data.recent[0].status === 'finished') {
        PVP.result = {match: data.recent[0], until: Date.now()+12000};
        if (typeof play === 'function') play(data.recent[0].winner_id === data.recent[0].me ? 'arWin' : 'arLose');
      }
      S.balance = data.balance;
      PVP.lastRefresh = Date.now();
      const m = data.active;
      if (m && m.status === 'invited' && m.me !== m.initiator && m.id !== PVP.seenInvite) {
        PVP.seenInvite = m.id;
        if (!pvpOnPage()) pvpNotice(m);
      }
      if (pvpOnPage()) {
        pvpPaint();
        const last = m && m.rounds?.length && m.rounds[m.rounds.length - 1];
        const key = last && (m.id + '/' + last.round);
        if (key && PVP.seenRound !== key) {
          PVP.seenRound = key;
          if (old && old.id === m.id && old.rounds.length < m.rounds.length) pvpRoundFX(m, last);
        }
      }
    }
  } catch (e) {
    if (pvpOnPage() && !PVP.state) {
      const host = document.getElementById('pvpHost');
      if (host) host.innerHTML = `<div class="card"><p>${esc(e.message)}</p><button class="btn" data-act="pvpRetry">Повторить</button></div>`;
    }
  } finally {
    PVP.refreshBusy = false;
    if (PVP.refreshAgain) { PVP.refreshAgain = false; pvpRefresh(); }
  }
}
function pvpNotice(m) {
  const root = document.getElementById('toasts'); if (!root) return;
  const card = document.createElement('div'); card.className = 'toast pvp-notice';
  const t = document.createElement('b'); t.textContent = 'Тебя вызвали на бой!';
  const p = document.createElement('span'); p.textContent = `${m.other_name} поставил ${m.initial_bet} жетонов`;
  const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Открыть арену';
  b.onclick = () => { card.remove(); location.hash = '#/pet/pvp'; };
  card.append(t, p, b); root.appendChild(card);
  setTimeout(() => card.remove(), 13000);
}
function pvpRoundFX(m, last) {
  if (typeof play === 'function' && SFX.arHit) play('arHit');
  const arena = document.getElementById('pvpStage');
  if (arena) { arena.classList.remove('pvp-impact'); void arena.offsetWidth; arena.classList.add('pvp-impact'); }
  toast(last.winner_id === m.me ? 'Раунд за тобой!' : 'Соперник выиграл раунд', {icon:last.winner_id === m.me ? '🏆':'⚔️'});
}
route(/^#\/pet\/pvp$/, async () => {
  render(app(), shell('pvp', html`<div id="pvpHost" class="pvp-page"><div class="center muted mt-l"><span class="spinner"></span></div></div>`));
  pvpConnect(); await pvpRefresh();
  if (!PVP.state) pvpPaint();
});
function pvpPaint() {
  if (!pvpOnPage()) return;
  const host = document.getElementById('pvpHost'); if (!host) return;
  if (!PVP.state) { host.innerHTML = '<div class="card">Нет связи с сервером PvP</div>'; return; }
  const s = PVP.state, m = s.active, previousY = window.scrollY;
  host.innerHTML = unraw(html`
    <header class="pvp-head"><div><h2>⚔️ Арена питомцев · Live PvP</h2>
    <p class="muted small">Два реальных игрока. Торги до боя и между раундами. До двух побед в раундах.</p></div>
    <div class="row gap-s wrap"><a class="btn ghost sm" href="#/pet">← Питомец</a><a class="btn ghost sm" href="#/pet/arena">Тренировка с ботами</a>
    <span class="px-bal">🪙 <b>${pvpCash(s.balance)}</b></span></div></header>
    ${!s.pet ? html`<div class="card center"><h3>Для арены нужен питомец</h3><p class="muted">Заведи любое животное в разделе «Питомец».</p><a class="btn" href="#/pet">Выбрать питомца</a></div>` :
      s.pet.fullness < 20 && !m ? html`<div class="card"><p>Питомец голоден. Для вызова нужно не менее 20% сытости.</p><a href="#/pet" class="btn">Покормить</a></div>` : ''}
    ${m ? pvpMatch(m,s) : html`${PVP.result ? pvpFinished(PVP.result.match) : ''}${pvpLobby(s)}`}
    ${s.recent?.length ? html`<section class="card pvp-history"><h3>История PvP</h3>${s.recent.map(x => html`<div class="pvp-history-row"><span>${x.status === 'cancelled' ? 'Отменён' : x.winner_id === x.me ? 'Победа' : 'Поражение'} · ${x.other_name}${x.reason ? ' · ' + x.reason : ''}</span><b>${x.status === 'cancelled' ? '' : x.winner_id === x.me ? '+'+pvpCash(x.pot-x.my_total) : '−'+pvpCash(x.my_total)} 🪙</b></div>`)}</section>` : ''}
  `);
  window.scrollTo(0, previousY);
}
function pvpFinished(m) {
  return html`<div class="card pvp-final"><h2>${m.winner_id === m.me ? '🏆 Победа!' : 'Поражение'}</h2>
     <p>${m.winner_id === m.me ? 'Ты забираешь общий банк ' + pvpCash(m.pot) + ' 🪙' : 'Банк ' + pvpCash(m.pot) + ' 🪙 выиграл ' + m.other_name}</p>
     <p>Твой итог: <b>${m.winner_id === m.me ? '+'+pvpCash(m.pot-m.my_total) : '−'+pvpCash(m.my_total)} 🪙</b></p>
     <p class="muted small">Результат: ${m.wins_me}:${m.wins_other} · ${m.reason==='battle'?'бой до двух побед':m.reason==='fold'?'сдача':m.reason==='timeout_fold'?'тайм-аут':'завершение матча'}</p>
     <button class="btn ghost sm" data-act="pvpHideResult">Закрыть результат</button></div>`;
}
actions.pvpHideResult = () => { PVP.result=null; pvpPaint(); };
function pvpLobby(s) {
  return html`<section class="card pvp-lobby"><h3>Бросить вызов другу</h3>
    <p class="muted small">Ты сразу резервируешь стартовую ставку. Если друг отклонит вызов или не ответит за 2 минуты, жетоны вернутся. Вызвать можно только друга с питомцем.</p>
    <div class="pvp-friends">${s.friends.filter(f=>f.pet).length ? s.friends.filter(f=>f.pet).map(f=> html`
      <div class="pvp-friend"><div class="pvp-friend-art">${raw(pvpFriendPhoto(f.pet))}</div>
       <div class="grow"><b>${f.name}</b><div class="muted small">${f.pet.name} · сила ${f.pet.power.toFixed(2)} · ${f.online ? '● онлайн' : '○ офлайн'}${f.busy ? ' · уже в бою' : ''}</div></div>
       <button class="btn sm" data-act="pvpInvite" data-id="${f.id}" ${!s.pet || s.pet.fullness<20 || f.pet.fullness<20 || f.busy || s.balance<PVP.raise ? 'disabled' : ''}>Вызвать</button></div>`) : html`<p class="muted">Пока нет друзей с питомцами. Добавь друзей в разделе «Друзья».</p>`}</div>
    <p class="muted small">Стартовая ставка: <b id="pvpSelectedBet">${PVP.raise}</b> 🪙. Выбери перед вызовом:</p>
    <div class="row gap-s wrap">${[10,20,50,100,200].map(n=>html`<button class="btn ${PVP.raise === n ? '' : 'ghost'} sm" data-act="pvpBet" data-n="${n}" ${s.balance<n?'disabled':''}>${n}</button>`)}</div>
    </section>`;
}
function pvpMatch(m, s) {
  const invited = m.status==='invited';
  const rounds = m.rounds.map(r => r.winner_id === m.me ? '●' : '○').join(' ');
  const pv1 = m.pet_me || s.pet;
  const status = m.status === 'finished' ? 'Матч завершён' : m.status === 'reveal' ? 'Раунд завершён' : m.status === 'betting' ? 'Торги' : 'Ожидание подтверждения';
  return html`<section class="pvp-match"><div class="card pvp-stage" id="pvpStage">
    <div class="pvp-status"><b>${status}</b> <span class="muted">${m.status === 'betting' ? 'Раунд '+m.round_no+' · ' : ''} <b id="pvpTimer">${pvpTimeLeft(m.deadline)} c</b></span></div>
    <div class="pvp-fighters">
      <div class="pvp-fighter"><div class="pvp-fighter-art">${raw(pvpPhoto(pv1))}</div><b>${pv1?.name||'Твой питомец'}</b><span class="muted small">${m.me_name}</span>
        <span class="small">Сила ${m.power_me?.toFixed(2) || '—'}</span></div>
      <div class="pvp-middle"><span>VS</span><b>🪙 ${pvpCash(m.pot)}</b><small>Общий банк</small><div class="pvp-score">${m.wins_me} : ${m.wins_other}</div></div>
      <div class="pvp-fighter"><div class="pvp-fighter-art">${m.pet_other ? raw(pvpPhoto(m.pet_other)) : html`<span class="pvp-question">?</span>`}</div><b>${m.pet_other?.name||'Питомец соперника'}</b>
      <span class="muted small">${m.other_name} · ${m.other_online ? 'онлайн' : 'не в сети'}</span><span class="small">Сила ${m.power_other?.toFixed(2) || '—'}</span></div>
    </div>
    <div class="pvp-contributions"><span>Вложено: ты <b>${pvpCash(m.my_total)}</b> 🪙</span><span>Соперник: <b>${pvpCash(m.other_total)}</b> 🪙</span></div>
    ${rounds ? html`<p class="center muted small">Результаты раундов (● твой, ○ соперника): ${rounds}</p>` : ''}
    </div>${invited ? pvpInvitation(m) : m.status === 'betting' ? pvpBets(m,s) : m.status === 'reveal' ? html`
      <div class="card center"><h3>Раунд ${m.round_no} окончен</h3><p>${m.rounds[m.rounds.length-1]?.winner_id === m.me ? 'Твой питомец выиграл раунд!' : 'Соперник выиграл раунд.'} Следующие торги скоро начнутся.</p></div>` : ''}
    </section>`;
}
function pvpInvitation(m) {
  return html`<div class="card center"><h3>${m.initiator === m.me ? 'Вызов отправлен' : 'Тебя вызвали на бой!'}</h3>
   <p>${m.initiator === m.me ? 'Ждём ответа '+m.other_name+'.' : m.other_name+' предлагает стартовую ставку '+pvpCash(m.initial_bet)+' 🪙.'}</p>
   <div class="row gap-s wrap" style="justify-content:center">
    ${m.initiator===m.me ? html`<button class="btn ghost" data-act="pvpCancel">Отменить и вернуть ${m.initial_bet} 🪙</button>` : html`
      <button class="btn" data-act="pvpAccept">Принять · −${m.initial_bet} 🪙</button>
      <button class="btn ghost" data-act="pvpDecline">Отказаться</button>`}
   </div></div>`;
}
function pvpBets(m,s) {
  const on = m.my_turn, call = m.to_call;
  return html`<div class="card pvp-controls"><h3>${on ? 'Твой ход' : 'Ожидание решения соперника'}</h3>
    <p class="muted small">${on ? (call ? 'Нужно уравнять '+call+' 🪙, повысить или сдаться.' : 'Можно повысить ставку или пропустить ход.') : 'Соперник выбирает действие. Таймер ограничивает время решения.'}</p>
    ${on ? html`<div class="pvp-action-row">
       ${call ? html`<button class="btn" data-act="pvpCall" ${s.balance<call?'disabled':''}>Уравнять · ${call} 🪙</button>` : html`<button class="btn" data-act="pvpCheck">Пропустить</button>`}
       <button class="btn bad" data-act="pvpFold">Сдаться</button></div>
      <div class="pvp-raise"><b>Повысить на:</b><div class="row gap-s wrap">
      ${[10,20,50,100,200].map(n=>html`<button class="btn ghost sm" data-act="pvpRaise" data-n="${n}" ${m.raises_left <= 0 || n>m.raise_max ? 'disabled':''}>+${n}</button>`)}</div>
      <span class="muted small">При повышении также автоматически уравнивается текущая ставка. Осталось повышений: ${m.raises_left}.</span></div>` : ''}
   </div>`;
}
async function pvpPost(path, body) {
  if (PVP.busy) return;
  PVP.busy = true;
  try {
    const old = PVP.state?.active;
    const data = await api('/pet/pvp/'+path, {json:{...body,request_id:pvpRequestId()}});
    if (old && !data.active && data.recent.length && data.recent[0].id === old.id && data.recent[0].status === 'finished') {
      PVP.result = {match:data.recent[0],until:Date.now()+12000};
      if (typeof play === 'function') play(data.recent[0].winner_id === data.recent[0].me?'arWin':'arLose');
    }
    PVP.state = data; PVP.skew=Date.now()/1000-data.server_now; S.balance=data.balance; PVP.lastRefresh=Date.now(); pvpPaint();
    const m = data.active;
    const last = m && m.rounds?.length && m.rounds[m.rounds.length-1];
    if (last && old && old.id === m.id && old.rounds.length < m.rounds.length) pvpRoundFX(m,last);
  }
  catch(e) { toast(e.message, {icon:'⚠️'}); await pvpRefresh(); }
  finally { PVP.busy = false; }
}
actions.pvpRetry = () => pvpRefresh();
actions.pvpBet = b => { PVP.raise=+b.dataset.n; pvpPaint(); };
actions.pvpInvite = b => pvpPost('invite',{defender_id:+b.dataset.id,bet:PVP.raise});
actions.pvpAccept = () => pvpPost('accept',{match_id:PVP.state.active.id});
actions.pvpDecline = () => pvpPost('decline',{match_id:PVP.state.active.id});
actions.pvpCancel = () => pvpPost('cancel',{match_id:PVP.state.active.id});
actions.pvpCheck = () => pvpPost('action',{match_id:PVP.state.active.id,move:'check',amount:0});
actions.pvpCall = () => pvpPost('action',{match_id:PVP.state.active.id,move:'call',amount:0});
actions.pvpRaise = b => pvpPost('action',{match_id:PVP.state.active.id,move:'raise',amount:+b.dataset.n});
actions.pvpFold = async () => {
  if (!await askConfirm('Сдаться?', 'Все уже поставленные жетоны перейдут сопернику.', 'Сдаться', 'Остаться', true)) return;
  if (PVP.state?.active) pvpPost('action',{match_id:PVP.state.active.id,move:'fold',amount:0});
};
// Register at the end of index.html, before core's boot() call.
setTimeout(pvpBoot, 0);
