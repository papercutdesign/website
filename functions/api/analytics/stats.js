// functions/api/analytics/stats.js
// Returns aggregated analytics data for the admin dashboard.

import { json, fail, requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;

    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {

        // --- Total Views ---
        const totalResult = await env.DB.prepare("SELECT COUNT(*) as total FROM page_views").first();

        // --- Views Today ---
        const todayResult = await env.DB.prepare(
            "SELECT COUNT(*) as total FROM page_views WHERE date(created_at) = date('now')"
        ).first();

        // --- Views per day (last 14 days) ---
        const dailyResult = await env.DB.prepare(
            `SELECT date(created_at) as day, COUNT(*) as views 
             FROM page_views 
             WHERE created_at >= datetime('now', '-14 days')
             GROUP BY date(created_at) 
             ORDER BY day ASC`
        ).all();

        // --- Top pages ---
        const pagesResult = await env.DB.prepare(
            `SELECT page, COUNT(*) as views 
             FROM page_views 
             GROUP BY page 
             ORDER BY views DESC 
             LIMIT 10`
        ).all();

        // --- Top referrers ---
        const referrersResult = await env.DB.prepare(
            `SELECT referrer, COUNT(*) as views 
             FROM page_views 
             WHERE referrer != '' 
             GROUP BY referrer 
             ORDER BY views DESC 
             LIMIT 10`
        ).all();

        // --- Top countries ---
        const countriesResult = await env.DB.prepare(
            `SELECT country, COUNT(*) as views 
             FROM page_views 
             WHERE country != 'unknown'
             GROUP BY country 
             ORDER BY views DESC 
             LIMIT 10`
        ).all();

        // --- Total leads ---
        const leadsTotal = await env.DB.prepare("SELECT COUNT(*) as total FROM contacts").first();
        const leadsNew = await env.DB.prepare("SELECT COUNT(*) as total FROM contacts WHERE status = 'new'").first();

        return json({
            success: true,
            stats: {
                totalViews: totalResult?.total || 0,
                todayViews: todayResult?.total || 0,
                totalLeads: leadsTotal?.total || 0,
                newLeads: leadsNew?.total || 0,
                dailyViews: dailyResult?.results || [],
                topPages: pagesResult?.results || [],
                topReferrers: referrersResult?.results || [],
                topCountries: countriesResult?.results || [],
            }
        });

    } catch (err) {
        return fail(`Could not load analytics: ${err.message}`, 500);
    }
}
