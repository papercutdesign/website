// functions/api/auth/login.js
// POST { password, remember } -> { success, token, expiresAt }

import {
    json, fail, passwordMatches, createSession,
    SESSION_HOURS_DEFAULT, SESSION_HOURS_REMEMBER,
} from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
    if (!env.ADMIN_PASSWORD) {
        return fail('Admin password is not configured on the server (set ADMIN_PASSWORD in Cloudflare).', 503);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return fail('Invalid request.');
    }

    if (!(await passwordMatches(body?.password, env))) {
        // Small delay slows down password guessing.
        await new Promise(r => setTimeout(r, 600));
        return fail('That password is incorrect.', 401);
    }

    const hours = body?.remember ? SESSION_HOURS_REMEMBER : SESSION_HOURS_DEFAULT;
    const session = await createSession(env, hours);
    return json({ success: true, ...session });
}
