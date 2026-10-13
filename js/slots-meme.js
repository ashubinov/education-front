/* LearnQuest — MEME SLOTS. Выплаты только с сервера. Медиа — локальные файлы. */
'use strict';

const MM = {
  st: null, board: [], bet: 20, spinning: false, busy: false,
  generation: 0, pendingId: null, pendingBet: null, grid: [],
  intervals: [], timeouts: [], video: null, reactionActive: false,
  voice: true, effects: true, voiceQueue: [], lastClip: null,
};
const MM_SYMBOLS = ['rage', 'hype', 'shocked', 'smile', 'suspicious', 'quiet',
  'facepalm', 'risky', 'laugh', 'wild', 'scatter', 'bonus'];
// На ЛЮБУЮ прибыльную комбинацию — произвольное видео из общего пула.
// Отсутствие выигрыша или неокупившаяся ставка: БЕЗ видео и звука.
const MM_WIN_CLIPS = Object.freeze([
  'win_01', 'win_02', 'win_03', 'big_win_01', 'big_win_02',
]);
/* MEME SPIN SFX v3: synthesized reel sounds, independent of outcome and voice reactions.
   Uses the existing LearnQuest sound engine: play() respects S.user.sound.
   There is no failure sound; only the sounds of physical reels moving and stopping. */
