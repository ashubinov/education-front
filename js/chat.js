/* LearnQuest — компактный общий чат на главной странице.
   Автообновление без перезагрузки, история, идемпотентная отправка.
   Содержимое сообщений не модерируется и не интерпретируется как HTML. */
'use strict';

const CHAT = {
  cursor: 0, latest: new Map(), active: 0, polling: false, loadingMore: false,
  hasMore: false, timer: null, pendingId: null, pendingText: null,
  lastError: 0, unread: 0,
};
const CHAT_REFRESH_MS = 2300;

function chatId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map(n => n.toString(16).padStart(2, '0')).join('');
}

function chatIsCurrent(generation) {
  return generation === CHAT.active && (location.hash === '#/' || location.hash === '') && !!$('#homeChatSlot') && !!$('#chatMessages');
}

function chatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Кнопки администратора на сообщении: удалить (любое) и заблокировать автора (обычные сообщения других людей). */
function chatModButtons(msg) {
  if (!S.user || !S.user.is_admin) return null;
  const box = document.createElement('span');
  box.className = 'lq-chat-mod';
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'lq-chat-mod-btn'; del.textContent = '🗑';
  del.title = 'Удалить сообщение'; del.setAttribute('aria-label', 'Удалить сообщение');
  del.dataset.act = 'chatDelete'; del.dataset.id = msg.id;
  box.append(del);
  if (!msg.system_kind && msg.user_id !== S.user.id) {
    const ban = document.createElement('button');
    ban.type = 'button'; ban.className = 'lq-chat-mod-btn'; ban.textContent = '🚫';
    ban.title = 'Заблокировать автора'; ban.setAttribute('aria-label', 'Заблокировать автора');
    ban.dataset.act = 'banUser'; ban.dataset.id = msg.user_id; ban.dataset.name = msg.name;
    box.append(ban);
  }
  return box;
}
actions.chatDelete = async b => {
  const id = +b.dataset.id;
  if (!await askConfirm('Удалить сообщение?', 'Оно исчезнет у всех участников чата.', 'Удалить', 'Отмена', true)) return;
  try { await api('/chat/messages/' + id, { method: 'DELETE' }); chatRemove(id); toast('Сообщение удалено', { icon: '🗑', ms: 1500 }); }
  catch (e) { toast(e.message, { icon: '⚠️' }); }
};

function chatEntry(msg) {
  const mine = S.user && msg.user_id === S.user.id;
  const item = document.createElement('article');
  item.className = 'lq-chat-message' + (mine ? ' mine' : '');
  item.dataset.id = msg.id;
  if (msg.system_kind) {
    item.classList.add('system');
    const bubble = document.createElement('div');
    bubble.className = 'lq-chat-bubble';
    const header = document.createElement('div');
    header.className = 'lq-chat-meta';
    const label = document.createElement('b');
    label.textContent = msg.system_kind === 'command' ? 'КОМАНДА' : 'СИСТЕМА';
    const time = document.createElement('time');
    time.dateTime = msg.created_at;
    time.textContent = chatTime(msg.created_at);
    const text = document.createElement('div');
    text.className = 'lq-chat-text';
    text.textContent = msg.text; // Never parse system content as HTML.
    header.append(label, time);
    const mod = chatModButtons(msg); if (mod) header.append(mod);
    bubble.append(header, text);
    item.append(bubble);
    return item;
  }

  const avatar = document.createElement('div');
  avatar.className = 'lq-chat-avatar';
  if (msg.avatar_url && /^\/api\/avatars\/[A-Za-z0-9_-]+$/.test(msg.avatar_url)) {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = API_BASE + msg.avatar_url;
    avatar.appendChild(img);
  } else {
    avatar.textContent = msg.avatar || '👤';
  }

  const content = document.createElement('div');
  content.className = 'lq-chat-bubble';
  const header = document.createElement('div');
  header.className = 'lq-chat-meta';
  const who = document.createElement('b');
  who.textContent = msg.name;
  const time = document.createElement('time');
  time.dateTime = msg.created_at;
  time.textContent = chatTime(msg.created_at);
  header.append(who, time);
  const mod = chatModButtons(msg); if (mod) header.append(mod);

  const text = document.createElement('div');
  text.className = 'lq-chat-text';
  text.textContent = msg.text; // ВАЖНО: никакого innerHTML для пользовательского контента.
  content.append(header, text);
  item.append(avatar, content);
  return item;
}

