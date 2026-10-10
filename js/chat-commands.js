/* LearnQuest — команды общего чата.
   Текст команды только выбирает РАЗРЕШЁННОЕ серверное действие.
   Никакие произвольные URL, JavaScript и сторонние API из команд не вызываются. */
'use strict';

const CHAT_COMMANDS = { open: false, modal: null, ticker: null, refresh: null,
  rows: [], fetchedAt: 0, busy: false, pending: new Map(), editId: null };

function chatCommandsMount(generation) {
  const header = document.querySelector('.lq-chat-heading');
  if (!header || header.querySelector('.lq-chat-cmd-open')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lq-chat-cmd-open';
  button.textContent = '⌘ Команды';
  button.title = 'Список команд общего чата';
  button.setAttribute('aria-label', 'Открыть список команд');
  button.addEventListener('click', () => chatCommandsOpen(generation));
  header.insertBefore(button, document.querySelector('#chatStatus'));
}

function chatCommandDuration(n) {
  n = Math.max(0, Math.ceil(n));
  if (n >= 3600) return `${Math.floor(n / 3600)} ч ${Math.floor((n % 3600) / 60)} мин`;
  if (n >= 60) return `${Math.floor(n / 60)} мин ${n % 60} сек`;
  return `${n} сек`;
}

function chatCommandsLeft(c) {
  return Math.max(0, c.remaining_seconds - Math.floor((Date.now() - CHAT_COMMANDS.fetchedAt) / 1000));
}

async function chatCommandsOpen(generation) {
  if (!chatIsCurrent(generation)) return;
  const modal = openModal(html`<div class="lq-chat-cmd-content">
    <div class="lq-chat-cmd-title"><h2>⌘ Команды чата</h2><button type="button" class="icon-btn" id="cmdClose" aria-label="Закрыть">✕</button></div>
    <p class="small muted">Нажми «Использовать» или введи команду в чат. Таймаут персональный: после использования он действует только для тебя.</p>
    <div id="cmdList" class="lq-chat-cmd-list" aria-live="polite"><div class="small muted">Загрузка…</div></div>
    <section id="cmdAdmin" class="lq-chat-cmd-admin" hidden>
      <h3 id="cmdFormTitle">Создать команду <span class="small muted">(администратор)</span></h3>
      <form id="cmdCreateForm" class="lq-chat-cmd-form">
        <label>Текст команды <input name="command" type="text" maxlength="33" placeholder="/кость" required></label>
        <label>Что происходит <input name="description" type="text" maxlength="200" placeholder="Получить жетоны для слотов" required></label>
        <label>Действие <select name="action"><option value="add_chips">Добавить монетки (жетоны слотов)</option></select></label>
        <label>Количество монеток <input name="amount" type="number" min="1" max="10000" step="1" value="50" required></label>
        <div class="lq-chat-cmd-cooldown">
          <label>Время мута <input name="cooldown_value" type="number" min="1" max="2592000" step="1" value="1" required></label>
          <label>Единицы <select name="cooldown_unit"><option value="seconds">секунды</option><option value="minutes">минуты</option><option value="hours" selected>часы</option></select></label>
        </div>
        <div id="cmdCreateError" class="err" role="alert"></div>
        <div class="row gap-s"><button class="btn sm" id="cmdCreateBtn" type="submit">Создать команду</button><button class="btn sm ghost hidden" id="cmdCancelEdit" type="button">Отмена</button></div>
      </form>
    </section>
  </div>`, { onClose: chatCommandsClose });
  modal.classList.add('lq-chat-cmd-modal');
  CHAT_COMMANDS.open = true; CHAT_COMMANDS.modal = modal;
  modal.querySelector('#cmdClose').onclick = closeModal;
  modal.querySelector('#cmdCreateForm').addEventListener('submit', chatCommandsCreate);
  modal.querySelector('#cmdCancelEdit').onclick = () => chatCommandsEditStop();
  await chatCommandsFetch();
  if (!CHAT_COMMANDS.open) return;
  CHAT_COMMANDS.ticker = setInterval(chatCommandsTick, 1000);
  CHAT_COMMANDS.refresh = setInterval(() => {
    if (CHAT_COMMANDS.open && !document.hidden) chatCommandsFetch();
  }, 12000);
}

function chatCommandsClose() {
  CHAT_COMMANDS.open = false; CHAT_COMMANDS.editId = null;
  CHAT_COMMANDS.modal = null;
  clearInterval(CHAT_COMMANDS.ticker); CHAT_COMMANDS.ticker = null;
  clearInterval(CHAT_COMMANDS.refresh); CHAT_COMMANDS.refresh = null;
}

async function chatCommandsFetch() {
  if (!CHAT_COMMANDS.open) return;
  try {
    const data = await api('/chat/commands');
    if (!CHAT_COMMANDS.open || !CHAT_COMMANDS.modal?.isConnected) return;
    CHAT_COMMANDS.rows = data.commands;
    CHAT_COMMANDS.fetchedAt = Date.now();
    CHAT_COMMANDS.modal.querySelector('#cmdAdmin').hidden = !data.is_admin;
    chatCommandsRender();
  } catch (e) {
    if (!CHAT_COMMANDS.open) return;
    const list = CHAT_COMMANDS.modal.querySelector('#cmdList');
    if (list) list.textContent = 'Не удалось загрузить команды: ' + e.message;
  }
}

function chatCommandsRender() {
  const list = CHAT_COMMANDS.modal?.querySelector('#cmdList');
  if (!list) return;
  list.replaceChildren();
  const rows = CHAT_COMMANDS.rows;
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'small muted'; empty.textContent = 'Команды пока не созданы.';
    list.append(empty); return;
  }
  for (const c of rows) {
    const row = document.createElement('div');
    row.className = 'lq-chat-cmd-row' + (c.enabled ? '' : ' off');
    const info = document.createElement('div');
    info.className = 'lq-chat-cmd-info';
    const title = document.createElement('b');
    title.textContent = c.command;
    const desc = document.createElement('span');
    desc.textContent = c.description;
    const amount = document.createElement('span');
    amount.className = 'lq-chat-cmd-detail';
    amount.textContent = `+${c.amount.toLocaleString('ru-RU')} 🪙 · пауза ${chatCommandDuration(c.cooldown_seconds)}`;
    info.append(title, desc, amount);
    const controls = document.createElement('div');
    controls.className = 'lq-chat-cmd-controls';
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'btn sm'; go.dataset.cmd = c.command;
    go.onclick = () => chatCommandExecute(c.command, null);
    const mute = document.createElement('span');
    mute.className = 'lq-chat-cmd-muted'; mute.dataset.cooldownFor = c.command;
    controls.append(go, mute);
    if (CHAT_COMMANDS.modal.querySelector('#cmdAdmin')?.hidden === false) {
      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.className = 'lq-chat-cmd-toggle';
      toggle.textContent = c.enabled ? 'Отключить' : 'Включить';
      toggle.onclick = async () => {
        toggle.disabled = true;
        try {
          await api(`/chat/commands/${c.id}/enabled?enabled=${!c.enabled}`, { method: 'POST' });
          await chatCommandsFetch();
        } catch (e) { toast(e.message, {icon: '⚠️'}); toggle.disabled = false; }
      };
      controls.append(toggle);
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'lq-chat-cmd-toggle'; edit.textContent = 'Изменить';
      edit.onclick = () => chatCommandsEditStart(c);
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'lq-chat-cmd-toggle lq-chat-cmd-del'; del.textContent = 'Удалить';
      del.onclick = async () => {
        if (!del.dataset.sure) {  // двойное нажатие: первое просит подтверждения, второе удаляет
          del.dataset.sure = '1'; del.textContent = 'Точно?';
          setTimeout(() => { if (del.isConnected) { delete del.dataset.sure; del.textContent = 'Удалить'; } }, 3000);
          return;
        }
        del.disabled = true;
        try {
          await api(`/chat/commands/${c.id}`, { method: 'DELETE' });
          if (CHAT_COMMANDS.editId === c.id) chatCommandsEditStop();
          toast('Команда удалена', { icon: '🗑', ms: 1600 });
          await chatCommandsFetch();
        } catch (e) { toast(e.message, { icon: '⚠️' }); del.disabled = false; }
      };
      controls.append(edit, del);
    }
    row.append(info, controls);
    list.append(row);
  }
  chatCommandsTick();
}

