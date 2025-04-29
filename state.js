// --- Constants ---
export const LANGUAGE_STORAGE_KEY = 'transcriptCheckerLang';
export const API_KEY_STORAGE_KEY = 'transcriptCheckerApiKey'; // Key for storing API key
export const AUTO_SAVE_INTERVAL = 3000; // 3 seconds

// --- Mutable State Variables ---
// Use an object to allow modification by reference from other modules
export const appState = {
    currentLang: 'fi',
    audioFileLoaded: false,
    vttFileLoaded: false,
    transcriptData: [], // Array of cue objects { start, end, text, element?, startTimestampInput?, endTimestampInput? }
    currentEditingIndex: -1, // Index of the cue being edited in the textarea
    activeCueIndex: -1, // Index of the cue currently highlighted based on audio time
    autoSaveTimer: null, // Timer ID for setInterval
    originalVttFilename: '', // Original name of the loaded/generated VTT file
    audioBaseFilename: '', // Base name of the loaded audio file (without extension)
    lastAutoSavedContent: '', // Store JSON string of last autosave to prevent redundant saves
    currentAudioObjectURL: null, // Blob URL for the current audio file
};

// --- State Modifying Functions (Optional - direct modification via appState object is simpler for now) ---
// Example:
// export function setTranscriptData(newData) {
//     appState.transcriptData = newData;
// }
// export function setAudioFileLoaded(isLoaded) {
//     appState.audioFileLoaded = isLoaded;
// }
// ... etc.
