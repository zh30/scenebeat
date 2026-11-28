# Implementation Plan: SceneBeat Edit and Export

## Overview

The plan builds the feature bottom-up in TypeScript, following `design.md`. Pure core modules come first (types and version 1.1, serializer and validator, forced-template data, overrides, edited storyboard, aspect ratios, frame plan, transition, MIME selection, render status, subtitles, filenames, layout). Playback `retime` comes next, then the browser video modules with injected APIs, then the UI components, then the `App` wiring, then CLI fixtures and docs. Every property test lives in its own file `tests/properties/pNN-<name>.property.test.ts` (P25 to P51), uses `{ numRuns: 100 }` or more, and starts with `// Feature: scenebeat-edit-export, Property N: <text>` plus `**Validates: Requirements X.Y**`. Use pnpm for every command.

## Tasks

- [x] 1. Extend core types and test infrastructure
  - [x] 1.1 Add the override and template-source types to `src/core/types.ts`
    - Add `TemplateSource`, optional `Scene.templateSource`, `SceneOverride`, and `SceneOverrides` exactly as in the design's "Core: types" section
    - Keep every existing export unchanged so the MVP code and tests p01 to p24 still compile
    - _Requirements: 1.3, 2.2, 5.2, 6.2_
  - [x] 1.2 Add the jsdom test setup and shared property arbitraries
    - Create `tests/setup.ts` that stubs `HTMLCanvasElement.prototype.getContext` to return `null`; add `test.setupFiles: ['tests/setup.ts']` to `vite.config.ts`
    - Create `tests/properties/arbitraries.ts` with: a transcript arbitrary (copied from p19/p21, not imported); an edited-text arbitrary with Sentence_Terminators, line breaks, CJK, emoji, and `& < >`; a Display_Duration list arbitrary; and the measure-function family `(cp, font) => factor(cp) * font.sizePx` with factors in [0.3, 1.2]
    - _Requirements: 4.8, 6.7, 13.13_

