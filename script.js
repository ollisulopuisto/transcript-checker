import { formatVttTime, parseVttTimeToSeconds, readFileAsBase64, formatDisplayTime } from './utils.js';
import { parseVTT } from './vtt.js';
// import { translate, updateTranslations, setLanguage, initI18n } from './i18n.js'; // Future import
// import { initAudio, syncTranscriptWithAudio, handleAudioFileSelect } from './audio.js'; // Future import
// import { initApi } from './api.js'; // Future import
// import { initSave, updateDefaultFilename } from './save.js'; // Future import
// import { initUI, displayTranscription, updateFocusedSegmentView, checkFilesLoaded, returnToEditorView } from './ui.js'; // Future import
// import * as state from './state.js'; // Future import for state management

document.addEventListener('DOMContentLoaded', () => {
    // Existing element references (keep necessary ones here for now)
    const audioFileInput = document.getElementById('audioFile'); // This is now the shared audio input
    const vttFileInput = document.getElementById('vttFile');
    const audioPlayer = document.getElementById('audioPlayer');
    const originalTranscriptDiv = document.getElementById('originalTranscript');
    const editableTranscriptTextarea = document.getElementById('editableTranscript');
    const currentTimeSpan = document.getElementById('currentTime');
    const saveButton = document.getElementById('saveButton');
    const saveFilenameInput = document.getElementById('saveFilename');
    const saveStatus = document.getElementById('saveStatus');
    const htmlElement = document.documentElement;
    const saveFormatOptions = document.getElementById('saveFormatOptions');
    const fileInputContainer = document.getElementById('fileInputContainer');
    const toggleFileInputsBtn = document.getElementById('toggleFileInputsBtn');
    const langBtnEn = document.getElementById('langBtnEn');
    const langBtnFi = document.getElementById('langBtnFi');
    const timestampEditorDiv = document.getElementById('timestampEditor');
    const editableColumnContentDiv = document.getElementById('editableColumnContent');
    const mainContentDiv = document.getElementById('mainContent');
    const initialLoadMessageDiv = document.getElementById('initialLoadMessage');
    const switchToEditorBtn = document.getElementById('switchToEditorBtn');
    const playbackSpeedSelect = document.getElementById('playbackSpeed');
    const previousSegmentsDiv = document.getElementById('previousSegments');
    const nextSegmentsDiv = document.getElementById('nextSegments');

    // New element references for generation flow
    const initialChoiceContainer = document.getElementById('initialChoiceContainer');
    const loadExistingBtn = document.getElementById('loadExistingBtn');
    const generateNewBtn = document.getElementById('generateNewBtn');
    const generateInputContainer = document.getElementById('generateInputContainer');
    const sharedAudioInputContainer = document.getElementById('sharedAudioInputContainer');
    const apiKeyInput = document.getElementById('apiKey');
    const generateTranscriptBtn = document.getElementById('generateTranscriptBtn');
    const generateStatus = document.getElementById('generateStatus');
    const vttFileInfoDiv = document.getElementById('vttFileInfo');
    const vttFileNameSpan = document.getElementById('vttFileName');
    const switchToEditorFromGenerateBtn = document.getElementById('switchToEditorFromGenerateBtn');


    // --- State Variables (To be moved to state.js) ---
    const LANGUAGE_STORAGE_KEY = 'transcriptCheckerLang';
    const API_KEY_STORAGE_KEY = 'transcriptCheckerApiKey'; // Key for storing API key
    let currentLang = 'fi';
    let audioFileLoaded = false;
    let vttFileLoaded = false;
    let transcriptData = [];
    let currentEditingIndex = -1;
    let activeCueIndex = -1; // Track the currently highlighted cue based on audio time
    let autoSaveTimer = null;
    const AUTO_SAVE_INTERVAL = 3000; // 3 seconds
    let originalVttFilename = ''; // Added for default save name
    let audioBaseFilename = ''; // Added for default save name
    let lastAutoSavedContent = ''; // Track last saved content to avoid redundant saves
    let currentAudioObjectURL = null; // To manage audio blob URL lifecycle

    // --- Utility Functions (Moved to utils.js) ---
    // formatVttTime moved
    // parseVttTimeToSeconds moved
    // readFileAsBase64 moved

    // --- VTT Parsing (Moved to vtt.js) ---
    // parseVTT moved

    // --- Translation Functions (To be moved to i18n.js) ---
    // Placeholder translate function
    const translate = (key, params = {}) => {
        const langTranslations = translations[currentLang] || translations.en;
        let text = langTranslations[key] || translations.en[key] || key; // Fallback chain
        for (const p in params) {
            text = text.replace(`{${p}}`, params[p]);
        }
        return text;
    };

    function updateTranslations() {
        document.querySelectorAll('[data-translate-key]').forEach(element => {
            const key = element.dataset.translateKey;
            const translation = translate(key);
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.placeholder) {
                    element.placeholder = translation;
                }
                // Update value only if it's currently showing the placeholder key? Risky.
                // Best practice: Don't use data-translate-key for dynamic values.
            } else if (element.tagName === 'TITLE') {
                 document.title = translation; // Update page title
            } else {
                element.textContent = translation;
            }
        });
        // Update dynamic elements not using data-translate-key if needed
        // Example: Update save filename placeholder/value if it depends on language
        updateDefaultFilename(); // Re-generate default filename with current lang
        // Update aria-labels or titles if necessary
    }

    function setLanguage(lang) {
        if (translations[lang]) {
            currentLang = lang;
            htmlElement.lang = lang; // Update HTML lang attribute
            localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); // Save preference
            updateTranslations();
            console.log(`Language set to ${lang}`);
        }
    }

    // --- Display Update (To be moved to ui.js) ---
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
        currentEditingIndex = -1; // Reset before updating
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
        activeCueIndex = -1; // Reset active cue tracking

        // Start auto-saving after displaying new content
        startAutoSave(); // Ensure auto-save starts/restarts
    }

    // Helper function to create context segments (To be moved to ui.js)
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

    // Update function to handle the focused segment display (To be moved to ui.js)
    function updateFocusedSegmentView(index) {
        if (index < 0 || index >= transcriptData.length || index === currentEditingIndex) {
            // Allow re-focusing the same segment to ensure UI consistency if needed
            if (index === currentEditingIndex && index !== -1) {
                 // Ensure the textarea content matches the data if re-focusing
                 if (editableTranscriptTextarea.value !== transcriptData[index].text) {
                     editableTranscriptTextarea.value = transcriptData[index].text || '';
                 }
            } else if (index < 0 || index >= transcriptData.length) {
                 return; // Invalid index
            }
             if (index === currentEditingIndex) return; // Avoid redraw if index hasn't changed

        }

        // Save any changes from the current segment before switching
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
            const currentText = editableTranscriptTextarea.value; // Don't trim here, preserve user spacing
            if (currentText !== transcriptData[currentEditingIndex].text) {
                transcriptData[currentEditingIndex].text = currentText;
                // Update the original display text content if the element exists
                 if (transcriptData[currentEditingIndex].element) {
                     transcriptData[currentEditingIndex].element.textContent =
                         `[${formatVttTime(transcriptData[currentEditingIndex].start)} - ${formatVttTime(transcriptData[currentEditingIndex].end)}] ${transcriptData[currentEditingIndex].text}`;
                 }
            }
        }

        // Clear previous context segments
        previousSegmentsDiv.innerHTML = '';
        nextSegmentsDiv.innerHTML = '';

        // Add previous segment (only 1)
        if (index > 0) {
            const segment = createContextSegment(transcriptData[index - 1], index - 1);
            if (segment) previousSegmentsDiv.appendChild(segment);
        }

        // Set current segment in textarea
        const currentSegmentText = createContextSegment(transcriptData[index], index, true);
        editableTranscriptTextarea.value = currentSegmentText || '';
        currentEditingIndex = index; // Update the index *after* potential save

        // Add next segment (only 1)
        if (index < transcriptData.length - 1) {
            const segment = createContextSegment(transcriptData[index + 1], index + 1);
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

    // --- Timestamp Input Handling (To be moved to vtt.js or ui.js) ---
    function validateAndUpdateTimestamp(inputElement) {
        const cueIndex = parseInt(inputElement.dataset.cueIndex, 10);
        const timeType = inputElement.dataset.timeType; // 'start' or 'end'
        const timeString = inputElement.value;
        let isValid = false;
        let seconds = NaN;

        // Only proceed if data exists for this index
        if (!transcriptData[cueIndex]) return false;

        seconds = parseVttTimeToSeconds(timeString); // Use imported function

        if (isNaN(seconds)) {
            inputElement.classList.add('invalid');
            inputElement.title = translate('vttInvalidEditableTimeFormat');
        } else {
            // Basic format is valid, now check logic (start < end)
            const otherTimeType = timeType === 'start' ? 'end' : 'start';
            const otherInputElement = transcriptData[cueIndex][`${otherTimeType}TimestampInput`];
            // Ensure otherInputElement exists before accessing its value
            const otherTimeValue = otherInputElement ? parseVttTimeToSeconds(otherInputElement.value) : transcriptData[cueIndex][otherTimeType];

            let timesAreValid = false;
            // Check against the *parsed* value of the other input if it exists, otherwise the data value
            const comparisonTime = !isNaN(otherTimeValue) ? otherTimeValue : transcriptData[cueIndex][otherTimeType];

            if (timeType === 'start' && seconds < comparisonTime) {
                timesAreValid = true;
            } else if (timeType === 'end' && seconds > comparisonTime) {
                timesAreValid = true;
            }


            if (timesAreValid) {
                isValid = true;
                inputElement.classList.remove('invalid');
                inputElement.title = `${timeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;

                // Update the transcriptData array
                transcriptData[cueIndex][timeType] = seconds;
                console.log(`Updated cue ${cueIndex} ${timeType} to ${seconds}s`);

                // If this edit made the times valid, also remove invalid class from the *other* input
                if (otherInputElement && otherInputElement.classList.contains('invalid')) {
                    const otherSeconds = parseVttTimeToSeconds(otherInputElement.value); // Use imported function
                    if (!isNaN(otherSeconds)) {
                         // Check if the *other* input is now valid relative to *this* input's new value
                         if ((otherTimeType === 'start' && otherSeconds < seconds) || (otherTimeType === 'end' && otherSeconds > seconds)) {
                              otherInputElement.classList.remove('invalid');
                              otherInputElement.title = `${otherTimeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;
                         }
                    }
                }

                // Update the corresponding original transcript display
                if (transcriptData[cueIndex].element) {
                     transcriptData[cueIndex].element.textContent =
                         `[${formatVttTime(transcriptData[cueIndex].start)} - ${formatVttTime(transcriptData[cueIndex].end)}] ${transcriptData[cueIndex].text}`; // Use imported function
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

    function handleTimestampInput(event) {
        // Provide immediate feedback on format validity during input
        const inputElement = event.target;
        const timeString = inputElement.value;
        const seconds = parseVttTimeToSeconds(timeString); // Use imported function

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

    function handleTimestampChange(event) {
        // Perform full validation (format and logic) when input loses focus or value is committed
        validateAndUpdateTimestamp(event.target);
    }

    // Helper to update timestamps in context view (To be moved to ui.js)
    function updateContextTimestamps(cueIndex) {
        const contextElements = [
            ...previousSegmentsDiv.querySelectorAll('.context-segment'),
            ...nextSegmentsDiv.querySelectorAll('.context-segment')
        ];
        contextElements.forEach(el => {
            if (parseInt(el.dataset.index, 10) === cueIndex) {
                const timestampIndicator = el.querySelector('.timestamp-indicator');
                if (timestampIndicator && transcriptData[cueIndex]) {
                    timestampIndicator.textContent = `[${formatVttTime(transcriptData[cueIndex].start)} - ${formatVttTime(transcriptData[cueIndex].end)}]`; // Use imported function
                }
            }
        });
    }


    // --- Timestamp Formatting (Moved to utils.js) ---
    // formatDisplayTime moved

    // --- Playback Synchronization (To be moved to audio.js / ui.js) ---
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

    function syncTranscriptWithAudio() {
        const currentTime = audioPlayer.currentTime;
        let newActiveCueIndex = -1;
        for (let i = 0; i < transcriptData.length; i++) {
            const cue = transcriptData[i];
            if (currentTime >= cue.start && currentTime < cue.end) {
                newActiveCueIndex = i;
                break;
            }
        }

        if (newActiveCueIndex !== activeCueIndex) {
            // Remove old highlight from original transcript
            if (activeCueIndex !== -1 && transcriptData[activeCueIndex]?.element) {
                transcriptData[activeCueIndex].element.classList.remove('highlight');
            }

            // Add new highlight and scroll original transcript
            if (newActiveCueIndex !== -1) {
                const activeCue = transcriptData[newActiveCueIndex];
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

            activeCueIndex = newActiveCueIndex;
        }
        // Update current time display continuously
        currentTimeSpan.textContent = formatDisplayTime(currentTime); // Use imported function
    }

    // --- State Management & UI Updates (To be moved to ui.js / state.js) ---
    function checkFilesLoaded() {
        if (audioFileLoaded && vttFileLoaded) {
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

    // --- View Switching Logic (To be moved to ui.js) ---

    function returnToEditorView() {
        if (audioFileLoaded && vttFileLoaded) {
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

    // --- Audio File Handling (To be moved to audio.js) ---
    function handleAudioFileSelect(file) {
        if (file) {
            console.log("Audio file selected:", file.name, file.type);
            audioBaseFilename = file.name.replace(/\.[^/.]+$/, ""); // Store base name
            updateDefaultFilename(); // Update save name suggestion

            // Revoke previous object URL if one exists
            if (currentAudioObjectURL) {
                URL.revokeObjectURL(currentAudioObjectURL);
                console.log("Revoked previous audio object URL.");
            }

            // Create a new object URL for the selected file
            currentAudioObjectURL = URL.createObjectURL(file);
            audioPlayer.src = currentAudioObjectURL;
            audioFileLoaded = true;

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
                audioFileLoaded = false;
                checkFilesLoaded(); // Update UI state
            };
             audioPlayer.oncanplaythrough = () => {
                 console.log("Audio ready to play through.");
                 // Potentially enable UI elements here if needed
             };

        } else {
            audioFileLoaded = false;
            audioBaseFilename = '';
            updateDefaultFilename();
        }
        checkFilesLoaded(); // Update UI based on whether the file loaded
    }


    // --- Autosave Functions (To be moved to save.js) ---
    function autoSaveTranscript() {
        if (!audioFileLoaded || !vttFileLoaded) return; // Don't save if files aren't loaded

        // Save text from the currently focused textarea first
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             const currentText = editableTranscriptTextarea.value;
             if (currentText !== transcriptData[currentEditingIndex].text) {
                 transcriptData[currentEditingIndex].text = currentText;
                  // Update the original display text content if the element exists
                 if (transcriptData[currentEditingIndex].element) {
                     transcriptData[currentEditingIndex].element.textContent =
                         `[${formatVttTime(transcriptData[currentEditingIndex].start)} - ${formatVttTime(transcriptData[currentEditingIndex].end)}] ${transcriptData[currentEditingIndex].text}`;
                 }
             }
        }

        const dataToSave = {
            transcript: transcriptData.map(cue => ({
                start: cue.start,
                end: cue.end,
                text: cue.text
                // Don't save DOM elements (element, startTimestampInput, endTimestampInput)
            })),
            originalVttFilename: originalVttFilename,
            audioBaseFilename: audioBaseFilename, // Save audio name too for context
            timestamp: new Date().toISOString() // Add timestamp
        };
        const contentToSave = JSON.stringify(dataToSave);

        // Avoid saving if content hasn't changed since last autosave
        if (contentToSave === lastAutoSavedContent) {
            // console.log("Autosave skipped: content unchanged.");
            return;
        }

        try {
            localStorage.setItem('transcriptAutoSave', contentToSave);
            lastAutoSavedContent = contentToSave; // Update last saved content
            console.log("Transcript autosaved at", new Date().toLocaleTimeString());
        } catch (e) {
            console.error("Autosave failed:", e);
            saveStatus.textContent = translate('autosaveFailed');
            saveStatus.style.color = 'red';
            stopAutoSave(); // Stop trying if storage fails
        }
    }

    function startAutoSave() {
        stopAutoSave(); // Clear any existing timer
        autoSaveTimer = setInterval(autoSaveTranscript, AUTO_SAVE_INTERVAL);
        console.log("Autosave started.");
    }

    function stopAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
            console.log("Autosave stopped.");
        }
    }

     function loadAutoSave() {
        try {
            const savedDataJSON = localStorage.getItem('transcriptAutoSave');
            if (savedDataJSON) {
                const savedData = JSON.parse(savedDataJSON);
                // Basic check if the saved data seems relevant (e.g., based on filename)
                // This is a simple check; could be more robust
                if (savedData.originalVttFilename || savedData.audioBaseFilename) {
                    // Ask user if they want to load it? For now, just log and potentially load.
                    const saveTime = new Date(savedData.timestamp).toLocaleTimeString();
                    console.log(`Found autosaved data from ${saveTime} for VTT: ${savedData.originalVttFilename}, Audio: ${savedData.audioBaseFilename}`);

                    // Simple prompt to load - replace with a better UI element later
                    if (confirm(translate('autosavePrompt', { time: saveTime }))) {
                        // Restore state
                        transcriptData = savedData.transcript; // Restore transcript data
                        originalVttFilename = savedData.originalVttFilename;
                        audioBaseFilename = savedData.audioBaseFilename;
                        lastAutoSavedContent = savedDataJSON; // Set last saved content

                        // Need to simulate file loading state to show editor
                        // This assumes the user will re-select the *same* files
                        // A more robust solution would store file handles (if possible) or paths
                        vttFileLoaded = true; // Mark as loaded conceptually
                        audioFileLoaded = true; // Mark as loaded conceptually

                        // Update UI
                        vttFileNameSpan.textContent = originalVttFilename;
                        updateDefaultFilename();
                        displayTranscription(transcriptData); // Re-display restored data
                        checkFilesLoaded(); // Show editor

                        saveStatus.textContent = translate('autosaveLoaded', { time: saveTime });
                        saveStatus.style.color = 'blue';
                        setTimeout(() => { saveStatus.textContent = ''; }, 5000);
                        return true; // Indicate that autosave was loaded
                    } else {
                        // User chose not to load, clear the autosave
                        clearAutoSaves();
                    }
                } else {
                     console.log("Autosaved data found but seems incomplete or irrelevant.");
                     clearAutoSaves(); // Clear potentially corrupt data
                }
            }
        } catch (e) {
            console.error("Error loading autosave:", e);
             clearAutoSaves(); // Clear potentially corrupt data
        }
        return false; // Indicate autosave was not loaded
    }

     function clearAutoSaves() {
        try {
            localStorage.removeItem('transcriptAutoSave');
            lastAutoSavedContent = ''; // Reset tracker
            console.log("Autosave cleared.");
        } catch (e) {
            console.error("Failed to clear autosave:", e);
        }
    }


    // --- Save Functions (To be moved to save.js) ---
    function updateDefaultFilename() {
        const base = originalVttFilename ? originalVttFilename.replace(/\.vtt$/i, '') : (audioBaseFilename || 'transcript');
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';
        let extension = '.txt';
        if (selectedFormat === 'vtt') {
            extension = '.vtt';
        }
        saveFilenameInput.value = `${base}_edited${extension}`;
    }

    saveFormatOptions.addEventListener('change', updateDefaultFilename);

    saveButton.addEventListener('click', () => {
        // 1. Save current text area changes
         if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             transcriptData[currentEditingIndex].text = editableTranscriptTextarea.value;
         }

        // 2. Check for invalid timestamps before saving formats that need them
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked').value;
        let hasInvalidTimestamps = false;
        if (selectedFormat === 'txt_ts' || selectedFormat === 'vtt') {
            transcriptData.forEach((cue, index) => {
                if (cue.startTimestampInput && cue.startTimestampInput.classList.contains('invalid')) {
                    hasInvalidTimestamps = true;
                    console.warn(`Invalid start timestamp for cue ${index + 1}`);
                }
                if (cue.endTimestampInput && cue.endTimestampInput.classList.contains('invalid')) {
                    hasInvalidTimestamps = true;
                    console.warn(`Invalid end timestamp for cue ${index + 1}`);
                }
                 // Also double-check start < end logic using the data
                 if (cue.start >= cue.end) {
                     hasInvalidTimestamps = true;
                     console.warn(`Start time not before end time for cue ${index + 1}`);
                 }
            });

            if (hasInvalidTimestamps) {
                saveStatus.textContent = translate('saveInvalidTimestampsError');
                saveStatus.style.color = 'red';
                 setTimeout(() => { saveStatus.textContent = ''; }, 4000);
                return; // Stop saving
            }
        }


        // 3. Generate content based on format
        let content = '';
        let mimeType = 'text/plain';
        let filename = saveFilenameInput.value || 'transcript.txt';

        if (transcriptData.length === 0) {
            saveStatus.textContent = translate('saveNoText');
            saveStatus.style.color = 'orange';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
            return;
        }

        switch (selectedFormat) {
            case 'txt_plain':
                content = transcriptData.map(cue => cue.text).join('\n\n');
                mimeType = 'text/plain';
                if (!filename.toLowerCase().endsWith('.txt')) filename += '.txt';
                break;
            case 'txt_ts':
                content = transcriptData.map(cue => `[${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}]\n${cue.text}`).join('\n\n');
                mimeType = 'text/plain';
                 if (!filename.toLowerCase().endsWith('.txt')) filename += '.txt';
                break;
            case 'vtt':
                content = "WEBVTT\n\n";
                content += transcriptData.map(cue => `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`).join('\n\n');
                mimeType = 'text/vtt'; // Correct MIME type for VTT
                 if (!filename.toLowerCase().endsWith('.vtt')) filename += '.vtt';
                break;
        }

        // 4. Trigger download
        try {
            const blob = new Blob([content], { type: mimeType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up blob URL

            saveStatus.textContent = translate('saveSuccess', { filename: filename });
            saveStatus.style.color = 'green';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);

            // Clear autosave after successful manual save? Optional.
            // clearAutoSaves();

        } catch (error) {
            console.error("Save failed:", error);
            saveStatus.textContent = translate('saveError');
            saveStatus.style.color = 'red';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
        }
    });


    // --- Event Listeners ---

    // Language Buttons (To be moved to i18n.js)
    langBtnEn.addEventListener('click', () => setLanguage('en'));
    langBtnFi.addEventListener('click', () => setLanguage('fi'));

    // View Switching Buttons (To be moved to ui.js)
    loadExistingBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden'); // Ensure generate is hidden
        fileInputContainer.classList.remove('hidden');
        sharedAudioInputContainer.classList.remove('hidden'); // Show shared audio input
        initialLoadMessageDiv.classList.add('hidden'); // Hide initial prompt
        // Show "Return to Editor" button only if files are already loaded
        if (audioFileLoaded && vttFileLoaded) {
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
        if (audioFileLoaded && vttFileLoaded) {
            switchToEditorFromGenerateBtn.style.display = 'inline-block';
        } else {
            switchToEditorFromGenerateBtn.style.display = 'none';
        }
        switchToEditorBtn.style.display = 'none'; // Ensure other button is hidden
    });

    // Button to toggle back to file/generate selection from the editor view (To be moved to ui.js)
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

    // "Return to Editor" Buttons (To be moved to ui.js)
    switchToEditorBtn.addEventListener('click', returnToEditorView);
    switchToEditorFromGenerateBtn.addEventListener('click', returnToEditorView);


    // File Inputs (Listeners to be moved to ui.js, handler logic to audio.js/vtt.js/etc.)
    audioFileInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
        // checkFilesLoaded(); // Called within handleAudioFileSelect
    });

    vttFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            stopAutoSave(); // Stop autosave while loading new file
            // Don't clear autosave yet, wait for successful load? Or clear immediately? Clearing now.
            clearAutoSaves();


            originalVttFilename = file.name;
            vttFileNameSpan.textContent = originalVttFilename; // Display VTT filename
            updateDefaultFilename();

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    transcriptData = parseVTT(e.target.result); // Use imported function
                    displayTranscription(transcriptData);
                    console.log("VTT file loaded and parsed:", file.name);
                    vttFileLoaded = true; // Mark as loaded
                    checkFilesLoaded(); // Show the editor
                    // Start autosave only after successful load and display
                    // startAutoSave(); // Moved to displayTranscription
                } catch (error) {
                    console.error("VTT parsing error:", error);
                    originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttParseError')}</p>`;
                    editableTranscriptTextarea.value = "";
                    timestampEditorDiv.innerHTML = ''; // Clear editor on error
                    previousSegmentsDiv.innerHTML = '';
                    nextSegmentsDiv.innerHTML = '';
                    transcriptData = []; // Clear data
                    vttFileLoaded = false; // Mark as not loaded on error
                    checkFilesLoaded(); // Update UI state
                    vttFileNameSpan.textContent = ''; // Clear filename on error
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading VTT file:", e);
                originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttReadError')}</p>`;
                editableTranscriptTextarea.value = "";
                 timestampEditorDiv.innerHTML = ''; // Clear editor on error
                 previousSegmentsDiv.innerHTML = '';
                 nextSegmentsDiv.innerHTML = '';
                 transcriptData = []; // Clear data
                vttFileLoaded = false; // Mark as not loaded on error
                checkFilesLoaded(); // Update UI state
                vttFileNameSpan.textContent = ''; // Clear filename on error
            };
            reader.readAsText(file);
        } else {
             vttFileLoaded = false; // Mark as not loaded if selection is cancelled
             vttFileNameSpan.textContent = ''; // Clear filename if selection cancelled
             originalVttFilename = '';
             updateDefaultFilename();
             checkFilesLoaded();
        }
    });

    // Playback Speed Control (To be moved to audio.js)
    playbackSpeedSelect.addEventListener('change', (event) => {
        const speed = parseFloat(event.target.value);
        if (!isNaN(speed)) {
            audioPlayer.playbackRate = speed;
            console.log(`Playback speed set to ${speed}x`);
        }
    });

    // Audio Player Time Update (To be moved to audio.js)
    audioPlayer.addEventListener('timeupdate', syncTranscriptWithAudio);

    // API Key Input (Persistence logic to be moved?)
     apiKeyInput.addEventListener('change', () => {
        try {
            localStorage.setItem(API_KEY_STORAGE_KEY, apiKeyInput.value.trim());
        } catch (e) {
            console.warn("Could not save API key to local storage:", e);
        }
    });


    // --- Transcript Generation (Listener to be moved to api.js) ---
    generateTranscriptBtn.addEventListener('click', async () => { // Add async
        const audioFile = audioFileInput.files[0]; // Use the shared audio input
        const apiKey = apiKeyInput.value.trim(); // Reads the API key

        if (!audioFile) {
            generateStatus.textContent = translate('noAudioForGeneration');
            generateStatus.style.color = 'red';
            generateStatus.dataset.translateKey = 'noAudioForGeneration';
            return;
        }

        // *** Make API key mandatory ***
        if (!apiKey) {
            generateStatus.textContent = translate('noApiKey');
            generateStatus.style.color = 'red';
            generateStatus.dataset.translateKey = 'noApiKey';
            return;
        }

        // Ensure audio is loaded (handleAudioFileSelect should have been called by input change)
        if (!audioFileLoaded || !audioPlayer.src) {
             // Attempt to load it again if somehow missed
             handleAudioFileSelect(audioFile);
             if (!audioFileLoaded) { // Check again if handleAudioFileSelect failed
                  generateStatus.textContent = translate('audioErrorGeneric') + "Could not load audio."; // Generic error
                  generateStatus.style.color = 'red';
                  generateStatus.dataset.translateKey = 'audioErrorGeneric';
                  return;
             }
             // Give audio a moment to load metadata if just selected
             await new Promise(resolve => setTimeout(resolve, 100));
        }


        generateStatus.textContent = translate('generatingStatus'); // Keep this key
        generateStatus.style.color = 'blue';
        generateStatus.dataset.translateKey = 'generatingStatus';
        generateStatus.classList.add('generating'); // Add class for animation
        generateTranscriptBtn.disabled = true; // Disable button during generation
        stopAutoSave(); // Stop autosave during generation
        clearAutoSaves(); // Clear old autosave before generating new content

        // --- START REAL API CALL ---
        try {
            // 1. Read audio file as base64
            const audioBase64 = await readFileAsBase64(audioFile); // Use imported function
            const audioMimeType = audioFile.type || 'audio/mpeg'; // Provide a default MIME type if needed

            // 2. Construct API payload for Gemini 1.5 Pro
            const requestBody = {
                contents: [
                    {
                        parts: [
                            // Simple prompt asking for VTT format
                            { "text": "Transcribe this audio file into VTT format. Ensure timestamps are in HH:MM:SS.sss format." },
                            {
                                "inline_data": {
                                    "mime_type": audioMimeType,
                                    "data": audioBase64
                                }
                            }
                        ]
                    }
                ],
                // Optional: Add generationConfig if needed, e.g., temperature
                // generationConfig: {
                //     "temperature": 0.2
                // }
            };

            // 3. Make API call to Gemini 1.5 Pro
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`; // Use 1.5 pro latest
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Handle cases where the error response is not JSON
                    errorData = { error: { message: response.statusText } };
                }
                console.error("API Error Response:", errorData);
                throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const responseData = await response.json();

            // 4. Extract VTT content - Check response structure carefully
            // Gemini 1.5 Pro response structure might differ slightly, adjust as needed
            const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                console.error("API Response did not contain expected text:", responseData);
                throw new Error("Failed to extract transcript from API response.");
            }

            // Clean potential markdown code block fences (```vtt ... ```)
            let vttContent = generatedText.replace(/^```vtt\s*|```$/g, '').trim();

            if (!vttContent.startsWith('WEBVTT')) {
                 console.warn("Generated content doesn't start with WEBVTT. Prepending it.");
                 vttContent = "WEBVTT\n\n" + vttContent;
            }

            // 5. Process and display
            transcriptData = parseVTT(vttContent); // Use imported function

            // Set generated filename
            originalVttFilename = `${audioBaseFilename}_generated.vtt`;
            vttFileNameSpan.textContent = originalVttFilename; // Display filename
            updateDefaultFilename(); // Update save filename based on generated name

            displayTranscription(transcriptData);
            vttFileLoaded = true; // Mark VTT as loaded (generated)
            checkFilesLoaded(); // Show the editor

            generateStatus.textContent = translate('generateSuccess');
            generateStatus.style.color = 'green';
            generateStatus.dataset.translateKey = 'generateSuccess';
            setTimeout(() => { generateStatus.textContent = ''; }, 5000); // Clear success message

        } catch (error) {
            console.error("Error during transcript generation:", error);
            generateStatus.textContent = `${translate('generateError')} ${error.message}`; // Add error message detail
            generateStatus.style.color = 'red';
            generateStatus.dataset.translateKey = 'generateError'; // Keep base key for re-translation
            vttFileLoaded = false; // Ensure VTT is not marked as loaded on error
            transcriptData = []; // Clear any partial data
            checkFilesLoaded(); // Update UI state
        } finally {
            generateTranscriptBtn.disabled = false; // Re-enable button
            generateStatus.classList.remove('generating'); // Remove class on finish
            // Restart autosave if files are now considered loaded
            if (audioFileLoaded && vttFileLoaded) {
                 startAutoSave();
            }
        }
        // --- END REAL API CALL ---
    });

    // --- Initial Setup ---
    function initializeApp() {
        // Load saved language preference
        const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const browserLang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
        setLanguage(savedLang || (translations[browserLang] ? browserLang : 'fi')); // Default to 'fi' if browser lang not supported

         // Load saved API key
        const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }

        // Try loading autosaved data
        const autosaveLoaded = loadAutoSave();


        // Set initial UI state only if autosave wasn't loaded (as loadAutoSave handles it)
        if (!autosaveLoaded) {
             checkFilesLoaded(); // Set initial view based on file status (should show choice)
        }

        // Hide elements that should only appear after load/generation
        mainContentDiv.classList.add('hidden');
        vttFileInfoDiv.classList.add('hidden');
        toggleFileInputsBtn.style.display = 'none';

        // Ensure initial choice is visible if nothing was autosaved/loaded
        if (!audioFileLoaded || !vttFileLoaded) {
            initialChoiceContainer.classList.remove('hidden');
            initialLoadMessageDiv.classList.remove('hidden'); // Show initial prompt
            fileInputContainer.classList.add('hidden');
            generateInputContainer.classList.add('hidden');
            sharedAudioInputContainer.classList.add('hidden');
        }
    }

    initializeApp(); // Run initialization


    // --- Cleanup ---
    window.addEventListener('beforeunload', () => {
        // Attempt to save one last time before unload
        autoSaveTranscript();
        stopAutoSave();

        // Revoke audio object URL
        if (currentAudioObjectURL) {
            URL.revokeObjectURL(currentAudioObjectURL);
            console.log("Revoked audio object URL on page unload.");
        }
    });

}); // DOMContentLoaded ends