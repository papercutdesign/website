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

        // 1. Save to D1 Database
        await env.DB.prepare(
            "INSERT INTO contacts (id, name, email, message) VALUES (?, ?, ?, ?)"
        ).bind(id, name, email, message).run();

        // 2. Forward the email via FormSubmit (awaited so we can report errors)
        try {
            const emailRes = await fetch("https://formsubmit.co/ajax/yossi@papercutdesign.co", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    message: message,
                    _subject: `New Lead from papercutdesign.co: ${name}`,
                    _template: 'table'
                })
            });

            const emailData = await emailRes.json();

            if (!emailRes.ok || emailData.success === "false") {
                console.error("FormSubmit error:", JSON.stringify(emailData));
            }
        } catch (emailErr) {
            // Email failure should not break the form submission
            console.error("Email forwarding failed:", emailErr.message);
        }

        return Response.json({
            success: true,
            message: "Message sent successfully!"
        });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