- [x] 2. Support storyboard JSON version 1.1 in the serializer and validator
  - [x] 2.1 Write `templateSource` for version 1.1 in `src/core/serialize.ts`
    - Insert `templateSource` directly after `template` only when `version === '1.1'` and the scene has that own property; leave the 1.0 path byte-identical to the MVP
    - Leave `parseStoryboard` behavior unchanged (it already preserves all keys)
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 2.2 Add version and `templateSource` rules to `src/core/validate.ts`
    - Error at `$.version` for any string other than `"1.0"` and `"1.1"` (message names the value) and skip scene-level `templateSource` checks in that case
    - Version 1.1: missing or invalid `templateSource` gives an error at `$.scenes[i].templateSource`; version 1.0: a present `templateSource` gives the "requires version 1.1" error
    - Run no `templateSource` checks when `version` is missing or not a string, so existing single-error expectations hold
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_
  - [x]* 2.3 Add validator examples to `tests/validate.test.ts`
    - One example per new message form; keep all existing cases unchanged
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 3. Implement forced-template data derivation
  - [x] 3.1 Create `src/core/deriveData.ts` with `deriveData` and `leadingLabel`
    - Reuse `matchQuote`, `matchTimeline`, `matchBigNumber`, and `extractKeywords` from `assignTemplate.ts` on `text.trim()`, with the fallbacks in the design's "Data derivation" table
    - `leadingLabel`: first non-whitespace run, strip edge `[\p{P}\p{S}]`, fall back to the trimmed text when empty, keep the first 12 code points
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x]* 3.2 Write property test P25 in `tests/properties/p25-derive-data-model.property.test.ts`
    - **Property 25: Data derivation follows matcher-or-fallback rules**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10**
  - [x]* 3.3 Write property test P26 in `tests/properties/p26-derive-data-total.property.test.ts`
    - **Property 26: Data derivation is total**
    - **Validates: Requirements 4.8**
  - [x]* 3.4 Write property test P27 in `tests/properties/p27-derive-data-agrees.property.test.ts`
    - **Property 27: Data derivation agrees with automatic assignment**
    - **Validates: Requirements 4.9**
  - [x]* 3.5 Write unit tests in `tests/deriveData.test.ts`
    - One example per row of the derivation table; `leadingLabel` with punctuation-only tokens and tokens longer than 12 code points
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 4. Implement overrides and the edited storyboard
  - [x] 4.1 Create `src/core/overrides.ts`
    - `overrideKey`, `occurrenceRanks`, `normalizeEditedText`, `EMPTY_TEXT_MESSAGE`, `applyOverride`, `applyOverrides`, `reconcileOverrides`, `setManualTemplate`, `setEditedText`, `resetSceneOverride`, `hasOverride`, per the design's signatures and "Edited scene" table
    - Keep the override invariants (at least one field present, normalized non-empty `editedText` different from `sourceText`); never mutate inputs; never re-split edited text
    - _Requirements: 1.3, 1.4, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9, 3.3, 3.4, 6.2, 6.3, 6.4, 6.5, 6.7_
  - [x] 4.2 Create `src/core/editedStoryboard.ts`
    - `EDITED_STORYBOARD_VERSION = '1.1'` and `buildEditedStoryboard(auto, overrides)`: applies overrides, keeps `createdAt`, sets `sceneCount`, and puts `templateSource` on every scene
    - _Requirements: 5.1, 6.5_
  - [x] 4.3 Add an override-set arbitrary to `tests/properties/arbitraries.ts`
    - Build keys from a transcript's `(text, rank)` pairs plus unrelated pairs, with edited texts from the edited-text arbitrary and manual templates that may equal the automatic template
    - _Requirements: 6.3, 6.4, 6.8_
  - [x]* 4.4 Write property test P28 in `tests/properties/p28-overrides-identity.property.test.ts`
    - **Property 28: Empty overrides are the identity**
    - **Validates: Requirements 3.5**
  - [x]* 4.5 Write property test P29 in `tests/properties/p29-overrides-merge-model.property.test.ts`
    - Write the reference model inline from the requirement text, not by calling the code under test
    - **Property 29: Override merge matches the reference model**
    - **Validates: Requirements 1.4, 2.3, 2.4, 2.5, 2.6, 6.2, 6.3, 6.5, 6.7, 6.8**
  - [x]* 4.6 Write property test P30 in `tests/properties/p30-overrides-reconcile.property.test.ts`
    - **Property 30: Reconciliation discards unmatched overrides and is idempotent**
    - **Validates: Requirements 6.4, 6.9**
  - [x]* 4.7 Write property test P31 in `tests/properties/p31-overrides-metamorphic.property.test.ts`
    - **Property 31: Overrides survive a one-sentence change**
    - **Validates: Requirements 6.10**
  - [x]* 4.8 Write property test P32 in `tests/properties/p32-edit-operations.property.test.ts`
    - **Property 32: Edit operations record edits as specified**
    - **Validates: Requirements 1.3, 2.2, 2.7, 2.9**
  - [x]* 4.9 Write property test P33 in `tests/properties/p33-reset-scene.property.test.ts`
    - **Property 33: Reset restores the automatic scene and nothing else**
    - **Validates: Requirements 3.3, 3.4**
  - [x]* 4.10 Write property test P34 in `tests/properties/p34-edited-storyboard-valid.property.test.ts`
    - **Property 34: Edited storyboards are valid version 1.1 storyboards**
    - **Validates: Requirements 5.1, 5.2, 5.6, 5.11**
  - [x]* 4.11 Write property test P35 in `tests/properties/p35-roundtrip-versions.property.test.ts`
    - **Property 35: Round trip for versions 1.0 and 1.1**
    - **Validates: Requirements 5.3, 5.4, 5.10**
  - [x]* 4.12 Write property test P36 in `tests/properties/p36-validator-version.property.test.ts`
    - **Property 36: Version and templateSource errors are reported at their paths**
    - **Validates: Requirements 5.7, 5.8, 5.9**
  - [x]* 4.13 Write unit tests in `tests/overrides.test.ts`
    - Duplicate sentences get ranks 0, 1, 2; an edit on the second duplicate stays on it after a sentence is inserted before the first; an edit equal to the Source_Text removes `editedText`
    - _Requirements: 2.9, 6.2, 6.3_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement aspect ratios, the frame plan, and the enter transition
  - [x] 6.1 Create `src/core/aspectRatio.ts`
    - `AspectRatioId`, `AspectRatioSpec`, `ASPECT_RATIOS` (order, labels, hints, tags, and pixel sizes from the design table), `DEFAULT_ASPECT_RATIO = '16:9'`, `getAspectRatio`
    - _Requirements: 8.1, 8.2, 8.3_
  - [x]* 6.2 Write property test P38 in `tests/properties/p38-aspect-ratio.property.test.ts`
    - **Property 38: Aspect ratio dimensions**
    - **Validates: Requirements 8.3, 8.4**
  - [x] 6.3 Create `src/core/framePlan.ts`
    - `FPS = 30`, `frameCount`, `planFrames` (integer test `starts[i] * 30 <= k * 1000 < (starts[i] + d_i) * 30`, forward-only pointer), `totalDuration`, `videoLengthSeconds`, `RenderProgress`, `renderProgress`
    - _Requirements: 9.4, 13.6, 13.7, 13.8, 13.9, 15.1_
  - [x]* 6.4 Write property test P39 in `tests/properties/p39-video-length.property.test.ts`
    - **Property 39: Video length label**
    - **Validates: Requirements 9.4**
  - [x]* 6.5 Write property test P45 in `tests/properties/p45-frame-plan-model.property.test.ts`
    - Compute cue intervals with an inline reference model (prefix sums), not with `planFrames`
    - **Property 45: Frame plan matches cue intervals**
    - **Validates: Requirements 13.6, 13.7, 13.8**
  - [x]* 6.6 Write property test P46 in `tests/properties/p46-frame-plan-coverage.property.test.ts`
    - Generate durations from 1 ms upward to exercise the 34 ms bound
    - **Property 46: Frame plan is ordered and covers every scene**
    - **Validates: Requirements 13.9**
  - [x]* 6.7 Write property test P51 in `tests/properties/p51-render-progress.property.test.ts`
    - **Property 51: Render progress**
    - **Validates: Requirements 15.1**
  - [x] 6.8 Create `src/core/transition.ts`
    - `ENTER_TRANSITION_MS = 450`, `ENTER_OFFSET_PX = 48`, `cubicBezier` (Newton iteration with bisection fallback), `enterTransition` returning exactly `{ opacity: 1, translateY: 0, scale: 1 }` from 450 ms on
    - _Requirements: 13.4, 13.5_
  - [x]* 6.9 Write property test P47 in `tests/properties/p47-enter-transition.property.test.ts`
    - **Property 47: Enter transition plays at each scene start and ends inside the scene**
    - **Validates: Requirements 13.4, 13.5**

