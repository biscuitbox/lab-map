// 화면 그리기
import {
  $, esc, ymd, TODAY, S, ui, M, cat, cabList, findCab, locate, ink, clamp, cabFoot, isManager, isCfgAdmin, layoutLocked,
  itemStatus, dday, hazardsOf, conflicts, canPlace, norm, itemMatch, blockMatch, matchCount, openLoans, loanedQty, stats,
  pname, qrSvg, blockUrl, allRows, LIST_F, yearUsage, exportData, HZ, GHS, LOCK_SVG, myEmail, siteTitle,
  fmtTime, backupDiff, KEEP_DAYS, T, j, safetyOn, PRESETS, TERM_LABELS,
  rooms, roomById, roomOf, curRoom, roomMatchCount, loanRoom, inScope,
  shelvesOf, shelfNo, shelfTxt, shelfName, MAX_SHELVES, MAX_CELLS, groupOf, isGrouped, groupNo,
  floorItems, floorGroup, floorGrouped, floorGroupNo
} from './state.js';
import { cachedPhoto, hydratePhotos } from './photos.js';

/* 단 순서: 화면은 위에서 아래로 그리므로 높은 단부터 (3단, 2단, 1단) */
const shelfOrder = N => Array.from({ length: N }, (_, i) => N - i);
/* 라벨에 넣을 물품 이름: 단이 여러 개면 '3단 ○○ / 2단 ○○'처럼 단별로 */
function labelItems(b, max, tag) {
  const N = shelvesOf(b);
  if (N < 2) return `<${tag}>${esc(b.items.slice(0, max).map(i => i.name).join(', '))}${b.items.length > max ? ` 외 ${b.items.length - max}종` : ''}</${tag}>`;
  return shelfOrder(N).map(n => { const names = b.items.filter(i => shelfNo(b, i) === n).map(i => i.name); return `<${tag} class="lshelf"><b>${n}단</b> ${esc(names.slice(0, 3).join(', ') || '—')}${names.length > 3 ? ` 외 ${names.length - 3}` : ''}</${tag}>`; }).join('');
}
const LINK_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M6 8a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 8 2.5l-.8.8M8 6a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 6 11.5l.8-.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const SEL_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="7.5" y="7.5" width="5" height="5" rx="1" fill="currentColor"/><rect x="7.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>';
const COPY_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 2.5V2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" stroke="currentColor" stroke-width="1.5"/></svg>';
const PASTE_SVG = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="3.5" y="3" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 3V2h5v1M7 9.5h4M9 7.5v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
/* 복사해 둔 것 안내 줄: 블록은 조립 화면에서, 보관장은 배치도와 조립 화면에서 붙여 넣어요 */
function clipBar(where) {
  const c = ui.clip; if (!c) return '';
  if (c.type === 'blocks' && where !== 'cab') return '';
  const what = c.type === 'cab' ? `${esc(c.data.name)} (${T('cab')}, 블록 ${c.data.blocks.length}개)` : `블록 ${c.data.length}개 (${esc(c.data.map(b => b.label).join(', '))})`;
  const items = c.type === 'cab' ? c.data.blocks.reduce((a, b) => a + b.items.length, 0) : c.data.reduce((a, b) => a + b.items.length, 0);
  return `<div class="toolbar clipbar">${COPY_SVG}<span>복사해 둔 것: <b>${what}</b></span>
    ${items ? `<label class="minl" style="color:var(--ink);font-size:12.5px"><input id="clip-items" type="checkbox" data-ch="clipItems" ${ui.clipItems ? 'checked' : ''}> 물품 ${items}종도 함께 (수량 포함)</label>` : ''}
    ${c.type === 'cab' ? `<button class="btn sm" data-act="pasteCab">${PASTE_SVG} ${esc(M().roomName)}에 붙여넣기</button>` : `<span class="hint">점선 칸을 누르면 그 자리에 붙여요.</span><button class="btn sm" data-act="pasteBlocksAuto">빈 곳에 붙여넣기</button>`}
    <button class="btn ghost sm" data-act="clipClear">그만두기</button></div>`;
}
const CHEV = '<svg class="chev" width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true"><path d="m2 2 4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const VIEWS = ['room', 'cab', 'list', 'loans', 'stats', 'qr', 'backup', 'set'];

export function render() {
  const aid = document.activeElement && document.activeElement.id;
  renderAcct();
  const ready = ui.phase === 'ready' && S.metaLoaded && !!S.meta && !!curRoom();
  $('#stats').hidden = $('#tabs').hidden = $('#searchWrap').hidden = $('#corridor').hidden = !ready;
  if (ready) renderCorridor();
  const title = siteTitle(), canTitle = ready && isManager(), ti = $('#siteTitle');
  document.title = title; $('#titleText').textContent = title; $('#titleText').hidden = canTitle; ti.hidden = !canTitle;
  if (canTitle && document.activeElement !== ti) ti.value = title;
  if (!ready) {
    VIEWS.forEach(v => $('#v-' + v).hidden = true);
    $('#gate').hidden = false; renderGate();
  } else {
    $('#gate').hidden = true;
    const s = stats();
    $('#q').placeholder = rooms().length > 1 ? '물품 찾기 (모든 특별실에서)' : '물품 찾기 (예: 염산, 비커)';
    $('#tab-cab .tl').textContent = `${T('cab')} 조립`;
    const go = (cls, attrs, label, n, extra = '') => `<button class="stat ${n ? cls : 'zero'}" ${attrs} title="${label} 보러 가기">${label} <b>${n}</b>${extra}${CHEV}</button>`;
    $('#stats').innerHTML = `<p class="stat-info"><span>${T('cab')} <b>${cabList().length}</b>개</span><span>물품 <b>${s.items}</b>종</span></p>
     <div class="stat-acts">${go('warn', 'data-act="goFilter" data-f="low"', '재고 부족', s.low)}
     ${go('bad', 'data-act="goFilter" data-f="date"', '유효기한 임박·만료', s.date)}
     ${safetyOn() ? go('bad', 'data-act="goWarn"', '보관 경고', s.warn) : ''}
     ${go(s.late ? 'bad' : 'warn', 'data-act="tab" data-view="loans"', '대여 중', s.loans, s.late ? ` <span class="late">연체 ${s.late}</span>` : '')}</div>`;
    document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === ui.view));
    VIEWS.forEach(v => $('#v-' + v).hidden = v !== ui.view);
    ({ room: renderRoom, cab: renderCab, list: renderList, loans: renderLoans, stats: renderStats, qr: renderQr, backup: renderBackup, set: renderSet })[ui.view]();
  }
  renderLightbox();
  if (aid) { const n = document.getElementById(aid); if (n && n !== document.activeElement) n.focus(); }
  hydratePhotos();
}

/* 복도: 특별실 명패. 고른 특별실은 칠판색으로 켜지고, 찾는 중이면 찾은 개수를 달아요 */
function renderCorridor() {
  const q = ui.q.trim(), cur = curRoom(), mgr = isManager();
  const plates = rooms().map(r => {
    const s = stats(r.id), alert = s.low + s.date, hit = q ? roomMatchCount(r.id, q) : 0;
    const badge = q ? (hit ? `<b class="badge hit">${hit}</b>` : '') : (alert ? `<b class="badge">${alert}</b>` : '');
    const tip = `${r.roomName} · ${T('cab', r)} ${cabList(r.id).length}개, 물품 ${s.items}종${alert ? `, 확인할 물품 ${alert}종` : ''}`;
    const on = r.id === cur.id, swing = on && ui.swing === r.id;
    return `<button class="door ${on ? 'on' : ''} ${swing ? 'swing' : ''} ${q && !hit ? 'quiet' : ''}" data-act="pickRoom" data-id="${r.id}" aria-pressed="${on}" title="${esc(tip)}">${esc(r.roomName)}${badge}</button>`;
  }).join('');
  ui.swing = null;
  const kinds = Object.entries(PRESETS).map(([k, p]) => `<button class="chip" data-act="newRoomKind" data-id="${k}" aria-pressed="${ui.newRoomKind === k}">${p.label}</button>`).join('');
  $('#corridor').innerHTML = `<div class="rail" role="toolbar" aria-label="특별실 고르기">${plates}${mgr ? `<button class="door add" data-act="addRoomOpen" aria-expanded="${ui.addingRoom}">＋ 특별실</button>` : ''}</div>
    ${ui.addingRoom && mgr ? `<div class="panel addroom"><h3>새 특별실</h3>
      <div class="addrow"><input id="newroom-name" placeholder="이름 (예: 2과학실, 무한상상실)" aria-label="새 특별실 이름" autocomplete="off"><button class="btn" data-act="addRoom">만들기</button><button class="btn ghost" data-act="addRoomOpen">취소</button></div>
      <div class="lbl">종류 · 부르는 이름과 추천 분류가 정해져요</div><div class="chips">${kinds}</div></div>` : ''}`;
}
/* 찾는 말이 다른 특별실에도 있으면 알려 주는 줄 */
function elsewhere(q) {
  if (!q) return '';
  const cur = curRoom().id, others = rooms().filter(r => r.id !== cur).map(r => [r, roomMatchCount(r.id, q)]).filter(([, n]) => n);
  return others.length ? `<div class="elsewhere">‘${esc(q)}’ 다른 특별실에도 있어요 ${others.map(([r, n]) => `<button class="chip" data-act="pickRoom" data-id="${r.id}">${esc(r.roomName)} <span class="num">${n}</span></button>`).join('')}</div>` : '';
}
/* 재고·대여·통계에서 '이 특별실만 / 모든 특별실' 고르기 */
function scopeChips() {
  if (rooms().length < 2) return '';
  return `<span class="seg"><button class="chip" data-act="scope" data-s="room" aria-pressed="${ui.scope !== 'all'}">${esc(curRoom().roomName)}만</button><button class="chip" data-act="scope" data-s="all" aria-pressed="${ui.scope === 'all'}">모든 특별실</button></span>`;
}
const roomPrefix = cab => rooms().length > 1 && ui.scope === 'all' ? `${esc((roomById(roomOf(cab)) || {}).roomName || '')} › ` : '';

