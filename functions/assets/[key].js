// functions/assets/[key].js
// Serves uploaded portfolio files from R2, with caching, range requests (for PDFs)
// and headers that stop uploaded files from running scripts on this domain.

function rangeHeader(object) {
    const r = object.range;
    if (!r) return null;
    let start, end;
    if (r.suffix !== undefined) {
        start = object.size - r.suffix;
        end = object.size - 1;
    } else {
        start = r.offset ?? 0;
        end = r.length !== undefined ? start + r.length - 1 : object.size - 1;
    }
    return `bytes ${start}-${end}/${object.size}`;
}

async function serve({ request, env, params }, headOnly) {
    const key = params.key;
    if (!key || key.includes('/') || key.length > 200) return new Response('Not found', { status: 404 });

    try {
        const object = headOnly
            ? await env.BUCKET.head(key)
            : await env.BUCKET.get(key, { range: request.headers, onlyIf: request.headers });

        if (!object) return new Response('Not found', { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('ETag', object.httpEtag);
        headers.set('Accept-Ranges', 'bytes');
        // Keys are unique per upload, so files never change once stored.
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('X-Content-Type-Options', 'nosniff');
        // Browsers refuse to show PDFs in a sandbox, so only lock down non-PDF files
        // (this is what keeps a script hidden inside an SVG from running).
        if (!(headers.get('Content-Type') || '').includes('pdf')) {
            headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
        }

        if (headOnly) {
            headers.set('Content-Length', String(object.size));
            return new Response(null, { headers });
        }

        // onlyIf failed (e.g. If-None-Match matched) -> no body
        if (!('body' in object) || !object.body) {
            return new Response(null, { status: 304, headers });
        }

        const contentRange = request.headers.has('Range') ? rangeHeader(object) : null;
        if (contentRange) {
            headers.set('Content-Range', contentRange);
            return new Response(object.body, { status: 206, headers });
        }
        return new Response(object.body, { headers });
    } catch {
        return new Response('Error loading file', { status: 500 });
    }
}

export const onRequestGet = ctx => serve(ctx, false);
export const onRequestHead = ctx => serve(ctx, true);
