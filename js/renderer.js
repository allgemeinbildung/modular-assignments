import { saveAttachment, getAttachmentsForSubAssignment, deleteAttachment } from './db.js';

const QUILL_ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';

// Debounce function to limit the rate at which a function gets called.
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Renders a Quill-based assignment, including questions and attachment handling.
 */
async function renderQuill(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `${QUILL_ANSWER_PREFIX}${assignmentId}_sub_${subId}`;

    // Render questions as a numbered list
    const questionsList = document.createElement('ol');
    data.questions.forEach(q => {
        const listItem = document.createElement('li');
        listItem.innerHTML = q.text;
        questionsList.appendChild(listItem);
    });
    contentRenderer.appendChild(questionsList);

    // Create and initialize Quill editor
    const editorDiv = document.createElement('div');
    editorDiv.id = 'quill-editor';
    contentRenderer.appendChild(editorDiv);
    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }]] }
    });

    // Load saved answer from localStorage
    const savedAnswer = localStorage.getItem(storageKey);
    if (savedAnswer) {
        quill.root.innerHTML = savedAnswer;
    }

    // Save content on text-change, using debounce to improve performance
    quill.on('text-change', debounce(() => {
        const htmlContent = quill.root.innerHTML;
        if (htmlContent && htmlContent !== '<p><br></p>') {
            localStorage.setItem(storageKey, htmlContent);
        } else {
            localStorage.removeItem(storageKey);
        }
    }, 500));

    // Attachment section
    const attachmentContainer = document.createElement('div');
    attachmentContainer.className = 'attachments-section';
    attachmentContainer.innerHTML = `
        <h4>Anhänge</h4>
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
            const attachmentData = {
                assignmentId,
                subId,
                fileName: file.name,
                fileType: file.type,
                data: e.target.result // base64 data URL
            };
            await saveAttachment(attachmentData);
            await refreshAttachments();
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; // Reset input
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
 * Renders an interactive quiz.
 */
function renderQuiz(data, assignmentId, subId) {
    const contentRenderer = document.getElementById('content-renderer');
    const storageKey = `${QUILL_ANSWER_PREFIX}${assignmentId}_sub_${subId}`;
    const { questions } = data;
    let score = 0;

    contentRenderer.innerHTML = '<div class="quiz-container"></div>';
    const quizContainer = contentRenderer.querySelector('.quiz-container');

    questions.forEach((q, index) => {
        const questionEl = document.createElement('div');
        questionEl.className = 'quiz-question';
        questionEl.innerHTML = `<p><strong>${index + 1}. ${q.question}</strong></p>`;
        
        const optionsContainer = document.createElement('div');
        q.options.forEach(opt => {
            optionsContainer.innerHTML += `
                <div>
                    <input type="radio" name="q${index}" value="${opt.is_correct}" id="q${index}opt${opt.text.substring(0,5)}">
                    <label for="q${index}opt${opt.text.substring(0,5)}">${opt.text}</label>
                    <span class="feedback"></span>
                </div>`;
        });
        questionEl.appendChild(optionsContainer);
        quizContainer.appendChild(questionEl);
    });

    const checkAnswersBtn = document.createElement('button');
    checkAnswersBtn.textContent = 'Antworten prüfen';
    quizContainer.appendChild(checkAnswersBtn);

    checkAnswersBtn.addEventListener('click', () => {
        score = 0;
        questions.forEach((q, index) => {
            const selected = quizContainer.querySelector(`input[name="q${index}"]:checked`);
            const feedbacks = quizContainer.querySelectorAll(`input[name="q${index}"] ~ .feedback`);
            feedbacks.forEach(fb => { fb.textContent = ''; fb.className = 'feedback'; }); // Reset

            if (selected) {
                const isCorrect = selected.value === 'true';
                const feedbackSpan = selected.nextElementSibling.nextElementSibling;
                if (isCorrect) {
                    score++;
                    feedbackSpan.textContent = q.options.find(o => o.text === selected.nextElementSibling.textContent)?.feedback || "Richtig!";
                    feedbackSpan.classList.add('correct');
                } else {
                    feedbackSpan.textContent = q.options.find(o => o.text === selected.nextElementSibling.textContent)?.feedback || "Falsch.";
                    feedbackSpan.classList.add('incorrect');
                }
            }
        });
        checkAnswersBtn.textContent = `Ergebnis: ${score} / ${questions.length} - Erneut prüfen`;

        // Save result to localStorage
        const result = { score, total: questions.length };
        localStorage.setItem(storageKey, JSON.stringify(result));
    });
}

/**
 * Main function to render the sub-assignment based on its type.
 */
export async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('content-renderer').innerHTML = '';

    // Save questions to localStorage for submission gathering
    const questionsToStore = {};
    if (subAssignmentData.questions) {
        subAssignmentData.questions.forEach((q, i) => {
            // Use a generic key 'question_X'
            questionsToStore[`question_${i + 1}`] = q.text || q.question;
        });
    }
    const questionStorageKey = `${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`;
    localStorage.setItem(questionStorageKey, JSON.stringify(questionsToStore));
    
    // Add title to local storage
    const titleKey = `title_${assignmentId}_sub_${subId}`;
    localStorage.setItem(titleKey, subAssignmentData.title);

    switch (subAssignmentData.type) {
        case 'quill':
            await renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'quiz':
             // For simplicity, this example treats all quizzes as multiple choice.
             // The original repo's complex quiz renderer can be adapted if needed.
            renderQuiz(subAssignmentData, assignmentId, subId);
            break;
        default:
            document.getElementById('content-renderer').innerHTML = '<p>Error: Unknown assignment type.</p>';
    }
}