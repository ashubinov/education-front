/* LearnQuest — Летучки: контрольные по лекциям (предмет → тема → вариант → два вопроса) и дрон-анимации.
   Ответы проверяет сервер (сравнение с эталоном лектора). Опыт даётся только за первое прорешивание варианта. */
'use strict';

const LT_ICON = { 'Операционные системы': '💻' };
const LT_BADGE = { ok: ['🏆', 'верно', 'good'], partial: ['🟡', 'частично', 'warn'], fail: ['✖', 'неверно', 'bad'] };
const LT_VERDICT = { correct: ['✅', 'верно'], partial: ['🟡', 'частично'], wrong: ['❌', 'неверно'] };

/** Переключатель «Курсы / Летучки» (показывается сверху на главной и на страницах летучек). */
function ltTabs(active) {
  return html`<div class="lt-tabs" role="tablist"><a href="#/" class="${active === 'courses' ? 'on' : ''}" role="tab">📚 Курсы</a><a href="#/letuchki" class="${active === 'letuchki' ? 'on' : ''}" role="tab">📝 Летучки</a></div>`;
}
/** Эталонный ответ: экранируем, затем **жирный** и переводы строк. */
function ltMd(text) {
  return raw(esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'));
}

/* =============================== предметы =============================== */
route(/^#\/letuchki$/, async () => {
  render(app(), shell('home', html`${ltTabs('letuchki')}<div class="center muted mt-l"><span class="spinner"></span></div>`));
  const subs = await api('/letuchki/subjects');
  render(app(), shell('home', html`${ltTabs('letuchki')}
    <h2 class="lt-h">Летучки</h2>
    <p class="muted lt-sub">Выбери предмет. Летучки открыты все — решай любую и сколько угодно раз. Опыт дают только за первое прорешивание.</p>
    <div class="grid lt-grid">${subs.length ? subs.map(s => html`<a class="card lt-card" href="#/letuchki/s/${s.id}">
        <div class="lt-ico">${LT_ICON[s.title] || '📝'}</div><div class="grow"><b>${s.title}</b>
        <div class="small muted">${s.topics} ${plural(s.topics, 'тема', 'темы', 'тем')} · ${s.sets} ${plural(s.sets, 'вариант', 'варианта', 'вариантов')}</div>
        <div class="small lt-done">Решено: ${s.done} из ${s.sets}</div></div><span class="lt-go">›</span></a>`) : html`<div class="card center muted">Летучек пока нет.${S.user.is_admin ? ' Загрузи файл ниже.' : ' Их добавит администратор.'}</div>`}</div>
    ${S.user.is_admin ? ltAdminCard() : ''}`));
});
function ltAdminCard() {
  return html`<div class="card mt lt-admin"><h3>🛠 Добавить или обновить летучки</h3>
    <p class="small muted">Загрузи .md-файл в том же формате («## Летучка N. …», «### Вариант K», «**Вопрос M …**» и эталонный ответ ниже). Совпавшие летучки и варианты обновятся, новые добавятся, остальные и результаты учеников не изменятся.</p>
    <div class="field"><label>Предмет</label><input type="text" id="ltsubject" maxlength="100" value="Операционные системы"></div>
    <div class="row wrap gap-s"><button class="btn sm ghost" data-act="ltUpload">⬆ Загрузить файл летучек</button><input type="file" id="ltfile" accept=".md,.txt,text/markdown,text/plain" class="hidden"></div>
    <div id="ltres" class="small mt"></div></div>`;
}
actions.ltUpload = () => {
  const inp = $('#ltfile');
  inp.onchange = async () => {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    const fd = new FormData(); fd.append('file', f); fd.append('subject', $('#ltsubject').value || 'Операционные системы');
    $('#ltres').textContent = 'Загружаю…';
    try {
      const r = await api('/letuchki/admin/upload', { method: 'POST', body: fd });
      $('#ltres').innerHTML = `✅ «${esc(r.subject)}»: добавлено вариантов — ${r.added}, обновлено — ${r.updated} (тем в файле: ${r.topics}).`;
      setTimeout(router, 1200);
    } catch (e) { $('#ltres').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  };
  inp.click();
};

/* =============================== темы предмета =============================== */
route(/^#\/letuchki\/s\/(\d+)$/, async sid => {
  render(app(), shell('home', html`${ltTabs('letuchki')}<div class="center muted mt-l"><span class="spinner"></span></div>`));
  const d = await api('/letuchki/subjects/' + sid);
  const open = +(sessionStorage.getItem('lt_open_' + sid) || 0);
  render(app(), shell('home', html`${ltTabs('letuchki')}
    <a class="lt-back" href="#/letuchki">← Предметы</a>
    <h2 class="lt-h">${LT_ICON[d.subject.title] || '📝'} ${d.subject.title}</h2>
    <p class="muted lt-sub">Нажми на тему и выбери вариант.</p>
    <div class="lt-topics">${d.topics.map(t => html`<div class="card lt-topic ${open === t.no ? 'open' : ''}" data-topic="${t.no}">
      <button class="lt-topic-head" data-act="ltTopic" data-sid="${sid}" data-no="${t.no}" aria-expanded="${open === t.no}">
        <span class="lt-no">${t.no}</span><span class="grow"><b>${t.title}</b><span class="small muted lt-mini">${ltTopicSummary(t)}</span></span><span class="lt-chev">▾</span></button>
      <div class="lt-variants">${t.variants.map(v => ltVariant(v))}</div></div>`)}</div>`));
});
function ltTopicSummary(t) {
  const done = t.variants.filter(v => v.attempts).length;
  return done ? `Решено вариантов: ${done} из ${t.variants.length}` : `${t.variants.length} ${plural(t.variants.length, 'вариант', 'варианта', 'вариантов')}`;
}
function ltVariant(v) {
  const b = v.best && LT_BADGE[v.best];
  return html`<a class="lt-variant" href="#/letuchki/set/${v.set_id}"><span class="lt-vn">Вариант ${v.variant}</span>
    ${b ? html`<span class="chip ${b[2]}">${b[0]} ${b[1]}</span>` : html`<span class="small muted">не решался</span>`}${v.attempts > 1 ? html`<span class="small muted">· попыток: ${v.attempts}</span>` : ''}</a>`;
}
actions.ltTopic = b => {
  const card = b.closest('.lt-topic'), on = !card.classList.contains('open');
  document.querySelectorAll('.lt-topic.open').forEach(c => { c.classList.remove('open'); c.querySelector('.lt-topic-head').setAttribute('aria-expanded', 'false'); });
  card.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
  try { sessionStorage.setItem('lt_open_' + b.dataset.sid, on ? b.dataset.no : '0'); } catch (e) { /* ignore */ }
};

