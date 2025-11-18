const logger = require('../config/logger');
const OpportunityScore = require('../models/OpportunityScore');

class OpportunityScorer {
  constructor(config = {}) {
    this.config = {
      weights: {
        profitMargin: 0.35,
        resourceAvailability: 0.25,
        competition: 0.25,
        clientRelationship: 0.15
      },
      // Company-specific parameters
      avgMarginRate: config.avgMarginRate || 0.25, // 25% margin
      resourceUtilization: config.resourceUtilization || 0.70, // 70% utilized
      knownClients: config.knownClients || [],
      competitorCount: config.competitorCount || 5,
      ...config
    };
  }

  /**
   * Score a single opportunity
   */
  async scoreOpportunity(opportunity) {
    const profitMarginScore = this.scoreProfitMargin(opportunity);
    const resourceScore = this.scoreResourceAvailability(opportunity);
    const competitionScore = this.scoreCompetition(opportunity);
    const clientScore = this.scoreClientRelationship(opportunity);

    const totalScore = (
      profitMarginScore * this.config.weights.profitMargin +
      resourceScore * this.config.weights.resourceAvailability +
      competitionScore * this.config.weights.competition +
      clientScore * this.config.weights.clientRelationship
    );

    const estimatedRevenue = this.estimateRevenue(opportunity);
    const requiredResources = this.estimateRequiredResources(opportunity);
    const recommendedAction = this.recommendAction(totalScore, opportunity);

    const scoreData = {
      opportunity_id: opportunity.id,
      total_score: Math.round(totalScore * 10) / 10,
      profit_margin_score: Math.round(profitMarginScore * 10) / 10,
      resource_availability_score: Math.round(resourceScore * 10) / 10,
      competition_score: Math.round(competitionScore * 10) / 10,
      client_relationship_score: Math.round(clientScore * 10) / 10,
      scoring_notes: this.generateNotes(opportunity, totalScore),
      recommended_action: recommendedAction,
      estimated_revenue: estimatedRevenue,
      required_resources: requiredResources
    };

    // Save to database
    await OpportunityScore.create(scoreData);

    return scoreData;
  }

  /**
   * Score multiple opportunities
   */
  async scoreOpportunities(opportunities) {
    logger.info(`Scoring ${opportunities.length} opportunities...`);
    const scores = [];

    for (const opportunity of opportunities) {
      try {
        const score = await this.scoreOpportunity(opportunity);
        scores.push(score);
      } catch (error) {
        logger.error(`Error scoring opportunity ${opportunity.id}:`, error);
      }
    }

    logger.info(`Scored ${scores.length} opportunities`);
    return scores;
  }

