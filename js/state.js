// 상태, 상수, 계산 도우미, 저장 대기열
import { setPath, delPath } from './firebase.js';
import { ADMIN_EMAILS, SITE_URL, SITE_TITLE } from './config.js';

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);
export const clone = o => JSON.parse(JSON.stringify(o));
export const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const HZ = { acid: '산', base: '염기', oxidizer: '산화제', flammable: '인화성', toxic: '유독성' };
export const CONFLICTS = [
  ['acid', 'base', '산과 염기는 떨어뜨려 보관하세요'],
  ['oxidizer', 'flammable', '산화제와 인화성 물질은 떨어뜨려 보관하세요'],
  ['acid', 'flammable', '산과 인화성 물질은 떨어뜨려 보관하세요']
];
export const GHS = {
  GHS01: ['폭발', '폭발성'], GHS02: ['인화', '인화성'], GHS03: ['산화', '산화성'], GHS04: ['가스', '고압가스'], GHS05: ['부식', '부식성'],
  GHS06: ['독성', '급성 독성'], GHS07: ['경고', '경고(자극성 등)'], GHS08: ['건강', '건강 유해성'], GHS09: ['환경', '수생환경 유해성']
};
export const GHS_HZ = { GHS02: 'flammable', GHS03: 'oxidizer', GHS06: 'toxic' };
export const FURN = { bench: { w: 5, h: 2 }, desk: { w: 5, h: 1.5 }, sink: { w: 2.5, h: 3 } };
export const LOCK_SVG = '<svg width="11" height="12" viewBox="0 0 11 12" fill="none" aria-label="위치 잠김"><rect x="1" y="5" width="9" height="6.5" rx="1.5" fill="currentColor"/><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" stroke-width="1.6"/></svg>';

export function defaultCats() {
  return [
    { id: 'c_acid', name: '산', color: '#d94f5c', hazard: 'acid' }, { id: 'c_base', name: '염기', color: '#3b7dd8', hazard: 'base' },
    { id: 'c_ox', name: '산화제', color: '#e9b10a', hazard: 'oxidizer' }, { id: 'c_flam', name: '인화성', color: '#ef7d2d', hazard: 'flammable' },
    { id: 'c_tox', name: '유독성', color: '#8e5bd9', hazard: 'toxic' }, { id: 'c_reag', name: '지시약·일반 시약', color: '#17a2a0', hazard: '' },
    { id: 'c_glass', name: '유리기구', color: '#8ecae6', hazard: '' }, { id: 'c_meas', name: '측정기구', color: '#6b7a8f', hazard: '' },
    { id: 'c_elec', name: '전기·전자', color: '#2e9e5b', hazard: '' }, { id: 'c_cons', name: '소모품', color: '#b08a62', hazard: '' },
    { id: 'c_safe', name: '안전장비', color: '#e86aa8', hazard: '' }
  ];
}
export const newItem = (name, shelf = 1) => ({ id: uid(), name, qty: 1, unit: '개', min: '', expiry: '', cat: '', cas: '', msds: '', ghs: [], photoAt: '', shelf });
/* 블록 안의 단: 1단 = 맨 아래. 단이 하나뿐이면 위치에 '단'을 붙이지 않아요 */
export const MAX_SHELVES = 4;
export const shelvesOf = b => Math.max(1, Math.min(MAX_SHELVES, +(b && b.shelves) || 1));
export const shelfNo = (b, it) => Math.min(shelvesOf(b), Math.max(1, +(it && it.shelf) || 1));
export const shelfTxt = (b, it) => shelvesOf(b) > 1 ? ` › ${shelfNo(b, it)}단` : '';
export const shelfName = (n, total) => `${n}단${total > 1 && n === total ? ' (맨 위)' : ''}${total > 1 && n === 1 ? ' (맨 아래)' : ''}`;

