import { getFilesForAssignment, addFile, deleteFile } from './db.js';

// ===================================================================================
//                                  SOLUTION RENDERER
// ===================================================================================

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

export function renderSolution(subAssignmentData, targetContainer = document.getElementById('content-renderer')) {
    targetContainer.innerHTML = '';
    document.getElementById('action-container').style.display = 'none';
    document.getElementById('solution-import-container').style.display = 'none';

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

function renderQuiz(data, assignmentId, subId) {
    const { questions } = data;
    let currentIndex = 0;
    let userAnswers = {};

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';

    const quizFrame = document.createElement('div');
    quizFrame.className = 'quiz-frame';
    const quizHeader = document.createElement('div');
    quizHeader.className = 'quiz-header';
    const progressIndicator = document.createElement('span');
    progressIndicator.className = 'quiz-progress';
    quizHeader.appendChild(progressIndicator);
    const questionDisplay = document.createElement('div');
    questionDisplay.className = 'quiz-question-display';
    const navigation = document.createElement('div');
    navigation.className = 'quiz-navigation';
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Zurück';
    prevButton.className = 'quiz-nav-btn secondary';
    const nextButton = document.createElement('button');
    nextButton.className = 'quiz-nav-btn';
    
    quizFrame.append(quizHeader, questionDisplay, navigation);
    navigation.append(prevButton, nextButton);
    contentRenderer.appendChild(quizFrame);

    const displayCurrentQuestion = () => {
        const questionData = questions[currentIndex];
        questionDisplay.innerHTML = '';

        switch (questionData.type) {
            case 'multipleChoice':
                renderSingleMultipleChoice(questionDisplay, questionData, userAnswers);
                break;
            case 'trueFalse':
                renderSingleTrueFalse(questionDisplay, questionData, userAnswers);
                break;
            case 'dragTheWords':
                renderSingleDragTheWords(questionDisplay, questionData, userAnswers, (answers) => {
                    userAnswers[questionData.id] = answers;
                    const storageKey = `drag-assignment_${assignmentId}_sub_${subId}_question_${questionData.id}`;
                    localStorage.setItem(storageKey, JSON.stringify(answers));
                });
                break;
        }

        progressIndicator.textContent = `Frage ${currentIndex + 1} von ${questions.length}`;
        prevButton.disabled = currentIndex === 0;
        nextButton.textContent = (currentIndex === questions.length - 1) ? 'Quiz beenden' : 'Weiter';
    };
    
    const showResults = () => {
        let score = 0;
        questions.forEach(q => {
            const userAnswer = userAnswers[q.id];
            let isCorrect = false;

            if (q.type === 'multipleChoice') {
                const correctOption = q.options.find(opt => opt.is_correct);
                isCorrect = correctOption && correctOption.text === userAnswer;
            } else if (q.type === 'trueFalse') {
                isCorrect = String(q.is_correct) === userAnswer;
            } else if (q.type === 'dragTheWords') {
                isCorrect = JSON.stringify(q.solution) === JSON.stringify(userAnswer);
            }
            if (isCorrect) score++;
        });

        contentRenderer.innerHTML = '';
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'quiz-results-container';
        resultsContainer.innerHTML = `<h2>Quiz abgeschlossen</h2><p class="result-summary">Dein Ergebnis: ${score} / ${questions.length}</p>`;
        
        questions.forEach(q => {
            const userAnswer = userAnswers[q.id];
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-question';
            
            let isCorrect = false;
            let correctAnswerText = '';
            let userAnswerText = Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer;

            if (q.type === 'multipleChoice') {
                correctAnswerText = q.options.find(opt => opt.is_correct).text;
                isCorrect = correctAnswerText === userAnswerText;
            } else if (q.type === 'trueFalse') {
                correctAnswerText = q.is_correct ? 'Wahr' : 'Falsch';
                userAnswerText = userAnswer === 'true' ? 'Wahr' : (userAnswer === 'false' ? 'Falsch' : '');
                isCorrect = String(q.is_correct) === userAnswer;
            } else if (q.type === 'dragTheWords') {
                correctAnswerText = q.solution.join(', ');
                isCorrect = JSON.stringify(q.solution) === JSON.stringify(userAnswer);
            }

            resultDiv.innerHTML = `<p><strong>${q.question}</strong></p>`;
            if (userAnswer !== undefined && userAnswerText) {
                 const answerClass = isCorrect ? 'correct' : 'incorrect';
                 const icon = isCorrect ? '✔' : '❌';
                 resultDiv.innerHTML += `<p class="user-answer ${answerClass}">${icon} Deine Antwort: ${userAnswerText}</p>`;
                 if(!isCorrect) {
                     resultDiv.innerHTML += `<p class="correct-answer-display">Richtige Antwort: ${correctAnswerText}</p>`;
                 }
            } else {
                resultDiv.innerHTML += `<p class="user-answer incorrect">❌ Keine Antwort gegeben.</p><p class="correct-answer-display">Richtige Antwort: ${correctAnswerText}</p>`;
            }
            resultsContainer.appendChild(resultDiv);
        });
        contentRenderer.appendChild(resultsContainer);
    };

    questionDisplay.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const questionId = event.target.name;
            const selectedValue = event.target.value;
            userAnswers[questionId] = selectedValue;
            const qType = questions.find(q => q.id === questionId).type;
            const prefix = qType === 'trueFalse' ? 'tf' : 'quiz';
            const storageKey = `${prefix}-assignment_${assignmentId}_sub_${subId}_question_${questionId}`;
            localStorage.setItem(storageKey, selectedValue);
        }
    });
    
    nextButton.addEventListener('click', () => {
        (currentIndex < questions.length - 1) ? (currentIndex++, displayCurrentQuestion()) : showResults();
    });

    prevButton.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            displayCurrentQuestion();
        }
    });

    questions.forEach(q => {
        const prefix = { multipleChoice: 'quiz', trueFalse: 'tf', dragTheWords: 'drag' }[q.type];
        const storageKey = `${prefix}-assignment_${assignmentId}_sub_${subId}_question_${q.id}`;
        const savedAnswer = localStorage.getItem(storageKey);
        if (savedAnswer) {
            try {
                userAnswers[q.id] = JSON.parse(savedAnswer);
            } catch {
                userAnswers[q.id] = savedAnswer;
            }
        }
    });

    displayCurrentQuestion();
}