- [x] 7. Implement MIME selection and render status
  - [x] 7.1 Create `src/core/mimeType.ts`
    - `VideoContainer`, `MIME_CANDIDATES` in the design's order (video-only `avc1` MP4 types, then WebM), `pickMimeType` that treats a throwing predicate as false
    - _Requirements: 14.1, 14.2_
  - [x] 7.2 Create `src/core/renderStatus.ts`
    - `RenderNotice`, `RenderStatus`, `RenderStatusAction`, `renderStatusReducer` per the design's render-status state diagram; `start` clears any previous notice
    - _Requirements: 14.6, 15.1, 15.5, 15.6, 15.7_
  - [x]* 7.3 Write unit tests in `tests/renderStatus.test.ts`
    - Each transition of the render-status diagram, including the webm, hidden, and failed notices and notice clearing on `start`
    - _Requirements: 14.6, 15.5, 15.6, 15.7_

- [x] 8. Implement subtitles and export filenames
  - [x] 8.1 Create `src/core/subtitles.ts`
    - `buildCues`, `formatTimestamp`, `parseTimestamp`, `escapeVtt`, `unescapeVtt` (`&lt;`/`&gt;` first, `&amp;` last), `formatSrt`, `formatVtt`, `parseSubtitles` (never throws), and the `singleLine` helper, as in the design's "Subtitles" algorithm
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_
  - [x]* 8.2 Write property test P40 in `tests/properties/p40-subtitle-cues.property.test.ts`
    - **Property 40: Subtitle cues follow scene timing**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
  - [x]* 8.3 Write property test P41 in `tests/properties/p41-timestamp-roundtrip.property.test.ts`
    - **Property 41: Timestamp round trip**
    - **Validates: Requirements 11.1, 11.2**
  - [x]* 8.4 Write property test P42 in `tests/properties/p42-timestamp-order.property.test.ts`
    - **Property 42: Timestamps sort like their values**
    - **Validates: Requirements 11.3**
  - [x]* 8.5 Write property test P43 in `tests/properties/p43-subtitle-roundtrip.property.test.ts`
    - Scene texts include `&`, `<`, `>`, `-->`, existing entities such as `&lt;`, CJK, and emoji
    - **Property 43: SRT and WebVTT round trip**
    - **Validates: Requirements 11.6, 11.7, 11.9, 11.10**
  - [x]* 8.6 Write unit tests in `tests/subtitles.test.ts`
    - The exact SRT and WebVTT texts from the design's "Subtitle cue" section; empty-list outputs; escaping examples; a `Blob` built from the output has no `EF BB BF` prefix and decodes back with `TextDecoder`
    - _Requirements: 11.4, 11.5, 11.6, 11.8, 12.3_
  - [x] 8.7 Add `formatTimestampTag`, `formatSubtitleFilename`, and `formatVideoFilename` to `src/core/exportFilename.ts`
    - Rebuild `formatExportFilename` on `formatTimestampTag` without changing its output, so p24 still passes
    - _Requirements: 12.1, 12.2, 14.3_
  - [x]* 8.8 Write property test P44 in `tests/properties/p44-export-filenames.property.test.ts`
    - **Property 44: Subtitle and video file names**
    - **Validates: Requirements 12.4, 14.4**

