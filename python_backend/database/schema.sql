-- Luxury Watch Pricing Intelligence Engine - Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Brands Table
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watches/SKUs Table
CREATE TABLE watches (
    id SERIAL PRIMARY KEY,
    brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    reference_number VARCHAR(100) NOT NULL,
    model VARCHAR(200),
    case_material VARCHAR(100),
    dial_color VARCHAR(100),
    movement VARCHAR(100),
    case_diameter VARCHAR(50),
    water_resistance VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id, reference_number)
);

-- Sellers Table
CREATE TABLE sellers (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(50) NOT NULL, -- 'chrono24', 'ebay', etc.
    seller_id VARCHAR(200) NOT NULL,
    seller_name VARCHAR(200),
    trust_score DECIMAL(3,2),
    total_sales INTEGER DEFAULT 0,
    positive_feedback_percent DECIMAL(5,2),
    location_country VARCHAR(100),
    location_region VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(marketplace, seller_id)
);

-- Marketplace Listings Table
CREATE TABLE marketplace_listings (
    id SERIAL PRIMARY KEY,
    watch_id INTEGER REFERENCES watches(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    marketplace VARCHAR(50) NOT NULL,
    listing_url TEXT,
    title TEXT,
    price_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    price_usd DECIMAL(12,2), -- Normalized to USD
    condition VARCHAR(50), -- 'new', 'unworn', 'very-good', 'good', 'fair'
    year INTEGER,
    has_box BOOLEAN,
    has_papers BOOLEAN,
    warranty_months INTEGER,
    shipping_cost DECIMAL(10,2),
    shipping_currency VARCHAR(10),
    listing_date DATE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price History Table (Time-series data)
CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    watch_id INTEGER REFERENCES watches(id) ON DELETE CASCADE,
    marketplace_listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE SET NULL,
    marketplace VARCHAR(50) NOT NULL,
    price_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    price_usd DECIMAL(12,2),
    condition VARCHAR(50),
    seller_trust_score DECIMAL(3,2),
    location_country VARCHAR(100),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Partition price_history by month for better performance
-- (Can be implemented later with automated partition creation)

-- Parsed Messages Table (WhatsApp/Messaging data)
CREATE TABLE parsed_messages (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL, -- 'whatsapp', 'telegram', 'slack'
    message_id VARCHAR(200),
    sender VARCHAR(200),
    raw_message TEXT NOT NULL,
    parsed_data JSONB NOT NULL,
    watch_id INTEGER REFERENCES watches(id) ON DELETE SET NULL,
    reference_number VARCHAR(100),
    year INTEGER,
    condition VARCHAR(50),
    price_amount DECIMAL(12,2),
    currency VARCHAR(10),
    price_usd DECIMAL(12,2),
    confidence_score DECIMAL(3,2), -- Parsing confidence
    is_processed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price Alerts Table
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- Can add users table later
    watch_id INTEGER REFERENCES watches(id) ON DELETE CASCADE,
    reference_number VARCHAR(100),
    alert_type VARCHAR(50) NOT NULL, -- 'below_threshold', 'price_drop', 'opportunity'
    threshold_amount DECIMAL(12,2),
    threshold_currency VARCHAR(10),
    percentage_drop INTEGER, -- e.g., alert if price drops 10%
    condition_filter VARCHAR(50),
    marketplace_filter VARCHAR(50),
    notification_channels JSONB DEFAULT '["email"]', -- ['email', 'slack']
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert History Table
CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES price_alerts(id) ON DELETE CASCADE,
    marketplace_listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE SET NULL,
    trigger_type VARCHAR(50),
    price_amount DECIMAL(12,2),
    currency VARCHAR(10),
    message TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channels JSONB,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Rules Table
CREATE TABLE business_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'pricing', 'margin', 'filter', 'opportunity'
    rule_logic JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price Calculations Table (Cached pricing recommendations)
CREATE TABLE price_calculations (
    id SERIAL PRIMARY KEY,
    watch_id INTEGER REFERENCES watches(id) ON DELETE CASCADE,
    condition VARCHAR(50),
    floor_price_usd DECIMAL(12,2),
    avg_price_usd DECIMAL(12,2),
    ceiling_price_usd DECIMAL(12,2),
    recommended_list_price DECIMAL(12,2),
    recommended_margin_percent DECIMAL(5,2),
    buy_recommendation BOOLEAN,
    data_points_count INTEGER,
    confidence_score DECIMAL(3,2),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP
);

-- Scraping Jobs Table
CREATE TABLE scraping_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'chrono24', 'ebay'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    search_query VARCHAR(200),
    filters JSONB DEFAULT '{}',
    listings_found INTEGER DEFAULT 0,
    listings_new INTEGER DEFAULT 0,
    listings_updated INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_watches_brand_id ON watches(brand_id);
CREATE INDEX idx_watches_reference ON watches(reference_number);
CREATE INDEX idx_watches_brand_ref ON watches(brand_id, reference_number);

CREATE INDEX idx_marketplace_listings_watch_id ON marketplace_listings(watch_id);
CREATE INDEX idx_marketplace_listings_seller_id ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_listings_marketplace ON marketplace_listings(marketplace);
CREATE INDEX idx_marketplace_listings_price_usd ON marketplace_listings(price_usd);
CREATE INDEX idx_marketplace_listings_condition ON marketplace_listings(condition);
CREATE INDEX idx_marketplace_listings_is_active ON marketplace_listings(is_active);
CREATE INDEX idx_marketplace_listings_last_seen ON marketplace_listings(last_seen);

CREATE INDEX idx_price_history_watch_id ON price_history(watch_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_price_history_watch_time ON price_history(watch_id, recorded_at DESC);

CREATE INDEX idx_sellers_marketplace ON sellers(marketplace);
CREATE INDEX idx_sellers_trust_score ON sellers(trust_score);

CREATE INDEX idx_parsed_messages_reference ON parsed_messages(reference_number);
CREATE INDEX idx_parsed_messages_is_processed ON parsed_messages(is_processed);
CREATE INDEX idx_parsed_messages_created_at ON parsed_messages(created_at DESC);

CREATE INDEX idx_price_alerts_watch_id ON price_alerts(watch_id);
CREATE INDEX idx_price_alerts_is_active ON price_alerts(is_active);

CREATE INDEX idx_price_calculations_watch_id ON price_calculations(watch_id);
CREATE INDEX idx_price_calculations_valid_until ON price_calculations(valid_until);

-- Full-text search indexes
CREATE INDEX idx_watches_trgm ON watches USING gin(reference_number gin_trgm_ops);
CREATE INDEX idx_marketplace_listings_title_trgm ON marketplace_listings USING gin(title gin_trgm_ops);

-- Views for common queries

-- Current Floor Prices View
CREATE OR REPLACE VIEW v_current_floor_prices AS
SELECT
    w.id as watch_id,
    w.reference_number,
    b.name as brand_name,
    w.model,
    ml.condition,
    MIN(ml.price_usd) as floor_price_usd,
    COUNT(ml.id) as listing_count,
    AVG(s.trust_score) as avg_seller_trust
FROM watches w
JOIN brands b ON w.brand_id = b.id
JOIN marketplace_listings ml ON w.id = ml.watch_id
JOIN sellers s ON ml.seller_id = s.id
WHERE ml.is_active = TRUE
    AND ml.last_seen > NOW() - INTERVAL '7 days'
    AND s.trust_score > 0.7
GROUP BY w.id, w.reference_number, b.name, w.model, ml.condition;

-- Price Trend View (Last 30 days)
CREATE OR REPLACE VIEW v_price_trends_30d AS
SELECT
    w.id as watch_id,
    w.reference_number,
    b.name as brand_name,
    ph.condition,
    DATE(ph.recorded_at) as date,
    AVG(ph.price_usd) as avg_price_usd,
    MIN(ph.price_usd) as min_price_usd,
    MAX(ph.price_usd) as max_price_usd,
    COUNT(*) as sample_count
FROM watches w
JOIN brands b ON w.brand_id = b.id
JOIN price_history ph ON w.id = ph.watch_id
WHERE ph.recorded_at > NOW() - INTERVAL '30 days'
GROUP BY w.id, w.reference_number, b.name, ph.condition, DATE(ph.recorded_at);

-- Active Opportunities View
CREATE OR REPLACE VIEW v_active_opportunities AS
SELECT
    ml.id as listing_id,
    w.reference_number,
    b.name as brand_name,
    w.model,
    ml.price_usd,
    ml.condition,
    ml.marketplace,
    ml.listing_url,
    cfp.floor_price_usd,
    pc.avg_price_usd,
    ((pc.avg_price_usd - ml.price_usd) / pc.avg_price_usd * 100) as discount_percent,
    s.seller_name,
    s.trust_score,
    ml.last_seen
FROM marketplace_listings ml
JOIN watches w ON ml.watch_id = w.id
JOIN brands b ON w.brand_id = b.id
JOIN sellers s ON ml.seller_id = s.id
LEFT JOIN v_current_floor_prices cfp ON w.id = cfp.watch_id AND ml.condition = cfp.condition
LEFT JOIN price_calculations pc ON w.id = pc.watch_id AND ml.condition = pc.condition
WHERE ml.is_active = TRUE
    AND ml.last_seen > NOW() - INTERVAL '24 hours'
    AND s.trust_score > 0.7
    AND pc.avg_price_usd IS NOT NULL
    AND ((pc.avg_price_usd - ml.price_usd) / pc.avg_price_usd * 100) > 10
ORDER BY discount_percent DESC;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watches_updated_at BEFORE UPDATE ON watches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parsed_messages_updated_at BEFORE UPDATE ON parsed_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_alerts_updated_at BEFORE UPDATE ON price_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_rules_updated_at BEFORE UPDATE ON business_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
