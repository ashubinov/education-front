/* LearnQuest — планировщик: «Сегодня», «Задачи», «Календарь».
   Логика без DOM (даты, быстрый ввод, повторы, выборки) — в planner-logic.js (глобальный PL), здесь только экраны и запросы к API. */
'use strict';

const PLN = { tasks: [], projects: [], loaded: false, page: null, subFor: null, showDone: false, undoTimer: null, plan: null };
const PRIO = { 1: ['Срочно', 'p1'], 2: ['Важно', 'p2'], 3: ['Средне', 'p3'], 4: ['Обычный', 'p4'] };
const planToday = () => todayISO();
const planKnown = () => PL.withKnownProjects(PLN.tasks, PLN.projects);
const planTask = id => PLN.tasks.find(t => t.id === id);
const planProject = id => PLN.projects.find(p => p.id === id);
const planGuard = fn => async (...a) => { try { return await fn(...a); } catch (e) { if (e.message !== 'Нужно войти') toast(e.message, { icon: '⚠️' }); } };

function planMerge(rows) { for (const r of rows) { const i = PLN.tasks.findIndex(t => t.id === r.id); if (i >= 0) PLN.tasks[i] = r; else PLN.tasks.push(r); } }
function planDrop(ids) { const s = new Set(ids); PLN.tasks = PLN.tasks.filter(t => !s.has(t.id)); }
async function planLoad() { const s = await api('/tasks'); PLN.tasks = s.tasks; PLN.projects = s.projects; PLN.loaded = true; }
const planLoading = () => html`<div class="center muted mt-l"><span class="spinner"></span></div>`;

/* ---------- отмена последнего действия ---------- */
function planUndo(text, rows) {
  clearTimeout(PLN.undoTimer);
  let bar = $('#pl-undo');
  if (!bar) { bar = document.createElement('div'); bar.id = 'pl-undo'; bar.className = 'pl-undo'; document.body.appendChild(bar); }
  PLN.undoRows = rows;
  bar.innerHTML = `<span>${esc(text)}</span><button data-act="pUndo">Отменить</button>`;
  bar.classList.add('show');
  PLN.undoTimer = setTimeout(() => bar.classList.remove('show'), 8000);
}
actions.pUndo = planGuard(async () => {
  const rows = PLN.undoRows; PLN.undoRows = null; $('#pl-undo')?.classList.remove('show');
  if (!rows || !rows.length) return;
  const r = await api('/tasks/restore', { json: { tasks: rows } });
  planMerge(r.tasks); planChanged();
});

/** После любого изменения задач: перерисовать текущий экран (а «Сегодня» ещё и пересчитать проценты). */
function planChanged() {
  const pg = PLN.page; if (!pg) return;
  pg.redraw();
  if (pg.kind === 'today') planReloadPlan();
}
async function planReloadPlan() {
  try {
    const before = PLN.plan ? PLN.plan.percent : null;
    PLN.plan = await api('/today?today=' + planToday());
    if (PLN.page && PLN.page.kind === 'today') {
      PLN.page.redrawHead();
      if (before !== null && before < 100 && PLN.plan.percent === 100 && PLN.plan.required_total > 0) { confetti(90); toast('Все дела на сегодня сделаны', { icon: '🎉' }); }
    }
  } catch (e) { /* ignore */ }
}

/* ---------- быстрый ввод ---------- */
function quickForm(placeholder) {
  return html`<form class="pl-quick" id="pl-quick" autocomplete="off"><input type="text" id="pl-q" maxlength="400" placeholder="${placeholder}" enterkeyhint="done"><button class="btn sm" type="submit">＋ Добавить</button></form>
    <div class="pl-prev" id="pl-prev"></div>`;
}
function quickPreview(text) {
  const el = $('#pl-prev'); if (!el) return;
  if (!text.trim()) { el.innerHTML = '<span class="muted small">Например: «Позвонить маме завтра в 18:00 !1 #дом @важно», «Зарядка каждый день в 7:30», «Сдать лабу 15 октября»</span>'; return; }
  const q = PL.parseQuick(text, planToday(), PLN.projects), today = planToday(), c = [];
  if (q.due) c.push(`<span class="chip accent">📅 ${esc(PL.dueText(q.due, q.due_time, today))}</span>`);
  if (q.recur) c.push(`<span class="chip">🔁 ${esc(PL.recurText(q.recur))}</span>`);
  if (q.priority < 4) c.push(`<span class="chip ${q.priority === 1 ? 'bad' : 'warn'}">${esc(PRIO[q.priority][0])}</span>`);
  if (q.project_id) c.push(`<span class="chip">${esc(planProject(q.project_id).emoji)} ${esc(planProject(q.project_id).name)}</span>`);
  if (q.unknown_project) c.push(`<span class="chip">📁 новый проект «${esc(q.unknown_project)}»</span>`);
  for (const l of q.labels) c.push(`<span class="chip">@${esc(l)}</span>`);
  el.innerHTML = c.join('') || '<span class="muted small">Название задачи</span>';
}
async function planSubmitQuick(text) {
  const ctx = PLN.page.qdefaults ? PLN.page.qdefaults() : {}, today = planToday(), q = PL.parseQuick(text, today, PLN.projects);
  if (!q.title) { toast('Напиши название задачи', { icon: '✍️' }); return false; }
  let project_id = q.project_id ?? ctx.project_id ?? null;
  if (q.unknown_project) { const pr = await api('/task-projects', { json: { name: q.unknown_project, emoji: '📁' } }); if (!planProject(pr.id)) PLN.projects.push(pr); project_id = pr.id; }
  const due = q.due ?? (q.recur ? null : ctx.due ?? null);
  const labels = [...new Set([...(ctx.labels || []), ...q.labels])];
  const t = await api('/tasks', { json: { title: q.title, project_id, priority: q.priority, due, due_time: due ? q.due_time : null, recur: q.recur, labels, today } });
  planMerge([t]); return true;
}

