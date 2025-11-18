const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

class StateDOTScraper extends BaseScraper {
  constructor(state = 'NY') {
    super(`${state} DOT`, {
      state,
      urls: {
        'NY': 'https://www.dot.ny.gov/doing-business/opportunities',
        'NJ': 'https://www.state.nj.us/transportation/business/procurement/',
        'CT': 'https://portal.ct.gov/DOT/Procurement/Procurement',
        'PA': 'https://www.penndot.gov/pages/business-center.aspx'
      }
    });
  }

  async scrape() {
    this.logStart();
    const opportunities = [];

    try {
      const url = this.config.urls[this.config.state];
      if (!url) {
        logger.warn(`No URL configured for state: ${this.config.state}`);
        return [];
      }

      // Using Puppeteer for dynamic content
      const html = await this.fetchWithPuppeteer(url, {
        waitForSelector: 'table, .opportunity-list, .procurement-list'
      });

      const $ = this.parseHtml(html);

      // Generic parsing - adapt based on actual site structure
      const opportunityElements = this.findOpportunityElements($);

      for (const elem of opportunityElements) {
        const opportunity = this.parseOpportunity($, elem);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      }

      this.logEnd(opportunities.length);
      return opportunities;

    } catch (error) {
      this.logError(error);
      return [];
    }
  }

  findOpportunityElements($) {
    // Try multiple selectors to find opportunity listings
    const selectors = [
      'table.procurement-table tr',
      '.opportunity-item',
      '.procurement-list li',
      'table tbody tr',
      '.contract-opportunity'
    ];

    for (const selector of selectors) {
      const elements = $(selector).toArray();
      if (elements.length > 0) {
        logger.info(`Found ${elements.length} opportunities using selector: ${selector}`);
        return elements;
      }
    }

    return [];
  }

  parseOpportunity($, elem) {
    try {
      const $elem = $(elem);

      // Extract text content
      const title = this.extractTitle($, $elem);
      const description = this.extractDescription($, $elem);
      const projectNumber = this.extractProjectNumber($, $elem);
      const deadlineDate = this.extractDate($, $elem);

      if (!title) return null;

      return {
        title: title,
        description: description,
        source: `${this.config.state} DOT`,
        source_url: this.extractUrl($, $elem),
        project_value: this.extractProjectValue(description || title),
        monitoring_duration: this.estimateDuration(description || title),
        location: `${this.config.state}, USA`,
        technical_requirements: this.extractTechnicalRequirements(description || title),
        posting_date: new Date().toISOString().split('T')[0],
        deadline_date: deadlineDate,
        client_name: `${this.config.state} Department of Transportation`,
        contact_info: {},
        raw_data: {
          projectNumber,
          html: $elem.html()
        }
      };
    } catch (error) {
      logger.error('Error parsing DOT opportunity:', error);
      return null;
    }
  }

  extractTitle($, $elem) {
    const selectors = [
      'td:nth-child(1)',
      '.title',
      'h3',
      'a',
      'strong'
    ];

    for (const selector of selectors) {
      const text = $elem.find(selector).first().text().trim();
      if (text && text.length > 5) return text;
    }

    return $elem.text().trim().substring(0, 200);
  }

  extractDescription($, $elem) {
    const selectors = [
      '.description',
      'td:nth-child(2)',
      'p'
    ];

    for (const selector of selectors) {
      const text = $elem.find(selector).first().text().trim();
      if (text) return text;
    }

    return null;
  }

  extractProjectNumber($, $elem) {
    const text = $elem.text();
    const patterns = [
      /PIN[\s:]*([\w-]+)/i,
      /Project[\s#:]*([\w-]+)/i,
      /Contract[\s#:]*([\w-]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  extractUrl($, $elem) {
    const href = $elem.find('a').first().attr('href');
    if (!href) return this.config.urls[this.config.state];

    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) {
      const baseUrl = new URL(this.config.urls[this.config.state]);
      return `${baseUrl.origin}${href}`;
    }

    return this.config.urls[this.config.state];
  }

  extractDate($, $elem) {
    const text = $elem.text();
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(?:due|deadline|by):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date)) {
          return date.toISOString().split('T')[0];
        }
      }
    }

    return null;
  }

  extractProjectValue(text) {
    const patterns = [
      /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|mil|M|K))?/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseMoneyString(match[0]);
      }
    }

    return null;
  }

  parseMoneyString(str) {
    const cleaned = str.replace(/[^0-9.MmKk]/g, '');
    let value = parseFloat(cleaned);

    if (str.toLowerCase().includes('m')) value *= 1000000;
    if (str.toLowerCase().includes('k')) value *= 1000;

    return value;
  }

  estimateDuration(text) {
    const patterns = [
      /(\d+)\s*(?:month|mon|mo)/i,
      /(\d+)\s*(?:year|yr)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let months = parseInt(match[1]);
        if (pattern.toString().includes('year')) months *= 12;
        return months;
      }
    }

    return null;
  }

  extractTechnicalRequirements(text) {
    const requirements = [];
    const keywords = [
      'monitoring', 'inspection', 'testing', 'surveying',
      'bridge', 'highway', 'road', 'pavement',
      'traffic', 'structural', 'geotechnical'
    ];

    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword)) {
        requirements.push(keyword);
      }
    }

    return requirements.length > 0 ? requirements : null;
  }
}

module.exports = StateDOTScraper;
