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
- **Scene editing** in the storyboard list (details below): change a scene's template, fix its text, or reset it to the automatic result.
- **Video shape**: pick 16:9, 9:16, 1:1, or 4:5. The preview takes the same shape and line breaks as the exported video.
- **Export** in three formats, all generated locally in the browser with no network requests:
  - **Video**: a silent video of your scenes (MP4 or WebM).
  - **Subtitles**: an SRT or WebVTT file with one caption per scene.
  - **Storyboard (JSON)**: a validated file named `scenebeat-storyboard-YYYYMMDD-HHmmss.json`.
- **Installable app** that works offline after the first visit and remembers your work on this device (details below).

### Install and offline use

- **Install as an app**: in Chrome or Edge on desktop or Android, click the "Install app" button in the header (or the install icon in the address bar). On iPhone or iPad, open SceneBeat in Safari, tap **Share**, then **Add to Home Screen**; SceneBeat shows this hint in the header. You can dismiss the button or hint, and it stays hidden after that.
- **Works offline**: after the first visit, the whole app is stored in the browser, so it opens and every feature works without a connection, including video export. A one-time "Ready to work offline" notice tells you when this is done.
- **Saved on this device only**: your transcript, scene edits, video shape, and export choices are saved in this browser's local storage and restored the next time you open SceneBeat. Nothing is uploaded or synced to other devices. "Clear" also removes the saved copy. Very large transcripts (over about one million characters) are not saved, and SceneBeat tells you when that happens or when the browser blocks storage.
- **Updates**: when a new version is available, SceneBeat shows "New version available" with **Reload** and **Later**. It never reloads on its own. Reload is disabled while a video is rendering or a scene's text editor is open.
- **App shortcuts** (installed app in Chrome on Android and desktop): right-click the dock or taskbar icon, or long-press the home-screen icon, for **New transcript** and **Load sample**. If you already have a transcript, SceneBeat asks before replacing it.
- **Share into SceneBeat** (installed app on Android and ChromeOS): share text from another app to SceneBeat and it becomes the transcript, again with a confirmation if a different transcript is open. Opening a shortcut or sharing reuses the open SceneBeat window, and waits until a running video render finishes.

### Editing scenes

Each row of the storyboard list has its own editing controls:

- **Template**: choose any of the four templates. A chosen template always wins over the automatic one, and SceneBeat picks sensible highlighted data for it (for example, the first word of the sentence when a `big-number` scene has no number).
- **Edit text**: correct typos or transcription errors, then press Save (or Enter). Line breaks become spaces, and the scene stays one scene even if the new text contains several sentences. The scene's duration is recomputed from the new text. Empty text is rejected with "Scene text can't be empty."
- **Reset to automatic**: undo all edits to that scene. Other scenes keep their edits.

A chip shows "Auto" for untouched scenes and "Edited" for changed ones. Edits never change the transcript box. They show up at once in the Player and in every export.

Edits survive changes elsewhere in the transcript. Each edit is tied to its original sentence text (and, for repeated sentences, to which copy it is), so it stays with that sentence when you change other sentences. If you change or delete the sentence itself, or press "Clear" or "Load sample", the edit is dropped.

### Video shapes

| Shape | Size (pixels) | Good for |
|---|---|---|
| 16:9 | 1920 × 1080 | Landscape · YouTube |
| 9:16 | 1080 × 1920 | Portrait · TikTok, Reels, Shorts, 抖音 |
| 1:1 | 1080 × 1080 | Square |
| 4:5 | 1080 × 1350 | Portrait post · Instagram |

16:9 is selected when the app opens. Changing the shape keeps your edits and the current playback position. Text that doesn't fit the frame is shrunk (down to 40% of its normal size) and, if it still doesn't fit, cut off with `…`.

### Video export

SceneBeat draws each scene onto a canvas and records it with the browser's built-in MediaRecorder. Nothing is uploaded.

