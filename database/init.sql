-- NYC Violation Compliance System - Database Schema
-- PostgreSQL 15+

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Establishments
CREATE TABLE establishments (
    camis VARCHAR(20) PRIMARY KEY,
    dba VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    building VARCHAR(50),
    street VARCHAR(255),
    boro VARCHAR(50),
    zipcode VARCHAR(10),
    phone VARCHAR(20),  -- Encrypted
    email VARCHAR(255),  -- Encrypted
    cuisine VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    full_address TEXT,
    has_contact_info BOOLEAN DEFAULT FALSE,
    address_quality_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for establishments
CREATE INDEX idx_establishments_boro ON establishments(boro);
CREATE INDEX idx_establishments_zipcode ON establishments(zipcode);
CREATE INDEX idx_establishments_cuisine ON establishments(cuisine);
CREATE INDEX idx_establishments_contact ON establishments(has_contact_info);
CREATE INDEX idx_establishments_dba_trgm ON establishments USING gin (dba gin_trgm_ops);

-- Inspections
CREATE TABLE inspections (
    id SERIAL PRIMARY KEY,
    camis VARCHAR(20) REFERENCES establishments(camis) ON DELETE CASCADE,
    inspection_date DATE NOT NULL,
    action VARCHAR(255),
    violation_code VARCHAR(10),
    violation_description TEXT,
    critical_flag VARCHAR(20),
    score INTEGER,
    grade VARCHAR(2),
    grade_date DATE,
    record_date DATE,
    inspection_type VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_inspection_establishment FOREIGN KEY (camis) REFERENCES establishments(camis)
);

-- Indexes for inspections
CREATE INDEX idx_inspections_camis ON inspections(camis);
CREATE INDEX idx_inspections_date ON inspections(inspection_date DESC);
CREATE INDEX idx_inspections_critical ON inspections(critical_flag);
CREATE INDEX idx_inspections_score ON inspections(score);
CREATE INDEX idx_inspections_violation_code ON inspections(violation_code);
CREATE INDEX idx_inspections_composite ON inspections(camis, inspection_date, violation_code);

-- Violation Codes Reference
CREATE TABLE violation_codes (
    code VARCHAR(10) PRIMARY KEY,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    score_impact INTEGER,
    defense_strategy TEXT,
    evidence_required TEXT[]
);

-- Hearings
CREATE TABLE hearings (
    id SERIAL PRIMARY KEY,
    hearing_id VARCHAR(50) UNIQUE,
    camis VARCHAR(20) REFERENCES establishments(camis) ON DELETE CASCADE,
    hearing_date DATE,
    hearing_time TIME,
    hearing_status VARCHAR(50) DEFAULT 'pending',
    violation_details TEXT,
    respondent_name VARCHAR(255),
    hearing_result VARCHAR(100),
    penalty_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for hearings
CREATE INDEX idx_hearings_camis ON hearings(camis);
CREATE INDEX idx_hearings_date ON hearings(hearing_date);
CREATE INDEX idx_hearings_status ON hearings(hearing_status);

-- Fines
CREATE TABLE fines (
    id SERIAL PRIMARY KEY,
    fine_id VARCHAR(50) UNIQUE,
    camis VARCHAR(20) REFERENCES establishments(camis) ON DELETE CASCADE,
    fine_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (fine_amount - amount_paid) STORED,
    issue_date DATE,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'outstanding',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fines
CREATE INDEX idx_fines_camis ON fines(camis);
CREATE INDEX idx_fines_status ON fines(status);
CREATE INDEX idx_fines_balance ON fines(balance) WHERE balance > 0;

-- ============================================================================
-- LEAD MANAGEMENT TABLES
-- ============================================================================

-- Leads
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    lead_uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    camis VARCHAR(20) REFERENCES establishments(camis) ON DELETE CASCADE,
    risk_score DECIMAL(6, 2),
    risk_level VARCHAR(20),
    urgency VARCHAR(20),
    priority INTEGER CHECK (priority BETWEEN 1 AND 10),
    estimated_value DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'prospecting',
    segment VARCHAR(50),
    assigned_to VARCHAR(100),
    contact_attempts INTEGER DEFAULT 0,
    last_contact_date TIMESTAMP,
    next_action_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for leads
CREATE INDEX idx_leads_camis ON leads(camis);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_priority ON leads(priority DESC);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_next_action ON leads(next_action_date);
CREATE INDEX idx_leads_risk_score ON leads(risk_score DESC);
CREATE INDEX idx_leads_segment ON leads(segment);

-- Contact History
CREATE TABLE contact_history (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    contact_date TIMESTAMP DEFAULT NOW(),
    contact_method VARCHAR(50),
    outcome VARCHAR(100),
    notes TEXT,
    next_follow_up TIMESTAMP,
    contacted_by VARCHAR(100)
);

-- Indexes for contact history
CREATE INDEX idx_contact_history_lead ON contact_history(lead_id);
CREATE INDEX idx_contact_history_date ON contact_history(contact_date DESC);

-- ============================================================================
-- ANALYTICS & REPORTING
-- ============================================================================

-- Materialized View for Lead Generation
CREATE MATERIALIZED VIEW lead_candidates AS
SELECT
    e.camis,
    e.dba,
    e.phone,
    e.email,
    e.boro,
    e.cuisine,
    e.full_address,
    COUNT(DISTINCT i.id) as inspection_count_12mo,
    COUNT(DISTINCT i.id) FILTER (WHERE i.critical_flag = 'Critical') as critical_count,
    MAX(i.inspection_date) as last_inspection,
    AVG(i.score) as avg_score,
    COUNT(DISTINCT CASE WHEN i.inspection_date >= CURRENT_DATE - INTERVAL '180 days' THEN i.id END) as recent_inspection_count,
    COUNT(DISTINCT h.id) FILTER (WHERE h.hearing_status = 'pending') as open_hearing_count,
    COALESCE(SUM(f.balance), 0) as outstanding_fines,
    -- Risk indicators
    CASE
        WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.critical_flag = 'Critical') >= 3 THEN 'HIGH'
        WHEN COUNT(DISTINCT i.id) FILTER (WHERE i.critical_flag = 'Critical') >= 1 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_indicator
FROM establishments e
LEFT JOIN inspections i ON e.camis = i.camis
    AND i.inspection_date > CURRENT_DATE - INTERVAL '12 months'
LEFT JOIN hearings h ON e.camis = h.camis
    AND h.hearing_status = 'pending'
LEFT JOIN fines f ON e.camis = f.camis
    AND f.status = 'outstanding'
GROUP BY e.camis, e.dba, e.phone, e.email, e.boro, e.cuisine, e.full_address
HAVING COUNT(DISTINCT i.id) > 0
ORDER BY critical_count DESC, outstanding_fines DESC;

-- Index on materialized view
CREATE UNIQUE INDEX idx_lead_candidates_camis ON lead_candidates(camis);
CREATE INDEX idx_lead_candidates_risk ON lead_candidates(risk_indicator);
CREATE INDEX idx_lead_candidates_boro ON lead_candidates(boro);

-- Function to refresh lead candidates
CREATE OR REPLACE FUNCTION refresh_lead_candidates()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY lead_candidates;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    record_id VARCHAR(50),
    action VARCHAR(20),
    user_id VARCHAR(100),
    user_role VARCHAR(50),
    changed_fields JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Index for audit log
CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_establishments_updated_at BEFORE UPDATE ON establishments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hearings_updated_at BEFORE UPDATE ON hearings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fines_updated_at BEFORE UPDATE ON fines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample violation codes
INSERT INTO violation_codes (code, description, severity, category, score_impact) VALUES
('04L', 'Facility not vermin proof', 'CRITICAL', 'Vermin', 5),
('06D', 'Food contact surface not properly maintained', 'MAJOR', 'Food Safety', 5),
('10B', 'Toilet facility not maintained', 'MODERATE', 'Facility', 3),
('02A', 'Food not protected from potential contamination', 'CRITICAL', 'Food Safety', 7),
('08A', 'Facility not vermin proof', 'MAJOR', 'Vermin', 5)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- High Priority Leads View
CREATE VIEW high_priority_leads AS
SELECT
    l.id,
    l.lead_uuid,
    l.camis,
    e.dba,
    e.phone,
    e.email,
    l.risk_score,
    l.priority,
    l.estimated_value,
    l.status,
    l.assigned_to,
    l.next_action_date
FROM leads l
JOIN establishments e ON l.camis = e.camis
WHERE l.priority >= 7
  AND l.status NOT IN ('converted', 'lost')
ORDER BY l.priority DESC, l.risk_score DESC;

-- Compliance Summary View
CREATE VIEW compliance_summary AS
SELECT
    e.camis,
    e.dba,
    e.boro,
    COUNT(DISTINCT i.id) as total_inspections,
    COUNT(DISTINCT i.id) FILTER (WHERE i.critical_flag = 'Critical') as critical_violations,
    COUNT(DISTINCT h.id) FILTER (WHERE h.hearing_status = 'pending') as open_hearings,
    COALESCE(SUM(f.balance), 0) as outstanding_fines,
    MAX(i.inspection_date) as last_inspection_date
FROM establishments e
LEFT JOIN inspections i ON e.camis = i.camis
LEFT JOIN hearings h ON e.camis = h.camis
LEFT JOIN fines f ON e.camis = f.camis
GROUP BY e.camis, e.dba, e.boro;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get establishment risk score
CREATE OR REPLACE FUNCTION get_establishment_risk_score(establishment_camis VARCHAR(20))
RETURNS DECIMAL AS $$
DECLARE
    risk_score DECIMAL;
BEGIN
    SELECT
        COALESCE(
            (COUNT(DISTINCT i.id) FILTER (WHERE i.critical_flag = 'Critical') * 150) +
            (COUNT(DISTINCT h.id) FILTER (WHERE h.hearing_status = 'pending') * 80) +
            (COALESCE(SUM(f.balance), 0) / 10000 * 60),
            0
        ) INTO risk_score
    FROM establishments e
    LEFT JOIN inspections i ON e.camis = i.camis
        AND i.inspection_date > CURRENT_DATE - INTERVAL '180 days'
    LEFT JOIN hearings h ON e.camis = h.camis
    LEFT JOIN fines f ON e.camis = f.camis
    WHERE e.camis = establishment_camis
    GROUP BY e.camis;

    RETURN COALESCE(risk_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (Configure based on your needs)
-- ============================================================================

-- Example grants (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