/* ---------- строка задачи ---------- */
function dueChip(t, today) {
  if (!t.due) return '';
  const diff = PL.daysBetween(today, t.due), cls = t.done ? '' : diff < 0 ? 'bad' : diff === 0 ? 'good' : '';
  return html`<span class="chip pl-due ${cls}">📅 ${PL.dueText(t.due, t.due_time, today)}</span>`;
}
function taskRow(t, level = 1, opts = {}) {
  const today = planToday(), pr = t.project_id ? planProject(t.project_id) : null, kids = PLN.tasks.filter(k => k.parent_id === t.id), kd = kids.filter(k => k.done).length;
  return html`<div class="pl-task ${t.done ? 'done' : ''} ${PRIO[t.priority][1]}" data-id="${t.id}">
    <button class="pl-check" data-act="pToggle" data-id="${t.id}" aria-label="${t.done ? 'Вернуть в работу' : 'Отметить выполненной'}" title="${t.done ? 'Вернуть в работу' : 'Выполнено'}">${t.done ? '✓' : ''}</button>
    <div class="pl-body">
      <button class="pl-title" data-act="pEdit" data-id="${t.id}">${t.title}</button>
      <div class="pl-meta">${dueChip(t, today)}${t.recur ? html`<span class="chip">🔁 ${PL.recurText(t.recur)}</span>` : ''}${pr && !opts.noProject ? html`<span class="chip">${pr.emoji} ${pr.name}</span>` : ''}${t.labels.map(l => html`<a class="chip pl-label" href="#/tasks?v=${'l:' + encodeURIComponent(l)}">@${l}</a>`)}${kids.length ? html`<span class="chip">☑ ${kd}/${kids.length}</span>` : ''}${t.note ? html`<span class="chip" title="${t.note}">📝</span>` : ''}</div>
    </div>
    ${level < 3 && !t.done ? html`<button class="icon-btn pl-sub" data-act="pSubAdd" data-id="${t.id}" title="Добавить подзадачу" aria-label="Добавить подзадачу">＋</button>` : ''}
  </div>`;
}
function taskTree(nodes, level = 1, opts = {}) {
  return nodes.map(n => html`${taskRow(n.task, level, opts)}${PLN.subFor === n.task.id ? html`<form class="pl-subform" data-id="${n.task.id}" autocomplete="off"><input type="text" maxlength="300" placeholder="Подзадача — Enter" aria-label="Название подзадачи"></form>` : ''}${n.children.length ? html`<div class="pl-kids">${taskTree(n.children, level + 1, opts)}</div>` : ''}`);
}
/** Совпавшие задачи + их незакрытые подзадачи, собранные в дерево. */
function expandNest(matched, all, withDone = false) {
  const ids = new Set(matched.map(t => t.id)), out = [...matched];
  for (const t of matched) for (const d of PL.descendants(all, t.id)) if (!ids.has(d.id) && (withDone || !d.done)) { ids.add(d.id); out.push(d); }
  out.sort(PL.compareTasks);
  return PL.nest(out);
}
const section = (title, count, body, cls = '') => html`<section class="pl-sec ${cls}"><h3>${title} <span class="chip">${count}</span></h3>${body}</section>`;
const emptyBox = (icon, title, text) => html`<div class="pl-empty"><div class="pl-empty-i">${icon}</div><b>${title}</b><div class="muted small">${text}</div></div>`;

/* ---------- действия над задачами ---------- */
actions.pToggle = planGuard(async el => {
  const id = Number(el.dataset.id), t = planTask(id); if (!t) return;
  const snap = [t, ...PL.descendants(PLN.tasks, id)].map(x => ({ ...x }));
  const r = await api(`/tasks/${id}/toggle`, { json: { today: planToday() } });
  const ancestors = []; for (let p = planTask(t.parent_id); p; p = planTask(p.parent_id)) ancestors.push({ ...p });
  planMerge(r.changed);
  if (!t.done) {
    planUndo(r.rescheduled_to ? `Повторится: ${PL.dueText(r.rescheduled_to, null, planToday())}` : `Выполнено: «${t.title.length > 40 ? t.title.slice(0, 40) + '…' : t.title}»`, [...snap, ...ancestors]);
    if (!r.rescheduled_to) xpPop('✓', el);
  }
  planChanged();
});
actions.pSubAdd = el => { const id = Number(el.dataset.id); PLN.subFor = PLN.subFor === id ? null : id; PLN.page && PLN.page.redraw(); if (PLN.subFor) $('.pl-subform input')?.focus(); };
actions.pEdit = el => planEditor(planTask(Number(el.dataset.id)));

