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

    // --- i18n Translations ---
    const translations = {
        en: {
            pageTitle: "Transcription Checker Tool",
            mainHeading: "Transcription Checker Tool",
            audioFileLabel: "1. Select Audio File:",
            vttFileLabel: "2. Select VTT Subtitle File:",
            audioHeading: "Audio File",
            currentTimeLabel: "Current Time",
            originalTranscriptHeading: "Original Transcript (VTT)",
            loadFilesPrompt: "First, load an audio file and a VTT file.",
            editableTranscriptHeading: "Editable Transcript (correct here)",
            editableTranscriptPlaceholder: "Transcript text without timestamps will appear here for editing...",
            saveNote: "Note: Changes here are auto-saved locally.", // Updated note reflecting autosave
            saveFilenameLabel: "Save as:",
            saveButton: "Save Modified Text",
            saveFormatLabel: "Save format:",
            formatTxtPlainLabel: "Text without timestamps (.txt)",
            formatTxtTsLabel: "Text with timestamps (.txt)",
            formatVttLabel: "VTT with timestamps (.vtt)",
            // Dynamic strings
            vttParseError: "Error parsing VTT file. Check format.",
            vttReadError: "Error reading VTT file.",
            audioErrorUnknown: "Unknown audio error.",
            audioErrorAborted: "Audio playback aborted.",
            audioErrorNetwork: "Network error prevented audio loading.",
            audioErrorDecode: "Audio could not be decoded (file might be corrupt or format not supported).",
            audioErrorNotSupported: "Audio format not supported.",
            audioErrorGeneric: "Audio error: ",
            saveNoText: "No text to save.",
            saveSuccess: 'File "{filename}" saved.',
            saveError: "Save failed.",
            autosaveLoaded: 'Loaded content autosaved at {time}.',
            autosaveFailed: 'Autosave failed. Saving stopped.',
            saveBlockMismatchError: "Error: The number of text blocks (separated by double newlines) in the editor does not match the number of original VTT cues. Cannot save with timestamps.",
            // VTT parsing errors
            vttInvalidTimeFormat: "Invalid time format: {timeString}",
            vttTimestampParseError: 'Error parsing timestamp on line {lineNumber}: "{line}"',
            toggleFileInputsBtn: "Load New Files", // Added
        },
        fi: {
            pageTitle: "Litteroinnin tarkistustyökalu",
            mainHeading: "Litteroinnin tarkistustyökalu",
            audioFileLabel: "1. Valitse äänitiedosto:",
            vttFileLabel: "2. Valitse VTT-tekstitystiedosto:",
            audioHeading: "Äänitiedosto",
            currentTimeLabel: "Nykyinen aika",
            originalTranscriptHeading: "Alkuperäinen tekstitys (VTT)",
            loadFilesPrompt: "Lataa ensin äänitiedosto ja VTT-tiedosto.",
            editableTranscriptHeading: "Muokattava tekstitys",
            editableTranscriptPlaceholder: "Tekstitys ilman aikaleimoja ilmestyy tähän muokattavaksi...",
            saveNote: "Huom: Muutokset tallentuvat automaattisesti paikallisesti.", // Updated note
            saveFilenameLabel: "Tallenna nimellä:",
            saveButton: "Tallenna muokattu teksti",
            saveFormatLabel: "Tallenna muodossa:",
            formatTxtPlainLabel: "Teksti ilman aikaleimoja (.txt)",
            formatTxtTsLabel: "Teksti aikaleimoilla (.txt)",
            formatVttLabel: "VTT aikaleimoilla (.vtt)",
            // Dynamic strings
            vttParseError: "Virhe VTT-tiedoston jäsentämisessä. Tarkista muoto.",
            vttReadError: "Virhe VTT-tiedoston lukemisessa.",
            audioErrorUnknown: "Tuntematon äänivirhe.",
            audioErrorAborted: "Äänen toisto keskeytettiin.",
            audioErrorNetwork: "Verkkovirhe esti äänen lataamisen.",
            audioErrorDecode: "Ääntä ei voitu purkaa (tiedosto voi olla vioittunut tai selain ei tue muotoa).",
            audioErrorNotSupported: "Äänimuotoa ei tueta.",
            audioErrorGeneric: "Äänivirhe: ",
            saveNoText: "Ei tallennettavaa tekstiä.",
            saveSuccess: 'Tiedosto "{filename}" tallennettu.',
            saveError: "Tallennus epäonnistui.",
            autosaveLoaded: 'Ladattiin automaattisesti tallennettu sisältö ajalta {time}.',
            autosaveFailed: 'Automaattitallennus epäonnistui. Tallennus pysäytetty.',
            saveBlockMismatchError: "Virhe: Tekstilohkojen määrä (eroteltu tyhjillä riveillä) editorissa ei vastaa alkuperäisten VTT-lohkojen määrää. Ei voida tallentaa aikaleimoilla.",
            // VTT parsing errors
            vttInvalidTimeFormat: "Virheellinen aikamuoto: {timeString}",
            vttTimestampParseError: 'Virhe rivin {lineNumber} aikaleiman jäsentämisessä: "{line}"',
            toggleFileInputsBtn: "Lataa uudet tiedostot", // Added
        }
    };

    let currentLang = 'en'; // Default language
    let audioFileLoaded = false; // Added state tracker
    let vttFileLoaded = false;   // Added state tracker

    // --- i18n Functions ---
    function getBrowserLanguage() {
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
        currentLang = getBrowserLanguage();
        htmlElement.lang = currentLang; // Set lang attribute on <html> tag

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

    }

    // --- Auto-save constants and state ---
    const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
    const MAX_AUTOSAVE_VERSIONS = 20;
    const AUTOSAVE_KEY_PREFIX = 'autosave_transcript_';
    let lastAutoSavedContent = '';
    let autoSaveIntervalId = null;

    let transcriptData = []; // Taulukko VTT-datan tallentamiseen: { start, end, text, element }
    let originalVttFilename = 'transcript.vtt'; // Store original VTT filename for default save name
    let isSyncingScroll = false; // Flag to prevent scroll event loops
    let activeCueIndex = -1; // Track the currently highlighted cue index

    // --- Initial Setup ---
    translateUI(); // Translate UI on load
    loadLatestAutoSave(); // Load autosave after translating

    // --- File Loading Visibility Toggle ---
    function checkFilesLoaded() {
        if (audioFileLoaded && vttFileLoaded) {
            fileInputContainer.classList.add('hidden');
            toggleFileInputsBtn.style.display = 'block'; // Show the button
        }
    }

    toggleFileInputsBtn.addEventListener('click', () => {
        fileInputContainer.classList.remove('hidden');
        toggleFileInputsBtn.style.display = 'none'; // Hide the button again
        // Reset loaded status if user wants to load new files
        audioFileLoaded = false;
        vttFileLoaded = false;
        // Optionally clear existing content or prompt user
        // audioPlayer.src = '';
        // originalTranscriptDiv.innerHTML = `<p data-translate-key="loadFilesPrompt">${translate('loadFilesPrompt')}</p>`;
        // editableTranscriptTextarea.value = '';
        // transcriptData = [];
        // stopAutoSave();
        // clearAutoSaves();
    });

    // --- Tiedostojen lataus ---

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const objectURL = URL.createObjectURL(file);
            audioPlayer.src = objectURL;
            // URL.revokeObjectURL(objectURL); // Voi vapauttaa muistia myöhemmin, mutta tarvitaan toistoon
            console.log("Äänitiedosto ladattu:", file.name);
            audioFileLoaded = true; // Mark as loaded
            checkFilesLoaded(); // Check if both are loaded
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
            // Set default save filename based on selected format (initially plain text)
            updateDefaultFilename();

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
                }
            };
            reader.onerror = (e) => {
                console.error("Virhe tiedoston lukemisessa:", e);
                 // Use translation for error message
                originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttReadError')}</p>`;
                editableTranscriptTextarea.value = "";
                vttFileLoaded = false; // Mark as not loaded on error
            };
            reader.readAsText(file);
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
        let editableText = '';
        let currentPos = 0; // Track character position in editable textarea

        cues.forEach((cue, index) => {
            // Alkuperäinen tekstitys elementteinä
            const cueElement = document.createElement('span');
            cueElement.textContent = `[${formatTime(cue.start)} - ${formatTime(cue.end)}] ${cue.text}`;
            cueElement.dataset.start = cue.start;
            cueElement.dataset.end = cue.end;
            cueElement.id = `cue-${index}`; // Yksilöllinen ID

            // Lisää klikkauskuuntelija aikahyppyä varten
            cueElement.addEventListener('click', () => {
                if (!isNaN(cue.start)) {
                    audioPlayer.currentTime = cue.start;
                    // audioPlayer.play(); // Optional: start playback on click
                }
            });

            originalTranscriptDiv.appendChild(cueElement);
            cue.element = cueElement; // Tallenna viittaus elementtiin

            // Muokattava tekstitys
            const textToAdd = cue.text + '\n\n';
            editableText += textToAdd;
            cue.editableStart = currentPos; // Store start index
            cue.editableEnd = currentPos + cue.text.length; // Store end index (before newlines)
            currentPos += textToAdd.length; // Update position for next cue
        });

        editableTranscriptTextarea.value = editableText.trim(); // Poista lopun tyhjä rivi

        // Reset scroll positions when loading new content
        originalTranscriptDiv.scrollTop = 0;
        editableTranscriptTextarea.scrollTop = 0;
        activeCueIndex = -1; // Reset active cue tracking

        // Start auto-saving after displaying new content
        lastAutoSavedContent = editableTranscriptTextarea.value; // Initialize for auto-save check
        startAutoSave();
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
            if (currentTime >= cue.start && currentTime < cue.end) {
                newActiveCueIndex = i;
                break; // Löydetty, ei tarvitse etsiä enempää
            }
        }

        // Päivitä korostus vain, jos aktiivinen cue muuttui
        if (newActiveCueIndex !== activeCueIndex) {
            // Poista vanha korostus
            if (activeCueIndex !== -1 && transcriptData[activeCueIndex]?.element) {
                transcriptData[activeCueIndex].element.classList.remove('highlight');
            }

            // Lisää uusi korostus ja vieritä/valitse
            if (newActiveCueIndex !== -1) {
                const activeCue = transcriptData[newActiveCueIndex];
                if (activeCue.element) {
                    activeCue.element.classList.add('highlight');
                    // Vieritä korostettu elementti näkyviin alkuperäisessä transkriptiossa
                    activeCue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
                // Valitse vastaava teksti muokattavassa kentässä
                if (typeof activeCue.editableStart === 'number' && typeof activeCue.editableEnd === 'number') {
                    // editableTranscriptTextarea.focus(); // Ensure textarea has focus for selection visibility
                    editableTranscriptTextarea.setSelectionRange(activeCue.editableStart, activeCue.editableEnd);
                     // Scroll editor to selection (setSelectionRange often does this, but ensure visibility)
                    const textLength = editableTranscriptTextarea.value.length;
                    if (textLength > 0) {
                        const approxScroll = (activeCue.editableStart / textLength) * editableTranscriptTextarea.scrollHeight;
                        // Simple scroll, might need refinement for perfect positioning
                        editableTranscriptTextarea.scrollTop = approxScroll - (editableTranscriptTextarea.clientHeight / 3);
                    }

                }
            } else {
                 // Jos mikään cue ei ole aktiivinen, poista valinta editorista
                 // Check if textarea currently has focus to avoid stealing focus unnecessarily
                 if (document.activeElement === editableTranscriptTextarea) {
                    const currentSelectionStart = editableTranscriptTextarea.selectionStart;
                    const currentSelectionEnd = editableTranscriptTextarea.selectionEnd;
                    // Only clear selection if something related to cues was selected
                    const previousCue = transcriptData[activeCueIndex];
                     if (previousCue && currentSelectionStart === previousCue.editableStart && currentSelectionEnd === previousCue.editableEnd) {
                         editableTranscriptTextarea.setSelectionRange(currentSelectionStart, currentSelectionStart); // Collapse selection
                     }
                 }
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

        const baseName = originalVttFilename.replace(/\.vtt$/i, '');
        saveFilenameInput.value = `${baseName}${suffix}${extension}`;
    }

    // Add listener to format options
    saveFormatOptions.addEventListener('change', updateDefaultFilename);

    // --- Muokatun tekstityksen tallennus ---

    saveButton.addEventListener('click', () => {
        const modifiedTextRaw = editableTranscriptTextarea.value;
        const filename = saveFilenameInput.value.trim() || 'modified_transcript.txt'; // Use input value or default
        const selectedFormat = document.querySelector('input[name="saveFormat"]:checked')?.value || 'txt_plain';

        if (!modifiedTextRaw && selectedFormat !== 'vtt') { // Allow saving empty VTT? Maybe not useful.
            saveStatus.textContent = translate('saveNoText');
            saveStatus.style.color = 'red';
            return;
        }

        let outputContent = '';
        let blobType = 'text/plain;charset=utf-8';

        try {
            if (selectedFormat === 'txt_plain') {
                outputContent = modifiedTextRaw;
                blobType = 'text/plain;charset=utf-8';
            } else {
                // VTT and TXT_TS require mapping edited text back to cues
                const editedBlocks = modifiedTextRaw.split('\n\n');

                // *** Crucial Check ***
                if (editedBlocks.length !== transcriptData.length) {
                    saveStatus.textContent = translate('saveBlockMismatchError');
                    saveStatus.style.color = 'red';
                    console.error(`Block count mismatch: ${editedBlocks.length} edited vs ${transcriptData.length} original cues.`);
                    return;
                }

                if (selectedFormat === 'vtt') {
                    blobType = 'text/vtt';
                    let vttLines = ["WEBVTT", ""];
                    transcriptData.forEach((cue, index) => {
                        const start = formatVttTime(cue.start);
                        const end = formatVttTime(cue.end);
                        const text = editedBlocks[index].trim(); // Use trimmed edited text
                        vttLines.push(`${start} --> ${end}`);
                        vttLines.push(text);
                        vttLines.push(""); // Add empty line between cues
                    });
                    outputContent = vttLines.join('\n');
                } else if (selectedFormat === 'txt_ts') {
                    blobType = 'text/plain;charset=utf-8';
                    const textLines = transcriptData.map((cue, index) => {
                        const start = formatVttTime(cue.start); // Use VTT format for consistency here too
                        const end = formatVttTime(cue.end);
                        const text = editedBlocks[index].trim();
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

            // Optionally reset autosave state if needed, though maybe not required if format changes
            // stopAutoSave();
            // clearAutoSaves();
            // lastAutoSavedContent = modifiedTextRaw; // Or maybe based on the generated output?

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            saveStatus.textContent = translate('saveError');
            saveStatus.style.color = 'red';
        }
    });

    // --- Auto-save Functions ---

    function autoSaveTranscript() {
        const currentText = editableTranscriptTextarea.value;
        if (currentText === lastAutoSavedContent || !currentText.trim()) {
            // Don't save if content hasn't changed or is empty/whitespace
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

            // Save current version
            const newKey = AUTOSAVE_KEY_PREFIX + timestamp;
            localStorage.setItem(newKey, currentText);
            lastAutoSavedContent = currentText; // Update last saved content
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
                const savedText = localStorage.getItem(latestKey);
                if (savedText) {
                    editableTranscriptTextarea.value = savedText;
                    lastAutoSavedContent = savedText; // Initialize last saved content
                    console.log("Loaded latest autosave:", latestKey);
                    const timestamp = parseInt(latestKey.replace(AUTOSAVE_KEY_PREFIX, ''));
                    const timeString = new Date(timestamp).toLocaleTimeString(currentLang); // Use current lang for time format
                    // Use translation
                    saveStatus.textContent = translate('autosaveLoaded', { time: timeString });
                    saveStatus.style.color = 'blue';
                    // Clear message after a while
                    setTimeout(() => {
                        // Check if the message is still the autosave loaded message before clearing
                        const expectedStart = translate('autosaveLoaded', { time: '' }).split('{time}')[0];
                        if (saveStatus.textContent.startsWith(expectedStart)) {
                             saveStatus.textContent = '';
                        }
                    }, 7000);
                    // Start auto-saving immediately if content was recovered
                    startAutoSave();
                }
            }
        } catch (error) {
            console.error("Failed to load latest autosave:", error);
        }
    }

    // Optional: Stop auto-save when navigating away
    window.addEventListener('beforeunload', stopAutoSave);


    // --- Scroll Synchronization ---

    function syncScroll(sourceElement, targetElement) {
        if (isSyncingScroll) return; // Prevent infinite loops

        isSyncingScroll = true;

        const sourceScrollTop = sourceElement.scrollTop;
        const sourceScrollHeight = sourceElement.scrollHeight;
        const sourceClientHeight = sourceElement.clientHeight;
        const targetScrollHeight = targetElement.scrollHeight;
        const targetClientHeight = targetElement.clientHeight;

        // Calculate scroll percentage, handle division by zero if no scrollbar
        const scrollPercentage = sourceScrollHeight > sourceClientHeight
            ? sourceScrollTop / (sourceScrollHeight - sourceClientHeight)
            : 0;

        // Calculate target scroll position
        const targetScrollTop = scrollPercentage * (targetScrollHeight - targetClientHeight);

        // Set target scroll position if it's significantly different
        // (Avoids minor fluctuations triggering loops)
        if (Math.abs(targetElement.scrollTop - targetScrollTop) > 1) {
             targetElement.scrollTop = targetScrollTop;
        }

        // Use requestAnimationFrame to reset the flag after the browser has rendered the scroll change
        requestAnimationFrame(() => {
            isSyncingScroll = false;
        });
    }

    originalTranscriptDiv.addEventListener('scroll', () => {
        syncScroll(originalTranscriptDiv, editableTranscriptTextarea);
    });

    editableTranscriptTextarea.addEventListener('scroll', () => {
        syncScroll(editableTranscriptTextarea, originalTranscriptDiv);
    });

}); // DOMContentLoaded loppuu