/* =============================== сама летучка =============================== */
route(/^#\/letuchki\/set\/(\d+)$/, async id => {
  render(app(), shell('home', html`${ltTabs('letuchki')}<div class="center muted mt-l"><span class="spinner"></span></div>`));
  const s = await api('/letuchki/sets/' + id);
  S.lt = { set: s, done: false };
  render(app(), shell('home', html`${ltTabs('letuchki')}
    <a class="lt-back" href="#/letuchki/s/${s.subject_id}">← ${s.subject}</a>
    <div class="lt-head"><h2 class="lt-h">Летучка ${s.topic_no}. ${s.topic_title}</h2><span class="chip accent">Вариант ${s.variant}</span>${s.best ? html`<span class="chip ${LT_BADGE[s.best][2]}">${LT_BADGE[s.best][0]} лучший: ${LT_BADGE[s.best][1]}</span>` : ''}</div>
    <p class="muted lt-sub">${s.attempts ? 'Опыт за этот вариант уже получен — решай для практики.' : 'За первое прорешивание дают опыт.'} Отвечай своими словами, как на занятии.</p>
    <div id="lt-form">${s.questions.map((q, i) => html`<div class="card lt-q"><div class="lt-qn">Вопрос ${i + 1}</div><h3 class="lt-qt">${q.draw ? '✏️ ' : ''}${q.title}</h3>
      ${q.draw ? html`<div class="small muted">Рисунок здесь не нужен: опиши схему словами — какие блоки, какие стрелки и что они означают.</div>` : ''}
      <textarea class="lt-ans" id="lta${i}" rows="6" maxlength="6000" placeholder="Твой ответ…" spellcheck="true"></textarea></div>`)}
      <div class="row lt-actions"><button class="btn lg" id="ltcheck" data-act="ltCheck">Проверить</button></div></div>
    <div id="lt-result"></div>`));
  S.onLeave = droneStop;
  droneStart();
  const first = $('#lta0'); if (first) first.focus({ preventScroll: true });
});
actions.ltCheck = async b => {
  const s = S.lt && S.lt.set; if (!s || S.lt.done) return;
  const answers = s.questions.map((q, i) => ($('#lta' + i).value || '').trim());
  const empty = answers.findIndex(a => a.length < 3);
  if (empty >= 0) { toast(`Напиши ответ на вопрос ${empty + 1}`, { icon: '✍️' }); $('#lta' + empty).focus(); return; }
  busy(b, true, 'Проверяю…');
  try {
    const r = await api(`/letuchki/sets/${s.id}/check`, { method: 'POST', json: { answers } });
    S.lt.done = true; S.lt.result = r;
    document.querySelectorAll('.lt-ans').forEach(t => { t.disabled = true; });
    b.closest('.lt-actions').remove();
    ltShowResult(r);
    if (r.xp) { toast(`+${r.xp} опыта за первое прорешивание`, { icon: '⭐' }); refreshMe(); }
    else if (!r.first) toast('Опыт дают только за первое прорешивание', { icon: 'ℹ️' });
  } catch (e) { busy(b, false); toast(e.message, { icon: '⚠️' }); }
};
function ltButtons(r) {
  return html`<div class="row lt-actions">${r.next ? html`<button class="btn lg" data-act="ltNext">Дальше →</button>` : ''}<button class="btn lg ghost" data-act="ltRetry">↺ Перерешать</button><button class="btn lg ghost" data-act="ltToCourse">К курсу</button></div>`;
}
function ltShowResult(r) {
  const title = r.overall === 'ok' ? ['🎯', 'Всё верно!'] : r.overall === 'partial' ? ['🟡', 'Частично верно'] : ['❌', 'Неверно'];
  const s = S.lt.set;
  render($('#lt-result'), html`<div class="card lt-res ${r.overall}"><div class="lt-res-t"><span class="lt-res-i">${title[0]}</span><h2>${title[1]}</h2></div>
    ${r.items.map((it, i) => html`<div class="lt-item"><div class="lt-item-h"><b>Вопрос ${i + 1}: ${LT_VERDICT[it.verdict][0]} ${LT_VERDICT[it.verdict][1]}</b></div>
      <details ${it.verdict === 'correct' ? '' : raw('open')}><summary>Эталонный ответ</summary><div class="lt-ref">${ltMd(it.reference)}</div></details></div>`)}
    ${r.first ? html`<div class="small muted">Опыт за это прорешивание: <b>${r.xp}</b></div>` : html`<div class="small muted">Это повторное решение — опыт не начисляется.</div>`}
    ${ltButtons(r)}</div>`);
  if (r.overall === 'ok') droneSuccess();
  else if (r.overall === 'partial') droneAway();
  else ltFailVideo(r);
  if (r.overall !== 'fail') $('#lt-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
actions.ltNext = () => {
  ltFailClose();
  const n = S.lt && S.lt.result && S.lt.result.next;
  if (n) location.hash = '#/letuchki/set/' + n.id;
  else { toast('Это была последняя летучка', { icon: '🏁' }); location.hash = '#/letuchki/s/' + S.lt.set.subject_id; }
};
actions.ltRetry = () => { ltFailClose(); router(); };
actions.ltToCourse = () => { ltFailClose(); location.hash = '#/letuchki/s/' + S.lt.set.subject_id; };

/* =============================== «Неверно»: видео на весь экран =============================== */
function ltFailVideo(r) {
  ltFailClose();
  const box = document.createElement('div');
  box.id = 'lt-fail'; box.className = 'lt-fail';
  // видео снято на зелёном фоне: сами кадры рисуем на canvas и «вырезаем» зелёный (хромакей), а звук идёт от скрытого video
  box.innerHTML = `<canvas class="lt-fail-canvas"></canvas><video class="lt-fail-video" src="assets/drone_fail.mp4" playsinline preload="auto"></video><div class="lt-fail-frame"></div>
    <div class="lt-fail-title">НЕВЕРНО</div><div class="lt-fail-btns">${unraw(ltButtons(r))}</div>`;
  document.body.appendChild(box);
  const v = box.querySelector('video');
  v.volume = 0.3;                                          // звук видео оставлен, но тише
  v.muted = !(S.user && S.user.sound);
  ltChroma(box, v);
  v.play().catch(() => { v.muted = true; v.play().catch(() => { /* видео недоступно — остаются надпись и кнопки */ }); });
  droneHide();
}
/** Хромакей: пока играет видео, перерисовываем кадр на canvas, делая зелёные пиксели прозрачными. */
function ltChroma(box, v) {
  const cv = box.querySelector('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  let stop = false;
  const draw = () => {
    if (stop || !box.isConnected) return;
    if (v.videoWidth && !v.paused || v.ended) {
      if (cv.width !== v.videoWidth) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      try {
        const f = ctx.getImageData(0, 0, cv.width, cv.height), d = f.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2], k = g - Math.max(r, b);   // насколько пиксель «зеленее» остальных
          if (k > 70) d[i + 3] = 0;                                              // чистый фон
          else if (k > 25) { d[i + 3] = Math.round(255 * (70 - k) / 45); d[i + 1] = Math.max(r, b); }   // кромка: полупрозрачная, без зелёной каймы
          else if (k > 8) d[i + 1] = Math.max(r, b) + (k >> 1);                  // лёгкий зелёный отсвет на предметах убираем
        }
        ctx.putImageData(f, 0, 0);
      } catch (e) { box.classList.add('raw'); stop = true; return; }          // кадры недоступны (другой домен): показываем видео как есть
    }
    if (v.ended) { stop = true; return; }
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
  };
  v.addEventListener('playing', () => { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw); else requestAnimationFrame(draw); }, { once: true });
  v.addEventListener('ended', () => { stop = false; draw(); }, { once: true });
}
function ltFailClose() { const b = document.getElementById('lt-fail'); if (b) { const v = b.querySelector('video'); if (v) v.pause(); b.remove(); } }

