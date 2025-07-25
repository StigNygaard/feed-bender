import { serveDir } from 'jsr:@std/http/file-server';
import 'jsr:@std/dotenv/load';
import { canonRumors } from './canon/canon-rumors.js';

let myHeaders = {
    'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ; img-src https: blob: data: ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
};
let myHeadersArr = Object.entries(myHeaders).map(([k, v]) => `${k}: ${v}`);

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
        myHeaders = {
            'Content-Security-Policy': `default-src 'none' ; script-src 'self' ; connect-src https: ${origin} ; img-src https: blob: data: ${origin} ; style-src 'self' ; frame-ancestors 'none' ; form-action 'self' ; base-uri 'none'`,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'X-Content-Type-Options': 'nosniff'
        };
        myHeadersArr = Object.entries(myHeaders).map(([k, v]) => `${k}: ${v}`);
    }

    // The "Router"...
    if (req.method === 'GET') {
        if (crPathPattern.test(urlObj)) {

            console.log(`*** FEED REQUEST BY: ${req.headers?.get('User-Agent') ?? ''}`);
            const result = await canonRumors(req.headers, info, isLocalhost);
            console.log('*** COMPLETE JSON FEED CREATED ***');
            return new Response(result.body, { headers: myHeaders, ...result.options });

        } else {

            // Statically served...
            return await serveDir(req, {
                urlRoot: '',
                fsRoot: 'static',
                showDirListing: false,
                showDotfiles: false,
                showIndex: true, // index.html
                enableCors: false, // CORS not allowed/enabled (no CORS headers)
                quiet: true, // logging of errors
                headers: myHeadersArr
            });

        }
    } else {
        return new Response('Not found', {
            status: 404,
            statusText: `Method ${req.method} not supported here`,
            headers: myHeaders
        });
    }
    // for other routing examples, see f.ex: https://youtu.be/p541Je4J_ws?si=-tWmB355467gtFIP
}
