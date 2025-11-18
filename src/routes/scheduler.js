const express = require('express');
const router = express.Router();
const logger = require('../config/logger');

/**
 * GET /api/scheduler/status
 * Get scheduler status
 */
router.get('/status', (req, res) => {
  try {
    const scheduler = req.app.get('scheduler');
    const status = scheduler.getStatus();

    res.json({
      success: true,
      jobs: status
    });
  } catch (error) {
    logger.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

/**
 * POST /api/scheduler/trigger/scan
 * Manually trigger opportunity scan
 */
router.post('/trigger/scan', async (req, res) => {
  try {
    const scheduler = req.app.get('scheduler');

    // Run async
    scheduler.triggerDailyScan()
      .then(result => {
        logger.info('Manual scan completed:', result);
      })
      .catch(error => {
        logger.error('Manual scan failed:', error);
      });

    res.json({
      success: true,
      message: 'Opportunity scan triggered. This may take several minutes.'
    });
  } catch (error) {
    logger.error('Error triggering scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scan'
    });
  }
});

/**
 * POST /api/scheduler/trigger/report
 * Manually trigger weekly report
 */
router.post('/trigger/report', async (req, res) => {
  try {
    const scheduler = req.app.get('scheduler');

    const result = await scheduler.triggerWeeklyReport();

    res.json({
      success: true,
      message: 'Weekly report generated successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error triggering report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger report'
    });
  }
});

/**
 * POST /api/scheduler/trigger/alerts
 * Manually trigger high-priority alerts
 */
router.post('/trigger/alerts', async (req, res) => {
  try {
    const scheduler = req.app.get('scheduler');

    const result = await scheduler.triggerHighPriorityAlerts();

    res.json({
      success: true,
      message: 'High-priority alerts sent',
      data: result
    });
  } catch (error) {
    logger.error('Error triggering alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger alerts'
    });
  }
});

module.exports = router;
