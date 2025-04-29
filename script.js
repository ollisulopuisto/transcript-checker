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
    let audioBaseFilename = 'transcript';
    let currentAudioObjectURL = null;
    let transcriptData = [];
    let originalVttFilename = 'transcript.vtt'; // Can be loaded or generated name
    let activeCueIndex = -1;
    let currentEditingIndex = -1;
    let pausedForEditing = false;
    let currentMode = null; // 'load' or 'generate'

    // --- Auto-save constants and state ---
    const AUTO_SAVE_INTERVAL = 5000;
    const MAX_AUTOSAVE_VERSIONS = 20;
    const AUTOSAVE_KEY_PREFIX = 'autosave_transcript_';
    let lastAutoSavedContent = '';
    let autoSaveIntervalId = null;

    // --- i18n Translations ---
    // The 'translations' object is now loaded from translations.js

    // --- i18n Functions ---
    function getBrowserLanguage() {
        // This function is no longer the primary source for language setting,
        // but can be kept for potential future use or initial default.
        const lang = navigator.language || navigator.userLanguage || 'en';
        const primaryLang = lang.split('-')[0].toLowerCase();
        return translations[primaryLang] ? primaryLang : 'en'; // Fallback to 'en'
    }

    function translate(key, replacements = {}) {
        let text = translations[currentLang]?.[key] || translations.en[key] || `[${key}]`; // Fallback chain
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    }

    function translateUI() {
        // currentLang should be set before calling this function
        htmlElement.lang = currentLang; // Set lang attribute on <html> tag
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLang); // Save selected language

        document.querySelectorAll('[data-translate-key]').forEach(element => {
            const key = element.dataset.translateKey;
            const translation = translate(key);
            if (element.tagName === 'TEXTAREA' && element.placeholder) {
                element.placeholder = translation;
            } else if (element.tagName === 'TITLE') {
                 document.title = translation;
            } else if (element.tagName === 'INPUT' && element.placeholder) { // Translate placeholders for inputs
                 element.placeholder = translation;
            } else {
                // Handle specific cases like button text if needed, otherwise default
                element.textContent = translation;
            }
        });
        // Update dynamic elements if needed
        if (!vttFileLoaded) { // Check vttFileLoaded instead of input files
             const loadPrompt = document.querySelector('#originalTranscript p');
             if (loadPrompt) loadPrompt.textContent = translate('loadFilesPrompt');
             // Update initial load message if it's visible
             const initialMsgP = document.querySelector('#initialLoadMessage p');
             if (initialMsgP && !initialLoadMessageDiv.classList.contains('hidden')) {
                 initialMsgP.textContent = translate('loadFilesPrompt');
             }
        }
         const editablePlaceholder = document.getElementById('editableTranscript');
         if (editablePlaceholder) editablePlaceholder.placeholder = translate('editableTranscriptPlaceholder');

         // Update VTT source label if visible
         const vttSourceLabel = document.querySelector('#vttFileInfo span');
         if (vttSourceLabel) vttSourceLabel.textContent = translate('vttSourceLabel');

         // Update API Key label
         const apiKeyLabel = document.querySelector('label[for="apiKey"]');
         if (apiKeyLabel) apiKeyLabel.textContent = translate('apiKeyLabel');
    }


    // --- Initial Setup ---
    currentLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'fi';
    translateUI();
    // Load API Key from local storage
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
    loadLatestAutoSave();
    saveButton.disabled = true;
    // Initial state: Show choice, hide inputs and main content
    initialChoiceContainer.classList.remove('hidden');
    fileInputContainer.classList.add('hidden');
    generateInputContainer.classList.add('hidden');
    mainContentDiv.classList.add('hidden');
    initialLoadMessageDiv.classList.add('hidden');
    vttFileInfoDiv.classList.add('hidden');


    // --- Initial Choice Handling ---
    loadExistingBtn.addEventListener('click', () => {
        currentMode = 'load';
        initialChoiceContainer.classList.add('hidden');
        fileInputContainer.classList.remove('hidden');
        generateInputContainer.classList.add('hidden');
        initialLoadMessageDiv.classList.remove('hidden'); // Show load prompt
        // Ensure audio input in generate container doesn't interfere
        audioFileGenerateInput.value = null;
        checkFilesLoaded(); // Update UI based on current state (likely nothing loaded yet)
    });

    generateNewBtn.addEventListener('click', () => {
        currentMode = 'generate';
        initialChoiceContainer.classList.add('hidden');
        fileInputContainer.classList.add('hidden');
        generateInputContainer.classList.remove('hidden');
        initialLoadMessageDiv.classList.add('hidden'); // Hide load prompt
        // Ensure audio/vtt inputs in load container don't interfere
        audioFileInput.value = null;
        vttFileInput.value = null;
        checkFilesLoaded(); // Update UI based on current state
    });


    // --- File Loading Visibility Toggle ---
    function checkFilesLoaded() {
        const editorReady = audioFileLoaded && vttFileLoaded;

        if (editorReady) {
            // Editor is ready, hide inputs, show editor and toggle button
            fileInputContainer.classList.add('hidden');
            generateInputContainer.classList.add('hidden');
            toggleFileInputsBtn.style.display = 'block';
            mainContentDiv.classList.remove('hidden');
            initialLoadMessageDiv.classList.add('hidden');
            saveButton.disabled = false;
            switchToEditorBtn.style.display = 'none';
            switchToEditorFromGenerateBtn.style.display = 'none';
            vttFileInfoDiv.classList.remove('hidden'); // Show VTT source info
        } else {
            // Editor not ready, hide editor, show relevant inputs
            mainContentDiv.classList.add('hidden');
            saveButton.disabled = true;
            toggleFileInputsBtn.style.display = 'none';
            vttFileInfoDiv.classList.add('hidden'); // Hide VTT source info

            // Show the correct input container based on mode
            if (currentMode === 'load') {
                fileInputContainer.classList.remove('hidden');
                generateInputContainer.classList.add('hidden');
                initialLoadMessageDiv.classList.remove('hidden'); // Show "load files" prompt
                // Show "Return to Editor" only if files *were* previously loaded in 'load' mode
                const wereFilesLoaded = transcriptData.length > 0 && audioPlayer.src;
                switchToEditorBtn.style.display = wereFilesLoaded ? 'block' : 'none';
                switchToEditorFromGenerateBtn.style.display = 'none';
            } else if (currentMode === 'generate') {
                fileInputContainer.classList.add('hidden');
                generateInputContainer.classList.remove('hidden');
                initialLoadMessageDiv.classList.add('hidden');
                // Show "Return to Editor" only if generation *was* completed
                const wasGenerated = transcriptData.length > 0 && audioPlayer.src;
                switchToEditorFromGenerateBtn.style.display = wasGenerated ? 'block' : 'none';
                switchToEditorBtn.style.display = 'none';
            } else {
                // No mode selected yet (initial state)
                initialChoiceContainer.classList.remove('hidden');
                fileInputContainer.classList.add('hidden');
                generateInputContainer.classList.add('hidden');
                initialLoadMessageDiv.classList.add('hidden');
                switchToEditorBtn.style.display = 'none';
                switchToEditorFromGenerateBtn.style.display = 'none';
            }
        }
    }

    toggleFileInputsBtn.addEventListener('click', () => {
        // Reset everything and show the initial choice
        currentMode = null;
        audioFileLoaded = false;
        vttFileLoaded = false;

        // Hide editor and toggle button
        mainContentDiv.classList.add('hidden');
        toggleFileInputsBtn.style.display = 'none';
        vttFileInfoDiv.classList.add('hidden');

        // Show initial choice, hide input containers
        initialChoiceContainer.classList.remove('hidden');
        fileInputContainer.classList.add('hidden');
        generateInputContainer.classList.add('hidden');
        initialLoadMessageDiv.classList.add('hidden');
        switchToEditorBtn.style.display = 'none';
        switchToEditorFromGenerateBtn.style.display = 'none';

        saveButton.disabled = true;

        // Clear existing content
        if (currentAudioObjectURL) {
            URL.revokeObjectURL(currentAudioObjectURL);
            currentAudioObjectURL = null;
        }
        audioPlayer.removeAttribute('src');
        audioPlayer.load();

        originalTranscriptDiv.innerHTML = '';
        timestampEditorDiv.innerHTML = '';
        previousSegmentsDiv.innerHTML = '';
        nextSegmentsDiv.innerHTML = '';
        editableTranscriptTextarea.value = '';
        transcriptData = [];
        currentEditingIndex = -1;
        activeCueIndex = -1;
        stopAutoSave();
        saveStatus.textContent = '';
        generateStatus.textContent = ''; // Clear generation status too
        saveFilenameInput.value = 'modified_transcript.txt';
        vttFileNameSpan.textContent = ''; // Clear VTT file name display

        // Reset file input values
        audioFileInput.value = null;
        vttFileInput.value = null;
        audioFileGenerateInput.value = null; // Reset generate audio input too
        apiKeyInput.value = ''; // Clear API key input field
        localStorage.removeItem(API_KEY_STORAGE_KEY); // Remove API key from storage

        console.log("Reset to initial choice.");
    });

    // --- Listeners for the "Return to Editor" buttons ---
    switchToEditorBtn.addEventListener('click', () => {
        // Used in 'load' mode
        fileInputContainer.classList.add('hidden');
        switchToEditorBtn.style.display = 'none';
        toggleFileInputsBtn.style.display = 'block';
        mainContentDiv.classList.remove('hidden');
        initialLoadMessageDiv.classList.add('hidden');
        vttFileInfoDiv.classList.remove('hidden');
        saveButton.disabled = false;
        // Assume files are loaded if this button was visible
        audioFileLoaded = true;
        vttFileLoaded = true;
    });

    switchToEditorFromGenerateBtn.addEventListener('click', () => {
        // Used in 'generate' mode
        generateInputContainer.classList.add('hidden');
        switchToEditorFromGenerateBtn.style.display = 'none';
        toggleFileInputsBtn.style.display = 'block';
        mainContentDiv.classList.remove('hidden');
        initialLoadMessageDiv.classList.add('hidden');
        vttFileInfoDiv.classList.remove('hidden');
        saveButton.disabled = false;
        // Assume files are loaded if this button was visible
        audioFileLoaded = true;
        vttFileLoaded = true;
    });


    // --- Language Selection ---
    langBtnEn.addEventListener('click', () => {
        currentLang = 'en';
        translateUI();
        // Re-format autosave message if present
        loadLatestAutoSave(true); // Pass flag to indicate it's just a language change
        // Re-translate status messages if visible
        if (generateStatus.textContent) generateStatus.textContent = translate(generateStatus.dataset.translateKey || '');
        if (saveStatus.textContent) saveStatus.textContent = translate(saveStatus.dataset.translateKey || '', { filename: saveFilenameInput.value });
    });

    langBtnFi.addEventListener('click', () => {
        currentLang = 'fi';
        translateUI();
        // Re-format autosave message if present
        loadLatestAutoSave(true); // Pass flag to indicate it's just a language change
        // Re-translate status messages if visible
        if (generateStatus.textContent) generateStatus.textContent = translate(generateStatus.dataset.translateKey || '');
        if (saveStatus.textContent) saveStatus.textContent = translate(saveStatus.dataset.translateKey || '', { filename: saveFilenameInput.value });
    });


    // --- Audio File Handling (Common Function) ---
    function handleAudioFileSelect(file) {
        if (file) {
            if (currentAudioObjectURL) {
                URL.revokeObjectURL(currentAudioObjectURL);
            }
            currentAudioObjectURL = URL.createObjectURL(file);
            audioPlayer.src = currentAudioObjectURL;
            console.log("Audio file loaded:", file.name);

            const lastDotIndex = file.name.lastIndexOf('.');
            audioBaseFilename = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
            updateDefaultFilename(); // Update save filename
            audioFileLoaded = true;
        } else {
            audioFileLoaded = false;
            if (currentAudioObjectURL) {
                URL.revokeObjectURL(currentAudioObjectURL);
                currentAudioObjectURL = null;
                audioPlayer.removeAttribute('src');
                audioPlayer.load();
            }
        }
        checkFilesLoaded(); // Check if editor can be shown
    }

    // --- File Input Listeners ---
    // Listener for the 'load' mode audio input
    audioFileInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
    });

    // Listener for the 'generate' mode audio input
    audioFileGenerateInput.addEventListener('change', (event) => {
        handleAudioFileSelect(event.target.files[0]);
        // In generate mode, loading audio doesn't immediately show the editor
        // checkFilesLoaded() is called inside handleAudioFileSelect, which is fine.
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


    // --- VTT Parsing ---
    function timeToSeconds(timeString) {
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

    // NEW: Function to parse HH:MM:SS.sss format from input fields
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
        originalTranscriptDiv.innerHTML = ''; // Tyhjennä vanha sisältö
        timestampEditorDiv.innerHTML = ''; // Clear timestamp editor
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
        }

        // Reset scroll positions when loading new content
        originalTranscriptDiv.scrollTop = 0;
        editableColumnContentDiv.scrollTop = 0; // Scroll the new container
        activeCueIndex = -1; // Reset active cue tracking

        // Start auto-saving after displaying new content
        lastAutoSavedContent = JSON.stringify(transcriptData.map(cue => ({ start: cue.start, end: cue.end, text: cue.text }))); // Initialize for auto-save check
        startAutoSave();
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
             // Scroll the highlighted pair into view if needed
             timestampPairDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
         }
    }


    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        currentTimeSpan.textContent = formatDisplayTime(currentTime);

        // --- Auto-pause logic ---
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
            const currentCue = transcriptData[currentEditingIndex];
            if (document.activeElement === editableTranscriptTextarea &&
                currentTime >= currentCue.end - 0.1 &&
                !audioPlayer.paused) {
                audioPlayer.pause();
                pausedForEditing = true;
                console.log("Paused for editing at end of segment", currentEditingIndex);
            }
        }

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
                updateFocusedSegmentView(newActiveCueIndex);
                // Highlight timestamp pair is handled within updateFocusedSegmentView now
            }

            activeCueIndex = newActiveCueIndex;
        }
    });

    // --- Blur/Play Listeners for Auto-pause ---
    editableTranscriptTextarea.addEventListener('blur', () => {
        if (pausedForEditing) {
            // Save potentially changed text on blur before resuming
            if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
                 const currentText = editableTranscriptTextarea.value;
                 if (currentText !== transcriptData[currentEditingIndex].text) {
                     transcriptData[currentEditingIndex].text = currentText;
                     // Optionally update original transcript display here too
                 }
            }
            audioPlayer.play().catch(e => console.error("Error resuming playback:", e));
            // pausedForEditing = false; // Reset in 'play' listener
            console.log("Resuming playback after editor blur.");
        } else {
             // Also save text if blurred without being paused by the auto-pause logic
             if (document.activeElement !== editableTranscriptTextarea && currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
                  const currentText = editableTranscriptTextarea.value;
                  if (currentText !== transcriptData[currentEditingIndex].text) {
                      transcriptData[currentEditingIndex].text = currentText;
                  }
             }
        }
    });

    audioPlayer.addEventListener('play', () => {
        if (pausedForEditing) {
            pausedForEditing = false;
            console.log("Manual resume detected, resetting pausedForEditing flag.");
        }
    });


    // --- Audio Player Metadata/Error Handling ---
     audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("Audio metadata loaded, duration:", audioPlayer.duration);
    });

     audioPlayer.addEventListener('error', (e) => {
        console.error("Audio playback error:", e);
        let errorKey = "audioErrorUnknown"; // Default error key
        if (audioPlayer.error) {
            switch (audioPlayer.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: errorKey = 'audioErrorAborted'; break;
                case MediaError.MEDIA_ERR_NETWORK: errorKey = 'audioErrorNetwork'; break;
                case MediaError.MEDIA_ERR_DECODE: errorKey = 'audioErrorDecode'; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorKey = 'audioErrorNotSupported'; break;
            }
        }
        const errorMessage = translate(errorKey);
        // Display error more prominently, perhaps in the generateStatus or saveStatus area?
        const statusArea = (currentMode === 'generate') ? generateStatus : saveStatus;
        statusArea.textContent = `${translate('audioErrorGeneric')}${errorMessage}`;
        statusArea.style.color = 'red';
        statusArea.dataset.translateKey = 'audioErrorGeneric'; // Store key for re-translation
    });


    // --- Transcript Generation (Simulated) ---
    generateTranscriptBtn.addEventListener('click', () => {
        const audioFile = audioFileGenerateInput.files[0];
        const apiKey = apiKeyInput.value.trim(); // Reads the API key

        if (!audioFile) {
            generateStatus.textContent = translate('noAudioForGeneration');
            generateStatus.style.color = 'red';
            generateStatus.dataset.translateKey = 'noAudioForGeneration';
            return;
        }

        // Optional: Check for API key if you intend to implement the real API call
        // if (!apiKey) {
        //     generateStatus.textContent = translate('noApiKey');
        //     generateStatus.style.color = 'red';
        //     generateStatus.dataset.translateKey = 'noApiKey';
        //     return;
        // }

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


        generateStatus.textContent = translate('generatingStatus');
        generateStatus.style.color = 'blue';
        generateStatus.dataset.translateKey = 'generatingStatus';
        generateTranscriptBtn.disabled = true; // Disable button during generation

        // --- SIMULATED API CALL ---
        console.log("Simulating Gemini API call for:", audioFile.name);
        setTimeout(() => {
            try {
                // Simulate a successful response with dummy VTT data
                const dummyVttContent = `WEBVTT

00:00:01.100 --> 00:00:03.500
This is the first generated cue.

00:00:04.000 --> 00:00:06.800
And here is a second line of text.
It can span multiple lines.

00:00:07.500 --> 00:00:10.000
A third and final cue for this simulation.
`;
                transcriptData = parseVTT(dummyVttContent);

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
                console.error("Error processing simulated generation:", error);
                generateStatus.textContent = translate('generateError');
                generateStatus.style.color = 'red';
                generateStatus.dataset.translateKey = 'generateError';
                vttFileLoaded = false; // Ensure VTT is not marked as loaded on error
                checkFilesLoaded(); // Update UI state
            } finally {
                generateTranscriptBtn.disabled = false; // Re-enable button
            }
        }, 2500); // Simulate 2.5 second delay
        // --- END SIMULATED API CALL ---
    });


    // --- Save Filename Update ---
    function updateDefaultFilename() {
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';
        let extension = '.txt';
        let baseName = '';

        // Determine the base name: use original VTT name if loaded, or generated name if generated
        if (currentMode === 'generate' && vttFileLoaded) {
            // Use the generated filename base (e.g., "audio_base_name_generated")
            const lastDotIndex = originalVttFilename.lastIndexOf('.');
            baseName = lastDotIndex > 0 ? originalVttFilename.substring(0, lastDotIndex) : originalVttFilename;
        } else if (currentMode === 'load' && vttFileLoaded) {
             // Use the loaded VTT filename base
             const lastDotIndex = originalVttFilename.lastIndexOf('.');
             baseName = lastDotIndex > 0 ? originalVttFilename.substring(0, lastDotIndex) : originalVttFilename;
        } else {
            // Fallback to audio base name if VTT isn't loaded/generated yet
            baseName = audioBaseFilename;
        }


        let suffix = '_modified'; // Default suffix

        if (selectedFormat === 'vtt') {
            extension = '.vtt';
            // Keep suffix as '_modified'
        } else if (selectedFormat === 'txt_ts') {
            extension = '.txt';
            suffix = '_modified_with_ts';
        } else { // txt_plain
            extension = '.txt';
            // Keep suffix as '_modified'
        }

        saveFilenameInput.value = `${baseName}${suffix}${extension}`;
    }
    saveFormatOptions.addEventListener('change', updateDefaultFilename);


    // --- Saving Modified Transcript ---
    saveButton.addEventListener('click', () => {
        if (saveButton.disabled) return;

        // Save current focused segment's text before proceeding
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             const currentText = editableTranscriptTextarea.value; // Preserve spacing
             if (currentText !== transcriptData[currentEditingIndex].text) {
                 transcriptData[currentEditingIndex].text = currentText;
             }
        }

        const filename = saveFilenameInput.value.trim() || 'modified_transcript.txt';
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';

        // Check for invalid timestamp inputs before saving formats that use them
        if (selectedFormat === 'vtt' || selectedFormat === 'txt_ts') {
            // Re-validate all timestamps before saving
            let invalidCount = 0;
            transcriptData.forEach(cue => {
                if (cue.startTimestampInput && !validateAndUpdateTimestamp(cue.startTimestampInput)) {
                    invalidCount++;
                }
                if (cue.endTimestampInput && !validateAndUpdateTimestamp(cue.endTimestampInput)) {
                    // Avoid double counting if both are invalid due to relation
                    if (!cue.startTimestampInput?.classList.contains('invalid')) {
                         invalidCount++;
                    }
                }
            });

            if (invalidCount > 0) {
                const firstInvalid = timestampEditorDiv.querySelector('input.invalid');
                saveStatus.textContent = `Cannot save: ${invalidCount} invalid timestamp(s) found. Please correct them (HH:MM:SS.sss, start < end).`;
                saveStatus.style.color = 'red';
                saveStatus.dataset.translateKey = ''; // Custom message
                firstInvalid?.focus(); // Focus the first invalid input
                return;
            }
        }

        if (transcriptData.length === 0) {
             saveStatus.textContent = translate('saveNoText');
             saveStatus.style.color = 'red';
             saveStatus.dataset.translateKey = 'saveNoText';
             return;
        }

        let outputContent = '';
        let blobType = 'text/plain;charset=utf-8';

        try {
            if (selectedFormat === 'txt_plain') {
                // Join all text blocks for plain text output
                outputContent = transcriptData.map(cue => cue.text).join('\n\n'); // Use raw text, separate by double newline
                blobType = 'text/plain;charset=utf-8';
            } else {
                // VTT and TXT_TS use the transcriptData directly
                if (selectedFormat === 'vtt') {
                    blobType = 'text/vtt';
                    let vttLines = ["WEBVTT", ""];
                    transcriptData.forEach((cue) => {
                        const start = formatVttTime(cue.start);
                        const end = formatVttTime(cue.end);
                        // Use original textLines if available and unchanged, otherwise use cue.text split by newline
                        const textContent = cue.text; // Use potentially modified text
                        vttLines.push(`${start} --> ${end}`);
                        // Handle multi-line text correctly for VTT
                        textContent.split('\n').forEach(line => vttLines.push(line));
                        vttLines.push(""); // Add empty line between cues
                    });
                    outputContent = vttLines.join('\n');
                } else if (selectedFormat === 'txt_ts') {
                    blobType = 'text/plain;charset=utf-8';
                    const textLines = transcriptData.map((cue) => {
                        const start = formatVttTime(cue.start);
                        const end = formatVttTime(cue.end);
                        const text = cue.text; // Use potentially modified text
                        return `[${start} - ${end}] ${text}`;
                    });
                    outputContent = textLines.join('\n\n'); // Separate blocks with double newline
                }
            }

            // Create and download blob
            const blob = new Blob([outputContent], { type: blobType });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            saveStatus.textContent = translate('saveSuccess', { filename });
            saveStatus.style.color = 'green';
            saveStatus.dataset.translateKey = 'saveSuccess';
            setTimeout(() => { saveStatus.textContent = ''; }, 5000);

        } catch (error) {
            console.error("Save error:", error);
            saveStatus.textContent = translate('saveError');
            saveStatus.style.color = 'red';
            saveStatus.dataset.translateKey = 'saveError';
        }
    });

    // --- Auto-save Functions ---
    function autoSaveTranscript() {
        if (mainContentDiv.classList.contains('hidden') || transcriptData.length === 0) {
            return; // Don't save if editor isn't visible or no data
        }

        // Save the currently edited segment text back to transcriptData before saving
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             const currentTextInEditor = editableTranscriptTextarea.value;
             if (currentTextInEditor !== transcriptData[currentEditingIndex].text) {
                 transcriptData[currentEditingIndex].text = currentTextInEditor;
                 // console.log(`Autosave updated cue ${currentEditingIndex} text.`);
             }
        }

        // Serialize the relevant data (timestamps and text) for comparison and saving
        const currentState = JSON.stringify(transcriptData.map(cue => ({
            start: cue.start,
            end: cue.end,
            text: cue.text
        })));

        if (currentState === lastAutoSavedContent) {
            return; // Don't save if content hasn't changed
        }

        try {
            const timestamp = Date.now();
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(AUTOSAVE_KEY_PREFIX))
                .sort();

            while (keys.length >= MAX_AUTOSAVE_VERSIONS) {
                const oldestKey = keys.shift();
                localStorage.removeItem(oldestKey);
                console.log("Removed oldest autosave:", oldestKey);
            }

            const newKey = AUTOSAVE_KEY_PREFIX + timestamp;
            localStorage.setItem(newKey, currentState);
            lastAutoSavedContent = currentState;
            console.log("Autosaved:", newKey);

            // Optionally provide subtle feedback
            // saveStatus.textContent = `Autosaved at ${new Date().toLocaleTimeString()}`;
            // saveStatus.style.color = 'grey';
            // saveStatus.dataset.translateKey = ''; // Indicate it's not a standard message

        } catch (error) {
            console.error("Autosave failed:", error);
            stopAutoSave();
            saveStatus.textContent = translate('autosaveFailed');
            saveStatus.style.color = 'red';
            saveStatus.dataset.translateKey = 'autosaveFailed';
        }
    }

    function startAutoSave() {
        stopAutoSave(); // Clear any existing interval first
        autoSaveIntervalId = setInterval(autoSaveTranscript, AUTO_SAVE_INTERVAL);
        console.log("Autosave started.");
    }

    function stopAutoSave() {
        if (autoSaveIntervalId) {
            clearInterval(autoSaveIntervalId);
            autoSaveIntervalId = null;
            console.log("Autosave stopped.");
        }
    }

    function clearAutoSaves() {
        try {
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(AUTOSAVE_KEY_PREFIX));
            keys.forEach(key => localStorage.removeItem(key));
            console.log("Cleared all autosaves.");
            lastAutoSavedContent = ''; // Reset tracker
        } catch (error) {
            console.error("Failed to clear autosaves:", error);
        }
    }


    function loadLatestAutoSave(isLanguageChange = false) {
        // Only attempt to load if no files are currently loaded and not just changing language
        if (!isLanguageChange && (audioFileLoaded || vttFileLoaded)) {
             console.log("Files already loaded or being loaded, skipping autosave restore check.");
             startAutoSave(); // Ensure autosave starts if files are loaded
             return;
        }

        try {
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(AUTOSAVE_KEY_PREFIX))
                .sort();

            if (keys.length > 0) {
                const latestKey = keys[keys.length - 1];
                const savedStateJSON = localStorage.getItem(latestKey);
                if (savedStateJSON) {
                    const savedData = JSON.parse(savedStateJSON);

                    if (Array.isArray(savedData) && savedData.length > 0) {
                        const timestamp = parseInt(latestKey.replace(AUTOSAVE_KEY_PREFIX, ''));
                        const timeString = new Date(timestamp).toLocaleTimeString(currentLang);

                        // If just changing language, update existing message if present
                        if (isLanguageChange && saveStatus.dataset.translateKey === 'autosaveLoaded') {
                             saveStatus.textContent = translate('autosaveLoaded', { time: timeString }) + (currentMode === 'generate' ? " Select audio to generate or load files." : " Load files to continue editing.");
                             return; // Don't proceed further
                        }

                        // Otherwise, if loading initially and no files are loaded
                        if (!audioFileLoaded && !vttFileLoaded) {
                            console.log("Found autosave data:", latestKey);
                            // Show message indicating autosave exists
                            saveStatus.textContent = translate('autosaveLoaded', { time: timeString }) + " Load files to continue editing.";
                            saveStatus.style.color = 'blue';
                            saveStatus.dataset.translateKey = 'autosaveLoaded'; // Mark this message

                            // Store the loaded state to potentially apply *after* files are loaded.
                            // This is complex. Simpler: just notify. User loads files, then normal flow.
                            // We *could* try to apply it if the loaded VTT matches the structure, but risky.
                            lastAutoSavedContent = savedStateJSON; // Keep track for comparison later
                        } else {
                             console.log("Files already loaded, skipping autosave restore to UI, but updating tracker.");
                             lastAutoSavedContent = savedStateJSON;
                        }
                    } else {
                         console.log("Autosave data is empty or invalid, skipping restore.");
                         lastAutoSavedContent = ''; // Reset tracker
                    }
                }
            } else {
                 lastAutoSavedContent = ''; // No autosaves found
            }
        } catch (error) {
            console.error("Failed to load or parse latest autosave:", error);
            lastAutoSavedContent = ''; // Reset tracker on error
        }
        // Start autosave interval regardless
        startAutoSave();
    }


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