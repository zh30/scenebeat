# Requirements Document

## Introduction

This feature extends the SceneBeat MVP (`.kiro/specs/scenebeat-mvp/`) so that non-technical creators get output they can use directly in their editing tools. It adds three capabilities:

1. **Scene editing**: in the scene list, the user can change a scene's template, edit a scene's text, and reset a scene to its automatic result. Edits flow into the Player and into every export.
2. **Subtitle export**: SRT and WebVTT files with one cue per scene, timed cumulatively from scene durations, for import into CapCut/剪映, Premiere Pro, DaVinci Resolve, and YouTube.
3. **Video export**: a silent video rendered in the browser by drawing each scene to a canvas and recording the canvas with MediaRecorder, in a selectable aspect ratio (16:9, 9:16, 1:1, 4:5). The step-2 preview follows the selected aspect ratio.

**Scope change.** MVP Requirement 10 placed video rendering out of scope. This spec deliberately brings in-browser video rendering into scope. Everything else in MVP Requirement 10 still holds: SceneBeat remains a static client-side application with no user accounts, no backend service, no network requests, and no audio processing. Native project formats for video editors (CapCut drafts, Premiere `.prproj`, DaVinci `.drp`, FCPXML) remain out of scope; SRT is the import path for those editors.

All MVP requirements remain in force except where this document explicitly changes them. Changed MVP behavior: the storyboard JSON format version becomes `"1.1"` with a new per-scene `templateSource` field (Requirement 5), and the step-3 download area becomes a choice of export formats (Requirement 9).

Pure, deterministic logic introduced by this spec (template data derivation, override merge, subtitle timing and formatting, aspect-ratio dimensions, frame planning, filename formatting, versioned serialization and validation) belongs in `src/core/` and is the target of correctness properties in the design. Criteria that state a property over all inputs are marked with the property kind in parentheses.

## Glossary

