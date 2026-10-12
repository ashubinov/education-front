/* LearnQuest — ОТПЕТУНИВАНИЕ.
   1) игра на странице «Мини-игры»: выбрать друга и нажать «Отпетунить»; друг угадывает, кто это сделал;
   2) «отпетунен»: если друг не угадал, на минуту доступны только курсы и выход из аккаунта (экран ОТПЕТУНИН, полоса сверху, остальные разделы закрыты).
   Всё решает сервер (server/petun.py): блокировка действует на запросы к API, здесь — только экран и закрытые кнопки. */
'use strict';

const PET_LOCK = { on: false, end: 0, until: 0, timer: null, syncAt: 0, note: '' };
const PTN = { state: null, busy: false, requests: new Map(), awaiting: new Map(), notified: new Set(), pendingCount: 0, userId: null };

/* =============================== «отпетунен»: минута только курсов =============================== */
/** Какие адреса открыты, пока идёт блокировка: главный экран курсов, курс, занятие. */
function petunAllowed(hash) { return /^#\/(?:|course\/\d+|learn\/\d+|run\/\d+|auth)$/.test(hash); }
const petunClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const petunSeen = () => { try { return sessionStorage.getItem('petun_seen') === String(PET_LOCK.until); } catch (e) { return false; } };

/** Принять состояние блокировки с сервера (поле petun из GET /me или ответ на «Угадать»): null — блокировки нет. */
function petunSet(lock) {
  if (!lock || !(lock.seconds_left > 0)) { if (PET_LOCK.on) petunRelease(true); return; }
  PET_LOCK.end = Date.now() + lock.seconds_left * 1000; PET_LOCK.until = lock.until;
  if (!PET_LOCK.timer) PET_LOCK.timer = setInterval(petunTick, 250);
  if (PET_LOCK.on) return;
  PET_LOCK.on = true;
  document.documentElement.classList.add('petun-locked');
  petunBar();
  petunMusicStart();                           // музыка по кругу всю минуту (и после «К курсам», и после перезагрузки)
  if (!petunSeen()) petunOverlay();
  if (!petunAllowed(location.hash)) location.hash = '#/';
  petunTick();
}
function petunBar() {
  if (document.getElementById('petun-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'petun-bar'; bar.className = 'petun-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>🔒 <b>ОТПЕТУНИН</b> · только курсы · <b id="petunBarLeft"></b></span><button type="button" class="btn sm ghost" data-act="petunLogout">Выйти из аккаунта</button>';
  document.body.insertBefore(bar, document.body.firstChild);   // полоса прилипает к верху страницы и не перекрывает шапку
}
function petunOverlay() {
  if (document.getElementById('petun-overlay')) return;
  try { sessionStorage.setItem('petun_seen', String(PET_LOCK.until)); } catch (e) { /* ignore */ }
  const box = document.createElement('div');
  box.id = 'petun-overlay'; box.className = 'ban-overlay petun-overlay'; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'petun-title');
  box.innerHTML = '<div class="ban-card"><h1 id="petun-title">ОТПЕТУНИН</h1><img src="assets/banned.jpg" alt="" width="320"><div class="ban-label">Тебя отпетунили</div>' +
    '<div class="ban-msg">Целую минуту можно только заниматься на курсах.<br>Осталось: <b id="petunLeft"></b><div class="ban-note" id="petunNote" hidden></div></div>' +
    '<button type="button" class="btn lg" data-act="petunCourses">К курсам</button><button type="button" class="btn lg ghost" data-act="petunLogout">Выйти из аккаунта</button></div>';
  document.body.appendChild(box);
  const note = box.querySelector('#petunNote'); if (PET_LOCK.note) { note.textContent = PET_LOCK.note; note.hidden = false; }   // например, «у тебя украли N жетонов»
  document.documentElement.classList.add('is-banned');   // страница под экраном не прокручивается
}
function petunTick() {
  if (!PET_LOCK.on) return;
  const left = Math.max(0, Math.ceil((PET_LOCK.end - Date.now()) / 1000));
  for (const id of ['petunLeft', 'petunBarLeft']) { const el = document.getElementById(id); if (el) el.textContent = petunClock(left); }
  if (left > 0) return;
  clearInterval(PET_LOCK.timer); PET_LOCK.timer = null;
  refreshMe();   // сервер подтвердит окончание (petunSet(null)) или пришлёт остаток, если часы разошлись
}
function petunClear() {
  clearInterval(PET_LOCK.timer); PET_LOCK.timer = null; PET_LOCK.on = false;
  petunMusicStop(); PET_LOCK.note = '';
  document.getElementById('petun-overlay')?.remove(); document.getElementById('petun-bar')?.remove();
  document.documentElement.classList.remove('petun-locked');
  if (!document.getElementById('ban-overlay')) document.documentElement.classList.remove('is-banned');
  try { sessionStorage.removeItem('petun_seen'); } catch (e) { /* ignore */ }
}
function petunRelease(announce) {
  petunClear();
  if (announce) { toast('Блокировка снята: всё снова доступно', { icon: '🎉' }); try { router(); } catch (e) { /* ignore */ } }
}
/** Выход из аккаунта (или смена пользователя): убрать экран и ограничения. */
function petunReset() { petunClear(); PTN.state = null; PTN.notified.clear(); PTN.pendingCount = 0; }
/** Сервер ответил «ОТПЕТУНИН» (423), а мы об этом не знали: узнать состояние. */
function petunSync() {
  if (PET_LOCK.on || Date.now() - PET_LOCK.syncAt < 3000) return;
  PET_LOCK.syncAt = Date.now();
  refreshMe();
}
actions.petunCourses = () => {
  document.getElementById('petun-overlay')?.remove();
  if (!document.getElementById('ban-overlay')) document.documentElement.classList.remove('is-banned');
  if (!petunAllowed(location.hash)) location.hash = '#/';
};
actions.petunLogout = () => { petunReset(); actions.logout(); };

/* =============================== игра на странице «Мини-игры» =============================== */
function petunId() { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); }
const petunWait = s => s >= 60 ? Math.ceil(s / 60) + ' мин.' : s + ' сек.';
const petunFmt = n => Number(n || 0).toLocaleString('ru-RU');

/** Опрос уведомлений (вызывается из mgCheck): тебя отпетунили — нужно угадать, кто это. */
async function petunCheck() {
  if (!S.user || PET_LOCK.on) return;
  if (PTN.userId !== S.user.id) { PTN.userId = S.user.id; PTN.notified.clear(); PTN.pendingCount = 0; }
  try {
    const d = await api('/minigames/petun/status');
    if (!S.user || PTN.userId !== S.user.id) return;
    PTN.pendingCount = d.pending_count;
    if (typeof mgNotificationBadge === 'function') mgNotificationBadge();
    if (d.latest_pending_id && !PTN.notified.has(d.latest_pending_id)) { PTN.notified.add(d.latest_pending_id); petunNotify(d.latest_pending_id, d.latest_pending_amount || 0); }
  } catch (e) { /* нет связи или ещё не задеплоено — страницы не трогаем */ }
}
function petunNotify(id, amount) {
  const root = document.querySelector('#toasts'); if (!root) return;
  const note = document.createElement('div'); note.className = 'toast mg-notice';
  const h = document.createElement('b'); h.textContent = amount ? `🐓 Тебя отпетунили и украли ${petunFmt(amount)} 🪙!` : '🐓 Тебя отпетунили!';
  const sub = document.createElement('span'); sub.textContent = 'Угадай, кто это сделал, иначе на минуту останутся только курсы' + (amount ? ' и жетоны достанутся вору.' : '.');
  const btn = document.createElement('button'); btn.className = 'btn sm'; btn.type = 'button'; btn.textContent = 'Угадать';
  btn.onclick = () => { note.remove(); PTN.openId = id; if (typeof mgSetTab === 'function') mgSetTab('petun'); if (location.hash === '#/minigames') petunOpenGuess(id); else location.hash = '#/minigames'; };
  note.append(h, sub, btn); root.appendChild(note); setTimeout(() => note.remove(), 16000);
}

/** Рисует карточку игры внутри #petunHost (страница «Мини-игры»). */
async function petunPaint(force = true) {
  const host = document.getElementById('petunHost'); if (!host) return;
  let d;
  try { d = await api('/minigames/petun/state'); } catch (e) { host.innerHTML = ''; return; }
  if (!document.getElementById('petunHost') || location.hash !== '#/minigames') return;
  PTN.state = d; PTN.pendingCount = d.pending.length;
  if (typeof mgNotificationBadge === 'function') mgNotificationBadge();
  const sig = JSON.stringify([d.pending.map(t => t.id), d.has_active, d.balance, d.frozen, d.friends.map(f => [f.id, f.busy, f.locked, f.wait > 0, f.max_steal])]);
  if (!force && PTN.sig === sig && document.getElementById('ptVictim')) return;   // ничего не изменилось: не сбиваем выбор в списке и сумму
  PTN.sig = sig;
  const keep = Number(document.getElementById('ptVictim')?.value) || 0;
  const keepAmount = document.getElementById('ptAmount')?.value;
  const usable = f => !f.wait && !f.busy && !f.locked;
  const label = f => f.name + ' (@' + f.username + ')' + (f.busy ? ' — выбирает, кто отпетунил' : f.locked ? ' — уже отпетунен' : f.wait ? ' — снова через ' + petunWait(f.wait) : '');
  const first = d.friends.find(f => f.id === keep && usable(f)) || d.friends.find(usable);
  host.innerHTML = unraw(html`<div class="mg-layout mt">
    <section class="card mg-game">
      <h2>🐓 ОТПЕТУНИВАНИЕ</h2>
      <p class="muted">Выбери друга и нажми «Отпетунить». Он получит уведомление и должен угадать, кто это сделал. Не угадал (или не ответил за час) — на минуту ему останутся только курсы и выход из аккаунта. Можно ещё и украсть у него жетоны, как в «Клубничном воре».</p>
      <div class="mg-chips">Доступно: <strong>${petunFmt(d.balance)} 🪙</strong><span>Заморожено: <b>${petunFmt(d.frozen)} 🪙</b></span></div>
      ${d.has_active ? html`<div class="pt-wait"><b>⏳ Ждём ответа: ${d.my_attack.victim}</b>
        <span>Пока он не выберет, кто его отпетунил${d.my_attack.amount ? ' (у него заморожено ' + petunFmt(d.my_attack.amount) + ' 🪙 для тебя)' : ''}, следующего отпетунить нельзя. Осталось ждать не больше ${mgDuration(Math.max(0, d.my_attack.expires_ts - d.server_now))}. Не отвечает? Можно отменить.</span>
        <button class="btn sm ghost" data-act="ptCancel" data-id="${d.my_attack.id}">Отменить отпетунивание</button></div>` : ''}
      <label class="mg-label" for="ptVictim">Кого отпетунить?</label>
      <select id="ptVictim" ${d.friends.length && !d.has_active ? '' : 'disabled'}>${d.friends.map(f => html`<option value="${f.id}" ${usable(f) ? '' : 'disabled'} ${first && f.id === first.id ? 'selected' : ''}>${label(f)}</option>`)}</select>
      <label class="mg-label" for="ptAmount">Сколько жетонов украсть? <span class="muted">(необязательно)</span></label>
      <input id="ptAmount" class="mg-amount-input" type="number" inputmode="numeric" step="1" min="0" value="${keepAmount !== undefined ? keepAmount : '0'}" aria-describedby="ptAmountHint" ${d.has_active ? 'disabled' : ''}>
      <p class="small muted mg-max-hint" id="ptAmountHint"></p>
      <button class="btn mg-steal" id="ptAttack" data-act="ptAttack" ${d.has_active || !first ? 'disabled' : ''}>🐓 Отпетунить</button>
      <p class="small muted" id="ptHint">${d.has_active ? 'Сначала дождись ответа или отмени текущее отпетунивание.' : !d.friends.length ? 'Пока нет друзей. Добавь друга во вкладке «Друзья».' : !first ? 'Сейчас отпетунить некого: все друзья заняты или отдыхают.' : 'Готово!'}</p>
      <p class="small muted">0 — просто отпетунить. Сумма: от ${d.min_steal} до ${d.max_steal_percent} % свободного баланса друга; она замораживается до его ответа. Угадает — вернёт жетоны и получит штраф ${d.catch_penalty_percent} % с тебя; не угадает или не ответит — жетоны твои. Одного и того же игрока можно отпетунить раз в ${Math.round(d.cooldown_seconds / 60)} минут, ответить другу нужно за ${Math.round(d.answer_seconds / 3600)} ч.</p>
      ${d.recent.length ? html`<div class="small muted mt-s">Недавние: ${d.recent.map(r => (r.caught ? '😬 ' + r.name + ' тебя раскусил' + (r.penalty ? ' (штраф ' + petunFmt(r.penalty) + ' 🪙)' : '') : '😈 ' + r.name + ' отпетунен' + (r.amount ? ' (+' + petunFmt(r.amount) + ' 🪙)' : ''))).join(' · ')}</div>` : ''}
    </section>
    <aside class="card mg-alerts"><h2>🔔 Отпетунивание</h2>
      ${d.pending.length ? d.pending.map(t => html`<div class="mg-pending"><b>🐓 Тебя отпетунили!${t.amount ? ' У тебя украли ' + petunFmt(t.amount) + ' 🪙' : ''}</b><span>Выбери, кто это был. Попытка одна. Осталось примерно ${mgDuration(Math.max(0, t.expires_ts - d.server_now))}.</span>
        <button class="btn sm" data-act="ptGuessOpen" data-id="${t.id}">Угадать</button></div>`) : html`<p class="muted">Тебя пока никто не отпетунил.</p>`}
      <p class="small muted">Угадаешь — ничего не будет, украденное вернётся к тебе (и ещё штраф с вора). Не угадаешь — минуту только курсы и выход из аккаунта, украденные жетоны достаются вору.</p>
    </aside></div>`);
  document.getElementById('ptVictim')?.addEventListener('change', () => petunUpdateAmount(true));
  document.getElementById('ptAmount')?.addEventListener('input', () => petunUpdateAmount(false));
  petunUpdateAmount(false);
  if (PTN.openId) { const id = PTN.openId; PTN.openId = null; petunOpenGuess(id); }
}

function petunMax() {
  const fid = Number(document.getElementById('ptVictim')?.value);
  return PTN.state?.friends.find(f => f.id === fid)?.max_steal || 0;
}
function petunAmountValue() {
  const raw = document.getElementById('ptAmount')?.value;
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : -1;
}
function petunAmountOk() { const a = petunAmountValue(); return a >= 0 && a <= petunMax(); }
function petunUpdateAmount(friendChanged) {
  const input = document.getElementById('ptAmount'), btn = document.getElementById('ptAttack'); if (!input || !PTN.state) return;
  const max = petunMax();
  input.max = String(max);
  if (friendChanged && petunAmountValue() > max) input.value = String(max);
  const hint = document.getElementById('ptAmountHint');
  if (hint) hint.textContent = 'Максимум для выбранного друга: ' + petunFmt(max) + ' 🪙 (' + PTN.state.max_steal_percent + '% его свободного баланса). 0 — просто отпетунить.';
  if (btn && !PTN.busy) btn.disabled = PTN.state.has_active || !document.getElementById('ptVictim')?.value || !petunAmountOk();
}

actions.ptAttack = async () => {
  if (PTN.busy) return;
  const victimId = Number(document.getElementById('ptVictim')?.value); if (!victimId) return;
  const f = PTN.state?.friends.find(x => x.id === victimId); if (!f) return;
  if (!petunAmountOk()) { toast('Укажи целую сумму от 0 до ' + petunFmt(petunMax())); return; }
  const amount = petunAmountValue();
  const text = amount
    ? `Отпетунить ${f.name} и украсть ${petunFmt(amount)} жетонов? Если он не угадает, что это ты, жетоны твои; если угадает, вернёт их и получит с тебя штраф ${PTN.state.catch_penalty_percent} %.`
    : `Отпетунить ${f.name}? Он получит уведомление и должен угадать, что это сделал именно ты.`;
  if (!await askConfirm('Отпетунить?', text, 'Отпетунить', 'Отмена')) return;
  PTN.busy = true;
  const btn = document.getElementById('ptAttack'); if (btn) btn.disabled = true;
  const key = victimId + ':' + amount;
  const rid = PTN.requests.get(key) || petunId(); PTN.requests.set(key, rid);
  try {
    await api('/minigames/petun/attack', { json: { victim_id: victimId, amount, request_id: rid } });
    PTN.requests.delete(key);
    toast(`🐓 ${f.name} отпетунен!${amount ? ' ' + petunFmt(amount) + ' 🪙 заморожено до его ответа.' : ''} Ждём, пока он угадает, кто это сделал.`, { ms: 5500 });
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
  finally { PTN.busy = false; petunPaint(); }
};

actions.ptCancel = async b => {
  if (PTN.busy) return;
  const name = PTN.state?.my_attack?.victim || 'другу';
  if (!await askConfirm('Отменить отпетунивание?', `Отменить отпетунивание для ${name}? Он больше не сможет его угадать` + (PTN.state?.my_attack?.amount ? ', замороженные жетоны вернутся ему' : '') + '. Отпетунить его снова получится не раньше, чем через ' + Math.round((PTN.state?.cooldown_seconds || 300) / 60) + ' мин. после первой попытки.', 'Отменить', 'Назад')) return;
  PTN.busy = true; b.disabled = true;
  try {
    await api('/minigames/petun/cancel', { json: { attack_id: Number(b.dataset.id) } });
    toast('Отпетунивание отменено: можно выбрать другого друга.', { icon: '↩️' });
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
  finally { PTN.busy = false; await petunPaint(); }
};

actions.ptGuessOpen = b => petunOpenGuess(Number(b.dataset.id));
function petunOpenGuess(id) {
  const a = PTN.state?.pending.find(t => t.id === id);
  if (!a) { if (location.hash === '#/minigames') { PTN.openId = id; petunPaint(); } else toast('Это отпетунивание уже завершено'); return; }
  const m = openModal(html`<div class="mg-guess-modal"><h2>🐓 Кто тебя отпетунил?</h2>
    <p>${a.amount ? html`У тебя украли <b>${petunFmt(a.amount)} 🪙</b>. ` : ''}Выбери одного друга. <b>Попытка только одна.</b> Не угадаешь — минуту сможешь только заниматься на курсах${a.amount ? ' и жетоны достанутся вору' : ''}.</p>
    <form id="ptGuessForm"><label class="mg-label" for="ptSuspect">Это сделал…</label>
      <select id="ptSuspect" required>${a.candidates.map(f => html`<option value="${f.id}">${f.name} (@${f.username})</option>`)}</select>
      <div id="ptGuessError" class="err" role="alert"></div>
      <div class="mg-guess-buttons"><button class="btn ghost" type="button" id="ptGuessCancel">Отмена</button><button class="btn" type="submit" id="ptGuessSubmit">Подтвердить</button></div></form></div>`);
  m.querySelector('#ptGuessCancel').onclick = closeModal;
  m.querySelector('#ptGuessForm').onsubmit = e => { e.preventDefault(); petunSubmitGuess(a, m); };
}
async function petunSubmitGuess(a, modal) {
  if (PTN.busy) return;
  const suspectId = Number(modal.querySelector('#ptSuspect').value); if (!suspectId) return;
  const prev = PTN.awaiting.get(a.id);
  if (prev && prev.suspectId !== suspectId) { modal.querySelector('#ptGuessError').textContent = 'Предыдущая догадка могла быть отправлена. Выбери прежний вариант.'; return; }
  PTN.busy = true;
  const rid = prev?.requestId || petunId(); PTN.awaiting.set(a.id, { suspectId, requestId: rid });
  const btn = modal.querySelector('#ptGuessSubmit'); btn.disabled = true; modal.querySelector('#ptSuspect').disabled = true;
  try {
    const r = await api('/minigames/petun/guess', { json: { attack_id: a.id, suspect_id: suspectId, request_id: rid } });
    PTN.awaiting.delete(a.id); closeModal();
    if (r.caught) {
      toast('Угадал! Ты раскусил отпетунщика: блокировки нет' + (r.amount ? '. Жетоны вернулись к тебе: ' + petunFmt(r.amount) + (r.compensation ? ' и штраф с вора ' + petunFmt(r.compensation) : '') : '.'), { icon: '😎', ms: 7000 });
    } else if (r.lock) {
      PET_LOCK.note = r.amount ? 'У тебя украли ' + petunFmt(r.amount) + ' 🪙: они достались вору.' : '';
      petunSet(r.lock);                           // не угадал: экран ОТПЕТУНИН и минута только курсов
    } else toast('Не угадал, но блокировка уже закончилась.' + (r.amount ? ' Жетоны (' + petunFmt(r.amount) + ') достались вору.' : ''), { icon: '😅' });
    await petunPaint();
  } catch (e) {
    const el = modal.querySelector('#ptGuessError'); if (el) el.textContent = e.message + ' · Если пропала связь, повтори с той же догадкой.';
    if (btn.isConnected) btn.disabled = false;
  } finally { PTN.busy = false; }
}
