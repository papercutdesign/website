// functions/_lib/files.js
// Detects real file types from their bytes (not from the file name the browser sends).

import { toIsoUtc } from './schema.js';

export const CATEGORIES = ['ad', 'logo'];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;  // 25 MB
export const MAX_PDF_BYTES = 50 * 1024 * 1024;    // 50 MB
export const MAX_THUMB_BYTES = 3 * 1024 * 1024;   // 3 MB

const EXT_BY_MIME = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
};

const MIME_BY_EXT = Object.fromEntries(
    Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m])
);
MIME_BY_EXT.jpeg = 'image/jpeg';

export function extFor(mime) {
    return EXT_BY_MIME[mime];
}

/** For rows uploaded before mime_type was stored. */
export function mimeFromKey(key = '') {
    const ext = key.split('.').pop().toLowerCase();
    return MIME_BY_EXT[ext] || 'image/jpeg';
}

function startsWith(bytes, sig, offset = 0) {
    return sig.every((b, i) => bytes[offset + i] === b);
}

/** Returns the detected MIME type, or null if the file isn't an allowed type. */
export function sniffType(buffer) {
    const b = new Uint8Array(buffer.slice(0, 1024));
    if (startsWith(b, [0xFF, 0xD8, 0xFF])) return 'image/jpeg';
    if (startsWith(b, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'image/png';
    if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
    if (startsWith(b, [0x66, 0x74, 0x79, 0x70], 4)) {
        const brand = String.fromCharCode(...b.slice(8, 12));
        if (brand === 'avif' || brand === 'avis') return 'image/avif';
    }
    // PDFs may have a few junk bytes before the header.
    const head = new TextDecoder('latin1').decode(b);
    if (head.includes('%PDF-')) return 'application/pdf';
    const text = head.replace(/^﻿/, '').trimStart().toLowerCase();
    if ((text.startsWith('<?xml') || text.startsWith('<svg') || text.startsWith('<!--')) && head.toLowerCase().includes('<svg')) {
        return 'image/svg+xml';
    }
    return null;
}

export function isPdf(mime) {
    return mime === 'application/pdf';
}

export function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Safe filename for Content-Disposition. */
export function safeFilename(name, fallback) {
    const cleaned = cleanText(name || '', 150).replace(/["\\/]/g, '').trim();
    return cleaned || fallback;
}

/** Content-Disposition that survives non-English file names. */
export function contentDisposition(name) {
    const ascii = name.replace(/[^\x20-\x7E]/g, '_');
    return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function parseJson(v) {
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
}

/** Shape a portfolio_items row for API responses. */
export function formatItem(row) {
    const mime = row.mime_type || mimeFromKey(row.r2_key);
    return {
        ...row,
        mime_type: mime,
        kind: isPdf(mime) ? 'pdf' : 'image',
        url: `/assets/${row.r2_key}`,
        thumb_url: row.thumb_key ? `/assets/${row.thumb_key}` : null,
        original_url: row.original_key ? `/assets/${row.original_key}` : null,
        display_opts: parseJson(row.display_opts),
        original_meta: parseJson(row.original_meta),
        created_at: toIsoUtc(row.created_at),
        updated_at: toIsoUtc(row.updated_at),
    };
}
