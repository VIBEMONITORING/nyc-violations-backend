const express = require('express');
const router = express.Router();
const OpportunityService = require('../services/OpportunityService');
const Opportunity = require('../models/Opportunity');
const OpportunityScore = require('../models/OpportunityScore');
const logger = require('../config/logger');

const opportunityService = new OpportunityService();

/**
 * GET /api/opportunities
 * Get all opportunities with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, minValue, source, limit, minScore } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (minValue) filters.minValue = parseFloat(minValue);
    if (source) filters.source = source;
    if (limit) filters.limit = parseInt(limit);
    if (minScore) filters.minScore = parseFloat(minScore);

    const opportunities = minScore
      ? await Opportunity.getWithScores(filters)
      : await Opportunity.findAll(filters);

    res.json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    logger.error('Error fetching opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunities'
    });
  }
});

/**
 * GET /api/opportunities/top
 * Get top-scored opportunities
 */
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const opportunities = await opportunityService.getTopOpportunities(limit);

    res.json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    logger.error('Error fetching top opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top opportunities'
    });
  }
});

/**
 * GET /api/opportunities/:id
 * Get opportunity by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found'
      });
    }

    // Get score if exists
    const score = await OpportunityScore.findByOpportunityId(id);

    res.json({
      success: true,
      data: {
        ...opportunity,
        score
      }
    });
  } catch (error) {
    logger.error('Error fetching opportunity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunity'
    });
  }
});

/**
 * PUT /api/opportunities/:id/status
 * Update opportunity status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'reviewing', 'bidding', 'won', 'lost', 'passed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await opportunityService.updateOpportunityStatus(id, status);

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating opportunity status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update opportunity status'
    });
  }
});

/**
 * POST /api/opportunities/scan
 * Trigger opportunity scanning pipeline
 */
router.post('/scan', async (req, res) => {
  try {
    logger.info('Manual scan triggered via API');

    // Run pipeline asynchronously
    opportunityService.runPipeline()
      .then(result => {
        logger.info('Manual scan completed:', result);
      })
      .catch(error => {
        logger.error('Manual scan failed:', error);
      });

    res.json({
      success: true,
      message: 'Opportunity scanning started. This may take several minutes.'
    });
  } catch (error) {
    logger.error('Error starting scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start opportunity scan'
    });
  }
});

/**
 * GET /api/opportunities/stats/summary
 * Get opportunity statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const pool = require('../config/database');

    const statsQuery = `
      SELECT
        COUNT(*) as total_opportunities,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_opportunities,
        COUNT(CASE WHEN status = 'bidding' THEN 1 END) as bidding_opportunities,
        AVG(project_value) as avg_project_value,
        SUM(project_value) as total_project_value,
        AVG(os.total_score) as avg_score
      FROM opportunities o
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        total_opportunities: parseInt(stats.total_opportunities),
        new_opportunities: parseInt(stats.new_opportunities),
        bidding_opportunities: parseInt(stats.bidding_opportunities),
        avg_project_value: parseFloat(stats.avg_project_value) || 0,
        total_project_value: parseFloat(stats.total_project_value) || 0,
        avg_score: parseFloat(stats.avg_score) || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
