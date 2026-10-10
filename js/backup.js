// 휴지통에서 되살리기, 자동·수동 백업 만들기, 오래된 백업 정리
import { setPath, delPath } from './firebase.js';
import { deletePhoto, photoIdsIn } from './photos.js';
import {
  S, ui, uid, clone, ymd, put, dbErr, saveCab, saveLoan, locate, canPlace, cabFoot, clamp, T, j, roomOf, roomById,
  exportData, counts, byName, KEEP_DAYS, isManager
} from './state.js';

/* 블록을 원래 자리에, 안 되면 같은 크기로 빈 곳에, 그래도 안 되면 1칸 크기로 넣기 */
export function placeBlock(cab, b) {
  if (canPlace(cab, b, b.c, b.r, b.w, b.h)) { cab.blocks.push(b); return b; }
  for (const [w, h] of [[b.w, b.h], [1, 1]])
    for (let r = 0; r <= cab.rows - h; r++) for (let c = 0; c <= cab.cols - w; c++)
      if (canPlace(cab, b, c, r, w, h)) { Object.assign(b, { c, r, w, h }); cab.blocks.push(b); return b; }
  return null;
}

/* 물품 하나 되살리기. from = {cabId, cabName, blockId, blockLabel, block(모양)} */
export function restoreItem(it, from) {
  if (locate(it.id).it) return { ok: true, msg: `‘${it.name}’은(는) 이미 제자리에 있어요` };
  const cab = S.cabs[from.cabId];
  if (!cab) return { ok: false, msg: `‘${from.cabName || '원래'}’ ${j(T('cab'), '이/가')} 없어요. ${j(T('cab'), '을/를')} 먼저 되살리세요.` };
  let b = cab.blocks.find(x => x.id === from.blockId);
  if (!b) {
    const shape = from.block || { id: from.blockId, c: 0, r: 0, w: 1, h: 1, label: from.blockLabel || '되살린 블록', cat: '' };
    b = placeBlock(cab, { ...clone(shape), id: from.blockId || uid(), items: [] });
    if (!b) return { ok: false, msg: `‘${cab.name}’에 빈 칸이 없어요. 칸을 늘린 뒤 다시 해 주세요.` };
  }
  b.items.push(clone(it)); saveCab(cab.id);
  return { ok: true, msg: `‘${it.name}’을(를) ${cab.name} › ${b.label}에 되살렸어요` };
}

/* 블록 되살리기 (지금 다른 곳에 있는 물품은 빼고) */
export function restoreBlock(block, from) {
  const cab = S.cabs[from.cabId];
  if (!cab) return { ok: false, msg: `‘${from.cabName || '원래'}’ ${j(T('cab'), '이/가')} 없어요. ${j(T('cab'), '을/를')} 먼저 되살리세요.` };
  const existing = cab.blocks.find(x => x.id === block.id);
  if (existing) {
    const add = block.items.filter(it => !locate(it.id).it);
    if (add.length) { existing.items.push(...clone(add)); saveCab(cab.id); }
    return { ok: true, msg: add.length ? `‘${block.label}’ 블록에 물품 ${add.length}종을 되살렸어요` : `‘${block.label}’ 블록은 이미 제자리에 있어요` };
  }
  const nb = clone(block); nb.items = nb.items.filter(it => !locate(it.id).it);
  const placed = placeBlock(cab, nb);
  if (!placed) return { ok: false, msg: `‘${cab.name}’에 빈 칸이 없어요. 칸을 늘린 뒤 다시 해 주세요.` };
  saveCab(cab.id);
  return { ok: true, msg: `‘${block.label}’ 블록을 ${cab.name}에 되살렸어요` };
}

const locateCount = () => Object.values(S.cabs).reduce((a, c) => a + c.blocks.reduce((x, b) => x + b.items.length, 0), 0);

