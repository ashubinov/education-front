/* LearnQuest — «Аэропорт» (#/farm/airport): шуточная локация. Единственная авиакомпания — «Клубничные авиалинии», рейсы которой вечно отменяются и переносятся.
   Всё решает сервер (/api/airport/*): что объявят, когда и сколько компенсации. Здесь — сцена (рисуется кодом), табло, касса и паспорт пассажира. Каркас — loc-kit.js. */
'use strict';

Object.assign(SFX, { arPing: () => tone([784, 659, 523], .08, 'sine', .05) });
const AIR = locKit({
  api: '/airport', hash: /^#\/farm\/airport$/, name: 'Аэропорт', page: s => airPage(s), refreshPanel: true,
  events(events) {
    for (const e of events) {
      if (e.type === 'ticket') { play('arPing'); toast(`Рейс в «${e.dest}». Вылет «скоро». Что именно значит «скоро», узнаешь по ходу дела`, { icon: e.icon, title: 'Билет куплен', ms: 3200 }); }
      if (e.type === 'landed') { play('fmLevel'); confetti(80); toast(`${e.text}: +💰 ${e.reward}. Отмен за этот путь: ${e.cancels}`, { icon: '🛬', title: `Приземлились в «${e.dest}»`, ms: 3600 }); }
      if (e.type === 'refund') toast(`Билет сдан: +💰 ${e.coins}. Остальное — комиссия за возврат, она же комиссия за отмену отмены`, { icon: '🎫', title: 'Возврат', ms: 3200 });
    }
  },
});
const airTime = ts => new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const AIR_STATUS = { cancel: ['ОТМЕНЁН', 'bad'], moved: ['ПЕРЕНЕСЁН', 'warn'], phantom: ['ПОСАДКА ИДЁТ', 'warn'], wait: ['ЗАДЕРЖАН', 'warn'] };

function airPage(s) {
  const t = s.trip, st = s.stats;
  return locPage({ cls: 'ar', label: 'Аэропорт', svg: airScene(s), tip: 'Нажимай на самолёт и здание — это касса, на табло — вылеты. Все рейсы одной авиакомпании, и все с приключениями.',
    hud: [{ title: 'Аэропорт', text: html`✈️ <b>Аэропорт</b>` }, { title: 'Монеты фермы', text: html`💰 <b>${slFmt(s.coins)}</b>` }, { title: 'Должность пассажира', text: html`🎖 <b>${st.rank}</b>` }, { title: 'Пережито отмен', text: html`❌ <b>${st.cancels}</b>` }],
    dock: [{ act: 'airDesk', icon: '🎫', text: 'Касса', badge: t && t.state === 'landed' ? '!' : '' }, { act: 'airBoard', icon: '📟', text: 'Табло' }, { act: 'airPass', icon: '🛂', text: 'Паспорт' }, { act: 'airExit', icon: '🌾', text: 'На ферму' }] });
}

/* ---------------- сцена ---------------- */
/** Коробка, у которой низ стоит на высоте z0 (диспетчерская кабина на башне). */
const arBoxZ = (x, y, w, d, z0, z1, c) => faPoly([[x, y + d, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x, y + d, z1]], faShade(c, .86)) + faPoly([[x + w, y, z0], [x + w, y + d, z0], [x + w, y + d, z1], [x + w, y, z1]], faShade(c, .68))
  + faPoly([[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]], c);

