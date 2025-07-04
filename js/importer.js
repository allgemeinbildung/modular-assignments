const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_';

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('json-file-input');
    const importBtn = document.getElementById('import-btn');
    const statusMessage = document.getElementById('status-message');
    let fileContent = null;

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            importBtn.disabled = true;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            fileContent = e.target.result;
            importBtn.disabled = false;
        };
        reader.onerror = () => {
            showStatus('Fehler beim Lesen der Datei.', 'error');
            fileContent = null;
            importBtn.disabled = true;
        };
        reader.readAsText(file);
    });

    importBtn.addEventListener('click', () => {
        if (!fileContent) {
            showStatus('Keine Datei zum Importieren ausgewählt.', 'error');
            return;
        }

        try {
            // First, validate the JSON structure to ensure it's a valid submission file.
            const data = JSON.parse(fileContent);
            if (!data.assignments || !data.studentName || !data.submissionDate) {
                 throw new Error('Die JSON-Datei hat nicht die erwartete Struktur einer `submission.json` Datei.');
            }

            // Encode the entire file content for safe transport in the URL
            const encodedData = encodeURIComponent(fileContent);
            
            // Construct the new URL for the viewer, passing the data
            const viewerUrl = `viewer/viewer.html?data=${encodedData}`;

            // Redirect to the viewer page
            window.location.href = viewerUrl;

        } catch (error) {
            console.error('Import Fehler:', error);
            showStatus(`Fehler beim Import: ${error.message}`, 'error');
        }
    });

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-${type}`;
        statusMessage.style.display = 'block';
    }
});