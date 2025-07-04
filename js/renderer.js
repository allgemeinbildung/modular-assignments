import { getFilesForAssignment, addFile, deleteFile } from './db.js';

// ===================================================================================
//                                  SOLUTION RENDERER
// ===================================================================================

/**
 * Renders the solutions for a unified 'quiz' assignment type.
 * @param {Array<object>} questions - The array of question objects from the sub-assignment.
 * @param {HTMLElement} targetContainer - The container element to render the solutions into.
 */
function renderQuizSolution(questions, targetContainer) {
    questions.forEach((questionData, index) => {
        const questionContainer = document.createElement('div');
        questionContainer.className = 'quiz-question-container';
        questionContainer.style.borderBottom = '1px solid #ddd';
        questionContainer.style.paddingBottom = '1em';
        questionContainer.style.marginBottom = '1em';

        const questionTitle = document.createElement('p');
        questionTitle.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question || ''}`;
        questionContainer.appendChild(questionTitle);

        switch (questionData.type) {
            case 'multipleChoice':
                questionData.options.forEach(option => {
                    const label = document.createElement('div');
                    if (option.is_correct) {
                        label.innerHTML = `<strong><span style="color: green;">✔ ${option.text}</span> (Richtige Antwort)</strong>`;
                    } else {
                        label.innerHTML = `<span style="color: #6c757d;">- ${option.text}</span>`;
                    }
                    questionContainer.appendChild(label);
                });
                break;

            case 'trueFalse':
                const correctAnswer = questionData.is_correct ? 'Wahr' : 'Falsch';
                const answerText = document.createElement('p');
                answerText.innerHTML = `Richtige Antwort: <strong><span style="color: green;">${correctAnswer}</span></strong>`;
                questionContainer.appendChild(answerText);
                break;

            case 'dragTheWords':
                let solvedContent = questionData.content;
                questionData.solution.forEach(word => {
                    solvedContent = solvedContent.replace('[BLANK]', `<strong style="color: green; border-bottom: 2px solid green;">${word}</strong>`);
                });
                const contentP = document.createElement('p');
                contentP.className = 'sentence-container';
                contentP.innerHTML = solvedContent;
                questionContainer.appendChild(contentP);
                break;
        }
        targetContainer.appendChild(questionContainer);
    });
}

/**
 * Renders the solution view for a given sub-assignment.
 * @param {object} subAssignmentData - The data object for the sub-assignment.
 * @param {HTMLElement} [targetContainer=document.getElementById('content-renderer')] - The element to render into.
 */
export function renderSolution(subAssignmentData, targetContainer = document.getElementById('content-renderer')) {
    targetContainer.innerHTML = '';
    document.getElementById('action-container').style.display = 'none';
    document.getElementById('solution-import-container').style.display = 'none';

    // Populate common header elements
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;


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

        case 'quiz':
            renderQuizSolution(subAssignmentData.questions, targetContainer);
            break;

        default:
            targetContainer.innerHTML = '<p>Für diesen Aufgabentyp ist keine Lösungsansicht verfügbar.</p>';
    }
}


// ===================================================================================
//                                INTERACTIVE RENDERERS
// ===================================================================================

/**
 * Renders a Quill rich text editor with attachment functionality.
 * @param {object} data - The sub-assignment data for the Quill task.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 */
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

/**
 * Renders a single multiple-choice question.
 * @param {HTMLElement} container - The parent element for this question.
 * @param {object} questionData - The data for this specific question.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 * @param {number} index - The question number.
 */
function renderSingleMultipleChoice(container, questionData, assignmentId, subId, index) {
    const storageKey = `quiz-assignment_${assignmentId}_sub_${subId}_question_${questionData.id}`;
    const savedAnswer = localStorage.getItem(storageKey);

    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
    container.appendChild(questionText);

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
        container.appendChild(optionWrapper);
    });

    const feedbackElement = document.createElement('div');
    feedbackElement.id = `feedback-${questionData.id}`;
    feedbackElement.className = 'feedback';
    container.appendChild(feedbackElement);

    const showFeedback = (selectedValue) => {
        const selectedOption = questionData.options.find(o => o.text === selectedValue);
        if (selectedOption) {
            feedbackElement.textContent = selectedOption.feedback;
            feedbackElement.className = `feedback ${selectedOption.is_correct ? 'correct' : 'incorrect'}`;
        }
    };
    
    container.addEventListener('change', (event) => {
        if (event.target.type === 'radio' && event.target.name === questionData.id) {
            const selectedValue = event.target.value;
            localStorage.setItem(storageKey, selectedValue);
            showFeedback(selectedValue);
        }
    });

    if (savedAnswer) {
        showFeedback(savedAnswer);
    }
}

/**
 * Renders a single true/false question.
 * @param {HTMLElement} container - The parent element for this question.
 * @param {object} questionData - The data for this specific question.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 * @param {number} index - The question number.
 */
function renderSingleTrueFalse(container, questionData, assignmentId, subId, index) {
    const storageKey = `tf-assignment_${assignmentId}_sub_${subId}_question_${questionData.id}`;
    const savedAnswer = localStorage.getItem(storageKey);

    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
    container.appendChild(questionText);
    
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'feedback';
    
    ['true', 'false'].forEach(value => {
        const optionId = `${questionData.id}-${value}`;
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = questionData.id;
        radioInput.value = value;
        radioInput.id = optionId;
        if (savedAnswer === value) radioInput.checked = true;
        const label = document.createElement('label');
        label.htmlFor = optionId;
        label.textContent = value === 'true' ? 'Wahr' : 'Falsch';
        label.style.marginRight = '15px';
        container.append(radioInput, label);
    });
    
    container.appendChild(feedbackElement);

    const showFeedback = (selectedValue) => {
        const isCorrect = (String(questionData.is_correct) === selectedValue);
        feedbackElement.textContent = selectedValue === 'true' ? questionData.feedback_true : questionData.feedback_false;
        feedbackElement.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    };

    container.addEventListener('change', (event) => {
        if (event.target.type === 'radio' && event.target.name === questionData.id) {
            const selectedValue = event.target.value;
            localStorage.setItem(storageKey, selectedValue);
            showFeedback(selectedValue);
        }
    });
    
    if (savedAnswer) {
        showFeedback(savedAnswer);
    }
}

/**
 * Renders a single drag-the-words question. Note: Full drag-drop UI is complex and not implemented.
 * @param {HTMLElement} container - The parent element for this question.
 * @param {object} questionData - The data for this specific question.
 * @param {number} index - The question number.
 */
function renderSingleDragTheWords(container, questionData, index) {
    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>Frage ${index + 1}:</strong> ${questionData.question}`;
    container.appendChild(questionText);

    const sentenceP = document.createElement('p');
    sentenceP.innerHTML = questionData.content.replace(/\[BLANK\]/g, '___________');
    sentenceP.className = 'sentence-container';
    container.appendChild(sentenceP);

    const wordBank = document.createElement('div');
    wordBank.className = 'word-bank';
    wordBank.innerHTML = '<strong>Wort-Bank:</strong> ';
    questionData.words.forEach(word => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'draggable-word';
        wordSpan.textContent = word;
        wordBank.appendChild(wordSpan);
    });
    container.appendChild(wordBank);
    
    const info = document.createElement('p');
    info.innerHTML = '<em>Hinweis: Die volle Drag-and-Drop-Funktionalität ist in dieser Ansicht nicht implementiert.</em>';
    container.appendChild(info);
}

