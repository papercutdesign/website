// functions/api/portfolio/[id].js
// PATCH  (admin) -> edit title / alt text / category
// DELETE (admin) -> remove the item and its files

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { ensureSchema } from '../../_lib/schema.js';
import { CATEGORIES, cleanText, formatItem } from '../../_lib/files.js';

export async function onRequestPatch({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await ensureSchema(env);
        const item = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(params.id).first();
        if (!item) return fail('That item no longer exists.', 404);

        let body;
        try { body = await request.json(); } catch { return fail('Invalid request.'); }

        const alt_text = body.alt_text !== undefined ? cleanText(body.alt_text, 300) : item.alt_text;
        const title = body.title !== undefined ? cleanText(body.title, 150) : item.title;
        let category = item.category;
        let sort_order = item.sort_order;

        if (body.category !== undefined && body.category !== item.category) {
            if (!CATEGORIES.includes(body.category)) return fail('Please choose a valid category.');
            category = body.category;
            // Moving to another category puts it first there.
            const top = await env.DB.prepare(
                'SELECT MIN(sort_order) AS m FROM portfolio_items WHERE category = ?'
            ).bind(category).first();
            sort_order = Number.isFinite(top?.m) ? top.m - 1 : 0;
        }

        await env.DB.prepare(
            `UPDATE portfolio_items
             SET alt_text = ?, title = ?, category = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(alt_text, title, category, sort_order, item.id).run();

        const row = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(item.id).first();
        return json({ success: true, item: formatItem(row) });
    } catch (err) {
        return fail(`Could not save changes: ${err.message}`, 500);
    }
}

export async function onRequestDelete({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await ensureSchema(env);
        const item = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(params.id).first();
        if (!item) return fail('That item no longer exists.', 404);

        // Remove from the site first, then clean up storage.
        await env.DB.prepare('DELETE FROM portfolio_items WHERE id = ?').bind(item.id).run();
        await env.BUCKET.delete([item.r2_key, item.thumb_key, item.original_key].filter(Boolean));

        return json({ success: true, message: 'Deleted' });
    } catch (err) {
        return fail(`Could not delete: ${err.message}`, 500);
    }
}