/* ---------- окно редактирования ---------- */
const WD_BTN = [[1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [0, 'Вс']];
function planEditor(t) {
  if (!t) return;
  const isSub = !!t.parent_id, r = t.recur || null, kind = r ? r.kind : '', days = r && r.days ? r.days : [];
  const m = openModal(html`<h2>Задача</h2>
    <form id="pl-edit" data-id="${t.id}" autocomplete="off">
      <div class="field"><label>Название</label><input type="text" name="title" maxlength="300" value="${t.title}" required></div>
      <div class="row wrap gap-s">
        <div class="field grow"><label>Срок</label><input type="date" name="due" value="${t.due || ''}"></div>
        <div class="field grow"><label>Время</label><input type="time" name="time" value="${t.due_time || ''}"></div>
      </div>
      <div class="row wrap gap-s">
        <div class="field grow"><label>Приоритет</label><select name="priority">${[1, 2, 3, 4].map(p => html`<option value="${p}" ${t.priority === p ? 'selected' : ''}>${PRIO[p][0]}</option>`)}</select></div>
        ${isSub ? '' : html`<div class="field grow"><label>Проект</label><select name="project"><option value="">📥 Входящие</option>${PLN.projects.map(p => html`<option value="${p.id}" ${t.project_id === p.id ? 'selected' : ''}>${p.emoji} ${p.name}</option>`)}</select></div>`}
      </div>
      <div class="field"><label>Метки</label><input type="text" name="labels" maxlength="300" placeholder="важно, дом" value="${t.labels.join(', ')}"></div>
      ${isSub ? '' : html`<div class="field"><label>Повтор</label>
        <div class="row wrap gap-s">
          <select name="rk" style="width:auto;min-width:170px"><option value="">Не повторять</option>${[['day', 'Каждый день'], ['weekdays', 'По будням'], ['week', 'По неделям'], ['month', 'По месяцам']].map(([k, n]) => html`<option value="${k}" ${kind === k ? 'selected' : ''}>${n}</option>`)}</select>
          <span class="pl-rev"><span class="muted small">каждые</span> <input type="number" name="re" min="1" max="365" value="${r ? r.every : 1}" style="width:76px"> <span class="muted small" id="pl-eu"></span></span>
        </div>
        <div class="pl-rd row wrap gap-s mt-s">${WD_BTN.map(([d, n]) => html`<label class="pl-wd"><input type="checkbox" name="rd" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${n}</span></label>`)}</div>
        <div class="small muted" id="pl-rt"></div></div>`}
      <div class="field"><label>Заметка</label><textarea name="note" maxlength="4000" style="min-height:80px">${t.note}</textarea></div>
      <div class="err" id="pl-err"></div>
      <div class="pl-actions"><button type="button" class="btn ghost sm pl-a-del" data-act="pDelete" data-id="${t.id}">🗑 Удалить</button>
        <button type="button" class="btn ghost pl-a-no" data-act="closeModal">Отмена</button><button type="submit" class="btn pl-a-ok">Сохранить</button></div>
    </form>`);
  planSyncRecur(m.querySelector('form'));
}
function planSyncRecur(f) {
  const k = f.elements.rk; if (!k) return;
  const kind = k.value, every = Math.max(1, Math.min(365, Number(f.elements.re.value) || 1));
  f.querySelector('.pl-rev').classList.toggle('hidden', !(kind === 'day' || kind === 'week' || kind === 'month'));
  f.querySelector('.pl-rd').classList.toggle('hidden', kind !== 'week');
  f.querySelector('#pl-eu').textContent = kind === 'day' ? PL.plural(every, 'день', 'дня', 'дней') : kind === 'week' ? PL.plural(every, 'неделю', 'недели', 'недель') : kind === 'month' ? PL.plural(every, 'месяц', 'месяца', 'месяцев') : '';
  const rule = planReadRecur(f);
  f.querySelector('#pl-rt').textContent = rule ? '🔁 ' + PL.recurText(rule) : '';
}
function planReadRecur(f) {
  const kind = f.elements.rk ? f.elements.rk.value : ''; if (!kind) return null;
  const rule = { kind, every: kind === 'weekdays' ? 1 : Math.max(1, Math.min(365, Number(f.elements.re.value) || 1)) };
  if (kind === 'week') { const d = [...f.querySelectorAll('input[name=rd]:checked')].map(x => Number(x.value)); if (d.length) rule.days = d.sort((a, b) => a - b); }
  return rule;
}
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
async function planSaveEdit(f) {
  const id = Number(f.dataset.id), t = planTask(id); if (!t) return closeModal();
  const title = f.elements.title.value.trim(); if (!title) { $('#pl-err').textContent = 'Название не может быть пустым'; return; }
  const due = f.elements.due.value || null, time = due ? (f.elements.time.value || null) : null;
  const labels = f.elements.labels.value.split(/[,;\s]+/).map(s => s.replace(/^@/, '').trim().toLowerCase()).filter(Boolean);
  const patch = {};
  if (title !== t.title) patch.title = title;
  if (due !== t.due) patch.due = due;
  if (time !== t.due_time) patch.due_time = time;
  if (Number(f.elements.priority.value) !== t.priority) patch.priority = Number(f.elements.priority.value);
  if (f.elements.project) { const pid = f.elements.project.value ? Number(f.elements.project.value) : null; if (pid !== t.project_id) patch.project_id = pid; }
  if (f.elements.rk) { const rule = planReadRecur(f); if (!sameJson(rule, t.recur)) patch.recur = rule; }
  if (!sameJson(labels, t.labels)) patch.labels = labels;
  if (f.elements.note.value !== t.note) patch.note = f.elements.note.value;
  if (!Object.keys(patch).length) return closeModal();
  const snap = { ...t };
  try {
    const nt = await api('/tasks/' + id, { method: 'PUT', json: { ...patch, today: planToday() } });
    planMerge([nt]);
    if (patch.project_id !== undefined) { const fresh = await api('/tasks'); PLN.tasks = fresh.tasks; }
    closeModal(); planUndo('Задача изменена', [snap]); planChanged();
  } catch (e) { $('#pl-err').textContent = e.message; }
}
actions.pDelete = planGuard(async el => {
  const id = Number(el.dataset.id), t = planTask(id); if (!t) return;
  const r = await api('/tasks/' + id, { method: 'DELETE' });
  planDrop(r.deleted.map(x => x.id)); closeModal();
  planUndo(r.deleted.length > 1 ? `Удалено задач: ${r.deleted.length}` : 'Задача удалена', r.deleted); planChanged();
});

/* ---------- проекты ---------- */
function planProjectEditor(p) {
  openModal(html`<h2>${p ? 'Проект' : 'Новый проект'}</h2>
    <form id="pl-proj" data-id="${p ? p.id : ''}" autocomplete="off">
      <div class="row gap-s"><div class="field"><label>Значок</label><input type="text" name="emoji" maxlength="4" value="${p ? p.emoji : '📁'}" style="width:84px;text-align:center"></div>
        <div class="field grow"><label>Название</label><input type="text" name="name" maxlength="80" value="${p ? p.name : ''}" required></div></div>
      <div class="err" id="pl-err"></div>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="closeModal">Отмена</button><button type="submit" class="btn">${p ? 'Сохранить' : 'Создать'}</button></div>
    </form>`);
  $('#pl-proj input[name=name]')?.focus();
}
actions.pProjAdd = () => planProjectEditor(null);
actions.pProjEdit = el => planProjectEditor(planProject(Number(el.dataset.id)));
async function planSaveProject(f) {
  const id = f.dataset.id ? Number(f.dataset.id) : null, body = { name: f.elements.name.value, emoji: f.elements.emoji.value || '📁' };
  try {
    const pr = id ? await api('/task-projects/' + id, { method: 'PUT', json: body }) : await api('/task-projects', { json: body });
    const i = PLN.projects.findIndex(p => p.id === pr.id); if (i >= 0) PLN.projects[i] = pr; else PLN.projects.push(pr);
    closeModal();
    if (!id) location.hash = '#/tasks?v=p:' + pr.id; else planChanged();
  } catch (e) { $('#pl-err').textContent = e.message; }
}
actions.pProjDel = planGuard(async el => {
  const id = Number(el.dataset.id), p = planProject(id); if (!p) return;
  const n = PLN.tasks.filter(t => t.project_id === id).length;
  if (!await askConfirm(`Удалить проект «${p.name}»?`, n ? `Вместе с проектом удалятся его задачи (${n}). Это нельзя отменить.` : 'Проект пустой.', 'Удалить', 'Отмена', true)) return;
  await api('/task-projects/' + id, { method: 'DELETE' });
  PLN.projects = PLN.projects.filter(x => x.id !== id); PLN.tasks = PLN.tasks.filter(t => t.project_id !== id);
  location.hash = '#/tasks?v=inbox';
});
actions.pClearDone = planGuard(async () => {
  const done = PLN.tasks.filter(t => t.done); if (!done.length) return;
  if (!await askConfirm('Очистить выполненные?', `Будет удалено задач: ${done.length}.`, 'Очистить', 'Отмена', true)) return;
  const snap = done.map(x => ({ ...x }));
  await api('/tasks/completed', { method: 'DELETE' });
  planDrop(snap.map(x => x.id)); planUndo(`Удалено выполненных: ${snap.length}`, snap); planChanged();
});
actions.pToggleDone = () => { PLN.showDone = !PLN.showDone; PLN.page && PLN.page.redraw(); };

/* ---------- экран «Сегодня» ---------- */
route(/^#\/today(?:\?.*)?$/, async () => {
  render($('#app'), shell('today', html`${planLoading()}`));
  const [plan] = await Promise.all([api('/today?today=' + planToday()), planLoad()]);
  PLN.plan = plan; PLN.subFor = null;
  render($('#app'), shell('today', html`
    <div id="pl-head"></div>
    <div class="card mt">
      <div class="row spread wrap"><h3 style="margin:0">Задачи на сегодня</h3><a class="small" href="#/tasks?v=upcoming">Все задачи →</a></div>
      <div class="mt">${quickForm('Новая задача на сегодня…')}</div>
      <div id="pl-list" class="mt"></div>
    </div>`));
  PLN.page = {
    kind: 'today', qdefaults: () => ({ due: planToday() }),
    redrawHead() {
      const pl = PLN.plan, today = planToday(), items = pl.items;
      const left = Math.round(pl.minutes_left);
      $('#pl-head').innerHTML = unraw(html`<div class="card quest">
        <div class="ring">${ringSvg(pl.percent, 120, pl.percent >= 100 ? 'var(--good)' : 'var(--accent)')}<div class="t"><div><div style="font-size:26px">${pl.percent}%</div><div class="small muted">на сегодня</div></div></div></div>
        <div class="grow">
          <h2 style="margin:0 0 4px">${PL.longDay(today)}</h2>
          <div class="muted">${pl.required_total ? (pl.percent >= 100 ? 'Всё сделано — можно отдыхать 🎉' : `Сделано ${pl.required_done} из ${pl.required_total}${left ? ` · осталось ≈ ${left} мин` : ''}`) : 'Обязательных дел на сегодня нет'}</div>
          <div class="row wrap gap-s mt-s">
            <span class="chip ${pl.streak.done_today ? 'good' : pl.streak.at_risk ? 'warn' : ''}">🔥 серия ${pl.streak.current}${pl.streak.at_risk ? ' · не потеряй сегодня' : ''}</span>
            ${pl.tasks_done_today ? html`<span class="chip good">✅ задач сегодня: ${pl.tasks_done_today}</span>` : ''}
            ${pl.tasks_tomorrow ? html`<span class="chip">завтра: ${pl.tasks_tomorrow} ${PL.plural(pl.tasks_tomorrow, 'задача', 'задачи', 'задач')}</span>` : ''}
          </div>
        </div></div>
      ${items.length ? html`<div class="pl-items mt">${items.map(planItem)}</div>` : emptyBox('🌤', 'Пока нет дел', 'Добавь курс с дедлайном или создай задачу ниже.')}`);
    },
    redraw() {
      const all = planKnown(), today = planToday(), open = PL.todayTasks(all, today);
      const over = open.filter(t => t.due < today), now = open.filter(t => t.due === today);
      $('#pl-list').innerHTML = unraw(open.length ? html`${over.length ? section('Просрочено', over.length, taskTree(expandNest(over, all)), 'late') : ''}${now.length ? section('Сегодня', now.length, taskTree(expandNest(now, all))) : ''}`
        : emptyBox('✨', 'На сегодня задач нет', 'Добавь первую — например «Прочитать главу в 19:00».'));
      this.redrawHead();
    },
  };
  PLN.page.redraw(); quickPreview('');
});
function planItem(i) {
  const cls = i.done ? 'done' : i.kind === 'overdue' ? 'late' : '';
  return html`<a class="pl-item ${cls}" href="${i.to}"><span class="pl-item-ic">${i.icon}</span>
    <span class="grow"><b>${i.title}</b><span class="small muted block">${i.detail.replace(/\d{4}-\d{2}-\d{2}/g, d => PL.formatDay(d))}</span></span>
    ${i.done ? html`<span class="chip good">✓ сделано</span>` : i.minutes ? html`<span class="chip accent">≈ ${i.minutes} мин</span>` : html`<span class="chip warn">открыть</span>`}</a>`;
}