/* 실험장 통째로 되살리기 (이미 있으면 빠진 블록·물품만 채움) */
export function restoreCabinet(cabData) {
  if (S.cabs[cabData.id]) {
    let n = 0;
    cabData.blocks.forEach(b => { const before = locateCount(); const r = restoreBlock(b, { cabId: cabData.id, cabName: cabData.name }); if (r.ok) n += locateCount() - before; });
    return { ok: true, msg: n ? `‘${cabData.name}’에 빠진 물품 ${n}종을 되살렸어요` : `‘${cabData.name}’ ${j(T('cab'), '은/는')} 이미 제자리에 있어요` };
  }
  const c = clone(cabData);
  c.blocks.forEach(b => { b.items = b.items.filter(it => !locate(it.id).it); });
  c.roomId = roomOf(c); const ft = cabFoot(c), R = roomById(c.roomId).room; c.x = clamp(c.x, 0, Math.max(0, R.w - ft.w)); c.y = clamp(c.y, 0, Math.max(0, R.h - ft.h));
  S.cabs[c.id] = c; saveCab(c.id);
  return { ok: true, msg: `‘${c.name}’ ${j(T('cab'), '을/를')} 되살렸어요` };
}

/* 휴지통 항목 되살리기 */
export function restoreTrash(id) {
  const t = S.trash[id]; if (!t) return { ok: false, msg: '휴지통에 없는 항목이에요' };
  let res;
  if (t.type === 'item') res = restoreItem(t.data, t.from);
  else if (t.type === 'block') res = restoreBlock(t.data, t.from);
  else if (t.type === 'cabinet') res = restoreCabinet(t.data);
  else if (t.type === 'loan') {
    if (S.loans[t.data.id]) res = { ok: false, msg: '이미 있는 기록이에요' };
    else { S.loans[t.data.id] = clone(t.data); saveLoan(t.data.id); res = { ok: true, msg: '대여 기록을 되살렸어요' }; }
  } else res = { ok: false, msg: '되살릴 수 없는 항목이에요' };
  if (res.ok) { delete S.trash[id]; put('trash/' + id, null); }
  return res;
}

/* 백업 만들기: backups/{id}에 전체 내용, backupIndex/{id}에 목록용 요약 */
export async function createBackup(kind, note) {
  if (!S.meta) return null;
  const data = clone(exportData()), at = Date.now();
  const id = kind === 'auto' ? `auto-${ymd(new Date())}` : `m-${at}`;
  const idx = { id, kind, note: note || '', at, by: S.auth.uid, byName: byName(), ...counts(data) };
  try {
    await setPath('backups/' + id, { ...data, at });
    await setPath('backupIndex/' + id, idx);
    S.bidx[id] = idx; return id;
  } catch (e) { dbErr(e); return null; }
}

/* 하루에 한 번, 그날 처음 연 사람이 자동 백업 (서버 기준 데이터가 다 왔을 때만) */
export async function maybeAutoBackup() {
  if (ui.autoBackupDone || !S.meta || !S.cabsLoaded || !S.idxLoaded) return;
  ui.autoBackupDone = true;
  if (S.bidx[`auto-${ymd(new Date())}`]) return;
  if (!Object.keys(S.cabs).length) return;
  await createBackup('auto', '하루 첫 접속 자동 백업');
}

/* 관리자가 열 때: 오래된 자동 백업과 휴지통 정리 */
export async function pruneOld() {
  if (ui.pruned || !isManager() || !S.idxLoaded) return;
  ui.pruned = true;
  const list = Object.values(S.bidx).sort((a, b) => b.at - a.at);
  const old = [...list.filter(x => x.kind === 'auto').slice(KEEP_DAYS), ...list.filter(x => x.kind !== 'auto').slice(KEEP_DAYS)];
  for (const x of old) { try { await delPath('backups/' + x.id); await delPath('backupIndex/' + x.id); delete S.bidx[x.id]; } catch (e) { } }
  const limit = Date.now() - KEEP_DAYS * 864e5;
  Object.values(S.trash).filter(t => t.at < limit).forEach(t => { photoIdsIn(t.type, t.data).forEach(id => { if (!locate(id).it) deletePhoto(id); }); delete S.trash[t.id]; put('trash/' + t.id, null); });
}
