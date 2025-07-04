document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen [cite: 89]
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    // 2. JSON abrufen - KORRIGIERTER PFAD
    const jsonPath = `assignments/${assignmentId}.json`; // Korrektur: "../" entfernt

    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}`); [cite: 92]
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId]; [cite: 94]

            if (!subAssignmentData) {
                throw new Error(`Teilaufgabe mit der ID "${subId}" nicht gefunden.`);
            }

            // 3. Inhalt basierend auf dem 'type' rendern [cite: 95]
            if (subAssignmentData.type === 'quill') {
                renderQuill(subAssignmentData); [cite: 97]
            } else {
                // Platzhalter für zukünftige Renderer
                document.getElementById('content-renderer').innerHTML = `<p>Renderer für den Typ "${subAssignmentData.type}" ist noch nicht implementiert.</p>`;
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Die Aufgabendatei unter <code>${jsonPath}</code> konnte nicht geladen werden. Bitte überprüfen Sie die URL und stellen Sie sicher, dass die Datei existiert.</p>`; [cite: 92]
        });
});

/**
 * Rendert eine Quill-basierte Aufgabe.
 * @param {object} data Das Datenobjekt der Teilaufgabe. [cite: 98]
 */
function renderQuill(data) {
    // Header-Elemente füllen [cite: 99]
    document.getElementById('sub-title').textContent = data.title;
    document.getElementById('instructions').innerHTML = data.instructions;

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = ''; // Vorherigen Inhalt löschen

    // Liste der Fragen erstellen und anhängen [cite: 100]
    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<strong>Frage:</strong> ${q.text}`;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    // Div für den Quill-Editor erstellen
    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);
    
    // Quill-Editor initialisieren [cite: 101]
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