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
  if (msg.system_kind && msg.system_kind !== 'command') {
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

  if (msg.system_kind === 'command') item.classList.add('command');
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
  header.append(who);
  if (msg.clan_tag) {
    const ct = document.createElement('span');
    ct.className = 'clan-tag sm';
    ct.textContent = msg.clan_tag;
    header.append(ct);
  }
  header.append(time);
  if (msg.system_kind === 'command') {
    const tag = document.createElement('span');
    tag.className = 'lq-chat-command-tag';
    tag.textContent = '⌘ КОМАНДА';
    header.appendChild(tag);
  }
  const mod = chatModButtons(msg); if (mod) header.append(mod);

  content.append(header);
  if (msg.gif_url && /^\/api\/chat\/gifs\/[A-Za-z0-9_-]+$/.test(msg.gif_url)) {   // GIF: адрес проверяем, подставляем только как src картинки
    const gif = document.createElement('img');
    gif.className = 'lq-chat-gif'; gif.alt = 'GIF'; gif.loading = 'lazy'; gif.decoding = 'async';
    gif.src = API_BASE + msg.gif_url;
    gif.dataset.act = 'chatGifOpen'; gif.dataset.src = gif.src;
    gif.addEventListener('error', () => { const n = document.createElement('div'); n.className = 'lq-chat-text lq-chat-gif-gone'; n.textContent = '🖼 GIF больше недоступен'; gif.replaceWith(n); });
    content.append(gif);
  }
  if (msg.image_url && /^\/api\/chat\/images\/[A-Za-z0-9_-]+$/.test(msg.image_url)) {   // фото: тот же приём, что и у GIF
    const ph = document.createElement('img');
    ph.className = 'lq-chat-gif lq-chat-photo'; ph.alt = 'Фото'; ph.loading = 'lazy'; ph.decoding = 'async';
    ph.src = API_BASE + msg.image_url;
    ph.dataset.act = 'chatImageOpen'; ph.dataset.src = ph.src;
    ph.addEventListener('error', () => { const n = document.createElement('div'); n.className = 'lq-chat-text lq-chat-gif-gone'; n.textContent = '🖼 Фото больше недоступно'; ph.replaceWith(n); });
    content.append(ph);
  }
  if (msg.text) {
    const text = document.createElement('div');
    text.className = 'lq-chat-text';
    text.textContent = msg.text; // ВАЖНО: никакого innerHTML для пользовательского контента.
    content.append(text);
  }
  item.append(avatar, content);
  return item;
}

