/**
 * NYC Violations Backend - Construction Risk Radar
 * Main server entry point
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Import routes
const riskRadarRoutes = require('./src/routes/riskRadar');

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    service: 'Construction Risk Radar API',
    version: '1.0.0'
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'Construction Risk Radar API',
    version: '1.0.0',
    description: 'NYC DOB data integration for construction risk assessment',
    endpoints: {
      health: 'GET /health',
      riskRadar: {
        analyze: 'POST /api/risk-radar/analyze',
        portfolioAnalyze: 'POST /api/risk-radar/portfolio/analyze',
        portfolioExport: 'POST /api/risk-radar/portfolio/export',
        portfolioTrends: 'POST /api/risk-radar/portfolio/trends',
        dashboardOverview: 'POST /api/risk-radar/dashboard/overview',
        subscriptionTiers: 'GET /api/risk-radar/subscription/tiers',
        subscriptionCreate: 'POST /api/risk-radar/subscription/create',
        subscriptionGet: 'GET /api/risk-radar/subscription/:id',
        subscriptionAnalyze: 'POST /api/risk-radar/subscription/:id/analyze',
        subscriptionUsage: 'GET /api/risk-radar/subscription/:id/usage',
        subscriptionHistory: 'GET /api/risk-radar/subscription/:id/history'
      }
    },
    dataSources: [
      {
        name: 'DOB NOW: Build – Approved Permits',
        id: 'rbx6-tga4',
        url: 'https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4'
      },
      {
        name: 'DOB Violations (Active)',
        id: 'cepu-5g8r',
        url: 'https://data.cityofnewyork.us/Housing-Development/DOB-Violations-Active-/cepu-5g8r'
      },
      {
        name: 'DOB ECB Violations',
        id: '6bgk-3dad',
        url: 'https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad'
      }
    ]
  });
});

// Risk Radar routes
app.use('/api/risk-radar', riskRadarRoutes);

// Legacy test endpoint (for backwards compatibility)
app.get('/api/violations', (req, res) => {
  res.json({
    message: 'Violations endpoint - Use /api/risk-radar for Construction Risk Radar features',
    redirect: '/api/risk-radar/analyze'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: '/api'
  });
});

app.listen(PORT, () => {
  console.log(`Construction Risk Radar API running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api`);
});

module.exports = app;
