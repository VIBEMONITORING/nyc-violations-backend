/**
 * NYC Open Data Service
 * Handles API calls to NYC Open Data Socrata endpoints
 */

const { DATASETS, BOROUGH_CODES } = require('../config/datasets');

class NYCOpenDataService {
  constructor(appToken = null) {
    this.appToken = appToken || process.env.NYC_OPEN_DATA_APP_TOKEN;
    this.requestDelay = 100; // Rate limiting delay in ms
    this.maxRetries = 3;
    this.pageSize = 1000;
  }

  /**
   * Build query parameters for Socrata API
   */
  buildQueryParams(filters = {}, options = {}) {
    const params = new URLSearchParams();

    // Add $where clauses for filtering
    const whereClauses = [];

    if (filters.bin) {
      whereClauses.push(`bin='${filters.bin}'`);
    }

    if (filters.bbl) {
      whereClauses.push(`bbl='${filters.bbl}'`);
    }

    if (filters.borough && filters.block && filters.lot) {
      const boroCode = BOROUGH_CODES[filters.borough.toUpperCase()] || filters.borough;
      whereClauses.push(`boro='${boroCode}' AND block='${filters.block}' AND lot='${filters.lot}'`);
    }

    if (filters.bins && filters.bins.length > 0) {
      const binList = filters.bins.map(b => `'${b}'`).join(',');
      whereClauses.push(`bin IN (${binList})`);
    }

    if (filters.bbls && filters.bbls.length > 0) {
      const bblList = filters.bbls.map(b => `'${b}'`).join(',');
      whereClauses.push(`bbl IN (${bblList})`);
    }

    if (filters.dateFrom) {
      whereClauses.push(`issue_date >= '${filters.dateFrom}'`);
    }

    if (filters.dateTo) {
      whereClauses.push(`issue_date <= '${filters.dateTo}'`);
    }

    if (whereClauses.length > 0) {
      params.append('$where', whereClauses.join(' AND '));
    }

    // Pagination
    params.append('$limit', options.limit || this.pageSize);
    if (options.offset) {
      params.append('$offset', options.offset);
    }

    // Ordering
    if (options.orderBy) {
      params.append('$order', options.orderBy);
    }

    return params;
  }

  /**
   * Make API request with retry logic
   */
  async makeRequest(url, retries = 0) {
    const headers = {
      'Accept': 'application/json'
    };

    if (this.appToken) {
      headers['X-App-Token'] = this.appToken;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 429 && retries < this.maxRetries) {
          // Rate limited, wait and retry
          await this.delay(Math.pow(2, retries) * 1000);
          return this.makeRequest(url, retries + 1);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < this.maxRetries) {
        await this.delay(Math.pow(2, retries) * 1000);
        return this.makeRequest(url, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Delay helper for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch all pages of results
   */
  async fetchAllPages(endpoint, filters = {}, options = {}) {
    const allResults = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = this.buildQueryParams(filters, { ...options, offset });
      const url = `${endpoint}?${params.toString()}`;

      const results = await this.makeRequest(url);
      allResults.push(...results);

      if (results.length < this.pageSize) {
        hasMore = false;
      } else {
        offset += this.pageSize;
        await this.delay(this.requestDelay);
      }

      // Safety limit
      if (offset > 50000) {
        console.warn('Reached maximum pagination limit');
        break;
      }
    }

    return allResults;
  }

  /**
   * Fetch DOB NOW Approved Permits
   */
  async fetchApprovedPermits(filters = {}, options = {}) {
    const dataset = DATASETS.DOB_NOW_PERMITS;
    return this.fetchAllPages(dataset.endpoint, filters, options);
  }

  /**
   * Fetch Active DOB Violations
   */
  async fetchActiveViolations(filters = {}, options = {}) {
    const dataset = DATASETS.DOB_VIOLATIONS_ACTIVE;
    return this.fetchAllPages(dataset.endpoint, filters, options);
  }

  /**
   * Fetch ECB Violations
   */
  async fetchECBViolations(filters = {}, options = {}) {
    const dataset = DATASETS.DOB_ECB_VIOLATIONS;
    return this.fetchAllPages(dataset.endpoint, filters, options);
  }

  /**
   * Fetch all data for a single property
   */
  async fetchPropertyData(identifier) {
    const filters = this.parseIdentifier(identifier);

    const [permits, violations, ecbViolations] = await Promise.all([
      this.fetchApprovedPermits(filters),
      this.fetchActiveViolations(filters),
      this.fetchECBViolations(filters)
    ]);

    return {
      identifier,
      filters,
      permits,
      violations,
      ecbViolations,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Fetch data for multiple properties (portfolio)
   */
  async fetchPortfolioData(identifiers) {
    const results = [];

    for (const identifier of identifiers) {
      try {
        const propertyData = await this.fetchPropertyData(identifier);
        results.push(propertyData);
        await this.delay(this.requestDelay);
      } catch (error) {
        results.push({
          identifier,
          error: error.message,
          fetchedAt: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Parse property identifier (BBL or BIN)
   */
  parseIdentifier(identifier) {
    const cleaned = String(identifier).replace(/[^0-9]/g, '');

    // BIN is typically 7 digits
    if (cleaned.length === 7) {
      return { bin: cleaned };
    }

    // BBL is 10 digits: Borough(1) + Block(5) + Lot(4)
    if (cleaned.length === 10) {
      return {
        bbl: cleaned,
        borough: cleaned.substring(0, 1),
        block: cleaned.substring(1, 6),
        lot: cleaned.substring(6, 10)
      };
    }

    // Try as-is
    return { bin: identifier };
  }

  /**
   * Get dataset count
   */
  async getDatasetCount(datasetKey, filters = {}) {
    const dataset = DATASETS[datasetKey];
    if (!dataset) throw new Error(`Unknown dataset: ${datasetKey}`);

    const params = this.buildQueryParams(filters, {});
    params.append('$select', 'count(*)');

    const url = `${dataset.endpoint}?${params.toString()}`;
    const result = await this.makeRequest(url);

    return result[0]?.count || 0;
  }
}

module.exports = NYCOpenDataService;
