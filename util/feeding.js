import {parseRssFeed, generateJsonFeed, generateRssFeed} from 'npm:feedsmith@next';

const corsAllowHostnames = Deno.env.get('feedbender_cors_allow_hostnames')?.toLowerCase()?.split(/\s*(?:[,;]|$)\s*/) ?? [];

const fetcherUserAgent = 'Feed-bender/1.0 (https://feed-bender.deno.dev/)';
const feedFetcherHeaders = new Headers({
    'User-Agent': fetcherUserAgent
});

/**
 * Checks if str is a date in RFC 2822 date format
 * @param str
 * @returns {boolean}
 */
export function isRFC2822DateString(str) {
    return /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(0[1-9]|[1-2]?[0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19[0-9]{2}|[2-9][0-9]{3})\s+(2[0-3]|[0-1][0-9]):([0-5][0-9])(?::(60|[0-5][0-9]))?\s+([-+][0-9]{2}[0-5][0-9]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))(\s+|\(([^()]+|\\\(|\\\))*\))*$/.test(str);
}

/**
 * Checks if the origin is allowed for CORS
 * @param origin
 * @returns {boolean}
 */
export function isAllowedForCors(origin) {
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

/**
 * Fetches a text response from a URL
 * @param request
 * @param options
 * @returns {Promise<string>}
 */
async function fetchText(request, options) {
    const response = await fetch(request, options);
    if (!response.ok) {
        throw new Error(`fetch '${request.url ?? request}' response status: ${response.status}: \n${response.statusText}`);
    }
    return await response.text();
}

/**
 * Fetches a JSON response from a URL
 * @param request
 * @param options
 * @returns {Promise<any>}
 */
async function fetchJson(request, options) {
    const response = await fetch(request, options);
    if (!response.ok) {
        throw new Error(`fetch '${request.url ?? request}' response status: ${response.status}: \n${response.statusText}`);
    }
    return await response.json();
}

/**
 * Fetches and parses the source items from a provided RSS feed URL.
 *
 * @param {string} req The URL of the RSS feed to fetch and parse.
 * @param {number} [timeout=15000] The maximum time (in milliseconds) to wait for the fetch request to complete before timing out. Defaults to 15 seconds.
 * @return {Promise<Object[]>} A promise that resolves to an array of parsed source items from the RSS feed. If an error occurs, it returns an empty array.
 */
export async function getParsedSourceItems(req, timeout = 15000) {
    let items = [];
    let text;
    try {
        text = await fetchText(
            req,
            {
                headers: feedFetcherHeaders,
                signal: AbortSignal.timeout(timeout) // timeout after 10 seconds
            }
        );
        const feed = parseRssFeed(text);

        // console.log(`The full feed:\n${JSON.stringify(feed)}`);

        items = feed.items ?? [];
        console.log(` 🤖 RSS FEED ${req} WAS READ`);
    } catch (e) {
        if (text?.length) {
            console.log('Response body:\n', text);
        }
        console.error(e);
    }
    return items;
}

/**
 * Returns a "tool" that can help creating a JSONFeed or RSS feed
 * @param feedType {'json'|'rss'}
 * @param feedTitle {string}
 * @param feedDescription {string}
 * @param feedUrl {string} - "self" link to the feed
 * @param siteUrl {string}
 * @param authorName {string} - A "site-global" authorname. Could just be sitename or some general term like "users".
 * @param logoUrl {string}
 * @returns {{title, description, home_page_url, language: string, feed_url, authors: [{name, url}], items: *[]}|{title, description, link, atom: {links: [{href, rel: string, type: string}]}, language: string, generator: string, items: *[]}|string|{readonly contentType: string, readonly template: {title: *, description: *, home_page_url: *, language: string, feed_url: *, authors: [{name: *, url: *}], items: []}|{title: *, description: *, link: *, atom: {links: [{href: *, rel: string, type: string}]}, language: string, generator: string, items: []}, createItem: {(*): {id: (*|string), title: string, content_html: string, author: {name: (*|string)}, authors: [{name: (*|string)}], url: string, date_published: Date}, (*): {guid: {value: (*|string), isPermaLink: boolean}, title: string, link: string, description: string, pubDate: *, dc: {creator: (*|string)}}}, createResponseBody: {(*): string, (*): *}}}
 */
export function getCreateFeedTool(feedType, feedTitle, feedDescription, feedUrl, siteUrl, authorName, logoUrl) {

    const contentType = (feedType === 'json' ?
        'application/feed+json; charset=utf-8'
        : 'application/rss+xml; charset=utf-8');

    function createJsonItem(item) {
        const newItem = {
            id: item.guid?.value ?? item.link ?? 'https://www.canonrumors.com/',
            title: item.title ?? '(No title)',
            content_html: item.content?.encoded ?? item.description ?? '<p>(No content)</p>',
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
            newItem.image = item.enclosures.find(enclosure => enclosure.type?.startsWith('image/'))?.url ?? logoUrl;
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
    }

    function createRssItem(item) {
        const newItem = {
            guid: {
                value: item.guid?.value ?? item.link ?? 'https://www.canonrumors.com/',
                isPermaLink: false
            },
            title: item.title ?? '(No title)',
            link: item.link ?? 'https://www.canonrumors.com/',
            description: item.content?.encoded ?? item.description ?? '<p>(No content)</p>',
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
    }

    function createJsonResponseBody(feedData) {
        const jsonFeedObj = generateJsonFeed(feedData);
        return JSON.stringify(jsonFeedObj);
    }

    function createRssResponseBody(feedData) {
        return generateRssFeed(feedData);
    }


    return {
        get contentType() {
            return contentType;
        },
        get template() {
            return feedType === 'json' ?
                {
                    title: feedTitle,
                    description: feedDescription,
                    home_page_url: siteUrl,
                    language: 'en-US',
                    feed_url: feedUrl,
                    authors: [ // but only if there are a "global" author?
                        {
                            name: authorName,
                            url: siteUrl
                        }
                    ],
                    items: []
                } :
                {
                    title: feedTitle,
                    description: feedDescription,
                    link: siteUrl,
                    atom: {
                        links: [{
                            href: feedUrl,
                            rel: 'self',
                            type: 'application/rss+xml'
                        }]
                    },
                    language: 'en-US',
                    generator: 'https://feed-bender.deno.dev/',
                    items: []
                }
        },
        createItem: feedType === 'json' ? createJsonItem : createRssItem,
        createResponseBody: feedType === 'json' ? createJsonResponseBody : createRssResponseBody
    }

}
