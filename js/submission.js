import { SCRIPT_URL } from './config.js';
import { getAllAttachments } from './db.js';

const ANSWER_PREFIX = 'modular-answer_';
const QUESTIONS_PREFIX = 'modular-questions_';
const TITLE_PREFIX = 'title_';

/**
 * Gathers all assignment data from localStorage and IndexedDB.
 * This function mimics the logic from the working `textboxv2`.
 */
async function gatherAllAssignmentsData() {
    let identifier = localStorage.getItem('studentIdentifier');
    if (!identifier) {
        identifier = prompt('Bitte gib deinen Namen oder eine eindeutige Kennung für diese Abgabe ein:', '');
        if (!identifier) {
            alert('Aktion abgebrochen. Eine Kennung ist erforderlich.');
            return null;
        }
        localStorage.setItem('studentIdentifier', identifier);
    }

    const allDataPayload = {};
    const answerRegex = new RegExp(`^${ANSWER_PREFIX}(.+)_sub_(.+)$`);

    // 1. Gather all answers from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key.match(answerRegex);
        if (match) {
            const [, assignmentId, subId] = match;
            if (!allDataPayload[assignmentId]) allDataPayload[assignmentId] = {};
            if (!allDataPayload[assignmentId][subId]) allDataPayload[assignmentId][subId] = {};
            
            allDataPayload[assignmentId][subId].answer = localStorage.getItem(key);
        }
    }

    // 2. Gather corresponding questions and titles
    for (const assignmentId in allDataPayload) {
        for (const subId in allDataPayload[assignmentId]) {
            const questionKey = `${QUESTIONS_PREFIX}${assignmentId}_sub_${subId}`;
            const questions = localStorage.getItem(questionKey);
            if (questions) {
                try {
                    allDataPayload[assignmentId][subId].questions = JSON.parse(questions);
                } catch (e) { console.error(`Error parsing questions for ${questionKey}`, e); }
            }
             const titleKey = `${TITLE_PREFIX}${assignmentId}_sub_${subId}`;
             const title = localStorage.getItem(titleKey);
             if(title) {
                allDataPayload[assignmentId][subId].title = title;
             }
        }
    }

    // 3. Gather all attachments from IndexedDB
    const allAttachments = await getAllAttachments();
    allAttachments.forEach(att => {
        if (allDataPayload[att.assignmentId] && allDataPayload[att.assignmentId][att.subId]) {
            if (!allDataPayload[att.assignmentId][att.subId].attachments) {
                allDataPayload[att.assignmentId][att.subId].attachments = [];
            }
            allDataPayload[att.assignmentId][att.subId].attachments.push({
                fileName: att.fileName,
                fileType: att.fileType,
                data: att.data
            });
        }
    });

    if (Object.keys(allDataPayload).length === 0) {
        alert("Es wurden keine gespeicherten Aufträge zum Senden gefunden.");
        return null;
    }

    return {
        identifier,
        payload: allDataPayload,
        createdAt: new Date().toISOString()
    };
}


/**
 * Main submission function. Gathers data and sends it to Google Apps Script.
 */
export async function submitAssignment() {
    console.log("Starting submission process...");
    const finalObject = await gatherAllAssignmentsData();
    if (!finalObject) return;

    if (!SCRIPT_URL || SCRIPT_URL === 'PASTE_YOUR_GOOGLE_SCRIPT_URL_HERE') {
        alert('Konfigurationsfehler: Die Abgabe-URL ist nicht in js/config.js festgelegt.');
        return;
    }

    if (!confirm("Du bist dabei, ALLE gespeicherten Aufträge an deinen Lehrer zu senden. Fortfahren?")) {
        alert("Abgabe abgebrochen.");
        return;
    }

    const submitButton = document.getElementById('submit-all');
    submitButton.textContent = 'Wird übermittelt...';
    submitButton.disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(finalObject)
        });
        const result = await response.json();

        if (response.ok && result.status === 'success') {
            alert(`Deine Arbeiten wurden erfolgreich übermittelt.\n\nDu kannst sie in diesem Ordner einsehen:\n${result.folderUrl}`);
        } else {
            throw new Error(result.message || 'Ein unbekannter Server-Fehler ist aufgetreten.');
        }
    } catch (error) {
        console.error('Google Drive submission failed:', error);
        alert(`Fehler beim Senden der Daten an Google Drive.\n\nFehler: ${error.message}`);
    } finally {
        submitButton.textContent = 'Alle Aufträge abgeben';
        submitButton.disabled = false;
    }
}