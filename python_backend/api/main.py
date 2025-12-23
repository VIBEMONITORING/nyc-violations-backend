"""
FastAPI REST API for Luxury Watch Pricing Intelligence Engine
"""
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

from python_backend.database.db import get_db
from python_backend.models.models import (
    Watch, Brand, MarketplaceListing, PriceHistory,
    ParsedMessage, PriceAlert, PriceCalculation
)
from python_backend.analytics.price_analyzer import PriceAnalyzer
from python_backend.analytics.business_rules import BusinessRulesEngine
from python_backend.parsers.message_parser import MessageParser
from python_backend.config.config import settings

# Initialize FastAPI app
app = FastAPI(
    title="Luxury Watch Pricing Intelligence API",
    description="API for marketplace pricing intelligence and analysis",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }


# Watch endpoints

@app.get("/api/watches")
async def list_watches(
    brand: Optional[str] = None,
    reference: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List watches with optional filtering"""
    query = db.query(Watch)

    if brand:
        query = query.join(Brand).filter(Brand.name.ilike(f"%{brand}%"))

    if reference:
        query = query.filter(Watch.reference_number.ilike(f"%{reference}%"))

    total = query.count()
    watches = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "watches": [
            {
                "id": w.id,
                "brand": w.brand.name if w.brand else None,
                "reference_number": w.reference_number,
                "model": w.model,
                "case_material": w.case_material,
                "dial_color": w.dial_color,
            }
            for w in watches
        ]
    }


@app.get("/api/watches/{watch_id}")
async def get_watch(watch_id: int, db: Session = Depends(get_db)):
    """Get detailed watch information"""
    watch = db.query(Watch).filter(Watch.id == watch_id).first()

    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")

    return {
        "id": watch.id,
        "brand": watch.brand.name if watch.brand else None,
        "reference_number": watch.reference_number,
        "model": watch.model,
        "case_material": watch.case_material,
        "dial_color": watch.dial_color,
        "movement": watch.movement,
        "case_diameter": watch.case_diameter,
        "metadata": watch.metadata,
    }


# Marketplace listings endpoints

@app.get("/api/listings")
async def list_listings(
    watch_id: Optional[int] = None,
    marketplace: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    is_active: bool = True,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List marketplace listings with filters"""
    query = db.query(MarketplaceListing).filter(
        MarketplaceListing.is_active == is_active
    )

    if watch_id:
        query = query.filter(MarketplaceListing.watch_id == watch_id)

    if marketplace:
        query = query.filter(MarketplaceListing.marketplace == marketplace)

    if condition:
        query = query.filter(MarketplaceListing.condition == condition)

    if min_price is not None:
        query = query.filter(MarketplaceListing.price_usd >= min_price)

    if max_price is not None:
        query = query.filter(MarketplaceListing.price_usd <= max_price)

    total = query.count()
    listings = query.order_by(MarketplaceListing.last_seen.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "listings": [
            {
                "id": l.id,
                "watch_id": l.watch_id,
                "reference_number": l.watch.reference_number if l.watch else None,
                "brand": l.watch.brand.name if l.watch and l.watch.brand else None,
                "title": l.title,
                "price_usd": float(l.price_usd) if l.price_usd else None,
                "condition": l.condition,
                "year": l.year,
                "marketplace": l.marketplace,
                "seller_name": l.seller.seller_name if l.seller else None,
                "seller_trust_score": float(l.seller.trust_score) if l.seller and l.seller.trust_score else None,
                "listing_url": l.listing_url,
                "last_seen": l.last_seen,
            }
            for l in listings
        ]
    }


# Price analysis endpoints

@app.get("/api/analysis/watch/{watch_id}")
async def analyze_watch_price(
    watch_id: int,
    condition: Optional[str] = None,
    days_back: int = 30,
    db: Session = Depends(get_db)
):
    """Get price analysis for a watch"""
    analyzer = PriceAnalyzer(db)

    try:
        analysis = analyzer.analyze_watch_pricing(watch_id, condition, days_back)
        return analysis
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@app.get("/api/analysis/opportunities")
async def find_opportunities(
    brand: Optional[str] = None,
    max_results: int = Query(default=50, le=100),
    db: Session = Depends(get_db)
):
    """Find buying opportunities"""
    analyzer = PriceAnalyzer(db)

    try:
        opportunities = analyzer.find_buying_opportunities(brand, max_results)
        return {"opportunities": opportunities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding opportunities: {str(e)}")


@app.get("/api/analysis/price-drops")
async def detect_price_drops(
    hours_back: int = Query(default=24, le=168),
    min_drop_percent: float = Query(default=5.0, ge=0),
    db: Session = Depends(get_db)
):
    """Detect recent price drops"""
    analyzer = PriceAnalyzer(db)

    try:
        drops = analyzer.detect_price_drops(hours_back, Decimal(str(min_drop_percent)))
        return {"price_drops": drops}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting price drops: {str(e)}")


@app.post("/api/analysis/pricing-recommendation")
async def get_pricing_recommendation(
    watch_id: int,
    condition: str,
    target_margin: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Get recommended pricing"""
    analyzer = PriceAnalyzer(db)

    try:
        target_margin_decimal = Decimal(str(target_margin)) if target_margin else None
        recommendation = analyzer.calculate_recommended_pricing(
            watch_id, condition, target_margin_decimal
        )
        return recommendation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating pricing: {str(e)}")


# Message parsing endpoints

@app.post("/api/parse/message")
async def parse_message(
    message: str,
    source: str = "whatsapp",
    db: Session = Depends(get_db)
):
    """Parse a message containing watch listings"""
    parser = MessageParser()

    try:
        listings = parser.parse_message(message, source)

        # Save to database
        for listing in listings:
            parsed_msg = ParsedMessage(
                source=source,
                raw_message=message,
                parsed_data=listing.dict(),
                reference_number=listing.reference_number,
                year=listing.year,
                condition=listing.condition,
                price_amount=listing.price_amount,
                currency=listing.currency,
                confidence_score=listing.confidence_score,
            )
            db.add(parsed_msg)

        db.commit()

        return {
            "parsed_count": len(listings),
            "listings": [l.dict() for l in listings]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Parsing error: {str(e)}")


@app.get("/api/parse/messages")
async def list_parsed_messages(
    is_processed: Optional[bool] = None,
    min_confidence: Optional[float] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List parsed messages"""
    query = db.query(ParsedMessage)

    if is_processed is not None:
        query = query.filter(ParsedMessage.is_processed == is_processed)

    if min_confidence is not None:
        query = query.filter(ParsedMessage.confidence_score >= min_confidence)

    total = query.count()
    messages = query.order_by(ParsedMessage.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "messages": [
            {
                "id": m.id,
                "source": m.source,
                "reference_number": m.reference_number,
                "price_amount": float(m.price_amount) if m.price_amount else None,
                "currency": m.currency,
                "condition": m.condition,
                "year": m.year,
                "confidence_score": float(m.confidence_score) if m.confidence_score else None,
                "is_processed": m.is_processed,
                "created_at": m.created_at,
            }
            for m in messages
        ]
    }


# Price history endpoints

@app.get("/api/price-history/{watch_id}")
async def get_price_history(
    watch_id: int,
    days_back: int = Query(default=30, le=365),
    condition: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get price history for a watch"""
    since_date = datetime.utcnow() - timedelta(days=days_back)

    query = db.query(PriceHistory).filter(
        PriceHistory.watch_id == watch_id,
        PriceHistory.recorded_at >= since_date
    )

    if condition:
        query = query.filter(PriceHistory.condition == condition)

    history = query.order_by(PriceHistory.recorded_at).all()

    return {
        "watch_id": watch_id,
        "days_back": days_back,
        "data_points": len(history),
        "history": [
            {
                "price_usd": float(h.price_usd) if h.price_usd else None,
                "condition": h.condition,
                "marketplace": h.marketplace,
                "recorded_at": h.recorded_at,
            }
            for h in history
        ]
    }


# Statistics endpoints

@app.get("/api/stats/summary")
async def get_summary_stats(db: Session = Depends(get_db)):
    """Get summary statistics"""
    total_watches = db.query(Watch).count()
    total_listings = db.query(MarketplaceListing).filter(
        MarketplaceListing.is_active == True
    ).count()
    total_brands = db.query(Brand).count()

    # Recent price data points
    since_24h = datetime.utcnow() - timedelta(hours=24)
    recent_price_updates = db.query(PriceHistory).filter(
        PriceHistory.recorded_at >= since_24h
    ).count()

    return {
        "total_watches": total_watches,
        "total_active_listings": total_listings,
        "total_brands": total_brands,
        "price_updates_24h": recent_price_updates,
        "timestamp": datetime.utcnow(),
    }


@app.get("/api/stats/brands")
async def get_brand_stats(db: Session = Depends(get_db)):
    """Get statistics by brand"""
    from sqlalchemy import func

    stats = db.query(
        Brand.name,
        func.count(Watch.id).label('watch_count'),
        func.count(MarketplaceListing.id).label('listing_count')
    ).join(Watch).outerjoin(MarketplaceListing).group_by(Brand.name).all()

    return {
        "brands": [
            {
                "brand": s[0],
                "watch_count": s[1],
                "listing_count": s[2]
            }
            for s in stats
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD
    )
