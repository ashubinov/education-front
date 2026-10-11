/* Проверки логики планировщика без браузера: node tests/planner-logic.test.js */
'use strict';
const assert = require('assert');
const PL = require('../js/planner-logic.js');
let n = 0;
const t = (name, fn) => { fn(); n++; };
const TODAY = '2026-10-11'; // воскресенье

t('даты', () => {
  assert.strictEqual(PL.addDays('2026-02-27', 3), '2026-03-02');
  assert.strictEqual(PL.addMonths('2026-01-31', 1), '2026-02-28');
  assert.strictEqual(PL.addMonths('2026-12-15', 1), '2027-01-15');
  assert.strictEqual(PL.addMonths('2026-01-15', -2), '2025-11-15');
  assert.strictEqual(PL.weekday(TODAY), 0);
  assert.strictEqual(PL.mondayOf(TODAY), '2026-10-05');
  assert.strictEqual(PL.mondayOf('2026-10-05'), '2026-10-05');
  assert.strictEqual(PL.daysBetween('2026-10-01', TODAY), 10);
  assert.ok(PL.isDay('2026-02-28') && !PL.isDay('2026-02-30') && !PL.isDay('2026-2-3') && !PL.isDay(null));
  assert.strictEqual(PL.longDay(TODAY), 'Воскресенье, 11 октября');
  assert.strictEqual(PL.plural(1, 'урок', 'урока', 'уроков'), 'урок');
  assert.strictEqual(PL.plural(12, 'урок', 'урока', 'уроков'), 'уроков');
  assert.strictEqual(PL.plural(23, 'урок', 'урока', 'уроков'), 'урока');
});

t('подписи сроков', () => {
  assert.strictEqual(PL.dueText(TODAY, null, TODAY), 'Сегодня');
  assert.strictEqual(PL.dueText('2026-10-12', '18:00', TODAY), 'Завтра, 18:00');
  assert.strictEqual(PL.dueText('2026-10-10', null, TODAY), 'Вчера');
  assert.strictEqual(PL.dueText('2026-10-16', null, TODAY), 'Пт, 16 октября');
  assert.strictEqual(PL.dueText('2027-01-05', null, TODAY), 'Вт, 5 января 2027');
});

t('повторы: расписание', () => {
  const mon = '2026-10-05';
  assert.ok(PL.occursOn({ kind: 'day', every: 3 }, mon, '2026-10-11') && !PL.occursOn({ kind: 'day', every: 3 }, mon, '2026-10-10'));
  assert.ok(!PL.occursOn({ kind: 'day', every: 1 }, mon, '2026-10-04'), 'до первого срока повторов нет');
  assert.ok(PL.occursOn({ kind: 'weekdays', every: 1 }, mon, '2026-10-09') && !PL.occursOn({ kind: 'weekdays', every: 1 }, mon, '2026-10-10'));
  const w = { kind: 'week', every: 2, days: [1, 3] };
  assert.ok(PL.occursOn(w, mon, '2026-10-07') && !PL.occursOn(w, mon, '2026-10-12') && PL.occursOn(w, mon, '2026-10-19'));
  assert.ok(PL.occursOn({ kind: 'week', every: 1 }, mon, '2026-10-12'), 'без дней — день недели первого срока');
  assert.ok(PL.occursOn({ kind: 'month', every: 1 }, '2026-01-31', '2026-02-28') && PL.occursOn({ kind: 'month', every: 1 }, '2026-01-31', '2026-03-31'));
  assert.ok(!PL.occursOn({ kind: 'month', every: 2 }, '2026-01-15', '2026-02-15') && PL.occursOn({ kind: 'month', every: 2 }, '2026-01-15', '2026-03-15'));
});

t('повторы: текст', () => {
  assert.strictEqual(PL.recurText({ kind: 'day', every: 1 }), 'каждый день');
  assert.strictEqual(PL.recurText({ kind: 'day', every: 3 }), 'каждые 3 дня');
  assert.strictEqual(PL.recurText({ kind: 'day', every: 5 }), 'каждые 5 дней');
  assert.strictEqual(PL.recurText({ kind: 'weekdays', every: 1 }), 'по будням');
  assert.strictEqual(PL.recurText({ kind: 'week', every: 1, days: [1] }), 'каждый понедельник');
  assert.strictEqual(PL.recurText({ kind: 'week', every: 1, days: [0, 3, 1] }), 'каждую неделю: пн, ср, вс');
  assert.strictEqual(PL.recurText({ kind: 'week', every: 2 }), 'каждые 2 недели');
  assert.strictEqual(PL.recurText({ kind: 'month', every: 6 }), 'каждые 6 месяцев');
});

