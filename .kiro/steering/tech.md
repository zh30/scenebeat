---
inclusion: always
---

# Tech Stack

- Node.js `^22.12.0 || >=24.0.0` (required by the installed Vite, Vitest, and jsdom; see `engines` in `package.json`)
- Vite 8 with `@vitejs/plugin-react`, React 18, TypeScript with `strict: true` (plus `noUnusedLocals`, `noUnusedParameters`)
- Vitest (jsdom environment, globals enabled, setup file `tests/setup.ts`), fast-check for property tests, React Testing Library
- `tsx` runs TypeScript scripts in Node (used by the validation CLI)
- Player transitions are plain CSS (`src/styles/app.css`); no animation library
- Video export uses browser APIs only: a 2D canvas, `canvas.captureStream(30)`, and `MediaRecorder` (H.264 MP4 preferred, WebM fallback, no audio)

## Package scripts (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsc --noEmit && vite build`; type errors fail the build |
| `pnpm test` | `vitest --run` (all tests, once) |
| `pnpm preview` | Serve the production build |

Validate a storyboard file (version 1.0 or 1.1): `pnpm exec tsx scripts/validate-storyboard.ts <file>` (exit 0 valid, 1 invalid or malformed JSON).

## Rules

- Use pnpm (version pinned in `packageManager`); do not add `package-lock.json` or `yarn.lock`.
- Core logic is pure TypeScript in `src/core/`: deterministic, no I/O, no React, no DOM. React components hold only UI state and call the core.
- Text layout (`sceneLayout.ts`) takes a measure function as a parameter; the Player and the video renderer share the same measurer so line breaks match.
- `src/video/` is the only place that touches canvas, `MediaRecorder`, `requestAnimationFrame`, fonts, or document visibility, and it receives each of them as an injected dependency (`RenderDeps`, `FrameContext`, `FrameClock`, `Recorder`, `VideoEnv`) so tests can pass fakes.
- Playback logic is a pure reducer (`src/playback/playbackReducer.ts`); the timer lives only in `usePlayback`.
- `buildStoryboard` produces version `"1.0"`; the app shows and exports `buildEditedStoryboard` output (version `"1.1"`).
- `validateStoryboard` takes `unknown`, never throws, and returns a list of `{ path, message }` errors (empty means valid).
- No `fetch`, XHR, WebSocket, or other network access anywhere in the app.
- Do not add runtime dependencies without a clear need.

## Testing

- Property tests: fast-check, at least 100 runs (`{ numRuns: 100 }`), one property per file in `tests/properties/pNN-<name>.property.test.ts`. Each file carries a comment `Feature: <spec>, Property N: <text>` and `**Validates: Requirements X.Y**`. Numbering is global and continues across specs: P01 to P24 are `scenebeat-mvp`, P25 to P51 are `scenebeat-edit-export`; a new spec starts at the next free number. Property numbers match that spec's design document.
- Shared generators live in `tests/properties/arbitraries.ts`.
- Unit, component, and smoke tests: `tests/*.test.ts(x)`.
- jsdom has no 2D canvas or `MediaRecorder`. `tests/setup.ts` makes `getContext` return `null`, so the app uses `fallbackMeasure` and reports video as unsupported unless a test installs fakes.
- Test real behavior; avoid mocks except for browser APIs (`URL.createObjectURL`, `matchMedia`, timers, canvas context, `MediaRecorder`, `captureStream`, frame clock).
