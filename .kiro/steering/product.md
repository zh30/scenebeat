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
4. Previews the scenes in a Player with Play/Pause/Previous/Next, animated transitions, and reduced-motion support.
5. Lists every scene with its template and per-template counts.
6. Exports a validated storyboard JSON file named `scenebeat-storyboard-YYYYMMDD-HHmmss.json`.

## Scope boundaries (MVP)

- Runs entirely in the browser as a static Vite build. No network requests.
- Out of scope: accounts, backend, audio processing, video/MP4 rendering.
- Do not add features outside the spec in `.kiro/specs/scenebeat-mvp/` without asking.

## Storyboard JSON

Top level: `version` (`"1.0"`), `createdAt` (ISO 8601), `sceneCount` (equals `scenes.length`), `scenes`. Each scene: `index` (equals its array position), `text`, `template`, `durationMs` (integer in [2000, 8000]), `data` (`value`, `keywords`, `quote`, or `label` depending on template). Key order is fixed so serialization round-trips byte-for-byte. `src/core/validate.ts` is the single source of truth for these rules.
