const DB_NAME = 'AssignmentFilesDB';
const STORE_NAME = 'files';
let db;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
 */
export function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

/**
 * Adds a file to the IndexedDB store.
 * @param {string} assignmentId - The ID of the main assignment.
 * @param {string} subId - The ID of the sub-assignment.
 * @param {File} file - The file object to store.
 * @returns {Promise<void>}
 */
export async function addFile(assignmentId, subId, file) {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const fileRecord = {
        id: `${assignmentId}_${subId}_${file.name}`,
        assignmentId: assignmentId,
        subId: subId,
        file: file,
        name: file.name,
        type: file.type
    };
    return new Promise((resolve, reject) => {
        const request = store.put(fileRecord);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error adding file: ' + event.target.errorCode);
    });
}

/**
 * Retrieves all files for a specific sub-assignment.
 * @param {string} assignmentId - The ID of the main assignment.
 * @param {string} subId - The ID of the sub-assignment.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of file records.
 */
export async function getFilesForAssignment(assignmentId, subId) {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const allRecords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error getting files: ' + event.target.errorCode);
    });

    return allRecords.filter(record => record.assignmentId === assignmentId && record.subId === subId);
}

/**
 * Deletes a file from IndexedDB by its unique ID.
 * @param {string} fileId - The unique ID of the file to delete.
 * @returns {Promise<void>}
 */
export async function deleteFile(fileId) {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject('Error deleting file: ' + event.target.errorCode);
    });
}

/**
 * Retrieves all files from the database to include in the final submission.
 * @returns {Promise<Array<object>>}
 */
export async function getAllFiles() {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error fetching all files.');
    });
}