const photoImg = (it, alt) => `<img data-photo="${it.id}" data-at="${it.photoAt}" ${cachedPhoto(it) ? `src="${cachedPhoto(it)}"` : ''} alt="${esc(alt || it.name)}">`;
function renderLightbox() {
  const el = $('#lightbox'), { cab, b, it } = ui.photo && ui.phase === 'ready' ? locate(ui.photo) : {};
  if (!it || !it.photoAt) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(it.name)} 사진">${photoImg(it)}
    <div class="lbl" style="font-size:13px"><span><b style="color:var(--ink)">${esc(it.name)}</b> · ${esc(cab.name)} › ${esc(b.label)}${shelfTxt(b, it)}</span></div>
    <div class="sizes"><label class="btn ghost sm" for="ph-lb-${it.id}">사진 바꾸기</label><input id="ph-lb-${it.id}" type="file" accept="image/*" data-photo-up="${it.id}" hidden>
    ${confirmBtn('delPhoto', it.id, '사진 지우기', '한 번 더 누르면 지워요')}<button class="btn sm" data-act="closePhoto" style="margin-left:auto">닫기</button></div></div>`;
}

const avatar = url => url ? `<img class="av" src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : '<span class="av"></span>';

function renderAcct() {
  const el = $('#acct'), u = S.auth;
  if (!u) { el.innerHTML = ''; return; }
  const role = ui.phase !== 'ready' ? '승인 대기' : isManager() ? '관리자' : '승인됨';
  el.innerHTML = `${avatar(u.photoURL)}<span>${esc(u.displayName || u.email)}</span><span class="role">${role}</span><button class="linkbtn" data-act="logout">로그아웃</button>`;
}

const ICON_LOCK = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="4" y="11" width="18" height="12" rx="3" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" stroke-width="2.2"/></svg>';
const G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
const card = (title, body) => `<div class="gate"><div class="rail gate-rail"><span class="door on">${esc(siteTitle())}</span></div><div class="panel"><h2>${title}</h2>${body}<p class="help">처음이라면 <a href="help.html" target="_blank" rel="noopener">사용설명서</a>를 먼저 읽어 보세요.</p></div></div>`;

function renderGate() {
  const el = $('#gate');
  if (ui.phase === 'noconfig') {
    el.innerHTML = card('Firebase 연결이 필요해요', `<div class="setup"><p class="help">사이트 파일은 올라갔지만 아직 Firebase 프로젝트와 연결되지 않았어요. SETUP.md(설치 안내)의 순서대로 진행해 주세요.</p>
      <ol><li><code>js/config.js</code>에 Firebase 웹 앱 설정값 붙여 넣기</li><li>Authentication에서 Google 로그인 켜기, 승인된 도메인에 GitHub Pages 주소 추가</li>
      <li>Firestore 데이터베이스 만들고 <code>firestore.rules</code> 내용 게시</li><li><code>config.js</code>와 규칙 파일에 관리자 이메일 적기</li></ol></div>`);
    return;
  }
  if (ui.phase === 'boot' || ui.phase === 'checking' || (ui.phase === 'ready' && !S.metaLoaded)) {
    el.innerHTML = card('불러오는 중…', '<p class="help">계정과 데이터를 확인하고 있어요.</p>'); return;
  }
  if (ui.phase === 'signin') {
    el.innerHTML = card('구글 계정으로 로그인해 주세요', `<p class="help">이 지도는 구글로 로그인하고 관리자에게 승인받은 선생님만 보고 쓸 수 있어요.</p>
      <div><button class="btn google" data-act="login">${G_LOGO} Google로 로그인</button></div>${ui.reqErr ? `<p class="help" style="color:var(--danger)">${esc(ui.reqErr)}</p>` : ''}`);
    return;
  }
  if (ui.phase === 'gate') {
    const sent = !!S.myReq;
    el.innerHTML = card('사용 승인이 필요해요', `<p class="help"><b>${esc(myEmail())}</b> 계정은 아직 승인 목록에 없어요. 요청을 보내면 관리자가 ‘설정·사용자’ 화면에서 승인할 수 있고, 승인되면 이 화면이 저절로 열려요.</p>
      ${sent ? '<p class="help"><span class="pill loan">요청 보냄</span> 관리자의 승인을 기다리고 있어요.</p>' : ''}
      ${ui.reqErr ? `<p class="help" style="color:var(--danger)">${esc(ui.reqErr)}</p>` : ''}
      <div class="sizes"><button class="btn" data-act="requestAccess" ${sent ? 'disabled' : ''}>${sent ? '요청 완료' : '사용 요청 보내기'}</button>${sent ? '<button class="btn ghost" data-act="cancelRequest">요청 취소</button>' : ''}<button class="btn ghost" data-act="logout">다른 계정으로 로그인</button></div>`);
    return;
  }
  if (ui.phase === 'ready' && !S.meta) {
    if (!isManager()) { el.innerHTML = card('아직 준비 중이에요', '<p class="help">관리자가 아직 지도를 만들지 않았어요. 잠시 뒤 다시 열어 주세요.</p>'); return; }
    el.innerHTML = card('지도 시작하기', `<p class="help">데이터베이스가 비어 있어요. 어떻게 시작할지 고르세요.</p>
      <div class="sizes"><button class="btn" data-act="startSample">예시 데이터로 시작</button><button class="btn ghost" data-act="startEmpty">빈 지도로 시작</button></div>
      <p class="help">Claude에서 쓰던 지도의 ‘데이터 복사’ 내용이 있으면 아래에 붙여 넣고 불러오세요.</p>
      <textarea id="io-in" placeholder="백업해 둔 데이터를 여기에 붙여 넣으세요" aria-label="불러올 데이터"></textarea><div><button class="btn ghost" data-act="importJson">불러오기</button></div>`);
  }
}

