class ParcelDB {
    constructor() {
        this.dbName = 'ParcelTrackerDB';
        this.dbVersion = 1;
        this.storeName = 'parcels';
        this.db = null;
    }

    /**
     * 初始化数据库
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('数据库打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // 创建存储对象，使用自动生成的 id 作为主键
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    // 创建索引以便按状态或时间排序
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * 添加包裹
     * @param {object} parcel - { code, courier, location, status, timestamp }
     */
    async addParcel(parcel) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // 确保有默认值
            const data = {
                ...parcel,
                status: parcel.status || 'pending',
                timestamp: parcel.timestamp || Date.now()
            };

            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 获取所有包裹
     * @returns {Promise<Array>}
     */
    async getAllParcels() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('timestamp');
            // 按时间倒序排列
            const request = index.getAll();

            request.onsuccess = () => {
                // 手动倒序排列（IndexedDB 默认升序）
                const results = request.result.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 标记为已取件
     * @param {number} id - 包裹 ID
     */
    async markAsCollected(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const data = getRequest.result;
                if (data) {
                    data.status = 'collected';
                    const updateRequest = store.put(data);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = (event) => reject(event.target.error);
                } else {
                    reject(new Error('未找到该包裹'));
                }
            };
            getRequest.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 删除包裹
     * @param {number} id 
     */
    async deleteParcel(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 清空所有已取件包裹
     */
    async clearAllCollected() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('status');
            const request = index.openCursor(IDBKeyRange.only('collected'));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve(true);
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

// 导出单例
const parcelDB = new ParcelDB();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parcelDB };
}
