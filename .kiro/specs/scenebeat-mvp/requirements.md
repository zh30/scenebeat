# Requirements Document

## Introduction

SceneBeat is a small, client-side web app built for Kiroween 2026. A user pastes a podcast or video transcript, and SceneBeat splits the transcript into sentences, assigns each sentence one of four motion scene templates (big number, keyword highlight, quote, timeline), previews the resulting sequence in the browser at reading pace with animated transitions, and exports the sequence as a storyboard JSON file.

The MVP runs entirely in the browser. Accounts, a backend, audio processing, and MP4 rendering are out of scope. The project uses Vite, React, and TypeScript, and ships with Kiro steering files, a Kiro hook that validates storyboard JSON, an MIT license, and a README.

## Glossary

- **SceneBeat**: The client-side web application described by this document.
- **Transcript_Input**: The textarea UI component where the user enters or pastes transcript text.
- **Sample_Transcript**: A built-in transcript, bundled with SceneBeat, that contains at least one sentence matching each of the four Scene_Templates and both Chinese and English text.
- **Sentence_Splitter**: The SceneBeat module that converts transcript text into an ordered list of Sentences.
- **Sentence**: A non-empty, whitespace-trimmed segment of transcript text ending at a Sentence_Terminator or at the end of the transcript.
- **Sentence_Terminator**: One of the characters `.` `!` `?` (English) or `。` `！` `？` `；` `…` (Chinese), optionally followed by closing quotation marks or brackets (`"` `'` `”` `’` `」` `』` `)` `）`).
- **Scene_Template**: One of four motion scene layouts: `big-number`, `keyword-highlight`, `quote`, `timeline`.
- **Template_Assigner**: The SceneBeat module that selects a Scene_Template for each Sentence.
- **Scene**: A record pairing one Sentence with its assigned Scene_Template, its zero-based position index, and its Display_Duration.
- **Storyboard**: The ordered list of Scenes produced from one transcript, plus metadata (format version and creation timestamp).
- **Display_Duration**: The time in milliseconds a Scene is shown during playback, derived from the Sentence's reading length.
- **Player**: The SceneBeat UI component that renders Scenes in sequence with animated transitions and provides playback controls.
- **Storyboard_List**: The SceneBeat UI component that lists every Scene with its Sentence text and Scene_Template.
- **Storyboard_Serializer**: The SceneBeat module that converts a Storyboard to storyboard JSON text.
- **Storyboard_Parser**: The SceneBeat module that converts storyboard JSON text back to a Storyboard.
- **Storyboard_Validator**: The SceneBeat module that checks whether a JSON value conforms to the storyboard JSON structure.
- **Exporter**: The SceneBeat module that delivers storyboard JSON to the user as a downloadable file.
- **Validation_Hook**: The Kiro hook stored under `.kiro/hooks/` that runs the Storyboard_Validator against storyboard JSON files.
- **Project_Repository**: The SceneBeat source repository rooted at the workspace folder.

## Requirements

### Requirement 1: Transcript Input

**User Story:** As a content creator, I want to paste a transcript or load a sample, so that I can start building a storyboard immediately.

#### Acceptance Criteria

1. THE Transcript_Input SHALL accept multi-line text containing Chinese characters, English characters, digits, and punctuation.
2. WHEN SceneBeat first loads, THE Transcript_Input SHALL contain the Sample_Transcript.
3. WHEN the user activates the "Load sample" control, THE Transcript_Input SHALL replace the current content with the Sample_Transcript.
4. WHEN the user activates the "Clear" control, THE Transcript_Input SHALL become empty.
5. WHEN the content of the Transcript_Input changes, THE SceneBeat SHALL regenerate the Storyboard from the new content within 300 milliseconds of the last keystroke.

### Requirement 2: Sentence Splitting

**User Story:** As a content creator, I want the transcript split into sentences for both Chinese and English punctuation, so that each scene carries one idea.

#### Acceptance Criteria

1. WHEN transcript text is provided, THE Sentence_Splitter SHALL split the text into Sentences at each Sentence_Terminator, keeping the Sentence_Terminator and any trailing closing quotation marks or brackets attached to the preceding Sentence.
2. WHEN transcript text contains a line break, THE Sentence_Splitter SHALL treat the line break as a Sentence boundary.
3. WHEN transcript text ends without a Sentence_Terminator, THE Sentence_Splitter SHALL emit the trailing text as the final Sentence.
4. THE Sentence_Splitter SHALL trim leading and trailing whitespace from each Sentence and discard segments that are empty after trimming.
5. WHEN a period appears between two digits (for example `3.5`), THE Sentence_Splitter SHALL keep the period inside the current Sentence.
6. WHEN consecutive Sentence_Terminators appear (for example `?!` or `……`), THE Sentence_Splitter SHALL treat the run of terminators as a single boundary.
7. FOR ALL transcript texts, concatenating the produced Sentences with whitespace removed SHALL equal the transcript text with whitespace removed (content preservation property).
8. FOR ALL transcript texts, THE Sentence_Splitter SHALL produce Sentences in the same order the text appears in the transcript.
9. IF the transcript text is empty or contains only whitespace, THEN THE Sentence_Splitter SHALL return an empty list.

