import { saveAttachment, getAttachmentsForSubAssignment, deleteAttachment } from './db.js';

const QUILL_ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_';

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function renderQuill(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `${QUILL_ANSWER_PREFIX}${assignmentId}_sub_${subId}`;

    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = q.text;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['image', 'clean']
            ]
        }
    });

    const savedAnswer = localStorage.getItem(storageKey);
    if (savedAnswer) {
        quill.root.innerHTML = savedAnswer;
    }

    quill.on('text-change', debounce(() => {
        const htmlContent = quill.root.innerHTML;
        if (htmlContent && htmlContent !== '<p><br></p>') {
            localStorage.setItem(storageKey, htmlContent);
        } else {
            localStorage.removeItem(storageKey);
        }
    }, 500));
    
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            await saveAttachment({
                assignmentId,
                subId,
                fileName: file.name,
                fileType: file.type,
                data: e.target.result
            });
            await refreshAttachments();
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
    });

    attachmentsListDiv.addEventListener('click', async (event) => {
        if (event.target.tagName === 'BUTTON') {
            const attachmentId = parseInt(event.target.dataset.id, 10);
            if (confirm('Anhang wirklich löschen?')) {
                await deleteAttachment(attachmentId);
                await refreshAttachments();
            }
        }
    });

    await refreshAttachments();
}


/**
 * Renders a stateful, multi-type quiz engine.
 */
