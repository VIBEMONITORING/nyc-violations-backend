const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const logger = require('../config/logger');

class BaseScraper {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      timeout: 30000,
      retries: 3,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...config
    };
  }

  async fetchHtml(url) {
    for (let i = 0; i < this.config.retries; i++) {
      try {
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent
          }
        });
        return response.data;
      } catch (error) {
        logger.error(`Fetch attempt ${i + 1} failed for ${url}:`, error.message);
        if (i === this.config.retries - 1) throw error;
        await this.sleep(1000 * (i + 1));
      }
    }
  }

  async fetchWithPuppeteer(url, options = {}) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setUserAgent(this.config.userAgent);

      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: this.config.timeout
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: this.config.timeout
        });
      }

      const content = await page.content();
      return content;
    } catch (error) {
      logger.error(`Puppeteer fetch failed for ${url}:`, error.message);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  parseHtml(html) {
    return cheerio.load(html);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrape() {
    throw new Error('scrape() method must be implemented by subclass');
  }

  logStart() {
    logger.info(`Starting scraper: ${this.name}`);
  }

  logEnd(count) {
    logger.info(`Completed scraper: ${this.name} - Found ${count} opportunities`);
  }

  logError(error) {
    logger.error(`Error in scraper ${this.name}:`, error);
  }
}

module.exports = BaseScraper;
