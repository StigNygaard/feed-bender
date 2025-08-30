/**
 * Pads a number (as absolute integer) with leading zeros to a given length.
 * @param n {number} - The number to pad.
 * @param [len=2] {number} - "Padded length". Defaults to 2.
 * @returns {string}
 */
function pad(n, len = 2) {
    return `${Math.floor(Math.abs(n))}`.padStart(len, '0');
}

/**
 * Get offset of timezone in ISO format
 * @param [dt=Date()] {Date} - Defaults to current date/time. A specific date is needed to detect if summertime is active.
 * @returns {string}
 */
export function getTimezoneOffset(dt = new Date()) {
    const tzOffset = -dt.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    return diff + pad(tzOffset / 60) + ':' + pad(tzOffset % 60);
}

/**
 * Get a string "display-value" of timezone
 * @param [dt=Date()] {Date} - Defaults to current date/time. A specific date is needed to detect if summertime is active.
 * @param [timezoneFormat='short'] {'short'|'long'|'shortOffset'|'longOffset'|'shortGeneric'|'longGeneric'|'regional'}
 * @returns {string}
 */
export function getTimezoneDisplay(dt = new Date(), timezoneFormat = 'short') {
    // This is a bit "hacky". Maybe not for "critical" use?...
    if (timezoneFormat === 'regional') {
        // ? Returns IANA timezone name by definition, which is in English
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/resolvedOptions
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    const short = dt.toLocaleDateString(undefined);
    const full = dt.toLocaleDateString(undefined, {timeZoneName: timezoneFormat});
    // Trying to remove date from the string in a locale-agnostic way
    const shortIndex = full.indexOf(short);
    if (shortIndex >= 0) {
        const trimmed = full.substring(0, shortIndex) + full.substring(shortIndex + short.length);
        // by this time `trimmed` should be the timezone's name with some punctuation -
        // trim it from both sides
        return trimmed.replace(/^[\s,.\-:;]+|[\s,.\-:;]+$/g, '');
    } else {
        // Fallback to offset in ISO format
        return getTimezoneOffset(dt)
    }
}

/**
 * Returns a string representation of the given date in ISO-like format
 * @param [date=Date()] {Date} - Defaults to current date/time.
 * @returns {string}
 */
export function dateAsISOStringWithTimezone(date = new Date()) { // technically not really ISO?
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        getTimezoneOffset(date);
}

/**
 * The preferred "universal" compact datetime format of mine - with some timezone format display options.
 * Examples results:
 * 2025-07-24 20:39                                 // none (default timezone display option)
 * 2025-07-24 20:39 +02:00                          // offset
 * 2025-07-24 20:39 CEST                            // short
 * 2025-07-24 20:39 Central European Summer Time    // long
 * 2025-07-24 20:39 GMT+2                           // shortOffset
 * 2025-07-24 20:39 GMT+02:00                       // longOffset
 * 2025-07-24 20:39 CET                             // shortGeneric
 * 2025-07-24 20:39 Central European Time           // longGeneric
 * 2025-07-24 20:39 Europe/Copenhagen               // regional
 * 2025-07-24 18:39 UTC                             // UTC
 * @param [date=Date()] {Date} - Defaults to current date/time.
 * @param [tzFormat='none'] {'none'|'offset'|'short'|'long'|'shortOffset'|'longOffset'|'shortGeneric'|'longGeneric'|'regional'|'UTC'}
 * @returns {string}
 */
export function shortDateTime(date = new Date(), tzFormat = 'none') {
    let tz;
    switch (tzFormat) {
        case 'offset':
            tz = getTimezoneOffset(date);
            break;
        case 'short':
        case 'long':
        case 'shortOffset':
        case 'longOffset':
        case 'shortGeneric':
        case 'longGeneric':
        case 'regional':
            tz = getTimezoneDisplay(date, tzFormat);
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