/* ---------- экран «Задачи» ---------- */
function planViewInfo(v) {
  if (v.startsWith('p:')) { const p = planProject(Number(v.slice(2))); return p ? { id: v, title: `${p.emoji} ${p.name}`, project: p } : null; }
  if (v.startsWith('l:')) { let l = v.slice(2); try { l = decodeURIComponent(l); } catch (e) { /* как есть */ } return { id: 'l:' + encodeURIComponent(l), title: '@' + l, label: l.toLowerCase() }; }
  const names = { today: '☀️ Сегодня', upcoming: '🗓 Предстоящие', inbox: '📥 Входящие', all: '📋 Все задачи', done: '✅ Выполненные' };
  return names[v] ? { id: v, title: names[v] } : null;
}
route(/^#\/tasks(?:\?(.*))?$/, async q => {
  render($('#app'), shell('tasks', html`${planLoading()}`));
  await planLoad(); PLN.subFor = null;
  let v = new URLSearchParams(q || '').get('v') || 'upcoming', info = planViewInfo(v);
  if (!info) { v = 'upcoming'; info = planViewInfo(v); }
  render($('#app'), shell('tasks', html`
    <div class="pl-layout">
      <aside class="pl-side card flat" id="pl-side"></aside>
      <div class="pl-main">
        <div class="row spread wrap"><h1 id="pl-h" style="margin:0"></h1><div id="pl-acts" class="row gap-s"></div></div>
        <div class="mt">${quickForm('Новая задача…')}</div>
        <div id="pl-list" class="mt"></div>
      </div></div>`));
  PLN.page = {
    kind: 'tasks', qdefaults: () => ({ project_id: info.project ? info.project.id : null, labels: info.label ? [info.label] : [], due: v === 'today' ? planToday() : null }),
    redraw() {
      info = planViewInfo(v) || info; // имя проекта могло измениться
      const all = planKnown(), today = planToday(), open = all.filter(t => !t.done);
      const cnt = { today: PL.todayTasks(all, today).length, upcoming: open.filter(t => t.due).length, inbox: PL.inboxTasks(all).length, all: open.length, done: all.filter(t => t.done).length };
      const link = (id, ic, name, n) => html`<a href="#/tasks?v=${id}" class="${info.id === id ? 'on' : ''}"><span>${ic} ${name}</span>${n ? html`<i>${n}</i>` : ''}</a>`;
      $('#pl-side').innerHTML = unraw(html`<nav class="pl-snav">${link('today', '☀️', 'Сегодня', cnt.today)}${link('upcoming', '🗓', 'Предстоящие', cnt.upcoming)}${link('inbox', '📥', 'Входящие', cnt.inbox)}${link('all', '📋', 'Все', cnt.all)}${link('done', '✅', 'Выполненные', cnt.done)}</nav>
        <div class="pl-sh"><span>Проекты</span><button class="icon-btn" data-act="pProjAdd" title="Новый проект" aria-label="Новый проект">＋</button></div>
        <nav class="pl-snav">${PLN.projects.map(p => link('p:' + p.id, p.emoji, p.name, PL.openCount(all, p.id)))}${PLN.projects.length ? '' : html`<span class="small muted pl-hint">Проекты помогают разложить задачи: учёба, дом, спорт…</span>`}</nav>
        ${PL.labelCounts(all).length ? html`<div class="pl-sh"><span>Метки</span></div><nav class="pl-snav">${PL.labelCounts(all).map(l => link('l:' + encodeURIComponent(l.label), '🏷', l.label, l.count))}</nav>` : ''}`);
      $('#pl-h').textContent = info.title;
      $('#pl-acts').innerHTML = unraw(info.project ? html`<button class="btn ghost sm" data-act="pProjEdit" data-id="${info.project.id}">✏️ Изменить</button><button class="btn ghost sm" data-act="pProjDel" data-id="${info.project.id}">🗑 Удалить</button>`
        : v === 'done' && cnt.done ? html`<button class="btn ghost sm" data-act="pClearDone">🧹 Очистить</button>` : '');
      $('#pl-list').innerHTML = unraw(html`${planListFor(v, info, all, today)}`);
    },
  };
  PLN.page.redraw(); quickPreview('');
});
function planListFor(v, info, all, today) {
  const open = all.filter(t => !t.done);
  if (v === 'today') {
    const m = PL.todayTasks(all, today), over = m.filter(t => t.due < today), now = m.filter(t => t.due === today);
    return m.length ? html`${over.length ? section('Просрочено', over.length, taskTree(expandNest(over, all)), 'late') : ''}${now.length ? section('Сегодня', now.length, taskTree(expandNest(now, all))) : ''}` : emptyBox('✨', 'На сегодня ничего нет', 'Свободный день — или добавь задачу выше.');
  }
  if (v === 'upcoming') {
    const u = PL.upcoming(all, today, 14);
    if (!u.overdue.length && !u.days.length && !u.later.length) return emptyBox('🗓', 'Предстоящих задач нет', 'Добавь срок: «завтра», «в пятницу», «15 октября», «каждый понедельник».');
    return html`${u.overdue.length ? section('Просрочено', u.overdue.length, taskTree(expandNest(u.overdue, all)), 'late') : ''}
      ${u.days.map(d => section(PL.dueText(d.date, null, today) + (PL.daysBetween(today, d.date) > 1 ? '' : ' · ' + PL.formatDay(d.date)), d.tasks.length, taskTree(expandNest(d.tasks, all))))}
      ${u.later.length ? section('Позже', u.later.length, taskTree(expandNest(u.later, all))) : ''}`;
  }
  if (v === 'inbox') { const m = PL.inboxTasks(all); return m.length ? taskTree(expandNest(m, all), 1, { noProject: true }) : emptyBox('📥', 'Во «Входящих» пусто', 'Сюда попадают задачи без проекта.'); }
  if (v === 'all') { const roots = open.filter(t => !t.parent_id || !open.some(p => p.id === t.parent_id)); return roots.length ? taskTree(expandNest(roots, all)) : emptyBox('🌱', 'Задач пока нет', 'Напиши первую в строке выше.'); }
  if (v === 'done') {
    const d = all.filter(t => t.done).sort((a, b) => (b.done_at || 0) - (a.done_at || 0));
    return d.length ? html`<div class="pl-flat">${d.map(t => taskRow(t, 3))}</div>` : emptyBox('🏁', 'Выполненных пока нет', 'Когда отметишь задачу, она появится здесь — её можно вернуть в работу.');
  }
  if (info.project) {
    const m = open.filter(t => t.project_id === info.project.id && (!t.parent_id || !open.some(p => p.id === t.parent_id))), done = all.filter(t => t.done && t.project_id === info.project.id);
    return html`${m.length ? taskTree(expandNest(m, all), 1, { noProject: true }) : emptyBox(info.project.emoji, 'В проекте нет открытых задач', 'Добавь задачу выше — она попадёт сюда.')}
      ${done.length ? html`<button class="btn ghost sm mt" data-act="pToggleDone">${PLN.showDone ? 'Скрыть' : 'Показать'} выполненные (${done.length})</button>${PLN.showDone ? html`<div class="pl-flat mt">${done.map(t => taskRow(t, 3, { noProject: true }))}</div>` : ''}` : ''}`;
  }
  if (info.label) {
    const m = open.filter(t => t.labels.includes(info.label));
    return m.length ? taskTree(expandNest(m, all)) : emptyBox('🏷', 'С этой меткой задач нет', 'Добавь метку в задаче или набери @метка в строке ввода.');
  }
  return '';
}

