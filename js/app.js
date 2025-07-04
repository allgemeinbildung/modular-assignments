document.addEventListener('DOMContentLoaded', () => {
    // 1. URL Parsing: Get assignmentId and subId from URL [cite: 89]
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    // 2. JSON Fetching [cite: 90]
    const jsonPath = `../assignments/${assignmentId}.json`; [cite: 91]
    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`); [cite: 92]
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId]; [cite: 94]

            if (!subAssignmentData) {
                throw new Error(`Sub-assignment with ID "${subId}" not found.`);
            }

            // 3. Content Routing based on 'type' [cite: 95]
            if (subAssignmentData.type === 'quill') {
                renderQuill(subAssignmentData); [cite: 97]
            } else {
                // Future renderers will go here
                document.getElementById('content-renderer').innerHTML = `<p>Renderer for type "${subAssignmentData.type}" not implemented yet.</p>`;
            }
        })
        .catch(error => {
            console.error('Error loading assignment:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Die Aufgabedatei unter <code>${jsonPath}</code> konnte nicht geladen werden. Bitte überprüfen Sie die URL und stellen Sie sicher, dass die Datei existiert.</p>`; [cite: 92]
        });
});

/**
 * Renders a Quill-based assignment.
 * @param {object} data The sub-assignment data object. [cite: 98]
 */
function renderQuill(data) {
    // Populate header elements [cite: 99]
    document.getElementById('sub-title').textContent = data.title;
    document.getElementById('instructions').innerHTML = data.instructions;

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = ''; // Clear previous content

    // Create and append the list of questions [cite: 100]
    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<strong>Frage:</strong> ${q.text}`;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    // Create a div for the Quill editor
    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);
    
    // Initialize Quill editor [cite: 101]
    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image']
            ]
        }
    });
}