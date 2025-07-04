// In viewer/viewer.js

function displaySavedAssignments() {
    assignmentListContainer.innerHTML = '';
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');

    const assignments = new Map();

    // --- NEW LOGIC: Prioritize data from URL parameter ---
    if (dataParam) {
        try {
            const decodedData = decodeURIComponent(dataParam);
            const submissionData = JSON.parse(decodedData);
            
            // Populate the assignments map from the submission data
            for (const assignmentId in submissionData.assignments) {
                if (!assignments.has(assignmentId)) {
                    assignments.set(assignmentId, new Set());
                }
                for (const subId in submissionData.assignments[assignmentId].subAssignments) {
                    assignments.get(assignmentId).add(subId);
                }
            }
        } catch (e) {
            console.error("Failed to parse data from URL", e);
            assignmentListContainer.innerHTML = '<p style="color: red;">Fehler: Die Daten im Link konnten nicht gelesen werden.</p>';
            return;
        }
    } else {
        // --- FALLBACK LOGIC: Original localStorage method ---
        const ANSWER_PREFIX = 'modular-answer_';
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
    }


    if (assignments.size === 0) {
        assignmentListContainer.innerHTML = '<p>Keine Aufgaben gefunden. Importiere eine `submission.json`-Datei, um deine Arbeit anzuzeigen.</p>';
        return;
    }

    // This rendering logic remains the same
    for (const [assignmentId, subIds] of assignments.entries()) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'assignment-group';
        
        // Try to get a real title from the first sub-assignment if available
        const firstSubId = subIds.values().next().value;
        const mainTitle = localStorage.getItem(`title_${assignmentId}_sub_${firstSubId}`) ? assignmentId : `Aufgaben-Set: ${assignmentId}`;
        
        const title = document.createElement('h2');
        title.textContent = mainTitle;
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