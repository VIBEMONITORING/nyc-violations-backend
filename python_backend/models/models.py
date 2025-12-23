"""
SQLAlchemy ORM Models for Luxury Watch Pricing Intelligence Engine
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, JSON, BigInteger, func
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Brand(Base):
    __tablename__ = 'brands'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watches = relationship("Watch", back_populates="brand", cascade="all, delete-orphan")


class Watch(Base):
    __tablename__ = 'watches'

    id = Column(Integer, primary_key=True)
    brand_id = Column(Integer, ForeignKey('brands.id', ondelete='CASCADE'))
    reference_number = Column(String(100), nullable=False)
    model = Column(String(200))
    case_material = Column(String(100))
    dial_color = Column(String(100))
    movement = Column(String(100))
    case_diameter = Column(String(50))
    water_resistance = Column(String(50))
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    brand = relationship("Brand", back_populates="watches")
    marketplace_listings = relationship("MarketplaceListing", back_populates="watch", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="watch", cascade="all, delete-orphan")
    parsed_messages = relationship("ParsedMessage", back_populates="watch")
    price_alerts = relationship("PriceAlert", back_populates="watch", cascade="all, delete-orphan")
    price_calculations = relationship("PriceCalculation", back_populates="watch", cascade="all, delete-orphan")


class Seller(Base):
    __tablename__ = 'sellers'

    id = Column(Integer, primary_key=True)
    marketplace = Column(String(50), nullable=False)
    seller_id = Column(String(200), nullable=False)
    seller_name = Column(String(200))
    trust_score = Column(Numeric(3, 2))
    total_sales = Column(Integer, default=0)
    positive_feedback_percent = Column(Numeric(5, 2))
    location_country = Column(String(100))
    location_region = Column(String(100))
    verified = Column(Boolean, default=False)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    marketplace_listings = relationship("MarketplaceListing", back_populates="seller", cascade="all, delete-orphan")


class MarketplaceListing(Base):
    __tablename__ = 'marketplace_listings'

    id = Column(Integer, primary_key=True)
    watch_id = Column(Integer, ForeignKey('watches.id', ondelete='CASCADE'))
    seller_id = Column(Integer, ForeignKey('sellers.id', ondelete='CASCADE'))
    marketplace = Column(String(50), nullable=False)
    listing_url = Column(Text)
    title = Column(Text)
    price_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    price_usd = Column(Numeric(12, 2))
    condition = Column(String(50))
    year = Column(Integer)
    has_box = Column(Boolean)
    has_papers = Column(Boolean)
    warranty_months = Column(Integer)
    shipping_cost = Column(Numeric(10, 2))
    shipping_currency = Column(String(10))
    listing_date = Column(Date)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watch = relationship("Watch", back_populates="marketplace_listings")
    seller = relationship("Seller", back_populates="marketplace_listings")
    price_history = relationship("PriceHistory", back_populates="marketplace_listing")
    alert_history = relationship("AlertHistory", back_populates="marketplace_listing")


class PriceHistory(Base):
    __tablename__ = 'price_history'

    id = Column(BigInteger, primary_key=True)
    watch_id = Column(Integer, ForeignKey('watches.id', ondelete='CASCADE'))
    marketplace_listing_id = Column(Integer, ForeignKey('marketplace_listings.id', ondelete='SET NULL'))
    marketplace = Column(String(50), nullable=False)
    price_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), nullable=False)
    price_usd = Column(Numeric(12, 2))
    condition = Column(String(50))
    seller_trust_score = Column(Numeric(3, 2))
    location_country = Column(String(100))
    recorded_at = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON, default={})

    watch = relationship("Watch", back_populates="price_history")
    marketplace_listing = relationship("MarketplaceListing", back_populates="price_history")


class ParsedMessage(Base):
    __tablename__ = 'parsed_messages'

    id = Column(Integer, primary_key=True)
    source = Column(String(50), nullable=False)
    message_id = Column(String(200))
    sender = Column(String(200))
    raw_message = Column(Text, nullable=False)
    parsed_data = Column(JSON, nullable=False)
    watch_id = Column(Integer, ForeignKey('watches.id', ondelete='SET NULL'))
    reference_number = Column(String(100))
    year = Column(Integer)
    condition = Column(String(50))
    price_amount = Column(Numeric(12, 2))
    currency = Column(String(10))
    price_usd = Column(Numeric(12, 2))
    confidence_score = Column(Numeric(3, 2))
    is_processed = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watch = relationship("Watch", back_populates="parsed_messages")


class PriceAlert(Base):
    __tablename__ = 'price_alerts'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    watch_id = Column(Integer, ForeignKey('watches.id', ondelete='CASCADE'))
    reference_number = Column(String(100))
    alert_type = Column(String(50), nullable=False)
    threshold_amount = Column(Numeric(12, 2))
    threshold_currency = Column(String(10))
    percentage_drop = Column(Integer)
    condition_filter = Column(String(50))
    marketplace_filter = Column(String(50))
    notification_channels = Column(JSON, default=["email"])
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watch = relationship("Watch", back_populates="price_alerts")
    alert_history = relationship("AlertHistory", back_populates="alert", cascade="all, delete-orphan")


class AlertHistory(Base):
    __tablename__ = 'alert_history'

    id = Column(BigInteger, primary_key=True)
    alert_id = Column(Integer, ForeignKey('price_alerts.id', ondelete='CASCADE'))
    marketplace_listing_id = Column(Integer, ForeignKey('marketplace_listings.id', ondelete='SET NULL'))
    trigger_type = Column(String(50))
    price_amount = Column(Numeric(12, 2))
    currency = Column(String(10))
    message = Column(Text)
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(JSON)
    triggered_at = Column(DateTime, default=datetime.utcnow)

    alert = relationship("PriceAlert", back_populates="alert_history")
    marketplace_listing = relationship("MarketplaceListing", back_populates="alert_history")


class BusinessRule(Base):
    __tablename__ = 'business_rules'

    id = Column(Integer, primary_key=True)
    rule_name = Column(String(100), unique=True, nullable=False)
    rule_type = Column(String(50), nullable=False)
    rule_logic = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceCalculation(Base):
    __tablename__ = 'price_calculations'

    id = Column(Integer, primary_key=True)
    watch_id = Column(Integer, ForeignKey('watches.id', ondelete='CASCADE'))
    condition = Column(String(50))
    floor_price_usd = Column(Numeric(12, 2))
    avg_price_usd = Column(Numeric(12, 2))
    ceiling_price_usd = Column(Numeric(12, 2))
    recommended_list_price = Column(Numeric(12, 2))
    recommended_margin_percent = Column(Numeric(5, 2))
    buy_recommendation = Column(Boolean)
    data_points_count = Column(Integer)
    confidence_score = Column(Numeric(3, 2))
    calculated_at = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime)

    watch = relationship("Watch", back_populates="price_calculations")


class ScrapingJob(Base):
    __tablename__ = 'scraping_jobs'

    id = Column(Integer, primary_key=True)
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), default='pending')
    search_query = Column(String(200))
    filters = Column(JSON, default={})
    listings_found = Column(Integer, default=0)
    listings_new = Column(Integer, default=0)
    listings_updated = Column(Integer, default=0)
    errors = Column(JSON, default=[])
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
