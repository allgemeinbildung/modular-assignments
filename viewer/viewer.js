import { clearAllAttachments } from '../js/db.js';

document.addEventListener('DOMContentLoaded', () => {
    const assignmentListContainer = document.getElementById('assignment-list');
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');

    const ANSWER_PREFIX = 'modular-answer_';

    function displaySavedAssignments() {
        assignmentListContainer.innerHTML = '';
        const assignments = new Map();
        const keyRegex = new RegExp(`^${ANSWER_PREFIX}(.+)_sub_(.+)$`);

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

    async function clearAllData() {
        if (!confirm("Bist du sicher, dass du ALLE gespeicherten Arbeiten und Anhänge löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.")) return;

        // Clear localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('modular-') || key.startsWith('studentIdentifier')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear IndexedDB
        try {
            await clearAllAttachments();
            alert("Alle Daten wurden erfolgreich gelöscht.");
            window.location.reload();
        } catch (error) {
            alert("Fehler beim Löschen der Anhänge. Die Textantworten wurden jedoch gelöscht.");
            console.error("Fehler beim Leeren der IndexedDB:", error);
        }
    }

    displaySavedAssignments();
    clearAllDataBtn.addEventListener('click', clearAllData);
});