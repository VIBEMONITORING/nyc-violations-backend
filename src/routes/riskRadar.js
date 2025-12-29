/**
 * Construction Risk Radar API Routes
 */

const express = require('express');
const router = express.Router();
const PortfolioManager = require('../services/portfolioManager');
const SubscriptionService = require('../services/subscriptionService');

// Initialize services
const portfolioManager = new PortfolioManager({
  appToken: process.env.NYC_OPEN_DATA_APP_TOKEN
});
const subscriptionService = new SubscriptionService();

/**
 * @route POST /api/risk-radar/analyze
 * @description Analyze risk for a single property
 */
router.post('/analyze', async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        error: 'Property identifier (BBL or BIN) is required'
      });
    }

    const result = await portfolioManager.analyzeProperty(identifier);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Property analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk-radar/portfolio/analyze
 * @description Analyze risk for a portfolio of properties
 */
router.post('/portfolio/analyze', async (req, res) => {
  try {
    const { properties, options = {} } = req.body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res.status(400).json({
        error: 'Portfolio must contain at least one property identifier'
      });
    }

    if (properties.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 properties per request. Use subscription for larger portfolios.'
      });
    }

    const result = await portfolioManager.analyzePortfolio(properties, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk-radar/portfolio/export
 * @description Export portfolio analysis to CSV
 */
router.post('/portfolio/export', async (req, res) => {
  try {
    const { properties, exportTypes = ['all'] } = req.body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res.status(400).json({
        error: 'Portfolio must contain at least one property identifier'
      });
    }

    // Analyze portfolio
    const portfolioRisk = await portfolioManager.analyzePortfolio(properties);

    // Generate exports
    const exports = await portfolioManager.generateExports(portfolioRisk, exportTypes);

    res.json({
      success: true,
      data: {
        analysisId: portfolioRisk.analysisMetadata?.analysisId,
        exports,
        summary: {
          propertyCount: portfolioRisk.propertyCount,
          averageRiskScore: portfolioRisk.averageRiskScore,
          portfolioRiskLevel: portfolioRisk.portfolioRiskLevel
        }
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk-radar/portfolio/export/:type
 * @description Download specific export as CSV file
 */
router.post('/portfolio/export/:type/download', async (req, res) => {
  try {
    const { type } = req.params;
    const { properties } = req.body;

    const validTypes = ['summary', 'violations', 'permits', 'recommendations'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid export type. Valid types: ${validTypes.join(', ')}`
      });
    }

    // Analyze and export
    const portfolioRisk = await portfolioManager.analyzePortfolio(properties);
    const exports = await portfolioManager.generateExports(portfolioRisk, [type]);

    const exportData = exports[type];
    if (!exportData) {
      return res.status(404).json({ error: 'Export not found' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.csv);
  } catch (error) {
    console.error('CSV download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk-radar/portfolio/trends
 * @description Get trend data for dashboard visualization
 */
router.post('/portfolio/trends', async (req, res) => {
  try {
    const { properties } = req.body;

    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      return res.status(400).json({
        error: 'Portfolio must contain at least one property identifier'
      });
    }

    const portfolioRisk = await portfolioManager.analyzePortfolio(properties);
    const trends = await portfolioManager.getPortfolioTrends(portfolioRisk);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============== Subscription Routes ==============

/**
 * @route GET /api/risk-radar/subscription/tiers
 * @description Get available subscription tiers
 */
router.get('/subscription/tiers', (req, res) => {
  res.json({
    success: true,
    data: SubscriptionService.TIERS
  });
});

/**
 * @route POST /api/risk-radar/subscription/create
 * @description Create a new subscription
 */
router.post('/subscription/create', async (req, res) => {
  try {
    const { userId, tierId, properties = [] } = req.body;

    if (!userId || !tierId) {
      return res.status(400).json({
        error: 'userId and tierId are required'
      });
    }

    const result = await subscriptionService.createSubscription(userId, tierId, properties);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk-radar/subscription/:subscriptionId
 * @description Get subscription details
 */
router.get('/subscription/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const result = await subscriptionService.getSubscription(subscriptionId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/risk-radar/subscription/:subscriptionId/portfolio
 * @description Update portfolio properties
 */
router.put('/subscription/:subscriptionId/portfolio', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { properties } = req.body;

    const subscription = await subscriptionService.getSubscription(subscriptionId);
    const result = await subscriptionService.updatePortfolio(
      subscription.subscription.portfolioId,
      properties
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/risk-radar/subscription/:subscriptionId/analyze
 * @description Run analysis for subscription portfolio
 */
router.post('/subscription/:subscriptionId/analyze', async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscriptionData = await subscriptionService.getSubscription(subscriptionId);
    const { subscription, portfolio } = subscriptionData;

    // Check if subscription is active
    if (subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Subscription is not active'
      });
    }

    // Run analysis
    const portfolioRisk = await portfolioManager.analyzePortfolio(portfolio.properties);

    // Record analysis
    const analysisRecord = await subscriptionService.recordAnalysis(
      portfolio.id,
      portfolioRisk
    );

    res.json({
      success: true,
      data: {
        analysisRecord,
        portfolioRisk
      }
    });
  } catch (error) {
    console.error('Subscription analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk-radar/subscription/:subscriptionId/usage
 * @description Get subscription usage statistics
 */
router.get('/subscription/:subscriptionId/usage', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const usage = await subscriptionService.getUsageStats(subscriptionId);

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/risk-radar/subscription/:subscriptionId/history
 * @description Get analysis history for subscription
 */
router.get('/subscription/:subscriptionId/history', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { limit = 30 } = req.query;

    const subscriptionData = await subscriptionService.getSubscription(subscriptionId);
    const history = subscriptionService.getAnalysisHistory(
      subscriptionData.portfolio.id,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/risk-radar/subscription/:subscriptionId/upgrade
 * @description Upgrade subscription tier
 */
router.put('/subscription/:subscriptionId/upgrade', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { newTierId } = req.body;

    if (!newTierId) {
      return res.status(400).json({
        error: 'newTierId is required'
      });
    }

    const result = await subscriptionService.upgradeTier(subscriptionId, newTierId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/risk-radar/subscription/:subscriptionId
 * @description Cancel subscription
 */
router.delete('/subscription/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body || {};

    const result = await subscriptionService.cancelSubscription(subscriptionId, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// ============== Dashboard Data Routes ==============

/**
 * @route POST /api/risk-radar/dashboard/overview
 * @description Get dashboard overview data
 */
router.post('/dashboard/overview', async (req, res) => {
  try {
    const { properties } = req.body;

    if (!properties || properties.length === 0) {
      return res.status(400).json({
        error: 'Properties are required'
      });
    }

    const portfolioRisk = await portfolioManager.analyzePortfolio(properties);
    const trends = await portfolioManager.getPortfolioTrends(portfolioRisk);

    res.json({
      success: true,
      data: {
        summary: trends.summary,
        riskDistribution: trends.riskDistribution,
        topRiskProperties: portfolioRisk.topRiskProperties,
        recentViolations: trends.violationTrends.slice(-6),
        calculatedAt: portfolioRisk.calculatedAt
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