### Requirement 3: Scene Template Assignment

**User Story:** As a content creator, I want each sentence automatically matched to a fitting motion template, so that the preview looks varied without manual work.

#### Acceptance Criteria

1. THE Template_Assigner SHALL assign exactly one Scene_Template to each Sentence.
2. WHEN a Sentence contains a quotation delimited by `"…"`, `“…”`, `「…」`, or `『…』`, THE Template_Assigner SHALL assign the `quote` Scene_Template.
3. WHEN a Sentence does not qualify for `quote` and contains a four-digit year between 1000 and 2999, a date, or a sequence marker (English: "first", "then", "next", "finally", "after that"; Chinese: "首先", "然后", "接着", "最后", "之后", or a number followed by "年"), THE Template_Assigner SHALL assign the `timeline` Scene_Template.
4. WHEN a Sentence does not qualify for `quote` or `timeline` and contains a numeric value (Arabic digits, a percentage, a currency amount, or a Chinese numeral followed by a unit such as "万", "亿", "倍", "%"), THE Template_Assigner SHALL assign the `big-number` Scene_Template.
5. WHEN a Sentence does not qualify for `quote`, `timeline`, or `big-number`, THE Template_Assigner SHALL assign the `keyword-highlight` Scene_Template.
6. WHEN the Template_Assigner assigns `big-number`, THE Template_Assigner SHALL record the first matched numeric value as the Scene's highlighted value.
7. WHEN the Template_Assigner assigns `keyword-highlight`, THE Template_Assigner SHALL record between one and three keywords taken from the Sentence as the Scene's highlighted keywords.
8. WHEN the Template_Assigner assigns `quote`, THE Template_Assigner SHALL record the text inside the quotation delimiters as the Scene's quoted text.
9. WHEN the Template_Assigner assigns `timeline`, THE Template_Assigner SHALL record the matched year, date, or sequence marker as the Scene's timeline label.
10. FOR ALL Sentences, assigning a Scene_Template twice to the same Sentence SHALL produce the same Scene_Template and the same highlighted data (determinism property).

### Requirement 4: Display Duration

**User Story:** As a viewer, I want each scene to stay on screen long enough to read, so that the preview matches a natural reading pace.

#### Acceptance Criteria

1. THE SceneBeat SHALL compute the Display_Duration of each Scene as 1000 milliseconds plus 250 milliseconds per English word plus 200 milliseconds per Chinese character in the Sentence.
2. THE SceneBeat SHALL clamp each Display_Duration to the range of 2000 to 8000 milliseconds inclusive.
3. FOR ALL pairs of Sentences where one Sentence's reading length is greater than or equal to the other's, THE SceneBeat SHALL assign the longer Sentence a Display_Duration greater than or equal to the shorter Sentence's Display_Duration (monotonicity property).

### Requirement 5: Playback Preview

**User Story:** As a content creator, I want to preview the storyboard as an animated sequence with playback controls, so that I can judge pacing before exporting.

#### Acceptance Criteria

1. THE Player SHALL render the current Scene using the visual layout of the Scene's Scene_Template.
2. WHEN the user activates the Play control, THE Player SHALL advance to the next Scene after the current Scene's Display_Duration elapses.
3. WHEN the user activates the Pause control, THE Player SHALL stop advancing and keep the current Scene displayed.
4. WHEN the user resumes playback after a pause, THE Player SHALL continue the current Scene for the remaining portion of the Scene's Display_Duration.
5. WHEN the user activates the Next control, THE Player SHALL display the Scene at the next position index.
6. WHEN the user activates the Previous control, THE Player SHALL display the Scene at the preceding position index.
7. WHILE the Player displays the first Scene, THE Player SHALL disable the Previous control.
8. WHILE the Player displays the last Scene, THE Player SHALL disable the Next control.
9. WHEN playback reaches the end of the last Scene's Display_Duration, THE Player SHALL stop playback and keep the last Scene displayed.
10. WHEN the Player changes from one Scene to another, THE Player SHALL animate the transition with a duration between 300 and 600 milliseconds.
11. WHERE the user's operating system reports a reduced-motion preference, THE Player SHALL replace motion transitions with an opacity fade of 200 milliseconds or less.
12. WHILE the Storyboard contains zero Scenes, THE Player SHALL display an empty-state message and disable the Play, Pause, Previous, and Next controls.
13. THE Player SHALL display the current position as "current / total" Scenes.
14. WHEN the Storyboard is regenerated, THE Player SHALL stop playback and display the first Scene.

### Requirement 6: Storyboard List

**User Story:** As a content creator, I want to see every sentence with its assigned template, so that I can review the whole storyboard at a glance.

#### Acceptance Criteria

