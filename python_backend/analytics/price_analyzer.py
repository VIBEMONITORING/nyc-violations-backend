"""
Price Trend Analysis Module
Analyzes price trends, detects opportunities, and calculates optimal pricing
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from loguru import logger

from python_backend.models.models import (
    Watch, PriceHistory, MarketplaceListing,
    PriceCalculation, Seller
)
from python_backend.config.config import settings


class PriceAnalyzer:
    """
    Analyze price trends and identify opportunities
    """

    def __init__(self, db: Session):
        self.db = db
        self.min_data_points = settings.MIN_DATA_POINTS_FOR_ANALYSIS
        self.opportunity_threshold = settings.PRICE_OPPORTUNITY_THRESHOLD

    def analyze_watch_pricing(
        self,
        watch_id: int,
        condition: Optional[str] = None,
        days_back: int = 30
    ) -> Dict:
        """
        Comprehensive price analysis for a specific watch

        Args:
            watch_id: Watch ID
            condition: Optional condition filter
            days_back: Number of days of history to analyze

        Returns:
            Dictionary with analysis results
        """
        # Get watch details
        watch = self.db.query(Watch).filter(Watch.id == watch_id).first()
        if not watch:
            raise ValueError(f"Watch {watch_id} not found")

        # Get price history
        since_date = datetime.utcnow() - timedelta(days=days_back)

        query = self.db.query(PriceHistory).filter(
            and_(
                PriceHistory.watch_id == watch_id,
                PriceHistory.recorded_at >= since_date
            )
        )

        if condition:
            query = query.filter(PriceHistory.condition == condition)

        price_records = query.order_by(PriceHistory.recorded_at).all()

        if len(price_records) < self.min_data_points:
            logger.warning(f"Insufficient data points for watch {watch_id}")
            return self._insufficient_data_response(watch)

        # Convert to DataFrame for analysis
        df = self._records_to_dataframe(price_records)

        # Perform analysis
        analysis = {
            'watch_id': watch_id,
            'reference_number': watch.reference_number,
            'brand': watch.brand.name if watch.brand else None,
            'condition': condition,
            'analysis_period_days': days_back,
            'data_points': len(price_records),
            'current_stats': self._calculate_current_stats(df),
            'trend': self._calculate_trend(df),
            'price_delta': self._calculate_price_delta(df),
            'volatility': self._calculate_volatility(df),
            'recommendation': None,
            'confidence_score': None,
        }

        # Generate recommendation
        analysis['recommendation'] = self._generate_recommendation(analysis)
        analysis['confidence_score'] = self._calculate_confidence(analysis)

        # Save to database
        self._save_calculation(watch_id, condition, analysis)

        return analysis

    def find_buying_opportunities(
        self,
        brand: Optional[str] = None,
        max_results: int = 50
    ) -> List[Dict]:
        """
        Find watches currently priced below market average

        Args:
            brand: Optional brand filter
            max_results: Maximum number of opportunities to return

        Returns:
            List of opportunity dictionaries
        """
        opportunities = []

        # Get active listings
        query = self.db.query(MarketplaceListing).filter(
            and_(
                MarketplaceListing.is_active == True,
                MarketplaceListing.last_seen >= datetime.utcnow() - timedelta(hours=24)
            )
        )

        if brand:
            query = query.join(Watch).join(Watch.brand).filter(
                func.lower(Watch.brand.name) == brand.lower()
            )

        listings = query.limit(max_results * 2).all()  # Get more to filter

        for listing in listings:
            try:
                # Get average price for this watch
                avg_price = self._get_average_price(
                    listing.watch_id,
                    listing.condition
                )

                if not avg_price:
                    continue

                # Calculate discount
                discount_percent = ((avg_price - listing.price_usd) / avg_price) * 100

                if discount_percent >= self.opportunity_threshold:
                    opportunity = {
                        'listing_id': listing.id,
                        'watch_id': listing.watch_id,
                        'reference_number': listing.watch.reference_number,
                        'brand': listing.watch.brand.name if listing.watch.brand else None,
                        'current_price_usd': float(listing.price_usd),
                        'average_price_usd': float(avg_price),
                        'discount_percent': float(discount_percent),
                        'condition': listing.condition,
                        'marketplace': listing.marketplace,
                        'seller_trust_score': float(listing.seller.trust_score) if listing.seller.trust_score else None,
                        'listing_url': listing.listing_url,
                        'last_seen': listing.last_seen,
                    }
                    opportunities.append(opportunity)

            except Exception as e:
                logger.error(f"Error analyzing listing {listing.id}: {e}")
                continue

        # Sort by discount percentage
        opportunities.sort(key=lambda x: x['discount_percent'], reverse=True)

        return opportunities[:max_results]

    def calculate_recommended_pricing(
        self,
        watch_id: int,
        condition: str,
        target_margin_percent: Optional[Decimal] = None
    ) -> Dict:
        """
        Calculate recommended listing price with desired margin

        Args:
            watch_id: Watch ID
            condition: Watch condition
            target_margin_percent: Desired profit margin (default from settings)

        Returns:
            Pricing recommendation dictionary
        """
        if target_margin_percent is None:
            target_margin_percent = Decimal(str(settings.DEFAULT_MARGIN_PERCENT))

        # Get current market stats
        floor_price = self._get_floor_price(watch_id, condition)
        avg_price = self._get_average_price(watch_id, condition)
        ceiling_price = self._get_ceiling_price(watch_id, condition)

        if not avg_price:
            return {'error': 'Insufficient market data'}

        # Calculate recommended price
        # Use average price as baseline, adjusted for margin
        recommended_buy_price = avg_price * (Decimal('1.0') - (target_margin_percent / Decimal('100')))
        recommended_list_price = avg_price * (Decimal('1.05'))  # List slightly above average

        return {
            'watch_id': watch_id,
            'condition': condition,
            'floor_price_usd': float(floor_price) if floor_price else None,
            'average_price_usd': float(avg_price),
            'ceiling_price_usd': float(ceiling_price) if ceiling_price else None,
            'recommended_buy_price': float(recommended_buy_price),
            'recommended_list_price': float(recommended_list_price),
            'target_margin_percent': float(target_margin_percent),
            'expected_profit': float(recommended_list_price - recommended_buy_price),
        }

    def detect_price_drops(
        self,
        hours_back: int = 24,
        min_drop_percent: Decimal = Decimal('5.0')
    ) -> List[Dict]:
        """
        Detect recent price drops

        Args:
            hours_back: Hours to look back
            min_drop_percent: Minimum drop percentage to report

        Returns:
            List of price drop events
        """
        since_time = datetime.utcnow() - timedelta(hours=hours_back)
        price_drops = []

        # Get listings that have price history
        listings = self.db.query(MarketplaceListing).filter(
            and_(
                MarketplaceListing.is_active == True,
                MarketplaceListing.updated_at >= since_time
            )
        ).all()

        for listing in listings:
            try:
                # Get previous price
                prev_prices = self.db.query(PriceHistory).filter(
                    and_(
                        PriceHistory.marketplace_listing_id == listing.id,
                        PriceHistory.recorded_at < since_time
                    )
                ).order_by(PriceHistory.recorded_at.desc()).limit(1).all()

                if not prev_prices:
                    continue

                prev_price = prev_prices[0].price_usd
                current_price = listing.price_usd

                if prev_price and current_price:
                    drop_percent = ((prev_price - current_price) / prev_price) * 100

                    if drop_percent >= min_drop_percent:
                        price_drops.append({
                            'listing_id': listing.id,
                            'watch_id': listing.watch_id,
                            'reference_number': listing.watch.reference_number,
                            'previous_price_usd': float(prev_price),
                            'current_price_usd': float(current_price),
                            'drop_amount_usd': float(prev_price - current_price),
                            'drop_percent': float(drop_percent),
                            'marketplace': listing.marketplace,
                            'listing_url': listing.listing_url,
                            'detected_at': datetime.utcnow(),
                        })

            except Exception as e:
                logger.error(f"Error detecting price drop for listing {listing.id}: {e}")
                continue

        # Sort by drop percentage
        price_drops.sort(key=lambda x: x['drop_percent'], reverse=True)

        return price_drops

    # Helper methods

    def _records_to_dataframe(self, records: List[PriceHistory]) -> pd.DataFrame:
        """Convert price history records to pandas DataFrame"""
        data = [{
            'recorded_at': r.recorded_at,
            'price_usd': float(r.price_usd),
            'marketplace': r.marketplace,
            'seller_trust_score': float(r.seller_trust_score) if r.seller_trust_score else None,
        } for r in records]

        df = pd.DataFrame(data)
        df['recorded_at'] = pd.to_datetime(df['recorded_at'])
        df = df.sort_values('recorded_at')
        return df

    def _calculate_current_stats(self, df: pd.DataFrame) -> Dict:
        """Calculate current price statistics"""
        return {
            'floor_price': float(df['price_usd'].min()),
            'ceiling_price': float(df['price_usd'].max()),
            'average_price': float(df['price_usd'].mean()),
            'median_price': float(df['price_usd'].median()),
            'std_deviation': float(df['price_usd'].std()),
            'latest_price': float(df['price_usd'].iloc[-1]),
        }

    def _calculate_trend(self, df: pd.DataFrame) -> Dict:
        """Calculate price trend (increasing, decreasing, stable)"""
        # Simple linear regression
        df = df.copy()
        df['days'] = (df['recorded_at'] - df['recorded_at'].min()).dt.total_seconds() / 86400

        if len(df) < 2:
            return {'direction': 'unknown', 'slope': 0}

        # Calculate slope
        slope = np.polyfit(df['days'], df['price_usd'], 1)[0]

        # Determine direction
        if abs(slope) < 10:  # Less than $10/day change
            direction = 'stable'
        elif slope > 0:
            direction = 'increasing'
        else:
            direction = 'decreasing'

        return {
            'direction': direction,
            'slope': float(slope),
            'daily_change_usd': float(slope),
        }

    def _calculate_price_delta(self, df: pd.DataFrame) -> Dict:
        """Calculate price change over period"""
        if len(df) < 2:
            return {'change_usd': 0, 'change_percent': 0}

        first_price = df['price_usd'].iloc[0]
        latest_price = df['price_usd'].iloc[-1]

        change_usd = latest_price - first_price
        change_percent = (change_usd / first_price) * 100 if first_price > 0 else 0

        return {
            'change_usd': float(change_usd),
            'change_percent': float(change_percent),
            'first_price': float(first_price),
            'latest_price': float(latest_price),
        }

    def _calculate_volatility(self, df: pd.DataFrame) -> Dict:
        """Calculate price volatility"""
        # Coefficient of variation
        mean_price = df['price_usd'].mean()
        std_price = df['price_usd'].std()

        cv = (std_price / mean_price) * 100 if mean_price > 0 else 0

        # Classify volatility
        if cv < 5:
            volatility_level = 'low'
        elif cv < 15:
            volatility_level = 'medium'
        else:
            volatility_level = 'high'

        return {
            'coefficient_of_variation': float(cv),
            'volatility_level': volatility_level,
            'price_range': float(df['price_usd'].max() - df['price_usd'].min()),
        }

    def _generate_recommendation(self, analysis: Dict) -> str:
        """Generate buying/selling recommendation"""
        trend_direction = analysis['trend']['direction']
        price_delta_percent = analysis['price_delta']['change_percent']
        volatility = analysis['volatility']['volatility_level']

        if trend_direction == 'decreasing' and price_delta_percent < -5:
            if volatility == 'low':
                return 'strong_buy'
            return 'buy'
        elif trend_direction == 'increasing' and price_delta_percent > 5:
            return 'hold_or_sell'
        elif volatility == 'low':
            return 'stable_market'
        elif volatility == 'high':
            return 'wait_for_stability'
        else:
            return 'monitor'

    def _calculate_confidence(self, analysis: Dict) -> Decimal:
        """Calculate confidence score for analysis"""
        score = Decimal('0.5')  # Base score

        # More data points = higher confidence
        data_points = analysis['data_points']
        if data_points >= 50:
            score += Decimal('0.3')
        elif data_points >= 20:
            score += Decimal('0.2')
        elif data_points >= 10:
            score += Decimal('0.1')

        # Low volatility = higher confidence
        if analysis['volatility']['volatility_level'] == 'low':
            score += Decimal('0.2')
        elif analysis['volatility']['volatility_level'] == 'medium':
            score += Decimal('0.1')

        return min(score, Decimal('1.0'))

    def _get_floor_price(self, watch_id: int, condition: Optional[str]) -> Optional[Decimal]:
        """Get floor price for watch"""
        query = self.db.query(func.min(MarketplaceListing.price_usd)).filter(
            and_(
                MarketplaceListing.watch_id == watch_id,
                MarketplaceListing.is_active == True,
                MarketplaceListing.last_seen >= datetime.utcnow() - timedelta(days=7)
            )
        )

        if condition:
            query = query.filter(MarketplaceListing.condition == condition)

        result = query.scalar()
        return Decimal(str(result)) if result else None

    def _get_average_price(self, watch_id: int, condition: Optional[str]) -> Optional[Decimal]:
        """Get average price for watch"""
        query = self.db.query(func.avg(MarketplaceListing.price_usd)).filter(
            and_(
                MarketplaceListing.watch_id == watch_id,
                MarketplaceListing.is_active == True,
                MarketplaceListing.last_seen >= datetime.utcnow() - timedelta(days=7)
            )
        )

        if condition:
            query = query.filter(MarketplaceListing.condition == condition)

        result = query.scalar()
        return Decimal(str(result)) if result else None

    def _get_ceiling_price(self, watch_id: int, condition: Optional[str]) -> Optional[Decimal]:
        """Get ceiling price for watch"""
        query = self.db.query(func.max(MarketplaceListing.price_usd)).filter(
            and_(
                MarketplaceListing.watch_id == watch_id,
                MarketplaceListing.is_active == True,
                MarketplaceListing.last_seen >= datetime.utcnow() - timedelta(days=7)
            )
        )

        if condition:
            query = query.filter(MarketplaceListing.condition == condition)

        result = query.scalar()
        return Decimal(str(result)) if result else None

    def _insufficient_data_response(self, watch: Watch) -> Dict:
        """Return response when insufficient data"""
        return {
            'watch_id': watch.id,
            'reference_number': watch.reference_number,
            'error': 'Insufficient data for analysis',
            'min_required_data_points': self.min_data_points,
        }

    def _save_calculation(self, watch_id: int, condition: Optional[str], analysis: Dict):
        """Save price calculation to database"""
        try:
            calculation = PriceCalculation(
                watch_id=watch_id,
                condition=condition,
                floor_price_usd=Decimal(str(analysis['current_stats']['floor_price'])),
                avg_price_usd=Decimal(str(analysis['current_stats']['average_price'])),
                ceiling_price_usd=Decimal(str(analysis['current_stats']['ceiling_price'])),
                data_points_count=analysis['data_points'],
                confidence_score=analysis['confidence_score'],
                calculated_at=datetime.utcnow(),
                valid_until=datetime.utcnow() + timedelta(hours=24),
            )
            self.db.add(calculation)
            self.db.commit()
        except Exception as e:
            logger.error(f"Error saving price calculation: {e}")
            self.db.rollback()
