# Modular Assignments Project

## 1. Project Purpose and Architecture

This project provides a simple, scalable, and modular framework for creating and delivering digital assignments to students. The core idea is to decouple the assignment content from the application logic, allowing teachers or content creators to build new assignments simply by creating a JSON file.

The architecture consists of:
-   [cite_start]**`index.html`**: The single entry point for all student-facing assignments[cite: 3].
-   [cite_start]**`assignments/`**: A directory containing all assignment definitions as individual `.json` files[cite: 4].
-   [cite_start]**`js/app.js`**: The main JavaScript application that reads URL parameters, fetches the correct assignment JSON, and dynamically renders the assignment (either a text editor or a quiz)[cite: 8].
-   [cite_start]**`viewer/`**: A student dashboard that shows all their in-progress assignments by scanning `localStorage`[cite: 12].
-   [cite_start]**`verifier.html`**: A tool for teachers to open and verify a student's final `submission.json` file[cite: 15].

Student progress is automatically saved to the browser's `localStorage`, ensuring that work is not lost between sessions.

## 2. The Master JSON Schema

Every assignment is defined by a `.json` file in the `/assignments` directory. The structure of this JSON is critical and must be flexible enough to handle different types of tasks.

### Top-Level Structure

```json
{
  "assignmentTitle": "The main title for the entire assignment file",
  "subAssignments": {
    "unique-sub-assignment-id": { ... },
    "another-unique-id": { ... }
  }
}
```

-   **`assignmentTitle`** (String): The overall title for this set of tasks. It appears at the very top of the page.
-   **`subAssignments`** (Object): A collection of individual tasks. The **key** (e.g., `unique-sub-assignment-id`) is a unique string that will be used in the URL to identify this specific task.

### Sub-Assignment Schema

Each object within `subAssignments` must have the following properties:

-   **`type`** (String): Determines how the task is rendered. Supported values are:
    -   `"quill"`: For free-form text answers using the Quill rich text editor.
    -   `"multipleChoice"`: For standard multiple-choice quizzes.
-   **`title`** (String): The title for this specific sub-assignment.
-   **`instructions`** (String): Instructions for the student. Can contain simple HTML like `<p>`, `<strong>`, `<em>`.
-   **`questions`** (Array): A list of questions for the task. The structure of objects inside this array depends on the `type`.
-   **`solution`** (Object): The correct answer or model solution for the task.

---

#### Type: `quill`

For text-based assignments.

**Schema:**
```json
"Migrationsgruende-Push-Pull-Faktoren": {
  "type": "quill",
  "title": "Migrationsgründe: Push- und Pull-Faktoren",
  "instructions": "<p>Beantworte die folgenden Fragen...</p>",
  "questions": [
    {
      "id": "q1",
      "text": "Was ist der *Unterschied* zwischen **Push- und Pull-Faktoren**?"
    }
  ],
  "solution": {
    "type": "html",
    "content": "<h4>Lösung...</h4><p>Push-Faktoren sind...</p>"
  }
}
```
-   **`questions` objects:**
    -   `id` (String): A unique identifier for the question.
    -   `text` (String): The question text. Can contain HTML.
-   **`solution` object:**
    -   `type`: Should be `"html"`.
    -   `content`: An HTML string containing the model solution.

---

#### Type: `multipleChoice`

For quizzes.

**Schema:**
```json
"Grundlagen_Quiz": {
  "type": "multipleChoice",
  "title": "Grundlagen Quiz",
  "instructions": "<p>Überprüfe dein Wissen mit diesem Quiz.</p>",
  "questions": [
    {
      "id": "mq1",
      "question": "<p>Welches der folgenden ist ein typischer Push-Faktor?</p>",
      "options": [
        { "text": "Hohe Löhne", "is_correct": false, "feedback": "Falsch, das ist ein Pull-Faktor." },
        { "text": "Politische Stabilität", "is_correct": false, "feedback": "Falsch, das ist ein Pull-Faktor." },
        { "text": "Krieg", "is_correct": true, "feedback": "Richtig, Krieg drückt Menschen aus ihrer Heimat." }
      ]
    }
  ],
  "solution": {} // Can be empty for quizzes as the solution is embedded
}
```
-   **`questions` objects:**
    -   `id` (String): A unique identifier for the question.
    -   `question` (String): The question text.
    -   `options` (Array): A list of possible answers.
        -   `text` (String): The answer option text.
        -   `is_correct` (Boolean): `true` if this is the correct answer, otherwise `false`.
        -   `feedback` (String): The message shown to the student after they select this option.

## 3. How to Create a New Assignment

Creating a new assignment is straightforward:

1.  **Create a new `.json` file** inside the `/assignments` directory (e.g., `4.1-globalisierung.json`).
2.  **Follow the Schema**: Structure the content of your new file according to the Master JSON Schema detailed above. You can mix `quill` and `multipleChoice` sub-assignments within the same file.
3.  **Link to the Assignment**: To access a specific task, construct a URL like this:
    `.../index.html?assignmentId=<filename_without_json>&subId=<unique_sub-assignment_id>`

    For example, to access the "Grundlagen_Quiz" from the `3.4-migration.json` file, the URL would be:
    `index.html?assignmentId=3.4-migration&subId=Grundlagen_Quiz`

The application will handle the rest automatically.