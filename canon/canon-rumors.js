import {parseRssFeed, generateJsonFeed} from "npm:feedsmith@next";
import * as caching from "./../util/caching.js";

const corsAllowHostnames = Deno.env.get('feedbender_cors_allow_hostnames')?.toLowerCase()?.split(/\s*(?:;|$)\s*/) ?? [];

/**
 * Unwanted categories to be ignored (lowercase)
 * @type {string[]}
 */
const skipCategories = [
    'deal zone',
    'dealzone',
    'buyers guide',
    'smart picks',
    'industry news',
    'from the vault'
];


/**
 * Returns if a post/item contains unwanted categories
 * @param item
 * @returns {boolean}
 */
function unwantedCategory(item) {
    const categories = item.categories;
    let returnVal = false;
    categories?.forEach(category => {
        if (skipCategories.includes(category.name.trim().toLowerCase()))
            returnVal = true; // is an unwanted item
    });
    return returnVal;
}

/**
 * Checks if str is a date in RFC 2822 date format
 * @param str
 * @returns {boolean}
 */
function isRFC2822DateString(str) {
    return /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(0[1-9]|[1-2]?[0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19[0-9]{2}|[2-9][0-9]{3})\s+(2[0-3]|[0-1][0-9]):([0-5][0-9])(?::(60|[0-5][0-9]))?\s+([-+][0-9]{2}[0-5][0-9]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))(\s+|\(([^()]+|\\\(|\\\))*\))*$/.test(str);
}


function allowedForCors(origin) {
    let originHostname = null;
    try {
        originHostname = new URL(origin).hostname.toLowerCase();
        // Unfortunately, it is (WAS!) too early to use URL.parse() instead to avoid try/catch ( https://caniuse.com/mdn-api_url_parse_static )
    } catch (_e) {
        return false;
    }
    for (const corsAllowedHostname of corsAllowHostnames) {
        if (
            corsAllowedHostname.length &&
            (originHostname === corsAllowedHostname || originHostname?.endsWith(`.${corsAllowedHostname}`))
        ) {
            return true;
        }
    }
    return false;
}

function success(_status, _statusText, jsonObj, headers) {
    const json = JSON.stringify(jsonObj);
    // if (json !== cache.get(`OkResponse`)) { // If we used KV or other database, we would try to avoid unnecessary writes
    //     cache.set(`OkResponse`, json);
    // } else {
    //     // console.log(`SKIP updating cached json - there's no change in data`);
    // }
    // cache.set(`OkTime`, Date.now().toString());
    // cache.set(`NextTime`, String(waitUntil().ok));
    return {
        body: json,
        options: {
            status: 200,
            statusText: 'OK',
            headers: headers
        }
    };
}

function fail(headers) {
    // const okResponse = cache.get(`OkResponse`) ?? '';
    // cache.set(`FailTime`, Date.now().toString());
    // if (okResponse) {
    //     cache.set(`NextTime`, String(waitUntil().failedWithFallback));
    // } else {
    //     cache.set(`NextTime`, String(waitUntil().failedWithoutFallback));
    // }

    // return error or...
    return fallback(headers);
}

function fallback(headers) {
    // const okResponse = cache.get(`OkResponse`) ?? '';
    // if (okResponse) {
    //     return {
    //         body: okResponse,
    //         options: {
    //             status: 200,
    //             statusText: 'OK - Using previously cached response',
    //             headers: headers
    //         }
    //     };
    // } else {
    return {
        body: `{error: 16, message: 'Not ready. Try again later'}`,
        options: {
            status: 425,
            statusText: 'Not ready. Successful response not available in proxy cache',
            headers: headers
        }
    };
    // }
}

async function readRSSFeed() {
    // TODO ERROR-handling!?
    const response = await fetch('https://www.canonrumors.com/feed/');
    const text = await response.text();
    const feed = parseRssFeed(text);
    const items = feed.items; // ?? [];
    console.log('*** /NATIVE/ RSS ITEMS WAS READ ***');
    return items;
}

