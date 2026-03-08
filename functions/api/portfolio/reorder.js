// functions/api/portfolio/reorder.js

export async function onRequestPut(context) {
    const { request, env } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 1. Authenticate
        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        const body = await request.json(); // Expected format: { updates: [{ id: '123', sort_order: 1 }, { id: '456', sort_order: 2 }] }

        if (!body.updates || !Array.isArray(body.updates)) {
            return Response.json({ success: false, error: "Invalid payload format" }, { status: 400 });
        }

        // Prepare batch statements
        const stmts = body.updates.map(item => {
            return env.DB.prepare("UPDATE portfolio_items SET sort_order = ? WHERE id = ?").bind(item.sort_order, item.id);
        });

        // Run as a single transaction batch inside Cloudflare D1
        await env.DB.batch(stmts);

        return Response.json({ success: true, message: "Gallery reordered successfully" });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