Object.assign(SFX, {
  memeSpinStart: () => tone([294, 392, 494], .055, 'triangle', .042),
  memeSpinTick: () => tone([210], .022, 'square', .015),
  memeReelStop: () => tone([523, 784], .040, 'triangle', .045),
});
function mmSpinSfx(name) {
  if (MM.effects && MM.spinning && mmAlive(MM.generation)) play(name);
}
const MM_ASSET = 'assets/slots/meme/';
const mmPoster = id => MM_ASSET + 'symbols/' + encodeURIComponent(id) + '.webp';
const mmVideo = id => MM_ASSET + 'reactions/' + encodeURIComponent(id) + '.webm';
const mmFmt = n => Number(n).toLocaleString('ru-RU');
const mmNewId = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return 'm' + [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
const mmStoredBet = () => { try { return +localStorage.getItem('lq_meme_bet') || 20; } catch (e) { return 20; } };
const mmAlive = g => MM.generation === g && location.hash === '#/slots/meme' && !!$('#mmMachine');
const mmRandom = () => MM_SYMBOLS[Math.floor(Math.random() * MM_SYMBOLS.length)];
function mmCell(id, n) {
  // id всегда приходит только из серверного enum, дополнительная проверка защищает от разметки.
  const safe = MM_SYMBOLS.includes(id) ? id : 'quiet';
  return `<div class="mm-cell" data-symbol="${safe}"><img src="${mmPoster(safe)}" alt="" draggable="false" decoding="async"><span class="mm-symbol-title">${safe === 'wild' ? 'WILD' : safe === 'scatter' ? 'SCATTER' : safe === 'bonus' ? 'BONUS' : ''}</span></div>`;
}
const mmReel = (col, i) => `<div class="mm-reel" data-column="${i}">${col.map(mmCell).join('')}</div>`;
const mmValidBet = n => MM.st && Number.isInteger(n) && n >= MM.st.min_bet && n <= MM.st.max_bet && n % MM.st.bet_step === 0;
const mmWait = ms => new Promise(resolve => { const t = setTimeout(resolve, ms); MM.timeouts.push(t); });
const mmName = id => MM.st?.meta?.symbols?.find(s => s.id === id)?.name || id;

route(/^#\/slots\/meme$/, async () => { await mmDraw(); });

async function mmDraw() {
  const g = ++MM.generation;
  mmStop();
  try { MM.voice = localStorage.getItem('lq_meme_voice') !== '0'; } catch (e) { MM.voice = true; }
  try { MM.effects = localStorage.getItem('lq_meme_spin_sfx') !== '0'; } catch (e) { MM.effects = true; }
  MM.spinning = false;
  render(app(), shell('slots', html`<div class="center mt-l"><span class="spinner"></span></div>`));
  let state, board;
  try {
    [state, board] = await Promise.all([api('/slots/meme/state'), api('/slots/leaderboard').catch(() => [])]);
  } catch (e) {
    if (MM.generation === g && location.hash === '#/slots/meme') {
      render(app(), shell('slots', html`<div class="card"><h2>Мемные слоты временно недоступны</h2><p>${e.message}</p><a class="btn" href="#/slots">Собачьи слоты</a></div>`));
    }
    return;
  }
  if (MM.generation !== g || location.hash !== '#/slots/meme') return;
  MM.st = state; MM.board = board; MM.bet = mmValidBet(mmStoredBet()) ? mmStoredBet() : 20;
  MM.grid = state.history[0]?.reels || [
    ['rage','quiet','laugh'], ['shocked','risky','smile'], ['wild','hype','facepalm'],
    ['suspicious','scatter','quiet'], ['laugh','bonus','rage'],
  ];
  render(app(), shell('slots', html`
    <div class="mm-page">
      <nav class="mm-game-switch" aria-label="Выбор автомата">
        <a href="#/slots" class="mm-switch-link">🐾 Лапа удачи</a>
        <a href="#/slots/meme" class="mm-switch-link current" aria-current="page">🎬 MEME SLOTS</a>
      </nav>
      <div class="mm-main">
        <section class="mm-machine" id="mmMachine" aria-label="Мемный автомат">
          <div class="mm-lights" aria-hidden="true"></div>
          <div class="mm-logo"><span class="mm-kicker">МЕМНЫЙ АВТОМАТ</span><h1>MEME <b>SLOTS</b></h1><div class="mm-sub">ВИРТУАЛЬНЫЕ ЖЕТОНЫ · 5×3 · 10 ЛИНИЙ</div></div>
          <div class="mm-screen"><div class="mm-grid" id="mmGrid">${raw(MM.grid.map(mmReel).join(''))}</div><div class="mm-win-mark" id="mmWinMark" aria-live="polite"></div></div>
          <p class="mm-result" id="mmResult" aria-live="polite">При выигрыше появится случайная видеореакция · Пробел — SPIN</p>
          <div class="mm-actions">
            <div class="mm-balance"><small>БАЛАНС</small><strong id="mmBalance">🪙 ${mmFmt(state.balance)}</strong></div>
            <button class="mm-spin" type="button" id="mmSpin" data-act="memeSpin" aria-label="Крутить барабаны">SPIN<span id="mmSpinSub">−${mmFmt(MM.bet)}</span></button>
            <div class="mm-stake"><small>СТАВКА</small><div class="mm-stake-row"><button class="mm-bet-btn" data-act="memeBet" data-step="-1" aria-label="Уменьшить ставку">−</button><button id="mmBet" class="mm-bet-val" data-act="memeEditBet" title="Задать свою ставку">${mmFmt(MM.bet)}</button><button class="mm-bet-btn" data-act="memeBet" data-step="1" aria-label="Увеличить ставку">+</button></div></div>
          </div>
          <div class="mm-footer"><label><input id="mmVoice" type="checkbox" ${MM.voice ? 'checked' : ''}> Голосовые реакции</label><label><input id="mmSpinSfx" type="checkbox" ${MM.effects ? 'checked' : ''}> Звуки барабанов</label><span>Монеты не являются деньгами</span></div>
          <div class="mm-reaction" id="mmReaction" hidden aria-live="off"></div>
        </section>
        <aside class="mm-side" id="mmSide"></aside>
      </div>
    </div>`));
  mmRefreshControls(); mmSide();
  $('#mmVoice').addEventListener('change', e => {
    MM.voice = e.target.checked;
    try { localStorage.setItem('lq_meme_voice', MM.voice ? '1' : '0'); } catch (x) { /* ignore */ }
    if (MM.video) MM.video.muted = !MM.voice || !S.user?.sound;
  });
  $('#mmSpinSfx').addEventListener('change', e => {
    MM.effects = e.target.checked;
    try { localStorage.setItem('lq_meme_spin_sfx', MM.effects ? '1' : '0'); } catch (x) { /* ignore */ }
  });
  const onKey = e => { if (e.code === 'Space' && !e.repeat && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement?.tagName || '')) { e.preventDefault(); actions.memeSpin(); } };
  document.addEventListener('keydown', onKey);
  S.onLeave = () => { document.removeEventListener('keydown', onKey); MM.generation++; mmStop(); MM.spinning = false; };
}

function mmStop() {
  for (const t of MM.intervals) clearInterval(t);
  for (const t of MM.timeouts) clearTimeout(t);
  MM.intervals = []; MM.timeouts = [];
  if (MM.video) { MM.video.pause(); MM.video.removeAttribute('src'); MM.video.load(); MM.video = null; }
  MM.reactionActive = false;
}

function mmRefreshControls() {
  const b = $('#mmSpin'); if (!b || !MM.st) return;
  b.disabled = MM.spinning || MM.reactionActive || MM.st.balance < MM.bet;
  $('#mmSpinSub').textContent = MM.spinning ? 'КРУТИМ' : MM.reactionActive ? 'РЕАКЦИЯ' : MM.st.balance < MM.bet ? 'МАЛО ЖЕТОНОВ' : '−' + mmFmt(MM.bet);
  $('#mmBet').textContent = mmFmt(MM.bet);
  $$('.mm-bet-btn').forEach(el => el.disabled = MM.spinning);
  $('#mmBet').disabled = MM.spinning;
}
function mmMsg(text) { const el = $('#mmResult'); if (el) el.textContent = text; }
function mmSetBet(n) {
  if (MM.spinning || !mmValidBet(n)) return;
  MM.bet = n;
  try { localStorage.setItem('lq_meme_bet', String(n)); } catch (e) { /* ignore */ }
  mmRefreshControls();
  if ($('#mmSide')) mmSide();
}
actions.memeBet = b => {
  if (MM.spinning) return;
  const bets = MM.st.bets;
  const pos = bets.indexOf(MM.bet);
  let candidate;
  if (Number(b.dataset.step) < 0) candidate = bets.filter(v => v < MM.bet).pop() || MM.st.min_bet;
  else candidate = bets.find(v => v > MM.bet) || MM.st.max_bet;
  mmSetBet(candidate);
};
actions.memeEditBet = async () => {
  if (MM.spinning) return;
  const answer = prompt(`Ставка: ${MM.st.min_bet}–${mmFmt(MM.st.max_bet)}, кратно ${MM.st.bet_step}`, String(MM.bet));
  if (answer === null) return;
  const value = +String(answer).trim().replace(/\s/g, '');
  if (!mmValidBet(value)) { toast(`Выбери сумму от ${MM.st.min_bet} до ${mmFmt(MM.st.max_bet)} кратно ${MM.st.bet_step}`); return; }
  mmSetBet(value);
};

function mmClip() {
  // Перемешанная колода без повторения предыдущей реакции.
  if (!MM.voiceQueue.length) {
    MM.voiceQueue = [...MM_WIN_CLIPS];
    for (let i = MM.voiceQueue.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [MM.voiceQueue[i], MM.voiceQueue[j]] = [MM.voiceQueue[j], MM.voiceQueue[i]];
    }
    if (MM.voiceQueue.length > 1 && MM.voiceQueue[MM.voiceQueue.length - 1] === MM.lastClip) {
      [MM.voiceQueue[0], MM.voiceQueue[MM.voiceQueue.length - 1]] = [MM.voiceQueue[MM.voiceQueue.length - 1], MM.voiceQueue[0]];
    }
  }
  const chosen = MM.voiceQueue.pop();
  MM.lastClip = chosen;
  return chosen;
}
function mmClearReaction() {
  if (MM.video) { MM.video.pause(); MM.video.removeAttribute('src'); MM.video.load(); MM.video = null; }
  const el = $('#mmReaction'); if (el) { el.hidden = true; el.replaceChildren(); }
  MM.reactionActive = false; mmRefreshControls();
}
actions.memeCloseReaction = () => mmClearReaction();
function mmShowReaction(res, g) {
  if (!mmAlive(g)) return;
  // Нулевой или убыточный результат: никаких видео, постеров или голосовых реакций.
  if (res.net <= 0) return;
  mmClearReaction();
  const box = $('#mmReaction'); if (!box) return;
  MM.reactionActive = true;
  const clip = mmClip();
  // Разметка здесь только из статических строк и чисел, не из пользовательского HTML.
  box.innerHTML = `<div class="mm-reaction-dim"></div><div class="mm-reaction-inner"><div class="mm-reaction-title">WIN!</div><div class="mm-reaction-visual"><video id="mmReactionVideo" playsinline preload="auto" disablepictureinpicture aria-label="Мемная видеореакция"></video><img class="mm-reaction-poster" src="${MM_ASSET}posters/${clip}.webp" alt="Реакция"><button class="mm-activate-sound" id="mmActivateSound" type="button" hidden>▶ Нажми для видео со звуком</button></div><div class="mm-reaction-win">+${mmFmt(res.net)} 🪙</div><button type="button" class="mm-reaction-dismiss" data-act="memeCloseReaction">ПРОПУСТИТЬ ✕</button></div>`;
  box.hidden = false; mmRefreshControls();
  const video = $('#mmReactionVideo'); MM.video = video;
  video.src = mmVideo(clip); video.muted = !MM.voice || !S.user?.sound;
  video.volume = 0.82;
  const poster = box.querySelector('.mm-reaction-poster');
  video.addEventListener('playing', () => { if (mmAlive(g)) poster.hidden = true; }, {once:true});
  video.addEventListener('ended', () => { if (mmAlive(g)) MM.timeouts.push(setTimeout(() => mmClearReaction(), 400)); }, {once:true});
  video.addEventListener('error', () => { if (mmAlive(g)) MM.timeouts.push(setTimeout(() => mmClearReaction(), 2500)); }, {once:true});
  video.play().catch(() => {
    if (!mmAlive(g)) return;
    const b = $('#mmActivateSound'); if (b) {
      b.hidden = false;
      b.addEventListener('click', () => {
        b.hidden = true;
        video.play().catch(() => { mmMsg('Не удалось воспроизвести видео — проверь настройки браузера'); mmClearReaction(); });
      }, {once:true});
    }
  });
  // Не допускаем зависания оверлея при недоступном видеоресурсе.
  MM.timeouts.push(setTimeout(() => { if (mmAlive(g) && MM.video === video) mmClearReaction(); }, 12000));
}

function mmPaintGrid(grid) {
  if (!$('#mmGrid')) return;
  const cols = $$('#mmGrid .mm-reel');
  cols.forEach((node, idx) => { node.innerHTML = grid[idx].map(mmCell).join(''); });
}
function mmAnimate(grid, g) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { mmPaintGrid(grid); return Promise.resolve(); }
  return new Promise(resolve => {
    const starts = performance.now(); const stopped = Array(5).fill(false);
    let lastTickAt = -Infinity;
    const timer = setInterval(() => {
      if (!mmAlive(g)) { clearInterval(timer); resolve(); return; }
      const elapsed = performance.now() - starts;
      if (elapsed - lastTickAt >= 170 && elapsed < 1480) {
        mmSpinSfx('memeSpinTick');
        lastTickAt = elapsed;
      }
      const reels = $$('#mmGrid .mm-reel');
      for (let i=0;i<5;i++) {
        if (stopped[i]) continue;
        if (elapsed >= 650 + i*270) {
          reels[i].innerHTML = grid[i].map(mmCell).join('');
          reels[i].classList.remove('rolling'); reels[i].classList.add('settle');
          stopped[i] = true;
          mmSpinSfx('memeReelStop');
        } else {
          reels[i].classList.add('rolling');
          reels[i].innerHTML = [mmRandom(),mmRandom(),mmRandom()].map(mmCell).join('');
        }
      }
      if (stopped.every(Boolean)) { clearInterval(timer); resolve(); }
    }, 90);
    MM.intervals.push(timer);
  });
}
function mmMarkWin(res) {
  const positions = [
    ...(res.lines || []).flatMap(l => l.positions),
    ...(res.scatter?.positions || []), ...(res.bonus?.positions || []),
  ];
  positions.forEach(([col, row]) => {
    const cell = $(`#mmGrid .mm-reel:nth-child(${col+1}) .mm-cell:nth-child(${row+1})`);
    if (cell) cell.classList.add('lit');
  });
}

