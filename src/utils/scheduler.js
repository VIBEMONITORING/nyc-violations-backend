const cron = require('node-cron');
const OpportunityService = require('../services/OpportunityService');
const ReportingService = require('../services/ReportingService');
const logger = require('../config/logger');

class Scheduler {
  constructor() {
    this.opportunityService = new OpportunityService();
    this.reportingService = new ReportingService();
    this.jobs = [];
  }

  /**
   * Initialize all scheduled jobs
   */
  init() {
    logger.info('Initializing scheduled jobs...');

    // Daily scraping at 6:00 AM
    const dailyScrapeJob = cron.schedule('0 6 * * *', async () => {
      logger.info('Running scheduled daily opportunity scan...');
      try {
        await this.opportunityService.runPipeline();
        logger.info('Scheduled daily scan completed successfully');
      } catch (error) {
        logger.error('Scheduled daily scan failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'America/New_York'
    });

    this.jobs.push({ name: 'Daily Scraping', job: dailyScrapeJob });

    // High-priority alerts check - every 4 hours
    const alertsJob = cron.schedule('0 */4 * * *', async () => {
      logger.info('Checking for high-priority opportunity alerts...');
      try {
        await this.reportingService.sendHighPriorityAlerts();
        logger.info('High-priority alerts check completed');
      } catch (error) {
        logger.error('High-priority alerts check failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'America/New_York'
    });

    this.jobs.push({ name: 'High-Priority Alerts', job: alertsJob });

    // Weekly report - Every Monday at 8:00 AM
    const weeklyReportJob = cron.schedule('0 8 * * 1', async () => {
      logger.info('Generating weekly opportunity report...');
      try {
        await this.reportingService.generateWeeklyReport();
        logger.info('Weekly report generated successfully');
      } catch (error) {
        logger.error('Weekly report generation failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'America/New_York'
    });

    this.jobs.push({ name: 'Weekly Report', job: weeklyReportJob });

    logger.info(`Initialized ${this.jobs.length} scheduled jobs:`);
    this.jobs.forEach(({ name }) => {
      logger.info(`  - ${name}`);
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    logger.info('Stopping all scheduled jobs...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`  - Stopped: ${name}`);
    });
  }

  /**
   * Get job status
   */
  getStatus() {
    return this.jobs.map(({ name, job }) => ({
      name,
      running: job.running
    }));
  }

  /**
   * Manually trigger daily scan
   */
  async triggerDailyScan() {
    logger.info('Manually triggering daily scan...');
    return await this.opportunityService.runPipeline();
  }

  /**
   * Manually trigger weekly report
   */
  async triggerWeeklyReport() {
    logger.info('Manually triggering weekly report...');
    return await this.reportingService.generateWeeklyReport();
  }

  /**
   * Manually trigger high-priority alerts
   */
  async triggerHighPriorityAlerts() {
    logger.info('Manually triggering high-priority alerts...');
    return await this.reportingService.sendHighPriorityAlerts();
  }
}

module.exports = Scheduler;
