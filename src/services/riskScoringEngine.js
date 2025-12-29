/**
 * Construction Risk Radar - Risk Scoring Engine
 *
 * Quantitative risk assessment based on:
 * - Number and severity of open violations
 * - Age of active permits
 * - Status of filings (completed/incomplete)
 */

const { DATASETS } = require('../config/datasets');

class RiskScoringEngine {
  constructor() {
    // Weight configuration for risk factors
    this.weights = {
      violations: {
        dobViolations: 0.35,      // 35% weight for DOB violations
        ecbViolations: 0.35,      // 35% weight for ECB violations
        violationAge: 0.15,       // 15% weight for violation age
        repeatViolations: 0.15   // 15% weight for repeat violations
      },
      permits: {
        expiredPermits: 0.40,     // 40% weight for expired permits
        permitAge: 0.30,          // 30% weight for permit age
        incompleteFilings: 0.30   // 30% weight for incomplete filings
      },
      overall: {
        violationsScore: 0.60,    // 60% of overall score from violations
        permitsScore: 0.40        // 40% of overall score from permits
      }
    };

    // Risk thresholds
    this.thresholds = {
      low: { min: 0, max: 25 },
      medium: { min: 26, max: 50 },
      high: { min: 51, max: 75 },
      critical: { min: 76, max: 100 }
    };

    // Time-based decay factors (in days)
    this.agingFactors = {
      violations: {
        recent: { days: 90, multiplier: 1.5 },      // < 90 days: +50%
        moderate: { days: 365, multiplier: 1.0 },   // 90-365 days: normal
        old: { days: 730, multiplier: 0.8 },        // 1-2 years: -20%
        veryOld: { days: Infinity, multiplier: 0.5 } // > 2 years: -50%
      },
      permits: {
        expiredRecent: { days: 30, multiplier: 1.5 },   // Expired < 30 days
        expiredModerate: { days: 180, multiplier: 1.2 }, // Expired 1-6 months
        expiredOld: { days: 365, multiplier: 1.0 }       // Expired > 6 months
      }
    };
  }

  /**
   * Calculate comprehensive risk score for a property
   */
  calculatePropertyRisk(propertyData) {
    const { permits, violations, ecbViolations } = propertyData;

    // Calculate component scores
    const violationsScore = this.calculateViolationsScore(violations, ecbViolations);
    const permitsScore = this.calculatePermitsScore(permits);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (violationsScore.total * this.weights.overall.violationsScore) +
      (permitsScore.total * this.weights.overall.permitsScore)
    );

    // Determine risk level
    const riskLevel = this.getRiskLevel(overallScore);