/* ---------- экран «Календарь» ---------- */
const CAL = { view: 'month', sel: null, data: null, kinds: null, range: '' };
function calKinds() {
  if (CAL.kinds) return CAL.kinds;
  let saved = null; try { saved = JSON.parse(localStorage.getItem('lq_cal_kinds')); } catch (e) { /* нет */ }
  CAL.kinds = new Set(Array.isArray(saved) && saved.length ? saved.filter(k => PL.ALL_KINDS.includes(k)) : PL.ALL_KINDS);
  return CAL.kinds;
}
const calHref = (view, day) => `#/calendar?v=${view}&d=${day}`;
route(/^#\/calendar(?:\?(.*))?$/, async q => {
  const sp = new URLSearchParams(q || ''), today = planToday(), prm = PL.readCalParams(sp.get('v'), sp.get('d'), today);
  CAL.view = prm.view; CAL.sel = prm.day; PLN.subFor = null; calKinds();
  render($('#app'), shell('calendar', html`${planLoading()}`));
  const { from, to } = PL.visibleRange(CAL.view, CAL.sel);
  const [data] = await Promise.all([api(`/calendar?from=${from}&to=${to}`).catch(e => { toast(e.message, { icon: '⚠️' }); return { goals: [], tests: [], study: [] }; }), planLoad()]);
  CAL.data = data;
  render($('#app'), shell('calendar', html`
    <div class="pl-cal">
      <div class="pl-cal-main"><div id="pl-cal-top"></div></div>
      <div class="card pl-day"><h3 id="pl-day-t" style="margin:0"></h3><div class="small muted" id="pl-day-s"></div>
        <div class="mt">${quickForm('Задача на этот день…')}</div>
        <div id="pl-day-l" class="mt"></div></div>
    </div>`));
  PLN.page = {
    kind: 'calendar', qdefaults: () => ({ due: CAL.sel }),
    redraw() {
      const today = planToday(), all = planKnown(), { from, to } = PL.visibleRange(CAL.view, CAL.sel);
      const ev = PL.eventsInRange(all, CAL.data, from, to, today, calKinds());
      $('#pl-cal-top').innerHTML = unraw(calTop(ev, today));
      const list = ev.get(CAL.sel) || [], sum = PL.summarize(list), bits = [];
      if (sum.open) bits.push(`открытых задач: ${sum.open}`); if (sum.done) bits.push(`выполнено: ${sum.done}`); if (sum.overdue) bits.push(`просрочено: ${sum.overdue}`);
      if (sum.goal) bits.push(`целей: ${sum.goal}`); if (sum.test) bits.push(`тестов: ${sum.test}`);
      $('#pl-day-t').textContent = PL.longDay(CAL.sel) + (CAL.sel === today ? ' · сегодня' : '');
      $('#pl-day-s').textContent = bits.join(' · ') || 'На этот день ничего нет';
      $('#pl-day-l').innerHTML = unraw(list.length ? html`<div class="pl-evlist">${list.map(calEventRow)}</div>` : emptyBox('🌤', 'Свободный день', 'Добавь задачу выше или выбери другой день.'));
    },
  };
  PLN.page.redraw(); quickPreview('');
});
function calTop(ev, today) {
  const view = CAL.view, sel = CAL.sel, kinds = calKinds();
  const bar = html`<div class="pl-cal-bar">
    <div class="row gap-s"><a class="icon-btn" href="${calHref(view, PL.shiftPeriod(view, sel, -1))}" aria-label="Назад">‹</a><a class="icon-btn" href="${calHref(view, PL.shiftPeriod(view, sel, 1))}" aria-label="Вперёд">›</a>
      <h2 class="pl-cal-t">${PL.periodTitle(view, sel)}</h2></div>
    <div class="row gap-s wrap"><a class="btn ghost sm" href="${calHref(view, today)}">Сегодня</a>
      <div class="pl-seg"><a href="${calHref('week', sel)}" class="${view === 'week' ? 'on' : ''}">Неделя</a><a href="${calHref('month', sel)}" class="${view === 'month' ? 'on' : ''}">Месяц</a></div></div></div>
    <div class="row wrap gap-s pl-kinds">${PL.ALL_KINDS.map(k => html`<button class="pl-kind ${kinds.has(k) ? 'on' : ''} k-${k}" data-act="pKind" data-k="${k}">${PL.KIND_ICON[k]} ${PL.KIND_LABEL[k]}</button>`)}</div>`;
  const head = html`<div class="pl-wdh">${PL.WEEKDAY_HEADS.map(d => html`<span>${d}</span>`)}</div>`;
  const cell = d => {
    const list = ev.get(d) || [], max = view === 'week' ? 99 : 3, shown = list.slice(0, max), cls = ['pl-cell'];
    if (d === today) cls.push('today'); if (d === sel) cls.push('sel'); if (view === 'month' && !PL.sameMonth(d, sel)) cls.push('out'); if (view === 'week') cls.push('wk');
    return html`<div class="${cls.join(' ')}" data-act="pDay" data-d="${d}" role="button" tabindex="0">
      <div class="pl-cn"><span class="pl-num">${Number(d.slice(8))}</span>${view === 'week' ? html`<span class="pl-wdn">${PL.WEEKDAY_HEADS[(PL.weekday(d) + 6) % 7]}</span>` : ''}</div>
      <div class="pl-pills">${shown.map(e => html`<span class="pl-pill k-${e.kind} ${e.done ? 'done' : ''} ${e.overdue ? 'late' : ''} ${e.ghost ? 'ghost' : ''} ${e.priority && e.priority < 3 ? 'p' + e.priority : ''}" title="${e.title}">${e.ghost ? '🔁' : PL.KIND_ICON[e.kind]} ${e.time ? e.time + ' ' : ''}${e.title}</span>`)}${list.length > max ? html`<span class="pl-more">+${list.length - max} ещё</span>` : ''}</div>
      ${list.length ? html`<div class="pl-dots">${[...new Set(list.map(e => e.kind))].map(k => html`<i class="k-${k}"></i>`)}<b>${list.length}</b></div>` : ''}
    </div>`;
  };
  const weeks = view === 'week' ? [PL.weekDays(sel)] : PL.monthGrid(sel);
  return html`${bar}<div class="pl-grid ${view}">${view === 'month' ? head : ''}${weeks.map(w => html`<div class="pl-wk">${w.map(cell)}</div>`)}</div>`;
}
function calEventRow(e) {
  const today = planToday();
  if (e.kind === 'task' && !e.ghost) { const t = planTask(e.task_id); return t ? taskRow(planKnown().find(x => x.id === t.id), 3) : ''; }
  if (e.kind === 'task') return html`<div class="pl-evrow ghost"><span class="pl-ev-i">🔁</span><span class="grow">${e.title}<span class="small muted block">повторяющаяся задача${e.time ? ' · ' + e.time : ''}</span></span></div>`;
  if (e.kind === 'goal') return html`<a class="pl-evrow k-goal ${e.overdue ? 'late' : ''}" href="#/course/${e.course_id}"><span class="pl-ev-i">🎯</span><span class="grow">${e.title}<span class="small muted block">${e.detail}${e.overdue ? ' · срок прошёл' : ''}</span></span><span class="muted">›</span></a>`;
  if (e.kind === 'test') return html`<a class="pl-evrow k-test" href="#/course/${e.course_id}"><span class="pl-ev-i">📝</span><span class="grow">${e.title}<span class="small muted block">${e.detail}</span></span><span class="muted">›</span></a>`;
  return html`<div class="pl-evrow k-study"><span class="pl-ev-i">📚</span><span class="grow">${e.title}<span class="small muted block">${e.detail}</span></span></div>`;
}
actions.pDay = el => {
  CAL.sel = el.dataset.d;
  try { history.replaceState(null, '', calHref(CAL.view, CAL.sel)); } catch (e) { /* ignore */ }
  const need = PL.visibleRange(CAL.view, CAL.sel);
  PLN.page.redraw();
  if (!CAL.data || CAL.data.from !== need.from) planCalReload();
  document.getElementById('pl-day-t')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
async function planCalReload() { const { from, to } = PL.visibleRange(CAL.view, CAL.sel); try { CAL.data = await api(`/calendar?from=${from}&to=${to}`); PLN.page && PLN.page.kind === 'calendar' && PLN.page.redraw(); } catch (e) { /* ignore */ } }
actions.pKind = el => {
  const k = el.dataset.k, s = calKinds();
  if (s.has(k)) { if (s.size > 1) s.delete(k); } else s.add(k);
  try { localStorage.setItem('lq_cal_kinds', JSON.stringify([...s])); } catch (e) { /* ignore */ }
  PLN.page.redraw();
};

/* ---------- общие обработчики форм и клавиатуры ---------- */
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'pl-quick') {
    e.preventDefault(); const inp = $('#pl-q'), text = inp.value;
    await planGuard(async () => { if (await planSubmitQuick(text)) { inp.value = ''; quickPreview(''); planChanged(); } })();
    $('#pl-q')?.focus();
  } else if (f.classList && f.classList.contains('pl-subform')) {
    e.preventDefault(); const inp = f.querySelector('input'), title = inp.value.trim(), pid = Number(f.dataset.id);
    if (!title) { PLN.subFor = null; PLN.page.redraw(); return; }
    await planGuard(async () => {
      const t = await api('/tasks', { json: { title, parent_id: pid, today: planToday() } });
      planMerge([t]); planChanged(); $('.pl-subform input')?.focus();
    })();
  } else if (f.id === 'pl-edit') { e.preventDefault(); planSaveEdit(f); }
  else if (f.id === 'pl-proj') { e.preventDefault(); planSaveProject(f); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'pl-q') quickPreview(e.target.value);
  else if (e.target.form && e.target.form.id === 'pl-edit') planSyncRecur(e.target.form);
});
document.addEventListener('change', e => { if (e.target.form && e.target.form.id === 'pl-edit') planSyncRecur(e.target.form); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && e.target.closest && e.target.closest('.pl-subform')) { PLN.subFor = null; PLN.page && PLN.page.redraw(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pl-cell')) { e.preventDefault(); actions.pDay(e.target); }
});
