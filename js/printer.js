import { getAttachmentsForSubAssignment } from './db.js';

const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';
const TYPE_PREFIX = 'type_';

/**
 * Gathers all data for a specific assignment ID from localStorage and IndexedDB.
 * @param {string} assignmentId The ID of the assignment to gather data for.
 * @returns {Promise<object|null>} An object with the assignment data or null if not found.
 */
async function gatherAssignmentData(assignmentId) {
    const studentIdentifier = localStorage.getItem('studentIdentifier') || 'Unbekannter Schüler';
    
    const assignmentResponse = await fetch(`assignments/${assignmentId}.json`);
    if (!assignmentResponse.ok) {
        throw new Error(`Konnte die Aufgabendatei nicht laden: ${assignmentId}.json`);
    }
    const assignmentDef = await assignmentResponse.json();
    const assignmentTitle = assignmentDef.assignmentTitle;
    
    const subAssignments = {};
    const keyRegex = new RegExp(`^${ANSWER_PREFIX}${assignmentId}_sub_(.+)$`);

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key.match(keyRegex);
        if (match) {
            const subId = match[1];
            
            const answer = localStorage.getItem(key) || '';
            const title = localStorage.getItem(`${TITLE_PREFIX}${assignmentId}_sub_${subId}`) || subId;
            const type = localStorage.getItem(`${TYPE_PREFIX}${assignmentId}_sub_${subId}`);
            const questionsStr = localStorage.getItem(`${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`);
            const questions = questionsStr ? JSON.parse(questionsStr) : [];
            const attachments = await getAttachmentsForSubAssignment(assignmentId, subId);

            subAssignments[subId] = { answer, title, type, questions, attachments };
        }
    }

    if (Object.keys(subAssignments).length === 0) {
        alert("Für diese Aufgabe wurden keine gespeicherten Antworten gefunden.");
        return null;
    }

    return {
        studentIdentifier,
        assignmentTitle,
        subAssignments
    };
}

/**
 * Generates the HTML content for the print window.
 * @param {object} data The gathered assignment data.
 * @returns {string} The complete HTML string for printing.
 */
function generatePrintHTML(data) {
    let bodyContent = `<h1>${data.assignmentTitle}</h1>`;
    bodyContent += `<p><strong>Schüler/in:</strong> ${data.studentIdentifier}</p>`;
    bodyContent += `<hr>`;

    const sortedSubIds = Object.keys(data.subAssignments).sort();

    for (const subId of sortedSubIds) {
        const subData = data.subAssignments[subId];
        bodyContent += `<div class="sub-assignment">`;
        bodyContent += `<h2>${subData.title}</h2>`;

        if (subData.type === 'quill') {
            const questionsHTML = subData.questions.map(q => `<li>${q.text}</li>`).join('');
            bodyContent += `<h3>Fragen:</h3><ol>${questionsHTML}</ol>`;
            bodyContent += `<h3>Antwort:</h3><div class="answer-box">${subData.answer}</div>`;

            if (subData.attachments && subData.attachments.length > 0) {
                bodyContent += `<h4>Anhänge:</h4><ul>`;
                subData.attachments.forEach(att => {
                    bodyContent += `<li>${att.fileName}</li>`;
                });
                bodyContent += `</ul>`;
            }
        } else if (subData.type === 'quiz') {
            let studentAnswers = {};
            let score = 'N/A';
            try {
                const parsedAnswer = JSON.parse(subData.answer || '{}');
                studentAnswers = parsedAnswer.userAnswers || JSON.parse(subData.answer || '{}');
                score = parsedAnswer.score || 'Nicht bewertet';
            } catch {
                try {
                   studentAnswers = JSON.parse(subData.answer || '{}');
                } catch {
                   studentAnswers = {};
                }
            }

            bodyContent += `<p><strong>Ergebnis:</strong> ${score}</p>`;
            
            subData.questions.forEach(q => {
                const studentAns = studentAnswers[q.id];
                let studentAnswerForDisplay = studentAns;

                bodyContent += `<div class="question-block">`;
                bodyContent += `<p class="question-text">${q.question}</p>`;
                
                if (q.type === 'dragTheWords') {
                    try {
                        const parsed = JSON.parse(studentAns || '[]');
                        studentAnswerForDisplay = Array.isArray(parsed) ? parsed.join(', ') : studentAns;
                    } catch { /* ignore */ }
                }

                bodyContent += `<div class="answer"><strong>Ihre Antwort:</strong> ${studentAnswerForDisplay || 'Nicht beantwortet'}</div>`;
                bodyContent += `</div>`;
            });
        }
        bodyContent += `</div>`;
    }

    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; margin: 2em; }
        h1, h2, h3, h4 { color: #333; }
        h1 { font-size: 2em; border-bottom: 2px solid #ccc; padding-bottom: 0.5em; }
        h2 { font-size: 1.5em; background-color: #f0f0f0; padding: 0.5em; margin-top: 2em; border-left: 5px solid #007bff; }
        .sub-assignment { page-break-inside: avoid; margin-bottom: 2em; }
        .question-block { margin-top: 1.5em; padding-left: 1em; border-left: 2px solid #eee; }
        .question-text p { font-weight: bold; }
        .answer, .answer-box { padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-top: 8px; background-color: #f9f9f9; }
        ul, ol { padding-left: 20px; }
        hr { border: 0; border-top: 1px solid #ccc; }
        @media print {
            h2 { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
            button { display: none; }
        }
    `;

    return `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Druckansicht: ${data.assignmentTitle}</title>
            <style>${css}</style>
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `;
}

/**
 * Opens a new window with the assignment data and triggers the browser's print dialog.
 * @param {string} assignmentId The ID of the assignment to print.
 */
export async function printAssignmentAnswers(assignmentId) {
    console.log(`Starting print process for assignment: ${assignmentId}`);
    const data = await gatherAssignmentData(assignmentId);
    if (!data) return;

    const htmlContent = generatePrintHTML(data);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Popup-Fenster wurde blockiert. Bitte erlaube Popups für diese Seite, um drucken zu können.");
        return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}