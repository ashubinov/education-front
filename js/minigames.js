/* LearnQuest — Mini Games / Strawberry Thief.
   The server enforces the 30% limit, locks stolen chips, and decides the guess. */
'use strict';

const MG = {
  userId: null, pendingCount: 0, notified: new Set(), pendingRequests: new Map(),
  awaitingGuess: new Map(), interval: null, state: null, openedFromNotice: null,
  busy: false, lastCheck: 0,
};

function mgId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
}

function mgFmt(n) { return Number(n || 0).toLocaleString('ru-RU'); }
function mgDuration(n) {
  const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = Math.ceil(n % 60);
  return h ? `${h} ч ${m} мин` : m ? `${m} мин ${s} сек` : `${s} сек`;
}
/* Переключатель игр на странице «Мини-игры»: клубничный вор / ОТПЕТУНИВАНИЕ (выбор запоминается). */
function mgSetTab(tab) {
  MG.tab = tab === 'petun' ? 'petun' : 'strawberry';
  try { localStorage.setItem('lq_mg_tab', MG.tab); } catch (e) { /* ignore */ }
  mgApplyTab();
}
function mgApplyTab() {
  if (!MG.tab) { try { MG.tab = localStorage.getItem('lq_mg_tab') === 'petun' ? 'petun' : 'strawberry'; } catch (e) { MG.tab = 'strawberry'; } }
  document.querySelectorAll('.mg-tabs button').forEach(b => { const on = b.dataset.tab === MG.tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('[data-game]').forEach(el => { el.hidden = el.dataset.game !== MG.tab; });
}
actions.mgTab = b => mgSetTab(b.dataset.tab);
function mgNotificationBadge() {
  const tabs = { strawberry: MG.pendingCount, petun: typeof PTN !== 'undefined' ? PTN.pendingCount : 0 };
  document.querySelectorAll('.mg-tab-badge').forEach(el => { const n = tabs[el.dataset.tab] || 0; el.hidden = !n; el.textContent = n || ''; });
  document.querySelectorAll('.mg-nav-badge').forEach(el => {
    const n = MG.pendingCount + (typeof PTN !== 'undefined' ? PTN.pendingCount : 0);
    el.hidden = !n;
    el.textContent = n || '';
  });
}

function minigamesBoot() {
  if (MG.interval) return;
  MG.interval = setInterval(() => { if (!document.hidden) mgCheck(); }, 7500);
  setTimeout(mgCheck, 1800);
  window.addEventListener('focus', mgCheck);
}

async function mgCheck() {
  if (!S.user) return;
  if (MG.userId !== S.user.id) {
    MG.userId = S.user.id; MG.notified.clear(); MG.pendingCount = 0;
  }
  if (MG.lastCheck && Date.now() - MG.lastCheck < 1300) return;
  MG.lastCheck = Date.now();
  try {
    if (typeof petunCheck === 'function') petunCheck();   // «Отпетунивание»: свои уведомления
    const data = await api('/minigames/strawberry/status');
    if (!S.user || MG.userId !== S.user.id) return;
    MG.pendingCount = data.pending_count;
    mgNotificationBadge();
    if (data.latest_pending_id && !MG.notified.has(data.latest_pending_id)) {
      MG.notified.add(data.latest_pending_id);
      mgNotify(data.latest_pending_id);
    }
  } catch (e) { /* offline or feature not yet deployed — do not disturb normal pages */ }
}

function mgNotify(id) {
  const root = document.querySelector('#toasts');
  if (!root) return;
  const note = document.createElement('div');
  note.className = 'toast mg-notice';
  const heading = document.createElement('b');
  heading.textContent = '🍓 Тебя отклубничили!';
  const sub = document.createElement('span');
  sub.textContent = 'Попробуй угадать, кто украл жетоны.';
  const btn = document.createElement('button');
  btn.className = 'btn sm'; btn.type = 'button'; btn.textContent = 'Угадать вора';
  btn.onclick = () => {
    note.remove(); MG.openedFromNotice = id; mgSetTab('strawberry');
    if (location.hash === '#/minigames') mgOpenPending(id);
    else location.hash = '#/minigames';
  };
  note.append(heading, sub, btn); root.appendChild(note);
  setTimeout(() => note.remove(), 16000);
}

route(/^#\/minigames$/, async () => {
  render(app(), shell('minigames', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  await mgRender();
});

async function mgRender() {
  const data = await api('/minigames/strawberry/state');
  if (location.hash !== '#/minigames') return;
  MG.state = data;
  MG.pendingCount = data.pending.length;
  mgNotificationBadge();
  const locked = data.cooldown_remaining > 0 || data.has_active_theft;
  const initialFriend = data.friends[0];
  render(app(), shell('minigames', html`
    <div class="mg-page">
      <header class="mg-hero"><span class="mg-berry">🎲</span><div>
        <h1>Мини-игры</h1><p>Игры с друзьями: <b>«Клубничный вор»</b> и <b>«ОТПЕТУНИВАНИЕ»</b>.</p>
      </div></header>
      <nav class="mg-tabs" aria-label="Выбор игры"><button type="button" data-act="mgTab" data-tab="strawberry">🍓 Клубничный вор<i class="mg-tab-badge" data-tab="strawberry" hidden></i></button><button type="button" data-act="mgTab" data-tab="petun">🐓 ОТПЕТУНИВАНИЕ<i class="mg-tab-badge" data-tab="petun" hidden></i></button></nav>
      <div class="mg-layout" data-game="strawberry">
        <section class="card mg-game">
          <h2>🍓 Клубничный вор</h2>
          <p class="muted">Выбери друга и нажми «Отклубничить». Часть его жетонов будет заморожена у тебя до разгадки. Друг может угадать вора в течение 24 часов.</p>
          <div class="mg-chips">Доступно: <strong id="mgBalance">${mgFmt(data.balance)} 🪙</strong><span>Заморожено: <b>${mgFmt(data.frozen)} 🪙</b></span></div>
          <label class="mg-label" for="mgVictim">Кого отклубничить?</label>
          <select id="mgVictim" ${data.friends.length ? '' : 'disabled'}>
            ${data.friends.map(f => html`<option value="${f.id}">${f.name} (@${f.username})</option>`)}</select>
          <label class="mg-label" for="mgAmount">Сколько жетонов украсть?</label>
          <input id="mgAmount" class="mg-amount-input" type="number" inputmode="numeric" step="1" min="1"
            max="${initialFriend?.max_steal || 0}" value="${initialFriend?.max_steal ? Math.min(10, initialFriend.max_steal) : ''}" aria-describedby="mgAmountHint">
          <p class="small muted mg-max-hint" id="mgAmountHint">Максимум для выбранного друга: ${mgFmt(initialFriend?.max_steal || 0)} 🪙 (30% доступного баланса).</p>
          <button class="btn mg-steal" id="mgSteal" data-act="mgSteal" ${locked || !data.friends.length ? 'disabled' : ''}>🍓 Отклубничить</button>
          <p id="mgCooldown" class="small muted" aria-live="polite">${data.has_active_theft ? 'Замороженные жетоны ждут исхода предыдущей кражи.' : data.cooldown_remaining > 0 ? 'Следующая попытка через ' + mgDuration(data.cooldown_remaining) : 'Готово к краже!'}</p>
          ${!data.friends.length ? html`<p class="small muted">Пока нет друзей. Добавь друга во вкладке «Друзья».</p>` : ''}
          <p class="small muted">Укажи целое количество жетонов, не больше 30% доступного баланса друга. Для кражи твои жетоны не нужны, но если друг угадает вора, тот платит штраф ${data.catch_penalty_percent} % от украденного (не больше своего баланса). Между попытками — ${mgDuration(data.cooldown_seconds)}.</p>
        </section>
        <aside class="card mg-alerts"><h2>🔔 Твои уведомления</h2>
          ${data.pending.length ? data.pending.map(t => html`<div class="mg-pending"><b>🍓 У тебя украли ${mgFmt(t.amount)} жетонов</b><span>Есть одна попытка угадать. Осталось примерно ${mgDuration(Math.max(0, t.expires_ts - Math.floor(Date.now() / 1000)))}.</span>
            <button class="btn sm" data-act="mgGuessOpen" data-id="${t.id}">Угадать вора</button></div>`) : html`<p class="muted">Неразгаданных краж нет.</p>`}
          <p class="small muted">Угадаешь — вернёшь украденное и получишь штраф ${data.catch_penalty_percent} % с вора. Не угадаешь или не ответишь за 24 часа — вор получит добычу.</p>
        </aside>
      </div>
      <div id="petunHost" data-game="petun" hidden></div>
    </div>`));
  mgApplyTab();
  mgNotificationBadge();
  if (typeof petunPaint === 'function') petunPaint();
  every(() => { if (location.hash === '#/minigames' && !MG.busy && !document.querySelector('.modal') && typeof petunPaint === 'function') petunPaint(false); }, 8000);
  document.querySelector('#mgVictim')?.addEventListener('change', () => mgUpdateAmount(true));
  document.querySelector('#mgAmount')?.addEventListener('input', () => mgUpdateAmount(false));
  mgUpdateAmount(true);
  if (MG.openedFromNotice) {
    const id = MG.openedFromNotice;
    MG.openedFromNotice = null;
    mgOpenPending(id);
  }
  // A short clock only updates the label; the game decisions remain server-side.
  const initial = Date.now();
  MG.cooldownReady = data.cooldown_remaining === 0;
  const ownState = data;
  every(() => {
    if (MG.state !== ownState) return;
    if (location.hash !== '#/minigames' || !MG.state) return;
    const left = Math.max(0, data.cooldown_remaining - Math.floor((Date.now() - initial) / 1000));
    MG.cooldownReady = left === 0;
    const cd = document.querySelector('#mgCooldown');
    if (cd) cd.textContent = data.has_active_theft ? 'Дождись завершения текущей кражи.' : left ? 'Следующая попытка через ' + mgDuration(left) : 'Готово к краже!';
    const btn = document.querySelector('#mgSteal');
    if (btn && !MG.busy) btn.disabled = left > 0 || data.has_active_theft || !mgValidAmount();
  }, 1000);
  every(async () => {
    if (MG.state === data && location.hash === '#/minigames' && !MG.busy) {
      const newer = await api('/minigames/strawberry/status').catch(() => null);
      if (newer && newer.pending_count !== data.pending.length) mgRender().catch(() => {});
    }
  }, 12000);
}


function mgMaxAmount() {
  const fid = Number(document.querySelector('#mgVictim')?.value);
  return MG.state?.friends.find(f => f.id === fid)?.max_steal || 0;
}
function mgValidAmount() {
  const rawAmount = document.querySelector('#mgAmount')?.value;
  const n = Number(rawAmount);
  return rawAmount !== '' && Number.isSafeInteger(n) && n >= 1 && n <= mgMaxAmount();
}
function mgUpdateAmount(changeFriend = false) {
  const input = document.querySelector('#mgAmount'), button = document.querySelector('#mgSteal');
  if (!input || !MG.state) return;
  const maximum = mgMaxAmount();
  input.max = String(maximum);
  input.disabled = maximum < 1;
  if (changeFriend) input.value = maximum < 1 ? '' : String(Math.min(10, maximum));
  const note = document.querySelector('#mgAmountHint');
  if (note) note.textContent = 'Максимум для выбранного друга: ' + mgFmt(maximum) + ' 🪙 (30% доступного баланса).';
  if (button && !MG.busy) button.disabled = MG.state.has_active_theft ||
    MG.state.cooldown_remaining > 0 && !MG.cooldownReady || !mgValidAmount();
}

actions.mgSteal = async () => {
  if (MG.busy) return;
  const victimId = Number(document.querySelector('#mgVictim')?.value);
  if (!victimId) return;
  const friend = MG.state?.friends.find(f => f.id === victimId);
  const amount = Number(document.querySelector('#mgAmount')?.value);
  if (!friend || !mgValidAmount()) { toast('Укажи целую сумму от 1 до лимита 30% друга'); return; }
  if (!await askConfirm('Отклубничить?', `Украсть ${mgFmt(amount)} жетонов у ${friend.name}? Друг получит уведомление и сможет угадать тебя.`, 'Отклубничить', 'Отмена')) return;
  MG.busy = true;
  const btn = document.querySelector('#mgSteal');
  if (btn) btn.disabled = true;
  const requestKey = `${victimId}:${amount}`;
  const requestId = MG.pendingRequests.get(requestKey) || mgId();
  MG.pendingRequests.set(requestKey, requestId);
  try {
    const result = await api('/minigames/strawberry/steal', { json: { victim_id: victimId, amount, request_id: requestId } });
    MG.pendingRequests.delete(requestKey);
    toast(`🍓 ${mgFmt(result.amount)} жетонов заморожено до разгадки или истечения 24 часов.`, { ms: 6500 });
    await mgRender();
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
  finally { MG.busy = false; if (btn?.isConnected) btn.disabled = false; }
};

actions.mgGuessOpen = b => mgOpenPending(Number(b.dataset.id));
function mgOpenPending(id) {
  if (!MG.state || location.hash !== '#/minigames') { MG.openedFromNotice = id; return; }
  const theft = MG.state.pending.find(t => t.id === id);
  if (!theft) { toast('Эта кража уже разгадана или недоступна'); return; }
  const form = openModal(html`<div class="mg-guess-modal">
    <h2>🍓 Угадай клубничного вора</h2>
    <p>У тебя украли <b>${mgFmt(theft.amount)} 🪙</b>. Выбери одного друга. <b>Попытка только одна, срок — 24 часа.</b></p>
    <form id="mgGuessForm"><label class="mg-label" for="mgSuspect">Кто отклубничил тебя?</label>
      <select id="mgSuspect" required>${theft.candidates.map(f => html`<option value="${f.id}">${f.name} (@${f.username})</option>`)}</select>
      <div id="mgGuessError" class="err" role="alert"></div>
      <div class="mg-guess-buttons"><button class="btn ghost" type="button" id="mgGuessCancel">Отмена</button>
        <button class="btn" type="submit" id="mgGuessSubmit">Подтвердить догадку</button></div></form>
    </div>`);
  form.querySelector('#mgGuessCancel').onclick = closeModal;
  form.querySelector('#mgGuessForm').onsubmit = e => { e.preventDefault(); mgSubmitGuess(theft, form); };
}

async function mgSubmitGuess(theft, modal) {
  if (MG.busy) return;
  const suspectId = Number(modal.querySelector('#mgSuspect').value);
  if (!suspectId) return;
  const pending = MG.awaitingGuess.get(theft.id);
  if (pending && pending.suspectId !== suspectId) {
    modal.querySelector('#mgGuessError').textContent = 'Предыдущая догадка могла быть отправлена. Для повторной попытки выбери прежний вариант.';
    return;
  }
  MG.busy = true;
  const reqId = pending?.requestId || mgId();
  MG.awaitingGuess.set(theft.id, { suspectId, requestId: reqId });
  const button = modal.querySelector('#mgGuessSubmit');
  button.disabled = true;
  modal.querySelector('#mgSuspect').disabled = true;
  try {
    const data = await api('/minigames/strawberry/guess', {
      json: { theft_id: theft.id, suspect_id: suspectId, request_id: reqId }
    });
    MG.awaitingGuess.delete(theft.id);
    closeModal();
    toast(data.caught
      ? `Угадал! Возвращено ${mgFmt(data.amount)} жетонов${data.compensation ? ' и штраф с вора ' + mgFmt(data.compensation) : ''}.`
      : data.timed_out ? '24 часа прошли: жетоны получил вор.' : 'Не угадал! Украденные жетоны достались вору.', { ms: 7000 });
    MG.lastCheck = 0;
    await mgRender();
    mgCheck();
  } catch (e) {
    const el = modal.querySelector('#mgGuessError');
    if (el) el.textContent = e.message + ' · Если пропала связь, повтори с той же догадкой.';
    if (button.isConnected) button.disabled = false;
    // A rerun of an uncertain request must use the same candidate and id.
  } finally { MG.busy = false; }
}
