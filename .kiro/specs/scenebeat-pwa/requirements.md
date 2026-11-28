# Requirements Document

## Introduction

This feature turns SceneBeat into an installable Progressive Web App (PWA) that behaves like a native local app once installed. It builds on `.kiro/specs/scenebeat-mvp/` and `.kiro/specs/scenebeat-edit-export/`; all requirements of those specs remain in force.

The feature adds:

1. **Installability**: a complete Web App Manifest, committed icon and screenshot files, and platform meta tags.
2. **Offline use**: a service worker that precaches the whole app, so every feature (including video export) works offline after the first visit.
3. **Updates**: a non-blocking "New version available" prompt that never reloads the page on its own, and a one-time "Ready to work offline" notice.
4. **Install UI**: an in-app install button where the browser supports it, and Add to Home Screen instructions on iOS Safari.
5. **App-like behaviour**: safe-area insets, no overscroll bounce in standalone mode, no tap-highlight flash, a `100dvh` layout, and a title bar region for Window Controls Overlay.
6. **Local persistence**: transcript, scene edits, aspect ratio, and export choices are saved in `localStorage` on this device and restored on the next launch.
7. **OS integration**: manifest shortcuts, a Web Share Target for text, and a launch handler that focuses the existing window.

SceneBeat stays a static client-side application with no accounts, no backend, and no network requests. The site is expected to be hosted as a static site, probably under a sub-path such as `https://zh30.github.io/scenebeat/`, so every app URL must work both at `/` (dev server and preview) and under a sub-path.

**Implementation preference (for the design, not a requirement):** `vite-plugin-pwa` (Workbox, `injectRegister: false`, `registerType: 'prompt'`) as a devDependency is acceptable. No new runtime dependencies beyond what that plugin's virtual register module needs.

**Testable pure logic.** The following areas are pure and deterministic and are the targets of correctness properties in the design (property numbering continues from P52): saved-work serialization and parsing (round trip and corruption tolerance), share-target parameter to transcript mapping, launch parameter parsing, the install-UI state machine, update-prompt gating, and manifest and base-path consistency. Criteria that state a property over all inputs are marked with the property kind in parentheses.

## Glossary

