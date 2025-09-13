import { serveDir } from 'jsr:@std/http/file-server';
import 'jsr:@std/dotenv/load';
import { canonRumors } from './canon/canon-rumors.js';
import { canonRumorsForum } from './canon/canon-rumors-forum.js';
import { ymCinema } from './canon/ymcinema.js';
import { cineD } from "./canon/cined.js";
import { isWorld } from './canon/image-sensor-world.js';
import { p2pSensor } from './canon/p2psensor.js';
import { shortDateTime } from './static/datetime.js';

let responseHeaders = {
    'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ; img-src https: blob: data: ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
};
let responseHeadersArr = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`);

// const crPathPattern = new URLPattern({ pathname: "/canon/crfeed.json" });
// const crPathPattern = new URLPattern({ pathname: "/canon/crfeed{/}?" });
// const mainStaticPathPattern = new URLPattern({ pathname: "{/*}?" });
// const mainStaticPathPattern = new URLPattern({ pathname: "/:file?" });
const crPathPattern = new URLPattern({ pathname: "/canon/crfeed.:type(json|rss)" });
const crforumPathPattern = new URLPattern({ pathname: "/canon/crforumfeed.:type(json|rss)" });
const ymcPathPattern = new URLPattern({ pathname: "/canon/ymcfeed.:type(json|rss)" });
const cinedPathPattern = new URLPattern({ pathname: "/canon/cinedfeed.:type(json|rss)" });
const iswPathPattern = new URLPattern({ pathname: "/canon/iswfeed.:type(json|rss)" });
const p2psensorPathPattern = new URLPattern({ pathname: "/canon/p2psensorfeed.:type(json|rss)" });

// we could set a port-number with Deno.serve({port: portno}, handler);
Deno.serve(handler);

const now = new Date();
// https://github.com/denoland/deploy_feedback/issues/705
console.log(` >>>  ${shortDateTime(now, 'shortOffset')} - main.js running on Deno ${Deno.version.deno} (${navigator.userAgent.toLowerCase()})`);


async function handler(req, info) {
    const urlObj = new URL(req.url);
    const origin = urlObj.origin;
    const isLocalhost = urlObj.hostname === 'localhost';

    if (isLocalhost) { // Different Content-Security-Policy in header when localhost
        responseHeaders = {
            'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ${origin} ; img-src https: blob: data: ${origin} ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Content-Type-Options': 'nosniff'
        };
        responseHeadersArr = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`);
    }

    function remoteAddr(info) {
        if ('hostname' in info.remoteAddr) {
            return {
                remoteIp: info.remoteAddr.hostname,
                remotePort: info.remoteAddr.port
            };
        }
        return {};
    }

    function skipLog(req) {
        return /\.[a-zA-Z]{2,3}$/.test(req.url) // skip logging files with 2-3 characters extension (a very quick filtering of log😉)
            || ( // and got tired of this stupid client constant visting...
                req.url === 'https://feed-bender.deno.dev:443/'
                && req.headers?.get('referer') === 'http://feed-bender.deno.dev'
                && req.headers?.get('user-agent') === 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
            );
    }


    /* *** The "Router"... *** */

    if (req.method === 'GET') {

        /* Feed: Canon Rumors - Essential posts only */
        let feedType = crPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (crPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for CRNEWS by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await canonRumors(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for CRNEWS`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Feed: Canon Rumors Forum - New threads (topics) */
        feedType = crforumPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (crforumPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for CRFORUM by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await canonRumorsForum(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for CRFORUM`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Feed: Y.M. Cinema - Canon related only */
        feedType = ymcPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (ymcPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for YMCINEMA by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await ymCinema(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for YMCINEMA`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Feed: CineD - Canon related only */
        feedType = cinedPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (cinedPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for CINED by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await cineD(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for CINED`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Feed: Image Sensor World - Canon related only */
        feedType = iswPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (iswPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for ISWORLD by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await isWorld(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for ISWORLD`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Feed: Photons to Photos (Sensor updates) - Canon related only */
        feedType = p2psensorPathPattern.exec(urlObj)?.pathname?.groups?.type;
        if (feedType) { // if (p2psensorPathPattern.test(urlObj)) ...
            console.log(` 🤖 ${feedType.toUpperCase()} feed request for P2PSENSOR by: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await p2pSensor(feedType, req.headers, info, isLocalhost);
            console.log(` 🤖 Complete ${feedType.toUpperCase()} feed created for P2PSENSOR`);
            return new Response(result.body, { headers: responseHeaders, ...result.options });
        }

        /* Static content */
        if (!skipLog(req)) {
            console.log(` 👀 ${remoteAddr(info).remoteIp} - ${req.url} - Referer: ${req.headers?.get('referer') ?? '(none)'}\n - User-Agent: ${req.headers?.get('user-agent')}`);
        }
        return await serveDir(req, {
            urlRoot: '',
            fsRoot: 'static',
            showDirListing: false,
            showDotfiles: false,
            showIndex: true, // index.html
            enableCors: false, // CORS not allowed/enabled (no CORS headers)
            quiet: true, // logging of errors
            headers: responseHeadersArr
        });

    } else {

        /* Unexpected request */
        return new Response('Not found', {
            status: 404,
            statusText: `Not found or method '${req.method}' not supported here`,
            headers: responseHeaders
        });

    }
}
