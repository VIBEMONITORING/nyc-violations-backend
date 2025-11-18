const pool = require('../config/database');

const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create opportunities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        source VARCHAR(100) NOT NULL,
        source_url TEXT,
        project_value DECIMAL(15, 2),
        monitoring_duration INTEGER, -- in months
        location VARCHAR(255),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        distance_miles DECIMAL(10, 2),
        technical_requirements TEXT[],
        posting_date DATE,
        deadline_date DATE,
        client_name VARCHAR(255),
        contact_info JSONB,
        status VARCHAR(50) DEFAULT 'new',
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create opportunity_scores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS opportunity_scores (
        id SERIAL PRIMARY KEY,
        opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
        total_score DECIMAL(3, 1) CHECK (total_score >= 1 AND total_score <= 10),
        profit_margin_score DECIMAL(3, 1),
        resource_availability_score DECIMAL(3, 1),
        competition_score DECIMAL(3, 1),
        client_relationship_score DECIMAL(3, 1),
        scoring_notes TEXT,
        recommended_action VARCHAR(50),
        estimated_revenue DECIMAL(15, 2),
        required_resources JSONB,
        scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(opportunity_id)
      )
    `);

    // Create weekly_reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id SERIAL PRIMARY KEY,
        report_date DATE NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        total_opportunities INTEGER,
        top_opportunities JSONB,
        summary TEXT,
        total_estimated_revenue DECIMAL(15, 2),
        sent_at TIMESTAMP,
        recipients TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create scraping_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scraping_logs (
        id SERIAL PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        status VARCHAR(50),
        opportunities_found INTEGER DEFAULT 0,
        errors TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
      CREATE INDEX IF NOT EXISTS idx_opportunities_posting_date ON opportunities(posting_date);
      CREATE INDEX IF NOT EXISTS idx_opportunities_project_value ON opportunities(project_value);
      CREATE INDEX IF NOT EXISTS idx_opportunity_scores_total_score ON opportunity_scores(total_score DESC);
      CREATE INDEX IF NOT EXISTS idx_weekly_reports_report_date ON weekly_reports(report_date);
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the setup
createTables()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