- [x] 9. Implement the shared scene theme and text layout
  - [x] 9.1 Create `src/core/sceneTheme.ts` and `src/core/highlight.ts`
    - `sceneTheme.ts`: colors, font family (the `--sb-font` stack), per-template block typography, block gap, as in the design's typography table
    - `highlight.ts`: `highlightRanges(text, keywords)` as used by the MVP keyword marking
    - _Requirements: 13.2_
  - [x] 9.2 Create `src/core/sceneLayout.ts`
    - `FontSpec`, `MeasureText`, layout types, `safeArea` (6% insets), `FIT_SCALES` computed as `k / 10`, greedy `wrapText` (CJK code points as tokens, words plus trailing spaces, over-wide tokens split by code points), and `layoutScene` with scale search, 40% truncation with `…`, centering, baselines, and highlight segments
    - _Requirements: 8.6, 13.10, 13.11, 13.12, 13.13_
  - [x]* 9.3 Write property test P48 in `tests/properties/p48-layout-fits.property.test.ts`
    - Use the measure-function family from `arbitraries.ts`; include very long English and CJK texts and unbroken tokens
    - **Property 48: Layout stays inside the Safe_Area and keeps the text**
    - **Validates: Requirements 13.10, 13.13**
  - [x]* 9.4 Write property test P49 in `tests/properties/p49-layout-scale.property.test.ts`
    - **Property 49: Layout picks the largest fitting scale, else truncates at 40%**
    - **Validates: Requirements 13.11, 13.12**
  - [x]* 9.5 Write unit tests in `tests/sceneLayout.test.ts`
    - A short sentence at 16:9 uses scale 1.0; a 600-character CJK text at 9:16 is truncated with `…`; every `sceneTheme` color equals the matching CSS custom property in `src/styles/app.css`
    - _Requirements: 13.2, 13.11, 13.12_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add playback retiming
  - [x] 11.1 Add the `retime` action to `src/playback/playbackReducer.ts`
    - `playing = false`, `index = min(index, max(0, total - 1))`, durations replaced, `remainingMs = durations[index] ?? 0`
    - _Requirements: 7.2, 7.3_
  - [x] 11.2 Add the optional `resetKey` parameter and a `retime()` helper to `src/playback/usePlayback.ts`
    - Without `resetKey`, keep today's behavior; with it, a changed `resetKey` dispatches `reset` and a changed durations key alone dispatches `retime`
    - _Requirements: 6.5, 7.2, 7.3_
  - [x]* 11.3 Write property test P37 in `tests/properties/p37-playback-retime.property.test.ts`
    - **Property 37: Retiming pauses and keeps the position**
    - **Validates: Requirements 7.2, 7.3**
  - [x]* 11.4 Write unit tests for retiming in `tests/playbackReducer.test.ts` and `tests/usePlayback.test.ts`
    - Reducer examples for `retime`; hook cases for `resetKey` (reset versus retime) and the `retime()` helper; existing `usePlayback` cases unchanged
    - _Requirements: 7.2, 7.3_