function renderRoom() {
  const el = $('#v-room'), R = M().room, q = ui.q.trim(), L = layoutLocked();
  const U = ui.U = Math.max(24, Math.floor((el.clientWidth - 12) / R.w));
  let h = clipBar('room') + `<div class="toolbar"><button class="btn" data-act="addCab">＋ ${T('cab')}</button>
    <button class="btn ghost" data-act="addFurn" data-type="bench">＋ ${T('bench')}</button>
    <button class="btn ghost" data-act="addFurn" data-type="desk">＋ ${T('desk')}</button>
    <button class="btn ghost" data-act="addFurn" data-type="sink">＋ ${T('sink')}</button>
    <button class="btn ghost" data-act="fmultiToggle" aria-pressed="${ui.fmulti}">${SEL_SVG} ${ui.fmulti ? '고르는 중' : '여러 개 고르기'}</button>
    <button class="btn ghost" data-act="toggleLayoutLock" aria-pressed="${L}">${LOCK_SVG} ${L ? '배치 잠금 켜짐' : '배치 전체 잠그기'}</button>
    <span class="hint">${ui.fmulti ? `함께 옮길 ${j(T('cab'), '과/와')} 가구를 차례로 누르세요.` : `${L ? '잠금 중에는 옮길 수 없어요. ' : '끌어서 옮기고, '}${j(T('cab'), '을/를')} 누르면 조립 화면이 열려요.`}</span></div>`;
  const items = floorItems(); ui.fsel = ui.fsel.filter(k => items.some(x => x.k === k));
  if (ui.fmulti || ui.fsel.length) {
    const picked = items.filter(x => ui.fsel.includes(x.k)), g0 = picked[0] && picked[0].o.group;
    const same = picked.length > 1 && g0 && picked.every(x => x.o.group === g0) && floorGroup(g0).length === picked.length;
    h += `<div class="toolbar fbar"><b>${picked.length}개 골랐어요</b>
      ${picked.map(x => `<span class="chip">${esc(x.cab ? x.o.name : x.o.label)}</span>`).join('')}
      <button class="btn sm" data-act="groupFloor" ${picked.length > 1 && !same ? '' : 'disabled'}>${LINK_SVG} 묶기</button>
      ${picked.some(x => floorGrouped(x.o)) ? '<button class="btn ghost sm" data-act="ungroupFloor">묶음 풀기</button>' : ''}
      <button class="btn ghost sm" data-act="fmultiDone">고르기 끝내기</button>
      <span class="hint">고른 것 중 하나를 끌면 함께 옮겨져요. 묶어 두면 고르지 않아도 함께 움직여요.</span></div>`;
  }
  const selF = M().furniture.find(x => x.id === ui.furn), selGroup = selF && floorGrouped(selF) ? selF.group : '';
  const fcls = (k, o) => `${ui.fsel.includes(k) ? 'picked' : ''} ${selGroup && o.group === selGroup && o !== selF ? 'gsel' : ''}`;
  const gtag = o => floorGrouped(o) ? `<b class="ftag" title="묶음 ${floorGroupNo(o.group)}">${LINK_SVG}${floorGroupNo(o.group)}</b>` : '';
  const f = selF;
  if (f) {
    h += `<div class="toolbar"><input id="furn-label" class="field" style="padding:6px 8px;font-size:13px" data-ch="furnLabel" value="${esc(f.label)}" aria-label="이름">
    <span class="stepper"><span>가로</span><button data-act="furnSize" data-k="w" data-d="-0.5" aria-label="가로 줄이기">−</button><input class="stepnum" id="furn-w" type="number" inputmode="decimal" min="1" max="48" step="0.5" value="${f.w}" data-ch="stepSet" data-a="furnSize" data-k="w" data-cur="${f.w}" aria-label="가로 (숫자 입력)"><button data-act="furnSize" data-k="w" data-d="0.5" aria-label="가로 늘이기">＋</button></span>
    <span class="stepper"><span>세로</span><button data-act="furnSize" data-k="h" data-d="-0.5" aria-label="세로 줄이기">−</button><input class="stepnum" id="furn-h" type="number" inputmode="decimal" min="1" max="48" step="0.5" value="${f.h}" data-ch="stepSet" data-a="furnSize" data-k="h" data-cur="${f.h}" aria-label="세로 (숫자 입력)"><button data-act="furnSize" data-k="h" data-d="0.5" aria-label="세로 늘이기">＋</button></span>
    <button class="btn ghost sm" data-act="furnLock" aria-pressed="${!!f.locked}">${LOCK_SVG} ${f.locked ? '잠김' : '위치 잠그기'}</button>
    ${floorGrouped(f) ? `<span class="grprow sm">${LINK_SVG}<span><b>묶음 ${floorGroupNo(f.group)}</b> · ${floorGroup(f.group).length}개가 함께 움직여요</span><button class="btn ghost sm" data-act="ungroupFloor" data-id="${f.group}">묶음 풀기</button></span>` : ''}
    <button class="btn danger sm" data-act="furnDel">삭제</button><button class="btn ghost sm" data-act="furnClose">닫기</button></div>`;
  }
  h += elsewhere(q);
  h += `<div class="floor-scroll"><div class="floor" style="width:${R.w * U}px;height:${R.h * U}px;--u:${U}px">`;
  M().furniture.forEach(f => {
    const lk = L || f.locked;
    h += `<div class="furn ${f.type} ${ui.furn === f.id ? 'sel' : ''} ${fcls('f:' + f.id, f)} ${q ? 'dim' : ''} ${lk ? 'locked' : ''}" data-drag="furn" data-id="${f.id}" style="left:${f.x * U}px;top:${f.y * U}px;width:${f.w * U}px;height:${f.h * U}px">${f.locked ? LOCK_SVG : ''}${esc(f.label)}${gtag(f)}</div>`;
  });
  cabList().forEach(cab => {
    const ft = cabFoot(cab), m = q ? matchCount(cab, q) : 0, w = conflicts(cab).length, lk = L || cab.locked;
    const iw = ft.w * U - 8, ih = ft.h * U - 29;
    h += `<div class="cabcard ${fcls('c:' + cab.id, cab)} ${q && !m ? 'dim' : ''} ${m ? 'hit' : ''} ${lk ? 'locked' : ''}" data-drag="cab" data-id="${cab.id}" style="left:${cab.x * U}px;top:${cab.y * U}px;width:${ft.w * U}px;height:${ft.h * U}px">
      <div class="cabname">${cab.locked ? LOCK_SVG : ''}<span>${esc(cab.name)}</span>${gtag(cab)}${m ? `<b class="hitn">${m}</b>` : ''}${w ? '<i class="warnmark" title="보관 경고">!</i>' : ''}</div>
      <div class="mini">${cab.blocks.map(b => {
        const c = cat(b.cat), bw = b.w / cab.cols * iw, bh = b.h / cab.rows * ih;
        const N = shelvesOf(b), tip = N > 1 ? `${b.label}\n${shelfOrder(N).map(n => `${n}단: ${b.items.filter(i => shelfNo(b, i) === n).map(i => i.name).join(', ') || '비어 있음'}`).join('\n')}` : `${b.label} — ${b.items.map(i => i.name).join(', ') || '비어 있음'}`;
        return `<span class="${q && !blockMatch(b, q, roomOf(cab)) ? 'fade' : ''}" title="${esc(tip)}" style="left:${b.c / cab.cols * 100}%;top:${b.r / cab.rows * 100}%;width:${b.w / cab.cols * 100}%;height:${b.h / cab.rows * 100}%;background-color:${c.color};color:${ink(c.color)}${N > 1 ? `;--sh:${N}` : ''}" ${N > 1 ? 'data-sh' : ''}>${bw >= 26 && bh >= 14 ? `<em>${esc(b.label)}</em>` : ''}${bw >= 40 && bh >= 32 ? `<small>${b.items.length}종</small>` : ''}</span>`;
      }).join('')}</div></div>`;
  });
  const meters = Math.max(1, Math.min(4, Math.floor(R.w / 2 / 3)));
  h += `</div></div><div class="drawfoot">
    <div class="scalebar" style="--m:${2 * U}px" aria-label="축척 막대: 한 칸 1 m"><div class="sb">${'<i></i>'.repeat(meters)}</div><div class="sbl">${Array.from({ length: meters + 1 }, (_, i) => `<span>${i}${i === meters ? ' m' : ''}</span>`).join('')}</div></div>
    <div class="titleblock"><div class="tb-name">${esc(M().roomName)}</div><div class="tb-cells"><span><i>축척</i>격자 1칸 = 50 cm</span><span><i>바닥</i>${R.w / 2} × ${R.h / 2} m</span><span><i>${T('cab')}</i>${cabList().length}개</span></div></div></div>`;
  const used = new Set(); cabList().forEach(c => c.blocks.forEach(b => used.add(b.cat)));
  h += `<div class="legend">${[...used].map(id => cat(id)).filter((c, i, a) => c.id && a.indexOf(c) === i).map(c => `<span><i class="sw" style="background:${c.color}"></i>${esc(c.name)}</span>`).join('')}<span class="hint">블록에 마우스를 올리면 들어 있는 물품이 보여요.</span></div>`;
  el.innerHTML = h;
}

export function confirmBtn(act, id, label, armed) { const on = ui.confirm === act + ':' + id; return `<button class="btn danger sm ${on ? 'arm' : ''}" data-act="${act}" data-id="${esc(id)}">${on ? armed : label}</button>`; }

