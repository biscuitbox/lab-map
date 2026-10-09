// Firebase 연결: 구글 로그인 + Firestore 읽기·쓰기
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, setDoc, deleteDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const configured = !!firebaseConfig.apiKey && !/^YOUR/.test(firebaseConfig.apiKey);

let auth = null, db = null;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  auth.languageCode = 'ko';
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    db = getFirestore(app);
  }
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      return signInWithRedirect(auth, provider);
    }
    throw e;
  }
}
export const redirectResult = () => (auth ? getRedirectResult(auth) : Promise.resolve(null));
export const logout = () => signOut(auth);
export const watchAuth = cb => onAuthStateChanged(auth, cb);

const ref = p => doc(db, p);
export async function getPath(p) { const s = await getDoc(ref(p)); return s.exists() ? s.data() : null; }
export const setPath = (p, d) => setDoc(ref(p), d);
export const delPath = p => deleteDoc(ref(p));
export const watchDoc = (p, next, err) => onSnapshot(ref(p), s => next(s.exists() ? s.data() : null, s.metadata.fromCache), err);
export const watchCol = (p, next, err) => onSnapshot(collection(db, p), s => next(s.docs.map(d => ({ id: d.id, data: d.data() })), s.metadata.fromCache), err);
