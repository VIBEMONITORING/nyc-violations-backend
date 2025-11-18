const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/reports/weekly
 * Get weekly reports
 */
router.get('/weekly', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const query = `
      SELECT *
      FROM weekly_reports
      ORDER BY report_date DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [parseInt(limit)]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching weekly reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly reports'
    });
  }
});

/**
 * GET /api/reports/weekly/latest
 * Get the latest weekly report
 */
router.get('/weekly/latest', async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM weekly_reports
      ORDER BY report_date DESC
      LIMIT 1
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No reports found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching latest report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest report'
    });
  }
});

/**
 * GET /api/reports/logs
 * Get scraping logs
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const query = `
      SELECT *
      FROM scraping_logs
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [parseInt(limit)]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching scraping logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scraping logs'
    });
  }
});

module.exports = router;