function renderQuiz(data, assignmentId, subId) {
    const { questions } = data;
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `${QUILL_ANSWER_PREFIX}${assignmentId}_sub_${subId}`;
    let currentIndex = 0;
    
    let savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
    let userAnswers = savedData.userAnswers || {};

    const saveAnswers = () => {
        const currentSavedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        currentSavedData.userAnswers = userAnswers;
        localStorage.setItem(storageKey, JSON.stringify(currentSavedData));
    };

    const showResults = () => {
        let score = 0;
        let resultsDetailsHTML = '';

        questions.forEach(q => {
            const userAnswer = userAnswers[q.id];
            let isCorrect = false;
            let correctAnswerText = '';
            let studentAnswerForDisplay = userAnswer;

            switch (q.type) {
                case 'multipleChoice':
                    const correctOption = q.options.find(opt => opt.is_correct);
                    correctAnswerText = correctOption ? correctOption.text : 'N/A';
                    isCorrect = userAnswer === correctAnswerText;
                    break;
                case 'trueFalse':
                    correctAnswerText = q.is_correct ? 'True' : 'False';
                    isCorrect = (userAnswer || '').toLowerCase() === correctAnswerText.toLowerCase();
                    break;
                case 'dragTheWords':
                    correctAnswerText = q.solution.join(', ');
                    let userAnswerText = '';
                    try {
                        const userAnswerArray = JSON.parse(userAnswer || '[]');
                        userAnswerText = Array.isArray(userAnswerArray) ? userAnswerArray.join(', ') : '';
                        studentAnswerForDisplay = userAnswerText;
                    } catch {
                        userAnswerText = userAnswer || '';
                    }
                    isCorrect = userAnswerText === correctAnswerText;
                    break;
            }

            if (isCorrect) {
                score++;
            }

            resultsDetailsHTML += `
                <div class="result-question">
                    <p><strong>${q.question}</strong></p>
                    <p class="user-answer ${isCorrect ? 'correct' : 'incorrect'}"><strong>Your Answer:</strong> ${studentAnswerForDisplay || 'Not answered'}</p>
                    ${!isCorrect ? `<p class="correct-answer-display"><strong>Correct Answer:</strong> ${correctAnswerText}</p>` : ''}
                </div>
            `;
        });

        const scoreString = `${score} / ${questions.length}`;
        
        const dataToSave = {
            userAnswers,
            score: scoreString
        };
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));

        const summaryHTML = `
            <div class="quiz-results-container">
                <h2>Quiz Complete!</h2>
                <div class="result-summary">${scoreString} Correct</div>
                ${resultsDetailsHTML}
            </div>
        `;
        contentRenderer.innerHTML = summaryHTML;
    };
    
    const displayQuestion = () => {
        contentRenderer.innerHTML = '';
        const questionData = questions[currentIndex];
        
        const questionContainer = document.createElement('div');
        questionContainer.className = 'quiz-frame';
        questionContainer.innerHTML = `
            <div class="quiz-header">
                <h3>Frage ${currentIndex + 1} von ${questions.length}</h3>
                <span class="quiz-progress">${currentIndex + 1}/${questions.length}</span>
            </div>
            <div class="quiz-question-display">
                <p><strong>${questionData.question}</strong></p>
                <div class="options-container"></div>
            </div>
            <div class="quiz-navigation"></div>
        `;

        const optionsContainer = questionContainer.querySelector('.options-container');

        switch (questionData.type) {
            // ✅ FIXED: Added missing logic for multipleChoice
            case 'multipleChoice':
                questionData.options.forEach(option => {
                    const optionId = `q_${currentIndex}_${option.text.replace(/\s/g, '')}`;
                    optionsContainer.innerHTML += `
                        <div>
                            <input type="radio" name="mc_option" id="${optionId}" value="${option.text}" ${userAnswers[questionData.id] === option.text ? 'checked' : ''}>
                            <label for="${optionId}">${option.text}</label>
                        </div>`;
                });
                optionsContainer.addEventListener('change', e => {
                    if (e.target.name === 'mc_option') {
                        userAnswers[questionData.id] = e.target.value;
                        saveAnswers();
                    }
                });
                break;
            
            // ✅ FIXED: Added missing logic for trueFalse
            case 'trueFalse':
                 optionsContainer.innerHTML += `
                    <div>
                        <input type="radio" name="tf_option" id="q_${currentIndex}_true" value="True" ${userAnswers[questionData.id] === 'True' ? 'checked' : ''}>
                        <label for="q_${currentIndex}_true">Richtig</label>
                    </div>
                    <div>
                        <input type="radio" name="tf_option" id="q_${currentIndex}_false" value="False" ${userAnswers[questionData.id] === 'False' ? 'checked' : ''}>
                        <label for="q_${currentIndex}_false">Falsch</label>
                    </div>`;
                optionsContainer.addEventListener('change', e => {
                    if (e.target.name === 'tf_option') {
                        userAnswers[questionData.id] = e.target.value;
                        saveAnswers();
                    }
                });
                break;
            
            case 'dragTheWords':
                {
                    const { content, words, id: questionId } = questionData;
                    let blankIndex = 0;
                    const sentenceHTML = content.replace(/\[BLANK\]/g, () =>
                        `<span class="drop-zone" data-blank-index="${blankIndex++}"></span>`
                    );
                    const wordsHTML = words.map((word, index) =>
                        `<span class="draggable-word" draggable="true" data-word-id="${questionId}_${index}">${word}</span>`
                    ).join('');

                    optionsContainer.innerHTML = `
                        <div class="sentence-container">${sentenceHTML}</div>
                        <div class="word-bank">${wordsHTML}</div>
                    `;

                    const wordBank = optionsContainer.querySelector('.word-bank');
                    const dropZones = optionsContainer.querySelectorAll('.drop-zone');
                    let selectedWordEl = null;

                    const updateAnswer = () => {
                        const currentAnswers = Array.from(dropZones).map(zone => {
                            const wordEl = zone.querySelector('.draggable-word');
                            return wordEl ? wordEl.textContent : "";
                        });
                        userAnswers[questionId] = JSON.stringify(currentAnswers);
                        saveAnswers();
                    };

                    const placeWord = (targetZone, wordEl) => {
                        if (!targetZone || !wordEl) return;
                        const existingWord = targetZone.querySelector('.draggable-word');
                        if (existingWord) {
                            wordBank.appendChild(existingWord);
                        }
                        targetZone.appendChild(wordEl);
                    };

                    const savedSlots = JSON.parse(userAnswers[questionId] || '[]');
                    savedSlots.forEach((wordText, index) => {
                        if (wordText) {
                            const targetZone = optionsContainer.querySelector(`.drop-zone[data-blank-index="${index}"]`);
                            const wordEl = Array.from(wordBank.querySelectorAll('.draggable-word')).find(w => w.textContent === wordText);
                            if (targetZone && wordEl) {
                                targetZone.appendChild(wordEl);
                            }
                        }
                    });

                    optionsContainer.addEventListener('click', (e) => {
                        const target = e.target;
                        if (target.classList.contains('draggable-word')) {
                            if (selectedWordEl === target) {
                                selectedWordEl.classList.remove('selected-word');
                                selectedWordEl = null;
                            } else {
                                if (selectedWordEl) selectedWordEl.classList.remove('selected-word');
                                selectedWordEl = target;
                                selectedWordEl.classList.add('selected-word');
                            }
                        } else if ((target.classList.contains('drop-zone') || target.parentElement.classList.contains('drop-zone')) && selectedWordEl) {
                            const zone = target.classList.contains('drop-zone') ? target : target.parentElement;
                            placeWord(zone, selectedWordEl);
                            selectedWordEl.classList.remove('selected-word');
                            selectedWordEl = null;
                            updateAnswer();
                        } else if (target.classList.contains('word-bank') && selectedWordEl) {
                            wordBank.appendChild(selectedWordEl);
                            selectedWordEl.classList.remove('selected-word');
                            selectedWordEl = null;
                            updateAnswer();
                        }
                    });

                    optionsContainer.addEventListener('dragstart', e => {
                        if (e.target.classList.contains('draggable-word')) {
                            e.dataTransfer.setData('text/plain', e.target.dataset.wordId);
                            setTimeout(() => e.target.classList.add('dragging'), 0);
                        }
                    });

                    optionsContainer.addEventListener('dragend', e => {
                        if (e.target.classList.contains('draggable-word')) {
                            e.target.classList.remove('dragging');
                        }
                    });
                    
                    ['dragover', 'dragenter'].forEach(eventName => {
                        optionsContainer.addEventListener(eventName, e => {
                             e.preventDefault();
                             const target = e.target.classList.contains('drop-zone') ? e.target : e.target.closest('.drop-zone');
                             if(target) target.classList.add('drag-over');
                        });
                    });

                    ['dragleave', 'drop'].forEach(eventName => {
                        optionsContainer.addEventListener(eventName, e => {
                            const target = e.target.classList.contains('drop-zone') ? e.target : e.target.closest('.drop-zone');
                             if(target) target.classList.remove('drag-over');
                        });
                    });

                    optionsContainer.addEventListener('drop', e => {
                        e.preventDefault();
                        const wordId = e.dataTransfer.getData('text/plain');
                        const draggedWordEl = optionsContainer.querySelector(`[data-word-id="${wordId}"]`);
                        if (!draggedWordEl) return;
                        
                        const dropTarget = e.target.classList.contains('drop-zone') ? e.target : e.target.closest('.drop-zone');
                        const bankTarget = e.target.classList.contains('word-bank') ? e.target : e.target.closest('.word-bank');

                        if (dropTarget) {
                            placeWord(dropTarget, draggedWordEl);
                        } else if(bankTarget) {
                            bankTarget.appendChild(draggedWordEl);
                        }
                        updateAnswer();
                    });
                }
                break;
        }

        contentRenderer.appendChild(questionContainer);
        
        const navContainer = questionContainer.querySelector('.quiz-navigation');
        if (currentIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Zurück';
            prevBtn.className = 'quiz-nav-btn secondary';
            prevBtn.onclick = () => { currentIndex--; displayQuestion(); };
            navContainer.appendChild(prevBtn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'quiz-nav-btn';
        if (currentIndex < questions.length - 1) {
            nextBtn.textContent = 'Weiter';
            nextBtn.onclick = () => { currentIndex++; displayQuestion(); };
        } else {
            nextBtn.textContent = 'Fertigstellen';
            nextBtn.onclick = showResults;
        }
        navContainer.appendChild(nextBtn);
    };

    displayQuestion();
}


/**
 * Main function to render the sub-assignment based on its type.
 */
export async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('content-renderer').innerHTML = '';

    if (subAssignmentData.questions) {
        localStorage.setItem(`${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`, JSON.stringify(subAssignmentData.questions));
    }
    localStorage.setItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}`, subAssignmentData.title);
    localStorage.setItem(`${TYPE_PREFIX}${assignmentId}_sub_${subId}`, subAssignmentData.type);

    switch (subAssignmentData.type) {
        case 'quill':
            await renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'quiz':
            renderQuiz(subAssignmentData, assignmentId, subId);
            break;
        default:
            document.getElementById('content-renderer').innerHTML = '<p>Error: Unknown assignment type.</p>';
    }
}