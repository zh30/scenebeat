---
inclusion: always
---

# Directory Structure

```
.kiro/
  steering/             product.md, tech.md, structure.md (this file)
  hooks/                validate-storyboard.json (PostFileSave on *.storyboard.json and scenebeat-storyboard-*.json)
  specs/scenebeat-mvp/  requirements.md, design.md, tasks.md
scripts/
  validate-storyboard.ts  Node CLI wrapping validateStoryboard (run by the hook)
src/
  core/                 pure logic, no React or DOM
    types.ts            Scene, Storyboard, SceneData, SceneTemplate, TEMPLATES, ValidationError
    splitSentences.ts   sentence scanner
    assignTemplate.ts   template rule chain and highlighted data
    duration.ts         readingLength, computeDuration
    buildStoryboard.ts  text -> Storyboard
    serialize.ts        serializeStoryboard, parseStoryboard
    validate.ts         validateStoryboard
    exportFilename.ts   formatExportFilename
    stats.ts            countByTemplate
  playback/
    playbackReducer.ts  pure playback state machine
    positionLabel.ts    formatPosition ("current / total")
    usePlayback.ts      timer hook around the reducer
  components/           App, TranscriptInput, Player, SceneView, StoryboardList, ExportButton
  data/sampleTranscript.ts
  styles/app.css
  main.tsx              entry point
tests/
  *.test.ts(x)          unit, component, CLI, and repo smoke tests
  properties/           one fast-check property per file: pNN-<name>.property.test.ts
  fixtures/             storyboard JSON fixtures for CLI tests
```

## Where new code goes

- New transcript, template, duration, or storyboard logic: a pure module in `src/core/`, with tests in `tests/`.
- New template: add it to `TEMPLATES` in `src/core/types.ts`, then update `assignTemplate.ts`, `validate.ts`, `SceneView.tsx`, and the styles.
- Playback behavior: `playbackReducer.ts` first; touch `usePlayback.ts` only for timing.
- UI: a component in `src/components/`, one component per file, receiving data via props from `App`.
- Node-only tooling: `scripts/`, never imported by `src/`.
- New property tests: next free `pNN` number, matching a property in `design.md`.