- **SceneBeat**, **Transcript_Input**, **Player**, **Storyboard_List**, **Scene_Editor**, **Scene_Override**, **Scene_Template**, **Automatic_Scene**, **Aspect_Ratio**, **Export_Panel**, **Render_Job**: As defined in the glossaries of the `scenebeat-mvp` and `scenebeat-edit-export` specs.
- **PWA**: Progressive Web App; a web app with a Web_App_Manifest and a Service_Worker that browsers can install.
- **Web_App_Manifest**: The JSON file (`manifest.webmanifest`) that describes SceneBeat to the browser for installation.
- **Service_Worker**: The SceneBeat script that the browser runs in the background to serve the App_Shell from the Precache.
- **App_Shell**: Every file in the production build output: the HTML entry page, JavaScript and CSS bundles, the Web_App_Manifest, icons, screenshots, and every other static asset.
- **Precache**: The Cache Storage entries that the Service_Worker fills with the App_Shell during installation, versioned by file content.
- **Deployment_Base**: The URL path under which the production build is served, for example `/` or `/scenebeat/`. Always starts and ends with `/`.
- **Base_Relative_URL**: A URL in the build output that is relative (for example `./icons/icon-192.png`) and so resolves under any Deployment_Base, as opposed to a root-absolute URL starting with `/`.
- **Production_Build**: The output of `pnpm build`, served by a static file server or `pnpm preview`.
- **Dev_Server**: The Vite development server started by `pnpm dev`.
- **Standalone_Mode**: SceneBeat running in an installed app window, detected by the `display-mode: standalone` or `display-mode: window-controls-overlay` media query, or by `navigator.standalone === true` on iOS.
- **Window_Controls_Overlay**: The `window-controls-overlay` display mode, in which the app content extends into the title bar and the operating system window controls overlay it.
- **Title_Bar_Region**: The SceneBeat header area that, in Window_Controls_Overlay, occupies the `titlebar-area-*` region, can drag the window, and keeps content clear of the window controls.
- **Install_Prompt_Event**: The browser `beforeinstallprompt` event, which SceneBeat captures and later uses to show the native install dialog.
- **Install_UI**: The SceneBeat header control that offers installation: an "Install app" button, or iOS Add to Home Screen instructions.
- **Install_State**: The state of the Install_UI: `hidden`, `install-available`, `ios-instructions`, or `installed`.
- **Install_State_Machine**: The pure SceneBeat module that computes the Install_State from platform signals and user actions.
- **iOS_Safari**: Safari on iPhone or iPad, which supports Add to Home Screen but does not fire the Install_Prompt_Event.
- **Update_Available**: The condition in which a new Service_Worker version is installed and waiting to take control.
- **Update_Prompt**: The non-blocking SceneBeat notice "New version available" with a "Reload" button and a "Later" button.
- **Update_Gate**: The pure SceneBeat module that decides whether the Update_Prompt is visible and whether its "Reload" button is enabled.
- **Editing_Session**: The period during which a Scene_Editor text field is open for editing.
- **Offline_Ready_Notice**: The one-time SceneBeat notice "Ready to work offline" shown after the first Service_Worker installation.
- **Saved_Work**: The record SceneBeat stores on the device: transcript text, Scene_Overrides, Aspect_Ratio, export format, and subtitle format.
- **Saved_Work_Key**: The versioned `localStorage` key `scenebeat:work:v1` under which Saved_Work is stored.
- **Work_Serializer**: The pure SceneBeat module that converts Saved_Work into a JSON string.
- **Work_Parser**: The pure SceneBeat module that converts a stored string into Saved_Work, or reports that the string is not valid Saved_Work.
- **Work_Store**: The SceneBeat module that reads and writes Saved_Work through an injected storage object (the `localStorage` interface).
- **Save_Limit**: 1,000,000 UTF-16 code units, the maximum length of a serialized Saved_Work string that the Work_Store writes.
- **Launch_Params**: The query parameters of the URL that SceneBeat is opened or launched with.
- **Launch_Intent**: The result of parsing Launch_Params: `none`, `new-transcript`, `load-sample`, or `share` with a Shared_Transcript.
- **Launch_Parser**: The pure SceneBeat module that converts Launch_Params into a Launch_Intent.
- **Shared_Transcript**: The transcript text that the Launch_Parser builds from the Web Share Target `title`, `text`, and `url` parameters.
- **Replace_Confirmation**: The SceneBeat dialog that asks "Replace your current transcript?" with the buttons "Replace" and "Keep current".
- **Notice_Area**: The SceneBeat region with `role="status"` where non-blocking notices (Update_Prompt, Offline_Ready_Notice, persistence notices) appear.

## Requirements

### Requirement 1: Web App Manifest

**User Story:** As a creator, I want my browser to recognise SceneBeat as an installable app, so that I can install it and open it like a native app.

#### Acceptance Criteria

1. THE Production_Build SHALL include a Web_App_Manifest named `manifest.webmanifest`, linked from the HTML entry page with `<link rel="manifest">` using a Base_Relative_URL.
2. THE Web_App_Manifest SHALL set `name` to `SceneBeat`, `short_name` to `SceneBeat`, and `description` to the same text as the HTML entry page `<meta name="description">`.
3. THE Web_App_Manifest SHALL set `id`, `start_url`, and `scope` to Base_Relative_URLs that each resolve to the Deployment_Base.
4. THE Web_App_Manifest SHALL set `display` to `standalone` and `display_override` to `["window-controls-overlay", "standalone"]`.
5. THE Web_App_Manifest SHALL set `theme_color` and `background_color` to `#121110`, the value of the `--sb-bg` colour in `src/styles/app.css`.
6. THE Web_App_Manifest SHALL set `orientation` to `any`, `lang` to `en`, `dir` to `ltr`, and `categories` to `["productivity", "utilities"]`.
7. THE Web_App_Manifest SHALL list the icons of Requirement 2 and the screenshots of Requirement 2 with their `src`, `sizes`, `type`, and (for icons) `purpose` fields.
8. THE Web_App_Manifest SHALL declare the `shortcuts` of Requirement 14, the `share_target` of Requirement 15, and the `launch_handler` of Requirement 16.

