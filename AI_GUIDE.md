# AI 수정 안내서 — 특별실 물품 지도

> 이 파일은 ChatGPT, Gemini, Claude 같은 생성형 AI에게 이 사이트를 고쳐 달라고 할 때 **함께 주는 설명서**예요.
> AI는 이 파일을 먼저 읽고, 아래 규칙을 지키며 코드를 고쳐야 해요.
> (Claude Code에서는 이 파일을 `CLAUDE.md`, Codex·Gemini CLI 같은 도구에서는 `AGENTS.md`로 복사해 두면 자동으로 읽어요.)

---

## 1. 사람을 위한 사용법 (선생님용)

### AI에게 이렇게 부탁하세요
1. 대화창에 **이 파일(AI_GUIDE.md)** 을 먼저 첨부해요.
2. 고치고 싶은 내용과 관련된 파일을 함께 첨부해요. 어떤 파일인지 모르겠으면 아래 [4. 파일별 역할](#4-파일별-역할)을 보거나, 전부(`index.html`, `css/style.css`, `js/` 폴더 안 파일 모두, `firestore.rules`) 첨부해요.
3. 아래처럼 부탁해요.

```
첨부한 AI_GUIDE.md의 규칙을 지켜서 고쳐 줘.
하고 싶은 것: 물품에 '구입일' 칸을 추가하고, 재고 목록 표와 CSV에도 보이게 해 줘.
고친 파일은 파일 전체를 다시 보여 주고, 무엇을 바꿨는지 짧게 알려 줘.
firestore.rules를 바꿔야 하면 그것도 알려 줘.
```

### 부탁 예시
- "대여 기록에 '빌려간 학생 수' 칸을 추가해 줘."
- "재고 부족이면 배치도 블록에도 빨간 점을 보여 줘."
- "특별실별로 담당 선생님을 정해서, 담당자만 그 특별실을 고칠 수 있게 해 줘."
- "특별실 종류에 '방송실'을 추가해 줘. 보관장은 '장비장', 모둠 탁자는 '촬영대'로."
- "학생 도우미용 '보기만 가능' 역할을 만들어 줘."
- "유효기한이 7일 남은 약품은 맨 위에 따로 모아 보여 줘."

### 고친 뒤 꼭 확인할 것
- GitHub에 올리기 전에 컴퓨터에서 `index.html`을 열지 말고(로그인이 안 돼요), 올린 뒤 사이트에서 직접 확인해요.
- 화면이 하얗게 나오면 키보드 **F12 → Console** 탭의 빨간 오류 문구를 복사해서 AI에게 다시 보여 주세요.
- 설치 순서는 `SETUP.md`에 있어요.
- `firestore.rules`가 바뀌었다면 Firebase 콘솔의 규칙 탭에 새로 붙여 넣고 **게시**해야 적용돼요.
- 큰 수정 전에는 사이트의 **백업·휴지통 → 지금 상태를 파일로 내려받기**를 먼저 해 두세요.
- 다른 학교에 파일을 나눠 줄 때는 `js/config.js`의 Firebase 설정값과 관리자 이메일을 지우고 주세요.

---

## 2. 사이트 한눈에 보기 (AI용)

학교 특별실(과학실, 음악실 등)의 보관장을 **칸 블록으로 조립**하고, 블록마다 물품과 재고를 관리하는 웹사이트.

- **배포:** GitHub Pages (정적 파일만. 빌드 과정 없음)
- **저장·로그인:** Firebase — Firestore(실시간 DB) + Authentication(Google 로그인)
- **언어:** 순수 HTML, CSS, JavaScript ES 모듈. 프레임워크·번들러·npm 없음
- **외부 스크립트:** Firebase SDK 10.12.2 (gstatic CDN, ES 모듈), qrcode-generator 1.4.4 (jsDelivr, 전역 `qrcode`)
- **사용자:** 한국 중학교 교사. 화면 문구는 모두 한국어
- **접근:** 구글 로그인 + 관리자 승인. 보안은 `firestore.rules`가 서버에서 지킴

### 주요 화면 (탭)
| 탭 | `ui.view` 값 | 그리는 함수 |
|---|---|---|
| 배치도 | `room` | `renderRoom` |
| 실험장 조립 | `cab` | `renderCab` → `blockPanel` / `idlePanel` / `itemCard` |
| 재고 목록 | `list` | `renderList` |
| 대여 기록 | `loans` | `renderLoans` |
| 사용 통계 | `stats` | `renderStats` |
| QR 라벨 | `qr` | `renderQr`, `labelsHtml` |
| 백업·휴지통 | `backup` | `renderBackup` |
| 설정·사용자 | `set` | `renderSet` |
| 로그인·승인·시작 화면 | (`ui.phase`) | `renderGate` |

---

## 3. 꼭 지킬 규칙

1. **빌드 도구, 프레임워크(React, Vue 등), npm 패키지를 추가하지 마세요.** 파일을 그대로 GitHub에 올리면 동작해야 해요.
2. **화면 문구는 한국어 해요체**로, 짧고 쉽게. 교사가 바로 알아듣는 말을 쓰고 개발 용어(문서, 컬렉션, 동기화 등)는 화면에 쓰지 않아요.
3. **사용자 입력은 화면에 넣을 때 반드시 `esc()`로 감싸요.** (이름, 메모 등 모든 문자열)
4. **'실험장', '실험대', '과학실' 같은 말을 화면에 직접 쓰지 말고 `T('cab')`, `T('bench')`, `T('room')`을 써요.** 다른 특별실에서도 쓰기 때문이에요. 조사는 `j(T('cab'), '을/를')`처럼 붙여요. (`'이/가'`, `'은/는'`, `'과/와'`, `'으로/로'`)
5. **약품 안전 관련 화면(GHS, MSDS, 위험 성질, 보관 경고)은 `safetyOn()`이 참일 때만** 보여요.
6. **Firestore에 새 경로(컬렉션)를 만들면 `firestore.rules`에도 규칙을 꼭 추가**해요. 규칙이 없으면 모든 읽기·쓰기가 거절돼요. 규칙을 느슨하게 만들지 마세요(`allow read, write: if true` 금지).
7. **지우는 동작은 휴지통을 거쳐요.** 물품·블록·보관장·대여 기록을 지울 때는 `toTrash()`로 먼저 넣고 `undoable()`로 '되돌리기' 토스트를 띄워요. 한꺼번에 바꾸는 동작(불러오기, 모두 비우기, 전체 되돌리기)은 그 전에 `createBackup('manual', '…')`을 불러요.
8. **위험한 버튼은 두 번 눌러야 실행**돼요. `confirmBtn(act, id, '라벨', '한 번 더 누르면 …')`와 `needConfirm(key)`를 써요. `alert`, `confirm`, `prompt`는 쓰지 않아요.
9. **색은 `css/style.css`의 `:root` 변수(`--bg`, `--ink`, `--accent` 등)만** 써요. 밝은 화면과 어두운 화면 둘 다 확인해요. 분류 색(블록 색)만 예외로 데이터에 저장된 색을 써요.
10. **화면 폭 400px(휴대폰)에서도** 가로 스크롤 없이 보여야 해요. 표는 `.tablewrap` 안에 넣어요.
11. **Firestore 문서에 `undefined` 값을 넣지 마세요.** 저장 전 `clone()`(JSON 복사)을 거치면 안전해요. 빈 값은 `''` 또는 `null`.
12. **Firebase Storage를 쓰지 마세요.** 2026년 2월부터 무료 요금제에서 쓸 수 없어요. 사진·파일은 `photos.js`처럼 줄여서 Firestore에 저장해요.
13. 고친 파일은 **파일 전체**를 다시 보여 주고, `firestore.rules`나 `config.js`를 바꿔야 하는지 알려 주세요.

---

## 4. 파일별 역할

```
index.html        화면 뼈대. 탭 버튼(<nav id="tabs">)과 각 탭의 빈 <section id="v-이름">
help.html         사용설명서 페이지 (로그인 없이 볼 수 있음, 데이터 없음)
css/style.css     모든 디자인. 맨 위 :root 에 색·글꼴 변수
js/config.js      Firebase 설정값, 처음 관리자 이메일, SITE_TITLE, SITE_URL, OPEN_TO_ALL_GOOGLE
js/firebase.js    Firebase 초기화와 얇은 도우미: login, logout, watchAuth, getPath, setPath, delPath, watchDoc, watchCol
js/state.js       공유 상태 S, 화면 상태 ui, 상수, 계산 도우미, 저장 대기열(put), 이름 바꾸기(T, j), 프리셋
js/views.js       모든 화면 그리기 (문자열 HTML → innerHTML)
js/actions.js     버튼(ACT)·입력(CH)·끌기 동작, CSV·파일 내려받기
js/backup.js      휴지통 되살리기, 자동·수동 백업, 오래된 백업 정리
js/photos.js      물품 사진: 캔버스로 줄여 JPEG data URL로 photos/{물품id}에 저장, 화면의 img[data-photo]를 채움(hydratePhotos)
js/main.js        시작: 로그인 → 승인 확인 → Firestore 실시간 구독
data/sample.json  '예시 데이터로 시작'에 쓰는 과학실 예시
firestore.rules   Firestore 보안 규칙 (Firebase 콘솔에 붙여 넣음)
README.md         GitHub 첫 화면 소개
SETUP.md          설치 안내 (Firebase·GitHub Pages 설정 순서)
LICENSE           MIT 이용 조건
```

모듈 의존 방향: `config ← firebase ← state ← views ← actions ← main` (`backup`은 state·firebase를 씀). `state.js`는 `views.js`를 불러오지 않아요(순환 방지).

---

## 5. 동작 구조

### 상태
- `S` (state.js): Firestore와 맞춰지는 데이터
  - `S.auth` 로그인한 Firebase 사용자, `S.member` 내 `members` 문서
  - `S.meta` 사이트 설정 하나(`siteTitle` + 특별실 목록 `rooms`), `S.cabs` 모든 특별실의 보관장 `{id: cabinet}`, `S.loans`, `S.logs`, `S.trash`, `S.bidx`(백업 목록), `S.members`, `S.invites`, `S.requests`, `S.myReq`
- `ui` (state.js): 이 브라우저에만 있는 화면 상태 (`ui.view`, 선택한 보관장 `ui.cab`, 선택한 블록 `ui.block`, 검색어 `ui.q`, 두 번 누르기 대기 `ui.confirm` 등)
- `ui.phase`: `'boot' | 'noconfig' | 'signin' | 'checking' | 'gate' | 'ready'`

### 여러 특별실
- `ui.room` = 지금 보고 있는 특별실 id (이 브라우저에 기억). 바꿀 때는 꼭 `setRoom(id)`를 써요.
- `M()` = **지금 특별실 객체**(`roomName`, `room`(바닥), `categories`, `furniture`, `layoutLocked`, `terms`, `preset`, `safety`). 특별실 설정을 바꾸면 `saveMeta()`.
- `rooms()` 모든 특별실(순서대로), `roomById(id)`, `curRoom()`, `roomOf(cab)` 보관장이 놓인 특별실 id.
- `cabList()` = 지금 특별실의 보관장, `cabList('all')` 또는 `allCabs()` = 모든 특별실. `locate()`·`findBlock()`은 항상 모든 특별실에서 찾아요.
- `cat(id, roomId)` 분류는 그 특별실 → 다른 특별실 순서로 찾아요. 다른 특별실의 물품을 그릴 때는 `roomOf(cab)`을 넘겨요.
- `T(k, room)`, `safetyOn(room)`도 특별실별이에요. 재고·대여·통계의 범위는 `ui.scope`('room'|'all')와 `scopeChips()`, `inScope(roomId)`로 정해요.
- 예전 형식(meta/main에 categories가 바로 있음)은 `migrateMeta()`가 첫 특별실(id `main`)로 바꿔요. 처음 열 때 백업한 뒤 저장해요(`main.js`의 `maybeMigrate`).

### 그리기
- `render()` 하나가 현재 탭 전체를 **문자열 HTML로 다시 그려요**. 부분 갱신 없음.
- 다시 그린 뒤 포커스를 잃지 않도록, **입력칸에는 항상 고정된 `id`** 를 줘요 (예: `it-${it.id}-qty`). `render()`가 같은 id로 포커스를 되돌려요.
- 다른 사람이 바꾼 데이터가 들어올 때는 `main.js`의 `soft()`가 그려요. 입력 중이면 입력칸을 벗어날 때까지 기다려요.

### 이벤트 (위임 방식)
- 버튼: `data-act="이름"` → `actions.js`의 `ACT.이름(element, event)`. 값은 `data-id`, `data-d` 같은 `data-*`로 넘겨요.
- 입력칸·선택 상자: `data-ch="이름"` → `CH.이름(element)` (`change` 이벤트). 처리 뒤 `render()`가 자동으로 불려요.
- 끌기: `data-drag="cab" | "furn" | "block"` → `startDrag`. 블록은 `ui.sel`(여러 블록 고르기) → 묶음(`groupOf`) → 한 블록 순서로, 배치도는 `ui.fsel`('c:보관장id'·'f:가구id') → 묶음(`floorGroup`) → 하나 순서로 함께 옮길 대상을 정해요.

### 저장
- 데이터를 바꾸는 순서: **① `S`를 직접 고침 → ② 저장 함수 호출 → ③ `render()`**
  - `saveMeta()` → `meta/main`
  - `saveCab(id)` → `cabinets/{id}` (보관장 하나 통째로. 블록·물품도 그 안에)
  - `saveLoan(id)` → `loans/{id}`
  - 그 밖은 `put(경로, 데이터)` (데이터가 `null`이면 삭제)
- `put()`은 문서마다 한 번에 하나씩, 가장 최근 내용만 저장해요. 저장 중인 문서는 `pending(경로)`가 참이고, 그동안 서버에서 온 옛 내용으로 덮어쓰지 않아요(`mergeColl`).
- 수량을 바꿀 때는 `logQty(item, 바뀐양)`도 불러서 사용 통계에 남겨요.

---

## 6. 데이터 모양 (Firestore)

```js
// meta/main   — 사이트 설정과 특별실 목록 (규칙상 meta 아래 문서이므로 새 규칙이 필요 없어요)
{ version: 3, siteTitle,
  rooms: [{ id, roomName, order, room: { w: 24, h: 15 },        // 바닥 격자 1칸 ≈ 50cm
    categories: [{ id, name, color: '#rrggbb', hazard: ''|'acid'|'base'|'oxidizer'|'flammable'|'toxic' }],
    furniture: [{ id, type: 'bench'|'desk'|'sink', label, x, y, w, h, locked, group }],
    layoutLocked: false, terms: { room, cab, bench, desk, sink }, preset: 'science'|'maker'|'music'|…|'custom', safety: true }] }

// cabinets/{id}   — 보관장 하나 (roomId = 놓인 특별실, group = 배치도 묶음. 같은 특별실의 가구 group과 같은 값이면 함께 움직여요)
{ id, roomId, group, name, cols, rows, x, y, locked, order,
  blocks: [{ id, c, r, w, h, label, cat, shelves: 1~4, group: ''|groupId,   // c,r = 칸 위치(0부터), w,h = 차지하는 칸 수, shelves = 칸 안의 단 수, group = 같은 값끼리 함께 움직이는 묶음(2개 이상일 때만)
    items: [{ id, name, qty, unit, min: ''|number, expiry: 'YYYY-MM-DD'|'', cat: ''(블록 분류와 같음)|catId,
              cas, msds, ghs: ['GHS01'…'GHS09'], photoAt: ''|ms(사진이 있으면 올린 시각), shelf: 1~4(1 = 맨 아래 단) }] }] }
// 단은 shelvesOf(b), shelfNo(b, it)로 읽어요(빈 값·범위 밖 값을 정리해 줘요). 위치 글자는 shelfTxt(b, it) → ' › 2단' (단이 하나면 '')

// loans/{id}
{ id, itemId, itemName, cabId, blockId, qty, who, due, out, outBy, outByName, returnedAt: null|ms, returnedBy, returnedByName }

// logs/{YYYY-MM}__{uid}  — 한 사람의 한 달 수량 변경 (규칙상 자기 uid 문서에만 씀)
{ month, user, entries: [{ i: itemId, n: name, d: 바뀐양(+/-), t: ms }] }

// trash/{id}       { id, type: 'item'|'block'|'cabinet'|'loan', data, from: { cabId, cabName, blockId, blockLabel, block }, at, by, byName }
// backups/{id}     { version: 3, meta, cabinets, at }   (version 2 백업도 normalize()가 읽어요)       id: 'auto-YYYY-MM-DD' 또는 'm-ms'
// backupIndex/{id} { id, kind: 'auto'|'manual', note, at, by, byName, cabinets, blocks, items }
// members/{uid}    { email, name, photo, role: 'admin'|'member', at, by }
// invites/{email}  { at, by }          (이메일 소문자)
// requests/{uid}   { email, name, photo, at }
// photos/{itemId}  { data: 'data:image/jpeg;base64,…'(300KB 미만), w, h, at, by }   ← Storage 대신 Firestore에 저장(무료 요금제 유지)
```

ID는 `uid()`로 만든 영문·숫자 10자. QR 주소는 `사이트주소#b-{blockId}`.

---

## 7. 자주 하는 수정 방법

### 물품에 새 칸 추가 (예: 구입일 `bought`)
1. `state.js`의 `newItem()`에 기본값 추가: `bought: ''`
2. `views.js`의 `itemCard()`에 입력칸 추가: `<input id="it-${it.id}-bought" type="date" class="field" data-ch="itBought" data-id="${it.id}" value="${esc(it.bought)}">`
3. `actions.js`의 `CH`에 추가: `itBought: itemCh((it, t) => it.bought = t.value),`
4. 필요하면 `renderList()` 표, `ACT.csvInventory` CSV 열, `labelsHtml()`에도 추가
5. `normalize()`는 `newItem()` 기본값을 섞으므로 옛 데이터도 문제없어요. 규칙 변경 필요 없음.

### 새 탭 추가 (예: '점검표' `check`)
1. `index.html`: `<nav id="tabs">`에 `<button role="tab" data-act="tab" data-view="check">점검표</button>`, `<main>`에 `<section id="v-check" hidden></section>`
2. `views.js`: `VIEWS` 배열에 `'check'` 추가, `render()`의 함수 표에 `check: renderCheck`, `function renderCheck() { $('#v-check').innerHTML = …; }` 작성
3. 버튼 동작은 `actions.js`의 `ACT`에 추가

### Firestore에 새 컬렉션 추가 (예: `checks`)
1. `main.js`의 `startData()`에 구독 추가: `dataSubs.push(watchCol('checks', l => { S.checks = mergeColl('checks/', S.checks, l); soft(); }, dbErr));`
2. `state.js`의 `S`에 `checks: {}` 추가, `main.js`의 `onUser()` 초기화 목록에도 추가
3. **`firestore.rules`에 규칙 추가** (예: `match /checks/{docId} { allow read, write: if isMember(); }`) → 콘솔에서 게시

### 특별실 종류(프리셋) 추가
(특별실 종류는 새 특별실을 만들 때 고르는 목록이에요. 특별실 자체를 추가하는 건 화면의 ‘＋ 특별실’이 해요.)
`state.js`의 `PRESETS`에 항목 추가: `broadcast: { label: '방송실', terms: { room: '방송실', cab: '장비장', bench: '촬영대', desk: '조정석', sink: '기타 가구' }, safety: false, cats: cats(['카메라', '마이크', '조명', '케이블', '소모품']) }`

### 새 역할 추가 (예: 보기만 가능 `viewer`)
- `members/{uid}.role`에 `'viewer'`를 쓰고, `state.js`에 `canWrite()`를 만들어 화면의 편집 버튼을 숨겨요.
- **규칙에서도** 쓰기를 막아야 진짜로 막혀요: `function canWrite() { return isMember() && !(exists(memberPath()) && get(memberPath()).data.role == 'viewer'); }`를 만들고 `meta`, `cabinets`, `loans` 등의 `write`를 `canWrite()`로 바꿔요.

---

## 8. 고친 뒤 점검 목록 (AI가 스스로 확인)
- [ ] 모든 `import` 이름이 실제로 `export` 되어 있나
- [ ] 새 입력칸에 고정 `id`와 `data-ch`가 있나, 새 버튼에 `data-act`가 있고 `ACT`에 함수가 있나
- [ ] 사용자 문자열을 `esc()`로 감쌌나
- [ ] 특별실 이름을 `T()`로 썼나, 안전 기능은 `safetyOn()`으로 감쌌나
- [ ] 지금 특별실만 볼 곳은 `cabList()`, 전체를 볼 곳은 `allCabs()`/`ui.scope`를 썼나
- [ ] 새 Firestore 경로에 규칙을 추가했나, 기존 규칙을 느슨하게 만들지 않았나
- [ ] 지우는 동작이 휴지통을 거치나
- [ ] 밝은·어두운 화면, 휴대폰 폭에서 깨지지 않나
- [ ] `help.html` 사용설명서에도 바뀐 기능을 반영했나