function renderCab() {
  const el = $('#v-cab'); const list = cabList();
  if (!list.length) { el.innerHTML = `<div class="panel" style="max-width:480px"><h3>아직 ${j(T('cab'), '이/가')} 없어요</h3><p class="help">${j(T('cab'), '을/를')} 하나 만들고, 빈 칸을 눌러 블록을 붙여 보세요.</p><div><button class="btn" data-act="addCab">＋ ${T('cab')} 만들기</button></div></div>`; return; }
  if (!findCab(ui.cab)) ui.cab = list[0].id;
  const cab = findCab(ui.cab), q = ui.q.trim(), conf = conflicts(cab), cids = new Set(conf.flatMap(c => c.ids));
  if (ui.block && !cab.blocks.find(b => b.id === ui.block)) ui.block = null;
  ui.sel = ui.sel.filter(id => cab.blocks.some(b => b.id === id));
  const selB = cab.blocks.find(b => b.id === ui.block), selGroup = selB && isGrouped(cab, selB) ? selB.group : '';
  const wide = el.clientWidth >= 880, avail = (wide ? el.clientWidth - 370 : el.clientWidth) - 30;
  // 칸이 많으면 칸을 조금 더 작게(최소 40px) 그리고, 넘치면 옆으로 밀어서 봐요
  const S2 = ui.S = clamp(Math.floor(avail / cab.cols), Math.max(cab.cols, cab.rows) > 8 ? 40 : 52, 120);
  const shrinkC = cab.blocks.every(b => b.c + b.w <= cab.cols - 1) && cab.cols > 1, shrinkR = cab.blocks.every(b => b.r + b.h <= cab.rows - 1) && cab.rows > 1;
  let h = `<div class="picker">${list.map(c => `<button class="chip" data-act="pickCab" data-id="${c.id}" aria-pressed="${c.id === cab.id}">${c.locked ? LOCK_SVG : ''}${esc(c.name)}${conflicts(c).length ? '<i class="warnmark">!</i>' : ''}</button>`).join('')}<button class="chip" data-act="addCab">＋ 새 ${T('cab')}</button></div>
  <div class="cabwrap"><div style="min-width:0">
  <div class="cabhead"><input id="cab-name" class="name" data-ch="cabName" value="${esc(cab.name)}" aria-label="${T('cab')} 이름">
   <span class="stepper"><span>가로 칸</span><button data-act="cabSize" data-k="cols" data-d="-1" ${shrinkC ? '' : 'disabled'} aria-label="가로 칸 줄이기">−</button><input class="stepnum" id="cab-cols" type="number" inputmode="decimal" min="1" max="20" step="1" value="${cab.cols}" data-ch="stepSet" data-a="cabSize" data-k="cols" data-cur="${cab.cols}" aria-label="가로 칸 (숫자 입력)"><button data-act="cabSize" data-k="cols" data-d="1" ${cab.cols >= MAX_CELLS ? 'disabled' : ''} aria-label="가로 칸 늘이기">＋</button></span>
   <span class="stepper"><span>세로 칸</span><button data-act="cabSize" data-k="rows" data-d="-1" ${shrinkR ? '' : 'disabled'} aria-label="세로 칸 줄이기">−</button><input class="stepnum" id="cab-rows" type="number" inputmode="decimal" min="1" max="20" step="1" value="${cab.rows}" data-ch="stepSet" data-a="cabSize" data-k="rows" data-cur="${cab.rows}" aria-label="세로 칸 (숫자 입력)"><button data-act="cabSize" data-k="rows" data-d="1" ${cab.rows >= MAX_CELLS ? 'disabled' : ''} aria-label="세로 칸 늘이기">＋</button></span>
   <button class="btn ghost sm" data-act="multiToggle" aria-pressed="${ui.multi}">${SEL_SVG} ${ui.multi ? '고르는 중' : '여러 블록 고르기'}</button>
   ${(() => { const ft = cabFoot(cab); return `<span class="stepper" title="배치도에서 차지하는 크기 (격자 1칸 = 50 cm)"><span>배치도 가로</span><button data-act="cabFloor" data-k="w" data-d="-0.5" aria-label="배치도 가로 줄이기">−</button><input class="stepnum" id="cab-fw" type="number" inputmode="decimal" min="2" step="0.5" value="${ft.w}" data-ch="stepSet" data-a="cabFloor" data-k="w" data-cur="${ft.w}" aria-label="배치도 가로 (숫자 입력)"><button data-act="cabFloor" data-k="w" data-d="0.5" aria-label="배치도 가로 늘이기">＋</button></span>
   <span class="stepper" title="배치도에서 차지하는 크기 (격자 1칸 = 50 cm)"><span>세로</span><button data-act="cabFloor" data-k="h" data-d="-0.5" aria-label="배치도 세로 줄이기">−</button><input class="stepnum" id="cab-fh" type="number" inputmode="decimal" min="2" step="0.5" value="${ft.h}" data-ch="stepSet" data-a="cabFloor" data-k="h" data-cur="${ft.h}" aria-label="배치도 세로 (숫자 입력)"><button data-act="cabFloor" data-k="h" data-d="0.5" aria-label="배치도 세로 늘이기">＋</button></span>${cab.fw ? '<button class="linkbtn" data-act="cabFloorAuto">칸 수에 맞추기</button>' : ''}`; })()}
   <button class="btn ghost sm" data-act="cabLock" aria-pressed="${!!cab.locked}">${LOCK_SVG} ${cab.locked ? '배치도 위치 잠김' : '배치도 위치 잠그기'}</button>
   ${rooms().length > 1 ? `<label class="minl movesel">놓인 곳<select id="cab-room" class="field" data-ch="cabRoom">${rooms().map(r => `<option value="${r.id}" ${r.id === roomOf(cab) ? 'selected' : ''}>${esc(r.roomName)}</option>`).join('')}</select></label>` : ''}
   <button class="btn ghost sm" data-act="copyCab">${COPY_SVG} ${T('cab')} 복사</button>
   ${confirmBtn('cabDel', cab.id, `${T('cab')} 삭제`, '한 번 더 누르면 삭제')}</div>
  ${clipBar('cab')}${elsewhere(q)}
  <div class="stage"><div class="cabinet"><div class="plate">${esc(cab.name)}</div>
   <div class="cab-inner" style="width:${cab.cols * S2}px;height:${cab.rows * S2}px;background-size:100% ${S2}px">`;
  const occ = new Set(); cab.blocks.forEach(b => { for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) occ.add(r + ',' + c); });
  for (let r = 0; r < cab.rows; r++) for (let c = 0; c < cab.cols; c++) if (!occ.has(r + ',' + c))
    h += ui.clip && ui.clip.type === 'blocks' ? `<button class="slot paste" data-act="pasteBlocksAt" data-c="${c}" data-r="${r}" aria-label="위에서 ${r + 1}번째 줄, 왼쪽에서 ${c + 1}번째 칸에 붙여넣기" title="여기에 붙여넣기" style="left:${c * S2 + 4}px;top:${r * S2 + 4}px;width:${S2 - 8}px;height:${S2 - 8}px">${PASTE_SVG}</button>` : `<button class="slot" data-act="addBlock" data-c="${c}" data-r="${r}" aria-label="위에서 ${r + 1}번째 줄, 왼쪽에서 ${c + 1}번째 칸에 블록 붙이기" style="left:${c * S2 + 4}px;top:${r * S2 + 4}px;width:${S2 - 8}px;height:${S2 - 8}px">＋</button>`;
  cab.blocks.forEach(b => {
    const c = cat(b.cat), hz = [...hazardsOf(b)].map(x => HZ[x]).join('·'); let low = 0, ex = 0;
    b.items.forEach(it => { const s = itemStatus(it); if (s.includes('low')) low++; if (s.includes('expired') || s.includes('soon')) ex++; });
    const hit = q && blockMatch(b, q, roomOf(cab)), room = Math.max(0, Math.floor((b.h * S2 - 62) / 16)), N = shelvesOf(b);
    const grouped = isGrouped(cab, b), picked = ui.sel.includes(b.id);
    h += `<div class="block ${ui.block === b.id ? 'sel' : ''} ${picked ? 'picked' : ''} ${grouped && b.group === selGroup && ui.block !== b.id ? 'gsel' : ''} ${cids.has(b.id) ? 'conf' : ''} ${q ? (hit ? 'hit' : 'fade') : ''}" data-drag="block" data-id="${b.id}" role="button" tabindex="0" aria-label="${esc(b.label)} 블록" style="left:${b.c * S2 + 3}px;top:${b.r * S2 + 3}px;width:${b.w * S2 - 6}px;height:${b.h * S2 - 6}px;background:${c.color};color:${ink(c.color)}">
      <div class="bl">${esc(b.label)}</div><div class="bm">${b.items.length}종${N > 1 ? ` · ${N}단` : ''}${hz && safetyOn() ? ' · ' + hz : ''}</div>
      ${N > 1 ? `<div class="shelves" style="--sh:${N}">${shelfOrder(N).map(n => { const names = b.items.filter(i => shelfNo(b, i) === n).map(i => i.name); return `<div class="shelf"><i>${n}</i><span>${esc(names.join(', '))}</span></div>`; }).join('')}</div>` : b.items.slice(0, room).map(it => `<div class="bn">${esc(it.name)}</div>`).join('')}
      ${picked ? '<i class="pickmark" aria-hidden="true">✓</i>' : ''}
      <div class="flags ${N > 1 ? 'abs' : ''}">${grouped ? `<span class="f grp">${LINK_SVG}묶음 ${groupNo(cab, b.group)}</span>` : ''}${low ? `<span class="f low">부족 ${low}</span>` : ''}${ex ? `<span class="f exp">기한 ${ex}</span>` : ''}${cids.has(b.id) ? '<span class="f cf">보관 주의</span>' : ''}</div></div>`;
  });
  h += `</div></div></div>`;
  if (conf.length) h += `<div class="warns" id="warns">${conf.map(c => `<div class="warn-row"><b>!</b><span><b>${esc(c.where)}</b> — ${esc(c.msg)}</span></div>`).join('')}</div>`;
  h += `</div>${ui.multi || ui.sel.length ? multiPanel(cab) : ui.block ? blockPanel(cab, cab.blocks.find(b => b.id === ui.block)) : idlePanel()}</div>`;
  el.innerHTML = h;
}
/* 여러 블록 고르기 패널: 고른 블록을 묶거나 함께 옮겨요 */
function multiPanel(cab) {
  const picked = cab.blocks.filter(b => ui.sel.includes(b.id));
  const sameGroup = picked.length > 1 && picked[0].group && picked.every(b => b.group === picked[0].group) && groupOf(cab, picked[0]).length === picked.length;
  const anyGrouped = picked.some(b => isGrouped(cab, b));
  return `<aside class="panel"><h3>블록 ${picked.length}개 골랐어요</h3>
  <p class="help">블록을 누를 때마다 고르거나 빼요. 고른 블록 중 하나를 끌면 함께 옮겨져요.${picked.length < 2 ? ' 묶으려면 2개 이상 골라 주세요.' : ''}</p>
  ${picked.length ? `<div class="chips">${picked.map(b => `<span class="chip"><i class="sw" style="background:${cat(b.cat).color}"></i>${esc(b.label)}</span>`).join('')}</div>` : ''}
  <div class="sizes">
    <button class="btn" data-act="groupSel" ${picked.length > 1 && !sameGroup ? '' : 'disabled'}>${LINK_SVG} 묶기</button>
    ${anyGrouped ? `<button class="btn ghost" data-act="ungroupSel">묶음 풀기</button>` : ''}
    <button class="btn ghost" data-act="copyBlocks" ${picked.length ? '' : 'disabled'}>${COPY_SVG} 복사</button>
    <button class="btn ghost" data-act="multiDone">고르기 끝내기</button>
  </div>
  <p class="help" style="font-size:12px">묶은 블록은 고르기를 끝낸 뒤에도 하나를 끌면 함께 움직여요. 컴퓨터에서는 Shift 키를 누른 채 블록을 눌러도 여러 개를 고를 수 있어요.</p></aside>`;
}
function idlePanel() {
  return `<aside class="panel"><h3>블록 붙이기</h3><div class="lbl">새 블록의 분류</div>
  <div class="chips">${M().categories.map(c => `<button class="chip" data-act="newCat" data-id="${c.id}" aria-pressed="${ui.newCat === c.id}"><i class="sw" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>
  <ul class="help"><li>점선 <b>＋</b> 칸을 누르면 위 분류 색의 블록이 붙어요.</li><li>블록을 끌면 다른 빈 칸으로 옮겨져요.</li><li>블록을 누르면 크기·색·물품·QR을 다룰 수 있어요.</li>${safetyOn() ? `<li>산·염기, 산화제·인화성처럼 같이 두면 안 되는 물질이 같은 블록에 있거나 맞닿으면 경고해요. GHS 인화성·산화성·급성 독성 표시도 검사에 쓰여요.</li>` : ''}</ul></aside>`;
}
function blockPanel(cab, b) {
  const c = cat(b.cat), can = (dw, dh) => canPlace(cab, b, b.c, b.r, b.w + dw, b.h + dh), qr = qrSvg(blockUrl(b.id)), N = shelvesOf(b);
  return `<aside class="panel" id="blockPanel">
  <div class="ph"><i class="sw" style="background:${c.color};width:18px;height:18px"></i><input id="blk-label" data-ch="blkLabel" value="${esc(b.label)}" aria-label="블록 이름"><button class="x" data-act="closeBlk" aria-label="닫기">×</button></div>
  <div class="lbl">분류 · 블록 색</div>
  <div class="chips">${M().categories.map(x => `<button class="chip" data-act="blkCat" data-id="${x.id}" aria-pressed="${b.cat === x.id}"><i class="sw" style="background:${x.color}"></i>${esc(x.name)}</button>`).join('')}</div>
  ${isGrouped(cab, b) ? `<div class="grprow">${LINK_SVG}<span><b>묶음 ${groupNo(cab, b.group)}</b> · 블록 ${groupOf(cab, b).length}개가 함께 움직여요</span><button class="btn ghost sm" data-act="ungroup" data-id="${b.group}">묶음 풀기</button></div>` : ''}
  <div class="lbl">크기 (칸)</div>
  <div class="sizes"><span class="stepper"><span>가로</span><button data-act="blkSize" data-k="w" data-d="-1" ${b.w > 1 ? '' : 'disabled'} aria-label="가로 줄이기">−</button><input class="stepnum" id="blk-w" type="number" inputmode="decimal" min="1" max="20" step="1" value="${b.w}" data-ch="stepSet" data-a="blkSize" data-k="w" data-cur="${b.w}" aria-label="블록 가로 (숫자 입력)"><button data-act="blkSize" data-k="w" data-d="1" ${can(1, 0) ? '' : 'disabled'} aria-label="가로 늘이기">＋</button></span>
  <span class="stepper"><span>세로</span><button data-act="blkSize" data-k="h" data-d="-1" ${b.h > 1 ? '' : 'disabled'} aria-label="세로 줄이기">−</button><input class="stepnum" id="blk-h" type="number" inputmode="decimal" min="1" max="20" step="1" value="${b.h}" data-ch="stepSet" data-a="blkSize" data-k="h" data-cur="${b.h}" aria-label="블록 세로 (숫자 입력)"><button data-act="blkSize" data-k="h" data-d="1" ${can(0, 1) ? '' : 'disabled'} aria-label="세로 늘이기">＋</button></span>
  <span class="stepper"><span>칸 안의 단</span><button data-act="blkShelves" data-d="-1" ${N > 1 ? '' : 'disabled'} aria-label="단 줄이기">−</button><input class="stepnum" id="blk-sh" type="number" inputmode="decimal" min="1" max="4" step="1" value="${N}" data-ch="stepSet" data-a="blkShelves" data-cur="${N}" aria-label="칸 안의 단 (숫자 입력)"><button data-act="blkShelves" data-d="1" ${N < MAX_SHELVES ? '' : 'disabled'} aria-label="단 늘리기">＋</button></span></div>
  ${N > 1 ? '<p class="help" style="font-size:12px">단은 맨 아래가 1단이에요.</p>' : ''}
  <div class="lbl"><span>물품 ${b.items.length}종</span><span>최소 수량 아래면 ‘부족’</span></div>
  ${N > 1 ? shelfOrder(N).map(n => { const its = b.items.filter(i => shelfNo(b, i) === n); return `<div class="shelfgrp"><div class="shelfhead"><b>${shelfName(n, N)}</b><span>${its.length}종</span></div><div class="items">${its.map(it => itemCard(it, b)).join('') || '<p class="help">비어 있어요.</p>'}</div></div>`; }).join('')
    : `<div class="items">${b.items.map(it => itemCard(it, b)).join('') || '<p class="help">아직 물품이 없어요.</p>'}</div>`}
  <div class="addrow">${N > 1 ? `<select id="new-shelf" class="field" aria-label="넣을 단">${shelfOrder(N).map(n => `<option value="${n}" ${Math.min(ui.newShelf || 1, N) === n ? 'selected' : ''}>${n}단</option>`).join('')}</select>` : ''}<input id="new-item" placeholder="물품 이름 (예: 염산 1 M)" aria-label="새 물품 이름"><button class="btn" data-act="addItem">추가</button></div>
  ${qr ? `<div class="lbl">이 칸의 QR</div><div class="qrbox"><div class="qr">${qr}</div><p class="help">휴대폰으로 찍으면 이 블록이 바로 열려요. 승인된 선생님만 내용을 볼 수 있어요.</p></div>` : ''}
  <div class="sizes"><button class="btn ghost sm" data-act="copyBlocks" data-id="${b.id}">${COPY_SVG} 블록 복사</button>${confirmBtn('delBlock', b.id, '블록 삭제', b.items.length ? `물품 ${b.items.length}종도 지워져요 · 한 번 더` : '한 번 더 누르면 삭제')}</div></aside>`;
}
export const ghsMarks = list => !safetyOn() ? '' : (list || []).map(g => GHS[g] ? `<span class="ghs" title="${g} ${GHS[g][1]}"><b>${GHS[g][0]}</b></span>` : '').join('');
function itemCard(it, b) {
  const s = itemStatus(it), open = ui.openItem === it.id, lq = loanedQty(it.id);
  return `<div class="item ${s.map(x => 'st-' + x).join(' ')}">
   <div class="r1">${it.photoAt ? `<button class="thumb" data-act="openPhoto" data-id="${it.id}" aria-label="${esc(it.name)} 사진 크게 보기">${photoImg(it)}</button>` : ''}<input id="it-${it.id}-name" data-ch="itName" data-id="${it.id}" value="${esc(it.name)}" aria-label="물품 이름"><button class="x" data-act="delItem" data-id="${it.id}" aria-label="물품 삭제">×</button></div>
   <div class="r2"><span class="qty"><button data-act="qty" data-id="${it.id}" data-d="-1" aria-label="수량 빼기">−</button><input id="it-${it.id}-qty" type="number" min="0" data-ch="itQty" data-id="${it.id}" value="${esc(it.qty)}" aria-label="수량"><button data-act="qty" data-id="${it.id}" data-d="1" aria-label="수량 더하기">＋</button></span>
   <input id="it-${it.id}-unit" class="field unit" data-ch="itUnit" data-id="${it.id}" value="${esc(it.unit)}" placeholder="단위" aria-label="단위">
   <label class="minl">최소<input id="it-${it.id}-min" class="field" type="number" min="0" data-ch="itMin" data-id="${it.id}" value="${esc(it.min)}"></label></div>
   <div class="r2"><label class="minl">유효기한<input id="it-${it.id}-exp" class="field" type="date" data-ch="itExp" data-id="${it.id}" value="${esc(it.expiry)}"></label>
   ${shelvesOf(b) > 1 ? `<select id="it-${it.id}-shelf" class="field" data-ch="itShelf" data-id="${it.id}" aria-label="놓인 단">${shelfOrder(shelvesOf(b)).map(n => `<option value="${n}" ${shelfNo(b, it) === n ? 'selected' : ''}>${n}단</option>`).join('')}</select>` : ''}
   <select id="it-${it.id}-cat" class="field" data-ch="itCat" data-id="${it.id}" aria-label="물품 분류"><option value="">블록 분류와 같음</option>${M().categories.map(c => `<option value="${c.id}" ${it.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
   <div class="r2">${ghsMarks(it.ghs)}${pills(it, s)}${lq ? `<span class="pill loan">대여 중 ${lq}</span>` : ''}
     <span style="margin-left:auto;display:inline-flex;gap:10px">${safetyOn() ? `<button class="linkbtn" data-act="toggleSafety" data-id="${it.id}">${open ? '안전 정보 닫기' : '안전 정보'}</button>` : ''}<label class="linkbtn" for="ph-${it.id}">${it.photoAt ? '사진 바꾸기' : '사진 넣기'}</label><input id="ph-${it.id}" type="file" accept="image/*" data-photo-up="${it.id}" hidden><button class="linkbtn" data-act="loanThis" data-id="${it.id}">대여</button></span></div>
   ${open ? `<div class="safety"><label class="minl" style="width:100%">CAS 번호<input id="it-${it.id}-cas" class="field" data-ch="itCas" data-id="${it.id}" value="${esc(it.cas)}" placeholder="예: 7647-01-0"></label>
     <label class="minl" style="width:100%">MSDS 주소<input id="it-${it.id}-msds" class="field" type="url" data-ch="itMsds" data-id="${it.id}" value="${esc(it.msds)}" placeholder="https://…"></label>
     <div class="help" style="font-size:12px">${it.msds ? `<a href="${esc(it.msds)}" target="_blank" rel="noopener">MSDS 열기</a> · ` : ''}<a href="https://msds.kosha.or.kr/" target="_blank" rel="noopener">안전보건공단 MSDS 검색</a></div>
     <div class="lbl">GHS 그림문자</div><div class="ghsrow">${Object.entries(GHS).map(([k, [, f]]) => `<button class="ghsbtn" data-act="ghs" data-id="${it.id}" data-g="${k}" aria-pressed="${(it.ghs || []).includes(k)}" title="${k}">${f}</button>`).join('')}</div></div>` : ''}
  </div>`;
}
function pills(it, s) {
  return s.map(x => x === 'low' ? `<span class="pill low">부족 (최소 ${esc(it.min)})</span>` : x === 'expired' ? `<span class="pill expired">만료 · ${dday(it.expiry)}</span>` : `<span class="pill soon">기한 임박 · ${dday(it.expiry)}</span>`).join(' ');
}

function renderList() {
  const el = $('#v-list'), q = ui.q.trim(), all = allRows();
  const rows = all.filter(LIST_F[ui.filter][1]).filter(r => !q || itemMatch(r.it, r.b, q, r.rid));
  let h = `<div class="toolbar">${scopeChips()}${Object.entries(LIST_F).filter(([, f]) => safetyOn() || !f[2]).map(([k, [n, fn]]) => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${ui.filter === k}">${n} <span class="num">${all.filter(fn).length}</span></button>`).join('')}
   <button class="btn ghost sm" data-act="csvInventory">재고 목록 CSV 내려받기</button>${q ? `<span class="hint">‘${esc(q)}’ 검색 결과 ${rows.length}건</span>` : ''}</div>
  <div class="tablewrap"><table><thead><tr><th>물품</th><th>분류</th><th>위치</th><th>수량</th><th>유효기한</th><th>상태</th></tr></thead><tbody>`;
  h += rows.map(r => `<tr><td><span style="display:inline-flex;align-items:center;gap:8px">${r.it.photoAt ? `<button class="thumb sm" data-act="openPhoto" data-id="${r.it.id}" aria-label="사진 보기">${photoImg(r.it)}</button>` : ''}<b style="font-weight:500">${esc(r.it.name)}</b></span> ${ghsMarks(r.it.ghs)}</td>
    <td><span style="display:inline-flex;align-items:center;gap:6px"><i class="sw" style="background:${r.c.color}"></i>${esc(r.c.name)}</span></td>
    <td><button class="loc" data-act="goBlock" data-cab="${r.cab.id}" data-id="${r.b.id}">${roomPrefix(r.cab)}${esc(r.cab.name)} › ${esc(r.b.label)}${shelfTxt(r.b, r.it)}</button></td>
    <td><span class="qcell"><button data-act="qty" data-id="${r.it.id}" data-d="-1" aria-label="빼기">−</button><span class="num" style="min-width:2.4em;text-align:center">${esc(r.it.qty)}</span><button data-act="qty" data-id="${r.it.id}" data-d="1" aria-label="더하기">＋</button><span class="muted">${esc(r.it.unit)}</span></span></td>
    <td class="num">${r.it.expiry ? `${esc(r.it.expiry)} <span class="muted">${dday(r.it.expiry)}</span>` : '<span class="muted">—</span>'}</td>
    <td>${r.s.length ? pills(r.it, r.s) : ''}${r.lq ? ` <span class="pill loan">대여 중 ${r.lq}</span>` : ''}${!r.s.length && !r.lq ? '<span class="pill ok">정상</span>' : ''}</td></tr>`).join('');
  h += `</tbody></table>${rows.length ? '' : '<div class="empty">조건에 맞는 물품이 없어요.</div>'}</div>`;
  if (ui.scope !== 'all') h = h.replace('<div class="tablewrap">', elsewhere(q) + '<div class="tablewrap">');
  el.innerHTML = h;
}

function renderLoans() {
  const el = $('#v-loans'), today = ymd(TODAY), q = ui.q.trim();
  const due = new Date(TODAY); due.setDate(due.getDate() + 7);
  const open = openLoans().filter(l => inScope(loanRoom(l))).filter(l => !q || norm(l.itemName + l.who).includes(norm(q))).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
  const done = Object.values(S.loans).filter(l => l.returnedAt && inScope(loanRoom(l))).sort((a, b) => b.returnedAt - a.returnedAt).slice(0, 20);
  const opts = cabList().map(cab => `<optgroup label="${esc(cab.name)}">${cab.blocks.flatMap(b => b.items.map(it => `<option value="${it.id}" ${ui.loanItem === it.id ? 'selected' : ''}>${esc(b.label)}${shelfTxt(b, it)} › ${esc(it.name)} (보유 ${esc(it.qty)}${esc(it.unit)})</option>`)).join('')}</optgroup>`).join('');
  const where = l => { const { cab, b, it } = locate(l.itemId); return cab ? `<button class="loc" data-act="goBlock" data-cab="${cab.id}" data-id="${b.id}">${roomPrefix(cab)}${esc(cab.name)} › ${esc(b.label)}${shelfTxt(b, it)}</button>` : '<span class="muted">삭제된 물품</span>'; };
  el.innerHTML = `${scopeChips() ? `<div class="toolbar">${scopeChips()}</div>` : ''}<div class="panel"><h3>대여 기록하기 · ${esc(M().roomName)}</h3>
   <div class="formgrid"><label>물품<select id="loan-item" class="field"><option value="">물품을 고르세요</option>${opts}</select></label>
   <label>수량<input id="loan-qty" class="field" type="number" min="1" value="1"></label>
   <label>빌려간 곳<input id="loan-who" class="field" placeholder="예: 2학년 3반 4모둠, 과학 동아리"></label>
   <label>반납 예정일<input id="loan-due" class="field" type="date" value="${ymd(due)}"></label>
   <div><button class="btn" data-act="addLoan">대여 기록</button></div></div>
   <p class="help">대여해도 보유 수량은 그대로이고, 재고 목록과 블록에 ‘대여 중’으로 표시돼요. 반납하면 표시가 사라져요.</p></div>
  <h2 class="sec">대여 중 ${open.length}건</h2>
  <div class="tablewrap"><table><thead><tr><th>물품</th><th>위치</th><th>수량</th><th>빌려간 곳</th><th>대여일</th><th>반납 예정</th><th>기록</th><th></th></tr></thead><tbody>
  ${open.map(l => {
    const late = l.due && l.due < today; const d = late ? Math.round((TODAY - new Date(l.due + 'T00:00:00')) / 864e5) : 0;
    return `<tr><td>${esc(l.itemName)}</td><td>${where(l)}</td><td class="num">${esc(l.qty)}</td><td>${esc(l.who)}</td><td class="num">${esc(l.out)}</td>
    <td class="num">${l.due ? esc(l.due) : '—'} ${late ? `<span class="pill late">연체 ${d}일</span>` : ''}</td><td>${esc(pname(l.outBy, l.outByName) || '—')}</td>
    <td><button class="btn sm" data-act="returnLoan" data-id="${l.id}">반납</button></td></tr>`;
  }).join('')}
  </tbody></table>${open.length ? '' : '<div class="empty">지금 빌려 간 물품이 없어요.</div>'}</div>
  <h2 class="sec">최근 반납</h2>
  <div class="tablewrap"><table><thead><tr><th>물품</th><th>수량</th><th>빌려간 곳</th><th>대여일</th><th>반납일</th><th>반납 처리</th><th></th></tr></thead><tbody>
  ${done.map(l => `<tr><td>${esc(l.itemName)}</td><td class="num">${esc(l.qty)}</td><td>${esc(l.who)}</td><td class="num">${esc(l.out)}</td><td class="num">${ymd(new Date(l.returnedAt))}</td><td>${esc(pname(l.returnedBy, l.returnedByName) || '—')}</td><td>${confirmBtn('delLoan', l.id, '기록 삭제', '한 번 더')}</td></tr>`).join('')}
  </tbody></table>${done.length ? '' : '<div class="empty">반납 기록이 아직 없어요.</div>'}</div>`;
}

function renderStats() {
  const el = $('#v-stats'), years = new Set([String(new Date().getFullYear())]);
  Object.values(S.logs).forEach(d => d.month && years.add(String(d.month).slice(0, 4)));
  const rows = yearUsage(ui.year), max = Math.max(1, ...rows.map(r => r.used)), buy = rows.filter(r => r.buy > 0);
  el.innerHTML = `<div class="toolbar">${scopeChips()}${[...years].sort().reverse().map(y => `<button class="chip" data-act="pickYear" data-y="${y}" aria-pressed="${ui.year === y}">${y}년</button>`).join('')}
   ${buy.length ? '<button class="btn ghost sm" data-act="csvBuy">구입 목록 CSV 내려받기</button>' : ''}<span class="hint">수량을 줄이면 사용량, 늘리면 보충량으로 자동 기록돼요.</span></div>
  <div class="setgrid">
   <div class="panel"><h3>${ui.year}년 많이 쓴 물품</h3>
    ${rows.filter(r => r.used > 0).slice(0, 12).map(r => `<div><div class="lbl"><span style="color:var(--ink)">${esc(r.name)}</span><span class="num">${r.used}${esc(r.unit)}</span></div><div class="bar" style="width:${r.used / max * 100}%"></div></div>`).join('') || '<p class="help">아직 사용 기록이 없어요. 블록이나 재고 목록에서 수량을 −로 줄이면 여기에 쌓여요.</p>'}</div>
   <div class="panel"><h3>내년 구입 추천</h3><p class="help">한 해 쓴 만큼 다시 쓴다고 보고, 최소 수량을 지키려면 더 사야 하는 양이에요. (사용량 + 최소 수량 − 지금 수량)</p>
    ${buy.length ? `<div class="tablewrap"><table style="min-width:0"><thead><tr><th>물품</th><th>지금</th><th>사용</th><th>추천</th></tr></thead><tbody>${buy.map(r => `<tr><td>${esc(r.name)}<br><span class="muted" style="font-size:12px">${esc(r.where)}</span></td><td class="num">${r.qty}</td><td class="num">${r.used}</td><td class="num"><b>${r.buy}</b>${esc(r.unit)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="help">추천할 물품이 아직 없어요.</p>'}</div>
  </div>
  <h2 class="sec">${ui.year}년 전체 기록</h2>
  <div class="tablewrap"><table><thead><tr><th>물품</th><th>위치</th><th>사용량</th><th>보충량</th><th>대여 횟수</th><th>지금 수량</th></tr></thead><tbody>
   ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.where)}</td><td class="num">${r.used}</td><td class="num">${r.added}</td><td class="num">${r.loans}</td><td class="num">${r.qty}${esc(r.unit)}</td></tr>`).join('')}
  </tbody></table>${rows.length ? '' : '<div class="empty">이 해의 기록이 없어요.</div>'}</div>`;
}