t('быстрый ввод: простые', () => {
  const P = [{ id: 7, name: 'Дом' }, { id: 8, name: 'Учёба и спорт' }];
  let q = PL.parseQuick('Позвонить маме завтра в 18:00 !1 #дом @важно', TODAY, P);
  assert.deepStrictEqual([q.title, q.due, q.due_time, q.priority, q.project_id, q.labels], ['Позвонить маме', '2026-10-12', '18:00', 1, 7, ['важно']]);
  q = PL.parseQuick('Сдать лабу 15 октября', TODAY, []);
  assert.deepStrictEqual([q.title, q.due], ['Сдать лабу', '2026-10-15']);
  q = PL.parseQuick('Отчёт 5 октября', TODAY, []);
  assert.strictEqual(q.due, '2027-10-05', 'прошедшая дата — на следующий год');
  q = PL.parseQuick('Купить хлеб послезавтра', TODAY, []);
  assert.deepStrictEqual([q.title, q.due], ['Купить хлеб', '2026-10-13']);
  q = PL.parseQuick('Встреча в пятницу в 7 вечера', TODAY, []);
  assert.deepStrictEqual([q.title, q.due, q.due_time], ['Встреча', '2026-10-16', '19:00']);
  q = PL.parseQuick('Сдать через 2 недели', TODAY, []);
  assert.strictEqual(q.due, '2026-10-25');
  q = PL.parseQuick('Платёж 20.10', TODAY, []);
  assert.strictEqual(q.due, '2026-10-20');
  q = PL.parseQuick('Дедлайн 2026-12-01 p2', TODAY, []);
  assert.deepStrictEqual([q.due, q.priority, q.title], ['2026-12-01', 2, 'Дедлайн']);
  q = PL.parseQuick('Тренировка #учёба_и_спорт', TODAY, P);
  assert.strictEqual(q.project_id, 8);
  q = PL.parseQuick('Задача #нет такого', TODAY, P);
  assert.strictEqual(q.unknown_project, 'нет');
  q = PL.parseQuick('в 9:30 стендап', TODAY, []);
  assert.deepStrictEqual([q.due, q.due_time, q.title], [TODAY, '09:30', 'стендап']);
  q = PL.parseQuick('просто задача', TODAY, []);
  assert.deepStrictEqual([q.title, q.due, q.due_time, q.priority, q.recur], ['просто задача', null, null, 4, null]);
});

t('быстрый ввод: повторы', () => {
  let q = PL.parseQuick('Зарядка каждый день в 7:30', TODAY, []);
  assert.deepStrictEqual([q.title, q.recur, q.due, q.due_time], ['Зарядка', { kind: 'day', every: 1 }, TODAY, '07:30']);
  q = PL.parseQuick('Планёрка каждый понедельник и среду', TODAY, []);
  assert.deepStrictEqual([q.recur, q.due], [{ kind: 'week', every: 1, days: [1, 3] }, '2026-10-12']);
  q = PL.parseQuick('Лекция по будням', TODAY, []);
  assert.deepStrictEqual([q.recur.kind, q.due], ['weekdays', '2026-10-12']);
  q = PL.parseQuick('Отчёт каждые 2 недели', TODAY, []);
  assert.deepStrictEqual(q.recur, { kind: 'week', every: 2 });
  q = PL.parseQuick('Аренда каждый месяц', TODAY, []);
  assert.strictEqual(q.recur.kind, 'month');
});

t('быстрый ввод: границы', () => {
  assert.strictEqual(PL.parseQuick('   ', TODAY, []).title, '');
  assert.strictEqual(PL.parseQuick('завтра', TODAY, []).title, '');
  assert.strictEqual(PL.parseQuick('x'.repeat(500), TODAY, []).title.length, PL.MAX_TITLE);
  assert.strictEqual(PL.parseQuick('Позвонить 31.02', TODAY, []).due, null, 'несуществующая дата не разбирается');
  const q = PL.parseQuick('a @один @два @один ' + Array.from({ length: 15 }, (_, i) => '@м' + i).join(' '), TODAY, []);
  assert.strictEqual(q.labels.length, 10);
});

const task = (id, o = {}) => ({ id, title: 'T' + id, note: '', project_id: null, parent_id: null, priority: 4, due: null, due_time: null, recur: null, labels: [], done: false, done_at: null, created_at: id, updated_at: id, order: id, ...o });

t('выборки', () => {
  const all = [task(1, { due: '2026-10-10' }), task(2, { due: TODAY, due_time: '09:00' }), task(3, { due: TODAY, priority: 1 }), task(4, { due: '2026-10-13' }), task(5), task(6, { due: TODAY, done: true }), task(7, { due: '2026-12-31' }), task(8, { project_id: 3 })];
  assert.deepStrictEqual(PL.todayTasks(all, TODAY).map(x => x.id), [1, 2, 3]);
  assert.deepStrictEqual(PL.inboxTasks(all).map(x => x.id), [1, 2, 3, 4, 7, 5]);
  const u = PL.upcoming(all, TODAY, 14);
  assert.deepStrictEqual([u.overdue.map(x => x.id), u.days.map(d => d.date), u.later.map(x => x.id)], [[1], [TODAY, '2026-10-13'], [7]]);
  assert.strictEqual(PL.openCount(all, 3), 1);
  assert.strictEqual(PL.withKnownProjects(all, []).find(x => x.id === 8).project_id, null);
});

