# SceneBeat

SceneBeat turns a podcast or video transcript into an animated motion storyboard, entirely in the browser. Built for Kiroween 2026.

## Features

- **Transcript input**: paste Chinese and/or English text, or load the built-in sample. The storyboard regenerates 300 ms after you stop typing.
- **Sentence splitting** on English (`. ! ?`) and Chinese (`。 ！ ？ ； …`) terminators and on line breaks. Runs such as `?!` or `……` count as one boundary, closing quotes and brackets stay with their sentence, and decimals like `3.5` are not split.
- **Template assignment**: each sentence gets one of four motion templates. The first matching rule wins:
  1. `quote`: text inside `"…"`, `“…”`, `「…」`, or `『…』`
  2. `timeline`: a year (1000 to 2999), a date, or a sequence marker (`first`, `then`, `next`, `finally`, `after that`, `首先`, `然后`, `接着`, `最后`, `之后`, `2025年`)
  3. `big-number`: a number, percentage, currency amount, or Chinese numeral with a unit (`万`, `亿`, `倍`, `%`)
  4. `keyword-highlight`: the fallback, showing 1 to 3 keywords from the sentence
- **Reading-pace durations**: `1000 + 250 × English words + 200 × Chinese characters` ms, clamped to 2000 to 8000 ms.
- **Player** with Play, Pause, Previous, and Next, a "current / total" position label, animated transitions, and an opacity-only fade when the OS requests reduced motion.
- **Storyboard list** showing every scene with its template, the current scene, and per-template counts. Click a row to jump to that scene.
- **Export** of a validated storyboard JSON file named `scenebeat-storyboard-YYYYMMDD-HHmmss.json`. The file is generated locally; the app makes no network requests.

Out of scope for the MVP: accounts, a backend, audio processing, and video rendering.

## Prerequisites

- Node.js 22.12 or later (`^22.12.0 || >=24.0.0`, as required by the installed Vite, Vitest, and jsdom)
- pnpm 12 (`corepack enable` picks up the version pinned in `package.json`)

## Getting started

```sh
pnpm install   # install dependencies
pnpm dev       # start the Vite dev server
pnpm build     # type-check (tsc --noEmit) and build static files into dist/
pnpm preview   # serve the production build locally
pnpm test      # run all unit and property-based tests once (Vitest)
```

## Storyboard JSON format

An exported storyboard looks like this:

```json
{
  "version": "1.0",
  "createdAt": "2026-10-31T12:00:00.000Z",
  "sceneCount": 2,
  "scenes": [
    {
      "index": 0,
      "text": "Revenue grew 45% last quarter.",
      "template": "big-number",
      "durationMs": 2250,
      "data": {
        "value": "45%"
      }
    },
    {
      "index": 1,
      "text": "She said \"ship it\".",
      "template": "quote",
      "durationMs": 2000,
      "data": {
        "quote": "ship it"
      }
    }
  ]
}
```

Top-level fields:

| Field | Type | Rule |
|---|---|---|
| `version` | string | Format version, currently `"1.0"` |
| `createdAt` | string | ISO 8601 timestamp |
| `sceneCount` | integer | Equals `scenes.length` |
| `scenes` | array | Scenes in playback order |

Scene fields:

| Field | Type | Rule |
|---|---|---|
| `index` | integer | Equals the scene's position in `scenes` (0, 1, 2, …) |
| `text` | string | Non-empty, trimmed sentence text |
| `template` | string | `big-number`, `keyword-highlight`, `quote`, or `timeline` |
| `durationMs` | integer | Display time in ms, from 2000 to 8000 |
| `data` | object | Template-specific highlighted data (below) |

`data` by template:

| Template | `data` |
|---|---|
| `big-number` | `{ "value": string }`, the first numeric match |
| `keyword-highlight` | `{ "keywords": string[] }`, 1 to 3 keywords |
| `quote` | `{ "quote": string }`, the text inside the quotation marks |
| `timeline` | `{ "label": string }`, the matched year, date, or sequence marker |

The file uses two-space indentation and a fixed key order (`version`, `createdAt`, `sceneCount`, `scenes`; within a scene `index`, `text`, `template`, `durationMs`, `data`), so serializing, parsing, and serializing again gives identical text. The rules are enforced by `src/core/validate.ts`.

To validate a file from the command line:

```sh
pnpm exec tsx scripts/validate-storyboard.ts path/to/file.storyboard.json
```

The script prints each error as `path: message` and exits with code 1 on validation errors or malformed JSON, and 0 otherwise.

## Kiro setup

- **Steering files** in `.kiro/steering/` describe the product, the tech stack, and the directory structure, so Kiro follows the project's conventions.
- **Storyboard validation hook** in `.kiro/hooks/` runs `scripts/validate-storyboard.ts` whenever a `*.storyboard.json` or `scenebeat-storyboard-*.json` file is saved in the workspace, and reports any validation errors.
- The spec for the MVP (requirements, design, and tasks) is in `.kiro/specs/scenebeat-mvp/`.

## License

[MIT](LICENSE)
