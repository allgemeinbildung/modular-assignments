import { getFilesForAssignment, addFile, deleteFile } from './db.js';

export function renderSolution(subAssignmentData, targetContainer = document.getElementById('content-renderer')) {
    targetContainer.innerHTML = ''; 

    switch (subAssignmentData.type) {
        case 'quill':
            const questionsList = document.createElement('ol');
            subAssignmentData.questions.forEach(q => {
                const listItem = document.createElement('li');
                listItem.innerHTML = q.text;
                questionsList.appendChild(listItem);
            });
            targetContainer.appendChild(questionsList);

            if (subAssignmentData.solution && subAssignmentData.solution.type === 'html') {
                const solutionBox = document.createElement('div');
                solutionBox.style.cssText = 'background-color:#e9f7ef; border:1px solid #a3d9b1; border-radius:5px; padding:15px; margin-top:20px;';
                solutionBox.innerHTML = subAssignmentData.solution.content;
                targetContainer.appendChild(solutionBox);
            }
            break;
        
        case 'multipleChoice':
            subAssignmentData.questions.forEach((questionData, index) => {
                const questionContainer = document.createElement('div');
                questionContainer.className = 'quiz-question-container';
                const questionText = document.createElement('p');
                questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
                questionContainer.appendChild(questionText);
                questionData.options.forEach(option => {
                    const label = document.createElement('label');
                    label.textContent = option.text;
                    if (option.is_correct) {
                        label.style.fontWeight = 'bold';
                        label.style.color = 'green';
                        label.innerHTML += " (Richtige Antwort)";
                    }
                    questionContainer.appendChild(label);
                    questionContainer.appendChild(document.createElement('br'));
                });
                targetContainer.appendChild(questionContainer);
            });
            break;

        case 'trueFalse':
            subAssignmentData.questions.forEach((questionData, index) => {
                const questionContainer = document.createElement('div');
                questionContainer.className = 'quiz-question-container';
                const questionText = document.createElement('p');
                questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
                questionContainer.appendChild(questionText);
                const answerText = document.createElement('p');
                const correctAnswer = questionData.is_correct ? 'Wahr' : 'Falsch';
                answerText.innerHTML = `Richtige Antwort: <strong>${correctAnswer}</strong>`;
                questionContainer.appendChild(answerText);
                targetContainer.appendChild(questionContainer);
            });
            break;
            
        case 'dragTheWords':
            let solvedContent = subAssignmentData.content;
            subAssignmentData.solution.forEach(word => {
                solvedContent = solvedContent.replace('[BLANK]', `<strong style="color: green; border-bottom: 2px solid green; padding-bottom: 2px;">${word}</strong>`);
            });
            const contentP = document.createElement('p');
            contentP.className = 'sentence-container';
            contentP.innerHTML = solvedContent;
            targetContainer.appendChild(contentP);
            break;

        default:
            targetContainer.innerHTML = '<p>Unbekannter Lösungstyp.</p>';
    }
}

export async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('action-container').style.display = 'block';

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';

    switch (subAssignmentData.type) {
        case 'quill':
            await renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'multipleChoice':
            renderMultipleChoice(subAssignmentData, assignmentId, subId);
            break;
        case 'trueFalse':
            renderTrueFalse(subAssignmentData, assignmentId, subId);
            break;
        case 'dragTheWords':
            renderDragTheWords(subAssignmentData, assignmentId, subId);
            break;
        default:
            contentRenderer.innerHTML = '<p>Error: Unknown assignment type.</p>';
    }

    renderSolutionImporter(assignmentId, subId);
    
    const cachedSolutionKey = `solution-cache_${assignmentId}_${subId}`;
    const cachedSolutionDataString = localStorage.getItem(cachedSolutionKey);
    if (cachedSolutionDataString) {
        try {
            const cachedSolutionData = JSON.parse(cachedSolutionDataString);
            displayImportedSolution(cachedSolutionData);
        } catch(e) {
            console.error("Could not parse cached solution data:", e);
            localStorage.removeItem(cachedSolutionKey);
        }
    }
}

function renderSolutionImporter(assignmentId, subId) {
    const container = document.getElementById('solution-import-container');
    container.innerHTML = ''; 

    const importButton = document.createElement('button');
    importButton.textContent = 'Lösung importieren';
    importButton.className = 'import-solution-btn';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    importButton.onclick = () => fileInput.click();
    fileInput.onchange = (event) => handleSolutionFileSelect(event, assignmentId, subId);

    container.appendChild(importButton);
    container.appendChild(fileInput);
}

