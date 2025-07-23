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


/* TEMP function with data to init cache */
function hardcodedRSSContent() {
    const text = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:wfw="http://wellformedweb.org/CommentAPI/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:atom="http://www.w3.org/2005/Atom"
\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
\txmlns:slash="http://purl.org/rss/1.0/modules/slash/"
\t>

<channel>
\t<title>Canon Rumors</title>
\t<atom:link href="https://www.canonrumors.com/feed/" rel="self" type="application/rss+xml" />
\t<link>https://www.canonrumors.com/</link>
\t<description>Your Best Source for Canon News, Rumors and More</description>
\t<lastBuildDate>Sun, 20 Jul 2025 13:34:49 +0000</lastBuildDate>
\t<language>en-US</language>
\t<sy:updatePeriod>
\thourly\t</sy:updatePeriod>
\t<sy:updateFrequency>
\t1\t</sy:updateFrequency>
\t<generator>https://wordpress.org/?v=6.8.2</generator>
\t\t<item>
\t\t<title>Canon Brings Cropping Guide Firmware to the EOS R8 and EOS R6 Mark II</title>
\t\t<link>https://www.canonrumors.com/canon-brings-cropping-guide-firmware-to-the-eos-r8-and-eos-r6-mark-ii/</link>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Sun, 20 Jul 2025 13:27:21 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon EOS R]]></category>
\t\t<category><![CDATA[EOS R6 Mark II]]></category>
\t\t<category><![CDATA[EOS R8]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78528</guid>

\t\t\t\t\t<description><![CDATA[<p>Canon USA has added support for thea cropping guide feature via a paid firmware upgrade for the EOS R6 Mark II and EOS R8. These are the first Canon full-frame cameras to support the feature. Canon introduced this firmware late last year for the EOS R50, EOS R10 and EOS R7. It has been quite [&#8230;]</p>
<p>The post <a href="https://www.canonrumors.com/canon-brings-cropping-guide-firmware-to-the-eos-r8-and-eos-r6-mark-ii/">Canon Brings Cropping Guide Firmware to the EOS R8 and EOS R6 Mark II</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>



\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/05/eosr62169header-2.jpg" length="359050" type="image/jpeg" />
\t</item>
\t\t<item>
\t\t<title>Canon Announces the Speedlite EL-1 Version 2</title>
\t\t<link>https://www.canonrumors.com/canon-announces-the-speedlite-el-1-version-2/</link>
\t\t\t\t\t<comments>https://www.canonrumors.com/canon-announces-the-speedlite-el-1-version-2/#respond</comments>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Thu, 17 Jul 2025 07:39:24 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon Accessories]]></category>
\t\t<category><![CDATA[Speedlite EL-1]]></category>
\t\t<category><![CDATA[Speedlite EL-1v2]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78476</guid>

\t\t\t\t\t<description><![CDATA[<p>Canon has officially announced the Speedlite EL-1 Version 2. The launch price in the USA is an eye-watering $1349! The new EL-1 v2 is scheduled to begin shipping in September. Canon Speedlite EL-1 Version 2 Overview Power, connectivity, and reliability, the Canon Speedlite EL-1 (Version 2) is an on-camera E-TTL / E-TTL II-compatible flash characterized [&#8230;]</p>
<p>The post <a href="https://www.canonrumors.com/canon-announces-the-speedlite-el-1-version-2/">Canon Announces the Speedlite EL-1 Version 2</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>

\t\t\t\t\t<wfw:commentRss>https://www.canonrumors.com/canon-announces-the-speedlite-el-1-version-2/feed/</wfw:commentRss>
\t\t\t<slash:comments>0</slash:comments>


\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/07/speedliteel1v2h.jpg" length="282053" type="image/jpeg" />
\t</item>
\t\t<item>
\t\t<title>Canon EOS R3 Firmware v1.9.0 Now Available</title>
\t\t<link>https://www.canonrumors.com/canon-eos-r3-firmware-v1-9-0-now-available/</link>
\t\t\t\t\t<comments>https://www.canonrumors.com/canon-eos-r3-firmware-v1-9-0-now-available/#respond</comments>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Thu, 17 Jul 2025 07:15:58 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon EOS R]]></category>
\t\t<category><![CDATA[EOS R3]]></category>
\t\t<category><![CDATA[firmware]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78471</guid>

\t\t\t\t\t<description><![CDATA[<p>Canon has released firmware v1.9.0 for the EOS R3, this firmware update adds a couple of new features along with various bug fixes. Canon EOS R3 v1.9.0 This firmware includes the following changes: Download firmware v1.9.0</p>
<p>The post <a href="https://www.canonrumors.com/canon-eos-r3-firmware-v1-9-0-now-available/">Canon EOS R3 Firmware v1.9.0 Now Available</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>

\t\t\t\t\t<wfw:commentRss>https://www.canonrumors.com/canon-eos-r3-firmware-v1-9-0-now-available/feed/</wfw:commentRss>
\t\t\t<slash:comments>0</slash:comments>


\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/03/eosr3colourfulheader.jpg" length="494279" type="image/jpeg" />
\t</item>
\t\t<item>
\t\t<title>Canon EOS R5 Mark II Firmware v1.1.0 Now Available (Update: Firmware has been pulled)</title>
\t\t<link>https://www.canonrumors.com/canon-eos-r5-mark-ii-firmware-v1-1-0-now-available/</link>
\t\t\t\t\t<comments>https://www.canonrumors.com/canon-eos-r5-mark-ii-firmware-v1-1-0-now-available/#respond</comments>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Thu, 17 Jul 2025 07:10:26 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon EOS R]]></category>
\t\t<category><![CDATA[EOS R5 Mark II]]></category>
\t\t<category><![CDATA[firmware]]></category>
\t\t<category><![CDATA[spotlight]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78469</guid>

\t\t\t\t\t<description><![CDATA[<p>Update: In true Canon fashion, they have already pulled this firmware version. They seriously suck at software. Feedback that the firmware for the mirrorless cameras &#8220;EOS R1&#8221; and &#8220;EOS R5 Mark II&#8221; cannot be played back on the camera or PC when using a card with a capacity of over 2TB to shoot video with [&#8230;]</p>
<p>The post <a href="https://www.canonrumors.com/canon-eos-r5-mark-ii-firmware-v1-1-0-now-available/">Canon EOS R5 Mark II Firmware v1.1.0 Now Available (Update: Firmware has been pulled)</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>

\t\t\t\t\t<wfw:commentRss>https://www.canonrumors.com/canon-eos-r5-mark-ii-firmware-v1-1-0-now-available/feed/</wfw:commentRss>
\t\t\t<slash:comments>0</slash:comments>


\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/06/eosr5markiiheaderfire169.jpg" length="409130" type="image/jpeg" />
\t</item>
\t\t<item>
\t\t<title>Canon EOS R1 Firmware v1.1.0 Now Available (Update: Firmware has been pulled)</title>
\t\t<link>https://www.canonrumors.com/canon-eos-r1-firmware-v1-1-0-now-available/</link>
\t\t\t\t\t<comments>https://www.canonrumors.com/canon-eos-r1-firmware-v1-1-0-now-available/#respond</comments>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Thu, 17 Jul 2025 07:05:53 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon EOS R]]></category>
\t\t<category><![CDATA[EOS R1]]></category>
\t\t<category><![CDATA[firmware]]></category>
\t\t<category><![CDATA[spotlight]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78467</guid>

\t\t\t\t\t<description><![CDATA[<p>Update: In true Canon fashion, they have already pulled this firmware version. They seriously suck at software. Feedback that the firmware for the mirrorless cameras &#8220;EOS R1&#8221; and &#8220;EOS R5 Mark II&#8221; cannot be played back on the camera or PC when using a card with a capacity of over 2TB to shoot video with [&#8230;]</p>
<p>The post <a href="https://www.canonrumors.com/canon-eos-r1-firmware-v1-1-0-now-available/">Canon EOS R1 Firmware v1.1.0 Now Available (Update: Firmware has been pulled)</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>

\t\t\t\t\t<wfw:commentRss>https://www.canonrumors.com/canon-eos-r1-firmware-v1-1-0-now-available/feed/</wfw:commentRss>
\t\t\t<slash:comments>0</slash:comments>


\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/05/eosr1japan2025-2.jpg" length="503403" type="image/jpeg" />
\t</item>
\t\t<item>
\t\t<title>Canon Announces New Firmware For the EOS R1 and EOS R5 Mark II</title>
\t\t<link>https://www.canonrumors.com/canon-announces-new-firmware-for-the-eos-r1-and-eos-r5-mark-ii/</link>

\t\t<dc:creator><![CDATA[Craig Blair]]></dc:creator>
\t\t<pubDate>Wed, 16 Jul 2025 21:41:10 +0000</pubDate>
\t\t\t\t<category><![CDATA[Canon EOS R]]></category>
\t\t<category><![CDATA[EOS R1]]></category>
\t\t<category><![CDATA[EOS R5 Mark II]]></category>
\t\t<category><![CDATA[spotlight]]></category>
\t\t<guid isPermaLink="false">https://www.canonrumors.com/?p=78462</guid>

\t\t\t\t\t<description><![CDATA[<p>Canon is going to be releasing new firmware for most of the current EOS R lineup. The big updates will come to the EOS R1 and EOS R5 Mark II. Canon EOS R1 &#38; EOS R5 Mark II C2PA Both cameras will be getting C2PA Content Authenticity, which Canon has been talking about for quite [&#8230;]</p>
<p>The post <a href="https://www.canonrumors.com/canon-announces-new-firmware-for-the-eos-r1-and-eos-r5-mark-ii/">Canon Announces New Firmware For the EOS R1 and EOS R5 Mark II</a> appeared first on <a href="https://www.canonrumors.com">Canon Rumors</a>.</p>
]]></description>



\t\t<enclosure url="https://www.canonrumors.com/wp-content/uploads/2025/04/eosr52header169.jpg" length="415662" type="image/jpeg" />
\t</item>
\t</channel>
</rss>`;

    const feed = parseRssFeed(text);
    const items = feed.items;
    console.log('\n *** PRE-CACHED RSS ITEMS ***\n');
    console.log(items);
    return items;
}

async function readRSSFeed() {
    // TODO ERROR-handling!?
    const response = await fetch('https://www.canonrumors.com/feed/');
    const text = await response.text();
    const feed = parseRssFeed(text);
    const items = feed.items; // ?? [];
    console.log('\n *** NATIVE RSS ITEMS ***\n');
    console.log(items);
    return items;
}

async function feedItems() {
    const feedRequestTime = new Date();
    let cachedTime = new Date('2000-01-01');

    // let cachedItems = [];
    let cachedItems = null; // TEMPORARY!

    const cached = await caching.get('cr-cache');
    if (cached?.cachedTime) {
        cachedTime = new Date(cached.cachedTime);
    }
    if (cached?.cachedItems) {
        cachedItems = cached.cachedItems;
    }

    console.log(`*** CACHED CONTENT FROM ${cachedTime} WAS READ ***`);

    cachedItems ??= hardcodedRSSContent(); // TEMPORARY!

    if ((feedRequestTime.getTime() - cachedTime.getTime()) < (30 * 60 * 1000)) {
        console.log('\n *** Just using the recently updated CACHED ITEMS ***\n');
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

    await caching.set('cr-cache', {cachedTime: feedRequestTime, cachedItems: relevantItems});
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
        description: 'This is a filtered version of the official feed from Canon Rumors. Posts in some categories are omitted',
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
        console.log('\n *** NEW FEED: *** \n');
        console.log(jsonFeed);
    }

    return success(200, 'OK', jsonFeed, respHeaders);

    // return jsonFeed;

}
