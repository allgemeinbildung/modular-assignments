import { getAllFiles } from './db.js';

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

export function submitAssignment(data) {
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