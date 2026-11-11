// functions/api/contact/index.js
// GET  (admin)  -> all leads, newest first
// POST (public) -> save a contact-form or branding-application submission.
//                  Takes JSON { name, email, message }, or multipart form data
//                  with the same fields plus optional files under "files".

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { toIsoUtc, ensureContactsSchema } from '../../_lib/schema.js';
import { cleanText } from '../../_lib/files.js';
import { checkLeadFiles, leadFileKey, parseLeadFiles } from '../../_lib/leadfiles.js';

export async function onRequestGet({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        await ensureContactsSchema(env);
        const { results } = await env.DB.prepare(
            'SELECT * FROM contacts ORDER BY created_at DESC'
        ).all();
        const items = (results || []).map(r => ({
            ...r,
            created_at: toIsoUtc(r.created_at),
            // Only names and sizes go to the browser; files open via /api/contact/<id>/files/<n>
            files: parseLeadFiles(r.files).map(({ name, size, type }) => ({ name, size, type })),
        }));
        return json({ success: true, items });
    } catch (err) {
        return fail(`Could not load leads: ${err.message}`, 500);
    }
}

async function readSubmission(request) {
    const type = request.headers.get('Content-Type') || '';
    if (type.includes('multipart/form-data')) {
        const form = await request.formData();
        const files = form.getAll('files').filter(f => f && typeof f === 'object' && f.size > 0);
        return { name: form.get('name'), email: form.get('email'), message: form.get('message'), files };
    }
    const body = await request.json();
    return { name: body?.name, email: body?.email, message: body?.message, files: [] };
}

export async function onRequestPost({ request, env }) {
    const stored = [];
    try {
        let input;
        try { input = await readSubmission(request); } catch { return fail('Invalid request.'); }

        const name = String(input.name ?? '').trim().slice(0, 200);
        const email = String(input.email ?? '').trim().slice(0, 320);
        const message = String(input.message ?? '').trim().slice(0, 10000);

        if (!name || !email || !message) return fail('Missing required fields');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');

        const problem = checkLeadFiles(input.files);
        if (problem) return fail(problem);

        await ensureContactsSchema(env);
        const id = crypto.randomUUID();

        const files = [];
        for (const [i, file] of input.files.entries()) {
            const key = leadFileKey(id, i);
            const fileName = cleanText(file.name || '', 150) || `file-${i + 1}`;
            await env.BUCKET.put(key, file.stream(), {
                httpMetadata: { contentType: file.type || 'application/octet-stream' },
                customMetadata: { name: fileName },
            });
            stored.push(key);
            files.push({ key, name: fileName, size: file.size, type: file.type || '' });
        }

        await env.DB.prepare(
            'INSERT INTO contacts (id, name, email, message, files) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, name, email, message, files.length ? JSON.stringify(files) : null).run();

        // The email notification is sent from the browser via FormSubmit;
        // this endpoint stores the lead and any files.
        return json({ success: true, message: 'Message saved successfully!' });
    } catch (err) {
        // Don't leave orphaned files behind when saving the lead failed.
        if (stored.length) { try { await env.BUCKET.delete(stored); } catch { } }
        return fail('Could not save your message. Please try again.', 500);
    }
}
