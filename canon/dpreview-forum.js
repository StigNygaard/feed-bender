import * as feeding from './../util/feeding.js';
import * as caching from './../util/caching.js';
import { shortDateTime } from '../static/datetime.js';

const sourceFeed1 = 'https://www.dpreview.com/feeds/forums/1070'; // EOS R
const sourceFeed2 = 'https://www.dpreview.com/feeds/forums/1010'; // PowerShot
const sourceLabel1 = 'DPRFORUMEOSR';
const sourceLabel2 = 'DPRFORUMPOWERSHOT';
const cacheId1 = 'dprforumeosr-cache';
const cacheId2 = 'dprforumpowershot-cache';
const cacheMinutes = 60; // 1 hour
const feedLength = 12;


/**
 * Returns a filtered list of items
 * @param items {Object[]}
 * @param [maxLength=feedLength] {number} - maximum number of items to return, defaults to feedLength
 * @returns {Object[]}
 */
function filteredItemList(items, maxLength = feedLength) {
    return items.slice(0, maxLength); // No filtering for now - return maxLength items!
}

/**
 * Returns a list of relevant (filtered) feed items
 * @returns {Promise<Object[]>}
 */
async function feedItems(sourceFeed, sourceLabel, cacheId, cacheMinutes, feedLength) {
    const feedRequestTime = new Date();
    let cachedTime = new Date('2000-01-01');
    let cachedItems = [];
    const cached = await caching.get(cacheId);
    if (cached?.cachedTime) {
        cachedTime = new Date(cached.cachedTime);
    }
    if (cached?.cachedItems) {
        cachedItems = filteredItemList(cached.cachedItems);
    }
    // console.log(` 🤖 CACHED CONTENT FROM ${cachedTime} WAS READ`);

    if (cachedItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (cacheMinutes * 60 * 1000))) {
        console.log(` 🤖 For ${sourceLabel}, just use the recently updated (${shortDateTime(cachedTime,'shortOffset')}) CACHED ITEMS`);
        return cachedItems;
    }

    const sourceItems = await feeding.getParsedSourceItems(sourceFeed);
    let relevantItems = [];
    if (sourceItems?.length) {
        relevantItems = filteredItemList(sourceItems);
    }

    cachedItems.forEach((item) => {
        if (!relevantItems.some(relevant => relevant.guid?.value === item.guid?.value)) {
            relevantItems.push(item);
        }
    });
    if (relevantItems.length) {
        if (relevantItems.length > cachedItems.length) {
            console.log(` 🌟 A new item was added to the ${sourceLabel} feed!`);
        }
        await caching.set(cacheId, {cachedTime: feedRequestTime, cachedItems: relevantItems.slice(0, feedLength)});
        console.log(` 🤖 The cached ${sourceLabel} content was ${sourceItems?.length ? 'updated' : '"extended"'}`);
    }
    return relevantItems;
}

/**
 * Returns a feed
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function dprForumEosR(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'DPReview Forums - Canon EOS R talk',
        'Canon EOS R talk - Keeping track of new threads (topics) in the DPreview Forum.',
        `https://feed-bender.deno.dev/canon/dprfeosrfeed.${feedType}`,
        'https://www.dpreview.com/feeds/forums/1070',
        'DPReview Forum user',
        'https://2.img-dpreview.com/resources/images/logo-site-header.png'
    );

    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': CreateFeedTool.contentType});
    if (origin && feeding.isAllowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }
    const feedData = CreateFeedTool.template;
    const latestRelevantItems = await feedItems(sourceFeed1, sourceLabel1, cacheId1, cacheMinutes, feedLength);
    latestRelevantItems.forEach((item) => {
        feedData.items.push(CreateFeedTool.createItem(item));
    });
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

/**
 * Returns a feed
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function dprForumPowershot(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'DPReview Forums - Canon PowerShot talk',
        'Canon PowerShot talk - Keeping track of new threads (topics) in the DPreview Forum.',
        `https://feed-bender.deno.dev/canon/dprfpowershotfeed.${feedType}`,
        'https://www.dpreview.com/feeds/forums/1010',
        'DPReview Forum user',
        'https://2.img-dpreview.com/resources/images/logo-site-header.png'
    );

    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': CreateFeedTool.contentType});
    if (origin && feeding.isAllowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }
    const feedData = CreateFeedTool.template;
    const latestRelevantItems = await feedItems(sourceFeed2, sourceLabel2, cacheId2, cacheMinutes, feedLength);
    latestRelevantItems.forEach((item) => {
        feedData.items.push(CreateFeedTool.createItem(item));
    });
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
