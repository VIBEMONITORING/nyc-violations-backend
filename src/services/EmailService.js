const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    this.defaultRecipients = (process.env.REPORT_RECIPIENTS || '').split(',').filter(Boolean);
  }

  /**
   * Send weekly opportunity report
   */
  async sendWeeklyReport(reportData) {
    try {
      const html = this.generateWeeklyReportHtml(reportData);

      const mailOptions = {
        from: this.fromEmail,
        to: this.defaultRecipients,
        subject: `Weekly I&M Opportunity Report - ${reportData.weekStart} to ${reportData.weekEnd}`,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Weekly report email sent:', info.messageId);

      return info;
    } catch (error) {
      logger.error('Error sending weekly report:', error);
      throw error;
    }
  }

  /**
   * Send high-priority opportunity alert
   */
  async sendOpportunityAlert(opportunity, score) {
    try {
      const html = this.generateOpportunityAlertHtml(opportunity, score);

      const mailOptions = {
        from: this.fromEmail,
        to: this.defaultRecipients,
        subject: `🎯 High-Priority Opportunity Alert: ${opportunity.title}`,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Opportunity alert email sent:', info.messageId);

      return info;
    } catch (error) {
      logger.error('Error sending opportunity alert:', error);
      throw error;
    }
  }

  /**
   * Generate HTML for weekly report email
   */
  generateWeeklyReportHtml(reportData) {
    const { topOpportunities, summary, weekStart, weekEnd, totalEstimatedRevenue } = reportData;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
          .summary { background-color: #ecf0f1; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .opportunity { background-color: white; border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .score { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
          .score-high { background-color: #27ae60; color: white; }
          .score-medium { background-color: #f39c12; color: white; }
          .score-low { background-color: #95a5a6; color: white; }
          .action-bid { color: #27ae60; font-weight: bold; }
          .action-consider { color: #f39c12; font-weight: bold; }
          .action-nobid { color: #e74c3c; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #34495e; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly I&M Opportunity Report</h1>
            <p>Report Period: ${weekStart} to ${weekEnd}</p>
          </div>

          <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Opportunities Found:</strong> ${summary.total}</p>
            <p><strong>Top-Rated Opportunities:</strong> ${topOpportunities.length}</p>
            <p><strong>Total Estimated Revenue Potential:</strong> $${totalEstimatedRevenue.toLocaleString()}</p>
          </div>

          <h2>Top 10 Opportunities</h2>
    `;

    topOpportunities.forEach((opp, index) => {
      const scoreClass = opp.total_score >= 8 ? 'score-high' : opp.total_score >= 6 ? 'score-medium' : 'score-low';
      const actionClass = opp.recommended_action?.includes('BID') ? 'action-bid' :
                         opp.recommended_action?.includes('CONSIDER') ? 'action-consider' : 'action-nobid';

      html += `
        <div class="opportunity">
          <h3>${index + 1}. ${opp.title}</h3>
          <p><span class="score ${scoreClass}">Score: ${opp.total_score}/10</span>
             <span class="${actionClass}"> ${opp.recommended_action}</span></p>

          <table>
            <tr>
              <th>Source</th>
              <th>Project Value</th>
              <th>Duration</th>
              <th>Location</th>
              <th>Deadline</th>
            </tr>
            <tr>
              <td>${opp.source}</td>
              <td>$${opp.project_value?.toLocaleString() || 'N/A'}</td>
              <td>${opp.monitoring_duration || 'N/A'} months</td>
              <td>${opp.location || 'N/A'}</td>
              <td>${opp.deadline_date ? new Date(opp.deadline_date).toLocaleDateString() : 'N/A'}</td>
            </tr>
          </table>

          <p><strong>Estimated Revenue:</strong> $${opp.estimated_revenue?.toLocaleString() || 'N/A'}</p>
          <p><strong>Description:</strong> ${(opp.description || '').substring(0, 200)}...</p>
          <p><strong>Required Resources:</strong> ${opp.required_resources?.teamSize || 'N/A'} team members</p>
          <p><strong>Scoring Notes:</strong> ${opp.scoring_notes || 'N/A'}</p>

          ${opp.source_url ? `<p><a href="${opp.source_url}" target="_blank">View Full Opportunity →</a></p>` : ''}
        </div>
      `;
    });

    html += `
          <div class="summary" style="margin-top: 30px;">
            <h3>Next Steps</h3>
            <ol>
              <li>Review high-scoring opportunities (8+) immediately</li>
              <li>Evaluate resource availability for bid preparation</li>
              <li>Contact clients for additional information</li>
              <li>Update opportunity statuses in the system</li>
            </ol>
          </div>

          <p style="text-align: center; color: #7f8c8d; margin-top: 30px;">
            <small>This is an automated report from the I&M Opportunity Scanner System</small>
          </p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Generate HTML for opportunity alert email
   */
  generateOpportunityAlertHtml(opportunity, score) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert-header { background-color: #27ae60; color: white; padding: 20px; border-radius: 5px; text-align: center; }
          .details { background-color: #ecf0f1; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .score { font-size: 24px; font-weight: bold; color: #27ae60; }
          table { width: 100%; margin: 15px 0; }
          th, td { padding: 8px; text-align: left; }
          th { background-color: #34495e; color: white; }
          .action-button { display: inline-block; padding: 12px 24px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert-header">
            <h1>🎯 High-Priority Opportunity Detected!</h1>
            <p class="score">Score: ${score.total_score}/10</p>
          </div>

          <h2>${opportunity.title}</h2>

          <div class="details">
            <h3>Opportunity Details</h3>
            <table>
              <tr><th>Source:</th><td>${opportunity.source}</td></tr>
              <tr><th>Project Value:</th><td>$${opportunity.project_value?.toLocaleString() || 'N/A'}</td></tr>
              <tr><th>Estimated Revenue:</th><td>$${score.estimated_revenue?.toLocaleString() || 'N/A'}</td></tr>
              <tr><th>Duration:</th><td>${opportunity.monitoring_duration || 'N/A'} months</td></tr>
              <tr><th>Location:</th><td>${opportunity.location || 'N/A'}</td></tr>
              <tr><th>Deadline:</th><td>${opportunity.deadline_date ? new Date(opportunity.deadline_date).toLocaleDateString() : 'N/A'}</td></tr>
              <tr><th>Client:</th><td>${opportunity.client_name || 'N/A'}</td></tr>
            </table>
          </div>

          <div class="details">
            <h3>Recommendation</h3>
            <p><strong>Action:</strong> ${score.recommended_action}</p>
            <p><strong>Notes:</strong> ${score.scoring_notes}</p>
          </div>

          <div class="details">
            <h3>Required Resources</h3>
            <p><strong>Team Size:</strong> ${score.required_resources?.teamSize || 'N/A'} members</p>
            <p><strong>Roles:</strong> ${score.required_resources?.roles?.join(', ') || 'N/A'}</p>
          </div>

          ${opportunity.source_url ? `
            <div style="text-align: center;">
              <a href="${opportunity.source_url}" class="action-button" target="_blank">View Full Opportunity</a>
            </div>
          ` : ''}

          <p style="text-align: center; color: #7f8c8d; margin-top: 30px;">
            <small>This is an automated alert from the I&M Opportunity Scanner System</small>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;
