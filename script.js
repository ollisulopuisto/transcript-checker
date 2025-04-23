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

    // --- Auto-save constants and state ---
    const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
    const MAX_AUTOSAVE_VERSIONS = 20;
    const AUTOSAVE_KEY_PREFIX = 'autosave_transcript_';
    let lastAutoSavedContent = '';
    let autoSaveIntervalId = null;

    let transcriptData = []; // Taulukko VTT-datan tallentamiseen: { start, end, text, element }
    let originalVttFilename = 'transcript.vtt'; // Store original VTT filename for default save name
    let isSyncingScroll = false; // Flag to prevent scroll event loops

    // --- Load latest autosave on startup ---
    loadLatestAutoSave();

    // --- Tiedostojen lataus ---

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const objectURL = URL.createObjectURL(file);
            audioPlayer.src = objectURL;
            // URL.revokeObjectURL(objectURL); // Voi vapauttaa muistia myöhemmin, mutta tarvitaan toistoon
            console.log("Äänitiedosto ladattu:", file.name);
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
            // Set default save filename based on original VTT name
            saveFilenameInput.value = originalVttFilename.replace(/\.vtt$/i, '_modified.txt') || 'modified_transcript.txt';

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    transcriptData = parseVTT(e.target.result);
                    displayTranscription(transcriptData);
                    console.log("VTT-tiedosto ladattu ja jäsennetty:", file.name);
                } catch (error) {
                    console.error("VTT-tiedoston jäsennysvirhe:", error);
                    originalTranscriptDiv.innerHTML = `<p style="color: red;">Virhe VTT-tiedoston jäsentämisessä. Tarkista muoto.</p>`;
                    editableTranscriptTextarea.value = "";
                }
            };
            reader.onerror = (e) => {
                console.error("Virhe tiedoston lukemisessa:", e);
                originalTranscriptDiv.innerHTML = `<p style="color: red;">Virhe VTT-tiedoston lukemisessa.</p>`;
                editableTranscriptTextarea.value = "";
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
            throw new Error(`Virheellinen aikamuoto: ${timeString}`);
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
                     console.error(`Virhe rivin ${lineIndex + 1} aikaleiman jäsentämisessä: "${line}"`, error);
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

        cues.forEach((cue, index) => {
            // Alkuperäinen tekstitys elementteinä
            const cueElement = document.createElement('span'); // Käytä spania tai p-elementtiä
            cueElement.textContent = `[${formatTime(cue.start)} - ${formatTime(cue.end)}] ${cue.text}`;
            cueElement.dataset.start = cue.start;
            cueElement.dataset.end = cue.end;
            cueElement.id = `cue-${index}`; // Yksilöllinen ID

            // Lisää klikkauskuuntelija aikahyppyä varten
            cueElement.addEventListener('click', () => {
                if (!isNaN(cue.start)) {
                    audioPlayer.currentTime = cue.start;
                    // Jos haluat toiston alkavan heti klikkauksesta:
                    // audioPlayer.play();
                }
            });

            originalTranscriptDiv.appendChild(cueElement);
            cue.element = cueElement; // Tallenna viittaus elementtiin

            // Muokattava tekstitys
            editableText += cue.text + '\n\n'; // Lisää tyhjä rivi luettavuuden vuoksi
        });

        editableTranscriptTextarea.value = editableText.trim(); // Poista lopun tyhjä rivi

        // Reset scroll positions when loading new content
        originalTranscriptDiv.scrollTop = 0;
        editableTranscriptTextarea.scrollTop = 0;

        // Start auto-saving after displaying new content
        lastAutoSavedContent = editableTranscriptTextarea.value; // Initialize for auto-save check
        startAutoSave();
    }

    function formatTime(seconds) {
        const date = new Date(0);
        date.setSeconds(seconds);
        return date.toISOString().substr(11, 12); // Muoto HH:MM:SS.sss
    }


    // --- Toiston synkronointi ---

    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        currentTimeSpan.textContent = currentTime.toFixed(2); // Näytä aika

        let activeCueFound = false;

        // Poista korostus kaikilta ensin
        transcriptData.forEach(cue => {
            if (cue.element) { // Varmista, että elementti on olemassa
                 cue.element.classList.remove('highlight');
            }
        });

        // Etsi ja korosta aktiivinen cue
        for (let i = 0; i < transcriptData.length; i++) {
            const cue = transcriptData[i];
            if (currentTime >= cue.start && currentTime < cue.end) {
                if (cue.element) {
                    cue.element.classList.add('highlight');
                    // Vieritä korostettu elementti näkyviin (jos halutaan)
                    // Käytä 'nearest' välttääksesi turhaa vieritystä, jos jo näkyvissä
                    cue.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
                activeCueFound = true;
                break; // Löydetty, ei tarvitse etsiä enempää
            }
        }
    });

     // Lisää kuuntelija audioPlayerin latautumiselle varmistamaan, että kesto on saatavilla
    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("Äänitiedoston metadata ladattu, kesto:", audioPlayer.duration);
    });

     // Lisää virheenkäsittely audioPlayerille
    audioPlayer.addEventListener('error', (e) => {
        console.error("Virhe äänitiedoston toistossa:", e);
        let errorMessage = "Tuntematon äänivirhe.";
        switch (audioPlayer.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Äänen toisto keskeytettiin.';
                break;
            case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Verkkovirhe esti äänen lataamisen.';
                break;
            case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Ääntä ei voitu purkaa (tiedosto voi olla vioittunut tai selain ei tue muotoa).';
                break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Äänimuotoa ei tueta.';
                break;
        }
         originalTranscriptDiv.innerHTML = `<p style="color: red;">Äänivirhe: ${errorMessage}</p>`;
    });

    // --- Muokatun tekstityksen tallennus ---

    saveButton.addEventListener('click', () => {
        const modifiedText = editableTranscriptTextarea.value;
        const filename = saveFilenameInput.value.trim() || 'modified_transcript.txt'; // Use input value or default

        if (!modifiedText) {
            saveStatus.textContent = 'Ei tallennettavaa tekstiä.';
            saveStatus.style.color = 'red';
            return;
        }

        try {
            const blob = new Blob([modifiedText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link); // Clean up
            URL.revokeObjectURL(url); // Free up memory

            saveStatus.textContent = `Tiedosto "${filename}" tallennettu.`;
            saveStatus.style.color = 'green';
            // Clear status after a few seconds
            setTimeout(() => { saveStatus.textContent = ''; }, 5000);

            // Stop and clear auto-saves after successful manual save
            stopAutoSave();
            clearAutoSaves();
            lastAutoSavedContent = modifiedText; // Update last saved content to prevent immediate re-save if interval continues

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            saveStatus.textContent = 'Tallennus epäonnistui.';
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
            saveStatus.textContent = 'Autosave failed. Saving stopped.';
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
                    saveStatus.textContent = `Loaded content autosaved at ${new Date(parseInt(latestKey.replace(AUTOSAVE_KEY_PREFIX, ''))).toLocaleTimeString()}.`;
                    saveStatus.style.color = 'blue';
                    // Clear message after a while
                    setTimeout(() => {
                        if (saveStatus.textContent.startsWith('Loaded content')) {
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