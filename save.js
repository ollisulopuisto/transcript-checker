import { appState, AUTO_SAVE_INTERVAL } from './state.js';
import { formatVttTime } from './utils.js';
import { translate } from './i18n.js';
// Import UI functions needed for autosave/load - potential circular dependency if ui.js imports save.js
// Consider passing these functions or using events/callbacks later.
// For now, assume they might be globally accessible or passed via init.
// import { displayTranscription, checkFilesLoaded } from './ui.js';

// DOM Elements (Ideally passed via init or imported from a dom.js module)
let saveFilenameInput;
let saveFormatOptions;
let saveButton;
let saveStatus;
let editableTranscriptTextarea; // Needed for saving current edits
let vttFileNameSpan; // Needed for loadAutoSave

// UI functions (Placeholder - these should be imported/passed)
let displayTranscription = (cues) => { console.warn("displayTranscription not initialized in save.js"); };
let checkFilesLoaded = () => { console.warn("checkFilesLoaded not initialized in save.js"); };


/**
 * Updates the default save filename based on current state.
 */
export function updateDefaultFilename() {
    if (!saveFilenameInput) return; // Ensure element is available
    const base = appState.originalVttFilename ? appState.originalVttFilename.replace(/\.vtt$/i, '') : (appState.audioBaseFilename || 'transcript');
    const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';
    let extension = '.txt';
    if (selectedFormat === 'vtt') {
        extension = '.vtt';
    }
    saveFilenameInput.value = `${base}_edited${extension}`;
}

/**
 * Saves the current state of the focused text area to transcriptData.
 */
function saveCurrentTextareaEdit() {
    if (appState.currentEditingIndex !== -1 && appState.currentEditingIndex < appState.transcriptData.length) {
        const currentText = editableTranscriptTextarea.value;
        if (currentText !== appState.transcriptData[appState.currentEditingIndex].text) {
            appState.transcriptData[appState.currentEditingIndex].text = currentText;
            // Update the original display text content if the element exists (handled by UI module ideally)
            const cue = appState.transcriptData[appState.currentEditingIndex];
            if (cue.element) {
                cue.element.textContent = `[${formatVttTime(cue.start)} - ${formatVttTime(cue.end)}] ${cue.text}`;
            }
        }
    }
}

/**
 * Autosaves the current transcript data to local storage.
 */
export function autoSaveTranscript() {
    if (!appState.audioFileLoaded || !appState.vttFileLoaded) return; // Don't save if files aren't loaded

    saveCurrentTextareaEdit(); // Ensure latest edit is captured

    const dataToSave = {
        transcript: appState.transcriptData.map(cue => ({
            start: cue.start,
            end: cue.end,
            text: cue.text
            // Don't save DOM elements
        })),
        originalVttFilename: appState.originalVttFilename,
        audioBaseFilename: appState.audioBaseFilename,
        timestamp: new Date().toISOString()
    };
    const contentToSave = JSON.stringify(dataToSave);

    if (contentToSave === appState.lastAutoSavedContent) {
        return; // Avoid saving if content hasn't changed
    }

    try {
        localStorage.setItem('transcriptAutoSave', contentToSave);
        appState.lastAutoSavedContent = contentToSave;
        console.log("Transcript autosaved at", new Date().toLocaleTimeString());
    } catch (e) {
        console.error("Autosave failed:", e);
        if (saveStatus) {
            saveStatus.textContent = translate('autosaveFailed');
            saveStatus.style.color = 'red';
        }
        stopAutoSave(); // Stop trying if storage fails
    }
}

/**
 * Starts the autosave interval timer.
 */
export function startAutoSave() {
    stopAutoSave(); // Clear any existing timer
    appState.autoSaveTimer = setInterval(autoSaveTranscript, AUTO_SAVE_INTERVAL);
    console.log("Autosave started.");
}

/**
 * Stops the autosave interval timer.
 */
export function stopAutoSave() {
    if (appState.autoSaveTimer) {
        clearInterval(appState.autoSaveTimer);
        appState.autoSaveTimer = null;
        console.log("Autosave stopped.");
    }
}

/**
 * Clears any saved transcript data from local storage.
 */
export function clearAutoSaves() {
    try {
        localStorage.removeItem('transcriptAutoSave');
        appState.lastAutoSavedContent = ''; // Reset tracker
        console.log("Autosave cleared.");
    } catch (e) {
        console.error("Failed to clear autosave:", e);
    }
}

/**
 * Attempts to load autosaved data from local storage.
 * @returns {boolean} True if data was successfully loaded, false otherwise.
 */
