import { formatVttTime, parseVttTimeToSeconds, readFileAsBase64, formatDisplayTime } from './utils.js';
import { parseVTT } from './vtt.js';
import { appState, API_KEY_STORAGE_KEY } from './state.js';
import { translate, setLanguage, initI18n, updateTranslations } from './i18n.js';
import { initSave, startAutoSave, stopAutoSave, loadAutoSave, clearAutoSaves, updateDefaultFilename, autoSaveTranscript } from './save.js';
import { initAudio, syncTranscriptWithAudio, handleAudioFileSelect, cleanupAudio } from './audio.js';
import { initApi } from './api.js';
import { 
    initUI, 
    displayTranscription, 
    updateFocusedSegmentView, 
    checkFilesLoaded, 
    returnToEditorView,
    highlightTimestampPair
} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
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
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // Object containing DOM elements to pass to modules
    const domElements = {
        audioFileInput, vttFileInput, audioPlayer, originalTranscriptDiv,
        editableTranscriptTextarea, currentTimeSpan, saveButton, saveFilenameInput,
        saveStatus, htmlElement, saveFormatOptions, fileInputContainer,
        toggleFileInputsBtn, langBtnEn, langBtnFi, timestampEditorDiv,
        editableColumnContentDiv, mainContentDiv, initialLoadMessageDiv,
        switchToEditorBtn, playbackSpeedSelect, previousSegmentsDiv, nextSegmentsDiv,
        initialChoiceContainer, loadExistingBtn, generateNewBtn, generateInputContainer,
        sharedAudioInputContainer, apiKeyInput, generateTranscriptBtn, generateStatus,
        vttFileInfoDiv, vttFileNameSpan, switchToEditorFromGenerateBtn, 
        progressContainer, progressBar, progressText
    };

    // Language Buttons
    langBtnEn.addEventListener('click', () => {
        setLanguage('en', htmlElement);
        updateDefaultFilename();
    });
    
    langBtnFi.addEventListener('click', () => {
        setLanguage('fi', htmlElement);
        updateDefaultFilename();
    });

    // VTT File input handler
    vttFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            stopAutoSave();
            clearAutoSaves();

            appState.originalVttFilename = file.name;
            vttFileNameSpan.textContent = appState.originalVttFilename;
            updateDefaultFilename();

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    appState.transcriptData = parseVTT(e.target.result);
                    displayTranscription(appState.transcriptData);
                    console.log("VTT file loaded and parsed:", file.name);
                    appState.vttFileLoaded = true;
                    checkFilesLoaded();
                } catch (error) {
                    console.error("VTT parsing error:", error);
                    originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttParseError')}</p>`;
                    editableTranscriptTextarea.value = "";
                    timestampEditorDiv.innerHTML = '';
                    previousSegmentsDiv.innerHTML = '';
                    nextSegmentsDiv.innerHTML = '';
                    appState.transcriptData = [];
                    appState.vttFileLoaded = false;
                    checkFilesLoaded();
                    vttFileNameSpan.textContent = '';
                }
            };
            reader.onerror = (e) => {
                console.error("Error reading VTT file:", e);
                originalTranscriptDiv.innerHTML = `<p style="color: red;">${translate('vttReadError')}</p>`;
                editableTranscriptTextarea.value = "";
                timestampEditorDiv.innerHTML = '';
                previousSegmentsDiv.innerHTML = '';
                nextSegmentsDiv.innerHTML = '';
                appState.transcriptData = [];
                appState.vttFileLoaded = false;
                checkFilesLoaded();
                vttFileNameSpan.textContent = '';
            };
            reader.readAsText(file);
        } else {
            appState.vttFileLoaded = false;
            vttFileNameSpan.textContent = '';
            appState.originalVttFilename = '';
            updateDefaultFilename();
            checkFilesLoaded();
        }
    });

    // Define callbacks for modules
    const audioCallbacks = {
        updateFocusedSegmentView,
        highlightTimestampPair,
        updateDefaultFilename,
        checkFilesLoaded
    };

    const uiCallbacks = {
        handleAudioFileSelect,
        updateDefaultFilename
    };

    const apiCallbacks = {
        displayTranscription,
        checkFilesLoaded
    };

    const saveCallbacks = {
        displayTranscription,
        checkFilesLoaded
    };

    // Initialize modules
    initI18n(htmlElement);
    initSave(domElements, saveCallbacks);
    initUI(domElements, uiCallbacks);
    initAudio(domElements, audioCallbacks);
    initApi(domElements, apiCallbacks);

    // Try loading autosaved data
    const autosaveLoaded = loadAutoSave();

    // Set initial UI state only if autosave wasn't loaded
    if (!autosaveLoaded) {
        checkFilesLoaded();
    } else {
        // If autosave loaded, ensure translations are correct for the loaded state
        updateTranslations();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        // Attempt to save one last time before unload
        autoSaveTranscript();
        stopAutoSave();
        
        // Cleanup audio resources
        cleanupAudio();
    });

}); // DOMContentLoaded ends