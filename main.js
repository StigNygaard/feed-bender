import { serveDir } from 'jsr:@std/http/file-server';
import 'jsr:@std/dotenv/load';
import { canonRumors } from './canon/canon-rumors.js';

let responseHeaders = {
    'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ; img-src https: blob: data: ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
};
let responseHeadersArr = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`);

const crPathPattern = new URLPattern({ pathname: "/canon/crfeed.json" });
// const crPathPattern = new URLPattern({ pathname: "/canon/crfeed{/}?" });
// const mainStaticPathPattern = new URLPattern({ pathname: "{/*}?" });
// const mainStaticPathPattern = new URLPattern({ pathname: "/:file?" });

// we could set a port-number with Deno.serve({port: portno}, handler);
Deno.serve(handler);

// https://github.com/denoland/deploy_feedback/issues/705
console.log(`${new Date().toISOString()} - main.js running on Deno ${Deno.version.deno} (${navigator.userAgent.toLowerCase()})`);

async function handler(req, info) {
    const urlObj = new URL(req.url);
    const origin = urlObj.origin;
    const isLocalhost = urlObj.hostname === 'localhost';

    if (isLocalhost) { // Different Content-Security-Policy in header when localhost
        // console.log('Modify headers for localhost use...');
        responseHeaders = {
            'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ${origin} ; img-src https: blob: data: ${origin} ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Content-Type-Options': 'nosniff'
        };
        responseHeadersArr = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`);
    }

    // The "Router"...
    if (req.method === 'GET') {
        if (crPathPattern.test(urlObj)) {

            console.log(`*** FEED REQUEST BY: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await canonRumors(req.headers, info, isLocalhost);
            console.log('*** COMPLETE JSON FEED CREATED ***');
            return new Response(result.body, { headers: responseHeaders, ...result.options });

        } else {

            if (!/\.[a-zA-Z]{2,3}$/.test(req.url)) { // ignore files with 2-3 characters extension (a very quick filtering of log😉)
                console.log(`* ${remoteAddr(info).remoteIp} - ${req.url} - Referer: ${req.headers?.get('referer') ?? '(none)'}\n - User-Agent: ${req.headers?.get('user-agent')}`);
            }

            // Statically served...
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

        }
    } else {
        return new Response('Not found', {
            status: 404,
            statusText: `Method ${req.method} not supported here`,
            headers: responseHeaders
        });
    }
    // for other routing examples, see f.ex: https://youtu.be/p541Je4J_ws?si=-tWmB355467gtFIP
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
