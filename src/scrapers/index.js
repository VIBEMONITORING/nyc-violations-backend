const SamGovScraper = require('./SamGovScraper');
const StateDOTScraper = require('./StateDOTScraper');
const logger = require('../config/logger');

class ScraperManager {
  constructor() {
    this.scrapers = [
      new SamGovScraper(),
      new StateDOTScraper('NY'),
      new StateDOTScraper('NJ'),
      new StateDOTScraper('CT'),
      // Add more scrapers as needed
    ];
  }

  async runAll() {
    logger.info('Starting all scrapers...');
    const allOpportunities = [];

    for (const scraper of this.scrapers) {
      try {
        const opportunities = await scraper.scrape();
        allOpportunities.push(...opportunities);
        logger.info(`${scraper.name}: Found ${opportunities.length} opportunities`);
      } catch (error) {
        logger.error(`${scraper.name}: Failed -`, error.message);
      }
    }

    logger.info(`Total opportunities found: ${allOpportunities.length}`);
    return allOpportunities;
  }

  async runBySource(sourceName) {
    const scraper = this.scrapers.find(s => s.name === sourceName);
    if (!scraper) {
      throw new Error(`Scraper not found: ${sourceName}`);
    }

    return await scraper.scrape();
  }

  getAvailableSources() {
    return this.scrapers.map(s => s.name);
  }
}

module.exports = ScraperManager;
