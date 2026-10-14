-- Reference schema. The API also upgrades older databases automatically
-- (see functions/_lib/schema.js), so running this by hand is optional.

CREATE TABLE IF NOT EXISTS portfolio_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,          -- 'ad' or 'logo'
    r2_key TEXT NOT NULL,            -- file name in the R2 bucket
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT,
    mime_type TEXT,                  -- image/jpeg, application/pdf, ...
    file_size INTEGER,
    original_name TEXT,
    thumb_key TEXT,                  -- cover image for PDFs
    width INTEGER,
    height INTEGER,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    referrer TEXT,
    country TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
