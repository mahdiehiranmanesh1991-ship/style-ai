// Tiny IndexedDB wrapper. Stores: items (wardrobe), outfits (lookbook), kv (profile & settings).
const DB_NAME = 'style-ai';
const VERSION = 1;
let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};
export const all = (store) => tx(store, 'readonly', (s) => s.getAll());
export const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
export const put = (store, val, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => tx(store, 'readwrite', (s) => s.clear());
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Export everything (images are already data URLs) as a JSON-serializable object. */
export async function exportAll() {
  const [items, outfits] = await Promise.all([all('items'), all('outfits')]);
  const profile = await get('kv', 'profile'); const settings = await get('kv', 'settings');
  return { app: 'style-ai', version: 1, exportedAt: new Date().toISOString(), items, outfits, profile: profile || null, settings: settings || null };
}
export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'style-ai') throw new Error('فایل پشتیبان معتبر نیست.');
  if (replace) { await clear('items'); await clear('outfits'); }
  for (const it of data.items || []) await put('items', it);
  for (const o of data.outfits || []) await put('outfits', o);
  if (data.profile) await put('kv', data.profile, 'profile');
  if (data.settings) await put('kv', data.settings, 'settings');
  return { items: (data.items || []).length, outfits: (data.outfits || []).length };
}