function arPlane(x, y, st) {
  const t = st.trip, last = t && t.log.length ? t.log[t.log.length - 1].kind : '';
  const stamp = t && t.state === 'landed' ? ['ПРИЛЕТЕЛ!', '#2fbf6a'] : last === 'delay' ? ['ПЕРЕНЕСЁН', '#e08a1c'] : last === 'board' || last === 'air' ? ['В ПУТИ?', '#e08a1c'] : ['ОТМЕНЁН', '#d6314a'];
  const body = `<g transform="${lcP(x, y)} rotate(26.6)"><ellipse cx="0" cy="6" rx="86" ry="11" fill="rgba(0,0,0,.2)"/>`
    + `<path d="M-6 -12 L-44 -50 L-26 -50 L22 -12Z" fill="#c42a40" stroke="#7a1626" stroke-width="2"/>`
    + `<path d="M-64 -20 L-78 -60 L-60 -60 L-34 -20Z" fill="#e63950" stroke="#7a1626" stroke-width="2"/><path d="M-66 -52 q-6 -12 4 -14 q-1 8 8 8z M-74 -56 q-10 -4 -4 -12 q5 5 6 11z" fill="#3fae4a" stroke="#256b2c" stroke-width="1.2"/>`
    + `<path d="M-6 6 v6 M40 6 v6" stroke="#3b2a1e" stroke-width="3" stroke-linecap="round"/><circle cx="-6" cy="13" r="4" fill="#3b2a1e"/><circle cx="40" cy="13" r="4" fill="#3b2a1e"/>`
    + `<rect x="-84" y="-34" width="170" height="38" rx="19" fill="#fff6f6" stroke="#7a1626" stroke-width="2.6"/><path d="M-70 -6 H78 q-12 10 -34 10 H-52 q-14 0 -18 -10Z" fill="#e63950"/>`
    + `<path d="M62 -34 q24 0 24 19 q0 15 -24 15z" fill="#e63950" stroke="#7a1626" stroke-width="2.4"/><path d="M68 -26 q10 2 12 9 h-12z" fill="#bfe6f5" stroke="#5b3a22" stroke-width="1.4"/>`
    + [-46, -30, -14, 2, 18, 34].map(cx => `<circle cx="${cx}" cy="-20" r="4.2" fill="#bfe6f5" stroke="#5b3a22" stroke-width="1.4"/>`).join('')
    + `<text x="-70" y="-14" font-size="15">🍓</text>`
    + `<path d="M-14 -4 L-52 30 L-32 30 L28 -4Z" fill="#e63950" stroke="#7a1626" stroke-width="2.2"/><ellipse cx="-30" cy="20" rx="12" ry="7" fill="#9aa3ad" stroke="#555d66" stroke-width="2"/></g>`;
  let info;
  if (!t) info = faBubble(x + 1.2, y + .1, 120, '🎫', 'add');
  else if (t.state === 'landed') info = faBubble(x + 1.2, y + .1, 120, '🎁', 'ready');
  else info = faRing(x + 1.2, y + .1, 120, t.left, t.total, t.log.length ? t.log[t.log.length - 1].icon : '🎫');
  return `<g class="fs-hit" data-act="airDesk" aria-label="Самолёт «Клубничных авиалиний»">${body}<g transform="${lcP(x + .9, y + .9, 18)}"><g transform="rotate(-6)"><rect x="-40" y="-9" width="80" height="17" rx="4" fill="${stamp[1]}" stroke="#fff" stroke-width="1.6"/>`
    + `<text y="4" text-anchor="middle" font-size="10.5" font-weight="900" fill="#fff">${stamp[0]}</text></g></g></g><g style="pointer-events:none">${info}</g>`;
}
function arTerminal(st) {
  const x = .5, y = .8, w = 5, d = 2.2, h = 40;
  return `<g class="fs-hit" data-act="airDesk" aria-label="Касса авиакомпании">` + faBox(x, y, w, d, h, '#f7e4e1')
    + [0, 1, 2, 4, 5].map(i => faWindow(x + .35 + i * .8, y + d, 8, 'L', .4, '#bfe6f5')).join('')
    + faPoly([[x + 2.75, y + d, 0], [x + 3.55, y + d, 0], [x + 3.55, y + d, 28], [x + 2.75, y + d, 28]], '#7aa7c7', 'stroke="#5b3a22" stroke-width="2.4"')
    + faGable(x, y, w, d, h, 12, '#d6314a', '#f7e4e1') + faBox(x + 3.9, y + .3, .7, .7, 62, '#c92e44')
    + `<g transform="${lcP(x + w / 2, y + d + .1, 34)}"><rect x="-84" y="-10" width="168" height="19" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.8"/><text y="4" text-anchor="middle" font-size="11" font-weight="900" fill="#ffe3e8">🍓 КЛУБНИЧНЫЕ АВИАЛИНИИ</text></g></g>`;
}
function arBoard(st) {
  const x = 6.4, y = 1.0, rows = st.board.slice(0, 4);
  const line = (r, i) => { const [, c] = AIR_STATUS[r.status] || ['', 'bad']; const col = c === 'bad' ? '#ff6b6b' : '#ffcd4a'; return `<text x="-50" y="${-72 + i * 13}" font-size="9.5" font-weight="800" fill="#d8e4ee">${r.no}</text><text x="50" y="${-72 + i * 13}" text-anchor="end" font-size="9.5" font-weight="900" fill="${col}">${AIR_STATUS[r.status][0].slice(0, 9)}</text>`; };
  return `<g class="fs-hit" data-act="airBoard" aria-label="Табло вылетов"><g transform="${lcP(x, y + 1.9)}"><ellipse cy="3" rx="46" ry="9" fill="rgba(0,0,0,.18)"/><rect x="-37" y="-52" width="6" height="54" fill="#59626c"/><rect x="31" y="-52" width="6" height="54" fill="#59626c"/>`
    + `<rect x="-58" y="-98" width="116" height="74" rx="7" fill="#1c2733" stroke="#f8efe0" stroke-width="2.4"/><text x="0" y="-86" text-anchor="middle" font-size="9" font-weight="900" fill="#7fd2ff">ВЫЛЕТЫ</text>${rows.map(line).join('')}</g></g>`;
}
function arRunway() {
  const N = 11;
  let g = faPoly([[0, 3.6, 0], [N, 3.6, 0], [N, 7.6, 0], [0, 7.6, 0]], '#cfd3d9', 'stroke="#aeb4bc" stroke-width="2"')
    + faPoly([[0, 8.0, 0], [N, 8.0, 0], [N, 9.7, 0], [0, 9.7, 0]], '#4b505a', 'stroke="#2f343c" stroke-width="2"');
  for (let i = 0; i < 9; i++) g += faLine([.5 + i * 1.2, 8.85, 0], [1.1 + i * 1.2, 8.85, 0], '#fff', 3.4);
  for (let i = 0; i < 5; i++) g += faLine([1.2 + i * 2.2, 3.9, 0], [1.9 + i * 2.2, 3.9, 0], '#f2cd4b', 2.4);
  return g;
}
function airScene(st) {
  const N = 11, objs = [], add = (d, svg) => objs.push({ d, svg });
  let g = locBase('ar', N, { grass: ['#b6dc86', '#97c866'], side: ['#6b8f3a', '#527030'], seed: 31, deco: 60, blades: .5, skip: (x, y) => y > 3.4 && y < 9.9 });
  g += arRunway();
  add(.5 + .8 + 2.2 + 1, arTerminal(st));
  add(6.4 + 1.0 + 1.9, arBoard(st));
  add(8.6 + 1.2 + .9, `<g class="fs-hit" data-act="airBoard" aria-label="Диспетчерская башня">` + faBox(8.6, 1.2, .9, .9, 70, '#e9edf2') + arBoxZ(8.4, 1.0, 1.3, 1.3, 70, 92, '#bfe6f5') + faPoly([[8.3, .9, 94], [9.8, .9, 94], [9.8, 2.4, 94], [8.3, 2.4, 94]], '#c92e44')
    + `<g transform="${lcP(9.05, 1.65, 106)}"><path d="M0 0 v-18" stroke="#59626c" stroke-width="2"/><path d="M0 -18 l22 5 l-22 5z" fill="#ff7a1a" stroke="#a84a00" stroke-width="1.2"/></g></g>`);
  add(4.4 + 5.2 + 1, arPlane(4.2, 5.3, st));
  add(1.0 + 4.9 + .6, `<g class="fs-hit" data-act="airDesk" aria-label="Зал ожидания">` + faBox(1.0, 4.9, 1.8, .55, 12, '#8a6a46') + `<g transform="${lcP(1.9, 5.2, 12)}"><text x="-26" y="-2" font-size="16">🧍</text><text x="-6" y="-2" font-size="16">🧍</text><text x="14" y="-2" font-size="16">😴</text></g>`
    + `<g transform="${lcP(1.9, 5.5, 34)}"><rect x="-44" y="-9" width="88" height="17" rx="5" fill="#2f4a40" stroke="#f8efe0" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="10" font-weight="900" fill="#e8fff4">ЗАЛ ОЖИДАНИЯ</text></g></g>`);
  add(7.6 + 6.0 + .6, faBox(7.6, 6.0, 1.1, .6, 10, '#7d8590') + `<g transform="${lcP(8.1, 6.3, 10)}"><text x="-14" y="2" font-size="16">🧳</text><text x="2" y="2" font-size="16">🧳</text></g>`);
  [[6.9, 7.1], [7.15, 7.25], [10.1, 5.4]].forEach(([x, y], i) => add(x + y, `<g transform="${lcP(x, y)}"><path d="M-6 0 L0 -17 L6 0Z" fill="#ff7a1a" stroke="#a84a00" stroke-width="1.2"/><rect x="-7" y="-1" width="14" height="3" fill="#5b3a22"/></g>`));
  add(.6 + 10.2, locSign(.6, 10.2, 'НА ФЕРМУ', 'airExit', 'На ферму'));
  [[.3, 10.4, 'oak'], [10.5, 10.2, 'pine'], [10.4, .3, 'pine'], [7.6, .3, 'oak'], [3.2, 10.7, 'pine']].forEach(([x, y, k], i) => add(x + y, faTree(x, y, k, i * 17 + 3)));
  return g + objs.sort((a, b) => a.d - b.d).map(o => o.svg).join('');
}