- [x] 12. Implement the browser video modules with injected APIs
  - [x] 12.1 Create `src/video/canvasTypes.ts` and `src/video/measure.ts`
    - `FrameContext` and the capture-canvas type; `createCanvasMeasure` (cached, cleared beyond 5,000 entries), `fallbackMeasure`, `createBrowserMeasure`
    - _Requirements: 8.6, 13.13_
  - [x] 12.2 Create `src/video/paintFrame.ts`
    - Background with radial glow, enter-state transform around the stack center, `globalAlpha`, template decorations (quote mark, timeline track and dot), highlight backgrounds via `arcTo`, then segment `fillText` at layout coordinates
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - [x] 12.3 Create `src/video/recorder.ts` and `src/video/frameClock.ts`
    - `Recorder`, `RecorderFactory`, `createMediaRecorder` (1000 ms timeslice, `videoBitsPerSecond` 8,000,000, `discard` never throws); `FrameClock` and `rafClock`
    - _Requirements: 14.2, 14.5, 15.5_
  - [x] 12.4 Create `src/video/support.ts`
    - `VideoEnv`, `VideoSupport`, `detectVideoSupport` (MediaRecorder, `captureStream`, and a `pickMimeType` candidate all required), `browserVideoEnv`
    - _Requirements: 16.1_
  - [x] 12.5 Create `src/video/renderJob.ts`
    - `RenderDeps`, `RenderRequest`, `RenderOutcome`, and `renderVideo` per the design's "Render job" steps: snapshot the storyboard, layouts computed once, await `fontsReady`, paint frame 0, `captureStream(30)`, real-time paced painting with skipped frames, progress callbacks, one `finish()` for completion, abort, hidden tab, recorder error, and empty data that cancels the clock, discards, stops tracks, and unsubscribes
    - Export a default browser `RenderDeps` factory: canvas from `document`, `rafClock`, `fontsReady` as `document.fonts.ready` plus `document.fonts.load` per font raced with a 3-second timeout, `visibilitychange` source, and `MediaRecorder.isTypeSupported`
    - _Requirements: 13.1, 13.3, 13.14, 14.1, 14.2, 14.5, 15.5, 15.6, 15.7, 15.8, 17.1, 17.3_
  - [x]* 12.6 Write property test P50 in `tests/properties/p50-mime-selection.property.test.ts`
    - Include predicates that throw
    - **Property 50: Container selection prefers H.264 MP4, then WebM**
    - **Validates: Requirements 14.1, 16.1**
  - [x]* 12.7 Write unit tests in `tests/paintFrame.test.ts`
    - Recording fake `FrameContext`; per template: background fill first, `fillText` per layout segment at layout coordinates, keyword highlight color, accent colors, `globalAlpha` equals the enter opacity
    - _Requirements: 13.2, 13.4_
  - [x]* 12.8 Write unit tests in `tests/measure.test.ts`
    - `fallbackMeasure` is deterministic and counts wide code points at full size; `createCanvasMeasure` sets the font string and caches results
    - _Requirements: 8.6_
  - [x]* 12.9 Write unit tests in `tests/renderJob.test.ts`
    - Manual clock, fake recorder, fake canvas factory, controllable `fontsReady`, fake visibility source; cover every case listed under `renderJob.test.ts` in the design's Testing Strategy (canvas size, no audio track, no paint before fonts, pacing and skipped frames, progress, abort, hidden tab, recorder error, empty chunks, snapshot isolation)
    - _Requirements: 13.1, 13.3, 13.14, 14.2, 14.5, 15.1, 15.5, 15.6, 15.7, 15.8, 17.3_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Build the UI components
  - [x] 14.1 Move the download helper into `src/components/download.ts`
    - `downloadBlob(blob, filename)`: object URL created, anchor clicked, URL revoked in `finally`; update `ExportButton.tsx` to use it so its tests keep passing until it is removed
    - _Requirements: 12.1, 12.2, 15.8, 17.1_
  - [x] 14.2 Add a `disabled` prop to `src/components/TranscriptInput.tsx`
    - Disables the textarea, "Load sample", and "Clear"; defaults to `false`
    - _Requirements: 15.3_
  - [x] 14.3 Create `src/components/SceneEditor.tsx`
    - Template `<select>` labeled "Template for scene N" with the four plain names; "Auto"/"Edited" chip; "Edit text" with an auto-sized textarea, Save and Cancel (Enter saves, Escape cancels); inline "Scene text can't be empty." with `role="alert"`; "Reset to automatic" enabled only when edited; accessible names include the scene number; all controls honor `disabled`
    - Keep draft text and error locally; call `onEditStart` when the editor opens
    - _Requirements: 1.1, 1.2, 2.1, 2.7, 2.8, 3.1, 3.2, 15.3_
  - [x] 14.4 Add the optional `editor: SceneEditorBindings` prop to `src/components/StoryboardList.tsx`
    - Each row hosts a `SceneEditor` when `editor` is given; only one text editor is open at a time; without `editor` the list renders as in the MVP; rows show the scene text (the Effective_Text) and counts come from the storyboard prop
    - _Requirements: 1.1, 1.5, 7.4_
  - [x] 14.5 Create `src/components/AspectRatioPicker.tsx`
    - "Video shape" radio group with four cards from `ASPECT_RATIOS` (shape preview, ratio, hint); `value`, `onChange`, `disabled`
    - _Requirements: 8.1, 8.2, 15.3_
  - [x] 14.6 Render the ratio-shaped stage in `src/components/Player.tsx` and `src/components/SceneView.tsx`
    - Player: optional `ratio` (default `'16:9'`), `measure` (default `fallbackMeasure`), and `disabled` props so existing callers and tests still work; screen gets `data-ratio` and `--sb-ratio-w` / `--sb-ratio-h`; logical `.sb-stage` at the ratio's pixel size scaled by `screenWidth / W` measured with `ResizeObserver` (fallbacks `clientWidth`, then 1); Play, Pause, Previous, Next disabled when `disabled`
    - SceneView: takes a `SceneLayout` and renders blocks and lines (`<br>` between lines, `<mark class="sb-keyword">` for highlights), keeping the MVP block class names so a block's `textContent` equals its text when not truncated
    - _Requirements: 7.1, 8.5, 8.6, 8.7, 15.3_
  - [x] 14.7 Create `src/components/ExportPanel.tsx`
    - Format radio group with the labels and descriptions of Requirement 9.1; SRT/WebVTT sub-choice with SRT default; video info line `<ratio> · <seconds> seconds`; one Download button named "Download video", "Download subtitles", or "Download storyboard", disabled with zero scenes or while rendering
    - On Download: capture the Export_Timestamp, serialize, parse, validate, and show errors with the MVP error markup; then download JSON, SRT (`application/x-subrip`), or VTT (`text/vtt`) with `downloadBlob`, or start `renderVideo` with an `AbortController`, dispatching `renderStatusReducer` actions and downloading the blob as `video/mp4` or `video/webm`
    - While rendering: `<progress max="100">`, percent, "Scene <current> / <total>", the keep-tab-open message, and an enabled Cancel; afterwards the webm, hidden-tab, or failure notice; when video is unsupported, the Video option is disabled with the unsupported message; abort the job on unmount
    - Props as in the design's component table, with injectable `renderDeps`, `validate`, and `now`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 12.1, 12.2, 14.3, 14.6, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7, 16.2, 16.3_
  - [x] 14.8 Add the styles for the new UI to `src/styles/app.css`
    - Ratio screen (`aspect-ratio: var(--sb-ratio-w) / var(--sb-ratio-h)`, width capped by `--sb-screen-max-h: min(62vh, 640px)`), `.sb-stage`, `--sb-enter-offset: 48px`, `letter-spacing: normal` in the stage, SceneEditor rows and chip, AspectRatioPicker cards, ExportPanel options, progress, and notices; keep the reduced-motion fade
    - _Requirements: 1.2, 8.1, 8.5, 9.1, 15.1_
  - [x]* 14.9 Write component tests in `tests/SceneEditor.test.tsx`
    - Four template options, selected value, Auto/Edited chip, Edit/Save/Cancel, empty-text message keeps the editor open, Reset enabled state, all controls disabled when `disabled`
    - _Requirements: 1.1, 1.2, 2.1, 2.7, 2.8, 3.1, 3.2, 15.3_
  - [x]* 14.10 Add editor cases to `tests/StoryboardList.test.tsx`
    - Rows host a SceneEditor when `editor` is given; only one text editor open at a time; existing read-only cases unchanged
    - _Requirements: 1.1, 7.4_
  - [x]* 14.11 Write component tests in `tests/AspectRatioPicker.test.tsx`
    - Four options with labels and hints, `16:9` checked initially, `onChange` on selection, disabled state
    - _Requirements: 8.1, 8.2_
  - [x]* 14.12 Add ratio and layout cases to `tests/Player.test.tsx`
    - `data-ratio` and `--sb-ratio-w` / `--sb-ratio-h` match the table for each ratio; `app.css` derives `aspect-ratio` from those properties; SceneView lines equal `layoutScene` lines with `fallbackMeasure`; controls disabled when `disabled`; existing cases unchanged
    - _Requirements: 8.5, 8.6, 15.3_
  - [x]* 14.13 Write component tests in `tests/ExportPanel.test.tsx`
    - Port every case of `tests/ExportButton.test.tsx` to the "Storyboard (JSON)" option and the "Download storyboard" button
    - New cases from the design's Testing Strategy: labels and descriptions, SRT default, Video default when supported and Subtitles when not, info line, disabled Download with zero scenes, validation before any file for each format, `.srt`/`.vtt` names and MIME types, video name and MIME with fake `renderDeps`, WebM note, progress UI, Cancel, failure and hidden messages, `fetch` and `XMLHttpRequest` never called
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 9.9, 12.1, 12.2, 14.3, 14.6, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7, 16.2, 16.3, 17.1_