1. THE Storyboard_List SHALL display one entry per Scene in position order, showing the position number, the Sentence text, and the Scene_Template name.
2. WHILE the Player displays a Scene, THE Storyboard_List SHALL visually mark the entry for that Scene as current.
3. WHEN the user selects an entry in the Storyboard_List, THE Player SHALL display the Scene for that entry.
4. THE Storyboard_List SHALL display the total number of Scenes and the count of Scenes per Scene_Template.

### Requirement 7: Storyboard JSON Serialization and Parsing

**User Story:** As a developer, I want a well-defined storyboard JSON format, so that exported files can be consumed by other tools and validated reliably.

#### Acceptance Criteria

1. THE Storyboard_Serializer SHALL produce JSON text containing a `version` string, a `createdAt` ISO 8601 timestamp string, a `sceneCount` integer, and a `scenes` array.
2. THE Storyboard_Serializer SHALL represent each Scene as an object with an integer `index`, a non-empty string `text`, a `template` string equal to one Scene_Template identifier, an integer `durationMs`, and a `data` object holding the template-specific highlighted data.
3. THE Storyboard_Serializer SHALL format the JSON text with two-space indentation.
4. WHEN valid storyboard JSON text is provided, THE Storyboard_Parser SHALL produce the equivalent Storyboard.
5. IF storyboard JSON text is malformed JSON, THEN THE Storyboard_Parser SHALL return an error describing the parse failure.
6. FOR ALL valid Storyboards, serializing then parsing then serializing SHALL produce JSON text identical to the first serialization (round-trip property).

### Requirement 8: Storyboard Validation

**User Story:** As a developer, I want storyboard JSON checked against its structure, so that broken files are caught before export.

#### Acceptance Criteria

1. WHEN a JSON value is provided, THE Storyboard_Validator SHALL report the value as valid if the value satisfies every structural rule in Requirement 7 criteria 1 and 2.
2. IF `sceneCount` differs from the length of `scenes`, THEN THE Storyboard_Validator SHALL report an error naming the mismatch.
3. IF the `index` values of `scenes` are not the sequence 0, 1, 2, … in array order, THEN THE Storyboard_Validator SHALL report an error naming the first out-of-sequence index.
4. IF a Scene's `template` value is not one of the four Scene_Template identifiers, THEN THE Storyboard_Validator SHALL report an error naming the Scene index and the invalid value.
5. IF a required field is missing or has the wrong type, THEN THE Storyboard_Validator SHALL report an error naming the JSON path of the field.
6. IF a Scene's `durationMs` is outside the range 2000 to 8000, THEN THE Storyboard_Validator SHALL report an error naming the Scene index.
7. FOR ALL Storyboards produced by SceneBeat from any transcript, THE Storyboard_Validator SHALL report the serialized Storyboard as valid.

### Requirement 9: Storyboard Export

**User Story:** As a content creator, I want to download the storyboard as a JSON file, so that I can use it in my editing workflow.

#### Acceptance Criteria

1. WHEN the user activates the Export control, THE Exporter SHALL validate the serialized Storyboard with the Storyboard_Validator before creating the file.
2. WHEN validation succeeds, THE Exporter SHALL trigger a browser download of a file named `scenebeat-storyboard-<YYYYMMDD-HHmmss>.json` with MIME type `application/json`.
3. IF validation fails, THEN THE Exporter SHALL cancel the download and display the validation errors to the user.
4. WHILE the Storyboard contains zero Scenes, THE SceneBeat SHALL disable the Export control.
5. THE Exporter SHALL generate the file entirely in the browser without network requests.

### Requirement 10: Scope Boundaries

**User Story:** As the project owner, I want the MVP kept small, so that it ships in time for Kiroween 2026.

#### Acceptance Criteria

1. THE SceneBeat SHALL run as a static client-side application served from the Vite build output.
2. THE SceneBeat SHALL operate without user accounts, a backend service, audio processing, or video rendering.

### Requirement 11: Project Setup and Kiro Configuration

**User Story:** As a developer, I want the repository set up with standard tooling and Kiro configuration, so that I can build, run, and extend SceneBeat with Kiro.

#### Acceptance Criteria

1. THE Project_Repository SHALL use Vite, React, and TypeScript with TypeScript strict mode enabled.
2. THE Project_Repository SHALL contain the steering files `.kiro/steering/product.md`, `.kiro/steering/tech.md`, and `.kiro/steering/structure.md` describing the product, technology stack, and directory structure.
3. THE Project_Repository SHALL contain one Validation_Hook under `.kiro/hooks/`.
4. WHEN a file whose name ends in `.storyboard.json` or matches `scenebeat-storyboard-*.json` is saved in the workspace, THE Validation_Hook SHALL run the Storyboard_Validator against the file and report any validation errors.
5. THE Project_Repository SHALL contain an MIT `LICENSE` file at the repository root.
6. THE Project_Repository SHALL contain a `README.md` describing the feature, prerequisites, install command, development server command, build command, and test command.
7. THE Project_Repository SHALL contain a `.gitignore` file that ignores `node_modules` and build output and leaves the `.kiro` directory tracked.
8. WHEN the production build command runs, THE Project_Repository SHALL complete the build with zero TypeScript or bundler errors.
