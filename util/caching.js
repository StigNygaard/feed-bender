
const kv = await Deno.openKv();

export async function get(key) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    const content = await kv.get(key);
    return JSON.parse(content?.value ?? '[]');
}

/**
 * Set a value in the cache. Throws error if failing.
 * @param key
 * @param value
 * @returns {Promise<Deno.KvCommitResult>}
 */
export async function set(key, value) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    const jsonValue = JSON.stringify(value);
    if (jsonValue.length >= 32768) {
        const err = `Cache value for key '${key}' is ${jsonValue.length} 'code units' long, and larger than allowed`;
        console.error(err);
        throw new Error(err);
    }
    const retVal = await kv.set(key, JSON.stringify(value));
    retVal.info = `String value of length ${jsonValue.length} is cached on key '${key}'`;
    return retVal;
}