const qrTargets = () => ui.qrCab === 'all' ? cabList() : cabList().filter(c => c.id === ui.qrCab);
function renderQr() {
  const el = $('#v-qr'), list = cabList(), ok = typeof qrcode === 'function';
  el.innerHTML = `<div class="toolbar"><button class="chip" data-act="qrCab" data-id="all" aria-pressed="${ui.qrCab === 'all'}">전체</button>${list.map(c => `<button class="chip" data-act="qrCab" data-id="${c.id}" aria-pressed="${ui.qrCab === c.id}">${esc(c.name)}</button>`).join('')}
   ${ok ? '<button class="btn" data-act="printLabels">라벨 인쇄</button><button class="btn ghost" data-act="saveLabels">라벨 파일 내려받기</button>' : ''}</div>
   <p class="help" style="margin-bottom:12px">A4 한 장에 3열로 인쇄돼요. 오려서 ${T('cab')} 각 칸에 붙이세요. 휴대폰으로 찍으면 로그인한 뒤 그 칸이 바로 열려요.${ok ? '' : ' QR 생성기를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.'}</p>
   <div class="labels">${qrTargets().flatMap(cab => cab.blocks.map(b => {
     const c = cat(b.cat);
     return `<div class="label" style="border-left-color:${c.color}"><div class="qr">${qrSvg(blockUrl(b.id))}</div>
     <div class="meta"><span class="muted">${esc(M().roomName)} › ${esc(cab.name)}</span><b>${esc(b.label)}</b><span class="muted">${esc(c.name)}</span>${labelItems(b, 4, 'div')}</div></div>`;
   })).join('') || '<p class="help">블록이 없어요.</p>'}</div>`;
}
export function labelsHtml(autoPrint) {
  const cards = qrTargets().flatMap(cab => cab.blocks.map(b => {
    const c = cat(b.cat); const g = [...new Set(b.items.flatMap(i => i.ghs || []))];
    return `<div class="lab" style="border-left-color:${c.color}"><div class="q">${qrSvg(blockUrl(b.id))}</div><div class="t"><small>${esc(M().roomName)} · ${esc(cab.name)} · ${esc(c.name)}</small><b>${esc(b.label)}</b>${labelItems(b, 6, 'p')}${g.length ? `<p class="g">GHS: ${g.map(x => GHS[x] ? GHS[x][1] : x).join(', ')}</p>` : ''}</div></div>`;
  })).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(siteTitle())} · ${esc(M().roomName)} QR 라벨</title><style>
