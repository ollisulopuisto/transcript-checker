import { appState, LANGUAGE_STORAGE_KEY } from './state.js';
// Import updateDefaultFilename from save.js - creates a circular dependency if called directly from updateTranslations.
// It's better to call updateDefaultFilename from where setLanguage is called (initializeApp).
// import { updateDefaultFilename } from './save.js';

// Assuming 'translations' is globally available from translations.js
// If not, it should be imported or passed during initialization.

/**
 * Translates a key using the current language dictionary.
 * @param {string} key - The translation key.
 * @param {object} [params={}] - Optional parameters for placeholder replacement.
 * @returns {string} The translated string or the key itself if not found.
 */
export function translate(key, params = {}) {
    const langTranslations = translations[appState.currentLang] || translations.en;
    let text = langTranslations[key] || translations.en[key] || key; // Fallback chain: current -> en -> key
    for (const p in params) {
        text = text.replace(`{${p}}`, params[p]);
    }
    return text;
}

/**
 * Updates all elements with the data-translate-key attribute.
 */
export function updateTranslations() {
    document.querySelectorAll('[data-translate-key]').forEach(element => {
        const key = element.dataset.translateKey;
        const translation = translate(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else if (element.tagName === 'TITLE') {
            document.title = translation; // Update page title
        } else {
            element.textContent = translation;
        }
    });
    // Note: updateDefaultFilename() should be called after setLanguage completes, not directly within updateTranslations
    // to avoid potential issues and circular dependencies if save.js also imports i18n.
}

/**
 * Sets the application language, updates UI, and saves preference.
 * @param {string} lang - The language code ('en', 'fi', etc.).
 * @param {HTMLElement} htmlElement - The root HTML element to set the lang attribute on.
 */
export function setLanguage(lang, htmlElement) {
    if (translations[lang]) {
        appState.currentLang = lang;
        if (htmlElement) {
            htmlElement.lang = lang; // Update HTML lang attribute
        } else {
            console.warn("setLanguage called without htmlElement");
        }
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang); // Save preference
        updateTranslations();
        console.log(`Language set to ${lang}`);
        // Caller should handle calling updateDefaultFilename if needed
    }
}

/**
 * Initializes the language settings based on storage or browser preferences.
 * @param {HTMLElement} htmlElement - The root HTML element.
 */
export function initI18n(htmlElement) {
    const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const browserLang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
    const initialLang = savedLang || (translations[browserLang] ? browserLang : 'fi'); // Default to 'fi'
    setLanguage(initialLang, htmlElement);
}
