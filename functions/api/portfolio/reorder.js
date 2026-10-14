// functions/api/portfolio/reorder.js
// PUT (admin) { ids: [...] } -> full display order, first = shown first.
// (Also accepts the older { updates: [{ id, sort_order }] } format.)

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { ensureSchema } from '../../_lib/schema.js';

export async function onRequestPut({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await ensureSchema(env);
        let body;
        try { body = await request.json(); } catch { return fail('Invalid request.'); }

        let updates = [];
        if (Array.isArray(body?.ids)) {
            updates = body.ids.map((id, i) => ({ id, sort_order: i }));
        } else if (Array.isArray(body?.updates)) {
            updates = body.updates;
        }

        updates = updates.filter(u =>
            typeof u?.id === 'string' && u.id.length <= 64 && Number.isInteger(u.sort_order)
        );
        if (!updates.length) return fail('Nothing to reorder.');
        if (updates.length > 1000) return fail('Too many items.');

        await env.DB.batch(updates.map(u =>
            env.DB.prepare('UPDATE portfolio_items SET sort_order = ? WHERE id = ?').bind(u.sort_order, u.id)
        ));

        return json({ success: true, message: 'Order saved' });
    } catch (err) {
        return fail(`Could not save the order: ${err.message}`, 500);
    }
}
