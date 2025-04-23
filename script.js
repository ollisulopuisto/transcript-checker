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

    let transcriptData = []; // Taulukko VTT-datan tallentamiseen: { start, end, text, element }
    let originalVttFilename = 'transcript.vtt'; // Store original VTT filename for default save name

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
            originalTranscriptDiv.appendChild(cueElement);
            cue.element = cueElement; // Tallenna viittaus elementtiin

            // Muokattava tekstitys
            editableText += cue.text + '\n\n'; // Lisää tyhjä rivi luettavuuden vuoksi
        });

        editableTranscriptTextarea.value = editableText.trim(); // Poista lopun tyhjä rivi
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

        } catch (error) {
            console.error("Tallennusvirhe:", error);
            saveStatus.textContent = 'Tallennus epäonnistui.';
            saveStatus.style.color = 'red';
        }
    });

}); // DOMContentLoaded loppuu