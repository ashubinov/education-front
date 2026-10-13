/* LearnQuest — «Питомец»: выбираешь животное, кормишь едой за жетоны, он растёт (малыш → подросток → взрослый).
   Всё считает сервер (/api/pet/*): сытость падает со временем, любимая еда даёт больше роста. Питомец не умирает — если забросить, просто грустит.
   К друзьям можно «зайти погулять»: погулять с их питомцем (раз в день, +жетоны). Графика — pet-art.js. */
'use strict';

const PET = { st: null, busy: false, pick: 'corgi' };
const PET_STAGE_ICON = ['🥚', '🌱', '👑'];
const PET_MOOD_ICON = { happy: '😊', ok: '🙂', hungry: '😟', starving: '😭' };
const PET_DECAY = 4.2; // сытости в час — как на сервере, только для плавной полоски между опросами

Object.assign(SFX, {
  petEat: () => tone([330, 392, 330, 440], .06, 'triangle', .06),
  petBuy: () => tone([440, 587], .05, 'square', .04),
  petGrow: () => tone([392, 523, 659, 784, 1046], .09, 'triangle', .07),
  petPat: () => tone([587, 740, 880], .06, 'sine', .06),
});

const petStageI = p => p.stage_index ?? 0;
function petBars(p) {
  const hunger = Math.round(p.fullness);
  const hasNext = p.xp_next != null;
  const pct = hasNext ? Math.min(100, Math.round((p.xp - p.xp_from) / (p.xp_next - p.xp_from) * 100)) : 100;
  return html`<div class="pet-bars">
    <div class="pet-bar"><span>🍖 Сытость</span><div class="bar thin"><i class="pet-fill ${p.mood}" style="width:${hunger}%"></i></div><b>${hunger}%</b></div>
    <div class="pet-bar"><span>${PET_STAGE_ICON[petStageI(p)]} Рост</span><div class="bar thin"><i style="width:${pct}%"></i></div><b>${hasNext ? p.xp - p.xp_from + ' / ' + (p.xp_next - p.xp_from) : 'макс.'}</b></div>
  </div>`;
}

