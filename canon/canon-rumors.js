import * as feeding from './../util/feeding.js';
import * as caching from './../util/caching.js';
import { shortDateTime } from '../static/datetime.js';

const sourceFeed = 'https://www.canonrumors.com/feed/';
const sourceLabel = 'CRNEWS';
const cacheId = 'cr-cache';
const cacheMinuttes = 60;
const feedLength = 12;

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
    'industry rumors',
    'canon reviews',
    // 'from the vault'
];

/**
 * Returns if a post/item belongs to some unwanted category
 * @param item {Object}
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
 * Returns a filtered list of items, omitting items in unwanted categories
 * @param items
 * @returns {Object[]}
 */
function filteredItemList(items) {
    const filteredList = [];
    items.forEach((item) => {
        if (!inUnwantedCategory(item)) {
            filteredList.push(item);
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

    if (cachedItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (cacheMinuttes * 60 * 1000))) {
        console.log(` 🤖 For ${sourceLabel}, just use the recently updated (${shortDateTime(cachedTime,'shortOffset')}) CACHED ITEMS`);
        return cachedItems;
    }

    const sourceItems = await feeding.getParsedSourceItems(sourceFeed);
    let relevantItems = [];
    if (sourceItems?.length) {
        relevantItems = filteredItemList(sourceItems);
    }

    cachedItems.forEach((item) => {
        if (!relevantItems.find(relevant => relevant.guid?.value === item.guid?.value)) {
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
 * Returns a filtered feed of Canon Rumors posts, omitting posts in unwanted categories
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function canonRumors(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'Canon Rumors - Essential posts only',
        'This is a filtered version of the official news feed from Canon Rumors. Posts in some categories are omitted',
        `https://feed-bender.deno.dev/canon/crfeed.${feedType}`,
        'https://www.canonrumors.com/',
        'Canon Rumors',
        'https://www.canonrumors.com/wp-content/uploads/2022/05/logo-alt.png'
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
    const responseBody = CreateFeedTool.createResponseBody(feedData);
    return {
        body: responseBody,
        options: {
            status: 200,
            statusText: 'OK',
            headers: respHeaders
        }
    };

}