### Requirement 2: Icons and Screenshots

**User Story:** As a creator, I want SceneBeat to have a clear icon and preview screenshots, so that it looks like a real app on my home screen, dock, and install dialog.

#### Acceptance Criteria

1. THE SceneBeat repository SHALL contain committed icon files derived from the existing orange play-mark (an `#ff8a3d` rounded square with a `#1a0f06` play triangle): an SVG favicon, a 192x192 PNG icon, a 512x512 PNG icon, a 512x512 maskable PNG icon, and a 180x180 PNG Apple touch icon.
2. THE Web_App_Manifest SHALL declare the 192x192 and 512x512 PNG icons with `purpose` `any` and the maskable 512x512 PNG icon with `purpose` `maskable`.
3. THE maskable icon SHALL draw the play-mark entirely inside the central circle whose diameter is 80% of the icon width, on a full-bleed `#121110` background.
4. THE SceneBeat repository SHALL contain two committed PNG screenshots of the app: one with `form_factor` `wide` at 1280x720 pixels and one with `form_factor` `narrow` at 750x1334 pixels, each declared in the Web_App_Manifest with a `label`.
5. FOR ALL icon and screenshot entries in the Web_App_Manifest, THE file referenced by `src` SHALL exist in the Production_Build, and the pixel dimensions stored in the PNG header SHALL equal the declared `sizes` (invariant).
6. THE SceneBeat build SHALL use only the committed icon and screenshot files, with no network access and no image generation step during `pnpm build`.

### Requirement 3: Platform Meta Tags

**User Story:** As a creator on iOS or Android, I want the installed app to show the right name, icon, and status bar, so that it fits in with my other apps.

#### Acceptance Criteria

