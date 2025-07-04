import { renderSubAssignment } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    // Attach submit event listener
    const submitButton = document.getElementById('submit-all');
    if (submitButton) {
        submitButton.addEventListener('click', async () => {
            try {
                // Dynamically import and run the submission process
                const { submitAssignment } = await import('./submission.js');
                await submitAssignment();
            } catch (error) {
                console.error("Submission failed:", error);
                alert("Ein Fehler ist bei der Abgabe aufgetreten. Überprüfe die Konsole für Details.");
            }
        });
    }

    // Fetch and render the assignment content
    const jsonPath = `assignments/${assignmentId}.json`;
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId];
            if (!subAssignmentData) throw new Error(`Teilaufgabe "${subId}" nicht gefunden.`);
            
            renderSubAssignment(subAssignmentData, assignmentId, subId);
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler';
            document.getElementById('content-renderer').innerHTML = `<p>${error.message}</p>`;
        });
});