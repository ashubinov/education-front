/* LearnQuest — графика слотов: оригинальные SVG-символы (собаки, предметы, WILD / SCATTER / BONUS).
   Градиенты лежат в одном общем «спрайте» (SLOT_DEFS), поэтому символы можно вставлять в любом месте страницы. */
'use strict';

/* ---------- общие градиенты (id с префиксом sg-) ---------- */
const _lg = (id, a, b, c) => `<linearGradient id="sg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` : `<stop offset="1" stop-color="${b}"/>`}</linearGradient>`;
const _rg = (id, a, b, cx = .35, cy = .3, r = .85) => `<radialGradient id="sg-${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const SLOT_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  ${_rg('pug', '#ffe2a3', '#cf9444')}${_rg('pugmask', '#6a4a35', '#2a1b12')}${_lg('pugear', '#6a4a35', '#2a1b12')}
  ${_rg('bull', '#fff0d8', '#d9b684')}${_lg('bullpatch', '#b9743e', '#7b4421')}${_lg('bulljaw', '#fbe9d0', '#e2c196')}${_lg('bullear', '#8a5330', '#4a2a16')}
  ${_rg('corgi', '#ffc36b', '#ee7a16')}${_lg('corgiwhite', '#ffffff', '#ffe9cf')}${_lg('corgiear', '#ff9d33', '#d96a0c')}
  ${_rg('dobe', '#58586a', '#14141b')}${_lg('dobetan', '#e59a52', '#a35a22')}${_lg('dobeear', '#3a3a46', '#101016')}
  ${_rg('chi', '#fbe2bb', '#e2b57d')}${_lg('chiear', '#f0c28a', '#c98e52')}${_lg('chisnout', '#fff1d9', '#f0d1a0')}
  ${_lg('gold', '#fff1a8', '#f2b61f', '#b87a08')}${_lg('red', '#ff6a5c', '#d42a35', '#8f1020')}${_lg('blue', '#6fc7ff', '#2a74e8', '#143f9e')}
  ${_lg('wood', '#d08a46', '#9a5a26', '#6e3a18')}${_lg('bone', '#fffbe8', '#f1d58a', '#c99a3a')}${_rg('ball', '#f4ff7a', '#8fc400', .35, .3, .9)}
  ${_rg('wild', '#ff5a6e', '#7b0f2e', .5, .4, .8)}${_rg('scat', '#c06bff', '#4a1a9a', .5, .4, .8)}${_lg('leather', '#ff7a6c', '#c42030', '#7a0e1c')}
  ${_lg('kibble', '#c47a3a', '#7a4218')}${_lg('shine', '#ffffff', '#ffffff')}
</defs></svg>`;

const _eye = (cx, cy, r, dx = 0, dy = 0) => `<g class="eye"><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.12}" fill="#fff" stroke="#2a1a12" stroke-width="1.8"/><circle cx="${cx + dx}" cy="${cy + dy}" r="${r * .58}" fill="#2a1608"/><circle cx="${cx + dx - r * .22}" cy="${cy + dy - r * .26}" r="${r * .22}" fill="#fff"/></g>`;
const _gloss = (cx, cy, rx, ry, rot = -18, o = .34) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const _paw = (cx, cy, s, fill = 'url(#sg-gold)', stroke = '#8a5a08') => `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4"><ellipse cx="${cx}" cy="${cy + 6 * s}" rx="${12 * s}" ry="${9.5 * s}"/><ellipse cx="${cx - 13 * s}" cy="${cy - 5 * s}" rx="${4.8 * s}" ry="${6.5 * s}" transform="rotate(-18 ${cx - 13 * s} ${cy - 5 * s})"/><ellipse cx="${cx - 4.5 * s}" cy="${cy - 13 * s}" rx="${4.8 * s}" ry="${6.8 * s}" transform="rotate(-6 ${cx - 4.5 * s} ${cy - 13 * s})"/><ellipse cx="${cx + 4.5 * s}" cy="${cy - 13 * s}" rx="${4.8 * s}" ry="${6.8 * s}" transform="rotate(6 ${cx + 4.5 * s} ${cy - 13 * s})"/><ellipse cx="${cx + 13 * s}" cy="${cy - 5 * s}" rx="${4.8 * s}" ry="${6.5 * s}" transform="rotate(18 ${cx + 13 * s} ${cy - 5 * s})"/></g>`;
const _ST = 'stroke="#2a1a12" stroke-linejoin="round"';