- **SceneBeat**: The client-side web application, as defined in the MVP spec.
- **Sentence**, **Scene**, **Scene_Template**, **Storyboard**, **Display_Duration**, **Player**, **Storyboard_List**, **Storyboard_Serializer**, **Storyboard_Parser**, **Storyboard_Validator**, **Transcript_Input**, **Sentence_Splitter**, **Template_Assigner**, **Validation_Hook**: As defined in the MVP spec glossary.
- **Automatic_Scene**: The Scene that the MVP pipeline (Sentence_Splitter, Template_Assigner, duration computation) produces for a Sentence, before any Scene_Override is applied.
- **Source_Text**: The Sentence text of an Automatic_Scene, exactly as produced by the Sentence_Splitter.
- **Scene_Editor**: The controls inside each Storyboard_List entry for choosing a Scene_Template, editing the Scene text, and resetting the Scene.
- **Scene_Override**: A per-scene record of user edits, consisting of the Source_Text it applies to, an optional Edited_Text, and an optional Manual_Template.
- **Edited_Text**: Replacement Scene text entered by the user in the Scene_Editor.
- **Manual_Template**: A Scene_Template chosen by the user in the Scene_Editor, which takes precedence over the Template_Assigner result.
- **Effective_Text**: The Edited_Text of a Scene when a Scene_Override supplies one, otherwise the Source_Text.
- **Template_Source**: `"manual"` when a Scene's Scene_Template is a Manual_Template, otherwise `"auto"`.
- **Override_Merger**: The pure SceneBeat module that combines a list of Automatic_Scenes with the current Scene_Overrides into the edited Storyboard.
- **Data_Deriver**: The pure SceneBeat module that produces the template-specific highlighted data (`value`, `keywords`, `quote`, or `label`) for a given Scene_Template and a given non-empty text.
- **Leading_Label**: The first whitespace-delimited token of a text with leading and trailing punctuation removed, truncated to its first 12 characters (Unicode code points); when punctuation removal leaves an empty token, the first 12 characters of the trimmed text.
- **Occurrence_Rank**: For a Sentence in a list of Sentences, the count of earlier Sentences in the same list with identical text (the first occurrence has rank 0).
- **Export_Panel**: The step-3 UI area where the user chooses an export format and starts the export.
- **Export_Format**: One of `video`, `subtitles-srt`, `subtitles-vtt`, `storyboard-json`.
- **Subtitle_Cue**: A record with a 1-based cue number, a start time and end time in milliseconds, and cue text.
- **Subtitle_Builder**: The pure SceneBeat module that converts a Storyboard into a list of Subtitle_Cues.
- **SRT_Formatter**: The pure SceneBeat module that converts a list of Subtitle_Cues into SubRip (`.srt`) text.
- **VTT_Formatter**: The pure SceneBeat module that converts a list of Subtitle_Cues into WebVTT (`.vtt`) text.
- **Subtitle_Parser**: The pure SceneBeat module that converts SRT or WebVTT text produced by the SRT_Formatter or VTT_Formatter back into a list of Subtitle_Cues.
- **SRT_Timestamp**: A time formatted as `HH:MM:SS,mmm` (hours at least two digits, minutes and seconds two digits, milliseconds three digits).
- **VTT_Timestamp**: A time formatted as `HH:MM:SS.mmm` with the same field widths as an SRT_Timestamp.
- **Aspect_Ratio**: One of four output shapes with fixed pixel dimensions: `16:9` (1920x1080), `9:16` (1080x1920), `1:1` (1080x1080), `4:5` (1080x1350).
- **Ratio_Tag**: The file-name form of an Aspect_Ratio: `16x9`, `9x16`, `1x1`, `4x5`.
- **Aspect_Ratio_Selector**: The UI control where the user chooses the Aspect_Ratio.
- **Video_Renderer**: The SceneBeat module that draws Scenes onto a canvas and records the canvas into a video file.
- **Frame_Planner**: The pure SceneBeat module that maps a Storyboard and a frame rate to the ordered list of frames to draw, each frame naming a Scene index and the elapsed time within that Scene.
- **Canvas_Layout**: The pure SceneBeat module that computes text lines, font sizes, and positions for drawing a Scene at a given Aspect_Ratio, given a text-measuring function.
- **Safe_Area**: The region of a video frame inset by 6% of the frame width on the left and right and 6% of the frame height on the top and bottom.
- **Video_Container**: The recorded file format: `mp4` (H.264 video) or `webm`.
- **Render_Job**: One run of the Video_Renderer from start until completion, cancellation, or failure.
- **Motion_Transition**: The MVP scene-enter transition (transform plus opacity) lasting 450 milliseconds.
- **Export_Timestamp**: The local date and time at which the user starts an export, formatted as `YYYYMMDD-HHmmss`, as in MVP Requirement 9.

## Requirements

### Requirement 1: Scene Template Override

**User Story:** As a content creator, I want to change the template of any scene, so that each scene uses the layout I think fits best.

#### Acceptance Criteria

1. THE Scene_Editor SHALL offer a template choice listing all four Scene_Templates for each Scene in the Storyboard_List.
2. THE Scene_Editor SHALL show the Scene's current Scene_Template as the selected choice and SHALL label the Scene as "Auto" when the Template_Source is `"auto"` and as "Edited" when the Scene has a Scene_Override.
3. WHEN the user chooses a Scene_Template for a Scene, THE SceneBeat SHALL record the choice as the Manual_Template of that Scene's Scene_Override, including when the chosen Scene_Template equals the automatic one.
4. WHEN a Manual_Template is recorded, THE SceneBeat SHALL set the Scene's Scene_Template to the Manual_Template, set the Scene's data to the Data_Deriver result for the Manual_Template and the Effective_Text, and set the Template_Source to `"manual"`.
5. WHEN a Scene_Override changes, THE Storyboard_List SHALL update the per-template counts to reflect the edited Storyboard.

### Requirement 2: Scene Text Editing

**User Story:** As a content creator, I want to correct the text of a scene, so that typos or transcription errors do not end up in my video.

#### Acceptance Criteria

