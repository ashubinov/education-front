/* LearnQuest — «Кланы»: любой игрок создаёт свой клан или вступает в любой открытый (один клан на игрока).
   Рейтинг кланов — по XP участников за неделю. Всё проверяет сервер (/api/clans/*); тег клана виден в профилях, у друзей и в чате. */
'use strict';

const CL = { sort: 'week', q: '', formOpen: false, emoji: '🛡️', editOpen: false, editEmoji: '', timer: null, busy: false };
const CL_SORTS = [['week', 'За неделю'], ['total', 'За всё время'], ['members', 'Участники'], ['new', 'Новые']];
const clFmt = n => Number(n || 0).toLocaleString('ru-RU');
/** Метка клана рядом с именем: «🐺 VLK». Пустая строка, если клана нет. */
const clanTag = c => c ? html`<span class="clan-tag" title="Клан «${c.name}»">${c.emoji} ${c.tag}</span>` : '';

route(/^#\/clans$/, async () => { await drawClans(); });
route(/^#\/clan\/(\d+)$/, async id => { await drawClan(+id); });

/* ---------- общие действия ---------- */
async function clDo(btn, fn, okText, okIcon) {
  if (CL.busy) return false;
  CL.busy = true; if (btn) busy(btn, true);
  try { const r = await fn(); if (okText) toast(okText, { icon: okIcon || '🏰', ms: 2200 }); refreshMe(); return r === undefined ? true : r; }
  catch (e) { toast(e.message, { icon: '⚠️' }); return false; }
  finally { CL.busy = false; if (btn && btn.isConnected) busy(btn, false); }
}
actions.clOpen = b => { location.hash = '#/clan/' + b.dataset.id; };
actions.clJoin = async (b, e) => {
  e && e.stopPropagation();
  if (await clDo(b, () => api(`/clans/${b.dataset.id}/join`, { method: 'POST' }), 'Ты в клане!', '🎉')) router();
};
actions.clLeave = async b => {
  const lead = CL.cur && CL.cur.me.is_leader && CL.cur.members > 1;
  if (!await askConfirm('Выйти из клана?', lead ? 'Ты лидер: лидерство перейдёт самому давнему участнику.' : (CL.cur && CL.cur.members <= 1 ? 'Ты последний участник — клан исчезнет.' : 'Ты сможешь вступить обратно, пока в клане есть место.'), 'Выйти', 'Отмена', true)) return;
  if (await clDo(b, () => api('/clans/leave', { method: 'POST' }), 'Ты вышел из клана', '👋')) location.hash = '#/clans';
};

/* ---------- список кланов ---------- */
async function clLoad() { return api(`/clans?sort=${CL.sort}&q=${encodeURIComponent(CL.q)}`); }
function clRow(c, mineId) {
  const full = c.members >= c.max_members;
  const act = mineId ? (c.id === mineId ? html`<span class="chip good">Твой клан</span>` : '')
    : full ? html`<span class="chip">Заполнен</span>` : html`<button class="btn sm" data-act="clJoin" data-id="${c.id}">Вступить</button>`;
  return html`<div class="card cl-row" data-act="clOpen" data-id="${c.id}">
    <div class="cl-rank" title="Место по XP за неделю">#${c.rank}</div><span class="pav">${c.emoji}</span>
    <div class="grow cl-main"><div class="cl-name"><b>${c.name}</b><span class="clan-tag">${c.tag}</span></div>
      <div class="small muted">${c.description || (c.leader ? 'Лидер: ' + c.leader.display_name : '')}</div>
      <div class="row wrap gap-s mt-s"><span class="chip">👥 ${c.members}/${c.max_members}</span><span class="chip accent">⭐ ${clFmt(c.week_xp)} за неделю</span><span class="chip">Σ ${clFmt(c.total_xp)} XP</span></div></div>
    <div class="cl-act">${act}</div></div>`;
}
function clRows(d) {
  return d.clans.length ? html`${d.clans.map(c => clRow(c, d.mine))}`
    : html`<div class="card center"><div style="font-size:44px">🏰</div><p class="muted" style="margin:6px 0 0">${CL.q ? 'Ничего не нашлось.' : 'Кланов пока нет — создай первый!'}</p></div>`;
}
function clCreateForm(d) {
  if (!d.can_create) return '';
  if (!CL.formOpen) return html`<div class="card cl-create mb"><div class="row wrap"><div class="grow"><b>Свой клан</b><div class="small muted">Придумай название и тег — в любой клан можно вступить, а можно собрать свой.</div></div><button class="btn" data-act="clToggleForm">➕ Создать клан</button></div></div>`;
  const L = d.limits;
  return html`<div class="card cl-create mb"><h3>➕ Новый клан</h3>
    <div class="field"><label>Название (${L.name[0]}–${L.name[1]} символов)</label><input type="text" id="cl-name" maxlength="${L.name[1]}" placeholder="Например, Волки Севера" autocomplete="off"></div>
    <div class="field"><label>Тег (${L.tag[0]}–${L.tag[1]} букв или цифр)</label><input type="text" id="cl-tag" maxlength="${L.tag[1]}" placeholder="VLK" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase"></div>
    <div class="field"><label>Эмодзи</label><div class="emoji-pick" id="cl-emojis">${d.emojis.map(e => html`<button type="button" class="${CL.emoji === e ? 'on' : ''}" data-act="clPickEmoji" data-v="${e}">${e}</button>`)}</div></div>
    <div class="field"><label>Описание (необязательно, до ${L.description} символов)</label><input type="text" id="cl-desc" maxlength="${L.description}" placeholder="Чем занимается клан" autocomplete="off"></div>
    <div class="err" id="cl-err"></div>
    <div class="row wrap gap-s"><button class="btn good" data-act="clCreate">Создать</button><button class="btn ghost" data-act="clToggleForm">Отмена</button></div></div>`;
}
async function drawClans() {
  const keepY = window.scrollY;
  const [d, mine] = await Promise.all([clLoad(), api('/clans/mine')]);
  const m = mine.clan;
  render(app(), shell('clans', html`<div class="page-narrow cl-page"><h1>Кланы</h1>
    ${m ? html`<div class="card cl-mine mb"><div class="row wrap"><span class="pav xl">${m.emoji}</span>
        <div class="grow"><div class="small muted">Твой клан · #${m.rank} в рейтинге недели</div><h2 style="margin:2px 0">${m.name} <span class="clan-tag">${m.tag}</span></h2>
          <div class="small muted">${m.description}</div>
          <div class="row wrap gap-s mt-s"><span class="chip">👥 ${m.members}/${m.max_members}</span><span class="chip accent">⭐ ${clFmt(m.week_xp)} за неделю</span></div></div>
        <a class="btn" href="#/clan/${m.id}">Открыть</a></div></div>` : ''}
    ${clCreateForm(d)}
    <div class="cl-toolbar"><input type="text" id="cl-q" value="${CL.q}" placeholder="Поиск по названию или тегу" maxlength="40" autocomplete="off">
      <div class="tabs cl-tabs">${CL_SORTS.map(s => html`<button class="${CL.sort === s[0] ? 'on' : ''}" data-act="clSort" data-v="${s[0]}">${s[1]}</button>`)}</div></div>
    <div class="col" id="cl-list">${clRows(d)}</div>
    <p class="small muted center mt">Место в рейтинге — по XP участников за последние 7 дней.</p></div>`));
  window.scrollTo(0, keepY);
  const q = $('#cl-q');
  q.addEventListener('input', () => {
    clearTimeout(CL.timer);
    CL.timer = setTimeout(async () => {
      CL.q = q.value.trim();
      try { const nd = await clLoad(); const box = $('#cl-list'); if (box && $('#cl-q') === q) box.innerHTML = unraw(clRows(nd)); } catch (e) { /* ignore */ }
    }, 250);
  });
}
actions.clSort = b => { CL.sort = b.dataset.v; drawClans(); };
actions.clToggleForm = () => { CL.formOpen = !CL.formOpen; drawClans(); };
actions.clPickEmoji = b => { CL.emoji = b.dataset.v; $$('#cl-emojis button').forEach(x => x.classList.toggle('on', x.dataset.v === CL.emoji)); };
actions.clCreate = async b => {
  const err = $('#cl-err'); err.textContent = '';
  if (CL.busy) return;
  CL.busy = true; busy(b, true);
  try {
    const c = await api('/clans', { json: { name: $('#cl-name').value, tag: $('#cl-tag').value, emoji: CL.emoji, description: $('#cl-desc').value } });
    CL.formOpen = false; toast(`Клан «${c.name}» создан`, { icon: '🏰', ms: 2600 }); refreshMe(); location.hash = '#/clan/' + c.id;
  } catch (e) { err.textContent = e.message; busy(b, false); }
  finally { CL.busy = false; }
};

/* ---------- страница клана ---------- */
async function drawClan(id) {
  let c;
  try { c = await api('/clans/' + id); }
  catch (e) { if (e.status === 404) { toast('Такого клана нет — возможно, его распустили', { icon: '🏰' }); location.hash = '#/clans'; return; } throw e; }
  CL.cur = c; const me = c.me;
  if (!CL.editEmoji || CL.editFor !== c.id) { CL.editEmoji = c.emoji; CL.editFor = c.id; CL.editOpen = false; }
  const full = c.members >= c.max_members;
  const acts = me.in_this ? html`<button class="btn ghost" data-act="clLeave">Выйти из клана</button>`
    : (!me.in_other ? (full ? html`<span class="chip">Клан заполнен</span>` : html`<button class="btn good" data-act="clJoin" data-id="${c.id}">Вступить в клан</button>`) : html`<span class="small muted">Ты уже в другом клане</span>`);
  render(app(), shell('clans', html`<div class="page-narrow cl-page"><a href="#/clans" class="small back">← Все кланы</a>
    <div class="card cl-head mb mt-s"><div class="row wrap"><span class="pav xl">${c.emoji}</span>
      <div class="grow"><h2 style="margin:0">${c.name} <span class="clan-tag">${c.tag}</span></h2>
        <div class="small muted">${c.description || 'Описания пока нет.'}</div>
        <div class="row wrap gap-s mt-s"><span class="chip accent">#${c.rank} по неделе</span><span class="chip">👥 ${c.members}/${c.max_members}</span><span class="chip good">⭐ ${clFmt(c.week_xp)} за неделю</span><span class="chip">Σ ${clFmt(c.total_xp)} XP</span></div></div></div>
      <div class="row wrap gap-s mt">${acts}${me.can_manage ? html`<button class="btn sm ghost" data-act="clEditToggle">${CL.editOpen ? 'Скрыть настройки' : '⚙️ Настройки клана'}</button>` : ''}</div>
      ${me.can_manage && CL.editOpen ? html`<div class="cl-edit mt"><div class="field"><label>Эмодзи</label><div class="emoji-pick" id="cl-eemojis">${c.emojis.map(e => html`<button type="button" class="${CL.editEmoji === e ? 'on' : ''}" data-act="clPickEditEmoji" data-v="${e}">${e}</button>`)}</div></div>
        <div class="field"><label>Описание (до ${c.limits.description} символов)</label><input type="text" id="cl-edesc" value="${c.description}" maxlength="${c.limits.description}" autocomplete="off"></div>
        <div class="row wrap gap-s"><button class="btn sm good" data-act="clSave">Сохранить</button><button class="btn sm bad" data-act="clDisband">${me.is_leader ? 'Распустить клан' : 'Распустить клан (админ)'}</button></div></div>` : ''}
    </div>
    <h3>Участники <span class="muted small">${c.members}</span></h3>
    <div class="card"><div class="col">${c.members_list.map((m, i) => html`<div class="row person cl-member">
      <span class="cl-rank sm">${i + 1}</span><span class="pav sm">${av(m)}</span>
      <div class="grow pname"><b>${m.display_name}</b>${m.role === 'leader' ? html` <span title="Лидер клана">👑</span>` : ''}<div class="small muted">Ур. ${m.level} · ${m.streak ? '🔥 ' + m.streak + ' · ' : ''}⭐ ${clFmt(m.week_xp)} за неделю</div></div>
      ${me.is_leader && m.role !== 'leader' ? html`<button class="btn sm ghost" data-act="clLead" data-id="${m.id}" data-name="${m.display_name}" title="Передать лидерство">👑</button>` : ''}
      ${me.can_manage && m.role !== 'leader' ? html`<button class="btn sm ghost" data-act="clKick" data-id="${m.id}" data-name="${m.display_name}">Исключить</button>` : ''}</div>`)}</div></div>
    <p class="small muted center mt">Лидер: ${c.leader ? c.leader.display_name : '—'} · клан создан ${fmtStamp(c.created_at)}</p></div>`));
}
actions.clEditToggle = () => { CL.editOpen = !CL.editOpen; drawClan(CL.cur.id); };
actions.clPickEditEmoji = b => { CL.editEmoji = b.dataset.v; $$('#cl-eemojis button').forEach(x => x.classList.toggle('on', x.dataset.v === CL.editEmoji)); };
actions.clSave = async b => {
  if (await clDo(b, () => api('/clans/' + CL.cur.id, { method: 'PUT', json: { emoji: CL.editEmoji, description: $('#cl-edesc').value } }), 'Сохранено', '✅')) drawClan(CL.cur.id);
};
actions.clKick = async b => {
  if (!await askConfirm('Исключить участника?', `${b.dataset.name} покинет клан. Вступить обратно он сможет сам, пока есть место.`, 'Исключить', 'Отмена', true)) return;
  if (await clDo(b, () => api(`/clans/${CL.cur.id}/kick/${b.dataset.id}`, { method: 'POST' }), 'Участник исключён', '👢')) drawClan(CL.cur.id);
};
actions.clLead = async b => {
  if (!await askConfirm('Передать лидерство?', `Лидером станет ${b.dataset.name}, а ты останешься обычным участником.`, 'Передать', 'Отмена')) return;
  if (await clDo(b, () => api(`/clans/${CL.cur.id}/leader/${b.dataset.id}`, { method: 'POST' }), 'Лидерство передано', '👑')) drawClan(CL.cur.id);
};
actions.clDisband = async b => {
  if (!await askConfirm('Распустить клан?', `Клан «${CL.cur.name}» исчезнет вместе с рейтингом, участники останутся без клана.`, 'Распустить', 'Отмена', true)) return;
  if (await clDo(b, () => api('/clans/' + CL.cur.id, { method: 'DELETE' }), 'Клан распущен', '💥')) location.hash = '#/clans';
};