/* =============================== дрон =============================== */
const DR = { layer: null, pos: null, ac: null, anims: [] };
function drCtx() {
  if (!(S.user && S.user.sound)) return null;               // «Звуковые эффекты» выключены в настройках
  try {
    DR.ac = DR.ac || new (window.AudioContext || window.webkitAudioContext)();
    if (DR.ac.state === 'suspended') DR.ac.resume();
    return DR.ac;
  } catch (e) { return null; }
}
/** Гул винтов, пролетающий слева направо (pan: от -1 до 1). Тихий. */
function drBuzz(sec, panFrom, panTo, peak = 0.05) {
  const ac = drCtx(); if (!ac) return;
  const t0 = ac.currentTime, out = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900; out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(peak, t0 + sec * 0.35); out.gain.setValueAtTime(peak, t0 + sec * 0.6); out.gain.exponentialRampToValueAtTime(0.0001, t0 + sec);
  const tremolo = ac.createGain(); tremolo.gain.value = 0.7;
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 34; lfoG.gain.value = 0.3; lfo.connect(lfoG); lfoG.connect(tremolo.gain);
  [96, 143, 191].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.94, t0); o.frequency.linearRampToValueAtTime(f * (1.06 - i * 0.02), t0 + sec); o.connect(tremolo); o.start(t0); o.stop(t0 + sec + 0.1); });
  tremolo.connect(lp); lp.connect(out);
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.setValueAtTime(panFrom, t0); p.pan.linearRampToValueAtTime(panTo, t0 + sec); out.connect(p); p.connect(ac.destination); } else out.connect(ac.destination);
  lfo.start(t0); lfo.stop(t0 + sec + 0.1);
}
/** Взрыв при падении дрона: шум с гаснущим фильтром и низкий удар. Негромкий. */
function drBoom() {
  const ac = drCtx(); if (!ac) return;
  const t0 = ac.currentTime, len = Math.floor(ac.sampleRate * 1.0), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(140, t0 + 0.9);
  const g = ac.createGain(); g.gain.setValueAtTime(0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
  src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(t0);
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.5);
  og.gain.setValueAtTime(0.1, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55); o.connect(og); og.connect(ac.destination); o.start(t0); o.stop(t0 + 0.6);
}
function droneStart() {
  droneStop();
  const layer = document.createElement('div');
  layer.id = 'drone-layer'; layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="drone-pos"><img class="drone-img" src="assets/drone.png" alt="" draggable="false"></div>';
  document.body.appendChild(layer);
  DR.layer = layer; DR.pos = layer.firstChild;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const a = DR.pos.animate([{ transform: 'translateX(-115vw)' }, { transform: 'translateX(0)' }], { duration: reduced ? 1 : 3400, easing: 'cubic-bezier(.22,.6,.3,1)', fill: 'forwards' });
  drBuzz(3.4, -0.9, 0.9, 0.05);
  a.onfinish = () => { if (DR.pos) DR.pos.classList.add('idle'); };
}
function droneStop() {
  ltFailClose();
  if (DR.layer) DR.layer.remove();
  DR.layer = DR.pos = null;
}
function droneHide() { if (DR.layer) DR.layer.remove(); DR.layer = DR.pos = null; }
/** Верно: дрон падает вниз и взрывается. */
function droneSuccess() {
  if (!DR.pos) return;
  const pos = DR.pos, r = pos.getBoundingClientRect(), dy = Math.max(60, innerHeight - r.bottom - 4);
  pos.classList.remove('idle');
  const x = r.left + r.width / 2 - innerWidth * 0.05, y = innerHeight - 8;
  pos.animate([{ transform: 'translate(0,0) rotate(0deg)' }, { transform: `translate(-5vw,${dy}px) rotate(-220deg)` }], { duration: 1000, easing: 'cubic-bezier(.55,0,.9,.55)', fill: 'forwards' }).onfinish = () => {
    droneHide();
    drBoom();
    ltExplosion(x, y);
  };
}
function ltExplosion(x, y) {
  const layer = document.createElement('div'); layer.className = 'lt-boom'; layer.style.left = x + 'px'; layer.style.top = y + 'px';
  layer.innerHTML = '<i class="lt-flash"></i>' + Array.from({ length: 16 }, () => '<b class="lt-spark"></b>').join('');
  document.body.appendChild(layer);
  layer.querySelector('.lt-flash').animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'forwards' });
  layer.querySelectorAll('.lt-spark').forEach((sp, i) => {
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.4, dist = 50 + Math.random() * 90;
    sp.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist - 30}px)) scale(.2)`, opacity: 0 }], { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.1,.7,.4,1)', fill: 'forwards' });
  });
  setTimeout(() => layer.remove(), 1400);
}
/** Частично верно: дрон просто улетает с экрана вправо. */
function droneAway() {
  if (!DR.pos) return;
  const pos = DR.pos; pos.classList.remove('idle');
  drBuzz(1.7, 0.2, 1, 0.04);
  pos.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(120vw,-10vh)' }], { duration: 1700, easing: 'cubic-bezier(.5,0,1,.9)', fill: 'forwards' }).onfinish = droneHide;
}
