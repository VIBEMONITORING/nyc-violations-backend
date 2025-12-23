"""
Business Rules Engine
Apply business logic for filtering, pricing, and decision-making
"""
from decimal import Decimal
from typing import Dict, List, Optional, Any
from datetime import datetime

from sqlalchemy.orm import Session
from loguru import logger

from python_backend.models.models import BusinessRule, MarketplaceListing, Watch
from python_backend.config.config import settings


class BusinessRulesEngine:
    """
    Execute business rules for pricing, filtering, and decisions
    """

    def __init__(self, db: Session):
        self.db = db
        self.active_rules = self._load_active_rules()

    def apply_pricing_rules(
        self,
        watch_id: int,
        condition: str,
        base_price: Decimal,
        context: Optional[Dict] = None
    ) -> Dict:
        """
        Apply pricing rules to calculate final price and margin

        Args:
            watch_id: Watch ID
            condition: Watch condition
            base_price: Base/cost price
            context: Additional context data

        Returns:
            Dictionary with calculated prices and margins
        """
        context = context or {}

        # Start with base price
        result = {
            'base_price': base_price,
            'recommended_list_price': base_price,
            'minimum_acceptable_price': base_price,
            'margin_percent': Decimal('0'),
            'margin_amount': Decimal('0'),
            'rules_applied': [],
        }

        # Get pricing rules
        pricing_rules = [r for r in self.active_rules if r.rule_type == 'pricing']

        # Sort by priority
        pricing_rules.sort(key=lambda r: r.priority, reverse=True)

        # Apply each rule
        for rule in pricing_rules:
            try:
                if self._rule_matches(rule, watch_id, condition, context):
                    result = self._apply_pricing_rule(rule, result, context)
                    result['rules_applied'].append(rule.rule_name)
            except Exception as e:
                logger.error(f"Error applying rule {rule.rule_name}: {e}")

        # Calculate final margin
        result['margin_amount'] = result['recommended_list_price'] - result['base_price']
        result['margin_percent'] = (
            (result['margin_amount'] / result['base_price']) * 100
            if result['base_price'] > 0 else Decimal('0')
        )

        return result

    def filter_listings(
        self,
        listings: List[MarketplaceListing],
        filter_type: str = 'quality'
    ) -> List[MarketplaceListing]:
        """
        Apply filtering rules to listings

        Args:
            listings: List of marketplace listings
            filter_type: Type of filter ('quality', 'opportunity', etc.)

        Returns:
            Filtered list of listings
        """
        # Get filter rules
        filter_rules = [
            r for r in self.active_rules
            if r.rule_type == 'filter' and filter_type in r.rule_logic.get('filter_types', [filter_type])
        ]

        filtered_listings = listings

        for rule in filter_rules:
            try:
                filtered_listings = self._apply_filter_rule(rule, filtered_listings)
            except Exception as e:
                logger.error(f"Error applying filter rule {rule.rule_name}: {e}")

        return filtered_listings

    def evaluate_opportunity(
        self,
        listing: MarketplaceListing,
        market_data: Dict
    ) -> Dict:
        """
        Evaluate if a listing represents a buying opportunity

        Args:
            listing: Marketplace listing
            market_data: Market analysis data

        Returns:
            Opportunity evaluation dictionary
        """
        evaluation = {
            'is_opportunity': False,
            'opportunity_score': Decimal('0'),
            'reasons': [],
            'warnings': [],
            'recommended_action': 'pass',
        }

        # Get opportunity rules
        opp_rules = [r for r in self.active_rules if r.rule_type == 'opportunity']

        for rule in opp_rules:
            try:
                rule_result = self._evaluate_opportunity_rule(rule, listing, market_data)
                if rule_result['matches']:
                    evaluation['is_opportunity'] = True
                    evaluation['opportunity_score'] += rule_result.get('score', Decimal('0'))
                    evaluation['reasons'].extend(rule_result.get('reasons', []))
            except Exception as e:
                logger.error(f"Error evaluating opportunity rule {rule.rule_name}: {e}")

        # Determine recommended action
        if evaluation['opportunity_score'] >= Decimal('80'):
            evaluation['recommended_action'] = 'strong_buy'
        elif evaluation['opportunity_score'] >= Decimal('60'):
            evaluation['recommended_action'] = 'buy'
        elif evaluation['opportunity_score'] >= Decimal('40'):
            evaluation['recommended_action'] = 'consider'
        else:
            evaluation['recommended_action'] = 'pass'

        return evaluation

    def calculate_margin_target(
        self,
        brand: str,
        reference_number: str,
        condition: str
    ) -> Decimal:
        """
        Calculate target margin percentage based on business rules

        Args:
            brand: Watch brand
            reference_number: Watch reference
            condition: Watch condition

        Returns:
            Target margin percentage
        """
        # Start with default margin
        target_margin = Decimal(str(settings.DEFAULT_MARGIN_PERCENT))

        # Get margin rules
        margin_rules = [
            r for r in self.active_rules
            if r.rule_type == 'pricing' and 'margin' in r.rule_logic
        ]

        context = {
            'brand': brand,
            'reference_number': reference_number,
            'condition': condition,
        }

        for rule in margin_rules:
            try:
                if self._rule_matches_context(rule, context):
                    rule_margin = Decimal(str(rule.rule_logic.get('margin_percent', 0)))
                    if rule_margin > 0:
                        target_margin = rule_margin
            except Exception as e:
                logger.error(f"Error calculating margin from rule {rule.rule_name}: {e}")

        return target_margin

    # Helper methods

    def _load_active_rules(self) -> List[BusinessRule]:
        """Load all active rules from database"""
        try:
            rules = self.db.query(BusinessRule).filter(
                BusinessRule.is_active == True
            ).order_by(BusinessRule.priority.desc()).all()
            logger.info(f"Loaded {len(rules)} active business rules")
            return rules
        except Exception as e:
            logger.error(f"Error loading business rules: {e}")
            return []

    def _rule_matches(
        self,
        rule: BusinessRule,
        watch_id: int,
        condition: str,
        context: Dict
    ) -> bool:
        """Check if rule matches given context"""
        logic = rule.rule_logic

        # Check brand filter
        if 'brand_filter' in logic:
            watch = self.db.query(Watch).filter(Watch.id == watch_id).first()
            if watch and watch.brand:
                brand_name = watch.brand.name.lower()
                filter_brands = [b.lower() for b in logic['brand_filter']]
                if brand_name not in filter_brands:
                    return False

        # Check condition filter
        if 'condition_filter' in logic:
            if condition.lower() not in [c.lower() for c in logic['condition_filter']]:
                return False

        # Check additional context filters
        if 'require_context' in logic:
            for key in logic['require_context']:
                if key not in context:
                    return False

        return True

    def _rule_matches_context(self, rule: BusinessRule, context: Dict) -> bool:
        """Check if rule matches context dictionary"""
        logic = rule.rule_logic

        # Check brand
        if 'brand_filter' in logic:
            brand = context.get('brand', '').lower()
            if brand not in [b.lower() for b in logic['brand_filter']]:
                return False

        # Check condition
        if 'condition_filter' in logic:
            condition = context.get('condition', '').lower()
            if condition not in [c.lower() for c in logic['condition_filter']]:
                return False

        return True

    def _apply_pricing_rule(
        self,
        rule: BusinessRule,
        current_result: Dict,
        context: Dict
    ) -> Dict:
        """Apply a single pricing rule"""
        logic = rule.rule_logic
        result = current_result.copy()

        # Apply margin percentage
        if 'margin_percent' in logic:
            margin_percent = Decimal(str(logic['margin_percent']))
            result['recommended_list_price'] = (
                result['base_price'] * (Decimal('1') + margin_percent / Decimal('100'))
            )

        # Apply fixed markup
        if 'fixed_markup' in logic:
            markup = Decimal(str(logic['fixed_markup']))
            result['recommended_list_price'] = result['base_price'] + markup

        # Apply minimum price
        if 'minimum_price' in logic:
            min_price = Decimal(str(logic['minimum_price']))
            result['minimum_acceptable_price'] = max(
                result['minimum_acceptable_price'],
                min_price
            )

        # Apply price ceiling
        if 'maximum_price' in logic:
            max_price = Decimal(str(logic['maximum_price']))
            result['recommended_list_price'] = min(
                result['recommended_list_price'],
                max_price
            )

        # Apply dynamic pricing based on market conditions
        if 'dynamic_pricing' in logic and 'market_trend' in context:
            trend = context['market_trend']
            if trend == 'increasing':
                # Increase price by adjustment factor
                adjustment = Decimal(str(logic['dynamic_pricing'].get('trend_adjustment', 5)))
                result['recommended_list_price'] *= (Decimal('1') + adjustment / Decimal('100'))
            elif trend == 'decreasing':
                # Decrease price for faster sale
                adjustment = Decimal(str(logic['dynamic_pricing'].get('trend_adjustment', 5)))
                result['recommended_list_price'] *= (Decimal('1') - adjustment / Decimal('100'))

        return result

    def _apply_filter_rule(
        self,
        rule: BusinessRule,
        listings: List[MarketplaceListing]
    ) -> List[MarketplaceListing]:
        """Apply a filter rule to listings"""
        logic = rule.rule_logic
        filtered = listings

        # Filter by minimum seller trust score
        if 'min_seller_trust_score' in logic:
            min_score = Decimal(str(logic['min_seller_trust_score']))
            filtered = [
                l for l in filtered
                if l.seller.trust_score and l.seller.trust_score >= min_score
            ]

        # Filter by condition
        if 'allowed_conditions' in logic:
            allowed = [c.lower() for c in logic['allowed_conditions']]
            filtered = [
                l for l in filtered
                if l.condition and l.condition.lower() in allowed
            ]

        # Filter by year range
        if 'min_year' in logic:
            min_year = int(logic['min_year'])
            filtered = [l for l in filtered if l.year and l.year >= min_year]

        if 'max_year' in logic:
            max_year = int(logic['max_year'])
            filtered = [l for l in filtered if l.year and l.year <= max_year]

        # Filter by price range
        if 'min_price' in logic:
            min_price = Decimal(str(logic['min_price']))
            filtered = [l for l in filtered if l.price_usd >= min_price]

        if 'max_price' in logic:
            max_price = Decimal(str(logic['max_price']))
            filtered = [l for l in filtered if l.price_usd <= max_price]

        # Filter requiring box and papers
        if logic.get('require_box', False):
            filtered = [l for l in filtered if l.has_box == True]

        if logic.get('require_papers', False):
            filtered = [l for l in filtered if l.has_papers == True]

        return filtered

    def _evaluate_opportunity_rule(
        self,
        rule: BusinessRule,
        listing: MarketplaceListing,
        market_data: Dict
    ) -> Dict:
        """Evaluate a single opportunity rule"""
        logic = rule.rule_logic
        result = {
            'matches': False,
            'score': Decimal('0'),
            'reasons': [],
        }

        # Price below market average
        if 'below_average_percent' in logic:
            threshold = Decimal(str(logic['below_average_percent']))
            avg_price = market_data.get('average_price_usd')

            if avg_price:
                discount = ((avg_price - listing.price_usd) / avg_price) * 100
                if discount >= threshold:
                    result['matches'] = True
                    result['score'] += Decimal('30')
                    result['reasons'].append(f"Price {discount:.1f}% below market average")

        # High seller trust score
        if 'min_seller_trust' in logic:
            min_trust = Decimal(str(logic['min_seller_trust']))
            if listing.seller.trust_score and listing.seller.trust_score >= min_trust:
                result['score'] += Decimal('20')
                result['reasons'].append(f"High seller trust score: {listing.seller.trust_score}")

        # Recent listing (fresh inventory)
        if logic.get('prefer_recent', False):
            if listing.listing_date:
                days_old = (datetime.utcnow().date() - listing.listing_date).days
                if days_old <= 7:
                    result['score'] += Decimal('10')
                    result['reasons'].append("Recently listed")

        # Full set (box and papers)
        if logic.get('bonus_for_full_set', False):
            if listing.has_box and listing.has_papers:
                result['score'] += Decimal('15')
                result['reasons'].append("Full set (box + papers)")

        # Excellent condition
        if listing.condition in ['new', 'unworn']:
            result['score'] += Decimal('15')
            result['reasons'].append(f"Excellent condition: {listing.condition}")

        return result