const SLOT_ART = {
  /* Мопс: самодовольный, с моноклем */
  pug: `<path d="M16 32 Q3 40 8 64 Q23 64 31 46 Z" fill="url(#sg-pugear)" ${_ST} stroke-width="2.4"/><path d="M84 32 Q97 40 92 64 Q77 64 69 46 Z" fill="url(#sg-pugear)" ${_ST} stroke-width="2.4"/>
    <ellipse cx="50" cy="54" rx="36" ry="33" fill="url(#sg-pug)" ${_ST} stroke-width="2.6"/>
    <path d="M35 29 Q50 22 65 29 M38 35 Q50 29 62 35" fill="none" stroke="#a8742f" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="50" cy="68" rx="20" ry="16" fill="url(#sg-pugmask)"/>
    ${_eye(35, 50, 9, 1, 1)}<path d="M25 49 Q35 38 45 49 Z" fill="#d9a255" ${_ST} stroke-width="1.6"/>${_eye(65, 50, 9, -1, 1)}<path d="M55 49 Q65 38 75 49 Z" fill="#d9a255" ${_ST} stroke-width="1.6"/>
    <circle cx="65" cy="50" r="13" fill="#bfe8ff" opacity=".22" stroke="#e6b422" stroke-width="3"/><path d="M74 59 Q84 72 76 88" fill="none" stroke="#e6b422" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="7.5" ry="5.2" fill="#120c08"/><ellipse cx="47.5" cy="61.5" rx="2.4" ry="1.3" fill="#fff" opacity=".6"/>
    <path d="M50 68 V72 M42 76 Q50 81 58 76" fill="none" stroke="#120c08" stroke-width="2.2" stroke-linecap="round"/>${_gloss(38, 33, 15, 6)}`,

  /* Бульдог: «я здесь главный», золотая цепь */
  bulldog: `<path d="M14 30 Q4 18 20 16 Q33 20 33 36 Z" fill="url(#sg-bullear)" ${_ST} stroke-width="2.4"/><path d="M86 30 Q96 18 80 16 Q67 20 67 36 Z" fill="url(#sg-bullear)" ${_ST} stroke-width="2.4"/>
    <ellipse cx="50" cy="52" rx="41" ry="32" fill="url(#sg-bull)" ${_ST} stroke-width="2.6"/>
    <path d="M17 42 Q33 22 50 40 Q42 62 22 58 Z" fill="url(#sg-bullpatch)" opacity=".92"/>
    <ellipse cx="31" cy="74" rx="19" ry="14" fill="url(#sg-bulljaw)" ${_ST} stroke-width="2"/><ellipse cx="69" cy="74" rx="19" ry="14" fill="url(#sg-bulljaw)" ${_ST} stroke-width="2"/>
    <ellipse cx="50" cy="64" rx="19" ry="13" fill="#fbeeda" ${_ST} stroke-width="1.6"/>
    <path d="M30 80 Q50 94 70 80 Q50 88 30 80 Z" fill="url(#sg-bulljaw)" ${_ST} stroke-width="2"/><path d="M39 79 L42 71 L45 79 Z M55 79 L58 71 L61 79 Z" fill="#fff" ${_ST} stroke-width="1.4"/>
    <ellipse cx="50" cy="58" rx="11" ry="6.5" fill="#120c08"/><ellipse cx="46" cy="56" rx="3" ry="1.5" fill="#fff" opacity=".6"/>
    ${_eye(34, 44, 6.4, 1, 1)}${_eye(66, 44, 6.4, -1, 1)}<path d="M25 36 L43 43 M75 36 L57 43" stroke="#2a1608" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M20 90 Q50 104 80 90" fill="none" stroke="url(#sg-gold)" stroke-width="6" stroke-linecap="round"/><path d="M20 90 Q50 104 80 90" fill="none" stroke="#8a5a08" stroke-width=".8" stroke-dasharray="2 3"/>
    <circle cx="50" cy="96" r="6.5" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="1.6"/>${_gloss(36, 30, 16, 6)}`,

  /* Корги: счастливый, с языком */
  corgi: `<path d="M13 6 L38 30 L12 48 Q2 26 13 6 Z" fill="url(#sg-corgiear)" ${_ST} stroke-width="2.4"/><path d="M16 17 L31 30 L16 40 Z" fill="#ff9db1"/><path d="M87 6 L62 30 L88 48 Q98 26 87 6 Z" fill="url(#sg-corgiear)" ${_ST} stroke-width="2.4"/><path d="M84 17 L69 30 L84 40 Z" fill="#ff9db1"/>
    <ellipse cx="50" cy="56" rx="37" ry="33" fill="url(#sg-corgi)" ${_ST} stroke-width="2.6"/>
    <path d="M50 30 Q42 52 28 64 Q50 94 72 64 Q58 52 50 30 Z" fill="url(#sg-corgiwhite)"/>
    <g class="eye"><ellipse cx="34" cy="50" rx="7.5" ry="9" fill="#26140a"/><circle cx="31.5" cy="46" r="3" fill="#fff"/><circle cx="36.5" cy="53" r="1.5" fill="#fff"/></g>
    <g class="eye"><ellipse cx="66" cy="50" rx="7.5" ry="9" fill="#26140a"/><circle cx="63.5" cy="46" r="3" fill="#fff"/><circle cx="68.5" cy="53" r="1.5" fill="#fff"/></g>
    <circle cx="24" cy="63" r="6" fill="#ff7a90" opacity=".4"/><circle cx="76" cy="63" r="6" fill="#ff7a90" opacity=".4"/>
    <path d="M36 71 Q50 90 64 71 Q50 76 36 71 Z" fill="#7a1a1f" ${_ST} stroke-width="1.8"/><path d="M43 79 Q50 96 57 79 Q50 84 43 79 Z" fill="#ff6f91" ${_ST} stroke-width="1.6"/>
    <ellipse cx="50" cy="63" rx="6.5" ry="4.8" fill="#120c08"/><ellipse cx="48" cy="61.5" rx="2" ry="1.1" fill="#fff" opacity=".6"/>${_gloss(36, 34, 14, 5.5)}`,

  /* Доберман: статусный, в очках, золотая цепь */
  doberman: `<path d="M20 3 L40 32 L13 42 Z" fill="url(#sg-dobeear)" ${_ST} stroke-width="2.4"/><path d="M80 3 L60 32 L87 42 Z" fill="url(#sg-dobeear)" ${_ST} stroke-width="2.4"/><path d="M21 14 L33 32 L19 37 Z M79 14 L67 32 L81 37 Z" fill="#a35a22" opacity=".8"/>
    <ellipse cx="50" cy="46" rx="30" ry="32" fill="url(#sg-dobe)" ${_ST} stroke-width="2.6"/>
    <ellipse cx="50" cy="74" rx="20" ry="18" fill="url(#sg-dobetan)" ${_ST} stroke-width="2.4"/>
    <circle cx="35" cy="31" r="3" fill="#e59a52"/><circle cx="65" cy="31" r="3" fill="#e59a52"/>
    <ellipse cx="50" cy="66" rx="10" ry="6.4" fill="#0c0c10"/><ellipse cx="46" cy="64" rx="3.2" ry="1.5" fill="#fff" opacity=".65"/>
    <path d="M18 40 H47 V53 Q47 61 38 61 H28 Q18 61 18 52 Z M53 40 H82 V52 Q82 61 72 61 H62 Q53 61 53 53 Z" fill="#0b0b10" stroke="#e6b422" stroke-width="2" stroke-linejoin="round"/>
    <path d="M47 44 H53" stroke="#e6b422" stroke-width="2.4"/><path d="M23 44 L31 44 L25 52 Z M58 44 L66 44 L60 52 Z" fill="#fff" opacity=".55"/>
    <path d="M42 82 Q50 87 58 82" fill="none" stroke="#1a0c04" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M20 92 Q50 104 80 92" fill="none" stroke="url(#sg-gold)" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="97" r="4.5" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="1.4"/>${_gloss(40, 24, 13, 5)}`,

  /* Чихуахуа: маленький босс в короне, огромные уши и глаза */
  chihuahua: `<path d="M1 20 L31 40 L22 74 Q1 58 1 20 Z" fill="url(#sg-chiear)" ${_ST} stroke-width="2.4"/><path d="M6 31 L26 44 L20 63 Q7 52 6 31 Z" fill="#ff9db1"/><path d="M99 20 L69 40 L78 74 Q99 58 99 20 Z" fill="url(#sg-chiear)" ${_ST} stroke-width="2.4"/><path d="M94 31 L74 44 L80 63 Q93 52 94 31 Z" fill="#ff9db1"/>
    <ellipse cx="50" cy="60" rx="31" ry="29" fill="url(#sg-chi)" ${_ST} stroke-width="2.6"/>
    <ellipse cx="50" cy="73" rx="14" ry="10.5" fill="url(#sg-chisnout)" stroke="#6a4a2a" stroke-width="1.4"/>
    <g class="eye"><ellipse cx="37" cy="54" rx="11" ry="12.5" fill="#fff" ${_ST} stroke-width="2"/><circle cx="38.5" cy="55.5" r="7.2" fill="#2a1608"/><circle cx="35.5" cy="51.5" r="3.2" fill="#fff"/><circle cx="41" cy="58.5" r="1.6" fill="#fff"/></g>
    <g class="eye"><ellipse cx="63" cy="54" rx="11" ry="12.5" fill="#fff" ${_ST} stroke-width="2"/><circle cx="61.5" cy="55.5" r="7.2" fill="#2a1608"/><circle cx="58.5" cy="51.5" r="3.2" fill="#fff"/><circle cx="64" cy="58.5" r="1.6" fill="#fff"/></g>
    <ellipse cx="50" cy="69" rx="5.4" ry="3.8" fill="#120c08"/><path d="M45 77 Q50 81 55 77" fill="none" stroke="#120c08" stroke-width="2" stroke-linecap="round"/>
    <path d="M32 33 L35 17 L43 27 L50 11 L57 27 L65 17 L68 33 Z" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="1.8" stroke-linejoin="round"/><circle cx="50" cy="26" r="2.6" fill="#ff3b52"/><circle cx="39" cy="29" r="1.8" fill="#38c6ff"/><circle cx="61" cy="29" r="1.8" fill="#38c6ff"/>
    <path d="M50 90 L36 83 L36 98 Z M50 90 L64 83 L64 98 Z" fill="url(#sg-red)" stroke="#6a0c18" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="90" r="4" fill="#ff5a6a" stroke="#6a0c18" stroke-width="1.4"/>${_gloss(40, 42, 11, 4.5)}`,

  /* Косточка */
  bone: `<g transform="rotate(-32 50 50)"><rect x="20" y="39" width="60" height="22" rx="9" fill="url(#sg-bone)" stroke="#8a5a1e" stroke-width="2.4"/>
      <g fill="url(#sg-bone)" stroke="#8a5a1e" stroke-width="2.4"><circle cx="20" cy="37" r="12"/><circle cx="20" cy="63" r="12"/><circle cx="80" cy="37" r="12"/><circle cx="80" cy="63" r="12"/></g>
      <rect x="24" y="42" width="52" height="6" rx="3" fill="#fff" opacity=".55"/><circle cx="16" cy="32" r="3.2" fill="#fff" opacity=".7"/><circle cx="76" cy="32" r="3.2" fill="#fff" opacity=".7"/></g>`,

  /* Ошейник */
  collar: `<path d="M12 52 A38 28 0 1 1 88 52 A38 28 0 1 1 12 52 Z M22 52 A28 19 0 1 0 78 52 A28 19 0 1 0 22 52 Z" fill-rule="evenodd" fill="url(#sg-leather)" stroke="#5a0a14" stroke-width="2.4"/>
    <g fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="1.2"><circle cx="18" cy="46" r="3.4"/><circle cx="82" cy="46" r="3.4"/><circle cx="28" cy="30" r="3.4"/><circle cx="72" cy="30" r="3.4"/><circle cx="50" cy="20" r="3.4"/><circle cx="26" cy="68" r="3.4"/><circle cx="74" cy="68" r="3.4"/></g>
    <path d="M50 80 V84" stroke="#8a5a08" stroke-width="3"/><circle cx="50" cy="90" r="9.5" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="2"/>${_paw(50, 90, .32, '#8a5a08', '#8a5a08')}<ellipse cx="36" cy="26" rx="14" ry="3.6" fill="#fff" opacity=".4" transform="rotate(-20 36 26)"/>`,

  /* Миска */
  bowl: `<g fill="url(#sg-kibble)" stroke="#4a2408" stroke-width="1.4"><circle cx="32" cy="42" r="6"/><circle cx="44" cy="36" r="6.4"/><circle cx="57" cy="37" r="6"/><circle cx="68" cy="42" r="6"/><circle cx="50" cy="44" r="6.4"/><circle cx="38" cy="47" r="5.2"/><circle cx="62" cy="47" r="5.2"/></g>
    <path d="M10 52 Q50 42 90 52 L79 86 Q50 96 21 86 Z" fill="url(#sg-blue)" stroke="#0e2f78" stroke-width="2.6" stroke-linejoin="round"/>
    <ellipse cx="50" cy="52" rx="40" ry="9" fill="#9bdcff" stroke="#0e2f78" stroke-width="2.2"/><ellipse cx="50" cy="52" rx="33" ry="6" fill="#2a74e8" opacity=".55"/>
    <path d="M16 62 Q50 72 84 62" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>${_paw(50, 74, .5, '#fff', '#fff')}<ellipse cx="28" cy="66" rx="6" ry="14" fill="#fff" opacity=".28" transform="rotate(12 28 66)"/>`,

  /* Мячик */
  ball: `<circle cx="50" cy="52" r="38" fill="url(#sg-ball)" stroke="#4a6a00" stroke-width="2.6"/><path d="M17 33 Q48 52 20 78" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".92"/><path d="M83 31 Q52 52 80 76" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".92"/>
    <ellipse cx="36" cy="30" rx="14" ry="7" fill="#fff" opacity=".5" transform="rotate(-28 36 30)"/>`,

  /* WILD: золотая медаль с лапой */
  wild: `<circle cx="50" cy="48" r="42" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="3"/><circle cx="50" cy="48" r="34" fill="url(#sg-wild)" stroke="#fff3b0" stroke-width="2.6"/>
    <g stroke="#fff3b0" stroke-width="1.6" opacity=".6"><path d="M50 16 V22 M50 74 V80 M18 48 H24 M76 48 H82"/></g>${_paw(50, 44, 1.05)}
    <rect x="12" y="68" width="76" height="20" rx="6" fill="url(#sg-red)" stroke="#fff3b0" stroke-width="2.4"/><text x="50" y="83.5" text-anchor="middle" font-family="Nunito,Arial Black,Impact,sans-serif" font-weight="900" font-size="17" fill="#fff" stroke="#5a0a14" stroke-width="2.6" paint-order="stroke" letter-spacing="1">WILD</text>
    <ellipse cx="36" cy="26" rx="14" ry="5" fill="#fff" opacity=".4" transform="rotate(-28 36 26)"/>`,

  /* SCATTER: фиолетовая звезда-награда */
  scatter: `<path d="M50 4 L61 30 L90 32 L68 50 L76 78 L50 63 L24 78 L32 50 L10 32 L39 30 Z" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="46" r="23" fill="url(#sg-scat)" stroke="#fff3b0" stroke-width="2.4"/>${_paw(50, 44, .72, '#fff3b0', '#fff')}
    <path d="M30 76 L22 96 L36 90 L42 100 L50 82 Z M70 76 L78 96 L64 90 L58 100 L50 82 Z" fill="url(#sg-red)" stroke="#5a0a14" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="12" y="70" width="76" height="18" rx="5" fill="url(#sg-red)" stroke="#fff3b0" stroke-width="2.2"/><text x="50" y="83.5" text-anchor="middle" font-family="Nunito,Arial Black,Impact,sans-serif" font-weight="900" font-size="12.5" fill="#fff" stroke="#5a0a14" stroke-width="2.4" paint-order="stroke" letter-spacing=".5">SCATTER</text>`,

  /* BONUS: будка с табличкой */
  bonus: `<path d="M18 48 H82 V90 H18 Z" fill="url(#sg-wood)" stroke="#3e1d08" stroke-width="2.6" stroke-linejoin="round"/><path d="M18 60 H82 M18 72 H82" stroke="#3e1d08" stroke-width="1.4" opacity=".55"/>
    <path d="M6 52 L50 12 L94 52 Z" fill="url(#sg-red)" stroke="#4a0a14" stroke-width="3" stroke-linejoin="round"/><path d="M18 46 L50 18" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/>
    <path d="M38 90 V72 Q50 56 62 72 V90 Z" fill="#240e06" stroke="#3e1d08" stroke-width="2"/><ellipse cx="50" cy="86" rx="9" ry="3" fill="#6a3a18"/>
    <rect x="22" y="31" width="56" height="17" rx="5" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="2.4"/><text x="50" y="44.2" text-anchor="middle" font-family="Nunito,Arial Black,Impact,sans-serif" font-weight="900" font-size="13.5" fill="#7a1020" stroke="#fff6c0" stroke-width="2" paint-order="stroke" letter-spacing=".6">BONUS</text>
    <path d="M50 3 L53 10 L61 10 L55 15 L57 22 L50 18 L43 22 L45 15 L39 10 L47 10 Z" fill="url(#sg-gold)" stroke="#8a5a08" stroke-width="1.2"/>`,
};

const SLOT_DOGS = new Set(['doberman', 'bulldog', 'pug', 'corgi', 'chihuahua']);
/** Один символ автомата как inline-SVG. */
function slotSvg(id) { return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id}">${SLOT_ART[id] || ''}</svg>`; }