    return {
      overallScore,
      riskLevel,
      components: {
        violations: violationsScore,
        permits: permitsScore
      },
      summary: this.generateRiskSummary(propertyData, overallScore, riskLevel),
      recommendations: this.generateRecommendations(violationsScore, permitsScore),
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Calculate violations score
   */
  calculateViolationsScore(dobViolations = [], ecbViolations = []) {
    // DOB Violations scoring
    const dobScore = this.scoreDOBViolations(dobViolations);

    // ECB Violations scoring
    const ecbScore = this.scoreECBViolations(ecbViolations);

    // Violation age factor
    const allViolations = [...dobViolations, ...ecbViolations];
    const ageFactor = this.calculateViolationAgeFactor(allViolations);

    // Repeat violation factor
    const repeatFactor = this.calculateRepeatViolationFactor(allViolations);

    // Calculate weighted total
    const total = Math.min(100, Math.round(
      (dobScore.score * this.weights.violations.dobViolations) +
      (ecbScore.score * this.weights.violations.ecbViolations) +
      (ageFactor * this.weights.violations.violationAge) +
      (repeatFactor * this.weights.violations.repeatViolations)
    ));

    return {
      total,
      dob: dobScore,
      ecb: ecbScore,
      ageFactor,
      repeatFactor,
      totalViolations: allViolations.length
    };
  }

  /**
   * Score DOB violations based on severity
   */
  scoreDOBViolations(violations) {
    if (!violations || violations.length === 0) {
      return { score: 0, count: 0, bySeverity: {} };
    }

    const severityMapping = DATASETS.DOB_VIOLATIONS_ACTIVE.severityMapping;
    const bySeverity = {};
    let totalWeight = 0;

    for (const violation of violations) {
      const typeCode = violation.violation_type_code || violation.violation_type || 'Unknown';
      const severityInfo = severityMapping[typeCode] || { level: 2, weight: 2 };

      bySeverity[severityInfo.level] = (bySeverity[severityInfo.level] || 0) + 1;
      totalWeight += severityInfo.weight;
    }

    // Score calculation: base score from count + severity weighting
    // Max score of 100 achieved with 10+ severe violations
    const baseScore = Math.min(50, violations.length * 5);
    const severityScore = Math.min(50, totalWeight * 2);
    const score = Math.min(100, baseScore + severityScore);

    return {
      score,
      count: violations.length,
      bySeverity,
      averageSeverity: totalWeight / violations.length
    };
  }

  /**
   * Score ECB violations based on severity and penalties
   */
  scoreECBViolations(violations) {
    if (!violations || violations.length === 0) {
      return { score: 0, count: 0, totalPenalties: 0, totalDue: 0 };
    }

    const severityMapping = DATASETS.DOB_ECB_VIOLATIONS.severityMapping;
    let totalWeight = 0;
    let totalPenalties = 0;
    let totalDue = 0;
    const bySeverity = {};

    for (const violation of violations) {
      const severity = violation.severity || 'Unknown';
      const severityInfo = severityMapping[severity] || { level: 2, weight: 2 };

      bySeverity[severityInfo.level] = (bySeverity[severityInfo.level] || 0) + 1;
      totalWeight += severityInfo.weight;

      // Parse penalty amounts
      const penalty = parseFloat(violation.penality_imposed) || 0;
      const amountDue = parseFloat(violation.amount_due) || 0;
      totalPenalties += penalty;
      totalDue += amountDue;
    }

    // Score calculation
    const countScore = Math.min(40, violations.length * 4);
    const severityScore = Math.min(30, totalWeight * 1.5);
    const penaltyScore = Math.min(30, (totalDue / 1000) * 3); // $10k+ due = max penalty score

    const score = Math.min(100, countScore + severityScore + penaltyScore);

    return {
      score,
      count: violations.length,
      bySeverity,
      totalPenalties,
      totalDue,
      averageSeverity: totalWeight / violations.length
    };
  }

  /**
   * Calculate age factor for violations
   */
  calculateViolationAgeFactor(violations) {
    if (!violations || violations.length === 0) return 0;

    const now = new Date();
    let recentCount = 0;
    let totalAgeDays = 0;

    for (const violation of violations) {
      const issueDate = new Date(violation.issue_date);
      const ageDays = Math.floor((now - issueDate) / (1000 * 60 * 60 * 24));
      totalAgeDays += ageDays;

      if (ageDays <= 90) recentCount++;
    }

    const avgAge = totalAgeDays / violations.length;
    const recentRatio = recentCount / violations.length;

    // Recent violations increase risk significantly
    let ageFactor = 50; // Base score

    if (avgAge < 90) {
      ageFactor = 100; // Very recent = high risk
    } else if (avgAge < 365) {
      ageFactor = 75;
    } else if (avgAge < 730) {
      ageFactor = 50;
    } else {
      ageFactor = 25;
    }

    // Boost if many recent violations
    ageFactor = Math.min(100, ageFactor + (recentRatio * 30));

    return Math.round(ageFactor);
  }

  /**
   * Calculate repeat violation factor
   */
  calculateRepeatViolationFactor(violations) {
    if (!violations || violations.length === 0) return 0;

    // Group by violation type
    const typeGroups = {};
    for (const violation of violations) {
      const type = violation.violation_type_code || violation.violation_type || 'Unknown';
      typeGroups[type] = (typeGroups[type] || 0) + 1;
    }

    // Find repeat violations (same type > 1)
    const repeatTypes = Object.values(typeGroups).filter(count => count > 1);
    const totalRepeats = repeatTypes.reduce((sum, count) => sum + (count - 1), 0);

    // Score based on repeat count
    return Math.min(100, totalRepeats * 15);
  }

  /**
   * Calculate permits score
   */
  calculatePermitsScore(permits = []) {
    if (!permits || permits.length === 0) {
      return { total: 0, expired: 0, aging: 0, incomplete: 0, count: 0 };
    }

    const now = new Date();
    let expiredCount = 0;
    let incompleteCount = 0;
    let totalAgeDays = 0;
    let expiredDays = 0;

    for (const permit of permits) {
      const issuedDate = new Date(permit.issued_date || permit.approved_date);
      const expiredDate = permit.expired_date ? new Date(permit.expired_date) : null;
      const status = (permit.permit_status || '').toLowerCase();

      // Check expiration
      if (expiredDate && expiredDate < now) {
        expiredCount++;
        expiredDays += Math.floor((now - expiredDate) / (1000 * 60 * 60 * 24));
      }

      // Check completion status
      if (status !== 'complete' && status !== 'signed off' && status !== 'closed') {
        incompleteCount++;
      }

      // Calculate age
      const ageDays = Math.floor((now - issuedDate) / (1000 * 60 * 60 * 24));
      totalAgeDays += ageDays;
    }

    // Expired permits score
    const expiredScore = Math.min(100, expiredCount * 20);

    // Permit aging score (old permits without completion are risky)
    const avgAge = totalAgeDays / permits.length;
    let agingScore = 0;
    if (avgAge > 365 * 2) {
      agingScore = 80;
    } else if (avgAge > 365) {
      agingScore = 50;
    } else if (avgAge > 180) {
      agingScore = 25;
    }

    // Incomplete filings score
    const incompleteScore = Math.min(100, (incompleteCount / permits.length) * 100);

    // Calculate weighted total
    const total = Math.round(
      (expiredScore * this.weights.permits.expiredPermits) +
      (agingScore * this.weights.permits.permitAge) +
      (incompleteScore * this.weights.permits.incompleteFilings)
    );

    return {
      total: Math.min(100, total),
      expired: expiredScore,
      aging: agingScore,
      incomplete: incompleteScore,
      count: permits.length,
      expiredCount,
      incompleteCount,
      avgAgeDays: Math.round(avgAge)
    };
  }

  /**
   * Get risk level from score
   */
  getRiskLevel(score) {
    if (score <= this.thresholds.low.max) return 'LOW';
    if (score <= this.thresholds.medium.max) return 'MEDIUM';
    if (score <= this.thresholds.high.max) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Generate risk summary
   */
  generateRiskSummary(propertyData, score, level) {
    const { permits = [], violations = [], ecbViolations = [] } = propertyData;

    return {
      propertyIdentifier: propertyData.identifier,
      riskScore: score,
      riskLevel: level,
      totalPermits: permits.length,
      totalDOBViolations: violations.length,
      totalECBViolations: ecbViolations.length,
      totalViolations: violations.length + ecbViolations.length,
      address: this.extractAddress(propertyData),
      highlightIssues: this.identifyHighlightIssues(propertyData)
    };
  }

  /**
   * Extract address from property data
   */
  extractAddress(propertyData) {
    const source = propertyData.permits?.[0] ||
                   propertyData.violations?.[0] ||
                   propertyData.ecbViolations?.[0] || {};

    const houseNumber = source.house_no || source.house_number || '';
    const street = source.street_name || source.street || '';
    const borough = source.borough || source.boro || '';

    return `${houseNumber} ${street}, ${borough}`.trim() || 'Unknown Address';
  }

  /**
   * Identify highlight issues
   */
  identifyHighlightIssues(propertyData) {
    const issues = [];
    const { permits = [], violations = [], ecbViolations = [] } = propertyData;

    // Check for immediately hazardous violations
    const hazardousViolations = violations.filter(v =>
      (v.violation_type_code || '').includes('HAZ') ||
      (v.violation_type_code || '').includes('EGNCY') ||
      (v.violation_type_code || '').includes('UB')
    );
    if (hazardousViolations.length > 0) {
      issues.push({
        type: 'CRITICAL',
        message: `${hazardousViolations.length} hazardous/emergency violation(s) present`,
        count: hazardousViolations.length
      });
    }

    // Check for significant ECB penalties
    const totalDue = ecbViolations.reduce((sum, v) => sum + (parseFloat(v.amount_due) || 0), 0);
    if (totalDue > 10000) {
      issues.push({
        type: 'HIGH',
        message: `Outstanding ECB penalties: $${totalDue.toLocaleString()}`,
        amount: totalDue
      });
    }

    // Check for expired permits
    const now = new Date();
    const expiredPermits = permits.filter(p =>
      p.expired_date && new Date(p.expired_date) < now
    );
    if (expiredPermits.length > 0) {
      issues.push({
        type: 'MEDIUM',
        message: `${expiredPermits.length} expired permit(s)`,
        count: expiredPermits.length
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on risk factors
   */
  generateRecommendations(violationsScore, permitsScore) {
    const recommendations = [];

    // Violations-based recommendations
    if (violationsScore.total > 75) {
      recommendations.push({
        priority: 'URGENT',
        category: 'Violations',
        action: 'Immediately address all outstanding DOB and ECB violations',
        rationale: 'Critical violation risk level detected'
      });
    } else if (violationsScore.total > 50) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Violations',
        action: 'Develop remediation plan for outstanding violations within 30 days',
        rationale: 'High violation risk level detected'
      });
    }

    if (violationsScore.ecb?.totalDue > 5000) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Financial',
        action: 'Address outstanding ECB penalties to prevent additional fines',
        rationale: `$${violationsScore.ecb.totalDue.toLocaleString()} in penalties outstanding`
      });
    }

    if (violationsScore.repeatFactor > 50) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Compliance',
        action: 'Implement systemic compliance improvements for repeat violations',
        rationale: 'Pattern of repeat violations detected'
      });
    }

    // Permits-based recommendations
    if (permitsScore.expiredCount > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Permits',
        action: 'Renew or close out expired construction permits',
        rationale: `${permitsScore.expiredCount} expired permit(s) detected`
      });
    }

    if (permitsScore.avgAgeDays > 730) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Permits',
        action: 'Review status of long-standing permits and complete required inspections',
        rationale: 'Permits averaging over 2 years old'
      });
    }

    return recommendations;
  }

  /**
   * Calculate portfolio-wide risk metrics
   */
  calculatePortfolioRisk(propertiesData) {
    const propertyRisks = propertiesData.map(property => ({
      ...property,
      risk: this.calculatePropertyRisk(property)
    }));

    // Aggregate statistics
    const scores = propertyRisks.map(p => p.risk.overallScore);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // Risk distribution
    const distribution = {
      critical: propertyRisks.filter(p => p.risk.riskLevel === 'CRITICAL').length,
      high: propertyRisks.filter(p => p.risk.riskLevel === 'HIGH').length,
      medium: propertyRisks.filter(p => p.risk.riskLevel === 'MEDIUM').length,
      low: propertyRisks.filter(p => p.risk.riskLevel === 'LOW').length
    };

    // Total violations and penalties
    const totals = propertyRisks.reduce((acc, p) => ({
      violations: acc.violations + (p.violations?.length || 0) + (p.ecbViolations?.length || 0),
      permits: acc.permits + (p.permits?.length || 0),
      penalties: acc.penalties + (p.risk.components.violations.ecb?.totalDue || 0)
    }), { violations: 0, permits: 0, penalties: 0 });

    // Identify top risk properties
    const topRiskProperties = [...propertyRisks]
      .sort((a, b) => b.risk.overallScore - a.risk.overallScore)
      .slice(0, 10);

    return {
      propertyCount: propertiesData.length,
      averageRiskScore: avgScore,
      maxRiskScore: maxScore,
      minRiskScore: minScore,
      portfolioRiskLevel: this.getRiskLevel(avgScore),
      distribution,
      totals,
      topRiskProperties: topRiskProperties.map(p => ({
        identifier: p.identifier,
        address: p.risk.summary.address,
        score: p.risk.overallScore,
        level: p.risk.riskLevel
      })),
      properties: propertyRisks,
      calculatedAt: new Date().toISOString()
    };
  }
}

module.exports = RiskScoringEngine;
