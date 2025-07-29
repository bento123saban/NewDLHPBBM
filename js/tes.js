class IndexedDBController {
    constructor(dbName, version) {
        this.dbName   = dbName;
        this.version  = version;
        this.db       = null;
        this.stores   = {};  // Simpan store schema
        this._pendingDeleteIndexes = []; // Queue hapus index
    }

    init(stores) {
        this.stores = stores;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = event => {
                const db = event.target.result;

                // Buat semua store & index seperti biasa
                for (const [storeName, config] of Object.entries(this.stores)) {
                    let store;
                    if (!db.objectStoreNames.contains(storeName)) {
                        store = db.createObjectStore(storeName, config.options || { keyPath: "id" });
                    } else {
                        store = request.transaction.objectStore(storeName);
                    }

                    // Tambah index kalau belum ada
                    const existingIndexes = Array.from(store.indexNames);
                    const indexList = config.indexes || [];

                    indexList.forEach(idx => {
                        const name = idx.name || idx.keyPath;
                        if (!existingIndexes.includes(name)) {
                            store.createIndex(name, idx.keyPath, { unique: idx.unique || false });
                        }
                    });

                    // 🔥 Hapus index sesuai queue
                    const deleteQueue = this._pendingDeleteIndexes.filter(d => d.store === storeName);
                    deleteQueue.forEach(d => {
                        if (store.indexNames.contains(d.index)) {
                            store.deleteIndex(d.index);
                            console.warn(`Index "${d.index}" di store "${storeName}" dihapus.`);
                        }
                    });
                }
            };

            request.onsuccess = event => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = err => reject(err);
        });
    }

    // ✅ Method hapus index, akan aktif di init() versi baru
    removeIndex(storeName, indexName) {
        this._pendingDeleteIndexes.push({ store: storeName, index: indexName });
        this.version++; // Wajib naikkan versi untuk trigger upgrade
        console.info(`[IndexedDB] Jadwalkan hapus index "${indexName}" dari store "${storeName}" di versi ${this.version}`);
    }
}