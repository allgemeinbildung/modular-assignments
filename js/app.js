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

    // Event Listener für den Submit-Button hinzufügen
    const submitButton = document.getElementById('submit-all');
    if (submitButton) {
        submitButton.addEventListener('click', () => {
            const allData = gatherAllAssignmentsData();
            submitAssignment(allData);
        });
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
            renderSubAssignment(subAssignmentData, assignmentId, subId);
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
 * @param {string} assignmentId Die ID der Hauptaufgabe.
 * @param {string} subId Die ID der Teilaufgabe.
 */
function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';

    switch (subAssignmentData.type) {
        case 'quill':
            renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'multipleChoice':
            renderMultipleChoice(subAssignmentData, assignmentId, subId);
            break;
        default:
            contentRenderer.innerHTML = '<p>Error: Unknown assignment type.</p>';
    }
}

/**
 * Rendert eine Quill-basierte Aufgabe und integriert localStorage.
 * @param {object} data Das Datenobjekt der Teilaufgabe.
 * @param {string} assignmentId Die ID der Hauptaufgabe.
 * @param {string} subId Die ID der Teilaufgabe.
 */
function renderQuill(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `textbox-assignment_${assignmentId}_textbox-sub_${subId}`; // [cite: 133]

    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `${q.text}`;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link']]
        }
    });
    
    // Gespeicherte Daten laden [cite: 135]
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
        quill.setContents(JSON.parse(savedData));
    }

    // Änderungen im Editor speichern [cite: 134]
    quill.on('text-change', () => {
        localStorage.setItem(storageKey, JSON.stringify(quill.getContents()));
    });
}

/**
 * Rendert ein Multiple-Choice-Quiz und integriert localStorage.
 * @param {object} data Das Datenobjekt der Teilaufgabe.
 * @param {string} assignmentId Die ID der Hauptaufgabe.
 * @param {string} subId Die ID der Teilaufgabe.
 */
function renderMultipleChoice(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const quizForm = document.createElement('form');
    quizForm.id = 'quiz-form';

    data.questions.forEach((questionData, index) => {
        const storageKey = `quiz-assignment_${assignmentId}_sub_${subId}_question_${questionData.id}`;
        const savedAnswer = localStorage.getItem(storageKey);
        
        const questionContainer = document.createElement('div');
        questionContainer.className = 'quiz-question-container';

        const questionText = document.createElement('p');
        questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
        questionContainer.appendChild(questionText);

        questionData.options.forEach(option => {
            const optionId = `${questionData.id}-${option.text.replace(/\s+/g, '-')}`;
            const optionWrapper = document.createElement('div');
            optionWrapper.className = 'option-wrapper';

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = questionData.id;
            radioInput.value = option.text;
            radioInput.id = optionId;
            
            // Gespeicherte Antwort wiederherstellen [cite: 137]
            if (savedAnswer === option.text) {
                radioInput.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = optionId;
            label.textContent = option.text;

            optionWrapper.appendChild(radioInput);
            optionWrapper.appendChild(label);
            questionContainer.appendChild(optionWrapper);
        });

        const feedbackElement = document.createElement('div');
        feedbackElement.id = `feedback-${questionData.id}`;
        feedbackElement.className = 'feedback';
        questionContainer.appendChild(feedbackElement);
        
        // Initiales Feedback für vorgewählte Antworten anzeigen
        if (savedAnswer) {
            const selectedOption = questionData.options.find(o => o.text === savedAnswer);
            if (selectedOption) {
                feedbackElement.textContent = selectedOption.feedback;
                feedbackElement.className = `feedback ${selectedOption.is_correct ? 'correct' : 'incorrect'}`;
            }
        }

        quizForm.appendChild(questionContainer);
    });

    contentRenderer.appendChild(quizForm);

    quizForm.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const questionId = event.target.name;
            const selectedValue = event.target.value;
            const storageKey = `quiz-assignment_${assignmentId}_sub_${subId}_question_${questionId}`;
            
            // Antwort speichern und Feedback geben [cite: 136]
            localStorage.setItem(storageKey, selectedValue);

            const questionData = data.questions.find(q => q.id === questionId);
            const selectedOption = questionData.options.find(o => o.text === selectedValue);
            const feedbackElement = document.getElementById(`feedback-${questionId}`);
            feedbackElement.textContent = selectedOption.feedback;
            feedbackElement.className = `feedback ${selectedOption.is_correct ? 'correct' : 'incorrect'}`;
        }
    });
}

/**
 * Sammelt alle Daten aus dem localStorage, die zu den Aufgaben gehören.
 * @returns {object} Ein Objekt mit allen gesammelten Daten.
 */
function gatherAllAssignmentsData() {
    const studentData = {
        studentName: localStorage.getItem('studentName') || 'UnknownStudent',
        submissionDate: new Date().toISOString(),
        assignments: {}
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Schlüssel für Quill-Antworten und Quiz-Antworten scannen
        if (key.startsWith('textbox-assignment_') || key.startsWith('quiz-assignment_')) {
            studentData.assignments[key] = localStorage.getItem(key);
        }
    }
    console.log('Gathered Data:', studentData);
    return studentData;
}

/**
 * Erstellt eine JSON-Datei mit den Schülerdaten und löst den Download aus.
 * @param {object} data Die gesammelten Schülerdaten.
 */
function submitAssignment(data) {
    if (Object.keys(data.assignments).length === 0) {
        alert('Keine bearbeiteten Aufgaben zum Abgeben gefunden.');
        return;
    }
    const filename = `submission-${data.studentName}-${data.submissionDate.split('T')[0]}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('Deine Antworten wurden als JSON-Datei heruntergeladen.');
}