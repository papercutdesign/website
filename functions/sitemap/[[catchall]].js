// functions/sitemap/[[catchall]].js
// Generates a dynamic XML sitemap that includes all portfolio images from the D1 database.
// Accessible at /sitemap.xml (routed via Cloudflare Pages Functions)

export async function onRequestGet(context) {
    const { env } = context;
    const SITE_URL = 'https://papercutdesign.co';

    try {
        // Fetch all portfolio items for image sitemap entries
        const { results } = await env.DB.prepare(
            "SELECT r2_key, category, created_at FROM portfolio_items ORDER BY sort_order ASC, created_at DESC"
        ).all();

        const today = new Date().toISOString().split('T')[0];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Main Pages -->
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>`;

        // Embed all portfolio images inside the homepage URL entry
        if (results && results.length > 0) {
            results.forEach(item => {
                xml += `
    <image:image>
      <image:loc>${SITE_URL}/assets/${item.r2_key}</image:loc>
      <image:caption>Papercut Design - ${item.category === 'ad' ? 'Advertisement Design' : 'Logo Design'}</image:caption>
    </image:image>`;
            });
        }

        xml += `
  </url>

  <url>
    <loc>${SITE_URL}/payment.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>${SITE_URL}/privacy-policy.html</loc>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

  <url>
    <loc>${SITE_URL}/branding-application.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

</urlset>`;

        return new Response(xml, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            }
        });

    } catch (err) {
        return new Response(`<!-- Sitemap Error: ${err.message} -->`, {
            status: 500,
            headers: { 'Content-Type': 'application/xml' }
        });
    }
}
