import * as feeding from './../util/feeding.js';
import * as caching from './../util/caching.js';

/**
 * Tries to detect if an item is a comment-thread for a post on the main site.
 * Unfortunately, it is not exact science when based on only the content of the feed.
 * @param item
 * @returns {boolean}
 */
function isCommentThread(item) {
    return /full\sarticle\s?(\.\.\.)?<\/a><\/div>$/i.test(item.content?.encoded?.trim())
        || (
            (item.content?.encoded.endsWith('\n\t\t\t\t\t\t\n\t\t\t\t\t</span>\n\t\t\t\t\twww.canonrumors.com\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t</div></div>')
                && item.authors?.at(0)?.endsWith('(Richard CR)'))
        );
}

/**
 * Returns a filtered list of new threads in forum, trying to avoid the threads
 * created as comment-thread for a post on the main site.
 * @param items
 * @returns {Object[]}
 */
function filteredItemsList(items) {
    const filteredList = [];
    items.forEach((item) => {
        if (!isCommentThread(item)) {
            filteredList.push(item);
        }
    });
    return filteredList;
}

function cleanItems(items) {
    items.forEach((item) => {
        if (item.content?.encoded) {
            item.content.encoded = item.content.encoded.replace(
                /<a\s+href="https:\/\/www\.canonrumors\.com\/forum\/threads\/[a-zA-Z0-9./_-]+"\s+class="link\s+link--internal">Read\s+more<\/a><\/div>$/,
                '</div>'
            );
        }
    });
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
    const cached = await caching.get('crforum-cache');
    if (cached?.cachedTime) {
        cachedTime = new Date(cached.cachedTime);
    }
    if (cached?.cachedItems) {
        finalItems = cleanItems(filteredItemsList(cached.cachedItems));
    }

    // console.log(` 🤖 CACHED CONTENT FROM ${cachedTime} WAS READ. There was ${finalItems?.length} cached items.`);

    if (finalItems?.length && ((feedRequestTime.getTime() - cachedTime.getTime()) < (60 * 60 * 1000))) {
        console.log(' 🤖 WILL JUST USE the FORUM\'s recently updated CACHED ITEMS');
        return finalItems;
    }


    /** finalItems combines cachedItems and basisList: From the basisList, take the ones with higher
     * guid-values than the highest value found in cachedItems, and combine these with the cachedItems in a final
     * array of items sorted with descending guid-values.
     */


    const highestGuid = finalItems.length ? finalItems[0].guid.value : 0;
    console.log('highestGuid of finalItems(cached items): ', highestGuid);

    const sourceItems = await feeding.getParsedSourceItems('https://www.canonrumors.com/forum/forums/-/index.rss?order=post_date');

    let relevantSourceItems = [];
    if (sourceItems?.length) {
        sourceItems.sort((a, b) => {
            let va = Number(a.guid?.value);
            let vb = Number(b.guid?.value);
            return (isNaN(vb) ? 0 : vb) - (isNaN(va) ? 0 : va)
        });

        // console.log('\nsourceItems:\n', JSON.stringify(sourceItems));

        relevantSourceItems = cleanItems(filteredItemsList(sourceItems));
    }
    console.log('\nForum: Length of cached items\n', finalItems?.length);

    finalItems.unshift(...relevantSourceItems.filter(item => item.guid.value > highestGuid));
    // TODO (if finalItems grew in size, some new items was added)
    console.log('Forum: After "merge", the *final* finalItems.length: ', finalItems?.length);

    if (finalItems.length) {
        await caching.set('crforum-cache', {cachedTime: feedRequestTime, cachedItems: finalItems.slice(0, 12)});
        console.log(` 🤖 Cached FORUM content was ${relevantSourceItems?.length ? 'updated' : '"extended"'}`);
    }

    return finalItems;

}


/**
 * Returns a filtered feed of new Canon Rumors Forum threads, omitting the threads created to be
 * comment-thread for a news posting on the main site.
 * @param feedType {'json'|'rss'}
 * @param reqHeaders {Headers}
 * @param [info] {ServeHandlerInfo<Addr>}
 * @param [logging=false] {boolean} - if true, potentially extra logging for debugging
 * @returns {Promise<{body: string, options: {status: number, statusText: string, headers: Headers}}>}
 */
export async function canonRumorsForum(feedType, reqHeaders, info, logging = false) {

    const CreateFeedTool = feeding.getCreateFeedTool(
        feedType,
        'Canon Rumors Forum - New threads',
        'Keeping track of new threads in Canon Rumors Forum', // TODO more !!!!
        `https://feed-bender.deno.dev/canon/crforumfeed.${feedType}`,
        'https://www.canonrumors.com/forum/',
        'Canon Rumors Forum user',
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
