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

    const submitButton = document.getElementById('submit-all');
    if (submitButton && viewMode !== 'solution') {
        submitButton.addEventListener('click', async () => {
            const allData = await gatherAllAssignmentsData();
            if (allData) {
                submitAssignment(allData);
            }
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
            
            if (viewMode === 'solution') {
                renderSolution(subAssignmentData);
            } else {
                renderSubAssignment(subAssignmentData, assignmentId, subId);
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Ein Fehler ist aufgetreten. Bitte überprüfen Sie die Browser-Konsole für weitere Details.</p><p>Fehlermeldung: ${error.message}</p>`;
        });
});

function renderSolution(subAssignmentData) {
    document.getElementById('sub-title').textContent = `Lösung: ${subAssignmentData.title}`;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('action-container').style.display = 'none';

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = ''; 

    switch (subAssignmentData.type) {
        case 'quill':
            const questionsList = document.createElement('ol');
            subAssignmentData.questions.forEach(q => {
                const listItem = document.createElement('li');
                listItem.innerHTML = q.text;
                questionsList.appendChild(listItem);
            });
            contentRenderer.appendChild(questionsList);

            if (subAssignmentData.solution && subAssignmentData.solution.type === 'html') {
                const solutionBox = document.createElement('div');
                solutionBox.style.cssText = 'background-color:#e9f7ef; border:1px solid #a3d9b1; border-radius:5px; padding:15px; margin-top:20px;';
                solutionBox.innerHTML = subAssignmentData.solution.content;
                contentRenderer.appendChild(solutionBox);
            }
            break;
        
        case 'multipleChoice':
            const mcQuizForm = document.createElement('form');
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
                mcQuizForm.appendChild(questionContainer);
            });
            contentRenderer.appendChild(mcQuizForm);
            break;

        case 'trueFalse':
            const tfQuizForm = document.createElement('form');
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
                tfQuizForm.appendChild(questionContainer);
            });
            contentRenderer.appendChild(tfQuizForm);
            break;
            
        case 'dragTheWords':
            let solvedContent = subAssignmentData.content;
            subAssignmentData.solution.forEach(word => {
                solvedContent = solvedContent.replace('[BLANK]', `<strong style="color: green; border-bottom: 2px solid green; padding-bottom: 2px;">${word}</strong>`);
            });
            const contentP = document.createElement('p');
            contentP.className = 'sentence-container';
            contentP.innerHTML = solvedContent;
            contentRenderer.appendChild(contentP);
            break;

        default:
            contentRenderer.innerHTML = '<p>Unbekannter Lösungstyp.</p>';
    }
}

/**
 * Renders the interactive part of a sub-assignment.
 */
async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
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

    // After rendering the assignment, render the solution importer UI
    renderSolutionImporter(assignmentId, subId);
}

/**
 * Creates the UI for the "Import Solution" feature.
 * @param {string} assignmentId - The current assignment ID.
 * @param {string} subId - The current sub-assignment ID.
 */
function renderSolutionImporter(assignmentId, subId) {
    const container = document.getElementById('solution-import-container');
    container.innerHTML = ''; // Clear previous content

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

/**
 * Handles the file selection, validation, and triggers the display of the solution.
 * @param {Event} event - The file input change event.
 * @param {string} assignmentId - The expected assignment ID.
 * @param {string} subId - The expected sub-assignment ID.
 */
function handleSolutionFileSelect(event, assignmentId, subId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            const expectedTitle = document.getElementById('main-title').textContent;

            // Validate if the imported file matches the current assignment
            if (importedData.assignmentTitle !== expectedTitle || !importedData.subAssignments[subId]) {
                alert('Fehler: Diese Lösungsdatei passt nicht zur aktuellen Aufgabe. Bitte die korrekte JSON-Datei auswählen.');
                return;
            }

            const solutionSubAssignmentData = importedData.subAssignments[subId];
            displayImportedSolution(solutionSubAssignmentData);

        } catch (error) {
            alert('Fehler: Die Datei konnte nicht als gültige JSON-Datei gelesen werden.\n' + error);
        }
    };
    reader.readAsText(file);
}

/**
 * Renders the solution from a validated file into its dedicated container.
 * @param {object} solutionSubAssignmentData - The sub-assignment object from the imported file.
 */
function displayImportedSolution(solutionSubAssignmentData) {
    const solutionContainer = document.getElementById('solution-display-container');
    solutionContainer.innerHTML = ''; // Clear previous solution
    solutionContainer.style.display = 'block'; // Make it visible

    const title = document.createElement('h3');
    title.textContent = `Importierte Lösung für: ${solutionSubAssignmentData.title}`;
    solutionContainer.appendChild(title);
    
    // Use the same logic as renderSolution, but target the new container
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

    const attachmentHeader = document.createElement('h4');
    attachmentHeader.textContent = 'Anhänge';
    attachmentContainer.appendChild(attachmentHeader);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    attachmentContainer.appendChild(fileInput);

    const fileList = document.createElement('ul');
    fileList.id = 'file-list';
    fileList.style.listStyleType = 'none';
    fileList.style.paddingLeft = '0';
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
                    refreshFileList();
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
            refreshFileList();
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

function renderTrueFalse(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const form = document.createElement('form');
    form.id = 'tf-quiz-form';

    data.questions.forEach((questionData, index) => {
        const storageKey = `tf-assignment_${assignmentId}_sub_${subId}_question_${questionData.id}`;
        const savedAnswer = localStorage.getItem(storageKey);

        const qContainer = document.createElement('div');
        qContainer.className = 'quiz-question-container';

        const qText = document.createElement('p');
        qText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
        qContainer.appendChild(qText);

        ['true', 'false'].forEach(value => {
            const wrapper = document.createElement('div');
            wrapper.className = 'option-wrapper';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = questionData.id;
            radio.id = `${questionData.id}-${value}`;
            radio.value = value;
            if (savedAnswer === value) {
                radio.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = radio.id;
            label.textContent = value === 'true' ? 'Wahr' : 'Falsch';
            
            wrapper.appendChild(radio);
            wrapper.appendChild(label);
            qContainer.appendChild(wrapper);
        });

        const feedbackEl = document.createElement('div');
        feedbackEl.id = `feedback-${questionData.id}`;
        feedbackEl.className = 'feedback';
        qContainer.appendChild(feedbackEl);
        
        if (savedAnswer) {
            const isCorrect = (savedAnswer === 'true') === questionData.is_correct;
            feedbackEl.textContent = savedAnswer === 'true' ? questionData.feedback_true : questionData.feedback_false;
            feedbackEl.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        }
        
        form.appendChild(qContainer);
    });

    contentRenderer.appendChild(form);

    form.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const questionId = event.target.name;
            const selectedValue = event.target.value;
            const storageKey = `tf-assignment_${assignmentId}_sub_${subId}_question_${questionId}`;
            
            localStorage.setItem(storageKey, selectedValue);

            const questionData = data.questions.find(q => q.id === questionId);
            const feedbackEl = document.getElementById(`feedback-${questionId}`);
            
            const isCorrect = (selectedValue === 'true') === questionData.is_correct;
            
            feedbackEl.textContent = selectedValue === 'true' ? questionData.feedback_true : questionData.feedback_false;
            feedbackEl.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        }
    });
}

function renderDragTheWords(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `drag-assignment_${assignmentId}_sub_${subId}`;

    const sentenceContainer = document.createElement('div');
    sentenceContainer.className = 'sentence-container';

    const wordBank = document.createElement('div');
    wordBank.id = 'word-bank';
    wordBank.className = 'word-bank';

    const parts = data.content.split('[BLANK]');
    parts.forEach((part, index) => {
        sentenceContainer.appendChild(document.createTextNode(part));
        if (index < parts.length - 1) {
            const dropZone = document.createElement('span');
            dropZone.className = 'drop-zone';
            dropZone.dataset.dropId = index;
            sentenceContainer.appendChild(dropZone);
        }
    });

    data.words.forEach(word => {
        const wordEl = document.createElement('span');
        wordEl.className = 'draggable-word';
        wordEl.textContent = word;
        wordEl.id = `word-${assignmentId}-${subId}-${word.replace(/\s+/g, '-')}`;
        wordEl.draggable = true;
        wordBank.appendChild(wordEl);
    });

    contentRenderer.appendChild(sentenceContainer);
    contentRenderer.appendChild(wordBank);

    let draggedItem = null;

    contentRenderer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('draggable-word')) {
            draggedItem = e.target;
            setTimeout(() => e.target.style.display = 'none', 0);
        }
    });

    contentRenderer.addEventListener('dragend', (e) => {
        if(draggedItem) {
           draggedItem.style.display = 'inline-block';
           draggedItem = null;
        }
    });
    
    const allDropZones = [wordBank, ...contentRenderer.querySelectorAll('.drop-zone')];

    allDropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => e.preventDefault());
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if(e.target.classList.contains('drop-zone') || e.target.id === 'word-bank') {
                e.target.style.backgroundColor = '#e0e0e0';
            }
        });
        zone.addEventListener('dragleave', (e) => {
            if(e.target.classList.contains('drop-zone') || e.target.id === 'word-bank') {
                e.target.style.backgroundColor = '';
            }
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            let targetZone = e.target;
            if(targetZone.classList.contains('draggable-word')) {
                targetZone = targetZone.parentElement;
            }

            if (targetZone.classList.contains('drop-zone') || targetZone.id === 'word-bank') {
                targetZone.style.backgroundColor = '';
                if (draggedItem) {
                   if (targetZone.children.length === 0 || targetZone.id === 'word-bank') {
                         if(targetZone.children.length > 0 && targetZone.id !== 'word-bank') {
                               wordBank.appendChild(targetZone.children[0]);
                         }
                         targetZone.appendChild(draggedItem);
                         saveState();
                   }
                }
            }
        });
    });

    const checkButton = document.createElement('button');
    checkButton.textContent = 'Antworten überprüfen';
    checkButton.style.marginTop = '20px';
    contentRenderer.appendChild(checkButton);

    checkButton.addEventListener('click', () => {
        const dropZones = sentenceContainer.querySelectorAll('.drop-zone');
        let allCorrect = true;
        dropZones.forEach((zone, index) => {
            const wordEl = zone.querySelector('.draggable-word');
            zone.style.borderStyle = 'solid';
            if (wordEl) {
                if (wordEl.textContent === data.solution[index]) {
                    zone.style.borderColor = 'green';
                } else {
                    zone.style.borderColor = 'red';
                    allCorrect = false;
                }
            } else {
               zone.style.borderColor = 'red';
               allCorrect = false;
            }
        });
        if(allCorrect) {
            alert('Super! Alles ist korrekt.');
        }
    });

    function saveState() {
        const state = {};
        const dropZones = sentenceContainer.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            const wordEl = zone.querySelector('.draggable-word');
            if(wordEl) {
                state[zone.dataset.dropId] = wordEl.id;
            }
        });
        localStorage.setItem(storageKey, JSON.stringify(state));
    }
    
    function loadState() {
        const savedState = JSON.parse(localStorage.getItem(storageKey));
        if (savedState) {
            Object.keys(savedState).forEach(dropId => {
                const wordId = savedState[dropId];
                const wordEl = document.getElementById(wordId);
                const dropZone = sentenceContainer.querySelector(`.drop-zone[data-drop-id='${dropId}']`);
                if(wordEl && dropZone) {
                    dropZone.appendChild(wordEl);
                }
            });
        }
    }
    
    loadState();
}


async function gatherAllAssignmentsData() {
    let studentName = localStorage.getItem('studentName');
    if (!studentName) {
        studentName = prompt("Bitte gib deinen Namen für die Abgabe ein:", "");
        if (studentName) {
            localStorage.setItem('studentName', studentName);
        } else {
            alert('Abgabe abgebrochen, da kein Name eingegeben wurde.');
            return null;
        }
    }

    const studentData = {
        studentName: studentName,
        submissionDate: new Date().toISOString(),
        assignments: {},
        attachments: {}
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('textbox-assignment_') || key.startsWith('quiz-assignment_') || key.startsWith('tf-assignment_') || key.startsWith('drag-assignment_')) {
            studentData.assignments[key] = localStorage.getItem(key);
        }
    }

    const allFiles = await getAllFiles();
    for (const fileRecord of allFiles) {
        const base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileRecord.file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
        studentData.attachments[fileRecord.id] = {
            name: fileRecord.name,
            type: fileRecord.type,
            content: base64String
        };
    }

    console.log('Gathered Data (including files):', studentData);
    return studentData;
}

function submitAssignment(data) {
    if (!data) return;

    if (Object.keys(data.assignments).length === 0 && Object.keys(data.attachments).length === 0) {
        alert('Keine bearbeiteten Aufgaben oder Anhänge zum Abgeben gefunden.');
        return;
    }
    const filename = `submission-${data.studentName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('Deine Antworten und Anhänge wurden als JSON-Datei heruntergeladen.');
}