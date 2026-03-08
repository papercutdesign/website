CREATE TABLE IF NOT EXISTS portfolio_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