@page{size:A4;margin:10mm}body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;margin:16px;color:#111}
.tip{font-size:13px;color:#555}@media print{.tip{display:none}body{margin:0}}
.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.lab{display:flex;gap:3mm;border:1px solid #999;border-left:5mm solid;border-radius:2mm;padding:2.5mm;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.q{width:24mm;flex:none}.q svg{width:100%;height:auto;display:block}
.t{min-width:0;font-size:9pt;line-height:1.3}.lshelf{margin:0}.lshelf b{display:inline;font-size:8pt;margin:0 1mm 0 0;color:#555}.t small{color:#555}.t b{display:block;font-size:12pt;margin:.5mm 0}.t p{margin:0}.g{color:#c00;margin-top:1mm!important}
</style></head><body><p class="tip">인쇄(Ctrl+P)해서 오려 붙이세요. ${esc(siteTitle())} · ${esc(M().roomName)} · ${ymd(new Date())} 기준</p><div class="sheet">${cards}</div>${autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},300)})<\/script>' : ''}</body></html>`;
}

function renderSet() {
  const el = $('#v-set'), use = {}, mgr = isManager(), myUid = S.auth.uid;
  cabList().forEach(c => c.blocks.forEach(b => { use[b.cat] = (use[b.cat] || 0) + 1; b.items.forEach(it => { if (it.cat) use[it.cat] = (use[it.cat] || 0) + 1; }); }));
  const members = Object.entries(S.members).sort((a, b) => String(a[1].name || a[1].email).localeCompare(b[1].name || b[1].email));
  const invites = Object.keys(S.invites).filter(em => !members.some(([, m]) => m.email === em));
  const person = (photo, name, email, right) => `<div class="person">${avatar(photo)}<span class="nm">${esc(name || email)}${name ? `<span class="em">${esc(email)}</span>` : ''}</span>${right}</div>`;
  el.innerHTML = `<div class="setgrid">
  <div class="panel"><h3>사용자 관리</h3>
   ${mgr ? `<p class="help">구글로 로그인해도 승인된 계정만 내용을 볼 수 있어요. 요청을 승인하거나, 이메일을 미리 등록해 두면 그 계정은 처음 로그인할 때 바로 열려요.</p>
   ${S.requests.length ? `<div class="lbl">사용 요청 ${S.requests.length}건</div>${S.requests.map(r => person(r.photo, r.name, r.email, `<button class="btn sm" data-act="approve" data-id="${r.id}">승인</button><button class="btn ghost sm" data-act="deny" data-id="${r.id}">거절</button>`)).join('')}` : '<p class="help">새 사용 요청이 없어요.</p>'}
   <div class="lbl">이메일로 미리 승인</div>
   <div class="addrow"><input id="invite-email" type="email" placeholder="teacher@school.kr" autocomplete="off" aria-label="미리 승인할 이메일"><button class="btn" data-act="invite">등록</button></div>
   ${invites.map(em => person('', '', em, `<span class="pill ok">첫 로그인 대기</span>${confirmBtn('uninvite', em, '취소', '한 번 더')}`)).join('')}
   <div class="lbl">승인된 사용자 ${members.length}명</div>
   ${members.map(([id, m]) => person(m.photo, m.name, m.email, id === myUid ? `<span class="role">${isCfgAdmin() ? '처음 관리자' : m.role === 'admin' ? '관리자' : '사용자'} · 나</span>` :
     `<select class="field" id="role-${id}" data-ch="memberRole" data-id="${id}" aria-label="역할"><option value="member" ${m.role !== 'admin' ? 'selected' : ''}>사용자</option><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>관리자</option></select>${confirmBtn('removeMember', id, '승인 취소', '한 번 더')}`)).join('') || '<p class="help">아직 승인된 사용자가 없어요.</p>'}`
   : `<p class="help">사용자 승인은 관리자만 할 수 있어요.</p>${members.map(([, m]) => person(m.photo, m.name, m.email, `<span class="pill ok">${m.role === 'admin' ? '관리자' : '사용자'}</span>`)).join('')}`}</div>
  <div class="panel"><h3>특별실 목록</h3>
    ${mgr ? `<label class="minl stack">사이트 큰 제목<input id="set-siteTitle" class="field" style="padding:7px 9px;font-size:13.5px" data-ch="siteTitle" value="${esc(siteTitle())}" placeholder="예: 해연중 특별실 지도"></label>` : `<p class="help">사이트 큰 제목: <b>${esc(siteTitle())}</b></p>`}
    <p class="help">로그인과 사용자 승인은 모든 특별실이 함께 써요. 특별실마다 배치도, ${T('cab')}, 분류, 부르는 이름을 따로 가져요.</p>
    <div>${rooms().map((r, i, list) => `<div class="roomrow ${r.id === curRoom().id ? 'cur' : ''}"><button class="door mini" data-act="pickRoom" data-id="${r.id}">${esc(r.roomName)}</button>
      <span class="muted">${(PRESETS[r.preset] || {}).label || '직접 고침'} · ${T('cab', r)} ${cabList(r.id).length}개</span>
      ${mgr ? `<span class="roomtools"><button class="btn ghost sm" data-act="moveRoom" data-id="${r.id}" data-d="-1" ${i ? '' : 'disabled'} aria-label="${esc(r.roomName)} 앞으로">↑</button><button class="btn ghost sm" data-act="moveRoom" data-id="${r.id}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="${esc(r.roomName)} 뒤로">↓</button>${list.length > 1 ? confirmBtn('delRoom', r.id, '지우기', '한 번 더 누르면 지워요') : ''}</span>` : ''}</div>`).join('')}</div>
    ${mgr ? `<div><button class="btn ghost" data-act="addRoomOpen">＋ 특별실 추가</button></div><p class="help">${T('cab')}이 남아 있는 특별실은 지울 수 없어요. 조립 화면의 ‘놓인 곳’에서 다른 특별실로 옮길 수 있어요.</p>` : '<p class="help">특별실 추가와 삭제는 관리자만 할 수 있어요.</p>'}</div>
  <div class="panel"><h3>${esc(M().roomName)} 설정</h3><p class="help">종류를 고르면 이 특별실에서 쓰는 이름이 한 번에 바뀌어요. 아래 칸에서 하나씩 고칠 수도 있어요.</p>
    <label class="minl stack">특별실 이름<input id="set-roomName" class="field" style="padding:7px 9px;font-size:13.5px" data-ch="roomName" value="${esc(M().roomName || '')}" placeholder="예: 1과학실, 무한상상실"></label>
    <div class="lbl">특별실 종류</div>
    <div class="chips">${Object.entries(PRESETS).map(([k, p]) => `<button class="chip" data-act="applyPreset" data-id="${k}" aria-pressed="${(M().preset || 'science') === k}">${p.label}</button>`).join('')}${M().preset === 'custom' ? '<span class="chip" aria-pressed="true">직접 고침</span>' : ''}</div>
    <div class="lbl">부르는 이름</div>
    <div class="formgrid">${Object.entries(TERM_LABELS).map(([k, l]) => `<label>${l}<input id="term-${k}" class="field" data-ch="term" data-id="${k}" value="${esc(T(k))}"></label>`).join('')}</div>
    <label class="minl" style="color:var(--ink);font-size:13px"><input id="set-safety" type="checkbox" data-ch="safetyOn" ${safetyOn() ? 'checked' : ''}> 약품 안전 기능 쓰기 (GHS·MSDS·위험 성질·보관 경고)</label>
    ${(PRESETS[M().preset] || {}).cats && PRESETS[M().preset].cats.length ? `<div><button class="btn ghost sm" data-act="addPresetCats">${PRESETS[M().preset].label} 추천 분류 더하기</button></div>` : ''}</div>
  <div class="panel"><h3>분류와 블록 색 · ${esc(M().roomName)}</h3><p class="help">색을 바꾸면 이 특별실의 모든 ${T('cab')} 블록 색이 함께 바뀌어요.${safetyOn() ? ' ‘위험 성질’은 보관 경고 검사에 쓰여요.' : ''}</p>
   ${M().categories.map(c => `<div class="catrow"><input type="color" id="cat-${c.id}-color" data-ch="catColor" data-id="${c.id}" value="${c.color}" aria-label="${esc(c.name)} 색">
    <input class="field" id="cat-${c.id}-name" data-ch="catName" data-id="${c.id}" value="${esc(c.name)}" aria-label="분류 이름">
    ${safetyOn() ? `<select class="field" id="cat-${c.id}-hz" data-ch="catHz" data-id="${c.id}" aria-label="위험 성질"><option value="">위험 성질 없음</option>${Object.entries(HZ).map(([k, v]) => `<option value="${k}" ${c.hazard === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : '<span></span>'}
    ${confirmBtn('catDel', c.id, '삭제', use[c.id] ? `${use[c.id]}곳 사용 중 · 삭제` : '정말 삭제')}</div>`).join('')}
   <div><button class="btn ghost" data-act="catAdd">＋ 분류 추가</button></div></div>
  <div class="panel"><h3>${T('room')} 바닥</h3><p class="help">격자 1칸은 약 50 cm예요.</p>
    <div class="sizes"><span class="stepper"><span>가로</span><button data-act="roomSize" data-k="w" data-d="-1" aria-label="가로 줄이기">−</button><input class="stepnum" id="room-w" type="number" inputmode="decimal" min="10" max="48" step="1" value="${M().room.w}" data-ch="stepSet" data-a="roomSize" data-k="w" data-cur="${M().room.w}" aria-label="바닥 가로 (숫자 입력)"><button data-act="roomSize" data-k="w" data-d="1" aria-label="가로 늘이기">＋</button></span>
    <span class="stepper"><span>세로</span><button data-act="roomSize" data-k="h" data-d="-1" aria-label="세로 줄이기">−</button><input class="stepnum" id="room-h" type="number" inputmode="decimal" min="10" max="48" step="1" value="${M().room.h}" data-ch="stepSet" data-a="roomSize" data-k="h" data-cur="${M().room.h}" aria-label="바닥 세로 (숫자 입력)"><button data-act="roomSize" data-k="h" data-d="1" aria-label="세로 늘이기">＋</button></span>
    <button class="btn ghost sm" data-act="toggleLayoutLock" aria-pressed="${layoutLocked()}">${LOCK_SVG} ${layoutLocked() ? '배치 잠금 켜짐' : '배치 전체 잠그기'}</button></div></div>
  </div>`;
}

const TRASH_T = { item: '물품', block: '블록', cabinet: '보관장', loan: '대여 기록' };
function trashName(t) {
  if (t.type === 'item') return t.data.name;
  if (t.type === 'block') return `${t.data.label} (물품 ${t.data.items.length}종)`;
  if (t.type === 'cabinet') return `${t.data.name} (블록 ${t.data.blocks.length}개)`;
  if (t.type === 'loan') return `${t.data.itemName} · ${t.data.who}`;
  return '';
}
function trashFrom(t) {
  const f = t.from || {};
  if (t.type === 'item') return `${f.cabName || ''} › ${f.blockLabel || ''}${f.block ? shelfTxt(f.block, t.data) : ''}`;
  if (t.type === 'block') return f.cabName || '';
  return '';
}
function renderBackup() {
  const el = $('#v-backup'), mgr = isManager();
  const trash = Object.values(S.trash).sort((a, b) => b.at - a.at);
  const list = Object.values(S.bidx).sort((a, b) => b.at - a.at);
  let h = `<div class="toolbar"><button class="btn" data-act="backupNow">지금 백업하기</button><button class="btn ghost" data-act="saveBackup">지금 상태를 파일로 내려받기</button>
    <span class="hint">매일 그날 처음 접속할 때 자동으로 백업돼요. 자동 백업과 휴지통은 ${KEEP_DAYS}일 동안 보관해요.</span></div>`;
  if (ui.cmp) {
    const meta = S.bidx[ui.cmp.id];
    h += `<div class="panel cmp" id="cmpPanel"><div class="lbl" style="font-size:13px"><b style="color:var(--ink)">${meta ? fmtTime(meta.at) : ''} 백업과 지금 비교</b><button class="x" data-act="cmpClose" aria-label="비교 닫기">×</button></div>`;
    if (!ui.cmp.data) h += '<p class="help">백업을 불러오는 중…</p>';
    else {
      const d = backupDiff(ui.cmp.data);
      const none = !d.cabsGone.length && !d.removed.length && !d.changed.length;
      h += none ? '<p class="help">이 백업 이후 사라지거나 수량이 바뀐 물품이 없어요.</p>' : '';
      if (d.cabsGone.length) h += `<h4>지금은 없는 ${T('cab')} ${d.cabsGone.length}개</h4>${d.cabsGone.map(c => `<div class="diffrow"><span class="nm">${esc(c.name)} <span class="muted">블록 ${c.blocks.length}개 · 물품 ${c.blocks.reduce((a, b) => a + b.items.length, 0)}종</span></span><button class="btn sm" data-act="cmpCab" data-id="${c.id}">${T('cab')} 되살리기</button></div>`).join('')}`;
      if (d.removed.length) h += `<h4>지금은 없는 물품 ${d.removed.length}종</h4>${d.removed.map(x => `<div class="diffrow"><span class="nm">${esc(x.it.name)} <span class="muted">${esc(x.cab.name)} › ${esc(x.b.label)}${shelfTxt(x.b, x.it)} · 당시 ${esc(x.it.qty)}${esc(x.it.unit)}</span></span><button class="btn sm" data-act="cmpItem" data-id="${x.it.id}">되살리기</button></div>`).join('')}`;
      if (d.changed.length) h += `<h4>수량이 바뀐 물품 ${d.changed.length}종</h4>${d.changed.map(x => `<div class="diffrow"><span class="nm">${esc(x.it.name)} <span class="muted">${esc(x.now.cab.name)} › ${esc(x.now.b.label)}${shelfTxt(x.now.b, x.now.it)}</span></span><span class="num">${esc(x.it.qty)} → ${esc(x.now.it.qty)}${esc(x.now.it.unit)}</span><button class="btn ghost sm" data-act="cmpQty" data-id="${x.it.id}">그때 수량으로</button></div>`).join('')}`;
      if (d.added) h += `<p class="help">이 백업 뒤에 새로 생긴 물품이 ${d.added}종 있어요. 하나씩 되살리면 새 물품은 그대로 남아요.</p>`;
      if (mgr) h += `<div class="sizes">${confirmBtn('cmpAll', 'x', '전체를 이 백업으로 되돌리기', `지금 ${T('cab')} 전체가 바뀌어요 · 한 번 더`)}<span class="hint">되돌리기 전 상태는 자동으로 한 번 더 백업해 둬요.</span></div>`;
    }
    h += '</div>';
  }
  h += `<div class="setgrid" style="margin-top:16px">
   <div class="panel"><h3>휴지통 ${trash.length}</h3><p class="help">지운 물품·블록·${T('cab')}·대여 기록이 여기로 와요. 원래 자리에 되살리고, 자리가 차 있으면 빈 칸에 넣어요.</p>
    ${trash.map(t => `<div class="diffrow"><span class="tag">${t.type === 'cabinet' ? T('cab') : (TRASH_T[t.type] || t.type)}</span><span class="nm">${esc(trashName(t))}<span class="muted" style="display:block">${esc(trashFrom(t))} · ${fmtTime(t.at)} · ${esc(t.byName || '')}</span></span>
      <button class="btn sm" data-act="restoreTrash" data-id="${t.id}">되살리기</button>${mgr ? confirmBtn('purgeTrash', t.id, '영구 삭제', '한 번 더') : ''}</div>`).join('') || '<p class="help">휴지통이 비어 있어요.</p>'}</div>
   <div class="panel"><h3>백업 목록 ${list.length}</h3><p class="help">‘비교’를 누르면 그때와 지금 무엇이 달라졌는지 보여 주고, 필요한 것만 골라 되살릴 수 있어요.</p>
    ${list.map(b => `<div class="diffrow"><span class="tag ${b.kind === 'auto' ? 'auto' : ''}">${b.kind === 'auto' ? '자동' : '직접'}</span><span class="nm"><b style="font-weight:500">${fmtTime(b.at)}</b><span class="muted" style="display:block">${esc(b.note)} · ${esc(b.byName || '')} · ${T('cab')} ${b.cabinets} · 물품 ${b.items}종</span></span>
      <button class="btn ghost sm" data-act="cmpBackup" data-id="${b.id}">비교</button><button class="btn ghost sm" data-act="backupFile" data-id="${b.id}">파일</button>${mgr ? confirmBtn('delBackup', b.id, '삭제', '한 번 더') : ''}</div>`).join('') || '<p class="help">아직 백업이 없어요. ‘지금 백업하기’를 눌러 보세요.</p>'}</div>
  </div>
  <div class="panel" style="margin-top:16px"><h3>파일로 옮기기</h3><p class="help">학기마다 백업 파일을 내려받아 학교 컴퓨터나 드라이브에 보관해 두면 Firebase에 문제가 생겨도 되살릴 수 있어요.</p>
    <div class="sizes"><button class="btn ghost sm" data-act="copyJson">지금 데이터 복사</button></div>
    <textarea id="io-out" readonly aria-label="내보낼 데이터">${esc(JSON.stringify(exportData()))}</textarea>
    ${mgr ? `<textarea id="io-in" placeholder="백업 데이터를 붙여 넣거나, 아래에서 백업 파일을 고르세요" aria-label="불러올 데이터"></textarea>
    <div class="sizes"><label class="btn ghost sm" for="io-file">백업 파일 고르기</label><input id="io-file" type="file" accept=".json,application/json" hidden>
    ${confirmBtn('importJson', 'x', '불러오기 (지금 데이터를 바꿈)', `지금 ${j(T('cab'), '이/가')} 모두 바뀌어요 · 한 번 더`)}${confirmBtn('resetEmpty', 'x', `${T('cab')} 모두 비우기`, '정말 비울까요? · 한 번 더')}</div>
    <p class="help">불러오기와 비우기 전에는 지금 상태를 자동으로 백업해요.</p>` : ''}</div>`;
  el.innerHTML = h;
}