function chatIsBottom(el) {
  return !el || el.scrollHeight - el.clientHeight - el.scrollTop < 12;
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
      <div class="lq-chat-compose"><textarea id="chatText" maxlength="1000" rows="2" placeholder="Напиши сообщение…" aria-describedby="chatHint"></textarea><button class="btn ghost lq-chat-gifbtn" id="chatGif" type="button" title="Отправить GIF" aria-label="Отправить GIF">GIF</button><button class="btn ghost lq-chat-gifbtn" id="chatPhoto" type="button" title="Отправить фото" aria-label="Отправить фото">📷</button><button class="btn lq-chat-send" id="chatSend" type="submit">➤</button><input type="file" id="chatGifFile" accept="image/gif" class="hidden"><input type="file" id="chatPhotoFile" accept="image/jpeg,image/png,image/webp,image/*" class="hidden"></div>
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
  $('#chatGif').addEventListener('click', () => $('#chatGifFile').click());
  $('#chatPhoto').addEventListener('click', () => $('#chatPhotoFile').click());
  $('#chatPhotoFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) chatSendPhoto(f, generation); });
  $('#chatGifFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) chatSendGif(f, generation); });
  $('#chatOlder').addEventListener('click', () => chatOlder(generation));
  $('#chatUnread').addEventListener('click', chatScrollBottom);
  let loadingFromTop = false;
  const loadAtTop = () => {
    if (!chatIsCurrent(generation) || !CHAT.hasMore || CHAT.loadingMore || loadingFromTop) return;
    loadingFromTop = true;
    chatOlder(generation).finally(() => { loadingFromTop = false; });
  };
  area.addEventListener('scroll', () => {
    if (chatIsBottom(area)) {
      CHAT.unread = 0;
      $('#chatUnread')?.classList.add('hidden');
    }
    if (area.scrollTop <= 20) loadAtTop();
  }, { passive: true });
  area.addEventListener('wheel', e => {
    if (e.deltaY < 0 && area.scrollTop <= 20) loadAtTop();
  }, { passive: true });

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

const CHAT_GIF_MAX = 3_000_000;
/** Отправить выбранный .gif в чат (с подписью из поля ввода, если она есть). Сервер заново проверяет файл. */
async function chatSendGif(file, generation) {
  if (!chatIsCurrent(generation)) return;
  const input = $('#chatText'), btn = $('#chatGif');
  if (!/\.gif$/i.test(file.name) && file.type !== 'image/gif') { toast('Нужен файл в формате GIF', { icon: '🖼' }); return; }
  if (file.size > CHAT_GIF_MAX) { toast('GIF тяжелее 3 МБ — выбери поменьше', { icon: '🖼' }); return; }
  const caption = input.value.trim();
  if (caption.length > 200) { toast('Подпись к гифке — не больше 200 символов', { icon: '✍️' }); return; }
  const fd = new FormData();
  fd.append('file', file); fd.append('request_id', chatId()); fd.append('caption', caption);
  btn.disabled = true; chatSetStatus('Отправка GIF…');
  try {
    const result = await api('/chat/gif', { method: 'POST', body: fd });
    if (!chatIsCurrent(generation)) return;
    chatMessage(result);
    input.value = ''; $('#chatCount').textContent = '0 / 1000';
    chatSetStatus('На связи');
    chatPoll(generation);
  } catch (e) {
    if (chatIsCurrent(generation)) { chatSetStatus('Не отправлено', true); toast(e.message, { icon: '⚠️' }); }
  } finally { if (chatIsCurrent(generation)) btn.disabled = false; }
}
const CHAT_PHOTO_SIDE = 1600, CHAT_PHOTO_MAX = 8_000_000;
/** Уменьшить фото до CHAT_PHOTO_SIDE и перекодировать в JPEG: браузер сам учитывает поворот с камеры, метаданные (в т.ч. геометка) не передаются. */
async function chatPreparePhoto(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, CHAT_PHOTO_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch (e) { /* не вышло — отправим исходный файл, если он подходит */ }
  return /^image\/(jpeg|png)$/.test(file.type) && file.size <= CHAT_PHOTO_MAX ? file : null;
}
/** Отправить фото в чат (с подписью из поля ввода, если она есть). Сервер заново проверяет и пересобирает файл. */
async function chatSendPhoto(file, generation) {
  if (!chatIsCurrent(generation)) return;
  const input = $('#chatText'), btn = $('#chatPhoto');
  if (file.type === 'image/gif') { toast('Для GIF есть своя кнопка', { icon: '🖼' }); return; }
  if (!/^image\//.test(file.type)) { toast('Нужен файл-картинка (JPEG или PNG)', { icon: '🖼' }); return; }
  const caption = input.value.trim();
  if (caption.length > 200) { toast('Подпись к фото — не больше 200 символов', { icon: '✍️' }); return; }
  btn.disabled = true; chatSetStatus('Готовлю фото…');
  try {
    const blob = await chatPreparePhoto(file);
    if (!blob) throw new Error('Не удалось прочитать фото — попробуй другой файл');
    if (blob.size > CHAT_PHOTO_MAX) throw new Error('Фото тяжелее 8 МБ — выбери поменьше');
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg'); fd.append('request_id', chatId()); fd.append('caption', caption);
    chatSetStatus('Отправка фото…');
    const result = await api('/chat/image', { method: 'POST', body: fd });
    if (!chatIsCurrent(generation)) return;
    chatMessage(result);
    input.value = ''; $('#chatCount').textContent = '0 / 1000';
    chatSetStatus('На связи');
    chatPoll(generation);
  } catch (e) {
    if (chatIsCurrent(generation)) { chatSetStatus('Не отправлено', true); toast(e.message, { icon: '⚠️' }); }
  } finally { if (chatIsCurrent(generation)) btn.disabled = false; }
}
actions.chatImageOpen = b => {
  const src = b.dataset.src;
  if (!src) return;
  return openModal(html`<div class="center"><img class="lq-chat-gif-big" alt="Фото" src="${src}"></div><div class="row mt" style="justify-content:center"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
};
actions.chatGifOpen = b => {
  const src = b.dataset.src;
  if (!src) return;
  const m = openModal(html`<div class="center"><img class="lq-chat-gif-big" alt="GIF" src="${src}"></div><div class="row mt" style="justify-content:center"><button class="btn ghost" data-act="closeModal">Закрыть</button></div>`);
  return m;
};

// Старый адрес чата ведёт на главную страницу, где чат теперь встроен.
route(/^#\/chat$/, () => { location.hash = '#/'; });
