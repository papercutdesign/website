// functions/_lib/auth.js
// Shared helpers for the admin API. This file exports no onRequest* handlers,
// so Cloudflare Pages does not turn it into a public route.

const enc = new TextEncoder();
const TOKEN_VERSION = 'v1';

export const SESSION_HOURS_DEFAULT = 12;
export const SESSION_HOURS_REMEMBER = 24 * 30;

/** JSON response with sane security headers. */
export function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...extraHeaders,
        },
    });
}

export function fail(error, status = 400) {
    return json({ success: false, error }, status);
}

function b64url(bytes) {
    let bin = '';
    for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
    const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function secretFor(env) {
    // SESSION_SECRET is optional. Without it, sessions are signed with a key
    // derived from ADMIN_PASSWORD, so changing the password signs everyone out.
    return `papercut-admin:${env.SESSION_SECRET || ''}:${env.ADMIN_PASSWORD || ''}`;
}

async function hmacKey(env) {
    return crypto.subtle.importKey(
        'raw', enc.encode(secretFor(env)),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
}

/** Constant-time password check (compares SHA-256 digests byte by byte). */
export async function passwordMatches(candidate, env) {
    if (!env.ADMIN_PASSWORD || typeof candidate !== 'string' || !candidate) return false;
    const [a, b] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(candidate)),
        crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_PASSWORD)),
    ]);
    const x = new Uint8Array(a), y = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

export async function createSession(env, hours = SESSION_HOURS_DEFAULT) {
    const exp = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
    const payload = `${TOKEN_VERSION}.${exp}`;
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload));
    return { token: `${payload}.${b64url(sig)}`, expiresAt: exp * 1000 };
}

async function verifySession(token, env) {
    if (!env.ADMIN_PASSWORD || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;
    const exp = Number(parts[1]);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    try {
        return await crypto.subtle.verify(
            'HMAC', await hmacKey(env), fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`)
        );
    } catch {
        return false;
    }
}

/**
 * Returns null when the request carries a valid admin session,
 * otherwise a 401 Response to return straight away.
 */
export async function requireAdmin(request, env) {
    if (!env.ADMIN_PASSWORD) {
        return fail('Admin password is not configured on the server (set ADMIN_PASSWORD in Cloudflare).', 503);
    }
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (await verifySession(token, env)) return null;
    return fail('Your session has expired. Please sign in again.', 401);
}
