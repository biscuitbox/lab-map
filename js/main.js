// 시작: 구글 로그인 → 승인 확인 → Firestore 실시간 구독
import { configured, watchAuth, redirectResult, getPath, setPath, watchDoc, watchCol } from './firebase.js';
import { $, S, ui, clone, pending, dbErr, isCfgAdmin, isManager, findBlock, myEmail, migrateMeta, setRoom, roomOf, rooms, saveMeta, saveCab, toast, remember, forgetHistory } from './state.js';
import { render } from './views.js';
import { OPEN_TO_ALL_GOOGLE } from './config.js';
import { installHandlers } from './actions.js';
import { maybeAutoBackup, pruneOld, createBackup } from './backup.js';

installHandlers();

let memberUnsub = null, reqUnsub = null, dataSubs = [], subsAsManager = false;
const stop = list => { list.forEach(u => { try { u(); } catch (e) {} }); list.length = 0; };

/* 입력 중에는 다시 그리지 않고, 입력란을 벗어나면 그림 */
function soft() {
  const a = document.activeElement;
  if (a && a.matches && a.matches('main input:not([type=color]):not([type=file]),main textarea')) { ui.deferred = true; return; }
  render();
}
document.addEventListener('focusout', () => {
  if (!ui.deferred) return;
  setTimeout(() => { const a = document.activeElement; if (!(a && a.matches && a.matches('main input,main textarea'))) { ui.deferred = false; render(); } }, 0);
});

/* QR로 들어왔을 때 (#b-블록id) 그 블록 열기 */
function applyHash() {
  if (ui.hashDone || !S.metaLoaded) return;
  const m = /^#b-([A-Za-z0-9]+)$/.exec(location.hash || '');
  if (!m) { ui.hashDone = true; return; }
  const { cab, b } = findBlock(m[1]); if (!cab) return;
  ui.hashDone = true; setRoom(roomOf(cab)); ui.view = 'cab'; ui.cab = cab.id; ui.block = b.id;
  setTimeout(() => { const p = $('#blockPanel'); if (p && window.innerWidth < 880) p.scrollIntoView({ block: 'start' }); }, 80);
}
window.addEventListener('hashchange', () => { ui.hashDone = false; applyHash(); render(); });

/* 보내는 중인 내 변경은 지키고 나머지는 서버 내용으로 맞춤 */
function mergeColl(prefix, store, list) {
  const next = {}; list.forEach(d => { next[d.id] = clone(d.data); });
  // 서버에서 온 내용은 되돌리기 기준으로 기억만 해요(다른 사람이 바꾼 것은 내 되돌리기 단계가 아니에요)
  new Set([...Object.keys(next), ...Object.keys(store)]).forEach(id => { if (pending(prefix + id)) { if (store[id]) next[id] = store[id]; else delete next[id]; } else remember(prefix + id, next[id] || null); });
  return next;
}

/* 예전(특별실 하나) 데이터를 여러 특별실 형식으로 한 번 옮겨 저장. 옮기기 전에 백업을 남겨요 */
let legacy = false;
async function maybeMigrate() {
  if (!legacy || ui.migrated || !S.cabsLoaded || !S.meta) return;
  ui.migrated = true;
  await createBackup('manual', '여러 특별실로 바꾸기 전 자동 백업');
  saveMeta();
  const first = rooms()[0].id;
  Object.values(S.cabs).forEach(c => { if (c.roomId !== roomOf(c) || !c.roomId) { c.roomId = first; saveCab(c.id); } });
  legacy = false;
  toast('이제 여러 특별실을 관리할 수 있어요. 지금까지의 내용은 첫 특별실에 그대로 있어요.');
}

