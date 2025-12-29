/**
 * Portfolio Manager Service
 * Manages property portfolios for Construction Risk Radar
 */

const NYCOpenDataService = require('./nycOpenDataService');
const RiskScoringEngine = require('./riskScoringEngine');
const CSVExportService = require('./csvExportService');

class PortfolioManager {
  constructor(options = {}) {
    this.nycDataService = new NYCOpenDataService(options.appToken);
    this.riskEngine = new RiskScoringEngine();
    this.csvExporter = new CSVExportService();
  }

  /**
   * Create a new portfolio analysis
   */
  async analyzePortfolio(properties, options = {}) {
    const startTime = Date.now();

    // Validate input
    if (!properties || !Array.isArray(properties) || properties.length === 0) {
      throw new Error('Portfolio must contain at least one property identifier');
    }

    // Parse and normalize identifiers
    const normalizedProperties = this.normalizePropertyList(properties);

    // Fetch data for all properties
    const propertyDataList = await this.nycDataService.fetchPortfolioData(
      normalizedProperties.map(p => p.original)
    );

    // Calculate risk scores
    const portfolioRisk = this.riskEngine.calculatePortfolioRisk(propertyDataList);

    // Add metadata
    portfolioRisk.analysisMetadata = {
      requestedProperties: properties.length,
      processedProperties: propertyDataList.filter(p => !p.error).length,
      failedProperties: propertyDataList.filter(p => p.error).length,
      processingTimeMs: Date.now() - startTime,
      analysisId: this.generateAnalysisId(),
      options
    };

    return portfolioRisk;
  }

  /**
   * Analyze a single property
   */
  async analyzeProperty(identifier) {
    const propertyData = await this.nycDataService.fetchPropertyData(identifier);

    if (propertyData.error) {
      throw new Error(`Failed to fetch property data: ${propertyData.error}`);
    }

    const risk = this.riskEngine.calculatePropertyRisk(propertyData);

    return {
      ...propertyData,
      risk,
      analysisId: this.generateAnalysisId()
    };
  }

  /**
   * Generate exports for a portfolio
   */
  async generateExports(portfolioRisk, exportTypes = ['summary']) {
    const exports = {};

    if (exportTypes.includes('summary') || exportTypes.includes('all')) {
      exports.summary = this.csvExporter.exportPortfolioSummary(portfolioRisk);
    }

    if (exportTypes.includes('violations') || exportTypes.includes('all')) {
      exports.violations = this.csvExporter.exportViolationsReport(portfolioRisk);
    }

    if (exportTypes.includes('permits') || exportTypes.includes('all')) {
      exports.permits = this.csvExporter.exportPermitsReport(portfolioRisk);
    }

    if (exportTypes.includes('recommendations') || exportTypes.includes('all')) {
      exports.recommendations = this.csvExporter.exportRecommendations(portfolioRisk);
    }

    return exports;
  }

  /**
   * Get portfolio trend data for dashboard
   */
  async getPortfolioTrends(portfolioRisk) {
    // Group violations by issue date for trend analysis
    const violationTrends = this.calculateViolationTrends(portfolioRisk);
    const permitTrends = this.calculatePermitTrends(portfolioRisk);
    const riskDistribution = this.calculateRiskDistribution(portfolioRisk);

    return {
      violationTrends,
      permitTrends,
      riskDistribution,
      summary: {
        totalProperties: portfolioRisk.propertyCount,
        averageRiskScore: portfolioRisk.averageRiskScore,
        criticalCount: portfolioRisk.distribution.critical,
        highCount: portfolioRisk.distribution.high,
        totalViolations: portfolioRisk.totals.violations,
        totalPenaltiesOutstanding: portfolioRisk.totals.penalties
      }
    };
  }

  /**
   * Calculate violation trends by month
   */
  calculateViolationTrends(portfolioRisk) {
    const monthlyData = {};
    const now = new Date();

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { dob: 0, ecb: 0, total: 0 };
    }

