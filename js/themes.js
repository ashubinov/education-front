/* LearnQuest — темы оформления: галерея палитр, свои темы, тема по описанию (ИИ), падающие эмодзи.
   Тема = 6 цветов (фон, карточки, текст, главный, «верно», «ошибка»): остальные оттенки (границы, приглушённый текст, тени кнопок,
   заливки) считаются из них здесь же, поэтому любые 6 цветов дают цельный интерфейс.
   Готовые палитры лежат в этом файле, свои темы — на сервере (server/themes.py); выбранная своя тема приходит в /me как theme_custom. */
'use strict';

/* ---------- готовые темы: несколько простых, остальное каждый делает сам по описанию ---------- */
const PALETTES = [
  { id: 'ocean', name: 'Океан', mode: 'dark', logo: '🌊', decor: ['🐠', '🐚', '💧'], colors: { bg: '#06141f', card: '#0c2233', ink: '#e6f4fb', accent: '#22c3e6', ok: '#3ee0a8', bad: '#ff6b7a' } },
  { id: 'space', name: 'Космос', mode: 'dark', logo: '🚀', decor: ['⭐', '🪐', '🌙', '☄️'], colors: { bg: '#070914', card: '#10142a', ink: '#eaeefc', accent: '#8b7bff', ok: '#4de3b6', bad: '#ff6384' } },
  { id: 'mint', name: 'Мята', mode: 'light', logo: '🌿', decor: ['🌿', '🍃'], colors: { bg: '#eaf7f2', card: '#ffffff', ink: '#15332b', accent: '#0f9d7a', ok: '#2d8a3e', bad: '#d1394a' } },
  { id: 'bloom', name: 'Цветение', mode: 'light', logo: '🌸', decor: ['🌸', '🌷', '🍡'], colors: { bg: '#fdf0f4', card: '#ffffff', ink: '#3a1f2b', accent: '#d6336c', ok: '#2f9e6a', bad: '#c0273f' } },
];
const PALETTE_BY_ID = Object.fromEntries(PALETTES.map(p => [p.id, p]));
const isPalettePreset = id => !!PALETTE_BY_ID[id];
const THEME_EXAMPLES = ['тёмная с мятным акцентом', 'светлая и спокойная', 'тёплые осенние цвета', 'холодный минимализм', 'как в терминале', 'ночной город'];