function chatIsBottom(el) {
  return !el || el.scrollHeight - el.clientHeight - el.scrollTop < 90;
}

function chatScrollBottom() {
  const area = $('#chatMessages');
  if (area) area.scrollTop = area.scrollHeight;
  CHAT.unread = 0;
  const notice = $('#chatUnread');
  if (notice) notice.classList.add('hidden');
}

function chatMessage(msg, { prepend = false, silent = false } = {}) {
  const list = $('#chatMessages');
  if (!list || CHAT.latest.has(msg.id)) return false;
  const atBottom = chatIsBottom(list);
  const empty = $('#chatEmpty');
  if (empty) empty.remove();
  const node = chatEntry(msg);
  CHAT.latest.set(msg.id, node);
  if (prepend) list.insertBefore(node, list.firstChild);
  else list.appendChild(node);
  if (!prepend && !silent) {
    if (atBottom || msg.user_id === S.user?.id) chatScrollBottom();
    else {
      CHAT.unread++;
      const n = $('#chatUnread');
      if (n) { n.textContent = 'Новых сообщений: ' + CHAT.unread + ' ↓'; n.classList.remove('hidden'); }
    }
  }
  return true;
}

function chatRemove(messageId) {
  const node = CHAT.latest.get(messageId);
  if (node) node.remove();
  CHAT.latest.delete(messageId);
}

function chatSetStatus(text, error = false) {
  const el = $('#chatStatus');
  if (el) {
    el.textContent = text;
    el.classList.toggle('lq-chat-error', error);
  }
}

/** Встраивается в #homeChatSlot после отрисовки главного экрана в views.js. */
async function chatMountHome() {
  const host = $('#homeChatSlot');
  if (!host || !S.user) return;
  const generation = ++CHAT.active;
  CHAT.latest = new Map(); CHAT.unread = 0; CHAT.cursor = 0;
  CHAT.polling = false; CHAT.loadingMore = false;
  host.innerHTML = `<div class="card lq-chat-card">
    <div class="lq-chat-heading"><h2>💬 Общий чат</h2><span class="lq-chat-status" id="chatStatus" role="status">Подключение…</span></div>
    <div class="lq-chat-toolbar"><button class="lq-chat-text-button" id="chatOlder" type="button" hidden>↑ Ранние сообщения</button><button class="lq-chat-text-button hidden" id="chatUnread" type="button">Новые сообщения ↓</button></div>
    <div class="lq-chat-list" id="chatMessages" role="log" aria-label="Общий чат" aria-live="off"><div id="chatEmpty" class="lq-chat-placeholder">Загрузка сообщений…</div></div>
    <form id="chatForm" class="lq-chat-form">
      <label class="lq-chat-label" for="chatText">Сообщение</label>
      <div class="lq-chat-compose"><textarea id="chatText" maxlength="1000" rows="2" placeholder="Напиши сообщение…" aria-describedby="chatHint"></textarea><button class="btn lq-chat-send" id="chatSend" type="submit">➤</button></div>
      <div class="lq-chat-help"><span id="chatHint">Enter — отправить · Shift+Enter — перенос</span><span id="chatCount">0 / 1000</span></div>
    </form>
  </div>`;
  if (typeof chatCommandsMount === 'function') chatCommandsMount(generation);
  const form = $('#chatForm'), input = $('#chatText'), area = $('#chatMessages');
  form.addEventListener('submit', e => { e.preventDefault(); chatSend(generation); });
  input.addEventListener('input', () => { const n = $('#chatCount'); if (n) n.textContent = input.value.length + ' / 1000'; });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); chatSend(generation); }
  });
  $('#chatOlder').addEventListener('click', () => chatOlder(generation));
  $('#chatUnread').addEventListener('click', chatScrollBottom);
  area.addEventListener('scroll', () => {
    if (chatIsBottom(area)) chatScrollBottom();
  });

  const onVisibility = () => {
    if (document.hidden || !chatIsCurrent(generation)) return;
    clearTimeout(CHAT.timer);
    CHAT.timer = setTimeout(() => chatPoll(generation), 0);
  };
  document.addEventListener('visibilitychange', onVisibility);
  S.onLeave = () => {
    CHAT.active++;
    clearTimeout(CHAT.timer); CHAT.timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
  };
  try {
    const data = await api('/chat/messages');
    if (!chatIsCurrent(generation)) return;
    CHAT.cursor = data.cursor;
    CHAT.hasMore = data.has_more;
    const empty = $('#chatEmpty');
    if (empty) empty.textContent = data.messages.length ? '' : 'Пока нет сообщений. Напиши первым!';
    for (const msg of data.messages) chatMessage(msg, { silent: true });
    chatScrollBottom();
    $('#chatOlder').hidden = !CHAT.hasMore;
    chatSetStatus('На связи');
  } catch (e) {
    if (!chatIsCurrent(generation)) return;
    $('#chatEmpty').textContent = 'Чат временно недоступен. Повторяем подключение…';
    chatSetStatus('Нет связи', true);
  }
  if (chatIsCurrent(generation)) CHAT.timer = setTimeout(() => chatPoll(generation), CHAT_REFRESH_MS);
}

