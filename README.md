# Transcription Checker Tool

A simple web-based tool to check and correct VTT (Web Video Text Tracks) transcription files against an audio source.

## How to Use

1.  **Open `index.html`**: Open the `index.html` file in your web browser.
2.  **Load Files**:
    *   Click the first "Choose File" button to select your audio file (e.g., MP3, WAV, OGG).
    *   Click the second "Choose File" button to select the corresponding VTT transcription file (`.vtt`).
3.  **Check & Edit**:
    *   Play the audio using the controls.
    *   The original VTT transcript will be displayed on the left. The currently spoken cue (based on audio time) will be highlighted.
    *   Clicking on a cue in the original transcript jumps the audio player to that cue's start time.
    *   The plain text content of the VTT file appears in the editable text area on the right.
    *   As the audio plays, the corresponding text block in the editor will be selected (highlighted).
    *   Make corrections directly in the right-hand text area.
4.  **Save**:
    *   Choose the desired save format (Plain Text, Text with Timestamps, VTT).
    *   Enter a filename (a default is suggested).
    *   Click the "Save Modified Text" button to download the corrected transcript.
5.  **Load New Files**: If you want to work on different files, click the "Load New Files" button that appears after the initial files are loaded.

## Features

*   Synchronized playback: Highlights the current VTT cue in the original transcript as the audio plays.
*   Synchronized selection: Selects the corresponding text block in the editable transcript as the audio plays.
*   Click-to-seek: Click on a cue in the original transcript to jump to that time in the audio.
*   Editable transcript: Easily correct transcription errors in a plain text view.
*   Multiple save formats: Save corrections as plain text, text with original timestamps, or a new VTT file.
*   Auto-save: Automatically saves the content of the editable text area to local storage periodically to prevent data loss. Recovers the latest autosave on page load if available.
*   Basic Internationalization (i18n): Attempts to detect browser language (English/Finnish) for UI text.
*   File Input Toggle: Hides file inputs after loading, provides a button to load new files.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
