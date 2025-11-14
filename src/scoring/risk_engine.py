"""
NYC Violation Compliance System - Risk Scoring Engine

Multi-factor risk assessment algorithm for establishments.
Score range: 0-1000
"""

import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from ..models.data_schema import (
    ComplianceRecord,
    RiskScoreBreakdown,
    RiskLevel,
    Urgency,
    Violation
)


class RiskScoringEngine:
    """
    Multi-factor risk assessment using weighted scoring.

    Scoring Components:
    - Critical violations (weight: 150)
    - Repeat offenses (weight: 100)
    - Open hearings (weight: 80)
    - Outstanding fines (weight: 60)
    - Inspection frequency (weight: 40)
    - Violation trend (weight: 70)
    - Time since last inspection (weight: 50)
    - Complaint volume (weight: 50)
    """

    WEIGHTS = {
        'critical_violations': 150,
        'repeat_offenses': 100,
        'open_hearings': 80,
        'outstanding_fines': 60,
        'inspection_frequency': 40,
        'violation_trend': 70,
        'time_since_last': 50,
        'complaint_volume': 50,
    }

    # Risk level thresholds
    RISK_THRESHOLDS = {
        'CRITICAL': 750,
        'HIGH': 500,
        'MEDIUM': 300,
        'LOW': 100,
    }

    # Value estimation parameters
    BASE_VALUE = 500  # Base consultation fee
    CRITICAL_VALUE = 250  # Per critical violation
    HEARING_VALUE = 1500  # Per open hearing
    FINE_VALUE_RATE = 0.15  # 15% of fine as service fee

    def __init__(self):
        self.violation_severity_map = self._load_severity_map()

    def calculate_risk_score(self, record: ComplianceRecord) -> RiskScoreBreakdown:
        """
        Calculate comprehensive risk score with component breakdown

        Args:
            record: ComplianceRecord with establishment data

        Returns:
            RiskScoreBreakdown with detailed scoring information
        """

        # Calculate individual component scores (0-1 scale)
        scores = {
            'critical_violations': self._score_critical_violations(record),
            'repeat_offenses': self._score_repeat_offenses(record),
            'open_hearings': self._score_open_hearings(record),
            'outstanding_fines': self._score_outstanding_fines(record),
            'inspection_frequency': self._score_inspection_frequency(record),
            'violation_trend': self._score_violation_trend(record),
            'time_since_last': self._score_time_since_last(record),
            'complaint_volume': self._score_complaints(record),
        }

        # Apply weights and calculate total
        weighted_score = sum(
            scores[key] * self.WEIGHTS[key]
            for key in scores
        )

        # Cap at 1000
        total_score = min(weighted_score, 1000)

        # Classify risk level
        risk_level = self._classify_risk(total_score)

        # Calculate urgency (separate from risk level)
        urgency = self._calculate_urgency(record)

        # Estimate potential value
        estimated_value = self._estimate_value(record)

        # Build factors dictionary
        factors = self._build_risk_factors(record, scores)

        return RiskScoreBreakdown(
            total_score=total_score,
            component_scores=scores,
            risk_level=risk_level,
            urgency=urgency,
            estimated_conversion_value=estimated_value,
            factors=factors
        )

    def _score_critical_violations(self, record: ComplianceRecord) -> float:
        """
        Score based on critical violations (0-1 scale)

        Recent critical violations indicate immediate health/safety risks
        """
        recent = [v for v in record.violations
                 if v.inspection_date > datetime.now() - timedelta(days=180)]
        critical_count = sum(1 for v in recent if v.critical_flag)

        # Cap at 5 violations for normalization
        return min(critical_count / 5.0, 1.0)

    def _score_repeat_offenses(self, record: ComplianceRecord) -> float:
        """
        Identify and score repeat violation patterns

        Repeat violations indicate systemic compliance issues
        """
        violation_codes = [v.violation_code for v in record.violations]
        repeat_count = len(violation_codes) - len(set(violation_codes))

        # Cap at 10 repeats for normalization
        return min(repeat_count / 10.0, 1.0)

    def _score_open_hearings(self, record: ComplianceRecord) -> float:
        """
        Score based on pending administrative actions

        Open hearings indicate unresolved compliance issues
        """
        if not record.open_hearings:
            return 0.0

        severity_score = 0
        for hearing in record.open_hearings:
            # Older hearings = higher severity
            days_open = hearing.days_open
            severity_score += min(days_open / 365.0, 1.0)

        # Average severity across all hearings
        return min(severity_score / len(record.open_hearings), 1.0)

    def _score_outstanding_fines(self, record: ComplianceRecord) -> float:
        """
        Score based on unpaid fines

        Large outstanding fines indicate financial stress or non-compliance
        """
        if record.outstanding_fines == 0:
            return 0.0

        # Normalize: $10k+ = 1.0
        return min(record.outstanding_fines / 10000.0, 1.0)

    def _score_inspection_frequency(self, record: ComplianceRecord) -> float:
        """
        Frequent inspections indicate persistent issues

        More inspections = more regulatory attention
        """
        # More than 4 inspections/year = 1.0
        return min(record.inspection_count_12mo / 4.0, 1.0)

    def _score_violation_trend(self, record: ComplianceRecord) -> float:
        """
        Analyze violation trajectory over time

        Increasing violations indicate worsening compliance
        """
        recent_6mo = [v for v in record.violations
                      if v.inspection_date > datetime.now() - timedelta(days=180)]
        prior_6mo = [v for v in record.violations
                     if datetime.now() - timedelta(days=365) < v.inspection_date
                     <= datetime.now() - timedelta(days=180)]

        if not prior_6mo:
            return 0.5  # Neutral if no history

        # Calculate trend
        trend = (len(recent_6mo) - len(prior_6mo)) / len(prior_6mo)

        # Clamp to 0-1 range (increasing = higher score)
        return max(0, min(trend, 1.0))

    def _score_time_since_last(self, record: ComplianceRecord) -> float:
        """
        Recent violations = higher urgency

        Fresh violations are more actionable
        """
        if not record.last_inspection:
            return 0.0

        days_since = (datetime.now() - record.last_inspection).days

        # 0 days = 1.0, 365+ days = 0.0
        return max(0, 1.0 - (days_since / 365.0))

    def _score_complaints(self, record: ComplianceRecord) -> float:
        """
        311 complaint volume indicator

        Note: Requires integration with 311 complaints dataset
        """
        # Placeholder: would pull from complaint_volume field
        # TODO: Implement 311 data integration
        return 0.0

    def _classify_risk(self, score: float) -> RiskLevel:
        """Categorize establishments by risk tier"""
        if score >= self.RISK_THRESHOLDS['CRITICAL']:
            return RiskLevel.CRITICAL
        elif score >= self.RISK_THRESHOLDS['HIGH']:
            return RiskLevel.HIGH
        elif score >= self.RISK_THRESHOLDS['MEDIUM']:
            return RiskLevel.MEDIUM
        elif score >= self.RISK_THRESHOLDS['LOW']:
            return RiskLevel.LOW
        return RiskLevel.MINIMAL

    def _calculate_urgency(self, record: ComplianceRecord) -> Urgency:
        """
        Separate urgency from risk level

        Urgency is based on time-sensitive factors
        """
        has_open_hearing = len(record.open_hearings) > 0
        recent_critical = any(
            v.critical_flag and
            v.inspection_date > datetime.now() - timedelta(days=30)
            for v in record.violations
        )

        if recent_critical or has_open_hearing:
            return Urgency.IMMEDIATE
        elif record.last_inspection and record.last_inspection > datetime.now() - timedelta(days=90):
            return Urgency.HIGH
        elif record.last_inspection and record.last_inspection > datetime.now() - timedelta(days=180):
            return Urgency.MODERATE
        return Urgency.LOW

    def _estimate_value(self, record: ComplianceRecord) -> float:
        """
        Estimate potential service value

        Value components:
        - Base consultation fee
        - Critical violation remediation
        - Hearing representation
        - Fine negotiation
        """
        value = self.BASE_VALUE

        # Add value for each critical violation
        critical_value = sum(
            self.CRITICAL_VALUE
            for v in record.violations
            if v.critical_flag
        )
        value += critical_value

        # Add value for open hearings (representation)
        hearing_value = len(record.open_hearings) * self.HEARING_VALUE
        value += hearing_value

        # Add value for outstanding fines (negotiation service)
        fine_value = record.outstanding_fines * self.FINE_VALUE_RATE
        value += fine_value

        return round(value, 2)

    def _build_risk_factors(
        self,
        record: ComplianceRecord,
        scores: Dict[str, float]
    ) -> Dict[str, any]:
        """Build detailed risk factors for reporting"""
        return {
            'critical_count': len(record.critical_violations),
            'repeat_violation_count': len(record.repeat_violations),
            'open_hearing_count': len(record.open_hearings),
            'outstanding_fines_amount': record.outstanding_fines,
            'inspection_count_12mo': record.inspection_count_12mo,
            'days_since_last_inspection': (
                (datetime.now() - record.last_inspection).days
                if record.last_inspection else None
            ),
            'top_violation_codes': self._get_top_violations(record.violations, 3),
        }

    def _get_top_violations(self, violations: List[Violation], n: int) -> List[str]:
        """Get most common violation codes"""
        from collections import Counter

        codes = [v.violation_code for v in violations]
        counter = Counter(codes)
        return [code for code, _ in counter.most_common(n)]

    def _load_severity_map(self) -> Dict[str, int]:
        """
        Load violation code severity mapping

        TODO: Load from database or configuration file
        """
        return {
            '02A': 4,  # Food not protected
            '04L': 4,  # Facility not vermin proof
            '06D': 3,  # Food contact surface not maintained
            '10B': 2,  # Toilet facility not maintained
            # Add more mappings as needed
        }
