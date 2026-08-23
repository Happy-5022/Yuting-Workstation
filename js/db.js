/* ===== 本地数据库（IndexedDB） =====
   所有数据都存在你这台手机/电脑的浏览器里，不联网也照样能用、能记。
   以后想换手机或清缓存前，记得先导出备份（之后我可以加这个功能）。 */
(function (global) {
  const DB_NAME = 'yt-workbench';
  const DB_VERSION = 8;
  const STORES = ['tasks', 'ideas', 'hot', 'reviews', 'memos', 'uke', 'english', 'viet', 'fitness', 'gratitude', 'ledger', 'travel', 'kids', 'meta', 'vnFav', 'vnWrong', 'enFav', 'enWrong', 'quotes',
    'publish', 'habits', 'assets', 'goals', 'books', 'comp', 'prompts', 'period', 'links'];

  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) {
            const store = db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
            store.createIndex('date', 'date', { unique: false });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode) {
    const db = await open();
    return db.transaction(store, mode).objectStore(store);
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const DB = {
    async all(store) {
      const os = await tx(store, 'readonly');
      return (await wrap(os.getAll())) || [];
    },
    async get(store, id) {
      const os = await tx(store, 'readonly');
      return wrap(os.get(id));
    },
    async put(store, val) {
      const os = await tx(store, 'readwrite');
      const id = await wrap(os.put(val));
      return id;
    },
    async del(store, id) {
      const os = await tx(store, 'readwrite');
      return wrap(os.delete(id));
    },
    // 按日期取（date 字段等于某天，如 '2026-07-22'）
    async byDate(store, date) {
      const os = await tx(store, 'readonly');
      const idx = os.index('date');
      return (await wrap(idx.getAll(date))) || [];
    },
  };

  global.DB = DB;
})(window);