1. THE HTML entry page SHALL link the SVG favicon with `<link rel="icon" type="image/svg+xml">` and the Apple touch icon with `<link rel="apple-touch-icon" sizes="180x180">`, both using Base_Relative_URLs.
2. THE HTML entry page SHALL include `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, and `<meta name="apple-mobile-web-app-title" content="SceneBeat">`.
3. THE HTML entry page SHALL include `<meta name="theme-color" content="#121110">`, equal to the Web_App_Manifest `theme_color`.
4. THE HTML entry page SHALL set the viewport meta tag to `width=device-width, initial-scale=1, viewport-fit=cover`.

### Requirement 4: Deployment Base Path

**User Story:** As the maintainer, I want the same build to work at the site root and under a sub-path, so that I can host SceneBeat on GitHub Pages at `/scenebeat/` and still use `pnpm dev` and `pnpm preview` at `/`.

#### Acceptance Criteria

1. THE Production_Build SHALL reference every App_Shell file (scripts, styles, manifest, icons, screenshots, Service_Worker) through Base_Relative_URLs.
2. THE Web_App_Manifest SHALL express `id`, `start_url`, `scope`, icon `src`, screenshot `src`, shortcut `url`, and `share_target.action` as Base_Relative_URLs.
3. THE SceneBeat app SHALL register the Service_Worker with a Base_Relative_URL and a scope equal to the Deployment_Base.
4. FOR ALL Deployment_Bases, resolving every URL of the Web_App_Manifest against the manifest URL under that Deployment_Base SHALL produce a URL that starts with that Deployment_Base (invariant).
5. WHEN the Production_Build is served at the Deployment_Base `/` and at the Deployment_Base `/scenebeat/`, THE SceneBeat app SHALL load, install, and work offline in both cases with the same build output.

### Requirement 5: Offline App Shell

**User Story:** As a creator, I want SceneBeat to open and work fully without a connection after my first visit, so that I can use it like a local app on a plane or with bad Wi-Fi.

#### Acceptance Criteria

1. WHEN the Service_Worker installs, THE Service_Worker SHALL store every App_Shell file in the Precache.
2. WHILE the device is offline and the Precache is filled, THE SceneBeat app SHALL load and provide every feature of the `scenebeat-mvp` and `scenebeat-edit-export` specs, including video export.
3. WHEN the browser requests an App_Shell file, THE Service_Worker SHALL respond from the Precache.
4. WHEN the browser makes a navigation request inside the Web_App_Manifest `scope` for a URL that is not an App_Shell file, THE Service_Worker SHALL respond with the precached HTML entry page.
5. THE Service_Worker SHALL pass every request that is neither an App_Shell file nor a navigation request inside the `scope` to the browser unchanged, without adding the response to any cache.
6. WHEN a new Service_Worker version takes control, THE Service_Worker SHALL delete Precache entries that belong to earlier versions.

### Requirement 6: Service Worker Registration

**User Story:** As the maintainer, I want the Service_Worker to be active only in production builds, so that development never serves stale cached files.

#### Acceptance Criteria

1. THE Production_Build SHALL contain the Service_Worker script and the Web_App_Manifest in its output directory.
2. WHEN the SceneBeat app starts from the Production_Build in a browser that supports service workers, THE SceneBeat app SHALL register the Service_Worker once.
3. WHILE SceneBeat runs on the Dev_Server, THE SceneBeat app SHALL skip Service_Worker registration.
4. IF the browser does not support service workers or registration fails, THEN THE SceneBeat app SHALL continue to work online with every feature and SHALL skip the Update_Prompt and the Offline_Ready_Notice.
5. THE SceneBeat app SHALL perform Service_Worker registration through an injected dependency, so that tests can run SceneBeat without a real service worker.

### Requirement 7: Update Prompt

**User Story:** As a creator, I want to know when a new version is available and choose when to reload, so that an update never interrupts a render or an edit.

#### Acceptance Criteria

1. WHEN Update_Available becomes true, THE SceneBeat app SHALL show the Update_Prompt in the Notice_Area with the text "New version available", a "Reload" button, and a "Later" button.
2. THE Update_Prompt SHALL leave every other SceneBeat control usable while the Update_Prompt is visible.
3. THE SceneBeat app SHALL reload into the new version only when the user activates the "Reload" button.
4. WHILE a Render_Job is in progress, THE Update_Gate SHALL disable the "Reload" button and THE Update_Prompt SHALL show the note "Available after the video finishes".
5. WHILE an Editing_Session is open, THE Update_Gate SHALL disable the "Reload" button and THE Update_Prompt SHALL show the note "Finish editing to reload".
6. WHEN the user activates the enabled "Reload" button, THE SceneBeat app SHALL write the current Saved_Work through the Work_Store, then activate the waiting Service_Worker, then reload the page.
7. WHEN the user activates the "Later" button, THE SceneBeat app SHALL hide the Update_Prompt until the next launch of SceneBeat.
8. FOR ALL combinations of Update_Available, Render_Job in progress, Editing_Session open, and "Later" activated, THE Update_Gate SHALL report the Update_Prompt visible exactly when Update_Available is true and "Later" has not been activated, and SHALL report "Reload" enabled exactly when the Update_Prompt is visible, no Render_Job is in progress, and no Editing_Session is open (model-based).

### Requirement 8: Offline Ready Notice

**User Story:** As a creator, I want to be told once that SceneBeat now works offline, so that I know I can rely on it without a connection.

#### Acceptance Criteria

1. WHEN the Service_Worker finishes its first installation on a device and the Precache is filled, THE SceneBeat app SHALL show the Offline_Ready_Notice "Ready to work offline" in the Notice_Area.
2. WHEN the user dismisses the Offline_Ready_Notice or 8 seconds pass after the Offline_Ready_Notice appears, THE SceneBeat app SHALL hide the Offline_Ready_Notice.
3. WHEN the Offline_Ready_Notice has been shown once, THE SceneBeat app SHALL record that fact in `localStorage` under the key `scenebeat:offline-ready-shown:v1` and SHALL skip the Offline_Ready_Notice on later launches.

### Requirement 9: Install UI

**User Story:** As a creator, I want an obvious way to install SceneBeat from inside the app, so that I don't have to hunt through browser menus.

#### Acceptance Criteria

1. WHEN the browser fires the Install_Prompt_Event, THE SceneBeat app SHALL capture the Install_Prompt_Event and THE Install_UI SHALL show an "Install app" button.
2. WHEN the user activates the "Install app" button, THE SceneBeat app SHALL show the browser install dialog through the captured Install_Prompt_Event.
3. WHEN the browser install dialog closes, THE Install_UI SHALL hide the "Install app" button whether the user accepted or declined, because the captured Install_Prompt_Event can be used only once.
4. WHEN the browser fires the `appinstalled` event, THE Install_State_Machine SHALL move to `installed` and THE Install_UI SHALL hide.
5. WHILE SceneBeat runs in Standalone_Mode, THE Install_State_Machine SHALL report `installed` and THE Install_UI SHALL stay hidden.
6. WHILE SceneBeat runs in iOS_Safari outside Standalone_Mode, THE Install_UI SHALL show the instructions "Install: tap Share, then Add to Home Screen" with a dismiss button.
7. WHILE SceneBeat runs in a browser that is neither iOS_Safari nor has fired the Install_Prompt_Event, THE Install_State_Machine SHALL report `hidden`.
8. WHEN the user dismisses the Install_UI, THE SceneBeat app SHALL record the dismissal in `localStorage` under the key `scenebeat:install-dismissed:v1` and THE Install_State_Machine SHALL report `hidden` on this launch and on later launches.
9. FOR ALL sequences of platform signals (Standalone_Mode, iOS_Safari, Install_Prompt_Event fired, install dialog closed, `appinstalled` fired) and user dismissals, THE Install_State_Machine SHALL report exactly one Install_State, SHALL report `installed` whenever Standalone_Mode is true or `appinstalled` has fired, and SHALL report `hidden` whenever the dismissal is recorded and the state is not `installed` (invariant).

### Requirement 10: App-Like Behaviour

**User Story:** As a creator using the installed app, I want SceneBeat to look and feel like a native app, so that it doesn't feel like a web page in a frame.

#### Acceptance Criteria

1. THE SceneBeat layout SHALL pad the app shell by the `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, and `env(safe-area-inset-left)` insets, so that no control sits under a notch, rounded corner, or home indicator.
2. THE SceneBeat layout SHALL size the app shell with a minimum height of `100dvh`, with `100vh` as the fallback for browsers without dynamic viewport units.
3. WHILE SceneBeat runs in Standalone_Mode, THE SceneBeat styles SHALL set `overscroll-behavior: none` on the document, so that pull-to-refresh and overscroll bounce are off for the app shell.
4. WHILE SceneBeat runs in a browser tab, THE SceneBeat styles SHALL keep the browser default overscroll behaviour.
5. THE SceneBeat styles SHALL set `-webkit-tap-highlight-color: transparent` on buttons, links, and other interactive controls, and SHALL show the existing visible `:focus-visible` outline on those controls.
6. THE SceneBeat styles SHALL set `user-select: none` on buttons, chips, and segmented controls, and SHALL keep text selection available in the Transcript_Input, the Scene_Editor text field, and scene text in the Storyboard_List.
7. THE SceneBeat app SHALL keep the effective `theme-color` equal to `#121110`, the background of the dark theme, in every display mode.

