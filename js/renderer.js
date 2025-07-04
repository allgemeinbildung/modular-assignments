import { saveAttachment, getAttachmentsForSubAssignment, deleteAttachment } from './db.js';

const QUILL_ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';

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

    // Add image button to toolbar
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
    
    const attachmentContainer = document.createElement('div');
    attachmentContainer.className = 'attachments-section';
    attachmentContainer.style.marginTop = '20px';
    attachmentContainer.innerHTML = `
        <h4>Externe Anhänge (Dateien)</h4>
        <label for="file-attachment" class="file-upload-btn">Datei hochladen</label>
        <input type="file" id="file-attachment" style="display: none;">
        <div id="current-attachments"></div>`;
    contentRenderer.appendChild(attachmentContainer);

    const fileInput = document.getElementById('file-attachment');
    const attachmentsListDiv = document.getElementById('current-attachments');

    const refreshAttachments = async () => {
        const attachments = await getAttachmentsForSubAssignment(assignmentId, subId);
        attachmentsListDiv.innerHTML = '';
        attachments.forEach(att => {
            const item = document.createElement('div');
            item.className = 'attachment-item';
            item.innerHTML = `<span>${att.fileName}</span><button data-id="${att.id}">Löschen</button>`;
            attachmentsListDiv.appendChild(item);
        });
    };

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
 * NEW: Renders a stateful, multi-type quiz engine with a results summary.
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
                    <p class="user-answer ${isCorrect ? 'correct' : 'incorrect'}"><strong>Your Answer:</strong> ${userAnswer || 'Not answered'}</p>
                    ${!isCorrect ? `<p class="correct-answer-display"><strong>Correct Answer:</strong> ${correctAnswerText}</p>` : ''}
                </div>
            `;
        });

        const scoreString = `${score} / ${questions.length}`;

        // ✅ MODIFIED: Save score to localStorage along with answers
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
            case 'trueFalse':
                 optionsContainer.innerHTML += `
                    <div>
                        <input type="radio" name="tf_option" id="q_${currentIndex}_true" value="True" ${userAnswers[questionData.id] === 'True' ? 'checked' : ''}>
                        <label for="q_${currentIndex}_true">True</label>
                    </div>
                    <div>
                        <input type="radio" name="tf_option" id="q_${currentIndex}_false" value="False" ${userAnswers[questionData.id] === 'False' ? 'checked' : ''}>
                        <label for="q_${currentIndex}_false">False</label>
                    </div>`;
                optionsContainer.addEventListener('change', e => {
                    if (e.target.name === 'tf_option') {
                        userAnswers[questionData.id] = e.target.value;
                        saveAnswers();
                    }
                });
                break;
            case 'dragTheWords':
                let blankIndex = 0;
                const sentenceHTML = questionData.content.replace(/\[BLANK\]/g, () => `<input type="text" class="drag-the-words-blank" data-blank-index="${blankIndex++}" style="margin: 0 5px;"/>`);
                optionsContainer.innerHTML = `
                    <div class="sentence-container">${sentenceHTML}</div>
                    <div class="word-bank" style="margin-top: 15px;"><strong>Words:</strong> ${questionData.words.join(', ')}</div>`;
                
                const blanks = optionsContainer.querySelectorAll('.drag-the-words-blank');
                const savedSlots = JSON.parse(userAnswers[questionData.id] || '[]');
                blanks.forEach((blank, index) => {
                    if (savedSlots[index]) blank.value = savedSlots[index];
                });

                optionsContainer.addEventListener('input', debounce(e => {
                    if (e.target.classList.contains('drag-the-words-blank')) {
                        const currentAnswers = Array.from(blanks).map(b => b.value);
                        userAnswers[questionData.id] = JSON.stringify(currentAnswers);
                        saveAnswers();
                    }
                }, 300));
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

    const questionsToStore = {};
    if (subAssignmentData.questions) {
        subAssignmentData.questions.forEach(q => {
            questionsToStore[q.id] = q.text || q.question;
        });
    }
    localStorage.setItem(`${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`, JSON.stringify(questionsToStore));
    localStorage.setItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}`, subAssignmentData.title);

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