function handleSolutionFileSelect(event, assignmentId, subId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            const expectedTitle = document.getElementById('main-title').textContent;

            if (importedData.assignmentTitle !== expectedTitle || !importedData.subAssignments[subId]) {
                alert('Fehler: Diese Lösungsdatei passt nicht zur aktuellen Aufgabe. Bitte die korrekte JSON-Datei auswählen.');
                return;
            }

            const solutionSubAssignmentData = importedData.subAssignments[subId];
            const storageKey = `solution-cache_${assignmentId}_${subId}`;
            localStorage.setItem(storageKey, JSON.stringify(solutionSubAssignmentData));
            displayImportedSolution(solutionSubAssignmentData);
        } catch (error) {
            alert('Fehler: Die Datei konnte nicht als gültige JSON-Datei gelesen werden.\n' + error);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function displayImportedSolution(solutionSubAssignmentData) {
    const solutionContainer = document.getElementById('solution-display-container');
    solutionContainer.style.display = 'block';
    const title = document.createElement('h3');
    title.textContent = `Importierte Lösung für: ${solutionSubAssignmentData.title}`;
    
    solutionContainer.innerHTML = ''; 
    solutionContainer.appendChild(title);
    
    renderSolution(solutionSubAssignmentData, solutionContainer);
}

async function renderQuill(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `textbox-assignment_${assignmentId}_textbox-sub_${subId}`;

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
    
    const attachmentContainer = document.createElement('div');
    attachmentContainer.id = 'attachment-container';
    attachmentContainer.style.marginTop = '20px';
    contentRenderer.appendChild(attachmentContainer);
    attachmentContainer.innerHTML = '<h4>Anhänge</h4>';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    attachmentContainer.appendChild(fileInput);

    const fileList = document.createElement('ul');
    fileList.id = 'file-list';
    fileList.style.cssText = 'list-style-type: none; padding-left: 0;';
    attachmentContainer.appendChild(fileList);
    
    const refreshFileList = async () => {
        const files = await getFilesForAssignment(assignmentId, subId);
        fileList.innerHTML = '';
        files.forEach(fileRecord => {
            const listItem = document.createElement('li');
            listItem.textContent = `${fileRecord.name} (${(fileRecord.file.size / 1024).toFixed(2)} KB)`;
            
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Löschen';
            deleteButton.style.marginLeft = '10px';
            deleteButton.onclick = async () => {
                if (confirm(`Möchten Sie die Datei "${fileRecord.name}" wirklich löschen?`)) {
                    await deleteFile(fileRecord.id);
                    await refreshFileList();
                }
            };
            listItem.appendChild(deleteButton);
            fileList.appendChild(listItem);
        });
    };
    
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            await addFile(assignmentId, subId, file);
            await refreshFileList();
            fileInput.value = '';
        }
    });
    
    await refreshFileList();

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link']] }
    });
    
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
        try {
            quill.setContents(JSON.parse(savedData));
        } catch (e) {
            console.error("Could not parse saved Quill data:", e);
        }
    }

    quill.on('text-change', () => {
        localStorage.setItem(storageKey, JSON.stringify(quill.getContents()));
    });
}

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
            if (savedAnswer === option.text) radioInput.checked = true;
            const label = document.createElement('label');
            label.htmlFor = optionId;
            label.textContent = option.text;
            optionWrapper.append(radioInput, label);
            questionContainer.appendChild(optionWrapper);
        });

        const feedbackElement = document.createElement('div');
        feedbackElement.id = `feedback-${questionData.id}`;
        feedbackElement.className = 'feedback';
        questionContainer.appendChild(feedbackElement);
        
        if (savedAnswer) {
            const selectedOption = data.questions.find(q => q.id === questionData.id).options.find(o => o.text === savedAnswer);
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
            localStorage.setItem(storageKey, selectedValue);
            const questionData = data.questions.find(q => q.id === questionId);
            const selectedOption = questionData.options.find(o => o.text === selectedValue);
            const feedbackElement = document.getElementById(`feedback-${questionId}`);
            feedbackElement.textContent = selectedOption.feedback;
            feedbackElement.className = `feedback ${selectedOption.is_correct ? 'correct' : 'incorrect'}`;
        }
    });
}

// renderTrueFalse and renderDragTheWords would be here, unchanged from the previous version.
// They are omitted for brevity in this explanation but would be in the actual file.