actions.memeSpin = async () => {
  if (MM.spinning || MM.reactionActive || !MM.st || MM.st.balance < MM.bet || !$('#mmMachine')) return;
  const g = MM.generation;
  MM.spinning = true; mmRefreshControls();
  mmMsg('Крутим барабаны…');
  // The first sound is triggered inside the user's click/keydown event.
  // This unlocks Web Audio before waiting for the server response.
  mmSpinSfx('memeSpinStart');
  $$('#mmGrid .mm-cell.lit').forEach(x => x.classList.remove('lit'));
  if (MM.pendingBet !== MM.bet) MM.pendingId = null;
  MM.pendingId ||= mmNewId(); MM.pendingBet = MM.bet;
  let res;
  try { res = await api('/slots/meme/spin', {json:{bet:MM.bet,request_id:MM.pendingId}}); }
  catch (e) {
    if (!mmAlive(g)) return;
    if (e.status && e.status !== 429) MM.pendingId = null;
    mmMsg(e.status === 429 ? 'Дождись окончания вращения и попробуй снова' : e.message);
    MM.spinning = false; mmRefreshControls();
    if (e.status === 400) mmLoadState(g);
    return;
  }
  MM.pendingId = null;
  if (!mmAlive(g)) return;
  const before = res.balance - res.payout;
  MM.st.balance = before;
  $('#mmBalance').textContent = '🪙 ' + mmFmt(before);
  await mmAnimate(res.reels, g);
  if (!mmAlive(g)) return;
  MM.grid = res.reels;
  MM.st.balance = res.balance;
  $('#mmBalance').textContent = '🪙 ' + mmFmt(res.balance);
  if (res.net > 0) mmMarkWin(res);
  mmMsg(res.net > 0 ? `Чистый выигрыш: +${mmFmt(res.net)} жетонов` :
        res.payout > 0 ? `Выплата ${mmFmt(res.payout)} жетонов не покрыла ставку` :
        'Без выигрыша. Попробуй ещё!');
  MM.spinning = false;
  if (res.balance < MM.bet && res.balance >= MM.st.min_bet) {
    mmSetBet(Math.floor(res.balance / MM.st.bet_step) * MM.st.bet_step);
  }
  if (res.net > 0) mmShowReaction(res, g);
  // Не ждём видео для обновления истории и баланса с сервера.
  mmLoadState(g);
};

