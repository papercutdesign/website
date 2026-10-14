// functions/api/auth/session.js
// GET -> 200 if the bearer token is still valid, 401 otherwise.

import { json, requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;
    return json({ success: true });
}
