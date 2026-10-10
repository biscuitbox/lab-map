// 버튼·입력·끌기 동작
import { login, logout, setPath, delPath, getPath } from './firebase.js';
import {
  $, uid, clone, ymd, S, ui, toast, put, saveMeta, saveCab, saveLoan, dbErr, M, cat, cabList, findCab, locate, findBlock,
  snap, clamp, cabFoot, canPlace, conflicts, layoutLocked, newItem, defaultCats, FURN, GHS, allRows, yearUsage,
  exportData, normalize, myEmail, toTrash, blockShape, flatItems, isManager, T, j, PRESETS, safetyOn, shelvesOf, shelfNo, MAX_SHELVES, MAX_CELLS, FLOOR_MIN, FLOOR_MAX, cabFoot0, rotOf, groupOf, isGrouped, floorItems, floorGroup, floorGrouped,
  rooms, roomById, roomOf, setRoom, newRoom, siteTitle
} from './state.js';
import { SITE_TITLE } from './config.js';
import { restoreTrash, restoreItem, restoreCabinet, createBackup } from './backup.js';
import { render, labelsHtml } from './views.js';
import { savePhoto, deletePhoto, photoIdsIn } from './photos.js';

/* 사용 기록: 월별 · 사람별 문서 하나에 모아 둠 */
function logQty(it, delta) {
  if (!delta || !S.auth) return;
  const month = ymd(new Date()).slice(0, 7), docId = `${month}__${S.auth.uid}`;
  const d = S.logs[docId] || (S.logs[docId] = { month, user: S.auth.uid, entries: [] });
  const last = d.entries[d.entries.length - 1], now = Date.now();
  if (last && last.i === it.id && now - last.t < 120000) { last.d += delta; last.t = now; if (last.d === 0) d.entries.pop(); }
  else d.entries.push({ i: it.id, n: it.name, d: delta, t: now });
  put('logs/' + docId, clone(d));
}

