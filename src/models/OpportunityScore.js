const pool = require('../config/database');

class OpportunityScore {
  static async create(scoreData) {
    const {
      opportunity_id,
      total_score,
      profit_margin_score,
      resource_availability_score,
      competition_score,
      client_relationship_score,
      scoring_notes,
      recommended_action,
      estimated_revenue,
      required_resources
    } = scoreData;

    const query = `
      INSERT INTO opportunity_scores (
        opportunity_id, total_score, profit_margin_score,
        resource_availability_score, competition_score,
        client_relationship_score, scoring_notes, recommended_action,
        estimated_revenue, required_resources
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (opportunity_id)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        profit_margin_score = EXCLUDED.profit_margin_score,
        resource_availability_score = EXCLUDED.resource_availability_score,
        competition_score = EXCLUDED.competition_score,
        client_relationship_score = EXCLUDED.client_relationship_score,
        scoring_notes = EXCLUDED.scoring_notes,
        recommended_action = EXCLUDED.recommended_action,
        estimated_revenue = EXCLUDED.estimated_revenue,
        required_resources = EXCLUDED.required_resources,
        scored_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      opportunity_id,
      total_score,
      profit_margin_score,
      resource_availability_score,
      competition_score,
      client_relationship_score,
      scoring_notes,
      recommended_action,
      estimated_revenue,
      required_resources
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByOpportunityId(opportunityId) {
    const query = 'SELECT * FROM opportunity_scores WHERE opportunity_id = $1';
    const result = await pool.query(query, [opportunityId]);
    return result.rows[0];
  }

  static async getTopScored(limit = 10) {
    const query = `
      SELECT os.*, o.title, o.source, o.project_value, o.location, o.deadline_date
      FROM opportunity_scores os
      JOIN opportunities o ON os.opportunity_id = o.id
      WHERE o.status = 'new'
      ORDER BY os.total_score DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
}

module.exports = OpportunityScore;
