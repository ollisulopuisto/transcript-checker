// UI handling functionality for transcript-checker
import { formatVttTime } from './utils.js';
import { appState } from './state.js';
import { translate, updateTranslations } from './i18n.js';
import { startAutoSave } from './save.js';
import { parseVttTimeToSeconds } from './utils.js';

// Private module variables for DOM elements
let originalTranscriptDiv;
let timestampEditorDiv;
let previousSegmentsDiv;
let nextSegmentsDiv;
let editableTranscriptTextarea;
let editableColumnContentDiv;
let mainContentDiv;
let initialLoadMessageDiv;
let vttFileInfoDiv;
let switchToEditorBtn;
let switchToEditorFromGenerateBtn;
let initialChoiceContainer;
let fileInputContainer;
let generateInputContainer;
let sharedAudioInputContainer;
let toggleFileInputsBtn;
let saveButton;
let vttFileNameSpan;

/**
 * Displays the transcription in the UI
 * @param {Array} cues - Array of cue objects
 */
function displayTranscription(cues) {
    originalTranscriptDiv.innerHTML = ''; // Clear previous original transcript
    timestampEditorDiv.innerHTML = ''; // Clear previous timestamp inputs
    previousSegmentsDiv.innerHTML = ''; // Clear previous segments
    nextSegmentsDiv.innerHTML = ''; // Clear next segments

    cues.forEach((cue, index) => {
        // Original transcript element
        const cueElement = document.createElement('span');
        cueElement.textContent = `[${formatVttTime(cue.start)} - ${formatVttTime(cue.end)}] ${cue.text}`; // Use VTT time format
        cueElement.dataset.start = cue.start;
        cueElement.dataset.end = cue.end;
        cueElement.id = `cue-${index}`; // Unique ID

        cueElement.addEventListener('click', () => {
            if (!isNaN(cue.start)) {
                audioPlayer.currentTime = cue.start;
                updateFocusedSegmentView(index);
                cueElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        });

        originalTranscriptDiv.appendChild(cueElement);
        cue.element = cueElement; // Store reference

        // Timestamp inputs for the editor column
        const tsPairDiv = document.createElement('div');
        tsPairDiv.className = 'timestamp-pair';
        tsPairDiv.id = `ts-pair-${index}`;

        const startInput = document.createElement('input');
        startInput.type = 'text';
        startInput.value = formatVttTime(cue.start);
        startInput.dataset.cueIndex = index;
        startInput.dataset.timeType = 'start';
        startInput.title = `Start time for cue ${index + 1}`; // Tooltip
        startInput.addEventListener('input', handleTimestampInput); // Add listener
        startInput.addEventListener('change', handleTimestampChange); // Add listener for final validation/update

        const endInput = document.createElement('input');
        endInput.type = 'text';
        endInput.value = formatVttTime(cue.end);
        endInput.dataset.cueIndex = index;
        endInput.dataset.timeType = 'end';
        endInput.title = `End time for cue ${index + 1}`; // Tooltip
        endInput.addEventListener('input', handleTimestampInput); // Add listener
        endInput.addEventListener('change', handleTimestampChange); // Add listener for final validation/update


        tsPairDiv.appendChild(startInput);
        tsPairDiv.appendChild(endInput);
        timestampEditorDiv.appendChild(tsPairDiv);

        // Store references to inputs in transcriptData
        cue.startTimestampInput = startInput;
        cue.endTimestampInput = endInput;
    });

    // Initialize with the first segment focused if available
    appState.currentEditingIndex = -1; // Reset before updating
    if (cues.length > 0) {
        updateFocusedSegmentView(0);
    } else {
        // Handle empty VTT file case
        editableTranscriptTextarea.value = '';
        previousSegmentsDiv.innerHTML = '';
        nextSegmentsDiv.innerHTML = '';
        timestampEditorDiv.innerHTML = ''; // Ensure editor is clear
    }

    // Reset scroll positions when loading new content
    originalTranscriptDiv.scrollTop = 0;
    editableColumnContentDiv.scrollTop = 0; // Scroll the new container
    appState.activeCueIndex = -1; // Reset active cue tracking

    // Start auto-saving after displaying new content
    startAutoSave(); // Ensure auto-save starts/restarts
}

/**
 * Creates a context segment for display in the UI
 * @param {Object} cue - The cue object
 * @param {number} index - Index of the cue
 * @param {boolean} isCurrentSegment - Whether this is the current segment
 * @returns {HTMLElement|string} - Either an HTML element or text content
 */
function createContextSegment(cue, index, isCurrentSegment = false) {
    if (!cue) return null;

    const timestampText = `[${formatVttTime(cue.start)} - ${formatVttTime(cue.end)}]`;

    if (isCurrentSegment) {
        // For the active segment, we return the text to put in the textarea
        return cue.text;
    } else {
        // For context segments, we create a div with the text
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'context-segment';
        segmentDiv.dataset.index = index;

        // Add clickable timestamp indicator
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp-indicator';
        timestampDiv.textContent = timestampText;
        timestampDiv.addEventListener('click', () => {
            // Navigate to this timestamp when clicked
            if (!isNaN(cue.start)) {
                audioPlayer.currentTime = cue.start;
                // Also update the focused view when clicking context timestamp
                updateFocusedSegmentView(index);
            }
        });

        // Add text content
        const contentDiv = document.createElement('div');
        contentDiv.textContent = cue.text; // Display raw text

        segmentDiv.appendChild(timestampDiv);
        segmentDiv.appendChild(contentDiv);

        return segmentDiv;
    }
}

/**
 * Updates which segment is focused in the UI
 * @param {number} index - Index of segment to focus
 */
function updateFocusedSegmentView(index) {
    if (index < 0 || index >= appState.transcriptData.length || index === appState.currentEditingIndex) {
        // Allow re-focusing the same segment to ensure UI consistency if needed
        if (index === appState.currentEditingIndex && index !== -1) {
             // Ensure the textarea content matches the data if re-focusing
             if (editableTranscriptTextarea.value !== appState.transcriptData[index].text) {
                 editableTranscriptTextarea.value = appState.transcriptData[index].text || '';
             }
        } else if (index < 0 || index >= appState.transcriptData.length) {
             return; // Invalid index
        }
         if (index === appState.currentEditingIndex) return; // Avoid redraw if index hasn't changed

    }

    // Save any changes from the current segment before switching
    if (appState.currentEditingIndex !== -1 && appState.currentEditingIndex < appState.transcriptData.length) {
        const currentText = editableTranscriptTextarea.value; // Don't trim here, preserve user spacing
        if (currentText !== appState.transcriptData[appState.currentEditingIndex].text) {
            appState.transcriptData[appState.currentEditingIndex].text = currentText;
            // Update the original display text content if the element exists
             if (appState.transcriptData[appState.currentEditingIndex].element) {
                 appState.transcriptData[appState.currentEditingIndex].element.textContent =
                     `[${formatVttTime(appState.transcriptData[appState.currentEditingIndex].start)} - ${formatVttTime(appState.transcriptData[appState.currentEditingIndex].end)}] ${appState.transcriptData[appState.currentEditingIndex].text}`;
             }
        }
    }

    // Clear previous context segments
    previousSegmentsDiv.innerHTML = '';
    nextSegmentsDiv.innerHTML = '';

    // Add previous segment (only 1)
    if (index > 0) {
        const segment = createContextSegment(appState.transcriptData[index - 1], index - 1);
        if (segment) previousSegmentsDiv.appendChild(segment);
    }

    // Set current segment in textarea
    const currentSegmentText = createContextSegment(appState.transcriptData[index], index, true);
    editableTranscriptTextarea.value = currentSegmentText || '';
    appState.currentEditingIndex = index; // Update the index *after* potential save

    // Add next segment (only 1)
    if (index < appState.transcriptData.length - 1) {
        const segment = createContextSegment(appState.transcriptData[index + 1], index + 1);
        if (segment) nextSegmentsDiv.appendChild(segment);
    }

     // Highlight the corresponding timestamp pair in the editor
     highlightTimestampPair(index);
     // Ensure the editable column scrolls the focused element into view
     const timestampPairDiv = document.getElementById(`ts-pair-${index}`);
     if (timestampPairDiv && editableColumnContentDiv) {
         const containerRect = editableColumnContentDiv.getBoundingClientRect();
         const elementRect = timestampPairDiv.getBoundingClientRect();
         const offsetTop = elementRect.top - containerRect.top + editableColumnContentDiv.scrollTop;

         editableColumnContentDiv.scrollTo({
             top: offsetTop - (containerRect.height / 2) + (elementRect.height / 2), // Center vertically
             behavior: 'smooth'
         });
     }
}

/**
 * Updates timestamp display in the context view
 * @param {number} cueIndex - Index of the cue whose timestamp changed
 */
function updateContextTimestamps(cueIndex) {
    const contextElements = [
        ...previousSegmentsDiv.querySelectorAll('.context-segment'),
        ...nextSegmentsDiv.querySelectorAll('.context-segment')
    ];
    contextElements.forEach(el => {
        if (parseInt(el.dataset.index, 10) === cueIndex) {
            const timestampIndicator = el.querySelector('.timestamp-indicator');
            if (timestampIndicator && appState.transcriptData[cueIndex]) {
                timestampIndicator.textContent = `[${formatVttTime(appState.transcriptData[cueIndex].start)} - ${formatVttTime(appState.transcriptData[cueIndex].end)}]`;
            }
        }
    });
}

/**
 * Highlights the timestamp pair for the active cue
 * @param {number} indexToHighlight - Index of the timestamp pair to highlight
 */
function highlightTimestampPair(indexToHighlight) {
     // Remove highlight from previously active pair
     const currentHighlighted = timestampEditorDiv.querySelector('.timestamp-pair.highlight');
     currentHighlighted?.classList.remove('highlight');

     // Add highlight to the new pair
     const timestampPairDiv = document.getElementById(`ts-pair-${indexToHighlight}`);
     if (timestampPairDiv) {
         timestampPairDiv.classList.add('highlight');
         // Scrolling is handled in updateFocusedSegmentView now
     }
}

/**
 * Validates and updates a timestamp input
 * @param {HTMLInputElement} inputElement - The input element to validate
 * @returns {boolean} - Whether the timestamp is valid
 */
function validateAndUpdateTimestamp(inputElement) {
    const cueIndex = parseInt(inputElement.dataset.cueIndex, 10);
    const timeType = inputElement.dataset.timeType; // 'start' or 'end'
    const timeString = inputElement.value;
    let isValid = false;
    let seconds = NaN;

    // Only proceed if data exists for this index
    if (!appState.transcriptData[cueIndex]) return false;

    seconds = parseVttTimeToSeconds(timeString); // Use imported function

    if (isNaN(seconds)) {
        inputElement.classList.add('invalid');
        inputElement.title = translate('vttInvalidEditableTimeFormat');
    } else {
        // Basic format is valid, now check logic (start < end)
        const otherTimeType = timeType === 'start' ? 'end' : 'start';
        const otherInputElement = appState.transcriptData[cueIndex][`${otherTimeType}TimestampInput`];
        // Ensure otherInputElement exists before accessing its value
        const otherTimeValue = otherInputElement ? parseVttTimeToSeconds(otherInputElement.value) : appState.transcriptData[cueIndex][otherTimeType];

        let timesAreValid = false;
        // Check against the *parsed* value of the other input if it exists, otherwise the data value
        const comparisonTime = !isNaN(otherTimeValue) ? otherTimeValue : appState.transcriptData[cueIndex][otherTimeType];

        if (timeType === 'start' && seconds < comparisonTime) {
            timesAreValid = true;
        } else if (timeType === 'end' && seconds > comparisonTime) {
            timesAreValid = true;
        }


        if (timesAreValid) {
            isValid = true;
            inputElement.classList.remove('invalid');
            inputElement.title = `${timeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;

            // Update the transcriptData array in state
            appState.transcriptData[cueIndex][timeType] = seconds;
            console.log(`Updated cue ${cueIndex} ${timeType} to ${seconds}s`);

            // If this edit made the times valid, also remove invalid class from the *other* input
            if (otherInputElement && otherInputElement.classList.contains('invalid')) {
                const otherSeconds = parseVttTimeToSeconds(otherInputElement.value);
                if (!isNaN(otherSeconds)) {
                     // Check if the *other* input is now valid relative to *this* input's new value
                     if ((otherTimeType === 'start' && otherSeconds < seconds) || (otherTimeType === 'end' && otherSeconds > seconds)) {
                          otherInputElement.classList.remove('invalid');
                          otherInputElement.title = `${otherTimeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;
                     }
                }
            }

            // Update the corresponding original transcript display
            if (appState.transcriptData[cueIndex].element) {
                 appState.transcriptData[cueIndex].element.textContent =
                     `[${formatVttTime(appState.transcriptData[cueIndex].start)} - ${formatVttTime(appState.transcriptData[cueIndex].end)}] ${appState.transcriptData[cueIndex].text}`;
            }
             // Update context view timestamps if visible
             updateContextTimestamps(cueIndex);


        } else {
            // Format is valid, but start >= end
            inputElement.classList.add('invalid');
            // Provide more specific error messages based on which time is being edited
            if (timeType === 'start') {
                inputElement.title = translate('vttStartTimeError', { endTime: formatVttTime(comparisonTime) }) || 'Start time must be before end time.';
            } else {
                inputElement.title = translate('vttEndTimeError', { startTime: formatVttTime(comparisonTime) }) || 'End time must be after start time.';
            }
            // Also mark the other input as invalid for clarity if it exists
            if (otherInputElement) {
                otherInputElement.classList.add('invalid');
                 if (otherTimeType === 'start') {
                    otherInputElement.title = translate('vttStartTimeError', { endTime: formatVttTime(seconds) }) || 'Start time must be before end time.';
                } else {
                    otherInputElement.title = translate('vttEndTimeError', { startTime: formatVttTime(seconds) }) || 'End time must be after start time.';
                }
            }
        }
    }
    return isValid;
}

