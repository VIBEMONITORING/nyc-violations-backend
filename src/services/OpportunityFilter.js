const { getDistance } = require('geolib');
const logger = require('../config/logger');

class OpportunityFilter {
  constructor(config = {}) {
    this.config = {
      minProjectValue: config.minProjectValue || 100000,
      minMonitoringDuration: config.minMonitoringDuration || 3, // months
      maxDistance: config.maxDistance || 100, // miles
      baseLocation: config.baseLocation || {
        latitude: 40.7128, // NYC coordinates
        longitude: -74.0060
      },
      requiredKeywords: config.requiredKeywords || [
        'monitoring', 'inspection', 'testing', 'quality control',
        'compliance', 'survey', 'geotechnical', 'structural'
      ]
    };
  }

  /**
   * Filter opportunities based on criteria
   */
  filter(opportunities) {
    logger.info(`Filtering ${opportunities.length} opportunities...`);

    const filtered = opportunities.filter(opp => {
      return this.meetsProjectValue(opp) &&
             this.meetsDuration(opp) &&
             this.meetsDistance(opp) &&
             this.meetsTechnicalRequirements(opp);
    });

    logger.info(`${filtered.length} opportunities passed filters`);
    return filtered;
  }

  /**
   * Check if project value meets minimum
   */
  meetsProjectValue(opportunity) {
    if (!opportunity.project_value) {
      // If no value specified, estimate from context or pass through
      return true;
    }

    return opportunity.project_value >= this.config.minProjectValue;
  }

  /**
   * Check if monitoring duration meets minimum
   */
  meetsDuration(opportunity) {
    if (!opportunity.monitoring_duration) {
      // If no duration specified, pass through for manual review
      return true;
    }

    return opportunity.monitoring_duration >= this.config.minMonitoringDuration;
  }

  /**
   * Check if location is within acceptable distance
   */
  meetsDistance(opportunity) {
    if (!opportunity.latitude || !opportunity.longitude) {
      // If no coordinates, pass through for manual review
      return true;
    }

    const distance = this.calculateDistance(
      opportunity.latitude,
      opportunity.longitude
    );

    // Convert meters to miles
    const distanceMiles = distance / 1609.34;

    // Update the opportunity with calculated distance
    opportunity.distance_miles = Math.round(distanceMiles * 10) / 10;

    return distanceMiles <= this.config.maxDistance;
  }

  /**
   * Check if technical requirements match
   */
  meetsTechnicalRequirements(opportunity) {
    const text = [
      opportunity.title || '',
      opportunity.description || '',
      ...(opportunity.technical_requirements || [])
    ].join(' ').toLowerCase();

    // Check if any required keyword is present
    return this.config.requiredKeywords.some(keyword =>
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Calculate distance between opportunity and base location
   */
  calculateDistance(lat, lon) {
    try {
      return getDistance(
        { latitude: this.config.baseLocation.latitude, longitude: this.config.baseLocation.longitude },
        { latitude: lat, longitude: lon }
      );
    } catch (error) {
      logger.error('Error calculating distance:', error);
      return 0;
    }
  }

  /**
   * Get filter statistics
   */
  getFilterStats(opportunities, filtered) {
    const failed = opportunities.filter(opp => !filtered.includes(opp));

    return {
      total: opportunities.length,
      passed: filtered.length,
      failed: failed.length,
      passRate: ((filtered.length / opportunities.length) * 100).toFixed(2) + '%',
      failReasons: this.categorizeFailures(failed)
    };
  }

  categorizeFailures(failed) {
    const reasons = {
      projectValue: 0,
      duration: 0,
      distance: 0,
      technicalRequirements: 0
    };

    failed.forEach(opp => {
      if (!this.meetsProjectValue(opp)) reasons.projectValue++;
      if (!this.meetsDuration(opp)) reasons.duration++;
      if (!this.meetsDistance(opp)) reasons.distance++;
      if (!this.meetsTechnicalRequirements(opp)) reasons.technicalRequirements++;
    });

    return reasons;
  }
}

module.exports = OpportunityFilter;