1. THE Scene_Editor SHALL provide an edit action for each Scene that presents the Effective_Text in an editable field with Save and Cancel controls.
2. WHEN the user saves an edit, THE SceneBeat SHALL trim the entered text, replace each line break in the entered text with a single space, and record the result as the Edited_Text of the Scene's Scene_Override.
3. WHEN the user saves an edit, THE SceneBeat SHALL keep the edited Scene as exactly one Scene, including when the Edited_Text contains Sentence_Terminators.
4. WHEN an Edited_Text is recorded for a Scene whose Template_Source is `"auto"`, THE SceneBeat SHALL set the Scene's Scene_Template and data to the Template_Assigner result for the Edited_Text.
5. WHEN an Edited_Text is recorded for a Scene whose Template_Source is `"manual"`, THE SceneBeat SHALL keep the Manual_Template and set the Scene's data to the Data_Deriver result for the Manual_Template and the Edited_Text.
6. WHEN an Edited_Text is recorded, THE SceneBeat SHALL set the Scene's Display_Duration to the MVP Display_Duration (MVP Requirement 4) computed from the Edited_Text.
7. IF the user saves an edit whose text is empty after trimming, THEN THE SceneBeat SHALL keep the previous Effective_Text, keep the editable field open, and display the message "Scene text can't be empty."
8. WHEN the user cancels an edit, THE SceneBeat SHALL leave the Scene and its Scene_Override unchanged.
9. WHEN the saved Edited_Text equals the Source_Text, THE SceneBeat SHALL remove the Edited_Text from the Scene_Override.
10. THE SceneBeat SHALL leave the content of the Transcript_Input unchanged when a Scene is edited.

### Requirement 3: Reset Scene to Automatic

**User Story:** As a content creator, I want to undo my changes to a scene, so that I can return to SceneBeat's automatic choice.

#### Acceptance Criteria

1. WHILE a Scene has a Scene_Override, THE Scene_Editor SHALL display an enabled "Reset to automatic" control for that Scene.
2. WHILE a Scene has no Scene_Override, THE Scene_Editor SHALL disable the "Reset to automatic" control for that Scene.
3. WHEN the user activates "Reset to automatic" for a Scene, THE SceneBeat SHALL remove that Scene's Scene_Override and restore the Scene to its Automatic_Scene (text, Scene_Template, data, and Display_Duration) with Template_Source `"auto"`.
4. WHEN the user activates "Reset to automatic" for a Scene, THE SceneBeat SHALL leave the Scene_Overrides of all other Scenes unchanged.
5. FOR ALL lists of Automatic_Scenes, applying the Override_Merger with an empty set of Scene_Overrides SHALL produce Scenes equal to the Automatic_Scenes with Template_Source `"auto"` (identity property).

### Requirement 4: Template Data Derivation

**User Story:** As a content creator, I want any template I pick to show something sensible, so that a forced template never produces a blank or broken scene.

#### Acceptance Criteria

1. WHEN the Data_Deriver receives the `quote` Scene_Template and a text containing a quotation recognized by the Template_Assigner (MVP Requirement 3.2), THE Data_Deriver SHALL return the trimmed text inside the first such quotation as `quote`.
2. WHEN the Data_Deriver receives the `quote` Scene_Template and a text without a recognized quotation, THE Data_Deriver SHALL return the whole trimmed text as `quote`.
3. WHEN the Data_Deriver receives the `timeline` Scene_Template and a text containing a year, date, or sequence marker recognized by the Template_Assigner (MVP Requirement 3.3), THE Data_Deriver SHALL return the first such match as `label`.
4. WHEN the Data_Deriver receives the `timeline` Scene_Template and a text without a recognized year, date, or sequence marker, THE Data_Deriver SHALL return the Leading_Label of the text as `label`.
5. WHEN the Data_Deriver receives the `big-number` Scene_Template and a text containing a numeric value recognized by the Template_Assigner (MVP Requirement 3.4), THE Data_Deriver SHALL return the first such match as `value`.
6. WHEN the Data_Deriver receives the `big-number` Scene_Template and a text without a recognized numeric value, THE Data_Deriver SHALL return the Leading_Label of the text as `value`.
7. WHEN the Data_Deriver receives the `keyword-highlight` Scene_Template, THE Data_Deriver SHALL return between one and three keywords taken from the text as `keywords`, using the MVP keyword extraction (MVP Requirement 3.7).
8. FOR ALL Scene_Templates and all texts that are non-empty after trimming, THE Data_Deriver SHALL return data that has the data key required for that Scene_Template, has non-empty string values, and consists of substrings of the trimmed text (totality property).
9. FOR ALL texts that are non-empty after trimming, the Data_Deriver result for the Scene_Template chosen by the Template_Assigner SHALL equal the data chosen by the Template_Assigner (model-based property).
10. FOR ALL Scene_Templates and texts, calling the Data_Deriver twice with the same inputs SHALL return equal data (determinism property).

