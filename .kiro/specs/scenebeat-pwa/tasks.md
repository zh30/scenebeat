# Implementation Plan: scenebeat-pwa

## Overview

The plan builds the PWA bottom-up in TypeScript, following `design.md`. It starts with the build tooling and committed assets, then adds the manifest and Vite config. Next come the pure core modules (`savedWork`, `launchParams`, `installPrompt`, `updateGate`) and the injected browser layer in `src/pwa/`. The UI components follow, then `App` wiring, the HTML and CSS changes, the build-check script, and the documentation. Property tests P52 to P65 each live in their own file under `tests/properties/`, so they can run in parallel. Shared generators are added to `tests/properties/arbitraries.ts` in separate tasks that run before the property tests. All commands use pnpm.

## Tasks

- [x] 1. Install the PWA build tooling
  - Run `pnpm add -D vite-plugin-pwa@2.0.0 workbox-window@^7.4.1`; confirm that `dependencies` in `package.json` is unchanged (only `react` and `react-dom`) and that no `package-lock.json` or `yarn.lock` appears
  - If pnpm reports blocked build scripts for the new packages, allow only what the plugin needs in `pnpm-workspace.yaml`
  - Add `/// <reference types="vite-plugin-pwa/client" />` to `src/vite-env.d.ts`
  - Run `pnpm test` to confirm the existing suite still passes
  - _Requirements: 6.1, 18.8_

- [x] 2. Generate and commit the icon, favicon, and screenshot assets
  - [x] 2.1 Implement the PNG encoder in `scripts/png.ts`
    - Export `encodePng(width, height, rgba: Uint8Array): Buffer`: PNG signature, `IHDR` (8-bit RGBA, colour type 6), one `IDAT` holding `zlib.deflateSync` of rows each prefixed by filter byte 0, `IEND`, with CRC-32 from a precomputed table
    - Export `rasterise(size, scene)`: 4x4 supersampling of a rounded rectangle (corner radius 9/32 of the side) and the play triangle scaled from the favicon path `M12 9.5v13l10-6.5z` on a 32x32 grid, alpha-composited over a background colour or transparency
    - Node-only: uses `node:zlib`, never imported from `src/`
    - _Requirements: 2.1, 2.6_

  - [x]* 2.2 Write unit tests for the PNG encoder in `tests/png.test.ts`
    - Encode small images, check the signature and the IHDR width and height, and inflate the `IDAT` with `zlib.inflateSync` back to the filtered input rows
    - Check that `rasterise` output is deterministic and that a corner pixel and the triangle centre have the expected colours
    - _Requirements: 2.1, 2.5_

  - [x] 2.3 Implement `scripts/generate-pwa-assets.ts`, add the `generate:pwa-assets` script, and commit the generated files
    - Add `"generate:pwa-assets": "tsx scripts/generate-pwa-assets.ts"` to `package.json`
    - Write `public/favicon.svg` (32x32 viewBox, `#ff8a3d` rounded square with `rx=9`, `#1a0f06` triangle `M12 9.5v13l10-6.5z`, the same geometry as the current data-URL favicon in `index.html`)
    - Write `public/icons/icon-192.png` and `public/icons/icon-512.png` (mark at full size on a transparent background)
    - Write `public/icons/icon-maskable-512.png`: full-bleed `#121110`, mark scaled to a centred square of side 0.52 x width, so its corners stay inside the central circle of diameter 0.8 x width
    - Write `public/icons/apple-touch-icon-180.png`: full-bleed `#ff8a3d` with the play triangle
    - Write `public/screenshots/wide.png` (1280x720) and `public/screenshots/narrow.png` (750x1334) as placeholders (`#121110` background, centred mark, no text) only when those files do not exist yet; never overwrite an existing screenshot
    - Run `pnpm generate:pwa-assets` once and keep the generated files under `public/` so they are committed; `pnpm build` must not run this script
    - _Requirements: 2.1, 2.3, 2.4, 2.6_

  - [x]* 2.4 Write asset tests in `tests/pwaAssets.test.ts`
    - For every icon and screenshot entry of `MANIFEST` (and the Apple touch icon), check that the file exists under `public/`, has the PNG signature, and that the IHDR width and height equal the declared `sizes`
    - For the maskable icon, check that the corner pixels are `#121110` and that every pixel outside the central 80% circle is the background colour
    - Check that `public/favicon.svg` exists and contains the `#ff8a3d` and `#1a0f06` colours
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 17.2_

