// functions/api/portfolio/[id]/display.js
// POST (admin), multipart: file + opts (JSON) + width + height
//   -> show an adjusted version (space around / shape / background) on the site.
//      The first time, the untouched upload is kept as the original, so every
//      later adjustment starts from it and nothing is ever lost.
// POST (admin), JSON { reset: true }
//   -> go back to the original file.

import { json, fail, requireAdmin } from '../../../_lib/auth.js';
import { ensureSchema } from '../../../_lib/schema.js';
import { MAX_IMAGE_BYTES, sniffType, extFor, formatItem, contentDisposition } from '../../../_lib/files.js';

const OUTPUT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function intOrNull(v) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

function cleanOpts(raw) {
    let o = {};
    try { o = JSON.parse(raw || '{}') || {}; } catch { o = {}; }
    const shapes = ['original', 'square', 'landscape', 'portrait'];
    const bg = typeof o.bg === 'string' && (o.bg === 'transparent' || /^#[0-9a-f]{6}$/i.test(o.bg)) ? o.bg : 'transparent';
    return {
        trim: !!o.trim,
        pad: Math.max(0, Math.min(100, Number(o.pad) || 0)),
        shape: shapes.includes(o.shape) ? o.shape : 'original',
        bg,
    };
}

export async function onRequestPost({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    let newKey = null;
    try {
        await ensureSchema(env);
        const item = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(params.id).first();
        if (!item) return fail('That item no longer exists.', 404);

        const type = request.headers.get('Content-Type') || '';

        // ---- Reset to the original upload ----
        if (type.includes('application/json')) {
            let body;
            try { body = await request.json(); } catch { return fail('Invalid request.'); }
            if (!body?.reset) return fail('Invalid request.');
            if (!item.original_key) {
                return json({ success: true, item: formatItem(item) });
            }
            let meta = {};
            try { meta = JSON.parse(item.original_meta || '{}') || {}; } catch { }
            await env.DB.prepare(
                `UPDATE portfolio_items
                 SET r2_key = ?, original_key = NULL, original_meta = NULL, display_opts = NULL,
                     mime_type = ?, file_size = ?, width = ?, height = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
            ).bind(item.original_key, meta.mime ?? null, meta.size ?? null, meta.width ?? null, meta.height ?? null, item.id).run();
            if (item.r2_key !== item.original_key) await env.BUCKET.delete(item.r2_key);
            const row = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(item.id).first();
            return json({ success: true, item: formatItem(row) });
        }

        // ---- Apply an adjusted version ----
        let form;
        try { form = await request.formData(); } catch { return fail('The image could not be read. Please try again.'); }
        const file = form.get('file');
        if (!file || typeof file === 'string' || !file.size) return fail('Missing image.');

        const buffer = await file.arrayBuffer();
        const mime = sniffType(buffer);
        if (!OUTPUT_TYPES.includes(mime)) return fail('The adjusted image must be PNG, JPG or WebP.', 415);
        if (buffer.byteLength > MAX_IMAGE_BYTES) return fail('The adjusted image is too large.', 413);

        const opts = cleanOpts(form.get('opts'));
        const stamp = Date.now().toString(36);
        newKey = `${item.category}-${item.id}-look-${stamp}.${extFor(mime)}`;
        const baseName = (item.original_name || 'papercut').replace(/\.[^.]+$/, '');

        await env.BUCKET.put(newKey, buffer, {
            httpMetadata: { contentType: mime, contentDisposition: contentDisposition(`${baseName}.${extFor(mime)}`) },
        });

        const originalKey = item.original_key || item.r2_key;
        const originalMeta = item.original_key
            ? item.original_meta
            : JSON.stringify({ mime: item.mime_type, size: item.file_size, width: item.width, height: item.height });

        await env.DB.prepare(
            `UPDATE portfolio_items
             SET r2_key = ?, original_key = ?, original_meta = ?, display_opts = ?,
                 mime_type = ?, file_size = ?, width = ?, height = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(
            newKey, originalKey, originalMeta, JSON.stringify(opts),
            mime, buffer.byteLength, intOrNull(form.get('width')), intOrNull(form.get('height')), item.id
        ).run();

        // Remove the previous adjusted version (never the original).
        if (item.r2_key !== originalKey) await env.BUCKET.delete(item.r2_key);

        const row = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(item.id).first();
        return json({ success: true, item: formatItem(row) });
    } catch (err) {
        if (newKey) await env.BUCKET.delete(newKey).catch(() => { });
        return fail(`Could not save the new look: ${err.message}`, 500);
    }
}