- [x] 15. Wire everything together in `App`
  - [x] 15.1 Update `src/components/App.tsx`
    - State: `overrides`, `ratio`, `exportFormat` (`'subtitles'` when video is unsupported), `subtitleFormat`, `renderStatus` via `renderStatusReducer`, `videoSupport` detected once, `measure = createBrowserMeasure(document)` memoized
    - Derive `auto = buildStoryboard(debouncedText)` and `edited = buildEditedStoryboard(auto, overrides)`; reconcile overrides when the automatic scenes change (render-phase adjustment, also on "Load sample" and "Clear"); pass `edited` to Player, StoryboardList, and ExportPanel
    - Call `usePlayback(durations, resetKey)`; on every editor action (open editor, template change, save text, reset) call `pause()` then `retime()`; a ratio change touches neither storyboard nor playback
    - Replace `ExportButton` with `ExportPanel`, add `AspectRatioPicker` above the Player, pass `SceneEditorBindings`, and lock TranscriptInput, editors, picker, and Player controls while `renderStatus.phase === 'rendering'` (pause playback when a render starts)
    - _Requirements: 1.4, 1.5, 2.4, 2.5, 2.6, 2.10, 3.3, 6.1, 6.3, 6.4, 6.6, 7.1, 7.2, 7.3, 8.2, 8.5, 8.7, 15.3, 16.2_
  - [x] 15.2 Remove `src/components/ExportButton.tsx` and `tests/ExportButton.test.tsx`
    - Their cases now live in `tests/ExportPanel.test.tsx`; confirm nothing imports them
    - _Requirements: 9.1, 9.9_
  - [x]* 15.3 Add integration cases to `tests/App.test.tsx`
    - Adjust existing cases that relied on `ExportButton`; add: template change updates counts and the Player and pauses playback while keeping the position; text edit leaves the textarea unchanged; edits survive a change elsewhere in the transcript and are dropped by Clear; ratio change keeps the position; while a fake render job runs, all listed controls are disabled
    - _Requirements: 1.5, 2.10, 6.1, 6.6, 7.1, 7.2, 7.3, 7.4, 8.7, 15.3_

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Accept version 1.1 in the CLI and hook
  - [x] 17.1 Add the fixtures `tests/fixtures/valid-1.1.storyboard.json` and `tests/fixtures/invalid-1.1.storyboard.json`
    - The invalid fixture has a bad `templateSource` on scene 1; `scripts/validate-storyboard.ts` and `.kiro/hooks/validate-storyboard.json` need no change because they call the validator
    - _Requirements: 5.12_
  - [x]* 17.2 Add CLI cases to `tests/validateCli.test.ts`
    - The valid 1.1 fixture exits 0; the invalid one exits 1 and the output contains `$.scenes[1].templateSource`; the 1.0 fixtures keep their results
    - _Requirements: 5.12_