### Requirement 11: Window Controls Overlay

**User Story:** As a desktop creator, I want the installed app to use the title bar space, so that the window looks clean and native.

#### Acceptance Criteria

1. WHILE SceneBeat runs in Window_Controls_Overlay, THE Title_Bar_Region SHALL position itself within the `env(titlebar-area-x)`, `env(titlebar-area-y)`, `env(titlebar-area-width)`, and `env(titlebar-area-height)` area.
2. WHILE SceneBeat runs in Window_Controls_Overlay, THE Title_Bar_Region SHALL show the SceneBeat brand mark and name and SHALL let the user drag the window by any part of the Title_Bar_Region that holds no control (`app-region: drag`).
3. WHILE SceneBeat runs in Window_Controls_Overlay, THE Title_Bar_Region SHALL mark every button and link inside the Title_Bar_Region as not draggable (`app-region: no-drag`) so that each control stays clickable.
4. WHILE SceneBeat runs in Window_Controls_Overlay, THE SceneBeat layout SHALL place all content below or beside the window controls, so that no content is covered by the window controls.
5. WHILE SceneBeat runs outside Window_Controls_Overlay, THE SceneBeat header SHALL keep the layout of the `scenebeat-edit-export` spec.

### Requirement 12: Saved Work Format

**User Story:** As the maintainer, I want saved work to have a strict, versioned format, so that a damaged or outdated entry can never break the app.

