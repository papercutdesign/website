// functions/api/contact/index.js

export async function onRequestGet(context) {
    const { request, env } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        const { results } = await env.DB.prepare(
            "SELECT * FROM contacts ORDER BY created_at DESC"
        ).all();

        return Response.json({ success: true, items: results });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { name, email, message } = body;

        if (!name || !email || !message) {
            return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const id = crypto.randomUUID();

        await env.DB.prepare(
            "INSERT INTO contacts (id, name, email, message) VALUES (?, ?, ?, ?)"
        ).bind(id, name, email, message).run();

        // Email is now sent directly from the browser via FormSubmit
        // This endpoint only handles database storage

        return Response.json({
            success: true,
            message: "Message saved successfully!"
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
