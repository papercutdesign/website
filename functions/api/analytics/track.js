// functions/api/analytics/track.js
// Lightweight pixel-style tracker. Called from the frontend on every page load.

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const page = body.page || '/';
        const referrer = body.referrer || '';

        // Get country from Cloudflare's request object (free, no API needed)
        const country = request.cf?.country || 'unknown';

        await env.DB.prepare(
            "INSERT INTO page_views (page, referrer, country) VALUES (?, ?, ?)"
        ).bind(page, referrer, country).run();

        return Response.json({ success: true });

    } catch (err) {
        // Tracking should never break the user experience, so fail silently
        return Response.json({ success: false }, { status: 200 });
    }
}
