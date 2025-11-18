const ScraperManager = require('../scrapers');
const OpportunityFilter = require('./OpportunityFilter');
const OpportunityScorer = require('./OpportunityScorer');
const Opportunity = require('../models/Opportunity');
const logger = require('../config/logger');
const pool = require('../config/database');

class OpportunityService {
  constructor() {
    this.scraperManager = new ScraperManager();
    this.filter = new OpportunityFilter();
    this.scorer = new OpportunityScorer();
  }

  /**
   * Run complete opportunity discovery pipeline
   */
  async runPipeline() {
    logger.info('Starting opportunity discovery pipeline...');

    const client = await pool.connect();

    try {
      // Log pipeline start
      await client.query(`
        INSERT INTO scraping_logs (source, status, started_at)
        VALUES ('ALL_SOURCES', 'running', CURRENT_TIMESTAMP)
      `);

      // Step 1: Scrape opportunities
      logger.info('Step 1: Scraping opportunities from all sources...');
      const scrapedOpportunities = await this.scraperManager.runAll();

      // Step 2: Filter opportunities
      logger.info('Step 2: Filtering opportunities...');
      const filteredOpportunities = this.filter.filter(scrapedOpportunities);

      // Step 3: Save to database
      logger.info('Step 3: Saving opportunities to database...');
      const savedOpportunities = [];

      for (const opp of filteredOpportunities) {
        try {
          const saved = await Opportunity.create(opp);
          savedOpportunities.push(saved);
        } catch (error) {
          logger.error('Error saving opportunity:', error.message);
        }
      }

      // Step 4: Score opportunities
      logger.info('Step 4: Scoring opportunities...');
      const scores = await this.scorer.scoreOpportunities(savedOpportunities);

      // Log pipeline completion
      await client.query(`
        UPDATE scraping_logs
        SET status = 'completed',
            opportunities_found = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE source = 'ALL_SOURCES'
          AND status = 'running'
      `, [savedOpportunities.length]);

      logger.info(`Pipeline complete: ${savedOpportunities.length} opportunities saved and scored`);

      return {
        scraped: scrapedOpportunities.length,
        filtered: filteredOpportunities.length,
        saved: savedOpportunities.length,
        scored: scores.length,
        opportunities: savedOpportunities
      };

    } catch (error) {
      logger.error('Pipeline error:', error);

      await client.query(`
        UPDATE scraping_logs
        SET status = 'failed',
            errors = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE source = 'ALL_SOURCES'
          AND status = 'running'
      `, [error.message]);

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get top opportunities
   */
  async getTopOpportunities(limit = 10) {
    return await Opportunity.getWithScores({
      minScore: 6,
      status: 'new',
      limit
    });
  }

  /**
   * Get opportunity by ID with score
   */
  async getOpportunityWithScore(id) {
    const opportunities = await Opportunity.getWithScores({ limit: 1 });
    return opportunities.find(opp => opp.id === id);
  }

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(id, status) {
    return await Opportunity.update(id, { status });
  }
}

module.exports = OpportunityService;