function chatCommandsTick() {
  const modal = CHAT_COMMANDS.modal;
  if (!CHAT_COMMANDS.open || !modal?.isConnected) return;
  for (const c of CHAT_COMMANDS.rows) {
    const row = [...modal.querySelectorAll('.lq-chat-cmd-row')]
      .find(el => el.querySelector('button[data-cmd]')?.dataset.cmd === c.command);
    if (!row) continue;
    const button = row.querySelector('button[data-cmd]');
    const badge = row.querySelector('.lq-chat-cmd-muted');
    const left = chatCommandsLeft(c);
    button.disabled = !c.enabled || left > 0 || CHAT_COMMANDS.busy;
    button.textContent = !c.enabled ? 'Отключена' : left > 0 ? 'Недоступна' : 'Использовать';
    badge.textContent = left ? 'Через ' + chatCommandDuration(left) : '';
  }
}

async function chatCommandExecute(name, generation) {
  if (CHAT_COMMANDS.busy) return false;
  const normalized = name.trim().toLocaleLowerCase('ru-RU');
  // Один и тот же request_id сохраняется при сетевом сбое; сервер вернёт уже рассчитанную операцию.
  const rid = CHAT_COMMANDS.pending.get(normalized) || chatId();
  CHAT_COMMANDS.pending.set(normalized, rid);
  CHAT_COMMANDS.busy = true;
  chatCommandsTick();
  try {
    const result = await api('/chat/commands/use', { json: { command: normalized, request_id: rid } });
    CHAT_COMMANDS.pending.delete(normalized);
    toast(`+${result.chips} жетонов · баланс ${result.balance}`, {icon: '🎁'});
    if (CHAT_COMMANDS.open) chatCommandsFetch();
    if (typeof chatPoll === 'function' && (location.hash === '#/' || location.hash === '')) chatPoll(CHAT.active);
    return true;
  } catch (e) {
    if (e.status && e.status < 500 && e.status !== 429) CHAT_COMMANDS.pending.delete(normalized);
    toast(e.message, {icon: '⚠️'});
    if (CHAT_COMMANDS.open) chatCommandsFetch();
    return false;
  } finally {
    CHAT_COMMANDS.busy = false;
    chatCommandsTick();
  }
}

