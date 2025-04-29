// Audio handling functionality for transcript-checker
import { formatDisplayTime } from './utils.js';
import { appState } from './state.js';
import { translate } from './i18n.js';

// Private module variable for DOM elements
let audioPlayer;
let currentTimeSpan;
let playbackSpeedSelect;

// Private module variable for UI callback functions
let updateFocusedSegmentView;
let highlightTimestampPair;

/**
 * Syncs transcript UI with current audio playback position
 */
function syncTranscriptWithAudio() {
    const currentTime = audioPlayer.currentTime;
    let newActiveCueIndex = -1;
    for (let i = 0; i < appState.transcriptData.length; i++) {
        const cue = appState.transcriptData[i];
        if (currentTime >= cue.start && currentTime < cue.end) {
            newActiveCueIndex = i;
            break;
        }
    }

    if (newActiveCueIndex !== appState.activeCueIndex) {
        // Remove old highlight from original transcript
        if (appState.activeCueIndex !== -1 && appState.transcriptData[appState.activeCueIndex]?.element) {
            appState.transcriptData[appState.activeCueIndex].element.classList.remove('highlight');
        }

        // Add new highlight and scroll original transcript
        if (newActiveCueIndex !== -1) {
            const activeCue = appState.transcriptData[newActiveCueIndex];
            if (activeCue?.element) {
                activeCue.element.classList.add('highlight');
                // Scroll only if the element is not already visible
                const elementRect = activeCue.element.getBoundingClientRect();
                const containerRect = originalTranscriptDiv.getBoundingClientRect();
                if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
                    activeCue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }

            // Update the focused segment view only if the *cue* changes
            // and the textarea doesn't have focus (to avoid disrupting typing)
            if (document.activeElement !== editableTranscriptTextarea) {
                updateFocusedSegmentView(newActiveCueIndex);
            } else {
                // If textarea has focus, just highlight the timestamp pair without stealing focus
                highlightTimestampPair(newActiveCueIndex);
                // Also scroll the timestamp editor view if needed
                const timestampPairDiv = document.getElementById(`ts-pair-${newActiveCueIndex}`);
                if (timestampPairDiv && editableColumnContentDiv) {
                    const containerRect = editableColumnContentDiv.getBoundingClientRect();
                    const elementRect = timestampPairDiv.getBoundingClientRect();
                    if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
                        // Scroll smoothly, keeping the element centered if possible
                        const offsetTop = elementRect.top - containerRect.top + editableColumnContentDiv.scrollTop;
                        editableColumnContentDiv.scrollTo({
                            top: offsetTop - (containerRect.height / 2) + (elementRect.height / 2), // Center vertically
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }

        appState.activeCueIndex = newActiveCueIndex;
    }
    // Update current time display continuously
    currentTimeSpan.textContent = formatDisplayTime(currentTime);
}

/**
 * Handles selecting an audio file
 * @param {File} file - The audio file to process
 * @param {Function} checkFilesLoaded - Callback to update UI state
 * @param {Function} updateDefaultFilename - Callback to update the default filename
 * @returns {boolean} - Whether file was successfully loaded
 */
function handleAudioFileSelect(file) {
    if (file) {
        console.log("Audio file selected:", file.name, file.type);
        appState.audioBaseFilename = file.name.replace(/\.[^/.]+$/, ""); // Store base name
        updateDefaultFilename(); // Update save name suggestion

        // Revoke previous object URL if one exists
        if (appState.currentAudioObjectURL) {
            URL.revokeObjectURL(appState.currentAudioObjectURL);
            console.log("Revoked previous audio object URL.");
        }

        // Create a new object URL for the selected file
        appState.currentAudioObjectURL = URL.createObjectURL(file);
        audioPlayer.src = appState.currentAudioObjectURL;
        appState.audioFileLoaded = true;

        audioPlayer.onerror = (e) => {
            console.error("Audio player error:", e);
            let errorKey = 'audioErrorUnknown';
            switch (audioPlayer.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: errorKey = 'audioErrorAborted'; break;
                case MediaError.MEDIA_ERR_NETWORK: errorKey = 'audioErrorNetwork'; break;
                case MediaError.MEDIA_ERR_DECODE: errorKey = 'audioErrorDecode'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorKey = 'audioErrorNotSupported'; break;
            }
            // Display error (consider adding a dedicated error display area)
            alert(translate(errorKey)); // Simple alert for now
            appState.audioFileLoaded = false;
            checkFilesLoaded(); // Update UI state
        };
        
        audioPlayer.oncanplaythrough = () => {
            console.log("Audio ready to play through.");
            // Potentially enable UI elements here if needed
        };

    } else {
        appState.audioFileLoaded = false;
        appState.audioBaseFilename = '';
        updateDefaultFilename();
    }
    checkFilesLoaded(); // Update UI based on whether the file loaded
    return appState.audioFileLoaded;
}

/**
 * Sets up audio event listeners and initializes the module
 * @param {Object} elements - DOM elements needed by this module
 * @param {Object} callbacks - Callback functions from other modules
 */
export function initAudio(elements, callbacks) {
    // Store references to DOM elements
    audioPlayer = elements.audioPlayer;
    currentTimeSpan = elements.currentTimeSpan;
    playbackSpeedSelect = elements.playbackSpeedSelect;
    
    // Store references to other required elements from UI
    originalTranscriptDiv = elements.originalTranscriptDiv;
    editableTranscriptTextarea = elements.editableTranscriptTextarea;
    editableColumnContentDiv = elements.editableColumnContentDiv;
    
    // Store callbacks
    updateFocusedSegmentView = callbacks.updateFocusedSegmentView;
    highlightTimestampPair = callbacks.highlightTimestampPair;
    updateDefaultFilename = callbacks.updateDefaultFilename;
    checkFilesLoaded = callbacks.checkFilesLoaded;
    
    // Set up event listeners
    audioPlayer.addEventListener('timeupdate', syncTranscriptWithAudio);
    
    playbackSpeedSelect.addEventListener('change', (event) => {
        const speed = parseFloat(event.target.value);
        if (!isNaN(speed)) {
            audioPlayer.playbackRate = speed;
            console.log(`Playback speed set to ${speed}x`);
        }
    });
    
    console.log("Audio module initialized.");
}

// Clean up audio resources
export function cleanupAudio() {
    if (appState.currentAudioObjectURL) {
        URL.revokeObjectURL(appState.currentAudioObjectURL);
        console.log("Revoked audio object URL.");
        appState.currentAudioObjectURL = null;
    }
}

// Export public functions
export { handleAudioFileSelect, syncTranscriptWithAudio };