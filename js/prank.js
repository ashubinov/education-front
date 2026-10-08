/* LearnQuest — розыгрыш для друзей: после регистрации окно с вопросом, на который можно ответить только «ДА».
   Кнопка «НЕТ» исчезает при приближении курсора/пальца и появляется в другом месте — нажать на неё физически нельзя. */
'use strict';

const PRANK_KEY = 'lq_prank';

function prankArm() { try { localStorage.setItem(PRANK_KEY, '1'); } catch (e) { /* без хранилища розыгрыш не повторяем */ } }
function prankPending() { try { return localStorage.getItem(PRANK_KEY) === '1'; } catch (e) { return false; } }
function prankClear() { try { localStorage.removeItem(PRANK_KEY); } catch (e) { /* ignore */ } }

function maybePrank() {
  if (!S.user) return;
  if (prankPending()) setTimeout(showPrank, 700);
  else { try { if (localStorage.getItem('lq_prank_yes') === '1') prankUnlock(); } catch (e) { /* ignore */ } }
}

function showPrank() {
  if (document.getElementById('prank')) return;
  const ov = document.createElement('div');
  ov.id = 'prank';
  ov.setAttribute('role', 'alertdialog');
  ov.innerHTML = `<div class="card prank-card"><div class="prank-emoji">🤨</div><h2>Сосал?</h2>
    <div class="prank-btns"><button class="btn lg good" id="prank-yes">ДА</button></div></div>
    <button class="btn lg bad prank-no" id="prank-no" tabindex="-1" aria-hidden="true">НЕТ</button>`;
  document.body.appendChild(ov);
  document.body.classList.add('no-scroll');

  const yes = ov.querySelector('#prank-yes'), no = ov.querySelector('#prank-no');
  let px = -999, py = -999, busy = false;

  // стартовая позиция «НЕТ» — рядом с «ДА»
  const place = (avoid = true) => {
    const w = no.offsetWidth || 120, h = no.offsetHeight || 54, vw = ov.clientWidth || innerWidth || 360, vh = ov.clientHeight || innerHeight || 640;
    const yr = yes.getBoundingClientRect();
    for (let i = 0; i < 60; i++) {
      const x = 8 + Math.random() * Math.max(1, vw - w - 16), y = 8 + Math.random() * Math.max(1, vh - h - 16);
      const cx = x + w / 2, cy = y + h / 2;
      const far = Math.hypot(cx - px, cy - py) > Math.min(220, Math.min(vw, vh) / 2.4);
      const overYes = x < yr.right + 12 && x + w > yr.left - 12 && y < yr.bottom + 12 && y + h > yr.top - 12;
      if ((!avoid || far) && !overYes) { no.style.left = x + 'px'; no.style.top = y + 'px'; return; }
    }
    no.style.left = '8px'; no.style.top = '8px';
  };
  const yr0 = yes.getBoundingClientRect();
  no.style.left = (yr0.right + 16) + 'px';
  no.style.top = yr0.top + 'px';

  // исчезнуть и появиться в другом месте
  const dodge = e => {
    if (e && e.cancelable) e.preventDefault();
    if (busy) return;
    busy = true;
    no.classList.add('gone');
    setTimeout(() => { place(); no.classList.remove('gone'); busy = false; }, 140);
  };
  ['pointerenter', 'mouseenter', 'mouseover', 'pointerdown', 'mousedown', 'touchstart', 'click', 'focus', 'contextmenu', 'dblclick'].forEach(ev =>
    no.addEventListener(ev, dodge, { passive: false }));
  no.addEventListener('keydown', e => { e.preventDefault(); no.blur(); dodge(e); });
  // приближение курсора/пальца: убегает, не дожидаясь наведения
  const near = e => {
    px = e.clientX; py = e.clientY;
    if (busy) return;
    const r = no.getBoundingClientRect(), m = 70;
    if (px > r.left - m && px < r.right + m && py > r.top - m && py < r.bottom + m) dodge(e);
  };
  document.addEventListener('pointermove', near, true);
  document.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) near({ clientX: t.clientX, clientY: t.clientY }); }, { capture: true, passive: true });
  document.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) near({ clientX: t.clientX, clientY: t.clientY }); }, { capture: true, passive: true });
  addEventListener('resize', () => place(false));
  // окно нельзя закрыть ни клавишей Esc, ни кликом по фону
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') e.preventDefault(); });
  ov.addEventListener('mousedown', e => e.stopPropagation());

  // «ДА»: окно закрывается сразу, не дожидаясь сервера; достижение выдаётся в фоне (при сбое — повторится при следующем заходе)
  const answer = () => {
    prankClear();
    ov.remove();
    document.body.classList.remove('no-scroll');
    try { play('level'); confetti(160); } catch (e) { /* не важно */ }
    prankUnlock();
  };
  yes.addEventListener('click', answer);
  setTimeout(() => yes.focus(), 100);
}

async function prankUnlock() {
  try {
    const r = await api('/prank/yes', { method: 'POST' });
    try { localStorage.removeItem('lq_prank_yes'); } catch (e) { /* ignore */ }
    toast(r.achievement.desc, { icon: r.achievement.icon, title: 'Достижение: ' + r.achievement.title, cls: 'ach-t', ms: 7000 });
    refreshMe();
  } catch (e) {
    try { localStorage.setItem('lq_prank_yes', '1'); } catch (e2) { /* ignore */ }
  }
}
