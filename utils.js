/**
 * Formats seconds into HH:MM:SS.sss format for VTT timestamps.
 * @param {number} seconds - The time in seconds.
 * @returns {string} The formatted time string.
 */
export function formatVttTime(seconds) {
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

/**
 * Parses a VTT timestamp string (HH:MM:SS.sss or MM:SS.sss) into seconds.
 * Allows flexibility with optional hours and comma/dot for milliseconds.
 * @param {string} timeString - The VTT timestamp string.
 * @returns {number} The time in seconds, or NaN if the format is invalid.
 */
export function parseVttTimeToSeconds(timeString) {
    // Allow flexibility: optional hours, comma or dot for milliseconds
    const timeRegex = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;
    const match = timeString.match(timeRegex);
    if (!match) {
        // Try parsing MM:SS.sss if the first attempt failed
        const shortTimeRegex = /^(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/;
        const shortMatch = timeString.match(shortTimeRegex);
        if (!shortMatch) {
            return NaN; // Invalid format
        }
        // Extract parts for MM:SS.sss
        const hours = 0;
        const minutes = parseInt(shortMatch[1], 10);
        const seconds = parseInt(shortMatch[2], 10);
        const milliseconds = parseInt((shortMatch[3] || '0').padEnd(3, '0'), 10); // Pad ms

        if (minutes >= 60 || seconds >= 60 || minutes < 0 || seconds < 0 || milliseconds < 0) {
            return NaN; // Invalid time components
        }
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;

    }
    // Extract parts for HH:MM:SS.sss
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = parseInt((match[4] || '0').padEnd(3, '0'), 10); // Pad ms

    if (minutes >= 60 || seconds >= 60 || hours < 0 || minutes < 0 || seconds < 0 || milliseconds < 0) {
        return NaN; // Invalid time components
    }

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}


/**
 * Reads a File object as a Base64 encoded string.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} A promise that resolves with the Base64 string (without the data URL prefix).
 */
export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // result contains the Data URL (e.g., "data:audio/mpeg;base64,...")
            // We need to extract only the base64 part
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file); // Read as Data URL to get base64
    });
}

/**
 * Formats seconds into a display-friendly time string (MM:SS or HH:MM:SS).
 * @param {number} seconds - The time in seconds.
 * @returns {string} The formatted time string for display.
 */
export function formatDisplayTime(seconds) {
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
