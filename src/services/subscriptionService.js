/**
 * Subscription Service
 * Manages subscription-based access for Construction Risk Radar
 */

class SubscriptionService {
  constructor(db = null) {
    this.db = db;
    // In-memory store for demo purposes (replace with database in production)
    this.subscriptions = new Map();
    this.portfolios = new Map();
    this.analysisHistory = new Map();
  }

  /**
   * Subscription tier definitions
   */
  static get TIERS() {
    return {
      BASIC: {
        id: 'basic',
        name: 'Basic',
        price: 49,
        billingPeriod: 'monthly',
        features: {
          maxProperties: 10,
          analysisFrequency: 'weekly',
          csvExports: true,
          dashboardAccess: false,
          apiAccess: false,
          alertsEnabled: false,
          historicalDataMonths: 3,
          supportLevel: 'email'
        }
      },
      PROFESSIONAL: {
        id: 'professional',
        name: 'Professional',
        price: 199,
        billingPeriod: 'monthly',
        features: {
          maxProperties: 50,
          analysisFrequency: 'daily',
          csvExports: true,
          dashboardAccess: true,
          apiAccess: true,
          alertsEnabled: true,
          historicalDataMonths: 12,
          supportLevel: 'priority'
        }
      },
      ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499,
        billingPeriod: 'monthly',
        features: {
          maxProperties: 500,
          analysisFrequency: 'realtime',
          csvExports: true,
          dashboardAccess: true,
          apiAccess: true,
          alertsEnabled: true,
          historicalDataMonths: 36,
          supportLevel: 'dedicated',
          customIntegrations: true,
          whiteLabel: true
        }
      }
    };
  }

  /**
   * Create a new subscription
   */
  async createSubscription(userId, tierId, portfolioProperties = []) {
    const tier = SubscriptionService.TIERS[tierId.toUpperCase()];
    if (!tier) {
      throw new Error(`Invalid subscription tier: ${tierId}`);
    }

    if (portfolioProperties.length > tier.features.maxProperties) {
      throw new Error(
        `Portfolio exceeds maximum properties for ${tier.name} tier (${tier.features.maxProperties})`
      );
    }

    const subscriptionId = this.generateId('SUB');
    const portfolioId = this.generateId('PRT');
    const now = new Date();

    const subscription = {
      id: subscriptionId,
      userId,
      tierId: tier.id,
      tierName: tier.name,
      status: 'active',
      portfolioId,
      createdAt: now.toISOString(),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: this.calculatePeriodEnd(now, tier.billingPeriod),
      features: tier.features,
      price: tier.price,
      billingPeriod: tier.billingPeriod,
      nextAnalysisScheduled: this.calculateNextAnalysis(now, tier.features.analysisFrequency)
    };

    const portfolio = {
      id: portfolioId,
      subscriptionId,
      userId,
      properties: portfolioProperties,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      analysisCount: 0,
      lastAnalysisAt: null
    };

    // Store subscription and portfolio
    this.subscriptions.set(subscriptionId, subscription);
    this.portfolios.set(portfolioId, portfolio);

    return {
      subscription,
      portfolio
    };
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const portfolio = this.portfolios.get(subscription.portfolioId);

    return {
      subscription,
      portfolio,
      analysisHistory: this.getAnalysisHistory(subscription.portfolioId)
    };
  }

  /**
   * Get subscription by user ID
   */
  async getSubscriptionByUser(userId) {
    for (const [, subscription] of this.subscriptions) {
      if (subscription.userId === userId) {
        return this.getSubscription(subscription.id);
      }
    }
    return null;
  }

  /**
   * Update portfolio properties
   */
  async updatePortfolio(portfolioId, properties) {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    const subscription = this.subscriptions.get(portfolio.subscriptionId);
    if (properties.length > subscription.features.maxProperties) {
      throw new Error(
        `Portfolio exceeds maximum properties for ${subscription.tierName} tier (${subscription.features.maxProperties})`
      );
    }

    portfolio.properties = properties;
    portfolio.updatedAt = new Date().toISOString();

    this.portfolios.set(portfolioId, portfolio);

    return portfolio;
  }

  /**
   * Record analysis result
   */
  async recordAnalysis(portfolioId, analysisResult) {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    const subscription = this.subscriptions.get(portfolio.subscriptionId);

    // Create analysis record
    const analysisRecord = {
      id: this.generateId('ANL'),
      portfolioId,
      subscriptionId: portfolio.subscriptionId,
      analysisId: analysisResult.analysisMetadata?.analysisId,
      completedAt: new Date().toISOString(),
      summary: {
        propertyCount: analysisResult.propertyCount,
        averageRiskScore: analysisResult.averageRiskScore,
        portfolioRiskLevel: analysisResult.portfolioRiskLevel,
        distribution: analysisResult.distribution,
        totals: analysisResult.totals
      }
    };

    // Store in history
    if (!this.analysisHistory.has(portfolioId)) {
      this.analysisHistory.set(portfolioId, []);
    }
    const history = this.analysisHistory.get(portfolioId);
    history.push(analysisRecord);

    // Limit history based on tier
    const maxMonths = subscription.features.historicalDataMonths;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - maxMonths);

    const filteredHistory = history.filter(
      record => new Date(record.completedAt) >= cutoffDate
    );
    this.analysisHistory.set(portfolioId, filteredHistory);

    // Update portfolio
    portfolio.analysisCount++;
    portfolio.lastAnalysisAt = analysisRecord.completedAt;
    this.portfolios.set(portfolioId, portfolio);

    // Schedule next analysis
    subscription.nextAnalysisScheduled = this.calculateNextAnalysis(
      new Date(),
      subscription.features.analysisFrequency
    );
    this.subscriptions.set(subscription.id, subscription);

    return analysisRecord;
  }

  /**
   * Get analysis history for portfolio
   */
  getAnalysisHistory(portfolioId, limit = 30) {
    const history = this.analysisHistory.get(portfolioId) || [];
    return history
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, limit);
  }

  /**
   * Check if feature is available for subscription
   */
  async checkFeatureAccess(subscriptionId, feature) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return { allowed: false, reason: 'Subscription not found' };
    }

    if (subscription.status !== 'active') {
      return { allowed: false, reason: 'Subscription is not active' };
    }

    if (new Date(subscription.currentPeriodEnd) < new Date()) {
      return { allowed: false, reason: 'Subscription period has expired' };
    }

    const featureValue = subscription.features[feature];
    if (featureValue === undefined) {
      return { allowed: false, reason: `Unknown feature: ${feature}` };
    }

    return { allowed: !!featureValue, feature, value: featureValue };
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const portfolio = this.portfolios.get(subscription.portfolioId);
    const history = this.getAnalysisHistory(subscription.portfolioId);

    // Calculate analyses in current period
    const periodStart = new Date(subscription.currentPeriodStart);
    const analysesThisPeriod = history.filter(
      h => new Date(h.completedAt) >= periodStart
    ).length;

    return {
      subscriptionId,
      tier: subscription.tierName,
      status: subscription.status,
      currentPeriod: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd
      },
      usage: {
        propertiesUsed: portfolio.properties.length,
        propertiesLimit: subscription.features.maxProperties,
        propertiesPercentage: Math.round(
          (portfolio.properties.length / subscription.features.maxProperties) * 100
        ),
        analysesThisPeriod,
        totalAnalyses: portfolio.analysisCount,
        lastAnalysisAt: portfolio.lastAnalysisAt
      },
      nextScheduledAnalysis: subscription.nextAnalysisScheduled
    };
  }

  /**
   * Upgrade subscription tier
   */
  async upgradeTier(subscriptionId, newTierId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const newTier = SubscriptionService.TIERS[newTierId.toUpperCase()];
    if (!newTier) {
      throw new Error(`Invalid subscription tier: ${newTierId}`);
    }

    // Apply new tier
    subscription.tierId = newTier.id;
    subscription.tierName = newTier.name;
    subscription.features = newTier.features;
    subscription.price = newTier.price;
    subscription.upgradedAt = new Date().toISOString();

    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, reason = '') {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date().toISOString();
    subscription.cancellationReason = reason;

    this.subscriptions.set(subscriptionId, subscription);

    return subscription;
  }

  /**
   * Get subscriptions due for scheduled analysis
   */
  async getSubscriptionsDueForAnalysis() {
    const due = [];
    const now = new Date();

    for (const [, subscription] of this.subscriptions) {
      if (
        subscription.status === 'active' &&
        new Date(subscription.nextAnalysisScheduled) <= now
      ) {
        due.push(subscription);
      }
    }

    return due;
  }

  /**
   * Calculate period end date
   */
  calculatePeriodEnd(startDate, billingPeriod) {
    const end = new Date(startDate);
    switch (billingPeriod) {
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'yearly':
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        end.setMonth(end.getMonth() + 1);
    }
    return end.toISOString();
  }

  /**
   * Calculate next analysis date based on frequency
   */
  calculateNextAnalysis(fromDate, frequency) {
    const next = new Date(fromDate);
    switch (frequency) {
      case 'realtime':
        next.setHours(next.getHours() + 1);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0); // 6 AM
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(6, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(6, 0, 0, 0);
        break;
      default:
        next.setDate(next.getDate() + 7);
    }
    return next.toISOString();
  }

  /**
   * Generate unique ID
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }
}

module.exports = SubscriptionService;