async function chatOlder(generation) {
  if (!chatIsCurrent(generation) || CHAT.loadingMore || !CHAT.hasMore) return;
  const ids = [...CHAT.latest.keys()];
  if (!ids.length) return;
  CHAT.loadingMore = true;
  const btn = $('#chatOlder'); btn.disabled = true;
  const list = $('#chatMessages'), beforeHeight = list.scrollHeight;
  try {
    const data = await api('/chat/messages?before_id=' + Math.min(...ids));
    if (!chatIsCurrent(generation)) return;
    // Вставка перед первым сообщением, при сортировке от новых к старым.
    for (const msg of [...data.messages].reverse()) chatMessage(msg, { prepend: true, silent: true });
    list.scrollTop += list.scrollHeight - beforeHeight;
    CHAT.hasMore = data.has_more;
    btn.hidden = !CHAT.hasMore;
  } catch (e) { if (chatIsCurrent(generation)) toast(e.message); }
  finally { CHAT.loadingMore = false; if (btn) btn.disabled = false; }
}

async function chatPoll(generation) {
  if (!chatIsCurrent(generation)) return;
  if (CHAT.polling) return;
  if (document.hidden) { CHAT.timer = setTimeout(() => chatPoll(generation), 10000); return; }
  CHAT.polling = true;
  try {
    for (let page = 0; page < 10; page++) {
      const data = await api('/chat/updates?after=' + CHAT.cursor);
      if (!chatIsCurrent(generation)) return;
      for (const event of data.events) {
        if (event.kind === 'sent' && event.message) chatMessage(event.message);
        if (event.kind === 'deleted') chatRemove(event.message_id);
      }
      CHAT.cursor = data.cursor;
      if (!data.has_more) break;
    }
    chatSetStatus('На связи');
  } catch (e) {
    if (chatIsCurrent(generation)) chatSetStatus('Повторное подключение…', true);
  } finally {
    CHAT.polling = false;
    if (chatIsCurrent(generation)) CHAT.timer = setTimeout(() => chatPoll(generation), CHAT_REFRESH_MS);
  }
}

async function chatSend(generation) {
  if (!chatIsCurrent(generation)) return;
  const input = $('#chatText'), button = $('#chatSend');
  const value = input.value.trim();
  if (!value || button.disabled) return;
  if (value.length > 1000) return;
  if (value.startsWith('/') && typeof chatCommandFromInput === 'function') {
    await chatCommandFromInput(value, generation);
    return;
  }
  if (CHAT.pendingText !== value) { CHAT.pendingId = chatId(); CHAT.pendingText = value; }
  button.disabled = true;
  chatSetStatus('Отправка…');
  try {
    const result = await api('/chat/messages', { json: { text: value, request_id: CHAT.pendingId } });
    if (!chatIsCurrent(generation)) return;
    chatMessage(result);
    input.value = ''; $('#chatCount').textContent = '0 / 1000';
    CHAT.pendingId = null; CHAT.pendingText = null;
    chatSetStatus('На связи');
    // Получим также сообщение в журнале: дубль отфильтруется по id.
    chatPoll(generation);
  } catch (e) {
    if (chatIsCurrent(generation)) {
      chatSetStatus('Не отправлено', true);
      toast(e.message, { icon: '⚠️' });
      // request_id оставляем для повторной попытки при тайм-ауте сети.
    }
  } finally { if (chatIsCurrent(generation)) button.disabled = false; }
}

// Старый адрес чата ведёт на главную страницу, где чат теперь встроен.
route(/^#\/chat$/, () => { location.hash = '#/'; });
