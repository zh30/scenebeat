# Implementation Plan: SceneBeat MVP

## Overview

Build SceneBeat in TypeScript as a static Vite + React app. Work proceeds bottom-up: scaffold, then the pure core in `src/core/` (splitting, template assignment, duration, build, serialize/parse, validate, filename), then the playback reducer and timer hook, then the React components and `App` wiring, then Kiro configuration (steering files, validation hook, CLI script) and repository files. Property tests use fast-check with at least 100 runs each, one file per property under `tests/properties/`, each tagged `Feature: scenebeat-mvp, Property N: <text>`.

## Tasks

- [x] 1. Scaffold the project
  - Create `package.json` with React 18, Vite, TypeScript, Vitest, fast-check, React Testing Library, jsdom, and tsx; scripts `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest --run`), `preview`
  - Create `tsconfig.json` with `strict: true`, `vite.config.ts` with the Vitest config (jsdom environment, `tests/**` include), `index.html`, and a placeholder `src/main.tsx`
  - Create `.gitignore` ignoring `node_modules`, `dist`, and `coverage`, with no rule that ignores `.kiro`
  - Create the `src/core/`, `src/playback/`, `src/components/`, `src/data/`, `src/styles/`, `scripts/`, `tests/`, and `tests/properties/` directories
  - _Requirements: 10.1, 10.2, 11.1, 11.7_

- [x] 2. Implement core types and sentence splitting
  - [x] 2.1 Define core types in `src/core/types.ts`
    - `SceneTemplate`, `TEMPLATES`, `SceneData`, `Scene`, `Storyboard`, `ValidationError`
    - _Requirements: 3.1, 7.1, 7.2_

  - [x] 2.2 Implement `splitSentences` in `src/core/splitSentences.ts`
    - Single left-to-right scan: line breaks end a segment; terminator runs plus trailing closers end a segment; a `.` between two ASCII digits is not a terminator; trailing text becomes the final segment; trim and drop empty segments
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 2.3 Write property test `tests/properties/p01-split-content.property.test.ts`
    - **Property 1: Splitting preserves content and order**
    - **Validates: Requirements 2.7, 2.8**

  - [x] 2.4 Write property test `tests/properties/p02-split-terminators.property.test.ts`
    - **Property 2: Splitting at terminators**
    - Generator covers terminator runs (`?!`, `……`), closers, and an unterminated final segment
    - **Validates: Requirements 2.1, 2.3, 2.6**

  - [x] 2.5 Write property test `tests/properties/p03-split-trimmed.property.test.ts`
    - **Property 3: Sentences are trimmed, non-empty, and line-free**
    - **Validates: Requirements 2.2, 2.4**

  - [x] 2.6 Write property test `tests/properties/p04-split-decimals.property.test.ts`
    - **Property 4: Decimal points do not split**
    - **Validates: Requirements 2.5**

  - [x] 2.7 Write property test `tests/properties/p05-split-whitespace.property.test.ts`
    - **Property 5: Whitespace-only input yields no sentences**
    - **Validates: Requirements 2.9**

- [x] 3. Implement template assignment
  - [x] 3.1 Implement `assignTemplate` in `src/core/assignTemplate.ts`
    - Rule chain in fixed order: quote, timeline, big-number, keyword-highlight, with the patterns from the design
    - Record `data.quote`, `data.label`, `data.value`, or `data.keywords` (1 to 3 items; `Intl.Segmenter` for CJK with a 2-character chunk fallback)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 3.2 Write property test `tests/properties/p06-template-precedence.property.test.ts`
    - **Property 6: Template assignment follows precedence**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x] 3.3 Write property test `tests/properties/p07-template-data.property.test.ts`
    - **Property 7: Highlighted data matches the template**
    - **Validates: Requirements 3.6, 3.7, 3.8, 3.9**

  - [x] 3.4 Write property test `tests/properties/p08-template-determinism.property.test.ts`
    - **Property 8: Template assignment is deterministic**
    - **Validates: Requirements 3.10**

  - [x] 3.5 Write unit tests `tests/assignTemplate.test.ts`
    - Examples for each template in English and Chinese, including `「…」`, `2025年`, `首先`, `45%`, `3倍`, and the keyword fallback when `Intl.Segmenter` is missing
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7_

