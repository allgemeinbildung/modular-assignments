document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');
    const viewMode = urlParams.get('view'); // For solution viewing in a later phase

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    // 2. JSON-Datei abrufen
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

            // 3. Master-Renderer aufrufen
            renderSubAssignment(subAssignmentData);
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Ein Fehler ist aufgetreten. Bitte überprüfen Sie die Browser-Konsole für weitere Details.</p><p>Fehlermeldung: ${error.message}</p>`;
        });
});

/**
 * Master-Renderer: Leitet die Daten basierend auf dem Typ an die spezifische Render-Funktion weiter.
 * @param {object} subAssignmentData Das Datenobjekt der Teilaufgabe.
 */
function renderSubAssignment(subAssignmentData) {
    // Gemeinsame Elemente wie Titel und Anweisungen füllen
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = ''; // Vorherigen Inhalt sicherheitshalber löschen

    // Weiterleitung an den spezifischen Renderer basierend auf dem Typ
    switch (subAssignmentData.type) {
        case 'quill':
            renderQuill(subAssignmentData);
            break;
        case 'multipleChoice':
            renderMultipleChoice(subAssignmentData);
            break;
        default:
            contentRenderer.innerHTML = '<p>Error: Unknown assignment type.</p>';
    }
}

/**
 * Rendert eine Quill-basierte Aufgabe.
 * @param {object} data Das Datenobjekt der Teilaufgabe.
 */
function renderQuill(data) {
    const contentRenderer = document.getElementById('content-renderer');

    // Liste der Fragen erstellen und anhängen
    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        // We use innerHTML to correctly render potential formatting in the question text.
        listItem.innerHTML = `${q.text}`;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    // Div für den Quill-Editor erstellen und initialisieren
    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image']
            ]
        }
    });
}

/**
 * Rendert ein Multiple-Choice-Quiz.
 * @param {object} data Das Datenobjekt der Teilaufgabe.
 */
function renderMultipleChoice(data) {
    const contentRenderer = document.getElementById('content-renderer');
    const quizForm = document.createElement('form');
    quizForm.id = 'quiz-form';

    // Durch jede Frage im JSON iterieren
    data.questions.forEach((questionData, index) => {
        const questionContainer = document.createElement('div');
        questionContainer.className = 'quiz-question-container';

        // Frage-Text
        const questionText = document.createElement('p');
        questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
        questionContainer.appendChild(questionText);

        // Optionen (Radio-Buttons)
        questionData.options.forEach(option => {
            const optionId = `${questionData.id}-${option.text.replace(/\s+/g, '-')}`;

            const optionWrapper = document.createElement('div');
            optionWrapper.className = 'option-wrapper';

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = questionData.id;
            radioInput.value = option.text;
            radioInput.id = optionId;

            const label = document.createElement('label');
            label.htmlFor = optionId;
            label.textContent = option.text;

            optionWrapper.appendChild(radioInput);
            optionWrapper.appendChild(label);
            questionContainer.appendChild(optionWrapper);
        });

        // Feedback-Bereich für die Frage
        const feedbackElement = document.createElement('div');
        feedbackElement.id = `feedback-${questionData.id}`;
        feedbackElement.className = 'feedback';
        questionContainer.appendChild(feedbackElement);

        quizForm.appendChild(questionContainer);
    });

    contentRenderer.appendChild(quizForm);

    // Event Listener hinzufügen, um Feedback zu geben
    quizForm.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const questionId = event.target.name;
            const selectedValue = event.target.value;
            const questionData = data.questions.find(q => q.id === questionId);
            const selectedOption = questionData.options.find(o => o.text === selectedValue);

            const feedbackElement = document.getElementById(`feedback-${questionId}`);
            feedbackElement.textContent = selectedOption.feedback;
            feedbackElement.className = `feedback ${selectedOption.is_correct ? 'correct' : 'incorrect'}`;
        }
    });
}