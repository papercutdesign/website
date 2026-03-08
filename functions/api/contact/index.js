// functions/api/contact/index.js

export async function onRequestGet(context) {
    const { request, env } = context;

    try {
        const password = request.headers.get('Authorization')?.replace('Bearer ', '');

        // 1. Authenticate (Only admins can view contacts)
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

        // 1. Basic validation
        if (!name || !email || !message) {
            return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const id = crypto.randomUUID();

        // 2. Save metadata to D1 Database
        const stmt = env.DB.prepare(
            "INSERT INTO contacts (id, name, email, message) VALUES (?, ?, ?, ?)"
        );
        await stmt.bind(id, name, email, message).run();

        // 3. Forward the email via Formsubmit Ajax so the user still receives email notifications
        // We do not wait for this to succeed before responding, it happens in the background
        const emailPayload = {
            name: name,
            email: email,
            message: message,
            _subject: `New Contact Lead: ${name}`
        };

        context.waitUntil(
            fetch("https://formsubmit.co/ajax/yossi@papercutdesign.co", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(emailPayload)
            }).catch(e => console.error("Error sending email via FormSubmit:", e))
        );

        return Response.json({
            success: true,
            message: "Message sent successfully!"
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
