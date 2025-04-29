import { parseVttTimeToSeconds } from './utils.js';
// Assuming translate function will be moved to i18n.js later
// import { translate } from './i18n.js';

// Placeholder for translate function until i18n module is created
// In a full refactor, this would be imported from i18n.js
const translate = (key, params = {}) => {
    console.warn(`Translate function not fully implemented yet. Key: ${key}`);
    let text = key;
    for (const p in params) {
        text = text.replace(`{${p}}`, params[p]);
    }
    // Add basic fallback for known keys used here
    if (key === 'vttTimestampParseError') return `Error parsing timestamp on line ${params.lineNumber}: "${params.line}"`;
    if (key === 'vttInvalidTimeFormat') return `Invalid time format: ${params.timeString}`;
    return text;
};


/**
 * Parses VTT content into an array of cue objects.
 * @param {string} vttContent - The raw VTT content as a string.
 * @returns {Array<object>} An array of cue objects, each with start, end, text, and textLines properties.
 * @throws {Error} If timestamp parsing fails for a cue.
 */
export function parseVTT(vttContent) {
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
                // Extract times, removing potential metadata after times
                const timeParts = line.split('-->');
                if (timeParts.length !== 2) {
                    throw new Error(`Invalid timestamp line format: ${line}`);
                }
                const startStr = timeParts[0].trim().split(' ')[0];
                const endStr = timeParts[1].trim().split(' ')[0];

                const start = parseVttTimeToSeconds(startStr);
                const end = parseVttTimeToSeconds(endStr);

                if (isNaN(start)) {
                    throw new Error(translate('vttInvalidTimeFormat', { timeString: startStr }));
                }
                 if (isNaN(end)) {
                    throw new Error(translate('vttInvalidTimeFormat', { timeString: endStr }));
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
                 // If we stopped on a timestamp line, the outer loop will handle it next iteration.
                 // If we stopped on an empty line, the outer loop will skip it.
                 // If we reached the end, the loop terminates.
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

// --- Other VTT related functions to be moved here in full refactor ---
// validateAndUpdateTimestamp
// handleTimestampInput
// handleTimestampChange
