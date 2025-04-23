document.addEventListener('DOMContentLoaded', () => {
    const audioFileInput = document.getElementById('audioFile');
    const vttFileInput = document.getElementById('vttFile');
    const audioPlayer = document.getElementById('audioPlayer');
    const originalTranscriptDiv = document.getElementById('originalTranscript');
    const editableTranscriptTextarea = document.getElementById('editableTranscript');
    const currentTimeSpan = document.getElementById('currentTime');
    const saveButton = document.getElementById('saveButton');
    const saveFilenameInput = document.getElementById('saveFilename');
    const saveStatus = document.getElementById('saveStatus');
    const htmlElement = document.documentElement; // Get the <html> element
    const saveFormatOptions = document.getElementById('saveFormatOptions'); // Container for format radios
    const fileInputContainer = document.getElementById('fileInputContainer'); // Added
    const toggleFileInputsBtn = document.getElementById('toggleFileInputsBtn'); // Added
    const langBtnEn = document.getElementById('langBtnEn'); // Added
    const langBtnFi = document.getElementById('langBtnFi'); // Added
    const LANGUAGE_STORAGE_KEY = 'transcriptCheckerLang'; // Added
    const timestampEditorDiv = document.getElementById('timestampEditor'); // Added
    const editableColumnContentDiv = document.getElementById('editableColumnContent'); // Added
    const mainContentDiv = document.getElementById('mainContent'); // Added for hiding/showing
    const initialLoadMessageDiv = document.getElementById('initialLoadMessage'); // Added
    const switchToEditorBtn = document.getElementById('switchToEditorBtn'); // Added
    const playbackSpeedSelect = document.getElementById('playbackSpeed'); // Added

    // --- Needed variables for focused segment editing ---
    const previousSegmentsDiv = document.getElementById('previousSegments');
    const nextSegmentsDiv = document.getElementById('nextSegments');
    let currentEditingIndex = -1; // Track which segment is currently being edited

    // --- i18n Translations ---
    // The 'translations' object is now loaded from translations.js
    // Remove the large const translations = { ... }; block from here.

    let currentLang = 'fi'; // Default language, will be overwritten by localStorage or initial load
    let audioFileLoaded = false; // Added state tracker
    let vttFileLoaded = false;   // Added state tracker
    let audioBaseFilename = 'transcript'; // Added: Store base name of audio file
    let currentAudioObjectURL = null; // Added: Store the current object URL

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
            } else {
                element.textContent = translation;
            }
        });
        // Update dynamic elements if needed (e.g., initial placeholder if not set by attribute)
        if (!vttFileInput.files || vttFileInput.files.length === 0) {
             const loadPrompt = document.querySelector('#originalTranscript p');
             if (loadPrompt) loadPrompt.textContent = translate('loadFilesPrompt');
        }
         const editablePlaceholder = document.getElementById('editableTranscript');
         if (editablePlaceholder) editablePlaceholder.placeholder = translate('editableTranscriptPlaceholder');

         // Translate playback speed label specifically if needed (already covered by data-translate-key)
         // const playbackLabel = document.querySelector('label[for="playbackSpeed"]');
         // if (playbackLabel) playbackLabel.textContent = translate('playbackSpeedLabel');
    }

    // --- Auto-save constants and state ---
    const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
    const MAX_AUTOSAVE_VERSIONS = 20;
    const AUTOSAVE_KEY_PREFIX = 'autosave_transcript_';
    let lastAutoSavedContent = '';
    let autoSaveIntervalId = null;

    let transcriptData = []; // Taulukko VTT-datan tallentamiseen: { start, end, text, element }
    let originalVttFilename = 'transcript.vtt'; // Store original VTT filename for default save name
    let activeCueIndex = -1; // Track the currently highlighted cue index

    // --- Initial Setup ---
    // Load language preference first
    currentLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'fi'; // Load saved lang or default to 'fi'
    translateUI(); // Translate UI on load using the determined language
    loadLatestAutoSave(); // Load autosave after translating
    saveButton.disabled = true; // Disable save button initially

    // --- File Loading Visibility Toggle ---
    function checkFilesLoaded() {
        if (audioFileLoaded && vttFileLoaded) {
            fileInputContainer.classList.add('hidden');
            toggleFileInputsBtn.style.display = 'block'; // Show the button
            mainContentDiv.classList.remove('hidden'); // Show main content
            initialLoadMessageDiv.classList.add('hidden'); // Hide initial message
            saveButton.disabled = false; // Enable save button
            switchToEditorBtn.style.display = 'none'; // Hide switch button when editor is shown
        } else {
             mainContentDiv.classList.add('hidden'); // Ensure main content is hidden if files not loaded
             initialLoadMessageDiv.classList.remove('hidden'); // Show initial message
             saveButton.disabled = true; // Keep save button disabled
             fileInputContainer.classList.remove('hidden'); // Ensure file inputs are visible
             toggleFileInputsBtn.style.display = 'none'; // Hide load new button

             // Show "Return to Editor" button ONLY if files were previously loaded
             const wereFilesLoaded = transcriptData.length > 0 && audioPlayer.src; // Check if data exists
             if (wereFilesLoaded) {
                 switchToEditorBtn.style.display = 'block';
             } else {
                 switchToEditorBtn.style.display = 'none';
             }
        }
    }

    toggleFileInputsBtn.addEventListener('click', () => {
        const wereFilesLoaded = audioFileLoaded && vttFileLoaded; // Check before resetting

        fileInputContainer.classList.remove('hidden');
        toggleFileInputsBtn.style.display = 'none'; // Hide the button again
        mainContentDiv.classList.add('hidden'); // Hide main content when loading new files
        initialLoadMessageDiv.classList.remove('hidden'); // Show initial message again

        // Show the "Return to Editor" button if files were loaded before clicking this
        if (wereFilesLoaded) {
            switchToEditorBtn.style.display = 'block';
        } else {
            switchToEditorBtn.style.display = 'none'; // Should be hidden if no files were ever loaded
        }

        // Reset loaded status if user wants to load new files
        audioFileLoaded = false;
        vttFileLoaded = false;
        saveButton.disabled = true; // Disable save button

        // Clear existing content
        // Revoke previous object URL if it exists
        if (currentAudioObjectURL) {
            URL.revokeObjectURL(currentAudioObjectURL);
            currentAudioObjectURL = null;
            console.log("Revoked previous audio object URL.");
        }
        // Reset audio player more robustly
        audioPlayer.removeAttribute('src');
        audioPlayer.load(); // Important: tells the player to update after src removal

        originalTranscriptDiv.innerHTML = ''; // Clear original transcript
        timestampEditorDiv.innerHTML = ''; // Clear timestamp editor
        previousSegmentsDiv.innerHTML = ''; // Clear context
        nextSegmentsDiv.innerHTML = '';
        editableTranscriptTextarea.value = ''; // Clear editor
        transcriptData = [];
        currentEditingIndex = -1;
        activeCueIndex = -1;
        stopAutoSave();
        // Optionally clear autosaves if desired, or keep them
        // clearAutoSaves();
        saveStatus.textContent = ''; // Clear any previous save status
        saveFilenameInput.value = 'modified_transcript.txt'; // Reset filename

        // *** ADDED: Reset file input values ***
        audioFileInput.value = null;
        vttFileInput.value = null;
        console.log("Reset file input values.");

        // Do NOT call checkFilesLoaded here, as it would immediately hide the inputs again
    });

    // --- Listener for the new "Return to Editor" button --- Added
    switchToEditorBtn.addEventListener('click', () => {
        // Simply reverse the visibility states set by toggleFileInputsBtn
        fileInputContainer.classList.add('hidden');
        switchToEditorBtn.style.display = 'none';
        toggleFileInputsBtn.style.display = 'block';
        mainContentDiv.classList.remove('hidden');
        initialLoadMessageDiv.classList.add('hidden');

        // Re-enable save button as we are returning to a loaded state
        saveButton.disabled = false;

        // Restore loaded status flags (important for checkFilesLoaded logic if called later)
        audioFileLoaded = true;
        vttFileLoaded = true;
    });

    // --- Language Selection --- Added
    langBtnEn.addEventListener('click', () => {
        currentLang = 'en';
        translateUI();
        // Re-format autosave message if present
        loadLatestAutoSave(true); // Pass flag to indicate it's just a language change
    });

    langBtnFi.addEventListener('click', () => {
        currentLang = 'fi';
        translateUI();
        // Re-format autosave message if present
        loadLatestAutoSave(true); // Pass flag to indicate it's just a language change
    });

    // --- Tiedostojen lataus ---

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Revoke previous object URL before creating a new one
            if (currentAudioObjectURL) {
                URL.revokeObjectURL(currentAudioObjectURL);
                console.log("Revoked previous audio object URL before loading new one.");
            }

            currentAudioObjectURL = URL.createObjectURL(file); // Store the new URL
            audioPlayer.src = currentAudioObjectURL;
            // DO NOT revoke immediately: URL.revokeObjectURL(objectURL);

            console.log("Äänitiedosto ladattu:", file.name);
            // Extract base name from audio file
            const lastDotIndex = file.name.lastIndexOf('.');
            audioBaseFilename = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
            updateDefaultFilename(); // Update save filename based on new audio file
            audioFileLoaded = true; // Mark as loaded
            checkFilesLoaded(); // Check if both are loaded
        } else {
            audioFileLoaded = false; // Mark as not loaded if selection is cancelled
            // Also revoke if selection is cancelled and a URL existed
            if (currentAudioObjectURL) {
                URL.revokeObjectURL(currentAudioObjectURL);
                currentAudioObjectURL = null;
                console.log("Revoked audio object URL due to file selection cancellation.");
                // Reset player state as well
                audioPlayer.removeAttribute('src');
                audioPlayer.load();
            }
            checkFilesLoaded();
        }
    });

    vttFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Stop and clear previous auto-saves before loading new file
            stopAutoSave();
            clearAutoSaves();
            lastAutoSavedContent = ''; // Reset last saved content tracker

            originalVttFilename = file.name; // Store the original filename
            // Set default save filename based on selected format and audio filename
            updateDefaultFilename(); // Call this *after* potentially loading audio

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    transcriptData = parseVTT(e.target.result);
                    displayTranscription(transcriptData);
                    console.log("VTT-tiedosto ladattu ja jäsennetty:", file.name);
                    vttFileLoaded = true; // Mark as loaded
                    checkFilesLoaded(); // Check if both are loaded
                } catch (error) {
                    console.error("VTT-tiedoston jäsennysvirhe:", error);
                    // Use translation for error message
                    originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttParseError')}</p>`;
                    editableTranscriptTextarea.value = "";
                    vttFileLoaded = false; // Mark as not loaded on error
                    checkFilesLoaded(); // Update UI state
                }
            };
            reader.onerror = (e) => {
                console.error("Virhe tiedoston lukemisessa:", e);
                 // Use translation for error message
                originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttReadError')}</p>`;
                editableTranscriptTextarea.value = "";
                vttFileLoaded = false; // Mark as not loaded on error
                checkFilesLoaded(); // Update UI state
            };
            reader.readAsText(file);
        } else {
             vttFileLoaded = false; // Mark as not loaded if selection is cancelled
             checkFilesLoaded();
        }
    });

    // --- Playback Speed Control --- Added
    playbackSpeedSelect.addEventListener('change', (event) => {
        const speed = parseFloat(event.target.value);
        if (!isNaN(speed)) {
            audioPlayer.playbackRate = speed;
            console.log(`Playback speed set to ${speed}x`);
        }
    });


    // --- VTT-jäsennys ---

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

        if (minutes >= 60 || seconds >= 60) {
            return NaN; // Invalid time components
        }

        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }

    function parseVTT(vttContent) {
        const lines = vttContent.split(/\r?\n/);
        const cues = [];
        let currentCue = null;
        let lineIndex = 0;

        // Ohita mahdollinen WEBVTT-otsikko ja tyhjät rivit alussa
        while (lineIndex < lines.length && (lines[lineIndex].trim() === "" || lines[lineIndex].trim().toUpperCase() === "WEBVTT")) {
            lineIndex++;
        }

        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();

            if (line.includes('-->')) {
                // Aikaleimarivi löytyi
                try {
                    const [startStr, endStr] = line.split('-->').map(s => s.trim());
                    const start = timeToSeconds(startStr);
                    const end = timeToSeconds(endStr);

                    currentCue = { start, end, textLines: [] };
                    // Etsi tekstirivit seuraavilta riveiltä
                    lineIndex++;
                    while (lineIndex < lines.length && lines[lineIndex].trim() !== "") {
                        currentCue.textLines.push(lines[lineIndex].trim());
                        lineIndex++;
                    }
                    currentCue.text = currentCue.textLines.join('\n'); // Yhdistä monirivinen tekstitys
                    cues.push(currentCue);

                } catch (error) {
                     // Use translation for error message
                     console.error(translate('vttTimestampParseError', { lineNumber: lineIndex + 1, line }), error);
                     // Yritä jatkaa seuraavasta rivistä
                     lineIndex++;
                }

            } else {
                // Ohita muut rivit (esim. tyhjät rivit cueiden välissä tai cue ID:t)
                lineIndex++;
            }
        }
        console.log("Jäsennetty data:", cues);
        return cues;
    }


    // --- Näytön päivitys ---

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
            cueElement.textContent = `[${formatTime(cue.start)} - ${formatTime(cue.end)}] ${cue.text}`;
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

            const endInput = document.createElement('input');
            endInput.type = 'text';
            endInput.value = formatVttTime(cue.end);
            endInput.dataset.cueIndex = index;
            endInput.dataset.timeType = 'end';
            endInput.title = `End time for cue ${index + 1}`; // Tooltip
            endInput.addEventListener('input', handleTimestampInput); // Add listener

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
        lastAutoSavedContent = editableTranscriptTextarea.value; // Initialize for auto-save check
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
                }
            });
            
            // Add text content
            const contentDiv = document.createElement('div');
            contentDiv.textContent = cue.text;
            
            segmentDiv.appendChild(timestampDiv);
            segmentDiv.appendChild(contentDiv);
            
            return segmentDiv;
        }
    }

    // Update function to handle the focused segment display
    function updateFocusedSegmentView(index) {
        if (index < 0 || index >= transcriptData.length || index === currentEditingIndex) {
            return; // Invalid index or already displaying this segment
        }
        
        // Save any changes from the current segment before switching
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
            const currentText = editableTranscriptTextarea.value.trim();
            if (currentText !== transcriptData[currentEditingIndex].text) {
                transcriptData[currentEditingIndex].text = currentText;
                // Update the original display as well
                if (transcriptData[currentEditingIndex].element) {
                    transcriptData[currentEditingIndex].element.textContent = 
                        `[${formatTime(transcriptData[currentEditingIndex].start)} - ${formatTime(transcriptData[currentEditingIndex].end)}] ${currentText}`;
                }
            }
        }
        
        // Clear previous context segments
        previousSegmentsDiv.innerHTML = '';
        nextSegmentsDiv.innerHTML = '';
        
        // Add previous segment (only 1 instead of 2)
        if (index > 0) {
            const segment = createContextSegment(transcriptData[index - 1], index - 1);
            if (segment) previousSegmentsDiv.appendChild(segment);
        }
        
        // Set current segment in textarea
        const currentText = createContextSegment(transcriptData[index], index, true);
        editableTranscriptTextarea.value = currentText || '';
        currentEditingIndex = index;
        
        // Add next segment (only 1 instead of 2)
        if (index < transcriptData.length - 1) {
            const segment = createContextSegment(transcriptData[index + 1], index + 1);
            if (segment) nextSegmentsDiv.appendChild(segment);
        }
    }

    // NEW: Event handler for timestamp input changes
    function handleTimestampInput(event) {
        const inputElement = event.target;
        const cueIndex = parseInt(inputElement.dataset.cueIndex, 10);
        const timeType = inputElement.dataset.timeType; // 'start' or 'end'
        const timeString = inputElement.value;

        const seconds = parseVttTimeToSeconds(timeString);

        if (isNaN(seconds)) {
            // Invalid format
            inputElement.classList.add('invalid');
            inputElement.title = translate('vttInvalidEditableTimeFormat'); // Show error tooltip
        } else {
            // Valid format
            inputElement.classList.remove('invalid');
            inputElement.title = `${timeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`; // Restore original tooltip

            // Update the transcriptData array
            if (transcriptData[cueIndex]) {
                transcriptData[cueIndex][timeType] = seconds;
                console.log(`Updated cue ${cueIndex} ${timeType} to ${seconds}s`);

                // Optional: Add validation (e.g., start time < end time)
                const otherTimeType = timeType === 'start' ? 'end' : 'start';
                const otherInputElement = transcriptData[cueIndex][`${otherTimeType}TimestampInput`];
                const otherTime = transcriptData[cueIndex][otherTimeType];
                if (timeType === 'start' && seconds >= otherTime) {
                     inputElement.classList.add('invalid');
                     inputElement.title = 'Start time must be before end time.';
                     otherInputElement?.classList.add('invalid'); // Mark both as potentially invalid
                } else if (timeType === 'end' && seconds <= otherTime) {
                     inputElement.classList.add('invalid');
                     inputElement.title = 'End time must be after start time.';
                     otherInputElement?.classList.add('invalid');
                } else {
                    // If this edit fixed a previous start/end mismatch, remove invalid state from the other input
                    if (otherInputElement?.classList.contains('invalid')) {
                         const otherSecondsCheck = parseVttTimeToSeconds(otherInputElement.value);
                         if (!isNaN(otherSecondsCheck)) { // Only remove if the other value is now valid format
                             if ((timeType === 'start' && seconds < otherSecondsCheck) || (timeType === 'end' && seconds > otherSecondsCheck)) {
                                 otherInputElement.classList.remove('invalid');
                                 otherInputElement.title = `${otherTimeType === 'start' ? 'Start' : 'End'} time for cue ${cueIndex + 1}`;
                             }
                         }
                    }
                }
            }
        }
    }

    function formatTime(seconds) {
        const date = new Date(0);
        date.setSeconds(seconds);
        return date.toISOString().substr(11, 12); // Muoto HH:MM:SS.sss
    }

    // --- Timestamp Formatting ---
    function formatVttTime(seconds) {
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

    // --- Toiston synkronointi ---

    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        // Use formatDisplayTime for the UI
        currentTimeSpan.textContent = formatDisplayTime(currentTime);

        let newActiveCueIndex = -1;

        // Etsi aktiivinen cue
        for (let i = 0; i < transcriptData.length; i++) {
            const cue = transcriptData[i];
            // Use potentially updated times from transcriptData
            if (currentTime >= cue.start && currentTime < cue.end) {
                newActiveCueIndex = i;
                break; // Löydetty, ei tarvitse etsiä enempää
            }
        }

        // Päivitä korostus vain, jos aktiivinen cue muuttui
        if (newActiveCueIndex !== activeCueIndex) {
            // Poista vanha korostus (original transcript + timestamp editor)
            if (activeCueIndex !== -1 && transcriptData[activeCueIndex]) {
                transcriptData[activeCueIndex].element?.classList.remove('highlight');
                transcriptData[activeCueIndex].startTimestampInput?.parentNode.classList.remove('highlight'); // Highlight the pair div
            }

            // Lisää uusi korostus ja vieritä/valitse
            if (newActiveCueIndex !== -1) {
                const activeCue = transcriptData[newActiveCueIndex];
                if (activeCue.element) {
                    activeCue.element.classList.add('highlight');
                    // Vieritä korostettu elementti näkyviin alkuperäisessä transkriptiossa
                    // Use 'nearest' to minimize scrolling
                    activeCue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
                
                // Highlight timestamp pair and scroll it into view
                const timestampPairDiv = document.getElementById(`ts-pair-${newActiveCueIndex}`);
                if (timestampPairDiv) {
                    timestampPairDiv.classList.add('highlight');
                }

                // Update the focused segment view to show current segment with context
                updateFocusedSegmentView(newActiveCueIndex);
            }

            activeCueIndex = newActiveCueIndex; // Päivitä aktiivisen cuen indeksi
        }
    });

     // Lisää kuuntelija audioPlayerin latautumiselle varmistamaan, että kesto on saatavilla
    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("Äänitiedoston metadata ladattu, kesto:", audioPlayer.duration);
    });

     // Lisää virheenkäsittely audioPlayerille
    audioPlayer.addEventListener('error', (e) => {
        console.error("Virhe äänitiedoston toistossa:", e);
        let errorKey = "audioErrorUnknown"; // Default error key
        if (audioPlayer.error) {
            switch (audioPlayer.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorKey = 'audioErrorAborted';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorKey = 'audioErrorNetwork';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorKey = 'audioErrorDecode';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorKey = 'audioErrorNotSupported';
                    break;
            }
        }
        // Use translation for error message
        const errorMessage = translate(errorKey);
        originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('audioErrorGeneric')}${errorMessage}</p>`;
    });

    // --- Save Filename Update ---
    function updateDefaultFilename() {
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';
        let extension = '.txt';
        let suffix = '_modified';

        if (selectedFormat === 'vtt') {
            extension = '.vtt';
            suffix = '_modified';
        } else if (selectedFormat === 'txt_ts') {
            extension = '.txt';
            suffix = '_modified_with_ts';
        } else { // txt_plain
            extension = '.txt';
            suffix = '_modified';
        }

        // Use the stored audio base filename
        saveFilenameInput.value = `${audioBaseFilename}${suffix}${extension}`;
    }

    // Add listener to format options
    saveFormatOptions.addEventListener('change', updateDefaultFilename);

    // --- Muokatun tekstityksen tallennus ---

    saveButton.addEventListener('click', () => {
        // Check if button is disabled (shouldn't happen via UI, but good practice)
        if (saveButton.disabled) {
            console.warn("Save button clicked while disabled.");
            return;
        }

        // Save current focused segment's text before proceeding
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             const currentText = editableTranscriptTextarea.value.trim();
             if (currentText !== transcriptData[currentEditingIndex].text) {
                 transcriptData[currentEditingIndex].text = currentText;
                 // No need to update original display text here, focus is on saving data
             }
        }


        // const modifiedTextRaw = editableTranscriptTextarea.value; // We get text block by block now
        const filename = saveFilenameInput.value.trim() || 'modified_transcript.txt';
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';

        // Check for invalid timestamp inputs before saving formats that use them
        if (selectedFormat === 'vtt' || selectedFormat === 'txt_ts') {
            const invalidInputs = timestampEditorDiv.querySelectorAll('input.invalid');
            if (invalidInputs.length > 0) {
                saveStatus.textContent = `Cannot save: ${invalidInputs.length} invalid timestamp(s) found. Please correct them (HH:MM:SS.sss).`;
                saveStatus.style.color = 'red';
                invalidInputs[0].focus(); // Focus the first invalid input
                return;
            }
        }

        // Check if there's data to save
        if (transcriptData.length === 0) {
             saveStatus.textContent = translate('saveNoText');
             saveStatus.style.color = 'red';
             return;
        }


        let outputContent = '';
        let blobType = 'text/plain;charset=utf-8';

        try {
            if (selectedFormat === 'txt_plain') {
                // Join all text blocks for plain text output
                outputContent = transcriptData.map(cue => cue.text.trim()).join('\n\n');
                blobType = 'text/plain;charset=utf-8';
            } else {
                // VTT and TXT_TS use the transcriptData directly

                // *** Block mismatch check is no longer needed as we use transcriptData ***

                if (selectedFormat === 'vtt') {
                    blobType = 'text/vtt';
                    let vttLines = ["WEBVTT", ""];
                    transcriptData.forEach((cue, index) => {
                        const start = formatVttTime(cue.start);
                        const end = formatVttTime(cue.end);
                        const text = cue.text.trim(); // Use text directly from data
                        vttLines.push(`${start} --> ${end}`);
                        vttLines.push(text);
                        vttLines.push(""); // Add empty line between cues
                    });
                    outputContent = vttLines.join('\n');
                } else if (selectedFormat === 'txt_ts') {
                    blobType = 'text/plain;charset=utf-8';
                    const textLines = transcriptData.map((cue, index) => {
                        const start = formatVttTime(cue.start);
                        const end = formatVttTime(cue.end);
                        const text = cue.text.trim(); // Use text directly from data
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
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link); // Clean up
            URL.revokeObjectURL(url); // Free up memory

            saveStatus.textContent = translate('saveSuccess', { filename });
            saveStatus.style.color = 'green';
            setTimeout(() => { saveStatus.textContent = ''; }, 5000);

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            saveStatus.textContent = translate('saveError');
            saveStatus.style.color = 'red';
        }
    });

    // --- Auto-save Functions ---

    function autoSaveTranscript() {
        // Only save if main content is visible (files loaded)
        if (mainContentDiv.classList.contains('hidden')) {
            return;
        }

        // Save the currently edited segment text back to transcriptData before saving
        if (currentEditingIndex !== -1 && currentEditingIndex < transcriptData.length) {
             const currentTextInEditor = editableTranscriptTextarea.value.trim();
             if (currentTextInEditor !== transcriptData[currentEditingIndex].text) {
                 transcriptData[currentEditingIndex].text = currentTextInEditor;
                 console.log(`Autosave updated cue ${currentEditingIndex} text.`);
                 // No need to update lastAutoSavedContent based on single segment change,
                 // we'll compare the whole structure below.
             }
        }

        // Serialize the relevant data (timestamps and text) for comparison and saving
        const currentState = JSON.stringify(transcriptData.map(cue => ({
            start: cue.start,
            end: cue.end,
            text: cue.text
        })));


        if (currentState === lastAutoSavedContent || transcriptData.length === 0) {
            // Don't save if content hasn't changed or is empty
            return;
        }

        try {
            const timestamp = Date.now();
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(AUTOSAVE_KEY_PREFIX))
                .sort(); // Sorts alphabetically, which works for timestamp-based keys

            // Remove oldest versions if limit exceeded
            while (keys.length >= MAX_AUTOSAVE_VERSIONS) {
                const oldestKey = keys.shift(); // Get and remove the first (oldest) key
                localStorage.removeItem(oldestKey);
                console.log("Removed oldest autosave:", oldestKey);
            }

            // Save current version (serialized data)
            const newKey = AUTOSAVE_KEY_PREFIX + timestamp;
            localStorage.setItem(newKey, currentState);
            lastAutoSavedContent = currentState; // Update last saved content
            console.log("Autosaved:", newKey);

        } catch (error) {
            console.error("Autosave failed:", error);
            // Optionally, display a message to the user or stop auto-saving
            stopAutoSave();
            // Use translation
            saveStatus.textContent = translate('autosaveFailed');
            saveStatus.style.color = 'red';
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
        } catch (error) {
            console.error("Failed to clear autosaves:", error);
        }
    }

    function loadLatestAutoSave() {
        try {
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(AUTOSAVE_KEY_PREFIX))
                .sort(); // Sorts oldest to newest

            if (keys.length > 0) {
                const latestKey = keys[keys.length - 1]; // Get the last (latest) key
                const savedStateJSON = localStorage.getItem(latestKey);
                if (savedStateJSON) {
                    const savedData = JSON.parse(savedStateJSON);

                    // Check if the loaded data seems valid (basic check)
                    if (Array.isArray(savedData) && savedData.length > 0) {

                        // *** Important: Only load autosave if NO files are currently loaded ***
                        if (!audioFileLoaded && !vttFileLoaded) {
                            console.log("Attempting to restore from autosave:", latestKey);
                            // We can't fully restore without the original VTT structure (elements, etc.)
                            // and audio file. This autosave is primarily for the *text content* and *timestamps*.
                            // A more robust solution would involve storing original filenames too.
                            // For now, we just show a message indicating data exists.

                            // Instead of loading into the editor, show a persistent message.
                            const timestamp = parseInt(latestKey.replace(AUTOSAVE_KEY_PREFIX, ''));
                            const timeString = new Date(timestamp).toLocaleTimeString(currentLang);
                            saveStatus.textContent = translate('autosaveLoaded', { time: timeString }) + " Load files to continue editing.";
                            saveStatus.style.color = 'blue';
                            // Don't clear this message automatically

                            // We store the loaded state to potentially apply it *after* files are loaded,
                            // but this adds complexity. Simpler: user loads files, then autosave applies if timestamps match.
                            // Let's stick to just the notification for now.
                            lastAutoSavedContent = savedStateJSON; // Keep track of the loaded state

                        } else {
                             console.log("Files already loaded, skipping autosave restore to UI.");
                             // If files ARE loaded, we could potentially try to merge the autosaved data
                             // if the number of cues matches, but this is risky.
                             // Let's assume the user wants the freshly loaded file content.
                             lastAutoSavedContent = savedStateJSON; // Still update this for comparison later
                        }

                    } else {
                         console.log("Autosave data is empty or invalid, skipping restore.");
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load or parse latest autosave:", error);
            // Clear potentially corrupted autosave?
            // localStorage.removeItem(latestKey);
        }
        // Start autosave interval regardless, it will check if content is loaded later
        startAutoSave();
    }

    // Optional: Stop auto-save when navigating away
    window.addEventListener('beforeunload', () => {
        stopAutoSave();
        if (currentAudioObjectURL) {
            URL.revokeObjectURL(currentAudioObjectURL);
            console.log("Revoked audio object URL on page unload.");
        }
    });

}); // DOMContentLoaded loppuu