import {parseRssFeed, generateJsonFeed, generateRssFeed} from "npm:feedsmith@next";
import * as caching from "./../util/caching.js";

const corsAllowHostnames = Deno.env.get('feedbender_cors_allow_hostnames')?.toLowerCase()?.split(/\s*(?:[,;]|$)\s*/) ?? [];
const feedFetcherUserAgent = 'Feed-bender/1.0 (https://feed-bender.deno.dev/)';

/**
 * Unwanted categories of posts to be ignored (lowercase)
 * @type {string[]}
 */
const skipCategories = [
    'deal zone',
    'dealzone',
    'buyers guide',
    'smart picks',
    'industry news',
    'canon reviews',
    // 'from the vault'
];

const feedFetcherHeaders = new Headers({
    'User-Agent': feedFetcherUserAgent
});

/**
 * Returns if a post/item belongs to some unwanted category
 * @param item
 * @returns {boolean}
 */
function inUnwantedCategory(item) {
    const categories = item.categories;
    let unwanted = false;
    categories?.forEach(category => {
        const categoryName = category.name.trim().toLowerCase();
        // Also unwanted if just a "substring" of a category-name matches a skipCategory:
        if (skipCategories.some(skipCategory => categoryName.includes(skipCategory))) {
            unwanted = true; // is an unwanted item
        }
    });
    return unwanted;
}

/**
 * Checks if str is a date in RFC 2822 date format
 * @param str
 * @returns {boolean}
 */
function isRFC2822DateString(str) {
    return /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(0[1-9]|[1-2]?[0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19[0-9]{2}|[2-9][0-9]{3})\s+(2[0-3]|[0-1][0-9]):([0-5][0-9])(?::(60|[0-5][0-9]))?\s+([-+][0-9]{2}[0-5][0-9]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))(\s+|\(([^()]+|\\\(|\\\))*\))*$/.test(str);
}

function isAllowedForCors(origin) {
    let originHostname = URL.parse(origin)?.hostname?.toLowerCase();
    if (originHostname != null) {
        for (const corsAllowedHostname of corsAllowHostnames) {
            if (
                corsAllowedHostname.length &&
                (originHostname === corsAllowedHostname || originHostname.endsWith(`.${corsAllowedHostname}`))
            ) {
                return true;
            }
        }
    }
    return false;
}

async function fetchText(request, options) {
    const response = await fetch(request, options);
    if (!response.ok) {
        throw new Error(`fetch '${request.url ?? request}' response status: ${response.status}: \n${response.statusText}`);
    }
    return await response.text();
}

async function fetchJson(request, options) {
    const response = await fetch(request, options);
    if (!response.ok) {
        throw new Error(`fetch '${request.url ?? request}' response status: ${response.status}: \n${response.statusText}`);
    }
    return await response.json();
}

async function readRSSFeed() {
    let items = [];
    let text;
    try {
        text = await fetchText(
            'https://www.canonrumors.com/feed/',
            {
                headers: feedFetcherHeaders,
                signal: AbortSignal.timeout(10000) // timeout after 10 seconds
            }
        );
        const feed = parseRssFeed(text);

        // console.log(`The full feed:\n${JSON.stringify(feed)}`);

        items = feed.items ?? [];
        console.log(' 🤖 THE OFFICIAL RSS FEED WAS READ');
    } catch (e) {
        if (text?.length) {
            console.log('Response body:\n', text);
        }
        console.error(e);
    }
    return items;
}

/**
 * Returns a filtered list of items, omitting items in unwanted categories
 * @param items
 * @returns {*[]}
 */