/**
 * Handles timestamp input event
 * @param {Event} event - The input event
 */
function handleTimestampInput(event) {
    // Provide immediate feedback on format validity during input
    const inputElement = event.target;
    const timeString = inputElement.value;
    const seconds = parseVttTimeToSeconds(timeString);

    if (isNaN(seconds)) {
        inputElement.classList.add('invalid');
        inputElement.title = translate('vttInvalidEditableTimeFormat');
    } else {
        // Format looks ok for now, remove invalid state
        // Logical validation (start < end) happens on change/blur
        inputElement.classList.remove('invalid');
        inputElement.title = `${inputElement.dataset.timeType === 'start' ? 'Start' : 'End'} time for cue ${parseInt(inputElement.dataset.cueIndex, 10) + 1}`;
    }
}

/**
 * Handles timestamp change event (on blur or enter)
 * @param {Event} event - The change event 
 */
function handleTimestampChange(event) {
    // Perform full validation (format and logic) when input loses focus or value is committed
    validateAndUpdateTimestamp(event.target);
}

/**
 * Checks if all required files are loaded and updates UI accordingly
 */
function checkFilesLoaded() {
    if (appState.audioFileLoaded && appState.vttFileLoaded) {
        // Files are loaded, show the main editor content
        mainContentDiv.classList.remove('hidden');
        vttFileInfoDiv.classList.remove('hidden');
        toggleFileInputsBtn.style.display = 'inline-block'; // Show toggle button
        initialChoiceContainer.classList.add('hidden'); // Hide initial choice
        fileInputContainer.classList.add('hidden'); // Hide file inputs
        generateInputContainer.classList.add('hidden'); // Hide generate inputs
        sharedAudioInputContainer.classList.add('hidden'); // Hide shared audio input in editor view
        initialLoadMessageDiv.classList.add('hidden');
        switchToEditorBtn.style.display = 'none'; // Ensure hidden when editor loads
        switchToEditorFromGenerateBtn.style.display = 'none'; // Ensure hidden
        saveButton.disabled = false; // Enable save button
    } else {
        // Files not yet loaded, ensure main content is hidden and show prompt/choice
        mainContentDiv.classList.add('hidden');
        vttFileInfoDiv.classList.add('hidden');
        toggleFileInputsBtn.style.display = 'none'; // Hide toggle button
        initialChoiceContainer.classList.remove('hidden'); // Show initial choice
        // Hide specific input sections until a choice is made
        fileInputContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden');
        sharedAudioInputContainer.classList.add('hidden');
        // Show the initial load prompt message only if no choice has been made yet
        initialLoadMessageDiv.classList.remove('hidden'); // Show prompt message
        saveButton.disabled = true; // Disable save button
    }
    // Update translations for dynamically shown/hidden elements if needed
    updateTranslations();
}

