"""
NYC Violation Compliance System - Lead Generation Engine

Identifies, scores, and prioritizes leads from compliance data.
"""

import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from collections import Counter
import logging

from ..models.data_schema import (
    Lead, ComplianceRecord, Establishment, Violation,
    Hearing, Fine, LeadStatus, RiskLevel, Urgency
)
from ..scoring.risk_engine import RiskScoringEngine


logger = logging.getLogger(__name__)


class LeadGenerationEngine:
    """
    Identifies, scores, and prioritizes leads based on compliance data

    Features:
    - Multi-factor scoring
    - Intelligent segmentation
    - Priority assignment
    - Contact strategy recommendations
    """

    # Minimum risk score to qualify as a lead
    MIN_RISK_SCORE = 300

    # Lead segments based on priority
    SEGMENTS = {
        'critical_immediate': {'min_priority': 9, 'urgency': [Urgency.IMMEDIATE]},
        'high_value_30day': {'min_priority': 7, 'min_value': 3000},
        'medium_value_nurture': {'min_priority': 5, 'min_value': 1500},
        'low_value_automated': {'min_priority': 3, 'min_value': 500},
    }

    def __init__(self, risk_engine: Optional[RiskScoringEngine] = None):
        """
        Initialize lead generation engine

        Args:
            risk_engine: Optional RiskScoringEngine instance
        """
        self.risk_engine = risk_engine or RiskScoringEngine()

    def generate_leads_from_data(
        self,
        inspections_df: pd.DataFrame,
        hearings_df: Optional[pd.DataFrame] = None,
        fines_df: Optional[pd.DataFrame] = None,
        lookback_days: int = 30,
        min_risk_score: Optional[float] = None
    ) -> List[Lead]:
        """
        Main lead generation workflow from raw data

        Args:
            inspections_df: Inspections DataFrame
            hearings_df: Hearings DataFrame (optional)
            fines_df: Fines DataFrame (optional)
            lookback_days: Days to look back for recent activity
            min_risk_score: Minimum risk score threshold

        Returns:
            List of prioritized leads
        """

        min_score = min_risk_score or self.MIN_RISK_SCORE

        logger.info(f"Generating leads from {len(inspections_df)} inspections")

        # Step 1: Filter recent inspections with violations
        recent_inspections = self._filter_recent_inspections(
            inspections_df,
            lookback_days
        )

        logger.info(f"Found {len(recent_inspections)} recent inspections")

        # Step 2: Group by establishment
        establishments = self._group_by_establishment(recent_inspections)

        logger.info(f"Found {len(establishments)} unique establishments")

        # Step 3: Build compliance records
        compliance_records = []
        for camis, est_data in establishments.items():
            try:
                record = self._build_compliance_record(
                    camis,
                    est_data,
                    hearings_df,
                    fines_df
                )
                compliance_records.append(record)
            except Exception as e:
                logger.error(f"Error building compliance record for {camis}: {e}")

        # Step 4: Score and filter
        scored_leads = []
        for record in compliance_records:
            try:
                risk_data = self.risk_engine.calculate_risk_score(record)

                if risk_data.total_score >= min_score:
                    lead = Lead(
                        record=record,
                        priority=self._calculate_priority(risk_data),
                        estimated_value=risk_data.estimated_conversion_value,
                        contact_attempts=0,
                        status=LeadStatus.PROSPECTING,
                        assigned_to=None,
                        next_action=datetime.now()
                    )
                    scored_leads.append(lead)

            except Exception as e:
                logger.error(f"Error scoring lead for {record.establishment.camis}: {e}")

        logger.info(f"Generated {len(scored_leads)} qualified leads")

        # Step 5: Prioritize and segment
        prioritized_leads = self._prioritize_leads(scored_leads)

        # Step 6: Assign segments
        for lead in prioritized_leads:
            lead.notes = self._assign_segment(lead)

        return prioritized_leads

    def _filter_recent_inspections(
        self,
        df: pd.DataFrame,
        days: int
    ) -> pd.DataFrame:
        """
        Filter for recent inspections with violations

        Args:
            df: Inspections DataFrame
            days: Lookback period in days

        Returns:
            Filtered DataFrame
        """

        # Ensure inspection_date is datetime
        df['inspection_date'] = pd.to_datetime(df['inspection_date'], errors='coerce')

        # Filter for recent
        cutoff_date = datetime.now() - timedelta(days=days)
        recent = df[df['inspection_date'] >= cutoff_date]

        # Filter for violations only
        with_violations = recent[recent['violation_code'].notna()]

        return with_violations

    def _group_by_establishment(
        self,
        df: pd.DataFrame
    ) -> Dict[str, pd.DataFrame]:
        """
        Group inspections by establishment

        Args:
            df: Inspections DataFrame

        Returns:
            Dictionary mapping CAMIS to establishment data
        """

        grouped = {}

        for camis, group in df.groupby('camis'):
            grouped[str(camis)] = group

        return grouped

    def _build_compliance_record(
        self,
        camis: str,
        inspections_df: pd.DataFrame,
        hearings_df: Optional[pd.DataFrame],
        fines_df: Optional[pd.DataFrame]
    ) -> ComplianceRecord:
        """
        Build complete compliance record for establishment

        Args:
            camis: Establishment CAMIS ID
            inspections_df: Inspection records for this establishment
            hearings_df: All hearings data
            fines_df: All fines data

        Returns:
            ComplianceRecord
        """

        # Build establishment object
        first_row = inspections_df.iloc[0]
        establishment = Establishment(
            camis=camis,
            dba=str(first_row.get('dba', '')),
            legal_name=str(first_row.get('legal_name', '')),
            building=str(first_row.get('building', '')),
            street=str(first_row.get('street', '')),
            boro=str(first_row.get('boro', '')),
            zipcode=str(first_row.get('zipcode', '')),
            phone=first_row.get('phone'),
            email=first_row.get('email'),
            cuisine=str(first_row.get('cuisine', '')),
            latitude=first_row.get('latitude'),
            longitude=first_row.get('longitude')
        )

        # Build violations list
        violations = []
        for _, row in inspections_df.iterrows():
            if pd.notna(row.get('violation_code')):
                violation = Violation(
                    violation_code=str(row['violation_code']),
                    description=str(row.get('violation_description', '')),
                    severity=self._map_severity(row.get('critical_flag')),
                    inspection_date=pd.to_datetime(row['inspection_date']),
                    critical_flag=row.get('critical_flag') == 'Critical',
                    score_impact=int(row.get('score', 0)),
                    camis=camis,
                    inspection_type=str(row.get('inspection_type', ''))
                )
                violations.append(violation)

        # Get hearings for this establishment
        open_hearings = []
        if hearings_df is not None and not hearings_df.empty:
            est_hearings = hearings_df[hearings_df['camis'] == camis]
            for _, row in est_hearings.iterrows():
                hearing = Hearing(
                    hearing_id=str(row.get('hearing_id', '')),
                    camis=camis,
                    hearing_date=pd.to_datetime(row['hearing_date']),
                    status=self._map_hearing_status(row.get('hearing_status', 'pending')),
                    violation_details=str(row.get('violation_details', '')),
                    respondent_name=str(row.get('respondent_name', ''))
                )
                open_hearings.append(hearing)

        # Get fines for this establishment
        fines = []
        if fines_df is not None and not fines_df.empty:
            est_fines = fines_df[fines_df['camis'] == camis]
            for _, row in est_fines.iterrows():
                fine = Fine(
                    fine_id=str(row.get('fine_id', '')),
                    camis=camis,
                    fine_amount=float(row.get('fine_amount', 0)),
                    amount_paid=float(row.get('amount_paid', 0)),
                    status=str(row.get('status', 'outstanding'))
                )
                fines.append(fine)

        # Calculate statistics
        last_inspection = inspections_df['inspection_date'].max()
        inspection_count_12mo = len(inspections_df[
            inspections_df['inspection_date'] >= datetime.now() - timedelta(days=365)
        ])

        # Identify repeat violations
        violation_codes = [v.violation_code for v in violations]
        repeat_violations = [code for code, count in Counter(violation_codes).items() if count > 1]

        # Build compliance record
        record = ComplianceRecord(
            establishment=establishment,
            violations=violations,
            open_hearings=open_hearings,
            fines=fines,
            last_inspection=last_inspection,
            inspection_count_12mo=inspection_count_12mo,
            repeat_violations=repeat_violations
        )

        return record

    def _map_severity(self, critical_flag):
        """Map critical flag to severity enum"""
        from ..models.data_schema import ViolationSeverity
        if critical_flag == 'Critical':
            return ViolationSeverity.CRITICAL
        return ViolationSeverity.MODERATE

    def _map_hearing_status(self, status_str):
        """Map hearing status string to enum"""
        from ..models.data_schema import HearingStatus
        status_map = {
            'pending': HearingStatus.PENDING,
            'scheduled': HearingStatus.SCHEDULED,
            'adjudicated': HearingStatus.ADJUDICATED,
            'dismissed': HearingStatus.DISMISSED
        }
        return status_map.get(status_str.lower(), HearingStatus.PENDING)

    def _calculate_priority(self, risk_data) -> int:
        """
        Convert risk score to priority (1-10)

        Args:
            risk_data: RiskScoreBreakdown

        Returns:
            Priority score 1-10
        """

        score = risk_data.total_score
        urgency = risk_data.urgency
        value = risk_data.estimated_conversion_value

        # Base priority from score
        if score >= 750:
            priority = 10
        elif score >= 600:
            priority = 8
        elif score >= 450:
            priority = 6
        elif score >= 300:
            priority = 4
        else:
            priority = 2

        # Boost for urgency
        if urgency == Urgency.IMMEDIATE:
            priority = min(10, priority + 2)
        elif urgency == Urgency.HIGH:
            priority = min(10, priority + 1)

        # Boost for high value
        if value > 5000:
            priority = min(10, priority + 1)

        return priority

    def _prioritize_leads(self, leads: List[Lead]) -> List[Lead]:
        """
        Sort leads by priority and value

        Args:
            leads: List of leads

        Returns:
            Sorted list of leads
        """

        sorted_leads = sorted(
            leads,
            key=lambda x: (x.priority, x.estimated_value),
            reverse=True
        )

        return sorted_leads

    def _assign_segment(self, lead: Lead) -> str:
        """
        Assign lead to a segment

        Args:
            lead: Lead object

        Returns:
            Segment name
        """

        # Critical immediate
        if lead.priority >= 9 and lead.record.urgency == Urgency.IMMEDIATE:
            return 'critical_immediate'

        # High value
        if lead.priority >= 7 and lead.estimated_value >= 3000:
            return 'high_value_30day'

        # Medium value
        if lead.priority >= 5 and lead.estimated_value >= 1500:
            return 'medium_value_nurture'

        # Low value
        return 'low_value_automated'

    def generate_contact_strategy(self, lead: Lead) -> Dict[str, any]:
        """
        Generate recommended contact strategy for lead

        Args:
            lead: Lead object

        Returns:
            Contact strategy dictionary
        """

        segment = self._assign_segment(lead)

        strategies = {
            'critical_immediate': {
                'channels': ['phone', 'email'],
                'frequency': 'daily',
                'max_attempts': 10,
                'message_tone': 'urgent',
                'recommended_offer': 'free_emergency_consultation'
            },
            'high_value_30day': {
                'channels': ['phone', 'email', 'sms'],
                'frequency': 'every_3_days',
                'max_attempts': 8,
                'message_tone': 'professional',
                'recommended_offer': 'compliance_assessment'
            },
            'medium_value_nurture': {
                'channels': ['email', 'sms'],
                'frequency': 'weekly',
                'max_attempts': 5,
                'message_tone': 'educational',
                'recommended_offer': 'violation_guide'
            },
            'low_value_automated': {
                'channels': ['email'],
                'frequency': 'monthly',
                'max_attempts': 3,
                'message_tone': 'informational',
                'recommended_offer': 'newsletter_signup'
            }
        }

        return strategies.get(segment, strategies['low_value_automated'])