async function feedItems() {
    const feedRequestTime = new Date();
    let cachedTime = new Date('2000-01-01');
    let cachedItems = [];
    const cached = await caching.get('cr-cache');
    if (cached?.cachedTime) {
        cachedTime = new Date(cached.cachedTime);
    }
    if (cached?.cachedItems) {
        cachedItems = cached.cachedItems;
    }

    console.log(`*** CACHED CONTENT FROM ${cachedTime} WAS READ ***`);

    if (cachedItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (30 * 60 * 1000))) {
        console.log('*** Just using the recently updated CACHED ITEMS ***');
        return cachedItems;
    }
    const newRSSItems = await readRSSFeed();
    const relevantItems = [];

    if (newRSSItems?.length) {
        newRSSItems.forEach((item) => {
            if (!unwantedCategory(item)) {
                relevantItems.push(item);
            }
        });
    }

    cachedItems.forEach((item) => {
        if (!relevantItems.find(relevant => relevant.guid?.value === item.guid?.value)) {
            relevantItems.push(item);
        }
    });

    if (relevantItems.length) {
        await caching.set('cr-cache', {cachedTime: feedRequestTime, cachedItems: relevantItems.slice(0, 10)});
        console.log('*** CACHED CONTENT WAS UPDATED ***');
    }
    return relevantItems;
}

export async function canonRumors(reqHeaders, info, logging = false) {
    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': 'application/feed+json'});
    // const respHeaders = new Headers({ 'Content-Type': 'application/json' });
    if (origin && allowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }

    const jsonFeedData = {
        title: 'Canon Rumors essentials',
        home_page_url: 'https://www.canonrumors.com/',
        description: 'This is a filtered version of the official news feed from Canon Rumors. Posts in some categories are omitted',
        language: 'en-US',
        feed_url: 'https://feed-bender.deno.dev/canon/crfeed.json',
        authors: [
            {
                name: 'Canon Rumors',
                url: 'https://www.canonrumors.com/',
            }
        ],
        items: []
    };

    const latestRelevantItems = await feedItems();
    latestRelevantItems.forEach((item) => {
        const newItem = {
            id: item.guid?.value ?? item.link ?? 'https://www.canonrumors.com/', // TODO a random GUID!?
            title: item.title ?? '(No title)',
            content_html: item.description ?? '<p>(No content)</p>',
            author: {
                name: item.dc?.creator ?? 'Canon Rumors'
            },
            authors: [
                {
                    name: item.dc?.creator ?? 'Canon Rumors'
                }
            ],
            url: item.link ?? 'https://www.canonrumors.com/',
            date_published: isRFC2822DateString(item.pubDate ?? '') ? new Date(item.pubDate) : new Date(), // from format like "Sun, 13 Jul 2025 07:17:55 +0000" - RFC 2822 Date format er bredt understøttet som constructor-value, selvom ikke officiel standard
        };
        if (item.enclosures?.length) {
            newItem.image = item.enclosures.find(enclosure => enclosure.type?.startsWith('image/'))?.url ?? 'https://www.canonrumors.com/wp-content/uploads/2022/05/logo-alt.png';
            newItem.attachments = [];
            item.enclosures.forEach(enclosure => {
                const attachment = {
                    url: enclosure.url,
                    mime_type: enclosure.type
                }
                if (enclosure.length) {
                    attachment.size_in_bytes = enclosure.length;
                }
                newItem.attachments.push(attachment);
            });
        }
        if (item.categories?.length) {
            newItem.tags = [];
            item.categories.forEach(category => {
                newItem.tags.push(category.name);
            });
        }
        jsonFeedData.items.push(newItem);

    });

    // Generate new JSON Feed:
    const jsonFeed = generateJsonFeed(jsonFeedData);

    if (logging) {
        console.log('*** JSON FEED CREATED ***');
    }

    return success(200, 'OK', jsonFeed, respHeaders);

    // return jsonFeed;

}
