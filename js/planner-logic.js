/* LearnQuest — планировщик: чистая логика без DOM (даты, быстрый ввод, повторы, выборки задач, сетка и события календаря).
   Подключается в браузере как глобальный PL, а в Node (для проверок tests/planner-logic.test.js) — через require.
   Даты — строки «ГГГГ-ММ-ДД» (локальный день человека), дни недели как в JS: 0 — воскресенье. Поля задач — как отдаёт сервер (snake_case). */
(function (root) {
  'use strict';
  const PL = {};
  const pad = n => String(n).padStart(2, '0');
  const DAY_MS = 86400000;

  /* ---------- даты ---------- */
  const parse = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromMs = ms => { const t = new Date(ms); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
  const ymd = key => key.split('-').map(Number);
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  PL.addDays = (key, n) => fromMs(parse(key) + n * DAY_MS);
  PL.daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY_MS);
  PL.isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s)) && fromMs(parse(s)) === s;
  PL.weekday = key => new Date(parse(key)).getUTCDay();
  PL.mondayOf = key => PL.addDays(key, -((PL.weekday(key) + 6) % 7));
  PL.addMonths = (key, n) => {
    const [y, m, d] = ymd(key), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = (t % 12) + 1;
    return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
  };
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WD_SHORT_CAP = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const WD_LONG = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  PL.WEEKDAY_HEADS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  PL.formatDay = key => { const [, m, d] = ymd(key); return `${d} ${MONTHS_GEN[m - 1]}`; };
  PL.longDay = key => `${WD_LONG[PL.weekday(key)]}, ${PL.formatDay(key)}`;
  PL.plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  /** Подпись срока: «Сегодня», «Завтра», «Вчера», «Пт, 9 октября» (с годом, если он не текущий); со временем — «Сегодня, 18:00». */
  PL.dueText = (due, time, today) => {
    const diff = PL.daysBetween(today, due);
    let base = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : diff === -1 ? 'Вчера' : `${WD_SHORT_CAP[PL.weekday(due)]}, ${PL.formatDay(due)}`;
    if (Math.abs(diff) > 1 && due.slice(0, 4) !== today.slice(0, 4)) base += ' ' + due.slice(0, 4);
    return time ? `${base}, ${time}` : base;
  };

  /* ---------- повторы ---------- */
  const clampEvery = n => Math.max(1, Math.min(365, Math.floor(n) || 1));
  PL.occursOn = (rule, anchor, day) => {
    if (day < anchor) return false;
    const every = clampEvery(rule.every);
    switch (rule.kind) {
      case 'day': return PL.daysBetween(anchor, day) % every === 0;
      case 'weekdays': { const w = PL.weekday(day); return w >= 1 && w <= 5; }
      case 'week': {
        const days = rule.days && rule.days.length ? rule.days : [PL.weekday(anchor)];
        if (!days.includes(PL.weekday(day))) return false;
        return (PL.daysBetween(PL.mondayOf(anchor), PL.mondayOf(day)) / 7) % every === 0;
      }
      case 'month': {
        const [ay, am, ad] = ymd(anchor), [y, m, d] = ymd(day), gap = (y - ay) * 12 + (m - am);
        return gap >= 0 && gap % every === 0 && d === Math.min(ad, daysInMonth(y, m));
      }
    }
    return false;
  };
  const WD_EACH = ['каждое воскресенье', 'каждый понедельник', 'каждый вторник', 'каждую среду', 'каждый четверг', 'каждую пятницу', 'каждую субботу'];
  const WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  PL.recurText = rule => {
    const every = clampEvery(rule.every), few = every < 5;
    switch (rule.kind) {
      case 'weekdays': return 'по будням';
      case 'day': return every === 1 ? 'каждый день' : `каждые ${every} ${few ? 'дня' : 'дней'}`;
      case 'month': return every === 1 ? 'каждый месяц' : `каждые ${every} ${few ? 'месяца' : 'месяцев'}`;
      case 'week': {
        const days = rule.days && rule.days.length ? WEEK_ORDER.filter(d => rule.days.includes(d)) : [];
        const unit = every === 1 ? 'каждую неделю' : `каждые ${every} ${few ? 'недели' : 'недель'}`;
        if (!days.length) return unit;
        if (every === 1 && days.length === 1) return WD_EACH[days[0]];
        const names = days.map(d => WD_SHORT[d]).join(', ');
        return every === 1 ? `каждую неделю: ${names}` : `${unit}: ${names}`;
      }
    }
    return '';
  };

  /* ---------- быстрый ввод ---------- */
  const MAX_TITLE = 300, MAX_LABELS = 10;
  PL.MAX_TITLE = MAX_TITLE;
  const B0 = '(?<![\\p{L}\\p{N}])', B1 = '(?![\\p{L}\\p{N}])';
  const WD = '(?:понедельник\\p{L}*|вторник\\p{L}*|сред[ауы]?|четверг\\p{L}*|пятниц[ауы]?|суббот[ауы]?|воскресень[ея]|пн|вт|ср|чт|пт|сб|вс)';
  const MONTH = '(?:январ[яь]|феврал[яь]|март[а]?|апрел[яь]|ма[яй]|июн[яь]|июл[яь]|август[а]?|сентябр[яь]|октябр[яь]|ноябр[яь]|декабр[яь]|янв|фев|мар|апр|июн|июл|авг|сен|окт|ноя|дек)';
  const weekdayOf = w => { w = w.toLowerCase(); return w.startsWith('пон') || w === 'пн' ? 1 : w.startsWith('вт') ? 2 : w.startsWith('ср') ? 3 : w.startsWith('чет') || w === 'чт' ? 4 : w.startsWith('пят') || w === 'пт' ? 5 : w.startsWith('суб') || w === 'сб' ? 6 : 0; };
  const monthOf = w => { w = w.toLowerCase(); if (w.startsWith('мар')) return 2; if (w.startsWith('ма')) return 4; return ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'].findIndex(p => w.startsWith(p)); };
  const isDay = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  const nextWeekday = (today, wd) => { for (let i = 1; i <= 7; i++) if (PL.weekday(PL.addDays(today, i)) === wd) return PL.addDays(today, i); return PL.addDays(today, 7); };
  const nextCalendarDate = (today, month0, day, year) => {
    const [ty] = ymd(today);
    if (year !== undefined) return isDay(year, month0 + 1, day) ? `${year}-${pad(month0 + 1)}-${pad(day)}` : null;
    if (isDay(ty, month0 + 1, day)) { const k = `${ty}-${pad(month0 + 1)}-${pad(day)}`; if (k >= today) return k; }
    return isDay(ty + 1, month0 + 1, day) ? `${ty + 1}-${pad(month0 + 1)}-${pad(day)}` : null;
  };
  const normName = s => s.toLowerCase().replaceAll('ё', 'е').replace(/[\s_]+/g, '_');
  PL.firstDue = (rule, today) => {
    if (rule.kind === 'weekdays' || (rule.kind === 'week' && rule.days && rule.days.length)) {
      for (let i = 0; i < 14; i++) { const d = PL.addDays(today, i), w = PL.weekday(d); if (rule.kind === 'weekdays' ? w >= 1 && w <= 5 : rule.days.includes(w)) return d; }
    }
    return today;
  };
  /** «Позвонить маме завтра в 18:00 !1 #дом @важно», «Зарядка каждый день в 7:30», «Сдать лабу 15 октября». */
  PL.parseQuick = (input, today, projects = []) => {
    let s = ` ${input} `;
    const take = (re, ok = () => true) => {
      const m = re.exec(s);
      if (!m || !ok(m)) return null;
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      return m;
    };
    let recur = null, due = null, dueTime = null, m;
    if ((m = take(new RegExp(`${B0}по\\s+будням${B1}`, 'iu')))) recur = { kind: 'weekdays', every: 1 };
    else if ((m = take(new RegExp(`${B0}кажд(?:ый|ую|ое)\\s+(${WD}(?:\\s*(?:,|и)\\s*${WD})*)${B1}`, 'iu')))) {
      recur = { kind: 'week', every: 1, days: [...new Set((m[1].match(new RegExp(WD, 'giu')) || []).map(weekdayOf))] };
    } else if ((m = take(new RegExp(`${B0}кажд(?:ые|ый|ую)\\s+(\\d+)\\s+(дн\\p{L}*|недел\\p{L}*|месяц\\p{L}*)${B1}`, 'iu')))) {
      const u = m[2].toLowerCase();
      recur = { kind: u.startsWith('дн') ? 'day' : u.startsWith('нед') ? 'week' : 'month', every: clampEvery(Number(m[1])) };
    } else if ((m = take(new RegExp(`${B0}(?:каждый\\s+день|ежедневно)${B1}`, 'iu')))) recur = { kind: 'day', every: 1 };
    else if ((m = take(new RegExp(`${B0}(?:каждую\\s+неделю|еженедельно)${B1}`, 'iu')))) recur = { kind: 'week', every: 1 };
    else if ((m = take(new RegExp(`${B0}(?:каждый\\s+месяц|ежемесячно)${B1}`, 'iu')))) recur = { kind: 'month', every: 1 };

    if ((m = take(/(?<![\d.-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/u, x => isDay(Number(x[1]), Number(x[2]), Number(x[3]))))) due = `${m[1]}-${m[2]}-${m[3]}`;
    else if ((m = take(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?:\.(\d{4}|\d{2}))?(?![\d.])/u, x => nextCalendarDate(today, Number(x[2]) - 1, Number(x[1]), x[3] ? (x[3].length === 2 ? 2000 + Number(x[3]) : Number(x[3])) : undefined) !== null))) {
      due = nextCalendarDate(today, Number(m[2]) - 1, Number(m[1]), m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined);
    } else if ((m = take(new RegExp(`${B0}(\\d{1,2})\\s+(${MONTH})\\.?(?:\\s+(\\d{4}))?${B1}`, 'iu'), x => nextCalendarDate(today, monthOf(x[2]), Number(x[1]), x[3] ? Number(x[3]) : undefined) !== null))) {
      due = nextCalendarDate(today, monthOf(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined);
    } else if ((m = take(new RegExp(`${B0}послезавтра${B1}`, 'iu')))) due = PL.addDays(today, 2);
    else if ((m = take(new RegExp(`${B0}завтра${B1}`, 'iu')))) due = PL.addDays(today, 1);
    else if ((m = take(new RegExp(`${B0}сегодня${B1}`, 'iu')))) due = today;
    else if ((m = take(new RegExp(`${B0}через\\s+(\\d+)\\s+(дн\\p{L}*|недел\\p{L}*|месяц\\p{L}*)${B1}`, 'iu')))) {
      const n = Math.min(3650, Number(m[1])), u = m[2].toLowerCase();
      due = u.startsWith('дн') ? PL.addDays(today, n) : u.startsWith('нед') ? PL.addDays(today, n * 7) : PL.addMonths(today, n);
    } else if ((m = take(new RegExp(`${B0}через\\s+(день|неделю|месяц)${B1}`, 'iu')))) {
      const u = m[1].toLowerCase(); due = u === 'день' ? PL.addDays(today, 1) : u === 'неделю' ? PL.addDays(today, 7) : PL.addMonths(today, 1);
    } else if ((m = take(new RegExp(`${B0}(?:в|во|на)\\s+(${WD})${B1}`, 'iu')))) due = nextWeekday(today, weekdayOf(m[1]));

    if ((m = take(/(?<![\d:])(?:в\s+)?(\d{1,2}):(\d{2})(?![\d:])/u, x => Number(x[1]) < 24 && Number(x[2]) < 60))) dueTime = `${pad(Number(m[1]))}:${m[2]}`;
    else if ((m = take(new RegExp(`${B0}в\\s+(\\d{1,2})\\s+(утра|вечера|дня|ночи)${B1}`, 'iu'), x => Number(x[1]) <= 12))) {
      let h = Number(m[1]); const part = m[2].toLowerCase();
      if ((part === 'вечера' || part === 'дня') && h < 12) h += 12; else if (part === 'ночи' && h === 12) h = 0;
      dueTime = `${pad(h)}:00`;
    } else if ((m = take(new RegExp(`${B0}в\\s+(\\d{1,2})\\s*(?:часов|часа|час|ч)${B1}`, 'iu'), x => Number(x[1]) < 24))) dueTime = `${pad(Number(m[1]))}:00`;

    let priority = 4;
    if ((m = take(/(?<=\s)(?:!([1-4])|[pр]([1-4]))(?=\s)/iu))) priority = Number(m[1] || m[2]);

    let projectId = null, unknownProject = null;
    if ((m = take(/(?<=\s)#([\p{L}\p{N}_-]+)(?=\s)/u))) {
      const want = normName(m[1]), found = projects.find(p => normName(p.name) === want);
      if (found) projectId = found.id; else unknownProject = m[1].replaceAll('_', ' ');
    }
    const labels = [];
    for (;;) {
      const l = take(/(?<=\s)@([\p{L}\p{N}_-]+)(?=\s)/u);
      if (!l) break;
      const name = l[1].replaceAll('_', ' ').toLowerCase();
      if (!labels.includes(name) && labels.length < MAX_LABELS) labels.push(name);
    }
    if (recur && !due) due = PL.firstDue(recur, today);
    if (dueTime && !due) due = today;
    const title = s.replace(/\s+/g, ' ').trim().replace(/^(?:в|на|к|до|во)\s+/iu, '').replace(/\s+(?:в|на|к|до|во)$/iu, '').trim().slice(0, MAX_TITLE);
    return { title, due, due_time: dueTime, priority, project_id: projectId, unknown_project: unknownProject, labels, recur };
  };

  /* ---------- выборки ---------- */
  PL.compareTasks = (a, b) => {
    if (a.due !== b.due) return a.due === null ? 1 : b.due === null ? -1 : a.due < b.due ? -1 : 1;
    if (a.due_time !== b.due_time) return a.due_time === null ? 1 : b.due_time === null ? -1 : a.due_time < b.due_time ? -1 : 1;
    return a.priority - b.priority || a.order - b.order || a.created_at - b.created_at;
  };
  PL.todayTasks = (tasks, today) => tasks.filter(t => !t.done && t.due !== null && t.due <= today).sort(PL.compareTasks);
  PL.inboxTasks = tasks => tasks.filter(t => !t.done && t.project_id === null).sort(PL.compareTasks);
  PL.upcoming = (tasks, today, horizon = 14) => {
    const open = tasks.filter(t => !t.done && t.due !== null).sort(PL.compareTasks), end = PL.addDays(today, horizon), byDay = new Map(), later = [];
    const overdue = open.filter(t => t.due < today);
    for (const t of open) {
      if (t.due < today) continue;
      if (t.due > end) later.push(t); else byDay.set(t.due, [...(byDay.get(t.due) || []), t]);
    }
    return { overdue, days: [...byDay.keys()].sort().map(date => ({ date, tasks: byDay.get(date) })), later };
  };
  /** Дерево из плоского списка; подзадача, чей родитель не в списке, считается самостоятельной. */
  PL.nest = tasks => {
    const ids = new Set(tasks.map(t => t.id)), kids = new Map(), roots = [];
    for (const t of tasks) { if (t.parent_id && ids.has(t.parent_id)) kids.set(t.parent_id, [...(kids.get(t.parent_id) || []), t]); else roots.push(t); }
    const build = (t, seen) => ({ task: t, children: seen.has(t.id) ? [] : (kids.get(t.id) || []).map(k => build(k, new Set([...seen, t.id]))) });
    return roots.map(t => build(t, new Set()));
  };
  PL.descendants = (tasks, id) => {
    const out = [], queue = [id], seen = new Set([id]);
    while (queue.length) { const cur = queue.shift(); for (const t of tasks) if (t.parent_id === cur && !seen.has(t.id)) { seen.add(t.id); out.push(t); queue.push(t.id); } }
    return out;
  };
  PL.openCount = (tasks, projectId) => tasks.filter(t => !t.done && t.project_id === projectId).length;
  PL.labelCounts = tasks => {
    const m = new Map();
    for (const t of tasks) if (!t.done) for (const l of t.labels) m.set(l, (m.get(l) || 0) + 1);
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  };
  /** Задачи, ссылающиеся на удалённый проект, показываем во «Входящих». */
  PL.withKnownProjects = (tasks, projects) => { const known = new Set(projects.map(p => p.id)); return tasks.map(t => t.project_id !== null && !known.has(t.project_id) ? { ...t, project_id: null } : t); };

  /* ---------- календарь ---------- */
  PL.weekDays = anchor => { const mon = PL.mondayOf(anchor); return Array.from({ length: 7 }, (_, i) => PL.addDays(mon, i)); };
  PL.monthGrid = anchor => {
    const [y, m] = ymd(anchor), first = `${y}-${pad(m)}-01`, last = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`, weeks = [];
    for (let mon = PL.mondayOf(first); mon <= last; mon = PL.addDays(mon, 7)) weeks.push(PL.weekDays(mon));
    return weeks;
  };
  PL.sameMonth = (a, b) => a.slice(0, 7) === b.slice(0, 7);
  PL.shiftPeriod = (view, anchor, dir) => view === 'week' ? PL.addDays(anchor, 7 * dir) : PL.addMonths(anchor, dir);
  PL.visibleRange = (view, anchor) => { const days = view === 'week' ? PL.weekDays(anchor) : PL.monthGrid(anchor).flat(); return { from: days[0], to: days[days.length - 1] }; };
  PL.periodTitle = (view, anchor) => {
    const [y, m] = ymd(anchor);
    if (view === 'month') return `${MONTHS[m - 1]} ${y}`;
    const days = PL.weekDays(anchor), [, m1, d1] = ymd(days[0]), [y2, m2, d2] = ymd(days[6]), tail = y2 !== y ? ` ${y2}` : '';
    return m1 === m2 ? `${d1} – ${d2} ${MONTHS_GEN[m2 - 1]}${tail}` : `${d1} ${MONTHS_GEN[m1 - 1]} – ${d2} ${MONTHS_GEN[m2 - 1]}${tail}`;
  };
  PL.readCalParams = (view, day, today) => ({ view: view === 'week' ? 'week' : 'month', day: day && PL.isDay(day) ? day : today });

  PL.KIND_ORDER = { goal: 0, test: 1, task: 2, study: 3 };
  PL.ALL_KINDS = ['goal', 'test', 'task', 'study'];
  PL.KIND_LABEL = { goal: 'Цели курсов', test: 'Тесты', task: 'Задачи', study: 'Занятия' };
  PL.KIND_ICON = { goal: '🎯', test: '📝', task: '✅', study: '📚' };
  PL.compareEvents = (a, b) => {
    if (a.kind !== b.kind) return PL.KIND_ORDER[a.kind] - PL.KIND_ORDER[b.kind];
    if (a.kind === 'task') {
      if (!!a.ghost !== !!b.ghost) return a.ghost ? 1 : -1;
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const ta = a.time || '99:99', tb = b.time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      if (a.priority !== b.priority) return (a.priority || 4) - (b.priority || 4);
    }
    return String(a.title).localeCompare(String(b.title), 'ru') || String(a.id).localeCompare(String(b.id));
  };
  /** События на сетку: задачи (и будущие повторы), цели курсов, пройденные тесты, занятия. `data` — ответ /api/calendar. */
  PL.eventsInRange = (tasks, data, from, to, today, kinds = new Set(PL.ALL_KINDS)) => {
    const out = new Map();
    if (!PL.isDay(from) || !PL.isDay(to) || to < from || PL.daysBetween(from, to) > 400) return out;
    const push = e => { if (e.date < from || e.date > to) return; const l = out.get(e.date); if (l) l.push(e); else out.set(e.date, [e]); };
    if (kinds.has('goal')) for (const g of (data && data.goals) || []) push({ id: `goal|${g.course_id}`, kind: 'goal', date: g.date, title: `${g.icon} ${g.title}`, detail: 'цель курса', course_id: g.course_id, overdue: g.date < today });
    if (kinds.has('test')) {
      const groups = new Map();
      for (const t of (data && data.tests) || []) { const k = `${t.day}|${t.course_id}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
      for (const [k, list] of groups) {
        const best = list.reduce((b, x) => (x.score || 0) > (b.score || 0) ? x : b, list[0]);
        push({ id: `test|${k}`, kind: 'test', date: list[0].day, title: `${list[0].icon} ${list[0].course_title}`, detail: `${best.type_name}: ${best.score == null ? '—' : best.score + '%'}${list.length > 1 ? ` · тестов: ${list.length}` : ''}`, course_id: list[0].course_id, score: best.score });
      }
    }
    if (kinds.has('task')) {
      for (const t of tasks) {
        if (!t.due) continue;
        push({ id: `task|${t.id}`, kind: 'task', date: t.due, title: t.title, time: t.due_time, task_id: t.id, priority: t.priority, done: t.done, overdue: !t.done && t.due < today });
        if (t.recur && !t.done) {
          const start = PL.addDays(t.due, 1) < from ? from : PL.addDays(t.due, 1);
          for (let d = start; d <= to; d = PL.addDays(d, 1)) if (PL.occursOn(t.recur, t.due, d)) push({ id: `task|${t.id}|${d}`, kind: 'task', date: d, title: t.title, time: t.due_time, task_id: t.id, priority: t.priority, ghost: true });
        }
      }
    }
    if (kinds.has('study')) for (const s of (data && data.study) || []) push({ id: `study|${s.day}`, kind: 'study', date: s.day, title: s.minutes ? `Занимался ${s.minutes} мин` : 'Занятия', detail: `${s.lessons} ${PL.plural(s.lessons, 'урок', 'урока', 'уроков')} · ${s.xp} XP` });
    for (const l of out.values()) l.sort(PL.compareEvents);
    return out;
  };
  PL.summarize = events => {
    const s = { goal: 0, test: 0, open: 0, done: 0, overdue: 0, study: 0 };
    for (const e of events || []) { if (e.kind === 'task') { if (e.done) s.done++; else { s.open++; if (e.overdue) s.overdue++; } } else s[e.kind]++; }
    return s;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL; else root.PL = PL;
})(typeof window !== 'undefined' ? window : globalThis);
