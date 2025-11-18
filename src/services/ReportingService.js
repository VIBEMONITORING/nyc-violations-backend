const pool = require('../config/database');
const OpportunityScore = require('../models/OpportunityScore');
const EmailService = require('./EmailService');
const logger = require('../config/logger');
const { format, startOfWeek, endOfWeek } = require('date-fns');

class ReportingService {
  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Generate and send weekly report
   */
  async generateWeeklyReport() {
    logger.info('Generating weekly report...');

    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

      // Get top opportunities from this week
      const topOpportunities = await OpportunityScore.getTopScored(10);

      // Calculate total estimated revenue
      const totalEstimatedRevenue = topOpportunities.reduce(
        (sum, opp) => sum + (parseFloat(opp.estimated_revenue) || 0),
        0
      );

      // Get opportunity count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM opportunities
        WHERE created_at >= $1 AND created_at <= $2
      `;
      const countResult = await pool.query(countQuery, [weekStart, weekEnd]);
      const totalOpportunities = parseInt(countResult.rows[0].total);

      // Prepare report data
      const reportData = {
        weekStart: format(weekStart, 'MMM dd, yyyy'),
        weekEnd: format(weekEnd, 'MMM dd, yyyy'),
        topOpportunities,
        summary: {
          total: totalOpportunities,
          topRated: topOpportunities.length
        },
        totalEstimatedRevenue
      };

      // Save report to database
      const saveQuery = `
        INSERT INTO weekly_reports (
          report_date, week_start, week_end, total_opportunities,
          top_opportunities, total_estimated_revenue, recipients
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const recipients = this.emailService.defaultRecipients;
      const savedReport = await pool.query(saveQuery, [
        now,
        weekStart,
        weekEnd,
        totalOpportunities,
        JSON.stringify(topOpportunities),
        totalEstimatedRevenue,
        recipients
      ]);

      // Send email report
      if (recipients.length > 0) {
        await this.emailService.sendWeeklyReport(reportData);

        // Update report with sent timestamp
        await pool.query(
          'UPDATE weekly_reports SET sent_at = CURRENT_TIMESTAMP WHERE id = $1',
          [savedReport.rows[0].id]
        );

        logger.info('Weekly report generated and sent successfully');
      } else {
        logger.warn('No recipients configured for weekly report');
      }

      return {
        success: true,
        report: savedReport.rows[0],
        emailSent: recipients.length > 0
      };

    } catch (error) {
      logger.error('Error generating weekly report:', error);
      throw error;
    }
  }

  /**
   * Send alert for high-priority opportunities
   */
  async sendHighPriorityAlerts() {
    logger.info('Checking for high-priority opportunities...');

    try {
      // Get new opportunities scored 8 or higher
      const query = `
        SELECT o.*, os.*
        FROM opportunities o
        JOIN opportunity_scores os ON o.id = os.opportunity_id
        WHERE os.total_score >= 8
          AND o.status = 'new'
          AND o.created_at >= NOW() - INTERVAL '1 day'
      `;

      const result = await pool.query(query);
      const highPriorityOpps = result.rows;

      logger.info(`Found ${highPriorityOpps.length} high-priority opportunities`);

      for (const opp of highPriorityOpps) {
        try {
          await this.emailService.sendOpportunityAlert(opp, {
            total_score: opp.total_score,
            recommended_action: opp.recommended_action,
            scoring_notes: opp.scoring_notes,
            estimated_revenue: opp.estimated_revenue,
            required_resources: opp.required_resources
          });

          logger.info(`Alert sent for opportunity: ${opp.title}`);
        } catch (error) {
          logger.error(`Error sending alert for opportunity ${opp.id}:`, error);
        }
      }

      return {
        success: true,
        alertsSent: highPriorityOpps.length
      };

    } catch (error) {
      logger.error('Error sending high-priority alerts:', error);
      throw error;
    }
  }

  /**
   * Get report statistics
   */
  async getReportStats() {
    const query = `
      SELECT
        COUNT(*) as total_reports,
        AVG(total_opportunities) as avg_opportunities_per_week,
        SUM(total_estimated_revenue) as cumulative_revenue_potential
      FROM weekly_reports
      WHERE created_at >= NOW() - INTERVAL '90 days'
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }
}

module.exports = ReportingService;
