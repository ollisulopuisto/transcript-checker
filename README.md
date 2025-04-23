# Transcription Checker Tool

A simple web-based tool to check and correct VTT (Web Video Text Tracks) transcription files against an audio source. You can generate VTT files easily with Gemini in [AI Studio](https://aistudio.google.com).

![screenshot](<transcript screenshot.png>)

## How to Use

1.  **Open `index.html`**: In your web browser of choice.
2.  **Select Language**: Use the buttons at the top to choose the UI language (English/Finnish). It should default to whatever the browser's set to.
3.  **Load Files**:
    *   Click the first "Choose File" button to select your audio file (e.g., MP3, WAV, OGG).
    *   Click the second "Choose File" button to select the corresponding VTT transcription file (`.vtt`).
    *   Once both files are loaded, the main interface appears.
4.  **Check & Edit**:
    *   Play the audio using the controls.
    *   The **Original Transcript** column on the left displays the VTT cues. The currently playing cue is highlighted. Clicking a cue jumps the audio to its start time.
    *   The **Editable Transcript** column on the right has two parts:
        *   **Timestamp Editor** (left side): Shows the start and end times for each cue. The pair corresponding to the currently playing/selected cue is highlighted and becomes editable (format: `HH:MM:SS.sss`). Invalid formats or times (e.g., start >= end) will be indicated.
        *   **Focused Editor** (right side): Displays the text of the currently active cue in a central text area for editing. It also shows the text of the immediately preceding and succeeding cues for context.
    *   Make corrections to the text in the central text area.
    *   Edit timestamps directly in the highlighted input fields in the Timestamp Editor.
    *   The Original Transcript and Timestamp Editor columns scroll synchronously.
5.  **Save**:
    *   Choose the desired save format:
        *   `Text without timestamps (.txt)`: Saves only the corrected text, separated by double newlines.
        *   `Text with timestamps (.txt)`: Saves the corrected text with the (potentially edited) timestamps prepended to each block.
        *   `VTT with timestamps (.vtt)`: Saves a new VTT file with the corrected text and (potentially edited) timestamps.
    *   Enter a filename (a default is suggested based on the original VTT filename and selected format).
    *   Click the "Save Modified Text" button to download the corrected transcript. Saving with timestamps requires all timestamp inputs to be valid.
6.  **Load New Files**: If you want to work on different files, click the "Load New Files" button that appears after the initial files are loaded. This will clear the current state.

## Features

*   Synchronized playback: Highlights the current VTT cue in the original transcript and the corresponding timestamp pair in the editor as the audio plays.
*   Click-to-seek: Click on a cue in the original transcript to jump to that time in the audio.
*   Focused Editing: Edit the text of the current cue in a dedicated text area, with previous/next cues shown for context.
*   Editable Timestamps: Directly edit the start and end times of the highlighted cue in `HH:MM:SS.sss` format with validation.
*   Scroll Synchronization: The Original Transcript and Timestamp Editor columns scroll together.
*   Multiple save formats: Save corrections as plain text, text with timestamps, or a new VTT file.
*   Auto-save: Automatically saves the current state (text and timestamps) to local storage periodically to prevent data loss. Notifies if autosaved data is found on load.
*   Internationalization (i18n): UI available in English and Finnish via language selector buttons.
*   File Input Toggle: Hides file inputs after loading, provides a button to load new files.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