  /**
   * Score profit margin potential (1-10)
   */
  scoreProfitMargin(opportunity) {
    const projectValue = opportunity.project_value || 200000;
    const duration = opportunity.monitoring_duration || 6;

    // Higher value projects with reasonable duration score better
    let score = 5;

    // Project value factor
    if (projectValue >= 1000000) score += 3;
    else if (projectValue >= 500000) score += 2;
    else if (projectValue >= 250000) score += 1;
    else if (projectValue < 150000) score -= 1;

    // Duration factor (sweet spot is 6-18 months)
    if (duration >= 6 && duration <= 18) score += 2;
    else if (duration > 18 && duration <= 36) score += 1;
    else if (duration > 36) score -= 1;

    // Distance factor (closer = lower mobilization costs)
    if (opportunity.distance_miles) {
      if (opportunity.distance_miles <= 25) score += 1;
      else if (opportunity.distance_miles > 75) score -= 1;
    }

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Score resource availability (1-10)
   */
  scoreResourceAvailability(opportunity) {
    const duration = opportunity.monitoring_duration || 6;
    let score = 5;

    // Longer projects require more resource commitment
    if (duration <= 6) score += 2; // Short projects easier to staff
    else if (duration > 12) score -= 1;

    // Current utilization factor
    const availableCapacity = 1 - this.config.resourceUtilization;
    if (availableCapacity > 0.4) score += 2; // Plenty of capacity
    else if (availableCapacity > 0.25) score += 1;
    else if (availableCapacity < 0.15) score -= 2;

    // Technical requirements complexity
    const requirements = opportunity.technical_requirements || [];
    if (requirements.length > 5) score -= 1; // Complex = harder to staff
    if (requirements.length <= 2) score += 1; // Simple = easier to staff

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Score competition level (1-10, higher = less competition)
   */
  scoreCompetition(opportunity) {
    let score = 5;

    // Specialized requirements = less competition
    const requirements = opportunity.technical_requirements || [];
    const specializedKeywords = ['geotechnical', 'structural', 'environmental', 'seismic'];
    const hasSpecialized = requirements.some(req =>
      specializedKeywords.some(kw => req.toLowerCase().includes(kw))
    );

    if (hasSpecialized) score += 2;

    // Project size affects competition
    const projectValue = opportunity.project_value || 200000;
    if (projectValue > 2000000) score -= 1; // Large projects attract more competition
    if (projectValue < 300000) score += 1; // Smaller projects fewer large competitors

    // Location affects competition (more remote = less competition)
    if (opportunity.distance_miles) {
      if (opportunity.distance_miles > 60) score += 2;
      else if (opportunity.distance_miles > 40) score += 1;
    }

    // Short deadlines = less competition
    if (opportunity.deadline_date) {
      const deadline = new Date(opportunity.deadline_date);
      const daysUntilDeadline = (deadline - new Date()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 14) score += 2;
      else if (daysUntilDeadline < 30) score += 1;
    }

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Score client relationship (1-10)
   */
  scoreClientRelationship(opportunity) {
    let score = 5;

    const clientName = (opportunity.client_name || '').toLowerCase();

    // Check if known client
    const isKnownClient = this.config.knownClients.some(known =>
      clientName.includes(known.toLowerCase())
    );

    if (isKnownClient) {
      score += 4; // Significant boost for existing clients
    }

    // Government agencies are predictable clients
    const govKeywords = ['department', 'authority', 'commission', 'agency'];
    if (govKeywords.some(kw => clientName.includes(kw))) {
      score += 1;
    }

    // DOT clients are ideal for I&M work
    if (clientName.includes('dot') || clientName.includes('transportation')) {
      score += 1;
    }

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Estimate revenue potential
   */
  estimateRevenue(opportunity) {
    const projectValue = opportunity.project_value || 200000;
    const estimatedRevenue = projectValue * this.config.avgMarginRate;
    return Math.round(estimatedRevenue);
  }

  /**
   * Estimate required resources
   */
  estimateRequiredResources(opportunity) {
    const duration = opportunity.monitoring_duration || 6;
    const requirements = opportunity.technical_requirements || [];

    // Estimate team size based on project value and duration
    const projectValue = opportunity.project_value || 200000;
    let teamSize = 2;

    if (projectValue > 1000000) teamSize = 5;
    else if (projectValue > 500000) teamSize = 3;

    return {
      teamSize,
      duration,
      roles: this.estimateRoles(requirements),
      equipment: this.estimateEquipment(requirements)
    };
  }

  estimateRoles(requirements) {
    const roles = ['Project Manager', 'Field Inspector'];

    if (requirements.some(r => r.toLowerCase().includes('geotechnical'))) {
      roles.push('Geotechnical Engineer');
    }
    if (requirements.some(r => r.toLowerCase().includes('structural'))) {
      roles.push('Structural Engineer');
    }
    if (requirements.some(r => r.toLowerCase().includes('environmental'))) {
      roles.push('Environmental Specialist');
    }
    if (requirements.some(r => r.toLowerCase().includes('survey'))) {
      roles.push('Land Surveyor');
    }

    return roles;
  }

  estimateEquipment(requirements) {
    const equipment = ['Standard Testing Equipment'];

    if (requirements.some(r => r.toLowerCase().includes('survey'))) {
      equipment.push('Survey Equipment (GPS, Total Station)');
    }
    if (requirements.some(r => r.toLowerCase().includes('geotechnical'))) {
      equipment.push('Soil Testing Equipment');
    }
    if (requirements.some(r => r.toLowerCase().includes('materials'))) {
      equipment.push('Materials Testing Lab');
    }

    return equipment;
  }

  /**
   * Recommend bid/no-bid decision
   */
  recommendAction(score, opportunity) {
    if (score >= 8) return 'STRONG BID';
    if (score >= 6.5) return 'BID';
    if (score >= 5) return 'CONSIDER';
    return 'NO BID';
  }

  /**
   * Generate scoring notes
   */
  generateNotes(opportunity, score) {
    const notes = [];

    if (score >= 8) {
      notes.push('Excellent opportunity - high priority');
    } else if (score >= 6.5) {
      notes.push('Good opportunity - recommend pursuing');
    } else if (score >= 5) {
      notes.push('Moderate opportunity - evaluate capacity');
    } else {
      notes.push('Low priority - focus on higher-scoring opportunities');
    }

    if (opportunity.distance_miles && opportunity.distance_miles > 75) {
      notes.push('High travel costs due to distance');
    }

    if (opportunity.project_value && opportunity.project_value > 1000000) {
      notes.push('Large project - significant revenue potential');
    }

    if (opportunity.deadline_date) {
      const deadline = new Date(opportunity.deadline_date);
      const daysUntilDeadline = (deadline - new Date()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 14) {
        notes.push('Urgent - short deadline for proposal');
      }
    }

    return notes.join('. ');
  }
}

module.exports = OpportunityScorer;
