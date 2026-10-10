/* LearnQuest — друзья, подписи на страничках и администрирование (модерация подписей, пользователи, бан) */
'use strict';

const SIGN_STATUS = {
  pending: ['warn', '⏳ На модерации — пока подпись видна только тебе'],
  approved: ['good', '✅ Опубликована на страничке'],
  rejected: ['bad', '❌ Отклонена администратором — можно написать другую'],
};

function fmtLast(iso) {
  if (!iso) return 'ещё не занимался';
  const d = Math.round((new Date(todayISO() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000);
  return d <= 0 ? 'занимался сегодня' : d === 1 ? 'занимался вчера' : d < 30 ? `занимался ${d} ${plural(d, 'день', 'дня', 'дней')} назад` : 'давно не заходил';
}
function fmtStamp(s) { try { return new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
const who = p => html`<span class="pav">${av(p)}</span><div class="grow pname"><b>${p.display_name}</b><div class="small muted">@${p.username}</div></div>`;
const goBack = (href, text) => html`<a href="${href}" class="small back">← ${text}</a>`;

/* =============================== друзья =============================== */
route(/^#\/friends$/, async () => { await drawFriends(); });
actions.openFriend = b => { location.hash = '#/friend/' + b.dataset.id; };

async function drawFriends() {
  const keepY = window.scrollY;
  const [ov, wall] = await Promise.all([api('/friends'), api('/me/wall')]);
  const note = S.friendNote || ''; S.friendNote = '';
  render(app(), shell('friends', html`<h1>Друзья</h1>
    <div class="card mb"><h3>➕ Добавить друга</h3>
      <p class="small muted">Введи логин друга. Когда он примет заявку, вы будете видеть прогресс друг друга и сможете оставлять подписи на страничках.</p>
      <form class="row wrap gap-s" id="addfriend"><input type="text" id="fname" placeholder="логин друга" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:170px"><button class="btn" type="submit">Отправить заявку</button></form>
      <div class="small mt" id="fres">${note}</div></div>
    ${ov.incoming.length ? html`<div class="card mb"><h3>📨 Заявки в друзья <span class="chip accent">${ov.incoming.length}</span></h3><div class="col">
      ${ov.incoming.map(p => html`<div class="row person">${who(p)}<button class="btn sm good" data-act="friendAccept" data-id="${p.id}">Принять</button><button class="btn sm ghost" data-act="friendDecline" data-id="${p.id}">Отклонить</button></div>`)}</div></div>` : ''}
    ${ov.outgoing.length ? html`<div class="card mb"><h3>🕓 Ждут ответа</h3><div class="col">
      ${ov.outgoing.map(p => html`<div class="row person">${who(p)}<button class="btn sm ghost" data-act="friendDecline" data-id="${p.id}">Отозвать</button></div>`)}</div></div>` : ''}
    <h2>Мои друзья <span class="muted small">${ov.friends.length}</span></h2>
    ${ov.friends.length ? html`<div class="grid mb">${ov.friends.map(f => html`<div class="card course-card friend-card" data-act="openFriend" data-id="${f.id}">
        <div class="row">${who(f)}</div>
        <div class="row wrap gap-s"><span class="chip accent">Ур. ${f.level}</span><span class="chip ${f.streak ? 'warn' : ''}">🔥 ${f.streak}</span><span class="chip">⭐ ${f.xp} XP</span></div>
        <div class="small muted">${fmtLast(f.last_active)}</div></div>`)}</div>`
      : html`<div class="card center mb"><div style="font-size:44px">🫂</div><p class="muted" style="margin:6px 0 0">Друзей пока нет. Отправь заявку по логину — и вы увидите успехи друг друга.</p></div>`}
    <h2>Моя страничка</h2>
    <div class="card"><p class="small muted">Подписи, которые друзья оставили у тебя. Они появляются после проверки администратором.</p>
      ${wall.wall.length ? html`<div class="col">${wall.wall.map(w => html`<div class="sign"><span class="pav sm">${av(w.author)}</span><div class="grow"><div class="sign-text">${w.text}</div><div class="small muted">${w.author.display_name} · ${fmtStamp(w.updated_at)}</div></div><button class="icon-btn" data-act="wallDelete" data-id="${w.id}" title="Убрать подпись">✕</button></div>`)}</div>`
        : html`<p class="muted" style="margin:0">Пока никто не оставил подпись.</p>`}</div>`));
  window.scrollTo(0, keepY);
  $('#addfriend').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#fname').value.trim(); if (!name) return;
    const btn = $('button[type=submit]', e.target); busy(btn, true);
    try {
      const r = await api('/friends/request', { json: { username: name } });
      S.friendNote = r.status === 'accepted' ? '🎉 Вы теперь друзья!' : `📨 Заявка отправлена: ${r.user.display_name} (@${r.user.username})`;
      toast(r.status === 'accepted' ? 'Вы теперь друзья' : 'Заявка отправлена', { icon: r.status === 'accepted' ? '🎉' : '📨', ms: 2200 });
      await drawFriends();
    } catch (err) { busy(btn, false); $('#fres').innerHTML = `<span class="err">${esc(err.message)}</span>`; }
  });
}
actions.friendAccept = async b => { try { await api(`/friends/${b.dataset.id}/accept`, { method: 'POST' }); toast('Теперь вы друзья', { icon: '🎉', ms: 2000 }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawFriends(); };
actions.friendDecline = async b => { try { await api(`/friends/${b.dataset.id}/decline`, { method: 'POST' }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawFriends(); };
actions.wallDelete = async b => {
  if (!await askConfirm('Убрать подпись?', 'Она исчезнет с твоей страницы.', 'Убрать', 'Отмена', true)) return;
  try { await api(`/me/wall/${b.dataset.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message, { icon: '⚠️' }); }
  drawFriends();
};

/* =============================== профиль друга =============================== */
route(/^#\/friend\/(\d+)$/, async id => { await drawFriend(+id); });
async function drawFriend(id) {
  let p;
  try { p = await api('/friends/' + id); }
  catch (e) { if (e.status === 404) { location.hash = '#/friends'; return; } throw e; }
  S.friendView = p;
  const my = p.my_signature, st = my && SIGN_STATUS[my.status];
  const done = p.achievements.filter(a => a.unlocked);
  render(app(), shell('friends', html`${goBack('#/friends', 'Все друзья')}
    <div class="card quest mb mt-s">
      <div class="pav xl">${av(p)}</div>
      <div class="grow"><h2 style="margin:0">${p.display_name}</h2><div class="small muted">@${p.username} · с нами с ${fmtStamp(p.member_since)} · ${fmtLast(p.last_active)}</div>
        <div class="row wrap gap-s mt"><span class="chip accent">Уровень ${p.level_full.level}</span><span class="chip ${p.streak ? 'warn' : ''}">🔥 серия ${p.streak}</span><span class="chip">🏅 рекорд ${p.best_streak}</span></div>
        <div class="bar thin mt"><i style="width:${p.level_full.pct}%"></i></div><div class="small muted">${p.level_full.into} / ${p.level_full.span} XP до уровня ${p.level_full.level + 1}</div></div></div>
    <div class="tiles mb">
      <div class="card tile"><b>⭐ ${p.xp}</b><span>очков опыта</span></div>
      <div class="card tile"><b>✅ ${p.totals.lessons}</b><span>уроков</span></div>
      <div class="card tile"><b>⏱ ${p.totals.minutes}</b><span>минут</span></div>
      <div class="card tile"><b>🎯 ${p.totals.answers}</b><span>ответов</span></div></div>
    <div class="card mb"><h3>🎰 Слоты</h3>${p.slots ? html`<div class="tiles slot-tiles friend-slots">
        <div class="card tile"><b>🪙 ${slFmt(p.slots.wagered)}</b><span>потрачено (ставки)</span></div>
        <div class="card tile"><b>🏆 ${slFmt(p.slots.won)}</b><span>выиграно</span></div>
        <div class="card tile ${p.slots.net >= 0 ? 'plus' : 'minus'}"><b>${p.slots.net >= 0 ? '+' : '−'}${slFmt(Math.abs(p.slots.net))}</b><span>итог</span></div>
        <div class="card tile"><b>🎰 ${slFmt(p.slots.spins)}</b><span>вращений</span></div></div>
      <div class="small muted mt">Лучший выигрыш: <b>${slFmt(p.slots.best_win)}</b> жетонов. Жетоны виртуальные, это игровая валюта.</div>` : html`<p class="muted small" style="margin:0">Ещё не играл в слоты.</p>`}</div>
    <div class="two mb"><div class="card"><h3>Неделя</h3>${barChart(p.week, 'xp', 'XP')}</div>
      <div class="card"><h3>Курсы</h3>${p.courses.length ? html`<div class="col">${p.courses.map(c => html`<div><div class="row spread small"><span>${c.icon} <b>${c.title}</b></span><span class="muted">${c.status === 'completed' ? '🏆 пройден' : c.progress.percent + '%'}</span></div>
          <div class="bar thin ${c.status === 'completed' ? 'good' : ''}"><i style="width:${c.progress.percent}%"></i></div></div>`)}</div>` : html`<p class="muted small" style="margin:0">Пока нет курсов.</p>`}</div></div>
    <div class="card mb"><h3>🏆 Достижения <span class="muted small">${done.length}/${p.achievements.length}</span></h3>
      ${done.length ? html`<div class="ach-grid">${done.map(a => html`<div class="ach"><div class="ic">${a.icon}</div><div><b>${a.title}</b><span>${a.desc}</span></div></div>`)}</div>` : html`<p class="muted small" style="margin:0">Достижений пока нет.</p>`}</div>
    <div class="card mb"><h3>✍️ Подписи на страничке</h3>
      ${p.wall.length ? html`<div class="col mb">${p.wall.map(w => html`<div class="sign"><span class="pav sm">${av(w.author)}</span><div class="grow"><div class="sign-text">${w.text}</div><div class="small muted">${w.author.display_name}</div></div></div>`)}</div>` : html`<p class="muted small">Пока никто ничего не написал — будь первым.</p>`}
      <div class="field" style="margin-bottom:8px"><label>Твоя подпись · <span id="signcnt">${(my ? my.text : '').length}/${p.sign_max}</span></label>
        <div class="row wrap gap-s"><input type="text" id="signtext" maxlength="${p.sign_max}" value="${my ? my.text : ''}" placeholder="Короткая подпись, до ${p.sign_max} символов" autocomplete="off" style="flex:1;min-width:170px"><button class="btn" data-act="saveSign" data-id="${p.id}">${my ? 'Заменить' : 'Оставить'}</button>${my ? html`<button class="btn ghost" data-act="delSign" data-id="${p.id}">Убрать</button>` : ''}</div></div>
      <div id="signmsg" class="small">${st ? html`<span class="chip ${st[0]}">${st[1]}</span>` : html`<span class="muted">Подпись появится на страничке после проверки администратором. Одна подпись от тебя на страничку.</span>`}</div></div>
    <button class="btn ghost" data-act="unfriend" data-id="${p.id}">Удалить из друзей</button>`));
  const inp = $('#signtext');
  inp.addEventListener('input', () => { $('#signcnt').textContent = inp.value.length + '/' + p.sign_max; });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-act=saveSign]').click(); });
}
actions.saveSign = async b => {
  const text = $('#signtext').value.trim();
  if (!text) { $('#signmsg').innerHTML = '<span class="err">Напиши хотя бы пару слов</span>'; return; }
  busy(b, true);
  try {
    const s = await api(`/friends/${b.dataset.id}/signature`, { method: 'PUT', json: { text } });
    toast(s.status === 'approved' ? 'Подпись опубликована' : 'Подпись отправлена на модерацию', { icon: s.status === 'approved' ? '✅' : '⏳', ms: 2600 });
    await drawFriend(+b.dataset.id);
  } catch (e) { busy(b, false); $('#signmsg').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
};
actions.delSign = async b => { try { await api(`/friends/${b.dataset.id}/signature`, { method: 'DELETE' }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawFriend(+b.dataset.id); };
actions.unfriend = async b => {
  const p = S.friendView;
  if (!await askConfirm('Удалить из друзей?', `${p.display_name} пропадёт из списка, вы больше не увидите прогресс друг друга, а подписи друг у друга исчезнут.`, 'Удалить', 'Отмена', true)) return;
  try { await api(`/friends/${b.dataset.id}`, { method: 'DELETE' }); toast('Удалён из друзей', { icon: '👋', ms: 1800 }); } catch (e) { toast(e.message, { icon: '⚠️' }); }
  location.hash = '#/friends';
};

/* =============================== администратор =============================== */
route(/^#\/admin$/, async () => {
  if (!S.user || !S.user.is_admin) { location.hash = '#/'; return; }
  await drawAdmin();
});
actions.adminTab = b => { S.adminTab = b.dataset.tab; drawAdmin(); };

async function drawAdmin() {
  S.adminTab = S.adminTab || 'sign';
  const keepY = window.scrollY;
  const pending = await api('/admin/signatures');
  const users = S.adminTab === 'users' ? await api('/admin/users?q=' + encodeURIComponent(S.adminQ || '')) : null;
  if (S.user.moderation_pending !== pending.length) { S.user.moderation_pending = pending.length; refreshHud(); }
  const tab = S.adminTab;
  render(app(), shell('admin', html`<h1>Администрирование</h1>
    <div class="tabs" style="max-width:440px"><button data-act="adminTab" data-tab="sign" class="${tab === 'sign' ? 'on' : ''}">✍️ Подписи${pending.length ? ' (' + pending.length + ')' : ''}</button><button data-act="adminTab" data-tab="users" class="${tab === 'users' ? 'on' : ''}">👤 Пользователи</button></div>
    ${tab === 'sign' ? signTab(pending) : usersTab(users)}`));
  window.scrollTo(0, keepY);
  const q = $('#usearch'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') actions.userSearch(); });
}
function signTab(list) {
  if (!list.length) return html`<div class="card center"><div style="font-size:44px">🎉</div><p class="muted" style="margin:6px 0 0">Всё проверено — подписей на модерации нет.</p></div>`;
  return html`<p class="muted small">Подписи ждут твоего решения. Пока ты не одобришь подпись, на страничке её видит только автор.</p><div class="col">
    ${list.map(s => html`<div class="card mod-card"><div class="sign-text big">«${s.text}»</div>
      <div class="small muted mt-s">от <b>${s.author.display_name}</b> (@${s.author.username}) → на страничку <b>${s.target.display_name}</b> (@${s.target.username}) · ${fmtStamp(s.updated_at)}</div>
      <div class="row wrap gap-s mt"><button class="btn sm good" data-act="modApprove" data-id="${s.id}">✅ Одобрить</button><button class="btn sm bad" data-act="modReject" data-id="${s.id}">❌ Отклонить</button></div></div>`)}</div>`;
}
actions.modApprove = async b => { busy(b, true); try { await api(`/admin/signatures/${b.dataset.id}/approve`, { method: 'POST' }); toast('Подпись опубликована', { icon: '✅', ms: 1500 }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawAdmin(); };
actions.modReject = async b => { busy(b, true); try { await api(`/admin/signatures/${b.dataset.id}/reject`, { method: 'POST' }); toast('Подпись отклонена', { icon: '❌', ms: 1500 }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawAdmin(); };

function usersTab(users) {
  return html`<div class="row gap-s mb mt" style="max-width:520px"><input type="text" id="usearch" placeholder="поиск по логину или имени" value="${S.adminQ || ''}" maxlength="64" autocomplete="off" style="flex:1"><button class="btn" data-act="userSearch">Найти</button></div>
    <p class="small muted">Всего показано: ${users.length}. Заблокированный пользователь не может войти и пользоваться сайтом, из списков друзей он пропадает.</p>
    <div class="col">${users.map(u => html`<div class="card user-card ${u.banned ? 'is-banned' : ''}">
      <div class="row">${who(u)}<div class="row wrap gap-s" style="justify-content:flex-end">${u.is_admin ? html`<span class="chip accent">админ</span>` : ''}${u.banned ? html`<span class="chip bad">🚫 заблокирован</span>` : ''}</div></div>
      <div class="row wrap gap-s"><span class="chip">Ур. ${u.level}</span><span class="chip">⭐ ${u.xp}</span><span class="chip">📚 ${u.courses} ${plural(u.courses, 'курс', 'курса', 'курсов')}</span>${u.telegram ? html`<span class="chip">✈️ Telegram</span>` : ''}</div>
      <div class="small muted">Регистрация: ${fmtStamp(u.created_at)} · ${fmtLast(u.last_active)}</div>
      ${u.banned && u.banned_reason ? html`<div class="small err" style="min-height:0">Причина: ${u.banned_reason}</div>` : ''}
      ${u.is_admin ? '' : html`<div class="row wrap gap-s">${u.banned ? html`<button class="btn sm good" data-act="unbanUser" data-id="${u.id}">Разблокировать</button>` : html`<button class="btn sm bad" data-act="banUser" data-id="${u.id}" data-name="${u.display_name} (@${u.username})">🚫 Заблокировать</button>`}<button class="btn sm ghost" data-act="resetPw" data-id="${u.id}" data-name="${u.display_name} (@${u.username})">🔑 Сбросить пароль</button><button class="btn sm ghost" data-act="deleteUser" data-id="${u.id}" data-name="${u.display_name} (@${u.username})">🗑 Удалить</button></div>`}</div>`)}</div>`;
}
actions.userSearch = () => { S.adminQ = $('#usearch').value.trim(); drawAdmin(); };
actions.banUser = b => {
  openModal(html`<h2>Заблокировать пользователя?</h2><p class="muted">${b.dataset.name}: войти он больше не сможет, пока ты его не разблокируешь. Курсы и прогресс сохранятся.</p>
    <div class="field"><label>Причина (её увидит пользователь)</label><input type="text" id="banreason" maxlength="200" placeholder="например: оскорбительные подписи" autocomplete="off"></div>
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Отмена</button><button class="btn bad" data-act="banConfirm" data-id="${b.dataset.id}">Заблокировать</button></div>`);
  setTimeout(() => { const i = $('#banreason'); if (i) i.focus(); }, 50);
};
actions.banConfirm = async b => {
  busy(b, true);
  try { await api(`/admin/users/${b.dataset.id}/ban`, { json: { reason: $('#banreason').value.trim() } }); closeModal(); toast('Пользователь заблокирован', { icon: '🚫', ms: 2200 }); }
  catch (e) { busy(b, false); toast(e.message, { icon: '⚠️' }); return; }
  if (location.hash === '#/admin') drawAdmin();  // из чата блокировка вызывается с главной — остаёмся на ней
};
actions.unbanUser = async b => { try { await api(`/admin/users/${b.dataset.id}/unban`, { method: 'POST' }); toast('Пользователь разблокирован', { icon: '✅', ms: 2000 }); } catch (e) { toast(e.message, { icon: '⚠️' }); } drawAdmin(); };
actions.deleteUser = async b => {
  if (!await askConfirm('Удалить пользователя навсегда?', `${b.dataset.name}: аккаунт, все его курсы и прогресс, подписи, связи с друзьями и аватарка будут стёрты без возможности восстановления (кроме резервной копии). Если нужно просто закрыть доступ — используй «Заблокировать».`, 'Удалить навсегда', 'Отмена', true)) return;
  try { await api(`/admin/users/${b.dataset.id}`, { method: 'DELETE' }); toast('Пользователь удалён', { icon: '🗑', ms: 2200 }); } catch (e) { toast(e.message, { icon: '⚠️' }); }
  drawAdmin();
};

/* =============================== временный пароль =============================== */
route(/^#\/newpass$/, async () => { drawNewPass(); });
function drawNewPass() {
  render(app(), html`<div class="auth-wrap"><div class="auth">
    <div class="hero"><span class="mascot">🔑</span><h1>Задай свой пароль</h1><p class="muted">Администратор сбросил тебе пароль. Введи временный пароль, который он дал, и придумай свой — им и будешь пользоваться.</p></div>
    <form class="card" id="npform" autocomplete="off">
      <div class="field"><label>Временный пароль</label><input type="text" name="cur" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Xk7P-m2Qd-Rw9F"></div>
      <div class="field"><label>Новый пароль</label><input type="password" name="pw1" required minlength="6" autocomplete="new-password" placeholder="не короче 6 символов"></div>
      <div class="field"><label>Повтори новый пароль</label><input type="password" name="pw2" required minlength="6" autocomplete="new-password"></div>
      <div class="err" id="nperr"></div>
      <button class="btn block lg" type="submit">Сохранить пароль</button>
      <button class="btn ghost block mt" type="button" data-act="logout">Выйти</button>
    </form></div></div>`);
  $('#npform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements, err = $('#nperr'), btn = $('button[type=submit]', e.target);
    err.textContent = '';
    if (f.pw1.value !== f.pw2.value) { err.textContent = 'Пароли не совпадают'; return; }
    if (f.pw1.value === f.cur.value.trim()) { err.textContent = 'Новый пароль должен отличаться от временного'; return; }
    busy(btn, true);
    try {
      const r = await api('/me/password', { json: { current_password: f.cur.value.trim(), new_password: f.pw1.value } });
      Token.set(r.token); S.user = await api('/me');
      toast('Пароль сохранён. Теперь можно пользоваться сайтом', { icon: '🔑', ms: 3200 });
      location.hash = '#/';
    } catch (er) { busy(btn, false); err.textContent = er.message; }
  });
}

/* администратор: сброс пароля пользователя */
actions.resetPw = async b => {
  if (!await askConfirm('Сбросить пароль?', `${b.dataset.name}: старый пароль перестанет работать, все его устройства выйдут. Ты увидишь временный пароль — передай его пользователю, при входе он задаст свой.`, 'Сбросить', 'Отмена', true)) return;
  try {
    const r = await api(`/admin/users/${b.dataset.id}/reset-password`, { method: 'POST' });
    openModal(html`<h2>🔑 Новый пароль</h2><p class="muted" style="margin-top:0">${b.dataset.name}</p>
      <div class="code-box" id="tmpPw">${r.password}</div>
      <p class="small muted mt">Показывается один раз: после закрытия окна увидеть его снова нельзя (можно сбросить ещё раз). Передай пользователю лично или в личном сообщении. При входе он обязан задать свой пароль.</p>
      <div class="row mt wrap"><button class="btn" data-act="copyTmpPw" data-pw="${r.password}">📋 Скопировать</button><button class="btn ghost" data-act="closeModal">Готово</button></div>`);
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
};
actions.copyTmpPw = async b => {
  try { await navigator.clipboard.writeText(b.dataset.pw); toast('Пароль скопирован', { icon: '📋', ms: 1800 }); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($('#tmpPw')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Выдели и скопируй пароль вручную', { icon: 'ℹ️' }); }
};
