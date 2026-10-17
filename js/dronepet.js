/* LearnQuest — дрон-напоминание «до летучек» в правом верхнем углу на всех страницах (кроме прохождения курсов и самих летучек).
   Парит, под ним обратный отсчёт до ближайшего понедельника 14:10 UTC. По нажатию говорит фразу со звуком (звуки 2, 3, 4 по очереди),
   на пятое нажатие — звук 1 и видео «ты не сдашь летучки» (зелёный фон видео вырезается, как в летучках). */
'use strict';

const DP = { el: null, clicks: 0, last: 0, phrase: 0, sayTimer: null, audio: null, busy: false };
const DP_PHRASES = ['Решать летучки!!!', 'Быстро учить структуры ОС!!!', 'Готовься лезть под стол, если не готовишься к летучкам!'];
const DP_SOUNDS = ['assets/sounds/2.mp3', 'assets/sounds/3.mp3', 'assets/sounds/4.mp3'];
const DP_FINAL_SOUND = 'assets/sounds/1.mp3';
const DP_IDLE_RESET_MS = 20000;   // пауза дольше — счётчик нажатий начинается заново
const DP_CLICKS_FOR_VIDEO = 5;

/** Ближайший понедельник 14:10 UTC (если сейчас понедельник до 14:10 — сегодня). */
function dpNextTarget(now = new Date()) {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 10, 0));
  t.setUTCDate(t.getUTCDate() + (1 - t.getUTCDay() + 7) % 7);
  if (t <= now) t.setUTCDate(t.getUTCDate() + 7);
  return t;
}
/** «2 дн 18 ч 20 мин» */
function dpCountdown(now = new Date()) {
  const left = Math.max(0, dpNextTarget(now) - now), m = Math.floor(left / 60000);
  return `${Math.floor(m / 1440)} дн ${Math.floor(m % 1440 / 60)} ч ${m % 60} мин`;
}
/** На каких страницах дрона нет: курсы и занятия (прохождение), сами летучки (там свои анимации), вход и экраны блокировки. */
function dpHiddenOn(hash) {
  return /^#\/(?:learn|run)\/\d+/.test(hash) || /^#\/letuchki\/set\/\d+/.test(hash) || /^#\/(?:auth|newpass)/.test(hash);
}

function dpMount() {
  if (DP.el) return DP.el;
  const el = document.createElement('div');
  el.id = 'dp'; el.className = 'dp'; el.hidden = true;
  el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', 'Дрон: напоминание о летучках. Нажми, чтобы он что-нибудь сказал');
  el.innerHTML = `<div class="dp-say" hidden></div>
    <div class="dp-body"><img class="dp-img" src="assets/drone.png" alt="" draggable="false">
      <div class="dp-label"><span>до летучек:</span><b class="dp-time"></b></div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', dpClick);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dpClick(); } });
  DP.el = el;
  return el;
}

/** Раз в секунду: показать/спрятать, поставить под шапку, обновить отсчёт. */
function dpTick() {
  const el = dpMount();
  const show = !!(S.user && !S.banned && !dpHiddenOn(location.hash || '#/') && !document.getElementById('lt-fail') && !document.getElementById('dp-video'));
  if (el.hidden === show) el.hidden = !show;
  document.documentElement.classList.toggle('dp-on', show);   // на телефоне верхние вкладки сдвигаются, чтобы дрон их не закрывал
  if (!show) return;
  const bar = document.querySelector('.topbar'), top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  el.style.setProperty('--dp-top', Math.round(top + 8) + 'px');
  const t = el.querySelector('.dp-time'), txt = dpCountdown();
  if (t && t.textContent !== txt) t.textContent = txt;
}
setInterval(dpTick, 1000);
window.addEventListener('hashchange', () => setTimeout(dpTick, 50));
window.addEventListener('resize', dpTick);
setTimeout(dpTick, 300);

/* ---------- нажатия ---------- */
function dpPlay(src, onEnd) {
  let done = false;
  const finish = () => { if (!done) { done = true; if (onEnd) onEnd(); } };
  if (!(S.user && S.user.sound)) { if (onEnd) setTimeout(finish, 0); return; }   // «Звуковые эффекты» выключены в настройках
  try {
    if (DP.audio) DP.audio.pause();
    const a = new Audio(src); a.volume = 0.85; DP.audio = a;
    a.addEventListener('ended', finish, { once: true });
    a.addEventListener('error', finish, { once: true });
    a.play().catch(finish);
    setTimeout(finish, 7000);   // страховка: звук не должен задерживать видео
  } catch (e) { finish(); }
}
function dpSay(text) {
  const b = DP.el.querySelector('.dp-say');
  b.textContent = text; b.hidden = false;
  clearTimeout(DP.sayTimer); DP.sayTimer = setTimeout(() => { b.hidden = true; }, 4200);
  const body = DP.el.querySelector('.dp-body');
  body.classList.remove('dp-hop'); void body.offsetWidth; body.classList.add('dp-hop');   // подпрыгивает при нажатии
}
function dpClick() {
  if (DP.busy) return;
  const now = Date.now();
  if (now - DP.last > DP_IDLE_RESET_MS) DP.clicks = 0;
  DP.last = now; DP.clicks++;
  if (DP.clicks >= DP_CLICKS_FOR_VIDEO) {
    DP.clicks = 0; DP.busy = true;
    dpSay('Ты не сдашь летучки…');
    dpPlay(DP_FINAL_SOUND, () => { dpVideo(); });
    return;
  }
  const i = (DP.clicks - 1) % DP_PHRASES.length;
  dpSay(DP_PHRASES[i]);
  dpPlay(DP_SOUNDS[i]);
}

/* ---------- финальное видео: зелёный фон вырезан, красная рамка и надпись ---------- */
function dpVideo() {
  dpVideoClose();
  const box = document.createElement('div');
  box.id = 'dp-video'; box.className = 'lt-fail dp-fail';
  box.innerHTML = `<canvas class="lt-fail-canvas"></canvas><video class="lt-fail-video" src="assets/drone_fail.mp4" playsinline preload="auto"></video><div class="lt-fail-frame"></div>
    <div class="lt-fail-title">ТЫ НЕ СДАШЬ ЛЕТУЧКИ</div>
    <div class="lt-fail-btns"><div class="row lt-actions"><button class="btn lg ghost" data-act="dpClose">Закрыть</button></div></div>`;
  document.body.appendChild(box);
  DP.el.hidden = true;
  const v = box.querySelector('video');
  v.volume = 0.3;
  v.muted = !(S.user && S.user.sound);
  if (typeof ltChroma === 'function') ltChroma(box, v); else box.classList.add('raw');
  v.play().catch(() => { v.muted = true; v.play().catch(() => { /* видео недоступно — остаются надпись и кнопка */ }); });
  document.addEventListener('keydown', dpEsc);
}
const dpEsc = e => { if (e.key === 'Escape') dpVideoClose(); };
function dpVideoClose() {
  document.removeEventListener('keydown', dpEsc);
  const b = document.getElementById('dp-video');
  if (b) { const v = b.querySelector('video'); if (v) v.pause(); b.remove(); }
  DP.busy = false;
  dpTick();
}
actions.dpClose = dpVideoClose;