- [x] 3. Add the manifest and configure Vite
  - [x] 3.1 Implement `src/pwa/manifest.ts`
    - Define a local `WebAppManifest` interface covering the fields used; do not import plugin types into `src/`
    - Export `APP_DESCRIPTION` (identical to the `<meta name="description">` text in `index.html`), `THEME_COLOR = '#121110'`, and `MANIFEST` with the exact fields of the "Manifest" section of the design: name, short name, description, relative `id`/`start_url`/`scope` (`./`), `display`, `display_override`, colours, `orientation`, `lang`, `dir`, `categories`, icons, screenshots with labels, the "New transcript" (`./?action=new`) and "Load sample" (`./?action=sample`) shortcuts with the 192x192 icon, `share_target` (`./`, `GET`, `title`/`text`/`url`), and `launch_handler` (`focus-existing`); no `file_handlers` or `protocol_handlers`
    - Export `manifestUrls(m)` returning `id`, `start_url`, `scope`, every icon and screenshot `src`, every shortcut `url` and shortcut icon `src`, and `share_target.action`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.2, 2.4, 4.2, 14.1, 15.1, 16.1, 18.5, 18.6_

  - [x] 3.2 Configure `vite.config.ts` with `base: './'` and `VitePWA`
    - Use the options of the design's "`vite.config.ts` plugin options" section: `strategies: 'generateSW'`, `registerType: 'prompt'`, `injectRegister: false`, `manifestFilename: 'manifest.webmanifest'`, `manifest: MANIFEST` (imported from `src/pwa/manifest.ts`), `includeManifestIcons: true`, `devOptions: { enabled: false }`, and the `workbox` block (`globPatterns`, `navigateFallback: 'index.html'`, `cleanupOutdatedCaches: true`, `runtimeCaching: []`, `clientsClaim: false`, `skipWaiting: false`)
    - Keep the existing React plugin and the Vitest `test` settings unchanged; the plugin's `ManifestOptions` type may be imported here only
    - Run `pnpm build` and confirm that `dist/` contains `manifest.webmanifest`, `sw.js`, and a `workbox-*.js` file, and that `dist/index.html` links the manifest with a relative URL
    - _Requirements: 1.1, 4.1, 5.1, 5.3, 5.4, 5.5, 5.6, 6.1, 6.3, 17.6, 18.2, 18.4_

  - [x] 3.3 Add `deploymentBaseArb` to `tests/properties/arbitraries.ts`
    - Generates `/`, `/scenebeat/`, and paths of one to four URL-safe segments, always starting and ending with `/`
    - _Requirements: 4.4, 17.4_

  - [x]* 3.4 Write manifest tests in `tests/manifest.test.ts`
    - Check every field and value of Requirements 1, 14.1, 15.1, and 16.1 in `MANIFEST`
    - Parse `index.html` with `node:fs` and check that `APP_DESCRIPTION` equals its meta description
    - Check that `file_handlers` and `protocol_handlers` are absent and that `theme_color` and `background_color` equal `THEME_COLOR`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 14.1, 15.1, 16.1, 17.1, 18.5_

  - [x]* 3.5 Write property test for manifest URLs in `tests/properties/p64-manifest-base-path.property.test.ts`
    - **Property 64: Manifest URLs stay under the Deployment_Base**
    - For `/`, `/scenebeat/`, and `deploymentBaseArb`, resolve each `manifestUrls(MANIFEST)` entry against `https://example.test<base>manifest.webmanifest` (and `id` against the resolved `start_url`); the path starts with the base, and every URL is relative (no leading `/`, no scheme)
    - **Validates: Requirements 4.2, 4.4, 17.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `pnpm test` and `pnpm build`. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the pure core modules
  - [x] 5.1 Implement `src/core/savedWork.ts` and move the export format types
    - Move `ExportFormat` and `SubtitleFormat` from `src/components/ExportPanel.tsx` into `src/core/savedWork.ts`; `ExportPanel.tsx` imports and re-exports them so existing imports keep working
    - Export `SAVED_WORK_KEY = 'scenebeat:work:v1'`, `SAVE_LIMIT = 1_000_000`, `SavedWork`, `ParseWorkResult`, `WorkDefaults`
    - `serializeWork`: fixed key order (`version: 1, transcript, overrides, aspectRatio, exportFormat, subtitleFormat`), overrides sorted by key, each written as `sourceText, rank, editedText?, manualTemplate?`, `JSON.stringify` without indentation
    - `parseWork`: never throws; rejects non-JSON, non-objects, arrays, `version !== 1`, and non-string `transcript`; drops each invalid override entry (rules of Requirement 12.7, key must equal `overrideKey(sourceText, rank)` from `src/core/overrides.ts`) and rebuilds kept entries with known fields only; replaces out-of-set settings with `16:9`, `video`, `srt`; uses `hasOwnProperty` and `typeof` checks only
    - `defaultWorkSettings(videoSupported)`: `16:9`, `video` when supported else `subtitles` (the rule `App.tsx` uses today), `srt`
    - `initialWork(stored, videoSupported, sample)`: parsed work with `restored: true` (replacing `video` with the browser default when unsupported), else the sample transcript, no overrides, default settings, `restored: false`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 13.3, 13.5, 13.6_

  - [x] 5.2 Implement `src/core/launchParams.ts`
    - Export `LaunchIntent`, `LAUNCH_PARAM_NAMES`, `LaunchResolution`
    - `buildSharedTranscript(title, text, url)`: trimmed text; prepend trimmed title plus `\n` when non-empty and not contained; append `\n` plus trimmed url when non-empty and not contained; a line break only between two non-empty parts
    - `parseLaunchParams(search)`: `URLSearchParams`, first value wins on repeats; any of `title`/`text`/`url` present gives `share` (or `none` when the composition is empty), ignoring `action`; otherwise `action=new` gives `new-transcript`, `action=sample` gives `load-sample`, anything else `none`; never throws
    - `resolveLaunch(intent, current, sample)`: `noop` for `none`; target `''` (with `focusInput: true`), the sample, or the Shared_Transcript; `confirm` when `current.trim() !== ''` and `current !== target`, else `apply`
    - `stripLaunchParams(search)`: removes `action`, `title`, `text`, `url`, keeps other parameters in order
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 16.5_

  - [x] 5.3 Implement `src/core/installPrompt.ts`
    - Export `InstallState`, `InstallSignals`, `InstallEvent`, `initialInstallSignals`, `installReducer`, `installState` exactly as in the design's "`installReducer` and `installState`" algorithm (`app-installed` also clears `promptAvailable`)
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 5.4 Implement `src/core/updateGate.ts`
    - Export `UpdateInputs`, `UpdateView`, `updateGate` with `visible`, `reloadEnabled`, and `note` as in the design's "`updateGate`" algorithm (render note takes precedence over editing note)
    - _Requirements: 7.1, 7.4, 7.5, 7.7, 7.8_

  - [x] 5.5 Add the core generators to `tests/properties/arbitraries.ts`
    - `savedWorkArb`: reuses the existing transcript and override generators; overrides keyed by `overrideKey`, each with a non-empty `editedText` that differs from `sourceText`, a `manualTemplate`, or both; settings from their allowed sets
    - `invalidOverrideEntryArb`: one broken rule of Requirement 12.7 per entry, tagged with the rule it breaks
    - `outOfSetValueArb`: arbitrary JSON values outside a given allowed set
    - `launchQueryArb`: query strings mixing `action`, `title`, `text`, `url`, and random names, with unicode, `+`, `%` sequences (including malformed ones), and repeats
    - `installEventsArb`: initial platform signals plus a sequence of `InstallEvent`s
    - `changeScheduleArb`: Saved_Work values with delays from 0 to 1500 ms, ending with quiet time or a hidden event
    - _Requirements: 9.9, 12.4, 12.7, 12.8, 13.1, 15.5_

  - [x]* 5.6 Write unit tests for saved work in `tests/savedWork.test.ts`
    - The design's example stored record parses and re-serializes byte for byte; `defaultWorkSettings` for both `videoSupported` values; an override with key `__proto__` is dropped; `ExportFormat` is still importable from `src/components/ExportPanel.tsx`
    - _Requirements: 12.1, 12.2, 12.7, 13.5_

  - [x]* 5.7 Write unit tests for launch parameters in `tests/launchParams.test.ts`
    - `?action=new`, `?action=sample`, `?text=Hello%20world.&title=Note`, share with `action` present, empty share values, `stripLaunchParams` keeping unrelated parameters and their order
    - _Requirements: 14.2, 14.3, 15.2, 15.3, 15.4, 16.5_

  - [x]* 5.8 Write property test for the saved work round trip in `tests/properties/p52-saved-work-round-trip.property.test.ts`
    - **Property 52: Saved work round trip**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

  - [x]* 5.9 Write property test for parser totality in `tests/properties/p53-work-parser-total.property.test.ts`
    - **Property 53: Work parser is total and its output is valid**
    - Inputs: arbitrary strings, `fc.jsonValue()` serializations, and mutated serializations of `savedWorkArb`
    - **Validates: Requirements 12.5, 12.6, 12.9, 12.10**

  - [x]* 5.10 Write property test for dropping invalid override entries in `tests/properties/p54-override-entries-dropped.property.test.ts`
    - **Property 54: Invalid override entries are dropped individually**
    - **Validates: Requirements 12.7**

  - [x]* 5.11 Write property test for setting fallbacks in `tests/properties/p55-settings-fallback.property.test.ts`
    - **Property 55: Out-of-range settings fall back per field**
    - **Validates: Requirements 12.8**

  - [x]* 5.12 Write property test for start-up state in `tests/properties/p56-initial-work.property.test.ts`
    - **Property 56: Start-up state from storage**
    - **Validates: Requirements 13.3, 13.5, 13.6**

  - [x]* 5.13 Write property test for shared transcript composition in `tests/properties/p59-shared-transcript.property.test.ts`
    - **Property 59: Shared transcript composition**
    - Compare against an independent reference implementation written in the test
    - **Validates: Requirements 15.3, 15.4, 15.5**

  - [x]* 5.14 Write property test for launch parser totality and precedence in `tests/properties/p60-launch-parser.property.test.ts`
    - **Property 60: Launch parser totality and precedence**
    - **Validates: Requirements 14.2, 14.3, 15.2, 15.6**

  - [x]* 5.15 Write property test for the replace confirmation decision in `tests/properties/p61-replace-confirmation.property.test.ts`
    - **Property 61: Replace confirmation decision**
    - **Validates: Requirements 14.4, 14.5, 14.6, 15.7, 15.8**

  - [x]* 5.16 Write property test for the install state invariant in `tests/properties/p62-install-state.property.test.ts`
    - **Property 62: Install state invariant**
    - Check the invariant after every event of `installEventsArb`
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**

  - [x]* 5.17 Write property test for the update gate model in `tests/properties/p63-update-gate.property.test.ts`
    - **Property 63: Update gate model**
    - **Validates: Requirements 7.4, 7.5, 7.7, 7.8**

  - [x]* 5.18 Write property test for launch parameter stripping in `tests/properties/p65-launch-param-strip.property.test.ts`
    - **Property 65: Launch parameter stripping**
    - **Validates: Requirements 16.5**