    // Aggregate violations by month
    for (const property of portfolioRisk.properties) {
      for (const violation of (property.violations || [])) {
        const date = new Date(violation.issue_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          monthlyData[key].dob++;
          monthlyData[key].total++;
        }
      }

      for (const violation of (property.ecbViolations || [])) {
        const date = new Date(violation.issue_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[key]) {
          monthlyData[key].ecb++;
          monthlyData[key].total++;
        }
      }
    }

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data
    }));
  }

  /**
   * Calculate permit trends by month
   */
  calculatePermitTrends(portfolioRisk) {
    const monthlyData = {};
    const now = new Date();

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { approved: 0, expired: 0 };
    }

    // Aggregate permits by month
    for (const property of portfolioRisk.properties) {
      for (const permit of (property.permits || [])) {
        // Approved date
        if (permit.approved_date) {
          const date = new Date(permit.approved_date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyData[key]) {
            monthlyData[key].approved++;
          }
        }

        // Expired date
        if (permit.expired_date) {
          const date = new Date(permit.expired_date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyData[key]) {
            monthlyData[key].expired++;
          }
        }
      }
    }

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data
    }));
  }

  /**
   * Calculate risk distribution for charts
   */
  calculateRiskDistribution(portfolioRisk) {
    const scoreRanges = [
      { label: '0-10', min: 0, max: 10, count: 0, properties: [] },
      { label: '11-25', min: 11, max: 25, count: 0, properties: [] },
      { label: '26-40', min: 26, max: 40, count: 0, properties: [] },
      { label: '41-55', min: 41, max: 55, count: 0, properties: [] },
      { label: '56-70', min: 56, max: 70, count: 0, properties: [] },
      { label: '71-85', min: 71, max: 85, count: 0, properties: [] },
      { label: '86-100', min: 86, max: 100, count: 0, properties: [] }
    ];

    for (const property of portfolioRisk.properties) {
      const score = property.risk.overallScore;
      const range = scoreRanges.find(r => score >= r.min && score <= r.max);
      if (range) {
        range.count++;
        range.properties.push({
          identifier: property.identifier,
          address: property.risk.summary.address,
          score
        });
      }
    }

    return scoreRanges;
  }

  /**
   * Normalize property identifiers
   */
  normalizePropertyList(properties) {
    return properties.map(prop => {
      const original = String(prop).trim();
      const cleaned = original.replace(/[^0-9]/g, '');

      let type = 'unknown';
      if (cleaned.length === 7) {
        type = 'BIN';
      } else if (cleaned.length === 10) {
        type = 'BBL';
      }

      return {
        original,
        cleaned,
        type
      };
    });
  }

  /**
   * Generate unique analysis ID
   */
  generateAnalysisId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CRR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Compare portfolio risk between two analysis periods
   */
  compareAnalyses(currentAnalysis, previousAnalysis) {
    const changes = {
      riskScoreChange: currentAnalysis.averageRiskScore - previousAnalysis.averageRiskScore,
      violationsChange: currentAnalysis.totals.violations - previousAnalysis.totals.violations,
      penaltiesChange: currentAnalysis.totals.penalties - previousAnalysis.totals.penalties,
      propertyChanges: []
    };

    // Find properties in both analyses
    const currentMap = new Map(
      currentAnalysis.properties.map(p => [p.identifier, p])
    );
    const previousMap = new Map(
      previousAnalysis.properties.map(p => [p.identifier, p])
    );

    for (const [id, current] of currentMap) {
      const previous = previousMap.get(id);
      if (previous) {
        const scoreChange = current.risk.overallScore - previous.risk.overallScore;
        if (Math.abs(scoreChange) >= 5) {
          changes.propertyChanges.push({
            identifier: id,
            address: current.risk.summary.address,
            previousScore: previous.risk.overallScore,
            currentScore: current.risk.overallScore,
            change: scoreChange,
            direction: scoreChange > 0 ? 'INCREASED' : 'DECREASED'
          });
        }
      }
    }

    // Sort by absolute change
    changes.propertyChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return changes;
  }
}

module.exports = PortfolioManager;