/* 공유 상태 (Firestore와 맞춰짐) */
export const S = {
  auth: null, member: null, meta: null, metaLoaded: false,
  cabs: {}, members: {}, invites: {}, requests: [], loans: {}, logs: {}, myReq: null,
  trash: {}, bidx: {}, cabsLoaded: false, idxLoaded: false
};
/* 마지막으로 본 특별실 (이 브라우저에만 기억) */
const ROOM_KEY = 'lab-map-room';
let savedRoom = ''; try { savedRoom = localStorage.getItem(ROOM_KEY) || ''; } catch (e) { }
/* 화면 상태 (이 브라우저에만) */
export const ui = {
  phase: 'boot', view: 'room', cab: null, block: null, furn: null, q: '', filter: 'all', confirm: null, newCat: 'c_reag',
  U: 30, S: 100, openItem: null, loanItem: '', year: String(new Date().getFullYear()), qrCab: 'all',
  reqErr: '', hashDone: false, deferred: false, cmp: null, autoBackupDone: false, pruned: false, photo: null,
  room: savedRoom, scope: 'room', addingRoom: false, newShelf: 1, multi: false, sel: [], fmulti: false, fsel: [], clip: null, clipItems: false, newRoomKind: 'science', swing: null, migrated: false
};

let toastT;
// action: { label, fn } 을 주면 토스트에 버튼이 붙고 8초 동안 보여요 (예: 되돌리기)
export function toast(m, action) {
  const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'toastbtn'; b.textContent = action.label;
    b.addEventListener('click', () => { t.hidden = true; action.fn(); }); t.append(' ', b);
  }
  toastT = setTimeout(() => t.hidden = true, action ? 8000 : 2800);
}

/* 저장 대기열: 문서마다 한 번에 하나씩, 가장 최근 상태만 저장 */
const wq = {};
export function put(path, data) {
  const q = wq[path] || (wq[path] = { busy: false, dirty: false, data: null });
  q.data = data; q.dirty = true;
  if (!q.busy) flush(path, q);
}
async function flush(path, q) {
  q.busy = true;
  while (q.dirty) {
    q.dirty = false;
    const d = q.data;
    try { d === null ? await delPath(path) : await setPath(path, d); } catch (e) { dbErr(e); }
  }
  q.busy = false;
}
export const pending = p => { const q = wq[p]; return !!(q && (q.busy || q.dirty)); };
export function dbErr(e) {
  const c = e && e.code;
  if (c === 'permission-denied') toast('권한이 없어 저장하지 못했어요. 관리자에게 승인을 확인해 주세요.');
  else if (c === 'resource-exhausted') toast('오늘 사용량 한도에 닿았어요. 내일 다시 시도해 주세요.');
  else if (c === 'unavailable') toast('인터넷 연결이 끊겼어요. 연결되면 자동으로 저장돼요.');
  else toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  console.error(e);
}
export const saveMeta = () => put('meta/main', clone(S.meta));
export const saveCab = id => put('cabinets/' + id, S.cabs[id] ? clone(S.cabs[id]) : null);
export const saveLoan = id => put('loans/' + id, S.loans[id] ? clone(S.loans[id]) : null);

/* 사이트 제목: 저장된 값 → 이 브라우저가 마지막으로 본 값 → config 기본값 */
const TITLE_KEY = 'lab-map-site-title';
export function siteTitle() {
  if (S.meta && S.meta.siteTitle) { try { localStorage.setItem(TITLE_KEY, S.meta.siteTitle); } catch (e) {} return S.meta.siteTitle; }
  try { return localStorage.getItem(TITLE_KEY) || SITE_TITLE; } catch (e) { return SITE_TITLE; }
}

