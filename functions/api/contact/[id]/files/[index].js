// functions/api/contact/[id]/files/[index].js
// GET (admin) -> download one file attached to a lead.

import { fail, requireAdmin } from '../../../../_lib/auth.js';
import { contentDisposition, safeFilename } from '../../../../_lib/files.js';
import { parseLeadFiles } from '../../../../_lib/leadfiles.js';

export async function onRequestGet({ request, env, params }) {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;

    try {
        const row = await env.DB.prepare('SELECT files FROM contacts WHERE id = ?').bind(params.id).first();
        const file = parseLeadFiles(row?.files)[Number(params.index)];
        if (!file?.key) return fail('That file no longer exists.', 404);

        const object = await env.BUCKET.get(file.key);
        if (!object) return fail('That file no longer exists.', 404);

        const name = safeFilename(file.name, `file-${Number(params.index) + 1}`);
        return new Response(object.body, {
            headers: {
                'Content-Type': 'application/octet-stream',
                // Always download, never open on this domain.
                'Content-Disposition': contentDisposition(name).replace(/^inline/, 'attachment'),
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (err) {
        return fail(`Could not load the file: ${err.message}`, 500);
    }
}
