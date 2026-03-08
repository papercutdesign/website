// functions/api/portfolio/index.js

export async function onRequestGet(context) {
    const { env } = context;

    try {
        const { results } = await env.DB.prepare(
            "SELECT * FROM portfolio_items ORDER BY created_at DESC"
        ).all();

        return Response.json({ success: true, items: results });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const category = formData.get('category'); // 'ad' or 'logo'
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 1. Authenticate
        if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Unauthorized: Incorrect Password" }, { status: 401 });
        }

        if (!file || !category) {
            return Response.json({ success: false, error: "Missing file or category" }, { status: 400 });
        }

        // 2. Generate unique ID for database and R2 key
        const id = crypto.randomUUID();
        const ext = file.name.split('.').pop();
        const r2_key = `${category}-${id}.${ext}`;

        // 3. Upload to R2 Bucket
        await env.BUCKET.put(r2_key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type }
        });

        // 4. Save metadata to D1 Database
        const stmt = env.DB.prepare(
            "INSERT INTO portfolio_items (id, category, r2_key) VALUES (?, ?, ?)"
        );
        await stmt.bind(id, category, r2_key).run();

        return Response.json({
            success: true,
            message: "Uploaded successfully",
            item: { id, category, r2_key }
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