/**
 * Renders a unified quiz containing multiple question types.
 * @param {object} data - The sub-assignment data for the quiz.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 */
function renderQuiz(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const quizForm = document.createElement('form');
    quizForm.id = 'quiz-form';
    quizForm.onsubmit = (e) => e.preventDefault(); 

    data.questions.forEach((questionData, index) => {
        const questionWrapper = document.createElement('div');
        questionWrapper.className = 'question-wrapper';
        questionWrapper.style.cssText = 'margin-bottom: 2em; border-bottom: 1px solid #eee; padding-bottom: 1.5em;';

        switch (questionData.type) {
            case 'multipleChoice':
                renderSingleMultipleChoice(questionWrapper, questionData, assignmentId, subId, index);
                break;
            case 'trueFalse':
                renderSingleTrueFalse(questionWrapper, questionData, assignmentId, subId, index);
                break;
            case 'dragTheWords':
                renderSingleDragTheWords(questionWrapper, questionData, index);
                break;
            default:
                questionWrapper.innerHTML = `<p>Error: Unknown question type: ${questionData.type}</p>`;
        }
        quizForm.appendChild(questionWrapper);
    });
    contentRenderer.appendChild(quizForm);
}


// ===================================================================================
//                                MASTER RENDERER & IMPORTER
// ===================================================================================

/**
 * Main function to render any sub-assignment based on its type.
 * @param {object} subAssignmentData - The data object for the sub-assignment.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 */
export async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    // Populate common header elements
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('action-container').style.display = 'block';

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';

    // Route to the correct renderer based on the sub-assignment's type
    switch (subAssignmentData.type) {
        case 'quill':
            await renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'quiz':
            renderQuiz(subAssignmentData, assignmentId, subId);
            break;
        default:
            contentRenderer.innerHTML = '<p>Error: Unknown assignment type.</p>';
    }

    // Initialize the solution importer UI
    renderSolutionImporter(assignmentId, subId);
    
    // Check for and display any previously imported/cached solutions
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

/**
 * Sets up the UI for importing a solution file.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 */
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

/**
 * Handles the reading and processing of a selected solution file.
 * @param {Event} event - The file input change event.
 * @param {string} assignmentId - The main assignment ID.
 * @param {string} subId - The sub-assignment ID.
 */
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
    event.target.value = ''; // Reset file input
}

/**
 * Displays an imported solution in a dedicated container.
 * @param {object} solutionSubAssignmentData - The sub-assignment data for the solution.
 */
function displayImportedSolution(solutionSubAssignmentData) {
    const solutionContainer = document.getElementById('solution-display-container');
    solutionContainer.style.display = 'block';
    const title = document.createElement('h3');
    title.textContent = `Importierte Musterlösung für: ${solutionSubAssignmentData.title}`;
    
    solutionContainer.innerHTML = ''; 
    solutionContainer.appendChild(title);
    
    // Use the main solution renderer to display the content
    renderSolution(solutionSubAssignmentData, solutionContainer);
}