### Requirement 5: Storyboard JSON Version 1.1

**User Story:** As a developer, I want exported storyboards to record which templates the user chose, so that downstream tools can tell automatic choices from manual ones.

#### Acceptance Criteria

1. THE SceneBeat SHALL create every Storyboard with `version` equal to `"1.1"`.
2. WHERE a Storyboard has `version` `"1.1"`, THE Storyboard_Serializer SHALL write a `templateSource` string (`"auto"` or `"manual"`) on each Scene, placed directly after `template`, keeping the MVP key order for all other keys.
3. WHERE a Storyboard has `version` `"1.0"`, THE Storyboard_Serializer SHALL write each Scene without a `templateSource` key, producing the MVP format.
4. WHEN valid storyboard JSON text is provided, THE Storyboard_Parser SHALL preserve the `version` value and, for version `"1.1"`, each Scene's `templateSource` value.
5. WHEN a JSON value with `version` `"1.0"` and no `templateSource` keys satisfies the MVP structural rules (MVP Requirements 7 and 8), THE Storyboard_Validator SHALL report the value as valid.
6. WHEN a JSON value with `version` `"1.1"` satisfies the MVP structural rules and every Scene has a `templateSource` of `"auto"` or `"manual"`, THE Storyboard_Validator SHALL report the value as valid.
7. IF `version` is a string other than `"1.0"` or `"1.1"`, THEN THE Storyboard_Validator SHALL report an error at path `$.version` naming the unsupported value.
8. IF a Scene in a version `"1.1"` value lacks `templateSource` or has a value other than `"auto"` or `"manual"`, THEN THE Storyboard_Validator SHALL report an error at path `$.scenes[i].templateSource`, where `i` is the Scene index.
9. IF a Scene in a version `"1.0"` value has a `templateSource` key, THEN THE Storyboard_Validator SHALL report an error at path `$.scenes[i].templateSource` stating that the field requires version `"1.1"`.
10. FOR ALL valid Storyboards of version `"1.0"` or `"1.1"`, serializing then parsing then serializing SHALL produce JSON text identical to the first serialization (round-trip property).
11. FOR ALL transcripts and all sets of Scene_Overrides, THE Storyboard_Validator SHALL report the serialized edited Storyboard as valid (validator acceptance property).
12. WHEN the Validation_Hook runs on a storyboard JSON file, THE Validation_Hook SHALL accept both version `"1.0"` and version `"1.1"` files under the rules of this requirement.

### Requirement 6: Overrides Across Transcript Regeneration

**User Story:** As a content creator, I want my scene edits to survive small changes to the transcript, so that I don't redo work after fixing one sentence.

#### Acceptance Criteria