function renderSingleMultipleChoice(container, questionData, userAnswers) {
    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>${questionData.question}</strong>`;
    container.appendChild(questionText);
    questionData.options.forEach(option => {
        const optionId = `${questionData.id}-${option.text.replace(/\s+/g, '-')}`;
        const wrapper = document.createElement('div');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = questionData.id;
        radio.value = option.text;
        radio.id = optionId;
        if (userAnswers[questionData.id] === option.text) radio.checked = true;
        const label = document.createElement('label');
        label.htmlFor = optionId;
        label.textContent = option.text;
        wrapper.append(radio, label);
        container.appendChild(wrapper);
    });
}

function renderSingleTrueFalse(container, questionData, userAnswers) {
    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>${questionData.question}</strong>`;
    container.appendChild(questionText);
    ['true', 'false'].forEach(value => {
        const optionId = `${questionData.id}-${value}`;
        const wrapper = document.createElement('div');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = questionData.id;
        radio.value = value;
        radio.id = optionId;
        if (userAnswers[questionData.id] === value) radio.checked = true;
        const label = document.createElement('label');
        label.htmlFor = optionId;
        label.textContent = value === 'true' ? 'Wahr' : 'Falsch';
        wrapper.append(radio, label);
        container.appendChild(wrapper);
    });
}

/**
 * Renders a fully interactive drag-and-drop question.
 */
