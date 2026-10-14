// functions/api/contact/[id].js
// PUT    (admin) { status } -> update lead status
// DELETE (admin)            -> remove lead

import { json, fail, requireAdmin } from '../../_lib/auth.js';

const STATUSES = ['new', 'replied', 'signed'];

export async function onRequestPut({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        let body;
        try { body = await request.json(); } catch { return fail('Invalid request.'); }
        if (!STATUSES.includes(body?.status)) return fail('Invalid status.');

        const res = await env.DB.prepare('UPDATE contacts SET status = ? WHERE id = ?')
            .bind(body.status, params.id).run();
        if (!res.meta?.changes) return fail('That lead no longer exists.', 404);

        return json({ success: true, message: 'Lead updated' });
    } catch (err) {
        return fail(`Could not update the lead: ${err.message}`, 500);
    }
}

export async function onRequestDelete({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(params.id).run();
        return json({ success: true, message: 'Lead deleted' });
    } catch (err) {
        return fail(`Could not delete the lead: ${err.message}`, 500);
    }
}