function mmSide() {
  const box = $('#mmSide'); if (!box || !MM.st) return;
  const st = MM.st, stat = st.stats;
  box.innerHTML = unraw(html`
    <div class="card mm-info"><div class="mm-info-title">ТВОИ РЕЗУЛЬТАТЫ</div>
      <div class="mm-stats"><div><b>${mmFmt(stat.spins)}</b><small>вращений</small></div><div><b>${mmFmt(stat.best_win)}</b><small>лучший выигрыш</small></div><div><b>${mmFmt(stat.won_total)}</b><small>всего выплат</small></div><div><b>${Math.round(stat.win_rate*100)}%</b><small>побед</small></div></div>
    </div>
    <div class="card mm-info"><div class="mm-info-title">🎁 БОНУС И ЖЕТОНЫ</div>
      <p class="small muted">Баланс общий для двух автоматов и всех мини-игр.</p>
      ${st.daily.available ? html`<button data-act="memeDaily" class="btn good block">Забрать +${st.daily.amount} 🪙</button>` : html`<p class="small muted">Ежедневный бонус уже получен.</p>`}
      <a class="btn ghost block mt" href="#/slots">Обменять XP на жетоны</a>
    </div>
    <div class="card mm-info"><div class="mm-info-title">ИСТОРИЯ MEME SLOTS</div>
      <div class="mm-history">${st.history.length ? st.history.map(h => html`<div class="mm-history-row"><span>${h.net > 0 ? '🎉' : '🎬'} −${mmFmt(h.bet)}</span><b class="${h.net>=0?'positive':'negative'}">${h.net>=0?'+':''}${mmFmt(h.net)}</b></div>`) : html`<p class="small muted">Пока нет вращений.</p>`}</div>
    </div>
    <details class="card mm-info"><summary class="mm-info-title">ТАБЛИЦА ВЫПЛАТ</summary><div class="mm-paylist">
      ${st.meta.symbols.filter(s => s.pays).map(s => html`<div class="mm-payrow"><img src="${mmPoster(s.id)}" alt=""><span>${s.name}</span><b>${s.pays.map((p,i) => `${i+3}×: ${mmFmt(p*MM.bet/10)}`).join(' · ')}</b></div>`)}
      <div class="mm-payrow"><span>SCATTER</span><b>3: ${mmFmt(MM.bet)} · 4: ${mmFmt(MM.bet*5)} · 5: ${mmFmt(MM.bet*25)}</b></div>
      <div class="mm-payrow"><span>BONUS</span><b>3+ символа — случайная награда</b></div>
      </div><p class="small muted mt">10 линий. Шансы и выплаты те же, что у собачьего автомата «Лапа удачи». Цифры — для текущей ставки. Все исходы определяет сервер.</p></details>
    <div class="card mm-info"><div class="mm-info-title">🏆 ОБЩИЙ РЕЙТИНГ СЛОТОВ</div>
      ${MM.board.slice(0,8).map((u,i) => html`<div class="mm-history-row"><span>${i+1}. ${u.display_name}</span><b>${mmFmt(u.best_win)}</b></div>`)}
    </div>`);
}
async function mmLoadState(g) {
  try {
    const st = await api('/slots/meme/state');
    if (!mmAlive(g)) return;
    MM.st = st;
    $('#mmBalance').textContent = '🪙 ' + mmFmt(st.balance);
    mmSide(); mmRefreshControls();
  } catch (e) { /* не скрываем результат: сервер уже сохранил вращение */ }
}
actions.memeDaily = async b => {
  if (MM.spinning) return;
  b.disabled = true;
  const g = MM.generation;
  try { const r = await api('/slots/daily', {method:'POST'}); if (mmAlive(g)) { toast('+'+r.amount+' жетонов', {icon:'🎁'}); await mmLoadState(g); } }
  catch(e) { if (mmAlive(g)) { toast(e.message); b.disabled = false; } }
};
