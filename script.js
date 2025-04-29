document.addEventListener('DOMContentLoaded', () => {
    // Existing element references
    const audioFileInput = document.getElementById('audioFile');
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
    const audioFileGenerateInput = document.getElementById('audioFileGenerate'); // Separate audio input for generation
    const apiKeyInput = document.getElementById('apiKey');
    const generateTranscriptBtn = document.getElementById('generateTranscriptBtn');
    const generateStatus = document.getElementById('generateStatus');
    const vttFileInfoDiv = document.getElementById('vttFileInfo');
    const vttFileNameSpan = document.getElementById('vttFileName');
    const switchToEditorFromGenerateBtn = document.getElementById('switchToEditorFromGenerateBtn');


    // --- State Variables ---
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

    // --- Utility Functions ---
    function formatVttTime(seconds) {
        if (isNaN(seconds) || seconds < 0) seconds = 0; // Handle invalid inputs gracefully
        const date = new Date(0);
        date.setSeconds(seconds);
        // Format: HH:MM:SS.sss (ensure 3 decimal places)
        const timeStr = date.toISOString().substr(11, 12);
        // Ensure milliseconds part has 3 digits
        const parts = timeStr.split('.');
        const ms = (parts[1] || '000').padEnd(3, '0');
        return `${parts[0]}.${ms}`;
    }

    function parseVttTime(timeString) {
        const parts = timeString.split(':');
        let seconds = 0;
        if (parts.length === 3) { // HH:MM:SS.sss
            seconds += parseFloat(parts[0]) * 3600;
            seconds += parseFloat(parts[1]) * 60;
            seconds += parseFloat(parts[2].replace(',', '.'));
        } else if (parts.length === 2) { // MM:SS.sss
            seconds += parseFloat(parts[0]) * 60;
            seconds += parseFloat(parts[1].replace(',', '.'));
        } else {
            // Use translation for error message
            throw new Error(translate('vttInvalidTimeFormat', { timeString }));
        }
        return seconds;
    }

    function parseVttTimeToSeconds(timeString) {
        // Allow flexibility: optional hours, comma or dot for milliseconds
        const timeRegex = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;
        const match = timeString.match(timeRegex);
        if (!match) {
            return NaN; // Invalid format
        }
        // Extract parts, providing 0 for missing hours
        const hours = match[1] ? parseInt(match[1], 10) : 0;
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const milliseconds = parseInt((match[4] || '0').padEnd(3, '0'), 10); // Pad ms

        if (minutes >= 60 || seconds >= 60 || hours < 0 || minutes < 0 || seconds < 0 || milliseconds < 0) {
            return NaN; // Invalid time components
        }

        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }

    // Helper function to read file as base64
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // result contains the Data URL (e.g., "data:audio/mpeg;base64,...")
                // We need to extract only the base64 part
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file); // Read as Data URL to get base64
        });
    }

    function parseVTT(vttContent) {
        const lines = vttContent.split(/\r?\n/);
        const cues = [];
        let currentCue = null;
        let lineIndex = 0;
        let cueNumber = 1; // For more specific error reporting

        // Skip initial lines (WEBVTT, comments, empty lines)
        while (lineIndex < lines.length && (lines[lineIndex].trim() === "" || lines[lineIndex].trim().toUpperCase().startsWith("WEBVTT") || lines[lineIndex].trim().startsWith("NOTE") || lines[lineIndex].trim().startsWith("COMMENT"))) {
            lineIndex++;
        }

        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();

            // Skip potential cue identifiers (numeric or otherwise) that might appear before the timestamp
            // and empty lines between cues
            if (line === "" || /^\d+$/.test(line)) {
                 lineIndex++;
                 continue;
            }


            if (line.includes('-->')) {
                // Timestamp line found
                try {
                    const [startStr, endStr] = line.split('-->').map(s => s.trim().split(' ')[0]); // Handle potential style info after time
                    const start = timeToSeconds(startStr);
                    const end = timeToSeconds(endStr);

                    if (isNaN(start) || isNaN(end)) {
                        throw new Error(`Invalid time value in timestamp line: ${line}`);
                    }
                    if (start >= end) {
                         console.warn(`Warning: Cue ${cueNumber} start time (${startStr}) is not before end time (${endStr}). Line ${lineIndex + 1}`);
                         // Allow it, but maybe flag it later? For now, just warn.
                    }


                    currentCue = { start, end, textLines: [] };
                    // Find text lines on subsequent lines
                    lineIndex++;
                    while (lineIndex < lines.length && lines[lineIndex].trim() !== "") {
                        currentCue.textLines.push(lines[lineIndex].trim()); // Keep original lines for VTT output
                        lineIndex++;
                    }
                    // Join lines with newline for internal text representation
                    currentCue.text = currentCue.textLines.join('\n');
                    cues.push(currentCue);
                    cueNumber++;

                } catch (error) {
                     // Use translation for error message
                     console.error(translate('vttTimestampParseError', { lineNumber: lineIndex + 1, line }), error);
                     // Attempt to recover by skipping to the next potential cue start (empty line or timestamp)
                     while (lineIndex < lines.length && lines[lineIndex].trim() !== "" && !lines[lineIndex].includes('-->')) {
                         lineIndex++;
                     }
                }

            } else {
                // Unexpected line, skip it and hope to find the next timestamp or empty line
                // console.warn(`Skipping unexpected line ${lineIndex + 1}: "${line}"`);
                lineIndex++;
            }
        }
        console.log("Parsed VTT data:", cues);
        return cues;
    }


    // --- Display Update ---
    function displayTranscription(cues) {
        originalTranscriptDiv.innerHTML = ''; // Clear previous original transcript
        timestampEditorDiv.innerHTML = ''; // Clear previous timestamp inputs
        previousSegmentsDiv.innerHTML = ''; // Clear previous segments
        nextSegmentsDiv.innerHTML = ''; // Clear next segments
        // editableText variable is no longer needed as we populate the focused view directly

        cues.forEach((cue, index) => {
            // Alkuperäinen tekstitys elementteinä
            const cueElement = document.createElement('span');
            // Display only text in original view for cleaner look? Or keep timestamps? Keeping for now.
            cueElement.textContent = `[${formatVttTime(cue.start)} - ${formatVttTime(cue.end)}] ${cue.text}`; // Use VTT time format
            cueElement.dataset.start = cue.start;
            cueElement.dataset.end = cue.end;
            cueElement.id = `cue-${index}`; // Yksilöllinen ID

            // Lisää klikkauskuuntelija aikahyppyä varten
            cueElement.addEventListener('click', () => {
                if (!isNaN(cue.start)) {
                    audioPlayer.currentTime = cue.start;
                    // Update the focused view to this segment
                    updateFocusedSegmentView(index);
                    // Ensure the clicked element is scrolled into view if needed
                    // Use 'nearest' to minimize scrolling, keeping player potentially visible
                    cueElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            });

            originalTranscriptDiv.appendChild(cueElement);
            cue.element = cueElement; // Tallenna viittaus elementtiin

            // Create timestamp inputs for the editor column
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

    // Helper function to create context segments
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

    // Update function to handle the focused segment display
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
            // If index === currentEditingIndex, we still might need to update context if data changed,
            // but let's avoid full redraw unless necessary. For now, return if index hasn't changed.
             if (index === currentEditingIndex) return;

        }

        // Save any changes from the current segment before switching
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
            const currentText = editableTranscriptTextarea.value; // Don't trim here, preserve user spacing
            if (currentText !== transcriptData[currentEditingIndex].text) {
                transcriptData[currentEditingIndex].text = currentText;
                // Update the original display text content (optional, can slow down UI)
                // if (transcriptData[currentEditingIndex].element) {
                //     transcriptData[currentEditingIndex].element.textContent =
                //         `[${formatVttTime(transcriptData[currentEditingIndex].start)} - ${formatVttTime(transcriptData[currentEditingIndex].end)}] ${currentText}`;
                // }
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
        const currentText = createContextSegment(transcriptData[index], index, true);
        editableTranscriptTextarea.value = currentText || '';
        currentEditingIndex = index; // Update the index *after* potential save

        // Add next segment (only 1)
        if (index < transcriptData.length - 1) {
            const segment = createContextSegment(transcriptData[index + 1], index + 1);
            if (segment) nextSegmentsDiv.appendChild(segment);
        }

         // Highlight the corresponding timestamp pair in the editor
         highlightTimestampPair(index);
         // Ensure the editable column scrolls the focused element into view
         // We need to scroll the container (#editableColumnContent)
         const timestampPairDiv = document.getElementById(`ts-pair-${index}`);
         if (timestampPairDiv && editableColumnContentDiv) {
             // Calculate position relative to the scroll container
             const containerRect = editableColumnContentDiv.getBoundingClientRect();
             const elementRect = timestampPairDiv.getBoundingClientRect();
             const offsetTop = elementRect.top - containerRect.top + editableColumnContentDiv.scrollTop;

             // Scroll smoothly, keeping the element centered if possible
             editableColumnContentDiv.scrollTo({
                 top: offsetTop - (containerRect.height / 2) + (elementRect.height / 2), // Center vertically
                 behavior: 'smooth'
             });
         }
    }

    // --- Timestamp Input Handling ---
    function validateAndUpdateTimestamp(inputElement) {
        const cueIndex = parseInt(inputElement.dataset.cueIndex, 10);
        const timeType = inputElement.dataset.timeType; // 'start' or 'end'
        const timeString = inputElement.value;
        let isValid = false;
        let seconds = NaN;

        // Only proceed if data exists for this index
        if (!transcriptData[cueIndex]) return false;

        seconds = parseVttTimeToSeconds(timeString);

        if (isNaN(seconds)) {
            inputElement.classList.add('invalid');
            inputElement.title = translate('vttInvalidEditableTimeFormat');
        } else {
            // Basic format is valid, now check logic (start < end)
            const otherTimeType = timeType === 'start' ? 'end' : 'start';
            const otherInputElement = transcriptData[cueIndex][`${otherTimeType}TimestampInput`];
            const otherTimeValue = transcriptData[cueIndex][otherTimeType]; // Get the current value from data

            let timesAreValid = false;
            if (timeType === 'start' && seconds < otherTimeValue) {
                timesAreValid = true;
            } else if (timeType === 'end' && seconds > otherTimeValue) {
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
                    // Re-validate the other input implicitly by checking times again
                    const otherSeconds = parseVttTimeToSeconds(otherInputElement.value);
                    if (!isNaN(otherSeconds)) {
                         if ((timeType === 'start' && seconds < otherSeconds) || (timeType === 'end' && seconds > otherSeconds)) {
                              otherInputElement.classList.remove('invalid');
                              otherInputElement.title = `${otherTimeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;
                         }
                    }
                }

                // Update the corresponding original transcript display
                if (transcriptData[cueIndex].element) {
                     transcriptData[cueIndex].element.textContent =
                         `[${formatVttTime(transcriptData[cueIndex].start)} - ${formatVttTime(transcriptData[cueIndex].end)}] ${transcriptData[cueIndex].text}`;
                }
                 // Update context view timestamps if visible
                 updateContextTimestamps(cueIndex);


            } else {
                // Format is valid, but start >= end
                inputElement.classList.add('invalid');
                inputElement.title = timeType === 'start' ? 'Start time must be before end time.' : 'End time must be after start time.';
                // Also mark the other input as invalid for clarity
                otherInputElement?.classList.add('invalid');
                otherInputElement?.setAttribute('title', otherInputElement.dataset.timeType === 'start' ? 'Start time must be before end time.' : 'End time must be after start time.');
            }
        }
        return isValid;
    }

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

    function handleTimestampChange(event) {
        // Perform full validation (format and logic) when input loses focus or value is committed
        validateAndUpdateTimestamp(event.target);
    }

    // Helper to update timestamps in context view if the edited cue is visible there
    function updateContextTimestamps(cueIndex) {
        const contextElements = [
            ...previousSegmentsDiv.querySelectorAll('.context-segment'),
            ...nextSegmentsDiv.querySelectorAll('.context-segment')
        ];
        contextElements.forEach(el => {
            if (parseInt(el.dataset.index, 10) === cueIndex) {
                const timestampIndicator = el.querySelector('.timestamp-indicator');
                if (timestampIndicator && transcriptData[cueIndex]) {
                    timestampIndicator.textContent = `[${formatVttTime(transcriptData[cueIndex].start)} - ${formatVttTime(transcriptData[cueIndex].end)}]`;
                }
            }
        });
    }


    // --- Timestamp Formatting ---
    function formatDisplayTime(seconds) {
        if (isNaN(seconds) || seconds < 0) {
            return "00:00";
        }
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(secs).padStart(2, '0');

        if (hours > 0) {
            const paddedHours = String(hours).padStart(2, '0');
            return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
        } else {
            return `${paddedMinutes}:${paddedSeconds}`;
        }
    }

    // --- Playback Synchronization ---
    function highlightTimestampPair(indexToHighlight) {
         // Remove highlight from previously active pair
         const currentHighlighted = timestampEditorDiv.querySelector('.timestamp-pair.highlight');
         currentHighlighted?.classList.remove('highlight');

         // Add highlight to the new pair
         const timestampPairDiv = document.getElementById(`ts-pair-${indexToHighlight}`);
         if (timestampPairDiv) {
             timestampPairDiv.classList.add('highlight');
             // Scrolling is handled in updateFocusedSegmentView now
             // timestampPairDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
                    activeCue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }

                // Update the focused segment view only if the *cue* changes
                // and the textarea doesn't have focus (to avoid disrupting typing)
                if (document.activeElement !== editableTranscriptTextarea) {
                    updateFocusedSegmentView(newActiveCueIndex);
                } else {
                    // If textarea has focus, just highlight the timestamp pair without stealing focus
                    highlightTimestampPair(newActiveCueIndex);
                }
                // Highlight original transcript element regardless of focus
                 if (activeCue?.element) {
                     activeCue.element.classList.add('highlight');
                     activeCue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                 }
            }

            activeCueIndex = newActiveCueIndex;
        }
        // Update current time display continuously
        currentTimeSpan.textContent = formatVttTime(currentTime);
    }

    // --- State Management ---
    function checkFilesLoaded() {
        if (audioFileLoaded && vttFileLoaded) {
            // Files are loaded, show the main editor content
            mainContentDiv.classList.remove('hidden');
            vttFileInfoDiv.classList.remove('hidden');
            toggleFileInputsBtn.style.display = 'inline-block'; // Show toggle button
            initialChoiceContainer.classList.add('hidden'); // Hide initial choice
            fileInputContainer.classList.add('hidden'); // Hide file inputs
            generateInputContainer.classList.add('hidden'); // Hide generate inputs
            initialLoadMessageDiv.classList.add('hidden');
            switchToEditorBtn.style.display = 'none'; // Ensure hidden when editor loads
            switchToEditorFromGenerateBtn.style.display = 'none'; // Ensure hidden
            saveButton.disabled = false; // Enable save button
        } else {
            // Files not yet loaded, ensure main content is hidden and show prompt
            mainContentDiv.classList.add('hidden');
            vttFileInfoDiv.classList.add('hidden');
            toggleFileInputsBtn.style.display = 'none'; // Hide toggle button
            initialChoiceContainer.classList.remove('hidden'); // Show initial choice
            initialLoadMessageDiv.classList.remove('hidden'); // Show prompt message
            saveButton.disabled = true; // Disable save button
        }
        // Update translations for dynamically shown/hidden elements if needed
        updateTranslations();
    }

    // --- View Switching Logic ---

    function returnToEditorView() {
        if (audioFileLoaded && vttFileLoaded) {
            mainContentDiv.classList.remove('hidden');
            vttFileInfoDiv.classList.remove('hidden');
            toggleFileInputsBtn.style.display = 'inline-block'; // Show toggle button

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

    loadExistingBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden'); // Ensure generate is hidden
        fileInputContainer.classList.remove('hidden');
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
        // Show "Return to Editor" button only if files are already loaded
        if (audioFileLoaded && vttFileLoaded) {
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
        fileInputContainer.classList.add('hidden'); // Hide specific inputs initially
        generateInputContainer.classList.add('hidden'); // Hide specific inputs initially
        switchToEditorBtn.style.display = 'none'; // Hide return button
        switchToEditorFromGenerateBtn.style.display = 'none'; // Hide return button
    });

    // Add event listeners for the "Return to Editor" buttons
    switchToEditorBtn.addEventListener('click', returnToEditorView);
    switchToEditorFromGenerateBtn.addEventListener('click', returnToEditorView);


    // --- Event Listeners for File Inputs ---
    audioFileInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
        checkFilesLoaded(); // Check if both files are now loaded
    });

    audioFileGenerateInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
        // Don't call checkFilesLoaded here, wait for generation or explicit action
    });


    vttFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            stopAutoSave();
            clearAutoSaves();
            lastAutoSavedContent = '';

            originalVttFilename = file.name;
            vttFileNameSpan.textContent = originalVttFilename; // Display VTT filename
            updateDefaultFilename();

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    transcriptData = parseVTT(e.target.result);
                    displayTranscription(transcriptData);
                    console.log("VTT file loaded and parsed:", file.name);
                    vttFileLoaded = true; // Mark as loaded
                    checkFilesLoaded(); // Show the editor
                } catch (error) {
                    console.error("VTT parsing error:", error);
                    originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttParseError')}</p>`;
                    editableTranscriptTextarea.value = "";
                    vttFileLoaded = false; // Mark as not loaded on error
                    checkFilesLoaded(); // Update UI state
                    vttFileNameSpan.textContent = ''; // Clear filename on error
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading VTT file:", e);
                originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttReadError')}</p>`;
                editableTranscriptTextarea.value = "";
                vttFileLoaded = false; // Mark as not loaded on error
                checkFilesLoaded(); // Update UI state
                vttFileNameSpan.textContent = ''; // Clear filename on error
            };
            reader.readAsText(file);
        } else {
             vttFileLoaded = false; // Mark as not loaded if selection is cancelled
             vttFileNameSpan.textContent = ''; // Clear filename if selection cancelled
             checkFilesLoaded();
        }
    });

    // --- Playback Speed Control ---
    playbackSpeedSelect.addEventListener('change', (event) => {
        const speed = parseFloat(event.target.value);
        if (!isNaN(speed)) {
            audioPlayer.playbackRate = speed;
            console.log(`Playback speed set to ${speed}x`);
        }
    });


    // --- Transcript Generation ---
    generateTranscriptBtn.addEventListener('click', async () => { // Add async
        const audioFile = audioFileGenerateInput.files[0];
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

        // Ensure audio is loaded into the player if not already
        if (!audioPlayer.src || !audioFileLoaded) {
             handleAudioFileSelect(audioFile);
             if (!audioFileLoaded) { // Check again if handleAudioFileSelect failed
                  generateStatus.textContent = translate('audioErrorGeneric') + "Could not load audio."; // Generic error
                  generateStatus.style.color = 'red';
                  generateStatus.dataset.translateKey = 'audioErrorGeneric';
                  return;
             }
        }


        generateStatus.textContent = translate('generatingStatus'); // Keep this key
        generateStatus.style.color = 'blue';
        generateStatus.dataset.translateKey = 'generatingStatus';
        generateStatus.classList.add('generating'); // Add class for animation
        generateTranscriptBtn.disabled = true; // Disable button during generation

        // --- START REAL API CALL ---
        try {
            // 1. Read audio file as base64
            const audioBase64 = await readFileAsBase64(audioFile);
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
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent?key=${apiKey}`; // Updated model name
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
            const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                console.error("API Response did not contain expected text:", responseData);
                throw new Error("Failed to extract transcript from API response.");
            }

            // Clean potential markdown code block fences (```vtt ... ```)
            const vttContent = generatedText.replace(/^```vtt\s*|```$/g, '').trim();

            if (!vttContent.startsWith('WEBVTT')) {
                 console.warn("Generated content doesn't start with WEBVTT. Prepending it.");
                 vttContent = "WEBVTT\n\n" + vttContent;
            }

            // 5. Process and display
            transcriptData = parseVTT(vttContent); // Use existing parser

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
            checkFilesLoaded(); // Update UI state
        } finally {
            generateTranscriptBtn.disabled = false; // Re-enable button
            generateStatus.classList.remove('generating'); // Remove class on finish
        }
        // --- END REAL API CALL ---
    });

    // --- Initial Setup ---
    // Hide main content and file info initially
    mainContentDiv.classList.add('hidden');
    vttFileInfoDiv.classList.add('hidden');
    fileInputContainer.classList.add('hidden');
    generateInputContainer.classList.add('hidden');
    toggleFileInputsBtn.style.display = 'none'; // Hide the reset button initially
    initialLoadMessageDiv.classList.add('hidden'); // Ensure message is hidden initially

    // Show initial choice
    initialChoiceContainer.classList.remove('hidden');


    // --- Cleanup ---
    window.addEventListener('beforeunload', () => {
        stopAutoSave();
        // Save final state before unloading? Could be annoying if user is just refreshing.
        // autoSaveTranscript(); // Uncomment to force save on exit

        if (currentAudioObjectURL) {
            URL.revokeObjectURL(currentAudioObjectURL);
            console.log("Revoked audio object URL on page unload.");
        }
    });

}); // DOMContentLoaded ends