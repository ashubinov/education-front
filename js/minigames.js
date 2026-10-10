/* LearnQuest — Mini Games / Strawberry Thief.
   The server alone chooses the prize, transfers chips, and decides the guess. */
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
function mgNotificationBadge() {
  document.querySelectorAll('.mg-nav-badge').forEach(el => {
    el.hidden = !MG.pendingCount;
    el.textContent = MG.pendingCount || '';
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
    note.remove(); MG.openedFromNotice = id;
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
  const locked = data.cooldown_remaining > 0 || data.has_active_theft || data.balance < 1;
  render(app(), shell('minigames', html`
    <div class="mg-page">
      <header class="mg-hero"><span class="mg-berry">🍓</span><div>
        <h1>Мини-игры</h1><p>Первая игра — <b>«Клубничный вор»</b>. Откуси немного чужой удачи.</p>
      </div></header>
      <div class="mg-layout">
        <section class="card mg-game">
          <h2>🍓 Клубничный вор</h2>
          <p class="muted">Выбери друга и нажми «Отклубничить». Часть его жетонов будет заморожена у тебя до разгадки. Друг может угадать вора в течение 24 часов.</p>
          <div class="mg-chips">Доступно: <strong id="mgBalance">${mgFmt(data.balance)} 🪙</strong><span>Заморожено: <b>${mgFmt(data.frozen)} 🪙</b></span></div>
          <label class="mg-label" for="mgVictim">Кого отклубничить?</label>
          <select id="mgVictim" ${data.friends.length ? '' : 'disabled'}>
            ${data.friends.map(f => html`<option value="${f.id}">${f.name} (@${f.username})</option>`)}</select>
          <button class="btn mg-steal" id="mgSteal" data-act="mgSteal" ${locked || !data.friends.length ? 'disabled' : ''}>🍓 Отклубничить</button>
          <p id="mgCooldown" class="small muted" aria-live="polite">${data.has_active_theft ? 'Замороженные жетоны ждут исхода предыдущей кражи.' : data.balance < 1 ? 'Для резерва компенсации нужен хотя бы 1 жетон.' : data.cooldown_remaining > 0 ? 'Следующая попытка через ' + mgDuration(data.cooldown_remaining) : 'Готово к краже!'}</p>
          ${!data.friends.length ? html`<p class="small muted">Пока нет друзей. Добавь друга во вкладке «Друзья».</p>` : ''}
          <p class="small muted">Размер кражи: ${data.min_steal}–${data.max_steal} жетонов, не больше баланса друга. Для 5% компенсации заранее резервируется небольшая сумма твоих жетонов. Между попытками — ${mgDuration(data.cooldown_seconds)}.</p>
        </section>
        <aside class="card mg-alerts"><h2>🔔 Твои уведомления</h2>
          ${data.pending.length ? data.pending.map(t => html`<div class="mg-pending"><b>🍓 У тебя украли ${mgFmt(t.amount)} жетонов</b><span>Есть одна попытка угадать. Осталось примерно ${mgDuration(Math.max(0, t.expires_ts - Math.floor(Date.now() / 1000)))}.</span>
            <button class="btn sm" data-act="mgGuessOpen" data-id="${t.id}">Угадать вора</button></div>`) : html`<p class="muted">Неразгаданных краж нет.</p>`}
          <p class="small muted">Угадаешь — получишь назад украденное и компенсацию 5% (минимум 1 жетон). Не угадаешь или не ответишь за 24 часа — вор получит добычу.</p>
        </aside>
      </div>
    </div>`));
  if (MG.openedFromNotice) {
    const id = MG.openedFromNotice;
    MG.openedFromNotice = null;
    mgOpenPending(id);
  }
  // A short clock only updates the label; the game decisions remain server-side.
  const initial = Date.now();
  const ownState = data;
  every(() => {
    if (MG.state !== ownState) return;
    if (location.hash !== '#/minigames' || !MG.state) return;
    const left = Math.max(0, data.cooldown_remaining - Math.floor((Date.now() - initial) / 1000));
    const cd = document.querySelector('#mgCooldown');
    if (cd) cd.textContent = data.has_active_theft ? 'Дождись завершения текущей кражи.' : data.balance < 1 ? 'Для резерва компенсации нужен хотя бы 1 жетон.' : left ? 'Следующая попытка через ' + mgDuration(left) : 'Готово к краже!';
    const btn = document.querySelector('#mgSteal');
    if (btn && !MG.busy) btn.disabled = left > 0 || data.has_active_theft || data.balance < 1 || !data.friends.length;
  }, 1000);
  every(async () => {
    if (MG.state === data && location.hash === '#/minigames' && !MG.busy) {
      const newer = await api('/minigames/strawberry/status').catch(() => null);
      if (newer && newer.pending_count !== data.pending.length) mgRender().catch(() => {});
    }
  }, 12000);
}

actions.mgSteal = async () => {
  if (MG.busy) return;
  const victimId = Number(document.querySelector('#mgVictim')?.value);
  if (!victimId) return;
  const friend = MG.state?.friends.find(f => f.id === victimId);
  if (!friend || !await askConfirm('Отклубничить?', `Украсть случайное количество жетонов у @${friend.username}? Друг получит уведомление и сможет угадать тебя.`, 'Отклубничить', 'Отмена')) return;
  MG.busy = true;
  const btn = document.querySelector('#mgSteal');
  if (btn) btn.disabled = true;
  const requestId = MG.pendingRequests.get(victimId) || mgId();
  MG.pendingRequests.set(victimId, requestId);
  try {
    const result = await api('/minigames/strawberry/steal', { json: { victim_id: victimId, request_id: requestId } });
    MG.pendingRequests.delete(victimId);
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
      ? `Угадал! Возвращено ${mgFmt(data.amount)} и ${mgFmt(data.compensation)} жетонов компенсации.`
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
