
const kv = await Deno.openKv();

export async function get(key) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    const content = await kv.get(key);
    return JSON.parse(content?.value ?? '[]');
}

export async function set(key, value) {
    if (!Array.isArray(key)) {
        key = [key];
    }
    return await kv.set(key, JSON.stringify(value));
}