- [x] 18. Update the steering files and README
  - [x] 18.1 Update `.kiro/steering/product.md`
    - `## Scope boundaries (MVP)`: in-browser silent video (canvas plus MediaRecorder) and SRT/WebVTT subtitles are in scope per `.kiro/specs/scenebeat-edit-export/`; audio, backend, accounts, network requests, and native editor project formats stay out of scope; update the Storyboard JSON paragraph for version `"1.1"` and `templateSource`
    - _Requirements: 17.2, 17.4, 17.5_
  - [x] 18.2 Update `.kiro/steering/structure.md` and `.kiro/steering/tech.md`
    - structure.md: `src/video/`, the new core modules, the new components, `tests/setup.ts`, `tests/properties/arbitraries.ts`, the new fixtures; tech.md: the jsdom setup file, injected browser APIs for video code, property numbering continuing from P25 under `Feature: scenebeat-edit-export`
    - _Requirements: 17.5_
  - [x] 18.3 Update `README.md`
    - Editing, subtitles, and video features; supported browsers; WebM note and the missing-duration limitation of Chrome WebM files; scope note matching `product.md`
    - _Requirements: 14.6, 17.4, 17.5_
  - [x]* 18.4 Add repository smoke cases to `tests/repo.test.ts`
    - `product.md` and `README.md` mention in-browser video and SRT/WebVTT and still exclude audio, backend, and native editor formats; `README.md` documents the WebM limitation; no `fetch(`, `XMLHttpRequest`, `WebSocket`, or `EventSource` in `src/`
    - _Requirements: 17.1, 17.2, 17.4, 17.5_

