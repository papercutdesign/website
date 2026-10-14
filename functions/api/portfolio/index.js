// functions/api/portfolio/index.js
// GET  (public)  -> list of portfolio items for the website and the admin console
// POST (admin)   -> upload one image or PDF (multipart form)

import { json, fail, requireAdmin } from '../../_lib/auth.js';
import { ensureSchema } from '../../_lib/schema.js';
import {
    CATEGORIES, MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_THUMB_BYTES,
    sniffType, extFor, isPdf, cleanText, safeFilename, formatItem, contentDisposition,
} from '../../_lib/files.js';

export async function onRequestGet({ env }) {
    try {
        await ensureSchema(env);
        const { results } = await env.DB.prepare(
            'SELECT * FROM portfolio_items ORDER BY sort_order ASC, created_at DESC'
        ).all();
        return json(
            { success: true, items: (results || []).map(formatItem) },
            200,
            // Short shared cache keeps the homepage fast; the admin bypasses it.
            { 'Cache-Control': 'public, max-age=30' }
        );
    } catch (err) {
        return fail(`Could not load the portfolio: ${err.message}`, 500);
    }
}

function intOrNull(v) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

export async function onRequestPost({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    let uploadedKeys = [];
    try {
        await ensureSchema(env);

        let form;
        try {
            form = await request.formData();
        } catch {
            return fail('The upload could not be read. Please try again.');
        }

        const file = form.get('file');
        const category = form.get('category');
        const alt_text = cleanText(form.get('alt_text'), 300);
        const title = cleanText(form.get('title'), 150);

        if (!file || typeof file === 'string' || !file.size) return fail('Please choose a file to upload.');
        if (!CATEGORIES.includes(category)) return fail('Please choose a valid category.');

        const buffer = await file.arrayBuffer();
        const mime = sniffType(buffer);
        if (!mime) {
            return fail(`"${file.name}" isn't a supported file. Use JPG, PNG, WebP, GIF, AVIF, SVG or PDF.`, 415);
        }
        const limit = isPdf(mime) ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
        if (buffer.byteLength > limit) {
            return fail(`"${file.name}" is too large (max ${Math.round(limit / 1048576)} MB).`, 413);
        }

        const id = crypto.randomUUID();
        const r2_key = `${category}-${id}.${extFor(mime)}`;
        const original_name = safeFilename(file.name, `papercut-${id}.${extFor(mime)}`);

        await env.BUCKET.put(r2_key, buffer, {
            httpMetadata: {
                contentType: mime,
                contentDisposition: contentDisposition(original_name),
            },
            customMetadata: { originalName: original_name },
        });
        uploadedKeys.push(r2_key);

        // Optional cover image (the admin console renders page 1 of PDFs in the browser).
        let thumb_key = null;
        const thumb = form.get('thumbnail');
        if (thumb && typeof thumb !== 'string' && thumb.size && thumb.size <= MAX_THUMB_BYTES) {
            const thumbBuf = await thumb.arrayBuffer();
            const thumbMime = sniffType(thumbBuf);
            if (thumbMime && thumbMime.startsWith('image/') && thumbMime !== 'image/svg+xml') {
                thumb_key = `thumb-${id}.${extFor(thumbMime)}`;
                await env.BUCKET.put(thumb_key, thumbBuf, { httpMetadata: { contentType: thumbMime } });
                uploadedKeys.push(thumb_key);
            }
        }

        // New uploads appear first in their category.
        const top = await env.DB.prepare(
            'SELECT MIN(sort_order) AS m FROM portfolio_items WHERE category = ?'
        ).bind(category).first();
        const sort_order = Number.isFinite(top?.m) ? top.m - 1 : 0;

        await env.DB.prepare(
            `INSERT INTO portfolio_items
                (id, category, r2_key, alt_text, title, mime_type, file_size, original_name, thumb_key, width, height, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id, category, r2_key, alt_text, title, mime, buffer.byteLength, original_name,
            thumb_key, intOrNull(form.get('width')), intOrNull(form.get('height')), sort_order
        ).run();

        const row = await env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(id).first();
        return json({ success: true, message: 'Uploaded', item: formatItem(row) }, 201);
    } catch (err) {
        // Don't leave orphaned files in storage if the database step failed.
        await Promise.allSettled(uploadedKeys.map(k => env.BUCKET.delete(k)));
        return fail(`Upload failed: ${err.message}`, 500);
    }
}
