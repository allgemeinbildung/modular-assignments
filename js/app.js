import { renderSubAssignment, renderSolution } from './renderer.js';
import { submitAssignment, gatherAllAssignmentsData } from './submission.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');
    const viewMode = urlParams.get('view');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    const submitButton = document.getElementById('submit-all');
    if (submitButton && viewMode !== 'solution') {
        submitButton.addEventListener('click', async () => {
            const allData = await gatherAllAssignmentsData();
            if (allData) {
                submitAssignment(allData);
            }
        });
    }

    // 2. JSON-Datei abrufen
    const jsonPath = `../assignments/${assignmentId}.json`;

    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}, Pfad: ${jsonPath}`);
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId];

            if (!subAssignmentData) {
                throw new Error(`Teilaufgabe mit der ID "${subId}" in der JSON-Datei nicht gefunden.`);
            }
            
            if (viewMode === 'solution') {
                renderSolution(subAssignmentData);
            } else {
                renderSubAssignment(subAssignmentData, assignmentId, subId);
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Ein Fehler ist aufgetreten. Bitte überprüfen Sie die Browser-Konsole für weitere Details.</p><p>Fehlermeldung: ${error.message}</p>`;
        });
});