/**
 * Returns to the editor view from the file input or generation screens
 */
function returnToEditorView() {
    if (appState.audioFileLoaded && appState.vttFileLoaded) {
        mainContentDiv.classList.remove('hidden');
        vttFileInfoDiv.classList.remove('hidden');
        toggleFileInputsBtn.style.display = 'inline-block'; // Show toggle button
        sharedAudioInputContainer.classList.add('hidden'); // Hide shared audio input

        initialChoiceContainer.classList.add('hidden');
        fileInputContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden');
        switchToEditorBtn.style.display = 'none'; // Hide button after returning
        switchToEditorFromGenerateBtn.style.display = 'none'; // Hide button after returning
    } else {
        // Optional: Handle case where function is called inappropriately
        console.warn("returnToEditorView called but files are not loaded.");
        // Fallback to initial state check
        checkFilesLoaded();
    }
}

/**
 * Sets up UI event listeners and initializes the module
 * @param {Object} elements - DOM elements needed by this module 
 * @param {Object} callbacks - Callback functions from other modules
 */
export function initUI(elements, callbacks) {
    // Store references to DOM elements
    originalTranscriptDiv = elements.originalTranscriptDiv;
    timestampEditorDiv = elements.timestampEditorDiv;
    previousSegmentsDiv = elements.previousSegmentsDiv;
    nextSegmentsDiv = elements.nextSegmentsDiv;
    editableTranscriptTextarea = elements.editableTranscriptTextarea;
    editableColumnContentDiv = elements.editableColumnContentDiv;
    mainContentDiv = elements.mainContentDiv;
    initialLoadMessageDiv = elements.initialLoadMessageDiv;
    vttFileInfoDiv = elements.vttFileInfoDiv;
    switchToEditorBtn = elements.switchToEditorBtn;
    switchToEditorFromGenerateBtn = elements.switchToEditorFromGenerateBtn;
    initialChoiceContainer = elements.initialChoiceContainer;
    fileInputContainer = elements.fileInputContainer;
    generateInputContainer = elements.generateInputContainer;
    sharedAudioInputContainer = elements.sharedAudioInputContainer;
    toggleFileInputsBtn = elements.toggleFileInputsBtn;
    saveButton = elements.saveButton;
    vttFileNameSpan = elements.vttFileNameSpan;
    audioPlayer = elements.audioPlayer; // We need this for navigation
    
    // Store references to other modules' functions
    handleAudioFileSelect = callbacks.handleAudioFileSelect;
    updateDefaultFilename = callbacks.updateDefaultFilename;
    
    // Set up event listeners
    // View Switching Buttons
    loadExistingBtn = elements.loadExistingBtn;
    generateNewBtn = elements.generateNewBtn;
    
    loadExistingBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden'); // Ensure generate is hidden
        fileInputContainer.classList.remove('hidden');
        sharedAudioInputContainer.classList.remove('hidden'); // Show shared audio input
        initialLoadMessageDiv.classList.add('hidden'); // Hide initial prompt
        // Show "Return to Editor" button only if files are already loaded
        if (appState.audioFileLoaded && appState.vttFileLoaded) {
            switchToEditorBtn.style.display = 'inline-block';
        } else {
            switchToEditorBtn.style.display = 'none';
        }
        switchToEditorFromGenerateBtn.style.display = 'none'; // Ensure other button is hidden
    });

    generateNewBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        fileInputContainer.classList.add('hidden'); // Ensure load section is hidden
        generateInputContainer.classList.remove('hidden');
        sharedAudioInputContainer.classList.remove('hidden'); // Show shared audio input
        initialLoadMessageDiv.classList.add('hidden'); // Hide initial prompt
        // Show "Return to Editor" button only if files are already loaded
        if (appState.audioFileLoaded && appState.vttFileLoaded) {
            switchToEditorFromGenerateBtn.style.display = 'inline-block';
        } else {
            switchToEditorFromGenerateBtn.style.display = 'none';
        }
        switchToEditorBtn.style.display = 'none'; // Ensure other button is hidden
    });

    // Button to toggle back to file/generate selection from the editor view
    toggleFileInputsBtn.addEventListener('click', () => {
        mainContentDiv.classList.add('hidden');
        vttFileInfoDiv.classList.add('hidden'); // Also hide VTT info when going back
        toggleFileInputsBtn.style.display = 'none'; // Hide this button itself
        initialChoiceContainer.classList.remove('hidden'); // Show initial choice again
        // Ensure specific input sections are hidden initially when returning to choice
        fileInputContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden');
        sharedAudioInputContainer.classList.add('hidden');
        switchToEditorBtn.style.display = 'none'; // Hide return button
        switchToEditorFromGenerateBtn.style.display = 'none'; // Hide return button
        initialLoadMessageDiv.classList.remove('hidden'); // Show prompt again
    });

    // "Return to Editor" Buttons
    switchToEditorBtn.addEventListener('click', returnToEditorView);
    switchToEditorFromGenerateBtn.addEventListener('click', returnToEditorView);

    // Audio file input
    const audioFileInput = elements.audioFileInput;
    audioFileInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
    });
    
    console.log("UI module initialized.");
}

// Export public functions
export { 
    displayTranscription,
    createContextSegment,
    updateFocusedSegmentView,
    highlightTimestampPair, 
    updateContextTimestamps,
    validateAndUpdateTimestamp,
    handleTimestampInput,
    handleTimestampChange,
    checkFilesLoaded,
    returnToEditorView
};