/* ---------------- окна ---------------- */
actions.airExit = () => { closeModal(); location.hash = '#/farm'; };
actions.airBuy = () => AIR.act('ticket', {}, 'fmCoin', true);
actions.airClaim = () => AIR.act('claim', {}, 'fmCoin');
actions.airRefund = () => AIR.act('refund', {}, 'fmCoin', true);

const airLog = t => html`<div class="ar-log">${[...t.log].reverse().map(l => html`<div class="ar-log-r ${l.kind}"><span class="ar-log-ic">${l.icon}</span><div class="grow"><div>${l.text}</div><div class="small muted">${l.at ? 'через ' + fmClock(l.at) + ' после покупки' : 'в момент покупки'}</div></div></div>`)}</div>`;

actions.airDesk = () => AIR.show(() => {
  const s = AIR.K.st, t = s.trip;
  if (!t) return AIR.panel('🎫 Касса «Клубничных авиалиний»', html`<p style="margin:0 0 8px">Единственная авиакомпания аэропорта. Расписание — предложение, а не обещание.</p>
    <ul class="ar-ul"><li>Куда полетишь, узнаешь после покупки (если вообще узнаешь).</li><li>Рейсы отменяют и переносят по самым разным причинам. Лететь придётся несколько часов.</li><li>После приземления выдают «компенсацию за неудобства». Она в среднем меньше билета: всё это чисто для души.</li></ul>
    <div class="la-row"><span>Билет</span><b>💰 ${slFmt(s.ticket_price)}</b></div><div class="la-row"><span>У тебя</span><b>💰 ${slFmt(s.coins)}</b></div>
    <div class="row mt" style="justify-content:flex-end;gap:8px"><button class="btn ghost" data-act="closeModal">Закрыть</button><button class="btn" data-act="airBuy" ${s.coins >= s.ticket_price ? '' : 'disabled'}>Купить билет · 💰 ${s.ticket_price}</button></div>`);
  if (t.state === 'landed') return AIR.panel(`🛬 «${t.dest}»`, html`<p style="margin:0 0 8px"><b>Приземлились!</b> Рейс ${t.flight} прилетел. Билет — это не про скорость.</p>
    <div class="ar-prize"><span>🎁</span><div class="grow"><b>Компенсация за неудобства</b><div class="small muted">${t.comp_text}</div></div><b>💰 ${t.reward}</b></div>${airLog(t)}
    <div class="row mt" style="justify-content:flex-end"><button class="btn" data-act="airClaim">Забрать компенсацию</button></div>`);
  AIR.panel(`${t.icon} Рейс ${t.flight} в «${t.dest}»`, html`<p class="muted small" style="margin:0 0 6px">${t.next_in > 0 ? html`Следующее объявление через <b>${fmTimer(t.next_in)}</b>.` : ''} До прилёта, если ничего не отменят: <b>${fmTimer(t.left)}</b>.</p>${fmBar(t.left, t.total)}
    <h3 class="fm-h">Объявления</h3>${airLog(t)}<div class="row mt" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="airRefund" title="Вернётся десятая часть цены">Вернуть билет (+💰 ${s.refund})</button><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
});

actions.airBoard = () => AIR.show(() => {
  const s = AIR.K.st;
  AIR.panel('📟 Табло вылетов', html`<div class="ar-board">${s.board.map(r => { const [txt, cls] = AIR_STATUS[r.status];
    return html`<div class="ar-brow"><b class="ar-time">${airTime(r.sched)}</b><div class="grow"><b>${r.no}</b> ${r.icon} ${r.dest}<div class="small muted">${r.reason}</div></div>
      <div class="ar-st ${cls}">${txt}${r.new_sched ? html`<small>на ${airTime(r.new_sched)}</small>` : ''}</div></div>`; })}</div>
    <p class="muted small" style="margin:8px 0 0">Табло одно на всех и обновляется раз в 15 минут. Нормальных рейсов у компании не бывает: проверено.</p>${locCloseBtn}`);
});

actions.airPass = () => AIR.show(() => {
  const st = AIR.K.st.stats;
  AIR.panel('🛂 Паспорт пассажира', html`<div class="ar-rank"><span>🎖</span><div class="grow"><b>${st.rank}</b><div class="small muted">${st.next_rank ? `До «${st.next_rank}» — ещё ${st.next_need - st.cancels} ${plural(st.next_need - st.cancels, 'отмена', 'отмены', 'отмен')}` : 'Выше только авиадиспетчер, а он давно в отпуске'}</div></div></div>
    <div class="tiles slot-tiles"><div class="card tile"><b>${st.trips}</b><span>полётов</span></div><div class="card tile"><b>${st.cancels}</b><span>отмен пережито</span></div><div class="card tile"><b>${st.hours}</b><span>ч в ожидании</span></div>
      <div class="card tile"><b>💰 ${slFmt(st.spent)}</b><span>потрачено на билеты</span></div><div class="card tile"><b>💰 ${slFmt(st.comp)}</b><span>компенсаций</span></div></div>${locCloseBtn}`);
});