/* ---------- цвета ---------- */
const _rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const _hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
function mixHex(a, b, t) { const [r1, g1, b1] = _rgb(a), [r2, g2, b2] = _rgb(b); return _hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t); }
function rgbaHex(h, a) { const [r, g, b] = _rgb(h); return `rgba(${r}, ${g}, ${b}, ${a})`; }
function contrastHex(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function onColor(bg) { return contrastHex(bg, '#ffffff') >= contrastHex(bg, '#1b1b1b') ? '#ffffff' : '#1b1b1b'; }
/** Тёмная или светлая: по тому, с чем фон контрастнее (так же определяет сервер). */
const modeOf = bg => contrastHex(bg, '#ffffff') >= contrastHex(bg, '#000000') ? 'dark' : 'light';

/** Все токены сайта из шести цветов. */
function paletteVars(p) {
  const c = p.colors, dark = p.mode === 'dark', shade = x => mixHex(x, '#000000', dark ? .32 : .38), warn = dark ? '#ffc233' : '#b87a00';
  return {
    '--bg': c.bg, '--bg2': c.card, '--bg3': mixHex(c.card, c.ink, .07), '--line': mixHex(c.card, c.ink, dark ? .18 : .14),
    '--text': c.ink, '--muted': mixHex(c.ink, c.bg, dark ? .38 : .42),
    '--accent': c.accent, '--accent-d': shade(c.accent), '--accent-l': rgbaHex(c.accent, .16), '--accent-ink': onColor(c.accent),
    '--good': c.ok, '--good-d': shade(c.ok), '--good-l': rgbaHex(c.ok, .14),
    '--bad': c.bad, '--bad-d': shade(c.bad), '--bad-l': rgbaHex(c.bad, .14),
    '--warn': warn, '--warn-l': rgbaHex(warn, .14),
    '--g0': mixHex(c.card, c.ink, .1), '--g1': mixHex(c.card, c.ok, .3), '--g2': mixHex(c.card, c.ok, .55), '--g3': mixHex(c.card, c.ok, .8), '--g4': c.ok,
  };
}
const PALETTE_VARS = Object.keys(paletteVars(PALETTES[0]));

/** Какая палитра сейчас должна быть на сайте: предпросмотр → своя выбранная тема → готовая → никакой (обычное оформление). */
function currentPalette(extra) {
  if (S.themePreview) return S.themePreview;
  const cu = S.user && S.user.theme_custom;
  if (extra.custom && cu && cu.id === extra.custom) return cu;
  return PALETTE_BY_ID[extra.preset] || null;
}
function applyPalette(p, extra) {
  const de = document.documentElement, root = de.style;
  de.dataset.theme = p.mode === 'dark' ? 'dark' : 'light';
  Object.entries(paletteVars(p)).forEach(([k, v]) => root.setProperty(k, v));
  de.dataset.bg = 'glow'; de.dataset.radius = extra.radius; de.dataset.motion = extra.motion; de.dataset.palette = p.id || 'custom';
  setThemeLogo(p.logo); setDecor(p.decor, extra.motion !== 'reduced');
  const m = $('meta[name=theme-color]'); if (m) m.content = p.colors.bg;
}
function clearPalette() {
  const de = document.documentElement; if (!de.dataset.palette) return;
  PALETTE_VARS.forEach(v => de.style.removeProperty(v)); delete de.dataset.palette;
  setThemeLogo(''); setDecor(null, false);
}
function setThemeLogo(logo) {
  S.themeLogo = logo || '';
  const el = $('.logo span:first-child'); if (el) el.textContent = themeLogo();
}

/* ---------- падающие эмодзи на фоне ---------- */
function setDecor(list, on) {
  let el = $('#decor');
  if (!list || !list.length || !on || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (el) el.remove(); return; }
  const key = list.join('|');
  if (el && el.dataset.key === key) return;   // тот же набор — не перезапускаем анимацию
  if (!el) { el = document.createElement('div'); el.id = 'decor'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
  el.dataset.key = key;
  el.innerHTML = Array.from({ length: 14 }, (_, i) => {
    const r = Math.random;
    return `<span style="left:${(i * 100 / 14 + r() * 5).toFixed(1)}%;font-size:${(16 + r() * 16).toFixed(0)}px;animation-duration:${(22 + r() * 18).toFixed(1)}s;animation-delay:${(-r() * 30).toFixed(1)}s;--dx:${((r() - .5) * 160).toFixed(0)}px;--rot:${((r() - .5) * 540).toFixed(0)}deg">${esc(list[i % list.length])}</span>`;
  }).join('');
}


/* ---------- настройки: блок «Темы» ---------- */
function tcard(p, on, act, extra) {
  const c = p.colors;
  return html`<div class="tcard-w"><button class="tcard ${on ? 'on' : ''}" data-act="${act}" data-id="${p.id}" aria-pressed="${on ? 'true' : 'false'}" style="--t-bg:${c.bg};--t-card:${c.card};--t-ink:${c.ink};--t-acc:${c.accent};--t-ok:${c.ok};--t-bad:${c.bad}">
    <span class="tprev"><i></i><b></b><em></em><u></u></span><span class="tname"><span>${p.logo}</span><span class="tn">${p.name}</span></span></button>${extra || ''}</div>`;
}

const themesFull = () => !!S.myThemes && S.myThemes.items.length >= S.myThemes.max;

function themeAiPanel() {
  const left = S.myThemes && S.myThemes.gen_left, full = themesFull();
  return html`<div class="field"><label>✨ Тема по описанию</label><div class="tai card flat">
    <div class="small muted">Опиши настроение, место или стиль, и ИИ подберёт цвета, значок и падающие эмодзи. Тема сразу применится к сайту как предпросмотр: понравится — оставишь, нет — попробуешь другой вариант.</div>
    ${full ? html`<div class="small muted mt-s">Сохранено ${S.myThemes.max} тем из ${S.myThemes.max}: чтобы оставить новую, удали одну из своих.</div>` : ''}
    <div class="row wrap gap-s mt"><input type="text" id="themeprompt" maxlength="200" value="${S.themePrompt || ''}" placeholder="например: тёмная с мятным акцентом" style="flex:1;min-width:200px"><button class="btn" data-act="themeGen">✨ Придумать</button></div>
    <div class="row wrap gap-s mt">${THEME_EXAMPLES.map(x => html`<button class="chip tex" data-act="themeEx" data-v="${x}">${x}</button>`)}</div>
    ${left ? html`<div class="small muted mt">Попыток осталось: ${left.hour} в этот час, ${left.day} сегодня</div>` : ''}</div></div>`;
}

function themeDraftHtml(d) {
  const c = d.colors;
  return html`<div class="field" id="tdraft"><label>✨ Вот что получилось</label><div class="tedit card flat">
    <div class="row gap-s"><span class="tbig">${d.logo}</span><div class="grow"><b>${d.name}</b><div class="small muted">${d.mode === 'dark' ? '🌙 тёмная' : '☀️ светлая'}${d.decor.length ? ' · ' + d.decor.join(' ') : ''}</div></div>
      <span class="tsw">${['bg', 'card', 'accent', 'ok', 'bad'].map(k => html`<i style="background:${c[k]}"></i>`)}</span></div>
    <p class="small muted mt">Тема уже применена ко всему сайту: это предпросмотр. Если не нажать «Оставить», она пропадёт.${themesFull() ? ' Место закончилось: удали одну из сохранённых тем.' : ''}</p>
    <div class="row wrap gap-s"><button class="btn" data-act="themeSave" ${themesFull() ? 'disabled' : ''}>✅ Оставить</button><button class="btn ghost" data-act="themeAgain">🔄 Другой вариант</button><button class="btn ghost" data-act="themeCancel">Отмена</button></div></div></div>`;
}

function themeArea() {
  const ex = (S.user && S.user.theme_extra) || THEME_DEFAULT, mine = (S.myThemes && S.myThemes.items) || [], max = (S.myThemes && S.myThemes.max) || 6;
  const palActive = !!ex.custom || isPalettePreset(ex.preset);
  return html`<div class="field"><label>Темы</label><div class="theme-grid">${PALETTES.map(p => tcard(p, !ex.custom && ex.preset === p.id, 'themePick'))}</div></div>
    ${mine.length ? html`<div class="field"><label>Мои темы · ${mine.length} из ${max}</label><div class="theme-grid">${mine.map(t => tcard(t, ex.custom === t.id, 'themeUse', html`<button class="tedit-btn" data-act="themeDelete" data-id="${t.id}" title="Удалить" aria-label="Удалить тему «${t.name}»">🗑</button>`))}</div></div>` : ''}
    ${themeAiPanel()}${S.themeDraft ? themeDraftHtml(S.themeDraft) : ''}
    ${palActive ? html`<div class="field"><button class="btn sm ghost" data-act="themeOff">↺ Вернуться к обычной теме</button><div class="small muted mt-s">Вернётся выбор простого цвета, светлой или тёмной темы и фона.</div></div>` : ''}`;
}
function drawThemeArea() {
  const el = $('#themearea'); if (!el) return;
  render(el, themeArea());
  const lg = $('#legacy-theme'); if (lg) lg.hidden = themePaletteActive();   // у темы с палитрой цвет, режим и фон задаёт она сама
}
async function loadThemeArea() {
  try { S.myThemes = await api('/themes'); } catch (e) { S.myThemes = S.myThemes || { items: [], max: 6, gen_left: null }; }
  drawThemeArea();
}

/* предпросмотр: тема применяется ко всему сайту, пока игрок её не оставит или не откажется */
function previewDraft() { S.themeDraft.mode = modeOf(S.themeDraft.colors.bg); S.themePreview = S.themeDraft; applyTheme(S.user.theme_color, S.user.theme_mode); }
function endPreview() { S.themeDraft = null; S.themePreview = null; applyTheme(S.user.theme_color, S.user.theme_mode); }
window.addEventListener('hashchange', () => { if (S.themePreview && !/^#\/settings/.test(location.hash)) endPreview(); });

/* ---------- действия ---------- */
const themeExtraWith = patch => ({ ...(S.user.theme_extra || THEME_DEFAULT), ...patch });
actions.themePick = async b => { S.themeDraft = S.themePreview = null; await saveMe({ theme_extra: themeExtraWith({ preset: b.dataset.id, custom: null }) }, true); drawThemeArea(); };
actions.themeUse = async b => { S.themeDraft = S.themePreview = null; await saveMe({ theme_extra: themeExtraWith({ preset: '', custom: Number(b.dataset.id) }) }, true); drawThemeArea(); };
actions.themeOff = async () => { S.themeDraft = S.themePreview = null; await saveMe({ theme_extra: themeExtraWith({ preset: '', custom: null }) }, true); drawThemeArea(); };
actions.themeEx = b => { const i = $('#themeprompt'); i.value = S.themePrompt = b.dataset.v; i.focus(); };
actions.themeCancel = () => { endPreview(); drawThemeArea(); };

async function themeGenerate(prompt, btn) {
  busy(btn, true, 'Придумываю…');
  try {
    const r = await api('/themes/generate', { json: { prompt } });
    if (S.myThemes) S.myThemes.gen_left = r.gen_left;
    S.themeDraft = { source: 'ai', prompt, ...r.theme };
    previewDraft(); drawThemeArea();
    const e = $('#tdraft'); if (e) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) { busy(btn, false); toast(e.message, { icon: '⚠️' }); }
}
actions.themeGen = b => {
  const p = $('#themeprompt').value.trim(); S.themePrompt = p;
  if (p.length < 3) return toast('Опиши тему хотя бы парой слов', { icon: '✍️' });
  themeGenerate(p, b);
};
actions.themeAgain = b => themeGenerate(S.themeDraft.prompt, b);

/** «Оставить»: тема добавляется в список (до max штук), прежние сохранённые остаются. */
actions.themeSave = async b => {
  const d = S.themeDraft; if (!d) return;
  if (themesFull()) return toast(`Уже сохранено ${S.myThemes.max} тем: удали одну из них`, { icon: '⚠️' });
  const body = { name: d.name, colors: d.colors, logo: d.logo, decor: d.decor };
  busy(b, true);
  try {
    const item = await api('/themes', { json: body });
    S.themeDraft = S.themePreview = null;
    await saveMe({ theme_extra: themeExtraWith({ preset: '', custom: item.id }) }, true);
    try { S.myThemes = await api('/themes'); } catch (e) { /* список обновится при следующем заходе */ }
    toast('Тема сохранена и применена', { icon: '🎨' });
    drawThemeArea();
  } catch (e) { busy(b, false); toast(e.message, { icon: '⚠️' }); }
};
actions.themeDelete = async b => {
  const id = Number(b.dataset.id), t = S.myThemes && S.myThemes.items.find(x => x.id === id); if (!t) return;
  if (!await askConfirm('Удалить тему?', `Тема «${t.name}» будет удалена без возможности вернуть.`, 'Удалить', 'Отмена', true)) return;
  try {
    await api('/themes/' + t.id, { method: 'DELETE' });
    await refreshMe(); applyTheme(S.user.theme_color, S.user.theme_mode);   // если удалена активная — сервер её сбросил
    S.myThemes = await api('/themes'); drawThemeArea(); toast('Тема удалена', { icon: '🗑', ms: 1600 });
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
};

/* ---------- старые настройки цвета (Настройки → Внешний вид) заменяют тему с палитрой ---------- */
const themePaletteActive = () => { const ex = (S.user && S.user.theme_extra) || {}; return !!ex.custom || isPalettePreset(ex.preset); };
function legacyExtra(patch) { S.themeDraft = S.themePreview = null; return themeExtraWith({ ...patch, custom: null }); }
