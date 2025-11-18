const pool = require('../config/database');

class Opportunity {
  static async create(opportunityData) {
    const {
      title,
      description,
      source,
      source_url,
      project_value,
      monitoring_duration,
      location,
      latitude,
      longitude,
      distance_miles,
      technical_requirements,
      posting_date,
      deadline_date,
      client_name,
      contact_info,
      raw_data
    } = opportunityData;

    const query = `
      INSERT INTO opportunities (
        title, description, source, source_url, project_value,
        monitoring_duration, location, latitude, longitude, distance_miles,
        technical_requirements, posting_date, deadline_date, client_name,
        contact_info, raw_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      title,
      description,
      source,
      source_url,
      project_value,
      monitoring_duration,
      location,
      latitude,
      longitude,
      distance_miles,
      technical_requirements,
      posting_date,
      deadline_date,
      client_name,
      contact_info,
      raw_data
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM opportunities WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM opportunities WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters.minValue) {
      query += ` AND project_value >= $${paramCount}`;
      values.push(filters.minValue);
      paramCount++;
    }

    if (filters.source) {
      query += ` AND source = $${paramCount}`;
      values.push(filters.source);
      paramCount++;
    }

    query += ' ORDER BY posting_date DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    const result = await pool.query(query, values);
    return result.rows;
  }

  static async update(id, updates) {
    const { status } = updates;
    const query = `
      UPDATE opportunities
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, id]);
    return result.rows[0];
  }

  static async getWithScores(filters = {}) {
    let query = `
      SELECT o.*, os.total_score, os.recommended_action, os.estimated_revenue
      FROM opportunities o
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (filters.minScore) {
      query += ` AND os.total_score >= $${paramCount}`;
      values.push(filters.minScore);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND o.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    query += ' ORDER BY os.total_score DESC NULLS LAST, o.posting_date DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    const result = await pool.query(query, values);
    return result.rows;
  }
}

module.exports = Opportunity;