function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
const fileBase = (all) => (all ? siteTitle() : (M().roomName || T('room'))).replace(/[\\/:*?"<>|]/g, '');

function replaceAll({ meta, cabs }) {
  Object.keys(S.cabs).forEach(id => { if (!cabs.find(c => c.id === id)) { delete S.cabs[id]; saveCab(id); } });
  cabs.forEach(c => { S.cabs[c.id] = c; saveCab(c.id); });
  S.meta = meta; saveMeta();
  ui.cab = ui.block = ui.furn = null; setRoom(meta.rooms.some(r => r.id === ui.room) ? ui.room : meta.rooms[0].id); render();
}
function addCab() {
  const n = cabList().length + 1, cab = { id: uid(), roomId: M().id, name: `${T('cab')} ${String.fromCharCode(64 + Math.min(n, 26))}`, cols: 3, rows: 3, x: .5, y: .5, locked: false, order: Date.now(), blocks: [] };
  const ft = cabFoot(cab), R = M().room;
  cab.x = clamp(snap(.5 + (n - 1) * .5), 0, Math.max(0, R.w - ft.w)); cab.y = clamp(snap(R.h - ft.h - .5), 0, Math.max(0, R.h - ft.h));
  S.cabs[cab.id] = cab; saveCab(cab.id); ui.view = 'cab'; ui.cab = cab.id; ui.block = null; render();
  toast(`새 ${j(T('cab'), '을/를')} 만들었어요. 빈 칸을 눌러 블록을 붙이세요.`);
}
/* 배치도에서 바뀐 보관장은 각각, 가구는 특별실 설정 한 번에 저장 */
/* 함께 돌릴 것들의 가운데를 중심으로 시계 방향 90도. 실험장은 rot을 바꾸고, 가구는 가로·세로를 바꿔요 */
function rotateFloor(set) {
  const R = M().room, sz = x => x.cab ? cabFoot(x.o) : { w: x.o.w, h: x.o.h };
  const box = list => { const b = list.map(x => ({ x, s: sz(x) })); return { b, x0: Math.min(...b.map(v => v.x.o.x)), y0: Math.min(...b.map(v => v.x.o.y)), x1: Math.max(...b.map(v => v.x.o.x + v.s.w)), y1: Math.max(...b.map(v => v.x.o.y + v.s.h)) }; };
  // 옮기지 않고 이어서 돌리면 처음 가운데를 그대로 써요(네 번 돌리면 제자리)
  const sig = set.map(x => x.k).sort().join(), pos = () => set.map(x => [x.o.x, x.o.y, rotOf(x.o), x.o.w, x.o.h].join()).join(';'), P = ui.rotPivot;
  const B = box(set), [gx, gy] = P && P.sig === sig && P.pos === pos() ? [P.gx, P.gy] : [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2];
  B.b.forEach(({ x, s }) => {
    const cx = x.o.x + s.w / 2, cy = x.o.y + s.h / 2, nx = gx - (cy - gy), ny = gy + (cx - gx);
    if (x.cab) { const r = (rotOf(x.o) + 90) % 360; if (r) x.o.rot = r; else delete x.o.rot; } else { const w = x.o.w; x.o.w = x.o.h; x.o.h = w; }
    const n = sz(x); x.o.x = snap(nx - n.w / 2); x.o.y = snap(ny - n.h / 2);
  });
  // 바닥 밖으로 나가면 다 같이 안으로 밀고, 그래도 넘치면 하나씩 맞춰요
  const A = box(set), dx = A.x0 < 0 ? -A.x0 : A.x1 > R.w ? R.w - A.x1 : 0, dy = A.y0 < 0 ? -A.y0 : A.y1 > R.h ? R.h - A.y1 : 0;
  A.b.forEach(({ x, s }) => { x.o.x = clamp(snap(x.o.x + dx), 0, Math.max(0, R.w - s.w)); x.o.y = clamp(snap(x.o.y + dy), 0, Math.max(0, R.h - s.h)); });
  ui.rotPivot = { sig, gx, gy, pos: pos() };
}
function saveFloor(list) { list.filter(x => x.cab).forEach(x => saveCab(x.o.id)); if (list.some(x => !x.cab)) saveMeta(); }
/* 복사·붙여넣기: 붙여 넣을 때마다 새 id를 만들어요. 물품은 '물품도 함께'를 고를 때만 복사해요 */
function cloneBlocks(list, withItems) {
  const gmap = {};
  return clone(list).map(b => ({
    ...b, id: uid(), group: b.group ? (gmap[b.group] || (gmap[b.group] = 'g' + uid())) : '',
    items: withItems ? b.items.map(it => ({ ...it, id: uid(), photoAt: '' })) : []
  }));
}
function pasteBlocks(cab, c, r) {
  const src = ui.clip.data, minC = Math.min(...src.map(b => b.c)), minR = Math.min(...src.map(b => b.r));
  const nb = cloneBlocks(src, ui.clipItems).map(b => ({ ...b, c: c + b.c - minC, r: r + b.r - minR }));
  const fits = nb.every(b => canPlace(cab, b, b.c, b.r, b.w, b.h));
  if (!fits) return null;
  cab.blocks.push(...nb); saveCab(cab.id);
  ui.multi = false; ui.sel = []; ui.block = nb.length === 1 ? nb[0].id : null; render();
  const ids = new Set(nb.map(b => b.id));
  toast(`블록 ${nb.length}개를 붙여 넣었어요${ui.clipItems ? ' (물품 포함)' : ''}`, { label: '되돌리기', fn: () => { const now = S.cabs[cab.id]; if (!now) return; now.blocks = now.blocks.filter(b => !ids.has(b.id)); ui.block = null; saveCab(now.id); render(); toast('붙여넣기를 되돌렸어요'); } });
  return nb;
}
function undoable(msg, tid) { toast(msg, { label: '되돌리기', fn: () => { const r = restoreTrash(tid); render(); toast(r.msg); } }); }
function needConfirm(k) { if (ui.confirm === k) { ui.confirm = null; return false; } ui.confirm = k; render(); return true; }
const profileOf = () => ({ email: myEmail(), name: S.auth.displayName || '', photo: S.auth.photoURL || '' });
const validEmail = v => /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v);

const ACT = {
  login: async () => { ui.reqErr = ''; try { await login(); } catch (e) { if (e && e.code === 'auth/popup-closed-by-user') return; ui.reqErr = e && e.code === 'auth/unauthorized-domain' ? '이 주소가 Firebase 승인 도메인에 없어요. SETUP.md 3단계를 확인해 주세요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'; render(); } },
  logout: () => logout(),
  tab: t => { ui.view = t.dataset.view; ui.multi = false; ui.sel = []; ui.fmulti = false; ui.fsel = []; render(); },
  goFilter: t => { ui.view = 'list'; ui.filter = t.dataset.f; render(); },
  goWarn: () => { const c = cabList().find(c => conflicts(c).length); if (!c) { toast('보관 경고가 없어요'); return; } ui.view = 'cab'; ui.cab = c.id; ui.block = null; render(); const w = $('#warns'); if (w) w.scrollIntoView({ block: 'nearest' }); },
  filter: t => { ui.filter = t.dataset.f; render(); },
  goBlock: t => { const c = S.cabs[t.dataset.cab]; if (c) setRoom(roomOf(c)); ui.view = 'cab'; ui.cab = t.dataset.cab; ui.block = t.dataset.id; render(); },
  pickRoom: t => { setRoom(t.dataset.id); ui.addingRoom = false; render(); },
  scope: t => { ui.scope = t.dataset.s; render(); },
  addRoomOpen: () => { ui.addingRoom = !ui.addingRoom; render(); const n = $('#newroom-name'); if (n) n.focus(); },
  newRoomKind: t => { ui.newRoomKind = t.dataset.id; render(); },
  addRoom: () => {
    if (!isManager()) return;
    const inp = $('#newroom-name'), kind = ui.newRoomKind, name = (inp && inp.value.trim()) || PRESETS[kind].label;
    if (rooms().some(r => r.roomName === name)) { toast(`‘${name}’ 이름의 특별실이 이미 있어요. 다른 이름을 적어 주세요.`); if (inp) inp.focus(); return; }
    const r = newRoom(kind, name, Math.max(0, ...rooms().map(x => x.order || 0)) + 1);
    S.meta.rooms.push(r); saveMeta(); ui.addingRoom = false; setRoom(r.id); ui.view = 'room'; render();
    toast(`${j(`‘${name}’`, '을/를')} 만들었어요. ${j(`＋ ${T('cab')}`, '으로/로')} 첫 ${T('cab')}을 놓아 보세요.`);
  },
  moveRoom: t => {
    const list = rooms(), i = list.findIndex(r => r.id === t.dataset.id), k = i + +t.dataset.d; if (i < 0 || k < 0 || k >= list.length) return;
    list.forEach((r, n) => { r.order = n + 1; }); list[i].order = k + 1; list[k].order = i + 1; saveMeta(); render();
  },
  /* 특별실 통째로 복사: 바닥·가구·분류·이름·실험장·블록(물품은 고를 때만). 대여 기록은 복사하지 않아요 */
  copyRoom: t => {
    const src = roomById(t.dataset.id); if (!src || !isManager()) return;
    const names = new Set(rooms().map(r => r.roomName)), base = src.roomName.replace(/(\s*복사본(\s*\d+)?)+$/, '').trim() || src.roomName;
    let name = `${base} 복사본`, n = 2; while (names.has(name)) name = `${base} 복사본 ${n++}`;
    const gmap = {}, g = id => id ? (gmap[id] || (gmap[id] = 'g' + uid())) : '';   // 가구·실험장 묶음은 새 묶음으로 같이 이어 줘요
    const r = { ...clone(src), id: 'r' + uid(), roomName: name, furniture: clone(src.furniture || []).map(f => ({ ...f, id: uid(), group: g(f.group) })) };
    const list = rooms(), i = list.findIndex(x => x.id === src.id); list.splice(i + 1, 0, r); list.forEach((x, k) => { x.order = k + 1; });
    S.meta.rooms.push(r);
    const withItems = !!ui.roomCopyItems, made = cabList(src.id).map(c => ({ ...clone(c), id: uid(), roomId: r.id, group: g(c.group), blocks: cloneBlocks(c.blocks, withItems) }));
    made.forEach(c => { S.cabs[c.id] = c; saveCab(c.id); });
    saveMeta(); setRoom(r.id); ui.view = 'room'; ui.cab = null; ui.block = null; render();
    toast(`${j(`‘${src.roomName}’`, '을/를')} ${j(`‘${name}’`, '으로/로')} 복사했어요${withItems ? ' (물품 포함)' : ''}`, {
      label: '되돌리기', fn: () => {
        made.forEach(c => { delete S.cabs[c.id]; saveCab(c.id); });
        S.meta.rooms = S.meta.rooms.filter(x => x.id !== r.id); saveMeta(); setRoom(src.id); render(); toast('복사를 되돌렸어요');
      }
    });
  },
  delRoom: t => {
    const r = roomById(t.dataset.id); if (!r || !isManager()) return;
    if (rooms().length < 2) { toast('특별실은 하나 이상 있어야 해요'); return; }
    const n = cabList(r.id).length; if (n) { toast(`‘${r.roomName}’에 ${T('cab', r)} ${n}개가 있어요. 먼저 다른 특별실로 옮기거나 지워 주세요.`); return; }
    if (needConfirm('delRoom:' + r.id)) return;
    S.meta.rooms = S.meta.rooms.filter(x => x.id !== r.id); saveMeta(); setRoom(rooms()[0].id); render(); toast(`${j(`‘${r.roomName}’`, '을/를')} 지웠어요`);
  },
  addCab,
  copyBlocks: t => {
    const cab = findCab(ui.cab), ids = t.dataset.id ? [t.dataset.id] : ui.sel;
    const list = cab.blocks.filter(b => ids.includes(b.id)); if (!list.length) return;
    ui.clip = { type: 'blocks', data: clone(list) }; ui.multi = false; ui.sel = []; ui.block = null; render();
    toast(`블록 ${list.length}개를 복사했어요. 점선 칸을 눌러 붙여 넣으세요. 다른 ${T('cab')}에도 붙일 수 있어요.`);
  },
  copyCab: () => { const cab = findCab(ui.cab); if (!cab) return; ui.clip = { type: 'cab', data: clone(cab) }; render(); toast(`${j(`‘${cab.name}’`, '을/를')} 복사했어요. 이 줄의 ‘붙여넣기’를 누르세요. 다른 특별실에도 붙일 수 있어요.`); },
  clipClear: () => { ui.clip = null; render(); },
  pasteBlocksAt: t => { const cab = findCab(ui.cab); if (!cab || !ui.clip) return; if (!pasteBlocks(cab, +t.dataset.c, +t.dataset.r)) toast('그 자리에는 들어가지 않아요. 왼쪽 위 기준으로 빈 칸이 충분한 곳을 눌러 주세요.'); },
  pasteBlocksAuto: () => {
    const cab = findCab(ui.cab); if (!cab || !ui.clip) return;
    for (let r = 0; r < cab.rows; r++) for (let c = 0; c < cab.cols; c++) if (pasteBlocks(cab, c, r)) return;
    toast(`이 ${T('cab')}에는 들어갈 빈 곳이 없어요. 칸을 늘리거나 다른 ${j(T('cab'), '을/를')} 골라 주세요.`);
  },
  pasteCab: () => {
    if (!ui.clip || ui.clip.type !== 'cab') return;
    const src = ui.clip.data, room = M(), same = src.roomId === room.id;
    // 복사본을 또 복사해도 ‘복사본 복사본…’이 이어지지 않게 원래 이름 뒤에 번호만 붙여요
    const names = new Set(cabList().map(c => c.name)), base = src.name.replace(/(\s*복사본(\s*\d+)?)+$/, '').trim() || src.name;
    let name = same || base !== src.name ? `${base} 복사본` : src.name, n = 2;
    while (names.has(name)) name = `${base} 복사본 ${n++}`;
    const cab = { ...clone(src), id: uid(), roomId: room.id, name, group: '', locked: false, order: Date.now(), blocks: cloneBlocks(src.blocks, ui.clipItems) };
    const ft = cabFoot(cab); cab.x = clamp(src.x + (same ? 1 : 0), 0, Math.max(0, room.room.w - ft.w)); cab.y = clamp(src.y + (same ? 1 : 0), 0, Math.max(0, room.room.h - ft.h));
    S.cabs[cab.id] = cab; saveCab(cab.id); ui.cab = cab.id; ui.block = null; render();
    toast(`${j(`‘${name}’`, '을/를')} 붙여 넣었어요${ui.clipItems ? ' (물품 포함)' : ''}. 배치도에서 자리를 잡아 주세요.`, { label: '되돌리기', fn: () => { delete S.cabs[cab.id]; saveCab(cab.id); ui.cab = null; render(); toast('붙여넣기를 되돌렸어요'); } });
  },
  addFurn: t => {
    const d = FURN[t.dataset.type], R = M().room, n = M().furniture.filter(f => f.type === t.dataset.type).length;
    const f = { id: uid(), type: t.dataset.type, label: t.dataset.type === 'bench' ? (T('bench') === '실험대' ? `${n + 1}모둠` : `${T('bench')} ${n + 1}`) : T(t.dataset.type), x: clamp(snap(R.w / 2 - d.w / 2), 0, R.w - d.w), y: clamp(snap(R.h / 2 - d.h / 2), 0, R.h - d.h), w: d.w, h: d.h, locked: false };
    M().furniture.push(f); ui.furn = f.id; saveMeta(); render();
  },
  furnSize: t => { const f = M().furniture.find(x => x.id === ui.furn); if (!f) return; const k = t.dataset.k, R = M().room; f[k] = clamp(f[k] + +t.dataset.d, 1, k === 'w' ? R.w - f.x : R.h - f.y); saveMeta(); render(); },
  furnLock: () => { const f = M().furniture.find(x => x.id === ui.furn); if (!f) return; f.locked = !f.locked; saveMeta(); render(); },
  furnDel: () => { M().furniture = M().furniture.filter(f => f.id !== ui.furn); ui.furn = null; saveMeta(); render(); },
  furnClose: () => { ui.furn = null; render(); },
  toggleLayoutLock: () => { M().layoutLocked = !M().layoutLocked; saveMeta(); render(); toast(M().layoutLocked ? `배치를 잠갔어요. ${j(T('cab'), '과/와')} 가구를 옮길 수 없어요.` : '배치 잠금을 풀었어요'); },
  cabLock: () => { const c = findCab(ui.cab); c.locked = !c.locked; saveCab(c.id); render(); toast(c.locked ? `배치도에서 이 ${T('cab')} 위치를 잠갔어요` : '위치 잠금을 풀었어요'); },
  pickCab: t => { ui.cab = t.dataset.id; ui.block = null; ui.multi = false; ui.sel = []; render(); },
  fmultiToggle: () => { ui.fmulti = !ui.fmulti; ui.fsel = ui.fmulti && ui.furn ? ['f:' + ui.furn] : []; ui.furn = null; render(); },
  fmultiDone: () => { ui.fmulti = false; ui.fsel = []; render(); },
  groupFloor: () => {
    const picked = floorItems().filter(x => ui.fsel.includes(x.k)); if (picked.length < 2) return;
    const gid = 'fg' + uid(); picked.forEach(x => { x.o.group = gid; }); saveFloor(picked);
    ui.fmulti = false; ui.fsel = []; render(); toast(`${picked.length}개를 묶었어요. 하나를 끌면 함께 옮겨져요.`);
  },
  ungroupFloor: t => {
    const gids = new Set(t.dataset.id ? [t.dataset.id] : floorItems().filter(x => ui.fsel.includes(x.k) && x.o.group).map(x => x.o.group));
    const hit = floorItems().filter(x => gids.has(x.o.group)); hit.forEach(x => { x.o.group = ''; }); saveFloor(hit); render(); toast('묶음을 풀었어요. 이제 따로 움직여요.');
  },
  multiToggle: () => { ui.multi = !ui.multi; ui.sel = ui.multi && ui.block ? [ui.block] : []; ui.block = null; render(); },
  multiDone: () => { ui.multi = false; ui.sel = []; render(); },
  groupSel: () => {
    const cab = findCab(ui.cab), picked = cab.blocks.filter(b => ui.sel.includes(b.id)); if (picked.length < 2) return;
    const gid = 'g' + uid(); picked.forEach(b => { b.group = gid; }); saveCab(cab.id);
    ui.multi = false; ui.sel = []; ui.block = picked[0].id; render();
    toast(`블록 ${picked.length}개를 묶었어요. 하나를 끌면 함께 옮겨져요.`);
  },
  ungroupSel: () => {
    const cab = findCab(ui.cab), gids = new Set(cab.blocks.filter(b => ui.sel.includes(b.id) && b.group).map(b => b.group));
    cab.blocks.forEach(b => { if (gids.has(b.group)) b.group = ''; }); saveCab(cab.id); render(); toast('묶음을 풀었어요');
  },
  ungroup: t => { const cab = findCab(ui.cab); cab.blocks.forEach(b => { if (b.group === t.dataset.id) b.group = ''; }); saveCab(cab.id); render(); toast('묶음을 풀었어요. 이제 블록이 따로 움직여요.'); },
  /* 배치도에서 보관장이 차지하는 크기 (격자 칸, 0.5칸 단위) */
  cabFloor: t => {
    const cab = findCab(ui.cab), R = M().room; if (!cab) return;
    // 화면의 가로·세로는 돌린 뒤 기준이라, 90·270도면 실험장의 세로·가로를 바꿔요
    const cur = cabFoot0(cab), k = t.dataset.k, base = rotOf(cab) % 180 ? (k === 'w' ? 'h' : 'w') : k;
    const lim = k === 'w' ? R.w : R.h, want = snap(cur[base] + +t.dataset.d), v = clamp(want, 2, lim);
    if (want !== v) toast(`배치도 크기는 2칸부터 바닥 크기(${lim}칸)까지 정할 수 있어요`);
    cab.fw = base === 'w' ? v : cur.w; cab.fh = base === 'h' ? v : cur.h;
    const ft = cabFoot(cab); cab.x = clamp(cab.x, 0, Math.max(0, R.w - ft.w)); cab.y = clamp(cab.y, 0, Math.max(0, R.h - ft.h)); saveCab(cab.id); render();
  },
  /* 배치도에서 시계 방향 90도 돌리기. 고른 것들 → 묶음 → 하나 순서로 함께 돌려요 */
  rotFloor: t => {
    const key = t.dataset.k, items = floorItems(), me = items.find(x => x.k === key); if (!me) return;
    const set = ui.fsel.length > 1 && ui.fsel.includes(key) ? items.filter(x => ui.fsel.includes(x.k)) : floorGrouped(me.o) ? floorGroup(me.o.group) : [me];
    if (layoutLocked() || set.some(x => x.o.locked)) { toast(set.length > 1 ? '잠긴 것이 있어서 함께 돌릴 수 없어요' : '위치가 잠겨 있어 돌릴 수 없어요'); return; }
    rotateFloor(set); saveFloor(set); render();
    toast(set.length > 1 ? `${set.length}개를 함께 90° 돌렸어요` : me.cab ? `‘${me.o.name}’ 방향: ${rotOf(me.o)}°` : `${j(`‘${me.o.label}’`, '을/를')} 90° 돌렸어요`);
  },
  cabFloorAuto: () => { const cab = findCab(ui.cab); if (!cab) return; delete cab.fw; delete cab.fh; const ft = cabFoot(cab), R = M().room; cab.x = clamp(cab.x, 0, Math.max(0, R.w - ft.w)); cab.y = clamp(cab.y, 0, Math.max(0, R.h - ft.h)); saveCab(cab.id); render(); toast('배치도 크기를 칸 수에 맞춰 되돌렸어요'); },
  cabSize: t => {
    const cab = findCab(ui.cab), k = t.dataset.k, v = cab[k] + +t.dataset.d; if (v < 1 || v > MAX_CELLS) { toast(`가로·세로 칸은 1~${MAX_CELLS}칸까지 정할 수 있어요`); render(); return; }
    if (+t.dataset.d < 0 && !cab.blocks.every(b => k === 'cols' ? b.c + b.w <= v : b.r + b.h <= v)) { toast('끝 칸에 블록이 있어 줄일 수 없어요'); return; }
    cab[k] = v; const ft = cabFoot(cab), R = M().room; cab.x = clamp(cab.x, 0, Math.max(0, R.w - ft.w)); cab.y = clamp(cab.y, 0, Math.max(0, R.h - ft.h)); saveCab(cab.id); render();
  },
  cabDel: t => { if (needConfirm('cabDel:' + t.dataset.id)) return; const c = S.cabs[t.dataset.id]; const tid = toTrash('cabinet', c, { cabId: c.id, cabName: c.name }); delete S.cabs[c.id]; saveCab(c.id); ui.cab = null; ui.block = null; render(); undoable(`‘${c.name}’ ${j(T('cab'), '을/를')} 휴지통으로 옮겼어요`, tid); },
  newCat: t => { ui.newCat = t.dataset.id; render(); },
  addBlock: t => {
    const cab = findCab(ui.cab), c = M().categories.some(x => x.id === ui.newCat) ? ui.newCat : (M().categories[0] || {}).id || '';
    const b = { id: uid(), c: +t.dataset.c, r: +t.dataset.r, w: 1, h: 1, label: cat(c).name, cat: c, items: [] };
    cab.blocks.push(b); ui.block = b.id; saveCab(cab.id); render(); const n = $('#new-item'); if (n) n.focus();
  },
  closeBlk: () => { ui.block = null; render(); },
  blkCat: t => { const { cab, b } = findBlock(ui.block); const old = cat(b.cat).name; b.cat = t.dataset.id; if (b.label === old) b.label = cat(b.cat).name; ui.newCat = b.cat; saveCab(cab.id); render(); },
  blkSize: t => { const { cab, b } = findBlock(ui.block), k = t.dataset.k, d = +t.dataset.d, w = b.w + (k === 'w' ? d : 0), h = b.h + (k === 'h' ? d : 0); if (canPlace(cab, b, b.c, b.r, w, h)) { b.w = w; b.h = h; saveCab(cab.id); render(); } else { toast(w < 1 || h < 1 ? '블록은 1칸보다 작게 할 수 없어요' : '그 크기로는 다른 블록과 겹치거나 실험장 밖으로 나가요'); render(); } },
  blkShelves: t => {
    const { cab, b } = findBlock(ui.block), want = shelvesOf(b) + +t.dataset.d, N = Math.max(1, Math.min(MAX_SHELVES, want));
    if (want !== N) toast(`칸 안의 단은 1~${MAX_SHELVES}단까지 나눌 수 있어요`); if (N === shelvesOf(b)) { render(); return; }
    // 물품의 단 번호는 그대로 두어요. 단을 줄이면 위쪽 물품은 맨 위 단에 함께 보이고, 다시 늘리면 원래 단으로 돌아가요
    const above = b.items.filter(it => (+it.shelf || 1) > N).length;
    b.shelves = N; saveCab(cab.id); render();
    toast(above ? `${N === 1 ? '단 나누기를 없앴어요' : `${N}단으로 줄였어요`}. 위쪽 단 물품 ${above}종은 ${N === 1 ? '한 칸에' : `${N}단(맨 위)에`} 함께 보여요. 다시 늘리면 원래 단으로 돌아가요.`
      : N === 1 ? '단 나누기를 없앴어요' : `칸 안을 ${N}단으로 나눴어요. 맨 아래가 1단이에요.`);
  },
  delBlock: t => { if (needConfirm('delBlock:' + t.dataset.id)) return; const { cab, b } = findBlock(t.dataset.id); const tid = toTrash('block', b, { cabId: cab.id, cabName: cab.name }); cab.blocks = cab.blocks.filter(x => x.id !== b.id); ui.block = null; saveCab(cab.id); render(); undoable(`‘${b.label}’ 블록을 휴지통으로 옮겼어요`, tid); },
  addItem: () => { const inp = $('#new-item'), name = inp.value.trim(); if (!name) { inp.focus(); return; } const { cab, b } = findBlock(ui.block); const sh = $('#new-shelf'); const shelf = sh ? +sh.value : 1; ui.newShelf = shelf; b.items.push(newItem(name, shelf)); saveCab(cab.id); render(); const n = $('#new-item'); if (n) n.focus(); },
  delItem: t => { const { cab, b, it } = locate(t.dataset.id); const tid = toTrash('item', it, { cabId: cab.id, cabName: cab.name, blockId: b.id, blockLabel: b.label, block: blockShape(b) }); b.items = b.items.filter(i => i.id !== it.id); saveCab(cab.id); render(); undoable(`‘${it.name}’을(를) 휴지통으로 옮겼어요`, tid); },
  qty: t => { const { cab, it } = locate(t.dataset.id); const before = +it.qty || 0, after = Math.max(0, before + +t.dataset.d); if (after === before) return; it.qty = after; saveCab(cab.id); logQty(it, after - before); render(); },
  applyPreset: t => { const p = PRESETS[t.dataset.id]; if (!p) return; M().terms = { ...p.terms }; M().safety = p.safety; M().preset = t.dataset.id; saveMeta(); render(); toast(`${p.label}에 맞게 이름을 바꿨어요. 아래 칸에서 하나씩 고칠 수도 있어요.`); },
  addPresetCats: () => {
    const p = PRESETS[M().preset] || PRESETS.science; const have = new Set(M().categories.map(c => c.name)); let n = 0;
    p.cats.forEach(c => { if (!have.has(c.name)) { M().categories.push({ id: 'c_' + uid(), name: c.name, color: c.color, hazard: '' }); n++; } });
    saveMeta(); render(); toast(n ? `분류 ${n}개를 더했어요. 쓰지 않는 분류는 지워도 돼요.` : '추천 분류가 이미 모두 있어요');
  },
  openPhoto: t => { ui.photo = t.dataset.id; render(); },
  closePhoto: () => { ui.photo = null; render(); },
  delPhoto: t => { if (needConfirm('delPhoto:' + t.dataset.id)) return; const { cab, it } = locate(t.dataset.id); if (!it) return; deletePhoto(it.id); it.photoAt = ''; saveCab(cab.id); ui.photo = null; render(); toast('사진을 지웠어요'); },
  toggleSafety: t => { ui.openItem = ui.openItem === t.dataset.id ? null : t.dataset.id; render(); },
  ghs: t => { const { cab, it } = locate(t.dataset.id); const g = t.dataset.g; it.ghs = it.ghs || []; it.ghs = it.ghs.includes(g) ? it.ghs.filter(x => x !== g) : [...it.ghs, g]; saveCab(cab.id); render(); },
  loanThis: t => { ui.loanItem = t.dataset.id; ui.view = 'loans'; render(); const w = $('#loan-who'); if (w) w.focus(); },
  addLoan: () => {
    const id = $('#loan-item').value, qty = Math.max(1, parseInt($('#loan-qty').value) || 1), who = $('#loan-who').value.trim(), due = $('#loan-due').value;
    if (!id) { toast('빌려 줄 물품을 고르세요'); return; }
    if (!who) { toast('빌려간 곳을 적어 주세요'); $('#loan-who').focus(); return; }
    const { cab, b, it } = locate(id);
    const l = { id: uid(), itemId: id, itemName: it.name, cabId: cab.id, blockId: b.id, qty, who, due, out: ymd(new Date()), outBy: S.auth.uid, outByName: S.auth.displayName || myEmail(), returnedAt: null, returnedBy: null, returnedByName: '' };
    S.loans[l.id] = l; saveLoan(l.id); ui.loanItem = ''; render(); toast(`${it.name} ${qty}${it.unit} 대여를 기록했어요`);
  },
  returnLoan: t => { const l = S.loans[t.dataset.id]; l.returnedAt = Date.now(); l.returnedBy = S.auth.uid; l.returnedByName = S.auth.displayName || myEmail(); saveLoan(l.id); render(); toast('반납 처리했어요'); },
  delLoan: t => { if (needConfirm('delLoan:' + t.dataset.id)) return; const l = S.loans[t.dataset.id]; const tid = toTrash('loan', l, {}); delete S.loans[l.id]; saveLoan(l.id); render(); undoable('대여 기록을 휴지통으로 옮겼어요', tid); },
  pickYear: t => { ui.year = t.dataset.y; render(); },
  qrCab: t => { ui.qrCab = t.dataset.id; render(); },
  printLabels: () => {
    const w = window.open('', '_blank');
    if (!w) { download(`${fileBase()} QR 라벨.html`, labelsHtml(false), 'text/html'); toast('팝업이 막혀서 파일로 내려받았어요. 열어서 인쇄하세요.'); return; }
    w.document.open(); w.document.write(labelsHtml(true)); w.document.close();
  },
  saveLabels: () => download(`${fileBase()} QR 라벨.html`, labelsHtml(false), 'text/html'),
  csvInventory: () => download(`${fileBase(ui.scope === 'all')} 재고 ${ymd(new Date())}.csv`, csv([['특별실', T('cab'), '블록', '단', '물품', '분류', '수량', '단위', '최소', '유효기한', '대여 중', 'CAS', 'GHS']]
    .concat(allRows().map(r => [r.room ? r.room.roomName : '', r.cab.name, r.b.label, shelvesOf(r.b) > 1 ? shelfNo(r.b, r.it) : '', r.it.name, r.c.name, r.it.qty, r.it.unit, r.it.min, r.it.expiry, r.lq, r.it.cas, (r.it.ghs || []).map(g => GHS[g] ? GHS[g][1] : g).join(' ')]))), 'text/csv'),
  csvBuy: () => download(`${fileBase(ui.scope === 'all')} 구입 추천 ${ui.year}.csv`, csv([['물품', '위치', '지금 수량', '단위', '최소', '연간 사용량', '연간 보충량', '구입 추천']]
    .concat(yearUsage(ui.year).filter(r => r.buy > 0).map(r => [r.name, r.where, r.qty, r.unit, r.min, r.used, r.added, r.buy]))), 'text/csv'),
  catAdd: () => { M().categories.push({ id: 'c_' + uid(), name: '새 분류', color: '#5b8def', hazard: '' }); saveMeta(); render(); },
  catDel: t => {
    const id = t.dataset.id; if (needConfirm('catDel:' + id)) return;
    M().categories = M().categories.filter(c => c.id !== id); const fb = (M().categories[0] || {}).id || '';
    cabList().forEach(c => { let ch = false; c.blocks.forEach(b => { if (b.cat === id) { b.cat = fb; ch = true; } b.items.forEach(it => { if (it.cat === id) { it.cat = ''; ch = true; } }); }); if (ch) saveCab(c.id); });
    if (ui.newCat === id) ui.newCat = fb; saveMeta(); render();
  },
  roomSize: t => {
    const k = t.dataset.k, R = M().room; { const want = R[k] + +t.dataset.d; R[k] = clamp(want, FLOOR_MIN, FLOOR_MAX); if (want !== R[k]) toast(`바닥은 가로·세로 ${FLOOR_MIN}~${FLOOR_MAX}칸(${FLOOR_MIN / 2}~${FLOOR_MAX / 2} m)까지 정할 수 있어요`); }
    cabList().forEach(c => { const ft = cabFoot(c), x = clamp(c.x, 0, Math.max(0, R.w - ft.w)), y = clamp(c.y, 0, Math.max(0, R.h - ft.h)); if (x !== c.x || y !== c.y) { c.x = x; c.y = y; saveCab(c.id); } });
    M().furniture.forEach(f => { f.x = clamp(f.x, 0, Math.max(0, R.w - f.w)); f.y = clamp(f.y, 0, Math.max(0, R.h - f.h)); });
    const big = floorItems().filter(x => { const s = x.cab ? cabFoot(x.o) : x.o; return s.w > R.w || s.h > R.h; });
    if (big.length) toast(`바닥보다 큰 것이 ${big.length}개 있어요. 크기를 줄이거나 바닥을 넓혀 주세요.`);
    saveMeta(); render();
  },
  copyJson: () => { const ta = $('#io-out'), fb = () => { ta.focus(); ta.select(); toast('선택해 두었어요. Ctrl+C로 복사하세요'); }; try { navigator.clipboard.writeText(ta.value).then(() => toast('데이터를 복사했어요'), fb); } catch (e) { fb(); } },
  saveBackup: () => download(`${fileBase(true)} 백업 ${ymd(new Date())}.json`, JSON.stringify(exportData(), null, 1), 'application/json'),
  importJson: async () => {
    if (S.meta && needConfirm('importJson:x')) return;
    let data; try { data = normalize(JSON.parse($('#io-in').value)); } catch (e) { toast('불러오지 못했어요. 백업 내용 전체를 붙여 넣었는지 확인하세요'); return; }
    if (S.meta) await createBackup('manual', '파일 불러오기 전 자동 백업');
    replaceAll(data); toast('불러왔어요. 바꾸기 전 상태는 백업 목록에 남겨 두었어요.');
  },
  startEmpty: () => { const r = newRoom('science', '1과학실', 1); S.meta = { version: 3, siteTitle: SITE_TITLE, rooms: [r] }; saveMeta(); setRoom(r.id); render(); },
  startSample: async () => {
    try { const r = await fetch('data/sample.json', { cache: 'no-store' }); replaceAll(normalize(await r.json())); toast('예시 데이터로 시작했어요. 학교에 맞게 고쳐 쓰세요.'); }
    catch (e) { toast('예시 데이터를 불러오지 못했어요'); }
  },
  resetEmpty: async () => { if (needConfirm('resetEmpty:x')) return; await createBackup('manual', `${M().roomName} 비우기 전 자동 백업`); cabList().forEach(c => { delete S.cabs[c.id]; saveCab(c.id); }); M().furniture = []; saveMeta(); render(); toast('비웠어요. 비우기 전 상태는 백업 목록에 있어요.'); },
  restoreTrash: t => { const r = restoreTrash(t.dataset.id); render(); toast(r.msg); },
  purgeTrash: t => { if (needConfirm('purgeTrash:' + t.dataset.id)) return; const tr = S.trash[t.dataset.id]; if (tr) photoIdsIn(tr.type, tr.data).forEach(id => { if (!locate(id).it) deletePhoto(id); }); delete S.trash[t.dataset.id]; put('trash/' + t.dataset.id, null); render(); toast('영구 삭제했어요'); },
  backupNow: async () => { const id = await createBackup('manual', '직접 백업'); if (id) { render(); toast('지금 상태를 백업했어요'); } },
  cmpBackup: async t => {
    const id = t.dataset.id; ui.cmp = { id, data: null }; render();
    try { const d = await getPath('backups/' + id); if (!d) throw 0; ui.cmp = { id, data: d }; } catch (e) { ui.cmp = null; toast('백업을 불러오지 못했어요'); }
    render(); const el = $('#cmpPanel'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
  cmpClose: () => { ui.cmp = null; render(); },
  cmpItem: t => { const x = flatItems(ui.cmp.data.cabinets)[t.dataset.id]; if (!x) return; const { items, ...shape } = x.b; const r = restoreItem(x.it, { cabId: x.cab.id, cabName: x.cab.name, blockId: x.b.id, blockLabel: x.b.label, block: shape }); render(); toast(r.msg); },
  cmpQty: t => { const x = flatItems(ui.cmp.data.cabinets)[t.dataset.id]; const cur = locate(t.dataset.id); if (!x || !cur.it) return; const before = +cur.it.qty || 0, after = +x.it.qty || 0; cur.it.qty = after; saveCab(cur.cab.id); logQty(cur.it, after - before); render(); toast(`‘${cur.it.name}’ 수량을 ${after}${cur.it.unit}(으)로 되돌렸어요`); },
  cmpCab: t => { const c = ui.cmp.data.cabinets.find(x => x.id === t.dataset.id); if (!c) return; const r = restoreCabinet(c); render(); toast(r.msg); },
  cmpAll: async () => {
    if (!isManager() || needConfirm('cmpAll:x')) return;
    let data; try { data = normalize(ui.cmp.data); } catch (e) { toast('이 백업을 읽지 못했어요'); return; }
    await createBackup('manual', '전체 되돌리기 전 자동 백업'); replaceAll(data); ui.cmp = null; ui.view = 'backup'; render(); toast('백업 시점으로 되돌렸어요. 되돌리기 전 상태도 백업 목록에 있어요.');
  },
  delBackup: async t => { const id = t.dataset.id; if (needConfirm('delBackup:' + id)) return; try { await delPath('backups/' + id); await delPath('backupIndex/' + id); delete S.bidx[id]; if (ui.cmp && ui.cmp.id === id) ui.cmp = null; render(); } catch (e) { dbErr(e); } },
  backupFile: async t => { try { const d = await getPath('backups/' + t.dataset.id); if (!d) throw 0; download(`${fileBase(true)} 백업 ${t.dataset.id}.json`, JSON.stringify(d, null, 1), 'application/json'); } catch (e) { toast('내려받지 못했어요'); } },
  requestAccess: async () => {
    ui.reqErr = '';
    try { await setPath('requests/' + S.auth.uid, { ...profileOf(), at: Date.now() }); S.myReq = { at: Date.now() }; }
    catch (e) { ui.reqErr = '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'; console.error(e); }
    render();
  },
  cancelRequest: async () => { try { await delPath('requests/' + S.auth.uid); S.myReq = null; render(); } catch (e) { toast('취소하지 못했어요'); } },
  approve: async t => {
    const r = S.requests.find(x => x.id === t.dataset.id); if (!r) return;
    try { await setPath('members/' + r.id, { email: r.email || '', name: r.name || '', photo: r.photo || '', role: 'member', at: Date.now(), by: S.auth.uid }); await delPath('requests/' + r.id); toast('승인했어요'); }
    catch (e) { dbErr(e); }
  },
  deny: async t => { try { await delPath('requests/' + t.dataset.id); toast('요청을 거절했어요'); } catch (e) { dbErr(e); } },
  invite: async () => {
    const inp = $('#invite-email'), em = inp.value.trim().toLowerCase();
    if (!validEmail(em)) { toast('이메일 주소를 확인해 주세요'); inp.focus(); return; }
    try { await setPath('invites/' + em, { at: Date.now(), by: S.auth.uid }); inp.value = ''; toast(`${em} 계정은 처음 로그인할 때 바로 열려요`); } catch (e) { dbErr(e); }
  },
  uninvite: async t => { if (needConfirm('uninvite:' + t.dataset.id)) return; try { await delPath('invites/' + t.dataset.id); } catch (e) { dbErr(e); } },
  removeMember: async t => {
    const id = t.dataset.id; if (needConfirm('removeMember:' + id)) return; const m = S.members[id];
    try { if (m && m.email) await delPath('invites/' + m.email).catch(() => {}); await delPath('members/' + id); toast('승인을 취소했어요'); } catch (e) { dbErr(e); }
  }
};

const itemCh = fn => t => { const { cab, it } = locate(t.dataset.id); if (!it) return; fn(it, t); saveCab(cab.id); };
const CH = {
  roomName: t => { M().roomName = t.value.trim() || T('room'); saveMeta(); },
  siteTitle: t => { if (!isManager()) return; S.meta.siteTitle = t.value.trim() || SITE_TITLE; saveMeta(); toast('사이트 제목을 바꿨어요'); },
  cabRoom: t => {
    const c = findCab(ui.cab), r = roomById(t.value); if (!c || !r) return;
    c.roomId = r.id; c.group = ''; const ft = cabFoot(c); c.x = clamp(c.x, 0, Math.max(0, r.room.w - ft.w)); c.y = clamp(c.y, 0, Math.max(0, r.room.h - ft.h)); c.locked = false; saveCab(c.id);
    setRoom(r.id); ui.cab = c.id; toast(`${j(`‘${c.name}’`, '을/를')} ${j(r.roomName, '으로/로')} 옮겼어요. 배치도에서 자리를 잡아 주세요.`);
  },
  cabName: t => { const c = findCab(ui.cab); c.name = t.value.trim() || `이름 없는 ${T('cab')}`; saveCab(c.id); },
  blkLabel: t => { const { cab, b } = findBlock(ui.block); b.label = t.value.trim() || '블록'; saveCab(cab.id); },
  itName: itemCh((it, t) => it.name = t.value.trim() || '이름 없는 물품'),
  itQty: t => { const { cab, it } = locate(t.dataset.id); const before = +it.qty || 0, after = Math.max(0, parseInt(t.value) || 0); it.qty = after; saveCab(cab.id); logQty(it, after - before); },
  itUnit: itemCh((it, t) => it.unit = t.value.trim()),
  itMin: itemCh((it, t) => it.min = t.value === '' ? '' : Math.max(0, parseInt(t.value) || 0)),
  itExp: itemCh((it, t) => it.expiry = t.value),
  itCat: itemCh((it, t) => it.cat = t.value),
  clipItems: t => { ui.clipItems = t.checked; },
  roomCopyItems: t => { ui.roomCopyItems = t.checked; },
  // 크기 칸에 숫자를 직접 적으면, 지금 값과의 차이만큼 −/＋ 단추와 같은 규칙으로 바꿔요
  stepSet: t => { const raw = parseFloat(t.value), v = ['furnSize', 'cabFloor'].includes(t.dataset.a) ? Math.round(raw * 2) / 2 : Math.round(raw), cur = +t.dataset.cur; if (!isFinite(v)) { toast('숫자를 적어 주세요'); return; } if (v === cur) return; ACT[t.dataset.a]({ dataset: { k: t.dataset.k, d: String(v - cur) } }); },
  itShelf: itemCh((it, t) => it.shelf = Math.max(1, +t.value || 1)),
  itCas: itemCh((it, t) => it.cas = t.value.trim()),
  itMsds: itemCh((it, t) => { const v = t.value.trim(); it.msds = /^https?:\/\//i.test(v) ? v : (v ? 'https://' + v : ''); }),
  catName: t => { M().categories.find(c => c.id === t.dataset.id).name = t.value.trim() || '분류'; saveMeta(); },
  catColor: t => { M().categories.find(c => c.id === t.dataset.id).color = t.value; saveMeta(); },
  catHz: t => { M().categories.find(c => c.id === t.dataset.id).hazard = t.value; saveMeta(); },
  term: t => { M().terms = { ...(M().terms || {}) }; M().terms[t.dataset.id] = t.value.trim() || PRESETS.science.terms[t.dataset.id]; M().preset = 'custom'; saveMeta(); },
  safetyOn: t => { M().safety = t.checked; saveMeta(); },
  furnLabel: t => { const f = M().furniture.find(x => x.id === ui.furn); if (f) { f.label = t.value.trim() || '가구'; saveMeta(); } },
  memberRole: t => { const m = S.members[t.dataset.id]; if (!m) return; setPath('members/' + t.dataset.id, { ...m, role: t.value }).then(() => toast('역할을 바꿨어요'), dbErr); }
};

function startDrag(e) {
  const t = e.target.closest('[data-drag]'); if (!t || e.button > 0 || e.target.closest('[data-act]')) return;
  const kind = t.dataset.drag, id = t.dataset.id, sx = e.clientX, sy = e.clientY; let moved = false, mv, done;
  if (kind === 'block') {
    const { cab, b } = findBlock(id); if (!b) return; const S2 = ui.S, shift = e.shiftKey;
    // 함께 옮길 블록: 고른 블록들 → 묶음 → 이 블록 하나
    const set = ui.sel.length > 1 && ui.sel.includes(id) ? cab.blocks.filter(x => ui.sel.includes(x.id)) : isGrouped(cab, b) ? groupOf(cab, b) : [b];
    const ids = new Set(set.map(x => x.id)), els = set.map(x => document.querySelector(`.block[data-id="${x.id}"]`)).filter(Boolean);
    const minC = -Math.min(...set.map(x => x.c)), maxC = cab.cols - Math.max(...set.map(x => x.c + x.w));
    const minR = -Math.min(...set.map(x => x.r)), maxR = cab.rows - Math.max(...set.map(x => x.r + x.h));
    const hits = (x, c, r) => cab.blocks.some(o => !ids.has(o.id) && c < o.c + o.w && o.c < c + x.w && r < o.r + o.h && o.r < r + x.h);
    let dc = 0, dr = 0, ok = true;
    mv = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; moved = true;
      dc = clamp(Math.round((ev.clientX - sx) / S2), minC, maxC); dr = clamp(Math.round((ev.clientY - sy) / S2), minR, maxR);
      ok = !set.some(x => hits(x, x.c + dc, x.r + dr));
      set.forEach((x, i) => { const el = els[i]; if (!el) return; el.classList.add('dragging'); el.style.left = (x.c + dc) * S2 + 3 + 'px'; el.style.top = (x.r + dr) * S2 + 3 + 'px'; el.classList.toggle('bad', !ok); });
    };
    done = () => {
      if (moved) {
        if (ok && (dc || dr)) { set.forEach(x => { x.c += dc; x.r += dr; }); if (!ui.multi && !ui.sel.length) ui.block = b.id; saveCab(cab.id); if (set.length > 1) toast(`블록 ${set.length}개를 함께 옮겼어요`); }
        else if (!ok) toast('다른 블록과 겹쳐서 옮기지 않았어요');
        render();
      } else if (ui.multi || shift) {
        if (!ui.multi) { ui.multi = true; if (ui.block && ui.block !== id) ui.sel = [ui.block]; ui.block = null; }
        ui.sel = ui.sel.includes(id) ? ui.sel.filter(x => x !== id) : [...ui.sel, id]; render();
      } else { ui.block = ui.block === id ? null : id; render(); }
    };
  } else {
    const isCab = kind === 'cab', key = (isCab ? 'c:' : 'f:') + id, items = floorItems(), me = items.find(x => x.k === key); if (!me) return;
    // 함께 옮길 것: 고른 것들 → 묶음 → 이것 하나
    const set = ui.fsel.length > 1 && ui.fsel.includes(key) ? items.filter(x => ui.fsel.includes(x.k)) : floorGrouped(me.o) ? floorGroup(me.o.group) : [me];
    const size = x => x.cab ? cabFoot(x.o) : { w: x.o.w, h: x.o.h }, R = M().room, U = ui.U, shift = e.shiftKey;
    const lk = layoutLocked() || set.some(x => x.o.locked), start = set.map(x => ({ x: x.o.x, y: x.o.y }));
    const minX = -Math.min(...set.map(x => x.o.x)), maxX = Math.min(...set.map(x => R.w - size(x).w - x.o.x));
    const minY = -Math.min(...set.map(x => x.o.y)), maxY = Math.min(...set.map(x => R.h - size(x).h - x.o.y));
    const els = set.map(x => document.querySelector(`[data-drag="${x.cab ? 'cab' : 'furn'}"][data-id="${x.o.id}"]`));
    let dx = 0, dy = 0;
    mv = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return; moved = true; if (lk) return;
      dx = clamp(snap((ev.clientX - sx) / U), minX, Math.max(minX, maxX)); dy = clamp(snap((ev.clientY - sy) / U), minY, Math.max(minY, maxY));
      set.forEach((x, i) => { x.o.x = start[i].x + dx; x.o.y = start[i].y + dy; const el = els[i]; if (el) { el.classList.add('dragging'); el.style.left = x.o.x * U + 'px'; el.style.top = x.o.y * U + 'px'; } });
    };
    done = () => {
      if (moved) {
        if (lk) { toast(set.length > 1 ? '잠긴 것이 있어서 함께 옮길 수 없어요' : '위치가 잠겨 있어요'); return; }
        if (dx || dy) { saveFloor(set); if (set.length > 1) toast(`${set.length}개를 함께 옮겼어요`); }
        render();
      } else if (ui.fmulti || shift) {
        if (!ui.fmulti) { ui.fmulti = true; if (ui.furn) ui.fsel = ['f:' + ui.furn]; ui.furn = null; }
        ui.fsel = ui.fsel.includes(key) ? ui.fsel.filter(k => k !== key) : [...ui.fsel, key]; render();
      } else if (isCab) { ui.view = 'cab'; ui.cab = id; ui.block = null; render(); }
      else { ui.furn = ui.furn === id ? null : id; render(); }
    };
  }
  try { t.setPointerCapture(e.pointerId); } catch (_) {}
  const up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); done(); };
  t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
}

export function installHandlers() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const k = t.dataset.act + ':' + (t.dataset.id || 'x'); if (ui.confirm && ui.confirm !== k) ui.confirm = null;
    const fn = ACT[t.dataset.act]; if (fn) fn(t, e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.photo) { ui.photo = null; render(); return; }
    // 크기 칸: Enter로 바로 적용
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('stepnum')) { e.preventDefault(); e.target.blur(); return; }
    // Ctrl(⌘)+C / V: 입력 칸 밖에서만. 조립 화면은 블록, 배치도는 보관장
    const typing = e.target.matches && e.target.matches('input,textarea,select');
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing && ui.phase === 'ready') {
      const k = e.key.toLowerCase();
      if (k === 'c' && ui.view === 'cab' && (ui.sel.length || ui.block)) { e.preventDefault(); ACT.copyBlocks({ dataset: ui.sel.length ? {} : { id: ui.block } }); return; }
      if (k === 'c' && ui.view === 'cab' && findCab(ui.cab)) { e.preventDefault(); ACT.copyCab(); return; }
      if (k === 'v' && ui.clip) {
        e.preventDefault();
        if (ui.clip.type === 'cab') { ACT.pasteCab(); return; }
        if (ui.view === 'cab' && findCab(ui.cab)) { ACT.pasteBlocksAuto(); return; }
        toast(`블록은 ${T('cab')} 조립 화면에서 붙여 넣을 수 있어요`); return;
      }
    }
    if (e.key === 'Enter' && e.target.id === 'new-item') { e.preventDefault(); ACT.addItem(); return; }
    if (e.key === 'Enter' && e.target.id === 'invite-email') { e.preventDefault(); ACT.invite(); return; }
    if (e.key === 'Enter' && e.target.id === 'newroom-name') { e.preventDefault(); ACT.addRoom(); return; }
    if (e.key === 'Escape' && ui.addingRoom) { ui.addingRoom = false; render(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('block')) { e.preventDefault(); const id = e.target.dataset.id; if (ui.multi) ui.sel = ui.sel.includes(id) ? ui.sel.filter(x => x !== id) : [...ui.sel, id]; else ui.block = id; render(); }
    if (e.key === 'Escape' && ui.clip && !(ui.multi || ui.sel.length || ui.fmulti || ui.fsel.length)) { ui.clip = null; render(); return; }
    if (e.key === 'Escape' && (ui.multi || ui.sel.length || ui.fmulti || ui.fsel.length)) { ui.multi = false; ui.sel = []; ui.fmulti = false; ui.fsel = []; render(); return; }
  });
  document.addEventListener('change', e => {
    if (e.target.dataset && e.target.dataset.photoUp) {
      const f = e.target.files[0], id = e.target.dataset.photoUp; e.target.value = ''; if (!f) return;
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(f.name)) { toast('사진 파일만 넣을 수 있어요'); return; }
      toast('사진을 줄여서 저장하는 중이에요…');
      savePhoto(locate(id).it, f).then(at => { const { cab, it } = locate(id); if (!it) return; it.photoAt = at; saveCab(cab.id); render(); toast('사진을 넣었어요'); })
        .catch(err => { if (err && err.message === 'too-big') toast('사진이 너무 커요. 다른 사진을 골라 주세요.'); else if (err && err.code) dbErr(err); else toast('이 사진을 읽지 못했어요. JPG나 PNG로 바꿔서 넣어 주세요.'); });
      return;
    }
    if (e.target.id === 'io-file') { const f = e.target.files[0]; if (!f) return; f.text().then(txt => { $('#io-in').value = txt; toast('파일을 읽었어요. ‘불러오기’를 누르세요'); }); return; }
    const t = e.target.closest('[data-ch]'); if (!t || !CH[t.dataset.ch] || ui.phase !== 'ready' || !S.meta) return;
    CH[t.dataset.ch](t); render();
  });
  $('#q').addEventListener('input', e => { ui.q = e.target.value; if (['set', 'qr', 'stats', 'backup'].includes(ui.view)) ui.view = 'room'; render(); });
  document.addEventListener('pointerdown', startDrag);
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') { ui.photo = null; render(); } });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (ui.phase === 'ready' && (ui.view === 'room' || ui.view === 'cab')) render(); }, 150); });
}