export function loadAutoSave() {
    try {
        const savedDataJSON = localStorage.getItem('transcriptAutoSave');
        if (savedDataJSON) {
            const savedData = JSON.parse(savedDataJSON);
            if (savedData.transcript && (savedData.originalVttFilename || savedData.audioBaseFilename)) {
                const saveTime = new Date(savedData.timestamp).toLocaleTimeString();
                console.log(`Found autosaved data from ${saveTime} for VTT: ${savedData.originalVttFilename}, Audio: ${savedData.audioBaseFilename}`);

                if (confirm(translate('autosavePrompt', { time: saveTime }))) {
                    // Restore state
                    appState.transcriptData = savedData.transcript;
                    appState.originalVttFilename = savedData.originalVttFilename;
                    appState.audioBaseFilename = savedData.audioBaseFilename;
                    appState.lastAutoSavedContent = savedDataJSON;
                    appState.vttFileLoaded = true;
                    appState.audioFileLoaded = true;

                    // Update UI (using potentially passed/imported functions)
                    if (vttFileNameSpan) vttFileNameSpan.textContent = appState.originalVttFilename;
                    updateDefaultFilename();
                    displayTranscription(appState.transcriptData); // Needs to be available
                    checkFilesLoaded(); // Needs to be available

                    if (saveStatus) {
                        saveStatus.textContent = translate('autosaveLoaded', { time: saveTime });
                        saveStatus.style.color = 'blue';
                        setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 5000);
                    }
                    return true; // Indicate success
                } else {
                    clearAutoSaves(); // User chose not to load
                }
            } else {
                console.log("Autosaved data found but seems incomplete.");
                clearAutoSaves();
            }
        }
    } catch (e) {
        console.error("Error loading autosave:", e);
        clearAutoSaves();
    }
    return false; // Indicate failure or no data found/loaded
}

/**
 * Handles the click event for the save button.
 */
function handleSaveClick() {
    saveCurrentTextareaEdit(); // Ensure latest edit is captured

    const selectedFormat = document.querySelector('input[name="saveFormat"]:checked').value;
    let hasInvalidTimestamps = false;

    if (selectedFormat === 'txt_ts' || selectedFormat === 'vtt') {
        appState.transcriptData.forEach((cue, index) => {
            // Check input elements if they exist (might not after loadAutoSave without full UI rebuild)
            if (cue.startTimestampInput && cue.startTimestampInput.classList.contains('invalid')) {
                hasInvalidTimestamps = true;
            }
            if (cue.endTimestampInput && cue.endTimestampInput.classList.contains('invalid')) {
                hasInvalidTimestamps = true;
            }
            // Always check data logic
            if (cue.start >= cue.end) {
                hasInvalidTimestamps = true;
            }
        });

        if (hasInvalidTimestamps) {
            if (saveStatus) {
                saveStatus.textContent = translate('saveInvalidTimestampsError');
                saveStatus.style.color = 'red';
                setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 4000);
            }
            return; // Stop saving
        }
    }

    let content = '';
    let mimeType = 'text/plain';
    let filename = saveFilenameInput.value || 'transcript.txt';

    if (appState.transcriptData.length === 0) {
        if (saveStatus) {
            saveStatus.textContent = translate('saveNoText');
            saveStatus.style.color = 'orange';
            setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 3000);
        }
        return;
    }

    switch (selectedFormat) {
        case 'txt_plain':
            content = appState.transcriptData.map(cue => cue.text).join('\n\n');
            mimeType = 'text/plain';
            if (!filename.toLowerCase().endsWith('.txt')) filename += '.txt';
            break;
        case 'txt_ts':
            content = appState.transcriptData.map(cue => `[${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}]\n${cue.text}`).join('\n\n');
            mimeType = 'text/plain';
            if (!filename.toLowerCase().endsWith('.txt')) filename += '.txt';
            break;
        case 'vtt':
            content = "WEBVTT\n\n";
            content += appState.transcriptData.map(cue => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`).join('\n\n');
            mimeType = 'text/vtt';
            if (!filename.toLowerCase().endsWith('.vtt')) filename += '.vtt';
            break;
    }

    try {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        if (saveStatus) {
            saveStatus.textContent = translate('saveSuccess', { filename: filename });
            saveStatus.style.color = 'green';
            setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 3000);
        }
        // clearAutoSaves(); // Optional: Clear autosave after successful manual save
    } catch (error) {
        console.error("Save failed:", error);
        if (saveStatus) {
            saveStatus.textContent = translate('saveError');
            saveStatus.style.color = 'red';
            setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 3000);
        }
    }
}

/**
 * Initializes the save module, attaching event listeners.
 * @param {object} elements - Object containing required DOM elements.
 * @param {object} uiFuncs - Object containing required UI functions.
 */
export function initSave(elements, uiFuncs) {
    // Store references to DOM elements
    saveFilenameInput = elements.saveFilenameInput;
    saveFormatOptions = elements.saveFormatOptions;
    saveButton = elements.saveButton;
    saveStatus = elements.saveStatus;
    editableTranscriptTextarea = elements.editableTranscriptTextarea;
    vttFileNameSpan = elements.vttFileNameSpan;

    // Store references to UI functions
    if (uiFuncs) {
        displayTranscription = uiFuncs.displayTranscription || displayTranscription;
        checkFilesLoaded = uiFuncs.checkFilesLoaded || checkFilesLoaded;
    }


    if (saveFormatOptions) {
        saveFormatOptions.addEventListener('change', updateDefaultFilename);
    } else {
        console.error("Save module init: saveFormatOptions element not provided.");
    }

    if (saveButton) {
        saveButton.addEventListener('click', handleSaveClick);
    } else {
        console.error("Save module init: saveButton element not provided.");
    }

    // Initial call to set default filename
    updateDefaultFilename();
}
