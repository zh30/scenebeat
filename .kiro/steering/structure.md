---
inclusion: always
---

# Directory Structure

```
.kiro/
  steering/             product.md, tech.md, structure.md (this file)
  hooks/                validate-storyboard.json (PostFileSave on *.storyboard.json and scenebeat-storyboard-*.json)
  specs/
    scenebeat-mvp/          requirements.md, design.md, tasks.md (Properties 1 to 24)
    scenebeat-edit-export/  requirements.md, design.md, tasks.md (Properties 25 to 51)
scripts/
  validate-storyboard.ts  Node CLI wrapping validateStoryboard (run by the hook)
src/
  core/                 pure logic, no React or DOM
    types.ts            Scene, Storyboard, SceneData, SceneTemplate, TEMPLATES, ValidationError,
                        TemplateSource, SceneOverride, SceneOverrides
    splitSentences.ts   sentence scanner
    assignTemplate.ts   template rule chain and highlighted data
    deriveData.ts       deriveData (data for a forced template), leadingLabel
    duration.ts         readingLength, computeDuration
    buildStoryboard.ts  text -> automatic Storyboard (version "1.0")
    overrides.ts        per-scene edits keyed by (source text, occurrence rank): apply, reconcile, set, reset
    editedStoryboard.ts buildEditedStoryboard (version "1.1", templateSource on every scene)
    serialize.ts        serializeStoryboard, parseStoryboard (1.0 and 1.1)
    validate.ts         validateStoryboard (1.0 and 1.1)
    subtitles.ts        buildCues, SRT and WebVTT format and parse, timestamps
    exportFilename.ts   storyboard, subtitle, and video file names
    stats.ts            countByTemplate
    aspectRatio.ts      ASPECT_RATIOS (16:9, 9:16, 1:1, 4:5)
    sceneTheme.ts       colors, font, block typography shared by DOM preview and canvas
    highlight.ts        highlightRanges (keyword marking)
    sceneLayout.ts      layoutScene, wrapText, safeArea (measure function injected)
    transition.ts       enter transition curve
    framePlan.ts        FPS, planFrames, renderProgress, videoLengthSeconds
    mimeType.ts         MIME_CANDIDATES, pickMimeType
    renderStatus.ts     renderStatusReducer (idle / rendering / notices)
  playback/
    playbackReducer.ts  pure playback state machine (includes 'retime')
    positionLabel.ts    formatPosition ("current / total")
    usePlayback.ts      timer hook around the reducer (optional resetKey)
  video/                browser-only video export; every browser API injected
    canvasTypes.ts      FrameContext (2D context subset)
    measure.ts          createCanvasMeasure, fallbackMeasure, createBrowserMeasure
    paintFrame.ts       draws one frame from a SceneLayout
    recorder.ts         MediaRecorder adapter
    frameClock.ts       requestAnimationFrame clock
    support.ts          detectVideoSupport
    renderJob.ts        renderVideo and default browser RenderDeps
  components/           App, TranscriptInput, AspectRatioPicker, Player, SceneView, StoryboardList,
                        SceneEditor, ExportPanel; helpers download.ts, icons.tsx, templateLabels.ts
  data/sampleTranscript.ts
  styles/app.css
  main.tsx              entry point
tests/
  setup.ts              jsdom setup: HTMLCanvasElement.prototype.getContext returns null
  *.test.ts(x)          unit, component, CLI, and repo smoke tests
  properties/           one fast-check property per file: pNN-<name>.property.test.ts
    arbitraries.ts      shared generators (transcripts, overrides, edited text, durations, measure functions)
  fixtures/             storyboard JSON fixtures for CLI tests (1.0: valid, invalid; 1.1: valid-1.1, invalid-1.1)
```

## Where new code goes

- New transcript, template, duration, override, subtitle, or storyboard logic: a pure module in `src/core/`, with tests in `tests/`.
- New template: add it to `TEMPLATES` in `src/core/types.ts`, then update `assignTemplate.ts`, `deriveData.ts`, `validate.ts`, `sceneTheme.ts`, `sceneLayout.ts`, `SceneView.tsx`, `src/video/paintFrame.ts`, `templateLabels.ts`, and the styles.
- Layout or look of a scene: `sceneTheme.ts` and `sceneLayout.ts`, so the Player preview and the exported video stay identical.
- Playback behavior: `playbackReducer.ts` first; touch `usePlayback.ts` only for timing.
- Code that needs canvas, MediaRecorder, `requestAnimationFrame`, or document visibility: `src/video/`, with the API passed in as a dependency.
- UI: a component in `src/components/`, one component per file, receiving data via props from `App`.
- Node-only tooling: `scripts/`, never imported by `src/`.
- New property tests: next free `pNN` number, matching a property in the design document of the spec that adds it.
