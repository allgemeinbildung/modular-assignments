const DB_NAME = 'modular-assignments-db';
const ATTACHMENT_STORE = 'attachments';
let db;

function initializeDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
                const store = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('assignment_sub_idx', ['assignmentId', 'subId'], { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

export async function saveAttachment(attachment) {
    const db = await initializeDB();
    const transaction = db.transaction([ATTACHMENT_STORE], 'readwrite');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    return new Promise((resolve, reject) => {
        const request = store.add(attachment);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject('Error saving attachment: ' + e.target.error);
    });
}

export async function getAttachmentsForSubAssignment(assignmentId, subId) {
    const db = await initializeDB();
    const transaction = db.transaction([ATTACHMENT_STORE], 'readonly');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    const index = store.index('assignment_sub_idx');
    return new Promise((resolve, reject) => {
        const request = index.getAll([assignmentId, subId]);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject('Error fetching attachments: ' + e.target.error);
    });
}

export async function getAllAttachments() {
    const db = await initializeDB();
    const transaction = db.transaction([ATTACHMENT_STORE], 'readonly');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject('Error fetching all attachments: ' + e.target.error);
    });
}

export async function deleteAttachment(id) {
    const db = await initializeDB();
    const transaction = db.transaction([ATTACHMENT_STORE], 'readwrite');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject('Error deleting attachment: ' + e.target.error);
    });
}

export async function clearAllAttachments() {
    const db = await initializeDB();
    const transaction = db.transaction([ATTACHMENT_STORE], 'readwrite');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject('Error clearing attachments: ' + e.target.error);
    });
}