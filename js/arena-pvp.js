/* LearnQuest Pet PvP — two actual players, authoritative escrow, websocket push. */
'use strict';
const PVP = {
  state: null, ws: null, token: '', user: 0, retry: 0, refreshBusy: false,
  refreshAgain: false, lastRefresh: 0, seenInvite: 0, seenRound: '',
  beat: null, ticker: null, raise: 20, busy: false, skew: 0, result: null, nextConnect: 0,
  combatBusy: false, lastCombat: 0, qteBusy: false, qteTyped: '', qteNonce: 0,
  lastEventMatch: 0, lastEventSeq: 0, keyBound: false, helpOpen: false,
  criticalHoldUntil: 0, lastCritical: '', sceneTransitionUntil: 0,
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
    if (PVP.state?.active?.status === 'reveal') pvpUpdateCombatTimer();
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
      const eventSource = data.active || (old && data.recent?.find(x => x.id === old.id));
      const events = pvpNewCombatEvents(eventSource);
      pvpHoldFinalHit(events, old, data.active);
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
      if (pvpOnPage() && Date.now() >= PVP.criticalHoldUntil) {
        pvpPaint();
        const last = m && m.rounds?.length && m.rounds[m.rounds.length - 1];
        const key = last && (m.id + '/' + last.round);
        if (key && PVP.seenRound !== key) PVP.seenRound = key;
        pvpCombatEffects(events, m);
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
function pvpNewCombatEvents(m) {
  if (!m || !m.combat) return [];
  const c = m.combat;
  if (PVP.lastEventMatch !== m.id) {
    PVP.lastEventMatch = m.id;
    // On reconnect do not replay historical blows.
    PVP.lastEventSeq = c.event_seq;
    return [];
  }
  const next = c.events.filter(e => e.seq > PVP.lastEventSeq);
  PVP.lastEventSeq = Math.max(PVP.lastEventSeq, c.event_seq);
  return next;
}
/* The spectators see the SAME authoritative hit events, not local guesses. */
function pvpCombatEffects(events, m) {
  if (!pvpOnPage() || !m || !events.length) return;
  const arena = document.getElementById('pvpStage');
  if (!arena) return;
  for (const e of events.slice(-12)) {
    if (e.type === 'qte') {
      PVP.qteTyped = ''; PVP.qteNonce = e.nonce;
      const cue = document.createElement('div');
      cue.className = 'pvp-qte-announce';
      cue.textContent = '⚡ КРИТИЧЕСКИЙ МОМЕНТ!';
      document.body.append(cue);
      setTimeout(() => cue.remove(), 1000);
      if (typeof play === 'function') play('tap');
    }
    if (e.type !== 'hit') continue;
    const attackerMe = e.source === m.me;
    const attacker = document.getElementById(attackerMe ? 'pvpMine' : 'pvpEnemy');
    const target = document.getElementById(e.target === m.me ? 'pvpMine' : 'pvpEnemy');
    if (e.attack === 'critical') {
      const key = m.id + ':' + e.seq;
      if (PVP.lastCritical !== key) {
        PVP.lastCritical = key;
        pvpCriticalCinematic(e, attacker, target, arena);
      }
    } else {
      if (attacker) {
        attacker.classList.remove('pvp-strike');
        void attacker.offsetWidth;
        attacker.classList.add('pvp-strike');
      }
      if (target) {
        target.classList.remove('pvp-hit'); void target.offsetWidth;
        target.classList.add('pvp-hit');
        const marker = document.createElement('b');
        marker.className = 'pvp-damage';
        marker.textContent = '−' + e.damage + (e.guarded ? ' БЛОК' : '');
        target.append(marker); setTimeout(() => marker.remove(), 950);
      }
      if (typeof play === 'function' && SFX.arHit) play('arHit');
    }
  }
  pvpUpdateCombatTimer();
}
/* Full-screen but pointer-transparent critical sequence: charging sprite,
   lunging pet, shockwave, sparks, camera flash and giant damage marker.
   A document-body overlay survives WebSocket rerenders of the arena. */
function pvpCriticalCinematic(hit, attacker, target, arena) {
  if (!attacker || !target || !arena) return;
  const from = attacker.querySelector('.pvp-fighter-art')?.getBoundingClientRect();
  const to = target.querySelector('.pvp-fighter-art')?.getBoundingClientRect();
  if (!from || !to) return;
  const cx = from.left + from.width/2, cy = from.top + from.height/2;
  const tx = to.left + to.width/2, ty = to.top + to.height/2;
  const scene = document.createElement('div');
  scene.className = 'pvp-critical-scene';
  scene.setAttribute('aria-hidden','true');
  const flash = document.createElement('div'); flash.className = 'pvp-critical-flash';
  const label = document.createElement('div'); label.className = 'pvp-critical-label';
  label.textContent = 'КРИТИЧЕСКИЙ УДАР!';
  const fighter = document.createElement('div'); fighter.className = 'pvp-critical-sprite';
  fighter.style.left = cx + 'px'; fighter.style.top = cy + 'px';
  fighter.style.setProperty('--dash-x', (tx-cx) + 'px');
  fighter.style.setProperty('--dash-y', (ty-cy) + 'px');
  const art = attacker.querySelector('.pvp-fighter-art svg');
  if (art) fighter.append(art.cloneNode(true));
  const shock = document.createElement('div'); shock.className = 'pvp-critical-shock';
  shock.style.left = tx + 'px'; shock.style.top = ty + 'px';
  const sparks = document.createElement('div'); sparks.className = 'pvp-critical-sparks';
  sparks.style.left = tx + 'px'; sparks.style.top = ty + 'px';
  for (let i=0; i<18; i++) {
    const spark = document.createElement('i');
    spark.style.setProperty('--angle', i*20 + 'deg');
    spark.style.setProperty('--distance', (80 + (i%3)*27) + 'px');
    sparks.append(spark);
  }
  const damage = document.createElement('div'); damage.className = 'pvp-critical-number';
  damage.style.left = tx + 'px'; damage.style.top = ty + 'px';
  damage.textContent = '−' + hit.damage + ' HP';
  scene.append(flash, label, fighter, shock, sparks, damage);
  document.body.append(scene);
  arena.classList.add('pvp-critical-shake');
  if (typeof play === 'function' && SFX.arWin) play('arWin');
  setTimeout(() => { scene.remove(); arena.classList.remove('pvp-critical-shake'); }, 1700);
}
/* Even the knockout blow must be visible before the result replaces the stage.
   Criticals get a complete cinematic, normal last hits get their floating damage. */
function pvpHoldFinalHit(events, old, next) {
  if (!old || next || !events.some(e => e.type === 'hit')) return;
  pvpCombatEffects(events, old);
  const critical = events.some(e => e.type==='hit' && e.attack==='critical');
  const duration = critical ? 1700 : 900;
  PVP.criticalHoldUntil = Date.now() + duration;
  setTimeout(() => {
    if (Date.now() >= PVP.criticalHoldUntil && pvpOnPage()) pvpPaint();
  }, duration + 30);
}
function pvpUpdateCombatTimer() {
  const m = PVP.state?.active;
  if (!m || !m.combat) return;
  const el = document.getElementById('pvpQteTimer');
  if (el) el.textContent = pvpTimeLeft(m.combat.qte_until) + ' с';
}
route(/^#\/pet\/pvp$/, async () => {
  render(app(), shell('pvp', html`<div id="pvpHost" class="pvp-page"><div class="center muted mt-l"><span class="spinner"></span></div></div>`));
  pvpConnect(); await pvpRefresh();
  if (!PVP.state) pvpPaint();
});
/* Two physically different rooms. Capture old screen coordinates before re-render,
   then fly copies of the SAME pet art into the destination room (FLIP).
   The authoritative server status triggers both clients, not their local clocks. */
function pvpSceneCapture(stage) {
  if (!stage || !stage.dataset || !stage.dataset.pvpScene) return null;
  const pets = {};
  for (const id of ['pvpMine', 'pvpEnemy']) {
    const art = document.getElementById(id)?.querySelector('.pvp-fighter-art');
    if (art) pets[id] = {rect: art.getBoundingClientRect(), content: art.innerHTML};
  }
  return {scene: stage.dataset.pvpScene, match: stage.dataset.pvpMatch, pets};
}
function pvpSceneTransfer(snapshot, toScene, matchId) {
  const newStage = document.getElementById('pvpStage');
  if (!newStage || !snapshot || snapshot.match !== String(matchId) ||
      !((snapshot.scene === 'betting' && toScene === 'reveal') ||
        (snapshot.scene === 'reveal' && toScene === 'betting'))) return;
  const destinations = {};
  for (const id of ['pvpMine', 'pvpEnemy']) {
    const art = document.getElementById(id)?.querySelector('.pvp-fighter-art');
    if (art && snapshot.pets[id]) destinations[id] = art.getBoundingClientRect();
  }
  if (Object.keys(destinations).length !== 2) return;
  const duration = 850;
  const layer = document.createElement('div'); layer.className='pvp-transfer-layer';
  layer.setAttribute('aria-hidden','true');
  const title = document.createElement('div'); title.className='pvp-transfer-title';
  title.textContent = toScene === 'reveal' ? '⚔️ НА ПОЛЕ БОЯ!' : '🪙 ОБРАТНО К ТОРГАМ!';
  layer.append(title); document.body.append(layer);
  PVP.sceneTransitionUntil = Date.now() + duration;
  newStage.classList.add('pvp-transfer-target');
  for (const id of ['pvpMine','pvpEnemy']) {
    const source = snapshot.pets[id], target=destinations[id], r=source.rect;
    if (!r.width || !r.height) continue;
    const pet = document.createElement('div');pet.className='pvp-transfer-pet';
    pet.style.left=r.left+'px';pet.style.top=r.top+'px';
    pet.style.width=r.width+'px';pet.style.height=r.height+'px';
    pet.innerHTML=source.content; layer.append(pet);
    const dx=target.left-r.left, dy=target.top-r.top;
    const scale=target.width/r.width;
    if (typeof pet.animate === 'function') pet.animate([
      {transform:'translate(0,0) scale(1)',offset:0,opacity:1},
      {transform:`translate(${dx*.5}px,${dy*.5-42}px) scale(${Math.max(1.15,scale*1.15)})`,offset:.5,opacity:1},
      {transform:`translate(${dx}px,${dy}px) scale(${scale})`,offset:1,opacity:1}
    ],{duration,easing:'cubic-bezier(.3,.1,.25,1)',fill:'forwards'});
    else pet.style.transform=`translate(${dx}px,${dy}px) scale(${scale})`;
  }
  setTimeout(()=>{
    layer.remove();
    if (document.getElementById('pvpStage')?.dataset.pvpMatch === String(matchId))
      document.getElementById('pvpStage')?.classList.remove('pvp-transfer-target');
    PVP.sceneTransitionUntil = 0;
  },duration+45);
}

function pvpPaint() {
  if (!pvpOnPage() || Date.now() < PVP.criticalHoldUntil) return;
  const host = document.getElementById('pvpHost'); if (!host) return;
  if (!PVP.state) { host.innerHTML = '<div class="card">Нет связи с сервером PvP</div>'; return; }
  const s = PVP.state, m = s.active, previousY = window.scrollY;
  const previousScene = pvpSceneCapture(document.getElementById('pvpStage'));
  host.innerHTML = unraw(html`
    <header class="pvp-head"><div><h2>⚔️ Арена питомцев · Live PvP</h2>
    <p class="muted small">Торги в зале ставок → 15 секунд боя на ринге → обратно к торгам. HP не восстанавливается.</p></div>
    <div class="row gap-s wrap"><button class="btn ghost sm" data-act="pvpGuide" type="button">❔ Как играть?</button><a class="btn ghost sm" href="#/pet">← Питомец</a><a class="btn ghost sm" href="#/pet/arena">Тренировка с ботами</a>
    <span class="px-bal">🪙 <b>${pvpCash(s.balance)}</b></span></div></header>
    ${!s.pet ? html`<div class="card center"><h3>Для арены нужен питомец</h3><p class="muted">Заведи любое животное в разделе «Питомец».</p><a class="btn" href="#/pet">Выбрать питомца</a></div>` :
      s.pet.fullness < 20 && !m ? html`<div class="card"><p>Питомец голоден. Для вызова нужно не менее 20% сытости.</p><a href="#/pet" class="btn">Покормить</a></div>` : ''}
    ${m ? pvpMatch(m,s) : html`${PVP.result ? pvpFinished(PVP.result.match) : ''}${pvpLobby(s)}`}
    ${s.recent?.length ? html`<section class="card pvp-history"><h3>История PvP</h3>${s.recent.map(x => html`<div class="pvp-history-row"><span>${x.status === 'cancelled' ? 'Отменён' : x.winner_id === x.me ? 'Победа' : 'Поражение'} · ${x.other_name}${x.reason ? ' · ' + x.reason : ''}</span><b>${x.status === 'cancelled' ? '' : x.winner_id === x.me ? '+'+pvpCash(x.pot-x.my_total) : '−'+pvpCash(x.my_total)} 🪙</b></div>`)}</section>` : ''}
  `);
  window.scrollTo(0, previousY);
  if (m && (m.status === 'betting' || m.status === 'reveal'))
    pvpSceneTransfer(previousScene, m.status, m.id);
  // State may re-render while an existing move is in progress; keep the target
  // sprite hidden until the overlay actually arrives.
  if (Date.now() < PVP.sceneTransitionUntil)
    document.getElementById('pvpStage')?.classList.add('pvp-transfer-target');
}
function pvpFinished(m) {
  return html`<div class="card pvp-final"><h2>${m.winner_id === m.me ? '🏆 Победа!' : 'Поражение'}</h2>
     <p>${m.winner_id === m.me ? 'Ты забираешь общий банк ' + pvpCash(m.pot) + ' 🪙' : 'Банк ' + pvpCash(m.pot) + ' 🪙 выиграл ' + m.other_name}</p>
     <p>Твой итог: <b>${m.winner_id === m.me ? '+'+pvpCash(m.pot-m.my_total) : '−'+pvpCash(m.my_total)} 🪙</b></p>
     <p class="muted small">${m.reason==='knockout'?'Нокаут (0 HP)':m.reason==='fold'?'Сдача на торгах':m.reason==='timeout_fold'?'Истекло время ответа':'Матч завершён'}. Питомец остаётся у владельца.</p>
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
function pvpHealth(p, mine = true) {
  if (!p) return '';
  const n = Math.max(0, p.hp), cap = p.max || 120;
  return html`<div class="pvp-hp" role="progressbar" aria-label="Здоровье ${mine?'твоего питомца':'противника'}" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${n}">
    <div class="pvp-hp-line"><span>Здоровье</span><b>${n.toFixed(1)} / ${cap}</b></div>
    <div class="pvp-hp-track"><span style="width:${Math.round(100*n/cap)}%"></span></div>
  </div>`;
}
function pvpMatch(m, s) {
  const invited = m.status === 'invited';
  const fighting = m.status === 'reveal';
  const pv1 = m.pet_me || s.pet;
  const combat = m.combat;
  const status = fighting ? '⚔️ ПОЛЕ БОЯ · раунд '+m.round_no : m.status === 'betting' ? '🪙 СТОЛ ТОРГОВ · раунд '+m.round_no : 'ОЖИДАНИЕ ВЫЗОВА';
  return html`<section class="pvp-match"><div class="card pvp-stage ${fighting?'pvp-fighting pvp-click-arena pvp-battle-scene':'pvp-betting-scene'}" id="pvpStage" data-pvp-scene="${m.status}" data-pvp-match="${m.id}" title="${fighting?'ЛКМ по арене — удар питомцем':''}">
    <div class="pvp-room-decor" aria-hidden="true">${fighting ? html`<div class="pvp-ring-lights"></div><div class="pvp-ring-rope pvp-rope-back"></div><div class="pvp-ring-ground"></div><div class="pvp-ring-rope pvp-rope-front"></div>` : html`<div class="pvp-tournament-sign">ЗАЛ ТОРГОВ</div><div class="pvp-poker-table"></div><div class="pvp-table-chips">🪙 🪙 🪙</div>`}</div>
    <div class="pvp-status"><b>${status}</b><span class="muted">${fighting?'До конца 15-секундного боя:':'До следующего этапа:'} <b id="pvpTimer">${pvpTimeLeft(m.deadline)} с</b></span></div>
    <div class="pvp-fighters">
      <div class="pvp-fighter" id="pvpMine">
        <div class="pvp-fighter-art">${raw(pvpPhoto(pv1))}</div><b>${pv1?.name||'Твой питомец'}</b>
        <span class="muted small">${m.me_name}</span><span class="small">Сила ${m.power_me?.toFixed(2)||'—'}</span>
        ${combat?pvpHealth({hp:combat.hp_me,max:combat.hp_max}):''}
      </div>
      <div class="pvp-middle"><span>${fighting?'VS':'🃏'}</span><b>🪙 ${pvpCash(m.pot)}</b><small>${fighting?'Банк матча':'На столе'}</small>
        <div class="pvp-score">Раунд ${m.round_no}</div><small>До нокаута · без лечения</small></div>
      <div class="pvp-fighter" id="pvpEnemy"><div class="pvp-fighter-art">${m.pet_other?raw(pvpPhoto(m.pet_other)):html`<span class="pvp-question">?</span>`}</div>
        <b>${m.pet_other?.name||'Питомец соперника'}</b><span class="muted small">${m.other_name} · ${m.other_online?'онлайн':'не в сети'}</span>
        <span class="small">Сила ${m.power_other?.toFixed(2)||'—'}</span>
        ${combat?pvpHealth({hp:combat.hp_other,max:combat.hp_max},false):''}
      </div>
    </div>
    <div class="pvp-contributions"><span>Вложено тобой: <b>${pvpCash(m.my_total)}</b> 🪙</span><span>Соперником: <b>${pvpCash(m.other_total)}</b> 🪙</span></div>
    </div>
    ${invited ? pvpInvitation(m) : m.status === 'betting' ? pvpBets(m,s) : fighting ? pvpCombatControls(m) : ''}
    </section>`;
}
function pvpCombatControls(m) {
  const c = m.combat;
  if (!c) return html`<div class="card">Подключаем боевую механику…</div>`;
  const activeQte = !!c.qte_code && !c.qte_done && pvpTimeLeft(c.qte_until)>0;
  // Reset local input state after each new prompt (or a new match).
  if (PVP.qteNonce !== c.qte_nonce) { PVP.qteNonce=c.qte_nonce; PVP.qteTyped=''; }
  return html`<div class="card pvp-combat-controls" id="pvpCombatControls">
    <div class="pvp-combat-head"><b>⚔️ Управляй питомцем!</b><span class="muted small">ЛКМ по арене или по кнопке — удар · K — блок</span></div>
    <div class="pvp-energy"><span>Энергия: ${Math.round(c.energy)} / 100</span><div class="pvp-energy-track"><span style="width:${c.energy}%"></span></div></div>
    ${activeQte ? html`<div class="pvp-qte" role="alert" aria-live="assertive">
      <strong>⚡ ВНЕЗАПНЫЙ КРИТИЧЕСКИЙ УДАР!</strong><span class="pvp-qte-instruction">Успей набрать английские клавиши по порядку:</span>
      <div class="pvp-qte-letters">${[...c.qte_code].map((letter,i)=>html`<span class="${i<PVP.qteTyped.length?'done':''}">${letter}</span>`)}</div>
      <p>Осталось <b id="pvpQteTimer">${pvpTimeLeft(c.qte_until)} с</b>. Ошибка сбрасывает комбинацию.</p>
      <div class="pvp-qte-buttons">${[...c.qte_code].map((letter,i)=>html`<button type="button" class="btn sm ghost" data-act="pvpQteLetter" data-letter="${letter}">${letter}</button>`)}</div>
    </div>` : c.qte_code && c.qte_done ? html`<p class="pvp-qte-done">Критический удар нанесён!</p>` : html`<p class="small muted">Следи за экраном: обоим игрокам внезапно появятся комбинации из 1–3 английских букв.</p>`}
    <div class="pvp-attack-buttons">
      <button class="btn pvp-attack" id="pvpAttackButton" type="button">⚔️ УДАР <small>Только ЛКМ / касание</small></button>
      <button class="btn ghost pvp-defend" data-act="pvpGuard" type="button">🛡️ БЛОК <small>K</small></button>
    </div><p class="muted small">Урон виден над питомцами. Каждая атака расходует энергию. Между раундами HP сохраняется.</p>
  </div>`;
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
    if (m) pvpCombatEffects(pvpNewCombatEvents(m),m);
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

/* Player guide is available throughout the PvP mode. It never changes match state. */
const PVP_GUIDE = html`<div class="pvp-guide">
  <h2 id="pvpGuideTitle">Как играть в Live PvP</h2>
  <p><b>1. Вызов.</b> Выбери друга и стартовую ставку. Жетоны сразу резервируются. Если друг отклонит приглашение или не ответит вовремя, они вернутся.</p>
  <p><b>2. Торги.</b> Повышай ставку, уравнивай ставку противника или сдавайся. После уравнивания или двух пропусков питомцы перемещаются со стола торгов на отдельное поле боя на 15 секунд. При сдаче уже вложенные жетоны получает соперник.</p>
  <p><b>3. Удары.</b> Обычные удары наносятся <b>только по нажатию ЛКМ</b> по арене или кнопке «УДАР» (на телефоне — касанием). Питомцы самостоятельно не атакуют. K или кнопка «БЛОК» включают защиту. Каждый удар расходует энергию.</p>
  <p><b>4. Критический удар.</b> Обоим игрокам внезапно появляются разные комбинации из <b>1–3 английских букв</b>. Набери их до истечения времени: питомец сделает стремительный рывок с мощным эффектом попадания и большим уроном. Ошибка сбрасывает ввод. Критический удар совершается только при успешном вводе.</p>
  <p><b>5. Здоровье и победа.</b> Точный урон и HP видны в бою. После <b>15 секунд</b> питомцы возвращаются с поля боя к торгам, но <b>HP не восстанавливается</b>. Бой заканчивается, когда один питомец теряет все HP (0 HP) или игрок сдаётся. Победитель получает весь банк.</p>
  <p class="muted small">Вид питомца не даёт бонусов. На урон влияют сила, небольшой случайный разброс и действия игроков. Проигрыш в бою не удаляет питомца из аккаунта.</p>
  <button class="btn" data-act="pvpGuideClose" type="button">Понятно</button>
</div>`;
actions.pvpGuide = () => { openModal(PVP_GUIDE); };
actions.pvpGuideClose = () => closeModal();
function pvpCombatKey(e) {
  if (!pvpOnPage() || e.repeat || !PVP.state?.active || PVP.state.active.status !== 'reveal') return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^(input|textarea|select)$/i.test(e.target?.tagName||'')) return;
  const modal = document.getElementById('modal-root');
  if (modal && modal.childElementCount) return;
  const c = PVP.state.active.combat;
  const key = e.key.toUpperCase();
  if (c?.qte_code && !c.qte_done && pvpTimeLeft(c.qte_until)>0 && /^[A-Z]$/.test(key)) {
    e.preventDefault(); pvpPressQteKey(key); return;
  }
  if (key === 'K') { e.preventDefault(); pvpSendCombat('guard'); }
}
document.addEventListener('keydown', pvpCombatKey);
actions.pvpQteLetter = b => pvpPressQteKey(b.dataset.letter);
function pvpPressQteKey(key) {
  const m=PVP.state?.active, c=m?.combat;
  if (!m || m.status!=='reveal' || !c?.qte_code || c.qte_done || PVP.qteBusy || pvpTimeLeft(c.qte_until)<=0) return;
  const expected=c.qte_code, typed=PVP.qteTyped;
  const correct = expected[typed.length] === key;
  PVP.qteTyped = correct ? typed + key : (expected[0] === key ? key : '');
  const card = document.querySelector('.pvp-qte');
  if (card && !correct) { card.classList.remove('pvp-qte-error'); void card.offsetWidth; card.classList.add('pvp-qte-error'); }
  const chars=document.querySelectorAll('.pvp-qte-letters>span');
  chars.forEach((el,i)=>el.classList.toggle('done',i<PVP.qteTyped.length));
  if (PVP.qteTyped===expected) {
    PVP.qteBusy=true;
    api('/pet/pvp/qte',{json:{match_id:m.id,nonce:c.qte_nonce,sequence:expected,request_id:pvpRequestId()}})
      .then(data=>pvpCombatAcceptState(data)).catch(e=>toast(e.message,{icon:'⚠️'}))
      .finally(()=>{PVP.qteBusy=false;PVP.qteTyped='';pvpRefresh();});
  }
}
function pvpCombatAcceptState(data) {
  const old = PVP.state?.active;
  const eventSource=data.active || (old && data.recent?.find(x=>x.id===old.id));
  const events=pvpNewCombatEvents(eventSource);
  pvpHoldFinalHit(events,old,data.active);
  if (old && !data.active && data.recent?.length && data.recent[0].id === old.id && data.recent[0].status === 'finished') {
    PVP.result = {match: data.recent[0], until: Date.now()+12000};
    if (typeof play === 'function') play(data.recent[0].winner_id === data.recent[0].me?'arWin':'arLose');
  }
  PVP.state=data; PVP.skew=Date.now()/1000-data.server_now; S.balance=data.balance;
  PVP.lastRefresh=Date.now(); if(pvpOnPage() && Date.now()>=PVP.criticalHoldUntil){pvpPaint();pvpCombatEffects(events,data.active);}
}
function pvpSendCombat(move) {
  const m=PVP.state?.active;
  if (!m || m.status!=='reveal' || PVP.combatBusy || Date.now() < PVP.sceneTransitionUntil) return;
  if (Date.now()-PVP.lastCombat < (move==='attack'?320:900)) return;
  PVP.lastCombat=Date.now(); PVP.combatBusy=true;
  api('/pet/pvp/combat',{json:{match_id:m.id,move,request_id:pvpRequestId()}})
    .then(pvpCombatAcceptState)
    .catch(e=>{if(e.status!==429 && e.status!==409)toast(e.message,{icon:'⚠️'});})
    .finally(()=>{PVP.combatBusy=false;});
}
/* Ordinary hits are mouse-left/touch events only. Keydown, right-click and
   keyboard-generated button clicks never call this function. */
function pvpPointerAttack(e) {
  if (!pvpOnPage() || !PVP.state?.active || PVP.state.active.status !== 'reveal') return;
  if (e.button !== 0 || e.isPrimary === false || e.ctrlKey || e.altKey || e.metaKey) return;
  const button = e.target.closest?.('#pvpAttackButton');
  const stage = e.target.closest?.('#pvpStage');
  if (!button && !stage) return;
  if (!button && e.target.closest?.('button,a,input,textarea,select,[data-act]')) return;
  const modal = document.getElementById('modal-root');
  if (modal && modal.childElementCount) return;
  e.preventDefault();
  pvpSendCombat('attack');
}
document.addEventListener('pointerdown', pvpPointerAttack);
actions.pvpGuard=()=>pvpSendCombat('guard');
