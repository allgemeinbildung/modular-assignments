import { getAllFiles } from './db.js';

/**
 * Parses a localStorage key to extract assignment details.
 * @param {string} key - The key from localStorage.
 * @returns {object|null} An object with details or null if no match.
 */
function parseKey(key) {
    const patterns = {
        quill: /^textbox-assignment_([^_]+)_textbox-sub_(.+)$/,
        quiz: /^(?:quiz|tf|drag)-assignment_([^_]+)_sub_(.+?)_question_(.+)$/
    };

    let match = key.match(patterns.quill);
    if (match) {
        const [, assignmentId, subId] = match;
        return { type: 'quill', assignmentId, subId, questionId: null };
    }

    match = key.match(patterns.quiz);
    if (match) {
        const [, assignmentId, subId, questionId] = match;
        return { type: 'quiz', assignmentId, subId, questionId };
    }

    return null;
}

/**
 * Gathers all student data, including questions and answers, into a structured object.
 * @returns {Promise<object|null>} The complete submission data object or null on failure.
 */
export async function gatherAllAssignmentsData() {
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

    // 1. Discover all unique assignments from localStorage keys
    const assignmentIdsToFetch = new Set();
    const allAnswerKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const parsedKey = parseKey(key);
        if (parsedKey) {
            assignmentIdsToFetch.add(parsedKey.assignmentId);
            allAnswerKeys.push(key);
        }
    }

    // Abort if there's nothing to submit
    if (assignmentIdsToFetch.size === 0 && (await getAllFiles()).length === 0) {
        alert('Keine bearbeiteten Aufgaben oder Anhänge zum Abgeben gefunden.');
        return null;
    }

    // 2. Fetch all necessary assignment JSON files in parallel
    const assignmentPromises = Array.from(assignmentIdsToFetch).map(id =>
        fetch(`assignments/${id}.json`).then(res => {
            if (!res.ok) throw new Error(`Could not fetch assignment: ${id}.json`);
            return res.json();
        }).then(data => ({ id, data }))
    );
    const fetchedAssignmentsArray = await Promise.all(assignmentPromises);
    const masterData = new Map(fetchedAssignmentsArray.map(item => [item.id, item.data]));

    // 3. Build the structured submission object with questions and answers
    const structuredAssignments = {};

    for (const key of allAnswerKeys) {
        const parsedKey = parseKey(key);
        if (!parsedKey) continue;

        const { assignmentId, subId, questionId } = parsedKey;
        const assignmentJson = masterData.get(assignmentId);
        const subAssignmentJson = assignmentJson?.subAssignments[subId];
        if (!subAssignmentJson) continue;

        // Create container for the main assignment if it doesn't exist
        if (!structuredAssignments[assignmentId]) {
            structuredAssignments[assignmentId] = {
                assignmentTitle: assignmentJson.assignmentTitle,
                subAssignments: {}
            };
        }

        // Create container for the sub-assignment if it doesn't exist
        const subAssignmentsContainer = structuredAssignments[assignmentId].subAssignments;
        if (!subAssignmentsContainer[subId]) {
            subAssignmentsContainer[subId] = {
                title: subAssignmentJson.title,
                type: subAssignmentJson.type,
                ...(subAssignmentJson.type === 'quill' ? 
                  { questions: subAssignmentJson.questions, answer: null } : 
                  { questions: [] })
            };
        }

        const subAssignmentOutput = subAssignmentsContainer[subId];
        const studentAnswerRaw = localStorage.getItem(key);

        if (subAssignmentOutput.type === 'quill') {
            subAssignmentOutput.answer = studentAnswerRaw;
        } else if (subAssignmentOutput.type === 'quiz') {
            const questionJson = subAssignmentJson.questions.find(q => q.id === questionId);
            if (questionJson && !subAssignmentOutput.questions.some(q => q.id === questionId)) {
                let correctAnswer;
                if (questionJson.type === 'multipleChoice') {
                    correctAnswer = questionJson.options.find(o => o.is_correct)?.text;
                } else if (questionJson.type === 'trueFalse') {
                    correctAnswer = questionJson.is_correct;
                } else if (questionJson.type === 'dragTheWords') {
                    correctAnswer = questionJson.solution;
                }

                subAssignmentOutput.questions.push({
                    id: questionJson.id,
                    type: questionJson.type,
                    question: questionJson.question,
                    studentAnswer: studentAnswerRaw,
                    correctAnswer: correctAnswer
                });
            }
        }
    }

    // Final student data object
    const studentData = {
        studentName: studentName,
        submissionDate: new Date().toISOString(),
        assignments: structuredAssignments,
        attachments: {}
    };

    // 4. Add file attachments as Base64 strings
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

    return studentData;
}

/**
 * Triggers the download of the submission data as a JSON file.
 * @param {object} data - The complete data from gatherAllAssignmentsData.
 */
export function submitAssignment(data) {
    if (!data) return;

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