#### Acceptance Criteria

1. THE Work_Serializer SHALL convert Saved_Work into a JSON object with the keys, in this order, `version` (the number `1`), `transcript` (string), `overrides` (object), `aspectRatio` (one of `16:9`, `9:16`, `1:1`, `4:5`), `exportFormat` (one of `video`, `subtitles`, `storyboard-json`), and `subtitleFormat` (one of `srt`, `vtt`).
2. THE Work_Serializer SHALL write each Scene_Override with the keys `sourceText`, `rank`, and, when present, `editedText` and `manualTemplate`, under the key that `overrideKey(sourceText, rank)` in `src/core/overrides.ts` produces.
3. WHEN the Work_Parser receives a string produced by the Work_Serializer, THE Work_Parser SHALL return the Saved_Work that was serialized.
4. FOR ALL valid Saved_Work values, parsing the Work_Serializer output with the Work_Parser and serializing the result again SHALL produce the same string (round-trip).
5. IF the stored string is not valid JSON, is not a JSON object, or has a `version` other than `1`, THEN THE Work_Parser SHALL report the string as not valid Saved_Work.
6. IF the `transcript` field is not a string, THEN THE Work_Parser SHALL report the string as not valid Saved_Work.
7. IF a Scene_Override entry has a non-string `sourceText`, a `rank` that is not a non-negative integer, a key different from `overrideKey(sourceText, rank)`, an `editedText` that is not a non-empty string, a `manualTemplate` that is not one of the four Scene_Templates, or neither `editedText` nor `manualTemplate`, THEN THE Work_Parser SHALL drop that entry and keep the other entries.
8. IF `aspectRatio`, `exportFormat`, or `subtitleFormat` holds a value outside its allowed set, THEN THE Work_Parser SHALL use the default for that field (`16:9`, the default export format of the Export_Panel, and `srt` respectively) and keep the other fields.
9. FOR ALL strings, THE Work_Parser SHALL return either valid Saved_Work or a not-valid result, without throwing (error condition).
10. FOR ALL strings that the Work_Parser accepts, every field of the returned Saved_Work SHALL satisfy the constraints of criteria 1 and 2 (invariant).

### Requirement 13: Saving and Restoring Work

**User Story:** As a creator, I want SceneBeat to remember my transcript and edits on this device, so that closing and reopening the app picks up where I left off.

#### Acceptance Criteria

1. WHEN the transcript text, the Scene_Overrides, the Aspect_Ratio, the export format, or the subtitle format changes, THE Work_Store SHALL write the current Saved_Work under the Saved_Work_Key 500 milliseconds after the last such change.
2. WHEN the page becomes hidden (`visibilitychange` to `hidden`) or is unloaded (`pagehide`) with a write still pending, THE Work_Store SHALL write the pending Saved_Work immediately.
3. WHEN SceneBeat starts and the Saved_Work_Key holds a string that the Work_Parser accepts, THE SceneBeat app SHALL restore the transcript text, Scene_Overrides, Aspect_Ratio, export format, and subtitle format from that Saved_Work instead of loading the sample transcript.
4. WHEN SceneBeat restores Saved_Work, THE SceneBeat app SHALL reconcile the restored Scene_Overrides against the Automatic_Scenes of the restored transcript in the same way as after any transcript change.
5. IF the restored export format is `video` and video export is unsupported in the current browser, THEN THE SceneBeat app SHALL use the export format that the Export_Panel selects by default for that browser.
6. IF the Saved_Work_Key is empty or holds a string that the Work_Parser reports as not valid, THEN THE SceneBeat app SHALL start with the sample transcript and default settings, as in the `scenebeat-edit-export` spec, and the next write SHALL replace the stored string.
7. IF the serialized Saved_Work is longer than the Save_Limit, THEN THE Work_Store SHALL keep the previously stored string and THE SceneBeat app SHALL show the notice "This transcript is too large to save on this device" in the Notice_Area.
8. IF `localStorage` is unavailable or a write throws (for example a quota error), THEN THE SceneBeat app SHALL keep working without saving and SHALL show the notice "Your work can't be saved in this browser" in the Notice_Area once per launch.
9. WHEN the user activates "Clear" in the Transcript_Input, THE Work_Store SHALL remove the Saved_Work_Key, and the next write SHALL store the cleared state.
10. THE SceneBeat app SHALL show the text "Saved on this device only" next to the Transcript_Input.
11. THE Work_Store SHALL access storage only through an injected object with the `getItem`, `setItem`, and `removeItem` methods, so that tests can use an in-memory storage.

