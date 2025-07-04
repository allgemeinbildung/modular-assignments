import { renderSubAssignment, renderSolution } from './renderer.js';
// REMOVED: submission.js is no longer imported at the top level.

document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');
    const viewMode = urlParams.get('view');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Error';
        document.getElementById('content-renderer').innerHTML = '<p>No assignmentId or subId found in the URL.</p>';
        return;
    }

    const submitButton = document.getElementById('submit-all');
    if (submitButton && viewMode !== 'solution') {
        submitButton.addEventListener('click', async () => {
            try {
                // DYNAMICALLY IMPORT submission.js on click
                const { gatherAllAssignmentsData, submitAssignment } = await import('./submission.js');
                
                const allData = await gatherAllAssignmentsData();
                if (allData) {
                    submitAssignment(allData);
                }
            } catch (error) {
                console.error("Failed to load submission module. Is js/config.js created?", error);
                alert("Submission feature is not configured correctly. Please create 'js/config.js' from the example file.");
            }
        });
    }

    // 2. JSON-Datei abrufen (This code will now run without issues)
    const jsonPath = `assignments/${assignmentId}.json`;

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