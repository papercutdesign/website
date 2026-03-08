// functions/assets/[key].js

export async function onRequestGet(context) {
    const { env, params } = context;
    const key = params.key;

    try {
        const object = await env.BUCKET.get(key);

        if (!object) {
            return new Response('Not found', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        // Cache the image in the browser and Cloudflare edge for 1 year to save bandwidth
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(object.body, { headers });
    } catch (err) {
        return new Response('Error viewing asset', { status: 500 });
    }
}
