const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const opportunitiesRoutes = require('./src/routes/opportunities');
const reportsRoutes = require('./src/routes/reports');
const schedulerRoutes = require('./src/routes/scheduler');
const dashboardRoutes = require('./src/routes/dashboard');

// Import services
const Scheduler = require('./src/utils/scheduler');
const logger = require('./src/config/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Initialize scheduler
const scheduler = new Scheduler();
if (process.env.ENABLE_SCHEDULER !== 'false') {
  scheduler.init();
  logger.info('Scheduler initialized');
}
app.set('scheduler', scheduler);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    message: 'I&M Opportunity Scanner API is running!',
    scheduler: {
      enabled: process.env.ENABLE_SCHEDULER !== 'false',
      jobs: scheduler.getStatus()
    }
  });
});

// API Routes
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Legacy test endpoint (for backwards compatibility)
app.get('/api/violations', (req, res) => {
  res.json({
    message: 'This endpoint is deprecated. Please use /api/opportunities instead.',
    data: []
  });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'I&M Opportunity Scanner API',
    version: '1.0.0',
    description: 'Web scraping and analysis system for I&M opportunities',
    endpoints: {
      opportunities: {
        'GET /api/opportunities': 'Get all opportunities',
        'GET /api/opportunities/top': 'Get top-scored opportunities',
        'GET /api/opportunities/:id': 'Get opportunity by ID',
        'PUT /api/opportunities/:id/status': 'Update opportunity status',
        'POST /api/opportunities/scan': 'Trigger opportunity scan',
        'GET /api/opportunities/stats/summary': 'Get opportunity statistics'
      },
      reports: {
        'GET /api/reports/weekly': 'Get weekly reports',
        'GET /api/reports/weekly/latest': 'Get latest weekly report',
        'GET /api/reports/logs': 'Get scraping logs'
      },
      scheduler: {
        'GET /api/scheduler/status': 'Get scheduler status',
        'POST /api/scheduler/trigger/scan': 'Manually trigger scan',
        'POST /api/scheduler/trigger/report': 'Manually trigger weekly report',
        'POST /api/scheduler/trigger/alerts': 'Manually trigger alerts'
      },
      dashboard: {
        'GET /api/dashboard': 'Get dashboard overview',
        'GET /api/dashboard/charts/timeline': 'Get timeline chart data',
        'GET /api/dashboard/charts/revenue': 'Get revenue chart data'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  scheduler.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  scheduler.stopAll();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   I&M Opportunity Scanner System                            ║
║   Server running on port ${PORT}                                 ║
║                                                              ║
║   Access the API at: http://localhost:${PORT}                   ║
║   Health check: http://localhost:${PORT}/health                 ║
║   Dashboard API: http://localhost:${PORT}/api/dashboard         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