- [x] 6. Implement the injected browser layer in `src/pwa/`
  - [x] 6.1 Implement `src/pwa/storage.ts`
    - Export `StorageLike`, `Timers`, `StoreNotice`, `WorkStore`, `createWorkStore`, `createMemoryStorage`, `readFlag`, `writeFlag`
    - `schedule` debounces by `delayMs` (default 500); `flush` writes the pending value, reports `too-large` above `limit` (default `SAVE_LIMIT`) without touching storage, reports `unavailable` when storage is `null` or `setItem` throws; `clear` cancels the timer and removes `SAVED_WORK_KEY`; `load` returns the raw string or `null` and reports `unavailable` when `getItem` throws; `dispose` cancels the timer
    - `readFlag`/`writeFlag` treat errors as "not set" and swallow write errors
    - _Requirements: 8.3, 9.8, 13.1, 13.2, 13.7, 13.8, 13.9, 13.11_

  - [x]* 6.2 Write property test for debounced saving in `tests/properties/p57-debounced-save.property.test.ts`
    - **Property 57: Debounced saving writes the latest work**
    - Use `createMemoryStorage()` and a hand-rolled fake `Timers` driven by `changeScheduleArb`
    - **Validates: Requirements 13.1, 13.2**

  - [x]* 6.3 Write property test for failing writes in `tests/properties/p58-failed-write-safe.property.test.ts`
    - **Property 58: Oversized or failing writes never corrupt stored work**
    - Use a throwing storage and a small `limit` to exercise both notices
    - **Validates: Requirements 13.7, 13.8**

  - [x] 6.4 Implement `src/pwa/register.ts`
    - Export `SwCallbacks`, `RegisterSW`, `ServiceWorkerHandle`, `startServiceWorker`
    - Return `null` without calling `registerSW` when `isProduction` or `supported` is false; otherwise call `registerSW({ immediate: true, ...callbacks })` once per deps object and return a handle whose `applyUpdate()` calls the returned `updateSW(true)`
    - _Requirements: 4.3, 6.2, 6.3, 6.4, 6.5, 7.6_

  - [x]* 6.5 Write unit tests for registration in `tests/register.test.ts`
    - Fake `registerSW`: called once in production, never when `isProduction` or `supported` is false, a second call with the same deps does not register again, `onRegisterError` leaves no update or offline state, `applyUpdate` calls `updateSW(true)`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 17.5_

  - [x] 6.6 Implement `src/pwa/install.ts`
    - Export `InstallPromptEventLike`, `InstallEnv`, `isStandalone` (`display-mode: standalone`, `display-mode: window-controls-overlay`, or `navigatorStandalone === true`), `isIosSafari` (iPhone/iPad/iPod, or MacIntel with touch points; excludes CriOS, FxiOS, EdgiOS)
    - _Requirements: 9.5, 9.6, 9.7_

  - [x]* 6.7 Write unit tests for platform detection in `tests/install.test.ts`
    - Sample user agents for iPhone Safari, iPadOS desktop-mode Safari, Chrome on iOS, Android Chrome, desktop Chrome; standalone via each media query and via `navigatorStandalone`
    - _Requirements: 9.5, 9.6, 9.7_

  - [x] 6.8 Implement `src/pwa/launch.ts`
    - Export `LaunchEnv` (`initialSearch`, `replaceSearch`, optional `launchQueue`)
    - _Requirements: 16.3, 16.5_

  - [x] 6.9 Implement `src/pwa/deps.ts`
    - Export `PwaDeps` and `defaultPwaDeps()` (no service worker support, `install: null`, `createMemoryStorage()`, real `setTimeout`/`clearTimeout` wrappers, empty `initialSearch` with a no-op `replaceSearch` and no `launchQueue`, `onHidden` returning a no-op unsubscribe)
    - _Requirements: 6.5, 13.11, 17.8_

  - [x] 6.10 Implement `src/pwa/useSavedWork.ts`
    - Call `store.schedule(work)` in an effect keyed on the five Saved_Work fields, skipping the first run after restore; register `store.flush` with `onHidden`; dispose the store on unmount
    - _Requirements: 13.1, 13.2_

  - [x] 6.11 Implement `src/pwa/useLaunchIntent.ts`
    - Follow the design's "`useLaunchIntent`" algorithm: wait for `ready`, parse `initialSearch` once, defer while `renderInProgress` (latest intent wins), resolve with `resolveLaunch` and call `onApply` or `onConfirm`, then `replaceSearch(stripLaunchParams(search))` for intents other than `none` (ignoring errors)
    - Call `launchQueue.setConsumer` once when present; ignore a first delivery whose `targetURL` search equals `initialSearch`; handle later deliveries without reloading
    - _Requirements: 14.4, 14.5, 14.6, 15.7, 15.8, 16.2, 16.3, 16.4, 16.5_

  - [x] 6.12 Implement `src/pwa/usePwa.ts`
    - Install: `installReducer` state seeded by `initialInstallSignals` from `deps.install` and the `scenebeat:install-dismissed:v1` flag; listen for `beforeinstallprompt` (call `preventDefault`, keep the event in a ref), `appinstalled`, and display-mode `change`; `install()` calls `prompt()`, awaits `userChoice` (a rejection counts as closed), then dispatches `prompt-closed`; `dismissInstall()` writes the flag and dispatches `dismissed`; `installState` is `hidden` when `deps.install` is `null`
    - Update: call `startServiceWorker` once; `onNeedRefresh` sets `updateAvailable`; `update = updateGate(...)`; `reload()` runs only when `reloadEnabled`, calls `flushWork()` then `handle.applyUpdate()`; `later()` sets `later` for this launch
    - Offline ready: on `onOfflineReady`, show the notice only when `scenebeat:offline-ready-shown:v1` is not set, write the flag, and hide after 8000 ms through `deps.timers`; `dismissOfflineReady()` hides it at once
    - _Requirements: 6.4, 7.1, 7.3, 7.6, 7.7, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 6.13 Implement `src/pwa/browserDeps.ts`
    - Export `createBrowserPwaDeps()`: `registerSW` from `virtual:pwa-register`, `isProduction: import.meta.env.PROD`, `supported: 'serviceWorker' in navigator`; `InstallEnv` from `window`/`navigator`; `localStorage` (or `null` when access throws); window timers; `LaunchEnv` from `location.search`, `history.replaceState` keeping path and hash, and `window.launchQueue`; `onHidden` subscribing to `visibilitychange` (hidden only) and `pagehide`
    - Add the `sb-standalone` class to `<html>` when `navigator.standalone === true`
    - Not imported by any test or by any module other than `src/main.tsx`
    - _Requirements: 4.3, 6.2, 6.3, 10.3, 13.2, 16.3, 16.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Run `pnpm test` and `pnpm build`. Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build the UI components
  - [x] 8.1 Implement `src/components/InstallButton.tsx`
    - `install-available`: "Install app" button plus a dismiss button labelled "Dismiss install"; `ios-instructions`: "Install: tap Share, then Add to Home Screen" with a dismiss button; otherwise renders nothing
    - _Requirements: 9.1, 9.2, 9.6, 9.8_

  - [x] 8.2 Implement `src/components/UpdateToast.tsx`
    - Renders when `view.visible`: "New version available", "Reload" (`disabled` when `!reloadEnabled`), "Later", and `view.note` when set; not modal, no focus trap
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_

  - [x] 8.3 Implement `src/components/NoticeArea.tsx`
    - `<div role="status" aria-live="polite">` fixed at the bottom of the viewport, rendering its children
    - _Requirements: 7.1, 8.1, 13.7, 13.8_

  - [x] 8.4 Implement `src/components/ConfirmReplaceDialog.tsx`
    - Native `<dialog>` opened with `showModal()` when available, else `role="dialog" aria-modal="true"`; title "Replace your current transcript?", buttons "Replace" and "Keep current"; Escape (the `cancel` event) counts as "Keep current"
    - _Requirements: 14.6, 15.8, 15.9, 15.10_

  - [x] 8.5 Add the `savedNote` prop to `src/components/TranscriptInput.tsx`
    - Optional `savedNote?: string` rendered under the textarea when set
    - _Requirements: 13.10_

  - [x] 8.6 Add the `onEditingChange` prop to `src/components/StoryboardList.tsx`
    - Report `openIndex !== null` through `onEditingChange` from an effect whenever it changes; `SceneEditor` stays unchanged
    - _Requirements: 7.5_

  - [x]* 8.7 Write component tests in `tests/InstallButton.test.tsx`
    - Each `InstallState` renders the right content; buttons call `onInstall` and `onDismiss`
    - _Requirements: 9.1, 9.6, 9.8_

  - [x]* 8.8 Write component tests in `tests/UpdateToast.test.tsx`
    - Hidden when not visible; Reload disabled with each note; Later calls `onLater`; other page controls stay focusable while the toast is shown
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_

  - [x]* 8.9 Write component tests in `tests/ConfirmReplaceDialog.test.tsx`
    - Title and both buttons; Replace and Keep current callbacks; Escape calls `onKeep`; works without `showModal` (jsdom fallback)
    - _Requirements: 14.6, 15.9, 15.10_

  - [x]* 8.10 Extend `tests/StoryboardList.test.tsx` for `onEditingChange`
    - Opening a scene text editor reports `true`, closing it reports `false`
    - _Requirements: 7.5_

