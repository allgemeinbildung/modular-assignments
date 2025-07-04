# Modular Assignments Project

This project is a single-page application designed to dynamically render and manage educational assignments. [cite_start]It uses JSON files to define assignment content, which can include rich text tasks (using Quill.js) and multiple-choice quizzes[cite: 18, 63].

## Key Features

* [cite_start]**Dynamic Content:** A single `index.html` entry point renders different assignments based on URL parameters[cite: 63, 89].
* [cite_start]**Modular Architecture:** Each assignment and sub-assignment is defined in a separate `.json` file located in the `/assignments` folder[cite: 4, 174].
* [cite_start]**Rich Text and Quizzes:** Supports both open-ended questions with a rich text editor and self-correcting multiple-choice quizzes[cite: 18].
* [cite_start]**Client-Side Persistence:** Student progress is automatically saved to the browser's `localStorage` as they work[cite: 132].
* [cite_start]**Submission & Verification:** Includes a system for students to gather all their work into a single JSON file for submission and a `verifier.html` tool for teachers to validate it[cite: 15, 140].

## Project Structure

```
└── modular-assignments/
├── index.html              // Main entry point for all assignments [cite: 3]
├── assignments/            // Holds all assignment JSON configs [cite: 4]
│   ├── 3.3-strafrecht.json
│   └── 3.4-migration.json
├── js/
│   ├── app.js              // Core application logic 
│   └── dependencies/
├── css/
│   └── styles.css
├── viewer/                 // Student dashboard to see saved data [cite: 12]
└── verifier.html           // Tool for teachers to verify submissions [cite: 15]
```

## How to Use

### Creating an Assignment
1.  [cite_start]Create a new `.json` file inside the `/assignments` directory[cite: 174].
2.  Follow the documented JSON schema below to structure your questions.
3.  Link to the assignment using the URL format: `index.html?assignmentId=<your_file_name>&subId=<your_sub_assignment_id>`.

### Viewing a Solution
[cite_start]To see the solution for a sub-assignment, add the `&view=solution` parameter to the URL[cite: 148].

## Assignment JSON Schema

All `.json` files in the `/assignments` directory must follow this structure.

### Top-Level Object
The root of the JSON file contains two properties:

* [cite_start]`assignmentTitle` (string): The main title for the entire assignment group (e.g., "3.4 Migration, Integration und Rassismus")[cite: 23].
* `subAssignments` (object): A collection of all sub-assignments. [cite_start]Each key in this object is a unique `subId` used in the URL[cite: 24].

### Sub-Assignment Object
Each object within `subAssignments` defines a single task screen.

* `type` (string): **Required.** Determines how the content is rendered. [cite_start]Valid options are `"quill"` [cite: 26] [cite_start]and `"multipleChoice"`[cite: 45].
* [cite_start]`title` (string): The heading for this specific sub-assignment[cite: 27].
* [cite_start]`instructions` (string): An HTML string that provides instructions to the student[cite: 28].
* [cite_start]`questions` (array): An array containing the question objects for the task[cite: 29].
* [cite_start]`solution` (object): Contains the correct answer or model solution for the task[cite: 39].

#### Example: `quill` Question Object
For `type: "quill"`, each object in the `questions` array has:
* [cite_start]`id` (string): A unique identifier for the question[cite: 31].
* [cite_start]`text` (string): The question text, which can include HTML formatting[cite: 32].

#### Example: `multipleChoice` Question Object
For `type: "multipleChoice"`, each object in the `questions` array has:
* [cite_start]`id` (string): A unique identifier for the question[cite: 50].
* [cite_start]`question` (string): The question text, which can include HTML[cite: 51].
* `options` (array): An array of possible answers. Each option object contains:
    * [cite_start]`text` (string): The answer option text[cite: 53].
    * [cite_start]`is_correct` (boolean): `true` if this is the correct answer, otherwise `false`[cite: 53, 55].
    * [cite_start]`feedback` (string): The message shown to the student after they select this option[cite: 53].

#### Example: `solution` Object
* `type` (string): The format of the solution. [cite_start]Currently supports `"html"`[cite: 40].
* [cite_start]`content` (string): The HTML content of the solution to be displayed[cite: 41].