// functions/api/contact/index.js
// GET  (admin)  -> all leads, newest first
// POST (public) -> save a contact-form submission

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { toIsoUtc } from '../../_lib/schema.js';

export async function onRequestGet({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        const { results } = await env.DB.prepare(
            'SELECT * FROM contacts ORDER BY created_at DESC'
        ).all();
        const items = (results || []).map(r => ({ ...r, created_at: toIsoUtc(r.created_at) }));
        return json({ success: true, items });
    } catch (err) {
        return fail(`Could not load leads: ${err.message}`, 500);
    }
}

export async function onRequestPost({ request, env }) {
    try {
        let body;
        try { body = await request.json(); } catch { return fail('Invalid request.'); }

        const name = String(body?.name ?? '').trim().slice(0, 200);
        const email = String(body?.email ?? '').trim().slice(0, 320);
        const message = String(body?.message ?? '').trim().slice(0, 10000);

        if (!name || !email || !message) return fail('Missing required fields');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');

        const id = crypto.randomUUID();
        await env.DB.prepare(
            'INSERT INTO contacts (id, name, email, message) VALUES (?, ?, ?, ?)'
        ).bind(id, name, email, message).run();

        // The email notification is sent from the browser via FormSubmit;
        // this endpoint only stores the lead.
        return json({ success: true, message: 'Message saved successfully!' });
    } catch (err) {
        return fail('Could not save your message. Please try again.', 500);
    }
}