function renderSingleDragTheWords(container, questionData, userAnswers, onAnswerUpdate) {
    const questionText = document.createElement('p');
    questionText.innerHTML = `<strong>${questionData.question}</strong>`;
    container.appendChild(questionText);

    const sentenceContainer = document.createElement('p');
    sentenceContainer.className = 'sentence-container';
    const wordBank = document.createElement('div');
    wordBank.className = 'word-bank';
    wordBank.id = `word-bank-${questionData.id}`;

    // --- Event Handlers ---
    const onDragStart = (event) => {
        event.dataTransfer.setData("text/plain", event.target.id);
        event.dataTransfer.dropEffect = "move";
    };

    const onDragOver = (event) => {
        event.preventDefault();
        event.target.classList.add('drag-over');
    };

    const onDragLeave = (event) => {
        event.target.classList.remove('drag-over');
    };

    const onDrop = (event) => {
        event.preventDefault();
        event.target.classList.remove('drag-over');
        const draggedId = event.dataTransfer.getData("text/plain");
        const draggedEl = document.getElementById(draggedId);
        const targetEl = event.target;

        if (targetEl.classList.contains('drop-zone') || targetEl.classList.contains('word-bank')) {
            if (targetEl.children.length > 0 && targetEl.classList.contains('drop-zone')) {
                wordBank.appendChild(targetEl.children[0]);
            }
            targetEl.appendChild(draggedEl);
        }
        
        // Update answers
        const currentAnswers = [];
        sentenceContainer.querySelectorAll('.drop-zone').forEach(zone => {
            currentAnswers.push(zone.children.length > 0 ? zone.children[0].textContent : null);
        });
        onAnswerUpdate(currentAnswers);
    };

    // --- Element Creation ---
    wordBank.addEventListener('dragover', onDragOver);
    wordBank.addEventListener('dragleave', onDragLeave);
    wordBank.addEventListener('drop', onDrop);

    const dropZones = [];
    const sentenceParts = questionData.content.split('[BLANK]');
    sentenceParts.forEach((part, index) => {
        sentenceContainer.appendChild(document.createTextNode(part));
        if (index < sentenceParts.length - 1) {
            const dropZone = document.createElement('span');
            dropZone.className = 'drop-zone';
            dropZone.id = `drop-zone-${questionData.id}-${index}`;
            dropZone.addEventListener('dragover', onDragOver);
            dropZone.addEventListener('dragleave', onDragLeave);
            dropZone.addEventListener('drop', onDrop);
            sentenceContainer.appendChild(dropZone);
            dropZones.push(dropZone);
        }
    });

    questionData.words.forEach((word, index) => {
        const wordEl = document.createElement('span');
        wordEl.id = `word-${questionData.id}-${index}`;
        wordEl.className = 'draggable-word';
        wordEl.draggable = true;
        wordEl.textContent = word;
        wordEl.addEventListener('dragstart', onDragStart);
        wordBank.appendChild(wordEl);
    });

    container.append(sentenceContainer, wordBank);
    
    // Restore saved state
    const savedAnswers = userAnswers[questionData.id];
    if (Array.isArray(savedAnswers)) {
        savedAnswers.forEach((answer, index) => {
            if (answer) {
                const wordEl = Array.from(wordBank.children).find(w => w.textContent === answer);
                if (wordEl) {
                    dropZones[index].appendChild(wordEl);
                }
            }
        });
    }
}

// ===================================================================================
//                                MASTER RENDERER & IMPORTER
// ===================================================================================

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
        case 'quiz':
            renderQuiz(subAssignmentData, assignmentId, subId);
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
                alert('Fehler: Diese Lösungsdatei passt nicht zur aktuellen Aufgabe...');
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
    title.textContent = `Importierte Musterlösung für: ${solutionSubAssignmentData.title}`;
    
    solutionContainer.innerHTML = ''; 
    solutionContainer.appendChild(title);
    
    renderSolution(solutionSubAssignmentData, solutionContainer);
}