- **File type**: MP4 (H.264) when the browser can record it, for example recent Chrome, Edge, and Safari. Otherwise WebM, for example Firefox and older Chrome. The file is named `scenebeat-video-<shape>-YYYYMMDD-HHmmss.mp4` (or `.webm`), where `<shape>` is `16x9`, `9x16`, `1x1`, or `4x5`.
- **No sound**: the video has no audio track. Add music or voice in your editor.
- **Rendering takes real time**: a 60-second storyboard takes about 60 seconds to render. A progress bar shows the percentage and the current scene, and you can cancel at any time.
- **Keep the tab visible while rendering.** Browsers pause drawing in hidden tabs, so SceneBeat stops the export if you switch tabs or minimize the window. Start it again with the tab in front.
- **WebM limitation**: WebM files recorded by Chrome have no duration in the file header, so some players show an unknown length or can't seek until the file has fully loaded. Most editors open them fine. Instagram and TikTok expect MP4, so convert WebM files to MP4 before posting (for example with HandBrake or your video editor's export).
- **Supported browsers**: recent versions of Chrome, Edge, Firefox, and Safari. If a browser can't record video, the Video option is disabled with an explanation, and subtitle and storyboard downloads still work.

### Subtitle export

Choose **Subtitles**, then **SRT** (works almost everywhere, the default) or **WebVTT** (web players and YouTube). You get one caption per scene, timed from the scene durations, so captions line up with the exported video. Files are UTF-8 and named `scenebeat-subtitles-YYYYMMDD-HHmmss.srt` (or `.vtt`).

Importing the file (menu names may differ slightly between versions):

- **CapCut / 剪映**: in the desktop app, open **Text → Local captions** (文本 → 本地字幕), click **Import**, and choose the `.srt` file. The captions land on a text track at the start of the timeline.
- **Premiere Pro**: **File → Import**, choose the `.srt` file, then drag it from the Project panel onto the timeline. It becomes a captions track you can restyle.
- **DaVinci Resolve**: **File → Import → Subtitle**, choose the `.srt` file, then drag it from the Media Pool onto the timeline.
- **YouTube**: in YouTube Studio, open the video, go to **Subtitles → Add → Upload file**, choose **With timing**, and pick the `.srt` or `.vtt` file.

Put the subtitles at the start of the timeline, together with the SceneBeat video, so the times match.

Out of scope: accounts, a backend, network requests, audio processing, and native project files for video editors (CapCut drafts, Premiere `.prproj`, DaVinci `.drp`, FCPXML). Use the SRT file to bring captions into those editors. In-browser silent video export was out of scope for the MVP and is now in scope (see `.kiro/specs/scenebeat-edit-export/`).

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

## PWA development

The service worker is registered only in the production build; `pnpm dev` never registers one, so development never serves stale cached files. To try install, offline use, and updates locally, use `pnpm build && pnpm preview`. Service workers only run over HTTPS or on `localhost`, so a deployed copy must be served over HTTPS.

```sh
pnpm generate:pwa-assets   # regenerate the icons, favicon, and placeholder screenshots in public/
pnpm build && pnpm check:pwa   # build, then check dist/ for the manifest, service worker, precache list, and relative URLs
```

`pnpm check:pwa` exits with code 0 when the build passes and 1 otherwise, printing each problem. `pnpm build` never runs `generate:pwa-assets`; the generated files under `public/` are committed.

**Screenshots**: `generate:pwa-assets` writes placeholder screenshots only when `public/screenshots/wide.png` and `narrow.png` don't exist, and never overwrites them. To replace them with real screenshots, run `pnpm preview`, open Chrome DevTools, turn on the device toolbar, set the size to exactly 1280 × 720 (wide) or 750 × 1334 with device pixel ratio 1 (narrow), and use **Capture screenshot** from the DevTools menu. Save the files as PNG under 1 MiB at those paths.

**Deploying under a sub-path**: the build uses relative URLs throughout, so the same `dist/` works at the site root and under a sub-path such as `https://zh30.github.io/scenebeat/`. Upload `dist/` as is; no base setting is needed.

### Manual Chrome checklist