t('подзадачи и метки', () => {
  const all = [task(1), task(2, { parent_id: 1 }), task(3, { parent_id: 2 }), task(4, { parent_id: 99 }), task(5, { labels: ['дом', 'важно'] }), task(6, { labels: ['дом'] }), task(7, { labels: ['дом'], done: true })];
  const tree = PL.nest(all.slice(0, 4));
  assert.deepStrictEqual(tree.map(n => n.task.id), [1, 4]);
  assert.deepStrictEqual(tree[0].children[0].children.map(n => n.task.id), [3]);
  assert.deepStrictEqual(PL.descendants(all, 1).map(x => x.id), [2, 3]);
  assert.deepStrictEqual(PL.labelCounts(all), [{ label: 'важно', count: 1 }, { label: 'дом', count: 2 }]);
  const cyc = [task(1, { parent_id: 2 }), task(2, { parent_id: 1 })];
  assert.doesNotThrow(() => PL.nest(cyc));
});

t('сетка календаря', () => {
  assert.strictEqual(PL.weekDays(TODAY)[0], '2026-10-05');
  assert.strictEqual(PL.weekDays(TODAY)[6], '2026-10-11');
  const m = PL.monthGrid('2026-10-11');
  assert.deepStrictEqual([m.length, m[0][0], m[m.length - 1][6]], [5, '2026-09-28', '2026-11-01']);
  assert.strictEqual(PL.monthGrid('2027-02-10').length, 4, 'февраль 2027 начинается с понедельника — ровно четыре недели');
  assert.deepStrictEqual(PL.visibleRange('week', TODAY), { from: '2026-10-05', to: '2026-10-11' });
  assert.strictEqual(PL.shiftPeriod('month', '2026-01-31', 1), '2026-02-28');
  assert.strictEqual(PL.shiftPeriod('week', TODAY, -1), '2026-10-04');
  assert.strictEqual(PL.periodTitle('month', TODAY), 'Октябрь 2026');
  assert.strictEqual(PL.periodTitle('week', TODAY), '5 – 11 октября');
  assert.strictEqual(PL.periodTitle('week', '2026-12-30'), '28 декабря – 3 января 2027');
  assert.deepStrictEqual(PL.readCalParams('week', '2026-10-01', TODAY), { view: 'week', day: '2026-10-01' });
  assert.deepStrictEqual(PL.readCalParams('foo', 'bad', TODAY), { view: 'month', day: TODAY });
});

t('события календаря', () => {
  const tasks = [task(1, { due: TODAY, recur: { kind: 'day', every: 2 }, due_time: '08:00' }), task(2, { due: '2026-10-12', done: true }), task(3, { due: '2026-10-08' }), task(4)];
  const data = {
    goals: [{ course_id: 5, title: 'Python', icon: '🐍', date: '2026-10-14' }],
    tests: [{ day: '2026-10-09', course_id: 5, course_title: 'Python', icon: '🐍', type_name: 'Итоговый тест', score: 60 }, { day: '2026-10-09', course_id: 5, course_title: 'Python', icon: '🐍', type_name: 'Итоговый тест', score: 85 }],
    study: [{ day: '2026-10-09', minutes: 25, lessons: 2, xp: 40 }],
  };
  const ev = PL.eventsInRange(tasks, data, '2026-10-05', '2026-10-18', TODAY);
  assert.deepStrictEqual((ev.get('2026-10-13') || []).map(e => e.ghost), [true]);
  assert.deepStrictEqual([...ev.keys()].filter(k => ev.get(k).some(e => e.ghost)), ['2026-10-13', '2026-10-15', '2026-10-17']);
  const d9 = ev.get('2026-10-09');
  assert.deepStrictEqual(d9.map(e => e.kind), ['test', 'study']);
  assert.ok(d9[0].detail.includes('85%') && d9[0].detail.includes('тестов: 2'));
  assert.ok(ev.get('2026-10-08')[0].overdue);
  assert.strictEqual(ev.get('2026-10-14')[0].kind, 'goal');
  assert.ok(!ev.has('2026-10-20'));
  const only = PL.eventsInRange(tasks, data, '2026-10-05', '2026-10-18', TODAY, new Set(['goal']));
  assert.deepStrictEqual([...only.keys()], ['2026-10-14']);
  assert.strictEqual(PL.eventsInRange(tasks, data, '2026-10-18', '2026-10-05', TODAY).size, 0);
  assert.deepStrictEqual(PL.summarize(ev.get(TODAY)), { goal: 0, test: 0, open: 1, done: 0, overdue: 0, study: 0 });
  const d11 = ev.get(TODAY); assert.strictEqual(d11[0].time, '08:00');
});

console.log(`ВСЕ ПРОВЕРКИ ЛОГИКИ ПЛАНИРОВЩИКА ПРОЙДЕНЫ (${n} групп)`);
