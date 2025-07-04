document.addEventListener('DOMContentLoaded', () => {
    const assignmentListContainer = document.getElementById('assignment-list');
    assignmentListContainer.innerHTML = ''; // Clear "Loading..." message

    // This map will store sub-assignments grouped by their main assignment ID.
    // e.g., { "3.4-migration": Set("subId1", "subId2") }
    const assignments = new Map();

    // Regex to parse assignmentId and subId from localStorage keys
    const keyRegex = /^(?:textbox|quiz)-assignment_([^_]+)_(?:textbox-sub|sub)_(.+?)(?:_question_|$)/;

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

    // Generate and display the links
    for (const [assignmentId, subIds] of assignments.entries()) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'assignment-group';

        const title = document.createElement('h2');
        title.textContent = `Aufgabe: ${assignmentId}`;
        groupDiv.appendChild(title);

        const list = document.createElement('ul');
        for (const subId of subIds) {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            
            // Construct the correct URL pointing back to the main index.html
            link.href = `../index.html?assignmentId=${assignmentId}&subId=${subId}`;
            link.textContent = subId.replace(/-/g, ' '); // Make the link text more readable
            
            listItem.appendChild(link);
            list.appendChild(listItem);
        }
        
        groupDiv.appendChild(list);
        assignmentListContainer.appendChild(groupDiv);
    }
});