1. Run `pnpm build && pnpm preview` and open DevTools **Application → Manifest**: no errors or warnings; icons, screenshots, shortcuts, share target, and Window Controls Overlay are listed; the installability section reports no issues.
2. **Application → Service workers**: `sw.js` is activated with a scope equal to the page base. **Cache storage**: the `workbox-precache-v2-…` cache lists `index.html`, all bundles, the manifest, and the icons.
3. **Network → Offline**, then reload: the app loads. Paste a transcript, edit a scene, and export SRT, JSON, and a video.
4. Install from the address-bar install icon and from the in-app "Install app" button; the installed window opens without browser UI. Right-click the dock or taskbar icon: "New transcript" and "Load sample" work, with the confirmation when a transcript exists.
5. In the installed window, toggle the title bar (the Window Controls Overlay chevron): the header moves into the title bar, dragging works on empty areas, and the buttons still click.
6. Update prompt: change a visible string, rebuild, keep the preview tab open, and reload once: "New version available" appears. Start a video render and confirm Reload is disabled with its note; open a scene editor and confirm the editing note. "Reload" loads the new version with the transcript intact.
7. Saved work: edit, close the window, reopen: the transcript, edits, video shape, and export choice are restored.
8. Share target: open `./?text=Hello%20world.&title=Note` directly (share sheets deliver this only on Android and ChromeOS).
9. Sub-path: run `pnpm exec vite preview --base /scenebeat/` and repeat steps 1 to 3 at `http://localhost:4173/scenebeat/`.
10. iOS Safari (device or simulator): the install hint shows in the tab; after Add to Home Screen the app opens standalone, with content clear of the notch and home indicator and no overscroll bounce.

## Storyboard JSON format

SceneBeat exports version `"1.1"`. It adds one field per scene, `templateSource`, placed right after `template`: `"auto"` when SceneBeat chose the template, `"manual"` when you picked it. Version `"1.0"` files (the MVP format, with no `templateSource`) are still accepted by the validator and the hook. Everything else is the same in both versions.

An exported storyboard looks like this:

```json
{
  "version": "1.1",
  "createdAt": "2026-10-31T12:00:00.000Z",
  "sceneCount": 2,
  "scenes": [
    {
      "index": 0,
      "text": "Revenue grew 45% last quarter.",
      "template": "big-number",
      "templateSource": "auto",
      "durationMs": 2250,
      "data": {
        "value": "45%"
      }
    },
    {
      "index": 1,
      "text": "She said \"ship it\".",
      "template": "quote",
      "templateSource": "manual",
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
| `version` | string | `"1.1"` (current) or `"1.0"` (MVP format) |
| `createdAt` | string | ISO 8601 timestamp |
| `sceneCount` | integer | Equals `scenes.length` |
| `scenes` | array | Scenes in playback order |

Scene fields:

| Field | Type | Rule |
|---|---|---|
| `index` | integer | Equals the scene's position in `scenes` (0, 1, 2, …) |
| `text` | string | Non-empty, trimmed sentence text |
| `template` | string | `big-number`, `keyword-highlight`, `quote`, or `timeline` |
| `templateSource` | string | Version 1.1 only, and required there: `"auto"` or `"manual"`. Not allowed in version 1.0 |
| `durationMs` | integer | Display time in ms, from 2000 to 8000 |
| `data` | object | Template-specific highlighted data (below) |

`data` by template:

| Template | `data` |
|---|---|
| `big-number` | `{ "value": string }`, the first numeric match (or the sentence's first word when you chose the template for a sentence without a number) |
| `keyword-highlight` | `{ "keywords": string[] }`, 1 to 3 keywords |
| `quote` | `{ "quote": string }`, the text inside the quotation marks (or the whole sentence when there are none) |
| `timeline` | `{ "label": string }`, the matched year, date, or sequence marker (or the sentence's first word when there is none) |

The file uses two-space indentation and a fixed key order (`version`, `createdAt`, `sceneCount`, `scenes`; within a scene `index`, `text`, `template`, `templateSource` in version 1.1, `durationMs`, `data`), so serializing, parsing, and serializing again gives identical text. The rules are enforced by `src/core/validate.ts`.

To validate a file from the command line:

```sh
pnpm exec tsx scripts/validate-storyboard.ts path/to/file.storyboard.json
```

The script prints each error as `path: message` and exits with code 1 on validation errors or malformed JSON, and 0 otherwise.

## Kiro setup

- **Steering files** in `.kiro/steering/` describe the product, the tech stack, and the directory structure, so Kiro follows the project's conventions.
- **Storyboard validation hook** in `.kiro/hooks/` runs `scripts/validate-storyboard.ts` whenever a `*.storyboard.json` or `scenebeat-storyboard-*.json` file is saved in the workspace, and reports any validation errors.
- The spec for the MVP (requirements, design, and tasks) is in `.kiro/specs/scenebeat-mvp/`. The spec for scene editing, subtitles, and video export is in `.kiro/specs/scenebeat-edit-export/`. The spec for the installable, offline PWA (install, offline use, updates, saved work, shortcuts, and share target) is in `.kiro/specs/scenebeat-pwa/`.

## License

[MIT](LICENSE)