### Requirement 14: App Shortcuts

**User Story:** As a creator, I want shortcuts on the app icon, so that I can jump straight to a fresh transcript or the sample.

#### Acceptance Criteria

1. THE Web_App_Manifest SHALL declare a shortcut named "New transcript" whose `url` is the Deployment_Base with the query `?action=new`, and a shortcut named "Load sample" whose `url` is the Deployment_Base with the query `?action=sample`, each with the 192x192 icon.
2. WHEN the Launch_Params contain `action=new`, THE Launch_Parser SHALL return the Launch_Intent `new-transcript`.
3. WHEN the Launch_Params contain `action=sample`, THE Launch_Parser SHALL return the Launch_Intent `load-sample`.
4. WHEN SceneBeat handles the Launch_Intent `new-transcript`, THE SceneBeat app SHALL apply the same effect as "Clear" in the Transcript_Input and SHALL move keyboard focus to the Transcript_Input.
5. WHEN SceneBeat handles the Launch_Intent `load-sample`, THE SceneBeat app SHALL apply the same effect as "Load sample" in the Transcript_Input.
6. IF SceneBeat handles the Launch_Intent `new-transcript` or `load-sample` while the current transcript is non-empty after trimming and differs from the result of that Launch_Intent, THEN THE SceneBeat app SHALL show the Replace_Confirmation and apply the Launch_Intent only when the user chooses "Replace".

### Requirement 15: Web Share Target

**User Story:** As a creator, I want to share text from another app straight into SceneBeat, so that I can turn a copied transcript into scenes without copy and paste.

#### Acceptance Criteria

1. THE Web_App_Manifest SHALL declare a `share_target` with `action` equal to the Deployment_Base, `method` `GET`, and `params` mapping `title` to `title`, `text` to `text`, and `url` to `url`.
2. WHEN the Launch_Params contain a `title`, `text`, or `url` parameter, THE Launch_Parser SHALL return the Launch_Intent `share` with a Shared_Transcript, regardless of any `action` parameter.
3. THE Launch_Parser SHALL build the Shared_Transcript from the trimmed `text` value, then prepend the trimmed `title` value followed by a line break when that value is non-empty and not contained in the result so far, then append a line break followed by the trimmed `url` value when that value is non-empty and not contained in the result so far.
4. IF every `title`, `text`, and `url` value is empty after trimming, THEN THE Launch_Parser SHALL return the Launch_Intent `none`.
5. FOR ALL Launch_Params, THE Launch_Parser SHALL return exactly one Launch_Intent without throwing, and every non-empty trimmed `text` value SHALL appear unchanged inside the Shared_Transcript (invariant).
6. FOR ALL Launch_Params with no `title`, `text`, `url`, or `action` parameter, THE Launch_Parser SHALL return the Launch_Intent `none` (invariant).
7. WHEN SceneBeat handles the Launch_Intent `share` while the current transcript is empty after trimming or equals the Shared_Transcript, THE SceneBeat app SHALL set the transcript to the Shared_Transcript.
8. WHEN SceneBeat handles the Launch_Intent `share` while the current transcript is non-empty after trimming and differs from the Shared_Transcript, THE SceneBeat app SHALL show the Replace_Confirmation.
9. WHEN the user chooses "Replace" in the Replace_Confirmation, THE SceneBeat app SHALL set the transcript to the Shared_Transcript and reconcile the Scene_Overrides as for any transcript change.
10. WHEN the user chooses "Keep current" in the Replace_Confirmation, THE SceneBeat app SHALL discard the Shared_Transcript and keep the transcript, Scene_Overrides, and settings unchanged.

