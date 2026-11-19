// Optional Google sign-in (Firebase) for cloud progress and the Hall of Fame.
// Signed out, Firebase is never loaded; the Hall of Fame loads it only when it is opened.
// The web API key is public by design: access is limited by firestore.rules.
const SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';
const config = {
  apiKey: 'AIzaSyBLuyRjhBj9ujTLvPiHczcQQ36r1pO1qpY',
  authDomain: 'dungeon101-dm.firebaseapp.com',
  projectId: 'dungeon101-dm',
  storageBucket: 'dungeon101-dm.firebasestorage.app',
  messagingSenderId: '119859487562',
  appId: '1:119859487562:web:7a1c08e6c638aeaaabd7b3',
};

const REMEMBER = 'd101_cloud';
const remember = (on) => { try { localStorage.setItem(REMEMBER, on ? '1' : '0'); } catch { /* not remembered */ } };
const remembered = () => { try { return localStorage.getItem(REMEMBER) === '1'; } catch { return false; } };

let A = null, F = null, auth = null, db = null;
async function load() {
  if (db) return;
  const [app, a, f] = await Promise.all([import(`${SDK}firebase-app.js`), import(`${SDK}firebase-auth.js`), import(`${SDK}firebase-firestore.js`)]);
  const fb = app.initializeApp(config);
  A = a; F = f; auth = a.getAuth(fb); db = f.getFirestore(fb);
}

export const Cloud = {
  ready: !!config.apiKey,
  user: null,
  listeners: [],

  onChange(fn) { this.listeners.push(fn); },

  async connect() {
    await load();
    if (!this.bound) {
      this.bound = true;
      A.onAuthStateChanged(auth, (u) => { this.user = u; remember(!!u); this.listeners.forEach((fn) => fn(u)); });
      await auth.authStateReady();
    }
  },

  // brings back last visit's session, quietly; nothing happens for players who never signed in
  async restore() {
    if (!this.ready || !remembered()) return null;
    try { await this.connect(); } catch (e) { console.warn('cloud unavailable', e); }
    return this.user;
  },

  async signIn() {
    await this.connect();
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    await A.signInWithPopup(auth, p);
  },

  async signOut() { if (auth) await A.signOut(auth); remember(false); this.user = null; },

  firstName() { return (this.user?.displayName || '').split(' ')[0] || 'Google'; },

  async pull() {
    const s = await F.getDoc(F.doc(db, 'players', this.user.uid));
    try { return s.exists() ? JSON.parse(s.data().meta) : null; } catch { return null; }
  },

  async push(meta) {
    if (!this.user) return;
    await F.setDoc(F.doc(db, 'players', this.user.uid), { meta: JSON.stringify(meta), updated: F.serverTimestamp() });
  },

  async submit(run) {
    if (!this.user) return;
    await F.addDoc(F.collection(db, 'scores'), { ...run, uid: this.user.uid, at: F.serverTimestamp() });
  },

  async top(n = 25) {
    await load();
    const q = F.query(F.collection(db, 'scores'), F.orderBy('score', 'desc'), F.limit(n));
    return (await F.getDocs(q)).docs.map((d) => d.data());
  },
};
