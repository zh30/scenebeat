---
inclusion: always
---

# Tech Stack

- Node.js `^22.12.0 || >=24.0.0` (required by the installed Vite, Vitest, and jsdom; see `engines` in `package.json`)
- Vite 8 with `@vitejs/plugin-react`, React 18, TypeScript with `strict: true` (plus `noUnusedLocals`, `noUnusedParameters`, `allowImportingTsExtensions`)
- Vite `base: './'`: every built URL is relative, so one build works at `/` and under any sub-path
- `vite-plugin-pwa` 2.0.0 (Workbox `generateSW`, `registerType: 'prompt'`, `injectRegister: false`) generates `manifest.webmanifest` from `src/pwa/manifest.ts` and a precache-only `sw.js` (no runtime caching, `navigateFallback: 'index.html'`); `workbox-window` backs `virtual:pwa-register`. Both are devDependencies
- Vitest (jsdom environment, globals enabled, setup file `tests/setup.ts`), fast-check for property tests, React Testing Library
- `tsx` runs TypeScript scripts in Node (`scripts/`)
- Player transitions are plain CSS (`src/styles/app.css`); no animation library
- Video export uses browser APIs only: a 2D canvas, `canvas.captureStream(30)`, and `MediaRecorder` (H.264 MP4 preferred, WebM fallback, no audio)

## Package scripts (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server (no service worker) |
| `pnpm build` | `tsc --noEmit && vite build`; type errors fail the build; emits the manifest, `sw.js`, and `workbox-*.js` |
| `pnpm test` | `vitest --run` (all tests, once) |
| `pnpm preview` | Serve the production build (service worker active) |
| `pnpm validate:storyboard <file>` | Validate a storyboard file (version 1.0 or 1.1); exit 0 valid, 1 invalid or malformed JSON |
| `pnpm generate:pwa-assets` | Regenerate `public/favicon.svg` and `public/icons/*`; writes `public/screenshots/*` placeholders only if missing. Run by hand, never by `build`; outputs are committed |
| `pnpm check:pwa` | Check `dist/`: required files, precache coverage, no root-absolute URLs; exit 0 or 1. Run after `pnpm build` |

## Rules

- Use pnpm (version pinned in `packageManager`); do not add `package-lock.json` or `yarn.lock`.
- Core logic is pure TypeScript in `src/core/` (including `savedWork`, `launchParams`, `installPrompt`, `updateGate`): deterministic, no I/O, no React, no DOM. React components hold only UI state and call the core.
- Text layout (`sceneLayout.ts`) takes a measure function as a parameter; the Player and the video renderer share the same measurer so line breaks match.
- `src/video/` is the only place that touches canvas, `MediaRecorder`, `requestAnimationFrame`, fonts, or document visibility for rendering, and it receives each of them as an injected dependency (`RenderDeps`, `FrameContext`, `FrameClock`, `Recorder`, `VideoEnv`) so tests can pass fakes.
- `src/pwa/` holds the PWA browser layer. Service worker registration, `beforeinstallprompt`/`appinstalled`, `matchMedia`, `localStorage`, `launchQueue`, `history`, page visibility, and timers all arrive through `PwaDeps` (`App`'s optional `pwa` prop; default `defaultPwaDeps()`: no service worker, no install env, in-memory storage). `src/pwa/browserDeps.ts` builds the real deps and imports `virtual:pwa-register`; only `src/main.tsx` imports it, never a test.
- The service worker registers only in production builds where `serviceWorker` is supported; registration errors are ignored and the app keeps working online.
- Saved work lives in one `localStorage` key, `scenebeat:work:v1` (written 500 ms after the last change, flushed on hide); flags use `scenebeat:offline-ready-shown:v1` and `scenebeat:install-dismissed:v1`. Storage errors never break the app.
- Manifest, icon, and share-target URLs stay relative (`./…`); `pnpm check:pwa` rejects root-absolute URLs.
- Playback logic is a pure reducer (`src/playback/playbackReducer.ts`); the timer lives only in `usePlayback`.
- `buildStoryboard` produces version `"1.0"`; the app shows and exports `buildEditedStoryboard` output (version `"1.1"`).
- `validateStoryboard` takes `unknown`, never throws, and returns a list of `{ path, message }` errors (empty means valid).
- No network access except the service worker fetching App_Shell files: no `fetch`, XHR, WebSocket, or runtime caching in app code.
- Do not add runtime dependencies without a clear need (`dependencies` holds only `react` and `react-dom`).

## Testing

- Property tests: fast-check, at least 100 runs (`{ numRuns: 100 }`), one property per file in `tests/properties/pNN-<name>.property.test.ts`. Each file carries a comment `Feature: <spec>, Property N: <text>` and `**Validates: Requirements X.Y**`. Numbering is global and continues across specs: P01 to P24 are `scenebeat-mvp`, P25 to P51 are `scenebeat-edit-export`, P52 to P65 are `scenebeat-pwa`; a new spec starts at the next free number (P66). Property numbers match that spec's design document.
- Shared generators live in `tests/properties/arbitraries.ts`.
- Unit, component, CLI, and smoke tests: `tests/*.test.ts(x)`.
- jsdom has no 2D canvas or `MediaRecorder`. `tests/setup.ts` makes `getContext` return `null`, so the app uses `fallbackMeasure` and reports video as unsupported unless a test installs fakes. It also clears `localStorage` after each test.
- PWA tests pass fake `PwaDeps` (fake `registerSW`, `InstallEnv`, storage, `Timers`, `LaunchEnv`) instead of touching real browser APIs.
- Test real behavior; avoid mocks except for browser APIs (`URL.createObjectURL`, `matchMedia`, timers, canvas context, `MediaRecorder`, `captureStream`, frame clock, service worker registration, install prompt, storage, launch queue).
