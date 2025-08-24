/**
 * Pads a number with leading zeros to a given length.
 * @param n
 * @param len
 * @returns {string}
 */
function pad(n, len = 2) {
    return `${Math.floor(Math.abs(n))}`.padStart(len, '0');
}

/**
 * Get offset of current timezone in ISO format
 * @returns {string}
 */
export function getTimezoneOffset() {
    const today = new Date();
    const tzOffset = -today.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    return diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);
}

/**
 * Get name of current timezone
 * @param {'short', 'long', 'shortOffset', 'longOffset', 'shortGeneric', 'longGeneric', 'regional'} timezoneFormat
 * @returns {string}
 */
export function getTimezoneName(timezoneFormat = 'short') {
    if (timezoneFormat === 'regional') {
        // ? Returns IANA timezone name by definition, which is in English
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/resolvedOptions
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    const today = new Date();
    const short = today.toLocaleDateString(undefined);
    const full = today.toLocaleDateString(undefined, { timeZoneName: timezoneFormat });
    // Trying to remove date from the string in a locale-agnostic way
    const shortIndex = full.indexOf(short);
    if (shortIndex >= 0) {
        const trimmed = full.substring(0, shortIndex) + full.substring(shortIndex + short.length);
        // by this time `trimmed` should be the timezone's name with some punctuation -
        // trim it from both sides
        return trimmed.replace(/^[\s,.\-:;]+|[\s,.\-:;]+$/g, '');
    } else {
        // fallback to offset in ISO format
        return getTimezoneOffset()
    }
}

/**
 * Returns a string representation of the given date in ISO(?) format,
 * @param date
 * @returns {string}
 */
export function toISOStringWithTimezone(date) { // technically not ISO?
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        getTimezoneOffset();
}

/**
 * The preferred "universal" datetime format of mine - with tz-format variations.
 * Examples results:
 * 2025-07-24 20:39                                 // none (default)
 * 2025-07-24 20:39 +02:00                          // offset
 * 2025-07-24 20:39 CEST                            // short
 * 2025-07-24 20:39 Central European Summer Time    // long
 * 2025-07-24 20:39 GMT+2                           // shortOffset
 * 2025-07-24 20:39 GMT+02:00                       // longOffset
 * 2025-07-24 20:39 CET                             // shortGeneric
 * 2025-07-24 20:39 Central European Time           // longGeneric
 * 2025-07-24 20:39 Europe/Copenhagen               // regional
 * 2025-07-24 18:39 UTC                             // UTC
 * @param date
 * @param {'none', 'offset', 'short', 'long', 'shortOffset', 'longOffset', 'shortGeneric', 'longGeneric', 'regional', 'UTC'} [tzFormat='none']
 * @returns {string}
 */
export function shortDateTime(date, tzFormat = 'none') {
    let tz;
    switch (tzFormat) {
        case 'offset':
            tz = getTimezoneOffset();
            break;
        case 'short':
        case 'long':
        case 'shortOffset':
        case 'longOffset':
        case 'shortGeneric':
        case 'longGeneric':
        case 'regional':
            tz = getTimezoneName(tzFormat);
            break;
        case 'utc':
        case 'UTC':
            tz = 'UTC';
            break;
        default:
    }
    const t = (tz === 'UTC' ?
            date.getUTCFullYear() +
            '-' + pad(date.getUTCMonth() + 1) +
            '-' + pad(date.getUTCDate()) +
            ' ' + pad(date.getUTCHours()) +
            ':' + pad(date.getUTCMinutes())
            :
            date.getFullYear() +
            '-' + pad(date.getMonth() + 1) +
            '-' + pad(date.getDate()) +
            ' ' + pad(date.getHours()) +
            ':' + pad(date.getMinutes())
    );
    return (tz ? `${t} ${tz}` : t);
}