route(/^#\/pet$/, async () => { await drawPet(); });

async function drawPet(keepScroll) {
  if (!keepScroll) render(app(), shell('pet', html`<div class="center muted mt-l"><span class="spinner"></span></div>`));
  PET.st = await api('/pet');
  S.balance = PET.st.balance;
  paintPet();
  every(async () => { try { const s = await api('/pet'); PET.st = s; S.balance = s.balance; paintPetLive(); } catch (e) { /* связь пропала — не страшно */ } }, 60000);
}

function paintPet() {
  const s = PET.st, y = window.scrollY;
  render(app(), shell('pet', s.pet ? petMain(s) : petAdopt(s)));
  window.scrollTo(0, y);
}
function paintPetLive() { // тихо обновить цифры без перерисовки всей страницы
  const s = PET.st; if (!s.pet || !$('#petBars')) return paintPet();
  $('#petBars').innerHTML = unraw(petBars(s.pet)); const m = $('#petMood'); if (m) m.textContent = PET_MOOD_ICON[s.pet.mood] + ' ' + s.pet.mood_name;
  const b = $('#petBal'); if (b) b.textContent = slFmt(s.balance);
  const art = $('#petArt'); if (art && art.dataset.mood !== s.pet.mood) { art.innerHTML = petSvg(s.pet.species, petStageI(s.pet), s.pet.mood); art.dataset.mood = s.pet.mood; }
}

/* ---------- выбор питомца ---------- */
function petAdopt(s) {
  const cur = PET.pick;
  return html`<div class="pet-page">
    <div class="pet-top"><div><h2>🐾 Питомец</h2><p class="muted small" style="margin:0">Выбери себе друга. Корми его вкусняшками за жетоны — и он вырастет!</p></div>
      <div class="px-bal" title="Общие жетоны">🪙 <b id="petBal">${slFmt(s.balance)}</b></div></div>
    <div class="pet-choose">${s.species.map(sp => html`<button class="pet-card ${sp.id === cur ? 'on' : ''}" data-act="petPick" data-id="${sp.id}">
        <div class="pet-card-art">${raw(petSvg(sp.id, 1, 'happy'))}</div><b>${sp.name}</b><span class="muted small">${sp.desc}</span></button>`)}</div>
    <div class="card pet-name-card">
      <label class="small muted" for="petNameIn">Как назовёшь?</label>
      <div class="row gap-s wrap"><input id="petNameIn" class="grow" maxlength="${s.name_max}" placeholder="Например, Бублик" autocomplete="off">
        <button class="btn" data-act="petAdopt">Забрать домой</button></div>
      <p class="muted small" style="margin:6px 0 0">Подарим 3 порции любимой еды. Питомец не умирает — если забыть покормить, он просто загрустит.</p></div>
  </div>`;
}
actions.petPick = b => { PET.pick = b.dataset.id; $$('.pet-card').forEach(c => c.classList.toggle('on', c === b)); play('tap'); };
actions.petAdopt = async b => {
  const name = $('#petNameIn').value.trim();
  if (!name) { toast('Придумай имя питомцу', { icon: '✏️' }); $('#petNameIn').focus(); return; }
  b.disabled = true;
  try { PET.st = await api('/pet/adopt', { json: { species: PET.pick, name } }); S.balance = PET.st.balance; play('petGrow'); confetti(90); paintPet(); }
  catch (e) { toast(e.message, { icon: '⚠️' }); b.disabled = false; }
};

/* ---------- главный экран ---------- */
function petMain(s) {
  const p = s.pet, inv = s.inventory, full = p.fullness > s.can_eat_below;
  const foods = [...s.foods].sort((a, b) => (b.liked - a.liked) || (a.price - b.price));
  return html`<div class="pet-page">
    <div class="pet-top"><div><h2>🐾 Питомец</h2><p class="muted small" style="margin:0">Кормить можно, пока сытость ниже ${s.can_eat_below}%. Любимая еда (⭐) даёт на 50% больше роста.</p></div>
      <div class="px-bal" title="Общие жетоны">🪙 <b id="petBal">${slFmt(s.balance)}</b></div></div>
    <div class="pet-grid">
      <div class="card pet-stage-card">
        <div class="pet-scene s${petStageI(p)}"><div class="pet-art" id="petArt" data-mood="${p.mood}">${raw(petSvg(p.species, petStageI(p), p.mood))}</div></div>
        <div class="pet-info"><h3 style="margin:0">${p.name} <span class="muted small">· ${p.species_name}</span></h3>
          <div class="row gap-s wrap mt-s"><span class="chip accent">${PET_STAGE_ICON[petStageI(p)]} ${p.stage_name}</span><span class="chip" id="petMood">${PET_MOOD_ICON[p.mood]} ${p.mood_name}</span>
            ${p.age_days ? html`<span class="chip">🎂 ${p.age_days} ${plural(p.age_days, 'день', 'дня', 'дней')}</span>` : ''}</div>
          <div id="petBars">${petBars(p)}</div>
          <p class="muted small" style="margin:6px 0 0">Накормлен ${p.fed_total} ${plural(p.fed_total, 'раз', 'раза', 'раз')} · друзья гуляли с ним ${p.pats_total} ${plural(p.pats_total, 'раз', 'раза', 'раз')}${p.next_stage ? ` · дальше: ${p.next_stage}` : ''}</p>
          <div class="row gap-s mt"><a class="btn sm" href="#/pet/pvp" title="Бои с настоящими игроками">⚔️ Live PvP</a><a class="btn ghost sm" href="#/pet/arena" title="Бои с ботами">Тренировка</a><button class="btn ghost sm" data-act="petRename">✏️ Имя</button><button class="btn ghost sm" data-act="petRelease">👋 Отпустить</button></div></div>
      </div>
      <div class="pet-shop">
        <h3 style="margin:0 0 8px">🍽 Еда</h3>
        <div class="pet-foods">${foods.map(f => { const have = inv[f.id] || 0; return html`<div class="pet-food ${f.liked ? 'liked' : ''}">
            ${f.liked ? html`<i class="pet-star" title="Любимая еда">⭐</i>` : ''}${have ? html`<i class="pet-have" title="В запасе">×${have}</i>` : ''}
            <div class="pet-food-ic">${f.icon}</div><b>${f.name}</b>
            <span class="muted small">+${f.fill} сытости · +${Math.round(f.xp * (f.liked ? 1.5 : 1))} роста</span>
            <div class="pet-food-act">
              <button class="btn sm ${have ? '' : 'ghost'}" data-act="petFeed" data-id="${f.id}" ${have && !full ? '' : 'disabled'}>Дать</button>
              <button class="btn sm ghost" data-act="petBuy" data-id="${f.id}" data-qty="1" title="Купить 1">🪙 ${f.price}</button>
              <button class="btn sm ghost" data-act="petBuy" data-id="${f.id}" data-qty="5" title="Купить 5">×5</button></div></div>`; })}</div>
        ${full ? html`<p class="muted small mt-s">${p.name} сыт — подожди немного, а пока можно закупиться на будущее.</p>` : ''}
      </div>
    </div>
  </div>`;
}

actions.petFeed = async b => {
  if (PET.busy) return; PET.busy = true;
  try {
    const r = await api('/pet/feed', { json: { food_id: b.dataset.id } });
    const food = r.foods.find(f => f.id === b.dataset.id);
    PET.st = r; paintPet(); play(r.fed.grew ? 'petGrow' : 'petEat'); petEatFx(food.icon, r.fed);
    if (r.fed.grew) { confetti(140); toast(`${r.pet.name} вырос: теперь ${r.pet.stage_name.toLowerCase()}!`, { icon: '🎉', title: 'Новая стадия' }); }
  } catch (e) { toast(e.message, { icon: '⚠️' }); }
  PET.busy = false;
};
function petEatFx(icon, fed) {
  const art = $('#petArt'); if (!art) return;
  art.classList.add('eating'); setTimeout(() => art.classList.remove('eating'), 900);
  const f = document.createElement('div'); f.className = 'pet-fly'; f.textContent = icon; art.appendChild(f); setTimeout(() => f.remove(), 900);
  const g = document.createElement('div'); g.className = 'pet-gain'; g.textContent = `+${fed.gain} роста${fed.liked ? ' ⭐' : ''}`; art.appendChild(g); setTimeout(() => g.remove(), 1400);
}
actions.petBuy = async b => {
  if (PET.busy) return; PET.busy = true;
  try {
    const r = await api('/pet/buy', { json: { food_id: b.dataset.id, qty: +b.dataset.qty } });
    PET.st.balance = r.balance; PET.st.inventory = r.inventory; S.balance = r.balance; play('petBuy'); paintPet();
  } catch (e) { toast(e.message, { icon: '🪙' }); }
  PET.busy = false;
};
actions.petRename = () => {
  const p = PET.st.pet;
  openModal(html`<h2>Новое имя</h2><input id="petRenIn" maxlength="${PET.st.name_max}" value="${p.name}" autocomplete="off">
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" data-act="closeModal">Отмена</button><button class="btn" data-act="petRenameOk">Сохранить</button></div>`);
  const i = $('#petRenIn'); i.focus(); i.select(); i.addEventListener('keydown', e => { if (e.key === 'Enter') actions.petRenameOk(); });
};
actions.petRenameOk = async () => {
  const name = $('#petRenIn').value.trim(); if (!name) return;
  try { PET.st = await api('/pet/rename', { json: { name } }); closeModal(); paintPet(); } catch (e) { toast(e.message, { icon: '⚠️' }); }
};
actions.petRelease = async () => {
  const p = PET.st.pet;
  if (!await askConfirm(`Отпустить ${p.name}?`, 'Питомец уйдёт на волю, а рост пропадёт. Запас еды останется — можно взять нового.', 'Отпустить', 'Оставить', true)) return;
  try { PET.st = await api('/pet/release', { method: 'POST' }); paintPet(); } catch (e) { toast(e.message, { icon: '⚠️' }); }
};

/* ---------- в гостях у друга ---------- */
function petFriendCard(pet, ownerId, ownerName) {
  if (!pet) return html`<p class="muted small" style="margin:0">У ${ownerName} пока нет питомца.</p>`;
  const mi = PET_MOOD_ICON[pet.mood];
  return html`<div class="pet-guest">
    <div class="pet-scene mini s${petStageI(pet)}"><div class="pet-art" id="petGuestArt">${raw(petSvg(pet.species, petStageI(pet), pet.mood))}</div></div>
    <div class="grow"><b>${pet.name}</b> <span class="muted small">· ${pet.species_name}</span>
      <div class="row gap-s wrap mt-s"><span class="chip accent">${PET_STAGE_ICON[petStageI(pet)]} ${pet.stage_name}</span><span class="chip">${mi} ${pet.mood_name}</span></div>
      <p class="muted small" style="margin:6px 0 8px">Сегодня гуляли: ${pet.pats_today} ${plural(pet.pats_today, 'раз', 'раза', 'раз')}</p>
      <button class="btn sm" id="petPatBtn" data-act="petPat" data-id="${ownerId}" ${pet.patted_by_me ? 'disabled' : ''}>${pet.patted_by_me ? 'Сегодня уже гуляли' : '🐾 Погулять · +' + PET_PAT_REWARD + ' 🪙'}</button></div></div>`;
}
const PET_PAT_REWARD = 3;
actions.petPat = async b => {
  b.disabled = true;
  try {
    const r = await api('/pet/pat/' + b.dataset.id, { method: 'POST' });
    play('petPat'); b.textContent = 'Сегодня уже гуляли';
    const art = $('#petGuestArt'); if (art) { art.classList.add('eating'); setTimeout(() => art.classList.remove('eating'), 900); const h = document.createElement('div'); h.className = 'pet-gain'; h.textContent = '❤️'; art.appendChild(h); setTimeout(() => h.remove(), 1400); }
    toast(`Ты погулял с ${r.pet.name}. +${r.reward} жетона`, { icon: '🐾' });
  } catch (e) { toast(e.message, { icon: '⚠️' }); if (!/ушё?л|уже гулял/.test(e.message)) b.disabled = false; }
};
