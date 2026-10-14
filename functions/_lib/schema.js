// functions/_lib/schema.js
// Upgrades the D1 tables in place the first time the new code runs,
// so no manual SQL is needed after deploying. Safe to call on every request.

// Every column that isn't in the very first version of the table. alt_text is
// here because the live database was created before alt_text existed.
const PORTFOLIO_COLUMNS = {
    alt_text: 'TEXT',
    title: 'TEXT',
    mime_type: 'TEXT',
    file_size: 'INTEGER',
    original_name: 'TEXT',
    thumb_key: 'TEXT',
    width: 'INTEGER',
    height: 'INTEGER',
    updated_at: 'TIMESTAMP',
};

let ready = null;

async function migrate(env) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS portfolio_items (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        alt_text TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`).run();

    const { results } = await env.DB.prepare('PRAGMA table_info(portfolio_items)').all();
    const existing = new Set((results || []).map(c => c.name));
    const missing = Object.entries(PORTFOLIO_COLUMNS).filter(([name]) => !existing.has(name));

    if (missing.length) {
        await env.DB.batch(missing.map(([name, type]) =>
            env.DB.prepare(`ALTER TABLE portfolio_items ADD COLUMN ${name} ${type}`)
        ));
    }
}

export function ensureSchema(env) {
    if (!ready) {
        ready = migrate(env).catch(err => {
            ready = null; // retry on the next request
            throw err;
        });
    }
    return ready;
}

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker; make it unambiguous ISO. */
export function toIsoUtc(value) {
    if (!value || typeof value !== 'string') return value;
    if (/[zZ]|[+-]\d\d:?\d\d$/.test(value)) return value;
    return value.replace(' ', 'T') + 'Z';
}
