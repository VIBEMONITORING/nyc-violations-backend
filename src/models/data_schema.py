"""
NYC Violation Compliance System - Core Data Models

This module defines the unified data model for establishments, violations,
compliance records, and leads.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class ViolationSeverity(Enum):
    """Violation severity levels"""
    CRITICAL = 4      # Public health hazard
    MAJOR = 3         # Significant non-compliance
    MODERATE = 2      # Standard violation
    MINOR = 1         # Administrative


class HearingStatus(Enum):
    """Hearing status types"""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    ADJUDICATED = "adjudicated"
    DISMISSED = "dismissed"


class LeadStatus(Enum):
    """Lead pipeline stages"""
    PROSPECTING = "prospecting"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class RiskLevel(Enum):
    """Risk classification tiers"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    MINIMAL = "MINIMAL"


class Urgency(Enum):
    """Urgency levels for action"""
    IMMEDIATE = "IMMEDIATE"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"


@dataclass
class Establishment:
    """Restaurant/food establishment entity"""
    camis: str  # Unique ID
    dba: str  # Doing Business As name
    legal_name: str
    building: str
    street: str
    boro: str
    zipcode: str
    phone: Optional[str] = None
    email: Optional[str] = None
    cuisine: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @property
    def location(self) -> Optional[tuple[float, float]]:
        """Get (lat, lon) tuple"""
        if self.latitude and self.longitude:
            return (self.latitude, self.longitude)
        return None

    @property
    def full_address(self) -> str:
        """Get formatted full address"""
        return f"{self.building} {self.street}, {self.boro}, NY {self.zipcode}"


@dataclass
class Violation:
    """Individual violation record"""
    violation_code: str
    description: str
    severity: ViolationSeverity
    inspection_date: datetime
    critical_flag: bool
    score_impact: int
    camis: str
    inspection_type: Optional[str] = None
    record_date: Optional[datetime] = None

    def is_recent(self, days: int = 180) -> bool:
        """Check if violation is recent"""
        delta = datetime.now() - self.inspection_date
        return delta.days <= days


@dataclass
class Hearing:
    """Administrative hearing record"""
    hearing_id: str
    camis: str
    hearing_date: datetime
    hearing_time: Optional[str] = None
    status: HearingStatus = HearingStatus.PENDING
    violation_details: str = ""
    respondent_name: str = ""
    hearing_result: Optional[str] = None
    penalty_amount: float = 0.0

    @property
    def days_open(self) -> int:
        """Calculate days since hearing date"""
        return (datetime.now() - self.hearing_date).days


@dataclass
class Fine:
    """Outstanding fine record"""
    fine_id: str
    camis: str
    fine_amount: float
    amount_paid: float = 0.0
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: str = "outstanding"

    @property
    def balance(self) -> float:
        """Calculate outstanding balance"""
        return max(0, self.fine_amount - self.amount_paid)

    @property
    def is_overdue(self) -> bool:
        """Check if fine is past due"""
        if self.due_date:
            return datetime.now() > self.due_date
        return False


@dataclass
class ComplianceRecord:
    """Complete compliance profile for an establishment"""
    establishment: Establishment
    violations: List[Violation] = field(default_factory=list)
    open_hearings: List[Hearing] = field(default_factory=list)
    fines: List[Fine] = field(default_factory=list)
    risk_score: float = 0.0
    risk_level: RiskLevel = RiskLevel.MINIMAL
    urgency: Urgency = Urgency.LOW
    compliance_status: str = "compliant"
    last_inspection: Optional[datetime] = None
    inspection_count_12mo: int = 0
    repeat_violations: List[str] = field(default_factory=list)

    @property
    def outstanding_fines(self) -> float:
        """Calculate total outstanding fines"""
        return sum(fine.balance for fine in self.fines)

    @property
    def critical_violations(self) -> List[Violation]:
        """Get all critical violations"""
        return [v for v in self.violations if v.critical_flag]

    @property
    def recent_violations(self, days: int = 180) -> List[Violation]:
        """Get violations from recent period"""
        return [v for v in self.violations if v.is_recent(days)]


@dataclass
class Lead:
    """Sales lead with prioritization"""
    record: ComplianceRecord
    priority: int  # 1-10 scale
    estimated_value: float
    contact_attempts: int = 0
    status: LeadStatus = LeadStatus.PROSPECTING
    assigned_to: Optional[str] = None
    next_action: Optional[datetime] = None
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    last_contact_date: Optional[datetime] = None

    @property
    def camis(self) -> str:
        """Get establishment ID"""
        return self.record.establishment.camis

    @property
    def establishment_name(self) -> str:
        """Get establishment name"""
        return self.record.establishment.dba

    def can_contact(self) -> bool:
        """Check if lead can be contacted"""
        if self.status == LeadStatus.CONVERTED or self.status == LeadStatus.LOST:
            return False
        return True


@dataclass
class RiskScoreBreakdown:
    """Detailed risk score component breakdown"""
    total_score: float
    component_scores: Dict[str, float]
    risk_level: RiskLevel
    urgency: Urgency
    estimated_conversion_value: float
    factors: Dict[str, any] = field(default_factory=dict)

    def get_top_risk_factors(self, n: int = 3) -> List[tuple[str, float]]:
        """Get top N risk contributing factors"""
        sorted_components = sorted(
            self.component_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_components[:n]