async function chatCommandFromInput(value, generation) {
  const input = document.querySelector('#chatText');
  const send = document.querySelector('#chatSend');
  if (!input || !send || send.disabled) return;
  send.disabled = true;
  const ok = await chatCommandExecute(value, generation);
  if (ok && chatIsCurrent(generation)) {
    input.value = '';
    const counter = document.querySelector('#chatCount');
    if (counter) counter.textContent = '0 / 1000';
  }
  if (chatIsCurrent(generation)) send.disabled = false;
}

async function chatCommandsCreate(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = new FormData(form);
  const error = CHAT_COMMANDS.modal?.querySelector('#cmdCreateError');
  const button = CHAT_COMMANDS.modal?.querySelector('#cmdCreateBtn');
  if (!error || !button) return;
  error.textContent = '';
  const name = String(data.get('command') || '').trim();
  const payload = {
    command: name.startsWith('/') ? name : '/' + name,
    description: String(data.get('description') || '').trim(),
    action: String(data.get('action') || 'add_chips'),
    amount: Number(data.get('amount')),
    cooldown_value: Number(data.get('cooldown_value')),
    cooldown_unit: String(data.get('cooldown_unit') || 'hours')
  };
  button.disabled = true;
  try {
    if (CHAT_COMMANDS.editId) {
      await api(`/chat/commands/${CHAT_COMMANDS.editId}`, { method: 'PUT', json: payload });
      toast('Команда изменена', { icon: '✏️' });
      chatCommandsEditStop();
    } else {
      await api('/chat/commands', { json: payload });
      toast('Команда создана', {icon: '⌘'});
      form.reset();
    }
    await chatCommandsFetch();
  } catch (e) { error.textContent = e.message; }
  finally { button.disabled = false; }
}

/** Форма создания превращается в форму редактирования выбранной команды. */
function chatCommandsEditStart(c) {
  const m = CHAT_COMMANDS.modal; if (!m) return;
  const f = m.querySelector('#cmdCreateForm');
  CHAT_COMMANDS.editId = c.id;
  f.elements.command.value = c.command; f.elements.description.value = c.description; f.elements.amount.value = c.amount;
  f.elements.cooldown_value.value = c.cooldown_value; f.elements.cooldown_unit.value = c.cooldown_unit;
  m.querySelector('#cmdFormTitle').textContent = 'Изменить команду ' + c.command;
  m.querySelector('#cmdCreateBtn').textContent = 'Сохранить';
  m.querySelector('#cmdCancelEdit').classList.remove('hidden');
  m.querySelector('#cmdCreateError').textContent = '';
  f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function chatCommandsEditStop() {
  const m = CHAT_COMMANDS.modal; CHAT_COMMANDS.editId = null; if (!m) return;
  const f = m.querySelector('#cmdCreateForm'); f.reset();
  m.querySelector('#cmdFormTitle').innerHTML = 'Создать команду <span class="small muted">(администратор)</span>';
  m.querySelector('#cmdCreateBtn').textContent = 'Создать команду';
  m.querySelector('#cmdCancelEdit').classList.add('hidden');
}