1. WHILE the content of the Transcript_Input is unchanged, THE SceneBeat SHALL keep every Scene_Override.
2. THE SceneBeat SHALL associate each Scene_Override with the Source_Text and the Occurrence_Rank of the Automatic_Scene the Scene_Override was created on.
3. WHEN the Storyboard is regenerated from changed Transcript_Input content (MVP Requirement 1.5), THE Override_Merger SHALL apply a Scene_Override to the new Automatic_Scene whose Source_Text and Occurrence_Rank both equal those of the Scene_Override.
4. WHEN the Storyboard is regenerated, THE SceneBeat SHALL discard each Scene_Override for which no new Automatic_Scene has an equal Source_Text and Occurrence_Rank.
5. WHEN the Storyboard is regenerated, THE SceneBeat SHALL produce new Scenes in the order of the new Sentences, with `index` values 0, 1, 2, … in that order.
6. WHEN the user activates "Load sample" or "Clear", THE SceneBeat SHALL treat the change as a regeneration under criteria 3 and 4.
7. FOR ALL lists of Automatic_Scenes and sets of Scene_Overrides, the number of Scenes produced by the Override_Merger SHALL equal the number of Automatic_Scenes (invariant property).
8. FOR ALL lists of Automatic_Scenes and sets of Scene_Overrides, each produced Scene SHALL equal either the corresponding Automatic_Scene (when no Scene_Override matches) or the Automatic_Scene with the matching Scene_Override applied (model-based property).
9. FOR ALL lists of Automatic_Scenes and sets of Scene_Overrides, applying the Override_Merger, then merging the retained Scene_Overrides again onto the same Automatic_Scenes, SHALL produce the same Scenes (idempotence property).
10. FOR ALL pairs of transcripts where the second transcript is the first with one Sentence changed, every Scene_Override on an unchanged Sentence whose Occurrence_Rank is also unchanged SHALL be retained (metamorphic property).

### Requirement 7: Edits in Preview and Playback

**User Story:** As a content creator, I want the preview to show my edits right away, so that I can check them before exporting.

#### Acceptance Criteria

1. WHEN a Scene_Override changes, THE Player SHALL render the edited Scene using the edited text, Scene_Template, and data.
2. WHEN a Scene_Override changes, THE Player SHALL stop playback and keep the current position index.
3. WHEN a Scene_Override changes, THE Player SHALL use the edited Display_Durations for subsequent playback.
4. THE Storyboard_List SHALL display the Effective_Text of each Scene.

### Requirement 8: Aspect Ratio Selection and Preview

**User Story:** As a content creator, I want to pick the video shape for my platform and see it in the preview, so that what I see is what I export.

#### Acceptance Criteria

1. THE Aspect_Ratio_Selector SHALL offer the four Aspect_Ratios, each labeled with the ratio and a platform hint: `16:9` "Landscape · YouTube", `9:16` "Portrait · TikTok, Reels, Shorts, 抖音", `1:1` "Square", `4:5` "Portrait post · Instagram".
2. WHEN SceneBeat first loads, THE Aspect_Ratio_Selector SHALL have `16:9` selected.
3. THE SceneBeat SHALL map each Aspect_Ratio to its pixel dimensions: `16:9` to 1920x1080, `9:16` to 1080x1920, `1:1` to 1080x1080, `4:5` to 1080x1350 (width x height).
4. FOR ALL Aspect_Ratios, the mapped pixel width divided by the mapped pixel height SHALL equal the ratio's first number divided by its second number, and both dimensions SHALL be even integers (invariant property).
5. WHEN the user selects an Aspect_Ratio, THE Player SHALL display the Scene stage with the selected Aspect_Ratio's width-to-height proportion within 1% while fitting inside the Player area.
6. WHEN the user selects an Aspect_Ratio, THE Player SHALL lay out Scene text with the same Canvas_Layout line breaks used by the Video_Renderer for that Aspect_Ratio.
7. WHEN the user selects an Aspect_Ratio, THE SceneBeat SHALL keep the current Storyboard, Scene_Overrides, and playback position unchanged.

### Requirement 9: Export Panel

**User Story:** As a beginner, I want the download step to explain each format in plain words, so that I pick the right file without knowing technical terms.

#### Acceptance Criteria

