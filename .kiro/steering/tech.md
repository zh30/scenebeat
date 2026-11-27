---
inclusion: always
---

# Tech Stack

- Node.js `^22.12.0 || >=24.0.0` (required by the installed Vite, Vitest, and jsdom; see `engines` in `package.json`)
- Vite 8 with `@vitejs/plugin-react`, React 18, TypeScript with `strict: true` (plus `noUnusedLocals`, `noUnusedParameters`)
- Vitest (jsdom environment, globals enabled), fast-check for property tests, React Testing Library
- `tsx` runs TypeScript scripts in Node (used by the validation CLI)
- Transitions are plain CSS (`src/styles/app.css`); no animation library

## Package scripts (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsc --noEmit && vite build`; type errors fail the build |
| `pnpm test` | `vitest --run` (all tests, once) |
| `pnpm preview` | Serve the production build |

Validate a storyboard file: `pnpm exec tsx scripts/validate-storyboard.ts <file>` (exit 0 valid, 1 invalid or malformed JSON).

## Rules

- Use pnpm (version pinned in `packageManager`); do not add `package-lock.json` or `yarn.lock`.
- Core logic is pure TypeScript in `src/core/`: deterministic, no I/O, no React, no DOM. React components hold only UI state and call the core.
- Playback logic is a pure reducer (`src/playback/playbackReducer.ts`); the timer lives only in `usePlayback`.
- `validateStoryboard` takes `unknown`, never throws, and returns a list of `{ path, message }` errors (empty means valid).
- No `fetch`, XHR, or other network access anywhere in the app.
- Do not add runtime dependencies without a clear need.

## Testing

- Property tests: fast-check, at least 100 runs (`{ numRuns: 100 }`), one property per file in `tests/properties/pNN-<name>.property.test.ts`. Each file carries a comment `Feature: scenebeat-mvp, Property N: <text>` and `**Validates: Requirements X.Y**`. Property numbers match the design document.
- Unit, component, and smoke tests: `tests/*.test.ts(x)`.
- Test real behavior; avoid mocks except for browser APIs (`URL.createObjectURL`, `matchMedia`, timers).
