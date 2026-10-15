// functions/api/portfolio/delete.js
// POST (admin) { ids: [...] } -> delete several items at once

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { ensureSchema } from '../../_lib/schema.js';

export async function onRequestPost({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await ensureSchema(env);
        let body;
        try { body = await request.json(); } catch { return fail('Invalid request.'); }

        const ids = Array.isArray(body?.ids)
            ? [...new Set(body.ids.filter(id => typeof id === 'string' && id.length <= 64))].slice(0, 200)
            : [];
        if (!ids.length) return fail('Nothing selected.');

        const placeholders = ids.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
            `SELECT id, r2_key, thumb_key, original_key FROM portfolio_items WHERE id IN (${placeholders})`
        ).bind(...ids).all();

        if (!results?.length) return json({ success: true, deleted: 0 });

        await env.DB.prepare(
            `DELETE FROM portfolio_items WHERE id IN (${results.map(() => '?').join(',')})`
        ).bind(...results.map(r => r.id)).run();

        const keys = results.flatMap(r => [r.r2_key, r.thumb_key, r.original_key]).filter(Boolean);
        // R2 accepts up to 1000 keys per delete call.
        for (let i = 0; i < keys.length; i += 1000) {
            await env.BUCKET.delete(keys.slice(i, i + 1000));
        }

        return json({ success: true, deleted: results.length });
    } catch (err) {
        return fail(`Could not delete: ${err.message}`, 500);
    }
}
