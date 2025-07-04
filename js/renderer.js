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
 * NEW: Renders a stateful, multi-type quiz engine.
 */
function renderQuiz(data, assignmentId, subId) {
    const { questions } = data;
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `${QUILL_ANSWER_PREFIX}${assignmentId}_sub_${subId}`;
    let currentIndex = 0;
    let userAnswers = JSON.parse(localStorage.getItem(storageKey) || '{ "userAnswers": {} }').userAnswers;

    const saveAnswers = () => {
        localStorage.setItem(storageKey, JSON.stringify({ userAnswers }));
    };

    const displayQuestion = () => {
        contentRenderer.innerHTML = '';
        const questionData = questions[currentIndex];
        
        const questionContainer = document.createElement('div');
        questionContainer.className = 'quiz-frame';
        questionContainer.innerHTML = `
            <div class="quiz-header">
                <h3>Frage ${currentIndex + 1} von ${questions.length}</h3>
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
                    const optionId = `q_${currentIndex}_${option.text.slice(0,5)}`;
                    optionsContainer.innerHTML += `
                        <div>
                            <input type="radio" name="mc_option" id="${optionId}" value="${option.text}">
                            <label for="${optionId}">${option.text}</label>
                        </div>`;
                });
                break;
            // Add other cases for 'trueFalse', 'dragTheWords' if needed
        }

        contentRenderer.appendChild(questionContainer);
        
        // Add navigation buttons
        const navContainer = questionContainer.querySelector('.quiz-navigation');
        if (currentIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Zurück';
            prevBtn.className = 'quiz-nav-btn secondary';
            prevBtn.onclick = () => { currentIndex--; displayQuestion(); };
            navContainer.appendChild(prevBtn);
        }
        if (currentIndex < questions.length - 1) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Weiter';
            nextBtn.className = 'quiz-nav-btn';
            nextBtn.onclick = () => { currentIndex++; displayQuestion(); };
            navContainer.appendChild(nextBtn);
        }

        // Add event listeners and restore state
        optionsContainer.addEventListener('change', e => {
            if (e.target.type === 'radio') {
                userAnswers[questionData.id] = e.target.value;
                saveAnswers();
            }
        });
        
        const savedAnswer = userAnswers[questionData.id];
        if (savedAnswer) {
            const selectedRadio = optionsContainer.querySelector(`input[value="${savedAnswer}"]`);
            if (selectedRadio) selectedRadio.checked = true;
        }
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