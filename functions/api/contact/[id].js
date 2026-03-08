// functions/api/contact/[id].js

export async function onRequestPut(context) {
    const { request, env, params } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        const id = params.id;
        const body = await request.json();
        const newStatus = body.status;

        if (!id || !newStatus) {
            return Response.json({ success: false, error: "Missing ID or status" }, { status: 400 });
        }

        await env.DB.prepare("UPDATE contacts SET status = ? WHERE id = ?").bind(newStatus, id).run();

        return Response.json({ success: true, message: "Contact updated successfully" });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    const { request, env, params } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        const id = params.id;
        if (!id) {
            return Response.json({ success: false, error: "Missing item ID" }, { status: 400 });
        }

        await env.DB.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();

        return Response.json({ success: true, message: "Contact deleted successfully" });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
