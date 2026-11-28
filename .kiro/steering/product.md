---
inclusion: always
---

# Product: SceneBeat

SceneBeat is a client-side web app (built for Kiroween 2026). The user pastes a podcast or video transcript (Chinese and/or English). SceneBeat:

1. Splits the transcript into sentences on English (`. ! ?`) and Chinese (`。 ！ ？ ； …`) terminators and on line breaks.
2. Assigns each sentence one of four motion scene templates, first match wins:
   - `quote`: text inside `"…"`, `“…”`, `「…」`, `『…』`
   - `timeline`: a year (1000 to 2999), a date, or a sequence marker (`first`, `then`, `首先`, `2025年`, ...)
   - `big-number`: a number, percentage, currency amount, or Chinese numeral with a unit (`万 亿 倍 %`)
   - `keyword-highlight`: fallback, with 1 to 3 keywords
3. Gives each scene a reading-pace duration: `1000 + 250 * englishWords + 200 * chineseChars` ms, clamped to [2000, 8000].
4. Lets the user edit each scene in the list: force a template, edit the text (always one scene, never re-split), or reset to automatic. Edits are keyed by source text and occurrence rank, so they survive changes elsewhere in the transcript; "Load sample" and "Clear" reconcile them the same way.
5. Previews the scenes in a Player with Play/Pause/Previous/Next, animated transitions, and reduced-motion support. The stage follows the selected aspect ratio: `16:9` (1920x1080), `9:16` (1080x1920), `1:1` (1080x1080), `4:5` (1080x1350), with the same text layout as the video.
6. Lists every scene with its template, an Auto/Edited chip, and per-template counts.
7. Exports, after validating the edited storyboard:
   - Video: silent, rendered in the browser (canvas plus MediaRecorder, 30 fps, real-time), MP4 (H.264) when supported, else WebM. Named `scenebeat-video-<16x9|9x16|1x1|4x5>-YYYYMMDD-HHmmss.<mp4|webm>`. Shows progress and Cancel; stops if the tab is hidden.
   - Subtitles: SRT (default) or WebVTT, one cue per scene timed cumulatively from durations, UTF-8 without BOM, named `scenebeat-subtitles-YYYYMMDD-HHmmss.<srt|vtt>`.
   - Storyboard JSON: `scenebeat-storyboard-YYYYMMDD-HHmmss.json`.

## Scope boundaries (MVP)

- Runs entirely in the browser as a static Vite build. No network requests.
- In scope since `.kiro/specs/scenebeat-edit-export/`: in-browser silent video rendering (canvas plus MediaRecorder) and SRT/WebVTT subtitle files.
- Out of scope: accounts, backend, network requests, audio processing or audio tracks, and native video-editor project formats (CapCut drafts, `.prproj`, `.drp`, FCPXML). SRT is the import path for those editors.
- Do not add features outside the specs in `.kiro/specs/scenebeat-mvp/` and `.kiro/specs/scenebeat-edit-export/` without asking.

## Storyboard JSON

Top level: `version`, `createdAt` (ISO 8601), `sceneCount` (equals `scenes.length`), `scenes`. Each scene: `index` (equals its array position), `text`, `template`, `durationMs` (integer in [2000, 8000]), `data` (`value`, `keywords`, `quote`, or `label` depending on template). SceneBeat writes version `"1.1"`, which adds `templateSource` (`"auto"` or `"manual"`) on every scene directly after `template`. Version `"1.0"` files (no `templateSource`) stay valid; any other version is an error. Key order is fixed so serialization round-trips byte-for-byte. `src/core/validate.ts` is the single source of truth for these rules.