1. THE Export_Panel SHALL present the Export_Formats as one choice with these labels and descriptions: "Video" with "A ready-to-post video of your scenes (no sound)"; "Subtitles" with "Captions to import into CapCut / 剪映, Premiere Pro, DaVinci Resolve, or YouTube"; "Storyboard (JSON)" with "Scene data for developers and other tools".
2. WHILE "Subtitles" is chosen, THE Export_Panel SHALL offer a sub-choice between "SRT (works almost everywhere)" and "WebVTT (web players and YouTube)", with SRT selected by default.
3. WHEN SceneBeat first loads, THE Export_Panel SHALL have "Video" chosen.
4. WHILE "Video" is chosen, THE Export_Panel SHALL display the selected Aspect_Ratio and the total video length in seconds, equal to the sum of all Display_Durations divided by 1000 and rounded to one decimal place.
5. THE Export_Panel SHALL provide one Download control that starts the export of the chosen Export_Format.
6. WHILE the Storyboard contains zero Scenes, THE Export_Panel SHALL disable the Download control for every Export_Format.
7. WHEN the user activates the Download control, THE SceneBeat SHALL serialize the current edited Storyboard and validate the serialized value with the Storyboard_Validator before generating any file.
8. IF validation fails, THEN THE SceneBeat SHALL cancel the export, generate no file, and display the validation errors with their JSON paths, as in MVP Requirement 9.3.
9. WHEN the chosen Export_Format is `storyboard-json` and validation succeeds, THE SceneBeat SHALL download the storyboard JSON as specified in MVP Requirement 9.2, using the edited Storyboard.

### Requirement 10: Subtitle Cue Timing

**User Story:** As a content creator, I want subtitle times to match the scene timing, so that captions line up with the exported video.

#### Acceptance Criteria

1. THE Subtitle_Builder SHALL produce exactly one Subtitle_Cue per Scene, in Scene order, with cue numbers 1, 2, 3, … in that order.
2. THE Subtitle_Builder SHALL set the start time of the cue for Scene `i` to the sum of the Display_Durations of Scenes 0 through `i - 1` (0 for the first Scene).
3. THE Subtitle_Builder SHALL set the end time of the cue for Scene `i` to its start time plus the Display_Duration of Scene `i`.
4. THE Subtitle_Builder SHALL set the cue text to the Scene's Effective_Text.
5. FOR ALL Storyboards with at least one Scene, each cue's start time SHALL equal the previous cue's end time, and the last cue's end time SHALL equal the sum of all Display_Durations (invariant property).
6. FOR ALL Storyboards, every cue SHALL have an end time greater than its start time (invariant property).

### Requirement 11: SRT and WebVTT Formatting

**User Story:** As a content creator, I want subtitle files in standard formats, so that my editing tool imports them without errors.

#### Acceptance Criteria

1. THE SRT_Formatter SHALL format each time as an SRT_Timestamp, and THE VTT_Formatter SHALL format each time as a VTT_Timestamp.
2. FOR ALL integer millisecond values from 0 to 359,999,999, formatting as an SRT_Timestamp or VTT_Timestamp then parsing the timestamp SHALL return the original value (round-trip property).
3. FOR ALL pairs of integer millisecond values `a < b`, the formatted timestamp of `a` SHALL sort before the formatted timestamp of `b` in plain string comparison when both are below 360,000,000 (order-preservation property).
4. THE SRT_Formatter SHALL write each cue as the cue number line, a timing line `<start> --> <end>`, the cue text line, and one blank line, with cues in cue-number order.
5. THE VTT_Formatter SHALL start the text with the line `WEBVTT` followed by one blank line, then write each cue as the cue number line, a timing line `<start> --> <end>`, the cue text line, and one blank line.
6. THE VTT_Formatter SHALL replace `&` with `&amp;`, `<` with `&lt;`, and `>` with `&gt;` in cue text.
7. THE SRT_Formatter and VTT_Formatter SHALL use LF (`\n`) line endings and write cue text on a single line.
8. WHEN the SRT_Formatter receives an empty list of Subtitle_Cues, THE SRT_Formatter SHALL return an empty string, and WHEN the VTT_Formatter receives an empty list, THE VTT_Formatter SHALL return only the `WEBVTT` line and one blank line.
9. WHEN SRT text or WebVTT text produced by the SRT_Formatter or VTT_Formatter is provided, THE Subtitle_Parser SHALL return the list of Subtitle_Cues the text encodes.
10. FOR ALL lists of Subtitle_Cues built from Storyboards, formatting as SRT then parsing SHALL return the original cues, and formatting as WebVTT then parsing SHALL return the original cues (round-trip property).

### Requirement 12: Subtitle Download

**User Story:** As a content creator, I want to download a subtitle file with a clear name, so that I can find and import it.

#### Acceptance Criteria

