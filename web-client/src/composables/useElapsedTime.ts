// /src/composables/useElapsedTime.ts

/**
 * Calculates elapsed time between two dates and returns it as an ISO string.
 * @param {Date | string} startTime - The start time as a Date object or ISO string.
 * @param {Date | string} endTime - The end time as a Date object or ISO string.
 * @returns {string} - The elapsed time in ISO 8601 duration format.
 */
export function useElapsedTime(startTime: Date | string, endTime: Date | string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Calculate elapsed time in milliseconds
    const elapsed = end.getTime() - start.getTime();
    
    // Convert milliseconds to an ISO 8601 duration string
    const isoString = new Date(elapsed).toISOString().substr(11, 8); // This will give you HH:MM:SS format
    return isoString;
  }
  