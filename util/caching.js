
const kv = await Deno.openKv();

export async function get(key) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    const content = await kv.get(key);
    return JSON.parse(content?.value ?? '[]');
}

/**
 * Set a value in the cache
 * TODO: Note, Kv.set(key,val) throws exception if val > 65536 bytes
 * @param key
 * @param value
 * @returns {Promise<Deno.KvCommitResult>}
 */
export async function set(key, value) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    return await kv.set(key, JSON.stringify(value));
}