1. WHEN the chosen Export_Format is `subtitles-srt` and validation succeeds, THE SceneBeat SHALL download the SRT_Formatter output as a file named `scenebeat-subtitles-<Export_Timestamp>.srt` with MIME type `application/x-subrip`.
2. WHEN the chosen Export_Format is `subtitles-vtt` and validation succeeds, THE SceneBeat SHALL download the VTT_Formatter output as a file named `scenebeat-subtitles-<Export_Timestamp>.vtt` with MIME type `text/vtt`.
3. THE SceneBeat SHALL encode subtitle files as UTF-8 without a byte-order mark.
4. FOR ALL dates, the subtitle file name SHALL match the pattern `^scenebeat-subtitles-\d{8}-\d{6}\.(srt|vtt)$` and encode the local year, month, day, hour, minute, and second of the date (filename property).

### Requirement 13: Video Frame Rendering

**User Story:** As a content creator, I want the video to look like the preview, so that I get the layouts and transitions I approved.

#### Acceptance Criteria

1. THE Video_Renderer SHALL draw frames on a canvas sized to the pixel dimensions of the selected Aspect_Ratio.
2. THE Video_Renderer SHALL draw each Scene using the visual layout of the Scene's Scene_Template (big number, keyword highlight, quote, timeline) with the colors and fonts of the Player.
3. THE Video_Renderer SHALL draw each Scene's Effective_Text and data, reflecting all Scene_Overrides at the moment the Render_Job starts.
4. THE Video_Renderer SHALL apply the Motion_Transition at the start of every Scene, including the first Scene, regardless of the user's reduced-motion preference.
5. THE Video_Renderer SHALL contain each Motion_Transition within the Display_Duration of the Scene it introduces, so that transitions add no time to the video.
6. THE Frame_Planner SHALL produce frames at 30 frames per second, where frame `k` represents time `k * 1000 / 30` milliseconds from the start of the video.
7. THE Frame_Planner SHALL produce `ceil(T * 30 / 1000)` frames, where `T` is the sum of all Display_Durations in milliseconds.
8. FOR ALL Storyboards, frame `k` SHALL name the Scene whose cue interval (Requirement 10) contains time `k * 1000 / 30`, using start-inclusive and end-exclusive intervals, and the elapsed time within that Scene (model-based property).
9. FOR ALL Storyboards, the Scene indices named by consecutive frames SHALL be non-decreasing, and every Scene with a Display_Duration of at least 34 milliseconds SHALL be named by at least one frame (invariant property).
10. THE Canvas_Layout SHALL place all Scene text inside the Safe_Area of the selected Aspect_Ratio.
11. IF Scene text does not fit inside the Safe_Area at the template's default font size, THEN THE Canvas_Layout SHALL use the largest font size, in steps of 10% of the default size down to 40% of the default size, at which the text fits.
12. IF Scene text does not fit inside the Safe_Area at 40% of the default font size, THEN THE Canvas_Layout SHALL use 40% of the default size, keep the lines that fit, and end the last kept line with `…`.
13. FOR ALL Scenes and Aspect_Ratios, every line produced by the Canvas_Layout SHALL measure no wider than the Safe_Area width, and the total line height SHALL be no taller than the Safe_Area height (invariant property).
14. THE Video_Renderer SHALL wait until the Player's fonts are loaded before drawing the first frame.

### Requirement 14: Video Recording and Download

**User Story:** As a content creator, I want a video file my phone and editor can open, so that I can post it or edit it further.

#### Acceptance Criteria

1. WHEN a Render_Job starts, THE Video_Renderer SHALL choose `mp4` as the Video_Container if MediaRecorder reports support for MP4 with H.264 video, and otherwise `webm` if MediaRecorder reports support for WebM.
2. THE Video_Renderer SHALL record the canvas stream at 30 frames per second with no audio track.
3. WHEN the chosen Export_Format is `video`, validation succeeds, and the Render_Job completes, THE SceneBeat SHALL download the recording as a file named `scenebeat-video-<Ratio_Tag>-<Export_Timestamp>.<mp4|webm>`, with MIME type `video/mp4` or `video/webm` matching the Video_Container.
4. FOR ALL Aspect_Ratios, Video_Containers, and dates, the video file name SHALL match the pattern `^scenebeat-video-(16x9|9x16|1x1|4x5)-\d{8}-\d{6}\.(mp4|webm)$`, with the Ratio_Tag of the selected Aspect_Ratio and the extension of the Video_Container (filename property).
5. THE Video_Renderer SHALL draw the planned frames on a schedule paced to real time, so that the recorded video length equals the sum of all Display_Durations within 250 milliseconds.
6. WHEN the Render_Job completes with `webm` as the Video_Container, THE Export_Panel SHALL display the note "Your browser saved this video as WebM. Most editors open it; to post on Instagram or TikTok, convert it to MP4 first."

