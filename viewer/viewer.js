document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT SELECTORS ---
    const assignmentListContainer = document.getElementById('assignment-list');
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const importBackupBtn = document.getElementById('importBackupBtn');
    const importFileInput = document.getElementById('importFileInput');
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');

    const BACKUP_FILENAME = 'modular_assignments_backup.json';

    // --- CORE FUNCTIONS ---

    /**
     * Finds all unique assignments from localStorage and renders links to them.
     */
    function displayAssignments() {
        assignmentListContainer.innerHTML = '';
        const assignments = new Map();
        
        // --- FIX ---
        // This regex is now more robust. It correctly finds all assignment types
        // by looking for any of the known prefixes (textbox, quiz, tf, drag)
        // and handles the optional "textbox-" in the sub-ID key part.
        const keyRegex = /^(?:textbox|quiz|tf|drag)-assignment_([^_]+)_(?:textbox-)?sub_(.+?)(?:_question_|$)/;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const match = key.match(keyRegex);

            if (match) {
                const [, assignmentId, subId] = match;
                if (!assignments.has(assignmentId)) {
                    assignments.set(assignmentId, new Set());
                }
                assignments.get(assignmentId).add(subId);
            }
        }

        if (assignments.size === 0) {
            assignmentListContainer.innerHTML = '<p>Noch keine Aufgaben bearbeitet. Starte eine Aufgabe, um sie hier zu sehen.</p>';
            return;
        }

        for (const [assignmentId, subIds] of assignments.entries()) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'assignment-group';

            const title = document.createElement('h2');
            title.textContent = `Aufgabe: ${assignmentId}`;
            groupDiv.appendChild(title);

            const list = document.createElement('ul');
            // Convert Set to Array and sort it for consistent order
            const sortedSubIds = Array.from(subIds).sort();
            for (const subId of sortedSubIds) {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `../index.html?assignmentId=${assignmentId}&subId=${subId}`;
                link.textContent = subId.replace(/-/g, ' ');
                listItem.appendChild(link);
                list.appendChild(listItem);
            }
            groupDiv.appendChild(list);
            assignmentListContainer.appendChild(groupDiv);
        }
    }

    /**
     * Gathers all assignment data from localStorage and IndexedDB.
     * @returns {Promise<object>} A promise that resolves with the complete data store.
     */
    async function gatherAllDataForBackup() {
        const dataStore = {
            localStorage: {},
            indexedDB: []
        };

        // 1. Get localStorage data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('textbox-') || key.startsWith('quiz-') || key.startsWith('tf-') || key.startsWith('drag-') || key.startsWith('studentName')) {
                dataStore.localStorage[key] = localStorage.getItem(key);
            }
        }

        // 2. Get IndexedDB data
        dataStore.indexedDB = await getAllFiles();

        return dataStore;
    }

    /**
     * Creates a ZIP file containing a JSON backup of all student data.
     */
    async function exportBackup() {
        alert("Backup wird erstellt. Dies kann einen Moment dauern.");
        try {
            const dataStore = await gatherAllDataForBackup();
            if (Object.keys(dataStore.localStorage).length === 0 && dataStore.indexedDB.length === 0) {
                alert("Keine Daten zum Sichern gefunden.");
                return;
            }

            const zip = new JSZip();
            zip.file(BACKUP_FILENAME, JSON.stringify(dataStore, null, 2));

            const content = await zip.generateAsync({ type: "blob" });
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            saveAs(content, `assignments-backup-${timestamp}.zip`);
        } catch (error) {
            console.error("Backup-Fehler:", error);
            alert("Ein Fehler ist beim Erstellen des Backups aufgetreten.");
        }
    }

    /**
     * Clears all existing data and restores from a backup file.
     * @param {Event} event - The file input change event.
     */
    async function importBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm("WARNUNG: Das Einspielen eines Backups löscht ALLE aktuell gespeicherten Daten und ersetzt sie. Fortfahren?")) {
            importFileInput.value = '';
            return;
        }

        try {
            let jsonContent;
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(file);
                const backupFile = zip.file(BACKUP_FILENAME);
                if (!backupFile) {
                    throw new Error(`Die ZIP-Datei enthält nicht die erwartete Datei '${BACKUP_FILENAME}'.`);
                }
                jsonContent = await backupFile.async("string");
            } else if (file.name.endsWith('.json')) {
                jsonContent = await file.text();
            } else {
                throw new Error("Ungültiger Dateityp. Bitte eine .zip oder .json Backup-Datei auswählen.");
            }

            const dataStore = JSON.parse(jsonContent);
            await restoreData(dataStore);

        } catch (error) {
            console.error("Import-Fehler:", error);
            alert(`Ein Fehler ist beim Einspielen des Backups aufgetreten: ${error.message}`);
        } finally {
            importFileInput.value = '';
        }
    }

    /**
     * Wipes and restores data from a dataStore object.
     * @param {object} dataStore - The object containing localStorage and indexedDB data.
     */
    async function restoreData(dataStore) {
        // 1. Clear all existing data silently
        await clearAllData(true);

        // 2. Restore localStorage
        if (dataStore.localStorage) {
            for (const key in dataStore.localStorage) {
                localStorage.setItem(key, dataStore.localStorage[key]);
            }
        }

        // 3. Restore IndexedDB
        if (dataStore.indexedDB && Array.isArray(dataStore.indexedDB)) {
            const db = await initDB();
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            dataStore.indexedDB.forEach(fileRecord => {
                // The fileRecord from the backup is complete and can be added directly
                store.put(fileRecord);
            });
            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject('Fehler beim Wiederherstellen der Anhänge: ' + event.target.error);
            });
        }

        alert("Backup erfolgreich wiederhergestellt! Die Seite wird neu geladen.");
        window.location.reload();
    }


    /**
     * Deletes all assignment-related data from localStorage and IndexedDB.
     * @param {boolean} [silent=false] - If true, no confirmation prompts will be shown.
     */
    async function clearAllData(silent = false) {
        if (!silent) {
            if (!confirm("Bist du absolut sicher, dass du ALLE gespeicherten Arbeiten und Anhänge löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
            if (!confirm("Letzte Warnung: Wirklich ALLE Daten löschen?")) return;
        }

        // 1. Clear localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('textbox-') || key.startsWith('quiz-') || key.startsWith('tf-') || key.startsWith('drag-') || key.startsWith('studentName')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // 2. Clear IndexedDB
        try {
            const db = await initDB();
            const transaction = db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.clear();
            await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });

            if (!silent) {
                alert("Alle Daten wurden erfolgreich gelöscht.");
                window.location.reload();
            }
        } catch (error) {
            if (!silent) {
                alert("Fehler beim Löschen der Anhänge aus der Datenbank. Die Textantworten wurden jedoch gelöscht.");
                window.location.reload();
            }
            console.error("Fehler beim Leeren der IndexedDB:", error);
        }
    }

    // --- INITIALIZATION & EVENT LISTENERS ---
    displayAssignments();
    exportBackupBtn.addEventListener('click', exportBackup);
    importBackupBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importBackup);
    clearAllDataBtn.addEventListener('click', () => clearAllData(false));
});
