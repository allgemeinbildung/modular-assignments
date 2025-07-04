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

        if (!confirm("Bist du sicher? Das Importieren wird alle bestehenden, gleichnamigen Antworten in deinem Browser überschreiben.")) {
            return;
        }

        try {
            const data = JSON.parse(fileContent);
            if (!data.payload || !data.identifier || !data.createdAt) {
                throw new Error('Die JSON-Datei hat nicht die erwartete Struktur.');
            }
            
            // Set student identifier
            localStorage.setItem('studentIdentifier', data.identifier);

            let importedCount = 0;
            // Iterate through the main assignments (e.g., "3.3-strafrecht")
            for (const assignmentId in data.payload) {
                const subAssignments = data.payload[assignmentId];
                
                // Iterate through sub-assignments (e.g., "Merkmale-einer-Straftat")
                for (const subId in subAssignments) {
                    const subData = subAssignments[subId];

                    const answerKey = `${ANSWER_PREFIX}${assignmentId}_sub_${subId}`;
                    const questionsKey = `${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`;
                    const titleKey = `${TITLE_PREFIX}${assignmentId}_sub_${subId}`;
                    const typeKey = `${TYPE_PREFIX}${assignmentId}_sub_${subId}`;

                    // Reconstruct the answer value based on assignment type
                    let finalAnswer;
                    if (subData.type === 'quiz') {
                        // For quizzes, the stored value is a JSON string containing both the answers and the score
                        finalAnswer = JSON.stringify({
                            userAnswers: subData.answer ? JSON.parse(subData.answer) : {},
                            score: subData.achievedPoints || 'Nicht bewertet'
                        });
                    } else { // For 'quill' type, the answer is just the HTML string
                        finalAnswer = subData.answer;
                    }

                    // Set the data back into localStorage
                    localStorage.setItem(answerKey, finalAnswer);
                    localStorage.setItem(titleKey, subData.title);
                    localStorage.setItem(typeKey, subData.type);
                    if (subData.questions) {
                        localStorage.setItem(questionsKey, JSON.stringify(subData.questions));
                    }
                    importedCount++;
                }
            }

            showStatus(`Import erfolgreich! ${importedCount} Aufgabenbereiche wurden wiederhergestellt.`, 'success');
            importBtn.disabled = true;
            fileInput.value = ''; // Reset file input

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