import * as feeding from './../util/feeding.js';
import * as caching from './../util/caching.js';
import { shortDateTime } from '../static/datetime.js';

const sourceFeed = 'https://image-sensors-world.blogspot.com/feeds/posts/default?alt=rss';
const sourceLabel = 'ISWORLD';
const cacheId = 'isw-cache';
const cacheMinutes = 240; // 4 hours
const feedLength = 6;

const matchCanonRegex = feeding.wordMatchRegex('canon');

/**
 * Returns a filtered list of items
 * @param items {Object[]}
 * @param [maxLength=feedLength] {number} - maximum number of items to return, defaults to feedLength
 * @returns {Object[]}
 */
function filteredItemList(items, maxLength = feedLength) {
    const filteredList = [];
    items.forEach((item) => {
        if (item.categories?.some(category => matchCanonRegex.test(category.name))
            || matchCanonRegex.test(item.title ?? '')
            || matchCanonRegex.test(item.description ?? '')
        ) {
            if (filteredList.length < maxLength) filteredList.push(item);
        }
    });
    return filteredList;
}

/**
 * Returns a list of relevant (filtered) feed items
 * @returns {Promise<Object[]>}
 */
async function feedItems() {
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
 * Returns a filtered feed, omitting posts in unwanted categories
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function isWorld(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'Image Sensor World - Canon related post only',
        'This is a filtered version of the official news feed from Image Sensor World with only the Canon related posts.',
        `https://feed-bender.deno.dev/canon/iswfeed.${feedType}`,
        'https://image-sensors-world.blogspot.com/',
        'Image Sensor World',
        'https://www.feed-bender.deno.dev/favicon-32x32.png', // because I don't have anything better to use right now // TODO ?
        'daily',
        3 // every eight hours
    );

    const origin = reqHeaders.get('Origin');
    const respHeaders = new Headers({'Content-Type': CreateFeedTool.contentType});
    if (origin && feeding.isAllowedForCors(origin)) {
        respHeaders.set('Access-Control-Allow-Origin', origin);
        respHeaders.set('Vary', 'Origin');
    }
    const feedData = CreateFeedTool.template;
    const latestRelevantItems = await feedItems();
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