- [x] 4. Implement duration and storyboard building
  - [x] 4.1 Implement `readingLength` and `computeDuration` in `src/core/duration.ts`
    - `1000 + 250 * englishWords + 200 * chineseChars`, clamped to [2000, 8000]
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Write property test `tests/properties/p09-duration-formula.property.test.ts`
    - **Property 9: Duration formula and clamp**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 4.3 Write property test `tests/properties/p10-duration-monotonic.property.test.ts`
    - **Property 10: Duration is monotonic in reading length**
    - **Validates: Requirements 4.3**

  - [x] 4.4 Implement `buildStoryboard` in `src/core/buildStoryboard.ts`
    - Combine `splitSentences`, `assignTemplate`, and `computeDuration`; set `version: "1.0"`, `createdAt`, and `sceneCount`
    - _Requirements: 3.1, 4.1, 7.1, 7.2_

- [x] 5. Implement serialization, validation, and export filename
  - [x] 5.1 Implement `serializeStoryboard` and `parseStoryboard` in `src/core/serialize.ts`
    - Fixed key order, two-space indentation; parse returns `{ ok, value }` or `{ ok: false, error }` and never throws
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.2 Implement `validateStoryboard` in `src/core/validate.ts`
    - Total function over `unknown`; path-based errors for missing or mistyped fields; checks for `sceneCount` mismatch, first out-of-sequence index, invalid template, out-of-range `durationMs`, and template-specific `data` keys
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.3 Implement `formatExportFilename` in `src/core/exportFilename.ts`
    - Local time, `scenebeat-storyboard-YYYYMMDD-HHmmss.json`
    - _Requirements: 9.2_

  - [x] 5.4 Write property test `tests/properties/p18-serialize-roundtrip.property.test.ts`
    - **Property 18: Serialization round trip**
    - **Validates: Requirements 7.4, 7.6**

  - [x] 5.5 Write property test `tests/properties/p19-serialize-structure.property.test.ts`
    - **Property 19: Serialized structure**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 5.6 Write property test `tests/properties/p20-parse-malformed.property.test.ts`
    - **Property 20: Malformed JSON is rejected with an error**
    - **Validates: Requirements 7.5**

  - [x] 5.7 Write property test `tests/properties/p21-validator-accepts.property.test.ts`
    - **Property 21: Validator accepts every generated storyboard**
    - **Validates: Requirements 8.1, 8.7**

  - [x] 5.8 Write property test `tests/properties/p22-validator-corruption.property.test.ts`
    - **Property 22: Validator detects each kind of corruption**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6**

  - [x] 5.9 Write property test `tests/properties/p23-validator-total.property.test.ts`
    - **Property 23: Validator is total**
    - **Validates: Requirements 8.1, 8.5**

  - [x] 5.10 Write property test `tests/properties/p24-export-filename.property.test.ts`
    - **Property 24: Export filename format**
    - **Validates: Requirements 9.2**

  - [x] 5.11 Write unit tests `tests/validate.test.ts`
    - One hand-written example per error message form (count mismatch, out-of-sequence index, invalid template, missing field path, bad duration)
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 6. Checkpoint - Ensure all core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement playback logic
  - [x] 7.1 Implement the playback reducer and position label
    - `src/playback/playbackReducer.ts`: state `{ index, playing, remainingMs, total, durations }` and actions `reset`, `play`, `pause`, `tick`, `next`, `prev`, `select` as specified in the design
    - `src/playback/positionLabel.ts`: `formatPosition(index, total)` returning `${index + 1} / ${total}`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.12, 5.13, 5.14, 6.3_

  - [x] 7.2 Write property test `tests/properties/p11-playback-bounds.property.test.ts`
    - **Property 11: Playback never leaves valid bounds**
    - **Validates: Requirements 5.5, 5.6, 5.7, 5.8, 5.12**

  - [x] 7.3 Write property test `tests/properties/p12-playback-pause-resume.property.test.ts`
    - **Property 12: Pause and resume preserve remaining time**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [x] 7.4 Write property test `tests/properties/p13-playback-end.property.test.ts`
    - **Property 13: Playback stops at the end**
    - **Validates: Requirements 5.2, 5.9**

  - [x] 7.5 Write property test `tests/properties/p14-playback-reset.property.test.ts`
    - **Property 14: Regeneration resets playback**
    - **Validates: Requirements 5.14**

  - [x] 7.6 Write property test `tests/properties/p15-position-label.property.test.ts`
    - **Property 15: Position label**
    - **Validates: Requirements 5.13**

  - [x] 7.7 Write property test `tests/properties/p16-playback-select.property.test.ts`
    - **Property 16: Selecting a list entry shows that scene**
    - **Validates: Requirements 6.3**

  - [x] 7.8 Implement the `usePlayback` hook in `src/playback/usePlayback.ts`
    - Wrap the reducer; one `setTimeout` per scene while playing; dispatch elapsed time on pause; clear the timer on cleanup; dispatch `reset` when the durations change
    - _Requirements: 5.2, 5.3, 5.4, 5.9, 5.14_

  - [x] 7.9 Write unit tests `tests/usePlayback.test.ts`
    - Fake timers: advance after the duration, pause mid-scene and resume for the remainder, stop on the last scene, reset on new durations
    - _Requirements: 5.2, 5.3, 5.4, 5.9, 5.14_

