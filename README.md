# Modular Assignments Project

[cite\_start]This project is a single-page application designed to dynamically render and manage educational assignments. [cite: 17, 63] [cite\_start]It uses JSON files to define assignment content, which can include rich text tasks (using Quill.js) and complex, multi-type quizzes[cite: 18, 63].

## Key Features

  * [cite\_start]**Dynamic Content**: A single `index.html` entry point renders different assignments based on URL parameters[cite: 63, 89].
  * [cite\_start]**Modular Architecture**: Each assignment and sub-assignment is defined in a separate `.json` file located in the `/assignments` folder[cite: 4, 174].
  * **Versatile Question Types**: [cite\_start]Supports open-ended questions with a rich text editor (`quill`) and interactive quizzes (`quiz`) that can contain a mix of multiple-choice, true/false, and drag-and-drop questions[cite: 18, 63].
  * [cite\_start]**Client-Side Persistence**: Student progress is automatically saved to the browser's `localStorage` as they work[cite: 132].
  * [cite\_start]**Submission & Verification**: Includes a system for students to gather all their work into a single JSON file for submission and a `verifier.html` tool for teachers to validate it[cite: 15, 140].
  * **Backup & Restore**: The student dashboard in the `/viewer` directory allows users to create a full backup of their work (including attachments) and restore it later.

## Project Structure

```
└── modular-assignments/
[cite_start]├── index.html              // Main entry point for all assignments [cite: 3]
[cite_start]├── assignments/            // Holds all assignment JSON configs [cite: 4]
│   ├── 3.3-strafrecht.json
│   └── 3.4-migration.json
├── js/
│   ├── app.js              // Core application logic 
│   ├── renderer.js         // Handles rendering all assignment types
│   ├── submission.js       // Handles gathering and submitting data
│   └── db.js               // Handles IndexedDB for file attachments
├── css/
│   └── styles.css
[cite_start]├── viewer/                 // Student dashboard to see saved data [cite: 12]
[cite_start]└── verifier.html           // Tool for teachers to verify submissions [cite: 15]
```

## How to Use

### Creating an Assignment

1.  [cite\_start]Create a new `.json` file inside the `/assignments` directory[cite: 174].
2.  Follow the documented JSON schema below to structure your assignment.
3.  Link to the assignment using the URL format: `index.html?assignmentId=<your_file_name>&subId=<your_sub_assignment_id>`.

### Viewing a Solution

[cite\_start]To see the solution for a sub-assignment, add the `&view=solution` parameter to the URL[cite: 148].

## Assignment JSON Schema

All `.json` files in the `/assignments` directory must follow this structure.

### Top-Level Object

The root of the JSON file contains two properties:

  * [cite\_start]`assignmentTitle` (string): The main title for the entire assignment group (e.g., "3.4 Migration, Integration und Rassismus")[cite: 23].
  * `subAssignments` (object): [cite\_start]A collection of all sub-assignments. Each key in this object is a unique `subId` used in the URL[cite: 24].

### Sub-Assignment Object

Each object within `subAssignments` defines a single task screen.

  * `type` (string): **Required.** Determines how the content is rendered. Valid options are `"quill"` and `"quiz"`.
  * [cite\_start]`title` (string): The heading for this specific sub-assignment[cite: 27].
  * [cite\_start]`instructions` (string): An HTML string that provides instructions to the student[cite: 28].
  * [cite\_start]`questions` (array): An array containing the question objects for the task[cite: 29]. The structure of these objects depends on the parent `type`.
  * `solution` (object): [cite\_start]Contains the correct answer for a `quill` task. For `quiz` tasks, this is not needed as solutions are generated from the question data itself[cite: 39].

-----

### Question Object Structures

#### For `type: "quill"`

Each object in the `questions` array contains:

  * [cite\_start]`id` (string): A unique identifier for the question[cite: 31].
  * [cite\_start]`text` (string): The question text, which can include HTML formatting[cite: 32].

#### For `type: "quiz"`

For a quiz, the `questions` array can contain a mix of the following question objects. Each object must have its own `type` property.

##### `multipleChoice` Question

  * [cite\_start]`id` (string): A unique identifier for the question[cite: 50].
  * [cite\_start]`question` (string): The question text, which can include HTML[cite: 51].
  * `options` (array): An array of possible answers. Each option object contains:
      * [cite\_start]`text` (string): The answer option text[cite: 53].
      * [cite\_start]`is_correct` (boolean): `true` if this is the correct answer, otherwise `false`[cite: 53, 55].
      * [cite\_start]`feedback` (string): The message shown to the student after they select this option[cite: 53].

##### `trueFalse` Question (Example from `3.3-strafrecht.json`)

  * `id` (string): A unique identifier for the question.
  * `question` (string): The statement to be evaluated.
  * `is_correct` (boolean): `true` if the statement is true, `false` otherwise.
  * `feedback_true` (string): The feedback to show if the user answers "True".
  * `feedback_false` (string): The feedback to show if the user answers "False".

##### `dragTheWords` Question (Example from `3.3-strafrecht.json`)

  * `id` (string): A unique identifier for the question.
  * `question` (string): An introductory text for the exercise.
  * `content` (string): The sentence or paragraph containing one or more `[BLANK]` placeholders.
  * `words` (array of strings): A list of all the words available to be dragged.
  * `solution` (array of strings): A list of the correct words in the order they should appear in the blanks.
