// API handling functionality for transcript-checker
import { readFileAsBase64 } from './utils.js';
import { appState, API_KEY_STORAGE_KEY } from './state.js';
import { translate } from './i18n.js';
import { parseVTT } from './vtt.js';
import { startAutoSave, stopAutoSave, clearAutoSaves, updateDefaultFilename } from './save.js';

// Private module variables for DOM elements
let generateTranscriptBtn;
let generateStatus;
let progressContainer;
let progressBar;
let progressText;
let vttFileNameSpan;
let apiKeyInput;

// Private module variables for callbacks
let displayTranscription;
let checkFilesLoaded;

/**
 * Generates a VTT transcript from an audio file using the Gemini API
 * @param {File} audioFile - The audio file to transcribe
 * @param {string} apiKey - The API key for authentication
 * @returns {Promise<boolean>} - Whether transcript generation was successful
 */
async function generateTranscriptFromAudio(audioFile, apiKey) {
    if (!audioFile) {
        generateStatus.textContent = translate('noAudioForGeneration');
        generateStatus.style.color = 'red';
        generateStatus.dataset.translateKey = 'noAudioForGeneration';
        return false;
    }

    if (!apiKey) {
        generateStatus.textContent = translate('noApiKey');
        generateStatus.style.color = 'red';
        generateStatus.dataset.translateKey = 'noApiKey';
        return false;
    }

    // Reset UI for generation
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    generateStatus.textContent = translate('generatingStatus');
    generateStatus.style.color = 'blue';
    generateStatus.dataset.translateKey = 'generatingStatus';
    generateStatus.classList.add('generating');
    generateTranscriptBtn.disabled = true;
    stopAutoSave();
    clearAutoSaves();

    try {
        // 1. Read audio file as base64
        progressBar.style.width = '10%';
        progressText.textContent = '10% - Reading audio file';
        
        const audioBase64 = await readFileAsBase64(audioFile);
        const audioMimeType = audioFile.type || 'audio/mpeg';
        
        progressBar.style.width = '30%';
        progressText.textContent = '30% - Preparing API request';

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
            ]
        };

        progressBar.style.width = '50%';
        progressText.textContent = '50% - Sending to Google Gemini API';

        // 3. Make API call to Gemini 1.5 Pro
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        progressBar.style.width = '70%';
        progressText.textContent = '70% - Processing API response';

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: { message: response.statusText } };
            }
            console.error("API Error Response:", errorData);
            throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const responseData = await response.json();

        progressBar.style.width = '80%';
        progressText.textContent = '80% - Extracting transcript';

        // 4. Extract VTT content
        const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error("API Response did not contain expected text:", responseData);
            throw new Error("Failed to extract transcript from API response.");
        }

        // Clean potential markdown code block fences
        let vttContent = generatedText.replace(/^```vtt\s*|```$/g, '').trim();

        if (!vttContent.startsWith('WEBVTT')) {
            console.warn("Generated content doesn't start with WEBVTT. Prepending it.");
            vttContent = "WEBVTT\n\n" + vttContent;
        }

        progressBar.style.width = '90%';
        progressText.textContent = '90% - Parsing VTT content';

        // 5. Process and display
        appState.transcriptData = parseVTT(vttContent);

        // Set generated filename in state
        appState.originalVttFilename = `${appState.audioBaseFilename}_generated.vtt`;
        vttFileNameSpan.textContent = appState.originalVttFilename;
        updateDefaultFilename();

        progressBar.style.width = '100%';
        progressText.textContent = '100% - Complete';

        displayTranscription(appState.transcriptData);
        appState.vttFileLoaded = true;
        checkFilesLoaded();

        generateStatus.textContent = translate('generateSuccess');
        generateStatus.style.color = 'green';
        generateStatus.dataset.translateKey = 'generateSuccess';
        setTimeout(() => { 
            generateStatus.textContent = ''; 
            progressContainer.classList.add('hidden');
        }, 5000);

        return true;
    } catch (error) {
        console.error("Error during transcript generation:", error);
        generateStatus.textContent = `${translate('generateError')} ${error.message}`;
        generateStatus.style.color = 'red';
        generateStatus.dataset.translateKey = 'generateError';
        appState.vttFileLoaded = false;
        appState.transcriptData = [];
        checkFilesLoaded();
        return false;
    } finally {
        generateTranscriptBtn.disabled = false;
        generateStatus.classList.remove('generating');
        if (appState.audioFileLoaded && appState.vttFileLoaded) {
            startAutoSave();
        }
    }
}

/**
 * Saves and retrieves the API key to/from localStorage
 */
function setupApiKeyPersistence() {
    // Load saved API key
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // Save API key when changed
    apiKeyInput.addEventListener('change', () => {
        try {
            localStorage.setItem(API_KEY_STORAGE_KEY, apiKeyInput.value.trim());
        } catch (e) {
            console.warn("Could not save API key to local storage:", e);
        }
    });
}

/**
 * Initializes the API module
 * @param {Object} elements - DOM elements needed by this module
 * @param {Object} callbacks - Callback functions from other modules
 */
export function initApi(elements, callbacks) {
    // Store references to DOM elements
    generateTranscriptBtn = elements.generateTranscriptBtn;
    generateStatus = elements.generateStatus;
    progressContainer = elements.progressContainer; 
    progressBar = elements.progressBar;
    progressText = elements.progressText;
    vttFileNameSpan = elements.vttFileNameSpan;
    apiKeyInput = elements.apiKeyInput;
    
    // Store references to callback functions
    displayTranscription = callbacks.displayTranscription;
    checkFilesLoaded = callbacks.checkFilesLoaded;
    
    // Setup API key persistence
    setupApiKeyPersistence();
    
    // Set up event listener for generate button
    generateTranscriptBtn.addEventListener('click', async () => {
        const audioFile = elements.audioFileInput.files[0];
        const apiKey = apiKeyInput.value.trim();
        await generateTranscriptFromAudio(audioFile, apiKey);
    });
    
    console.log("API module initialized.");
}

// Export public functions
export { generateTranscriptFromAudio };