// functions/api/portfolio/[id].js

export async function onRequestDelete(context) {
    const { request, env, params } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 1. Authenticate
        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        const id = params.id;
        if (!id) {
            return Response.json({ success: false, error: "Missing item ID" }, { status: 400 });
        }

        // 2. Fetch the item to get its R2 key
        const item = await env.DB.prepare("SELECT * FROM portfolio_items WHERE id = ?").bind(id).first();

        if (!item) {
            return Response.json({ success: false, error: "Item not found" }, { status: 404 });
        }

        // 3. Delete from R2 Bucket
        await env.BUCKET.delete(item.r2_key);

        // 4. Delete from D1 Database
        await env.DB.prepare("DELETE FROM portfolio_items WHERE id = ?").bind(id).run();

        return Response.json({ success: true, message: "Deleted successfully" });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
