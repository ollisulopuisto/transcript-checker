# Transcription Checker Tool

A simple web-based tool to check and correct VTT (Web Video Text Tracks) transcription files against an audio source. You can generate VTT files easily with Gemini in [AI Studio](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221BD8IcXGVct71wT_kNHqU5rRnqj_LBkVF%22%5D,%22action%22:%22open%22,%22userId%22:%22110434416529506033412%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing).

![screenshot](<transcript screenshot.png>)

## How to Use

1.  **Open `index.html`** in your web browser of choice.
2.  **Select Language**: Use the buttons at the top to choose the UI language (English/Finnish). It should default to whatever the browser's set to.
3.  **Choose Action**:
    *   **Load Existing VTT**: Click this to load an existing audio file and its corresponding VTT file.
        *   Click the first "Choose File" button to select your audio file (e.g., MP3, WAV, OGG).
        *   Click the second "Choose File" button to select the corresponding VTT transcription file (`.vtt`).
    *   **Generate VTT from Audio**: Click this to generate a new transcript from an audio file (uses a *simulated* API call in this version).
        *   Click the "Choose File" button to select your audio file.
        *   (Optional) Enter an API key (not used in the simulation).
        *   Click the "Generate Transcript" button. Wait for the simulated process to complete.
4.  **Check & Edit** (Appears after files are loaded or generated):
    *   The name of the loaded/generated VTT file is displayed above the editor.
    *   Play the audio using the controls. Adjust playback speed if needed.
    *   The **Original Transcript** column on the left displays the VTT cues. The currently playing cue is highlighted. Clicking a cue jumps the audio to its start time.
    *   The **Editable Transcript** column on the right has two parts:
        *   **Timestamp Editor** (left side): Shows the start and end times for each cue. The pair corresponding to the currently playing/selected cue is highlighted and becomes editable (format: `HH:MM:SS.sss`). Invalid formats or times (e.g., start >= end) will be indicated.
        *   **Focused Editor** (right side): Displays the text of the currently active cue in a central text area for editing. It also shows the text of the immediately preceding and succeeding cues for context.
    *   Make corrections to the text in the central text area. Changes are saved to the internal data when you switch segments or blur the editor.
    *   Edit timestamps directly in the highlighted input fields in the Timestamp Editor. Validation occurs on input and when the field loses focus.
    *   The Original Transcript and Timestamp Editor columns scroll synchronously.
5.  **Save**:
    *   Choose the desired save format:
        *   `Text without timestamps (.txt)`: Saves only the corrected text, separated by double newlines.
        *   `Text with timestamps (.txt)`: Saves the corrected text with the (potentially edited) timestamps prepended to each block.
        *   `VTT with timestamps (.vtt)`: Saves a new VTT file with the corrected text and (potentially edited) timestamps.
    *   Enter a filename (a default is suggested based on the original/generated VTT filename and selected format).
    *   Click the "Save Modified Text" button to download the corrected transcript. Saving with timestamps requires all timestamp inputs to be valid.
6.  **Load/Generate New Files**: If you want to work on different files, click the "Load/Generate New Files" button that appears after the initial files are loaded/generated. This will clear the current state and return you to the initial choice screen.

## Features

*   **Load or Generate**: Option to load existing VTT files or generate a new one from audio (currently simulated).
*   Synchronized playback: Highlights the current VTT cue in the original transcript and the corresponding timestamp pair in the editor as the audio plays.
*   Click-to-seek: Click on a cue in the original transcript or a timestamp in the context view to jump to that time in the audio.
*   Focused Editing: Edit the text of the current cue in a dedicated text area, with previous/next cues shown for context.
*   Editable Timestamps: Directly edit the start and end times of the highlighted cue in `HH:MM:SS.sss` format with validation (format and start < end).
*   Scroll Synchronization: The Original Transcript and Timestamp Editor columns scroll together.
*   Multiple save formats: Save corrections as plain text, text with timestamps, or a new VTT file.
*   Auto-save: Automatically saves the current state (text and timestamps) to local storage periodically to prevent data loss. Notifies if autosaved data is found on load.
*   Internationalization (i18n): UI available in English and Finnish via language selector buttons.
*   Playback Speed Control: Adjust audio playback speed (0.5x to 2x).
*   Clear UI Flow: Initial choice directs user to loading or generation inputs; editor appears once data is ready. Button provided to return to the initial choice.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