- [x] 9. Wire the PWA into the app
  - [x] 9.1 Wire `src/components/App.tsx`
    - Add the optional `pwa?: PwaDeps` prop (default `defaultPwaDeps()`); create the Work_Store in a ref with `onNotice` feeding `storeNotice` (`unavailable` shown at most once per launch, `too-large` cleared by the next successful write)
    - Replace the initial values of `text`, `overridesState`, `ratio`, `exportFormat`, and `subtitleFormat` with lazy initialisers from `initialWork(store.load(), videoSupport.supported, SAMPLE_TRANSCRIPT)`; restored overrides go through the existing render-time reconcile
    - Call `useSavedWork`; make "Clear" call `store.clear()` before clearing the transcript
    - Call `useLaunchIntent` with `ready: true`, `renderInProgress` (the existing `locked` value), the current transcript, and the sample; `onApply` runs the Clear handler and focuses the textarea for `new-transcript`, the Load sample handler for `load-sample`, and sets the transcript for `share`; `onConfirm` sets `pendingReplace`, rendered by `ConfirmReplaceDialog` ("Replace" applies it, "Keep current" clears it)
    - Track `editing` from `StoryboardList.onEditingChange`; call `usePwa(pwa, { renderInProgress, editing, flushWork: store.flush })`
    - Render `InstallButton` in the header, `TranscriptInput` with `savedNote="Saved on this device only"`, and `NoticeArea` holding `UpdateToast`, the Offline_Ready_Notice ("Ready to work offline" with a "Dismiss" button), and the storage notices "This transcript is too large to save on this device" and "Your work can't be saved in this browser"
    - _Requirements: 6.4, 7.1, 7.3, 7.6, 8.1, 8.2, 9.1, 9.6, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 14.4, 14.5, 14.6, 15.7, 15.8, 15.9, 15.10, 16.2, 16.4_

  - [x] 9.2 Pass browser dependencies in `src/main.tsx`
    - `createRoot(...).render(<App pwa={createBrowserPwaDeps()} />)`
    - _Requirements: 6.2, 6.3_

  - [x] 9.3 Isolate `localStorage` between tests in `tests/setup.ts`
    - Add `afterEach(() => localStorage.clear())`; keep the existing canvas setup unchanged
    - _Requirements: 17.8_

  - [x]* 9.4 Write App persistence tests in `tests/App.persistence.test.tsx`
    - With fake `PwaDeps` and in-memory storage: restore transcript, overrides, ratio, and export choices instead of the sample; corrupt storage falls back to the sample; restored `video` falls back without video support; changes are written after 500 ms (fake timers) and flushed on hidden; Clear removes the key; "Saved on this device only" is shown; too-large and unavailable notices appear (unavailable once)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x]* 9.5 Write App update and offline tests in `tests/App.update.test.tsx`
    - Fake `registerSW` triggering `onNeedRefresh`: toast appears; Reload disabled with the note during a render (fake video deps) and while a scene editor is open; Later hides it; Reload flushes the store before `applyUpdate`; `onOfflineReady` shows the notice once, sets the flag, and hides after 8 s or on Dismiss; no SW in the default deps means no toast or notice
    - _Requirements: 6.4, 7.1, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3_

  - [x]* 9.6 Write App install tests in `tests/App.install.test.tsx`
    - Fake `InstallEnv`: dispatching a fake `beforeinstallprompt` shows "Install app"; clicking calls `prompt()` and hides the button after `userChoice` resolves (accepted and declined); `appinstalled` hides it; standalone hides it; iOS Safari shows instructions; dismissal writes `scenebeat:install-dismissed:v1` and keeps it hidden on a new render
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x]* 9.7 Write App launch tests in `tests/App.launch.test.tsx`
    - `?action=new` with the sample loaded opens the dialog, Replace clears and focuses the textarea; `?action=sample`; share into an empty transcript applies directly; share into a different transcript opens the dialog, Replace and Keep current behave as specified; intents are deferred during a render and applied after it ends; `replaceSearch` is called with the stripped query; a duplicate initial `launchQueue` delivery is ignored and a later one is handled
    - _Requirements: 14.4, 14.5, 14.6, 15.7, 15.8, 15.9, 15.10, 16.2, 16.3, 16.4, 16.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Run `pnpm test` and `pnpm build`. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add the platform tags to `index.html`
  - [x] 11.1 Update `index.html`
    - Viewport `width=device-width, initial-scale=1, viewport-fit=cover`; replace the data-URL favicon with `<link rel="icon" type="image/svg+xml" href="./favicon.svg">`; add `<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon-180.png">`, the `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (`black-translucent`), and `apple-mobile-web-app-title` (`SceneBeat`) meta tags, and `<meta name="theme-color" content="#121110">`; keep the description unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 10.7_

  - [x]* 11.2 Write HTML tests in `tests/indexHtml.test.ts`
    - Read `index.html` with `node:fs` and check every link and meta tag of Requirement 3, that every `href`/`src` is relative, and that `theme-color` equals `THEME_COLOR`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.3_

- [x] 12. Add app-like styling and the Window Controls Overlay header
  - [x] 12.1 Update `src/styles/app.css`
    - Apply the design's "Styling" section: safe-area padding with `max(<existing>, env(safe-area-inset-*))`, `min-height: 100vh` then `100dvh`, `-webkit-tap-highlight-color: transparent` on interactive controls, `user-select: none` on buttons, chips, and segmented controls with `user-select: text` on the textarea, text inputs, and scene text, `overscroll-behavior: none` only in standalone and WCO display modes and under `html.sb-standalone`, and the WCO header rules (`titlebar-area-*` positioning, `app-region: drag`, `no-drag` on controls, main content offset by the title bar height)
    - Use the class names that `App.tsx` and the other components actually render; keep the existing `:focus-visible` outlines untouched
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 12.2 Adjust the header markup in `src/components/App.tsx` for Window Controls Overlay
    - Give the header title and tagline class names that the WCO rules can hide, and render the title and tagline as plain text in the first card with a class that is hidden outside WCO, so the header layout outside WCO stays as in `scenebeat-edit-export`
    - _Requirements: 11.2, 11.4, 11.5_

- [x] 13. Add the build check
  - [x] 13.1 Implement `scripts/check-pwa-build.ts` and the `check:pwa` script
    - Export the pure `checkBuild(files: Map<string, string | Uint8Array>): string[]` with the three checks of the design's "Build check" section (required files; every `.html`, `.js`, `.css` except `sw.js` and `workbox-*.js` and every `icons/` file in the precache list of `sw.js`; no root-absolute URLs in `index.html` `src`/`href`, CSS `url(/…)`, built manifest URLs, or precache URLs)
    - The CLI reads the directory given as the first argument (default `dist`), prints each problem, and exits 0 when the list is empty and 1 otherwise (also 1 when the directory is missing); run the CLI only when the file is executed directly, so tests can import `checkBuild`
    - Add `"check:pwa": "tsx scripts/check-pwa-build.ts dist"` to `package.json`
    - _Requirements: 4.1, 17.6, 17.7_

  - [x]* 13.2 Write unit tests in `tests/checkPwaBuild.test.ts`
    - In-memory file maps: a passing build, missing `sw.js`, missing `workbox-*.js`, an unprecached bundle, an unprecached icon, a root-absolute `src` in `index.html`, `url(/…)` in CSS, a root-absolute manifest URL
    - _Requirements: 17.6, 17.7_

- [x] 14. Update the documentation
  - [x] 14.1 Update `.kiro/steering/product.md`
    - Add the PWA capabilities (install, offline use, update prompt, saved work on this device, shortcuts, share target, launch handling) and the scope exclusions of Requirement 18
    - _Requirements: 18.1, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 14.2 Update `.kiro/steering/tech.md`
    - Add `vite-plugin-pwa`/Workbox, `base: './'`, the `generate:pwa-assets` and `check:pwa` scripts, the `src/pwa/` injection rule (`PwaDeps`, `browserDeps.ts` imported only by `main.tsx`), and P52 to P65 for `scenebeat-pwa`; replace the "No `fetch` …" rule with "no network access except the service worker fetching App_Shell files"
    - _Requirements: 18.1, 18.2, 18.8_

  - [x] 14.3 Update `.kiro/steering/structure.md`
    - Add `public/`, `src/pwa/` and its files, the new core modules, components, scripts, and tests, and the spec folder `scenebeat-pwa/` (Properties 52 to 65)
    - _Requirements: 17.1_

  - [x] 14.4 Update `README.md`
    - Install and offline use, the saved-work note, deploying under a sub-path, `pnpm generate:pwa-assets`, capturing the two screenshots with Chrome DevTools at the exact sizes (PNG under 1 MiB), `pnpm check:pwa`, and the manual Chrome checklist from the design's Testing Strategy
    - _Requirements: 2.4, 4.5, 17.7_

- [x] 15. Final checkpoint - Build, test, and check the PWA output
  - Run `pnpm build`, `pnpm test`, and `pnpm check:pwa`, and fix every error or failing test they report until all three succeed. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks; the user plans to run all of them.
- Property tests use fast-check with `{ numRuns: 100 }`, one property per file, each with the comment `Feature: scenebeat-pwa, Property N: <text>` and `**Validates: Requirements X.Y**`.
- Shared generators go into `tests/properties/arbitraries.ts` only in tasks 3.3 and 5.5, so the property test tasks never edit the same file.
- Requirements 4.5 and 5.2 (sub-path serving, full offline use) are covered by the build check and the manual Chrome checklist in the README; they cannot be fully automated in jsdom.
- The real screenshots are a manual capture; task 2.3 writes placeholders of the exact sizes so the manifest is valid from the start.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.4", "3.5"] },
    { "id": 3, "tasks": ["2.4"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["5.5", "5.6", "5.7"] },
    { "id": 7, "tasks": ["5.8", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14", "5.15", "5.16", "5.17", "5.18"] },
    { "id": 8, "tasks": ["6.1", "6.4", "6.6", "6.8"] },
    { "id": 9, "tasks": ["6.2", "6.3", "6.5", "6.7", "6.9"] },
    { "id": 10, "tasks": ["6.10", "6.11", "6.12", "6.13"] },
    { "id": 11, "tasks": ["7"] },
    { "id": 12, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 13, "tasks": ["8.7", "8.8", "8.9", "8.10"] },
    { "id": 14, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 15, "tasks": ["9.4", "9.5", "9.6", "9.7"] },
    { "id": 16, "tasks": ["10"] },
    { "id": 17, "tasks": ["11.1", "12.1", "12.2", "13.1"] },
    { "id": 18, "tasks": ["11.2", "13.2", "14.1", "14.2", "14.3", "14.4"] },
    { "id": 19, "tasks": ["15"] }
  ]
}
```
