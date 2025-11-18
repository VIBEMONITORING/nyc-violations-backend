const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

class SamGovScraper extends BaseScraper {
  constructor() {
    super('SAM.gov', {
      apiUrl: 'https://api.sam.gov/opportunities/v2/search',
      apiKey: process.env.SAM_GOV_API_KEY
    });
  }

  async scrape() {
    this.logStart();
    const opportunities = [];

    try {
      // SAM.gov uses an API - this is a template for the actual implementation
      // You'll need to register for an API key at sam.gov

      const searchParams = {
        limit: 100,
        offset: 0,
        postedFrom: this.getDateDaysAgo(7), // Last 7 days
        postedTo: this.getCurrentDate(),
        ptype: 'o,k,r', // Opportunities, Combined Synopsis/Solicitation, Sources Sought
        // Filter by NAICS codes relevant to I&M
        ncode: '541330,541360,541370,541380', // Engineering, Surveying, Testing
      };

      const queryString = new URLSearchParams(searchParams).toString();
      const url = `${this.config.apiUrl}?${queryString}&api_key=${this.config.apiKey}`;

      const html = await this.fetchHtml(url);
      const data = JSON.parse(html);

      if (data.opportunitiesData) {
        for (const opp of data.opportunitiesData) {
          const opportunity = this.parseOpportunity(opp);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }

      this.logEnd(opportunities.length);
      return opportunities;

    } catch (error) {
      this.logError(error);
      return [];
    }
  }

  parseOpportunity(data) {
    try {
      // Extract project value from description or award
      const projectValue = this.extractProjectValue(data.description || '');

      return {
        title: data.title || data.solicitationNumber || 'Untitled',
        description: data.description,
        source: 'SAM.gov',
        source_url: `https://sam.gov/opp/${data.noticeId}/view`,
        project_value: projectValue,
        monitoring_duration: this.estimateDuration(data.description || ''),
        location: this.parseLocation(data.placeOfPerformance),
        latitude: data.placeOfPerformance?.city?.lat,
        longitude: data.placeOfPerformance?.city?.lng,
        technical_requirements: this.extractTechnicalRequirements(data.description || ''),
        posting_date: data.postedDate,
        deadline_date: data.responseDeadLine,
        client_name: data.officeAddress?.agency || data.organizationName,
        contact_info: {
          name: data.pointOfContact?.[0]?.fullName,
          email: data.pointOfContact?.[0]?.email,
          phone: data.pointOfContact?.[0]?.phone
        },
        raw_data: data
      };
    } catch (error) {
      logger.error('Error parsing SAM.gov opportunity:', error);
      return null;
    }
  }

  parseLocation(placeOfPerformance) {
    if (!placeOfPerformance) return null;

    const parts = [];
    if (placeOfPerformance.city?.name) parts.push(placeOfPerformance.city.name);
    if (placeOfPerformance.state?.name) parts.push(placeOfPerformance.state.name);
    if (placeOfPerformance.zip) parts.push(placeOfPerformance.zip);

    return parts.join(', ') || null;
  }

  extractProjectValue(text) {
    // Look for dollar amounts in text
    const patterns = [
      /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|mil|M|K|thousand))?/gi,
      /(?:value|amount|budget|worth):\s*\$?[\d,]+/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = this.parseMoneyString(match[0]);
        if (value > 0) return value;
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
      'quality control', 'compliance', 'environmental',
      'structural', 'geotechnical', 'materials testing'
    ];

    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword)) {
        requirements.push(keyword);
      }
    }

    return requirements.length > 0 ? requirements : null;
  }

  getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }
}

module.exports = SamGovScraper;