### Requirement 15: Rendering Progress, Cancellation, and Failure

**User Story:** As a content creator, I want to see how far the video export has got and be able to stop it, so that I am never stuck waiting.

#### Acceptance Criteria

1. WHILE a Render_Job is running, THE Export_Panel SHALL display a progress bar and a percentage equal to the floor of 100 times the rendered time divided by the total video length, plus the text "Scene <current> / <total>".
2. WHILE a Render_Job is running, THE Export_Panel SHALL display the message "Keep this tab open while the video renders. It takes about as long as the video itself."
3. WHILE a Render_Job is running, THE SceneBeat SHALL disable the Transcript_Input, the "Load sample" and "Clear" controls, all Scene_Editor controls, the Aspect_Ratio_Selector, the Export_Format choice, the Download control, and the Player's Play, Pause, Previous, and Next controls.
4. WHILE a Render_Job is running, THE Export_Panel SHALL display an enabled Cancel control.
5. WHEN the user activates Cancel during a Render_Job, THE Video_Renderer SHALL stop recording, discard the recorded data, download no file, and return SceneBeat to the idle state with all controls re-enabled within 1 second.
6. IF the document becomes hidden during a Render_Job, THEN THE Video_Renderer SHALL cancel the Render_Job as in criterion 5 and display the message "Video export stopped because the tab was hidden. Keep the tab visible and try again."
7. IF MediaRecorder reports an error or recording produces no data during a Render_Job, THEN THE Video_Renderer SHALL stop the Render_Job, download no file, display the message "Video export failed. Try again, or use a recent version of Chrome, Edge, Firefox, or Safari.", and re-enable all controls.
8. WHEN a Render_Job ends by completion, cancellation, or failure, THE SceneBeat SHALL release the canvas stream and every object URL the Render_Job created.

### Requirement 16: Video Export Availability

**User Story:** As a content creator using an older browser, I want a clear explanation when video export is unavailable, so that I can still use the other exports.

#### Acceptance Criteria

1. WHEN SceneBeat loads, THE SceneBeat SHALL detect whether the browser provides MediaRecorder, `HTMLCanvasElement.captureStream`, and support for at least one of the MP4 (H.264) or WebM recording types.
2. IF any capability in criterion 1 is missing, THEN THE Export_Panel SHALL disable the "Video" choice, choose "Subtitles" by default, and display the message "Video export isn't supported in this browser. Try a recent version of Chrome, Edge, Firefox, or Safari. Subtitles and storyboard downloads still work."
3. IF video export is unavailable, THEN THE SceneBeat SHALL keep the subtitle and storyboard JSON exports fully functional.

### Requirement 17: Scope Boundaries

**User Story:** As the project owner, I want the extended scope stated precisely, so that the feature ships without dragging in services or audio work.

#### Acceptance Criteria

1. THE SceneBeat SHALL generate all video, subtitle, and storyboard JSON files inside the browser.
2. THE SceneBeat SHALL operate without user accounts, a backend service, network requests, or audio processing, as stated in MVP Requirement 10 and amended here only to bring in-browser video rendering into scope.
3. THE SceneBeat SHALL produce video files with no audio track.
4. THE SceneBeat SHALL limit subtitle exports to SRT and WebVTT files and editor interoperability to those subtitle files, with native project formats for video editors out of scope.
5. THE Project_Repository SHALL record the scope change in the `## Scope boundaries (MVP)` section of `.kiro/steering/product.md` and in `README.md`.