- [x] 8. Implement UI components and wire the app
  - [x] 8.1 Create the sample transcript in `src/data/sampleTranscript.ts`
    - Chinese and English text with at least one sentence for each of the four templates
    - _Requirements: 1.2, 1.3_

  - [x] 8.2 Write unit tests `tests/sampleTranscript.test.ts`
    - Built storyboard contains all four templates; text contains Chinese and English characters
    - _Requirements: 1.2_

  - [x] 8.3 Implement `SceneView` in `src/components/SceneView.tsx` and styles in `src/styles/app.css`
    - Four template layouts; keyed transitions of 450 ms using `transform` and `opacity`; a reduced-motion variant using opacity only at 150 ms
    - _Requirements: 5.1, 5.10, 5.11_

  - [x] 8.4 Implement `Player` in `src/components/Player.tsx`
    - Play, Pause, Previous, Next controls with disabled states; "current / total" label via `formatPosition`; empty-state message with all controls disabled; read `prefers-reduced-motion` via `matchMedia`, treating its absence as no preference
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 5.11, 5.12, 5.13_

  - [x] 8.5 Write unit tests `tests/Player.test.tsx`
    - Each template layout renders; control behavior and disabled states; empty state; transition duration in 300 to 600 ms and, with mocked reduced motion, opacity-only at 200 ms or less
    - _Requirements: 5.1, 5.5, 5.6, 5.7, 5.8, 5.10, 5.11, 5.12, 5.13_

  - [x] 8.6 Implement `StoryboardList` in `src/components/StoryboardList.tsx` and `countByTemplate` in `src/core/stats.ts`
    - One row per scene with position number, text, and template name; current row marked; click selects; total and per-template counts
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.7 Write property test `tests/properties/p17-scene-counts.property.test.ts`
    - **Property 17: Scene counts are consistent**
    - **Validates: Requirements 6.4**

  - [x] 8.8 Write unit tests `tests/StoryboardList.test.tsx`
    - Row content, current marking, click calls `onSelect`, totals display
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.9 Implement `TranscriptInput` in `src/components/TranscriptInput.tsx`
    - Multi-line textarea with "Load sample" and "Clear" buttons
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 8.10 Implement `ExportButton` in `src/components/ExportButton.tsx`
    - Serialize, validate, then download a Blob of type `application/json` named by `formatExportFilename`, or show the error list; disabled when there are zero scenes; no network calls
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.11 Write unit tests `tests/ExportButton.test.tsx`
    - Mock `URL.createObjectURL` and anchor click; check Blob type and filename; stubbed validator errors cancel the download and display; disabled at zero scenes; `fetch` and `XMLHttpRequest` never called
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.12 Implement `App` in `src/components/App.tsx` and finish `src/main.tsx`
    - Own `text` state initialized to the sample; debounce 300 ms into `buildStoryboard`; share `usePlayback` state between `Player` and `StoryboardList`; render `ExportButton`; wrap in a top-level error boundary with a "Reload" button; import `app.css`
    - _Requirements: 1.2, 1.5, 5.14, 6.2, 6.3, 10.1_

  - [x] 8.13 Write unit tests `tests/App.test.tsx`
    - Sample loaded at start; "Load sample" and "Clear" work; with fake timers the storyboard updates at 300 ms and not at 299 ms; regeneration resets the Player to the first scene
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.14_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add Kiro configuration and repository files
  - [x] 10.1 Write steering files `.kiro/steering/product.md`, `tech.md`, and `structure.md`
    - `inclusion: always` front matter; product scope, tech stack and npm scripts, directory layout and where new code goes
    - _Requirements: 11.2_

  - [x] 10.2 Implement the CLI script `scripts/validate-storyboard.ts` with fixtures
    - Read the file path from argv or from the hook's stdin JSON; parse with `parseStoryboard`; run `validateStoryboard`; print `path: message` lines; exit 1 on errors or malformed JSON, 0 otherwise
    - Add `tests/fixtures/valid.storyboard.json` and `tests/fixtures/invalid.storyboard.json`
    - _Requirements: 8.1, 11.4_

  - [x] 10.3 Create the validation hook `.kiro/hooks/validate-storyboard.json`
    - Trigger `PostFileSave`, matcher `(\.storyboard\.json|scenebeat-storyboard-[^/]*\.json)$`, command action running `npx tsx scripts/validate-storyboard.ts`
    - _Requirements: 11.3, 11.4_

  - [x] 10.4 Write `LICENSE` (MIT) and `README.md`
    - README covers the feature, prerequisites (Node 18+), `npm install`, `npm run dev`, `npm run build`, `npm test`, and the storyboard JSON format
    - _Requirements: 11.5, 11.6_

  - [x] 10.5 Write CLI tests `tests/validateCli.test.ts`
    - Run the script on the valid fixture (exit 0) and the invalid fixture (exit 1 with a JSON path in the output)
    - _Requirements: 11.4_

  - [x] 10.6 Write smoke tests `tests/repo.test.ts`
    - `tsconfig.json` has `strict: true`; steering files, hook, MIT `LICENSE`, and `README.md` sections exist; `.gitignore` ignores `node_modules` and `dist` but not `.kiro`; hook matcher matches `x.storyboard.json` and `scenebeat-storyboard-20260101-000000.json` but not `package.json`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 11. Final checkpoint - Run the production build and fix errors
  - Run `npm run build` and `npm test`; fix every TypeScript, bundler, and test failure until both complete with zero errors
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 10.1, 11.8_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each property test lives in its own file so property tasks can run in parallel.
- Property tests check universal properties from the design; unit tests cover examples, UI behavior, and edge cases.
- Visual quality of animations is checked manually in the browser and has no task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1", "5.2", "5.3"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "5.10", "5.11"] },
    { "id": 4, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "5.9"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7.1", "8.1", "8.3", "8.6", "8.9", "8.10"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "8.2", "8.4", "8.7", "8.8", "8.11"] },
    { "id": 8, "tasks": ["7.9", "8.5", "8.12"] },
    { "id": 9, "tasks": ["8.13"] },
    { "id": 10, "tasks": ["9"] },
    { "id": 11, "tasks": ["10.1", "10.2", "10.4"] },
    { "id": 12, "tasks": ["10.3", "10.5"] },
    { "id": 13, "tasks": ["10.6"] },
    { "id": 14, "tasks": ["11"] }
  ]
}
```
