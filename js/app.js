document.addEventListener('DOMContentLoaded', () => {
    // 1. URL-Parameter auslesen
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('assignmentId');
    const subId = urlParams.get('subId');
    const viewMode = urlParams.get('view');

    if (!assignmentId || !subId) {
        document.getElementById('main-title').textContent = 'Fehler';
        document.getElementById('content-renderer').innerHTML = '<p>Keine assignmentId oder subId in der URL gefunden.</p>';
        return;
    }

    const submitButton = document.getElementById('submit-all');
    if (submitButton && viewMode !== 'solution') {
        // MODIFIED: Make the event listener async
        submitButton.addEventListener('click', async () => {
            const allData = await gatherAllAssignmentsData();
            if (allData) {
                submitAssignment(allData);
            }
        });
    }

    // 2. JSON-Datei abrufen
    const jsonPath = `assignments/${assignmentId}.json`;

    fetch(jsonPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP-Fehler! Status: ${response.status}, Pfad: ${jsonPath}`);
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('main-title').textContent = data.assignmentTitle;
            const subAssignmentData = data.subAssignments[subId];

            if (!subAssignmentData) {
                throw new Error(`Teilaufgabe mit der ID "${subId}" in der JSON-Datei nicht gefunden.`);
            }
            
            if (viewMode === 'solution') {
                renderSolution(subAssignmentData);
            } else {
                renderSubAssignment(subAssignmentData, assignmentId, subId);
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Aufgabe:', error);
            document.getElementById('main-title').textContent = 'Fehler beim Laden der Aufgabe';
            document.getElementById('content-renderer').innerHTML = `<p>Ein Fehler ist aufgetreten. Bitte überprüfen Sie die Browser-Konsole für weitere Details.</p><p>Fehlermeldung: ${error.message}</p>`;
        });
});

// --- renderSolution remains unchanged ---
function renderSolution(subAssignmentData) {
    document.getElementById('sub-title').textContent = `Lösung: ${subAssignmentData.title}`;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('action-container').style.display = 'none';

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = ''; 

    switch (subAssignmentData.type) {
        case 'quill':
            const questionsList = document.createElement('ol');
            subAssignmentData.questions.forEach(q => {
                const listItem = document.createElement('li');
                listItem.innerHTML = q.text;
                questionsList.appendChild(listItem);
            });
            contentRenderer.appendChild(questionsList);

            if (subAssignmentData.solution && subAssignmentData.solution.type === 'html') {
                const solutionBox = document.createElement('div');
                solutionBox.style.cssText = 'background-color:#e9f7ef; border:1px solid #a3d9b1; border-radius:5px; padding:15px; margin-top:20px;';
                solutionBox.innerHTML = subAssignmentData.solution.content;
                contentRenderer.appendChild(solutionBox);
            } else {
                contentRenderer.innerHTML += '<p>Für diese Aufgabe ist keine Lösung im HTML-Format verfügbar.</p>';
            }
            break;
        
        case 'multipleChoice':
             // ... same as before ...
            break;
            
        default:
            contentRenderer.innerHTML = '<p>Unbekannter Lösungstyp.</p>';
    }
}


/**
 * Master-Renderer: Now async to support async sub-renderers.
 */
async function renderSubAssignment(subAssignmentData, assignmentId, subId) {
    document.getElementById('sub-title').textContent = subAssignmentData.title;
    document.getElementById('instructions').innerHTML = subAssignmentData.instructions;
    document.getElementById('action-container').style.display = 'block';

    const contentRenderer = document.getElementById('content-renderer');
    contentRenderer.innerHTML = '';

    switch (subAssignmentData.type) {
        case 'quill':
            // MODIFIED: Await the async quill renderer
            await renderQuill(subAssignmentData, assignmentId, subId);
            break;
        case 'multipleChoice':
            renderMultipleChoice(subAssignmentData, assignmentId, subId);
            break;
        default:
            contentRenderer.innerHTML = '<p>Error: Unknown assignment type.</p>';
    }
}

/**
 * MODIFIED: Rendert eine Quill-basierte Aufgabe and now manages file attachments.
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
    
    // --- NEW: File Attachment Section ---
    const attachmentContainer = document.createElement('div');
    attachmentContainer.id = 'attachment-container';
    attachmentContainer.style.marginTop = '20px';
    contentRenderer.appendChild(attachmentContainer);

    const attachmentHeader = document.createElement('h4');
    attachmentHeader.textContent = 'Anhänge';
    attachmentContainer.appendChild(attachmentHeader);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    attachmentContainer.appendChild(fileInput);

    const fileList = document.createElement('ul');
    fileList.id = 'file-list';
    fileList.style.listStyleType = 'none';
    fileList.style.paddingLeft = '0';
    attachmentContainer.appendChild(fileList);
    
    // Function to render the list of attached files
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
                    refreshFileList(); // Refresh list after deleting
                }
            };
            listItem.appendChild(deleteButton);
            fileList.appendChild(listItem);
        });
    };
    
    // Event listener for the file input
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            await addFile(assignmentId, subId, file);
            refreshFileList(); // Refresh list after adding
            fileInput.value = ''; // Reset input
        }
    });
    
    // Initial load of files
    await refreshFileList();
    // --- End of File Attachment Section ---

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link']] }
    });
    
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
        quill.setContents(JSON.parse(savedData));
    }

    quill.on('text-change', () => {
        localStorage.setItem(storageKey, JSON.stringify(quill.getContents()));
    });
}

// --- renderMultipleChoice remains unchanged ---
function renderMultipleChoice(data, assignmentId, subId) {
    // ... same as before ...
}


/**
 * MODIFIED: Now async. Gathers data from localStorage AND files from IndexedDB.
 */
async function gatherAllAssignmentsData() {
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
        attachments: {} // NEW: To store file data
    };

    // 1. Gather text and quiz data from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('textbox-assignment_') || key.startsWith('quiz-assignment_')) {
            studentData.assignments[key] = localStorage.getItem(key);
        }
    }

    // 2. Gather file data from IndexedDB
    const allFiles = await getAllFiles();
    for (const fileRecord of allFiles) {
        // Convert file blob to a Base64 string for JSON serialization
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

/**
 * Erstellt eine JSON-Datei mit den Schülerdaten und löst den Download aus.
 */
function submitAssignment(data) {
    if (!data) return;

    if (Object.keys(data.assignments).length === 0 && Object.keys(data.attachments).length === 0) {
        alert('Keine bearbeiteten Aufgaben oder Anhänge zum Abgeben gefunden.');
        return;
    }
    const filename = `submission-${data.studentName}-${new Date().toISOString().split('T')[0]}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('Deine Antworten und Anhänge wurden als JSON-Datei heruntergeladen.');
}