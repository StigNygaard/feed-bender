import * as feeding from './../util/feeding.js';
import * as caching from './../util/caching.js';
import {shortDateTime} from "../static/datetime.js";

// XenForo forum system

const sourceFeed = 'https://www.dpreview.com/forums/forums/-/index.rss?order=post_date';
const sourceLabel = 'DPRFORUMALL';
const cacheId = 'dprforumall-cache';
const cacheMinutes = 60;
const feedLength = 12;


/**
 * Returns a filtered list of new threads (topics) in forum
 * @param items
 * @param [maxLength=feedLength] {number} - maximum number of items to return, defaults to feedLength
 * @returns {Object[]}
 */
function filteredItemList(items, maxLength = feedLength) {
    const filteredList = [];
    for (const item of items) {
        if (filteredList.length < maxLength) filteredList.push(item);
    }
    return filteredList;
}

/**
 * Removes "read more" links
 * @param items {Object[]}
 * @returns {Object[]} */
function tweakItems(items) {
    for (const item of items) {
        if (item.content?.encoded) {
            item.content.encoded = item.content.encoded.replace(
                /<a\s+href="https:\/\/www\.dpreview\.com\/forums\/threads\/[a-zA-Z0-9./_-]+"\s+class="link\s+link--internal">Read\s+more<\/a><\/div>$/,
                '</div>'
            );
        }
    }
    return items;
}

/**
 * Returns a list of relevant/filtered feed items
 * @returns {Promise<Object[]>}
 */
async function feedItems() {
    const feedRequestTime = new Date();
    let cachedTime = new Date('2000-01-01');
    let finalItems = [];
    const cached = await caching.get(cacheId);
    if (cached?.cachedTime) {
        cachedTime = new Date(cached.cachedTime);
    }
    if (cached?.cachedItems) {
        finalItems = tweakItems(filteredItemList(cached.cachedItems));
    }
    // console.log(` 🤖 CACHED FORUM-CONTENT FROM ${cachedTime} WAS READ. There was ${finalItems?.length} cached items.`);

    if (finalItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (cacheMinutes * 60 * 1000))) {
        console.log(` 🤖 For ${sourceLabel}, just use the recently updated (${shortDateTime(cachedTime,'shortOffset')}) CACHED ITEMS`);
        return finalItems;
    }
    const highestGuid = finalItems.length ? finalItems[0].guid.value : 0;

    const sourceItems = await feeding.getParsedSourceItems(sourceFeed);
    let relevantSourceItems = [];
    if (sourceItems?.length) {
        sourceItems.sort((a, b) => {
            const va = Number(a.guid?.value);
            const vb = Number(b.guid?.value);
            return (Number.isNaN(vb) ? 0 : vb) - (Number.isNaN(va) ? 0 : va)
        });

        // console.log('\nsourceItems:\n', JSON.stringify(sourceItems));

        relevantSourceItems = tweakItems(filteredItemList(sourceItems));
    }
    const lengthOfCachedItems = finalItems.length;
    finalItems.unshift(...relevantSourceItems.filter(item => item.guid.value > highestGuid));
    if (finalItems?.length > lengthOfCachedItems) {
        console.log(` 🌟 ${finalItems?.length - lengthOfCachedItems} new thread(s) was added to the ${sourceLabel} feed!`);
    }
    if (finalItems.length) {
        let cached = {};
        try {
            cached = await caching.set(cacheId, {
                cachedTime: feedRequestTime,
                cachedItems: finalItems.slice(0, feedLength)
            });
        } catch (err) {
            console.error(` 💣 Error when trying to update cache for ${sourceLabel}!`, err);
        }
        if (cached?.ok) {
            console.log(` 🤖 Cache for ${sourceLabel} was ${sourceItems?.length ? 'updated' : '"extended"'}. ${cached.info}.`);
        } else {
            console.warn(` 💣 Failed updating cache for ${sourceLabel}!`)
        }
    }
    return finalItems;
}

/**
 * Returns a filtered feed of new DPReview Forum threads (topics)
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function dprForumAll(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'DPReview Forums - New threads (topics)',
        'Keeping track of new threads (topics) in DPReview Forums',
        `https://feed-bender.deno.dev/canon/dprforumallfeed.${feedType}`,
        'https://www.dpreview.com/forums/',
        'DPreview Forums users',
        'https://www.dpreview.com/forums/data/styles/4/styles/dpreview/xenforo/icon.png'
    );

    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': CreateFeedTool.contentType});
    if (origin && feeding.isAllowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }
    const feedData = CreateFeedTool.template;
    const latestRelevantItems = await feedItems();
    for (const item of latestRelevantItems) {
        feedData.items.push(CreateFeedTool.createItem(item));
    }
    const responseBody = CreateFeedTool.createResponseBody(feedData, { lenient: true });
    return {
        body: responseBody,
        options: {
            status: 200,
            statusText: 'OK',
            headers: respHeaders
        }
    };

}