### Requirement 16: Launch Handling

**User Story:** As a creator, I want shortcuts and shared text to reuse my open SceneBeat window, so that I don't end up with several copies or lose a render in progress.

#### Acceptance Criteria

1. THE Web_App_Manifest SHALL declare `launch_handler` with `client_mode` `focus-existing`.
2. WHEN SceneBeat starts, THE SceneBeat app SHALL restore Saved_Work first and then handle the Launch_Intent of the start URL.
3. WHERE the browser provides `window.launchQueue`, WHEN a launch delivers a target URL to the existing SceneBeat window, THE SceneBeat app SHALL handle the Launch_Intent of that target URL without reloading the page.
4. WHILE a Render_Job is in progress, THE SceneBeat app SHALL defer any Launch_Intent other than `none` until the Render_Job completes, is cancelled, or fails.
5. WHEN SceneBeat has handled a Launch_Intent other than `none`, THE SceneBeat app SHALL remove the `action`, `title`, `text`, and `url` parameters from the address with `history.replaceState`, so that a reload does not handle the same Launch_Intent again.

### Requirement 17: Quality Gates

**User Story:** As the maintainer, I want automated checks for the PWA setup, so that a later change cannot silently break installability or offline use.

#### Acceptance Criteria

1. THE SceneBeat test suite (`pnpm test`) SHALL verify that the Web_App_Manifest contains every field and value of Requirements 1, 14, 15, and 16.
2. THE SceneBeat test suite SHALL verify that every icon and screenshot file of Requirement 2 exists in the repository and that its PNG header dimensions match the declared size.
3. THE SceneBeat test suite SHALL verify that the HTML entry page contains the link and meta tags of Requirement 3.
4. THE SceneBeat test suite SHALL verify the base-path invariant of Requirement 4.4 for the Deployment_Bases `/` and `/scenebeat/` and for generated Deployment_Bases.
5. THE SceneBeat test suite SHALL verify that the SceneBeat app registers the Service_Worker in a production configuration and skips registration in a development configuration.
6. WHEN `pnpm build` completes, THE Production_Build SHALL contain `manifest.webmanifest`, the Service_Worker script, and a Precache list that includes the HTML entry page, every JavaScript and CSS bundle, and every icon.
7. THE SceneBeat repository SHALL provide a command that checks a finished Production_Build for the files of criterion 6 and for root-absolute App_Shell URLs, and exits with code 0 when the build passes and 1 otherwise.
8. THE SceneBeat test suite SHALL keep running in jsdom without a real service worker, Install_Prompt_Event, `launchQueue`, or `localStorage` persistence between tests.

### Requirement 18: Scope Boundaries

**User Story:** As the maintainer, I want the PWA scope written down, so that the feature stays small and keeps SceneBeat free of network use.

#### Acceptance Criteria

1. THE SceneBeat app SHALL keep every feature working without network requests.
2. THE Service_Worker SHALL limit its own network requests to fetching App_Shell files from the Deployment_Base.
3. THE SceneBeat app SHALL keep Saved_Work only in `localStorage` on the device, with no accounts, no backend, and no synchronisation between devices.
4. THE SceneBeat scope SHALL exclude push notifications, background sync, periodic background sync, and runtime caching of any URL outside the App_Shell.
5. THE SceneBeat scope SHALL exclude `file_handlers` and `protocol_handlers` in the Web_App_Manifest, because SceneBeat has no storyboard import feature; opening `.storyboard.json` files from the operating system is out of scope.
6. THE SceneBeat scope SHALL exclude a light theme, so the `theme-color` and manifest colours follow the single dark theme.
7. THE SceneBeat scope SHALL exclude coordination of Saved_Work between several open SceneBeat windows; the most recent write under the Saved_Work_Key wins.
8. THE SceneBeat build SHALL add no runtime dependencies other than the service-worker registration helper that the chosen PWA build plugin provides.
