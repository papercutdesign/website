// functions/robots/[[catchall]].js
// Serves a dynamic robots.txt that points to the dynamic sitemap.

export async function onRequestGet() {
    const SITE_URL = 'https://papercutdesign.co';

    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml

# Disallow admin
Disallow: /admin.html
`;

    return new Response(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        }
    });
}
