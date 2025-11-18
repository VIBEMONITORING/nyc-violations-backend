const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/dashboard
 * Get dashboard overview data
 */
router.get('/', async (req, res) => {
  try {
    // Get overall statistics
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE o.status = 'new') as new_count,
        COUNT(*) FILTER (WHERE o.status = 'reviewing') as reviewing_count,
        COUNT(*) FILTER (WHERE o.status = 'bidding') as bidding_count,
        COUNT(*) FILTER (WHERE o.status = 'won') as won_count,
        COUNT(*) FILTER (WHERE o.status = 'lost') as lost_count,
        AVG(os.total_score) as avg_score,
        SUM(o.project_value) FILTER (WHERE o.status = 'new') as total_pipeline_value,
        SUM(os.estimated_revenue) FILTER (WHERE o.status = 'new') as total_estimated_revenue
      FROM opportunities o
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get recent opportunities
    const recentQuery = `
      SELECT o.*, os.total_score, os.recommended_action
      FROM opportunities o
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
      ORDER BY o.created_at DESC
      LIMIT 5
    `;

    const recentResult = await pool.query(recentQuery);
    const recentOpportunities = recentResult.rows;

    // Get top scored opportunities
    const topScoredQuery = `
      SELECT o.*, os.total_score, os.recommended_action, os.estimated_revenue
      FROM opportunities o
      JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE o.status = 'new'
      ORDER BY os.total_score DESC
      LIMIT 5
    `;

    const topScoredResult = await pool.query(topScoredQuery);
    const topScoredOpportunities = topScoredResult.rows;

    // Get opportunities by source
    const sourceBreakdownQuery = `
      SELECT
        source,
        COUNT(*) as count,
        AVG(os.total_score) as avg_score
      FROM opportunities o
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY source
      ORDER BY count DESC
    `;

    const sourceBreakdownResult = await pool.query(sourceBreakdownQuery);
    const sourceBreakdown = sourceBreakdownResult.rows;

    // Get opportunities by score range
    const scoreDistributionQuery = `
      SELECT
        CASE
          WHEN total_score >= 8 THEN 'High (8-10)'
          WHEN total_score >= 6 THEN 'Medium (6-7.9)'
          WHEN total_score >= 4 THEN 'Low (4-5.9)'
          ELSE 'Very Low (<4)'
        END as score_range,
        COUNT(*) as count
      FROM opportunity_scores
      GROUP BY score_range
      ORDER BY MIN(total_score) DESC
    `;

    const scoreDistributionResult = await pool.query(scoreDistributionQuery);
    const scoreDistribution = scoreDistributionResult.rows;

    // Get recent scraping activity
    const scrapingActivityQuery = `
      SELECT *
      FROM scraping_logs
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const scrapingActivityResult = await pool.query(scrapingActivityQuery);
    const scrapingActivity = scrapingActivityResult.rows;

    res.json({
      success: true,
      data: {
        stats: {
          new_count: parseInt(stats.new_count) || 0,
          reviewing_count: parseInt(stats.reviewing_count) || 0,
          bidding_count: parseInt(stats.bidding_count) || 0,
          won_count: parseInt(stats.won_count) || 0,
          lost_count: parseInt(stats.lost_count) || 0,
          avg_score: parseFloat(stats.avg_score) || 0,
          total_pipeline_value: parseFloat(stats.total_pipeline_value) || 0,
          total_estimated_revenue: parseFloat(stats.total_estimated_revenue) || 0
        },
        recentOpportunities,
        topScoredOpportunities,
        sourceBreakdown,
        scoreDistribution,
        scrapingActivity
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/dashboard/charts/timeline
 * Get opportunity timeline data for charts
 */
router.get('/charts/timeline', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        AVG(project_value) as avg_value
      FROM opportunities
      WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching timeline data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline data'
    });
  }
});

/**
 * GET /api/dashboard/charts/revenue
 * Get revenue potential chart data
 */
router.get('/charts/revenue', async (req, res) => {
  try {
    const query = `
      SELECT
        o.source,
        SUM(os.estimated_revenue) as total_estimated_revenue,
        COUNT(*) as opportunity_count
      FROM opportunities o
      JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE o.status IN ('new', 'reviewing', 'bidding')
      GROUP BY o.source
      ORDER BY total_estimated_revenue DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching revenue data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue data'
    });
  }
});

module.exports = router;