function filteredItemsList(items) {
    const filteredList = [];
    items.forEach((item) => {
        if (!inUnwantedCategory(item)) {
            filteredList.push(item);
        }
    });
    return filteredList;
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
        cachedItems = filteredItemsList(cached.cachedItems);
    }
    // console.log(` 🤖 CACHED CONTENT FROM ${cachedTime} WAS READ`);

    if (cachedItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (60 * 60 * 1000))) {
        console.log(' 🤖 WILL JUST USE the recently updated CACHED ITEMS');
        return cachedItems;
    }

    const newRSSItems = await readRSSFeed();
    let relevantItems = [];
    if (newRSSItems?.length) {
        relevantItems = filteredItemsList(newRSSItems);
    }

    cachedItems.forEach((item) => {
        if (!relevantItems.find(relevant => relevant.guid?.value === item.guid?.value)) {
            relevantItems.push(item);
        }
    });
    if (relevantItems.length) {
        if (relevantItems.length > cachedItems.length) {
            console.log(' 🌟 A new item was added to the feed!');
        }
        await caching.set('cr-cache', {cachedTime: feedRequestTime, cachedItems: relevantItems.slice(0, 12)});
        console.log(` 🤖 Cached content was ${newRSSItems?.length ? 'updated' : '"extended"'}`);
    }
    return relevantItems;
}

const JsonFeedTool = {
    get contentType() {
        return 'application/feed+json; charset=utf-8'
    },
    get template() {
        return {
            title: 'Canon Rumors - Essential posts only',
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
        }
    },
    createItem: function (item) {
        const newItem = {
            id: item.guid?.value ?? item.link ?? 'https://www.canonrumors.com/',
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
            // RFC 2822 Date format (like "Sun, 13 Jul 2025 07:17:55 +0000") is supported as constructor-value, even if it's not part of ECMAScript standard
            date_published: isRFC2822DateString(item.pubDate ?? '') ? new Date(item.pubDate) : new Date(),
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
        return newItem;
    },
    createResponseBody: function (feedData) {
        const jsonFeedObj = generateJsonFeed(feedData);
        return JSON.stringify(jsonFeedObj);
    }
}

const RssFeedTool = {
    get contentType() {
        return 'application/rss+xml; charset=utf-8'
    },
    get template() {
        return {
            title: 'Canon Rumors - Essential posts only',
            link: 'https://www.canonrumors.com/',
            atom: {
                links: [{
                    href: 'https://feed-bender.deno.dev/canon/crfeed.rss',
                    rel: 'self',
                    type: 'application/rss+xml'
                }]
            },
            description: 'This is a filtered version of the official news feed from Canon Rumors. Posts in some categories are omitted',
            language: 'en-US',
            generator: 'https://feed-bender.deno.dev/',
            items: []
        }
    },
    createItem: function (item) {
        const newItem = {
            guid: {
                value: item.guid?.value ?? item.link ?? 'https://www.canonrumors.com/',
                isPermaLink: false
            },
            title: item.title ?? '(No title)',
            link: item.link ?? 'https://www.canonrumors.com/',
            description: item.description ?? '<p>(No content)</p>',
            // RFC 2822 Date format (like "Sun, 13 Jul 2025 07:17:55 +0000") is supported as constructor-value, even if it's not part of ECMAScript standard
            pubDate: item.pubDate, // isRFC2822DateString(item.pubDate ?? '') ? new Date(item.pubDate) : new Date(),
            dc: {
                creator: item.dc?.creator ?? 'Canon Rumors'
            }
        };
        if (item.enclosures?.length) {
            newItem.enclosures = [];
            item.enclosures.forEach(enclosure => {
                const newEnclosure = {
                    url: enclosure.url,
                    type: enclosure.type
                }
                if (enclosure.length) {
                    newEnclosure.length = enclosure.length;
                }
                newItem.enclosures.push(newEnclosure);
            });
        }
        if (item.categories?.length) {
            newItem.categories = [];
            item.categories.forEach(category => {
                newItem.categories.push({name: category.name});
            });
        }
        return newItem;
    },
    createResponseBody: function (feedData) {
        return generateRssFeed(feedData);
    }
}

export async function canonRumors(feedType, reqHeaders, info, logging = false) {
    const FeedTool = feedType.toLowerCase() === 'json' ? JsonFeedTool : RssFeedTool; // semi-OOP ;-)
    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': FeedTool.contentType});
    if (origin && isAllowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }
    const feedData = FeedTool.template;
    const latestRelevantItems = await feedItems();
    latestRelevantItems.forEach((item) => {
        feedData.items.push(FeedTool.createItem(item));
    });
    const responseBody = FeedTool.createResponseBody(feedData);
    return {
        body: responseBody,
        options: {
            status: 200,
            statusText: 'OK',
            headers: respHeaders
        }
    };

}
