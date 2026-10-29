import { describe, it } from 'node:test';
import assert from 'node:assert';
import { API_KEY_STORAGE_KEY } from './state.js';
import { initApi } from './api.js';

// Stub-selaintallennus, joka kirjaa jokaisen kutsun.
const storageCalls = [];
globalThis.localStorage = {
    getItem: (key) => {
        storageCalls.push({ op: 'getItem', key });
        return null;
    },
    setItem: (key, value) => {
        storageCalls.push({ op: 'setItem', key, value });
    },
    removeItem: (key) => {
        storageCalls.push({ op: 'removeItem', key });
    },
    clear: () => {
        storageCalls.push({ op: 'clear' });
    },
};

const apiKeyInput = {
    value: 'test-api-key-123',
    listeners: {},
    addEventListener(type, listener) {
        (this.listeners[type] = this.listeners[type] || []).push(listener);
    },
    dispatchEvent(type) {
        (this.listeners[type] || []).forEach((listener) => listener());
    },
};

const generateTranscriptBtn = {
    listeners: {},
    addEventListener(type, listener) {
        (this.listeners[type] = this.listeners[type] || []).push(listener);
    },
    disabled: false,
};

const generateStatus = {
    textContent: '',
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
};
const progressContainer = { classList: { add() {}, remove() {} } };
const progressBar = { style: {} };
const progressText = { textContent: '' };
const vttFileNameSpan = { textContent: '' };
const audioFileInput = { files: [] };

const elements = {
    generateTranscriptBtn,
    generateStatus,
    progressContainer,
    progressBar,
    progressText,
    vttFileNameSpan,
    apiKeyInput,
    audioFileInput,
};
const callbacks = {
    displayTranscription: () => {},
    checkFilesLoaded: () => {},
};

describe('API key security — clear-text storage', () => {
    it('must not store the API key in localStorage', () => {
        initApi(elements, callbacks);

        // Käyttäjä vaihtaa API-avainkentän arvon.
        apiKeyInput.dispatchEvent('change');

        const setItemCalls = storageCalls.filter(
            (c) => c.op === 'setItem' && c.key === API_KEY_STORAGE_KEY,
        );
        assert.strictEqual(
            setItemCalls.length,
            0,
            'API key must not be written to localStorage (clear text)',
        );

        const getItemCalls = storageCalls.filter(
            (c) => c.op === 'getItem' && c.key === API_KEY_STORAGE_KEY,
        );
        assert.strictEqual(
            getItemCalls.length,
            0,
            'API key must not be read from localStorage',
        );
    });
});