/* 특별실 종류별 부르는 이름과 추천 분류 */
const PAL = ['#d94f5c', '#3b7dd8', '#e9b10a', '#2e9e5b', '#8e5bd9', '#17a2a0', '#ef7d2d', '#b08a62', '#e86aa8', '#6b7a8f'];
const cats = names => names.map((n, i) => ({ name: n, color: PAL[i % PAL.length] }));
export const PRESETS = {
  science: { label: '과학실', terms: { room: '과학실', cab: '실험장', bench: '실험대', desk: '교탁', sink: '개수대' }, safety: true, cats: [] },
  music: { label: '음악실', terms: { room: '음악실', cab: '악기장', bench: '보면대', desk: '교탁', sink: '피아노' }, safety: false, cats: cats(['현악기', '관악기', '타악기', '건반악기', '음향 장비', '악보·교재', '소모품']) },
  art: { label: '미술실', terms: { room: '미술실', cab: '재료장', bench: '작업대', desk: '교탁', sink: '개수대' }, safety: false, cats: cats(['물감·채색', '드로잉', '종이', '조소·점토', '판화', '공구', '소모품']) },
  tech: { label: '기술실', terms: { room: '기술실', cab: '공구장', bench: '작업대', desk: '교탁', sink: '개수대' }, safety: false, cats: cats(['수공구', '전동공구', '측정 도구', '목재·재료', '전자 부품', '안전장비', '소모품']) },
  home: { label: '가사실', terms: { room: '가사실', cab: '수납장', bench: '조리대', desk: '교탁', sink: '개수대' }, safety: false, cats: cats(['조리 도구', '식기', '전기 기구', '재봉 도구', '세제·소모품', '안전장비']) },
  maker: { label: '무한상상실', terms: { room: '무한상상실', cab: '공구장', bench: '작업대', desk: '교탁', sink: '3D 프린터대' }, safety: false, cats: cats(['3D 프린터', '레이저 커터', '수공구', '전동공구', '필라멘트·소재', '전자부품', '측정 도구', '안전장비', '소모품']) },
  pe: { label: '체육 창고', terms: { room: '체육 창고', cab: '선반', bench: '매트', desk: '책상', sink: '공 바구니' }, safety: false, cats: cats(['구기', '육상', '체조·매트', '라켓', '측정·기록', '소모품']) }
};
export const TERM_LABELS = { room: '특별실', cab: '보관장 (블록을 붙이는 장)', bench: '모둠 탁자', desk: '앞쪽 책상', sink: '기타 가구' };
/* 특별실 목록과 지금 보고 있는 특별실 */
export const rooms = () => ((S.meta && S.meta.rooms) || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
export const roomById = id => rooms().find(r => r.id === id);
export function curRoom() {
  const list = rooms(); if (!list.length) return null;
  const r = list.find(x => x.id === ui.room) || list[0];
  if (ui.room !== r.id) ui.room = r.id;
  return r;
}
export function setRoom(id) {
  if (ui.room !== id) { ui.swing = id; ui.cab = ui.block = ui.furn = null; ui.qrCab = 'all'; ui.multi = false; ui.sel = []; ui.fmulti = false; ui.fsel = []; }
  ui.room = id; try { localStorage.setItem(ROOM_KEY, id); } catch (e) { }
  const r = curRoom(); if (r && !r.categories.some(c => c.id === ui.newCat)) ui.newCat = (r.categories[0] || {}).id || '';
}
/* 보관장이 놓인 특별실 (모르는 값이면 첫 특별실) */
export const roomOf = cab => { const list = rooms(); return cab && list.some(r => r.id === cab.roomId) ? cab.roomId : (list[0] || {}).id; };
export function newRoom(kind, name, order) {
  const p = PRESETS[kind] || PRESETS.science;
  const categories = kind === 'science' ? defaultCats() : p.cats.map(c => ({ id: 'c_' + uid(), name: c.name, color: c.color, hazard: '' }));
  return { id: 'r' + uid(), roomName: name || p.label, order: order || Date.now(), room: { w: 24, h: 15 }, categories, furniture: [], layoutLocked: false, terms: { ...p.terms }, preset: kind in PRESETS ? kind : 'science', safety: p.safety };
}
function fixRoom(r, i) {
  const p = PRESETS[r.preset] || PRESETS.science;
  return {
    id: String(r.id || 'r' + uid()), roomName: r.roomName || p.label, order: r.order || i + 1, room: r.room || { w: 24, h: 15 },
    categories: r.categories && r.categories.length ? r.categories : defaultCats(), furniture: r.furniture || [], layoutLocked: !!r.layoutLocked,
    terms: r.terms || { ...p.terms }, preset: r.preset || 'science', safety: r.safety === undefined ? p.safety : !!r.safety
  };
}
/* 예전(특별실 하나) 형식 → 여러 특별실 형식. 예전 내용은 id 'main'인 첫 특별실이 돼요 */
export function migrateMeta(m) {
  m = m || {};
  const rs = Array.isArray(m.rooms) && m.rooms.length ? m.rooms : [{ id: 'main', roomName: m.roomName, order: 1, room: m.room, categories: m.categories, furniture: m.furniture, layoutLocked: m.layoutLocked, terms: m.terms, preset: m.preset, safety: m.safety }];
  const out = { version: 3, rooms: rs.map(fixRoom) };
  if (m.siteTitle) out.siteTitle = m.siteTitle;
  return out;
}
export const T = (k, room = curRoom()) => (room && room.terms && room.terms[k]) || PRESETS.science.terms[k];
export const safetyOn = (room = curRoom()) => !(room && room.safety === false);
/* 받침에 따라 조사 고르기: j('악기장', '을/를') → '악기장을' */
export function j(word, pair) {
  const w = String(word), [a, b] = pair.split('/');
  const last = w.replace(/[^\uAC00-\uD7A3A-Za-z0-9]+$/, '').slice(-1), code = last.charCodeAt(0) - 0xAC00;
  // 받침: 한글은 글자로, 숫자는 읽는 소리(영·일·삼·육·칠·팔 = 받침 있음, 일·칠·팔은 ㄹ)로 판단
  let jong = 0;
  if (code >= 0 && code <= 11171) jong = code % 28;
  else if (/[0136-8]/.test(last)) jong = /[178]/.test(last) ? 8 : 1;
  if (pair === '으로/로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
  return w + (jong ? a : b);
}

/* 조회 도우미 */
/* M() = 지금 보고 있는 특별실 (이름, 바닥, 분류, 가구, 부르는 이름 등) */
export const M = () => curRoom();
const FALLBACK = { id: '', name: '미분류', color: '#9aa5a1', hazard: '' };
/* 분류 찾기: 그 특별실에서 먼저, 없으면 다른 특별실에서 (보관장을 옮겨도 색이 유지돼요) */
export function cat(id, rid) {
  const r = (rid && roomById(rid)) || curRoom();
  return (r && r.categories.find(c => c.id === id)) || rooms().flatMap(x => x.categories).find(c => c.id === id) || FALLBACK;
}
const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(b.name);
export const allCabs = () => Object.values(S.cabs).sort(byOrder);
/* cabList() = 지금 특별실의 보관장, cabList('all') = 모든 특별실 */
export const cabList = (rid = (curRoom() || {}).id) => rid === 'all' ? allCabs() : allCabs().filter(c => roomOf(c) === rid);
export const findCab = id => S.cabs[id];
export function locate(itemId) { for (const cab of allCabs()) for (const b of cab.blocks) { const it = b.items.find(i => i.id === itemId); if (it) return { cab, b, it }; } return {}; }
export function findBlock(id) { for (const cab of allCabs()) { const b = cab.blocks.find(x => x.id === id); if (b) return { cab, b }; } return {}; }
function lin(v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
export function ink(hex) { const n = parseInt(String(hex).replace('#', ''), 16); if (isNaN(n)) return '#111'; const L = .2126 * lin(n >> 16 & 255) + .7152 * lin(n >> 8 & 255) + .0722 * lin(n & 255); return L > .33 ? '#141a18' : '#ffffff'; }
export const snap = v => Math.round(v * 2) / 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* 보관장 칸 수 한도 */
export const MAX_CELLS = 20;
/* 배치도에서 보관장이 차지하는 크기(바닥 격자 칸). 직접 정했으면(fw, fh) 그 값, 아니면 칸 수로 계산하되 8칸 크기에서 더 커지지 않아요 */
export const cabFootAuto = cab => ({ w: snap(Math.min(cab.cols, 8) * 1.6 + .4), h: snap(Math.min(cab.rows, 8) * 1.1 + 1.1) });
/* 돌리기 전 크기(실험장 앞면 기준). 배치도 가로·세로 입력은 이 값을 바꿔요 */
export const cabFoot0 = cab => cab.fw && cab.fh ? { w: cab.fw, h: cab.fh } : cabFootAuto(cab);
/* 배치도 방향: 0·90·180·270도(시계 방향). 90·270도면 가로·세로가 바뀌어요 */
export const ROTS = [0, 90, 180, 270];
export const rotOf = o => ROTS.includes(o && o.rot) ? o.rot : 0;
/* 배치도에서 실제로 차지하는 크기(돌린 뒤). 위치 계산은 모두 이 값을 써요 */
export const cabFoot = cab => { const f = cabFoot0(cab); return rotOf(cab) % 180 ? { w: f.h, h: f.w } : f; };

export const myEmail = () => (S.auth && S.auth.email || '').toLowerCase();
export const isCfgAdmin = () => ADMIN_EMAILS.map(e => e.toLowerCase()).includes(myEmail());
export const isManager = () => isCfgAdmin() || !!(S.member && S.member.role === 'admin');
export const layoutLocked = () => !!(curRoom() && curRoom().layoutLocked);

export function itemStatus(it) {
  const s = [];
  if (it.min !== '' && it.min != null && +it.qty < +it.min) s.push('low');
  if (it.expiry) { const d = Math.round((new Date(it.expiry + 'T00:00:00') - TODAY) / 864e5); if (d < 0) s.push('expired'); else if (d <= 60) s.push('soon'); }
  return s;
}
export function dday(exp) { if (!exp) return ''; const d = Math.round((new Date(exp + 'T00:00:00') - TODAY) / 864e5); return d < 0 ? `${-d}일 지남` : d === 0 ? '오늘' : `D-${d}`; }
export function hazardsOf(b, rid) {
  const s = new Set(); const bc = cat(b.cat, rid); if (bc.hazard) s.add(bc.hazard);
  b.items.forEach(it => { const c = cat(it.cat || b.cat, rid); if (c.hazard) s.add(c.hazard); (it.ghs || []).forEach(g => { if (GHS_HZ[g]) s.add(GHS_HZ[g]); }); });
  return s;
}
function adjacent(a, b) { const ax = a.c + a.w, ay = a.r + a.h, bx = b.c + b.w, by = b.r + b.h; const v = a.r < by && b.r < ay, h = a.c < bx && b.c < ax; return (v && (ax === b.c || bx === a.c)) || (h && (ay === b.r || by === a.r)); }
export function conflicts(cab) {
  const rid = roomOf(cab);
  if (!safetyOn(roomById(rid))) return [];
  const out = [], H = cab.blocks.map(b => hazardsOf(b, rid));
  cab.blocks.forEach((b, i) => {
    CONFLICTS.forEach(([x, y, m]) => { if (H[i].has(x) && H[i].has(y)) out.push({ ids: [b.id], where: `‘${b.label}’ 블록 안`, msg: m }); });
    for (let j = i + 1; j < cab.blocks.length; j++) {
      const o = cab.blocks[j]; if (!adjacent(b, o)) continue;
      CONFLICTS.forEach(([x, y, m]) => { if ((H[i].has(x) && H[j].has(y)) || (H[i].has(y) && H[j].has(x))) out.push({ ids: [b.id, o.id], where: `‘${b.label}’ ↔ ‘${o.label}’ 맞닿음`, msg: m }); });
    }
  });
  return out;
}
export function canPlace(cab, b, c, r, w, h) {
  if (c < 0 || r < 0 || w < 1 || h < 1 || c + w > cab.cols || r + h > cab.rows) return false;
  return !cab.blocks.some(o => o !== b && c < o.c + o.w && o.c < c + w && r < o.r + o.h && o.r < r + h);
}
export const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
export function itemMatch(it, b, q, rid) { const n = norm(q); return norm(it.name).includes(n) || norm(b.label).includes(n) || norm(cat(it.cat || b.cat, rid).name).includes(n) || norm(it.cas).includes(n); }
export function blockMatch(b, q, rid) { return b.items.some(it => itemMatch(it, b, q, rid)) || norm(b.label).includes(norm(q)); }
export function matchCount(cab, q) { const rid = roomOf(cab); let n = 0; cab.blocks.forEach(b => b.items.forEach(it => { if (itemMatch(it, b, q, rid)) n++; })); return n; }
export const roomMatchCount = (rid, q) => cabList(rid).reduce((a, c) => a + matchCount(c, q), 0);
export const openLoans = () => Object.values(S.loans).filter(l => !l.returnedAt);
/* 대여 기록이 속한 특별실 (물품이 지금 있는 곳, 없으면 빌릴 때의 보관장) */
export function loanRoom(l) { const { cab } = locate(l.itemId); const c = cab || S.cabs[l.cabId]; return c ? roomOf(c) : ''; }
export const inScope = rid => ui.scope === 'all' || rid === (curRoom() || {}).id;
export const loanedQty = itemId => openLoans().filter(l => l.itemId === itemId).reduce((a, l) => a + (+l.qty || 0), 0);
export function stats(rid = (curRoom() || {}).id) {
  let items = 0, low = 0, date = 0, warn = 0, blocks = 0;
  cabList(rid).forEach(cab => {
    blocks += cab.blocks.length; warn += conflicts(cab).length;
    cab.blocks.forEach(b => b.items.forEach(it => { items++; const s = itemStatus(it); if (s.includes('low')) low++; if (s.includes('expired') || s.includes('soon')) date++; }));
  });
  const ol = openLoans().filter(l => rid === 'all' || loanRoom(l) === rid);
  return { items, low, date, warn, blocks, loans: ol.length, late: ol.filter(l => l.due && l.due < ymd(TODAY)).length };
}
export function pname(id, fallback) { const m = S.members[id]; return (m && (m.name || m.email)) || fallback || ''; }
export function qrSvg(text) { try { if (typeof qrcode !== 'function') return ''; const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag(4, 2); } catch (e) { return ''; } }
export const siteUrl = () => SITE_URL || (location.origin + location.pathname);
export const blockUrl = id => `${siteUrl()}#b-${id}`;

export function allRows(scope = ui.scope) {
  const out = [];
  cabList(scope === 'all' ? 'all' : undefined).forEach(cab => { const rid = roomOf(cab), room = roomById(rid); cab.blocks.forEach(b => b.items.forEach(it => out.push({ cab, b, it, rid, room, c: cat(it.cat || b.cat, rid), s: itemStatus(it), lq: loanedQty(it.id) }))); });
  return out;
}
export const LIST_F = {
  all: ['전체', () => true],
  low: ['재고 부족', r => r.s.includes('low')],
  date: ['유효기한 임박·만료', r => r.s.includes('expired') || r.s.includes('soon')],
  hazard: ['위험 물질', r => !!r.c.hazard || (r.it.ghs || []).length > 0, true],
  loan: ['대여 중', r => r.lq > 0]
};
export function yearUsage(Y) {
  const agg = {};
  Object.values(S.logs).forEach(d => {
    if (!String(d.month || '').startsWith(Y)) return;
    (d.entries || []).forEach(e => { const a = agg[e.i] || (agg[e.i] = { id: e.i, name: e.n, used: 0, added: 0, loans: 0 }); if (e.d < 0) a.used += -e.d; else a.added += e.d; });
  });
  Object.values(S.loans).forEach(l => {
    if (String(l.out || '').startsWith(Y)) { const a = agg[l.itemId] || (agg[l.itemId] = { id: l.itemId, name: l.itemName, used: 0, added: 0, loans: 0 }); a.loans++; }
  });
  const multi = rooms().length > 1;
  return Object.values(agg).map(a => {
    const { cab, b, it } = locate(a.id); const qty = it ? +it.qty || 0 : 0, min = it && it.min !== '' ? +it.min : 0, rid = cab ? roomOf(cab) : '';
    const where = cab ? `${multi ? (roomById(rid) || {}).roomName + ' › ' : ''}${cab.name} › ${b.label}${shelfTxt(b, it)}` : '삭제된 물품';
    return { ...a, rid, name: it ? it.name : a.name, unit: it ? it.unit : '', where, qty, min, buy: it ? Math.max(0, a.used + min - qty) : 0 };
  }).filter(r => ui.scope === 'all' || r.rid === (curRoom() || {}).id).sort((x, y) => y.used - x.used || y.loans - x.loans);
}

/* 백업 형식 */
export const exportData = () => ({ version: 3, meta: S.meta, cabinets: allCabs() });
export function normalize(d) {
  let meta, cabs;
  if (d && d.meta && Array.isArray(d.cabinets)) { meta = d.meta; cabs = d.cabinets; }
  else if (d && Array.isArray(d.cabinets) && Array.isArray(d.categories)) { meta = { roomName: d.roomName || '과학실', room: d.room, categories: d.categories, furniture: d.furniture || [] }; cabs = d.cabinets; }
  else throw new Error('형식이 맞지 않아요');
  meta = migrateMeta(clone(meta));
  const rids = new Set(meta.rooms.map(r => r.id)), first = meta.rooms[0].id;
  const sid = v => String(v || '').replace(/[^A-Za-z0-9]/g, '') || uid();
  cabs = cabs.map((c, i) => ({
    id: sid(c.id), roomId: rids.has(c.roomId) ? c.roomId : first, group: c.group || '', ...(c.fw && c.fh ? { fw: c.fw, fh: c.fh } : {}), ...(rotOf(c) ? { rot: rotOf(c) } : {}), name: c.name || T('cab'), cols: c.cols || 3, rows: c.rows || 3, x: c.x || 0, y: c.y || 0, locked: !!c.locked, order: c.order || i + 1,
    blocks: (c.blocks || []).map(b => ({
      id: sid(b.id), c: b.c || 0, r: b.r || 0, w: b.w || 1, h: b.h || 1, label: b.label || '블록', cat: b.cat || '', shelves: shelvesOf(b), group: b.group || '',
      items: (b.items || []).map(it => clone({ ...newItem(it.name || '물품'), ...it, ghs: it.ghs || [] }))
    }))
  }));
  return { meta, cabs };
}

/* 휴지통·백업 */
export const KEEP_DAYS = 30;
export function counts(data) {
  const cabs = data.cabinets || []; let blocks = 0, items = 0;
  cabs.forEach(c => { blocks += c.blocks.length; c.blocks.forEach(b => items += b.items.length); });
  return { cabinets: cabs.length, blocks, items };
}
export const byName = () => (S.auth && (S.auth.displayName || S.auth.email)) || '';
export function toTrash(type, data, from) {
  const id = uid();
  const t = { id, type, data: clone(data), from: from || {}, at: Date.now(), by: S.auth.uid, byName: byName() };
  S.trash[id] = t; put('trash/' + id, clone(t)); return id;
}
export const blockShape = b => ({ id: b.id, c: b.c, r: b.r, w: b.w, h: b.h, label: b.label, cat: b.cat, shelves: shelvesOf(b), group: b.group || '' });
/* 묶음: 같은 group 값을 가진 블록 (2개 이상일 때만 묶음으로 봐요) */
export const groupOf = (cab, b) => b && b.group ? cab.blocks.filter(x => x.group === b.group) : [];
export const isGrouped = (cab, b) => groupOf(cab, b).length > 1;
/* 배치도 묶음: 지금 특별실의 보관장과 가구를 'c:id' / 'f:id' 열쇠로 함께 다뤄요 */
export const floorItems = () => [...cabList().map(c => ({ k: 'c:' + c.id, o: c, cab: true })), ...(((curRoom() || {}).furniture) || []).map(f => ({ k: 'f:' + f.id, o: f, cab: false }))];
export const floorGroup = gid => gid ? floorItems().filter(x => x.o.group === gid) : [];
export const floorGrouped = o => !!(o && o.group) && floorGroup(o.group).length > 1;
export function floorGroupNo(gid) { const seen = []; floorItems().forEach(x => { const g = x.o.group; if (g && !seen.includes(g) && floorGroup(g).length > 1) seen.push(g); }); return seen.indexOf(gid) + 1; }
export function groupNo(cab, gid) { const seen = []; cab.blocks.forEach(x => { if (x.group && !seen.includes(x.group) && cab.blocks.filter(y => y.group === x.group).length > 1) seen.push(x.group); }); return seen.indexOf(gid) + 1; }
export function fmtTime(ms) { const d = new Date(ms); return `${ymd(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
export function flatItems(cabs) { const m = {}; cabs.forEach(c => c.blocks.forEach(b => b.items.forEach(it => { m[it.id] = { cab: c, b, it }; }))); return m; }
export function backupDiff(data) {
  const old = flatItems(data.cabinets || []), cur = flatItems(allCabs());
  const cabsGone = (data.cabinets || []).filter(c => !S.cabs[c.id]);
  const goneCabIds = new Set(cabsGone.map(c => c.id));
  const removed = Object.values(old).filter(x => !cur[x.it.id] && !goneCabIds.has(x.cab.id));
  const changed = Object.values(old).filter(x => cur[x.it.id] && +cur[x.it.id].it.qty !== +x.it.qty).map(x => ({ ...x, now: cur[x.it.id] }));
  const added = Object.keys(cur).filter(id => !old[id]).length;
  return { cabsGone, removed, changed, added };
}