- [x] 19. Final checkpoint - Build and run all tests
  - Run `pnpm build` (type check plus Vite build) and `pnpm test`, and fix every error and failing test until both succeed. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks; the user plans to run them too.
- Each task references requirement clauses for traceability; property numbers match `design.md`.
- Property tests run with `{ numRuns: 100 }` or more, one property per file.
- Visual parity and real recordings in Chrome, Firefox, and Safari are manual checks listed in `design.md` and are not tasks here.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "4.1", "3.2", "3.3", "3.4", "3.5"] },
    { "id": 2, "tasks": ["2.3", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13"] },
    { "id": 4, "tasks": ["5"] },
    { "id": 5, "tasks": ["6.1", "6.3", "6.8", "7.1", "8.1", "9.1"] },
    { "id": 6, "tasks": ["6.2", "6.4", "6.5", "6.6", "6.7", "6.9", "7.2", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "9.2"] },
    { "id": 7, "tasks": ["7.3", "8.8", "9.3", "9.4", "9.5"] },
    { "id": 8, "tasks": ["10"] },
    { "id": 9, "tasks": ["11.1", "12.1", "12.3", "12.4"] },
    { "id": 10, "tasks": ["11.2", "11.3", "12.2", "12.6", "12.8"] },
    { "id": 11, "tasks": ["11.4", "12.5", "12.7"] },
    { "id": 12, "tasks": ["12.9"] },
    { "id": 13, "tasks": ["13"] },
    { "id": 14, "tasks": ["14.1", "14.2", "14.3", "14.5", "14.6", "14.8"] },
    { "id": 15, "tasks": ["14.4", "14.7", "14.9", "14.11", "14.12"] },
    { "id": 16, "tasks": ["14.10", "14.13"] },
    { "id": 17, "tasks": ["15.1"] },
    { "id": 18, "tasks": ["15.2", "15.3"] },
    { "id": 19, "tasks": ["16"] },
    { "id": 20, "tasks": ["17.1", "18.1", "18.2", "18.3"] },
    { "id": 21, "tasks": ["17.2", "18.4"] },
    { "id": 22, "tasks": ["19"] }
  ]
}
```
