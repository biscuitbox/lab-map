// 물품 사진: 브라우저에서 작게 줄여(JPEG) Firestore photos/{물품id} 문서에 저장
// Firebase Storage를 쓰지 않으므로 무료(Spark) 요금제로 쓸 수 있어요.
import { getPath, setPath, delPath } from './firebase.js';
import { S } from './state.js';

const MAX_SIDE = 640;         // 긴 변 최대 픽셀
const MAX_BYTES = 180000;     // 저장할 사진 문자열 최대 크기 (약 180KB)
const cache = {};             // `${id}@${photoAt}` → data URL
const loading = new Set();

const key = it => `${it.id}@${it.photoAt}`;
export const cachedPhoto = it => (it && it.photoAt ? cache[key(it)] || '' : '');

/* 화면에 있는 사진 칸(img[data-photo])을 채움. 처음 한 번만 서버에서 읽고, 그다음부터는 기억해 둔 것을 써요 */
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]').forEach(img => {
    const id = img.dataset.photo, at = img.dataset.at, k = `${id}@${at}`;
    if (cache[k]) { if (img.src !== cache[k]) img.src = cache[k]; return; }
    if (loading.has(k)) return;
    loading.add(k);
    getPath('photos/' + id).then(d => {
      loading.delete(k);
      if (!d || !d.data) return;
      cache[k] = d.data;
      document.querySelectorAll(`img[data-photo="${id}"][data-at="${at}"]`).forEach(x => { x.src = d.data; });
    }).catch(() => loading.delete(k));
  });
}

async function loadImage(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { } }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode(); return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/* 사진 파일 → 작은 JPEG data URL */
export async function shrink(file) {
  const img = await loadImage(file);
  const w0 = img.width, h0 = img.height;
  let side = MAX_SIDE, q = .78, out = '';
  for (let i = 0; i < 6; i++) {
    const s = Math.min(1, side / Math.max(w0, h0)), w = Math.round(w0 * s), h = Math.round(h0 * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    out = c.toDataURL('image/jpeg', q);
    if (out.length <= MAX_BYTES) return { data: out, w, h };
    side = Math.round(side * .8); q = Math.max(.5, q - .08);
  }
  if (out.length > MAX_BYTES) throw new Error('too-big');
  return { data: out };
}

export async function savePhoto(item, file) {
  const p = await shrink(file), at = Date.now();
  await setPath('photos/' + item.id, { data: p.data, w: p.w || 0, h: p.h || 0, at, by: S.auth.uid });
  cache[`${item.id}@${at}`] = p.data;
  return at;
}
export const deletePhoto = itemId => delPath('photos/' + itemId).catch(() => {});

/* 휴지통에서 영구 삭제할 때 함께 지울 사진 목록 */
export function photoIdsIn(type, data) {
  if (type === 'item') return data.photoAt ? [data.id] : [];
  if (type === 'block') return data.items.filter(i => i.photoAt).map(i => i.id);
  if (type === 'cabinet') return data.blocks.flatMap(b => b.items.filter(i => i.photoAt).map(i => i.id));
  return [];
}