function startData() {
  stop(dataSubs);
  subsAsManager = isManager();
  dataSubs.push(watchDoc('meta/main', d => {
    if (!pending('meta/main')) { legacy = !!d && !Array.isArray(d.rooms); S.meta = d ? migrateMeta(clone(d)) : null; remember('meta/main', S.meta); }
    S.metaLoaded = true; applyHash(); soft(); maybeMigrate(); maybeAutoBackup();
  }, dbErr));
  dataSubs.push(watchCol('cabinets', (l, fromCache) => { S.cabs = mergeColl('cabinets/', S.cabs, l); if (!fromCache) S.cabsLoaded = true; applyHash(); soft(); maybeMigrate(); maybeAutoBackup(); }, dbErr));
  dataSubs.push(watchCol('trash', l => { S.trash = mergeColl('trash/', S.trash, l); soft(); }, dbErr));
  dataSubs.push(watchCol('backupIndex', (l, fromCache) => { S.bidx = Object.fromEntries(l.map(d => [d.id, d.data])); if (!fromCache) S.idxLoaded = true; soft(); maybeAutoBackup(); pruneOld(); }, dbErr));
  dataSubs.push(watchCol('loans', l => { S.loans = mergeColl('loans/', S.loans, l); soft(); }, dbErr));
  dataSubs.push(watchCol('logs', l => { S.logs = mergeColl('logs/', S.logs, l); soft(); }, dbErr));
  dataSubs.push(watchCol('members', l => { S.members = Object.fromEntries(l.map(d => [d.id, d.data])); soft(); }, () => {}));
  if (subsAsManager) {
    dataSubs.push(watchCol('requests', l => { S.requests = l.map(d => ({ id: d.id, ...d.data })); soft(); }, () => {}));
    dataSubs.push(watchCol('invites', l => { S.invites = Object.fromEntries(l.map(d => [d.id, d.data])); soft(); }, () => {}));
  }
}

function evalAccess() {
  const ok = !!S.member || isCfgAdmin() || OPEN_TO_ALL_GOOGLE;
  if (ok) {
    if (reqUnsub) { reqUnsub(); reqUnsub = null; }
    if (ui.phase !== 'ready') { ui.phase = 'ready'; startData(); }
    else if (subsAsManager !== isManager()) startData();
  } else {
    stop(dataSubs); S.metaLoaded = false; S.meta = null; S.cabs = {}; S.loans = {}; S.logs = {};
    if (ui.phase !== 'gate') {
      ui.phase = 'gate';
      reqUnsub = watchDoc('requests/' + S.auth.uid, d => { S.myReq = d; soft(); }, () => {});
    }
  }
  soft();
}

async function onUser(u) {
  stop(dataSubs); if (memberUnsub) { memberUnsub(); memberUnsub = null; } if (reqUnsub) { reqUnsub(); reqUnsub = null; }
  Object.assign(S, { auth: u, member: null, meta: null, metaLoaded: false, cabs: {}, members: {}, invites: {}, requests: [], loans: {}, logs: {}, myReq: null, trash: {}, bidx: {}, cabsLoaded: false, idxLoaded: false });
  forgetHistory();
  Object.assign(ui, { hashDone: false, autoBackupDone: false, pruned: false, cmp: null, migrated: false });
  if (!u) { ui.phase = 'signin'; render(); return; }
  ui.phase = 'checking'; render();
  const path = 'members/' + u.uid, profile = { email: myEmail(), name: u.displayName || '', photo: u.photoURL || '' };
  try {
    const m = await getPath(path);
    if (!m && isCfgAdmin()) await setPath(path, { ...profile, role: 'admin', at: Date.now(), by: u.uid });
    else if (!m) {
      const inv = await getPath('invites/' + profile.email).catch(() => null);
      if (inv) await setPath(path, { ...profile, role: 'member', at: Date.now(), by: inv.by || '' });
    } else if (m.name !== profile.name || m.photo !== profile.photo) {
      setPath(path, { ...m, name: profile.name, photo: profile.photo }).catch(() => {});
    }
  } catch (e) { console.error(e); }
  memberUnsub = watchDoc(path, d => { S.member = d; evalAccess(); }, () => { S.member = null; evalAccess(); });
}

if (!configured) { ui.phase = 'noconfig'; render(); }
else {
  render();
  redirectResult().catch(e => { ui.reqErr = e && e.code === 'auth/unauthorized-domain' ? '이 주소가 Firebase 승인 도메인에 없어요. SETUP.md 3단계를 확인해 주세요.' : ''; render(); });
  watchAuth(onUser);
}