def create_default_rules(db: Session):
    """Create default business rules"""
    default_rules = [
        {
            'rule_name': 'Premium Brand Higher Margin',
            'rule_type': 'pricing',
            'rule_logic': {
                'brand_filter': ['Rolex', 'Patek Philippe', 'Audemars Piguet'],
                'margin_percent': 25,
            },
            'priority': 10,
        },
        {
            'rule_name': 'New Condition Premium',
            'rule_type': 'pricing',
            'rule_logic': {
                'condition_filter': ['new', 'unworn'],
                'margin_percent': 22,
            },
            'priority': 8,
        },
        {
            'rule_name': 'High Quality Filter',
            'rule_type': 'filter',
            'rule_logic': {
                'filter_types': ['quality'],
                'min_seller_trust_score': 0.8,
                'allowed_conditions': ['new', 'unworn', 'very-good'],
                'min_year': 2018,
            },
            'priority': 5,
        },
        {
            'rule_name': 'Strong Opportunity',
            'rule_type': 'opportunity',
            'rule_logic': {
                'below_average_percent': 15,
                'min_seller_trust': 0.75,
                'prefer_recent': True,
                'bonus_for_full_set': True,
            },
            'priority': 10,
        },
        {
            'rule_name': 'Vintage Watch Margin',
            'rule_type': 'pricing',
            'rule_logic': {
                'max_year': 2000,
                'margin_percent': 30,
            },
            'priority': 7,
        },
    ]

    for rule_data in default_rules:
        existing = db.query(BusinessRule).filter(
            BusinessRule.rule_name == rule_data['rule_name']
        ).first()

        if not existing:
            rule = BusinessRule(**rule_data)
            db.add(rule)

    db.commit()
    logger.info(f"Created {len(default_rules)} default business rules")
